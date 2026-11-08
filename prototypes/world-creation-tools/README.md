# World creation tools

A proposed World tool system: named creation tools in place of the single Ink pen, each showing its
result while you gesture and proposing its consequences where they happen, dressed in the Living
Draft identity. Interactive Stage plus a System sheet generated from the same tool registry and the
same instrument markup.

**Status:** interaction and identity donor for owner review, for T1 and T2 to reuse and evolve. Not
approved, not a production contract, not a plan.

## Open it

Open `index.html` directly (`file://` works, no build; fonts load from Google Fonts and fall back to
system type offline), or serve the folder:

```bash
python3 -m http.server 8840 --directory prototypes/world-creation-tools
```

The `world-creation-tools` entry in `.claude/launch.json` runs the same command.

Deep links: `#village`, `#gallery`, `#studio`, `#slope`, `#meadow` load a scenario;
`#<scenario>/<tool>` also arms a tool (`#village/path`, `#gallery/object`, `#studio/form`,
`#slope/building`, `#meadow/water`); `#sheet` opens the System sheet. The dark strip at the top (view,
scenario, reset, Spec drawer) is prototype control, not proposed UI. The dashed readout at the bottom
left shows the interaction state chain and a few things to try with the armed tool.

## The direction in short

- **Eight labelled keys, not sixteen glyphs.** `Select | Build  Form  Landscape  Furnish | Paint  Erase | Library`.
  A family key arms the tool you last used in it; dots under the key show how many tools it holds
  and which one is armed. Pressing the armed key again folds the tier away. The dock stays this size
  as Biskiq grows: new tools go inside a family.
- **One parchment tier above the dock** holds one thing at a time: the family's tools as words
  (Walls, Opening, Stair, Building) with the options of the armed one as pictures, or the
  selection's actions, or the Library. *Nouns get words; variants get pictures.* Letter keys still
  arm any tool directly.
- **The families.** Build (Layout): Walls `W`, Opening `O`, Stair `T`, Building `B`. Form (Scene):
  Form `D`. Landscape (needs an owner): Ground `G`, Water `A`, Path `P`, Plants `N`. Furnish
  (Scene): Objects `F`, Lights `L`.
- **One placement rule.** A family earns a dock key when it has its own owner and its own verb. A
  tool has its own gesture and target. An option is a variant of the armed gesture (shape, kind,
  size, finish, mode, definition). Catalogue content lives in the Library. Selection actions operate
  on something that exists (roof a room, turn, duplicate, replace, save to Library).
- **Draw it: Form. Pick it: Furnish.** Form is the seed of expressive modelling (Carve, Sweep, Lathe,
  Array to come); Furnish is the shelf and the Library.
- **Building is a Build tool**, not a key: it shares Walls' footprint gesture, but its result is a
  placed structure that follows a definition (Cottage, Tower, Pavilion, Long barn), picked in its
  options or the Library.
- **The Sky is in the head**, not a pointer tool: a chip showing the hour opens presets and an hour
  slider, and while it is open the sun's arc on the Stage can be dragged. Each change is one undo
  step (`scene.environment.setHour`). Lights hold fixtures only.
- **The head holds ways of looking:** 3D and Plan, Living and Paper, Measure, Slice, Sky.
- **Shapes are shared.** `1` Line, `2` Arc, `3` Box, `4` Circle, `5` Freehand, `6` Outline mean the
  same thing in every drawing tool.
- **Consequences are tokens in place.** While you draw, blue-pencil tokens appear at each
  consequence (a path crossing a wall proposes a gate; a slope proposes steps; water proposes a
  bridge). Release commits one undo step; changing a token afterwards re-plans the same step.
- **Refusals are local**, the **Esc ladder** is draft, Library or Sky, amend tokens, selection,
  palette, then Select, **Paint** is universal with a reach and the Ask Rule, and **every commit is a
  typed intent** (shown in the Spec drawer).

## Identity: Living Draft

Precise drafting and illustrated making in one surface. A forest chassis (head and dock) carries the
instrument; parchment with a fine grain carries what you read and choose. On the Stage, ink edges
mark what is built and a hatched section cuts the ground slab. Fraunces names things (tools, places,
selections), Instrument Sans runs the interface, DM Mono gives measures and tags. Dock keys are
duotone: a pencil line over an offset wash in the family's colour (terracotta Build, parchment Form,
moss Landscape, ochre Furnish). Gold is reserved for selection; cobalt blue pencil for proposals;
red for refusals.

Two Stage profiles, a viewing preference that is never saved into the world: **Living** (warm light,
the hour, shadows) and **Paper** (flat parchment tones, ink outlines, fixed noon light, no night).

## What to try

