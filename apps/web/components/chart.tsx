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
  futureKind = 'mock',
  quantiles,
  comparison,
}: {
  history: Point[];
  future?: Point[];
  label?: string;
  caption?: string;
  unit?: string;
  futureKind?: 'mock' | 'forecast';
  quantiles?: { p10: Point[]; p50: Point[]; p90: Point[] } | null;
  comparison?: Point[];
}) {
  const id = useId().replaceAll(':', '');
  const [index, setIndex] = useState<number | null>(null),
    [table, setTable] = useState(false);
  const all = useMemo(() => [...history, ...future], [history, future]);
  const [min, max] = useMemo(
    () =>
      chartDomain([
        ...all,
        ...(quantiles?.p10 || []),
        ...(quantiles?.p90 || []),
        ...(comparison || []),
      ]),
    [all, quantiles, comparison],
  );
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
  const nextMedian =
    quantiles && quantiles.p50
      ? [...(history.length ? [history.at(-1)!] : []), ...quantiles.p50]
          .map((p, i) => `${x(history.length - 1 + i)},${y(p.value)}`)
          .join(' ')
      : null;
  const split = x(history.length - 1);
  const mock = active >= history.length;
  const futureLabel =
    futureKind === 'mock' ? 'Mock forecast' : quantiles ? 'Median forecast' : 'Baseline forecast';
  const sourceLabel = mock ? (futureKind === 'mock' ? 'MOCK' : 'FORECAST') : 'OBSERVED';
  const inspectLabel = futureKind === 'mock' ? 'Inspect a day' : 'Inspect an observation';
  const dateLabel = (value: string) =>
    futureKind === 'mock'
      ? formatDate(value)
      : new Date(`${value}T00:00:00Z`).toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        });
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
            {future.length > 0 ? (
              <span>
                <i className="mock-key" />
                {futureLabel}
              </span>
            ) : null}
          </div>
          {quantiles ? <p className="interval-note">Shaded P10–P90 / line P50</p> : null}
          {comparison ? (
            <p className="interval-note">Dotted line: saved SeasonalNaive baseline</p>
          ) : null}
        </div>
        <div className="point-readout" data-testid="point-readout">
          <span>
            {futureKind === 'mock' ? formatDate(point.date) : point.date} <b>{sourceLabel}</b>
          </span>
          <strong>
            {formatValue(point.value)}
            <small> {unit}</small>
          </strong>
          {quantiles && mock ? (
            <small>
              P10 {formatValue(quantiles.p10[active - history.length].value)} / P50{' '}
              {formatValue(quantiles.p50[active - history.length].value)} / P90{' '}
              {formatValue(quantiles.p90[active - history.length].value)}
            </small>
          ) : null}
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
            aria-label={`${label}. ${history.length} historical points${future.length ? ` and ${future.length} ${futureKind === 'mock' ? 'mock' : 'forecast'} points` : ''}. ${quantiles ? 'P10–P90 prediction interval, not a confidence interval. ' : ''}Use the ${inspectLabel} control or data table for values.`}
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
            {quantiles && future.length > 0 ? (
              <polygon
                data-testid="prediction-band"
                points={[
                  ...quantiles.p90.map((p, i) => `${x(history.length + i)},${y(p.value)}`),
                  ...quantiles.p10
                    .map((p, i) => `${x(history.length + i)},${y(p.value)}`)
                    .reverse(),
                ].join(' ')}
                fill="var(--accent)"
                opacity="0.16"
              />
            ) : null}
            {future.length > 0 && !quantiles ? (
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
            {comparison ? (
              <polyline
                data-testid="baseline-comparison"
                points={comparison
                  .map((p, i) => `${x(history.length + i)},${y(p.value)}`)
                  .join(' ')}
                className="comparison-line"
              />
            ) : null}
            {future.length > 0 ? (
              <polyline
                points={nextMedian || next}
                className="future-line"
                style={quantiles ? { strokeWidth: 2 } : {}}
              />
            ) : null}
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
        <span>{dateLabel(all[0].date)}</span>
        <span>{dateLabel(all[Math.floor((total - 1) / 2)].date)}</span>
        <span>{dateLabel(all.at(-1)!.date)}</span>
      </div>
      <label className="inspect-control">
        {inspectLabel} <span>Drag, tap or use arrow keys</span>
        <input
          type="range"
          min={0}
          max={total - 1}
          value={active}
          onChange={(e) => setIndex(Number(e.target.value))}
          aria-valuetext={`${point.date}, ${mock ? futureLabel.toLowerCase() : 'historical'}, ${formatValue(point.value)}`}
        />
      </label>
      {quantiles ? (
        <p className="interval-note">
          Shaded: P10–P90 nominal 80% prediction interval. Coverage is not guaranteed; inspect
          historical coverage below.
        </p>
      ) : null}
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
                  {quantiles ? (
                    <>
                      <th scope="col">P10</th>
                      <th scope="col">P50</th>
                      <th scope="col">P90</th>
                    </>
                  ) : null}
                  {comparison ? <th scope="col">SeasonalNaive</th> : null}
                </tr>
              </thead>
              <tbody>
                {all.map((p, i) => (
                  <tr key={p.date}>
                    <td>{p.date}</td>
                    <td>{p.value}</td>
                    <td>{i < history.length ? 'Historical' : futureLabel}</td>
                    {quantiles ? (
                      <>
                        <td>
                          {i < history.length ? '—' : quantiles.p10[i - history.length]?.value}
                        </td>
                        <td>
                          {i < history.length ? '—' : quantiles.p50[i - history.length]?.value}
                        </td>
                        <td>
                          {i < history.length ? '—' : quantiles.p90[i - history.length]?.value}
                        </td>
                      </>
                    ) : null}
                    {comparison ? (
                      <td>{i < history.length ? '—' : comparison[i - history.length]?.value}</td>
                    ) : null}
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
