'use client';
import { useEffect, useRef, useState } from 'react';
import { horizonHistory, scenarioRows, type Direction } from '@/lib/horizon-data';
import { inspectHorizon } from '@/lib/horizon-motion';
import type { mountHorizon } from './horizon-renderer';

const concepts = {
  horizon: {
    title: 'A wider view',
    end: 'of your business.',
    kicker: 'FORECAST HORIZON / 001',
    description:
      'A forecasting workspace in development for demand, revenue and capacity. Explore how different futures could shape stock, budget and staffing plans.',
  },
  observatory: {
    title: 'Find the signal.',
    end: 'Change your orbit.',
    kicker: 'SIGNAL OBSERVATORY / 002',
    description:
      'An instrument for looking closer. Time becomes an orbit; scenarios become a constellation.',
  },
  atlas: {
    title: 'Tomorrow has',
    end: 'a different terrain.',
    kicker: 'TIDAL ATLAS / 003',
    description: 'Read your history as a landscape. Explore the ridgelines of an open future.',
  },
};

function FlatView({
  days,
  spread,
  cursor,
  rangeVisible,
}: {
  days: number;
  spread: number;
  cursor: number;
  rangeVisible: boolean;
}) {
  const rows = scenarioRows(days, spread);
  const x = (day: number) => 60 + ((day + 27) / 55) * 880;
  const y = (value: number) => 350 - ((value - 60) / 190) * 290;
  const history = horizonHistory.map((value, i) => `${x(i - 27)},${y(value)}`).join(' ');
  const points = (key: 'low' | 'high' | 'center') =>
    `${x(0)},${y(161)} ` + rows.map((r) => `${x(r.day)},${y(r[key])}`).join(' ');
  const selected = inspectHorizon(cursor, days, spread);
  return (
    <svg
      viewBox="0 0 1000 420"
      role="img"
      aria-label={`Two-dimensional synthetic scenarios. White is history, amber is the weekly-repeat mock. ${rangeVisible ? 'Mint outlines the illustrative range.' : 'Illustrative range hidden.'} No probability is assigned.`}
    >
      {[100, 150, 200].map((v) => (
        <g key={v}>
          <line x1="60" x2="940" y1={y(v)} y2={y(v)} stroke="currentColor" opacity=".15" />
          <text x="45" y={y(v) + 4} textAnchor="end" fill="currentColor" fontSize="13">
            {v}
          </text>
        </g>
      ))}
      {rangeVisible && (
        <polygon
          points={`${points('high')} ${[...rows]
            .reverse()
            .map((r) => `${x(r.day)},${y(r.low)}`)
            .join(' ')} ${x(0)},${y(161)}`}
          fill="var(--h-mint)"
          opacity=".08"
          data-testid="scenario-range"
        />
      )}
      <polyline points={history} fill="none" stroke="var(--h-history)" strokeWidth="2" />
      {rangeVisible && (
        <polyline points={points('high')} fill="none" stroke="var(--h-mint)" strokeWidth="1.5" />
      )}
      {rangeVisible && (
        <polyline points={points('low')} fill="none" stroke="var(--h-mint)" strokeWidth="1.5" />
      )}
      <polyline
        points={points('center')}
        fill="none"
        stroke="var(--h-repeat)"
        strokeWidth="2"
        strokeDasharray="5 5"
      />
      <line x1={x(0)} x2={x(0)} y1="35" y2="360" stroke="var(--h-repeat)" opacity=".4" />
      <line
        x1={x(selected.day)}
        x2={x(selected.day)}
        y1="45"
        y2="360"
        stroke="var(--h-text)"
        opacity=".5"
        strokeDasharray="2 5"
      />
      <circle
        cx={x(selected.day)}
        cy={y(selected.value)}
        r="5"
        fill="var(--h-bg)"
        stroke="var(--h-text)"
        strokeWidth="2"
      />
      <text x="60" y="395" fill="currentColor" fontSize="13">
        Sep 01 · history
      </text>
      <text x={x(0) + 8} y="32" fill="var(--h-repeat)" fontSize="13">
        Sep 28 · scenarios begin
      </text>
      <text x="940" y="395" textAnchor="end" fill="currentColor" fontSize="13">
        {rows.at(-1)?.date}
      </text>
    </svg>
  );
}

