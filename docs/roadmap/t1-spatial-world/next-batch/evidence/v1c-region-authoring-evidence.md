# V1c — Region authoring, Lift and Stage parity

**Status:** implementation and mounted verification complete; focused browser QA attempted but
blocked before a Region could be drawn (see Browser QA). No production deployment was made.

## What was implemented

- **Create.** `Terrace` (floor) and `Roof › Flat` (overhead) arm the existing Ink task with the
  new built-in readings; Box and Line use the existing draft, height-ray and Finish grammar.
  Elevation is the Height Sheet's height, an overhead at the Floor datum takes the Wall creation
  default (3 m), and new Regions start at 0.10 m. Birth is one captured planner intent; Undo
  removes it and Redo reuses the captured id.
- **Edit.** Corner knobs, corner removal on the chord, edge **Add corner here**, body move,
  rotation, elevation ray, Card thickness and exact Width/Depth, thumbnail-free duplicate,
  measured relations, one-shot fits, intended gaps and Erase all use retained region planners
  through F4. A release is one history entry; a refused or no-op release writes no document.
- **Card, relations and index.** `LayoutRegionCard.svelte` writes kind, name, both elevation
  readings, thickness, Width, Depth, Area, derived **Relations** (`Meets`, `Crosses`, measured
  `Gap`, intended gaps), per-relation fit/Mark intended, Space/Wall fits, Duplicate and the
  Erase disclosure. The selected Region's gaps are measured Stage dimensions; an unselected
  Region draws no cue. Height Sheet ticks expose tops and undersides. The Index has one
  **Regions** group, and a Space Card lists its Regions and reads **Open to sky · under name**
  where a Flat Roof applies.
- **Lift, Stage and shadow.** Lift consumes the typed `OverheadSource` list from
  `overheadSourcesOf`; floor Regions remain in the world and Flat Roofs are lifted beside Room
  lids. The region representation uses `LIFTED_RENDER_LAYER`, and every point, spot and sun
  shadow camera enables that layer. Plan and 3D outline picking resolve the lifted Region's
  own fragment; Put back, as-built Preview and Look-through are unchanged.
- **Resting objects.** A floor Region's Card and Erase action disclose
  `countSceneRootsOnFloorRegion` before the operation. They read Scene; they never write it.

## Automated evidence

| Acceptance | Evidence |
| --- | --- |
| T-V5 | `layout-region-planners.test.ts` (fit/relation/refusal coverage), `layout-region-authoring.test.ts` Card relations and selected-gap dimension test |
| T-V7 | V1b `layout-regions.test.ts` and `layout-room-lift-action.test.ts`; `layout-region-authoring.test.ts` Space association, Card delete and Lift source test (a floor Terrace is not lifted) |
| T-V11 | `lift-shadow-eligibility.test.ts` (lifted layer on point/spot/sun shadow cameras, negative control), `scene-region-support.test.ts`, `layout-outline-pick.test.ts` (outline-pick mechanism; the V1c provider branch names a region fragment), `layout-region-authoring.test.ts` Lift/Put back |
| T-V12 | `layout-region-authoring.test.ts`: body move Undo/Redo, birth Undo/Redo with captured id, Card delete Undo, refused birth adds no history, Esc adds no history |
| T-V13 | `layout-region-authoring.test.ts`: pointer corner/body gestures only preview until release; Esc restores; every accepted gesture is one history entry |

Focused numeric coverage in `layout-region-authoring.test.ts` (9 tests): planner registration and
Card surface; body move with Undo/Redo; Esc during a corner drag; Terrace Box birth at the Height
Sheet with Undo; Flat Roof Line birth at the datum default; overlapping birth refusal; selected
Region measured gaps with no cue when unselected; Space association and Card delete; Lift names
the overhead and Put back ends the reading.

Checks run in `apps/editor`:

- `npm run check` — 0 errors, 18 warnings.
- `npm run test:arch` — 38 files, 350 tests passed.
- `npm run test:fast` — final run: 433 files, 5347 tests passed. An earlier run exposed a stale
  planner-count assertion; it was updated for `createRegionPlanners()` and the lane rerun green.
- Focused suites: 143 region/Lift/render tests passed; 55 Lift/Ink tests passed; 36 region and
  Ink boundary tests passed; 27 architecture boundary tests passed.

## Browser QA

The self-contained stack (`npm run dev:local`) started successfully on
`http://localhost:5177`. The editor, Index and **Regions** facet rendered. Two blockers prevented
the J7/J11 gesture pass:

1. The SvelteKit development page did not hydrate automatically in the Local browser; a manual
   `kit.start` was required. This reproduced on the existing `main` worktree server too, so it is
   not V1c.
2. A newly created guest/cloud project reached the spatial route but exposed no Layout dock tools
   (`Ink is not available in this project`). The same behavior occurred on the `main` worktree
   server, including after signing in with a locally registered account. No starter/empty
   project could draw a Wall, so a Terrace/Roof gesture and the resulting Card, Lift and Plan/3D
   parity were not exercised in a browser.

No browser screenshot is claimed as V1c acceptance evidence. Mounted pointer/F4 coverage above is
the verification actually performed; a focused browser pass remains outstanding.
