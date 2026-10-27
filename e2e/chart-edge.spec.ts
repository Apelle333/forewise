import { test, expect } from '@playwright/test';
test('signed data stays inside the plot and exact values remain available', async ({ page }) => {
  const result = await page.request.post('/api/auth/register', {
    headers: { Origin: 'http://127.0.0.1:3000' },
    data: {
      name: 'Signed series QA',
      workspace: 'Signed series',
      email: `signed-${Date.now()}@example.test`,
      password: 'Chart-test-only-123',
    },
  });
  expect(result.ok()).toBe(true);
  await page.goto('/workspace');
  await page.getByRole('button', { name: 'Import data', exact: true }).click();
  await expect(page.locator('input[type=file]')).toBeEnabled();
  const csv =
    'date,value\n' +
    Array.from(
      { length: 8 },
      (_, i) => `2026-10-${String(i + 1).padStart(2, '0')},${-100 + i * 10}`,
    ).join('\n');
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'Net change.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.getByRole('button', { name: 'Import dataset', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Dataset saved');
  const coordinates = await page.locator('.history-line').getAttribute('points');
  for (const pair of coordinates!.split(' ')) {
    const y = Number(pair.split(',')[1]);
    expect(Number.isFinite(y)).toBe(true);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(260);
  }
  await page.getByRole('slider', { name: /Inspect a day/ }).focus();
  await page.keyboard.press('Home');
  await expect(page.getByTestId('point-readout')).toContainText('-100');
  await page.getByText('View data table', { exact: false }).click();
  await expect(page.getByRole('cell', { name: '-100', exact: true })).toBeVisible();
});
