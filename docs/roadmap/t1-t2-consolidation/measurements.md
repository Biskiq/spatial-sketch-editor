# E0/C0 — instrumentation baseline

**Date:** 2026-11-13. **Branch:** `e0-instrumentation-characterization` (from `main` `b1a233ec`).
**Scope:** C0's baseline for the T1/T2 consolidation milestone. Every value below is either a direct
`countWork`/plan-stat output at a production call site (**counted**), or **unmeasured**. Nothing in
this table is inferred from code, an audit estimate or a frame cadence.

## How the counts were taken

The synthetic harness used the same production entry points the Stage uses, driven by a one-off
`vite-node` script (not committed) against a clean production build:

- **M / L:** the certified `grid-M` / `grid-L` workloads, opened through source admission, read in
  Plan, candidate preview ticked once, then one accepted Wall edit and one accepted Camera edit.
- **Scene:** the `counting-scene` fixture (`tests/lib/authoring/__fixtures__/counting-scene.ts`),
  prepared once. Its material and texture rows are a **synthetic sweep** of the production
  resolver/acquire functions over the fixture's renderable list; they are not a mounted Scene
  consumer measurement. Mounted per-entity material and texture work is **unmeasured**.

Counts are read through `installPerfWorkObserver`'s `__BISKIQ_PERF_WORK__.counts` and the
`paper:plan` representation stats. The mounted call-site tests in
`tests/lib/authoring/stage-counting.test.ts` assert the same names through the real callers.

## Fixture content

| Fixture | Walls | Rooms | Openings | Scene entities | Distinct looks | Textured primitives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `grid-M` | 112 | 49 | 112 | 0 | — | 0 |
| `grid-L` | 420 | 196 | 420 | 0 | — | 0 |
| `counting-scene` | 112 | 49 | 112 | 277 | 3 | 49 |

`counting-scene` is `grid-M` plus, per Room, three primitives (two sharing a look), one Form and one
textured primitive; plus 20 artworks of four sizes and 12 instances of one model. Distribution:
196 primitives, 49 Forms, 20 artworks, 12 models.

## Baseline

| Measurement | M | L | Scene | Class |
| --- | --- | --- | --- | --- |
| Frames at rest per second (`render:stage-frame`) | unmeasured | unmeasured | unmeasured | **unmeasured** |
| Compiles per preview tick | 1 compile: `compile:walls` 112, 112 openings, 49 rooms | 1 compile: `compile:walls` 420, 420 openings, 196 rooms | 1 compile: `compile:walls` 112 | counted |
| Candidate build per preview tick | `candidate:paper-build` 1, `paper:plan-build` 1 | `candidate:paper-build` 1, `paper:plan-build` 1 | not applicable (no live candidate) | counted |
| `scene:resolve` per accepted Wall edit | 1 | 1 | 1 | counted |
| `scene:resolve` per accepted Camera edit | 1 | 1 | 1 | counted |
| Paper segments after one accepted build | 3,612 | 13,692 (preparation) | 3,612 (layout) | counted |
| `paper:plan-build` / `paper:scene-build` per drawing revision | 1 / 1 | 1 / 1 | 1 / 1 | counted (mounted revision change) |
| `material:resolve` per full Scene material resolution (synthetic sweep) | 0 (no Scene entities) | 0 (no Scene entities) | 277 | counted, synthetic |
| `material:resolve` per mounted Scene render | unmeasured | unmeasured | unmeasured | **unmeasured** |
| `material:resolve` per accepted edit | unmeasured | unmeasured | unmeasured | **unmeasured** |
| `texture:variant-acquire` in the synthetic sweep | 0 | 0 | 554 calls, 4 distinct variants | counted, synthetic |
| `texture:variant-dispose` in the synthetic sweep | 0 | 0 | 4 | counted, synthetic |
| `texture:variant-acquire` / `dispose` per mounted Scene | unmeasured | unmeasured | unmeasured | **unmeasured** |
| `texture:variant-*` per accepted edit | unmeasured | unmeasured | unmeasured | **unmeasured** |
| `render:shadow-update` per accept / per second at rest | unmeasured | unmeasured | unmeasured | **unmeasured** |
| Live geometries / materials / textures | unmeasured | unmeasured | unmeasured | **unmeasured** |
| Draws per frame | unmeasured | unmeasured | unmeasured | **unmeasured** |

