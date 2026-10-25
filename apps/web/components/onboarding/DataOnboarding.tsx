'use client';
import { useState, useRef } from 'react';
import Papa from 'papaparse';
import * as ExcelJS from 'exceljs';
import { DatasetPreview } from './DatasetPreview';
import type { Point, Frequency } from '@/lib/csv';

type Mapping = {
  dateCol: string;
  valueCol: string;
};

export function DataOnboarding({
  onSuccess,
  onCancel,
}: {
  onSuccess: (data: { csv: string; name: string; frequency: Frequency }) => void;
  onCancel: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<any[][]>([]);
  const [mapping, setMapping] = useState<Mapping>({ dateCol: '', valueCol: '' });
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [error, setError] = useState('');
  const [validating, setValidating] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > 1_000_000) {
      setError('File must be smaller than 1 MB.');
      return;
    }

    setFile(selectedFile);
    setError('');

    try {
      if (selectedFile.name.endsWith('.csv')) {
        const text = await selectedFile.text();
        Papa.parse(text, {
          header: false,
          skipEmptyLines: true,
          complete: (results) => {
            if (results.data.length === 0) throw new Error('File is empty.');
            const rows = results.data as any[][];
            const head = rows[0].map(String);
            setHeaders(head);
            setData(rows.slice(1));
            setMapping({
              dateCol: head.find((h) => /date|time/i.test(h)) || head[0],
              valueCol: head.find((h) => /value|amount|count/i.test(h)) || head[1] || head[0],
            });
          },
        });
      } else if (selectedFile.name.endsWith('.xlsx')) {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        const worksheet = workbook.getWorksheet(1);
        if (!worksheet) throw new Error('Workbook contains no sheets.');

        const rows: any[][] = [];
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          const rowValues = [];
          row.eachCell({ includeEmpty: true }, (cell) => {
            // Explicitly reject cells containing formulas
            if (cell.formula) {
              throw new Error(`Formula detected at row ${rowNumber}, cell ${cell.address}. Formulas are not permitted.`);
            }
            rowValues.push(cell.value);
          });
          rows.push(rowValues);
        });

        if (rows.length === 0) throw new Error('File is empty.');
        const head = rows[0].map(String);
        setHeaders(head);
        setData(rows.slice(1));
        setMapping({
          dateCol: head.find((h) => /date|time/i.test(h)) || head[0],
          valueCol: head.find((h) => /value|amount|count/i.test(h)) || head[1] || head[0],
        });
      } else {
        throw new Error('Unsupported file format. Use CSV or XLSX.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to read file.');
    }
  };

  const handleConfirm = async () => {
    if (!file) return;
    setValidating(true);
    setError('');

    try {
      // Convert selected data to standard CSV for the existing API
      const points: any[][] = [
        [mapping.dateCol, mapping.valueCol],
        ...data.map((row) => {
          const dateIdx = headers.indexOf(mapping.dateCol);
          const valIdx = headers.indexOf(mapping.valueCol);
          return [row[dateIdx], row[valIdx]];
        }),
      ];
      const csvString = Papa.unparse(points);

      onSuccess({
        csv: csvString,
        name: file.name,
        frequency,
      });
    } catch (e) {
      setError('Validation failed. Please check your column mapping.');
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="onboarding-modal">
      <div className="onboarding-content">
        <header>
          <h2>Import Dataset</h2>
          <button className="text-button" onClick={onCancel}>Cancel</button>
        </header>

        {!file ? (
          <div className="upload-zone">
            <input
              type="file"
              id="file-upload"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="sr-only"
            />
            <label htmlFor="file-upload" className="upload-label">
              <span className="upload-symbol">↥</span>
              <strong>Drop your data here</strong>
              <p>CSV or XLSX · Up to 1 MB</p>
            </label>
          </div>
        ) : (
          <div className="onboarding-step">
            <DatasetPreview
              data={data}
              headers={headers}
              mapping={mapping}
              onMappingChange={setMapping}
              frequency={frequency}
              onFrequencyChange={setFrequency}
            />
            <div className="onboarding-footer">
              {error && <p className="error">{error}</p>}
              <button
                className="button primary"
                disabled={validating}
                onClick={handleConfirm}
              >
                {validating ? 'Validating...' : 'Import Dataset ↗'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
