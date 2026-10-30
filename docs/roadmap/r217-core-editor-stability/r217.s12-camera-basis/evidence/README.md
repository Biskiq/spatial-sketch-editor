# R217.S12 browser evidence — Camera basis

Captured 2026-10-30 in Chromium through `agent-browser`, 1440×900 CSS px, against the working
tree at patch base `730bc710` with the S12 diff applied. The project is the canonical starter
template **Enclosed room** (`STARTER_ENCLOSURE_POINTS`), booted at
`/project/<id>/spatial?create=1` on the local Vite dev server. One fresh project instance produced
every capture in this directory.

## Journeys

**Azimuth 0, both readings.** Wall `wall-chain-4` (the west wall at X = 0) is selected from the
Index, then the reading flips 3D → Plan → 3D. In Plan it sits on the **screen-left** vertical edge;
in 3D it is the left-hand wall. The Card stays on `wall-chain-4`, the dock stays on Select and Undo
stays disabled, so selection, tool and source are unchanged by the flip. Under the pre-S12 basis
Plan would have read screen right −X and up +Z, placing this wall on the right.

- [browser-01-3d-az0.png](./browser-01-3d-az0.png) — 3D, azimuth 0.
- [browser-02-plan-az0-selected-wall4.png](./browser-02-plan-az0-selected-wall4.png) — Plan,
  azimuth 0 detent, `wall-chain-4` selected on screen-left.
- [browser-03-3d-az0-selected-wall4.png](./browser-03-3d-az0-selected-wall4.png) — back in 3D with
  the same selection and Card.

**A second azimuth.** A real right-button drag orbits to about 114° azimuth, then the reading
flips to Plan. Plan settles on the nearest quarter turn, 90°, as designed; `wall-chain-3` (the
+Z wall), on screen-left in 3D, remains on screen-left in Plan.

- [browser-04-3d-az-orbit.png](./browser-04-3d-az-orbit.png) — 3D after the orbit.
- [browser-05-3d-az90-left-wall3.png](./browser-05-3d-az90-left-wall3.png) — `wall-chain-3`
  selected, left of frame.
- [browser-06-plan-az90-left-wall3.png](./browser-06-plan-az90-left-wall3.png) — Plan at the 90°
  detent, the same wall still left of frame.

**Hover and pan in Plan.** Hovering the selected wall draws its mark and the `Length 7.000 m`
label at the pointer. A left-button drag of +100/+50 CSS px moves the drawing with the pointer
(the wall's screen position moves by the same delta), so Plan pan and marks track the pointer
under the new basis.

- [browser-07-plan-hover-wall3.png](./browser-07-plan-hover-wall3.png) — hover mark at the
  pointer.
- [browser-08-plan-pan.png](./browser-08-plan-pan.png) — after the Plan pan.

## Notes

- The reading flips in these captures use the in-canvas 2D/3D control. A physical mouse click on
  that same control was exercised separately and flipped as expected; the orbit and pan journeys
  used real pointer input. The captures are settled endpoints; continuity **through** the
  transition is not visible in a still frame and is proved by the 601-frame numerical sweep in
  `camera-viewport-evaluation.test.ts`.
- Plan's quarter-turn snapping is intentional (`nearestQuarterTurn`), so the 114° orbit reports a
  90° Plan reading. That is the declared detent policy, not drift.
- No source, history or Save change was made: Undo stayed disabled and Save stayed on its
  "Nothing to undo yet" state throughout.
- Evidence limit: one Chromium session at 1440×900; native touch, Safari, authenticated save/reload
  and dense scenes remain S11's.
