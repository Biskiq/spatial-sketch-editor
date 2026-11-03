# R217.S25 — Conservatory design harvest and replacement plan

**Status:** for owner review (2026-11-02). PR #261 is **not accepted**. No production code changes
until the owner approves this harvest. Not a governing reference: PLATE and the other references
are unchanged until visual acceptance.

**Authorities (owner direction, 2026-11-02).**
[Conservatory](../../../../prototypes/experience-ux-alternative/README.md) owns Experience
information architecture, Presentation/View/Guide/Stop composition, spatial interaction and
workflow. [Production shell Round 2](../../../reference/decisions/production-shell-round-2-ratification-2026-10-23.md)
owns the shared Head, Index, Card, Dock and visual treatment. The domain contracts
(`packages/project-model/src/units/types.ts`, `planning.ts`, `apps/editor/src/lib/authoring/experience/commands.ts`)
own what exists.

**Sources studied:** the prototype's source (`app/main.js`, `styles/*.css`, `index.html`), its
design rationale, visual language and scope/critique, and the running prototype at 1440×900
(Salon tour, Guide open, Stop 2 and a Presentation selected). Measurements below come from it.

**Classes.** **W** exists in the domain; S25 wires and presents it. **P** missing; S25 shows an
honest disabled placeholder because the composition needs the slot. **S26** missing authoring
capability, handed to S26. **X** prototype shortcut, never promoted.

## 1. Owner decisions (2026-11-02)

| # | Decision |
| --- | --- |
| D1 | **Capture** lives in the dock and always captures the current viewpoint: into the *visibly selected* Presentation (or the Presentation of the visibly selected View), otherwise into a new standpoint Presentation. **Present this** on the subject Card is the only subject-based creation. No Index *New*, no Card Capture. Never infer a subject from selection, never act on hidden Presentation focus, never change an existing Default View. Framing that is not supported (Plan capture, auto-framing a subject) stays truthful and goes to S26 |
| D2 | Capture and Present this **never add a Stop**. Adding to a Guide is a separate visible act |
| D3 | Index **Guides rows** choose and open a Guide (one active); the **dock Guide key** shows or hides the instrument for the active Guide; the instrument's **×** closes it. No Guide buttons on Cards |
| D4 | **Thumbnails:** every slot keeps its Conservatory size with a neutral placeholder in S25; real rendering moves to S26 |
| D5 | **Stop views:** one Entry row (View, Entry tag, Hold) plus the Presentation's other Views dimmed under *Not in this Stop* with a disabled *Include* |
| D6 | **Cut/Travel** has one home, the Transition Card (opened from a connector). The Stop Card's *After this Stop* names only where Next goes |
| D7 | This harvest is committed to PR #261 for review |

## 2. Design harvest

### 2.1 Composition and dimensions (Conservatory, 1440×900, Card open)

| Part | Conservatory | S25 carries it as |
| --- | --- | --- |
| Head | 52 px; project, World/Experience, history, Preview | Round 2 Head unchanged (one lens switch, one Preview) |
| Index | 248 px column, rail or drawer; rows 46 px | Round 2 Index treatment with Conservatory's Experience groups and row density |
| Stage | Dominant; never reflows on selection; furniture inset 12 px | Round 2 Stage and reading control |
| Card | 324 px overlay docked right, appears only with a selection, Stage never reflows | Round 2 Card (serif title, More, `•••`) with Conservatory's Experience content |
| Guide instrument | Dark forest, 14 px radius, inset 12 px, bottom-centred, width follows content (min 560, ≈760 for 3 Stops), bounded left of the Card: 844 × 163 here (header 48, Stop row ≈ 70, overview ≈ 30) | Round 2 instrument material in the lower column, with this layout |
| Stop card | 190 × 58 light stone on the dark instrument (172 at ≤ 980, 148 at ≤ 620); thumbnail 62 × 46 with number badge; name 13/600; meta 11 px; View-segment bar 4 px | Same; thumbnail is a placeholder (D4); one segment (one entry View) |
| Connector | 46 px; chip 22 px high, `✂` (Cut) or `↗ 8s` (Travel); red when a path crosses a wall | Same chip; Cut or Travel only (duration and path validity are S26) |
| Overview bar | 16 px time-scaled track: Stop segments with numbers, Travel links, white bracket for cards in view, gold playhead, drop caret | Ordinal track (no time scale until S26 playback): segments, bracket, selection, drop caret |
| Responsive | > 980: Index column, Card right, Guide left of Card. 621–980: Index drawer, Card a bottom sheet above the Guide (≤ 52 %), Guide full width. ≤ 620: Guide compact (overview only) | Same breakpoints through the Round 2 shell's container rules |

### 2.2 Visual roles