| Scenario | Try |
| --- | --- |
| Village by the pond | Select (`V`) inside the walled garden: the tier offers it a roof |
| Village by the pond | Path (`P`), Freehand, from the small cottage across the pond into the garden: door, bridge and gate tokens appear as you cross; click one after release |
| Village by the pond | Paint (`C`) a cottage with reach Room or building: it asks before changing every Cottage |
| Village by the pond | Build, then Stair, then Landscape, then Build again: it comes back to Stair |
| Gallery at dusk | Objects (`F`), Frame (`6`), drag along a wall: frames skip the arches. Open the Sky chip and drag the sun along its arc |
| Studio composition | Form (`D`): draw a Box on the Stage, pull its height, click. Select it, then Duplicate or Save to Library |
| Hillside to build on | Building (`B`), pick Tower, drag across the terrace edge: it proposes a plinth. Stair (`T`) from the foot onto the terrace |
| Empty meadow | Water (`A`): hold to paint a deep pond, Stream (`2`) to draw one downhill, then Path (`P`) across it for a bridge |
| Any | Living and Paper in the head; the System sheet shows both |

## Real and simulated

Real (enough to test the interaction): family keys with memory, the tier, tooltips, selection actions
and the Library in one tier, the Sky with undoable hour changes, shared shape drafting with grid and
wall snapping, live tokens and amendable commits, refusal, the Esc ladder, undo and redo with one row
per gesture, hover and selection, the selection Card, terrain brushing, water, plant scatter skipping
paths, buildings from definitions, the intent log, both render profiles.

Simulated: all geometry is a Canvas 2D axonometric sketch with placeholder forms. No geometry kernel,
no Three.js, no Camera authority, no persistence (reload resets), no kept Library entries and no
Slice. History is whole-world snapshots. Materials, building definitions and catalogues are
placeholders. None of these shortcuts is a proposed implementation.

## What it replaces (if accepted)

| Approved today | Proposed |
| --- | --- |
| Ink: one pen for walls, rooms and openings | Named tools in four families: Build, Form, Landscape, Furnish |
| Flat utility dock: Select, Ink, Slice, Eraser, Brush, Measure | Eight labelled keys and one tier; Measure, Slice and the Sky in the head |
| Brush for materials | Paint with reach and the Ask Rule; the ground takes it as a brush |
| Consequences in an acceptance bar before commit | Live tokens, commit on release, amend in the same undo step |
| Esc: palette, then disarm | Six-rung Esc ladder |

## Where it departs from the brief

- Lighting is not one tool: Lights hold fixtures; the sun and the hour are the Sky (Scene environment).
- Water is its own Landscape tool, but underneath it is still a terrain edit with a surface.
- Paths and Stairs are separate: a Stair is Layout architecture; a path's Steps are a consequence.
- Openings stay first-class and are also proposed by Path and Walls; the result is one Opening.
- Materials are not a family: Paint works on every surface.
- Procedural results are named proposals; nothing silently cuts a wall.

## How it grows

Build: Level, Railing, Column grid. Form: Carve, Sweep, Lathe, Array. Landscape: Hedge, Fence,
Rocks. Furnish: Media, Sound, Trigger zone. Sky: weather, season, fog. Interactive experiences
(viewpoints, camera paths, triggers, sequences) become a fifth family key, say Direct, once they have
their own owner and two tools.

## Owner decisions this needs

1. **Landscape ownership.** Ground, water, paths and plants have no owner in the North Star: a
   Landscape authority, terrain in Layout with plants in Scene, or all in Scene. The Landscape key
   does not depend on the answer.
2. **Placed buildings.** Building assumes Layout placed structures from reusable definitions.
3. **Cross-owner acceptance.** A path that cuts a doorway commits Landscape and Layout in one step.
4. **Sky.** The hour as authored Scene environment (undoable); Living and Paper stay viewing
   preferences.
5. **Saved forms.** Save to Library makes a composed form reusable: a Scene definition or a typed
   resource.
6. **Plant scatter rule.** Applied once at painting time, not stored. Confirm no persistent rule.

## For T1 and T2

This prototype is the donor, not a plan. T1 takes the instrument (family keys with memory, the tier,
tooltips), the placement rule, shared shape keys, the Esc ladder, consequence tokens and
amend-in-step over the existing Walls, Opening, Paint and Erase, plus the Living Draft tokens and
type. T2 takes Building with definitions, roofs offered on closing and on selection, Paint reach and
the Ask Rule, Object frames as a wall attachment, Form, and the Sky. Landscape follows the ownership
decision.

## Files

`index.html` shell and boot · `styles.css` Living Draft tokens and surfaces · `icons.js` icon set and
duotone dock icons · `registry.js` families, tools, building definitions, Sky presets, Library,
shapes, states and the interaction matrix (single source for the Stage and the sheet) · `model.js`
simulated world, planners and history · `render.js` axonometric Canvas renderer with Living and Paper
profiles · `tools.js` tool behaviour, gestures, tokens, keys and scenarios · `ui.js` the instrument
(dock, tier, selection actions, Library, tooltips), head and Sky, Card, Spec drawer, readout and
routing · `sheet.js` System sheet.

Checks: `node --check` on each script; open the page and confirm a clean console on the Stage and
the System sheet.
