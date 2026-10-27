# Probe methods and raw results

**Research date:** 25 October 2026, revised the same day after peer review  
**Status:** Disposable local measurements, published so they can be repeated and challenged. No script, package or test file was added to the repository; this document reproduces them verbatim. No dependency is adopted.  
**Package:** [Native creative depth](./README.md) · labels follow the package's [evidence conventions](./README.md#3-how-to-read-the-evidence)

The first revision of this package compared a 40-opening wall built as a Manifold extrusion (0.69 ms) with the same wall built by sequential OCCT cuts (777 ms). Peer review questioned whether that comparison was like for like. It was not: the two routes differed in representation, algorithm, implementation and output completeness at once. This document replaces it with a matched probe, adds a measurement of Biskiq's own production wall path, re-runs every other probe the package cites, and states what the figures can and cannot support. The [review response](./review-response.md#1-geometry-benchmarks) records the reasoning.

## 1. What these probes can and cannot support

**They can support:**

- the relative cost of different routes to **one identical output** on one fixture, in one engine, on one machine;
- whether each route's output is closed and has the right volume;
- the order of magnitude of Biskiq's production analytic wall path on a dense host;
- package sizes and initialization cost.

**They cannot support:**

- browser latency, or anything about reference laptops A and B;
- a verdict on any [performance budget](../../docs/reference/components/performance.md#budgets), which is boundary-inclusive and measured in Chrome on the designated machine;
- a verdict for or against Rust/WASM. No custom Rust/WASM module was built or measured, and only one Biskiq hot path was probed;
- determinism across browsers or CPU architectures;
- memory high-water marks.

## 2. Environment

| Item | Value |
| --- | --- |
| Machine | Apple MacBook Air M2, 8-core CPU, 16 GB; macOS 15.7.2. Power state and background load were not controlled |
| Runtime | Node v26.7.0 (V8), arm64 |
| Kernel packages, installed in a scratch directory outside the repository | `three` 0.186.1 (MIT); `manifold-3d` 3.5.4 (Apache-2.0); `replicad` 1.2.0 (MIT) loading `replicad-opencascadejs` 1.1.0 (LGPL-2.1-only); `three-bvh-csg` 0.0.18 with `three-mesh-bvh` 0.9.16 (MIT); `@jscad/modeling` 2.13.0 (MIT) |
| Production code | `main` at `976323da` (25 October 2026), run through the editor's Vitest configuration with `environment: 'node'` |

## 3. Method

**Fixture.** A wall 20 m long, 3 m high and 0.3 m thick, with 40 rectangular openings 0.3 m wide and 1 m high on a 1 m sill. Opening near edges sit at 0.2 + 0.49·*i* m. The expected solid volume is 14.4 m³.

**Matched output.** Every kernel route ends with the same thing: a triangulated, closed wall copied out of the library into plain JavaScript typed arrays.

- Manifold routes include `getMesh()` and the copy.
- OCCT routes include tessellation with `mesh()` and the copy.
- three.js returns typed arrays directly.

**Timing.** `performance.now()` around the whole route: building inputs, the operation, tessellation and copy-out. Warm-up runs are discarded. p50 and p95 are nearest-rank values over the timed repetitions. Library initialization is timed separately. With 5–10 repetitions, p95 is close to the maximum.

**Validity.** Vertices are welded by position rounded to 10⁻⁵ m. A directed edge with no opposite partner counts as an *open edge*. Zero open edges means a closed two-manifold without T-junctions. The signed volume is compared with 14.4 m³.

**Production path.** A one-wall document is compiled with `compileWallFirstLayoutGeometry` and meshed with `buildStandaloneWallMesh` from [`apps/editor/src/lib/layout/wall-mesh-builder.ts`](../../apps/editor/src/lib/layout/wall-mesh-builder.ts). There are four variants:

- a straight wall, or a curved one-knot cubic chain with a 20 m chord and 2 m sagitta;
- rectangular or rounded opening heads.

The production output is **richer** than the kernel routes. It has normals, metric arc-length UVs, opening reveals (jamb, sill, lintel and arch reveal), surface groups, a pick partition in which every triangle has exactly one owner, and junction-aware ends. Its timings are therefore a magnitude for Biskiq's real path, not a like-for-like row.

## 4. Results: the matched 40-opening wall

| Route | Representation | Operation | p50 ms | p95 ms | Reps (warm-up) | Triangles | Open edges | Volume error m³ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R1 three.js `ExtrudeGeometry` | Plain JavaScript, earcut | Extrude a face with 40 holes | 0.77 | 3.50 | 50 (5) | 656 | **160** | 1.0e-6 |
| R2 Manifold `CrossSection.extrude` | C++ compiled to WASM, mesh | Extrude a face with 40 holes | 1.29 | 3.01 | 50 (5) | 812 | 0 | 1.0e-6 |
| R3 Manifold `difference` | Same | One boolean with 41 operands | 3.73 | 7.91 | 50 (5) | 812 | 0 | 1.0e-6 |
| R4 Manifold `subtract` × 40 | Same | 40 sequential booleans | 3.52 | 4.38 | 20 (3) | 812 | 0 | 1.0e-6 |
| R5 OCCT drawing cut, extrude | C++ compiled to WASM, B-rep | Extrude a face with 40 holes | 119.9 | 130.3 | 10 (2) | 812 | 0 | 1.0e-6 |
| R6 OCCT cut by a compound | Same | One boolean against 40 tools | 198.6 | 326.7 | 10 (2) | 812 | 0 | 1.0e-6 |
| R7 OCCT `cut` × 40 | Same | 40 sequential booleans | 717.3 | 719.0 | 5 (1) | 812 | 0 | 1.0e-6 |

**Supplementary routes, not matched.** These come from the re-run of the earlier script in [§5](#5-results-other-probes):

- three-bvh-csg, 40 sequential subtractions: 143.9 ms p50 over 5 runs with no warm-up. Its output had 3,856 open edges.
- JSCAD, one batch subtraction: 9.1 ms p50 over 3 runs. Its output is polygons, not triangles, and its validity was not checked.

**Biskiq production wall path**, 50 repetitions after 5 warm-up runs. No issues were reported and all 40 Openings compiled.

| Variant | Compile p50 / p95 ms | Mesh p50 / p95 ms | Compile + mesh p50 / p95 ms | Triangles |
| --- | --- | --- | --- | --- |
| Straight, rectangular heads | 0.93 / 2.30 | 2.45 / 3.36 | 3.32 / 4.77 | 2,672 |
| Straight, rounded heads | 0.91 / 1.14 | 6.78 / 7.97 | 8.20 / 10.10 | 7,456 |
| Curved, rectangular heads | 1.41 / 3.18 | 3.70 / 11.41 | 4.78 / 5.75 | 3,488 |
| Curved, rounded heads | 1.36 / 2.84 | 8.19 / 9.90 | 9.30 / 10.89 | 8,288 |

**I** **Reading the results:**

1. **Operation choice matters as much as library choice.** On identical output, Manifold's routes span 1.3–3.7 ms and OCCT's span 120–717 ms, a factor of about 6.
2. **At a matched operation, Manifold was 50–200 times faster than OCCT here:**
   - extrusion with holes, 1.29 against 119.9 ms;
   - one batch boolean, 3.73 against 198.6 ms;
   - sequential booleans, 3.52 against 717 ms.

   This holds for one simple fixture in Node. It is not a general kernel ranking.
3. **Plain JavaScript was neither faster nor more valid by default.** three.js matched Manifold's time but left 160 open edges: earcut's cap triangles span the collinear sill and head vertices, which makes T-junctions against the side faces. That is acceptable for display. It is not acceptable as input to a boolean, a validator or an identity table.
4. **The first revision's headline is withdrawn.** It set Manifold extrusion without copy-out (0.69 ms) against OCCT sequential cuts without tessellation (777 ms). The "about 1,000×" gap mixed representation, algorithm, implementation and output completeness.
5. **Biskiq's production path costs more than the kernel routes because it produces more.** It emits three to ten times the triangles, plus UVs, reveals and the pick partition. Compiling takes about 1 ms. Meshing dominates, and tessellating rounded heads costs most.
6. **These are not budget verdicts.** The per-edit Layout evaluation budget covers compile plus representation for one pointer move: ≤4, 8 and 16 ms at the **S, M and L project scales**, judged in Chrome on the designated M2, and Hard at M. A single wall with 40 openings lies outside those fixture definitions; the M fixture has about one Opening per Wall. What the rows do show is that **dense, arched hosts are where TypeScript evaluation cost concentrates**. The first levers are algorithmic:
   - evaluate only the changed host;
   - choose the tessellation density of arched heads;
   - use an honestly labelled preview level of detail.

   Those levers sit on the compile and representation path that [S06](../../docs/roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/implementation-plan.md) owns.

## 5. Results: other probes

Every other figure the package cites was re-run on 25 October 2026 after review, with the scripts in [§8](#8-scripts). The re-run agrees with the first run to within normal variation. The scope column says what each figure includes.

| Probe | p50 / p95 ms | Scope and caveats |
| --- | --- | --- |
| Rotation-minimizing sweep: 24-sided profile along a 2,000-sample helix | 0.83 / 4.54 | 95,952 triangles. **Positions and indices only**: no normals, UVs, caps, validation or upload. Frame orthogonality error 3.3e-15. Bit-identical across runs **within one process** |
| Ruled strip between helices of 1,500 and 900 samples, resampled to 2,000 stations | 0.19 / 0.57 | Positions only |
| Coons patch, 100 × 100 | 0.20 / 0.50 | Positions only |
| Manifold initialization | 12.2 | 16.5 ms in the matched run and about 6 ms in the first run. It varies with process state |
| Manifold: sphere of 32,768 triangles minus a cube | 16.0 / 31.3 | Reports `NoError` |
| Manifold: union of two 131,072-triangle spheres | 133.7 / 138.6 | Beyond the drag budget |
| Manifold: revolve with 128 segments | 0.35 / 0.38 | — |
| Manifold: gyroid `levelSet`, edge 0.05 | 19.6 | One run; 11,568 triangles |
| Manifold: `smoothOut` plus `refine(8)` on a cube | 0.73 / 2.30 | Display softening only |
| Manifold: `getMesh` copy-out of 184,764 triangles | 3.1 / 138.6 | 5 runs; one outlier dominates p95 |
| Manifold coplanar suite | — | Stacked union: volume 2, genus 0. Through-hole: genus 1. A minus A: empty. All correct |
| Manifold provenance | — | `runOriginalID` names both inputs; 66 distinct face IDs survive one subtraction |
| OCCT initialization | 113.7 | 221 ms in the matched run and 92 ms in the first run |
| OCCT: fillet all edges of a box | 15.4 / 74.1 | — |
| OCCT: cylinder–cylinder fuse, then fillet | 37.8 / 73.3 | Fuse alone 19.4 / 90.2 |
| OCCT: box shell / circle-to-rectangle loft | 5.1 / 27.6 and 5.4 / 30.7 | — |
| OCCT: mesh a filleted box at 0.01 tolerance | 30.6 / 44.7 | 9,460 triangles |
| OCCT memory | — | WASM heap **length** was 100 MiB after initialization and 1,073 MiB after the script's sequential cuts, and it did not grow over 300 more fuses. Heap length is reserved linear memory, which never shrinks; it is not live use. The figure of about 200 KB leaked per fuse comes from [replicad #282](https://github.com/sgenoud/replicad/issues/282), not from this probe |
| three-bvh-csg: 32,256-triangle sphere minus a cube | 28.2 / 113.5 | 1,096 open edges. The input sphere already shows 128 at this weld tolerance, so the count is inconclusive |
| three-bvh-csg: coplanar through-hole | — | 32 open edges from closed inputs |
| JSCAD: 32,768-polygon sphere minus a cube | 15,935 | About 16 s |
| Worker hand-off of a 4.2 MiB mesh | 0.02 / 0.06 transferred; 0.77 / 1.73 cloned | The clone was 1.35 ms in the first run |
| Package sizes, brotli quality 11 | — | `manifold.wasm` 155 KiB plus 17 KiB of glue. OCCT `replicad_single.wasm` 4,895 KiB plus 20 KiB of glue, about 19.6 times the visitor's 250 KiB first-load budget |

## 6. Limitations

- **Engine.** Node, not a browser. Chrome's V8 is close, but Safari and Firefox are not represented, and nothing ran on reference laptops A or B.
- **Statistics.** OCCT routes had 5–10 repetitions, so their p95 is nearly a maximum. CPU frequency, power and background load were not controlled.
- **Boundaries.** No figure includes GPU upload or a presented frame. The budgets are boundary-inclusive; these probes are not.
- **No Rust/WASM comparator.** Manifold and OCCT are C++ compiled to WASM, but no purpose-built Rust/WASM module was measured against a TypeScript evaluator on the same job.
- **Production harness.** The production probe ran under Vitest's module transform, not the bundled editor build. It measured one host and did not exercise drag, admission, Room reconciliation across many Walls, or install.
- **Determinism.** Checked only within one process.
- **Fixture.** Kernel routes used rectangular openings only. The production path was also measured with rounded heads, which have no kernel counterpart here.

## 7. How to reproduce

Install the kernel packages at the exact versions in a scratch directory outside the repository. Save each script from [§8](#8-scripts) in a different directory, and pass the scratch directory as the first argument:

```bash
mkdir -p /tmp/biskiq-probe/deps /tmp/biskiq-probe/scripts
cd /tmp/biskiq-probe/deps && npm init -y && npm install three@0.186.1 manifold-3d@3.5.4 replicad@1.2.0 replicad-opencascadejs@1.1.0 three-bvh-csg@0.0.18 three-mesh-bvh@0.9.16 @jscad/modeling@2.13.0
node /tmp/biskiq-probe/scripts/matched_wall.mjs /tmp/biskiq-probe/deps
```

For the production path, save the test in §8.2 as a temporary file under `apps/editor/tests/lib/layout/` on a checkout of `main`. Run it from `apps/editor`, then delete it:

```bash
npx vitest run --config vitest.config.ts tests/lib/layout/zz-probe-wall-openings.test.ts
```

## 8. Scripts

All scripts are reproduced exactly as they ran. Paths inside them name files in the scratch directory where they ran, not repository files, so they are declared as evidence.

EVIDENCE-PATHS: start — probe scripts and raw output reproduced verbatim as run on 25 October 2026 against `main` at `976323da`; their paths name scratch files, not repository files

### 8.1 Matched wall probe

```js
// Matched probe: every route produces the same output — a triangulated 20 x 3 x 0.3 m wall with
// 40 rectangular openings (0.3 x 1 m, sill 1 m) — copied out as plain typed arrays.
// Usage: node matched_wall.mjs <dir containing node_modules>
const D = process.argv[2];
const now = () => performance.now();
const out = { env: { node: process.version, arch: process.arch, platform: process.platform } };

const N = 40, W = 20, H = 3, T = 0.3, OW = 0.3, OH = 1, SILL = 1;
const xs = Array.from({ length: N }, (_, i) => 0.2 + i * 0.49);
const EXPECTED_VOLUME = W * H * T - N * OW * OH * T; // 14.4

function stats(label, fn, { warm = 5, reps = 50 } = {}) {
	for (let i = 0; i < warm; i++) fn();
	const ts = []; let r;
	for (let i = 0; i < reps; i++) { const a = now(); r = fn(); ts.push(now() - a); }
	ts.sort((x, y) => x - y);
	const q = (p) => +ts[Math.min(reps - 1, Math.floor(p * reps))].toFixed(3);
	out[label] = { p50: q(0.5), p95: q(0.95), reps, warm };
	return r;
}

// Validity on a triangle soup or indexed mesh: weld by rounded position, count unpaired directed edges, signed volume.
function check(positions, indices) {
	const key = (i) => `${positions[3 * i].toFixed(5)},${positions[3 * i + 1].toFixed(5)},${positions[3 * i + 2].toFixed(5)}`;
	const ids = new Map(); const vid = (i) => { const k = key(i); let v = ids.get(k); if (v === undefined) { v = ids.size; ids.set(k, v); } return v; };
	const triCount = indices ? indices.length / 3 : positions.length / 9;
	const idx = (t, c) => (indices ? indices[3 * t + c] : 3 * t + c);
	const edges = new Map(); let vol = 0;
	for (let t = 0; t < triCount; t++) {
		const a = idx(t, 0), b = idx(t, 1), c = idx(t, 2);
		const [va, vb, vc] = [vid(a), vid(b), vid(c)];
		for (const [p, q] of [[va, vb], [vb, vc], [vc, va]]) {
			const rev = `${q}>${p}`;
			if (edges.has(rev)) { const n = edges.get(rev) - 1; n ? edges.set(rev, n) : edges.delete(rev); }
			else edges.set(`${p}>${q}`, (edges.get(`${p}>${q}`) || 0) + 1);
		}
		const P = (i) => [positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]];
		const [A, B, C] = [P(a), P(b), P(c)];
		vol += (A[0] * (B[1] * C[2] - B[2] * C[1]) - A[1] * (B[0] * C[2] - B[2] * C[0]) + A[2] * (B[0] * C[1] - B[1] * C[0])) / 6;
	}
	return { tris: triCount, openEdges: edges.size, volume: +Math.abs(vol).toFixed(4), volumeError: +Math.abs(Math.abs(vol) - EXPECTED_VOLUME).toExponential(2) };
}

// ---- Route 1: three.js ExtrudeGeometry (plain JavaScript; earcut triangulation) -------------------
{
	const THREE = await import(D + '/node_modules/three/build/three.module.js');
	const build = () => {
		const s = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(W, 0), new THREE.Vector2(W, H), new THREE.Vector2(0, H)]);
		for (const x of xs) s.holes.push(new THREE.Path([new THREE.Vector2(x, SILL), new THREE.Vector2(x, SILL + OH), new THREE.Vector2(x + OW, SILL + OH), new THREE.Vector2(x + OW, SILL)]));
		const g = new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false });
		return { pos: g.attributes.position.array, nrm: g.attributes.normal.array, uv: g.attributes.uv.array };
	};
	const r = stats('r1_threejs_extrude_with_holes_ms', build);
	out.r1_check = check(r.pos, null);
}

// ---- Routes 2-4: Manifold (C++ compiled to WASM), result copied out with getMesh() ---------------
{
	const { default: Module } = await import(D + '/node_modules/manifold-3d/manifold.js');
	let t0 = now(); const wasm = await Module(); wasm.setup(); out.manifold_init_ms = +(now() - t0).toFixed(1);
	const { Manifold, CrossSection } = wasm;
	const outer = [[0, 0], [W, 0], [W, H], [0, H]];
	const holes = xs.map((x) => [[x, SILL], [x, SILL + OH], [x + OW, SILL + OH], [x + OW, SILL]].reverse());
	const copyOut = (m) => { const g = m.getMesh(); return { pos: g.vertProperties.slice(), idx: g.triVerts.slice(), np: g.numProp }; };
	const pos3 = (g) => { if (g.np === 3) return g.pos; const p = new Float32Array((g.pos.length / g.np) * 3); for (let i = 0, j = 0; i < g.pos.length; i += g.np, j += 3) { p[j] = g.pos[i]; p[j + 1] = g.pos[i + 1]; p[j + 2] = g.pos[i + 2]; } return p; };
	const free = (...ms) => ms.forEach((m) => m.delete());

	let r = stats('r2_manifold_extrude_with_holes_incl_profile_and_copyout_ms', () => {
		const cs = new CrossSection([outer, ...holes], 'EvenOdd'); const m = cs.extrude(T); const g = copyOut(m); free(cs, m); return g;
	});
	out.r2_check = check(pos3(r), r.idx);

	const wall = () => Manifold.cube([W, H, T]);
	const win = (x) => Manifold.cube([OW, OH, T + 0.2]).translate([x, SILL, -0.1]);
	r = stats('r3_manifold_batch_difference_incl_copyout_ms', () => {
		const parts = [wall(), ...xs.map(win)]; const m = Manifold.difference(parts); const g = copyOut(m); free(m, ...parts); return g;
	});
	out.r3_check = check(pos3(r), r.idx);

	r = stats('r4_manifold_sequential_40_subtracts_incl_copyout_ms', () => {
		let m = wall(); for (const x of xs) { const w = win(x); const n = m.subtract(w); free(m, w); m = n; } const g = copyOut(m); free(m); return g;
	}, { warm: 3, reps: 20 });
	out.r4_check = check(pos3(r), r.idx);
	out.manifold_heap_MB_after = +((wasm.HEAPU8?.length ?? 0) / 1048576).toFixed(1);
}

// ---- Routes 5-7: OCCT through replicad (B-rep), result tessellated with mesh() -------------------
{
	let t0 = now();
	const { default: opencascade } = await import(D + '/node_modules/replicad-opencascadejs/dist/replicad_single.js');
	const oc = await opencascade({ locateFile: () => D + '/node_modules/replicad-opencascadejs/dist/replicad_single.wasm' });
	const R = await import(D + '/node_modules/replicad/dist/replicad.js');
	R.setOC(oc); out.occt_init_ms = +(now() - t0).toFixed(1);
	const mesh = (s) => { const m = s.mesh({ tolerance: 0.001, angularTolerance: 0.1 }); return { pos: Float32Array.from(m.vertices), idx: Uint32Array.from(m.triangles) }; };

	let r = stats('r5_occt_extrude_face_with_holes_incl_mesh_ms', () => {
		let d = R.drawRectangle(W, H).translate(W / 2, H / 2);
		for (const x of xs) d = d.cut(R.drawRectangle(OW, OH).translate(x + OW / 2, SILL + OH / 2));
		return mesh(d.sketchOnPlane('XY').extrude(T));
	}, { warm: 2, reps: 10 });
	out.r5_check = check(r.pos, r.idx);

	const wall = () => R.makeBaseBox(W, H, T).translate([W / 2, H / 2, 0]);
	const win = (x) => R.makeBaseBox(OW, OH, T + 0.2).translate([x + OW / 2, SILL + OH / 2, -0.1]);
	r = stats('r6_occt_single_cut_by_compound_of_40_incl_mesh_ms', () => mesh(wall().cut(R.makeCompound(xs.map(win)))), { warm: 2, reps: 10 });
	out.r6_check = check(r.pos, r.idx);

	r = stats('r7_occt_sequential_40_cuts_incl_mesh_ms', () => { let w = wall(); for (const x of xs) w = w.cut(win(x)); return mesh(w); }, { warm: 1, reps: 5 });
	out.r7_check = check(r.pos, r.idx);
	out.occt_heap_MB_after = +(((oc.HEAPU8 && oc.HEAPU8.length) || 0) / 1048576).toFixed(1);
}

console.log(JSON.stringify(out, null, 1));
```

### 8.2 Production wall probe

A temporary Vitest file. It was deleted after the run and never committed.

```ts
// TEMPORARY research probe — not for commit. Times the production analytic Opening path.
import { it } from 'vitest';
import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	deriveChainSpans,
	legJoinsByWall,
	wallCubicChain,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	type LayoutWall,
	type LayoutWallCenterline
} from '@portfolio/layout-core';
import { buildStandaloneWallMesh } from '$lib/layout/wall-mesh-builder';

const N = 40, W = 20, OW = 0.3, OH = 1, SILL = 1;

function doc(centerline: LayoutWallCenterline, profile: 'rectangular' | 'rounded' | 'pointed') {
	const d = createEmptyWallFirstLayoutDocument();
	d.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION;
	d.junctions = [{ id: 'j1', point: [0, 0] }, { id: 'j2', point: [W, 0] }];
	d.walls = [{ id: 'w', startJunctionId: 'j1', endJunctionId: 'j2', thickness: 0.3, height: 3, centerline } as LayoutWall];
	d.openings = Array.from({ length: N }, (_, i) => ({
		id: `o${i}`, wallId: 'w', kind: 'window' as const, offset: 0.2 + i * 0.49, width: OW, height: OH, sillHeight: SILL, profile
	}));
	return d;
}

function stats(fn: () => unknown, warm = 5, reps = 50) {
	for (let i = 0; i < warm; i++) fn();
	const ts: number[] = [];
	for (let i = 0; i < reps; i++) { const a = performance.now(); fn(); ts.push(performance.now() - a); }
	ts.sort((x, y) => x - y);
	return { p50: +ts[Math.floor(reps / 2)].toFixed(3), p95: +ts[Math.floor(reps * 0.95)].toFixed(3), reps, warm };
}

it('probe', () => {
	const knot = { id: 'w:knot:1', point: [W / 2, 2] as [number, number] };
	const shapes: Record<string, LayoutWallCenterline> = {
		straight: { kind: 'line' },
		// chord 20 m, 2 m sagitta; arc length is longer than 20 m so all 40 openings still fit
		curved: wallCubicChain([knot], deriveChainSpans([[0, 0], knot.point, [W, 0]]))
	};
	const out: Record<string, unknown> = {};
	for (const [shape, centerline] of Object.entries(shapes)) {
		for (const profile of ['rectangular', 'rounded'] as const) {
			const d = doc(centerline, profile);
			const compiled = () => compileWallFirstLayoutGeometry(d);
			const c0 = compiled();
			const wall = c0.geometry.walls.find((w) => w.wallId === 'w');
			const issues = (c0 as { issues?: unknown[] }).issues?.length ?? 'n/a';
			if (!wall) { out[`${shape}_${profile}`] = { error: 'no compiled wall', issues }; continue; }
			const ends = legJoinsByWall(c0.geometry.junctions).get('w') ?? null;
			const mesh = () => buildStandaloneWallMesh(wall, 0, ends);
			const m0 = mesh() as unknown as { mesh?: { positions: ArrayLike<number>; indices: ArrayLike<number> } | null; issues?: unknown[] };
			out[`${shape}_${profile}`] = {
				compiledOpenings: wall.openings.length,
				compileIssues: issues,
				meshIssues: m0.issues?.length ?? 'n/a',
				tris: m0.mesh ? m0.mesh.indices.length / 3 : null,
				compile_ms: stats(compiled),
				mesh_ms: stats(mesh),
				compile_plus_mesh_ms: stats(() => { const c = compileWallFirstLayoutGeometry(d); const w = c.geometry.walls.find((x) => x.wallId === 'w')!; return buildStandaloneWallMesh(w, 0, legJoinsByWall(c.geometry.junctions).get('w') ?? null); })
			};
		}
	}
	console.log('PROBE_JSON ' + JSON.stringify(out));
});
```

### 8.3 Plain-JavaScript sweep, ruled strip and Coons patch

```js
// Plain-JS reference kernels: double-reflection RMF sweep (Wang et al. 2008), ruled surface w/ arc-length correspondence, bilinear Coons patch.
const now = () => performance.now();
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s], addv = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const norm = (a) => scale(a, 1 / Math.sqrt(dot(a, a))), cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function helix(n, r, pitch, turns) { const pts = [], tans = []; for (let i = 0; i < n; i++) { const t = (i / (n - 1)) * turns * 2 * Math.PI; pts.push([r * Math.cos(t), r * Math.sin(t), (pitch * t) / (2 * Math.PI)]); tans.push(norm([-r * Math.sin(t), r * Math.cos(t), pitch / (2 * Math.PI)])); } return { pts, tans }; }
function rmfDoubleReflection(pts, tans, r0) { const R = [r0]; for (let i = 0; i < pts.length - 1; i++) { const v1 = sub(pts[i + 1], pts[i]); const c1 = dot(v1, v1); const rL = sub(R[i], scale(v1, (2 / c1) * dot(v1, R[i]))); const tL = sub(tans[i], scale(v1, (2 / c1) * dot(v1, tans[i]))); const v2 = sub(tans[i + 1], tL); const c2 = dot(v2, v2); R.push(c2 === 0 ? rL : sub(rL, scale(v2, (2 / c2) * dot(v2, rL)))); } return R; }
function sweep(pts, tans, R, prof) { const n = pts.length, m = prof.length; const pos = new Float64Array(n * m * 3); const idx = new Uint32Array((n - 1) * m * 6); for (let i = 0; i < n; i++) { const s = cross(tans[i], R[i]); for (let j = 0; j < m; j++) { const [u, v] = prof[j]; const k = (i * m + j) * 3; pos[k] = pts[i][0] + R[i][0] * u + s[0] * v; pos[k + 1] = pts[i][1] + R[i][1] * u + s[1] * v; pos[k + 2] = pts[i][2] + R[i][2] * u + s[2] * v; } } let q = 0; for (let i = 0; i < n - 1; i++) for (let j = 0; j < m; j++) { const a = i * m + j, b = i * m + ((j + 1) % m), c = a + m, d = b + m; idx[q++] = a; idx[q++] = b; idx[q++] = d; idx[q++] = a; idx[q++] = d; idx[q++] = c; } return { pos, idx }; }
function resampleArcLength(poly, k) { const L = [0]; for (let i = 1; i < poly.length; i++) L.push(L[i - 1] + Math.sqrt(dot(sub(poly[i], poly[i - 1]), sub(poly[i], poly[i - 1])))); const out = []; let s = 0; for (let j = 0; j < k; j++) { const target = (j / (k - 1)) * L[L.length - 1]; while (s < L.length - 2 && L[s + 1] < target) s++; const t = (target - L[s]) / (L[s + 1] - L[s] || 1); out.push(addv(poly[s], scale(sub(poly[s + 1], poly[s]), t))); } return out; }
function ruled(a, b, k) { const A = resampleArcLength(a, k), B = resampleArcLength(b, k); const pos = new Float64Array(k * 2 * 3); for (let i = 0; i < k; i++) { pos.set(A[i], i * 6); pos.set(B[i], i * 6 + 3); } return pos; }
function coons(c0, c1, d0, d1, n) { const C0 = resampleArcLength(c0, n), C1 = resampleArcLength(c1, n), D0 = resampleArcLength(d0, n), D1 = resampleArcLength(d1, n); const P00 = C0[0], P10 = C0[n - 1], P01 = C1[0], P11 = C1[n - 1]; const pos = new Float64Array(n * n * 3); for (let i = 0; i < n; i++) { const u = i / (n - 1); for (let j = 0; j < n; j++) { const v = j / (n - 1); for (let a = 0; a < 3; a++) { const Lc = (1 - v) * C0[i][a] + v * C1[i][a], Ld = (1 - u) * D0[j][a] + u * D1[j][a]; const B = (1 - u) * (1 - v) * P00[a] + u * (1 - v) * P10[a] + (1 - u) * v * P01[a] + u * v * P11[a]; pos[(i * n + j) * 3 + a] = Lc + Ld - B; } } } return pos; }
const T = (label, fn, reps = 50) => { const ts = []; let r; for (let i = 0; i < reps; i++) { const a = now(); r = fn(); ts.push(now() - a); } ts.sort((x, y) => x - y); return [label, { p50: +ts[Math.floor(reps*0.5)].toFixed(2), p95: +ts[Math.min(reps-1,Math.floor(reps*0.95))].toFixed(2) }, r]; };
const prof = Array.from({ length: 24 }, (_, j) => [0.05 * Math.cos((j / 24) * 2 * Math.PI), 0.05 * Math.sin((j / 24) * 2 * Math.PI)]);
const out = {};
let [l, t, res] = T('helix2000_rmf_sweep24_ms', () => { const { pts, tans } = helix(2000, 1, 0.3, 6); const r0 = norm(cross(tans[0], [0, 0, 1])); const R = rmfDoubleReflection(pts, tans, r0); return sweep(pts, tans, R, prof); }); out[l] = t; out.sweepTris = res.idx.length / 3;
// determinism across runs (same engine)
const h1 = Buffer.from(T('x', () => sweep(...(() => { const { pts, tans } = helix(2000, 1, 0.3, 6); return [pts, tans, rmfDoubleReflection(pts, tans, norm(cross(tans[0], [0, 0, 1])))]; })(), prof), 1)[2].pos.buffer);
const h2 = Buffer.from(res.pos.buffer); out.sameEngineBitIdentical = Buffer.compare(h1, h2) === 0;
// RMF twist error: frame should stay orthogonal to tangent
{ const { pts, tans } = helix(2000, 1, 0.3, 6); const R = rmfDoubleReflection(pts, tans, norm(cross(tans[0], [0, 0, 1]))); let maxDot = 0; for (let i = 0; i < R.length; i++) maxDot = Math.max(maxDot, Math.abs(dot(R[i], tans[i]))); out.rmfMaxTangentDot = maxDot; }
const inner = helix(1500, 0.9, 0.3, 3).pts, outer = helix(900, 1.2, 0.3, 3).pts;
[l, t] = T('ruled_spiral_rail_2x(1500,900)->2000_ms', () => ruled(inner, outer, 2000)); out[l] = t;
const c0 = helix(300, 1, 0.2, 0.25).pts, c1 = helix(300, 1.5, 0.4, 0.25).pts.map(p => [p[0], p[1], p[2] + 1]);
const d0 = [c0[0], c1[0]], d1 = [c0[c0.length - 1], c1[c1.length - 1]];
[l, t] = T('coons_100x100_ms', () => coons(c0, c1, d0, d1, 100)); out[l] = t;
console.log(JSON.stringify(out, null, 1));
```

### 8.4 Manifold operations

```js
const D = process.argv[2];
const { default: Module } = await import(D + '/node_modules/manifold-3d/manifold.js');
const now = () => performance.now();
let t0 = now(); const wasm = await Module(); wasm.setup(); const tInit = now() - t0;
const { Manifold, CrossSection } = wasm;
const out = { initMs: +tInit.toFixed(1) };
const time = (label, fn, reps = 1) => { const ts = []; let r; for (let i = 0; i < reps; i++) { const a = now(); r = fn(); ts.push(now() - a); } ts.sort((x, y) => x - y); out[label] = reps === 1 ? +ts[0].toFixed(2) : { p50: +ts[Math.floor(reps * 0.5)].toFixed(2), p95: +ts[Math.floor(reps * 0.95)].toFixed(2) }; return r; };
// 1. sphere minus cube
const sph = Manifold.sphere(1, 256); const cube = Manifold.cube([1.2, 1.2, 1.2], true).translate([0.5, 0.5, 0.5]);
out.sphereTris = sph.numTri();
const diff = time('sphere256_minus_cube_ms', () => { const d = sph.subtract(cube); d.numTri(); return d; }, 20);
out.diffTris = diff.numTri(); out.diffStatus = diff.status();
// 2. two big spheres union
const s2 = Manifold.sphere(1, 512); const s3 = s2.translate([0.7, 0.2, 0.1]); out.bigSphereTris = s2.numTri();
time('sphere512_union_ms', () => { const u = s2.add(s3); u.numTri(); return u; }, 5);
// 3. coplanar cases
const box = Manifold.cube([1, 1, 1]); const box2 = Manifold.cube([1, 1, 1]).translate([0, 0, 1]);
const stacked = box.add(box2); out.stackedVolume = +stacked.volume().toFixed(6); out.stackedGenus = stacked.genus(); out.stackedTris = stacked.numTri();
const hole = box.subtract(Manifold.cube([0.5, 0.5, 1]).translate([0.25, 0.25, 0])); out.throughHoleGenus = hole.genus(); out.throughHoleVol = +hole.volume().toFixed(6);
const self = box.subtract(box); out.selfMinusEmpty = self.isEmpty();
// 4. wall with 40 window openings: extrude profile w/ holes; then per-edit boolean loop
const outer = [[0, 0], [20, 0], [20, 3], [0, 3]];
const holes = []; for (let i = 0; i < 40; i++) { const x = 0.2 + i * 0.49; holes.push([[x, 1], [x, 2], [x + 0.3, 2], [x + 0.3, 1]].reverse()); }
const cs = time('crosssection_40holes_ms', () => new CrossSection([outer, ...holes], 'EvenOdd'), 1);
const wall = time('extrude_wall_40holes_ms', () => { const m = cs.extrude(0.3); m.numTri(); return m; }, 50);
out.wallTris = wall.numTri();
// per-edit: wall minus 40 window boxes (3D boolean, batch)
const solidWall = Manifold.cube([20, 0.3, 3]);
const wins = []; for (let i = 0; i < 40; i++) wins.push(Manifold.cube([0.3, 0.5, 1]).translate([0.2 + i * 0.49, -0.1, 1]));
time('wall_minus_40_windows_batch_ms', () => { const r = Manifold.difference([solidWall, ...wins]); r.numTri(); return r; }, 50);
// 5. revolve
const prof = new CrossSection([[[1, 0], [1.2, 0], [1.2, 2], [1, 2]]]);
time('revolve_128seg_ms', () => { const m = prof.revolve(128); m.numTri(); return m; }, 50);
// 6. levelSet gyroid
const gyroid = (p) => { const s = 2 * Math.PI; return Math.sin(p[0] * s) * Math.cos(p[1] * s) + Math.sin(p[1] * s) * Math.cos(p[2] * s) + Math.sin(p[2] * s) * Math.cos(p[0] * s); };
const ls = time('levelset_gyroid_edge0.05_ms', () => { const m = Manifold.levelSet(gyroid, { min: [0, 0, 0], max: [1, 1, 1] }, 0.05, 0); m.numTri(); return m; }, 1);
out.levelsetTris = ls.numTri();
// 7. smooth + refine
const sm = time('smoothOut_refine8_cube_ms', () => { const m = Manifold.cube([1, 1, 1], true).smoothOut(60, 0.5).refine(8); m.numTri(); return m; }, 10);
out.smoothTris = sm.numTri();
// 8. provenance
const A = Manifold.cube([1, 1, 1], true).asOriginal(); const B = Manifold.cylinder(2, 0.3, 0.3, 64, true).asOriginal();
const R = A.subtract(B); const mg = R.getMesh();
out.prov = { idA: A.originalID(), idB: B.originalID(), resultID: R.originalID(), runOriginalID: Array.from(mg.runOriginalID), runIndex: Array.from(mg.runIndex), faceIDdistinct: new Set(Array.from(mg.faceID)).size, numTri: mg.numTri };
// 9. determinism: same op twice -> identical buffers?
const g1 = sph.subtract(cube).getMesh(), g2 = sph.subtract(cube).getMesh();
out.deterministic = Buffer.compare(Buffer.from(g1.vertProperties.buffer), Buffer.from(g2.vertProperties.buffer)) === 0 && Buffer.compare(Buffer.from(g1.triVerts.buffer), Buffer.from(g2.triVerts.buffer)) === 0;
// 10. getMesh copy cost for big mesh
const big = s2.add(s3); time('getMesh_big_ms', () => big.getMesh(), 5); out.bigTris = big.numTri();
console.log(JSON.stringify(out, null, 1));
```

### 8.5 OCCT operations

```js
const D = process.argv[2];
const now = () => performance.now();
const out = {};
let t0 = now();
const { default: opencascade } = await import(D + '/node_modules/replicad-opencascadejs/dist/replicad_single.js');
const oc = await opencascade({ locateFile: () => D + '/node_modules/replicad-opencascadejs/dist/replicad_single.wasm' });
out.initMs = +(now() - t0).toFixed(1);
const R = await import(D + '/node_modules/replicad/dist/replicad.js');
R.setOC(oc);
const time = (label, fn, reps = 1) => { const ts = []; let r; for (let i = 0; i < reps; i++) { const a = now(); r = fn(); ts.push(now() - a); } ts.sort((x, y) => x - y); out[label] = reps === 1 ? +ts[0].toFixed(1) : { p50: +ts[Math.floor(reps * 0.5)].toFixed(1), p95: +ts[Math.min(reps - 1, Math.floor(reps * 0.95))].toFixed(1) }; return r; };
const heap = () => { const b = (oc.HEAPU8 && oc.HEAPU8.length) || (oc.wasmMemory && oc.wasmMemory.buffer.byteLength) || (oc.HEAP8 && oc.HEAP8.length); return b ? +(b / 1048576).toFixed(0) : Object.keys(oc).filter(k=>k.startsWith("HEAP")||k.includes("emory")).join(","); };
out.heapMBAfterInit = heap();
time('box_fillet_all_edges_ms', () => R.makeBaseBox(10, 10, 10).fillet(1), 10);
time('box_chamfer_all_edges_ms', () => R.makeBaseBox(10, 10, 10).chamfer(1), 10);
const cylA = () => R.makeCylinder(3, 20, [0, 0, -10], [0, 0, 1]);
const cylB = () => R.makeCylinder(3, 20, [-10, 0, 0], [1, 0, 0]);
time('cyl_cyl_fuse_ms', () => cylA().fuse(cylB()), 10);
time('cyl_cyl_fuse_then_fillet_ms', () => cylA().fuse(cylB()).fillet(0.5), 5);
time('box_shell_ms', () => R.makeBaseBox(10, 10, 10).shell(0.5, (f) => f.inPlane('XY', 10)), 10);
time('loft_circle_to_rect_ms', () => R.drawCircle(3).sketchOnPlane('XY').loftWith([R.drawRoundedRectangle(8, 4, 0.5).sketchOnPlane('XY', 10)]), 10);
const filleted = R.makeBaseBox(10, 10, 10).fillet(1);
const mesh = time('mesh_filleted_box_tol0.01_ms', () => filleted.mesh({ tolerance: 0.01, angularTolerance: 0.1 }), 5);
out.meshTris = mesh.triangles.length / 3; out.faceGroups = mesh.faceGroups.length;
// wall with 40 window cuts
const wall = () => { let w = R.makeBaseBox(20, 0.3, 3).translate([10, 0.15, 0]); return w; };
time('wall_cut_40_windows_sequential_ms', () => { let w = wall(); for (let i = 0; i < 40; i++) w = w.cut(R.makeBaseBox(0.3, 0.5, 1).translate([0.35 + i * 0.49, 0.15, 1])); return w; }, 3);
out.heapMBBeforeLeakTest = heap();
for (let i = 0; i < 300; i++) { const f = cylA().fuse(cylB()); f.delete && f.delete(); }
out.heapMBAfter300Fuses = heap();
console.log(JSON.stringify(out, null, 1));
```

### 8.6 three-bvh-csg and JSCAD

```js
const D = process.argv[2];
const THREE = await import(D + '/node_modules/three/build/three.module.js');
const { Brush, Evaluator, SUBTRACTION, ADDITION } = await import(D + '/node_modules/three-bvh-csg/build/index.module.js');
const jscad = (await import(D + '/node_modules/@jscad/modeling/dist/jscad-modeling.min.js')).default ?? (await import(D + '/node_modules/@jscad/modeling/dist/jscad-modeling.min.js'));
const now = () => performance.now(); const out = {};
const time = (label, fn, reps = 1) => { const ts = []; let r; for (let i = 0; i < reps; i++) { const a = now(); r = fn(); ts.push(now() - a); } ts.sort((x, y) => x - y); out[label] = reps === 1 ? +ts[0].toFixed(1) : { p50: +ts[Math.floor(reps * 0.5)].toFixed(1), p95: +ts[Math.min(reps - 1, Math.floor(reps * 0.95))].toFixed(1) }; return r; };
const ev = new Evaluator(); ev.attributes = ['position', 'normal'];
const mk = (g) => { const b = new Brush(g); b.updateMatrixWorld(); return b; };
// sphere (~32k tris) minus cube
const sph = mk(new THREE.SphereGeometry(1, 256, 64)); out.bvhSphereTris = sph.geometry.index ? sph.geometry.index.count / 3 : sph.geometry.attributes.position.count / 3;
const cubeG = new THREE.BoxGeometry(1.2, 1.2, 1.2); cubeG.translate(0.5, 0.5, 0.5); const cube = mk(cubeG);
time('bvhcsg_sphere_minus_cube_ms', () => ev.evaluate(sph, cube, SUBTRACTION), 20);
// boundary edge count helper (open edges => non-watertight)
const openEdges = (geom) => { const p = geom.attributes.position; const idx = geom.index; const total = idx ? idx.count : p.count; const n = Math.min(geom.drawRange.count, total); const vi = (t) => idx ? idx.getX(t) : t; const key = (t) => { const i = vi(t); return `${p.getX(i).toFixed(6)},${p.getY(i).toFixed(6)},${p.getZ(i).toFixed(6)}`; }; const m = new Map(); for (let t = 0; t + 2 < n; t += 3) { const k = [key(t), key(t + 1), key(t + 2)]; for (let e = 0; e < 3; e++) { const a = k[e], b = k[(e + 1) % 3]; const f = a + '|' + b, r = b + '|' + a; if (m.has(r)) { m.set(r, m.get(r) - 1); if (m.get(r) === 0) m.delete(r); } else m.set(f, (m.get(f) || 0) + 1); } } return m.size; };
const r1 = ev.evaluate(sph, cube, SUBTRACTION); out.bvhcsg_sphere_minus_cube_openEdges = openEdges(r1.geometry);
// coplanar: stacked boxes union, and through-hole subtraction
const b1 = mk(new THREE.BoxGeometry(1, 1, 1)); const g2 = new THREE.BoxGeometry(1, 1, 1); g2.translate(0, 0, 1); const b2 = mk(g2);
const st = ev.evaluate(b1, b2, ADDITION); out.bvhcsg_stacked_union_openEdges = openEdges(st.geometry); out.bvhcsg_stacked_tris = Math.min(st.geometry.drawRange.count, st.geometry.index ? st.geometry.index.count : st.geometry.attributes.position.count) / 3;
const hg = new THREE.BoxGeometry(0.5, 0.5, 1); const hb = mk(hg);
const th = ev.evaluate(b1, hb, SUBTRACTION); out.bvhcsg_coplanar_throughhole_openEdges = openEdges(th.geometry);
// wall minus 40 windows (sequential)
const wallG = new THREE.BoxGeometry(20, 0.3, 3); wallG.translate(10, 0.15, 1.5);
const wins = []; for (let i = 0; i < 40; i++) { const g = new THREE.BoxGeometry(0.3, 0.5, 1); g.translate(0.35 + i * 0.49, 0.15, 1.5); wins.push(mk(g)); }
const wres = time('bvhcsg_wall_minus_40_windows_seq_ms', () => { let w = mk(wallG.clone()); for (const b of wins) { w = ev.evaluate(w, b, SUBTRACTION); } return w; }, 5);
out.bvhcsg_wall_openEdges = openEdges(wres.geometry);
// JSCAD
const { primitives, booleans, extrusions, geometries } = jscad;
const js = primitives.sphere({ radius: 1, segments: 256 }); out.jscadSpherePolys = geometries.geom3.toPolygons(js).length;
const jc = primitives.cuboid({ size: [1.2, 1.2, 1.2], center: [0.5, 0.5, 0.5] });
time('jscad_sphere_minus_cube_ms', () => booleans.subtract(js, jc), 3);
const jw = primitives.cuboid({ size: [20, 0.3, 3], center: [10, 0.15, 1.5] }); const jwins = []; for (let i = 0; i < 40; i++) jwins.push(primitives.cuboid({ size: [0.3, 0.5, 1], center: [0.35 + i * 0.49, 0.15, 1.5] }));
time('jscad_wall_minus_40_windows_ms', () => booleans.subtract(jw, ...jwins), 3);
time('jscad_extrudeHelical_ms', () => extrusions.extrudeHelical({ angle: Math.PI * 8, pitch: 1, segmentsPerRotation: 64 }, primitives.circle({ radius: 0.2, center: [2, 0] })), 5);
console.log(JSON.stringify(out, null, 1));
```

### 8.7 Worker hand-off and validity baseline

```js
import { Worker } from 'node:worker_threads';
const w = new Worker(`const { parentPort } = require('node:worker_threads'); parentPort.on('message', (m) => { parentPort.postMessage(m.transfer ? m : { ack: m.pos.length }, m.transfer ? [m.pos.buffer, m.idx.buffer] : []); });`, { eval: true });
const tris = 185000; const make = () => ({ pos: new Float32Array(tris * 3), idx: new Uint32Array(tris * 3) });
const rt = (msg, transfer) => new Promise((res) => { const t = performance.now(); w.once('message', () => res(performance.now() - t)); w.postMessage(msg, transfer); });
const res = { clone: [], transfer: [] };
for (let i = 0; i < 30; i++) { const m = make(); res.clone.push(await rt({ ...m, transfer: false })); const m2 = make(); res.transfer.push(await rt({ ...m2, transfer: true }, [m2.pos.buffer, m2.idx.buffer])); }
const p = (a, q) => { const s = [...a].sort((x, y) => x - y); return +s[Math.floor(q * (s.length - 1))].toFixed(2); };
console.log(JSON.stringify({ payloadMB: +((tris * 3 * 4 * 2) / 1048576).toFixed(1), clone_oneway_plus_ack_ms: { p50: p(res.clone, 0.5), p95: p(res.clone, 0.95) }, transfer_roundtrip_ms: { p50: p(res.transfer, 0.5), p95: p(res.transfer, 0.95) } }));
await w.terminate();
```

```js
const D = process.argv[2];
const THREE = await import(D + '/node_modules/three/build/three.module.js');
const src = (await import('node:fs')).readFileSync(new URL('./js_bench.mjs', import.meta.url), 'utf8');
const line = src.split('\n').find(l => l.startsWith('const openEdges'));
const openEdges = eval(line.replace('const openEdges = ', ''));
console.log('sphere256x64 input openEdges', openEdges(new THREE.SphereGeometry(1, 256, 64)));
console.log('box input openEdges', openEdges(new THREE.BoxGeometry(20, 0.3, 3)));
```

## 9. Raw output

### 9.1 Matched wall probe

```json
{
 "env": {
  "node": "v26.7.0",
  "arch": "arm64",
  "platform": "darwin"
 },
 "r1_threejs_extrude_with_holes_ms": {
  "p50": 0.765,
  "p95": 3.503,
  "reps": 50,
  "warm": 5
 },
 "r1_check": {
  "tris": 656,
  "openEdges": 160,
  "volume": 14.4,
  "volumeError": 0.00000104
 },
 "manifold_init_ms": 16.5,
 "r2_manifold_extrude_with_holes_incl_profile_and_copyout_ms": {
  "p50": 1.286,
  "p95": 3.009,
  "reps": 50,
  "warm": 5
 },
 "r2_check": {
  "tris": 812,
  "openEdges": 0,
  "volume": 14.4,
  "volumeError": 0.00000104
 },
 "r3_manifold_batch_difference_incl_copyout_ms": {
  "p50": 3.734,
  "p95": 7.91,
  "reps": 50,
  "warm": 5
 },
 "r3_check": {
  "tris": 812,
  "openEdges": 0,
  "volume": 14.4,
  "volumeError": 0.00000104
 },
 "r4_manifold_sequential_40_subtracts_incl_copyout_ms": {
  "p50": 3.523,
  "p95": 4.383,
  "reps": 20,
  "warm": 3
 },
 "r4_check": {
  "tris": 812,
  "openEdges": 0,
  "volume": 14.4,
  "volumeError": 0.00000104
 },
 "manifold_heap_MB_after": 0,
 "occt_init_ms": 221,
 "r5_occt_extrude_face_with_holes_incl_mesh_ms": {
  "p50": 119.861,
  "p95": 130.279,
  "reps": 10,
  "warm": 2
 },
 "r5_check": {
  "tris": 812,
  "openEdges": 0,
  "volume": 14.4,
  "volumeError": 0.00000104
 },
 "r6_occt_single_cut_by_compound_of_40_incl_mesh_ms": {
  "p50": 198.644,
  "p95": 326.684,
  "reps": 10,
  "warm": 2
 },
 "r6_check": {
  "tris": 812,
  "openEdges": 0,
  "volume": 14.4,
  "volumeError": 0.00000104
 },
 "r7_occt_sequential_40_cuts_incl_mesh_ms": {
  "p50": 717.329,
  "p95": 719.047,
  "reps": 5,
  "warm": 1
 },
 "r7_check": {
  "tris": 812,
  "openEdges": 0,
  "volume": 14.4,
  "volumeError": 0.00000104
 },
 "occt_heap_MB_after": 0
}
```

### 9.2 Production wall probe

```json
{
 "straight_rectangular": {
  "compiledOpenings": 40,
  "compileIssues": 0,
  "meshIssues": 0,
  "tris": 2672,
  "compile_ms": {
   "p50": 0.933,
   "p95": 2.296,
   "reps": 50,
   "warm": 5
  },
  "mesh_ms": {
   "p50": 2.452,
   "p95": 3.358,
   "reps": 50,
   "warm": 5
  },
  "compile_plus_mesh_ms": {
   "p50": 3.316,
   "p95": 4.767,
   "reps": 50,
   "warm": 5
  }
 },
 "straight_rounded": {
  "compiledOpenings": 40,
  "compileIssues": 0,
  "meshIssues": 0,
  "tris": 7456,
  "compile_ms": {
   "p50": 0.912,
   "p95": 1.144,
   "reps": 50,
   "warm": 5
  },
  "mesh_ms": {
   "p50": 6.784,
   "p95": 7.968,
   "reps": 50,
   "warm": 5
  },
  "compile_plus_mesh_ms": {
   "p50": 8.199,
   "p95": 10.102,
   "reps": 50,
   "warm": 5
  }
 },
 "curved_rectangular": {
  "compiledOpenings": 40,
  "compileIssues": 0,
  "meshIssues": 0,
  "tris": 3488,
  "compile_ms": {
   "p50": 1.406,
   "p95": 3.181,
   "reps": 50,
   "warm": 5
  },
  "mesh_ms": {
   "p50": 3.703,
   "p95": 11.411,
   "reps": 50,
   "warm": 5
  },
  "compile_plus_mesh_ms": {
   "p50": 4.78,
   "p95": 5.751,
   "reps": 50,
   "warm": 5
  }
 },
 "curved_rounded": {
  "compiledOpenings": 40,
  "compileIssues": 0,
  "meshIssues": 0,
  "tris": 8288,
  "compile_ms": {
   "p50": 1.358,
   "p95": 2.838,
   "reps": 50,
   "warm": 5
  },
  "mesh_ms": {
   "p50": 8.192,
   "p95": 9.902,
   "reps": 50,
   "warm": 5
  },
  "compile_plus_mesh_ms": {
   "p50": 9.302,
   "p95": 10.889,
   "reps": 50,
   "warm": 5
  }
 }
}
```

### 9.3 Re-run of the other probes

```json
{
 "plain_ts_sweep": {
  "helix2000_rmf_sweep24_ms": {
   "p50": 0.83,
   "p95": 4.54
  },
  "sweepTris": 95952,
  "sameEngineBitIdentical": true,
  "rmfMaxTangentDot": 3.316791286067655e-15,
  "ruled_spiral_rail_2x(1500,900)->2000_ms": {
   "p50": 0.19,
   "p95": 0.57
  },
  "coons_100x100_ms": {
   "p50": 0.2,
   "p95": 0.5
  }
 },
 "manifold_bench": {
  "initMs": 12.2,
  "sphereTris": 32768,
  "sphere256_minus_cube_ms": {
   "p50": 15.99,
   "p95": 31.28
  },
  "diffTris": 27976,
  "diffStatus": "NoError",
  "bigSphereTris": 131072,
  "sphere512_union_ms": {
   "p50": 133.73,
   "p95": 138.64
  },
  "stackedVolume": 2,
  "stackedGenus": 0,
  "stackedTris": 20,
  "throughHoleGenus": 1,
  "throughHoleVol": 0.75,
  "selfMinusEmpty": true,
  "crosssection_40holes_ms": 2.45,
  "extrude_wall_40holes_ms": {
   "p50": 0.74,
   "p95": 0.88
  },
  "wallTris": 812,
  "wall_minus_40_windows_batch_ms": {
   "p50": 3,
   "p95": 3.27
  },
  "revolve_128seg_ms": {
   "p50": 0.35,
   "p95": 0.38
  },
  "levelset_gyroid_edge0.05_ms": 19.61,
  "levelsetTris": 11568,
  "smoothOut_refine8_cube_ms": {
   "p50": 0.73,
   "p95": 2.3
  },
  "smoothTris": 768,
  "prov": {
   "idA": 4266,
   "idB": 4269,
   "resultID": -1,
   "runOriginalID": [
    4266,
    4269
   ],
   "runIndex": [
    0,
    432,
    816
   ],
   "faceIDdistinct": 66,
   "numTri": 272
  },
  "deterministic": true,
  "getMesh_big_ms": {
   "p50": 3.12,
   "p95": 138.58
  },
  "bigTris": 184764
 },
 "occt_bench": {
  "initMs": 113.7,
  "heapMBAfterInit": 100,
  "box_fillet_all_edges_ms": {
   "p50": 15.4,
   "p95": 74.1
  },
  "box_chamfer_all_edges_ms": {
   "p50": 15,
   "p95": 21.3
  },
  "cyl_cyl_fuse_ms": {
   "p50": 19.4,
   "p95": 90.2
  },
  "cyl_cyl_fuse_then_fillet_ms": {
   "p50": 37.8,
   "p95": 73.3
  },
  "box_shell_ms": {
   "p50": 5.1,
   "p95": 27.6
  },
  "loft_circle_to_rect_ms": {
   "p50": 5.4,
   "p95": 30.7
  },
  "mesh_filleted_box_tol0.01_ms": {
   "p50": 30.6,
   "p95": 44.7
  },
  "meshTris": 9460,
  "faceGroups": 26,
  "wall_cut_40_windows_sequential_ms": {
   "p50": 804.6,
   "p95": 1702.3
  },
  "heapMBBeforeLeakTest": 1073,
  "heapMBAfter300Fuses": 1073
 },
 "js_bench": {
  "bvhSphereTris": 32256,
  "bvhcsg_sphere_minus_cube_ms": {
   "p50": 28.2,
   "p95": 113.5
  },
  "bvhcsg_sphere_minus_cube_openEdges": 1096,
  "bvhcsg_stacked_union_openEdges": 0,
  "bvhcsg_stacked_tris": 20,
  "bvhcsg_coplanar_throughhole_openEdges": 32,
  "bvhcsg_wall_minus_40_windows_seq_ms": {
   "p50": 143.9,
   "p95": 161.9
  },
  "bvhcsg_wall_openEdges": 3856,
  "jscadSpherePolys": 32768,
  "jscad_sphere_minus_cube_ms": {
   "p50": 15934.6,
   "p95": 16186.4
  },
  "jscad_wall_minus_40_windows_ms": {
   "p50": 9.1,
   "p95": 17
  },
  "jscad_extrudeHelical_ms": {
   "p50": 8.5,
   "p95": 37
  }
 },
 "transfer": {
  "payloadMB": 4.2,
  "clone_oneway_plus_ack_ms": {
   "p50": 0.77,
   "p95": 1.73
  },
  "transfer_roundtrip_ms": {
   "p50": 0.02,
   "p95": 0.06
  }
 },
 "baseline": [
  "sphere256x64 input openEdges 128",
  "box input openEdges 0"
 ]
}
```

EVIDENCE-PATHS: end
