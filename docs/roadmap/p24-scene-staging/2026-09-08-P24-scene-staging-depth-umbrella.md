# P24 — Scene / Staging Depth umbrella

**R9 closeout (2026-09-10):** [Minimum freeze](reconciliation/2026-09-10-P24-R9-minimum-freeze.md) is the current inclusion/maturity/operation/acceptance authority; [P24.0–P24.5 child briefs](slices/2026-09-10-P24-minimum-child-plans.md) are implementation-ready for owner review. Earlier draft/pending-minimum wording below is superseded by R9. Source rechecks are closed as planning evidence; implementation and runtime ship gates remain open. P24 remains proposed; execution waits for the accepted P23 minimum and approval. P23.1 shipped via PR #9 (`d5ec0df`) and P23.2 via PR #13 (`a369a15`); P23.9 is the current P23 slice.


**Ratified cross-view direction:** [Unified Plan / 3D authoring addendum](../p23-layout-depth/2026-09-09-P23-P24-unified-plan-3d-authoring-addendum.md) — read alongside this plan for entity-owned mutations, selection continuity, gesture cancellation and PlanProxy/placement ownership. Existing scope, status and dependency gates remain unchanged.

**Created:** 2026-09-08 · **Status:** proposed (tracker authoritative)
**Depends on:** P23 minimum useful Build set complete.
**Detail status:** R0–R9 planning reconciliation complete; minimum and child briefs frozen for owner review. Implementation and acceptance remain open.
**Planning model:** progressive — this umbrella owns WHAT/WHY/BOUNDARIES/ORDER/RESEARCH GATES/high-level acceptance. Evidence artifacts (Phase 2 research, the P24B B0–B6 studies) inform but never override the umbrella contract. Child plans carry implementation detail: the [P24A annex](2026-09-08-P24A-asset-supply-canonical-ingest-annex.md) is the P24A child seed (`seed — evidence pending`: pipeline-side readiness evidence recorded in reconciliation R1; registry/runtime integration and the required post-F0 recheck remain open); the P24B child brief is deliberately **not written yet** — B0–B5 must close first, and no speculative P24B.x seeds are created to fill filenames. Child status vocabulary and the evidence-selection rule (no research for research's sake) live in the [tracker rules](README.md).

## Outcome

P24 turns Scene authoring into a reusable staging system rather than a collection
of model-placement controls. A creator should be able to bring useful 3D content
into the project, place and revise it precisely, style it with reusable materials
and environments, author lighting, and publish the same canonical Scene state
through the visitor runtime.

P24 remains one registered roadmap tier because all of this is **Stage** work over
one project/Scene system. Internally it is split into two bounded subtracks so
asset-supply work does not get conflated with rich 3D-editor behavior:

```text
P24 — Scene / Staging Depth
├─ P24A — Asset Supply + Canonical Ingest
└─ P24B — Rich 3D Scene / Staging Editor
```

`P24A` and `P24B` are umbrella-internal labels, not new tracker numbers. They do
not consume P25 or relax the tracker rule that registered plans use one flat
P-number namespace.

This umbrella deliberately records **research direction, architecture boundaries,
required audits and planning gates**. Except for the already-linked P24A annex, it
must not be read as approval to turn the directional capability lists below into
implementation tickets.

## Research basis

### Phase 2 — P24A asset supply / ingest

Checked-in research:

- `docs/roadmap/p24-scene-staging/research/deep-research-exact-asset-compact.md`
- `docs/roadmap/p24-scene-staging/research/museum-editor-phase2-acquisition-manifest.json`

These are the primary research inputs for P24A. They provide source ranking,
acquisition/provenance guidance, exact starter inventory, materials/HDRIs,
PlanProxy fixtures, pipeline references and reject/defer lists.

### Phase 4 — P24B rich 3D staging

Current checked-in research:

- `docs/roadmap/p24-scene-staging/research/deep-research-P24-3D-editing-compact.md`

The compact artifact says it is a compression/normalization of
`docs/roadmap/p24-scene-staging/research/deep-research-P24-3D-editing.md`.
That full source file is **not currently present on `main`**. Until it is added,
the compact artifact is the durable Phase 4 research input and agents must not
claim to have inspected evidence that exists only in the absent source.

Phase 4 is useful as a **capability/reference inventory**, not as a direct P24B
implementation plan. Its generic “must-build” list includes several capabilities
that Museum Editor already implements in some form. The correct next step is to
reconcile the research against live code and mature reference tools, not to copy
that list into tickets.

### Three capability harvest — completed source evidence

The [Three r175–r186 harvest](./research/three-r175-r186-museum-harvest.md) is complete as a source audit. It identifies
implementation substitutions, compatibility risks and bounded experiments; it does
not establish runtime compatibility, measured performance, minimum inclusion or
authorization to upgrade. The reconciliation sequence records its P24 dispositions.
Harvest ADOPT findings are candidate KEEP/POLISH/DEEPEN implementations for R9-selected
capabilities; BENCHMARK/SPIKE remains optional evidence work; FOLLOW-UP/REJECT stays
outside the minimum. Finding 06 (`Object3D.dispose()`) is explicitly downgraded to
**conditional implementation recheck**, because of Threlte disposal interaction and
the relevant post-r186 point-shadow disposal fix. No cache/refcount deletion is implied.

## Why split

The two subtracks solve different product problems:

- **P24A** asks: *What reusable 3D content can enter the product safely and in a
  normalized form?*
- **P24B** asks: *How mature should the Scene staging experience become once that
  content is available, and which existing capabilities need preservation,
  polish or deeper expansion?*

The split is not a document-ownership split like P23 Layout vs P24 Scene. Both
subtracks ultimately support one Stage vocabulary and must converge on the
existing project asset registry, `SceneDocument`, selection/history, Threlte/Three
render path and P22 visitor-safe publish boundary.

---

# P24A — Asset Supply + Canonical Ingest

**Research reviewed:** Phase 2 files listed above.

**Detailed planning annex:**
[2026-09-08-P24A-asset-supply-canonical-ingest-annex.md](2026-09-08-P24A-asset-supply-canonical-ingest-annex.md)

P24A owns the **supply, normalization, provenance and canonical acceptance side**
of staging. The accepted Phase 2 direction is:

- Wave 1 acquisition source classes: Poly Haven, Kenney Furniture Kit and a small
  attribution-aware Sweet Home 3D subset;
- coherent Poly Haven + ambientCG material supply and bounded Poly Haven HDRIs;
- deterministic glTF normalization using the existing glTF Transform seam first,
  with validator/meshoptimizer/gltfpack work added only where measured useful;
- PlanProxy generation/benchmarking that resolves into the existing
  `AssetFootprint` contract rather than creating another Plan truth;
- a **10–12 asset cross-source proof set** as the P24A minimum evidence, while the
  research JSON's 32-object Wave 1 remains repeatable acquisition backlog;
- explicit acquisition/provenance and rights gates before an asset can become
  Approved;
- an explicit canonical model registry/runtime path because P20/P22 do not yet
  provide generic uploaded GLB ingestion;
- one accepted asset-resolution model across Built-in / Upload / Online sources.

P24A does **not** mean “build a giant asset store.” It does not wait for hundreds
of models, marketplace/community catalogue, user-wide My Assets, every provider
adapter or exhaustive material/HDRI coverage.

### P24A ownership boundary

Assets belong to the project-level asset registry/catalogue boundary, not to a new
Scene-only store. Once accepted, an asset is consumed through normal Scene
operations regardless of source. Provider/source identity may survive as
provenance but never becomes a second Scene-object system.

Acquisition candidates/revisions may carry source hashes, provider IDs, rights
confidence, conversion recipes and review state. Those fields do not automatically
belong in `SceneDocument`.

P24A may supply material, texture and HDRI bytes plus reusable definitions, but it
does not define the complete user-facing material or lighting editor. Those
authoring semantics belong to P24B.

---

# P24B — Rich 3D Scene / Staging Editor

**Research state:** Phase 4 compact artifact reviewed directionally; **not
implementation-ready**.

P24B owns the **authoring and revision side** of staging. The research confirms
that the highest-value areas are object arrangement, placement/replacement,
materials, lighting/environment, staging feedback and semantic operations usable
by humans and future agents. However, the live repository already contains
substantial implementations in several of those areas.

The planning rule is therefore:

> **“Shipped” answers whether Museum Editor already has a canonical
> implementation. It does not answer whether that capability is sufficiently
> capable, efficient, discoverable, polished or expressive for P24's Stage goal.**

Likewise, an external editor doing something differently is not evidence that the
Museum Editor architecture should be replaced.

P24B planning must avoid both errors:

```text
“It already exists, so skip it.”

and

“Blender/Godot/Three Editor does it differently, so replace ours.”
```

Existing architecture is the baseline to preserve. Existing **product maturity**
remains open to evidence-led improvement.

## Known live baseline — preserve, then audit maturity

P23.0a → P23.8 → P23.0b implementation has landed, including world-local compatibility/cutover code, F0 acceptance is closed on `main` through PR #7 (`32b2e8f`) and wall-first writers are enabled. P23.1 shipped via PR #9 (`d5ec0df`) and P23.2 via PR #13 (`a369a15`); P23.9 is the current P23 slice.

Preserve the following canonical foundations; legacy room-frame behavior is an
explicit compatibility concern, not a permanent P24 storage invariant:

- ordered Scene multi-selection;
- one active Scene selection/history system rather than a P24-local selection;
- one mounted TransformControls host with domain adapters;
- canonical Scene transform ownership and coordinate conversion, including
  world-local compatibility/cutover code and explicit legacy room-frame handling;
- translate / rotate / scale, numeric Inspector editing and snapping;
- active-object multi-selection pivot and rigid multi-object transforms;
- uniform/independent editor scale behavior;
- floor placement ghost, Drop to Floor and Keep on Floor;
- selection-aware duplicate;
- flat `SceneObjectCluster` semantics with rigid group transforms and editor
  hierarchy UI; room-frame constraints require the post-F0 recheck;
- one chronological Scene/Layout history model with transaction/coalescing
  behavior already used by transform gestures;
- `SceneMaterialInstance`, material assignment, base texture, roughness/metalness,
  shared usage and Make Unique behavior;
- canonical Scene light entities for Point / Spot / Directional plus a basic light
  Inspector;
- existing Outliner/Unified Project Tree and Scene Inspector surfaces.

This list is **not a declaration that those capabilities are finished**. It is a
list of authorities that a deeper P24B study must inspect before deciding what to
keep, polish, deepen or defer.

## Mandatory capability-maturity audit

Before a P24B implementation brief is registered, every major existing/missing
Stage capability must receive the same reconciliation pass:

1. inspect the current implementation end-to-end;
2. establish its actual current behavior and architectural owner;
3. inspect mature reference implementations directly only where the current
   Museum implementation, existing checked-in research, or completed bounded
   harvests leave a concrete maturity, interaction, algorithmic, or architecture
   question unresolved, including exact public source modules/files where available;
4. compare operation semantics, UX, discoverability, edge cases and performance;
5. identify concrete maturity gaps rather than feature-name parity gaps;
6. classify the capability as:

```text
KEEP AS-IS
POLISH
DEEPEN IN P24B
FOLLOW-UP
REJECT / WRONG PRODUCT
```

7. preserve the current architectural authority unless the audit demonstrates a
   specific architectural limitation that cannot be solved by extension.

The resulting maturity matrix should record at least:

| Capability | Current behavior | Canonical authority | Reference evidence | Proven maturity gap | Disposition |
|---|---|---|---|---|---|
| Selection / multi-select | audit | existing selection system | as needed after current-code audit | TBD | TBD |
| Transform / pivot | audit | single gizmo host + Scene adapter | as needed after current-code audit | TBD | TBD |
| Duplicate | audit | existing Scene mutator/history | as needed after current-code audit | TBD | TBD |
| Groups / clusters | audit | flat `SceneObjectCluster` model | as needed after current-code audit | TBD | TBD |
| Outliner | audit | Unified Project Tree | as needed after current-code audit | TBD | TBD |
| Placement / grounding | audit | existing placement ghost/pipeline | as needed after current-code audit | TBD | TBD |
| Snapping | audit | existing transform/placement snap path | as needed after current-code audit | TBD | TBD |
| Materials | audit | current material definition/instance path | as needed after current-code audit | TBD | TBD |
| Lights | audit | `SceneLightEntity` + renderer/Inspector | as needed after current-code audit | TBD | TBD |
| Environment | missing/partial TBD | must inspect renderer/Scene seams | as needed after current-code audit | TBD | TBD |
| History integration | audit | one chronological history model | as needed after current-code audit | TBD | TBD |

Do not pre-fill “maturity gap” simply because the Phase 4 research names a
feature. Evidence from current Museum behavior, plus reference study only where
a concrete question remains, must justify it.

## Required direct-reference study

The Phase 4 compact artifact names useful reference systems including Three.js
Editor, BabylonJS Editor, Godot, Blender, PlayCanvas, Blockbench, nunuStudio,
A-Frame Inspector, Threlte/R3F examples and other web/editor projects.

Before freezing a major P24B area, directly inspect relevant references only
for concrete unresolved questions. Do not repeat reference work when current
Museum evidence or an already-completed bounded harvest is sufficient; do not
rely only on the compact research's summarized comparison where a question
remains open.
For serious references record:

```text
Project
Commit / release inspected
Exact file / module / class / function
Relevant behavior
License
What Museum Editor can reuse / adapt / study
What must not be transplanted
```

Reference status must be rechecked at planning time. The compact artifact itself
preserves unresolved evidence such as an uncertain Pascal Editor license and
conflicting snap-angle examples; those must not become plan facts without
verification.

GPL or otherwise restrictive references can still be valuable UX/algorithm study
material, but exact code reuse must be license-compatible.

---

# P24B study tracks — directional, not implementation increments

The following B0–B6 labels are **research/planning tracks** inside this umbrella.
They are not approved implementation slices and do not create tickets by their
presence here.

## B0 — Existing Stage capability audit + reference reconciliation

Audit the current Stage surface before defining new scope.

Minimum audit coverage:

- Scene selection and ordered multi-selection;
- active/primary selection semantics and viewport/Outliner synchronization;
- single TransformControls host, Scene adapter, pivot math and canonical/legacy-frame
  conversion;
- current transform modes, snapping, cancellation, Inspector synchronization and
  history coalescing;
- duplicate semantics;
- flat cluster/group model and hierarchy UI;
- floor placement, ghost, grounding and Keep on Floor;
- asset-library placement entry points;
- current Scene material schema, resolver, Inspector and runtime rendering;
- current Scene light schema, creation, renderer, selection/pick proxy, Inspector,
  transform behavior and visitor rendering;
- current Outliner/Unified Project Tree behavior at representative scene density;
- editor-only versus visitor-authored visibility/state boundaries;
- current P22/P24A asset-resolution implications.

B0 should produce the capability maturity matrix and the exact questions that
later B tracks must answer. It should **not** introduce a new generic Stage command
framework merely to organize the audit.

## B1 — Transform + arrangement maturity study

Preserve the one TransformControls authority and investigate whether the existing
experience needs targeted depth in areas such as:

- Local vs World gizmo orientation while keeping the canonical transform storage
  and coordinate model accepted through P23 unchanged;
- bounded pivot options beyond the current Active Object behavior, especially a
  Selection Center if useful;
- active/primary selection visual clarity;
- transform-handle discoverability and camera-distance readability;
- axis/plane manipulation quality;
- numeric Inspector ↔ gizmo synchronization;
- snap discoverability and visual feedback;
- cancellation and no-op semantics;
- alignment operations;
- distribution/equal-spacing operations;
- duplicate productivity improvements such as duplicate-then-move or modifier
  drag if evidence supports them;
- group/cluster UX improvements without silently introducing nested transform
  hierarchy;
- Outliner improvements required for richer staging.

Public TransformControls color and handle-visibility APIs are preferred
implementation primitives for already-selected capabilities, where supported by
the dependency baseline selected at freeze. They do not independently expand the
P24 minimum. The palette traversal is a substitution candidate; negative-tip
customization, shared host, adapters, snapping and gesture/history lifecycle remain.
Native Object3D pivot is an optional implementation experiment, not a new authored
pivot model or a replacement for multi-selection pivot math.

### Architecture guardrails

- Local/World, if adopted, is **gizmo orientation**, not a new storage coordinate
  model.
- Multi-entity operations must compute in an explicit common/world frame and
  convert through a legacy room frame only where the document requires it, without
  inferring a new owner from position.
- Alignment/distribution should become deterministic semantic Scene operations,
  not one-off UI calculations.
- One user action remains one Scene history result.
- Existing flat `SceneObjectCluster` semantics are not replaced by Three.js
  parenting merely because mature DCC tools expose nested groups.

## B2 — Placement + replacement maturity study

Audit the existing floor-placement/ghost system first, then investigate depth such
as:

- current floor-placement usability and visual feedback;
- viewport drag from the asset picker as a client of the existing placement
  pipeline;
- selected-instance **asset replacement** while preserving intended placement;
- wall placement for art, signage, screens, sconces and shelves;
- bounded support/surface placement on known tables, plinths, cabinets or shelves;
- placement snapping and support visualization;
- replacement behavior across different normalized pivots/bounds;
- P24A placement metadata and normalized dimensions/pivots as inputs.

The study must compare one-time placement against persistent support references.
The default hypothesis is to prefer **one-time semantic placement** first so a
Scene object does not acquire an unplanned durable dependency on a Layout wall or
another Scene object. Persistent wall/support relationships require their own
delete/move/history/cross-document contract before approval.

Do not treat arbitrary triangle raycasts as semantic support merely because a ray
hits a mesh.

## B3 — Material authoring maturity study

Treat the current material system as a baseline, not a placeholder to replace.
Audit:

- `MaterialDefinition` / static material catalogue behavior;
- `SceneMaterialInstance` identity and shared-vs-unique semantics;
- material assignment and Make Unique flow;
- base textures, roughness and metalness overrides;
- existing texture-resolution/runtime material path;
- current physical tile-size metadata;
- multi-selection material workflows;
- imported P24A material definitions/textures;
- replacement compatibility;
- editor/visitor rendering parity.

Directly compare mature material editors and configurators before deciding the
minimum authoring surface. Candidate depth to evaluate includes:

- better material/preset discovery;
- base color/tint override;
- PBR-map-backed definitions from P24A;
- physical texture scale where the existing mapping path can support it without
  becoming a UV editor;
- Apply Material to a multi-selection;
- clearer shared/unique material feedback and preview behavior.

Do **not** assume P24B minimum needs arbitrary GLB internal material-slot editing,
UV editing, shader graphs, texture painting, node materials or arbitrary texture
transforms. Those introduce asset-node identity and DCC-level complexity and must
be separately justified.

## B4 — Lighting authoring + environment system study

Existing Point / Spot / Directional Scene entities are a **technical baseline,
not evidence that lighting authoring is complete**.

Before any B4 implementation plan is frozen, inspect the Museum Editor light
pipeline end-to-end:

- `SceneLightEntity` types, codec and validation;
- creation/mutator/history paths;
- editor and visitor `EntityLight` rendering;
- Inspector behavior;
- selection and current pick-proxy behavior;
- existing transform/gizmo integration;
- how Spot/Directional rotation currently produces direction;
- Scene Plan visibility/selection possibilities;
- renderer exposure, tone mapping, environment/IBL ownership;
- shadow defaults, costs and visitor behavior.

Then inspect mature reference implementations directly only for concrete unresolved questions, especially relevant
lighting/environment modules in:

- Three.js Editor;
- BabylonJS Editor / Inspector;
- Godot 3D editor;
- Blender;
- PlayCanvas Editor/engine tooling where inspectable;
- other high-value references identified by Phase 4.

The study must answer, rather than assume:

### Light authoring UX

- How should Point, Spot and Directional sources be represented in the editor?
- Should selected Point lights expose range visualization?
- Should Spot lights expose direction, cone/range and direct-manipulation handles?
- Can any direct direction/cone manipulation compose with the existing
  TransformControls/operation system instead of creating a second light gizmo
  authority?
- Should Directional receive equal first-class UX investment or remain a lower
  priority for indoor exhibition/showroom use?
- Should the current numeric Spot angle be presented in degrees while remaining
  canonically stored in the existing representation?

Native light-helper geometry is a preferred implementation primitive for
already-selected capabilities, not an independent expansion of the P24 minimum.
Keep helpers editor-only and operations under Museum's existing gizmo/history
ownership. PointLightHelper is not a range volume; unlimited Spot lights require
bounded editor presentation.

### Units and authoring semantics

- Preserve current intensity values and direct renderer mapping; document the
  actual units per supported light (point/spot: candela). Accurate labels do not
  require a new lumen-conversion workflow or photometric authoring system.
- Canonical spot angle is the renderer's half-angle in radians. Degree presentation
  must identify half-angle versus full aperture. Reconcile validation with the
  supported maximum half-angle of π/2 and explicitly handle existing values above
  that range; never silently reinterpret or clamp saved data. The current π limit
  is an existing mismatch, not an upgrade regression.
- Is color temperature useful enough for the first mature lighting surface?
- Which details are semantic Scene truth versus renderer implementation?

### Environment / HDRI

**Ratified architecture; minimum inclusion remains R9:** If authored environment enters the P24 minimum, its semantic model is global Scene-level intent: asset reference, lighting intensity, Y rotation, background mode and optionally authored exposure.

Native Three Scene environment/background controls and PMREM provide the rendering
primitives; custom IBL shaders are not required. Threlte already supplies AgX tone
mapping and sRGB output. Tone-mapping choice remains system-owned, initially
preserving AgX; per-room environment blending remains follow-up. This closes the
global-versus-per-room architecture question, not the inclusion or schema gate.

P24A supplies asset identity/bytes; P24B owns any authored Scene intent. Exact schema,
optional exposure inclusion, asset resolution, lifecycle and editor/visitor parity
must be reconciled together before implementation freeze. PMREM and future GI data
remain derived renderer resources, never authored Scene truth. Scoped caches,
reference counts and asynchronous cancellation remain necessary; Object3D disposal
does not replace them.

### Shadows and performance

Study safe defaults for:

- which lights cast shadows by default;
- point/spot/directional shadow cost;
- shadow-map resolution;
- bias/normal-bias policies;
- warnings versus hard limits;
- editor and cold-visitor parity.

Most low-level renderer controls should remain system-owned unless real authoring
value justifies exposing them.

### Presets

Study at least one reusable lighting/environment preset such as a neutral gallery
setup. Prefer a preset operation that creates/updates ordinary Scene
lights/environment state over a new persistent `LightingRig` hierarchy unless a
real durable-rig use case is demonstrated.

For a selected authored preset, explicitly define how the fixed ambient/directional
baseline and editor assist lighting interact with it, avoiding hidden extra light.
Preserve legacy appearance through an explicit compatibility policy.

B4 should end with a dedicated visual/interaction acceptance fixture for selected
capabilities, not merely schema tests: representative room, mixed materials,
multiple light types and, if selected by R9, HDRI/environment. Verify editor handles,
Inspector synchronization, authored output and visitor isolation.

## B5 — Unified staging UX / visual polish study

After B1–B4 identify actual depth, specify a bounded presentation pass that makes
the resulting Stage capability coherent rather than technically present.

Study visual treatment for:

- primary versus secondary multi-selection;
- Local/World and pivot state if adopted;
- alignment/distribution preview;
- snap winners and support targets;
- floor/wall/surface placement ghosts;
- valid versus invalid placement;
- group/cluster selection and bounds;
- light source markers, Spot cones, direction indicators and range helpers;
- material shared/unique state and material previews;
- environment status;
- Outliner/Inspector coordination;
- representative scene density and all shipped editor themes.

Presentation remains derived editor state. Do not persist gizmo/helper geometry or
UI-only handles into `SceneDocument`.

## B6 — Integration / implementation-brief gate study

Only after B0–B5 have enough evidence should the owner register an implementation-
ready P24B contract.

That later contract should prove one coherent authored flow, directionally:

```text
P24A normalized asset
→ browse / place
→ transform / arrange
→ replace
→ material
→ light
→ environment
→ Save
→ Load
→ Preview
→ Publish
→ cold visitor
```

The exact operations and acceptance criteria remain TBD until the studies above
close their open questions. Environment architecture is ratified conditionally;
its appearance in this directional flow does not settle R9 minimum inclusion.

P24 remains WebGL-first with Svelte 5 and Threlte. The Three version is a conditional
dependency baseline selected at implementation freeze, not a pin to r186. Record
and pass the renderer/dependency acceptance gate for the selected baseline; if it
changes, additionally compare against the current baseline for visual output,
editor interactions, visitor parity, assets, resource lifetimes and performance.
Capabilities already available do not wait for an upgrade; newer APIs require an
accepted compatible baseline before use. Harvest §F supplies test dimensions;
its numerical thresholds are proposed budgets to calibrate on named fixtures and
devices, not automatically ratified criteria. See reconciliation R9 for the gate.

The visitor must reproduce canonical authored Scene/material/light/environment
state without editor-only systems such as TransformControls, selection stores,
placement ghosts, light helpers, Inspectors or P24A acquisition tooling.

---

# Likely research dispositions — not yet scope commitments

Phase 4 plus the live-code review already suggests several guardrails worth
preserving while deeper study continues:

### Preserve / audit for maturity

- ordered multi-selection;
- one TransformControls host/adapters;
- canonical transform ownership with explicit legacy room-frame compatibility;
- flat cluster semantics, with coordinate/room constraints rechecked post-F0;
- existing duplicate/history model;
- floor placement/grounding pipeline;
- current material-instance architecture;
- current Scene light entity architecture;
- existing Outliner/Inspector authority.

### Strong candidates to study for P24B depth

- Local/World gizmo orientation;
- Selection Center pivot in addition to Active Object;
- align/distribute;
- selected-instance asset replacement;
- wall placement and bounded support placement;
- viewport asset drag as another client of canonical placement;
- richer material preset/PBR/physical-scale/multi-apply UX;
- materially deeper lighting authoring UX;
- editor-only light visualization/direct manipulation;
- HDRI/environment/exposure authoring;
- one reusable lighting/environment preset;
- unified staging visual polish.

### Follow-up / evidence-gated candidates

- box selection;
- editor visibility/lock semantics;
- persistent wall/support relationships;
- nested or cross-room grouping;
- copy/paste across room/project boundaries;
- advanced material-slot editing;
- color-temperature workflows if not selected for the first mature lighting set;
- advanced shadow controls;
- arrays/components;
- richer procedural staging fixtures.

Three-specific experiments (probe GI, SunLight, native pivot) and need-driven
optimization benchmarks remain non-blocking depth tails. WebGPU migration,
clustered lighting, SSGI/VXGI, splats and progressive streaming belong to a later
renderer/asset platform decision. None becomes a P25 prerequisite. Three scene
serialization, replacement navigation/selection systems and HTMLTexture replacing
P25's semantic DOM Info Panel are not P24 implementation directions.

### DCC / wrong-product boundary

Do not pull the following into P24 merely because reference editors support them:

- arbitrary mesh topology editing;
- sculpting;
- UV editor / texture painting;
- shader/node graph;
- general modifier stack / CSG modeling;
- physics authoring;
- keyframe animation editor / rigging;
- particle/VFX authoring;
- general-purpose game-engine level-design systems.

These remain external-DCC or separately evidence-gated territory.

---

# Material/environment boundary between A and B

The split remains:

```text
P24A
material / texture / HDRI bytes + metadata + normalized reusable definition
        ↓
P24B
assign / edit / override / light / environment semantic Scene operations
        ↓
SceneDocument + project asset references
        ↓
visitor-safe runtime
```

P24A can therefore continue expanding the catalogue while P24B studies/implements
Stage behavior. P24B must not depend on harvesting the entire Phase 2 inventory
before useful staging can ship.

---

# P24A / P24B sequencing — directional only

The research suggests partial overlap may be possible, but **this umbrella does not
schedule implementation yet**.

Directionally:

```text
P24A asset/provenance/normalization contracts
        │
        ├──────────────┐
        │              │
        ↓              ↓
P24B current-capability audits   P24B transform/light baseline studies
        │              │
        └──────┬───────┘
               ↓
P24A model/material/HDRI identities become concrete
               ↓
P24B replacement/material/environment planning can freeze
               ↓
implementation-ready P24A/P24B slices registered
               ↓
combined P24 minimum gate
```

No implementation agent should infer from this diagram that B1 or B4 may start
without checking the then-current dependency state.

---

# Minimum gate before P25

P25 Experience Foundation should wait for the **accepted useful minimum from P24**,
not optional asset-catalogue or DCC-depth tails.

P24A's current annex gives a candidate bounded supply/ingest minimum, but the
**combined P24 gate is frozen in R9**; its implementation and acceptance remain open.

A future combined gate is expected to prove enough Stage depth to:

- use a representative normalized P24A asset set;
- place/revise/replace assets efficiently;
- materially differentiate the scene;
- author credible lighting intent and, if selected by R9, environment intent;
- Save/Load/Preview/Publish that state;
- cold-boot the resulting visitor without editor-only authoring systems.

The exact P24B features that satisfy this gate must come from the later audits and
implementation brief. P25 must not wait for hundreds of assets, marketplace/store
workflows, nested components, advanced material graphs, IES/baked/volumetric
lighting, animation/rigging, mesh editing or other DCC-class tails.

---

# Shared architecture invariants

Both P24A and P24B must preserve:

- frozen visitor/editor isolation and P22 cold-visitor bundle boundaries;
- one project asset registry and one asset-resolution path;
- separate `LayoutDocument` and `SceneDocument` ownership;
- canonical Scene transform ownership and P23 coordinate contracts, with explicit
  legacy room-frame compatibility rather than a permanent room-local constraint;
- deterministic selection and one chronological history model;
- one existing transform/gizmo authority rather than a parallel staging/light
  gizmo system;
- one camera graph/navigation/motion system, untouched by staging depth;
- Scene Plan Arrange as a bounded 2D client of eligible Scene operations, not a
  second Scene state model;
- Svelte 5 runes and current Threlte patterns;
- authored project state as serializable semantic data, never persisted Three
  objects, GPU resources, DOM nodes, Svelte component state or generated runtime
  handles.

Durable staged objects, authored materials/overrides, lights and any eventual
Scene-level environment properties remain `SceneDocument`-owned according to the
project model. `LayoutDocument` architecture does not migrate into Scene because
P24 gains richer 3D controls.

When a P24B operation consults Layout geometry for placement, the plan must state
whether that reference is transient calculation or durable cross-document
semantics. No mixed Layout/Scene transaction or persistent cross-document support
reference is introduced casually.

---

# Planning / registration rule

P24 remains one registered **umbrella** roadmap tier. `P24A` and `P24B` remain
internal scope labels rather than tracker numbers.

### Progressive-planning migration accounting (2026-09-08 restructure)

Classification of existing detail under the umbrella → evidence → child-plan
model. Nothing was discarded or moved merely to shorten this document:

| Existing detail | Old location | New owner | Class | Notes |
|---|---|---|---|---|
| Outcome, why-split, A/B ownership boundary, material/environment boundary, minimum gate before P25, shared architecture invariants | this umbrella | this umbrella | umbrella contract | durable; unchanged |
| Phase 2 research basis + P24A accepted direction list | §Research basis / §P24A | this umbrella (contract) + P24A annex (implementation) | umbrella contract + child seed | annex already held the implementation detail |
| P24A.0–P24A.6 slice definitions, readiness-pass seam list, reference verification rules, acceptance gate, deferred scope | P24A annex | P24A annex (child seed) | child seed | status updated to `seed — evidence pending` |
| B0–B6 study definitions, maturity-audit matrix, live-baseline authority list, reference-study requirements, directional dispositions, sequencing diagram | this umbrella | this umbrella | evidence gates (RESEARCH GATES are umbrella-owned) | these define the evidence, not the implementation; P24B child brief gets implementation detail after B0–B5 close |
| DCC/wrong-product boundary, follow-up candidates | this umbrella | this umbrella | umbrella contract / deferred | unchanged |

Explicitly deferred: P24B child-plan seeds (B1–B5 topics) — created only when
the corresponding study closes and produces reconcilable implementation
decisions. Creating them now would be speculative filename-filling.

Current detail state:

```text
P24A — Phase 2 research reviewed; linked planning annex exists; implementation not started
P24B — Phase 4 compact research reviewed directionally; deeper code/reference studies required; no implementation brief registered
P24  — umbrella only; combined minimum/P25 gate not frozen
```

Next planning steps:

1. retain the Phase 2 research files and P24A annex as the P24A planning basis;
2. run B0 against the then-current live Scene/editor implementation;
3. for B1–B5, directly inspect mature reference implementations and exact public
   source modules only for concrete unresolved questions, rather than relying only on the compact Phase 4 comparison;
4. build the capability maturity matrix and record evidence-backed
   KEEP/POLISH/DEEPEN/FOLLOW-UP/REJECT decisions;
5. pay special attention to the current bare-bones lighting authoring experience,
   material depth, transform/selection maturity, placement usability, grouping
   UX and Outliner/Inspector scale rather than assuming “shipped = finished”;
6. reconcile P24A identities with P24B replacement/material/environment needs;
7. only then write/register an implementation-ready P24B annex/brief;
8. only after both subtracks have concrete implementation contracts, pin actual
   sequencing/parallelism and the combined P24 minimum that unlocks P25;
9. keep optional catalogue/DCC depth as separately registered evidence-led
   follow-up work.

Until those studies close, this umbrella is a **decision framework and research
map**, not authorization to implement B0–B6 as numbered delivery slices.
