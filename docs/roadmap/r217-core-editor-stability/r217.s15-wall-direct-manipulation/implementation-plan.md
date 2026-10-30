# R217.S15 — Wall direct manipulation: implementation plan

**Slice:** R217.S15 · **Status:** approved (plan); awaits an owner release-list row · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** T1 ·
**Reviewers:** T2 · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Planning label C07a. Fixes D19, D31, D33 in the [drift register](../post-s10-convergence/drift-register.md).

## 1. Outcome

A selected Wall can be dragged directly. Its body slides along its normal, its end points edit the shared Junction, and the preview shows exactly what release will commit.

## 2. Dependencies

- R217.S13 and R217.S14
- Owner decisions O2 and O6
- Every consumed gate and required scope rechecked at this slice's trusted base.
- The [rules for every slice](../post-s10-convergence/execution-plan.md#rules-for-every-slice) apply: shared-file claims, browser widths, the interaction journey, rollback and contract edits.

## 3. Scope

**Behaviour:** [Wall direct manipulation](../post-s10-convergence/target-specification.md#wall-direct-manipulation) · [Hit priority](../post-s10-convergence/target-specification.md#hit-priority).

**Files:**

- `apps/editor/src/lib/authoring/adapters/layout.adapter.ts` (`markDescriptors`, `wallMarkSpec`, `pointerIntent`)
- `apps/editor/src/lib/authoring/adapters/layout/wall-gesture.ts`
- `apps/editor/src/lib/authoring/adapters/layout/precision.ts`
- The spatial route's `onPointerDown` and cursor
- Tests: `layout-wall-manipulation.test.ts`, `spatial-route-gesture.test.ts`, `stage-handles.test.ts`

**Rules:**

- Add a `layout-junction-move` planner kind wrapping `planExactJunctionMove`. End points become Junction moves.
- `mode: 'move'` projects the delta on the Wall's normal, for both the body and the two-way grip.
- The length ray keeps its fixed end.
- A press with no mark is offered to the selection's owner only when the pick winner is that subject, and the adapter claims the body. Below 4 CSS px of travel, the gesture ends and the click proceeds.
- Every Wall drag uses the snap helper. Card adds Start and End X/Z under a disclosure.
- No planner changes and no Junction merge.

**Contracts this slice updates at cutover:**

- The Wall row in `docs/reference/design-system/spatial-instrument-grammar.md`, per O6.

## 4. Test cases

- Square room, body drag: both neighbours stretch, four Walls keep their IDs, one Undo.
- Free-standing Wall, body drag: nothing else changes.
- Degree-3 Junction, end point: all three Walls follow.
- An Opening on the moved Wall keeps its offset and width.
- A neighbour's Opening no longer fits: refused, source unchanged.
- Junction onto Junction: refused with human words.
- An off-axis pointer on the length ray changes length only.
- Snap on, and Alt held, for each target.
- Click on the selected body under 4 px: no history entry, Card unchanged.
- Pan from empty Stage and from an unselected Wall still pans.
- Digits: body distance, then point X and Z. The first Esc restores and the second cancels.

## 5. Browser acceptance

- The same list with real pointer input, in Plan and 3D.
- The preview matches the accepted result at release.
- Mouse and coarse hit sizes.
- Numeric entry.
- Record how the body drag feels: O2 can be revisited cheaply here.

## 6. Exclusions and stop conditions

- Junction hover and Opening body drag, which are R217.S16.
- Junction merge and new topology.
- The angle ring, and height and thickness grips.

Stop and report if correctness needs a planner, persisted-format or Camera-authority change this plan does not name, or a decision the [owner rulings](../post-s10-convergence/owner-decisions.md) do not cover. The [Plan authoring audit](../post-s10-convergence/plan-authoring-audit.md) has the evidence behind this scope.
