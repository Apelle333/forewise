import math
from datetime import date, timedelta

import pytest
from evaluation import run_backtest, run_forecast
from ingestion import validate_and_clean_data


def points(n=40, step=1):
    return [
        {"date": (date(2026, 1, 1) + timedelta(days=i * step)).isoformat(), "value": float(100 + i)}
        for i in range(n)
    ]


def test_ingestion_rejects_gaps_duplicates_nonfinite_and_unknown_frequency():
    for invalid in [
        points()[:5],
        points() + [points()[-1]],
        points()[::-1],
        points()[:10] + points()[11:],
    ]:
        assert not validate_and_clean_data(invalid).is_valid
    for value in [float("nan"), float("inf"), True, 1e13, "12"]:
        data = points()
        data[0]["value"] = value
        assert not validate_and_clean_data(data).is_valid
    assert not validate_and_clean_data(points(), "hourly").is_valid
    assert validate_and_clean_data(points(10, 7), "weekly").is_valid
    assert not validate_and_clean_data(points(), "weekly").is_valid


@pytest.mark.parametrize(
    "frequency,dates,expected",
    [
        (
            "daily",
            [(date(2026, 1, 1) + timedelta(days=i)).isoformat() for i in range(40)],
            "2026-02-10",
        ),
        (
            "weekly",
            [(date(2026, 1, 1) + timedelta(weeks=i)).isoformat() for i in range(10)],
            "2026-03-12",
        ),
        ("monthly", [f"2026-{i:02}-01" for i in range(1, 9)], "2026-09-01"),
        (
            "monthly",
            [
                "2026-01-31",
                "2026-02-28",
                "2026-03-31",
                "2026-04-30",
                "2026-05-31",
                "2026-06-30",
                "2026-07-31",
                "2026-08-31",
            ],
            "2026-09-30",
        ),
    ],
)
def test_baseline_has_correct_frequency_and_explicit_unvalidated_semantics(
    frequency, dates, expected
):
    data = [{"date": d, "value": float(i)} for i, d in enumerate(dates)]
    result = run_forecast(
        {"contract_version": "1", "points": data, "frequency": frequency, "horizon": 2}
    )
    assert result["points"][0]["date"] == expected
    assert result["points"][0]["value"] == data[-7 if frequency == "daily" else -1]["value"]
    assert result["validated"] is False and result["quantiles"] is None


def test_rolling_origins_measure_actual_model_column_and_never_use_future_training_data():
    result = run_backtest(points(40), 3)
    assert result["windows"] == 3 and result["evaluated_points"] == 9
    assert result["metrics"]["mae"] == 7
    assert result["metrics"]["rmse"] == 7
    assert len(set(result["cutoffs"])) == 3
    constant = [{**p, "value": 12.0} for p in points(40)]
    assert run_backtest(constant, 3)["metrics"] == {"mae": 0.0, "rmse": 0.0}
    short = run_backtest(points(8), 7)
    assert short["metrics"] is None and short["warnings"]
    assert all(math.isfinite(v) for v in result["metrics"].values())


def test_invalid_contract_and_horizon_are_not_silently_coerced():
    for horizon in [True, 0, 91, 1.5, "7"]:
        with pytest.raises(ValueError):
            run_forecast(
                {
                    "contract_version": "1",
                    "points": points(),
                    "frequency": "daily",
                    "horizon": horizon,
                }
            )
