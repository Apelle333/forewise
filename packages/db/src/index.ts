import { PGlite, type Transaction } from '@electric-sql/pglite';

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
 USING(EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=id));
DROP POLICY IF EXISTS dataset_member ON datasets;
CREATE POLICY dataset_member ON datasets TO forewise_app
 USING(EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=datasets.workspace_id))
 WITH CHECK(EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=datasets.workspace_id));
DROP POLICY IF EXISTS forecast_member ON forecasts;
CREATE POLICY forecast_member ON forecasts TO forewise_app
 USING(EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=forecasts.workspace_id))
 WITH CHECK(EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=forecasts.workspace_id));
INSERT INTO schema_versions(version) VALUES(1) ON CONFLICT DO NOTHING;
`;

export async function createDatabase(path?: string) {
  const db = new PGlite(path);
  await db.exec(schema);
  return db;
}

// All business queries run under this restricted role inside one transaction.
// SET LOCAL prevents tenant context leaking to the next request.
export async function asUser<T>(
  db: PGlite,
  userId: string,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("SELECT set_config('app.user_id',$1,true)", [userId]);
    await tx.exec('SET LOCAL ROLE forewise_app');
    return fn(tx);
  });
}
