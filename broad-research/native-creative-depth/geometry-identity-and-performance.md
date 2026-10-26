# Geometry, identity and performance for native form

**Research date:** 25 October 2026  
**Status:** Research evidence, local disposable probes and inference. No architecture ratification, production implementation, dependency adoption, or roadmap release.  
**Package:** [Native creative depth](./README.md) · labels follow the package's [evidence conventions](./README.md#3-how-to-read-the-evidence)

This document asks which representation, evaluators and identity rules would let Biskiq offer native form creation on an ordinary laptop browser, within current contracts. It covers 3D form operations, and so extends the [geometry-library harvest](../geometry-library-harvest.md#5-recommendation-matrix-reconciled-2026-10-22), which covered 2D roof-footprint work. It also extends the original study's [§8](../spatial-modeling-depth-research-2026-10-25.md#8-the-most-useful-architectural-direction) and [§9](../spatial-modeling-depth-research-2026-10-25.md#9-geometry-technology-compare-responsibility-and-cost).

> **About the local measurements.** Figures marked *probe* were measured on 25 October 2026 for this research only, by disposable scripts on an Apple M2 with 16 GB RAM running Node 26.7 (V8). After peer review they were re-run, and the wall comparison was replaced by a **matched** probe: every route produces the same meshed, copied-out output, with validity checks. [Probe methods](./probe-methods.md) holds the method, the scripts verbatim, the raw output and the limitations. Node is close to Chrome but is not a browser. Safari, Firefox and 8 GB laptops will differ. No script or package was added to the repository, and no dependency was adopted. Treat the figures as relative costs on one fixture and orders of magnitude, to be re-measured by the [proof agenda](./proof-agenda.md#p6-evaluator-placement-and-the-kernel-question). They are not evidence for or against any gate.

## 1. Findings in brief

1. **I** **The required representation is authored intent with analytic curves**: profiles, carriers, rules and parameters. Tessellation should happen late, inside derivatives that can be thrown away. Generated geometry is already excluded from authored truth ([North Star](../../docs/reference/north-star.md#permanent-non-goals)). A kernel's main advantage, exact persisted topology, is therefore largely beside the point for Biskiq.
2. **O, probe** **The core curve constructions the creator evidence asks for are cheap in plain JavaScript:**
   - a double-reflection rotation-minimizing sweep along a helix (about 96,000 triangles): 0.83 ms median;
   - a ruled strip between two helical polylines with unequal sample counts: 0.19 ms;
   - a 100 × 100 Coons patch: 0.20 ms.

   These figures cover **positions (and sweep indices) only**. They exclude normals, UVs, caps, validation and GPU upload, and their bit-identical results were checked within one process only. They show the mathematics is not the cost. They do not show a finished family fits a budget.
3. **O, probe** **On identical output, construction beats general booleans within each library, and the library matters as much as the language.** All routes below produce the same meshed wall with 40 openings, copied out to JavaScript ([probe methods §4](./probe-methods.md#4-results-the-matched-40-opening-wall)).

   | Route | p50 | Valid closed mesh |
   | --- | --- | --- |
   | three.js `ExtrudeGeometry`, plain JavaScript | 0.77 ms | **No**: 160 open edges (T-junctions) |
   | Manifold extrusion with holes | 1.29 ms | Yes |
   | Manifold, 40 sequential or one batch boolean | 3.5–3.7 ms | Yes |
   | OCCT extrusion with holes, meshed | 120 ms | Yes |
   | OCCT, one batch or 40 sequential cuts, meshed | 199–717 ms | Yes |

   **I** Three narrower lessons replace the first revision's "orders of magnitude" headline, which compared unlike routes:
   - the operation chosen moves cost about threefold in Manifold and sixfold in OCCT;
   - at a matched operation Manifold was 50–200 times faster than OCCT on this fixture;
   - plain JavaScript was not faster than WASM by default, and its output was not closed.
4. **O, probe** **Biskiq's production wall path is the relevant hot path, and it is already in TypeScript.** Compiling and meshing one wall with 40 Openings took 3.3 ms p50 straight with rectangular heads and 9.3 ms p50 curved with rounded heads. Meshing rounded heads dominates; compiling takes about 1 ms. Its output is far richer than the kernel routes: normals, metric UVs, reveals and a role-tagged pick partition. **I** A single wall this dense lies outside the [budget fixtures](../../docs/reference/components/performance.md#budgets), so this is not a budget verdict. It locates where evaluation cost concentrates, on dense, arched hosts, and the levers are algorithmic: evaluate only the changed host, choose arch tessellation density, label a preview level of detail. That path belongs to [S06](../../docs/roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/implementation-plan.md).
5. **O** **Only one 3D solid kernel is permissive, maintained, small and robust:** Manifold (`manifold-3d` 3.5.4, Apache-2.0).
   - Its WASM core is 155 KiB brotli, plus 17 KiB of glue (*probe*, matching [npm](https://registry.npmjs.org/manifold-3d)). Initialization took 6–17 ms across runs.
   - It is single-threaded, and it reports which input each output triangle came from ([Manifold](https://github.com/elalish/manifold)).
   - **Blocked:** every OCCT path is LGPL-2.1 and so fails current admission. OCCT's WASM is 4,895 KiB brotli, about 19.6 times the whole visitor first-load budget.
   - **Immature:** Truck (Apache-2.0) is the only permissive B-rep option. It has no npm build, and its fillet and offset are unreleased.
6. **I** **No evidence gathered here meets the Rust/WASM gate, and none rules it out.**
   - The [technology gate](../../docs/reference/north-star.md#technology-gates) requires an isolated CPU bottleneck *and* a boundary-inclusive proof.
   - No purpose-built Rust/WASM module was measured, nothing ran in a browser, and only one Biskiq hot path was probed.
   - The one Biskiq path measured is TypeScript at a few milliseconds per dense wall, with algorithmic levers not yet used.
   - Manifold is already C++ compiled to WASM, so "WASM or not" is the wrong framing. The open question is whether a purpose-built module ever beats a well-structured TypeScript evaluator after boundary costs.

   **R** Schedule no custom Rust/WASM work on this evidence. That is a statement about the evidence, not a forecast.
7. **O** **No kernel reliably reports its own failures:**
   - Manifold issue #1888 (open) loses volume while returning `NoError` on near-coincident inputs ([issue](https://github.com/elalish/manifold/issues/1888)).
   - A replicad/OCCT issue produces silently empty booleans that report success ([replicad #272](https://github.com/sgenoud/replicad/issues/272)).

   **I** Whatever evaluates booleans needs an independent post-condition validator that turns failure into Biskiq's typed refusal.
8. **I** **Identity can be designed rather than recovered.** Generators can name their outputs by *role*, derived from persisted authored keys, for example the start cap, `side(segment k)`, or `member(slot n)`.
   - This avoids FreeCAD's topological-naming problem for bounded families.
   - It fits the ratified rule that owners publish correspondence and consumers never infer it by name, order or proximity ([architecture](../../docs/reference/architecture.md#product-convergence-destination)).
   - Mesh provenance (Manifold's input and face IDs) is needed only inside boolean steps.
   - **O** **Production already does this at surface granularity.** The wall mesher's `Layout3dTriangleRef` gives every triangle exactly one pick owner. The owner is keyed by Room, wall segment and surface role (`side`, `lintel`, `bridge`), or by Opening and surface role (`jamb`, `sill`, `lintel`, `arch-reveal`), never by triangle order ([`wall-mesh-builder.ts`](../../apps/editor/src/lib/layout/wall-mesh-builder.ts)).
9. **O** **Most practice gets by with coarse identity.**
   - CAD users are taught to reference datum planes rather than generated faces.
   - BIM identity is per element.
   - Manifold carries materials per input mesh.

   **I** Role groups (for example "all sides", "the start cap") should be the default granularity. Single-role targeting should come only on explicit selection.

## 2. Representation

| Layer | What it holds | Evidence | Recommendation (**R**) |
| --- | --- | --- | --- |
| Authored intent | Profiles (2D, with stable point keys and crease or round flags), carriers (paths, host frames), rules (count, spacing, frame mode, corner policy), parameters | Vellum's `Overhead` already stores a profile of `{u, h, crease, id}` points with stable identity across edits ([`prototypes/p3-vellum/src/model/types.ts`](../../prototypes/p3-vellum/src/model/types.ts)) | The family's source. Small and versionable |
| Analytic evaluation | Arcs, cubic chains, helices, arc-length parameterization, 2D offsets | Production Walls are lines or cubic chains, with an arc-length tolerance of 1e-6 m ([`packages/layout-core/src/layout-geometry-curve.ts`](../../packages/layout-core/src/layout-geometry-curve.ts)) | Exact where possible; precision declared against coordinate range and local frame |
| Derived geometry | Triangles, normals, UVs, role tables, provenance tables | Generated geometry is never authored truth | Disposable; regenerated deterministically; cached by source key |
| Display and interaction | Instance buffers, level-of-detail tessellation, hit ranges mapped to roles | The production wall mesh carries `pickRanges`, a sorted partition of the index buffer in which every triangle has one role-tagged owner ([`wall-mesh-builder.ts`](../../apps/editor/src/lib/layout/wall-mesh-builder.ts); [assessment §1](../procedural-architectural-authoring-assessment.md#1-executive-verdict)) | Faithful to source; never a writer |

**I** **Host-local frames carry more weight than any kernel.** A Wall already has an exact (s, z) frame, and Openings are cut in it. The same idea extends to other hosts:

- a roof plane's local section (Vellum's Edit shape);
- a stair's walking-line frame;
- a room boundary's offset frame for trim;
- a Shape's own outline plane.

Drawing, measuring, texturing and hosting all become 2D problems in an exact frame. This is why a curved-wall window is a solved *geometric* problem in Biskiq's compiler and a hard one in SketchUp. The creator *workflow* for it does not exist yet: Opening authoring is not wired to the editor, and curved hosts are outside every planned slice ([synthesis §2](./synthesis-and-direction.md#2-status-ledger-what-exists-by-kind-of-evidence)).

**I** **Store analytic curves and tessellate by level of detail.** Representational failures M9 to M11 ([creator evidence §6](./creator-evidence.md#6-twelve-recurring-mechanisms)) disappear when the user never sees segment counts.

## 3. Operation feasibility

**Licence.** The column applies the current admission rule ([licensing direction](../../docs/reference/decisions/post-batch-e-authorization-2026-10-23.md#licensing-direction)). That rule names MIT, BSD, ISC, Apache-2.0 and Zlib as examples. BSL-1.0 (Clipper2) and the Unlicense (robust-predicates) are permissive. They are not named in the examples, so a released lane would record them explicitly.

**Sources.** Timings marked *probe* are local, as described above. Licences were checked against package or repository licence files.

| Operation | Creator need it serves | Plain TS? | Candidate admissible library | Blocked or immature options | Verdict (**I**) |
| --- | --- | --- | --- | --- | --- |
| Extrude with holes | Plinths, platforms, panels, walls with openings | Yes; 40 holes in 0.77 ms with three.js, but with T-junctions, against 1.29 ms closed with Manifold (*probe*, [matched](./probe-methods.md#4-results-the-matched-40-opening-wall)) | Manifold `CrossSection.extrude`; three.js `ExtrudeGeometry` (MIT), whose earcut caps need T-junction-free triangulation before any validator | — | Native; first family |
| Revolve, full or partial | Columns, vessels, lamps, turned legs | Yes | Manifold revolve; three.js `LatheGeometry` | — | Native; near-first |
| Sweep along a 2D or 3D path, with frame mode | Rails, trim, pipes, edges | Yes; 0.83 ms for positions and indices (*probe*) using the double reflection method ([Wang et al. 2008](https://www.microsoft.com/en-us/research/publication/computation-rotation-minimizing-frames/)) | Own code. three.js frames use second-order rotation and `acos`, which is fine for display | OCCT pipe shell (LGPL) | Native. Refuse in words when the profile radius exceeds the local curvature radius |
| Ruled strip between two carriers | Spiral-rail infill, soffits, canopy edges | Yes; 0.19 ms for positions (*probe*) | Own code; Truck `homotopy` has no npm build | — | Native within families. Anchor the arc-length pairing at authored stations |
| Loft between two or three profiles | Square-to-round tapers, transitions | Yes for single-contour profiles. Correspondence is the real work: corners first, then arc length, then the seam rotation | three.js `LoftGeometry` (added June 2026, equal counts only) | OCCT ThruSections (LGPL) | Gated. Refuse when hole counts differ unless the user supplies correspondence |
| Coons patch, four-sided | Canopies, shade sails | Yes; 0.20 ms for positions (*probe*) | Own code | OCCT GeomFill (LGPL) | Bounded native candidate |
| Gordon surface (curve network) | Freeform networks | Medium-hard | Reference only: TiGL is Apache-2.0 but depends on OCCT | — | Specialist |
| 2D offset of polylines and arcs | Trim offsets, reveals, insets, thickness | Yes | Clipper2 (BSL-1.0) as a TypeScript port or WASM; @flatten-js/core (MIT) | — | Native. Wide leverage beyond roofs |
| Profile-corner rounding and chamfer | Rounded edges on any profile family | Yes; analytic arcs before extrusion | Own code; Clipper2 round joins | — | **Native baseline** |
| Rounded rim between cap and side | Soft-edged plinths, tabletops | Yes, by insetting profiles at several heights ("bevel-extrude") | Clipper2 | — | Native. Refuse when the radius exceeds half the minimum feature width |
| 3D fillet across arbitrary faces | Fabrication-grade blends | No | — | OCCT 15–38 ms p50 and fragile (*probe*; [replicad #241](https://github.com/sgenoud/replicad/issues/241)); Truck unreleased | Out of scope |
| Visual rounding only | Presentation softness | Yes | Manifold `smoothOut`/`refine` (about 0.7 ms, *probe*); a shader normal bevel | — | Optional display polish. Never offered as geometry |
| Mesh or solid booleans | Cutting found objects, custom voids | Not robustly | Manifold, in a worker with a validator | three-bvh-csg breaks on coplanar cases and left 3,856 open edges on the 40-opening wall; JSCAD took 14–16 s on a 32k-polygon sphere; Cherchi bundles LGPL predicates; CGAL and libigl are GPL or MPL | Gated. Prefer host-local cuts and families |
| Shell or hollow of an arbitrary solid | Hollowed objects | No | Manifold `levelSet` (approximate) | OCCT shell (LGPL) | Out of scope |
| Arrays along curves | Balusters, slats, flutes, lights | Yes; rotation-minimizing frames plus instancing | three.js instancing (MIT) | — | Native |
| Subdivision with creases | Soft goods, cushions | Yes; about 500 lines | three-subdivide (MIT) | OpenSubdiv (TOST-1.0, unclear) | Bounded candidate, for example a cushion "puff" |
| Text and SVG outlines to profiles | Signage, logos, reliefs | Yes; flatten, node, apply the fill rule | opentype.js, svg-pathdata (MIT); Clipper2 | — | Native |
| Signed distance or implicit forms | Soft sculptural props | Small grids only | Manifold `levelSet` (gyroid in 19.5 ms, *probe*) | libfive (MPL/GPL) | Unproven niche |
| STEP and 3dm interchange | Specialist import | n/a | Truck `stepio` (Apache-2.0) | OCCT (LGPL); rhino3dm embeds openNURBS, whose licence is not a recognized permissive grant | Specialist or extension |

**I** **Three operations need a heavy kernel:** general solid booleans, shells and true 3D fillets. All three can be scoped down or refused without blocking the ordinary creator tasks in the [creator evidence](./creator-evidence.md). Booleans have one admissible library to compare against. Shells and 3D fillets do not.

## 4. TypeScript, Rust/WASM and specialized kernels

| Option | Evidence | Fit (**I**) |
| --- | --- | --- |
| **Domain generators in TypeScript** | Sub-millisecond probes for the curve mathematics of sweep, ruled and Coons constructions (positions only). The production wall compiler and mesher took 3.3–9.3 ms p50 for one wall with 40 Openings, with complete output ([probe methods](./probe-methods.md#4-results-the-matched-40-opening-wall)). Determinism depends on avoiding `Math.sin`, `cos` and `atan2` in identity-relevant paths: ECMAScript specifies them as "implementation-approximated", while `Math.sqrt` is correctly rounded ([ECMA-262](https://tc39.es/ecma262/#sec-math.sin)) | **Default.** Owns intent, correspondence, refusal and host frames |
| **Manifold, lazily loaded in a worker** | Apache-2.0. 172 KiB brotli for core plus glue (*probe*); a requested core-only package is still open ([#1902](https://github.com/elalish/manifold/issues/1902)). Single-threaded, so no cross-origin isolation is needed. Objects need explicit `delete()`. A 131,000-triangle union took 130 ms (*probe*), beyond the drag budget | **The one kernel worth a spike**, for explicit booleans on Scene objects. Use a proxy preview while dragging and run the boolean on commit, with the validator |
| **Custom Rust/WASM module** | **Not measured.** No purpose-built module was compared with a TypeScript evaluator on the same job. Boundary costs were measured: transferring a 4.2 MiB result to a worker takes 0.02–0.03 ms, a structured-clone copy 0.8–1.4 ms, and copying a 185,000-triangle mesh out of a WASM heap about 3 ms (*probe*) | **Not established either way.** The gate is unmet, so schedule nothing. Candidate hot paths for a gate-quality proof: opening-dense arched hosts, large distributions and picking, each after its algorithmic levers are used |
| **Threaded WASM** | Needs `SharedArrayBuffer`, and therefore COOP/COEP headers. Under COEP, cross-origin assets and embeds must opt in ([web.dev](https://web.dev/articles/coop-coep)) | **Avoid.** It would constrain visitor pages and third-party assets |
| **WebGPU compute for geometry** | No deterministic geometry kernel found. WGSL is float32, and atomics are nondeterministic | Display effects only, for example deforming instances along a curve |
| **OCCT and wrappers** | LGPL-2.1; the wrapper's MIT licence does not change the licence of the WASM it loads. 4,895 KiB brotli; 92–221 ms to initialize after download across runs. WASM heap length read 100 MiB after initialization and 1,073 MiB after 40 sequential cuts. That is reserved linear memory, which never shrinks, not live use. The roughly 200 KB leaked per fuse is reported in [replicad #282](https://github.com/sgenoud/replicad/issues/282), not measured here. Stable opencascade.js release dates from 2020 | **Blocked**, and also a poor fit on size and memory. Useful only as a non-shipped reference |
| **Truck** | Apache-2.0 Rust B-rep with booleans; released crates date from September 2024; no npm or WASM artifact; fillet and offset unreleased ([repo](https://github.com/ricosjp/truck)) | Unknown. A spike only if fabrication-grade B-rep becomes a product need |
| **Commercial kernels (Parasolid, ACIS, C3D)** | Shapr3D and Plasticity ship Parasolid in native apps. Onshape is listed as a Parasolid cloud customer ([Siemens](https://www.siemens.com/en-us/products/plm-components/parasolid/)). No client-side browser shipment found | Not available to a permissive, local-first browser product |

**R** **Where computation runs:**

- **Kernels stay in the editor.** Load any kernel lazily and never in visitor first-load JS (budget ≤250 KiB brotli).
- **Visitors get compiled results.** Deliver compiled derivatives to the visitor runtime. The North Star permits immutable, reproducible delivery derivatives outside authored documents. Alternatively, regenerate with small TypeScript evaluators where the family is cheap. Runtime-safe domain evaluators are already shared with visitor runtimes; visitor isolation concerns editor machinery, not domain math ([AGENTS rule 4](../../AGENTS.md)).
- **Workers transfer, never copy.** Run kernels in a dedicated worker and transfer result buffers.
- **Late results are discarded.** Cancel stale work; a late result never overwrites a newer revision. The original study already requires this in [§9](../spatial-modeling-depth-research-2026-10-25.md#what-a-kernel-comparison-must-include).
- **Drag previews stay truthful.** They use the cheaper domain path, never an approximation the commit would contradict, as [§8.4](../spatial-modeling-depth-research-2026-10-25.md#84-cheap-previews-must-remain-truthful) requires.

## 5. Identity and correspondence

### 5.1 What others do

**O** Four families of mechanism exist:

| Family | Examples | Guarantee | Failure |
| --- | --- | --- | --- |
| Naming by history | FreeCAD 1.0 element maps (released November 2024); OCCT `BRepTools_History` | Same name if the construction history is unchanged | Split order depends on the kernel; splits into more than two pieces unsolved; author's informal test showed about 30% slower recompute and 27% larger files ([algorithm wiki](https://github.com/realthunder/FreeCAD_assembly3/wiki/Topological-Naming-Algorithm)). There are 156 GitHub issues labelled toponaming, with open ones dated as late as 23 October 2026 |
| Naming by intent query | Onshape queries over operation history; loops keyed to the source entity, "not its index" ([FeatureScript](https://cad.onshape.com/FsDoc/library.html#module-query.fs)) | References re-evaluated against current history | Index-based selection is "deterministic but arbitrary"; identity ends when a face splits; mate connectors jump when results are keyed by index |
| Identity as data | Houdini `id`/`nextid`; Blender Set ID; Manifold `runOriginalID` and `faceID`; IFC GlobalId | Stable identity if assigned upstream | Blender silently falls back to the index; Revit's UniqueId may change after undoing a delete; SketchUp produced duplicate persistent IDs on cross-model copy |
| Host binding | Revit hosted and face-based families; Figma constraints | The attached object follows its host | Lost host on copy or mirror; wall-hosted families are deleted with their host; repair needs Reconcile Hosting or Pick New Host |

**O** No system examined guesses silently by design. Where FreeCAD guesses, through `getRelatedElements`, the author kept it out of fillets.

**O** In FreeCAD issue #27546 (February 2026), broken references were hard to notice, and deleting one wiped every dependent constraint. The pain has moved from naming to **repair** ([issue](https://github.com/FreeCAD/FreeCAD/issues/27546)).

### 5.2 Recommended policy

This is inference, compatible with the ratified correspondence transport.

1. **Role addresses by construction.** An address is `(family instance, role, authored keys…)`. Examples:

   | Family | Roles |
   | --- | --- |
   | Extrusion | `startCap`, `endCap`, `side(profileSegment)` |
   | Revolve | `side(profileSegment)`; start and end faces exist only below 360° |
   | Sweep | `side(profileSegment, pathSegment)` |
   | Pattern | `member(key)/…` |

   Never derive an address from triangulation or output order. Version addresses with the family contract.
2. **The profile owner publishes segment correspondence.** "Insert a point on segment *s*" publishes *s* → {*s*a, *s*b}, with a declared continuation. The family's role correspondence is then a mechanical diff:
   - preserved;
   - retired;
   - replaced (one to many, or many to one);
   - new.

   Vellum's stable profile-point IDs are the precedent.
3. **Two kinds of pattern member key:**
   - **Ordinal slots** for count-driven patterns. Lowering the count retires the highest slots. "Delete member *k*" sets a suppression flag on slot *k* and never renumbers the rest.
   - **Allocated keys that are never reused** for scattered or hand-curated patterns.
   - **Reject** position or proximity keys. They contradict the no-proximity rule.

   For patterns along a carrier, a slot key of (carrier segment, rule slot, ordinal from the nearest anchor) lets anchors pin positions against path edits, as Revit's "Break Pattern at" and Archicad's "Convert Pattern to Segment Length" do ([synthesis §4](./synthesis-and-direction.md#4-one-creative-language-profile-carrier-and-rule)).
4. **Resolution depends on the kind of reference:**
   - **Broadcast references** (material, finish, tag): on a split, they apply to all pieces; on a merge, the authored primary wins.
   - **Singular references** (attachment host, light aim, Experience anchor): they follow a one-to-one replacement. On a one-to-many split, or on retirement, they become **unresolved**. They keep their last-known pose and the candidate list, and nothing is chosen automatically.
   - **Group references** ("all sides of W") re-resolve each time and need no correspondence.
5. **Coarse defaults.** Material and attachment targets default to the object or a role group. Single-role targeting requires explicit selection. Raw face, edge and triangle targets are never offered.
6. **Booleans only:** reserve one Manifold input ID per authored element, and encode (element, role) into a face-ID table kept in TypeScript. After the operation, an output region set with more than one member is a split.

**R** **Test the premise before investing in fine-grained tracking.** Prototypes should log the granularity of every persisted reference: object, role group, single role, or sub-role. If almost all are object or role-group references, defer sub-role boolean-split tracking.

The 90% threshold proposed in the research notes is an arbitrary decision point, not a sourced number.

### 5.3 Falsification tests

These tests come from failures observed elsewhere. They are scheduled as [proof P5](./proof-agenda.md#p5-identity-through-ordinary-revision).

| Test | Expected | Falsified if |
| --- | --- | --- |
| Profile split | The split side is replaced by two; a material on it covers both; a painting on it is unresolved with its last pose | Anything retargets silently, or the painting jumps to one piece |
| Reorder, or change the start vertex | No address changes | Any address depends on order |
| Pattern count 20 → 19 → 20 | Slot 7 is untouched throughout; slot 19 behaves as decided in advance | Slot 7 changes |
| Delete member 7 of 20 | Members 8–19 keep their keys and overrides | Member 8's override moves |
| Revolve 270° ↔ 360° | End faces are retired, then new; references go unresolved | Anything reattaches by proximity |
| Boolean split | Correspondence reports one to many; materials are copied; attachments go unresolved | Coplanar auto-grouping merges roles |
| Save, reload, other browsers | Identical address sets | Triangulation or floating-point differences change an address |
| Undo and redo | Byte-identical addresses | IDs change on undo |
| Copy | New instance key; internal references re-rooted to the copy; no duplicates | Duplicate addresses appear |
| Family version change | Addresses unchanged, or a declared migration | Names change implicitly |
| Overhead | Well below FreeCAD's informal 30% | Correspondence dominates evaluation time |
| User repair | Few unresolved states per 100 edits; fast repair | Users hit unresolved states for edits they consider "obviously the same" |

## 6. Finish geometry

| Concern | Evidence | Recommendation (**R**) |
| --- | --- | --- |
| Texture coordinates | Box projection fails on curves ([Studio Matrx](https://www.studiomatrx.org/students/architectural-visualization-rendering/texturing-and-uv-mapping)). Production Walls already use metric arc-length UVs | Every family emits real-scale UVs from profile and path lengths. Extrusions use object-space box mapping. Imported UVs are respected. Per-surface offset and rotation are stored as overrides keyed by role |
| Hard and soft edges | Normals are lost across formats; extruded arcs need smoothing | Authored creases from profile corner flags; smooth normals elsewhere. Export explicit normals |
| Rounded edges | Analytic profile fillets are exact and cheap; shader bevels cost per pixel and change no silhouette | Profile rounding as geometry. Shader edge effects only as an optional style |
| Material-level detail | Textured holes cast no dappled shadow in SketchUp's native renderer ([forum](https://forums.sketchup.com/t/cutting-a-lot-of-holes-into-a-flat-face/283658)) | **H** Alpha-tested cut-out materials with depth that respects the alpha would give perforation and standee shadows cheaply. Not verified in Biskiq's renderer |
| Dense repetition | Shared geometry helps identical parts; unique edits and transparency reduce the benefit ([study §8.3](../spatial-modeling-depth-research-2026-10-25.md#83-lightweight-source-does-not-mean-free-computation)) | Instancing by default, with per-member overrides as attributes where possible |

## 7. Interchange

| Format | Direction | Library and licence (as checked by the research notes) | Admissible now? | Recommendation (**R**) |
| --- | --- | --- | --- | --- |
| glTF 2.0 / GLB with core extensions | In and out | glTF-Transform (MIT); three.js loaders (MIT) | Yes | Essential. Carry stable IDs in names or `extras`; support instancing, texture transform and variants |
| OBJ + MTL | In | three.js loader (MIT) | Yes | Essential fallback; normalize missing normals and texture paths |
| DXF | In (2D plans) | dxf-parser (MIT, stale) | Yes, with a fork risk | Essential for plan underlays |
| USDZ | Out | three.js exporter (MIT) | Yes | For mobile AR, with a restricted material profile |
| IFC | In | web-ifc (MPL-2.0) | **No.** Weak copyleft stops under the current rule | Defer, or route through an owner licensing decision. The finish-and-interchange research suggested it as optional; this package corrects that against the admission rule |
| STEP / IGES | In | occt-import-js (LGPL) | **No** | Specialist or extension territory |
| DWG | In | LibreDWG (GPL); ODA (proprietary) | **No** | The user saves as DXF |
| SKP | In | SketchUp SDK (Trimble terms; server use reportedly restricted) | Unclear | A SketchUp-side glTF export |

**R** **Re-import must be non-destructive.** Requirements:

- link by asset identity, not file path;
- per-property ownership, separating linked properties from overridden ones;
- overrides kept apart from imported geometry;
- placement stored relative to an anchor;
- a re-import diff the user reviews before applying.

These requirements are the same identity seam as generated parts.

## 8. What would falsify this technical direction

- **A kernel becomes necessary.** Plain-TypeScript generators fail determinism across browsers in identity-relevant paths, and no deterministic arithmetic is acceptable.
- **Correspondence costs too much.** Its overhead dominates evaluation on the reference laptops.
- **Booleans are the main path.** Users' ordinary tasks need booleans on found objects much more than the evidence suggests, and Manifold's validated path cannot meet commit latency or memory on 8 GB machines.
- **Coarse identity is not enough.** Reference-granularity logs show frequent sub-role references.
- **A real hotspot appears.** A measured, isolated bottleneck emerges that a WASM module removes after boundary costs. Examples: picking, evaluating thousands of distributed members, or meshing opening-dense arched hosts once incremental evaluation and tessellation density are tuned. That would satisfy the existing Rust/WASM gate rather than contradict this document.
- **Valid output costs more than it seems.** Making plain-JavaScript constructions free of T-junctions and closed, as a validator or boolean requires, erases their speed advantage over Manifold.

## 9. Gaps

- No browser measurements were made, and 8 GB behavior is extrapolated. [Probe methods §6](./probe-methods.md#6-limitations) lists every limitation of the local figures.
- No purpose-built Rust/WASM module was measured. Only one Biskiq hot path, the wall compiler and mesher, was probed, and only for one host.
- Truck was not benchmarked; Manifold's memory high-water mark was not measured.
- Whether Manifold face IDs survive smoothing and level-set operations was not tested.
- No permissive TypeScript Coons or Gordon library was found.
- Cross-browser determinism of the plain-TypeScript generators was not tested.
- No independent benchmark compares Manifold with Cherchi or EMBER on the same fixtures.
- No source quantifies what share of real references target sub-parts rather than whole objects.
