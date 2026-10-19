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
| PR lifecycle | PR #158 is the continuing S04 implementation PR. Phase A is reviewed there but is **not** merged on its own; Phase B lands on the same PR after the freeze, followed by final review and closeout. |

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
- The column's presence is the epoch marker, so replaying the file is a no-op. A local database that
  applied an earlier draft of this unmerged file must be recreated; the rehearsals used fresh
  disposable databases.

### TD-6 — single-runner migrations

- `apps/api/src/migrate.ts` takes `pg_try_advisory_lock(MIGRATION_LOCK_KEY)` on the session before
  reading `schema_migrations`, polls with a bounded 30 s wait, and releases in `finally`.
- A dropped connection releases the session lock; the unlock error never masks a migration result.

### R2 purge boundary (`apps/api/src/r2-purge.ts`, `purge-objects.ts`)

- Ownership is a configured namespace, not a key shape. `R2_OBJECT_NAMESPACE` is required and
  every asset key is `projects/<namespace>/<project>/assets/<uuid>/<hex32>`. The purge refuses
  when **any** visible key falls outside that namespace and shape, so a bucket shared with another
  deployment refuses instead of treating the other deployment's app-shaped keys as unreferenced.
  A missing or malformed namespace refuses rather than widening the match.
- Requires the active epoch: `schema_migrations` must record migration 5 before anything is listed
  for deletion.
- Refuses while any `releases` row remains: a release manifest also pins object keys, so a purge
  before migration 005 cannot delete live published bytes.
- Refuses when a remaining `assets` row references an object outside the namespace (a storage
  configuration mismatch), rather than skipping it and deleting the rest.
- Refuses without list and delete, and re-checks the namespace prefix and key shape at every
  delete.
- Deletes only keys no remaining `assets` row references; rerun is a no-op.
- **Legacy-key disposition.** The namespace is new in this cutover, so keys written by earlier
  builds keep the pre-namespace shape (`projects/<project>/assets/<uuid>/<hex32>`). Migration 005
  removes the database rows that named them, but their ownership still cannot be proven: a bucket
  shared with another deployment could hold that deployment's old-shape keys too. The purge
  therefore refuses the whole bucket while any such key remains (`r2-purge.test.mjs` pins this).
  Activation uses a dedicated bucket per environment; if an existing bucket is reused, the owner
  must first remove the legacy keys from an independently verified inventory. This command never
  deletes a legacy key.
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
  destinations.
- `VisitorPreviewSurface` renders an accessible `Presentations` navigation for every Presentation no
  Stop uses. Selecting one realizes its View through the same Camera authority as a Cut and never
  fabricates a Stop; `visitor.selectPresentation()` is separate from `navigate(stopId)` and is
  cleared by `enter()`/`navigate()`.
- `apps/editor/src/lib/visitor/visitor-runtime-state.svelte.ts` is now an Experience-program store
  over the one interpreter: enter, Continue, explicit navigate, explicit clock, hold auto-continue
  (Gates stay blocked). `visitorMainFlowNodeIds`, `visitorFirstValidNodeId`, `visitorStartNodeId` and
  all node-keyed traversal are gone.
- `VisitorCameraDirector` reacts to the current Presentation View. A Travel resolves the exact
  authored `connectionId` and direction through `getCameraConnectionRoute`; it never substitutes
  general graph pathfinding, and a missing or mismatched connection surfaces a typed gap and settles
  as a Cut. Cut, reduced motion and first framing are instant. `VisitorPreviewSurface`
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
| Two concurrent `runMigrations` | automated in `migration-fence.test.mjs` (both fulfilled); manual rehearsal on `biskiq_s04_race` (both exited 0); `schema_migrations` = 1,2,3,4,5 once each; fence `NOT NULL` |
| Revision history | A → B → A with new contents refuses `revision-reuse` and keeps two versions |

The API lane was run against disposable databases created for this rehearsal. No production or
shared development database was reset, no deployment was made and no object was purged.

### Review-fix verification (2026-10-19)

Independent review requested three substantive corrections:

1. **Travel** resolves the interpreter's exact `connectionId` and direction through
   `getCameraConnectionRoute`, with a typed gap instead of general pathfinding.
2. **R2 purge** proves ownership with the required `R2_OBJECT_NAMESPACE` (asset keys are
   `projects/<namespace>/…`) and requires migration `005` to be recorded before listing or deleting.
   A bucket shared with another namespace refuses.
3. **Stop-free Presentations** are selectable from an accessible visitor `Presentations` navigation
   and realize their View as a Cut through the same Camera authority, with no fabricated Stop.

| Check | Result |
| --- | --- |
| `npm run check:api` and `npm run build:api` | pass |
| `npm run test:api` | pass — 79 tests, 0 failures, 0 skips, including namespace purge refusals and namespaced asset keys |
| `npm run check` (editor) | pass — 0 errors, 0 warnings |
| `npx vitest run tests/lib/visitor` | pass — 52 tests |
| `npm run test:fast` | pass — 138 files, 1913 tests |
| `npm run test:arch` | pass — 20 files, 163 tests |

The rerun covers the three review corrections: connection-exact Travel, the namespace/epoch purge
boundary, and visitor selection of a Stop-free Presentation.

### Runtime-blocker follow-up (2026-10-19)

Two potential runtime blockers and the legacy-key activation disposition were checked with focused
evidence rather than assumed:

- **Detached Presentation outliving an advance.** `continue()` now clears the Stop-free selection
  only when the interpreter returns a new state. The store test shows an ignored Continue during a
  hold keeps the selected View, while an explicit Continue that advances and a hold auto-advance
  both return the Camera to the Guide's Presentation.
- **Hold ticks restarting an in-flight Travel.** The destination Stop's hold replaces
  `ExperienceRunState` every frame while the Camera is still travelling; before the fix the mounted
  director started the same Travel 11 times in 10 frames, resetting progress from the mid-flight
  pose. The in-flight-target guard makes it one start across the hold ticks and the run completion.
  The same mount proves the Travel realizes `connection-2` in the `forward` direction.
- **Legacy R2 keys.** A pre-namespace key refuses the purge; the activation disposition is recorded
  under the purge boundary above.

| Check | Result |
| --- | --- |
| `npx vitest run tests/lib/visitor` | pass — 55 tests, including the mounted director and reactive store probe |
| `npm run check` (editor) | pass — 0 errors, 0 warnings |
| `npm run test:fast` | pass — 139 files, 1915 tests |
| `npm run build:api` + `r2-purge.test.mjs` | pass — 10 purge tests, 0 failures |

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
7. **Not accepted and not activated.** The three substantive review corrections are implemented and
   verified above; a fresh independent review of #158 is still required. No data reset, no deploy,
   no gate acceptance.

## Acceptance status

No criterion is marked accepted. Phase A is implemented and green on the checks above; independent
review of the unit Save live switch, epoch admission and retirement is required before S04 can close.
