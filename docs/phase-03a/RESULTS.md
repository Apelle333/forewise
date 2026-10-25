# Phase 03A — measured result and decision

## Decision: do not enable blanket calibration

The fixed candidate raises held-out empirical coverage, but does not consistently improve interval usefulness. It stays research-only; native product quantiles/API/defaults remain unchanged. This milestone prepares an independent-review gate, not commercial approval.

Real pinned Timestral-209M: 25 predeclared series/horizon cases, 21 evaluated, 4 explicitly insufficient. Thirty calibration and thirty test origins per evaluated case: 1260 genuine inference calls; 104.0 seconds for this local matrix. Observed device: cuda, float32. Fixture, source and raw-fold digests are in `evidence/provenance.json`.

Nominal 80% empirical coverage was reached in **11/21 native cases and 17/21 adjusted cases**. Mean central interval score improved in **5**, worsened in **12**, and stayed unchanged in **4**. These are descriptive case counts, not a hypothesis test or a generalization claim. Four adjusted cases still miss nominal coverage: daily bikes at one step, monthly sunspots at one/six steps, synthetic revenue at six steps.

| Series | Horizon | Native coverage | Adjusted coverage | Width ratio | Interval score change |
|---|---:|---:|---:|---:|---:|
| bike_daily | 1 | 70.0% | 70.0% | 1.000× | +0.00% |
| bike_daily | 7 | 79.0% | 82.9% | 1.193× | +4.99% |
| bike_daily | 14 | insufficient | need 904 observations | — | — |
| bike_daily | 28 | insufficient | need 1744 observations | — | — |
| sunspots_monthly | 1 | 76.7% | 76.7% | 1.059× | -0.52% |
| sunspots_monthly | 6 | 71.1% | 77.8% | 1.058× | -0.78% |
| sunspots_monthly | 12 | 77.2% | 81.7% | 1.088× | +0.57% |
| initial_claims_weekly | 1 | 83.3% | 83.3% | 1.000× | +0.00% |
| initial_claims_weekly | 4 | 80.8% | 84.2% | 1.086× | +2.34% |
| initial_claims_weekly | 12 | 84.4% | 85.0% | 1.029× | +1.97% |
| air_passengers | 1 | 80.0% | 80.0% | 1.000× | +0.00% |
| air_passengers | 6 | insufficient | need 424 observations | — | — |
| air_passengers | 12 | insufficient | need 784 observations | — | — |
| synthetic_demand | 1 | 70.0% | 86.7% | 1.358× | +1.50% |
| synthetic_demand | 7 | 80.5% | 81.9% | 1.070× | +0.33% |
| synthetic_demand | 28 | 79.2% | 82.0% | 1.060× | +0.26% |
| synthetic_intermittent | 1 | 86.7% | 86.7% | 1.000× | +0.00% |
| synthetic_intermittent | 7 | 90.5% | 92.4% | 1.076× | +3.13% |
| synthetic_intermittent | 28 | 88.6% | 91.0% | 1.056× | +0.72% |
| synthetic_regime_shift | 1 | 70.0% | 80.0% | 1.165× | -1.19% |
| synthetic_regime_shift | 7 | 81.0% | 86.7% | 1.135× | +2.22% |
| synthetic_regime_shift | 28 | 78.2% | 80.7% | 1.060× | -0.05% |
| synthetic_revenue | 1 | 83.3% | 93.3% | 1.181× | +7.00% |
| synthetic_revenue | 6 | 77.8% | 77.8% | 1.048× | -0.00% |
| synthetic_revenue | 12 | 80.0% | 81.9% | 1.049× | +1.13% |

Lower interval score is better; a positive change is worse. Width is mean interval width. See JSON for median widths/scores, misses by tail, native pinball loss, per-lead coverage, sample counts and exploratory bootstrap ranges. Different-unit series are not pooled into a misleading average MAE or width.

## AirPassengers: the old problem is not declared solved

At horizon 12 the Phase 03A protocol requires 784 observations, versus 144 available. The earlier 58.3% Phase 02B result used only three windows; that cannot be turned into convincing calibration evidence by reusing those targets. At horizon 1, 30 separate test origins are available and native coverage is 80%; that does not validate horizon 12. The report retains both facts.

## Point-model recommendation

The calibration-only MAE rule selected Timestral in all 21 evaluated cases. On the untouched test period, a statistical comparator has lower MAE in 0 cases; the chosen model is not switched in hindsight. These public/synthetic cases do not establish universal Timestral superiority or justify always routing to AI. Exact comparator periods and MAE/RMSE/WAPE/median absolute errors remain in the JSON.


## Review gates and next experiment

Independent review must verify chronological separation, sample adequacy, score arithmetic, revised/public data limitations and the decision not to expose adjusted endpoints as marginal quantiles. Claude Code CLI is installed locally but was not authenticated when checked; no independent Claude PASS is claimed for this milestone.

Do not tune the candidate against this exposed test matrix and then call the same outcomes an untouched validation set. If evaluating contraction, adaptive updates, alternative scales or model-selection thresholds next, predeclare that experiment and reserve new temporal/series holdouts (preferably prospective customer-domain data with permission). Overcoverage on intermittent demand and undercoverage after distribution change both need attention.

Thirty origins per lead is pilot evidence, not a promise of adequate precision. Bootstrap ranges preserve short origin blocks but do not establish exchangeability, stationarity, pretraining independence or production coverage. The ICSA snapshot is revised, not a historical vintage.

Validation and CI outcome are recorded separately after execution. No frontend/worker/authorization/model-contract changes are included. Phase 03B starts only after this milestone independent review.
