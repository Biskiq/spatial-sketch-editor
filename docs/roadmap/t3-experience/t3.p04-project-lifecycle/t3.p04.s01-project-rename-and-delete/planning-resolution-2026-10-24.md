# T3.P04.S01 — planning resolution against current main (2026-10-24)

**Slice:** T3.P04.S01 · **Plan:** [implementation-plan.md](./implementation-plan.md) (owns scope and
criteria) · **Phase:** [T3.P04](../README.md) · **Authorization:**
[decision](../../../../reference/decisions/t3-phase-close-and-p04-authorization-2026-10-24.md)

This record resolves the plan's open implementation questions against the tree at `main`
`2215af34`. It changes no scope, format, ownership or verification tier. It decides the routine
details, and it isolates the **two** questions that are the owner's because they change a
persistence contract or product scope. Nothing here authorizes implementation, and no behaviour
below is built.

```text
DECIDED HERE (routine, inside the plan's stated allowance)
  1  durable deletion/cleanup mechanism      → project-prefix sweep + durable deletion record
  2  migration contingency                    → migration 007, no CASCADE retrofit
  3  T2 → T3 API handoff                      → one owned-key inventory + key-registry invariant
  4  T1 shell integration                     → list-row actions + Head commands, no new shell
  5  Save/Delete concurrency                  → one project row lock + expected base, ordered deletes

OWNER RULINGS REQUIRED
  R1  which field owns the project name       (Save stamps the authored name into the row)
  R2  delete of a project with a publication  (publications/releases are outside the plan's list)
```

## Reconciliation against current main

| Fact | Evidence at `2215af34` | Consequence for this plan |
| --- | --- | --- |
| No project lifecycle route exists | `apps/api/src/app.ts` has `GET /projects`, `PUT /projects/:projectId`, `GET /projects/:projectId`; no `PATCH` or `DELETE` route for a project | Both routes are genuinely new surface; no existing route shape to mirror except the owner-scoped load |
| Save is conditional and row-locked | `apps/api/src/save-persistence.ts` proves ownership before the lock, then `SELECT … FOR UPDATE`, compares `saved_base_token`, appends `project_versions`, stamps `saved_base_token`/`saved_revision` and `name` | Rename/delete reuse the same lock and precondition; no second serialization primitive |
| The project name has two homes | `save-persistence.ts` writes `SET name = $3` from the admitted source (`finalSource.name`); `listProjects`/`loadProject` read `projects.name`; the F2 envelope also carries `name`, and the save capture's name is derived from the captured source | **Ruling R1.** A metadata-only rename can be reverted by the next Save |
| Delete order is not free | `project_versions`, `assets`, `publications` reference `projects` with no cascade; `releases` references `project_versions`; `save_receipts`, `model_imports`, `model_revisions` cascade | Delete must remove `releases → publications → assets → project_versions → project` explicitly, after reading the key inventory |
| Model rows already inherit deletion | `apps/api/migrations/006-model-resources.sql` states project deletion deletes the project's revisions via `ON DELETE CASCADE` | C3's judgement is already recorded; do not re-open it |
| Project-owned keys are project-prefixed | `asset-persistence.ts`: `projects/<ns>/<project>/assets/<uuid>/<hex>`; `model-persistence.ts`: `…/models/imports/<importId>/<fileId>` and `…/models/revisions/<contentHash>/<name>` | A **project-prefix** sweep is complete by construction; row inventory alone is not |
| The existing purge is asset-shaped and would refuse | `r2-purge.ts` verifies every listed key against an **assets-only** pattern; a bucket holding model keys throws `R2PurgeRefusal` | Cleanup needs the prefix owned by the lifecycle, and `r2-purge`'s ownership predicate must learn the model shapes |
| Approval writes bytes before its row | `model-persistence.ts` `putBytes(...)` then `INSERT INTO model_revisions … ON CONFLICT DO NOTHING` | A delete concurrent with an approval can leave bytes with **no row to inventory** — the sweep, not the inventory, is the completion oracle |
| Nothing ships a lifecycle control | `apps/editor/src/routes/projects/+page.svelte` lists projects and opens them; `EditorHead` renders `projectName` with Save/Preview; no rename or delete affordance exists | The T1 patch is a small **new** control group, not wiring to an existing one |
| The client has one write | `ProjectApi` exposes `listProjects`, `saveAcceptedSource`, `loadProject`, asset calls; `ProjectPersistenceError` already types `conflict`, `not-found`, `network` | Add two typed calls; reuse the existing error vocabulary and refusal wording |

