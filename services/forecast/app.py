"""Phase 01 internal mock service. No trained models or external AI calls."""

import hmac
import os
from datetime import date, timedelta
from typing import Annotated

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field, model_validator

app = FastAPI(title="Forewise internal forecast service", version="0.1.0")


class Point(BaseModel):
    date: date
    value: float = Field(ge=-1e12, le=1e12, allow_inf_nan=False)


class ForecastRequest(BaseModel):
    points: list[Point] = Field(min_length=8, max_length=5000)
    horizon: int = Field(ge=1, le=90, strict=True)

    @model_validator(mode="after")
    def consecutive_daily(self):
        if (date.max - self.points[-1].date).days < self.horizon:
            raise ValueError("Forecast horizon exceeds the supported calendar")
        for previous, current in zip(self.points, self.points[1:]):
            if current.date - previous.date != timedelta(days=1):
                raise ValueError("Observations must be consecutive daily dates")
        return self


@app.get("/health")
def health():
    return {"status": "ok", "mode": "mock", "version": "0.1.0"}


@app.post("/forecast")
def forecast(payload: ForecastRequest, authorization: Annotated[str | None, Header()] = None):
    secret = os.getenv("FORECAST_SERVICE_TOKEN", "")
    if len(secret) < 32:
        raise HTTPException(503, "Internal service token is not configured")
    if not hmac.compare_digest((authorization or "").encode(), f"Bearer {secret}".encode()):
        raise HTTPException(401, "Unauthorized")
    week = payload.points[-7:]
    last_date = payload.points[-1].date
    points = [
        {"date": (last_date + timedelta(days=i + 1)).isoformat(), "value": week[i % 7].value}
        for i in range(payload.horizon)
    ]
    return {
        "mock": True,
        "model": "weekly-repeat-mock-v1",
        "points": points,
        "notice": "Mock forecast: repeats the last observed week. Not a validated prediction; do not use for business decisions.",
    }
