# P23-H3 — Robust geometry / wall topology / face extraction harvest

**Status:** completed evidence harvest — 2026-09-08  
**Museum Editor baseline:** `toni8699/spatial-sketch-editor@6365c6efe3f308712bf735886f08e15657143459` (`docs: stage P23 wall-first replan proposal`)  
**Scope:** P23-H3 only — robust straight-segment classification, explicit wall noding/splitting, boundary-wall face extraction, topology diagnostics and fixture provenance.  
**Not authority to implement:** this artifact supplies evidence to the later wall-first P23 reconciliation. It does not amend P23 plans, H1/H2, trackers or product code.

## 1. Executive result

The staged wall-first direction is technically sound if Museum keeps the topology layer **small, explicit and renderer-neutral**.

H3 recommends:

1. first-class `LayoutJunction` + straight `LayoutWall` records, with Junction IDs as the only connectivity authority;
2. a narrow typed straight-segment classifier backed by `robust-predicates` orientation, not the current tolerance-scaled boolean intersection helper;
3. explicit T/X noding as an **authoring operation** that rewrites Wall/Junction records atomically before commit;
4. boundary-wall-only directed-edge traversal for candidate-face extraction; `partition` Walls remain physical but do not split semantic Room faces;
5. JTS-style diagnostics — dangles, cut edges, invalid rings and non-noded input — without JTS-style deletion or a JTS geometry model;
6. persistent `LayoutRoom` identity remaining outside geometry/topology. Candidate faces carry deterministic derived keys and oriented Wall references only.

Hard boundary:

> **Geometry/topology may derive candidate faces. It must not allocate, regenerate, retire, split, merge, or otherwise own persistent Museum `LayoutRoom` identities.**

The separate H5 Room-identity / migration study must decide correspondence and migration semantics.

---

## 2. Current Museum ground truth at H3 baseline

The wall-first proposal at `6365c6e` is staging architecture context; product code beneath it is unchanged from parent `1f0d02b`. H3 rechecked the current seams rather than assuming H1's older baseline.

| Concern | Current Museum seam | H3 consequence |
|---|---|---|
| Authored layout shape | `packages/layout-core/src/layout-types.ts` | Current `LayoutRoom` owns `boundary.segments`, `wallThickness` and `openings`; this ownership is the major schema assumption wall-first supersedes. |
| Room/segment editing | `apps/editor/src/lib/editor/layout/layout-editing.ts` | `replaceRoomVertex` / `replaceRoomPoints` mutate an ordered room ring. These remain legacy/migration seams, not the future primary Wall/Junction mutation path. |
| Opening editing | `apps/editor/src/lib/editor/layout/layout-opening-editing.ts` | Physical-meter `offset` semantics are retained, but the host changes from Room segment to first-class Wall. |
| Geometry validation | `packages/layout-core/src/layout-geometry-validation.ts` | Current closure uses coordinate tolerance; self-intersection is sampled/boolean. Wall-first needs typed topology diagnostics and explicit noding. |
| Intersection math | `packages/layout-core/src/layout-geometry-curve.ts` | `polylineSegmentsIntersect()` uses tolerance-scaled orientation and returns only boolean; it cannot distinguish endpoint touch, T, X, collinear overlap or topology ownership. Keep for curve compatibility, not canonical straight-wall topology. |
| Tolerance | `packages/layout-core/src/layout-geometry-openings.ts` | `LAYOUT_GEOMETRY_EPSILON = 1e-6` currently serves several geometry comparisons. It must not become connectivity or robust-orientation policy. |
| Compiler | `packages/layout-core/src/layout-geometry.ts` | `compileLayoutGeometry()` currently compiles each Room independently. Evolve this same boundary; do not create a second topology/compiler path. |
| Compiled queries | `packages/layout-core/src/layout-geometry-queries.ts` + geometry types | Retain as Plan/snap/hit source. New Wall/Junction/face records should be emitted from compiler output, not reconstructed by SVG. |
| Room transform | `apps/editor/src/lib/editor/layout/layout-room-transform.ts` | Current room-unit transform moves boundary geometry + room-owned Layout objects. Shared wall topology makes this implementation assumption migration-sensitive; H3 does not redefine Room transform semantics. |
| Transaction/history | `apps/editor/src/lib/editor/layout/layout-mutation-runner.ts`, `layout-transaction.ts` | Retain. One wall insertion/split/noding intent = one atomic Layout transaction; rejection = no history. |
| Existing validation fixture | `apps/editor/tests/lib/editor/layout/layout-validation.test.ts` | Current test accepts a `0.0000005 m` endpoint mismatch as closed. Under explicit Junction IDs this no longer defines connectivity; repurpose as a near-coincident-distinct-junction diagnostic fixture. |
| H2 Plan boundary | `PlanRenderModel`, `PlanSvg.svelte`, plan interaction/query seams | Retain. Topology, faces and split decisions stay outside renderer/selection code. |

### Current math gap is semantic, not only numerical

The current straight/curve intersection helper effectively answers:

```text
"Do these sampled spans intersect within this tolerance?"
```

Wall-first topology needs:

```text
none
shared explicit junction
endpoint-on-interior (T)
proper interior-interior crossing (X)
collinear endpoint touch
collinear overlap
invalid / numerically unstable
```

Therefore H3 requires a new typed straight-wall classifier even if current P23.7 degeneracy tests happen to pass the old boolean helper.

---

## 3. Upstream disposition summary

