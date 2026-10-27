import type { CSSProperties } from 'react';

type Point = readonly [number, number];
type StageId = 'data' | 'validation' | 'model' | 'forecast' | 'review' | 'export';

const stages: {
  id: StageId;
  title: string;
  preview: string;
  heading: string;
  detail: string;
  boundary: string;
}[] = [
  {
    id: 'data',
    title: 'Data',
    preview: 'CSV / XLSX history',
    heading: 'Start with what was observed.',
    detail:
      'Import a CSV or XLSX file in the authenticated workspace. Map its date and value columns to a daily, weekly or monthly time series.',
    boundary: 'A record is an observation, not a forecast.',
  },
  {
    id: 'validation',
    title: 'Validation',
    preview: 'Dates / frequency / format',
    heading: 'Check the input before interpreting it.',
    detail:
      'Forewise checks dates, frequency and duplicate periods, and rejects spreadsheet formulas. Correct rejected input in the source file before importing again.',
    boundary: 'Passing input checks does not establish the quality of the underlying signal.',
  },
  {
    id: 'model',
    title: 'Model',
    preview: 'Timestral / baseline',
    heading: 'Know which method produced it.',
    detail:
      'Choose Timestral 209M or the Seasonal Naive baseline and a forecast horizon. The workspace saves an asynchronous job so its status and result can be revisited.',
    boundary: 'This instrument explains those steps; it does not submit or process a job.',
  },
  {
    id: 'forecast',
    title: 'Forecast',
    preview: 'Estimates, with limits',
    heading: 'Separate observations from estimates.',
    detail:
      'Timestral provides its native P10, P50 and P90 estimates. Seasonal Naive provides point forecasts only. Read each result with its dates, horizon and method.',
    boundary:
      'Native quantiles are not a calibration guarantee. These drawn branches are schematic.',
  },
  {
    id: 'review',
    title: 'Review',
    preview: 'Errors / coverage / warnings',
    heading: 'Inspect the historical evidence.',
    detail:
      'Review historical MAE and RMSE, interval coverage when available, and evaluation warnings. These describe the historical check, not guaranteed future performance.',
    boundary:
      'Unavailable evaluation remains unavailable; it is never replaced with a fabricated score.',
  },
  {
    id: 'export',
    title: 'Export',
    preview: 'CSV / XLSX handoff',
    heading: 'Keep the context with the values.',
    detail:
      'Authorized workspace users can export CSV or XLSX with the history, forecast and available model and evaluation metadata, so a shared result retains its context.',
    boundary: 'This guide does not export a job. Exports remain subject to workspace permissions.',
  },
];
const signalPorts = [47, 140, 234, 329, 423, 518] as const;

// Original orthographic projection. Geometry stays on the server.
function project(x: number, y: number, z = 0): Point {
  return [64 + x * 1.08 + y * 0.66, 260 - x * 0.13 + y * 0.4 - z];
}

function polygon(points: readonly Point[]) {
  return `${points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')} Z`;
}

function topLine(points: readonly Point[], z: number) {
  return points
    .map(([x, y], i) => {
      const p = project(x, y, z);
      return `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`;
    })
    .join(' ');
}

function Solid({
  x,
  y,
  w,
  d,
  z,
  h,
  tone = '',
  bevel = 1.5,
}: {
  x: number;
  y: number;
  w: number;
  d: number;
  z: number;
  h: number;
  tone?: string;
  bevel?: number;
}) {
  const b = Math.min(bevel, w / 4, d / 4);
  const plan: Point[] = [
    [x + b, y],
    [x + w - b, y],
    [x + w, y + b],
    [x + w, y + d - b],
    [x + w - b, y + d],
    [x + b, y + d],
    [x, y + d - b],
    [x, y + b],
  ];
  return (
    <g className={`fi-solid ${tone}`}>
      <path
        className="fi-side-dark"
        d={polygon([
          project(x, y, z),
          project(x + w, y, z),
          project(x + w, y, z + h),
          project(x, y, z + h),
        ])}
      />
      <path
        className="fi-side-mid"
        d={polygon([
          project(x, y + d, z),
          project(x + w, y + d, z),
          project(x + w, y + d, z + h),
          project(x, y + d, z + h),
        ])}
      />
      <path
        className="fi-side-light"
        d={polygon([
          project(x + w, y, z),
          project(x + w, y + d, z),
          project(x + w, y + d, z + h),
          project(x + w, y, z + h),
        ])}
      />
      <path className="fi-top" d={polygon(plan.map(([px, py]) => project(px, py, z + h)))} />
    </g>
  );
}

