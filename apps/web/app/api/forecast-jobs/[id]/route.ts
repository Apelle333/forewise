import { NextRequest, NextResponse } from 'next/server';
import { asUser } from '@forewise/db';
import { jobSession, jobError, JobError } from '@/lib/forecast-jobs';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, userId } = await jobSession(req);
    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      throw new JobError(404, 'Job not found.');
    const job = await asUser(
      db,
      userId,
      async (tx) =>
        (
          await tx.query(
            `SELECT j.id,j.status,j.result_id,j.attempts,j.error,j.created_at,j.updated_at,f.result,
       COALESCE(j.payload->>'contract_version','1') AS "contractVersion"
       FROM forecast_jobs j LEFT JOIN forecasts f ON f.id=j.result_id AND f.workspace_id=j.workspace_id
       WHERE j.id=$1`,
            [id],
          )
        ).rows[0],
    );
    if (!job) throw new JobError(404, 'Job not found.');
    return NextResponse.json(
      { contractVersion: '1', ...job },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return jobError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, userId } = await jobSession(req);
    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      throw new JobError(404, 'Job not found.');

    const job = await asUser(
      db,
      userId,
      async (tx) =>
        (
          await tx.query(
            `SELECT id, status, attempts FROM forecast_jobs WHERE id=$1`,
            [id],
          )
        ).rows[0],
    );

    if (!job) throw new JobError(404, 'Job not found.');
    if (job.status !== 'failed') throw new JobError(400, 'Only failed jobs can be retried.');
    if (job.attempts >= 3) throw new JobError(400, 'Maximum retry attempts reached.');

    await asUser(
      db,
      userId,
      async (tx) => {
        await tx.query(
          `UPDATE forecast_jobs
           SET status='pending',
               attempts=attempts+1,
               available_at=now(),
               error=null,
               fence=fence+1
           WHERE id=$1`,
          [id],
        );
      },
    );

    return NextResponse.json(
      { status: 'accepted' },
      { status: 202 },
    );
  } catch (error) {
    return jobError(error);
  }
}
