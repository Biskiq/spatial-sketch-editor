# Production shell wireframe

**Status: round 1.1 (continuing round 1), unratified exploration for owner review.** Not authority. Prototype shortcuts never become contracts, and nothing here amends [PLATE](../../docs/reference/design-system/editor-shell-and-visual-system.md).

## Purpose

A low-fidelity, interactive wireframe of Biskiq's integrated production shell. The World and Experience lenses share one Head, Index, Stage, Card and lower working edge. Round 1 is commit `8ce39bc5`. Round 1.1 is a simplification pass on it: the shell is simpler, and open decisions stay as live A/B alternatives under **Compare ▾** instead of being settled in the mock.

The editor targets small laptops and iPad. Phones are out of scope for the editor, but Preview has a Phone frame because visitors may use phones.

[DESIGN-NOTE.md](./DESIGN-NOTE.md) holds the substance: what changed from round 1 (§2), the recommended defaults (§3), the open decisions with verdicts (§4), proposed PLATE departures D1–D13 (§5) and the remaining usability problems (§6). This README covers how to run and use the wireframe and does not repeat those tables.

## Run

```bash
cd prototypes/production-shell-wireframe && python3 serve.py 8850
```

Then open http://127.0.0.1:8850/

`serve.py` binds 127.0.0.1, takes an optional port argument (default 8850) and sends `Cache-Control: no-store`, so module edits show on reload. There is no build step and no dependencies. The app is vanilla ES modules served as static files.

## Wireframe bar

The black bar at the top of the page is wireframe-only. It is not product UI, and none of its controls is a proposed product control. Clicking a menu's button again closes it, and so does a click elsewhere on the page.

- **Tours ▾** runs one of eight guided tours defined in [tour.js](./tour.js) (`TOURS`):
  - `sketch` Sketch, then pin a height
  - `navigate` Find your way in a big building (uses the Harbour museum)
  - `objects` Arrange objects directly
  - `roof` Shape a roof
  - `slice` Slice and look inside
  - `erase` Erase without fear
  - `paint` Paint and finish
  - `exp` Author an Experience

  A tour runs one step at a time. The step's control is spotlighted with a blue ring, which turns green once the step is done. Prev and Next move between steps. Next is highlighted once the step is actually done, though it can be pressed earlier. Some steps offer **Show me**, which performs the step, and it is hidden once the step is done. ✕ ends the tour. Starting a tour loads the project it needs (the Boathouse gallery, or the Harbour museum for `navigate`) and resets the Compare choices for Index model, Collapsed Index, Eraser kinds, When erasing asks, Edit shape and Object handles to their recommended values. Tool colour is not changed.

