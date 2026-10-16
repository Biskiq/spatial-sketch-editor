# T3.P01.S03 — Compound and runtime preparation: implementation plan

**Slice:** T3.P01.S03 · **Status:** proposed — not authorized · **Phase:** [T3.P01](../README.md) ·
[slice register](../README.md#slice-register) · **Track:** [T3](../../README.md) · **Runbook:**
[T3 operations](../../../../operations/t3-experience/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F3.channels@1, F4.intent-acceptance@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F3.channels@1:inspection-v1, F4.intent-acceptance@1:local-single-domain-v1, F4.intent-acceptance@1:conditional-save-current-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t3.p01.s04-live-ownership-cutover/implementation-plan.md
```

## Prerequisite

S01 and S02 accepted, with `T1.P01.S03`'s local acceptance, at this slice's trusted base. The slice
consumes the still-active current-source scopes while it builds the unit implementation; the
capabilities it exports declare only F2 and the enduring `acceptance-invariants-v1`.

## Scope

Extend the same F4 implementation with `unit-acceptance-v1` and `conditional-save-units-v1`.
Implement actual Camera View + Presentation + optional Stop candidates, complete
domain/reference/resource-lock validation, staged admitted resources, one install/whole-operation
history, and the same conditional Save protocol over F2 candidates. Real-DB conformance is required;
no new live unit writer or new-format Save route is exposed yet. Current-source Save remains the one
live path. Both capability records name the enduring layer and F2 as prerequisites, never a retiring
scope.

Prepare the shared Experience lowering/interpreter, reducer/clock, occurrence holds/continuation,
minimal guard/Continue/detour state, semantic DOM companion/Info Panel and Camera
guided/free/reduced-motion controllers against closed fixtures. Extend F3 with `camera-handoff-v1`,
using the shared Camera ticket acquisition/request/replace/return/cancel protocol. No independent
OrbitControls pose writer, Experience BFS or pose/FOV interpolation. Intrinsic directed timing remains
Camera-owned. These runtime primitives/exports can be accepted inactive before the cohesive activation
diff.

Use the exact ExecutionProgram codec from S01; Preview and T4 consume its lowering/evaluator. Actual
Stage capture/Preview integration belongs to the candidate
[T3.P02](../../t3.p02-capture-and-cut-preview/README.md); no viewport prerequisite is invented for
this pure/runtime preparation.

## Exit criteria

Unit single/compound operations, resource rollback, unit Save, supported program traces (the AM-6
trace cases) and ownership/stale-event behavior. Accept extension scopes on `main` before S04 consumes
them. Never relabel T1's base acceptance as complete F4 readiness.

## Readiness declaration

This slice is **proposed and not authorized**; it holds no implementation permission, and nothing
here claims implementation, acceptance or readiness. Evidence belongs in [acceptance.md](./acceptance.md).
