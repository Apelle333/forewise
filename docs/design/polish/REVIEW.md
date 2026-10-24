# Phase 01 polish — acceptance review

24 October 2026. Forecast Horizon remains the selected creative direction; final owner approval is pending. This describes the local application, not the unchanged temporary hosted preview.

The hero now explains a forecasting workspace in development for demand, revenue and capacity, daily CSV date/value inputs and intended stock/budget/staffing planning questions. It explicitly labels current examples synthetic and unvalidated, with no uploads/live forecasting. Typography, palette, Three.js renderer and cinematic narrative are preserved.

Public CTAs now lead to available demos/scenarios/studies. Sign-in and workspace invitations were removed from the public conversion path; operational authentication still works separately. At 390px, Try demo is visible in the initial navigation and reaches the demo in one action. Legends and annotations are larger/brighter. Depth is explicitly a viewing device, not another measured variable or probability. Mobile scene/control feedback stays together; the demo horizon precedes the chart. Native keyboard controls, tables, reduced motion and 2D fallback remain.

## Two critique-and-correction passes

These are separately scoped passes by the implementing agent, not two additional independent human reviews. The supplied independent visual review provided the original findings.

1. Product clarity/conversion: inspected desktop/mobile and followed demo/scenario paths. Made the initial caveat explicitly say not validated predictions, replaced abstract framing with concrete planning language and increased caveat readability. Evidence: `pass1-desktop.png`, `pass1-mobile.png`, `pass1-controls-mobile.png`.
2. Responsive interaction/data semantics: inspected tablet, mobile chart/control feedback and keyboard behavior. Increased legend/depth and 2D SVG labels, corrected the Y-label anchor, and verified direct navigation plus visible slider/readout feedback. Evidence: `pass2-tablet.png`, `pass2-demo-mobile.png`; final Chromium evidence is under `after/`.

These preserved changes were applied to the Phase 02A checkout only after PostgreSQL security/worker-flow tests passed. No branch merge or redesign occurred.

## Destination audit

| Action | Available destination |
| --- | --- |
| Brand/home | `/` |
| Skip to content | `#main` |
| How it works | `#how-it-works` |
| Explore scenarios | `#horizon-lab` |
| Navigation/hero/story/final demo actions | `#demo` |
| View the three visual studies | `/explorations` |
| Study direction links | `/explorations?direction=horizon`, `observatory`, `atlas` |
| Study Explore scenarios | study-local `#horizon-lab` |
| Back to selected design | `/` |

Chromium tests follow every visible homepage link at 1440/768/390px and each study direction/back/scenario path, reject public links into unavailable account/workspace features, and check the initial mobile demo entry. Separate tests exercise operational registration/upload/mock/export/session behavior.

## Evidence and limits

Before/after browser captures are retained; final clean Chromium images are in `after/`. Native in-app screenshots can include browser margins/clipping; these are not website overflow findings. Updated deterministic reduced-motion landing baselines are compared again without update mode. Operational workspace baselines are preserved.

No user comprehension study, conversion lift, Safari/iOS result, low-end physical-device FPS guarantee or accessibility certification is claimed. The statistical API's backtests do not change the public demo's synthetic status. See [consolidated results](../../phase-02a/RECONCILIATION.md). The owner retains final Phase 01 acceptance; Phase 02B does not start automatically.
