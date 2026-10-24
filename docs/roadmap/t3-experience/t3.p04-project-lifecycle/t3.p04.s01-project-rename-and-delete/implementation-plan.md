# T3.P04.S01 — Project rename and delete

**Slice:** T3.P04.S01 · **Status:** **approved** — owner-authorized and released 2026-10-24, not
started. The authorization ships no implementation.
**Phase:** [T3.P04](../README.md) · **Runbook:**
[T3 operations](../../../../operations/t3-experience/README.md) · **Coordination:**
[next parallel batch](../../../cross-track-execution.md#next-parallel-batch)

```text
CONSUMES: F2.unit-envelope@1, F4.intent-acceptance@1
REQUIRES: F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:conditional-save-units-v1
VERIFICATION: exhaustive
```

This is T3.P04's sole child and **FINAL PHASE GATE**. It creates no gate/version, public
release capability or milestone acceptance. The proposed scope fulfils C3/K4; it is separate from
Capture/Preview's bounded final gate.

## Planning review, release and open rulings (2026-10-24)

Verified against current `main` before release: every path in this plan's file-ownership table
still exists, and no `PATCH` or `DELETE` route for a project exists yet. The review found five
unresolved issues and records them, with proposals and alternatives, in the
[planning resolution](./planning-resolution-2026-10-24.md): the durable deletion/cleanup
mechanism, the migration contingency, the T2 → T3 API handoff, the T1 shell integration, and
Save/Delete concurrency. Routine details are decided there; this plan's scope, ownership and
verification tier are unchanged.

Two decisions are the owner's because they change a persistence contract or product scope, and the
affected behaviour is not frozen before they are ruled:

- **which field owns the project name** — the authored envelope `name` is stamped into the project
  row on every Save, so a metadata-only rename can be silently reverted or diverge;
- **what delete does with a published project** — this plan names stored versions, staging and
  approved resources, not publications or releases.

The release ([decision](../../../../reference/decisions/t3-phase-close-and-p04-authorization-2026-10-24.md))
covers this slice only; its start conditions are the next section, and the runbook still re-verifies
every consumed gate and scope at the implementation's own trusted base.

## Start and ownership dependencies

T3.P02.S02 is accepted and this plan is owner-authorized and released on `now.md`; start once the
coordination PR carrying that release merges, and after the runbook verifies every consumed
gate/scope on the trusted base. Use
post-S01 T2 model storage and retention interfaces on integrated `main`. Coordinate with
then-current T2 import/placement work before changing shared API files; T3 takes the lifecycle
API patch, T2 retains import/admission and model-format ownership. T1 owns the shell patch and
reviews it before implementation. This capacity ordering imposes no predecessor on the
immediate T1/T2/T3 parallel batch.

## Concrete behavior

### Rename

Add authenticated owner-scoped `PATCH /projects/:projectId` for a trimmed, bounded nonempty
project name. Reuse the existing name constraints and project saved-base/version metadata;
reject missing/stale preconditions and cross-owner access consistently with existing Save.
The request carries the expected saved base (and version where the existing protocol uses it).
Serialize against Save and delete using the project row's existing concurrency discipline.

A successful rename updates project metadata and returns a refreshed summary and saved-base
metadata needed by the next conditional Save. It preserves source units, source revision,
Camera/Experience identities, stored versions and source history. Unchanged names are a no-op.
Do not leave an older Save able to restore the old name silently: a racing operation either
uses the refreshed base or refuses. A stale rename preserves the local draft and offers an
explicit refresh/retry after the creator sees the remote name.

### Delete and project-scoped resource cleanup

Add authenticated owner-scoped `DELETE /projects/:projectId` with the expected saved base
and an explicit UI confirmation naming the project. Revalidate owner and precondition under
the project lock; prevent a racing Save/import approval from recreating or approving into the
deleted project. A stale request refuses without destroying local work. Retrying an already
completed deletion is safe, with the existing not-found/privacy policy applied consistently.

Inventory the project's object keys from authoritative rows before cascade deletion removes
them: staged import files, retained approved model originals/derivative bytes, and any
project-owned asset bytes covered by the existing persistence contract. Use T2's project
namespace and retained-source metadata, never delete by an unchecked user key or a global
content hash. All stored project versions are deleted with the project; approval retention
is not limited to the current envelope's pins. Prove another project's identical-content
resource survives. Imported resource units/recipes and T2's admission semantics are unchanged.

Database and object-store deletion are not one transaction. In the implementation review,
fix the concrete durable retry/cleanup record using the existing persistence infrastructure:
commit a project-scoped key inventory with the deletion transaction, deny further project
access, then delete owned keys idempotently and acknowledge cleanup only after success.
Retain failed-key state for retry across process restart. Do not treat the staging helper's
best-effort deletion as proof that approved bytes were removed. If a minimal durable cleanup
record needs a migration, scope it explicitly to lifecycle cleanup and review it with T2;
no generic background platform, schedule or new dependency is authorized. Exercise a retry
through the owned lifecycle cleanup entry point; pending cleanup is an explicit result, not
a false completed-success claim. Missing storage support or an incompatible object-store
interface is a stop-and-report before implementation of deletion.

### Client and T1 shell patch

Use `platform/project-persistence.ts` for typed API requests/results and the existing project
list/open flow for Rename/Delete. T1's reviewed patch contributes those actions through the
current shell's project controls or command contributions under Round 2; no new global shell.
Keep confirmation and name editing keyboard/narrow/coarse-pointer accessible, focus correctly
returned, and refusals in words. Do not hide deletion inside the source Eraser or source Undo.

Renaming the open project refreshes its title and next Save metadata without replacing the
authored envelope or clearing dirty work/history. Deleting a listed noncurrent project leaves
the current session alone. Deleting the current project first uses the existing dirty-work
and guarded-replacement flow; cancellation preserves everything. Only confirmed server
success retires that session and returns to the existing project list/empty state. Preserve
source download/recovery where the guard offers it. A stale response after switching project
must not clear the newer session. Partial network failure retains enough operation state to
refresh/retry safely; UI distinguishes inaccessible project from pending byte cleanup.

## File ownership

| Surface | Writer / review | Scope |
| --- | --- | --- |
| `apps/api/src/{app.ts,project-persistence.ts,save-persistence.ts}` | T3; T2 shared-file coordination | Owner-scoped routes, locking, metadata/preconditions, lifecycle transaction |
| `apps/api/src/{model-persistence.ts,asset-persistence.ts,object-store.ts,purge-objects.ts,r2-purge.ts}` | T3 lifecycle patch reviewed by T2 | Exact owned-key inventory and idempotent cleanup only; import/admission remains T2-owned |
| `apps/api/migrations/` | T3 with T2 review if required | Minimal durable cleanup state; migration replay and failure recovery proved |
| `apps/editor/src/lib/platform/project-persistence.ts` | T3 | Typed lifecycle client and stale/conflict/network handling |
| Existing project list/control surfaces and `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` or `authoring/stage/shell/` where required | T1-owned, explicit reviewed integration patch | Rename/Delete controls, guarded session replacement and title refresh only |
| `apps/api/tests/{projects,save-units,model-resources,r2-purge}.test.mjs`, API fixtures | T3; T2 review of model probes | Real-DB lifecycle/concurrency/cleanup and isolation |
| `apps/editor/tests/lib/platform/project-persistence.test.ts` and affected host/project-session contracts | T3 with T1 review | Client/refusal/race and dirty-session behavior |

No changes to Camera evaluation, Experience editorial semantics, Layout/compiler, resource
formats, prepared releases or public readers. A necessary change outside these surfaces is
reported for scope review before mutation.

## Acceptance and verification

**VERIFICATION: exhaustive.** At one integrated recorded revision, run the complete editor
suite, architecture and heavy lanes, root `check`/`build`, affected package checks, `check:api`
and fresh DB-backed `test:api` with **zero skips**, per the
[test contract](../../../../../apps/editor/tests/README.md#what-a-change-requires).
Record DB target/cleanup, browser revision/viewport/input/reduced-motion settings, independent
review and complete merge gate on then-current `main`. Use
[browser hygiene](../../../../../.agents/skills/browser-hygiene/SKILL.md).

Required behavioral probes:

- Owner can rename, Save and reopen; no-op does not alter source/history. Invalid name,
  unauthenticated/cross-owner requests and stale bases refuse; source JSON remains unchanged.
- Rename/Save/delete races serialize without stale name restoration, resurrection or lost
  draft. A stale response after project switch cannot affect the new session.
- Confirmed delete removes all project versions and owned staging/approved resource rows;
  byte inventory is deleted or durably pending with tested retry. Inject object-store and
  transaction failures, process restart/retry and concurrent approval. No silent orphan claim.
- Another project and another owner survive, including identical-content approved models;
  historical-version model resources are cleaned even when the latest source no longer pins them.
- Current/noncurrent project actions, dirty confirmation cancellation, conflict recovery,
  source download and list refresh work from the actual UI; keyboard and narrow/coarse-pointer
  journeys preserve focus and legible refusal.
- Existing conditional Save, import approval, visitor/public/Preview isolation and epoch fence
  remain green. No publication or deployment/epoch activation is attempted.

Record applicable F9 rename/next-Save responsiveness and resource-cleanup observations on a
named fixture with retained versions and model files; use the existing on-demand workflow or
equivalent reproducible evidence. Report pending cleanup honestly and avoid adding blocking
bulk work to the Stage. Any applicable hard performance row follows the reference-machine
rules; prior owner overrides are not waivers for this slice. Record all unrun rows/limitations.

Write results only in [acceptance.md](./acceptance.md) after authorization and execution.
Passing makes P04 closable, not closed. Production F2 activation, milestone acceptance and
T4 planning authorization remain separate owner operations.
