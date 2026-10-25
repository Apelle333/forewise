import puppeteer from 'puppeteer-core';

export function requireLinuxSandbox(status) {
  if (!status.includes('You are adequately sandboxed.'))
    throw new Error(`Linux sandbox did not report an adequate sandbox: ${status}`);
  const required = {
    'Layer 1 Sandbox': 'Namespace',
    'PID namespaces': 'Yes',
    'Network namespaces': 'Yes',
    'Seccomp-BPF sandbox': 'Yes',
  };
  const rows = status.split(/\r?\n/).map((line) => line.split('\t').map((cell) => cell.trim()));
  for (const [name, value] of Object.entries(required)) {
    const matching = rows.filter((row) => row[0] === name);
    if (matching.length !== 1 || matching[0].length !== 2 || matching[0][1] !== value)
      throw new Error(
        `Linux sandbox status missing or inactive: ${name}; observed status: ${status}`,
      );
  }
  return required;
}

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
    let sandboxFields;
    if (process.platform === 'linux') {
      const page = await browser.newPage();
      await page.goto('chrome://sandbox');
      sandbox = await page.evaluate(() => document.body.innerText);
      sandboxFields = requireLinuxSandbox(sandbox);
    }
    return {
      success: true,
      executablePath,
      version: await browser.version(),
      sandbox,
      sandboxFields,
    };
  } finally {
    await browser.close();
  }
}
