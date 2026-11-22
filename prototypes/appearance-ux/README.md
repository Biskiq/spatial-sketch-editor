# Appearance UX study (T2.S8 U)

How a creator picks, applies, edits, inspects, repairs and reuses colours and materials on top of the
merged S8 material foundation, in the Light & Sky language. Competing directions, one recommended
end-to-end instrument, a thumbnail lab measured with E7's method, and a responsive board.

**Status:** design study for owner review. Not approved, not a production contract, not a plan. No
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
| `index.html` | Decision sheet: recommendation, flow, ownership rules, thumbnail findings, rejected alternatives, owner decisions, handoff and slices |
| `app.html` | The recommended instrument end to end |
| `concepts.html` | Competing directions for six questions (instrument, swatch grammar, Library cards, toolbar, colour on a material, Finish Card layout) |
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
| `focus=<target>&card=subject` · `finish` | Open a Card, e.g. `focus=table:top&card=finish` |
| `lib=curated` · `project` · `mine`, `expand=<ref>` | Open the Library, optionally with an expanded card |
| `inspect=<target>` | Open the inspector |
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

- One instrument: a Paint key with a tabbed tray; circle = colour that keeps relief, rounded
  square = material that replaces the Finish; Library as a sheet; contextual Finish Card with reach
  chosen before the edit; view-only inspector.
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