| Repo | Exact revision inspected | License rechecked live | H3 disposition | Narrow result |
|---|---|---|---|---|
| `mourner/robust-predicates` | `db6dca0dd05fbccf04c66e479361e84a5416f1ca` | Unlicense / public-domain dedication; package `3.0.3` | **PORT** | Use only robust `orient2d` behind a Museum X/Z adapter; fixture provenance may be ported. No general geometry model comes with it. |
| `alexbol99/flatten-js` | `5c02ff087b16d82c8c7d3a76086856c2bd3df58f` | MIT; package `@flatten-js/core@1.6.14` | **ADAPT** | Strong segment-intersection and failure fixtures; useful Face orientation vocabulary. Reject global mutable tolerance and Polygon/Face as project/topology truth. |
| `locationtech/jts` | `7e2b0e5d53fa411d6b58b8e5b395b1361f9711f8` | EPL-2.0 **or** EDL-1.0 (BSD-style), with file headers recording both | **STUDY** | Best noding/polygonizer/diagnostic/face-traversal reference. Reimplement the bounded pattern in Museum terms; no JTS Geometry/PlanarGraph runtime or source/test transcription. |

### License notes

- `robust-predicates`: Unlicense permits direct reuse; still record package/revision provenance in dependency notices if Museum adds it.
- Flatten.js: MIT permits reuse; if substantial source or test expression is copied later, retain the MIT copyright/permission notice.
- JTS: H3 uses **STUDY** only. JTS offers EPL-2.0 or EDL-1.0 terms, but Museum does not need the Java implementation or framework. No H3 recommendation depends on copying JTS source or tests.

---

# 4. robust-predicates — robust orientation primitive

## 4.1 Exact files / functions / tests inspected

At `mourner/robust-predicates@db6dca0dd05fbccf04c66e479361e84a5416f1ca`:

- `LICENSE`
- `package.json` — `3.0.3`, `Unlicense`, ESM + TypeScript declarations
- `README.md` — orientation API and coordinate-orientation convention
- `src/orient2d.js`
  - `orient2d(...)`
  - `orient2dfast(...)`
  - adaptive fallback `orient2dadapt(...)`
- `src/util.js` — expansion-arithmetic helpers used by adaptive predicates
- `test/test.js`
  - basic clockwise/counterclockwise/collinear cases
  - 128×128 near-collinear sweep around a width of `2^-43`
  - 1000 hard `orient2d` fixtures loaded from `test/fixtures/orient2d.txt`
- `test/fixtures/orient2d.txt`

## 4.2 Relevant failure class

Naive determinant signs become unreliable for nearly collinear coordinates. Wall-first uses orientation for both:

- segment intersection classification;
- deterministic radial ordering of outgoing Walls at a Junction.

A wrong sign can therefore create a wrong Junction classification **or a wrong face traversal**, which is more severe than a slightly wrong visual hit.

## 4.3 What may come over — `PORT`

Use the package as a focused predicate dependency or equivalent vendored adapter. The only H3-required runtime primitive is robust 2D orientation.

Museum must hide the upstream axis/sign convention behind one adapter. `robust-predicates` documents its API in a y-down convention; Museum topology should operate in renderer-independent world X/Z math.

Conceptual seam:

```ts
import { orient2d } from 'robust-predicates';

export function orientXZ(a: LayoutVec2, b: LayoutVec2, c: LayoutVec2): number {
  // Museum standard: positive => c is left of directed a→b in X/Z.
  return -orient2d(a[0], a[1], b[0], b[1], c[0], c[1]);
}
```

Exact naming/sign should be locked by Museum tests; callers never import `orient2d` directly.

## 4.4 What must not come over

- no direct predicate imports scattered through editor/Svelte/SVG code;
- no `incircle`, `orient3d` or `insphere` dependency surface for P23;
- no use of `orient2dfast` for topology decisions;
- no screen-axis convention leaking into world topology;
- no claim that robust orientation alone supplies an exact intersection coordinate or topology repair.

## 4.5 Museum seam mapping

- place adapter in renderer-neutral `layout-core` geometry/topology code;
- typed segment classification consumes it;
- outgoing half-edge ordering consumes the same adapter;
- compiler/topology tests own its contract;
- Plan receives only derived records.

---

# 5. Flatten.js — segment intersection / tolerance failure harvest

## 5.1 Exact files / functions / tests inspected

At `alexbol99/flatten-js@5c02ff087b16d82c8c7d3a76086856c2bd3df58f`:

- `LICENSE`, `package.json`
- `src/utils/utils.js`
  - global mutable `DP_TOL = 0.000001`
  - `setTolerance`, `getTolerance`, `EQ_0`, `EQ`, `GT`, `GE`, `LT`, `LE`
- `src/algorithms/intersection.js`
  - `intersectLine2Line`
  - `intersectSegment2Line`
  - `intersectSegment2Segment`
  - `snapToSegmentEndpoints`
  - `isPointInSegmentBox`
- `src/classes/segment.js`
  - segment containment/intersection/zero-length behavior
- `src/classes/face.js`
  - `signedArea()`
  - `orientation()`
  - `isSimple()` / `getSelfIntersections()`
- `src/classes/polygon.js`
  - `isValid()`
  - `addFace()`
  - `recreateFaces()`
  - `addVertex()`
- `test/classes/segment.js`
  - proper crossing
  - collinear overlap
  - box-overlap but no segment intersection
  - tiny collinear gap / issue-85 regression
  - extremely close collinear lines / issue-99 regression
  - large-coordinate near-parallel proper crossing
- `test/classes/polygon.js`
  - face orientation and polygons with holes/cuts

## 5.2 Useful lessons

### Segment classification vocabulary

Flatten explicitly treats:

- zero-length segments;
- incidence/collinearity;
- parallel lines;
- overlapping collinear segments;
- one-point intersections;
- endpoint snapping.

That vocabulary is useful for Museum's typed result, but Museum should not port the implementation wholesale.

### High-value negative evidence: one global tolerance changes topology

Flatten's default `DP_TOL = 1e-6` is used across equality, incidence, containment and ordering. Its own regression tests include cases where extremely close but mathematically distinct collinear geometry is treated as intersecting/overlapping.

