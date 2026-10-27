# Final validation — Forecast Horizon

2026-10-24. Local optimized build, Chromium on Windows. No production deployment.

- `npm run verify`: credential guard and all 11 checks passed: lint, formatting, Python lint/format, TypeScript, Node tests, Python tests, Python dependency consistency, production build, npm audit and Python audit.
- **15 Node/database tests, 14 Python tests, 22 browser tests = 51 passed.** One existing non-blocking TestClient deprecation warning remains.
- Browser suite ran without snapshot-update mode after the new 2D landing baselines had been captured and visually inspected. Operational workspace baselines were preserved.
- The intermittent scroll-canvas case passed three consecutive focused runs, then the full suite. Readiness is asserted after a rendered frame, not merely after appending a canvas.
- Actual 3D captures at 1440, 768, 390px; no document overflow or page exceptions in the tested public scenarios. Axe found no violations in the selected WCAG A/AA rules at these widths and in the existing empty/populated workspace tests. This is not an accessibility certification.
- Native keyboard sliders, exact scenario table, 2D/3D toggle and resource cleanup, concept navigation, unavailable WebGL, real context loss, reduced motion, and scroll unfolding exercised.
- Real register/upload/mock/export/persistence/workspace-switch/sign-out flow and API authentication, CSRF, tenant isolation, rate limits, invalid input and service contract checks passed.
- Local initial-paint sample: LCP 172ms, CLS 0.00000, transfer 206,489 bytes. The initial test finishes before the deferred renderer; it does not measure the full 3D cost.
- Separate sample **after 3D loaded**: resource transfer 341,501 bytes, navigation 180.2ms. **0 additional WebGL draw calls over the measured 350ms idle interval**, after settling. Total transfer stayed below the existing 500KB local budget.
- Built chunk containing Three.js identified by searching the generated JavaScript for `WebGLRenderer`; resource evidence shows that chunk among landing-only scripts and absent from the freshly loaded operational workspace. `workspace-resources.json` contains synthetic test resource identifiers only.
- No known vulnerabilities reported by the two dependency audits at run time.

The measurements are unthrottled loopback observations, not field Core Web Vitals, physical mobile-device measurements, FPS guarantees or a Lighthouse score. Safari/iOS, Firefox, real assistive technology and low-end physical GPUs remain unverified.

## Files changed

- `apps/web/app/page.tsx`, `app/horizon.css`, `app/explorations/page.tsx`: selected public composition and three working studies.
- `components/horizon-experience.tsx`, `horizon-renderer.ts`, `horizon-story.tsx`: optional spatial renderer, native controls/fallback, scroll narrative and finite motion.
- `lib/horizon-data.ts`, `tests/horizon.test.ts`: deterministic, disclosed scenario arithmetic and numerical checks.
- `apps/web/package.json`, `package-lock.json`: Three.js and development types.
- `e2e/horizon.spec.ts`, existing landing expectations and three landing baselines: rendered evidence and regression coverage. No workspace baseline changes.
- `AGENTS.md`, design review index and current review/evidence: permanent visual-quality requirements and honest limitations.

Next step: owner visual review of PR #1. No merge, real Timestral integration, payments or production changes.
