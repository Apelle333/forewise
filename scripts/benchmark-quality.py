"""Phase 03A: pinned real inference, frozen past-only calibration, untouched holdout.

Research output only. Does not submit jobs, change product defaults or claim
distribution-free validity for dependent, revised or potentially pretrained data.
"""

import argparse
import csv
import hashlib
import json
import statistics
import sys
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services/forecast"))
from calibration import fit_intervals, interval_metrics, temporal_plan  # noqa: E402
from evaluation import predict, prepared  # noqa: E402
from probabilistic import metrics  # noqa: E402
from timestral_engine import CODE_REVISION, MODEL_ID, MODEL_REVISION, infer  # noqa: E402


def point_metrics(actual, prediction):
    y, p = np.asarray(actual), np.asarray(prediction)
    errors = np.abs(y - p)
    denominator = float(np.abs(y).sum())
    return {
        "mae": float(errors.mean()),
        "median_absolute_error": float(np.median(errors)),
        "rmse": float(np.sqrt(((y - p) ** 2).mean())),
        "wape": float(errors.sum()) / denominator if denominator else None,
    }


def assess(series, points, args):
    plan = temporal_plan(len(points), args.horizon, args.calibration_windows, args.test_windows)
    record = {
        "name": series["name"],
        "frequency": series["frequency"],
        "horizon": args.horizon,
        "plan": plan,
    }
    if plan["status"] != "ready":
        return record, []
    frame, freq, legacy_season = prepared(points, series["frequency"])
    annual_season = {"daily": 7, "weekly": 52, "monthly": 12}[series["frequency"]]
    seasons = sorted({legacy_season, annual_season})
    models = [f"seasonal_naive_period_{s}" for s in seasons] + ["timestral_209m"]

    def output(block, name):
        return block["native"]["p50"] if name == "timestral_209m" else block["baselines"][name]

    blocks = []
    for purpose in ("calibration", "test"):
        if purpose == "test":
            # Freeze both decisions before generating even the first test forecast.
            fitted = fit_intervals(blocks)
            cal_y = [v for b in blocks for v in b["actual"]]
            calibration_scores = {
                name: point_metrics(cal_y, [v for b in blocks for v in output(b, name)])
                for name in models
            }
            selected = min(
                models,
                key=lambda name: (calibration_scores[name]["mae"], name == "timestral_209m", name),
            )
        for cutoff in plan[f"{purpose}_cutoffs"]:
            native, performance = infer(
                [p["value"] for p in points[:cutoff]], args.horizon, args.device
            )
            targets = points[cutoff : cutoff + args.horizon]
            baselines = {}
            for season in seasons:
                forecast = predict(frame.iloc[:cutoff], args.horizon, freq, season)
                if forecast["ds"].dt.strftime("%Y-%m-%d").tolist() != [p["date"] for p in targets]:
                    raise ValueError("Baseline timestamps do not match held-out observations")
                baselines[f"seasonal_naive_period_{season}"] = forecast["SeasonalNaive"].tolist()
            blocks.append(
                {
                    "purpose": purpose,
                    "train_end": points[cutoff - 1]["date"],
                    "target_dates": [p["date"] for p in targets],
                    "actual": [p["value"] for p in targets],
                    "native": native,
                    "baselines": baselines,
                    "performance": performance,
                }
            )
    cal = [b for b in blocks if b["purpose"] == "calibration"]
    test = [b for b in blocks if b["purpose"] == "test"]
    if cal[-1]["target_dates"][-1] >= test[0]["target_dates"][0]:
        raise ValueError("Calibration targets overlap the test period")
    adjusted = [fitted.apply(b["native"]) for b in test]
    actual = np.asarray([b["actual"] for b in test])
    native = {key: [b["native"][key] for b in test] for key in ("p10", "p50", "p90")}
    record["native_interval"] = interval_metrics(actual, native["p10"], native["p90"])
    record["adjusted_interval"] = interval_metrics(
        actual, [b["lower"] for b in adjusted], [b["upper"] for b in adjusted]
    )
    record["native_quantile_metrics"] = metrics(
        actual.flatten().tolist(), {k: np.asarray(v).flatten().tolist() for k, v in native.items()}
    )
    record["model_selection"] = {
        "rule": "Lowest calibration-period MAE; baseline preferred on exact ties. Frozen before test.",
        "calibration_scores": calibration_scores,
        "selected_without_test": selected,
        "test_scores": {
            name: point_metrics(actual.flatten(), [v for b in test for v in output(b, name)])
            for name in models
        },
        "product_default_changed": False,
    }
    native_width = record["native_interval"]["mean_width"]
    record["calibration"] = {
        "method": "nonnegative width-normalized CQR order statistic per forecast lead",
        "level": fitted.level,
        "origin_count": fitted.origin_count,
        "factors_by_lead": fitted.factors,
        "fitted_through": cal[-1]["target_dates"][-1],
        "test_start": test[0]["target_dates"][0],
        "median_unchanged": True,
        "endpoints_are_not_calibrated_p10_p90_quantiles": True,
    }
    record["comparison"] = {
        "width_ratio": record["adjusted_interval"]["mean_width"] / native_width
        if native_width
        else None,
        "coverage_difference": record["adjusted_interval"]["coverage"]
        - record["native_interval"]["coverage"],
        "interval_score_difference": record["adjusted_interval"]["mean_interval_score"]
        - record["native_interval"]["mean_interval_score"],
        "nominal_coverage_reached_on_this_test": record["adjusted_interval"]["coverage"] >= 0.8,
        "production_promotion": "not_authorized_by_this_benchmark",
    }
    times = [b["performance"]["inference_seconds"] for b in blocks]
    record["performance"] = {
        "inference_calls": len(blocks),
        "mean_inference_seconds": statistics.mean(times),
        "median_inference_seconds": statistics.median(times),
        "peak_sampled_rss_bytes": max(b["performance"]["peak_rss_bytes_sampled"] for b in blocks),
        "peak_allocated_vram_bytes": max(
            b["performance"]["peak_vram_allocated_bytes"] for b in blocks
        ),
    }
    return record, blocks


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--device", choices=["auto", "cpu", "cuda"], default="auto")
    parser.add_argument("--only", help="Exact fixture name for smoke tests")
    parser.add_argument(
        "--horizons", help="Explicit comma-separated horizons; default is the committed matrix"
    )
    parser.add_argument("--calibration-windows", type=int, default=30)
    parser.add_argument("--test-windows", type=int, default=30)
    parser.add_argument("--output", required=True)
    parser.add_argument(
        "--folds-output", help="Optional public-fixture forecast audit trail (never customer data)"
    )
    args = parser.parse_args()
    fixtures = ROOT / "docs/phase-03a/fixtures"
    manifest = json.loads((fixtures / "manifest.json").read_text(encoding="utf-8"))
    if args.only and args.only not in {s["name"] for s in manifest["series"]}:
        parser.error("Unknown fixture")
    started = time.perf_counter()
    results, audit = [], []
    for series in manifest["series"]:
        if args.only and args.only != series["name"]:
            continue
        path = fixtures / f"{series['name']}.csv"
        if hashlib.sha256(path.read_bytes()).hexdigest() != series["sha256"]:
            raise ValueError("Fixture hash mismatch; do not benchmark an unreviewed revision")
        with path.open() as handle:
            points = [
                {"date": row["date"], "value": float(row["value"])}
                for row in csv.DictReader(handle)
            ]
        if len(points) != series["count"]:
            raise ValueError("Fixture row count mismatch")
        prepared(points, series["frequency"])
        for horizon in (
            [int(x) for x in args.horizons.split(",")] if args.horizons else series["horizons"]
        ):
            args.horizon = horizon
            result, blocks = assess(series, points, args)
            results.append(result)
            audit.append({"name": series["name"], "horizon": horizon, "blocks": blocks})
            print(
                json.dumps(
                    {
                        "name": series["name"],
                        "horizon": horizon,
                        "status": result["plan"]["status"],
                        "comparison": result.get("comparison"),
                    }
                ),
                flush=True,
            )
    report = {
        "status": "research_only_pending_independent_review",
        "model": MODEL_ID,
        "weights_revision": MODEL_REVISION,
        "implementation_revision": CODE_REVISION,
        "fixture_manifest_sha256": hashlib.sha256(
            (fixtures / "manifest.json").read_bytes()
        ).hexdigest(),
        "protocol": {
            "calibration_windows": args.calibration_windows,
            "test_windows": args.test_windows,
            "minimum_train_observations": 64,
            "target_coverage": 0.8,
            "disjoint_targets": True,
            "refit_on_test": False,
            "bootstrap_origin_block_length": 4,
            "smoke_test_only": args.only is not None or args.horizons is not None,
        },
        "elapsed_seconds": time.perf_counter() - started,
        "cases": results,
        "limits": [
            "Time dependence and drift invalidate an automatic exchangeability guarantee.",
            "Public series may have appeared in pretraining; revised ICSA is not a historical vintage.",
            "Adjusted central endpoints are not calibrated marginal quantiles.",
            "Thirty test origins per lead are pilot evidence, not commercial validation.",
            "No test-based model switching, product default changes or deployment.",
        ],
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes((json.dumps(report, indent=2, allow_nan=False) + "\n").encode("utf-8"))
    if args.folds_output:
        target = Path(args.folds_output)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(json.dumps(audit, allow_nan=False).encode("utf-8"))


if __name__ == "__main__":
    main()
