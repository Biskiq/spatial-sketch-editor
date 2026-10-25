# T2 API handoff — project-owned object writes

**Review required before T3 edits shared API files.** This is implementation review material for
T2's ownership of model import/admission and the project-scoped model-storage boundary. It does not
record T2 approval. PR #188 reviewed and merged the planning release only; that review is not the
required API handoff.

## Current code facts

- `apps/api/src/asset-persistence.ts` writes asset objects beneath
  `projects/<namespace>/<projectId>/assets/<assetId>/<random>` after claiming the asset row. A
  stream failure marks the row failed but does not delete the uploaded object; a finalize refusal
  also leaves the object behind.
- `apps/api/src/model-persistence.ts` writes staging files beneath
  `projects/<namespace>/<projectId>/models/imports/<importId>/<fileId>`. `uploadModelFile` currently
  compensates its own failed/hash-mismatched/finalize-refused key.
- `approveModelImport` writes `derivative.glb` and one `source/<path>` object per source file beneath
  `projects/<namespace>/<projectId>/models/revisions/<contentHash>/`, then inserts a
  `model_revisions` row. The row stores `derivative_key`; no column currently stores the approved
  source-copy keys, and approval does not compensate a failed insert/finalization.
- The model writes are project-prefixed, but `ObjectStore.list()` returns bucket-wide keys.
  `r2-purge.ts` currently verifies the deployment-wide epoch purge against an asset-only pattern.
  Project cleanup must filter to the exact project prefix; sibling keys cannot be treated as an
  error or deleted. Any update to the epoch purge's accepted shapes must preserve its global
  ownership and activation rules.
- `ObjectStore.put` has no `AbortSignal` parameter, and `createR2ObjectStore` calls
  `S3Client.send(PutObjectCommand)` without a send options object. `createApp` sets a body limit but
  no explicit request/write timeout; `startServer` also supplies no route timeout. A local timer or
  destroyed request stream alone does not prove that a complete remote `PutObject` cannot commit
  late.
- `runMigrations` takes the existing session advisory lock and applies numbered SQL migrations in
  individual transactions. Migration 006 owns the existing `model_revisions` table and its project
  cascade. `save-persistence.ts`'s create-only branch can recreate a deleted ID unless the durable
  deletion tombstone is checked there.

## Proposed shared contract for review

1. **Complete row-backed inventory.** T3's lifecycle module reads, before deletion cascades,
   `assets.object_key`, `model_import_files.object_key`, `model_revisions.derivative_key`, and
   `model_revisions.source_keys`. It persists that exact set in the owner-scoped deletion record
   inside the delete transaction. Each key must be under
   `projects/<namespace>/<projectId>/`; malformed or foreign keys are refused rather than widened.
2. **Approved source key set.** Migration 007 adds nullable `model_revisions.source_keys jsonb`
   with an array constraint. A shared `revisionObjectKeys(projectId, namespace, contentHash,
   sourcePaths)` helper produces the source-copy keys both for the approval insert and lifecycle
   inventory. Backfill derives paths through retained `model_imports.revision_id` and
   `model_import_files` source rows. A revision without those retained rows stays `NULL` and is
   explicitly reported as `sweep-dependent`; the persisted inventory does not claim coverage for it.
3. **One revocable lease protocol for all three writers.** A T3 helper starts a lease only while the
   owner-scoped project row exists, using `FOR KEY SHARE` against delete's `FOR UPDATE`; all writes
   acquire it before their first object byte. Renewal fails closed: a revoked or failed heartbeat
   stops the inbound stream and aborts object-store `PutObject`; each lease is released in `finally`.
   The lease has a non-extendable deadline. Delete revokes live leases and returns retryable
   `project-busy` until leases are released or past the enforced deadline.
4. **Compensation at every writer.** Asset upload must delete its key after stream/storage failure
   and failed finalization. Model upload keeps its existing compensation under the lease. Approval
   compensates every newly written derivative/source key if it fails before a revision owns them.
   The approval compensation must preserve an identical revision that a concurrent approval has
   already inserted: content-addressed keys can be shared by same-project approvals, so a losing
   attempt must not delete keys referenced by the winning row.
5. **Enforced cancellation and cleanup proof.** Extend `ObjectStore.put` with a signal and pass it to
   `S3Client.send(..., { abortSignal })`; tie it to both lease revocation and a real, enforced handler
   deadline. Before choosing `MAX_WRITE`, establish the actual route/server timeout and size it for
   the permitted 50 MiB source set at minimum deployment throughput. Cleanup deletes the persisted
   inventory idempotently, waits at least `MAX_WRITE + renewal + abort margin` after `fenced_at`,
   takes a first empty project-scoped listing, then a second empty listing at least the same bound
   later. A local timer is not evidence that remote storage cannot commit late. Keep the documented
   residual late-complete-write risk and the owner-run verify/repair behavior explicit.
6. **Durable restart and retry.** Migration 007 adds `project_deletions` with owner, namespace,
   `pending|complete`, persisted `key_inventory`, fence timestamp and retry/error state, plus
   `project_write_leases` with start/heartbeat/deadline/revocation/release state. These records have
   no FK to `projects`; deletion reads the inventory, removes releases/publication/assets/versions
   in order, records a tombstone, then retries byte cleanup after commit. The create-only Save path
   checks the tombstone to prevent same-ID resurrection.

The migration remains replay-safe and does not activate the F2 epoch or add a background cleanup
platform. Project deletion stays owner-scoped and isolated from other projects and owners, including
identical-content models.

## T2 review requested

- Confirm the complete key inventory, retained-source backfill and `sweep-dependent` behavior.
- Review the source-key helper and column as part of model revision approval ownership.
- Review the lease call site and compensation at both `uploadModelFile` and `approveModelImport`,
  including the concurrent same-content approval case.
- Confirm the object-store signal/deadline design and what explicit server timeout will enforce it.
- Confirm no model storage/admission or publication behavior changes beyond this handoff.

Until that review is recorded, T3 will keep changes out of `apps/api/src/app.ts`,
`project-persistence.ts`, `model-persistence.ts`, `asset-persistence.ts`, `object-store.ts`,
`purge-objects.ts`, `r2-purge.ts`, and `apps/api/migrations/`. The client transport can proceed as a
T3-owned, additive surface; no API acceptance or verification is claimed here.
