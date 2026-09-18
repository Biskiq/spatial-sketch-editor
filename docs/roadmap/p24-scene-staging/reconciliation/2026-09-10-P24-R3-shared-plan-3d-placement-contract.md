# P24 R3 — shared Plan / 3D placement contract

**Date:** 2026-09-10  
**Status:** reconciliation record — behavioral contract closed; minimum inclusion remains R9/B6  
**Parent:** [P24 reconciliation sequence](../2026-09-09-P24-reconciliation-sequence.md)  
**Cross-view authority:** [Unified Plan / 3D authoring addendum](../../p23-layout-depth/2026-09-09-P23-P24-unified-plan-3d-authoring-addendum.md)

## Scope

R3 freezes the behavior of shared Scene placement when that capability is selected. It does **not** decide whether Plan placement, extra support types, replacement, drag-and-drop, or any other placement depth ships in the P24 minimum. R9/B6 owns inclusion.

Current live code remains uneven: 3D placement still resolves tagged rendered floors and writes `roomId`; Plan already derives and transforms Scene footprints but does not create Scene placements. Those are implementation gaps against this contract, not alternate semantics to preserve.

## Final behavioral decisions

### 1. One semantic Scene placement, regardless of view

Placing a Scene asset creates exactly one canonical `SceneEntity` owned by `SceneDocument`.

`Plan` and `3D` are input/rendering lenses only. The viewport in which placement starts or commits never changes mutation ownership. `LayoutDocument` is consulted for spatial support when needed but is not mutated by Scene placement.

A shared world-local placement write is valid only against canonical Scene meaning (`formatVersion: 1`). A legacy Room-local Scene must be migrated/adapted before the shared world-local operation runs; never mix a roomless world-space entity into a legacy Room-local document.

### 2. PlanProxy is derived, never authored per placement

For a model entity, Plan representation derives from:

```text
SceneEntity.id + SceneEntity transform
            +
AssetDefinition Plan metadata / AssetFootprint
            ↓
derived PlanProxy / footprint
```

The Scene entity keeps the only placement identity. `AssetFootprint` / Plan eligibility remain supply-side asset metadata. No per-instance Plan proxy, Plan transform, support record, or duplicate Plan entity is persisted.

Current projection behavior is the baseline to preserve: canonical roomless entities use the identity frame; Plan uses X/Z plus yaw and effective scale; Y is discarded only for projection. Invalid/missing footprint metadata makes a model Plan-ineligible rather than inventing geometry. A Plan-ineligible entity may remain canonically selected but exposes no misleading Plan placement/transform handle.

### 3. Entry points may differ; the operation may not

Asset Library, Inspector, keyboard, future drag-and-drop, Plan and 3D may expose different affordances, but they must arm the same Scene placement intent and converge on the same Scene-owned commit semantics.

Arming placement creates session/preview state only. It does not create a canonical entity or history entry. A successful commit creates the Scene entity; cancel, invalid placement and no-op create none.

R3 does not require a new command bus or placement framework. Existing `pendingPlacement*` / Scene transaction seams remain the authority to deepen. Current model selection → Inspector `Place` is an acceptable interim UI path; if Plan receives a placement entry, it must route into the same semantic operation rather than a Plan-local creator.

A view must refuse an asset it cannot represent truthfully and surface the reason. In particular, Plan placement requires valid Plan eligibility metadata. R3 does not promote wall, ceiling, arbitrary-surface placement or viewport drag-and-drop into the minimum.

### 4. Plan authors X/Z/yaw; support resolution owns Y

For a newly placed entity in Plan:

- Plan directly authors world X/Z and supported yaw;
- Y is resolved from the selected valid support elevation plus the asset's normalized grounding/contact offset;
- pitch, roll, scale and other non-Plan components come from the shared canonical creation defaults / normalized asset metadata, not ad-hoc Plan resets.

For an existing entity edited in Plan, preserve Y/elevation, pitch, roll and scale unless the explicit operation owns one of those values. The accepted `plan-scene-transform` identity-frame path remains the transform basis for canonical world-local Scene.

The same physical placement intent plus the same support choice must produce the same canonical Scene pose whether the final pointer evidence came from Plan or 3D.

### 5. Support/surface lookup is transient consultation

Support resolution is a read-only calculation. It does not transfer ownership from `LayoutDocument` to `SceneDocument`, and it does not persist a cross-document support link by default.

For Layout-owned floor support, the canonical source is the shared compiled Layout geometry/query seam. Plan may start from X/Z pointer evidence; 3D may start from a rendered hit. Both must normalize that evidence to the same semantic support result before the Scene write.

Behavior:

- no valid support → reject commit with a visible reason;
- one valid physical support result → use it;
- multiple valid supports that produce materially different placement heights/outcomes → require an explicit choice;
- never silently fall back to world `Y = 0`.

Equivalent candidates that produce the same physical placement do not require a user choice merely because multiple query records overlap; deterministic semantic ordering may choose among equivalent results.

R3 freezes this ambiguity behavior, not the set of support providers. The current P24 minimum candidate is floor support. Scene-object stacking, wall support, ceiling support and other providers remain R9 inclusion choices. If later selected, they must feed the same transient support-resolution contract rather than introduce persisted support ownership.

### 6. Selection identity survives the view boundary

A successful placement selects the newly created canonical entity by its Scene entity ID through the existing `EditorSelectionStore` / selection-actions authority. Plan and 3D must never allocate separate selection identities for the same placement.

Committed selection survives Plan ↔ 3D switching while the entity exists. Plan eligibility changes only which handles are available; it does not erase canonical selection. Canonical world-local selection must not require Room ownership.

Pending placement preview/ghost state is not canonical selection. Cancelled placement leaves no created entity and no placement-history result. R4 owns the wider view-switch cancellation/presentation contract.

### 7. One Scene history result; Layout consultation has none

A completed Scene placement is one Scene-owned transaction and produces exactly one `scene` history result.

The following produce no history entry:

- arming a placement;
- PlanProxy/ghost generation;
- support candidate lookup or support choice UI by itself;
- selection changes;
- cancelled / invalid / no-op placement.

Layout support lookup never creates a `layout` history entry. Shared placement must not create a mixed Layout+Scene transaction. Any future feature that persistently mutates both documents requires a separate explicit atomic ownership/history contract and is outside R3.

## R3 non-decisions — remain for R9

R3 does not decide minimum inclusion for:

- Plan creation entry for models/primitives/lights;
- wall / ceiling / Scene-object support providers;
- viewport drag-and-drop;
- replace-asset operation;
- duplicate re-ground behavior;
- additional Plan proxy forms beyond accepted asset footprints;
- presentation polish beyond truthful disabled/ineligible reasons.

If replacement is later selected, it is a separate Scene semantic operation: preserve the canonical entity/placement intent where valid and resolve any changed grounding through normalized asset metadata. It does not become part of the placement creator merely because the UI is nearby.

## R9 handoff

**R3 COMPLETE.** R9 may choose which placement capabilities enter the minimum, but any selected shared Plan/3D placement capability must satisfy the contract above.

The remaining implementation/freeze seams are concrete rather than semantic:

- canonical authoring lifecycle must provide `Scene formatVersion: 1` before world-local Stage writes;
- placement/selectability and related Scene authoring must stop treating Room as ownership;
- wall-first Layout support/Y consultation must use the shared compiled geometry/query authority;
- canonical world-local Scene entities must remain reachable through the existing hierarchy/selection surfaces;
- capability-specific Save/Load / cold-visitor parity and shipped-static model-source authority remain R1/R2 acceptance work.

No additional broad research is required for R3.