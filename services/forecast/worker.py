"""Local PostgreSQL queue worker. Every write is fenced by a live execution lease."""

import argparse
import json
import logging
import os
import threading
import time
import uuid

import psycopg2
from evaluation import run_forecast
from psycopg2.extras import Json, RealDictCursor

LEASE_SECONDS = 300
MAX_ATTEMPTS = 3
log = logging.getLogger(__name__)


def get_connection():
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("Set DATABASE_URL for the local PostgreSQL database.")
    return psycopg2.connect(
        url, cursor_factory=RealDictCursor, options="-c role=forewise_worker", connect_timeout=5
    )


def lock_execution(cur, job):
    # Acquire first, then evaluate lease time in the following statement. A blocked
    # UPDATE must not rely on a clock predicate evaluated before waiting for a lock.
    cur.execute(
        "SELECT id FROM forecast_jobs WHERE id=%s AND worker_id=%s AND fence=%s AND status='processing' FOR UPDATE",
        (job["id"], job["worker_id"], job["fence"]),
    )
    return cur.fetchone() is not None


def claim_job(conn, worker_id, lease_seconds=LEASE_SECONDS):
    if not worker_id or lease_seconds < 1:
        raise ValueError("A worker ID and positive lease are required.")
    with conn, conn.cursor() as cur:
        cur.execute("""
            UPDATE forecast_jobs SET status='failed', error='Retry limit reached after abandoned execution.',
              worker_id=NULL, lease_expires_at=NULL, updated_at=clock_timestamp()
            WHERE attempts >= 3 AND (status='pending' OR (status='processing' AND
              COALESCE(lease_expires_at,last_heartbeat + interval '5 minutes',created_at + interval '5 minutes') <= clock_timestamp()))
        """)
        cur.execute(
            """
            WITH target AS (
              SELECT id FROM forecast_jobs WHERE attempts < 3 AND
                ((status='pending' AND available_at <= clock_timestamp()) OR
                 (status='processing' AND COALESCE(lease_expires_at,last_heartbeat + interval '5 minutes',created_at + interval '5 minutes') <= clock_timestamp()))
              ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1
            )
            UPDATE forecast_jobs j SET status='processing',worker_id=%s,
              attempts=j.attempts+1,fence=j.fence+1,last_heartbeat=clock_timestamp(),
              lease_expires_at=clock_timestamp() + %s * interval '1 second',error=NULL,updated_at=clock_timestamp()
            FROM target WHERE j.id=target.id RETURNING j.*
        """,
            (worker_id, lease_seconds),
        )
        return cur.fetchone()


def heartbeat(conn, job, lease_seconds=LEASE_SECONDS):
    with conn, conn.cursor() as cur:
        if not lock_execution(cur, job):
            return False
        cur.execute(
            """UPDATE forecast_jobs SET last_heartbeat=clock_timestamp(),
          lease_expires_at=clock_timestamp() + %s * interval '1 second',updated_at=clock_timestamp()
          WHERE id=%s AND worker_id=%s AND fence=%s AND status='processing'
          AND lease_expires_at > clock_timestamp() RETURNING id""",
            (lease_seconds, job["id"], job["worker_id"], job["fence"]),
        )
        return cur.fetchone() is not None


def complete_job(conn, job, result):
    # Fence check and row lock precede persistence, in the same transaction.
    with conn, conn.cursor() as cur:
        if not lock_execution(cur, job):
            return False
        cur.execute(
            """UPDATE forecast_jobs SET status='completed',worker_id=NULL,
          lease_expires_at=NULL,updated_at=clock_timestamp()
          WHERE id=%s AND worker_id=%s AND fence=%s AND status='processing'
          AND lease_expires_at > clock_timestamp() RETURNING workspace_id,dataset_id,payload""",
            (job["id"], job["worker_id"], job["fence"]),
        )
        owned = cur.fetchone()
        if not owned:
            return False
        payload = owned["payload"]
        result_id = str(uuid.uuid4())
        cur.execute(
            "INSERT INTO forecasts(id,workspace_id,dataset_id,horizon,result) VALUES(%s,%s,%s,%s,%s)",
            (
                result_id,
                owned["workspace_id"],
                owned["dataset_id"],
                payload["horizon"],
                Json(result),
            ),
        )
        cur.execute("UPDATE forecast_jobs SET result_id=%s WHERE id=%s", (result_id, job["id"]))
        return True


def fail_job(conn, job, retryable=True):
    with conn, conn.cursor() as cur:
        if not lock_execution(cur, job):
            return False
        cur.execute(
            """UPDATE forecast_jobs SET
          status=CASE WHEN attempts < 3 AND %s THEN 'pending' ELSE 'failed' END,
          error=%s,worker_id=NULL,lease_expires_at=NULL,
          available_at=clock_timestamp() + %s * interval '1 second',updated_at=clock_timestamp()
          WHERE id=%s AND worker_id=%s AND fence=%s AND status='processing'
          AND lease_expires_at > clock_timestamp() RETURNING id""",
            (
                retryable,
                "Forecast execution failed."
                if retryable
                else "Dataset or contract validation failed.",
                min(60, 2 ** job["attempts"]),
                job["id"],
                job["worker_id"],
                job["fence"],
            ),
        )
        return cur.fetchone() is not None


def process_job(conn, job, lease_seconds=LEASE_SECONDS):
    stop = threading.Event()

    def keep_alive():
        heart = None
        try:
            heart = get_connection()
            while not stop.wait(max(0.25, lease_seconds / 3)):
                if not heartbeat(heart, job, lease_seconds):
                    return
        except psycopg2.Error:
            log.warning("Heartbeat unavailable; completion still requires a live lease.")
        finally:
            if heart:
                heart.close()

    thread = threading.Thread(target=keep_alive, daemon=True)
    thread.start()
    try:
        payload = job["payload"]
        if isinstance(payload, str):
            payload = json.loads(payload)
        result = run_forecast(payload)
        return complete_job(conn, job, result)
    except (ValueError, TypeError, KeyError, OverflowError):
        fail_job(conn, job, retryable=False)
        return False
    except Exception:
        log.warning("Forecast execution failed; applying bounded retry policy.")
        fail_job(conn, job, retryable=True)
        return False
    finally:
        stop.set()
        thread.join(timeout=6)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    worker_id = "worker-" + uuid.uuid4().hex
    while True:
        conn = None
        try:
            conn = get_connection()
            while True:
                job = claim_job(conn, worker_id)
                if job:
                    process_job(conn, job)
                elif not args.once:
                    time.sleep(1)
                if args.once:
                    return
        except psycopg2.Error:
            if args.once:
                raise
            log.warning("Database unavailable; reconnecting.")
            time.sleep(3)
        finally:
            if conn:
                conn.close()


if __name__ == "__main__":
    main()
