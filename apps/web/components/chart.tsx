'use client';
import { useId, useMemo, useState } from 'react';
import type { Point } from '@/lib/csv';
import { chartDomain, displayPoints, formatDate, formatValue } from '@/lib/chart-model';
const empty: Point[] = [];
export function Chart({
  history,
  future = empty,
  label = 'Daily series and mock forecast',
  caption,
  unit = 'value',
}: {
  history: Point[];
  future?: Point[];
  label?: string;
  caption?: string;
  unit?: string;
}) {
  const id = useId().replaceAll(':', '');
  const [index, setIndex] = useState<number | null>(null),
    [table, setTable] = useState(false);
  const all = useMemo(() => [...history, ...future], [history, future]);
  const [min, max] = useMemo(() => chartDomain(all), [all]);
  const total = all.length,
    active = Math.min(index ?? history.length - 1, total - 1),
    point = all[active];
  const y = (value: number) => 260 - ((value - min) / (max - min)) * 260;
  const x = (i: number) => (i / Math.max(total - 1, 1)) * 900;
  const past = useMemo(
    () =>
      displayPoints(history)
        .map(
          ({ point, index }) =>
            `${(index / Math.max(total - 1, 1)) * 900},${260 - ((point.value - min) / (max - min)) * 260}`,
        )
        .join(' '),
    [history, total, min, max],
  );
  const next = [...(history.length ? [history.at(-1)!] : []), ...future]
    .map((p, i) => `${x(history.length - 1 + i)},${y(p.value)}`)
    .join(' ');
  const split = x(history.length - 1);
  const mock = active >= history.length;
  if (!point) return <p className="empty">Upload a dataset to see your history.</p>;
  function inspect(e: React.PointerEvent<HTMLDivElement>) {
    const bounds = e.currentTarget.getBoundingClientRect();
    setIndex(
      Math.max(
        0,
        Math.min(total - 1, Math.round(((e.clientX - bounds.left) / bounds.width) * (total - 1))),
      ),
    );
  }
  return (
    <figure className="series-figure" aria-labelledby={`${id}-title`}>
      <figcaption className="chart-caption">
        <div>
          <span className="overline" id={`${id}-title`}>
            {caption || label}
          </span>
          <div className="chart-key">
            <span>
              <i className="history-key" />
              Historical
            </span>
            <span>
              <i className="mock-key" />
              Mock forecast
            </span>
          </div>
        </div>
        <div className="point-readout" data-testid="point-readout">
          <span>
            {formatDate(point.date)} <b>{mock ? 'MOCK' : 'OBSERVED'}</b>
          </span>
          <strong>
            {formatValue(point.value)}
            <small> {unit}</small>
          </strong>
        </div>
      </figcaption>
      <div className="plot-surface">
        <div className="numeric-axis" aria-hidden="true">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <span key={t} style={{ top: `${t * 100}%` }}>
              {formatValue(max - t * (max - min))}
            </span>
          ))}
        </div>
        <div className="plot-area" onPointerMove={inspect} onPointerDown={inspect}>
          <svg
            className="chart"
            viewBox="0 0 900 260"
            preserveAspectRatio="none"
            role="img"
            aria-label={`${label}. ${history.length} historical points${future.length ? ` and ${future.length} mock points` : ''}. Use the Inspect a day control or data table for values.`}
          >
            <defs>
              <pattern
                id={`${id}-hatch`}
                width="9"
                height="9"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(30)"
              >
                <line x1="0" y1="0" x2="0" y2="9" stroke="currentColor" strokeWidth="1" />
              </pattern>
            </defs>
            {future.length > 0 ? (
              <rect
                x={split}
                y="0"
                width={900 - split}
                height="260"
                fill={`url(#${id}-hatch)`}
                className="mock-region"
              />
            ) : null}
            {[0, 65, 130, 195, 260].map((y) => (
              <line key={y} x1="0" x2="900" y1={y} y2={y} className="chart-grid" />
            ))}
            {[0, 150, 300, 450, 600, 750, 900].map((x) => (
              <line key={x} x1={x} x2={x} y1="0" y2="260" className="chart-grid vertical" />
            ))}
            {future.length > 0 ? (
              <line x1={split} x2={split} y1="0" y2="260" className="chart-boundary" />
            ) : null}
            <polyline points={past} className="history-line" />
            {future.length > 0 ? <polyline points={next} className="future-line" /> : null}
            <line x1={x(active)} x2={x(active)} y1="0" y2="260" className="chart-inspector" />
          </svg>
          <span
            className={`chart-dot ${mock ? 'is-mock' : ''}`}
            style={{
              left: `${(active / Math.max(total - 1, 1)) * 100}%`,
              top: `${(y(point.value) / 260) * 100}%`,
            }}
          />
          {future.length > 0 ? (
            <span
              className="horizon-annotation"
              style={{ left: `${Math.min((split / 900) * 100, 74)}%` }}
            >
              Forecast begins ↗
            </span>
          ) : null}
        </div>
      </div>
      <div className="date-axis" aria-hidden="true">
        <span>{formatDate(all[0].date)}</span>
        <span>{formatDate(all[Math.floor((total - 1) / 2)].date)}</span>
        <span>{formatDate(all.at(-1)!.date)}</span>
      </div>
      <label className="inspect-control">
        Inspect a day <span>Drag, tap or use arrow keys</span>
        <input
          type="range"
          min={0}
          max={total - 1}
          value={active}
          onChange={(e) => setIndex(Number(e.target.value))}
          aria-valuetext={`${formatDate(point.date)}, ${mock ? 'mock forecast' : 'historical'}, ${formatValue(point.value)}`}
        />
      </label>
      <details className="data-disclosure" onToggle={(e) => setTable(e.currentTarget.open)}>
        <summary>
          View data table <span>{total} observations</span>
        </summary>
        {table ? (
          <div
            className="data-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Scrollable series data"
          >
            <table>
              <caption>{label} — exact values</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Value</th>
                  <th scope="col">Source</th>
                </tr>
              </thead>
              <tbody>
                {all.map((p, i) => (
                  <tr key={p.date}>
                    <td>{p.date}</td>
                    <td>{p.value}</td>
                    <td>{i < history.length ? 'Historical' : 'Mock forecast'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </details>
    </figure>
  );
}
