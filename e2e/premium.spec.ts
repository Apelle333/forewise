import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { phase03bEvidencePath } from './evidence';

for (const width of [1440, 768, 390]) {
  test(`premium timeline and native instrument are readable and keyboard usable / ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const slider = page.getByRole('slider', { name: 'Inspect horizon timeline', exact: true });
    await slider.focus();
    await page.keyboard.press('Home');
    await expect(page.getByTestId('horizon-inspection')).toContainText('Historical sample');
    await expect(page.getByTestId('horizon-inspection')).toContainText('104');
    await page.keyboard.press('End');
    await expect(page.getByTestId('horizon-inspection')).toContainText('Illustrative future');
    await expect(page.getByTestId('horizon-inspection')).toContainText('106 to 216');
    await page.getByRole('button', { name: 'Hide illustrative range', exact: true }).click();
    await expect(page.getByTestId('scenario-range')).toHaveCount(0);
    await page.getByRole('button', { name: 'Show illustrative range', exact: true }).click();
    await expect(page.getByTestId('scenario-range')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Play motion', exact: true })).toBeDisabled();
    const model = page.locator('#forecast-pipeline .fi-step-model');
    await model.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(model).toHaveJSProperty('open', true);
    await expect(page.locator('#forecast-pipeline .fi-step-data')).toHaveJSProperty('open', false);
    await expect(model.locator('.fi-detail')).toContainText('Timestral');
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
    await page
      .locator('#forecast-pipeline')
      .screenshot({ path: phase03bEvidencePath(`instrument-${width}.png`) });
    await page
      .locator('.h-inspection')
      .screenshot({ path: phase03bEvidencePath(`inspection-${width}.png`) });
  });
}

test('cinematic playback pauses, resets, resumes and suspends when offscreen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('.h-stage')).toHaveAttribute('data-renderer', 'webgl');
  await page.locator('.h-stage').scrollIntoViewIfNeeded();
  const canvas = page.locator('.h-canvas canvas');
  await page.getByRole('button', { name: 'Play motion', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-playing', 'true');
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-motion-time')))
    .toBeGreaterThan(0.25);
  await page.getByRole('button', { name: 'Pause motion', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-playing', 'false');
  const paused = await canvas.getAttribute('data-motion-time');
  await page.waitForTimeout(200);
  expect(await canvas.getAttribute('data-motion-time')).toBe(paused);
  await page.getByRole('button', { name: 'Reset motion', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-motion-time', '0.000');
  await page.getByRole('button', { name: 'Play motion', exact: true }).click();
  await page.locator('#forecast-pipeline').scrollIntoViewIfNeeded();
  await expect(canvas).toHaveAttribute('data-playing', 'false');
  const hidden = await canvas.getAttribute('data-motion-time');
  await page.waitForTimeout(200);
  expect(await canvas.getAttribute('data-motion-time')).toBe(hidden);
  await page.locator('.h-stage').scrollIntoViewIfNeeded();
  await expect(canvas).toHaveAttribute('data-playing', 'true');
  await page.getByRole('button', { name: 'Pause motion', exact: true }).click();
});

test('the instrument and analytical fallback remain usable without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 1000 },
  });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:3000/');
    await expect(page.locator('.h-flat svg')).toBeVisible();
    const review = page.locator('#forecast-pipeline .fi-step-review');
    await review.locator('summary').click();
    await expect(review.locator('.fi-detail')).toBeVisible();
    await expect(review.locator('.fi-detail')).toContainText('coverage');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  } finally {
    await context.close();
  }
});

for (const format of ['csv', 'xlsx']) {
  test(`onboarding accepts a real ${format.toUpperCase()} drop and explains the mapping`, async ({
    page,
  }) => {
    const fs = await import('node:fs/promises');
    const bytes = await fs.readFile(`apps/web/tests/fixtures/onboarding/valid_daily.${format}`);
    expect(
      (
        await page.request.post('/api/auth/register', {
          headers: { Origin: 'http://127.0.0.1:3000' },
          data: {
            name: 'Interaction QA',
            workspace: 'File entry QA',
            email: `drop-${format}-${Date.now()}@example.test`,
            password: 'Local-visual-test-only-123',
          },
        })
      ).status(),
    ).toBe(200);
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/workspace');
    await page.getByRole('button', { name: 'Import data', exact: true }).click();
    const transfer = await page.evaluateHandle(
      ({ encoded, format }) => {
        const data = new DataTransfer();
        data.items.add(
          new File([Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))], `demand.${format}`, {
            type:
              format === 'csv'
                ? 'text/csv'
                : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }),
        );
        return data;
      },
      { encoded: bytes.toString('base64'), format },
    );
    await page.locator('.import-dropzone').dispatchEvent('dragenter', { dataTransfer: transfer });
    await expect(page.locator('.import-dropzone')).toHaveAttribute('data-dragging', 'true');
    await page.locator('.import-dropzone').dispatchEvent('drop', { dataTransfer: transfer });
    await expect(page.locator('.import-file-summary')).toContainText(`demand.${format}`);
    await expect(page.locator('.import-file-summary')).toContainText('10 observations');
    await expect(page.locator('.import-mapping-feedback')).toContainText('Daily periods');
    await page.getByLabel('Value column').selectOption('0');
    await expect(page.getByRole('button', { name: 'Import dataset', exact: true })).toBeDisabled();
    await expect(page.locator('.import-mapping-feedback')).toContainText('different');
    await page.getByLabel('Value column').selectOption('1');
    await expect(page.getByRole('button', { name: 'Import dataset', exact: true })).toBeEnabled();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page
      .getByRole('dialog')
      .screenshot({ path: phase03bEvidencePath(`file-entry-${format}-390.png`) });
    await page.getByLabel('Value column').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Observation frequency')).toBeFocused();
    await expect(page.getByLabel('Observation frequency')).toBeInViewport();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.import-mapping-feedback')).toContainText('Weekly periods');
    await page
      .getByRole('dialog')
      .screenshot({ path: phase03bEvidencePath(`file-frequency-${format}-390.png`) });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Import data', exact: true })).toBeFocused();
  });
}
