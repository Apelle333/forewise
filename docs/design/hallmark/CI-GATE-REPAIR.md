# Hallmark verification infrastructure repair

Scope: repair PR #5 after the read-only audit of `69f2b2c`. No UI, forecasting, tenant, worker, payment, deployment or Phase 03B changes.

## Correct the prior CI interpretation

Run [40205051478](https://github.com/Apelle333/forewise/actions/runs/40205051478) was green, but its public/auth Hallmark artifacts said `render: not run` with Chromium's `No usable sandbox!` error. That run is not evidence of a successfully rendered Hallmark audit. The existing functional browser tests and local screenshots are separate evidence.

## Required gate contract

Each of `/`, `/explorations`, `/register` and `/login` now runs in a separate upstream process and new output directory. A PASS requires all of:

- A parseable report with complete findings/counts, a valid process status and `summary.render === "ran"`.
- No critical accessibility, motion, overflow, script/render or occlusion failure. Missing-font/style render warnings fail as well. `10a` is matched exactly; tests compare all configured critical IDs to actual emitters in the pinned upstream scripts.
- Five fresh PNG screenshots with valid structure and expected dimensions: 375px full page, 1280Ã—800, 1440Ã—900, 1920Ã—1080 and 1440px full page. Missing/stale/partial screenshots cannot satisfy a new run. The pinned upstream additionally measures seven responsive widths during each completed page audit.
- Exact, unique coverage of all required URLs and a successful sandbox preflight. An empty target list cannot pass.

The wrapper records raw stdout/report, stderr and process status before parsing/rejecting anything, continues collecting evidence for other URLs, and exits nonzero on any required failure. `render-results.json` identifies the current run, actual Git revision, per-target results, screenshot paths/hashes/dimensions and browser/sandbox evidence. Per-run manifests preserve earlier positive/negative results without mixing their screenshots. Negative startup tests are labeled `chromium-startup-negative`; they must return exit 1. The final required audit is labeled `required-render-audit` and must return exit 0.

The 48 reviewed static findings remain unchanged and visible. A gate PASS still does not mean raw Hallmark style compliance. Protected workspace rendering remains covered by the authenticated Forewise browser tests; it is not replaced by a login redirect.

## Secure Chromium execution

GitHub Actions uses `ubuntu-24.04` and the runner's Chrome stable executable `/opt/google/chrome/chrome`, covered by Ubuntu's supported Chrome AppArmor profile. No `--no-sandbox`, sandbox-disabling flags, global AppArmor/sysctl changes, global hooks or paid services are introduced. The preflight checks browser arguments and, on Linux, requires active namespace and seccomp-BPF sandboxes via `chrome://sandbox`. Missing or failed startup is a gate failure, not a skip.

Sources: [Puppeteer sandbox/AppArmor troubleshooting](https://pptr.dev/troubleshooting), [Chromium AppArmor restrictions](https://chromium.googlesource.com/chromium/src/+/main/docs/security/apparmor-userns-restrictions.md), [GitHub Ubuntu 24.04 runner software](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md).

## Installation integrity

Every setup invocation verifies the pinned archive SHA-256 and derives the complete expected inventory from its bytes, even when `.source.json` exists. The cache manifest must equal that trusted revision/hash inventory exactly. Every installed file is checked byte-for-byte. Missing, unexpected, modified or symlinked files are rejected. Conflicting files are preserved rather than overwritten. The upstream release remains unmodified at `7ec868225c6caa040558c321ee0fefa0e73f83a8` (178 files).

## Reproduce and independently review

1. `npm run test:design`: positive and fault-injection tests, including a real upstream `transition: all` fixture and a real CLI invocation with an executable that cannot start as Chromium. Installer tests use temporary directories and deliberately corrupt inventories/files.
2. `npm run verify`, then the full existing browser suite against the just-built local app with PostgreSQL/model integration enabled.
3. `npm run design:render` against that app. Inspect every raw report, all target results, desktop/mobile PNGs and the sandbox preflight.
4. Check the exact corrective Git revision in CI and artifact manifests. Inspect artifacts rather than accepting the workflow conclusion alone. Artifacts include raw reports/logs and hidden screenshot directories on success and failure.

Independent Claude review must reproduce negative failures, validate the final positive CI artifacts and confirm the 48 findings remain explicit. This repair is not a Claude PASS, a merge, a deployment or permission to start Phase 03B.

## Local validation

140 unique tests passed: 18 existing Node tests, 55 forecasting Python tests, 35 browser tests, 20 Hallmark gate tests and 12 installer tests. No skipped model integration and no screenshot-baseline updates. The complete source gate (lint, format, types, build and dependency audits) passed. The final required render audit passed 4/4 URLs with 20 fresh PNGs. The deliberate invalid-browser invocation returned exit 1 and retained all four raw failure reports.

An initial full-suite attempt failed loading model weights with Windows paging-file error 1455; that failure log is retained in the review handoff. The subsequent complete run passed, including genuine model inference. No forecasting code, test exclusion or Windows system setting was changed. Remote exact-commit CI evidence is reported in the PR/handoff after its artifacts are inspected, rather than inferred from the workflow's green conclusion.

## Linux status-schema regression

[Run 40216112211](https://github.com/Apelle333/forewise/actions/runs/40216112211) on `943b50d` failed closed while all four upstream renders actually completed. The secure Chrome startup worked, but the preflight expected an obsolete status label. Its raw status instead reported `Layer 1 Sandbox: Namespace`, PID/network namespaces `Yes`, seccomp-BPF `Yes`, and adequate sandboxing. The parser now requires these exact current fields and the adequate-sandbox assertion; an observed-CI regression fixture rejects missing, disabled, duplicated or incomplete status. No sandbox requirement was removed. Both failed-run artifacts and the final exact-commit rerun are retained for review.
