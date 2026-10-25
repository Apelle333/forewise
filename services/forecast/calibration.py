"""Research-only central-interval calibration; never relabel endpoints as quantiles.

Uses past-only, horizon-specific nonnegative normalized CQR scores. Time-series
exchangeability is not assumed: report empirical results, not coverage guarantees.
"""

import math
from dataclasses import dataclass

import numpy as np
from timestral_engine import validate_quantiles


def _integer(value, minimum, maximum):
    return isinstance(value, int) and not isinstance(value, bool) and minimum <= value <= maximum


def temporal_plan(count, horizon, calibration_windows=30, test_windows=30, min_history=64):
    """Contiguous, disjoint target blocks; calibration ends before test starts."""
    if not (
        _integer(count, 8, 5000)
        and _integer(horizon, 1, 90)
        and _integer(calibration_windows, 20, 100)
        and _integer(test_windows, 20, 100)
        and _integer(min_history, 8, 5000)
    ):
        raise ValueError("Invalid quality protocol dimensions or insufficient requested windows.")
    required = min_history + (calibration_windows + test_windows) * horizon
    if count < required:
        return {
            "status": "insufficient_history",
            "required_points": required,
            "available_points": count,
        }
    start = count - (calibration_windows + test_windows) * horizon
    return {
        "status": "ready",
        "calibration_cutoffs": [start + i * horizon for i in range(calibration_windows)],
        "test_cutoffs": [start + (calibration_windows + i) * horizon for i in range(test_windows)],
        "calibration_target_end_exclusive": count - test_windows * horizon,
        "test_target_start": count - test_windows * horizon,
        "required_points": required,
        "available_points": count,
    }


def interval_scale(quantiles):
    # Forecast-only scale, independent of target values; finite even for zero-width intervals.
    lo, mid, hi = (np.asarray(quantiles[k], dtype=float) for k in ("p10", "p50", "p90"))
    return np.maximum(hi - lo, np.maximum(np.abs(mid), 1.0) * 1e-6)


@dataclass(frozen=True)
class IntervalCalibration:
    factors: tuple[float, ...]
    origin_count: int
    level: float

    def __post_init__(self):
        if (
            not isinstance(self.factors, tuple)
            or not _integer(len(self.factors), 1, 90)
            or not _integer(self.origin_count, 20, 100)
            or not 0 < self.level < 1
            or any(not math.isfinite(x) or x < 0 for x in self.factors)
        ):
            raise ValueError("Invalid frozen interval calibration.")

    def apply(self, native):
        horizon = len(self.factors)
        checked = validate_quantiles(native, horizon)
        scale = interval_scale(checked)
        delta = np.asarray(self.factors) * scale
        result = {
            "lower": (np.asarray(checked["p10"]) - delta).tolist(),
            "median": list(checked["p50"]),
            "upper": (np.asarray(checked["p90"]) + delta).tolist(),
        }
        if not all(np.isfinite(values).all() for values in result.values()):
            raise RuntimeError("Adjusted interval overflowed; no finite result is available.")
        return result


def fit_intervals(calibration_blocks, level=0.8):
    if not 0 < level < 1 or len(calibration_blocks) < 20:
        raise ValueError("At least 20 calibration origins and a valid target level are required.")
    horizon = len(calibration_blocks[0]["actual"])
    if not _integer(horizon, 1, 90):
        raise ValueError("Invalid horizon.")
    scores = []
    for block in calibration_blocks:
        native = validate_quantiles(block["native"], horizon)
        actual = np.asarray(block["actual"], dtype=float)
        if actual.shape != (horizon,) or not np.isfinite(actual).all():
            raise ValueError("Invalid calibration targets.")
        scores.append(
            np.maximum.reduce(
                [
                    np.asarray(native["p10"]) - actual,
                    actual - np.asarray(native["p90"]),
                    np.zeros(horizon),
                ]
            )
            / interval_scale(native)
        )
    # Finite-sample order statistic, no interpolated quantile and no test observations.
    rank = math.ceil((len(scores) + 1) * level)
    if rank > len(scores):
        raise ValueError("Insufficient calibration origins for this target coverage.")
    factors = np.sort(np.asarray(scores), axis=0)[rank - 1]
    return IntervalCalibration(tuple(float(x) for x in factors), len(scores), level)


def interval_metrics(actual, lower, upper, level=0.8):
    y, lo, hi = (np.asarray(x, dtype=float) for x in (actual, lower, upper))
    if (
        y.ndim != 2
        or not y.size
        or lo.shape != y.shape
        or hi.shape != y.shape
        or not all(np.isfinite(x).all() for x in (y, lo, hi))
        or np.any(lo > hi)
        or not 0 < level < 1
    ):
        raise ValueError("Expected finite aligned origin-by-horizon intervals.")
    alpha = 1 - level
    width = hi - lo
    score = width + 2 / alpha * (np.maximum(lo - y, 0) + np.maximum(y - hi, 0))
    covered = (lo <= y) & (y <= hi)
    # Circular moving-block bootstrap over origins, not independent forecast steps.
    rng = np.random.default_rng(20261025)
    block_length = min(4, len(y))
    starts = rng.integers(0, len(y), size=(1000, math.ceil(len(y) / block_length)))
    indices = ((starts[..., None] + np.arange(block_length)) % len(y)).reshape(1000, -1)[
        :, : len(y)
    ]
    resampled = covered[indices].mean(axis=(1, 2))
    return {
        "coverage": float(covered.mean()),
        "coverage_by_lead": covered.mean(axis=0).tolist(),
        "below_interval_rate": float((y < lo).mean()),
        "above_interval_rate": float((y > hi).mean()),
        "mean_width": float(width.mean()),
        "median_width": float(np.median(width)),
        "mean_interval_score": float(score.mean()),
        "median_interval_score": float(np.median(score)),
        "origin_count": len(y),
        "points_per_lead": len(y),
        "target_point_count": int(y.size),
        "coverage_bootstrap_percentile_range": np.quantile(resampled, [0.025, 0.975]).tolist(),
        "bootstrap_note": "Exploratory 95% percentile range, circular blocks of 4 origins; not a formal time-series coverage guarantee.",
    }
