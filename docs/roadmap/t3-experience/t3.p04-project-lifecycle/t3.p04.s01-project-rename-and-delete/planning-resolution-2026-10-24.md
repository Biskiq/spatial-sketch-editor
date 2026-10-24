# T3.P04.S01 — planning resolution against current main (2026-10-24)

**Slice:** T3.P04.S01 · **Plan:** [implementation-plan.md](./implementation-plan.md) (owns scope and
criteria) · **Phase:** [T3.P04](../README.md) · **Authorization:**
[decision](../../../../reference/decisions/t3-phase-close-and-p04-authorization-2026-10-24.md)

This record resolves the plan's open implementation questions against the tree at `main`
`2215af34`. It changes no format or verification tier, and it amends ownership only where §3 says
so. It decides the routine mechanisms, proposes the two rulings that change a persistence contract
or product scope, and names every amendment to the plan. Nothing here authorizes implementation, and
no behaviour below is built.

**Revised twice on 2026-10-24 after review.** The first review rejected the claim that a prefix
sweep plus an empty second listing proved cleanup complete. That produced the write fence, the
persisted inventory and the project-scoped listing; the second review found the fence's remaining
hole (a lease that merely expires does not prove its writer stopped) and an inventory gap (approved
model source copies are not recorded in any column). Section 1 now revokes leases and requires an
acknowledged stop or an enforced write deadline before completion, section 2 persists the revision's
full key set, and section 3 states the inventory's exact coverage rather than overstating it. R1 and
R2 are recorded as **proposed** rulings and remain unfrozen until the owner ratifies them.

```text
DECIDED HERE (routine mechanism, inside the plan's stated allowance)
  1  durable deletion/cleanup mechanism      → revocable write lease + enforced deadline + persisted
                                               inventory + bounded, scoped completion sweep
  2  migration contingency                    → migration 007 (two tables + one column), no CASCADE retrofit
  3  T2 → T3 API handoff                      → one inventory + the fence on all three writers +
                                               a persisted approved-source key set
  4  T1 shell integration                     → list-row actions + Head commands, no new shell
  5  Save/Delete concurrency                  → one project row lock + expected base, ordered deletes

PROPOSED OWNER RULINGS — NOT RATIFIED (R1/R2 below; nothing is frozen until they are)
  R1  the authored envelope owns the name     → rename appends one immutable version, F4-reconciled
  R2  delete of a project with a publication  → refuse only while a publication is ACTIVE
```

## Reconciliation against current main

