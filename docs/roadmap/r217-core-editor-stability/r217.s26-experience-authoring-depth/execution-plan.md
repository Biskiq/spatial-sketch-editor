# R217.S26 — execution plan: Experience authoring depth

**Status: proposed, for owner review.** Nothing here is registered or released. The slice blocks below
become plans only when the owner registers them ([E1](./owner-decisions.md#e1)); each block then
moves to its own `r217.sNN-…/implementation-plan.md` without changing scope. The
[inventory](./capability-inventory.md) owns the gap evidence; the [decisions](./owner-decisions.md)
own the open choices. Every block assumes the recommended rulings; a different ruling changes only the
rows that cite it.

## 1. Scope

Seven sequential slices complete the creator workflow:

| Slice | Name | Closes |
| --- | --- | --- |
| **R217.S26** | Experience structure | Renames, plural Guides, Opening Guide, Guide start, View order |
| **R217.S27** | Removal with consequences | Remove Stop, View, Presentation, Guide |
| **R217.S28** | View markers and placement | Stage markers, Place a View, move and aim, Lens and Eye height, Present this in Plan |
| **R217.S29** | Look through | Capture frame, re-aim, Update View, Exit View, return |
| **R217.S30** | View snapshots | Real images in every slot |
| **R217.S31** | Camera paths | Camera support for Travel, path editing on Stage, duration, *crosses a wall*, Show ▾ |
| **R217.S32** | Timeline and playback | Time-scaled bar and total, Play, scrub, rig, Follow, Play from this Stop, Preview this move |

Each slice delivers the function **and** its visual and interaction completion: Conservatory's content
and behaviour inside the Round 2 shell, every state in the [cross-cutting table](./capability-inventory.md#28-cross-cutting-completion),
and the disabled placeholder it replaces removed or re-worded. The accepted Round 2 shared shell and
compact Guide are not restyled.

## 2. Order and dependencies

```text
S25 (merged)
  └─ S26 structure ─ S27 removal ─ S28 markers, placement ─ S29 Look through ─┬─ S30 snapshots
                                                                              └─ S31 Camera paths ─ S32 playback
                                                                                         S11 final gate (needs all)
```

| Slice | Requires | Why |
| --- | --- | --- |
| S26 | S25 | Writers and controller are S25's |
| S27 | S26 | Removing a Guide needs plural Guides and the Opening-Guide rule; same writers |
| S28 | S27 | Stage markers must disappear with removed Views; shares the route and Card |
| S29 | S28 | Look through starts from a selected marker and returns to the marker's reading |
| S30 | S29 | Snapshot aspect is the capture-frame aspect S29 fixes |
| S31 | S29 | Paths join View markers; editing returns through the same Stage postures |
| S32 | S31 | Travel seconds come from Camera connections S31 creates |

The campaign rule of one implementation slice at a time applies. S30 touches the snapshot slot and
the render host only, so the owner may run it beside S31 by explicit exception; this plan does not
assume that.

## 3. Rules for every slice

- **Start.** Through the T1 runbook start step with the T1 baton, as the campaign record says, once
  the slice is registered and released. Gates and active scopes are rechecked at the trusted base.
- **Live check first.** Before editing, the writer opens the slice's fixtures in the running editor
  at 1440 × 900 and 820 × 1180 under the `browser-hygiene` skill, and records any state that differs
  from the inventory. No screenshot archive.
- **Authority.** Writes go through the Experience controller's `run` into planners. Camera poses,
  routes, durations and samples come from `camera-core`. No component holds authored state. Session
  state (selection, armed tool, Look-through provisional pose, playback clock, Show, snapshots) is
  never serialized.
- **Shared files.** The writer records a claim in the T1 baton before editing the files in §7.
- **Verification.** The declared tier, the whole architecture lane and the slice's journeys in the
  browser. Planner slices add the planner contract tests and `unit-acceptance-conformance`. Slices
  that consume Camera motion add the affected heavy Camera contracts.
- **Review and acceptance.** [E16](./owner-decisions.md#e16): an independent review of planner and
  Camera parts where the block names them, then owner visual acceptance.
- **Placeholders.** A disabled control that S26 does not complete keeps its reason. A control a slice
  completes loses its *Comes with…* text in the same slice.

## 4. Fixtures

Built once in S26 as a test and browser seeding helper that calls the real planners. They are not
Conservatory's generators, and no product UI is added for them.

| Fixture | Contents |
| --- | --- |
| **x-empty** | A Layout room, one Scene object, no Experience |
| **x-salon** | One Experience; five Presentations, one about a Scene object, one sharing a View with another; one Guide of six Stops with a revisit, a hold-less Stop and a nonadjacent continuation (→ 5) |
| **x-long** | x-salon's world with a 30-Stop Guide |
| **x-dense** | A 50-View Presentation and 40 Presentations |
| **x-paths** | x-salon plus Camera connections for two transitions, one through a Wall, one shared by two transitions (added in S31) |

## 5. Slices

### R217.S26 — Experience structure

```text
WRITER: T3 (integrator)   REVIEW: independent (planners), owner visual (UI)   VERIFICATION: architecture-integration
INTEGRATION ROUTE: R217.S11
DOMAIN: experience-update {label, entryGuideId}; experience-guide-update {label, entryStopId};
        experience-guide-create without guide-exists; experience-presentation-update + viewIds (permutation);
        first editor caller of camera-view-update (label only)
```

**Scope.**
- Rename the Experience from the crumb's sibling menu (*Rename…* opens the crumb inline), a Guide
  from its Card title, and a View from its Card title. A View listed by another Presentation says
  *Also in ⟨Presentation⟩* under the title.
- Additional Guides ([E5](./owner-decisions.md#e5)): *Add to Guide* becomes a submenu of Guides
  (active first) and **New Guide…** with the inline name. The new Guide becomes active. The Index
  shows every Guide and an *opens* tag on the Opening Guide.
- Guide Card: **Make this the opening Guide** (disabled on the Opening Guide: *The Experience opens
  on this Guide*).
- Guide start ([E6](./owner-decisions.md#e6)): a *Start* tag on the start Stop's card and in the Stop
  Card kind line; **Start the tour here** in the selected Stop's `•••`.
- Reorder a Presentation's Views: drag a tile in the Card grid (gold caret), Alt ←/→ on a focused
  tile. With a filter on, the hint reads *n shown · clear the filter to reorder* and dragging is off.
  The Index View list follows the order.
- The x-fixtures.

**Visual and interaction completion.** Inline rename fields use the Card title metrics, commit on
Enter or blur, and cancel on Esc; an empty name refuses with *A name is needed*. The submenu uses the
Round 2 menu, with *again* hints kept. *Start* and *opens* are mono 10 px tags in the Round 2 tag
style. Reorder uses the same drag affordance and caret as Stop cards.

**Acceptance journeys.**

| # | On | Do | Expect |
| --- | --- | --- | --- |
| X26.1 | x-salon | Rename the Experience, the Guide and the shared View; Undo each | Names change everywhere they appear (crumb, Index, Guide header, Stop and Transition Cards, *Also in* on both Presentations); three Undo entries labelled *Rename …*; Esc and empty names add none |
| X26.2 | x-salon, Guide open | Presentation `•••` → Add to Guide ▸ New Guide…, name *Short tour*, Enter | A second Guide with that Presentation as Stop 1 is active; the Index lists two Guides, *Open* on *Short tour*, *opens* still on the first; one Undo removes the Guide and its Stop together |
| X26.3 | after X26.2 | *Short tour* Card → Make this the opening Guide; nothing selected → Head Preview | The *opens* tag moves; Preview enters *Short tour*'s start Stop; Undo restores the tag |
| X26.4 | x-salon | Stop 3 `•••` → Start the tour here; drag Stop 3 to the end | *Start* tag on Stop 3 after both edits; Preview of the Guide starts at Stop 3; one Undo entry for the start, one for the move |
| X26.5 | x-dense | Drag View 1 to position 5; Alt → twice on a focused tile; filter *On tour* and try to drag; Save and reload | Order kept after reload and mirrored in the Index; dragging refused while filtered with the hint; Default and Guide order unchanged |
| X26.6 | x-salon, 820 × 1180 | Repeat X26.2 in the Card sheet | Submenu and inline name are reachable and usable with a coarse pointer |

**Out.** Experience removal; Guide colours or icons; reordering Guides in the Index.

### R217.S27 — Removal with consequences

```text
WRITER: T3   REVIEW: independent (planners, compound scope), owner visual   VERIFICATION: architecture-integration
DOMAIN: experience-stop-remove; experience-presentation-view-remove (writes camera);
        experience-presentation-remove (writes camera); experience-guide-remove — rules per E4
```

**Scope.** *Remove Stop* (Stop `•••`, hint *Presentation stays*), *Remove View* (View Card `•••`),
*Remove Presentation* (Presentation `•••`, hint *and its n Stops*) and *Remove Guide* (Guide Card
`•••`), each with the [E4](./owner-decisions.md#e4) rules. Removing the selected subject selects its
parent: the Guide for a Stop, the Presentation for a View, nothing for a Presentation.

**Visual and interaction completion.** Danger items in red at the end of `•••` after a rule. Choosing
one opens a consequence block in place in the Card, not a modal: the effect lines (*Stop 1 will follow
the Guide order*, *Stops 2 and 5 will enter at the Default View*, *1 Camera path is removed*), a red
**Remove** and **Cancel**. Esc cancels and focus returns to `•••`. Removing the Default needs a Default
chosen in the block first. Refusals keep the item disabled with the reason as its hint (*last View*,
*A Guide keeps at least one Stop*). After a removal a fading message names what remains (*Stop 2
removed — ⟨Presentation⟩ is still in the Index*).

**Acceptance journeys.**

| # | On | Do | Expect |
| --- | --- | --- | --- |
| X27.1 | x-salon | Remove Stop 2; Undo; Redo | Connectors re-resolve to the new neighbour; Stop numbers update; Undo restores the Stop with its id, hold, entry and position; Redo removes it again |
| X27.2 | x-salon | Remove the Stop that Stop 1 continues to (→ 5) | The block names Stop 1's fallback; afterwards Stop 1's connector shows adjacency |
| X27.3 | a Guide with one Stop | Open its `•••` | *Remove Stop* is disabled with *A Guide keeps at least one Stop*; *Remove Guide* is reachable from the Guide Card |
| X27.4 | x-salon | Remove the Default View of a Presentation with three Views and Stops that enter there by name | The block requires a new Default; the named Stops enter at it; the Camera View is deleted (unshared); one Undo restores all |
| X27.5 | x-salon | Remove the shared View from one Presentation | The other Presentation keeps it; the block says *Still used by ⟨Presentation⟩*; the Camera View remains |
| X27.6 | x-salon | Remove a Presentation used by two Stops; Save; reload | Both Stops, its unshared Views and their connections are gone after reload; the Index and Guide are consistent; nothing orphaned in the Camera unit |
| X27.7 | after X26.2 | Remove the Opening Guide | The other Guide becomes the Opening Guide, named in the block; removing the last Guide leaves *No Guide yet* |
| X27.8 | any | Esc in the block; keyboard-only removal | Nothing changes and no history entry; the whole flow works from the keyboard with visible focus |

### R217.S28 — View markers and placement

```text
WRITER: T3 with a T1 shared-file claim   REVIEW: owner visual (T1 reviews the Stage mark layer)   VERIFICATION: affected-subsystem
DOMAIN: camera-view-update (eye, target, fov); capture-bind and presentation-update view with a gesture pose
```

**Scope.**
- **View markers** in the Experience lens: in Plan a dot at the eye, a short frustum wedge and a
  round aim handle, world-anchored and screen-sized; in 3D a camera glyph. States follow Conservatory's
  emphasis: *selected* (gold ring, larger glyph, label), *strong* (the selected Presentation's or
  Stop's Views), *normal*, *dim* (context), *hidden*. Labels for at most 12 strong markers, frustums
  for at most 24 Views. Markers are Stage marks in the existing mark layer, not World marks (D13 stays).
- Selecting a marker selects the View and never moves the Camera.
- **Place a View** dock key (Round 2 `C`), enabled in Plan and 3D on the Floor plane: press where the
  camera stands and drag toward what it sees. A drag under 0.5 m places nothing and says so. The new
  View goes into the visibly selected Presentation, otherwise into a new Presentation whose title opens
  for naming (D1, D2: never a Stop). Height per [E8](./owner-decisions.md#e8).
- **Move** a selected View by dragging its dot and **aim** it by its handle, with a live ghost, one
  Undo entry per drag, and Esc to cancel mid-drag.
- **Lens** and **Eye height** steps on the View Card ([E7](./owner-decisions.md#e7)), above the exact
  facts.
- **Present this in Plan** ([E9](./owner-decisions.md#e9)).

**Visual and interaction completion.** Leaf green for Camera marks and gold for selection (PLATE
visual grammar). A mode pill top-centre while placing: *Place a View — press where the camera stands,
drag toward what it sees · Cancel Esc*. Coarse-pointer hit targets of 44 px for dot and handle.
Keyboard: markers are not the only path, because the Index and Card already reach every View. The
dock key loses *Comes with View placement*.

**Acceptance journeys.**

| # | On | Do | Expect |
| --- | --- | --- | --- |
| X28.1 | x-salon, Plan | Select a Presentation, then one of its Views, pan and zoom | Its Views strong, others dim; the View gold with its label; marker size constant on screen; the Stage Camera pose is numerically unchanged by selection |
| X28.2 | x-salon, Plan, Presentation selected | Place a View with a 3 m drag | A View in that Presentation at 1.65 m, aimed along the drag; its Card opens; one Undo; no Stop added |
| X28.3 | x-empty | Place a View with nothing selected; type a name | A new Presentation with that View as Default, title named inline; one Undo removes both |
| X28.4 | x-salon | Drag a marker 2 m; drag its handle 90°; start a drag and press Esc | Live ghost; two Undo entries; the cancelled drag leaves no change and no entry |
| X28.5 | x-salon | View Card: Lens Close, then Eye Seated | *85 mm*, fov per the preset; eye and target down by the same amount; *Custom* shows for an off-preset View |
| X28.6 | x-salon, Plan | Subject Card → Present this | Placement armed with the aim on the subject; the result is a Presentation about that subject |
| X28.7 | x-dense, 3D and Plan | Select the 50-View Presentation | Labels only while strong markers number 12 or fewer; frustums hidden past 24; still responsive |
| X28.8 | x-salon, coarse pointer | Repeat X28.2 and X28.4 | Gestures land at 44 px targets; no hover-only state |

### R217.S29 — Look through

```text
WRITER: T3 with a T1 shared-file claim   REVIEW: owner visual (T1 reviews the Stage Camera seam)   VERIFICATION: affected-subsystem
DOMAIN: camera-view-update (eye, target, fov) on Update View; Capture while looking through
```

**Scope.**
- **Look through** from the View Card (primary), from a double-click on a marker or thumbnail, and
  from the Stop Card's entry View row. The Stage enters the Through posture: the 3D reading through the
  View's exact pose and fov, a gold capture frame at a fixed aspect fitted to the Stage area the Card
  and Guide leave uncovered, and a mode pill *Looking through ⟨View⟩ · Exit View Esc*.
- Drag to re-aim and scroll to step forward or back, through the Stage Camera; the pill adds *moved*
  and a gold **Update View**. Lens and Eye steps apply live while looking through.
- **Update View** writes once through `camera-view-update`; a shared View first says *Also changes
  ⟨Presentation⟩*. **Exit View** and Esc discard and return to the exact standpoint and reading,
  Plan included, through the Stage's existing Camera return seam (the one Preview's handover uses).
- Dock **Capture** while looking through captures the provisional pose as a new View in the same
  Presentation.

**Visual and interaction completion.** World and Experience helpers are hidden inside the frame
(Conservatory *helpers hidden while looking through*). The View Card swaps its action row to Exit View
and Update View. The reading control shows Through as active, and choosing Plan exits first. Esc order:
menu → Look through → selection → Guide. The *Comes with Look through* text is removed.

**Acceptance journeys.**

| # | On | Do | Expect |
| --- | --- | --- | --- |
| X29.1 | x-salon, Plan | Look through a View | The Stage pose and fov equal the View exactly (numeric check); the frame is fully visible beside the Card at 1440 × 900 and 1180 × 820 |
| X29.2 | — | Drag to re-aim, Update View | *moved*, then one Undo entry *Update View*; the marker and the facts follow |
| X29.3 | — | Re-aim, then Esc | No change and no history entry; back in Plan at the same centre and zoom |
| X29.4 | — | Look through the shared View, re-aim, Update View | The *Also changes* notice appears first; both Presentations show the new pose |
| X29.5 | — | Looking through, Lens Wide, Capture | A new View with the provisional pose and Wide lens in the same Presentation; the looked-through View is unchanged |
| X29.6 | 820 × 1180 | Look through with the Card sheet open | The frame fits above the sheet; Exit and Update reachable |

### R217.S30 — View snapshots

```text
WRITER: T3 with a T1 shared-file claim (render host)   REVIEW: owner visual   VERIFICATION: affected-subsystem
DOMAIN: none (derived render; E10)
```

**Scope.** Real snapshots ([E10](./owner-decisions.md#e10)) in every slot that holds a placeholder:
Index rows, the Presentation grid, the View hero, Stop rows, Stop cards, Transition ends, subject
*Already presented in* rows, and the D8 menus where they show a View. Rendered lazily for visible
slots, cached by View pose and source revision, refreshed after Update View, move, aim, Lens, Eye and
World edits. A neutral frame shows while rendering and when rendering is unavailable.

**Visual and interaction completion.** The placeholder keeps its geometry so nothing shifts. The
snapshot crops to the slot like Round 2's `slice`, with the full capture-frame composition in the hero.
The Default ◆ and number badges sit over the image as in Round 2.

**Acceptance journeys.**

| # | On | Do | Expect |
| --- | --- | --- | --- |
| X30.1 | x-salon | Compare a View's hero with its Look-through frame | Same composition and aspect |
| X30.2 | — | Move a Wall in World, return; Update a View | Affected snapshots refresh; unaffected ones are not re-rendered |
| X30.3 | x-dense | Scroll the 50-View grid | Only visible tiles render; WebGL context count unchanged; no lost input |
| X30.4 | — | Save, compare bytes | No snapshot or cache in the saved source |

### R217.S31 — Camera paths

```text
WRITER: T3 (Camera) with a T1 shared-file claim   REVIEW: independent (planners, Layout read, camera-core consumption), owner visual
VERIFICATION: architecture-integration, plus the affected heavy Camera contracts
DOMAIN: camera-connection-create; camera-connection-update {anchors, timing.forward|reverse.durationSeconds};
        layout-core route-versus-Wall read (E12)
```

**Scope.**
- **Camera support** ([E11](./owner-decisions.md#e11)): *Add a Camera path* on a Travel gap, in the
  Transition Card and the red connector's menu.
- **Paths on Stage** only while the Guide is open: the evaluated route from `getCameraConnectionRoute`;
  the selected transition's path gold, its neighbours solid, the rest faint; Cut as a dotted *CUT*
  link with no geometry; Stop numbers on entry Views in the whole-Guide reading. Shown in 3D, edited in
  Plan.
- **Path** dock key (Round 2 `T`), enabled with a transition selected: arms insertion, then a click on
  the path adds an interior anchor at the nearest progress. Drag a point; click to select it (gold,
  echoed in the Card as *Point 2 selected · Remove point*); Delete removes it. **Straighten** removes
  every interior point.
- **Duration**: a stepper over the Camera's per-direction `durationSeconds`, showing the computed
  value as *Auto · 6 s* until set, with *Auto* to clear. Connectors and Stop cards show Travel seconds.
- **Crosses a wall** ([E12](./owner-decisions.md#e12)): the path red-dashed and a Card alert, *The
  path passes through a wall. Add a point and drag it through the doorway.*
- **Shared path** note: *This path is also used by Stop 4 → 5.*
- Entry or exit change: a fading message names the transitions that now join different Views and show
  a gap.
- **Show ▾** ([E14](./owner-decisions.md#e14)).

**Visual and interaction completion.** Shape carries species (spatial grammar): ● View endpoint,
○ path point, gold selected point; derived samples unmarked. Points have 44 px coarse hit targets.
Insertion happens only with Path armed, so a click never authors geometry by accident. Mode pill while
armed: *Path — click the path to add a point · Done Esc*. The Path key and the Transition Card lose
*Comes with path editing*.

**Acceptance journeys.**

| # | On | Do | Expect |
| --- | --- | --- | --- |
| X31.1 | x-salon | Stop 1 → 2 Travel with a gap: Add a Camera path; Undo | Connector turns *travel 6s* (computed), path drawn; Undo returns the gap and removes the connection |
| X31.2 | x-paths, Plan | Select the walled transition; arm Path; add a point; drag it through the doorway | Red dashed and alert while crossing; both clear once through; one Undo entry per add and per drag |
| X31.3 | — | Select a point; Delete; Straighten | Point removed; Straighten removes all; each one entry |
| X31.4 | — | Duration 6 → 9 s; Auto | Connector and bar show 9 s; Auto restores the computed value |
| X31.5 | x-paths | Edit the shared path | The note names the other transition; both reflect the edit |
| X31.6 | x-paths | Change Stop 2's entry View | The message names the affected transitions; their connectors show the gap; the old connection still exists between its Views |
| X31.7 | x-paths | Show ▾ → Selection only; turn off frustums | Other Stops' paths and Views hide; *2 off* on the key; source unchanged; closing the Guide hides all paths |
| X31.8 | — | Choose Cut | Dotted CUT link; Path key disabled with *A Cut has no travel path*; the connection is not deleted |

### R217.S32 — Timeline and playback

```text
WRITER: T3 (Camera, Experience)   REVIEW: independent (time map, playback host), owner visual
VERIFICATION: architecture-integration, plus the affected heavy Camera contracts
DOMAIN: Guide time map in camera-core beside experience-controllers.ts (E2); no planner
```

**Scope.**
- **Time map**: from the lowered program, each Stop's hold and each continuation's Cut (0 s) or
  Travel (Camera motion `durationSeconds`), with hold-less Stops as *waits*
  ([E13](./owner-decisions.md#e13)). It is the only source for the bar, total, scrub and playback.
- **Bar**: time-scaled segments replace D9's ordinal ones; the total *0:00 / 0:41 + 2 waits*.
- **Play/Pause** (gold key, Space while the Guide is open), **scrub** on the bar, playhead, Stop card
  glow and segment fill, cards scrolling to the moment.
- **Camera rig**: a gold puck on Stage at the evaluated pose (outside observation).
- **Follow camera**: the Stage looks through the evaluated Camera with the pill *Following the camera ·
  travelling to Stop 3 · Stop following Esc*; off or Esc returns to the standpoint.
- **Play from this Stop** (Stop Card), **Preview this move** (Transition Card: the travel with two
  seconds either side), and the Guide Card's *Guided tour* time.
- Lifecycle: an accepted source edit stops the clock and re-derives the map; Look through, Place,
  Path and Preview stop playback; playback writes no source and no history.
- Reduced motion: Follow and the rig take the reduced-motion controller's settle.

**Visual and interaction completion.** Round 2's 26 px gold Play and 8 px bar, *waits* hatched,
the playhead a thin gold line. Glow on the playing Stop card only. The puck follows the spatial
grammar's *Camera rig*. Every *Comes with Camera playback* text is removed.

**Acceptance journeys.**

| # | On | Do | Expect |
| --- | --- | --- | --- |
| X32.1 | x-paths | Open the Guide | Segments proportional to holds and Travel seconds; the hold-less Stop as *waits*; the total matches the sum |
| X32.2 | — | Play; Space to pause | Playhead, glow and puck advance together; Play stops at the *waits* segment until pressed again |
| X32.3 | — | Scrub to mid-Travel | The puck sits at the evaluated pose; **parity**: for the same occurrence and progress, the editor pose equals the visitor director's within numeric tolerance |
| X32.4 | — | Follow; Esc | The Stage looks through the moving Camera; Esc returns to the exact standpoint, Plan included |
| X32.5 | — | Play from Stop 4; Preview this move on 3 → 4 | Starts at Stop 4; the move plays its stretch and stops |
| X32.6 | — | While playing, change a hold | The clock stops with a message; the bar re-derives; the history has only the hold edit |
| X32.7 | reduced motion | Play with Follow | Travel settles as the visitor's reduced-motion profile does |
| X32.8 | x-long | Play across 30 Stops | Cards follow the playhead; the bracket tracks; no stale clock after closing the Guide |

## 6. R217 and S11 sequencing

Proposed for the owner's registration ([E1](./owner-decisions.md#e1)). Nothing here edits the S11 plan
before that.

- **Total order:** S25 (merged) → PR #259 documentation prune, as the release list says → S26 → S27 →
  S28 → S29 → S30 → S31 → S32 → S11.
- **S11 dependency** becomes *R217.S01–S10 and R217.S12–S32 accepted*. Its §2 and §3 wording changes
  to match.
- **S11 journeys gained**, run in its pointer and viewport matrix:

| # | Journey |
| --- | --- |
| J18 | **Experience from empty.** x-empty → Place a View (new Presentation) → Present this → Look through and Update → first Guide → second Guide → reorder, start, opening Guide → Save → reload → Preview |
| J19 | **Long and dense Experience.** x-long and x-dense at 1440 × 900 and 820 × 1180: selection reveal, bracket, View reorder, removal and Undo |
| J20 | **Paths and playback.** x-paths: Add a Camera path, shape it through a doorway, set its duration, Play, scrub, Follow, Preview this move, then Preview, with editor and visitor poses in parity |
| J21 | **Removal across reload.** Remove a Stop, the Default View and a Presentation, then Undo, Redo, Save and reload; no orphaned Camera View or connection |

- **Register rows:** R217.S26–S32 enter the slice register as `approved` only at registration; until
  then the R217 README lists them in its proposed section. They consume and require the same gates and
  scopes as S25, and the register's gate tests gain the seven rows in the same change. The register's *No slice provides a gate, changes a
  persisted format or adds an F interface* sentence stays true.
- **Ownership table:** the T3 row's slice list gains S26–S32; the T1 row gains S28–S31 for the Stage
  shared files.
- **Non-goals:** *Experience Guide and Path redesign* gains *(S26–S32 build the accepted design; they
  are not a redesign)*.
- **Release:** an owner release adds `now.md` rows and either extends the campaign record to S26–S32
  or writes its own record. This plan writes neither.

## 7. Shared-file order

| File | Slices, in order |
| --- | --- |
| `packages/project-model/src/units/planning.ts` (+ its tests) | S26 → S27 → S31 |
| `apps/editor/src/lib/authoring/experience/experience-controller.svelte.ts`, `commands.ts` | S26 → S27 → S28 → S29 → S31 → S32 |
| `ExperienceGuide.svelte` | S26 → S27 → S31 → S32 |
| Card writers (`Experience*Writer.svelte`), `EditorCard.svelte` | S26 → S27 → S28 → S29 → S30 → S31 → S32 |
| `EditorIndex.svelte`, `experience-index-groups.ts` | S26 → S27 → S30 |
| `ExperienceDock.svelte` | S28 → S29 → S31 |
| `stage-facade.ts`, `StageSelectionLayer.svelte`, the spatial route | S28 → S29 → S30 → S31 → S32 |
| `ExperienceSnapshot.svelte` and the render host | S30 |
| `packages/camera-core/src/` (new time-map module only) | S32 |
| `packages/layout-core/src/` (route-versus-Wall read only) | S31 |

## 8. Not in S26

See [E15](./owner-decisions.md#e15). Stop-local guided Views go to T3 ([E3](./owner-decisions.md#e3)).
Nothing in S26 touches visitor chunks, the public route or a release payload.