Notes:

- `candidate:paper-build` and `paper:plan-build` both increment for one candidate tick because the
  candidate builder calls the shared Plan builder; they are nested, not two independent builds.
- The mounted Stage test observes one `render:shadow-update` per shadow invalidation followed by a
  shadow-casting render. That is a controller-level count, not an accepted-edit or at-rest
  measurement, so the baseline row stays unmeasured.
- `render:stage-frame` counts Stage surfaces only. A Preview surface is counted separately as
  `render:preview-frame` (the one documented extra name) and is never reported as a Stage frame.
- The synthetic material/texture sweep calls the production functions once per fixture entity; a
  mounted Scene may acquire, reuse or release different numbers. No mounted value is inferred from
  the sweep. The fixture Opening inventory is asserted against `addOpenings` (112 of 112 eligible
  Walls), so the content table cannot drift silently.

## Browser evidence gap

The local production build succeeded (`npm run build`, 16.4 s) and answered on
`http://127.0.0.1:4173/` (HTTP 200). The D1-authorised `npm run perf:spot` did not produce a
measurable session in this environment:

- The first invocation failed before any session on a relative `page.goto`, a defect in the #273
  repair inside the spot runner; the absolute navigation is restored in `perf/spot.ts`.
- The bundled-Chromium invocation wrote a report with both tiers `incomplete` and zero sessions
  (load average 5.5 on an 8-core M2): M timed out after 300 s in `page.waitForFunction` during the
  post-upload Stage flow, and L's page was closed when the run was stopped. Report:
  `2026-11-13T21-14-20-592Z-spot.json` under the temporary `biskiq-spot` directory.
- Repeated headless launches (branded Chrome and bundled Chromium) hung in the same Stage flow with
  no report; the host also caps a synchronous command at 295 s. Further runs were stopped rather
  than retried, per D1's no-automatic-retry rule and the wall-clock cap.

Consequently the browser-only rows above are **unmeasured**: frames at rest, live
geometries/materials/textures, draws per frame, per-accept material/texture/shadow counts, and the
wall-clock spot baseline. They are not inferred from rAF cadence or from the audit. The deterministic
counts remain valid and are the acceptance lines E1/E4 consume.

## E5/G3 — Paper retention by responsibility

**Date:** 2026-11-13. **Branch:** `claude/e5-paper-retention` (from `main` `bc9d2662`, PR #318
merged). **Scope:** G3 step 1. Every value below is a `countWork` output at a production Paper call
site (**counted**), through the mounted `StagePaper` caller (grid-M) or through `buildPaperPlan` →
`createPaperScene` directly (grid-M and grid-L). No wall-clock share is inferred.

### Fixture content

| Fixture | Walls | Openings | Paper lines | Paper segments | Paper fills |
| --- | ---: | ---: | ---: | ---: | ---: |
| grid-M (`grid-7`) | 112 | 112 | 924 | 3,612 | 273 |
| grid-L (`grid-14`) | 420 | 420 | 3,220 | 13,692 | 1,036 |

### Counts per interaction

Both columns are increments for the interaction, measured after mount. The “before” column is the
pre-E5 caller at `main`, where `paperDrawingForSelection` produced a filtered drawing object for a
selected Opening; the “after” column is this change, which builds from the unfiltered drawing and
hides that source's instance runs.

| Interaction | Before: plan / scene | After: plan / scene | Class |
| --- | ---: | ---: | --- |
| Select an Opening | 0 / 1 | 0 / 0 | counted, mounted M |
| Deselect | 0 / 1 | 0 / 0 | counted, mounted M |
| Hover a subject | 0 / 0 | 0 / 0 | counted, mounted M |
| Pan (Camera move) | 0 / 0 | 0 / 0 | counted, mounted M: the Plan identity is retained |
| Zoom (viewport resolution) | 0 / 0 | 0 / 0 | counted, mounted M |
| Accept one Wall move (new Plan identity) | 1 / 1 | 1 / 1 | counted, mounted M |
| Initial mount | 1 / 1 | 1 / 1 | counted, mounted M |

At grid-L the same production builders give one `paper:plan-build` and one `paper:scene-build` per
drawing revision, and a selection hide/show adds neither: the L trace ran the mount build, a
`setHiddenSource(opening)` / `setHiddenSource(null)` pair, and one accepted-Plan rebuild, for
`paper:plan-build` = 2 and `paper:scene-build` = 2 over the whole sequence. M and L therefore have
the same interaction counts; only their content sizes differ.

