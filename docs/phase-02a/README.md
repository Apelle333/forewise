# Phase 02A — local forecasting foundation

Read [contract v1](API-CONTRACT-V1.md) and [execution and tenant decisions](ADR-001-ASYNC-EXECUTION.md). This is an API/worker foundation, not an asynchronous dashboard redesign or a production release.

## Local setup

1. Run `npm ci`, create `.venv`, and install `services/forecast/requirements.lock.txt`.
2. Set a private `FOREWISE_DB_PASSWORD`, then run `docker compose up -d db` when Docker is healthy. PostgreSQL binds only to localhost:55432 and uses a named volume. Do not commit credentials or reuse this local configuration in production.
3. Set `DATABASE_URL` in `apps/web/.env.local` and in the worker environment. Keep the existing shared `FORECAST_SERVICE_TOKEN` for the separate Phase 01 mock service.
4. With `DATABASE_URL` set, run `node --import tsx scripts/database.mjs` to apply schema versions 1 and 2. Stop all legacy unfenced workers first. Invalid draft dataset references fail migration instead of being silently discarded.
5. Build with `npm run build`; start `python scripts/dev.py --production`. Run `.venv/Scripts/python.exe services/forecast/worker.py` separately with the same database URL. `--once` processes at most one available job.

## Verification

`npm run verify` runs static, unit, Python, build and dependency gates. Set `TEST_DATABASE_URL` to an isolated, migrated PostgreSQL test database to include actual PostgreSQL RLS and worker concurrency tests. Without it these cases explicitly skip; skips are not successful security verification.

For API persistence, start the optimized server with `DATABASE_URL` pointing to that same test database, then run `npx playwright test` with `TEST_DATABASE_URL` set. Tests create synthetic accounts and data; never point them at production/customer data.

Coverage includes tenant denial at SQL/API boundaries, missing identities and revoked sessions, competing claims, stale ownership, heartbeat fencing, atomic rollback, bounded retry/recovery, multi-frequency CSV and a standalone StatsForecast worker. Metric tests assert known nonzero errors and separate training cutoffs.

The preview is local at http://127.0.0.1:3000/. The older temporary hosted preview is unchanged. Docker engine startup failed in its Inference component; actual PostgreSQL verification used an isolated PostgreSQL 17 WSL cluster on localhost:55432. No Docker reset or volume deletion was performed. Compose startup itself remains unverified.

Separate provisioned database login roles, production migration orchestration, backups, quotas/abuse controls and an independent security review remain production boundaries. No Phase 02B, Timestral, paid service or production deployment is included.
