# P24 R4 — cross-view interaction contract

**Date:** 2026-09-10  
**Status:** reconciliation record — behavioral contract closed; presentation polish remains R8; minimum inclusion remains R9/B6  
**Parent:** [P24 reconciliation sequence](../2026-09-09-P24-reconciliation-sequence.md)  
**Cross-view authority:** [Unified Plan / 3D authoring addendum](../../p23-layout-depth/2026-09-09-P23-P24-unified-plan-3d-authoring-addendum.md)  
**Placement contract:** [P24 R3 shared Plan / 3D placement](2026-09-10-P24-R3-shared-plan-3d-placement-contract.md)

## Scope

R4 freezes cross-view behavior for Scene capabilities that participate in both Scene Plan/Arrange and Scene 3D. It does not decide which capabilities enter the P24 minimum, and it does not freeze visual density, copy, control placement, helper styling or other presentation polish. R8 owns the presentation remainder; R9/B6 owns minimum inclusion.

Camera navigation/preview semantics and Layout-owned mutation semantics remain under their existing owners. R4 does not create a generic command system, merge selection stores, or introduce a view-scoped copy of Scene state.

## Current implementation reading

The live editor already contains most of the required lifecycle primitives, but not all transition wiring:

- `EditorActiveSelectionStore` derives one active semantic domain from the existing Scene, Camera and Layout selection slots. Plan/3D view switches do not themselves rewrite those slots; committed Scene selection is therefore already modeled as view-independent state.
- Scene Plan staging operates on canonical Scene entity IDs. A mixed or ineligible selection does not silently transform only the eligible subset; unsupported Plan manipulation is refused while the selection can remain present.
- Plan staging gestures open one Scene document transaction, preview through reversible candidate document updates, commit once, and cancel through `cancelDocumentTransaction()`.
- the single 3D gizmo host owns one drag session at a time. Its existing cancel reasons include `view-change`; cancellation is exactly-once, restores the adapter baseline/orbit state, releases the Three drag, and makes a later natural `mouseUp` unable to commit.
- the Scene gizmo adapter previews against live roots, then installs final transforms into `SceneDocument` once at commit; cancel restores root snapshots and rolls back the transaction.
- with 3D Scene `Keep on Floor`, commit currently calls `groundSelectionRigidly(...)` after the gizmo host's final displayed preview. Grounding may therefore change Y between the last displayed candidate and the authored commit. This is an existing R3 support/Y integration gap, not a reason to add another preview or placement system.
- `WorkspaceRibbon` currently disables domain/view switching while `store.isEditorInteractionActive`. This is safe against accidental commit but does **not** yet implement the ratified accepted-switch → cancel → switch behavior.

The target contract below therefore deepens existing seams rather than replacing them.

## Final behavioral decisions

### 1. Committed Scene selection is view-independent

Plan and 3D are lenses over the same committed Scene selection. An accepted Plan ↔ 3D switch must not clear, recreate, reorder or remap the selected Scene entity IDs while those entities still exist.

Selection order and primary/active intent remain owned by the existing Scene selection reducer. A view transition creates no replacement selection identity and no history entry.

The composition-root active-selection facade may continue to re-gate which existing semantic slot is active according to domain and Scene Plan owner/mode. That is authority routing, not selection duplication. R4 does not merge the Scene, Camera and Layout selection types or stores.

Canonical world-local selection still requires the R2/R9 Room-context cleanup: the behavioral contract is view-independent, but current `WorkspaceSelection` / selectability seams are not yet fully Room-free.

### 2. View capability changes never erase valid selection

A selected Scene entity that cannot be represented or edited truthfully in Plan remains canonically selected when switching from 3D to Plan. Plan removes/refuses unsupported manipulation rather than deleting the selection or inventing a proxy capability.

For a shared multi-selection operation, Plan must not silently drop ineligible members and mutate only an eligible subset. Unless a future capability explicitly defines partial-operation semantics, the operation is unavailable/refused for the selection as a whole.

The exact disabled treatment, reason copy, warning placement and visual emphasis are presentation decisions and remain R8 scope.

### 3. An accepted view switch is a cancellation boundary for unfinished authoring

If a Plan ↔ 3D transition is accepted while a shared placement or transform interaction is unfinished, the interaction owner must cancel it **before** the view changes.

Cancellation means:

1. restore the last committed document/visual baseline;
2. end the transient pointer/drag/preview session exactly once;
3. produce no history result;
4. preserve the committed Scene selection for a view-change cancellation;
5. only then apply the requested view transition.

View switching never silently commits an unfinished operation. P24 defines no cross-view continuation gesture. A future continuation flow would require an explicit separate contract before changing this rule.

An armed but uncommitted Scene placement is also transient authoring. Switching views cancels the pending placement intent/ghost without creating an entity or history entry. This does not affect an already committed placement selected before the switch.

Escape-specific or pointer-cancel-specific selection behavior remains owned by those existing interaction semantics. R4 does not generalize Escape deselection to view-change cancellation.

### 4. Use the existing cancel owners; do not create a transition command framework

The shell/view transition is responsible for ordering the boundary, but each interaction owner remains responsible for rollback semantics:

- 3D transform → existing single gizmo host / adapter cancellation, using its `view-change` reason;
- Scene Plan staging transform → existing staging gesture cancel → Scene transaction cancel;
- pending Scene placement → existing pending-placement cancel seam;
- other domain-specific interactions remain under their existing owners and are not pulled into P24 merely for symmetry.

