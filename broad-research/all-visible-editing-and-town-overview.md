# All-visible architectural editing and town overview

Research handoff, 2026-10-24, for [T1.P02.S06][s06]. **Research and optional measurement
advice, not a rendering decision or expanded implementation scope.** Code observations below
use `origin/main` at `2215af341a650ac3a99a0fbb36e48de7e901411e`. The active setup checkout was
not inspected. No renderer, fixture or harness was changed; no performance experiment was run.

**Recommendation:** retain S06's interior/irrelevance methodology and, only if setup already
supports it, let the owner attach two report-only L viewpoint records: Plan overview and exposed
3D overview. All-visible frames are an important coverage gap: visibility cannot eliminate
architecture that the author deliberately exposes. Town infrastructure needs a separate owner
proposal after S06, not a larger S06 workload.

## Evidence and limits

Labels separate **[B]** Biskiq code/contract facts, **[M]** previously measured Biskiq evidence,
**[X]** external implementation facts, **[A]** arithmetic and **[H]** untested hypotheses. An
external implementation demonstrates a technique, not its performance in Biskiq. Root licenses
were inspected at the linked revisions; dependencies, bundle cost and compatibility were not
qualified for adoption.

The [performance contract][perf] owns workloads, statistics and budgets. The
[cinematic strategy][strategy] is research: its interior visible-fraction and throughput estimates
remain hypotheses. S06 owns E1–E5, H1–H9, I1–I6 and the three owner-run passes. Nothing here
changes those identifiers, definitions, required evidence, benchmark order or acceptance rows.

| Biskiq evidence | What it establishes | What it does not establish |
| --- | --- | --- |
| [B] Contract L, grid-14 | Approximately 420 Walls, 420 Openings and 196 Rooms per project | Which Rooms or surfaces appear in any measured frame |
| [M] [H0 pre-flight record][h0] | Grid-7 compile median 23.00 ms; compile plus Stage admission 53.35 ms; F3 measured at S only | L Plan, exposed L 3D, town performance or a measured M drag budget miss |
| [B] [StageCanvas][stage-canvas], [StageCamera][stage-camera], [architecture contract][architecture] | One Canvas, scene and Camera evaluation for Plan and 3D; Plan is an orthographic endpoint | A dedicated Plan-cut renderer: the Stage still draws canonical 3D geometry in both readings |
| [B] [Plan evaluator][plan-eval], [parameters][plan-params], [Stage facade][facade] | Cut/projected/hidden/symbol fragments and source correspondence; default lateral span unbounded; eligibility and Reveal | Draw culling by Plan membership; a cached spatial hit index |
| [B] [VisitorLayoutShell][layout-shell], [buffer adapter][buffer-adapter] | Meshes per physical Wall and Room floor/ceiling; material groups per Wall; whole-Wall-array rebuild/disposal on geometry changes | Mesh count equals GPU submissions, or retained chunks have landed; H4 is planned work |
| [B] [StageOverlay][overlay], [route refresh][route], [instrument grammar][grammar] | SVG circles and title metadata for contributed markers and selection; route projects contributions each refresh; grammar prioritizes active relationships over secondary labels | 196 persistent text labels or a measured label-layout bottleneck; title metadata is not a painted label |
| [B] [Model cloning][model-clone] | Placements share source geometry but clone materials for mutable placement state | Instanced submission or freely shareable placement materials |
| [B] [Shipped orbit flow][orbit], [fixtures][fixtures], [harness method][harness] | M-only orbit; S/M fixture API; rAF intervals and ledger correlation with stated limitations | L fixtures and Stage draw/GPU probes already shipped: S06 setup must supply its approved additions |

**Picking correction to H6's shorthand.** [B] `resolveSourceHit` in the [facade][facade] first
asks domain hit providers, then calls `planFor`, sorts eligible Layout fragments, projects their
pick surfaces and scans them with an 8 CSS-pixel tolerance. The route's Plan cache does not cache
that fallback query. It is not simply a triangle raycast. A mesh BVH would not accelerate this
path automatically, and no BVH guarantees logarithmic worst-case picking. Preserve domain order,
eligibility, deterministic identity, generation checks and CSS tolerance in any future index.

