# Shell and workspaces

**Read when:** app chrome, Scene/Camera switch, Layout mode, top bar, timeline frame, project menu.  
**Last reviewed:** 2026-09-17 (P21 shell landed — `ProjectRow` + `WorkspaceRibbon` own the top chrome in `EditorApp.svelte`; `EditorAppBar` remains in the frozen relic only)

**Current implementation status:** P21 shell chrome has landed (`ProjectRow` + `WorkspaceRibbon`). The pre-P21 section map below is retained until a P23 pass reconciles it.
**P21 target:** [`../design-system/design-plan-p21.md`](../design-system/design-plan-p21.md)
— target authority for product entry (`/`), Project Hub (`/projects`), Project
Shell chrome, Row 1 / Row 2 placement, persistence/account presentation, and
project-level Visitor Preview.

Everything below the pre-P21 header describes the pre-P21 tree unless explicitly marked as P21+ target.

---

## Current implementation — pre-P21

```text
┌─────────────────────────────────────────────────────────────┐
│ Top bar — Scene|Camera · Plan|3D · Undo/Redo · Project      │
├──────────┬──────────────────────────────┬───────────────────┤
│ Left     │  3D viewport + tools         │ Inspector         │
├──────────┴──────────────────────────────┴───────────────────┤
│ Camera timeline — mounted in Camera domain only             │
├─────────────────────────────────────────────────────────────┤
│ Status — workspace · selection · save · hints · grid/snap   │
└─────────────────────────────────────────────────────────────┘
```

The shell is a domain×view matrix over **one shared `Plan | 3D` view axis**
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
viewport; workspace actions stay in the contextual viewport toolbar except
for the Camera Plan toolbar (P1.5), which owns Select/View, Add Camera,
Connect, and Grid/Snap.

**Camera → Plan (P1.5)** mounts over the architectural backdrop with its own
contextual toolbar (Select/View, Add Camera, Connect, Grid/Snap); the Plan
inspector becomes workspace-specific — world X/Z, flow order, per-direction
connection timing with Forward/Reverse + authored/automatic switching — while
Scene → Plan keeps its read-only gate for preserved scene/camera selections.
Behavior (gestures, hit priority, backdrop authority, timing authoring,
history rules) is canonical in [`camera-tour.md`](./camera-tour.md).

| Workspace | Preview |
|-----------|---------|
| Scene | Preview Scene → `/museum` (pre-P21 temporary) |
| Camera | Preview Camera → in-editor selected-camera view; Preview Edge and Preview Sequence remain contextual scopes |

> **Pre-P21 note:** `Preview Scene → /museum` is temporary pre-P21 behavior,
> not canonical target. The P21+ target is the project-level Visitor Preview
> takeover (`/project/:id/preview`) per
> [`design-plan-p21.md`](../design-system/design-plan-p21.md) §I.

Project menu: scene Import/Paste/Copy/Download/Reset + separate Layout JSON Import/Paste/Copy/Download/Reset section. Layout status + invalid-import feedback appear in menu, sidebar, inspector. Scene + layout replacement confirmations document-scoped; editor navigation + browser unload protect either dirty document. Undo/Redo enabled in Layout, shares one chronological stack with tagged scene/layout entries. Top-bar scene dirty badge scene-scoped. **No** automatic git Save.

Layout workspace chrome: viewport toolbar has Plan/3D, Select, Rect room, Polygon room, Plan Snap/Grid or 3D Ceiling controls. Plan Select room bodies move complete room units; selected rooms expose centroid rotation arm + Shift 15° snap. Right sidebar keeps layout status/counts visible, presents Place, Objects, Selection accordion sections; accordion state session-only. Room inspector rotation applies relative degrees, resets to zero.

Timeline: collapsed `48px`; default expanded `288px`, user range `240–300px`.
Expansion state persists verbatim and never auto-expands on a domain switch.
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

## P21+ target

Summary of the ratified target (full detail in
[`design-plan-p21.md`](../design-system/design-plan-p21.md)):

```text
36px Project Row (Row 1)
+ 32px Workspace Ribbon (Row 2)
= 68px total persistent top chrome
status bar 24px
no permanent floating viewport toolbar
project-level Visitor Preview
```

- Row 1 hosts project identity, persistence, project navigation, the Undo/Redo
  slot, Visitor Preview, and account; Row 2 hosts `Scene | Camera`,
  `Plan | 3D`, and the active workspace's contextual authoring tools.
- The current floating/contextual toolbars relocate into Row 2; viewports keep
  only direct-manipulation fixtures.
- Undo/Redo in Row 1 binds the existing chronological tagged Scene/Layout
  history stack for Spatial; non-Spatial surfaces defer or disable the slot
  rather than sharing one universal cross-workspace undo.
- `Preview Scene → /museum` is a temporary pre-P21 behavior and is **not** the
  canonical target.

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
