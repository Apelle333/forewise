import { NextRequest, NextResponse } from 'next/server';
import { asUser } from '@forewise/db';
import { jobSession, jobError, JobError } from '@/lib/forecast-jobs';

export const runtime = 'nodejs';
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (
      req.headers.get('origin') !==
      new URL(process.env.APP_ORIGIN || 'http://127.0.0.1:3000').origin
    )
      throw new JobError(403, 'Request origin rejected.');
    const { db, userId } = await jobSession(req),
      { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      throw new JobError(404, 'Job not found.');
    await asUser(db, userId, async (tx) => {
      if (!(await tx.query('SELECT id FROM forecast_jobs WHERE id=$1', [id])).rows.length)
        throw new JobError(404, 'Job not found.');
      const retried = await tx.query<{ id: string | null }>(
        'SELECT public.retry_forecast_job($1) AS id',
        [id],
      );
      if (!retried.rows[0]?.id)
        throw new JobError(409, 'Only failed jobs with fewer than three attempts can be retried.');
    });
    return NextResponse.json(
      { status: 'accepted' },
      { status: 202, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return jobError(e);
  }
}
