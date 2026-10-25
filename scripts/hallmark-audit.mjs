import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { inspectSandbox } from './hallmark-browser.mjs';
import {
  parseReport,
  pngDimensions,
  requireTargetCoverage,
  SHOTS,
  validateRenderedTarget,
} from './hallmark-gate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const render = args.has('--render');
const check = args.has('--check');
if ([...args].some((a) => !['--render', '--check'].includes(a)) || (render && check))
  throw new Error('Use --render or --check, without bypass flags.');
const skill = path.join(root, '.data/tools/hallmark/scripts/sloplint.mjs');
const evidence = path.join(root, '.data/hallmark');
const scopes = [
  {
    name: 'public',
    genre: 'atmospheric',
    scope: 'page',
    files: [
      'apps/web/app/globals.css',
      'apps/web/app/horizon.css',
      'apps/web/components/horizon-experience.tsx',
      'apps/web/components/horizon-story.tsx',
    ],
    routes: ['/', '/explorations'],
  },
  {
    name: 'auth',
    genre: 'modern-minimal',
    scope: 'app',
    files: ['apps/web/app/globals.css', 'apps/web/components/auth-form.tsx'],
    routes: ['/register', '/login'],
  },
  {
    name: 'workspace',
    genre: 'modern-minimal',
    scope: 'app',
    files: [
      'apps/web/app/globals.css',
      'apps/web/components/workspace.tsx',
      'apps/web/components/chart.tsx',
    ],
    routes: [],
  },
];
const origin = process.env.APP_ORIGIN || 'http://127.0.0.1:3000';
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(origin).hostname))
  throw new Error('Design checks are restricted to the local preview.');
