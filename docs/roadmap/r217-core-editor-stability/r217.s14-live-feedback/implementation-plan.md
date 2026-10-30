# R217.S14 — Live feedback: implementation plan

**Slice:** R217.S14 · **Status:** approved (plan); released by the
[campaign record](../../../reference/decisions/r217-convergence-campaign-2026-10-30.md) when PR #230 merges · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** the convergence
integrator · **Architecture owner:** T1 · **Specialist review:** T2 and T5: the preview contribution they will consume · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Planning label C05. **Class:** Core regression, plus integration of existing snap engines. Fixes D15, D16, D32, D34 in the [drift register](../post-s10-convergence/drift-register.md).

## 1. Outcome

Drawing and Wall gestures show their real result while the pointer moves: the line under the cursor, its length and angle, what it snapped to and why it was refused.

## 2. Dependencies

- R217.S13
- Every consumed gate and required scope rechecked at this slice's trusted base.
- The [rules for every slice](../post-s10-convergence/execution-plan.md#rules-for-every-slice) apply: shared-file order, browser widths, the interaction journey, rollback and contract edits.

## 3. Scope

**Behaviour:** [One snap service](../post-s10-convergence/target-specification.md#one-snap-service) · [Plan authoring](../post-s10-convergence/target-specification.md#plan-authoring).

**Decisions settled here:**

- Layout owns its snap policy in a small new module beside `adapters/layout/precision.ts`. It chooses allowed targets per operation and calls `layout-core`; it computes no geometry. Scene keeps `snapDraftingPoint`, so no cross-domain snap service exists.
- Only existing resolvers are wired: `resolveLayoutSnap` with `orthogonal-guide` and `grid`, and the `resolveOpeningDragSnap` family. `extension-guide` has a kind but no candidates, so it stays unused. No new snap geometry is written.
- `StageAdapterBinding` gains one optional `candidatePreview(context)` beside `overlay`. The facade projects it once and `StageOverlay.svelte` draws it as SVG, in both readings.
- Layout's preview comes from the planner's candidate document through the existing compile and `buildPaperPlan` path, filtered to changed Wall and Opening ids. There is no second solve.
- In 3D, Layout draws the candidate's footprint at the datum, not the full Wall mesh. **No Layout candidate mesh is added**, because that would be a new rendering path. Scene and form ghosts stay meshes in 3D.
- Preview colours: `subject` uses selection ink, `affected` a neutral outline, `refused` a thin neutral dash. Red stays reserved for the Eraser.

**Files:**

- `apps/editor/src/lib/authoring/adapters/layout.adapter.ts`
- `apps/editor/src/lib/authoring/adapters/layout/precision.ts`
- `apps/editor/src/lib/authoring/stage/stage-facade.ts`
- `apps/editor/src/lib/authoring/stage/stage-grid.ts` (candidate extent input)
- `apps/editor/src/lib/authoring/stage/shell/StageOverlay.svelte`
- Tests: `layout-drawing-adapter.test.ts`, `layout-wall-manipulation.test.ts`, and a new candidate-agreement test

**Rules:**

- Remove `inkOverlay`'s rect subtraction, since the facade translates once.
- Wall-reading hover updates the chain, which `hoverIntent` skips today.
- Ink Wall, Box and Opening, plus the existing Wall marks, publish the candidate.
- Snap marks name the winning relation. Nothing is drawn when nothing wins.
- Preview state is session-only and never serialized.

**Contracts this slice updates at cutover:**

- The Stage contribution description in `docs/reference/architecture.md` gains `candidatePreview`.

## 4. Test cases

- Marker position is invariant as the Index and Head change.
- Preview polygons equal the geometry compiled after commit.
- A refused candidate proposes nothing and shows its reason.
- The `resolveLayoutSnap` winner names the mark; Alt suppresses it.

## 5. Browser acceptance

- Hover, press and drag Wall, Box and Opening.
- The line stays under the cursor with the Index open and closed.
- Length, angle and snap are visible.
- An invalid point shows its reason.

## 6. Exclusions and stop conditions

- New gestures.
- The Ink palette redesign, which is R217.S23.
- Parallel-Wall alignment and any other new snap target.

Stop and report if correctness needs a planner, persisted-format, new snap geometry or Camera-authority change this plan does not name, or a decision the [owner rulings](../post-s10-convergence/owner-decisions.md) do not cover. The [Plan authoring audit](../post-s10-convergence/plan-authoring-audit.md) has the evidence behind this scope.
