import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDatabase, type Database } from '@forewise/db';
import { createWorkspace } from '../lib/workspaces';

for (const adapter of ['embedded', 'postgres'] as const) {
  test(
    `concurrent workspace creation preserves the account quota / ${adapter}`,
    { skip: adapter === 'postgres' && !process.env.TEST_DATABASE_URL },
    async () => {
      const db = await createDatabase(
        adapter === 'postgres' ? process.env.TEST_DATABASE_URL : undefined,
      );
      const userId = randomUUID(),
        workspaceIds = Array.from({ length: 13 }, () => randomUUID());
      try {
        await db.query('INSERT INTO users(id,email,password_hash,name) VALUES($1,$2,$3,$4)', [
          userId,
          `${userId}@example.test`,
          'test-hash',
          'Quota QA',
        ]);
        for (const id of workspaceIds.slice(0, 9))
          assert.equal(await createWorkspace(db, userId, id, 'Quota QA'), true);
        const contended: Database =
          adapter === 'postgres'
            ? {
                ...db,
                transaction: (fn) =>
                  db.transaction((tx) =>
                    fn({
                      ...tx,
                      async query<T>(sql: string, params?: unknown[]) {
                        const result = await tx.query<T>(sql, params);
                        // Keep the quota read open so independent connections contend.
                        if (
                          sql === 'SELECT count(*)::int AS count FROM memberships WHERE user_id=$1'
                        )
                          await tx.query('SELECT pg_sleep(0.1)');
                        return result;
                      },
                    }),
                  ),
              }
            : db;
        const results = await Promise.all(
          workspaceIds.slice(9).map((id) => createWorkspace(contended, userId, id, 'Quota QA')),
        );
        assert.equal(results.filter(Boolean).length, 1);
        const count = await db.query<{ count: number }>(
          'SELECT count(*)::int AS count FROM memberships WHERE user_id=$1',
          [userId],
        );
        assert.equal(count.rows[0].count, 10);
        assert.equal(await createWorkspace(db, userId, randomUUID(), 'Over quota'), false);
      } finally {
        await db.query('DELETE FROM workspaces WHERE id = ANY($1::uuid[])', [workspaceIds]);
        await db.query('DELETE FROM users WHERE id=$1', [userId]);
        await db.close();
      }
    },
  );
}
