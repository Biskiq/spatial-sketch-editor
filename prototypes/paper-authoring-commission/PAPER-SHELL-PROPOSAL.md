# Paper authoring shell — destination proposal

> **Status: proposal for owner review, 2026-10-02.** This is prototype-tier design evidence, not
> authority. Nothing here is accepted, ratified, built or shipped, and it proposes no persisted
> format. The implementation plan follows acceptance, not before.
>
> **Builds on** the accepted [World Authoring Prototype](../spatial-authoring/README.md) (#112),
> inside the accepted World | Experience shell
> ([PLATE](../../docs/reference/design-system/editor-shell-and-visual-system.md) §0.8).
> **Covers** the World lens's Paper reading (plan Paper and a wall laid flat) and every shell
> region around it. The Experience Deck and #113 are out of scope.

## 1. The decision on one page

**Thesis.** Paper is calm because every mark on screen has one owner and answers one question,
not because capability is hidden. The drawing owns the Stage. Five pointer families are always
one key away. Everything else appears *on the thing* (handles and tags), *about the thing* (the
Card) or *in the one task surface* (the World Instrument), and it leaves when the work ends.

| The creator asks | Answered by | At rest |
| --- | --- | --- |
| Where am I, and what is here? | **Index** | place, level and relations |
| What does the World look like? | **Stage**: the Paper drawing | about 63 % of a 1440 px frame; four small furniture objects |
| What can my pointer do? | **Tool rail** | Select · Draw · Opening · Place · Measure · More |
| How is this Paper drawn? | **Reading cluster**: Paper ⟷ 3D switch and Sheet chip | one switch, one chip |
| What is this thing? | **Card** | identity, up to three read-only facts, Look · Do · Details |
| What am I doing to it? | **World Instrument** | absent |

Decisions, each argued below:

1. **Six permanent rail slots** (five pointer families and More) replace today's twelve-button
   tray. Vocabulary grows as family variants, so capability can triple without a new slot (§5, §15).
2. **A five-tier capability rule** with a registration contract decides where every capability
   appears. Features never hand-place chrome (§4).
3. **The Card carries stable facts, read-only**: one title-block line at rest, every measure in
   Details, and each fact is a door to its one writer (§6).
4. **A five-rung precision ladder**: drag, read, type at the gesture, Dimensions, procedure
   parameters (§7).
5. **Paper properties sit behind one chip beside the reading switch**, never in the rail, the Card
   or a status rail (§8).
6. **Paper ⟷ 3D is one switch over one camera.** It tilts about the current target, keeps scale
   and never refits. Selection, ownership, the armed tool and open work all survive (§8).
7. **Host-seeking tools find their host by gesture; subject verbs arrive with the subject**, in the
   Card's Do row, the context menu and scoped Find (§9).
8. **Dividing a room is drawing a boundary wall**, previewed with lineage consequences. Nothing
   edits a Room (§9, §14.10).
9. **One task owner.** Find, Dimensions, procedures, validation, consequences and Apply/Cancel all
   live in the World Instrument (§11).
10. **Undo/Redo with a verb label is the whole resting history surface.** No History panel, Keys
    button, Head search or status rail (§12).

Changes to the accepted prototype are listed in §19; decisions that need an owner ruling in §20.

## 2. Authority, evidence and limits

**Normative inputs.** The [ratified decision record](../../docs/reference/decisions/northstar-ratification-2026-09-27.md)
and the [World | Experience amendment](../../docs/reference/decisions/world-experience-reconciliation-2026-09-29.md);
PLATE §0.7–§0.8.2 (shared and World laws, parking), §2.12 (one writable owner per fact), §4.4
(working surfaces and grid), §18.3 (state language) and §19 (precision near the gesture);
[architecture](../../docs/reference/architecture.md) (separate Layout, Scene, Camera and Experience
authorities, Rooms derived from boundary walls, one Camera authority); the
[persistence](../../docs/reference/components/persistence.md) history contract; and
[F](../../docs/reference/composition-execution.md) compound acceptance (F.4).

**Behavioural evidence.** The World Authoring Prototype and journeys A–F
([implementer reference](../spatial-authoring/IMPLEMENTER-REFERENCE.md),
[acceptance](../spatial-authoring/qa/ACCEPTANCE.md)); the
[World shell synthesis](../world-experience-shell-round/design/design-synthesis.md); the production
Plan in `apps/editor/src/lib/editor/layout/LayoutDraftToolbar.svelte`,
`apps/editor/src/lib/editor/layout/plan-numeric-entry.ts` (S7 entry),
`apps/editor/src/lib/editor/EditorInspector.svelte` and the selection facade
`apps/editor/src/lib/editor/app/active-editor-selection.svelte.ts`; and the wall-first model and
planners in `packages/layout-core/src/layout-wall-first-types.ts`.

**Peer and packet evidence.** Two PDF peer proposals and an untracked React proposal
(*museum-editor-2d-authoring*) are audited in §18, not averaged. The
[commission packet](./designer-packet/COMMISSION.md) contributes its Paper plan and selection-detail
references where they agree with PLATE. Its task model is not adopted.

**Not decided here.** Any schema: Space, Level, Zone, annotation, constraint or reference. The
stress tests in §15 only show that the shell would not need redesigning. The final keymap,
mat ↔ paper motion timing and the keyboard focus ring also stay open (PLATE §0.3, §0.7.6).

**The brief's seven exclusions, and how the design keeps them.**

| Never introduced | How |
| --- | --- |
| A second selection truth | Card, Index, Stage and Find read and write the existing selection facade, which already gates its typed slots to one active domain. Task focus, consequence highlights and linked tags are view-only (§11) |
| A second navigation or camera-motion system | The switch, Fit all and Bring into view are requests to the one Camera authority. Paper has no viewport state of its own (§8) |
| A Paper canonical document | Paper draws Layout and Scene. Sheet settings are view state: never authored, never in Undo (§8) |
| Merged Layout and Scene ownership | Place dispatches each item to its owner, and the owner is named where it matters (§5, §11) |
| Shell-owned spatial return history | Return stays with the spatial return authority (Bring into view, Put it back). Undo is source history only (§12) |
| Duplicate writable controls | One owner per fact, tabulated in §16 |
| A second task surface | Find, Dimensions, procedures and Look sessions all render in the World Instrument. Option strips hold only a tool's defaults for its next stroke (§5, §11) |

## 3. Shell map

Reference frame 1440 × 900.

| Region | Geometry | Holds | Never holds |
| --- | --- | --- | --- |
| **Head** | full width × 44 | ⌂ app menu (Settings, Keys, Hide side panels), project, World \| Experience, Undo/Redo with a verb label, save state, Preview | search, a history list, tools, Paper properties |
| **Index** | left, 248 | Search and Browse; place breadcrumb including level; relation families (Rooms, Bounds, Openings on bounds, Located here, Attached here); hover highlights on Stage | tools, measures, task state |
| **Stage** | centre, about 904 × 856 | the drawing; reading cluster (top left); rail (left edge, 44 px); scale bar (bottom left); datum key (bottom right); World Instrument (bottom, invoked) | panels, persistent messages, a status rail |
| **Card** | right, 288 | identity, key facts, condition, Look · Do · Details | writable numbers, proposal values, Apply/Cancel, steps, tool options, Paper properties |
| **World Instrument** | lower Stage edge, inset 12, height by content, at most 45 % of the Stage | Find, Dimensions, procedures, Look sessions | identity: it names its subject, the Card owns it |

The Stage's resting furniture is four small objects. The World status rail is retired: Grid moves
to the Sheet, Reduce motion and Motion speed move to Settings, and refusals and hints move to the
gesture (PLATE §19).

## 4. The capability rule

### 4.1 Tiers

| Tier | Qualifies when | Home | Resting cost |
| --- | --- | --- | --- |
| **Permanent** | it is a pointer family that can be armed with nothing selected and that finds, or refuses with a reason, its own target | rail | one slot per family; six slots in total |
| **Direct** | it changes the selected subject's legible geometry | handles and tags on Stage | none |
| **Contextual** | it needs a chosen subject | Card Look and Do, context menu, Find's "For …" group | none: it arrives with the selection |
| **Disclosed** | it is registered | Find in the Instrument (`/`, ⌘K, the rail's More, the Card's ⋯) | none |
| **Procedural** | it needs steps, several parameters, validation, consequences or Apply | World Instrument, however it was invoked | none: only while running |
| Reading (not authoring) | it changes how Paper is drawn, never what the World is | Sheet | one chip |
| App (not authoring) | it concerns the editor, not the World | Settings | none |

A capability may have several *entries* but only one *home for its state*. Add opening can be
armed from the rail, from a selected wall's Do row (which scopes the same tool to that wall) or
from Find. Its state lives in the tool and, once it becomes a procedure, in the Instrument.

### 4.2 Admission test

Apply in order; the first match places the capability.

1. It changes no World fact: **Reading** or **App**.
2. It can be done by pulling something already on Paper: **Direct**. No command is added.
3. It is a new pointer grammar that can be armed with nothing selected: **Permanent**, and only
   with owner ratification (expected at most once in five years). A new *kind* of an existing
   gesture is a variant inside that family.
4. It needs a chosen subject: **Contextual**. It is ranked; at most three appear in the Card's Do
   row and the rest sit under ⋯.
5. It needs steps, several parameters, validation, consequences or Apply: **Procedural**, whatever
   its entry.
6. Everything is also **Disclosed**.

### 4.3 Registration contract

Each capability is a shell registry entry: editor code, never authored data.

| Field | Purpose |
| --- | --- |
| id, label, synonyms | Find matching and announcements |
| family | Draw · Opening · Place · Measure · Arrange · Look · Check · Repair · Reading |
| form | tool variant · handle · verb · look · procedure · reading property |
| subjects and hosts | subject kinds it applies to (none means host-independent); host kinds its gesture may target |
| owner | Layout · Scene · Camera · Experience · Resources; routes the write and is shown at the decision point |
| consequence class | local · topological · cross-subject · cross-lens; decides whether consequences show (§11) |
| precision schema | fields, units, ranges and validators |
| legibility | readings in which its input and handles are legible |
| rank and key | static rank per subject kind for the Do row; an optional default key after the keymap audit |

Placement is computed from these fields. Adding a skylight means registering an Opening variant
whose host is a ceiling; no shell code changes.

### 4.4 Today's vocabulary, placed

| Capability, and where it lives today | Destination |
| --- | --- |
| Select (Plan tray) | rail: Select |
| Wall chain, Rect Room, Poly Room (tray DRAW) | rail: Draw, Shape = chain, rectangle, circle or polygon |
| Partition chain (tool; Inspector "Defines room boundary") | Draw, Makes = Free-standing wall; afterwards a role procedure |
| Door, Window (tray OPENINGS) | rail: Opening, Kind |
| Column, Platform, Plinth (tray); Box, Cylinder, Sphere | rail: Place, item; owners Layout and Scene |
| Snap 0.25 m, Grid (View Bar) | Sheet |
| Tour (View Bar) | Preview and the Experience lens |
| Numeric entry during a gesture (S7) | unchanged: precision rung 3 |
| Wall length, thickness, height; opening offset, width, sill, profile; room floor and ceiling thickness (Inspector fields) | Instrument Dimensions is the single writer; Card and tags display |
| Room area, perimeter and ceiling (Inspector, derived) | Card key facts and Details, read-only |
| Names (Inspector) | Card rename |
| Room move and rotate, opening move and centre, junction dissolve, object align and repeat, room duplicate (Layout planners) | handles for moves; Do and Find for the rest; procedures where parameterised |
| Face, Unroll, Section, Lift, Look up, Reveal (prototype Look) | Card Look; sessions in the Instrument |
| Precision (prototype Instrument) | Dimensions and procedure parameters |
| Repair (prototype) | Card condition line, then the Instrument |
| Search anything (prototype Head) | Find in the Instrument (`/`) |
| Overview, Keys (prototype Stage tools) | Sheet's Fit all; `?` and tooltips |
| Wall grid, Reduce motion, Motion speed (prototype status rail) | Sheet's Grid; Settings |
| Plan and 3D buttons, tilt bead (prototype) | one reading switch |

## 5. The permanent core

```text
┌─┐
│↖│  Select   V   choose, move, reshape; every handle lives here   default
│╱│  Draw     W   trace walls and boundaries                       variants: Makes × Shape
│∩│  Opening  O   cut a door, window or passage into a host        variants: Kind
│+│  Place    P   put a structure or object into the World         variants: item
│↔│  Measure  M   temporary distances and angles; never authored   variants: Distance · Angle
├─┤
│⋯│  More     /   find any tool, action, place or setting          opens Find in the Instrument
└─┘
```

**Why these five, for five years.** They are the irreducible pointer verbs of spatial authoring:
choose, trace, cut, put and check. Each is a family, so new vocabulary arrives as variants. Each
can be armed with nothing selected; Opening and hosted Place items seek an eligible host under
the pointer and refuse others in words. **More** is the bridge from permanent to disclosed
capability, so a first-time creator never has to know a key.

**Why Opening is its own family rather than a Place item.** Its gesture is different (it slides
along a host and spans it), it changes architecture rather than adding content, and it is the most
frequent architectural act after drawing walls. Folding it into Place would bury doors behind a
chooser.

**Option strip.** Arming a tool flies its strip out from its slot:

```text
 │╱│» Makes [Wall ▾]  [╱] □ ○ △   0.25 thick · 4.20 high   click to start · type a length · ↵ ends
```

The strip holds only the tool's defaults for the next thing it makes and a one-line key hint that
fades after a few uses. It never holds facts of existing things, steps or Apply. Esc or V returns
to Select and closes it.

**Arming rules.** Tools stay armed until Esc or V. Arming never changes the selection, and what a
gesture makes becomes selected. Tools are gated by the legibility of their input plane, not by the
reading: Draw keeps working in a tilted view while the floor plane is legible, and at a grazing
angle the pointer says why it cannot place.

## 6. The Card and the Instrument

The Card answers *what this thing is*. The Instrument answers *what the creator is doing to it*.

```text
┌──────────────────────────────────────┐
│ North wall                           │  name: the one writable fact the Card owns (F2)
│ Wall · W-N · bounds Long Gallery     │  kind · reference · where (derived)
│ 16.26 m · 0.25 thick · 4.20 high     │  ≤ 3 key facts, read-only; each opens Dimensions
│                                      │  condition, only when true: out of view · problem · parked work
│ Look  Face                           │  readings this subject supports
│ Do    Add opening · Free-standing… ⋯ │  ≤ 3 ranked verbs; ⋯ opens Find scoped to this subject
│ Details ›                            │  relations and every measure, read-only
└──────────────────────────────────────┘
```

Key facts per subject kind, with values from the prototype's Saltmarsh fixture (centrelines and
0.25 m gallery walls; areas are interior and rounded):