The current ribbon behavior — disabling Plan/3D switching whenever `isEditorInteractionActive` — is a concrete implementation gap against this target. R9/selected child implementation must wire accepted view transitions to the existing cancel seams. It must not add a universal command bus, second interaction FSM, or parallel history layer.

Component unmount may remain a defensive cancellation path, but semantic correctness must not depend on accidental teardown order. The requested transition owns the cancel-before-switch guarantee.

### 5. Preview and commit share semantic meaning, not implementation mechanics

Plan and 3D may use different transient rendering mechanics so long as they implement the same semantic operation contract.

Today this distinction is legitimate:

- Plan staging can preview reversible candidate Scene values inside an open transaction;
- 3D gizmo dragging can preview live Object3D roots and write the final Scene values only at commit.

R4 does not require those mechanisms to be made identical.

It does require:

- preview state is transient and introduces no new authored identity or history entry;
- the final displayed candidate is evaluated through the same semantic operation rules as the eventual commit;
- a successful commit produces the same authored result the final preview represented, subject only to explicitly specified validation/snap/support rules;
- validation refusal or cancellation restores the committed baseline instead of silently committing a different/clamped result;
- derived PlanProxy, placement ghost, gizmo helper and other preview-only presentation never become competing persisted truth.

For 3D `Keep on Floor`, the current commit-only grounding step does not yet satisfy that equality: the final preview must reflect the same resolved support/grounding result used by commit. Close this through the existing R3 support/Y integration so support resolution is semantically shared; do not add a second preview, placement pipeline or persisted support owner.

Numerical tolerances for renderer-level acceptance may be specified by the eventual implementation fixture; R4 freezes the semantic equality requirement, not a pixel threshold.

### 6. One completed semantic gesture produces one history result

For every selected capability shared between Scene Plan and Scene 3D:

- one successful completed semantic gesture → exactly one `scene` history result;
- preview updates → no independent history results;
- Plan ↔ 3D switch → no history result;
- selection changes → no history result;
- cancel / invalid / refused / structural no-op → no history result.

A gesture must never become two entries such as “Plan edit” followed by “sync to 3D.” Both views mutate the same Scene-owned operation/result. Layout consultation or derived Plan representation also produces no Layout history result for a Scene operation.

R4 preserves the existing chronological Scene/Layout history controller and transaction seams. It does not introduce a generic command stack.

### 7. Mutation ownership follows the entity, not the view

Cross-view parity never changes document ownership:

- Scene entity operation in Plan or 3D → `SceneDocument` + Scene history transaction;
- Layout-owned target → existing `LayoutDocument` operation/history owner;
- Camera-authored target → existing Camera/navigation operation seams; R4 does not alter the single navigation/camera-motion system.

Plan/3D switching is therefore an interaction boundary, not a document migration or synchronization event.

## R4 implementation gap handoff

The semantic contract is closed. Two concrete integration gaps remain, both owned by existing seams rather than new architecture:

- **cancel-on-switch wiring:** `WorkspaceRibbon` currently refuses view/domain changes while `isEditorInteractionActive`. If a shared Plan ↔ 3D transition becomes available during an unfinished selected P24 interaction, the shell must cancel through the current interaction owner first, confirm the transient transaction/session is closed, then change view. Existing gizmo and Plan staging cancel paths are the implementation primitives.
- **3D Keep-on-Floor preview/commit parity:** grounding currently runs during Scene gizmo commit after the final displayed preview and may change Y. Close this through the already-open R3 support/Y integration so the final preview reflects the same resolved support/grounding result that commit authors. No second preview or placement system.

This is not an argument to allow every domain switch during every editor operation. Capability-specific guards may still refuse a transition when cancellation cannot be made safe. The invariant is: an accepted transition cannot carry or silently commit unfinished shared authoring.

## R9 acceptance handoff

For capabilities R9 actually selects, acceptance should include at least:

- same ordered Scene selection/primary intent across Plan → 3D → Plan while entities remain valid;
- Plan-ineligible or mixed selection remains selected and cannot silently partially transform;
- mid-Plan Scene gesture → request 3D → one cancel, committed baseline restored, zero new history, then view changes;
- mid-3D Scene gizmo → request Plan → one `view-change` cancel, late `mouseUp` inert, committed selection preserved, zero new history, then view changes;
- armed placement → view switch → pending intent cleared, no Scene entity, no history result;
- final preview and committed authored values agree for each selected shared operation, including any support/grounding-adjusted Y;
- cancelled/refused/no-op operation leaves no history result and no preview residue.

R9 owns fixture execution and capability inclusion. These behaviors do not independently promote Plan placement, extra transforms, material/light depth or any other capability into the minimum.

## R4 non-decisions

R4 does not decide:

- exact warning/disabled copy, colors, helper styling, density or affordance placement;
- cross-view discoverability polish;
- Local/World, pivot, align/distribute, duplicate or cluster depth (R5);
- material authoring breadth (R6);
- light/environment depth (R7);
- final presentation/polish (R8);
- minimum inclusion or implementation-ready child scope (R9/B6);
- a cross-view gesture-continuation feature.

## R4 conclusion

**R4 COMPLETE.** Shared Plan/3D capabilities now have one frozen interaction contract: committed Scene selection survives view changes; unsupported Plan capabilities do not erase or partially reinterpret selection; accepted switches cancel unfinished authoring before changing view; preview mechanics may differ while final semantic result must agree; and one completed semantic gesture yields one Scene history result.

No additional broad research is required for R4.
