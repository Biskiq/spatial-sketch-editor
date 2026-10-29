# R217.S06 — Height Sheet foundation: implementation plan

**Slice:** R217.S06 · **Status:** approved (plan); awaits an owner release-list row · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** T1 ·
**Reviewers:** T2 (Scene tick source), T5 (form tops) · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

## 1. Outcome

A slider on the right of the Stage answers "at what height". Dragging it moves the Plan cut, so
Walls and objects visibly move between cut and projected, and in 3D a quiet plane shows where the
cut is. It snaps to the floor datum, to real surfaces and to pins the creator places. It changes
nothing in the project. A later Slice plugs into the same height without changing it
([phase seam](../README.md#height-sheet-foundation-and-the-slice-seam)).

## 2. Why this is the smallest sensible slice

- The Plan cut already exists as host calibration: `cutHeightMeters`, defaulting to 1.2 m in
  `apps/editor/src/lib/authoring/stage/plan-parameters.ts`.
- The facade already merges overrides (`planOverrides`, re-evaluating through the retained Plan).
- So the v1 consumer is one parameter, and this slice's real work is the control, its tick sources
  and the seam.

**Deferred:** Slice and its inspection, 3D cut-away, Ink or placement at height, Level ticks and
persisted pins.

## 3. Dependencies

- R217.S05 accepted: the furniture slot and the snap increment.
- **Claims:** the S02 right-edge slot, `stage-facade.ts` (`planOverrides` write), `stage-session.ts`,
  and a T2-reviewed patch to `scene.adapter.ts` for its tick source.

## 4. Design

### 4.1 Height fact and consumer seam

The new module `stage-height-sheet.ts` in `apps/editor/src/lib/authoring/stage/` is host-owned
view state, created per session:

```ts
type HeightSheet = {
  height(): number;                       // metres above the floor datum
  set(heightMeters: number, cause: 'drag' | 'key' | 'tick'): void;
  pins(): readonly number[];               // session only
  addPin(heightMeters: number): void; removePin(heightMeters: number): void;
  subscribe(role: string, onHeight: (heightMeters: number) => void): () => void;
};
```

- The default height is `PLAN_DEFAULT_CUT_HEIGHT_METERS`. The range is 0 to the highest known tick
  plus 1 m, capped by the Plan evaluator's valid range.
- A replacement resets it, and it is never serialized.
- **v1 consumer, role `plan-cut`:** subscribes, and calls the facade's existing Plan-override path
  with `{ cutHeightMeters }`. Plan re-evaluates through the retainer, and the Paper layer (S04) and
  the pick provider see the new evaluation together.
- The Sheet module imports no consumer, and consumers register at mount. A future Slice adds role
  `slice-horizontal` the same way.

### 4.2 Tick sources

`StageAdapterBinding` gains `heightTicks?(context): readonly StageHeightTick[]`, with
`StageHeightTick = { kind: 'datum' | 'found'; heightMeters: number; label: string }`.

- **Layout:** the floor datum (kind `datum`, label "Floor") and native plinth tops (kind `found`).
- **Scene:** tops of floor-standing entities, from their evaluated bounds (primitives, models,
  forms), as kind `found`. Duplicates within 5 mm are merged by the host.
- **Pins:** the Sheet's own.
- **Level ticks** are not a kind in v1. Adding one later is an additive kind owned by Layout.

The host only merges and sorts; it computes no surface itself.

### 4.3 The control

- **Look:** a thin vertical slider docked in S02's right slot, with a side-swap in the app menu's
  Viewing group. World lens only; hidden in Experience.
- **Ticks:** datum long; found short; pins round. Labels show on hover or drag; on touch, on drag.
- **Snapping:** while dragging, the Sheet snaps to ticks within 6 CSS px, or 12 px on a coarse
  pointer, and shows the snap name. A held Alt suspends it, as in S05.
- **Pins:** placed from a ＋ on the knob, and removed from a pin's own ✕ on hover or long-press. A
  one-time hint appears after the first `found` tick exists in the session.
- **3D plane:** a quiet neutral tint (`#F3F4EE` at 0.12, no depth write) at `datum + height`,
  spanning the Layout bounds. It is shown while the Sheet is hovered, focused or dragged, and for
  1 s after; with Reduce motion on, it hides at once. It is never yellow, never gold, with no
  cut-away and no pill.
- **Access:**
  - `role="slider"` with `aria-valuenow` in metres and `aria-valuetext` naming the nearest tick;
  - arrow keys step by the S05 snap increment, or 0.1 m when snap is off;
  - Page Up and Page Down jump to the next tick; Home returns to the datum;
  - the knob is 44 × 44 px on a coarse pointer.
- **Never:** arms a tool, changes selection, writes source, creates history or makes the project
  dirty.

## 5. Tests and acceptance criteria

1. **Cut consumer** (a new `stage-height-sheet.test.ts` in `apps/editor/tests/lib/authoring/`). On
   a fixture with a 0.9 m Wall and a 3 m Wall, moving the Sheet from 1.2 m to 0.6 m moves the
   0.9 m Wall from `projected` to `cut`, and back on return. The Paper layer draws the new streams.
2. **No source effect.** Height changes, pins and drags create no F4 entry and no dirty state, and
   are absent from Save. After reload the height is 1.2 m and there are no pins.
3. **Ticks come from owners.** With a plinth and a 0.75 m table, the ticks are Floor, the plinth
   top and 0.75 m. A test with the Scene binding removed drops the 0.75 m tick, proving the host
   computed none.
4. **Seam.** A test-only consumer registered with role `probe` receives every height change with
   no edit to `stage-height-sheet.ts`, so the Slice role can be added the same way.
5. **Lens.** The Sheet is absent in Experience, and returns with its height on return to World.
6. **Access.** Keyboard stepping, Page Up and Down, and Home behave as specified. On a coarse
   pointer the knob is at least 44 px and the drag shows the snap name.

## 6. Reviews and stop conditions

- **Reviews:** T2 for the Scene tick source; T5 for form bounds tops.
- **Stop and report if:**
  - the cut range needs a Plan evaluator change;
  - a found surface needs a new domain query, which is a separate owner patch;
  - any consumer would need to write source.

## 7. Handoff

A future Slice registers role `slice-horizontal` and adds its own inspection, pill and cut-away.
Raised Ink and Levels each add a tick kind or consumer through their owning domain's admission.
