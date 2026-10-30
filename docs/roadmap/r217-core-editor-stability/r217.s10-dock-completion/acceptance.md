# R217.S10 — acceptance record: Dock completion

**Slice:** R217.S10 · **Status:** implemented; **awaiting owner acceptance** (no
acceptance recorded) · **Plan:** [implementation-plan.md](./implementation-plan.md) (owns the
criteria) · **Phase:** [R217](../README.md) · **Integration route:**
[R217.S11](../r217.s11-integrated-final-gate/acceptance.md)

This record holds implementation and review evidence. It claims no owner acceptance, closeout or merge.
The initial implementation omitted independent review under the original brief. The owner subsequently
requested combined independent T1/T2/T3/T5 review and P0–P2 repairs on PR #229. The
[independent review](./independent-review.md) records that verdict and the superseding verification.

## Implementation

Branch `claude/r217-s10-dock-completion` from `origin/main` `cc7e0537`:

- `ddf461cc` — Ink Box in the Wall reading: two corners become one closed four-point `ChainDraft`
  committed through the existing `layout-wall-chain-commit` planner (four Walls, one derived Room,
  one F4 entry). Drag or two clicks; a degenerate box and a Line/Box switch during a live chain are
  refused in Layout's words.
- `e3368ebb` — Measure and Eraser host tools. The Stage asks each binding that declares host tool
  `measure`/`erase` through the one `resolveStagePick` arbitration (`hostToolTarget`); the Eraser
  then asks only the winning binding for its `eraseAction`, which returns that domain's existing
  Card delete. No new geometry, delete planner or picking authority.
- `5f62fa62` — icon-first Dock **Select · Ink · Measure · Eraser | Library** (V/P/M/E/L, `2` Plan),
  Find arming, Escape order, coarse 44 px keys, and the Place task re-homed as the Library key.

## Verification (before the docs commit)

All exit 0: `npm run test:arch` 23 files / 194 tests; `npm test` 248 / 3,172; `npm run test:heavy`
11 / 138; `npm run check` 0 errors / 0 warnings; camera-core, layout-core, geometry-core and
project-model checks; `npm run build`. The architecture lane was rerun after these docs edits.

Focused regressions: `apps/editor/tests/lib/authoring/layout-drawing-adapter.test.ts` (Ink Box,
byte-identical to four closed Lines), `apps/editor/tests/lib/authoring/stage-host-tools.test.ts`
(new), `apps/editor/tests/lib/authoring/spatial-route-gesture.test.ts` (mounted Dock, Measure, Eraser and
Library workflows), plus `stage-input`, `paper-marks`, `stage-shell-composition` updates.

## Browser workflows (dev editor, Enclosed room starter, Plan reading)

- **Box:** P, Box, drag → four closed Walls and a selectable Room.
- **Measure:** live dashed preview, settled 9.22 m between Room and Box corners; cross-domain Room
  corner → placed Block corner 7.506 m. Selection, Undo and dirty state unchanged.
- **Library:** L opens Place with the selection unchanged; a typed Place placed a Block.
- **Eraser:** red dashed hover; Room floor refused ("A Room floor cannot be erased."); Block erased
  in one click; a Room-bounding Wall shows Layout's disclosure first, the second click erases it and
  opens the Room; Head Undo restores Wall and Room.
- **Keyboard / touch:** shortcuts and Find arm without changing selection; Escape disarms to Select;
  coarse-pointer emulation renders 44 × 44 px keys.

## Notes for the owner

- **Keyboard contract unchanged:** the Dock letters and `2` are inert as Stage commands while a press
  is live, so S07 numeric gesture typing is untouched. `3` still flips the reading during a drag
  (pre-existing asymmetry, not changed here).
- **Opening reachability:** for `erase` only, Layout's Plan pick ranks an in-tolerance Opening over
  its host Wall; Select keeps the accepted Wall-before-Opening order.
- **Disclosure is domain-owned:** Layout sets `confirm` when a Wall delete hosts Openings or retires
  or creates Rooms; Scene deletes never confirm.
- **Fixture limit:** catalogue-model erase is asserted at the binding level, because the original bare test
  fixture had no resource lock. The independent review adds a pinned-model F4 delete/Undo fixture;
  primitives and forms remain covered end to end.
- **Label:** the Find entry formerly "Place object" is now "Library"; instrument copy says "reopen the
  Library".
- **Out of scope, untouched:** grid cutoff, Wall Ink ghosts, direct Wall manipulation, object ghosts,
  narrow-viewport shell overflow and general shell polish.
