# Phase 03B final consolidation — 27 October 2026

## Repository and review boundary

Started on clean `phase-03b-premium-experience` at `1974cef47b89cb3dc17c5ff705c092fdbb7918e9`. Claude's Stage 1–2 handoff remains preserved in `51cd03e`; subsequent Stage 3–5 work is retained. Three scoped development subagents reviewed backend security, product behavior and evidence. Their reports do not replace independent Claude acceptance.

Draft [PR #6](https://github.com/Apelle333/forewise/pull/6) targets `codex/hallmark-design-polish` (`16eccde`). GitHub confirms the unmerged dependency chain: #6 → #5 Hallmark → #4 quality research → #3 Timestral → #2 async foundation → #1 Horizon → main. The refreshed main has a documentation-only commit `73c38cb`; no merge, retarget, reset or force push was performed. Review this stack before any eventual merge; approval for development is not commercial release approval.

The fresh isolated PostgreSQL 17 local cluster applied schema versions 1 then 2 using `scripts/database.mjs`; reapplication is supported. The existing unrelated PostgreSQL cluster on port 5432 was preserved. Docker Compose PostgreSQL 16 remains unverified here. Application-role RLS, worker role, retry function and fencing are inherited together from the foundation. No migration or forecasting algorithm was changed.

## Confirmed findings and repairs

| Severity | Finding | Correction and proof |
| --- | --- | --- |
| P2 | Concurrent workspace creation could exceed the ten-workspace account bound | `lib/workspaces.ts` serializes the quota transaction by account; the API calls that operation. Under a controlled PostgreSQL read/write delay, bypassing the lock admits four creations when one slot remains; the corrected operation admits one. Embedded and real PostgreSQL tests pass. |
| P2 | Jobs and active model monitoring kept polling hidden documents; an accepted run blocked workspace navigation/signout | `JobsView.tsx` and `workspace.tsx` pause timers when hidden, resume when visible, abort on navigation and reject stale completion writes. Only accepted-job navigation is unlocked; generation stays locked. Browser regression simulates visibility deterministically and checks cancellation. This is not physical background-device evidence. |
| P2 | Daily native forecast ticks omitted the day, and history-only charts advertised a mock forecast | `chart.tsx` adds day information to model date ticks and omits an absent future legend. Mock demo formatting and design identity are preserved. |
| P2 | Homepage still said uploads/model forecasting were unavailable everywhere | `page.tsx` and `horizon-experience.tsx` distinguish the synthetic public demo from authenticated development imports/model jobs, name CSV/XLSX and supported frequencies, and describe private-beta preparation rather than a commercial launch. No hosted deployment was changed. |
| P2 | Previous evidence did not directly compare the entire native export and chart against PostgreSQL or run XLSX through Timestral | `timestral.spec.ts` independently exercises CSV and a genuine workbook with Excel date cells, observes pending/processing/completed ownership, queries saved datasets/results, compares all forecast/table/export values and metadata, and denies anonymous/foreign-tenant downloads. |
| P2 | CSV/XLSX exports silently omitted the forecast creation timestamp | The new direct PostgreSQL comparison found the missing `created_at` row. `forecast-export.ts` now normalizes a database `Date` to ISO text before flattening; a failing-before/passing-after regression covers actual Date, ISO string and null in both formats. Native quantiles are unchanged. |
| P3 | Parallel test files migrated a shared PostgreSQL fixture while other files held business transactions | Node files now execute sequentially with `--test-concurrency=1`; internal concurrent request/worker tests remain concurrent. This isolates fixtures without weakening assertions. |
| P3 | Windows output encoding could mask a failed check with UnicodeEncodeError | `verify.py` emits UTF-8 diagnostics so the original failing check remains visible. |

No P0/P1 tenant-exposure or worker-ownership defect was confirmed in this review. This is a bounded code/test assessment, not a security certification.

## Ingestion and dependency evidence

The production parser remains authoritative: 1 MB upload, 5,000 observations, 32 columns, one worksheet, bounded ZIP entries and actual expansion, strict dates/frequency, finite values, no duplicate dates or interpolation. New generated workbook tests cover leap day, UTC date-only rejection, signed/decimal/scientific values, empty/mixed cells, cached/shared formulas, hidden observations and hidden worksheets. Hidden observations are included; an extra hidden sheet still violates the one-sheet policy. Unsupported early 1900 dates require ISO text. OLE magic rejection was checked; a genuine password-encrypted workbook fixture was not available and is not claimed.

ExcelJS is exactly 4.4.0, MIT licensed. The resolved tree includes JSZip 3.10.2, unzipper 0.10.14 and the existing scoped UUID 11.1.1 override. No dependency was installed or changed. npm and pinned Python advisory checks are required below; the source-installed Timestral package is not covered by PyPI advisory lookup. Formula text is never evaluated; XLSX exports use primitive typed cells and CSV retains formula-leading text protection.

## Executed verification

The final local source gate passes all 13 recorded checks. The complete local Chromium suite passes **44/44**, with zero failures/skips and no snapshot-update mode. Together the five suites contain **185 passing cases**: 54 Node/PostgreSQL, 55 Python, 44 browser, 20 Hallmark gate and 12 installer tests. The initial five gated Python skips were rerun with genuine model execution enabled; they are not counted as passes from the skipped invocation. Exact-head remote CI evidence is recorded after execution in the delivery manifest and PR description. Historical reports remain attached to their original commits.

Both native import paths compare 144 persisted observations, twelve chart/forecast rows, 36 native quantile values and 57 metadata fields. Twelve actual CSV/XLSX button downloads across the two input formats and three viewport widths match persisted values. The final pre-commit local manifest truthfully records a dirty working tree; exact committed provenance comes from the subsequent clean remote checkout.

Hallmark's four required public/auth URLs each report `render: ran` and produce five fresh PNGs. The 178-file pinned installation and 20 gate/12 integrity fault tests pass, including skipped rendering, Chromium startup, incomplete coverage and `10a` failures. The static baseline retains 44 reviewed findings with zero regressions; raw rendered reports still contain 79 findings (66 Floor, 13 Reflex, including workspace source observations). These are disclosed house-style conflicts/findings, not a raw-clean claim. The protected workspace is checked separately through authenticated Playwright/axe at all three sizes. No bypass flag or accessibility-rule relaxation was introduced.

Commands (local private database URLs loaded from ignored configuration, never committed):

```text
node --import tsx scripts/database.mjs
npm run verify
npx playwright test
npm run design:render
```

Set `DATABASE_URL`, `TEST_DATABASE_URL`, `RUN_TIMESTRAL_INTEGRATION=1` and `FOREWISE_MODEL_DEVICE=cpu` for the full gate. `npm run verify` records all 13 child commands, exit codes and logs, including Node, Python, Hallmark fault/installer tests, lint, formatting, typecheck, build and dependency audits. The Node test runner serializes migration-bearing files; concurrency inside tests is preserved.

The real E2E tests start their own worker only after asserting a pending job with zero attempts/fence. They observe processing with a live lease, then completed persistence at attempt/fence one. CSV and XLSX each create a native Timestral result and a separately saved SeasonalNaive comparator. The full history and native result are queried directly from PostgreSQL. All twelve forecast rows, their P10/P50/P90 values and exported metadata are compared without rounding. The complete-history chart control is selected before full table comparisons, then restored for recent-history screenshots. Desktop/tablet/mobile downloads are tested through the actual buttons. Tenant denial covers the native jobs, workspace and both export formats.

Initial expanded browser failures were test assumptions: the chart deliberately defaults to recent history and its enclosing HTML label includes option text. Tests now explicitly choose the complete-history control by its accessible combobox name. Expected product behavior was preserved. The history-legend regression also failed against the previous compiled build before correction; the quota lock has an explicit negative control.

New browser evidence is invocation-specific and records Git revision, dirty-tree state, outcomes and hashes. Frozen evidence is never reclassified as current. Automated test captures in historical design folders are preserved privately and restored to their original tracked bytes; only deliberately reviewed current public baselines are updated for changed copy.

## Product, security and private-beta limits

The acceptance journey is authenticated import → mapping/validation → dataset → saved async job → genuine model → authorized persisted result → exact chart/table → CSV/XLSX export. Fieldnotes operational screens, Horizon 3D, keyboard/reduced-motion alternatives and renderer lifecycle remain preserved. Browser screenshots and contrast/axe checks are developer evidence, not a manual screen-reader or physical-device certification.

Native intervals remain uncalibrated for general use. AirPassengers coverage is 58.3% against nominal 80%; the rejected Phase 03A candidate remains unshipped. The UI distinguishes historical measurement from nominal coverage. One dataset and a local CPU benchmark cannot establish business accuracy, cost or production latency.

Before external beta admission: independent Claude milestone review; explicit owner launch approval; invitation/access policy; deployment-specific TLS/cookies/secrets and least-privilege database credentials; retention/deletion and backup/restore procedures; error monitoring; measured multi-user resource/queue limits and inference costs. Local test superuser credentials and loopback configuration are not a production deployment recipe. No paid services, public beta launch, deployment, merge or Phase 04 was performed.

Safari/Firefox, physical devices, real screen readers, genuine encrypted-workbook fixtures, large-horizon performance and sustained concurrent-user load remain unverified. CSV first-open escaping does not guarantee safety after arbitrary spreadsheet re-saving. Existing Hallmark house-style findings remain disclosed; a regression-baseline pass is not raw Hallmark conformity.

## Recommendation

**CONDITIONAL PASS for continued development**, subject to the final exact-head CI and independent Claude review. The local acceptance workflow works with genuine inference and tenant-isolated retrieval. Calibration, deployment controls, invitation policy and operational/load evidence remain explicit beta-admission gates. This is not approval to admit external users or release commercially.
