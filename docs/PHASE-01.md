# Phase 01 — owner review gate

Date: 24 October 2026 (Europe/Rome). Status: **IMPLEMENTED — AWAITING OWNER REVIEW**. Phase 02 has not started.

Private source repository: https://github.com/Apelle333/forewise

## Delivered

| Requirement                          | Implementation/evidence                                                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Verify official Next.js SaaS starter | Source, observed commit and adoption decision in STARTER.md                                                                            |
| New isolated private repository      | Apelle333/forewise; new checkout only, no existing project modified                                                                    |
| Next.js/TypeScript monorepo          | npm workspaces: apps/web + packages/db; Python in services/forecast                                                                    |
| Separate Python forecasting service  | Loopback FastAPI with internal bearer authentication                                                                                   |
| Database and multi-tenant isolation  | Persistent embedded PostgreSQL, memberships, restricted role and tested RLS                                                            |
| Premium responsive English landing   | Original typography, muted green/ivory palette, illustrative dashboard, desktop/mobile screenshots                                     |
| Real authentication and workspace    | Account creation, salted hashes, revocable sessions, protected page/API, workspace creation and switching                              |
| Upload/forecast mock flow            | Actual CSV validation/storage, weekly-repeat mock, chart and CSV export                                                                |
| Tests/documentation                  | Unit, SQL isolation, Python contract, browser/API integration, restart and service-outage checks; README/architecture/API/source notes |
| No real billing or production        | No Stripe dependency/keys/checkout, hosting deployment or paid provisioned resource                                                    |

## Verification

| Check                                    | Result                                                                        |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| npm run typecheck                        | Passed                                                                        |
| npm test                                 | 9 passed, including real PostgreSQL cross-tenant read/write/FK denial         |
| Python pytest                            | 12 passed                                                                     |
| npm run build                            | Passed, optimized Next.js build; no deployment                                |
| Playwright against compiled local server | 3 passed; desktop 1280×720 and mobile 390×844                                 |
| Unavailable Python HTTP integration      | 503 returned, saved dataset preserved, no failed forecast stored              |
| Full process restart/recovery            | Session and dataset survive; recovered service returns and stores mock output |
| npm dependency audit at install          | 0 known vulnerabilities reported                                              |
| Python dependency consistency            | pip check passed                                                              |

Python tests emit one dependency deprecation warning: Starlette TestClient references `anyio.abc.BlockingPortal`. It does not fail tests; this report does not claim a complete security audit. Browser runner also emits an environment-only NO_COLOR/FORCE_COLOR warning.

Browser checks cover keyboard skip navigation, mobile overflow, registration, invalid and real file upload, sample upload, mock service integration, export, reload, workspace switching, logout, login, unauthenticated denial, foreign/missing Origin denial, rate limiting, foreign-workspace access, foreign-dataset forecast denial and replay of a revoked session.

Screenshots were inspected after capture:

- [Landing desktop](screenshots/landing-desktop.png)
- [Landing mobile](screenshots/landing-mobile.png)
- [Workspace desktop](screenshots/workspace-desktop.png)
- [Workspace mobile](screenshots/workspace-mobile.png)

## Material limits for review

1. The original chat's detailed assistant plan could not be recovered: returned content-reference placeholders only. Current explicit Phase 01 scope is implemented; hidden plan details are not represented as verified.
2. Storage is local, persistent PostgreSQL/PGlite with tested RLS. Hosted PostgreSQL and multi-instance operation are not configured or verified. Docker was not running; no existing local infrastructure was changed.
3. The forecasting output is intentionally a weekly-repeat mock, not Timestral or another trained model. No accuracy/business-value claim is made.
4. Authentication is functional for local review. Email verification/recovery, invitations, public anti-abuse, hosted backups, storage/retention policy and production security checks remain future work.
5. Product positioning is general-purpose; Phase 01 input is only a single daily numeric series. No monthly, irregular, multi-series or multivariate support is claimed.

## Review decision

Review the landing, onboarding, workspace and mock flow locally. Approve or request targeted Phase 01 revisions. **Do not start Phase 02, activate billing, connect customer data, or deploy without a subsequent explicit owner instruction.**

Reproduce outage/recovery locally only: stop the running preview, set `FORECAST_SERVICE_URL=http://127.0.0.1:9`, run `npm run preview`, then `node scripts/check-outage.mjs`. Stop it, clear that environment override, run the preview again, then `node scripts/check-restart.mjs`. These scripts use synthetic accounts and ignored local session state. Do not run them against a real service.
