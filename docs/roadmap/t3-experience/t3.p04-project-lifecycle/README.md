# T3.P04 — Project lifecycle

**Phase:** T3.P04 · **Status:** planning, registered for documentation-only post-Batch-E
coordination. No implementation is authorized or released. **Track:** [T3](../README.md) ·
**Runbook:** [T3 operations](../../../operations/t3-experience/README.md) · **Coordination:**
[next parallel batch](../../cross-track-execution.md#next-parallel-batch)

This is the separate C3 project rename/delete obligation assigned to T3 persistence/API and
T1 shell integration by K4 in [Core Editor Stability](../../core-editor-stability.md#sequencing-findings).
It is a proposed continuation after T3's Capture/Preview integrated final gate by capacity;
it does not block the immediate parallel batch. The milestone's criteria and acceptance route
remain separate owner decisions. Registration of planning is not a release of the hold.

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
| T3.P04.S01 | proposed | F2.unit-envelope@1, F4.intent-acceptance@1 | F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:conditional-save-units-v1 | — | [Project rename and delete](./t3.p04.s01-project-rename-and-delete/implementation-plan.md) | [pending](./t3.p04.s01-project-rename-and-delete/acceptance.md) | not authorized — follows T3.P02.S02 acceptance by T3 capacity and needs its own owner decision |

```text
FINAL PHASE GATE: T3.P04.S01 → ./t3.p04.s01-project-rename-and-delete/acceptance.md

PHASE CLOSE
Stage:        active
```

The single child's exhaustive integrated acceptance is the phase gate. It provides no new
capability gate/version. A passed final gate makes this phase closable; only an explicit owner
phase-close request closes it. The F2 production epoch activation remains owner-operated.
