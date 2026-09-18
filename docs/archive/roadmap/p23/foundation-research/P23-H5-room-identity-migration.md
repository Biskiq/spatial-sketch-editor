# P23-H5 — Persistent Room Identity / Topology Reconciliation / Legacy Migration

**Status:** completed evidence harvest — 2026-09-09  
**Museum Editor baseline:** `toni8699/spatial-sketch-editor@e642e3ea38ddf3626b04b0471772fac7ec00f29a`  
**Scope:** P23-H5 only — persistent Room identity, topology lineage/reconciliation, Scene/Camera ownership migration, legacy Layout migration, schema compatibility, and exact replay semantics.  
**Not authority to implement:** this artifact supplies evidence and decisions for final P23 reconciliation. It does not amend the P23 umbrella/child plans, H1/H2/H3, trackers, or product code.

---

# 1. Scope and fixed constraints

H5 is downstream of H3. It does **not** own intersection classification, noding, face extraction, or tolerance policy.

The fixed wall-first constraints are:

- first-class explicit Junctions and Walls;
- openings hosted by canonical Walls;
- explicit boundary vs partition Wall semantics;
- enclosed candidate faces derived from Wall topology;
- `LayoutRoom` remains persistent product/semantic identity over a candidate enclosed face;
- geometry never allocates or owns Room IDs;
- ordinary wall deformation and deterministic local topology edits preserve identity where lineage is provable;
- no proximity-derived implicit ownership in normal authoring;
- one public canonical `compileLayoutGeometry()` boundary for editor and visitor;
- deterministic selection/history/replay;
- existing saves and immutable published releases remain readable;
- Scene/Camera physical placement must not require Room containment in the target architecture;
- migration must preserve world/project-space meaning before Room-local ownership is removed;
- visitor/editor isolation remains hard: compatibility/migration code required by visitor runtime belongs in shared project/layout packages, not editor stores.

H3 remains authoritative for robust predicates, straight-segment topology, noding, face extraction, and geometry diagnostics. H5 consumes H3 candidate faces and H3 tolerance decisions. H5 must not introduce a second face extractor or its own epsilon policy.

This harvest also keeps H1/H2 conclusions intact:

- opening offsets are physical meters from Wall/segment start, not normalized coordinates;
- candidate edits are planned completely, validated, then committed atomically;
- invalid/no-op operations create no history;
- compiled query geometry remains the renderer-neutral Plan selection/query source;
- stable semantic IDs, not traversal order, resolve deterministic ties.

---

# 2. Verified current Museum seams

All claims in this section were rechecked against the current baseline, not inferred from the wall-first proposal.

## 2.1 Current Layout ownership and ID scope

Relevant current files:

- `packages/layout-core/src/layout-types.ts`
- `packages/layout-core/src/layout-codec.ts`
- `apps/editor/src/lib/editor/layout/layout-preview-state.svelte.ts`
- `apps/editor/src/lib/editor/layout/layout-opening-editing.ts`
- `apps/editor/src/lib/editor/layout/layout-room-editing.ts`

Current persisted shape:

```ts
type LayoutRoom = {
  id: string;
  name: string;
  frame: LayoutRoomFrame;
  boundary: DraftPath;
  wallThickness: number;
  floorThickness: number;
  ceilingThickness: number;
  openings: LayoutOpening[];
};
```

Current boundary segments are Room-owned. Current openings are Room-owned and point to one Room-owned `segmentId`. `LayoutOpening.connectsRoomIds` is an optional explicit semantic Room relation on doors.

Current ID facts:

- Room IDs are required to be unique across the whole `LayoutDocument`.
- Segment IDs are validated only within their owning `DraftPath`; the codec does not establish document-global segment identity.
- Opening IDs are validated within the owning Room; the codec does not establish document-global opening identity.
- current Room drafting allocates `layout-room-N`, names it `Draft Room N`, and allocates segment IDs as `${roomId}:wall:${index}`;
- current opening drafting allocates `${roomId}`-qualified IDs such as `opening:${room.id}:${kind}:${index}`.

The generated strings are usually globally distinct in editor-authored projects, but that is convention, not a codec guarantee for segment/opening IDs. Wall-first migration therefore must not assume legacy segment/opening IDs are globally collision-free.

`LayoutObject` is materially different from Scene entities: its `position`/`rotation` are already project/world-local and `roomId` is optional. Current whole-Room transform explicitly moves Layout objects whose optional `roomId` equals the transformed Room, but the Room is not required to interpret the stored object transform.

## 2.2 Current Room frame semantics

Relevant current files:

- `packages/layout-core/src/layout-room-frame.ts`
- `packages/project-model/src/project-layout-semantics.ts`
- `apps/editor/src/lib/editor/layout/layout-room-transform.ts`

`LayoutRoom.frame` is a persisted 2D origin + yaw. `layoutRoomPoint()` maps a Room-local `[x,y,z]` into project/world coordinates using:

- Room frame origin for X/Z;
- floor elevation for Y;
- Room yaw around +Y.

`layoutRoomLocalPoint()` is the inverse.

Current whole-Room transform mutates:

- Room frame origin/yaw;
- every Room boundary point/curve anchor;
- every Layout object whose optional `roomId` equals the Room, including object yaw.

It does **not** directly mutate `SceneDocument`. Scene/Camera content nevertheless changes world meaning because runtime resolution later applies the newly moved Room frame to the same stored Room-local Scene/Camera values. This hidden coupling is one reason Room-local Scene ownership becomes problematic once walls are shared and Room faces are derived.

## 2.3 Current persistent references to Room IDs

Relevant current files:

- `packages/project-model/src/scene.ts`
- `packages/project-model/src/project-layout-semantics.ts`
- `packages/project-model/src/project-codec.ts`
- `apps/editor/src/lib/editor/layout/layout-preview-state.svelte.ts`

Hard Room ownership today:

- every Scene entity has required `roomId`;
- every Scene cluster has required `roomId`;
- every Camera/navigation node has required `roomId`;
- node eye `position` and `cameraTarget` are Room-local.

Mixed Room/world ownership already exists in Camera connection data:

- position-path anchors have optional `roomId`;
- target waypoints have optional `roomId`;
- directional view-key `cameraTarget` has optional `roomId`;
- when `roomId` is absent, those values are already world-space.

`validateProjectSceneRooms()` checks every one of those references. Runtime resolution always transforms node eye/target through the Room registry, while optional anchor/waypoint/view-key Room references are transformed only when present.

Current cluster creation and membership also encode Room as a structural grouping constraint: cluster members must be in the same Room, and membership rejects entities whose `roomId` differs from the cluster's `roomId`. The unified project tree also nests clusters under Rooms.

Outside Scene, current persistent Room references include:

- `LayoutObject.roomId?`;
- `LayoutOpening.connectsRoomIds?`.

Current Room deletion demonstrates the consequence. The editor first rejects deletion while any Scene/Camera reference exists. If none exists, Layout deletion removes the Room, deletes Layout objects owned by it, and clears `connectsRoomIds` on doors in other Rooms that reference the deleted Room.

## 2.4 Current compiled/query identity is Room-segment based

Relevant current file:

- `packages/layout-core/src/layout-geometry-types.ts`

Current compiled types encode legacy ownership directly:

- `CompiledRoom.roomId`;
- `CompiledWall.segmentId` nested under a `CompiledRoom`;
- `CompiledOpening.openingId + segmentId`;
- query points/spans carry `floorId + roomId + segmentId`;
- query polygons can carry `roomId`;
- compiled wall/opening AABBs are identified from Room-owned source records.

`CompiledIdentity.id/cacheKey` are deterministic and `geometryId()` uses collision-safe tuple serialization, but the source tuple still depends on Room-owned segment identity.

Wall-first consequence: compiled/query IDs must pivot from `(roomId, segmentId)` source identity to canonical `wallId` / `junctionId` / `openingId`, while Room floor polygons remain keyed by persistent `roomId`. Selection reconciliation should therefore become simpler for Walls: one authored Wall produces one canonical Wall identity even when it bounds two Rooms.

## 2.5 Current history/replay semantics

