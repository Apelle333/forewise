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
