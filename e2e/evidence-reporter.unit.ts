import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type {
  FullConfig,
  FullResult,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import Phase03BEvidenceReporter from './evidence-reporter';
import { phase03bEvidenceDirectory, phase03bEvidencePath } from './evidence';

test('evidence paths share an existing run directory and reject path traversal', () => {
  const first = phase03bEvidencePath('first.json');
  assert.equal(path.dirname(first), path.dirname(phase03bEvidencePath('second.png')));
  assert.equal(path.dirname(first), phase03bEvidenceDirectory());
  assert.ok(path.isAbsolute(first));
  assert.ok(existsSync(path.dirname(first)));
  assert.ok(process.env.FOREWISE_PHASE03B_EVIDENCE_RUN_ID);
  for (const name of ['', '..', '../escape.json', 'nested/file.png', 'nested\\file.png']) {
    assert.throws(() => phase03bEvidencePath(name), /plain file name/);
  }
});

test('failed runs hash partial evidence and preserve retry outcomes without claiming success', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'forewise-evidence-'));
  try {
    const reporter = new Phase03BEvidenceReporter({ outputDirectory: directory });
    const manifest = () => JSON.parse(readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
    assert.equal(manifest().suite_status, 'running');
    assert.equal(manifest().completed_at, null);
    const failed = {
      id: 'failed-id',
      titlePath: () => ['chromium', 'failed export'],
      outcome: () => 'unexpected',
    } as unknown as TestCase;
    const skipped = { outcome: () => 'skipped' } as TestCase;
    const suite = { allTests: () => [failed, skipped] } as Suite;
    reporter.onBegin({} as FullConfig, suite);
    reporter.onTestEnd(failed, { retry: 0, status: 'failed', duration: 12 } as TestResult);
    reporter.onTestEnd(failed, { retry: 1, status: 'failed', duration: 15 } as TestResult);
    reporter.onError({ message: 'Expected failure fixture' });
    const bytes = Buffer.from('partial output');
    writeFileSync(path.join(directory, 'partial.json'), bytes);
    reporter.onEnd({ status: 'failed', duration: 27 } as FullResult);
    const result = manifest();
    assert.match(result.git_revision, /^[a-f0-9]{40}$/);
    assert.equal(typeof result.working_tree_dirty_at_start, 'boolean');
    assert.equal(result.suite_status, 'failed');
    assert.ok(result.completed_at);
    assert.deepEqual(result.tests, { total: 2, expected: 0, unexpected: 1, flaky: 0, skipped: 1 });
    assert.deepEqual(
      result.attempts.map((attempt: { retry: number }) => attempt.retry),
      [0, 1],
    );
    assert.deepEqual(result.errors, ['Expected failure fixture']);
    assert.deepEqual(result.files, [
      {
        path: 'partial.json',
        sha256: createHash('sha256').update(bytes).digest('hex'),
        bytes: bytes.length,
      },
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
