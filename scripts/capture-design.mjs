import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const stage = process.argv[2] || 'before';
if (!/^(before|pass-1|pass-2|pass-3|after)$/.test(stage)) throw new Error('Invalid capture stage');
const out = path.resolve('docs/design', stage);
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const problems = [];
page.on('pageerror', (e) => problems.push({ type: 'pageerror', message: e.message }));
page.on('requestfailed', (request) =>
  problems.push({
    type: 'requestfailed',
    url: request.url(),
    message: request.failure()?.errorText,
  }),
);
const measurements = [];
await page.addInitScript(() => {
  window.__designMetrics = { lcp: null, cls: 0 };
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    window.__designMetrics.lcp = entries.at(-1)?.startTime;
  }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries())
      if (!entry.hadRecentInput) window.__designMetrics.cls += entry.value;
  }).observe({ type: 'layout-shift', buffered: true });
});

async function capture(name) {
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      window.scrollTo(0, 0);
    });
    await page.screenshot({ path: path.join(out, `${name}-${width}.png`), fullPage: true });
    measurements.push({
      name,
      width,
      ...(await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        ...window.__designMetrics,
        navigationMs: performance.getEntriesByType('navigation')[0]?.duration,
        resourceBytes: performance
          .getEntriesByType('resource')
          .reduce((n, r) => n + r.transferSize, 0),
      }))),
    });
  }
  await page.setViewportSize({ width: 1440, height: 960 });
}
try {
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle' });
  await capture('landing');
  await page.getByRole('link', { name: 'Sign in', exact: false }).first().click();
  await capture('login');
  await page.getByLabel('Work email').fill(`unknown-${Date.now()}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('Audit-only-password-123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.locator('.error[role=alert]').waitFor();
  await capture('login-error');
  await page.goto('http://127.0.0.1:3000/register');
  await capture('register');
  await page.getByLabel('Your name').fill('Alex Morgan');
  await page.getByLabel('Workspace name', { exact: true }).fill('Northstar Planning');
  await page.getByLabel('Work email').fill(`design-${stage}-${Date.now()}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('Audit-only-password-123');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await page.waitForURL('**/workspace');
  await page.locator('input[type=file]').waitFor();
  await page.waitForFunction(() => !document.querySelector('input[type=file]')?.disabled);
  await capture('workspace-empty');
  let releaseLoading;
  const loadingGate = new Promise((resolve) => {
    releaseLoading = resolve;
  });
  await page.route('**/api/session', async (route) => {
    await loadingGate;
    await route.continue();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.workspace-main').waitFor();
  await capture('workspace-loading-simulated');
  const loadedSession = page.waitForResponse((response) => response.url().endsWith('/api/session'));
  releaseLoading();
  await loadedSession;
  await page.unroute('**/api/session');
  await page.waitForFunction(() => !document.querySelector('input[type=file]')?.disabled);
  await page.locator('input[type=file]').setInputFiles({
    name: 'bad.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('date,value\ninvalid,no'),
  });
  await page.locator('.error[role=alert]').waitFor();
  await capture('upload-error');
  await page.getByRole('button', { name: 'Try sample data', exact: false }).click();
  await page.getByRole('status').filter({ hasText: 'Dataset uploaded' }).waitFor();
  await capture('dataset-ready');
  await page.getByRole('button', { name: 'Generate mock forecast' }).click();
  await page.getByRole('status').filter({ hasText: 'Mock forecast ready' }).waitFor();
  await capture('workspace-result');
  await page.route('**/api/workspaces/*/forecasts', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Forecast service unavailable. Your dataset is saved; please try again.',
      }),
    }),
  );
  await page.getByRole('button', { name: 'Generate mock forecast' }).click();
  await page.locator('.error[role=alert]').waitFor();
  await capture('service-error-simulated');
  await writeFile(
    path.join(out, 'observations.json'),
    JSON.stringify(
      {
        stage,
        measurements,
        problems,
        simulated: [
          'service-error-simulated uses Playwright HTTP 503 response injection',
          'workspace-loading-simulated delays session HTTP response',
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      stage,
      captures: measurements.length,
      overflows: measurements.filter((m) => m.overflow),
      problems,
    }),
  );
} finally {
  await browser.close();
}
