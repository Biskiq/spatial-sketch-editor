# Plan authoring audit

Live audit of Plan as an editing surface, 2026-10-30, on the audit base's editor source at 1440×900 with a fresh Enclosed room. Pointer input was synthetic, with capture stubbed in the page; this exercises the Stage's real handlers but is not a native input test. Captures are in the [evidence folder](./evidence/README.md).

**Evidence key.** **B** observed live in this session. **C** read in code, not exercised. **A** accepted by an earlier slice and not re-driven here.

**Plan's X/Z and yaw limits are intentional and are kept.** Height stays with the Sheet and the Card.

## What already works

The foundation is sound. These passed live and should not be rebuilt:

- Selection, Card and marks appear for Walls and objects, with neutral hover.
- Wall gestures commit exactly one Undo step, and Undo restores the source exactly.
- Undo is disabled during a live gesture, and says why.
- Escape during a drag cancels with no trace, and the following release commits nothing.
- A refused object position stays at the field with a readable reason and writes nothing.
- Neighbouring Walls reshape correctly through a shared Junction.
- Scene Move snaps and shows a live X/Z tag.

**The core problem is feedback and reach, not authority.** The planners are correct; the Stage does not show what they decide, and the pointer cannot reach several of them.

## Operation matrix

| Operation | Works | Visually broken | Functionally missing | Intentionally deferred | Slice |
| --- | --- | --- | --- | --- | --- |
| **Ink Wall chain** (B) | Points land, chain commits, new Wall selected, Junction and Wall targets | Markers offset by the Index and Head width (D15). No line to the cursor; `Ghost Wall` exists only as a hidden title | Live length, angle and snap marks (D16) | — | C05 |
| **Ink Wall Box** (C) | Plans through `planInkDraft` | Same as chain | Same as chain | — | C05 |
| **Ink Opening** (B) | Hover finds host and offset; click commits | Two offset circles. No aperture preview. Palette covers the drawing (D14) | Width preview on the Wall; offset ignores Snap | — | C05, C07b |
| **Ink Shape** (C, A) | Native form planners | Paper ghost masked (D17) | Same preview as Scene | T5.P02 outline editing | C06 |
| **Select Wall** (B) | Click selects; gold fill and marks | Card covers the Wall's far end (D36) | — | — | C03a |
| **Select Opening** (B) | Index selection works | — | **Six of six clicks in the aperture selected the host Wall** (D35) | — | C07b |
| **Wall end point** (B) | One Undo; neighbour reshapes; numeric entry (A) | No geometry moves until release: only a tag and a circle (D34) | Off-axis pointer is ignored; result unsnapped: 8.094 m with Snap at 0.5 m (D31) | — | C07a |
| **Wall body** (B) | — | — | **Dragging a selected Wall pans the Stage** (D33) | — | C07a |
| **Wall move grip** (B) | One Undo; neighbours reshape | No geometry moves. Two-way glyph promises one axis, drag is free (D19) | Unsnapped: ΔX −1.121, ΔZ −0.747 (D31) | — | C07a |
| **Wall length ray** (B code path, A) | Free-end length with fixed start | Same | Unsnapped | — | C07a |
| **Shared Junction** (C) | Planner exact and tested; moved along the Wall's line today | — | Free move, typed X/Z, a reachable mark (D19) | Merge, no planner exists | C07a, C07b |
| **Wall angle, height, thickness** (A) | Card fields | — | — | S07: no ring, no grips | Kept |
| **Curved Wall** (C) | Curve planners in layout-core | — | No Stage marks | Admission waits for curved authoring | Kept |
| **Opening slide and width** (B slide, A width) | Mark, tag and one Undo; slides along host | Tag can sit under the Card | Unsnapped: 4.5038 m. Body drag absent. `resolveOpeningDragSnap` unused (D31) | Head and sill rays | C07b |
| **Opening symbol** (B) | Reads as a gap with a thin line | No door swing | — | S04 carried swing | C07b |
| **Primitive placement** (B) | Typed X/Z works | No ghost | **Click placement absent;** the default X 0, Z 0 landed on the Room boundary (D37) | — | C06 |
| **Catalogue and model placement** (C, A) | Click placement | Paper ghost masked (D17); model ghost null (D18) | The Library showed no catalogue in this project; not verified live | — | C06 |
| **Object Move mark** (B) | Snaps; live tag; one Undo | **Accepted outline stays and nothing moves until release** (D17) | Body drag absent on large objects (D33) | — | C06 |
| **Object Turn and Scale** (C, A) | S08 accepted | Paper ghost masked (D17). Marks crowd a small object: the Turn ring is wider than a 1 m box | Live synthetic check inconclusive; owed by C06 | Scale disclosure kept | C06 |
| **Native form marks** (C, A) | S09 accepted | Paper ghost masked (D17) | Not re-driven | Sections, outline editing in T5.P02 | C06 |
| **Selection fill** (B) | Layout gold fill in Paper | Scene outline only (D22) | — | Strength is O1 | C10 |
| **Eraser, Measure** (A) | S10 accepted | Measure snaps with the zoom-driven step | Not re-driven | — | C09b |
| **Pan, zoom, Fit** (B) | Drag pans; wheel zooms | `Nothing selectable there.` shows on empty clicks | No visible zoom or Fit controls except inside Scale (D40) | — | C09b |
| **Snap** (B, C) | Alt suspends; toggles | No mark shows what was hit (D32) | **Value changes with zoom** (D30). Applies to Ink, Place and Move but not Wall or Opening marks (D31). `resolveLayoutSnap` unused | — | C09b, C07a |
| **Interruption** (A, C) | Blur, hidden page, capture loss, second pointer and reading flip all cancel | — | — | — | Kept |
| **Candidate agreement** (C) | Planner previews are the same plan the commit uses | Preview is not drawn, so agreement cannot be seen | A test comparing drawn preview to accepted geometry | — | C05, C07a |
| **2D and 3D consistency** (C, A) | Same planners, marks and history | Plan flip roll (D23) | Body drag absent in both | Plan keeps X/Z and yaw | C08 |