function Octagon({
  x,
  y,
  r,
  z,
  h,
  tone = '',
}: {
  x: number;
  y: number;
  r: number;
  z: number;
  h: number;
  tone?: string;
}) {
  const plan: Point[] = Array.from({ length: 8 }, (_, i) => [
    x + Math.cos((i * Math.PI) / 4) * r,
    y + Math.sin((i * Math.PI) / 4) * r,
  ]);
  return (
    <g className={`fi-solid ${tone}`}>
      {[0, 1, 2, 3].map((i) => (
        <path
          key={i}
          className={i < 2 ? 'fi-side-light' : 'fi-side-mid'}
          d={polygon([
            project(...plan[i], z),
            project(...plan[i + 1], z),
            project(...plan[i + 1], z + h),
            project(...plan[i], z + h),
          ])}
        />
      ))}
      <path className="fi-top" d={polygon(plan.map(([px, py]) => project(px, py, z + h)))} />
    </g>
  );
}

function Pin({ x, y, z }: { x: number; y: number; z: number }) {
  const [cx, cy] = project(x, y, z);
  return (
    <g className="fi-pin">
      <ellipse cx={cx} cy={cy} rx="2.2" ry="1.2" />
      <path d={`M${cx - 1},${cy}h2`} />
    </g>
  );
}

function Socket({ x, y }: { x: number; y: number }) {
  return <Solid x={x} y={y} w={8} d={8} z={14} h={6} tone="fi-socket" />;
}

function DataAssembly() {
  return (
    <g className="fi-assembly fi-data">
      <Solid x={22} y={38} w={64} d={57} z={10} h={8} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <Solid x={28 + i * 3} y={44 + i * 2} w={45} d={37} z={19 + i * 4} h={2} tone="fi-paper" />
          {[0, 1, 2].map((row) => (
            <path
              key={row}
              className="fi-engraving"
              d={topLine(
                [
                  [35 + i * 3, 51 + i * 2 + row * 7],
                  [62 + i * 3, 51 + i * 2 + row * 7],
                ],
                21 + i * 4,
              )}
            />
          ))}
        </g>
      ))}
      <Solid x={22} y={38} w={5} d={57} z={18} h={13} />
      <Solid x={81} y={38} w={5} d={57} z={18} h={13} />
      <Pin x={24.5} y={88} z={31} />
      <Pin x={83.5} y={88} z={31} />
      <Socket x={47} y={104} />
    </g>
  );
}

function ValidationAssembly() {
  return (
    <g className="fi-assembly fi-validation">
      <Solid x={115} y={42} w={64} d={47} z={10} h={6} />
      <Solid x={120} y={56} w={7} d={15} z={16} h={59} />
      <Solid x={165} y={56} w={7} d={15} z={16} h={59} />
      <Solid x={120} y={56} w={52} d={15} z={75} h={7} />
      <Solid x={129} y={58} w={34} d={7} z={32} h={37} tone="fi-inset" />
      {[0, 1, 2, 3].map((i) => (
        <Solid key={i} x={131} y={65} w={28 - i * 3} d={2} z={38 + i * 7} h={2} tone="fi-check" />
      ))}
      <Pin x={123.5} y={65} z={82} />
      <Pin x={168.5} y={65} z={82} />
      <Socket x={140} y={104} />
    </g>
  );
}

