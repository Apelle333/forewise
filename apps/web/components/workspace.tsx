'use client';
import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
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
  return (
    <div className="workspace-page">
      <header className="workspace-nav">
        <Link className="brand" href="/">
          <span className="brand-icon">f</span>forewise.
        </Link>
        <span className="preview-label">PHASE 01 / PRIVATE PREVIEW</span>
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
          Sign out ↗
        </button>
      </header>
      <div className="workspace-layout">
        <aside className="workspace-sidebar">
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
          <button className="text-button new-workspace" onClick={() => setShowCreate(!showCreate)}>
            + New workspace
          </button>
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
              <button className="button subtle" disabled={busy}>
                Create
              </button>
            </form>
          ) : null}
          <a className="active-sidebar" href="#overview">
            ◫ Overview
          </a>
          <a href="#datasets">
            ▤ Datasets <span>{datasets.length}</span>
          </a>
          <a href="#forecast">
            ↗ Forecasts <span>{forecasts.length}</span>
          </a>
          <div className="sidebar-note">
            <span className="live-dot" /> A safe place to explore
            <p>Forecasts in this preview are mock outputs, not business advice.</p>
          </div>
          <div className="profile">
            <span className="avatar">{account?.user.name.slice(0, 2).toUpperCase() || '…'}</span>
            <div>
              <strong>{account?.user.name || 'Loading…'}</strong>
              <small>{account?.user.email}</small>
            </div>
          </div>
        </aside>
        <main id="main" className="workspace-main">
          <section id="overview">
            <div className="workspace-heading">
              <div>
                <p className="overline">YOUR NEXT MOVE STARTS HERE</p>
                <h1>
                  A clearer view ahead<span className="green">.</span>
                </h1>
                <p>Bring your data. Explore what could come next.</p>
              </div>
              <span className="small-badge">MOCK MODE</span>
            </div>
            <div className="notice">
              <span>◈</span>
              <div>
                <strong>You’re exploring the Phase 01 preview.</strong>
                <p>
                  Upload a daily CSV and test the workflow. Forecasts repeat the last observed week;
                  they are not validated predictions.
                </p>
              </div>
            </div>
            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="success" role="status">
                {message}
              </p>
            ) : null}
            <div className="stat-grid">
              <article>
                <span>Datasets</span>
                <strong>{datasets.length.toString().padStart(2, '0')}</strong>
                <small>In this workspace</small>
              </article>
              <article>
                <span>Forecast runs</span>
                <strong>{forecasts.length.toString().padStart(2, '0')}</strong>
                <small>Showing up to 20 recent runs</small>
              </article>
              <article>
                <span>Your horizon</span>
                <strong>
                  {horizon} <em>days</em>
                </strong>
                <small>A little further ahead</small>
              </article>
            </div>
          </section>
          <div className="workspace-columns">
            <section className="panel" id="datasets">
              <div className="panel-heading">
                <span className="overline">01 / BRING YOUR DATA</span>
                <h2>Start with a simple CSV.</h2>
                <p>Two columns. One observation per day.</p>
              </div>
              <div className="upload-zone">
                <span className="upload-icon">↥</span>
                <strong>A little data. A lot of possibility.</strong>
                <p>date,value · 8–5,000 rows · Up to 1 MB</p>
                <label className="button subtle file-button">
                  Choose a CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
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
                <button
                  className="text-button"
                  disabled={busy || loading || !wid}
                  onClick={() => upload(sample, 'Sample daily demand.csv')}
                >
                  Or try sample data ↗
                </button>
              </div>
              <div className="dataset-list" aria-busy={loading}>
                <h3>Your datasets</h3>
                {loading ? (
                  <p className="muted">Loading your workspace…</p>
                ) : datasets.length ? (
                  datasets.map((d) => (
                    <button
                      key={d.id}
                      className={`dataset-row ${selected === d.id ? 'selected' : ''}`}
                      onClick={() => setSelected(d.id)}
                      disabled={busy}
                    >
                      <span>▤</span>
                      <span>
                        <strong>{d.name}</strong>
                        <small>{d.row_count} daily observations</small>
                      </span>
                      <span>{selected === d.id ? '✓' : '→'}</span>
                    </button>
                  ))
                ) : (
                  <p className="empty">A fresh start. Your first dataset will appear here.</p>
                )}
              </div>
            </section>
            <section className="panel" id="forecast">
              <div className="panel-heading">
                <span className="overline">02 / LOOK A LITTLE FURTHER</span>
                <h2>Set your perspective.</h2>
                <p>Choose a dataset and a forecast horizon.</p>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  act(async () => {
                    await api(`workspaces/${wid}/forecasts`, { datasetId: selected, horizon });
                    await refresh();
                    setMessage('Mock forecast ready. Explore it below.');
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
                <div className="model-card">
                  <span>◈</span>
                  <div>
                    <strong>Weekly repeat · Mock</strong>
                    <p>
                      Repeats the last 7 observations. No confidence intervals or accuracy claims.
                    </p>
                  </div>
                </div>
                <button className="button primary full" disabled={busy || loading || !selected}>
                  {busy ? 'Working…' : 'Generate mock forecast ↗'}
                </button>
                <p className="micro">No model credits. No external AI calls. No billing.</p>
              </form>
            </section>
          </div>
          <section className="panel result-panel" aria-label="Forecast result">
            <div className="result-heading">
              <div>
                <span className="overline">03 / YOUR NEXT CHAPTER</span>
                <h2>{forecast ? 'A direction to explore.' : 'Your forecast, in view.'}</h2>
                <p>
                  {forecast
                    ? `${dataset?.name} · ${forecast.horizon} days ahead · Mock output`
                    : 'Your history and mock forecast will appear here.'}
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
                  Export mock CSV ↓
                </button>
              ) : null}
            </div>
            {dataset ? (
              <>
                <Chart
                  history={dataset.points}
                  future={forecast?.result.points || []}
                  label="Selected dataset history and mock forecast"
                />
                {forecast ? (
                  <p className="result-notice">{forecast.result.notice}</p>
                ) : (
                  <p className="empty">History loaded. Generate your first mock forecast above.</p>
                )}
              </>
            ) : (
              <div className="empty-chart">
                <span>↗</span>
                <p>Every clear decision starts with a little perspective.</p>
              </div>
            )}
          </section>
          <footer className="workspace-footer">
            Forewise · Phase 01 <span>One workspace. A little less uncertainty.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