Round 2 wins on treatment: gold marks **selection only** (D6 of Round 2). Conservatory's other
gold uses move: Default ◆ to ink, the playhead and Follow to Round 2's state roles (S26), Preview
stays the Round 2 Head control. Kept from Conservatory: light Stop cards on the dark instrument,
gold ring on the selected Stop card and connector, an **open** Guide shown distinctly from
selection (tint plus an *Open* chip on its Index row), serif for authored names (Card title, Guide
name, *Visits* Presentation; the shared Card already uses `--shell-serif`), sans for tools,
tabular numbers, disabled at 40 % with the reason in its description.

### 2.3 Information architecture

- **Index.** The Experience crumb (Round 2 scope-model) with a sibling menu listing the source's
  Experiences and **New Experience**; Presentation creation is not here. Then **Guides** (plural):
  one two-line row per Guide (icon, name, *n stops*), *Open* chip on the active one. Then
  **Presentations** with a count: two-line rows (thumbnail 42 × 30, name, *n Views · Stops 2, 5* or
  a dashed *free*), a twist that expands Views (one Presentation open at a time, following
  selection; 8 Views then *+N more — see all in the Card*), View rows with an on-tour dot or free
  ring and ◆ for Default. Search appears from 8 Presentations. Empty states explain the doors and
  never repeat a button.
- **Card kinds.** Presentation, View, Stop, Transition, Guide, and a Scene subject seen from
  Experience. Kind line with parent link (*View · in The Pleyel piano*), serif name, one action
  row with at most one primary, sections with hairlines, `•••` for the rest.
- **Guide.** An invoked context, closed on every entry to the lens. One active Guide. It stays
  open across Presentation and View work; selecting a Stop, connector or the Guide name keeps it
  open; × (or Esc after the selection is cleared) closes it with its helpers.

### 2.4 Cards (Conservatory content)

| Card | Content |
| --- | --- |
| Presentation | Kind *Presentation · about ⟨subject⟩*. Views grid, 2 columns at 16:10 (3 columns past 8 Views; filter and *On tour / Free* past 12), Default ◆ badge, tour dot. *Visitors reach it*: *On the tour at* Stop chips. `•••`: Rename, Add to Guide |
| View | Kind *View · in ⟨Presentation⟩*. Hero image. *Make default* or the Default badge. *Where visitors see it*: Stop rows (*entry*). Look through as primary |
| Stop | Kind *Stop 2 of 5 · ⟨Guide⟩* with ‹ › stepping; no title. *Visits (again)* block: thumbnail 92 × 62 with number, serif Presentation name, *Open Presentation*. *Guided views*: shot rows (thumbnail, name, ◆, Entry tag, Hold stepper). *Not in this Stop* (folds past 4). *After this Stop*: *Visitor presses Next → ⟨3⟩ Manuscripts*, or *Last Stop* note. `•••`: Open Presentation, Move earlier/later (start/end past 6 Stops) |
| Transition | *Stop n → Stop n+1*; Cut/Travel segmented control; *leaves from / arrives at* ends; Movement (duration, path, wall warning); *Preview this move* |
| Guide | Rename, Add stop, Stops and reach summary (*two ways in*) |
| Scene subject | Kind *Scene object · Open in World*. Primary **Present this**. *Already presented in* rows. Placement line. No World editing forms |

### 2.5 Guide instrument interaction

Header: *Guide* kicker and serif name (selects the Guide Card), *n stops*, transport (Play, time,
Follow camera), **Add stop** (menu of Presentations, *again* hint), ⌄ compact, × close. Body:
horizontal Stop cards joined by connectors, scrolling to reveal the selection; the overview bar
below. Click a card selects the Stop; click a connector selects its transition; drag a card to
reorder (gold caret); drop on the overview to move far; drag a Presentation from the Index onto
the Guide to insert at the caret; ←/→ walk, Alt ←/→ reorder, Enter selects; `•••` on the selected
card. Empty Guide: a dashed drop zone that names both ways to add.

### 2.6 Stage and navigation

Selecting never moves the Camera; Look through, Follow and Fit are the deliberate exceptions.
View markers (Plan) and camera glyphs (3D), Guide paths only while a Guide is open, a *Show ▾*
popover and mode pills belong to placement, Look through and playback. Esc leaves the foremost
mode, then clears the selection, then closes the Guide. Undo lives in the Head; Card navigation
never undoes.

## 3. Classification and S25 gap plan

