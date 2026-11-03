# Native modeling freedom and semantic architecture

**Research proposal only · 2026-11-03 · owner review (do not merge as production authority)**

Prepared against `main` at `535e4bd1`. Research proposal only: no experiment code, prototype implementation, schema selection, contract ratification or roadmap authorization is included in this change.

**Goal of this proposal:** define a bounded, high-signal feasibility experiment that tests how SketchUp-like direct modeling freedom (freely modeling a table, vitrine or stepped counter without furniture-specific generators) can coexist with retained, revisable source and Biskiq's semantic architecture ([`@portfolio/layout-core`](../../packages/layout-core/src/layout-geometry.ts)), where an Opening understands its host Wall while a Scene object never becomes a Layout entity.

---

## 1. The unresolved problem and what prior work already answers

Biskiq sits between two well-known failure modes:

- **The Generator Trap (current trajectory risk):** each new form capability is added as a specialized parametric generator (`extrude`, `revolve`, `sweep`, `roof`, `walk`, or single-body genus-0 slice `reshape`). Revision guarantees stay strong inside each generator's lane, **but** any everyday object whose topology crosses that lane—a four-legged table with an apron, a wall-hung vitrine with a recessed cavity, a slotted frame, or a stepped alcove counter—is either impossible or demands yet another bespoke generator.
- **The Soup Trap (classic SketchUp failure mode):** collapsing everything into one mutable face/edge mesh (`Push/Pull` on split faces plus sticky edges) makes first-pass modeling effortless, **but** destroys two things Biskiq cannot give up:
  1. **Intra-object revisability:** widening a `1.2 m` table to `2.0 m` stretches `60 mm × 60 mm` legs into `100 mm × 60 mm` planks unless manually box-selected, and changing an earlier recess depth or outline requires rebuilding.
  2. **Architectural intelligence:** a window cut becomes dead faces rather than a portal-validated `LayoutWallOpening`, while touching furniture either fuses into walls or stays blindly stranded when walls move.

### 1.1 What existing code and research already answer

We should not repeat work the repository has already proven or falsified:

| Evidence source | What is already established (do not re-prove) | What remains unresolved |
| --- | --- | --- |
| **Shipped `T5.P01` & `geometry-core`** ([P01 README](../../docs/roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/README.md), [`profile.ts`](../../packages/geometry-core/src/profile.ts), [`extrude.ts`](../../packages/geometry-core/src/extrude.ts), [`scene.ts`](../../packages/project-model/src/scene.ts)) | Cross-browser deterministic 2D contour validation (`robust-predicates` + `earcut`), quadratic smooth corners, linear extrusion on `'plan' \| 'elevation'`, `FormMesh.regions` (`0` base, `1` top, `2 + i` side) + `segmentKeys`, and detached `My Objects` source copies. | Single outer contour only (`earcut` holes disabled; collinear split vertices rejected); two world-aligned planes only; per-axis [`SceneFormSource`](../../packages/project-model/src/scene.ts) `scale: Vec3` only; no multi-part assembly, holes, cuts or arbitrary face frames. |
| **Shipped `layout-core` & `F.1–F.5`** ([`layout-geometry.ts`](../../packages/layout-core/src/layout-geometry.ts), [`layout-floor-support.ts`](../../packages/layout-core/src/layout-floor-support.ts), [`support.ts`](../../packages/project-model/src/scene-planning/support.ts), [`unit-resolution.ts`](../../packages/project-model/src/references/unit-resolution.ts)) | Wall-first compilation (`Junctions`, line/cubic-chain `Walls`, analytic `Openings` with portal checks, `reconcileRooms`, [`layout-wall-noding.ts`](../../packages/layout-core/src/layout-wall-noding.ts) split lineage, captured non-recycling IDs) and [`composition-execution.md`](../../docs/reference/composition-execution.md) `F.1–F.5` envelopes. | `CompiledQueryPolygon` emits `'room-floor'` **only**; Wall side faces and junction surfaces expose no addressable surface frames to Scene; `F.1` unit resolvers currently refuse non-null `componentId`; [`operations.ts`](../../packages/project-model/src/scene-planning/operations.ts) bakes world `position`/`rotation` at commit time, so Wall moves/splits/deletes leave Scene objects stranded. |
| **`native-form-lab`** ([`FINDINGS.md`](../../prototypes/native-form-lab/FINDINGS.md)) | Keyed `extrude` / `revolve` / `sweep` closed solids, convex corner rounding, role-keyed paint broadcast on segment split, revolve cap birth/retirement (`270° → 360° → 270°`), and planar-role child `HostLink` transport with explicit `'unresolved'` fallback at `lastFrame`. | Still locked to single-contour generators; cannot cut recesses, punch interior holes, coordinate non-uniform multi-part resize, or couple to [`@portfolio/layout-core`](../../packages/layout-core/src/layout-geometry.ts). |
| **`native-object-shaping` & `native-object-creation-ux`** ([`UX-SPEC.md`](../../prototypes/native-object-shaping/UX-SPEC.md), [UX proposal](../native-object-creation-ux/PROPOSAL.md)) | Progressive-depth **Object Focus** scope journey (`World → Edit object → Focus → Back to World`) and orthogonal cross-section contour deformation (`reshape`, `keep`) on a single genus-0 body. | Fixed genus-0 single-body topology cannot produce legs, open frames, slots or cavities; UX proposal explicitly leaves part/boolean geometry operations and storage open. |
| **`object-composition-prototype` & `p2-smart-wall`** ([`HANDOFF.md`](../../prototypes/object-composition-prototype/HANDOFF.md), [`p2-smart-wall`](../../prototypes/p2-smart-wall/README.md)) | UX semantics for parametric wall-mount (`hangPose`, Opening AABB refusal), wall-move propagation vs unattached pass-through warning, wall-delete `setdown` vs `broken` repair, and ID-only library revision correspondence. | Simulated on a 1-parameter gallery bay (`backZ`) and procedural Three.js boxes/cylinders—not wired to real `compileWallFirstLayoutGeometry`, Wall splits/curves, or editable native geometry. |
| **`p3-depth` & `native-creative-depth`** ([`DESIGN.md`](../../prototypes/p3-depth/DESIGN.md), [synthesis](../native-creative-depth/synthesis-and-direction.md), [identity/perf](../native-creative-depth/geometry-identity-and-performance.md), [proof agenda](../native-creative-depth/proof-agenda.md)) | CSG-free Layout-side compound roofs and walking-line stairs/rails; licensing clearance ([G0 ratification](../../docs/reference/decisions/t5-g0-ratification-2026-10-27.md)) admitting permissive (`manifold-3d`, Clipper2) and weak-copyleft candidates after compliance review. | Does not test general Scene object modeling, boolean face-provenance survival under upstream edits, or live Scene ↔ Layout surface coupling. |
| **Withdrawn `E0` & `living-drawing`** ([`e0-execution-plan.md`](../../docs/roadmap/t5-expressive-geometry/e0-execution-plan.md), [`living-drawing`](../../prototypes/living-drawing/README.md)) | Negative controls: `E0`'s shared floor guide converged with explicit controls and was withdrawn ([planning record](../../docs/reference/decisions/t5-object-focus-planning-2026-10-27.md)); `living-drawing` retreated to built-ins only and pushed niches into walls. | Confirms we must test **real geometric/semantic mechanics**, not UI control relocation or built-in-only subsets. |

### 1.2 The precise three-way frontier

No existing code or prototype tests the intersection where all four brief questions meet:

1. **Minimal general modeling beyond single-contour generators (Q1):** What smallest set of face-local modeling and part-composition primitives lets a creator build arbitrary multi-part and `genus > 0` / recessed objects (table, vitrine, slotted frame, stepped bench) without object-type schemas?
2. **Direct editing + revisable source & honest resize (Q2):** When a creator draws on faces to push/pull parts or cuts and later widens the object or edits an upstream contour, what representation preserves part proportions (e.g., square table legs, fixed vitrine border) and surface roles without exposing a parametric CAD constraint solver—and when must correspondence explicitly go `unresolved`?
3. **Architectural interaction without domain fusion (Q3):** How does a freely modeled Scene object consume compiled [`@portfolio/layout-core`](../../packages/layout-core/src/layout-geometry.ts) Wall/Opening/Room surfaces across *ephemeral snap*, *persistent surface mount*, and *alcove span fit*—reacting deterministically to Wall moves, Wall splits, Wall deletions and Opening collisions while keeping [`architecture.md`](../../docs/reference/architecture.md) and [`scene-content.md`](../../docs/reference/components/scene-content.md) authorities strictly separate?
4. **Pre-commitment technical proofs (Q4):** Which representations, provenance trackers, and Layout surface read queries hold up empirically under edit/revision cycles and Biskiq's Worker/bundle limits before committing `T5.P02+`?

---

## 2. Recommended experiment, framing challenges and alternatives considered

### 2.1 Challenging three tempting assumptions

1. **Challenge to [`umbrella-plan.md`](../../docs/roadmap/t5-expressive-geometry/umbrella-plan.md) §5 ("generator + linear `operations[]` replay"):**
   Adding `revolve` and `sweep` to `extrude` + genus-0 slice `reshape` still cannot model a four-legged table or a recessed display case. Moreover, assuming an `operations[]` list replays cleanly in object space after upstream outline edits already conflicts with [`UX-SPEC.md`](../../prototypes/native-object-shaping/UX-SPEC.md) §11.1 ("do not replay an original extrusion over subsequent work") and becomes fragile as soon as inward cuts, interior holes or multi-part joints reference earlier faces.
2. **Challenge to [`living-drawing`](../../prototypes/living-drawing/README.md) ("native = built-ins; furniture = GLB"):**
   Outsourcing tables and casework to static GLBs forfeits native creative freedom, while carving niches into walls violates `Layout` vs `Scene` separation ([`north-star.md`](../../docs/reference/north-star.md)).
3. **Challenge to "SketchUp freedom requires a single sticky B-rep soup":**
   What makes SketchUp feel liberating is the **action grammar**—*pick any planar face, sketch a closed loop or split line on it, push/pull out or in, and duplicate/align parts in space*—not the destructive merging of all geometry into one unsemantic mesh. Whether that grammar is better backed by **structured parts + face-hosted push/pull features** or by **in-place polyhedral face-splitting** is an empirical question this experiment should settle directly.

### 2.2 Recommended experiment: a two-layer durable feasibility prototype

We propose a bounded, self-contained prototype under [`prototypes/`](../../prototypes/README.md) (working name: `native-modeling-freedom`) built in **two coupled layers**:

#### Layer 1 — Headless representation shootout (reproducible Vitest corpus)

Run the **exact same creation, resize and upstream-revision scripts** across a baseline control and two competing general modeling representations:

- **Control `M0` (Current trajectory baseline):** single-loop extrusion + per-axis `Vec3` scale + naive operation replay. Serves as the sensitivity control demonstrating where legs shear/stretch and topological cuts fail.
- **Candidate `M1` — Structured Direct Modeling (Multi-Part Assembly + Face-Hosted Push/Pull Add/Cut):**
  - An object begins as one extruded body and grows on demand into a local assembly of **parts**, without any furniture schema.
  - Generalized profile kernel admits **arbitrary orthonormal 3D face `Frame`s**, **interior contour holes**, and **collinear split points** on straight edges.
  - Sketching on any planar face (`SourceRoleKey`) supports **Push outward as joined feature or distinct child part** and **Push inward as cavity/cut** (evaluated through Worker-isolated `manifold-3d` WASM booleans mapping `originalID` / `faceID` back to `SourceRoleKey`, with a zero-WASM planar hole-extrude fast path when a cut passes cleanly through a prism).
  - Whole-object non-uniform resize uses **three purely geometric part-anchoring modes** (no `"leg"`/`"apron"` semantics, no general constraint solver): `proportional` (scales with bounds), `face-offset` (preserves part cross-section while maintaining corner/edge inset on its host face—keeping table legs `60 mm × 60 mm`), and `face-span` (stretches along the span axis between two opposing planes while preserving thickness—keeping aprons and shelves honest).
