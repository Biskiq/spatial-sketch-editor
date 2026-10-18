# Quiescence and recovery — plan

**Slice:** T3.P01.S04 · **Status:** draft preflight — **no backup has been taken, no restore has been
rehearsed; not evidence**
**Related:** [cutover mechanics](../../README.md#cutover-mechanics-and-retirement) ·
[inventory](./inventory.md) · [publication disposition](./publication-disposition.md)

The cutover is one administrative source transition with **one writer**. This plan states how writes
stop, what is backed up before activation, how recovery is proven, and when the operation aborts. It
authorizes nothing and was not executed.

## Single-writer guarantee

Three independent layers, all required. Any one missing aborts the cutover.

1. **Deployment fence.** Activation runs with the API at a single instance in maintenance mode:
   mutating routes (`PUT`/`POST`/`PATCH`/`DELETE` on projects, assets, publications) return a typed
   `503 source-write-fenced`; reads and status remain available. The conversion is a one-off job, not
   a route. Scale-to-zero plus the job is the fallback if maintenance mode cannot be verified.
   **This is not implemented in the landed API today.** No maintenance mode, no
   `source-write-fenced` response and no fence configuration key exist under `apps/api`; the fence is
   an owner-approved API work item that must land before this plan can execute. Until it does, the
   only honest fence is scale-to-zero (or an equivalent platform-level write block) with the job
   running.
2. **Database advisory lock.** The conversion holds a session-level advisory lock for its whole
   transaction. Any second writer waits or fails; no writer can commit during the CAS window.
3. **Optimistic concurrency.** Each project conversion captures `(project id, latest_version,
   saved_base_token, saved revision/digest)` and installs with a compare-and-swap on the revision it
   read. A late writer loses the CAS and changes nothing.

Verification before any write:

```sql
-- The API does not set application_name today. If a connection reports it, verify it; otherwise
-- count every backend except this session and the conversion job, and require that set to be empty.
SELECT count(*) AS other_backends,
       count(*) FILTER (WHERE application_name = 'ss-api') AS api_connections,
       count(*) AS total_connections
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND coalesce(application_name, '') NOT IN ('ss-conversion-job');

-- Fail closed when the prerequisite is absent: no api_connections is only a pass if the API is
-- genuinely stopped (scale-to-zero), never because the label was never set.
SELECT current_setting('biskiq.fence_asserted', true) IS NOT NULL AS fence_asserted;

-- no in-flight write transactions
SELECT count(*) FROM pg_stat_activity
WHERE datname = current_database() AND state = 'active' AND query ~* '^\s*(insert|update|delete)';
```

`other_backends = 0` is the pass condition. `api_connections = 0` alone proves nothing: the landed
API never sets `application_name`, so an absent label is indistinguishable from a stopped API. Record
which check was used (scale-to-zero + zero backends, or a verified label) and do not accept the label
test unless the API emits it.

Then probe the deployment. Scale-to-zero is the probe that exists today: an authenticated `PUT`,
`GET` and asset upload must all fail at the platform edge while the API has no instance. A typed
`503 source-write-fenced` with reads still served requires the API work item above; if that work item
has not landed, do not claim this probe. Repeat the probe after the fence is declared up and again
immediately before activation.

Additional checks:

- Confirm replica count is 1 (or 0 with the job running); record the deployment revision.
- Confirm no scheduled job, worker or migration runner can write during the window.
- Confirm publication routes are fenced too — a publication write during conversion is a second
  writer even though it touches a different table.
- Record queue depth / retry backlog; fenced clients must not retry into the window.

## Pre-activation backup set

All four are required, with a recorded hash and location:

| # | Artifact | How | Proof |
| --- | --- | --- | --- |
| 1 | Database logical backup | `pg_dump --format=custom --no-owner --no-privileges "$PRODUCTION_DATABASE_URL" -f pre-cutover.dump` | `pg_restore --list` succeeds; SHA-256 recorded |
| 2 | Object-store copy | Versioned bucket snapshot or `aws s3 sync s3://$BUCKET s3://$BUCKET-backup-$STAMP --only-show-errors` | Object count and total bytes match the inventory |
| 3 | Source manifest | The inventory artifact plus an explicit checksum list of every `project_versions.document` (canonical source hash, not body) | Manifest hash recorded; row count matches backup |
| 4 | Deployment record | Image digest / commit of the current API and editor, env/config names (never secret values), and the fence configuration | Digest recorded beside the dump |

A backup is not valid until a restore has been read.

## Restore rehearsal

Rehearsal happens **before** the cutover window, on a disposable target, and never on production:

1. Provision a clean Postgres (local Compose is acceptable **only** for this rehearsal) and restore
   `pre-cutover.dump` into it: `pg_restore --clean --if-exists --no-owner -d "$REHEARSAL_URL"`.
2. Point the conversion job at a restored **copy** of the asset bucket.
3. Verify restored counts equal the inventory: projects, versions, publications, releases, assets,
   and per-bucket format counts.
4. Run the converter against the restored copy, then run full composed validation and the API suite
   against the restored database with **zero skips**.
5. Measure wall-clock conversion time per project and in total; use it to size the write fence and to
   decide whether the window needs a staged run.
6. Re-run the converter on the same restored copy and confirm identical candidates/report
   (determinism).
7. Record the rehearsal artifact (commands, timings, counts, hashes) beside this plan.

A rehearsal against an empty fixture database proves the tooling runs; it does **not** prove recovery
for the real inventory. It also never becomes inventory evidence.

## Activation sequence

1. Announce the window; confirm no active editor sessions (or ask owners to stop).
2. Apply the deployment fence; verify all three single-writer layers.
3. Run the inventory one final time and compare with the approved inventory; a changed count is a
   stop condition.
4. Take the backup set; verify restore-readiness (`pg_restore --list`).
5. Convert project by project in one transaction per project, capturing the mapping report and
   refusal list.
6. Install the new readers/admission/runtime; keep the old converter read-only and unreachable from
   ordinary requests.
7. Smoke-check: empty boot, open a converted project, save once, publication status/Unpublish.
8. Lift the fence only after all checks pass.

## Rollback criteria and abort triggers

**Abort before activation** (nothing changed, no rollback needed):

- any inventory number differs from the approved inventory;
- a second writer is detected, the fence probe fails, or the advisory lock cannot be held;
- backup or restore-readiness check fails;
- any `unknown` format, broken publication or orphan asset appears that the owner has not dispositioned;
- conversion exceeds the measured window by a margin that would leave the system fenced too long.

**Roll back** (restore the pre-cutover state and deployment):

- a converted project fails composed validation or cannot be opened;
- publication status/Unpublish misreports after activation;
- a write is accepted by an old client and produces an unreadable current-format state;
- the smoke journey fails in a way that indicates source loss.

Rollback is a **coordinated source + deployment restore**: keep the fence, restore the dump and the
object-store copy, redeploy the recorded pre-cutover digest, verify with the same counts, then lift
the fence. Do not reverse-convert new-format data.

**After any new-format edit**, rollback to the old format is no longer honest. Retain that revision
and roll forward/repair, or restore an explicitly selected backup with disclosed loss of subsequent
edits. Source Undo restores new-format authored contents with a fresh revision; it never reactivates
the old schema.

## Converter retirement

The read-only converter retires when the covered inventory is completed or discharged and recovery is
verified, before the Source Baseline. It must not survive as a normal import path, a format sniffer or
a writable fallback. Its retirement condition is recorded with the mapping report; no indefinite
migration reader.

## Review checklist

- [ ] Fence has all three layers, the API fence work item is either landed or replaced by a verified
      scale-to-zero block, and the probe transcript is recorded.
- [ ] Backup set has four artifacts with hashes; restore-readiness was read, not assumed.
- [ ] Rehearsal ran on a restored copy, counts matched, and timings are recorded.
- [ ] Abort triggers and rollback criteria are explicit and testable.
- [ ] The post-edit recovery rule (roll forward or disclosed restore) is accepted by the owner.
- [ ] Converter retirement condition is named and dated relative to the Source Baseline.
