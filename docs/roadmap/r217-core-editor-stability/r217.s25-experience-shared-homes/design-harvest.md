# R217.S25 — Conservatory design harvest and replacement plan

**Status:** for owner review, second round (2026-11-02, review follow-up folded in). PR #261 is
**not accepted**. No production code changes until the owner approves this harvest. Not a
governing reference: PLATE and the other references are unchanged until visual acceptance.

**Authorities (owner direction, 2026-11-02).**
[Conservatory](../../../../prototypes/experience-ux-alternative/README.md) owns Experience
**workflow**: information architecture, Presentation/View/Guide/Stop composition, spatial
interaction and progressive-disclosure thresholds.
[Production shell Round 2](../../../reference/decisions/production-shell-round-2-ratification-2026-10-23.md)
and its [wireframe](../../../../prototypes/production-shell-wireframe/README.md) own the shared
Head, Index, Card and Dock and the **compact visual treatment**: Card density, preview snapshots,
the Guide instrument and its timeline bar. Conservatory's oversized Cards and previews are not
copied literally. The domain contracts (`packages/project-model/src/units/types.ts`,
`planning.ts`, `apps/editor/src/lib/authoring/experience/commands.ts`) own what exists.

**Sources studied.** Conservatory's source (`app/main.js`, `styles/*.css`), rationale, visual
language and scope/critique, and the running prototype: populated (1440×900), dense (30 Stops,
50 Views, 40 Presentations) and narrow (834×1112, 390×844). The Round 2 wireframe's Experience
module (`exp.js`) and styles. No screenshots are kept.

**Classes.** **W** exists in the domain; S25 wires and presents it. **P** missing; S25 shows an
honest disabled placeholder because the composition needs the slot. **S26** missing authoring
capability, handed to S26. **X** prototype shortcut, never promoted.

## 1. Owner decisions (2026-11-02)

| # | Decision |
| --- | --- |
| D1 | **Capture** lives in the dock and always captures the current viewpoint: into the *visibly selected* Presentation (or the Presentation of the visibly selected View), otherwise into a new standpoint Presentation. **Present this** on the subject Card is the only subject-based creation. No Index *New*, no Card Capture. Never infer a subject from selection, never act on hidden focus, never change an existing Default View. Unsupported framing (Plan capture, auto-framing a subject) stays truthful and goes to S26 |
| D2 | Capture and Present this **never add a Stop** |
| D3 | Index **Guides rows** choose and open a Guide (one active); the **dock Guide key** shows or hides the instrument for the active Guide; the instrument's **×** closes it. No Guide buttons on Cards |
| D4 | **Thumbnails:** every slot keeps its place at Round 2's compact size with a neutral placeholder in S25; real rendering moves to S26 |
| D5 | **Stop views:** the entry View with its hold, plus the Presentation's other Views dimmed with a disabled *Include* |
| D6 | **Cut/Travel** has one home, the Transition Card (opened from a connector) |
| D7 | This harvest is committed to PR #261 for review |
| D8 | **First Guide, two doors.** Presentation `•••` **Add to Guide** creates the first Guide and its Stop, asking for the Guide name inline the first time (no rename until S26); once a Guide exists it adds a Stop to the active Guide after the selected Stop. The empty Guide's **Add stop** (name in its header) does the same from the Guide side |
| D9 | **Timeline in S25:** Round 2 layout; Stop cards show their hold; connectors show the resolved destination without seconds; the bar shows Stop order with a disabled Play and no total. Camera-evaluated seconds, time scale and playback are S26 |
| D10 | **One canonical selected Card.** The latest selection from the Stage, the Index, the Guide or a Card link is the Card. A stale Experience focus never overrides it |
| D11 | **Transitions show the resolved destination**, including nonadjacent Stops and End. Never imply adjacency or Travel that does not exist |
| D12 | **Default View has one mutation home, the View Card.** ◆ elsewhere is informational |
| D13 | **Round 2 governs the compact visual treatment** (Cards, previews, Guide, timeline). Conservatory governs workflow |

## 2. Design harvest

### 2.1 Composition: Conservatory placement, Round 2 compact treatment