For Museum this is the wrong authority model. A `1e-6 m` comparison may be useful as a **degeneracy diagnostic**, but must never silently merge Junction IDs or turn a small gap into authored connectivity.

### Face helpers are not a topology kernel

`Face.orientation()` / signed area are useful concepts. But `Face.isSimple()` explicitly notes touching-point handling is incomplete, and `Polygon.isValid()` still has TODOs for nested islands/holes and intersections between faces.

Therefore Flatten is not the Room-face extractor authority for P23.

## 5.3 What may come over — `ADAPT`

- independently authored typed segment-intersection logic inspired by its case coverage;
- MIT fixture shapes for proper crossing, overlap, close lines and near-parallel crossings;
- signed-area/orientation concepts for derived face diagnostics;
- explicit zero-length handling.

If exact source/test expression is actually ported later, retain MIT notice.

## 5.4 What architecture must not come over

- mutable global `DP_TOL` as Museum geometry policy;
- tolerance-based endpoint snapping inside topology classification;
- `Flatten.Point/Segment/Polygon/Face` as `LayoutDocument` truth;
- Polygon linked-list/index structures as persistent Room/Wall model;
- boolean/cut machinery for a straight-wall minimum;
- a second spatial index or query surface competing with compiled queries;
- `Polygon.isValid()` as authoritative hole/nesting validation.

## 5.5 Fixture provenance carried into Museum

| Upstream failure/test shape | Museum fixture intent |
|---|---|
| tiny positive collinear gap treated as a touch under global tolerance | two distinct Junction IDs separated by a sub-micron gap must **not auto-join**; report near-coincident degeneracy if within Museum's named diagnostic threshold |
| extremely close parallel/collinear lines collapse into overlap | two distinct nearly coincident Walls must not silently become one Wall |
| large-coordinate near-parallel crossing still yields one intersection | proper X crossing remains deterministic at large coordinate magnitudes |
| collinear overlap returns an overlap interval | Museum classifies overlap explicitly and rejects it in the straight-wall minimum instead of choosing a winner |
| zero-length segment special cases | zero/tiny authored Wall rejects before noding/face extraction |

---

# 6. JTS — noding / planar graph / polygonizer study

## 6.1 Exact revision / license

- Repo: `locationtech/jts`
- Revision: `7e2b0e5d53fa411d6b58b8e5b395b1361f9711f8`
- Root `LICENSES.md`: project content under EPL-2.0 or EDL-1.0 unless otherwise indicated.
- Inspected source headers in polygonize/noding/planargraph/algorithm packages repeat EPL-2.0 + EDL-1.0.

**Disposition: `STUDY`.** The algorithmic pattern is valuable; Museum does not need JTS classes or a general geometry framework.

## 6.2 Exact files / classes / functions / tests inspected

### Polygonization

`modules/core/src/main/java/org/locationtech/jts/operation/polygonize/Polygonizer.java`

- correctly-noded-input requirement;
- `getDangles()`;
- `getCutEdges()`;
- `getInvalidRingLines()`;
- `polygonize()` pipeline;
- valid-ring split;
- shell/hole assignment;
- deterministic shell sorting.

`modules/core/src/main/java/org/locationtech/jts/operation/polygonize/PolygonizeGraph.java`

- `addEdge(...)`;
- `computeNextCWEdges(...)`;
- `computeNextCCWEdges(...)`;
- `getEdgeRings()`;
- `deleteDangles()`;
- `deleteCutEdges()`;
- maximal→minimal ring conversion.

`modules/core/src/main/java/org/locationtech/jts/operation/polygonize/EdgeRing.java`

- `findDirEdgesInRing(...)`;
- `computeHole()`;
- `computeValid()`;
- containment / shell relationships.

`modules/core/src/main/java/org/locationtech/jts/operation/polygonize/HoleAssigner.java`

- shell lookup / hole assignment pattern.

### Directed-edge ordering

`modules/core/src/main/java/org/locationtech/jts/planargraph/DirectedEdge.java`

- `compareDirection(...)` — quadrant first, robust Orientation for same-quadrant rays; explicitly rejects `atan2` alone as robust ordering.

`modules/core/src/main/java/org/locationtech/jts/planargraph/DirectedEdgeStar.java`

- sorted outgoing edge star;
- `getNextEdge(...)` / `getNextCWEdge(...)`.

### Noding / split lineage

`modules/core/src/main/java/org/locationtech/jts/noding/NodedSegmentString.java`

- context data retained on split substrings;
- `addIntersection(...)` / `addIntersectionNode(...)`;
- intersection exactly on an existing vertex normalized deterministically.

`modules/core/src/main/java/org/locationtech/jts/noding/SegmentNodeList.java`

- endpoint insertion;
- collapse detection;
- deterministic split-edge construction.

### Robust intersection

`modules/core/src/main/java/org/locationtech/jts/algorithm/RobustLineIntersector.java`

- orientation-side tests;
- proper vs non-proper intersection;
- explicit shared-endpoint copying;
- collinear overlap classification;
- safer fallback when computed intersection lies outside segment envelopes.

### Tests

`modules/core/src/test/java/org/locationtech/jts/algorithm/RobustLineIntersectorTest.java`

- proper crossing;
- disjoint collinear spans;
- endpoint touch;
- collinear overlap;
- proper/non-proper distinction;
- large-coordinate orientation regression.

`modules/core/src/test/java/org/locationtech/jts/operation/polygonize/PolygonizerTest.java`

- empty input;
- touching hole cases;
- nested/polygonal extraction;
- checkerboard multi-face linework;
- non-noded input must not crash;
- invalid-ring reporting.

`modules/core/src/test/java/org/locationtech/jts/noding/FastNodingValidatorTest.java`

- noding-validity test seam inspected as supporting evidence.

## 6.3 Highest-value JTS lesson: noding is a precondition

