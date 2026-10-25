'use client';
import type { Dataset } from '@/lib/forecast-result';
export function DatasetsView({
  datasets,
  selected,
  onSelect,
  onImport,
  onSample,
  loading,
  busy,
}: {
  datasets: Dataset[];
  selected: string;
  onSelect: (id: string) => void;
  onImport: () => void;
  onSample: () => void;
  loading: boolean;
  busy: boolean;
}) {
  return (
    <section className="workspace-view panel" aria-labelledby="datasets-title">
      <div className="panel-heading">
        <h2 id="datasets-title">Bring your history.</h2>
        <p>A date, a value, a clearer starting point.</p>
      </div>
      <div className="upload-zone">
        <span className="upload-symbol" aria-hidden="true">
          ↥
        </span>
        <strong>CSV or Excel. Your columns, mapped.</strong>
        <p>8–5,000 observations / daily, weekly or monthly / up to 1 MB</p>
        <button className="button primary" onClick={onImport} disabled={busy || loading}>
          Import data
        </button>
        <button className="text-button" onClick={onSample} disabled={busy || loading}>
          Try sample data
        </button>
      </div>
      <details className="csv-help">
        <summary>What should my file look like?</summary>
        <pre>
          date,value{'\n'}2026-09-01,104{'\n'}2026-09-02,112{'\n'}…
        </pre>
        <p>
          Choose two columns from a single worksheet. Consecutive dates, no duplicates or gaps.
          Monthly dates must be month starts or month ends. Sample data is synthetic.
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
              onClick={() => onSelect(d.id)}
              disabled={busy}
            >
              <span>
                <strong>{d.name}</strong>
                <small>
                  {d.row_count} {d.frequency || 'daily'} observations
                </small>
              </span>
              <span>View</span>
            </button>
          ))
        ) : (
          <p className="empty">Your uploaded datasets will be listed here.</p>
        )}
      </div>
    </section>
  );
}
