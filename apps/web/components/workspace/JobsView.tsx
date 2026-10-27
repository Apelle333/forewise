'use client';
import { useState, useEffect } from 'react';
type Job = {
  id: string;
  dataset_id: string;
  result_id: string | null;
  status: string;
  attempts: number;
  error: string | null;
  created_at: string;
  model: string | null;
  horizon: string;
};
export function JobsView({
  wid,
  onViewResult,
  busy,
}: {
  wid: string;
  onViewResult: (datasetId: string, forecastId: string, jobId: string) => Promise<void>;
  busy: boolean;
}) {
  const [jobs, setJobs] = useState<Job[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [retrying, setRetrying] = useState(''),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let request: AbortController | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      if (!wid || stopped || document.hidden) return;
      request?.abort();
      const controller = new AbortController();
      request = controller;
      try {
        const res = await fetch(`/api/forecast-jobs?workspaceId=${wid}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (!controller.signal.aborted) {
          setJobs(data.jobs);
          setError('');
        }
      } catch (e) {
        if (!controller.signal.aborted) setError((e as Error).message);
      } finally {
        if (request === controller) {
          request = null;
          if (!controller.signal.aborted) setLoading(false);
          if (!stopped && !document.hidden) timer = setTimeout(() => void load(), 5000);
        }
      }
    }
    function visibilityChanged() {
      clearTimeout(timer);
      if (document.hidden) request?.abort();
      else void load();
    }
    document.addEventListener('visibilitychange', visibilityChanged);
    if (wid) void load();
    return () => {
      stopped = true;
      request?.abort();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, [wid, version]);
  async function retry(id: string) {
    setRetrying(id);
    setError('');
    try {
      const res = await fetch(`/api/forecast-jobs/${id}/retry`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVersion((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRetrying('');
    }
  }
  return (
    <section className="workspace-view panel" aria-labelledby="jobs-title">
      <div className="panel-heading">
        <h2 id="jobs-title">Forecast jobs.</h2>
        <p>Saved runs continue in the background. At most three execution attempts per job.</p>
      </div>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <div
        className="data-table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Forecast jobs"
        aria-busy={loading}
      >
        {jobs.length ? (
          <table>
            <caption>
              Latest 100 jobs in this workspace. Refreshes every five seconds while visible.
            </caption>
            <thead>
              <tr>
                <th scope="col">Run</th>
                <th scope="col">Status</th>
                <th scope="col">Attempts</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <strong>
                      {job.model === 'timestral_209m' ? 'Timestral 209M' : 'SeasonalNaive'}
                    </strong>
                    <small>
                      {job.id.slice(0, 8)} / {job.horizon} steps
                    </small>
                  </td>
                  <td>
                    {job.status}
                    {job.error ? <p className="error">{job.error}</p> : null}
                  </td>
                  <td>{job.attempts} / 3</td>
                  <td>
                    {job.status === 'failed' && job.attempts < 3 ? (
                      <button
                        className="button subtle"
                        disabled={busy || !!retrying}
                        onClick={() => void retry(job.id)}
                      >
                        {retrying === job.id ? 'Retrying…' : 'Retry'}
                      </button>
                    ) : null}
                    {job.status === 'failed' && job.attempts >= 3 ? (
                      <span>Attempt limit reached</span>
                    ) : null}
                    {job.status === 'completed' && job.result_id ? (
                      <button
                        className="button subtle"
                        onClick={() =>
                          void onViewResult(job.dataset_id, job.result_id!, job.id).catch((e) =>
                            setError(e.message),
                          )
                        }
                      >
                        View result
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="empty">
            {loading ? 'Loading jobs…' : 'No forecast jobs in this workspace yet.'}
          </p>
        )}
      </div>
    </section>
  );
}
