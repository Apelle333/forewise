# Hallmark integration and scoped polish

**CI evidence correction:** the initial green run did not execute Hallmark rendering on Linux because Chromium startup failed. Its green conclusion must not be used as rendered evidence. See [the verification repair and independent-review contract](CI-GATE-REPAIR.md); local visual evidence and the functional test suite are separate.

Owner request: apply [Nutlope/Hallmark](https://github.com/Nutlope/hallmark) while continuing Forewise. This is an existing approved design, so the intervention preserves Forecast Horizon, Fieldnotes, Three.js, typography, palette, routes, model contracts and synthetic-data disclosures. No theme was dealt and no product feature was added.

## Reproducible local integration

Hallmark 2.0.0 is pinned to `7ec868225c6caa040558c321ee0fefa0e73f83a8`; archive SHA-256 and source are recorded in `source.json`, with the MIT license alongside it. `scripts/install-hallmark.py` installs only the skill payload under ignored `.data/tools/hallmark`, checks the archive fingerprint, rejects unsafe paths and preserves conflicting existing files. It does not execute the upstream global installer, change user settings, install hooks, call Together AI or use a paid service.

- `npm run design:setup`: install or verify the pinned local payload.
- `npm run design:audit`: raw static reports for public, authentication and workspace scopes.
- `npm run design:check`: deterministic static regression check against individually reasoned existing findings.
- `npm run design:render`: actual local public/auth renders and critical contrast, focus, motion and overflow checks. The upstream renderer checks seven widths: 320, 375, 414, 768, 1024, 1280 and 1920. Screenshots include three desktop folds and desktop/mobile full pages.

The protected workspace is deliberately not represented by a login redirect. Its authenticated rendering, sample-data workflow, keyboard, axe and visual snapshots remain in the Forewise browser suite at 1440, 768 and 390px. The new scenario-table regression adds 320, 390, 768, 1280, 1440 and 1920px checks. CI runs the pinned baseline and rendered audit and uploads its raw reports/screenshots.

## Observation, correction and retest

1. **First rendered audit:** the scenario table inherited a paper header background with pale Horizon text, measured at 1.54:1. Registration input edges measured 2.71:1 against the field surface. Small metadata also used 9–11px text. Corrected the table's theme-specific header colors, darkened the existing border role to `#858878`, raised small labels to 12px and body text to 16px, and preserved the existing type families. Palette literals now use shared role tokens. Table headers stick as one group; the public data region has a bounded 22rem height and remains keyboard focusable.
2. **Confirming audit:** no critical rendered failures across the public/auth routes. An additional 10px badge used a font shorthand and was corrected; short press feedback uses a transform. Existing reduced-motion rules and optional WebGL behavior remain intact. The expanded table passes axe and containment checks at all six regression widths. Actual computed-style contrast is now 16.512:1 for the table headings and 3.568:1 for input borders. Before/after screenshots and raw reports are retained separately, so styling is judged from the rendered product rather than lint counts alone.
3. **Fresh-context finish review and regression correction:** a separate Codex reviewer found an existing desktop 2D axis label crossing the introduction at 1440px. The scene inset now follows the centered content gutter and reserves room for text and axis labels; a geometric assertion checks their separation. The reviewer confirmed the final 1440/1920px captures and returned `ship`, limited to the reviewed visual evidence. This is not the independent Claude engineering audit. The full real-Timestral browser flow then caught a 4px mobile overflow from the larger forecast-start annotation; centering that label resolved its overhang without shrinking the text or hiding page overflow.

## Findings that remain visible

This is **not a raw Hallmark clean pass**. The deterministic source baseline retains 48 individually explained findings: existing tracked labels, section identifiers, serif/accent headings, observation metadata and parser matches on mathematical ranges, navigation arrows and separate sticky contexts. Removing these solely to satisfy house-style rules would conflict with the owner's preservation requirement. `accepted-findings.json` records each exact finding and reason; new findings still fail the regression check.

Rendered gate 44d also reports that the public hero sections extend below the screen at 1920px. The headline, explanation and primary action remain visible in the first fold; the approved scene/story section intentionally continues below it. The raw report is retained, not relabeled as a pass. Other heuristics and warnings require contextual review, not an accessibility certification.

The reviewed warnings concern the existing semantic error/success stripe, optional heading balancing and differing section gaps collected from shared styles. They do not establish a runtime defect; existing state signaling and varied narrative composition are preserved. No warning is counted as an accessibility pass.

## Validation and evidence

108 local tests passed without skips: 18 Node, 55 Python and 35 browser tests. `npm run verify` passed all source/dependency checks; the subsequent CSS corrections were rebuilt, linted and format-checked, then the complete browser suite was rerun successfully against that build. All six intentionally changed Windows visual baselines were inspected. The browser suite includes CTA destinations, real Timestral CSV-to-persisted-result and foreign-tenant denial, reduced motion, WebGL fallback/context loss, scroll interactions and renderer idling. The final rendered audit reports zero critical failures; the raw source/style findings remain as described above.

Local unthrottled Chromium measurements are recorded in `performance-2d.json` and `performance-3d.json`. The 3D idle measurement records zero draw calls at rest; operational routes do not fetch its renderer. These are local observations, not field performance guarantees.

- [Before: desktop 2D](before/hero-1440-2d.png) → [after](after/hero-1440-2d.png)
- [Before: mobile registration](before/register-375.png) → [after](after/register-375.png)
- [Preserved live 3D desktop](after/hero-1440-3d.png) and [mobile](after/hero-390-3d.png)
- [Expanded mobile scenario table](after/scenario-table-390.png)
- [Real Timestral mobile result, with calibration warning](after/model-result-390.png)
- [Computed contrast evidence](contrast.json)

## Boundaries

Local automated measurements are not field performance evidence or complete accessibility/security certification. Hallmark is a development skill/audit tool, not a shipped UI library. Its Puppeteer dependency is development-only. No model calibration, forecasting backend, worker ownership, tenant authorization, payment or production deployment behavior changes here. Phase 03A research remains a separate milestone, pending the required independent Claude review.
