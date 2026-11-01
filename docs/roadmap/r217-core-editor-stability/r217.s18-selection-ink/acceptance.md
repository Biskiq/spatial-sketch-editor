# R217.S18 — acceptance record: Selection ink

**AUTHORITY: NONE.** R217.S18 was accepted on 2026-10-31 at tested revision
`f92e1211` on `codex/r217-s18-selection-ink`, based on `main` `bf48c9da`. The
[phase slice register](../README.md#slice-register) owns status;
[R217.S11](../r217.s11-integrated-final-gate/acceptance.md) owns integrated campaign acceptance.
The plan's criteria are in the [implementation plan](./implementation-plan.md).

## Delivered

Selected geometry reads clearly in both readings. On Paper, a Scene subject (a primitive, a
catalogue model, an approved creator model, a native form or a Layout Opening's host-free
subject) carries a translucent fill from the footprint polygons that `paper-plan.ts` already
retains, under cut ink and above poché. The selection contour uses the `#74560c` Paper edge.

- Opacity is 0.22 in `paper-marks.ts` and 0.28 in `StageSelectionLayer.svelte`.
- `unionPaperFillPolygons` (`apps/editor/src/lib/authoring/stage/paper-fill-geometry.ts`) tints
  the union of a Scene subject's polygons as non-overlapping rings with holes. A tilted form is
  one projected triangle per mesh face, so raw polygons overlap and would blend twice. A single
  retained ring is drawn exactly. The union falls back to the raw polygons, and never throws, when
  the boundary cannot be stitched.
- One fill-polygon type, `PaperFillPolygons`. The stale selection comment in `createPaperMarkScene`
  is removed.
- The fill is never a hit source, never applied to an Opening as its host Wall, contour-only for a
  model with no footprint, and untinted on hover.
- `StageOverlay.svelte`'s 0.18 pick-candidate fill is pick UI, excluded by the plan ("Pick
  changes"), and was left untouched.
- No renderer change. The CPU union was chosen because the renderer has no stencil buffer.

## Review

Independent review (Opus 5.5) found one P2 and two nits, all fixed before the tested revision:

- P2: overlapping projected faces of a tilted form blended 2+ times, visibly darker than the
  rectangular form. Fixed by the CPU union above.
- Nit: stale selection comment in `createPaperMarkScene`. Fixed.
- Nit: one fill-polygon type. Unified as `PaperFillPolygons`.

Review outcome recorded for this revision: clean, with no open or withdrawn finding. The plan
decisions were verified as implemented: the opacities, the Paper edge, Scene fills reading the
retained polygons with no new footprint derivation, fill order, the Opening rule, the contour-only
model rule and untinted hover.

Owner instruction: combined acceptance-and-closeout, 2026-10-31. The independent review above is the
verdict for this revision. No prerequisite was waived.

## Verification at the tested revision

Tested revision: `f92e1211`. Product working tree identity: `git diff -- apps packages` sha256
`72f958ef825914edf544cd0539cc7e3fa4d25b1e2ffb08513aa9e792eb990c75`, identical before and after every
verification run. The slice plan declares `affected-subsystem`. The implementation-PR merge gate is
the full §7.4 contract, including `test:heavy`, per the [test manual](../../../../apps/editor/tests/README.md)
("What a change requires") and the [runbook](../../../operations/t1-spatial-world/README.md). The full
gate was run, so the tier was never narrowed.

| Command | Result |
| --- | --- |
| `npm run test:arch` | 23 files / 194 tests passed |
| `npm test` (complete suite) | 258 files / 3316 tests passed |
| `npm run test:heavy` | 11 files / 138 tests passed |
| `npm run check` | 2038 files, 0 errors, 0 warnings |
| `npm run build` | exit 0 |
| `npm run check:layout-core`, `check:project-model`, `check:camera-core`, `check:geometry-core` | exit 0 each |
| `npm run check:api` | exit 0 |
| `npm run test:api` (DB-backed, Docker Postgres) | 128 passed, 0 failed, 0 skipped |
| `git diff --check HEAD` | exit 0 |

The focused affected-subsystem run (`npx vitest run tests/lib/authoring`, 74 files / 938 tests
earlier in review) is iteration evidence and is superseded by the full gate above.

## Browser acceptance (plan §5)

Real Chromium through `agent-browser`, against the local stack: editor dev server on
`localhost:5173`, API on `localhost:8787`, Postgres in Docker. The *mixed* fixture
(`buildS17MixedProject`) was seeded through the server's real project and creator-import routes.
Subjects were selected through the Index. Plan and 3D were switched through the 2D/3D toggle.

- **Every subject in both readings at 1440 × 900:** the rectangular, concave and tilted forms; the
  0.75 m table and native box primitives; the catalogue floor model; the unverified catalogue model
  (excluded from the catalogue, present in the project); the approved creator model; the two
  Openings (door and window); the plinth object; the full-height room wall; the room floor; and
  the 0.9 m low wall (`wall-chain-3`, Stream `hidden`, Revealed `false`).
- **Overlaps and light walls on the dark mat:** the mixed fixture's overlapping outlines are drawn in
  Plan, and the 3D reading shows the walls on the dark mat.
- **Hidden subject:** the 0.9 m low wall is hidden at the 1.20 m cut, recorded in its Card.
- **Widths:** 1440 × 900 for every subject; 1280 × 800, 1180 × 820 and 820 × 1180 for the overview
  (Plan, with a Layout wall selected). No horizontal page overflow at any of them.
- **Console:** no errors or warnings in the session.

**Tilted-form comparison (the P2 fix).** Sampled fill interiors from the recaptured Plan shots at
1440 × 900 (RGB, mean of a patch clear of lines):

```text
rectangular form fill     (212, 207, 184)
tilted form fill          (212, 208, 184)
single blend (0.22)       (206, 201, 181)     expected for one fill
double blend (0.22 twice) (186, 176, 144)     the pre-fix defect
```

The tilted and rectangular fills match within one level, and both sit at the single-blend value,
not the double-blend value. A side-by-side crop confirms it by eye: the two fills have the same
tint strength.

Evidence (recaptured at `f92e1211`, existing file names, live under
`./evidence/`): `s18-form-tilted-plan.png` and `s18-form-tilted-3d.png`, plus the rectangular and
concave form pairs, the table and native box pairs, the catalogue, unverified-catalogue and
approved-creator-model pairs, the opening door and window pairs, the plinth pair, the full-height
wall pair, the low-hidden wall pair, the floor pair, and `s18-overview-1180x820.png`,
`s18-overview-1280x800.png` and `s18-overview-820x1180.png`. Every Plan shot has the light paper
background and every 3D shot has the dark mat, checked by pixel sampling.

## Residuals

- **Pinch case.** A stitched fill falls back to raw polygons when the boundary touches at a single
  point (a "pinch"). The fallback can show the overlap darkening again for that rare shape. The
  shape is not in the mixed fixture, and no reachable case in the browser run hit it. Owner: T1.
- **3D reading.** The Paper fill is a Plan-only mark. 3D shows the selection state, not a fill.
  The plan does not require a 3D fill.
- **Tilted Size ghost** and the tilted refusals are S17's unchanged scope.
- **Manual-owed rows, carried by S11 and unchanged:** coarse pointer, native touch, Safari, and the
  integrated journeys. S11 remains the final integration check after S25, not an S18 prerequisite.
- **Deferred to S11 journeys:** hover is verified by unit test (untinted). It is not browser-proved
  in this slice.
- **Owner-directed UX items** (shape-creation simplification, advanced working-plane controls,
  Pen/wireframe polish) remain outside S18.

## Routine closeout

Routine closeout on the same branch, with no production edit (see the preservation report below
once written), per the [slice-closeout skill](../../../../.agents/skills/slice-closeout/SKILL.md).
