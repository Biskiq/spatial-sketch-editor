# R217.S13 — acceptance record: Drafting simplification

**AUTHORITY: NONE.** Status: **implemented; independent review pending**. This record claims no
review result and no merge. **Plan:** [implementation-plan.md](./implementation-plan.md) (owns the
criteria) · **Phase:** [R217](../README.md) · **Integration route:**
[R217.S11](../r217.s11-integrated-final-gate/acceptance.md)

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

The drafting cluster is `2D | 3D · Grid · Snap`, quiet on Paper. Scale's detents are `Zoom` entries
in Head Find and still use `scaleDetentIntent`; Fit, zoom in and zoom out (1.25 per press) are the
lower-right cluster. The ruler is a 1 px rule with two 5 px end ticks and its label below, Plan-only.
The Scale word, interval menu and ⚙ are gone from the shell; the Head's Viewing group no longer owns
a drafting value. PLATE's drafting and grid paragraphs and the milestone's Shell-coherence wording
are updated at this cutover.

## Verification

Tier: `affected-subsystem`; the integrated result remains owed to
[R217.S11](../r217.s11-integrated-final-gate/implementation-plan.md).

- `npm test`: **248 files / 3,188 tests passed**.
- `npm run test:arch`: **23 files / 194 tests passed**.
- `npm run check`: **0 errors, 0 warnings**.
- `stage-drafting.test.ts` pins the fixed state, the 0.5 m increment at every zoom, off/held
  independence and the one rounding/tie rule. `stage-grid.test.ts` pins only 1/5/25 m values, the
  16→8 fade and 8 px hide, the 25 m hand-off, the bounded/fitted/growing sheet, world anchoring and
  the line-count bound. `spatial-route-gesture.test.ts` pins Find detents, Fit/zoom intents, the
  Plan-only ruler, the fixed words, the quiet off states and the absence of the Scale/config
  disclosures. `stage-session.test.ts`, `layout-drawing-adapter.test.ts`, `scene-editing-surface.test.ts`,
  `shape-reading-adapter.test.ts` and `stage-host-tools.test.ts` cover the consumer seam.

Browser, Chromium at 1440 × 900 on the local editor, starter **Enclosed room**:

- Plan at Fit, four zoom-outs, six zoom-ins, ten more zoom-outs and eighteen zoom-outs show a
  crisp bounded sheet and fixed-value thinning across a wide projected range; no interval control
  changed and no value flickered. The observed far endpoint still shows 5 m; the 25 m hand-off and
  the ruler-only endpoint are proven numerically, not claimed from a still.
- The ruler is a line with end ticks and no fill in Plan, and absent in settled 3D. The `+`, `−` and
  `Fit` cluster is present in both readings and does not overlap the Height Sheet or lower column at
  this width.
- Head Find filtered to `Scale` lists `Zoom Scale 1:20 · 1:50 · 1:100 · 1:200 · 1:500`. The Scale
  word, interval menu and ⚙ are absent.
- Grid and Snap toggle to the words `Grid off` and `Snap off` on quiet Paper.
- Two free Walls, one drawn at Fit and one after two zoom-in presses, were downloaded from
  **Download source JSON** and preserved as [two-zoom-source.json](./evidence/2026-10-30-browser/two-zoom-source.json).
  The new Junction points are `-1.5,1.5`, `-1,1.5`, `-3,-2.5` and `-2,-2.5`; every coordinate is
  an exact multiple of 0.5 m, so the drawings share one lattice.
- D43 did not reproduce: the reading control answered on the first press and every later press.

Captures and byte hashes are in the [evidence record](./evidence/README.md).

## Evidence limits

One Chromium session at 1440 × 900; native touch, Safari, narrow-width collision calibration and the
integrated R217 journeys remain S11's. Mid-fade continuity and the exact 25 m hand-off are numerical
tests, not still frames. The starter's Room-floor fill covers the Paper grid inside the room; the
bounded sheet and its crisp edges remain visible around the work and were not treated as a new defect
in this slice. 3D clipping remains R217.S19.

## Residuals

No known defect for this slice. No waiver or deferred acceptance item is carried by this record.
