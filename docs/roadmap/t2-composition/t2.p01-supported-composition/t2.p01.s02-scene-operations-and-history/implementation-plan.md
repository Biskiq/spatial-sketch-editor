# T2.P01.S02 — Scene operations and shared history: implementation plan

**Slice:** T2.P01.S02 · **Status:** proposed — not authorized · **Phase:** [T2.P01](../README.md) ·
[slice register](../README.md#slice-register) · **Track:** [T2](../../README.md) · **Runbook:**
[T2 operations](../../../../operations/t2-composition/README.md)

```text
CONSUMES: F1.reference@1, F4.intent-acceptance@1
REQUIRES: F1.reference@1:references-v1, F4.intent-acceptance@1:local-single-domain-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t2.p01.s04-bounded-composition-loop/implementation-plan.md
```

## Prerequisite

S01 accepted, and `T1.P01.S03`'s `local-single-domain-v1` accepted at this slice's trusted base.

## Scope

Consume the shared acceptance foundation; register Scene operations and validation, not another
history runner. Keep the current-source adapter explicitly bounded to the landed project format.
Validate the entire current project with host catalogue policy before atomic installation. Preserve
Layout and existing Camera fields, material/resource bindings and unrelated Scene records. Missing
targets or an invalid batch leave everything unchanged. Acquire no resources here.

Register S01's `place-object` and prepare the remaining phase operations, even where their UI follows
in S04: move-horizontal, set-yaw, place-on-floor, resize-on-floor, duplicate-one, delete-one
([operation table](../contracts.md#scene-operations-and-prepared-candidates)). Duplicate is exactly
+0.5 m world X and Z, retaining Y, rotation, scale and material sharing. It does not silently
re-ground; if the shifted contact has no equivalent support, refuse and offer ordinary Place
separately. New duplication of cluster members/sets is refused with a reason in this phase. Deletion
cleans cluster membership and removes an empty cluster atomically, with selection correspondence
supplied to the host; there are no Camera/Experience subject-reference schemas to invent. Every
planner changes entity-level and cluster-membership data only and never rebuilds Camera-bearing
Scene fields.

## Exit criteria

Identical intent/captured inputs is deterministic; one edit gives one undo result; Undo/Redo use
fresh revision tokens and exact stored snapshots; stale/local previous-epoch results cannot install;
new edit truncates redo; no-op/invalid/cancel writes nothing. Prove alternating Layout and Scene edits
share one chronological stack and undoing Scene never rolls back an intervening Layout result. A
direct caller bypass test must fail if Scene writes skip acceptance.

## Readiness declaration

This slice is **proposed and not authorized**; it holds no implementation permission, and nothing
here claims implementation, acceptance or readiness. Evidence belongs in [acceptance.md](./acceptance.md).
