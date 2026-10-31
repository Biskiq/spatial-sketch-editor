# R217.S15 — Wall direct manipulation: implementation plan

**Slice:** R217.S15 · **Status:** approved (plan); released by the
[campaign record](../../../reference/decisions/r217-convergence-campaign-2026-10-30.md) when PR #230 merges · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** the convergence
integrator · **Architecture owner:** T1 · **Specialist review:** T2: the shared body-press rule S17 will reuse · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Planning label C07a. **Class:** Core regression, using existing planners. Fixes D19, D31, D33 in the [drift register](../post-s10-convergence/drift-register.md).

## 1. Outcome

A selected Wall can be dragged directly. Its body slides along its normal, its end points edit the shared Junction, and the preview shows the footprint release will commit.

## 2. Dependencies

- R217.S13 and R217.S14
- Owner decisions O2 and O6
- Every consumed gate and required scope rechecked at this slice's trusted base.
- The [rules for every slice](../post-s10-convergence/execution-plan.md#rules-for-every-slice) apply: shared-file order, browser widths, the interaction journey, rollback and contract edits.

## 3. Scope

**Behaviour:** [Wall direct manipulation](../post-s10-convergence/target-specification.md#wall-direct-manipulation) · [Hit priority](../post-s10-convergence/target-specification.md#hit-priority).

**Decisions settled here:**

- **Press routing.** In `pointerIntent`, when no mark was hit, the adapter calls `services.stage.resolvePick` with purpose `select`. It claims the press only if the winner is the selected Wall. This is the body-press rule S17 reuses. The route's press order does not change. Select still ranks a host Wall before an Opening until S16 changes that order, so an aperture press names the Wall in this slice.
- **Clicks.** `press.decide` already separates a click from a drag at `STAGE_CLICK_TOLERANCE_CSS_PX` (4 px). A release within tolerance produces no request and no commit, and the ordinary click runs.
- **Pointer plane.** Every Wall drag uses the existing `pointerDatumPoint`, in Plan and 3D. A move whose ray misses the datum keeps the last preview; a press whose ray misses is not claimed.
- **Normal lock.** `pointerWallRequest`'s move branch projects the delta on the normal of `WallFrame` and returns the same `kind: 'move'` request, so `planRigidWallMove` is unchanged.
- **Junctions.** Start and end points get a new planner kind beside `LAYOUT_WALL_MOVE_KIND`, and `WallManipulationRequest` gains `{ kind: 'junction', junctionId, point }`, routed to `planExactJunctionMove`. `layout-wall-length` stays a length ray on the end point.
- **Snap.** Junction: `orthogonal-guide` from the Wall's other end, then the 0.5 m grid. Body: the normal distance rounds to multiples of 0.5 m once the point leaves rest; at rest the restored distance is returned unchanged. Length: multiples of 0.5 m. Alt during the drag frees all three.
- **Curves.** If `wallFrame` returns null, nothing changes: no body claim and no new marks.
- **Numeric entry.** A new numeric host gives X then Z on a point, Tab reaching each axis. Body and two-way grip take one signed distance, positive in the current drag direction and negative mirrored across the fixed edge. Enter commits the axes that were typed; an untouched axis keeps its current value.
- **Refusals.** A small map turns planner codes into human sentences, with one generic fallback. Raw planner messages and ids no longer reach the Stage.

**Files:**

- `apps/editor/src/lib/authoring/adapters/layout.adapter.ts` (`markDescriptors`, `wallMarkSpec`, `pointerIntent`)
- `apps/editor/src/lib/authoring/adapters/layout/wall-gesture.ts`
- `apps/editor/src/lib/authoring/adapters/layout/precision.ts`
- `apps/editor/src/lib/authoring/adapters/layout/refusals.ts` (planner codes in human words)
- `apps/editor/src/lib/authoring/adapters/layout/instrument.ts`
- `apps/editor/src/lib/authoring/adapters/layout/LayoutCardFields.svelte`
- `apps/editor/src/lib/authoring/layout/plan-numeric-entry.ts`
- `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` (cursor only)
- Tests: `layout-wall-manipulation.test.ts`, `layout-precision-adapter.test.ts`, `layout-candidate-preview.test.ts`, `layout-card-junction-fields.test.ts`, `spatial-route-gesture.test.ts`, `stage-handles.test.ts`

**Rules:**

- The cursor shows `move` when the hover pick winner is the selected subject, using the existing hover resolver.
- Card adds Start and End X/Z under a disclosure, through the same planner.
- No planner changes and no Junction merge.

**Contracts this slice updates at cutover:**

- The Wall row in `docs/reference/design-system/spatial-instrument-grammar.md`, per O6.
- `docs/reference/architecture.md` on selection and marks: a selected subject's owner may claim a press on its own body, and a press within click tolerance stays a click.

## 4. Test cases

- Square room, body drag: both neighbours stretch, four Walls keep their IDs, one Undo.
- Free-standing Wall, body drag: nothing else changes.
- Degree-3 Junction, end point: all three Walls follow.
- An Opening on the moved Wall keeps its offset and width.
- A neighbour's Opening no longer fits: refused, source unchanged.
- Junction onto Junction: refused with human words.
- An off-axis pointer on the length ray changes length only.
- Body drag with an off-normal pointer moves along the normal only.
- Snap on, and Alt held, for each target.
- Click on the selected body within tolerance: no history entry, Card unchanged.
- Pan from empty Stage and from an unselected Wall still pans.
- Digits: body distance, then point X and Z. The first Esc restores and the second cancels.

## 5. Browser acceptance

- The same list with real pointer input, in Plan and 3D.
- The preview footprint matches the accepted footprint at release. In 3D, the live preview is the candidate's footprint at the datum, not the full 3D Wall mesh, so it does not show height or the extruded result.
- Mouse and coarse hit sizes.
- Numeric entry.
- **Owner checkpoint:** the integrator pauses here so the owner can try the Wall drag, in Plan and 3D, and judge whether the footprint preview is sufficient in 3D. O2 can be revisited cheaply now. A full-mesh preview is not in this plan, so asking for one is a material change the owner rules on here.

## 6. Exclusions and stop conditions

- Junction hover and Opening body drag, which are R217.S16.
- Junction merge and new topology.
- The angle ring, and height and thickness grips.

Stop and report if correctness needs a planner, persisted-format, new snap geometry or Camera-authority change this plan does not name, or a decision the [owner rulings](../post-s10-convergence/owner-decisions.md) do not cover. The [Plan authoring audit](../post-s10-convergence/plan-authoring-audit.md) has the evidence behind this scope.
