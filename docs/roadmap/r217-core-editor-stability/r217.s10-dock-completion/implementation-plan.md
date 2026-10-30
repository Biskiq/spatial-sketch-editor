# R217.S10 — Dock completion: implementation plan

**Slice:** R217.S10 · **Status:** approved (plan); owner authorized direct implementation 2026-10-30 · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** T1 ·
**Reviewers:** T2 (Scene delete, Library key), T5 (form delete), T3 (Find arming) · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

## 1. Outcome

The dock is the owner-ruled set (D3): **Select · Ink · Measure · Eraser**, with **Library** beside
it. Each tool has an icon, a key and a palette where it needs one.

- **Ink:** draws a room as a Box in one step.
- **Measure:** measures without touching the project.
- **Eraser:** removes one thing per click, and Undo brings it back.

## 2. Why this is the smallest sensible slice

- **What exists:**
  - the dock (`StageDock.svelte`, fed by contributions with `home: 'dock'`);
  - Ink with its Wall and Shape readings;
  - the delete planners: `layout-wall-delete`, `layout-opening-delete` and Scene `delete-one`;
  - Place object, which becomes the Library key.
- **What is new:**
  - Box for the Wall reading (the Shape reading already has Line, Box, Round and Sketch);
  - two host tools, Measure and Eraser, that write nothing of their own;
  - the dock's visual and key treatment.

**Deferred:**
- Slice and Brush;
- Round and Sketch for Walls (curved Walls are outside R217);
- the Eraser's sweep and kind filter, and cross-domain composed erase.

## 3. Dependencies

- R217.S02 accepted (lower column), S05 (snap fact), S07 (hover drawing) and S08 and S09 (no Scene
  knob path left).
- **Claims:** `StageDock.svelte`, `stage-contributions.ts`, `layout.adapter.ts` (Ink Box) and
  `apps/editor/src/lib/authoring/adapters/layout/ink.ts`; a new host tool module; and a
  T2-reviewed patch to `scene.adapter.ts` for the Library key's home.

## 4. Design

### 4.1 Dock treatment

- **Keys:** icon-first (inline SVG, 20 px, white on the forest dock), each with a tooltip giving its
  name and key. The armed key is ivory `#f3f0e4` with a dark icon; tool colour appears only as a
  2 px mark.
- **Order:** Select · Ink · Measure · Eraser | Library.
- **Palette:** clicking the armed key collapses or reopens its palette. Esc collapses an open
  palette, then disarms. A faint caret marks a collapsed palette.
- **Arming never changes selection.**
- **Keys:** V Select, P Ink, M Measure, E Eraser, L Library. The existing `p` reading key moves to
  `2`, beside `3`. This is recorded as a production key-map decision, and the Keys list (S02) shows
  the map.
- **Find:** arms every dock tool with its Arm verb (existing Find plumbing).

### 4.2 Ink: Box for the Wall reading

- The Ink palette gains **Line | Box** for the Wall reading.
- **Box:** two presses (or press-drag-release) on the datum plane give opposite corners. Corners
  honour the S05 snap and existing Junction targets.
- **Release:** builds a 4-point closed `ChainDraft` and submits **one** `layout-wall-chain-commit`,
  the same intent as four Lines closed by hand, so Rooms derive as today.
- A degenerate box (edge below the minimum) refuses in words.
- The Shape reading's Line, Box, Round and Sketch options are unchanged.

### 4.3 Measure (host tool)

- **Module:** a new `stage-measure.ts` in `apps/editor/src/lib/authoring/stage/`.
- **Gesture:** press, drag or click twice. Each endpoint resolves through the S03 resolver as host
  tool `{ kind: 'measure', scope: 'host' }`.
  - Layout and Scene declare `hostTools` including `measure`, and each returns its own measurable
    point: Layout a Wall end or Junction within its tolerance, Scene a bounds corner within 8 px,
    or else the surface point.
  - The two domains' winners are arbitrated spatially, so one measurement can run from a Wall end
    to an object corner.
  - With no domain winner, the endpoint is the snapped datum point (S05).
