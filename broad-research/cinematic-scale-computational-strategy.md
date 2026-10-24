# Cinematic-scale computational strategy (S06 research input)

Status: research handoff, written 2026-10-24 for
[T1.P02.S06](../docs/roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/implementation-plan.md).
**Not** a contract, plan, roadmap change or decision. It authorizes no format, semantics, rendering
architecture, scope or benchmark pass. Every move outside S06's released scope is an owner
decision, listed in [§5](#5-what-s06-establishes-now-and-what-the-owner-decides).

Claims are labelled. **[M]** is measured, with its source. **[A]** is arithmetic from stated
assumptions. **[H]** is a hypothesis that an experiment named here can falsify. Code facts cite
the trusted base `696af6ea`.

## 1. Work backward from the experience

**The target.** A richly detailed museum: intricate architecture, procedural ornament, realistic
materials, lighting, reflections and animation. It stays responsive in an ordinary 8 GB laptop
browser (the contract's laptop A: Iris Xe class, 8 GB shared memory). It keeps exact authoring
semantics and high perceived fidelity, without workstation hardware, unlimited caching or global
quality cuts.

**Reference scene** (a design target, not a fixture; realistic, not inflated):

- 60 rooms (galleries, an enfilade, a corridor loop and one hall);
- about 360 Walls and 140 Openings;
- 40 PBR materials, each with three 2K maps;
- 30 object and ornament definitions placed about 3,000 times (coffers, balusters, frames, plinths,
  vitrines; for example one 10 × 10 coffered ceiling in each of 20 rooms is 2,000 placements);
- 12 authored lights;
- a 30-stop guided route.

**What today's model would spend on it** (from code facts plus arithmetic):

| Cost | Today (mechanism) | Reference-scene estimate | Budget the experience needs |
| --- | --- | --- | --- |
| Texture GPU memory | `creator-import@1` emits WebP and refuses KTX2 (`apps/editor/src/lib/authoring/adapters/scene/import/ingest.ts:493–502`), so every map is decoded to RGBA8 on the GPU | [A] 2048² × 4 B × 4/3 mips = 21.3 MiB per map; 120 maps = **2,560 MiB** | Contract GPU-memory hard row: ≤ 384 MiB at M on laptop A |
| Draw submissions | One draw per mesh per placement. Placements share geometry, but each clones its materials (`apps/editor/src/lib/museum/assets/model-utils.ts:14–31`). No instancing exists. One shadow-casting directional light re-renders its casters on every rendered frame (`StageCanvas.svelte:56–61`) | [A] ≈ 3,000 × 2 meshes + ≈ 600 Layout meshes ≈ **6,600 per pass**, plus a shadow pass over the casters | Contract draw-call target ≤ 1,000 (M), ≤ 2,500 (L) |
| Triangles | Fixed meshes at one detail level; no LOD | [A] at 3 k triangles per ornament placement ≈ 9 M in the scene; per-object frustum culling might halve it | [H] an integrated GPU sustains roughly 1–2 M lit triangles per 60 Hz frame |
| Semantic edit | Whole-document planner and compile per pointer move (S06 matrix H1) | [M] 23.00 ms for grid-7 (≈ 340 entities; H0 calibration). [A] linear extrapolation to ≈ 860 entities gives ≈ 58 ms per move | Contract per-edit evaluation ≤ 8 ms (M), ≤ 16 ms (L) |

None of these four overruns comes from slow kernels. Each comes from doing work that does not
contribute to the result: regenerating unchanged derivations, holding non-visible or uncompressed
content, submitting repeated geometry once per copy, and drawing detail finer than the screen can
show. The strategy below removes those categories. It does not make the same work faster.

## 2. The organizing distinction: semantic influence and visual influence

An edit has two influence sets, and they obey different rules.

- **Semantic influence** is the set of canonical derivations whose value can change: topology,
  Rooms, Openings, dimensions, validation verdicts and Camera connectivity. It must be computed
  **exactly**, once, before the result is accepted. It is defined by the compiler's dependency
  graph and is independent of where anyone is looking.
- **Visual influence** is the set of presented pixels whose value can change. It covers direct
  geometry, the shadows and indirect light through Openings, reflections in visible surfaces, and
  nothing that is occluded, culled or below the screen's resolving power. It is view-dependent and
  can converge progressively, within declared error bounds.

**Exactness boundary (principle).** Presentation may approximate; semantics may not.

- Tessellation, LOD, impostors, lighting convergence and texture residency are presentation
  derivatives, judged in pixels and convergence time.
- Picking, snapping, dimensions, validation and every acceptance decision read the exact semantic
  representation, never a presentation approximation.
- “Preview equals planner output” binds the semantic derivation and its presented geometry. It
  does not stop lighting from refining over the next frames, provided that is declared.

Most of the gain below comes from computing semantic influence exactly and locally, then letting
visual influence, which is usually much smaller in an interior museum, decide everything else.

## 3. Strategy, in priority order

Each move eliminates a category of work. It uses structure Biskiq's canonical model already
has, it states its fundamental limit, and it names the smallest experiment that would falsify
its advantage.

### M1 — Maintain derivations; do not recompute the document

**Mechanism.** Treat the compiler's output as a materialized view of the canonical source,
maintained under edits. This is the technique of database incremental view maintenance and of
incremental compilers.

- Per-entity pure derivations declare their inputs.
- Maintained spatial and identity indexes answer global constraints (crossings, Room disjointness,
  uniqueness) as queries over an edit's swept bounds.
- Consumers pull only the representations they need: Plan does not demand 3D meshes, and the
  visitor does not demand editor facts.
- The full compile remains the authority and the differential oracle.

**Eliminates.** Recomputation of unaffected entities, global re-validation and eager
materialization of representations nobody reads.

**Expected gain.** [A] A single-Wall edit touches k ≈ 25–30 entities. If per-entity cost is
uniform, the per-move semantic cost is about k/N of a full compile and stays flat as the project
grows: ≈ 2 ms instead of ≈ 58 ms at the reference scene.

**Fundamental limit.** Topology edits whose affected planar-graph component is large (one Wall
closing a big enclosure). Global derivations, such as a Room ceiling as the maximum of its boundary
heights, must be declared dependencies, so that incremental results stay bit-identical to the full
compile.

**Falsifier.** S06's dependency census (E1): if the median k/N for ordinary edit classes on a
realistic layout is not small (for example above 20 %), locality does not pay.

**Ownership and migration.** T1, inside the one compiler, with no format change. S06 runs the
bounded experiment (H1); a general derivation graph is a follow-on.

### M2 — Let the architecture decide visibility and influence

**Mechanism.** An interior museum is already a cell-and-portal world, and Biskiq's semantics name
it exactly:

- Rooms are cells, Openings are portals and Walls are occluders. Each Opening joins the two Rooms
  adjacent to its host Wall, and a door already carries an authored, validated `connectsRoomIds`
  pair (`packages/layout-core/src/layout-wall-portals.ts`).
- Rooms are the natural volumes for light lists, reflection probes and irradiance probes.
- Authored Camera Views, connections and Experience Stops are a demand forecast.

Visible sets come from portal traversal clipped to the view frustum. The visual influence of an
edit follows the same graph: its own meshes, the probes and shadows of its Room, and the Rooms
seen through its Openings. Game engines precompute potentially-visible sets; Biskiq can derive
them from topology the creator has already authored.

**Eliminates.** Rendering, shading, shadowing and lighting updates for anything that cannot reach
the presented image.

**Expected gain.** [H] At a typical stop, 3–8 of 60 Rooms are visible, so 5–15 % of scene
submissions and triangles. An enfilade is the honest worst case (10+ Rooms in one sightline).

**Fundamental limit.** Open plans, glass, atria, mirrors and exterior views weaken portals. The
fallback is frustum culling plus hierarchical occlusion (WebGL2 has asynchronous occlusion queries).

**Falsifier.** The visibility census (E2): if the median portal-visible fraction over the authored
Views of a realistic layout exceeds about 40 %, the move is not worth a renderer change.

**Ownership and migration.** A rendering-architecture decision for the shared Stage, Preview and
visitor runtime (T1/T3), later lowered into release (T4).

### M3 — Bound residency, and keep content in GPU-native form

**Mechanism:**

- Store textures in GPU-compressed form: KTX2/Basis, transcoded to BC7, ASTC or ETC at load. The
  transcoder's license must be verified at the pinned version under the full-permissive rule.
- Keep residency per cell: resident content is the visible set plus the next authored stop.
- Prefetch along the Experience route in the visitor, and along Camera motion in the editor.
- Keep derived payloads in a content-addressed, bounded local cache with explicit eviction, never
  unlimited.

**Eliminates.** The RGBA8 decode bloat, and memory held for content that is neither visible nor
about to be.

**Expected gain.** [A] Format alone: BC7/ASTC (1 B/px) takes 120 maps from 2,560 MiB to 640 MiB;
ETC1S-class (0.5 B/px) takes them to 320 MiB. [H] Residency at about 20 % of materials per stop
then gives ≈ 128 MiB or ≈ 64 MiB. That is 20–40× in all, inside the 384 MiB laptop-A row.

**Fundamental limit.** Cold first visit: the visible set must still arrive over the network. Fast
Camera cuts outrun prefetch; the mitigation is an authored-route lookahead and a low-mip floor
that is always resident.

**Falsifier.** The residency census (E4): if a stop's visible set plus its next stop routinely
holds most materials, residency is not the lever and format compression is the only gain.

**Ownership and migration.** T2's import recipe becomes `creator-import@2`, which is a recipe
change and an owner decision. The residency manager in the shared runtime is a T1/T3 decision.

### M4 — Describe once, place many

**Mechanism.** Classical architecture is modular (orders, coffers, balusters, moldings), and
Biskiq already separates definitions from instances (T2). Make that the cost model:

- one geometry and one material set per definition, plus instance data;
- instanced submission per (definition, material, cell);
- no per-placement material clones;
- procedural ornament memoized by parameter digest, so it is evaluated once per distinct
  parameter tuple.

**Eliminates.** Per-copy submission, per-copy material state and per-copy procedural evaluation.
Richness from repetition becomes almost free.

**Expected gain.** [A] Instancing per (definition, mesh) takes object draws per pass from ≈ 6,000
to ≈ 30 × 2 = 60 for the whole scene. Batching per cell, so that M2 can cull, costs at most that
per visible cell: with ≈ 10 definitions per Room and 5 visible Rooms, ≈ 100.

**Fundamental limit.** Per-instance variation must travel as instance attributes. Arbitrary
per-copy edits break batching for that copy only. Today's per-placement material clones exist for
a reason: per-placement state such as `setModelWireframe` mutates them, so sharing first means
moving that state out of the material.

**Falsifier.** The sharing census (E3): unique (definition, material) pairs against placements.
If most placements are unique, instancing gains little.

**Ownership and migration.** Instanced rendering is a T2/T1 render decision; procedural ornament
definitions are a product and format decision (P27 lineage).

### M5 — Represent detail to the screen's error, not the author's

**Mechanism.** Several presentation representations derive from one exact source:

- view-dependent tessellation of curves and arches at a bounded screen-space chordal error (as CAD
  display tessellation does);
- hierarchical LOD and impostors for distant ornament;
- `meshoptimizer` simplification, MIT and already a dependency;
- texture mips streamed by projected size;
- lighting converges progressively on idle frames.

**Eliminates.** Detail the display cannot resolve.

**Expected gain.** [H] Distant ornament drops 3–10× in triangles at an error under 1 px. With M2,
visible triangles fit the [H] 1–2 M budget.

**Fundamental limit.** Silhouettes and close-ups need full detail. Popping must be hidden by
error-bounded transitions.

**Falsifier.** Bench rows for triangles per frame at realistic views: if frames are not
triangle-bound once M2 and M4 hold, M5 is deferred.

**Ownership and migration.** A T1 representation layer for Layout curves, plus T2 for models.
Release precompute of the LOD chains is T4.

### Cross-cutting: one derivation pipeline, two execution plans

**The editor** runs the derivations on demand, incrementally and progressively, under a frame-budget
scheduler. Its priority order:

1. the input-matching semantic result and its presented geometry (latency-bound);
2. visible visual deltas;
3. lighting refinement and prefetch;
4. background digests and serialization (S06 I4).

Budgets come from the measured device frame time, not fixed presets. Quality falls only where it
is imperceptible: off-screen first, then distant detail, then convergence rate. The hero view
keeps full fidelity.

**Release** runs the same derivations exhaustively offline:

- baked lighting and probes;
- visibility from topology;
- LOD chains;
- compressed textures.

These are immutable, reproducible delivery derivatives, which rule 3 explicitly permits (T4).
Neither plan forks the semantics.

### Not chosen, and why

- **Faster kernels, WASM, workers or WebGPU as the strategy.** They are constant factors, and
  every category above survives them. They remain enablers: WebGPU compute later makes cluster
  LOD and GPU culling practical.
- **Global quality presets.** They are indiscriminate. They cut what the creator made in order to
  save work the creator never needed.
- **Real-time GI or path tracing in the browser.** Outside an integrated GPU's budget. Probes,
  lightmaps and convergence give the perceived result.
- **A separate rendering geometry engine.** That is a second architectural authority (rule 6).
  Every presentation representation derives from the one compiler's output.
- **Unlimited caching.** The 8 GB target forbids it. Caches are bounded, content-addressed and
  evictable.

## 4. Fundamental limits, stated plainly

- Exact semantic work is at least the affected set. Global topology edits and opening a file
  (Ω(N) read and validate) remain linear.
- The visible set is what it is. A grand hall with an open sightline costs what it shows. The
  promise is that cost tracks what is seen, not that it is constant.
- Indirect light changes non-locally when a light changes. Influence volumes bound it in interiors
  only.
- Cold delivery is bounded by bandwidth. WebGL2 submission overhead, shader-compile stalls and GC
  pauses are platform costs, to be scheduled around rather than eliminated.
- An M2 pass does not prove laptop A. The contract already says so, so laptop-A claims stay
  arithmetic until measured on an A-class machine.

## 5. What S06 establishes now, and what the owner decides

| Item | Now, in S06 (no format, semantics or architecture change) | Owner decision (future) |
| --- | --- | --- |
| M1 derivations | H1 incremental-evaluation experiment; dependency census E1; invariants I1–I5 | General derivation graph; I1–I5 as contract rows |
| M2 visibility and influence | Visibility census E2 over a realistic, museum-shaped layout and its authored Views | Cell/portal rendering and influence-scoped lighting in the shared runtime |
| M3 residency | Residency census E4; GPU texture bytes by format in the benches | `creator-import@2` GPU-compressed output; a residency and prefetch manager; a bounded local cache |
| M4 sharing | Sharing census E3; draws and material count per repeated placement in the benches | Instanced submission; shared materials; procedural ornament definitions |
| M5 error-bounded detail | Triangles per frame and shader-compile time in the benches | View-dependent tessellation; LOD chains; impostors; release precompute (T4) |
| Repeated identical work | Static shadow maps re-render only when a caster or the light changes, with an identical image (S06 H9) | — |
| Execution plans | Idle time and long tasks per frame in the benches, to size a scheduler | Frame-budget scheduler; hardware-aware budgets |

The censuses E1–E4 are deterministic computations over fixture data, such as the diff of two
full compiles or a portal traversal. They are not benchmarks, so they cost none of the three
owner-run passes.
