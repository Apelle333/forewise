import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import { requireLinuxSandbox } from './hallmark-browser.mjs';
import {
  CRITICAL_GATES,
  parseReport,
  pngDimensions,
  requireTargetCoverage,
  SHOTS,
  validateRenderedTarget,
} from './hallmark-gate.mjs';

const report = () => ({
  summary: { files: 2, fails: 0, reflex: 0, warns: 0, render: 'ran' },
  findings: [],
});
const shots = () =>
  SHOTS.map((s) => ({ ...s, height: s.height ?? 2000, sha256: 'verified-test-fixture' }));

test('actual Chrome Linux status format requires every active sandbox field', () => {
  // Observed in CI 40216112211; the obsolete "Namespace sandbox Yes" label is absent.
  const status =
    'Sandbox Status\nLayer 1 Sandbox\tNamespace\nPID namespaces\tYes\nNetwork namespaces\tYes\nSeccomp-BPF sandbox\tYes\n\nYou are adequately sandboxed.';
  assert.equal(requireLinuxSandbox(status)['Layer 1 Sandbox'], 'Namespace');
  for (const name of [
    'Layer 1 Sandbox',
    'PID namespaces',
    'Network namespaces',
    'Seccomp-BPF sandbox',
  ]) {
    assert.throws(() =>
      requireLinuxSandbox(status.replace(new RegExp(`${name}\\t[^\\n]+`), `${name}\tNo`)),
    );
    assert.throws(() => requireLinuxSandbox(status.replace(new RegExp(`${name}\\t[^\\n]+`), '')));
  }
  assert.throws(() => requireLinuxSandbox('You are adequately sandboxed.'));
  assert.throws(() => requireLinuxSandbox(status.replace('You are adequately sandboxed.', '')));
  assert.throws(() => requireLinuxSandbox(status + '\nPID namespaces\tYes'));
});
test('complete successful render and exact target coverage pass', () => {
  validateRenderedTarget(parseReport(JSON.stringify(report()), 0), shots());
  requireTargetCoverage(
    ['/', '/login'],
    [
      { target: '/', success: true },
      { target: '/login', success: true },
    ],
  );
});
for (const state of ['not run', 'off', 'not run: No usable sandbox!', undefined])
  test(`reject skipped/incomplete rendering: ${state}`, () => {
    const value = report();
    value.summary.render = state;
    assert.throws(() => validateRenderedTarget(value, shots()), /did not execute/);
  });
for (const [name, stdout, status] of [
  ['missing report', '', 0],
  ['malformed JSON', '{', 1],
  ['missing summary', '{"findings":[]}', 0],
  ['missing findings', '{"summary":{"render":"ran"}}', 0],
  ['Chromium startup process failure', '', 2],
  ['terminated process', '', null],
])
  test(`reject ${name}`, () => assert.throws(() => parseReport(stdout, status)));
