# Visual critique and improvement log

Latest follow-up: [Phase 01 polish passes](polish/REVIEW.md) document the two separately scoped clarity/interaction correction passes and final consolidated verification. The historical redesign observations below remain preserved.

Evidence is generated from the compiled local app in Chromium, with synthetic accounts/data. Every capture set includes the landing, auth, empty/loading, validation, dataset-ready, result and service-error states at 1440/768/390px. Delayed loading and injected 503 screenshots are explicitly named simulations. Browser exceptions, failed requests and document overflow are recorded in each observations.json.

## Pass 1 — composition and data legibility

Inspected `pass-1/landing-1440.png`, workspace results at all three widths, and desktop registration. The new composition is visibly more editorial and the result precedes setup, but the following weaknesses remain:

1. At 768px the dataset rail squeezes the plot to a narrow portrait shape. Changed tablet composition to a full-width chart with setup below.
2. Numeric axis labels include distracting padded values such as 175.05/153.28. Rounded the padded domain to a sensible magnitude while retaining correct signed/constant extents.
3. The first result capture shows a pale future line during its opacity reveal. Removed opacity animation from essential data; motion now only changes dash offset. Shortened the visible chart caption to “Daily observations” while retaining its descriptive accessible name.
4. Mobile setup copy loses a space when a line break is hidden. Added explicit whitespace and raised key explanation text to 12px; native range targets are enlarged for touch.

Retest: next compiled capture set is `pass-2/`. No visual-quality score is invented.

## Pass 2 — responsive composition, native names and encoding

Inspected tablet result, mobile landing, mobile empty state, desktop loading and mobile service error in `pass-2/`. The tablet chart now uses the full width and the future line is fully legible. Public pages pass automated WCAG A/AA rules at all three widths, but this pass caught problems tests alone had missed:

1. An intermediate Windows text edit introduced UTF-8/Windows-1252 mojibake in workspace arrows, punctuation and loading labels. Repaired the source with explicit encoding and added rendered glyph assertions. These intermediate screenshots are retained as failure evidence, not presented as final quality.
2. axe reported a sample-button visible/accessibility-name mismatch. Removed its unnecessary aria-label; native visible text now supplies the name. Updated test selectors to the real action text.
3. The mobile empty-state illustration and duplicate messages push the sample action down. Removed redundant text and hid the purely decorative empty illustration on mobile; retained the actual data plot on result screens. Raised meaningful mobile explanations and range touch targets.

Retest: `pass-3/` and the same accessibility/keyboard suite. Snapshot creation during this intermediate pass is not counted as a regression test pass.

## Pass 3 — coherent details and inspection controls

Inspected mobile empty state, desktop/mobile result, mobile login error in `pass-3/`. Encoding is correct, the sample action is now visible within the captured 844px initial mobile viewport, and the result scale/line remain readable. Automated accessibility checks now pass for empty and populated workspaces at all widths. The keyboard test itself found an ambiguous selector (the chart description and range both mentioned “Inspect a day”); it now targets the slider role.

Three remaining details were refined rather than accepted:

1. Default thick browser range tracks look disconnected from the fine measurement grid. Styled the native controls as thin ruled tracks and square measurement handles, retaining native keyboard/touch behavior and 44px mobile targets.
2. Long profile email addresses wrap to isolated final characters in the desktop rail. Applied ellipsis and preserved the full value in the text/title.
3. The public point inspector says “value” even for the explicitly USD/hour sample. Added a unit prop so the inspector matches the selected synthetic series. Workspace values remain generic because CSV uploads do not declare a unit.

Final retest/captures are in `after/`; final screenshot baselines are created only after this pass, inspected, and then compared in a separate run without update mode.

## Final inspection and retest

Inspected the final full-page desktop landing, tablet result, mobile result and mobile empty state; compared the resulting hierarchy with `before/`. Actual controls use the ruler treatment, punctuation is correct, the tablet chart is wide, the mobile range hit area is preserved and profile email overflow is handled. Public and empty/populated product axe scans report zero violations in the tested rules/widths.

After establishing the six final Windows/Chromium screenshot baselines, a separate `npm run test:e2e` run **without update mode passed all 12 tests**. This includes keyboard inspection of exact historical/mock values and the data table, reduced-motion CSS, signed series staying inside the plot, the real upload/forecast/export/session flow, workspace switching and cross-tenant/API restrictions. The source gate passed all eleven checks plus the tracked-file credential guard: 14 Node/database tests, 14 Python tests, build, lint, format, type checks and both dependency audits.

Final capture set: 30 state/width combinations, no document overflow, no failed requests and no page exceptions. Earlier aborted Next.js RSC navigation requests are retained in the relevant capture logs; no failed application API request was hidden. Loading and simulated 503 captures remain explicitly identified.

Also exercised a **real upstream connection failure** by starting the web process with its forecast URL pointing to an unused loopback port: web API returned 503, the saved dataset remained, and no failed run was persisted. Browser screenshots `after/service-error-real-1440.png` and `after/service-error-real-390.png` show the real error. Restarted normally; the session and dataset survived, and the recovered Python service produced a stored mock forecast.

Measured local optimized landing (one fresh Chromium page, 1440×960, loopback, no throttling): see `after/performance.json` for the exact final sample. The measured run before the final timing-budget check was LCP 120ms, CLS 0.00396, navigation 144.5ms and resource transfer 202,377 bytes. Budgets are LCP <2,500ms, CLS <0.1 and resource bytes <500,000 in this local test. These are observations, not field Core Web Vitals, a Lighthouse score or proof of a performance improvement. Cache/CPU/network conditions make a single before/after timing comparison insufficient.

## Remaining limits and next useful work

- Desktop/mobile rendering and interaction were checked in Chromium on Windows; Safari/iOS, Firefox, real assistive-technology sessions and low-end physical devices remain unverified.
- Automated axe checks are not a full accessibility certification. Real-user onboarding/conversion testing has not been conducted; commercial appeal is a design judgment, not validated demand.
- No real uncertainty bands exist in this mock; the UI says so rather than inventing them. Timestral, hosted data storage, email recovery and other Phase 02/production concerns remain excluded.
- One non-blocking Python TestClient httpx deprecation warning remains. Both audits report no known dependency vulnerabilities; this is not a penetration test.
- Next useful work within a future approved review is cross-browser and user-testing feedback. No production or Timestral phase is started automatically.
