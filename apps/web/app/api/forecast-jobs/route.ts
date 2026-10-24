import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { asUser } from '@forewise/db';
import { jobSession, jobError, JobError } from '@/lib/forecast-jobs';
import { readLimitedBody } from '@/lib/body';

export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  try {
    const origin = new URL(process.env.APP_ORIGIN || 'http://127.0.0.1:3000').origin;
    if (req.headers.get('origin') !== origin) throw new JobError(403, 'Request origin rejected.');
    const { db, userId } = await jobSession(req);
    if (!process.env.DATABASE_URL)
      throw new JobError(503, 'Asynchronous jobs require local PostgreSQL.');
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(await readLimitedBody(req));
    } catch (error) {
      if (error instanceof SyntaxError) throw new JobError(400, 'Invalid JSON.');
      throw error;
    }
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new JobError(400, 'Invalid request.');
    const { workspaceId, datasetId, horizon, contractVersion, model } = body;
    const uuid = (value: unknown): value is string =>
      typeof value === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    if (
      !['1', '2'].includes(String(contractVersion)) ||
      typeof contractVersion !== 'string' ||
      (contractVersion === '2' &&
        (typeof model !== 'string' || !['seasonal_naive', 'timestral_209m'].includes(model))) ||
      !uuid(workspaceId) ||
      !uuid(datasetId) ||
      typeof horizon !== 'number' ||
      !Number.isInteger(horizon) ||
      horizon < 1 ||
      horizon > 90
    )
      throw new JobError(
        400,
        'Use a supported contract/model, valid workspace/dataset IDs and a horizon of 1–90 steps.',
      );
    if (
      Object.keys(body).some(
        (key) =>
          ![
            'contractVersion',
            'workspaceId',
            'datasetId',
            'horizon',
            ...(contractVersion === '2' ? ['model'] : []),
          ].includes(key),
      )
    )
      throw new JobError(
        400,
        'Job inputs come from the saved dataset; unsupported fields were supplied.',
      );
    const jobId = randomUUID();
    await asUser(db, userId, async (tx) => {
      const found = await tx.query<{ points: unknown; frequency: string }>(
        'SELECT points,frequency FROM datasets WHERE id=$1 AND workspace_id=$2',
        [datasetId, workspaceId],
      );
      if (!found.rows[0]) throw new JobError(404, 'Dataset not found.');
      const count = await tx.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM forecast_jobs WHERE workspace_id=$1 AND status IN ('pending','processing')",
        [workspaceId],
      );
      if (count.rows[0].count >= 20)
        throw new JobError(429, 'Too many active jobs in this workspace.');
      const payload = {
        contract_version: contractVersion,
        ...(contractVersion === '2' ? { model } : {}),
        datasetId,
        horizon,
        points: found.rows[0].points,
        frequency: found.rows[0].frequency,
      };
      await tx.query(
        "INSERT INTO forecast_jobs(id,workspace_id,dataset_id,status,payload) VALUES($1,$2,$3,'pending',$4)",
        [jobId, workspaceId, datasetId, JSON.stringify(payload)],
      );
    });
    return NextResponse.json(
      { contractVersion, status: 'accepted', jobId },
      { status: 202, headers: { Location: `/api/forecast-jobs/${jobId}` } },
    );
  } catch (error) {
    return jobError(error);
  }
}
