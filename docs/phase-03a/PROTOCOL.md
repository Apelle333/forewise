# Phase 03A — forecast quality evidence

Protocol v1, fixed before the first matrix execution on 25 October 2026. This is a research milestone; no production calibration/default model change, release, payment integration or branch merge.

## Authorization and milestone boundaries

The owner approved Phase 02B at `d460913` for continued development on 25 October 2026, reporting a second independent Claude Code PASS. That report is owner-provided audit context, not a new audit performed by Codex. Commercial release remains unapproved.

Phase 03 milestones:

1. **03A / quality evidence**: larger past-only evaluation, empirical interval calibration, statistical model comparison and auditable decision rules. Stop for independent Claude review.
2. **03B / usable data-to-decision flow**: CSV/Excel onboarding, explicit treatment of imperfect data, understandable results/exports/error recovery. Scope and acceptance refine from the 03A evidence; no silent interpolation or new dependency by default.
3. **03C / private beta readiness**: security/load limits, measured per-job resource/cost accounting, monitoring and private beta checklist. No public launch or paid infrastructure activation by implication.

## Corpus and reproducibility

Four public series: UCI daily bicycle rental counts, weekly initial unemployment claims (ICSA, 2010–2025 snapshot), monthly R AirPassengers and monthly R sunspots (1749–1983). These cover several domains but do not represent all business forecasting tasks. Four separate deterministic synthetic stress fixtures: demand, intermittent demand, a regime shift and monthly revenue. Synthetic values are never passed off as customer data. See `fixtures/manifest.json` for exact counts, units, source attribution, SHA-256 and the complete horizon matrix.

`scripts/prepare-quality-fixtures.py` pins raw source bytes and fails on source revision drift. `--download` explicitly permits public retrieval; otherwise it uses the ignored local source cache. Prepared CSVs are committed and hash-checked on every benchmark/test. No additional model weights, runtime libraries or customer data are introduced.

