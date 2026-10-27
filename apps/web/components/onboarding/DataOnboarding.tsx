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
  onSuccess: (id: string, signal: AbortSignal) => Promise<void>;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    feedback = useRef<HTMLParagraphElement>(null);
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({ dateCol: 0, valueCol: 1 });
  const [frequency, setFrequency] = useState<Frequency>('daily'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
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
    request.current?.abort();
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
    controller.signal.throwIfAborted();
    const data = await res.json();
    controller.signal.throwIfAborted();
    if (!res.ok) throw new Error(data.error || 'Import failed. Please try again.');
    return { data, signal: controller.signal };
  }
  async function choose(selected: File | undefined) {
    if (!selected || busy) return;
    dragDepth.current = 0;
    setDragging(false);
    setError('');
    setPreview(null);
    setFile(null);
    if (selected.size > 1_000_000) {
      setError('File must be smaller than 1 MB.');
      return;
    }
    setBusy(true);
    try {
      const { data, signal }: { data: Preview; signal: AbortSignal } = await send(
        selected,
        'preview',
      );
      signal.throwIfAborted();
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
      const { data, signal } = await send(file, 'import');
      signal.throwIfAborted();
      await onSuccess(data.id, signal);
      signal.throwIfAborted();
      cancel();
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError((e as Error).message);
        requestAnimationFrame(() => feedback.current?.focus({ preventScroll: true }));
      }
    } finally {
      setBusy(false);
    }
  }
  function cancel() {
    request.current?.abort();
    onCancel();
  }
  return (
    <dialog
      ref={dialog}
      className="onboarding-modal"
      aria-labelledby="import-title"
      onCancel={cancel}
    >
      <div className="onboarding-content">
        <header>
          <div>
            <h2 id="import-title">Bring your history.</h2>
          </div>
          <button className="text-button" onClick={cancel}>
            Cancel
          </button>
        </header>
        <div className="onboarding-scroll">
          <p>
            CSV or XLSX, one worksheet, up to 1 MB. Choose your date and numeric value columns. Use
            ISO dates or date-only Excel cells.
          </p>
          <label
            className="import-file-label import-dropzone"
            data-preview={Boolean(preview)}
            data-dragging={dragging && !busy}
            data-busy={busy}
            onDragEnter={(event) => {
              event.preventDefault();
              if (busy || !event.dataTransfer.types.includes('Files')) return;
              dragDepth.current += 1;
              setDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = busy ? 'none' : 'copy';
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              dragDepth.current = Math.max(0, dragDepth.current - 1);
              if (dragDepth.current === 0) setDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              dragDepth.current = 0;
              setDragging(false);
              if (!busy) void choose(event.dataTransfer.files[0]);
            }}
          >
            <strong>Choose a CSV or XLSX</strong>
            <span className="import-drop-hint">
              {dragging && !busy
                ? 'Release to preview your file'
                : 'or drop one file here to preview'}
            </span>
            <span className="import-file-limit">One worksheet / up to 1 MB</span>
            <input
              type="file"
              accept=".csv,.xlsx"
              aria-label="Choose a CSV or XLSX"
              disabled={busy}
              onChange={(e) => void choose(e.target.files?.[0])}
            />
          </label>
          {error ? (
            <p ref={feedback} tabIndex={-1} className="error" role="alert">
              {error}
            </p>
          ) : null}
          {busy ? (
            <p className="import-progress" role="status">
              {preview ? 'Importing your dataset…' : 'Checking your data…'}
            </p>
          ) : null}
          {preview ? (
            <>
              <div className="import-file-summary">
                <div>
                  <strong>{file?.name}</strong>
                  <p>
                    {file ? `${Math.max(1, Math.ceil(file.size / 1_000))} KB / ` : ''}
                    {preview.rowCount} observations
                  </p>
                </div>
                <span>Preview only</span>
              </div>
              <p className="muted">Nothing is saved until you confirm.</p>
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
              <p
                className="import-mapping-feedback"
                data-valid={mapping.dateCol !== mapping.valueCol}
                role="status"
              >
                {mapping.dateCol === mapping.valueCol ? (
                  'Choose different date and value columns to continue.'
                ) : (
                  <>
                    <strong>{preview.headers[mapping.dateCol]}</strong> as dates,{' '}
                    <strong>{preview.headers[mapping.valueCol]}</strong> as values.{' '}
                    {frequency === 'daily'
                      ? 'Daily'
                      : frequency === 'weekly'
                        ? 'Weekly'
                        : 'Monthly'}{' '}
                    periods will be checked before saving.
                  </>
                )}
              </p>
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