function ModelAssembly() {
  return (
    <g className="fi-assembly fi-model">
      <Solid x={210} y={38} w={64} d={57} z={10} h={7} />
      <Octagon x={242} y={65} r={26} z={17} h={6} />
      <Octagon x={242} y={65} r={21} z={23} h={31} tone="fi-inset" />
      <Octagon x={242} y={65} r={26} z={54} h={6} />
      <Octagon x={242} y={65} r={17} z={60} h={8} tone="fi-selector" />
      {[0, 1, 2, 3].map((i) => (
        <Solid key={i} x={224 + i * 10} y={62} w={5} d={6} z={68} h={4} />
      ))}
      <path
        className="fi-accent-line"
        d={topLine(
          [
            [233, 69],
            [250, 60],
          ],
          73,
        )}
      />
      <Socket x={234} y={104} />
    </g>
  );
}

function ForecastAssembly() {
  return (
    <g className="fi-assembly fi-forecast">
      <Solid x={303} y={34} w={68} d={65} z={10} h={8} />
      <Solid x={309} y={40} w={56} d={51} z={18} h={1} tone="fi-inset" />
      <Solid x={305} y={35} w={6} d={7} z={18} h={34} />
      <Solid x={363} y={35} w={6} d={7} z={18} h={34} />
      <Solid x={305} y={35} w={64} d={5} z={52} h={5} />
      <Solid x={329} y={33} w={13} d={10} z={49} h={12} tone="fi-selector" />
      <path
        className="fi-chart-history"
        d={topLine(
          [
            [313, 80],
            [322, 74],
            [331, 77],
            [337, 67],
          ],
          20,
        )}
      />
      {[52, 67, 82].map((end, i) => (
        <g key={end}>
          <path
            className="fi-chart-path"
            d={topLine(
              [
                [337, 67],
                [347, 66 + (i - 1) * 7],
                [359, end],
              ],
              20,
            )}
          />
          <Solid x={357} y={end - 2} w={4} d={4} z={20} h={1} tone="fi-terminal" />
        </g>
      ))}
      <Socket x={329} y={104} />
    </g>
  );
}

function ReviewAssembly() {
  return (
    <g className="fi-assembly fi-review">
      <Solid x={399} y={40} w={63} d={54} z={10} h={7} />
      <Solid x={425} y={60} w={11} d={11} z={17} h={26} />
      <Octagon x={431} y={65} r={29} z={43} h={9} />
      <Octagon x={431} y={65} r={24} z={52} h={1} tone="fi-inset" />
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i * Math.PI) / 8;
        return (
          <path
            key={i}
            className="fi-dial-tick"
            d={topLine(
              [
                [431 + Math.cos(a) * 23, 65 + Math.sin(a) * 23],
                [431 + Math.cos(a) * (i % 4 ? 20 : 17), 65 + Math.sin(a) * (i % 4 ? 20 : 17)],
              ],
              54,
            )}
          />
        );
      })}
      <path
        className="fi-accent-line"
        d={topLine(
          [
            [423, 69],
            [447, 57],
          ],
          55,
        )}
      />
      <Octagon x={431} y={65} r={2.8} z={55} h={1} tone="fi-terminal" />
      <Pin x={406} y={85} z={17} />
      <Pin x={455} y={85} z={17} />
      <Socket x={423} y={104} />
    </g>
  );
}

function ExportAssembly() {
  return (
    <g className="fi-assembly fi-export">
      <Solid x={492} y={39} w={64} d={55} z={10} h={23} />
      <Solid x={498} y={42} w={52} d={8} z={33} h={2} tone="fi-inset" />
      <Solid x={503} y={49} w={42} d={47} z={35} h={1} tone="fi-paper" />
      {[0, 1, 2, 3].map((i) => (
        <path
          key={i}
          className="fi-engraving"
          d={topLine(
            [
              [509, 60 + i * 8],
              [i === 3 ? 530 : 539, 60 + i * 8],
            ],
            37,
          )}
        />
      ))}
      <Solid x={498} y={43} w={52} d={5} z={35} h={4} />
      <Octagon x={503} y={47} r={3} z={39} h={2} />
      <Octagon x={545} y={47} r={3} z={39} h={2} />
      <Pin x={497} y={87} z={33} />
      <Pin x={551} y={87} z={33} />
      <Socket x={518} y={104} />
    </g>
  );
}

