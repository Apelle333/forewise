# Three directions and selection

Original rendered sketches: [concept board](concepts.html), with screenshots in `concepts/`. These are exploratory compositions, not forecasts or production screenshots.

|               | A — Fieldnotes                                                                         | B — Signal room                                                       | C — Horizon atlas                                                                           |
| ------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Identity      | An editorial instrument: measured but human                                            | Precise decision terminal                                             | A spatial landscape of possibilities                                                        |
| Type          | DM Sans display/body, Georgia italic punctuation, mono folios                          | Monospace labels and compact grotesk                                  | Broad serif headlines, airy humanist body                                                   |
| Color         | Warm paper, carbon, burnt vermilion                                                    | Midnight, icy cyan, neutral white                                     | Ice blue, cobalt, pale gray                                                                 |
| Layout        | Asymmetric editorial lead, wide plot, ruled sections                                   | Dense split panels and command inspector                              | Immersive full-bleed contour scene, progressive reveal                                      |
| Motion        | Short finite line reveal; boundary responds to horizon input                           | Immediate crosshair movement; keyboard-first                          | Perspective-to-flat transition                                                              |
| Data language | Explicit axes, history and dashed mock, readable inspector                             | Dense analytical marks and coordinate readouts                        | Contours flatten into the underlying time series                                            |
| Signature     | The horizon boundary, a measured break between history and mock                        | Address any point with a keyboard                                     | Change viewpoint to reveal the series                                                       |
| Critique      | Must not become another cream-and-serif landing; make the chart the actual centerpiece | Distinct but feels specialist/trading-oriented for nontechnical teams | Memorable, but depth suggests uncertainty the mock cannot quantify; more bundle/motion cost |

## Selection: Fieldnotes

Fieldnotes best reconciles distinction, nontechnical clarity, feasibility and commercial credibility. It makes forecasting's actual structure visible: observed history, a chosen horizon, then an explicitly mocked continuation. A narrow vermilion boundary and dashed continuation become a repeatable brand device. The public hero is a live, deterministic demonstration rather than a picture of dashboard chrome. The working product prioritizes the series and keeps setup in a quieter rail.

Signal room is rejected because precision risks becoming intimidation. Horizon atlas is rejected because spatial surfaces would add ambiguity and motion cost without improving this daily univariate preview. No confidence interval is fabricated: the interface explicitly states that the mock has none.

## Design system

- Paper `#f3f0e8`, surface `#fffdf8`, carbon `#282a25`, muted `#66695f`, rule `#d4d2c7`, accent `#ad4228`, soft accent `#f4e4da`. Accent text on paper is checked by axe; status always includes text, not color alone.
- Display: DM Sans Variable, negative tracking, asymmetric line breaks. Occasional Georgia italic carries a semantic contrast, not every heading. Body 15–16px, helper text at least 12px, mobile fields 16px. Tabular numerals in metrics/axes.
- Spacing scale: 4/8/12/16/24/32/48/64/96px. One-pixel rules organize space; corners 2–6px, no sea of rounded cards. Bounded shell with generous margins and a compact product rail.
- Reusable primitives: Brand mark, Button classes, Badge, chart frame/legend/readout, panel headings and state notices. Original SVG marks and standard CSS; no new runtime visual library.
- Finite entrance/line changes only. No looping chart animation, fake live feed, parallax, background video or WebGL. Reduced-motion disables animation and smooth scrolling. All chart interaction has native keyboard/touch controls and a table alternative.
