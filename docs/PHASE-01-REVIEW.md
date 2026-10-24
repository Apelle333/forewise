# Phase 01 autonomous development review

Current owner gate: final acceptance remains pending after [UX polish](design/polish/REVIEW.md) and [Phase 02A reconciliation](phase-02a/RECONCILIATION.md). Results below describe the earlier Phase 01 source gate, not acceptance of the later asynchronous foundation.

24 October 2026 — current explicit Phase 01 scope only. No inter-chat copying or separate task handoff is required: planning, implementation, diagnostics, review, commits and the pull request are managed in this chat.

## Milestones and acceptance criteria

| Milestone                | Acceptance                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Review the existing gate | Check only auth/API, workspace switching, CSV/service boundaries and relevant tests; preserve the architecture and unrelated projects                                                 |
| Correct verified defects | Bound request accumulation during streaming, reset workspace state at selection, reject unsupported auth paths, handle calendar/token edge cases and remove known dependency findings |
| Reproduce validation     | Zero lint/format/type errors, passing unit/Python/browser tests, successful build, dependency consistency and no known audit findings                                                 |
| Deliver for review       | Commit on a separate branch, create a private PR, document limitations, stop at Phase 01                                                                                              |

## Findings and fixes

- The web API previously read the entire body before applying the size limit. `readLimitedBody` now limits accumulated bytes, checks declared sizes early and cancels chunked streams when over the limit. Tests cover exact-size bodies, declared oversize without reading, and cancellation without Content-Length. Integration checks assert HTTP 413.
- Workspace switching synchronously reset state from an effect. The selection handler now resets data/loading state; the fetch effect only receives results and cancels stale callbacks. The browser test checks that a new workspace is empty and switching back restores the original workspace.
- The broad auth route condition accepted suffix paths. Exact route length is now required; an authenticated suffix-path request returns 404.
- Python date overflow could raise an unexpected exception at year 9999. Validation now rejects horizons that exceed the calendar. Non-ASCII authorization values are compared as bytes and rejected with 401 rather than raising TypeError. Regression tests cover both.
- The original Python lock retained Starlette 0.50.0 when FastAPI was upgraded. pip-audit reported ten advisory entries for that dependency, including repeated advisory records. It was upgraded to Starlette 1.10.0, with a minimum patched version in the direct requirements and the exact resolved version in the lock. Relevant upstream advisory: [GHSA-82w8-qh3p-5jfq](https://github.com/Kludex/starlette/security/advisories/GHSA-82w8-qh3p-5jfq). The final audit must be clear before delivery.
- Added reproducible ESLint/Next/React Hooks/TypeScript rules, project-local Ruff configuration, formatting checks and `npm run verify`. The Next preset's legacy plugins do not support ESLint 10, so the configuration uses the supported Next plugin and TypeScript/React Hooks plugins directly; dependency peer compatibility is checked.

## Check evidence

`npm run verify` runs the tracked-file credential guard, JS/TS lint, Prettier, Python lint/format, TypeScript, Node unit/SQL tests, Python tests, pip consistency, optimized build, npm audit and pip-audit. Tool versions for Python lint/audit are pinned in the runner. Logs and JSON exit codes are saved in `.data/checks/`, which is excluded from source control. The credential guard checks forbidden tracked paths and common private-key/GitHub-token patterns; it is not a comprehensive secret detector or penetration test.

Browser tests run after the newly built server is started. They verify the full local workflow, tenant denial and UI behavior. Screenshots in `docs/screenshots/` are illustrative evidence captured with synthetic data. The existing service outage/restart scripts exercise the saved-data recovery boundary.

## Final gate result

All eleven source-gate checks passed on this branch, plus the tracked-file credential guard. Node/database tests: **12 passed**. Python: **14 passed**. Playwright against the optimized local build: **3 passed**. npm audit and pip-audit: **no known vulnerabilities reported**. `npm ls eslint --depth=2` confirms the lint dependency tree has no invalid peers.

Review outcome: the explicit Phase 01 acceptance criteria are satisfied for the local mock preview. No unresolved implementation blocker was identified in the reviewed boundaries. The only remaining dependency test warning recommends httpx2 instead of httpx for Starlette TestClient; HTTP contract tests pass. The owner approval and production-readiness boundaries below remain in force.

## Remaining boundaries

Local single-process PostgreSQL/PGlite only; mock weekly-repeat forecasting; daily univariate CSV only. No real model, paid service, payment activation, production release or Phase 02 work. The original chat's detailed assistant plan remains unavailable; this gate is evaluated against the explicit requirements in the current conversation.

Public readiness work (hosted PostgreSQL, production abuse controls, email verification/recovery, invitations, backups, broader security testing) remains outside this phase. Dependency auditing reports known advisories at check time; zero findings does not prove the application has no security defects.

The owner retains the Phase 01 approval decision. The pull request is not merged automatically, and no new milestone starts without approval.
