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
| T3.P04.S01 | shipped | F2.unit-envelope@1, F4.intent-acceptance@1 | F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:conditional-save-units-v1 | — | [Project rename and delete](./t3.p04.s01-project-rename-and-delete/implementation-plan.md) | [accepted 2026-10-25](./t3.p04.s01-project-rename-and-delete/acceptance.md) | owner-authorized/released 2026-10-24; accepted after final independent PR #191 review ([review](https://github.com/Biskiq/spatial-sketch-editor/pull/191#pullrequestreview-5644765570)) and the exhaustive integrated gate recorded in the acceptance artifact |

```text
FINAL PHASE GATE: T3.P04.S01 → ./t3.p04.s01-project-rename-and-delete/acceptance.md

PHASE CLOSE
Stage:        closable
```

The single child shipped on 2026-10-25 and passed its exhaustive integrated final gate. It provides
no new capability gate/version. The phase remains active and CLOSABLE; only a separate explicit
owner phase-close request closes it. The F2 production epoch activation remains owner-operated.

The accepted lifecycle contract is promoted to
[`reference/components/persistence.md`](../../../reference/components/persistence.md). The acceptance
artifact owns slice acceptance and gate evidence; planning, handoff and verification records are
recoverable from stubs at their former paths. The owner-ratified contract makes the authored envelope
own the project name, routes rename through immutable Save history, and refuses delete while a
publication is active. Delete fences project writers, inventories exact owned keys, and uses durable
retryable cleanup. No new gate/version is introduced.
