# R217.S26 — capability and gap inventory

**AUTHORITY: NONE.** Planning evidence for the approved S26–S30 plan. The [S25 harvest](../r217.s25-experience-shared-homes/design-harvest.md)
was the starting inventory. This file extends it to every Conservatory capability (OD2) and checks
each row against the domain at `f8da7eb0`. Slice scope lives in the [execution plan](./execution-plan.md).

**Domain column.**
**✔** exists and is wired in the editor.
**◐** exists in the domain or Camera but has no editor caller.
**✚** needs a new or widened planner or a derived read.
**⬣** needs the S27 format change.
**✕** out of scope (reason given).

**Reference column.** **C** Conservatory, **R2** Round 2 wireframe, **D** domain or contract only.

**Slices.** **S26** Structure and removal · **S27** Guided Views and visitor reach · **S28** Views on
the Stage · **S29** Camera paths · **S30** Timeline, playback and Preview.

## 1. Domain-operation ledger

### 1.1 Planners that exist (`createUnitCandidatePlanners`)

| Planner | Writes | Editor caller at S25 | Use in S26–S30 |
| --- | --- | --- | --- |
| `camera-view-update` | One Camera View's `label`, `eye`, `target`, `fov` | **none** | View rename (S26); move, aim, Lens and Eye steps, Update View (S28) |
| `experience-create` | One empty Experience | New Experience | — |
| `experience-capture-bind` | Camera View + Presentation (+ optional Stop, or first Guide with Stop) | Capture, Present this, first Guide | Place a View into a new Presentation; framed Present this (S28) |
| `experience-guide-create` | First Guide + initial Stop; sets `entryGuideId` | First Guide door | Widened to any Guide (S26) |
| `experience-stop-create` | A Stop inserted after a Stop in one Guide | + Stop, Add to Guide, Index drag | Target Guide chosen when several exist (S26) |
| `experience-guide-order` | A permutation of one Guide's `stopIds`; `entryStopId` untouched | Drag, bar drop, Alt ←/→, `•••` | — |
| `experience-presentation-update` | `label`, `text`, `subject`, captured `view` (appended, becomes Default unless `defaultViewId` is sent), `defaultViewId` | Rename, Information text, Capture into, Make default | `viewIds` permutation (S26); free-exploration flag (S27); Place a View into a visible Presentation (S28) |
| `experience-stop-update` | `entryViewId`, `holdSeconds`, `continuation` (with Cut/Travel) | Enter at…, Hold, After this Stop, Cut/Travel | Rewritten over the guided-View sequence (S27) |

### 1.2 Operations that are missing

