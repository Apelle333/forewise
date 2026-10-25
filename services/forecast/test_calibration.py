"""Analytic fixtures test mathematics; they are not claimed Timestral predictions."""

import csv
import hashlib
import importlib.util
import json
from argparse import Namespace
from dataclasses import FrozenInstanceError
from pathlib import Path

import numpy as np
import pytest
from calibration import IntervalCalibration, fit_intervals, interval_metrics, temporal_plan
from ingestion import validate_and_clean_data


def analytic_blocks(count=20):
    return [
        {"actual": [2 + i, 2 + 2 * i], "native": {"p10": [0, 0], "p50": [1, 1], "p90": [2, 2]}}
        for i in range(1, count + 1)
    ]


def test_temporal_targets_are_disjoint_with_calibration_strictly_before_test():
    plan = temporal_plan(800, 12)
    cal = [i for start in plan["calibration_cutoffs"] for i in range(start, start + 12)]
    test = [i for start in plan["test_cutoffs"] for i in range(start, start + 12)]
    assert len(cal) == len(set(cal)) == 360 and len(test) == len(set(test)) == 360
    assert max(cal) < min(test) and max(test) == 799
    assert min(plan["calibration_cutoffs"]) >= 64
    assert plan["calibration_target_end_exclusive"] == plan["test_target_start"]


def test_insufficient_air_passengers_history_does_not_silently_reduce_sample_size():
    plan = temporal_plan(144, 12)
    assert plan == {
        "status": "insufficient_history",
        "required_points": 784,
        "available_points": 144,
    }
    assert temporal_plan(144, 1)["status"] == "ready"


@pytest.mark.parametrize(
    "arguments", [(800, True), (800, 0), (800, 91), (800, 1, 19, 30), (800, 1, 30, 19)]
)
def test_protocol_rejects_unreviewable_or_too_small_protocols(arguments):
    with pytest.raises(ValueError):
        temporal_plan(*arguments)


def test_order_statistic_is_noninterpolated_and_specific_to_forecast_lead():
    fitted = fit_intervals(analytic_blocks())
    assert fitted.factors == (8.5, 17.0)  # ceil(21*0.8) = 17; widths = 2.
    adjusted = fitted.apply({"p10": [0, 0], "p50": [1, 1], "p90": [2, 2]})
    assert adjusted == {"lower": [-17, -34], "median": [1, 1], "upper": [19, 36]}
    with pytest.raises(FrozenInstanceError):
        fitted.origin_count = 21
    # Frozen attributes must not retain a caller-mutable list of correction factors.
    with pytest.raises(ValueError):
        IntervalCalibration([1.0], 20, 0.8)


def test_native_coverage_does_not_cause_negative_corrections_or_relabel_quantiles():
    blocks = [{"actual": [1], "native": {"p10": [0], "p50": [1], "p90": [2]}} for _ in range(20)]
    fitted = fit_intervals(blocks)
    assert fitted.factors == (0,)
    assert fitted.apply(blocks[0]["native"]) == {"lower": [0], "median": [1], "upper": [2]}


def test_zero_width_and_signed_series_remain_finite_and_preserve_median():
    for value in [0.0, -100.0]:
        blocks = [
            {"actual": [value + 2], "native": {k: [value] for k in ("p10", "p50", "p90")}}
            for _ in range(20)
        ]
        adjusted = fit_intervals(blocks).apply(blocks[0]["native"])
        assert adjusted["median"] == [value]
        assert adjusted["lower"][0] == pytest.approx(value - 2)
        assert adjusted["upper"][0] == pytest.approx(value + 2)
        assert all(np.isfinite(v).all() for v in adjusted.values())


