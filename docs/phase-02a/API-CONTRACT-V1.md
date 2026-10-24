# Phase 02A — forecasting contract v1

Local asynchronous statistical baseline only. The public Phase 01 examples remain synthetic and separate. No Timestral, calibrated intervals or production availability is claimed.

## Dataset ingestion

`POST /api/workspaces/:workspaceId/datasets` requires a valid session and matching Origin. Body: `name`, `csv` with `date,value`, optional `frequency` (`daily` default, `weekly`, `monthly`). Accept 8–5,000 observations, CSV below 1 MB, finite values within +/- 1e12. Dates are sorted, then duplicates/gaps rejected. Weekly dates are seven days apart; monthly dates are consistently month starts or month ends. No interpolation or duplicate removal. Python independently validates stored observations.

## Enqueue

`POST /api/forecast-jobs`

```json
{"contractVersion":"1","workspaceId":"UUID","datasetId":"UUID","horizon":14}
```

Horizon: integer 1–90 observation steps. Extra fields are rejected: clients cannot supply points, frequency, model parameters or execution state. The API snapshots the saved dataset through an authenticated `asUser` transaction and RLS. A missing/foreign dataset returns 404. Session/Origin and body-size limits are enforced. Embedded-only mode returns 503: asynchronous execution requires `DATABASE_URL`.

202 response: `{"contractVersion":"1","status":"accepted","jobId":"UUID"}` with `Location: /api/forecast-jobs/UUID`. No fabricated completion-time estimate. A limit of 20 active jobs per workspace is a local preview guard, not comprehensive production abuse protection.

## Authorized retrieval

`GET /api/forecast-jobs/:id` returns `contractVersion`, `id`, `status`, `attempts`, `result_id`, generic `error`, timestamps and `result` (null before success). The job and joined forecast are filtered by the authenticated identity under RLS. Unknown and unauthorized IDs both return 404; invalid/revoked sessions return 401. Responses use `Cache-Control: no-store`. There is no collection GET masquerading as a dynamic ID route.

States: pending → processing → completed. Transient failures return to delayed pending until a maximum of three claims; invalid inputs/contracts and exhausted attempts become failed. Raw internal exception messages are not returned to clients.

## Persisted result

- `contract_version: "1"`, `model: "seasonal-naive-v1"`, `mock: false`, `validated: false`.
- Exact `points: [{date,value}]`, `frequency`, StatsForecast version and season-length metadata.
- `quantiles: null`: point forecasts are not presented as P50 or calibrated probabilities.
- `metrics: {mae,rmse}` from expanding-window rolling-origin evaluation, or null with a warning when fewer than two valid holdout windows fit. `evaluation` records windows, evaluated points and cutoffs. At most three disjoint windows are evaluated; every training set ends before its holdout.
- Daily season length 7. Weekly/monthly season length 1 is explicitly disclosed as last-value persistence, not annual seasonality.
- Backtesting measures supplied historical data. It does not validate future business performance. No placeholder zero errors, probability bounds or coverage claims.

The synchronous Phase 01 endpoint remains a daily-only weekly-repeat mock. Weekly/monthly datasets must use the asynchronous API. The public demo never invokes this worker.
