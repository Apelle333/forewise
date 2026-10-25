# Complete Phase 03B onboarding, genuine results and authorized exports

Base: `codex/hallmark-design-polish`

Head: `phase-03b-premium-experience`

State: draft / independent Claude review required

Claude's unfinished local handoff removed working generation controls and introduced mismatched job APIs, client-only XLSX validation, a fabricated baseline fallback and median-only exports. Preserve its original 29-file state in a separate checkpoint, reconcile its modular components, then complete the authorized Phase 03B scope.

- Restore generation/polling and job/result navigation. Validate mapped CSV/XLSX on the authenticated server with bounded ZIP/XML parsing and explicit formula/date errors. Keep mobile import actions visible and preserve keyboard focus.
- Render saved P10/P50/P90 and only genuine input/date-matched baseline overlays; report historical errors, coverage and unestablished calibration without enabling the experimental correction.
- Add tenant-authorized CSV/XLSX exports with metadata, primitive spreadsheet values and formula-text guards. Requeue failed jobs atomically through a narrowly granted membership-checked function; preserve worker-owned attempts/fencing and shared quotas.
- Preserve the existing design, public Three.js/fallbacks, inference algorithms, RLS and worker behavior.

Validation on application commit `074a305605f1e25e07cb1996dba0518a282cec90`: complete source gate; 40 Node/PostgreSQL, 55 Python, 40 browser, 20 Hallmark gate and 12 installer tests pass with no skips. All four required Hallmark URLs actually render with five fresh screenshots each. Static/rendered house-style findings remain disclosed; this is not a raw Hallmark clean claim. See `docs/phase-03b/VERIFICATION.md` and evidence manifest.

Native AirPassengers coverage remains 58.3% against nominal 80%; no experimental calibration change is shipped. No production deployment, commercial acceptance, paid activation, merge or Phase 04. GitHub connector access currently returns 404, so this document is prepared locally and no remote CI run is asserted.
