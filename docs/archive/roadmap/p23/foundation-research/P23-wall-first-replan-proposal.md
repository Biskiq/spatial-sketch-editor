# P23 Wall-First Re-plan Proposal

**Status:** superseded as planning authority by the owner-ratified P23 reconciliation — 2026-09-09.  
**Original staging baseline:** `1f0d02b64c1701f6d48a7704e0e08abcb2fd659a`.  
**Retained purpose:** decision-history record explaining why P23 moved from Room-owned polygon authoring to wall-first architecture.

The final implementation contract now lives in:

- [`../../plans/2026-09-07-P23-layout-depth-minimum-build.md`](../../plans/2026-09-07-P23-layout-depth-minimum-build.md)
- [`../../plans/2026-09-09-P23.0-wall-first-foundation-migration.md`](../../plans/2026-09-09-P23.0-wall-first-foundation-migration.md)
- [`../../plans/2026-09-09-P23.8-wall-topology-room-regions.md`](../../plans/2026-09-09-P23.8-wall-topology-room-regions.md)
- [`../../plans/2026-09-09-P23.9-wall-partition-sketching.md`](../../plans/2026-09-09-P23.9-wall-partition-sketching.md)

Evidence remains in the H1/H2/H3/H5 harvests under `harvest/`.

## Decision that this staging proposal introduced

The proposal reframed the product from:

```text
Floor
└─ Room
   ├─ owned boundary segments
   └─ owned openings

Scene / Camera
└─ mandatory Room-local placement
```

toward:

```text
Layout
├─ explicit Junctions
├─ explicit Walls
├─ Wall-hosted Openings
└─ persistent Rooms over derived boundary-Wall faces

Scene / Camera
└─ project/world-local physical placement
```

The product principle was:

> **Walls define architecture. Rooms describe enclosed semantic space. Objects inhabit the broader world. Cameras navigate the broader world.**

The proposal also introduced:

- `boundary | partition` Wall roles;
- one physical shared Wall rather than coincident Room-owned copies;
- deterministic Wall subdivision lineage;
- Room identity reconciliation separate from face extraction;
- continuous Wall/Partition sketching with Rectangle/Polygon as convenience frontends;
- direct evaluation of world-local Scene/Camera migration;
- strict retention of one `compileLayoutGeometry()` pipeline.

## What later evidence refined

H3 established the bounded straight-wall topology approach: robust orientation, typed intersection classification, explicit noding, boundary-Wall-only face extraction and diagnostics, while topology never owns Room IDs.

H5 established the identity/migration approach: explicit Wall/Junction lineage first, overlap only as secondary correspondence evidence, bounded `1→1 / 1→2 / 2→1` automatic Room reconciliation, exact snapshot replay, direct Scene/Camera project-space migration, legacy compatibility and immutable publication requirements.

Owner review then added several requirements that were only provisional or missing here:

1. P23.0 + P23.8 form one Foundation Gate; new-schema writes remain disabled until schema, topology/Room reconciliation, migration/compiler/runtime and editor-adapter cutover all pass.
2. Standalone legacy `scene.json` / `.scenepack` conversion requires trustworthy original Room-frame context; matching current Room IDs is insufficient.
3. Read-only legacy compatibility must preserve both conflicting coincident architecture and Room-local Scene runtime resolution without a second compiler or double transform.
4. Legacy nonadjacent `connectsRoomIds` remains compatibility-readable; stricter physical-adjacency validation applies only to new-schema data and blocks new Save until unresolved legacy relations are fixed.
5. `LayoutObject[]` remains document-level/project-world-local; it is not moved under Floors.
6. Rejection rules such as collinear overlap, unsupported nested/hole topology, ambiguous correspondence and conflicting Room surface metadata are umbrella contracts and apply per affected correspondence component.
7. F0 includes selection, Inspector, Room dragging, gizmos, creation tools, project validation and visitor/editor adapters so no old mutator can write incompatible Room-owned data after cutover.

## Authority rule

The harvests did not themselves supersede product contracts.

> **The accepted 2026-09-09 P23 reconciliation supersedes conflicting earlier P23/North-Star direction, informed by H1/H2/H3/H5.**

Current implementation/component docs continue to describe Room-owned/Room-local behavior until Foundation code actually ships. This file should not be used as an implementation plan.