Relevant current files:

- `apps/editor/src/lib/editor/store/history-controller.svelte.ts`
- `apps/editor/src/lib/editor/layout/layout-mutation-runner.ts`

Current history is a single chronological stack with separate Scene and Layout entry variants. A transaction captures a deep `before` snapshot; commit stores that exact snapshot. Undo restores the exact `before` snapshot and pushes the exact current document to redo. Redo restores that exact stored snapshot.

Therefore current snapshot semantics already satisfy the core H5 replay invariant **provided topology reconciliation and newly allocated IDs are present in the committed Layout snapshot**:

> redo does not need to rerun Room correspondence and must not allocate IDs again.

Current limitation: Scene and Layout transactions cannot be active concurrently. A Layout transaction refuses to start while a Scene transaction is active, and vice versa. There is no existing atomic cross-document transaction.

This matters only for migration or for any topology operation that still rewrites Scene Room ownership. If P23 first migrates Scene/Camera transforms to project space, ordinary Room split/merge no longer needs cross-domain physical-placement edits, avoiding a new composite history domain for normal topology authoring.

## 2.6 Current persistence/versioning behavior

Relevant current files:

- `packages/project-model/src/project-codec.ts`
- `packages/layout-core/src/layout-codec.ts`
- `apps/editor/src/lib/editor/project-persistence.ts`
- `apps/api/src/project-persistence.ts`

Current canonical Project and Layout codecs are strict and **do not have an active schema-version dispatch**. Current Project root accepts `id`, `name`, `layout`, `scene`; current Layout root accepts its current fields. Older archived documents referring to `formatVersion`/`schemaVersion` are not evidence of a live migration dispatcher.

Cloud `version` is a **save revision**, not a schema version. `saveProject()` appends the entire project JSON to `project_versions(project_id, version, document)` and increments `latest_version`. `loadProject()` returns the latest stored raw JSON document.

The OAuth pending-save key contains a `:v1` string, but that is session handoff storage versioning, not Project/Layout schema versioning.

Portable `.scenepack.zip` is also not a current Project migration seam: the active exporter writes `scene.json` plus `manifest.json` and textures, and serializes `SceneDocument`, not the full Layout+Scene `ProjectDocument`. Its manifest generator string (`editor-5.4`) is not a Layout schema discriminator.

## 2.7 Current Preview / publish / visitor behavior

Relevant current files:

- `apps/api/src/publication-persistence.ts`
- `apps/editor/src/lib/visitor/public-release-client.ts`
- `apps/editor/src/lib/visitor/visitor-cold-runtime.ts`

Publish pins an existing saved project version. The release row/manifest is immutable for that `(projectId, version)` and the active publication points at one saved version.

Anonymous visitor load currently:

1. reads the stored saved-version JSON;
2. validates it with the shared current `validateProject()`;
3. cold runtime calls the shared `compileLayoutGeometry()`;
4. builds the Room registry;
5. resolves `SceneDocument` through Room transforms;
6. builds the navigation graph;
7. never imports editor session/selection/history/gizmo code.

This creates a hard compatibility requirement:

> existing published snapshots cannot be rewritten in place, and a future codec that accepts only wall-first JSON would make old active releases unreadable.

Compatibility therefore belongs in shared project/layout decoding/runtime preparation, not in the editor route.

---

# 3. Upstream / source evidence

## 3.1 Evidence matrix

| Source | Exact revision/version | License / access | Inspected seam | H5 disposition |
|---|---|---|---|---|
| QGIS | `qgis/QGIS@9d8c4e884a116cf0c573a972748276ea4188f175` | GPL v2 text in root `COPYING`; STUDY only | `src/core/vector/qgsvectorlayereditutils.cpp` `splitFeatures`, `mergeFeatures`; edit tests | **STUDY / ADAPT policy** |
| JOSM | `JOSM/josm@1b1d53f148d4f978c8df9b0554f84b610749a15b` | GPL-family; root license permits GPL v2-or-later for JOSM integral parts and notes combined-distribution constraints; STUDY only | `SplitWayCommand.java`, split strategy/relation rewrite/undo command composition | **STUDY** |
| Open CASCADE Technology | `Open-Cascade-SAS/OCCT@3d097a0328e71b826377d4814ab05ec3c3d23871` | LGPL 2.1 + OCCT exception, or commercial terms | `TNaming_Builder.hxx`, `TNaming_DeltaOnModification.cxx`, `BinMNaming_NamedShapeDriver.cxx`, OCAF guide | **STUDY / ADAPT concepts** |
| Lei & Lei, Transactions in GIS | DOI `10.1111/tgis.12561`, 2019 | publisher article; citation/research use only | abstract + optimization formulation description | **STUDY** |
| Kim, Yu & Bang, Transactions in GIS | DOI `10.1111/tgis.12307`, 2018 | publisher article; citation/research use only | abstract: graph candidates + intersection ratio/Hausdorff/turning-function criteria; 1:1 through many:many | **STUDY** |
| Huh et al., ISPRS JPRS | DOI `10.1016/j.isprsjprs.2013.11.017`, 2014 | publisher article; citation/research use only | abstract/conclusion: intersection-ratio weighted graph and object-set correspondence | **STUDY** |

No GPL source or test text should be ported into Museum. The GPL sources are behavioral/design evidence only.

## 3.2 QGIS — explicit original-feature survivor + field-level split policy

Pinned source:

- <https://github.com/qgis/QGIS/blob/9d8c4e884a116cf0c573a972748276ea4188f175/src/core/vector/qgsvectorlayereditutils.cpp>
- <https://github.com/qgis/QGIS/blob/9d8c4e884a116cf0c573a972748276ea4188f175/tests/src/python/test_qgsvectorlayereditutils.py>
- license: <https://github.com/qgis/QGIS/blob/9d8c4e884a116cf0c573a972748276ea4188f175/COPYING>

`QgsVectorLayerEditUtils::splitFeatures()` splits one existing feature into one geometry that remains on the original feature ID plus newly inserted features. For polygons it compares **area**; for lines it compares **length**; the largest resulting geometry is assigned back to the original feature ID.

This is concrete precedent for the proposed Museum rule that one child survives under the old identity rather than deleting the old identity and minting all-new features.

QGIS also treats metadata as field-specific policy, not a generic object copy. Split fields can use policies equivalent to:

- default value;
- duplicate;
- geometry-ratio allocation;
- unset.

This directly supports H5's field-level Room metadata table.

Failure/negative evidence: QGIS's equal-size split can ultimately depend on the geometry result ordering because its comparisons are strict and the existing split result is retained on an exact tie. Museum must **not** inherit that incidental iteration-order tie. Equal overlap must use an explicit canonical key.

`mergeFeatures(targetFeatureId, mergeFeatureIds, mergeAttributes, unionGeometry, ...)` also makes the merge survivor/attribute result explicit. Geometry union itself does not decide the product identity.

Museum mapping:

- **ADAPT:** greatest predecessor contribution as simple split/merge default;
- **ADAPT:** field-level metadata split/merge policy;
- **REJECT:** source/iteration-order tie behavior;
- **REJECT:** QGIS editing/provider architecture.

Acceptance provenance: asymmetric split, exact 50/50 split, explicit metadata policies, merge survivor.

## 3.3 JOSM — split lineage is a command strategy, not geometry fate

Pinned source:

- <https://github.com/JOSM/josm/blob/1b1d53f148d4f978c8df9b0554f84b610749a15b/src/org/openstreetmap/josm/command/SplitWayCommand.java>

`SplitWayCommand` explicitly exposes a strategy that chooses which resulting chunk keeps the original Way. Built-in strategies include keeping the first chunk or a longest chunk. The command then changes the original Way to the chosen chunk, creates new Ways for other chunks, and rewrites relation membership/order as part of the command sequence.

High-value conclusion:

> the survivor is an operation/product decision and semantic references must be rewritten in the same atomic command; the geometry split does not implicitly own ID lineage.

