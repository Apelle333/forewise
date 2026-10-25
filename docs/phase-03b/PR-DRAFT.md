# Complete Phase 03B onboarding, genuine results and authorized exports

Base: `codex/hallmark-design-polish`

Head: `phase-03b-premium-experience`

PR: https://github.com/Apelle333/forewise/pull/6

State: draft / independent Claude review required

Claude's unfinished local handoff removed working generation controls and introduced mismatched job APIs, client-only XLSX validation, a fabricated baseline fallback and median-only exports. Preserve its original 29-file state in a separate checkpoint, reconcile its modular components, then complete the authorized Phase 03B scope.

- Restore generation/polling and job/result navigation. Validate mapped CSV/XLSX on the authenticated server with bounded ZIP/XML parsing and explicit formula/date errors. Keep mobile import actions visible and preserve keyboard focus.
- Render saved P10/P50/P90 and only genuine input/date-matched baseline overlays; report historical errors, coverage and unestablished calibration without enabling the experimental correction.
- Add tenant-authorized CSV/XLSX exports with metadata, primitive spreadsheet values and formula-text guards. Requeue failed jobs atomically through a narrowly granted membership-checked function; preserve worker-owned attempts/fencing and shared quotas.
- Preserve the existing design, public Three.js/fallbacks, inference algorithms, RLS and worker behavior.

Validation on application commit `39dd4e7fc4335860a6bde36dfaa36509c5183fc6`: complete source gate; 45 Node/PostgreSQL, 55 Python, 42 browser, 20 Hallmark gate and 12 installer cases pass without skips (174 total). GitHub Actions run 40243760957 passes on that exact application commit with 36 Linux browser cases; six Windows snapshot comparisons remain local. Actual artifact hashes, native XLSX quantiles and 20 rendered Hallmark screenshots have been inspected. See FOLLOW-UP-REVIEW.md and ci-39dd4e7.json. The final capture cleanup removes redundant legacy region images and asserts real PNG widths.

Three scoped subagents identified and helped fix stale workspace result loads, mutable import controls, Excel 1900 normalization, parser filename aliases and CI evidence provenance. New browser regressions fail against the old compiled build and pass after correction. Revoked export cookies are replayed directly. Frozen evidence stays attached to its original tested commit.

Native AirPassengers coverage remains 58.3% against nominal 80%; no experimental calibration change is shipped. No production deployment, commercial acceptance, paid activation, merge or Phase04. Independent Claude approval remains required. GitHub access is now available through the authenticated browser; the earlier connector 404 is a historical limitation, not the current PR status.
