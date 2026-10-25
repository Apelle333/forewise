"""Create pinned public and explicitly synthetic quality fixtures. No customer data."""

import argparse
import csv
import hashlib
import io
import json
import math
import random
import urllib.request
import zipfile
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "docs/phase-03a/fixtures"
SOURCES = {
    "bike.zip": (
        "https://archive.ics.uci.edu/static/public/275/bike+sharing+dataset.zip",
        "b70182d0d0508e9abbb79306ce5c0cec34869000f8220175ac83d11dbe845401",
    ),
    "sunspots.csv": (
        "https://vincentarelbundock.github.io/Rdatasets/csv/datasets/sunspots.csv",
        "8db04db1d4406f8a005c00fc3a4647de1845fd3e7e7bbde4ad176a19037c9e60",
    ),
    "claims.csv": (
        "https://fred.stlouisfed.org/graph/fredgraph.csv?id=ICSA&cosd=2010-01-02&coed=2025-12-27",
        "9eaba9b572e1361490d848900c2a4e6ffc3549af1b5c819355ebfb787632e22e",
    ),
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--download", action="store_true", help="Allow pinned public source downloads"
    )
    args = parser.parse_args()
    TARGET.mkdir(parents=True, exist_ok=True)
    cache = ROOT / ".data/phase03a-sources"
    cache.mkdir(parents=True, exist_ok=True)
    for name, (url, digest) in SOURCES.items():
        source = cache / name
        if not source.exists():
            if not args.download:
                raise SystemExit("Missing public source cache. Use --download to permit retrieval.")
            source.write_bytes(urllib.request.urlopen(url, timeout=60).read())
        if hashlib.sha256(source.read_bytes()).hexdigest() != digest:
            raise SystemExit(f"Source revision changed: {name}. Review rather than silently repin.")
    manifest = []

    def save(name, points, frequency, units, source, horizons):
        text = io.StringIO(newline="")
        writer = csv.writer(text, lineterminator="\n")
        writer.writerow(["date", "value"])
        writer.writerows((p["date"], p["value"]) for p in points)
        data = text.getvalue().encode()
        (TARGET / f"{name}.csv").write_bytes(data)
        manifest.append(
            {
                "name": name,
                "frequency": frequency,
                "units": units,
                "count": len(points),
                "sha256": hashlib.sha256(data).hexdigest(),
                "source": source,
                "horizons": horizons,
            }
        )

    with zipfile.ZipFile(cache / "bike.zip") as z:
        rows = csv.DictReader(io.StringIO(z.read("day.csv").decode()))
        bike = [{"date": r["dteday"], "value": int(r["cnt"])} for r in rows]
    save(
        "bike_daily",
        bike,
        "daily",
        "daily rental count",
        "UCI Bike Sharing; Fanaee-T (2013), DOI 10.24432/C5W894; CC BY 4.0. dteday/cnt only; no imputation.",
        [1, 7, 14, 28],
    )
    rows = list(csv.DictReader((cache / "sunspots.csv").open(encoding="utf-8")))
    sun = []
    for i, row in enumerate(rows):
        year, month = divmod(1749 * 12 + i, 12)
        if abs(float(row["time"]) - (1749 + i / 12)) > 1e-6:
            raise ValueError("Unexpected sunspot time index")
        sun.append({"date": date(year, month + 1, 1).isoformat(), "value": float(row["value"])})
    save(
        "sunspots_monthly",
        sun,
        "monthly",
        "monthly mean relative sunspot number",
        "R datasets sunspots (1749–1983), Andrews/Herzberg; Swiss Federal/Tokyo observatory. Rdatasets mirror; numerical observations unchanged.",
        [1, 6, 12],
    )
    rows = csv.DictReader((cache / "claims.csv").open(encoding="utf-8"))
    claims = [{"date": r["observation_date"], "value": float(r["ICSA"])} for r in rows]
    save(
        "initial_claims_weekly",
        claims,
        "weekly",
        "initial claims, seasonally adjusted count",
        "U.S. Employment and Training Administration, ICSA via FRED; public domain, citation requested. 2010-01-02 through 2025-12-27; revision snapshot retrieved 2026-10-25, not an as-of vintage.",
        [1, 4, 12],
    )
    rows = csv.DictReader((ROOT / "docs/phase-02b/fixtures/air-passengers.csv").open())
    air = [{"date": r["date"], "value": float(r["value"])} for r in rows]
    save(
        "air_passengers",
        air,
        "monthly",
        "thousands of international airline passengers",
        "Same public R AirPassengers series as Phase 02B; Box/Jenkins attribution and source notices retained there.",
        [1, 6, 12],
    )
    for name in [
        "synthetic_demand",
        "synthetic_intermittent",
        "synthetic_regime_shift",
        "synthetic_revenue",
    ]:
        rng = random.Random(20261025)
        monthly = name == "synthetic_revenue"
        count = 1000 if monthly else 2000
        points = []
        for i in range(count):
            day = (
                date(1900 + i // 12, i % 12 + 1, 1)
                if monthly
                else date(2016, 1, 1) + timedelta(days=i)
            )
            level = 100 + 0.02 * i + 20 * math.sin(2 * math.pi * i / (12 if monthly else 7))
            if name == "synthetic_regime_shift" and i >= count - 300:
                level *= 2.4
            value = max(0, level + rng.gauss(0, 10))
            if name == "synthetic_intermittent" and rng.random() < 0.8:
                value = 0
            points.append({"date": day.isoformat(), "value": value})
        save(
            name,
            points,
            "monthly" if monthly else "daily",
            "synthetic units",
            "Explicit synthetic stress fixture, deterministic seed 20261025. See generator; no business validation.",
            [1, 6, 12] if monthly else [1, 7, 28],
        )
    (TARGET / "manifest.json").write_text(
        json.dumps({"sources": SOURCES, "series": manifest}, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps([{"name": s["name"], "count": s["count"]} for s in manifest]))


if __name__ == "__main__":
    main()
