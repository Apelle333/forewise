import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

test('PostgreSQL CSV → durable job → standalone worker → authorized baseline retrieval', async ({
  playwright,
}) => {
  test.skip(
    !process.env.TEST_DATABASE_URL,
    'Requires the isolated PostgreSQL test database and matching server.',
  );
  test.setTimeout(90000);
  const origin = 'http://127.0.0.1:3000';
  const a = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
  });
  const b = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
  });
  try {
    for (const [ctx, label] of [
      [a, 'A'],
      [b, 'B'],
    ] as const) {
      expect(
        (
          await ctx.post('/api/auth/register', {
            data: {
              name: `Job QA ${label}`,
              workspace: `Job QA ${label}`,
              email: `jobs-${label}-${Date.now()}@example.test`,
              password: 'Job-test-only-password-123',
            },
          })
        ).status(),
      ).toBe(200);
    }
    const wa = (await (await a.get('/api/session')).json()).workspaces[0].id;
    const wb = (await (await b.get('/api/session')).json()).workspaces[0].id;
    for (const frequency of ['daily', 'weekly', 'monthly']) {
      const dates = Array.from({ length: 40 }, (_, i) =>
        new Date(
          Date.UTC(
            2026,
            frequency === 'monthly' ? i : 0,
            frequency === 'monthly' ? 1 : 1 + i * (frequency === 'weekly' ? 7 : 1),
          ),
        )
          .toISOString()
          .slice(0, 10),
      );
      const csv = 'date,value\n' + dates.map((date, i) => `${date},${100 + i}`).join('\n');
      const upload = await a.post(`/api/workspaces/${wa}/datasets`, {
        data: { name: `${frequency}.csv`, csv, frequency },
      });
      expect(upload.status()).toBe(201);
      const datasetId = (await upload.json()).id;
      const body = {
        contractVersion: frequency === 'weekly' ? '2' : '1',
        ...(frequency === 'weekly' ? { model: 'seasonal_naive' } : {}),
        workspaceId: wa,
        datasetId,
        horizon: 3,
      };
      for (const model of ['unknown', null, ['timestral_209m']]) {
        expect(
          (
            await a.post('/api/forecast-jobs', {
              data: { ...body, contractVersion: '2', model },
            })
          ).status(),
        ).toBe(400);
      }
      expect((await b.post('/api/forecast-jobs', { data: body })).status()).toBe(404);
      expect(
        (await b.post('/api/forecast-jobs', { data: { ...body, workspaceId: wb } })).status(),
      ).toBe(404);
      expect(
        (
          await a.post('/api/forecast-jobs', {
            headers: { Origin: 'https://attacker.example' },
            data: body,
          })
        ).status(),
      ).toBe(403);
      expect((await a.post('/api/forecast-jobs', { data: { ...body, points: [] } })).status()).toBe(
        400,
      );
      expect(
        (await a.post('/api/forecast-jobs', { data: { ...body, horizon: true } })).status(),
      ).toBe(400);
      const submitted = await a.post('/api/forecast-jobs', { data: body });
      expect(submitted.status()).toBe(202);
      const job = (await submitted.json()).jobId;
      const location = `/api/forecast-jobs/${job}`;
      expect(submitted.headers().location).toBe(location);
      expect((await b.get(location)).status()).toBe(404);
      const queued = await a.get(location);
      expect((await queued.json()).status).toBe('pending');
      expect(queued.headers()['cache-control']).toBe('no-store');
      const python = path.resolve(
        process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python',
      );
      const worker = spawnSync(python, ['services/forecast/worker.py', '--once'], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
        encoding: 'utf8',
        timeout: 60000,
      });
      expect(worker.status, worker.stderr).toBe(0);
      const completed = await (await a.get(location)).json();
      expect(completed.status).toBe('completed');
      expect(completed.contractVersion).toBe(body.contractVersion);
      expect(completed.attempts).toBe(1);
      expect(completed.result_id).toBeTruthy();
      expect(completed.result.model).toBe('seasonal-naive-v1');
      expect(completed.result.frequency).toBe(frequency);
      expect(completed.result.points).toHaveLength(3);
      expect(completed.result.points[0].value).toBe(frequency === 'daily' ? 133 : 139);
      expect(completed.result.evaluation.windows).toBe(3);
      expect(completed.result.metrics.mae).toBe(frequency === 'daily' ? 7 : 2);
      expect(completed.result.validated).toBe(false);
      expect(completed.result.quantiles).toBeNull();
      expect((await b.get(location)).status()).toBe(404);
      const foreign = await (await b.get(`/api/workspaces/${wb}`)).json();
      expect(foreign.forecasts).toHaveLength(0);
    }
    const cookies = await a.storageState();
    await a.post('/api/auth/logout', { data: {} });
    const revoked = await playwright.request.newContext({ baseURL: origin, storageState: cookies });
    expect(
      (await revoked.get('/api/forecast-jobs/00000000-0000-0000-0000-000000000001')).status(),
    ).toBe(401);
    await revoked.dispose();
  } finally {
    await a.dispose();
    await b.dispose();
  }
});
