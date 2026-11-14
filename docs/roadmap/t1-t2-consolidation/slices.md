# T1/T2 consolidation — slice plans

**Execution addendum:** [`execution-schedule.md`](./execution-schedule.md) owns current PR grouping,
dependencies and file reservations; [`decomposition.md`](./decomposition.md) adds ownership
extractions. The specifications below remain authoritative for scope, behavior, measurement,
acceptance and rollback; their original one-slice-per-PR and lane packaging is superseded only by
that additive schedule.

Findings are in [`audit.md`](./audit.md); the renderer target is in
[`renderer-refactor.md`](./renderer-refactor.md). Each slice is one pull request unless it says
otherwise. A slice edits only its listed touchpoints; a needed change outside them is reported, not
made (hard rule 9).

## 1. Rules for every slice

### 1.1 Measurement protocol

Planning used hand calculation only. Execution measures inside the slice:

1. **Measure first.** Land the slice's counter and its failing or characterising test before any
   change. Record the number in the pull request.
2. **Decide.** Apply the change only if the measurement supports the slice's stated hypothesis. If
   it does not, close the slice with the measurement as the result, or revise the hypothesis in the
   pull request before writing code.
3. **Measure again.** The same counter, same fixture, after the change. The acceptance line is the
   count, never a duration.

Instruments, in order of preference:

- **Counts** through `countWork` (`packages/layout-core/src/p2311-perf.ts`), representation stats,
  and `renderer.info` (calls, geometries, textures) read at the mounted boundary. Deterministic;
  safe in the fast and heavy lanes; never a timing gate (tests rule 11).
- **One trace** of one named flow, where a slice asks for a duration split. Evidence in the pull
  request, not a gate.
