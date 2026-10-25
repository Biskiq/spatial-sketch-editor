# T3.P04 — Project lifecycle

**Phase:** T3.P04 · **Status:** **active** — registered 2026-10-22 for post-Batch-E coordination;
its single child `T3.P04.S01` was authorized and released 2026-10-24, and implementation started
from merged coordination base `976323da9e18e96978649e595bc555021964631a` on 2026-10-25
([decision](../../../reference/decisions/t3-phase-close-and-p04-authorization-2026-10-24.md)).
**Track:** [T3](../README.md) ·
**Runbook:** [T3 operations](../../../operations/t3-experience/README.md) · **Coordination:**
[next parallel batch](../../cross-track-execution.md#next-parallel-batch)

This is the separate C3 project rename/delete obligation assigned to T3 persistence/API and
T1 shell integration by K4 in [Core Editor Stability](../../core-editor-stability.md#sequencing-findings).
It was authorized and released as `T3.P04.S01` on 2026-10-24 after T3's Capture/Preview integrated
final gate; it is strictly unrelated to the performance-first halt and does not block the immediate
parallel batch. The milestone's criteria and acceptance route remain separate owner decisions.

## Bounded outcome and ownership

A signed-in creator can rename an owned project and delete it after explicit confirmation,
with stale/conflict and dirty-replacement protection. Delete retires the project's stored
versions, staging and approved model resources and their owned bytes without affecting any
other project. T3 owns API/client semantics; T1 owns the explicit reviewed shell integration
patch. Use T2's landed project-scoped model storage/admission interfaces; no import redesign,
publication, prepared delivery or schema migration is implied.

## Slice register

| Slice | Status | Consumes | Requires | Effects | Plan | Acceptance | Authorization |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T3.P04.S01 | in-progress | F2.unit-envelope@1, F4.intent-acceptance@1 | F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:conditional-save-units-v1 | — | [Project rename and delete](./t3.p04.s01-project-rename-and-delete/implementation-plan.md) | [pending](./t3.p04.s01-project-rename-and-delete/acceptance.md) | owner-authorized/released 2026-10-24; implementation started on merged base `976323da9e18e96978649e595bc555021964631a`; R1/R2 ratified 2026-10-25 ([owner review on PR #188](https://github.com/Biskiq/spatial-sketch-editor/pull/188#pullrequestreview-5641779932)); T2 API-handoff review is required before shared API edits; the bounded T1 shell patch remains serialized behind `T1.P02.S06` and requires T1 pre-implementation review; cleanup fence/inventory decisions remain in the [planning resolution](./t3.p04.s01-project-rename-and-delete/planning-resolution-2026-10-24.md) |

```text
FINAL PHASE GATE: T3.P04.S01 → ./t3.p04.s01-project-rename-and-delete/acceptance.md

PHASE CLOSE
Stage:        active
```

The single child's exhaustive integrated acceptance is the phase gate. It provides no new
capability gate/version. A passed final gate makes this phase closable; only an explicit owner
phase-close request closes it. The F2 production epoch activation remains owner-operated.

The [planning resolution](./t3.p04.s01-project-rename-and-delete/planning-resolution-2026-10-24.md)
records the cleanup and migration mechanisms, the T2 API handoff, the T1 shell patch, and Save/Delete
concurrency. The owner ratified both product rules on 2026-10-25: the authored envelope owns the
project name and rename appends one immutable version; delete refuses only while a publication is
active. The [implementation plan](./t3.p04.s01-project-rename-and-delete/implementation-plan.md)
is the current contract. Cleanup still requires a revocable write fence with an enforced write bound,
a persisted complete key inventory, and two empty project-scoped listings spaced by that bound.
Implementation may not merge while any project-owned object writer bypasses the fence.
