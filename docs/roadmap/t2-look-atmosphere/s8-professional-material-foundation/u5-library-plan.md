# T2.S8 U5 — Professional Library (plan)

**Status:** plan-first commit of U5's draft PR. Tier 1 (Library UX over accepted operations; no
persisted-format, shell-token or authoring-contract change). Deleted at merge once its enduring
rules are promoted (see *Promotion*).

**Authority:** the approved appearance study (#399, D1, D8, D9), its [decision
sheet](../../../../prototypes/appearance-ux/index.html), the S8 [implementation
plan](./implementation-plan.md#owner-rulings-on-the-u-design-2026-11-22), the completed U1–U4/U8
work, and the existing Library/Finish infrastructure.

**Goal.** Deliver the professional Library experience: discover, inspect, select and customise
materials and project Finishes without writing anything until an explicit action.

## What exists on `main@88aab2898`

- The World dock's Library key opens a compact category row inside `WorldToolbar`: horizontal
  material tiles plus project Finishes, and simple shelves for Objects, Artwork and Lights.
- `finish-authoring.libraryShelf()` provides curated and project Finish rows; U1's `FinishTile`
  draws 256 px masters or on-demand project pictures; U4's `FinishCard` owns quick Finish edits.
- U3 supplies the colour-coat port; U2 the Paint tray; G the private material Library client
  (no UI yet); D9's draft behaviour has no production seam.

## Design

### Surface and placement

A new route-level `StageLibrary.svelte` sheet, opened by the dock's Library key, `L`, and Paint's
*Browse all*. It floats over the Stage, above the lower column, and leaves the dock usable. The
World toolbar no longer draws the old compact material shelf while this sheet is open; the armed
Library key and its `L` shortcut still close it. The sheet uses the approved study's anatomy:

```
header:  Library · search · sources (All · Curated · This project) · close
body:    kind rail | browse grid | detail pane (when open)
```

The kind rail lists only kinds with real content: **Materials** (with the catalogue families
nested), **Objects** (approved catalogue assets), **Artwork** (the project shelf) and **Lights**
(the Look shelf). Openings, Plants, My library and Sources are future features and get no visible
placeholder, per the owner's implementation rule.

Responsive: three columns on a wide sheet, rail + grid with a side detail at 1024 px, and a bottom
sheet with a horizontal rail and an overlaying detail at ≤ 760 px. At 1024 px the 21 catalogue
entries fold to 20 D1 cards and remain scannable in a multi-column grid.

### Browse model (pure)

`library-catalogue.ts` owns the browse data and its pure operations:

- curated entries, folded by `materialVariantCards` (D1: **Concrete** with *Matte / Polished*);
- project entries from accepted Scene material instances;
- sources `all | curated | project`, family category, search over name, material label, family and
  origin, and filters `Favourites · Textured · Plain colour · Metal · Matte · Glossy · Used here`;
- one entry anatomy: name, one sub-line (`Veneer · 0.5 m` or `from Oak Veneer · 3 changes`), colour,
  family, usage count, variant chips and a tile source.

The pure module never reads a texture URI. Cards and the detail pane render only `FinishTile`, so
opening the Library reads 256 px masters (or a project's already-retained preview), never a
full-resolution catalogue texture.

### Inspection, usage and selection

The detail pane shows the tile, source, base material, real size, sheen (U4's step reading), map
roles, `Used by n`, origin and any warning. **Select all n** selects every present user through
the Stage's one selection API and opens the Finish Card on the first: it is a selection, not a
write. Dormant surfaces count in usage and are listed; retired references are not selectable.

### Actions

| Action | Effect | Write |
| --- | --- | --- |
| Card click / Enter | Opens the detail pane; never assigns | none |
| Use for Paint | Arms the Finish/colour for Paint and closes (or stays with Shift) | none |
| Apply to selection | Assigns the chosen Finish to the selected object or Layout surface through `scene-finish-assign` / `scene-surface-finish-assign` | one Undo |
| Select all n | Selects every user | none |
| Customise… | Opens a draft on the selected target | none |

`Use for Paint` uses `pickMaterialKey` + the route's Paint arm, not `pickFinish`, so a browse pick
can never accidentally assign.

### D9 drafts (U5 seam, not U6's editor)

`library-draft.ts` holds a draft from one entry: its Finish reference, base label, source, current
sheen reading and the chosen sheen step. Draft state is local; changing a step, opening the draft
or closing it calls no authoring host. The detail pane shows a visibly marked *Draft* tile (the
entry's own `FinishTile` plus a local sheen wash) and a line saying nothing is written.

**Apply** is enabled only when the current selection already wears the draft's Finish. It builds
`sheenStepEdits` and issues exactly one `scene-finish-patch` through the same accepted authoring
path as the Finish Card:

- one user: `in-place` for a project Finish, `all` for a curated Finish (materializes it);
- several users: `just-this` for the selected user, so the other users keep their Finish;
- `expectedUsers` is the entry's inspected user set, so a changed reach refuses rather than
  widening the write;
- one allocation only when the plan creates a Finish.

A target that does not wear the Finish is a clear refusal in place: *Select a surface wearing
Oak Veneer first.* There is no Save to My library in U5 (U7 owns transfer). The sheet's
*Customise…* is therefore the seam U6 extends with the full Material editor.

### Integration

- **Paint:** discloses the active Library pick and closes back to the tray; `L` reopens the last
  view.
- **Finish Card:** selecting a project Finish's users opens the Card on the first user; the Card
  remains the quick editor.
- **Thumbnails:** `FinishTile` only; catalogue masters on open, project pictures through the
  existing scoped service, draft tint local to the sheet.

### Accessibility and states

- Dialog semantics (`role="dialog"`, `aria-modal="true"`, labelled title), focus moved to search
  on open and restored to the opener on close.
- Every card, chip, rail row and action is a real button; Enter/Space activate; focus rings use the
  shell token. Esc closes the detail first, then the sheet. Arrow keys are left to the browser so
  the grid remains one predictable tab order.
- Empty states: no matches (clear search/filter), empty project shelf (paint something first),
  empty My library is absent rather than a dead shelf. Refusals are one line in place.
- Coarse pointer: 44 px minimum targets.

## Scope

**In:** the sheet, kind rail, sources, family categories, search, filters, D1 cards, detail pane,
usage selection, browse actions, the sheen draft seam, route/World-toolbar wiring, tests, docs.

**Out (boundaries):** U6's Material editor, Align, import and repair; U7's save/insert/transfer;
Index changes; new shell colour tokens; persisted formats; procedural/layered materials; brush;
new catalogue entries; placeholder shelves.

## Checks

- Pure `library-catalogue` tests: source grouping, family/category, search, every filter, D1 fold,
  selected-variant projection, usage counts, no mutation, 21 entries → 20 cards.
- Pure `library-target` tests: selection reference → entity/surface target, refusal for unpaintable
  or edge subjects, user selection entries.
- `library-draft` tests: opening/editing/closing a draft issues zero authoring calls; Apply issues
  exactly one `scene-finish-patch` with the right mode, users and allocation; wrong target refuses;
  one-user in-place; shared just-this; stale reach passes through.
- Focused editor suites for the World toolbar / Paint tray / Finish Card wiring.
- `npm run check`, `npm run test:arch`, focused `test:fast`, `npm run build`.
- Focused browser QA at 1440×900 and 1024×768: open/close by key and button, search/filter,
  variants, detail, usage selection, draft no-write and Apply Undo/Redo; network shows no
  catalogue full-resolution texture request when the Library opens; console clean.

## Risks

- The sheet is bigger than the old shelf; the route's lower-column measurement and narrow
  breakpoints are reused rather than a second layout system.
- Draft preview is intentionally a local sheen wash, not an E7 render: U6 replaces it when the
  Material editor lands. Its no-write and one-Undo contract is what U5 fixes.
- Project Finishes with a resource-backed base show as *Imported material* in the base line; the
  source name remains the Finish name. U6's provenance work owns richer labels.

## Promotion

At merge, the Library anatomy, browse/filter rules, usage-selection semantics, draft no-write
rule and the Paint/Card integration are promoted into the Scene content and shell reference
contracts; this plan is deleted. The draft seam is recorded as U6's starting point.
