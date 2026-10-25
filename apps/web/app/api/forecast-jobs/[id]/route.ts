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
            `SELECT j.id,j.dataset_id,j.status,j.result_id,j.attempts,j.error,j.created_at,j.updated_at,f.result,f.horizon,f.created_at AS "forecastCreatedAt",
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
