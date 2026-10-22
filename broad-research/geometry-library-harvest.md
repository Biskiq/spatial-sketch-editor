# Geometry library harvest for production roofs and footprints (T1 / RR-2 input)

Status: research handoff, 2026-10-21. **Not** a contract, plan, roadmap change or dependency decision. Nothing
here is adopted. It gives T1 / RR-2 planning evidence for choosing geometry libraries for the one canonical Layout
compiler (AGENTS rules 4–6). P3 itself stays as it is: the owner ruled that P3 does not adopt Clipper2, Manifold,
a straight-skeleton solver or a general roof engine.

Evidence base:

- P3 Vellum source at `vellum-polish` @ `f4d1c7c5` (`prototypes/p3-vellum/**`, not on `main` yet). Its measured
  audit is `plans/roof-footprints-final-polish.md` §1, §4 and §5.
- Production `packages/layout-core` on `main` @ `cb2e96e5`.
- A scratch probe run outside the repo on Node 26.7, macOS arm64, 2026-10-21. It ran the P3 footprint fixtures
  through each library, compared the results with exact oracles and bundled each library with esbuild. No
  `package.json` in the repo was touched. The probe script is in the shared session-notes folder, not the repo.
- Upstream repos, npm metadata and licence files, cited inline. **[unverified]** marks claims I could not check.

## 1. What P3 has (and what it relies on)