| Part | Conservatory (workflow and placement) | S25 visual treatment (Round 2) |
| --- | --- | --- |
| Head | Project, World/Experience, history, Preview | Round 2 Head unchanged: one lens switch, one Preview |
| Index | Left column, rail or drawer; Experience groups (§2.3) | Round 2 Index; two-line rows with a 48 × 30 snapshot |
| Stage | Dominant; never reflows on selection | Round 2 Stage and reading control |
| Card | Overlay docked right; appears only with a selection | Production Card, 288 px: 11 px kind line with parent link, 19 px serif name, 8 × 12 px sections with hairlines, 12 px fact rows, compact foot actions. Not Conservatory's 324 px Card, 23 px titles, large action buttons, 92 × 62 *Visits* block or boxed toggles |
| View previews in a Card | 2 columns, 3 past 8 Views, filter past 12 | Round 2 snapshots: 2-column 16:10 grid, name and ◆ on a bottom label, gold border when selected. No *Capture* add tile (D1) |
| View hero | Large hero with lens/height tag | Round 2: one 16:10 snapshot at Card width, then read-only *Lens mm* and *Eye* facts |
| Guide instrument | Inset at the bottom, width follows content, bounded left of the Card; full width on tablet | Round 2: forest panel, 12 px radius; header with 10 px *GUIDE* kicker, 15 px serif name, 26 px controls (Follow, + Stop, ×) |
| Stop card | Selectable, reorderable sequence item | Round 2: 118 px card, 50 px snapshot on top with a mono number badge, 12.5 px serif name, 10.5 px hold (*4s*); gold border when selected |
| Connector | Selects the transition | Round 2: 44 px slot, 11 px mono chip: *cut* (dashed), *travel* (leaf), *→ 5* or *End* (D11), red dashed when Travel lacks Camera support |
| Timeline bar | Overview: orientation, bracket for cards in view, drop target for far moves | Round 2's single scrub row: 26 px gold Play, 8 px bar, mono time. In S25 the bar carries Stop order, selection, the in-view bracket and the drop caret; Play is disabled and no time is shown (D9) |
| Responsive | Below 980 px: Index drawer, Card bottom sheet above the Guide, Guide full width. Below 620 px: icon-only Guide header | Same breakpoints through the Round 2 shell's rules |

### 2.2 Dense and narrow states (inspected live)

- **30 Stops.** The Guide stays content-bounded (844 px at 1440) and its cards scroll
  horizontally; the selected Stop is revealed; the bracket shows which cards are in view; narrow
  segments drop their number (23 of 30 keep one). The Stop kind line reads *Stop 16 of 30*;
  `•••` adds *Move to the start/end* past 6 Stops.
- **50 Views.** The Card grid goes to 3 columns with a filter and *On tour / Free* chips; it stays
  one scrollable list (no pagination), and reordering asks for the unfiltered list. The Index
  lists 8 Views, then *+42 more — see all in the Card*.
- **40 Presentations.** Index search (*Find a Presentation or View*) appears from 8
  Presentations; the list scrolls.
- **Tablet (834).** Index becomes a drawer opened from the Head. The Card becomes a bottom sheet
  above the Guide, up to about half the height. The Guide spans the width with smaller cards.
- **Phone (390).** The Head keeps the mark, name, ⋯ and a Preview icon; Stage tools and the Guide
  header go icon-only; the Card sheet reaches about 62 %. Card and Guide together leave about a
  third of the Stage, which is why S25 uses Round 2's compact Card and Guide rather than
  Conservatory's.
- **Thresholds kept (workflow):** Index search from 8 Presentations; 8 Views per Presentation in
  the Index; denser grid past 8 Views and filter past 12; *Not in this Stop* folds past 4;
  *Move to the start/end* past 6 Stops.

### 2.3 Information architecture

- **Index.** The Experience crumb (Round 2 scope-model) with a sibling menu listing the source's
  Experiences and **New Experience**. Then **Guides** (plural): one row per Guide (name, *n
  stops*), an *Open* chip on the active one, *No Guide yet* when there is none. Then
  **Presentations** with a count: rows with snapshot, name and *n Views · Stops 2, 5* or a dashed
  *free*; a twist expands Views (one Presentation open at a time, following selection), View rows
  with an on-tour dot or free ring and an informational ◆. Empty states explain the doors and
  never repeat a button.
- **One Card selection (D10).** Presentation, View, Stop, transition, Guide and Scene subject all
  share one selected Card. A Stage pick, an Index row, a Guide card or connector, or a Card link
  replaces it; nothing else does. Experience focus keeps only context (the current Experience and
  the active Guide), never a second selection.
- **Guide.** An invoked context, closed on every entry to the lens. One active Guide. It stays
  open across Presentation and View work; × (or Esc after the selection is cleared) closes it
  with its helpers.

