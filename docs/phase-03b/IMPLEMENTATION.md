# Phase 03B: reconciled product experience

Status: implemented for local verification and independent review. Not commercial acceptance, a Claude PASS, production deployment or Phase 04 authorization.

## Preserved foundation

Claude's original 29-file handoff is committed separately at `51cd03e` and backed up before modification; see RECONCILIATION.md. The existing Datasets, Jobs, Results and onboarding component boundaries remain. Forecast Horizon, Fieldnotes tokens, self-hosted typography, Three.js lifecycle/fallbacks, Timestral weights/inference, backtesting, worker leases/fencing and the three-attempt execution cap are preserved.

## Stages 1–2 reconciliation

- Restore generation controls, model/horizon selection, saved datasets, synthetic sample, workspace feedback and abortable job polling.
- Parse CSV/XLSX on the authenticated server for both preview and import. Map two distinct columns to canonical date/value; preview saves nothing. Validate every observation again before persistence. Excel date cells respect the workbook epoch; strings require ISO dates. Formula cells, duplicate dates, gaps and invalid numbers are rejected rather than repaired silently. Valid observations are sorted chronologically by the existing ingestion contract.
- Bound actual multipart bytes (1,020,000), uploaded file bytes (1,000,000), rows (5,000 observations), columns (32), ZIP entries (256), actual expanded bytes (8 MB/entry, 16 MB total), XML elements, strings, styles and worksheet coordinates before ExcelJS allocation. Reject named ranges, macros, external links, path overrides, ZIP64/encrypted/multidisk archives and multiple worksheets. Keep ExcelJS and XML parsing out of the client bundle.
- Keep the modal title, Cancel and Import actions visible while its preview scrolls. Native dialog provides focus containment and Escape; focus returns to the opener. Failed imports remain open with actionable errors.
- Return a bounded job list with dataset/result references. Poll sequentially with cancellation; show actual status, error and attempt count. View result retrieves the exact authorized job result, including runs outside the latest twenty forecast summaries.
- Replace the unsafe draft retry with an Origin-checked endpoint and narrowly granted PostgreSQL function. Membership, failed state, fewer than three attempts and the active-job cap are checked. Requeue atomically invalidates the old fence/lease; only the worker increments attempts on claim. Generic app-role job UPDATE remains forbidden. Canonical UUID advisory locks serialize the shared quotas across ingestion paths and job creation/retry.

## Stage 3: genuine results

- Render persisted Timestral P10/P50/P90, exact keyboard/pointer inspection and a quantile data table. Use a recent-history chart view to make the horizon readable; all observations remain selectable and are always exported.
- An overlay requires a separately saved non-mock SeasonalNaive run with identical dataset ID, horizon and dates. No synthesized comparator or fallback to Timestral's own values. Display genuine baseline MAE/RMSE from the same historical backtest separately.
- Report rolling-origin window and evaluated-point counts, observed coverage, nominal 80% target, native uncalibrated intervals and the low-coverage warning. Model metadata and all run warnings remain inspectable. No Phase 03A calibration candidate is enabled; better coverage alone is not a quality guarantee.

## Stage 4: authorized export

`GET /api/workspaces/:wid/forecasts/:fid/export?format=csv|xlsx` checks the live session and queries the saved forecast/dataset under tenant RLS and workspace identity. Foreign, mismatched and missing results return 404; anonymous/revoked sessions return 401. Downloads use private/no-store responses and fixed UUID filenames.

CSV contains history, forecast values, available P10/P50/P90 and metadata records. XLSX contains Observations, Forecast and Metadata sheets with primitive typed values. Include run/dataset/workspace identity, timestamps, horizon/frequency, model/weight/code revisions, evaluation, performance and warning metadata supplied by the engine. Formula-leading text (including fullwidth operators) is escaped in CSV; validated negative numbers remain numeric. XLSX text is never assigned as formulas. CSV first-open escaping is not a universal guarantee after subsequent spreadsheet saves.

## Stage 5 verification and review

The tests exercise production parser/export modules rather than copied UI checks. Browser tests cover mapped CSV and genuine XLSX ingestion, failed validation, focus/Escape, desktop/tablet/mobile overflow/accessibility, concurrent quota requests, retry authorization/races/cap, exact older-result retrieval, genuine model inference, comparison and quantile export. Existing PostgreSQL RLS, worker-fencing and model tests remain required.

Hallmark now includes all extracted workspace/onboarding source files. Only exact mathematical range notation receives new documented house-style exceptions. Removed findings are pruned; no contrast, focus, security, overflow or motion rule is weakened. Public/auth rendered audits and authenticated workspace browser checks are distinct. The GitHub artifact configuration includes Phase 03B browser evidence and failure traces.

## Deliberate limits

- One series, one worksheet; CSV/XLSX only. No legacy XLS, named ranges, formulas, merged-data interpretation, arbitrary date guessing, imputation or automatic gap repair.
- Twenty datasets and twenty active jobs per workspace. Job view shows the latest 100 jobs; workspace summary holds the latest twenty forecasts, with exact older results obtainable from the displayed jobs.
- Calibration remains unestablished; the observed AirPassengers P10–P90 coverage limitation is not fixed by presentation. Native model performance depends on hardware, history and horizon. Inference timing excludes queue/upload time.
- Local synthetic/public fixture verification does not establish production scalability or commercial reliability. Independent Claude review is still required before milestone acceptance.
