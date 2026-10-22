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
| `npm test` | Model tests: stroke fitting, rooms from walls, divide and undivide, supports, ties, carrying levels, snapping, touching vs. joining, roof profile editing, roofs on L/T/U/plus footprints and roof joins (with a mesh-vs-evaluator probe) |
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
| **Sketch · Box · Round** (by the pen) | Box drags corner to corner on 0.05 m steps (⇧ squares it, ⌥ keeps the hand's size); Round grows from the press. A tipped stroke is still read aloud, so Tab still offers Platform, sunken court or canopy. A box with one whole edge in an existing straight wall reads as *Room beside* and builds only the other three walls. |
| Click | Pick something. In Select, blue handles shape it: a few main ones show, and finer ones (corners, bends, section joints) appear as the pointer comes near. The card on the left explains it in plain words. |
| Drag (Select) | A handle or object moves it; a selected roof's highlighted ridge, slope, end or eave edits that roof. A drag elsewhere turns the table. Right/middle-drag and Space-drag always turn it; ⌥ makes an eligible roof edit free, and ⌥ elsewhere turns the table. |
| Snapping | Ends, wall faces, square/45°/parallel to nearby walls, and in line with corners, shown as blue guides. ⌥ while dragging turns it off. A wall end that lands on another wall only *touches* it; the ripple offers **Join** (it then follows that wall) in the same step. |
| Drag on a wall's face | Draw a door, arch, window or round window. |
| Drag from one floor to another | Draw a stair or ramp along your walk. |
| Pull **the sheet** (right rail) up | Draw in the air: roofs, canopies, mezzanines, bridges, lightwells. Raising it while selecting picks up Draw (the sheet is paper); Esc or *Put away* puts it down again. The sheet also x-rays everything above it. *Focus this height* also ghosts what is below. |
| Room → **+ Add a floor above** | Another storey: a floor at the room's top, walls along its outline and a room as tall. Hover to preview, click to make it (one step); the new walls come selected to reshape. A roof in the way stays put unless you choose *Lift it onto the new storey*; with no roof, the step offers *Leave it open*, *Flat roof* or *Pitched roof* (*Cone roof* for a round room). Nothing is tied. |
| Room → **+ Add a mezzanine** · deck → **+ Add a stair** | A covered room with enough clear height offers a deck whose posts and stair are checked together: the stair lands on the floor, fits between the posts, and disappears when a wall crosses its approach. Hover to preview, click to make (one step). The new deck then offers **+ Add a stair**. |
| Roof (Select) | Hover to reveal a highlighted zone. Drag the **ridge** or **flat top** up or down for height; pull a **slope** for fuller or pointier sides; pull a **ridge end/end face** to hip both ends; pull an **eave** for more overhang or an independent outline. Detents stop at 30°, 45°, 60°, an even hip and common overhangs; ⌥ gives a free edit. A compound change that would leave a wing in a step keeps the last valid roof and says why. **R** turns the ridge. *Cover the whole outline as one span* in Settings is the deliberate opt-out, and it refuses when a one-span roof would strand an inner eave. |
| Roof card → **Join with {roof}** | Shown when another roof meets this one. Two gables at the same eave, pitch, hip and fit become one roof with a valley where they meet: hover to preview, click to join (one step; Undo restores both). Anything else is disabled with the reason. |
| Roof → **Edit shape** (Enter, or double-click) | The building stays; only that roof is editable, and its section opens in the sheet. Drag a joint to move it, drag a part to bend it, double-click the line to sharpen or add, ⌥-click or Delete to remove, drag a step's bar or slide its grip. The context behind the section — floors, walls, neighbours, people, headroom — is drawn too. Draw on empty paper to replace the section; Tab cycles its readings (*tidy*, *as drawn*). **X** or *See through* draws the roof thin; *Face the section* looks along it; drag a Hold zone on the roof as usual. Enter, Esc or Done leaves. |
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
- Hold edits for roof height, slope fullness, linked end hips, fitted overhang and ridge direction, with detents, affected-region highlights and one-step recovery.
- Roof sections read as joints and parts (eave, ridge, valley, crease, step) with clean rules, so the preview and the commit are the same section. Edit Shape works over the building, with its floors, headroom and neighbours drawn behind the sheet.
- **Ink from meaning**: a roof is drawn with its ridges, hips, valleys, creases, steps and edges rather than its triangles. A curved vault carries no interior lines, a hipped gable shows its ridge and hips, and a dome shows rings.
- **Box and Round** pen tips, including *Room beside* an existing wall; a tipped stroke is still read aloud, so Tab still offers Platform, sunken court or canopy.
- **Mezzanine and stair offers**, qualified together: clear height below and above, posts that keep out of the stair, a landing on the floor, and no offer through a ceiling that is too low.
- **Covering several rooms at once**, with wings on L, T, U and plus plans, and *Cover the whole outline as one span* as a deliberate, qualified opt-out.
- Roofs on L, T, U and plus plans: covering one room or several, or drawing the roof with the pen, gives a wing roof whose eaves stay level and valleys meet (flat, gable, hipped gable, vault). A section the wings can't carry is refused with the reason instead of being placed as one span that stops in mid-air.
- Roof profiles edited in the detailed ProfilePad, with nearby 3D point handles for precision. The same section drives every wing of a compound roof.
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
