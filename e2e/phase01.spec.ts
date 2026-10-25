import { test, expect } from '@playwright/test';
import path from 'node:path';
const origin = 'http://127.0.0.1:3000';
const csv =
  'date,value\n' +
  Array.from({ length: 14 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')},${100 + i}`).join(
    '\n',
  );
const unique = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

test('landing is responsive and accessible by keyboard', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('A wider view');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.getByRole('heading', { level: 1 }).click();
  await page.screenshot({
    path: path.resolve('docs/screenshots/landing-desktop.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.resolve('docs/screenshots/landing-mobile.png'),
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.locator('.h-nav').getByRole('link', { name: 'Try demo' }).click();
  await expect(page).toHaveURL(/#demo$/);
  await expect(page.getByRole('button', { name: 'Demand', exact: true })).toBeVisible();
});

test('real registration, CSV upload, mock forecast, persistence, workspace switch and sign out', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const email = `owner-${unique()}@example.test`,
    password = 'Test-only-passphrase-123';
  await page.goto('/workspace');
  await expect(page).toHaveURL(/login/);
  await page.goto('/register');
  await page.getByLabel('Your name').fill('Alex Morgan');
  await page.getByLabel('Workspace name', { exact: true }).fill('Acme Planning');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page).toHaveURL(/workspace/);
  await expect(page.getByRole('heading', { name: 'A clearer view ahead.' })).toBeVisible();
  await page.getByRole('button', { name: 'Import data', exact: true }).click();
  await expect(page.locator('input[type=file]')).toBeEnabled();
  await page.locator('input[type=file]').setInputFiles({
    name: 'invalid.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('date,value\ninvalid,no'),
  });
  await expect(page.locator('.error[role=alert]')).toContainText('between 8 and 5,000');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Try sample data' }).click();
  await expect(page.getByRole('status')).toContainText('Dataset uploaded');
  await page.getByRole('button', { name: /01 Datasets/ }).click();
  await page.getByRole('button', { name: 'Import data', exact: true }).click();
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'Revenue trend.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.getByRole('button', { name: 'Import dataset', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Revenue trend.csv', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Generate mock forecast' }).click();
  await expect(page.getByRole('status')).toContainText('Mock forecast ready');
  await expect(
    page.getByText('Not a validated prediction; do not use for business decisions.', {
      exact: false,
    }),
  ).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  expect((await download).suggestedFilename()).toMatch(/^forewise-[0-9a-f-]+\.csv$/);
  await page.reload();
  await page.getByRole('button', { name: /03 Results/ }).click();
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
  await page.screenshot({
    path: path.resolve('docs/screenshots/workspace-desktop.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.resolve('docs/screenshots/workspace-mobile.png'),
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'New workspace' }).click();
  await page.getByLabel('Workspace name', { exact: true }).fill('Empty workspace');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Try sample data' })).toBeVisible();
  await expect(page.getByRole('button', { name: /03 Results/ })).toBeDisabled();
  await page.getByLabel('Workspace', { exact: true }).selectOption({ label: 'Acme Planning' });
  await page.getByRole('button', { name: /03 Results/ }).click();
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/login/);
  await page.goto('/workspace');
  await expect(page).toHaveURL(/login/);
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: false }).click();
  await expect(page).toHaveURL(/workspace/);
  expect(errors).toEqual([]);
});

test('API enforces authentication, CSRF, rate limits, tenant isolation, invalid CSV and service contract', async ({
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
    expect((await a.get('/api/session')).status()).toBe(401);
    for (const [ctx, name] of [
      [a, 'A'],
      [b, 'B'],
    ] as const) {
      expect(
        (
          await ctx.post('/api/auth/register', {
            data: {
              name,
              workspace: `Tenant ${name}`,
              email: `${name}-${unique()}@example.test`,
              password: 'Test-only-passphrase-123',
            },
          })
        ).status(),
      ).toBe(200);
    }
    const wa = (await (await a.get('/api/session')).json()).workspaces[0].id,
      wb = (await (await b.get('/api/session')).json()).workspaces[0].id;
    expect((await b.get(`/api/workspaces/${wa}`)).status()).toBe(404);
    expect(
      (await b.post(`/api/workspaces/${wa}/datasets`, { data: { name: 'attack', csv } })).status(),
    ).toBe(404);
    const uploaded = await a.post(`/api/workspaces/${wa}/datasets`, {
      data: { name: 'Real upload.csv', csv },
    });
    expect(uploaded.status()).toBe(201);
    const did = (await uploaded.json()).id;
    expect((await a.post('/api/auth/register/extra', { data: {} })).status()).toBe(404);
    expect(
      (
        await a.post(`/api/workspaces/${wa}/datasets`, {
          data: { name: 'too-large.csv', csv: 'x'.repeat(1_100_001) },
        })
      ).status(),
    ).toBe(413);
    expect(
      (
        await b.post(`/api/workspaces/${wb}/forecasts`, { data: { datasetId: did, horizon: 7 } })
      ).status(),
    ).toBe(404);
    expect((await b.get(`/api/workspaces/${wb}`)).ok()).toBe(true);
    expect((await (await b.get(`/api/workspaces/${wb}`)).json()).datasets).toHaveLength(0);
    expect(
      (
        await a.post(`/api/workspaces/${wa}/datasets`, {
          data: { name: 'bad.csv', csv: 'date,value\n2026-10-01,no' },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await a.post(`/api/workspaces/${wa}/forecasts`, { data: { datasetId: did, horizon: 91 } })
      ).status(),
    ).toBe(400);
    const forecast = await a.post(`/api/workspaces/${wa}/forecasts`, {
      data: { datasetId: did, horizon: 7 },
    });
    expect(forecast.status()).toBe(201);
    expect((await forecast.json()).result.mock).toBe(true);
    expect(
      (
        await a.post('/api/workspaces', {
          headers: { Origin: 'https://attacker.example' },
          data: { name: 'forged' },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await a.post('/api/workspaces', {
          headers: { Origin: '' },
          data: { name: 'missing origin' },
        })
      ).status(),
    ).toBe(403);
    const unknown = `unknown-${unique()}@example.test`;
    for (let i = 0; i < 8; i++)
      expect(
        (
          await a.post('/api/auth/login', {
            data: { email: unknown, password: 'wrong-password-123' },
          })
        ).status(),
      ).toBe(401);
    expect(
      (
        await a.post('/api/auth/login', {
          data: { email: unknown, password: 'wrong-password-123' },
        })
      ).status(),
    ).toBe(429);
    const cookies = await a.storageState();
    expect(cookies.cookies[0].httpOnly).toBe(true);
    expect(cookies.cookies[0].sameSite).toBe('Lax');
    await a.post('/api/auth/logout', { data: {} });
    expect((await a.get('/api/session')).status()).toBe(401);
    const replay = await playwright.request.newContext({ baseURL: origin, storageState: cookies });
    expect((await replay.get('/api/session')).status()).toBe(401);
    await replay.dispose();
  } finally {
    await a.dispose();
    await b.dispose();
  }
});
