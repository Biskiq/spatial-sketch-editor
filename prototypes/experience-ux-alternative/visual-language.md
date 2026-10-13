# Visual language — "Conservatory"

Route: [README](./README.md) · [design rationale](./design-rationale.md) · [scope and critique](./scope-and-critique.md)

The idea: a museum conservatory at dusk — deep green frame, pale stone working surfaces, brass
used only where light falls. Tokens live in [`styles/tokens.css`](./styles/tokens.css).

## 1. Colour has jobs

| Family | Key values | Job | Never used for |
| --- | --- | --- | --- |
| **Forest** | `#11291f` frame · `#22503c` primary | Identity and the frame (Head, Guide strip); the one primary commit per context (*Present this*, *Capture View*, *Look through*, *Exit View*) | Selection, decoration |
| **Leaf** | `#4f8f6c` · tint `#e5f0e9` | Active tool or context, switches that are on, Travel routes, View markers, “on the tour” dots | Primary buttons |
| **Gold** | `#d4ad45` · ink `#74560c` · tint `#f8efd6` | **Attention**: the selected thing, the current moment (playhead, camera puck, “looking through” frame), Default ◆, and *Preview* — the visitor’s eye | Large fills, body text on white (uses gold-ink) |
| **Stone** | `#fbfbfa` → `#1b201c`, slightly green-cooled | Card and Index surfaces, Plan paper `#e9ebe6`, text | — |
| **Dusk** | `#26302b` | 3D Stage background, so architecture and artwork read | Plan |
| **Danger** | `#b24a33` | Remove; a route through a wall | Anything reversible by Back |

Ratio guide: roughly 70 % stone, 20 % forest frame, under 5 % gold on any screen. Gold appears in
three or four places at once at most, so it always points at something.

**Plan vs 3D.** Same tokens, different grounds: Plan is light paper with ink-green walls and brass
paintings on the walls, for precise placement; 3D is dusk, for judging light and composition.
Markers keep their meaning across both (leaf = View, gold = selected, gold puck = playback camera).

**Not colour alone.** Selection always adds shape: bracket corners on Plan objects, an aim handle
and larger glyph on Views, a 2 px ring on tiles, a left bar in the outline, bold + underline links.
Focus is a separate 2 px forest ring with a white gap. Cut vs Travel differ by line style (dotted
chip vs solid with chevrons) and icon, not only hue. A wall-crossing route is dashed as well as red.

## 2. Type

- **Fraunces** (display serif, 500) for names a creator authored and a visitor will read:
  project name, Card titles, Guide name, Stop “Visits …”, visitor captions.
- **Instrument Sans** (400/500/600) for everything operational.
- Scale 11 / 12 / 13 / 15 / 19 / 24 px. Section labels are 11 px uppercase tracked — they label,
  they never shout. Numbers are tabular.

The serif/sans split is semantic: serif = content, sans = tool. It lets a reader see what a visitor
will see at a glance.

## 3. Components

- **Buttons.** Primary (forest fill), secondary (white, hairline), gold (only *Update View*,
  *Preview*, the play button), ghost (inline links), xs (row actions). One primary per Card.
- **Segmented control** for every small exclusive choice (Plan/3D, Cut/Travel, Lens, Eye height).
  Selected = white raised with a leaf hairline.
- **Stepper** for durations (−, value, +), always with units.
- **Card anatomy.** Back chip + ⋯ + close · kicker (type and parent link) · editable serif title ·
  action row · content sections with hairline separators. Rename = click the title. Remove lives
  in ⋯ with its consequence spelled out (“and its 2 Stops”).
- **Shot list row.** grip · order number · thumbnail · name (+ Entry tag, ◆) · hold stepper · ×.
  Dragging lifts the row with a gold border and a gold insertion line.
- **Stop tile / connector.** Dark tiles with entry thumbnail, number badge (gold when selected),
  proportional View segments. Connectors are labelled with the visitor action and camera action.
- **Mode pill.** Dark glass, gold outline, state text, its own exit with the key hint.
- **Thumbnails** are rendered from the same scene and View poses, so every image is a real
  composition preview.

## 4. Layout behaviour

| Width (container) | Index | Card | Guide | Head |
| --- | --- | --- | --- | --- |
| > 980 px | column, collapsible to rail | right overlay sheet | strip, collapsible | full |
| 621–980 px | drawer (☰ in Head) | bottom sheet ≤ 56 % | strip, smaller tiles | project name only |
| ≤ 620 px | drawer | bottom sheet ≤ 62 % | one-line bar by default | mark, ⋯, ▶ |

Container queries, not media queries, so *Prototype ▾ → Simulate width* shows real compositions on
a desktop. While looking through on narrow widths the Card collapses to its title and Exit/Update.

## 5. Interaction states

| State | Signal |
| --- | --- |
| Hover | Hairline darkens / leaf tint; Plan objects show their name |
| Selected | Gold + shape cue (see §1) |
| Focus | Forest ring with white gap |
| Dragging | Lifted shadow, gold border, gold insertion line, grabbing cursor |
| Active tool / placing | Leaf mode pill with instruction and Cancel; crosshair |
| Looking through / following | Gold mode pill, gold inner frame, helpers hidden |
| Playing | Gold playhead + fill, gold ring on the current tile/connector, moving gold puck |
| Warning | Red dashed route, red connector chip, inline alert with the fix |
| Disabled | 40 % opacity and a reason in the tooltip (e.g. “A Stop shows at least one View”) |
