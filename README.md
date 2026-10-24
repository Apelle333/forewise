# Forewise

An English, general-purpose B2B forecasting workspace. **Phase 01: local development preview, awaiting owner review.** No deployment, payments, external model calls, or paid infrastructure is configured.

## Run locally

Requires Node.js 22.13+ (validated on 24.18), Python 3.12+, npm, and approximately 1 GB free space for dependencies. Docker is not required.

```powershell
npm ci
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r services/forecast/requirements.lock.txt
npm run dev
```

Open **http://127.0.0.1:3000**. Create an account with any test email and a password of 12–128 characters; email delivery is not connected. No seeded credentials. `npm run dev` starts Next.js and the Python service, creates a random local service token in the ignored `apps/web/.env.local`, and binds both services to loopback. Ctrl+C stops both. On macOS/Linux use `.venv/bin/python` for installation.

One local Next.js process may open the persistent database at a time. Data is stored inside `apps/web/.data/forewise`, excluded from Git. This is a development storage adapter, not a hosted production database. To change ports/origin, configure `.env.local` and the process commands together; requests must match `APP_ORIGIN` (default `http://127.0.0.1:3000`).

## What works

- Responsive landing, sign-up/sign-in, logout and protected workspace.
- Real salted password hashing and server-side sessions; session cookies are HttpOnly and SameSite=Lax, Secure when served over HTTPS.
- Create/switch workspaces; membership checks and real PostgreSQL row-level security protect tenant data.
- Upload and validate daily `date,value` CSV files, or load synthetic sample data.
- Persist datasets and mock forecast runs; visualize history/output and export a mock CSV.
- A separate internal FastAPI process returns explicitly labelled weekly-repeat mock outputs. **No trained forecasting model is integrated in Phase 01.**

CSV contract: UTF-8, exactly `date,value` columns, 8–5,000 consecutive daily observations, unique valid `YYYY-MM-DD` dates, finite numerical values within ±1e12, file below 1 MB. Rows are sorted by date. Forecast horizon: 1–90 days. Monthly/irregular/multivariate data is not supported in Phase 01.

## Commands

```powershell
npm run typecheck
npm test
.\.venv\Scripts\python.exe -m pytest services/forecast -q
npm run build
npx playwright install chromium
# Keep npm run dev running in another terminal:
npm run test:e2e
```

Browser tests create synthetic users/data in the local development database. They cover desktop/mobile layout, registration, invalid and valid upload, mock forecasting/export, reload, workspace switching, login/logout, CSRF and cross-account access. Screenshots are saved in `docs/screenshots/`; the transient browser report is ignored.

## Repository map

| Path                  | Responsibility                                                                   |
| --------------------- | -------------------------------------------------------------------------------- |
| `apps/web/app`        | Next.js App Router pages and same-origin API                                     |
| `apps/web/components` | Landing/auth/workspace presentation                                              |
| `apps/web/lib`        | Password/session helpers, CSV validation, local database singleton               |
| `packages/db`         | PostgreSQL schema, restricted role, RLS transaction boundary and isolation tests |
| `services/forecast`   | Separate Python mock forecasting API and contract tests                          |
| `e2e`                 | Playwright browser and API integration tests                                     |
| `scripts/dev.py`      | Local process orchestration and generated internal service token                 |
| `docs`                | Architecture, source verification and Phase 01 gate evidence                     |

See [architecture](docs/ARCHITECTURE.md), [API contract](docs/API.md), [starter verification](docs/STARTER.md), and [Phase 01 gate](docs/PHASE-01.md).

## Boundaries

Phase 01 is not a production-ready release. Email verification/recovery, invitations, infrastructure hardening, hosted PostgreSQL migration, backups, customer data handling, a job queue, real model evaluation and billing need later decisions. There are no customer logos, fabricated testimonials, validated accuracy claims, published prices, or invented traction. Source is private; no license grants for Forewise source are made here. Dependency licenses remain with their respective authors.

**STOP: owner review of Phase 01 is required before starting Phase 02 or deployment.**