| Subject | Kind line | Key facts at rest | Details adds |
| --- | --- | --- | --- |
| Wall that bounds rooms | Wall · W-N · bounds Long Gallery | 16.26 m · 0.25 thick · 4.20 high | faces, junctions, openings, attached art |
| Curved wall | Wall · W-ROT · bounds Rotunda | 34.56 m around · r 5.50 · 0.30 thick | height, sweep, openings |
| Free-standing wall (role `partition`) | W-12 · in Long Gallery | 4.00 m · 0.20 thick · 3.00 high | junctions, openings |
| Opening | Window · rounded · O-GW · in Rotunda wall | 1.60 wide · 2.50 high · sill 0.90 | position along the host, rise, rooms it connects |
| Room (derived) | Room · R-LONG · Level 0 | 101.9 m² · ceiling 4.20 | perimeter, floor and ceiling thickness, Bounds, Openings on bounds, Located here |
| Structure (Layout object) | Plinth · in Long Gallery | 0.80 × 0.80 · 0.90 high | placement |
| Object (Scene) | Object · in Long Gallery (derived) | footprint · rotation | source, attachment |
| Junction | Junction · joins 3 walls | x −15.00 · z −3.50 | incident walls |
| Several things | 3 items · 2 objects, 1 plinth | extent 4.20 × 3.10 | the items |
| Nothing | Nothing selected · Saltmarsh Museum · Level 0 | 2 rooms · 191.8 m² of floor | a one-line hint |

Rules:

- The Card never holds writable numbers, proposal values, steps, validation, Apply/Cancel, tool
  defaults or Paper properties. During a procedure it keeps showing accepted values.
- Every fact is a door: clicking it opens Dimensions with that field focused (§7).
- The name is the Card's one writable fact, because the Card is identity and naming is identity
  (F2 or double-click). Index rows and Stage labels only display it.
