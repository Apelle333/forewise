import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { asUser } from '@forewise/db';
import { jobSession, jobError, JobError } from '@/lib/forecast-jobs';
import { readLimitedBytes } from '@/lib/body';
import { readImport, mappedDataset } from '@/lib/dataset-import';
import type { Frequency } from '@/lib/csv';

export const runtime = 'nodejs';
export async function POST(req: NextRequest, { params }: { params: Promise<{ wid: string }> }) {
  try {
    if (
      req.headers.get('origin') !==
      new URL(process.env.APP_ORIGIN || 'http://127.0.0.1:3000').origin
    )
      throw new JobError(403, 'Request origin rejected.');
    const { db, userId } = await jobSession(req),
      { wid } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(wid)) throw new JobError(404, 'Workspace not found.');
    await asUser(db, userId, async (tx) => {
      if (!(await tx.query('SELECT id FROM workspaces WHERE id=$1', [wid])).rows.length)
        throw new JobError(404, 'Workspace not found.');
    });
    const bytes = await readLimitedBytes(req, 1_020_000);
    let form: FormData;
    try {
      form = await new Request(req.url, {
        method: 'POST',
        headers: { 'Content-Type': req.headers.get('content-type') || '' },
        body: new Uint8Array(bytes),
      }).formData();
    } catch {
      throw new JobError(400, 'Use a multipart CSV or XLSX upload.');
    }
    const file = form.get('file'),
      mode = form.get('mode');
    if (!(file instanceof File) || !['preview', 'import'].includes(String(mode)))
      throw new JobError(400, 'Choose a file and import action.');
    let table;
    try {
      table = await readImport(Buffer.from(await file.arrayBuffer()), file.name);
    } catch (e) {
      throw new JobError(400, e instanceof Error ? e.message : 'Invalid file.');
    }
    if (mode === 'preview')
      return NextResponse.json(
        { headers: table.headers, rows: table.rows.slice(0, 10), rowCount: table.rows.length },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    const frequency = form.get('frequency');
    if (!['daily', 'weekly', 'monthly'].includes(String(frequency)))
      throw new JobError(400, 'Choose daily, weekly or monthly frequency.');
    const date = form.get('dateCol'),
      value = form.get('valueCol');
    if (
      typeof date !== 'string' ||
      typeof value !== 'string' ||
      !/^\d+$/.test(date) ||
      !/^\d+$/.test(value)
    )
      throw new JobError(400, 'Choose your date and value columns.');
    let points;
    try {
      points = mappedDataset(
        table,
        { dateCol: Number(date), valueCol: Number(value) },
        frequency as Frequency,
      );
    } catch (e) {
      throw new JobError(400, (e as Error).message);
    }
    const id = randomUUID(),
      name = file.name.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 120) || 'Imported history';
    await asUser(db, userId, async (tx) => {
      // Serialize workspace imports so concurrent requests cannot exceed its dataset limit.
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1::uuid::text,0))', [wid]);
      const count = await tx.query<{ count: number }>(
        'SELECT count(*)::int AS count FROM datasets WHERE workspace_id=$1',
        [wid],
      );
      if (count.rows[0].count >= 20)
        throw new JobError(400, 'This workspace supports up to 20 datasets.');
      await tx.query(
        'INSERT INTO datasets(id,workspace_id,name,points,row_count,frequency) VALUES($1,$2,$3,$4,$5,$6)',
        [id, wid, name, JSON.stringify(points), points.length, frequency],
      );
    });
    return NextResponse.json(
      { id, name, row_count: points.length },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return jobError(e);
  }
}
