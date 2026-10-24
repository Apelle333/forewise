import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
const results = [];
const stage = process.argv[2] || 'before';
if (!['before', 'after'].includes(stage)) throw new Error('Invalid audit stage');
try {
  for (const pathname of ['/', '/login', '/register']) {
    await page.goto('http://127.0.0.1:3000' + pathname);
    await page.evaluate(() => document.fonts.ready);
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    results.push({
      path: pathname,
      violations: result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
      })),
    });
  }
  await mkdir(`docs/design/${stage}`, { recursive: true });
  await writeFile(`docs/design/${stage}/accessibility.json`, JSON.stringify(results, null, 2));
  console.log(
    JSON.stringify(
      results.map((r) => ({
        path: r.path,
        violations: r.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })),
      })),
    ),
  );
} finally {
  await browser.close();
}
