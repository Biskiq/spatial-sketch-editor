# R217.S26 — capability and gap inventory

**AUTHORITY: NONE.** Planning evidence for owner review. The [S25 harvest](../r217.s25-experience-shared-homes/design-harvest.md)
was the starting inventory; this file extends it to the whole creator workflow and checks every row
against the domain at `f8da7eb0`. Slice scope lives in the [execution plan](./execution-plan.md).

**Domain column.**
**✔** exists and is wired in the editor.
**◐** exists in the domain or Camera but has no editor caller.
**✚** needs a new or widened planner or a derived read; no persisted-format change.
**⬣** needs a persisted-format change; deferred.
**✕** out of scope (reason given).

**Reference column.** **C** Conservatory, **R2** Round 2 wireframe, **D** domain or contract only.

## 1. Domain-operation ledger

### 1.1 Planners that exist (`createUnitCandidatePlanners`)

| Planner | Writes | Editor caller at S25 | S26 use |
| --- | --- | --- | --- |
| `camera-view-update` | One Camera View's `label`, `eye`, `target`, `fov` | **none** | View rename (S26); marker move and aim, Lens and Eye steps (S28); Update View (S29) |
| `experience-create` | One empty Experience | New Experience | — |
| `experience-capture-bind` | Camera View + Presentation (+ optional Stop, or first Guide with Stop) | Capture, Present this, first Guide | Place a View into a new Presentation (S28) |
| `experience-guide-create` | First Guide + initial Stop; sets `entryGuideId` | First Guide door | Widened to any Guide (S26) |
| `experience-stop-create` | A Stop inserted after a Stop in one Guide | + Stop, Add to Guide, Index drag | Target Guide chosen when several exist (S26) |
| `experience-guide-order` | A permutation of one Guide's `stopIds`; `entryStopId` untouched | Drag, bar drop, Alt ←/→, `•••` | — |
| `experience-presentation-update` | `label`, `text`, `subject`, captured `view` (appended, becomes Default unless `defaultViewId` is sent), `defaultViewId` | Rename, Information text, Capture into, Make default | Widened with a `viewIds` permutation (S26); Place a View into a visible Presentation (S28) |
| `experience-stop-update` | `entryViewId`, `holdSeconds`, `continuation` (with Cut/Travel) | Enter at…, Hold, After this Stop, Cut/Travel | — |

### 1.2 Operations that are missing

