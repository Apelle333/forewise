import { inflateRawSync } from 'node:zlib';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { SaxesParser } from 'saxes';
import { parseDataset, type Frequency } from './csv';

export type ImportTable = { headers: string[]; rows: string[][] };
export type ColumnMapping = { dateCol: number; valueCol: number };
export class ImportError extends Error {}
const invalid = (message: string): never => {
  throw new ImportError(message);
};
// Match ExcelJS's part dispatch, then require its complete canonical ZIP path.
const parsedPartPaths = [
  /xl\/worksheets\/sheet\d+\.xml/,
  /xl\/worksheets\/_rels\/sheet\d+\.xml.rels/,
  /xl\/theme\/[a-zA-Z0-9]+\.xml/,
  /xl\/drawings\/[a-zA-Z0-9]+\.xml/,
  /xl\/comments\d+\.xml/,
  /xl\/tables\/table\d+\.xml/,
  /xl\/drawings\/_rels\/[a-zA-Z0-9]+\.xml\.rels/,
  /xl\/drawings\/vmlDrawing\d+\.vml/,
];

/** Bound actual expansion before ExcelJS/JSZip allocates worksheet objects. */
export function inspectWorkbookZip(bytes: Buffer) {
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (
      bytes.readUInt32LE(i) === 0x06054b50 &&
      i + 22 + bytes.readUInt16LE(i + 20) === bytes.length
    ) {
      end = i;
      break;
    }
  if (end < 0) invalid('Invalid XLSX archive.');
  const entries = bytes.readUInt16LE(end + 10),
    start = bytes.readUInt32LE(end + 16);
  if (
    bytes.readUInt32LE(end + 4) ||
    bytes.readUInt16LE(end + 8) !== entries ||
    entries > 256 ||
    !entries ||
    start + bytes.readUInt32LE(end + 12) !== end
  )
    invalid('Unsupported or excessive XLSX archive.');
  const names = new Set<string>(),
    ranges: [number, number][] = [];
  function checkExtra(from: number, length: number) {
    const end = from + length;
    if (end > bytes.length) invalid('Malformed XLSX extra fields.');
    while (from < end) {
      if (from + 4 > end) invalid('Malformed XLSX extra fields.');
      const id = bytes.readUInt16LE(from),
        size = bytes.readUInt16LE(from + 2);
      if (from + 4 + size > end || id === 0x7075 || id === 0x0001)
        invalid('Unsupported XLSX path or ZIP64 extra field.');
      from += 4 + size;
    }
  }
  let pos = start,
    expanded = 0,
    sheets = 0;
  for (let i = 0; i < entries; i++) {
    if (pos + 46 > end || bytes.readUInt32LE(pos) !== 0x02014b50)
      invalid('Malformed XLSX directory.');
    const flags = bytes.readUInt16LE(pos + 8),
      method = bytes.readUInt16LE(pos + 10);
    const compressed = bytes.readUInt32LE(pos + 20),
      size = bytes.readUInt32LE(pos + 24);
    const n = bytes.readUInt16LE(pos + 28),
      extra = bytes.readUInt16LE(pos + 30),
      comment = bytes.readUInt16LE(pos + 32);
    const local = bytes.readUInt32LE(pos + 42);
    if (
      pos + 46 + n + extra + comment > end ||
      flags & 1 ||
      ![0, 8].includes(method) ||
      size > 8_000_000 ||
      compressed === 0xffffffff ||
      local === 0xffffffff ||
      bytes.readUInt16LE(pos + 34)
    )
      invalid('Unsupported or excessive XLSX entry.');
    const name = bytes.subarray(pos + 46, pos + 46 + n).toString('utf8');
    if (
      !name ||
      /[^\x20-\x7e]/.test(name) ||
      name.includes('\\') ||
      name.startsWith('/') ||
      name
        .replace(/\/$/, '')
        .split('/')
        .some((p) => !p || p === '..' || p === '.') ||
      names.has(name)
    )
      invalid('Unsafe XLSX entry name.');
    for (const pattern of parsedPartPaths) {
      const part = pattern.exec(name)?.[0];
      if (part && (part !== name || (name.includes('/_rels/') && !name.endsWith('.xml.rels'))))
        invalid('Unsupported XLSX part filename.');
    }
    names.add(name);
    checkExtra(pos + 46 + n, extra);
    if (/vbaProject|embeddings\/|externalLinks\//i.test(name))
      invalid('Macros, embedded files and external links are not supported.');
    if (
      local + 30 > start ||
      bytes.readUInt32LE(local) !== 0x04034b50 ||
      bytes.readUInt16LE(local + 6) !== flags ||
      bytes.readUInt16LE(local + 8) !== method
    )
      invalid('Malformed XLSX entry.');
    const data = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    checkExtra(local + 30 + bytes.readUInt16LE(local + 26), bytes.readUInt16LE(local + 28));
    if (
      data + compressed > start ||
      bytes.subarray(local + 30, local + 30 + bytes.readUInt16LE(local + 26)).toString('utf8') !==
        name ||
      ranges.some(([a, b]) => local < b && data + compressed > a)
    )
      invalid('Overlapping XLSX entries.');
    ranges.push([local, data + compressed]);
    let content: Buffer;
    try {
      content =
        method === 0
          ? bytes.subarray(data, data + compressed)
          : inflateRawSync(bytes.subarray(data, data + compressed), { maxOutputLength: 8_000_000 });
    } catch {
      invalid('XLSX expansion exceeds the import budget or is corrupt.');
    }
    expanded += content!.length;
    if (content!.length !== size || expanded > 16_000_000)
      invalid('XLSX expansion exceeds the import budget or is corrupt.');
    if (/\.xml$/i.test(name)) {
      const xml = content!.toString('utf8');
      const worksheet = /^xl\/worksheets\/[^/]+\.xml$/.test(name);
      if (worksheet) sheets++;
      const parser = new SaxesParser({ xmlns: false });
      let elements = 0,
        strings = 0,
        styles = 0;
      let cellType: string | null = null,
        numericValue: string | null = null,
        valueSeen = false;
      const numericError = () =>
        invalid('Invalid XLSX numeric cell. Use a finite decimal or scientific-notation value.');
      parser.on('doctype', () => invalid('XML entities are not supported.'));
      parser.on('opentag', (node) => {
        if (++elements > 500_000) invalid('XLSX XML exceeds the import budget.');
        const tag = node.name.split(':').at(-1);
        const attr = (key: string) => String(node.attributes[key] ?? '');
        // Validate raw lexical content before ExcelJS's permissive parseFloat loses it.
        // Numeric cells include date serials. Shared strings and plain text are separate types.
        if (worksheet) {
          if (numericValue !== null) numericError(); // A numeric <v> may not contain elements.
          if (tag === 'c') {
            if (cellType !== null) invalid('Malformed XLSX cell nesting.');
            cellType = attr('t') || 'n';
            if (!['n', 's', 'str', 'inlineStr', 'b', 'e'].includes(cellType))
              invalid('Unsupported XLSX cell type. Use plain values and date serials.');
            valueSeen = false;
          } else if (tag === 'v' && cellType === 'n') {
            if (valueSeen) numericError();
            valueSeen = true;
            numericValue = '';
          }
        }
        if (tag === 'definedNames' || tag === 'definedName')
          invalid('Named ranges are not supported. Export a plain data worksheet.');
        if (
          tag === 'sheet' &&
          (!/^\d+$/.test(attr('sheetId')) ||
            Number(attr('sheetId')) < 1 ||
            Number(attr('sheetId')) > 32)
        )
          invalid('Unsupported worksheet identifier.');
        if (tag === 'si' && ++strings > 160_032) invalid('Too many shared strings.');
        if (tag === 'xf' && ++styles > 1024) invalid('Too many workbook styles.');
        if (worksheet && tag === 'f')
          invalid('Formula detected. Replace formulas with values before importing.');
        if (worksheet && (tag === 'row' || tag === 'c')) {
          const ref = attr('r'),
            match = ref.match(tag === 'row' ? /^(\d+)$/ : /^([A-Z]+)(\d+)$/);
          if (!match) invalid('Invalid worksheet coordinate.');
          const number = Number(match![match!.length - 1]);
          let col = 0;
          if (tag === 'c') for (const c of match![1]) col = col * 26 + c.charCodeAt(0) - 64;
          if (number < 1 || number > 5001 || col > 32)
            invalid('Use at most 5,000 observations and 32 columns.');
        }
      });
      const collectNumber = (text: string) => {
        if (numericValue === null) return;
        if (numericValue.length + text.length > 2048) numericError();
        numericValue += text;
      };
      parser.on('text', collectNumber);
      parser.on('cdata', collectNumber);
      parser.on('closetag', (node) => {
        const tag = node.name.split(':').at(-1);
        if (tag === 'v' && numericValue !== null) {
          const value = numericValue.trim(); // XML numeric whitespace is insignificant.
          if (
            !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) ||
            !Number.isFinite(Number(value))
          )
            numericError();
          numericValue = null;
        } else if (worksheet && tag === 'c') cellType = null;
      });
      try {
        parser.write(xml).close();
      } catch (e) {
        if (e instanceof ImportError) throw e;
        invalid('Malformed XLSX XML.');
      }
    }
    pos += 46 + n + extra + comment;
  }
  if (pos !== end || sheets !== 1 || !names.has('[Content_Types].xml'))
    invalid('Use an XLSX workbook with exactly one worksheet.');
}