| Fact | Evidence at `2215af34` | Consequence for this plan |
| --- | --- | --- |
| No project lifecycle route exists | `apps/api/src/app.ts` has `GET /projects`, `PUT /projects/:projectId`, `GET /projects/:projectId`; no `PATCH` or `DELETE` route for a project | Both routes are genuinely new surface; no existing route shape to mirror except the owner-scoped load |
| Save is conditional and row-locked | `apps/api/src/save-persistence.ts` proves ownership before the lock, then `SELECT … FOR UPDATE`, compares `saved_base_token`, appends `project_versions`, stamps `saved_base_token`/`saved_revision` and `name` | Rename/delete reuse the same lock and precondition; no second serialization primitive |
| The project name has two homes | `save-persistence.ts` writes `SET name = $3` from the admitted source (`finalSource.name`); `listProjects`/`loadProject` read `projects.name`; the F2 envelope also carries `name`, and the save capture's name is derived from the captured source | **R1.** A metadata-only rename can be reverted by the next Save |
| Delete order is not free | `project_versions`, `assets`, `publications` reference `projects` with no cascade; `releases` references `project_versions`; `save_receipts`, `model_imports`, `model_revisions` cascade | Delete must remove `releases → publications → assets → project_versions → project` explicitly, after reading the key inventory |
| Model rows already inherit deletion | `apps/api/migrations/006-model-resources.sql` states project deletion deletes the project's revisions via `ON DELETE CASCADE` | C3's judgement is already recorded; do not re-open it |
| Project-owned keys are project-prefixed | `asset-persistence.ts`: `projects/<ns>/<project>/assets/<uuid>/<hex>`; `model-persistence.ts`: `…/models/imports/<importId>/<fileId>` and `…/models/revisions/<contentHash>/<name>` | The key shapes are project-scoped, but **listing is not**: `ObjectStore.list()` returns every visible key in the bucket. A sweep must filter to the project prefix and must not treat sibling keys as an error (§1, F3) |
| The existing purge is asset-shaped and would refuse | `r2-purge.ts` verifies every listed key against an **assets-only** pattern; a bucket holding model keys throws `R2PurgeRefusal` | Cleanup needs the prefix owned by the lifecycle, and `r2-purge`'s ownership predicate must learn the model shapes |
| Approval writes bytes before its row | `model-persistence.ts` `putBytes(...)` then `INSERT INTO model_revisions … ON CONFLICT DO NOTHING` | A delete concurrent with an approval can leave bytes with **no row to inventory**; the write must be fenced and compensated, not merely swept (§1, F1) |
| Approval writes source copies that no column records | `approveModelImport` writes `projects/<ns>/<projectId>/models/revisions/<contentHash>/source/<path>` per source file; `model_revisions` stores only `derivative_key`, and `model_import_files.object_key` names the staging keys | The inventory misses every approved source copy unless the revision's key set is persisted (§2, follow-up F2) |
| Every object write runs in this API process | `uploadAsset` and `uploadModelFile` stream the body and `approveModelImport` uses `putBytes`; no presigned client `PUT` exists | A revocation check and a hard write deadline can be enforced in-handler; a client-held credential could not be fenced (§1) |
| Writers do not all clean up after themselves | `asset-persistence.ts` marks its row `failed` on a stream error and writes nothing back on a failed finalize; `model-persistence.ts` deletes its key on stream/hash/finalize failure but the approval path has no compensation | Compensation is part of the fix, because a process death is not a refused write (§1) |
| Unpublish retains the publication row | `publication-persistence.ts` `unpublishVersion` sets `active_version = NULL` and keeps the row and its `public_id` | A "refuse while a publication row exists" precondition would make a formerly published project permanently undeletable — R2's corrected ruling |
| Nothing ships a lifecycle control | `apps/editor/src/routes/projects/+page.svelte` lists projects and opens them; `EditorHead` renders `projectName` with Save/Preview; no rename or delete affordance exists | The T1 patch is a small **new** control group, not wiring to an existing one |
| The client has one write | `ProjectApi` exposes `listProjects`, `saveAcceptedSource`, `loadProject`, asset calls; `ProjectPersistenceError` already types `conflict`, `not-found`, `network` | Add two typed calls; reuse the existing error vocabulary and refusal wording |

## 1. Durable deletion and cleanup — decided

**The claimed guarantee was wrong.** "Delete the rows, list the prefix, list again and see it empty"
does not prove no writer is still in flight. Three writers create project-owned keys, and none of them
holds a lock a delete respects:

| Writer | Byte write | Failure compensation today |
| --- | --- | --- |
| asset upload (`uploadAsset`) | streams to `…/assets/<assetId>/<hex>` after the claim `UPDATE` | none — a stream error marks the row `failed` and leaves the bytes; a refused finalize `UPDATE` leaves the object |
| model file upload (`uploadModelFile`) | streams to `…/models/imports/<importId>/<fileId>` | deletes its own key on stream failure, hash mismatch and a failed finalize |
| model approval (`approveModelImport`) | writes derivative and source bytes, then inserts `model_revisions` | none — a refused or failed insert leaves the bytes |

The interleaving that breaks the first draft: an asset upload passes its ownership check and starts
streaming, delete removes every row, cleanup lists (the object is not visible yet), lists again,
marks complete, and the upload finishes writing. Its finalize fails because the project is gone, and
the bytes remain with `cleanup: complete` on the record.

