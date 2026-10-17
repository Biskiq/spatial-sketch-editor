# AM-5 conformance reconciliation and bounded completion proposal

**2026-10-17 · PR #137 · proposal, not ratification or acceptance.**
The [approved S07 plan](./implementation-plan.md) and [AM-5 interface](../interfaces.md#viewport-projection-v1)
remain the acceptance contract. Passing a probe does not waive an unimplemented row.

## Remaining requirements

| Requirement | Present limitation | Required completion |
| --- | --- | --- |
| Source-independent accepted read boundary | `StageReadSnapshot` is structurally similar to AM-4, but fixes `sourceKind` to `project-current` and requires `domain.project: ProjectDocument`. The host and adapter services still depend on that encoding. | Expose the common accepted identity/read boundary independently of current-format source; keep current-source conversion with its domain adapter. Prove a consumer does not require `ProjectDocument`. F2 storage migration remains T3 S04's work. |
| F.1 ordered selection and primary identity | `StageSelection` holds one Layout `PlanSourceRef`; its kind set cannot name a Scene entity. A Scene planner can register/accept and contribute UI, but that is not proof of selecting a Scene entity or showing its canonical Card. | Add an F.1 identity-based selection/primary port, with optional Layout representation qualification. Prove Scene selection/Card/echo and requalification alongside Layout, using one owner. |
| Lens/task exit lifetime | Task close now releases its gesture; replacement and stale callback guards are tested. The route's lens setter only changes `lens`, with no cancellation or inactive task/explicit Resume state. | Cancel the unaccepted writer on lens exit, park the task inactive, and require explicit revalidation on Resume without restoring selection/view. Prove this in the shared session and browser. |

These are implementation/conformance gaps, not authorized exceptions inherited from S02's override.
S02's accepted record is untouched. No new readiness claim follows from its override.

## Narrow proposed API amendment

Before changing the public v1 adapter shape, review and approve one bounded additive extension:

- A domain-neutral selection value using the existing F.1 semantic reference and ordered/primary
  vocabulary; preserve the existing Layout helper as a compatibility consumer, rather than expanding
  `PlanSourceKind` to impersonate Scene identity.
- A source-independent accepted read port, with an explicitly typed current-source adapter access
  for current-format planners. No new persisted format, planner algorithm or production writer.
- Explicit task active/inactive/Resume lifecycle and lens-exit cancellation at the single session
  owner. This completes the existing AM-5 rule; it does not add another task or history owner.

Keep this within S07's protected host/route/shell ownership, or explicitly assign a bounded follow-up
before S07 acceptance. Do not waive these requirements or accept the gate merely to admit Batch B.
If review determines an extension cannot remain backward compatible, resolve its version/consumer
re-declaration before implementation; this proposal does not pre-ratify that choice.

## Browser hook disposition

The approved plan explicitly permits a test-only conformance route hook when there is no production
writer. `vite.stage-conformance.config.ts` is selected only by an explicit local command. It injects
one test-owned adapter into the domain catalogue and a visible **Replace conformance starter** button
calling the existing replacement guard. The owning adapter supplies a real Svelte instrument and a
canonical wall-height conformance planner. Ordinary production configuration is unchanged.

This hook needs no new exception: it uses the plan's existing allowance. Production output must
exclude the probe writer, component and replacement button; that exclusion is recorded separately
in [acceptance](./acceptance.md). No test-only hook or broader contract change is silently promoted to
production or used to excuse the AM-5 gaps above.
