# Appearance UX study (T2.S8 U)

How a creator picks, applies, edits, inspects, repairs and reuses colours and materials on top of the
merged S8 material foundation, in the Light & Sky language. Competing directions, one recommended
end-to-end instrument, a thumbnail lab measured with E7's method, and a responsive board.

**Status:** approved by the owner on 2026-11-22 (D1–D12, recorded in the S8 plan). Still not a production contract: the S8 plan and U's implementation plan are. No
product file imports it. The prototype simulates S8's operations; the lab approximates its renderer.

## Open it

The pages read the shipped textures and E7 references from `apps/editor/static`, so they need the
study server, which serves the repository root on 127.0.0.1:

```bash
python3 prototypes/appearance-ux/serve.py
```

Then open <http://127.0.0.1:8870/prototypes/appearance-ux/>. The `appearance-ux` entry in
`.claude/launch.json` runs the same command.

| Page | What it is |
| --- | --- |
| `index.html` | Decision sheet: recommendation, flow, ownership rules, thumbnail findings, rejected alternatives, the finishing ladder, owner decisions, handoff and slices |
| `app.html` | The recommended instrument end to end |
| `concepts.html` | Competing directions for six questions (instrument, swatch grammar, Library cards, toolbar, colour on a material, Card and Material editor), the finishing-ladder storyboard (layers, masks, brush) and the second round's rejected options |
| `lab.html` | The 21 catalogue entries in six presentations at real sizes; distinctness sweep; *Save evidence* writes `evidence/u-thumbnail-lab.json` |
| `board.html` | Each flow step at 1440×900, 1280×800, 1180×820, 1024×768 and 820×1180 |

### Prototype URL parameters

`app.html` keeps its state in localStorage. A `scene` preset starts from fresh seeds and never reads
or writes it, so board frames and reviewers never clobber each other.

| Parameter | Effect |
| --- | --- |
| `scene=walnut` · `artist` · `transfer` · `repair` | The plan's four tasks |
| `tool=paint` · `erase` · `select` | Arm a tool |
| `tab=colours` · `materials`, `tray=open` | Tray tab, expanded tray |
| `scope=surface` · `space` · `brush`, `brushTool=<tool>` | Paint radius; Brush is a drawn placeholder |
| `focus=<target>&card=subject` · `finish` | Open a Card, e.g. `focus=table:top&card=finish` |
| `selectAll=1` | With `focus`, select every user of the Finish (reach *All*) |
| `lib=all` · `curated` · `project` · `mine` · `sources` | Open the Library on a source |
| `kind=materials` · `objects` · `openings` · `plants`, `intent=pick` · `swap`, `detail=<ref>` | Library kind, why it opened, and the detail pane, e.g. `detail=cat:wood-oak-veneer` |
| `draft=<catalogue id>` | A Library draft of that material (*Customise…*) in the Material editor, on the focused surface |
| `import=clean` · `messy` | Open the Import sheet on a clean vendor set (names settle everything) or the messy one (collision, unstated normal) |
| `edit=<target>`, `compare=1`, `light=studio` · `grazing` · `world` | Open the Material editor |
| `align=<target>` | Align on wall / floor |
| `future=1` | Show the Card's dashed future rows (layers, strokes) |
| `view=<n>` | Stage view |

The head menu's *Reset prototype* clears saved state.

## Real versus simulated

- **Real:** the 21 S8 catalogue entries' recipe facts (transcribed from `main@b5de855c`), their
  shipped texture bytes, E7's committed 192 px references, and E7's distinctness method (it
  reproduces E7's numbers on those references before any other reading is trusted).
- **Simulated:** project state, history, every write (`app/model.js` names the S8 operation each one
  stands for), file import (stand-in texture sets), the private library (localStorage), the Stage
  (a 2D isometric room) and the WebGL2 thumbnail renderer, which approximates the
  metallic–roughness path. Absolute numbers must be re-measured on the E7 inspection host.

## Findings in short

- A Material (raw capture, never edited) is not a Finish (Material + treatment, what a surface
  wears). The Card is the quick Finish; the Material editor beside it is the exact one.
- One instrument: a Paint key with a tabbed tray and a *Brush · Surface · Space* radius; circle =
  colour that keeps relief, rounded square = material that replaces the Finish; the Library as an
  asset library whose *Customise…* opens the Material editor on a draft that writes nothing until Apply;
  the Index unchanged (context only in the prototype). The armed dock key is a quiet forest step for
  every tool family (owner decision D12).
- Gold = selected, cobalt = will change. Reach is visible before the edit. The editor marks the original
  with a faint tick; double-click resets a field.
- Import keeps the standard map names and asks only what the file names leave open.
- Layers, masks and the brush join later along a ladder (Pick → Finish → Exact → Layers → Masks →
  Brush) whose seams are agreed now and drawn in Concepts.
- Thumbnails: a flat, lit sample tile framed on a physical window, one stored 256 px master per
  Finish. It separates satin/brushed stainless and plaster/plastic, which fail on E7's references.
- Smooth and Polished concrete share one scan and differ only by a roughness factor; no
  presentation separates them. That needs an owner decision (variant card recommended).
- G's thumbnail slot (192×192) is too small for a 2× library card; a scoped change to 256 px is
  proposed.

## Checks

No build or test suite: these are static pages. When changing them, serve the folder, open each
page, and confirm no console errors; for the lab, run the sweep and check that the E7 method check
passes before saving evidence. The repository's documentation links are checked by
`npm run test:arch` in `apps/editor`.

## Authority

[S8 plan § First deliverable of U](../../docs/roadmap/t2-look-atmosphere/s8-professional-material-foundation/implementation-plan.md#first-deliverable-of-u-swatch-treatment)
and [E7 report](../../docs/roadmap/t2-look-atmosphere/s8-professional-material-foundation/pr-e7-report.md)
set the questions; the [Light & Sky design](../../docs/roadmap/t2-look-atmosphere/gallery-ux-recovery/ux-design.html)
is the visual foundation. Nothing here overrides them.
