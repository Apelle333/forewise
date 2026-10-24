import { Pool, type PoolClient } from 'pg';
import type { Connection, Database } from './index';

export async function createPostgresDatabase(url: string, schema: string): Promise<Database> {
  const pool = new Pool({ connectionString: url, max: 10, connectionTimeoutMillis: 5000 });
  pool.on('error', () => console.error('PostgreSQL idle connection failed'));
  const connection = (client: Pool | PoolClient): Connection => ({
    async query<T>(sql: string, params?: unknown[]) {
      const result = await client.query(sql, params);
      return { rows: result.rows as T[] };
    },
    exec: (sql) => client.query(sql),
  });
  const db: Database = {
    ...connection(pool),
    async transaction<T>(fn: (tx: Connection) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(connection(client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
  try {
    await db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(72609201)');
      await tx.exec(schema);
    });
    return db;
  } catch (error) {
    await pool.end();
    throw error;
  }
}
