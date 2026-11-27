# T5 solid geometry research

**Recommendation: narrow `studio.solid-combine` to replayed, axis-aligned rectangular stock and
rectangular cut/add operands for recessed casework.** Manifold 3.5.4 passed that geometric
envelope with independent validation and exact replay. Near-contact and mesh reimport produced
counterexamples. A direct orthogonal evaluator also reconstructed this envelope. The evidence
supports the source family while leaving the evaluator and any dependency admission open.

This is the executable follow-up to [the T5 umbrella](../../../docs/plans/t5-expressive-geometry/umbrella-plan.md#solid-route-evidence-and-admitted-cutadd).
It starts from merged PR6 (`607795c39`). The [retained comparison corpus](../PROPOSAL.md#retained-comparison-corpus)
supplied the vitrine, reversals, grazing joins, loop cases and surface lifecycle questions.
The [retained kernel probes](../../native-creative-depth/probe-methods.md) supplied the 3.5.4 pin,
flush joins, through hole, repeated cuts and window wall. The L and collinear cases adapt
[the existing profile corpus](../../../packages/geometry-core/tests/__fixtures__/corpus.ts).
The [Native Form Lab](../../../prototypes/native-form-lab/FINDINGS.md) supplied the pattern of
keyed roles, refused edits that keep the accepted snapshot, and split or retired roles.

## Reproduce

From this directory, use Node 22 or later, npm and tar.

```sh
node prepare.mjs
node run.mjs --verify
node run.mjs --verify --timings
node serve.mjs
```

Preparation verifies the npm tarball by SHA-512 and extracts just the JS glue, WASM and licence into
a gitignored local directory. Open the printed URL in each browser. The page runs the full corpus
on the main thread and in a module worker. Both verify the pinned exact digests. Append
`?timings` for warm worker timing or `?timings&post` to emit a JSON record from the local server.
Serve from loopback with the included CSP. The check uses `wasm-unsafe-eval` for WASM compilation.
To repeat Linux x64 from another architecture with Docker:

```sh
docker run --rm --platform linux/amd64 -v "$PWD:/probe:ro" -w /probe \
  node:22-bookworm-slim node run.mjs --verify
```

[Results](./results.json) retain every named fixture, revision and grazing sweep plus machine/browser
metadata and timing. [Golden hashes](./goldens.json) are exact for the supported fixtures, 64 seeded
stress cases and 20 revision proposals. A digest sorts vertices and oriented triangles while
preserving exact exported coordinates, signed zero, connectivity, role and backside. Native run
IDs are resolved to source roles before hashing. Vertices at coincident topological positions
make this digest undefined. Reversed union arguments can yield different valid triangulations.
The writer must choose one operand order. Shape and role agreement is the metamorphic check.

## Creator journey and correctness

The stock is a block with a blind interior recess and a wider, shallower rebate that seats a
panel. An overlapping rear pad adds continuous material. Neither a through-profile hole nor a
collection of separate panels captures the blind recess and its revision as one solid. The
front stays open through the cutter's explicit overshoot. We revised the stock width and recess
floor 20 times while retaining the rebate and pad coordinates and each operation ID. Swapping the
authored order of an intersecting cut and add changed the volume from 0.9838 to 0.8956 m³ in the
order fixture, so the program order carries meaning. The research transaction verifies each
prefix before publishing JSON source and leaves the previous source bytes intact on refusal.
Cold JSON reopen and earlier-snapshot restore reproduced their expected hashes.

The independent oracle partitions authored box planes into occupied cells, then derives
volume, connected components and exposed oriented tiles with expected source roles. It compares
every output triangle to those tiles, checking plane error, uncovered and excess area, overlaps
and attribution. Mesh checks independently cover directed edge multiplicity, vertex fans,
coincident vertices, exact vertex-on-edge incidence and signed volume. An additional casework
oracle integrates four depth bands and compares cross-section area by slicing the triangle mesh.
Negative controls put a same-volume recess in the wrong location, corrupt role assignments, and
remove or duplicate a triangle. Each is detected. The oracle deliberately bounds a rectilinear
family. The area margin and topology tests do not certify arbitrary triangle intersections.

- All 11 supported named cases and all 64 seeded offset variants passed, including a 1 mm back
  at the origin, an offset thin back with margin, through cuts, a side rebate and overlapping pads.
  The through cut has Euler characteristic 0. The vitrine has one shell and 60 triangles.
- Closed cuts, a later add that seals a void, split output, total removal, ineffective tools,
  disjoint adds, point or edge contact, coplanar tool planes, sub-millimetre separations,
  unbounded values and excess operations refused. The L with a collinear vertex and a previously
  pierced stock also passed their raw section and boundary checks, but are excluded from the
  proposed family. This corpus is too small to admit their profile grammar.
- Face-flush stacks, equal-cap through cuts and the 0.9 mm back succeeded in specific raw tests.
  The conservative predicate still refuses them. In the coplanar overlap fixture one boundary
  tile had two independently admissible source roles. Edge-touch returned `NoError` with two
  indexed shells, both individually closed, yet had two exact vertex-on-edge incidences.
  Point-touch returned two vertices at the same geometric position.
- The two-box #1888 literal and its scale/translation variants did not reproduce the historical
  8% loss. The largest relative kernel volume discrepancy for those was under 9e-13, but
  argument reversal generated degenerate exports in all three settings and the translated
  reversal had two coincident vertices. Across the rotated three-box follow-up and five-box
  upstream regression, the exposed paths also avoided the reported gross volume losses,
  yet returned multiple shells and some duplicate vertices or degenerate faces. The original
  rotated native repro uses a MeshGL64 reimport. The JavaScript internal and Float32-import
  variants do not reproduce that binding path. Upstream later fixed stale face normals and
  references during degenerate splitting. That is a correctable kernel defect. In contrast,
  tiny gaps collapse when exported below Float32 resolution, and overlapping coplanar authorship
  is inherently underdetermined without a policy. [Original #1888 fixtures](https://github.com/elalish/manifold/issues/1888) ·
  [Upstream fix and five-box regression](https://github.com/elalish/manifold/pull/1924)
- In the overlap-to-gap sweep, the kernel reported one shell at zero and two on the gap side
  down to 1e-10 m. An exported plane at `1 + 1e-8` m has the same Float32 value as `1` m.
  The research guard avoids accepting topology based on such distinctions.

## Revision and appearance

| Method | Geometry, 20 revisions | Provenance, 20 revisions | Exact returns, 10 reversals | Triangle counts |
| --- | ---: | ---: | ---: | ---: |
| Rebuild from source | 20 | 20 | 10 | 60 |
| Carry the last in-memory solid and apply width/floor deltas | 20 | 0 | 0 | 76–88 |
| Same deltas with JS mesh export and reimport after every edit | 0 | 0 | 0 | 74–82 |

The chains use set deltas representing the same width and floor moves. Their volumes agreed to
within 1.45e-8 m³, so volume alone would pass all the revisions. The in-memory chain preserved the
shape but introduced replacement faces attributed to the delta tools, changing which source
owns the floor or outer end. This is a limitation of retaining just the evaluated solid and
the edit deltas. An explicit source-role scheme could label those replacement faces.
The export chain left a sliver beside the filled floor: the existing wall was at the Float32
value 0.550000011920929 m while the reauthored fill stopped at 0.55 m. The first exported result
had about 0.0126 m² of excess internal sheets across the collapsed gap. The witness triangle is
retained in the results. The fix for this path is to avoid using exported coordinates as the next
Boolean input. Holding upstream source is also what makes identity recoverable.

For replay, `runOriginalID` and `faceID` resolve to the source operand ID and one of its six
signed-axis roles. Cutter surfaces carry the operand's backside flag. Diagnostic material tokens
associated each stock, recess, rebate and pad with its own surfaces and the whole-body finish
token survived source serialization. A trench split the same top role into two patches, and
another cut erased it. A role describes a set and cannot choose a singular surviving patch.
First scope should expose only whole-body untextured finishes. The experiment establishes planar
role correspondence and backside, with UV transfer, texture seams, per-face paint and attachment
remapping still open.

## Precision and execution cost

The retained npm package is `manifold-3d@3.5.4`, release source commit
`ce50d78021d64507f89e8c9fc2c2e51018117857`. WASM exposes `warpBatch` with Float64 coordinates.
The measured internal stock edge was exactly 0.923456789 m. The exported edge was
0.9234567880630493 m, its Float32 rounding. `Mesh` properties and run transforms are Float32,
indices are Uint32, and this JS build provides no public Mesh64 import or export. The measured
kernel tolerance for the vitrine was 9.2346e-13 m. The independent geometric comparison allows
2.1 µm of plane displacement over the proposed ±50 m local frame, with observed stress maximum
1.903 µm. This is separate from the 1 mm authored-feature guard and exact digest comparison.
Source and planar predicates use ordered binary64 values. A decimal 1 mm wall translated to
large local coordinates can subtract to just below the guard, as demonstrated near 46 m.
The guard refuses that represented value. The consuming implementation needs a deliberate
numeric-entry and threshold policy. [Pinned release](https://github.com/elalish/manifold/releases/tag/v3.5.4)

The page and worker matched all supported Node digests in Chromium and Gecko on an Apple M2
with 16 GB RAM. Linux x64 Node 22 in Docker also matched. Measured init, mesh export and
independent-oracle latency are in the results. A single vitrine took about 1–2 ms at the worker
p95 for the kernel plus extraction. The eight-cut case spent more time in the full research
oracle than in kernel evaluation. A retained 40-cut comparison exceeds the proposed scope and
measures kernel work only. The files total 623,841 bytes raw and 175,947 bytes with offline Brotli.
The browser evidence covers WASM initialization, execution and reproducibility. It leaves
Stage presentation, product-worker scheduling and transfer, mobile memory and long-session
behavior open.

A small direct face experiment built an oriented mesh from exposed orthogonal cells, with
Float64 positions taken directly from planes. It matched all supported named fixtures and the
separate vitrine depth-band arithmetic. Its subdivision emitted 492 triangles for the vitrine
and 1,324 for eight cuts, versus Manifold's 60 and 172. The raw direct grid was slower for eight
cuts than kernel meshing, and the reference grid grows across all three axes. This rules out
assuming that orthogonal meshing is free. It establishes a viable correctness baseline for
comparing a more efficient implementation or a reviewed kernel.

## Handoff to `studio.solid-combine`

- Use an ordered source program over one local rectangular extrusion, with stable cut/add IDs
  and independently captured rectangular extrusion operands aligned to the same local axes.
  Clamp scope to at most eight operations, 100,000 derived triangles, finite coordinates within
  ±50 m, and at least 1 mm between every different operand's parallel source planes, including
  stock and planes retired by prior operations. In this envelope any shared parallel plane also
  refuses. Require positive overlap for add and an opening to exterior for cut. Each step must
  change the solid and leave one nonempty connected shell without sealed voids. Through cuts use
  explicit clearance outside both stock planes. For the research corpus the triangle guard was
  exercised as an upper-bound check with small meshes. No fixture approached 100,000 triangles.
- Choose a direct evaluation of the orthogonal boundary or a reviewed kernel artifact. For a new
  kernel pin, rerun the literal corpus, exact outputs and failure cases on Linux and both browser
  engines. Carry double precision through source and validation, enforce the declared
  coordinate-error bound if exporting Float32 from the kernel, and isolate final display
  quantization. Pin triangle ordering and role policy independently of incidental run IDs.
  Profile holes, arbitrary rotations and intentional flush contacts need their own admissible
  predicates, oracle fixtures and correspondence decisions.
- Fix the runtime validator and staging budget. Select the required per-step proofs, bound
  validation and scheduling costs across affected bodies, and validate before acceptance.
  Resolve Plan footprints, contact and support, hit/pick provenance, renderer and Preview with
  the actual evaluator. Verify worker startup, responsiveness and stale reply handling,
  crash/retry, Save during preparation, cold reopen and library copies in the consuming change.
- If shipping Manifold, review the exact released bytes, build inputs and notices. The npm
  artifact declares Apache-2.0 and the tagged sources include a Clipper2 backend build path
  and Emscripten runtime. Confirm the precise linked components, source locations and notices
  in the selected build, along with browser distribution and CSP. No production dependency
  verdict follows from this isolated probe. [Tagged WASM build](https://github.com/elalish/manifold/blob/v3.5.4/bindings/wasm/CMakeLists.txt) ·
  [Tagged dependency configuration](https://github.com/elalish/manifold/blob/v3.5.4/cmake/manifoldDeps.cmake)