### 2.4 Card content (Conservatory workflow, Round 2 density)

| Card | Content |
| --- | --- |
| Presentation | Kind *Presentation · about ⟨subject⟩*. Views grid with informational ◆ and tour dots. *Visitors reach it*: *On the tour at* Stop chips. More: Information text. `•••`: Add to Guide (D8) |
| View | Kind *View · in ⟨Presentation⟩*. Snapshot, *Lens mm* and *Eye* facts. **Make default** (the only Default mutation, D12) or *Default View* shown. *Where visitors see it*: Stops entering here. Look through as primary |
| Stop | Kind *Stop 2 of 5 · ⟨Guide⟩* with ‹ › stepping and *Open Presentation*; serif name = the Presentation, *again* when revisited. One row per Presentation View: ✓ the entry View with its Hold stepper, its name opening *Enter at…* (the Presentation's Default, which follows later Default changes, or a specific View); — the others, dimmed, with *Include* (D5). *After this Stop*: where Next goes, resolved (D11), and a link to the transition. `•••`: Move earlier/later (start/end past 6) |
| Transition | *Stop 2 → Stop 3*, or *Stop 2 → Stop 5*, or *Stop 2 → End*. Cut/Travel (D6) when a destination exists. *Leaves from* this Stop's entry View, *arrives at* the destination's entry View. Travel gaps named. Movement and *Preview this move* (S26) |
| Guide | Name; Stops and entry Guide; reach summary (how many Views only free exploration finds) |
| Scene subject | Kind *Scene object · Open in World*. Primary **Present this**. *Already presented in* rows. Bring into view. No World editing forms |

### 2.5 Guide instrument interaction

Header: kicker, serif name (selects the Guide Card), Follow (S26), **+ Stop** (menu of
Presentations, *again* hint), ⌄ compact, ×. Body: Stop cards and connectors, scrolling to reveal
the selection; the timeline bar below. Click a card selects the Stop; click a connector selects
its transition; drag a card to reorder (gold caret); drop on the bar to move far; drag a
Presentation from the Index onto the Guide to insert at the caret; ←/→ walk, Alt ←/→ reorder,
Enter selects; `•••` on the selected card. A connector is drawn as adjacency only when the Stop
resolves to its neighbour; otherwise the slot names the actual destination (*→ 5*, *End*), and the
last Stop shows *End*. Empty Guide: its name field and a drop zone that names both ways to add.

### 2.6 Stage and navigation

Selecting never moves the Camera. View markers, Guide paths, *Show ▾* and mode pills belong to
placement, Look through and playback (S26). Esc leaves the foremost mode, then clears the
selection, then closes the Guide. Undo lives in the Head.

## 3. Classification and S25 gap plan

| Behaviour | Production today (rejected S25) | Class | S25 replacement |
| --- | --- | --- | --- |
| Card selection | `experienceCardKind` plus `experienceCardSuppressed`; a remembered Presentation/Stop focus can reclaim the Card and is Capture's target | W | One Card selection (D10): Stage, Index, Guide and Card links replace it; Experience focus keeps only Experience and active Guide |
| Experience switch, New Experience | *Create Experience* under Presentations; a bare `details` switch | W | Crumb sibling menu with Experiences and **New Experience** |
| Guides group, plural, one active | Single *Guide* toggle; a `select` with *None* inside the panel | W | One row per Guide (`chooseGuide`); *Open* chip; no select, no *None* |
| First Guide | Form inside the panel (*Guide label*, *Create first Guide*) | W | D8: Presentation `•••` Add to Guide (asks the name the first time) or the empty Guide's + Stop, both via `guideCreateIntent` |
| Second Guide, Guide rename | — | S26 | Domain refuses `guide-exists`; no label update |
| Presentation rows | One-line rows, camera icon, filter always shown | W (+P snapshot) | Two-line rows with snapshot and meta; Views expand; search from 8 |
| Dock | Select, Capture, Guide | W + P | Select · **Place a View** (disabled, S26) · **Path** (disabled, S26; shown with a Guide) │ **Capture** · **Guide** |
| Capture into a Presentation | *Capture and rebind* hidden in More; always replaces the Default | W | Dock Capture targets only the visible Card's Presentation/View; sends the existing `defaultViewId` so the Default is kept (an unset Default is filled and said so); refuses in 2D with the existing words |
| New standpoint Presentation | Dock Capture attaches any selected Scene entity and adds a Stop when a Guide is open | W | Nothing visibly selected: `subjectEntityId: null`, `guideId: null` (D1, D2) |
| Present this | — (World forms shown instead) | W | Subject Card primary: capture-bind with that subject explicitly, no Stop; disabled in 2D with the reason |
| Subject Card in Experience | World editing Card with forms | W | Identity, *Open in World*, Present this, *Already presented in* (`presentation.subject`), Bring into view |
| Presentation Card | Default `select`, *Information text* textarea, *Save Presentation*, *Guide* button | W (+P) | Compact snapshot grid with informational ◆ and tour dots; *Visitors reach it*; Information text in More, committed on blur; rename inline; `•••` Add to Guide. No Default control, no Save, no Guide button |
| Default View | A `select` on the Presentation Card | W | **Make default** on the View Card only (`setDefaultView`) |
| Reorder a Presentation's Views | — | S26 | No `viewIds` order field; no drag hint |
| View Card | — (no View selection) | W + P | Snapshot placeholder, *Lens mm* and *Eye* facts (Camera `fov`, `eye`), Make default, *Where visitors see it*; **Look through** disabled (S26) |
| Stop Card | Four form fields and *Save Stop* | W + P | Round 2 rows: ✓ entry View with Hold stepper (one `stopUpdateIntent` per edit; choosing another View as entry is a Stop edit, not a Default change); — other Views dimmed with disabled Include; *After this Stop* resolved (Next, a chosen Stop, End) |
| Transition Card | Transition `select` inside the Stop form | W + P | Resolved ends (D11); Cut/Travel on the continuation (D6); Travel gaps from `travelGaps`; Movement and *Preview this move* disabled (S26) |
| Connectors | — (vertical list text) | W | Adjacent chip only when the destination is the neighbour; *→ n* for nonadjacent; *End*; *travel* only when the transition is Travel, red dashed with a gap |
| Stop sequence | Vertical floating list, ↑/↓ buttons | W | Horizontal Round 2 Stop cards; drag, bar drop, Alt ←/→ through `guide-order` permutations |
| Insert a Stop | *Insert selected Presentation as a Stop* | W | + Stop menu, Index drag, or Presentation `•••` Add to Guide, after the selected Stop (`stopCreateIntent`) |
| Holds and timeline | `hold 0s` text in rows | W + P | Hold on each Stop card; bar with Stop order, bracket, caret; Play disabled, no total (D9) |
| Remove a Stop, Presentation or View | — | S26 | No domain operation; `guide-order` refuses removal. Not shown |
| Thumbnails | — | P | Neutral frames at Round 2 sizes (D4) |
| Preview | Head only, entry precedence, exit restores Guide and Card | W | Unchanged |
| History and persistence | F4 Undo/Redo, Save | W | Unchanged; every new control goes through the controller's `run` |
| Esc order, Guide closed on lens entry | Partly | W | Esc: menu → selection → Guide; closed on every lens entry |

**One home per action.** Capture: dock. Present this: subject Card. New Experience: crumb menu.
Open a Guide: Index row (show/hide: dock key; close: ×). Default View: View Card. Cut/Travel:
Transition Card. Adding a Stop has the two owner-approved doors of D8 (Presentation `•••` and the
Guide's + Stop) plus dragging. Reorder: drag or Alt arrows (`•••` is the pointer-free fallback on
the same command). Removed: *Save Presentation*, *Save Stop*, Card *Guide* buttons, the Default
`select`, *Capture and rebind*, *Insert selected Presentation as a Stop*, the *None* Guide option
and the technical strings (*Cut (no travel)*, *Travel (supported connection only)*, *Presentation
Default*, *Hold (seconds, blank for none)*, *Information text (plain, 4,000 code points)*).

**Files.** Replace `ExperienceGuidePanel.svelte` (instrument), `ExperiencePresentationWriter.svelte`,
`ExperienceStopWriter.svelte`, `ExperienceDock.svelte`, the Experience branch of
`EditorIndex.svelte` and `experience-index-groups.ts`; extend `experience-card-model.ts`; add View,
Transition, Guide and Scene-subject writers. In the route, replace `experienceCardKind` and
`experienceCardSuppressed` with the one Card selection (D10); Scene selection in the Experience
lens shows the subject Card. Controller changes are call-shape wiring on existing intents only:
explicit `subjectEntityId` and `guideId: null` for capture-bind, kept `defaultViewId` on capture
into, an Add to Guide that names the first Guide, `insertStop(presentationId, afterStopId)`,
`moveStopTo(stopId, index)`, per-field Stop and Presentation updates, a resolved-destination read
of each Stop's continuation. UI state (selected View or transition) is never persisted.

**Kept from the rejected S25** (concise technical decisions): Experience lives in the shared homes
and `ExperienceSurface.svelte` stays retired; the controller is the only command path; the Guide
is closed on every lens entry; Preview has one entry in the Head with precedence focused Stop →
the open Guide's entry Stop → selected Presentation → the Experience's entry Guide → the
guide-free list, and exit restores the Guide and Card; Capture is a 3D-reading action, because a
Plan capture would record a perspective the creator never saw.

**Checks after approval** (no screenshot archive, no parity scripts): the slice's
affected-subsystem tier; targeted tests for the one Card selection (a stale focus never wins),
the Index switcher and New Experience, plural Guides and one active context, both first-Guide
doors, Stop and connector selection reaching their Cards, resolved connectors for nonadjacent and
End continuations, reorder and insert intents, per-field Stop edits, Default changed only from the
View Card, Capture keeping the Default and never binding a subject or Stop, Present this,
placeholders announcing their reason, Preview and Undo; keyboard reach (Stop cards ←/→, Alt ←/→,
Enter, Esc), labels and focus rings; a live check of the dense and narrow states in §2.2 at
1440×900, 1280×800, 1180×820 and 820×1180, handed to the owner as the working UI.

## 4. S26 handoff: missing authoring capability

| Capability | Today | Note for S26 |
| --- | --- | --- |
| **View placement** in Plan (press where the camera stands, drag toward what it sees); View markers in Plan and camera glyphs in 3D; drag to move, handle to aim | No markers or placement | `camera-view-update` exists in the domain with no editor caller |
| **Look through / Update View / Exit View**: capture frame, mode pill, provisional edit, return to the exact standpoint | — | Same command; capture frame and snapshot must agree, including aspect |
| **Framing controls** (Conservatory's Lens and Eye-height steps) | Read-only *Lens mm* and *Eye* facts in S25 | Whether to promote the three-step presets is S26's call |
| **Additional Guides**, **Guide rename**, choosing the entry Guide | Domain refuses `guide-exists`; no label update | S25 asks the first Guide's name at creation |
| **Stop-local View authoring**: several guided Views per Stop, their order, per-View holds, Include/leave out | One `entryViewId`, one `holdSeconds` | S25's dimmed *Include* is the placeholder |
| **Camera path editing on Stage**: Travel routes, interior points, wall warning, Straighten, shared-path note, Travel duration | Unwired `editor-camera-path.ts` / `-timing.ts` helpers | Camera owns geometry and timing (`timing.durationSeconds`, else computed) |
| **Timeline and playback**: Travel seconds on connectors, time-scaled bar and total (*0:00 / 0:36*), Play/Pause, scrub, playhead, playing glow, Stage puck, Follow camera, *Play from this Stop*, *Preview this move* | Visitor director only, in Preview | One Camera evaluation; no second clock; fills D9's disabled slots |
| **Show ▾** visibility (markers, frustums, paths, labels; whole Guide or selection only) | — | Session disclosure only |
| **View snapshots** in every slot (D4) | Placeholders | Through the Camera/render contract; no extra WebGL contexts |
| **Removal with consequences**: Remove Stop (Presentation stays), Remove View (not the last; Default/Stop consequences), Remove Presentation (and its Stops) | No domain operation | Not on the owner's original S26 list: confirm S26 or later |
| **Reorder a Presentation's Views** | No order field | Same: confirm S26 or later |
| **Present this auto-framing** a first View on the subject | Captures the current 3D framing | Bring into view stays a separate Camera request |

Beyond S26: Gates and Detours authoring (the model carries them; no UI), cues and narration.

## 5. Prototype shortcuts (never promoted)

From Conservatory: snapshot Undo and the selection array; the mock document (`doc.guide`, `seq`,
path keys `from>to`, View field names); `camera.js`; the fixed 1.6 s glide inside a Stop; extra
WebGL contexts for thumbnails and the visitor; `frameObject` auto-framing and the `inPoly` wall
test; the *Open in free exploration* switch and *last Stop ends into free exploration*; the Guide
Card's mode cards as Preview entries; the *Prototype ▾* menu, stress generators and simulated
width; its oversized Card and preview metrics (D13). From the Round 2 wireframe: the Card's
*Capture* add tile (D1), mock Camera interpolation and timeline durations, fixed pixel hit sizes
below the 44 px coarse-pointer rule.
