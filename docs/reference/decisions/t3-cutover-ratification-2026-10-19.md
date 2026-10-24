# T3 cutover ratification: clean source epoch, `T3.camera-experience-cutover@1`, T3.P01.S04

**Date:** October 19, 2026. **Status:** **owner-ratified and authorized 2026-10-19.** The owner
approved R1–R5 as written, with R5's Guide-free Presentation fix assigned to `T3.P01.S04`, in the
Batch C coordination session on 2026-10-19. The [approval patch](#approval-patch) is applied on the
coordination PR (#155). The ratification and the authorization take effect when that PR merges.

The reasoning is in the [batch C proposal](../../archive/roadmap/coordination-2026-10/batch-c-2026-10-19.md) §2 (C-1, C-2, C-4,
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

> **Status: superseded by AM-9 (ratified 2026-10-19) —
> not invoked.** The owner ruled every saved source, version, publication and resource disposable
> before the Source Baseline, so the F.2 migration exception has no covered data. No converter,
> inventory or reverse path exists. The cutover is AM-9's clean source epoch. The bullets below are
> retained as superseded provenance.

## R3 — Ratify `T3.camera-experience-cutover@1` with AM-9 as its contract

The anchor choice is PR #149's option A: one ratified interface neighbourhood, resolvable by the
register validator. The section was appended after AM-8 in
[composition-execution.md](../composition-execution.md#ratified-amendments). The proposal's
§2 explains each simplification relative to PR #149's [gate draft](../../roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s04-live-ownership-cutover/preflight/gate-draft.md).

The ratified text is now
[AM-9 in composition-execution.md](../composition-execution.md#am-9-shared-camera-and-experience-cutover).
It is the single copy; the draft that was here was moved there verbatim, with the ruling date
filled in. The [gate register](../../roadmap/README.md#gate-register) row is
`T3.camera-experience-cutover | 1 | … | ratified | T3.P01.S04`, and its evidence columns stay
empty until S04 is implemented and accepted.

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
  [batch C protocol](../../archive/roadmap/coordination-2026-10/cross-track-execution-2026-10-23.md#authorized-batch-c-2026-10-19).
- **Phase B** (the caller migration) starts only after the current-source freeze: `T1.P01.S05` and
  `T2.P01.S04` merged, or explicitly re-sequenced by the owner.
- **The merge is the code cutover.** Activation on the deployed environment (migration 005 and the
  deploys) is a separate owner-run step that follows the merged runbook.
- **Assigned defects.** S04 owns TD-6, TD-7, a working F2 sign-in Save recovery that closes TD-9 (removing the old path alone does not count), and the
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

Applied 2026-10-19 on PR #155, after the owner's approval:

1. AM-9 is appended to `composition-execution.md`. AM-7 carries R2's status paragraph. The header
   and the sole-providers line name AM-9.
2. The gate register row is `ratified` at version 1, with the AM-9 anchor and provider
   `T3.P01.S04`.
3. The S04 row in the [T3.P01 slice register](../../roadmap/t3-experience/t3.p01-camera-experience-foundation/README.md#slice-register)
   is `approved` and links this record. The phase and track status lines, the S04 plan and its
   authorization path read ratified/authorized.
4. The [K2 row](../../roadmap/core-editor-stability.md) records the gap as approved under R4.
5. The conditional banners in the T3.P01 README, the S04 plan and the
   [cross-track execution](../../archive/roadmap/coordination-2026-10/cross-track-execution-2026-10-23.md#source-first-migration-and-activation-ownership)
   section became ratified provenance. The cross-track AM-7 restatements were rewritten in AM-9
   terms. The frozen T4 drafts (`t4-release/**`, R1-D) are deliberately left unedited; T4 re-derives
   its inventory steps against AM-9 when its planning resumes.
6. The T3 baton names S04 phase A as NEXT.

## Owner signature

```text
R1 approved (scope as written)  R2 approved  R3 approved  R4 approved  R5 approved (Guide-free fix: S04)
Owner: repository owner (approved in the coordination session)   Date: 2026-10-19
```
