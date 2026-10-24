"""Bounded real 209M CPU/GPU measurements and deterministic synthetic evaluation."""

import argparse
import csv
import json
import math
import platform
import random
import sys
import time
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services/forecast"))
from evaluation import predict, prepared  # noqa: E402
from probabilistic import evaluate  # noqa: E402
from timestral_engine import CODE_REVISION, MODEL_ID, MODEL_REVISION, infer  # noqa: E402

parser = argparse.ArgumentParser()
parser.add_argument("--device", choices=["cpu", "cuda"], required=True)
parser.add_argument("--output", required=True)
args = parser.parse_args()
start = time.perf_counter()
cases = []
for context, horizon in [(28, 7), (128, 28), (512, 28), (2048, 90), (5000, 90)]:
    values = [100 + 0.08 * i + 20 * math.sin(i * 2 * math.pi / 7) for i in range(context)]
    for repeat in range(4):
        call_start = time.perf_counter()
        quantiles, performance = infer(values, horizon, args.device)
        performance["call_wall_seconds_including_torch_import"] = time.perf_counter() - call_start
        cases.append(
            {
                "context": context,
                "horizon": horizon,
                "repeat": repeat,
                **performance,
                "forecasts_per_minute": 60 / performance["inference_seconds"],
                "first_p10_p50_p90": [quantiles[k][0] for k in ["p10", "p50", "p90"]],
            }
        )
evaluations = []


def annual_baseline(points, horizon, frequency):
    frame, freq, _ = prepared(points, frequency)
    season = 52 if frequency == "weekly" else 12
    errors = []
    for window in range(3, 0, -1):
        cutoff = len(points) - window * horizon
        forecast = predict(frame.iloc[:cutoff], horizon, freq, season)
        errors.extend(
            p - float(y["value"])
            for p, y in zip(forecast["SeasonalNaive"], points[cutoff : cutoff + horizon])
        )
    return {
        "season_length": season,
        "mae": sum(abs(e) for e in errors) / len(errors),
        "rmse": math.sqrt(sum(e * e for e in errors) / len(errors)),
    }


for name, frequency, count, horizon in [
    ("daily_demand", "daily", 180, 14),
    ("weekly_sales", "weekly", 104, 8),
    ("monthly_revenue", "monthly", 72, 6),
    ("seasonal", "daily", 365, 28),
    ("intermittent", "daily", 180, 14),
]:
    rng = random.Random(20261025)
    points = []
    for i in range(count):
        day = (
            date(2020 + i // 12, i % 12 + 1, 1)
            if frequency == "monthly"
            else date(2020, 1, 1) + timedelta(days=i * (7 if frequency == "weekly" else 1))
        )
        value = (
            0.0
            if name == "intermittent" and i % 5
            else max(
                0,
                100
                + 0.15 * i
                + 25 * math.sin(i * 2 * math.pi / (12 if frequency == "monthly" else 7))
                + rng.gauss(0, 8),
            )
        )
        points.append({"date": day.isoformat(), "value": value})
    evaluations.append(
        {
            "name": name,
            "frequency": frequency,
            "fixture": "Deterministic synthetic fixture, seed 20261025; no business validation",
            "context": count,
            "horizon": horizon,
            **evaluate(points, horizon, frequency, args.device),
            **(
                {"annual_seasonal_naive": annual_baseline(points, horizon, frequency)}
                if frequency in {"weekly", "monthly"}
                else {}
            ),
        }
    )
public = Path(__file__).resolve().parents[1] / "docs/phase-02b/fixtures/air-passengers.csv"
with public.open() as handle:
    air = [{"date": row["date"], "value": float(row["value"])} for row in csv.DictReader(handle)]
evaluations.append(
    {
        "name": "AirPassengers",
        "frequency": "monthly",
        "fixture": "Real public R datasets / Box & Jenkins monthly airline passengers, 1949–1960; thousands.",
        "context": len(air),
        "horizon": 12,
        **evaluate(air, 12, "monthly", args.device),
        "annual_seasonal_naive": annual_baseline(air, 12, "monthly"),
    }
)
result = {
    "model": MODEL_ID,
    "revision": MODEL_REVISION,
    "code_revision": CODE_REVISION,
    "device": args.device,
    "platform": platform.platform(),
    "elapsed_seconds": time.perf_counter() - start,
    "cases": cases,
    "evaluation": evaluations,
    "notes": [
        "Float32 official default symmetric averaging and nonnegative clipping. No custom normalization.",
        "RSS sampled every 20ms; GPU allocator peak is process allocation, not total system VRAM.",
        "Local unthrottled measurements may include concurrent user applications. Cold model load excludes library import; cold first call downloads weights only if uncached.",
        "No global superiority claim; compare individual MAE and RMSE rows.",
    ],
}
target = Path(args.output)
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(result, indent=2, allow_nan=False), encoding="utf-8")
print(
    json.dumps(
        {
            "device": args.device,
            "elapsed_seconds": result["elapsed_seconds"],
            "cold": cases[0],
            "warm": cases[1],
            "evaluation_cases": len(evaluations),
        },
        indent=2,
    )
)
