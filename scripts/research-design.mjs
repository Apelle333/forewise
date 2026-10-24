import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const out = 'docs/design/references';
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const results = await Promise.allSettled(
  [
    ['linear', 'https://linear.app/'],
    ['stripe', 'https://stripe.com/'],
    ['ramp', 'https://ramp.com/'],
    ['vercel', 'https://vercel.com/'],
    ['gallery', 'https://recent.design/'],
  ].map(async ([name, url]) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      await page.screenshot({ path: `${out}/${name}.png`, timeout: 15000, animations: 'disabled' });
      return {
        name,
        url,
        finalUrl: page.url(),
        status: response?.status(),
        title: await page.title(),
      };
    } catch (e) {
      return { name, url, error: e.message };
    } finally {
      await page.close();
    }
  }),
);
await writeFile(`${out}/visits.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
await browser.close();
