import { test, expect } from '@playwright/test';
import { Pool } from 'pg';
import ExcelJS from 'exceljs';
import { parse } from 'csv-parse/sync';
import JSZip from 'jszip';
import fs from 'node:fs/promises';
import { phase03bEvidencePath } from './evidence';

const origin = 'http://127.0.0.1:3000';
const history =
  'date,value\n' +
  Array.from({ length: 10 }, (_, i) => `2023-01-${String(i + 1).padStart(2, '0')},${100 + i}`).join(
    '\n',
  );

for (const [boundary, switchWorkspaces] of [
  ['refresh', true],
  ['import', true],
  ['preview', true],
  ['refresh', false],
] as const) {
  test(`cancelled ${boundary} cannot affect a reopened import / ${switchWorkspaces ? 'rapid workspace switching' : 'same workspace'}`, async ({
    page,
  }) => {
    expect(
      (
        await page.request.post('/api/auth/register', {
          headers: { Origin: origin },
          data: {
            name: 'Race QA',
            workspace: 'Original',
            email: `cancel-${boundary}-${Date.now()}@example.test`,
            password: 'Local-test-passphrase-only',
          },
        })
      ).status(),
    ).toBe(200);
    const a = (await (await page.request.get('/api/session')).json()).workspaces[0].id;
    const b = (
      await (
        await page.request.post('/api/workspaces', {
          headers: { Origin: origin },
          data: { name: 'Destination' },
        })
      ).json()
    ).id;
    await page.goto('/workspace');
    await page.getByLabel('Workspace', { exact: true }).selectOption(a);
    await expect(page.getByRole('button', { name: 'Import data', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Import data', exact: true }).click();
    let release = () => {},
      seen = () => {},
      done = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      seen = resolve;
    });
    const finished = new Promise<void>((resolve) => {
      done = resolve;
    });
    let held = false;
    await page.route(
      boundary === 'refresh' ? `**/api/workspaces/${a}` : '**/datasets/import',
      async (route) => {
        if (
          boundary === 'import' &&
          !route.request().postData()?.includes('name="mode"\r\n\r\nimport\r\n')
        )
          return route.continue();
        if (held) return route.continue();
        held = true;
        const response = await route.fetch();
        seen();
        await gate;
        try {
          await route.fulfill({ response });
        } catch {
          /* A cancelled browser fetch can close. */
        } finally {
          done();
        }
      },
    );
    try {
      await page.getByLabel('Choose a CSV or XLSX').setInputFiles({
        name: 'Original.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(history),
      });
      if (boundary !== 'preview') {
        await expect(
          page.getByRole('button', { name: 'Import dataset', exact: true }),
        ).toBeEnabled();
        await page.getByRole('button', { name: 'Import dataset', exact: true }).click();
      }
      await entered;
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      // A -> B -> A -> B makes identity alone insufficient for obsolete operations.
      for (const id of switchWorkspaces ? [b, a, b] : []) {
        await page.getByLabel('Workspace', { exact: true }).selectOption(id);
        await expect(page.getByRole('button', { name: 'Import data', exact: true })).toBeEnabled();
      }
      await page.getByRole('button', { name: 'Import data', exact: true }).click();
      release();
      await finished;
      await expect(page.getByLabel('Workspace', { exact: true })).toHaveValue(
        switchWorkspaces ? b : a,
      );
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(
        page.locator('#workspace-feedback').filter({ hasText: 'Dataset saved' }),
      ).toHaveCount(0);
      await expect(page.getByRole('button', { name: /01 Datasets/ })).toHaveClass(/selected/);
      await expect(page.locator('.import-file-summary')).toHaveCount(0);
      await page.screenshot({
        path: phase03bEvidencePath(
          `cancel-${boundary}-${switchWorkspaces ? 'switch' : 'same'}.png`,
        ),
      });
    } finally {
      release();
    }
  });
}

test('actual XLSX numeric XML is rejected by preview and persistence endpoints', async ({
  request,
}) => {
  expect(
    (
      await request.post('/api/auth/register', {
        headers: { Origin: origin },
        data: {
          name: 'Numeric QA',
          workspace: 'Numeric boundary',
          email: `numeric-${Date.now()}@example.test`,
          password: 'Local-test-passphrase-only',
        },
      })
    ).status(),
  ).toBe(200);
  const wid = (await (await request.get('/api/session')).json()).workspaces[0].id;
  for (const raw of ['12 units', '1e', '0x10']) {
    const zip = await JSZip.loadAsync(
      await fs.readFile('apps/web/tests/fixtures/onboarding/valid_daily.xlsx'),
    );
    const name = 'xl/worksheets/sheet1.xml';
    const xml = await zip.file(name)!.async('string');
    expect(xml).toMatch(/<c r="B2"[^>]*><v>[^<]+<\/v><\/c>/);
    zip.file(name, xml.replace(/(<c r="B2"[^>]*><v>)[^<]+(<\/v><\/c>)/, `$1${raw}$2`));
    const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    for (const mode of ['preview', 'import']) {
      const response = await request.post(`/api/workspaces/${wid}/datasets/import`, {
        headers: { Origin: origin },
        multipart: {
          file: {
            name: 'malformed.xlsx',
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            buffer: bytes,
          },
          mode,
          frequency: 'daily',
          dateCol: '0',
          valueCol: '1',
        },
      });
      expect(response.status()).toBe(400);
      expect((await response.json()).error).toContain('Invalid XLSX numeric cell');
    }
  }
  expect((await (await request.get(`/api/workspaces/${wid}`)).json()).datasets).toEqual([]);
});

test('authorized CSV/XLSX exports retain typed empty metadata from PostgreSQL', async ({
  request,
}) => {
  test.skip(!process.env.TEST_DATABASE_URL, 'Requires real PostgreSQL');
  const db = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  try {
    expect(
      (
        await request.post('/api/auth/register', {
          headers: { Origin: origin },
          data: {
            name: 'Export QA',
            workspace: 'Persisted metadata',
            email: `metadata-${Date.now()}@example.test`,
            password: 'Local-test-passphrase-only',
          },
        })
      ).status(),
    ).toBe(200);
    const wid = (await (await request.get('/api/session')).json()).workspaces[0].id;
    const imported = await request.post(`/api/workspaces/${wid}/datasets`, {
      headers: { Origin: origin },
      data: { name: 'Metadata history', csv: history },
    });
    expect(imported.status()).toBe(201);
    const did = (await imported.json()).id;
    const generated = await request.post(`/api/workspaces/${wid}/forecasts`, {
      headers: { Origin: origin },
      data: { datasetId: did, horizon: 3 },
    });
    expect(generated.status()).toBe(201);
    const fid = (await generated.json()).id;
    const probe = {
      emptyArray: [],
      emptyObject: {},
      unavailable: null,
      literalArray: '[]',
      literalNull: 'null',
      nested: { values: [1.23456789012345, false, ''] },
    };
    await db.query(
      "UPDATE forecasts SET result=jsonb_set(result,'{qa_metadata}',$1::jsonb) WHERE id=$2",
      [JSON.stringify(probe), fid],
    );
    const saved = (await db.query('SELECT result, created_at FROM forecasts WHERE id=$1', [fid]))
      .rows[0];
    expect(saved.result.qa_metadata).toEqual(probe);
    const expected = [
      ['emptyArray', '[]', 'array'],
      ['emptyObject', '{}', 'object'],
      ['unavailable', 'null', 'null'],
      ['literalArray', '[]', 'string'],
      ['literalNull', 'null', 'string'],
      ['nested.values.0', '1.23456789012345', 'number'],
      ['nested.values.1', 'false', 'boolean'],
      ['nested.values.2', '', 'string'],
    ];
    for (const format of ['csv', 'xlsx']) {
      const response = await request.get(
        `/api/workspaces/${wid}/forecasts/${fid}/export?format=${format}`,
      );
      expect(response.status()).toBe(200);
      let rows: unknown[][];
      if (format === 'csv') rows = parse(await response.text()) as string[][];
      else {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load((await response.body()) as never);
        rows = [];
        workbook
          .getWorksheet('Metadata')!
          .eachRow((row) =>
            rows.push(Array.from({ length: 9 }, (_, i) => row.getCell(i + 1).value ?? '')),
          );
        expect(workbook.getWorksheet('Forecast')!.getCell('C2').value).toBe(
          saved.result.points[0].value,
        );
      }
      for (const [key, value, type] of expected) {
        const row = rows.find((row) => row[6] === `result.qa_metadata.${key}`);
        expect(row?.slice(7).map(String)).toEqual([value, type]);
      }
      expect(rows.some((row) => row[6] === 'result.qa_metadata.absent')).toBe(false);
      expect(rows.find((row) => row[6] === 'created_at')?.[7]).toBe(saved.created_at.toISOString());
    }
  } finally {
    await db.end();
  }
});
