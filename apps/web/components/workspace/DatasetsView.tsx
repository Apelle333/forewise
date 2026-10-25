'use client';
import { useState, useEffect } from 'react';
import { DataOnboarding } from '../onboarding/DataOnboarding';
import type { Dataset } from '../workspace';

export function DatasetsView({
  datasets,
  selected,
  setSelected,
  onUpload,
  showOnboarding,
  setShowOnboarding,
  loading,
  busy,
}: {
  datasets: Dataset[];
  selected: string;
  setSelected: (id: string) => void;
  onUpload: (csv: string, name: string, frequency: string) => void;
  showOnboarding: boolean;
  setShowOnboarding: (val: boolean) => void;
  loading: boolean;
  busy: boolean;
}) {
  return (
    <div className="workspace-view">
      <div className="panel-heading">
        <p className="overline">01 / THE STARTING POINT</p>
        <h2>Bring your history.</h2>
        <p>
          A date and a value. <br /> Choose the observation frequency before uploading.
        </p>
      </div>>

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
        <label className="button subtle file-button">
          Import Data
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            aria-label="Import data"
            disabled={busy || loading}
            onChange={() => setShowOnboarding(true)}
          />
        </label>
      </div>

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
    </div>
  );
}