## Regressions the first audit missed

Ordered by what a creator feels most.

1. **Snap changes with zoom (D30).** Live values were 0.1, 0.5 and 2 m in one session. Two points drawn at different zooms land on different lattices.
2. **Wall and Opening marks ignore Snap (D31).** The toolbar says 0.5 m and the drag produces 8.094 m. Only Ink, Place and Scene Move honour it.
3. **Openings cannot be selected by clicking in Plan (D35).** Only the Index reaches them. Code comments call this a "locked" order, yet `architecture.md` ranks Opening symbols above cut Walls.
4. **The semantic snap engines exist but nothing calls them (D32).** `resolveLayoutSnap` and `resolveOpeningDragSnap` remain in `layout-core`. This is good news: Junction, midpoint and guide snapping needs wiring, not a new engine.
5. **The Card covers the subject being edited (D36).** At 1440 it hid the object entirely, and expanded after a commit.
6. **Primitives cannot be placed by clicking (D37).** Scene objects are also refused outside a Room's floor. That is a domain rule, kept, but it needs a clearer preview.
7. **No zoom or Fit controls (D40).** Removing Scale would have removed the only Fit button.
8. **The scale bar is shown in 3D (D41),** where it is true only at the target plane, and it jumps when a palette opens.

## Wireframe behaviours

| Behaviour | Disposition | Why |
| --- | --- | --- |
| Compact Grid and Snap words | **Preserve** | Your request and the wireframe agree |
| Model-local Paper grid | **Preserve** | Calmer, and it frames the drawing |
| Minimal ruler | **Improve** | Wireframe has a bracket; your architectural ruler reads better, with ticks and a label below |
| Lower-right zoom and Fit | **Preserve** | Missing today |
| "Move parallel" two-way grip | **Preserve and extend** | Same action now also available by dragging the body |
| End point edits length | **Supersede** (O6) | The wireframe mock has no real topology; a real shared Junction changes what is natural |
| Rays and points over edge grips | **Preserve, refine** | The body drag gives edge-grip directness without drawing grips. A 0.2 m Wall at 1:71 is about 10 px, so separate edge and body targets are not distinguishable anyway |
| Snapshot Undo, painter's SVG, mock Camera | **Supersede** | Prototype shortcuts, already production-owned |
| Wall top ray and thickness arrow | **Keep deferred** | S07 ruling; Plan has no height axis |
| Fewer object capabilities | **Supersede** | Models, native axis sizing and uniform scale are real depth |
| Pale Paper Head controls | **Improve** | Today's Scale and settings controls invert on Paper; one quiet style reads better |

## Simpler without less depth

- **One drag target per Wall.** Select it, then drag it. Marks stay for precision and touch.
- **One snap fact.** Zoom never changes it, so it needs no explanation.
- **Fewer permanent controls.** Grid and Snap words, a ruler and three zoom buttons replace a Scale menu and interval selectors. One ⚙ for viewing preferences replaces the ☰ menu.
- **Progressive depth.** Typed values at the gesture, Card fields, Alt for free movement and preferences later. None of it is removed, and none of it is mandatory.
