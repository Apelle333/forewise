import type { Point } from '@/lib/csv';
export function Chart({
  history,
  future = [],
  label = 'Illustrative demand forecast',
}: {
  history: Point[];
  future?: Point[];
  label?: string;
}) {
  const values = [...history, ...future].map((p) => p.value);
  const min = Math.min(...values) * 0.8,
    max = Math.max(...values) * 1.1;
  const total = values.length;
  const xy = (value: number, i: number) =>
    `${30 + (i * 660) / Math.max(total - 1, 1)},${215 - ((value - min) / Math.max(max - min, 1)) * 175}`;
  const past = history.map((p, i) => xy(p.value, i)).join(' ');
  const next =
    history.length && future.length
      ? [
          xy(history.at(-1)!.value, history.length - 1),
          ...future.map((p, i) => xy(p.value, history.length + i)),
        ].join(' ')
      : '';
  const split = 30 + ((history.length - 1) * 660) / Math.max(total - 1, 1);
  return (
    <svg className="chart" viewBox="0 0 720 260" role="img" aria-label={label}>
      <defs>
        <linearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#b7f567" stopOpacity=".24" />
          <stop offset="1" stopColor="#b7f567" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[40, 95, 150, 205].map((y) => (
        <line key={y} x1="30" x2="690" y1={y} y2={y} stroke="currentColor" opacity=".08" />
      ))}
      {future.length > 0 ? (
        <>
          <rect x={split} y="20" width={690 - split} height="205" fill="url(#wash)" />
          <line x1={split} x2={split} y1="20" y2="225" stroke="#8c9c85" strokeDasharray="4 5" />
          <text x={split + 12} y="34" fill="#9aa994" fontSize="11">
            FORECAST
          </text>
        </>
      ) : null}
      <polyline
        points={past}
        fill="none"
        stroke="#d9e3d1"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {next ? (
        <polyline
          points={next}
          fill="none"
          stroke="#b7f567"
          strokeWidth="3"
          strokeDasharray="6 5"
          strokeLinejoin="round"
        />
      ) : null}
      <text x="30" y="250" fill="#84907f" fontSize="11">
        {history[0]?.date}
      </text>
      <text x="690" y="250" textAnchor="end" fill="#84907f" fontSize="11">
        {future.at(-1)?.date || history.at(-1)?.date}
      </text>
    </svg>
  );
}
