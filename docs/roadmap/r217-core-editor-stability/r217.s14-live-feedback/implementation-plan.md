# R217.S14 — Live feedback: implementation plan

**Slice:** R217.S14 · **Status:** approved (plan); awaits an owner release-list row · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** T1 ·
**Reviewers:** T2, T5 · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Planning label C05. Fixes D15, D16, D32, D34 in the [drift register](../post-s10-convergence/drift-register.md).

## 1. Outcome

Drawing and Wall gestures show their real result while the pointer moves: the line under the cursor, its length and angle, what it snapped to and why it was refused.

## 2. Dependencies

- R217.S13
- Every consumed gate and required scope rechecked at this slice's trusted base.
- The [rules for every slice](../post-s10-convergence/execution-plan.md#rules-for-every-slice) apply: shared-file claims, browser widths, the interaction journey, rollback and contract edits.

## 3. Scope

**Behaviour:** [Plan authoring](../post-s10-convergence/target-specification.md#plan-authoring) · [One snap service](../post-s10-convergence/target-specification.md#one-snap-service).

**Files:**

- `apps/editor/src/lib/authoring/adapters/layout.adapter.ts`
- `apps/editor/src/lib/authoring/stage/stage-facade.ts`
- `apps/editor/src/lib/authoring/stage/shell/StageOverlay.svelte`
- A new small Stage snap helper
- Tests: `layout-drawing-adapter.test.ts`, `layout-wall-manipulation.test.ts`, and a new candidate-agreement test

**Rules:**

- Remove `inkOverlay`'s rect subtraction, since the facade translates once.
- Add `StageCandidatePreview` as one optional adapter contribution. It is drawn by the Stage and never persisted.
- Ink Wall, Box and Opening, plus the existing Wall marks, publish the planner's candidate.
- Wall-reading hover updates the chain, which `hoverIntent` skips today.
- The snap helper chooses allowed targets per operation and calls `layout-core`; it computes no geometry. Snap marks name the winning relation.

**Contracts this slice updates at cutover:**

- None.

## 4. Test cases

- Marker position is invariant as the Index and Head change.
- Preview polygons equal the compiled candidate.
- A refused candidate proposes nothing and shows its reason.
- The `resolveLayoutSnap` winner names the mark.

## 5. Browser acceptance

- Hover, press and drag Wall, Box and Opening.
- The line stays under the cursor with the Index open and closed.
- Length, angle and snap are visible.
- An invalid point shows its reason.

## 6. Exclusions and stop conditions

- New gestures.
- The Ink palette redesign, which is R217.S23.

Stop and report if correctness needs a planner, persisted-format or Camera-authority change this plan does not name, or a decision the [owner rulings](../post-s10-convergence/owner-decisions.md) do not cover. The [Plan authoring audit](../post-s10-convergence/plan-authoring-audit.md) has the evidence behind this scope.