**Repeated lookups.** [B] The [Layout shell][layout-shell] calls `adaptedWalls.find` inside its
per-Wall template; the [facade][facade] calls `geometry.walls.find` for each tested Wall fragment.
**[A]** Repeating those linear lookups across all Walls can produce quadratic lookup work on an
update or a worst-case miss, independent of triangle count. **[H]** Attribute these separately
from geometry building and narrow-phase picking before choosing a rendering/index architecture.
No timing or new S06 optimization obligation is claimed.

## Coverage-gap matrix

“All-visible” needs evidence of exposure, not just loading or frustum inclusion. A Room footprint
can be in-frame while its floor is hidden by a Wall, ceiling, fog or another surface. Record these
separately; do not label a partly exposed view as a successful cutaway test.

| Question | Existing S06 coverage | Remaining gap | Smallest disposition |
| --- | --- | --- | --- |
| L Plan with all 196 Room footprints in-frame | L F2/F3/F4/F8 and representation attribution; E1 measures edit dependencies | No named fitted Plan pose or proof of displayed coverage; current Plan still carries 3D rendering costs | Optional Plan record on existing L, as rendered; document exposure limits |
| Overlay/label density and Plan picking | Stage traces; existing overlay mark includes marker count; H6 probe conditional on a trace hotspot | No dense-label workload or dedicated picking/label timings; Layout fallback scans projected fragments | Read available trace/marker evidence; missing attribution stays unmeasured; no new labels or timers |
| Overview zoom/pan and local Wall edits | F3/F4/F8 local work, I1 counts, H4 retained entities | A local edit can have small k while the next frame presents nearly all N | Keep overview framing during existing edit windows; use available navigation trace segments |
| Hundreds of exposed Rooms in 3D | F7 at L and planned render/shadow counters; H6 characterizes submissions; H9 removes identical shadow updates | An interior View and generic orbit need not expose all Rooms; no dedicated cutaway feature | Optional high-oblique full-footprint record; unsupported exposure remains a gap |
| Hidden vs visible scaling | E2 portal census; E5 H and D with exact fixed-view controls | H is deliberately visually non-influential; D is a distant portal sightline, neither is a whole-building overview | Add viewpoint metadata only; never replace E5 or reclassify visible additions as irrelevant |
| Repeated assets and residency | E3 sharing and E4 visible-plus-next-Stop textures; realistic-L render counters | Town has broad exterior visibility, many buildings and outdoor spaces; interior residency assumptions may fail | Interpret existing evidence as bounds; future town proposal |
| HLOD, outdoor partitions and streaming | Strategy M2–M5 and S06 F owner proposals | No town fixture, error policy, cancellation/eviction policy or edit-to-HLOD invalidation proof | Defer implementation, new workloads and acceptance methodology |

## L Plan overview

**[H] Representation and density are separate costs.** A fitted Plan could eventually draw
Layout's existing fragments as retained, material/stream-grouped lines and fills, leaving exact
semantic queries with the canonical compiler. That could avoid lit Walls, Room surfaces and
shadow submissions for this reading. It is a future consumer of existing output, not a second
architectural compiler. Portals cannot hide the 196 footprints the author wants to inspect.

Competing presentation paths:

| Approach | Useful property | Limitation and engineering implication |
| --- | --- | --- |
| Current shared 3D geometry | Same geometry and lifecycle across readings; no new rendering path | Plan pays for geometry/materials it may not need; first attribute this cost |
| SVG paths plus active controls | Inspectable geometry and straightforward DOM interaction | Many paths/text nodes can increase layout/paint and update work; 196 Rooms alone does not prove that threshold |
| Retained WebGL lines/fills plus a sparse SVG/text overlay | Batch architecture while keeping selected controls accessible and readable | Needs stable source-to-range mapping, line-width/antialiasing policy and separate exact hit queries |
| Canvas 2D retained drawing/cache | Simple fills and strokes without per-feature DOM | Redraw, text, accessibility, hit mapping and high-DPR costs still need ownership; caching the whole image makes local edits expensive |

