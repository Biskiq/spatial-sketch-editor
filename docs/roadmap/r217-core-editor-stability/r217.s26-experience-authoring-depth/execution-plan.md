# R217.S26 — execution plan: Experience authoring depth

**Status: approved by the owner, 2026-11-03 ([R1](./owner-decisions.md#owner-rulings-2026-11-03-final-planning-follow-up-for-pr-262)).**
Exception for these slices: no separate doc approval. Each block is that slice's plan. The
[inventory](./capability-inventory.md) owns the gap evidence and the Conservatory harvest closure; the
[decisions](./owner-decisions.md) own the owner directions (OD1–OD6) and the open choices.

## 1. Scope

Five sequential slices complete the creator workflow and harvest every Conservatory capability (OD2).
Each groups work that shares one authority seam and one review:

| Slice | Name | Closes | Seam |
| --- | --- | --- | --- |
| **R217.S26** | Structure and removal | Renames, plural Guides, Opening Guide, Guide start, View order, Back; Remove Stop, View, Presentation, Guide | Experience planners and the Card writers |
| **R217.S27** | Guided Views and visitor reach | Several guided Views per Stop, per-View holds, Include and leave out; *Open in free exploration*; welcome text | The Experience format, program, interpreter and visitor runtime |
| **R217.S28** | Views on the Stage | Markers, Place a View, move and aim, Lens and Eye height, framed Present this, Look through, snapshots, Stage coach | The Stage Camera seam and render host |
| **R217.S29** | Camera paths | Camera support for Travel between Stops and inside a Stop, path editing, duration, *crosses a wall*, Show ▾ | Camera connection planners and a Layout read |
| **R217.S30** | Timeline, playback and Preview | Time-scaled bar and total, Play, scrub, rig, Follow, Play from…, Preview this move; the Preview welcome chooser, guided controls, Places, back to the tour, end of the tour | The `camera-core` time map, the playback host and the visitor surface |

Each slice delivers the function **and** its visual and interaction completion: Conservatory's content
and behaviour inside the Round 2 shell, the [cross-cutting bar](./capability-inventory.md#28-cross-cutting-completion),
and the placeholder it replaces removed. The Round 2 shared shell and compact Guide are not restyled.

## 2. Order and dependencies

```text
S25 (merged) ─ S26 structure, removal ─ S27 guided Views ─ S28 Views on the Stage ─ S29 Camera paths ─ S30 playback, Preview
                                                                                   S11 final gate (needs all)
```

| Slice | Requires | Why |
| --- | --- | --- |
| S26 | S25 | Writers and controller are S25's |
| S27 | S26 | Removal rules must already cover guided Views; the format lands before anything is built on the Stop model |
| S28 | S27 | Markers number a Stop's guided Views; shares the route and Card |
| S29 | S28 | Paths join View markers, including steps inside a Stop |
| S30 | S29 | Travel and step seconds come from Camera connections S29 creates |

One implementation slice at a time (campaign rule). A slice may land as several commits, but it is
reviewed, accepted and merged once.

## 3. Rules for every slice

- **Start.** Through the T1 runbook start step with the T1 baton once the slice is registered and
  released. Gates and active scopes are rechecked at the trusted base.
- **Authority.** Writes go through the Experience controller's `run` into planners. Camera poses,
  routes, durations and samples come from `camera-core`. No component holds authored state. Session
  state (selection and its history, armed tool, Look-through provisional pose, playback clock, Show,
  snapshots) is never serialized.
- **Shared files.** The writer records a claim in the T1 baton before editing the files in §7.
- **Writer's verification (OD5, [E16](./owner-decisions.md#e16)).**
  - The writer owns the test code and checks: planner contract tests and
    `unit-acceptance-conformance` for new planners; controller and component tests for every new state,
    refusal and Undo label; the declared tier and the whole architecture lane; and the affected heavy
    Camera contracts where a slice consumes motion.
  - A **visual-token check** asserts the shell contract's colour roles, type roles, control metrics and
    44 px coarse targets on the slice's controls, in component tests or one short computed-style check.
  - There are no journey runs, no screenshots and no capture archive.
- **Owner acceptance.** The owner runs each slice's journeys manually; they are the acceptance. An
  independent review covers the domain and Camera parts the block names.
- **Placeholders.** A control a slice completes loses its *Comes with…* text in that slice.
- **Card metrics.** Experience Card interiors and controls follow [Card metrics](./card-metrics.md).
- **Brief first.** Each slice's PR opens with a brief, written after reading the merged code: typed contracts, payloads, signatures, and every choice where the plan leaves room. S27's brief stops for the owner's OK on the format; S28's brief settles snapshot rendering (E10) before implementation.

## 4. Fixtures

Built once in S26 as a test and browser seeding helper that calls the real planners. They are not
Conservatory's generators, and no product UI is added for them. They serve the writer's tests and the
owner's journeys.

| Fixture | Contents |
| --- | --- |
| **x-empty** | A Layout room, one Scene object, no Experience |
| **x-salon** | One Experience; five Presentations, one about a Scene object, one sharing a View with another; one Guide of six Stops with a revisit, a hold-less Stop and a nonadjacent continuation (→ 5); after S27, one Stop guiding three Views |
| **x-long** | x-salon's world with a 30-Stop Guide |
| **x-dense** | A 50-View Presentation and 40 Presentations |
| **x-paths** | x-salon plus Camera connections for two independent Travel pairs: one path shared by two transitions, one walled step inside a Stop (added in S29) |

## 5. Slices

### R217.S26 — Structure and removal

```text
WRITER: T3 (integrator)   REVIEW: independent (planners, compound scope); owner manual acceptance
VERIFICATION: architecture-integration   INTEGRATION ROUTE: R217.S11
DOMAIN: experience-update {label, entryGuideId}; experience-guide-update {label, entryStopId};
        experience-guide-create without guide-exists; experience-presentation-update + viewIds (permutation);
        camera-view-update (label only); experience-stop-remove; experience-presentation-view-remove (writes camera);
        experience-presentation-remove (writes camera); experience-guide-remove — rules per E4
```

**Scope: structure.**
- **Renames.**
  - The Experience, from the crumb's sibling menu (*Rename…* opens the crumb inline).
  - A Guide, from its Card title.
  - A View, from its Card title. A View listed by another Presentation says *Also in ⟨Presentation⟩*.
- **Additional Guides** ([E5](./owner-decisions.md#e5)): *Add to Guide* becomes a submenu of Guides and
  **New Guide…**. The Index shows every Guide and an *opens* tag on the Opening Guide.
- **Opening Guide:** the Guide Card's **Make this the opening Guide**.
- **Guide start** ([E6](./owner-decisions.md#e6)): a *Start* tag on the start Stop; **Start the tour
  here** in the Stop's `•••`.
- **View order:** reorder a Presentation's Views by dragging a tile (gold caret) or with Alt ←/→.
  Reordering is refused while a filter is on (*n shown · clear the filter to reorder*). The Index
  follows the order.
- **Back** in the Card ([E17](./owner-decisions.md#e17)).
- **World subject Card:** *Already presented in* with a cross-lens link that opens the Presentation in
  Experience, added if missing.

**Scope: removal.** Remove Stop, View, Presentation and Guide with the [E4](./owner-decisions.md#e4)
rules. Removing the selected subject selects its parent.

**Scope: fixtures.** The x-fixtures in §4.

**Visual and interaction completion.**
- **Rename fields** use the Card title metrics. Enter or blur commits and Esc cancels; an empty name
  refuses with *A name is needed*.
- **Menus and tags:** the submenu is the Round 2 menu with *again* hints kept. *Start* and *opens* are
  mono 10 px tags. View reorder uses the Stop cards' drag affordance and caret.
- **Danger items** are red, at the end of `•••` after a rule. Choosing one opens a consequence block in
  place in the Card, not a modal: effect lines, a red **Remove** and **Cancel**. Esc cancels and focus
  returns to `•••`. Removing the Default needs a new Default chosen in the block.
- **Refusals** keep the item disabled with the reason as its hint. After a removal, a fading message
  names what remains.

**Owner acceptance journeys (manual).**

| # | On | Do | Expect |
| --- | --- | --- | --- |
| X26.1 | x-salon | Rename the Experience, the Guide and the shared View; Undo each | Names change everywhere they appear; three Undo entries; Esc and empty names add none |
| X26.2 | x-salon, Guide open | Presentation `•••` → Add to Guide ▸ New Guide…, *Short tour* | A second, active Guide with that Presentation as Stop 1; *opens* stays on the first; one Undo removes Guide and Stop |
| X26.3 | after X26.2 | Make *Short tour* the opening Guide; Head Preview with nothing selected | The tag moves; Preview enters *Short tour*'s start Stop |
| X26.4 | x-salon | Start the tour at Stop 3; drag Stop 3 to the end | *Start* stays on Stop 3; Preview starts there |
| X26.5 | x-dense | Reorder Views by drag and Alt →; try while filtered; Save and reload | Order kept and mirrored in the Index; refused while filtered; Default unchanged |
| X26.6 | x-salon | Select Stop 2, then a View, then press Back and Alt+← | *‹ Stop 2* in the kind line returns to Stop 2; Undo history unchanged |
| X26.7 | x-salon | Remove Stop 2; Undo; Redo | Connectors re-resolve; Undo restores the Stop with its id and fields |
| X26.8 | x-salon | Remove the Stop that Stop 1 continues to | The block names Stop 1's fallback |
| X26.9 | one-Stop Guide | Open its `•••` | *Remove Stop* disabled with its reason; *Remove Guide* on the Guide Card |
| X26.10 | x-salon | Remove a Default View; remove the shared View from one Presentation | A new Default is required; the shared Camera View survives with *Still used by* |
| X26.11 | x-salon | Remove a Presentation with two Stops; Save; reload | Its Stops, unshared Views and connections are gone; nothing orphaned |
| X26.12 | after X26.2 | Remove the Opening Guide, then the last Guide | The other becomes Opening; then *No Guide yet* |
| X26.13 | 820 × 1180, keyboard | New Guide and a removal in the Card sheet, by keyboard | Reachable, visible focus, Esc cancels with no entry |

### R217.S27 — Guided Views and visitor reach

```text
WRITER: T3   REVIEW: independent (format, program, lowering, interpreter, visitor runtime); owner manual acceptance
VERIFICATION: architecture-integration, plus the visitor and public-isolation contracts   INTEGRATION ROUTE: R217.S11
DOMAIN: Experience unit format bump — Stop guided-View sequence {viewId, holdSeconds?, step transition?};
        Presentation free-exploration flag; Experience welcome text; experience-stop-update over the sequence;
        experience-presentation-update + flag; experience-update + text; ExecutionProgram, lowering and
        interpreter for in-Stop steps; visitor runtime advance and reach. Experience format 2 → 3, ExecutionProgram@3, provides T3.camera-experience-cutover@2 (R6)
```

**Scope.**
- **Format** per [E3](./owner-decisions.md#e3), [E15](./owner-decisions.md#e15) and R6: a clean
  version break with strict refusal and no migration; fixtures and seeded projects are regenerated. The
  PR adds the `T3.camera-experience-cutover@2` gate-register row.
- **Timing (R4):** timed Views advance automatically and an untimed final View waits for Next.
  Reordering re-resolves transitions without inventing Camera paths.
- **Stop Card shot list** (Conservatory *Guided views*):
  - numbered rows with grip, snapshot slot, name, the Default ◆ and an *Entry* tag on the first;
  - a per-View **Hold** stepper and × to leave out (disabled on the last View, *A Stop shows at least
    one View*);
  - drag and Alt ↑/↓ to reorder;
  - **Not in this Stop**, folded past 4, with **Include**;
  - the note *Reordering here changes only this Stop*.
- **Removal rules** of S26 extended to guided Views ([E4](./owner-decisions.md#e4)).
- **Stop cards** show *n views* and *again*. **Connectors and continuations** read the Stop's last
  guided View as the exit and its first as the entry.
- **Reach:**
  - the Presentation Card's *Open in free exploration* switch, *All n Views; opens at the Default*;
  - the View Card's reach line (*Free exploration · opens here*, *Hidden from free exploration*);
  - the Guide Card's *n Views only found this way*.
- **Welcome text** on the Guide Card, under More: bounded plain text like Information text.
- **Visitor runtime:** guided playback advances a Stop's Views by their holds, with Cut steps for now
  (Travel steps arrive with S29). Free exploration lists only open Presentations, in View order.

**Visual and interaction completion.** Conservatory's shot-list composition scaled to the 288 px Card,
in Round 2 row metrics. Dimmed rows for *Not in this Stop*. The switch uses the Round 2 toggle. The D5
*Include* placeholder and *Comes with Stop-local Views* are removed.

**Owner acceptance journeys (manual).**

| # | On | Do | Expect |
| --- | --- | --- | --- |
| X27.1 | x-salon | Stop 2: Include two Views, set holds 4 s and 3 s, drag the third to first | *Entry* moves to the new first View; the Default ◆ is unchanged; each edit one Undo entry |
| X27.2 | — | Leave out Views until one remains | The last × is disabled with its reason |
| X27.3 | — | Stop 5 revisits the same Presentation with a different sequence | Both Stops keep their own sequences; the Presentation is unchanged |
| X27.4 | — | Preview the Guide | Stop 2's Views advance by their holds and wait for *Next* between Stops |
| X27.5 | x-salon | Switch a Presentation out of free exploration | The View Card says *Hidden from free exploration*; the Guide Card count changes; Preview's free list omits it |
| X27.6 | x-salon | Remove a View guided by two Stops (S26 rules) | The block names both Stops; their sequences lose it |
| X27.7 | — | Write welcome text; Save; reload | Kept after reload; bounded length refuses past the limit |
| X27.8 | old-format project | Open it | A strict, readable refusal; no partial load |

### R217.S28 — Views on the Stage

```text
WRITER: T3 with a T1 shared-file claim   REVIEW: owner manual acceptance (T1 reviews the mark layer, Camera seam and render host)
VERIFICATION: affected-subsystem   INTEGRATION ROUTE: R217.S11
DOMAIN: camera-view-update (eye, target, fov); capture-bind and presentation-update view with a gesture or framed pose;
        Bring into view (existing Stage Camera request); snapshots are a derived render (E10)
```

**Scope: markers and placement.**
- **View markers.**
  - In Plan: a dot at the eye, a short frustum wedge and a round aim handle, world-anchored and
    screen-sized.
  - In 3D: a camera glyph, with labels for the selected View and the selected Stop's guided Views,
    numbered.
  - States are *selected*, *strong*, *normal*, *dim* and *hidden*. Labels show for at most 12 strong
    markers; frustums for at most 24 Views.
  - Markers are Stage marks, not World marks (D13 stays). Selecting one never moves the Camera.
- **Place a View** dock key: press where the camera stands, drag toward what it sees.
  - A drag under 0.5 m places nothing and says so.
  - The View goes into the visibly selected Presentation, otherwise into a new Presentation whose
    title opens for naming. It never adds a Stop.
  - Height per [E8](./owner-decisions.md#e8).
- **Move** (drag the dot) and **aim** (handle): a live ghost, one Undo entry per drag, Esc cancels.
- **Lens** and **Eye height** steps and the hero tag ([E7](./owner-decisions.md#e7)).
- **Present this** frames the subject with Bring into view, then captures it
  ([E9](./owner-decisions.md#e9)). In Plan it arms Place a View aimed at the subject.
- **Empty Stage coach:** *Start your experience*.

**Scope: Look through.**
- **Entry:** from the View Card, a double-click on a marker or thumbnail, or a Stop's shot-list row.
- **Through posture:** the View's exact pose and fov, a gold capture frame at a fixed aspect fitted
  beside the Card and Guide, and the pill *Looking through ⟨View⟩ · Exit View Esc*.
- **Re-aim:** drag to re-aim and scroll to step. The pill adds *moved* and a gold **Update View**.
  Lens and Eye apply live.
- **Update View** writes once; a shared View first says *Also changes ⟨Presentation⟩*.
- **Exit View** and Esc return to the exact standpoint and reading through the Stage's Camera return
  seam.
- **Capture** while looking through captures the provisional pose as a new View.

**Scope: snapshots.** Real snapshots in every slot ([E10](./owner-decisions.md#e10)), including the
shot list. They render lazily for visible slots at the capture-frame aspect and are cached by pose and
source revision.

**Visual and interaction completion.**
- **Colours:** leaf green for Camera marks, gold for selection.
- **Targets:** dot and handle have 44 px coarse targets.
- **Mode pills** sit top-centre. Helpers are hidden inside the capture frame. The View Card swaps to
  Exit View and Update View.
- **Esc** unwinds menu → place → Look through → selection → Guide.
- **Snapshot slots** keep the placeholder geometry, crop like Round 2's `slice`, and carry the ◆ and
  number badges.
- The *Comes with View placement* and *Comes with Look through* texts are removed.

**Owner acceptance journeys (manual).**

| # | On | Do | Expect |
| --- | --- | --- | --- |
| X28.1 | x-salon, Plan | Select a Presentation, a View and a Stop; pan and zoom | Strong, dim and selected markers; Stop Views numbered in 3D; marker size constant; the Camera never moves on selection |
| X28.2 | x-salon / x-empty | Place a View with a Presentation selected, then with nothing selected | Into that Presentation; or a new, named Presentation; one Undo each; no Stop |
| X28.3 | x-salon | Move and aim a marker; Esc mid-drag | Live ghost; one entry per drag; no change on Esc |
| X28.4 | x-salon | Lens Close, Eye Seated; an off-preset View | *85 mm*, aim kept, hero tag updated; *Custom* shown |
| X28.5 | x-salon, 3D and Plan | Present this on the subject | 3D: the Stage frames it and the first View matches the hero; Plan: placement armed toward it |
| X28.6 | x-salon | Look through, re-aim, Update View; again and Esc | One *Update View* entry; Esc returns to the same Plan standpoint with no entry |
| X28.7 | — | Look through the shared View and Update; Capture while looking | The *Also changes* notice; a new View from the provisional pose |
| X28.8 | x-dense, x-empty | Scroll the grid; open an empty Experience | Only visible snapshots render; the Stage coach shows |

### R217.S29 — Camera paths

```text
WRITER: T3 (Camera) with a T1 shared-file claim   REVIEW: independent (planners, Layout read, camera-core consumption); owner manual acceptance
VERIFICATION: architecture-integration, plus the affected heavy Camera contracts   INTEGRATION ROUTE: R217.S11
DOMAIN: camera-connection-create; camera-connection-update {anchors, timing.forward|reverse.durationSeconds};
        layout-core route-versus-Wall read (E12); step Travel inside a Stop (E3)
```

**Scope.**
- **Camera support** ([E11](./owner-decisions.md#e11)): *Add a Camera path* on a gap, between Stops
  and between a Stop's guided Views. Steps inside a Stop gain the Cut/Travel choice in the shot list.
- **Connectivity** ([R7](./owner-decisions.md#r7)): one Camera graph may carry independent Travel
  pairs A–B and C–D. A Cut adds no Camera edge. Camera-unit admission and runtime force the one
  connectivity policy; a direct Scene document keeps the single-component default.
- **Paths on Stage**, only while the Guide is open:
  - the evaluated route: selected gold, neighbours solid, the rest faint;
  - Cut as a dotted *CUT* link;
  - Stop numbers on entry Views in the whole-Guide reading.
  - Paths are shown in 3D and edited in Plan.
- **Path** dock key, enabled with a transition or step selected. A click on the path adds an interior
  anchor. Drag a point; select it (gold, echoed in the Card); Delete removes it. **Straighten** removes
  all points.
- **Path facts:** *3 points · 12.4 m*.
- **Duration:** a stepper over the Camera's per-direction duration, *Auto · n s* until set. Connectors
  and Stop cards show seconds. Camera clamps automatic Travel to 1.25–4.8 s, so a short pair such as
  x-salon's Stop 1 → 5 evaluates near 1.3 s; an authored duration is the only way past that clamp.
- **Crosses a wall** ([E12](./owner-decisions.md#e12)) and the **shared path** note.
- **Entry or exit change** message: *Travel Stop 2 → 3 now joins different Views*.
- **Show ▾** ([E14](./owner-decisions.md#e14)).

**Visual and interaction completion.**
- **Shape carries species:** ● View endpoint, ○ path point, gold selected point.
- **Targets:** points have 44 px coarse targets.
- **Insertion** only happens with Path armed. The pill reads *Path — click the path to add a point ·
  Done Esc*.
- The *Comes with path editing* texts are removed.

**Owner acceptance journeys (manual).**

| # | On | Do | Expect |
| --- | --- | --- | --- |
| X29.1 | x-salon | Set Stop 1 → 5 to Travel (a named gap); add its path; Undo | *travel · 1.3 s* (Camera's automatic clamp); Undo restores the gap |
| X29.2 | x-paths | Set Stop 2 → 3 to Travel (the available gap); add its path | The connector shows the Travel's seconds; Preview travels from Stop 2 to Stop 3 |
| X29.3 | x-paths, Plan | Arm Path while the seeded walled step inside Stop 2 is selected; add a point; drag it through the doorway | Warning clears once through; one entry per add and drag |
| X29.4 | — | Select a point and Delete; Straighten; Duration 9 s, then Auto | Each one entry; seconds update everywhere |
| X29.5 | x-paths | Edit the shared path; change Stop 2's entry View | The note names the other use; the change message names the new gaps; the old path remains |
| X29.6 | x-paths | Show ▾ → Selection only; frustums off; close the Guide | Disclosure only; *2 off*; no paths without a Guide |
| X29.7 | — | Choose Cut | Dotted CUT link; Path disabled with *A Cut has no travel path*; the connection kept |

### R217.S30 — Timeline, playback and Preview

```text
WRITER: T3 (Camera, Experience)   REVIEW: independent (time map, playback host, visitor surface); owner manual acceptance
VERIFICATION: architecture-integration, plus the affected heavy Camera contracts and the public-isolation contracts
INTEGRATION ROUTE: R217.S11
DOMAIN: Guide time map in camera-core beside experience-controllers.ts (E2); visitor surface per E15; no planner
```

**Scope: timeline and playback.**
- **Time map:** guided-View holds; steps and continuations at Cut 0 s or Travel at Camera duration;
  hold-less Stops as *waits* ([E13](./owner-decisions.md#e13)). It is the only source for the bar,
  the total, scrub and playback.
- **Bar:** time-scaled segments replace D9's ordinal ones. Stop cards gain their time and per-View
  segments. The total reads *0:00 / 0:41 + 2 waits*.
- **Playback:** Play/Pause (Space), scrub, the playhead, Stop glow and segment fill, and cards that
  follow the moment.
- **Camera rig:** a puck on Stage.
- **Follow camera:** the pill *Following the camera · travelling to Stop 3 · Stop following Esc*; off
  or Esc returns to the standpoint.
- **Entries:** **Play from this Stop**, **Play from the start**, **Preview this move**, and the Guide
  Card's tour time.
- **Lifecycle:** an accepted edit stops the clock and re-derives it. Look through, Place, Path and
  Preview stop playback. Playback writes nothing.
- **Reduced motion:** Follow and the rig settle as the visitor's reduced-motion profile does.

**Scope: Preview** ([E15](./owner-decisions.md#e15)).
- **Welcome chooser:** the Experience name and welcome text, *Take the guided tour* (*n stops · about
  0:41*) and *Explore freely* (*n places*).
- **Guided controls:** Pause/Resume, *Next stop*, *Finish tour*, *Explore freely*.
- **Places** drawer: open Presentations and their Views.
- **Back to the tour · Stop N.**
- **End of the tour:** *Keep exploring — including views the tour skipped* and *Start the tour again*.
- **Guide Card mode cards** open Preview guided or free.
- Visitor chunks stay free of editor modules.

**Visual and interaction completion.**
- **Timeline:** Round 2's 26 px gold Play and 8 px bar, hatched *waits*, and a thin gold playhead.
  Only the playing Stop glows. The puck follows the grammar's *Camera rig*.
- **Preview:** the visitor surface takes Conservatory's composition with the visitor tokens.
- Every *Comes with Camera playback* text is removed.

**Owner acceptance journeys (manual).**

| # | On | Do | Expect |
| --- | --- | --- | --- |
| X30.1 | x-paths | Open the Guide | Segments by holds, steps and Travel; *waits*; the total matches |
| X30.2 | — | Play; scrub to mid-Travel; Space | Playhead, glow and puck together; the editor pose equals the visitor's at the same moment; pauses at *waits* |
| X30.3 | — | Follow; Esc | Through the moving Camera; back to the exact standpoint |
| X30.4 | — | Play from Stop 4; Play from the start; Preview this move | Each starts where it says; the move stops after its stretch |
| X30.5 | — | Change a hold while playing | The clock stops and re-derives; history has only the edit |
| X30.6 | — | Head Preview → welcome → guided tour → Explore freely → Back to the tour → finish | Each screen as described; *Keep exploring* lists the Views the tour skipped |
| X30.7 | — | Guide Card mode cards | Each opens Preview in its mode |
| X30.8 | reduced motion, x-long | Play with Follow across 30 Stops | Travel settles; cards follow; no stale clock after closing the Guide |

## 6. R217, S11 and milestone sequencing

Proposed for the owner's registration ([E1](./owner-decisions.md#e1), OD1). Nothing here edits the S11
plan or the milestone before that.

- **Total order:** S25 (merged) → PR #259 documentation prune → S26 → S27 → S28 → S29 → S30 → S11.
- **Milestone:** R217 certifies a stable product. The milestone's *Camera/Experience authoring* row
  moves advanced path authoring and transport from *Not required* to required. R217's outcome gains
  Experience authoring depth. Its non-goal *Experience Guide and Path redesign* gains *(S26–S30 build
  the accepted design)*.
- **S11:** the dependency becomes *R217.S01–S10 and R217.S12–S30 accepted*. It stays lightweight
  (R2), with no additional acceptance rounds, and gains four owner-run journeys:

| # | Journey |
| --- | --- |
| J18 | **Experience from empty.** x-empty → Place a View → Present this → Look through and Update → first and second Guide → guided Views in a Stop → reorder, start, opening Guide → Save → reload → Preview |
| J19 | **Long and dense Experience.** x-long and x-dense: selection reveal, bracket, View and shot-list reorder, removal and Undo |
| J20 | **Paths and playback.** x-paths: Add a Camera path, shape it, set duration, Play, scrub, Follow, Preview this move, then the visitor Preview end to end |
| J21 | **Removal across reload.** Remove a Stop, the Default View and a Presentation; Undo, Redo, Save and reload; nothing orphaned |

- **Register rows:** each slice's own PR adds its register row and gate-test entry. S27's row records
  the format change and `T3.camera-experience-cutover@2`, and the register sentence *No slice … changes
  a persisted format* gains that exception.
- **Ownership:** the T3 row gains S26–S30 and the T1 row gains S28–S29.
- **Exception for these slices: no separate doc approval** (R1). Each slice's PR carries its plan,
  code, contract updates and tests; the owner accepts it in the PR (R3).
- **After the final slice:** once everything is accepted, the owner triggers reconciliation, lock and
  promotion (OD6); this plan does not prepare it.

## 7. Shared-file order

| File | Slices, in order |
| --- | --- |
| `packages/project-model/src/units/{types,planning,validate}.ts` (+ tests) | S26 → S27 → S29 |
| `packages/project-model/src/units/experience/*`, `program` types | S27 |
| `apps/editor/src/lib/visitor/*` (runtime, Preview surface) | S27 → S30 |
| `experience-controller.svelte.ts`, `commands.ts` | S26 → S27 → S28 → S29 → S30 |
| `ExperienceGuide.svelte` | S26 → S27 → S29 → S30 |
| Card writers (`Experience*Writer.svelte`), `EditorCard.svelte` | S26 → S27 → S28 → S29 → S30 |
| `EditorIndex.svelte`, `experience-index-groups.ts` | S26 → S27 → S28 |
| `ExperienceDock.svelte` | S28 → S29 |
| `stage-facade.ts`, `StageSelectionLayer.svelte`, the spatial route | S26 (Back) → S28 → S29 → S30 |
| `ExperienceSnapshot.svelte` and the render host | S28 |
| `packages/layout-core/src/` (route-versus-Wall read only) | S29 |
| `packages/camera-core/src/` (new time-map module only) | S30 |

## 8. Not in S26–S30

The non-Conservatory items in the [harvest closure](./capability-inventory.md#3-conservatory-harvest-closure-od2)
stay out: the phone Preview frame, Experience removal, removing a Camera path on its own, path editing
in 3D, numeric Camera precision, narration, captions, cues, Gates, Detours, branching and publishing.
