# Biskiq · Vellum

A standalone browser prototype of Biskiq's spatial authoring: a drafting table on which you **draw** a building and
**revise** it, and every revision is honest about what it touches. Then you turn what you made into a walk for visitors.

Why it looks and works this way is in [DESIGN.md](DESIGN.md).

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:5191>. The app needs no backend and no network; fonts are bundled.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 5191, with a dev-only fps and input readout and a `window.__t` test kit (`__t.trace` records and replays real wheel/pinch input) |
| `npm run build` | Type-check, then a static build in `dist/` (open with any static server, e.g. `npx vite preview`) |
| `npm test` | Model tests: stroke fitting, rooms from walls, divide and undivide, supports, ties, carrying levels, snapping, touching vs. joining, roof profile editing |
| `npm run typecheck` | TypeScript only |

It is built for a laptop or desktop browser with a trackpad or mouse. Drawing works with a pen or finger, but touch
camera gestures are not implemented.

## Using it

Start from a blank table or one of the four prepared projects. **Help (?)** lists "Things to try", one for each
scenario in the brief.

| Gesture | Effect |
| --- | --- |
| **V** Select · **D** Draw | Two tools. Select picks, shapes and moves, and never draws. Draw only draws. Samples open in Select, a blank table in Draw. |
| Drag on the table (Draw) | Draw. The chip by the pen says what it read; press **Tab** (or tap the chip) to choose another reading. This stays one undo step. Hold **⇧** for a straight, snapped line. |
| Click | Pick something. In Select, blue handles shape it: a few main ones show, and finer ones (corners, bends, profile points) appear as the pointer comes near, or all of them with *Show every point*. The card on the left explains it in plain words. |
| Drag (Select) | A handle, an object, or the picked roof's surface (bends its profile). Anywhere else turns the table. |
| Snapping | Ends, wall faces, square/45°/parallel to nearby walls, and in line with corners, shown as blue guides. ⌥ while dragging turns it off. A wall end that lands on another wall only *touches* it; the ripple offers **Join** (it then follows that wall) in the same step. |
| Drag on a wall's face | Draw a door, arch, window or round window. |
| Drag from one floor to another | Draw a stair or ramp along your walk. |
| Pull **the sheet** (right rail) up | Draw in the air: roofs, canopies, mezzanines, bridges, lightwells. The sheet also x-rays everything above it. *Focus this height* also ghosts what is below. |
| Roof profile pad | Drag a point to move it, drag the line to bend it, double-click the line to add a point, ⌥-click a point to remove it, draw on empty paper to start over. The same points sit on the roof's blue section in 3D. |
| Right-drag / ⌥-drag / two-finger scroll | Turn the table. Pinch or wheel zooms about the point under the pointer; ⇧ pans. Safari's pinch and rotate gestures work too. |
| **L** (hold) · ⇧L | Lift roofs and upper floors apart. |
| Slice tool | Drag a straight, snapped line to cut a section; it previews live, Esc cancels, **Flip** keeps the other side. |
| **Esc** | Go back to exactly the view you had. Peeks never change the building. |
| ⌘Z · ⇧⌘Z | Undo and redo. Every edit, its consequences and its repairs form one step. |
| **Make · Tell · Visit** | Build, then draw the visitor's walk and its moments, then play it with no creator tools on screen. |

To bring in another tool's model, drop a `.glb` or `.gltf` file anywhere, or open "An old boathouse, imported". Show
it as a *tracing underlay* and draw over it to make parts native.

## What's real, prepared, simulated or unsupported

The same list is in the app under **What's real?**

**Real (running in your browser)**
- Stroke reading and fitting: lines, arcs, one-piece circles, rectangles and angle snapping, with alternative readings.
- Separate Select and Draw tools; ruled straight lines (⇧); snapping with guides; touching vs. explicitly joined walls.
- Roof profiles edited point by point, by bending the line, or redrawn, in the pad or on the roof in 3D (one profile).
- Rooms that emerge from walls (a planar arrangement) and keep their identity through divide and merge.
- Per-room floors and ceilings, plinths and sunken courts, and walls that rise to their rooms or roofs.
- Openings, arches and round or pointed openings on straight and curved walls, which ride along when walls change.
- Overheads from a drawn section profile (raked, clerestory with glazing, vault, fold, dome and more) and skylights.
- Decks, bridges, voids (atria and lightwells), stairs and ramps, with their ties.
- Ripples with choices, loose ends with repairs, the set-aside tray, whole-building scale with intents, and the view
  history.
- Tell and Visit, `.glb` import, localStorage autosave and JSON export.
- Focus height (an experiment): ghost everything outside one height band, reversible with Esc.

**Prepared**
- The four sample projects, built in code with the same operations you use. They are fully editable.
- The "imported" boathouse, a mesh generated in code to stand in for a file.

**Simulated**
- The light-shaft glow under lightwells is a visual effect.
- Support is a rule of thumb: edges must run near a wall or a post.
- Headroom, stair steepness and opening fit use simple thresholds, not building codes.

**Unsupported**
- Reshaping imported meshes. Imports also have no section fill when cut.
- Terrain, materials beyond the four model palettes, real publishing or sharing, and multiplayer.
- Code-compliant stairs, structure, and construction documents.
- Imported files are kept in memory for the visit only; drop the file again after a reload.

## Layout

```
src/model/    pure, tested: geometry, stroke reading, rooms (arrangement), settle (ties and identity),
              derive (wall heights, loose ends), ops (every edit as a transaction with notes and decisions)
src/scene/    three.js: stage, meshers for walls, roofs and parts, handles, overlays, the pen (interact.ts)
src/story/    the visitor's walk, moments and the player
src/import/   GLB loading, underlay, the prepared boathouse
src/samples/  the four prepared projects
src/ui/       Preact: top bar, sheet rail, inspector, ripple card, panels, start screen, visitor overlay
tests/        vitest
```

The prototype only touches this folder. It does not use or change any production architecture or contracts.
