import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import * as ExcelJS from 'exceljs';
import { parseDataset } from '../lib/csv';

const FIXTURES_DIR = path.join(__dirname, 'fixtures/onboarding');

// Helper to convert XLSX to CSV string for parseDataset tests
async function xlsxToCsv(filename: string) {
  const arrayBuffer = fs.readFileSync(path.join(FIXTURES_DIR, filename));
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) throw new Error('No worksheet found');
  
  const rows: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const rowValues: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      rowValues.push(String(cell.value ?? ''));
    });
    rows.push(rowValues);
  });
  
  return rows.map(row => row.join(',')).join('\n');
}

describe('Dataset Validation Authority', () => {
  it('accepts valid daily CSV', () => {
    const csv = fs.readFileSync(path.join(FIXTURES_DIR, 'valid_daily.csv'), 'utf8');
    const result = parseDataset(csv);
    assert.strictEqual(result.length, 10);
    assert.strictEqual(result[0].date, '2023-01-01');
  });

  it('rejects duplicate dates in CSV', () => {
    const csv = fs.readFileSync(path.join(FIXTURES_DIR, 'duplicate_dates.csv'), 'utf8');
    assert.throws(() => parseDataset(csv), /Duplicate timestamp/);
  });

  it('rejects date gaps in CSV', () => {
    const csv = fs.readFileSync(path.join(FIXTURES_DIR, 'date_gaps.csv'), 'utf8');
    assert.throws(() => parseDataset(csv), /Gap or inconsistency/);
  });

  it('rejects invalid numeric values in CSV', () => {
    const csv = fs.readFileSync(path.join(FIXTURES_DIR, 'invalid_values.csv'), 'utf8');
    assert.throws(() => parseDataset(csv), /Invalid numeric value/);
  });

  it('rejects oversized CSV files', () => {
    const csv = fs.readFileSync(path.join(FIXTURES_DIR, 'oversized.csv'), 'utf8');
    assert.throws(() => parseDataset(csv), /CSV must be smaller than 1 MB/);
  });

  it('accepts valid daily XLSX', async () => {
    const csv = await xlsxToCsv('valid_daily.xlsx');
    const result = parseDataset(csv);
    assert.strictEqual(result.length, 10);
    assert.strictEqual(result[0].date, '2023-01-01');
  });

  it('rejects duplicate dates in XLSX', async () => {
    const csv = await xlsxToCsv('duplicate_dates.xlsx');
    assert.throws(() => parseDataset(csv), /Duplicate timestamp/);
  });

  it('rejects date gaps in XLSX', async () => {
    const csv = await xlsxToCsv('date_gaps.xlsx');
    assert.throws(() => parseDataset(csv), /Gap or inconsistency/);
  });

  it('rejects invalid numeric values in XLSX', async () => {
    const csv = await xlsxToCsv('invalid_values.xlsx');
    assert.throws(() => parseDataset(csv), /Invalid numeric value/);
  });

  it('rejects formula injection in XLSX', async () => {
    const arrayBuffer = fs.readFileSync(path.join(FIXTURES_DIR, 'formula_injection.xlsx'));
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const worksheet = workbook.getWorksheet(1);
    
    let formulaFound = false;
    worksheet?.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.formula) formulaFound = true;
      });
    });
    assert.strictEqual(formulaFound, true, 'Formula should be present in the fixture');
    
    // Testing the logic from DataOnboarding.tsx
    const checkFormulas = () => {
      worksheet!.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        row.eachCell({ includeEmpty: true }, (cell) => {
          if (cell.formula) {
            throw new Error(`Formula detected at row ${rowNumber}, cell ${cell.address}. Formulas are not permitted.`);
          }
        });
      });
    };
    assert.throws(checkFormulas, /Formula detected/);
  });
});
