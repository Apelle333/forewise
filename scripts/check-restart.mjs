import { request } from '@playwright/test';
import assert from 'node:assert/strict';
const origin = 'http://127.0.0.1:3000';
const context = await request.newContext({
  baseURL: origin,
  storageState: '.data/restart-session.json',
  extraHTTPHeaders: { Origin: origin },
});
try {
  const session = await context.get('/api/session');
  assert.equal(session.status(), 200);
  const { workspaces } = await session.json();
  const wid = workspaces[0].id;
  const state = await (await context.get(`/api/workspaces/${wid}`)).json();
  assert.equal(state.datasets.length, 1);
  assert.equal(state.datasets[0].name, 'Preserved.csv');
  const response = await context.post(`/api/workspaces/${wid}/forecasts`, {
    data: { datasetId: state.datasets[0].id, horizon: 7 },
  });
  assert.equal(response.status(), 201);
  assert.equal((await response.json()).result.mock, true);
  console.log(
    'PASS: session and dataset survive process restart; recovered Python creates a mock forecast.',
  );
} finally {
  await context.dispose();
}
