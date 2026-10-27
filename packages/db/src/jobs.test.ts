import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { asUser, createDatabase } from './index';

for (const adapter of ['embedded', 'postgres'] as const) {
  test(
    `job and result RLS denies foreign tenants and missing identities / ${adapter}`,
    {
      skip: adapter === 'postgres' && !process.env.TEST_DATABASE_URL,
    },
    async () => {
      const db = await createDatabase(
        adapter === 'postgres' ? process.env.TEST_DATABASE_URL : undefined,
      );
      const a = randomUUID(),
        b = randomUUID(),
        wa = randomUUID(),
        wb = randomUUID(),
        da = randomUUID(),
        job = randomUUID(),
        forecast = randomUUID();
      try {
        for (const [uid, wid] of [
          [a, wa],
          [b, wb],
        ]) {
          await db.query('INSERT INTO users(id,email,password_hash,name) VALUES($1,$2,$3,$4)', [
            uid,
            `${uid}@example.test`,
            'test-hash',
            'Security QA',
          ]);
          await db.query('INSERT INTO workspaces(id,name) VALUES($1,$2)', [wid, 'Security QA']);
          await db.query("INSERT INTO memberships VALUES($1,$2,'owner')", [wid, uid]);
        }
        await asUser(db, a, async (tx) => {
          await tx.query(
            'INSERT INTO datasets(id,workspace_id,name,points,row_count) VALUES($1,$2,$3,$4,8)',
            [da, wa, 'Security QA', '[]'],
          );
          await tx.query(
            'INSERT INTO forecasts(id,workspace_id,dataset_id,horizon,result) VALUES($1,$2,$3,7,$4)',
            [forecast, wa, da, '{}'],
          );
          await tx.query(
            "INSERT INTO forecast_jobs(id,workspace_id,dataset_id,status,payload) VALUES($1,$2,$3,'pending',$4)",
            [job, wa, da, '{}'],
          );
        });
        for (const uid of [b, randomUUID()]) {
          for (const table of ['datasets', 'forecasts', 'forecast_jobs']) {
            const rows = await asUser(
              db,
              uid,
              async (tx) =>
                (await tx.query(`SELECT * FROM ${table} WHERE workspace_id=$1`, [wa])).rows,
            );
            assert.equal(rows.length, 0, `${table} leaked a foreign row`);
          }
          await assert.rejects(
            asUser(db, uid, (tx) =>
              tx.query(
                "INSERT INTO forecast_jobs(id,workspace_id,dataset_id,status,payload) VALUES($1,$2,$3,'pending',$4)",
                [randomUUID(), wa, da, '{}'],
              ),
            ),
            /row-level security/,
          );
        }
        await assert.rejects(
          asUser(db, b, (tx) =>
            tx.query(
              "INSERT INTO forecast_jobs(id,workspace_id,dataset_id,status,payload) VALUES($1,$2,$3,'pending',$4)",
              [randomUUID(), wb, da, '{}'],
            ),
          ),
          /foreign key/,
        );
        await assert.rejects(
          asUser(db, a, (tx) =>
            tx.query("UPDATE forecast_jobs SET status='completed' WHERE id=$1", [job]),
          ),
          /permission denied/,
        );
        const own = await asUser(db, a, (tx) =>
          tx.query('SELECT id FROM forecast_jobs WHERE id=$1', [job]),
        );
        assert.equal(own.rows.length, 1);
        await db.transaction(async (tx) => {
          await tx.exec('SET LOCAL ROLE forewise_app');
          assert.equal(
            (await tx.query('SELECT * FROM forecast_jobs')).rows.length,
            0,
            'tenant context escaped its transaction',
          );
        });
        // Only the trusted worker counts attempts; member retry cannot bypass its cap.
        const retry = async (uid: string) =>
          (
            await asUser(db, uid, (tx) =>
              tx.query<{ id: string | null }>('SELECT retry_forecast_job($1) AS id', [job]),
            )
          ).rows[0].id;
        await db.query(
          "UPDATE forecast_jobs SET status='failed',attempts=1,fence=7,worker_id='stale',lease_expires_at=now()-interval '1 minute' WHERE id=$1",
          [job],
        );
        assert.equal(await retry(b), null, 'foreign tenant retried a job');
        assert.equal(await retry(randomUUID()), null, 'missing membership retried a job');
        assert.equal(await retry(a), job);
        assert.equal(await retry(a), null, 'pending job was retried again');
        const requeued = (
          await db.query<{
            attempts: number;
            status: string;
            fence: number;
            worker_id: string | null;
            lease_expires_at: unknown;
          }>('SELECT * FROM forecast_jobs WHERE id=$1', [job])
        ).rows[0];
        assert.equal(requeued.status, 'pending');
        assert.equal(requeued.attempts, 1);
        assert.equal(Number(requeued.fence), 8);
        assert.equal(requeued.worker_id, null);
        assert.equal(requeued.lease_expires_at, null);
        await db.query("UPDATE forecast_jobs SET status='failed',attempts=3 WHERE id=$1", [job]);
        assert.equal(await retry(a), null, 'retry cap bypassed');
      } finally {
        await db.query('DELETE FROM users WHERE id IN ($1,$2)', [a, b]);
        await db.query('DELETE FROM workspaces WHERE id IN ($1,$2)', [wa, wb]);
        await db.close();
      }
    },
  );
}