- **Compare ▾** sets one presentation alternative at a time, and each option re-renders the Stage. The recommended option carries "(recommended)" in the menu, and it is also the default. The letters match DESIGN-NOTE §4.
  - **Index model:** A · Scope + facets, drill in (recommended) · B · Outline tree, lazy and capped
  - **Collapsed Index:** A · Location crumb in the Head (recommended) · B · Nothing visible; left-edge peek and `\`
  - **Eraser kinds:** A · Contextual: kind chips after marking, ⇧ locks to a kind (recommended) · B · Filter disclosure in the palette
  - **When erasing asks:** A · Only for cross-domain consequences; ≤3 simple things go at once (recommended) · B · Also when hosts, rooms or roofs are affected; bulk always previews
  - **Edit shape (roof section):** C · On the roof itself + Card precision (recommended) · A · Card editing posture · B · Floating section editor, expands
  - **Object handles:** A · Progressive: move, turn, scale; click scale for W · D · H (recommended) · B · Immediate: every dimension handle at once
  - **Tool colour:** On (default) · Off. The menu marks neither as recommended.

- **Project ▾** loads a scenario through `loadScenario` in [app.js](./app.js), which clears Undo history and the selection:
  - **Boathouse gallery:** 2 rooms, ordinary. This is the start state.
  - **Harbour museum:** from [dense.js](./dense.js). The model has 3 structures, 5 Levels, 40 rooms, 104 walls (52 shared), 96 openings, 275 objects, 105 artworks and a 24 m sawtooth roof, as stated in DESIGN-NOTE §4.

- **Width ▾** sets a simulated frame from the `SIZES` table in [app.js](./app.js):
  - Fill window (no frame)
  - Laptop 1440 (1440 × 900)
  - Small laptop (1280 × 800)
  - iPad landscape (1180 × 820)
  - iPad portrait (820 × 1180)

  The menu also notes that phones are out of scope for the editor and that Preview has its own Phone frame.

- **About ▾** shows a short scope note: a round 1.1 low-fidelity wireframe with mock state, SVG scenes and snapshot Undo, not a contract, not production and not PLATE. It has no key list; the keys are in this README.

## Keyboard

Keys are handled in `onKey` in [app.js](./app.js). Rows marked World or Experience apply only in that lens. Unmarked rows apply in both.

| Key | Action |
| --- | --- |
| `V` `P` `K` `E` `B` `M` | World: arm Select, Ink, Slice, Eraser, Brush or Measure |
| `V` `C` `T` | Experience: arm Select, View or Path |
| `A` | World: open or close the Library |
| `1` `2` `4` `5` | Reading: 3D, 2D, Eye level, Section. Section needs a Slice first, or a toast says "Slice first (K)." Elevations are under the ▾ beside 2D · 3D; `3` is not bound |
| `[` `]` | Turn the 3D view 15° left or right |
| `\` | Show or hide the Index |
| `L` `F` | World: toggle Lift (roofs apart) and Focus this height |
| `S` | With an object selected, open or close its W · D · H handles |
| `R` | With an object selected, turn it 15° |
| `Delete` / `Backspace` | Erase the selection now, with an Undo toast. A bubble asks only where consequences cross domains |
| `Tab` | While the Ink reading chip shows, take its next reading (same undo step) |
| `Enter` | Finish a line Ink stroke; apply a pending erase; close Edit shape; or, with a roof selected, open its Edit shape |
| `Space` | Experience with the Guide open: play or pause. Otherwise hold and drag to pan the Stage. Shift-drag on empty Stage with Select also pans |
| `←` `→` | While Preview is open, step its stops |
| `⌘/Ctrl+K` | Find, from anywhere, including while a field has focus |
| `⌘/Ctrl+Z`, `⇧⌘/Ctrl+Z` | Undo, Redo |
| `Esc` | Unwinds one level, in this order: menus and popovers, Preview, a pending erase (bubble or marks), an in-progress drag, Ink stroke, reading chip, Edit shape, Look through, the Instrument (Library, Guide or repair), Look or Lift (Put back), Slice, Focus, an armed tool (back to Select), selection, Guide, measure |

While a text field has focus, keys are ignored, with three exceptions. Esc blurs the field and clears any refusal message. Enter applies a dimension field, a joint field or the Sheet height field. In the Find box (`#findin`), ↑ and ↓ move through the suggestions, Enter runs the highlighted one, and Esc closes Find.

## Files

Every file in this folder, with its role from the module header.

| File | Role |
| --- | --- |
| [index.html](./index.html) | Page shell: wireframe bar, Head, Index, Stage and Card containers, tour layer and the module entry |
| [app.js](./app.js) | Render orchestration, pointer gestures, actions, keys, scenario loading and the wireframe bar menus (`wfMenu`) |
| [core.js](./core.js) | Shared state: model `M`, UI state `S`, render scratch `R`, history `H` and helpers |
| [stage.js](./stage.js) | Stage drawing and overlays, the 2D · 3D furniture and the height Sheet |
| [chrome.js](./chrome.js) | Head with live Find, Index (scope and outline models, collapse) and the Card |
| [tools.js](./tools.js) | Dock and palette columns; Ink readings, Eraser, Brush, Edit shape and Library |
| [exp.js](./exp.js) | Experience lens: Presentations Index, Card, Guide, Stage markers and the Preview takeover |
| [tour.js](./tour.js) | Guided tours (`TOURS`): spotlight, steps, demos and completion checks |
| [scene.js](./scene.js) | Mock spatial model, camera helpers and SVG readings (solid, plan, unroll) |
| [dense.js](./dense.js) | Seeded dense Harbour museum mock for stress tests (`denseModel`); mock data, not a format |
| [icons.js](./icons.js) | Inline 24 × 24 stroke icons |
| [styles.css](./styles.css) | PLATE-role tokens on `:root`, wireframe chrome and tour styles |
| [serve.py](./serve.py) | Local static server on 127.0.0.1 with `Cache-Control: no-store` |
| [DESIGN-NOTE.md](./DESIGN-NOTE.md) | Substance: changes from round 1, recommendations, open decisions with verdicts, proposed PLATE departures, usability problems |
| [README.md](./README.md) | This file |

## Prototype shortcuts

Snapshot Undo, painter's-algorithm SVG, approximated lasso, heuristic stroke reading, mock Camera interpolation, mock dense data and no persistence are implementation shortcuts. They are listed in DESIGN-NOTE §7, are not proposals, and imply no file format, evaluator, Camera algorithm or production architecture. Production behavior is governed by the ratified contracts in `docs/`.

## Related

- [Conservatory (Experience UX)](../experience-ux-alternative/README.md)
- [P2 Smart Wall](../p2-smart-wall/README.md)
- [P3 Vellum](../p3-vellum/README.md)
- [Prototypes hub](../README.md)