- **Why facts on the Card refine #112 rather than contradict it.** The #112 review removed a
  *numerical catalogue* from the ordinary Card and protects that with assertions. One title-block
  line is identity (a 16 m boundary wall and a 4 m screen are different things), and it fills the
  Card with stable meaning instead of empty space. The catalogue stays one click away in Details,
  and writers stay in the Instrument (owner call 1).
- **The Do row.** PLATE §0.8 gives the Card Look and Details. This adds Do: up to three
  capability-ranked verbs and ⋯. Each entry is a door that arms a tool scoped to this subject or
  opens an Instrument procedure, and it holds no state. The armed state stays the rail's
  (owner call 2).
- **Nothing selected.** The Card names the place and its derived facts plus one authored hint
  (PLATE §19, useful empty states). It never shows tool buttons: keys appear as text, and the rail
  owns arming.
- **Several selected.** The Card shows one canonical selection value that is a set: count, kinds,
  shared extent and set verbs such as Align. PLATE §0.8 speaks of exactly one selected identity,
  while production already carries placement sets (owner call 10).

## 7. The precision ladder

| Rung | The creator | The shell shows | Writer | History |
| --- | --- | --- | --- | --- |
| 1 Direct | drags a handle | snap marks at the snap point; only the affected edge strengthens | the gesture | one step on release; an invalid release cancels with none |
| 2 Read | pauses or hovers | live tags at the gesture (length, angle, offset, clearance); ⌥ shows distances from the selection to its neighbours | none | none |
| 3 Type at the gesture | types digits while drawing, dragging or placing | the live tag becomes the S7 entry field: ↵ commits once, Esc restores and then cancels, blur never commits | the gesture's own parameter | one step |
| 4 Dimensions | clicks a tag or a Card fact, or presses ↵ on a selection | Instrument Dimensions: every settled writable measure, with units, keep-anchors and refusal at the field | the Dimensions field | one step per committed field |
| 5 Procedure | runs a procedure | the procedure's parameters, validation and consequences | the procedure | one step on Apply |

- **Settled facts have exactly one shell writer, Dimensions.** A gesture owns its transient
  parameter only while it is live, and a live gesture turns the matching Dimensions field into a
  display ("being set on Paper"). The two never render as writers at the same time, which keeps
  PLATE §2.12 intact.
- Stage tags and Card facts are displays; clicking one is a door to its writer.
- Precision never opens by default; rung 4 is always invoked.
- Refusals and cautions appear beside the field or pointer that caused them, in words and never in
  colour alone (§18.3).

## 8. Paper properties and the reading

### 8.1 The Sheet

One chip beside the reading switch names the reading's scale (`1:100 ▾`, or `View ▾` in 3D) and
opens the Sheet: scale, grid, snap, labels and dimension display, rulers, cut height, the datum
(display only) and what to show. See §14.8.

- Sheet values are view settings. They are not World facts, never enter Undo and are never
  authored; keeping them as a per-user preference is fine, but they are not project data.
- Scale is a framing request to the one Camera authority. Wheel and pinch remain navigation
  gestures. *Fit all* is the only frame request in the Sheet, and it is explicit.
- Grid is one fact for every Paper surface, plan or wall laid flat; the prototype's Wall grid joins
  it, and G toggles it.
- Snapping has one home here. A held modifier suspends it for a single gesture.
- The datum belongs to Layout. The Sheet and the datum key display it and do not write it.

| Placement considered | Verdict |
| --- | --- |
| A chip beside the reading switch | **Chosen.** Properties of the reading sit with the reading, cost one small object and survive narrow widths |
| Status-rail toggles, CAD style | Rejected: far from Paper, a permanent strip, lost at narrow widths |
| Toggles in the tool rail or a toolbar | Rejected: mixes how Paper is drawn with what the pointer does (PLATE §2.12 host ownership) |
| The Card | Rejected: the Card describes the selected subject, and Paper is not selected |
| The Index | Rejected: the Index orients authored structure |

### 8.2 Paper ⟷ 3D

