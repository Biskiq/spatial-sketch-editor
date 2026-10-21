# Roofs on creative footprints — final P3 polish

Status: **implemented, at implementation review** (2026-10-21). Not closed out and not merged. Prototype-only: this
records findings for production planning (T1 / RR-2) but is not production authority. Reconciled against `f4d1c7c5`
(the F1–F4 corrections and Hold wiring).

## 1. What was janky (measured before the change)

The probe fires vertical rays at each roof's top mesh and compares the hits with the height evaluator
(`tests/support/roofProbe.ts`, ported from the round-4 audit).

- **The wing machinery was already exact.** Symmetric sections (flat, gable, hipped gable, vault, extruded dome) on
  fitted L, unequal-L, T, U and plus outlines showed 0 gaps, 0 double surfaces and 0.000 m error over 430–560 samples
  each.
- **The routes people use never reached it.**
  1. One L-shaped room covered as one roof got a single span: **2.88 m cliffs** at the inner eave. Wings were used
     only when several rooms were clicked.
  2. A roof drawn with the pen was always single span.
  3. Two roofs placed together passed through each other. Crossing gables disagreed at 496 of 529 overlap samples
     (up to 2.38 m); an L made of two roofs disagreed at 247 of 266 (up to 1.82 m). Nothing said so.

## 2. What changed, and why it is smaller than first proposed

**S1 — the plan decides wings or one span, on every route** (approved in direction).

- `src/model/roofSpan.ts`:
  - `spanCliff(oh)` finds a single-span extruded roof's outline edge that runs along the ridge, strictly inside the
    span, where the section still stands more than 10 cm above the eave. That is the L-plan failure.
  - A shed's high eave and a gable's end triangles sit on the frame's own sides, so **intentional slopes are never
    reported**; tested on a raked rectangle, a gable rectangle and a convex hexagon.
  - `chooseSpan(oh)` returns wings when they qualify; otherwise one span if that span has no cliff; otherwise a
    **refusal with the reason**. There is no silent fallback to a malformed single span.
