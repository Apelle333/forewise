import { test } from 'node:test';
import assert from 'node:assert/strict';
import { horizonHistory, scenarioRows } from '../lib/horizon-data';

test('illustrative scenarios preserve the weekly mock and explicit symmetric extent', () => {
  for (const days of [7, 14, 28]) {
    for (const spread of [15, 55, 65]) {
      const rows = scenarioRows(days, spread);
      assert.equal(rows.length, days);
      for (const row of rows) {
        assert.equal(row.center, horizonHistory[21 + ((row.day - 1) % 7)]);
        assert.ok(Math.abs(row.high - row.low - (2 * spread * row.day) / 28) < 1e-10);
        assert.ok(row.low <= row.center && row.center <= row.high);
      }
      assert.equal(rows[0].date, '2026-09-29');
      if (days === 28) assert.equal(rows.at(-1)?.date, '2026-10-26');
    }
  }
});
