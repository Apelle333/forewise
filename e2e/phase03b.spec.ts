import { test, expect, type APIRequestContext } from '@playwright/test';
import { Pool } from 'pg';
import fs from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
const origin = 'http://127.0.0.1:3000';
const csv =
  'units,observed,notes\n' +
  Array.from(
    { length: 10 },
    (_, i) => `${100 + i},2023-01-${String(i + 1).padStart(2, '0')},example`,
  ).join('\n');
async function register(ctx: APIRequestContext, label: string) {
  expect(
    (
      await ctx.post('/api/auth/register', {
        data: {
          name: 'Phase03B QA',
          workspace: label,
          email: `${label}-${Date.now()}-${Math.random()}@example.test`,
          password: 'Local-test-passphrase-only',
        },
      })
    ).status(),
  ).toBe(200);
  return (await (await ctx.get('/api/session')).json()).workspaces[0].id as string;
}
const upload = (name: string, buffer: Buffer, mode = 'preview') => ({
  multipart: {
    file: {
      name,
      mimeType: name.endsWith('.xlsx')
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv',
      buffer,
    },
    mode,
    frequency: 'daily',
    dateCol: '1',
    valueCol: '0',
  },
});

test('authorized import and export enforce tenant boundaries and server validation', async ({
  playwright,
}) => {
  const a = await playwright.request.newContext({
      baseURL: origin,
      extraHTTPHeaders: { Origin: origin },
    }),
    b = await playwright.request.newContext({
      baseURL: origin,
      extraHTTPHeaders: { Origin: origin },
    });
  try {
    expect(
      (
        await a.post(
          '/api/workspaces/00000000-0000-0000-0000-000000000001/datasets/import',
          upload('mapped.csv', Buffer.from(csv)),
        )
      ).status(),
    ).toBe(401);
    const wa = await register(a, 'import-a'),
      wb = await register(b, 'import-b'),
      url = `/api/workspaces/${wa}/datasets/import`;
    expect((await b.post(url, upload('mapped.csv', Buffer.from(csv)))).status()).toBe(404);
    expect(
      (
        await a.post(url, {
          ...upload('mapped.csv', Buffer.from(csv)),
          headers: { Origin: 'https://attacker.example' },
        })
      ).status(),
    ).toBe(403);
    const preview = await a.post(url, upload('mapped.csv', Buffer.from(csv)));
    expect(preview.status()).toBe(200);
    expect((await preview.json()).rowCount).toBe(10);
    expect((await (await a.get(`/api/workspaces/${wa}`)).json()).datasets).toHaveLength(0);
    const imported = await a.post(url, upload('mapped.csv', Buffer.from(csv), 'import'));
    expect(imported.status(), await imported.text()).toBe(201);
    const datasetId = (await imported.json()).id;
    const formula = await fs.readFile('apps/web/tests/fixtures/onboarding/formula_injection.xlsx');
    for (const mode of ['preview', 'import']) {
      const rejected = await a.post(url, upload('formula.xlsx', formula, mode));
      expect(rejected.status()).toBe(400);
      expect((await rejected.json()).error).toContain('Formula');
    }
    const xlsx = await fs.readFile('apps/web/tests/fixtures/onboarding/valid_daily.xlsx');
    const workbook = await a.post(url, {
      multipart: { ...upload('valid.xlsx', xlsx, 'import').multipart, dateCol: '0', valueCol: '1' },
    });
    expect(workbook.status(), await workbook.text()).toBe(201);
    const malformed = await a.post(
      url,
      upload('mapped.csv', Buffer.from(csv.replace('2023-01-02', '2023-01-01')), 'import'),
    );
    expect(malformed.status()).toBe(400);
    const generated = await a.post(`/api/workspaces/${wa}/forecasts`, {
      data: { datasetId, horizon: 3 },
    });
    expect(generated.status()).toBe(201);
    const fid = (await generated.json()).id;
    const download = `/api/workspaces/${wa}/forecasts/${fid}/export?format=csv`;
    expect((await b.get(download)).status()).toBe(404);
    expect(
      (await a.get(`/api/workspaces/${wb}/forecasts/${fid}/export?format=xlsx`)).status(),
    ).toBe(404);
    const exportResponse = await a.get(download);
    expect(exportResponse.status()).toBe(200);
    expect(exportResponse.headers()['cache-control']).toBe('private, no-store');
    expect(await exportResponse.text()).toContain('result.model');
    const anonymous = await playwright.request.newContext({ baseURL: origin });
    expect((await anonymous.get(download)).status()).toBe(401);
    await anonymous.dispose();
    await a.post('/api/auth/logout', { data: {} });
    expect((await a.get(download)).status()).toBe(401);
  } finally {
    await a.dispose();
    await b.dispose();
  }
});

