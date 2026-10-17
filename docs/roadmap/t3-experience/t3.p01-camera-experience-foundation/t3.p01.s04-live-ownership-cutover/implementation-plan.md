# T3.P01.S04 — Live ownership cutover: implementation plan

**Slice:** T3.P01.S04 · **Status:** proposed — not authorized · **Phase:** [T3.P01](../README.md) ·
[slice register](../README.md#slice-register) · **Track:** [T3](../../README.md) · **Runbook:**
[T3 operations](../../../../operations/t3-experience/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F3.channels@1, F4.intent-acceptance@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F3.channels@1:camera-handoff-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1
VERIFICATION: exhaustive
```

This is the phase's **FINAL PHASE GATE** and the intended sole provider of
`T3.camera-experience-cutover@1`, which must be drafted and owner-ratified at version 1 before this
slice is authorized.

## Prerequisite

S01, S02, S05 and S06 accepted and S03 reconciled at this slice's trusted base; the AM-7 inventory, migration/refusal coverage,
quiescence and recovery plan, and any owner-accepted publication gap. The T4 deferral (ruling R1-D,
2026-10-17) leaves these obligations unchanged. It means any accepted gap runs until T4's
prepared-reader cutover, which follows [Core Editor Stability](../../../core-editor-stability.md) (K2).

## Scope

After the source/release inventory, approved migration/refusal coverage, quiescence/recovery plan and
any owner-accepted publication gap, activate the already accepted unit/acceptance/runtime/Save
adapters together. Migrate project boot/import/export, validation/runtime composition, platform/API
persistence, Stage read facade, starter boot, and every existing T1/T2 operation/history caller.
Review the integrated callers against new `main`. Rebind Scene definition inputs to immutable project
pins. The F2 starter/migration may install an explicitly captured bounded verified palette;
Scene-only placement otherwise admits only already pinned/procedural definitions and reports missing
pins unavailable. New resource admission remains a staged T2 follow-on. Update unfinished consumer
requirements to preaccepted F2/unit F4 scopes; they cannot continue to claim a retired current
adapter. No whole-track completion prerequisite and no second live writer.

Remove Scene Camera fields, legacy flow-order exports/callers and node-keyed visitor orchestration.
One source revision/lock and new history baseline installs atomically. Re-arm/conform to M5 where
replacement actually occurs. This slice migrates model/runtime callers, not Camera authoring UI, so
it does not declare camera-authoring-migration or consume its own output gate.

The phase's [migration/refusal matrix](../README.md#conversion-and-refusal-matrix) and
[cutover mechanics](../README.md#cutover-mechanics-and-retirement) govern acceptance. T3 owns source
conversion and visitor semantics; T4 subsequently owns prepared delivery activation. Preserve a real
public route and honest unavailable/not-found behavior during an explicitly approved empty-release
gap. If covered releases exist without an approved compatibility disposition, activation is blocked.

## Exit criteria

Run the phase's [verification and acceptance criteria](../README.md#verification-and-acceptance-criteria)
on the integrated tree: record independent acceptance of early conditional Save and source migration,
including source Undo/Save/reload across the new baseline. No unowned current-source adapter, old
order caller or second interpreter remains. Reconcile landed references only after the actual
cutover. Passing makes the phase closable; closure, track completion, T4 reader acceptance and either
Baseline remain separate owner events.

## Authorization path

Reconciled 2026-10-17 against `main` `a8e4d45e`, after S03 shipped through S05/S06. This path
**authorizes nothing**. It orders what must exist before the owner can authorize this slice. The
capability side is met: all five `Requires` scopes are `active` at ancestors of `main` (S01 at
`6dcb6d6d`; `unit-acceptance-v1` and `conditional-save-units-v1` at `d7ab6984`; `camera-handoff-v1` at
`ff5a14da`), and S01, S02, S05 and S06 are accepted with S03 reconciled. Every item below is
**open**. Preflight evidence lives in this slice workspace under `preflight/`, and no item is
evidence until the owner reviews it.

| # | Pre-authorization item | Owner | Evidence | Status |
| --- | --- | --- | --- | --- |
| 1 | **AM-7 inventory.** Actual remote and local source/project/version/publication counts, format coverage and the retained-bytes census, taken from the deployed database and object storage. A clean local database is not evidence that no saved projects exist. | T3 | `preflight/inventory.md` | open |
| 2 | **Migration/refusal coverage.** Each inventoried format and source kind is mapped to a row of the [conversion and refusal matrix](../README.md#conversion-and-refusal-matrix), with fixtures for every convert and refuse outcome. | T3 | `preflight/migration-coverage.md` | open |
| 3 | **Quiescence and recovery plan.** The writer fence, backups taken before activation, a restore rehearsal and rollback criteria, per the [cutover mechanics](../README.md#cutover-mechanics-and-retirement). The local Compose stack (`npm run stack:up`) can host a rehearsal against a restored backup copy, but it is never inventory evidence. | T3 | `preflight/quiescence-recovery.md` | open |
| 4 | **Publication compatibility disposition (AM-7, K2).** A concrete disposition for every existing publication, and the owner's decision on any temporary publication gap, which runs until T4's prepared-reader cutover under R1-D. Public and owner routes must report honest unavailability throughout. There is no blanket approval. | Owner, on T3's review | `preflight/publication-disposition.md` plus the authorization record | open |
| 5 | **Draft and ratify `T3.camera-experience-cutover@1`.** The cutover gate is drafted with this slice's authorization request (cross-track R6) and owner-ratified at version 1. Its register row moves `undrafted` → `ratified`, with this slice as sole provider. | T3 drafts; owner ratifies | an amendment in the owning contract, plus the gate-register row | open |
| 6 | **Owner authorization** of this slice, after 1–5, in its own decision record. The register row moves `proposed` → `approved`. | Owner | `docs/reference/decisions/` | open |

Not on this path: project rename/delete (ruling K4) is a separate small T3 persistence/API slice, with
T1 owning the shell. Neither batch B nor any T1/T2 slice is a prerequisite of this one. T1/T2 slices
still unaccepted at activation have their current-source adapters migrated here (K6).

## Readiness declaration

This slice is **proposed and not authorized**; it holds no implementation permission, and nothing
here claims implementation, acceptance or readiness. Evidence belongs in [acceptance.md](./acceptance.md).
