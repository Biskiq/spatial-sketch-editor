# S5b — Floor and overhead Finishes: closeout evidence

**Status:** implemented and verified on the S5b branch (T2 `look.surface-finish`).
**Brief:** [implementation-brief.md](implementation-brief.md), first commit of this PR.
**Planning authority:** [J surface references and lineage](../s5a-wall-finishes/j-surface-references-plan.md).

## What landed

- Scene strict format **10 → 11**. `region-face` with `top` or `underside` is admitted; `edge`
  is refused as `unknown_surface_face`. There is no migration or compatibility reader.
- Room/Space floors and lids and Region `top`/`underside` faces use the same `LayoutSurfaceRef`,
  `surfaceFinishes` record, material factory, Paint controller, compound Layout acceptance and
  Scene lineage applicator introduced for S5a.
- `spaceOfSurface` now answers for Room planes and Region faces using the same whole-footprint
  containment predicate as `surfacesOfSpace`. Space Paint expands to every member surface without
  a second Wall-side filter.
- A Region duplicate carries `top` and `underside` lineage by shared Finish identity. Region
  removal prunes the retired assignment; Region edits keep the id and the assignment. Dormant lids
  remain assigned and render the default while open to sky.
- The 3D lid has a Stage-only `lid` render identity and `room-lid` hit kind. It is a Paint surface,
  not a Plan source, Slice section source or selectable subject.
- Region rendering retains one mesh and splits the existing groups into top (0), underside (1)
  and edge (2). The one Scene look resolver re-leases the two painted faces without rebuilding
  geometry.

## Review corrections (PR #382)

Four implementation defects raised in review are fixed in the same PR:

- **Region material refresh.** The retained slab now remembers its `role` and whether its top sits on the datum,
  and refresh rebuilds the same `[top, underside, edge]` defaults the first build used. An unpainted overhead top
  stays the dark slab, an unpainted edge stays dark, and a datum-aligned floor top keeps its polygon offset and draw
  order across a Scene change.
- **Treatment consistency.** The solid Region defaults are resolved through `applyTreatment` like a Room's floor and
  ceiling, so Clay and Flat Colour reach an unpainted Region. `setTreatment` re-leases those defaults and the painted
  faces from the one material store.
- **One compile per Paint hover.** `spacePaintReading` holds one compiled Layout reading for both membership and
  Space-scope expansion. `spaceOfSurface` and `surfacesOfSpace` keep their public behaviour and share the internal
  reading. A call-count regression asserts one `compile:walls` write per Region hover.
- **Exclusion disclosure.** `StagePaintSpaceScope.unique` now carries `excluded`, and the Paint consequence names the
  skip (`· 1 Region spans two Spaces, skipped`) instead of silently painting fewer surfaces.

## Automated verification

Run from the S5b worktree after the review corrections:

| Command | Result |
| --- | --- |
| `npm run test:fast -w @portfolio/editor` | **436 files, 5408 tests passed** |
| `npm run test:arch -w @portfolio/editor` | **350/350 passed** |
| `npm run check -w @portfolio/editor` | 0 errors, 16 pre-existing warnings |
| `npm run check:project-model` | passed |
| `npm run check:layout-core` | passed |
| `npm run build` | passed after the review corrections |
| `npm run build -w @biskiq/api` + `vite-node tests/save-units.test.mjs` | **17/17 passed** against real Postgres |

The API save-unit suite initially exposed a hard-coded `SCENE_UNIT_FORMAT_VERSION === 10`; it now
asserts 11 and the canonical-save/reload case passes.

Focused coverage added or extended:

- `scene-look-schema.test.ts`: Scene 11 admission, `edge` refusal, strict Scene 10 refusal.
- `finish-planners.test.ts`: one-entry Space assignment across Walls, floor, lid and Region face;
  separate Region top/underside entries; exact Undo/Redo; open-to-sky lid and edge refusals.
- `surface-lineage.test.ts`: Region duplicate inheritance, Region removal pruning, dormant lid
  retention, id-preserving Region edits, Space ownership for planes and Region faces.
- `layout-paint-answer.test.ts`: Room floor/lid and Region top/underside answers, edge refusal,
  dormant lid refusal, Space membership and straddler exclusion.
