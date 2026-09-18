# Pascal Editor harvest brief — shared Plan / 3D authoring

**Date:** 2026-09-09  
**Status:** bounded reference harvest brief — CLOSED  
**Reference:** `https://github.com/pascalorg/editor`  
**Completed artifact:** [`Pascal-editor-harvest.md`](Pascal-editor-harvest.md)  
**Museum decision context:** [`../../archive/plans/2026-09-09-scope-decision-unified-plan-3d-semantic-authoring.md`](../../../archive/plans/2026-09-09-scope-decision-unified-plan-3d-semantic-authoring.md)

## Purpose

Study Pascal Editor as a concrete reference for Museum Editor's ratified direction:

> Plan and 3D are complementary authoring lenses over the same canonical Spatial state, with the target entity's owning document determining the mutation domain.

This is not a generic repo review and does not authorize importing Pascal's scene/node architecture.

Clone Pascal locally and pin the exact commit inspected before recording findings.

## Mandatory source record

Record:

```text
Project: pascalorg/editor
Pinned commit / release
License at that revision
Relevant package/module/file/function/test
Observed behavior
Museum disposition: PORT | ADAPT | STUDY | REJECT
```

**License verification is mandatory before `PORT` or `ADAPT`.** Existing Museum license restrictions remain in force. Where reuse is not license-compatible, UX/algorithm/architecture may still be `STUDY`.

## H1 — shared 2D / 3D semantic representation

Inspect Pascal's semantic node/entity definition and the exact seams for:

- 3D renderer registration;
- floorplan/2D representation;
- floorplan affordances / move targets;
- selection identity;
- placement/edit tools;
- Inspector/parametric capability registration;
- persistence ownership.

Question:

> How does Pascal expose one semantic entity through 2D and 3D without duplicating authored truth?

Museum mapping to evaluate:

```text
P23 shared Plan substrate
P24A PlanProxy / Plan eligibility
P24B B2 placement semantics
P24B B5 cross-view UX
```

Reject any pattern that requires Museum to merge `LayoutDocument` and `SceneDocument`, persist renderer/Three objects as truth, or create a mirrored Plan document.

## H2 — gesture / preview / history lifecycle

Inspect exact begin/update/commit/cancel paths for:

- move / rotate / scale;
- Wall or topology-changing manipulation;
- placement ghosts / previews;
- live overrides/transient state;
- snapping/guides;
- undo/redo/history grouping;
- view changes during an active gesture;
- selection/Inspector synchronization.

Question:

> Which interaction patterns improve fluid Plan/3D manipulation while preserving one deterministic completed gesture → one history result and cancel/no-op → none?

Primary Museum mapping:

```text
P23.1 / P23.2 / P23.9
P24B B1 / B2 / B5
```

Do not import a second history model merely because Pascal uses a different state library.

## H3 — floorplan / architectural editing

Inspect:

- Wall records and endpoint/junction semantics;
- Wall move / endpoint move;
- openings;
- room/zone surfaces;
- wall joins / miters;
- floorplan rendering;
- handles / hover / selection grammar;
- snapping / guides;
- topology synchronization;
- relevant tests.

Question:

> Which floorplan editing patterns can improve P23's wall-first implementation, and which conflict with Museum's explicit Junction/Wall/Room identity and canonical compiler contracts?

Primary Museum mapping:

```text
P23.1 precision
P23.2 snapping/guides
P23.3 openings
P23.6 drafting visual grammar
P23.8 topology interaction
P23.9 Wall/Partition sketching
```

## Required decision table

For each substantial finding record:

| Pascal mechanism | Exact source/test | Upstream semantics | Museum seam | PORT / ADAPT / STUDY / REJECT | Reason / constraint |
|---|---|---|---|---|---|

Pay special attention to dangerous upstream assumptions:

- proximity-derived topology;
- renderer-owned semantic state;
- Three/Object3D parenting as persisted document truth;
- duplicated 2D/3D state;
- UI-specific persistence;
- nondeterministic ID/history behavior;
- camera/navigation duplication;
- generic node architecture that would erase Museum's document ownership split.

## Acceptance-fixture harvest

Extract compact fixture/test ideas with provenance where useful, especially:

- committed selection survives floorplan ↔ 3D switching;
- an entity can be selected but Plan-ineligible for manipulation;
- unfinished gesture/view switch cancels with no history;
- one gesture commits once;
- transient Wall/opening preview does not mutate authored state per pointer frame;
- Plan representation follows canonical entity transform;
- 2D and 3D manipulation converge on the same persisted entity identity;
- topology-changing preview/commit preserves stable IDs where upstream has a useful analogue.

## Authority boundary

This harvest is **not** a new P23 execution gate. P23 remains approved and its implementation-ready children proceed by their existing dependencies.

Pascal findings may refine bounded implementation choices. If a finding appears to prove that Museum's ratified architecture cannot support a required behavior, stop and raise a separate architecture review. Do not resolve that conflict by importing Pascal's scene graph, state architecture or document model by default.

P24 may use the harvest during its existing B0–B5 reconciliation before its minimum freezes.

## Closure record

**Pascal reference harvest:** CLOSED  
**Completed artifact:** [`Pascal-editor-harvest.md`](Pascal-editor-harvest.md)  
**Pinned:** `32c3c8a24dae17c55beaabf45029148900a3b409`  
**Evidence type:** static source/test inspection  
**Upstream tests:** not executed  
**No new P23 gate.**