`Polygonizer` is explicit: polygonization expects edges to meet only at endpoints. Incorrectly noded input does not become magically correct polygon topology.

Museum should make this stricter:

```text
wall edit / wall draw
→ typed intersection classification
→ explicit planned T/X splits
→ complete candidate Wall/Junction graph
→ validate fully noded
→ derive candidate faces
→ Room reconciliation later
```

The compiler may diagnose non-noded input, but must not mutate `LayoutDocument` to repair it.

## 6.4 Dangles and cut edges: diagnose, never delete authored Walls

JTS internally removes dangles and cut edges from the polygonization graph so rings can be found. Museum may mirror that **only in a derived face-extraction working graph**.

Authored Walls remain untouched.

This matters because the staged proposal explicitly allows valid open wall chains without Rooms.

Museum semantics:

- boundary-wall dangle → derived topology diagnostic; wall still renders/saves;
- cut edge → derived topology diagnostic; wall still renders/saves;
- a command that explicitly promises a closed enclosure may reject if its candidate produces only dangles/cut edges;
- generic Wall/Partition drafting does not auto-delete, auto-close or auto-repair them.

`partition` Walls are excluded entirely from semantic Room-face extraction, although their physical intersections/junctions may still be explicitly noded for canonical wall geometry.

## 6.5 Directed face traversal pattern

JTS supplies the strongest bounded pattern:

1. every physical edge gets two directed half-edges;
2. outgoing half-edges at a node are sorted robustly by quadrant + orientation, not only `atan2`;
3. a next-edge relation is chosen consistently around each node;
4. traversing unvisited half-edges yields oriented rings;
5. dangles/cut edges are separated from face-forming edges;
6. ring validity and hole/nesting are diagnosed after traversal.

Museum can implement a much smaller straight-line version over `WallId` / `JunctionId` without JTS classes.

## 6.6 What may come over — STUDY / independently reimplement

- correctly-noded precondition;
- separate dangle/cut/invalid-ring diagnostics;
- robust radial ordering via quadrant + orientation;
- directed-edge ring traversal;
- context/parentage preservation through splits;
- exact endpoint reuse rather than recomputing a shared endpoint;
- deterministic ordering of derived faces;
- checkerboard / touching-hole / non-noded / invalid-ring fixture ideas.

## 6.7 What architecture must not come over

- JTS `Geometry`, `Coordinate`, `LineString`, `Polygon`, `PlanarGraph`, `Node`, `DirectedEdge` as Museum project truth;
- a Java/JSTS geometry framework dependency;
- automatic precision-model snapping or snap rounding;
- JTS's nearest-endpoint surrogate as silent topology repair for unstable intersections;
- deletion of authored dangles/cut edges;
- STRtree/spatial-index complexity in P23 minimum;
- shell/hole polygon semantics becoming persistent Room identity;
- JTS ring IDs/order becoming Museum Room IDs.

For Museum, an unstable computed X-intersection should reject with a diagnostic rather than choose a nearby endpoint and change topology.

---

# 7. Recommended minimum Wall/Junction topology model

H3 supports the staged proposal's straight-wall minimum. Exact migration/versioning remains H5/final reconciliation work.

Conceptual shape:

```ts
type LayoutJunction = {
  id: JunctionId;
  point: LayoutVec2;
};

type LayoutWall = {
  id: WallId;
  startJunctionId: JunctionId;
  endJunctionId: JunctionId;
  role: 'boundary' | 'partition';
  thickness: number;
  height: number;
};

type LayoutOpening = {
  id: OpeningId;
  wallId: WallId;
  offset: number; // physical meters from stable canonical Wall start
  width: number;
  height: number;
  sillHeight: number;
  kind: 'door' | 'window';
  profile: 'rectangular' | 'rounded' | 'pointed';
};
```

Required H3-level invariants:

- connectivity = Junction ID equality, never coordinate proximity;
- every Wall references two existing Junction IDs;
- start/end Junction IDs differ;
- effective length is finite and above the separately defined authored minimum;
- Wall ID does not derive from coordinates;
- Wall start direction is stable so opening offsets remain meaningful;
- duplicate Walls between the same two Junctions are invalid in the minimum;
- collinear overlapping Walls are invalid;
- intersections that are not represented by explicit Junction endpoints are non-noded topology errors;
- `partition` uses the same physical wall/opening/compiler machinery but is excluded from Room face extraction;
- no Wall stores or infers Room ownership.

### Derived candidate face shape

Topology output may carry a deterministic **derived** face record such as:

```ts
type DerivedLayoutFace = {
  key: string; // deterministic ephemeral topology key; never RoomId
  floorId: string;
  boundary: readonly {
    wallId: string;
    direction: 'forward' | 'reverse';
  }[];
  polygon: readonly LayoutVec2[];
  signedArea: number;
};
```

`key` exists for deterministic ordering/diagnostics and H5 correspondence input. It is not persisted as a Room identity unless the later identity study explicitly chooses a durable binding design.

---

# 8. Robust straight-segment intersection classification

Museum should expose one renderer-neutral typed classifier.

Conceptual result:

```ts
type WallIntersection =
  | { kind: 'none' }
  | { kind: 'shared-junction'; junctionId: string }
  | { kind: 'endpoint-on-interior'; endpointWallId: string; interiorWallId: string; point: LayoutVec2 }
  | { kind: 'proper-crossing'; point: LayoutVec2 }
  | { kind: 'collinear-endpoint-touch'; point: LayoutVec2 }
  | { kind: 'collinear-overlap'; start: LayoutVec2; end: LayoutVec2 }
  | { kind: 'unstable'; reason: string };
```

### Classification rules

