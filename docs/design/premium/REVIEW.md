# Premium interactive experience

27 October 2026. Development milestone; independent Claude review remains required.

## Scope and decisions

Extend Forecast Horizon and Fieldnotes in place. No model, API, schema, authentication, RLS, worker or payment changes. The public scenario is synthetic and has no assigned probabilities; operational Timestral quantiles retain their existing meaning.

The implementation sequence was baseline verification and before screenshots, bounded deterministic Horizon motion, a server-rendered pipeline instrument, file-entry feedback, then browser critique and correction. Two scoped subagents implemented the instrument and onboarding; the parent integrated and verified them. Both provided a separate read-only critique afterwards.

- Horizon: inspect exact historical/future dates, show/hide illustrative range, pause/play/reset optional camera and trace motion, retain analytical 2D view. Values never animate. A pure 12-second clock and seeded trace positions replace incremental rotation. Pose changes ease from an explicit snapshot over 360 ms; steady playback renders at most approximately 30 times per second. Visibility suspends the clock and drawing. Idle drawing stops. Resource disposal and DPR cap remain.
- Pipeline: six native disclosures select assemblies on one original isometric SVG instrument. Data, validation, model, forecast, review and export explanations describe existing functionality. No live processing simulation or invented accuracy. No client JavaScript is added for the instrument. See [construction and interaction](INSTRUMENT.md).
- File entry: real CSV/XLSX drop, keyboard-accessible native chooser, busy/drag feedback, file identity and preview count, explicit column/frequency confirmation and same-column prevention. A selected file uses a compact mobile drop area. Existing validation and persistence contracts remain.

## Actual critique and corrections

1. Desktop first render: controls below the scene obscured animation feedback; moved play/reset beside the scene's 2D control. Instrument captions/previews were small/faint; increased readable text sizes and neutral geometry contrast. Screenshots: `.data/premium/pass1-*.png`.
2. Mobile/browser pass: all seven new interaction cases passed, including no JavaScript and real drops. The independent critique identified excessive file-entry height; compacted the selected-file area and removed its repeated limit line on mobile. Added a keyboard test for reaching and changing frequency. Six new Hallmark findings were corrected in the instrument, with no new baseline exemptions. Two existing fallback tests needed precise status selection because the new semantic output correctly introduces another status region.
3. Final pass: verify revised desktop/tablet/mobile rendering, WebGL loss, playback pause/reset and offscreen suspension, native disclosures, frequency reachability, ingestion/inference/export regressions and production build. The separate source critique found an inaccurate paused hint during playback; corrected it to follow the actual playback state. Final results and evidence are recorded below after execution.

## References and provenance

Consulted local Anatomy craft/server-rendering guidance and original geometry examples, the existing pinned Hallmark adapter, and 21st UI review/build guidance. Existing Forewise tokens are authoritative. No new dependencies, global hooks, paid generation or external runtime services were introduced.

