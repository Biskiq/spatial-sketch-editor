# World creation tools

A proposed World tool system: named creation tools in place of the single Ink pen, each showing its
result while you gesture and proposing its consequences where they happen. Interactive Stage plus a
System sheet generated from the same tool registry.

**Status:** proposed UX study for owner review. Not approved, not a production contract, not a plan.

## Open it

Open `index.html` directly (`file://` works, no build), or serve the folder:

```bash
python3 -m http.server 8840 --directory prototypes/world-creation-tools
```

The `world-creation-tools` entry in `.claude/launch.json` runs the same command.

Deep links: `#village`, `#gallery`, `#slope`, `#meadow` load a scenario; `#<scenario>/<tool>` also
arms a tool (`#village/path`, `#gallery/art`, `#slope/building`); `#sheet` opens the System sheet.
The strip at the top (view, Families/Flat dock, scenario, reset) is prototype control, not proposed UI.
The dashed readout at the bottom left is an instrument showing the interaction state chain and a few
things to try with the armed tool.

## The proposal in short

- **The dock holds families.** Select on the left; Build (Walls, Building, Opening, Roof, Stair),
  Furnish (Object, Art, Light) and Landscape (Ground, Path, Water, Plants) as an accordion; Paint and
  Erase on the right; Measure and Slice as quiet inspection keys; Library last. Clicking a family
  re-arms its last tool. A Flat toggle shows all thirteen creation tools in one row for comparison.
- **Shapes are shared.** `1` Line, `2` Arc, `3` Box, `4` Circle, `5` Freehand, `6` Outline mean the
  same thing in every drawing tool. Curved walls and round rooms are shapes, not separate tools.
- **Consequences are tokens in place.** While you draw, dashed cobalt tokens appear at each
  consequence (a path crossing a wall proposes a gate; a slope proposes steps; water proposes a
  bridge). Release commits one undo step. The tokens turn solid and stay clickable: changing one
  re-plans the same undo step (no second history row). Dark tokens are information only.
- **Refusals are local.** The refused part turns red with its reason and nothing commits.
- **Esc ladder:** live draft (Backspace removes one point) → amend tokens → selection → palette →
  Select. Right-click cancels only the live draft.
- **Paint is universal** with a reach (face, wall, room or building, everything like it). A click that
  would change a shared definition asks first (the Ask Rule).
- **Every commit is a typed intent** (`landscape.path.lay` with `layout.opening.cut` consequences);
  the Spec drawer on the Stage shows the intent of the last step.

The System sheet covers principles, the dock, every tool (makes, gesture, result, owner, what it
proposes), the shared grammar and state table, the tool-meets-tool matrix, mark and token specimens,
what this replaces, where it departs from the brief, owner decisions and the icon set.

## What to try

| Scenario | Try |
| --- | --- |
| Village by the pond | Path (`P`), Freehand, from the small cottage across the pond and into the walled garden: door, bridge and gate tokens appear as you cross; click one after release |
| Village by the pond | Paint (`C`) a cottage wall with reach "Everything like it": it asks before changing both cottages |
| Village by the pond | Erase (`E`) the garden wall: the tag names what goes and what stays |
| Gallery at dusk | Art (`A`) along a wall: frames skip the arches; Light (`L`) and drag the sun along the sky arc |
| Hillside to build on | Building (`B`) across the terrace edge: it proposes a plinth; Stair (`T`) from the foot onto the terrace |
| Empty meadow | Walls (`W`) with `4` Circle for a round room; Ground (`G`) to raise or lower; Water (`H`) for a pond |

## Real and simulated

Real (enough to test the interaction): tool switching and palettes, shared shape drafting with grid
and wall snapping, live tokens and amendable commits, refusal, Esc ladder, undo and redo with one row
per gesture, hover and selection, a selection Card with editable properties and relationships,
terrain brushing on a height grid, plant scatter skipping paths, water and buildings, the intent log.

Simulated: all geometry is a Canvas 2D axonometric sketch with simple placeholder forms. There is no
geometry kernel, no Three.js, no Camera authority, no persistence (reload resets), no Library content
and no Slice. History is whole-world snapshots. Material swatches, building styles and object
catalogues are placeholders. None of these shortcuts is a proposed implementation.

## What it replaces (if accepted)

| Approved today | Proposed |
| --- | --- |
| Ink: one pen for walls, rooms and openings | Named creation tools in three families |
| Flat utility dock: Select · Ink · Slice · Eraser · Brush · Measure | Families dock with Paint and Erase as universal tools |
| Brush for materials | Paint with reach and the Ask Rule; the ground takes it as a brush |
| Consequences in an acceptance bar before commit | Live tokens, commit on release, amend in the same undo step |
| Esc: palette, then disarm | Five-rung Esc ladder |

## Where it departs from the brief

- Lighting is not a family: Light holds fixtures and the sun (on a sky arc). Environment stays Scene.
- Water sits in Landscape with Ground, Path and Plants; it is a terrain edit with a surface.
- Paths and Stairs are separate: a Stair is Layout architecture; a path's Steps are a consequence.
- Openings stay first-class and are also proposed by Path and Walls; the result is one Opening.
- Materials are not a family tool: Paint works on every surface.
- Art is its own tool, not an Object: hanging is an explicit wall attachment.
- Procedural results are named proposals; nothing silently cuts a wall.

## Owner decisions this needs

1. **Landscape ownership.** Ground, paths, water and plants have no owner in the North Star. Options:
   a Landscape authority, terrain in Layout with plants in Scene, or all in Scene.
2. **Placed buildings.** Building assumes Layout placed structures from reusable definitions.
3. **Cross-owner acceptance.** A path that cuts a doorway commits Landscape and Layout in one step.
4. **Sun and hour.** Authored Scene environment or a viewing preference.
5. **Plant scatter rule.** Applied once at painting time, not stored. Confirm no persistent rule.

## If accepted: suggested follow-ups

- **T1:** the families dock, shared shape keys and Esc ladder over existing Walls/Opening/Paint/Erase;
  consequence tokens and amend-in-step on the existing history.
- **T2:** Building and Roof over Layout placed structures and reusable definitions; Paint reach and
  the Ask Rule against definitions; Art hanging as an explicit attachment.
- **Landscape:** after the ownership decision, Ground, Path (with cross-owner consequences), Water
  and Plants.

## Files

`index.html` shell and boot · `styles.css` · `icons.js` icon set · `registry.js` families, tools,
shapes, states and the interaction matrix (single source for the Stage and the sheet) ·
`model.js` simulated world, planners and history · `render.js` axonometric Canvas renderer ·
`tools.js` tool behaviour, gestures, tokens, keys and scenarios · `ui.js` dock, palette, Card,
Spec drawer, readout and routing · `sheet.js` System sheet.

Checks: `node --check` on each script; open the page and confirm a clean console.
