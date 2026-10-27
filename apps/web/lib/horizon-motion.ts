import { horizonHistory, scenarioValue } from './horizon-data';

/** Presentation timing only. Never transforms or calibrates a forecast. */
export const MOTION_PERIOD = 12;
const wrap = (value: number) => ((value % MOTION_PERIOD) + MOTION_PERIOD) % MOTION_PERIOD;
export function motionTime(clock: { offset: number; startedAt: number | null }, now: number) {
  return wrap(
    clock.offset + (clock.startedAt === null ? 0 : Math.max(0, now - clock.startedAt) / 1000),
  );
}
export function inspectHorizon(cursor: number, days: number, spread: number) {
  const day = Math.max(-27, Math.min(days, Math.round(cursor)));
  const date = new Date(Date.UTC(2026, 8, 28 + day)).toISOString().slice(0, 10);
  return {
    day,
    date,
    kind: day <= 0 ? 'history' : 'scenario',
    value: day <= 0 ? horizonHistory[day + 27] : scenarioValue(day, 0, spread),
    low: day <= 0 ? null : scenarioValue(day, -1, spread),
    high: day <= 0 ? null : scenarioValue(day, 1, spread),
  } as const;
}
function hash(value: number) {
  let n = Math.imul(value ^ 0x9e3779b9, 0x85ebca6b);
  n ^= n >>> 13;
  return (Math.imul(n, 0xc2b2ae35) >>> 0) / 4294967296;
}
export function particleAt(index: number, seconds: number, seed = 209) {
  const birth = hash(index * 17 + seed) * MOTION_PERIOD;
  const phase = wrap(wrap(seconds) - birth) / MOTION_PERIOD;
  return {
    birth,
    lifetime: MOTION_PERIOD,
    velocity: 10 / MOTION_PERIOD,
    phase,
    alpha: Math.sin(Math.PI * phase) ** 2,
    lane: hash(index * 29 + seed) * 2 - 1,
  };
}
export function orbitAt(seconds: number, reduced: boolean) {
  if (reduced) return { x: 0, y: 0 };
  const phase = (wrap(seconds) / MOTION_PERIOD) * Math.PI * 2;
  return { x: Math.sin(phase) * 0.018, y: (Math.cos(phase) - 1) * 0.025 };
}
export function easePose(from: number, to: number, elapsed: number) {
  const t = Math.max(0, Math.min(1, elapsed / 360));
  return from + (to - from) * t * t * (3 - 2 * t);
}

/** Linear interpolation of the same daily illustration, not extra observations. */
export function illustrativeValue(day: number, lane: number, spread: number) {
  const lo = Math.floor(day),
    hi = Math.ceil(day),
    t = day - lo;
  const sample = (d: number) => (d <= 0 ? horizonHistory.at(-1)! : scenarioValue(d, lane, spread));
  return sample(lo) * (1 - t) + sample(hi) * t;
}
