# World creation tools

A proposed World tool system: named creation tools in place of the single Ink pen, each showing its
result while you gesture and proposing its consequences where they happen. Interactive Stage plus a
System sheet generated from the same tool registry and the same instrument markup.

**Status:** interaction-design donor for owner review, for T1 and T2 to reuse and evolve. Not
approved, not a production contract, not a plan.

## Open it

Open `index.html` directly (`file://` works, no build), or serve the folder:

```bash
python3 -m http.server 8840 --directory prototypes/world-creation-tools
```

The `world-creation-tools` entry in `.claude/launch.json` runs the same command.

Deep links: `#village`, `#gallery`, `#studio`, `#slope`, `#meadow` load a scenario;
`#<scenario>/<tool>` also arms a tool (`#village/path`, `#gallery/object`, `#studio/form`,
`#slope/building`); `#sheet` opens the System sheet. The dark strip at the top (view, scenario, reset,
Spec drawer) is prototype control, not proposed UI. The dashed readout at the bottom left is an
instrument showing the interaction state chain and a few things to try with the armed tool.

## The proposal in short

- **One instrument at the lower edge.** A forest dock tier and, above it, one ivory tier that holds
  one thing at a time: the armed tool's palette, the selection's actions (Select armed) or the
  Library. The armed key is the tab the tier hangs from; clicking it again folds the tier away.
  One surface, one shadow, no nested frames.
- **Ten creation keys in three captioned families.** Build: Walls, Building, Opening, Stair. Furnish:
  Object, Form, Light. Landscape: Ground, Path, Plants. Select on the left; Paint and Erase on the
  right; the Library (`K`) last. Keys are icons; hovering names the tool, its letter and what it
  makes. Measure and Slice are ways of looking, so they sit in the head next to Plan and 3D.
- **One placement rule.** A dock key has its own gesture and target and is used across scene types.
  A palette option is a variant of the armed gesture (shape, kind, size, finish, brush mode). The
  Library holds catalogue content (objects, lights, plants, building definitions, materials).
  Selection actions operate on something that exists (roof a room, turn, duplicate, replace).
- **What moved, and why.** Art became Object's frames: hanging is Object's gesture against a wall,
  not a tool of its own. Roof is offered when Walls closes a run and from the selection of a room,
  not drawn. Water is Ground's Pond and Stream modes. Building definitions (Cottage, Tower, Pavilion,
  Barn) are Library content that set Building's palette. Form is new: stages, pedestals, drums and
  columns you compose yourself, so standalone objects and exhibitions do not need architecture.
- **Shapes are shared.** `1` Line, `2` Arc, `3` Box, `4` Circle, `5` Freehand, `6` Outline mean the
  same thing in every drawing tool. Curved walls and round rooms are shapes, not separate tools.
- **Consequences are tokens in place.** While you draw, dashed cobalt tokens appear at each
  consequence (a path crossing a wall proposes a gate; a slope proposes steps; water proposes a
  bridge). Release commits one undo step. The tokens turn solid and stay clickable: changing one
  re-plans the same undo step (no second history row). Dark tokens are information only.
- **Refusals are local.** The refused part turns red with its reason and nothing commits.
- **Esc ladder:** live draft (Backspace removes one point), Library, amend tokens, selection, palette,
  then Select. Right-click cancels only the live draft.
- **Paint is universal** with a reach (face, wall, room or building, everything like it). A click that
  would change a shared definition asks first (the Ask Rule).
- **Every commit is a typed intent** (`landscape.path.lay` with `layout.opening.cut` consequences);
  the Spec drawer on the Stage shows the intent of the last step.

The System sheet covers principles, the instrument in its three states, where things live, every
tool (makes, gesture, result, owner, what it proposes), the shared grammar and state table, the
tool-meets-tool matrix, mark and token specimens, what this replaces, where it departs from the
brief, owner decisions and the icon set.

## What to try

