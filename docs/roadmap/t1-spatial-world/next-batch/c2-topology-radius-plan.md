# T1 Wave 4 · C2 — Topology and Radius Core Plan

**Status:** Authorized implementation plan for C2 under
[c-plan-connected-curves.md](./c-plan-connected-curves.md) following C1 (#409).

## 1. Scope and Boundaries

C2 delivers the pure Layout-core topology, whole-radius, Release, member-guard, and interior-coverage
authorities for connected Round Rooms in `packages/layout-core/src/`, verified by comprehensive
behavioral and numerical tests in `apps/editor/tests/lib/layout/`.

- **In scope (C2):**
  - Closed-to-ring attachment (`planWallChain` / `planWallSegment`) with seam-only solid-gap
    fallback, multi-snap in one stroke, and exact cubic locus preservation.
  - Detach and automatic lossless repack (`planWallRemovalSet` / `planDeleteWall` / `planRemoveRoom`)
    plus Round clearing on divide, shared merge, and exterior arc erase (including ratified B1
    `invalidOutline: 'retire'`).
  - `planReleaseRoundRoom` for both open-arc rings and isolated closed circles (seam-kept and
    occupied-seam two-cut release with deterministic seam knot and explicit seam Junction retirement).
  - Whole-radius resize (`planResizeRoundRoomRadius`) for isolated circles and connected rings with
    straight, curved, and virtual-edge neighbours and atomic whole-edit refusal.
  - Canonical member edit guard (`guardRoundRoomMemberGeometryEdit`) wired across precision edits,
    proposals, preflight, dissolve (`planDissolveJunction`), and fast geometry delta certification
    (`verifySweptBoundsGeometryDelta`).
  - Layout-only interior coverage query (`resolveLayoutRoomInterior`) returning ordered S5a wall-side
    surface references and compiled physical Walls.
- **Explicitly deferred:**
  - **C3:** Round Room connected-component move scope (`layout-room-move.ts`) and connected-ring A5
    duplicate (`layout-duplicate.ts`).
  - **C4:** Editor authoring adapters, gestures, UI cards, F4 acceptance wiring, visitor runtime
    fixtures, and reference contract promotion.
  - **U6 isolation:** Zero changes to `apps/editor/src/` or Appearance/Shell modules.

## 2. Reuse of C1 (#409) Numerical Certification

C2 reuses C1's centre-local binary64 uncertainty-aware certification and template builders directly:

- `certifyRoundRoom`, `buildRoundRoomGeometryFromCertified`, `rotateBoundaryToSeam`,
  `roundRoomSeamJunctionId`, and `findEnclosingRoundRoomForWall` in
  [layout-round-room.ts](../../../../packages/layout-core/src/layout-round-room.ts).
- `UNIT_TEMPLATE_SCALARS` and `unitToWorldPoint` in
  [layout-round-template.ts](../../../../packages/layout-core/src/layout-round-template.ts).
- `buildClosedWallCircleCenterlineFromRay` in
  [layout-closed-wall.ts](../../../../packages/layout-core/src/layout-closed-wall.ts).
- Outward-rounded interval arithmetic in
  [layout-binary64-interval.ts](../../../../packages/layout-core/src/layout-binary64-interval.ts)
  and `tangentAnchorsAllowContinuation` in
  [layout-junction-resolution.ts](../../../../packages/layout-core/src/layout-junction-resolution.ts).

To keep connected-ring splits, evaluations, and tangent joins exact at `[2**32, -(2**32)]` without
altering near-origin frozen digests, `cubicBezierPoint` (`layout-geometry-curve.ts`) and
`subdivideWallCubicSpan` / `resolveWallCurveSplit` (`layout-wall-curve-algebra.ts`) evaluate in
start-shifted local coordinates when `|coord| > 1e6`, and `planDissolveJunction` reuses
`tangentAnchorsAllowContinuation` for curved tangent joins.

## 3. Reconciliation Against Landed S5a, V1, and SP1 Contracts

`c-plan-connected-curves.md` predates the landing of S5a surface references, V1 horizontal regions,
and SP1 open Spaces. C2 reconciles directly against the landed code without a separate cross-track PR:

- **S5a surface references and lineage
  ([layout-surface-reference.ts](../../../../packages/layout-core/src/layout-surface-reference.ts)):**
  - `repackWallSurfaceLineage` maps all oriented ring Wall sides (seam survivor first per Q17,
    flipping `left`/`right` on `reverse` members) onto the canonical repacked closed Wall.
  - Closed-to-ring attach, Release, and detach/repack emit `LayoutSurfaceLineage` normalized via
    `normalizeLayoutSurfaceLineage`.
  - `resolveLayoutRoomInterior` returns canonical S5a `LayoutWallSideSurfaceRef` entries alongside
    `CompiledPhysicalWall`.
- **V1 horizontal regions
  ([layout-region-validation.ts](../../../../packages/layout-core/src/layout-region-validation.ts)):**
  - Closed-to-ring attach, `planWallChain` noding, Release, and automatic repack propagate
    `document.regions[].intendedGaps` through `carryRegionWallIntents`.
- **SP1 open Spaces and B1 erase policy
  ([layout-room-reconciliation.ts](../../../../packages/layout-core/src/layout-room-reconciliation.ts)):**
  - Exterior arc erase rides `planWallRemovalSet` (`invalidOutline: 'retire'`) and clears `round`.
  - Non-erase edits (`planResizeRoundRoomRadius`, `planWallChain`, `planReleaseRoundRoom`) refuse
    invalid Space outlines or SP overlap/containment atomically without retiring any Space.

## 4. Verification Plan

- Typechecks: `npm run check:layout-core`, `npm run check:project-model`, `npm run check`.
- Focused suites: `layout-connected-curves.test.ts`, `layout-round-room.test.ts`,
  `layout-circular-room.test.ts`, `layout-closed-wall.test.ts`, `layout-wall-delete.test.ts`,
  `layout-dissolve-integration.test.ts`, `spikes/s1-connected-curves.test.ts`,
  `sp1a-open-spaces.test.ts`.
- Architecture and docs gate: `npm run test:arch`.
- Relevant heavy correctness suites: `angled-plan-noding-sweeps.test.ts` and
  `correspondence-reference-differential.test.ts`.