## 1. Durable deletion and cleanup — decided

**Proposal (preferred).** Delete in one transaction under the project row lock: verify owner and
expected saved base, read the owned-key inventory from the three authoritative sources
(`assets.object_key`, `model_import_files.object_key`, `model_revisions.derivative_key`), delete rows
in the order above, and insert one `project_deletions` record carrying the project id, owner, object
namespace and state. After commit, cleanup runs as an idempotent **project-prefix sweep**:
`list()` once, refuse any key outside `projects/<ns>/<projectId>/`, delete each, list again, and mark
the record complete only when the second listing is empty. The response reports `cleanup: complete`
or `cleanup: pending`; a pending record is retried by (a) repeating the `DELETE`, and (b) the
owner-run CLI in the existing `purge-objects.ts` style (`npm run cleanup:projects`, pending records
only). No scheduler, daemon or new dependency.

**Why the sweep, not just the inventory.** Every project-owned key lives under the project prefix, so
a sweep cannot miss a key, including ones written after the inventory was read (the approval race
above) and staged files whose rows have already been cascaded. The inventory still matters as the
fallback for a store whose `ObjectStore` does not expose `list`/`delete` (both are optional today):
then delete those keys and leave the record pending rather than claim success.

**Alternatives.** Inventory-only (the plan's literal wording): rejected alone, because it cannot see
bytes whose row never committed and silently breaks when T2 adds a key source. Cascade-only: rejected,
because it destroys rows before their keys are read and leaves no retry state. Global
`purgeUnreferencedObjects`: rejected as the lifecycle mechanism, because it is operator-run,
asset-only and refuses on model keys; it stays the deployment-level backstop.

**Tradeoff and risk.** A prefix sweep deletes anything under the project prefix, so the key-shape
contract becomes an invariant: *every project-owned object key is under its project prefix*. That is
true today and is recorded as the T2 handoff invariant (§3). The sweep also needs the namespace
ownership check that `r2-purge` already implements; the predicate is extended to the two model shapes
without widening beyond the configured namespace.

## 2. Migration contingency — decided

Add **migration 007** with only `project_deletions` (idempotent `CREATE TABLE IF NOT EXISTS`, guarded
constraints, index on `(state, created_at)`), matching the replay-safe style of `001`–`006` under
the runner's session advisory lock. It carries **no foreign key to `projects`** — the project row is
deleted in the same transaction that inserts the record — and it is owner-scoped
(`project_id` primary key plus `owner_id`), so a retry cannot resume another owner's cleanup.

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
`.expires_at`; `model_revisions.derivative_key`; `ObjectStore.list`/`delete`; the owner checks in
`approveModelImport`, import upload and asset upload.

**Proposal (preferred).** One `ownedObjectKeys(db, projectId)` function in T3's lifecycle module is the
single inventory, reviewed by T2. A written invariant binds future work: *a new project-scoped object
key must be added to that function and must live under `projects/<ns>/<projectId>/`.* T3 takes the
lifecycle route and its client; T2 keeps import, admission, model formats and the approval path.

**The approval race is T2's fix, with T3's sweep as backstop.** `approveModelImport` writes the
derivative and source bytes before inserting `model_revisions`. Preferred fix: the approval path takes
a `FOR SHARE` lock on the project row for its write-and-insert transaction, so a delete serializes
behind it and the sweep then sees the inserted row's keys; alternatively it rechecks the project after
`putBytes` and deletes its own just-written keys on failure. If T2 declines both, the fallback is a
bounded delete refusal while any `model_imports` row for the project is `staging`, plus the sweep —
weaker, so it needs T2's explicit agreement rather than T3's assumption.

**Coordination.** `app.ts` and `project-persistence.ts` are shared files: T3's patch is additive and
serialized against T2's then-current work, per the plan's file-ownership table.

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
- *Delete then create-only with the same id:* the durable `project_deletions` record makes the
  create-only path answer `collision` instead of resurrecting an empty project. This is one additive
  read in the create-only branch; it changes no existing refusal's meaning.
- *Delete then approval:* the foreign key refuses the revision insert; the bytes case is §3.

**Client rules.** Every lifecycle result carries its `projectId`; a response whose id no longer
matches the mounted session is dropped (the same rule the Save client already needs after a project
switch). Partial network failure keeps the operation state so the UI can refresh/retry, and the UI
distinguishes "inaccessible project" from "pending byte cleanup".

## R1 — Which field owns the project name? (owner ruling required)

**The conflict.** The plan requires rename to preserve source units, source revision, history and
stored versions. But Save stamps `projects.name` from the admitted source's `name` on every save, and
the list and title read the row. So a metadata-only rename is reverted by the next Save of a document
that still carries the old name; leaving the two in place instead creates a silent divergence between
the list, the title and the stored envelope.

**Options.**

- **A — recommended. The authored envelope owns the name; rename writes it as a new version.**
  Rename appends a copy of the latest document with only `name` changed (a new version and
  accepted revision), updates the row and the base in the same transaction. One truth, immutable
  history, no stale revert, publication stays pinned to its own version. **Cost:** rename creates a
  source revision, contradicting the plan's "preserves source revision" clause; it also needs a
  server-generated revision identity for a metadata-only version, and a dirty draft must adopt both
  the refreshed base and the new name — the one F4-adjacent cost of this option.
- **B — the row owns the display name; Save stops stamping it.** `projects.name` becomes the only
  display name, the envelope's `name` freezes at creation. **Cost:** changes what F4 conditional Save
  writes (a persistence-contract change), two names can diverge, and a package export keeps the stale
  authored name.
- **C — metadata-only rename, Save unchanged.** Rejected: either the next Save restores the old name,
  or the host normalizes the envelope name on load — which mutates source during a read-only boot and
  violates the host's no-write rule.

**Pushback on the plan.** Its "preserves source revision" sentence cannot coexist with the current
Save; option A is the only one that keeps a single name truth with immutable versions, and it needs an
explicit amendment to that sentence. If the owner prefers B, the plan's client rules and the F4
contract text must change instead. **This is not routine; it is recorded as open.**

## R2 — What does delete do with a published project? (owner ruling required)

**The gap.** The plan's cleanup list covers stored versions, staging and approved model resources, and
its probes never mention `publications` or `releases`. Yet `publications.project_id` references the
project and `releases` references `project_versions`, so a delete cannot proceed without deciding what
happens to a live or dormant publication. Publication UI is T4 territory and T4 is frozen, but
API-level rows can exist.

**Options.**

- **A — recommended. Refuse delete while a publication exists**, with an explicit "unpublish this
  project first" refusal and the project untouched. Delete never silently removes a public link, and
  publication lifecycle stays out of this slice.
- **B — delete also unpublishes** (remove `publications` and `releases` inside the transaction), making
  delete a complete cleanup. **Cost:** a public link disappears as a side effect of a confirmation
  that named the project, not the publication; it would need its own explicit confirmation and
  publish-lifecycle wording.
- **C — hide delete for published projects in the UI only.** Rejected: leaves an API-level hole and a
  false product claim.

**Pushback on the plan.** Silence here is not neutral: the implementation cannot pick silently
without either destroying a public release or inventing a product rule, so the plan's bounded outcome
needs one sentence from the owner. **Recorded as open.**

## Owner briefing — what this changes and what it does not

```text
authorization      T3.P04.S01 released; implementation may start after the coordination PR merges
decided            5 routine mechanisms above, inside the plan's stated allowance
required rulings   R1 name authority · R2 delete vs publication — freeze nothing before they land
not ratified       no format, gate, capability, persistence contract, performance budget or scope
not built          no route, migration, client call, control or cleanup code in this PR
owners             T3 persistence/API/client · T2 import/admission + handoff review ·
                   T1 shell patch + review · S06 untouched, harness untouched
```
