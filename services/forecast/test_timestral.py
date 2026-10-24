import os

import pytest
from probabilistic import metrics, run_forecast
from test_foundation import points
from timestral_engine import forecaster, infer, validate_quantiles


def test_quantile_validation_rejects_crossings_shapes_and_nonfinite_values():
    valid = {"p10": [1, 2], "p50": [2, 3], "p90": [3, 4]}
    assert validate_quantiles(valid, 2) == valid
    for invalid in [
        dict(valid, p10=[9, 9]),
        dict(valid, p50=[1]),
        dict(valid, p90=[float("nan"), 4]),
    ]:
        with pytest.raises(RuntimeError):
            validate_quantiles(invalid, 2)


def test_pinball_and_coverage_use_actual_values_and_zero_denominator_is_explicit():
    measured = metrics([2, 4], {"p10": [1, 3], "p50": [2, 3], "p90": [3, 5]})
    assert measured["mae"] == 0.5 and measured["wape"] == pytest.approx(1 / 6)
    assert measured["pinball"]["p50"] == 0.25 and measured["coverage_p10_p90"] == 1
    assert metrics([0], {"p10": [0], "p50": [0], "p90": [0]})["wape"] is None


def test_version_one_and_explicit_baseline_do_not_load_the_ai(monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError("Baseline attempted AI inference")

    monkeypatch.setattr("probabilistic.infer", forbidden)
    for version in ["1", "2"]:
        result = run_forecast(
            {
                "contract_version": version,
                "model": "seasonal_naive",
                "points": points(),
                "frequency": "daily",
                "horizon": 3,
            }
        )
        assert result["model"] == "seasonal-naive-v1" and result["quantiles"] is None
    with pytest.raises(ValueError):
        run_forecast({"contract_version": "2", "model": "unknown"})


@pytest.mark.skipif(
    os.getenv("RUN_TIMESTRAL_INTEGRATION") != "1", reason="Explicit real model integration gate"
)
def test_real_209m_load_is_cached_and_cpu_quantiles_are_native():
    model = forecaster("cpu")
    assert model is forecaster("cpu")
    assert 208_000_000 < sum(p.numel() for p in model.model.parameters()) < 211_000_000
    quantiles, performance = infer([p["value"] for p in points()], 7, "cpu")
    assert len(quantiles["p50"]) == 7 and performance["cache_hit"]
    validate_quantiles(quantiles, 7)


@pytest.mark.skipif(
    os.getenv("RUN_TIMESTRAL_INTEGRATION") != "1", reason="Explicit real model integration gate"
)
def test_real_gpu_or_explicit_cpu_fallback():
    import torch

    device = "cuda" if torch.cuda.is_available() else "cpu"
    quantiles, performance = infer([p["value"] for p in points()], 3, device)
    assert performance["device"] == device
    assert (
        performance["peak_vram_allocated_bytes"] > 0
        if device == "cuda"
        else performance["peak_vram_allocated_bytes"] == 0
    )
    validate_quantiles(quantiles, 3)


@pytest.mark.skipif(
    os.getenv("RUN_TIMESTRAL_INTEGRATION") != "1", reason="Explicit real model integration gate"
)
@pytest.mark.parametrize("frequency", ["daily", "weekly", "monthly"])
def test_real_version_two_handles_frequency_timestamps_horizon_and_evaluation(frequency):
    from datetime import date

    from ingestion import advance_date

    history = points(40, 7 if frequency == "weekly" else 1)
    if frequency == "monthly":
        history = [
            {"date": date(2020 + i // 12, i % 12 + 1, 1).isoformat(), "value": 100.0 + i}
            for i in range(40)
        ]
    result = run_forecast(
        {
            "contract_version": "2",
            "model": "timestral_209m",
            "points": history,
            "frequency": frequency,
            "horizon": 3,
        }
    )
    assert result["model"] == "timestral_209m" and result["contract_version"] == "2"
    assert (
        result["quantiles"]["p50"][0]["date"]
        == advance_date(date.fromisoformat(history[-1]["date"]), 1, frequency).isoformat()
    )
    assert result["evaluation"]["windows"] == 3 and result["evaluation"]["evaluated_points"] == 9
    assert result["evaluation"]["cutoffs"] == [history[i - 1]["date"] for i in [31, 34, 37]]
