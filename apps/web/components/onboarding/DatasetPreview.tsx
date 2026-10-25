'use client';
import { useState, useMemo } from 'react';
import type { Point, Frequency } from '@/lib/csv';

type Mapping = {
  dateCol: string;
  valueCol: string;
};

export function DatasetPreview({
  data,
  headers,
  mapping,
  onMappingChange,
  frequency,
  onFrequencyChange,
}: {
  data: any[][];
  headers: string[];
  mapping: Mapping;
  onMappingChange: (mapping: Mapping) => void;
  frequency: Frequency;
  onFrequencyChange: (frequency: Frequency) => void;
}) {
  const previewRows = useMemo(() => data.slice(0, 10), [data]);

  return (
    <div className="onboarding-preview">
      <div className="preview-controls">
        <div className="control">
          <label>Date Column</label>
          <select
            value={mapping.dateCol}
            onChange={(e) => onMappingChange({ ...mapping, dateCol: e.target.value })}
          >
            {headers.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>
        <div className="control">
          <label>Value Column</label>
          <select
            value={mapping.valueCol}
            onChange={(e) => onMappingChange({ ...mapping, valueCol: e.target.value })}
          >
            {headers.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>
        <div className="control">
          <label>Frequency</label>
          <select
            value={frequency}
            onChange={(e) => onFrequencyChange(e.target.value as Frequency)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </div>
      <div className="preview-table-container">
        <table className="preview-table">
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} className={h === mapping.dateCol || h === mapping.valueCol ? 'highlighted' : ''}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className={headers[j] === mapping.dateCol || headers[j] === mapping.valueCol ? 'highlighted' : ''}>
                    {String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
