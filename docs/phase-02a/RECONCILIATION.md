# Forewise — reconciliation and final local gates

24–25 October 2026. Final owner acceptance pending; no merge, production deployment, paid services, Phase 02B or Timestral.

## Repository state recovered

Two separate clones shared base commit `9c8cba837d6c09c05c3b70b956992d9584d926bd`:

- The prior Codex checkout under Documents/Codex held `codex/phase01-review`, with the Phase 01 polish, tests and evidence uncommitted. Its remote remained at the base commit after fetch.
- `C:/Users/lucab/forewise` held local branch `phase-02a-foundation`, also at the base commit, with Claude's eight changed/untracked source/document paths and no Phase 02A commit or remote branch. This is now the consolidated working checkout.

Both dirty states were archived before editing, including binary Git diffs and untracked task files. Archive SHA-256 values: Phase 01 `2c6a1ead1c4c0cdf375bc60010b1772573f85282c3afaf076ed412564d30ca44`; Claude draft `38ecf0667155b50aa2a003a1b50ac661c41ca77d190398d6d9374fdea9c130a0`. Archives remain in the invoking chat's private `work/` directory. No reset, branch merge, force-push, Docker reset or volume deletion was used.

After the actual PostgreSQL security/worker/API gates passed, the preserved Phase 01 patch was applied only to paths that still matched the common base. Original checkout work remains preserved. This consolidates source changes without merging branches or overwriting competing edits.

## Findings versus reported claims

- On arrival, Claude's job policy already explicitly compared the current user ID. The reported missing comparison was therefore not the exact source state found. However, the API used the privileged owner/PGlite connection for business job queries, had no standalone PostgreSQL adapter, and defined dynamic-ID GET behavior in a collection route. The draft schema referenced the app role before ensuring it existed and lacked necessary job grants. No successful original cross-tenant exploit is claimed to have been independently reproduced here.
- The worker had no fenced completion/failure predicate, did not commit its claim before computation, did not renew a heartbeat and did not bound retries. A stale execution could publish unconditionally.
- Forecast errors were hard-coded zeros. The claimed rolling-origin evaluator held out only one window and selected a non-model output column. Multi-frequency ingestion silently removed duplicates and did not reject gaps. Required dependencies and API/runtime integration were incomplete.

## Corrected boundaries

- All job business queries now execute as the authenticated restricted role; policies explicitly bind user and workspace. Job/dataset and job/result composite foreign keys enforce matching tenants. App grants exclude queue state updates. SQL tests cover foreign and missing identities, forged references, context leakage and restricted tables; API tests cover foreign jobs/datasets and revoked sessions.
- PostgreSQL and PGlite adapters share the transaction boundary. Node uses one checked-out connection per transaction. The worker switches to a restricted role that cannot read account/session tables.
- Claims commit before computation, use skip-locked row acquisition and increase a fencing counter. Heartbeats, failures and completion require matching job/worker/fence and a live lease. Completion locks first and rechecks clock time after waiting, then inserts the result and links completion in the same transaction. Duplicate or stale completions insert nothing. Failed inserts roll back the job transition.
- Maximum three total claims, delayed retry for transient errors, terminal invalid-input errors, and recovery of abandoned leases. An abandoned third execution becomes failed without a fourth attempt.
- Daily/weekly/monthly stored CSV inputs, independent Python validation, real StatsForecast SeasonalNaive point predictions and up to three expanding-window evaluation origins. Insufficient history yields null metrics and warnings. No calibrated quantiles or validated business-performance claim.
- [Phase 01 polish](../design/polish/REVIEW.md) preserves the selected identity/renderer and fixes hero clarity, CTA destinations, immediate mobile demo access, graph labeling and control feedback. Two scoped critique/correction passes and a final wide-screen title correction are documented. The public synthetic demo never calls the statistical worker.

## Final verification

**73 tests passed, zero integration skips in the recorded PostgreSQL-enabled runs:**

| Gate | Result |
| --- | --- |
| Node/database | 18 passed, including embedded and actual PostgreSQL RLS |
| Python | 27 passed, including competing claims, expiry after lock wait, stale-worker rejection, atomic rollback, retries and abandoned-job recovery |
| Final Chromium suite | 28 passed against the final optimized build, including standalone-worker API flow for daily/weekly/monthly CSV |
| Static/source gate | ESLint, Prettier, Ruff checks/format, TypeScript, dependency consistency and optimized build passed |
| Dependency audit | npm audit and pip-audit reported no known vulnerabilities at check time |
| Visual regression | Landing comparisons at 1440/768/390px passed without snapshot-update mode; original operational baselines passed unchanged |
| Rendering and UX | Actual 3D/a11y/overflow checks at 1440/768/390/1728px, keyboard controls, reduced motion, 2D/WebGL loss fallback, CTA destinations and mobile feedback passed |

The full source gate passed before the final isolated title-width correction; its final production build and complete 28-test browser suite then passed again. JS test/static checks for the added wide-screen assertion were also checked. One existing non-blocking Starlette TestClient/httpx deprecation warning remains.

Raw logs are ignored in `.data/`: `consolidated-verify.log`, `checks/results.json`, `phase02-real-node.log`, `phase02-real-python.log`, `phase02-api-flow.log`, `consolidated-final-build.log`, `final-e2e.log`. Public synthetic evidence is under `docs/design/polish/after/`.

## Infrastructure and remaining limits

Docker Desktop failed in its own Inference initialization. It was not reset. Actual integration used an isolated local PostgreSQL 17 cluster in WSL Debian, listening on localhost:55432; Compose's PostgreSQL 16 startup remains unverified. A pre-existing unrelated invalid Docker apt source in Debian was left untouched; package installation used only the existing official Debian source selection. Local credentials/environment files are ignored and excluded from commits.

This is a local foundation, not production approval. Separate provisioned database login credentials, deployment migration orchestration, restore/backup procedures, stronger request quotas/idempotent submission and a further independent security review remain. Async jobs are available through the API; no new async dashboard flow was added. Weekly/monthly baseline season length 1 and historical-only evaluation are disclosed. Safari/iOS, physical low-end GPUs, assistive-technology/user comprehension testing and conversion impact remain unverified. Local performance/idle-draw evidence is not field CWV or an FPS guarantee.

The older hosted temporary preview is unchanged. Review the local application and this branch; final Phase 01 acceptance remains the owner's decision. Do not begin Phase 02B automatically.