1. **Explicit shared Junction ID wins first.** This is a topological endpoint touch; reuse the exact Junction coordinate.
2. Compute four robust orientation signs using the single `orientXZ` adapter.
3. Opposite signs on both segments → proper X crossing.
4. One endpoint robustly collinear and inside the other segment's bounds → endpoint-on-interior T candidate.
5. All four collinear → classify by dominant-axis interval into disjoint / endpoint-touch / overlap.
6. Distinct Junction IDs at the same or degenerately close coordinate do **not** become a shared Junction automatically. Diagnose/reject the candidate so the authoring operation can explicitly join them.
7. Proper-crossing point calculation may use ordinary double line intersection after robust classification, but the result must be finite and lie within both segment envelopes. If the coordinate is numerically unstable, reject rather than snap to a nearest endpoint.

A broad distance tolerance must not decide orientation sign.

---

# 9. Deterministic T/X noding and Wall split rules

Noding is an explicit semantic mutation, not a compiler repair.

## 9.1 T-junction

Endpoint of Wall A lands on the interior of Wall B:

```text
A endpoint
   |
---+--- B
```

Rules:

- reuse A's endpoint Junction as the split Junction;
- split B at exact distance `d` from B's canonical start;
- B fragment containing B's original start keeps B's Wall ID;
- second B fragment receives a new deterministic/supplied Wall ID;
- no new Junction is allocated if A's endpoint Junction already exists;
- apply opening redistribution rule below;
- validate the full document candidate before commit.

## 9.2 X-junction

Two Wall interiors cross:

```text
  |
--+--
  |
```

Rules:

- allocate exactly one new Junction at the validated crossing coordinate;
- split both Walls against the same Junction;
- each original Wall ID stays on its canonical-start fragment;
- process affected Walls in stable Wall-ID order for deterministic created-ID requests, diagnostics and tests;
- all splits + opening remaps + selection reconciliation are one Layout transaction.

## 9.3 Multiple intersections along one authored Wall

When one new straight Wall crosses several existing Walls:

- classify all intersections first against the immutable baseline;
- sort proper/T split points by distance from the new Wall's canonical start, then stable target Wall ID;
- reject ambiguous duplicate/overlapping intersection events;
- construct all resulting fragments once;
- validate once;
- commit once.

Do not repeatedly mutate/reclassify from partially split intermediate state.

## 9.4 Opening redistribution on split

For split distance `d`, opening interval `[offset, offset + width]`:

- interval entirely before `d` → remains on original/start fragment, same offset;
- interval entirely after `d` → moves to new/end fragment with `offset' = offset - d`;
- split exactly at an opening boundary → assign deterministically to the side containing the opening interior;
- split through opening interior → reject whole operation;
- resulting opening fit/overlap/vertical validation still runs through canonical Layout validation/compiler rules.

This retains H1 meter-offset semantics.

## 9.5 Selection / history

Keeping the old Wall ID on the canonical-start fragment provides a deterministic selected-ID successor for common splits. Any newly created Junction/Wall selection policy is editor projection; the topology operation returns explicit affected/created IDs and never reads selection as input truth.

---

# 10. Candidate-face extraction strategy

Face extraction runs over **`role: 'boundary'` Walls only**. Partitions remain physical architecture but do not split semantic Rooms, matching the staged proposal.

## 10.1 Pipeline inside the one canonical compiler

```text
LayoutDocument
→ structural Wall/Junction/Openings validation
→ typed non-noded intersection scan
→ derived boundary-wall working graph
→ mark/exclude dangles from face working graph (do not delete authored Walls)
→ build directed half-edges
→ robustly sort outgoing edges at every Junction
→ oriented ring traversal
→ bounded candidate faces
→ cut-edge / invalid-ring / nested-loop diagnostics
→ H5-defined Room correspondence input
→ compiled Wall/Opening/Room/query geometry
→ Plan / 3D / visitor
```

There is still one `compileLayoutGeometry()` boundary. Helper modules may exist beneath it; Plan/SVG/Three never run their own polygonizer.

## 10.2 Robust outgoing-edge order

Do not sort solely by `Math.atan2`. Adapt the JTS pattern:

1. classify direction into a deterministic quadrant/half-plane;
2. within quadrant compare two rays using `orientXZ`;
3. if two outgoing rays are exactly collinear in the same direction, the minimum topology should already have rejected duplicate/overlapping Walls; stable Wall ID is only a final diagnostic tie-break.

## 10.3 Face walk

For each unvisited directed boundary half-edge `u → v`:

- at `v`, find the twin `v → u` in the robustly ordered outgoing star;
- choose the immediate clockwise outgoing edge from that twin so the traversed face stays on the left side of the current edge;
- continue until the start half-edge returns;
- reject/diagnose a walk that repeats a directed edge before closure or exceeds an edge-count safety bound.

With Museum's standard X/Z signed-area convention:

- bounded face walks should have one consistent positive orientation;
- unbounded outer component walks have the opposite orientation and are discarded from candidate Rooms;
- zero-area rings are invalid diagnostics.

Lock the exact convention in tests; do not inherit screen-Y direction.

## 10.4 Deterministic derived face key/order

For a bounded oriented cycle:

- encode each side as `wallId + direction`;
- rotate the sequence so its lexicographically smallest token is first;
- because bounded traversal orientation is canonical, do not treat the reversed cycle as a second candidate;
- derive `key` from this canonical sequence;
- sort output faces by `floorId`, then `key`.

This removes dependence on input Wall array order or traversal starting edge.

Wall subdivision changes the cycle key. That is expected: **H5**, not H3, owns persistent Room correspondence through split lineage.

## 10.5 Dangles / cut edges

- recursively degree-1 boundary edges may be omitted from the derived face working graph and reported as `dangle` diagnostics;
- after face traversal, a non-dangle boundary Wall with no bounded-face incidence is a `cut-edge` diagnostic;
- neither diagnostic deletes or rewrites the authored Wall;
- open boundary chains may remain valid authored architecture with zero Room faces.

## 10.6 Nested loops / holes