| P3 piece | What it does | Precision model | Port value |
| --- | --- | --- | --- |
| `model/wings.ts` `decompose` | Rectilinear wing decomposition. It builds an axis grid from the outline's own coordinates, then cell occupancy, maximal rectangles, a greedy cover (≤ 4), thin-wing and primary choice, and finally checks that each inner support edge ends where its roof is the lower one. On refusal it returns `{kind:'unsupported', reason}`. | Plain doubles with local epsilons (`MERGE 0.02`, `1e-6`/`1e-9`); axis tolerance 2°; ≤ 16 vertices, ≤ 4 wings, ≥ 1.2 m short side. | **High.** This is the predictable rectilinear case, and it covers gable, vault and flat as well as hip (§3). |
| `scene/build/overheads.ts` `buildCompound` | Planar upper-envelope mesher. It splits the plan into cells at every wing break so that each candidate is one plane per cell. `clipHalfPlane(diffPlane)` keeps each plane's region, and pieces then subtract regions where another piece is higher. The result is clipped to the footprint. | Doubles; ±1e-9 tie-break by piece order. **The region subtraction and footprint clip call polygon-clipping** (`difference`, `intersection`), so the mesher is not purely half-plane. | **High as an algorithm**: it gives exact valleys and hips without mesh booleans, and it generalises to any set of planar height fields. The mesh builder itself stays a renderer concern (§5). |
| `model/clip.ts` | Thin wrapper over **polygon-clipping ^0.15.7** (the prototype's only geometry dependency). | See polygon-clipping below. **`safe()` swallows every exception and returns a fallback**: `union` returns its first input, `difference` returns `a` unchanged and `intersection` returns `[]`. | **Pattern to avoid.** In `buildCompound`, a thrown `difference` silently leaves an overlap (a double surface). Production must surface the failure as a typed refusal. |
| `model/section.ts` | Section reading: joints and parts, family classification, preset tolerance `max(0.12, 0.035·span)`. | Doubles, `EPS_U 1e-6`, `MIN_JOINT_H 0.05`. | Medium. This is domain logic; no library replaces it. |
| `model/ops.ts` `coverCheck` | One-answer qualification: the chip, the preview and the commit call one pure function that returns `{ok, reason, overhead}`, and the op refuses the same case and leaves no id trace. | — | **Highest.** It is a pattern, not a module. |
| `model/geom2d.ts` `offsetPoly` | Hand-written miter/bevel offset of a simple polygon. | No self-intersection handling. Inward offsets past a wing's half-width produce invalid rings **[inferred from code, not probed]**. | Replace (§4). |
| Audit `hits` probe (`tests/roof-polish-review-temp.test.ts`, uncommitted) | Barycentric vertical ray tests of the mesh top against the height evaluator. It reports gaps, double surfaces and maximum error. | — | **High.** It is the renderer-free oracle, and every spike below uses it. |

Production context that changes the calculus: `layout-core` already depends on `robust-predicates` (Shewchuk adaptive
`orient2d`, Unlicense) through `layout-robust-orientation.ts`. It also already does deterministic T/X noding
(`layout-wall-noding.ts`) and face extraction with robust edge ordering (`layout-face-extraction.ts`). So the
canonical compiler already owns an exact planar arrangement of walls. Production does not yet have area booleans,
offsets, a skeleton or 3D booleans. Cover footprints today are a P3 notion.

## 2. Candidates — facts

Sizes are measured. "js" is esbuild `--bundle --minify` of only the entry points named, with min and gzip -9 sizes.
"wasm" is the separate binary, raw and gzip. Maintenance comes from the GitHub API on 2026-10-21.

| Library (version) | Licence (checked file) | js min / gz | wasm raw / gz | Init | Node | Maintenance |
| --- | --- | --- | --- | --- | --- | --- |
| [polygon-clipping](https://github.com/mfogel/polygon-clipping) 0.15.7 | MIT (`LICENSE.md`) | 29.7 / 9.8 KB | — | sync | ✓ | Last push 2024-04-19, last npm publish 2023-12, 46 open issues. **Effectively dormant.** |
| [polyclip-ts](https://github.com/luizbarboza/polyclip-ts) 0.16.8 (TS fork; uses bignumber.js) | MIT | 42.1 / 15.2 KB | — | sync | not probed | Last push 2025-11-09, 9 open issues. |
| [Clipper2](https://github.com/AngusJohnson/Clipper2) C++ 2.0.1 (2025-12-19) | BSL-1.0 | — | — | — | — | Active (push 2026-10-17), 2.5k stars. |
| [clipper2-ts](https://github.com/countertype/clipper2-ts) 2.0.1-18 (pure TS port) | BSL-1.0 (`LICENSE`) | 66.0 / 17.7 KB (`unionD`, `differenceD`, `intersectD`, `inflatePathsD`) | — | sync | ✓ | Push 2026-07-04, 42 stars, one maintainer. |
| [Clipper2-WASM](https://github.com/ErikSom/Clipper2-WASM) 0.4.0 | BSL-1.0 | 28.6 / 10.5 KB | 213.6 / 81.5 KB | async | not probed | Push 2026-05-18. Embind objects need manual `delete()` **[from typings]**. |
| [manifold-3d](https://github.com/elalish/manifold) 3.5.4 (2026-09-25) | Apache-2.0 (`LICENSE`) | 44.5 / 14.7 KB | 541.5 / 204.6 KB | async (`await Module(); setup()`), 10 ms in Node | ✓ | Very active (push today), 2.4k stars. Its npm `dependencies` list CLI tooling (gltf-transform, commander) that the library bundle does not pull in. |
| [straight-skeleton](https://github.com/StrandedKitty/straight-skeleton) 3.0.0 (CGAL → WASM) | Wrapper **MIT**; embeds CGAL `Straight_skeleton_2`, which is **GPL-3.0-or-later OR commercial** | 1,035 / 331 KB (wasm base64-inlined) | inlined | async | **✗** (built for web only: "not compiled for this environment") | Push 2026-03-24, 12 open issues. |
| [str8](https://github.com/matthewjacobson/str8) 0.5.0 (CGAL 6.1 → WASM) | Wrapper **MIT**; same CGAL GPL core | 1,661 / 489 KB (1.20 MB wasm inlined) | inlined | async, 20 ms | ✓ | One release (2026-06-22), 1 star, one author. |
| [@proc-geo/core](https://www.npmjs.com/package/@proc-geo/core) 0.2.1 (pure TS skeleton) | MIT | 30.0 / 9.8 KB (skeleton entry) | — | sync | ✓ | New (2026-07). Simple polygons only; input must be clockwise or it **silently returns an empty skeleton** (README). |
| CGAL 6.2.1 `Straight_skeleton_2` (C++) | `package_info/Straight_skeleton_2/license.txt`: "GPL (v3 or later)"; headers `SPDX: GPL-3.0-or-later OR LicenseRef-Commercial` | — | — | — | — | Active; commercial licences via GeometryFactory. |

Capabilities and failure modes:

- **polygon-clipping**: Martinez–Rueda–Feito sweep with `robust-predicates` orientation. It handles booleans with
  holes and multipolygons, accepts lenient input (any winding, unclosed rings, non-zero self-crossings) and normalises
  output (CCW outers, no superfluous points). It has **no offsetting and no snapping**: probe inputs carrying 1e-12
  noise came back as a 9-vertex ring with 1e-12 m edges, and a 1e-9 m sliver difference was kept verbatim.
  Runaway sweeps throw once the `POLYGON_CLIPPING_MAX_QUEUE_SIZE` / `…_SWEEPLINE_SEGMENTS` guards trip (1e6
  defaults, per the README). The 46 open issues include robustness reports **[issue contents not reviewed]**.
- **Clipper2** (and its ports): an **integer coordinate model**. The `…D` APIs scale doubles by `10^precision`
  (`precision` ∈ [-8, 8], checked in `clipper2-ts/src/Core.ts`) and round, so the snap grid is explicit and
  deterministic. It provides booleans with holes (PolyTree), offsetting with miter, round, square or bevel joins,
  Minkowski operations, rectangle clipping and (in 2.x) triangulation. In the probe at precision 6, 1e-12 noise
  snapped away and the 1e-9 sliver vanished. Union output **keeps collinear vertices** (the L came back with 7 vertices
  against polygon-clipping's 6, the U with 10 against 8), so a simplify pass is needed before identity-sensitive use.
  clipper2-ts emulates int64 in JS doubles with safe-product guards (`IC_maxCoordForSafeAreaProduct`). Whether it is
  exact at metre coordinates × 1e6 throughout is **[unverified]**.
- **Straight skeleton (CGAL)**: an exact or inexact kernel choice (EPICK is recommended; str8 retries with EPECK on
  failure, using boost::multiprecision `cpp_int`, so no GMP is linked, as the wasm symbols show). It supports
  holes, **positive** multiplicative weights and exterior skeletons, and offset contours come from the skeleton.
  `extrude_skeleton` gives a closed 2-manifold roof mesh in C++ (the npm wrappers do not expose it). The
  [official extrusion API](https://doc.cgal.org/latest/Straight_skeleton_2/group__PkgStraightSkeleton2Extrusion.html)
  warns of possible non-local self-intersections when a maximum height is supplied. Excluded inputs
  are non-simple ones: a vertex touching an edge, touching holes. Near-collinear vertices derail event scheduling;
  str8 pre-drops vertices within 1e-6 of collinear. Vaults, arbitrary stepped sections and per-wing profile editing
  are not supplied by a skeleton alone. **Convergence correction, 2026-10-21:** unlike weighted skeleton
  constructors, `extrude_skeleton` explicitly permits zero-weight vertical edges, so a categorical exclusion of
  gables was too broad. Npm-wrapper exposure and an actual gable fixture remain unverified. Curved sections are
  not planar faces. The [vertical/overhead commission](./post-p01-roadmaps/convergence-2026-10-21/vertical-and-overhead.md)
  carries the bounded follow-on probes; historical measurements here were not rerun.
- **Manifold**: a guaranteed-manifold 3D mesh boolean, documented as "guaranteed manifold output without caveats or
  edge cases". Its 2D `CrossSection` **embeds Clipper2**: `Clipper2Lib` symbols appear in `manifold.wasm`. The WASM
  build is serial-only (README), and in the probe a rerun was byte-identical. It is a mesh-domain tool. It neither
  produces roof surfaces nor reads plan semantics.

## 3. Probe results on P3 fixtures

Fixtures are the P3 set from `tests/wings.test.ts` and the audit: L `[0,0,10,6]+[6,6,10,14]`, unequal L
`[0,0,10,6]+[7,6,10,14]` (a 3 m wing; **my reading of "unequal"**, so check it against the audit), T, U and plus.
The two-roof pairs are crossing, L butt and T touch.

**Footprint union (wing rectangles → one ring).** polygon-clipping and clipper2-ts were both exact (area error 0)
on all five fixtures, producing one ring with no holes in 0.15–1.9 ms. polygon-clipping returned an identical result
on rerun.

**Pair intersections.** Crossing gave 25 m² in both libraries. L butt and T touch gave `[]` in both. **Booleans cannot
see an abutment**: two roofs that only share an edge intersect in nothing. The T-touch and L-butt cases therefore need
an explicit adjacency or relation test (shared-edge detection on the noded arrangement), not an area boolean.

**Clipper2 offset.** A 0.45 m miter outset matched the exact `A + P·d + 4d²` for orthogonal rings to within
1.4e-14 m² on all five. A −2.6 m inset left 1 piece for L and the unequal L and 0 for T, U and plus, so wings
narrower than 5.2 m collapse cleanly, with no invalid rings.

**Straight skeleton vs an exact oracle.** For an orthogonal polygon at unit pitch, the skeleton roof height at a
point equals the L∞ (Chebyshev) distance to the boundary. That is also the upper envelope of hipped maximal
rectangles, which is exactly what P3's wing envelope computes for equal-pitch hips. On the audit grid
(0.731 × 0.673 m, 174–219 samples per fixture):

| | L | unequal L | T | U | plus |
| --- | --- | --- | --- | --- | --- |
| str8: max error | 8.9e-16 | 8.9e-16 | 1.8e-15 | 2.6e-15 | 4.4e-16 |
| str8: gaps, rerun identical, start-vertex rotation | 0 / ✓ / 0 | 0 / ✓ / 0 | 0 / ✓ / 0 | 0 / ✓ / 0 | 0 / ✓ / 0 |
| @proc-geo/core: skeleton vertices (str8 had) | 10 (10) | 10 (10) | 12 (**13**) | 15 (**14**) | 17 (17) |

str8 degenerate cases: a 12×12 courtyard with a 4×4 hole worked (maximum height 2.000, correct). A collinear
midpoint and 1e-12 noise both worked.

**Convergence correction, 2026-10-22 (vertical commission step 2, G1):** the equivalence between P3's wing
envelope and the L∞ oracle holds only for L, unequal L, T, U and a rectangle. P3's greedy largest-first cover
deviates by 1.344 m on this plus fixture, 1.651 m on a Z and 0.825 m on a wide-stem T. So "agrees by
construction" (§5) is false in general, and a skeleton kernel would reshape those roofs. The P3 mesh's "0.000 m"
also holds only when the frame is aligned and the coordinates are near the origin. Rotated and far-translated
cases show real mesh holes. See the [vertical packet](./post-p01-roadmaps/convergence-2026-10-21/vertical-and-overhead.md)
and its `probes/vertical/`. **A hole sharing an edge with the outer ring returned `null`** with no
diagnostic: the touching-ring check only catches coincident vertices. StrandedKitty's build could not run in Node
at all. @proc-geo/core exposes a graph, not faces. Its vertex counts disagree with CGAL on T and U; I did not
adjudicate which is correct, and it is **not verified**.

**Manifold.** The union of the crossing gables (two hull prisms 2 m high) had volume 103.333333, equal to the exact
120 − 50/3 (the intersection of the two prisms is a 5×5×2 pyramid). Genus was 0 and status `NoError`. The L
extrusion volume was exact (276). A rerun was byte-identical.

**What the probe did not do**: run P3's own evaluator against these libraries (the spikes in §7 do that),
probe Clipper2-WASM, probe polyclip-ts, or test performance at scale.

## 4. Fit for the canonical, runtime-safe Layout compiler

Rules that decide fit (AGENTS rules 3–6): one architectural compiler whose output both editor and visitor runtimes
consume. Runtime-safe evaluators are shared, not forked. Nothing editor-only is in visitor chunks. Generated
geometry is never authored truth, and a compiled release payload is an allowed derivative.

| Concern | Consequence |
| --- | --- |
| **Synchronous, pure, Node-runnable** | The compiler runs in the editor transaction path (build candidate → validate → commit), in Vitest's arch lane and possibly at release lowering. Pure TS libraries fit directly. An async WASM init forces either a module-level `await init()` gate before any compile or an async compiler. That is a cross-cutting API change and should be a deliberate decision, not a side effect. |
| **Determinism** | Compiler output feeds identity-sensitive steps (reconciliation, face candidates) and reproducible release payloads. An explicit snap grid (Clipper2) or exact predicates (CGAL EPECK) are good. Unsnapped float output (polygon-clipping keeping 1e-12 edges) is a determinism and identity hazard. |
| **Visitor bundle** | Visitors need the *evaluated* roof, not the solver. If the solver runs only at compile or release time and the visitor consumes the compiled result, solver size never reaches visitor chunks. If the visitor recompiles (rule 4 allows shared domain evaluators), every kilobyte counts: ~10–18 KB gz for 2D booleans is fine, and 330–490 KB gz for a CGAL skeleton is not. |
| **Licence** | Both npm CGAL skeleton wrappers say MIT, but the binary they ship is compiled CGAL `Straight_skeleton_2`, which is GPL-3.0-or-later (or commercial). Serving that WASM to browsers conveys it. **Treat both as GPL for product use unless GeometryFactory licences it commercially.** (This is not legal advice; it is the owner's call.) BSL-1.0, MIT and Apache-2.0 are permissive and need no copyleft review. Apache-2.0 has a NOTICE and patent clause to preserve. |
| **Second-authority risk** | A library that *decides* roof shape (a "roof engine") would sit beside the compiler as a second architectural authority (rule 6). Libraries must stay **kernels** called by the compiler: booleans, offsets and a skeleton as functions, with the compiler owning sections, joins, qualification and refusal reasons. |

## 5. Recommendation matrix

| Area | Adopt / keep / avoid | Why |
| --- | --- | --- |
| Footprint booleans with holes (cover outlines, courtyards, overlaps) | **Spike `clipper2-ts`** as the default 2D kernel. Use one snap precision (for example 1e-6 m, aligned with the compiler's tolerance) and simplify collinear output. | It is pure TS, sync, Node-safe, BSL-1.0, ~18 KB gz, has an explicit integer snap model and offsets in the same package, and is upstream-active (the port has a single maintainer, so the risk is noted). |
| polygon-clipping | **Avoid for production**; P3 may keep it. | Upstream is dormant, it does no snapping (noise survives into output) and it has no offsets. The P3 wrapper's exception-swallowing is the specific thing never to port. |
| polyclip-ts | Fallback only if Clipper2's integer grid proves unworkable. | It is the maintained successor of the same algorithm, but it still has no offsets and pulls in bignumber.js. |
| Offsets (overhang fit, eave insets, wall-thickness clearances) | **Clipper2 `inflatePathsD`** (miter, with a miter limit) replaces `offsetPoly`. | It was exact on the fixtures, inset collapse is clean, and it handles holes. |
| Rectilinear roofs: flat, gable, hip, vault over L/T/U/plus | **Keep P3 wings + the upper-envelope algorithm**, reimplemented in the compiler on top of the 2D kernel and `robust-predicates`. | It covers gable, vault and curved sections, which a skeleton cannot. It refuses with reasons, is cheap and synchronous, and is exact (0.000 m in the P3 audit). On hip it agrees with the skeleton by construction (§3). |
| Arbitrary or off-axis hip footprints, courtyards | **Defer**, and run a skeleton spike only if RR-2 actually needs non-rectilinear hips. Prefer a **compile-time or worker-only** CGAL build **only after** a commercial licence decision. Otherwise write a permissive TS skeleton, validated against str8 as a test-only oracle. | CGAL's results are excellent (exact to 1e-15 on the fixtures, holes handled), but it is GPL and 330–490 KB gz, initialises asynchronously, and has a silent `null` on touching rings. The pure-TS options are immature (@proc-geo disagrees with CGAL on T and U). |
| Using CGAL/str8 as a **dev-only test oracle** | **Acceptable, with an owner check.** Keep it in a devDependency used only by tests and never bundled. | GPL obligations attach to distribution. Running locally in tests is not distributing the product **[owner/legal to confirm]**. |
| 3D mesh booleans (Manifold) | **Avoid in the compiler**; reconsider only for release-time mesh hygiene or CSG features (dormers, roof openings beyond skylights). | Roof joins are a height-field problem that the planar envelope solves exactly with no 3D booleans. Manifold would add 205 KB gz of wasm plus async init for nothing on the current scope. If CSG is ever needed it is the best-in-class Apache-2.0 option, and it already bundles Clipper2. |
| Joins at different eaves or across families | **Keep the envelope approach**: a height-field upper envelope over an exact planar arrangement, with curved sections as planar facets and valley/abutment classification. | This matches P3 §4's production direction. The 2D kernel and the existing noding/face machinery supply the arrangement. |
| Qualification | **Keep `coverCheck`'s one-answer pattern** as a compiler invariant: every kernel failure maps to a typed refusal, never a fallback geometry. | It is the most valuable P3 export. |
| Mesh-vs-evaluator probe + fixtures | **Port as test support** in the compiler's test lane. | It is a renderer-free oracle, and the spikes need it. |

## 6. Open questions (owner / T1 planning)

1. Does the compiler stay **synchronous**? If yes, WASM kernels are out of the compile path, and only pure TS (or a
   pre-initialised module gate) qualifies.
2. Do visitor runtimes **recompile** roofs from authored Layout, or consume compiled results (a release payload or
   an editor-compiled cache)? This decides whether kernel size matters to visitors at all.
3. Is a **non-rectilinear hip roof** in RR-2 scope? If not, no skeleton is needed in production.
4. Is a **CGAL commercial licence** acceptable in principle? If not, the CGAL route is test-oracle-only.
5. What is the **snap precision** (1e-6 m?), and does it align with `layout-core`'s existing wall and junction
   tolerances? Both the kernel and the envelope must share one tolerance contract.
6. Should cover footprints come from the **existing face extraction** (rooms as noded faces) rather than unions of
   room polygons? If so, booleans are needed mainly for overhang offsets and roof-to-roof overlap, not for building
   the footprint.
7. Is a single-maintainer TS port (clipper2-ts) acceptable, or should the project vendor or pin it, given upstream
   C++ remains the reference?

## 7. Suggested spike pass criteria (each is a bounded, disposable spike)

Use the P3 fixtures (L, unequal L, T, U, plus) at the audit's 0.45 m overhang, the two-roof pairs (crossing,
L butt, T touch), and the promoted mesh-vs-evaluator probe on the audit grid (≥ 170 samples per fixture).

**S-A: 2D kernel (clipper2-ts) under the compiler's tolerance contract.**

- Footprint union equals the exact area for all five fixtures. The output after simplify is a minimal ring, with
  the same vertex count as the rectilinear corners.
- The fitted overhang outline (0.45 m miter) matches the exact area to ≤ 1e-9 m², and holes (a 4×4 courtyard)
  survive.
- Outputs are bitwise identical across reruns and across input start vertex and winding.
- Inputs with 1e-12 noise and 1e-9 slivers produce the same output as clean inputs.
- Every kernel exception or empty result surfaces as a typed refusal. A test asserts that no fallback geometry is
  returned.
- Crossing gives 25 m² of overlap. L butt and T touch are detected as **adjacent** by an explicit shared-edge test,
  not by an area boolean.

**S-B: wing envelope ported over S-A.**

- All five fixtures × {flat, gable, hip, vault} give 0 gaps, 0 double surfaces and ≤ 1e-9 m error against the
  evaluator, at least matching P3's audit.
- Raked and clerestory still refuse with reasons.
- On equal-pitch hips, the evaluator height equals `pitch × Chebyshev distance to the outline` to within ≤ 1e-9 m:
  the closed-form oracle from §3, with no skeleton dependency. The spike must also check whether P3's greedy ≤ 4
  cover (rather than all maximal rectangles) or its `hipLo`/`hipHi` choice breaks this equality. This is
  **[unverified]** and is the most likely place for a discrepancy.
- The two-roof pairs, once merged through the S2-style join, meet the same gap, double-surface and error bars.
  Unmerged, the conflict is reported rather than rendered through.

**S-C (only if question 3 says yes): skeleton.**

- A permissive TS implementation, or CGAL under licence, matches str8 (as a test-only oracle) to within ≤ 1e-9 m on
  the five fixtures, a courtyard, and three off-axis polygons (15°, 30° and a freehand 7-gon).
- Touching-ring and near-collinear inputs give a typed refusal, never a silent `null`.
- For a WASM option: init happens once behind a module gate, the compile path stays synchronous after init, the
  visitor chunk delta is measured, and the licence is cleared before merge.

**Exit for all spikes:** each spike reports its result against these criteria and is deleted. Nothing moves into
`packages/**` without a registered T1 slice plan.
