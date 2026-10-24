import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDataset } from '../lib/csv';

test('weekly and calendar-month CSV ingestion preserves regular periods and rejects drift', () => {
  const csv = (dates: string[]) =>
    'date,value\n' + dates.map((date, i) => `${date},${i}`).join('\n');
  const weekly = Array.from({ length: 8 }, (_, i) =>
    new Date(Date.UTC(2026, 0, 1 + i * 7)).toISOString().slice(0, 10),
  );
  assert.equal(parseDataset(csv(weekly), 'weekly').length, 8);
  assert.throws(() => parseDataset(csv(weekly), 'daily'), /consecutive daily/);
  const monthly = Array.from({ length: 8 }, (_, i) =>
    new Date(Date.UTC(2026, i + 1, 0)).toISOString().slice(0, 10),
  );
  assert.equal(parseDataset(csv(monthly), 'monthly').length, 8);
  monthly[3] = '2026-04-29';
  assert.throws(() => parseDataset(csv(monthly), 'monthly'), /consecutive monthly/);
});
