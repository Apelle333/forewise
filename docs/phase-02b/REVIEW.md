# Phase 02B acceptance evidence

Base: Phase 02A `79bd403012318414712a1cf681e3d44097eb90c6`; dedicated branch `codex/phase02b-timestral-209m`. Existing Phase 01/02A work was preserved; no branch merge or production operation.

## Review pass 1 — actual execution and data semantics

Executed the official pinned 209M weights on CPU and CUDA. Verified native quantile extraction, parameter-size range, cache reuse, finite/ordered outputs and daily/weekly/monthly timestamp alignment. Compared three leakage-free historical windows with the existing baseline; added annual baseline comparisons in benchmark reporting to avoid presenting the period-1 monthly comparator as a strong seasonal competitor.

The first real browser flow stalled because the model selector lacked an unambiguous accessible name. Added an explicit label and shortened ordinary action timeouts; inference keeps a longer bounded timeout. The rerun uploaded public AirPassengers, selected Timestral and completed real PostgreSQL → worker → persisted result retrieval. Another tenant received 404 and an unauthenticated context 401. This is genuine model execution; the failed-inference unit scenario is explicitly fault injection.

Evaluation found AirPassengers P10–P90 undercoverage (58.3% against nominal 80%). Preserved raw native output, showed the metric and added an explicit undercoverage warning. No synthetic replacement or fitted widening. Business validation remains false.

## Review pass 2 — rendered product and compatibility

Inspected the actual workspace in the in-app browser and captured the Playwright-rendered result at 1440/768/390 px. Public cinematic identity and default mock chart behavior remain intact. Updated only the operational model/frequency controls, result band/metadata and honest local-preview text.

The initial mobile result omitted years on the twelve-year time axis and called monthly inspection a day. Corrected real-result dates to month/year, exact readout to ISO dates and keyboard control to “Inspect an observation”. Rechecked chart-domain inclusion of P10/P90, exact quantile table headers, keyboard End inspection and page overflow. Native intervals are explicitly labelled prediction intervals.

Reload exposed a daily mock action for monthly data. Corrected the selected action to a compatible model and disabled the daily-only mock for other frequencies. A persisted monthly Timestral result now reloads with Timestral selected. Existing daily mock flow, error handling, exports and baseline v1 remain covered.

Windows workspace screenshot baselines were intentionally updated for the frequency/model controls and local-model copy, then inspected; the following full suite must run without snapshot updates. `workspace-before-390.png` retains the pre-change visual baseline; colored rectangles in test snapshots mask dynamic status/profile fields and are not product UI.

## Remaining limits

- Native intervals require domain-specific calibration/holdouts before coverage-dependent decisions. The public real dataset may overlap pretraining.
- Product remains univariate, regular finite data, 8–5,000 observations, horizon 1–90. No covariates, irregular/missing data, customer validation or production SLA.
- Performance is a bounded local desktop measurement, not cloud capacity. No batching, multitenant load or GPU exhaustion endurance benchmark.
- Cold model download requires outbound network; prewarm/cache-only operation is documented. Worker remains separately supervised from the web process.
- Modified MIT revenue restriction applies to weights. Git-only Timestral itself is outside PyPI advisory audit coverage; transitive published dependencies were audited.
- Production secrets/TLS, restricted logins, monitoring, backup/restore, retention and load testing remain deployment gates.
- No merge, production deployment, payment activation, other model download or Phase 03 implementation.

Final test counts, CI run and reviewed commit are recorded in `evidence/validation.json` after execution; a configured workflow alone is not passing CI evidence.