export function HorizonExperience({
  direction = 'horizon',
  exploration = false,
}: {
  direction?: Direction;
  exploration?: boolean;
}) {
  const [days, setDays] = useState(28),
    [spread, setSpread] = useState(55);
  const [flat, setFlat] = useState(false),
    [reduced, setReduced] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  const [cursor, setCursor] = useState(0),
    [rangeVisible, setRangeVisible] = useState(true),
    [playing, setPlaying] = useState(false),
    [replay, setReplay] = useState(0);
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<ReturnType<typeof mountHorizon> | null>(null);
  const settings = useRef({
    days,
    spread,
    direction,
    reduced: reduced ?? true,
    cursor,
    rangeVisible,
    playing,
    replay,
  });
  const concept = concepts[direction],
    rows = scenarioRows(days, spread),
    last = rows.at(-1)!,
    inspected = inspectHorizon(cursor, days, spread);

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setReduced(media.matches);
      if (media.matches) {
        setFlat(true);
        setPlaying(false);
      }
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    settings.current = {
      days,
      spread,
      direction,
      reduced: reduced ?? true,
      cursor,
      rangeVisible,
      playing,
      replay,
    };
    engine.current?.update(settings.current);
  }, [days, spread, direction, reduced, cursor, rangeVisible, playing, replay]);
  useEffect(() => {
    if (reduced === null || flat || failed) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const node = host.current!;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      timer = setTimeout(() => {
        import('./horizon-renderer')
          .then(({ mountHorizon }) => {
            if (cancelled) return;
            try {
              engine.current = mountHorizon(node, settings.current, () => {
                setFailed(true);
                setReady(false);
                setPlaying(false);
              });
              setReady(true);
            } catch {
              setFailed(true);
            }
          })
          .catch(() => {
            if (!cancelled) setFailed(true);
          });
      }, 800);
    });
    observer.observe(node);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      observer.disconnect();
      engine.current?.dispose();
      engine.current = null;
    };
  }, [flat, failed, reduced]);

  const is3d = ready && !flat && !failed;
  return (
    <section
      className={`h-experience h-${direction} ${exploration ? 'h-exploration' : ''}`}
      aria-label={concept.kicker}
    >
      <div className="h-intro">
        <div className="h-eyebrow">
          <span className="h-status-dot" /> BUSINESS FORECASTING / PRODUCT PREVIEW{' '}
          <span className="h-edition">{concept.kicker}</span>
        </div>
        <h1>
          {concept.title}
          <br />
          <em>{concept.end}</em>
        </h1>
        <div className="h-intro-bottom">
          <div className="h-value-copy">
            <p>{concept.description}</p>
            {!exploration && (
              <p className="h-input-note">
                CSV/XLSX history: date + value, daily, weekly or monthly.
              </p>
            )}
          </div>
          <div className="h-intro-actions">
            <a href={exploration ? '#horizon-lab' : '#demo'} className="h-action">
              {exploration ? 'Explore scenarios' : 'Try interactive demo'}{' '}
              <span aria-hidden="true">↘</span>
            </a>
            {!exploration && (
              <a href="#horizon-lab" className="h-text-action">
                Explore scenarios ↓
              </a>
            )}
          </div>
          {!exploration && (
            <p className="h-preview-note">
              Synthetic public demo, not validated predictions. Imports and model jobs run in the
              authenticated development workspace.
            </p>
          )}
        </div>
      </div>
      <div className="h-stage" data-renderer={is3d ? 'webgl' : 'flat'}>
        <div className="h-stage-top">
          <span>SYNTHETIC SCENARIOS / NO PROBABILITIES ASSIGNED</span>
          <span>{is3d ? '3D STUDY / MOVE YOUR POINTER' : '2D STUDY / SAME DEMO VALUES'}</span>
        </div>
        <div
          className="h-canvas"
          ref={host}
          aria-hidden="true"
          style={{ visibility: is3d ? 'visible' : 'hidden' }}
        />
        {!is3d && (
          <div className="h-flat">
            <FlatView days={days} spread={spread} cursor={cursor} rangeVisible={rangeVisible} />
          </div>
        )}
        <div className="h-annotations" aria-hidden="true">
          <span>
            28 DAYS
            <br />
            <b>History, observed.</b>
          </span>
          <span className="h-present">
            THE PRESENT
            <br />
            <b>A point of departure.</b>
          </span>
          <span>
            {days} DAYS AHEAD
            <br />
            <b>Possibility, expanded.</b>
          </span>
        </div>
        <div className="h-scene-note">
          <span>
            <span>
              <i /> History
            </span>
            <span>
              <i /> Weekly-repeat mock
            </span>
            {rangeVisible && (
              <span>
                <i /> Scenarios
              </span>
            )}
          </span>
          <div className="h-scene-actions">
            <button
              onClick={() => {
                setReady(false);
                setPlaying(false);
                setFlat(!flat);
              }}
              disabled={failed}
              aria-pressed={flat || failed}
            >
              {is3d
                ? 'Use 2D view'
                : failed
                  ? '2D fallback active'
                  : flat
                    ? 'Enable 3D view'
                    : '3D loading · use 2D'}
            </button>
            <button
              type="button"
              aria-pressed={playing}
              disabled={!is3d || reduced === true}
              onClick={() => setPlaying(!playing)}
            >
              {playing ? 'Pause motion' : 'Play motion'}
            </button>
            <button
              type="button"
              disabled={!is3d || reduced === true}
              onClick={() => {
                setPlaying(false);
                setReplay(replay + 1);
              }}
            >
              Reset motion
            </button>
          </div>
        </div>
        <p className="h-depth-note">
          3D depth separates paths for viewing. It adds no data dimension or probability.
        </p>
      </div>
      <div id="horizon-lab" className="h-lab">
        <div className="h-lab-heading">
          <span className="h-small">TAKE THE CONTROLS</span>
          <h2>Explore the scenarios.</h2>
          <p>Adjust time and spread. Read the updated extent below.</p>
        </div>
        <label>
          <span>
            Time horizon <strong>{days} days</strong>
          </span>
          <input
            type="range"
            aria-label="Scenario horizon"
            min="7"
            max="28"
            value={days}
            onChange={(e) => {
              const next = Number(e.target.value);
              setDays(next);
              setCursor((value) => Math.min(value, next));
            }}
          />
          <small>
            7 days <span>28 days</span>
          </small>
        </label>
        <label>
          <span>
            Illustrative spread <strong>±{spread} units at day 28</strong>
          </span>
          <input
            type="range"
            aria-label="Illustrative spread"
            min="15"
            max="65"
            value={spread}
            onChange={(e) => setSpread(Number(e.target.value))}
          />
          <small>
            Narrower <span>Wider</span>
          </small>
        </label>
        <div className="h-readout" aria-live="polite">
          <span>DAY {days} · SYNTHETIC UNITS</span>
          <strong>
            {last.low.toFixed(0)} <i>—</i> {last.high.toFixed(0)}
          </strong>
          <small>Illustrative extent · not a confidence interval</small>
        </div>
        <div className="h-inspection">
          <div className="h-inspection-heading">
            <span className="h-small">Horizon instrument / synthetic sample</span>
            <span className="h-inspection-state">
              {is3d ? 'Cinematic study' : 'Analytical study'}
            </span>
          </div>
          <label className="h-scrub">
            <span>
              Inspect the timeline <strong>{inspected.date}</strong>
            </span>
            <input
              type="range"
              min="-27"
              max={days}
              value={Math.min(cursor, days)}
              aria-label="Inspect horizon timeline"
              aria-valuetext={`${inspected.date}, ${inspected.kind === 'history' ? 'historical sample' : 'illustrative scenario'}, ${inspected.value} units`}
              onChange={(e) => {
                setCursor(Number(e.target.value));
                setPlaying(false);
              }}
            />
            <small>
              Historical sample <span>Illustrative future</span>
            </small>
          </label>
          <output className="h-inspected-value" data-testid="horizon-inspection" aria-live="polite">
            <span>
              {inspected.kind === 'history' ? 'Historical sample' : 'Illustrative future'}
            </span>
            <strong>
              {inspected.value.toFixed(0)}{' '}
              <small>
                units /{' '}
                {inspected.kind === 'history' ? 'historical sample' : 'weekly-repeat centerline'}
              </small>
            </strong>
            <span>
              {inspected.low === null
                ? 'Observed sample value, not a prediction.'
                : `Illustrative extent ${inspected.low.toFixed(0)} to ${inspected.high!.toFixed(0)}. No probability assigned.`}
            </span>
          </output>
          <div className="h-motion-controls">
            <button
              type="button"
              aria-pressed={rangeVisible}
              onClick={() => setRangeVisible(!rangeVisible)}
            >
              {rangeVisible ? 'Hide illustrative range' : 'Show illustrative range'}
            </button>
          </div>
          <p className="h-motion-hint">
            Motion moves the viewpoint and decorative light traces, never the values.{' '}
            {reduced
              ? 'Reduced motion is active.'
              : is3d
                ? playing
                  ? 'Motion playing. Pause to inspect a still view.'
                  : 'Paused at rest. Animation runs only when you choose Play.'
                : 'Enable the optional 3D view to play motion.'}
          </p>
        </div>
        <p className="h-disclosure">
          Synthetic data · Sep–Oct 2026. The amber path repeats the last observed week. Mint paths
          are evenly spaced, hand-defined scenarios. The cone has no assigned probabilities,
          calibrated coverage or predictive validity.
        </p>
        <details className="h-data">
          <summary>Read the scenario values and method</summary>
          <p>
            For day d and scenario s from −1 to +1: weekly-repeat value + s × spread × d / 28. These
            are constructed examples, not model outputs. The 3D depth separates paths for viewing;
            it does not encode another measured variable.
          </p>
          <div
            className="h-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Scenario data table"
          >
            <table>
              <caption>
                Synthetic scenarios in units. The outer paths are not probability bounds.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Lower scenario</th>
                  <th scope="col">Weekly repeat</th>
                  <th scope="col">Upper scenario</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.day}>
                    <th scope="row">{r.date}</th>
                    <td>{r.low.toFixed(2)}</td>
                    <td>{r.center.toFixed(2)}</td>
                    <td>{r.high.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        {failed && (
          <p role="status">
            3D is unavailable in this browser. The 2D illustration, controls and data table remain
            available.
          </p>
        )}
      </div>
    </section>
  );
}
