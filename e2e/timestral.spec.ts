import { test, expect } from '@playwright/test';
import { Pool } from 'pg';
import { parse } from 'csv-parse/sync';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import ExcelJS from 'exceljs';
import { phase03bEvidencePath } from './evidence';

for (const format of ['csv', 'xlsx'] as const) {
  const suffix = format === 'csv' ? '' : '-xlsx';
  test(`real public ${format.toUpperCase()} through dashboard, pinned 209M worker, native quantiles and authorized persisted retrieval`, async ({
    page,
    playwright,
  }) => {
    test.skip(
      process.env.RUN_TIMESTRAL_INTEGRATION !== '1' || !process.env.TEST_DATABASE_URL,
      'Real model/PostgreSQL integration gate must be enabled',
    );
    test.setTimeout(240000);
    const db = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    let worker: ReturnType<typeof spawn> | undefined;
    try {
      const sourceCsv = await fs.readFile('docs/phase-02b/fixtures/air-passengers.csv', 'utf8');
      const sourceRows = parse(sourceCsv, { columns: true, skip_empty_lines: true }) as {
        date: string;
        value: string;
      }[];
      const history = sourceRows.map((p) => ({ date: p.date, value: Number(p.value) }));
      page.setDefaultTimeout(15000);
      const account = await page.request.post('/api/auth/register', {
        headers: { Origin: 'http://127.0.0.1:3000' },
        data: {
          name: 'Timestral QA',
          workspace: 'Air passenger planning',
          email: `timestral-${Date.now()}@example.test`,
          password: 'Timestral-test-only-123',
        },
      });
      expect(account.ok()).toBe(true);
      await page.setViewportSize({ width: 1440, height: 1100 });
      await page.goto('/workspace');
      await page.getByRole('button', { name: 'Import data', exact: true }).click();
      if (format === 'csv') {
        await page
          .getByLabel('Choose a CSV or XLSX')
          .setInputFiles('docs/phase-02b/fixtures/air-passengers.csv');
      } else {
        const input = new ExcelJS.Workbook();
        const sheet = input.addWorksheet('AirPassengers');
        sheet.addRow(['date', 'value']);
        for (const point of history) {
          const row = sheet.addRow([new Date(`${point.date}T00:00:00Z`), point.value]);
          row.getCell(1).numFmt = 'yyyy-mm-dd';
        }
        await page.getByLabel('Choose a CSV or XLSX').setInputFiles({
          name: 'air-passengers.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          buffer: Buffer.from(await input.xlsx.writeBuffer()),
        });
      }
      await page.getByLabel('Observation frequency').selectOption('monthly');
      await page.getByRole('button', { name: 'Import dataset', exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Dataset saved' })).toBeVisible();
      await page.getByLabel('Forecasting model', { exact: true }).selectOption('timestral_209m');
      await page.getByRole('spinbutton', { name: /Forecast horizon/ }).fill('12');
      const python = path.resolve(
        process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python',
      );
      const submittedPromise = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/forecast-jobs') && response.request().method() === 'POST',
      );
      await page.getByRole('button', { name: 'Generate model forecast', exact: false }).click();
      const submitted = await submittedPromise;
      expect(submitted.status()).toBe(202);
      const jobId = (await submitted.json()).jobId;
      const pending = (
        await db.query('SELECT status,attempts,fence,result_id FROM forecast_jobs WHERE id=$1', [
          jobId,
        ])
      ).rows[0];
      expect(pending.status).toBe('pending');
      expect(pending.attempts).toBe(0);
      expect(Number(pending.fence)).toBe(0);
      expect(pending.result_id).toBeNull();
      worker = spawn(python, ['services/forecast/worker.py'], {
        cwd: process.cwd(),
        windowsHide: true,
        env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
        stdio: 'ignore',
      });

      let processing;
      await expect
        .poll(
          async () => {
            processing = (
              await db.query(
                'SELECT status,attempts,fence,result_id,worker_id,lease_expires_at > now() AS live_lease FROM forecast_jobs WHERE id=$1',
                [jobId],
              )
            ).rows[0];
            return processing.status;
          },
          { timeout: 60000, intervals: [25, 50, 100] },
        )
        .toBe('processing');
      expect(processing!.attempts).toBe(1);
      expect(Number(processing!.fence)).toBe(1);
      expect(processing!.live_lease).toBe(true);
      expect(processing!.worker_id).toBeTruthy();
      expect(processing!.result_id).toBeNull();

      await expect(page.getByRole('status')).toContainText('Model forecast ready', {
        timeout: 150000,
      });
      await expect(page.getByTestId('model-result')).toContainText('Timestral 209M');
      await expect(page.getByTestId('prediction-band')).toBeVisible();
      await page.getByRole('slider', { name: /Inspect an observation/ }).focus();
      await page.keyboard.press('End');
      await expect(page.getByTestId('point-readout')).toContainText('1961-12-01');
      await expect(page.getByTestId('point-readout')).toContainText('FORECAST');
      await page.getByText('View data table', { exact: false }).click();
      await expect(page.getByRole('columnheader', { name: 'P10', exact: true })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'P90', exact: true })).toBeVisible();
      await page.getByText('View data table', { exact: false }).click();
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze()
        ).violations,
      ).toEqual([]);
      const session = await (await page.request.get('/api/session')).json();
      const workspace = await (
        await page.request.get(`/api/workspaces/${session.workspaces[0].id}`)
      ).json();
      const result = workspace.forecasts[0].result;
      expect(result.model).toBe('timestral_209m');
      expect(result.metadata.model_id).toBe('mistralai/Timestral-209M');
      expect(result.metadata.revision).toBe('9874d252ab0aae16f7f7c999f98f98d6ad7d8365');
      expect(result.quantiles.p50).toHaveLength(12);
      expect(result.points[0].date).toBe('1961-01-01');
      expect(result.evaluation.windows).toBe(3);
      for (let i = 0; i < 12; i++) {
        expect(result.quantiles.p10[i].value).toBeLessThanOrEqual(result.quantiles.p50[i].value);
        expect(result.quantiles.p50[i].value).toBeLessThanOrEqual(result.quantiles.p90[i].value);
      }
      const wid = session.workspaces[0].id,
        run = workspace.forecasts[0];
      const persisted = (
        await db.query(
          `
      SELECT j.status,j.attempts,j.fence,j.result_id,j.worker_id,j.lease_expires_at,
             d.id AS dataset_id,d.name,d.points AS history,d.row_count,d.frequency,
             f.id AS forecast_id,f.horizon,f.result,f.created_at
      FROM forecast_jobs j
      JOIN datasets d ON d.id=j.dataset_id AND d.workspace_id=j.workspace_id
      JOIN forecasts f ON f.id=j.result_id AND f.workspace_id=j.workspace_id AND f.dataset_id=j.dataset_id
      WHERE j.id=$1 AND j.workspace_id=$2`,
          [jobId, wid],
        )
      ).rows[0];
      expect(persisted).toBeTruthy();
      expect(persisted.status).toBe('completed');
      expect(persisted.attempts).toBe(1);
      expect(Number(persisted.fence)).toBe(1);
      expect(persisted.worker_id).toBeNull();
      expect(persisted.lease_expires_at).toBeNull();
      expect(persisted.result_id).toBe(run.id);
      expect(persisted.forecast_id).toBe(run.id);
      expect(persisted.dataset_id).toBe(run.dataset_id);
      expect(persisted.history).toEqual(history);
      expect(persisted.row_count).toBe(history.length);
      expect(persisted.frequency).toBe('monthly');
      expect(persisted.result).toEqual(result);
      expect(persisted.horizon).toBe(12);
      await page.getByRole('combobox', { name: 'Chart range', exact: true }).selectOption('all');
      await page.getByText('View data table', { exact: false }).click();
      const chartRows = await page
        .getByRole('region', { name: 'Scrollable series data', exact: true })
        .locator('tbody tr')
        .allTextContents();
      expect(chartRows).toHaveLength(history.length + 12);
      const table = page.getByRole('region', { name: 'Scrollable series data', exact: true });
      for (const [i, point] of persisted.result.points.entries()) {
        await expect(
          table
            .locator('tbody tr')
            .nth(history.length + i)
            .locator('td'),
        ).toHaveText([
          point.date,
          String(point.value),
          'Median forecast',
          ...['p10', 'p50', 'p90'].map((key) => String(persisted.result.quantiles[key][i].value)),
        ]);
      }
      await page.getByText('View data table', { exact: false }).click();
      await page.getByRole('combobox', { name: 'Chart range', exact: true }).selectOption('recent');
      const baselineAccepted = await page.request.post('/api/forecast-jobs', {
        headers: { Origin: 'http://127.0.0.1:3000' },
        data: {
          contractVersion: '2',
          workspaceId: wid,
          datasetId: run.dataset_id,
          horizon: 12,
          model: 'seasonal_naive',
        },
      });
      expect(baselineAccepted.status()).toBe(202);
      const baselineJob = (await baselineAccepted.json()).jobId;
      await expect
        .poll(
          async () =>
            (await (await page.request.get(`/api/forecast-jobs/${baselineJob}`)).json()).status,
          { timeout: 60000 },
        )
        .toBe('completed');
      await page.getByRole('button', { name: /02 Jobs/ }).click();
      await expect(page.getByRole('region', { name: 'Forecast jobs', exact: true })).toContainText(
        'completed',
      );
      await page.getByRole('button', { name: 'View result', exact: true }).last().click();
      await page.getByLabel('Saved forecast').selectOption(run.id);
      await page.getByRole('checkbox', { name: /Compare saved SeasonalNaive/ }).check();
      await expect(page.getByTestId('baseline-comparison')).toBeAttached();
      expect(
        await page.getByTestId('baseline-comparison').evaluate((e) => getComputedStyle(e).stroke),
      ).not.toBe('none');
      await expect(page.getByTestId('model-result')).toContainText(
        'Calibration is not established',
      );
      const xlsx = await page.request.get(
        `/api/workspaces/${wid}/forecasts/${run.id}/export?format=xlsx`,
      );
      expect(xlsx.status()).toBe(200);
      expect(xlsx.headers()['cache-control']).toBe('private, no-store');
      const exported = new ExcelJS.Workbook();
      await exported.xlsx.load((await xlsx.body()) as never);
      const csvResponse = await page.request.get(
        `/api/workspaces/${wid}/forecasts/${run.id}/export?format=csv`,
      );
      expect(csvResponse.status()).toBe(200);
      expect(csvResponse.headers()['cache-control']).toBe('private, no-store');
      const csvBody = await csvResponse.text();
      const csvRows = parse(csvBody, { skip_empty_lines: true }) as string[][];
      const header = [
        'record_type',
        'date',
        'value',
        'p10',
        'p50',
        'p90',
        'metadata_key',
        'metadata_value',
        'metadata_type',
      ];
      expect(csvRows[0]).toEqual(header);
      const expectedHistory = history.map((p) => [
        'history',
        p.date,
        p.value,
        '',
        '',
        '',
        '',
        '',
        '',
      ]);
      const expectedForecast = persisted.result.points.map(
        (p: { date: string; value: number }, i: number) => [
          'forecast',
          p.date,
          p.value,
          ...['p10', 'p50', 'p90'].map((key) => persisted.result.quantiles[key][i].value),
          '',
          '',
          '',
        ],
      );
      // Build the expected metadata independently from the saved database records.
      const expectedMetadata: (string | number)[][] = [];
      function flatten(value: unknown, key: string) {
        if (value !== null && typeof value === 'object') {
          if (key)
            expectedMetadata.push([
              'metadata',
              '',
              '',
              '',
              '',
              '',
              key,
              Object.keys(value).length ? '' : Array.isArray(value) ? '[]' : '{}',
              Array.isArray(value) ? 'array' : 'object',
            ]);
          for (const [child, entry] of Object.entries(value))
            flatten(entry, key ? `${key}.${child.replace(/[.\\]/g, '\\$&')}` : child);
        } else
          expectedMetadata.push([
            'metadata',
            '',
            '',
            '',
            '',
            '',
            key,
            value === null ? 'null' : typeof value === 'number' ? value : String(value),
            value === null ? 'null' : typeof value,
          ]);
      }
      flatten(
        {
          export_version: '2',
          workspace_id: wid,
          forecast_id: persisted.forecast_id,
          created_at: persisted.created_at.toISOString(),
          dataset_id: persisted.dataset_id,
          dataset_name: persisted.name,
          frequency: persisted.frequency,
          observations: persisted.row_count,
          horizon: persisted.horizon,
          result: Object.fromEntries(
            Object.entries(persisted.result).filter(
              ([key]) => !['points', 'quantiles'].includes(key),
            ),
          ),
        },
        '',
      );
      const stringRows = (rows: (string | number)[][]) => rows.map((row) => row.map(String));
      expect(csvRows.slice(1).filter((r) => r[0] === 'history')).toEqual(
        stringRows(expectedHistory),
      );
      expect(csvRows.slice(1).filter((r) => r[0] === 'forecast')).toEqual(
        stringRows(expectedForecast),
      );
      const sortedMetadata = (rows: (string | number)[][]) =>
        stringRows(rows).sort((a, b) => a[6].localeCompare(b[6]));
      expect(sortedMetadata(csvRows.slice(1).filter((r) => r[0] === 'metadata'))).toEqual(
        sortedMetadata(expectedMetadata),
      );
      expect(csvRows).toHaveLength(
        1 + expectedHistory.length + expectedForecast.length + expectedMetadata.length,
      );
      for (const [name, expected] of [
        ['Observations', expectedHistory],
        ['Forecast', expectedForecast],
        ['Metadata', expectedMetadata],
      ] as const) {
        const sheet = exported.getWorksheet(name)!;
        expect(sheet).toBeTruthy();
        expect(sheet.rowCount).toBe(expected.length + 1);
        expect(
          Array.from({ length: header.length }, (_, i) => sheet.getRow(1).getCell(i + 1).value),
        ).toEqual(header);
        const actual = Array.from({ length: expected.length }, (_, i) =>
          Array.from(
            { length: header.length },
            (_, col) => sheet.getRow(i + 2).getCell(col + 1).value ?? '',
          ),
        );
        if (name === 'Metadata')
          expect(sortedMetadata(actual as (string | number)[][])).toEqual(sortedMetadata(expected));
        else expect(actual).toEqual(expected);
      }
      await fs.writeFile(phase03bEvidencePath(`native-air-passengers${suffix}.csv`), csvBody);
      await fs.writeFile(
        phase03bEvidencePath(`native-air-passengers-equivalence${suffix}.json`),
        JSON.stringify(
          {
            source: 'Public AirPassengers fixture',
            input_format: format,
            job_id: jobId,
            lifecycle: {
              pending,
              processing,
              completed: {
                status: persisted.status,
                attempts: persisted.attempts,
                fence: String(persisted.fence),
                result_id: persisted.result_id,
              },
            },
            persisted: { history: persisted.history, result: persisted.result },
            assertions: {
              history_rows: history.length,
              chart_forecast_rows: 12,
              csv_forecast_rows: 12,
              xlsx_forecast_rows: 12,
              metadata_fields: expectedMetadata.length,
              all_exports_equal_database: true,
            },
          },
          null,
          2,
        ),
      );
      await page.getByRole('slider', { name: /Inspect an observation/ }).focus();
      await page.keyboard.press('End');
      await expect(page.getByTestId('point-readout')).toContainText('P10');
      await expect(page.getByTestId('point-readout')).toContainText('P50');
      await expect(page.getByTestId('point-readout')).toContainText('P90');
      await fs.writeFile(
        phase03bEvidencePath(`native-air-passengers${suffix}.xlsx`),
        await xlsx.body(),
      );
      await fs.writeFile(
        phase03bEvidencePath(`native-air-passengers${suffix}.json`),
        JSON.stringify(result, null, 2),
      );
      const uiDownloads: {
        width: number;
        format: string;
        filename: string;
        matches_persisted_result: boolean;
      }[] = [];
      for (const width of [1440, 768, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        const audit = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(audit.violations).toEqual([]);
        const screenshot = await page.screenshot({
          path: phase03bEvidencePath(`results-${width}${suffix}.png`),
          fullPage: true,
        });
        expect(screenshot.readUInt32BE(16), 'PNG width must match its viewport label').toBe(width);
        for (const output of ['csv', 'xlsx']) {
          const waiting = page.waitForEvent('download');
          await page
            .getByRole('button', { name: `Export ${output.toUpperCase()}`, exact: true })
            .click();
          const download = await waiting;
          expect(download.suggestedFilename()).toBe(`forewise-${run.id}.${output}`);
          expect(await download.failure()).toBeNull();
          const localPath = await download.path();
          expect(localPath).toBeTruthy();
          const bytes = await fs.readFile(localPath!);
          if (output === 'csv') expect(bytes.toString('utf8')).toBe(csvBody);
          else {
            const downloaded = new ExcelJS.Workbook();
            await downloaded.xlsx.load(bytes as never);
            const forecast = downloaded.getWorksheet('Forecast')!;
            expect(forecast.rowCount).toBe(13);
            for (let i = 0; i < 12; i++) {
              expect(forecast.getCell(`B${i + 2}`).value).toBe(persisted.result.points[i].date);
              expect(forecast.getCell(`C${i + 2}`).value).toBe(persisted.result.points[i].value);
              for (const [column, key] of [
                ['D', 'p10'],
                ['E', 'p50'],
                ['F', 'p90'],
              ])
                expect(forecast.getCell(`${column}${i + 2}`).value).toBe(
                  persisted.result.quantiles[key][i].value,
                );
            }
          }
          uiDownloads.push({
            width,
            format: output,
            filename: download.suggestedFilename(),
            matches_persisted_result: true,
          });
        }
      }
      expect(uiDownloads).toHaveLength(6);
      await fs.writeFile(
        phase03bEvidencePath(`ui-downloads${suffix}.json`),
        JSON.stringify({ input_format: format, downloads: uiDownloads }, null, 2),
      );
      const other = await playwright.request.newContext({
        baseURL: 'http://127.0.0.1:3000',
        extraHTTPHeaders: { Origin: 'http://127.0.0.1:3000' },
      });
      expect((await other.get(`/api/forecast-jobs/${jobId}`)).status()).toBe(401);
      for (const output of ['csv', 'xlsx'])
        expect(
          (
            await other.get(`/api/workspaces/${wid}/forecasts/${run.id}/export?format=${output}`)
          ).status(),
        ).toBe(401);
      const otherRegistration = await other.post('/api/auth/register', {
        data: {
          name: 'Other tenant',
          workspace: 'Other tenant',
          email: `other-timestral-${Date.now()}@example.test`,
          password: 'Other-test-only-passphrase',
        },
      });
      expect(otherRegistration.status()).toBe(200);
      for (const output of ['csv', 'xlsx'])
        expect(
          (
            await other.get(`/api/workspaces/${wid}/forecasts/${run.id}/export?format=${output}`)
          ).status(),
        ).toBe(404);
      expect((await other.get(`/api/forecast-jobs/${jobId}`)).status()).toBe(404);
      expect((await other.get(`/api/workspaces/${session.workspaces[0].id}`)).status()).toBe(404);
      await other.dispose();
      await page.reload();
      await page.getByRole('button', { name: /03 Results/ }).click();
      await page.getByLabel('Saved forecast').selectOption(run.id);
      await expect(page.getByTestId('model-result')).toContainText('Timestral 209M');
      await expect(page.getByLabel('Forecasting model', { exact: true })).toHaveValue(
        'timestral_209m',
      );
    } finally {
      if (worker && worker.exitCode === null && worker.signalCode === null) {
        const stopped = new Promise<void>((resolve) => worker!.once('exit', () => resolve()));
        worker.kill();
        await stopped;
      }
      await db.end();
    }
  });
}
