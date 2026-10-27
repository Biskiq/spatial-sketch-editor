# T3.P04 — Project lifecycle

**Phase:** T3.P04 · **Status:** **closed 2026-10-25** — registered 2026-10-22; its single child
`T3.P04.S01` shipped, its final gate was accepted, and the phase closed by owner ruling 2026-10-25
(PHASE CLOSE below) · **Track:** [T3](../README.md) ·
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
| T3.P04.S01 | shipped | F2.unit-envelope@1, F4.intent-acceptance@1 | F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:conditional-save-units-v1 | — | [Project rename and delete](./t3.p04.s01-project-rename-and-delete/implementation-plan.md) | [accepted 2026-10-25 (closed-work stub)](./t3.p04.s01-project-rename-and-delete/acceptance.md) | owner-authorized/released 2026-10-24; accepted after final independent PR #191 review ([review](https://github.com/Biskiq/spatial-sketch-editor/pull/191#pullrequestreview-5644765570)) and the exhaustive integrated gate recorded in the acceptance artifact; merged in PR #191 (`aa1db37a`); phase **closed 2026-10-25** (PHASE CLOSE below) |

```text
FINAL PHASE GATE: T3.P04.S01 → ./t3.p04.s01-project-rename-and-delete/acceptance.md

PHASE CLOSE
Stage:        closed
Closed:       2026-10-25 — owner ratification: closed by owner ruling 2026-10-25, recorded in PR #193
Final gate:   T3.P04.S01 → ./t3.p04.s01-project-rename-and-delete/acceptance.md — accepted
              2026-10-25 at 550f8a9b (merged in PR #191 as aa1db37a)
Integration:  the gate artifact's integrated acceptance at that revision: complete editor suite
              191 files / 2,464 tests passed with zero failures/skips, arch 22/178, heavy 9/125,
              root build and check, package checks, DB-backed API 114/114 on fresh disposable DB,
              integrated browser/API lifecycle journey, and F9 rename/Save responsiveness.
              Validated as recorded, not re-executed by this close.
Preservation: the gate artifact is a closed-work stub at its own path; its accepted body (91
              lines) is recoverable at 1105ebb7 with tag closed/T3.P04. The 6 supporting prose
              artifacts were already stubs. The preservation report is in the stub.
```

The single child shipped on 2026-10-25 and passed its exhaustive integrated final gate. It provides
no new capability gate/version. The phase closed on 2026-10-25 under explicit owner authorization.
The F2 production epoch activation remains owner-operated.

The accepted lifecycle contract is promoted to
[`reference/components/persistence.md`](../../../reference/components/persistence.md). The acceptance
artifact is compacted to a closed-work stub at its own path; planning, handoff and verification records
are recoverable from stubs at their former paths. The owner-ratified contract makes the authored envelope
own the project name, routes rename through immutable Save history, and refuses delete while a
publication is active. Delete fences project writers, inventories exact owned keys, and uses durable
retryable cleanup. No new gate/version was introduced.
