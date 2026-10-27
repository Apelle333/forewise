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

async function numericWorkbook(value: string, explicitType = false) {
  return alteredWorkbook(async (zip) => {
    const name = 'xl/worksheets/sheet1.xml';
    const xml = await zip.file(name)!.async('string');
    assert.match(xml, /<c r="B2"[^>]*><v>1<\/v><\/c>/);
    zip.file(
      name,
      xml.replace(
        /<c r="B2"[^>]*><v>1<\/v><\/c>/,
        `<c r="B2"${explicitType ? ' t="n"' : ''}><v>${value}</v></c>`,
      ),
    );
  });
}

for (const value of ['12 units', '1e', '0x10']) {
  test(`numeric XLSX XML rejects the entire malformed representation / ${value}`, async () => {
    for (const explicitType of [false, true]) {
      const bytes = await numericWorkbook(value, explicitType);
      assert.equal(bytes.readUInt32LE(0), 0x04034b50);
      await assert.rejects(readImport(bytes, 'malformed.xlsx'), /Invalid XLSX numeric cell/);
    }
  });
}

test('numeric XLSX XML preserves signed decimals, exponent values and date serials', async () => {
  for (const [raw, value] of [
    ['-12.5', -12.5],
    ['.25', 0.25],
    ['+1.25e-2', 0.0125],
    ['2E+3', 2000],
  ] as const) {
    const table = await readImport(await numericWorkbook(raw), 'valid.xlsx');
    const points = mappedDataset(table, { dateCol: 0, valueCol: 1 }, 'daily');
    assert.equal(points[0].value, value);
    assert.equal(points[0].date, '2026-01-01');
  }
});

test('numeric XLSX validation rejects nonfinite, empty, nested and excessive values before loading', async () => {
  for (const raw of [
    '',
    'NaN',
    'INF',
    '1e999',
    '12 3',
    '--1',
    '0b10',
    '<x>12</x>',
    '1'.repeat(2049),
  ])
    await assert.rejects(
      readImport(await numericWorkbook(raw), 'invalid.xlsx'),
      /Invalid XLSX numeric cell/,
    );
});

test('unsupported cell types cannot reach ExcelJS default numeric conversion', async () => {
  for (const type of ['number', 'N', 'd']) {
    const bytes = await alteredWorkbook(async (zip) => {
      const name = 'xl/worksheets/sheet1.xml';
      const xml = await zip.file(name)!.async('string');
      zip.file(
        name,
        xml.replace(/<c r="B2"[^>]*><v>1<\/v><\/c>/, `<c r="B2" t="${type}"><v>12 units</v></c>`),
      );
    });
    await assert.rejects(readImport(bytes, 'unsupported.xlsx'), /Unsupported XLSX cell type/);
  }
});

