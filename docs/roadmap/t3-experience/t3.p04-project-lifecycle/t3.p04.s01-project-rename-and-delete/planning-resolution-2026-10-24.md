# T3.P04.S01 — planning resolution against current main (2026-10-24)

**Slice:** T3.P04.S01 · **Plan:** [implementation-plan.md](./implementation-plan.md) (owns scope and
criteria) · **Phase:** [T3.P04](../README.md) · **Authorization:**
[decision](../../../../reference/decisions/t3-phase-close-and-p04-authorization-2026-10-24.md)

This record resolves the plan's open implementation questions against the tree at `main`
`2215af34`. It changes no format or verification tier, and it amends ownership only where §3 says
so. It decides the routine mechanisms, records the owner's directions on the two questions that
change a persistence contract or product scope, and names every amendment to the plan. Nothing here
authorizes implementation, and no behaviour below is built.

**Revised 2026-10-24 after owner review.** The review accepted the phase closures, the release and
the preservation, and returned the deletion architecture for correction: the first draft claimed a
prefix sweep plus an empty second listing proved cleanup complete, which the current code does not
guarantee. Section 1 now specifies a deletion/write fence with per-writer compensation (F1), section
2 restores the durable key inventory the approved plan requires (F2), and section 3 makes the
listing project-scoped (F3). The two rulings are corrected in place (R2's precondition was
unsatisfiable). Nothing in the accepted plan's durability contract is weakened silently; every
amendment below is named and attributed.

