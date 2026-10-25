'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Brand } from './brand';
import { useRouter } from 'next/navigation';
import { DataOnboarding } from './onboarding/DataOnboarding';
import { DatasetsView } from './workspace/DatasetsView';
import { JobsView } from './workspace/JobsView';
import { ResultsView } from './workspace/ResultsView';
import type { Point } from '@/lib/csv';

export type Dataset = { id: string; name: string; row_count: number; points: Point[]; frequency?: string };
export type Forecast = {
  id: string;
  dataset_id: string;
  horizon: number;
  result: {
    mock: boolean;
    model: string;
    points: Point[];
    notice: string;
    quantiles?: { p10: Point[]; p50: Point[]; p90: Point[] } | null;
    metrics?: { mae: number; rmse: number; wape?: number | null; coverage_p10_p90?: number } | null;
    evaluation?: {
      windows: number;
      evaluated_points: number;
      baseline_metrics?: { mae: number; rmse: number } | null;
      baseline_season_length?: number;
    };
    performance?: { device: string; inference_seconds: number };
    warnings?: string[];
  };
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

async function api(path: string, body?: unknown, signal?: AbortSignal) {
  const res = await fetch(
    '/api/' + path,
    body === undefined
      ? { signal }
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal,
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
  const [activeTab, setActiveTab] = useState<'datasets' | 'jobs' | 'results'>('datasets');
  const [showCreate, setShowCreate] = useState(false),
    [showOnboarding, setShowOnboarding] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');

  const poll = useRef<AbortController | null>(null);
  useEffect(() => () => poll.current?.abort(), []);

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
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : 'Something went wrong.');
        requestAnimationFrame(() => document.getElementById('workspace-feedback')?.focus());
      }
    });
  }

  function upload(csv: string, name: string, inputFrequency = 'daily') {
    act(async () => {
      const data = await api(`workspaces/${wid}/datasets`, {
        csv,
        name,
        frequency: inputFrequency,
      });
      await refresh();
      setSelected(data.id);
      setMessage('Dataset uploaded. Ready when you are.');
    });
  }

  const dataset = datasets.find((d) => d.id === selected);
  const forecast = forecasts.find((f) => f.dataset_id === selected);

  return (
    <div className="workspace-page">
      <header className="workspace-nav">
        <Brand />
        <span className="preview-label">
          THE FOREWISE WORKSPACE <span>/</span> PHASE 02B
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
            <button
              className={`text-button ${activeTab === 'datasets' ? 'selected' : ''}`}
              onClick={() => setActiveTab('datasets')}
            >
              <span>01</span> Datasets <b>{datasets.length}</b>
            </button>
            <button
              className={`text-button ${activeTab === 'jobs' ? 'selected' : ''}`}
              onClick={() => setActiveTab('jobs')}
            >
              <span>02</span> Jobs
            </button>
            <button
              className={`text-button ${activeTab === 'results' ? 'selected' : ''} ${!dataset ? 'disabled' : ''}`}
              onClick={() => setActiveTab('results')}
              disabled={!dataset}
            >
              <span>03</span> Results <b>{forecasts.length}</b>
            </button>
          </nav>
          <div className="sidebar-note">
            <span className="overline">
              PAST OBSERVED.
              <br />
              NEXT EXPLORED.
            </span>
            <p>
              Your data stays local. Model identity and forecast limits are shown with every result.
            </p>
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
          <section className="workspace-heading">
            <div>
              <p className="overline">A LITTLE HISTORY. A VIEW AHEAD.</p>
              <h1>
                A clearer view ahead<span className="accent">.</span>
              </h1>
              <p>
                {loading
                  ? 'Opening your workspace…'
                  : `${datasets.length} dataset${datasets.length === 1 ? '' : 's'} · ${forecasts.length} recent forecast run${forecasts.length === 1 ? '' : 's'}`}
              </p>
            </div>
            <span className="badge">LOCAL FORECASTING</span>
          </section>

          <div className="notice">
            <span className="notice-mark" aria-hidden="true">
              ↗
            </span>
            <p>
              <strong>A working preview, with honest limits.</strong> Choose a statistical baseline
              or Timestral 209M. Historical evaluation does not guarantee future accuracy. The
              marketing demo remains synthetic.
            </p>
          </div>

          <div className="workspace-content">
            {activeTab === 'datasets' && (
              <DatasetsView
                datasets={datasets}
                selected={selected}
                setSelected={setSelected}
                onUpload={upload}
                showOnboarding={showOnboarding}
                setShowOnboarding={setShowOnboarding}
                loading={loading}
                busy={busy}
              />
            )}
            {activeTab === 'jobs' && (
              <JobsView
                wid={wid}
                onViewResult={(id) => {
                  setSelected(id);
                  setActiveTab('results');
                }}
                busy={busy}
              />
            )}
            {activeTab === 'results' && (
              <ResultsView
                dataset={dataset}
                forecast={forecast}
                loading={loading}
              />
            )}
          </div>

          <footer className="workspace-footer">
            <span>Forewise / Phase 02B · Local inference</span>
            <span>Past observed. Next explored.</span>
          </footer>
        </main>
      </div>
      {showOnboarding && (
        <DataOnboarding
          onSuccess={(data) => {
            upload(data.csv, data.name, data.frequency);
            setShowOnboarding(false);
          }}
          onCancel={() => setShowOnboarding(false)}
        />
      )}
    </div>
  );
}
