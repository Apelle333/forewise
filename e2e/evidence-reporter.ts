import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestError,
  TestResult,
} from '@playwright/test/reporter';
import { phase03bEvidenceDirectory } from './evidence';

export default class Phase03BEvidenceReporter implements Reporter {
  private directory: string;
  private startedAt = new Date().toISOString();
  private revision: string | null = null;
  private workingTreeDirtyAtStart: boolean | null = null;
  private suite?: Suite;
  private errors: string[] = [];
  private attempts: {
    test_id: string;
    title: string;
    retry: number;
    status: TestResult['status'];
    duration_ms: number;
  }[] = [];

  constructor(options: { outputDirectory?: string } = {}) {
    this.directory = options.outputDirectory ?? phase03bEvidenceDirectory();
    mkdirSync(this.directory, { recursive: true });
    try {
      this.revision = execFileSync('git', ['rev-parse', 'HEAD'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      }).trim();
    } catch {
      // A missing Git checkout is recorded explicitly rather than using an old revision.
    }
    try {
      this.workingTreeDirtyAtStart =
        execFileSync('git', ['status', '--porcelain'], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
          windowsHide: true,
        }).trim().length > 0;
    } catch {
      // Preserve unknown provenance when Git status is unavailable.
    }
    this.writeManifest('running');
  }

  onBegin(_config: FullConfig, suite: Suite) {
    this.suite = suite;
    this.writeManifest('running');
  }

  onTestEnd(test: TestCase, result: TestResult) {
    this.attempts.push({
      test_id: test.id,
      title: test.titlePath().join(' > '),
      retry: result.retry,
      status: result.status,
      duration_ms: result.duration,
    });
  }

  onError(error: TestError) {
    this.errors.push(error.message ?? error.value ?? 'Unknown Playwright error');
  }

  onEnd(result: FullResult) {
    this.writeManifest(result.status, result);
  }

  private writeManifest(status: FullResult['status'] | 'running', result?: FullResult) {
    const files = readdirSync(this.directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name !== 'manifest.json')
      .map((entry) => {
        const bytes = readFileSync(path.join(this.directory, entry.name));
        return {
          path: entry.name,
          sha256: createHash('sha256').update(bytes).digest('hex'),
          bytes: bytes.length,
        };
      })
      .sort((a, b) => a.path.localeCompare(b.path));
    const tests = this.suite?.allTests() ?? [];
    writeFileSync(
      path.join(this.directory, 'manifest.json'),
      JSON.stringify(
        {
          purpose: 'phase03b-browser-run',
          run_id: path.basename(this.directory),
          git_revision: this.revision,
          working_tree_dirty_at_start: this.workingTreeDirtyAtStart,
          platform: process.platform,
          node_version: process.version,
          started_at: this.startedAt,
          completed_at: result ? new Date().toISOString() : null,
          suite_status: status,
          duration_ms: result?.duration ?? null,
          tests: {
            total: tests.length,
            expected: tests.filter((test) => test.outcome() === 'expected').length,
            unexpected: tests.filter((test) => test.outcome() === 'unexpected').length,
            flaky: tests.filter((test) => test.outcome() === 'flaky').length,
            skipped: tests.filter((test) => test.outcome() === 'skipped').length,
          },
          attempts: this.attempts,
          errors: this.errors,
          files,
        },
        null,
        2,
      ) + '\n',
    );
  }
}