- `layout-region-representation.test.ts`: three material groups, Scene resolution, re-lease on
  Scene change without geometry rebuild, role-specific defaults restored for a floor, datum-aligned
  and overhead slab, Treatment re-lease, lease cleanup.
- `layout-paint-answer.test.ts`: the straddling Region is disclosed in `space.excluded`, and one
  Region hover performs exactly one Layout compile.
- Stage pick and host-tool tests, including the regenerated pick baseline for the lid hit kind.

## Browser acceptance

Chromium on the task-owned local stack (`http://localhost:5178`). The loaded source contained one
5.3 m² Room (four Walls), a floor Terrace at 0.2 m elevation and an overhead Canopy at 2.6 m. Region
geometry came from a loaded source so the paint journey was isolated from drawing; the Region tools
were investigated separately (below).

1. **Face Paint — Region tops.** With Paint armed, Face scope and Walnut Wood, a real Stage click on
   the Terrace top and then the Canopy top wrote two `region-face` / `top` assignments. Downloading
   the source confirmed both records in Scene 11.
2. **Space Paint — Room planes and Region underside.** With Space scope and Aged Brass, clicking the
   Room floor wrote exactly **8 surfaces in one accepted change**: four `wall-side` left faces,
   `room-floor`, `room-lid`, the wholly-contained Terrace `top`, and the Canopy `underside`. The
   Canopy `top` stayed Walnut because an overhead top is not part of the Room's Space. The
   downloaded source contained nine assignments total, including both Region faces.
3. **Compound history.** One Undo removed the whole 8-surface assignment and restored the previous
   Warm Plaster Walls/floor/lid and Walnut Terrace top, with no Canopy underside. Redo restored the
   nine-assignment source exactly.
4. **Save and reopen.** Save to Cloud required an authenticated local session; after creating a
   local QA account, Save completed, the `create=1` mint marker cleared, and a full reload reopened
   the saved source. The reloaded Scene remained format 11 with all nine assignments, and Stage 3D
   showed the brass Room interior and Walnut Canopy top.
5. **Visitor Preview.** Preview then required an Experience, so one Capture/Presentation/View was
   created and opened. `VisitorPreviewSurface` rendered the same brass interior and Walnut Canopy
   top as Stage, with the visitor chrome and no editor-only surfaces.

**Region-tool availability (V1c limitation).** Region authoring is present under
**Form → Roof / Terrace**, not behind a separate Region tool. The V1c note describes a
discoverability gap in the Form family, not a missing implementation; Roof exposes Flat and
Terrace exposes Box/Line, and Region drawing is reachable from that family strip.

## Review follow-up browser pass (partial)

A second pass attempted the two gaps named in review: draw a Region in the same journey, then
paint its underside with a direct Face click from below.

- **Region drawing — exercised.** In the real app, **Form → Roof → Flat Roof → Box** drew
  **Region 1**: 2.16 × 1.08 m, 2.32 m² at 1.2 m elevation with 0.1 m thickness. The Region and its
  card (elevation, thickness, width, depth, area) survived a full page reload, and the Form strip
  returned to `Flat Roof · 0.00 m` ready for the next draw. The downloaded project source confirms
  it is a canonical Layout Region — `role: "overhead"`, polygon footprint, `elevation: 1.2`,
  `thickness: 0.1`, `form: { kind: "flat" }` — not only a card in the UI.
- **Direct underside click — blocked by the browser harness.** Every tab in this environment runs
  `document.hidden === true` and never fires `requestAnimationFrame`, so the camera's
  `set-reading` transition never settles: the toolbar's 3D control, its `3` shortcut and the DOM
  click all leave the Stage in Plan. The drawn project could be reloaded, but not viewed in 3D.
  Painting the underside therefore could not be exercised here; its pick identity, Scene resolver,
  default material and re-lease are covered by the renderer and paint-answer tests. This remains
  open for a focused pass in a visible browser session.

## Limits of this evidence

- The underside was painted through Space scope, which is the approved expansion, rather than by a
  direct Face click from below the Canopy. The source assignment, Undo/Redo and the retained Region
  material tests cover the same identity and rendering path.
- The browser pass used a loaded source for Region geometry. It did not redraw a Region from the
  Form strip in this session; the V1c availability check is reported separately above.
- No screenshots are committed. The visible checks above are described from the live Stage and
  Preview sessions; the source JSON downloads are the acceptance record for the assignments.
