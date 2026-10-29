# R217.S07 — acceptance record: Selection, hover and the mark layer

**Slice:** R217.S07 · **Status:** implemented on the S04-merged tree; combined independent review
complete; ready-to-merge PR pending · **Plan:**
[implementation-plan.md](./implementation-plan.md) (owns the criteria, as amended by the owner
rulings and the as-built notes below) · **Phase:** [R217](../README.md) · **Integration route:**
[R217.S11](../r217.s11-integrated-final-gate/acceptance.md)

Base revision `757a927f` (S04 Paper merged, PR #223) plus the S07 branch commits. The branch is
committed locally and not pushed; this record claims only the checks listed at the end. It is not
a slice acceptance, and no release-list row is claimed (the owner waived registration).

## Implemented

- One **shared mark layer** on Stage: admitted descriptors, projection through the one
  `ViewportEvaluation`, descriptor-order hit testing, disclosure state and the 22 px / 44 px
  fine / coarse areas.
- **Selection and hover ink**: gold `#d4ad45` identity contour and a 0.18 tint for the primary
  selection on the mat; a gold union-boundary re-stroke over the mark halo on Paper; neutral
  `#F3F4EE` edge-only hover that is never gold and never drawn for the selected subject.
- **Paper integration**: selection/hover ink is a filter over S04's own `buildPaperPlan`
  (`paper-marks.ts`), keyed by the canonical Layout subject id or Scene `entityId`. Filled
  subjects use `unionOutline`, so a Wall compiled as many solid spans re-strokes its outer
  boundary instead of a tick per shared span edge. Marks live on layer 2, are depth-test-free,
  order above `PAPER_LAYER.sceneFootprint`, and never write `Object3D.visible`. The mat's mesh
  ink and Paper's re-stroke are mounted exclusively.
- **Layout migrated**: the selected Wall and Opening publish descriptors instead of the three
  CSS-point handles. Wall length, rigid move and Opening offset/width are direct marks; Wall
  angle is the Card's writer only. Every mark submits the same planner and refusal the Card
  field does, with one history entry per release.
- **Typing at a gesture** reuses `plan-numeric-entry.ts`: digits open the tag input, Enter
  commits once, the first Esc restores, the second cancels, blur never commits.
- **Removed**: the placeholder `selectionMarker`, the `layout-wall-start` /
  `layout-wall-end` / `layout-wall-body` overlay ids, and the Wall angle ring (see below).

## Round 2 reconciliation — selected Wall (2026-10-29)

Compared the selected-Wall state with the owner-ratified Round 2 wireframe's
`index.html?atlas=wall-rays` frame ([wireframe README](../../../../prototypes/production-shell-wireframe/README.md),
[ratification](../../../reference/decisions/production-shell-round-2-ratification-2026-10-23.md))
and with the [spatial-instrument grammar](../../../reference/design-system/spatial-instrument-grammar.md#rays-and-points).

Evidence: [wireframe frame](./evidence-round2-wireframe-wall-rays.png),
[3D Stage](./evidence-wall-marks-calibrated-3d.png), [base close-up](./evidence-wall-marks-closeup.png),
[Paper selected Wall](./evidence-paper-wall-selected.png),
[Paper Wall close-up](./evidence-paper-wall-closeup.png),
[Paper selected Room](./evidence-paper-room-selected.png),
[Paper neutral hover](./evidence-paper-hover-neutral.png).

**Before.** A 7 m Wall drew a 410 px length ray over its own base edge, a 1.2 m angle ring
(about an 80 px projected radius) and a 262 px one-way move track. The cause was treating a
descriptor's world `extent` as the drawn length. The wireframe's marks are 9–38 px and stay
that size from a plinth to a roof.

**After.** The selected Wall now shows two endpoint points, one compact length ray at the free
end and one compact two-way base move ray. There is no ring and no long ray. On Paper the same
identity is a gold union-boundary contour with a quiet 0.18 tint; the per-span cut bands do not
produce internal ticks. The selected Room fills gold under the same contour, and a hovered
neighbour is a restrained light contour with a dark halo.

## Owner rulings (2026-10-29)

These are the final decisions for S07 and supersede the earlier plan where they differ.

1. **Remove the Wall angle ring.** It is not part of the ratified Wall vocabulary and competed
   with the geometry. Its visual and hit target are removed entirely. The `layout-wall-angle`
   planner and the Card's Angle field are unchanged; no replacement gizmo was invented.
2. **Keep the compact length ray**, anchored at the free endpoint, beside the two endpoint
   points.
3. **Keep the two-way base move ray**, with both arms interactive.
4. **Accept screen-calibrated marks**: 30 px rays, ±16 px move arms and 22/44 px fine/coarse
   hit areas. World-space `extent` is distinct from the drawn glyph.
5. **Keep edge-on withholding** where a mark would communicate a misleading direction.
6. **Defer height and thickness grips.** They need gesture/numeric-host capabilities beyond
   S07. Wall thickness remains a Card field. The Card currently shows it as a top-level row;
   grouping it under More is Card work outside S07 and is **not** landed by this slice.
   (The owner's destination remains More; this record does not claim it exists.)
7. **Keep the selection tint at 0.18** pending integrated visual evaluation with S04.

**Explicit departure from the approved plan.** Plan §4.4 listed an Angle ring at the fixed end.
The ruling above removes it. The angle remains editable through the Card, which submits the
same `layout-wall-angle` planner and retains its refusals. The plan's stop condition (a mark
needing a planner change) was not triggered; no planner or domain contract changed. Height and
thickness are likewise deferred by ruling rather than silently omitted.

**As-built departures from the plan (recorded, not silent).** These are presentation facts, not
new operations; they are flagged here because the plan predates the integrated Paper check.

1. **Plan selection ink.** Plan §4.1 named `#74560c` at +0.5 px with a 1 px hover outline. As
   built, the selected contour is PLATE gold `#d4ad45` at 2.5 px over a 4.5 px dark halo; hover
   is `#F3F4EE` at 2 px over a 4 px halo. The selected Wall's cut band is near-black poché, so
   `#74560c` disappears there; the halo keeps the same gold identity legible on vellum and on
   poché. The 0.18 tint is unchanged, and hover is never gold. This follows the higher-level
   design's selection gold (`editor-shell-and-visual-system.md` §Colour) over the plan's
   contrast workaround; it is not a second colour role.
2. **Opening width.** Plan §4.4 said “two rays”. As built there is one width ray from the free
   edge: the existing opening planner fixes the start edge, so a second grip would promise an
   operation the domain does not have. The start edge remains visible as the wall jamb.
3. **Paper span boundaries.** A Wall is compiled as one cut band per solid span. The Paper
   re-stroke derives the contour from the union of those bands; otherwise every shared span
   edge would become a tick. Non-cut lines (lintel, projected, symbol) remain part of the
   selected identity.

## Mark contract as built — for S08 and S09

Publish descriptors; do not draw knobs or a second overlay. The host owns projection, admission,
disclosure, drawing, hit testing and the calibrated screen size.

- `StageHandleDescriptor` is unchanged except the additive `bothWays?: boolean` for a
  two-way ray/track. It changes the drawing and hit area only; the gesture and planner are the
  mark's existing ones.
- `extent` is the mark's **world reach** — the driven distance for a ray/track, the planar
  radius for a ring — not its drawn size. The host draws the shared vocabulary at
  `STAGE_MARK_GLYPH_CSS`: ray 30 px, two-way half 16 px, ring radius 30 px.
- Hit areas are 22 px on a fine pointer and 44 px on a coarse one, visibly unchanged; the
  domain's descriptor order wins an overlap.
- A ray or ring whose axis is edge-on is withheld rather than drawn as a line.
- The tag shows the live value and refusal only on hover or drag. A disclosure mark writes
  nothing, enters no history and resets on a selection or lens change (Esc closes it before
  clearing selection).
- A ring remains available to a subject whose grammar row grants a planar rotation grip (for
  example Scene objects); the Wall row does not, and a Wall must not publish one.
- The Wall move's `extent` (0.6 m) is a legibility value, not a clamp: the rigid move is
  unconstrained. Do not copy it as a limit.
- Stage owns presentation and arbitration; the domain owns eligibility, geometry, planners and
  refusals. S08/S09 publish descriptors and delete their own knobs; they do not add a parallel
  manipulation system.

## Checks run

- `npx vitest run tests/lib/authoring` — 689 passed across 59 files. Coverage includes:
  screen-calibrated ray/ring drawing, two-way draw and hit, edge-on withholding, the Wall's
  free-end length anchor, no `layout-wall-angle` mark while the Card field remains, numeric
  typing with Esc restoration, the paused-proposal resume path through the length mark, Paper
  mark filtering and union boundaries (including a two-span Wall and mixed cut/non-cut lines),
  Paper overlay layer/order/opacity, lazy Scene-root notification, hidden-mesh exclusion, and
  the shell's single-Canvas / three-importer boundary.
- `npm run check` — 0 errors, 0 warnings.
- Playwright at 1280 × 900 against the worktree dev server: 3D selection and hover, Paper
  selection and hover, a selected Room, a 3D → Paper selection flip, numeric entry with two
  Escapes and Undo still disabled, and the Wall mark set (`start`, `end`, `move`, `length`; no
  `angle`); measured 30 px ray and ±16 px two-way arms; no console or page errors.
  Evidence: [numeric typing at the end mark](./evidence-numeric-entry-at-mark.png),
  [neutral 3D hover](./evidence-hover-neutral.png),
  [selected Wall on the mat](./evidence-wall-marks-calibrated-3d.png),
  [selected Wall on Paper](./evidence-paper-wall-selected.png),
  [Paper Wall close-up](./evidence-paper-wall-closeup.png),
  [selected Room on Paper](./evidence-paper-room-selected.png),
  [neutral Paper hover close-up](./evidence-paper-hover-closeup.png).

## Independent review (2026-10-29)

One independent cross-domain reviewer read the mark host, Layout adapter, focused tests and both
slice records. It confirmed the angle ring is gone from the descriptor, drawing and hit path
while the `layout-wall-angle` planner and Card field remain; the two-way draw/hit path; the
calibration maths; selection/hover roles; disclosure no-write/no-history; no second overlay or
projection; and no planner, F4 or Save change. It raised six actionable items, all disposed of:

1. The records claimed thickness was under the Card's More; the Card has no More. Both records
   now say it is a top-level Card field and that More grouping is out of S07 and unlanded.
2. `wall-gesture.ts` still described a shift-drag angle. Its comment now says angle has no
   pointer mode and the pure inverse is retained only for the domain planner and tests.
3. The ring-calibration comment still named a wall. It now says the generic subject.
4. `MIN_AXIS_CSS` was 0.75 px, which withheld only the exact degeneracy. It is now 3 px, with a
   near-edge-on test.
5. The coarse test covered only the end point. It now also presses the move's tail arm and the
   length ray's tip at 44 px.
6. The S08/S09 contract had no note that the move's 0.6 m `extent` is nominal. It now says the
   value is a legibility value, not a clamp.

One note is accepted without change: at coarse pointer the compact length ray is partly
shadowed by the endpoint's 44 px disc. Both submit the same length planner with the same fixed
endpoint, and the ray's tip remains a distinct coarse target, now covered by the test above.

A second, combined-tree review (after the S04 rebase) found no S04 ownership or overlay
conflict. Its actionable findings were fixed and pinned:

1. A lazy Scene model/form mounting after its root is registered did not notify the ink
   subscribers; `scene-pick-source.refresh()` now notifies after its bounds pass, with a
   late-child test.
2. This record was stale. It now states the S04 base, committed branch, Paper integration, 689
   authoring tests and the remaining PR step.
3. 3D ink traversed invisible LODs. It now skips a mesh with any hidden ancestor.
4. 3D hover could overdraw selection on a shared edge. Selection now draws at halo/line 21/22,
   hover at 18/19 and selection tint at 20; the ordering is pinned.
5. Paper dropped non-cut lines whenever a fill existed. It now keeps projected/hidden/symbol
   lines and drops only the duplicate cut outline, with a mixed-line test.
6. The plan's `#74560c` Plan ink, +0.5 px width and 1 px hover outline were stale. The as-built
   gold-plus-halo treatment is recorded above with its reason.
7. The plan's “two rays” Opening width was stale. It is one fixed-start width ray, recorded
   above.
8. The Paper mark group itself was left on layer 0. It is now on `STAGE_OVERLAY_LAYER`, with a
   group-mask test.
9. The new Paper tests now cover the group mask and mixed fill/non-cut-line geometry; the lazy
   Scene and hidden-mesh cases are pinned by a notification test and a source assertion.

## Not run / open

- Push and open the ready-to-merge PR (the branch is committed locally; S11 owns the integrated
  final gate).
- Card grouping of thickness under More (outside S07; not claimed above).
- No release-list row is claimed; the owner waived registration.
