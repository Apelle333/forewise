import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { readImport, mappedDataset, inspectWorkbookZip } from '../lib/dataset-import';
import { parseDataset } from '../lib/csv';

const fixture = (name: string) => fs.readFile(path.join(__dirname, 'fixtures/onboarding', name));
for (const extension of ['csv', 'xlsx']) {
  for (const [name, problem] of [
    ['valid_daily', ''],
    ['duplicate_dates', 'Duplicate timestamp'],
    ['date_gaps', 'Gap or inconsistency'],
    ['invalid_values', 'Invalid numeric value'],
  ]) {
    test(`authoritative ${extension} importer / ${name}`, async () => {
      const table = await readImport(await fixture(`${name}.${extension}`), `history.${extension}`);
      const parse = () => mappedDataset(table, { dateCol: 0, valueCol: 1 }, 'daily');
      if (problem) assert.throws(parse, new RegExp(problem));
      else {
        const points = parse();
        assert.equal(points.length, 10);
        assert.equal(points[0].date, '2023-01-01');
      }
    });
  }
}
test('server rejects formulas without trusting the client preview', async () => {
  await assert.rejects(
    readImport(await fixture('formula_injection.xlsx'), 'formula.xlsx'),
    /Formula detected/,
  );
});
test('mapped arbitrary CSV headings are canonicalized; raw canonical API stays strict', async () => {
  const text =
    'units,recorded,unused\n' +
    Array.from({ length: 8 }, (_, i) => `${i},2026-01-0${i + 1},extra`).join('\n');
  const table = await readImport(Buffer.from(text), 'columns.csv');
  assert.equal(mappedDataset(table, { dateCol: 1, valueCol: 0 }, 'daily')[7].value, 7);
  assert.throws(() => mappedDataset(table, { dateCol: 0, valueCol: 0 }, 'daily'), /different/);
  assert.throws(() => mappedDataset(table, { dateCol: 9, valueCol: 0 }, 'daily'), /different/);
  assert.throws(() => parseDataset('date,value,extra\n2026-01-01,1,2'), /Invalid CSV/);
});
test('actual upload bytes, duplicate headings, invalid UTF-8 and legacy XLS are rejected', async () => {
  await assert.rejects(readImport(await fixture('oversized.csv'), 'oversized.csv'), /1 MB/);
  await assert.rejects(
    readImport(Buffer.from('date,date\n' + Array(8).fill('a,b').join('\n')), 'bad.csv'),
    /unique/,
  );
  await assert.rejects(readImport(Buffer.from([255, 254, 253]), 'bad.csv'), /Invalid CSV/);
  await assert.rejects(readImport(Buffer.from('legacy'), 'history.xls'), /Unsupported/);
});
async function workbookBytes(change?: (w: ExcelJS.Workbook) => void) {
  const w = new ExcelJS.Workbook(),
    s = w.addWorksheet('Observations');
  s.addRow(['date', 'value']);
  for (let i = 1; i <= 8; i++) {
    s.addRow([new Date(Date.UTC(2026, 0, i)), i]);
    s.getCell(i + 1, 1).numFmt = 'yyyy-mm-dd';
  }
  change?.(w);
  return Buffer.from(await w.xlsx.writeBuffer());
}
test('real Excel dates respect both workbook epochs', async () => {
  for (const date1904 of [false, true]) {
    const table = await readImport(
      await workbookBytes((w) => {
        w.properties.date1904 = date1904;
      }),
      'dates.xlsx',
    );
    assert.equal(mappedDataset(table, { dateCol: 0, valueCol: 1 }, 'daily')[0].date, '2026-01-01');
  }
});
test('multiple sheets and sparse coordinates cannot amplify worksheet objects', async () => {
  await assert.rejects(
    readImport(await workbookBytes((w) => w.addWorksheet('Hidden')), 'many.xlsx'),
    /one worksheet/,
  );
  await assert.rejects(
    readImport(
      await workbookBytes((w) => {
        w.worksheets[0].getCell('A6000').value = 'bad';
      }),
      'sparse.xlsx',
    ),
    /5,000/,
  );
  await assert.rejects(
    readImport(
      await workbookBytes((w) => {
        w.worksheets[0].getCell('AG2').value = 'bad';
      }),
      'wide.xlsx',
    ),
    /32 columns/,
  );
});
test('actual ZIP expansion is bounded even with forged central-directory size', async () => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types/>');
  zip.file('xl/worksheets/sheet1.xml', 'x'.repeat(8_000_001));
  const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  for (let i = 0; i < bytes.length - 46; i++)
    if (bytes.readUInt32LE(i) === 0x02014b50 && bytes.readUInt32LE(i + 24) > 8_000_000)
      bytes.writeUInt32LE(1, i + 24);
  assert.throws(() => inspectWorkbookZip(bytes), /expansion|corrupt/);
});
test('malformed and traversal ZIP entries are rejected', async () => {
  assert.throws(() => inspectWorkbookZip(Buffer.alloc(10)), /Invalid/);
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types/>');
  zip.file('../evil.xml', 'x');
  const bytes = await zip.generateAsync({ type: 'nodebuffer' });
  assert.throws(() => inspectWorkbookZip(bytes), /Unsafe/);
});

