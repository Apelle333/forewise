import { parse } from 'csv-parse/sync';
export type Point = { date: string; value: number };
export type Frequency = 'daily' | 'weekly' | 'monthly';
export function parseDataset(csv: string, frequency: Frequency = 'daily'): Point[] {
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
    const previous = new Date(points[i - 1].date),
      current = new Date(points[i].date);
    const gap = current.getTime() - previous.getTime();
    const month = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth();
    const monthEnd = (d: Date) =>
      d.getUTCDate() ===
      new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    const valid =
      frequency === 'monthly'
        ? month(current) - month(previous) === 1 &&
          ((previous.getUTCDate() === 1 && current.getUTCDate() === 1) ||
            (monthEnd(previous) && monthEnd(current)))
        : gap === 86_400_000 * (frequency === 'weekly' ? 7 : 1);
    if (!valid)
      throw new Error(
        `Use consecutive ${frequency} dates with no duplicates or missing periods. Monthly dates must all be month starts or month ends.`,
      );
  }
  return points;
}