| Scenario | Try |
| --- | --- |
| Village by the pond | Select (`V`) inside the walled garden: the tier offers it a roof and a pitch |
| Village by the pond | Path (`P`), Freehand, from the small cottage across the pond and into the walled garden: door, bridge and gate tokens appear as you cross; click one after release |
| Village by the pond | Paint (`C`) a cottage wall with reach "Everything like it": it asks before changing both cottages |
| Village by the pond | Erase (`E`) the garden wall: the tag names what goes and what stays |
| Gallery at dusk | Object (`F`), Frame (`6`), drag along a wall: frames skip the arches; Light (`L`) and drag the sun along the sky arc |
| Studio composition | Form (`D`): draw a Box on the Stage, pull its height, click. Select it, then Duplicate or Save to Library |
| Studio composition | Select a bench, then Replace…: the Library opens to swap it in place, one undo step |
| Hillside to build on | Building (`B`) across the terrace edge: it proposes a plinth; Stair (`T`) from the foot onto the terrace |
| Empty meadow | Walls (`W`) with `4` Circle for a round room; Ground (`G`) to raise, or Pond (`6`) for water |

## Real and simulated

Real (enough to test the interaction): tool switching, palettes, selection actions and the Library
in one tier, tooltips, shared shape drafting with grid and wall snapping, live tokens and amendable
commits, refusal, Esc ladder, undo and redo with one row per gesture, hover and selection, a selection
Card with editable properties and relationships, terrain brushing on a height grid, plant scatter
skipping paths, water and buildings, the intent log.

Simulated: all geometry is a Canvas 2D axonometric sketch with simple placeholder forms. There is no
geometry kernel, no Three.js, no Camera authority, no persistence (reload resets), no kept Library
entries and no Slice. History is whole-world snapshots. Material swatches, building styles and object
catalogues are placeholders. None of these shortcuts is a proposed implementation.

## What it replaces (if accepted)

| Approved today | Proposed |
| --- | --- |
| Ink: one pen for walls, rooms and openings | Named creation tools in three captioned families |
| Flat utility dock: Select, Ink, Slice, Eraser, Brush, Measure | One instrument: dock plus one tier for palette, selection actions or Library; Measure and Slice in the head |
| Brush for materials | Paint with reach and the Ask Rule; the ground takes it as a brush |
| Consequences in an acceptance bar before commit | Live tokens, commit on release, amend in the same undo step |
| Esc: palette, then disarm | Six-rung Esc ladder |

## Where it departs from the brief

- Lighting is not a family: Light holds fixtures and the sun (on a sky arc). Environment stays Scene.
- Water is a Ground mode, not a tool: a terrain edit with a surface.
- Paths and Stairs are separate: a Stair is Layout architecture; a path's Steps are a consequence.
- Openings stay first-class and are also proposed by Path and Walls; the result is one Opening.
- Materials are not a family tool: Paint works on every surface.
- Procedural results are named proposals; nothing silently cuts a wall.

## Owner decisions this needs

1. **Landscape ownership.** Ground, paths, water and plants have no owner in the North Star. Options:
   a Landscape authority, terrain in Layout with plants in Scene, or all in Scene.
2. **Placed buildings.** Building assumes Layout placed structures from reusable definitions.
3. **Cross-owner acceptance.** A path that cuts a doorway commits Landscape and Layout in one step.
4. **Sun and hour.** Authored Scene environment or a viewing preference.
5. **Saved forms.** Save to Library makes a composed form reusable: a Scene definition or a typed
   resource.
6. **Plant scatter rule.** Applied once at painting time, not stored. Confirm no persistent rule.

## For T1 and T2

This prototype is the donor, not a plan. T1 takes the instrument (dock, one tier, armed-key tab,
tooltips), the placement rule, shared shape keys, the Esc ladder, consequence tokens and
amend-in-step over the existing Walls, Opening, Paint and Erase. T2 takes Building with Library
definitions, roofs offered on closing and on selection, Paint reach and the Ask Rule against
definitions, Object frames as an explicit wall attachment, and Form. Landscape follows the ownership
decision.

## Files

`index.html` shell and boot · `styles.css` · `icons.js` icon set · `registry.js` families, tools,
Library, shapes, states and the interaction matrix (single source for the Stage and the sheet) ·
`model.js` simulated world, planners and history · `render.js` axonometric Canvas renderer ·
`tools.js` tool behaviour, gestures, tokens, keys and scenarios · `ui.js` the instrument (dock,
palette, selection actions, Library, tooltips), head, Card, Spec drawer, readout and routing ·
`sheet.js` System sheet.

Checks: `node --check` on each script; open the page and confirm a clean console on the Stage and
the System sheet.
