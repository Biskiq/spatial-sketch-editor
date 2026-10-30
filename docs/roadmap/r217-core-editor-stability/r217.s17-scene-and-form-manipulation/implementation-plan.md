# R217.S17 — Scene and form manipulation: implementation plan

**Slice:** R217.S17 · **Status:** approved (plan); awaits an owner release-list row · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** T2 ·
**Reviewers:** T1, T5 · **Runbook:**
[T2 operations](../../../operations/t2-composition/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Planning label C06. Fixes D17, D18, D33, D37, D38 in the [drift register](../post-s10-convergence/drift-register.md).

## 1. Outcome

Every placed subject can be placed, dragged, turned and sized directly, with a ghost that follows the pointer and matches the accepted result in both readings. This slice must show that manipulation works, not only that ghosts render.

## 2. Dependencies

- R217.S13 and R217.S14
- Owner decision O9
- Every consumed gate and required scope rechecked at this slice's trusted base.
- The [rules for every slice](../post-s10-convergence/execution-plan.md#rules-for-every-slice) apply: shared-file claims, browser widths, the interaction journey, rollback and contract edits.

## 3. Scope

**Behaviour:** [Plan authoring](../post-s10-convergence/target-specification.md#plan-authoring) · [Hit priority](../post-s10-convergence/target-specification.md#hit-priority).

**Files:**

- `apps/editor/src/lib/authoring/adapters/scene.adapter.ts`
- `apps/editor/src/lib/authoring/adapters/scene/candidate-ghost.ts`
- `apps/editor/src/lib/authoring/adapters/scene/placement.ts`
- `apps/editor/src/lib/authoring/adapters/scene/object-marks.ts` and the form mark modules
- `apps/editor/src/lib/authoring/stage/shell/StageCanvas.svelte`
- `apps/editor/src/lib/authoring/stage/shell/StageFormGhost.svelte`
- Tests: `scene-editing-surface.test.ts`, `scene-object-card.test.ts`, `native-form-marks.test.ts`, and the candidate-agreement test

**Rules:**

- A selected subject's body drag is Move, through the existing `place-on-floor` planner and the same hit table.
- Paper footprint and 3D mesh ghosts go through the preview type, including concave and tilted forms.
- A model's proxy comes from approved bounds and is never guessed.
- Library primitives arm click placement with a live ghost. Typed fields stay as the precision path and default to the visible target.
- Off a floor shows the planner's refusal.
- Below 48 px across, the Turn ring and Scale point keep their fixed screen radius and the body remains Move.

**Contracts this slice updates at cutover:**

- None.

## 4. Test cases

- Move, Turn, Size and Place for a primitive, a catalogue object, an approved model and a native form, including concave and tilted forms.
- Candidate footprint equals accepted footprint.
- A model with no bounds draws no shape.
- A ghost never intercepts a pick.
- Position still snaps; Alt frees it.
- An off-floor release writes nothing.

## 5. Browser acceptance

- For each subject type, in Plan and in 3D: place it, drag it by its body, turn it, size it, duplicate it and undo each step, watching the ghost follow the pointer throughout.
- Turn and Size must be driven live; the audit's synthetic check was inconclusive.

## 6. Exclusions and stop conditions

- Import changes.
- Free-floor placement outside a Room.

Stop and report if correctness needs a planner, persisted-format or Camera-authority change this plan does not name, or a decision the [owner rulings](../post-s10-convergence/owner-decisions.md) do not cover. The [Plan authoring audit](../post-s10-convergence/plan-authoring-audit.md) has the evidence behind this scope.