```text
DECIDED HERE (routine, inside the plan's stated allowance)
  1  durable deletion/cleanup mechanism      → write-lease fence + persisted inventory + scoped sweep
  2  migration contingency                    → migration 007 (two tables), no CASCADE retrofit
  3  T2 → T3 API handoff                      → one inventory + the fence on all three writers
  4  T1 shell integration                     → list-row actions + Head commands, no new shell
  5  Save/Delete concurrency                  → one project row lock + expected base, ordered deletes

OWNER DIRECTION (2026-10-24 review, recorded in R1/R2 below)
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

**Deletion/write fence (preferred).** One fence covers every project-owned object writer, built on
the row lock the Save path already uses plus a durable lease:

- **Writer lease.** Before the first byte, the writer transaction takes
  `SELECT 1 FROM projects WHERE id = $1 AND owner_id = $2 FOR KEY SHARE` (compatible with other
  writers, conflicts with delete's `FOR UPDATE`) and inserts a `project_write_leases` row
  (`lease_id`, `project_id`, `kind`, `started_at`, `expires_at`). A missing project row refuses before
  any byte is written. The lease is released in a `finally` on every exit path.
- **Delete.** Under the same row lock it verifies owner and expected base, and **refuses with a
  retryable `project-busy` while any unexpired lease exists for the project**, writing nothing.
  Otherwise it reads the inventory, inserts the deletion record and deletes the rows in one
  transaction.
- **Why the race closes.** The lease insert and the delete serialize on the project row: either the
  lease commits first and delete refuses, or delete commits first and the writer's `FOR KEY SHARE`
  finds no row. After the delete commits, no permitted writer can create a key under the prefix.
- **Compensation, not only the fence.** Each writer deletes the keys it wrote when its finalization
  fails (asset upload and model approval need this added; model upload already does). A process death
  is not a refused write, so the fence alone is not the whole answer.
- **Lease expiry.** `expires_at` must exceed the maximum upload-route duration for the bounded
  content sizes (25/50 MiB). An expired lease is reaped and never trusted; cleanup cannot complete
  while a lease for the project is unexpired.

**Cleanup and the completion check.** After commit, cleanup deletes the **persisted inventory** keys
(§2), then runs a **project-scoped** listing (F3): filter `ObjectStore.list()` to
`projects/<ns>/<projectId>/` and ignore every other key rather than refusing it. Completion requires
all of: the tombstone committed; no unexpired lease; the inventory keys deleted; and **two
consecutive empty scoped listings separated by a bounded quiet interval after the last lease
expiry**. Only then does the record reach `state = 'complete'`. Otherwise the response is
`cleanup: pending`, retried by (a) repeating the `DELETE` and (b) the owner-run CLI in the existing
`purge-objects.ts` style (`npm run cleanup:projects`, pending records only). No scheduler, daemon or
new dependency.

**Why the inventory survives and the sweep does not replace it.** The inventory is the durable truth
the approved plan requires; the scoped sweep is the completion oracle that catches keys written by a
writer the inventory cannot see, and it is the only mechanism that can catch a key whose row was
never committed. Neither is sufficient alone.

**Alternatives.** (a) **Advisory-lock-only fence** (session shared/exclusive, delete waits): less
schema, but no durable in-flight record, hard to test without blocking, and a hung session blocks
deletion indefinitely. (b) **Tombstone-only denial** at writer start — the plan's "deny further
project access": covers new writers only, not in-flight ones. (c) **Grace-period sweeps** without a
fence: no guarantee and an unbounded wait. The preferred design keeps (b) as its first step and adds
the lease and compensation.

**Tradeoff and risk.** The fence adds a lease table, a `FOR KEY SHARE` on every upload and approval,
and a retryable `project-busy` outcome; delete gains a bounded refusal path that a client must
surface as retry, not error. That is the price of not claiming a completeness it cannot prove. It
also makes the §3 handoff a merge condition: the fence is only real if all three writers use it.

## 2. Migration contingency — decided

Add **migration 007** with the two lifecycle tables (idempotent `CREATE TABLE IF NOT EXISTS`,
guarded constraints), matching the replay-safe style of `001`–`006` under the runner's session
advisory lock:

- `project_deletions` — `project_id` primary key, `owner_id`, `object_namespace`, `state`
  (`pending|complete`), **`key_inventory jsonb`**, `attempts`, `last_error`, timestamps, index on
  `(state, created_at)`. **No foreign key to `projects`**: the project row is deleted in the same
  transaction that inserts the record. Owner-scoped, so a retry cannot resume another owner's
  cleanup.
- `project_write_leases` — `lease_id` primary key, `project_id`, `kind`, `started_at`, `expires_at`,
  index on `(project_id, expires_at)`. **No foreign key either**, so a crashed writer's expired lease
  remains reapable after its project is gone.

**The inventory is persisted, not recomputed.** This corrects F2 and restores the approved plan's
contract: after the rows are deleted, the inventory can no longer be read from them, so a crash
between commit and cleanup would lose it. The keys read inside the deletion transaction are written
into `key_inventory`, and cleanup deletes from that record idempotently on every retry. The prefix
listing is a *completion check*, not a substitute.

**No CASCADE retrofit.** Adding `ON DELETE CASCADE` to `project_versions`, `assets` or `publications`
would delete rows before the inventory is read and would make the durable record's content
unknowable. The explicit ordered delete is the mechanism; `006`'s existing cascade for model rows
stays as recorded.

**Contingency rules.** The table is empty at creation, so no backfill and no epoch activation applies;
`005`'s production activation remains a separate owner-run operation and 007 rides the same owner-run
migration step. If implementation finds it needs a migration outside lifecycle cleanup, or a store
that supports neither prefix listing nor the three row sources, that is a **stop-and-report** before
deletion is written — not a workaround.

## 3. T2 → T3 API handoff — decided, T2 review required

**Consumed read-only:** `assets.object_key`; `model_import_files.object_key`, `.state`,
`.expires_at`; `model_revisions.derivative_key`; `ObjectStore.list`/`delete`; the owner checks and
byte-write sequences in `uploadAsset`, `uploadModelFile` and `approveModelImport`.

**Proposal (preferred).** One `ownedObjectKeys(db, projectId)` function in T3's lifecycle module is the
single inventory, reviewed by T2. A written invariant binds future work: *a new project-scoped object
key must be added to that function and must live under `projects/<ns>/<projectId>/`.* T3 takes the
lifecycle route and its client; T2 keeps import, admission, model formats and the approval path.

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
- *Writer in flight, then delete:* an unexpired lease refuses delete with retryable `project-busy`;
  nothing is deleted, so the writer finalizes normally. The client shows retry, not failure.
- *Delete commits, then a writer starts:* the lease's `FOR KEY SHARE` finds no project row and the
  write refuses before a byte is written (upload) — for approval, the foreign key refuses the
  revision insert as before.
- *Delete then create-only with the same id:* the durable `project_deletions` record makes the
  create-only path answer `collision` instead of resurrecting an empty project. This is one additive
  read in the create-only branch; it changes no existing refusal's meaning.
- *Lease held by a crashed process:* it expires, cleanup reaps it, and delete proceeds; completion
  still waits for the quiet-interval check (§1).

**Client rules.** Every lifecycle result carries its `projectId`; a response whose id no longer
matches the mounted session is dropped (the same rule the Save client already needs after a project
switch). Partial network failure keeps the operation state so the UI can refresh/retry, and the UI
distinguishes "inaccessible project" from "pending byte cleanup".

## R1 — Which field owns the project name? (owner direction: the authored envelope)

**The conflict.** The plan requires rename to preserve source units, source revision, history and
stored versions. But Save stamps `projects.name` from the admitted source's `name` on every save, and
the list and title read the row. So a metadata-only rename is reverted by the next Save of a document
that still carries the old name; leaving the two in place instead creates a silent divergence between
the list, the title and the stored envelope.

**Owner direction (2026-10-24): option A.** The authored envelope `name` is the only truth. Rename
writes it as one new immutable version and retains every previous version, stable source identities
and publication pins. The alternative — the row owning the display name while Save stops stamping it
— would keep two writable names and changes what conditional Save writes; it is rejected. This is an
**intentional amendment** to the plan's metadata-only rename and its "preserves source revision"
sentence, recorded here and in the plan, not a routine detail.

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
rename) rather than a row update. Accepted by the owner.

## R2 — What does delete do with a published project? (owner direction: active only)

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

**Owner direction (2026-10-24).** Refuse delete **only while a publication is active**
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

## Review corrections (2026-10-24)

Every change below answers a finding in the owner's review of this resolution's first draft.

| Finding | Correction |
| --- | --- |
| **F1** — an in-flight writer can create a key after cleanup "completed" | §1 replaces the listing-only completion test with a durable **write-lease fence** on all three object writers, a retryable `project-busy` refusal, and per-writer compensation on failed finalization. Completion now requires no unexpired lease and two quiet scoped listings. |
| **F2** — the durable record dropped the plan's key inventory | §2 adds `key_inventory jsonb` to `project_deletions`; the inventory read inside the deletion transaction is the durable truth, and the scoped listing is only the completion check. |
| **F3** — `ObjectStore.list()` returns the whole bucket | §1 requires a project-scoped listing (filter or an optional `prefix` parameter). Sibling projects' keys are ignored, never treated as a cleanup error, and this stays distinct from `r2-purge`'s global epoch contract. |
| **R1** — name authority | The authored envelope owns the name; rename appends one immutable version through the shared save path, with the three F4 obligations above and dirty-draft preservation. |
| **R2** — publication precondition | Refuse only while the publication is **active**; remove the retained inactive row and its dependent releases after unpublication. The first draft's row-existence precondition was unsatisfiable. |

**What this amends in the previously approved plan.** These are named, not silent:

- rename changes from metadata-only to one immutable version (owner-directed, R1);
- cleanup gains a durable writer fence and per-writer compensation, and one migration table becomes
  two (F1, F2);
- delete gains a defined publication rule it previously lacked (R2).

The plan's verification tier, file ownership and scope boundaries are unchanged; the amended text is
in [the plan](./implementation-plan.md).

## Owner briefing — what this changes and what it does not

```text
authorization      T3.P04.S01 released; implementation may start after the coordination PR merges
decided            5 mechanisms above; the fence and persisted inventory are corrections, not new scope
owner direction    R1 authored envelope, one new version · R2 active-only delete refusal
merge condition    T2 applies the lease to uploadModelFile and approveModelImport (+compensation);
                   an unfenced writer is a stop-and-report, not a sweep-only fallback
not ratified       no format, gate, capability, performance budget, publication lifecycle or other scope
not built          no route, migration, client call, control or cleanup code in this PR
owners             T3 persistence/API/client · T2 import/admission + fence handoff review ·
                   T1 shell patch + review · S06 untouched, harness untouched
```