def test_calibration_refuses_too_few_samples_nonfinite_targets_and_crossing_outputs():
    with pytest.raises(ValueError):
        fit_intervals(analytic_blocks(19))
    with pytest.raises(ValueError):
        fit_intervals(analytic_blocks(), level=0.99)
    blocks = analytic_blocks()
    blocks[0]["actual"][0] = float("nan")
    with pytest.raises(ValueError):
        fit_intervals(blocks)
    blocks = analytic_blocks()
    blocks[0]["native"]["p10"][0] = 10
    with pytest.raises(RuntimeError):
        fit_intervals(blocks)


@pytest.mark.parametrize("factors", [(), (-1.0,), (float("nan"),), (float("inf"),)])
def test_invalid_preconstructed_calibration_cannot_shrink_or_corrupt_intervals(factors):
    with pytest.raises(ValueError):
        IntervalCalibration(factors, 20, 0.8)


def test_interval_score_penalizes_width_and_misses_and_counts_origins_separately():
    result = interval_metrics([[0, 3], [2, 5]], [[0, 0], [0, 0]], [[2, 2], [2, 2]])
    assert result["coverage"] == 0.5 and result["mean_width"] == 2
    assert result["mean_interval_score"] == pytest.approx(12)
    assert result["origin_count"] == result["points_per_lead"] == 2
    assert result["target_point_count"] == 4
    assert result["below_interval_rate"] == 0 and result["above_interval_rate"] == 0.5


def test_interval_metrics_refuse_malformed_or_infinite_intervals():
    for lo, hi in [([[3]], [[2]]), ([[float("nan")]], [[2]]), ([[0, 1]], [[2]])]:
        with pytest.raises(ValueError):
            interval_metrics([[1]], lo, hi)


def test_committed_fixture_hashes_counts_and_ingestion_contract_are_valid():
    root = Path(__file__).resolve().parents[2] / "docs/phase-03a/fixtures"
    manifest = json.loads((root / "manifest.json").read_text())
    for series in manifest["series"]:
        path = root / f"{series['name']}.csv"
        assert hashlib.sha256(path.read_bytes()).hexdigest() == series["sha256"]
        with path.open() as handle:
            points = [
                {"date": r["date"], "value": float(r["value"])} for r in csv.DictReader(handle)
            ]
        assert len(points) == series["count"]
        assert validate_and_clean_data(points, series["frequency"]).is_valid


def test_harness_freezes_calibration_and_selection_before_test_inference(monkeypatch):
    """A spy/stub verifies orchestration only; benchmark evidence always uses the real model."""
    root = Path(__file__).resolve().parents[2]
    spec = importlib.util.spec_from_file_location(
        "quality_benchmark", root / "scripts/benchmark-quality.py"
    )
    harness = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(harness)
    calls = []
    frozen = []
    original_fit = harness.fit_intervals

    def fit(blocks):
        assert len(calls) == 20 and len(blocks) == 20
        frozen.append(True)
        return original_fit(blocks)

    def analytic_forecast(values, horizon, device):
        if len(calls) >= 20:
            assert frozen, "Test inference started before calibration was frozen"
        calls.append(list(values))
        return {"p10": [0], "p50": [1], "p90": [2]}, {
            "inference_seconds": 0,
            "peak_rss_bytes_sampled": 0,
            "peak_vram_allocated_bytes": 0,
        }

    monkeypatch.setattr(harness, "fit_intervals", fit)
    monkeypatch.setattr(harness, "infer", analytic_forecast)
    from test_foundation import points

    history = points(104)
    result, blocks = harness.assess(
        {"name": "analytic_spy", "frequency": "daily"},
        history,
        Namespace(horizon=1, calibration_windows=20, test_windows=20, device="cpu"),
    )
    assert [len(values) for values in calls] == list(range(64, 104))
    assert all(values == [p["value"] for p in history[: len(values)]] for values in calls)
    assert result["calibration"]["fitted_through"] < result["calibration"]["test_start"]
    assert result["model_selection"]["selected_without_test"] == "seasonal_naive_period_7"
    assert len(blocks) == 40
