# Phase 02B — genuine Timestral 209M

Local development implementation. No production deployment, payment activation, merge or Phase 03 work. Phase 02A security remains the execution boundary.

## Reproducible model

- Official implementation: [mistralai/timestral](https://github.com/mistralai/timestral/tree/a534bdbd244d64f3d9d743f46c7bf6fc330ed4ff), commit `a534bdbd244d64f3d9d743f46c7bf6fc330ed4ff`, package 1.0.0, Apache-2.0 code.
- Weights: [mistralai/Timestral-209M](https://huggingface.co/mistralai/Timestral-209M/tree/9874d252ab0aae16f7f7c999f98f98d6ad7d8365), revision `9874d252ab0aae16f7f7c999f98f98d6ad7d8365`. Only this model is downloaded. SHA-256, runtime versions and hardware are recorded in `evidence/model-manifest.json`.
- **Weights use Modified MIT**, with attribution and a revenue restriction: rights are unavailable if the company/employer's consolidated global revenue in the preceding month exceeds US$20 million or equivalent, absent a separate commercial license. See the [exact pinned license](https://huggingface.co/mistralai/Timestral-209M/blob/9874d252ab0aae16f7f7c999f98f98d6ad7d8365/LICENSE) and retained notice. Do not describe this as unrestricted MIT. Verify organizational eligibility before commercial deployment.
- Official PyTorch eager float32 inference, causal patch scaling/asinh, default symmetric averaging and nonnegative clipping. No external normalization, invented predictions, repaired quantiles or hand-built uncertainty bands.
- Official model: context 32,768 observations, decode block 1,024 future observations; longer forecasts roll median blocks forward. Supports multiple variates and past/known-future covariates. **Product limits remain univariate, finite consecutive daily/weekly/monthly data, 8–5,000 observations and 1–90 future steps.** Covariates, missing/irregular data and model maximum context are not exposed or benchmarked.
- P10/P50/P90 come directly from the model's 21 quantiles. Reject invalid dimensions, nonfinite or crossing outputs. A nominal 80% prediction interval is not a confidence interval or calibrated guarantee.

## Local setup and operation

Validated Python 3.11.15 / Node 24.18.0. Install Git, Python, Node and uv; create `.venv`. Install the appropriate official PyTorch wheel first, then the locked dependencies:

```powershell
uv venv --python 3.11 --seed .venv
# CPU (portable); for this RTX 4060 Ti installation, use cu130 instead of cpu.
uv pip install --python .venv/Scripts/python.exe torch==2.14.1 --index-url https://download.pytorch.org/whl/cpu
uv pip install --python .venv/Scripts/python.exe -r services/forecast/requirements.lock.txt
npm ci
```

Linux uses `.venv/bin/python`. PyTorch `2.14.1+cpu` / `2.14.1+cu130` satisfy the pinned public version; do not install CUDA on a CPU host. See [official wheel guidance](https://pytorch.org/get-started/locally/). Allow several GB of disk for Python dependencies plus the 837 MB weights. First load requires access to the pinned public Hugging Face files; cache is ignored `.data/model-cache`, with no HF account token used. No uploaded time series is sent to Hugging Face.

Configure local PostgreSQL as in `../phase-02a/README.md`. Set `DATABASE_URL` for migrations/web and the restricted worker credentials in a worker environment. Do not commit credentials. The Windows development instance uses a separate local WSL PostgreSQL cluster at port 55432 because Docker Desktop was unavailable; this is not a production topology.

```powershell
node --import tsx scripts/database.mjs
npm run build
npm run preview
# Separate terminal, same configured DATABASE_URL (prefer a worker-only login):
.venv/Scripts/python.exe services/forecast/worker.py
```

The preview starts Next.js and the legacy internal mock service; **the asynchronous worker is a separate long-lived process**. It loads the 209M model once per device/process and reuses it across jobs and backtest windows. One worker executes one job at a time. `--once` claims at most one job, useful for diagnostics. No additional inference server or broker.

Configuration: `FOREWISE_MODEL_DEVICE=auto` (default), `cpu` or `cuda`; `FOREWISE_TORCH_THREADS=8`; `FOREWISE_MODEL_CACHE` optionally overrides the cache. Auto prefers CUDA if available and falls back to CPU for CUDA memory exhaustion; an explicit CUDA selection fails normally. `HF_HUB_OFFLINE=1` permits cache-only operation after prewarming. Only one resident worker is recommended on this GPU pending concurrency tests.

In the workspace, choose CSV frequency, upload `fixtures/air-passengers.csv`, select **Timestral 209M**, set horizon 12 and generate. Inspect the native band, exact values, model identity, historical metrics, period-1 baseline and undercoverage warning. Reload to verify persistence. Public Three.js demonstrations remain explicitly synthetic.

## Execution and compatibility

Additive API contract v2 selects `seasonal_naive` or `timestral_209m`; strict v1 behavior is preserved. See `API-CONTRACT-V2.md`. No schema migration is required: the existing immutable payload/result JSON carries the contract/model metadata.

Both models share the Phase 02A queue: authenticated restricted-role transactions and tenant RLS, workspace-bound dataset/result foreign keys, atomic SKIP LOCKED claim, committed ownership before inference, heartbeat on a separate connection, live-lease/fence checks under row lock, transactional result and completion, maximum three attempts with bounded backoff and abandoned-job recovery. Worker model failures disclose a generic error only. They never insert a partial forecast. The sole worker dispatch import changes; ownership SQL is preserved.

## Validation and evidence

`BENCHMARKS.md` explains measurements, fixtures, leakage prevention and limitations. `evidence/real-air-passengers-result.json` is an actual persisted app result, not a mock. Browser screenshots show desktop/tablet/mobile. Tests enable real model loading only with `RUN_TIMESTRAL_INTEGRATION=1`; PostgreSQL integration also requires an isolated `TEST_DATABASE_URL` matching the preview database. Keep other workers stopped while tests assert pending queue states.

```powershell
$env:RUN_TIMESTRAL_INTEGRATION='1'
# Configure TEST_DATABASE_URL without publishing it.
npm run verify
# Restart the newly built preview before browser tests:
npm run test:e2e
```

CI runs the CPU model and PostgreSQL lifecycle on GitHub Actions with pinned action revisions. Windows screenshot baselines are checked locally; Linux CI runs functional/security/model tests and omits the platform-specific public/workspace snapshot tests. Audit tools cannot scan the Git-only Timestral package via PyPI advisories; its official source is pinned and reviewed. This exception is documented, not a zero-risk claim.

## Hosting recommendation — planning only

Start with one persistent CPU worker, 4–8 vCPUs, 8 GB RAM and at least 10 GB free disk, plus web/PostgreSQL capacity and backups. Measured process RSS is approximately 2.2 GB; reserve headroom for imports, native libraries and the OS. The measured desktop CPU is not a shared cloud vCPU, so validate the actual host before setting throughput/SLOs. Retain queue backpressure and worker-only DB credentials; prewarm the pinned weights and restrict network after provisioning.

For occasional jobs, CPU avoids the cost/availability of an always-on GPU. This 8 GB RTX card fits the tested univariate limits in float32; it does not establish capacity at 32,768 context, multivariate inputs or multiple concurrent workers. CUDA allocator measurements omit driver and other processes. GPU hosting is justified only after representative queue latency measurements.

Illustrative budget assumptions, **not provider quotes**: 730 hours/month × US$0.03–0.10/hour = US$22–73/month for a CPU VM; add US$10–30 for web/database/storage/backups. At an assumed US$0.30–0.80/GPU-hour, always-on GPU alone is US$219–584/month. Taxes, region, bandwidth, managed services and labor excluded. Recheck actual pricing before approval. [Hetzner's official cloud documentation](https://www.hetzner.com/cloud/) distinguishes variable shared resources from dedicated CPU capacity; its dynamically rendered prices were not available as a reliable quote during this review. Nothing was purchased or activated.

Production still requires TLS, managed secrets, restricted independent DB logins, backup/restore and retention checks, job monitoring/alerts, realistic load/failure testing, model-license eligibility and domain-specific holdouts/calibration. Public dataset results do not validate business decisions.