- **Candidate `M2` — Stateful Polyhedral / Cell Solid (SketchUp-style Face Split + Offset):**
  - An object is a single mutable polyhedral manifold where drawing a loop or splitting segment on a planar face subdivides that face in place, and `Push/Pull` offsets the target sub-face along its normal (merging coplanar neighbors and splitting side quads directly, without retaining a constructive feature tree).
  - Tests how far face-provenance tags + spatial kept-slab heuristics (`keep` planes / 9-slice style bounds) can go on non-uniform resize and subsequent edits **before** the absence of retained source blocks revision (e.g., changing recess depth after border edits, or resizing angled/multi-part assemblies).

#### Layer 2 — Minimal interactive spatial workbench (Svelte 5 + Threlte + real `@portfolio/layout-core`)

A stripped-down single-page 3D + active-face drawing workbench wired to **real `compileWallFirstLayoutGeometry`** through a thin, read-only **`LayoutSurfaceQuery`** adapter (zero edits to `@portfolio/layout-core` source; zero Scene concepts inside Layout).

`LayoutSurfaceQuery` derives from `CompiledLayoutGeometry`:
- Addressable planar/curved **Wall side surface frames** `(wallId, side: 'left' | 'right', s, y)` and room floor/ceiling planes.
- **Solid-span vs `CompiledOpening` clearance intervals** along each Wall.
- **Lineage forwarding** across [`layout-wall-noding.ts`](../../packages/layout-core/src/layout-wall-noding.ts) Wall splits (`W → W, W2` at offset `d`) and dissolves.

Inside one compact gallery corner (**3 `LayoutWall`s forming an alcove + 1 movable `LayoutWallOpening`**), the workbench exercises **three discriminating scenarios**:

1. **Scenario 1 — The Free Table (tests Q1, Q2, Q4):**
   Sketch a tabletop, flip/pick its underside face, sketch one `60 mm × 60 mm` leg, push/pull it to `720 mm`, duplicate/mirror to four corners, add spanning aprons or a `12 mm` recessed tray cut into the top—using zero `"table"` concepts. Then drag overall **Width `1.2 m → 2.0 m`**, edit a tabletop edge/corner, and revise the tray recess depth, toggling live between `M0`, `M1` and `M2`.
2. **Scenario 2 — Wall-Hung Recessed Vitrine vs Architectural Window (tests Q1, Q3, Q4):**
   Model a hollow/stepped wall vitrine via inward face push/pull and mount it to a `LayoutWall` side frame alongside a real `LayoutWallOpening` (`window`/`door`). Perform three live architectural edits:
   - **Move / rotate the Wall:** Opening moves with the Wall and cuts `CompiledPhysicalWall.sections`; Vitrine's Scene world pose re-evaluates cleanly from its host frame without cutting or mutating Layout.
   - **Split the Wall (`planWallSplit`):** Vitrine rebases deterministically onto `W` or `W2` using split lineage (just as Openings do, without becoming a Layout record).
   - **Slide the Window into the Vitrine's footprint:** Opening continues to cut the Wall normally; Vitrine never fuses or gets boolean-carved by the Wall, instead entering an explicit **`conflict: overlaps-opening`** repair state (`Slide clear` / `Detach in place`).