| Behaviour | Production today (rejected S25) | Class | S25 replacement |
| --- | --- | --- | --- |
| Experience switch, New Experience | *Create Experience* sits under Presentations; switch is a bare `details` | W | Crumb sibling menu with Experiences and **New Experience** |
| Guides group, plural, one active | Single *Guide* toggle naming one Guide; a `select` with *None* inside the panel | W | One row per Guide (`chooseGuide`); *Open* chip; no select, no *None* |
| First Guide | Form inside the panel (*Guide label*, *Create first Guide*) | W | Index *No Guide yet* row opens the empty instrument; its serif name is editable until the Guide exists (no rename afterwards, see S26); **Add stop** creates the Guide with that name and its first Stop (`guideCreateIntent`) |
| Second Guide | — | S26 | Domain refuses `guide-exists`; no placeholder needed |
| Presentation rows: thumbnail, *n Views · Stops*, expand to Views, search ≥ 8 | One-line rows, camera icon, filter always shown | W (+P thumbnail) | Two-line rows; Views expand with tour dot and ◆; search from 8 |
| Dock | Select, Capture, Guide | W + P | Select · **Place a View** (disabled, S26) · **Path** (disabled, S26; shown with a Guide) │ **Capture** · **Guide** (D1, D3) |
| Capture into a Presentation | *Capture and rebind* hidden in More; always replaces the Default | W | Dock Capture targets only the visibly selected Presentation/View; sends the existing `defaultViewId` so the Default is kept (an unset Default is filled and said so); refuses in 2D with the existing words |
| New standpoint Presentation | Dock Capture attaches any selected Scene entity and adds a Stop when a Guide is open | W | Dock Capture with nothing selected: `subjectEntityId: null`, `guideId: null` (D1, D2) |
| Present this | — (World forms shown instead) | W | Subject Card primary: capture-bind with that subject explicitly, no Stop; disabled in 2D with the reason |
| Subject Card in Experience | World editing Card with forms | W | Identity, *Open in World*, Present this, *Already presented in* (`presentation.subject`), Bring into view |
| Presentation Card | Default `select`, *Information text* textarea, *Save Presentation*, *Guide* button | W (+P) | Views grid (placeholder thumbnails) with ◆ and tour dots; *Visitors reach it*; Information text in More, committed on blur; rename inline. No `•••` until removal exists (S26); Conservatory's *Add to Guide* is dropped because Add stop is its home. No Save, no Guide button |
| Reorder a Presentation's Views | — | S26 | No `viewIds` order field; grid shows no drag hint |
| View Card | — (no View selection) | W + P | New UI focus only (no domain change): hero placeholder, *Make default* (`setDefaultView`), *Where visitors see it*; **Look through** disabled (S26) |
| Stop Card | Four form fields and *Save Stop* | W + P | Kind with ‹ ›; Visits block; Entry row (change entry View from the Presentation's Views, Hold stepper, each edit one `stopUpdateIntent`); *Not in this Stop* dimmed with disabled Include (D5); *After this Stop*: Next / a chosen Stop / End, plus a link row to the transition |
| Transition Card | Transition `select` inside the Stop form | W + P | Cut/Travel (D6) on the continuation; Travel gaps from `travelGaps`; ends; Movement (duration, path) and *Preview this move* disabled (S26) |
| Guide Card | — | W | Stops, entry Guide and reach summary, read-only. Rename is S26 (no Guide label update); Add stop stays in the header |
| Stop sequence | Vertical floating list, ↑/↓ buttons | W | Horizontal Stop cards, connectors, overview bar; drag, overview drop, Alt ←/→ via `guide-order` permutations |
| Insert a Stop | *Insert selected Presentation as a Stop* | W | Header **Add stop** menu and Index drag, after the selected Stop (`stopCreateIntent`, chosen Presentation) |
| Remove a Stop, Presentation or View | — | S26 | No domain operation; `guide-order` refuses removal. Not shown |
| Transport | — | P | Play, time and Follow disabled in the header, reason *Playback arrives with Camera playback* |
| Thumbnails | — | P | Neutral frames at Conservatory sizes (D4) |
| Preview | Head only, entry precedence, exit restores Guide and Card | W | Unchanged |
| History and persistence | F4 Undo/Redo, Save | W | Unchanged; every new control goes through the controller's `run` |
| Esc order, Guide closed on lens entry | Partly | W | Esc: menu → selection → Guide; closed on every lens entry |

**One home per action.** Capture: dock. Present this: subject Card. New Experience: crumb menu.
Open a Guide: Index row (show/hide: dock key; close: ×). Add a Stop: Guide header *Add stop*, or
dragging a Presentation onto the Guide.
Reorder: drag or Alt arrows in the Guide (`•••` items are the keyboard-free fallback on the same
command). Cut/Travel: Transition Card. Default: View Card or tile menu. Removed: *Save
Presentation*, *Save Stop*, Card *Guide* buttons, *Capture and rebind*, *Insert selected
Presentation as a Stop*, the *None* Guide option, and the technical option strings (*Cut (no
travel)*, *Travel (supported connection only)*, *Presentation Default*, *Hold (seconds, blank for
none)*, *Information text (plain, 4,000 code points)*).

**Files.** Replace `ExperienceGuidePanel.svelte` (instrument), `ExperiencePresentationWriter.svelte`,
`ExperienceStopWriter.svelte`, `ExperienceDock.svelte`, the Experience branch of
`EditorIndex.svelte` and `experience-index-groups.ts`; extend `experience-card-model.ts`; add View,
Transition, Guide and Scene-subject writers. In the route, Scene selection in the Experience lens
shows the subject Card. Controller changes are call-shape wiring on existing intents only:
explicit `subjectEntityId` and `guideId: null` for capture-bind, kept `defaultViewId` on capture
into, `insertStop(presentationId, afterStopId)`, `moveStopTo(stopId, index)`, per-field Stop and
Presentation updates. Focus gains `viewId` and a selected transition (UI state, never persisted).

**Kept from the rejected S25** (concise technical decisions): Experience lives in the shared homes
and the full-surface `ExperienceSurface.svelte` stays retired; the controller is the only command
path and the homes context holds no source, selection or Camera state; the Guide is closed on every
lens entry; Preview has one entry in the Head with precedence focused Stop → the open Guide's entry
Stop → selected Presentation → the Experience's entry Guide → the guide-free list, and exit restores
the Guide and Card; Capture is a 3D-reading action, because a Plan capture would record a
perspective the creator never saw.

**Checks after approval** (no screenshot archive, no parity scripts): the slice's
affected-subsystem tier; targeted tests for the Index switcher and New Experience, plural Guides
and one active context, Stop and connector selection reaching their Cards, reorder and insert
intents, per-field Stop edits, Capture keeping the Default and never binding a subject or Stop,
Present this, placeholders announcing their reason, Preview and Undo; keyboard reach (Stop cards
←/→, Alt ←/→, Enter, Esc), labels and focus rings; a live check at 1440×900, 1280×800, 1180×820 and
820×1180 handed to the owner as the working UI.

## 4. S26 handoff: missing authoring capability

| Capability | Today | Note for S26 |
| --- | --- | --- |
| **View placement** in Plan (press where the camera stands, drag toward what it sees); View markers in Plan and camera glyphs in 3D; drag to move, handle to aim | No markers or placement | `camera-view-update` exists in the domain with no editor caller |
| **Look through / Update View / Exit View**: gold capture frame, mode pill, provisional edit, return to the exact standpoint | — | Same command; capture frame and thumbnail must agree, including aspect |
| **Framing controls** (Conservatory's Lens and Eye-height steps) | — | UI over `fov` and eye; whether to promote the three-step presets is S26's call |
| **Additional Guides** and **Guide rename**; choosing the Experience's entry Guide | Domain refuses `guide-exists`; no label update | |
| **Stop-local View authoring**: several guided Views per Stop, their order, per-View holds, Include/leave out | One `entryViewId`, one `holdSeconds` | S25's dimmed *Include* is the placeholder |
| **Camera path editing on Stage**: Travel routes, add/drag/remove interior points, wall warning, Straighten, shared-path note, Travel duration | Unwired `editor-camera-path.ts` / `-timing.ts` helpers | Camera owns geometry and timing |
| **Playback and scrubbing**: Play/Pause, time, time-scaled overview, playhead, playing glow, Stage puck, Follow camera, *Play from this Stop*, *Preview this move* | Visitor director only, in Preview | One Camera evaluation; no second clock |
| **Show ▾** visibility (markers, frustums, paths, labels; whole Guide or selection only) | — | Session disclosure only |
| **View thumbnails** in every slot (D4) | Placeholders | Through the Camera/render contract; no extra WebGL contexts |
| **Removal with consequences**: Remove Stop (Presentation stays), Remove View (not the last; Default/Stop consequences), Remove Presentation (and its Stops) | No domain operation | Not on the owner's original S26 list: confirm S26 or later |
| **Reorder a Presentation's Views** | No order field | Same: confirm S26 or later |
| **Present this auto-framing** a first View on the subject | Captures the current 3D framing | Bring into view stays a separate Camera request |

Beyond S26: Gates and Detours authoring (the model carries them; no UI), cues and narration.

## 5. Prototype shortcuts (never promoted)

Snapshot Undo and the selection array; the mock document (`doc.guide`, `seq`, path keys
`from>to`, View field names); `camera.js` (Catmull-Rom, smoothstep); the fixed 1.6 s glide inside
a Stop; extra WebGL contexts for thumbnails and the visitor; `frameObject` auto-framing and the
`inPoly` wall test; the *Open in free exploration* switch and *last Stop ends into free
exploration* (not ratified semantics); the Guide Card's mode cards as Preview entries (Preview has
one entry, in the Head); the *Prototype ▾* menu, stress generators and simulated width; Show and
density as anything but session state.
