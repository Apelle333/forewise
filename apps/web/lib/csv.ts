import { parse } from 'csv-parse/sync';
export type Point = { date: string; value: number };
export type Frequency = 'daily' | 'weekly' | 'monthly';
export function parseDataset(csv: string, frequency: Frequency = 'daily'): Point[] {
  if (Buffer.byteLength(csv, 'utf8') > 1_000_000) throw new Error('CSV must be smaller than 1 MB.');
  let records: Record<string, string>[];
  try {
    records = parse(csv, {
      columns: (header: string[]) => {
        if (header.length < 2) throw new Error('CSV must have at least two columns.');
        return header;
      },
      skip_empty_lines: true,
      bom: true,
      trim: true,
      max_record_size: 2048,
    });
  } catch {
    throw new Error('Invalid CSV format.');
  }
  if (records.length < 8 || records.length > 5000)
    throw new Error('Upload between 8 and 5,000 observations.');

  // Validation Logic: detect the mapped columns (assume the first two if not specified,
  // but for the refined flow, we should trust the CSV provided by the frontend
  // which is already mapped to 'date,value').
  const points = records
    .map((row, i) => {
      const date = row.date;
      const valueStr = row.value;
      if (!date || valueStr === undefined)
        throw new Error(`Missing date or value at row ${i + 2}.`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        date.startsWith('0000') ||
        !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date
      )
        throw new Error(`Invalid date format at row ${i + 2}. Use YYYY-MM-DD.`);
      const value = Number(valueStr);
      if (valueStr === '' || !Number.isFinite(value) || Math.abs(value) > 1e12)
        throw new Error(`Invalid numeric value at row ${i + 2}.`);
      return { date, value };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Check for duplicate timestamps
  for (let i = 1; i < points.length; i++) {
    if (points[i].date === points[i - 1].date)
      throw new Error(`Duplicate timestamp found: ${points[i].date}. Please resolve duplicates.`);
  }

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
        `Gap or inconsistency found between ${points[i-1].date} and ${points[i].date}. Use consecutive ${frequency} dates.`,
      );
  }
  return points;
}
