import { NextRequest } from 'next/server';
import { asUser } from '@forewise/db';
import { jobSession, jobError, JobError } from '@/lib/forecast-jobs';
import { exportRows, exportCsv, exportXlsx } from '@/lib/forecast-export';
import type { Dataset, Forecast } from '@/lib/forecast-result';

export const runtime = 'nodejs';
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ wid: string; fid: string }> },
) {
  try {
    const { db, userId } = await jobSession(req),
      { wid, fid } = await params;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(wid) || !uuid.test(fid)) throw new JobError(404, 'Forecast not found.');
    const format = req.nextUrl.searchParams.get('format');
    if (!['csv', 'xlsx'].includes(format || ''))
      throw new JobError(400, 'Choose CSV or XLSX export.');
    const saved = await asUser(db, userId, async (tx) => {
      const result = await tx.query<Forecast & { dataset: Dataset }>(
        `SELECT f.id,f.dataset_id,f.horizon,f.result,f.created_at,row_to_json(d) AS dataset
         FROM forecasts f JOIN datasets d ON d.id=f.dataset_id AND d.workspace_id=f.workspace_id
         WHERE f.id=$1 AND f.workspace_id=$2`,
        [fid, wid],
      );
      if (!result.rows[0]) throw new JobError(404, 'Forecast not found.');
      return result.rows[0];
    });
    const rows = exportRows(wid, saved.dataset, saved),
      xlsx = format === 'xlsx';
    const body = xlsx ? new Uint8Array(await exportXlsx(rows)) : exportCsv(rows);
    return new Response(body, {
      headers: {
        'Content-Type': xlsx
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="forewise-${fid}.${format}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return jobError(e);
  }
}