UCI attribution: Fanaee-T, H. (2013), *Bike Sharing*, UCI Machine Learning Repository, [DOI 10.24432/C5W894](https://doi.org/10.24432/C5W894), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Conversion keeps `dteday` and `cnt`, renames to `date,value`, drops unused columns; no imputation or changed numerical observations.

ICSA attribution: U.S. Employment and Training Administration, retrieved from [FRED](https://fred.stlouisfed.org/series/ICSA), Federal Reserve Bank of St. Louis, 25 October 2026; public-domain series, citation requested. Date range ends 27 December 2025. This is a **revised snapshot, not an as-of historical vintage**; seasonal adjustments may use later information. It is useful for pipeline stress testing, not proof of historically achievable trading/business performance.

[R sunspots documentation](https://stat.ethz.ch/R-manual/R-devel/library/datasets/html/sunspots.html) attributes numerical data to the Swiss Federal/Tokyo observatories and Andrews/Herzberg (1985). The fixed historical `sunspots` series is used rather than the periodically revised `sunspot.month`; the Rdatasets mirror is byte-pinned. AirPassengers provenance remains in `../phase-02b/fixtures/README.md`. Public time series may overlap Timestral pretraining; independence from training is unknown.

## Temporal separation

For each predeclared series/horizon:

- At least 64 initial observations.
- 30 calibration origins, followed by 30 untouched test origins.
- Forecast targets are disjoint blocks of length equal to the horizon. No overlapping targets within/between calibration and test. Each forecast sees only observations before its origin.
- Need `64 + (30 + 30) × horizon` observations. Otherwise record **insufficient history**; do not reduce samples, reuse calibration targets for testing or conceal the missing case.
- Freeze calibration factors and model choice before the first test forecast. Later test origins may use earlier observed test history, as in an expanding operational forecast; the interval calibration and selection are not refitted on it.
- At horizon H there are 30 test outcomes **per lead**, not 30×H independent samples. Temporal dependence may remain across disjoint origins.

Thirty origins is a pilot evidence floor, not proof of commercial adequacy or sufficient precision on every lead. Report sample counts, per-lead coverage, lower/upper miss rates and an exploratory circular moving-block bootstrap range (1,000 resamples, four consecutive origins per block, fixed seed 20261025). The range is not a formal coverage guarantee or an IID binomial confidence interval. More origins, series and prospective domain holdouts remain necessary.

## Calibration candidate

Preserve official native Timestral P10/P50/P90. Research candidate is nonnegative, width-normalized, lead-specific conformalized-quantile-regression style correction:

`scale = max(P90 − P10, max(abs(P50), 1) × 1e−6)`

`score = max(P10 − observed, observed − P90, 0) / scale`

For each lead, take order statistic `ceil((n + 1) × 0.8)` of calibration scores, with no interpolation. Test bounds are `P10 − factor×scale` and `P90 + factor×scale`; median unchanged. Validate finite results, ordering, sample size and nonnegative factors. Zero-width, signed and constant series have explicit tests. No truncation of negative adjusted lower bounds. This initial candidate can widen but cannot contract native bands; overcoverage may remain.

**Adjusted endpoints are central prediction-interval bounds, not calibrated P10/P90 marginal quantiles.** The product continues to show native quantiles. Do not silently relabel the candidate as a model output or change API v2 semantics.

Method source: [Romano, Patterson & Candès, Conformalized Quantile Regression (2019)](https://arxiv.org/abs/1905.03222). Standard split-conformal finite-sample claims rely on exchangeability; time series and regime changes do not automatically satisfy it. [Xu & Xie (2021)](https://proceedings.mlr.press/v139/xu21h.html) study a different time-series-specific method under additional assumptions. This implementation is **not EnbPI** and does not borrow its guarantees.

## Coverage versus usefulness

Report native and adjusted empirical coverage overall/per lead, mean and median interval width, lower/upper miss rates and central interval score:

`IS = (upper − lower) + 2/0.2 × max(lower − actual, 0) + 2/0.2 × max(actual − upper, 0)`

Lower interval score is better. Wider bands alone cannot count as a quality improvement. No pooled MAE/width across differently scaled series. Preserve native quantile pinball losses; do not claim central-interval adjustment calibrates individual quantile tails. Test results are descriptive, with no test-based tuning, method selection or promotion rule inferred after seeing the outcomes.

## Point-model recommendation experiment

Compare Timestral median with the existing period-7 daily / period-1 weekly-monthly baseline and calendar SeasonalNaive (period 7/52/12). Select the lowest calibration-period MAE, preferring a statistical baseline on exact ties, before testing. Evaluate that frozen choice and all comparators on the same test period. No hindsight switching. Report MAE, median absolute error, RMSE and WAPE (null on zero denominator). This is an offline recommendation experiment, not automatic production routing.

## Reproduce and review

```powershell
# Optional only when raw public-source cache is absent:
.venv/Scripts/python.exe scripts/prepare-quality-fixtures.py --download
.venv/Scripts/python.exe scripts/benchmark-quality.py --device auto --output docs/phase-03a/evidence/benchmark.json --folds-output .data/phase03a-folds.json
.venv/Scripts/python.exe -m pytest services/forecast/test_calibration.py -q
```

CPU smoke test in CI uses `--only bike_daily --horizons 1`; it is clearly marked as a smoke result, not the full matrix. Full matrix evidence runs the same pinned 209M model as Phase 02B. Raw calibration/test forecasts and targets are retained in the user-facing handoff archive for audit; no fabricated benchmark predictions. Unit tests use explicitly labelled analytic fixtures/spies only to check arithmetic and control flow.

No candidate reaches production merely because this harness passes tests. Independent Claude review must examine leakage, sample adequacy, numerical correctness, coverage/width tradeoffs and unchanged tenant/worker/API behavior. A genuine independent Claude review is required before advancing within the approved Phase 03 development scope. Commercial release, production deployment and merges still require explicit owner authorization.
