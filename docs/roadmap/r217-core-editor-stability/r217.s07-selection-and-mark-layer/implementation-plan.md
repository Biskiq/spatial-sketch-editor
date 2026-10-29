# R217.S07 — Selection, hover and the mark layer: implementation plan

**Slice:** R217.S07 · **Status:** implemented; owner release-list registration explicitly waived · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** T1 ·
**Reviewers:** T2 and T5 (descriptor contract), T3 (selection echo in Experience) · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

> **As-built note and owner amendment (2026-10-29).** Marks draw at calibrated screen sizes,
> the move mark is a two-way base ray, and `extent` reads as the mark's world reach. The owner
> **removed the §4.4 Wall angle ring**: it is not part of the ratified Wall vocabulary and was
> competing with the geometry. The `layout-wall-angle` planner and the Card's Angle field are
> unchanged; no replacement gizmo was added. Height and thickness grips stay deferred, and
> thickness remains a Card field (currently top-level; grouping it under More is Card work
> outside S07 and is not landed here). The rulings and the descriptor contract for S08/S09 are
> in [acceptance.md](./acceptance.md#owner-rulings-2026-10-29).

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

## 1. Outcome

The creator can see:

- what the pointer is over (a quiet highlight);
- what is selected (a gold outline with a light tint, the same in Stage, Index and Card);
- what can be dragged (thin white dashed rays, arrowheads and small points, with a live value
  shown only while hovering or dragging).

Walls and Openings use this language now. Objects and forms follow in S08 and S09.

## 2. Why this is the smallest sensible slice

It replaces two ad hoc mechanisms: the gold SVG dot and grey circles in `StageOverlay.svelte`, and
Layout's three CSS-point handles (`layout-wall-start`, `layout-wall-end` and `layout-wall-body` in
`layout.adapter.ts`'s overlay). The replacement is one host-drawn mark layer fed by domain
descriptors. Layout migrates in the same PR so no knob path survives.

**Deferred:** Scene and form descriptors (S08, S09), Eraser dashes (S10), multi-select, and
Experience Camera marks (unchanged).

## 3. Dependencies

- R217.S03 accepted: hover state, the resolver's reserved mark tier and selection-owner press
  arbitration.
- R217.S04 lands first when both are ready, so Plan selection ink re-strokes Paper fragments.
- **Claims:** `StageOverlay.svelte`, `StageCanvas.svelte`, `stage-facade.ts` (descriptor plumbing),
  `layout.adapter.ts` and `apps/editor/src/lib/authoring/adapters/layout/wall-gesture.ts`.

## 4. Design

### 4.1 Selection and hover

- **3D selection.** For each mesh of the primary selection:
  - a gold edge outline: `EdgesGeometry` at a 30° threshold, a fat line in `#d4ad45`, with a dark
    halo pass beneath;
  - a translucent gold tint clone (opacity 0.18, `depthWrite: false`, polygon offset).

  Both live in the one Canvas on the Stage overlay layer (S04 §4.1.1), with no post-processing
  composer. They are built from the existing Layout and Scene render groups by source id, and are
  never parented under a registered pick root, so the pick source cannot hit a tint clone.
- **Plan selection (as built).** The Paper layer re-strokes the selected source's fragments and
  footprints in PLATE gold `#d4ad45` over the vocabulary's dark halo, above the sheet. A filled
  subject is stroked from the **union** of its fills, so a Wall's per-span cut bands do not
  expose a tick at every shared span edge; non-cut lines (lintel, projected, symbol) remain part
  of the identity. The plan's earlier `#74560c` / +0.5 px line was rejected on the dark cut
  band, where it disappears; the halo is what makes gold legible on both vellum and poché.
- **Hover (as built).** The same two mechanisms in a neutral tone: edge `#F3F4EE` at 0.6, no tint
  in 3D, and a 2 px neutral contour over the dark halo in Plan. It is drawn from
  `session.hover()` and never in gold. Hover is not drawn for the selected subject.
- **Echo.** The Index row and Card identity already follow `selectionState()`; they are unchanged.
  The collapsed-Index chip (S02) uses the same entry.
- **Removed:** `selectionMarker` and its gold dot. Generic `markers` remain only for task previews,
  until those owners migrate.

### 4.2 Handle descriptors (additive binding contract)

`StageAdapterBinding` gains `handles?(context): readonly StageHandleDescriptor[]`, asked only for
the primary selection's owning binding with no task open:

There are two kinds of mark. An **editing grip** changes source through a domain planner. A
**disclosure mark** only reveals grips: it writes nothing and enters no history.

```ts
type StageHandleBase = {
  readonly id: string;
  readonly kind: 'ray' | 'point' | 'ring' | 'track';
  readonly anchor: Vec3;                       // world
  readonly axis?: Vec3;                        // ray/track direction; ring normal
  readonly extent?: number;                    // world reach: driven distance (ray/track) or planar radius (ring); not the drawn size
  readonly bothWays?: boolean;                 // ray/track draws both sides; presentation only
  readonly label: string;                      // accessible name, e.g. 'Size'
};
type StageEditingGrip = StageHandleBase & {
  readonly role: 'edit';
  readonly fact: string;                       // the Card field this addresses, e.g. 'length'
  readonly verb: string;                       // tag template, e.g. 'Length {value} m'
  readonly planner: string;                    // the domain intent kind a release submits
  readonly disclosedBy?: string;               // id of the disclosure mark that reveals it; omitted = always shown
};
type StageDisclosureMark = StageHandleBase & {
  readonly role: 'disclose';
  readonly reveals: readonly string[];         // ids of this binding's editing grips
};
type StageHandleDescriptor = StageEditingGrip | StageDisclosureMark;
```

- **Admission** at registration:
  - **Editing grips** are refused when their `planner` is not one of the binding's registered
    domain planners, or when their `disclosedBy` names no disclosure mark of the same binding.
  - **Disclosure marks** are refused when they reveal nothing, or reveal an id that is not an
    admitted editing grip of the same binding.

  Each refusal is recorded as a diagnostic and the mark is not drawn.
- **Disclosure state** is host-owned session view state: a set of open disclosure ids for the
  current primary selection.
  - **Activation:** a click, a tap, or Enter or Space on a focused disclosure mark. It toggles the
    mark open or closed.
  - **No source effect:** it acquires **no** gesture lease, registers no proposal, creates no F4
    entry and makes nothing dirty. Undo stays available.
  - **Reset:** a selection change, a lens change or a replacement closes it. **Esc** closes an open
    disclosure before it clears selection (the route's `dismiss` branch gains this step before
    `closeSelection`). A 2D ↔ 3D flip keeps it, per reading continuity.
  - **Hidden grips:** while closed, its grips are not drawn and have no hit area.
- **Keyboard path:** the Card's fields for the same facts are the non-pointer path. Disclosure marks
  are also focusable in the overlay, in descriptor order, after the Card.

- **Drawing.** The host draws admitted marks in the SVG overlay, projected through the same
  `ViewportEvaluation`, the existing overlay pattern. Each mark is:
  - a white 1.5 px dashed line with a 3 px dark halo `#152C26`;
  - an open arrowhead at the drag end (both ends for a `bothWays` ray/track);
  - a 6 px white point at anchors, gold `#d4ad45` while held; a disclosure point is a 7 px white
    ring, filled while open;
  - a dark mono value tag, shown only on hover or drag.

  The vocabulary is drawn at a calibrated screen size (`STAGE_MARK_GLYPH_CSS`: ray 30 px,
  two-way half 16 px, ring radius 30 px), so a 0.6 m plinth and a 24 m roof read alike. `extent`
  remains the mark's world reach, never its drawn size.
- **Hit areas:** 22 px on a fine pointer and 44 px on a coarse one, while the visual size stays the
  same. Marks fill the S03 resolver's mark tier above world candidates.
- **Density.** A ray/track whose projected axis is edge-on (a one-metre step under 3 px) is
  withheld, and so is a ring whose projected minor axis is under 8 px. When two marks' hit areas
  overlap, the owning domain's descriptor order wins.

### 4.3 Drag through descriptors

- A press on an **editing grip** acquires the gesture lease with the owning adapter as owner and calls the
  binding's existing `pointerIntent` path, with the descriptor id added to `StagePointerIntent` as
  `handleId`.
- The adapter keeps its candidate, planner and refusal. The tag shows the adapter's published live
  value and refusal.
- **Typing at the gesture:**
  - digits while dragging turn the tag into an input;
  - Enter commits once through the same planner;
  - the first Esc restores the transient value, and the second cancels;
  - blur never commits.

  This reuses `plan-numeric-entry.ts`'s existing semantics.

### 4.4 Layout migration

`layout.adapter.ts` publishes descriptors for a selected Wall:

| Descriptor | Kind | Fact | Disclosed by |
| --- | --- | --- | --- |
| Start point | point | length | — |
| End point | point | length | — |
| Length | ray at the free end, along the Wall frame | length | — |
| Move | two-way track across the base | position | — |

- **Owner amendment (2026-10-29):** the Angle ring is removed from the plan and the Stage. It
  competed with the geometry and is not in the ratified Wall vocabulary. Angle remains a Card
  field through the unchanged `layout-wall-angle` planner; no replacement grip is added.
- **Opening:** position (track along the host Wall) and width (one ray from the free edge; the
  existing planner fixes the start edge, so a second width grip would be a false affordance).
- **Wall thickness** stays a Card field. It is currently top-level; grouping it under More is
  Card work outside S07 and is not landed here.
- **Removed in the same PR:** the three CSS-point overlay handles and their labels, and the
  shift-drag angle mode. Angle is Card-only after the owner amendment.
- The Junction-preserving planners are unchanged.

## 5. Tests and acceptance criteria

1. **Admission** (a new `stage-handles.test.ts` in `apps/editor/tests/lib/authoring/`):
   - an editing grip with an unregistered `planner` is refused and not drawn;
   - a disclosure mark with no planner and a valid `reveals` is admitted;
   - a disclosure mark that reveals nothing, or reveals a foreign id, is refused.
2. **Colour roles.** In both readings:
   - hover never uses `#d4ad45` or `#74560c`;
   - the selected subject has the gold outline and tint, or ink in Plan;
   - Index and Card identities equal the Stage selection's source id.
3. **Layout marks** (extends `layout-wall-manipulation.test.ts`):
   - a valid length or move release makes exactly one F4 entry, and an invalid release none;
   - the Angle writer is the Card field (no Stage mark), through the unchanged planner;
   - Junction ids are preserved across an end drag;
   - each mark and its Card field give byte-identical source and the same refusal text.
4. **Typing at the gesture.** The sequences digits → Enter, digits → Esc → Esc, and digits → blur
   give one entry, no entry and no entry respectively.
5. **Disclosure behaviour** (a probe binding with one disclosure mark revealing one grip):
   - opening it shows the grip, with no F4 entry, no dirty state and no live proposal;
   - Undo stays available;
   - Esc closes the disclosure first and clears the selection second;
   - a selection change closes it; a 2D ↔ 3D flip keeps it.
6. **Coarse pointer.** Under emulated `pointer: coarse`, every Layout mark is pressable through a
   44 px area. A press 20 px from a mark on empty Stage starts navigation, not a mark drag.
7. **No leftovers.** No `layout-wall-start`, `layout-wall-end` or `layout-wall-body` overlay ids
   remain, and `selectionMarker` is removed (structural check).

## 6. Reviews and stop conditions

- **Reviews:** T2 and T5 approve the descriptor contract before S08 and S09 start; T3 checks
  Experience selection echo.
- **Stop and report if:**
  - a Layout mark needs a planner change;
  - the 3D outline is unreadable on pale Walls without a post-processing pass. That is an owner call
    on bundle cost.

## 7. Handoff

S08 and S09 publish descriptors for objects and forms and delete their knobs. S10's Eraser uses
the hover state for red dashes.