- **`npm run perf:spot`** only at the two checkpoints in slice C0, under
  [decision D1](./README.md#owner-decisions).

Slices marked **gated** are optimisations whose benefit is a hypothesis. Slices marked
**invariant** restore or enforce a documented rule; they still measure first, to confirm the
violation exists, and are applied when it does.

### 1.2 Common acceptance

- The slice's count assertions pass, and the lanes named by `apps/editor/tests/README.md` for the
  touched paths are green.
- A machinery test never stands in for a call-site test (tests rule 3): a counter is asserted
  through the mounted consumer that the finding named.
- No rendered-result change: structural parity per
  [`renderer-refactor.md`](./renderer-refactor.md) section 4, plus focused manual browser QA of the
  changed surface in Stage and, where shared, Preview.
- New arch tests are registered in `apps/editor/test-lanes.ts`.

### 1.3 Common rollback

Revert the slice's pull request when any of these holds after merge: a rendered or interaction
difference that is not a fixed defect; a count that regresses another slice's acceptance line; a
visitor-isolation or boundary failure. Slices are ordered so that each is independently revertible;
where one is not, its entry says so.

## 2. Order, lanes and parallel work

```text
C0 ─┬─ I1, then I2 ── G1 ── I5                               Lane A  Stage host and Layout adapter
    ├─ G2 ── I4                                             Lane B  project-model runtime
    ├─ G3                                                   Lane C  Paper
    └─ I3 ── R1 ── R2a ─┬─ R3                               Lane D  renderer
                        └─ R2b* ── R4 ── R5 ─┬─ R2c ── R6 ── R7 ── R8
                                             └─ G4*
                                                            * needs G2 merged
```

| Lane | Slices | Files it owns |
| --- | --- | --- |
| A | I1, I2, G1, I5 | the Stage route, `camera-session.ts`, `StageCamera.svelte`, `layout.adapter.ts`, `candidate-preview.ts`, layout-core compile entry |
| B | G2, I4 | `packages/project-model/src/units/runtime.ts`, `source-admission.ts`, Scene types |
| C | G3 | `StagePaper.svelte`, `paper-plan.ts`, `paper-scene.ts` |
| D | I3, R1–R8, G4 | `lib/render`, `lib/museum`, `lib/visitor` world components, `StageCanvas.svelte`, `StageShadowTriggers.svelte`, `StageSelectionLayer.svelte` |

Lanes A, B, C and D are file-disjoint and can run as four parallel sessions after C0. Inside a lane
slices are serial (R3 may run beside R2b). Cross-lane contacts, all small: R2b and G4 need G2; I3
removes one field from `runtime.ts`, so it merges before G2 opens or G2 rebases; I4 edits
`VisitorCameraDirector.svelte` and needs I3 merged. R7 also waits for I1, so that it measures frames
that are actually needed.

Highest value first if the milestone is cut short: **I1, G2, I2 + G1, R1, R2a, R3**.

## 3. Baseline

### C0 · Measurement seam and baseline

**Kind:** prerequisite. **Tier:** 0. **Lane:** before all. **Findings:** all "unknown" entries.

**Goal.** Give every later slice a deterministic count to read, and record where the system stands.

**Change.**

1. Add `countWork` names at the existing call sites, each a one-line call, inert without an
   observer: `render:stage-frame` (the managed renderer's render wrapper), `render:shadow-update`
   (shadow invalidation, already counted in `stats()`; mirror it), `camera:evaluate`,
   `candidate:paper-build`, `paper:plan-build`, `paper:scene-build`, `scene:resolve`,
   `material:resolve`, `texture:variant-acquire`, `texture:variant-dispose`.
2. Add a test helper that mounts the Stage shell composition against a fixture and returns the
   counts and `renderer.info` for a named interaction. It reuses the existing renderer hook
   (`perfRenderer` in `apps/editor/src/lib/platform/perf-marks.ts`) and a stub WebGL context; where
   a count needs a real context, the helper is driven from focused browser QA and the number is
   pasted into the pull request.
3. Add one synthetic Scene fixture for counting only — `grid-M` plus, per Room, three primitives
   (two sharing a look), one Form, one textured primitive; plus 20 artworks of 4 sizes and 12
   instances of one model. It is a counting fixture, not a certified workload.
4. Record the baseline table (frames at rest per second, compiles per preview tick, per-accept
   counts from audit 6.4, live geometries / materials / textures, draws per frame) for M, L and the
   Scene fixture in a new `measurements.md` in this folder. It is deleted with the plan.
5. Under decision D1: run `npm run perf:spot` once for the wall-clock baseline. Issue #273 (the
   perf flows drive a removed menu) is repaired here if the owner folds it in; otherwise the
   wall-clock baseline is skipped and stated as unmeasured.

**Touchpoints.** `apps/editor/src/lib/render/managed-webgl-renderer.ts`,
`apps/editor/src/lib/render/shadow-invalidation.ts`,
`apps/editor/src/lib/authoring/stage/camera-session.ts`,
`apps/editor/src/lib/authoring/adapters/layout/candidate-preview.ts`,
`apps/editor/src/lib/authoring/stage/paper-plan.ts`,
`apps/editor/src/lib/authoring/stage/paper-scene.ts`,
`packages/project-model/src/units/runtime.ts`,
`apps/editor/src/lib/museum/materials/scene-instance-material.ts`,
`apps/editor/src/lib/render/resources/texture-store.ts`; new helper and fixture under the editor
`tests/helpers` folder.

**Acceptance.** Each counter is asserted non-zero by one test through its real call site; with no
observer installed the counters allocate nothing (existing `countWork` contract). The baseline table
is complete or each gap is marked unmeasured.

**Rollback.** Counters are inert; no rollback condition beyond a failing lane.

## 4. Invariant remediation

### I1 · Rest means zero frames

**Kind:** invariant (S06 "stop drawing at rest"). **Tier:** 1 (shared shell). **Lane:** A.
**Depends:** C0. **Findings:** PF-1, EN-1, RR-11.

**Hypothesis.** A settled Stage renders one frame per display frame (audit 6.2).
**Measure first.** Mounted Stage, settled, 120 ticks: expect `render:stage-frame` = 120 and
`camera:evaluate` = 120. If frames are already 0, close the slice.

**Change.**

1. `camera-session.evaluate` returns the **previous evaluation object** when nothing it depends on
   changed: same state identity after `advanceViewport`, equal rect, equal ground reach, equal
   scene radius. `generation` advances only when a new evaluation is produced.
2. In the Stage route, `evaluation` becomes `$state.raw` (evaluations are immutable; a deep proxy
   makes every assignment a change) and is assigned only when the object differs.
3. `markers`, `candidatePreviews` and `guides` are assigned only when the facade returns a different
   array; the facade returns the previous array when its inputs (evaluation, selection, hover,
   candidate, accepted revision) are unchanged.
4. Every other cause of a new image keeps its own explicit `invalidate()` (they already exist in
   `StageCamera.svelte`, Paper, the representations and the environment). The rAF loop stays; it
   becomes cheap, not absent.
5. Replace the source-shape assertion with the mounted count test below.

**Touchpoints.** the Stage route `+page.svelte` (`refresh`, the `evaluation` declaration, the
`tick` loop); `apps/editor/src/lib/authoring/stage/camera-session.ts`;
`apps/editor/src/lib/authoring/stage/stage-facade.ts`;
`apps/editor/src/lib/authoring/stage/shell/StageCamera.svelte`;
`apps/editor/tests/lib/authoring/stage-shell-composition.test.ts`.

**Tests.** Mounted: settled Stage over 120 ticks renders 0 frames; one pan step renders exactly 1;
a camera flight renders 1 per tick until its endpoint, then 0; each of selection change, hover
change, accepted edit, environment change, Paper toggle and resize renders ≥ 1. Unit: `evaluate`
returns the identical object on a repeated call and a new one after an intent, a rebase or a rect
change.

**Acceptance.** Frames at rest = 0 in Plan and 3D; every listed cause still produces its frame.
Preview (RR-11) is **counted only** here: frames per second at a hold are added to
`measurements.md`; changing Preview's render mode is a separate decision once the number exists.

**Rollback.** A stale image after any change that the tests did not list: add the missing
invalidation in the same pull request if it is one site; revert if more than two sites surface in
QA, and reopen with those sites as tests.

### I2 · One read path for compiled geometry

**Kind:** invariant (hard rule 6 ownership; `layout-performance.md` per-move rule). **Tier:** 1.
**Lane:** A. **Depends:** C0. **Findings:** AR-4, EN-2.

**Hypothesis.** A document that was already compiled is compiled again by session-less callers,
because the session-less entry writes the passive record and never reads it.
**Measure first.** `compile:walls` for: compiling the same frozen document twice session-less
(expect 2W); one candidate-preview tick at M (expect ≥ W); Scene planning after an accept (expect
0 or W — unknown).

**Change.**

1. `compileWallFirstLayoutGeometry(document)` returns the passive record's geometry when one exists
   for that document object. Documents are frozen and immutable, so identity is a sound key. The
   session path is unchanged.
2. `compiledBySource` in scene planning is deleted; its callers use the entry above.
3. `plannerCompileSession` stops being a module singleton: the Layout adapter context owns one per
   opened project and releases it on close.
4. New arch test `compile-entry-boundary`: under `apps/editor/src/lib/authoring`, only the host
   acceptance module and the Layout adapter's compile seam may import a compile function; every
   other module receives compiled geometry.

**Touchpoints.** `packages/layout-core/src/layout-geometry.ts`,
`packages/layout-core/src/layout-geometry-delta.ts`,
`packages/project-model/src/scene-planning/support.ts`,
`apps/editor/src/lib/authoring/adapters/layout/precision.ts`,
`apps/editor/src/lib/authoring/stage/starter-gallery.ts`, `apps/editor/test-lanes.ts`; new arch
test.

**Tests.** Second session-less compile of the same document: `compile:walls` = 0 and the same
geometry object. A structurally equal but distinct document compiles (no content-keyed cache is
introduced). Closing a project releases the planner session (count of retained prepared entries
returns to 0).

**Acceptance.** The three measured counts drop to "one compile per distinct document". No new cache
exists; two are removed.

**Rollback.** Any differential between a passive-record result and a fresh compile in the existing
kernel differential suites.

### I3 · Retire the Room-owned wall path and the Room frame

**Kind:** invariant (hard rule 2; no compatibility path). **Tier:** 1 (visitor surface).
**Lane:** D, first. **Depends:** none. **Findings:** AR-2, AR-3.

**Establish first (no code).** (a) No compile of a format-7 document yields a non-empty
`room.walls`; (b) the Scene 6 codec refuses `roomId`; (c) no production caller populates the Room
registry. If any is false, stop and report: the path is live and this slice becomes a flag.

**Change.** Remove from `VisitorLayoutShell.svelte` the `buildRoomWallMesh` import, `adaptedRooms`
and the `room.walls` portal loop. Remove Room grouping from `VisitorEntityGroups.svelte`; entities
render in the world frame. Remove the `rooms` prop from the Stage canvas, shadow triggers and
visitor entities, and `rooms` from the prepared runtime. Remove `roomId` from the Scene entity,
view and connection types. No format change: per the owner's no-versioning rule nothing is migrated.

**Touchpoints.** `apps/editor/src/lib/visitor/VisitorLayoutShell.svelte`,
`apps/editor/src/lib/visitor/VisitorEntityGroups.svelte`,
`apps/editor/src/lib/visitor/VisitorEntities.svelte`,
`apps/editor/src/lib/authoring/stage/shell/StageCanvas.svelte`,
`apps/editor/src/lib/authoring/stage/shell/StageShadowTriggers.svelte`,
`packages/project-model/src/scene.ts`, `packages/project-model/src/units/runtime.ts`,
`apps/editor/tests/lib/museum/layout/wall-mesh-shell-boundary.test.ts`.

**Tests.** Codec refusal of `roomId` (exists or added). Arch: `VisitorLayoutShell` imports no wall
mesh builder. Structural parity of Scene entity world matrices before and after.

**Acceptance.** `grep` finds no `roomId` in product Scene types and no Room registry in the runtime.

**Rollback.** Any entity whose world matrix changes.

### I4 · Runtime Scene is Camera-free

**Kind:** invariant (hard rule 2). **Tier:** 1. **Lane:** B. **Depends:** G2, I3.
**Findings:** AR-1.

**Change.** `RuntimeScene` loses `navigationNodes` and `connections`. `sceneProjectionForRuntime`
is deleted. The prepared runtime exposes navigation as its own value built from the Camera unit
(and compiled Layout where it needs it). Consumers that read navigation from the Scene — the
visitor director and the Experience program — read the navigation value instead. Scene validation
that needs Camera ids receives them as an argument.

**Touchpoints.** `packages/project-model/src/units/runtime.ts`, `packages/project-model/src/scene.ts`,
`apps/editor/src/lib/content/scene.ts`, `apps/editor/src/lib/visitor/VisitorCameraDirector.svelte`,
and the navigation-graph constructor's callers (enumerated in the pull request before editing).

**Tests.** A Camera-only edit leaves `runtime.scene` identical (`===`) and `scene:resolve` = 0. A
Scene-only edit leaves the navigation value identical. Existing Camera and Experience suites stay
green unchanged.

**Acceptance.** No type under Scene mentions a Camera view; a Camera edit triggers no Scene-keyed
render work (`material:resolve` = 0, `render:shadow-update` = 0).

**Rollback.** Any Camera, Experience or visitor-run behaviour change. This slice is the widest in
Lane B; if the caller enumeration exceeds the visitor director, the Experience program and their
tests, stop and report the list before editing.

### I5 · Opening symbols come from the Layout plan representation

**Kind:** invariant (hard rule 6: no consumer reconstruction). **Tier:** 0. **Lane:** A.
**Depends:** G1 (same file). **Findings:** AR-5.

**Change.** Move door-swing and window symbol construction for an attempted Opening into
`layout-plan-representation.ts` as the same function the accepted Plan uses, taking an opening
description. `openingAttemptPlanPaper` calls it.

**Touchpoints.** `packages/layout-core/src/layout-plan-representation.ts`,
`apps/editor/src/lib/authoring/adapters/layout/candidate-preview.ts`,
`apps/editor/tests/lib/authoring/layout-candidate-preview.test.ts`.

**Tests.** For the same Opening, the candidate symbol equals the accepted symbol
segment-for-segment.

**Rollback.** Any candidate symbol difference visible in QA that the equality test missed.

## 5. T1 geometry and editing path

### G1 · Candidate previews: once per distinct candidate

**Kind:** gated. **Tier:** 1. **Lane:** A. **Depends:** I2. **Findings:** PF-2, EN-2.

**Hypothesis.** A live Layout candidate costs one whole-project compile, Plan evaluation and Paper
build per tick, moving or not (audit 6.3).
**Measure first.** Mounted Stage at M with a wall-draw candidate, an Opening candidate in 3D and an
Opening Repeat proposal; pointer still for 60 ticks: expect `candidate:paper-build` = 60 and
`compile:walls` ≥ 60·W each. Also record which gestures reach `candidatePaper` at all. If a still
pointer already costs 0, stop at step 1's test.

**Change, in two steps; the second only if the first leaves a measured problem.**

1. **Per change, not per frame.** The adapter memoises the candidate's Paper by the candidate
   document's identity and the reading (Plan / 3D), holding exactly one entry. If the gesture
   rebuilds an equal candidate document every tick, the memo moves up to the proposal (pointer
   sample and modifiers) so that a still pointer builds nothing. The Opening Repeat planner is
   memoised the same way.
2. **Local, not whole-project** (only if a moving pointer at L still exceeds one compile's worth of
   work that matters, by a trace): compile the candidate through a preview session seeded from the
   accepted compile, so only changed walls recompile, and build Paper for the changed ids only.

**Touchpoints.** `apps/editor/src/lib/authoring/adapters/layout.adapter.ts` (`candidatePaper`,
`candidatePreviews`, the repeat preview), `apps/editor/src/lib/authoring/adapters/layout/candidate-preview.ts`,
`apps/editor/tests/lib/authoring/layout-candidate-preview.test.ts`; the reference sentence under
[decision D3](./README.md#owner-decisions).

**Tests.** Still pointer, 60 ticks: `candidate:paper-build` = 1 and `compile:walls` ≤ W (step 1) or
≤ changed walls (step 2). Each pointer move: exactly 1 build. Candidate Paper is equal before and
after for a fixed proposal. Ending the gesture drops the memo.

**Acceptance.** The still-pointer count; the per-move count; unchanged candidate drawing.

**Rollback.** A stale candidate (the preview lags the pointer or survives the gesture).

### G2 · Per-unit runtime retention

**Kind:** gated. **Tier:** 1. **Lane:** B. **Depends:** C0. **Findings:** PF-3, PF-4.

**Hypothesis.** An accepted edit to one unit re-resolves Scene and reruns every Scene-keyed
consumer (audit 6.4).
**Measure first.** On the Scene fixture, accept a Wall move, a Camera view edit and an Experience
edit: record `scene:resolve`, `material:resolve`, `texture:variant-dispose`,
`texture:variant-acquire`, `render:shadow-update`, and texture uploads from `renderer.info` in
browser QA. Expect E resolutions and ≥ 1 shadow update each; the texture counts are the unknown.

**Change.**

1. `prepareValidatedUnitRuntime` takes the previous prepared runtime and reuses each part whose
   inputs are identical objects: the resolved Scene when the Scene unit and resources unit are
   unchanged; navigation when Camera (and Layout, if it reads it) are unchanged. Units are frozen,
   so identity is sound. The host passes the previous runtime exactly as it passes the compile
   session today.
2. `validateProjectEnvelope` is left as is unless the measurement shows whole-envelope validation
   is material in an accept; if it is, per-unit validation results are retained by the same rule.
3. Until I4 lands, the retained Scene part is keyed on Scene **and** Camera units, because the
   runtime still merges them. That is honest about AR-1 and is tightened by I4.

**Touchpoints.** `packages/project-model/src/units/runtime.ts`,
`apps/editor/src/lib/authoring/stage/source-admission.ts`,
`apps/editor/src/lib/authoring/stage/host-acceptance.ts`,
`apps/editor/tests/lib/authoring/stage-source-admission.test.ts`.

**Tests.** After a Wall edit: `runtime.scene === previous.scene`, `scene:resolve` = 0,
`material:resolve` = 0, texture counts = 0. After a Scene edit: `compile:walls` = 0 (already true;
pinned). Undo and redo return the retained objects for the restored revisions where the host still
holds them, and never a stale one (differential against a fresh preparation).

**Acceptance.** An edit that does not touch Scene performs zero Scene work.

**Rollback.** Any differential between a retained and a fresh preparation.

### G3 · Paper: selection-stable, then incremental

**Kind:** gated. **Tier:** 0. **Lane:** C. **Depends:** C0. **Findings:** PF-5.

**Hypothesis.** Selecting an Opening rebuilds every Paper buffer; an accept rebuilds all of Paper
for a one-wall change.
**Measure first.** `paper:plan-build` and `paper:scene-build` for: select and deselect an Opening,
hover, pan, zoom, accept one Wall move — at M and L. Expect 1 full build per selection change and
per accept, 0 per pan. One trace of an L accept gives Paper's share of the post-commit 100 ms.

**Change, in two steps.**

1. **Selection never rebuilds geometry.** The Paper scene is built from the unfiltered drawing; the
   lines a selection hides are a draw-range or visibility change on a batch that is split so those
   lines are addressable. `paperDrawingForSelection` stops producing a new drawing object.
2. **Incremental build** — only if the trace shows Paper is a material share of the L accept: the
   Paper plan is built per Room and per Wall keyed by their `cacheKey`, fills are retained per Room,
   and only changed entries are rebuilt and re-merged.

**Touchpoints.** `apps/editor/src/lib/authoring/stage/shell/StagePaper.svelte`,
`apps/editor/src/lib/authoring/stage/paper-plan.ts`,
`apps/editor/src/lib/authoring/stage/paper-scene.ts`,
`apps/editor/src/lib/authoring/stage/paper-fill-geometry.ts`,
`apps/editor/tests/lib/authoring/stage-paper.test.ts`,
`apps/editor/tests/lib/authoring/stage-paper-pick.test.ts`.

**Tests.** Selection and hover: `paper:scene-build` = 0. Step 2: accept of one Wall rebuilds only
the entries whose key changed; the resulting buffers equal a full rebuild's (differential).

**Rollback.** Any Paper drawing or pick difference against the full rebuild.

### G4 · Shadows follow caster content

**Kind:** gated. **Tier:** 1. **Lane:** D. **Depends:** G2, R5. **Findings:** RR-8.

**Hypothesis.** Shadow maps re-render on accepts that move no caster, and every frame for a static
Scene that holds a model and a casting light.
**Measure first.** `render:shadow-update` per accept (Camera edit, non-casting entity edit) and per
second at rest on the Scene fixture. Expect ≥ 1 and 60.

**Change.** Triggers become the identities of caster content only: compiled geometry, the Scene
render description's caster subset, and light descriptors. `needsPerFrameShadows` is deleted: the
model representation (R5) reports arrival and invalidates once; per-frame updates remain only while
an animated model is actually playing.

**Touchpoints.** `apps/editor/src/lib/authoring/stage/shell/StageShadowTriggers.svelte`,
`apps/editor/src/lib/render/shadow-invalidation.ts`,
`apps/editor/tests/lib/render/shadow-invalidation.test.ts`.

**Tests.** Camera edit: 0 shadow updates. Model arrival: exactly 1. Static Scene at rest: 0. Caster
move: 1.

**Rollback.** A stale shadow after any caster or light change.

## 6. Renderer refactor

### R1 · Portability boundary and owned render identity

**Kind:** invariant + refactor. **Tier:** 1. **Lane:** D. **Depends:** I3.
**Findings:** EN-4, EN-5, PF-6.

**Change.**

1. Wall and object representations gain `objectOf(id)` and `setHidden(ids)` backed by the map they
   already keep. The shell's visibility loop becomes one `setHidden` call.
2. `StageSelectionLayer.svelte` and `scene-pick-source.ts` resolve objects through `objectOf`;
   name-prefix tests are replaced by an id recorded on `userData` by the representation. Object
   names remain for debugging and are read by no code.
3. New arch test `renderer-portability-boundary`: outside the allowlist in audit 5.1, product source
   contains no `onBeforeCompile`, `ShaderMaterial`, `RawShaderMaterial`, `WebGLRenderTarget`,
   `getContext(` on a renderer, or import from a WebGL-only Three path. The allowlist is asserted
   exactly, so removing a site requires removing its entry.
4. New arch test `render-identity-boundary`: no `getObjectByName` in product source.

**Touchpoints.** `apps/editor/src/lib/render/layout-wall-representation.ts`,
`apps/editor/src/lib/render/layout-object-representation.ts`,
`apps/editor/src/lib/visitor/VisitorLayoutShell.svelte`,
`apps/editor/src/lib/authoring/stage/shell/StageSelectionLayer.svelte`,
`apps/editor/src/lib/authoring/scene/scene-pick-source.ts`, `apps/editor/test-lanes.ts`,
`apps/editor/tests/lib/render/layout-wall-representation.test.ts`,
`apps/editor/tests/lib/render/layout-object-representation.test.ts`.

**Tests.** `objectOf` returns the retained mesh for every compiled id and null after release.
Hiding k of W walls costs O(k) (a `representation:` count, not W²). Selection ink and picks are
unchanged on the existing suites.

**Rollback.** Any selection or pick difference.

### R2 · Material store: the one factory

**Kind:** invariant (T2 direction) + refactor. **Tier:** 1. **Lane:** D. **Findings:** AR-6, EN-3,
RR-7, PF-4. Three pull requests.

**R2a — store, descriptors, Layout surfaces. Depends:** R1.

- New modules under the editor `lib/render/resources` folder: `material-store.ts` (descriptor →
  canonical key → shared instance, reference counts, `stats()`), `material-descriptor.ts` (the
  descriptor type and canonicalisation), `texture-store.ts` (the existing variant pool moved
  unchanged, plus deferred release).
- Walls, the wall failure material and Layout objects acquire through the store.
- New arch test `material-factory-boundary`: a `Mesh*Material`, `ShadowMaterial` or `T.Mesh*Material`
  constructor appears only in the store, plus an allowlist that starts as every remaining site in
  RR-7 and the editor-ink sites. R2b and R2c delete allowlist entries.
- **Tests.** Equal descriptors yield one instance; counts reach zero and dispose; canonical keys are
  order-independent. Wall and object representation stats still report "materials created per
  edit = 0".

**R2b — Scene instance materials and texture lifetime. Depends:** R2a, G2.

- **Measure first:** on the Scene fixture, materials live and `texture:variant-*` per accepted Scene
  edit. Expect ≈ E materials and churn proportional to textured entities.
- The resolved look (`scene-instance-material.ts`) becomes a pure function evaluated once per Scene
  description, producing descriptors. `SceneInstanceMaterial.svelte`, `MuseumMaterial.svelte` and
  `FallbackMaterial.svelte` acquire from the store by key; their effect depends on the key string,
  not on object identity. Variant release is deferred to the next idle point.
- **Tests.** Editing one entity's colour: 1 material acquired, 1 released, 0 texture disposals for
  the others. Two entities with one look share one instance. Release-then-reacquire in one update
  disposes nothing.

**R2c — models, artwork, environment, plinth. Depends:** R2b, R5.

- Model remap materials are keyed by (asset, mesh, remap) and shared across instances; artwork,
  environment ground and plinth acquire through the store. The allowlist is reduced to editor ink.
- **Tests.** N instances of one model hold m materials, not 2·N·m.

**Touchpoints (all three).** `apps/editor/src/lib/museum/layout/wall-material-factory.ts`,
`apps/editor/src/lib/render/layout-wall-representation.ts`,
`apps/editor/src/lib/render/layout-object-representation.ts`,
`apps/editor/src/lib/museum/materials/scene-instance-material.ts`,
`apps/editor/src/lib/museum/materials/MuseumMaterial.svelte`,
`apps/editor/src/lib/render/resources/texture-store.ts`,
`apps/editor/src/lib/museum/assets/FallbackMaterial.svelte`,
`apps/editor/src/lib/render/models/model-realization.ts`,
`apps/editor/src/lib/museum/entities/EntityArtwork.svelte`,
`apps/editor/src/lib/museum/layout/GroundPlinth.svelte`,
`apps/editor/src/lib/render/WorldEnvironment.svelte`,
`apps/editor/src/lib/visitor/VisitorEntityGroups.svelte`, `apps/editor/test-lanes.ts`,
`apps/editor/tests/lib/museum/materials/scene-instance-material.test.ts`,
`apps/editor/tests/lib/render/resources/texture-store.test.ts`,
`apps/editor/tests/lib/render/default-wall-material.test.ts`.

**Acceptance.** Material constructors exist in one module; live materials on the Scene fixture equal
the number of distinct looks; the pipeline settings match the T2.S0 Gate A record
([decision D4](./README.md#owner-decisions)).

**Rollback.** Any material property difference in the parity test; any texture that fails to
reappear after a release.

### R3 · Room representation

**Kind:** refactor, with a gated batching step. **Tier:** 1. **Lane:** D. **Depends:** R1, R2a.
**Findings:** RR-1.

**Hypothesis H-R3.** Per-Room Svelte mounting is the largest remaining term in the L open render
gap (audit 6.5).
**Measure first.** One trace of the L open, split into: shell mount, representation updates, Paper
build, pick index, first shadow, first frame. Count mounted components, live geometries and
materials at M and L. If Room mounting is under 10 % of the gap, the slice still proceeds as an
ownership refactor (it removes 3R materials and the last per-entity world mount), but the pull
request records that the open-time hypothesis failed, and the dominant term becomes a flag.

**Change.** New `layout-room-representation.ts` beside the wall representation, same interface
(`update`, `objectOf`, `setHidden`, `dispose`, stats). Per Room, keyed by the Room's `cacheKey`: one
floor geometry shared by the floor and floor-shadow meshes, one ceiling geometry; three shared
materials from the store. The shell mounts its root once and deletes the Room `{#each}`. Framed
door portals stay as they are.

**Gated step.** Merging floors (and separately ceilings) into one static batch each is applied only
if, after the above, a measured L pan frame is draw-bound and the batch removes ≥ 25 % of its
draws. Otherwise it is left to R7 or abandoned.

**Touchpoints.** `apps/editor/src/lib/visitor/VisitorLayoutShell.svelte`, new representation module
and test under the existing render folders, `apps/editor/src/lib/authoring/scene/scene-pick-source.ts`
and `apps/editor/src/lib/authoring/stage/shell/StageSelectionLayer.svelte` (floor lookups through
`objectOf`).

**Tests.** Parity: per Room, floor and ceiling world vertices and material properties equal the
component path's. Counts: an edit that changes one Room builds 2 geometries and retains the rest;
materials created per edit = 0; floor triangulations = 1 per changed Room.

**Acceptance.** Room components mounted = 0; materials = 3; the measured open render gap is
re-recorded.

**Rollback.** Any floor, ceiling, floor-shadow or floor-pick difference.

### R4 · Scene primitives and Forms: shared geometry

**Kind:** refactor. **Tier:** 1. **Lane:** D. **Depends:** R2b. **Findings:** RR-3, RR-4, RR-5.

**Measure first.** On the Scene fixture: live geometries; geometries created during one resize
gesture of a primitive (expect one per preview step).

**Change.**

1. New `geometry-store.ts` in the resources folder: `GeometryKey` → shared geometry, reference
   counted. Unit geometries are created on first use.
2. New `scene-render-description.ts`: resolved Scene → frozen `RenderItem` list, memoised by Scene
   description identity.
3. New `scene-entity-representation.ts`: retained meshes for primitives and Forms, patched by item
   key, with `objectOf`. `EntityPrimitive.svelte` and `EntityForm.svelte` stop creating meshes; any
   per-entity editor affordance they carry stays in Svelte and reads `objectOf`.
4. Layout objects take their geometry from the same store.
5. Forms: one `BufferGeometry` per `formEvaluationKey` in the store; the per-entity lease in
   `form-geometry.ts` is replaced by the store's reference count.

**Touchpoints.** `apps/editor/src/lib/render/scene-entity-representation.ts`,
`apps/editor/src/lib/render/scene-render-description.ts`,
`apps/editor/src/lib/museum/entities/form-geometry.ts`,
`apps/editor/src/lib/render/layout-object-representation.ts`,
`apps/editor/src/lib/visitor/VisitorEntityGroups.svelte`,
`apps/editor/src/lib/authoring/scene/scene-pick-source.ts`,
`apps/editor/tests/lib/museum/form-geometry.test.ts`; new modules and tests.

**Tests.** Vertex-level parity of unit geometry × transform against geometry-at-size for box, plane,
cylinder and sphere, including non-uniform scale normals. P primitives of one kind hold 1 geometry.
A resize gesture creates 0 geometries. F instances of k forms hold k geometries. Picks and selection
ink unchanged.

**Acceptance.** Live geometries on the Scene fixture equal the number of distinct geometry keys.

**Rollback.** Any vertex, normal, pick or selection-ink difference.

### R5 · Models and artwork resources

**Kind:** refactor. **Tier:** 1. **Lane:** D. **Depends:** R4. **Findings:** RR-6, RR-9.

**Change.**

1. Models join the Scene entity representation. A static model instance clones the object hierarchy
   and shares geometry and store-keyed materials; a skinned or animated model keeps
   `SkeletonUtils.clone`. Arrival is an observable event of the representation (used by G4).
2. Artwork joins the representation: the unit plane is shared; frame and mat geometries are keyed by
   profile and size; materials come from the store (R2c).
3. Alpha-tested artwork shadows move to `alphaTest` on the surface material **only if** a parity
   check shows the same shadow silhouette; otherwise the custom depth materials stay and remain on
   the portability allowlist.

**Touchpoints.** `apps/editor/src/lib/museum/assets/AssetModel.svelte`,
`apps/editor/src/lib/museum/assets/model-utils.ts`,
`apps/editor/src/lib/render/models/model-realization.ts`,
`apps/editor/src/lib/museum/entities/EntityArtwork.svelte`,
`apps/editor/src/lib/render/artwork/artwork-scope.ts`; the representation from R4.

**Tests.** N instances of one static model: geometries shared, materials m. A artworks of s sizes:
1 + 3·s geometries. Model arrival fires once. Artwork fidelity checks from the T2 A1 slice stay
green.

**Rollback.** Any model pose, material remap or artwork appearance difference.

### R6 · Lights through the resolved look

**Kind:** invariant (T2 direction). **Tier:** 1. **Lane:** D. **Depends:** R2c and
[decision D4](./README.md#owner-decisions). **Findings:** RR-10, AR-11.

**Change.** Light descriptors (kind, colour, intensity in the T2.S0 units, shadow settings) are
produced by the resolved look; one `light-store` realises them. `EntityLight.svelte` and the Sun in
`WorldEnvironment.svelte` stop constructing lights. The slice is written against Point and Spot
plus the Sky's Sun; it does not carry Directional forward.

**Touchpoints.** `apps/editor/src/lib/museum/entities/EntityLight.svelte`,
`apps/editor/src/lib/render/WorldEnvironment.svelte`; the resolved-look and store modules.

**Tests.** Parity of light properties and shadow camera settings; the S3 Lights suites unchanged.

**Rollback.** Any lighting difference.

### R7 · Instancing and static batching

**Kind:** gated — expected to be abandoned unless the data asks for it. **Tier:** 1. **Lane:** D.
**Depends:** R3, R4, R5, I1.

**Hypothesis.** After rest frames are gone, the L pan and orbit frame is bound by draw-call count
(audit 6.1, assumption A1).
**Measure first.** One trace of an L pan and of the Scene fixture orbit: main-thread render time,
draws, and whether halving draws (by hiding half the walls) halves render time. If render time does
not track draws, abandon: the frame is fill- or shadow-bound and batching will not help.

**Change, each part applied independently and only if its own measurement shows ≥ 25 % lower render
time at L with no regression at M:**

1. `InstancedMesh` for Scene items sharing (`GeometryKey`, `MaterialKey`, shadow flags) at or above
   a threshold of 8. `objectOf` returns the instance; picking maps `instanceId` to the entity id.
2. One static batch for Room floors and one for ceilings.
3. `BatchedMesh` for Walls, keeping per-Wall update through reserved ranges. Applied last and only
   if 1 and 2 leave the frame draw-bound, because it trades away the simple O(changed) patch.

**Touchpoints.** the representations from R3–R5 only; no consumer changes.

**Tests.** Parity of world vertices; picks and selection through `objectOf`; an edit to one batched
item touches one range.

**Rollback.** Per part. Any pick, selection or patch-path regression; or a re-measurement below the
threshold.

### R8 · Placement and names

**Kind:** mechanical. **Tier:** 1. **Lane:** D, last. **Depends:** all R slices. **Findings:** AR-8.

Move what remains of `lib/museum` to `lib/render` (world content) and rename
`MUSEUM_SCENE_VALIDATION_OPTIONS`; no behaviour change, no file content change beyond imports.
Run as a bulk rename with the docs path map updated in the same pull request. Skipped without loss
if the milestone is cut short.

## 7. Not scheduled

| Finding | Why |
| --- | --- |
| AR-7 visitor free look | owner decision D2 |
| AR-9 unfold session placement | no leak; arch lane already guards it |
| AR-10 outline union in Stage code | low severity; recorded so it is not copied |
| AR-11 Directional retirement | product slice of its own; ordering in decision D4 |
| Preview render mode (RR-11) | counted in I1; decided once the number exists |
| Picking acceleration | no evidence of a cost; picks measured at 2.7–6.6 ms |
