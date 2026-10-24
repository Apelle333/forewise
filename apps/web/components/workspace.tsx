'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Brand } from './brand';
import { useRouter } from 'next/navigation';
import { Chart } from './chart';
import type { Point } from '@/lib/csv';
type Dataset = { id: string; name: string; row_count: number; points: Point[]; frequency?: string };
type Forecast = {
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
  const [horizon, setHorizon] = useState(14),
    [workspaceName, setWorkspaceName] = useState(''),
    [showCreate, setShowCreate] = useState(false);
  const [model, setModel] = useState('mock');
  const [frequency, setFrequency] = useState('daily');
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
  function upload(csv: string, name: string, inputFrequency = frequency) {
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
  const dataset = datasets.find((d) => d.id === selected),
    forecast = forecasts.find((f) => f.dataset_id === selected);
  const selectedModel =
    model === 'mock' && dataset?.frequency && dataset.frequency !== 'daily'
      ? forecast?.result.model === 'timestral_209m'
        ? 'timestral_209m'
        : 'seasonal_naive'
      : model;
  const sampleButton = (
    <button
      className="button primary"
      disabled={busy || loading || !wid}
      onClick={() => upload(sample, 'Sample daily demand.csv', 'daily')}
    >
      Try sample data <span aria-hidden="true">↗</span>
    </button>
  );
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
          <section id="overview" className="workspace-heading">
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
          <div className="workspace-columns">
            <section className="panel result-panel" id="forecast" aria-label="Forecast result">
              <div className="result-heading" id="forecast-result">
                <div>
                  <p className="overline">01 / YOUR VIEW AHEAD</p>
                  <h2>{dataset ? dataset.name : 'Your first forecast.'}</h2>
                  <p>
                    {dataset
                      ? `${dataset.row_count} ${dataset.frequency || 'daily'} observations${forecast ? ` · ${forecast.horizon}-step ${forecast.result.mock ? 'mock' : 'model'} forecast` : ' · Historical data'}`
                      : 'Start with our sample, or upload your own CSV.'}
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
                      a.download = forecast.result.mock
                        ? 'forewise-mock-forecast.csv'
                        : 'forewise-model-forecast.csv';
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }}
                  >
                    {forecast.result.mock ? 'Export mock CSV' : 'Export forecast CSV'}{' '}
                    <span aria-hidden="true">↓</span>
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
                    label={
                      forecast?.result.mock === false
                        ? 'Selected dataset history and model forecast'
                        : 'Selected dataset history and mock forecast'
                    }
                    caption={
                      forecast && !forecast.result.mock
                        ? forecast.result.model === 'timestral_209m'
                          ? 'Timestral 209M · median and P10–P90'
                          : 'SeasonalNaive baseline'
                        : 'Daily observations'
                    }
                    futureKind={forecast?.result.mock === false ? 'forecast' : 'mock'}
                    quantiles={forecast?.result.quantiles}
                  />
                  {forecast ? (
                    <>
                      <p className="result-notice">{forecast.result.notice}</p>
                      {!forecast.result.mock ? (
                        <div className="forecast-details" data-testid="model-result">
                          <p>
                            <strong>
                              Model:{' '}
                              {forecast.result.model === 'timestral_209m'
                                ? 'Timestral 209M'
                                : 'SeasonalNaive'}
                            </strong>
                            {forecast.result.performance
                              ? ` · ${forecast.result.performance.device.toUpperCase()} · ${forecast.result.performance.inference_seconds.toFixed(3)}s inference`
                              : ''}
                          </p>
                          <p>
                            Historical backtest: {forecast.result.evaluation?.windows || 0} windows
                            · {forecast.result.evaluation?.evaluated_points || 0} evaluated points.
                          </p>
                          {forecast.result.metrics ? (
                            <dl className="forecast-metrics">
                              <div>
                                <dt>MAE</dt>
                                <dd>{forecast.result.metrics.mae.toFixed(2)}</dd>
                              </div>
                              <div>
                                <dt>RMSE</dt>
                                <dd>{forecast.result.metrics.rmse.toFixed(2)}</dd>
                              </div>
                              {forecast.result.evaluation?.baseline_metrics ? (
                                <div>
                                  <dt>
                                    Baseline MAE
                                    {forecast.result.evaluation.baseline_season_length
                                      ? ` (period ${forecast.result.evaluation.baseline_season_length})`
                                      : ''}
                                  </dt>
                                  <dd>
                                    {forecast.result.evaluation.baseline_metrics.mae.toFixed(2)}
                                  </dd>
                                </div>
                              ) : null}
                              {forecast.result.metrics.coverage_p10_p90 !== undefined ? (
                                <div>
                                  <dt>Historical interval coverage</dt>
                                  <dd>
                                    {(forecast.result.metrics.coverage_p10_p90 * 100).toFixed(1)}%
                                  </dd>
                                </div>
                              ) : null}
                            </dl>
                          ) : (
                            <p>
                              Not enough history for this backtest horizon. No accuracy metrics are
                              fabricated.
                            </p>
                          )}
                          {forecast.result.warnings?.length ? (
                            <ul aria-label="Data and model warnings">
                              {forecast.result.warnings.map((warning, i) => (
                                <li key={i}>{warning}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="result-notice">
                      History is ready. Choose a model and horizon below.
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
                    if (selectedModel === 'mock') {
                      await api(`workspaces/${wid}/forecasts`, { datasetId: selected, horizon });
                    } else {
                      const controller = new AbortController();
                      poll.current = controller;
                      const job = await api(
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
                      let finished = false;
                      for (let attempt = 0; attempt < 180; attempt++) {
                        const status = await api(
                          `forecast-jobs/${job.jobId}`,
                          undefined,
                          controller.signal,
                        );
                        if (status.status === 'completed') {
                          finished = true;
                          break;
                        }
                        if (status.status === 'failed')
                          throw new Error(status.error || 'Forecast execution failed.');
                        await new Promise((resolve) => setTimeout(resolve, 1000));
                      }
                      if (!finished)
                        throw new Error(
                          'Job continues in the background. Refresh later to inspect the result.',
                        );
                    }
                    await refresh();
                    setMessage(
                      selectedModel === 'mock'
                        ? 'Mock forecast ready. Explore it above.'
                        : 'Model forecast ready. Inspect its values and historical evaluation above.',
                    );
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
                  Forecast horizon <span className="muted">(steps)</span>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={horizon}
                    onChange={(e) => setHorizon(Number(e.target.value))}
                    required
                  />
                </label>
                <label>
                  Forecasting model
                  <select
                    aria-label="Forecasting model"
                    value={selectedModel}
                    onChange={(e) => setModel(e.target.value)}
                    disabled={busy || loading}
                  >
                    <option
                      value="mock"
                      disabled={dataset?.frequency !== undefined && dataset.frequency !== 'daily'}
                    >
                      Weekly-repeat demo (mock)
                    </option>
                    <option value="seasonal_naive">SeasonalNaive baseline</option>
                    <option value="timestral_209m">Timestral 209M · AI quantiles</option>
                  </select>
                </label>
                <button className="button primary" disabled={busy || loading || !selected}>
                  {busy
                    ? 'Forecast running…'
                    : selectedModel === 'mock'
                      ? 'Generate mock forecast ↗'
                      : selectedModel === 'timestral_209m'
                        ? 'Generate Timestral forecast ↗'
                        : 'Generate baseline forecast ↗'}
                </button>
              </form>
              <p className="form-note">
                1–90 observation steps · Local inference · No model credits or billing. Daily mock
                remains available; choose a model for weekly/monthly data.
              </p>
            </section>
            <aside className="panel data-panel" id="datasets" aria-label="Dataset setup">
              <div className="panel-heading">
                <p className="overline">02 / THE STARTING POINT</p>
                <h2>Bring your history.</h2>
                <p>
                  A date and a value. <br /> Choose the observation frequency before uploading.
                </p>
              </div>
              <div className="upload-zone">
                <span className="upload-symbol" aria-hidden="true">
                  ↥
                </span>
                <strong>Upload a CSV</strong>
                <p>
                  date,value · 8–5,000 observations
                  <br />
                  Up to 1 MB · Consecutive dates
                </p>
                <label>
                  CSV frequency
                  <select
                    aria-label="CSV frequency"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    disabled={busy || loading}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </label>
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
                <p>
                  At least 8 consecutive periods, no duplicates or gaps. Monthly dates must
                  consistently be month starts or month ends.
                </p>
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
                        <small>
                          {d.row_count} {d.frequency || 'daily'} observations
                        </small>
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
            <span>Forewise / Phase 02B · Local inference</span>
            <span>Past observed. Next explored.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
