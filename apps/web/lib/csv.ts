import { parse } from 'csv-parse/sync';
export type Point = { date: string; value: number };
export function parseDataset(csv: string): Point[] {
  if (Buffer.byteLength(csv, 'utf8') > 1_000_000) throw new Error('CSV must be smaller than 1 MB.');
  let records: Record<string, string>[];
  try {
    records = parse(csv, {
      columns: (header: string[]) => {
        if (header.length !== 2 || !header.includes('date') || !header.includes('value'))
          throw new Error('Required columns: date,value.');
        return header;
      },
      skip_empty_lines: true,
      bom: true,
      trim: true,
      max_record_size: 2048,
    });
  } catch {
    throw new Error('Invalid CSV. Use a date,value header and one observation per day.');
  }
  if (records.length < 8 || records.length > 5000)
    throw new Error('Upload between 8 and 5,000 daily observations.');
  const points = records
    .map((row) => {
      if (Object.keys(row).length !== 2 || !('date' in row) || !('value' in row))
        throw new Error('Required columns: date,value.');
      const date = row.date;
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        date.startsWith('0000') ||
        !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date
      )
        throw new Error('Dates must be valid YYYY-MM-DD values.');
      const value = Number(row.value);
      if (!row.value || !Number.isFinite(value) || Math.abs(value) > 1e12)
        throw new Error('Values must be finite numbers between -1e12 and 1e12.');
      return { date, value };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 1; i < points.length; i++) {
    if (Date.parse(points[i].date) - Date.parse(points[i - 1].date) !== 86_400_000)
      throw new Error('Use consecutive daily dates with no duplicates or missing days.');
  }
  return points;
}
