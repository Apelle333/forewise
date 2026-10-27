import type { Point } from './csv';

export type Dataset = {
  id: string;
  name: string;
  row_count: number;
  points: Point[];
  frequency?: string;
};
export type Forecast = {
  id: string;
  dataset_id: string;
  horizon: number;
  created_at?: string;
  result: {
    mock: boolean;
    model: string;
    points: Point[];
    notice: string;
    quantiles?: { p10: Point[]; p50: Point[]; p90: Point[] } | null;
    metrics?: {
      mae: number;
      rmse: number;
      wape?: number | null;
      coverage_p10_p90?: number;
      interval_score_p10_p90?: number;
    } | null;
    evaluation?: {
      windows: number;
      evaluated_points: number;
      baseline_metrics?: { mae: number; rmse: number } | null;
      baseline_season_length?: number;
      [key: string]: unknown;
    };
    performance?: { device: string; inference_seconds: number; [key: string]: unknown };
    warnings?: string[];
    [key: string]: unknown;
  };
};

/** Only actual saved runs with identical inputs/dates are eligible for an overlay. */
export function comparableBaseline(forecast: Forecast | undefined, runs: Forecast[]) {
  if (!forecast || forecast.result.mock || forecast.result.model !== 'timestral_209m')
    return undefined;
  return runs.find(
    (run) =>
      !run.result.mock &&
      ['seasonal_naive', 'seasonal-naive-v1'].includes(run.result.model) &&
      run.dataset_id === forecast.dataset_id &&
      run.horizon === forecast.horizon &&
      run.result.points.length === forecast.result.points.length &&
      run.result.points.every((p, i) => p.date === forecast.result.points[i].date),
  );
}
