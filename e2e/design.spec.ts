import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';

for (const width of [1440, 768, 390]) {
  test(`public design / accessibility / snapshots at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const path of ['/', '/login', '/register']) {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      const a11y = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(
        a11y.violations,
        `${path}: ${JSON.stringify(a11y.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))}`,
      ).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (path === '/')
        await expect(page).toHaveScreenshot(`landing-${width}.png`, {
          fullPage: true,
          animations: 'disabled',
          maxDiffPixelRatio: 0.002,
        });
    }
    expect(errors).toEqual([]);
  });
  test(`workspace design / values / accessibility at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    const register = await page.request.post('/api/auth/register', {
      headers: { Origin: 'http://127.0.0.1:3000' },
      data: {
        name: 'Design QA',
        workspace: 'Design QA workspace',
        email: `visual-${width}-${Date.now()}@example.test`,
        password: 'Visual-test-only-123',
      },
    });
    expect(register.ok()).toBe(true);
    await page.goto('/workspace');
    await expect(page.locator('.notice-mark')).toHaveText('↗');
    await expect(page.locator('.upload-symbol')).toHaveText('↥');
    await expect(page.locator('input[type=file]')).toBeEnabled();
    const empty = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(empty.violations).toEqual([]);
    await page.getByRole('button', { name: 'Try sample data' }).click();
    await expect(page.getByRole('status')).toContainText('Dataset uploaded');
    await page.getByRole('button', { name: 'Generate mock forecast' }).click();
    await expect(page.getByRole('status')).toContainText('Mock forecast ready');
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(result.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('slider', { name: /Inspect a day/ }).focus();
    await page.keyboard.press('End');
    await expect(page.getByTestId('point-readout')).toContainText('MOCK');
    await page.keyboard.press('Home');
    await expect(page.getByTestId('point-readout')).toContainText('OBSERVED');
    await page.getByText('View data table', { exact: false }).click();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('cell', { name: '2026-09-01', exact: true })).toBeVisible();
    await page.getByText('View data table', { exact: false }).click();
    // The dynamic profile and transient success message do not belong in visual baselines.
    await expect(page).toHaveScreenshot(`workspace-${width}.png`, {
      fullPage: true,
      animations: 'disabled',
      mask: [page.locator('.profile'), page.getByRole('status')],
      maxDiffPixelRatio: 0.002,
    });
  });
}

test('demo controls and reduced-motion keyboard behavior', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.getByRole('button', { name: 'Revenue', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Revenue', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByLabel('Preview horizon', { exact: true }).focus();
  await page.keyboard.press('End');
  await expect(page.getByLabel('Preview horizon', { exact: true })).toHaveValue('28');
  await expect(page.locator('.demo-badge')).toContainText('USD');
  expect(
    await page.locator('.future-line').evaluate((e) => getComputedStyle(e).animationName),
  ).toBe('none');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe(
    'auto',
  );
});

test('landing local performance observation', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const metrics = { lcp: 0, cls: 0 };
    Object.assign(window, { __perf: metrics });
    new PerformanceObserver((list) => {
      metrics.lcp = list.getEntries().at(-1)?.startTime || 0;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        hadRecentInput: boolean;
        value: number;
      })[])
        if (!entry.hadRecentInput) metrics.cls += entry.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/', { waitUntil: 'networkidle' });
  const measurements = await page.evaluate(() => ({
    ...(window as unknown as { __perf: { lcp: number; cls: number } }).__perf,
    navigationMs: (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)
      .duration,
    resourceBytes: performance
      .getEntriesByType('resource')
      .reduce((n, r) => n + (r as PerformanceResourceTiming).transferSize, 0),
  }));
  expect(measurements.cls).toBeLessThan(0.1);
  expect(measurements.lcp).toBeGreaterThan(0);
  expect(measurements.lcp).toBeLessThan(2500);
  expect(measurements.resourceBytes).toBeLessThan(500_000);
  await fs.mkdir('docs/design/after', { recursive: true });
  await fs.writeFile('docs/design/after/performance.json', JSON.stringify(measurements, null, 2));
  await testInfo.attach('local-performance', {
    body: JSON.stringify(measurements),
    contentType: 'application/json',
  });
});