JOSM also contains useful negative evidence. Its default longest-chunk strategy and tie behavior are not appropriate for Museum's directed Wall semantics. Museum openings are measured from Wall start; retaining the fragment containing the original start gives materially better continuity for offsets, oriented boundaries, compiled references, and selection.

JOSM relation handling also demonstrates that when semantic ordering cannot be established safely, aborting/asking for resolution is preferable to silently guessing.

Museum mapping:

- **STUDY:** explicit split-survivor strategy;
- **STUDY:** relation/reference rewrite in same operation;
- **REJECT:** longest-by-node/default-first survivor;
- **REJECT:** all GPL source/test code.

Acceptance provenance: Wall subdivision lineage, ordered Room-boundary replacement, semantic-reference rewrite, invalid/ambiguous split rejection.

## 3.4 OCCT OCAF/TNaming — persistent identity is explicit evolution history

Pinned sources:

- <https://github.com/Open-Cascade-SAS/OCCT/blob/3d097a0328e71b826377d4814ab05ec3c3d23871/src/ApplicationFramework/TKCAF/TNaming/TNaming_Builder.hxx>
- <https://github.com/Open-Cascade-SAS/OCCT/blob/3d097a0328e71b826377d4814ab05ec3c3d23871/src/ApplicationFramework/TKCAF/TNaming/TNaming_DeltaOnModification.cxx>
- <https://github.com/Open-Cascade-SAS/OCCT/blob/3d097a0328e71b826377d4814ab05ec3c3d23871/src/ApplicationFramework/TKBin/BinMNaming/BinMNaming_NamedShapeDriver.cxx>

`TNaming_Builder` records explicit evolution relationships such as generated, modified, and deleted shapes. Its API allows old→new relationships where a modified shape can represent split/merge outcomes. This is far broader than Museum needs, but the architectural lesson is directly relevant:

> persistent product identity is carried by explicit lineage/evolution records, not rediscovered from geometric equality after the fact.

`TNaming_DeltaOnModification` captures the old/new naming state and restores the recorded state during delta application. It does not rerun the modeling operation to guess identity on undo.

The binary naming driver also has explicit compatibility handling for historical evolution encodings. That is useful schema-migration evidence: version compatibility is decoded intentionally at the persistence boundary rather than silently changing identifier semantics downstream.

Museum mapping:

- **ADAPT concept:** operation-local `RoomReconciliationResult` / lineage result;
- **ADAPT concept:** history restores exact committed identity state;
- **ADAPT concept:** version-aware compatibility decoding;
- **REJECT:** full B-rep persistent naming, label tree, OCAF transaction framework, and shape-history complexity.

Acceptance provenance: split/merge lineage, exact undo/redo IDs, old-format compatibility.

## 3.5 GIS polygon matching research — overlap is useful evidence, not sufficient identity

Primary references inspected:

- Ting Lei, Zhen Lei, *Optimal spatial data matching for conflation: A network flow-based approach*, Transactions in GIS 23(5), 2019, DOI <https://doi.org/10.1111/tgis.12561>.
- Jiyoung Kim, Kiyun Yu, Yoonsik Bang, *A multi-criteria decision-making approach for geometric matching of areal objects*, Transactions in GIS 22, 2018, DOI <https://doi.org/10.1111/tgis.12307>.
- Huh et al., *Identification of multi-scale corresponding object-set pairs between two polygon datasets with hierarchical co-clustering*, ISPRS JPRS 88, 2014, DOI <https://doi.org/10.1016/j.isprsjprs.2013.11.017>.

The literature supports two bounded conclusions:

1. overlap/intersection ratio is a legitimate correspondence signal for changed polygon regions;
2. one-to-many and many-to-many matching is a real assignment problem, and generic geometric matching uses multiple criteria/optimization rather than one greedy overlap number.

That second point is mostly negative evidence for initial P23. Museum authoring operations know their Wall/Junction lineage. It would be wasteful and less deterministic to import a generic GIS conflation solver for every edit.

Museum mapping:

- **ADAPT:** use overlap area only after explicit topology lineage narrows candidate correspondence;
- **STUDY:** many-to-many correspondence is a distinct harder problem;
- **REJECT for P23:** learned/thresholded generic polygon classifier, network-flow conflation solver, Hausdorff/turning-function scoring stack.

---

# 4. Room correspondence model

## 4.1 Core rule

Use this ordering of evidence:

```text
1. explicit authoring-operation Wall/Junction lineage
2. candidate-face boundary lineage
3. predecessor/candidate overlap area
4. predecessor interior witness, only as a secondary tie signal
5. canonical candidate face key
```

Do not use Room count, face traversal order, array order, timestamps, or random allocation as correspondence evidence.

Geometry produces candidate faces. Product reconciliation assigns those faces to Room identities.

A conceptual result shape:

```ts
type FaceKey = string;
type RoomId = string;

type RoomLineageRecord = {
  faceKey: FaceKey;
  roomId: RoomId;
  predecessorRoomIds: readonly RoomId[];
  kind: 'preserved' | 'split-survivor' | 'merge-survivor' | 'created';
};

type RoomReconciliationResult = {
  rooms: readonly LayoutRoom[];
  lineage: readonly RoomLineageRecord[];
  retiredRoomIds: readonly RoomId[];
};
```

This result is an operation result, not a second persistent topology model. The committed `LayoutDocument` carries the resulting IDs. History snapshots then replay those exact IDs.

## 4.2 Canonical face key

H5 needs a deterministic tie key but must not invent a second face extractor.

For every H3 candidate face, derive a key only from H3's already-derived oriented boundary cycle:

1. represent each directed boundary edge as a token containing stable Wall ID plus direction/side;
2. H3 gives one normalized interior orientation;
3. rotate the cycle to the lexicographically smallest token sequence;
4. serialize with the existing collision-safe `geometryId()` tuple helper.

Conceptually:

```ts
faceKey = geometryId([
  'face',
  floorId,
  ...canonicalRotate(directedWallTokens)
]);
```

The face key is **not** a Room ID and need not survive later topology edits. Its job is deterministic sorting/tie-breaking inside one reconciliation.

## 4.3 Wall deformation with unchanged topology

Equal Room count is not enough.

Safe preservation requires that explicit Wall lineage establishes one unambiguous candidate cycle for the old Room. Examples:

- all boundary Walls retain IDs while Junction coordinates move;
- an old boundary Wall is replaced by its known ordered subdivision descendants;
- the entire Room is translated/rotated through an operation that retains the same Wall lineage.

If one old Room's boundary lineage maps to exactly one candidate face and no other old Room competes for that face, preserve the Room ID even if geometric overlap is small or zero. This is important for large translation: geometry-only overlap can be zero while topology identity is obviously unchanged.

Overlap is therefore **secondary**, not required, for unchanged-topology deformation.

Ambiguous deformation includes:

- old boundary lineage maps to multiple candidate faces without a classified split operation;
- two old Rooms' lineages both map to the same candidate face without a classified merge;
- walls are replaced without lineage and geometry happens to look similar;
- equal Room count but candidate assignment can be swapped.

Those cases reject rather than guessing.

## 4.4 Persistent Room anchor / label point

Do **not** add a persisted identity anchor solely for H5.

A stored interior point can become exterior after a valid deformation, can cross a split line, and introduces another value that every topology edit must maintain. Wall lineage already supplies stronger evidence.

For a tie, H5 may derive a temporary representative interior point from the **pre-edit** Room face using the canonical H3 geometry. If that point lies strictly inside exactly one tied candidate, it can precede the canonical face-key tie. It is evidence, not identity, and is not serialized.

If the future product separately needs a user-authored label point, that may later become semantic metadata, but H5 should not create it as a persistent-naming mechanism.

## 4.5 ID allocation

New IDs should be allocated from the pre-commit document using deterministic namespace allocators, never timestamps. Batch allocations must sort creation candidates by canonical `faceKey` first.

This keeps a fresh replay of the same command against the same pre-state deterministic. More importantly, once committed, undo/redo restores the exact snapshot and never calls the allocator again.

---

# 5. Wall / Junction lineage rules

## 5.1 Ordinary Wall deformation

If a Wall remains the same authored Wall and only endpoints/geometry change, keep its Wall ID.

