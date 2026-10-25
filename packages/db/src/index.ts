import { PGlite } from '@electric-sql/pglite';

export interface Connection {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
}
export interface Database extends Connection {
  transaction<T>(fn: (tx: Connection) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

// Versioned Phase 01 migration. Embedded PostgreSQL uses the same RLS semantics.
export const schema = `
CREATE TABLE IF NOT EXISTS schema_versions (version integer PRIMARY KEY);
CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY, email text UNIQUE NOT NULL, password_hash text NOT NULL,
 name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS login_attempts (
 key text PRIMARY KEY, attempts integer NOT NULL DEFAULT 1, started_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS workspaces (
 id uuid PRIMARY KEY, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS memberships (
 workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id uuid REFERENCES users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK (role IN ('owner', 'member')),
 PRIMARY KEY(workspace_id,user_id)
);
CREATE TABLE IF NOT EXISTS datasets (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 name text NOT NULL, points jsonb NOT NULL, row_count integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (id,workspace_id)
);
CREATE TABLE IF NOT EXISTS forecasts (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 dataset_id uuid NOT NULL, horizon integer NOT NULL CHECK(horizon BETWEEN 1 AND 90),
 result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(dataset_id,workspace_id) REFERENCES datasets(id,workspace_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS datasets_workspace ON datasets(workspace_id);
CREATE INDEX IF NOT EXISTS forecasts_workspace ON forecasts(workspace_id);
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'daily'
 CHECK(frequency IN ('daily','weekly','monthly'));

DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='forewise_app') THEN
  CREATE ROLE forewise_app NOLOGIN NOSUPERUSER NOBYPASSRLS;
 END IF;
END $$;
GRANT USAGE ON SCHEMA public TO forewise_app;
GRANT SELECT ON workspaces,memberships TO forewise_app;
GRANT SELECT,INSERT,DELETE ON datasets,forecasts TO forewise_app;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS member_self ON memberships;
CREATE POLICY member_self ON memberships FOR SELECT TO forewise_app
 USING(user_id = nullif(current_setting('app.user_id',true),'')::uuid);
DROP POLICY IF EXISTS workspace_member ON workspaces;
CREATE POLICY workspace_member ON workspaces TO forewise_app
 USING(EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=id AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid));
DROP POLICY IF EXISTS dataset_member ON datasets;
CREATE POLICY dataset_member ON datasets TO forewise_app
 USING(EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=datasets.workspace_id AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid))
 WITH CHECK(EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=datasets.workspace_id AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid));
DROP POLICY IF EXISTS forecast_member ON forecasts;
CREATE POLICY forecast_member ON forecasts TO forewise_app
 USING(EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=forecasts.workspace_id AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid))
 WITH CHECK(EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=forecasts.workspace_id AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid));
CREATE TABLE IF NOT EXISTS forecast_jobs (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 dataset_id uuid,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','completed','failed')),
 payload jsonb NOT NULL,
 result_id uuid,
 worker_id text,
 last_heartbeat timestamptz,
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 fence bigint NOT NULL DEFAULT 0,
 lease_expires_at timestamptz,
 available_at timestamptz NOT NULL DEFAULT now(),
 error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
-- Upgrade Claude's uncommitted draft without discarding existing jobs.
ALTER TABLE forecast_jobs ADD COLUMN IF NOT EXISTS dataset_id uuid;
ALTER TABLE forecast_jobs ADD COLUMN IF NOT EXISTS fence bigint NOT NULL DEFAULT 0;
ALTER TABLE forecast_jobs ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;
ALTER TABLE forecast_jobs ADD COLUMN IF NOT EXISTS available_at timestamptz NOT NULL DEFAULT now();
UPDATE forecast_jobs SET dataset_id=(payload->>'datasetId')::uuid WHERE dataset_id IS NULL;
ALTER TABLE forecast_jobs ALTER COLUMN dataset_id SET NOT NULL;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='job_dataset_tenant') THEN
  ALTER TABLE forecast_jobs ADD CONSTRAINT job_dataset_tenant
   FOREIGN KEY(dataset_id,workspace_id) REFERENCES datasets(id,workspace_id) ON DELETE CASCADE;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='job_result_tenant') THEN
  CREATE UNIQUE INDEX IF NOT EXISTS forecast_id_tenant ON forecasts(id,workspace_id);
  ALTER TABLE forecast_jobs ADD CONSTRAINT job_result_tenant
   FOREIGN KEY(result_id,workspace_id) REFERENCES forecasts(id,workspace_id);
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_jobs_status_heartbeat ON forecast_jobs(status,lease_expires_at);
CREATE INDEX IF NOT EXISTS idx_jobs_workspace ON forecast_jobs(workspace_id);
ALTER TABLE forecast_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS job_member ON forecast_jobs;
CREATE POLICY job_member ON forecast_jobs TO forewise_app
 USING(EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=forecast_jobs.workspace_id
 AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid))
 WITH CHECK(EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=forecast_jobs.workspace_id
 AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid));
REVOKE INSERT,UPDATE,DELETE ON forecast_jobs FROM forewise_app;
GRANT SELECT ON forecast_jobs TO forewise_app;
GRANT INSERT(id,workspace_id,dataset_id,status,payload) ON forecast_jobs TO forewise_app;
-- A member may requeue a failed job, never alter claims, payloads or attempt counts.
-- The worker remains the only owner of execution attempts and live leases.
CREATE OR REPLACE FUNCTION public.retry_forecast_job(job_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE tenant uuid; retried uuid;
BEGIN
 SELECT j.workspace_id INTO tenant FROM public.forecast_jobs j
 WHERE j.id=job_id AND EXISTS(SELECT 1 FROM public.memberships m WHERE m.workspace_id=j.workspace_id
  AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid);
 IF tenant IS NULL THEN RETURN NULL; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(tenant::text,0));
 UPDATE public.forecast_jobs j SET status='pending',available_at=now(),error=NULL,
  worker_id=NULL,last_heartbeat=NULL,lease_expires_at=NULL,fence=fence+1,updated_at=now()
 WHERE j.id=job_id AND j.status='failed' AND j.attempts<3
 AND (SELECT count(*) FROM public.forecast_jobs WHERE workspace_id=tenant AND status IN ('pending','processing'))<20
 RETURNING j.id INTO retried;
 RETURN retried;
END;
$$;
REVOKE ALL ON FUNCTION public.retry_forecast_job(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.retry_forecast_job(uuid) TO forewise_app;
-- A trusted local worker has no access to account/session tables.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='forewise_worker') THEN
  CREATE ROLE forewise_worker NOLOGIN NOSUPERUSER NOBYPASSRLS;
 END IF;
END $$;
GRANT USAGE ON SCHEMA public TO forewise_worker;
GRANT SELECT,UPDATE ON forecast_jobs TO forewise_worker;
GRANT SELECT,INSERT ON forecasts TO forewise_worker;
DROP POLICY IF EXISTS job_worker ON forecast_jobs;
CREATE POLICY job_worker ON forecast_jobs TO forewise_worker USING(true) WITH CHECK(true);
DROP POLICY IF EXISTS forecast_worker ON forecasts;
CREATE POLICY forecast_worker ON forecasts TO forewise_worker USING(true) WITH CHECK(true);
INSERT INTO schema_versions(version) VALUES(1),(2) ON CONFLICT DO NOTHING;
`;

export async function createDatabase(path?: string): Promise<Database> {
  if (path && /^postgres(?:ql)?:\/\//.test(path)) {
    const { createPostgresDatabase } = await import('./postgres');
    return createPostgresDatabase(path, schema);
  }
  const db = new PGlite(path);
  await db.exec(schema);
  return db;
}

// All business queries run under this restricted role inside one transaction.
// SET LOCAL prevents tenant context leaking to the next request.
export async function asUser<T>(
  db: Database,
  userId: string,
  fn: (tx: Connection) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("SELECT set_config('app.user_id',$1,true)", [userId]);
    await tx.exec('SET LOCAL ROLE forewise_app');
    return fn(tx);
  });
}
