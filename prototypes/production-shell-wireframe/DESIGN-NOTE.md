# Integrated production shell — design note (wireframe round 1.1)

**Status: unratified design exploration for owner review.** Nothing here amends
[PLATE](../../docs/reference/design-system/editor-shell-and-visual-system.md), the
[spatial-instrument grammar](../../docs/reference/design-system/spatial-instrument-grammar.md),
domain contracts or production. Proposed departures are listed in
[§5](#5-proposed-departures-from-ratified-plate) for an explicit ruling. How to run the
wireframe, its tours and its Compare menu is in the [README](./README.md).

Round 1.1 continues round 1 (commit `8ce39bc5`, PR #181) rather than replacing it. Its brief
was simplification: start simple, draw naturally, manipulate directly, and reveal precision
and complexity progressively, with the 3D world as the main workspace. Strongly preferred
changes are the defaults. Each open decision is a live A/B in **Wireframe ▸ Compare**, and
§4 gives a verdict for each.

## 1. The composition in one picture

```text
HEAD   ☰ · project · World | Experience · [location chip when the Index is hidden] · Find… ⌘K · ↶ ↷ ✓ · Preview
INDEX  │ STAGE ──────────────────────────────────────────────────────────── CARD     SHEET
scope  │ [2D|3D ▾] [Grid Snap]        (temporary-state pill: Section · Face · Put back)  name     ┬ 13.5
crumbs │                                                                      dims     ┼ ◉ 4.50 ⌖
facets │                         ...world...                                  More ▾   ┼
list   │                       ┌ palette column (icons, above the armed tool)            ┴ 0.00
       │                       └ dock  Select · Ink · Slice · Eraser · Brush · Measure │ Library
```

- **The Stage is the workspace.** Every other surface is small, floats over the Stage, or
  disappears.
- **Collapsed Index.** A hidden Index takes zero width; its location moves into the Head.
- **The Card is the only writer for ordinary dimensions.** Advanced fields sit under More.
- **The Height Sheet** is a thin vertical slider. It docks right by default, beside the
  Card, and can swap to the left.
- **The lower working edge** is the P3 dock. The armed tool's palette is one column of icons
  directly above it, and nothing grows sideways. The forest Instrument material is now used
  only for invoked tasks that need room: Library, Guide and repair.

## 2. What changed from round 1

| Brief point | Round 1 | Round 1.1 |
| --- | --- | --- |
| 1 Hierarchy | One grouped list (places, then kinds) | **A: scope model.** Breadcrumb with sibling menus, kind facets, capped lists with "Show more" and room contents in groups. **B: outline tree.** Both are projections of Layout/Scene; Room derivation is unchanged |
| 1 Collapsed Index | Hidden Index left a strip | Collapses to **nothing**. **A:** a location chip in the Head. **B:** edge peek on hover, and `\` from either |
| 2 Heights | Heights rail at Stage-left with named datums; raising the sheet armed Ink | **Height Sheet**: right-docked slider with ticks and one active number. The ticks distinguish **Levels** (long, structural, authored), **surfaces** (short, found on qualified horizontal tops), and **pins** (round, manual checkpoints). Labels appear on hover or drag. Pinning uses a pin on the knob. A **first-use hint** appears once after the first raised surface. Swap sides from its foot. Raising the Sheet no longer arms Ink |
| 3 Toolbar | Light horizontal palette rows with words | Icon-only **vertical palette column** above the active tool. Ink is only Sketch · Line · Box · Round, plus a small `⋯` for future pens. The reading chip appears only when a closed stroke is ambiguous; open chains are read quietly |
| 4 Brush | Paint was a temporary slot armed from Library | **Brush is a permanent tool.** One swatch (12 paints, 6 materials), a dropper, and a face/whole-room scope |
| 5 Edit shape | Section-pad Instrument or split Stage, both unsatisfactory | **C: section on the object.** A section plane is drawn on the roof at its own local section, with draggable joints and `＋` midpoints; the Card gives presets and joint values. **B:** a floating section editor that expands into a joint table. **A:** a Card editing posture |
| 6 View | One View menu holding readings, appearance, overhead and projection; 15°/90° buttons | **2D \| 3D** as the primary control. Eye level, elevations, *Face the cut* (only while a slice exists), projection and roofs-from-above sit behind `▾`. The 15°/90° buttons are gone. **Paper vs keep shaded** is an application viewing preference (☰ menu). Section is never a disabled item |
| 7 Slice | Cut line; Section in the View menu | Live preview while dragging. On-Stage tape with move, **depth** and **flip** knobs. Pill: depth · Flip · Face · Put back. Slice at height (horizontal) is the second palette option. It is a temporary reading only |
| 8 Eraser feedback | Erase review Instrument for scrub/lasso | A click erases at once with an Undo toast. Bulk marks then **one acceptance bar beside the gesture**. Kind chips leave a kind out. Consequences are stated in one line. A **bubble** asks only for cross-domain cases |
| 9 Manipulation | Slide, turn and size handles | The same Tiny Glade handles, plus **independent W/D/H**. **A:** progressive (click the scale knob). **B:** immediate. The base stays on its support and height grows upward. Things on top ride along and settle when their support goes. Fit behaviours: *extend* (bench), *stretch* (plinth, imported column), *proportional* (sculpture corner knob), *fixed* (piano, where stretching distorts). Nothing is blocked by category, and the live tag names the verb |
| 10 Card | Identity plus ≤3 facts; dimensions in a Dimensions Instrument | **Editable dimension fields in the Card**, with refusals inside the field. Advanced fields under More. No side accent borders. *In Experience* appears only when something uses the subject, and routine Details offer no *Present this* |
| 11 Find | A dock slot opening an Instrument | **Find in the Head** with live grouped suggestions. Verbs stay distinct: *Do* (for the selection), *Arm*, *Show*, *Run*, *Go to* (navigation) and *Select* (selection). Matches in the current scope rank first; overflow hands off to the Index filter |
| 12 Density | Labels, borders, larger popovers | Hairlines, icon-first controls with tooltips, labels on demand, no modal popups. Selection (gold), active tool (forest pressed), focus (ring), temporary inspection (pill, yellow tape, gold frame) and destructive marks (red dashes) stay distinct |
| Tours | Text-heavy journey coach | **Eight interactive tours.** Each step has a spotlight on the relevant control, Prev / Next, an optional *Show me* demo, and a check that lights Next once the step is done |
| Width | Narrow desktop, tablet and phone editor frames | The editor targets **small laptop and iPad**. At ≤1100 px the Index becomes an overlay that starts collapsed. Phones are out of scope for the editor; **Preview has a Phone frame** because visitors may use phones |

Also new: a **near-wall cutaway** in 3D. While you work inside a room (selection or entered
room scope), walls on the camera side become see-through and click-through. It replaces
round 1's dashed selection echo, which showed where a subject was but left it unreachable.

## 3. Recommended (defaults in the wireframe)

| # | Choice | Why |
| --- | --- | --- |
| R1 | **Dock: Select · Ink · Slice · Eraser · Brush · Measure, then Library** | Six permanent instruments, each armable with nothing selected and each with its own gesture and result. Brush earns its slot because colour is a basic act, not an import step |
| R2 | **Palette column above the armed tool**, icons only, tooltips on hover | It is next to the cursor, stays the same width whatever the tool, and has no words to read. Future tools hide behind `⋯` |
| R3 | **Ink reads the surface it lands on.** A chip appears only for ambiguous closed strokes (Room · Raised platform · Walls only); Tab re-reads in the same undo step | Unambiguous strokes need no question. The chip keeps clear of the Sheet |
| R4 | **Height Sheet right, Levels ≠ surfaces ≠ pins** | One vertical instrument that says *at what height*. A Level is created only on purpose: platforms, decks and flat roofs are surfaces, and a pin is a checkpoint, never a Level |
| R5 | **2D \| 3D primary; everything else behind ▾** | The two readings used all day are one click. Projection (Axo/Persp), reading and appearance stay separate settings, and the Camera authority is unchanged |
| R6 | **Slice = temporary inspection** with tape, depth, flip and Put back | It never edits the building. *Face the cut* is a reading of the same Camera |
| R7 | **Eraser: immediate, then one acceptance, then review only across domains** | Fast, undoable and honest about consequences, without a modal |
| R8 | **Direct handles plus the Card as the one precision writer** | Drag for intent, type for precision, in one place. The Dimensions Instrument is retired |
| R9 | **Find in the Head** with distinct verbs | Commands, tools and places are one keystroke away without merging selecting with navigating |
| R10 | **Near-wall cutaway** while working inside a room in 3D | The subject stays visible and reachable. It is viewing state only |
| R11 | **Experience uses the same dock home**: Select · View · Path, then Capture and Guide. Look through adds a gold frame; Preview is a takeover | Unchanged from round 1, apart from density |

## 4. Open decisions compared (Wireframe ▸ Compare)

Each was stress-tested in the dense museum: 3 structures, 5 Levels, 40 rooms, 104 walls
(52 shared), 96 openings, 275 objects, 105 artworks, and a 24 m sawtooth roof.

| Question | A | B (C) | Verdict |
| --- | --- | --- | --- |
| Index model | **Scope + facets** (recommended): one scope at a time, crumbs with sibling menus, facets flatten a scope ("every object on First floor") | **Outline tree**: structure › Level › room › kind groups, capped and lazy | A. Reaching a room's contents in B takes three expansions, and the list grows past the viewport. In A the crumb is the way back and a sibling is one click. B stays useful for a whole-project overview |
| Collapsed Index | **Head location chip** (recommended): "Main hall › First floor" opens the Index | **Edge peek**: hover the left edge for a tab | A. Peek depends on hover, which iPads lack, and on a hidden edge zone. A also keeps location visible while the Index is away |
| Eraser arrangement | **Contextual** (recommended): gesture only (Scrub · Lasso); kind chips in the acceptance bar; ⇧ at the start locks to the touched kind | **Filter funnel**: kind toggles in a flyout beside the palette | A. The basic Eraser needs no setup, and filtering happens when there is something to filter. B suits long clean-up sessions, but a forgotten filter makes the Eraser look broken (badge shown) |
| Review threshold | **Cross-domain only** (recommended): ≤3 simple items apply at once; more go through the acceptance bar; Experience consequences ask | **Topology too**: also ask when hosts are set aside, rooms open, roofs lose support or riders settle | A. Topology consequences are already named in the toast and are one undo away. B interrupts ordinary wall edits |
| Edit shape | **On-object section + Card precision** (C, recommended) | **Floating editor** (B), expandable to a joint table · **Card posture** (A) | C for direct dragging, because the section is in the right local plane on the roof itself. B for long profiles and precision (all 9 sawtooth joints readable) and for narrow screens. A covers its own subject when the roof is on the right of the Stage. Keep C plus B's expand |
| Dimension handles | **Progressive** (recommended): click the scale knob for W/D/H | **Immediate**: W/D/H always shown | A. At overview zoom, six handles on a 1.8 m bench overlap. B is quicker for furniture layout at close range, so it could become a zoom-dependent rule |

## 5. Proposed departures from ratified PLATE

Each needs an owner ruling before it becomes a contract. D1–D8 revise round 1.

| ID | PLATE today | Proposal (round 1.1) | Change from round 1 |
| --- | --- | --- | --- |
| D1 | Pointer families Select · Draw · Opening · Place · Measure · More (§0.8.4) | **Select · Ink · Slice · Eraser · Brush · Measure**, with Library beside them | Brush added as a permanent family. Find leaves the dock (D10) |
| D2 | Compact pointer rail on the Paper edge | Bottom dock with an icon-only **palette column** above the armed tool | Palette rows replaced by a vertical column |
| D3 | Three drafting words; a fourth needs a ruling | **Withdrawn.** Grid and Snap remain the drafting words; the working height lives on the Sheet (D4) | Withdrawn |
| D4 | Stage furniture: reading cluster, rail, scale bar, datum key | **Height Sheet** slider, docked right (left on request), replacing the datum key in World 2D and 3D | It moved from left to right and became a slider. Datums are split into Levels, surfaces and pins |
| D5 | A tool is armed only by its own control | **Withdrawn.** Raising the Sheet no longer arms Ink | Withdrawn |
| D6 | Semantic colour roles fixed (§6.4) | Slice tape, Eraser marks, tool swatches | Unchanged |
| D7 | Grammar silent | X-ray overhead as the default authoring reading, plus the **near-wall cutaway** while working inside a room | The selection echo is replaced by the cutaway |
| D8 | Experience Stage toolbar (Conservatory) | Experience tools in the shared dock, with Capture and Guide | Unchanged |
| D9 | Precision ladder ends in the **Dimensions** Instrument; the Card shows ≤3 facts | **The Card is the one writer for ordinary dimensions**: editable fields and refusals in place, advanced fields under More. The Dimensions Instrument is removed. *This changes Card/Instrument authority.* | New |
| D10 | More / Find as a pointer-family slot | **Find in the Head**, with grouped live suggestions and distinct Go to / Select verbs | New |
| D11 | One reading control holding readings and appearance; Paper depth by reading | **2D \| 3D primary segmented control**, with a secondary disclosure for the rest. Section only via Slice. Paper vs keep shaded as an **application preference** | New |
| D12 | Index as a grouped locator; collapse leaves a strip | **Scope-model Index** (crumbs, sibling menus, facets), and a **zero-width collapse** with a Head location chip | New |
| D13 | Instrument hosts invoked tasks, including Edit shape and Erase review | Instrument reserved for Library, Guide and repair. **Edit shape becomes on-object**, with Card precision. **Erase acceptance becomes a bar or bubble at the gesture** | New |

Authority note for D9: dimensions stay owned by their domain (Layout for walls, openings,
roofs, rooms and Levels; Scene for objects and art). The Card is the only *editor surface*
that writes them, and handles write the same facts with the same refusals. That gives one
writer per fact at the UI level, and no second model.

## 6. Remaining usability problems

Problems found in the round 1.1 browser pass, which are still open:

1. **Card posture covers its subject.** Edit-shape A widens the Card over a roof that sits on
   the right of the Stage. It would need automatic framing into the free area, which is one
   more reason to prefer C.
2. **Overview-zoom handle crowding.** Progressive handles help, but small objects at 1:200
   still stack their handles. A minimum on-screen size, or "zoom to edit", is unresolved.
3. **The Sheet plane washes out a focused story.** In the dense museum, the translucent
   plane at 4.50 m tints the focused First floor. An outline-only plane under Focus may be
   enough.
4. **Touch.** Sheet tick labels and tooltips are revealed on hover. On iPad, the only
   reveal is the snap name while dragging. Tap-to-reveal, two-finger orbit and pen scrubbing
   are untested.
5. **The cutaway is automatic.** There is no held key yet to see the outside while working
   inside a room.
6. **Portrait Preview crops authored views.** Views framed on a desktop crop hard on a
   phone (Arrival becomes mostly wall). Look through needs aspect safe-area guides, or Views
   need per-aspect framing.
7. **Ambiguous names in dense projects.** Find and the Index show room and Level context
   ("Plinth · 1.01 d — Gallery 7 · First floor"), but similar subjects still need a thumbnail
   or hover-highlight to tell them apart.
8. **The overlay Index on iPad portrait** covers the left end of the dock while open.
9. **Tour cards** can sit over neighbouring tools in the dock.
10. **Experience hides the Sheet.** It is unclear whether View placement needs a working
    height.

Fixed during the browser pass, recorded for review:

- **Scrub erasing never registered.** A gesture start was not recorded. Fast strokes now
  sample the whole segment.
- **Hosted art floated after a slice.** Art on a sliced-away wall stayed visible; hosted
  items now follow their wall.
- **Inverted story focus.** Focus ghosted the focused story and kept the one below; touching
  a band no longer counts as being in it.
- **Pop-ups closed by tour demos.** A tour demo's re-render made the click target detached,
  which closed open pop-ups.
- **Overlapping placements.** The reading chip sat over the Sheet. The floating section
  editor sat over the Card and the dock. Toasts sat over the palette column.
- **Find stayed open** after losing focus. Its current-scope ranking was missing.
- **Plan labels under furniture.** Room labels were painted beneath objects.

## 7. Preserved boundaries and prototype shortcuts

**Preserved:**

- One canonical selection across lenses.
- The Card holds the selected identity and never holds tool state; the Index is a
  navigation projection.
- Levels are authored, never inferred from surfaces; Room derivation and Layout ownership
  are unchanged.
- Temporary readings (Slice, cutaway, Focus, Look through) are never source and always have
  *Put back*.
- One Camera authority behind every reading and the Preview.
- Undo is separate from Esc.
- Erasing sets hosted things aside, lets derived Rooms follow their walls, leaves roofs as
  repairable loose ends, and names Experience references without re-pointing them.
- Preview is isolated from editor machinery.

**Shortcuts (not proposals):**

- Snapshot Undo.
- Painter's-algorithm SVG; a full redraw of the dense museum takes about 250 ms in the
  browser. This is not a performance claim.
- Bounding and centroid lasso.
- Heuristic stroke reading.
- Roofs swept as one profile across a rectangle.
- Mock Camera interpolation.
- Mock dense data, generated by `dense.js`.
- No persistence.

None of these implies a format, an evaluator or an algorithm.
