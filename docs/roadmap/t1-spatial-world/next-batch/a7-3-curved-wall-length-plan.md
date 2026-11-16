# T1 A7.3 — Curved Wall Length mark

**Authority:** T1 next-batch roadmap rev 3, A7 (Tier 0) — "length mark on curved Walls … one
control over one planner". Base `main` @ `04a3f433` (PR #355). Short plan, as the slice requires.

**Scope note.** The ledger's one-control-over-one-planner wording assumes an exact curved-length
writer. None exists: `planExactWallLength` rejects a non-line centerline
(`layout-wall-first-precision.ts`, `rejectCurvedWall('exact length', …)`), and A7.2's own plan
records that a curved open Wall offers neither Length nor Angle. A7.3 therefore delivers the
**reading**, not a grip: the selected curved Wall's canonical arc length is published through the
existing size chip and its existing tag renderer. No planner, solver, gesture or document field is
invented.

## Goal

Make the selected curved Wall's canonical **arc length** visible on the Stage in Plan and 3D
through the existing mark vocabulary, truthfully and without an editable affordance.

## What already exists (inspection)

- **Canonical geometry.** `curvedWallFrame(document, wallId)` returns the sampled centerline's exact
  arc `length` — explicitly "not the chord" — and `curvedWallPointAt` addresses it by arc station.
  The Card already reads it as **Length (arc)** in `cardFacts`, formatted at 3 dp.
- **Curved Wall marks.** The curved branch publishes one `layout-wall-size-chip` disclosure. Its
  comment already says arc length is not an exact-length writer on a curve, so it reveals only the
  thickness and (3D) height scalars. Both endpoints and one hollow span point per span remain
  editable; no length ray is published.
- **Mark contract.** `StageEditingGrip` requires a registered planner; `StageDisclosureMark`
  requires revealed grips. There is no read-only grip role, and inventing one is outside this
  slice.
- **The gap.** `StageHandleBase.value` is documented as "only shown while the mark is hovered or
  held", and a disclosure's tag is built from it (`tag: descriptor.value ?? …`), but
  `StageOverlay.svelte` suppresses every disclosure tag. A disclosure therefore cannot publish a
  reading today, even though its descriptor already carries the value.

## Change

1. **Publish the reading.** The curved Wall's size chip sets
   `value: 'Length (arc) <arc> m'` from `curved.frame.length` at the same 3 dp as the Card fact.
   The chip stays `role: 'disclose'` with the same `reveals`; only its published reading is added.
   Straight or closed Walls are untouched: a straight Wall keeps its editable length ray, a closed
   Wall keeps Radius/Diameter.
2. **Render it in the one overlay.** A disclosure that publishes a value draws that value in the
   existing dark mono tag while hovered or held, and while open (the touch path: a tap opens the
   disclosure and the reading stays legible). Its accessible name carries the same reading. A
   disclosure with no value is unchanged, so existing size chips gain no tag.
3. **Docs.** The grammar's Wall row states the curved case: no free-end length ray, and the size
   chip publishes the arc length as a read-only reading. This plan.

No new mark id, role, renderer, guide, planner, gesture, capability id, format change or persisted
field.

## Acceptance (A7 wording, made concrete)

- **Canonical arc length, not the chord.** The chip's value equals `curvedWallFrame.length` at 3 dp
  on a strongly curved fixture, and therefore exceeds the start-to-end chord.
- **Straight/curved distinction.** A straight Wall publishes no chip value and keeps its length ray;
  a curved Wall publishes the reading and no length ray; a closed Wall keeps its radius mark.
- **Plan and 3D.** The same chip carries the same value in both readings; no grip is added in
  either.
- **Geometry edits.** After Bend the reading equals the new canonical arc length. After Split each
  fragment reads its own arc length, and the fragments' sum equals the pre-split length within the
  frame's sampling tolerance.
- **Selection, disclosure and cancellation.** No chip without selection. Opening the chip still
  reveals the thickness/height grips and writes nothing; closing it, losing selection, an open task,
  the Experience lens or Unroll withdraws the reading (Unroll withholds the Wall's canonical marks).
- **No writes.** Selecting, hovering and opening the chip change neither the canonical document nor
  history, and submit no intent.
- **Browser QA.** In the running editor, a bent Wall selected in Plan and 3D shows the arc reading on
  the size chip; a straight Wall still shows the length ray and no chip reading.

## Files

- `apps/editor/src/lib/authoring/adapters/layout/layout-contributions.ts` — the curved chip's value.
- `apps/editor/src/lib/authoring/stage/shell/StageOverlay.svelte` — a valued disclosure's tag and
  accessible name.
- `apps/editor/tests/lib/authoring/layout-wall-manipulation.test.ts` — arc-versus-chord, Plan/3D,
  Bend/Split, selection and no-write acceptance on the real host.
- `apps/editor/tests/lib/authoring/stage-overlay-disclosure.test.ts` — the tag's presence, text,
  open state and accessibility.
- `docs/reference/design-system/spatial-instrument-grammar.md` — the Wall row's curved case.
- This plan.

## Out of scope

- An editable curved length, a curve-resizing solver, or any new planner/intent/payload.
- A new mark role or read-only grip, a second renderer or a guide-layer dimension.
- Moving or resizing a curved Wall through its length.
- Visitor surfaces, the format, the capability ledger, the Unroll sheet's own ruler.
- Straight Walls gaining a chip value (their length is already an editable ray).

## Risks

1. **Display rounding.** 3 dp is the Card fact's precision, not the stored value; the reading never
   feeds a write.
2. **Sampled length.** The value is the canonical sampled arc length every station, Opening and
   Split consumer already uses, so its accuracy is the model's, not a new fit.
3. **Tag placement.** The tag sits beside the chip; browser QA checks it does not collide with the
   revealed thickness/height marks while open.

## Checks

- Focused: `layout-wall-manipulation.test.ts`, `stage-overlay-disclosure.test.ts`; `npm run check`;
  `npm run test:arch`; `npm run test:fast`; `npm run build`.
- Focused browser QA of a bent Wall in Plan and 3D, including the open chip and Unroll.

## Open issues

Checked the open tracker before starting: #353 (shadow artifacts / Artwork picking), #337, #336,
#335, #334 (pointer leases and look.light bugs), #284 (Height Sheet), #280 (Experience lens), #273
(wall-draw-close perf selectors). None belongs to the A7.3 slice; nothing is folded in.