const all = [];
fs.mkdirSync(evidence, { recursive: true });
const requiredTargets = scopes.flatMap((s) => s.routes.map((r) => new URL(r, origin).href));
const runDirectory = render ? fs.mkdtempSync(path.join(evidence, 'render-')) : null;
const manifest = {
  purpose: process.env.HALLMARK_TEST_CASE || 'required-render-audit',
  revision: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim(),
  success: false,
  requiredTargets,
  targets: [],
};
const saveManifest = () => {
  const body = JSON.stringify(manifest, null, 2) + '\n';
  fs.writeFileSync(path.join(runDirectory, 'manifest.json'), body);
  fs.writeFileSync(path.join(evidence, 'render-results.json'), body);
};
const executablePath = process.env.CHROME_PATH || chromium.executablePath();
if (render) {
  saveManifest();
  try {
    manifest.browser = await inspectSandbox(executablePath);
  } catch (error) {
    manifest.browser = { success: false, executablePath, error: error.message };
  }
  fs.writeFileSync(
    path.join(runDirectory, 'browser.json'),
    JSON.stringify(manifest.browser, null, 2) + '\n',
  );
  saveManifest();
}
for (const scope of scopes) {
  // Separate process/output directory per URL proves coverage and prevents stale screenshots.
  for (const route of render && scope.routes.length ? scope.routes : [null]) {
    const target = route === null ? null : new URL(route, origin).href;
    const slug = target
      ?.replace(/^https?:\/\//, '')
      .replace(/[^\w.-]+/g, '-')
      .replace(/-+$/, '');
    const cwd = render
      ? path.join(runDirectory, scope.name, slug || 'static')
      : path.join(evidence, scope.name);
    fs.mkdirSync(cwd, { recursive: true });
    const command = [
      skill,
      ...scope.files.map((name) => path.join(root, name)),
      '--genre',
      scope.genre,
      '--scope',
      scope.scope,
      '--json',
    ];
    if (target) command.push('--render', '--url', target);
    const result = spawnSync(process.execPath, command, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 20_000_000,
      timeout: 180_000,
      env: { ...process.env, CHROME_PATH: executablePath },
    });
    // Preserve output before parsing or rejecting it, including malformed/failed reports.
    fs.writeFileSync(path.join(cwd, 'raw-report.json'), result.stdout || '');
    fs.writeFileSync(path.join(cwd, 'stderr.log'), result.stderr || '');
    fs.writeFileSync(
      path.join(cwd, 'process.json'),
      JSON.stringify(
        { status: result.status, signal: result.signal, error: result.error?.message },
        null,
        2,
      ) + '\n',
    );
    const outcome = {
      target,
      success: false,
      report: path.relative(root, path.join(cwd, 'raw-report.json')).replaceAll('\\', '/'),
    };
    try {
      const report = parseReport(result.stdout, result.status);
      if (target) {
        outcome.render = report.summary.render;
        if (report.summary.render !== 'ran') validateRenderedTarget(report, []);
        outcome.screenshots = SHOTS.map(({ tag }) => {
          const file = path.join(cwd, '.hallmark/shots', `${slug}-${tag}.png`);
          const bytes = fs.readFileSync(file);
          return {
            tag,
            ...pngDimensions(bytes),
            sha256: createHash('sha256').update(bytes).digest('hex'),
            file: path.relative(root, file).replaceAll('\\', '/'),
          };
        });
        validateRenderedTarget(report, outcome.screenshots);
        outcome.render = report.summary.render;
      }
      for (const finding of report.findings) {
        if (!finding.file.startsWith('http'))
          finding.file = path.relative(root, path.resolve(cwd, finding.file)).replaceAll('\\', '/');
        finding.scope = scope.name;
      }
      report.scope = scope.name;
      report.authenticatedRender = false;
      if (!render)
        fs.writeFileSync(path.join(cwd, 'static.json'), JSON.stringify(report, null, 2) + '\n');
      console.log(
        `${target || scope.name}: raw Floor ${report.summary.fails}, Reflex ${report.summary.reflex}, render ${report.summary.render}`,
      );
      all.push(...report.findings);
      outcome.success = true;
    } catch (error) {
      outcome.error = error.message;
      console.error(`${target || scope.name}: ${error.message}`);
      if (!render) throw error;
    }
    if (target) manifest.targets.push(outcome);
    else if (render && !outcome.success) manifest.staticError = outcome.error;
    if (render) saveManifest();
  }
}
if (render) {
  try {
    requireTargetCoverage(requiredTargets, manifest.targets);
    if (!manifest.browser.success)
      throw new Error(`Browser sandbox preflight failed: ${manifest.browser.error}`);
    if (manifest.staticError) throw new Error(manifest.staticError);
    manifest.success = true;
  } catch (error) {
    manifest.error = error.message;
    process.exitCode = 1;
  }
  saveManifest();
  console.log(
    `Required rendered targets: ${manifest.targets.filter((t) => t.success).length}/${requiredTargets.length}; gate ${manifest.success ? 'PASS' : 'FAIL'}. Raw reports: ${path.relative(root, runDirectory)}`,
  );
}

const key = (f) =>
  createHash('sha256')
    .update(JSON.stringify([f.scope, f.gate, f.grade, f.file, f.evidence]))
    .digest('hex');
const findings = all.filter((f) => ['FAIL', 'REFLEX'].includes(f.grade));
const current = findings.map((f) => ({ key: key(f), ...f }));
fs.writeFileSync(
  path.join(evidence, render ? 'render-findings.json' : 'static-findings.json'),
  JSON.stringify(current, null, 2) + '\n',
);
if (check) {
  if (render)
    throw new Error(
      'Rendered findings require visual review; the deterministic regression baseline checks source only.',
    );
  const baseline = JSON.parse(
    fs.readFileSync(path.join(root, 'docs/design/hallmark/accepted-findings.json'), 'utf8'),
  );
  const accepted = new Set(baseline.findings.filter((f) => f.reason?.trim()).map((f) => f.key));
  const added = current.filter((f) => !accepted.has(f.key));
  if (added.length) {
    console.error(JSON.stringify(added, null, 2));
    process.exitCode = 1;
  }
  console.log(
    `Reviewed regression baseline: ${added.length} new findings, ${current.length} existing findings retained with reasons. This is not a raw Hallmark clean pass.`,
  );
} else {
  console.log(
    `Raw findings recorded in ${path.relative(root, evidence)}. Findings are not silently waived; review them against design.md.`,
  );
}
