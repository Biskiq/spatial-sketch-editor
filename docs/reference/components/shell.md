# Shell and workspaces

**Read when:** app chrome, Scene/Camera switch, Layout mode, top bar, timeline frame, project menu.  
**Last reviewed:** 2026-09-19 (P23.14 — the shell is the PLATE reference
composition: Domain Spine · Project Head · View Bar · Tool Tray over
Navigator | work column | Inspector, Camera Drawer owning the central column,
24 px Status Rail, PLATE Light default)

**Current implementation status:** landed. P21 introduced the Project
Head/ribbon split; P23.14 (`../roadmap/p23-layout-depth/p23.14-shell-visual-system/`)
recomposed it into the composition below and retired the pre-P21 section map and
the pre-P21 `Preview Scene → /museum` row this file used to carry.

**Authority (2026-09-19, owner-ratified):** the durable shell design authority is
[`editor-shell-and-visual-system.md`](../../reference/design-system/editor-shell-and-visual-system.md),
now carrying ratifications **R1** (Tool Tray tier), **R2** (armed tool) and **R3**
(closed type ladder, semantic roles, `--editor-type-scale` /
`--editor-control-scale`), the View Bar `MODE`-as-caption grammar and the four
distinct surface states. This file is **descriptive** of that composition and stays
canonical for **capability, ownership and exposure**. Read the direction first for
any shell composition, material, type, control or state question; do not take a
shell value from a component's scoped CSS.

---

## Current implementation — PLATE composition (P23.14, landed)

```text
┌──────┬───────────────────────────────────────────────────────────────┐
│      │ PROJECT HEAD · 36 px                                          │
│ D    │ identity · persistence · project nav · undo/redo ·            │
│ o    │ Visitor Preview · theme · account · Document menu             │
│ m    ├───────────────────────────────────────────────────────────────┤
│ a    │ VIEW BAR · 34 px                                              │
│ i    │ Plan|3D tabs · MODE caption (Scene Plan) · utilities · precision  │
│ n    ├────────┬──────┬────────────────────────────┬──────────────────┤
│ S    │NAVIG.  │ TRAY │ work column                │ INSPECTOR        │
│ p    │ 268 px │ 44px │ Plan or 3D canvas          │ 300 px           │
│ i    │240–300 │      │ Camera Drawer owns this    │ 280–420          │
│ n    │        │      │ column's bottom edge only  │                  │
│ e    ├────────┴──────┴────────────────────────────┴──────────────────┤
│ 56px │ STATUS RAIL · 24 px                                           │
└──────┴───────────────────────────────────────────────────────────────┘
```

- **Domain Spine (56 px, full height)** is the domain axis: `Scene | Camera`.
  A domain switch is a switch, never a separate application or a peer view.
- **Project Head (36 px)** carries project identity + inline rename, the
  persistence cluster and save state, project navigation, the history slot,
  Visitor Preview, the Document menu, and the theme/account popovers. It never
  carries workspace manipulation commands.
- **View Bar (34 px)** carries the `Plan | 3D` view switch plus the current
  workspace's utility and precision controls; it replaced the retired 32 px
  ribbon band. It is not a second global toolbar. The view tabs are engraved and
  must not read as ordinary tool buttons; Scene Plan adds the `MODE   Layout |
  Arrange` **caption** grammar (`MODE` is a quiet non-interactive label, not a
  third segment — no fill, border, radius or padding around the three); utilities
  sit at the 10 px utility tier, the mode pair at 11 px on the 24 px control role,
  tool groups are separated by space alone, and a pressed control takes a
  recessed surface + edge border + inset bottom rule (never a translucent wash).
  All of those values come from the R3 roles (`editor-shell-and-visual-system.md` §7/§10/§18).
- **Tool Tray (44 px)** is a Paper-attached vertical instrument rail holding the
  current surface's tool vocabulary — not a second sidebar. Each workspace
  mounts one (Scene Plan drafting, Camera Plan, Scene 3D, camera utilities). Its
  engraved labels are the rail's own micro-tier (7 px group / 8 px tool, 6 px
  compact floor for a word wider than the rail) and an armed tool is a
  **darkened surface** — no border, no inboard edge (P23.14 ratifications R1/R2,
  [`editor-shell-ratifications.md`](../../reference/design-system/editor-shell-ratifications.md)).
  That durable contract (`reference/design-system/editor-shell-and-visual-system.md`) plus its
  Atlas are the shell design authority; this file is descriptive of it and canonical for
  capability, ownership and exposure.
- **Navigator (268 px, 240–300)** owns the domain's structure/assets;
  **Inspector (300 px, 280–420)** owns the selection's properties.
