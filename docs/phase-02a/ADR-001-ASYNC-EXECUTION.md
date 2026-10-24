# ADR 001 — durable local PostgreSQL jobs

Status: implemented foundation; owner acceptance pending. This replaces the unverified Approved status in the preserved Claude draft. No Phase 02B, Timestral, paid service, deployment or merge is included.

## Database and tenant boundary

PGlite remains available for single-process previews/tests. `DATABASE_URL` selects node-postgres and a standalone database shared with Python. No process shares a PGlite data directory. Every transaction uses one checked-out client; initialization is transactional and serialized with an advisory lock.

Authenticated business operations use `asUser`, transaction-local identity and `SET LOCAL ROLE forewise_app`. Policies explicitly check workspace and authenticated user. Composite dataset/job and result/job foreign keys enforce tenant identity. The app role cannot update queue execution state. The trusted worker role can process jobs and insert results but cannot read account/session tables or alter memberships. Local bootstrap credentials select this restricted worker role; separately provisioned login credentials remain a production boundary.

## Ownership, fencing and recovery

1. Claim pending-ready or expired processing work with `FOR UPDATE SKIP LOCKED`. Increment attempts and monotonically increasing `fence`; assign a unique worker ID and bounded lease. Commit before computing.
2. A separate connection renews the lease. Renewal requires the job ID, worker ID, fence, processing state and an unexpired lease.
3. Completion first conditionally updates and locks the live owned row. Only the winner inserts a forecast and links it to the completed job, within the same transaction. Persistence errors roll back both changes. Expired/stale ownership returns false before inserting.
4. Failure updates use the same ownership predicate. Transient failures retry with a bounded delay, at most three total claims. Invalid input/contract failures are terminal. An abandoned third attempt is swept to failed without a fourth claim. Draft null-lease jobs use heartbeat/creation time for expiry.
5. Lease checks use database `clock_timestamp()`. At-least-once computation is possible after crashes; result publication is fenced and atomic.

## Migration and local operation

Both dirty checkouts were archived before edits. Additive migration columns/constraints preserve existing draft jobs; invalid dataset references stop migration instead of being silently removed. Stop legacy unfenced workers before upgrading: a privileged old binary is not made safe merely by deploying new source beside it.

Compose specifies PostgreSQL 16, a named volume, loopback-only port 55432 and an explicitly provided password. Docker Desktop in this environment failed in its own Inference initialization. Actual verification uses an isolated PostgreSQL 17 cluster in WSL Debian on localhost:55432, without resetting Docker or removing its volumes. Compose startup remains unverified.

References: [PostgreSQL RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html), [node-postgres transactions](https://node-postgres.com/features/transactions), [StatsForecast models](https://nixtlaverse.nixtla.io/statsforecast/src/core/models.html).
