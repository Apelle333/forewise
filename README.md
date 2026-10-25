# Forewise

**Phase 02B approved for continued development on 25 October 2026; commercial release remains unapproved.** Current milestone: [Phase 03A forecast quality protocol](docs/phase-03a/PROTOCOL.md). Research-only interval adjustments and model recommendations do not change the operational API or defaults. Each Phase 03 milestone stops for independent Claude review.

An English, general-purpose B2B forecasting workspace. **Phase 02B: genuine local Timestral 209M and SeasonalNaive through the secure asynchronous PostgreSQL queue.** Public cinematic demos remain synthetic. No production deployment, payments or paid infrastructure is configured. See [Phase 02B setup, contracts, license and limitations](docs/phase-02b/README.md) and [measured CPU/GPU benchmarks](docs/phase-02b/BENCHMARKS.md).

## Run locally

Requires Node.js 22.13+ (validated on 24.18), Python 3.11+, npm, and several GB free disk for dependencies and the 837 MB model weights. Docker is optional; local PostgreSQL is required for asynchronous models. Follow the Phase 02B setup to select an official CPU/CUDA PyTorch wheel.

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
- Upload and validate daily/weekly/monthly `date,value` CSV files, or load synthetic sample data.
- Persist model results, inspect genuine P10/P50/P90, historical evaluation and data tables; export median forecast CSV.
- A standalone persistent worker runs Timestral 209M or SeasonalNaive through tenant-scoped, fenced jobs. Start it separately from the web preview.
- A separate internal FastAPI process preserves explicitly labelled weekly-repeat mock outputs for daily data.

CSV contract: UTF-8, exactly `date,value` columns, 8–5,000 consecutive daily/weekly/monthly observations, unique valid `YYYY-MM-DD` dates, finite numerical values within ±1e12, file below 1 MB. Monthly dates consistently use month starts or ends. Rows are sorted by date. Forecast horizon: 1–90 observation steps. Irregular/multivariate inputs remain unsupported.

## Commands

The complete local source gate is `npm run verify` (requires `uv` for pinned Ruff and pip-audit tools). It stops at the first failed check and writes logs plus exit codes to the ignored `.data/checks/` directory. It does not provision infrastructure, run paid CI, or deploy. Browser checks remain a separate command against a running local preview, so a stale build cannot be mistaken for the just-built version.

```powershell
npm run typecheck
npm run lint
npm run check:format
npm run verify
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
| `services/forecast`   | Persistent model worker, official Timestral inference, evaluation and mock API   |
| `e2e`                 | Playwright browser and API integration tests                                     |
| `scripts/dev.py`      | Local process orchestration and generated internal service token                 |
| `docs`                | Architecture, source verification and Phase 01 gate evidence                     |

See [architecture](docs/ARCHITECTURE.md), [API contract](docs/API.md), [starter verification](docs/STARTER.md), and [Phase 01 gate](docs/PHASE-01.md).

Earlier visual review findings are recorded in [Phase 01 review](docs/PHASE-01-REVIEW.md); current model evidence is in [Phase 02B review](docs/phase-02b/REVIEW.md). Changes are proposed through draft pull requests. Production deployment and advancing beyond Phase 02B remain owner-controlled.

The Fieldnotes redesign, primary references, three art directions, before/after captures and three visual critique passes are indexed in [the design review](docs/design/README.md). Project-wide creative/QA expectations persist in [AGENTS.md](AGENTS.md).

Visual checks: `node scripts/capture-design.mjs after` captures 10 states at 1440/768/390px. `node scripts/audit-accessibility.mjs after` captures public-page axe findings. `npm run test:e2e` includes functional, WCAG, keyboard/reduced-motion, signed-chart and six screenshot regression checks. Baselines in `e2e/design.spec.ts-snapshots/` are for Chromium on Windows; update them only after inspecting intentional visual changes. The application must be running from the just-built code.

## Boundaries

This is not a production-ready release. Email verification/recovery, invitations, hosted infrastructure hardening, backup/restore, customer data handling, monitoring and domain-specific model validation/calibration remain production gates. The local PostgreSQL queue and real model evaluation are implemented. Billing remains disabled. There are no customer logos, fabricated testimonials, validated accuracy claims, published prices, or invented traction. Source is private; no license grants for Forewise source are made here. Dependency/model licenses remain with their respective authors.

**STOP: independent Claude review is required at each Phase 03 milestone. Production deployment, commercial release and merge remain unapproved.**
