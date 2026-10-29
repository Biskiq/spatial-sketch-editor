# R217.S05 — Drafting state: implementation plan

**Slice:** R217.S05 · **Status:** approved (plan); awaits an owner release-list row · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** T1 ·
**Reviewers:** T2 (Scene snap consumer), T3 (framing requests) · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

## 1. Outcome

The creator drafts against a measured surface:

- a grid that stays readable at every zoom;
- one Snap switch that both wall drawing and object placement honour;
- **Scale · Grid · Snap** words that say what is in force;
- a **2D | 3D** control;
- a scale bar.

## 2. Why this is the smallest sensible slice

It adds view state and one snap fact that domains consume through their adapters. Domain snap
targets are unchanged: Junction reuse in drawing and floor support in placement. The grid
increment becomes one more target.

**Deferred:**
- the readings behind ▾ (eye level, elevations, projection);
- rulers and dimension display;
- a fourth drafting word;
- Wall grid on a wall laid flat, which needs Face.

## 3. Dependencies

- R217.S04 accepted, because the grid lies on Paper and the mat.
- **Claims:** `StagePaper.svelte`, a new grid component, the drafting-word component in S02's
  reserved slot, the snap read sites in `apps/editor/src/lib/authoring/adapters/layout/ink.ts` and
  the Scene placement module. The Scene part is a T2-reviewed patch.

## 4. Design

### 4.1 Grid

The grid is a component in `apps/editor/src/lib/authoring/stage/shell/`, drawn in the one Canvas.

- **Ladder:** minor intervals are `1, 2, 5 × 10^n` m, and major is 5 × minor. The reference scale
  is 1 m minor and 5 m major.
- **Interval choice:** the smallest minor whose projected spacing, from the evaluation's
  `targetPlaneMetersPerCssPixel`, is at least 16 CSS px. Opacity fades linearly from 16 to 8 px,
  and the level is suppressed below 8 px.
- **Anchoring:** to world (0, datum, 0). Lines are generated only inside the visible rectangle,
  plus one interval of margin.
- **Colours:**

  | Surface | Minor | Major |
  | --- | --- | --- |
  | Paper | `#9FB2A2` at 0.28 | `#809984` at 0.45 |
  | Mat | `#2B5147` | `#3C6A5C` |

- **Never drawn:** in Shaded Plan, or under a Grid-off state.
- The grid is display-only. It never delays navigation and is never picked.

### 4.2 The snap fact

`StageSession` gains view state: `drafting(): { grid: boolean; snap: boolean; snapSuspended: boolean;
gridMinorMeters: number }`.

- **Defaults:** grid on and snap on.
- `snapSuspended` follows a held **Alt / Option** key, released on blur.
- The increment in force is the current minor interval.

The fact is exposed to adapters through `StageAdapterContext.drafting()`, which is read-only.

- **Layout Ink** (`ink.ts`). When snap is on and not suspended, a free point (one that resolves to no
  Junction or Wall) rounds to the increment in the datum plane. Junction and Wall targets keep
  precedence, so Junction identity rules are unchanged.
- **Scene placement.** A free placement position rounds to the increment. A support-resolved
  height and yaw are unchanged.

### 4.3 Drafting words, reading control, scale bar

- **Position:** in S02's top-left slot.
- **Reading control:** **2D | 3D** as a segmented control. The ▾ is omitted until it holds a
  supported item.
- **Scale.** It shows the current scale (for example `1:100` at 96 dpi reference). Activating it
  opens detents (1:20, 1:50, 1:100, 1:200, 1:500) and **Fit all**. Each is a `ViewingIntent`
  framing request through `requestIntent`; the shell computes no pose.
- **Grid** and **Snap.** Each toggles its one fact and reads `Grid 1 m` / `Grid off`, and
  `Snap 1 m` / `Snap held` / `Snap off`. Off states are words, not colour alone.
- **Configuration:** a small popover from the words (minor interval override; snap on grid on or
  off), also reachable from the app menu's Viewing group.
- **Scale bar:** at the bottom left of the Stage, showing a round length at the target plane.
- **Access:** all are buttons with `aria-pressed` or `aria-expanded`, have keyboard access, and get
  44 px targets on a coarse pointer.

## 5. Tests and acceptance criteria

1. **Decimation** (a new `stage-grid.test.ts` in `apps/editor/tests/lib/authoring/`). Over a sweep of
   200 scales, no drawn level has spacing below 8 px, every visible level is at least 16 px or
   fading, and the origin line stays at world 0 across interval changes.
2. **Snap in Layout.** With Snap on, a Line endpoint at (1.37, 2.81) commits at (1.0, 3.0) with
   1 m minor. With Snap held or off, it commits at the raw point. A point within Junction tolerance
   still adopts the Junction id. Extends `layout-drawing-adapter.test.ts`.
3. **Snap in Scene.** A free placement rounds the same way, and a placement on a supported surface
   keeps its support height. Extends `scene-floor-support.test.ts`.
4. **View state.** Toggling Grid or Snap creates no F4 entry and no dirty state, and is absent from
   Save.
5. **Framing.** Scale detents and Fit all issue `ViewingIntent`s, which a spy on `requestIntent`
   observes, and no shell code writes a pose.
6. **Accessibility.** The words announce their state. Keyboard-only toggling works. Targets are at
   least 44 px under `pointer: coarse`.

## 6. Reviews and stop conditions

- **Reviews:** T2 for the placement rounding; T3 for framing intents.
- **Stop and report if:**
  - grid snap would override a Junction or support target;
  - a framing detent needs a new Camera intent kind, which goes to Camera's owner.

## 7. Handoff

S06 sits with this furniture and uses the snap increment for keyboard steps. S10's Box and Measure
read the same snap fact.
