import { createDatabase } from '../packages/db/src/index.ts';

if (!process.env.DATABASE_URL)
  throw new Error('Set DATABASE_URL for your local PostgreSQL database.');
const db = await createDatabase(process.env.DATABASE_URL);
try {
  const result = await db.query('SELECT version FROM schema_versions ORDER BY version');
  console.log('Database migrations applied:', result.rows.map((row) => row.version).join(', '));
} finally {
  await db.close();
}