**[X] Density precedent.** [MapLibre's collision index][maplibre-collision] places screen-space
boxes/circles against a grid and pads the viewport to reduce visible placement changes; the
padding costs extra work. **[H]** Borrow collision/priority/hysteresis ideas for passive annotations,
not the map engine or its geography model. Keep selected identity, active grip/value and refusal
readable per the [instrument grammar][grammar]. Full architectural visibility does not require
every annotation to be painted. Do not shift authored positions or make an omitted label remove
the entity's exact hit eligibility. Stable anchors matter during zoom as much as label count.

**[X] Picking alternatives.** [RBush][rbush] supports insertion/removal and rectangle queries;
[Flatbush][flatbush] packs a static index into a transferable buffer, but cannot add/remove after
construction. **[H]** A retained dynamic index over compiled Plan bounds suits frequent Wall edits;
a static index plus a small edited overlay may suit mostly stable geometry, at the cost of
rebuild/merge work and extra memory. Neither supplies Biskiq's exact hit verdict: query a
conservative box, then apply the existing narrow phase and priority. At low zoom, CSS tolerance
covers a larger world area and the candidate set can grow. Rebuilding either index on every
pointer event would defeat locality. A screen-space index also needs updating when Camera moves;
world-space indexing avoids that rebuild but needs conservative projected queries in 3D.

**Zoom and edits.** [B] The [route][route] recalculates its Plan view when compile generation,
target XZ or Reveal changes, and calls adapter overlays on refresh. **[H]** Pan may therefore
trigger representation work even with unbounded lateral coverage; unchanged scale/pose work
should be distinguished from edit work in existing traces. A local Wall edit must still preserve
its exact changed set and installed result while all other Rooms stay presented. Reducing
annotations can improve legibility without fixing canonical evaluation or full mesh rebuilds.

## L exposed 3D overview

**[A] Submission model.** Grid-14 has about 420 physical Wall meshes plus 2 × 196 = 392 Room
surface meshes before door graphics, Scene objects and helpers. That is an inventory, not a draw
count. Wall material groups, frustum tests, shadow cameras and additional passes decide actual
submissions. A useful model is main-view material-group draws plus the sum of caster-group draws
over each light's shadow views. Instancing reduces submissions, not the triangles or pixels each
visible copy needs.

**[X] Three.js choices and a BIM implementation:**

| Candidate | Mechanism | Tradeoff for Biskiq |
| --- | --- | --- |
| Merge static geometry per spatial cell and material | Fewer objects/draws; coarse cell rejection | Coarse cells submit excess geometry; rebuilding one huge merged building on every Wall edit violates locality. Retain buffers/ranges and rebuild only affected cells |
| [InstancedMesh][three-instance] | Same geometry/material, many transforms | Good for repeated ornaments/definitions, weaker for unique Walls/Openings; aggregate bounds need maintenance. Default [raycasting][three-instance-source] loops instances after the broad bound |
| [BatchedMesh][three-batch] | Different geometries sharing material, per-instance visibility and transforms | [Source][three-batch-source] still iterates instances and may sort each view, including shadow views. Capacity, geometry replacement and compaction have costs |
| [That Open Fragments][fragments-guide] | Worker owns model data and streams rendering tiles; separate item/sample/representation identities; edits create delta models | Relevant editable-BIM precedent. Its [tile controller][fragments-tiles] retains changed tiles, per-sample LOD state and hierarchy verdicts. Its format, worker protocol and edit semantics cannot become a second Biskiq authority |

**Multi-draw caveat.** [X] In Three's [renderer source][three-renderer], `BatchedMesh` uses
`WEBGL_multi_draw` when available; otherwise it loops draw ranges with ordinary draws. It is
therefore not a portable promise of one GPU submission. The r186 source mechanisms cited here
were also checked in the lockfile-installed 0.186.1 sources; this is inspection, not a runtime
capability check. **[H]** Compare CPU submission and actual extension support before choosing it
over merged material batches or instancing. Material/state fragmentation limits all three.

**Retain spatial chunks without surrendering edit locality.** [H] Keep independent semantic
dependency, rendering-cell and shadow-influence sets. A boundary Wall can dirty adjacent cells;
a material or light change can dirty more than the Wall geometry. Stable Wall/source IDs must
map to buffer ranges or instance IDs across replacement, Undo/Redo and compaction. Selection
styling must not clone every material. H1/H4 can reduce edit work without reducing the cost of
an all-visible frame; batching can reduce draws without making edit invalidation local. Both
axes need evidence. Chunk sizing and its cache layout remain owner decisions under H6.

**Shadows and apparent visibility.** [B] Stage has fixed fog from 40 to 120 m and a shadowed
directional light without an explicit shadow-camera fit. [X] Three's
[directional shadow default][three-directional-shadow] spans only −5 to +5 in light-camera X/Y;
the [shadow renderer][three-shadow] updates automatically by default. Thus an 84 m-wide grid
does not imply full-grid shadow coverage. H9 can eliminate identical orbit shadow work but
does not reduce the first or edit-triggered shadow update. A future town sun/shadow solution
would have different coverage, resolution and invalidation costs. Do not disable fog, widen
shadow cameras, remove ceilings or add clipping to manufacture an optional S06 result.

**[X] Picking libraries.** [three-mesh-bvh][bvh] offers geometry BVHs and an ObjectBVH over
objects/instances. Refit updates bounds, but large vertex changes degrade tree quality and
topology/index changes need appropriate rebuilds. **[H]** Use only after identifying the actual
hot hit path. A per-mesh triangle BVH alone does not remove a full object/instance scan, nor does
it accelerate the current projected-fragment fallback. A GPU ID buffer is another future option:
it avoids many CPU intersections but adds a pass/readback and ID lifetime/latency problems; it
cannot replace exact snapping, dimensions or acceptance.

## Town bird's-eye view

**[H] Hierarchy must reduce detail of visible content.** At town overview most building footprints
can be visible together, so Room portals alone offer little elimination. Use spatial hierarchy
outside, with building/interior partitions when entering a building. A candidate derivative
hierarchy is district/block silhouette → building shell → Room/detail. Selected or edited content
needs exact correspondence and can be refined independently. This is a design comparison, not
a new Biskiq representation contract.

| Partition | Strength | Failure mode |
| --- | --- | --- |
| Building as one chunk | Stable semantic identity and isolated building edits | A large building remains expensive; outdoor spaces need separate coverage |
| Uniform world cells | Predictable neighborhood updates; useful for terrain, roads and repeated vegetation | Sparse cells and cross-cell geometry; large buildings span many chunks |
| Quadtree/BVH hierarchy | Reject/refine groups at several scales; handles broad bird's-eye demand | Bounds, traversal, parent derivatives and edit propagation cost memory/work; loose bounds weaken rejection |
| Room/portal graph | Interior visibility and lighting relationships | Exterior/cutaway demand may expose nearly every Room; it is not the town partition |

**[X] Established competing implementations.** The [3D Tiles specification][tiles-spec] provides
spatially coherent HLOD with geometric error, screen-space refinement and either replacement or
additive refinement. **[H]** Replacement suits district/building proxies; additive refinement
would otherwise keep parent and child costs together. Neither option defines exact architectural
editing, and a tileset derivative must not become authored Layout truth.

[CesiumJS][cesium-source] trades desired screen-space error against estimated cache bytes and
overflow allowance, with a memory-adjusted error when needed; it also suppresses likely-useless
requests during movement. [3DTilesRendererJS][tiles-renderer] fits a Three.js environment and
exposes [download/parse priority queues and an LRU cache][tiles-api]. Its documented hard-cap
behavior can stop refinement and retain coarser tiles, a different quality/memory tradeoff from
allowing cache overflow. Both need prepared hierarchical content; neither makes Biskiq's current
full-envelope admission out-of-core. Engine/API/Camera integration cost matters more than a
viewer demo's building count.

**[X] Adaptive detail.** [meshoptimizer][meshopt] supplies error-controlled simplification, but
seams/topology can prevent reaching a requested triangle count. **[H]** Building silhouettes,
Openings and cross-cell cracks need image/correspondence validation; compression or fewer
triangles alone cannot fix draw-bound frames. Use projected error, not just distance. For an
orthographic bird's-eye view, pixels per world unit determine projected error; perspective
distance formulas must not be copied unchanged. Repeated buildings, trees and ornaments can
instance per definition/material/spatial region, but material clones and unique alterations
reduce sharing. Standard instancing still renders each visible copy's geometry.

**Streaming and edits.** [H] A future runtime needs cancellable prioritized requests, bounded
decode/upload concurrency, coarse fallback, residency/eviction accounting and stable resource
versions. Count source, compiled data, CPU decoded buffers, GPU buffers/textures and temporary
replacement data together. Keep exact authored/query data available for editing even when a
coarse proxy is drawn; unresolved detail must be disclosed rather than used as exact geometry.
Editing one building can invalidate its leaf chunks and ancestor HLOD, plus shadows outside its
footprint. A dependency digest can preserve unaffected derivatives; deciding whether regeneration
is local, asynchronous or release-time is a future T1/T2/T3/T4 owner proposal. Retain the one
Camera authority, one compiler and visitor isolation throughout.

## Smallest optional S06 measurements

**Two viewpoint records maximum; off by default, owner opt-in per existing pass.** Reuse the
existing L grid-14, or the already-loaded realistic-L fixture if available, unchanged. These are
annotations/segments of existing L F3/F4/F7/F8 work, not new flows, tiers or passes. Required L
rows keep their existing poses, paths, sampling and acceptance identity. If attaching a separate
optional segment needs new fixture generation, scripting, probes, cutaway rendering or changed
correlation, leave it unmeasured. This research PR adds none of those things.

| Record | State and existing actions | Read only where already available |
| --- | --- | --- |
| L Plan overview | Existing Plan reading and Fit/Camera controls; full grid footprint in-frame. Keep overview during the existing selected-Wall drag/typed edit and Undo/Redo segments. Inspect already-supported small pan/zoom/pick segments without moving required samples into this pose | Frame intervals/long tasks; existing input-to-matching-result evidence and stage splits; evaluations, mesh builds/upload bytes/material creation; existing marker count. Pick or label attribution only if the trace already provides it |
| L exposed 3D overview | Existing high-oblique/isometric-like camera pose, full footprint in-frame; existing orbit/dolly/pan segment bounded to retain coverage and the same local Wall-edit class where supported | Same counters, plus S06's existing draw/triangle/shadow/resource counters. Record partial exposure if Walls, ceilings or fog prevent the intended hundreds-of-Rooms view |

Minimum metadata is the existing revision/build/fixture digest and counts, viewport/DPR,
cache state, reading, exact Camera pose/scale, Plan/Reveal parameters, selection/edit class and
available trace/image locator. Record footprint coverage, eligible Rooms and apparent surface
exposure separately. Reuse an existing image artifact if available; without one or equivalent
coverage evidence, leave the all-visible claim unverified. Do not add screenshot instrumentation.

Report available frame statistics/sample counts and existing F3/F4/F8 completion evidence in
their own optional fields. Missing GPU time, picking time, label-layout time, precise visible
counts or unsupported actions are **unmeasured**, never zero. An SVG preview marker's identity
alone does not establish final 3D mesh presentation. Keep the harness's presentation limitations
and unresolved H0 owner ruling visible. An rAF interval is not input-to-presented-result latency.

**Counter interpretation.** [X] Three's [WebGLInfo][three-info] counts geometries/textures, not
their byte sizes, and multi-draw accounting can count one call for several ranges.
[Renderer reset/pass boundaries][three-renderer] matter. **[H]** Read the counters already
specified by S06 C with their declared boundary; separate main/shadow draws only if the existing
probe supplies that split, avoiding double counting. GPU resource bytes remain estimates, not
exact driver allocation. Do not infer GPU time from JS submission time or infer visibility from
triangle count. No new instrumentation requirement follows from this advice.

The setup handover states opt-in availability and added wall time; a skipped record is a coverage
gap, never a failed gate. Preserve peak-first order, cooldowns, lock, load checks, cold/warm/repeat
definitions and sample rules. Optional segments must be isolated from required measurement
windows and cache/Undo state; omit them if that separation cannot be preserved. When enabled
across benches, use identical fixture, state and segments and report any changed/omitted coverage;
do not compare incompatible records. No rerun or fourth pass is justified by missing optional
data. Optional results cannot replace a hard row, relax a miss or claim town acceptance.

## Falsification experiments and expected implications

These are **future discriminating experiments**, not new S06 tasks or tests run by this PR.
Existing optional traces can motivate them; renderer/index/streaming changes need their own owner
scope, correctness proof and measurement authorization.

| Hypothesis | Concrete comparison and observations | Falsifier / consequence |
| --- | --- | --- |
| A lighter Plan representation matters | Same fitted L pose/edit, current 3D path versus fragment drawing; separately count representation work, GPU submissions, paint and semantic evaluation | If remaining compile/admission or overlay work dominates and end-to-end time does not improve beyond noise, do not build a new Plan renderer to address that bottleneck |
| Dense Plan picking benefits from an index | Same hit/miss/boundary points at overview and close zoom; scan versus RBush or static-plus-delta; count candidates and index update work; compare exact winners and generations | Any changed eligible winner/tolerance behavior fails correctness; update/rebuild cost dominating the saved query work defeats the optimization |
| Spatial batching preserves editing | Same exposed L view and boundary/interior Wall edits; retained entities versus building-wide batch versus spatial/material chunks; count draws, dirty chunks, uploads and total edit completion | Unchanged regions reuploading with N refute locality; fewer draws without frame improvement refute a submission-bound explanation; extension fallback can erase a multi-draw win |
| Static shadows explain orbit cost | Read H9's existing unchanged-orbit versus edit-triggered counts, with identical lighting and actual shadow coverage | If shadow share is small, H9 cannot explain most frame cost; this does not weaken H9's existing exactness/trigger proof or justify caching stale maps |
| HLOD beats visibility-only town rendering | Future broad exterior view with fixed output resolution; finest visible building meshes versus hierarchical proxies; record draws, triangles, image error, refinement/upload stalls and bytes | If detail is already cheap but submissions/material changes dominate, simplification alone is insufficient; unacceptable silhouettes/cracks or loss of exact edit correspondence reject the representation |
| Streaming bounds the working set | Future town flyover, reversal and building edit under declared bandwidth/cache conditions; compare retain-all with priority/eviction; account cancelled work, fallback coverage, peak total bytes and refetches | Thrashing, holes, stale ancestors or unchanged peak residency despite eviction refute the chosen policy; a larger unbounded cache is not a locality result |

Expected engineering order is conditional: [H] establish semantic/representation locality with
H1/H4, remove identical shadow work with H9, then use actual all-visible attribution to decide
between Plan presentation, submission batching, picking indexes and detail reduction. An
all-visible frame has V close to N even when a local edit has small k. Budgeting only k does not
bound frame work; budgeting only draws does not bound shader, triangle, pixel or memory work.
Keep S06 I6 accounting: cache fills, worker processing and release-time preparation are total
work moved or reused with memory costs, not automatically work eliminated.

## Integration before Bench 1 and deferred decisions

**Safe to integrate before Bench 1 as documentation only.** The amendment adds a link and
optional interpretation/records under S06 C; it changes no required method, implementation,
census, hypothesis or acceptance row. Bench 1 proceeds without the optional records if setup
cannot supply them safely. Do not delay or reopen the active setup to force coverage.

The S06 setup agent must reconcile, in its own checkout and handover:

- Its current patch base against this plan insertion; preserve its approved work and baton.
  The published base used here still has only S/M fixtures and no shipped Stage render probe;
  setup progress may have superseded those facts.
- Whether existing fixture loading, Camera controls, trace correlation and S06 C counters can
  expose the two states without new harness/fixture/instrumentation work. Missing support means
  defer the record, not expand implementation.
- Whether “full footprint,” Plan eligibility and actually exposed Rooms agree. Fog, ceilings,
  occlusion and the small default shadow frustum limit what an overview proves. H6's picking
  shorthand and mesh estimates are not a measured description of every live hit/draw path.
- If the owner opts in, exact segments, optional field names, evidence locators, added wall time
  and state isolation. Required sample/cache rules, E1–E5, H1–H9, H9's full trigger contract,
  three owner passes and the owner-held H0 ruling stay unchanged.

Defer the Plan renderer/annotation policy, index choice, spatial chunk granularity, batching
backend/material sharing, instancing, cutaway UI, HLOD/error policy, town partitions/fixtures,
streaming/cancellation/eviction, compressed textures, shadow coverage and release derivatives
to the corresponding owners under S06 F and strategy M2–M5. No town budget, workload tier,
gate, additional benchmark pass or authored-format change is proposed here. Stop before merge;
any setup conflict that changes methodology should leave this additive research available and
defer the plan insertion instead of rewriting the active setup.

## Source register

Primary sources accessed 2026-10-24. Immutable source links pin the inspected external code;
documentation links describe the corresponding API. Licenses below describe inspected roots,
not a transitive-dependency or WASM admission audit. No library was adopted or performance-tested.

| Source | Inspected implementation / license | Use here |
| --- | --- | --- |
| Three.js | r186 [BatchedMesh][three-batch-source], [renderer][three-renderer], [InstancedMesh][three-instance-source], [shadows][three-shadow], [info][three-info]; [MIT][three-license] | Submission paths, extension fallback, culling/sort loops, shadow updates and accounting; mechanisms cross-checked against installed 0.186.1 |
| MapLibre GL JS | `da14df808f39`, [collision grid][maplibre-collision]; [BSD-3-Clause and bundled notices][maplibre-license] | Screen-space label collisions and stability costs |
| RBush / Flatbush | `e59712716a84` / `c5af0778aa6f`, [dynamic][rbush] / [static][flatbush]; [MIT][rbush-license] / [ISC][flatbush-license] | Alternative Plan broad-phase indexes |
| three-mesh-bvh | `16d6ae6383e9`, [API][bvh]; [MIT][bvh-license] | Geometry/object hierarchies and refit limitations |
| That Open Fragments | `a1e3aa3accbf`, [architecture/edit guide][fragments-guide], [tile controller][fragments-tiles]; [MIT-form permission][fragments-license] | Editable BIM, tiled/worker presentation and identity separation; import dependencies not qualified |
| 3D Tiles 1.1 | `b4eedf8fa441`, [specification][tiles-spec] | Spatial hierarchy, geometric error, replacement/additive HLOD; a format precedent, not an adopted runtime |
| CesiumJS | `ad366f071293`, [tileset source][cesium-source]; [Apache-2.0][cesium-license] | SSE/cache overflow and movement-aware requests |
| 3DTilesRendererJS | `56789f3f6613`, [overview][tiles-renderer], [core API][tiles-api]; [Apache-2.0][tiles-license] | Three-compatible traversal, queues, hard cache cap and coarse fallback |
| meshoptimizer | `f0a684f11ead`, [simplification][meshopt]; [MIT][meshopt-license] | Error-controlled derived LOD; not a proposal for a new native toolchain |

[s06]: ../docs/roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/implementation-plan.md
[perf]: ../docs/reference/components/performance.md
[strategy]: ./cinematic-scale-computational-strategy.md
[h0]: ../docs/roadmap/t3-experience/t3.p03-shared-acceptance-and-measurement/t3.p03.s02-measurement-workflow-and-final-gate/acceptance.md#measured-pre-flight-rows-no-budget-accepted
[architecture]: ../docs/reference/architecture.md
[stage-canvas]: ../apps/editor/src/lib/authoring/stage/shell/StageCanvas.svelte
[stage-camera]: ../apps/editor/src/lib/authoring/stage/shell/StageCamera.svelte
[plan-eval]: ../packages/layout-core/src/layout-plan-representation.ts
[plan-params]: ../apps/editor/src/lib/authoring/stage/plan-parameters.ts
[facade]: ../apps/editor/src/lib/authoring/stage/stage-facade.ts
[layout-shell]: ../apps/editor/src/lib/visitor/VisitorLayoutShell.svelte
[buffer-adapter]: ../apps/editor/src/lib/render/wall-geometry-adapter.ts
[overlay]: ../apps/editor/src/lib/authoring/stage/shell/StageOverlay.svelte
[route]: ../apps/editor/src/routes/project/[projectId]/spatial/+page.svelte
[grammar]: ../docs/reference/design-system/spatial-instrument-grammar.md#density-and-correspondence-between-readings
[model-clone]: ../apps/editor/src/lib/museum/assets/model-utils.ts
[orbit]: ../apps/editor/perf/flows/orbit.spec.ts
[fixtures]: ../apps/editor/perf/lib/fixtures.ts
[harness]: ../apps/editor/perf/README.md#correlation-why-the-ledger-exists
[three-batch]: https://threejs.org/docs/pages/BatchedMesh.html
[three-instance]: https://threejs.org/docs/pages/InstancedMesh.html
[three-batch-source]: https://github.com/mrdoob/three.js/blob/r186/src/objects/BatchedMesh.js#L1516
[three-renderer]: https://github.com/mrdoob/three.js/blob/r186/src/renderers/WebGLRenderer.js
[three-instance-source]: https://github.com/mrdoob/three.js/blob/r186/src/objects/InstancedMesh.js#L258
[three-shadow]: https://github.com/mrdoob/three.js/blob/r186/src/renderers/webgl/WebGLShadowMap.js
[three-directional-shadow]: https://github.com/mrdoob/three.js/blob/r186/src/lights/DirectionalLightShadow.js#L16
[three-info]: https://github.com/mrdoob/three.js/blob/r186/src/renderers/webgl/WebGLInfo.js
[three-license]: https://github.com/mrdoob/three.js/blob/r186/LICENSE
[maplibre-collision]: https://github.com/maplibre/maplibre-gl-js/blob/da14df808f394e34d3aa3797b771df11357c769c/src/symbol/collision_index.ts
[maplibre-license]: https://github.com/maplibre/maplibre-gl-js/blob/da14df808f394e34d3aa3797b771df11357c769c/LICENSE.txt
[rbush]: https://github.com/mourner/rbush/blob/e59712716a84dda2e31f9b471b32faa178d8056f/README.md
[rbush-license]: https://github.com/mourner/rbush/blob/e59712716a84dda2e31f9b471b32faa178d8056f/LICENSE
[flatbush]: https://github.com/mourner/flatbush/blob/c5af0778aa6f04c532b7dc9ca72d1697c85368b9/README.md
[flatbush-license]: https://github.com/mourner/flatbush/blob/c5af0778aa6f04c532b7dc9ca72d1697c85368b9/LICENSE
[bvh]: https://github.com/gkjohnson/three-mesh-bvh/blob/16d6ae6383e9a20600152be2955851b20914b1ca/API.md
[bvh-license]: https://github.com/gkjohnson/three-mesh-bvh/blob/16d6ae6383e9a20600152be2955851b20914b1ca/LICENSE
[fragments-guide]: https://github.com/ThatOpen/engine_fragment/blob/a1e3aa3accbf276f5b78c099caf9e440f9fb3f76/CONTRIBUTING.md
[fragments-tiles]: https://github.com/ThatOpen/engine_fragment/blob/a1e3aa3accbf276f5b78c099caf9e440f9fb3f76/packages/fragments/src/FragmentsModels/src/virtual-model/virtual-controllers/virtual-tiles-controller.ts
[fragments-license]: https://github.com/ThatOpen/engine_fragment/blob/a1e3aa3accbf276f5b78c099caf9e440f9fb3f76/LICENSE.md
[tiles-spec]: https://github.com/CesiumGS/3d-tiles/blob/b4eedf8fa441beb7360d25d30903a6672cff5f1e/specification/README.adoc
[cesium-source]: https://github.com/CesiumGS/cesium/blob/ad366f071293b28bdf330c822965b8bd0bdeb781/packages/engine/Source/Scene/Cesium3DTileset.js
[cesium-license]: https://github.com/CesiumGS/cesium/blob/ad366f071293b28bdf330c822965b8bd0bdeb781/LICENSE.md
[tiles-renderer]: https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/56789f3f6613c9d63ebbbc2e8967a5077b4ba666/README.md
[tiles-api]: https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/56789f3f6613c9d63ebbbc2e8967a5077b4ba666/src/core/renderer/API.md
[tiles-license]: https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/56789f3f6613c9d63ebbbc2e8967a5077b4ba666/LICENSE
[meshopt]: https://github.com/zeux/meshoptimizer/blob/f0a684f11ead064e176775c9b796f82a55910e92/README.md#simplification
[meshopt-license]: https://github.com/zeux/meshoptimizer/blob/f0a684f11ead064e176775c9b796f82a55910e92/LICENSE.md
