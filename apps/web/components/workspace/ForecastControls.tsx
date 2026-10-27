'use client';
import type { Dataset } from '@/lib/forecast-result';
export function ForecastControls({
  datasets,
  selected,
  onSelect,
  horizon,
  onHorizon,
  model,
  onModel,
  busy,
  loading,
  onGenerate,
}: {
  datasets: Dataset[];
  selected: string;
  onSelect: (id: string) => void;
  horizon: number;
  onHorizon: (n: number) => void;
  model: string;
  onModel: (m: string) => void;
  busy: boolean;
  loading: boolean;
  onGenerate: () => void;
}) {
  const dataset = datasets.find((d) => d.id === selected);
  return (
    <section className="panel forecast-controls" aria-labelledby="run-title">
      <div className="panel-heading">
        <h2 id="run-title">Explore a forecast.</h2>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onGenerate();
        }}
      >
        <label htmlFor="forecast-dataset">
          Dataset
          <select
            id="forecast-dataset"
            value={selected}
            onChange={(e) => onSelect(e.target.value)}
            disabled={busy || loading}
          >
            <option value="" disabled>
              Choose a dataset
            </option>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="forecast-horizon">
          Forecast horizon (steps)
          <input
            id="forecast-horizon"
            type="number"
            min={1}
            max={90}
            value={horizon}
            required
            disabled={busy}
            onChange={(e) => onHorizon(Number(e.target.value))}
          />
        </label>
        <label htmlFor="forecast-model">
          Forecasting model
          <select
            id="forecast-model"
            aria-label="Forecasting model"
            value={model}
            onChange={(e) => onModel(e.target.value)}
            disabled={busy}
          >
            <option value="mock" disabled={!!dataset?.frequency && dataset.frequency !== 'daily'}>
              Mock demo (synthetic)
            </option>
            <option value="seasonal_naive">SeasonalNaive baseline</option>
            <option value="timestral_209m">Timestral 209M</option>
          </select>
        </label>
        <button className="button primary" disabled={busy || loading || !dataset}>
          {busy
            ? 'Computing…'
            : model === 'mock'
              ? 'Generate mock forecast'
              : 'Generate model forecast'}
        </button>
      </form>
      <p className="muted">
        {dataset?.frequency || 'Daily'} steps. Timestral provides native P10/P50/P90; the baseline
        is a point forecast. Historical evaluation is not a promise of future accuracy.
      </p>
    </section>
  );
}