JTS proves nested/hole handling requires a separate containment step and has difficult touching-hole cases. Flatten's own Polygon validity does not complete these semantics.

P23 straight-wall minimum should therefore:

- detect nested bounded loops deterministically after face extraction;
- report parent/child containment as topology diagnostics;
- reject touching/ambiguous nested loops for operations that require semantic Room creation;
- not synthesize a compound Room-with-hole or allocate Room IDs in H3;
- leave durable hole/courtyard Room semantics to later reconciliation if product scope requires them.

Disjoint non-nested closed boundary components may yield independent candidate faces.

---

# 11. Tolerance policy

H3 reinforces the umbrella/H2 rule: no single magic epsilon.

| Class | Authority | H3 policy |
|---|---|---|
| Pointer/snap acquisition | editor session, CSS pixels | H2 policy remains; e.g. current recommended 8 CSS px. Never topology truth. |
| Authored minimum Wall size | product rule, meters | Separate named threshold. Do not import Flatten/JTS/openPlan3D minimums. |
| Connectivity | Junction IDs | Exact ID relationship only. No distance threshold can create connectivity. |
| Orientation / sidedness | robust predicate | No geometric epsilon; use robust `orientXZ`. |
| Near-coincident distinct Junction diagnostic | layout-core, meters | Separate named degeneracy threshold. Current `1e-6 m` may be used as an initial compatibility value only if fixtures approve; it causes rejection/diagnosis, never auto-join. |
| Opening bounds/overlap | layout-core, meters | Separate named interval tolerance; may initially alias existing `1e-6` but must not be tied to orientation or pointer UX. |
| Intersection coordinate sanity | floating-point numeric guard | finite + both-envelopes + scale-aware residual check; failure rejects as unstable. No user-visible snap tolerance. |
| Curve sampling/self-intersection | existing curve compatibility | Keep current curve-specific tolerances; do not reuse them for straight-wall topology. |
| Display rounding | UI only | Never authored or topology truth. |

### Current `LAYOUT_GEOMETRY_EPSILON` implication

The current shared `1e-6` constant is acceptable as a numerical value in some existing checks, but wall-first reconciliation should split **meaningful named policies** even if several initially share the same numeric value.

The current room-closure test that accepts a `0.5e-6 m` coordinate mismatch should not survive as connectivity behavior. With first-class Junctions, one endpoint is connected because it references the same Junction ID; two different Junction IDs remain different topology.

---

# 12. Invalid topology diagnostics and reject policy

Use stable machine-readable codes plus involved IDs/points. Example vocabulary:

```text
wall_missing_junction
wall_zero_or_tiny
wall_duplicate
wall_collinear_overlap
junction_duplicate_coordinate
junction_near_coincident
non_noded_t_junction
non_noded_crossing
intersection_numeric_unstable
opening_straddles_wall_split
boundary_dangle
boundary_cut_edge
invalid_face_ring
zero_area_face
nested_boundary_loop
touching_nested_loop
unsupported_curve_topology
```

### Reject rather than auto-repair

These should block the candidate operation in the straight-wall minimum:

- Wall references a missing Junction;
- Wall start/end resolve to the same Junction;
- Wall is non-finite or below the authored minimum;
- duplicate Wall / collinear overlap;
- committed candidate contains a T/X intersection without an explicit Junction and required split;
- distinct Junction records are coincident/degenerately near-coincident in a way that makes topology ambiguous;
- proper-crossing coordinate cannot be computed and envelope-validated stably;
- required split passes through opening interior;
- split/remap produces invalid opening bounds/overlap/vertical fit;
- a closed-face operation produces an invalid/zero-area ring;
- touching/nested loop topology exceeds the minimum supported semantics;
- curved-wall topology would need new intersection/noding semantics.

### Diagnose, but do not automatically reject generic drafting

- boundary dangles;
- boundary cut edges;
- an open boundary chain producing no candidate Room;
- partitions that do not produce candidate faces.

A higher-level operation such as `Close room` / Rectangle / Polygon may impose stronger success conditions and reject if its promised enclosure is not produced.

### Never auto-repair

- never merge Junctions because coordinates are close;
- never delete a dangle/cut Wall;
- never choose a nearest endpoint for an unstable X intersection;
- never collapse overlapping Walls into one;
- never reclassify boundary↔partition from geometry;
- never create/retire Room IDs from face count inside compiler/render code.

---

# 13. Museum seam mapping

| H3 concern | Museum seam |
|---|---|
| Durable Junction/Wall/Openings | future `packages/layout-core/src/layout-types.ts` schema reconciliation; exact migration is not H3 |
| Robust orientation + segment classifier | new narrow renderer-neutral helper under `packages/layout-core/src/`; no Svelte/DOM/Three imports |
| Wall split / T/X noding operation | pure layout operation beside existing editing helpers; complete candidate before store mutation |
| Structural/topology validation | evolve canonical `layout-geometry-validation.ts`; typed diagnostics, not second validator |
| Face extraction | helper called **inside** `compileLayoutGeometry()` or canonical validation stage; boundary Walls only |
| Compiled query records | extend canonical compiled output with Junction/Wall/derived-face references as needed; H2 snap/hit remains consumer |
| Plan render | `PlanRenderModel` / `PlanSvg.svelte` only present compiler output + diagnostics; no topology logic |
| 3D / visitor | same compiled Wall/Openings/accepted Room surfaces; physical shared Wall compiles once |
| SceneDocument | no H3 mutation; Room/Scene/Camera migration is H5/final reconciliation |
| Transaction/history | `runLayoutMutation` / existing transaction host; one intent one Layout history result |
| Selection after split | operation returns old/created IDs; current selection system reconciles deterministically; topology never reads selection as truth |

---

# 14. H1 conclusions: retained vs superseded by wall-first

## 14.1 Retained

