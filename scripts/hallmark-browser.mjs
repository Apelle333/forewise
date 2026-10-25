import puppeteer from 'puppeteer-core';

export async function inspectSandbox(executablePath) {
  const browser = await puppeteer.launch({ executablePath, headless: true });
  try {
    const args = browser.process().spawnargs;
    if (
      args.some((a) =>
        /^--(?:no-sandbox|disable-.*sandbox|single-process|no-zygote)(?:=|$)/.test(a),
      )
    )
      throw new Error('Browser sandbox bypass flags are forbidden.');
    let sandbox = 'Platform-default sandbox; no bypass flags';
    if (process.platform === 'linux') {
      const page = await browser.newPage();
      await page.goto('chrome://sandbox');
      sandbox = await page.evaluate(() => document.body.innerText);
      if (!/Namespace sandbox\s+Yes/i.test(sandbox) || !/Seccomp-BPF sandbox\s+Yes/i.test(sandbox))
        throw new Error(`Linux sandbox is not active: ${sandbox}`);
    }
    return { success: true, executablePath, version: await browser.version(), sandbox };
  } finally {
    await browser.close();
  }
}