export function ForecastInstrument() {
  return (
    <section className="forecast-instrument" id="forecast-pipeline" aria-labelledby="fi-title">
      <div className="fi-heading">
        <h2 id="fi-title">
          A forecast is more
          <br />
          than its output.
        </h2>
        <p>Follow the decisions around the numbers. Open a stage to see what belongs there.</p>
      </div>
      <figure className="fi-figure">
        <div className="fi-card-label">
          <span>Forewise signal instrument / Figure 01</span>
          <span>Conceptual guide</span>
        </div>
        <div className="fi-drawing">
          <svg
            viewBox="40 100 760 245"
            role="img"
            aria-labelledby="fi-svg-title fi-svg-description"
          >
            <title id="fi-svg-title">One connected instrument, six forecast stages</title>
            <desc id="fi-svg-description">
              A virtual console joins a data cassette, validation gate, model selector, branching
              plotter, review dial and export slot on a shared bed. It is a software metaphor, not a
              physical mechanism or a live job.
            </desc>
            <ellipse className="fi-shadow" cx="424" cy="290" rx="330" ry="32" />
            {[
              [14, 15],
              [550, 15],
              [14, 104],
              [550, 104],
            ].map(([x, y], i) => (
              <Solid key={i} x={x} y={y} w={15} d={15} z={-10} h={10} tone="fi-base" />
            ))}
            <Solid x={0} y={0} w={578} d={126} z={0} h={10} tone="fi-base" bevel={5} />
            <Solid x={7} y={7} w={564} d={112} z={10} h={1} tone="fi-bed" bevel={4} />
            {[22, 109].map((y) => (
              <Solid key={y} x={13} y={y} w={552} d={5} z={11} h={3} tone="fi-guide" />
            ))}
            {[12, 560].map((x) => (
              <Solid key={x} x={x} y={18} w={6} d={99} z={11} h={7} />
            ))}
            <Solid x={245} y={112} w={84} d={9} z={11} h={0.7} tone="fi-label-plate" />
            <path
              className="fi-engraving"
              d={topLine(
                [
                  [251, 116],
                  [294, 116],
                ],
                12,
              )}
            />
            <Pin x={17} y={12} z={12} />
            <Pin x={560} y={12} z={12} />
            <Pin x={17} y={117} z={12} />
            <Pin x={560} y={117} z={12} />
            <Socket x={14} y={104} />
            <Socket x={552} y={104} />
            {[0, 1, 2, 3, 4].map((i) => (
              <g key={i} className={`fi-connection fi-connection-${stages[i + 1].id}`}>
                <path
                  className="fi-signal-base"
                  d={topLine(
                    [
                      [signalPorts[i] + 8, 108],
                      [signalPorts[i + 1], 108],
                    ],
                    18,
                  )}
                />
                <path
                  className="fi-signal-sweep"
                  pathLength="1"
                  d={topLine(
                    [
                      [signalPorts[i] + 8, 108],
                      [signalPorts[i + 1], 108],
                    ],
                    18,
                  )}
                />
              </g>
            ))}
            <DataAssembly />
            <ValidationAssembly />
            <ModelAssembly />
            <ForecastAssembly />
            <ReviewAssembly />
            <ExportAssembly />
          </svg>
        </div>
        <div className="fi-controls" aria-label="Explore the six forecast stages">
          {stages.map((stage, index) => (
            <details
              key={stage.id}
              className={`fi-step fi-step-${stage.id}`}
              name="forecast-instrument-stage"
              open={index === 0}
            >
              <summary style={{ '--fi-column': index + 1 } as CSSProperties}>
                <span className="fi-step-number">0{index + 1}</span>
                <span className="fi-step-title">
                  {stage.title}
                  <span aria-hidden="true">↗</span>
                </span>
                <span className="fi-step-preview">{stage.preview}</span>
              </summary>
              <div className="fi-detail">
                <div>
                  <h3>{stage.heading}</h3>
                </div>
                <div>
                  <p>{stage.detail}</p>
                  <p className="fi-boundary">{stage.boundary}</p>
                </div>
              </div>
            </details>
          ))}
        </div>
        <figcaption>
          Conceptual virtual instrument. Selecting a stage explains the workflow; it does not
          process data. The drawing shows no live job, measured accuracy or calibrated uncertainty.
        </figcaption>
      </figure>
    </section>
  );
}
