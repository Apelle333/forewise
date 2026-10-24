import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';

const evidence = 'docs/design/polish/after';
for (const width of [1440, 768, 390, 1728]) {
  test(`Horizon 3D, controls, accessibility and visual evidence / ${width}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/');
    await expect(page.locator('.h-stage')).toHaveAttribute('data-renderer', 'webgl', {
      timeout: 15000,
    });
    await page.evaluate(() => document.fonts.ready);
    if (width === 1728) {
      const title = await page.getByRole('heading', { level: 1 }).evaluate((element) => ({
        height: element.getBoundingClientRect().height,
        line: Number.parseFloat(getComputedStyle(element).lineHeight),
      }));
      expect(title.height).toBeLessThanOrEqual(title.line * 2 + 2);
    }
    await fs.mkdir(evidence, { recursive: true });
    await page.screenshot({ path: `${evidence}/horizon-${width}.png`, fullPage: true });
    await page.screenshot({ path: `${evidence}/hero-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const a11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(
      a11y.violations,
      JSON.stringify(
        a11y.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      ),
    ).toEqual([]);
    await page.getByLabel('Scenario horizon', { exact: true }).focus();
    await page.keyboard.press('Home');
    await expect(page.getByLabel('Scenario horizon', { exact: true })).toHaveValue('7');
    await page.getByLabel('Illustrative spread', { exact: true }).focus();
    await page.keyboard.press('End');
    await expect(page.locator('.h-readout')).toContainText('145');
    await page.getByText('Read the scenario values and method', { exact: true }).click();
    await expect(page.locator('.h-data tbody tr')).toHaveCount(7);
    await expect(page.locator('.h-data tbody tr').last()).toContainText('2026-10-05');
    await page.getByRole('button', { name: 'Use 2D view', exact: true }).click();
    await expect(page.locator('.h-canvas canvas')).toHaveCount(0);
    await expect(page.locator('.h-flat svg')).toBeVisible();
    await page.getByRole('button', { name: 'Enable 3D view', exact: true }).click();
    await expect(page.locator('.h-stage')).toHaveAttribute('data-renderer', 'webgl');
    await expect(page.locator('.h-canvas canvas')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

for (const direction of ['horizon', 'observatory', 'atlas']) {
  test(`visual concept demo / ${direction}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto(`/explorations?direction=${direction}`);
    await expect(page.locator('.h-stage')).toHaveAttribute('data-renderer', 'webgl');
    await page.screenshot({ path: `${evidence}/concept-${direction}.png`, fullPage: true });
    await page.getByRole('link', { name: '02 / Signal Observatory' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Find the signal.');
    await expect(page.locator('.h-canvas canvas')).toHaveCount(1);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('reduced motion and unavailable WebGL keep a complete usable alternative', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Enable 3D view' })).toBeVisible();
  await expect(page.locator('.h-canvas canvas')).toHaveCount(0);
  await page.getByLabel('Scenario horizon', { exact: true }).focus();
  await page.keyboard.press('Home');
  await expect(page.locator('.h-readout')).toContainText('DAY 7');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type.startsWith('webgl')) return null;
      return original.apply(this, [type, ...args] as Parameters<typeof original>);
    } as typeof original;
  });
  await page.reload();
  await expect(page.getByRole('status')).toContainText('3D is unavailable');
  await expect(page.locator('.h-flat svg')).toBeVisible();
  await page.screenshot({ path: `${evidence}/webgl-fallback.png` });
  await page.getByText('Read the scenario values and method', { exact: true }).click();
  await expect(page.locator('.h-data tbody tr')).toHaveCount(28);
});

test('WebGL context loss falls back and route changes release the canvas', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.h-stage')).toHaveAttribute('data-renderer', 'webgl');
  await page.locator('.h-canvas canvas').evaluate((canvas: HTMLCanvasElement) => {
    canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
  });
  await expect(page.getByRole('status')).toContainText('3D is unavailable');
  await expect(page.locator('.h-canvas canvas')).toHaveCount(0);
  await page.getByRole('link', { name: 'View the three visual studies' }).click();
  await expect(page.locator('.h-stage')).toHaveAttribute('data-renderer', 'webgl');
  await page.getByRole('link', { name: 'Back to selected design' }).click();
  await expect(page.locator('.h-canvas canvas')).toHaveCount(1);
});

test('scroll unfolds the spatial story while reduced motion removes it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/');
  await page.locator('.h-chapters article').first().scrollIntoViewIfNeeded();
  await expect(page.locator('.h-narrative')).toHaveClass(/is-ready/);
  await page.locator('.h-narrative-canvas').scrollIntoViewIfNeeded();
  await expect(page.locator('.h-narrative-canvas canvas')).toHaveAttribute('data-rendered', 'true');
  await page.screenshot({ path: `${evidence}/story-observe.png` });
  await page.locator('.h-chapters article').last().scrollIntoViewIfNeeded();
  await expect(page.locator('.h-narrative')).toHaveAttribute('data-chapter', '2');
  await page.screenshot({ path: `${evidence}/story-unfolded.png` });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.h-narrative-canvas canvas')).toHaveCount(0);
  await expect(page.locator('.h-narrative')).toBeHidden();
  expect(errors).toEqual([]);
});

test('3D is idle at rest and the operational workspace does not download the renderer', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.assign(window, { __draws: 0 });
    const original = WebGL2RenderingContext.prototype.drawElements;
    WebGL2RenderingContext.prototype.drawElements = function (...args) {
      (window as unknown as { __draws: number }).__draws++;
      return original.apply(this, args);
    };
  });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/');
  await expect(page.locator('.h-stage')).toHaveAttribute('data-renderer', 'webgl');
  const idle = await page.evaluate(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    const before = (window as unknown as { __draws: number }).__draws;
    await new Promise((resolve) => setTimeout(resolve, 350));
    return { before, after: (window as unknown as { __draws: number }).__draws };
  });
  expect(idle.before).toBeGreaterThan(0);
  expect(idle.after).toBe(idle.before);
  const measurements = await page.evaluate(() => ({
    navigationMs: (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)
      .duration,
    resourceBytes: performance
      .getEntriesByType('resource')
      .reduce((sum, r) => sum + (r as PerformanceResourceTiming).transferSize, 0),
    scripts: performance
      .getEntriesByType('resource')
      .filter((r) => (r as PerformanceResourceTiming).initiatorType === 'script')
      .map((r) => r.name),
  }));
  await fs.writeFile(
    `${evidence}/performance-3d.json`,
    JSON.stringify(
      {
        ...measurements,
        idleDrawCalls: idle.after - idle.before,
        environment:
          'Local optimized Chromium, Windows, 1440x960, loopback, no throttling; not field CWV.',
      },
      null,
      2,
    ),
  );
  expect(measurements.resourceBytes).toBeLessThan(500_000);
  const registration = await page.request.post('/api/auth/register', {
    headers: { Origin: 'http://127.0.0.1:3000' },
    data: {
      name: 'Horizon QA',
      workspace: 'Horizon QA',
      email: `horizon-${Date.now()}@example.test`,
      password: 'Horizon-test-only-123',
    },
  });
  expect(registration.ok()).toBe(true);
  // A full navigation gives the workspace its own resource list.
  await page.goto('/workspace');
  await expect(page.locator('canvas')).toHaveCount(0);
  const resources = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((r) => r.name),
  );
  const optionalScripts = measurements.scripts.filter((name) => !resources.includes(name));
  expect(optionalScripts.length).toBeGreaterThan(0);
  await fs.writeFile(
    `${evidence}/workspace-resources.json`,
    JSON.stringify({ resources, landingOnlyScripts: optionalScripts }, null, 2),
  );
});