H1 remains authoritative evidence for:

- candidate-first, validate-whole, apply-once mutation;
- explicit fixed-end Wall sizing intent;
- stable IDs independent of coordinates;
- invalid/no-op/cancelled edit → zero history;
- one completed gesture/Apply → one Layout history result;
- meter opening offset from stable Wall start;
- no normalized opening `t` migration for elegance;
- opening overflow/overlap/vertical-fit rejection;
- no silent clamping;
- no proximity-derived ownership/topology;
- deterministic IDs; no timestamp Room IDs;
- renderer/store architecture must not own geometry;
- one `compileLayoutGeometry()` pipeline;
- compiled/query geometry as Plan interaction truth;
- straight-wall first scope and rejection of ad-hoc curved resize math;
- explicit Room identity remains durable and separate from geometry.

H1's rejection of openPlan3D's tolerance-based `connectedWallEndpoints` is **more important** under wall-first: connectivity now belongs to Junction IDs.

## 14.2 Superseded

Wall-first supersedes these H1 implementation assumptions:

1. **"ordered closed Room segments own topology"** — replaced by first-class Junctions/Walls; Rooms reference/associate to derived boundary faces.
2. **wall resize through Room neighbor indices** — future Wall edits target Wall/Junction records, not predecessor/successor segments in one Room array.
3. **opening host = `room.openings[] + segmentId`** — opening host becomes first-class Wall.
4. **Room closure tolerance creates connectivity** — explicit Junction IDs now create connectivity; coordinate closeness is only a diagnostic/input-assist concern.
5. **Room self-intersection validation is the primary network validator** — replaced by fully-noded Wall graph validation + candidate-face extraction; Room correspondence comes later.
6. **current `replaceRoomPoints` / `replaceRoomVertex` are the natural final wall-authoring seam** — they become legacy/migration helpers after wall promotion.
7. **current `transformLayoutRoomUnit` boundary mutation can be assumed to survive unchanged** — shared Walls make this implementation migration-sensitive; H5/final reconciliation must define Room transform semantics.

## 14.3 Reinterpreted upstream H1 lessons

- Blueprint3D's explicit Corner/Wall graph concept becomes more relevant, but its proximity merge/split mutation and Three/render coupling remain rejected.
- Sweet Home 3D's explicit joined-endpoint semantics become more relevant, but GPL remains STUDY-only and Museum uses Junction IDs rather than controller object links.
- openPlan3D `splitWallsAtTJunctions` becomes a behavior/fixture reference for explicit noding, while its generous tolerance, inferred room identity and timestamp IDs remain rejected.
- H1's "candidate breaks room closure" failure becomes "candidate creates invalid/non-noded Wall topology or unsupported face correspondence"; only H5 may decide persistent Room outcomes.

## 14.4 H2 remains largely intact

- screen-space snap acquisition stays separate from topology tolerance;
- intersection snap candidates may help author an explicit Junction but do not themselves create connectivity until commit;
- selection/snap authority remains separate;
- `PlanRenderModel` / compiled queries remain the sole Plan geometry source;
- guides/diagnostics remain transient projection, not serialized topology.

---

# 15. Required Museum acceptance fixtures with provenance

All Museum fixtures should be written in Museum data/terminology. JTS-derived fixtures below are concept provenance only; do not transcribe JTS test source.

| Fixture | Provenance | Museum expected result |
|---|---|---|
| near-collinear orientation grid | `robust-predicates/test/test.js` near-collinear sweep + hard fixtures | stable `orientXZ` sign across permutations; no epsilon-dependent flip |
| exact collinear three points | robust-predicates basic orient2d test | zero orientation exactly; classifier proceeds to collinear interval logic |
| tiny positive gap between collinear Walls | Flatten `test/classes/segment.js` issue-85 style | no auto-touch/merge; distinct Junctions remain distinct; optional near-coincident diagnostic |
| extremely close parallel/collinear Walls | Flatten issue-99 style | no silent overlap/merge based on global tolerance |
| near-parallel large-coordinate proper crossing | Flatten segment regression | one deterministic proper X crossing; one Junction after explicit noding |
| collinear partial overlap | Flatten overlap test + JTS collinear intersector tests | `wall_collinear_overlap` reject; no winner chosen |
| exact shared endpoint | JTS `RobustLineIntersectorTest` endpoint cases + source endpoint-copy rule | reuse exact shared Junction; no new Junction; non-proper endpoint touch |
| T junction | JTS noding precondition + `NodedSegmentString` split semantics | endpoint Junction reused; host Wall split once; start fragment keeps ID |
| X junction | JTS noding + proper intersection semantics | one new Junction; both Walls split; all four fragments share explicit topology |
| split through opening | staged wall-first proposal §8 + H1 opening fit | reject atomically; no document/history mutation |
| opening after split point | staged proposal + H1 meter offsets | opening moves to end fragment; `offset' = offset - d`; ID/properties retained |
| simple rectangle | JTS polygonizer ring traversal concept | exactly one bounded candidate face; outer unbounded traversal discarded |
| rectangle + complete boundary divider | JTS planar graph/polygonizer + staged proposal | exactly two bounded candidate faces; stable order independent of Wall array order |
| same divider marked `partition` | staged proposal boundary/partition contract | still one candidate Room face; partition renders but excluded from face graph |
| checkerboard / multi-face graph | JTS `PolygonizerTest` checkerboard | deterministic bounded face count and canonical keys independent of insertion order |
| open wall chain | JTS dangle semantics + staged proposal open-chain allowance | dangle diagnostics; zero Room candidates; authored Walls retained |
| two cycles joined by bridge | JTS cut-edge semantics | bridge reported as cut edge for face graph; both cycle faces remain; bridge not deleted |
| non-noded crossing in saved candidate | JTS Polygonizer correctly-noded requirement | blocking `non_noded_crossing`; no partial Room-face result treated as canonical |
| invalid ring / repeated traversal | JTS invalid-ring tests | explicit invalid diagnostic; no Room identity allocation |
| nested disconnected loops | JTS polygonal/nesting behavior | deterministic nesting diagnostic; no automatic hole/Room semantics in P23 minimum |
| touching inner loop | JTS touching-hole tests | reject/diagnose unsupported touching-hole topology; no guess |
| input Wall array permutations | JTS deterministic shell sort + Museum stable-ID contract | byte-stable derived face keys/order and identical diagnostics |
| undo/redo after T/X split | H1 atomic/history contract | recorded IDs/opening remaps restored exactly; no re-running topology with fresh IDs |

