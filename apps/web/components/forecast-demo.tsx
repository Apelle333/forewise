'use client';
import { useState } from 'react';
import { Chart } from './chart';
const values = [
  104, 112, 108, 116, 127, 119, 110, 117, 125, 121, 130, 143, 133, 126, 132, 140, 136, 148, 159,
  151, 144, 150, 158, 153, 166, 178, 169, 161,
];
const examples = {
  Demand: { factor: 1, unit: 'units' },
  Revenue: { factor: 24, unit: 'USD' },
  Capacity: { factor: 0.4, unit: 'hours' },
};
export function ForecastDemo() {
  const [metric, setMetric] = useState<keyof typeof examples>('Demand'),
    [days, setDays] = useState(14);
  const history = values.map((value, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, '0')}`,
    value: Math.round(value * examples[metric].factor),
  }));
  const future = Array.from({ length: days }, (_, i) => ({
    date: new Date(Date.UTC(2026, 8, 29 + i)).toISOString().slice(0, 10),
    value: history[history.length - 7 + (i % 7)].value,
  }));
  return (
    <div className="forecast-demo" id="demo">
      <div className="demo-toolbar">
        <div className="demo-tabs" role="group" aria-label="Sample series">
          {Object.keys(examples).map((name) => (
            <button
              key={name}
              aria-pressed={metric === name}
              onClick={() => setMetric(name as keyof typeof examples)}
            >
              {name}
            </button>
          ))}
        </div>
        <span className="demo-badge">Synthetic data / {examples[metric].unit}</span>
      </div>
      <div className="demo-bottom">
        <div>
          <span className="overline">MOVE THE HORIZON</span>
          <p>
            Compare the next 7–28 days.
            <br />
            Synthetic examples. Exact values.
          </p>
        </div>
        <label className="horizon-control">
          <span>
            Preview horizon{' '}
            <strong>
              {days}
              <small> days</small>
            </strong>
          </span>
          <input
            aria-label="Preview horizon"
            type="range"
            min={7}
            max={28}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          />
          <span className="range-labels">
            <span>7 days</span>
            <span>28 days</span>
          </span>
        </label>
      </div>
      <Chart
        history={history}
        future={future}
        label={`Sample ${metric.toLowerCase()} · ${examples[metric].unit}`}
        unit={examples[metric].unit}
      />
      <p className="demo-disclaimer">
        This interactive example repeats the last observed week. It is a mock forecast, with no
        validated accuracy or confidence interval.
      </p>
    </div>
  );
}
