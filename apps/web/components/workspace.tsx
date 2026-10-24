'use client';
import { useEffect, useState, useTransition } from 'react';
import { Brand } from './brand';
import { useRouter } from 'next/navigation';
import { Chart } from './chart';
import type { Point } from '@/lib/csv';
type Dataset = { id: string; name: string; row_count: number; points: Point[] };
type Forecast = {
  id: string;
  dataset_id: string;
  horizon: number;
  result: { mock: boolean; model: string; points: Point[]; notice: string };
};
type Account = {
  user: { name: string; email: string };
  workspaces: { id: string; name: string }[];
};
const sample =
  'date,value\n' +
  Array.from(
    { length: 28 },
    (_, i) =>
      `2026-09-${String(i + 1).padStart(2, '0')},${Math.round(100 + i * 2 + Math.sin(i) * 12)}`,
  ).join('\n');
async function api(path: string, body?: unknown) {
  const res = await fetch(
    '/api/' + path,
    body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Please try again.');
  return data;
}
export function Workspace() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null),
    [wid, setWid] = useState('');
  const [datasets, setDatasets] = useState<Dataset[]>([]),
    [forecasts, setForecasts] = useState<Forecast[]>([]),
    [selected, setSelected] = useState('');
  const [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, startTransition] = useTransition(),
    [loading, setLoading] = useState(true);
  const [horizon, setHorizon] = useState(14),
    [workspaceName, setWorkspaceName] = useState(''),
    [showCreate, setShowCreate] = useState(false);
  useEffect(() => {
    let active = true;
    api('session')
      .then((data) => {
        if (active) {
          setAccount(data);
          setWid(data.workspaces[0]?.id || '');
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!wid) return;
    let active = true;
    api(`workspaces/${wid}`)
      .then((data) => {
        if (active) {
          setDatasets(data.datasets);
          setForecasts(data.forecasts);
          setSelected(data.datasets[0]?.id || '');
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [wid]);
  function selectWorkspace(id: string) {
    if (id === wid) return;
    setLoading(true);
    setDatasets([]);
    setForecasts([]);
    setSelected('');
    setError('');
    setMessage('');
    setWid(id);
  }
  async function refresh() {
    const data = await api(`workspaces/${wid}`);
    setDatasets(data.datasets);
    setForecasts(data.forecasts);
    return data;
  }
  function act(fn: () => Promise<void>) {
    setError('');
    setMessage('');
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.');
        requestAnimationFrame(() => document.getElementById('workspace-feedback')?.focus());
      }
    });
  }
  function upload(csv: string, name: string) {
    act(async () => {
      const data = await api(`workspaces/${wid}/datasets`, { csv, name });
      await refresh();
      setSelected(data.id);
      setMessage('Dataset uploaded. Ready when you are.');
    });
  }
  const dataset = datasets.find((d) => d.id === selected),
    forecast = forecasts.find((f) => f.dataset_id === selected);
  const sampleButton = (
    <button
      className="button primary"
      disabled={busy || loading || !wid}
      onClick={() => upload(sample, 'Sample daily demand.csv')}
    >
      Try sample data <span aria-hidden="true">↗</span>
    </button>
  );
  return (
    <div className="workspace-page">
      <header className="workspace-nav">
        <Brand />
        <span className="preview-label">
          THE FOREWISE WORKSPACE <span>/</span> PHASE 01
        </span>
        <button
          className="text-button"
          disabled={busy}
          onClick={() =>
            act(async () => {
              await api('auth/logout', {});
              router.push('/login');
              router.refresh();
            })
          }
        >
          Sign out <span aria-hidden="true">↗</span>
        </button>
      </header>
      <div className="workspace-layout">
        <aside className="workspace-sidebar">
          <div className="workspace-switcher">
            <p className="overline">YOUR WORKSPACE</p>
            <label className="sr-only" htmlFor="workspace-select">
              Workspace
            </label>
            <select
              id="workspace-select"
              value={wid}
              disabled={busy}
              onChange={(e) => selectWorkspace(e.target.value)}
            >
              {account?.workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <button
              className="text-button new-workspace"
              aria-expanded={showCreate}
              onClick={() => setShowCreate(!showCreate)}
            >
              + New workspace
            </button>
          </div>
          {showCreate ? (
            <form
              className="create-workspace"
              onSubmit={(e) => {
                e.preventDefault();
                act(async () => {
                  const w = await api('workspaces', { name: workspaceName });
                  setAccount((prev) =>
                    prev ? { ...prev, workspaces: [...prev.workspaces, w] } : prev,
                  );
                  selectWorkspace(w.id);
                  setWorkspaceName('');
                  setShowCreate(false);
                });
              }}
            >
              <label>
                Workspace name
                <input
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  maxLength={80}
                  required
                />
              </label>
              <button className="button primary" disabled={busy}>
                Create
              </button>
            </form>
          ) : null}
          <nav className="workspace-anchor-nav" aria-label="Workspace sections">
            <a href="#overview">
              <span>01</span> Overview
            </a>
            <a href="#datasets">
              <span>02</span> Datasets <b>{datasets.length}</b>
            </a>
            <a href="#forecast">
              <span>03</span> Forecast <b>{forecasts.length}</b>
            </a>
          </nav>
          <div className="sidebar-note">
            <span className="overline">
              PAST OBSERVED.
              <br />
              NEXT EXPLORED.
            </span>
            <p>Your data stays in this local preview. Every forecast is labeled mock.</p>
          </div>
          <div className="profile">
            <span className="avatar" aria-hidden="true">
              {account?.user.name.slice(0, 2).toUpperCase() || '…'}
            </span>
            <div>
              <strong>{account?.user.name || 'Loading…'}</strong>
              <small title={account?.user.email}>{account?.user.email}</small>
            </div>
          </div>
        </aside>
        <main id="main" className="workspace-main">
          <section id="overview" className="workspace-heading">
            <div>
              <p className="overline">A LITTLE HISTORY. A VIEW AHEAD.</p>
              <h1>
                A clearer view ahead<span className="accent">.</span>
              </h1>
              <p>
                {loading
                  ? 'Opening your workspace…'
                  : `${datasets.length} dataset${datasets.length === 1 ? '' : 's'} · ${forecasts.length} recent mock run${forecasts.length === 1 ? '' : 's'}`}
              </p>
            </div>
            <span className="badge">MOCK WORKSPACE</span>
          </section>
          <div className="notice">
            <span className="notice-mark" aria-hidden="true">
              ↗
            </span>
            <p>
              <strong>A working preview, with honest limits.</strong> Forecasts repeat the last
              observed week. No validated predictions or confidence intervals.
            </p>
          </div>
          <div className="workspace-columns">
            <section className="panel result-panel" id="forecast" aria-label="Forecast result">
              <div className="result-heading" id="forecast-result">
                <div>
                  <p className="overline">01 / YOUR VIEW AHEAD</p>
                  <h2>{dataset ? dataset.name : 'Your first forecast.'}</h2>
                  <p>
                    {dataset
                      ? `${dataset.row_count} daily observations${forecast ? ` · ${forecast.horizon}-day mock forecast` : ' · Historical data'}`
                      : 'Start with our sample, or upload your own daily CSV.'}
                  </p>
                </div>
                {forecast ? (
                  <button
                    className="button subtle"
                    onClick={() => {
                      const csv =
                        'date,value\n' +
                        forecast.result.points.map((p) => `${p.date},${p.value}`).join('\n');
                      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'forewise-mock-forecast.csv';
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }}
                  >
                    Export mock CSV <span aria-hidden="true">↓</span>
                  </button>
                ) : null}
              </div>
              {loading ? (
                <div className="loading-state" aria-busy="true">
                  <div className="skeleton-line" />
                  <div className="skeleton-plot" />
                  <p>Loading your workspace…</p>
                </div>
              ) : dataset ? (
                <>
                  <Chart
                    key={dataset.id}
                    history={dataset.points}
                    future={forecast?.result.points || []}
                    label="Selected dataset history and mock forecast"
                    caption="Daily observations"
                  />
                  {forecast ? (
                    <p className="result-notice">{forecast.result.notice}</p>
                  ) : (
                    <p className="result-notice">
                      History is ready. Choose a horizon below to generate a mock forecast.
                    </p>
                  )}
                </>
              ) : (
                <div className="empty-chart">
                  <svg viewBox="0 0 700 150" aria-hidden="true">
                    <path
                      d="M0 120H700M0 60H700M120 0V150M350 0V150M580 0V150"
                      fill="none"
                      stroke="var(--line)"
                    />
                    <path
                      d="M40 110L120 90L190 105L260 65L350 75"
                      fill="none"
                      stroke="var(--ink)"
                      strokeWidth="2"
                    />
                    <path
                      d="M350 75L430 55L490 70L560 35L650 45"
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="2"
                      strokeDasharray="5 6"
                    />
                  </svg>
                  <span className="overline">YOUR FIRST FORECAST STARTS HERE</span>
                  <h3>Start with a working example.</h3>
                  <p>
                    Try 28 days of synthetic demand data.
                    <br />
                    No file to prepare. Nothing to connect.
                  </p>
                  {sampleButton}
                </div>
              )}
              {error ? (
                <p className="error" id="workspace-feedback" role="alert" tabIndex={-1}>
                  {error}
                </p>
              ) : null}
              {message ? (
                <p className="success" role="status">
                  {message}
                </p>
              ) : null}
              <form
                className="forecast-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  act(async () => {
                    await api(`workspaces/${wid}/forecasts`, { datasetId: selected, horizon });
                    await refresh();
                    setMessage('Mock forecast ready. Explore it above.');
                    requestAnimationFrame(() =>
                      document.getElementById('forecast-result')?.scrollIntoView({
                        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
                          ? 'instant'
                          : 'smooth',
                        block: 'start',
                      }),
                    );
                  });
                }}
              >
                <label>
                  Dataset
                  <select
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    disabled={busy || loading || !datasets.length}
                    required
                  >
                    <option value="" disabled>
                      Choose a dataset
                    </option>
                    {datasets.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Forecast horizon <span className="muted">(days)</span>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={horizon}
                    onChange={(e) => setHorizon(Number(e.target.value))}
                    required
                  />
                </label>
                <button className="button primary" disabled={busy || loading || !selected}>
                  {busy ? 'Generating mock…' : 'Generate mock forecast ↗'}
                </button>
              </form>
              <p className="form-note">
                Weekly repeat mock / 1–90 days / No model credits or billing.
              </p>
            </section>
            <aside className="panel data-panel" id="datasets" aria-label="Dataset setup">
              <div className="panel-heading">
                <p className="overline">02 / THE STARTING POINT</p>
                <h2>Bring your history.</h2>
                <p>
                  A daily date and a value. <br />
                  That’s enough to begin.
                </p>
              </div>
              <div className="upload-zone">
                <span className="upload-symbol" aria-hidden="true">
                  ↥
                </span>
                <strong>Upload a CSV</strong>
                <p>
                  date,value · 8–5,000 daily rows
                  <br />
                  Up to 1 MB · Consecutive dates
                </p>
                <label className="button subtle file-button">
                  Choose a CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    aria-label="Choose a CSV"
                    disabled={busy || loading || !wid}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      if (file.size > 1_000_000) {
                        setError('CSV must be smaller than 1 MB.');
                        return;
                      }
                      try {
                        upload(await file.text(), file.name);
                      } catch {
                        setError('Unable to read this file. Please choose it again.');
                      }
                    }}
                  />
                </label>
              </div>
              {dataset ? (
                <div className="sample-again">
                  {sampleButton}
                  <span className="micro">Adds synthetic data to this workspace.</span>
                </div>
              ) : null}
              <details className="csv-help">
                <summary>What should my CSV look like?</summary>
                <pre>
                  date,value{'\n'}2026-09-01,104{'\n'}2026-09-02,112{'\n'}…
                </pre>
                <p>At least 8 rows. One value per day, with no missing days or duplicates.</p>
              </details>
              <div className="dataset-list" aria-busy={loading}>
                <h3>
                  Your datasets <span>{datasets.length}</span>
                </h3>
                {loading ? (
                  <p className="muted">Loading datasets…</p>
                ) : datasets.length ? (
                  datasets.map((d) => (
                    <button
                      key={d.id}
                      className={`dataset-row ${selected === d.id ? 'selected' : ''}`}
                      aria-pressed={selected === d.id}
                      onClick={() => setSelected(d.id)}
                      disabled={busy}
                    >
                      <span>
                        <strong>{d.name}</strong>
                        <small>{d.row_count} daily observations</small>
                      </span>
                      <span aria-hidden="true">{selected === d.id ? '↗' : '→'}</span>
                    </button>
                  ))
                ) : (
                  <p className="empty">Your uploaded datasets will be listed here.</p>
                )}
              </div>
            </aside>
          </div>
          <footer className="workspace-footer">
            <span>Forewise / Phase 01</span>
            <span>Past observed. Next explored.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
