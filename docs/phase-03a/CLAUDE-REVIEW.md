# Independent review request — Claude Code

Review milestone 03A on `codex/phase03a-forecast-quality`, based on approved Phase 02B commit `d4609133edca523b6963de9576757bd57b31f5a5`. Read only; do not edit code, install software, deploy, merge, change settings or access credentials/customer data. Do not scan unrelated files or the whole repository.

Inspect these exact files and the scoped diff:

- `services/forecast/calibration.py`
- `services/forecast/test_calibration.py`
- `scripts/benchmark-quality.py`
- `scripts/prepare-quality-fixtures.py`
- `docs/phase-03a/PROTOCOL.md`, `RESULTS.md`
- `docs/phase-03a/fixtures/manifest.json`
- `docs/phase-03a/evidence/benchmark.json`, `provenance.json`, and validation evidence when available
- `.github/workflows/phase02b.yml`, `AGENTS.md`, `README.md`

The raw public-fixture calibration/test forecasts and targets are in the milestone handoff archive, with a SHA-256 matching `evidence/provenance.json`. They are genuine Timestral results. Test spies/analytic arrays are labelled as unit fixtures and are not benchmark predictions.

Check:

1. Calibration/test target disjointness, order of freezing factors/point-model selection and absence of test-based tuning or model switching.
2. Finite-sample order-statistic rank, forecast-only normalization, per-lead factors, zero-width/signed/constant series, finite output validation and unchanged median.
3. Correct distinction between adjusted central interval endpoints and native P10/P90 marginal quantiles; no borrowed exchangeability/EnbPI guarantee.
4. Whether 30 origins per lead and exploratory origin-block bootstrap are described with adequate caution; insufficient AirPassengers horizon-12 history must remain explicit.
5. Coverage/width/interval-score arithmetic. In particular, 17/21 cases reach nominal coverage after adjustment, but interval score worsens in 12: do not approve blanket production calibration on coverage alone.
6. Frozen calibration-period MAE selection and fair comparator periods 7 / 1 / 52 / 12; public/pretraining and revised ICSA limitations.
7. Pinned source bytes/fixture hashes, source credits, explicit synthetic labelling, CI smoke versus full-matrix distinction and reproducibility of the raw-fold digest.
8. Regression/scope safety: production API, worker fencing/retries, tenant isolation, native quantile semantics, dashboard and Three.js behavior must remain unchanged. No new paid service, dependency, model download or commercial release.

Return **PASS / FAIL / NEEDS EVIDENCE**, with severity-ranked findings, exact file/line references and concrete acceptance conditions. Separate verified evidence from code inference and tests you did not run. A PASS on the research harness is not approval to enable its candidate in production or launch commercially.

Status at handoff preparation: Claude Code 2.1.310 was found, but `claude auth status` reported no authenticated account. No independent audit was executed or invented by Codex. Authentication and a genuine Claude response are required before this review gate can pass.
