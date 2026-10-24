import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chartDomain, displayPoints } from '../lib/chart-model';
test('chart domain encloses negative, mixed, zero and constant series', () => {
  for (const values of [
    [-100, -20],
    [-10, 10],
    [0, 0],
    [100, 100],
  ]) {
    const p = values.map((value, i) => ({ date: `day${i}`, value }));
    const [min, max] = chartDomain(p);
    assert.ok(min < Math.min(...values));
    assert.ok(max > Math.max(...values));
    assert.ok(max > min);
  }
});
test('large chart rendering retains endpoints and an isolated spike', () => {
  const data = Array.from({ length: 5000 }, (_, i) => ({
    date: String(i),
    value: i === 2501 ? 10000 : 1,
  }));
  const displayed = displayPoints(data);
  assert.ok(displayed.length <= 600);
  assert.equal(displayed[0].index, 0);
  assert.equal(displayed.at(-1)!.index, 4999);
  assert.ok(displayed.some((p) => p.index === 2501));
});
