---
name: hallmark
description: Apply the pinned Hallmark design audit and polish workflow to Forewise while preserving its approved visual identity and existing functionality.
---

# Forewise Hallmark adapter

Read root `AGENTS.md` and `design.md`. Run `npm run design:setup` if `.data/tools/hallmark/SKILL.md` is absent, then read that upstream skill and only its relevant references. Pinned source/version is in `docs/design/hallmark/source.json`; this adapter does not replace the upstream instructions.

Default to an audit followed by scoped polish of confirmed findings. Preserve the approved Forecast Horizon / Fieldnotes identity, native data semantics, auth, all routes, handlers and test hooks. No new theme, full redesign, paid image generation, global install or edit-time hook unless explicitly requested. User instructions and the locked project design take precedence over conflicting third-party house rules.

Use `npm run design:audit` for raw static findings, `npm run design:render` against the actual local preview, and `npm run design:check` for the reviewed regression baseline. Report raw Hallmark findings separately from accepted design conflicts; a regression-baseline pass is not a raw Hallmark clean pass. Verify authenticated screens with the existing browser tests; a redirect to login is not a workspace audit.

Keep screenshots and raw reports in ignored local evidence folders. Preserve facts and synthetic-data disclosure. Use actual before/after renders, keyboard/reduced-motion checks and the project's verification suite. A Hallmark design review does not replace the independent Claude milestone review.
