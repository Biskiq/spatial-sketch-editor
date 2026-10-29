# R217.S08 — Scene object marks: implementation plan

**Slice:** R217.S08 · **Status:** approved (plan); awaits an owner release-list row · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** T2 ·
**Reviewers:** T1 (mark layer, host), T5 (shared Scene adapter files), T3 (Card writer) ·
**Runbook:** [T2 operations](../../../operations/t2-composition/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

## 1. Outcome

A creator selects a catalogue model or a primitive and moves, turns and resizes it on the Stage,
with the same marks Walls use. The Card is where they type the exact position, yaw and size, and it
refuses exactly as a drag does. The separate Arrange instrument is gone.

## 2. Why this is the smallest sensible slice

The Scene planners already exist (`place-on-floor`, `set-yaw`, `resize-on-floor` in
`packages/project-model/src/scene-planning/intent-payload.ts`), so this slice adds no planner and no
format change. It adds on-Stage marks for operations that today live in the **Arrange** instrument
(`SCENE_ARRANGE_TASK` in `scene.adapter.ts`) and in Card actions. It moves Arrange's exact fields
into the Card writer, which is PLATE's one writer; T1.P02 did the same for Dimensions.

**Deferred:**
- per-axis scale for catalogue models (the domain does not admit it);
- attachments and multi-select;
- Align/Distribute;
- material and light editing.

## 3. Dependencies

- R217.S07 accepted, with the descriptor contract approved by T2.
- Merges before S09, because both edit `scene.adapter.ts`.
- **Claims:** `scene.adapter.ts`, `SceneTransformInstrument.svelte`, the Scene Card writer, and
  `apps/editor/src/lib/authoring/adapters/scene/placement.ts`.

## 4. Design

### 4.1 Descriptors for a selected object (not a form)

| Mark | Role and kind | Fact | Planner | Disclosed by |
| --- | --- | --- | --- | --- |
| Move | grip · track on the floor plane, through the footprint centre | position | `place-on-floor` | — |
| Turn | grip · ring around the vertical axis | yaw | `set-yaw` | — |
| Scale point | **disclosure** · point at the upper corner of the bounds; reveals Size | — | none | — |
| Size | grip · ray from the base, along the bounds diagonal | scale | `resize-on-floor` | Scale point |

- **Progressive size.** The scale point is an S07 disclosure mark:
  - clicking, tapping, or Enter on it toggles the Size ray;
  - it takes no gesture lease, writes nothing, adds no history and leaves Undo available;
  - Esc or a selection change closes it.

  The Size grip's tag reads `Size {scale} · base stays`.
- **Support.** `place-on-floor` and `resize-on-floor` capture `contactMinY` and the support choice as
  today, so the base stays on its support. Resting objects follow by the existing support rule.
- **Snap.** Move honours the S05 snap fact for free positions.
- **Lights:** have no marks. They keep their existing Card facts.

### 4.2 Card writer

The Scene `cardWriter` for objects gains editable Position (x, z), Yaw (degrees) and Size (uniform
scale):

- each field is written through the same planner as its mark, with the refusal shown in the field;
- Enter commits once, Esc restores and then cancels, and blur never commits;
- the Arrange task, its Find entry and `SceneTransformInstrument.svelte`'s arrange posture are
  removed in the same PR;
- the Place object (Library) posture of that component stays.

### 4.3 Removal

The no-task `pointerIntent` branch that recognizes form size knobs moves to S09. This slice
removes any object-specific overlay ids. Duplicate and Delete stay as Card actions and in the
context menu.

## 5. Tests and acceptance criteria

1. **One entry per release** (extends `scene-editing-surface.test.ts`). Move, turn and size each make
   exactly one F4 entry on a valid release. A release on an unsupported target, or with a scale
   outside the domain range, makes none and shows the domain's refusal.
2. **Support.** After resize, `contactMinY` equals the support height. An object resting on a resized
   or moved object follows its support (extends `scene-floor-support.test.ts`).
3. **Same fact.** Dragging to a value and typing that value in the Card give byte-identical Scene
   source, and identical refusal text for an invalid value.
4. **Progressive size.**
   - The Size grip is hidden and unhittable until the scale point is activated.
   - Activation creates no F4 entry, no dirty state and no live proposal.
   - Esc closes the disclosure before clearing selection.
   - Under `pointer: coarse`, a tap reveals the grip, and every mark has a 44 px area.
5. **Arrange removed.** No `scene-arrange` task, Find entry or instrument posture remains. Every
   field it offered is in the Card, by a field-set equality test.
6. **Regression.** The `T2.P01` and `T2.P02` composition and import tests pass, and Save and reload
   are byte-identical.

## 6. Reviews and stop conditions

- **Reviews:** T1 for mark-layer use; T5 for shared adapter files; T3 for Card writer conventions.
- **Stop and report if:**
  - a mark needs a new Scene planner or payload field;
  - removing Arrange strands a field the Card cannot hold;
  - support behaviour changes under any existing test.

## 7. Handoff

S09 adds form descriptors to the same adapter. S10's Eraser uses `delete-one`.
