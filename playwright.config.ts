import { defineConfig, devices } from '@playwright/test';
import { phase03bEvidenceDirectory } from './e2e/evidence';

// Set the shared run ID before Playwright starts workers or retry processes.
phase03bEvidenceDirectory();
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  reporter: [['list'], ['html', { open: 'never' }], ['./e2e/evidence-reporter.ts']],
});