### Additional current-code regression fixture

Repurpose the current `layout-validation.test.ts` case where the closing endpoint differs by `0.0000005 m`:

- legacy room-first validation may keep this as compatibility coverage;
- wall-first Junction validation must prove that two different Junction IDs do not become connected because coordinates are within `1e-6`;
- an explicit join/snap operation may choose to reuse an existing Junction **before commit**, making connectivity explicit.

---

# 16. Straight-wall first-scope constraints

H3 intentionally does **not** design:

- curved-wall intersection/noding;
- bezier/arc face traversal;
- general polygon boolean operations;
- snap rounding;
- full constraint solving;
- arbitrary topology repair;
- multi-floor topology;
- persistent holes/courtyard Room semantics;
- general spatial indexing;
- BIM wall assemblies.

Existing `auto-bezier` fidelity must not be flattened or rewritten by H3. The final migration plan may preserve existing curved records through the same canonical compiler while wall-first topology operations remain straight-only. If curved compatibility blocks migration, trigger the already-deferred H4/compatibility work rather than inventing curve topology here.

---

# 17. What H5 Room identity / migration must answer later

H3 deliberately leaves these unresolved:

1. final durable `LayoutRoom` boundary/binding representation over oriented Walls;
2. deterministic Room correspondence under deformation, Wall subdivision, simple split and simple merge;
3. whether/where edge lineage is serialized versus transaction-local;
4. migration from current room-owned duplicate boundary segments into shared Walls/Junctions without proximity-derived ownership at runtime;
5. migration of current Room-owned openings into one physical Wall-hosted opening, including ambiguous coincident legacy doors/windows;
6. room-local `frame` preservation and what current `transformLayoutRoomUnit` means when Walls are shared;
7. current `LayoutObject.roomId`, Scene entity/cluster ownership and Camera room-local transforms versus staged world-local target;
8. Room deletion when Walls no longer belong to Rooms;
9. Room duplication/repeat when Walls/Junctions may be shared;
10. `connectsRoomIds` portal relation migration once physical doors live on shared Walls;
11. persistent Room metadata conflicts after split/merge;
12. save/load/version migration and cold visitor compatibility;
13. selection/reference remapping across schema migration;
14. undo/redo replay of Room correspondence without recomputing new IDs;
15. legacy curved Room fidelity during wall-first migration.

H3 candidate-face keys and oriented Wall cycles are inputs to that study, not the answer.

---

# 18. Concise recommendations for later wall-first P23 reconciliation

## 18.1 Minimum viable Wall/Junction topology model

Adopt explicit floor-level Junctions + straight Walls + Wall-hosted Openings. Junction IDs own connectivity; Wall role is authored `boundary | partition`; partitions never enter semantic Room face extraction. Keep stable Wall direction for physical-meter opening offsets.

## 18.2 Face-extraction strategy

Inside the single `compileLayoutGeometry()` pipeline, validate fully noded boundary Wall topology, derive a temporary directed half-edge graph, exclude/diagnose dangles, robustly order outgoing edges, traverse bounded oriented faces, diagnose cut/invalid/nested cases, and emit deterministic **candidate faces only**. No Room IDs are generated.

## 18.3 Tolerance policy

Use robust orientation with no epsilon. Connectivity is IDs. Keep screen snap, authored minimum size, near-coincident diagnostics, opening interval tolerance, curve sampling and display rounding as separate named classes. Do not reuse one `EPSILON` or Flatten-style global tolerance.

## 18.4 Deterministic Wall split/noding rules

T: reuse endpoint Junction, split host. X: one new Junction, split both. Old Wall ID remains on canonical-start fragment; new IDs are supplied/allocated deterministically. Redistribute openings by physical offset; splitting through opening interior rejects. Build whole candidate from immutable baseline, validate once, commit once.

## 18.5 Failures that reject rather than auto-repair

Reject missing/degenerate Walls, duplicate/overlapping Walls, non-noded committed T/X crossings, ambiguous coincident Junctions, unstable proper-crossing coordinates, split-through-opening, invalid post-split openings, invalid/zero-area closed-face results, unsupported touching/nested semantics, and curved topology requests. Never merge/delete/snap topology as a hidden repair.

## 18.6 What remains for Room identity/migration study

H5 must decide durable Room↔face binding/correspondence, migration of current room-owned geometry/openings, Room transform/delete/duplicate semantics, Scene/Camera/world-transform migration, split/merge metadata policy, replay determinism and visitor/save compatibility.

---

## 19. Explicit not-to-import list

Do not import:

- Flatten global tolerance policy or Polygon model;
- JTS/JSTS geometry/planar-graph framework;
- JTS dangle/cut deletion into authored state;
- JTS nearest-endpoint repair behavior;
- proximity-based automatic Junction merge;
- renderer-owned topology or SVG polygonization;
- a second Plan geometry/query source;
- disposable/derived Room IDs;
- a persistent CAD constraint graph;
- curved-wall topology in H3;
- spatial indexes without measured need;
- any topology that rewrites `SceneDocument` to compensate for Layout changes.

H3 stops here. No P23 plan, H1/H2, tracker or implementation changes are implied by this harvest.