# Integrated production shell — design note (wireframe round 1)

**Status: unratified design exploration for owner review.** Nothing here amends
[PLATE](../../docs/reference/design-system/editor-shell-and-visual-system.md), the
[spatial-instrument grammar](../../docs/reference/design-system/spatial-instrument-grammar.md),
domain contracts or production. Proposed departures are listed in
[§4](#4-proposed-departures-from-ratified-plate) for an explicit ruling. The runnable
wireframe and its journeys are described in the [README](./README.md).

**Inputs reconciled:** Conservatory's shared shell and Experience
([README](../experience-ux-alternative/README.md)), PLATE §0.8.4 Paper depth, P3 Vellum's
pen, sheet, Edit Shape and dock ([DESIGN](../p3-vellum/DESIGN.md)), P2 Smart Wall's
surface-aware arrangement ([README](../p2-smart-wall/README.md)) and the
[2026-10-22 convergence ratification](../../docs/reference/decisions/product-convergence-ratification-2026-10-22.md)
(draw, arrange, explain, revise; precise and keyboard equivalents; truthful repair).

## 1. The composition in one picture

```text
HEAD   ☰ · project · World | Experience · (active Experience) · Undo <verb> · Redo · Saved · Preview
INDEX  │ STAGE ─────────────────────────────────────────────────────────── CARD (overlay)
place  │ [View ▾ 3D]  [1:100 · Grid · Snap · Sheet 3.60]     (temporary-reading pill)   identity · ≤3 facts
groups │ HEIGHTS rail                                                                   Look ▾ · Details · ⋯
search │ (World, non-plan)                ...world...
       │                   ┌ Instrument (forest, invoked task: Dimensions, Find, Look,
       │                   │   Edit shape, Erase review, Library, Guide)              ┐
       │                   ├ Palette  (light, what the armed tool does next)          │ one centred
       │                   └ Dock     Select · Ink · Slice · Eraser · Measure │ Library · Find   column
```

The lower working edge is **one column that grows upward**: the dock is the persistent
baseline, the palette belongs to the armed tool, and the Instrument belongs to the invoked
task. Nothing grows sideways, nothing reflows the Stage, and opening the Card only recentres
the column in the remaining width.

## 2. Recommended choices

| # | Choice | Why |
| --- | --- | --- |
| R1 | **Lower-edge stack: dock → palette → Instrument.** Light chassis for persistent tools and their options; forest Instrument material only for invoked work | Keeps PLATE's three materials honest (tools are chassis, tasks are Instrument) and gives Conservatory's lower task home and P3's dock one place instead of two |
| R2 | **Permanent World tools: Select · Ink · Slice · Eraser · Measure**, then **Library** and **Find** | Each has a distinct pointer target + gesture result and is armable with nothing selected. Place is folded into Library (a placement always starts from a chosen thing); Opening is folded into Ink (below); More becomes Find |
| R3 | **Ink reads the surface it lands on.** Ground → Room / Walls only / Raised platform; raised sheet → Canopy / Deck / Walls standing on the sheet; wall face (3D or laid flat) → door/window sized by the drag. A chip names the reading; **Tab** re-reads in the same undo step | P3's strongest idea. It removes the Opening family without losing its embedded-cut grammar, because the host is the surface under the stroke |
| R4 | **Slice is a pointer tool; Face, Unroll, Lift, Edit shape and Section here stay in the subject's Look.** No Inspect group | Slice needs a gesture (where to cut) and no subject; the others need a subject and no gesture. The split matches PLATE's own admission test |
| R5 | **Eraser: Tap · Scrub · Lasso with kind filters.** Tap commits with an Undo toast; Scrub/Lasso mark in red and open an **Erase review** (Erases · Sets aside · Derived · Loose end · Elsewhere · one undo step). Delete on a selection opens the same review | Exploratory mass deletion stays fast but honest. Hosted art is set aside, not deleted; derived Rooms follow walls; roofs stay and become repairable loose ends; Experience references are named, never re-pointed |
| R6 | **Contextual handles, no gizmo.** Objects: slide (centre), turn (ring knob, 15° detents, ⌥ free), size (top, only when admitted). Walls: ends, top (snaps to named heights), push. Roofs: ridge. Hosted items: slide along the host (P2 spacing ribbons). Right-click opens the same fixed scoped list as Card ⋯ and Find "For …" | Tiny Glade-style directness. Precision remains PLATE's ladder: live tag → typed value → Card fact → **Dimensions** Instrument |
| R7 | **Selection shows through occluders** as a thin dashed gold echo | Selecting from the Index must not lose the subject behind a wall or roof; it changes no reading |
| R8 | **One View control** holds readings (3D, Plan, Elevation S/E/N/W, Eye level, Section once a Slice exists), appearance (**Auto** · Paper · Shaded), overhead (**X-ray** · Solid), projection (Axonometric · Perspective) and Turn | One door for "how am I looking", not for tools. **Auto:** Plan, elevations, sections and laid-flat walls settle onto vellum; 3D and eye level sit on the mat. Overrides are reading settings, never source |
| R9 | **Heights rail at Stage-left**, beside the Index: named, magnetic datums; drag the sheet; **Focus height** ghosts outside the band; raising the sheet arms Ink; "+ Name" adds a datum | The Index says *where*, the rail says *at what height*; together they are the locator. Stage-right collides with the Card |
| R10 | **Working-surface chip** at the head of the Ink palette: "On Ground 0.00", "On sheet 3.60 · Studio top", "On South wall face" | Reconciles horizontal, vertical and subject-local surfaces with one sentence before the stroke |
| R11 | **Edit shape** opens a broad Instrument: section pad (joints, people, walls behind), presets, **Face the section**, optional **synchronized 3D preview**. The Stage keeps the building, other subjects ghosted | Seamless World context plus detailed 2D editing, without a second workspace |
| R12 | **Library beside the dock** (Objects · Art · Materials · Lights · Import). Import yields fixed geometry → Place / Trace as underlay. Art refuses anything but a wall face, in words. A material arms **Paint** as a temporary dock slot | Assets meet the tools they feed. Paint never earns a permanent slot, but stays one click away while in use |
| R13 | **Experience uses the same dock home**: Select · View · Path · Measure, then **Capture** and **Guide**. The Guide is the broad Instrument above the dock; Look through adds a gold Stage frame; Preview is a takeover with Exit that restores the authoring context | Conservatory's Experience inside the same Head/Index/Stage/Card and the same lower column; only the tools and the task change |
| R14 | **Colour.** Tool identity is a small swatch under the icon (black Ink, yellow Slice, red Eraser) and the marks the tool makes: Slice = yellow/black tape, Eraser = red dashed marks. Armed = forest pressed. Gold stays selection, playback and Preview | Yellow next to gold selection was the risk; tape pattern plus position keep them apart. Ink renders light on the mat and ink-black on vellum |
| R15 | **Narrow.** ≤1000 px: Index and Card become sheets behind Head location / selected-identity controls. ≤640 px: dock keeps Select · Ink · Library, folds Slice/Eraser/Measure into **More** (expands upward), Card docks above the dock, heights reduce to the Sheet word | Stage stays dominant and stable; nothing implies Camera motion |

## 3. Alternatives compared (Wireframe ▸ Compare)

| Question | A (recommended) | B | Verdict |
| --- | --- | --- | --- |
| Tool home | Bottom dock, palettes upward | PLATE-literal vertical pointer rail on the Stage edge | B crowds the heights rail to the right, pushes the Card inward and makes palettes tall, narrow and wordy |
| Heights rail | Stage-left | Stage-right (P3) | B fights the Card for the same edge |
| Edit shape | Section pad Instrument over a ghosted building | Split Stage: section left, 3D right | B gives more section room but halves the World; keep as the answer for very long sections |
| Tool colour | Swatches + tool marks | PLATE roles only | A without swatches still works; colour is reinforcement, not identity |

Also considered and rejected: a permanent Paint tool (rarely armed, and its target is a
chosen material); Slice inside Look (it has no subject); immediate Lasso erasing (too much
reach without review); a separate Opening tool (redundant with surface reading).

## 4. Proposed departures from ratified PLATE

Each needs an owner ruling before it becomes a contract.

| ID | PLATE today | Proposal | Reason |
| --- | --- | --- | --- |
| D1 | Pointer families **Select · Draw · Opening · Place · Measure · More** (§0.8.4) | **Select · Ink · Slice · Eraser · Measure**, with Library and Find beside them | R2–R5. Opening and Place are absorbed rather than dropped; Slice and Eraser pass the family admission test |
| D2 | Rail "attached to the Paper edge" as a compact pointer rail | Bottom dock sharing the lower working edge with palette and Instrument | One upward column keeps the Stage stable and gives palettes horizontal words |
| D3 | Three drafting words; a fourth needs a ruling | **Sheet** (height of the next point) as the fourth | Meets the stated test exactly: it changes where the next point lands |
| D4 | Stage furniture: reading cluster, rail, scale bar, datum key | **Heights rail** as the datum key's expanded form in World non-plan readings | P3's vertical authoring depends on it |
| D5 | A tool is armed only by its own control | Raising the sheet arms Ink; putting it away disarms | P3's evidence that the sheet is paper; arming still never changes selection |
| D6 | Semantic colour roles fixed (§6.4) | Add Slice tape and Eraser-mark roles; tool swatches | A new role requires a conscious system change |
| D7 | — (grammar silent) | Selection echo through occluders; X-ray overhead as the default authoring reading | Both are reading/representation rules for the spatial-instrument grammar |
| D8 | Experience Stage toolbar (Conservatory) | Experience tools in the shared dock, with Capture and Guide | One lower home across lenses |

## 5. Unresolved questions

1. **Ink ambiguity budget.** How many readings may Tab cycle before the chip becomes a menu? Should Ink offer a held modifier for "always walls"?
2. **Erase review threshold.** Tap is immediate; should a tap that orphans hosts or strands a roof also open the review?
3. **Sheet in Plan.** Plan shows the Sheet word but no rail. Is plan-at-height a real working mode or only a drafting state?
4. **Library vs Index.** Imported models appear in both the Library (as definitions) and the Index (as placed instances). Is that distinction legible enough?
5. **Wide Instruments over the subject.** Erase review and Edit shape can cover the lower Stage; is *Bring into view* enough, or should broad Instruments dock to one side?
6. **Experience Measure.** Is Measure useful in Experience, or should Path take that slot?
7. **Touch.** Handles and lasso assume a pointer; coarse targets meet 44 px, but two-finger orbit is untested.

## 6. Preserved boundaries and prototype shortcuts

**Preserved:** one canonical selection across lenses; Card = selected identity, never tool
state; Index = locator; one Instrument at a time; temporary readings with *Put it back*;
Undo separate from Esc; reading settings are never source; Preview isolated; lens switches
carry selection and park tasks; Layout/Scene/Camera/Experience ownership shown in Details.

**Shortcuts (not proposals):** snapshot Undo; painter's-algorithm SVG; bounding/centroid
lasso; heuristic stroke reading; flat canopies as polygons; roof Edit shape limited to
gable/raked; linear mock Camera interpolation with hand-placed doorway points; thumbnails
re-rendered from mock poses; no persistence. None implies a format, evaluator or algorithm.
