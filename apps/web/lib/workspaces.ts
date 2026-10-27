import type { Database } from '@forewise/db';

export async function createWorkspace(db: Database, userId: string, id: string, name: string) {
  return db.transaction(async (tx) => {
    // Serialize account-level quota checks across concurrent workspace requests.
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1::uuid::text,0))', [userId]);
    const count = await tx.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM memberships WHERE user_id=$1',
      [userId],
    );
    if (count.rows[0].count >= 10) return false;
    await tx.query('INSERT INTO workspaces(id,name) VALUES($1,$2)', [id, name]);
    await tx.query("INSERT INTO memberships VALUES($1,$2,'owner')", [id, userId]);
    return true;
  });
}
