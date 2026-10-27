import ExcelJS from 'exceljs';
import type { Dataset, Forecast } from './forecast-result';

type Cell = string | number;
type ExportForecast = Omit<Forecast, 'created_at'> & { created_at?: Date | string | null };
export function exportRows(
  workspaceId: string,
  dataset: Dataset,
  forecast: ExportForecast,
): Cell[][] {
  const rows: Cell[][] = [
    ['record_type', 'date', 'value', 'p10', 'p50', 'p90', 'metadata_key', 'metadata_value'],
  ];
  for (const p of dataset.points) rows.push(['history', p.date, p.value, '', '', '', '', '']);
  for (const [i, p] of forecast.result.points.entries())
    rows.push([
      'forecast',
      p.date,
      p.value,
      forecast.result.quantiles?.p10[i]?.value ?? '',
      forecast.result.quantiles?.p50[i]?.value ?? '',
      forecast.result.quantiles?.p90[i]?.value ?? '',
      '',
      '',
    ]);
  // Preserve the complete model/evaluation payload, including revisions and warning text.
  const metadata = {
    export_version: '1',
    workspace_id: workspaceId,
    forecast_id: forecast.id,
    created_at:
      forecast.created_at instanceof Date
        ? forecast.created_at.toISOString()
        : (forecast.created_at ?? null),
    dataset_id: dataset.id,
    dataset_name: dataset.name,
    frequency: dataset.frequency ?? 'daily',
    observations: dataset.row_count,
    horizon: forecast.horizon,
    result: Object.fromEntries(
      Object.entries(forecast.result).filter(([key]) => !['points', 'quantiles'].includes(key)),
    ),
  };
  function add(value: unknown, key: string) {
    if (value !== null && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) add(v, key ? `${key}.${k}` : k);
    } else
      rows.push([
        'metadata',
        '',
        '',
        '',
        '',
        '',
        key,
        value === null ? 'null' : typeof value === 'number' ? value : String(value),
      ]);
  }
  add(metadata, '');
  return rows;
}

/** Formula-leading TEXT is neutralized. Validated numeric values stay numeric. */
export function exportCsv(rows: Cell[][]) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const text =
            typeof cell === 'number'
              ? String(cell)
              : /^[\s\u0000-\u001f]*[=+\-@\uFF1D\uFF0B\uFF0D\uFF20]|^[\t\r\n]/.test(cell)
                ? `'${cell}`
                : cell;
          return `"${text.replaceAll('"', '""')}"`;
        })
        .join(','),
    )
    .join('\r\n');
}
export async function exportXlsx(rows: Cell[][]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Forewise';
  for (const [name, kind] of [
    ['Observations', 'history'],
    ['Forecast', 'forecast'],
    ['Metadata', 'metadata'],
  ]) {
    const sheet = workbook.addWorksheet(name);
    sheet.addRows([rows[0], ...rows.slice(1).filter((row) => row[0] === kind)]);
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.columns.forEach((column, i) => {
      column.width = i > 5 ? 42 : 18;
    });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
