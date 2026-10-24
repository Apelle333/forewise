# Forecast Horizon — visual exploration and implementation

2026-10-24. Phase 01, local mock preview. Continues `c5f925e` on `codex/phase01-review`, PR #1. No real Timestral, billing, deployment or merge.

## Starting evidence

Confirmed the local checkout was clean and matched the remote head. Opened the actual Fieldnotes landing in the in-app browser. Its editorial hierarchy and precise chart worked, but the chart was separate from the proposition and offered little spatial identity. The screenshot captured in this session is included with the handoff; the original Fieldnotes evidence under `../before/` is historical, not a new capture.

GitHub connector access returned 404. Git access and a read-only GitHub API request using the existing Git credential confirmed PR #1 was open at the stated head. No credentials were written to files or printed.

## Three working directions

| Direction | Composition and interaction | Assessment |
| --- | --- | --- |
| Forecast Horizon | Asymmetric mint-on-black editorial lead, historical trajectory opening into a translucent spatial scenario sleeve, pointer parallax and horizon/spread controls | Selected: best connection between product meaning and visual signature; timeline reads left to right |
| Signal Observatory | Centered uppercase violet instrument, radial time rings, angular scenario paths | Distinct and compact, but time is less intuitive and the specialist instrument language feels narrower |
| Tidal Atlas | Warm copper landscape, split heading and introduction, cross-linked scenario ridges | Tactile, but the surface can imply an extra measured dimension; harder to compare individual paths |

All three are real local demos under `/explorations?direction=horizon`, `observatory`, and `atlas`, with screenshots `concept-*.png`. They share a small rendering engine and deterministic scenario source; their geometry, composition, palette and time framing differ. They are not three production products. Prototype alternatives use the canonical timeline in 2D mode.

## Research and library decision

Primary references, accessed this session:

- [Three.js examples](https://threejs.org/examples/#webgl_lines_fat): inspectable spatial line work; use data-derived geometry rather than an unrelated rotating object. [Three.js manual](https://threejs.org/manual/#en/cleanup): explicit resource ownership and disposal.
- [React Three Fiber performance guidance](https://r3f.docs.pmnd.rs/advanced/scaling-performance): render on demand, cap pixel density and avoid an idle game loop. Applied the principle with direct Three.js.
- [Drei ScrollControls](https://drei.docs.pmnd.rs/controls/scroll-controls): a useful abstraction for larger R3F scenes. Avoided a second scroll container and scroll interception here.
- [Motion scroll animation](https://motion.dev/docs/react-scroll-animations): distinguishes scroll-linked from scroll-triggered motion. Native scroll events drive scene reveal; CSS view timelines progressively enhance text position.
- [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/): powerful timeline and pinning system; unnecessary for one short sequence with native sticky positioning.
- [Apple AirPods Pro](https://www.apple.com/airpods-pro/): research into focused chapters and a single central product narrative. [Linear](https://linear.app/): concise product framing and a working-product transition. These pages were read as primary content references; no pixel-fidelity or visual-copy claim is made.

Registry metadata checked: Three.js 0.186.1, R3F 9.8.2, Drei 10.7.9, Motion 14.6.0, GSAP 3.15.0. Three.js/R3F/Drei/Motion report MIT; GSAP reports its standard no-charge license, not MIT. Only Three.js and its development types were added. Direct Three.js keeps a single imperative scene outside React's render cycle; R3F/Drei add no necessary abstraction for this bounded scene. CSS transforms alone cannot provide genuine depth projection. Canvas 2D would require a custom projection engine. The operational chart remains its existing accessible SVG.

## Implemented experience

1. Hero: one composition combining large type, a historical trace, bright origin, a scenario sleeve and a clear action. Native horizon/spread sliders update both the scene and exact table.
2. Scroll story: on desktop, a sticky study retains history while scenario paths unfold and acquire depth. Rendering stops when settled or offscreen. Mobile and reduced-motion readers get the complete text without this secondary canvas.
3. Working example: the original inspectable demand/revenue/capacity chart, mock horizon, table and units remain available on a light analytical surface. Dashboard, auth, upload, service and database behavior are preserved.
4. Alternatives: dedicated, linked local exploration page with all three studies and candid selection rationale.

## Scientific contract

Synthetic September–October 2026 data only. The center repeats the last observed week. For day `d` and scenario `s` between −1 and +1, the displayed value is `weeklyRepeat(d) + s * spread * d / 28`. The paths are constructed, evenly spaced scenarios, not sampled probabilistic forecasts. The volume has **no assigned probabilities, calibration, coverage or predictive validity**. Depth separates paths and does not encode another measured variable. The 2D illustration and native table expose the same scenario values. No real model call or confidence interval was added.

## Three critique/correction passes

1. **Volume and legibility.** Initial rendered wire work was too thin and read as a detached graph. Increased path contrast, added an extremely light scenario sleeve, historical points and cross-sections; replaced abrupt pointer movement with finite damped camera motion. Retested actual 3D at all three widths.
2. **Composition and contrast.** Desktop imagery sat too low in the first fold. Integrated the selected scene beside/below the lead while keeping tablet/mobile vertically composed. Axe caught low contrast caused by chapter fade opacity: removed opacity animation and retained a small translation. Retested; no tested-rule violations remained.
3. **Fallback and interaction.** Inspected deterministic 2D baselines: illustration annotations collided with axis labels, and reduced-motion storytelling kept excessive vertical gaps. Hid duplicate 3D annotations in 2D and compacted the static chapters. Full-suite testing found the scene intercepted a heading click; restored pointer handling for selectable lead text. A new frame-readiness assertion exposed an intermittent blank sticky canvas. Rendering now checks current viewport bounds rather than depending only on cached observer visibility; evidence waits for an actual rendered frame. Cross-sections now appear only after their day is revealed, and the small desktop study uses a desktop camera distance. Final retest results are recorded in `VALIDATION.md`.

## Implementation boundaries

Public-only CSS is scoped beneath `.horizon-page`. The renderer is an asynchronous import, with a server-rendered SVG present before it loads. The 800ms defer does not delay text or controls. Reduced motion defaults to 2D; explicit 3D opt-in remains static. Missing WebGL/import errors and context loss retain usable 2D controls/table. Both scenes dispose geometry/materials, listeners, observers and renderer resources. Pixel ratio is capped at 1.5. No texture/model/video downloads or additional animation runtime.

## Limits

The visual selection is design judgment, not a user-research result. Chromium on Windows at desktop/tablet/mobile viewport sizes is not physical-device, Safari/iOS, Firefox or assistive-technology certification. Local unthrottled measurements are not field Core Web Vitals or a Lighthouse score. Mock forecasting remains unsuitable for real business decisions. The existing non-blocking Python TestClient deprecation warning is retained.