- **Tabs** (production's `Plan | 3D`) imply two places with separate state, and today they really
  are two viewports. Each switch costs re-orientation.
- **The prototype's buttons refit.** `Plan` flies to a fixed whole-museum framing and `3D`
  restores the last 3D pose, so pressing them moves the standpoint without being asked. Only the
  tilt drag keeps it.
- **Destination:** one switch whose thumb *is* the camera elevation. Click an end, or press 1 or
  2, to flip; drag the thumb (or ⌥-drag on empty Stage) to tilt continuously.

| Preserved by a flip | Changes | Never happens |
| --- | --- | --- |
| selection, Card, Index, armed tool, open Instrument work, history, Sheet settings for each reading | camera elevation (Paper settles azimuth to the nearest 90°, the accepted detent); mat ↔ vellum material; which handles are legible | refit, retarget, rescale, lens change, cancelled work, a second camera |

The 3D end returns to the last *working elevation* about the current target, not to a remembered
pose. A wall laid flat (Look: Face or Unroll) is also Paper, with the same rail, Sheet and Card;
its vertical measures become legible and gain handles. While such a Look session runs, the switch
ends leave it at the current target, as the prototype does. Reduced motion makes the flip a cut;
mat ↔ paper timing stays PLATE's open call.

## 9. Contextual and host-dependent capability

| Capability | Exposure |
| --- | --- |
| Host-independent creation | permanent: Draw, and Place for free-standing items |
| Host-dependent creation | permanent tool whose gesture seeks a host: Opening and hosted Place items. Selecting a host first and choosing *Add opening* scopes the same tool to that host |
| Operations on an existing subject | contextual only: Card Do, the context menu at the pointer, Find's "For North wall" |
| Readings of a subject | Card Look, capability-driven and never a list of disabled entries |

Checked against the product model:

- An opening is hosted by one wall and positioned along it, so the host is required. The gesture
  finds it.
- Rooms derive from boundary walls. **Dividing a room is drawing a boundary wall chain between two
  of its walls.** Noding splits those walls and room lineage keeps one Room identity and births
  another. The Instrument names the mechanism ("with a new wall"). Moving or rotating a Room moves
  its walls through Layout planners; area and ceiling stay derived. No Room geometry is edited
  directly.
- An object's "in Long Gallery" is derived location and is never reassigned.
- Wall role is user-facing as *Wall* versus *Free-standing wall*. Changing it is a procedure,
  because it births or retires Rooms.

## 10. Direct manipulation

| Subject | Handles in plan Paper | Live tags | Notes |
| --- | --- | --- | --- |
| Wall | ends (move the junction; connected walls follow), middle (bend between straight and arc; knots on curved chains), body (offset parallel) | length, angle, clearance to a parallel neighbour | thickness and height through Dimensions; height also has handles on a wall laid flat |
| Opening | body (slide along the host), jambs (width) | gaps to neighbours and junctions on both sides | sill and head handles on a wall laid flat |
| Room | body (move), corner arc (rotate) | displacement, angle | moves its walls through planners; refuses in words when walls are shared |
| Structure or object | body (move), corner arc (rotate in 15° steps) | clearance to the nearest walls and objects | |
| Junction | point (move) | lengths of the incident walls | |
| Several things | body (move all) | displacement | Align and Distribute through Do |

Snap indicators appear at the snap point (grid 0.25 m, features, alignments). Arrows nudge one snap
step and ⇧ arrows nudge 1 m. Tab walks the selection's handles, and typing goes to the focused
handle's S7 field. Every move validates, and releasing while invalid cancels with no history.

**Gestures that change topology** (a chain that closes a room, a drag that collapses one) draw
their consequences on Stage during the gesture: the new room's tint and label, a hatch with a
reason on a retiring room, and "used in 1 Experience stop" when references exist. Release commits
one undo step. No Apply interrupts direct work.

## 11. The World Instrument

The Instrument has four states (Find, Dimensions, Procedure and Look session), shows one at a time
and changes between them in place.

```text
╭─ VERB · subject — mechanism ───────────────────────────── owner (i) · Bring into view · ✕ ─╮
│ steps                        only when the work has several                                │
│ parameters and precision     one writer per value, with units and keep-anchors             │
│ validation                   beside the value that caused it, in words                     │
│ consequences                 only when earned (§11)                                        │
│                                                                  Cancel     Apply ⌘↵       │
╰────────────────────────────────────────────────────────────────────────────────────────────╯
```

**Find.** `/`, ⌘K, the rail's More, the Card's ⋯ (scoped) and the context menu's More all open it,
and Esc closes it. Being open never moves the camera or changes the selection.

- With an empty query it lists the selection's capabilities first ("For Long Gallery"), then the
  families. Every row shows its key.
- With a query it shows the selection's matches, then tools, then *Go to* places and things. A
  match that cannot apply says why ("select a room first"); that is a reason on a search hit, not a
  menu of disabled entries.
- Choosing a tool arms it on the rail. Choosing a procedure turns Find into that procedure in
  place. Choosing a place selects it and brings it into view, which is the explicit request.
  Choosing a setting opens its one owner, the Sheet or Settings.

**Consequences show only when earned**, meaning the consequence class is not local. That covers:

- creating or retiring identities other than the subject;
- splitting or merging;
- changing derived membership (Located here, Bounds) or opening connectivity;
- touching another level;
- changing what Camera or Experience references resolve to. Those counts come from their owners
  as read-only queries.

For local edits the Stage preview is the consequence. The grammar is: Creates · Keeps · Splits ·
Moves (derived) · Connects · Elsewhere · one undo step. Focusing a row emphasises that identity on
Stage as view-only (slate dashes for "set aside"); the selection does not change.

**Commit grammar.** A Dimensions field commits on ↵ as one undo step, and *Done* closes the
Instrument. A procedure commits on Apply (⌘↵) as one undo step; Cancel or Esc discards it with
none. While a proposal or a gesture is live, Undo and Redo are unavailable and say why, so history
never interleaves with a proposal.

**Lens crossing.** An unaccepted proposal is cancelled and its procedure parks. Returning never
resumes it; the Card offers *Resume* only when the original subject is selected and its targets
revalidate (PLATE §0.8.2). A reading flip is not a crossing, so work continues.

**Occlusion.** The Instrument never moves the camera. If it covers its subject, its header offers
*Bring into view*.

## 12. History, keys and help

**Undo and Redo** sit in the Head with a verb label (`↶ Undo Divide Long Gallery`) over one
chronological session stack tagged Layout or Scene. There is no history list. Named project
versions are a separate future product, and their natural door is the save state, so no chrome is
reserved for them now.

**Discovering shortcuts** happens through tooltips (name and key), Find rows (each shows its key),
the option strip's one-line hint, and `?`, which opens Find on Keys with the current context first.
Keymapping can live in Settings later. There is no Keys button.

| Key | Action |
| --- | --- |
| V, Esc | Select (Esc unwinds first) |
| W, O, P, M | Draw, Opening, Place, Measure |
| `/`, ⌘K | Find |
| 1, 2 | Paper, 3D |
| ↵ | Dimensions for the selection; commit a field |
| ⌘↵ | Apply |
| G | Grid |
| `?` | Keys |
| ⌘Z, ⇧⌘Z | Undo, Redo |
| ⌘\ | Hide side panels |

These are proposed defaults. They need an audit against the prototype's Look keys (F, U, K, S) and
production's numeric-entry rules. The prototype's `o` (open), `m` (mirror) and `p` (precision)
move: Dimensions becomes ↵, and mirror becomes a control inside the Look-up session.

**Esc unwinds one level at a time:**

1. a field being edited is restored;
2. a live gesture is cancelled with no history, and the tool stays armed;
3. a procedure's proposal is cancelled and the Instrument closes;
4. Find or Dimensions closes;
5. an armed tool returns to Select;
6. a Look session puts the standpoint back;
7. the selection clears;
8. rest.

## 13. Narrow desktop

Below about 1180 px (Index 248 + Card 288 + a Stage of at least 640):

- The Index becomes a Head location control (`⌖ Long Gallery ▾`) that opens the Index as a sheet
  over the Stage's left side.
- The Card becomes a Head identity chip (`◈ North wall ▾`) that opens the Card as a sheet on the
  right.
- The Stage keeps the full width. The rail, the reading cluster, the scale bar and the datum key
  are unchanged.
- The Instrument keeps its lower home across the Stage. Opening a procedure closes the Card sheet;
  the identity stays in the chip.
- Sheets overlay the Stage and never resize it. Resizing the window changes only the visible
  bounds: target and scale stay, and nothing refits.
- ⌘\ gives the same composition at any width.

## 14. States

Specimens use the Saltmarsh fixture (Long Gallery 16.26 × 7.00 m with 0.25 m walls; Rotunda
r 5.50 m). Drawings are schematic and text widths are not to scale.

```text
━ ┃  wall that bounds rooms     ─    free-standing wall     ┅ ┇  window     ╎  door
▬    artwork on a wall          ▪    object or structure    ░    proposal, unaccepted
◆ ◇  handle, active · idle      ⊕    pointer with snap      ‹ ›  live tag at the gesture
⊘    refusal, with words        ▲    caution, with words    ┊    dimension line
```

### 14.1 True rest

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ⌂ Museum Editor ▾   Saltmarsh Museum           [ World │ Experience ]            ↶ ↷   Saved   ▷ Preview │
├──────────────────┬──────────────────────────────────────────────────────────────┬────────────────────────┤
│ Search   Browse ▾│ [Paper ●━━━━ 3D]  1:100 ▾                                    │ Nothing selected       │
│                  │                                                              │ Saltmarsh Museum       │
│ Saltmarsh Museum │ ┌─┐                                                          │ Level 0 · 2 rooms      │
│ › Level 0        │ │↖│                                 ╭━━━━━━━━━━━━━━━━━━╮     │ 191.8 m² of floor      │
│                  │ │╱│                                 ┃                  ┇     │                        │
│ ROOMS            │ │∩│   ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫                  ┃     │ Click anything on the  │
│   Long Gallery   │ │+│   ┃           ▬▬▬▬▬▬            ┃  Rotunda         ┃     │ Paper to select it.    │
│   Rotunda        │ │↔│   ╎   Long Gallery              ╎  R-ROT           ┃     │ W draws walls.         │
│                  │ ├─┤   ╎   R-LONG · ceiling 4.20     ╎  ceiling 6.00    ┃     │ / finds anything else. │
│                  │ │⋯│   ┃            ▪▪▪              ┃        ▪         ┃     │                        │
│                  │ └─┘   ┃  ▬▬▬                ▬▬      ┃                  ┇     │                        │
│                  │       ┗━━━━━━━━━━┅┅┅┅┅┅┅━━━━━━━━━━━━┫                  ┃     │                        │
│                  │                                     ┃                  ┃     │                        │
│                  │                                     ╰━━━━━━━━━━━━━━━━━━╯     │                        │
│                  │                                                              │                        │
│                  │                                                              │                        │
│                  │ ├────┼────┤ 5 m                        N ↑   Level 0 · ±0.00 │                        │
│                  │                                                              │                        │
└──────────────────┴──────────────────────────────────────────────────────────────┴────────────────────────┘
```

- The Stage carries four small objects: the reading cluster, the rail, the scale bar and the datum
  key. There is no Instrument and no status rail.
- Room labels follow the packet's Paper plan: name, reference and derived ceiling.
- The empty Card is not wasted. It names the place, its derived facts and one hint that teaches W
  and `/` without any button.

### 14.2 Drawing walls

```text
 ┌─┐
 │↖│
 │╱│» Makes [Free-standing wall ▾]  [╱] □ ○ △   0.20 · 3.00 h
 │∩│
 │+│
 │↔│
 ├─┤
 │⋯│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┄┄┄
 └─┘  ┃         ┊              ▬▬▬▬▬▬▬▬▬▬▬▬
      ┃   ‹2.28›┊   ‹4.00 m · 0°›
      ┃           ●───────────────⊕
      ╎            type a length · ↵ ends · Esc stops
      ╎                         ▪▪▪▪▪▪▪▪
      ╎       Long Gallery
      ┃       R-LONG · ceiling 4.20
      ┃    ▬▬▬▬▬▬▬                                 ▬▬▬▬▬
      ┗━━━━━━━━━━━━━━━━━━━━━━┅┅┅┅┅┅┅┅┅┅┅┅┅━━━━━━━━━━━━━━━━━┄┄┄
```

- W arms Draw. The strip holds only the defaults for the next stroke: what it makes, its shape,
  thickness and height.
- Tags sit at the gesture: length and angle, the clearance to the North wall's face, and the snap
  mark at the pointer (0.25 m grid).
- Typing turns the length tag into the S7 field. ↵ ends the chain; Esc cancels the open segment and
  then stops the tool.
- The Card stays "Nothing selected" until the chain commits. W-12 is then selected, and the Head
  reads *Undo Draw free-standing wall*.

### 14.3 Selection and direct manipulation

```text
 ┌─┐
 │↖│
 │╱│
 │∩│                                                            ┌──────────────────────────────────┐
 │+│                                                            │ Free-standing wall               │
 │↔│                                                            │ W-12 · in Long Gallery           │
 ├─┤                                                            │ 4.00 m · 0.20 thick · 3.00 high  │
 │⋯│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┄┄┄  │                                  │
 └─┘  ┃         ┊              ▬▬▬▬▬▬▬▬▬▬▬▬                     │ Look  Face                       │
      ┃   ‹2.78›┊                                               │ Do    Add opening · ⋯            │
      ┃         ┊ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄                             │ Details ›                        │
      ╎           ◆───────◇───────◆ ‹↓ 0.50›                    └──────────────────────────────────┘
      ╎                         ▪▪▪▪▪▪▪▪
      ╎       Long Gallery
      ┃       R-LONG · ceiling 4.20
      ┃    ▬▬▬▬▬▬▬                                 ▬▬▬▬▬
      ┗━━━━━━━━━━━━━━━━━━━━━━┅┅┅┅┅┅┅┅┅┅┅┅┅━━━━━━━━━━━━━━━━━┄┄┄
```

- The ends move the endpoints, the middle bends the wall into an arc and the body offsets it. The
  previous position shows as a view-only ghost during the drag.
- Only the affected measures strengthen: the drag and the clearance to the North wall.
- The Card keeps showing accepted values while the drag is live and updates on release.
- There are no Move, Rotate or Scale commands anywhere.

### 14.4 Placement

```text
 ┌─┐
 │↖│
 │╱│
 │∩│
 │+│» [Plinth ▾] 0.80 × 0.80 · Layout · R rotates · Esc stops
 │↔│
 ├─┤
 │⋯│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┄┄┄
 └─┘  ┃                        ▬▬▬▬▬▬▬▬▬▬▬▬
      ┃
      ┃
      ╎           ─────────────────
      ╎                   ┊     ▪▪▪▪▪▪▪▪
      ╎                 ░░░░            Long Gallery
      ┃       ‹1.00 to W-12 · centred›  R-LONG · ceiling 4.20
      ┃    ▬▬▬▬▬▬▬                                 ▬▬▬▬▬
      ┗━━━━━━━━━━━━━━━━━━━━━━┅┅┅┅┅┅┅┅┅┅┅┅┅━━━━━━━━━━━━━━━━━┄┄┄
```

- P arms Place with the last item. `[Plinth ▾]` opens recent items and *Browse all…*, which opens
  Find on the Place family.
- The strip names the owner (Layout for structures, Scene for objects) because the owner decides
  what the item is.
- The ghost snaps to the grid and to W-12's axis and shows its clearance; R rotates by 90°. A click
  places and selects the plinth, and the tool stays armed.

### 14.5 A host-dependent action

```text
 ┌─┐
 │↖│
 │╱│
 │∩│» [Door ▾]  1.80 wide · on North wall (scoped)              ┌──────────────────────────────────┐
 │+│                                                            │ North wall                       │
 │↔│                                                            │ Wall · W-N · bounds Long Gallery │
 ├─┤                                        ‹Door 1.80›         │ 16.26 m · 0.25 thick · 4.20 high │
 │⋯│  ◆━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░━┄┄┄  │                                  │
 └─┘  ┃                        ▬▬▬▬▬▬▬▬▬▬▬▬                     │ Look  Face                       │
      ┃                                   ├─2.10──┤             │ Do    Add opening                │
      ┃                                                         │       Free-standing… · ⋯         │
      ╎           ─────────────────                             │ Details ›                        │
      ╎                         ▪▪▪▪▪▪▪▪                        └──────────────────────────────────┘
      ╎       Long Gallery
      ┃       R-LONG · ceiling 4.20
      ┃    ▬▬▬▬▬▬▬                                 ▬▬▬▬▬
      ┗━━━━━━━━━━━━━━━━━━━━━━┅┅┅┅┅┅┅┅┅┅┅┅┅━━━━━━━━━━━━━━━━━┄┄┄
```

- The route shown: the North wall is selected, then *Do: Add opening* arms Opening scoped to it.
  The Do entry was only a door; the armed state belongs to the rail.
- Pressing O with nothing selected arms the same tool for any wall under the pointer. Hovering the
  Rotunda wall at the Gallery door reads *⊘ Overlaps Gallery door*.
- The tag gives the gap to Harbor at Dusk (2.10 m). Typing sets that gap at the gesture.

### 14.6 Ordinary measurement

```text
 ┌─┐
 │↖│
 │╱│
 │∩│
 │+│
 │↔│» [Distance ▾]  chain ✓ · temporary · Esc clears
 ├─┤
 │⋯│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┄┄┄
 └─┘  ┃ ●                      ▬▬▬▬▬▬▬▬▬▬▬▬
      ┃ ┊ ‹2.68 · Δz 2.68›
      ┃ ┊
      ╎ ●         ─────────────────
      ╎                         ▪▪▪▪▪▪▪▪
      ╎       Long Gallery
      ┃       R-LONG · ceiling 4.20
      ┃    ▬▬▬▬▬▬▬                                 ▬▬▬▬▬
      ┗━━━━━━━━━━━━━━━━━━━━━━┅┅┅┅┅┅┅┅┅┅┅┅┅━━━━━━━━━━━━━━━━━┄┄┄
```

- Two clicks measure 2.68 m from the north corner to the Entrance. That answers a curator's "will
  a 3.00 m painting fit here?" without any panel.
- Measurements are working information: never authored, never in history, cleared by Esc. Holding
  ⌥ with something selected shows its distances to neighbours without arming anything.

### 14.7 Explicit precision

```text
┌──────────────────────────────────┐
│ Garden window                    │
│ Window · rounded · O-GW          │
│ in Rotunda wall                  │
│ 1.60 wide · 2.50 high · sill 0.90│
│                                  │
│ Look  Face · Unroll wall         │
│ Do    Centre on wall · ⋯         │
│ Details ›                        │
└──────────────────────────────────┘
╭─ Dimensions · Garden window ─────────────────────────────────────────── Layout (i)   Done   ✕ ─╮
│ Along Rotunda wall [ 4.32 ] from start    Width [ 1.60 ]  keep ● centre ○ start ○ end          │
│ Height [ 5.50 ] ⊘   Sill [ 0.90 ]   → head 6.40         Profile [ Rounded ▾ ]   Rise [ 0.80 ]  │
│ ⊘ Head would reach 6.40 m, above the Rotunda wall (6.00 m high). Esc restores 2.50.            │
│ Each field commits on ↵ as one undo step. Height and sill have handles on a wall laid flat.    │
╰────────────────────────────────────────────────────────────────────────────────────────────────╯
```

- Pressing ↵ on the selection, clicking a tag or clicking a Card fact opens Dimensions with that
  field focused.
- Height and sill are not legible in plan Paper, so Dimensions is their writer here. On a wall laid
  flat they also have handles, and a live drag turns these fields into displays.
- The refusal sits at the field with its reason, and Esc restores the value. The Card never shows
  5.50.

### 14.8 Paper and reference controls

```text
 [Paper ●━━━━ 3D]  1:100 ▴
 ┌────────────────────────────────────────────────────────────┐
 │ PAPER: how this reading is drawn · view settings, no Undo  │
 │ Scale     1:50   [1:100]   1:200                  Fit all  │
 │ Grid      ● on    1 m / 5 m · 1-2-5 ladder              G  │
 │ Snap      ● on    0.25 m · ends · faces · alignments       │
 │ Labels    Rooms ✓   Objects ○   Dimensions [Selected ▾]    │
 │ Rulers    ○ off                                            │
 │ Cut       1.20 m above the floor                           │
 │ Datum     Level 0 · floor ±0.00            set in Layout   │
 │ Show      Objects ✓   Ceiling outlines ○   Experience ○    │
 └────────────────────────────────────────────────────────────┘
```

- The chip names the reading's scale, and the Sheet holds view settings only.
- The datum is displayed, not written: it belongs to Layout.
- Experience marks are off by default in World, which exposes no cross-lens references at rest.

### 14.9 Advanced discovery

```text
╭─ Find ──────────────────────────────────────────────────────────────────────────────── Esc closes ─╮
│ ⌕ Find a tool, action, place or setting▏                                                           │
│                                                                                                    │
│ FOR LONG GALLERY   Divide…   ·   Look up   ·   Lift ceiling                                        │
│                                                                                                    │
│ TOOLS      Draw W: wall · rectangle · circle · polygon · free-standing   Opening O: door · window  │
│ PLACE      Column · Platform · Plinth · Box · Cylinder · Sphere · Browse all…                      │
│ ARRANGE    Align · Repeat… · Centre opening on wall                                                │
│ LOOK       Face · Unroll · Section · Lift ceiling · Look up · Reveal                               │
│ MEASURE    Distance · Angle                                                                        │
│ PAPER      Grid · Snap · Scale · Labels · Fit all                                                  │
│ HELP       Keys                                                                                    │
╰────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

```text
╭─ Find ──────────────────────────────────────────────────────────────────────────────── Esc closes ─╮
│ ⌕ divide▏                                                                                          │
│                                                                                                    │
│ FOR LONG GALLERY                                                                                   │
│ ▸ Divide Long Gallery…     with a new wall; consequences shown before Apply              Layout    │
│                                                                                                    │
│ TOOLS                                                                                              │
│   Draw · Wall          W   a boundary wall drawn across a room divides it directly                 │
│                                                                                                    │
│ GO TO                                                                                              │
│   no places match                                                                                  │
╰────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

- With Long Gallery selected, Find opens on what applies to it, then the families.
- The query "divide" puts the procedure first and the direct alternative second, because drawing a
  boundary wall across a room divides it with no procedure at all.

### 14.10 A complex procedure

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ⌂ Museum Editor ▾   Saltmarsh Museum           [ World │ Experience ]            ↶ ↷   Saved   ▷ Preview │
├──────────────────┬──────────────────────────────────────────────────────────────┬────────────────────────┤
│ Search   Browse ▾│ [Paper ●━━━━ 3D]  1:100 ▾                                    │ Long Gallery           │
│                  │                                                              │ Room · R-LONG · Level 0│
│ Saltmarsh Museum │ ┌─┐                                                          │ 101.9 m² · ceiling 4.20│
│ › Long Gallery   │ │↖│                                 ╭━━━━━━━━━━━━━━━━━━╮     │                        │
│                  │ │╱│                                 ┃                  ┇     │ Look  Look up · Lift   │
│ BOUNDS           │ │∩│   ┏━━━━━━━━━━━━━━━━░━━━━━━━━━━━━┫                  ┃     │ Do    Divide… · ⋯      │
│   North wall     │ │+│   ┃           ▬▬▬▬▬░▲           ┃  Rotunda         ┃     │ Details ›              │
│   South wall     │ │↔│   ╎ Long Gallery   ░            ╎  R-ROT           ┃     │                        │
│   West wall      │ ├─┤   ╎ R-LONG · 4.20  ░            ╎  ceiling 6.00    ┃     │                        │
│   Rotunda wall   │ │⋯│   ┃            ▪▪▪ ░            ┃        ▪         ┃     │                        │
│ OPENINGS         │ └─┘   ┃  ▬▬▬           ░    ▬▬      ┃                  ┇     │                        │
│   Entrance       │       ┗━━━━━━━━━━┅┅┅┅┅┅░⊘━━━━━━━━━━━┫                  ┃     │                        │
│   Clerestory     │                                     ┃                  ┃     │                        │
│   Gallery door   │                                     ╰━━━━━━━━━━━━━━━━━━╯     │                        │
│ LOCATED HERE     │ ╭─ Divide Long Gallery — with a new wall ──────────────────╮ │                        │
│   Oak bench      │ │ Offset from West wall [ 8.75 ]  ▲ 1 caution · ⊘ 1 refusal│ │                        │
│   Harbor at Dusk │ │ Creates 1 wall, 1 room · splits 2 walls    Cancel  Apply │ │                        │
│   +3 more        │ ╰──────────────────────────────────────────────────────────╯ │                        │
└──────────────────┴──────────────────────────────────────────────────────────────┴────────────────────────┘
```

The Instrument, enlarged:

```text
╭─ Divide Long Gallery — with a new wall ───────────────────────── Layout (i)   Bring into view   ✕ ─╮
│ ① Place the line   ② Resolve   ③ Apply                                                             │
│                                                                                                    │
│ Line      ● across, North wall to South wall    ○ along        Offset from West wall [ 8.75 ] m    │
│ New wall  0.25 thick · 4.20 high, matching Long Gallery           New room name [ East Gallery ]   │
│                                                                                                    │
│ ▲ Harbor at Dusk would be covered by 0.38 m of the new wall. Move it, or clear from 9.13           │
│ ⊘ Clerestory would be cut by the new wall (0.23 m); an opening cannot straddle it. Clear from 8.99 │
│                                                                                                    │
│ Creates    1 wall · 1 room, the east part, 42.8 m²       Keeps  R-LONG on the west part, 57.4 m²   │
│ Splits     North wall · South wall                        Moves  Three Pears → new room (derived)  │
│ Connects   Gallery door now joins the new room ↔ Rotunda; Long Gallery keeps only the Entrance     │
│ Elsewhere  Experience: 2 references stay with R-LONG · Camera: 1 connection uses the Gallery door  │
│                                                                                                    │
│ □ Add a 1.80 m passage in the new wall                                                             │
│                                              Cancel     Apply ⌘↵  unavailable: resolve 1 refusal   │
╰────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

- **Mechanism.** One boundary wall chain runs between the North and South walls. Noding splits
  both walls, and lineage keeps R-LONG on one part and births one Room. Nothing edits a Room.
- The divider on Paper is draggable along the room (snapping every 0.25 m), and the offset field
  is its precision writer. Both act on the same proposal, with one writer live at a time.
- The caution (▲) and the refusal (⊘) are distinct and worded. Apply stays unavailable while a
  refusal stands. Validator wording here is illustrative; the rules belong to Layout's validators.
- The Card keeps Long Gallery's accepted facts (101.9 m²), never the proposal. Undo and Redo are
  unavailable while the proposal is open.
- The "Elsewhere" counts are illustrative. Camera and Experience compute them; the shell only
  shows them.

### 14.11 Apply and Cancel

```text
╭─ Divide Long Gallery — with a new wall ───────────────────────── Layout (i)   Bring into view   ✕ ─╮
│ ① Place the line   ② Resolve   ③ Apply                                                             │
│                                                                                                    │
│ Line      ● across, North wall to South wall    ○ along        Offset from West wall [ 9.50 ] m    │
│ New wall  0.25 thick · 4.20 high, matching Long Gallery           New room name [ East Gallery ]   │
│                                                                                                    │
│ ✓ Clear of Harbor at Dusk by 0.38 m and of Clerestory by 0.52 m                                    │
│                                                                                                    │
│ Creates    1 wall, 1 passage · East Gallery, 37.8 m²   Keeps  R-LONG on the west part, 62.4 m²     │
│ Splits     North wall · South wall                     Moves  Three Pears → East Gallery (derived) │
│ Connects   Gallery door now joins East Gallery ↔ Rotunda; the passage joins Long ↔ East Gallery    │
│ Elsewhere  Experience: 2 references stay with R-LONG · Camera: 1 connection uses the Gallery door  │
│                                                                                                    │
│ ■ Add a 1.80 m passage in the new wall, centred                                                    │
│                                                       Cancel     Apply ⌘↵   one undo step          │
╰────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

After Apply:

```text
 Head:  ↶ Undo Divide Long Gallery   ↷        Saved

 ┌─┐
 │↖│
 │╱│
 │∩│                                                            ┌──────────────────────────────┐
 │+│                                                            │ Long Gallery                 │
 │↔│                                                            │ Room · R-LONG · Level 0      │
 ├─┤                                                            │ 62.4 m² · ceiling 4.20       │
 │⋯│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━┄┄┄  │                              │
 └─┘  ┃                        ▬▬▬▬▬▬▬▬▬▬▬▬ ┃                   │ Look  Look up · Lift ceiling │
      ┃                                     ┃                   │ Do    Divide… · ⋯            │
      ┃                                     ┃  East Gallery     │ Details ›                    │
      ╎                                     ╎  R-3 · 4.20       └──────────────────────────────┘
      ╎                         ▪▪▪▪▪▪▪▪    ╎
      ╎       Long Gallery                  ┃
      ┃       R-LONG · ceiling 4.20         ┃
      ┃    ▬▬▬▬▬▬▬                          ┃      ▬▬▬▬▬
      ┗━━━━━━━━━━━━━━━━━━━━━━┅┅┅┅┅┅┅┅┅┅┅┅┅━━┻━━━━━━━━━━━━━━┄┄┄
```

- Typing 9.50 resolves both problems, and the consequences update with it.
- **Apply** records one undo step, *Divide Long Gallery*, and closes the Instrument. Long Gallery
  stays selected with its new facts, the born room appears with its name, and the Head names the
  step. R-3 stands for whatever reference the identity ledger assigns.
- Dividing, adding the passage and naming the born room form one compound acceptance (F.4). Until
  Layout offers that composed plan, the passage and name options are withheld rather than split
  into several undo steps.
- **Cancel** or Esc removes the proposal and closes the Instrument. Nothing enters history, and
  Long Gallery stays selected.

### 14.12 Paper ⟷ 3D

```text
Paper end     [Paper ●━━━━ 3D]  1:100 ▾     vellum; Long Gallery selected (ochre contour)
     ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
     ┃   Long Gallery              ┃
     ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫

Mid-tilt      [Paper ━━●━━ 3D]  52°         the thumb travels with the real elevation
        ┏━━━━━━━━━━━━━━━━━━━━━━━━━┓
      ╱   Long Gallery              ╲
     ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

3D end        [Paper ━━━━● 3D]  View ▾      mat; same target, scale, selection, tool and open work
         ┌─────────────────────────┐
       ╱   Long Gallery              ╲
     ╱_________________________________╲
```

- The camera tilts about the current target and keeps its scale. Nothing refits or retargets.
- An open Divide proposal stays open and re-renders as a translucent wall. Its handles remain while
  the floor plane is legible.
- Index, Card, rail and Instrument do not move. Only the material and the legible handles change.

### 14.13 Narrow desktop, sides collapsed

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ⌂  ⌖ Long Gallery ▾        [ World │ Experience ]        ◈ North wall ▾   ↶ ↷  ▷ │
├──────────────────────────────────────────────────────────────────────────────────┤
│ [Paper ●━━━━ 3D]  1:100 ▾                          ║ North wall                  │
│                                                    ║ Wall · W-N · bounds Long    │
│ ┌─┐                                                ║ Gallery                     │
│ │↖│                                 ╭━━━━━━━━━━━━━━║ 16.26 m long · 0.25 thick   │
│ │╱│                                 ┃              ║ 4.20 high                   │
│ │∩│   ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫              ║                             │
│ │+│   ┃           ▬▬▬▬▬▬            ┃  Rotunda     ║ Look  Face                  │
│ │↔│   ╎   Long Gallery              ╎  R-ROT       ║ Do    Add opening · ⋯       │
│ ├─┤   ╎   R-LONG · ceiling 4.20     ╎  ceiling 6.00║ Details ›                   │
│ │⋯│   ┃            ▪▪▪              ┃        ▪     ║                             │
│ └─┘   ┃  ▬▬▬                ▬▬      ┃              ║ Esc or ◈ closes this sheet  │
│       ┗━━━━━━━━━━┅┅┅┅┅┅┅━━━━━━━━━━━━┫              ║                             │
│                                     ┃              ║                             │
│                                     ╰━━━━━━━━━━━━━━║                             │
│                                                    ║                             │
│                                                    ║                             │
│ ├────┼────┤ 5 m                                    ║                             │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- `⌖ Long Gallery ▾` opens the Index sheet, and `◈ North wall ▾` has opened the Card sheet shown.
- The sheet overlays the Stage, so the drawing does not move. Closing it changes nothing either.
- The rail, reading cluster and scale bar are identical to the wide frame.

### 14.14 Capability growth without rail growth

Asterisks mark hypothetical capabilities. No schema for them is ratified or proposed.

```text
 ┌─┐
 │↖│
 │╱│» Makes [Wall ▾]  [╱] □ ○ △ ∿   0.25 · 4.20 h
 │∩│        ┌──────────────────────────────────┐
 │+│        │ Wall                bounds rooms │
 │↔│        │ Free-standing wall               │
 ├─┤        │ Space edge*     builds no wall   │
 │⋯│        │ Railing*                         │
 └─┘        │ Glazed screen*                   │
            └──────────────────────────────────┘
```

```text
╭─ Find ──────────────────────────────────────────────────────────────────────────────── Esc closes ─╮
│ ⌕ Find a tool, action, place or setting▏                                                           │
│                                                                                                    │
│ FOR GALLERY 2 (Space*)   Divide… · Merge with… · Add to zone*…                                     │
│                                                                                                    │
│ BUILD      Wall · Free-standing wall · Space edge* · Railing* · Glazed screen* · Freeform*         │
│ OPENINGS   Door · Window · Passage* · Niche* · Skylight* (ceiling) · Floor opening* (slab)         │
│ PLACE      Structures · Objects · References* (underlays) · Browse all…                            │
│ ARRANGE    Align · Distribute* · Repeat… · Array along a path*                                     │
│ CONSTRAIN  Lock distance* · Lock angle* · Equal spacing*                                           │
│ CHECK      Clearances* · Daylight* · Circulation* · Sightlines*                                    │
│ NOTE       Keep dimension* · Note* · Revision cloud*                                               │
│ LOOK       Face · Unroll · Section · Elevation* · Level below*                                     │
│ PAPER      Grid · Snap · Scale · Labels · Show level below* · Overlays*                            │
╰────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

- The rail is still the same six slots. Growth lands in Makes, Kind, the Place catalogue, Do
  rankings, Look readings, Sheet "Show" entries and Find families.
- The Index breadcrumb grows a level (for example `Saltmarsh Museum › Level 1`) without new chrome.

## 15. Stress tests

None of these is a commitment, and none is given a schema here.

| Pressure | Where it lands | Shell change |
| --- | --- | --- |
| Spaces without walls; regions | Draw, Makes = Space edge; the Card and Index show a Space like a Room | none, once a Space model is ratified |
| Richer curved and freeform boundaries | Draw shapes (arc, freeform); knot and tangent handles | none |
| More openings and hosts | Opening kinds (passage, niche, skylight, floor opening); the gesture finds ceiling and slab hosts; ceiling and wall Paper make them legible | none |
| Several levels; elevation work | the Index breadcrumb carries the level; the Sheet shows the level below and the cut; Look adds Section and Elevation; vertical measures gain handles on a wall laid flat | none |
| Constraints | Measure or Do on a dimension offers Lock; Details lists constraints; conflicts become Repair procedures | none |
| References and underlays | Place, Reference; the Sheet sets visibility and opacity; calibration is a procedure | none |
| Annotations | Measure gains *Keep* when an annotation domain exists; the Sheet shows annotations | none |
| Inspection and analysis | the Sheet's "Show" holds passive overlays; Find's Check runs active analyses whose issue lists live in the Instrument | none |
| Reusable definitions, groups | the Card's kind line names the definition; Owner · Source · Reach appear at the writer | none |
| Arrays, distribution | Do on the subject; parameters in a procedure | none |

## 16. One owner per fact

| Fact | Its single writer | May display it |
| --- | --- | --- |
| Selected identity | the existing selection facade, fed by Stage, Index and Find's *Go to* | Card, Index, Stage contour, Head chip at narrow widths |
| Armed tool | rail; keys and Find invoke the same owner | the option strip, the cursor |
| A tool's defaults for its next stroke | that tool's option strip | none |
| Reading (Paper, 3D, tilt) | reading switch; 1, 2 and ⌥-drag reach the same owner | Stage material |
| Scale | Sheet; wheel and pinch are navigation gestures | chip, scale bar |
| Grid, snap, labels, rulers, cut, what to show | Sheet | Stage |
| Datum | Layout | Sheet, datum key |
| A subject's name | Card | Index, Stage labels, Instrument header |
| A subject's settled measures | Instrument Dimensions | Card facts, Stage tags, Details |
| A live gesture's parameter | the gesture (handle plus S7 entry) | the Dimensions field, as "being set on Paper" |
| Derived facts (area, perimeter, ceiling, arc length, Located here, Bounds) | none: derived | Card, Details, Stage labels |
| Wall role | a Do procedure with consequences | Card kind line |
| Opening profile | Instrument Dimensions | Card kind line |
| A procedure's parameters | that procedure in the Instrument | the Stage preview |
| Lens | Head | none |
| Side panels hidden | the app menu entry; ⌘\ reaches the same owner | the layout |
| Reduce motion, Motion speed, keymap | Settings | none |

## 17. Review against the brief

| Review question | Answer | Where |
| --- | --- | --- |
| Does Paper stay visually dominant? | Yes. About 63 % of the wide frame; four small furniture objects at rest; no Instrument and no status rail | §3, §14.1 |
| Can a first-time creator find the basic tools? | Six rail slots with name-and-key tooltips; the empty Card teaches W and `/`; selecting reveals Do verbs; More opens a browsable Find | §5, §6, §14.1 |
| Can an experienced creator work with minimal disclosure? | Keys for every family, typing at the gesture, ↵ for Dimensions, ⌘↵ to apply, keys shown in Find | §7, §12 |
| Is the permanent scope defensible five years out? | The five families are verbs rather than features; growth arrives as variants; a new slot needs a new pointer grammar and an owner ruling | §4.2, §5 |
| Could capability double or triple without the rail growing? | Yes; every stress test lands in an existing tier | §15, §14.14 |
| Is shell space used intelligently? | The Card carries stable facts and doors instead of emptiness, and the Index carries relations; neither carries task state | §3, §6 |
| Are stable measurements separate from procedure state? | The Card shows accepted facts, tags display, and the Instrument holds proposals and writers | §6, §7, §14.10 |
| Does direct manipulation replace toolbar commands? | Move, resize, reshape, bend, rotate and slide are all handles; no such command exists | §10 |
| Are Paper settings distinct from authoring tools? | One chip and one Sheet at the reading; the rail holds only tools | §8 |
| Does every writable fact have exactly one owner? | Yes; a live gesture turns its field into a display | §16 |
| Are shell and domain boundaries preserved? | All seven exclusions hold, and domain work is isolated as pure plans and queries | §2, §19 |
| Does a narrow window keep the Stage and navigation without refitting? | The sides become overlaying sheets, and resizing changes only the visible bounds | §13, §14.13 |

Residual risks:

- An icon-only rail relies on tooltips, the empty-state hint and More for discovery. A labelled rail
  on first run is a cheap fallback.
- Do-row ranking has to be authored for each subject kind.
- The "Elsewhere" row depends on read-only Camera and Experience queries existing.

## 18. Peer evidence

| Peer idea | Verdict | Why |
| --- | --- | --- |
| A short resting verb bar (Draw, Place, Measure) plus a searchable action index | **Kept in essence** | Select and Opening are added. The index becomes Find *inside* the World Instrument, so discovery and the procedure it starts share one task owner |
| A permanent button for every primitive | Rejected | It grows with the vocabulary |
| One "Add" menu for all creation | Partly kept | Too slow for drawing; right for choosing a Place item |
| Floating contextual toolbars beside the selection | Rejected | They cover the drawing; verbs live in the Card's Do row and the context menu |
| Direct manipulation with Shift to constrain, a modifier to bypass snapping, double-click for precision | Kept | The exact modifiers wait for the keymap audit; double-click maps to Dimensions |
| Collapsible sidebars; the Index as a thin rail at narrow widths | Partly kept | Sheets invoked from Head controls instead, because a permanent thin rail costs Stage width |
| Measurements on the Card | Kept read-only | Editable Card fields would give one fact two writers |
| Paper toggles in a footer or status bar | Rejected | One chip beside the reading switch instead |
| One Find leading into a work Instrument | Kept | It is the core of §11 |
| Consequence previews | Kept, when earned | Local edits preview on Stage only |
| "Collapse" as a third exit that keeps a task's settings | Rejected | Apply and Cancel only; parking happens only on a lens crossing (PLATE §0.8.2) |
| Saving clearance envelopes as accepted drawing references | Rejected for now | It invents an authored type; Measure stays temporary until an annotation domain exists |
| Splitting a room as a Room edit | Rejected | Rooms are derived; dividing is a boundary wall chain (§9) |
| A History panel, a Keys button | Rejected | An Undo label, `?` and keys in Find instead (§12) |
| A gallery corner as the datum | Rejected | The datum is Layout's floor datum; Paper only displays it |
| F frames the whole World | Deferred | It conflicts with the prototype's F for Face; *Fit all* is explicit in the Sheet and in Find |
| Vocabulary families such as Create, Shape, Arrange, Inspect, Reference | Kept | As Find families and the registration contract's `family` |

## 19. Domain work, shell work and prototype changes

This is the separation an implementation plan has to respect. It is not that plan.

**Shell work (editor, World lens).**

- The rail with five families and More; option strips; scoped arming; host-seeking pointer
  feedback; legibility-gated tool input.
- The reading cluster: a switch over the one camera, and the chip with its Sheet (a view-settings
  store).
- The Card: key-facts line, condition line, Look, Do and Details doors, rename, the empty and set
  states.
- The World Instrument: Find, Dimensions, the procedure frame (steps, parameters, validation,
  consequences, Apply/Cancel), Look sessions, and parking and Resume as in PLATE §0.8.2.
- The capability registry (§4.3) and its placement rules; the context menu; keymap, tooltips and
  `?`.
- The narrow composition: Head location and identity controls, sheets, ⌘\.
- Retire the World status rail, the Head search, the Stage's Overview and Keys tools, and the Plan
  and 3D buttons.

**Domain work (pure, outside the shell).**

- A consequence summary computed from a planner result: identities created, split or retired
  (from lineage), derived membership changes and opening connectivity. It is derived, never stored.
- Composed Layout plans, so that a procedure is one atomic result and one undo step (F.4): divide,
  passage and naming the born Room together.
- Divide as a composition over `planWallChain` with endpoints on two boundary walls of one Room,
  plus validators for an opening straddling a new junction and for Scene attachments the new wall
  would cover.
- Fact schemas for each subject kind (writable or derived, units, ranges, validators), shared by
  the Card's display and Dimensions, and factored from what the Inspector does today.
- Read-only reference counts from Camera and Experience for the "Elsewhere" row, owned by those
  authorities.
- The flip as viewing intents on the one Camera authority (tilt about the target, keep scale, the
  detent), through T1's shared continuous viewport and projection seam.

**Prototype changes needed before this is executable there.**

1. Replace the Plan and 3D buttons and the bead with one switch, and drop `planCam()`'s fixed
   framing and the last-3D-pose restore.
2. Move *Search anything* from the Head into Find in the Instrument.
3. Remove the Overview and Keys Stage tools and the status rail; add the Sheet and Settings.
4. Card: add the key-facts line and the Do row; the *In place: Measure* door becomes Dimensions,
   reached through the facts.
5. Add the drawing families (Draw, Opening, Place, Measure). The prototype explicitly does not draw
   new walls or openings.
6. Rebind `o`, `m` and `p` as in §12.

**Prototype-only assumptions not to carry forward.** The fixed Plan framing, the last-pose restore,
snapshot Undo, the prototype's ceiling vocabulary (holes and soffits, where production derives Room
ceilings from boundary walls), the single-level fixture, and the rendering shortcuts named in the
prototype's acceptance limits.

## 20. Owner calls

These need a ruling at review. Each states the recommendation.

1. **Key-facts line on the resting Card.** It refines #112's protection of ordinary disclosure.
   *Recommend: accept.*
2. **The Card's Do row**, a third door beside Look and Details (PLATE §0.8). *Recommend: accept.*
3. **Six rail slots, with Opening as its own family.** *Recommend: accept.*
4. **Find lives in the World Instrument.** The Head search goes; the Index keeps Search for things.
   *Recommend: accept.*
5. **Retire the World status rail.** *Recommend: accept.*
6. **Flip semantics:** tilt about the current target, keep scale, return to the last working
   elevation. This changes accepted prototype behaviour. *Recommend: accept.*
7. **Commit grammar:** Dimensions fields commit on ↵, procedures on Apply, and Undo is unavailable
   while a proposal or gesture is live. *Recommend: accept.*
8. **Compound options wait for composed plans** (the passage, naming the born room) instead of
   producing several undo steps. *Recommend: accept.*
9. **"Free-standing wall" names role `partition`.** To architects, "partition" usually means a
   wall that divides rooms. *Recommend: accept.*
10. **Selection sets on the Card** versus PLATE's "exactly one selected identity". *Recommend: one
    canonical selection value that may be a set.*
11. **One Grid fact** across plan Paper and walls laid flat. *Recommend: accept.*
12. **Keymap audit** of V, W, O, P, M, 1, 2, G and `?` against the prototype's Look keys and
    production's numeric entry. *Recommend: settle during planning.*
