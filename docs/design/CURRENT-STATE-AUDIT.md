# Current-state product audit

24 October 2026. Baseline: commit 1088b96, existing Phase 01 app running in Chromium at localhost. Reviewed the rendered product, not only its source. Baseline evidence is in `before/`; widths are 1440, 768 and 390 CSS pixels. Inputs and accounts are synthetic.

## Findings from the rendered interface

| Perspective           | Concrete observation                                                                                                                                                  | Consequence                                                                              | Priority |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------- |
| Creative direction    | Centered two-line slogan, serif accent, pale rounded panels and miniature dashboard reproduce a common SaaS composition.                                              | No recognizable visual mechanism ties identity to forecasting.                           | High     |
| Conversion            | “Less guesswork” and “A clearer view” precede a static miniature interface; the visitor cannot manipulate the example.                                                | Understanding depends on reading abstract copy.                                          | High     |
| Product               | The sample-data action is a small tertiary link below the upload button.                                                                                              | The easiest first step is visually the least prominent.                                  | High     |
| Workflow              | Three summary cards and two tall setup panels precede the chart. On the captured 390px result page the chart is near the bottom, after more than a viewport of setup. | The outcome has less priority than inputs even after success.                            | High     |
| Data visualization    | Chart has date endpoints but no numeric axis, point values, selected-date inspector or tabular alternative. Green fill is rectangular, not a statistical interval.    | Users cannot read a numerical result or assess scale; fill risks suggesting uncertainty. | High     |
| Readability           | Many labels, hints and notices are 8–11px with pale green/gray text.                                                                                                  | Mobile looks like a scaled desktop rather than a deliberate reading interface.           | High     |
| Feedback              | Errors and success messages share the overview area, far from the action lower on mobile.                                                                             | Users may miss why an action failed or where a result appeared.                          | Medium   |
| Onboarding            | Auth is a plain centered form on an empty backdrop.                                                                                                                   | No continuity with the sample-data story or next step.                                   | Medium   |
| Navigation            | Sidebar items are anchor links; Overview looks selected throughout.                                                                                                   | It implies separate navigation state while only scrolling.                               | Medium   |
| Frontend architecture | One large workspace component combines orchestration, setup and chart presentation; global CSS contains 1,372 lines with many tiny one-off sizes.                     | Hard to enforce a coherent hierarchy or reusable tokens.                                 | Medium   |
| Engineering           | Chart scale multiplies min/max rather than padding the data extent. For negative values, this can exclude observations.                                               | Signed business series need a correct scale and a regression check.                      | High     |

## What works and must remain

Real authentication and server sessions, workspace creation/switching, backend validation and tenant RLS are functional. Native form labels, visible focus, reduced-motion media query, explicit mock notices, saved datasets, CSV export and distinct error messages are useful foundations. Preserve the API/storage/service architecture.

## Browser coverage and limits

Visited landing anchors, login (including incorrect credentials), registration, empty workspace, invalid file upload, sample dataset, mock forecast and service-error presentation. The existing E2E suite separately covers workspace switching, real CSV upload, export, login/logout and cross-account denial; those checks will be rerun after the redesign. Loading and service-outage UI captures use explicitly identified delayed/injected responses; they are not represented as naturally occurring outages.

Stored baseline capture: no horizontal overflow in 30 screen/viewport combinations. One aborted Next.js RSC navigation request was recorded; no page exception. Baseline landing's stored local navigation was 95ms, LCP 196ms and CLS 0 in one loopback Chromium run. A separate axe scan found color-contrast violations on 21 landing elements; login/register reported none in the tested rules. SPA/resized entries in the capture JSON inherit navigation timing and must not be interpreted as independent page performance measurements. These are neither field Core Web Vitals nor a performance score.

## Redesign acceptance

Demonstrate history-to-mock-output in the hero; retain a clear signup CTA. Give the chart numerical scale, readable values and keyboard/touch inspection. Prioritize the result once data exists. Make sample onboarding prominent. Use a coherent distinctive typographic/grid system with readable controls at all three widths. Preserve truthful mock/uncertainty language, session behavior and tenant isolation. Verify accessibility, reduced motion, console/network issues and performance using actual rendered evidence.
