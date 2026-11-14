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
- **Conflict with the E7 representation interface (reported, not worked around).** E7's
  representation owns Three objects only. A model's fallback is the Svelte `AssetFallback` tree
  (about fifteen shapes with Svelte materials), so a model cannot be drawn by the representation
  without porting that tree. This PR keeps `AssetModel.svelte` as the per-entity host and moves every
  drawn-instance concern (clone, leases, arrival, release) into `model-realization.ts`, using the same
  store, geometry-free identity and caster contracts. A later packet can port the fallback and then
  move the host.
- **Behavior change on the unscoped path:** a textured look now waits for its texture load before the
  first mount, as the scoped path already did. A failed load mounts the untextured look, as before.
- **Browser QA not run.** The E0 note records that headless Stage launches hang in this environment,
  so the Stage and `/dev/assets` renders are unverified here. The owner's manual acceptance applies.
- **Re-measure G4 after E9** adds artwork casters; artwork arrivals will need the same channel.
- **Heavy lane not run locally**, per the shared heavy-test slot rule. Fast and arch lanes were run;
  the full suite is left to CI.

### Rollback

- G4 alone: restore the `needsPerFrameShadows` rule in `StageShadowTriggers.svelte` and
  `shadow-invalidation.ts`. The channel stays harmless: nothing else listens.
- R5/R2c: revert `AssetModel.svelte` and `model-realization.ts` together with the deleted
  `instance-material-remap.ts`. The store's `imported` kind is additive and can stay.
