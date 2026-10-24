# T3.P04 — Project lifecycle

**Phase:** T3.P04 · **Status:** **approved** — registered 2026-10-22 for documentation-only
post-Batch-E coordination, and its single child `T3.P04.S01` authorized and released 2026-10-24
([decision](../../../reference/decisions/t3-phase-close-and-p04-authorization-2026-10-24.md)).
Implementation starts once that coordination PR is merged on `main`; the authorization itself ships
no implementation. **Track:** [T3](../README.md) ·
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
| T3.P04.S01 | approved | F2.unit-envelope@1, F4.intent-acceptance@1 | F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:conditional-save-units-v1 | — | [Project rename and delete](./t3.p04.s01-project-rename-and-delete/implementation-plan.md) | [pending](./t3.p04.s01-project-rename-and-delete/acceptance.md) | owner-authorized and released 2026-10-24 ([decision](../../../reference/decisions/t3-phase-close-and-p04-authorization-2026-10-24.md); release row in [now.md](../../now.md)); not started; its bounded T1 shell patch is serialized against `T1.P02.S06` and T1-reviewed; the name/publication contract rulings are **proposed, awaiting owner ratification**, and its cleanup mechanism was corrected twice in review ([planning resolution](./t3.p04.s01-project-rename-and-delete/planning-resolution-2026-10-24.md)) |

```text
FINAL PHASE GATE: T3.P04.S01 → ./t3.p04.s01-project-rename-and-delete/acceptance.md

PHASE CLOSE
Stage:        active
```

The single child's exhaustive integrated acceptance is the phase gate. It provides no new
capability gate/version. A passed final gate makes this phase closable; only an explicit owner
phase-close request closes it. The F2 production epoch activation remains owner-operated.

The [planning review against current `main`](./t3.p04.s01-project-rename-and-delete/planning-resolution-2026-10-24.md)
resolves the routine questions — durable cleanup, migration contingency, the T2 API handoff, the T1
shell patch and Save/Delete concurrency — and proposes that the authored envelope owns the project
name (rename appends one immutable version) and that delete refuses only while a publication is
active. Both are **proposed rulings, not ratified**, so the rename/delete persistence behaviour is
not frozen. Its
[review corrections](./t3.p04.s01-project-rename-and-delete/planning-resolution-2026-10-24.md#review-corrections)
also replace the first draft's listing-only cleanup claim with a revocable write fence and an enforced
write bound, persist the approved revision's full key set, and scope the listing to the project.
Implementation may not merge while a project-owned object writer bypasses that fence.
