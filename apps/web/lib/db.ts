import { createDatabase } from '@forewise/db';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
const globalDb = globalThis as unknown as { forewiseDb?: ReturnType<typeof createDatabase> };
export function database() {
  const dbPath = process.env.DATABASE_PATH || path.resolve('.data/forewise');
  if (!process.env.DATABASE_URL) mkdirSync(path.dirname(dbPath), { recursive: true });
  globalDb.forewiseDb ??= createDatabase(process.env.DATABASE_URL || dbPath);
  return globalDb.forewiseDb;
}
