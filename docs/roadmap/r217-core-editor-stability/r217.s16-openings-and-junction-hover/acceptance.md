# R217.S16 — acceptance record: Openings and Junction hover

**Slice:** R217.S16 · **Status:** implementation evidence captured; review and acceptance pending · **Plan:**
[implementation-plan.md](./implementation-plan.md) (owns the criteria) · **Phase:**
[R217](../README.md) · **Integration route:**
[R217.S11](../r217.s11-integrated-final-gate/acceptance.md)

Implementation branch: `codex/r217-s16-opening-junction-hover`.
Implementation commit: `334a38f4` (based on `b5a6fb1c`) · Pull request:
[#237](https://github.com/Biskiq/spatial-sketch-editor/pull/237).

## Verification

- `npm run check` — passed; Svelte check reported 0 errors and 0 warnings.
- Affected contract files — passed, 5 files / 105 tests:
  `plan-pick-index`, `stage-paper-pick`, `layout-wall-manipulation`, `stage-host-tools`,
  and `stage-handles`.
- `npm run test:arch` — passed, 23 files / 194 tests.

## Browser evidence

Manual acceptance journeys were exercised in the local editor at `http://localhost:5173`.
The screenshots below are evidence for review; they do not record independent acceptance.

- On Plan with Index collapsed, selected an Opening from the canvas, slid it by its position
  handle, and resized it by its width handle. The recorded values changed from Offset 3.05 m
  to 3.55 m and Width 0.90 m to 1.45 m. See
  [selected](./evidence/opening-plan-selected.png), [slid](./evidence/opening-plan-slid.png),
  and [resized](./evidence/opening-plan-resized.png).
- With no subject selected, hovering a room corner displayed one Junction mark. Dragging it
  showed a live 0.500 m snap proposal; release moved the corner while leaving selection empty,
  and Undo became available. See [hover](./evidence/junction-hover.png),
  [drag preview](./evidence/junction-drag-preview.png), and
  [moved corner](./evidence/junction-moved.png).
- From a point 17 CSS px from that Junction, with no Junction mark shown, dragging panned the
  canvas by about 30 px horizontally and 20 px vertically while the room geometry stayed fixed.
  See [before](./evidence/pan-near-junction-before.png) and
  [after](./evidence/pan-near-junction-after.png).

Review, integration acceptance, and slice acceptance remain pending. No release or merge is
recorded here.
