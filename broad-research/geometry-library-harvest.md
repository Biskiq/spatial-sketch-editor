# Geometry library harvest for production roofs and footprints (T1 / RR-2 input)

Status: research handoff, first written 2026-10-21 (PR #171); **reconciled in place 2026-10-22** with the
convergence decision set ([CD-4, CD-8](../docs/roadmap/product-convergence-2026-10-21.md#reconciled-decision-set-step-3)),
the RR-1/RR-2 [vertical commission](./post-p01-roadmaps/convergence-2026-10-21/vertical-and-overhead.md) and the
owner's stated copyleft model. **Not** a contract, plan, roadmap change or dependency decision; nothing here is
adopted. It gives T1 planning evidence for choosing kernels for the one canonical Layout compiler (AGENTS rules 4–6).
P3 itself stays as it is: the owner ruled that P3 does not adopt Clipper2, Manifold, a straight-skeleton solver or a
general roof engine. None of this blocks the single-datum Wall-creation batch (C1).

Evidence base:

- **Historical (2026-10-21):** P3 Vellum source at `vellum-polish` @ `f4d1c7c5` and its audit
  (`plans/roof-footprints-final-polish.md` §1, §4, §5); production `packages/layout-core` on `main` @ `cb2e96e5`;
  a scratch probe run outside the repo on Node 26.7, macOS arm64, that ran the P3 footprint fixtures through each
  library, compared them with exact oracles and bundled each library with esbuild. That script is in a shared
  session-notes folder, not the repo, so §2–§3 sizes and results are not reproducible from here.
- **Convergence (2026-10-22, reproducible):** [`probes/vertical/`](./post-p01-roadmaps/convergence-2026-10-21/probes/vertical/README.md)
  at `ce9b7156`, Node v26.7.0, Vitest 3.2.7, reading P3 and `layout-core` source without changes. Row ids such as
  `G1 plus / as-is` refer to its `results/*.json`.
- Licences: upstream licence files via the GitHub API and the projects' primary pages, rechecked 2026-10-22 (§4).
  **[unverified]** marks claims not checked.

## 1. What P3 has (and what it relies on)

| P3 piece | What it does | Precision model | Port value |
| --- | --- | --- | --- |
| `model/wings.ts` `decompose` | Rectilinear wing decomposition: an axis grid from the outline's own coordinates, cell occupancy, maximal rectangles, a **greedy largest-first cover** (≤ 4 pieces, later pieces trimmed to the unroofed remainder), each piece spanning its own short side, then a check that each inner support edge ends where its roof is the lower one. On refusal it returns `{kind:'unsupported', reason}`. | Plain doubles with absolute epsilons (`MERGE 0.02`, `1e-6`/`1e-9`); axis tolerance 2°; ≤ 16 vertices, ≤ 4 wings, ≥ 1.2 m short side. | **A candidate massing, not a reference.** Its plus/Z/wide-T roofs differ from equal-pitch L∞/skeleton massing (§3.2); which one the product wants is an owner call (CD-8). |
| `scene/build/overheads.ts` `buildCompound` | Planar upper-envelope mesher: cells split at every wing break, one plane per cell, `clipHalfPlane(diffPlane)`, region subtraction where another piece is higher, clip to the footprint. | Doubles; ±1e-9 tie-break by piece order; **region subtraction and the footprint clip call polygon-clipping**. | **High as an algorithm** for joining planar height fields; its mesh fails under rotation and far translation (§3.2), so the production version needs a declared tolerance contract. |
| `model/clip.ts` | Thin wrapper over **polygon-clipping ^0.15.7**. | **`safe()` swallows every exception and returns a fallback** (`union` → first input, `difference` → `a`, `intersection` → `[]`). | **Pattern to avoid.** Production maps a kernel *exception* to a typed refusal; a legitimately empty result stays a result. |
| `model/section.ts` | Section reading: joints and parts, family classification, preset tolerance `max(0.12, 0.035·span)`. | Doubles, `EPS_U 1e-6`, `MIN_JOINT_H 0.05`. | Medium. Domain logic; no library replaces it. |
| `model/ops.ts` `coverCheck` | One-answer qualification: chip, preview and commit call one pure function returning `{ok, reason, overhead}`. | — | **Highest.** A pattern, not a module. |
| `model/geom2d.ts` `offsetPoly` | Hand-written miter/bevel offset. | No self-intersection handling **[inferred from code, not probed]**. | Replace with a kernel offset (§5). |
| `tests/support/roofProbe.ts` (committed form of the audit `hits` probe) | Vertical ray tests of the top mesh against the height evaluator: gaps, double surfaces, max error. | Skips 5 cm at the boundary; strict interior hits. | **Consistency check only.** It shares the evaluator's assumptions; an independent oracle found faults it never exercised (§3.2). |

Production context: `layout-core` already depends on `robust-predicates` (Shewchuk adaptive `orient2d`, Unlicense)
through `layout-robust-orientation.ts`, and owns deterministic T/X noding and face extraction. So the canonical
compiler already owns an exact planar arrangement of Walls. It has no area booleans, offsets, skeleton or 3D booleans.
The visitor triangulates compiled floor/ceiling polygons with three.js `ShapeGeometry` (earcut inside three)
(`VisitorLayoutShell.svelte`).

## 2. Candidates — facts (historical sizes, 2026-10-21)

Sizes were measured in the historical scratch run: "js" is esbuild `--bundle --minify` of the named entry points
(min / gzip -9); "wasm" is the separate binary (raw / gz). Maintenance is from the GitHub API on 2026-10-21. Licences
were rechecked 2026-10-22.

| Library (version) | Licence (checked file) | js min / gz | wasm raw / gz | Init | Node | Maintenance |
| --- | --- | --- | --- | --- | --- | --- |
| [polygon-clipping](https://github.com/mfogel/polygon-clipping) 0.15.7 | MIT (`LICENSE.md`) | 29.7 / 9.8 KB | — | sync | ✓ | Last push 2024-04-19. **Effectively dormant.** |
| [polyclip-ts](https://github.com/luizbarboza/polyclip-ts) 0.16.8 (TS fork; bignumber.js) | MIT | 42.1 / 15.2 KB | — | sync | not probed | Last push 2025-11-09. |
| [Clipper2](https://github.com/AngusJohnson/Clipper2) C++ 2.0.1 | BSL-1.0 (`LICENSE`) | — | — | — | — | Active (push 2026-10-17). |
| [clipper2-ts](https://github.com/countertype/clipper2-ts) 2.0.1-18 (pure TS port) | BSL-1.0 (`LICENSE`) | 66.0 / 17.7 KB (`unionD`, `differenceD`, `intersectD`, `inflatePathsD`) | — | sync | ✓ | Push 2026-07-04, one maintainer. |
| [Clipper2-WASM](https://github.com/ErikSom/Clipper2-WASM) 0.4.0 | BSL-1.0 | 28.6 / 10.5 KB | 213.6 / 81.5 KB | async | not probed | Embind objects need manual `delete()` **[from typings]**. |
| [manifold-3d](https://github.com/elalish/manifold) 3.5.4 | Apache-2.0 (`LICENSE`) | 44.5 / 14.7 KB | 541.5 / 204.6 KB | async, 10 ms in Node | ✓ | Very active. |
| [straight-skeleton](https://github.com/StrandedKitty/straight-skeleton) 3.0.0 (CGAL → WASM) | Wrapper MIT (`LICENSE`); embeds CGAL `Straight_skeleton_2`, GPL-3.0-or-later OR commercial | 1,035 / 331 KB (wasm inlined) | inlined | async | **✗** (web-only build) | Push 2026-03-24. |
| [str8](https://github.com/matthewjacobson/str8) 0.5.0 (CGAL 6.1 → WASM) | Wrapper MIT (`LICENSE`); README: "`Straight_skeleton_2` is GPL" | 1,661 / 489 KB (1.20 MB wasm inlined) | inlined | async, 20 ms | ✓ | One release, one author. |
| [@proc-geo/core](https://www.npmjs.com/package/@proc-geo/core) 0.2.1 (pure TS skeleton) | MIT | 30.0 / 9.8 KB | — | sync | ✓ | New; simple polygons only; wrong winding **silently returns an empty skeleton** (README). |
| CGAL 6.x `Straight_skeleton_2` (C++) | `package_info/Straight_skeleton_2/license.txt`: "GPL (v3 or later)"; headers `SPDX: GPL-3.0-or-later OR LicenseRef-Commercial` | — | — | — | — | Active; commercial licences via GeometryFactory. |
| CGAL Kernel_23, Number_types, Algebraic_foundations | "LGPL (v3 or later)" (`Kernel_23/.../license.txt`; Package Overview) | — | — | — | — | — |
| CGAL Boolean_set_operations_2, Arrangement_2, Triangulation_2, Mesh_2, Polygon_mesh_processing, Nef_3 | "GPL (v3 or later)" (license files / [Package Overview](https://doc.cgal.org/latest/Manual/packages.html)) | — | — | — | — | — |
| [CDT](https://github.com/artem-ogre/CDT) (C++ constrained Delaunay) | MPL-2.0 (`LICENSE`) | not measured | — | — | — | not reviewed |
| [earcut](https://github.com/mapbox/earcut) (also inside three.js) | ISC (`LICENSE`) | not measured | — | sync | ✓ | — |

Capabilities and failure modes:

- **polygon-clipping**: Martinez–Rueda–Feito sweep with `robust-predicates`. Booleans with holes and multipolygons,
  lenient input, normalised output. **No offsetting and no snapping**: 1e-12 noise came back as 1e-12 m edges and a
  1e-9 m sliver difference was kept verbatim (historical).
- **Clipper2** (and ports): an **integer coordinate model**. `…D` APIs scale doubles by `10^precision`
  (`precision` ∈ [-8, 8], `clipper2-ts/src/Core.ts`) and round, so the snap grid is explicit. Booleans with holes
  (PolyTree), offsets (miter/round/square/bevel), Minkowski, rectangle clipping and, in 2.x, triangulation. Union
  output **keeps collinear vertices** (L: 7 vs 6; U: 10 vs 8), so normalise before identity-sensitive use.
  clipper2-ts emulates int64 in doubles with safe-product guards (`IC_maxCoordForSafeAreaProduct`); conformance to
  the C++ reference at the chosen precision and range is **[unverified]** and is part of experiment E1 (§7).
- **Straight skeleton (CGAL)**: EPICK/EPECK kernels (str8 retries with EPECK via boost `cpp_int`). Holes, positive
  multiplicative weights, exterior skeletons and offset contours. The
  [extrusion API](https://doc.cgal.org/latest/Straight_skeleton_2/group__PkgStraightSkeleton2Extrusion.html)
  `extrude_skeleton` gives a closed 2-manifold roof mesh, explicitly permits **zero weight for a vertical edge**
  (so gables are not categorically excluded), and warns of non-local self-intersections when a maximum height is
  supplied. The npm wrappers do not expose extrusion, and no gable fixture has been run. Non-simple inputs (vertex
  touching an edge, touching holes) are excluded; near-collinear vertices derail event scheduling (str8 pre-drops
  vertices within 1e-6 of collinear). Vaults, stepped sections and curved profiles are not skeleton outputs.
- **Manifold**: guaranteed-manifold 3D mesh booleans; its `CrossSection` embeds Clipper2; WASM build serial-only;
  rerun byte-identical (historical). A mesh-domain kernel: it neither produces roof surfaces nor reads plan semantics.

## 3. Measurements

### 3.1 Historical library probe (2026-10-21, scratch run, Node 26.7, macOS arm64; not rerun)

Fixtures: the P3 set from `tests/wings.test.ts` and the audit — L, unequal L (`[0,0,10,6]+[7,6,10,14]`, the
author's reading), T, U, plus; two-roof pairs crossing, L butt and T touch.

- **Footprint union.** polygon-clipping and clipper2-ts gave the exact area on all five fixtures, one ring, no
  holes, 0.15–1.9 ms.
- **Pair intersections.** Crossing gave 25 m² in both. L butt and T touch gave `[]` in both — **correct, empty
  results**: an area boolean cannot see an abutment, so adjacency needs an explicit shared-edge test on the noded
  arrangement.
- **Clipper2 offset.** A 0.45 m miter outset matched `A + P·d + 4d²` to 1.4e-14 m². A −2.6 m inset left one piece
  for L/unequal L and **none for T, U, plus — a legitimate collapse** of wings narrower than 5.2 m, not a failure.
- **str8 vs the L∞ closed form** (audit grid 0.731 × 0.673 m, 174–219 samples):

| | L | unequal L | T | U | plus |
| --- | --- | --- | --- | --- | --- |
| str8: max error vs k·L∞ | 8.9e-16 | 8.9e-16 | 1.8e-15 | 2.6e-15 | 4.4e-16 |
| str8: gaps / rerun identical / start-vertex rotation | 0 / ✓ / 0 | 0 / ✓ / 0 | 0 / ✓ / 0 | 0 / ✓ / 0 | 0 / ✓ / 0 |
| @proc-geo/core skeleton vertices (str8) | 10 (10) | 10 (10) | 12 (**13**) | 15 (**14**) | 17 (17) |

  str8 degenerate cases: a 12×12 courtyard with a 4×4 hole worked (max height 2.000); a collinear midpoint and
  1e-12 noise worked; **a hole sharing an edge with the outer ring returned `null`** with no diagnostic.
  StrandedKitty's build does not run in Node. @proc-geo/core exposes a graph, not faces, and disagrees with CGAL on
  T and U (not adjudicated).
- **Manifold.** Union of the crossing gable prisms: volume 103.333333 = 120 − 50/3, genus 0, `NoError`; L extrusion
  276 exactly; rerun byte-identical.
- Not done: P3's evaluator against these libraries, Clipper2-WASM, polyclip-ts, performance at scale.

### 3.2 Convergence measurements (2026-10-22, `probes/vertical/`, reproducible)

The identity behind the L∞ oracle holds: for an orthogonal polygon, the upper envelope of equal-pitch hips over
**all** maximal rectangles equals k·L∞-distance-to-boundary (every L∞ ball inside the polygon lies in some maximal
rectangle), and #171 reports str8 agreeing with it. **P3 does not compute that envelope.** Its greedy cover trims later
pieces and spans each on its own short side (on the plus, a 5 × 2 m stub spans z with 1 m hips). Measured with an
independent L∞ oracle on a 0.1 m grid, P3 evaluator vs k·L∞:

| Outline | Max |P3 − k·L∞| | Samples over 1e-9 m | Status |
| --- | --- | --- | --- |
| L, unequal L, T, U, single rectangle (hip control) | ≤ 1.4e-15 m | 0 | agree, also at 30°, +1000 m, reversed winding |
| plus (#171's fixture) | **1.344 m** | 1025 / 9500 | differs; identical under all transforms |
| Z | **1.651 m** | 800 / 6400 | differs |
| wide-stem T | **0.825 m** | 1400 / 11200 | differs |
| staircase; slit courtyard | — | — | P3 refuses (step validation; 5 wings). A true courtyard is unrepresentable (single outline). |

A difference from the skeleton/L∞ massing is **not automatically a defect**: P3's plus/Z massing may be the intended
product roof. The intended shape must be chosen first (owner call, CD-8); only then is the matching oracle the
acceptance reference. The old “does the greedy cover equal Chebyshev?” question is answered by these counterexamples
and is **not to be commissioned again**.

P3 mesh vs the same independent oracle (the self-oracle audit reported 0.000 m / 0 gaps):

- U rotated 30°: **13 / 495 samples fall in true holes** (not triangle-edge coincidences); evaluator exact.
- Single-span hipped 6 × 10 m rectangle translated to (1000, 1000) m: **8 of 32 triangles dropped, 1.48 m error**;
  exact at 0, 10, 100 and 300 m. P3's absolute epsilons are not scale-relative.

## 4. Fit for the canonical, runtime-safe Layout compiler

Rules that decide fit (AGENTS rules 3–6): one architectural compiler whose output editor and visitor consume;
runtime-safe evaluators shared, not forked; nothing editor-only in visitor chunks; generated geometry never authored
truth; immutable compiled derivatives permitted.

| Concern | Consequence |
| --- | --- |
| **Kernels and higher-level libraries inside the compiler** | A library — including a higher-level one such as a straight-skeleton roof or mesh-boolean package — may run **inside** the canonical compiler as the evaluator of a Layout-declared family. It does not become another authority while the compiler owns the persisted parameters, family qualification, refusal reasons, identity and correspondence, and every consumer reads the compiler's output. It would become one if it held its own persisted semantics, decided which family applies, or were consulted outside the compiler (for example, a viewer re-deriving geometry differently). |
| **Synchronous, pure, Node-runnable** | The compiler runs in the editor transaction path, in Vitest and possibly at release lowering. Pure TS fits directly. Async WASM needs a module-level initialisation gate or an async/worker compile path — a deliberate decision made only for an actual candidate. |
| **Determinism** | Compiler output feeds reconciliation and reproducible release payloads. An explicit snap grid (Clipper2) or exact predicates/kernels (`robust-predicates`, CGAL EPECK) fit; unsnapped float output is an identity hazard. |
| **Delivery placement** | The viewer consumes compiled derivatives (polygons, meshes, sections). A solver reaches the viewer only if viewer execution actually requires it (rule 4 allows shared domain evaluators, but nothing currently requires a viewer-side roof or boolean solve). Edit/compile-time kernels may run on the main thread (small, sync) or in a worker (WASM, heavy). |
| **Licence (copyleft model; not legal advice — owner/legal confirm the exact product licence)** | CGAL's GPL packages are GPL-3.0-or-later (OR commercial); its kernel/number-type packages are LGPL-3.0-or-later. They combine with a product licensed **GPL-3.0-or-later or AGPL-3.0-or-later** (GPLv3 §13 permits combining with AGPLv3), and with MIT, ISC, BSL-1.0, Unlicense, Apache-2.0 and MPL-2.0 (through MPL section 3.3) components (FSF licence list). They do **not** combine with a **GPL-2.0-only** product (FSF: GPLv2 “by itself, not compatible with GPLv3”; Apache-2.0 is also incompatible with GPLv2). GPLv3 §0: conveying is propagation that lets others “make or receive copies”; serving JS/WASM to browsers transfers a copy, so it is conveying, and corresponding-source obligations attach to the shipped build (prefer a reproducible build from upstream source over a third-party inlined binary). Network interaction without a copy is not conveying under GPL; AGPL §13 adds source offer for network users. Under this model the previous “GPL, so exclude” rule for the CGAL wrappers and packages is **withdrawn**; technical fit decides. |
| **Second-authority risk** | Unchanged in substance: what matters is who owns semantics, not how much the library does (first row). |

## 5. Recommendation matrix (reconciled 2026-10-22)

**Retain** = keep what exists; **adopt** = the preferred kernel once its experiment passes (nothing is adopted by
this document); **bounded experiment** = run before the consuming slice is planned.

| Area | Recommendation | Delivery placement | Evidence and conditions |
| --- | --- | --- | --- |
| Exact/robust predicates | **Retain** `robust-predicates` (Unlicense, already a dependency). CGAL's LGPL kernels come only with a CGAL build, never as a separate adoption. | Compile and, as today, wherever the shared evaluator runs | Already the compiler's orientation authority. |
| 2D booleans and offsets (outlines, holes, overhangs, insets, overlaps) | **Bounded experiment E1, then adopt Clipper2** — the strongest fit: snap-rounded integer model, booleans and offsets in one library, BSL-1.0. Compare the pure-TS port with an upstream C++ build (WASM) for conformance. CGAL Boolean_set_operations_2 / Arrangement_2 (exact, GPL, heavier) is the fallback only if E1 shows Clipper2 cannot meet the precision/range contract. **Avoid** polygon-clipping in production (dormant, no snapping, no offsets); polyclip-ts is not a fallback for offsets. | Compile/edit time; pure TS on the main thread, or WASM in a worker. The viewer consumes compiled polygons. | Historical exact union/offset results (§3.1); port arithmetic unverified. Not needed by the first single-span family over a rectangular footprint unless holes/overhang unions are in it. |
| Single-span profile roofs (flat/shed/gable/vault + hip) over a rectangle in the roof frame | **Adopt as the first overhead family**, implemented in the compiler; **bounded experiment E2** for qualification. | Compile; viewer gets the mesh/sections | Evaluator exact vs L∞ for the hip control in all transforms; P3's mesher failed at (1000, 1000) m, so the production mesher needs E2. |
| Compound rectilinear roofs (L/T/U/plus/Z) | **Choose the intended massing first** (CD-8). P3 wing massing: agrees with skeleton/L∞ on L/unequal L/T/U (≤ 1.4e-15 m) and **differs on plus 1.344 m, Z 1.651 m, wide-stem T 0.825 m**; its mesh had **13/495 true-hole samples on U at 30°**. Then run E2 against an oracle for that massing. Do not treat “matches the skeleton” as the criterion unless skeleton massing is chosen. | Compile | §3.2. Not in the first wave. |
| Straight skeleton (off-axis hips, courtyards, or skeleton massing for plus/Z) | **Conditional bounded experiment**, reopened only if the selected roof semantics require skeleton massing. Under the copyleft model the strongest candidate is **CGAL `Straight_skeleton_2` built from upstream source**, including `extrude_skeleton` (exact kernel, holes, weights, zero-weight vertical edges). The MIT wrappers are acceptable test oracles but expose no extrusion and one does not run in Node. Pure-TS options stay immature. Touching rings and near-collinear inputs must refuse with a reason (str8 returned `null`). | Compile time, in a worker (async WASM, 330–490 KB gz historical); never the viewer unless viewer execution requires it | WASM initialisation, delivery cost and corresponding-source build are checked only with this candidate. |
| Triangulation/meshing of compiled planar surfaces | **Retain** the current earcut path (three.js `ShapeGeometry`, ISC) for compiled floor/ceiling polygons. Inside E2, check roof facets for seams, holes and cracks in transformed coordinates. Adopt a constrained triangulation (Clipper2 2.x triangulation, CDT MPL-2.0, or CGAL constrained Delaunay GPL) only if E2 shows earcut-class triangulation fails. | Today viewer-side over compiled polygons; moving triangulation into the compiled derivative is a delivery option, not a requirement | No failure observed in production floors/ceilings; roof facets are new. |
| 3D mesh booleans (dormers, voids through pitched roofs, CSG) | **Not in scope now.** If a selected feature needs CSG, **Manifold** (Apache-2.0; guaranteed-manifold output; bundles Clipper2) is the strongest default; CGAL Polygon_mesh_processing corefinement (GPL, exact) is the alternative where exact constructions matter. Voids through height-field roofs are first tried as 2D cuts over the roof's own surface (O2). | Compile/release time or worker; viewer consumes the result | Historical exact volumes (§3.1). |
| Joins across eaves/families | **Retain the envelope approach** over an exact planar arrangement, with explicit valley/abutment/adjacency classification; abutments are found by shared-edge tests, not booleans. | Compile | §3.1 pair results. |
| Qualification and failure | **Retain `coverCheck`'s one-answer pattern** as a compiler invariant: a kernel **exception** maps to a typed refusal; a valid empty result is returned as such. Never fallback geometry. | Compile | §1 `clip.ts`. |
| Test oracles | **Retain** `roofProbe`'s ray probe as a consistency check, but every family needs an **independent** oracle (analytic planes/sections, edge incidence). A mesh compared only with its own evaluator is insufficient. | Test lane only | §3.2. |

## 6. Open questions — disposition (2026-10-22)

1. **Synchronous compiler?** *Deferred* to the first candidate that needs async WASM (skeleton or WASM Clipper2).
   Until then pure TS keeps the path synchronous; a worker path is a deliberate decision with that candidate.
2. **Does the viewer recompile roofs?** *Superseded* by the delivery rule (§4): the viewer consumes compiled
   derivatives; a solver reaches it only if viewer execution requires it.
3. **Non-rectilinear hips in scope?** *Deferred* (CD-8): not in the first wave; reopened by a selected family.
4. **CGAL commercial licence?** *Superseded* by the copyleft model: CGAL GPL-3.0-or-later is admissible with a
   GPL-3.0-or-later/AGPL-3.0-or-later product (owner/legal confirm the exact licence). No commercial licence needed
   unless the product licence changes.
5. **Snap precision?** *Superseded*: precision and error budgets derive from the supported coordinate range and
   the selected family — part of the T1 tolerance/coordinate-range contract, tested in E1/E2. 1e-6 m is no longer a
   default.
6. **Footprints from face extraction?** *Deferred* to the overhead-family slice; the first family's footprint is
   authored (one-shot fit, CD-4), so booleans are needed only for overhang/overlap where the family uses them.
7. **Single-maintainer TS port?** *Deferred* to E1, which compares the port with the upstream C++ reference.
- **Greedy cover vs Chebyshev (former S-B question).** *Completed*: counterexamples in §3.2; not to be re-run.

## 7. Remaining bounded experiments

Only two experiments are justified before the relevant overhead implementation. Each is disposable, reports
against criteria fixed before it runs, and is deleted; nothing moves into `packages/**` without a registered T1 slice
plan. **Neither blocks C1.**

**Common rules.** Declare the supported coordinate range and local-frame convention first, then derive the snap
precision and numeric budgets from it and from the selected family (for Clipper2: `range × 10^precision` must stay
inside the implementation's safe integer and area-product bounds). Compare **normalised** outputs (canonical start
vertex, orientation, collinear removal) across winding, start vertex, translation and rotation, not raw arrays. A
**valid empty intersection or a collapsed inset is a result, not a kernel failure**; only an exception, a
non-terminating operation or an invalid output is a failure, and it maps to a typed refusal. Report **curved-surface
approximation error** (analytic family vs facets) **separately** from clipping/snap error and from mesh error.

**E1 — 2D kernel qualification.** Consumer: the proposed T1 **tolerance and coordinate-range contract**
(provider table in the decision set), run before the first slice that needs area booleans/offsets.
- Candidate: Clipper2 (pure-TS port and an upstream C++ build); CGAL 2D booleans only if Clipper2 fails.
- Cases: holes and nested holes; touching boundaries (shared edge, shared vertex, hole touching the outer ring);
  near-collinear edges and 1e-12 noise; slivers below the snap grid; inset collapse to nothing and to several pieces;
  legitimate empty intersections (abutting roofs); translated (up to the declared range) and rotated inputs.
- Pass: exact or within-budget areas against analytic values; normalised outputs identical across winding, start
  vertex and reruns; port and C++ reference agree; empties returned as results; exceptions surfaced as typed
  refusals; adjacency detected by a shared-edge test.

**E2 — chosen roof-family qualification.** Consumer: the **overhead-family slice** after the vertical cutover
(single-span roof/canopy and closure/suspended ceiling first; a compound family only after its massing is chosen).
The disposable qualification needs the tolerance contract and chosen family semantics; it may run
before the vertical cutover implementation. The production overhead consumer still waits for that cutover.
- Oracle independent of the family evaluator: analytic planes and sections, ridge/hip/valley lines, boundary-edge
  incidence (every interior edge shared by exactly two faces, boundary edges on the outline), seam vertices, normals.
- Cases: eave boundaries, seams and gaps, double surfaces, undersides and fascia, translated (up to the declared
  range) and rotated coordinates, reversed winding, narrow spans near refusal limits.
- Pass: within the declared budgets; transform-invariant after normalisation; refusals carry reasons. Comparing a
  mesh only with its own evaluator does not pass E2.

**Conditional, not commissioned:** a skeleton implementation experiment reopens only if the selected roof semantics
require skeleton massing (off-axis hips, courtyards, or skeleton plus/Z). WASM initialisation, delivery cost,
worker placement and corresponding-source/licence checks run only for an actual candidate. A 3D boolean experiment
opens only for a selected CSG feature.
