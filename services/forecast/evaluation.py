"""SeasonalNaive point forecasts and expanding-window, rolling-origin evaluation."""

import math
from importlib.metadata import version

import pandas as pd
from ingestion import advance_date, validate_and_clean_data
from statsforecast import StatsForecast
from statsforecast.models import SeasonalNaive


def prepared(points, frequency):
    checked = validate_and_clean_data(points, frequency)
    if not checked.is_valid:
        raise ValueError(checked.warnings[0].message)
    frame = pd.DataFrame(checked.cleaned_points).rename(columns={"date": "ds", "value": "y"})
    frame["ds"] = pd.to_datetime(frame["ds"])
    frame["unique_id"] = "series"
    freq = {
        "daily": "D",
        "weekly": "7D",
        "monthly": "MS" if frame.iloc[0]["ds"].day == 1 else "ME",
    }[frequency]
    return frame, freq, 7 if frequency == "daily" else 1


def predict(frame, horizon, freq, season_length):
    return StatsForecast(
        models=[SeasonalNaive(season_length=season_length)], freq=freq, n_jobs=1
    ).forecast(df=frame, h=horizon)


def run_backtest(points, horizon, frequency="daily"):
    frame, freq, season_length = prepared(points, frequency)
    # Up to three disjoint holdout windows; every fit sees only its own past.
    windows = min(3, (len(frame) - max(8, season_length)) // horizon)
    if windows < 2:
        return {
            "metrics": None,
            "windows": 0,
            "evaluated_points": 0,
            "warnings": [
                "Insufficient history for at least two rolling-origin windows at this horizon."
            ],
        }
    errors = []
    cutoffs = []
    for window in range(windows, 0, -1):
        cutoff = len(frame) - window * horizon
        train, actual = frame.iloc[:cutoff], frame.iloc[cutoff : cutoff + horizon]
        forecast = predict(train, horizon, freq, season_length)
        if list(forecast["ds"]) != list(actual["ds"]):
            raise ValueError("Backtest timestamps do not align.")
        errors.extend((forecast["SeasonalNaive"].to_numpy() - actual["y"].to_numpy()).tolist())
        cutoffs.append(train.iloc[-1]["ds"].strftime("%Y-%m-%d"))
    return {
        "metrics": {
            "mae": sum(abs(e) for e in errors) / len(errors),
            "rmse": math.sqrt(sum(e * e for e in errors) / len(errors)),
        },
        "windows": windows,
        "evaluated_points": len(errors),
        "cutoffs": cutoffs,
        "warnings": [],
    }


def run_forecast(payload):
    if payload.get("contract_version") != "1":
        raise ValueError("Unsupported contract version.")
    horizon = payload.get("horizon")
    if isinstance(horizon, bool) or not isinstance(horizon, int) or not 1 <= horizon <= 90:
        raise ValueError("Horizon must be 1 to 90 steps.")
    frequency = payload.get("frequency")
    points = payload.get("points")
    frame, freq, season_length = prepared(points, frequency)
    advance_date(frame.iloc[-1]["ds"].date(), horizon, frequency)
    forecast = predict(frame, horizon, freq, season_length)
    evaluation = run_backtest(points, horizon, frequency)
    result_points = [
        {"date": row.ds.strftime("%Y-%m-%d"), "value": float(row.SeasonalNaive)}
        for row in forecast.itertuples()
    ]
    if any(not math.isfinite(p["value"]) for p in result_points):
        raise ValueError("Model returned non-finite predictions.")
    warnings = evaluation.pop("warnings")
    if frequency != "daily":
        warnings.append(
            "Season length is 1 for weekly/monthly data: a last-value baseline, not annual seasonality."
        )
    return {
        "contract_version": "1",
        "model": "seasonal-naive-v1",
        "mock": False,
        "validated": False,
        "frequency": frequency,
        "points": result_points,
        "quantiles": None,
        "metrics": evaluation["metrics"],
        "evaluation": evaluation,
        "warnings": warnings,
        "metadata": {
            "library": "statsforecast",
            "version": version("statsforecast"),
            "season_length": season_length,
        },
        "notice": "Statistical baseline with historical backtesting only. Predictive performance is not validated for your business; no calibrated probability intervals are provided.",
    }