If its start/end Junctions remain the same authored Junctions and move, keep Junction IDs.

Do not reverse canonical Wall orientation merely because the wall moves. Opening meter offsets are measured from Wall start, so orientation is authored identity-bearing structure.

## 5.2 Wall subdivision

The proposed rule is **confirmed with refinements**.

Given Wall `W(A → B)` split at a new Junction `X` at meter distance `d` from `A`:

```text
A────────────B
```

becomes:

```text
A────X───────B
```

Rules:

1. allocate `X` once;
2. fragment `A → X` retains Wall ID `W`;
3. fragment `X → B` gets a new Wall ID;
4. the new Wall ID is allocated before commit and remains in the committed snapshot;
5. a split exactly at an existing endpoint is a no-op/reject, not a zero-length subdivision;
6. every oriented Room boundary using `W` is rewritten atomically.

For a Room using `W` forward:

```text
[W forward]
→
[W forward, W2 forward]
```

For a Room using the same Wall reversed:

```text
[W reverse]
→
[W2 reverse, W reverse]
```

This preserves boundary order independently of which Room side is being described.

### Opening rebasing

Let opening interval be `[o, o + width]` and split distance be `d`.

- if `o + width <= d`: opening stays on first fragment, same opening ID, same offset;
- if `o >= d`: opening moves to second fragment, same opening ID, `newOffset = o - d`;
- if `o < d < o + width`: reject whole operation;
- split exactly at opening start is legal and rebases opening to offset `0` on the second fragment;
- split exactly at opening end is legal and keeps opening on the first fragment.

Equality classification uses H3's canonical predicate/tolerance policy; H5 adds no new epsilon.

### Selection / compiled/query impact

- selected old Wall remains selected because its ID survives on `A → X`;
- new Junction/Wall identities are added as authored records before compile;
- compiled/query records rederive from canonical Wall IDs;
- no stale `(roomId, segmentId)` alias may remain after wall-first cutover;
- the entire edit, opening rebases, Room boundary rewrites, selection reconciliation, validation, and history commit must succeed or fail as one Layout operation.

JOSM's strategy-based split is useful evidence, but Museum's original-start survivor is preferable to longest-fragment because meter offsets and oriented boundaries make the start semantically meaningful.

## 5.3 Wall orientation reversal

Do not use silent orientation reversal as a normal edit.

If migration must adopt the opposite direction for a legacy segment, convert every opening explicitly:

```text
newOffset = wallLength - oldOffset - openingWidth
```

Then preserve opening width/height/sill/profile and opening semantic relations.

This is a deterministic migration adaptation, not an authoring-side reorientation heuristic.

---

# 6. Split / merge / disappearance semantics

## 6.1 Safe automatic reconciliation classes for initial P23

Initial wall-first P23 should automatically reconcile only:

- `1 → 1` unchanged-topology Room correspondence established by lineage;
- `1 → 2` simple Room split;
- `2 → 1` simple Room merge;
- Wall subdivision that leaves Room face count unchanged.

Everything else should be diagnosed before commit.

A correspondence component is considered simple only when the H3 candidate-face graph and explicit operation lineage show that no additional predecessor/candidate Room participates in that component.

## 6.2 Simple 1 → 2 Room split

Rules:

1. verify one predecessor Room produced exactly two candidate faces in the affected correspondence component;
2. use Wall/Junction lineage to establish both candidates as descendants of that Room;
3. compute geometric overlap between the old Room polygon and each candidate using H3 geometry policy;
4. candidate with greatest overlap area retains the old Room ID;
5. if overlap is exactly tied, test the old derived interior witness; if it lies strictly inside exactly one candidate, that candidate survives;
6. otherwise choose lexicographically smallest canonical `faceKey`;
7. other candidate receives a new Room ID allocated deterministically.

### Why overlap **area**

For a simple split the candidates partition the predecessor's semantic region. Comparing `area(old ∩ child)` directly measures predecessor contribution and has no denominator-dependent bias. Comparing overlap fraction against the same predecessor gives the same ranking. IoU is not needed for this classified operation and can penalize candidates differently when the edit also expands outside the old boundary.

### Slivers

H5 must not invent a sliver area epsilon. If H3 declares a candidate face invalid/degenerate, reconciliation never runs. If H3 accepts a small face, H5 treats it as a legitimate candidate. Product-level minimum Room area is a separate future policy.

### Split metadata

- survivor keeps old Room ID and old Room name;
- new Room gets a deterministic default name;
- current minimum deterministic naming rule should extend the existing `Draft Room N` convention: allocate the next unused `Draft Room N` after sorting newly created faces by `faceKey`;
- `floorThickness` and `ceilingThickness` duplicate to both children because they describe the predecessor Room surface state and there is no conflicting predecessor in a 1→2 split;
- legacy `frame` is not split metadata after project-space migration; it is consumed during migration and should be removed/recomputed as compatibility-only data;
- `wallThickness` moves to Walls and therefore is not a Room split inheritance field in the target schema;
- openings move with their hosting Walls and therefore are not copied as Room metadata.

Any future Room metadata must declare a split policy explicitly rather than inherit through object spread.

## 6.3 Exact 50/50 split

A 50/50 split is **not ambiguous** after H5's canonical tie rules.

Order:

```text
derived old interior witness, if uniquely contained
→ canonical faceKey
```

Never use face-extractor iteration order, resulting array order, timestamp, random ID, or screen/selection order.

## 6.4 Simple 2 → 1 Room merge

Rules:

1. verify exactly two predecessor Rooms contribute to exactly one candidate face in the affected component;
2. compute each predecessor's overlap/contribution area to the merged candidate;
3. predecessor with greatest contribution supplies the surviving Room ID;
4. exact area tie uses stable existing Room ID lexical ordering;
5. retired Room ID is removed from the post-commit Layout;
6. metadata uses field-level merge policy below; do not generic-union objects.

This is consistent with QGIS's explicit target-feature model while removing incidental source-order behavior.

### Merge metadata conflict rule

Initial P23 has no merge-conflict UI. Therefore:

- equal field values may merge automatically;
- fields with defined survivor semantics may keep survivor value;
- authored physical fields whose conflict would silently change one predecessor region should reject with a diagnostic until explicit resolution exists.

For current Room fields this means:

- `name`: survivor Room name remains canonical;
- `floorThickness`: if equal, keep; if different, reject/require explicit choice;
- `ceilingThickness`: if equal, keep; if different, reject/require explicit choice.

Choosing the survivor's thickness silently would rewrite authored meaning across the retired Room area, so H5 rejects that shortcut.

## 6.5 Room disappearance / opened enclosure

A Room ID is retired only after H3 candidate-face extraction confirms that no enclosed descendant face remains for that Room's lineage.

After the Scene/Camera project-space migration:

- physical Scene/Camera content stays exactly where it is, even when no Room contains it;
- `LayoutObject` already remains physically valid in project space; if its optional `roomId` is still used as semantic context, clear/reassign it only by explicit rule rather than deleting the object;
- semantic Room references must be resolved before commit.

Current `connectsRoomIds` is an explicit semantic relation. H1 already rejected adjacency inference as authored truth. Therefore H5 must not silently invent a new portal relation from geometry. If the hosting Wall/opening survives but one referenced Room disappears, clear/rewrite the explicit relation according to the concrete topology operation or reject when meaning cannot be preserved.

No persistent Room tombstone is required for initial P23. The history `before` snapshot already contains retired metadata for undo. Persisting deleted-Room tombstones would add a second identity lifecycle without a current product consumer.

## 6.6 Ambiguous many-to-many changes

### Safe automatic

- 1→1 lineage-preserving deformation;
- simple 1→2;
- simple 2→1;
- exact deterministic ties inside those classified cases.

### Ambiguous but user-resolvable

- 2→1 with conflicting current Room surface metadata;
- legacy coincident boundaries whose properties/openings disagree;
- migration where two legacy records could represent one physical Wall but preserving authored meaning requires a user choice.

Until a resolution UI exists, editor mutation/migration should stop with diagnostics rather than choose silently.