### G3 step 2 — deferred, unmeasured

G3 step 2 (incremental Room/Wall Paper entries) is **deferred**: its gate is a trace showing Paper
is a material share of the post-commit cost for an accepted L edit, and that trace is **unmeasured**
here. The browser evidence gap above still holds (the D1-authorised spot flow did not produce a
session in this environment, and further headless launches were stopped rather than retried). The
count probe cannot attribute cost — its L run spends most of its wall clock outside Paper — so
Paper's share is neither measured nor declined; no conclusion is drawn either way. No incremental
cache, new cache key or second geometry path was added; the step-1 drawing remains the fallback and
the step-2 gate stays open for a later measured trace.

## E6/R2a + R3 — Layout resources and retained Rooms

**Date:** 2026-11-14. **Branch:** `e6-layout-resources-retained-rooms` (from `main` `ea4e236c`,
E1/E2/E3/E4/E5 landed). **Scope:** R2a's material/texture stores and Layout surfaces, and R3's
retained Room representation — not R2b's Scene materials, not deferred texture release, not
floor/ceiling batching (E11). Every value below is either a **counted** number with its source or
**unmeasured**. No wall-clock claim is made.

### Gate A prerequisite (D4)

`88be0561` (`T2.S0: Gate A accepted — pipeline, artwork fidelity, and light units`, PR #291) is an
ancestor of this branch's base, so the accepted pipeline record
([`pipeline.md`](../t2-look-atmosphere/s0-rendering-gate/pipeline.md)) is landed, not a draft. The
store encodes it and re-decides none of it: it sets no tone mapping, exposure or output colour
space, and `toneMapped` is only the per-material opt-out the record already permits. **Not** covered
by this slice: the record's Stage-snapshot sRGB warning, which the snapshot path owns and this
packet did not touch.

### R3 baseline, counted before the change

One bounded probe (not committed) compiled `grid-7` (M) and `grid-14` (L) through the production
compiler and then ran, per compiled Room, the **exact Three calls the `VisitorLayoutShell` template
made**: two `Shape` objects, then three `ShapeGeometry` constructions (floor, floor-shadow from the
same `Shape`, ceiling). The wall-clock trace was not run (see below), so nothing here is a duration.

| Tier | Rooms | Floor+ceiling triangle vertices | `Shape` objects | Triangulations | Geometries | Material components |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| M | 49 | 392 | 98 | **147** | 147 | 147 |
| L | 196 | 1,568 | 392 | **588** | 588 | 588 |

/ `ShapeGeometry` vertices, not triangles: four per quad at these polygons. The table reproduces
audit 6.5's A4 counts exactly (M 147 / L 588 triangulations and materials), which is the cross-check
that the probe measures the path the shell shipped.

Component mounts are **derived from the template**, not mounted: 1 `T.Group` + 3 `T.Mesh` +
3 `T.ShapeGeometry` + 3 `T.*Material` = 10 per Room (≈490 at M, ≈1,960 at L; audit 6.5's "≈10").

### After the change, counted

The same compiler output through `createRoomRepresentation`: one `ShapeGeometry` per Room surface,
the floor's shared by the floor and the floor-shadow mesh.

| Tier | Rooms | Triangulations | Shared geometries | Materials (all Rooms) | Room components |
| --- | ---: | ---: | ---: | ---: | ---: |
| M | 49 | **98** | 98 | **3** | 0 |
| L | 196 | **392** | 392 | **3** | 0 |

Total vertices are identical before and after (M 392, L 1,568) and the parity test compares every
Room's floor, floor-shadow and ceiling **world** vertices against the component path, so the saving
is a removed duplicate triangulation and a shared material, never a different surface.

Material identity is counted through the store, not inferred: 196 Rooms acquire `created = 3`,
`live = 3`, and a compile takes no new acquisition; a second representation of the same look shares
the instance. Those assertions live in `tests/lib/render/resources/material-store.test.ts`,
`tests/lib/render/layout-room-representation.test.ts` and `tests/lib/render/default-wall-material.test.ts`.

### H-R3 — the open-time hypothesis failed to be measured

R3's hypothesis is that per-Room Svelte mounting is the largest remaining term in the L open render
gap, and its "measure first" step is **one trace of the L open** split into shell mount,
representation updates, Paper build, pick index, first shadow and first frame. That trace is
**unmeasured**: this environment has the browser evidence gap recorded for E0 above (headless
launches hang in the Stage flow; a synchronous command is capped at 295 s), and D1 permits one named
trace, not retries. Per R3's own rule the slice still proceeds as an ownership refactor, and this
record states the failed hypothesis:

- The ownership result **is** proved: 588 → 392 triangulations, 588 → 3 materials, ≈1,960 → 0 Room
  components at L, with identical world vertices.
- Whether Room mounting was the largest term in the open gap is **not proved**, and no term is
  claimed dominant. The dominant term stays a flag for a measured trace.
- R3's gated batching step was **not attempted**: it requires a measured L pan frame that is
  draw-bound, and no draw measurement exists. It stays with E11.

### Unmeasured

Frames at rest, live `renderer.info` geometries/materials/textures, draws per frame, the L-open trace
split, and the post-change open-gap re-recording. The Room component counts are derived from the
template's inventory, not read from a running Canvas.

## E8/R5 + R2c + G4 — model realization, model remaps and caster lifecycle

**Date:** 2026-11-14. **Branch:** `claude/e8-models-remaps-casters` (from `main` `f41c4e26`, E7 #327).
**Scope:** model instances, model remaps through the Canvas `MaterialStore`, and the caster channel
that replaces the per-frame model trigger. Not E9 (artwork, environment) and not E10 (lights). Every
value is a **counted** number from the test named beside it; no wall-clock claim is made.

### G4 — `render:shadow-update` counts, identical fixture

Method: the real `StageShadowTriggers` mounted with the counting Canvas boundary. The test emulates
three's frame contract (`render` runs every frame and clears `needsUpdate` after a pass). One warm-up
frame is excluded, then 50 frames are counted. The "before" column is the same harness on `main`.

| Scenario | Before (`main`) | After (this PR) |
| --- | ---: | ---: |
| Static Scene at rest, no model | 0 | 0 |
| Static Scene at rest, model + casting light | 50 (per frame) | **0** |
| Camera-only edit, model + casting light | 50 (per frame) | **0** |
| Model arrival | not observed: 50 (per frame) | **1** |
| Model release | not observed: 50 (per frame) | **1** |
| Caster edit (new Scene identity), no model | 1 | **1** |
| Caster edit (new Scene identity), model + casting light | 50 (per frame) | **1** |
| Animation playing | 50 (per frame, for any model) | 50 (per frame, only while playing) |
| Animation stops | — | **1**, then 0 |

Test: `tests/lib/render/shadow-g4-counts.test.ts`. The Stage counting suite
(`tests/lib/authoring/stage-counting.test.ts`) still passes with the new wiring.

### R2c — materials for 8 instances of a 3-mesh model

Method: the removed `cloneModelScene` and `remapModelMaterials` were reproduced verbatim in a
temporary probe (not committed) and counted as distinct material objects across the 8 instances.
The "after" column is the same count through `realizeModel` and the store.

| Case | Before (per-instance clone/remap) | After (store) | `MaterialStore.created` after |
| --- | ---: | ---: | ---: |
| Unstyled (asset's own materials) | 24 (8 × 3) | **3** (one store copy per mesh) | 3 |
| Remapped, m = 2 looks | 24 (8 × 3) | **6** (2 looks × 3 meshes) | 6 |

Behavioral parity tests: `tests/lib/render/models/model-realization.test.ts` (16 tests): static and
skinned clone parity, skeleton independence, animation on one instance leaving the others and the
template at rest, shared surfaces by identity and refcount, scoped teardown, texture-variant lease
accounting and the stale-arrival gate.

### Ownership evidence

- World-material constructors: `MaterialStore` is unchanged at 3 sites. `AssetModel.svelte` keeps one
  Threlte bounds helper (`showBounds`), recorded in the editor-ink allowlist. The E8 entries for
  `AssetModel.svelte` and `instance-material-remap.ts` are removed from the R2 allowlist.
- Retired: `instance-material-remap.ts`, `cloneModelScene`, `disposeModelInstance`,
  `setModelWireframe`, `remapModelMaterials`. Their tests now call the realization.
- Disposal: an instance releases only its own leases. A test asserts that the template's materials
  are never disposed, and that releasing one of two instances never disposes the survivor's material.
- Guard: `tests/lib/render/model-lifecycle-boundary.test.ts` (in the arch lane) fails on a second
  constructor, a per-instance `.dispose()` or `.clone()`, identity by name, a second publisher of
  caster events, or a return of the per-frame model rule.

### Limitations

- **No animation playback exists in the product.** `src/` contains no `AnimationMixer`, and the
  import pipeline records animations as observed-not-admitted. The playing path is proven with a test
  mixer on cloned skeletons and the channel. Product animated shadows are unchanged because no
  product action exists yet.
- **E7 representation gap (owner exception, tracked).** E7's representation owns Three objects only,
  and a model's fallback is the Svelte `AssetFallback` tree, so the representation cannot draw a model
  yet. The exception is recorded in `execution-schedule.md` (E8 section) with its exact files and the
  remaining work that must land before E12: port the approved fallback shapes to the E7 representation
  and retire the `AssetModel.svelte` host. No fallback renderer was added.
- **Unscoped arrival is immediate and untextured.** The unscoped path mounts the untextured look at
  arrival and applies the look's textures asynchronously, restoring the pre-E8 behavior. A texture
  completion for a superseded look is rejected. Scoped loads still wait for their textures before mounting.
- **Browser QA not run.** The E0 note records that headless Stage launches hang in this environment,
  so the Stage and `/dev/assets` renders are unverified here. The owner's manual acceptance applies.
- **Re-measure G4 after E9** adds artwork casters; artwork arrivals will need the same channel.
- **Heavy lane not run locally**, per the shared heavy-test slot rule. The fast-lane results above
  predate the correction below; the correction ran the focused suites and the arch lane. The full
  suite is left to CI.

### Correction after review (same PR, G4 counts unchanged)

- **Race:** `AssetModel.svelte` captures a look generation per presentation. A texture completion for a
  superseded look applies nothing, and an unmount while textures are pending mounts nothing.
  Tests: `tests/lib/museum/assets/asset-model-lifecycle.test.ts` (6 tests, mounted Threlte tree).
- **Wireframe parity:** an explicit `false` overrides an imported source that draws wireframe. The
  source is never mutated. Test: `tests/lib/render/models/model-wireframe-parity.test.ts` (2 tests),
  false → true → false with the template still wireframe.
- **Ownership:** `<T is={instance} dispose={false} />`. Threlte 8.5.16 does not dispose a plain Group
  root, so this makes the external ownership explicit rather than changing observed behavior. The
  mounted two-consumer teardown test passes with or without the prop; the arch guard pins the prop.
- **Caster release:** `CasterChannel` removes an entity from the playing set on `released`. Test:
  `tests/lib/render/shadow-g4-counts.test.ts`, releasing the final playing model ends the per-frame
  rule without a stop event (7 tests in the file, G4 table above unchanged).

### Rollback

- G4 alone: restore the `needsPerFrameShadows` rule in `StageShadowTriggers.svelte` and
  `shadow-invalidation.ts`. The channel stays harmless: nothing else listens.
- R5/R2c: revert `AssetModel.svelte` and `model-realization.ts` together with the deleted
  `instance-material-remap.ts`. The store's `imported` kind is additive and can stay.

## E9/R5 + R2c — Artwork and the remaining world materials

**Date:** 2026-11-14. **Branch:** `claude/e9-artwork-world-materials` (from `main` `d67d1172`).
**Scope:** Artwork realization through a retained Scene handler, keyed Artwork geometry, and the
Artwork, World-ground, paper-ground and plinth materials through the Canvas `MaterialStore`. Not E10
(lights) and not E8's model exception. Every value is a **counted** number; no wall-clock claim.

### Identical-fixture counts and parity

Method: the removed `EntityArtwork.svelte` was restored from `main` into a temporary probe (not
committed) and mounted under a real Threlte `<T>` tree. The same entities were realized through
`createSceneArtworkRepresentation` with the stores. Counts are distinct geometry and material objects
in the drawn tree; custom depth and distance materials count as materials. Parity compares every
mesh's world matrix, float32 vertex positions, index count, material type, colour, map presence,
`transparent`, `opacity`, `depthWrite`, `alphaTest`, `side`, `toneMapped`, `castShadow`,
`receiveShadow`, and the custom depth/distance type, `alphaTest`, packing and map.

| Fixture | Meshes before/after | Geometries before → after | Materials before → after | Differing meshes |
| --- | ---: | ---: | ---: | ---: |
| 20 framed (gallery + Mat), 4 sizes | 80 / 80 | 80 → **13** (1 + 3·4) | 80 → **3** | 0 |
| 20 thin black (no Mat), 4 sizes | 60 / 60 | 60 → **9** (1 + 2·4) | 60 → **3** | 0 |
| 20 unframed, 4 sizes | 20 / 20 | 20 → **1** | 20 → **1** | 0 |
| 2 transparent framed, 1 size | 8 / 8 | 8 → **4** | 12 → **5** | 0 |
| Ghost, transparent framed | 4 / 4 | 4 → 4 | 4 → 3 | 0 |
| Ghost, thin | 3 / 3 | 3 → 3 | 3 → 3 | 0 |

The gallery Mat and gallery backing are both the Mat colour, so they share one Lambert lease. The
frame colour is not part of a buffer key, so two frame colours of one size share the ring.

Committed tests: `tests/lib/render/scene-artwork-representation.test.ts` (20 tests) pins the same
counts against the baseline inventory restated from the component's template, plus fidelity, the
alpha exception, ghost, arrivals, stale and drawn-source replacement, scope swap, failure, disposal
and retained edits (move, resize, remove). `tests/lib/render/artwork-world-mounted.test.ts` (5 tests)
mounts the real `VisitorEntityGroups`, `WorldEnvironment` and `GroundPlinth`: draw on arrival,
invalidate and notify, one shared image material, a scope swap without a new Scene, a cold visitor
with no scope, the ground swap by key, and zero material, geometry and image leases after unmount.

### Retained alpha exception (R5)

Silhouette parity was **not** taken as proof for removal. Moving `alphaTest: 0.5` onto the surface
gives the same shadow, but it also discards texels below 0.5 in the colour pass, which the blended
surface draws today. The colour image would differ, so the custom depth and distance materials stay.
They are now store leases keyed by texture identity, shared across Artworks of one image (2
transparent Artworks: 4 → 2 shadow materials). The portability allowlist entry moved from
`museum/entities/EntityArtwork.svelte` to `render/scene-artwork-representation.ts` with the same two
tokens.

### Ownership evidence

- `material-factory-boundary`: the `MaterialStore` constructs at 6 sites (Lambert, depth, distance
  added). The R2 allowlist drops `EntityArtwork.svelte`, `GroundPlinth.svelte`,
  `WorldEnvironment.svelte` and `VisitorPreviewSurface.svelte`. Only `EntityLight.svelte` (E10) is
  left. A new test asserts the handler, `StoreMaterial.svelte` and the grounds acquire and never construct.
- `render-layer-boundary`: the handler is a representation (no project-model, authoring or visitor
  edge). The one representation → representation edge is the Scene root owning its Artwork handler.
- Picking is unchanged: Artwork was never pick-registered, and the handler registers nothing.
- Shadows: the arrival path is unchanged (`onFormRendererReady`), and Artwork publishes no caster
  event. `tests/lib/render/shadow-g4-counts.test.ts` passes unchanged.
- `WorldEnvironment` lights are untouched (E10).

### Limitations

- **Browser QA:** see the PR for the focused Stage/Preview spot check. The owner's manual acceptance
  applies.
- **Heavy lane not run locally**, per the shared heavy-test slot rule with X4 (PR #338). CI runs it.

### Correction after review (same PR, counts unchanged)

- **Invalidate on re-source:** a drawn Artwork whose source or scope is replaced leaves the frame
  imperatively. The handler reports it as `detached`, and `VisitorEntityGroups` and
  `StageArtworkGhost` invalidate on it, as the component's unmount did. Without it an on-demand
  Canvas could keep the old picture until the next frame. Tests: the scope-swap cases in both suites.

### Rollback

- Artwork: revert `scene-artwork-representation.ts`, `artwork-geometry.ts`, the artwork specs in
  `scene-render-item.ts` and `geometry-store.ts`, the description and dispatch edits, and
  `StageArtworkGhost.svelte` together, and restore `EntityArtwork.svelte` with its allowlist entries.
- The store's `lambert`, `depth` and `distance` kinds and `StoreMaterial.svelte` are additive and can
  stay. The environment and plinth acquisition stays even if Artwork reverts.
