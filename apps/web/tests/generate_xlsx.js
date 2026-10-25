import ExcelJS from 'exceljs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createXlsx(filename, data, formulaCell = null) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');

  worksheet.columns = [
    { header: 'date', key: 'date', width: 15 },
    { header: 'value', key: 'value', width: 15 },
  ];

  data.forEach((row, index) => {
    const cell = worksheet.addRow(row);
    if (formulaCell && index === formulaCell.row) {
      cell.getCell(formulaCell.col).value = { formula: formulaCell.formula, result: 0 };
    }
  });

  const filePath = path.join(__dirname, 'fixtures/onboarding', filename);
  await workbook.xlsx.writeFile(filePath);
  console.log(`Created ${filePath}`);
}

const validData = [
  { date: '2023-01-01', value: 10.5 },
  { date: '2023-01-02', value: 11.2 },
  { date: '2023-01-03', value: 10.8 },
  { date: '2023-01-04', value: 12.1 },
  { date: '2023-01-05', value: 11.5 },
  { date: '2023-01-06', value: 13.0 },
  { date: '2023-01-07', value: 12.4 },
  { date: '2023-01-08', value: 11.9 },
  { date: '2023-01-09', value: 12.8 },
  { date: '2023-01-10', value: 13.2 },
];

const duplicateData = [
  { date: '2023-01-01', value: 10.5 },
  { date: '2023-01-02', value: 11.2 },
  { date: '2023-01-02', value: 11.5 },
  { date: '2023-01-03', value: 10.8 },
  { date: '2023-01-04', value: 12.1 },
  { date: '2023-01-05', value: 11.5 },
  { date: '2023-01-06', value: 13.0 },
  { date: '2023-01-07', value: 12.4 },
  { date: '2023-01-08', value: 11.9 },
  { date: '2023-01-09', value: 12.8 },
];

const gapData = [
  { date: '2023-01-01', value: 10.5 },
  { date: '2023-01-02', value: 11.2 },
  { date: '2023-01-04', value: 10.8 },
  { date: '2023-01-05', value: 12.1 },
  { date: '2023-01-06', value: 11.5 },
  { date: '2023-01-07', value: 13.0 },
  { date: '2023-01-08', value: 12.4 },
  { date: '2023-01-09', value: 11.9 },
  { date: '2023-01-10', value: 12.8 },
  { date: '2023-01-11', value: 13.2 },
];

const invalidData = [
  { date: '2023-01-01', value: 10.5 },
  { date: '2023-01-02', value: 'NaN' },
  { date: '2023-01-03', value: 10.8 },
  { date: '2023-01-04', value: 'Infinity' },
  { date: '2023-01-05', value: 11.5 },
  { date: '2023-01-06', value: 'abc' },
  { date: '2023-01-07', value: 12.4 },
  { date: '2023-01-08', value: 11.9 },
  { date: '2023-01-09', value: 12.8 },
  { date: '2023-01-10', value: 13.2 },
];

async function run() {
  await createXlsx('valid_daily.xlsx', validData);
  await createXlsx('duplicate_dates.xlsx', duplicateData);
  await createXlsx('date_gaps.xlsx', gapData);
  await createXlsx('invalid_values.xlsx', invalidData);
  await createXlsx('formula_injection.xlsx', validData, {
    row: 1,
    col: 2,
    formula: '=SUM(B1:B10)',
  });
}

run().catch(console.error);
