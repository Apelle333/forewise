'use client';
import { useState } from 'react';
import { Chart } from '../chart';
import type { Dataset, Forecast } from '../workspace';

export function ResultsView({
  dataset,
  forecast,
  loading,
}: {
  dataset: Dataset | undefined;
  forecast: Forecast | undefined;
  loading: boolean;
}) {
  const [comparisonMode, setComparisonMode] = useState(false);

  if (loading) {
    return (
      <div className="workspace-view">
        <div className="loading-state" aria-busy="true">
          <div className="skeleton-line" />
          <div className="skeleton-plot" />
          <p>Loading forecast results…</p>
        </div>
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="workspace-view">
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
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-view">
      <div className="result-heading">
        <div>
          <p className="overline">03 / THE VIEW AHEAD</p>
          <h2>{dataset.name}</h2>
          <p>
            {dataset.row_count} {dataset.frequency || 'daily'} observations
            {forecast ? ` · ${forecast.horizon}-step ${forecast.result.mock ? 'mock' : 'model'} forecast` : ' · Historical data'}
          </p>
        </div>
        <div className="result-actions" style={{ display: 'flex', gap: '8px' }}>
          {forecast && (
            <>
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
                {forecast.result.mock ? 'Export mock CSV' : 'Export forecast CSV'} <span aria-hidden="true">↓</span>
              </button>
              <button
                className={`button subtle ${comparisonMode ? 'primary' : ''}`}
                onClick={() => setComparisonMode(!comparisonMode)}
                title="Overlay baseline for comparison"
              >
                Comparison Mode {comparisonMode ? 'ON' : 'OFF'}
              </button>
            </>
          )}
        </div>
      </div>

      <Chart
        key={`${dataset.id}-${comparisonMode}`}
        history={dataset.points}
        future={comparisonMode && forecast?.result.model === 'timestral_209m'
          ? forecast.result.evaluation?.baseline_points || forecast?.result.points
          : forecast?.result.points || []}
        label={
          forecast?.result.mock === false
            ? 'Selected dataset history and model forecast'
            : 'Selected dataset history and mock forecast'
        }
        caption={
          comparisonMode
            ? 'Comparing Timestral vs SeasonalNaive baseline'
            : forecast && !forecast.result.mock
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
              <div className="calibration-report">
                <p className="overline" style={{ marginBottom: '12px' }}>Calibration Report</p>
                <p>
                  <strong style={{ fontSize: '14px' }}>
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

                {forecast.result.metrics?.coverage_p10_p90 !== undefined && forecast.result.metrics.coverage_p10_p90 < 0.8 ? (
                  <div className="calibration-warning" style={{
                    marginTop: '16px',
                    padding: '12px',
                    backgroundColor: 'var(--danger-surface)',
                    color: 'var(--danger-ink)',
                    borderRadius: 'var(--radius)',
                    fontSize: '12px',
                    borderLeft: '3px solid var(--accent-warm)'
                  }}>
                    <strong>Low Coverage Warning:</strong> The historical interval coverage is below 80%.
                    The prediction intervals may be overly optimistic.
                  </div>
                ) : null}
              </div>

              {forecast.result.warnings?.length ? (
                <ul aria-label="Data and model warnings" style={{ marginTop: '16px' }}>
                  {forecast.result.warnings.map((warning, i) => (
                    <li key={i} style={{ fontSize: '12px', color: 'var(--muted)' }}>{warning}</li>
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
    </div>
  );
}