**Why expiry alone is not a fence (follow-up review).** An expired lease says only that a heartbeat
stopped, not that its writer stopped. A partitioned process, a stalled body stream or a slow
`PutObject` can outlive `expires_at`, commit after cleanup listed twice and wrote `complete`, and
leave an orphaned object behind a record that claims it is gone. Expiry is a liveness guess; a real
fence needs an **acknowledged stop**, or a **hard bound** enforced by the code doing the writing.
Both are used here, because neither covers the other's failure.

**Deletion/write fence (preferred).** A revocable, acknowledged lease with a hard deadline, built on
the project row lock Save already uses:

- **Start.** Before the first byte the writer takes
  `SELECT 1 FROM projects WHERE id = $1 AND owner_id = $2 FOR KEY SHARE` (compatible with other
  writers, conflicts with delete's `FOR UPDATE`) and inserts `project_write_leases` (`lease_id`,
  `project_id`, `kind`, `started_at`, `heartbeat_at`, `deadline_at`, `revoked_at`, `released_at`).
  A missing project row refuses before any byte is written.
- **Heartbeat that reports revocation.** While streaming, the handler renews every `RENEW` (2 s) with
  `UPDATE project_write_leases SET heartbeat_at = now() WHERE lease_id = $1 AND revoked_at IS NULL
  RETURNING project_id`. An empty result means *revoked*: the handler immediately destroys the
  inbound stream, aborts the `PutObject` and writes nothing further. A renewal that **errors** is
  treated the same way — fail closed, never assume the lease is still held. This is the acknowledged
  stop, and the lease is released (`released_at = now()`) in a `finally` on success and on failure.
- **Hard deadline.** `deadline_at = started_at + MAX_WRITE` and is **never extended**. An
  `AbortController` fires at it in the handler whether or not revocation was noticed, so a writer
  that cannot reach the database still cannot write past its bound. `MAX_WRITE` is set from the
  route's enforced request timeout, not guessed.
- **Delete revokes, then proceeds.** Under the project row `FOR UPDATE` it verifies owner and
  expected base, then revokes every lease that is neither released nor revoked (`revoked_at =
  now()`) and refuses with retryable `project-busy`, writing nothing. It deletes only when **every
  lease is released or past `deadline_at`**; a revoked-but-unreleased lease inside its deadline is
  still a live writer, so that attempt refuses `project-busy` again rather than waiting in-process.
  When it does proceed it records `fenced_at = now()`.
- **Loop bound.** A live writer costs one `project-busy` (it releases within `RENEW` plus its abort
  time); a partitioned one costs retries until its `deadline_at`. That is why the bound must be
  modest, and why the client treats `project-busy` as retry rather than failure.
- **Compensation, not only the fence.** Each writer deletes the keys it wrote when its finalization
  fails (asset upload and model approval need this added; model upload already does).

**Cleanup and the completion check.** After commit, cleanup deletes the **persisted inventory** keys
(§2), then runs a **project-scoped** listing (F3): filter `ObjectStore.list()` to
`projects/<ns>/<projectId>/` and ignore every other key rather than refusing it. Completion requires
all of:

1. the tombstone committed and `fenced_at` recorded;
2. every lease released, or past its `deadline_at`;
3. `now() - fenced_at >= MAX_WRITE + RENEW + abort margin`, so no request that began before the
   fence can still be writing;
4. the inventory keys deleted; and
5. two consecutive scoped listings, both empty, the second taken **at or after** that bound (so a
   key from a write that started before the fence has had its whole lifetime to appear).

Only then does the record reach `state = 'complete'`. Otherwise the response is `cleanup: pending`,
retried by (a) repeating the `DELETE` and (b) the owner-run CLI in the existing `purge-objects.ts`
style (`npm run cleanup:projects`, pending and stale records). No scheduler, daemon or new
dependency.