- **Result:** a dimension line and a mono tag (`3.42 m`), drawn in the mark layer as a dimension
  line.
- **Lifetime:** Esc clears it, and it persists only until the next measurement or disarm.
- **No proposal:** it registers none, so it never blocks Undo, writes nothing, never makes the
  project dirty and is never saved.

### 4.4 Eraser (host tool)

- **Module:** a new `stage-eraser.ts` in `apps/editor/src/lib/authoring/stage/`.
- **Marking:** while armed, the winner of host tool `{ kind: 'erase', scope: 'host' }` is drawn in
  red dashes `#d0412d`, using S07's hover mechanism with the erase treatment. Layout and Scene
  declare `hostTools` including `erase`. On a coarse pointer the dashes appear on press; sliding off
  cancels.
- **Eligibility is each domain's.**

  | Domain | Eligible | Refused (in the domain's words) |
  | --- | --- | --- |
  | Layout | Walls, Openings (its existing Card delete actions) | Room floors, the plinth and the datum |
  | Scene | Models, primitives, forms (`delete-one`) | Lights; lights are not picked |

  A refused winner is reported with its refusal. The Eraser never skips to an eligible subject
  behind it.
- **Click:** looks up the subject's owning binding and calls its delete action:
  - Layout Wall → `wallDeleteIntent`, with its existing consequence summary;
  - Layout Opening → `openingDeleteIntent`;
  - Scene object or form → `delete-one`.

  Each is one F4 entry. When a domain's delete needs confirmation (a Wall whose removal merges
  Rooms), the domain's existing disclosure shows at the pointer. The Eraser adds no rule of its own.
- **Refusal:** an ineligible target (a Room floor, the datum) refuses in words beside the pointer.
- **Contract:**
  - bindings expose deletion through a new optional `eraseAction?(subject)`, which returns their
    existing Card delete action, or a refusal;
  - the Eraser calls the **winning** domain's `eraseAction` only;
  - there is no new planner.

### 4.5 Library

The Library key opens Scene's Place object task (`place-object`) as the Library Instrument above
the dock. Its Find entry moves from Find-only (S02) to `home: 'dock'` with `slot: 'library'`.

## 5. Tests and acceptance criteria

1. **Arming.** Arming each tool leaves `selectionState()` unchanged, and Esc collapses the palette
   and then disarms (extends `stage-input.test.ts` and the shell tests).
2. **Box.** It makes one F4 entry and derives Rooms. Its Layout source is byte-identical to four
   Lines with the same corners. A degenerate box refuses with no entry (extends
   `layout-drawing-adapter.test.ts`).
3. **Measure.**
   - Measuring between two Wall ends reports their distance to 1 mm.
   - One measurement from a Wall end (Layout winner) to a model's bounds corner (Scene winner)
     reports their distance to 1 mm, which proves cross-domain routing.
   - Measure creates no F4 entry, no dirty state and no proposal, and Undo stays available during it.
4. **Eraser.**
   - Erasing a Wall, an Opening, a catalogue model, a primitive and a form gives one entry each,
     each dispatched to its owning domain's action, and Undo restores the same ids.
   - A Room floor and the plinth refuse in Layout's words, with no entry.
   - Red dashes appear only while the Eraser is armed.
   - On a coarse pointer, press shows the dashes, release erases and slide-off erases nothing.
5. **Library.** The Library key opens the placement Instrument, and placing an object still works
   (T2 tests).
6. **Find.** It arms all four tools and the Library.
7. **Coarse pointer.** Dock keys are at least 44 × 44 px under `pointer: coarse`.

## 6. Reviews and stop conditions

- **Reviews:** T2 for Scene delete and the Library; T5 for form delete; T3 for Find arming and the
  key-map change.
- **Stop and report if:**
  - Box needs a Layout planner change;
  - an erase needs a cross-domain composed plan;
  - the `p` key move conflicts with an existing accepted key contract.

## 7. Handoff

A later Slice tool gets its own dock key through capability admission. Sweep erasing waits for a
composed multi-subject plan.