test('manual retries are atomic, tenant-scoped, origin-checked and bounded to three worker attempts', async ({
  playwright,
}) => {
  test.skip(!process.env.TEST_DATABASE_URL, 'Requires real PostgreSQL');
  const db = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const a = await playwright.request.newContext({
      baseURL: origin,
      extraHTTPHeaders: { Origin: origin },
    }),
    b = await playwright.request.newContext({
      baseURL: origin,
      extraHTTPHeaders: { Origin: origin },
    });
  let job = '';
  try {
    const wa = await register(a, 'retry-a');
    await register(b, 'retry-b');
    const saved = await a.post(
      `/api/workspaces/${wa}/datasets/import`,
      upload('mapped.csv', Buffer.from(csv), 'import'),
    );
    expect(saved.status()).toBe(201);
    const accepted = await a.post('/api/forecast-jobs', {
      data: {
        contractVersion: '2',
        workspaceId: wa,
        datasetId: (await saved.json()).id,
        horizon: 1,
        model: 'seasonal_naive',
      },
    });
    expect(accepted.status()).toBe(202);
    job = (await accepted.json()).jobId;
    await db.query(
      "UPDATE forecast_jobs SET status='failed',attempts=1,fence=4,worker_id='expired',lease_expires_at=now()-interval '1 minute' WHERE id=$1",
      [job],
    );
    expect((await b.get(`/api/forecast-jobs?workspaceId=${wa}`)).status()).toBe(404);
    expect((await b.post(`/api/forecast-jobs/${job}/retry`)).status()).toBe(404);
    expect(
      (await a.post(`/api/forecast-jobs/${job}/retry`, { headers: { Origin: '' } })).status(),
    ).toBe(403);
    const responses = await Promise.all([
      a.post(`/api/forecast-jobs/${job}/retry`),
      a.post(`/api/forecast-jobs/${job}/retry`),
    ]);
    expect(responses.map((r) => r.status()).sort()).toEqual([202, 409]);
    const state = (await db.query('SELECT * FROM forecast_jobs WHERE id=$1', [job])).rows[0];
    expect(state.attempts).toBe(1);
    expect(Number(state.fence)).toBe(5);
    expect(state.worker_id).toBeNull();
    expect(state.lease_expires_at).toBeNull();
    await db.query("UPDATE forecast_jobs SET status='failed',attempts=3 WHERE id=$1", [job]);
    expect((await a.post(`/api/forecast-jobs/${job}/retry`)).status()).toBe(409);
    await db.query("UPDATE forecast_jobs SET status='failed',attempts=1 WHERE id=$1", [job]);
    await db.query(
      `INSERT INTO forecast_jobs(id,workspace_id,dataset_id,status,payload)
      SELECT gen_random_uuid(),workspace_id,dataset_id,'pending',payload FROM forecast_jobs CROSS JOIN generate_series(1,20) WHERE id=$1`,
      [job],
    );
    expect((await a.post(`/api/forecast-jobs/${job}/retry`)).status()).toBe(409);
    const quota = await a.post('/api/forecast-jobs', {
      data: {
        contractVersion: '2',
        workspaceId: wa.toUpperCase(),
        datasetId: state.dataset_id,
        horizon: 1,
        model: 'seasonal_naive',
      },
    });
    expect(quota.status()).toBe(429);
    await db.query('DELETE FROM forecast_jobs WHERE workspace_id=$1 AND id<>$2', [wa, job]);
    await db.query('UPDATE forecast_jobs SET attempts=3 WHERE id=$1', [job]);
    const listed = (await (await a.get(`/api/forecast-jobs?workspaceId=${wa}`)).json()).jobs;
    expect(listed[0].dataset_id).toBeTruthy();
    expect(listed[0].attempts).toBe(3);
  } finally {
    if (job)
      await db.query(
        'DELETE FROM forecast_jobs WHERE workspace_id=(SELECT workspace_id FROM forecast_jobs WHERE id=$1)',
        [job],
      );
    await db.end();
    await a.dispose();
    await b.dispose();
  }
});