Public inspiration inspected: [Motion in Design](https://www.motionin.design), [60fps](https://60fps.design), [Recent, redirected from Godly](https://recent.design), [21st](https://21st.dev), and [Anatomy source](https://github.com/wheresryan22/anatomy). Applied explicit time and visibility-aware motion, restrained input feedback and coherent instrument construction. The Internet Designs could not be reached; no inspection is claimed. The 21st CLI was unavailable; no generated catalog component or paid API was used.

## Limitations

The illustration is an explanatory metaphor, not a measured physical model. Its mobile drawing is an overview; readable stage controls and descriptions provide the details. No CAD/mesh geometry audit is claimed. Native grouped disclosures and CSS `:has` enhance supported browsers; older browsers retain static geometry and native disclosure content. Browser automation checks Chromium on local Windows, not a physical touch device or field Core Web Vitals. Smoothness on low-end GPUs remains unmeasured; 2D stays available and reduced motion defaults to it.

Existing out-of-scope Phase 03B review findings remain: malformed numeric XLSX XML handling, cancellation/workspace callback race, and omission of empty metadata containers in export. This visual milestone does not resolve or approve those findings. Calibration limitations also remain; no candidate calibration was shipped.

## Browser evidence and measurements

The final full Chromium suite completed with **51 passed, zero failed, zero skipped**. This includes actual CSV and XLSX onboarding, genuine pinned Timestral 209M worker inference, native quantiles, authorized persisted retrieval, baseline worker flow, cross-tenant API denial, bounded retries, signed chart values, six visual snapshot comparisons, reduced motion, WebGL startup failure/context loss, route cleanup and all seven new interaction cases. Initial runs exposed five ambiguous status locators after accessible live feedback was introduced; these were corrected to select the intended success/fallback status, preserving the underlying assertion. The complete suite then passed without snapshot-update mode.

Screenshot comparisons deliberately updated only the three public landing baselines, after inspection. Existing workspace baselines remain unchanged. Historical screenshot folders are retained as their original milestone evidence; new captures live here.

- Before/after full pages: [desktop before](before-1440.png), [desktop after](after-1440.png), [tablet before](before-768.png), [tablet after](after-768.png), [mobile before](before-390.png), [mobile after](after-390.png).
- Close views: [desktop instrument](instrument-1440.png), [mobile instrument](instrument-390.png), [mobile scene controls](stage-390.png), [timeline inspection](inspection-390.png), [file preview](file-entry-xlsx-390.png), [keyboard frequency selection](file-frequency-xlsx-390.png).
- [Local render measurements](render-measurements.json): 353,743 transferred resource bytes at each measured viewport, no horizontal overflow or page errors. The prior committed baseline reported 334,767 bytes: +18,976 bytes, approximately 5.7%. These are single local observations, not controlled field performance estimates.
- [Idle draw observation](performance-3d.json): zero additional indexed WebGL draw calls during the settled 350 ms observation; the existing test also enforces less than 500 KB transfer. [Workspace resources](workspace-resources.json) confirm the operational workspace does not load the Horizon renderer. Pure motion tests compare identical seeded positions, paused/resumed time and 100,000 full periods; this proves deterministic calculation, not long-duration hardware stability.

Hallmark executed all four required targets and produced 20 dimension/hash-checked PNGs using Chrome 156's platform-default sandbox. [Manifest](hallmark/manifest.json), [browser preflight](hallmark/browser.json), and raw reports [home](hallmark/target-1.json), [explorations](hallmark/target-2.json), [register](hallmark/target-3.json), [login](hallmark/target-4.json) are preserved. Static regression checking reports **zero new findings and 44 retained existing findings**; this is not raw Hallmark compliance. Rendered opinion findings remain visible, including the long scenario section treated as a hero, legacy button sizing/grouping, and the intentional SVG instrument flagged by rule 80. The latter is the requested explanatory drawing and has accessible text disclosures; it is not substituted for real charts or data. No accessibility rule or baseline was weakened to obtain a pass.

## Launch and review

The final `npm run verify` completed all **13 checks** successfully: lint, format, static Hallmark regression, Hallmark positive/negative tests, Python lint/format, typecheck, unit tests, Python tests, dependency consistency, production build and dependency audits. Counts: **58 Node tests, 55 Python tests, 20 Hallmark parser/gate tests and 12 installer integrity tests**, zero failures/skips. PostgreSQL and genuine Timestral integration were enabled; verification used a temporary isolated PostgreSQL database, removed afterwards. [Machine-readable checks](verification-results.json), [source-gate output](source-gate.log), and [full browser output](browser-results.log) preserve the results. Dependency auditing reports no known vulnerabilities in auditable dependencies; the pinned Timestral Git-source dependency is not available on PyPI and is explicitly outside that advisory check.

From the repository, with its existing Python environment and PostgreSQL configuration: `npm run build` then `npm run preview`; open `http://127.0.0.1:3000/`. `npm run dev` starts development mode. The asynchronous forecasting worker remains a separate process, as documented in the project README. No production deployment, merge or Phase 04 work occurred.

Changed source is confined to Horizon experience/renderer and its pure motion helper, the new instrument and scoped styles, onboarding feedback, page/style imports, audit source inclusion and regression tests. No dependency manifest, forecasting algorithm or database file changed. The visual milestone is ready for independent Claude review once the final source-gate evidence is attached; it does not confer Phase 03B or commercial acceptance.

Published implementation commit: `fbd2a0d0f497d078532f6bff776a5f082d3b1e3d`. The rendered audit was repeated after this commit; the preserved manifest records that exact source revision and all four successful targets. Subsequent evidence commit changes documentation/reports only. [Draft PR #7](https://github.com/Apelle333/forewise/pull/7) targets the existing Phase 03B branch, isolating the visual work. GitHub Actions is a separate remote check; local passing results above are not presented as a verified CI conclusion.