- `ops.ts`:
  - `draftOverhead` sizes the preset to the span the roof will actually stand on (the primary wing's or the
    outline's).
  - `coverCheck` and `opCoverRooms` drop the `wings` option and use the plan's answer for any number of rooms.
  - `opAddOverhead(…, { oneSpan: 'auto' })` refuses with the same reason.
- `readings.ts`: both pen roof readings pass `oneSpan: 'auto'`.
- `derive.ts`:
  - New issue `cliff:{id}` for single-span roofs that stop in mid-air (older files, a plan that grew into an L, a
    pitch raised on a plan the wings can't take). Its fix *Give it wings* is offered only when a trial makes the
    roof compound.
  - The no-surface issue's *Cover as one span* repair is now offered only when one span has no cliff. Where neither
    repair works, *Make it flat* is offered instead.
- `Inspector.tsx`: cover chips no longer pass room count; a refused chip reads *"No raked roof over Room 1: as one
  span it would stop 1.4 m up at an inner eave, and its wings can't carry it (the section has no ridge)"*.

**S2 — explicit join of two compatible gables** (narrowed per review).

- `src/model/roofJoin.ts`:
  - `joinCheck` decides by **running the join on a copy**, so the chip, its preview and the commit all see the same
    settled roof.
  - `opJoinRoofs(a, b, expect)` refuses a stale preview with *"…changed since the join was offered… hover the offer
    again"*.
  - `joinNeighbours` offers the join only with roofs whose outlines meet.
- **Qualifies only when:**
  - both roofs have a surface and both sections read as *gable*;
  - the outlines overlap or touch, and their union has no courtyard;
  - eaves are within 2 cm, thickness within 1 cm, pitch within 1° and hip within 5 cm;
  - both roofs are fitted with the same overhang, or neither is fitted, and both rest on rooms or neither does.
  - Joined end to end, a single span must keep A's span. Side by side, that would be a wider, taller roof, so it is
    refused.
- **What is preserved, predictably:**
  - A (the roof whose card you are on) keeps its id, name, direction, thickness, hip, overhang and section shape.
  - The section is sized to the joined roof's primary span, so the **pitch is unchanged**.
  - B's rooms join A's `restsOn` and `fit`.
  - One op: one Undo restores both roofs exactly.
- **UI:** a *Join with {roof}* button on the roof card for each roof that meets it. Hovering previews the joined
  roof; a refused join is disabled, with the reason in its title.
- **Interaction complexity cut, deliberately:**
  - No placement-time *"Roof joined to {A}"* reading: it adds a Tab alternative to every pen roof near another roof,
    for a case the card button handles explicitly.
  - No *"runs through"* collision issue: it would have needed per-pair rules for every family.
  - No *Join with A's section* cross-family repair.
  - No split-back (S3).

  Each would be new surface area to keep consistent; none is needed to show that roofs join cleanly.

## 3. Supported footprint families (P3)

| Footprint | flat | gable | hipped gable | vault | raked / clerestory / sawtooth |
| --- | --- | --- | --- | --- | --- |
| rectangle, convex shapes | one span | one span | one span | one span | one span (intentional slope, never a cliff) |
| L, unequal L, T, U, plus (≤ 4 wings, edges within 2° of the frame) | wings | wings | wings | wings | **refused with the reason** |
| off-axis or freehand non-convex plans | one span | refused where one span would cliff | refused likewise | refused likewise | refused likewise |
| two roofs meeting | — | **join** (same eave, pitch, hip, fit) | join | refused (gables only) | refused |

## 4. Verification (at review)

- **Tests:** 248 in 18 files, all passing (`npx vitest run --exclude tests/roof-polish-review-temp.test.ts`).
  - New: `tests/footprints.test.ts` (31) and `tests/roofJoin.test.ts` (14).
  - Two `qualification.test.ts` expectations changed to the gated repairs.
  - `npx tsc --noEmit` is clean apart from the untracked `tests/roof-polish-review-temp.test.ts` (its `node:fs`
    import has no types), which also stops `npm run build`. Its probe now lives in `tests/support/roofProbe.ts`.
    `npx vite build` succeeds: 1,006 kB, 296 kB gzipped.
- **Browser** (dev server on port 5191), with no console errors:
  - one L room: *flat / gable / vault* live and *raked / clerestory* disabled with their reasons; *gable* gives a
    compound roof with every eave level and no issues;
  - an L of two separately covered gables: the *Join with Room 2 roof* hover previews one roof with a valley, and
    the click commits one step (*Joined Room 2 roof into Room 1 roof*) to a compound roof;
  - Undo restores both roofs and Redo re-joins them;
  - with Room 2 changed to a vault, the button is disabled: *"only two gables can be joined here, and Room 2 roof is
    a vault"*.

## 5. Honest limitations (left as they are)

- **The selected roof's blue section line** is drawn straight across the whole outline, so on a wing roof it crosses
  the valley diagonally. This is pre-existing (`ohSection`) and cosmetic. Production should draw the section per
  wing.
- **Pitch on a single-room L follows the primary wing,** as group covers always have. Covering one L room with a gable
  gives a 6.4 m ridge on the sample L; joining two separate 6 m-span gables keeps their 5.2 m ridge. Both are correct
  for their inputs, but a newcomer may notice the difference.
- **Discovery of a join is on the roof card only.** Two crossing roofs that are never selected stay crossing, with no
  issue.
- **The cliff threshold (10 cm) and join tolerances are prototype constants,** chosen, not measured against anything
  external.
- **A free roof drawn with a gable section over an off-axis L is refused,** not repaired. Its plan needs a solver this
  prototype does not have.

## 6. Deferred — carry to T1 / RR-2

| Deferred | Why not P3 | Production direction |
| --- | --- | --- |
| Stepped or one-sided sections over wings | an authoring ambiguity (which way each wing slopes), not a mesh bug | explicit per-wing section and slope direction, with join rules per family pair |
| Joining across families, eaves or pitches; cross-family repair | needs true surface–surface intersection, beyond the planar envelope | a height-field upper envelope over an exact planar arrangement, with valley/abutment classification |
| Placement-time join recognition, collision issue, split-back | interaction surface without proof value in P3 | revisit once joins are general |
| Off-axis wings, curved or freehand plans, more than 4 rectangles | the decomposition is rectilinear by design | straight-skeleton hips for arbitrary polygons; keep wings as the predictable rectilinear case |
| Courtyards in a cover | `coverOutline` keeps the largest ring | rings with holes through the cover pipeline |
| Lean-to against a taller wall, dormers | new massing semantics | a Layout relation and a feature on top of the envelope |

No Clipper2, Manifold, straight-skeleton solver or general roof engine was introduced. A separate, non-blocking
research harvest compares those libraries for T1/RR-2 and runs in its own session.

## 7. Reusable TypeScript and tests (port the ideas through the canonical compiler; do not import the prototype)

1. **Rectilinear wing decomposition** (`wings.ts`): grid → occupancy → maximal rectangles → greedy cover (≤ 4) →
   continuity validation. It refuses with a reason and never produces wrong geometry.
2. **Planar upper-envelope mesher** (`scene/build/overheads.ts` `buildCompound`, `clipHalfPlane`): exact valleys and
   hips without boolean mesh ops.
3. **Plan-decides-span rule** (`roofSpan.ts`): the frame-aware cliff test that does not misfire on intentional
   slopes.
4. **One-answer qualification** (`coverCheck`, `joinCheck`): chip, preview and commit ask one function, and the op
   refuses a stale candidate by exact comparison. Running the op on a copy is the simplest way to get there.
5. **Mesh-vs-evaluator probe** (`tests/support/roofProbe.ts`): gaps, double surfaces and maximum error from triangle
   positions alone. Renderer-free, so it ports to any mesher.
6. **Fixtures:** `FOOTPRINTS` (L, unequal L, T, U, plus), the two-roof pairs (an L from two rooms, a touching T,
   crossing gables, end to end, side by side) and the refusal set in `roofJoin.test.ts`.