3. **Scenario 3 — Alcove Stepped Counter / Bench (tests Q2, Q3, Q4):**
   Fit a stepped counter across the 3-wall alcove in two selectable Scene relationship modes:
   - **Mode A — Ephemeral snap (solve-once default):** architectural faces guide creation/snapping only; moving a flanking Wall leaves the counter at its world-local pose and surfaces passive overlap feedback (`Overlaps Wall`), proving no SketchUp sticky-edge fusion.
   - **Mode B — Bounded alcove span-host:** counter anchors its left/right span between the two facing Wall surface frames; widening the alcove stretches spanning parts while keeping end-panel thicknesses fixed (`M1`), and deleting a flanking Wall transitions cleanly to **`unresolved-host`** frozen at the last accepted world pose.

### 2.3 Alternatives considered

| Option | Strengths | Why not selected as the primary design |
| --- | --- | --- |
| **1. Headless geometry & Layout test suite only (non-interactive)** | Fastest build; deterministic pass/fail metrics on `M1` vs `M2` and `LayoutSurfaceQuery`. | Cannot validate whether direct face-sketch + push/pull + explicit anchor/host states remain spatially legible during live manipulation. Retained as **Layer 1** (and can be gated first; see §7). |
| **2. Heavy B-rep CAD kernel (`opencascade.js` ~4.9 MiB br LGPL-2.1) + 2D sketch constraint solver** | Industrial fillets, NURBS intersections, full parametric sketch constraints. | Massive Worker/WASM footprint, LGPL-2.1 compliance overhead, and CAD-constraint UX friction—disproportionate before testing whether polygonal/manifold solids (`manifold-3d` ~172 KiB br Apache-2.0 + prism fast path) cover Biskiq's creative ceiling. |
| **3. Extend single-body genus-0 slice `reshape` (`T5.P02`) only** | Zero boolean kernel; smooth organic tapers and waists. | Topologically incapable of multi-leg furniture, through-openings, frames, or sharp joinery recesses (`genus > 0`). Orthogonal complement to `M1`/`M2`, not a substitute. |
| **4. Unified Layout + Scene boolean solid graph (`living-drawing` niche style)** | One CSG pipeline cuts walls and objects alike. | **Rejected outright:** creates a second architectural compiler, breaks `F.2` unit isolation, leaks heavy CSG into Layout/visitor paths, and makes deleting Scene furniture mutate Room/Wall topology. |
| **5. Full Stage / Object Focus UI prototype** | High visual fidelity to production shell. | Spends ~80% of effort recreating camera/dock/card chrome already specified in [`UX-SPEC.md`](../../prototypes/native-object-shaping/UX-SPEC.md) and [UX proposal](../native-object-creation-ux/PROPOSAL.md) rather than testing geometry and cross-domain revision. |
| **6. Recommended: Layer 1 (`M0`/`M1`/`M2` corpus) + Layer 2 (3-scenario `layout-core` workbench)** | Directly adjudicates representation choice, source revisability, and real `layout-core` coupling with minimal UI scaffolding. | **Selected.** |

---

## 3. Real, simplified and simulated boundaries

To keep the evidence trustworthy for T5 planning, every subsystem has an explicit fidelity contract:

| Subsystem | Tier | Exact behavior in the experiment |
| --- | --- | --- |
| **Architectural compilation, Wall moves/splits & Openings** | **Real** | Imports [`@portfolio/layout-core`](../../packages/layout-core/src/layout-geometry.ts) directly (`compileWallFirstLayoutGeometry`, `LayoutWallOpening`, Wall split/move operations, `queryFloorSupports`). Zero toy wall math. |
| **`LayoutSurfaceQuery` (Wall side frames & Opening intervals)** | **Real** | Pure read-only derivation over `CompiledLayoutGeometry` computing orthonormal `(wallId, side, s, y)` frames, solid-span intervals, and split-lineage rebasing. |
| **`M1` & `M2` solid evaluation, holes & boolean cuts** | **Real** | Closed 2-manifold triangle meshes verified for `0` boundary edges, `0` non-manifold edges, consistent winding, and positive volume; real Worker-capable `manifold-3d` evaluation + `faceID → SourceRoleKey` provenance table vs planar hole-extrude fast path. |
| **Non-uniform resize & upstream contour/depth revision** | **Real** | Real geometric re-evaluation across `M0`, `M1` (`proportional` / `face-offset` / `face-span`), and `M2` (cell offset + spatial slab tags), including role-paint survival and explicit `unresolved` diagnostics. |
| **Face sketching & part manipulation UX** | **Simplified** | Click-polygon + rectangle + circle + numeric offset/depth inputs on any picked planar face, plus simple duplicate/mirror and wall-drag handles. No freehand stroke beautification or full Object Focus shell chrome. |
| **Curved-wall hosting** | **Simplified** | Evaluated in Layer 1 corpus (tangent frame along `cubic-chain` Wall); Layer 2 interactive workbench uses straight 3-wall alcove + Opening for clarity. |
| **Persistence, Undo stack, Camera/Experience & UV polish** | **Simulated / Stubbed** | In-memory JSON fixture snapshots + simple command history for scenario reset/step-back; flat/role-tinted materials with simple planar UVs; zero `ProjectEnvelope` codec migrations, Camera routes or visitor runtime wiring. |