test('incomplete findings and malformed metrics are rejected', () => {
  const value = report();
  value.summary.fails = 1;
  assert.throws(() => parseReport(JSON.stringify(value), 1), /Incomplete/);
  value.summary.fails = '0';
  assert.throws(() => parseReport(JSON.stringify(value), 1), /Invalid/);
});
test('Chromium launch exception caught by upstream must still fail', () => {
  const value = report();
  value.summary.render = 'not run: Failed to launch the browser process: No usable sandbox!';
  assert.throws(
    () => validateRenderedTarget(parseReport(JSON.stringify(value), 1), shots()),
    /did not execute/,
  );
});
test('missing mobile, missing desktop and wrong-size screenshots fail', () => {
  for (const tag of ['375', '1280x800', '1440-full'])
    assert.throws(
      () =>
        validateRenderedTarget(
          report(),
          shots().filter((s) => s.tag !== tag),
        ),
      /screenshot/,
    );
  const wrong = shots();
  wrong[0].width = 320;
  assert.throws(() => validateRenderedTarget(report(), wrong), /screenshot/);
  assert.throws(() => pngDimensions(Buffer.from('not a png')), /PNG/);
});
test('missing, failed, duplicate and substituted targets fail', () => {
  assert.throws(() => requireTargetCoverage([], []));
  for (const results of [
    [],
    [{ target: '/', success: true }],
    [
      { target: '/', success: true },
      { target: '/login', success: false },
    ],
    [
      { target: '/', success: true },
      { target: '/', success: true },
    ],
    [
      { target: '/', success: true },
      { target: '/other', success: true },
    ],
  ])
    assert.throws(() => requireTargetCoverage(['/', '/login'], results));
});
test('critical FAILs and missing-font render warnings cannot pass', () => {
  for (const gate of CRITICAL_GATES) {
    const value = report();
    value.findings = [{ gate, grade: 'FAIL', file: '/', evidence: 'negative fixture' }];
    value.summary.fails = 1;
    assert.throws(() => validateRenderedTarget(value, shots()), /Critical/);
  }
  const value = report();
  value.findings = [{ gate: 'render', grade: 'WARN', file: '/', evidence: 'font failed' }];
  assert.throws(() => validateRenderedTarget(value, shots()), /Critical/);
});
test('all critical IDs match emitters in the pinned upstream, including 10a', () => {
  const skill = path.resolve('.data/tools/hallmark/scripts');
  const source = ['sloplint.mjs', 'sloplint-render.mjs']
    .map((f) => fs.readFileSync(path.join(skill, f), 'utf8'))
    .join('\n');
  const emitted = new Set(
    [...source.matchAll(/(?:report|push)\(\s*['"]?(\w+)['"]?\s*,|gate:\s*['"]?(\w+)['"]?/g)].map(
      (m) => m[1] || m[2],
    ),
  );
  for (const gate of CRITICAL_GATES)
    assert.ok(emitted.has(gate), `Unknown critical emitter: ${gate}`);
  assert.ok(CRITICAL_GATES.has('10a'));
  assert.ok(!CRITICAL_GATES.has('10'));
});
test('actual upstream transition:all fixture emits 10a and fails the gate', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'forewise-hallmark-rule-'));
  try {
    const file = path.join(temp, 'bad.css');
    fs.writeFileSync(file, '.bad { transition: all 1s; }');
    const result = spawnSync(
      process.execPath,
      [path.resolve('.data/tools/hallmark/scripts/sloplint.mjs'), file, '--json'],
      { encoding: 'utf8' },
    );
    const value = parseReport(result.stdout, result.status);
    assert.ok(value.findings.some((f) => f.gate === '10a' && f.grade === 'FAIL'));
    value.summary.render = 'ran';
    assert.throws(() => validateRenderedTarget(value, shots()), /Critical/);
  } finally {
    assert.equal(path.dirname(path.resolve(temp)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temp).startsWith('forewise-hallmark-rule-'));
    fs.rmSync(temp, { recursive: true });
  }
});

test('actual audit CLI exits nonzero when Chromium cannot start, preserving raw reports', () => {
  // Node exists but cannot act as Chrome: this exercises real upstream startup/catch behavior.
  const result = spawnSync(process.execPath, ['scripts/hallmark-audit.mjs', '--render'], {
    encoding: 'utf8',
    timeout: 30_000,
    env: {
      ...process.env,
      CHROME_PATH: process.execPath,
      HALLMARK_TEST_CASE: 'chromium-startup-negative',
    },
  });
  assert.equal(result.status, 1);
  const manifest = JSON.parse(fs.readFileSync('.data/hallmark/render-results.json', 'utf8'));
  assert.equal(manifest.success, false);
  assert.equal(manifest.browser.success, false);
  assert.equal(manifest.targets.length, 4);
  for (const target of manifest.targets) {
    assert.equal(target.success, false);
    assert.match(target.render, /^not run:/);
    assert.equal(JSON.parse(fs.readFileSync(target.report, 'utf8')).summary.render, target.render);
  }
});
