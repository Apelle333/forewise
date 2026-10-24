# Forewise — Fieldnotes design review

**Current public redesign:** [Forecast Horizon review](horizon/REVIEW.md) · [Current validation](horizon/VALIDATION.md). This page retains the earlier Fieldnotes review and product-screen evidence.

24 October 2026. Phase 01 / private local mock preview. Original identity, no purchased assets or new runtime visual framework.

## Deliverables

1. [Current-state visual and technical audit](CURRENT-STATE-AUDIT.md) — grounded in the running original app.
2. [Research](RESEARCH.md) — 19 source references, applications and explicit no-copy/limitations notes.
3. [Three art directions and selected system](ART-DIRECTION.md) — [rendered concept board](concepts.html), [A](concepts/a.png), [B](concepts/b.png), [C](concepts/c.png).
4. [Before/after comparison](COMPARISON.html) — public landing, product and mobile.
5. [Three critique / improvement passes and final QA](VISUAL-QA.md) — failures and corrections retained honestly.
6. [Final desktop landing](after/landing-1440.png), [tablet landing](after/landing-768.png), [mobile landing](after/landing-390.png).
7. [Final desktop workspace](after/workspace-result-1440.png), [tablet workspace](after/workspace-result-768.png), [mobile workspace](after/workspace-result-390.png).
8. [Project agent instructions](../../AGENTS.md) — durable research, design and QA requirements.

`before/`, `pass-1/`, `pass-2/`, `pass-3/`, and `after/` each contain 30 actual screenshot captures covering ten states at the three requested widths. The final set additionally includes actual service-failure evidence and the first-view marketing frame. They use synthetic data/accounts. Intermediate screenshots are diagnostic evidence, not approved final designs.

## Verified outcome

The original page presented a static miniature dashboard and a setup-first product. Fieldnotes gives Forewise a repeatable visual identity around the boundary between observed history and mocked continuation. Visitors can change synthetic series/horizon and inspect values. The product puts its chart first, provides numeric axes, keyboard/touch inspection and exact-value tables, and gives sample onboarding a prominent action. Auth, workspace isolation, CSV limits and the separate Python mock service remain in place.

All source-gate checks passed. Node/database: 14 tests. Python: 14 tests. Browser: 12 tests, including accessibility across three widths and six screenshot comparisons on a separate non-update run. No final capture overflow, page exceptions or request failures. npm/pip audits report no known vulnerabilities. Actual upstream failure and full-process recovery also passed. Exact local performance observations and remaining limits are in the QA log; no conversion increase or field performance gain is claimed.

Work continues on the existing private PR #1: https://github.com/Apelle333/forewise/pull/1. Owner review remains required. No merge, deployment, paid service or Timestral integration is authorized by this delivery.
