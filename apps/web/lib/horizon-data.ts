// Deliberately deterministic illustration. These paths have no probability model.
export const horizonHistory = [
  104, 112, 108, 116, 127, 119, 110, 117, 125, 121, 130, 143, 133, 126, 132, 140, 136, 148, 159,
  151, 144, 150, 158, 153, 166, 178, 169, 161,
];
export type Direction = 'horizon' | 'observatory' | 'atlas';
export function scenarioValue(day: number, lane: number, spread: number) {
  const center = horizonHistory[21 + ((day - 1) % 7)];
  return center + (lane * spread * day) / 28;
}
export function scenarioRows(days: number, spread: number) {
  return Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    date: new Date(Date.UTC(2026, 8, 29 + i)).toISOString().slice(0, 10),
    center: scenarioValue(i + 1, 0, spread),
    low: scenarioValue(i + 1, -1, spread),
    high: scenarioValue(i + 1, 1, spread),
  }));
}