### Unsupported/rejected in initial P23

- 2 Rooms → 3 faces in one correspondence component;
- 3+ predecessor merge;
- simultaneous split+merge in one component;
- any candidate face with multiple plausible predecessor assignments after operation lineage is applied;
- broad global rematching caused by deleting/rebuilding Walls without lineage;
- generic geometry-only correspondence across unrelated Rooms.

GIS conflation research shows these can be formulated as general assignment problems; that is precisely why initial P23 should not pretend a greedy overlap rule is enough.

---

# 7. Metadata retention model

Current Room schema contains fewer metadata fields than the H5 brief's generic categories. There are **no current Room material/style fields** and no Room-owned experience/navigation metadata in `LayoutRoom`.

| Current field / relation | Target ownership | 1→1 | 1→2 split | 2→1 merge | Disappearance | Migration treatment |
|---|---|---|---|---|---|---|
| `LayoutRoom.id` | Room | retain | survivor retains; other new | dominant predecessor retains | retire | preserve existing Room IDs |
| `LayoutRoom.name` | Room | retain | survivor keeps; new deterministic default | survivor name | retire with Room | preserve |
| `LayoutRoom.frame` | legacy transform seam | retain only until migration | N/A target | N/A target | N/A target | use to resolve all Room-local Scene/Camera values, then remove or compatibility-only |
| `LayoutRoom.boundary` | derived Room→oriented Wall refs | rebind to face | each child gets derived boundary | merged face gets derived boundary | none | convert segments to Walls/Junctions |
| `wallThickness` | Wall | move to Walls | follows Walls | follows Walls | follows surviving Walls | compatibility requirement for coincident-Wall collapse |
| `floorThickness` | Room | retain | duplicate | equal→retain; conflict→resolve/reject | retire | preserve |
| `ceilingThickness` | Room | retain | duplicate | equal→retain; conflict→resolve/reject | retire | preserve |
| `openings[]` | Wall | move to Wall | follows hosting Wall | follows hosting Wall | follows/deletes with Wall op | preserve Opening identity when possible; rebase on Wall reversal/subdivision |
| `LayoutOpening.connectsRoomIds?` | explicit opening semantic relation | retain/remap | rewrite only if topology operation gives unambiguous relation | rewrite/clear only when unambiguous | clear/reject dangling relation | do not replace with proximity/implicit adjacency |
| `LayoutObject.roomId?` | optional semantic hint at most | retain optional | do not move object | do not move object | clear/retain only by explicit semantic rule | stored transform already world/project-local |
| Scene/Camera `roomId` | **remove as mandatory spatial owner** | N/A target | N/A target | N/A target | N/A target | convert local values to project space first |

`LayoutFloor.elevation` and `LayoutFloor.height` are floor-level properties, not Room metadata. Shared legacy segments being compared on one floor inherently share that floor height; there is no independent current Room wall-height field to reconcile.

---

# 8. Scene / Camera migration

## 8.1 Option A — transitional `SpatialOwner`

Proposed shape:

```ts
type SpatialOwner =
  | { kind: 'room'; roomId: RoomId }
  | { kind: 'layout' };
```

### Benefits

- smaller immediate schema delta for Scene entities/nodes;
- legacy Room-local code can continue to exist during a staged cutover;
- can move one record class at a time.

### Costs against current repo

- creates two transform pathways in Scene/Camera (`room-local` and `layout/world-local`);
- every editor gizmo/placement/duplicate/cluster/camera mutator must branch on owner kind;
- Room split/merge still requires deciding whether Room-owned records should remain with a child, switch to layout owner, or be reassociated;
- cluster same-Room invariants become conditional rather than disappearing;
- project validation must preserve Room refs during the transition;
- visitor runtime must preserve both resolution modes;
- history fixtures multiply because the same operation has two transform semantics;
- the temporary type is likely to become permanent technical debt because existing optional Camera `roomId` already demonstrates mixed ownership complexity.

**H5 disposition: REJECT as the default P23 target.** Use only if implementation discovery proves a direct cutover impossible inside the P23 schedule.

## 8.2 Option B — project/world-local Scene and Camera transforms

This is the recommended P23 target.

After migration:

- Scene entity transforms are project/world-local;
- Camera node eye/target are project/world-local;
- connection anchors/waypoints/view-key targets are project/world-local;
- cluster membership has no spatial Room owner;
- Room association, if later useful for labels/outliner/context, is derived or optional semantic metadata, never required transform ownership;
- content may exist outside every enclosed Room.

This removes the hidden dependency whereby moving a Room frame implicitly moves Scene/Camera values without mutating `SceneDocument`.

## 8.3 Required migration invariant

For every legacy Room-local spatial value:

> resolve through the **legacy Room frame first**, preserve the resulting project/world value, then remove/change Room ownership.

Never delete `roomId` first.

## 8.4 Scene entity position and rotation

Position:

```ts
const worldPosition = layoutRoomPoint(legacyRoom, floor, entity.position);
```

Rotation must preserve the actual parent/local transform composition, not rely on a casual Euler `yaw += roomYaw` shortcut for arbitrary entity rotations.

Conceptually:

```ts
worldMatrix = roomFrameMatrix * localEntityMatrix;
worldTransform = decompose(worldMatrix);
```

or with quaternions:

```ts
worldQ = roomYawQuaternion * localEntityQuaternion;
```

then serialize using the existing Scene Euler convention/order.

Acceptance must compare rendered/world transform matrices before and after migration, including non-zero X/Z rotation, not only simple yaw fixtures.

Lights use the same base Scene entity transform and therefore follow the same rule.

## 8.5 Clusters/groups

Current `SceneObjectCluster` has only `id`, `name`, `roomId`, `memberIds`; it has no independent transform.

Migration therefore:

1. converts every member entity transform to project space;
2. removes cluster `roomId` as a spatial owner;
3. preserves cluster ID/name/member ordering;
4. refactors cluster creation/member insertion so same-Room membership is no longer required;
5. derives any cluster pivot from member project-space transforms through the existing single transform/gizmo system.

Do not invent a second cluster coordinate frame during migration.

## 8.6 Camera nodes

Current node `position` **and** `cameraTarget` are Room-local. Both must be resolved through the same legacy Room frame before `roomId` is removed.

Preserving only eye position would rotate/change the authored view direction.

## 8.7 Camera connection anchors, target waypoints, and view keys

These records already support world-space semantics when optional `roomId` is absent.

Migration is direct:

```ts
if (record.roomId) {
  record.value = rooms.point(record.roomId, record.value);
  delete record.roomId;
}
```

Apply this to:

- `positionPath.anchors[*].position`;
- `targetWaypoints[*].position`;
- both directional `viewTracks[*].cameraTarget`.

Records that already have no `roomId` are copied byte-for-byte for their spatial value.

Connection endpoint positions are derived from node positions at runtime and therefore need no separate persisted endpoint migration after nodes are converted.

## 8.8 Camera orientation

The current persisted Camera node does not store an independent orientation quaternion; view direction is represented by eye `position` + `cameraTarget` (plus FOV and path/view-key framing). Convert both points. Do not introduce a second orientation field solely for migration.

## 8.9 Creation/editing adapters and UI assumptions

Direct project-space cutover must update all code that currently requests or enforces Room ownership:

- Scene placement creation;
- Scene duplication and transform adapters;
- cluster creation/member insertion;
- Camera node creation;
- Camera node drag/gizmo editing;
- path-anchor/waypoint/view-key editors;
- Inspector fields that expose Room ownership as required;
- unified project tree nesting/filtering;
- Room delete reference blocker;
- `validateProjectSceneRooms()`;
- runtime `createLayoutRoomRegistry()` dependency for Scene resolution.

The Room registry can still exist for Layout semantic queries, but Scene runtime resolution should no longer require it to materialize physical transforms.

## 8.10 Recommendation

**Migrate directly to project/world-local Scene and Camera transforms in P23.**

Reason is implementation-specific, not aesthetic:

- mixed world/Room semantics already exist in Camera connection records;
- cluster code currently has hard same-Room constraints that wall-first splits would constantly invalidate;
- current whole-Room transform creates implicit Scene/Camera motion through the Room registry;
- visitor cold runtime currently spends a dedicated step resolving Scene through Rooms;
- a temporary owner union would force duplicate transform code through editor, validation, and visitor seams;
- direct migration turns subsequent topology edits back into Layout-only transactions.

---

# 9. Legacy Layout migration

## 9.1 Migration ordering

For a legacy saved Project:

```text
1. strict legacy Project/Layout/Scene decode
2. capture legacy Room registry/frames
3. resolve every Room-local Scene/Camera value to project space
4. migrate Layout boundaries to Junction/Wall/Openings
5. derive candidate faces through H3 topology
6. bind existing Room IDs to migrated faces
7. validate one canonical wall-first Project candidate
8. only then install editable state
```

Steps 3–7 are one migration transaction/result. If any step fails, do not partially install a mixed schema.

## 9.2 Legacy boundary conversion baseline

For each legacy Room segment, create a source descriptor containing:

- owning `roomId`;
- legacy segment ID;
- orientation;
- exact line/curve data;
- Room `wallThickness`;
- floor elevation/height;
- hosted opening records;
- explicit `connectsRoomIds` relations.

Do not merge coincident segments just because their coordinates are near.

Migration may intentionally test **geometric equivalence** of legacy boundaries using H3's canonical predicate/tolerance because the purpose is schema conversion, but that equivalence check is not reusable normal-authoring ownership inference.

## 9.3 Coincident-boundary classification

A pair/group of legacy boundaries may collapse to one canonical Wall only after all of these are checked:

1. same floor/topological layer;
2. endpoint agreement under H3's migration equivalence policy;
3. compatible orientation after explicit reversal normalization;
4. same wall thickness;
5. same effective wall height (current same-floor segments inherit the same `LayoutFloor.height`);
6. equivalent curve representation where curves are supported;
7. compatible opening sets after orientation normalization;
8. compatible opening width/height/sill/profile/kind;
9. compatible explicit portal relations;
10. no additional legacy metadata would be dropped.

### Lossless

Examples:

- one isolated straight Room: each segment becomes one Wall, Room ID preserved;
- two Rooms share exact reversed straight boundary, same thickness, and no openings;
- two Rooms share exact reversed boundary and carry two records for the same physical opening with exactly matching physical/semantic properties after offset reversal.

### Deterministically adaptable

Examples:

- shared boundary uses opposite direction; normalize one side with:

```text
newOffset = wallLength - oldOffset - openingWidth
```

- legacy segment/opening IDs collide globally even though they were valid in Room-local scope; allocate deterministic wall-first IDs from sorted qualified source keys while recording source→target lineage;
- compatible paired opening records collapse to one canonical Opening; choose survivor from a deterministic qualified legacy key, not Room array order.

### Ambiguous

Examples:

- thickness differs;
- one side has an opening and the other side has a solid wall;
- paired openings differ in kind, width, height, sill, profile, or explicit `connectsRoomIds`;
- curve definitions disagree;
- more than two coincident legacy boundaries compete for one physical Wall;
- semantic relation disagrees even though geometry matches.

Ambiguous migration must not discard one side or silently choose the first record.

## 9.4 Opening-pair migration

To compare opening sets across a reversed legacy boundary:

1. normalize both openings into one canonical Wall direction;
2. compare physical interval start/end after reversal;
3. compare `kind`, `width`, `height`, `sillHeight`, `profile`;
4. compare explicit semantic Room relation after canonical Room-ID ordering;
5. only then classify as the same physical opening.

If compatible, one canonical Opening survives. If the surviving legacy opening ID is not globally unique, allocate a deterministic wall-first ID and retain migration lineage for diagnostics/tests.

Do not infer that two close openings are the same opening.

## 9.5 Existing Room IDs

Legacy Room IDs should be preserved whenever the migrated topology still produces one corresponding enclosed face. Initial migration is not a "new drawing" operation.

For an isolated valid legacy Room this is direct 1→1.

For compatible shared boundaries, deduping two wall records must not cause either adjacent Room ID to change.

## 9.6 Curved legacy boundaries

H3 explicitly requires existing `auto-bezier` fidelity not be flattened/re-written merely to enable straight wall-first topology.

Therefore:

- **REJECT** polygonizing or line-segment approximating a legacy curve as a supposedly lossless migration;
- if the wall-first persisted Wall type can carry a compatibility `auto-bezier` geometry variant, migrate the curve exactly but keep straight-only topology-edit operations disabled on that Wall;
- if the final wall-first schema remains strictly line-only, keep such documents in a compatibility/read-only migration path until curve-preserving representation exists.

This is the one legacy-fidelity case where H5 cannot finish the exact persisted target shape without the final P23 Wall type decision.

## 9.7 Ambiguous saved-project behavior

Recommended behavior:

- lossless / deterministically adaptable legacy projects migrate eagerly **in memory** on load and become editable wall-first documents;
- the next Save writes new-schema-only JSON;
- ambiguous legacy projects remain readable in a compatibility mode with explicit migration diagnostics;
- do not silently Save them as wall-first until conflicts are resolved;
- P23 need not build a full conflict-resolution UI if schedule does not allow it; a read-only blocker is safer than data loss.

Compatibility mode must still use the canonical shared compile/runtime boundary, never a renderer-specific geometry fork.

---

# 10. Schema / version / publish compatibility

## 10.1 Wall-first schema discriminator

Current active Layout JSON has no live schema discriminator. H5 recommends making the wall-first break explicit in `LayoutDocument`.

Given archived Museum terminology that called the immediately preceding Layout model "v3", the least surprising concrete discriminator is:

```ts
type LayoutDocumentV4 = {
  formatVersion: 4;
  units: 'meters';
  // floors, junctions, walls, rooms, objects...
};
```

Compatibility rule:

- missing `formatVersion` + current Room-owned shape → current legacy decoder;
- `formatVersion: 4` → wall-first decoder;
- any other explicit version → reject unless a real decoder is implemented.

Do not infer schema version from presence/absence of arbitrary fields after the versioned cutover.

The Project root itself does not need a second schema number merely for this change; it can delegate nested Layout compatibility to the shared Layout decoder. If final implementation audits historical off-repo data and finds the archived v3 number unsafe to reuse as predecessor continuity, keep the same design but rename the constant; the important requirement is an explicit wall-first discriminator plus a missing-version legacy branch.

## 10.2 Shared compatibility API

Do not overload strict "new document authoring" validation with silent mutation.

Recommended shared layering:

```ts
type CompatibleProjectDecode =
  | { kind: 'wall-first'; project: ProjectDocument }
  | { kind: 'migrated'; project: ProjectDocument; report: MigrationReport }
  | { kind: 'legacy-compatible'; project: LegacyProject; report: MigrationReport };

function decodeProjectCompatible(raw: unknown): CompatibleProjectDecode;
function validateProjectV4(raw: unknown): ProjectValidationResult;
```

Editor Save accepts only `ProjectDocument` with wall-first Layout v4. Runtime compatibility decoding may also accept immutable legacy releases.

## 10.3 API Save / Load

Current API stores whole JSON snapshots and does not itself reinterpret schema.

Recommendation:

- `GET /projects/:id` may continue returning the immutable stored latest document plus save revision;
- editor/shared decoder migrates lossless legacy docs before editable install;
- `PUT /projects/:id` accepts **new-schema-only** canonical Project after P23 cutover;
- server validates the new canonical shape before writing;
- a migrated Save creates a new `project_versions` row; do not update old rows.

This preserves version history and makes migration reversible by loading an older database version even though editor history itself is session-only.

## 10.4 Preview

Draft Preview should consume the same in-memory canonical project candidate the editor would Save. It must not carry its own migration rules.

For an ambiguous legacy project in compatibility mode, Preview may use compatibility runtime preparation, but should clearly remain a read-only legacy projection rather than fabricating a v4 document.

## 10.5 Portable package

Current `.scenepack.zip` is Scene-only, so it does not currently carry Layout Room topology and is **not** a blocker for H5 migration.