| Operation (proposed name) | Why it is needed | Domain | Slice |
| --- | --- | --- | --- |
| `experience-update` {`label`, `entryGuideId`, welcome `text`} | Experience rename; the Opening Guide; the Preview welcome text | ✚ (text ⬣) | S26 (text S27) |
| `experience-guide-update` {`label`, `entryStopId`} | Guide rename; where a Guide starts (the domain keeps entry separate from order) | ✚ | S26 |
| `experience-guide-create` without the `guide-exists` refusal | Additional Guides. Validation already admits several Guides and a Stop ordered by more than one | ✚ (lift a refusal) | S26 |
| `experience-presentation-update` + `viewIds` permutation | Reorder a Presentation's Views. `viewIds` is already ordered display order | ✚ | S26 |
| `experience-stop-remove`, `experience-presentation-view-remove` (+ Camera), `experience-presentation-remove` (+ Camera), `experience-guide-remove` | Removal with consequences ([E4](./owner-decisions.md#e4)) | ✚ | S26 |
| **Stop guided-View sequence**: ordered Views, per-View hold and step Cut/Travel; Include, leave out, reorder | Conservatory's shot list ([E3](./owner-decisions.md#e3)) | ⬣ Experience format, `ExecutionProgram`, lowering, interpreter, visitor runtime | S27 |
| Presentation **free-exploration flag** | *Open in free exploration* ([E15](./owner-decisions.md#e15)) | ⬣ + visitor reach | S27 |
| `camera-connection-create` | Make a Travel supported. **No planner creates a connection today, so every Travel in an editor-authored project is a gap** | ✚ | S29 |
| `camera-connection-update` {interior anchors, per-direction `timing.durationSeconds`} | Shape a path; set or clear Travel duration | ✚ | S29 |
| Route-versus-Wall read (`layout-core`) | *Crosses a wall* from the Layout representation, not the prototype's `inPoly` | ✚ (read) | S29 ([E12](./owner-decisions.md#e12)) |
| Guide time map (`camera-core`) | Seconds per guided View, step and Travel: Experience holds over Camera-evaluated durations | ✚ (read) | S30 |

Every new planner is operation-specific under `F4.intent-acceptance@1:unit-acceptance-v1`, declares its
domain (and `writes` for the compounds), allocates nothing itself and refuses strictly. The S27 format
change follows the no-versioning stance: a version bump, strict refusal, regenerated fixtures. Together
they are one request under [E2](./owner-decisions.md#e2).

## 2. Workflow inventory

### 2.1 Experience and Presentations

| Capability | Ref | Production at S25 | Domain | Slice |
| --- | --- | --- | --- | --- |
| New Experience from the crumb menu | C, R2 | Shipped | ✔ | — |
| Rename the Experience | C | — | ✚ | S26 |
| Empty Stage coach: *Start your experience* — choose Present this on an object, or Capture | C | Index empty states only | — | S28 |
| New Presentation from the current 3D standpoint (dock Capture) | C, R2, D1 | Shipped; refused in Plan | ✔ | — |
| New Presentation by placing a View in Plan | C | — | ✔ | S28 |
| **Present this** frames a first View on the subject | C, R2 | Captures the current 3D framing | ✔ + Bring into view | S28 ([E9](./owner-decisions.md#e9)) |
| Rename a Presentation; Information text in More | C | Shipped | ✔ | — |
| Views grid; dense grid past 8; filter, *On tour*, *Free* past 12 | C | Shipped | ✔ | — |
| **Reorder Views** (the free-exploration order): drag, Alt ←/→, refused while filtered | C | — | ✚ | S26 |
| *Visitors reach it*: Stop chips | C | Shipped | ✔ | — |
| **Open in free exploration** switch, *All n Views; opens at the Default* | C | — | ⬣ | S27 |
| Add to Guide in `•••`; choose the Guide or New Guide… | C, D8 | First and active Guide only | ✚ | S26 |
| **Remove Presentation** *and its n Stops* | C | — | ✚ | S26 |
| Index: two-line rows, search from 8, one open Presentation, +N more, tour dot or free ring | C | Shipped | ✔ | — |
| Drag a Presentation from the Index onto the Guide | C | Shipped | ✔ | — |
| World subject Card: *Already presented in* and the cross-lens link to the Presentation | C | Experience subject Card shipped; check the World side | ✔ | S26 (add if missing) |

### 2.2 Views

| Capability | Ref | Production at S25 | Domain | Slice |
| --- | --- | --- | --- | --- |
| Capture into the visible Presentation, Default kept | C, R2 | Shipped | ✔ | — |
| **View markers**: Plan dot, wedge, aim handle; 3D camera glyph; selected, strong, normal, dim, hidden | C, R2 | None (D13 removed World marks) | ✔ read | S28 |
| 3D labels: the selected View's name; the selected Stop's guided Views numbered | C | — | — | S28 |
| Select a View on Stage; never moves the Camera | C | — | ✔ | S28 |
| **Place a View**: press where the camera stands, drag toward what it sees | C, R2 | Disabled key | ✔ | S28 |
| **Move** (drag the dot) and **aim** (round handle) | C | — | ◐ | S28 |
| **Lens** and **Eye height** steps; hero tag *Normal · Standing* | C | Read-only facts | ◐ + `CAMERA_LENS_PRESETS` | S28 ([E7](./owner-decisions.md#e7)) |
| Rename a View (shared Views say where else) | C | — | ◐ | S26 |
| Make default (View Card only; Conservatory's menu copy ruled out by D12) | C, D12 | Shipped | ✔ | — |
| *Where visitors see it*: Stops and position (*entry*, *2nd view*); *Free exploration · opens here* or *Hidden from free exploration* | C | Stops shipped; reach line partial | ✔ + ⬣ | S27 |
| **Look through**: capture frame, pill, drag to re-aim, scroll to step, *moved*, Update View, Exit View back to the exact standpoint | C, R2 | Disabled | ◐ | S28 |
| Double-click a thumbnail or marker to Look through; Capture while looking through | R2 | — | ✔ | S28 |
| **Snapshots** in every slot | C, R2 | Placeholders (D4) | Render | S28 ([E10](./owner-decisions.md#e10)) |
| **Remove View** with consequences | C | — | ✚ | S26 |

### 2.3 Guides and Stops

| Capability | Ref | Production at S25 | Domain | Slice |
| --- | --- | --- | --- | --- |
| Open from the Index; dock key; × closes | C, D3 | Shipped | ✔ | — |
| First Guide, two doors, name inline | D8 | Shipped | ✔ | — |
| **Additional Guides** | C | Refused `guide-exists` | ✚ | S26 ([E5](./owner-decisions.md#e5)) |
| **Rename a Guide** | C | — | ✚ | S26 |
| **Opening Guide** | D | Read-only line | ✚ | S26 |
| **Start Stop** | D | Not shown | ✚ | S26 ([E6](./owner-decisions.md#e6)) |
| Insert, revisit (*again*), reorder (drag, bar drop, Alt ←/→, Move earlier, later, start, end) | C | Shipped | ✔ | — |
| **Remove Stop** (*Presentation stays*); **Remove Guide** | C | — | ✚ | S26 |
| Stop Card *Visits* block, ‹ ›, *again* | C | Shipped | ✔ | — |
| **Guided views** shot list: entry tag, per-View Hold, drag and Alt ↑/↓ to reorder, × to leave out, *Not in this Stop* with **Include**, folded past 4 | C | Entry View and hold only; *Include* disabled (D5) | ⬣ | S27 ([E3](./owner-decisions.md#e3)) |
| *Reordering here changes only this Stop*; the Default untouched | C | — | ⬣ | S27 |
| *After this Stop*: Next, a chosen Stop, End | C, D11 | Shipped | ✔ | — |
| Stop card: View count, Stop time and proportional per-View segments | C | Hold label only | ⬣ + time map | S27 (count), S30 (time, segments) |
| **Play from this Stop**; Guide Card **Play from the start** | C | Disabled | ✚ | S30 |
| Guide Card: two ways in, with counts and time; *Build the tour* | C | Shipped; time pending | ✔ | Time S30 |
| Long Guide: scroll to selection, bracket, narrow segments drop numbers; compact ⌄ | C | Shipped | ✔ | — |

### 2.4 Transitions and Camera paths

| Capability | Ref | Production at S25 | Domain | Slice |
| --- | --- | --- | --- | --- |
| Transition Card ends, Cut/Travel | C, D6, D11 | Shipped | ✔ | — |
| Travel gap named; red dashed connector | C | Shipped; always a gap | ✔ | — |
| **Add a Camera path**, between Stops and between guided Views | D | — | ✚ | S29 ([E11](./owner-decisions.md#e11)) |
| Paths on Stage while the Guide is open: selected gold, neighbours solid, the rest faint; Cut as a dotted CUT link; shown in 3D | C | — | ✔ read | S29 |
| **Path** tool; click the path to add a point; drag; select (gold) and Delete; **Straighten** | C, R2 | Disabled key | ✚ | S29 |
| Path facts: *3 points · 12.4 m* | C | — | ✔ read | S29 |
| *Crosses a wall* alert | C | — | ✚ | S29 ([E12](./owner-decisions.md#e12)) |
| *Also used by Stop 4 → 5* | C | — | ✔ | S29 |
| **Travel duration**: authored or *Auto* | C, R2 | Disabled | ✚ | S29 |
| Entry or exit View change: *Travel Stop 2 → 3 now joins different Views* | C | Gap shown | ✔ | S29 |
| Connector chips with seconds | C, R2 | No seconds (D9) | ✚ | S29 |
| **Preview this move** | C | Disabled | ✚ | S30 |

### 2.5 Timeline and playback

| Capability | Ref | Production at S25 | Domain | Slice |
| --- | --- | --- | --- | --- |
| **Time-scaled bar**: guided Views by hold, steps and Travel by Camera duration | C, R2 | Ordinal (D9) | ✚ | S30 |
| **Total** *0:00 / 0:41*; hold-less Stops as *waits* | C, R2 | None | ✚ | S30 ([E13](./owner-decisions.md#e13)) |
| **Play/Pause**, Space; **scrub**; playhead; glow and fill | C, R2 | Disabled | ✚ | S30 |
| **Camera rig** puck on Stage | C, R2 | — | ✔ | S30 |
| **Follow camera** with its pill; off or Esc returns | C, R2 | Disabled | ✔ | S30 |
| Editing stops the clock; playback writes nothing | PLATE | — | — | S30 |
| Reduced motion | D | Visitor only | ✔ | S30 |

### 2.6 Stage, Card and navigation

| Capability | Ref | Production at S25 | Domain | Slice |
| --- | --- | --- | --- | --- |
| Quiet defaults: no paths without a Guide; context markers dim | C | No markers | — | S28, S29 |
| **Show ▾** | C | — | Session | S29 ([E14](./owner-decisions.md#e14)) |
| Stop numbers on entry Views in the whole-Guide reading | C | — | ✔ | S29 |
| Labels to 12 strong markers; context frustums to 24 Views | C | — | — | S28 |
| Mode pills with their own exit; Esc unwinds menu → tool → Look through → Follow → selection → Guide | C, R2 | Menu → selection → Guide | — | S28, S29, S30 |
| **Back** in the Card (selection history) | C | — | — | S26 ([E17](./owner-decisions.md#e17)) |
| Fading messages for every action (*View captured…*, *Stop moved to position 3*) | C | Shipped for S25 actions | — | Every slice, for its actions |

### 2.7 Preview

| Capability | Ref | Production at S25 | Domain | Slice |
| --- | --- | --- | --- | --- |
| Head Preview with entry precedence; exit restores the Guide and Card | C, R2 | Shipped | ✔ | — |
| **Welcome chooser** with name, welcome text, *Take the guided tour*, *Explore freely* | C, R2 | No chooser | ✚ ⬣ | S30 ([E15](./owner-decisions.md#e15)) |
| Guided: Views advance by hold, *Next stop* between Stops, *Finish tour*, Pause/Resume | C | Next by key; one View per Stop | ⬣ | S27 (runtime), S30 (controls) |
| **Places** drawer: open Presentations and their Views | C | Guide-free Presentations list | ⬣ | S30 |
| **Back to the tour · Stop N** | C | Resume exists | ✔ | S30 |
| **End of the tour**: *Keep exploring*, *Start the tour again* | C | — | — | S30 |
| Guide Card mode cards open Preview guided or free | C | Read-only cards | — | S30 |

### 2.8 Cross-cutting completion

Every new control in S26–S30 meets this bar. The writer checks it in tests and token checks; the owner
checks it in the manual journeys (OD5).

| Concern | Requirement |
| --- | --- |
| History | One Undo entry per accepted operation, labelled by the action; refusals, cancelled gestures, Esc and playback add none; Redo replays captured ids |
| Refusal | A domain refusal reaches the creator as a readable message near the control; a disabled control says why (title and screen-reader text) |
| Consequence | Destructive and shared edits name their effect before they run |
| Keyboard | Every Stage gesture has a Card or Index path to the same operation; focus rings on markers, points and tiles |
| Coarse pointer | Marker, handle and path-point hit targets at least 44 px; no hover-only reveal |
| Narrow | 1180 × 820 and 820 × 1180 through the Round 2 shell |
| Dense | 50 Views, 30 Stops, 40 Presentations |
| Tokens | Shell contract colour roles, type roles and control metrics; gold only for selection and the current moment |
| Isolation | No editor module in visitor chunks |

## 3. Conservatory harvest closure (OD2)

Everything Conservatory shows is accounted for: a row above, a ruling, or a shortcut.

| Conservatory item | Fate |
| --- | --- |
| Index **New** (from a standpoint) | Ruled by D1: dock Capture and Place a View are the doors |
| Make default from the View menu | Ruled by D12: View Card only |
| Overlay Card, rail, inset instrument, Head and its chrome | Superseded by Round 2 (D13) |
| World mock: Context Index, room, wall and opening Cards, Measure | Superseded by PLATE §0.8.4 and delivered by the R217 World slices; the cross-lens subject link is S26 |
| Clicking the path to add a point without a tool | Ruled by Round 2's Path tool (shell owns the dock) |
| *Prototype ▾*, stress generators, simulated width, `window.__xp` | Review facilities; their scenarios become the x-fixtures |
| Snapshot Undo, selection array, mock document, `camera.js`, fixed glide, Catmull-Rom curve, `frameObject`, `inPoly`, extra WebGL contexts, mock lens and height values | Prototype shortcuts, never promoted ([S25 harvest §5](../r217.s25-experience-shared-homes/design-harvest.md#5-prototype-shortcuts-never-promoted), [E3](./owner-decisions.md#e3), [E7](./owner-decisions.md#e7), [E9](./owner-decisions.md#e9)) |

**Not Conservatory, so they stay out:**
- Round 2's phone Preview frame (an R217 non-goal);
- Experience removal;
- removing a Camera path on its own;
- path editing in 3D;
- numeric Camera precision panels;
- narration, captions, cues, Gates, Detours, branching and publishing.

## 4. Corrections to the S25 harvest §4

1. *Reorder a Presentation's Views — No order field.* `ExperiencePresentation.viewIds` is ordered
   display order. Only the operation is missing.
2. *Additional Guides — domain refuses `guide-exists`.* The refusal is in two planners only.
   Validation admits several Guides, requires each to carry its entry Stop, and lets one Stop be
   ordered by more than one Guide.
3. *Camera path editing — unwired helpers.* The `authoring/camera` helpers act on the legacy
   `SceneDocument` and have no F.2 planner behind them. The real gap is that **no planner creates or
   edits a Camera connection**, so Travel can never become supported in an editor-authored project.
4. *Framing controls.* `CAMERA_LENS_PRESETS` (24, 50 and 85 mm) and `findMatchingLensPreset` are
   retained Camera authoring math, so Lens steps need no new preset table.
5. A Guide's start is `entryStopId`, which `experience-guide-order` never changes. Production does
   not show it, so after a reorder the first card may not be where the tour starts.