---

## 4. Minimum implementation scope and explicit exclusions

### Minimum scope (if greenlit after review)

1. **Self-contained prototype package** under [`prototypes/`](../../prototypes/README.md) (not an npm workspace; imports `@portfolio/layout-core` and `@portfolio/geometry-core` via read-only relative/file resolution or local Vite alias without editing `packages/*`).
2. **Layer 1 deterministic corpus (`vitest`):**
   - Generalized 2D face-frame profile helper (outer loop + inner hole loops + collinear split vertices).
   - `M1` evaluator (multi-part assembly + face-hosted extrude/cut + `manifold-3d` provenance + 3 geometric resize anchor modes).
   - `M2` evaluator (planar face-loop split + normal push/pull cell mutation + spatial resize heuristic).
   - `LayoutSurfaceQuery` over compiled `LayoutDocumentWallFirst` fixtures (Wall move, Wall length change, Wall split, Wall delete, Opening slide, curved-wall tangent frame).
   - Machine-readable `evidence.json` + assertion suite recording pass/fail, triangle/manifold health, provenance retention, and p50/p95 timings.
3. **Layer 2 interactive workbench (`vite` + Svelte 5 + Threlte):**
   - Single viewport with scenario switcher (**1: Free Table**, **2: Vitrine vs Window**, **3: Alcove Counter**), representation toggle (`M0 | M1 | M2`), active-face sketch/push-pull tool, dimension/wall/opening drag handles, and an live **Invariant & Provenance Inspector** overlay showing manifold status, `SourceRoleKey` survival, and `Layout ↔ Scene` relationship state (`world-local`, `hosted`, `span-fit`, `conflict: overlaps-opening`, `unresolved-host`).

### Explicit exclusions (out of scope)

- Production schema or codec edits in `packages/project-model/`, `packages/layout-core/`, or `packages/geometry-core/`.
- Full Stage / Object Focus UI chrome, World Index, Card styling, or freehand curve fitting.
- 3D B-rep edge fillets/chamfers across boolean seams, lofted NURBS surfaces, or clay/voxel sculpting.
- Full 2D/3D parametric sketch constraint solvers (coincident/tangent/angle equation graphs).
- Multi-level stairs, roofs ([`p3-depth`](../../prototypes/p3-depth/DESIGN.md)), imported GLB mesh editing, textures/PBR look-dev, Camera paths, or Experience playback.

---

## 5. Evaluation criteria, falsifiers and architectural implications

### 5.1 Quantitative and behavioral pass/fail gates

