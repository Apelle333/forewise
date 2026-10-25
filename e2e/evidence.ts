import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const runId = (process.env.FOREWISE_PHASE03B_EVIDENCE_RUN_ID ??= `${Date.now()}-${randomUUID()}`);
if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(runId)) {
  throw new Error('Invalid Phase 03B evidence run ID');
}
const directory = path.resolve('.data', 'phase03b-e2e', runId);

export function phase03bEvidenceDirectory(): string {
  mkdirSync(directory, { recursive: true });
  return directory;
}

export function phase03bEvidencePath(name: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) {
    throw new Error('Phase 03B evidence requires a plain file name');
  }
  return path.join(phase03bEvidenceDirectory(), name);
}
