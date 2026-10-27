import type { Point } from './csv';
export function chartDomain(points: Point[]): [number, number] {
  if (!points.length) return [0, 1];
  let min = Infinity,
    max = -Infinity;
  for (const point of points) {
    min = Math.min(min, point.value);
    max = Math.max(max, point.value);
  }
  const pad = (max - min || Math.abs(max) || 1) * 0.15;
  const quantum = 10 ** Math.floor(Math.log10(pad));
  return [Math.floor((min - pad) / quantum) * quantum, Math.ceil((max + pad) / quantum) * quantum];
}
export function displayPoints(points: Point[], limit = 600): { point: Point; index: number }[] {
  if (points.length <= limit) return points.map((point, index) => ({ point, index }));
  const result = [{ point: points[0], index: 0 }];
  const bucket = Math.ceil((points.length - 2) / ((limit - 2) / 2));
  for (let start = 1; start < points.length - 1; start += bucket) {
    const end = Math.min(start + bucket, points.length - 1);
    let low = start,
      high = start;
    for (let i = start + 1; i < end; i++) {
      if (points[i].value < points[low].value) low = i;
      if (points[i].value > points[high].value) high = i;
    }
    for (const index of [...new Set([low, high])].sort((a, b) => a - b))
      result.push({ point: points[index], index });
  }
  result.push({ point: points.at(-1)!, index: points.length - 1 });
  return result;
}
export const formatValue = (value: number) =>
  value !== 0 && Math.abs(value) < 0.01
    ? value.toExponential(2)
    : new Intl.NumberFormat('en', {
        maximumFractionDigits: 2,
        notation: Math.abs(value) >= 1_000_000 ? 'compact' : 'standard',
      }).format(value);
export const formatDate = (date: string) =>
  new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  );
