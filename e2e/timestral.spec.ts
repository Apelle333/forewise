import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';

test('real public CSV through dashboard, pinned 209M worker, native quantiles and authorized persisted retrieval', async ({
  page,
  playwright,
}) => {
  test.skip(
    process.env.RUN_TIMESTRAL_INTEGRATION !== '1' || !process.env.TEST_DATABASE_URL,
    'Real model/PostgreSQL integration gate must be enabled',
  );
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  const account = await page.request.post('/api/auth/register', {
    headers: { Origin: 'http://127.0.0.1:3000' },
    data: {
      name: 'Timestral QA',
      workspace: 'Air passenger planning',
      email: `timestral-${Date.now()}@example.test`,
      password: 'Timestral-test-only-123',
    },
  });
  expect(account.ok()).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/workspace');
  await expect(page.getByLabel('CSV frequency')).toBeEnabled();
  await page.getByLabel('CSV frequency').selectOption('monthly');
  await page
    .getByLabel('Choose a CSV', { exact: true })
    .setInputFiles('docs/phase-02b/fixtures/air-passengers.csv');
  await expect(page.getByRole('status')).toContainText('Dataset uploaded');
  await page.getByLabel('Forecasting model', { exact: true }).selectOption('timestral_209m');
  await page.getByRole('spinbutton', { name: /Forecast horizon/ }).fill('12');
  const python = path.resolve(
    process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python',
  );
  const worker = spawn(python, ['services/forecast/worker.py'], {
    cwd: process.cwd(),
    windowsHide: true,
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
    stdio: 'ignore',
  });
  try {
    const submittedPromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/forecast-jobs') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Generate Timestral forecast', exact: false }).click();
    const submitted = await submittedPromise;
    expect(submitted.status()).toBe(202);
    const jobId = (await submitted.json()).jobId;
    await expect(page.getByRole('status')).toContainText('Model forecast ready', {
      timeout: 150000,
    });
    await expect(page.getByTestId('model-result')).toContainText('Timestral 209M');
    await expect(page.getByTestId('prediction-band')).toBeVisible();
    await page.getByRole('slider', { name: /Inspect an observation/ }).focus();
    await page.keyboard.press('End');
    await expect(page.getByTestId('point-readout')).toContainText('1961-12-01');
    await expect(page.getByTestId('point-readout')).toContainText('FORECAST');
    await page.getByText('View data table', { exact: false }).click();
    await expect(page.getByRole('columnheader', { name: 'P10', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'P90', exact: true })).toBeVisible();
    await page.getByText('View data table', { exact: false }).click();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    const session = await (await page.request.get('/api/session')).json();
    const workspace = await (
      await page.request.get(`/api/workspaces/${session.workspaces[0].id}`)
    ).json();
    const result = workspace.forecasts[0].result;
    expect(result.model).toBe('timestral_209m');
    expect(result.metadata.model_id).toBe('mistralai/Timestral-209M');
    expect(result.metadata.revision).toBe('9874d252ab0aae16f7f7c999f98f98d6ad7d8365');
    expect(result.quantiles.p50).toHaveLength(12);
    expect(result.points[0].date).toBe('1961-01-01');
    expect(result.evaluation.windows).toBe(3);
    for (let i = 0; i < 12; i++) {
      expect(result.quantiles.p10[i].value).toBeLessThanOrEqual(result.quantiles.p50[i].value);
      expect(result.quantiles.p50[i].value).toBeLessThanOrEqual(result.quantiles.p90[i].value);
    }
    const other = await playwright.request.newContext({
      baseURL: 'http://127.0.0.1:3000',
      extraHTTPHeaders: { Origin: 'http://127.0.0.1:3000' },
    });
    expect((await other.get(`/api/forecast-jobs/${jobId}`)).status()).toBe(401);
    await other.post('/api/auth/register', {
      data: {
        name: 'Other tenant',
        workspace: 'Other tenant',
        email: `other-timestral-${Date.now()}@example.test`,
        password: 'Other-test-only-passphrase',
      },
    });
    expect((await other.get(`/api/forecast-jobs/${jobId}`)).status()).toBe(404);
    expect((await other.get(`/api/workspaces/${session.workspaces[0].id}`)).status()).toBe(404);
    await other.dispose();
    await fs.mkdir('docs/phase-02b/evidence', { recursive: true });
    await fs.writeFile(
      'docs/phase-02b/evidence/real-air-passengers-result.json',
      JSON.stringify(result, null, 2),
    );
    await page
      .getByRole('region', { name: 'Forecast result', exact: true })
      .screenshot({ path: 'docs/phase-02b/evidence/result-desktop.png' });
    await page.setViewportSize({ width: 768, height: 1024 });
    await page
      .getByRole('region', { name: 'Forecast result', exact: true })
      .screenshot({ path: 'docs/phase-02b/evidence/result-tablet.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page
      .getByRole('region', { name: 'Forecast result', exact: true })
      .screenshot({ path: 'docs/phase-02b/evidence/result-mobile.png' });
    await page.reload();
    await expect(page.getByTestId('model-result')).toContainText('Timestral 209M');
    await expect(page.getByLabel('Forecasting model', { exact: true })).toHaveValue(
      'timestral_209m',
    );
  } finally {
    worker.kill();
  }
});