| Operation (proposed name) | Why it is needed | Domain | Slice |
| --- | --- | --- | --- |
| `experience-update` {`label`, `entryGuideId`} | Experience rename; choose the Guide the Experience opens on | ✚ | S26 |
| `experience-guide-update` {`label`, `entryStopId`} | Guide rename; choose where a Guide starts (the domain keeps entry separate from order) | ✚ | S26 |
| `experience-guide-create` without the `guide-exists` refusal | Additional Guides. Validation already admits several Guides and a Stop ordered by more than one | ✚ (lift a refusal) | S26 |
| `experience-presentation-update` + `viewIds` permutation | Reorder a Presentation's Views. `viewIds` is already ordered display order; only the operation is missing | ✚ | S26 |
| `experience-stop-remove` | Remove a Stop; the Presentation stays | ✚ | S27 |
| `experience-presentation-view-remove` (Experience + Camera compound) | Remove a View from a Presentation; delete the Camera View and its connections only when nothing else uses them | ✚ | S27 |
| `experience-presentation-remove` (Experience + Camera compound) | Remove a Presentation with its Stops and its unshared Views | ✚ | S27 |
| `experience-guide-remove` | Remove a Guide with the Stops no other Guide orders | ✚ | S27 |
| `camera-connection-create` | Make a Travel supported. **No planner creates a connection today, so every Travel in an editor-authored project is a gap** | ✚ | S31 |
| `camera-connection-update` {interior anchors, per-direction `timing.durationSeconds`} | Shape a path; set or clear Travel duration | ✚ | S31 |
| Guide time map (derived read, `camera-core`) | Seconds per Stop and Travel for the bar, total, scrub and playback: Experience holds over Camera-evaluated durations | ✚ (read) | S32 |
| Route-versus-Wall query (derived read, `layout-core`) | *Crosses a wall* warning from the Layout representation, not the prototype's `inPoly` | ✚ (read) | S31 ([E12](./owner-decisions.md#e12)) |
| Stop-local guided Views: several Views per Stop, their order, per-View holds | Conservatory's shot list; PLATE's occurrence-local sequence | ⬣ Experience format, `ExecutionProgram`, lowering and interpreter; `T3.camera-experience-cutover` | Deferred ([E3](./owner-decisions.md#e3)) |
| Per-Presentation *Open in free exploration* | Conservatory's own flagged addition | ⬣ | ✕ ([E15](./owner-decisions.md#e15)) |

Every new planner is operation-specific under `F4.intent-acceptance@1:unit-acceptance-v1`, declares
its domain (and `writes` for the two compounds), allocates nothing itself and refuses strictly. None
changes a format, a gate version or an F interface. Each is still a *planner change* under the
campaign's [owner checkpoint 3](../../../reference/decisions/r217-convergence-campaign-2026-10-30.md#owner-checkpoints),
which is why [E2](./owner-decisions.md#e2) asks for them together.

## 2. Workflow inventory

### 2.1 Experience and Presentations

| Capability | Ref | Production at S25 | Domain | Slice |
| --- | --- | --- | --- | --- |
| New Experience from the crumb menu | C, R2 | Shipped | ✔ | — |
| Rename the Experience | C | — | ✚ `experience-update` | S26 |
| Remove an Experience | — | — | ✕ not in Conservatory or Round 2 | — |
| New Presentation from the current 3D standpoint (dock Capture) | C, R2 | Shipped; refused in Plan with the reason | ✔ | — |
| New Presentation by placing a View in Plan | C | — | ✔ `experience-capture-bind` with a gesture pose | S28 |
| Present this from a subject Card | C, R2 | Shipped: captures the current 3D framing | ✔ | Plan variant S28 ([E9](./owner-decisions.md#e9)) |
| Rename a Presentation; Information text in More | C | Shipped | ✔ | — |
| Views grid; dense grid past 8; filter, *On tour*, *Free* past 12 | C | Shipped | ✔ | — |
| **Reorder Views**: drag a tile, Alt ←/→, refused while filtered (*clear the filter to reorder*) | C | — | ✚ `viewIds` | S26 |
| *Visitors reach it*: Stop chips | C | Shipped | ✔ | — |
| Add to Guide in `•••` | C, D8 | Shipped for the first Guide and the active Guide | ✔ | Choose the Guide, or New Guide…, S26 |
| **Remove Presentation** *and its n Stops* | C | — | ✚ | S27 |
| Index: two-line rows, search from 8, one open Presentation, +N more | C | Shipped | ✔ | — |
| Drag a Presentation from the Index onto the Guide | C | Shipped | ✔ | — |
| Change or clear a Presentation's subject | D | — | ◐ | ✕ no Conservatory home |

### 2.2 Views

| Capability | Ref | Production at S25 | Domain | Slice |
| --- | --- | --- | --- | --- |
| Capture into the visible Presentation, Default kept | C, R2 | Shipped | ✔ | — |
| **View markers**: Plan dot + aim, screen-sized and world-anchored; 3D camera glyph; states selected, strong, normal, dim, hidden | C, R2 | None (D13 removed World marks) | ✔ read | S28 |
| Select a View on Stage; never moves the Camera | C | — | ✔ | S28 |
| **Place a View** (dock tool): press where the camera stands, drag toward what it sees | C, R2 | Disabled key | ✔ capture-bind or presentation-update `view` | S28 |
| **Move** a View (drag the dot) and **aim** it (round handle) | C | — | ◐ `camera-view-update` | S28 |
| **Lens** Wide, Normal, Close and **Eye height** Seated, Standing, Raised | C (R2: read-only facts) | Read-only *Lens mm* and *Eye* | ◐ `camera-view-update`; retained `CAMERA_LENS_PRESETS` (24, 50, 85 mm) | S28 ([E7](./owner-decisions.md#e7)) |
| Rename a View (shared Views say where else the name shows) | C | — | ◐ `camera-view-update.label` | S26 |
| Make default (View Card only) | C, D12 | Shipped | ✔ | — |
| *Where visitors see it* | C | Shipped | ✔ | — |
| **Look through**: gold capture frame, mode pill, drag to re-aim, scroll to step, *moved*, **Update View**, **Exit View** (Esc) back to the exact standpoint, Plan included | C, R2 | Disabled | ◐ `camera-view-update`; return like Preview's Camera handover | S29 |
| Double-click a thumbnail or marker to Look through | R2 | — | — | S29 |
| Capture while looking through (a varied copy) | R2 | — | ✔ | S29 |
| **Snapshots** in every slot: Index 48 × 30, Card grid, hero, Stop rows, Stop cards, Transition ends, subject rows | C, R2 | Neutral placeholders (D4) | Render capability, no extra WebGL context | S30 ([E10](./owner-decisions.md#e10)) |
| **Remove View**: not the last; Default needs an explicit replacement; Stops entering there named | C | — | ✚ compound | S27 |

### 2.3 Guides and Stops

| Capability | Ref | Production at S25 | Domain | Slice |
| --- | --- | --- | --- | --- |
| Open from an Index row; dock key shows and hides; × closes | C, D3 | Shipped | ✔ | — |
| First Guide, two doors, name asked inline | D8 | Shipped | ✔ | — |
| **Additional Guides** | C (plural Index) | Refused `guide-exists` | ✚ | S26 ([E5](./owner-decisions.md#e5)) |
| **Rename a Guide** | C | — | ✚ `experience-guide-update` | S26 |
| **Opening Guide** (Experience `entryGuideId`) | D | Read-only line on the Guide Card | ✚ `experience-update` | S26 |
| **Start Stop** (Guide `entryStopId`, independent of order) | D | Not shown | ✚ `experience-guide-update` | S26 ([E6](./owner-decisions.md#e6)) |
| Insert: + Stop menu, Index drag, Add to Guide after the selected Stop | C, D8 | Shipped | ✔ | — |
| Revisit (*again*) | C | Shipped | ✔ | — |
| Reorder: drag, bar drop, Alt ←/→, Move earlier, later, start, end | C | Shipped | ✔ | — |
| **Remove Stop** (*Presentation stays*) | C | — | ✚ | S27 |
| **Remove Guide** | — | — | ✚ | S27 |
| Stop Card: entry View, Hold stepper, Enter at…, ‹ › | C, D5 | Shipped | ✔ | — |
| Stop-local guided Views: Include, leave out, order, per-View holds | C | Disabled *Include* (D5) | ⬣ | Deferred ([E3](./owner-decisions.md#e3)) |
| *After this Stop*: Next, a chosen Stop, End, resolved | C, D11 | Shipped | ✔ | — |
| **Play from this Stop** | C | Disabled | ✚ time map | S32 |
| Guide Card: two ways in, reach counts | C | Shipped; time *Comes with Camera playback* | ✔ | Time filled S32 |
| Long Guide: scroll to selection, bracket, narrow segments drop numbers; compact ⌄ | C | Shipped | ✔ | — |

### 2.4 Transitions and Camera paths

| Capability | Ref | Production at S25 | Domain | Slice |
| --- | --- | --- | --- | --- |
| Transition Card: resolved ends, Cut/Travel | C, D6, D11 | Shipped | ✔ | — |
| Travel gap named; red dashed connector | C | Shipped; always a gap (no connection can be authored) | ✔ read | — |
| **Add a Camera path** for a gap, deliberately | D (PLATE: never invented by choosing Travel) | — | ✚ `camera-connection-create` | S31 ([E11](./owner-decisions.md#e11)) |
| Path on Stage while the Guide is open: selected gold, neighbours solid, the rest faint; Cut as a dotted CUT link | C | — | ✔ read via `getCameraConnectionRoute` | S31 |
| **Path** dock tool arms point insertion; click the path to add a point | C, R2 | Disabled key | ✚ `camera-connection-update` | S31 |
| Drag a point; select a point (gold); Delete or *Remove point*; **Straighten** | C | — | ✚ | S31 |
| *Crosses a wall*: red dashed path and Card alert | C | — | ✚ Layout read | S31 ([E12](./owner-decisions.md#e12)) |
| *Also used by Stop 4 → 5* (shared connection) | C | — | ✔ read | S31 |
| **Travel duration**: authored seconds or the Camera's computed value (*Auto*) | C, R2 | Disabled stepper | ✚ `camera-connection-update` timing | S31 |
| Entry or exit View change re-resolves support and names the new gap; the old path stays with its Views | C, PLATE | Gap shown | ✔ | S31 (message) |
| Connector chips with Travel seconds | C, R2 | Resolved destination, no seconds (D9) | ✚ | S31 |
| **Preview this move** | C | Disabled | ✚ time map | S32 |
| Edit paths in 3D | — | — | ✕ Conservatory edits in Plan only and shows in 3D | — |
| Remove a Camera path on its own | — | — | ✕ no Conservatory home; Cut never deletes support; removal follows View removal (S27) | — |

### 2.5 Timeline and playback

| Capability | Ref | Production at S25 | Domain | Slice |
| --- | --- | --- | --- | --- |
| **Time-scaled bar**: Stop segments by hold, Travel links by Camera duration, Cut zero | C, R2 | Ordinal bar with hold labels (D9) | ✚ time map | S32 |
| **Total** *0:00 / 0:41* | C, R2 | None (deliberate difference) | ✚ | S32 |
| Hold-less Stops (the visitor presses Next) | D | Shown as no hold | ✚ | S32 ([E13](./owner-decisions.md#e13)) |
| **Play/Pause** (gold key, Space) | C, R2 | Disabled | ✚ | S32 |
| **Scrub**, playhead, cards follow | C, R2 | — | ✚ | S32 |
| Playing Stop glow and segment fill | C, R2 | — | — | S32 |
| **Camera rig** puck on Stage (outside observation) | C, R2 | — | ✔ camera-core sample | S32 |
| **Follow camera**: look through the evaluated Camera; off or Esc returns to the standpoint | C, R2 | Disabled | ✔ camera-core | S32 |
| Editing source stops the clock and re-derives; playback writes nothing | PLATE | — | — | S32 |
| Reduced motion | D | Visitor only | ✔ reduced-motion controller | S32 |

### 2.6 Stage visibility and navigation

| Capability | Ref | Production at S25 | Domain | Slice |
| --- | --- | --- | --- | --- |
| Quiet defaults: no paths without a Guide; context markers dim | C | No markers at all | — | S28 (markers), S31 (paths) |
| **Show ▾**: Whole Guide or Selection only; markers, frustums, paths, labels; *n off* | C | — | Session only | S31 ([E14](./owner-decisions.md#e14)) |
| Stop numbers on entry Views in the whole-Guide reading | C | — | ✔ read | S31 |
| Labels for the working set up to 12; context frustums up to 24 Views | C | — | — | S28 |
| Mode pill with its own exit: placing, looking through, following | C, R2 | — | — | S28, S29, S32 |
| Esc unwinds: menu → place → Look through → Follow → selection → Guide | C, R2 | Menu → selection → Guide | — | S28, S29, S32 |
| Selecting never moves the Camera | C | Shipped | ✔ | — |
| *Back* chip in the Card (selection history) | C | — | ✕ Round 2's Card owns its chrome; the kind-line parent link covers *up* | — |

### 2.7 Preview

| Capability | Ref | Production at S25 | Domain | Slice |
| --- | --- | --- | --- | --- |
| Head Preview with entry precedence; exit restores the Guide and Card | C, R2 | Shipped | ✔ | — |
| Preview from the selected Stop | C | Shipped (precedence) | ✔ | — |
| Guided and free entry chooser in the visitor surface | C, R2 | Guide-free Presentations list and resume exist; no chooser | Visitor surface | ✕ ([E15](./owner-decisions.md#e15)) |
| Phone frame | R2 | — | — | ✕ R217 non-goal |
| Guide Card mode cards as Preview entries | C | — | — | ✕ S25 §5 shortcut |

### 2.8 Cross-cutting completion

Every new control in S26–S32 meets the same bar, checked in each slice's journeys:

| Concern | Requirement |
| --- | --- |
| History | One Undo entry per accepted operation, labelled by the action; refusals, cancelled gestures, Esc and playback add none; Redo replays captured ids |
| Refusal | A domain refusal reaches the creator as a readable message near the control; a disabled control says why (title and screen-reader text) |
| Consequence | Destructive and shared edits name their effect before they run (Remove…, Update a shared View, edit a shared path) |
| Keyboard | Every Stage gesture has a Card or Index path to the same operation; focus rings on markers, points and tiles; Esc order above |
| Coarse pointer | Marker, handle and path-point hit targets at least 44 px; no hover-only reveal |
| Narrow | 1180 × 820 and 820 × 1180 through the Round 2 shell: Card sheet above the Guide; mode pills stay reachable |
| Dense | Conservatory's stress fixtures: 50 Views, 30 Stops, 40 Presentations |
| Isolation | No editor module in visitor chunks; Preview unchanged unless a slice says so |

## 3. Corrections to the S25 harvest §4

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
