# R217.S13 — acceptance record: Drafting simplification

**AUTHORITY: NONE.** R217.S13 is shipped. The phase [slice register](../README.md#slice-register)
owns status. **Accepted 2026-10-30** after a fresh independent review returned **CLEAN** at
`71c058e0`; three non-blocking P3 wording nits were corrected after that verdict without changing
behaviour, and no P0–P2 finding remains. **Plan:** closed stub
[implementation-plan.md](./implementation-plan.md) · **Phase:** [R217](../README.md) · **Integration
route:** [R217.S11](../r217.s11-integrated-final-gate/acceptance.md)

## Implementation

The drafting seam is fixed and has one owner. `stage-drafting.ts` names `GRID_MINOR_METERS = 1`,
`GRID_MAJOR_METERS = 5` and `DRAFTING_SNAP_METERS = 0.5`; `StageDraftingState` is now only Grid,
Snap and the temporary Alt/Option hold. `draftingSnapIncrementMeters(state)` takes no zoom input and
returns 0.5 or `null`. The interval mode, selected minor, `GRID_MINOR_CHOICES`, the ladder validator
and `drawnGridMinorMeters` are removed. Every consumer — Layout Ink, Scene Place/Move/form marks,
Measure, Height stepping and typed Scene entry — reads the fixed increment through the same seam.

`stage-grid.ts` draws only 1 m and 5 m levels. Each level is fully inked at 16 CSS px spacing, fades
from 16 to 8 and hides below 8; a 25 m level appears only while 5 m is hidden and obeys the same rule.
The lattice stays anchored to world zero. Paper's rectangle is now a bounded sheet: the Layout ∪
Scene datum bounds plus 5 m, rounded outward to 5 m, or 20 × 20 m around the target for an empty
project, intersected with the visible coverage. The mat keeps its corner-ray footprint. Fit and the
sheet share one `readStageContentBounds` read in the route.

The drafting cluster is `2D | 3D · Grid · Snap`, quiet when the Paper appearance is visible. Scale's detents are `Zoom` entries
in Head Find and still use `scaleDetentIntent`; Fit, zoom in and zoom out (1.25 per press) are the
lower-right cluster. The ruler is a 1 px rule with two 5 px end ticks and its label below, Plan-only.
The Scale word, interval menu and ⚙ are gone from the shell; the Head's Viewing group no longer owns
a drafting value. PLATE's drafting and grid paragraphs and the milestone's Shell-coherence wording
are updated at this cutover.

## Verification

Tier: `affected-subsystem`; the integrated result remains owed to
[R217.S11](../r217.s11-integrated-final-gate/implementation-plan.md).

- `npm test`: **248 files / 3,189 tests passed**.
- `npm run test:arch`: **23 files / 194 tests passed**.
- `npm run check`: **0 errors, 0 warnings**.
- `stage-drafting.test.ts` pins the fixed state, the 0.5 m increment at every zoom, off/held
  independence and the one rounding/tie rule. `stage-grid.test.ts` pins only 1/5/25 m values, the
  16→8 fade and 8 px hide, the 25 m hand-off, the bounded/fitted/growing sheet, world anchoring and
  the line-count bound. `spatial-route-gesture.test.ts` pins Find detents, Fit/zoom intents, the
  Plan-only ruler, the fixed words, the off words, the strike-through rule, ruler centring and
  the palette-lift clearance, and the absence of the Scale/config disclosures. `stage-session.test.ts`, `layout-drawing-adapter.test.ts`, `scene-editing-surface.test.ts`,
  `shape-reading-adapter.test.ts` and `stage-host-tools.test.ts` cover the consumer seam.

Browser, Chromium at **1440 × 900, 1280 × 800, 1180 × 820 and 820 × 1180** on the local
editor, starter **Enclosed room**:

- The full zoom range was used: the zoom-in limit reads `0.005 m` on an 81 px rule and the
  zoom-out limit reads `100 m` on an 81 px rule. At the far endpoint the bounded sheet is smaller
  than one 25 m interval, so the ruler is the only visible reference; no interval control changed
  and no value flickered. The exact 25 m hand-off at its fade threshold remains numerically proven.
- The ruler is a line with end ticks, its distance centred below, and no fill in Plan. It is absent
  in settled 3D and in Experience. The `+`, `−` and `Fit` cluster is present in Plan and 3D in the
  World lens and absent in Experience. Measured boxes at all four required widths, including with
  the Ink palette open, show no overlap between the ruler, zoom cluster, Height Sheet, dock, palette
  or Index; at 1440 × 900 palette-open the cluster's right edge is 3.6 px left of the Sheet.
- Head Find filtered to `Scale` lists `Zoom Scale 1:20 · 1:50 · 1:100 · 1:200 · 1:500`. The Scale
  word, interval menu and ⚙ are absent.
- Grid and Snap toggle to the words `Grid off` and `Snap off` in Plan and 3D. Both off words
  computed as `text-decoration-line: line-through` and `opacity: 0.5`; the 2D/3D segmented control
  kept its own selected treatment. This Plan appearance uses the dark chassis ink, so no quiet
  Paper claim is made.
- Compared with the wireframe's [2D capture](../post-s10-convergence/evidence/prototype-2d-1440.png),
  the cluster, lower-left ruler and lower-right zoom/Fit furniture match in structure; the
  remaining differences are PLATE calibration, not a drafting-value or layering difference.
- Two free Walls, one drawn at Fit and one after two zoom-in presses, were downloaded from
  **Download source JSON** and preserved as
  [two-zoom-source.json](../../../archive/roadmap/r217-core-editor-stability/r217.s13-drafting-simplification/evidence/2026-10-30-browser/two-zoom-source.json).
  The new Junction points are `-1.5,1.5`, `-1,1.5`, `-3,-2.5` and `-2,-2.5`; every coordinate is
  an exact multiple of 0.5 m, so the drawings share one lattice.
- D43 did not reproduce: the reading control answered on the first press and every later press.

Captures and byte hashes are in the [archived evidence manifest](../../../archive/roadmap/r217-core-editor-stability/r217.s13-drafting-simplification/evidence/2026-10-30-browser/CLOSED.md).

## Evidence limits

One Chromium session at the four required widths; native touch, Safari and the integrated R217
journeys remain S11's. Mid-fade continuity and the exact 25 m hand-off are numerical tests, not
still frames. Capture 09 predates the final shell visual and is retained only for the two-zoom
drawing; the lattice claim is carried by its source JSON. The starter's Room-floor fill covers the
Paper grid inside the room; the bounded sheet and its crisp edges remain visible around the work and
were not treated as a new defect in this slice. 3D clipping remains R217.S19.

## Residuals

No known defect for this slice. No waiver or deferred acceptance item is carried by this record.

## Closeout preservation — R217.S13 (2026-10-30)

```text
prose compacted:                 1   approved plan -> stub at its own path
reference promotions:            0   PLATE and the milestone were updated at implementation cutover
renderable evidence archived:    14 files / 890,250 bytes
evidence stubs / manifests:      1   archive CLOSED.md + live evidence pointer
                                 (source JSON archived alongside, 6,909 bytes)
transient artifacts removed:     0
historical anchor:               050a30d9418a9a910a320388ae2ea4d879f1b34c · tag closed/r217.s13
new live -> archive prose links: 0   evidence links point at the manifest and source JSON
manual-owed verification rows:   0
remaining deferred items:        0 known defects; S11 integrated journeys only
permanent stubs added:           1   the closed plan
```

P1 merge required (PR #232). After merge, verify the historical anchor is an ancestor of `main`,
inspect the recovery path with `git show <anchor>:<path>`, and confirm the tag target retains the
anchor. The branch head is deliberately not pinned here because this PR's merge will change it.
