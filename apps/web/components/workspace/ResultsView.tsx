'use client';
import { useState } from 'react';
import { Chart } from '../chart';
import { comparableBaseline, type Dataset, type Forecast } from '@/lib/forecast-result';
export function ResultsView({
  wid,
  dataset,
  forecast,
  forecasts,
  onResult,
  loading,
}: {
  wid: string;
  dataset: Dataset | undefined;
  forecast: Forecast | undefined;
  forecasts: Forecast[];
  onResult: (id: string) => void;
  loading: boolean;
}) {
  const [comparisonMode, setComparisonMode] = useState(false),
    [error, setError] = useState(''),
    [exporting, setExporting] = useState('');
  const [historyRange, setHistoryRange] = useState('recent');
  const baseline = comparableBaseline(forecast, forecasts);
  if (loading) return <p role="status">Loading results…</p>;
  if (!dataset)
    return <p className="empty">Import a dataset or try synthetic sample data to begin.</p>;
  const result = forecast?.result,
    metrics = result?.metrics,
    evaluation = result?.evaluation;
  const runs = forecasts.filter((f) => f.dataset_id === dataset.id);
  async function download(format: string) {
    if (!forecast) return;
    setExporting(format);
    setError('');
    try {
      const response = await fetch(
        `/api/workspaces/${wid}/forecasts/${forecast.id}/export?format=${format}`,
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Export unavailable.');
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `forewise-${forecast.id}.${format}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting('');
    }
  }
  return (
    <section className="workspace-view panel result-panel" aria-label="Forecast result">
      <div className="result-heading">
        <div>
          <h2>{dataset.name}</h2>
          <p>
            {dataset.row_count} {dataset.frequency || 'daily'} observations
            {forecast
              ? ` / ${forecast.horizon}-step ${result?.mock ? 'mock' : 'model'} forecast`
              : ' / Historical data'}
          </p>
        </div>
        {forecast ? (
          <div className="result-actions">
            <button
              className="button subtle"
              disabled={!!exporting}
              onClick={() => void download('csv')}
            >
              {exporting === 'csv' ? 'Preparing…' : 'Export CSV'}
            </button>
            <button
              className="button subtle"
              disabled={!!exporting}
              onClick={() => void download('xlsx')}
            >
              {exporting === 'xlsx' ? 'Preparing…' : 'Export XLSX'}
            </button>
          </div>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
      {runs.length ? (
        <label className="saved-run saved-forecast">
          Saved forecast
          <select value={forecast?.id || ''} onChange={(e) => onResult(e.target.value)}>
            {runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.result.mock
                  ? 'Mock demo'
                  : run.result.model === 'timestral_209m'
                    ? 'Timestral 209M'
                    : 'SeasonalNaive'}{' '}
                / {run.horizon} steps /{' '}
                {run.created_at ? new Date(run.created_at).toLocaleString() : run.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {result?.model === 'timestral_209m' ? (
        <div className="comparison-control">
          {baseline ? (
            <label>
              <input
                type="checkbox"
                checked={comparisonMode}
                onChange={(e) => setComparisonMode(e.target.checked)}
              />{' '}
              Compare saved SeasonalNaive forecast ({baseline.horizon} steps)
            </label>
          ) : (
            <p className="muted">
              For a chart comparison, run SeasonalNaive on this dataset with the same horizon. Only
              saved, date-aligned forecasts are overlaid.
            </p>
          )}
        </div>
      ) : null}
      <label className="saved-run">
        Chart range
        <select value={historyRange} onChange={(e) => setHistoryRange(e.target.value)}>
          <option value="recent">Recent history and forecast</option>
          <option value="all">All observations</option>
        </select>
      </label>
      {historyRange === 'recent' &&
      dataset.points.length > Math.max(24, (forecast?.horizon || 20) * 3) ? (
        <p className="muted">
          Showing the last {Math.max(24, (forecast?.horizon || 20) * 3)} of {dataset.row_count}{' '}
          observed values. Select all observations for the complete history. Exports always include
          the full dataset.
        </p>
      ) : null}
      <Chart
        history={
          historyRange === 'all'
            ? dataset.points
            : dataset.points.slice(-Math.max(24, (forecast?.horizon || 20) * 3))
        }
        future={result?.points || []}
        quantiles={result?.quantiles}
        comparison={comparisonMode ? baseline?.result.points : undefined}
        futureKind={result && !result.mock ? 'forecast' : 'mock'}
        label={
          result?.mock ? 'Historical data and mock forecast' : 'Historical data and model forecast'
        }
        caption={
          result?.mock
            ? 'HISTORY / ILLUSTRATIVE MOCK'
            : result
              ? 'HISTORY / MODEL FORECAST'
              : 'OBSERVED HISTORY'
        }
      />
      {result ? (
        <>
          <p className="result-notice">{result.notice}</p>
          {!result.mock ? (
            <div className="forecast-evaluation" data-testid="model-result">
              <h3>
                {result.model === 'timestral_209m' ? 'Timestral 209M' : 'SeasonalNaive'} /
                historical evaluation
              </h3>
              {result.performance ? (
                <p>
                  {result.performance.device.toUpperCase()} /{' '}
                  {result.performance.inference_seconds.toFixed(3)}s inference (excludes queue and
                  upload time)
                </p>
              ) : null}
              <p>
                {evaluation?.windows || 0} rolling-origin windows /{' '}
                {evaluation?.evaluated_points || 0} evaluated points. Small historical samples do
                not establish calibration.
              </p>
              {metrics ? (
                <>
                  <dl className="forecast-metrics">
                    <div>
                      <dt>MAE (lower is better)</dt>
                      <dd>{metrics.mae.toFixed(2)}</dd>
                    </div>
                    <div>
                      <dt>RMSE (lower is better)</dt>
                      <dd>{metrics.rmse.toFixed(2)}</dd>
                    </div>
                    {evaluation?.baseline_metrics ? (
                      <>
                        <div>
                          <dt>SeasonalNaive MAE / same backtest</dt>
                          <dd>{evaluation.baseline_metrics.mae.toFixed(2)}</dd>
                        </div>
                        <div>
                          <dt>SeasonalNaive RMSE</dt>
                          <dd>{evaluation.baseline_metrics.rmse.toFixed(2)}</dd>
                        </div>
                      </>
                    ) : null}
                    {metrics.coverage_p10_p90 !== undefined ? (
                      <div>
                        <dt>P10–P90 observed coverage</dt>
                        <dd>{(metrics.coverage_p10_p90 * 100).toFixed(1)}%</dd>
                      </div>
                    ) : null}
                  </dl>
                  <p className="muted">
                    MAE is the average absolute error in your value units; RMSE penalizes larger
                    misses.{' '}
                    {evaluation?.baseline_season_length
                      ? `Baseline period: ${evaluation.baseline_season_length} observations.`
                      : ''}
                  </p>
                </>
              ) : (
                <p>
                  Not enough history for this backtest horizon. No accuracy metrics are fabricated.
                </p>
              )}
              {result.quantiles ? (
                <div
                  className={
                    metrics?.coverage_p10_p90 !== undefined && metrics.coverage_p10_p90 < 0.8
                      ? 'calibration-warning'
                      : 'interval-note'
                  }
                >
                  <strong>Native intervals. Calibration is not established.</strong> P10/P50/P90 are
                  model outputs; P50 is the median. The P10–P90 interval targets 80% coverage, not a
                  guarantee for this dataset or the future.
                  {metrics?.coverage_p10_p90 !== undefined && metrics.coverage_p10_p90 < 0.8
                    ? ' Observed historical coverage is below 80%; these intervals may be too narrow.'
                    : ''}{' '}
                  No experimental calibration correction is applied. Coverage alone does not measure
                  interval quality.
                </div>
              ) : null}
              {result.warnings?.length ? (
                <details className="data-disclosure">
                  <summary>All run warnings</summary>{' '}
                  <ul aria-label="Data and model warnings">
                    {result.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
              <details className="data-disclosure">
                <summary>Run metadata and evaluation details</summary>
                <pre className="metadata-json">
                  {JSON.stringify(
                    Object.fromEntries(
                      Object.entries(result).filter(
                        ([key]) => !['points', 'quantiles'].includes(key),
                      ),
                    ),
                    null,
                    2,
                  )}
                </pre>
              </details>
            </div>
          ) : null}
          <p className="muted">
            Exports include observed history, saved forecast values, available quantiles, model
            metadata and evaluation warnings. CSV text is escaped for first-open spreadsheet safety;
            XLSX preserves typed values.
          </p>
        </>
      ) : (
        <p className="result-notice">History is ready. Choose a model and horizon above.</p>
      )}
    </section>
  );
}