- **Camera Drawer** spans the central work column only: collapsed `48px`
  transport/readout strip (no scrubber, no lanes), expanded `288px`; it never
  opens over the Navigator or the Inspector, and never auto-expands on a domain
  switch.
- **Status Rail (24 px)** stays informational: workspace, selection, save state,
  navigation hints, grid/snap. Precision belongs near the gesture; the rail
  never carries all of it. It paints the 10 px status role with 12 px side padding
  and ≈ 20 px gaps, and its ink is the readable secondary tier — quietness comes
  from weight and size, never from under-contrast muted ink.
- Theme default is **PLATE Light** (`theme.svelte.ts`; boot allowlist in
  `app.html`). The dark relic theme remains available, not default.

Domain × view behaviour is unchanged and canonical: the shell is a
domain×view matrix over **one shared `Plan | 3D` view axis**
(P1.7): `Scene | Camera` switches domain; a `Plan | 3D` switch applies to
both domains; a domain switch never snaps the view (boot: Scene → Plan).
Domain changes are attention-only (not document/history/world); view changes
never change domain. Camera owns the same timeline state in Plan and 3D.

Viewport focus mode (P21.6 Slice C): independent left/right session booleans
plus a derived focus flag collapse the shell grid toward `0 1fr 0` — CSS
only, the canvas is never unmounted. Collapsed panels clip and go `inert`
with focus restored to the viewport; Row 2 Zone C, the View menu
(`Focus 3D (\)`), and the `\` shortcut drive it (relic excluded). Collapse
requests during a pointer-down gesture defer to one coalesced pending config
applied after commit/cancel + capture release; external resizes cancel the
gesture instead. Framing stays observer-relative: vertical FOV authored,
far-plane width derives from live viewport aspect.

Camera mounts the four-section `CameraSidebar` (Environment · Sequence
Inspector · Unsequenced · Connections). Environment is read-only. Per-camera
chevrons expose a component-local flat accordion of directly connected
Unsequenced sidequests; ordered Sequence neighbors are omitted, and there is
no standalone Neighbors section. Reorder remains drag-only. Scene 3D owns
`Hierarchy | Assets`. Scene-only tabs, Assets, and
Add Room never appear in Camera. No empty Camera rail mounts over the
viewport; workspace tools live in the workspace's Tool Tray, including the
Camera Plan set (P1.5): Select/View, Add Camera, Connect, and Grid/Snap.

**Camera → Plan (P1.5)** mounts over the architectural backdrop with its own
contextual toolbar (Select/View, Add Camera, Connect, Grid/Snap); the Plan
inspector becomes workspace-specific — world X/Z, flow order, per-direction
connection timing with Forward/Reverse + authored/automatic switching — while
Scene → Plan keeps its read-only gate for preserved scene/camera selections.
Behavior (gestures, hit priority, backdrop authority, timing authoring,
history rules) is canonical in [`camera-tour.md`](./camera-tour.md).

| Workspace | Preview |
|-----------|---------|
| Scene | Project-level Visitor Preview takeover (Project Head `Preview`), per [`design-plan-p21.md`](../design-system/design-plan-p21.md) §I |
| Camera | Preview Camera → in-editor selected-camera view; Preview Edge and Preview Sequence remain contextual scopes |

Project menu: scene Import/Paste/Copy/Download/Reset + separate Layout JSON Import/Paste/Copy/Download/Reset section. Layout status + invalid-import feedback appear in menu, sidebar, inspector. Scene + layout replacement confirmations document-scoped; editor navigation + browser unload protect either dirty document. Undo/Redo enabled in Layout, shares one chronological stack with tagged scene/layout entries. Top-bar scene dirty badge scene-scoped. **No** automatic git Save.

Layout workspace chrome: the View Bar and the Plan Tool Tray expose Plan/3D, Select, Rect room, Polygon room, Plan Snap/Grid or 3D Ceiling controls. Plan Select room bodies move complete room units; selected rooms expose centroid rotation arm + Shift 15° snap. Right sidebar keeps layout status/counts visible, presents Place, Objects, Selection accordion sections; accordion state session-only. Room inspector rotation applies relative degrees, resets to zero.

Timeline (Camera Drawer, central work column only): collapsed `48px`;
default expanded `288px`, user range `240–300px`. Expansion state persists
verbatim and never auto-expands on a domain switch.
Display lanes: Camera Path · Shots · FOV · Look At · Roll. These project the
current two backing models (Guided Route + Camera Framing); P3 adds no new
Shots/Roll entities or independent raw curves. Expanded main-editor chrome has
a fixed `36px` header; collapsed chrome is an integrated `48px` temporal
mini-player. Expanded scrubbing belongs to the ruler/five-lane playhead surface,
not a second playback bar. Main-editor controls are Previous/Next camera-node
boundary, Play/Pause, POV/Observer, and Center/Follow; `+ View Key` appears only
for 3D Sequence. Scope changes are explicit, selection-only by default, and
main-editor Repeat/loop/distinct Replay controls do not exist.

Status bar is persistent and informational. Its save state aggregates scene
and layout dirtiness; Plan reads Plan grid/snap state and Plan navigation
hints, while 3D reads 3D grid/transform-snap state and 3D navigation hints.

---

## P21 landing record

[`design-plan-p21.md`](../design-system/design-plan-p21.md) is frozen at the
P21 shape (`Project Row` + `Workspace Ribbon`, `ProjectRow` +
`WorkspaceRibbon` in `EditorApp.svelte`); P23.14 supersedes its **placement**
only. Where the two disagree, this file wins:

- Row 1 (Project Head) hosted the Undo/Redo slot, preview and account; Row 2
  hosted `Scene | Camera`, `Plan | 3D` and the contextual authoring tools.
  The domain axis moved to the **Domain Spine** in P23.14 (P21's Row 2
  `Scene | Camera` track is retired), and the authoring tools moved to the
  **Tool Tray**.
- Undo/Redo in the Project Head binds the existing chronological tagged
  Scene/Layout history stack for Spatial; non-Spatial surfaces defer or disable
  the slot rather than sharing one universal cross-workspace undo.
- `Preview Scene → /museum` was a temporary pre-P21 behaviour and is retired —
  Scene preview is the project-level Visitor Preview takeover.

## Display identity (P23.12, landed)

Every Room, Wall, Opening and Junction has a stable, document-unique compact
reference. Rooms retain required names; Walls and Openings support optional
names; Junctions remain reference-only.

- Named entities lead with their name and retain a readable reference. Unnamed
  entities lead with the reference. Kind and relationships remain separate
  context. Raw canonical IDs appear in accessible, copyable Technical details
  and relevant search-match explanations.
- References use R/W/O/J families, occupy at most six characters, never
  truncate, and encode no mutable properties or topology lineage. Existing
  references never change because of renaming, reordering, unrelated edits or
  property changes. New entities receive new references; retired references are
  not reassigned. History and persistence restore exact identities.
- Navigator, Inspector, search, existing Plan identity feedback and
  architecture-related messages consume one identity vocabulary. Names may
  truncate in compact surfaces; references may not. Search preserves
  name/reference/ID and kind/role retrieval. Rename remains Inspector-owned.
- No generated semantic fragment names; no lineage-looking suffixes such as
  `W-12.1`. No duplicate-name warnings or forced suffixes — references
  disambiguate.

Rationale, presentation detail and acceptance record:
`docs/archive/roadmap/p23/p23.12-final-design-contract.md`.

## Plan keyboard invariants (P23.13, landed)

- **Arrows never enter the control group** (A5: Enter enters, arrows traverse).
  `planTraversalStep` returns `null` outside the group; `planTraversalEnteredFor`
  requires keyboard entry — pointer focus also sets `planFocus`, so entry inferred
  from focus let clicks steal arrows/scrolling. Do not revert to roving-tabindex.
- **The keyboard readout is a keyboard instrument**: retired by Escape, mode/tool
  cancel, canvas-reaching primary press, or successful exact edit — never by
  pointer focus alone. Clear it, do not recompute per change (§9: one announcement
  per meaningful change). Known residue: Undo moving the focused control leaves
  stale coordinates (needs a history hook the viewport does not own).

Acceptance record:
`docs/archive/plans/2026-09-16-P23.13-architectural-plan-drafting-finish.md`.

## P22 deliverables (shipped 2026-09-08)

- Author surface: `/project/:projectId/publish` in the existing project
  session. Shows saved vs published version, revision-aware status, and one
  clear action (Publish saved version / Update / Copy link / Open published
  project / Unpublish). Dirty drafts block with Save-first; stale baselines
  block with a cloud-changed explanation and never auto-replace local work.
  Publish owns no selection and emits no scene/layout edits.
- Public route: `/p/:publicationId`, outside the project layout (no
  `ProjectShellHost`/`EditorApp`). Cold bootstrap keyed by public ID +
  release version; loading / ready / not-found / failed states; public chrome
  carries the released document `name`, zero-camera orbit help, keyboard
  navigation and reduced-motion behavior; no draft banner, no Exit-to-editor.
  Route load `$effect` disposes the prior bundle via `untrack` so assigning
  the loaded bundle never retriggers itself (regression-pinned).