export async function readImport(bytes: Buffer, filename: string): Promise<ImportTable> {
  if (!bytes.length || bytes.length > 1_000_000)
    invalid('Choose a non-empty CSV or XLSX file up to 1 MB.');
  let rows: string[][];
  if (/\.csv$/i.test(filename)) {
    try {
      rows = parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes), {
        bom: true,
        trim: true,
        skip_empty_lines: true,
        max_record_size: 16384,
      });
    } catch {
      invalid('Invalid CSV. Use UTF-8 text with consistent columns.');
    }
  } else if (/\.xlsx$/i.test(filename)) {
    inspectWorkbookZip(bytes);
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(
        bytes as never,
        {
          maxRows: 5001,
          maxCols: 32,
          ignoreNodes: [
            'mergeCells',
            'cols',
            'conditionalFormatting',
            'extLst',
            'hyperlinks',
            'dataValidations',
            'drawing',
            'picture',
          ],
        } as ExcelJS.XlsxReadOptions,
      );
    } catch {
      invalid('Unable to read XLSX. Use a standard, unencrypted workbook.');
    }
    if (workbook.worksheets.length !== 1) invalid('Use exactly one worksheet.');
    const sheet = workbook.worksheets[0];
    if (sheet.rowCount > 5001 || sheet.columnCount > 32)
      invalid('Use at most 5,000 observations and 32 columns.');
    rows = [];
    for (let r = 1; r <= sheet.rowCount; r++) {
      const row: string[] = [];
      for (let c = 1; c <= sheet.columnCount; c++) {
        const value = sheet.getCell(r, c).value;
        if (value instanceof Date) {
          if (!workbook.properties.date1904 && value.getTime() < Date.UTC(1900, 2, 1))
            invalid('Excel dates before 1900-03-01 are not supported. Use YYYY-MM-DD text.');
          if (
            !Number.isFinite(value.getTime()) ||
            value.toISOString().slice(11) !== '00:00:00.000Z'
          )
            invalid('Use date-only Excel dates without times.');
          row.push(value.toISOString().slice(0, 10));
        } else if (value === null || value === undefined) row.push('');
        else if (typeof value === 'string' || typeof value === 'number') row.push(String(value));
        else invalid('Unsupported cell. Replace formulas, errors and rich text with plain values.');
      }
      rows.push(row);
    }
  } else invalid('Unsupported file. Choose CSV or XLSX, not legacy XLS.');
  if (rows!.length < 9 || rows!.length > 5001) invalid('Upload between 8 and 5,000 observations.');
  const headers = rows![0];
  if (
    headers.length < 2 ||
    headers.length > 32 ||
    headers.some((h) => !h || h.length > 120) ||
    new Set(headers).size !== headers.length
  )
    invalid('Use 2–32 unique, non-empty column headings, up to 120 characters each.');
  if (rows!.some((row) => row.length !== headers.length || row.some((cell) => cell.length > 2048)))
    invalid('Use consistent columns and cells shorter than 2,048 characters.');
  return { headers, rows: rows!.slice(1) };
}

export function mappedDataset(table: ImportTable, mapping: ColumnMapping, frequency: Frequency) {
  const { dateCol, valueCol } = mapping;
  if (
    ![dateCol, valueCol].every((n) => Number.isInteger(n) && n >= 0 && n < table.headers.length) ||
    dateCol === valueCol
  )
    invalid('Choose two different date and value columns.');
  const quote = (s: string) => `"${s.replaceAll('"', '""')}"`;
  return parseDataset(
    'date,value\n' +
      table.rows.map((row) => `${quote(row[dateCol])},${quote(row[valueCol])}`).join('\n'),
    frequency,
  );
}