test('onboarding remains keyboard usable, keeps failed imports open and fits mobile/tablet/desktop', async ({
  page,
}) => {
  const registered = await page.request.post('/api/auth/register', {
    headers: { Origin: origin },
    data: {
      name: 'Onboarding QA',
      workspace: 'Synthetic import preview',
      email: `onboarding-${Date.now()}@example.test`,
      password: 'Local-test-passphrase-only',
    },
  });
  expect(registered.status()).toBe(200);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/workspace');
  await page.getByRole('button', { name: 'Import data', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Import data', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Import data', exact: true }).click();
  await page
    .getByLabel('Choose a CSV or XLSX')
    .setInputFiles({ name: 'Mapped demand.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByLabel('Date column').selectOption('0');
  await page.getByLabel('Value column').selectOption('1');
  await page.getByRole('button', { name: 'Import dataset', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Invalid date');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Date column').selectOption('1');
  await page.getByLabel('Value column').selectOption('0');
  await fs.mkdir('docs/phase-03b/evidence', { recursive: true });
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 960 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: `docs/phase-03b/evidence/onboarding-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole('button', { name: 'Import dataset', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Mapped demand.csv', exact: true })).toBeVisible();
});

test('concurrent canonical and mapped uploads share the same tenant quota lock', async ({
  playwright,
}) => {
  test.skip(!process.env.TEST_DATABASE_URL, 'Requires real PostgreSQL');
  const db = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const ctx = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
  });
  try {
    const wid = await register(ctx, 'quota');
    const points = Array.from({ length: 10 }, (_, i) => ({
      date: `2023-01-${String(i + 1).padStart(2, '0')}`,
      value: i,
    }));
    await db.query(
      `INSERT INTO datasets(id,workspace_id,name,points,row_count) SELECT gen_random_uuid(),$1,'Quota fixture',$2,10 FROM generate_series(1,19)`,
      [wid, JSON.stringify(points)],
    );
    const responses = await Promise.all([
      ctx.post(
        `/api/workspaces/${wid.toUpperCase()}/datasets/import`,
        upload('quota.csv', Buffer.from(csv), 'import'),
      ),
      ctx.post(`/api/workspaces/${wid}/datasets`, {
        data: {
          name: 'Canonical quota',
          csv: 'date,value\n' + points.map((p) => `${p.date},${p.value}`).join('\n'),
        },
      }),
    ]);
    expect(responses.map((r) => r.status()).sort()).toEqual([201, 400]);
    expect((await (await ctx.get(`/api/workspaces/${wid}`)).json()).datasets).toHaveLength(20);
  } finally {
    await db.end();
    await ctx.dispose();
  }
});

test('Jobs opens the exact authorized result even outside the latest twenty forecasts', async ({
  page,
}) => {
  test.skip(!process.env.TEST_DATABASE_URL, 'Requires real PostgreSQL');
  const db = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  let job = '';
  try {
    const signup = await page.request.post('/api/auth/register', {
      headers: { Origin: origin },
      data: {
        name: 'Saved run QA',
        workspace: 'Older run fixture',
        email: `older-${Date.now()}@example.test`,
        password: 'Local-test-passphrase-only',
      },
    });
    expect(signup.status()).toBe(200);
    const wid = (await (await page.request.get('/api/session')).json()).workspaces[0].id;
    const imported = await page.request.post(`/api/workspaces/${wid}/datasets/import`, {
      headers: { Origin: origin },
      ...upload('history.csv', Buffer.from(csv), 'import'),
    });
    expect(imported.status()).toBe(201);
    const did = (await imported.json()).id;
    const create = async (horizon: number) => {
      const res = await page.request.post(`/api/workspaces/${wid}/forecasts`, {
        headers: { Origin: origin },
        data: { datasetId: did, horizon },
      });
      expect(res.status()).toBe(201);
      return res.json();
    };
    const oldest = await create(3);
    for (let i = 0; i < 20; i++) await create(7);
    const recent = (await (await page.request.get(`/api/workspaces/${wid}`)).json()).forecasts;
    expect(recent.some((f: { id: string }) => f.id === oldest.id)).toBe(false);
    const seeded = await db.query(
      `INSERT INTO forecast_jobs(id,workspace_id,dataset_id,status,payload,result_id,attempts)
      VALUES(gen_random_uuid(),$1,$2,'completed',$3,$4,1) RETURNING id`,
      [wid, did, JSON.stringify({ model: 'seasonal_naive', horizon: 3 }), oldest.id],
    );
    job = seeded.rows[0].id;
    await page.goto('/workspace');
    await page.getByRole('button', { name: /02 Jobs/ }).click();
    await page.getByRole('button', { name: 'View result', exact: true }).click();
    await expect(page.getByLabel('Saved forecast')).toHaveValue(oldest.id);
    await expect(page.getByRole('region', { name: 'Forecast result', exact: true })).toContainText(
      '3-step mock forecast',
    );
  } finally {
    if (job) await db.query('DELETE FROM forecast_jobs WHERE id=$1', [job]);
    await db.end();
  }
});
