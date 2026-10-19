# T3.P01.S04 — acceptance record: Live ownership cutover

**Slice:** T3.P01.S04 · **Status:** authorized 2026-10-19; **Phase A implemented, not accepted**
**Plan:** [implementation-plan.md](./implementation-plan.md) — owns this slice's acceptance criteria
**Phase:** [T3.P01](../README.md) · **Register:** [phase slice register](../README.md#slice-register)

This record now holds Phase A implementation evidence. It does **not** claim slice acceptance,
Phase B completion, activation or the cutover gate. The independent review that closes S04 is a
separate event, and the owner-run activation runbook has not been executed.

## Base and evidence lane

| Item | Value |
| --- | --- |
| Branch | `T3-P01-S04` (isolated sibling worktree) |
| Base | `origin/main` `919c2904` (PR #155 merge) |
| Phase A scope | T3-owned files only: `apps/api/**` and migrations, project-model units/program/save, `lib/visitor/**`, camera-core flow exports |
| Phase B | **not implemented**; waits for the current-source freeze |

## Implemented in Phase A

### Reset migration and schema fence (`apps/api/migrations/005-clean-source-epoch.sql`)

- One forward transaction deletes `releases`, `publications`, `save_receipts`, `assets`,
  `project_versions` and `projects` in dependency order; `users` and `schema_migrations` survive.
- Installs `project_versions.source_format text NOT NULL CHECK (source_format =
  'unit-envelope-v1')` plus a document-shape check for the five F2 units, `formatVersion: 1`,
  `acceptedRevision` and `dependencyLock`. A pre-epoch writer fails structurally whether or not it
  knows the column.
- The document check asserts key **presence** and JSON type as well as `jsonb_typeof`. SQL
  three-valued logic accepts a `CHECK` that evaluates to NULL, so without the `?` predicates a
  document missing `id` or `units` would have passed, and without the type predicate a null or
  string `formatVersion` would have passed too; a rehearsal caught both and
  `migration-fence.test.mjs` now pins them.
- The column's presence is the epoch marker, so replaying the file is a no-op.

### TD-6 — single-runner migrations

- `apps/api/src/migrate.ts` takes `pg_try_advisory_lock(MIGRATION_LOCK_KEY)` on the session before
  reading `schema_migrations`, polls with a bounded 30 s wait, and releases in `finally`.
- A dropped connection releases the session lock; the unlock error never masks a migration result.

### R2 purge boundary (`apps/api/src/r2-purge.ts`, `purge-objects.ts`)

- Refuses without list and delete, refuses when **any** visible key falls outside the API's
  `projects/<project>/assets/<uuid>/<hex32>` shape, and re-checks the prefix at every delete.
- Refuses while any `releases` row remains: a release manifest also pins object keys, so a purge
  before migration 005 cannot delete live published bytes.
- Ownership is proven per bucket, not per environment. Preview and production must not share one
  bucket; if they did, each purge would treat the other environment's app-shaped keys as
  unreferenced.
- Deletes only keys no remaining `assets` row references; rerun is a no-op.
- Owner-run entry point: `npm run purge:objects -w @biskiq/api`. No deployment or live purge was
  performed.

### API — declared F2 admission only

- `GET /projects` requires a `source_format = 'unit-envelope-v1'` version and returns summaries;
  `GET /projects/:id` additionally validates the stored row through `validateProjectEnvelope`.
- Save admits exactly one handler, `createUnitSaveHandler()`, and writes `source_format` on every
  version insert (`apps/api/src/save-persistence.ts`). Revision identity reuse is checked against
  every prior receipt, not only the latest saved base, so A → B → A with new contents refuses.
- Asset list/read/register/upload/finalize queries require an F2 version for the project.
- **TD-7:** an `expected-saved-base` Save proves ownership with a non-locking owner/F2 query before
  `SELECT … FOR UPDATE`; a foreign project answers not-found without locking its row. The
  create-only collision path stays intentionally owner-blind.
- Publication gap (AM-9/R4): Publish/Update answer `501 prepared-reader-required`; status and
  Unpublish remain truthful and OCC-checked; `/publications/:id` and its asset route answer
  `404 not_found` with `Cache-Control: no-store`. All release preparation and public-read code was
  removed.

### Project-model retirement

- `packages/project-model/src/migration/**`, the `./migration` package export and
  `source-migration-conformance.test.ts` are deleted.
- Scene/Camera structural types and the Scene codec no longer admit `nextNodeId`, `previousNodeId`,
  `detourOfNodeId`, `lockInteraction` or node-level `holdSeconds`; `isFlowNode` is gone.
- Camera-core `CameraGraphNode` loses the same fields, and `resolveFlowRoute`, `getFlowRoute` and
  `getFlowLoopConnectionId` are deleted. Camera route/framing evaluation is unchanged.
- Tests that existed only to prove retired order/flow semantics were removed; fixtures were rebuilt
  without the retired fields.

### Guide-free Presentation and visitor orchestration

- `lowerExperienceProgram` now emits **every** Presentation the selected Experience carries, not
  only those used by the Guide's Stops, while still refusing an unresolved View.
- `buildExperienceCompanion` exposes `presentations` (including ones with no Stop) as
  destinations. S04 ships the lowering/companion data, not a presentation-selection control;
  the authored DOM navigation home for a Stop-free Presentation is T3.P02.
- `apps/editor/src/lib/visitor/visitor-runtime-state.svelte.ts` is now an Experience-program store
  over the one interpreter: enter, Continue, explicit navigate, explicit clock, hold auto-continue
  (Gates stay blocked). `visitorMainFlowNodeIds`, `visitorFirstValidNodeId`, `visitorStartNodeId` and
  all node-keyed traversal are gone.
- `VisitorCameraDirector` reacts to the current Presentation View and uses the Camera route
  authority for travel; Cut, reduced motion and first framing are instant. `VisitorPreviewSurface`
  takes a lowered `program` and is neutral when none is supplied, rather than falling back to node
  order.

## Verification run on this branch

| Check | Result |
| --- | --- |
| `npm run check:project-model` | pass |
| `npm run check:camera-core` | pass |
| `npm run check:api` | pass |
| `npm run check` (editor, includes tests) | pass — 0 errors, 0 warnings |
| `npm run test:fast` | pass — 137 files, 1909 tests |
| `npm run test:arch` | pass — 20 files, 162 tests |
| `npm run build:editor` | pass |
| DB-backed `npm run test:api` on `biskiq_s04_verify` | pass — 75 tests, 0 failures, 0 skips |
| Migration replay on `biskiq_s04_rehearsal` | pass — first run removed all six authored tables' rows and retained `users`; rerun no-op |
| Fence refusals | `23502` (missing `source_format`); `23514` for wrong fence value, old document, missing `units`, and missing/null/string `formatVersion`; a valid F2 envelope inserts |
| TD-7 concurrency | a foreign `expected-saved-base` Save answers not-found while the owner row is locked, writes nothing, and the owner's next Save succeeds |
| Two concurrent `runMigrations` | automated in `migration-fence.test.mjs` and rehearsed on `biskiq_s04_race`: both exited 0; `schema_migrations` = 1,2,3,4,5 once each; fence `NOT NULL` |
| Revision history | A → B → A with new contents refuses `revision-reuse` and keeps two versions |

The API lane was run against disposable databases created for this rehearsal. No production or
shared development database was reset, no deployment was made and no object was purged.

## Outstanding — Phase B and review handoff

1. **Callers are still pre-epoch.** Editor boot/import/export, the Stage read facade, the starter
   boot, validation/runtime composition and T1/T2 operations still read or emit the current source.
   Phase B migrates them onto unit admission after `T1.P01.S05` and `T2.P01.S04` freeze.
2. **TD-9 is not closed.** Sign-in Save recovery must be rewired to F2 captures in Phase B; deleting
   the old draft path is explicitly insufficient.
3. **S06 requirement rewrite** (`local-single-domain-v1` retirement, S06 register/plan pin,
   `parallel-track-gates` pin) is Phase B, in the same commit that removes the last callers.
4. **Starter and bootstrap** still emit the current source; AM-9's "new bootstrap and starter emit
   only F2" is not claimed here.
5. The public route and its cold reader/client remain in the editor but are unreachable while every
   public read is 404. T4 owns the prepared reader; their removal/rebuild is T4's, not a working
   delivery path.
6. The visitor's Camera graph is still Scene-derived while the program names Camera-unit Views. The
   director degrades to the neutral frame instead of throwing, but building that graph from the
   Camera unit is Phase B wiring, not a Phase A claim.
7. **Not reviewed, not accepted, not activated.** No data reset, no deploy, no gate acceptance. The
   merge remains the code cutover only after review.

## Acceptance status

No criterion is marked accepted. Phase A is implemented and green on the checks above; independent
review of the unit Save live switch, epoch admission and retirement is required before S04 can close.
