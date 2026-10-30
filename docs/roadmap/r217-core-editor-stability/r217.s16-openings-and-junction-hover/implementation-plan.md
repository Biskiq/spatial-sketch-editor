# R217.S16 — Openings and Junction hover: implementation plan

**Slice:** R217.S16 · **Status:** approved (plan); released by the
[campaign record](../../../reference/decisions/r217-convergence-campaign-2026-10-30.md) when PR #230 merges · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** the convergence
integrator · **Architecture owner:** T1 · **Specialist review:** None beyond the independent review · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Planning label C07b. **Class:** Core regression, plus integration of the Opening snap engine. Fixes D31, D35 in the [drift register](../post-s10-convergence/drift-register.md).

## 1. Outcome

An Opening can be selected and edited from Plan alone, without the Index. With a mouse in Plan, a corner can be edited without selecting anything first.

## 2. Dependencies

- R217.S15
- Owner decision O9
- Every consumed gate and required scope rechecked at this slice's trusted base.
- The [rules for every slice](../post-s10-convergence/execution-plan.md#rules-for-every-slice) apply: shared-file order, browser widths, the interaction journey, rollback and contract edits.

## 3. Scope

**Behaviour:** [Plan authoring](../post-s10-convergence/target-specification.md#plan-authoring) · [Hit priority](../post-s10-convergence/target-specification.md#hit-priority).

**Decisions settled here:**

- **Opening pick.** `plan-pick-provider.ts` applies its existing Opening-over-host branch in Select in the Plan reading as well as for the Eraser. 3D keeps the Wall-first order.
- **Opening body.** Using S15's rule, a selected Opening claims a press when the pick winner is that Opening, and runs the same gesture as `layout-opening-position`. In 3D the winner is the Wall, so Opening marks remain the path there.
- **A selected Wall's aperture.** A press inside an Opening picks the Opening, so that press is not a Wall body drag. Click selects the Opening, and drag pans.
- **Junction hover.** Plan reading, fine pointer, no task and no gesture only. **It is not offered in 3D**, because a Junction behind a Wall would need a new occlusion policy.
- **Hover mechanism.** The route's hover path gains an idle-hover step after `hitMark` and before `resolvePick`. Layout finds the nearest `geometry.junctions` point within 10 CSS px through `project` and publishes one extra edit mark, `layout-junction-hover`. Existing `hitMark`, press and lease paths then carry the drag.
- **Priority.** Selected-subject marks are tested first, and a selected Wall's own ends get no second mark. The drag leaves selection unchanged.
- **Snap.** The hovered Junction drag snaps to the 0.5 m grid only, since no Wall is selected to anchor a guide. Opening offset uses `resolveOpeningDragSnap`, falling back to 0.5 m multiples. Width uses 0.1 m multiples, because a 0.5 m step cannot reach ordinary door widths.

**Files:**

- `apps/editor/src/lib/authoring/layout/plan-pick-provider.ts`
- `apps/editor/src/lib/authoring/adapters/layout.adapter.ts` (Opening branch, idle hover)
- `apps/editor/src/lib/authoring/stage/stage-facade.ts` (idle-hover step, admission of the hover mark)
- `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` (hover order)
- Tests: `plan-pick-index.test.ts`, `stage-paper-pick.test.ts`, `layout-wall-manipulation.test.ts`, `stage-host-tools.test.ts`, `stage-handles.test.ts`

**Rules:**

- Door swing is **not** in this slice. It is deferred in the [owner decisions](../post-s10-convergence/owner-decisions.md#deferred-door-swing), because no hinge or swing side is authored.

**Contracts this slice updates at cutover:**

- The domain-ranking example in [the R217 README](../README.md#shared-stage-interaction-coordination-over-domain-policy), which still names a locked Wall → Opening priority, and the matching comments in `plan-pick-provider.ts` and `stage-host-tools.test.ts`.
- `docs/reference/architecture.md`: "With no task, a press is offered only to the primary selection's owner" gains the hovered-Junction exception, and the Plan pick text notes Opening over host in Select.

## 4. Test cases

- A click in the aperture selects the Opening; a click on solid Wall selects the Wall.
- An Opening at a Wall's end.
- 3D click order unchanged.
- Hover reveals exactly one point.
- A coarse pointer never reveals on hover.
- No hover mark in 3D, during a task or during a gesture.
- Junction hover never outranks a selected subject's mark.
- Hovered Junction drag leaves the selection unchanged, and is one Undo step.

## 5. Browser acceptance

- Select, slide and resize an Opening from Plan only, never using the Index.
- Edit a corner with nothing selected.
- Pan still works from near, but not on, a Junction.

## 6. Exclusions and stop conditions

- Head and sill rays.
- Door swing.
- Junction hover in 3D.

Stop and report if correctness needs a planner, persisted-format, new snap geometry or Camera-authority change this plan does not name, or a decision the [owner rulings](../post-s10-convergence/owner-decisions.md) do not cover. The [Plan authoring audit](../post-s10-convergence/plan-authoring-audit.md) has the evidence behind this scope.