async function alteredWorkbook(edit: (zip: JSZip) => Promise<void>) {
  const zip = await JSZip.loadAsync(await workbookBytes());
  await edit(zip);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
test('named-range and sheet-id amplification are rejected before ExcelJS loads', async () => {
  for (const [change, expected] of [
    [
      (xml: string) =>
        xml.replace(
          '</workbook>',
          '<definedNames><definedName name="bomb">Sheet1!$A$1:$XFD$1048576</definedName></definedNames></workbook>',
        ),
      /Named ranges/,
    ],
    [(xml: string) => xml.replace('sheetId="1"', 'sheetId="2147483647"'), /worksheet identifier/],
  ] as const) {
    const bytes = await alteredWorkbook(async (zip) => {
      const xml = await zip.file('xl/workbook.xml')!.async('string');
      zip.file('xl/workbook.xml', change(xml));
    });
    await assert.rejects(readImport(bytes, 'attack.xlsx'), expected);
  }
});
test('XML entities in sparse coordinates and Unicode ZIP paths cannot bypass preflight', async () => {
  const sparse = await alteredWorkbook(async (zip) => {
    const xml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    zip.file('xl/worksheets/sheet1.xml', xml.replace('r="A2"', "r='A&#54;000'"));
  });
  await assert.rejects(readImport(sparse, 'sparse.xlsx'), /5,000/);
  const unicode = await alteredWorkbook(async (zip) => {
    zip.file('évil.bin', 'x');
  });
  await assert.rejects(readImport(unicode, 'unicode.xlsx'), /Unsafe|Unsupported/);
});

test('ASCII ZIP entries with Unicode-path overrides are rejected', async () => {
  const original = await workbookBytes();
  let central = -1;
  for (let i = 0; i < original.length - 46; i++)
    if (original.readUInt32LE(i) === 0x02014b50) {
      central = i;
      break;
    }
  assert.ok(central >= 0);
  const n = original.readUInt16LE(central + 28),
    oldExtra = original.readUInt16LE(central + 30);
  const insert = central + 46 + n + oldExtra;
  const extra = Buffer.from([0x75, 0x70, 5, 0, 1, 0, 0, 0, 0]);
  const bytes = Buffer.concat([original.subarray(0, insert), extra, original.subarray(insert)]);
  bytes.writeUInt16LE(oldExtra + extra.length, central + 30);
  const end = bytes.length - 22;
  bytes.writeUInt32LE(bytes.readUInt32LE(end + 12) + extra.length, end + 12);
  assert.throws(() => inspectWorkbookZip(bytes), /Unsupported XLSX path/);
});
