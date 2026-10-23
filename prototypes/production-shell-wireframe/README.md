# Production shell wireframe

**Status: unratified exploration for owner review.** Not authority. Prototype shortcuts never become contracts, and nothing here amends [PLATE](../../docs/reference/design-system/editor-shell-and-visual-system.md).

## Purpose

A low-fidelity, interactive round-1 wireframe of Biskiq's integrated production shell. The World and Experience lenses share one Head, Index, Stage, Card and lower working edge. The wireframe reconciles the Conservatory shell and Experience authoring, the Paper and Edit Shape work, the P2 Smart Wall surface-aware arrangement and the P3 Vellum pen, sheet and dock into one candidate composition for review. Recommendations, alternatives, unresolved questions and proposed PLATE departures (D1–D8) are in [DESIGN-NOTE.md](./DESIGN-NOTE.md). This README covers how to run and use the wireframe.

## Run

```bash
cd prototypes/production-shell-wireframe && python3 serve.py 8850
```

Then open http://127.0.0.1:8850/

`serve.py` sends `Cache-Control: no-store`, so module edits show on reload. There is no build step and no dependencies. The app is vanilla ES modules served as static files.

## Wireframe bar

The black bar at the top of the page is wireframe-only. It is not product UI, and none of its controls is a proposed product control.

- **Journeys ▾** starts one of eight representative workflows from a fixed setup, with a coach panel of steps: `draw` Draw architecture, `open` Cut openings, `roof` Vertical & roof editing, `erase` Bulk erase, `obj` Manipulate objects, `import` Import & place, `exp` Experience capture & Preview, `narrow` Narrow layouts.
- **Compare ▾** switches the four A/B alternatives compared in DESIGN-NOTE §3: tool home (bottom dock or pointer rail), heights rail (left or right), Edit Shape (section pad or split Stage) and tool identity colour (on or off). It changes presentation only; state is kept.
- **Width ▾** sets a simulated frame: Fill window, Laptop 1280 × 800, Narrow desktop 940, Tablet 720 or Phone 390.
- **About ▾** shows a short scope note and the key list.

## Keyboard

Keys are handled in `onKey` in `app.js`. While a text field has focus, keys are ignored: Esc blurs the field, and Enter applies a dimension field.

| Key | Action |
| --- | --- |
| `V` `P` `K` `E` `M` | World: arm Select, Ink, Slice, Eraser or Measure |
| `V` `C` `T` `M` | Experience: arm Select, View, Path or Measure |
| `A` | World: open or close the Library |
| `1`–`5` | Reading: 3D, Plan, Elevation, Eye level, Section (Section needs a Slice first) |
| `L` | World: toggle Lift |
| `F` | World: toggle Focus height |
| `D` | Open Dimensions for the selection |
| `R` | Turn the selected object 15° (objects only) |
| `Delete` / `Backspace` | Erase review for the selection |
| `Tab` | Re-read the Ink surface while the chip shows a reading (same undo step) |
| `Enter` | Finish a line Ink stroke; close Edit shape |
| `Space` | In Experience with the Guide open, play or pause; otherwise hold to pan the Stage |
| `←` `→` | Step the Preview stops |
| `⌘/Ctrl+K` | Find |
| `⌘/Ctrl+Z`, `⇧⌘/Ctrl+Z` | Undo, Redo |
| `Esc` | Unwind one level: context menu, sheet, Ink, reading, Look, tool, selection, Guide, measure |

## Files

| File | Role |
| --- | --- |
| [index.html](./index.html) | Page shell: wireframe bar, Head, Index, Stage and Card containers, coach panel and script entry |
| [app.js](./app.js) | Shell state, rendering, interactions, journeys (`JOURNEYS`), wireframe bar menus and keyboard handling |
| [scene.js](./scene.js) | Mock model and SVG readings (axonometric, plan, elevation, section, perspective) and unroll |
| [icons.js](./icons.js) | Inline stroke icons |
| [styles.css](./styles.css) | PLATE tokens on `:root` and wireframe chrome |
| [serve.py](./serve.py) | Local static server with no-cache headers |
| [DESIGN-NOTE.md](./DESIGN-NOTE.md) | Substance: composition, recommendations, alternatives, unresolved questions, proposed PLATE departures and prototype shortcuts |

## Prototype shortcuts

These are implementation shortcuts taken to make the wireframe runnable. They are recorded in DESIGN-NOTE §6 and are not proposals:

- Snapshot Undo: history stores whole model snapshots, not operations.
- Painter's-algorithm SVG: draw order stands in for depth, with no depth buffer.
- Bounding or centroid lasso: selection is approximated from bounds or centroids.
- Heuristic stroke reading: Ink infers its surface reading with simple rules.
- Flat canopies drawn as polygons; roof Edit Shape limited to gable and raked forms.
- Linear mock Camera interpolation between hand-placed doorway points.
- Thumbnails re-rendered from mock poses.
- No persistence: state resets on reload.

None of these implies a file format, evaluator, Camera algorithm or production architecture. Production behavior is governed by the ratified contracts in `docs/`.

## Related

- [Conservatory (Experience UX)](../experience-ux-alternative/README.md)
- [P2 Smart Wall](../p2-smart-wall/README.md)
- [P3 Vellum](../p3-vellum/README.md)
- [Prototypes hub](../README.md)
