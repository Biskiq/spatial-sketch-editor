# R217.S20 — Roles and Head: implementation plan

**Slice:** R217.S20 · **Status:** approved (plan); released by the
[campaign record](../../../reference/decisions/r217-convergence-campaign-2026-10-30.md) when PR #230 merges · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** the convergence
integrator · **Architecture owner:** T1 · **Specialist review:** T3: Save, Undo, Preview and Find behaviour · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Planning label C01. **Class:** Core drift from the accepted wireframe. Fixes D01, D02, D03, D04, D25, D26 in the [drift register](../post-s10-convergence/drift-register.md).

## 1. Outcome

The Head is one compact row in the wireframe's order, shell text and colour follow one set of roles, and every utility has a quiet permanent home.

## 2. Dependencies

- R217.S13
- Owner decision O5
- Every consumed gate and required scope rechecked at this slice's trusted base.
- The [rules for every slice](../post-s10-convergence/execution-plan.md#rules-for-every-slice) apply: shared-file order, browser widths, the interaction journey, rollback and contract edits.

## 3. Scope

**Behaviour:** [Shell](../post-s10-convergence/target-specification.md#shell) · [Head](../post-s10-convergence/target-specification.md#head).

**Components:**

| Part | Where | Change |
| --- | --- | --- |
| Shell roles | A new scoped stylesheet imported by the route | Type, colour and density roles as variables on `.editor-host`. No global font rule and no CSS scale |
| Head row | `apps/editor/src/lib/authoring/stage/shell/EditorHead.svelte` | Order: Index toggle, Biskiq, project name, lens, chip, Find, Undo, Redo, Save, Preview. Removes `details.app-menu` and `details.technical`. Replaces `Museum Editor` |
| Project menu | A disclosure on the project name in `EditorHead.svelte` | Hosts the existing `ProjectLifecycleActions`, source download and project id |
| Viewing preferences | `apps/editor/src/lib/authoring/stage/shell/StageDraftingControl.svelte` | ⚙ returns with 2D appearance, Height Sheet side, reduced motion and motion speed, moved from the Head props through the route |
| Index toggle | `apps/editor/src/lib/authoring/stage/shell/EditorIndex.svelte` and the Head | One toggle in the Head; the Index's own L137 toggle goes |
| Find | The route's `findEntries` merge | Entries for every displaced capability, plus Keys |
| Save and refusal words | `EditorHead.svelte` | `.reason` text moves to a focus, hover and tap disclosure with an accessible description. Logic untouched |

**Files:**

- `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte`

**Rules:**

- `Open source JSON` leaves the Stage actions; the Find entry and project menu reach the same route function.
- The context chip shows real canonical location only.
- Browser calibration owns exact sizes within the role table in the specification.

**Contracts this slice updates at cutover:**

- PLATE's references to the app menu, and the shaded-Plan scope ruling in [the R217 README](../README.md#scope-rulings), per O5.

## 4. Test cases

- Tests: `head-find.test.ts`, `head-save.test.ts`, `head-save-journey.test.ts`, `head-drafting-config.test.ts`.
- Find reaches each former menu capability.
- A refusal is announced accessibly.
- The ⚙ holds no drafting value.

## 5. Browser acceptance

- Empty, dirty and refused states.
- Keyboard only.
- Coarse sizes.
- One row at all four widths.

## 6. Exclusions and stop conditions

- Index and Card content, which are R217.S21.

Stop and report if correctness needs a planner, persisted-format, new snap geometry or Camera-authority change this plan does not name, or a decision the [owner rulings](../post-s10-convergence/owner-decisions.md) do not cover. The [Plan authoring audit](../post-s10-convergence/plan-authoring-audit.md) has the evidence behind this scope.
