"""Requires an isolated migrated PostgreSQL test database; never mocks SQL ownership."""

import os
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

import psycopg2
import pytest
from evaluation import run_forecast
from psycopg2.extras import Json, RealDictCursor
from worker import claim_job, complete_job, fail_job, get_connection, heartbeat

pytestmark = pytest.mark.skipif(
    not os.getenv("TEST_DATABASE_URL"), reason="PostgreSQL integration URL not set"
)


@pytest.fixture
def seeded(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    owner = psycopg2.connect(os.environ["TEST_DATABASE_URL"], cursor_factory=RealDictCursor)
    uid, wid, did, jid = [str(uuid.uuid4()) for _ in range(4)]
    payload = {
        "contract_version": "1",
        "datasetId": did,
        "frequency": "daily",
        "horizon": 3,
        "points": [
            {"date": (date(2026, 1, 1) + timedelta(days=i)).isoformat(), "value": 100 + i}
            for i in range(40)
        ],
    }
    with owner, owner.cursor() as cur:
        cur.execute(
            "INSERT INTO users(id,email,password_hash,name) VALUES(%s,%s,%s,%s)",
            (uid, uid + "@example.test", "test", "Worker QA"),
        )
        cur.execute("INSERT INTO workspaces(id,name) VALUES(%s,%s)", (wid, "Worker QA"))
        cur.execute("INSERT INTO memberships VALUES(%s,%s,'owner')", (wid, uid))
        cur.execute(
            "INSERT INTO datasets(id,workspace_id,name,points,row_count) VALUES(%s,%s,%s,%s,40)",
            (did, wid, "Worker QA", Json(payload["points"])),
        )
        cur.execute(
            "INSERT INTO forecast_jobs(id,workspace_id,dataset_id,status,payload) VALUES(%s,%s,%s,'pending',%s)",
            (jid, wid, did, Json(payload)),
        )
    yield owner, wid, jid, payload
    with owner, owner.cursor() as cur:
        cur.execute("DELETE FROM forecast_jobs WHERE workspace_id=%s", (wid,))
        cur.execute("DELETE FROM workspaces WHERE id=%s", (wid,))
        cur.execute("DELETE FROM users WHERE id=%s", (uid,))
    owner.close()


def expire(owner, jid):
    with owner, owner.cursor() as cur:
        cur.execute(
            "UPDATE forecast_jobs SET lease_expires_at=clock_timestamp()-interval '1 second',available_at=clock_timestamp()-interval '1 second' WHERE id=%s",
            (jid,),
        )


def test_two_connections_cannot_claim_the_same_job(seeded):
    def claim(i):
        conn = get_connection()
        try:
            return claim_job(conn, f"parallel-{i}")
        finally:
            conn.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        jobs = list(executor.map(claim, range(2)))
    assert sum(job is not None for job in jobs) == 1
    assert next(job for job in jobs if job)["attempts"] == 1


def test_completion_waiting_for_a_lock_rechecks_expiry_after_acquisition(seeded):
    owner, wid, jid, payload = seeded
    conn = get_connection()
    try:
        job = claim_job(conn, "blocked-completion", lease_seconds=1)
        with owner, owner.cursor() as cur, ThreadPoolExecutor(max_workers=1) as executor:
            cur.execute("SELECT id FROM forecast_jobs WHERE id=%s FOR UPDATE", (jid,))
            pending = executor.submit(complete_job, conn, job, {"late": True})
            time.sleep(1.2)
            owner.commit()
            assert pending.result(timeout=3) is False
    finally:
        conn.close()


def test_expired_worker_is_fenced_from_heartbeat_failure_and_result(seeded):
    owner, wid, jid, payload = seeded
    a, b = get_connection(), get_connection()
    try:
        first = claim_job(a, "first")
        expire(owner, jid)
        assert not heartbeat(a, first)
        assert not complete_job(a, first, {"stale": True})
        second = claim_job(b, "second")
        assert second["fence"] > first["fence"] and second["attempts"] == 2
        assert not fail_job(a, first)
        assert not complete_job(a, first, {"stale": True})
        assert heartbeat(b, second)
        result = run_forecast(payload)
        assert complete_job(b, second, result)
        assert not complete_job(b, second, result)
        with owner, owner.cursor() as cur:
            cur.execute("SELECT result FROM forecasts WHERE workspace_id=%s", (wid,))
            rows = cur.fetchall()
            assert len(rows) == 1 and rows[0]["result"]["model"] == "seasonal-naive-v1"
    finally:
        a.close()
        b.close()


def test_result_and_job_completion_rollback_together(seeded):
    owner, wid, jid, payload = seeded
    conn = get_connection()
    try:
        job = claim_job(conn, "atomic")
        with owner, owner.cursor() as cur:
            cur.execute(
                "UPDATE forecast_jobs SET payload=jsonb_set(payload,'{horizon}','0') WHERE id=%s",
                (jid,),
            )
        with pytest.raises(psycopg2.errors.CheckViolation):
            complete_job(conn, job, {"invalid": True})
        with owner, owner.cursor() as cur:
            cur.execute("SELECT status,result_id FROM forecast_jobs WHERE id=%s", (jid,))
            row = cur.fetchone()
            assert row["status"] == "processing" and row["result_id"] is None
            cur.execute("SELECT count(*) AS n FROM forecasts WHERE workspace_id=%s", (wid,))
            assert cur.fetchone()["n"] == 0
    finally:
        conn.close()


def test_retry_and_abandoned_execution_are_bounded_at_three(seeded):
    owner, wid, jid, payload = seeded
    conn = get_connection()
    try:
        for attempt in range(1, 4):
            job = claim_job(conn, "retry")
            assert job["attempts"] == attempt
            assert fail_job(conn, job)
            expire(owner, jid)
        assert claim_job(conn, "fourth") is None
        with owner, owner.cursor() as cur:
            cur.execute("SELECT status,attempts FROM forecast_jobs WHERE id=%s", (jid,))
            row = cur.fetchone()
            assert row["status"] == "failed" and row["attempts"] == 3
    finally:
        conn.close()


def test_third_abandoned_attempt_is_terminal_and_worker_cannot_read_sessions(seeded):
    owner, wid, jid, payload = seeded
    conn = get_connection()
    try:
        for attempt in range(1, 4):
            job = claim_job(conn, "abandoned")
            assert job["attempts"] == attempt
            expire(owner, jid)
        assert claim_job(conn, "never-four") is None
        with owner, owner.cursor() as cur:
            cur.execute("SELECT status FROM forecast_jobs WHERE id=%s", (jid,))
            assert cur.fetchone()["status"] == "failed"
        with pytest.raises(psycopg2.errors.InsufficientPrivilege), conn, conn.cursor() as cur:
            cur.execute("SELECT * FROM sessions")
    finally:
        conn.close()
