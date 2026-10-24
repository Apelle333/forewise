# Phase 02B measurements

Measured locally on 25 October 2026. Pinned model/runtime/hardware in `evidence/model-manifest.json`. Float32 eager inference, one series/call. CPU and GPU ran sequentially after builds/tests stopped; other desktop applications remained running.

## Performance

| Context / horizon | CPU warm median (s) | GPU warm median (s) | CPU calls/min | GPU calls/min |
|---|---:|---:|---:|---:|
| 28 / 7 | 0.129 | 0.081 | 465.8 | 742.2 |
| 128 / 28 | 0.153 | 0.078 | 392.6 | 771.4 |
| 512 / 28 | 0.165 | 0.073 | 364.7 | 827.3 |
| 2048 / 90 | 0.343 | 0.108 | 174.8 | 557.0 |
| 5000 / 90 | 0.735 | 0.098 | 81.6 | 613.4 |

Three warm repetitions per case. First repetition is excluded even when the model is resident. Calls/min = 60 / isolated inference median, **not job throughput**: jobs also run three historical windows, SQL and queue/polling waits.

| Device | First call incl. Torch import (s) | Weight/device load (s) | Peak sampled RSS (GiB) | Peak allocated / reserved VRAM (GiB) |
|---|---:|---:|---:|---:|
| cpu | 4.730 | 1.715 | 2.175 | 0.000 / 0.000 |
| cuda | 5.274 | 2.136 | 2.194 | 0.801 / 0.836 |

Cold means a fresh Python process with weights already on disk, not an empty download cache. An earlier first-download GPU run took about 18 seconds for model load; network dependent, not a serving SLA. RSS samples every 20 ms can miss short spikes. CUDA allocator peaks exclude other processes/driver overhead. Only product limits (up to 5,000 context / 90 horizon) were measured; no quantization or compile optimizations.

## Rolling-origin comparison

Three expanding-origin disjoint test windows per fixture; each model sees only observations preceding its cutoff. No tuning or interval calibration on held-out windows. JSON includes exact cutoffs, MAE/RMSE/WAPE, pinball losses and coverage. WAPE is a ratio, null for zero denominator.

| Dataset | Type / frequency | Horizon | AI MAE | Current baseline MAE | Annual baseline MAE | Native nominal 80% coverage |
|---|---|---:|---:|---:|---:|---:|
| daily_demand | Synthetic / daily | 14 | 6.695 | 9.052 | — | 78.6% |
| weekly_sales | Synthetic / weekly | 8 | 5.681 | 23.966 | 30.618 | 79.2% |
| monthly_revenue | Synthetic / monthly | 6 | 6.576 | 33.773 | 9.258 | 83.3% |
| seasonal | Synthetic / daily | 28 | 7.163 | 10.334 | — | 85.7% |
| intermittent | Synthetic / daily | 14 | 2.020 | 52.208 | — | 95.2% |
| AirPassengers | Real / monthly | 12 | 18.730 | 73.222 | 35.917 | 58.3% |

Existing baseline: daily period 7; weekly/monthly period 1 (last value). Additional annual SeasonalNaive periods 52 / 12 are benchmarked without silently changing clients. The synthetic weekly signal has a seven-observation cycle; monthly has a twelve-observation cycle. These constructed signals are easy reproducibility tests, not representative business validation. Exact generators use seed 20261025.

**AirPassengers coverage is only 58.3%, below the nominal 80%.** Dashboard shows the measurement and an undercoverage warning. Intermittent demand coverage is 95.2%. Native bands are not calibrated or manually widened. Lower MAE on six fixtures does not establish universal superiority or business suitability; AirPassengers pretraining contamination is unknown. Domain-specific prospective holdouts and separately evaluated calibration are required before relying on coverage.

## Reproduce

```powershell
.venv/Scripts/python.exe scripts/benchmark-timestral.py --device cpu --output .data/benchmark-cpu.json
.venv/Scripts/python.exe scripts/benchmark-timestral.py --device cuda --output .data/benchmark-cuda.json
```

Run sequentially without concurrent builds/tests/model processes. Only pinned 209M weights are downloaded if uncached.