**What the fence still cannot prevent, stated rather than papered over.** A `PutObject` that has
received all its bytes may commit on the store after its handler died and its socket closed: R2
discards an incomplete upload, but a complete one whose response was lost is durable and becomes
visible. That is why completion rests on a listing **after the enforced bound** rather than on the
lease, and why a later run that finds a key under a completed record reports the discrepancy and
deletes it — defense in depth, not a second guarantee.

**Regression scenario — a write that completes after lease expiry.** The fake `ObjectStore` holds
the `PutObject` while the writer's heartbeat stops and its lease expires early (`deadline_at` still
in the future):

1. delete revokes and answers `project-busy`; nothing is removed;
2. before `deadline_at`, cleanup lists twice, finds the prefix empty and must still report
   `pending` — the bound, not the empty listing, is what licenses `complete`;
3. past the bound the handler's `AbortController` fires, the store aborts the held write and nothing
   commits, so the next run marks `complete`;
4. the hostile variant lets the fake commit after `complete`; the CLI verify run must find the key,
   delete it and report it, and a completion must never be claimed for a key the caller could still
   see.

**Why the inventory survives and the sweep does not replace it.** The inventory is the durable truth
the approved plan requires; the scoped sweep is the completion oracle that catches keys written by a
writer the inventory cannot see, and it is the only mechanism that can catch a key whose row was
never committed. Neither is sufficient alone.

**Alternatives.** (a) **Advisory-lock-only fence** (session shared/exclusive, delete waits): less
schema, but no durable in-flight record, hard to test without blocking, and a hung session blocks
deletion indefinitely. (b) **Tombstone-only denial** at writer start — the plan's "deny further
project access": covers new writers only, not in-flight ones. (c) **Grace-period sweeps** without a
fence: no guarantee and an unbounded wait. (d) **Per-chunk object-store conditional writes**
(`If-Match` on a fence object): R2 conditions are per object, not per prefix, so they cannot gate a
write to a different key — rejected. The preferred design keeps (b) as its first step and adds the
revocable lease, the enforced deadline and compensation.

