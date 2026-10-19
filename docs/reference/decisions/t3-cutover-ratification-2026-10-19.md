# T3 cutover ratification: clean source epoch, `T3.camera-experience-cutover@1`, T3.P01.S04

**Date:** prepared October 19, 2026. **Status:** **prepared for owner ratification — nothing ratified
or authorized.** AM-7 is still the governing ratified text. `T3.camera-experience-cutover` is still
`undrafted`, and `T3.P01.S04` is still `proposed`. Each decision below takes effect only when the
owner signs it and the [approval patch](#approval-patch) is applied. Decisions are ordered: R1 is the
basis for R2–R4, and R5 requires R1–R4.

The reasoning is in the [batch C proposal](../../roadmap/batch-c-2026-10-19.md) §2 (C-1, C-2, C-4,
C-6, C-7). This record supersedes PR #149's
`preflight/owner-decisions.md`: D1 and D5 are answered by R1/R4, D2 by R3, D3 by R5, and D4 lapses
because there is no inventory.

## R1 — Saved data is disposable (owner confirmation)

**Basis.** The owner stated in the Batch C request (2026-10-19) that all existing saved data is
disposable. This is consistent with the owner statement of 2026-10-13 that there is no
versioning/compatibility obligation for saved projects, releases or development formats before the
Source Baseline. R1 turns that statement into a signed, scoped ruling.

**Scope: disposable.**

- Every row of `projects`, `project_versions`, `save_receipts`, `assets`, `publications` and
  `releases` in the deployed database, and their R2 object bytes.
- Every local or Compose development database.
- Every browser session draft.
- Every source JSON file or project package written in the current (pre-F2) format.

**Not in scope.**

- `users` (sign-in identity) and `schema_migrations`.
- Checked-in repository content: the catalogue, fixtures and the starter template. It is rewritten
  in code, not reset.
- The frozen external Chopin project, which is outside the repository and the product.

**Consequence.** F.2's named pre-baseline migration exception has no covered data and therefore no
product reason. It is **not invoked** for this cutover. There is no inventory, converter, conversion
fixture, quiescence procedure, backup obligation or restore rehearsal. A snapshot the owner takes
privately before activation is operational prudence. It is never an acceptance obligation, and no
code reads it.

## R2 — AM-7 is superseded by AM-9

AM-7 stays in [composition-execution.md](../composition-execution.md#am-7-source-migration-v1) under
its existing heading, so its anchor is stable. It gains this status paragraph, and its bullets are
kept below the paragraph as superseded text:

> **Status: superseded by AM-9 (ratified 2026-10-xx) —
> not invoked.** The owner ruled every saved source, version, publication and resource disposable
> before the Source Baseline, so the F.2 migration exception has no covered data. No converter,
> inventory or reverse path exists. The cutover is AM-9's clean source epoch. The bullets below are
> retained as superseded provenance.

## R3 — Ratify `T3.camera-experience-cutover@1` with AM-9 as its contract

The anchor choice is PR #149's option A: one ratified interface neighbourhood, resolvable by the
register validator. The exact section to append after AM-8 in
[composition-execution.md](../composition-execution.md#ratified-amendments) follows. The proposal's
§2 explains each simplification relative to PR #149's [gate draft](../../roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s04-live-ownership-cutover/preflight/gate-draft.md).

```markdown
## AM-9 Shared Camera and Experience cutover

Behavioral contract of `T3.camera-experience-cutover@1`. Sole provider `T3.P01.S04`. Consumers:
T3.P02, `T1.P01.S06` and later T1/T2 phases on F2 units (K1, K3), and `T4.prepared-reader@1`.
Prerequisites at the provider's trusted base: `unit-resolution-v1`, `unit-envelope-v1`,
`camera-handoff-v1`, `unit-acceptance-v1` and `conditional-save-units-v1`, plus the enduring
`acceptance-invariants-v1`.

- **Authorities after activation.** Camera owns View identity, framing, projection, connectivity,
  route geometry and intrinsic directed motion/evaluation. Experience owns Presentations, Stop
  identity, Guide order, holds, continuation, Gates and invocation time mapping. Scene and Camera
  structural types carry no editorial order, hold, detour or lock field. Each source/session has
  exactly one Experience order writer and one Camera output owner. A Presentation may exist without
  a Guide: lowering and DOM navigation keep it reachable.
- **Clean source epoch (no migration).** No saved source is covered (owner ruling 2026-10-xx), so
  F.2's migration exception is not invoked and no converter exists. Activation is one forward schema
  migration, serialized against concurrent runners. In one transaction it removes all authored
  project data (sources, versions, receipts, resources, publications, releases) and installs a schema
  that structurally admits only the F2 envelope, so a writer that predates it fails. Unreferenced
  object bytes are purged afterwards. New bootstrap and the starter emit only F2.
- **Current-format-only admission.** API admission, editor boot, import, session drafts and Save
  accept only declared F2 versions. Old clients, old files, old drafts, mixed roots and unknown
  versions fail with typed version diagnostics. There is no format sniffing, transparent fallback,
  dual write or writable feature flag. Skew between independently deployed API and editor builds
  refuses; it never misreads.
- **Retirement.** `local-single-domain-v1` and `conditional-save-current-v1` retire, with every
  caller, under AM-4's per-scope retirement rule. `acceptance-invariants-v1` persists. Also removed:
  the Scene Camera fields, legacy flow-order exports and their callers, node-keyed visitor
  orchestration, and the inactive converter module.
- **Acceptance and history.** Every project starts at a new-format baseline, and no Undo crosses the
  format boundary. AM-4's unit acceptance and Save semantics apply unchanged: one validated install
  with one undo result, fresh revisions, a saved-base CAS with one winner, receipts, and conflict
  preservation.
- **Runtime defaults at @1.** Holds and Gates start at editorial arrival. Lowering takes closed
  invocation bindings. Authored homes for the Cut/Travel selector, presentation text, state and
  lifecycle are later F2 unit amendments, owned by their first authoring consumer (T3.P02). They are
  not part of this version.
- **Publication gap.** Until `T4.P01.S05`, Publish and Update return `prepared-reader-required`.
  Every public read returns an honest not-found or unavailable result, status and Unpublish stay
  truthful, and `/p/` plus visitor isolation stay real. Prepared delivery remains T4's.
- **Recovery.** A failed migration transaction changes nothing. After activation, recovery rolls
  forward. There is no reverse serializer or old-format reader.

**Conformance.**

- Admission refusals: old-format document, old-client Save, old file, old draft, mixed roots and
  unknown version.
- Reset migration: one transaction, idempotent rerun, and a single winner under two runners.
- Structural refusal of a pre-epoch writer after the reset.
- `/p/` not-found for prior IDs, and Publish returning `prepared-reader-required`.
- Atomic compound acceptance and Undo/Redo.
- Real-Postgres Save contention with zero skips.
- Motion/continuation parity, session/handoff independence and accessibility parity.
- One evaluation authority and one order writer.
- No retired-scope caller, and no editor machinery in public chunks.
```

**Register row on ratification** (the evidence columns stay empty, per the register legend):

```text
| T3.camera-experience-cutover | 1 | capability | T3 | [AM-9](../reference/composition-execution.md#am-9-shared-camera-and-experience-cutover) | ratified | T3.P01.S04 | — | — | — | — | — |
```

## R4 — K2 publication gap approved, empty by construction

[K2](../../roadmap/core-editor-stability.md) accepted temporary publication unavailability in
principle, and left the actual gap to be approved at S04. R1 makes the covered publication set empty,
because every publication and release row is removed at activation. The gap approved here is
therefore *no publishing from activation until `T4.P01.S05`*, with the behavior AM-9 states. This is
PR #149's D1 option C. No compatibility disposition remains to review.

## R5 — Authorize `T3.P01.S04`

Authorize S04 under its revised [plan](../../roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s04-live-ownership-cutover/implementation-plan.md),
with these conditions:

- **Phase A** may start at authorization, on T3-owned files only, per the
  [batch C protocol](../../roadmap/cross-track-execution.md#proposed-batch-c-2026-10-19).
- **Phase B** (the caller migration) starts only after the current-source freeze: `T1.P01.S05` and
  `T2.P01.S04` merged, or explicitly re-sequenced by the owner.
- **The merge is the code cutover.** Activation on the deployed environment (migration 005 and the
  deploys) is a separate owner-run step that follows the merged runbook.
- **Assigned defects.** S04 owns TD-6, TD-7, the TD-9 session-draft rewire or removal, and the
  Guide-free Presentation lowering fix. *Alternative for the last:* the first T3.P02 slice, before any
  capture without a Stop.

**Prerequisites, verified at `main` `5fee2a2d`.** All five `Requires` scopes are `active` at
ancestors: `6dcb6d6d`, `d7ab6984` and `ff5a14da`. S01, S02, S05 and S06 are accepted, and S03 is
reconciled. The S04 runbook start step re-checks them at its trusted base.

## Explicit non-implications

- No data is reset by this record or its PR.
- T3.P02 stays unregistered until the gate is `accepted`. It is not merely ratified.
- `T1.P01.S06` and K1/K3/K4 work are not authorized.
- T4 stays deferred (R1-D).
- No Source or Release Baseline is declared.

## Approval patch

Applied only after the owner's signature, in one commit on the coordination PR:

1. Append AM-9 (R3) to `composition-execution.md`. Add R2's status paragraph to AM-7. Add AM-9 to
   the sole-providers line and to that file's amendment list.
2. Apply R3's register row in the [gate register](../../roadmap/README.md#gate-register).
3. In the [T3.P01 slice register](../../roadmap/t3-experience/t3.p01-camera-experience-foundation/README.md#slice-register),
   the S04 row moves to `approved` and its Authorization cell links this record. The phase and track
   status lines, the S04 plan's status and readiness lines and its authorization-path statuses
   become `ratified` / `authorized`.
4. In the [K2 row](../../roadmap/core-editor-stability.md), record the gap as approved under R4.
5. Reword the conditional banners in the T3.P01 README, the S04 plan and the
   [cross-track execution](../../roadmap/cross-track-execution.md#source-first-migration-and-activation-ownership)
   section as ratified provenance. Rewrite that section's AM-7 restatements (inventory, quiescence,
   converter retirement, publication inventory) and the converter sentence in its
   capability-readiness section in AM-9 terms. This record's status becomes **owner-ratified and
   authorized** with the date.
   The frozen T4 drafts (`t4-release/**`, R1-D) are deliberately left unedited. T4 re-derives its
   inventory steps against AM-9 when its planning resumes.
6. The T3 baton names S04 phase A as NEXT.

## Owner signature

```text
R1 ____ (scope as written)  R2 ____  R3 ____  R4 ____  R5 ____ (Guide-free fix: S04 | T3.P02)
Owner: ______________________   Date: __________
```
