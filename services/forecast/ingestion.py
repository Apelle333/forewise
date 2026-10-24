"""Strict, shared ingestion rules. No deduplication or interpolation is implicit."""

import calendar
import math
import re
from datetime import date, timedelta
from typing import Any

from pydantic import BaseModel, Field


class DataQualityWarning(BaseModel):
    code: str
    message: str
    severity: str


class DatasetValidationResult(BaseModel):
    is_valid: bool
    warnings: list[DataQualityWarning] = Field(default_factory=list)
    cleaned_points: list[dict[str, Any]] = Field(default_factory=list)
    detected_frequency: str = "daily"


def advance_date(previous: date, steps: int, frequency: str) -> date:
    if frequency == "daily":
        return previous + timedelta(days=steps)
    if frequency == "weekly":
        return previous + timedelta(days=7 * steps)
    year, month = divmod(previous.year * 12 + previous.month - 1 + steps, 12)
    month += 1
    day = 1 if previous.day == 1 else calendar.monthrange(year, month)[1]
    return date(year, month, day)


def validate_and_clean_data(
    points: list[dict[str, Any]], frequency: str = "daily"
) -> DatasetValidationResult:
    try:
        if frequency not in {"daily", "weekly", "monthly"}:
            raise ValueError("Choose daily, weekly or monthly frequency.")
        if not isinstance(points, list) or not 8 <= len(points) <= 5000:
            raise ValueError("Provide 8 to 5,000 observations.")
        cleaned = []
        dates = []
        for point in points:
            if not isinstance(point, dict) or set(point) != {"date", "value"}:
                raise ValueError("Every observation requires only date and value.")
            raw = point["date"]
            if not isinstance(raw, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
                raise ValueError("Use YYYY-MM-DD dates.")
            day = date.fromisoformat(raw)
            value = point["value"]
            if (
                isinstance(value, bool)
                or not isinstance(value, (float, int))
                or not math.isfinite(value)
                or abs(value) > 1e12
            ):
                raise ValueError("Values must be finite numbers within +/- 1e12.")
            if frequency == "monthly" and day.day not in {
                1,
                calendar.monthrange(day.year, day.month)[1],
            }:
                raise ValueError("Monthly dates must be month starts or month ends.")
            dates.append(day)
            cleaned.append({"date": raw, "value": float(value)})
        for previous, current in zip(dates, dates[1:]):
            if current != advance_date(previous, 1, frequency):
                raise ValueError(
                    "Dates must be sorted, unique and consecutive at the declared frequency."
                )
        return DatasetValidationResult(
            is_valid=True, cleaned_points=cleaned, detected_frequency=frequency
        )
    except (ValueError, TypeError, OverflowError) as error:
        return DatasetValidationResult(
            is_valid=False,
            detected_frequency=frequency,
            warnings=[
                DataQualityWarning(code="INVALID_DATA", message=str(error), severity="error")
            ],
        )
