import { test, expect } from '@playwright/test';

for (const width of [1440, 768, 390]) {
  test(`Phase 01 public CTA destinations and immediate demo access / ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('.h-intro')).toContainText('workspace in development');
    await expect(page.locator('.h-intro')).toContainText('CSV/XLSX history: date + value');
    await expect(page.locator('.h-intro')).toContainText('authenticated development workspace');
    await expect(page.locator('.h-preview-note')).not.toContainText('unavailable');
    await expect(page.locator('.h-intro')).toContainText('not validated predictions');
    const entry = page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Try demo' });
    const bounds = await entry.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y + bounds!.height).toBeLessThan(120);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await entry.click();
    await expect(page).toHaveURL(/\/#demo$/);
    await expect(page.getByRole('button', { name: 'Demand', exact: true })).toBeInViewport();
    await page.screenshot({ path: `docs/design/polish/after/demo-${width}.png` });

    // Follow each visible public link, including duplicate actions in different contexts.
    const links = await page.locator('a[href]').evaluateAll((elements) =>
      elements
        .map((element, index) => ({
          index,
          href: element.getAttribute('href')!,
          visible:
            getComputedStyle(element).display !== 'none' &&
            element.getBoundingClientRect().width > 0,
          skip: element.textContent?.includes('Skip to content'),
        }))
        .filter((link) => link.visible && !link.skip),
    );
    for (const link of links) {
      expect(link.href).not.toMatch(/\/(login|register|workspace)(?:\/|$)/);
      await page.goto('/');
      await page.locator('a[href]').nth(link.index).click();
      if (link.href.startsWith('#')) {
        await expect(page).toHaveURL(new RegExp(`${link.href}$`));
        await expect(page.locator(link.href)).toBeInViewport();
      } else if (link.href === '/explorations') {
        await expect(page.getByRole('navigation', { name: 'Visual directions' })).toBeVisible();
        for (const [name, title] of [
          ['02 / Signal Observatory', 'Find the signal.'],
          ['03 / Tidal Atlas', 'Tomorrow has'],
          ['01 / Forecast Horizon', 'A wider view'],
        ]) {
          await page.getByRole('link', { name, exact: true }).click();
          await expect(page.getByRole('heading', { level: 1 })).toContainText(title);
        }
        await page.getByRole('link', { name: 'Explore scenarios', exact: false }).click();
        await expect(page.getByLabel('Scenario horizon', { exact: true })).toBeInViewport();
        await page.getByRole('link', { name: 'Back to selected design', exact: false }).click();
        await expect(page).toHaveURL('/');
      } else {
        await expect(page).toHaveURL('/');
      }
    }
  });
}

test('mobile scenario controls retain visible feedback and keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('link', { name: 'Explore scenarios ↓', exact: true }).click();
  const horizon = page.getByLabel('Scenario horizon', { exact: true });
  await horizon.focus();
  await page.keyboard.press('Home');
  await expect(horizon).toHaveValue('7');
  await expect(page.locator('.h-readout')).toContainText('DAY 7');
  await expect(page.locator('.h-readout')).toBeInViewport();
  const stage = await page.locator('.h-stage').boundingBox();
  const input = await horizon.boundingBox();
  expect(stage!.y + stage!.height).toBeLessThanOrEqual(input!.y);
  await page.getByLabel('Illustrative spread', { exact: true }).focus();
  await page.keyboard.press('End');
  await expect(page.locator('.h-readout')).toContainText('145');
  await expect(page.getByLabel('Illustrative spread', { exact: true })).toBeInViewport();
  await page.screenshot({ path: 'docs/design/polish/after/controls-390.png' });
  await page.getByText('Read the scenario values and method', { exact: true }).click();
  await expect(page.locator('.h-data tbody tr')).toHaveCount(7);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
