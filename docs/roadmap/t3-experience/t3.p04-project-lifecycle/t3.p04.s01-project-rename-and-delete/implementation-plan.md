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

## Planning review, release and owner directions (2026-10-24)

Verified against current `main` before release: every path in this plan's file-ownership table
still exists, and no `PATCH` or `DELETE` route for a project exists yet. The review found five
unresolved issues and records them, with proposals and alternatives, in the
[planning resolution](./planning-resolution-2026-10-24.md): the durable deletion/cleanup
mechanism, the migration contingency, the T2 → T3 API handoff, the T1 shell integration, and
Save/Delete concurrency. This plan's ownership and verification tier are unchanged.

**Owner review 2026-10-24 — rulings and two amendments.** The review accepted the release and
returned the deletion architecture for correction; the resolution's
[review corrections](./planning-resolution-2026-10-24.md#review-corrections-2026-10-24) name each one.
Two owner directions amend this plan's text below, deliberately and visibly:

- **which field owns the project name (R1)** — the authored envelope `name` is the only truth.
  Rename therefore writes one **new immutable version**, not metadata-only; the plan's former
  "preserves source revision" sentence is superseded.
- **what delete does with a published project (R2)** — delete refuses only while a publication is
  **active**, and removes the retained inactive publication and its releases after unpublication.

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

A successful rename appends **one new immutable version** whose only change is `name`, through the
same admission/conditional-save path a Save uses, and returns a refreshed summary and saved-base
metadata needed by the next conditional Save. It preserves source units, Camera/Experience
identities, every previous version, stable source identities and publication pins; the
[owner direction](./planning-resolution-2026-10-24.md#r1--which-field-owns-the-project-name-owner-direction-the-authored-envelope)
ows the persistence contract. It must not manufacture a revision identity: a fresh id is minted and
never reused for different contents (`revision-reuse` governs), the name-only document passes ordinary
unit validation, and a refusal writes nothing. Unchanged names are a no-op.

Do not leave an older Save able to restore the old name silently: a racing operation either
uses the refreshed base or refuses. A stale rename preserves the local draft and offers an
explicit refresh/retry after the creator sees the remote name. A rename that lands while the client
holds a dirty draft moves the base; the next Save refuses with `conflict` as after any remote save,
and the client adopts the refreshed base and the new name **without** discarding dirty work or
re-applying the old name. An active publication keeps serving its pinned pre-rename version.

### Delete and project-scoped resource cleanup

Add authenticated owner-scoped `DELETE /projects/:projectId` with the expected saved base
and an explicit UI confirmation naming the project. Revalidate owner and precondition under
the project lock; prevent a racing Save **and every project-owned object writer** — asset upload,
import upload and model approval — from recreating or writing into the deleted project. That fence
is a durable in-flight write lease the writers take before their first byte and delete respects
(retryable `project-busy`), plus each writer's own compensation on failed finalization: a listing
sweep alone cannot prove no writer is still running. A stale request refuses without destroying
local work. Retrying an already completed deletion is safe, with the existing not-found/privacy
policy applied consistently.

A project with an **active** publication refuses with an explicit unpublish-first message and is left
untouched. After unpublication the deletion removes the retained inactive publication and its
dependent releases; a public link never stops resolving as a silent side effect of a delete that had
an active publication.

Inventory the project's object keys from authoritative rows before cascade deletion removes
them: staged import files, retained approved model originals/derivative bytes, and any
project-owned asset bytes covered by the existing persistence contract. Use T2's project
namespace and retained-source metadata, never delete by an unchecked user key or a global
content hash. All stored project versions are deleted with the project; approval retention
is not limited to the current envelope's pins. Prove another project's identical-content
resource survives. Imported resource units/recipes and T2's admission semantics are unchanged.

Database and object-store deletion are not one transaction. In the implementation review,
fix the concrete durable retry/cleanup record using the existing persistence infrastructure:
commit a project-scoped key inventory **inside the deletion record** with the deletion
transaction, deny further project access, then delete those keys idempotently and acknowledge
cleanup only after success. Retain failed-key state for retry across process restart. Do not treat
the staging helper's best-effort deletion as proof that approved bytes were removed. If a minimal
durable cleanup record needs a migration, scope it explicitly to lifecycle cleanup and review it
with T2; no generic background platform, schedule or new dependency is authorized.

Acknowledge completion only when all of the following hold: the record committed, no unexpired
project write lease remains, the inventory keys are deleted, and **two consecutive project-scoped
listings** (filtered to `projects/<ns>/<projectId>/`; `ObjectStore.list()` returns the whole bucket)
are empty after a bounded quiet interval. Sibling projects' keys are ignored, never an error.
Exercise a retry through the owned lifecycle cleanup entry point; pending cleanup is an explicit
result, not a false completed-success claim. Missing storage support or an incompatible object-store
interface is a stop-and-report before implementation of deletion.

### Client and T1 shell patch

Use `platform/project-persistence.ts` for typed API requests/results and the existing project
list/open flow for Rename/Delete. T1's reviewed patch contributes those actions through the
current shell's project controls or command contributions under Round 2; no new global shell.
Keep confirmation and name editing keyboard/narrow/coarse-pointer accessible, focus correctly
returned, and refusals in words. Do not hide deletion inside the source Eraser or source Undo.

Renaming the open project appends its new version and refreshes the title and next Save metadata
without clearing dirty work/history and without replacing the open draft document. Deleting a
listed noncurrent project leaves the current session alone. Deleting the current project first uses the existing dirty-work
and guarded-replacement flow; cancellation preserves everything. Only confirmed server
success retires that session and returns to the existing project list/empty state. Preserve
source download/recovery where the guard offers it. A stale response after switching project
must not clear the newer session. Partial network failure retains enough operation state to
refresh/retry safely; UI distinguishes inaccessible project from pending byte cleanup. Type the
fence's `project-busy` refusal as retryable (keep the confirmation and offer retry) rather than as a
generic failure, and do not treat it as a permanent refusal.

## File ownership

| Surface | Writer / review | Scope |
| --- | --- | --- |
| `apps/api/src/{app.ts,project-persistence.ts,save-persistence.ts}` | T3; T2 shared-file coordination | Owner-scoped routes, locking, metadata/preconditions, lifecycle transaction |
| `apps/api/src/{model-persistence.ts,asset-persistence.ts,object-store.ts,purge-objects.ts,r2-purge.ts}` | T3 lifecycle patch reviewed by T2 | Exact owned-key inventory, the write-lease fence at all three writer call sites, per-writer compensation on failed finalization, and idempotent cleanup; import/admission remains T2-owned |
| `apps/api/migrations/` | T3 with T2 review if required | The two lifecycle tables (deletion record with key inventory, write leases); migration replay and failure recovery proved |
| `apps/editor/src/lib/platform/project-persistence.ts` | T3 | Typed lifecycle client and stale/conflict/busy/network handling |
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

- Owner can rename, Save and reopen; the rename appends exactly one version, the previous
  version and its revision remain readable, the next Save keeps the new name, and no-op
  renames do not alter source/history. Invalid name, unauthenticated/cross-owner requests and
  stale bases refuse; source JSON remains unchanged, and a refused rename mints no revision.
- Rename/Save/delete races serialize without stale name restoration, resurrection or lost
  draft. A rename landing on a dirty draft produces `conflict` on the next Save, and recovery
  adopts the new base and name without discarding the draft. A stale response after project
  switch cannot affect the new session.
- Confirmed delete removes all project versions and owned staging/approved resource rows;
  byte inventory is deleted or durably pending with tested retry. Inject object-store and
  transaction failures, process restart/retry and concurrent approval. No silent orphan claim.
- **Fence probes:** an upload in flight makes delete refuse `project-busy` and then succeed
  once the lease is released; a delete that commits first makes a new upload refuse before any
  object is written; a failed asset-upload finalize and a refused approval leave no object
  behind. Each of the three writers is exercised through the lease, not just the approval path.
- **Cleanup probes:** the completion check ignores a sibling project's keys, and an object
  visible only on a later listing keeps the record `pending` until two quiet scoped listings.
- **Publication probes:** an active publication refuses delete with the unpublish-first message
  and leaves the project and the public link untouched; after unpublication the project deletes,
  its retained inactive publication and releases are removed, and the public link stops
  resolving. No publication UI is added.
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
