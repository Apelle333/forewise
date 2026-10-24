import pytest
from app import app
from fastapi.testclient import TestClient

client = TestClient(app)
TOKEN = "phase01-test-token-never-for-production-123"


@pytest.fixture(autouse=True)
def configure(monkeypatch):
    monkeypatch.setenv("FORECAST_SERVICE_TOKEN", TOKEN)


def payload():
    return {
        "points": [{"date": f"2026-10-{i:02}", "value": i * 3} for i in range(1, 15)],
        "horizon": 10,
    }


def test_health_is_explicitly_mock():
    assert client.get("/health").json()["mode"] == "mock"


def test_rejects_no_token():
    assert client.post("/forecast", json=payload()).status_code == 401


def test_rejects_wrong_token():
    assert (
        client.post(
            "/forecast", json=payload(), headers={"Authorization": "Bearer wrong"}
        ).status_code
        == 401
    )


def test_mock_contract_and_weekly_repeat():
    response = client.post(
        "/forecast", json=payload(), headers={"Authorization": f"Bearer {TOKEN}"}
    )
    assert response.status_code == 200
    result = response.json()
    assert result["mock"] is True
    assert result["model"] == "weekly-repeat-mock-v1"
    assert len(result["points"]) == 10
    assert result["points"][0] == {"date": "2026-10-15", "value": 24}
    assert result["points"][7]["value"] == 24
    assert "Not a validated prediction" in result["notice"]


@pytest.mark.parametrize(
    "change",
    [
        {"horizon": 0},
        {"horizon": 91},
        {"horizon": 1.5},
        {"horizon": True},
        {"points": []},
        {"points": [{"date": "invalid", "value": 1}] * 8},
        {"points": [{"date": "2026-10-01", "value": 1}] * 8},
    ],
)
def test_invalid_payloads(change):
    data = payload() | change
    assert (
        client.post(
            "/forecast", json=data, headers={"Authorization": f"Bearer {TOKEN}"}
        ).status_code
        == 422
    )


def test_fails_closed_without_config(monkeypatch):
    monkeypatch.delenv("FORECAST_SERVICE_TOKEN")
    assert client.post("/forecast", json=payload()).status_code == 503


def test_rejects_calendar_overflow():
    data = {"points": [{"date": f"9999-12-{i}", "value": 1} for i in range(24, 32)], "horizon": 1}
    assert (
        client.post(
            "/forecast", json=data, headers={"Authorization": f"Bearer {TOKEN}"}
        ).status_code
        == 422
    )


def test_non_ascii_authorization_is_rejected():
    from app import ForecastRequest, forecast
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as error:
        forecast(ForecastRequest(**payload()), authorization="Bearer invalid-€")
    assert error.value.status_code == 401