| Dimension | Pass criterion | Falsifier (what disproves a candidate) |
| --- | --- | --- |
| **1. Expressive freedom without object generators (Q1)** | All 4 benchmark shapes (**4-legged apron table**, **hollowed wall vitrine**, **stepped alcove counter**, **slotted open frame**) are built from the same minimal primitives (`face sketch`, `push/pull add/cut`, `duplicate/align`), yielding valid closed 2-manifolds (`0` open/non-manifold edges, `signedVolume > 0`). | Any benchmark requires an object-specific generator or produces non-manifold / inverted shells on valid inputs. |
| **2. Non-uniform resize & source revision honesty (Q2)** | Widening the `1.2 m` table to `2.0 m` keeps `60 mm × 60 mm` legs square and apron thickness constant; editing tabletop outline or vitrine recess depth preserves unaffected `SourceRoleKey` paint regions and marks `100%` of invalidated face hosts/cuts as explicit `unresolved` (`0` silent jumps to wrong faces). | Legs shear or stretch into planks; upstream outline or recess-depth edits require deleting downstream work; or `faceID` provenance silently swaps material/attachment roles across coplanar splits. |
| **3. Semantic architecture boundary (Q3)** | `0` Scene imports or mutations in `@portfolio/layout-core`; `LayoutWallOpening` cuts `CompiledPhysicalWall` while hosted Vitrine/Counter never alters Layout geometry; Wall move & `planWallSplit` preserve hosted alignment; Window intrusion triggers `conflict: overlaps-opening`; Wall deletion freezes world pose as `unresolved-host`; default solve-once objects stay independent on Wall move. | Supporting wall/alcove objects requires special-casing Scene inside `layout-core`, causes sticky-edge fusion on unattached contact, or loses host alignment on straight Wall move/split. |
| **4. Performance & bundle viability (Q4)** | Non-boolean / prism-fast-path drag preview `< 8 ms` p95; Worker `manifold-3d` boolean commit `< 25 ms` p95 on multi-cut furniture (`≤ 20` parts/cuts); serialized mesh derivative proves visitor runtime needs `0 B` of boolean WASM (`Stage` is already under `439.0 KiB br` exception pressure; visitor cap is `≤ 250 KiB br`). | Interactive push/pull stalls main thread `> 16 ms`, coplanar boolean degeneracies require brittle epsilon tuning, or delivery requires shipping WASM CSG to visitors. |

### 5.2 How outcomes map to T5 / T1 / F architecture

- **If `M1` passes Gates 1–4 and decisively beats `M2` on resize/revision (primary hypothesis):**
  - `T5` shifts away from an unbounded single-body `operations[]` replay stack toward **lightweight multi-part assemblies + planar face-hosted `extrude/cut` features + geometric anchor pins**, while keeping `T5.P02` genus-0 slice `reshape` as an optional deformer on individual parts rather than the sole path to depth.
  - `manifold-3d` stays **lazy, authoring-only, and Worker-isolated**, while `@portfolio/geometry-core` extends cleanly with inner-hole contours, collinear split anchors, and 3D `Frame` extrusion (covering ~80% of cases without WASM).
  - Visitor/public delivery (`ExecutionProgram` / Scene release payloads) consumes **immutable evaluated `FormMesh` buffers** (`AGENTS.md` Rule 3), preserving the `≤ 250 KiB br` visitor cap.
- **If `M2` matches `M1` on common edits and `M1`'s part/feature boundaries feel rigid during interactive chaining:**
  - `T5` adopts a **bounded polyhedral cell solid** as the leaf body representation, using `M1`'s multi-part assembly + geometric pins only between distinct parts (legs vs top) rather than for intra-body steps/recesses.
- **If `manifold-3d` provenance fragments on coplanar face cuts:**
  - Restrict cuts in early T5 to **planar prism through-holes and bounded pocket extrusions** synthesized directly in `@portfolio/geometry-core` (exact 2D polygon clipping + prism stitch, zero 3D general CSG) until provenance-stable boolean splitting is proven.
- **Implications for `T1` and `F.1`:**
  - Validates the exact minimal shape of a read-only **`LayoutSurfaceQuery`** in `@portfolio/layout-core` (what `T1` actually needs to expose for Wall/Ceiling/Alcove surfaces) and clarifies what `componentId` / surface sub-reference contract [`unit-resolution.ts`](../../packages/project-model/src/references/unit-resolution.ts) must admit for cross-unit `Scene → Layout` hosting.

