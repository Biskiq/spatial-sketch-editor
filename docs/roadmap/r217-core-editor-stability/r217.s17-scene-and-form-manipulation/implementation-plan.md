# R217.S17 — Scene and form manipulation: implementation plan

**Slice:** R217.S17 · **Status:** approved (plan); released by the
[campaign record](../../../reference/decisions/r217-convergence-campaign-2026-10-30.md) when PR #230 merges · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** the convergence
integrator · **Architecture owner:** T2 (Scene), T5 (forms) · **Specialist review:** T2: Scene planners and adapter. T5: form marks and ghosts · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Planning label C06. **Class:** Core regression, plus integration of existing footprints and placement. Fixes D17, D18, D33, D37, D38 in the [drift register](../post-s10-convergence/drift-register.md).

## 1. Outcome

Every placed subject can be placed, dragged, turned and sized directly, with a ghost that follows the pointer and matches the accepted result in both readings. This slice must show that manipulation works, not only that ghosts render.

## 2. Dependencies

- R217.S15 for the body-press rule
- R217.S13 and R217.S14
- Owner decision O9
- Every consumed gate and required scope rechecked at this slice's trusted base.
- The [rules for every slice](../post-s10-convergence/execution-plan.md#rules-for-every-slice) apply: shared-file order, browser widths, the interaction journey, rollback and contract edits.

## 3. Scope

**Behaviour:** [Plan authoring](../post-s10-convergence/target-specification.md#plan-authoring) · [Hit priority](../post-s10-convergence/target-specification.md#hit-priority).

**Decisions settled here:**

- **Fixtures come first.** This slice adds the shared *mixed* project fixture below, and S11 reuses it.
- **Body drag.** `objectMarkPointer` gains S15's rule: with no mark hit, it claims the press if the pick winner is the selected entity, and starts the Move gesture. Forms use the same path. Turn and Size stay on their marks.
- **Paper ghost.** Scene publishes `candidatePreview` polygons from `plan-scene-footprint.ts`, evaluated at the candidate pose, in the Plan reading only. The mesh ghosts stay in 3D, so nothing is drawn twice.
- **Model proxy.** `candidateGhost` returns a box from the approved placement footprint when one exists, drawn more faintly than a real ghost. An unapproved model has no ghost and shows its refusal.
- **Primitive placement.** Library primitives arm the existing click placement used for models, with a live ghost. Typed X/Z stays and defaults to the visible target.
- **Off a floor.** The planner's refusal shows at the pointer, and the ghost changes to the `refused` preview.
- **Small subjects.** Below 48 px across, marks keep their screen size and the body remains Move.

**Files:**

- `apps/editor/src/lib/authoring/adapters/scene.adapter.ts`
- `apps/editor/src/lib/authoring/adapters/scene/candidate-ghost.ts`
- `apps/editor/src/lib/authoring/adapters/scene/placement.ts`
- `apps/editor/src/lib/authoring/adapters/scene/object-marks.ts` and the form mark modules
- `apps/editor/src/lib/authoring/adapters/scene/SceneTransformInstrument.svelte`
- `apps/editor/src/lib/authoring/stage/shell/StageCanvas.svelte`
- `apps/editor/src/lib/authoring/stage/shell/StageFormGhost.svelte`
- Tests: `scene-editing-surface.test.ts`, `scene-object-card.test.ts`, `native-form-marks.test.ts`, `scene-operation-acceptance.test.ts`, and the candidate-agreement test

**Rules:**

- **Mixed project fixture.** A builder in `apps/editor/tests/lib/authoring/__fixtures__/` returns one project envelope: a 3 × 2 room plan with a door and a window, a plinth, a 0.9 m low Wall, a 0.75 m table, a native box, a floor catalogue model from `CATALOGUE_MODEL_CONTACT_RECORDS`, an unapproved model, an approved creator model built with `creatorModelResourceEntry`, and rectangular, concave and tilted native forms.
- **Unit tests** use the builder directly and need no API.
- **Browser seeding.** A helper under `apps/editor/tests/e2e/` logs in with `tests/e2e/test-auth.ts`, saves the envelope through the project API, and approves the model through the real import routes, using the smallest GLB in `apps/editor/assets-source/models/`.
- If the local API or Postgres is unavailable, this slice still runs every subject but the approved model in the browser, and names that row as owed in its acceptance record.

**Contracts this slice updates at cutover:**

- The R217.S11 *mixed* fixture row, which now points to this fixture (already updated).

## 4. Test cases

- Move, Turn, Size and Place for a primitive, a catalogue object, an approved model and a native form, including concave and tilted forms.
- Candidate footprint equals accepted footprint.
- A model with no approved bounds draws no shape.
- A ghost never intercepts a pick.
- Position still snaps; Alt frees it.
- An off-floor release writes nothing.
- Fixture contract: every subject in the builder is admitted by the Stage.

## 5. Browser acceptance

- For each subject type, in Plan and in 3D: place it, drag it by its body, turn it, size it, duplicate it and undo each step, watching the ghost follow the pointer throughout.
- Turn and Size must be driven live; the audit's synthetic check was inconclusive.

## 6. Exclusions and stop conditions

- Import changes.
- Free-floor placement outside a Room.

Stop and report if correctness needs a planner, persisted-format, new snap geometry or Camera-authority change this plan does not name, or a decision the [owner rulings](../post-s10-convergence/owner-decisions.md) do not cover. The [Plan authoring audit](../post-s10-convergence/plan-authoring-audit.md) has the evidence behind this scope.
