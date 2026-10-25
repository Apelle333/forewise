import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDataset } from '../lib/csv';
const csv =
  'date,value\n' +
  Array.from({ length: 8 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')},${i + 1}`).join(
    '\n',
  );
test('valid CSV parses, sorts, and supports quoted values', () => {
  assert.equal(parseDataset(csv).length, 8);
  assert.equal(parseDataset(csv.replace(',1\n', ',"1"\n'))[0].value, 1);
});
test('invalid and duplicate headers are rejected', () => {
  assert.throws(
    () => parseDataset(csv.replace('date,value', 'day,total')),
    /Invalid CSV format|Missing date or value/,
  );
  assert.throws(
    () => parseDataset(csv.replace('date,value', 'date,value,value')),
    /Invalid CSV format|Missing date or value/,
  );
});
test('duplicate and missing dates rejected', () => {
  assert.throws(() => parseDataset(csv.replace('2026-10-02', '2026-10-01')), /Duplicate timestamp/);
  assert.throws(
    () => parseDataset(csv.replace('2026-10-08', '2026-10-09')),
    /Gap or inconsistency/,
  );
});
test('invalid calendar date rejected', () =>
  assert.throws(
    () => parseDataset(csv.replace('2026-10-01', '2026-02-30')),
    /Invalid date format/,
  ));
test('invalid, blank and infinite values rejected', () => {
  for (const bad of ['NaN', '', 'Infinity', '1e99'])
    assert.throws(() => parseDataset(csv.replace(',1\n', `,${bad}\n`)), /Invalid numeric value/);
});
test('too few rows and oversized CSV rejected', () => {
  assert.throws(() => parseDataset('date,value\n2026-10-01,1'), /between/);
  assert.throws(() => parseDataset('x'.repeat(1_000_001)), /1 MB/);
});
