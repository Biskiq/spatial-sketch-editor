# P23 design context — Museum Editor, Scene Plan Build

**Audience:** a designer who has never seen this repository.
**Purpose:** durable product/UX baseline for P23.12–P23.16 slice briefs. This file
is **persistent context**, not a slice brief and not an implementation plan.
**Compiled:** 2026-09-15 against `main` @ `9118696` (P23.11 merged, PR #51).
**Shell/visual successor (P23.14):** [`P23.14-shell-design-context.md`](./P23.14-shell-design-context.md)
— compiled 2026-09-17 against `main` @ `368a799` (P23.13 merged). It narrows to shell
structure, the durability map, and P23.15/P24/P26 forward-compatibility. Where this file's
shell and Plan-presentation claims disagree with it, that file is fresher. **Note
(2026-09-17):** P23.14 was re-scoped by owner review from bounded shell polish to
**Editor Shell & Visual System Foundation** — this file's "P23.14" rows and its §6
"broad shell redesign" deferral were updated to match.
**Authority order used here:** source code + tests → `docs/hand-off/CURRENT.md` →
active plan → component contract → `docs/architecture.md` → `docs/north-star.md`
(`AGENTS.md` §10).

Every claim below is tagged:

| Tag | Meaning |
|---|---|
| **[S]** | Shipped, verified in the working tree today |
| **[C]** | Fixed product/architecture constraint (do not redesign in P23) |
| **[P]** | Planned P23.12–P23.16 direction (not built) |
| **[Q]** | Unresolved design question — deliberately left open |
| **[D]** | Explicitly deferred, out of P23 scope |

---

## 1. Product and workspace model

### What Museum Editor is

A browser tool for creators who want to author an interactive 3D museum /
exhibition / walkthrough — architectural space, placed objects, camera
navigation — and publish it as a visitor-facing web experience. It is explicitly
*not* a BIM system, a DCC replacement, Figma/Canva, or a game engine
(`docs/north-star.md`). **[C]**

The authoring language is phase-based, not a waterfall: **Build** (spatial /
architectural), **Stage** (objects, materials, lighting — P24), **Direct**
(camera and route), **Experience** (visitor journey — P25). **P23 is the Build
phase**; "Build" is the authoring phase name, not a UI label. **[C]**

### Scene vs Camera **[S] [C]**

`Scene | Camera` is the **domain** axis, switched in the Workspace Ribbon
(`apps/editor/src/lib/editor/app/WorkspaceRibbon.svelte`).

- **Scene** — the physical space: Layout architecture *and* placed Scene content
  (models, primitives, lights, cameras).
- **Camera** — guided 3D camera navigation ("Camera" always means a cinematic
  PerspectiveCamera route, never a webcam). Camera owns the timeline and the
  node/connection graph.

Domain switch is attention-only: it never changes the document, history or the
world, and never snaps the view.

### Plan vs 3D **[S] [C]**

`Plan | 3D` is the **view** axis, orthogonal to domain (`WorkspaceRibbon`). Boot
is Scene → Plan. All four cells exist:

| | Plan | 3D |
|---|---|---|
| **Scene** | the Build surface (Layout) + Arrange | spatial 3D of layout + scene |
| **Camera** | camera-graph authoring over the architectural backdrop | camera authoring in 3D |

Camera → Plan is **not** a layout editor: it authors camera nodes/connections
over read-only architecture. Do not treat Camera Plan as a second Build surface.
**[C]**

### Scene Plan Build workflow **[S]**

Scene → Plan carries a workspace-local mode, presented as `Layout | Arrange`
(the internal value is still `staging`; the user-facing word is Arrange —
`LayoutDraftToolbar.svelte`, `WorkspaceRibbon.choosePlanMode`).

```text
Scene → Plan → Layout    draw Walls / Rooms / Door / Window / presets,
                         select, directly reshape, refine, inspect
Scene → Plan → Arrange   move/rotate placed objects (Scene owner and Layout
                         object owner, each through its own pipeline)
Scene → 3D               verticals, materials, lights, placement in space
Scene → Plan (Saved)     Save / Preview (visitor takeover) / Publish
```

Undo/Redo is one chronological stack for Spatial (Row 1), tagged per document.

### LayoutDocument vs SceneDocument **[C]**

Two separate documents with separate ownership; this is the single most important
architectural fact for design work:

| Document | Owns |
|---|---|
| `LayoutDocument` (`@portfolio/layout-core`) | Floor, Junctions, Walls, Rooms, Openings, document-level Layout objects — the architecture |
| `SceneDocument` (`@portfolio/project-model`) | Scene models/primitives, lights, materials, Camera nodes/connections/paths, textures |

Derived geometry is never persisted: `compileLayoutGeometry()` is the one
authority feeding Plan, 3D and visitor output. **[C]**

Raw text or JSON import/export exists per document in the Project (Document)
menu, but **Layout edits never move world-local Scene/Camera content
implicitly**. **[C]**

### Wall / Junction / Room / Opening (designer view) **[S] [C]**

- **Wall** — one physical straight-or-curved Wall with thickness and per-Wall
  height, existing *once* between two Junctions. It has an internal role:
  *boundary* (defines a room boundary) or *partition* (does not divide rooms).
  The role is not a separate user-facing object family: newly drawn Walls are
  `boundary`, and a selected Wall exposes one **Defines room boundary** toggle.
- **Junction** — a connectivity point. The two Wall endpoints *are* Junctions, so
  dragging an endpoint handle moves that Junction. **Junction identity is the
  only connectivity truth** — never coordinate proximity. **[C]**
- **Room** — a *persistent semantic* enclosed region, reconciled over derived
  boundary-Wall faces. It survives geometry edits that keep its correspondence;
  it is not recomputed from scratch and it is not authored as a polygon.
- **Opening** — a Door or Window hosted by one Wall, positioned by a physical
  meter offset along that Wall, with width/height/sill height and a profile
  (rectangular / rounded arch / pointed arch). A door may carry an explicit
  optional portal relation between the two adjacent Rooms. **[C]** Plan symbols
  must not invent swing/handing/leaf semantics that the data does not have.

---

## 2. Current Build UX

### Shell **[S]**

```text
36px  Project Row      Projects · project name · save state · Document menu ·
                       Spatial | Publish · Undo/Redo · Preview · Theme · account
32px  Workspace Ribbon  Scene | Camera · Plan | 3D · contextual Build tools ·
                       panel-visibility toggles (left, right, focus)
---   left rail  |  viewport (Grid / Plan / 3D)  |  Inspector
24px  Status bar
```

(`apps/editor/src/lib/editor/app/EditorApp.svelte` grid; `ProjectRow.svelte`;
`WorkspaceRibbon.svelte`; `StatusBar.svelte`; heights via
`.project-editor` tokens in `styles/tokens.css`.)

- **Left rail width** is the shell's left sidebar track:
  `minmax(15rem, var(--editor-left-width))` with `--editor-left-width: 300px`
  — i.e. **240 px floor, 300 px default**, collapsible to 0. (`EditorApp.svelte`
  ~2191; `tokens.css`; §15 of `docs/Design-specs/Design-specs.md` documents
  "Left sidebar 300px / minimum 240px".)
  **Mismatch to know:** the P23.6e directive calls this the "canonical **268 px**
  Navigator rail" (`docs/plans/P23.6e-directive.md:141`), and the P23 roadmap said the
  same until its P23.14 references were corrected to 240–300 px on 2026-09-17.
  **`268` appears nowhere in the code.**
  Treat "one narrow fixed rail, ~240–300 px" as the real constraint and flag the
  exact number as unresolved **[Q]**.
- Collapsed panels clip to a zero-width track and go `inert`; focus returns to
  the viewport (`EditorApp.svelte` focus-restore `$effect`; `EditorSidebar.svelte`
  `.panel.collapsed`). Focus mode is CSS-grid only — the canvas is never unmounted.

### Plan canvas **[S]**

`CompiledLayoutGeometry → PlanRenderModel → PlanSvg.svelte` is the only Plan
path. **[C]** The canvas chrome (`layout/PlanCanvasChrome.svelte`) draws:

- X/Z **rulers labelled in meters** (22 px strip),
- a **segmented scale bar** with meter labels,
- a corner **X/Z axis key**,
- the grid (major/minor), toggleable.

Empty plan shows a dashed ghost blueprint: `DRAW YOUR FIRST ROOM` /
`Use Rectangle Room or Polygon Room in the toolbar above ↑` / `10.0m × 8.0m`
(`layout/PlanEmptyGhost.svelte`). Note the copy does **not** mention the Wall
tool and uses "Rectangle Room / Polygon Room" while the toolbar labels are
"Rect Room / Poly Room" — a real current-state wording gap for P23.13 **[S][Q]**.

Pan/zoom: middle-drag pan, scroll zoom, Shift angle snap (status bar hints).

### Navigator / Hierarchy and search **[S]**

Mounted for the **Scene** domain only, in the left rail
(`EditorSidebar.svelte` → `UnifiedProjectTree.svelte` → `HierarchyNavigator.svelte`
for canonical wall-first documents; the Camera domain mounts `CameraSidebar`
instead — there is no Navigator in Camera).

Structure, top to bottom:

```text
[← Back]  <page title>                       page navigation + bounded back stack
[ Search Rooms, Walls, Openings… ]           global projection over documents
[ Walls ▾ extra filter ]                     page-local dropdown (Walls / Openings)
rows…                                        tree with disclosure
[pinned selection strip]                     only when the selection is not represented
```

Root page rows (`hierarchy/hierarchy-page-projection.ts`):

```text
Rooms                       <n>
ARCHITECTURE                        ← eyebrow heading, not focusable
Walls                       <n>
Openings                    <n>
Junctions                   <n>
PLACED CONTENT                      ← eyebrow heading
Layout Objects              <n>
Scene Content               <n>
```

Every row is a one-click page. Page/local-model facts worth carrying into design
work:

- **Opening** *home* is under its host Wall on the Walls page; the global
  Openings page is an index (`on W044` secondary line + `Show in Walls ›`).
- **Room** page = Room title · `Boundary (n walls)` in authoritative boundary
  order — always open, rows show `also in <Room>` participation · collapsed
  `Boundary Junctions (n)` · collapsed `Assigned Layout Objects (n)` (with the
  `(0)` state kept visible).
- Expanding a Room Wall row shows its hosted Openings **and one non-selectable
  relation row `Ends <junction> · <junction>`** (`hierarchyEndsRow`,
  `hierarchy-page-projection.ts` ~494). This is the density problem P23.14 owns —
  see §4.
- **Search** is bounded: direct match → directly related (one explicit hop) →
  dependents nested only (hosted Openings, `Ends`) → topology summarized as a
  count (`Boundary Junctions (6) [Show]`) → stop. It indexes authored names,
  display labels and **raw canonical IDs**.
- **Reveal**: selecting on Plan reveals the row when the current projection
  represents it; otherwise a neutral bottom-pinned strip appears —
  `Selected W092` / `Not in Gallery A` / `Show in Walls ›`. Opening a page never
  selects; Back never selects; collapsed ancestors auto-disclose for a reveal.
- **Emphasis bridge**: hovering/focusing a row highlights the entity on Plan
  using Plan's existing hover vocabulary — never a second renderer or a selection
  (`hierarchy/hierarchy-plan-bridge.ts`).

Navigator state (page, query, filters, disclosure, scroll, back, transient
emphasis) is **UI-only coordination state** — it never selects, never mutates a
document, never writes history (`app/hierarchy-navigator-state.svelte.ts`). **[C]**

### Inspector **[S]**

One right-side `Inspector` (`EditorInspector.svelte`). In the Layout domain it
renders, in order:

1. A summary `dl`: Project · Source · Status · Rooms · Objects · Issues.
2. **Place** accordion (Scene Plan Layout only): Door, Window, Box, Cylinder,
   Sphere, Column, Platform, Plinth — with wall-first vs legacy gating.
3. **Objects** accordion: a flat document list of Layout objects with inline
   Delete (this is the one document-wide inventory left in the Inspector).
4. **Topology diagnostics** accordion, rendered **only when issues > 0**:
   issue rows select their source entity on Plan; the copy states nothing
   auto-repairs.
5. **Selection** accordion: exactly the **one** selected entity editor — Layout
   object / Wall / Junction / Opening / Room.
6. A `Geometry warnings` alert list (`role="alert"`) when issues exist.

The Inspector is deliberately **not** a document browser: the former
document-wide "Architecture · exact" inventory was removed (P23.6b) because it
competed with the Navigator.

### Toolbar, context menus, status **[S]**

- Build tools live in the **Workspace Ribbon (Row 2)**, not a floating toolbar:
  `[Layout|Arrange]` · `[Select | Wall | Rect Room | Poly Room | Door | Window |
  Column | Platform | Plinth]` · `[Snap 0.25m | Grid | Tour]` · contextual
  `Cancel` (`layout/LayoutDraftToolbar.svelte`, ribbon mode). `Snap` uses the
  0.25 m plan grid step (`LAYOUT_PLAN_GRID_STEP`).
- **One shared context-menu shell** (`context-menu/ContextMenu.svelte`): fixed
  position, viewport-clamped, closes on outside pointerdown, Escape, scroll,
  resize, blur, or after running an item. Wall-first targets expose only real
  commands — **omit, don't dummy** (`context-menu/plan-menu-items.ts`):
  - Wall → `Add junction here` / `Add bend point here` (only when the click
    resolved a real distance) / `Delete wall`
  - Room (wall-first) → `Remove room…` only; **no Rename item** (rename is
    Inspector-only)
  - Opening → `Delete opening`; Layout object → `Delete object`
- Disabled items carry a visible `reason` string *and* `title`
  (`ContextMenu.svelte`), e.g. "No Room-exclusive boundary wall".
- **Status bar** (24 px): `Scene • Plan` · selection summary · save state ·
  a workspace status string · pointer/zoom hints · `Grid on/off · Snap 0.25 m on/off
  · Metric (m)`. The hint row uses `--editor-text-disabled` — the known
  low-contrast hint problem owned by P23.14 (issue #34) **[S]**.
- Shortcut conventions: `⌘/Ctrl+Z` undo, `⌘/Ctrl+Shift+Z` / `Ctrl+Y` redo,
  `Delete`/`Backspace` delete, `W/E/R/T` gizmo modes, `\` focus mode,
  `Shift`-click additive selection (**Scene only**), `Escape` cancels drafts
  (`hooks/shortcuts.svelte.ts`).

---

## 3. Current visual and interaction vocabulary

### States **[S]**

Two invariant rules the design system names explicitly (§28A, §29 of
`docs/Design-specs/Design-specs.md`):

> **Hover must never look selected. Selection is blue.**

| State | Plan / layout treatment |
|---|---|
| Passive / context | muted or dashed `--editor-layout-box` / `--editor-plan-readonly`; Scene content appears only as passive footprints |
| Hover | `--editor-plan-hover-stroke` (#55a1ff) — thinner/softer than selection, no handles |
| Selected | `--editor-plan-selection` (#2f8cff) stroke/fill + only the handles the active mode allows |
| Invalid / refused | dedicated invalid tokens: `opening-drag-preview invalid`, `architecture-edit-intent invalid`, `primitive-ghost invalid` |
| Navigator row | hover `--editor-bg-control`; selected `--editor-bg-selected` + accent border; `aria-disabled` rows drop to 0.6 opacity |

Plan canvas is **paper in every theme**: `--editor-plan-*` tokens are never
overridden per theme, and selection there is the same blue in all seven themes
(`styles/tokens.css`). **[C]**

Existing state token vocabulary in `PlanSvg.svelte` / `plan-render-model.ts`
includes: `room-fill/-outline-selected`, `wall-line-selected`, `wall-line-hovered`,
`opening-line-selected/-hovered`, `scene-footprint-*`, `layout-object-selected`,
`interior-anchor-selected`, `vertex-handle-selected/-hovered`,
**`curve-control-hovered`**, selection/measure/scale labels, and the invalid
styles above.

### Direct Wall / Junction editing — landed (P23.10) **[S]**

Single-target Plan manipulation of canonical Junctions and straight Walls:

| Gesture | Result |
|---|---|
| Drag a **Junction handle** | Moves that Junction; connected Walls follow |
| Drag a **Wall body** | Rigid Wall move (both endpoint Junctions move) |
| Drag a **Wall endpoint handle** | The same Junction move — an endpoint handle *is* that Junction |
| Context menu **Add junction here** | Subdivides the Wall into two fragments + one new Junction (requires a resolved click distance) |

Numeric twins exist in the Inspector (X/Z, length, angle, "Add junction at
distance from start"). **Pointer and numeric paths converge on the same
canonical candidate, topology, Room reconciliation, Opening validation,
selection and history semantics** — one result or none. **[C]**

A **4 px** editor-wide drag threshold separates click from drag
(`interaction-constants.ts`). During a gesture the document is untouched: the
candidate is rendered as proposal geometry and validated **once, on release**.

### Curve editing — landed (P23.11) **[S]**

> **Roadmap/tracker mismatch:** `docs/plans/README.md:136,193` and
> `docs/hand-off/CURRENT.md` still say "P23.11 is next" / "review and merge
> PR #50". P23.11 is **merged on `main`** (PR #51, merge `9118696`,
> 2026-09-15); its own plan doc is marked "implemented / merge-ready". Read the
> P23.12–P23.16 content as still-remaining, and ignore the "P23.11 remains"
> statements.

Curved Walls are canonical: `LayoutWall.centerline` is `'line'` or a
`cubic-chain` of bend points plus control spans (`layout-wall-first-types.ts`).
The shipped vocabulary:

- Inspector: a **Curved wall** toggle (straight ⇄ cubic chain — the one explicit
  convert action), a **Bend points** count, per-bend-point exact **X (m) / Z (m)**
  numeric edits, **Remove bend point**, and **Add bend point at midpoint**.
  Removing the last bend point leaves a knot-less chain — still a curve, still
  the same shape; going straight is only ever the explicit toggle.
- Plan: interior **curve controls** render on the *selected* curved Wall and drag
  (`curve-control-move`).
- Plan **Bend command**: a *named command* bound to `⌘`-drag on macOS and
  `Alt`-drag elsewhere (`editor-command-intent.ts`) — dragging a Wall body past
  the 4 px threshold inserts a bend point at the grabbed arc distance.
- Context menu **Add bend point here** is the discoverable, no-keyboard twin of
  that gesture (same planner, only offered when a real distance resolved).
- A canonical cheap validation rejects an edit that could pass commit but fail
  mesh generation (the Issue #6 failure class); an invalid drag keeps following
  the pointer and renders refused, then commits nothing.
- One curve evaluator feeds Plan, 3D and visitor geometry; no consumer resamples.

**[Q]** Discoverability of the Bend modifier is an open design question: it is a
modifier-held pointer gesture with no on-canvas affordance beyond the context-menu
twin and the Inspector path.

### 3D wall rendering **[S] [P]**

Canonical Walls compile to standalone box meshes whose two ends are **exact
square miters**; connected Walls legitimately touch at shared Junctions
(`apps/editor/src/lib/layout/wall-mesh-builder.ts` ~207–217). The code comment
records that **"Junction-correct seams are proposed for P23.15."** Canonical
wall-first 3D Wall/Opening **picking and highlighting remain deferred** — the
standalone mesh must not enter room-keyed pick maps. **[D]**

### Labels **[S]**

- Room labels are drawn on Plan from the authored Room name, gated by legibility
  floors: face area ≥ 1 m², scale ≥ 6 px/m, and a **24 px screen-constant
  suppression radius** against higher-priority labels/markers (dimensions,
  selection feedback, diagnostics) and already-accepted Room labels; document
  order breaks ties. Junction handles are culled below 6 px/m
  (`layout/plan-overlays.ts`).
- **No Room area is shown on Plan today** — area/perimeter appear only in the
  selected Room Inspector (`Area 24.5 m² · perimeter …`). Area-in-Plan is P23.13
  scope **[P]**.
- Architecture labels outside Rooms are the raw canonical ID title-cased by
  `formatPlacementLabel()` (`editor-outliner.ts`), with the raw ID in the row
  `title`. Real examples: `Junction Chain 1`, `Wall Chain 1`, and the Wall
  relation row `Ends Junction Chain 1 · Junction Chain 2`.
- Scene Plan also draws an **`+15°` yaw feedback** label during a Room rotation
  gesture, and snap markers per winning snap family (junction / wall
  intersection ≈ 5 px, grid ≈ 3 px).

### Snapping, invalid feedback, affordances **[S]**

- Snap toggle is explicit in the ribbon and mirrors in the status bar; the plan
  grid step is **0.25 m**. Snap candidates follow the canonical snap-owner model
  (grid, Junction, Wall intersection, angle) with a screen-constant marker, and
  only a *honored* snap is reported as snapped.
- Invalid edits are surfaced three ways: on-canvas refused styling on the
  proposal geometry, a `role="status"` mutation message in the selected entity's
  Inspector block (`layoutPreview.lastMutationMessage`), and an Inspector
  `Topology diagnostics` accordion + `Geometry warnings` alert list for committed
  geometry the compiler flagged. Plan also draws a 6 px diagnostic circle marker
  at each flagged target, ranked above Room labels. Nothing auto-repairs.
- Disabled controls generally carry a `title` / inline reason rather than going
  silently inert (e.g. Room removal, preset tools on a legacy layout).

### Focus and accessibility conventions **[S]**

- One shared focus treatment: 1 px accent border + 2 px accent-soft ring
  (`styles/editor-shell.css`).
- Layout tablists (`Hierarchy | Assets`), the Navigator tree
  (`role="tree"`/`treeitem` + `aria-selected`/`aria-expanded`), the Inspector
  accordions (`aria-expanded`), ribbon segmented groups (`aria-pressed`) and the
  shared context menu (`role="menu"`/`menuitem`) are already semantic.
- **Known gaps owned by P23.14:** status-hint contrast (#34), axis tokens in
  number fields (#35), arrow-key navigation in the shared context menu (#38),
  editor tablist keyboard behavior (#39), Project Row popover coordination (#40),
  Document menu focus lifecycle (#41). **[P]**
- The viewport is `role="application"` + `tabindex="0"` and owns guarded editor
  shortcuts; `⌘/Ctrl+Z` etc. are documented only as shortcut conventions.

### Empty and dense states **[S]**

- **Empty:** Plan ghost blueprint (§2) — currently names Rect/Poly Room only;
  Navigator Rooms page empty text is "Draw a wall or room in Plan to begin";
  other pages fall back to "Nothing here yet"; a Room page with no renderable
  content reads "This room has no renderable content".
- **Dense:** Room names are suppressed by the 24 px rule; at low zoom Room
  labels and Junction handles disappear entirely (scale floors). The Navigator's
  dense case is the expanded Room Wall disclosure with its `Ends …` relation row.
- **Explicitly bounded:** there is no marquee; **Layout is single-target only**
  (multi-select is deferred, issue #28); and nothing is labelled by document
  order. (Scene 3D does support Shift-click additive placement/cluster
  selection — that is a different, already-shipped Scene capability.)

---

## 4. P23.12–P23.16 design pipeline

The roadmap (`docs/plans/2026-09-14-P23-remaining-roadmap-reconciliation.md`)
orders the remaining work so that **each later slice consumes earlier design
decisions instead of re-deciding them**:

```text
P23.11 (landed) → P23.12 identity → P23.13 Plan drafting finish
              → P23.14 editor shell & visual system foundation
              → P23.15 junction-correct 3D → P23.16 closeout gate
```

The reverse dependencies are the important part for a designer: **P23.12 defines
the identity vocabulary; P23.13 must not re-invent labels; P23.14 must not
re-invent references or entity headers; P23.15 shows the result in 3D; P23.16
accepts it.**

### P23.12 — Names and stable display identity **[P]**

**Outcome:** a creator can recognize and retrieve architecture without reading
raw internal IDs, while canonical identity is untouched.

**Starting facts from code:**

- Room naming is **already shipped and exposed**: `LayoutWallFirstRoom.name` is
  persisted, `planRoomMetadataUpdate` owns the mutation, and the selected Room
  Inspector renders an editable **Name** text field
  (`EditorInspector.svelte`, wall-first Room block).
- `LayoutWall`, `LayoutWallOpening` and `LayoutJunction` have **no `name` field**
  (`packages/layout-core/src/layout-wall-first-types.ts`).
- Wall-first Room context menus deliberately expose **no Rename** — the rename
  path is the Inspector field, not a menu (`context-menu/plan-menu-items.ts`).
- Navigator labels today: Room = authored name; Wall/Opening/Junction =
  `formatPlacementLabel(rawId)`; raw ID in the hover `title`.

**Planned direction:**

- One display-identity contract consumed by **Plan, Navigator, search and
  Inspector**.
- Rooms keep their existing authored name and their **existing** rename path.
- Walls and Openings gain **bounded optional authored names** (Layout metadata,
  one canonical metadata planner/adapter/transaction, editable Name field in the
  selected Wall/Opening Inspector block).
- **Junctions gain no authored names** in the P23 minimum — they receive stable
  compact **references** only.
- Unnamed entities use the compact reference as the primary label; raw canonical
  IDs stay available as secondary/debug detail; `name` (when present) is primary
  and the reference is the unambiguous secondary identity.
- Search indexes authored names, compact references **and** raw canonical IDs.

**Three things the designer must hold as design problems, not implementation
detail:**

1. **Authored name vs compact reference vs raw ID** is a three-tier identity
   vocabulary that has to read clearly in a ~240–300 px rail and in a
   one-line Inspector header. Which tier is visible where is a design decision
   **[Q]**.
2. **The compact-reference mechanism is not chosen yet.** The roadmap requires
   the future child plan to pick either persisted presentation metadata or a
   deterministic collision-safe derivative of canonical IDs, and states
   references are **never document-order ordinals**, are stable across reorder,
   deletion, insertion, split, Save/Load and Undo/Redo, and never change
   topology, selection identity or Scene/Camera. A `W044`-style shorthand does
   **not** exist in code today (`docs/plans/2026-09-13-P23.6e-…md` Gate 1
   recorded it as unavailable; `formatPlacementLabel` is the current fallback).
   **[Q]**
3. **Named / unnamed states** must both look intentional — especially for
   freshly split Wall fragments and for a Room whose name equals its reference.

**Rename ownership is a hard constraint:** exactly one rename authority per
entity kind — the existing Room metadata path, plus a new canonical
Wall/Opening metadata path. **No inline Navigator rename**, no second
context-menu mutation path. **[C]**

### P23.13 — Architectural Plan drafting finish **[P]**

**Outcome:** the 2D surface reads and behaves like a credible small architectural
plan rather than a debug visualisation of the wall engine.

Future design surface — record the decisions, do not make them here:

| Area | What must be decided later |
|---|---|
| Architectural wall grammar | thickness/joins/caps rendering, boundary-vs-partition distinction |
| Boundaries and joins | how corners, T-junctions and wall ends read at supported zooms |
| Door / Window symbols | legible neutral technical-plan symbols — **only** for authored semantics; never invent swing, handing, inward/outward direction or leaf type |
| Room labels | label + reference + derived area presentation |
| Dimensions | what is dimensioned, when, and how it stays quiet |
| Line weights | zoom-stable weights and handles |
| Handles | selection handles, endpoint/Junction handles, curve controls, drag affordances |
| Selection / hover / edit states | precedence among Room, Wall, Opening, Junction, curve control, Scene footprint, Arrange owner |
| Snap and invalid feedback | on-canvas snap and refusal language, diagnostic markers |
| Curve affordances | how a curved Wall, its bend points and the Bend command communicate themselves |
| Zoom / density / collision | label collision and suppression, empty and dense plans, representative-theme review |

**Constraints inherited from earlier work that P23.13 must not break:**

- The Plan path stays `CompiledLayoutGeometry → PlanRenderModel → SVG`; no
  SVG-owned geometry, topology or selection state. **[C]**
- All architecture labels consume the **P23.12 identity contract** rather than
  formatting raw IDs in the renderer. **[C]**
- Door/Window symbols derive only from authored Opening semantics. **[C]**
- Existing curve vocabulary (bend points, curve controls, Bend command) is the
  shape P23.13 polishes — it is not re-opened.
- Scene footprints stay passive in Layout mode; Camera Plan reuses architectural
  context without gaining Layout authority. **[C]**

**Deferred inside P23.13:** print sheets, scale bars as output, dimension chains,
annotation authoring, DXF/PDF export, construction-document standards,
Canvas/WebGL Plan, whole-app visual redesign. **[D]**

### P23.14 — Editor Shell & Visual System Foundation **[P]**

*(Re-scoped by owner review, 2026-09-17; formerly "Build shell, Navigator and Inspector
finish". The bounded work below is retained inside the larger outcome. The slice's own
context is [`P23.14-shell-design-context.md`](./P23.14-shell-design-context.md).)*

**Outcome:** establish one coherent, extensible editor-shell visual system and interaction
grammar — with a high enough ceiling that future P24, P26 and later capability can
normally enter through the same language without a new shell redesign — while the complete
Layout workflow stays coherent and keyboard-usable across toolbar, Navigator, Inspector,
context menus, status and Document controls. P23.14 owns the *visual operating system*: it
does not implement P24 multi-selection, material/light/environment or placement semantics,
P26 Section/Wall Elevation/Ceiling Focus or crop/reveal behavior, or P23.15's junction
geometry — it must leave each a path through the same grammar.

Planned UX/IA work (retained inside the larger scope):

- **Navigator density and disclosure hierarchy** — the final rail at its real
  width, with real names/references instead of raw-ID placeholders.
- **Selected entity headers** — one consistent selected-entity heading pattern.
- **Names / references** — the P23.12 identity contract applied in the rail,
  search results, plan labels and Inspector.
- **Inspector grouping** — property grouping, consistent enabled/disabled
  reasons, action vs destructive-action placement.
- **Context menus / popovers** — accessible, keyboard navigable, focus-restoring.
- **Status hints** — contrast/legibility (issue #34).
- **Keyboard / focus behavior** — tablists, tree navigation, popovers, Document
  and Project Row menus (issues #38, #39, #40, #41).
- Preserve the landed P23.6e navigator semantics: page, search, filter, reveal
  and Back state survive the polish.

**The `Ends <junction> · <junction>` density problem (explicit roadmap item).**
Today each expanded Room Wall row renders a non-selectable relation row whose
label is two formatted raw IDs (e.g. `Ends Junction Chain 1 · Junction Chain 2`),
which is noisy in a narrow rail. Roadmap direction:

> After P23.12 compact references land, evaluate the final rail at its canonical
> width with the **preferred default of removing that `Ends` row from normal Room
> Wall disclosures**. A Wall disclosure should normally show hosted Openings;
> `Boundary Junctions (n)` remains the Room-context Junction inventory and the
> global Junctions page remains the architecture-wide index. **Do not solve the
> density/affordance problem by making `Ends` another Junction-selection
> surface.** If final usability review retains the relation, it must use compact
> references and unmistakable non-entity metadata styling.

Designer reading: this is a *planned preferred default*, with the final call
inside P23.14 **[P]** — and the anti-goal (a second Junction-selection surface) is
**[C]**.

**Deferred inside P23.14:** later slices' *capabilities* and any architecture change —
not the shell presentation. Specifically: asset-library redesign, Camera sidebar
redesign, 3D control popovers, material authoring, auth or persistence changes,
multi-select *capability*, new editor-local entity truth, a topology tree that explodes
every Wall/Junction relationship, P24/P26 feature semantics, P23.15 junction geometry, and
speculative future view controls. The former "no wholesale shell redesign" non-goal is
**superseded** (owner review, 2026-09-17): P23.14 may substantially revise shell
presentation and interaction grammar while preserving the §5 architecture and ownership
contracts. **[D]**

### P23.15 — Junction-correct wall-first 3D **[P]**

Designer-relevant context only:

- Junction-aware Wall tessellation using canonical Junction identity for all and
  only the topology already accepted today, with a deterministic
  miter/bevel/bridge policy for mixed thickness/height and straight/curved
  tangents, and visible gap/overlap/degeneracy validation.
- **Expected Plan/3D visual agreement:** every Junction configuration the plan
  editor accepts should look credible and **gap-free** in 3D, Preview and the
  visitor output, with matching identities/geometry.
- The designer's role here is **visual acceptance**: judge joined Walls, not
  geometry policy. Which miter/bevel/bridge is right for a given angle is a
  rendering-policy decision owned by the slice — not by design.
- **Not** part of this slice: canonical 3D Wall/Opening picking or highlighting
  (still deferred post-P23), CSG, fused-manifold buildings, mesh editing,
  proximity welding, or expanding the valid topology set. Rendering never
  broadens what topology accepts. **[D]**

### P23.16 — Closeout **[P]**

Acceptance and defect-only integration across the complete authoring fixture:
create/draw, direct edit, curve edit, name/retrieve, Rooms/Openings,
duplicate/presets, Plan/3D, deterministic selection/history/Undo/Redo,
Save/Load/import/export, Preview, immutable Publish + cold visitor, legacy
internal-dependency smoke, route/bundle isolation, docs and tracker closeout.

Designer role: **final UX/visual QA** on the finished experience — report
defects, do not redesign or add features. New capability, new schema, topology or
renderer architecture, general legacy migration and broad accessibility sweeps
are all explicitly out of scope for this slice. **[D]**

---

## 5. Cross-slice design constraints (invariants for every slice)

These are not preferences. They are ratifiable invariants; a design that requires
breaking one needs an owner decision, not a design choice. **[C]**

1. **One canonical Layout selection and history path.** There is exactly one
   Layout selection slot and one shared, chronological, tagged history stack.
   Navigator state, pinned strips, hover emphasis and 3D are *presentations* of
   that slot — never parallel stores.
2. **Canonical IDs are the identity and connectivity authority.** Junction IDs
   alone define connectivity; nothing derives connection from coordinates.
3. **Display identity never replaces canonical identity.** Names, references and
   labels are presentation. They must never become identity, connectivity,
   selection keys or history keys, and must never depend on document order.
4. **Rooms stay persistent semantic regions.** A Room survives edits that keep
   its correspondence; it is never re-derived from scratch, never inferred from
   point-in-polygon fits, and Scene content is never placed into a Room page by
   inference.
5. **Scene/Camera content never moves implicitly with Layout edits.** Layout and
   Scene are separate documents; no Layout gesture may silently translate Scene
   or Camera truth.
6. **One Plan rendering and geometry pipeline.** `compileLayoutGeometry()` →
   `PlanRenderModel` → SVG. No second geometry compiler, no SVG-owned state, no
   consumer-local resampling.
7. **The Navigator is UI state, not document authority.** It never selects,
   mutates, dirties, or records history; it must keep working from canonical
   documents + active selection alone.
8. **Visitor/editor isolation is absolute.** `/museum` and `/p/:publicationId`
   must stay visitor-safe; editor-only hierarchy, selection, history and gizmo
   code must never enter visitor chunks.
9. **No competing mutation surfaces.** One action surface per command, with
   omit-don't-dummy on optional commands. Rename has exactly one authority per
   entity kind; delete has one authority per entity kind.
10. **Deterministic Undo/Redo.** Every durable intent is one transaction
    producing exactly one Layout history result or none, restoring exact
    identities and coordinates. A rejected edit installs nothing.
11. **Current shell/domain/view ownership holds.** `Scene | Camera` and
    `Plan | 3D` stay the canonical axes; `Layout | Arrange` stays a Scene-Plan
    local mode; Camera Plan stays a camera-graph surface; the Inspector is not a
    document inventory; there is no second nav graph or motion authority. There is
    **one selection authority** — Layout stays single-target, and future Scene staging
    may hold an ordered set with one primary entity, but no second selection truth.

---

## 6. Deferred scope — do not solve these inside P23

Listed so the designer can confidently *ignore* them while working on P23.12–P23.14.
**[D]**

- Multi-select, marquee selection, selection sets (issue #28) — post-P23.
- BIM / storey / site / building hierarchy, floors as user-facing levels.
- Tags, taxonomy, classification, aliases across documents, localization.
- Inline Navigator rename (a competing mutation authority).
- Authored Junction names (Junctions stay reference-only).
- General CAD annotation and print tooling: dimensions authoring, print sheets,
  scale output, DXF/PDF export, construction documents.
- **Product/domain architecture** redesign, document-ownership change, or a second
  selection/history/navigation/camera authority — as distinct from **shell presentation and
  interaction grammar**, which P23.14 now owns (re-scoped 2026-09-17).
- 3D Wall/Opening picking and highlighting; 3D utility popovers (issues #32, #36).
- Material authoring / the Material Choice dialog lifecycle (issue #37, P24).
- New topology behavior: general curve intersection/noding, NURBS, constraint
  solving/constraint networks, offset/trim/fillet, automatic repair, Room-owned
  vertices, stairs/railings/roofs and other parametric depth.
- Canonical 3D picking, asset-library redesign, Camera sidebar redesign.
- Retiring the legacy Room-owned Layout stack (issue #26) — smoke only in P23.

---

## 7. Future brief contract (how later slice briefs use this file)

For every subsequent brief (start with P23.12):

1. **Treat this file as the persistent baseline.** Do not restate the product,
   workspace model, shell structure or vocabulary. Link to this file instead.
2. **Report only what changed** in code/product since this baseline. A short
   "deltas since P23-design-context" list is enough — do not re-derive state.
3. **Name any stale assumption you relied on.** If a claim here no longer matches
   the tree, say so explicitly and cite the file/component that changed it, the
   same way §2 and §3 flag the tracker/navigator mismatches.
4. **Provide slice-specific current-state evidence:** screenshots or explicit
   current states for the surfaces that slice touches (Plan states, Navigator
   rail at real width, Inspector block, 3D join, empty/dense variants). Designers
   should not have to re-inspect the app to understand the starting point.
5. **List only the design decisions that slice needs**, as a bounded question set
   with what is already fixed beside each one. Do not re-open settled invariants
   from §5.
6. **Keep the D/S/C/P/Q tags.** A slice brief that mixes "shipped" with "planned"
   without tagging it produces the exact confusion the roadmap mismatch in §2
   demonstrates.
7. **Do not repeat the full product context.** If a slice brief needs a second
   page of product explanation, the missing context belongs in *this* file —
   update this file and note the change.

---

## Appendix A — current-state evidence index

| Concern | Primary source |
|---|---|
| Shell grid, rows, rail widths, collapse | `apps/editor/src/lib/editor/app/EditorApp.svelte`; `app/ProjectRow.svelte`; `app/WorkspaceRibbon.svelte`; `app/StatusBar.svelte`; `styles/tokens.css` (`.project-editor`) |
| Design tokens, themes, Plan paper | `styles/tokens.css`; `styles/plan.css` |
| Plan canvas chrome, ghost, labels, snap markers | `layout/PlanCanvasChrome.svelte`; `layout/PlanEmptyGhost.svelte`; `layout/plan-overlays.ts`; `lib/layout/plan-render-model.ts` |
| Build toolbar / tools / gating | `layout/LayoutDraftToolbar.svelte` |
| Direct edit gestures (Junction/Wall/curve/bend) | `layout/LayoutPlanViewport.svelte`; `layout/layout-interaction.ts`; `editor-command-intent.ts`; `interaction-constants.ts` |
| Context menus | `context-menu/ContextMenu.svelte`; `context-menu/plan-menu-items.ts` |
| Inspector sections and entity editors | `EditorInspector.svelte` |
| Navigator page/search/reveal/pin | `hierarchy/HierarchyNavigator.svelte`; `hierarchy/hierarchy-page-projection.ts`; `hierarchy/hierarchy-search.ts`; `app/hierarchy-navigator-state.svelte.ts`; `hierarchy/hierarchy-plan-bridge.ts` |
| Labels for non-Room entities | `editor-outliner.ts` (`formatPlacementLabel`) |
| Canonical Layout types (names, centerline) | `packages/layout-core/src/layout-wall-first-types.ts` |
| 3D wall meshing / junction seams | `apps/editor/src/lib/layout/wall-mesh-builder.ts` |
| Product direction / phases | `docs/north-star.md` |
| Ownership table | `docs/architecture.md` |
| Visual system | `docs/Design-specs/Design-specs.md` (§7 colors, §9 plan, §15 shell, §28A/§29 selection, §35 status); `docs/Design-specs/Shell-scene-workspaces.md` §6 |
| Remaining P23 scope | `docs/plans/2026-09-14-P23-remaining-roadmap-reconciliation.md` |

## Appendix B — roadmap vs code mismatches to carry forward

| # | Document says | Code says | Effect on design work |
|---|---|---|---|
| 1 | `docs/plans/README.md:136,193` and `docs/hand-off/CURRENT.md` — P23.11 is next; PR #50 awaiting review | P23.11 merged on `main` (PR #51, `9118696`, 2026-09-15); `LayoutWall.centerline` + curve UX shipped | Treat curve editing as **shipped**; P23.12–P23.16 as remaining |
| 2 | `plans/P23.6e-directive.md` — "canonical **268 px** Navigator rail" (the roadmap's own figure was corrected to 240–300 px on 2026-09-17) | No `268` in code; left rail is `minmax(15rem, 300px)`, i.e. 240–300 px | Design to ~240–300 px, including the 240 px minimum |
| 3 | `components/shell.md` header — "pre-P21 stacked scaffold + `EditorAppBar` remains in the tree" | The P21+ shell is the live one: `ProjectRow` + `WorkspaceRibbon` + 24 px `StatusBar`, 36/32 px rows; `EditorAppBar.svelte` still exists but is not the mounted chrome | Use `EditorApp.svelte`/`ProjectRow`/`WorkspaceRibbon` as current-state truth; `shell.md`'s "current implementation" section is stale |
| 4 | `Shell-scene-workspaces.md` §6 "Room drag behavior" — Scene content follows a moved Room frame | Canonical wall-first Scene/Camera placement is **world-local**; the roadmap marks that prose as compatibility-path prose | Do not design Room drag as implicit Scene movement |
| 5 | `Design-specs.md` §15 — runtime tokens still carry `appbar 56px` / `status 32px` | `.project-editor` overrides to `36px` / `24px` (Row 1 36 + Row 2 32 = 68 top chrome) | Use the 36/32/24 shell metrics from `tokens.css`, not §15's values |
| 6 | Plan empty-state copy — "Use Rectangle Room or Polygon Room…" and toolbar labels "Rect Room / Poly Room" | Same screen, two different names; the Wall tool is not mentioned | P23.13 owns empty-state copy and naming consistency |
