'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Brand } from './brand';
import { useRouter } from 'next/navigation';
import { DataOnboarding } from './onboarding/DataOnboarding';
import { DatasetsView } from './workspace/DatasetsView';
import { JobsView } from './workspace/JobsView';
import { ResultsView } from './workspace/ResultsView';

import type { Dataset, Forecast } from '@/lib/forecast-result';
export type { Dataset, Forecast } from '@/lib/forecast-result';
import { ForecastControls } from './workspace/ForecastControls';
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
  const [resultId, setResultId] = useState(''),
    [horizon, setHorizon] = useState(14),
    [model, setModel] = useState('mock');
  const [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, startTransition] = useTransition(),
    [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'datasets' | 'jobs' | 'results'>('datasets');
  const [showCreate, setShowCreate] = useState(false),
    [showOnboarding, setShowOnboarding] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');

  const poll = useRef<AbortController | null>(null);
  const resultLoad = useRef<AbortController | null>(null);
  const activeWorkspace = useRef(wid);
  useEffect(
    () => () => {
      poll.current?.abort();
      resultLoad.current?.abort();
    },
    [],
  );

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
    activeWorkspace.current = wid;
    let active = true;
    api(`workspaces/${wid}`)
      .then((data) => {
        if (active) {
          setDatasets(data.datasets);
          setForecasts(data.forecasts);
          setSelected(data.datasets[0]?.id || '');
          const latest = data.forecasts.find(
            (f: Forecast) => f.dataset_id === data.datasets[0]?.id,
          );
          setModel(
            !latest || latest.result.mock
              ? 'mock'
              : latest?.result.model === 'timestral_209m'
                ? 'timestral_209m'
                : 'seasonal_naive',
          );
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
    poll.current?.abort();
    resultLoad.current?.abort();
    activeWorkspace.current = id;
    setResultId('');
    setActiveTab('datasets');
    setShowOnboarding(false);
    setLoading(true);
    setDatasets([]);
    setForecasts([]);
    setSelected('');
    setError('');
    setMessage('');
    setWid(id);
  }

  function selectTab(tab: 'datasets' | 'jobs' | 'results') {
    resultLoad.current?.abort();
    setActiveTab(tab);
  }

  async function refresh(signal?: AbortSignal) {
    const data = await api(`workspaces/${wid}`, undefined, signal);
    if (!signal?.aborted && activeWorkspace.current === wid) {
      setDatasets(data.datasets);
      setForecasts(data.forecasts);
    }
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
      setResultId('');
      setActiveTab('results');
    });
  }

  const dataset = datasets.find((d) => d.id === selected);
  const forecast =
    forecasts.find((f) => f.id === resultId && f.dataset_id === selected) ||
    forecasts.find((f) => f.dataset_id === selected);
  const selectedModel =
    dataset?.frequency !== 'daily' && dataset?.frequency && model === 'mock'
      ? 'seasonal_naive'
      : model;
  function generate() {
    if (!dataset) return;
    act(async () => {
      const controller = new AbortController();
      poll.current?.abort();
      poll.current = controller;
      if (selectedModel === 'mock') {
        const run = await api(
          `workspaces/${wid}/forecasts`,
          { datasetId: selected, horizon },
          controller.signal,
        );
        await refresh();
        setResultId(run.id);
        setMessage('Mock forecast ready. Illustrative only.');
      } else {
        const accepted = await api(
          'forecast-jobs',
          {
            contractVersion: '2',
            workspaceId: wid,
            datasetId: selected,
            horizon,
            model: selectedModel,
          },
          controller.signal,
        );
        setMessage('Job saved. You can monitor it in Jobs; computation continues if you leave.');
        for (let i = 0; i < 180; i++) {
          await new Promise<void>((resolve, reject) => {
            const stop = () => {
              clearTimeout(timer);
              reject(new DOMException('Aborted', 'AbortError'));
            };
            const timer = setTimeout(() => {
              controller.signal.removeEventListener('abort', stop);
              resolve();
            }, 1000);
            controller.signal.addEventListener('abort', stop, { once: true });
          });
          const job = await api(`forecast-jobs/${accepted.jobId}`, undefined, controller.signal);
          if (job.status === 'failed')
            throw new Error(job.error || 'Forecast failed. Check Jobs for details.');
          if (job.status === 'completed') {
            await refresh();
            setResultId(job.result_id);
            setMessage('Model forecast ready. Review its historical evaluation and limitations.');
            return;
          }
        }
        setMessage('Still computing. Follow this saved run in Jobs.');
      }
    });
  }

  return (
    <div className="workspace-page">
      <header className="workspace-nav">
        <Brand />
        <span className="preview-label">
          THE FOREWISE WORKSPACE <span>/</span> PHASE 03B
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
              disabled={busy || loading}
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
              onClick={() => selectTab('datasets')}
            >
              <span>01</span> Datasets <b>{datasets.length}</b>
            </button>
            <button
              className={`text-button ${activeTab === 'jobs' ? 'selected' : ''}`}
              onClick={() => selectTab('jobs')}
            >
              <span>02</span> Jobs
            </button>
            <button
              className={`text-button ${activeTab === 'results' ? 'selected' : ''} ${!dataset ? 'disabled' : ''}`}
              onClick={() => selectTab('results')}
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

          {error || message ? (
            <p
              id="workspace-feedback"
              tabIndex={-1}
              className={error ? 'error' : 'success'}
              role={error ? 'alert' : 'status'}
            >
              {error || message}
            </p>
          ) : null}
          <div className="workspace-content">
            {activeTab === 'datasets' ? (
              <DatasetsView
                datasets={datasets}
                selected={selected}
                onSelect={(id) => {
                  setSelected(id);
                  setResultId('');
                  setActiveTab('results');
                }}
                onImport={() => setShowOnboarding(true)}
                onSample={() => upload(sample, 'Synthetic daily sample', 'daily')}
                loading={loading}
                busy={busy}
              />
            ) : null}
            {activeTab === 'jobs' ? (
              <JobsView
                key={wid}
                wid={wid}
                onViewResult={async (datasetId, forecastId, jobId) => {
                  resultLoad.current?.abort();
                  const controller = new AbortController();
                  resultLoad.current = controller;
                  try {
                    const data = await refresh(controller.signal);
                    const job = await api(`forecast-jobs/${jobId}`, undefined, controller.signal);
                    if (controller.signal.aborted || activeWorkspace.current !== wid) return;
                    if (
                      job.status !== 'completed' ||
                      job.result_id !== forecastId ||
                      job.dataset_id !== datasetId
                    )
                      throw new Error('This job has no completed result.');
                    const saved: Forecast = {
                      id: job.result_id,
                      dataset_id: job.dataset_id,
                      horizon: job.horizon,
                      created_at: job.forecastCreatedAt,
                      result: job.result,
                    };
                    setForecasts([
                      saved,
                      ...data.forecasts.filter((f: Forecast) => f.id !== saved.id),
                    ]);
                    setSelected(datasetId);
                    setResultId(forecastId);
                    setActiveTab('results');
                    setModel(
                      saved.result.mock
                        ? 'mock'
                        : saved.result.model === 'timestral_209m'
                          ? 'timestral_209m'
                          : 'seasonal_naive',
                    );
                  } catch (e) {
                    if (controller.signal.aborted) return;
                    throw e;
                  }
                }}
                busy={busy}
              />
            ) : null}
            {activeTab === 'results' ? (
              <>
                <ForecastControls
                  datasets={datasets}
                  selected={selected}
                  onSelect={(id) => {
                    setSelected(id);
                    setResultId('');
                  }}
                  horizon={horizon}
                  onHorizon={setHorizon}
                  model={selectedModel}
                  onModel={setModel}
                  busy={busy}
                  loading={loading}
                  onGenerate={generate}
                />
                <ResultsView
                  key={`${selected}-${forecast?.id || 'history'}`}
                  wid={wid}
                  dataset={dataset}
                  forecast={forecast}
                  forecasts={forecasts}
                  onResult={(id) => {
                    setResultId(id);
                    const run = forecasts.find((f) => f.id === id);
                    if (run)
                      setModel(
                        run.result.mock
                          ? 'mock'
                          : run.result.model === 'timestral_209m'
                            ? 'timestral_209m'
                            : 'seasonal_naive',
                      );
                  }}
                  loading={loading}
                />
              </>
            ) : null}
          </div>

          <footer className="workspace-footer">
            <span>Forewise / Phase 03B · Local inference</span>
            <span>Past observed. Next explored.</span>
          </footer>
        </main>
      </div>
      {showOnboarding && (
        <DataOnboarding
          wid={wid}
          onSuccess={async (id) => {
            await refresh();
            setSelected(id);
            setResultId('');
            setActiveTab('results');
            setMessage('Dataset saved. Choose a model and horizon.');
          }}
          onCancel={() => setShowOnboarding(false)}
        />
      )}
    </div>
  );
}
