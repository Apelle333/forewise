import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [320, 390, 768, 1280, 1440, 1920]) {
  test(`Hallmark: expanded scenario data remains readable and contained / ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    if (width >= 1100) {
      const copy = await page.locator('.h-intro-bottom').boundingBox();
      const labels = await page
        .locator('.h-flat svg text')
        .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().left));
      expect(copy).not.toBeNull();
      expect(labels.length).toBeGreaterThan(0);
      expect(Math.min(...labels)).toBeGreaterThanOrEqual(copy!.x + copy!.width + 12);
    }
    await page.getByText('Read the scenario values and method', { exact: true }).click();
    const table = page.getByRole('region', { name: 'Scenario data table' });
    await expect(table).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Date', exact: true })).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .include('.h-data')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await table.focus();
    await expect(table).toBeFocused();
  });
}
