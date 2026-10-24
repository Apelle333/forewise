# Forecast job API — additive v2

Same-origin authenticated API; v1 remains accepted unchanged. Contract version is a string. No user-supplied points, weights path, revision, device or remote model URL.

```json
POST /api/forecast-jobs
{
  "contractVersion": "2",
  "workspaceId": "<UUID>",
  "datasetId": "<UUID>",
  "horizon": 12,
  "model": "timestral_209m"
}
```

`model` is exactly `seasonal_naive` or `timestral_209m`. Horizon is an integer 1–90 observation steps. The authenticated user's membership must permit access to the dataset in the supplied workspace. Inputs are copied from the immutable validated stored dataset, never from this request. Extra fields are rejected. Origin mismatch is 403; inaccessible dataset/job is 404; absent session is 401; malformed input is 400; too many active workspace jobs is 429. No PostgreSQL configuration returns 503.

Accepted response: HTTP 202, `Location: /api/forecast-jobs/<jobId>`, `{"contractVersion":"2","status":"accepted","jobId":"<UUID>"}`. Poll that location. Retrieval is authenticated, tenant scoped and `Cache-Control: no-store`; it returns the payload's contract version, existing lifecycle status, attempts and result when complete. Revoked sessions are denied. Internal execution failures expose a generic message, without model stack traces or data.

Timestral result additions:

- `contract_version: "2"`, `model: "timestral_209m"`, `mock: false`, `validated: false`.
- `points`: P50 `{date,value}` records; `quantiles.p10/p50/p90` align with the same future timestamps and horizon.
- `metadata`: exact model ID, weight/code revisions, native quantile levels, normalization and context size.
- `metrics`: rolling-origin MAE, RMSE, WAPE ratio/null, three pinball losses and empirical interval coverage; null when insufficient history.
- `evaluation`: cutoffs, 2–3 disjoint expanding-origin windows, evaluated count, current SeasonalNaive comparator metrics/season length and elapsed seconds. Insufficient history has zero windows and explicit warnings, not zero error metrics.
- `performance`: selected device, float32, cache hit, load/inference time, sampled RSS and CUDA allocator peaks; CPU fallback reason when applicable. These describe final-horizon inference, not the entire job or historical evaluation.
- `warnings` and `notice`: native nominal 80% prediction interval, not confidence/calibration/business validation. Historical undercoverage is explicitly warned.

`seasonal_naive` v2 dispatches to the existing baseline with a v2 result envelope. Its historical result model name remains `seasonal-naive-v1`; quantiles remain null. V1 neither accepts a `model` field nor loads Timestral. Existing synchronous mock routes and public synthetic demos are preserved.
