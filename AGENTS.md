# Forewise working agreement

Applies to this repository and all descendant folders. Read this file at the start of future coding sessions; preserve the generated Next.js instructions in `apps/web/AGENTS.md`.

## Product and authority

- English-first general-purpose B2B forecasting. Phase 02B at `d460913` was approved for further development by the owner on 25 October 2026, with a reported independent Claude Code PASS. Current scope includes **Phase 03**, beginning with milestone **03A: forecast quality and calibration evidence**. Preserve Phase 02A security and Phase 01 identity. Commercial release, paid infrastructure, production deployment and merges remain outside scope.
- Work autonomously on reversible in-scope fixes, research, local testing, commits and pull requests. Do not require the owner to relay messages between agents/apps.
- No public production deployment, paid usage, confidential-data transfer, protected-main merge, destructive operation, business-model change or major infrastructure change without explicit owner authorization. Do not modify unrelated projects.
- Preserve server authentication, revocable sessions, membership checks, restricted-role transactions and PostgreSQL tenant RLS. Never trade isolation or input validation for a UI shortcut.
- Keep credentials, session state, datasets and local logs out of Git. Never send customer data to external design/generation services.

## Creative and engineering standard

- Before significant UI changes, inspect the live rendered app and research relevant primary examples. Document sources, what applies and what must not be copied.
- Think as creative director, product designer, frontend engineer, architect and independent QA. Challenge the composition, reading order, value proposition, data semantics and interaction clarity separately.
- Do not accept generic template-quality UI, unrelated component effects, fake social proof or decorative data. The selected public direction is Forecast Horizon (`docs/design/horizon/REVIEW.md`); preserve Fieldnotes for operational screens. Public visual exploration must compare three distinct working compositions, not palette swaps.
- Use shared tokens/components. Prefer original CSS/SVG and small client boundaries over new runtime libraries. Check license/security before adding dependencies. Keep all user-facing copy in plain English.
- Label synthetic examples and mock results clearly. Do not invent accuracy, confidence intervals, validated business outcomes, pricing, demand, clients or testimonials.
- Spatial scenario art is an explicitly synthetic illustration. A cone is not a probability distribution: disclose the construction, show matching values and never imply calibration, coverage or likelihood without evaluated model evidence.
- Keep public synthetic demos separate from the Phase 02A statistical baseline. Backtesting is historical evaluation, not business validation; absent evaluation must be null with a warning, never a fabricated zero or calibrated interval.
- All job API business queries use authenticated `asUser` transactions. Dataset/result references must preserve workspace identity. Workers commit claims before computing, renew bounded leases and fence every completion/failure/heartbeat by job, execution token and live lease. Persist results and job completion atomically; stop after three attempts.
- Keep WebGL optional and local to public storytelling. Provide server-rendered 2D content, native controls and a table; respect reduced motion, handle unavailable/lost WebGL, dispose GPU resources and stop rendering at rest/offscreen. Do not import the renderer into operational routes.
- Judge the rendered composition at desktop, tablet and mobile sizes. The first fold must establish a clear visual signature; motion must clarify the transition from history to scenarios. Do not call a build cinematic because a library is installed or a canvas exists.
- Read numeric data correctly: signed/constant ranges, readable axes, exact values, keyboard/touch inspection and an accessible alternative. Never use visual effects to imply unsupported certainty.

## Required quality loop

- After significant frontend changes: build, open a real browser, capture 1440/768/390px screens, critique, improve and retest. Never claim visual verification from source code alone.
- For substantial redesigns, complete at least three explicit observation/change/retest passes when browser access works. Document the weakest elements and actual corrections in `docs/design/VISUAL-QA.md`.
- Check empty/loading/success/validation/error states; keyboard focus; reduced motion; accessibility; responsive overflow; console/network errors; and measured performance. Distinguish simulated faults and local measurements from field evidence.
- Run `npm run verify`, then start the newly built local preview and run Playwright functional/visual tests. Keep screenshot baselines deterministic and inspect them before approving updates. A passing test is not proof of excellent design or complete security.
- Fix demonstrable problems autonomously within scope. Document unresolved issues truthfully. Do not claim external/blocked browser pages were inspected.
- Update design decisions, progress and limitations; commit to an appropriate development branch and prepare/update the PR. Stop at each Phase 03 milestone for independent Claude review, without automatic merge or commercial release.

## Scope and reading discipline

Inspect only task-relevant files. No unrelated scans or architectural rewrites. Audit/test tools may inspect this repository's relevant source and dependencies. Intermediate logs/private state belong in ignored `.data/`; user-facing design evidence belongs in `docs/design/`.

## Hallmark integration

The owner explicitly requested Hallmark. Use the pinned project adapter in `.agents/skills/hallmark/SKILL.md` (Claude adapter: `.claude/skills/hallmark/SKILL.md`) and preserve root `design.md`. `npm run design:check` blocks new static findings against a reasoned baseline; it does not certify raw Hallmark compliance. `npm run design:render` checks actual public/auth routes. Use authenticated Playwright tests for workspace rendering. Never replace the independent Claude milestone gate with a Hallmark/Codex design review.