---

## 6. Retaining and consuming the evidence in T5 planning

If approved for execution, the experiment should be built once and kept as **durable, executable non-authoritative evidence**:

1. **Repository placement & isolation:**
   - Lives in its own self-contained folder under [`prototypes/`](../../prototypes/README.md) with its own `package.json`, `README.md`, `FINDINGS.md`, `evidence.json`, and `vitest` suite—outside root npm workspaces (`apps/*`, `packages/*`), so experimental dependencies (`manifold-3d`) never enter production `package-lock.json` or bundle gates.
2. **Consumption under governance rules currently in force:**
   - Per `AGENTS.md` Rules 2, 9 and 10 and [`docs/README.md`](../../docs/README.md), prototype code and `FINDINGS.md` are **evidence, never contract authority**.
   - Consuming the results into `T5` (`T5.P02` / `T5.P03`), `T1` (Layout surface queries), or `F.1` (`SemanticReference` component resolution) happens through explicit owner decision + the **bounded replanning** procedure in [`docs/operations/README.md`](../../docs/operations/README.md), leaving landed [`scene-content.md`](../../docs/reference/components/scene-content.md) and [`architecture.md`](../../docs/reference/architecture.md) untouched until their implementation cutovers.
3. **Compatibility with PR #259's proposed lean workflow (distinguishing proposal from active rules):**
   - PR #259 (currently an unmerged proposal, **not** an active rule) proposes replacing slice/phase ceremony with a `capabilities.json` ledger, Risk Tiers `0–2`, and GitHub flags (`needs-research` for bounded decision-exit spikes, `needs-decision`, `needs-ux`).
   - Structuring this prototype around **explicit pass/fail gates, `evidence.json`, and a concrete `M1` vs `M2` + `LayoutSurfaceQuery` decision exit** makes it natively compatible with both regimes: under current rules it feeds `T5` bounded replanning cleanly; if PR #259 is adopted, it closes a `needs-research` spike directly into a `needs-decision` capability record with zero rework.

---

## 7. Unresolved questions requiring owner judgment

Before (or upon) authorizing execution of the experiment, five product and sequencing judgments belong with the owner:

1. **Target freedom ceiling for native Scene objects:**
   Should Biskiq's general object modeling target **architectural & furniture solids/joinery** (planar/extruded/revolved/swept parts, holes, pockets, steps, spans — `M1` territory) or **arbitrary polyhedral/CAD topology** (tilting individual faces in 3D, arbitrary non-planar splits, 3D boolean seam fillets — `M2` / B-rep territory)?
2. **Non-uniform resize expectation on freely modeled assemblies:**
   When a creator widens a freely modeled multi-part object (such as a table) in World without semantic types, should Biskiq **infer geometric behavior by default** (e.g., narrow corner-inset vertical parts default to `face-offset` so legs stay square, overridable per part) or **scale everything proportionally (`M0`) unless the creator explicitly pins parts in Focus**?
3. **Default relationship when sketching a Scene object directly on a Wall or Alcove:**
   Should drawing a new Scene object directly on a `LayoutWall` face default to **ephemeral solve-once alignment** (safe world-local Scene object; explicit `Attach to wall` opt-in) or **persistent Wall-surface attachment** by default?
4. **Two-stage execution gate vs single prototype pass:**
   Do you want to run **Layer 1 (headless `M0`/`M1`/`M2` + `manifold-3d` provenance + `LayoutSurfaceQuery` corpus)** first as a fast falsification gate before building **Layer 2 (the interactive 3-scenario Svelte/Threlte workbench)**, or build both layers together in one pass?
5. **Authoring-only booleans vs runtime parametric delivery:**
   Are you comfortable treating boolean/compound evaluation as **authoring-time source evaluation** whose published visitor artifact is an immutable derived `FormMesh` (`AGENTS.md` Rule 3, keeping `0 B` of boolean WASM out of visitor chunks), or must visitor runtimes dynamically re-evaluate parametric boolean cuts?