async function workbookDateSerials(start: number, date1904 = false) {
  const zip = await JSZip.loadAsync(
    await workbookBytes((w) => {
      w.properties.date1904 = date1904;
    }),
  );
  let xml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
  for (let i = 0; i < 8; i++)
    xml = xml.replace(
      new RegExp(`(<c r="A${i + 2}"[^>]*><v>)[^<]+(</v>)`),
      (_, before: string, after: string) => `${before}${start + i}${after}`,
    );
  zip.file('xl/worksheets/sheet1.xml', xml);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

test('early 1900-system date serials cannot silently shift imported dates', async () => {
  for (const serial of [1, 59, 60])
    await assert.rejects(
      readImport(await workbookDateSerials(serial), 'historic.xlsx'),
      /Excel dates before 1900-03-01/,
    );
  const table = await readImport(await workbookDateSerials(61), 'dates.xlsx');
  assert.equal(mappedDataset(table, { dateCol: 0, valueCol: 1 }, 'daily')[0].date, '1900-03-01');
});

test('1904-system date serial zero remains a valid date', async () => {
  const table = await readImport(await workbookDateSerials(0, true), 'dates.xlsx');
  assert.equal(mappedDataset(table, { dateCol: 0, valueCol: 1 }, 'daily')[0].date, '1904-01-01');
});

test('ExcelJS worksheet and metadata aliases cannot bypass ZIP preflight', async () => {
  for (const name of [
    'xl/worksheets/sheet2.xml.bin',
    'prefix/xl/worksheets/sheet2.xml',
    'xl/worksheets/_rels/sheet2.xml.rels.bin',
    'xl/worksheets/_rels/sheet2.xmlXrels',
    'prefix/xl/theme/theme2.xml',
    'xl/drawings/drawing2.xml.bin',
    'prefix/xl/comments2.xml',
    'xl/tables/table2.xml.bin',
    'xl/drawings/_rels/drawing2.xml.rels.bin',
    'xl/drawings/vmlDrawing2.vml.bin',
  ]) {
    const bytes = await alteredWorkbook(async (zip) => {
      zip.file(name, await zip.file('xl/worksheets/sheet1.xml')!.async('string'));
    });
    await assert.rejects(readImport(bytes, 'alias.xlsx'), /Unsupported XLSX part filename/, name);
  }
});

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

test('Excel date-only imports preserve leap day and reject UTC time components', async () => {
  const bytes = await workbookBytes((w) => {
    for (let i = 0; i < 8; i++)
      w.worksheets[0].getCell(i + 2, 1).value = new Date(Date.UTC(2024, 1, 26 + i));
  });
  const points = mappedDataset(
    await readImport(bytes, 'leap.xlsx'),
    { dateCol: 0, valueCol: 1 },
    'daily',
  );
  assert.equal(points[3].date, '2024-02-29');
  assert.equal(points[4].date, '2024-03-01');
  await assert.rejects(
    readImport(
      await workbookBytes((w) => {
        w.worksheets[0].getCell('A2').value = new Date('2026-01-01T00:00:01.000Z');
      }),
      'time.xlsx',
    ),
    /date-only Excel dates without times/,
  );
});

test('mapped XLSX values preserve negative, decimal and scientific numbers', async () => {
  const values = [-0.125, -42.75, 1.25e-7, -4.2e6, 0, 1e12, 3.125, 6.022e3];
  const bytes = await workbookBytes((w) => {
    values.forEach((value, i) => {
      w.worksheets[0].getCell(i + 2, 2).value = i === 2 ? '1.25e-7' : value;
    });
  });
  const points = mappedDataset(
    await readImport(bytes, 'numbers.xlsx'),
    { dateCol: 0, valueCol: 1 },
    'daily',
  );
  assert.deepEqual(
    points.map((point) => point.value),
    values,
  );
});

test('empty and mixed text values in the mapped XLSX column are rejected', async () => {
  for (const value of [null, '12 units']) {
    const bytes = await workbookBytes((w) => {
      w.worksheets[0].getCell('B5').value = value;
    });
    const table = await readImport(bytes, 'invalid-numbers.xlsx');
    assert.throws(
      () => mappedDataset(table, { dateCol: 0, valueCol: 1 }, 'daily'),
      /Invalid numeric value/,
    );
  }
});

test('cached and shared formulas are rejected even with valid cached numeric values', async () => {
  const cached = await workbookBytes((w) => {
    w.worksheets[0].getCell('B2').value = { formula: '1+1', result: 2 };
  });
  await assert.rejects(readImport(cached, 'cached-formula.xlsx'), /Formula detected/);
  const shared = await alteredWorkbook(async (zip) => {
    const xml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    zip.file(
      'xl/worksheets/sheet1.xml',
      xml
        .replace(
          /(<c r="B2"[^>]*>).*?(<\/c>)/,
          '$1<f t="shared" ref="B2:B9" si="0">1+1</f><v>2</v>$2',
        )
        .replace(/(<c r="B3"[^>]*>).*?(<\/c>)/, '$1<f t="shared" si="0"/><v>2</v>$2'),
    );
  });
  await assert.rejects(readImport(shared, 'shared-formula.xlsx'), /Formula detected/);
});

test('hidden observations and a sole hidden worksheet remain included', async () => {
  const bytes = await workbookBytes((w) => {
    w.worksheets[0].state = 'hidden';
    w.worksheets[0].getRow(3).hidden = true;
    w.worksheets[0].getCell('B3').value = -12.5;
  });
  const points = mappedDataset(
    await readImport(bytes, 'hidden.xlsx'),
    { dateCol: 0, valueCol: 1 },
    'daily',
  );
  assert.equal(points.length, 8);
  assert.deepEqual(points[1], { date: '2026-01-02', value: -12.5 });
  await assert.rejects(
    readImport(
      await workbookBytes((w) => {
        w.addWorksheet('Hidden', { state: 'veryHidden' });
      }),
      'extra-hidden.xlsx',
    ),
    /one worksheet/,
  );
});

test('OLE-container magic is rejected as XLSX; this is not a genuine encrypted-workbook fixture', async () => {
  const ole = Buffer.alloc(512);
  Buffer.from('d0cf11e0a1b11ae1', 'hex').copy(ole);
  await assert.rejects(readImport(ole, 'protected.xlsx'), /Invalid XLSX archive/);
});
