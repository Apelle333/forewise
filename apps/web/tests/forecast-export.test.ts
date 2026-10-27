import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { parse } from 'csv-parse/sync';
import { exportRows, exportCsv, exportXlsx } from '../lib/forecast-export';
import { comparableBaseline, type Dataset, type Forecast } from '../lib/forecast-result';
const dataset: Dataset = {
  id: 'd',
  name: ' \t=HYPERLINK("evil")',
  row_count: 1,
  frequency: 'monthly',
  points: [{ date: '2026-01-01', value: -5 }],
};
const forecast: Forecast = {
  id: 'f',
  dataset_id: 'd',
  horizon: 1,
  created_at: '2026-10-25T00:00:00Z',
  result: {
    mock: false,
    model: 'timestral_209m',
    notice: 'Uncalibrated',
    points: [{ date: '2026-02-01', value: 4 }],
    quantiles: {
      p10: [{ date: '2026-02-01', value: -2 }],
      p50: [{ date: '2026-02-01', value: 4 }],
      p90: [{ date: '2026-02-01', value: 10 }],
    },
    metadata: { revision: 'pinned-sha' },
    warnings: ['Coverage limited'],
    evaluation: { windows: 1, evaluated_points: 1 },
  },
};
test('CSV preserves native quantiles, full metadata and numeric negatives while neutralizing formula text', () => {
  const rows = parse(exportCsv(exportRows('w', dataset, forecast))) as string[][];
  assert.equal(rows[1][2], '-5');
  assert.deepEqual(rows[2].slice(2, 6), ['4', '-2', '4', '10']);
  assert.equal(rows.find((r) => r[6] === 'dataset_name')?.[7], "'" + dataset.name);
  assert.equal(rows.find((r) => r[6] === 'result.metadata.revision')?.[7], 'pinned-sha');
  assert.equal(rows.find((r) => r[6] === 'result.warnings.0')?.[7], 'Coverage limited');
});
test('XLSX has typed primitive cells, three sheets and no executable formulas', async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await exportXlsx(exportRows('w', dataset, forecast))) as never);
  assert.deepEqual(
    workbook.worksheets.map((s) => s.name),
    ['Observations', 'Forecast', 'Metadata'],
  );
  assert.equal(workbook.getWorksheet('Observations')!.getCell('C2').value, -5);
  let found = false;
  for (const sheet of workbook.worksheets)
    sheet.eachRow((row) =>
      row.eachCell((cell) => {
        assert.equal(cell.formula, undefined);
        if (cell.value === dataset.name) found = true;
      }),
    );
  assert.equal(found, true);
  assert.equal(workbook.getWorksheet('Forecast')!.getCell('D2').value, -2);
});
test('comparison cannot fabricate a baseline or compare different inputs', () => {
  const base: Forecast = {
    ...forecast,
    id: 'baseline',
    result: { ...forecast.result, model: 'seasonal-naive-v1', quantiles: null },
  };
  assert.equal(comparableBaseline(forecast, []), undefined);
  assert.equal(comparableBaseline(forecast, [forecast]), undefined);
  for (const wrong of [
    { ...base, dataset_id: 'foreign' },
    { ...base, horizon: 2 },
    { ...base, result: { ...base.result, mock: true } },
    { ...base, result: { ...base.result, points: [{ date: '2026-03-01', value: 1 }] } },
  ])
    assert.equal(comparableBaseline(forecast, [wrong]), undefined);
  assert.equal(comparableBaseline(forecast, [base])?.id, 'baseline');
});

test('CSV text guards include fullwidth spreadsheet operators', () => {
  for (const operator of ['=', '+', '-', '@', '＝', '＋', '－', '＠']) {
    const rows = parse(exportCsv([[' \t' + operator + 'danger', -2]]));
    assert.equal(rows[0][0][0], "'");
    assert.equal(rows[0][1], '-2');
  }
});

test('CSV and XLSX preserve database Date, ISO string and null creation timestamps', async () => {
  const timestamp = '2026-10-25T12:34:56.789Z';
  for (const created_at of [new Date(timestamp), timestamp, null]) {
    const expected = created_at === null ? 'null' : timestamp;
    const rows = exportRows('w', dataset, { ...forecast, created_at });
    const csv = parse(exportCsv(rows)) as string[][];
    assert.deepEqual(
      csv.filter((row) => row[6] === 'created_at').map((row) => row[7]),
      [expected],
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await exportXlsx(rows)) as never);
    const timestamps: ExcelJS.CellValue[] = [];
    workbook.getWorksheet('Metadata')!.eachRow((row) => {
      if (row.getCell(7).value === 'created_at') timestamps.push(row.getCell(8).value);
    });
    assert.deepEqual(timestamps, [expected]);
  }
});

test('export v2 distinguishes empty containers, null, missing fields and literal strings', async () => {
  const rows = exportRows('w', dataset, {
    ...forecast,
    result: {
      ...forecast.result,
      evaluation: {
        windows: 1,
        evaluated_points: 1,
        warnings: [],
        context: {},
        unavailable: null,
        literalArray: '[]',
        literalObject: '{}',
        literalNull: 'null',
        nested: { values: [0, false, ''] },
      },
    },
  });
  const expected = [
    ['result.evaluation.warnings', '[]', 'array'],
    ['result.evaluation.context', '{}', 'object'],
    ['result.evaluation.unavailable', 'null', 'null'],
    ['result.evaluation.literalArray', '[]', 'string'],
    ['result.evaluation.literalObject', '{}', 'string'],
    ['result.evaluation.literalNull', 'null', 'string'],
    ['result.evaluation.nested.values.0', '0', 'number'],
    ['result.evaluation.nested.values.1', 'false', 'boolean'],
    ['result.evaluation.nested.values.2', '', 'string'],
  ];
  const csv = parse(exportCsv(rows)) as string[][];
  assert.equal(csv[0][8], 'metadata_type');
  assert.equal(csv.find((r) => r[6] === 'export_version')?.[7], '2');
  for (const [key, value, kind] of expected)
    assert.deepEqual(csv.find((r) => r[6] === key)?.slice(7), [value, kind]);
  assert.equal(
    csv.some((r) => r[6] === 'result.evaluation.absent'),
    false,
  );
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await exportXlsx(rows)) as never);
  const metadata = new Map<string, unknown[]>();
  workbook.getWorksheet('Metadata')!.eachRow((row) => {
    metadata.set(String(row.getCell(7).value), [row.getCell(8).value ?? '', row.getCell(9).value]);
  });
  for (const [key, value, kind] of expected)
    assert.deepEqual(metadata.get(key), [kind === 'number' ? Number(value) : value, kind]);
  assert.equal(metadata.has('result.evaluation.absent'), false);
});

test('export v2 escapes literal dots and backslashes without colliding with nested paths', () => {
  const rows = exportRows('w', dataset, {
    ...forecast,
    result: { ...forecast.result, metadata: { 'a.b': [], a: { b: {} }, 'a\\b': null } },
  });
  for (const [key, value, kind] of [
    ['result.metadata.a\\.b', '[]', 'array'],
    ['result.metadata.a.b', '{}', 'object'],
    ['result.metadata.a\\\\b', 'null', 'null'],
  ])
    assert.deepEqual(rows.find((r) => r[6] === key)?.slice(7), [value, kind]);
});
