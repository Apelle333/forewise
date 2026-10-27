# Phase 03B follow-up review — 26 October 2026

Continued from clean, pushed `0b57255`. Three targeted subagents reviewed security/parser behavior, workspace UX and verification provenance. Their reviews supplement development QA; none is independent Claude approval.

## Confirmed defects and corrections

| Finding                                                                                    | Correction                                                                                                                                                    | Direct evidence                                                                               |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| P2: a delayed View result could replace state after switching workspace                    | Abort the previous result request on a newer selection, workspace/tab change or unmount; bound refresh/state application to the same live request/workspace   | New browser regression fails against the prior compiled build, passes after correction        |
| P2: import mappings/frequency stayed editable while their captured values were being saved | Disable all three preview selects during submission; restore editing after failure                                                                            | Slow-response negative browser test fails before, passes after; failure keeps the dialog open |
| P2: Excel's early 1900 epoch dates were shifted by the library                             | Reject date cells before 1900-03-01 for the 1900 epoch; allow explicit ISO text and preserve the 1904 epoch                                                   | Real workbook tests reject serials 1/59/60, accept serial 61 and 1904 serial 0                |
| P2: noncanonical ZIP part names could bypass preflight while ExcelJS still parsed them     | Reject worksheet/theme/drawing/comment/table/relationship aliases recognized by ExcelJS's unanchored dispatch                                                 | Ten malicious filename aliases are rejected by production parser tests                        |
| P2: CI could upload fresh files beside a frozen Windows evidence manifest                  | Write browser output to one shared invocation-specific ignored directory; generate current revision/platform/result/hash manifest on both success and failure | Reporter/helper unit cases verify path boundaries, failure output, retry outcomes and hashes  |
| P3: export logout test only repeated anonymous access                                      | Replay the captured pre-logout session cookie after revocation                                                                                                | Authenticated export test now checks the revoked token directly                               |
| P3: malformed 36-character workspace IDs could reach PostgreSQL                            | Validate the exact UUID shape before tenant lookup                                                                                                            | API regression expects 404 for the malformed shape                                            |

The artifact reporter records `working_tree_dirty_at_start` as well as Git revision, so uncommitted runs are not presented as exact-commit proof. Frozen historical evidence under `docs/phase-03b/evidence` is preserved. New output is archived from `.data/phase03b-e2e/<runID>/`; an interrupted run cannot retain a success manifest.

Targeted validation before the final gate: 45 Node/PostgreSQL tests and seven Phase 03B browser tests pass with no skips; the static Hallmark baseline has zero new findings. Initial failure logs, corrected-run logs and manifests remain in ignored local evidence and the delivery archive. Final source/browser/render and remote CI results are recorded below.

No forecasting algorithms, model weights, RLS policies, worker fencing or premium design were replaced. No Phase 04, merge, deployment or paid activation is authorized.

## Final verification of the application changes

Application commit `39dd4e7fc4335860a6bde36dfaa36509c5183fc6` passed the complete local source gate and **174 cases**: 45 Node/PostgreSQL, 55 Python, 42 Windows Chromium, 20 Hallmark gate and 12 installer tests. All have zero failures/skips. The new run manifest records a clean checkout at launch, the exact revision, 42 expected browser outcomes and fresh artifact hashes. Four required Hallmark URLs report render ran, with 20 fresh PNGs. The 44 reviewed static findings remain disclosed; this is not a raw Hallmark-clean claim.

Draft PR [#6](https://github.com/Apelle333/forewise/pull/6) now exists. [GitHub Actions run 40243760957](https://github.com/Apelle333/forewise/actions/runs/40243760957) on the same application commit succeeded in 5m 6s. The downloaded artifact 12617284490 has SHA-256 `7e51c8d600c3bb1225acdd4ecfcdb6aa7690f05555fba14c23fa0a55ebe5da90`, matching GitHub's digest. Root and the evidence subagent independently checked:

- Real Linux 36/36 browser outcomes, no skips/errors, clean exact 39dd4e7 provenance. The six Windows-only screenshot comparisons are the existing documented platform exclusions; functional mobile/tablet/desktop and real-model checks execute on Linux.
- All 12 originally emitted run-file hashes/lengths and all 36 native XLSX quantile cells match their recorded JSON values.
- All four rendered routes and 20 PNG hashes/dimensions match. Linux Chrome 155 reports Namespace, PID/network and Seccomp sandbox protections active, with no bypass flags.
  - 45 Node/PostgreSQL, 55 Python, 20 gate and 12 installer cases and all 13 source checks exit successfully. The CPU quality smoke executes bike_daily/horizon 1, 30 calibration and 30 test origins, 60 genuine inference calls; its 70% native coverage remains research evidence, not a calibration approval.

One redundant legacy region capture in that first archive was mislabeled desktop after the viewport had changed to 390px. Correct full-page 1440/768/390 screenshots were already present and valid. The duplicate region captures/JSON are removed in the final evidence cleanup, and each retained result PNG now asserts its encoded width matches the viewport label. The current browser artifacts contain only the unambiguous source export, native JSON and six onboarding/result screenshots.

Structured first-run artifact inspection is in `ci-39dd4e7.json`. Raw logs/archives stay ignored and are delivered separately. The final PR checks also execute the capture-label cleanup; their status and exact final-head run remain visible on GitHub rather than being predicted by this document.

## Remaining review boundaries

Independent Claude acceptance remains pending; subagent reviews are not substituted for it. Native AirPassengers coverage remains 58.3%, with no experimental correction. Safari/Firefox, physical-device/screen-reader sessions and production scalability/commercial readiness remain unverified. GitHub reports a non-blocking Node 20 action-runtime deprecation notice for the existing pinned actions; it forces Node 24 and all gates pass. No merge, deployment, paid activation or Phase04 occurred.
