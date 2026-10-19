# T3.P01.S04 — Live ownership cutover: implementation plan

**Slice:** T3.P01.S04 · **Status:** approved — owner-authorized 2026-10-19 · **Phase:** [T3.P01](../README.md) ·
[slice register](../README.md#slice-register) · **Track:** [T3](../../README.md) · **Runbook:**
[T3 operations](../../../../operations/t3-experience/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F3.channels@1, F4.intent-acceptance@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F3.channels@1:camera-handoff-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1
VERIFICATION: exhaustive
```

This is the phase's **FINAL PHASE GATE** and the intended sole provider of
`T3.camera-experience-cutover@1`, ratified at version 1 on 2026-10-19 with
[AM-9](../../../../reference/composition-execution.md#am-9-shared-camera-and-experience-cutover) as its contract.

> **Revised 2026-10-19 (Batch C), owner-ratified the same day.** This plan follows the
> clean-reset path of the [T3 cutover record](../../../../reference/decisions/t3-cutover-ratification-2026-10-19.md):
> disposable saved data (R1), AM-7 superseded by AM-9 (R2–R3), an empty publication gap (R4) and a
> two-phase authorization (R5). The withdrawn AM-7 preflight drafts of PR #149 are recoverable at
> `5fee2a2d`.

## Prerequisite

- S01, S02, S05 and S06 accepted, and S03 reconciled, at this slice's trusted base. All hold.
- The owner's R1–R5 signatures (given 2026-10-19).
- For phase B only: the current-source freeze. `T1.P01.S05` and `T2.P01.S04` have merged, or the
  owner has explicitly re-sequenced them (batch C ruling C2).

The T4 deferral (R1-D) means the approved publication gap runs until T4's prepared-reader cutover
(K2).

## Scope

Activate the already accepted unit, acceptance, runtime and Save adapters together, on a clean source
epoch. AM-9 is the contract; the phase's [cutover mechanics](../README.md#cutover-mechanics-and-retirement)
and [admission matrix](../README.md#admission-and-refusal-matrix) govern acceptance.

**Phase A: T3-owned files** (may start at authorization, in parallel with batch C, per the
[batch C protocol](../../../cross-track-execution.md#authorized-batch-c-2026-10-19)).

- **Reset migration `005`.** Take the advisory lock first; that closes TD-6 for every migration.
  Then, in one transaction, remove all authored rows and install the F2-only schema fence. Rerun is
  a no-op. Keep `users` and `schema_migrations`. Add an idempotent purge of unreferenced R2 objects.
- **API.** Admit only declared F2 versions on every path: read, Save, assets and publication status.
  Publish/Update return `prepared-reader-required`. Every public read is an honest
  not-found/unavailable. Fix or explicitly disposition TD-7 on the unit Save path.
- **Project-model.** Make the unit Save adapter live server-side. Retire the `./migration` subpath:
  delete the converter and its conformance test, and rebuild `program-entry-closure` fixtures as
  direct F2 units. Remove Scene Camera fields and the legacy flow-order exports with their
  package-level callers.
- **Lowering and visitor.** Lowering keeps Guide-free Presentations reachable; the North Star
  promise is restored before activation (R5). The visitor runtime switches to Experience-unit
  orchestration, and node-keyed orchestration is removed.

**Phase B: caller migration** (after the freeze).

- **Callers.** Migrate project boot, import and export (the package boundary declares F2 admission),
  validation and runtime composition, the Stage read facade, the starter boot (F2-backed, keeping
  AM-5's public host seam) and every existing T1/T2 operation and history caller onto unit
  admission.
- **Save.** Mount the unit Save state in T1's Head through the existing integration, and switch the
  Head to it. For the session-draft path (TD-9), either rewire it to F2 captures or remove it. No
  old-format draft path survives.
- **Requirements.** Update unfinished consumer requirements to the unit scopes; none may keep a
  retired current-source admission.
- **Scene definitions.** Rebind Scene definition inputs to immutable project pins. The starter may
  install an explicitly captured, bounded, verified palette. Scene-only placement otherwise admits
  only already pinned or procedural definitions, and reports missing pins as unavailable. New
  resource admission remains a staged T2 follow-on (K1).
- **History.** Install one new history baseline, and re-arm or conform to M5 where replacement
  actually occurs.
- **Final review.** Review the integrated callers against frozen `main`.

This slice migrates model and runtime callers, not Camera authoring UI. It does not declare
camera-authoring-migration, and it does not consume its own output gate. Authored homes for the
Cut/Travel selector, presentation text, state and lifecycle are T3.P02's F2 amendments (AM-9
runtime defaults), not this slice's.

## Exit criteria

Run the phase's [verification and acceptance criteria](../README.md#verification-and-acceptance-criteria)
on the integrated tree:

- the exhaustive tier;
- root check/build and the relevant package checks;
- `check:api` and a DB-backed `test:api` with **zero skips**;
- a reset-migration rehearsal on the Compose stack, covering one transaction, rerun, two runners and
  a pre-epoch writer refused;
- the integrated T1/T2 journeys on unit admission (Place, edit, Undo, Save, reload).

Record independent acceptance of the unit Save live switch and the epoch admission. No unowned
current-source adapter, old-order caller, converter or second interpreter may remain. Reconcile
landed references (persistence, scene-content, camera-tour, architecture) only after the actual
cutover. Passing makes the phase closable. Closure, track completion, T4 reader acceptance and
either Baseline remain separate owner events.

## Activation runbook (owner-run, after merge)

The merge is the code cutover. Activation on the deployed environment is an owner action outside any
PR:

1. Optionally take a private snapshot (R1: prudence, not an obligation).
2. Run `npm run migrate` against the deployed database to apply `005`.
3. Deploy the API (Render) and the editor (Vercel).
4. Run the R2 purge.
5. Smoke-test: empty and starter boot, one Save, a prior `/p/` ID → not-found, and Publish →
   `prepared-reader-required`.

Any deployment order is safe: a pre-epoch build fails against the fenced schema, and a new build
refuses pre-epoch data.

## Authorization path

Revised and closed 2026-10-19 against `main` `5fee2a2d`; the owner's signatures on the T3 cutover
record are the authorization. The capability side
is met: all five `Requires` scopes are `active` at ancestors of `main` (S01 at `6dcb6d6d`;
`unit-acceptance-v1` and `conditional-save-units-v1` at `d7ab6984`; `camera-handoff-v1` at
`ff5a14da`). S01, S02, S05 and S06 are accepted, and S03 is reconciled. The AM-7 items that were on
this path (deployed inventory, migration coverage, quiescence/recovery, per-publication disposition)
are withdrawn, because the owner's disposability ruling leaves them nothing to cover (proposal C-1).
Every item below is **closed**.

| # | Pre-authorization item | Owner | Evidence | Status |
| --- | --- | --- | --- | --- |
| 1 | **Disposability ruling** with its exact scope (R1) | Owner | [T3 cutover record](../../../../reference/decisions/t3-cutover-ratification-2026-10-19.md#r1--saved-data-is-disposable-owner-confirmation) | closed — signed 2026-10-19 |
| 2 | **AM-7 superseded by AM-9** (R2), with the AM-9 text reviewed | Owner, on T3's draft | same record, R2–R3 | closed — ratified 2026-10-19 |
| 3 | **Ratify `T3.camera-experience-cutover@1`** with the AM-9 anchor; the register row moves `undrafted` → `ratified` | Owner | same record, R3; [preflight/gate-draft.md](./preflight/gate-draft.md) | closed — ratified 2026-10-19; register row `ratified` |
| 4 | **Publication gap** approved as empty by construction (R4, K2) | Owner | same record, R4 | closed — approved 2026-10-19 |
| 5 | **Owner authorization** of this slice, with the two-phase start condition (R5); the register row moves `proposed` → `approved` | Owner | same record, R5 | closed — authorized 2026-10-19; register row `approved` |

Not on this path: project rename/delete (ruling K4) is a separate small T3 persistence/API slice,
with T1 owning the shell. Under the batch C protocol it follows this slice, because it touches the
same API files. T1/T2 slices still unaccepted at the freeze re-declare unit scopes (K6).

## Readiness declaration

This slice is **owner-authorized** (2026-10-19). Phase A may start on T3-owned files through the
runbook start step; phase B waits for the batch C current-source freeze. Nothing here claims
implementation, acceptance, readiness or a data reset. Evidence belongs in
[acceptance.md](./acceptance.md).
