'use client';
import { useState, useEffect, useRef } from 'react';
import type { Dataset } from '../workspace';

type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

type Job = {
  id: string;
  status: JobStatus;
  dataset_id: string;
  created_at: string;
  updated_at: string;
  error?: string;
  result_id?: string;
};

export function JobsView({
  wid,
  onViewResult,
  busy,
}: {
  wid: string;
  onViewResult: (datasetId: string) => void;
  busy: boolean;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  async function fetchJobs() {
    try {
      const res = await fetch(`/api/forecast-jobs?workspaceId=${wid}`);
      if (!res.ok) throw new Error('Failed to fetch jobs.');
      const data = await res.json();
      setJobs(data.jobs || []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!wid) return;
    fetchJobs();

    pollRef.current = setInterval(fetchJobs, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [wid]);

  async function retryJob(jobId: string) {
    try {
      const res = await fetch(`/api/forecast-jobs/${jobId}/retry`, { method: 'POST' });
      if (!res.ok) throw new Error('Retry failed.');
      await fetchJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Retry failed.');
    }
  }

  return (
    <div className="workspace-view">
      <div className="panel-heading">
        <p className="overline">02 / EXECUTION PIPELINE</p>
        <h2>Forecast Jobs</h2>
        <p>Monitor and manage your local inference runs.</p>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="jobs-list" aria-busy={loading}>
        {loading && jobs.length === 0 ? (
          <p className="muted">Loading jobs…</p>
        ) : jobs.length === 0 ? (
          <p className="empty">No forecast jobs found in this workspace.</p>
        ) : (
          <div className="jobs-table">
            <div className="jobs-table-header">
              <span>Job ID</span>
              <span>Status</span>
              <span>Created</span>
              <span>Action</span>
            </div>
            {jobs.map((job) => (
              <div key={job.id} className="job-row">
                <span className="job-id">{job.id.slice(0, 8)}…</span>
                <span className={`status-badge ${job.status}`}>
                  {job.status}
                </span>
                <span className="muted">{new Date(job.created_at).toLocaleDateString()}</span>
                <div className="job-actions">
                  {job.status === 'failed' && (
                    <button
                      className="button subtle"
                      onClick={() => retryJob(job.id)}
                      disabled={busy}
                    >
                      Retry
                    </button>
                  )}
                  {job.status === 'completed' && (
                    <button
                      className="button subtle"
                      onClick={() => onViewResult(job.dataset_id)}
                    >
                      View Result
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
