import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { asUser } from '@forewise/db';
import { database } from '@/lib/db';
import { digest, hashPassword, newSession, sessionCookie, verifyPassword } from '@/lib/auth';
import { parseDataset, type Point } from '@/lib/csv';
import { BodyTooLargeError, readLimitedBody } from '@/lib/body';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type User = { id: string; email: string; name: string };
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}
const uuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const text = (v: unknown, max = 100) =>
  typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max
    ? v.trim()
    : fail(400, 'Please check the form fields.');

async function handle(req: NextRequest) {
  try {
    const write = req.method === 'POST';
    const appOrigin = new URL(process.env.APP_ORIGIN || 'http://127.0.0.1:3000').origin;
    if (write && req.headers.get('origin') !== appOrigin) fail(403, 'Request origin rejected.');
    const path = req.nextUrl.pathname.replace(/^\/api\//, '').split('/');
    const db = await database();
    let body: Record<string, unknown> = {};
    if (write) {
      const raw = await readLimitedBody(req);
      try {
        body = JSON.parse(raw);
      } catch {
        fail(400, 'Invalid request.');
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Invalid request.');
    }
    if (
      write &&
      path.length === 2 &&
      path[0] === 'auth' &&
      ['register', 'login'].includes(path[1])
    ) {
      const email = text(body.email, 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Enter a valid email address.');
      const password = typeof body.password === 'string' ? body.password : '';
      if (password.length < 12 || password.length > 128)
        fail(400, 'Use a password between 12 and 128 characters.');
      const attemptKey = digest(email);
      const attempts = await db.query<{ attempts: number }>(
        `INSERT INTO login_attempts(key) VALUES($1)
        ON CONFLICT(key) DO UPDATE SET
        attempts=CASE WHEN login_attempts.started_at < now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,
        started_at=CASE WHEN login_attempts.started_at < now()-interval '15 minutes' THEN now() ELSE login_attempts.started_at END RETURNING attempts`,
        [attemptKey],
      );
      if (attempts.rows[0].attempts > 8) fail(429, 'Too many attempts. Try again in 15 minutes.');
      let user: User;
      if (path[1] === 'register') {
        const name = text(body.name, 80),
          workspace = text(body.workspace, 80),
          id = randomUUID();
        const passwordHash = await hashPassword(password);
        user = await db.transaction(async (tx) => {
          const existing = await tx.query('SELECT id FROM users WHERE email=$1', [email]);
          if (existing.rows.length) fail(409, 'Unable to create this account. Try signing in.');
          const wid = randomUUID();
          await tx.query('INSERT INTO users(id,email,password_hash,name) VALUES($1,$2,$3,$4)', [
            id,
            email,
            passwordHash,
            name,
          ]);
          await tx.query('INSERT INTO workspaces(id,name) VALUES($1,$2)', [wid, workspace]);
          await tx.query("INSERT INTO memberships VALUES($1,$2,'owner')", [wid, id]);
          return { id, email, name };
        });
      } else {
        const result = await db.query<User & { password_hash: string }>(
          'SELECT id,email,name,password_hash FROM users WHERE email=$1',
          [email],
        );
        const found = result.rows[0];
        // Derive even on unknown users to avoid a fast account-existence signal.
        const valid = await verifyPassword(
          password,
          found?.password_hash || `${'0'.repeat(32)}:${'0'.repeat(128)}`,
        );
        if (!found || !valid) fail(401, 'Email or password is incorrect.');
        user = { id: found.id, email: found.email, name: found.name };
      }
      const token = newSession();
      await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '7 days')", [
        digest(token),
        user.id,
      ]);
      await db.query('DELETE FROM login_attempts WHERE key=$1', [attemptKey]);
      const res = NextResponse.json({ user });
      res.cookies.set(sessionCookie, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: req.nextUrl.protocol === 'https:',
        path: '/',
        maxAge: 604800,
      });
      return res;
    }
    const token = req.cookies.get(sessionCookie)?.value;
    if (!token) fail(401, 'Please sign in to continue.');
    const users = await db.query<User>(
      `SELECT u.id,u.email,u.name FROM users u JOIN sessions s ON s.user_id=u.id
      WHERE s.token_hash=$1 AND s.expires_at>now()`,
      [digest(token)],
    );
    const user = users.rows[0];
    if (!user) fail(401, 'Your session expired. Please sign in.');
    if (write && path.join('/') === 'auth/logout') {
      await db.query('DELETE FROM sessions WHERE token_hash=$1', [digest(token)]);
      const res = NextResponse.json({ ok: true });
      res.cookies.delete(sessionCookie);
      return res;
    }
    if (!write && path.join('/') === 'session') {
      const workspaces = await asUser(
        db,
        user.id,
        async (tx) => (await tx.query('SELECT id,name FROM workspaces ORDER BY created_at')).rows,
      );
      return NextResponse.json({ user, workspaces });
    }
    if (write && path.join('/') === 'workspaces') {
      const name = text(body.name, 80),
        id = randomUUID();
      await db.transaction(async (tx) => {
        const count = await tx.query<{ count: number }>(
          'SELECT count(*)::int AS count FROM memberships WHERE user_id=$1',
          [user.id],
        );
        if (count.rows[0].count >= 10)
          fail(400, 'Phase 01 supports up to 10 workspaces per account.');
        await tx.query('INSERT INTO workspaces(id,name) VALUES($1,$2)', [id, name]);
        await tx.query("INSERT INTO memberships VALUES($1,$2,'owner')", [id, user.id]);
      });
      return NextResponse.json({ id, name }, { status: 201 });
    }
    if (path[0] === 'workspaces' && uuid(path[1] || '')) {
      const wid = path[1];
      const member = await asUser(
        db,
        user.id,
        async (tx) => (await tx.query('SELECT id FROM workspaces WHERE id=$1', [wid])).rows.length,
      );
      if (!member) fail(404, 'Workspace not found.');
      if (!write && path.length === 2) {
        const result = await asUser(db, user.id, async (tx) => ({
          datasets: (
            await tx.query(
              'SELECT id,name,row_count,created_at,points FROM datasets WHERE workspace_id=$1 ORDER BY created_at DESC',
              [wid],
            )
          ).rows,
          forecasts: (
            await tx.query(
              'SELECT id,dataset_id,horizon,result,created_at FROM forecasts WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 20',
              [wid],
            )
          ).rows,
        }));
        return NextResponse.json(result);
      }
      if (write && path[2] === 'datasets' && path.length === 3) {
        const name = text(body.name, 120);
        if (typeof body.csv !== 'string') fail(400, 'Choose a CSV file.');
        let points: Point[];
        try {
          points = parseDataset(body.csv);
        } catch (e) {
          fail(400, (e as Error).message);
        }
        const id = randomUUID();
        await asUser(db, user.id, async (tx) => {
          const count = await tx.query<{ count: number }>(
            'SELECT count(*)::int AS count FROM datasets WHERE workspace_id=$1',
            [wid],
          );
          if (count.rows[0].count >= 20)
            fail(400, 'Phase 01 supports up to 20 datasets per workspace.');
          await tx.query(
            'INSERT INTO datasets(id,workspace_id,name,points,row_count) VALUES($1,$2,$3,$4,$5)',
            [id, wid, name, JSON.stringify(points), points!.length],
          );
        });
        return NextResponse.json({ id, name, row_count: points!.length }, { status: 201 });
      }
      if (write && path[2] === 'forecasts' && path.length === 3) {
        const datasetId = text(body.datasetId);
        if (!uuid(datasetId)) fail(400, 'Choose a valid dataset.');
        const horizon = body.horizon;
        if (
          typeof horizon !== 'number' ||
          !Number.isInteger(horizon) ||
          horizon < 1 ||
          horizon > 90
        )
          fail(400, 'Choose a horizon between 1 and 90 days.');
        const datasets = await asUser(
          db,
          user.id,
          async (tx) =>
            await tx.query<{ points: unknown }>(
              'SELECT points FROM datasets WHERE id=$1 AND workspace_id=$2',
              [datasetId, wid],
            ),
        );
        if (!datasets.rows[0]) fail(404, 'Dataset not found.');
        const serviceToken = process.env.FORECAST_SERVICE_TOKEN;
        if (!serviceToken || serviceToken.length < 32)
          fail(503, 'Forecast service is not configured.');
        let response: Response;
        try {
          response = await fetch(
            `${process.env.FORECAST_SERVICE_URL || 'http://127.0.0.1:8001'}/forecast`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${serviceToken}`,
              },
              body: JSON.stringify({ points: datasets.rows[0].points, horizon }),
              signal: AbortSignal.timeout(10000),
              cache: 'no-store',
            },
          );
        } catch {
          fail(503, 'Forecast service unavailable. Your dataset is saved; please try again.');
        }
        if (!response!.ok) fail(503, 'Forecast service could not process this dataset.');
        const result = await response!.json();
        const id = randomUUID();
        await asUser(db, user.id, async (tx) => {
          await tx.query(
            'INSERT INTO forecasts(id,workspace_id,dataset_id,horizon,result) VALUES($1,$2,$3,$4,$5)',
            [id, wid, datasetId, horizon, JSON.stringify(result)],
          );
        });
        return NextResponse.json({ id, dataset_id: datasetId, horizon, result }, { status: 201 });
      }
    }
    fail(404, 'Not found.');
  } catch (e) {
    if (e instanceof BodyTooLargeError)
      return NextResponse.json({ error: 'Request too large.' }, { status: 413 });
    if (e instanceof HttpError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('Forewise request failed', e instanceof Error ? e.name : 'UnknownError');
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
export const GET = handle;
export const POST = handle;
