'use client';
import { useEffect, useRef, useState } from 'react';
import { horizonHistory, scenarioRows, type Direction } from '@/lib/horizon-data';
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

function FlatView({ days, spread }: { days: number; spread: number }) {
  const rows = scenarioRows(days, spread);
  const x = (day: number) => 60 + ((day + 27) / 55) * 880;
  const y = (value: number) => 350 - ((value - 60) / 190) * 290;
  const history = horizonHistory.map((value, i) => `${x(i - 27)},${y(value)}`).join(' ');
  const points = (key: 'low' | 'high' | 'center') =>
    `${x(0)},${y(161)} ` + rows.map((r) => `${x(r.day)},${y(r[key])}`).join(' ');
  return (
    <svg
      viewBox="0 0 1000 420"
      role="img"
      aria-label="Two-dimensional synthetic scenarios. White is history, amber is the weekly-repeat mock, mint outlines the illustrative range. No probability is assigned."
    >
      {[100, 150, 200].map((v) => (
        <g key={v}>
          <line x1="60" x2="940" y1={y(v)} y2={y(v)} stroke="currentColor" opacity=".15" />
          <text x="45" y={y(v) + 4} textAnchor="end" fill="currentColor" fontSize="13">
            {v}
          </text>
        </g>
      ))}
      <polygon
        points={`${points('high')} ${[...rows]
          .reverse()
          .map((r) => `${x(r.day)},${y(r.low)}`)
          .join(' ')} ${x(0)},${y(161)}`}
        fill="#8cf1cf"
        opacity=".08"
      />
      <polyline points={history} fill="none" stroke="#e2f5ef" strokeWidth="2" />
      <polyline points={points('high')} fill="none" stroke="#8cf1cf" strokeWidth="1.5" />
      <polyline points={points('low')} fill="none" stroke="#8cf1cf" strokeWidth="1.5" />
      <polyline
        points={points('center')}
        fill="none"
        stroke="#f5b577"
        strokeWidth="2"
        strokeDasharray="5 5"
      />
      <line x1={x(0)} x2={x(0)} y1="35" y2="360" stroke="#f5b577" opacity=".4" />
      <text x="60" y="395" fill="currentColor" fontSize="13">
        Sep 01 · history
      </text>
      <text x={x(0) + 8} y="32" fill="#f5b577" fontSize="13">
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
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<ReturnType<typeof mountHorizon> | null>(null);
  const settings = useRef({ days, spread, direction, reduced: reduced ?? true });
  const concept = concepts[direction],
    rows = scenarioRows(days, spread),
    last = rows.at(-1)!;

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setReduced(media.matches);
      if (media.matches) setFlat(true);
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    settings.current = { days, spread, direction, reduced: reduced ?? true };
    engine.current?.update(settings.current);
  }, [days, spread, direction, reduced]);
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
              <p className="h-input-note">Designed for daily CSV data: date + value.</p>
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
              Synthetic examples, not validated predictions. Uploads and live forecasting are
              unavailable in this preview.
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
            <FlatView days={days} spread={spread} />
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
            <span>
              <i /> Scenarios
            </span>
          </span>
          <button
            onClick={() => {
              setReady(false);
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
            onChange={(e) => setDays(Number(e.target.value))}
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
