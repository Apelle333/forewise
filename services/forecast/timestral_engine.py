"""Pinned official 209M inference only; no synthetic replacement or inferred bands."""

import gc
import os
import threading
import time
from functools import lru_cache

import numpy as np
import psutil

MODEL_ID = "mistralai/Timestral-209M"
MODEL_REVISION = "9874d252ab0aae16f7f7c999f98f98d6ad7d8365"
CODE_REVISION = "a534bdbd244d64f3d9d743f46c7bf6fc330ed4ff"
_cuda_failed = False


@lru_cache(maxsize=2)
def forecaster(device):
    import torch
    from timestral import TimestralForecaster

    torch.set_num_threads(int(os.getenv("FOREWISE_TORCH_THREADS", "8")))
    return TimestralForecaster.from_pretrained(
        MODEL_ID,
        revision=MODEL_REVISION,
        device=device,
        cache_dir=os.getenv("FOREWISE_MODEL_CACHE", ".data/model-cache"),
        token=False,
    )


def validate_quantiles(values, horizon):
    arrays = {key: np.asarray(values[key], dtype=float) for key in ("p10", "p50", "p90")}
    if any(a.shape != (horizon,) or not np.isfinite(a).all() for a in arrays.values()):
        raise RuntimeError("Model returned invalid quantile dimensions or non-finite values.")
    if np.any(arrays["p10"] > arrays["p50"]) or np.any(arrays["p50"] > arrays["p90"]):
        raise RuntimeError("Model returned crossing quantiles.")
    return {key: value.tolist() for key, value in arrays.items()}


def infer(values, horizon, device=None):
    import torch

    global _cuda_failed
    requested = device or os.getenv("FOREWISE_MODEL_DEVICE", "auto")
    if requested not in {"auto", "cpu", "cuda"}:
        raise ValueError("Unsupported inference device.")
    selected = (
        "cuda"
        if requested == "auto" and torch.cuda.is_available() and not _cuda_failed
        else ("cpu" if requested == "auto" else requested)
    )
    process = psutil.Process()
    peak = [process.memory_info().rss]
    stop = threading.Event()

    def sample():
        while not stop.wait(0.02):
            peak[0] = max(peak[0], process.memory_info().rss)

    sampler = threading.Thread(target=sample, daemon=True)
    sampler.start()
    start = time.perf_counter()
    before = forecaster.cache_info().misses
    try:
        if selected == "cuda":
            torch.cuda.reset_peak_memory_stats()
        model = forecaster(selected)
        if selected == "cuda":
            torch.cuda.synchronize()
        loaded = time.perf_counter()
        output = model.forecast(np.asarray(values, dtype=np.float32), prediction_length=horizon)
        if selected == "cuda":
            torch.cuda.synchronize()
        quantiles = validate_quantiles(
            {f"p{int(q * 100)}": output.quantile(q)[0, 0].cpu().numpy() for q in (0.1, 0.5, 0.9)},
            horizon,
        )
        end = time.perf_counter()
        peak[0] = max(peak[0], process.memory_info().rss)
        return quantiles, {
            "device": selected,
            "dtype": "float32",
            "cache_hit": before == forecaster.cache_info().misses,
            "load_seconds": loaded - start,
            "inference_seconds": end - loaded,
            "total_seconds": end - start,
            "peak_rss_bytes_sampled": peak[0],
            "peak_vram_allocated_bytes": torch.cuda.max_memory_allocated()
            if selected == "cuda"
            else 0,
            "peak_vram_reserved_bytes": torch.cuda.max_memory_reserved()
            if selected == "cuda"
            else 0,
        }
    except torch.cuda.OutOfMemoryError:
        if requested != "auto":
            raise
        _cuda_failed = True
        forecaster.cache_clear()
        gc.collect()
        torch.cuda.empty_cache()
        result, measured = infer(values, horizon, "cpu")
        measured["fallback_reason"] = "CUDA memory unavailable; CPU inference used."
        return result, measured
    finally:
        stop.set()
        sampler.join(timeout=1)
