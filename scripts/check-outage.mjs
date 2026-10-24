// Run against a local server started with FORECAST_SERVICE_URL=http://127.0.0.1:9.
// This checks the real server-side failure path, without mocking browser fetch.
import { request } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const origin = 'http://127.0.0.1:3000';
const context = await request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } });
try {
  const email = `outage-${Date.now()}@example.test`;
  const registered = await context.post('/api/auth/register', {
    data: {
      name: 'Outage check',
      workspace: 'Resilience check',
      email,
      password: 'Test-only-passphrase-123',
    },
  });
  assert.equal(registered.status(), 200);
  const { workspaces } = await (await context.get('/api/session')).json();
  const wid = workspaces[0].id;
  const csv =
    'date,value\n' +
    Array.from({ length: 8 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')},100`).join('\n');
  const uploaded = await context.post(`/api/workspaces/${wid}/datasets`, {
    data: { name: 'Preserved.csv', csv },
  });
  assert.equal(uploaded.status(), 201);
  const { id } = await uploaded.json();
  const forecast = await context.post(`/api/workspaces/${wid}/forecasts`, {
    data: { datasetId: id, horizon: 7 },
  });
  assert.equal(forecast.status(), 503);
  assert.match((await forecast.json()).error, /unavailable/);
  const state = await (await context.get(`/api/workspaces/${wid}`)).json();
  assert.equal(state.datasets.length, 1);
  assert.equal(state.forecasts.length, 0);
  await mkdir('.data', { recursive: true });
  await context.storageState({ path: '.data/restart-session.json' });
  console.log(
    'PASS: unavailable Python returns 503; saved dataset preserved; no failed forecast persisted.',
  );
} finally {
  await context.dispose();
}