If/when portable packaging is upgraded to full `ProjectDocument`, package import must call the same shared `decodeProjectCompatible()` and the manifest should carry package-format version separately from nested `layout.formatVersion`. Do not use the package generator string as schema dispatch.

## 10.6 Published snapshots

Published versions are immutable saved Project snapshots. Never rewrite their database JSON in place.

Public read path must remain able to interpret active legacy releases:

```text
stored immutable release JSON
→ shared compatible decode
→ one canonical runtime preparation boundary
→ compileLayoutGeometry()
→ visitor bundle
```

The public route must not import editor migration UI, selection, history, or session code.

If a legacy release is losslessly migratable, the server/runtime may normalize it **in memory** for delivery. If it is only legacy-compatible because of ambiguous duplicate walls or preserved legacy curves, runtime must preserve its old authored meaning rather than forcing lossy v4 conversion.

Republishing/updating a project after the editor has migrated and saved it naturally creates a new immutable wall-first saved version. Old release versions remain historical records.

---

# 11. History / replay semantics

## 11.1 Exact replay rule

Required rule is confirmed:

> Undo/redo restores exact committed IDs and metadata. It never reruns topology correspondence and never allocates IDs.

Current snapshot history already has the right semantic shape.

A Room split operation therefore commits a Layout snapshot containing:

- final Junction IDs;
- final Wall IDs;
- final Opening hosts/offsets;
- final Room IDs and metadata;
- final oriented Room boundaries.

Undo restores the exact old snapshot. Redo restores that exact new snapshot.

## 11.2 Reconciliation result persistence

The detailed overlap scores do **not** need to become durable project data.

They should exist in the pure operation result during planning/testing/diagnostics. The committed Layout snapshot is the durable result.

If history later moves from snapshots to command logs, the command payload would then need to persist allocated IDs and reconciliation output. That is not current P23 scope.

## 11.3 Migration and history

Project schema migration should run **before** a new editor session's normal undo history is established.

Do not create dozens of user-visible history entries for schema conversion.

Recommended load flow:

```text
raw stored project
→ compatibility decode/migrate
→ validate canonical candidate
→ install Scene + Layout
→ establish baseline
→ clear/new history session
```

This also avoids the current inability to open simultaneous Scene+Layout transactions during the migration that converts both documents.

## 11.4 Invalid operations

Existing `runLayoutMutation()` semantics remain correct:

- begin;
- build complete candidate;
- commit only on success;
- cancel on rejection;
- zero history for invalid/ambiguous/no-op edits.

Topology reconciliation failure must occur before state installation.

---

# 12. Acceptance-fixture ledger

Provenance codes:

- **MUSEUM** — current product/repo invariant;
- **H1** — wall/opening operation evidence;
- **H2** — deterministic stable-ID/selection requirement;
- **H3** — robust topology/face/tolerance requirement;
- **QGIS** — largest-fragment + field-policy evidence;
- **JOSM** — explicit split survivor/reference rewrite evidence;
- **OCCT** — explicit lineage/exact replay evidence;
- **GIS** — polygon correspondence research;
- **MIG** — H5 migration-specific requirement.

| Fixture | Expected result | Provenance |
|---|---|---|
| wall deformation, same Room | Room ID preserved by Wall lineage | H3, OCCT, MUSEUM |
| whole Room translated with zero old/new overlap | Room ID still preserved when Wall lineage is 1→1 | H3, MIG |
| rotated/skewed valid boundary, same topology | ID preserved; overlap not required | H3, MIG |
| equal Room count but candidate correspondence swapped | reject without explicit lineage | GIS, MIG |
| equal Room count with ambiguous rebuilt walls | reject; count is not identity | GIS, MIG |
| boundary Wall subdivision | Room ID unchanged | JOSM, H3, MIG |
| Wall split first fragment | original Wall ID remains on original-start fragment | JOSM, H1, MIG |
| Wall split second fragment | deterministic new Wall ID | H2, OCCT, MIG |
| reverse-oriented Room boundary using split Wall | boundary expands to reversed fragment order | JOSM, MIG |
| asymmetric 1→2 Room split | greatest old-overlap child keeps Room ID | QGIS, GIS, MIG |
| exact 50/50 Room split | witness if unique, else canonical faceKey chooses survivor | H2, QGIS-negative, MIG |
| split creates H3-invalid sliver | reject before H5 reconciliation | H3 |
| split creates H3-valid small face | reconcile normally; no H5 epsilon | H3, MIG |
| split with Room name/thickness metadata | survivor name; both inherit floor/ceiling thickness | QGIS, MIG |
| split with Scene content on both sides after world migration | content transforms unchanged; no mandatory reassociation | MUSEUM, MIG |
| split with Camera content on both sides | all eye/target/path values unchanged in world space | MUSEUM, MIG |
| unequal-area 2→1 merge | greatest predecessor contribution ID survives | QGIS, GIS, MIG |
| equal-area 2→1 merge | stable existing Room ID tie | H2, MIG |
| merge with equal surface metadata | automatic merge | QGIS, MIG |
| merge with conflicting floor/ceiling thickness | reject pending explicit resolution | QGIS field-policy, MIG |
| merge with world-space Scene/Camera content | no physical content movement | MIG |
| Room loses enclosure | Room ID retired | H3, OCCT, MIG |
| Room loses enclosure with unresolved hard semantic ref | reject or explicitly resolve before commit | JOSM, MIG |
| entity outside every derived Room | project remains valid | MIG |
| opening entirely before Wall split | same Opening ID/offset on retained Wall | H1, MIG |
| opening entirely after Wall split | same Opening ID; host new Wall; offset minus split distance | H1, MIG |
| split exactly at opening start | opening moves to second Wall at offset 0 | H1, H3, MIG |
| split exactly at opening end | opening remains first Wall | H1, H3, MIG |
| split through opening interior | reject atomically; no history | H1, JOSM, MIG |
| multiple openings around split | all independently classified/rebased in one operation | H1, MIG |
| reversed legacy Wall with opening | `L - oldOffset - width` preserves placement | H1, MIG |
| one isolated legacy Room | Room ID preserved; segments become Walls/Junctions | MIG |
| two legacy Rooms exact shared straight boundary | collapse when all physical/semantic fields compatible | MIG |
| shared boundary reversed | normalize orientation deterministically | MIG |
| paired compatible openings | collapse to one Wall-hosted Opening | H1, MIG |
| one-sided/conflicting openings on coincident legacy walls | ambiguous; no silent collapse | H1, MIG |
| conflicting wall thickness | ambiguous; no silent collapse | MIG |
| same-floor height comparison | uses common `LayoutFloor.height` | MUSEUM, MIG |
| curved legacy boundary | preserve curve compatibility; never flatten as lossless | H1, H3, MIG |
| ambiguous coincident legacy geometry | compatibility/read-only diagnostic | H3, MIG |
| legacy Room IDs | preserved across lossless migration | OCCT, MIG |
| Room-local Scene position | exact world position preserved | MUSEUM, MIG |
| Room-local Scene arbitrary rotation | world transform matrix preserved | MUSEUM, MIG |
| Camera node eye + target | both resolve through legacy Room frame | MUSEUM, MIG |
| Camera path anchor with roomId | resolved to world then roomId removed | MUSEUM, MIG |
| Camera path anchor already world | value copied unchanged | MUSEUM, MIG |
| target waypoint/view key with roomId | world target preserved | MUSEUM, MIG |
| cluster migration | member transforms unchanged; cluster grouping survives without Room owner | MUSEUM, MIG |
| cluster members formerly in different post-split Rooms | cluster remains valid after world-space migration | MIG |
| split → undo → redo | exact original/new Room, Wall, Junction, Opening IDs restored | OCCT, MUSEUM |
| merge → undo → redo | exact survivor/retired IDs restored | OCCT, MUSEUM |
| subdivision → undo → redo | exact fragment IDs and offsets restored | JOSM, OCCT, MUSEUM |
| ambiguous topology operation | no state/history change | H1, H3, MUSEUM |
| legacy saved project load | lossless migration occurs before session history baseline | MIG |
| legacy active published release | remains visitor-readable without rewriting stored snapshot | MUSEUM, MIG |
| new wall-first save | stored as explicit versioned Layout schema only | MIG |

