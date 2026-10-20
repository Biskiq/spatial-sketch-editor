# T3.P01.S04 — acceptance record: Live ownership cutover

**Slice:** T3.P01.S04 · **Status:** authorized 2026-10-19; **Phase A implementation ACCEPTED at `b9cb5ed1` (round 4) with the declared-origin correction at `ce6678da`; the branch is merged with frozen `main` at `fd3cf67e`; Phase B implemented on PR #158 with the A/B/C corrections; independent final review pending; the slice is not yet accepted, merged, activated or closeable**
**Plan:** [implementation-plan.md](./implementation-plan.md) — owns this slice's acceptance criteria
**Phase:** [T3.P01](../README.md) · **Register:** [phase slice register](../README.md#slice-register)

This record holds Phase A and Phase B implementation evidence. It does **not** claim slice
acceptance, activation or the cutover gate. Independent review accepted the **Phase A
implementation** at `dcc23bd2` (round 3, no blocking findings); the interrupted-Travel correction
at `b9cb5ed1` was re-reviewed and **accepted** (round 4, no blocking findings). Phase B is
implemented in `0d2f6ceb` and the A/B/C corrections below; its independent final review is the
remaining acceptance event. The owner-run activation runbook has not been executed.

## Base and evidence lane

| Item | Value |
| --- | --- |
| Branch | `T3-P01-S04` (isolated sibling worktree) |
| Base | `origin/main` `919c2904` (PR #155 merge) |
| Phase A scope | T3-owned files only: `apps/api/**` and migrations, project-model units/program/save, `lib/visitor/**`, camera-core flow exports |
| Phase B | implemented in `0d2f6ceb`; A/B/C corrections in the reviewed working tree |
| PR lifecycle | PR #158 is the continuing S04 implementation PR. Phase A is reviewed there but is **not** merged on its own; Phase B lands on the same PR, followed by final review and closeout. |

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

#### Travel-settling follow-up (2026-10-19, `dcc23bd2`)

Targeted verification found one more consequence of the in-flight guard: because it ran **before** the
Cut/reduced-motion branch, the director would not settle an explicit Cut to the View it was already
travelling to, a Cut back to the origin View, or a reduced-motion toggle mid-Travel. All three are
commands to settle now, not duplicate hold ticks, and the animated Travel ran on instead.
`VisitorCameraDirector` now decides the instant path first and applies it only when there is something
to settle; the hold-tick guard still applies to actual Travels, and a hold at a Cut Stop does not
reframe (so look-around survives). Three mounted regressions in
`visitor-camera-director.test.ts` cover the destination Cut, the origin Cut and the reduced-motion
toggle; all three fail against `f5147aca` and pass at `dcc23bd2`.

| Check at `dcc23bd2` | Result |
| --- | --- |
| `npx vitest run tests/lib/visitor` | pass — 7 files, 58 tests (director 5/5) |
| `npm run check` (editor) | pass — 0 errors, 0 warnings |
| `npm run test:fast` | pass — 139 files, 1,918 tests |
| `npm run test:arch` | pass — 20 files, 164 tests |
| `npm run test:heavy` | pass — 8 files, 118 tests |

#### Interrupted-Travel declared handoff (2026-10-19, `b9cb5ed1`) — accepted

A new targeted finding was reachable under AM-9's own time contract. Holds start at **editorial**
arrival, not when the Camera physically finishes a Travel. With an authored A→B Travel of five
seconds and a B hold of half a second, the interpreter advances to C while the Camera is still
between A and B. The director still records A as its settled View, so resolving the authored B→C
connection against A→C produced a false endpoint mismatch: a typed gap and an unintended Cut to C.
The three-Stop mount reproduces exactly that (`Camera connection "connection-bc" does not join
"view-a" to "view-c"`).

**Decision — declared handoff.** Experience owns Stop arrival, holds, continuation and invocation
time mapping; Camera owns the motion that realizes an invocation. A next authored Travel therefore
may not be made to wait for the stale one (that would let Camera motion gate editorial time, and
queuing would accumulate while the Experience has already ended), and it may not be pathfound. The
Camera accepts the handoff: it resolves the **exact** authored connection from the View the
Experience just left (the in-flight destination), realizes it from the live pose, and records that
View as the new logical origin. The stale connection is neither finished first nor redrawn. A
declared handoff is accepted only when the connection joins that in-flight View to the requested
destination; an unrelated connection is still a typed gap. The same rule now covers a Travel back
to the Camera's last settled View, which was previously swallowed by the duplicate-hold-tick guard.

Evidence in `visitor-camera-route.test.ts` (forward and reverse handoff, unrelated-connection gap)
and `visitor-camera-director.test.ts` (forward three-Stop handoff and the return-to-origin Travel).
Both mounted cases fail at `e0bc7eed`: the forward one reports the false gap above, and the return
case starts only the stale Travel. Exact connection identity and direction are asserted from the
motion's own edges; reduced motion, explicit Cut, look-around and visitor isolation are unchanged.
Independent re-review accepted this correction (round 4). Its one non-blocking observation is that a
**genuine** handoff gap's message still names only the settled View, not the in-flight View it also
tried; that is a diagnostic wording limit, not a routing or contract defect.

| Check at `b9cb5ed1` (re-review at `e1ffebc6`) | Result |
| --- | --- |
| `npx vitest run tests/lib/visitor` | pass — 7 files, 62 tests (director 7/7, route 6/6) |
| `npm run check` (editor) | pass — 0 errors, 0 warnings |
| `npm run test:fast` | pass — 139 files, 1,922 tests |
| `npm run test:arch` | pass — 20 files, 164 tests |
| `npm run test:heavy` | pass — 8 files, 118 tests |

#### Declared-handoff origin correction (2026-10-19, `ce6678da`)

A declared handoff must resolve the authored connection against the **Experience-declared in-flight
predecessor View only**. The resolver previously also offered the Camera's earlier settled View as an
alternative origin, so during A→B an invocation toward C whose connection joins A→C was accepted
from A — an unrelated connection the Experience never requested.

`resolveVisitorCameraRoute` now chooses exactly one origin: the declared in-flight View when the
Experience has left the settled View, otherwise the settled View. Ordinary non-handoff Travel keeps
its existing settled-origin semantics, and the gap message names the origin that was actually
evaluated. `ce6678da` adds the negative regression (A→B in flight, C requested with an A→C
connection: typed gap; the same connection is a route from settled A without a handoff). The
regression fails on the pre-fix resolver (two cases fail when the origin is forced to the settled
View) and passes with the correction. `6d146f20` collapses the now-single-element origin list to one
expression without changing behaviour.

Independent reviewer tooling was unavailable in this session, so this correction was reviewed by the
coordinator against the AM-9 contract rather than by a second independent agent; that limitation is
recorded here. Forward/reverse handoffs, Cut, reduced motion, exact connection identity and live-pose
continuity are unchanged and remain covered by the existing director and route suites.

### Merged with the batch C freeze (2026-10-19, `fd3cf67e`)

`origin/main` (`d6b4bf7d`, after #156, #159, #157 and #161) is merged into the branch. The one
conflict — the tech-debt ledger — resolves by keeping the frozen mainline text and adding this
slice's TD-6/TD-7 closure table; TD-9 and TD-10 stayed open at that point (TD-9 closes in Phase B
below; TD-10 remains open).

| Check at `fd3cf67e` | Result |
| --- | --- |
| `npm run check` | pass — 0 errors, 0 warnings |
| `npm test` | pass — 172 files, 2,253 tests |
| `npm run test:arch` | pass — 20 files, 164 tests |
| `npm run test:heavy` | pass — 8 files, 118 tests |
| `npx vitest run tests/lib/visitor` | pass — 7 files, 63 tests |

## Phase B — caller migration (implemented 2026-10-19, `0d2f6ceb`)

Phase B is one caller-migration unit: the old current-source reader/writer path is removed rather
than left beside a second F2 path. The implementation evidence below is the state of PR #158 (the
`0d2f6ceb` commit plus the A/B/C corrections that follow it).

### Boot, starter, empty, Open, Download, import/export

- Every editor source enters through `admitSource`/`prepareUnitRuntime`; `bootFromSourceJson`
  validates the F2 envelope before the Stage exists. The current-source readers
  (`current-stage-source.ts`, `project-codec.ts`, `content-identity.ts`, `wall-first-project.ts`,
  the migration converter) and their package exports are deleted. The package boundary declares F2
  admission and the root barrel exports no current-source reader.
- The starter gallery and empty baseline emit F2 envelopes directly; `new` (no cloud row,
  create-only) and `missing` remain distinct boot states. Open and Reload parse the downloaded
  canonical JSON bytes through the same admission path, and Download writes
  `snapshot.canonicalJson`. Import/export therefore round-trips the unit envelope, not a parallel
  serialization.
- A source that does not admit is a refused state; the mounted Stage, previous baseline and Save
  state are not silently replaced.

### Stage read ownership, operations and history

- `StageDomainRead` and every T1/T2 consumer read the unit envelope and its identity. Reference
  resolution, selection, gestures, task lifecycle, Undo/Redo and source replacement are unit-scoped;
  there is one acceptance host and one history stack per epoch.
- Layout precision/planner callers and Scene composition callers are unit planners. The integrated
  composition journey covers typed Place, Resize, Duplicate, Delete, Undo, Redo and Reload; the Head
  Save journey covers Save/conflict/Reload. The source-replacement suite covers the explicit
  replacement guard and unsaved-work confirmation.
- **Scene definitions.** Placement admits only definitions captured for the session: the three
  analytical native primitives and catalogue models with a recorded, verified r186 contact. The
  catalogue inventory keeps every excluded floor model with a reason (the piano's geometry
  mismatch included). A payload naming an uncaptured pin refuses `missing-definition`; a captured
  pin whose `metadataContentId` changed refuses `definition-changed`. A missing definition is
  reported as unavailable, never fabricated or silently substituted.

### Head Save and TD-9

- The Head mounts the unit Save state. Create-only and expected-saved-base preconditions, CAS
  conflict handling, explicit Reload, revision/operation identity and the ambiguous-retry path are
  the only Save transport. Diagnostics and executable closure are disclosed; closure disables Save
  with the visible reason and is refused again by the Save capture/read path.
- **TD-9** is working on F2: a Save that needs sign-in writes the exact captured unit Save and its
  precondition through the Save-owned pending-capture seam before the redirect. On return the
  spatial route consumes `resume-save` as an **offer**, never an automatic Save or creation. A
  create-only capture is offered after a 404 because the cloud row does not exist yet; the exact
  source, operation ID and precondition are preserved. Resuming goes through the host's
  replacement/unsaved-work confirmation; cancellation keeps the current content, selection,
  history and saved base. Re-admission uses the captured `acceptedRevision` epoch, and a stale
  admission cannot overwrite a newer session. The old draft format is invalid and no current-source
  draft path survives.

### Visitor Camera graph and one Camera authority

- The cold visitor runtime builds its Camera graph from the Camera unit named by the programmed
  Views, with Scene retained only as the landed encoding of Camera data until its explicit cutover.
  Missing Camera definitions surface as typed gaps and settle neutrally rather than throwing or
  falling back to node order. Travel, Cut and reduced motion still resolve through the one Camera
  authority; the Guide-free Presentation control and the declared-handoff rules from Phase A are
  unchanged.

### Requirements retirement

- `T1.P01.S06`'s register row and plan header now consume `F1.reference@1, F2.unit-envelope@1,
  F4.intent-acceptance@1, T1.viewport-projection@1, T3.camera-experience-cutover@1` and require the
  unit scopes, in the same change that retires the current-source capabilities. S06 remains
  `proposed`; the `parallel-track-gates.test.ts` pin matches the rewritten row.
- `F4.intent-acceptance@1:local-single-domain-v1` and
  `F4.intent-acceptance@1:conditional-save-current-v1` are `retired` in the gate register and their
  capability records. Shipped slices keep their historical requirements; no live caller names the
  retired scopes. The historical F4 module keeps its profile name for the retired contract, but no
  editor boot, Stage, Save or visitor path selects it.
- The gate register's F4 row points at the existing unit acceptance/conformance exports, not at
  removed current-source modules.

### A/B/C review corrections

- **A — create-only resume after sign-in.** Saving a project that has no cloud row and returning
  after the 404 offers the exact create-only capture instead of dropping it. The offer preserves
  the operation ID, precondition and canonical source; it never runs automatically.
- **B — replacement and stale admission.** Resuming uses the host's replacement/unsaved-work
  confirmation rather than a second controller. Cancellation preserves the working source,
  selection, history and saved base. The resume admission carries the capture's
  `acceptedRevision`; an async admission that settles after a newer session is dropped.
- **C — executable closure.** `prepareUnitRuntime` exposes `diagnostics` and `closure` through
  `StageDomainRead`/`StageReadSnapshot`; the route discloses both, and the Head Save is disabled
  with the reason when closure is present. F4 acceptance, Save capture/read and visitor release
  refuse executable closure rather than executing it. Structural admission still admits a source
  with repairable diagnostics; those remain visible and non-blocking, and no diagnostic is
  suppressed to make a test or a pin pass.

## Verification run on the final Phase B tree

| Check | Result |
| --- | --- |
| `npm run check:project-model`, `check:camera-core`, `check:layout-core` | pass |
| `npm run check:api` | pass |
| `npm run check` (editor) | pass — 0 errors, 0 warnings |
| `npm run build` (editor) and `npm run build:api` | pass |
| `npm test` (editor, exhaustive) | pass — 169 files, 2,208 tests |
| `npm run test:arch` | pass — 20 files, 166 tests |
| `npm run test:heavy` | pass — 8 files, 118 tests |
| DB-backed `npm run test:api` on fresh `biskiq_s04_phaseb_final` | pass — 80 tests, 0 failures, 0 skips |
| Migration 005 rehearsal on fresh `biskiq_s04_phaseb_rehearsal_final` | seeded one row in each of the six authored tables; 005 removed all six and retained `users`; `schema_migrations` = 1–5; rerun was a no-op; pre-epoch writer refused `23502` |
| Two concurrent runners | automated in `migration-fence.test.mjs` on the same final tree — both complete; versions recorded once each |
| Focused journeys | `scene-composition-loop` (Place, Resize, Duplicate, Delete, Undo, Redo, Reload), `head-save-journey` (Save/conflict/Reload), `spatial-route-resume-save` (A/B), `stage-source-admission` (C), visitor Camera/reduced-motion suites |

**Browser evidence (test-only stage-conformance harness,
`vite.stage-conformance.config.ts`, owned session).** With no cloud origin configured the route
boots the `new` state; the starter replacement loaded the F2 "Enclosed room" (four wall units and a
room floor). The probe adapter registered through the real unit host; an accepted wall-height edit
enabled Undo, Undo disabled Redo, Redo restored it, Download source JSON was enabled, and the
reduced-motion control toggled without error. The harness has no API/Save transport, so Save
remained disabled there; Save, conflict, Reload and the sign-in resume are proved by the mounted
route/Head suites and the API lane rather than claimed as browser Save evidence.

No production or shared database was reset, no deployment was made, no object was purged and no
production activation occurred in this verification.

## Outstanding and declared limits

1. **Independent final review of Phase B is pending.** This record does not accept the slice, the
   cutover gate or #158 until that review returns without blocking findings.
2. **Public reader remains T4.** The editor still contains the unreachable public route/cold
   reader/client; every public read answers not-found while T4 owns the prepared reader. This is not
   a live delivery path and is not Phase B scope.
3. **Catalogue model placement awaits r186 contact verification** (T2 follow-on K1). Existing
   documents may reference those assets; new placement does not admit them until a verified record
   exists. The native primitives are analytical and admitted.
4. **Resource bytes remain host-asserted until storage verification**; new typed-resource admission
   is the staged T2 follow-on, not part of this cutover.
5. The envelope's `acceptedRevision` is baseline provenance, not revision authority; Save receipts
   and the API own revision identity.
6. `T3.P01.S04` is the phase's declared final gate. Slice closeout makes the phase **closable**, not
   closed; phase closure remains an owner event.

## Acceptance status

**Phase A implementation: ACCEPTED at `b9cb5ed1`** (independent re-review round 4, no blocking
findings, covering the interrupted-Travel declared handoff; the round-3 acceptance at `dcc23bd2`
covered the unit Save live switch, epoch admission, retirement, the runtime blockers and the
Travel-settling fix). The declared-origin correction at `ce6678da` is the only Phase A change after
that verdict and is recorded above with its coordinator review limitation.

**Phase B implementation: complete, independent final review pending.** The A/B/C corrections are
implemented and covered by the mounted route, Save and source-admission suites. This is **not**
slice acceptance: the final review, closeout, the cutover gate and the owner-run activation remain.
No criterion is marked accepted for the slice, and #158 stays open on the same PR.