**Tradeoff and risk.** The fence adds a lease table, a `FOR KEY SHARE` on every upload and approval,
a 2 s renewal while streaming (one cheap `UPDATE`), a retryable `project-busy` path and a delete that
can answer `pending` for up to the write bound. `MAX_WRITE` must be sized to the slowest *permitted*
upload (the 50 MiB source set at the deployment's minimum throughput) with margin, and it must be a
hard route limit — an upload that cannot finish inside it is refused explicitly rather than silently
aborted at the bound. That is the price of not claiming a completeness it
cannot prove. It also makes the §3 handoff a merge condition: the fence is only real if all three
writers use it.

## 2. Migration contingency — decided

Add **migration 007** with the two lifecycle tables and one column (idempotent
`CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`, guarded constraints), matching the
replay-safe style of `001`–`006` under the runner's session advisory lock:

- `project_deletions` — `project_id` primary key, `owner_id`, `object_namespace`, `state`
  (`pending|complete`), **`key_inventory jsonb`**, `fenced_at`, `attempts`, `last_error`, timestamps,
  index on `(state, created_at)`. **No foreign key to `projects`**: the project row is deleted in the
  same transaction that inserts the record. Owner-scoped, so a retry cannot resume another owner's
  cleanup.
- `project_write_leases` — `lease_id` primary key, `project_id`, `kind`, `started_at`, `heartbeat_at`,
  `deadline_at`, `revoked_at`, `released_at`, index on `(project_id, deadline_at)`. **No foreign key
  either**, so a dead writer's lease stays inspectable after its project is gone.
- `model_revisions.source_keys jsonb` (added to the T2-owned table, T2 review): the approved
  revision's full source-copy key set. Nullable, because pre-007 rows are backfilled rather than
  blocked; guarded by `CHECK (source_keys IS NULL OR jsonb_typeof(source_keys) = 'array')`. The
  approval path always populates it, and a `NULL` seen at deletion time marks that revision
  `sweep-dependent` (below). A replay is a no-op.

**The inventory is persisted, not recomputed.** This corrects F2 and restores the approved plan's
contract: after the rows are deleted, the inventory can no longer be read from them, so a crash
between commit and cleanup would lose it. The keys read inside the deletion transaction are written
into `key_inventory`, and cleanup deletes from that record idempotently on every retry. The prefix
listing is a *completion check*, not a substitute.

**Approved source copies are a recorded key set (follow-up F2).** `approveModelImport` writes one
derivative plus one object per source file at
`projects/<ns>/<projectId>/models/revisions/<contentHash>/source/<path>`, and the table stores only
`derivative_key`. An inventory built from today's columns therefore misses **every approved source
copy** — the exact gap the review found. The fix is the column above, written in the same `INSERT`
as the revision that owns the bytes and produced by one `revisionObjectKeys(projectId, namespace,
contentHash, sourcePaths)` helper that both the approval path and `ownedObjectKeys` call, so the two
cannot drift. Backfill for pre-007 revisions derives the same keys from the retained
`model_imports.revision_id` → `model_import_files.path` rows (`role = 'source'`); a revision whose
import rows are gone cannot be backfilled and is recorded `sweep-dependent`, with its cleanup resting
on the scoped listing rather than claiming inventory coverage it does not have.

**Coverage statement — no overstatement.** `key_inventory` is complete for keys an owning row
records: `assets.object_key`, `model_import_files.object_key` (staging keys; some are already
removed, so deletion is idempotent), `model_revisions.derivative_key`, and
`model_revisions.source_keys`. It is **not** a claim about keys written by a writer that crashed
before its row committed; those are covered only by the bound-plus-sweep completion check. Cleanup
never reports `complete` from the inventory alone.

**No CASCADE retrofit.** Adding `ON DELETE CASCADE` to `project_versions`, `assets` or `publications`
would delete rows before the inventory is read and would make the durable record's content
unknowable. The explicit ordered delete is the mechanism; `006`'s existing cascade for model rows
stays as recorded.

**Contingency rules.** The two lifecycle tables are empty at creation, so only `source_keys` needs a
backfill, and that backfill is derived and idempotent; no epoch activation applies. `005`'s
production activation remains a separate owner-run operation and 007 rides the same owner-run
migration step. If implementation finds it needs a migration outside lifecycle cleanup, or a store
that supports neither prefix listing nor the four row sources, that is a **stop-and-report** before
deletion is written — not a workaround.

## 3. T2 → T3 API handoff — decided, T2 review required

**Consumed read-only:** `assets.object_key`; `model_import_files.object_key`, `.state`,
`.expires_at`; `model_revisions.derivative_key` and the new `.source_keys`;
`ObjectStore.list`/`delete`; the owner checks and byte-write sequences in `uploadAsset`,
`uploadModelFile` and `approveModelImport`.

**Proposal (preferred).** One `ownedObjectKeys(db, projectId)` function in T3's lifecycle module is the
single inventory, reviewed by T2. A written invariant binds future work: *a new project-scoped object
key must live under `projects/<ns>/<projectId>/`, must be recorded by the row that owns it, and must
be added to that function.* T3 takes the lifecycle route and its client; T2 keeps import, admission,
model formats and the approval path.

**Two T2-owned changes ride this handoff.** (1) `model_revisions.source_keys` in migration 007 and the
shared `revisionObjectKeys` helper, without which the inventory silently omits approved source
copies; (2) the write lease in `uploadModelFile` and `approveModelImport` and their missing
compensation. Both need T2 review because they touch model storage and the approval path; neither is
optional. If T2 would rather own the column itself, its migration and the helper move to a T2
migration, and 007 keeps only the lifecycle tables — the requirement is the persisted set, not who
writes the DDL.

**The fence is a merge condition, not a suggestion (F1).** A shared helper
`withProjectWriteLease(pool, ownerId, projectId, kind, fn)` lives in T3's lifecycle module and is the
only way a project-owned writer starts. T3 wraps `uploadAsset`; the two model writers are wrapped by
T2 or by T3 in a patch T2 reviews, and that patch adds the approval path's missing compensation. A
review must be able to point at all three call sites. Either split is acceptable; what is not is
merging while any project-owned writer bypasses the lease, because a fence with a hole is exactly
the first draft's mistake. Should neither T2 nor the T2-reviewed patch land, the stop-and-report is
to the owner, not a sweep-only fallback.

**Coordination.** `app.ts` and `project-persistence.ts` are shared files: T3's patch is additive and
serialized against T2's then-current work, per the plan's file-ownership table. `project-persistence.ts`
also carries the create-only branch's `project_deletions` read (§5).

## 4. T1 shell integration — decided

**Proposal (preferred).** Two entry points, no new global shell:

- **Project list** (`/projects`): a rename control on the row (inline, keyboard-first) and a delete
  control whose confirmation names the project; a successful delete refreshes the list.
- **Open project** (`EditorHead`'s `projectName` region): Rename and Delete commands. Delete routes
  through the existing dirty-work and guarded-replacement flow; cancellation preserves everything;
  only confirmed server success retires the session and returns to the list.

Both stay keyboard reachable, return focus to the triggering control on refusal/cancel, use legible
refusals rather than disabled controls, and work at narrow/coarse-pointer widths. Rename must refresh
the title and the next Save's base. Deletion is never hidden inside the source Eraser or source Undo.

**Sequencing.** T1 owns and reviews this patch before implementation, and it is serialized against
`T1.P02.S06`'s recorded claim on `+page.svelte` and `authoring/stage/shell/`. P04 must not edit the
shared perf harness or fixtures. If the shell needs more than the bounded patch — a new project
surface, a new global menu or a change to the Head's contract — that is a stop-and-report to T1, not
an expansion here.

## 5. Save / Delete / Rename concurrency — decided

**One lock, one precondition.** Every lifecycle write locks the same `projects` row with `FOR UPDATE`
and compares the same `saved_base_token` the Save path compares. A stale rename or delete refuses with
`conflict` and writes nothing; no remote contents are attached, matching Save's refusal shape.

**Ordering outcomes.**

- *Save then rename:* Save moves the base; the stale rename refuses; the client refreshes and retries
  after showing the remote name.
- *Rename then Save:* rename moves the base; the stale Save refuses and its draft is preserved. The
  client adopts the refreshed base and applies the new name to the draft, so the next Save persists a
  consistent name (this is the part that depends on **R1**).
- *Save then delete:* delete's base check refuses; nothing is destroyed.
- *Delete then Save:* `loadProject`/Save answer not-found; the draft stays local and the route offers
  download/recovery where it already does.
- *Writer in flight, then delete:* delete revokes every live lease and answers retryable
  `project-busy`; the writer's next heartbeat reports the revocation, it aborts the stream and the
  `PutObject`, releases the lease and writes nothing more. The retried delete then proceeds. Nothing
  is deleted on the first attempt, and the client shows retry, not failure.
- *Delete commits, then a writer starts:* the lease's `FOR KEY SHARE` finds no project row and the
  write refuses before a byte is written (upload) — for approval, the foreign key refuses the
  revision insert as before.
- *Delete then create-only with the same id:* the durable `project_deletions` record makes the
  create-only path answer `collision` instead of resurrecting an empty project. This is one additive
  read in the create-only branch; it changes no existing refusal's meaning.
- *Lease held by a crashed or partitioned writer:* nothing renews it, so it passes `deadline_at`;
  delete proceeds without waiting for an acknowledgment, and the handler-side deadline means no
  process can still be streaming past that point. Completion still waits for the enforced bound (§1).

**Client rules.** Every lifecycle result carries its `projectId`; a response whose id no longer
matches the mounted session is dropped (the same rule the Save client already needs after a project
switch). Partial network failure keeps the operation state so the UI can refresh/retry, and the UI
distinguishes "inaccessible project" from "pending byte cleanup".

## R1 — Which field owns the project name? (proposed: the authored envelope)

**The conflict.** The plan requires rename to preserve source units, source revision, history and
stored versions. But Save stamps `projects.name` from the admitted source's `name` on every save, and
the list and title read the row. So a metadata-only rename is reverted by the next Save of a document
that still carries the old name; leaving the two in place instead creates a silent divergence between
the list, the title and the stored envelope.

**Proposed ruling (2026-10-24, awaiting ratification): option A.** The authored envelope `name` is the
only truth. Rename writes it as one new immutable version and retains every previous version, stable
source identities and publication pins. The alternative — the row owning the display name while Save
stops stamping it — would keep two writable names and changes what conditional Save writes; it is
rejected. This is an **intentional amendment** to the plan's metadata-only rename and its "preserves
source revision" sentence, recorded here and in the plan, not a routine detail, and it is **not
frozen** until the owner ratifies it.

**How it works, without inventing a revision identity.** `project_versions.document` holds the whole
document and `loadProject` already reads it, so the server can load the latest document, change only
`name`, and give it to the **same** admission/conditional-save path the UI uses. Three F4 obligations
bind that path:

1. **One fresh identity, never reused.** The new version carries a newly minted `revisionId`.
   `save-persistence` refuses any revision identity reused for different contents (`revision-reuse`,
   checked against the row and every receipt), so rename must never recycle the previous id; a new
   id is minted for the new bytes, never attached to bytes it has already committed. The route is not
   a second writer: it calls the same save handler, so admission, canonicalization and receipt
   writing are shared.
2. **No bypass.** The name-only document must pass the ordinary unit validation. If validation
   refuses, rename refuses and writes nothing — it never writes a row and a version that disagree.
3. **The open draft is preserved, never overwritten.** Rename moves the base, so the client's draft
   base becomes stale: its next Save refuses with `conflict` exactly as after a remote save. The
   client then adopts the refreshed base **and** the new name while keeping the dirty draft and its
   edit history; it must not silently re-apply the old name, and rename must not clear dirty work.

**Publication consequence, stated not hidden.** A publication pins a `project_versions` row, so an
active publication keeps serving the pre-rename version and its old name until the owner updates the
publication. That is correct for an immutable release and is recorded here so implementation does not
"fix" it by rewriting a pinned version.

**Cost.** Rename becomes a version-producing write (one extra document version and receipt per
rename) rather than a row update. Proposed, not yet accepted.

## R2 — What does delete do with a published project? (proposed: active only)

**The gap.** The plan's cleanup list covers stored versions, staging and approved model resources, and
its probes never mention `publications` or `releases`. Yet `publications.project_id` references the
project and `releases` references `project_versions`, so a delete cannot proceed without deciding what
happens to a live or dormant publication. Publication UI is T4 territory and T4 is frozen, but
API-level rows can exist.

**Correction to the first draft.** It proposed refusing while any `publications` row exists, with
"unpublish first" as the way out. That precondition is unsatisfiable: `unpublishVersion` sets
`active_version = NULL` and deliberately **retains** the row and its `public_id`, so a previously
published project could never be deleted. The owner raised this in review, and it is why R2's
precondition is stated as *active*, not *present*.

**Proposed ruling (2026-10-24, awaiting ratification).** Refuse delete **only while a publication is
active**
(`publications.active_version IS NOT NULL`), with an explicit "unpublish this project before deleting
it" refusal and the project untouched. After unpublication the project is deletable: the deletion
transaction removes the retained inactive `publications` row and its dependent `releases` rows before
`project_versions`, and retires the `public_id`. A public link therefore stops resolving because the
owner unpublished and then confirmed a deletion that named the project — never as a silent side
effect of a delete that had an active publication. T4 may revisit these semantics when prepared
publication exists; P04 invents no publication lifecycle.

**Alternatives.** Delete-implies-unpublish even while active: rejected, it destroys a live public link
under a confirmation that named only the project. UI-only hiding: rejected, it leaves the API hole.
Row-existence refusal: rejected as unsatisfiable, above.

**Consequence to state in the UI.** The delete confirmation names the project and, for a project with
an inactive publication, says its public link will stop resolving. A project with an active
publication shows the unpublish-first refusal instead of a doomed confirmation.

## Review corrections

Two review rounds on 2026-10-24. Every change below answers a finding; nothing was amended silently.

### Round 1 — deletion architecture

| Finding | Correction |
| --- | --- |
| **F1** — an in-flight writer can create a key after cleanup "completed" | §1 replaces the listing-only completion test with a write fence on all three object writers, a retryable `project-busy` refusal, and per-writer compensation on failed finalization. |
| **F2** — the durable record dropped the plan's key inventory | §2 adds `key_inventory jsonb` to `project_deletions`; the inventory read inside the deletion transaction is the durable truth, and the scoped listing is only the completion check. |
| **F3** — `ObjectStore.list()` returns the whole bucket | §1 requires a project-scoped listing. Sibling projects' keys are ignored, never treated as a cleanup error, and this stays distinct from `r2-purge`'s global epoch contract. |
| **R1** — name authority | The authored envelope would own the name; rename appends one immutable version through the shared save path, with the three F4 obligations above and dirty-draft preservation. |
| **R2** — publication precondition | Refuse only while the publication is **active**; remove the retained inactive row and its dependent releases after unpublication. The first draft's row-existence precondition was unsatisfiable. |

### Round 2 — the expiry hole and the source-copy gap

| Finding | Correction |
| --- | --- |
| **F1 (follow-up)** — lease expiry does not prove an in-flight write has terminated | §1 makes the lease **revocable**: the writer heartbeats every 2 s and an empty renewal result aborts the stream and the `PutObject`; delete revokes and answers `project-busy`, then proceeds only when every lease is released or past a non-extendable `deadline_at` enforced in the handler. Completion waits out that enforced bound, then requires two empty scoped listings. A regression scenario for a write that outlives its lease is specified. |
| **F2 (follow-up)** — approved model source copies are absent from the persisted inventory | §2 adds `model_revisions.source_keys`, written in the same `INSERT` as the owning row through the shared `revisionObjectKeys` helper, backfilled from retained import paths, and marked `sweep-dependent` where backfill is impossible. A coverage statement limits the inventory's claim to keys an owning row records. |
| **R1 / R2 status** | Recorded as **proposed** rulings awaiting ratification, not as owner decisions; no behaviour is frozen. |

### What this amends in the approved plan (named, not silent)

- rename changes from metadata-only to one immutable version (**proposed** R1);
- cleanup gains a revocable fence, a persisted complete key set, and one migration carrying two
  tables plus one column (F1, F2);
- delete gains a defined publication rule it previously lacked (**proposed** R2).

The plan's verification tier, file ownership and scope boundaries are unchanged; the amended text is
in [the plan](./implementation-plan.md).

## Owner briefing — what this changes and what it does not

```text
authorization      T3.P04.S01 released; implementation may start after the coordination PR merges
decided            5 mechanisms; the revocable fence, the source-key column and the coverage
                   statement correct the plan's mechanism, not its product scope
proposed rulings   R1 authored envelope, one new version · R2 active-only delete refusal
                   — NEITHER IS FROZEN UNTIL THE OWNER RATIFIES IT
merge condition    T2 reviews the source_keys column and applies the lease to uploadModelFile and
                   approveModelImport (+compensation); an unfenced writer or an unrecorded source
                   key set is a stop-and-report, not a sweep-only fallback
not ratified       no format, gate, capability, performance budget, publication lifecycle or scope
not built          no route, migration, client call, control or cleanup code in this PR
owners             T3 persistence/API/client · T2 import/admission + handoff review ·
                   T1 shell patch + review · S06 untouched, harness untouched
```
