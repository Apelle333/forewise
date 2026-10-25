'use client';
import { useEffect, useRef, useState } from 'react';
import { DatasetPreview } from './DatasetPreview';
import type { Frequency } from '@/lib/csv';
import type { ColumnMapping } from '@/lib/dataset-import';

type Preview = { headers: string[]; rows: string[][]; rowCount: number };
export function DataOnboarding({
  wid,
  onSuccess,
  onCancel,
}: {
  wid: string;
  onSuccess: (id: string) => Promise<void>;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    feedback = useRef<HTMLParagraphElement>(null);
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({ dateCol: 0, valueCol: 1 });
  const [frequency, setFrequency] = useState<Frequency>('daily'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => {
      request.current?.abort();
      previous?.focus();
    };
  }, []);
  async function send(selected: File, mode: string) {
    const controller = new AbortController();
    request.current = controller;
    const form = new FormData();
    form.set('file', selected);
    form.set('mode', mode);
    form.set('frequency', frequency);
    form.set('dateCol', String(mapping.dateCol));
    form.set('valueCol', String(mapping.valueCol));
    const res = await fetch(`/api/workspaces/${wid}/datasets/import`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Import failed. Please try again.');
    return data;
  }
  async function choose(selected: File | undefined) {
    if (!selected) return;
    setError('');
    setPreview(null);
    setFile(null);
    if (selected.size > 1_000_000) {
      setError('File must be smaller than 1 MB.');
      return;
    }
    setBusy(true);
    try {
      const data: Preview = await send(selected, 'preview');
      setPreview(data);
      setFile(selected);
      const date = Math.max(
        0,
        data.headers.findIndex((h) => /date|time/i.test(h)),
      );
      const found = data.headers.findIndex((h, i) => i !== date && /value|amount|count/i.test(h));
      setMapping({ dateCol: date, valueCol: found < 0 ? (date === 0 ? 1 : 0) : found });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const data = await send(file, 'import');
      await onSuccess(data.id);
      onCancel();
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError((e as Error).message);
        requestAnimationFrame(() => feedback.current?.focus({ preventScroll: true }));
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="onboarding-modal"
      aria-labelledby="import-title"
      onCancel={onCancel}
    >
      <div className="onboarding-content">
        <header>
          <div>
            <h2 id="import-title">Bring your history.</h2>
          </div>
          <button className="text-button" onClick={onCancel}>
            Cancel
          </button>
        </header>
        <div className="onboarding-scroll">
          <p>
            CSV or XLSX, one worksheet, up to 1 MB. Choose your date and numeric value columns. Use
            ISO dates or date-only Excel cells.
          </p>
          <label className="import-file-label">
            Choose a CSV or XLSX
            <input
              type="file"
              accept=".csv,.xlsx"
              disabled={busy}
              onChange={(e) => void choose(e.target.files?.[0])}
            />
          </label>
          {error ? (
            <p ref={feedback} tabIndex={-1} className="error" role="alert">
              {error}
            </p>
          ) : null}
          {busy ? <p role="status">Checking your data…</p> : null}
          {preview ? (
            <>
              <p>
                {file?.name} / {preview.rowCount} observations. Nothing is saved until you confirm.
              </p>
              <DatasetPreview
                headers={preview.headers}
                data={preview.rows}
                disabled={busy}
                mapping={mapping}
                onMappingChange={(next) => {
                  setMapping(next);
                  setError('');
                }}
                frequency={frequency}
                onFrequencyChange={(next) => {
                  setFrequency(next);
                  setError('');
                }}
              />
              <p className="muted">
                8–5,000 consecutive periods. Duplicates, gaps, invalid numbers and formulas must be
                corrected in the source file. Missing values are never filled silently.
              </p>
            </>
          ) : null}
        </div>
        {preview ? (
          <div className="onboarding-footer">
            <button
              className="button primary"
              disabled={busy || mapping.dateCol === mapping.valueCol}
              onClick={() => void confirm()}
            >
              Import dataset
            </button>
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
