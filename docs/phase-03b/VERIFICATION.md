# Phase 03B verification and reviewer handoff

This is the frozen 25 October verification record. The subsequent 26 October corrections and current review status are documented in [FOLLOW-UP-REVIEW.md](FOLLOW-UP-REVIEW.md); the evidence files and counts below remain attached to their original tested commit.

Tested application commit: **`074a305605f1e25e07cb1996dba0518a282cec90`**, branch `phase-03b-premium-experience`. Claude's untouched starting work is preserved in `51cd03e`. Evidence is from the compiled local application on 25 October 2026. Later evidence-only commits do not change the tested application.

## Executed checks

| Check                                                     | Actual result                                                                                                                                  |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete `npm run verify`                                 | All 13 recorded checks pass, plus tracked-file credential guard                                                                                |
| Node / embedded PostgreSQL / real PostgreSQL tests        | 40 passed, 0 failed, 0 skipped                                                                                                                 |
| Python forecasting / worker / quality tests               | 55 passed, 0 failed, 0 skipped                                                                                                                 |
| Complete Chromium browser suite, without snapshot updates | 40 passed, 0 failed, 0 skipped (1.9 minutes)                                                                                                   |
| Hallmark gate positive and negative tests                 | 20 passed                                                                                                                                      |
| Hallmark pinned-cache integrity tests                     | 12 passed                                                                                                                                      |
| Lint, formatting, typecheck, production build             | Pass                                                                                                                                           |
| npm dependency audit                                      | No known vulnerabilities; ExcelJS 4.4.0 uses scoped UUID 11.1.1 override                                                                       |
| Python dependency audit                                   | No known vulnerabilities in audited packages; the pinned Timestral source package is not on PyPI and cannot be covered by this advisory lookup |

**167 passing test cases across the five suites**. The original handoff discrepancy was independently reproduced: 28 total, 27 passed, one PostgreSQL test skipped without its environment configuration. With real PostgreSQL configured the original suite passed 28/28; it is not counted again in the expanded total.

The full source and browser runs were repeated against the committed code. Real-model integration was enabled, using local PostgreSQL and the pinned Timestral model. AirPassengers produced genuine persisted P10/P50/P90, three historical backtest windows and 36 evaluated points; its observed P10–P90 coverage remains **58.3%**. A separate actual SeasonalNaive forecast was saved, date/input matched and overlaid. The XLSX response's P10/P50/P90 cells were compared directly with persisted quantiles. The exact native result and export are in `evidence/native-air-passengers.json` and `.xlsx`.

## Security and regression evidence

- The production import module rejects formula-bearing workbooks, duplicates/gaps/invalid values, oversized/overexpanded ZIPs, named-range amplification, sparse coordinates/worksheet IDs, XML coordinate entities and Unicode-path ZIP overrides. Real Excel date cells were checked under both date systems.
- Browser/API requests verify unauthenticated, revoked, foreign-tenant and mismatched-workspace export rejection; authorized CSV/XLSX retrieval; server formula rejection in both preview/import modes; preview without persistence; and failed validation retaining the dialog.
- Concurrent retry requests yield one 202 and one 409; attempts remain unchanged until worker claim, fence increments and lease ownership is cleared. Foreign tenants and missing Origin are rejected; attempts=3 and the shared active-job quota block retry. Generic job UPDATE remains forbidden to the application role.
- Mixed canonical/mapped uploads using differently cased UUIDs share the same 20-dataset quota. An older result outside the latest twenty summaries opens correctly from Jobs.
- Existing worker-fencing, lease/retry, tenant RLS, authorized retrieval, CSV, baseline and real-model tests pass. Public Three.js lifecycle, unavailable/lost WebGL fallback, reduced motion, keyboard/table alternatives and absence of the renderer in the operational workspace remain covered.
- A focused read-only agent reviewed parser/export/retry changes and identified the named-range, worksheet-ID, path-override, quota and fullwidth CSV issues corrected here. This is a source review, not an independent Claude PASS. Windows Chromium/axe checks do not replace cross-browser or assistive-technology testing.

## Hallmark: actual execution, not a raw-clean claim

`evidence/hallmark-render-results.json` records purpose `required-render-audit`, the tested commit, `success: true`, and the actual Chrome executable/version. Each required URL reports **`render: ran`** and five fresh PNGs with dimensions and SHA-256:

| Required target | Render result | Screenshots |
| --------------- | ------------- | ----------- |
| `/`             | ran           | 5           |
| `/explorations` | ran           | 5           |
| `/register`     | ran           | 5           |
| `/login`        | ran           | 5           |

The browser preflight reports Chrome 156.0.8078.4 and platform-default sandbox with no bypass flags. Raw reports, process output and all **20** screenshots are preserved in the accompanying evidence archive under `.data/hallmark/render-MOIvvZ/`. The expected failed-Chromium negative-test manifest is separate from this successful required-render audit.

The static regression baseline contains **44** explicitly reviewed findings (38 Floor, six Reflex), with removed findings pruned and all extracted components included. Raw rendered reports contain **79** findings (66 Floor, 13 Reflex), including duplicated source observations across routes. These are not hidden or described as a raw Hallmark PASS. URL-specific retained observations concern the existing tall cinematic hero at 1920px, 55px public controls, heading spacing and the exploration return link wrapping at 320px. None changes the scope of the locked public design; raw evidence remains reviewable. Critical render execution, focus, motion and overflow gates pass. Protected workspace rendering is verified through authenticated Playwright/axe at 1440/768/390px, not a Hallmark login redirect.

## Visual evidence

`evidence/before-{desktop,mobile}.png` captures the still-running pre-handoff build. Claude's incomplete source did not compile, so no screenshot is presented as its rendered output. `onboarding-{1440,768,390}.png` and `results-{1440,768,390}.png` show the reconciled build. Mobile detail screenshots show native quantiles and the calibration report at actual viewport scale. `detail-observations.json` records zero page exceptions, zero tested axe violations, no document overflow and the P10/P50/P90 keyboard readout.

Three developer observation/change/retest passes are documented in `docs/design/VISUAL-QA.md`. Only the three intended workspace screenshot baselines were refreshed after visual inspection; the final complete browser run compares them without update mode. Test-generated historical Phase 01/02B evidence was preserved privately and restored, rather than silently rewriting prior milestone reports.

## Remaining limits and review gate

- Native intervals are still not empirically calibrated for general use; the Phase 03A candidate remains unshipped. Do not approve forecast quality on coverage alone.
- One worksheet/series, strict dates, no formulas or automatic gap repair; see IMPLEMENTATION.md for exact budgets and retained history limits. CSV first-open escaping is not a promise of safety after arbitrary spreadsheet re-saving.
- Real device/Safari/Firefox and screen-reader sessions, production load/cost/scalability and commercial readiness remain unverified. Local inference timing is not end-to-end latency.
- The application commit was pushed successfully. The GitHub connector returns 404 for this private repository, including draft PR creation; no new PR or remote Actions run is claimed. `PR-DRAFT.md` is prepared for review against `codex/hallmark-design-polish`. All executed results above are local evidence.
- Independent Claude approval remains pending. No merge, production deployment, paid activation, calibration rollout or Phase 04 was performed.

Reviewer entry points: RECONCILIATION.md, IMPLEMENTATION.md, this report, `evidence/manifest.json`, new import/export/retry routes, `dataset-import.ts`, `forecast-export.ts`, `forecast-result.ts`, the PostgreSQL retry function and `e2e/phase03b.spec.ts`. Logs remain ignored/outside Git and are supplied in the evidence archive.
