"""Version 2 dispatch and leakage-free comparison against the existing baseline."""

import math
import time
from datetime import date

from evaluation import predict, prepared
from evaluation import run_forecast as baseline_forecast
from ingestion import advance_date
from timestral_engine import CODE_REVISION, MODEL_ID, MODEL_REVISION, infer


def metrics(actual, quantiles):
    n = len(actual)
    errors = [p - y for p, y in zip(quantiles["p50"], actual)]
    denominator = sum(abs(y) for y in actual)
    return {
        "mae": sum(abs(e) for e in errors) / n,
        "rmse": math.sqrt(sum(e * e for e in errors) / n),
        "wape": sum(abs(e) for e in errors) / denominator if denominator else None,
        "pinball": {
            f"p{int(q * 100)}": sum(
                max(q * (y - p), (q - 1) * (y - p))
                for y, p in zip(actual, quantiles[f"p{int(q * 100)}"])
            )
            / n
            for q in (0.1, 0.5, 0.9)
        },
        "coverage_p10_p90": sum(
            lo <= y <= hi for lo, y, hi in zip(quantiles["p10"], actual, quantiles["p90"])
        )
        / n,
    }


def evaluate(points, horizon, frequency, device=None):
    frame, freq, season = prepared(points, frequency)
    windows = min(3, (len(points) - max(8, season)) // horizon)
    if windows < 2:
        return {
            "metrics": None,
            "baseline_metrics": None,
            "windows": 0,
            "evaluated_points": 0,
            "warnings": ["Insufficient history for two rolling-origin windows at this horizon."],
        }
    collected = {key: [] for key in ["p10", "p50", "p90"]}
    actual = []
    baseline = []
    cutoffs = []
    start = time.perf_counter()
    for window in range(windows, 0, -1):
        cutoff = len(points) - window * horizon
        values = [p["value"] for p in points[:cutoff]]
        result, _ = infer(values, horizon, device)
        predicted = predict(frame.iloc[:cutoff], horizon, freq, season)
        expected = [p["date"] for p in points[cutoff : cutoff + horizon]]
        if [d.strftime("%Y-%m-%d") for d in predicted["ds"]] != expected:
            raise ValueError("Backtest timestamps do not align.")
        actual.extend(p["value"] for p in points[cutoff : cutoff + horizon])
        baseline.extend(predicted["SeasonalNaive"].tolist())
        for key in collected:
            collected[key].extend(result[key])
        cutoffs.append(points[cutoff - 1]["date"])
    baseline_errors = [p - y for p, y in zip(baseline, actual)]
    denominator = sum(abs(y) for y in actual)
    return {
        "metrics": metrics(actual, collected),
        "baseline_metrics": {
            "mae": sum(abs(e) for e in baseline_errors) / len(actual),
            "rmse": math.sqrt(sum(e * e for e in baseline_errors) / len(actual)),
            "wape": sum(abs(e) for e in baseline_errors) / denominator if denominator else None,
        },
        "baseline_season_length": season,
        "windows": windows,
        "evaluated_points": len(actual),
        "cutoffs": cutoffs,
        "seconds": time.perf_counter() - start,
        "warnings": [],
    }


def run_forecast(payload):
    if payload.get("contract_version") == "1":
        return baseline_forecast(payload)
    if payload.get("contract_version") != "2" or payload.get("model") not in {
        "seasonal_naive",
        "timestral_209m",
    }:
        raise ValueError("Unsupported forecasting contract or model.")
    if payload["model"] == "seasonal_naive":
        result = baseline_forecast({**payload, "contract_version": "1"})
        result["contract_version"] = "2"
        return result
    horizon = payload.get("horizon")
    if isinstance(horizon, bool) or not isinstance(horizon, int) or not 1 <= horizon <= 90:
        raise ValueError("Horizon must be 1 to 90 steps.")
    points = payload.get("points")
    frequency = payload.get("frequency")
    prepared(points, frequency)
    last = date.fromisoformat(points[-1]["date"])
    dates = [advance_date(last, i, frequency).isoformat() for i in range(1, horizon + 1)]
    values, performance = infer([p["value"] for p in points], horizon)
    quantiles = {
        key: [{"date": day, "value": value} for day, value in zip(dates, array)]
        for key, array in values.items()
    }
    backtest = evaluate(points, horizon, frequency)
    warnings = list(backtest["warnings"])
    if backtest["metrics"] and backtest["metrics"]["coverage_p10_p90"] < 0.8:
        warnings.append(
            "Historical P10–P90 coverage is below the nominal 80%. These native intervals are not calibrated for this series."
        )
    return {
        "contract_version": "2",
        "model": "timestral_209m",
        "mock": False,
        "validated": False,
        "frequency": frequency,
        "points": quantiles["p50"],
        "quantiles": quantiles,
        "metrics": backtest["metrics"],
        "evaluation": backtest,
        "performance": performance,
        "warnings": warnings
        + (
            ["CPU fallback used after GPU memory exhaustion."]
            if "fallback_reason" in performance
            else []
        ),
        "metadata": {
            "model_id": MODEL_ID,
            "revision": MODEL_REVISION,
            "code_revision": CODE_REVISION,
            "quantile_levels": [0.1, 0.5, 0.9],
            "normalization": "Official causal patch scaling/asinh; no external normalization",
            "context_steps": len(points),
        },
        "notice": "Genuine Timestral-209M model quantiles. P10–P90 is a nominal 80% prediction interval, not a confidence interval or a calibrated coverage guarantee. Historical backtests do not validate future business performance.",
    }
