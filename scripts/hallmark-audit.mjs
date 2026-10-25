import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const render = args.has('--render');
const check = args.has('--check');
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
for (const scope of scopes) {
  const cwd = path.join(evidence, scope.name);
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
  if (render && scope.routes.length) {
    command.push('--render');
    for (const route of scope.routes) command.push('--url', new URL(route, origin).href);
    if (args.has('--before')) command.push('--before');
    if (args.has('--kept')) command.push('--kept');
  }
  const result = spawnSync(process.execPath, command, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 20_000_000,
    env: { ...process.env, CHROME_PATH: process.env.CHROME_PATH || chromium.executablePath() },
  });
  if (![0, 1].includes(result.status))
    throw new Error(result.stderr || `Hallmark failed: ${scope.name}`);
  const report = JSON.parse(result.stdout);
  report.scope = scope.name;
  report.authenticatedRender = false;
  for (const finding of report.findings) {
    if (!finding.file.startsWith('http'))
      finding.file = path.relative(root, path.resolve(cwd, finding.file)).replaceAll('\\', '/');
    finding.scope = scope.name;
  }
  const output = path.join(cwd, render ? 'render.json' : 'static.json');
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(
    `${scope.name}: raw Floor ${report.summary.fails}, Reflex ${report.summary.reflex}, render ${report.summary.render}`,
  );
  if (scope.name === 'workspace' && render)
    console.log(
      'Workspace: static analysis only; authenticated rendering is covered by the Forewise browser suite, not by a login redirect.',
    );
  all.push(...report.findings);
}

const key = (f) =>
  createHash('sha256')
    .update(JSON.stringify([f.scope, f.gate, f.grade, f.file, f.evidence]))
    .digest('hex');
const findings = all.filter((f) => ['FAIL', 'REFLEX'].includes(f.grade));
if (render && !args.has('--before')) {
  const criticalGates = new Set(['10', '26a', '27', '34', '40', '41', '62', 'kept', 'render']);
  const broken = findings.filter((f) => f.grade === 'FAIL' && criticalGates.has(f.gate));
  if (broken.length) {
    console.error(JSON.stringify(broken, null, 2));
    process.exitCode = 1;
  }
  console.log(
    `Critical rendered checks: ${broken.length} failures. Other raw design findings still require contextual review.`,
  );
}
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
