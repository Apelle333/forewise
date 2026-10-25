'use client';
import type { Frequency } from '@/lib/csv';
import type { ColumnMapping } from '@/lib/dataset-import';
export function DatasetPreview({
  headers,
  data,
  mapping,
  onMappingChange,
  frequency,
  onFrequencyChange,
}: {
  headers: string[];
  data: string[][];
  mapping: ColumnMapping;
  onMappingChange: (m: ColumnMapping) => void;
  frequency: Frequency;
  onFrequencyChange: (f: Frequency) => void;
}) {
  return (
    <div className="onboarding-preview">
      <div className="preview-controls">
        <label>
          Date column
          <select
            value={mapping.dateCol}
            onChange={(e) => onMappingChange({ ...mapping, dateCol: Number(e.target.value) })}
          >
            {headers.map((h, i) => (
              <option key={h} value={i}>
                {h}
              </option>
            ))}
          </select>
        </label>
        <label>
          Value column
          <select
            value={mapping.valueCol}
            onChange={(e) => onMappingChange({ ...mapping, valueCol: Number(e.target.value) })}
          >
            {headers.map((h, i) => (
              <option key={h} value={i}>
                {h}
              </option>
            ))}
          </select>
        </label>
        <label>
          Observation frequency
          <select
            value={frequency}
            onChange={(e) => onFrequencyChange(e.target.value as Frequency)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
      </div>
      <div className="data-table-scroll" tabIndex={0} role="region" aria-label="Import preview">
        <table>
          <caption>
            First {data.length} observations. Selected columns will be validated before saving.
          </caption>
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell || '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