---

# 13. `PORT | ADAPT | STUDY | REJECT` summary

## PORT

No external implementation code is necessary for H5.

Museum should port only its own already-canonical patterns forward:

- snapshot undo/redo exact-state restoration;
- candidate-first Layout mutation gate;
- `geometryId()` stable collision-safe key serialization;
- existing world-space interpretation of Camera anchors/waypoints/view keys when `roomId` is absent;
- current visitor-safe shared package boundary.

## ADAPT

- QGIS greatest-area original-feature survivor → simple Room split/merge contribution rule;
- QGIS field-level split policies → explicit Room metadata retention table;
- JOSM strategy-based split lineage → Museum original-start Wall survivor;
- OCCT explicit old→new evolution concept → operation-local Room/Wall lineage result;
- OCCT exact delta replay principle → keep snapshot redo, never re-run matching;
- GIS overlap/intersection evidence → secondary correspondence metric after explicit Wall lineage;
- versioned compatibility-driver concept → shared Project/Layout compatibility decode.

## STUDY

- generic CAD persistent naming theory;
- GIS many-to-many polygon matching/optimization;
- JOSM relation rewrite failure behavior;
- OCCT naming persistence/version drivers.

## REJECT

- topology/Room IDs derived from face traversal order;
- Room identity derived from equal Room count;
- timestamp/random survivor allocation;
- global geometry-only Room rematching after every edit;
- QGIS/JOSM incidental first-result tie behavior;
- JOSM longest-by-node Wall survivor;
- generic network-flow/GIS conflation solver in initial P23;
- full B-rep persistent naming framework;
- persistent Room anchor created solely for identity;
- transitional `SpatialOwner` as default architecture;
- deleting `roomId` before world-transform resolution;
- silently flattening legacy curves;
- silently collapsing conflicting coincident legacy walls/openings;
- rewriting immutable published snapshots;
- visitor-specific migration/compiler fork;
- a second topology/face extraction/tolerance policy in H5.

---

# 14. Explicit not-to-import / not-to-do list

1. Do not port GPL QGIS/JOSM implementation or test text.
2. Do not port OCCT OCAF/TNaming infrastructure.
3. Do not make face IDs persistent product Room IDs.
4. Do not use polygon overlap as the first correspondence signal for known authoring operations.
5. Do not preserve Room IDs merely because old/new Room counts match.
6. Do not add a new H5 epsilon, sliver threshold, or point-in-polygon implementation.
7. Do not introduce another compiler or renderer-local migration path.
8. Do not infer Scene/Camera Room ownership from containment after split/merge.
9. Do not move world-space Scene/Camera content when Room topology changes after migration.
10. Do not make clusters own a new spatial transform frame just to remove Room ownership.
11. Do not generic-spread Room metadata across split/merge.
12. Do not silently choose survivor physical metadata on merge conflicts.
13. Do not silently pair legacy openings by proximity.
14. Do not silently merge legacy walls with conflicting thickness/opening/curve semantics.
15. Do not flatten `auto-bezier` legacy geometry to straight walls as a "lossless" migration.
16. Do not make schema migration user undo history.
17. Do not re-run correspondence on redo.
18. Do not rewrite old `project_versions` or published release JSON in place.
19. Do not pull editor session/history/selection/gizmo code into visitor compatibility.
20. Do not expand H5 into BIM, multi-floor topology, general constraint solving, or arbitrary 3D B-rep naming.

---

# 15. Concise recommendations for final P23 reconciliation

1. **Adopt explicit operation lineage as Room identity authority.** H3 returns candidate faces; H5 maps them using Wall/Junction lineage first, overlap second, canonical key last.

2. **Confirm the original-start Wall subdivision rule.** It best preserves meter-offset semantics and stable selection. Rebase after-split openings; reject a split through opening interior.

3. **Limit automatic Room topology correspondence in initial P23 to 1→1, simple 1→2, and simple 2→1.** Reject broader many-to-many components instead of importing a general conflation solver.

4. **For simple split, use greatest overlap area.** Exact ties use old interior witness if uniquely decisive, otherwise canonical directed-wall `faceKey`.

5. **For simple merge, use greatest predecessor contribution; exact tie uses stable existing Room ID.** Current floor/ceiling thickness conflict should reject until explicit resolution exists.

6. **Migrate Scene and Camera directly to project/world-local transforms.** Do not adopt transitional `SpatialOwner` unless implementation proves direct migration infeasible. Convert every Room-local value first, including entity rotation, node target, path anchors, target waypoints, and directional view-key targets.

7. **Remove cluster Room ownership as part of that same Scene cutover.** Preserve group identity/member IDs; keep one existing transform/gizmo system using project-space member transforms.

8. **Keep LayoutObject transforms project-local.** Its optional `roomId` may remain temporary semantic context, but topology edits must not delete/move the object simply because containment changes.

9. **Make wall-first Layout schema explicitly versioned.** Recommended concrete continuation is `LayoutDocument.formatVersion: 4`; missing version decodes the current legacy Room-owned form. Save only v4 after migration.

10. **Run lossless migration before editor history starts.** Convert Room-local Scene/Camera values, then Layout topology, then install a fully validated Project candidate. No partial mixed-schema state.

11. **Treat ambiguous legacy coincident boundaries as compatibility cases.** Keep them readable; do not silently resave them as wall-first until conflicts are resolved.

12. **Preserve existing published snapshots through shared compatibility decode.** The DB snapshot stays immutable. Visitor still reaches one shared runtime/compiler boundary and remains editor-code-free.

13. **Evolve compiled/query identity to Wall/Junction sources.** Keep `roomId` only on Room-derived floor/semantic records; canonical Walls should not duplicate identity per adjacent Room.

14. **Keep current snapshot history.** It already provides exact identity replay. Persist all allocated Wall/Junction/Room IDs in the committed snapshot and never rerun correspondence on redo.

15. **Do not add a persistent Room anchor solely for identity.** Wall lineage is stronger and avoids another maintenance invariant.

---

# 16. Unresolved questions only where evidence is insufficient

## U1 — exact persisted representation for legacy `auto-bezier` Walls

H3 requires preserving existing curve fidelity and keeps wall-first topology operations straight-only. H5 can determine migration semantics but cannot determine the exact final persisted type until P23 chooses one of:

- wall-first `LayoutWall.geometry` supports a compatibility `auto-bezier` variant; or
- curved legacy documents remain in a tagged compatibility representation until later curve topology work.

What must **not** happen is flattening curves or creating a second visitor/compiler geometry model.

## U2 — optional semantic Room association after Scene world-space migration

Current `roomId` is transform ownership, not a clean semantic tag. H5 recommends removing mandatory ownership. There is no current product requirement strong enough to justify immediately adding a replacement `semanticRoomId?` to every entity/camera record.

Default P23 decision should be: **omit replacement semantic ownership** and derive containment for presentation when needed. Add a durable semantic link later only when a concrete product feature requires it.

## U3 — merge-conflict interaction surface

Evidence supports rejecting conflicting Room floor/ceiling metadata rather than silently choosing. The repo does not yet define a merge-conflict UI. Initial P23 may therefore ship deterministic diagnostics/rejection and defer interactive resolution without weakening identity semantics.

---

## Final H5 decision

The wall-first replan is viable without CAD-scale persistent naming machinery.

Museum's strongest path is deliberately narrow:

```text
explicit Wall/Junction lineage
→ H3 candidate faces
→ bounded Room correspondence
→ persistent Room IDs/metadata
→ exact snapshot replay
```

and, independently:

```text
legacy Room frame
→ resolve every Scene/Camera local value to project space
→ remove mandatory Room spatial ownership
```

That separation is the key architecture result of H5. Geometry owns topology. Product logic owns Room identity. Scene/Camera own physical placement independently of Room topology. History owns exact committed state. Compatibility owns old wire formats without contaminating visitor/editor boundaries or creating a second geometry pipeline.
