import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase, asUser } from './index';
import { randomUUID } from 'node:crypto';
test('real PostgreSQL RLS blocks cross-tenant reads, writes, and forged dataset references', async () => {
  const db = await createDatabase();
  try {
    const a = randomUUID(),
      b = randomUUID(),
      wa = randomUUID(),
      wb = randomUUID(),
      da = randomUUID();
    for (const [id, email, wid] of [
      [a, 'a@example.test', wa],
      [b, 'b@example.test', wb],
    ]) {
      await db.query('INSERT INTO users VALUES($1,$2,$3,$4,now())', [
        id,
        email,
        'test-hash',
        'Tester',
      ]);
      await db.query('INSERT INTO workspaces(id,name) VALUES($1,$2)', [wid, email]);
      await db.query("INSERT INTO memberships VALUES($1,$2,'owner')", [wid, id]);
    }
    await asUser(db, a, async (tx) => {
      await tx.query('INSERT INTO datasets VALUES($1,$2,$3,$4,$5,now())', [da, wa, 'A', '[]', 8]);
    });
    const visible = await asUser(
      db,
      b,
      async (tx) => (await tx.query('SELECT * FROM datasets')).rows,
    );
    assert.equal(visible.length, 0);
    assert.equal(
      (await asUser(db, b, async (tx) => (await tx.query('SELECT * FROM workspaces')).rows)).length,
      1,
    );
    await assert.rejects(
      asUser(db, b, async (tx) => {
        await tx.query('INSERT INTO datasets VALUES($1,$2,$3,$4,$5,now())', [
          randomUUID(),
          wa,
          'forged',
          '[]',
          8,
        ]);
      }),
      /row-level security/,
    );
    await assert.rejects(
      asUser(db, b, async (tx) => {
        await tx.query('INSERT INTO forecasts VALUES($1,$2,$3,1,$4,now())', [
          randomUUID(),
          wb,
          da,
          '{}',
        ]);
      }),
      /foreign key/,
    );
    await assert.rejects(
      asUser(db, b, async (tx) => {
        await tx.query('SELECT * FROM users');
      }),
      /permission denied/,
    );
    const deleted = await asUser(
      db,
      b,
      async (tx) => await tx.query('DELETE FROM datasets WHERE id=$1 RETURNING id', [da]),
    );
    assert.equal(deleted.rows.length, 0);
    // No tenant context is retained between transactions.
    assert.equal(
      (await asUser(db, a, async (tx) => (await tx.query('SELECT * FROM datasets')).rows)).length,
      1,
    );
  } finally {
    await db.close();
  }
});
