# Paper authoring shell — destination proposal

> **Status: accepted by the owner 2026-10-03 and promoted.** The four refinement reviews (§21) are
> accepted; every owner call takes its recommended option, with the Wall-semantics ruling of §9 and
> §20 call 9 (§20). The durable destination contract is now
> [PLATE §0.8.4](../../docs/reference/design-system/editor-shell-and-visual-system.md#084-world-paper-authoring-destination),
> which wins wherever this file differs. This file remains the rationale and design evidence. Nothing
> here is built or shipped, it proposes no persisted format, and the landed editor keeps its current
> shell until an explicit cutover. The prototype adoption plan is the
> [Paper adoption plan](../../docs/roadmap/p26-spatial-depth/design/paper-authoring-prototype/implementation-plan.md).
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
Things are found in one place, the Index; capabilities in another, Find. Neither answers the
other's question.

| The creator asks | Answered by | At rest |
| --- | --- | --- |
| Where am I, and where is that thing? | **Index**: relations, Search and Browse | place, level and relations |
| What does the World look like? | **Stage**: the Paper drawing | about 63 % of a 1440 px frame; four small furniture objects |
| What can my pointer do? | **Tool rail** | Select · Draw · Opening · Place · Measure · More |
| How is this Paper drawn? | **Reading cluster**: the Paper ⟷ 3D switch, the drafting state and ⋯ for the Sheet | one switch; scale, grid and snap as three words |
| What is this thing? | **Card** | identity, up to three read-only facts, Look · Details |
| How do I do that? | **Find** (More, ⌘K), in the World Instrument | absent |
| What am I doing to it? | **World Instrument** | absent |

Decisions, each argued below:

1. **Six permanent rail slots** (five pointer families and More) replace today's twelve-button
   tray. Each family is a distinct pointer grammar, not a frequent feature, and vocabulary grows
   as family variants, so capability can triple without a new slot (§5, §15).
2. **A five-tier capability rule** with a registration contract decides where every capability
   appears. Features never hand-place chrome (§4).
3. **The Card carries stable facts, read-only, and no verb row**: one title-block line at rest,
   every measure in Details, and each fact is a door to its one writer. Changing what a subject is
   starts from the fact that names it (§6).
4. **A five-rung precision ladder**: drag, read, type at the gesture, Dimensions, procedure
   parameters (§7).
5. **The drafting state is always legible beside the reading switch**: scale, grid and snap as
   three small words, grid and snap toggled in place. Their configuration sits behind ⋯ in the
   Sheet, never in the rail, the Card or a status rail (§8).
6. **Paper ⟷ 3D is one switch over one camera.** It tilts about the current target, keeps scale
   and never refits. Selection, ownership, the armed tool and open work all survive (§8).
7. **Host-seeking tools find their host by gesture, or start on a selected host; operations on a
   subject arrive with the subject** in one scoped list: the Card's ⋯, the context menu and Find's
   "For …" group (§9).
8. **Draw authors Walls; the system derives their spatial role.** Draw never asks whether a Wall
   bounds, divides or stands free. Dividing a room is drawing a Wall across it, previewed with
   lineage consequences, and nothing edits a Room (§9, §14.10).
9. **One task owner, and one home for each kind of discovery.** Find, Dimensions, procedures,
   validation, consequences and Apply/Cancel all live in the World Instrument, and Find holds
   capabilities only. Subjects are found in the Index's Search and Browse (§11).
10. **Undo/Redo with a verb label is the whole resting history surface.** No History panel, Keys
    button, Head search or status rail (§12).

Changes to the accepted prototype are listed in §19, the owner rulings in §20, and the four
refinement reviews in §21.

## 2. Authority, evidence and limits

**Normative inputs.** The [ratified decision record](../../docs/reference/decisions/northstar-ratification-2026-09-27.md)
and the [World | Experience amendment](../../docs/reference/decisions/world-experience-reconciliation-2026-09-29.md);
PLATE §0.7–§0.8.2 (shared and World laws, parking), §2.12 (one writable owner per fact), §4.4
(working surfaces and grid), §18.3 (state language) and §19 (precision near the gesture);
[architecture](../../docs/reference/architecture.md) (separate Layout, Scene, Camera and Experience
authorities, Rooms derived from architecture, one Camera authority); the
[persistence](../../docs/reference/components/persistence.md) history contract; and
[F](../../docs/reference/composition-execution.md) compound acceptance (F.4).

**Behavioural evidence.** The World Authoring Prototype and journeys A–F
([implementer reference](../spatial-authoring/IMPLEMENTER-REFERENCE.md),
[acceptance](../spatial-authoring/qa/ACCEPTANCE.md)); the
[World shell synthesis](../world-experience-shell-round/design/design-synthesis.md), including its
Browse and Search contract (§4) and the accepted
[dense search board](../world-experience-shell-round/QA-package/02-world-dense-search-recovery.png); the production
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
stress tests in §15 only show that the shell would not need redesigning. Mat ↔ paper motion timing
and the keyboard focus ring stay open (PLATE §0.3, §0.7.6). The keymap is settled for the
prototype in the adoption plan; the production binding table stays with the production planner.

**The brief's seven exclusions, and how the design keeps them.**

| Never introduced | How |
| --- | --- |
| A second selection truth | Card, Index (its rows and its Search and Browse results) and Stage read and write the existing selection facade, which already gates its typed slots to one active domain. Find never selects. Task focus, consequence highlights and linked tags are view-only (§11) |
| A second navigation or camera-motion system | The switch, Fit all and Bring into view are requests to the one Camera authority. Paper has no viewport state of its own (§8) |
| A Paper canonical document | Paper draws Layout and Scene. Sheet settings are view state: never authored, never in Undo (§8) |
| Merged Layout and Scene ownership | Place dispatches each item to its owner, and the owner is named where it matters (§5, §11) |
| Shell-owned spatial return history | Return stays with the spatial return authority (Bring into view, Put it back). Undo is source history only (§12) |
| Duplicate writable controls | One owner per fact, tabulated in §16. The drafting state and the Sheet divide the Paper's facts between them and never share one (§8) |
| A second task surface | Find, Dimensions, procedures and Look sessions all render in the World Instrument. Option strips hold only a tool's defaults for its next stroke (§5, §11) |

## 3. Shell map

Reference frame 1440 × 900.

| Region | Geometry | Holds | Never holds |
| --- | --- | --- | --- |
| **Head** | full width × 44 | ⌂ app menu (Settings, Keys, Hide side panels), project, World \| Experience, Undo/Redo with a verb label, save state, Preview | search, a history list, tools, Paper properties |
| **Index** | left, 248 | Search (`/`) and Browse, the one home for finding subjects; place breadcrumb including level; relation families (Rooms, Bounds, Openings on bounds, Located here, Attached here); hover highlights on Stage | tools, measures, task state, capability search |
| **Stage** | centre, about 904 × 856 | the drawing; reading cluster (top left: switch, drafting state, ⋯); rail (left edge, 44 px); scale bar (bottom left); datum key (bottom right); World Instrument (bottom, invoked) | panels, persistent messages, a status rail |
| **Card** | right, 288 | identity and ⋯, key facts, condition, Look · Details | writable numbers, verb rows, proposal values, Apply/Cancel, steps, tool options, Paper properties |
| **World Instrument** | lower Stage edge, inset 12, height by content, at most 45 % of the Stage | Find (capabilities), Dimensions, procedures, Look sessions | identity: it names its subject, the Card owns it; subjects to find |

The Stage's resting furniture is four small objects. The World status rail is retired: grid and
snap state move to the reading cluster and their configuration to the Sheet, Reduce motion and
Motion speed move to Settings, and refusals and hints move to the gesture (PLATE §19).

## 4. The capability rule

### 4.1 Tiers

| Tier | Qualifies when | Home | Resting cost |
| --- | --- | --- | --- |
| **Permanent** | it is a pointer family with a grammar of its own (what the pointer targets and what the gesture produces) that can be armed with nothing selected and that finds, or refuses with a reason, its own target | rail | one slot per family; six slots in total |
| **Direct** | it changes the selected subject's legible geometry | handles and tags on Stage | none |
| **Contextual** | it needs a chosen subject | the subject's scoped list: the Card's ⋯, the context menu and Find's "For …" group. Changing what the subject is starts from the Card's kind word, and fixing its condition from the condition line (§6) | none: it arrives with the selection |
| **Disclosed** | it is registered | Find in the Instrument (⌘K, the rail's More, the Card's ⋯, the context menu's More…) | none |
| **Procedural** | it needs steps, several parameters, validation, consequences or Apply | World Instrument, however it was invoked | none: only while running |
| Reading (not authoring) | it changes how Paper is drawn, never what the World is | the reading cluster's drafting state for scale, grid and snap; the Sheet for the rest | three words |
| App (not authoring) | it concerns the editor, not the World | Settings | none |

Finding a subject is not a capability. It belongs to the Index's Search and Browse (§11).

A capability may have several *entries* but only one *home for its state*. Opening is armed from
the rail, from O or from Find; with a host selected, it starts on that host (§5). Its state lives
in the tool and, once it becomes a procedure, in the Instrument.

### 4.2 Admission test

Apply in order; the first match places the capability.

1. It changes no World fact: **Reading** or **App**.
2. It can be done by pulling something already on Paper: **Direct**. No command is added.
3. It is a new pointer grammar, meaning a pairing of what the pointer targets and what the
   gesture produces that no family already has, and it can be armed with nothing selected:
   **Permanent**, and only with owner ratification (expected at most once in five years). A new
   *kind* of an existing gesture is a variant inside that family. Frequency, familiarity and
   importance never qualify a capability for the rail.
4. It needs a chosen subject: **Contextual**. It joins the subject's scoped list, in one fixed
   order per subject kind that use never re-ranks. Only two kinds of contextual action appear on
   the Card itself, each on the fact it concerns: changing what the subject is (the kind word) and
   fixing its condition (the condition line).
5. It needs steps, several parameters, validation, consequences or Apply: **Procedural**, whatever
   its entry.
6. Everything is also **Disclosed**.

### 4.3 Registration contract

Each capability is a shell registry entry: editor code, never authored data.

| Field | Purpose |
| --- | --- |
| id, label, synonyms | Find matching and announcements |
| family | Draw · Opening · Place · Measure · Arrange · Look · Check · Repair · Reading |
| form | tool variant · handle · verb · kind change · look · procedure · reading property |
| subjects and hosts | subject kinds it applies to (none means host-independent); host kinds its gesture may target |
| owner | Layout · Scene · Camera · Experience · Resources; routes the write and is shown at the decision point |
| consequence class | local · topological · cross-subject · cross-lens; decides whether consequences show (§11) |
| precision schema | fields, units, ranges and validators |
| legibility | readings in which its input and handles are legible |
| order and key | one fixed order per subject kind for the scoped list, never re-ranked by use; an optional default key (settled in the adoption plan's §Keymap) |

Placement is computed from these fields. Adding a skylight means registering an Opening variant
whose host is a ceiling; no shell code changes.

### 4.4 Today's vocabulary, placed

| Capability, and where it lives today | Destination |
| --- | --- |
| Select (Plan tray) | rail: Select |
| Wall chain, Rect Room, Poly Room (tray DRAW) | rail: Draw, Shape = chain, rectangle, circle or polygon |
| Partition chain (tool; Inspector "Defines room boundary") | Draw, which makes Walls; the Wall's spatial role follows from the resulting topology and is never chosen (§9). The landed role choice retires at the Layout cutover (§19) |
| Door, Window (tray OPENINGS) | rail: Opening, Kind; a later door ↔ window flip from the Card's kind word |
| Column, Platform, Plinth (tray); Box, Cylinder, Sphere | rail: Place, item; owners Layout and Scene |
| Snap 0.25 m, Grid (View Bar) | the reading cluster's drafting state (on or off, interval); the Sheet (configuration) |
| Tour (View Bar) | Preview and the Experience lens |
| Numeric entry during a gesture (S7) | unchanged: precision rung 3 |
| Wall length, thickness, height; opening offset, width, sill, profile; room floor and ceiling thickness (Inspector fields) | Instrument Dimensions is the single writer; Card and tags display |
| Room area, perimeter and ceiling (Inspector, derived) | Card key facts and Details, read-only |
| Names (Inspector) | Card rename |
| Room move and rotate, opening move and centre, junction dissolve, object align and repeat, room duplicate (Layout planners) | handles for moves; a set's Dimensions for align; the scoped list and Find for the rest; procedures where parameterised |
| Face, Unroll, Section, Lift, Look up, Reveal (prototype Look) | Card Look; sessions in the Instrument |
| Precision (prototype Instrument) | Dimensions and procedure parameters |
| Repair (prototype) | Card condition line, then the Instrument |
| Search anything (prototype Head) | the Index's Search (`/`), keeping its verbs and reasons |
| Overview, Keys (prototype Stage tools) | Fit all in the scale menu; `?` and tooltips |
| Wall grid, Reduce motion, Motion speed (prototype status rail) | the drafting state's grid; Settings |
| Plan and 3D buttons, tilt bead (prototype) | one reading switch |

## 5. The permanent core

```text
┌─┐
│↖│  Select   V   choose, move, reshape; every handle lives here   default
│╱│  Draw     W   trace walls; what they enclose follows           variants: Shape
│∩│  Opening  O   cut a door, window or passage into a host        variants: Kind
│+│  Place    P   put a structure or object into the World         variants: item
│↔│  Measure  M   temporary distances and angles; never authored   variants: Distance · Angle
├─┤
│⋯│  More     ⌘K  find any tool, action or setting                 opens Find in the Instrument
└─┘
```

**Why these five, for five years.** A family earns its slot by grammar: what the pointer targets
and what the gesture produces. No two families share both, and each absorbs new vocabulary as
variants.

| Family | The pointer targets | The gesture produces | Grows as |
| --- | --- | --- | --- |
| Select | an existing subject or one of its handles | identity; through handles, a change to what exists | handle kinds |
| Draw | a working plane | new Walls; whether they enclose, divide or stand free is derived from the result | Shape; Makes, once a second authored primitive exists |
| Opening | an existing host, found under the pointer | an embedded cut in the host's own coordinates, which may change connectivity | Kind, each naming its host class |
| Place | a point on a plane or on a host | a discrete item from a catalogue, which leaves its host unchanged | the catalogue |
| Measure | any points | nothing authored | Distance · Angle |

Each can be armed with nothing selected, and Opening and hosted Place items seek an eligible host
under the pointer and refuse others in words. **More** is the bridge from permanent to disclosed
capability, so a first-time creator never has to know a key.

**Why Opening keeps its slot.** It is the only family that cuts into an existing subject. Draw and
Place add, and Select changes what exists. Its durable grammar is an embedded cut in an existing
host's own coordinates, which may affect connectivity: a door through a wall that bounds two rooms
records the rooms it joins (`connectsRoomIds` in the wall-first model), and procedures report it
under Connects (§11), while a niche or a future skylight need not join anything. Draw authors new
geometry and the system derives what it encloses; Opening cuts into geometry that already exists.
Each act has one pointer family. Frequency is not the argument. §21.1 tests the alternative, openings as a contextual verb
of a selected host, and the slot holds on first use, repeated work, host discovery and narrow
width. **Opening would lose its slot** if openings became catalogue items dropped onto hosts at
fixed sizes, which would make them a Place variant, or if host-seeking became a modifier that every
family shares.

**Host first.** With a host selected (or an opening, whose host counts), O starts on that host: it
wins ties under the pointer, and the strip names it. Moving onto another host leaves it. No
separate *Add opening* verb exists anywhere, so the host-first route needs no Card entry.

**Option strip.** Arming a tool flies its strip out from its slot:

```text
 │╱│» Wall  [╱] □ ○ △   0.25 thick · 4.20 high   click to start · type a length · ↵ ends
```

The strip holds only the tool's defaults for the next thing it makes and a one-line key hint that
fades after a few uses. It never holds facts of existing things, steps or Apply. Esc or V returns
to Select and closes it.

Draw makes Walls and asks nothing about their role. Whether a Wall bounds a room, divides one or
stands free is derived from what the gesture produces, and the Stage previews it while drawing
(§10). *Wall* on the strip is a label until a second authored primitive is registered; only then
does it become a Makes chooser (§14.14).

**Arming rules.** Tools stay armed until Esc or V. Arming never changes the selection, and what a
gesture makes becomes selected. A preferred host is task focus, never selection (PLATE §0.8).
Tools are gated by the legibility of their input plane, not by the
reading: Draw keeps working in a tilted view while the floor plane is legible, and at a grazing
angle the pointer says why it cannot place.

## 6. The Card and the Instrument

The Card answers *what this thing is*. The Instrument answers *what the creator is doing to it*.

```text
┌──────────────────────────────────────┐
│ North wall                         ⋯ │  name: the Card's one writable fact (F2); ⋯ opens the scoped list
│ Wall · W-N · bounds Long Gallery     │  kind · reference · derived spatial role and place
│ 16.26 m · 0.25 thick · 4.00 high     │  ≤ 3 key facts, read-only; each opens its writer
│                                      │  condition, only when true, with its own fix
│ Look  Face                           │  readings this subject supports
│ Details ›                            │  relations and every measure, read-only
└──────────────────────────────────────┘
```

Key facts per subject kind, with values from the prototype's Saltmarsh fixture (centrelines and
0.25 m gallery walls; areas are interior and rounded). An unnamed subject is titled by its
reference until it is named:

| Subject | Kind line | Key facts at rest | Details adds |
| --- | --- | --- | --- |
| Wall that bounds a room | Wall · W-N · bounds Long Gallery | 16.26 m · 0.25 thick · 4.00 high | faces, junctions, openings, attached art, the rooms each side |
| Curved wall | Wall · W-ROT · bounds Rotunda, Long Gallery | 34.56 m around · r 5.50 · 0.30 thick | height, sweep, openings |
| Wall that encloses nothing, titled W-12 | Wall · W-12 · free-standing in Long Gallery | 4.00 m · 0.20 thick · 3.00 high | junctions, openings |
| Wall drawn across a room | Wall · W-13 · divides Long Gallery ↔ East Gallery | 11.65 m · 0.20 thick · 4.20 high | junctions, openings, the rooms each side |
| Opening | Window ▾ · rounded · O-GW · in Rotunda wall | 1.60 wide · 2.50 high · sill 0.90 | position along the host, rise, rooms it connects |
| Room (derived) | Room · R-LONG · Level 0 | 101.9 m² · ceiling 4.20 | perimeter, floor and ceiling thickness, Bounds, Openings on bounds, Located here |
| Structure (Layout object) | Plinth ▾ · in Long Gallery | 0.80 × 0.80 · 0.90 high | placement |
| Object (Scene) | Object ▾ · in Long Gallery (derived) | footprint · rotation | source, attachment |
| Junction | Junction · joins 2 walls | x −15.00 · z −3.50 | incident walls |
| Several things | 3 items · 2 objects, 1 plinth | extent 4.20 × 3.10 | the items |
| Nothing | Nothing selected · Saltmarsh Museum · Level 0 | 2 rooms · 191.8 m² of floor | a one-line hint |

Rules:

- The Card never holds writable numbers, verb rows, proposal values, steps, validation,
  Apply/Cancel, tool defaults or Paper properties. During a procedure it keeps showing accepted
  values.
- Every fact is a door to its one writer. A measure opens Dimensions with that field focused
  (§7); a derived fact opens its derivation in Details; the kind word opens what the subject can
  become; a condition offers its own fix (Bring into view, Repair, Resume).
- The name is the Card's one writable fact, because the Card is identity and naming is identity
  (F2 or double-click). Index rows and Stage labels only display it.
- **Why facts on the Card refine #112 rather than contradict it.** The #112 review removed a
  *numerical catalogue* from the ordinary Card and protects that with assertions. One title-block
  line is identity (a 16 m boundary wall and a 4 m screen are different things), and it fills the
  Card with stable meaning instead of empty space. The catalogue stays one click away in Details,
  and writers stay in the Instrument (owner call 1).
- **No verb row.** PLATE §0.8 gives the Card Look and Details, and this design adds no third row.
  Besides Look and Details, the Card acts only through a door on the fact it changes or on the
  condition it resolves, and nothing on it arms a tool. One ⋯ beside the name opens the subject's
  scoped list in Find: the same list, in the same fixed order, as the context menu (§21.2, owner
  call 2).
- **The kind word.** Where a subject can become another kind, its kind word carries ▾ and lists
  those kinds in schema order with the current one marked. Choosing one opens the change in the
  Instrument with its consequences, even when they are small, because the Card writes only names.
  Production already treats a door ↔ window flip as the same identity: the opening keeps its
  reference and name (`LayoutWallOpening`).
- **A Wall's role is described, never chosen.** A Wall has no kind word ▾ for its role. Whether it
  bounds a room, divides one or stands free is derived from the topology its geometry produces, and
  the kind line describes it (*bounds Long Gallery*, *divides Long Gallery ↔ East Gallery*,
  *free-standing in Long Gallery*). The role changes only when geometry changes (an end dragged to
  close or open an enclosure, a Wall added or deleted), and the Stage shows the room consequence
  during that gesture (§10).
- **Nothing selected.** The Card names the place and its derived facts plus one authored hint
  (PLATE §19, useful empty states). It never shows tool buttons: keys appear as text, and the rail
  owns arming.
- **Several selected.** The Card shows one canonical selection value that is a set: count, kinds
  and shared extent. Align and Distribute sit in the set's Dimensions, beside its extent and
  spacing, and in its scoped list. PLATE §0.8 speaks of exactly one selected identity, while
  production already carries placement sets (owner call 10).

What the Card offers, for a few subject kinds:

| Subject | Its kind word offers | Its scoped list (⋯, context menu, ⌘K) begins with |
| --- | --- | --- |
| Wall, in any derived role | nothing: its role follows from its geometry and is described in the kind line | Opening on this wall (O) · Face · Unroll (curved walls) |
| Opening | Door · Window ●: reference and name stay | Centre on wall · Face · Unroll wall |
| Structure | Column · Platform · Plinth ●: placement stays | Repeat… · Duplicate |
| Object | Replace with…: Owner · Source · Reach shown at the decision point | Repeat… · Duplicate |
| Room | nothing: a room is derived from its walls | Divide… (a Wall across the room, consequences before Apply) · Look up · Lift ceiling |
| Junction | nothing | Dissolve, when it joins two walls in line |
| Several things | nothing | Align · Distribute |

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

### 8.1 The drafting state and the Sheet

Paper's properties come in two kinds. **Drafting state** is the condition of the surface under the
pointer: how a distance on Paper reads and where the next point will land. **Configuration** is
how that condition is set up. The first is always legible; the second is opened.

```text
[Paper ●━━━━ 3D]   1:100 ▾   grid 1 m   snap 0.25   ⋯
```

The drafting state is three small words beside the reading switch, in the quiet text tone:

- `1:100 ▾` opens the scale menu: detents and *Fit all*, each a framing request to the one Camera
  authority. Between detents it reads the rounded ratio, and wheel and pinch remain navigation
  gestures. In 3D there is no single scale, so the word leaves; while tilting, it reads the
  elevation.
- `grid 1 m` toggles the grid (G reaches the same owner) and names the minor interval that the
  grid ladder has reached at this scale.
- `snap 0.25` toggles snapping and names its increment. A held modifier suspends it for one
  gesture, and the word reads `snap held off` while it does.
- Off is written (`grid off`, `snap off`), never shown by colour alone (PLATE §18.3).
- `⋯` opens the **Sheet**: grid ladder, snap increment and targets, labels and dimension display,
  rulers, cut height, the datum (display only) and what to show. See §14.8.

Rules:

- **State and configuration divide by fact.** Grid on or off and snap on or off are written only
  by their words; the grid ladder, the snap increment and the snap targets only by the Sheet. The
  Sheet shows on or off as read-only text beside the rules it configures, so no fact has two
  writers (PLATE §2.12).
- **Admission.** A Paper property joins the drafting state only if it changes how a distance reads
  or where the next point lands, and a creator would otherwise learn it by surprise. Scale, grid
  and snap qualify. Labels, rulers, cut height and what to show are configuration. A fourth word
  needs an owner ruling, as a rail slot does. The cluster never carries messages, hints, history,
  tool state or motion settings, because that was the retired status rail.
- Both kinds are view settings. They are not World facts, never enter Undo and are never authored;
  keeping them as a per-user preference is fine, but they are not project data.
- Grid is one fact for every Paper surface, plan or wall laid flat; the prototype's Wall grid joins
  it.
- The datum belongs to Layout. The Sheet and the datum key display it and do not write it.

| Placement considered | Verdict |
| --- | --- |
| Three words beside the reading switch, with the Sheet behind ⋯ | **Chosen.** The drafting condition is readable without opening anything, sits with the reading it qualifies, costs about 27 characters and survives narrow widths |
| One chip beside the switch, holding everything (this proposal's first draft) | Rejected: grid interval and snap state hide in a closed menu, so snap state is learnt by surprise (§21.3) |
| Status-rail toggles, CAD style | Rejected: far from Paper, a permanent strip that collects messages and settings, lost at narrow widths |
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
| selection, Card, Index, armed tool, open Instrument work, history, grid and snap, Sheet settings for each reading | camera elevation (Paper settles azimuth to the nearest 90°, the accepted detent); mat ↔ vellum material; which handles are legible; the scale word, which 3D drops | refit, retarget, rescale, lens change, cancelled work, a second camera |

The 3D end returns to the last *working elevation* about the current target, not to a remembered
pose. A wall laid flat (Look: Face or Unroll) is also Paper, with the same rail, Sheet and Card;
its vertical measures become legible and gain handles. While such a Look session runs, the switch
ends leave it at the current target, as the prototype does. Reduced motion makes the flip a cut;
mat ↔ paper timing stays PLATE's open call.

## 9. Contextual and host-dependent capability

| Capability | Exposure |
| --- | --- |
| Host-independent creation | permanent: Draw, and Place for free-standing items |
| Host-dependent creation | permanent tool whose gesture seeks a host: Opening and hosted Place items. With a host selected, the tool starts on it (§5); there is no separate *Add opening* verb |
| Operations on an existing subject | contextual only, in one scoped list with one fixed order: the Card's ⋯, the context menu at the pointer, Find's "For North wall" |
| Changing what a subject is | the Card's kind word, opening a procedure with consequences; also in the scoped list |
| Readings of a subject | Card Look, capability-driven and never a list of disabled entries |
| Finding a subject | not a capability: the Index's Search and Browse |

Checked against the product model:

- An opening is hosted by one wall and positioned along it, so the host is required. The gesture
  finds it.
- **Draw authors spatial geometry; the system derives and explains the spatial role it produces.**
  The Wall is the authored primitive. Drawing never asks for boundary, division or free-standing
  semantics first. Walls that take part in a closed enclosure act as its boundary; a Wall that
  encloses nothing is described as free-standing; a Wall drawn across an enclosed room divides it
  and produces the derived room topology. The role is previewed during the gesture, described on
  the Card and in Index relations, and never offered as a command (no *Make bounding* or *Make
  free-standing*).
- Rooms stay derived from architecture. **Dividing a room is drawing a Wall across it**, end to end
  between two of its walls. Noding splits those walls and room lineage keeps one Room identity and
  births another. *Divide…* remains a findable intent and a procedure for exact placement (§14.10);
  its mechanism is the same Wall authoring plus topology and consequence planning, and the
  Instrument names it ("with a new wall"). Moving or rotating a Room moves its walls through Layout
  planners; area and ceiling stay derived. No Room geometry is edited directly.
- An object's "in Long Gallery" is derived location and is never reassigned.

## 10. Direct manipulation

| Subject | Handles in plan Paper | Live tags | Notes |
| --- | --- | --- | --- |
| Wall | ends (move the junction; connected walls follow), middle (bend between straight and arc; knots on curved chains), body (offset parallel) | length, angle, clearance to a parallel neighbour | thickness and height through Dimensions; height also has handles on a wall laid flat |
| Opening | body (slide along the host), jambs (width) | gaps to neighbours and junctions on both sides | sill and head handles on a wall laid flat |
| Room | body (move), corner arc (rotate) | displacement, angle | moves its walls through planners; refuses in words when walls are shared |
| Structure or object | body (move), corner arc (rotate in 15° steps) | clearance to the nearest walls and objects | |
| Junction | point (move) | lengths of the incident walls | |
| Several things | body (move all) | displacement | Align and Distribute in the set's Dimensions and scoped list |

Snap indicators appear at the snap point (the 0.25 m snap increment, features, alignments). Arrows
nudge one snap step and ⇧ arrows nudge 1 m. Tab walks the selection's handles, and typing goes to the focused
handle's S7 field. Every move validates, and releasing while invalid cancels with no history.

**Gestures that change topology** (a chain that closes a room, a Wall drawn across one, an end
dragged free so an enclosure opens, a drag that collapses a room) draw
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

**Find is Paper's capability vocabulary.** ⌘K, the rail's More, the Card's ⋯ (scoped) and the
context menu's More… all open it, and Esc closes it. It finds tools and their variants, actions,
procedures, readings, checks, keys and settings. It never lists subjects or places, so nothing in
it selects, and being open never moves the camera.

- With an empty query it lists the selection's capabilities first ("For Long Gallery"), in the
  subject kind's fixed order, then the families. Every row shows its key.
- With a query it shows the selection's matches, then tools and actions. A match that cannot
  apply says why ("select a room first"); that is a reason on a search hit, not a menu of disabled
  entries.
- Choosing a tool arms it on the rail. Choosing a procedure turns Find into that procedure in
  place. Choosing a setting opens its one owner: the scale menu, the Sheet or Settings.
- When the query names subjects, one last row hands it over: *Search the project for "harbor" ·
  1 match · /*. It moves the query to the Index's Search and closes Find. Find shows the count,
  never the subjects.

**Two homes for discovery.** Each kind of discovery has one canonical home, and the two homes
cooperate without overlapping:

| Kind of discovery | Its home | Key | What a result does |
| --- | --- | --- | --- |
| Subjects: identities, places, levels, rooms, objects, relations, project structure | the Index's Search and Browse | `/` | offers Select, Open location, Bring into view and Reveal as separate verbs, each with its reason (World synthesis §4) |
| Capabilities: tools, variants, actions, procedures, readings, checks, keys, settings | Find, in the World Instrument | ⌘K, More | arms a tool, turns into a procedure or opens a setting's owner |

- Each home offers at most one handoff row to the other, carrying the query, and never renders
  the other's results. A query in the Index's Search that also names a capability ends with
  *"door" is also a tool · ⌘K*.
- Index results offer only those four verbs, and each acts directly on its own row: Bring into
  view, Open location and Reveal work on the result without selecting it first, and Select is a
  separate verb. Capabilities still take their scope from the selection, so authoring on a found
  subject (Find's "For …", the Card's ⋯) follows Select.
- `/` opens the Index's Search wherever the Index is, including its sheet at narrow widths (§13).

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
*Bring into view*. It never covers the reading cluster, because snapping still governs the work in
hand.

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
| `/` | Search the project, in the Index |
| ⌘K | Find a tool, action or setting |
| 1, 2 | Paper, 3D |
| ↵ | Dimensions for the selection; commit a field |
| ⌘↵ | Apply |
| G | Grid on or off |
| `?` | Keys |
| ⌥ held | suspend snap for the gesture in hand |
| ⌘Z, ⇧⌘Z | Undo, Redo |
| ⌘\ | Hide side panels |

The audit against the prototype's bindings and production's numeric-entry rules is settled in the
[Paper adoption plan](../../docs/roadmap/p26-spatial-depth/design/paper-authoring-prototype/implementation-plan.md)
§Keymap. `/` keeps the prototype's subject search and ⌘K moves to Find; snap has no letter key,
because S stays the prototype's square-up. The prototype's `o` (open), `m` (mirror) and `p`
(precision) move: Dimensions becomes ↵, Unroll is reached from Look, and mirror becomes a control
inside the Look-up session.

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
  over the Stage's left side. `/` opens the same sheet with Search focused.
- The Card becomes a Head identity chip (`◈ North wall ▾`) that opens the Card as a sheet on the
  right. The context menu and ⌘K reach the subject's scoped list without opening the sheet.
- The Stage keeps the full width. The rail, the reading cluster with its drafting state, the scale
  bar and the datum key are unchanged.
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
│ Search   Browse ▾│ [Paper ●━━━━ 3D]   1:100 ▾   grid 1 m   snap 0.25   ⋯        │ Nothing selected       │
│                  │                                                              │ Saltmarsh Museum       │
│ Saltmarsh Museum │ ┌─┐                                                          │ Level 0 · 2 rooms      │
│ › Level 0        │ │↖│                                 ╭━━━━━━━━━━━━━━━━━━╮     │ 191.8 m² of floor      │
│                  │ │╱│                                 ┃                  ┇     │                        │
│ ROOMS            │ │∩│   ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫                  ┃     │ Click anything on the  │
│   Long Gallery   │ │+│   ┃           ▬▬▬▬▬▬            ┃  Rotunda         ┃     │ Paper to select it.    │
│   Rotunda        │ │↔│   ╎   Long Gallery              ╎  R-ROT           ┃     │ W draws walls.         │
│                  │ ├─┤   ╎   R-LONG · ceiling 4.20     ╎  ceiling 6.00    ┃     │ ⌘K finds any tool.     │
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
- The drafting state reads at a glance: 1:100, a 1 m grid and 0.25 m snapping, without opening
  anything.
- Room labels follow the packet's Paper plan: name, reference and derived ceiling.
- The empty Card is not wasted. It names the place, its derived facts and one hint that teaches W
  and ⌘K without any button. The Index's Search field shows its own key, `/`.

### 14.2 Drawing walls

```text
 ┌─┐
 │↖│
 │╱│» Wall  [╱] □ ○ △   0.20 · 3.00 h
 │∩│
 │+│
 │↔│
 ├─┤
 │⋯│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┄┄┄
 └─┘  ┃         ┊              ▬▬▬▬▬▬▬▬▬▬▬▬
      ┃   ‹2.28›┊   ‹4.00 m · 0°›
      ┃           ●───────────────⊕
      ╎            free-standing · type a length · ↵ ends · Esc stops
      ╎                         ▪▪▪▪▪▪▪▪
      ╎       Long Gallery
      ┃       R-LONG · ceiling 4.20
      ┃    ▬▬▬▬▬▬▬                                 ▬▬▬▬▬
      ┗━━━━━━━━━━━━━━━━━━━━━━┅┅┅┅┅┅┅┅┅┅┅┅┅━━━━━━━━━━━━━━━━━┄┄┄
```

- W arms Draw. The strip holds only the defaults for the next stroke: its shape, thickness and
  height. It asks nothing about the Wall's role.
- The derived role is read at the gesture. This stroke encloses nothing, so its tag says
  *free-standing*. If the next click landed on the South wall, the tag would read *divides Long
  Gallery* and the Stage would tint the room that the division would create (§10).
- Tags sit at the gesture: length and angle, the clearance to the North wall's face, and the snap
  mark at the pointer (the 0.25 m snap increment that the drafting state names).
- Typing turns the length tag into the S7 field. ↵ ends the chain; Esc cancels the open segment and
  then stops the tool.
- The Card stays "Nothing selected" until the chain commits. W-12 is then selected, and the Head
  reads *Undo Draw wall*.

### 14.3 Selection and direct manipulation

```text
 ┌─┐
 │↖│
 │╱│
 │∩│                                                            ┌──────────────────────────────────┐
 │+│                                                            │ W-12                           ⋯ │
 │↔│                                                            │ Wall · free-standing             │
 ├─┤                                                            │ in Long Gallery                  │
 │⋯│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┄┄┄  │ 4.00 m · 0.20 thick · 3.00 high  │
 └─┘  ┃         ┊              ▬▬▬▬▬▬▬▬▬▬▬▬                     │                                  │
      ┃   ‹2.78›┊                                               │ Look  Face                       │
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
- The Card keeps showing accepted values while the drag is live and updates on release. It titles
  the unnamed wall by its reference, and its kind line describes the derived role, *free-standing
  in Long Gallery*, which no control on the Card changes (§6). Dragging an end onto another wall
  until an enclosure closes would make the Wall a boundary, with the room consequence drawn during
  the drag (§10). The Card has no verb row.
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
- The ghost snaps to the 0.25 m increment and to W-12's axis and shows its clearance; R rotates by
  90°. A click
  places and selects the plinth, and the tool stays armed.

### 14.5 A host-dependent action

```text
 ┌─┐
 │↖│
 │╱│
 │∩│» [Door ▾]  1.80 wide · on North wall (selected)            ┌──────────────────────────────────┐
 │+│                                                            │ North wall                     ⋯ │
 │↔│                                                            │ Wall · W-N                       │
 ├─┤                                        ‹Door 1.80›         │ bounds Long Gallery              │
 │⋯│  ◆━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░━┄┄┄  │ 16.26 m · 0.25 thick · 4.00 high │
 └─┘  ┃                        ▬▬▬▬▬▬▬▬▬▬▬▬                     │                                  │
      ┃                                   ├─2.10──┤             │ Look  Face                       │
      ┃                                                         │ Details ›                        │
      ╎           ─────────────────                             └──────────────────────────────────┘
      ╎                         ▪▪▪▪▪▪▪▪
      ╎       Long Gallery
      ┃       R-LONG · ceiling 4.20
      ┃    ▬▬▬▬▬▬▬                                 ▬▬▬▬▬
      ┗━━━━━━━━━━━━━━━━━━━━━━┅┅┅┅┅┅┅┅┅┅┅┅┅━━━━━━━━━━━━━━━━━┄┄┄
```

- The route shown: the North wall is selected, then O is pressed (or the rail's Opening clicked).
  The tool starts on the selected host: the wall wins ties under the pointer, and the strip names
  it. Arming did not change the selection; the placed door will become selected.
- Pressing O with nothing selected arms the same tool for any wall under the pointer. Hovering the
  Rotunda wall at the Gallery door reads *⊘ Overlaps Gallery door*.
- The Card offers no *Add opening*. The wall's scoped list (⋯, the context menu, ⌘K) begins with
  *Opening on this wall (O)*, which arms this same tool.
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
│ Garden window                  ⋯ │
│ Window ▾ · rounded · O-GW        │
│ in Rotunda wall                  │
│ 1.60 wide · 2.50 high · sill 0.90│
│                                  │
│ Look  Face · Unroll wall         │
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

The drafting state, legible without opening anything:

```text
At rest          [Paper ●━━━━ 3D]   1:100 ▾   grid 1 m   snap 0.25   ⋯
Grid off         [Paper ●━━━━ 3D]   1:100 ▾   grid off   snap 0.25   ⋯
During a gesture [Paper ●━━━━ 3D]   1:100 ▾   grid 1 m   snap held off   ⋯   while the modifier is held
In 3D            [Paper ━━━━● 3D]   grid 1 m   snap 0.25   ⋯                  no single scale to name
```

The scale menu, from `1:100 ▾`:

```text
 [Paper ●━━━━ 3D]   1:100 ▴   grid 1 m   snap 0.25   ⋯
                    ┌───────────────────────────────┐
                    │ 1:20   1:50   [1:100]   1:200 │
                    │ Fit all                       │
                    └───────────────────────────────┘
```

The Sheet, from `⋯`:

```text
 [Paper ●━━━━ 3D]   1:100 ▾   grid 1 m   snap 0.25   ⋯
 ┌────────────────────────────────────────────────────────────┐
 │ PAPER: how this reading is drawn · view settings, no Undo  │
 │ Grid      on, toggled by its word or G                     │
 │           ladder 1-2-5 · a major line every 5 minor        │
 │ Snap      on, toggled by its word                          │
 │           step [ 0.25 ] m · ends ✓  faces ✓  alignments ✓  │
 │ Labels    Rooms ✓   Objects ○   Dimensions [Selected ▾]    │
 │ Rulers    ○ off                                            │
 │ Cut       1.20 m above the floor                           │
 │ Datum     Level 0 · floor ±0.00            set in Layout   │
 │ Show      Objects ✓   Ceiling outlines ○   Experience ○    │
 └────────────────────────────────────────────────────────────┘
```

- Scale, grid interval and snap read at a glance, and off states are written as words.
- The scale menu holds the detents and *Fit all*, each a framing request to the one Camera
  authority.
- The Sheet holds configuration only. Grid and snap appear there as read-only state beside the
  rules they follow, because their words are their one writer.
- The datum is displayed, not written: it belongs to Layout.
- Experience marks are off by default in World, which exposes no cross-lens references at rest.

### 14.9 Advanced discovery

```text
╭─ Find ──────────────────────────────────────────────────────────────────────────────── Esc closes ─╮
│ ⌕ Find a tool, action or setting▏                                                                  │
│                                                                                                    │
│ FOR LONG GALLERY   Divide…   ·   Look up   ·   Lift ceiling                                        │
│                                                                                                    │
│ TOOLS      Draw W: wall chain · rectangle · circle · polygon             Opening O: door · window  │
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
│   Draw · Wall          W   a Wall drawn across a room divides it directly                          │
╰────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

```text
╭─ Find ──────────────────────────────────────────────────────────────────────────────── Esc closes ─╮
│ ⌕ harbor▏                                                                                          │
│                                                                                                    │
│ No tool, action or setting matches “harbor”.                                                       │
│                                                                                                    │
│ ⌕ Search the project for “harbor”      1 match      /                                              │
╰────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

The Index's Search after that handoff, with the creator working in the Rotunda:

```text
┌────────────────────────────────┐
│ ⌕ harbor▏                ✕  /  │
│ Browse ▾                       │
│                                │
│ RESULTS FOR “HARBOR”           │
│ Harbor at Dusk                 │
│ Artwork · on North wall        │
│ Long Gallery · Level 0         │
│ Outside the current frame      │
│ [Select]  [Bring into view]    │
└────────────────────────────────┘
```

- With Long Gallery selected, Find opens on what applies to it, then the families. It lists
  capabilities only.
- The query "divide" puts the procedure first and the direct alternative second, because drawing a
  Wall across a room divides it with no procedure at all. Both resolve through the same Wall
  authoring and topology planning; the procedure only adds exact placement and a resolve step.
- The query "harbor" names no capability, so Find ends with one row that hands the query to the
  Index's Search. It shows the count, never the subjects.
- The Index answers with the accepted Search grammar: where the result is, why it may not be
  visible, and Select and Bring into view as separate verbs. Select changes identity without moving
  the camera; Bring into view asks the one Camera authority (World synthesis §4).

### 14.10 A complex procedure

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ⌂ Museum Editor ▾   Saltmarsh Museum           [ World │ Experience ]            ↶ ↷   Saved   ▷ Preview │
├──────────────────┬──────────────────────────────────────────────────────────────┬────────────────────────┤
│ Search   Browse ▾│ [Paper ●━━━━ 3D]   1:100 ▾   grid 1 m   snap 0.25   ⋯        │ Long Gallery         ⋯ │
│                  │                                                              │ Room · R-LONG · Level 0│
│ Saltmarsh Museum │ ┌─┐                                                          │ 101.9 m² · ceiling 4.20│
│ › Long Gallery   │ │↖│                                 ╭━━━━━━━━━━━━━━━━━━╮     │                        │
│                  │ │╱│                                 ┃                  ┇     │ Look  Look up · Lift   │
│ BOUNDS           │ │∩│   ┏━━━━━━━━━━━━━━━━░━━━━━━━━━━━━┫                  ┃     │ Details ›              │
│   North wall     │ │+│   ┃           ▬▬▬▬▬░▲           ┃  Rotunda         ┃     │                        │
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
│ ⊘ Clerestory would be cut by the new wall (0.23 m); an opening cannot straddle it. Clear from 8.98 │
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

- Divide was chosen from Find (§14.9). The Card's ⋯ and the context menu list it in the same
  place, first for a room.
- **Mechanism.** The procedure authors one Wall chain between the North and South walls, exactly
  as Draw would. The new Wall's role, *divides Long Gallery ↔ East Gallery*, is derived from the
  resulting topology, not chosen. Noding splits both walls, and lineage keeps R-LONG on one part
  and births one Room. Nothing edits a Room.
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
 │+│                                                            │ Long Gallery               ⋯ │
 │↔│                                                            │ Room · R-LONG · Level 0      │
 ├─┤                                                            │ 62.4 m² · ceiling 4.20       │
 │⋯│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━┄┄┄  │                              │
 └─┘  ┃                        ▬▬▬▬▬▬▬▬▬▬▬▬ ┃                   │ Look  Look up · Lift ceiling │
      ┃                                     ┃                   │ Details ›                    │
      ┃                                     ┃  East Gallery     └──────────────────────────────┘
      ╎                                     ╎  R-3 · 4.20
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
Paper end     [Paper ●━━━━ 3D]   1:100 ▾   grid 1 m   snap 0.25   ⋯
              vellum; Long Gallery selected (ochre contour)
     ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
     ┃   Long Gallery              ┃
     ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫

Mid-tilt      [Paper ━━●━━ 3D]   52°       grid 1 m   snap 0.25   ⋯
              the thumb travels with the real elevation
        ┏━━━━━━━━━━━━━━━━━━━━━━━━━┓
      ╱   Long Gallery              ╲
     ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

3D end        [Paper ━━━━● 3D]   grid 1 m   snap 0.25   ⋯
              mat; same target, scale, selection, tool and open work
         ┌─────────────────────────┐
       ╱   Long Gallery              ╲
     ╱_________________________________╲
```

- The camera tilts about the current target and keeps its scale. Nothing refits or retargets.
- An open Divide proposal stays open and re-renders as a translucent wall. Its handles remain while
  the floor plane is legible.
- Index, Card, rail and Instrument do not move. Only the material, the legible handles and the
  scale word change: the scale word reads the elevation while tilting and leaves in 3D, because
  perspective has no single scale. Grid and snap hold.

### 14.13 Narrow desktop, sides collapsed

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ⌂  ⌖ Long Gallery ▾        [ World │ Experience ]        ◈ North wall ▾   ↶ ↷  ▷ │
├──────────────────────────────────────────────────────────────────────────────────┤
│ [Paper ●━━━━ 3D]  1:100 ▾  grid 1 m  snap 0.25  ⋯  ║ North wall                ⋯ │
│                                                    ║ Wall · W-N · bounds Long    │
│ ┌─┐                                                ║ Gallery                     │
│ │↖│                                 ╭━━━━━━━━━━━━━━║ 16.26 m long · 0.25 thick   │
│ │╱│                                 ┃              ║ 4.00 high                   │
│ │∩│   ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫              ║                             │
│ │+│   ┃           ▬▬▬▬▬▬            ┃  Rotunda     ║ Look  Face                  │
│ │↔│   ╎   Long Gallery              ╎  R-ROT       ║ Details ›                   │
│ ├─┤   ╎   R-LONG · ceiling 4.20     ╎  ceiling 6.00║                             │
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
  `/` would open the Index sheet with Search focused.
- The sheet overlays the Stage, so the drawing does not move. Closing it changes nothing either.
- The rail, the reading cluster with its drafting state and the scale bar are identical to the
  wide frame.

### 14.14 Capability growth without rail growth

Asterisks mark hypothetical capabilities. No schema for them is ratified or proposed.

```text
 ┌─┐
 │↖│
 │╱│» Makes [Wall ▾]  [╱] □ ○ △ ∿   0.25 · 4.20 h
 │∩│        ┌──────────────────────────────────┐
 │+│        │ Wall                role derived │
 │↔│        │ Space edge*     builds no wall   │
 ├─┤        │ Railing*                         │
 │⋯│        │ Glazed screen*                   │
 └─┘        └──────────────────────────────────┘
```

Makes appears on the strip only once a second authored primitive is registered; until then the
strip reads *Wall* as a label (§5). A Makes entry is a different authored primitive, never a role:
a Wall's role stays derived from topology whichever primitives exist.

```text
╭─ Find ──────────────────────────────────────────────────────────────────────────────── Esc closes ─╮
│ ⌕ Find a tool, action or setting▏                                                                  │
│                                                                                                    │
│ FOR GALLERY 2 (Space*)   Divide… · Merge with… · Add to zone*…                                     │
│                                                                                                    │
│ BUILD      Wall · Space edge* · Railing* · Glazed screen* · Freeform*                              │
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

- The rail is still the same six slots. Growth lands in Makes, Kind, the Place catalogue, kind-word
  choices, scoped lists, Look readings, Sheet "Show" entries and Find families. The drafting state
  stays three words.
- The Index breadcrumb grows a level (for example `Saltmarsh Museum › Level 1`) without new chrome,
  and the Index's Search and Browse span every level.

## 15. Stress tests

None of these is a commitment, and none is given a schema here.

| Pressure | Where it lands | Shell change |
| --- | --- | --- |
| Spaces without walls; regions | Draw, Makes = Space edge; the Card and Index show a Space like a Room | none, once a Space model is ratified |
| A Wall whose intended role differs from its topology (a closed ring of screens that should not become a room) | an open Layout decision (§19). The Card keeps describing the derived role and the Stage shows the consequence; no role chooser returns without a Layout ruling | none |
| Many Walls drawn in one session, some closing rooms and some not | each gesture previews its own derived role and room consequence; Undo steps one gesture at a time | none |
| Richer curved and freeform boundaries | Draw shapes (arc, freeform); knot and tangent handles | none |
| More openings and hosts | Opening kinds (passage, niche, skylight, floor opening). Each Kind names its host class, so a skylight seeks only ceilings and a floor opening only slabs; ceiling outlines, Look up and wall Paper make them legible | none |
| Several levels; elevation work | the Index breadcrumb carries the level; the Sheet shows the level below and the cut; Look adds Section and Elevation; vertical measures gain handles on a wall laid flat | none |
| Constraints | Measure, or a dimension's scoped list, offers Lock; Details lists constraints; conflicts become Repair procedures | none |
| References and underlays | Place, Reference; the Sheet sets visibility and opacity; calibration is a procedure | none |
| Annotations | Measure gains *Keep* when an annotation domain exists; the Sheet shows annotations | none |
| Inspection and analysis | the Sheet's "Show" holds passive overlays; Find's Check runs active analyses whose issue lists live in the Instrument | none |
| Reusable definitions, groups | the Card's kind line names the definition; Owner · Source · Reach appear at the writer | none |
| Arrays, distribution | the subject's scoped list; parameters in a procedure | none |
| A large project: hundreds of rooms, thousands of objects | the Index's Search and Browse, with reasons and the *Selected elsewhere* recovery row. Find does not grow with the project, because it holds capabilities, not subjects | none |

## 16. One owner per fact

| Fact | Its single writer | May display it |
| --- | --- | --- |
| Selected identity | the existing selection facade, fed by Stage, Index rows, the *Select* verb on Index Search and Browse results, and Details references | Card, Index, Stage contour, Head chip at narrow widths |
| Index Search query and Browse context | the Index; never selection | the *Selected elsewhere* recovery row |
| Armed tool | rail; keys and Find invoke the same owner | the option strip, the cursor |
| A preferred host | the armed host-seeking tool, from the selection; task focus, not selection | the option strip |
| A tool's defaults for its next stroke | that tool's option strip | none |
| Reading (Paper, 3D, tilt) | reading switch; 1, 2 and ⌥-drag reach the same owner | Stage material |
| Scale (Paper framing) | the one Camera authority; the scale menu, wheel and pinch are requests to it | the scale word, scale bar |
| Grid on or off; snap on or off | their words in the reading cluster; G reaches grid's | the Sheet (read-only), Stage, snap marks |
| Grid ladder, snap increment and targets, labels, rulers, cut, what to show | Sheet | Stage, the grid and snap words |
| Datum | Layout | Sheet, datum key |
| A subject's name | Card | Index, Stage labels, Instrument header |
| A subject's settled measures | Instrument Dimensions | Card facts, Stage tags, Details |
| A live gesture's parameter | the gesture (handle plus S7 entry) | the Dimensions field, as "being set on Paper" |
| Derived facts (area, perimeter, ceiling, arc length, Located here, Bounds) | none: derived | Card, Details, Stage labels |
| Wall spatial role (bounds, divides, free-standing) | none: derived from the Wall's geometry and the resulting topology; it changes only through geometry edits | Card kind line, Index relations, Stage consequence marks and drawing weight |
| Opening kind (door or window) | the kind procedure, opened from the Card's kind word; reference and name stay | Card kind line |
| Opening profile | Instrument Dimensions | Card kind line |
| A procedure's parameters | that procedure in the Instrument | the Stage preview |
| Lens | Head | none |
| Side panels hidden | the app menu entry; ⌘\ reaches the same owner | the layout |
| Reduce motion, Motion speed, keymap | Settings | none |

## 17. Review against the brief

| Review question | Answer | Where |
| --- | --- | --- |
| Does Paper stay visually dominant? | Yes. About 63 % of the wide frame; four small furniture objects at rest; no Instrument and no status rail | §3, §14.1 |
| Can a first-time creator find the basic tools? | Six rail slots with name-and-key tooltips; the empty Card teaches W and ⌘K; the Index's Search shows `/`; a selected subject's ⋯ lists what applies to it; More opens a browsable Find | §5, §6, §14.1 |
| Can an experienced creator work with minimal disclosure? | Keys for every family, typing at the gesture, ↵ for Dimensions, ⌘↵ to apply, keys shown in Find | §7, §12 |
| Is the permanent scope defensible five years out? | Each family is a distinct pointer grammar rather than a feature, and Opening's slot is argued on grammar with a stated condition for losing it; growth arrives as variants; a new slot needs a new grammar and an owner ruling | §4.2, §5, §21.1 |
| Could capability double or triple without the rail growing? | Yes; every stress test lands in an existing tier | §15, §14.14 |
| Is shell space used intelligently? | The Card carries stable facts and doors instead of emptiness, and the Index carries relations and every subject search; neither carries task state, and each region answers one question | §3, §6, §11 |
| Are stable measurements separate from procedure state? | The Card shows accepted facts, tags display, and the Instrument holds proposals and writers | §6, §7, §14.10 |
| Does direct manipulation replace toolbar commands? | Move, resize, reshape, bend, rotate and slide are all handles; no such command exists | §10 |
| Are Paper settings distinct from authoring tools? | Scale, grid and snap read as three words beside the reading switch, and the Sheet holds their configuration; the rail holds only tools | §8, §14.8 |
| Does every writable fact have exactly one owner? | Yes; a live gesture turns its field into a display | §16 |
| Are shell and domain boundaries preserved? | All seven exclusions hold, and domain work is isolated as pure plans and queries | §2, §19 |
| Does a narrow window keep the Stage and navigation without refitting? | The sides become overlaying sheets, and resizing changes only the visible bounds | §13, §14.13 |

Residual risks:

- An icon-only rail relies on tooltips, the empty-state hint and More for discovery. A labelled rail
  on first run is a cheap fallback.
- Scoped-list order has to be authored for each subject kind, and it stays fixed.
- Kind-word doors are quieter than a verb row. The ▾ and hover carry them, and the scoped list
  repeats each change, so it is never the only route.
- Two discovery homes rely on the handoff rows to prevent dead ends.
- The "Elsewhere" row depends on read-only Camera and Experience queries existing.

## 18. Peer evidence

| Peer idea | Verdict | Why |
| --- | --- | --- |
| A short resting verb bar (Draw, Place, Measure) plus a searchable action index | **Kept in essence** | Select and Opening are added. The index becomes Find *inside* the World Instrument, so discovery and the procedure it starts share one task owner |
| A permanent button for every primitive | Rejected | It grows with the vocabulary |
| One "Add" menu for all creation | Partly kept | Too slow for drawing; right for choosing a Place item |
| Floating contextual toolbars beside the selection | Rejected | They cover the drawing; a subject's verbs live in its scoped list (the Card's ⋯, the context menu) |
| Direct manipulation with Shift to constrain, a modifier to bypass snapping, double-click for precision | Kept | ⌥ held suspends snap and Shift constrains angle (settled in the adoption plan's keymap); double-click maps to Dimensions |
| Collapsible sidebars; the Index as a thin rail at narrow widths | Partly kept | Sheets invoked from Head controls instead, because a permanent thin rail costs Stage width |
| Measurements on the Card | Kept read-only | Editable Card fields would give one fact two writers |
| Paper toggles in a footer or status bar | Partly kept | Scale, grid and snap stay legible and toggle in place, as three words beside the reading switch; everything else is in the Sheet, and no full-width strip returns (§21.3) |
| One Find leading into a work Instrument | Kept, for capabilities | It is the core of §11; subjects are found in the Index (§21.4) |
| Consequence previews | Kept, when earned | Local edits preview on Stage only |
| "Collapse" as a third exit that keeps a task's settings | Rejected | Apply and Cancel only; parking happens only on a lens crossing (PLATE §0.8.2) |
| Saving clearance envelopes as accepted drawing references | Rejected for now | It invents an authored type; Measure stays temporary until an annotation domain exists |
| Splitting a room as a Room edit | Rejected | Rooms are derived; dividing is a Wall drawn across the room (§9) |
| A History panel, a Keys button | Rejected | An Undo label, `?` and keys in Find instead (§12) |
| A gallery corner as the datum | Rejected | The datum is Layout's floor datum; Paper only displays it |
| F frames the whole World | Deferred | It conflicts with the prototype's F for Face; *Fit all* is explicit in the scale menu and in Find |
| Vocabulary families such as Create, Shape, Arrange, Inspect, Reference | Kept | As Find families and the registration contract's `family` |

## 19. Domain work, shell work and prototype changes

This is the separation an implementation plan has to respect. It is not that plan.

**Shell work (editor, World lens).**

- The rail with five families and More; option strips; host-first arming (a selected host wins
  ties); host-seeking pointer feedback; legibility-gated tool input; Draw's derived-role preview at
  the gesture.
- The reading cluster: a switch over the one camera; the drafting state (the scale menu, and the
  grid and snap words); the Sheet (a view-settings store).
- The Card: key-facts line with fact doors, kind-word doors, condition line, Look and Details, the
  ⋯ scoped list, rename, the empty and set states.
- The Index's Search and Browse as the one home for finding subjects, with the accepted verbs,
  reasons and *Selected elsewhere* row, plus the handoff row to Find.
- The World Instrument: Find (capabilities, with the handoff row to Search), Dimensions, the
  procedure frame (steps, parameters, validation, consequences, Apply/Cancel), Look sessions, and
  parking and Resume as in PLATE §0.8.2.
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
- **Derived Wall role (a Layout cutover).** Enclosure derives from Wall geometry and topology
  instead of the authored `role: 'boundary' | 'partition'` field, which today decides face
  extraction (`LayoutWallRole`), and creator-chosen chain roles (`wallChainRoleForTool`, the
  role-change planner) retire as creator-facing operations. Layout owns two open decisions:
  migrating existing `partition` Walls, and whether a closed ring may ever be intentionally
  non-enclosing. Division keeps the landed P23.8 Room reconciliation (split survivor by evidence
  order, one Room born).
- Divide as a composition over `planWallChain` with endpoints on two walls that bound one Room,
  plus validators for an opening straddling a new junction and for Scene attachments the new wall
  would cover.
- Fact schemas for each subject kind (writable or derived, units, ranges, validators), shared by
  the Card's display and Dimensions, and factored from what the Inspector does today.
- Kind changes as Layout plans with consequences: the door ↔ window flip (which the wall-first
  types already define as keeping reference and name) and structure type. A Wall's role is not a
  kind change.
- Read-only reference counts from Camera and Experience for the "Elsewhere" row, owned by those
  authorities.
- The flip as viewing intents on the one Camera authority (tilt about the target, keep scale, the
  detent), through T1's shared continuous viewport and projection seam.

**Prototype changes needed before this is executable there.**

1. Replace the Plan and 3D buttons and the bead with one switch, and drop `planCam()`'s fixed
   framing and the last-3D-pose restore.
2. Move *Search anything* from the Head into the Index's Search (`/`), keeping its verbs and
   reasons, and add Find (⌘K) for capabilities in the Instrument.
3. Remove the Overview and Keys Stage tools and the status rail; add the drafting state, the Sheet
   and Settings.
4. Card: add the key-facts line, kind-word doors and the ⋯ scoped list; the *In place: Measure*
   door becomes Dimensions, reached through the facts.
5. Add the drawing families (Draw, Opening, Place, Measure). The prototype explicitly does not draw
   new walls or openings, and its rooms are declared records, so rooms must first derive from the
   walls for the Wall-role ruling to be executable.
6. Rebind `o`, `m` and `p` as in §12, and move ⌘K from search to Find.

The [Paper adoption plan](../../docs/roadmap/p26-spatial-depth/design/paper-authoring-prototype/implementation-plan.md)
turns this list into ordered slices.

**Prototype-only assumptions not to carry forward.** The fixed Plan framing, the last-pose restore,
snapshot Undo, the prototype's ceiling vocabulary (holes and soffits, where production derives Room
ceilings from boundary walls), the single-level fixture, and the rendering shortcuts named in the
prototype's acceptance limits.

## 20. Owner rulings

The owner accepted every call on 2026-10-03, each with its recommended option, and corrected
call 9's Wall semantics. The rulings are promoted into PLATE §0.8.4; none awaits review.

1. **Key-facts line on the resting Card: accepted.** It refines #112's protection of ordinary
   disclosure: one read-only title-block line; the catalogue stays in Details.
2. **No verb row on the Card: accepted.** The first draft's Do row is withdrawn. The Card keeps
   PLATE's Look and Details; changing what a subject is starts from its kind word, a condition's fix
   from the condition line, and everything else sits in the ⋯ scoped list, whose order is fixed.
3. **Six rail slots, with Opening kept on grammar: accepted.** Opening is the only family that cuts
   an embedded opening into an existing host's coordinates. It loses the slot only if openings
   become catalogue items or host-seeking becomes a shared modifier.
4. **Index Search and Browse for subjects; Find for capabilities: accepted.** The Head search goes,
   `/` keeps searching subjects as in the prototype, and ⌘K moves to Find.
5. **Retire the World status rail; keep Scale · Grid · Snap legible: accepted**, as three words
   beside the reading switch, with a fourth word only by owner ruling.
6. **Flip semantics: accepted.** Tilt about the current target, keep scale, return to the last
   working elevation, through the one Camera authority.
7. **Commit grammar: accepted.** Dimensions fields commit on ↵, procedures on Apply (⌘↵), and Undo
   is unavailable while a proposal or gesture is live.
8. **Compound options wait for composed plans: accepted.** The passage and naming the born room
   appear only once an atomic composed plan exists, never as several undo steps.
9. **Wall semantics: accepted as corrected.** The Wall is the authored primitive. Draw never asks
   for boundary, division or free-standing semantics; the spatial role is derived from the resulting
   geometry, topology and context, and is described rather than chosen (§9). *Free-standing*,
   *bounds* and *divides* are derived descriptions. Rooms stay derived and are never edited.
   *Divide…* remains a findable intent and procedure whose mechanism is Wall authoring plus
   topology and consequence planning. The landed authored role and creator-chosen chain role remain
   current Layout encoding until an explicit Layout cutover (§19).
10. **One canonical selection value that may be a set: accepted**, where the subject kinds support
    sets; the Card shows the set as one identity.
11. **One Grid fact across Paper surfaces: accepted**, plan Paper and walls laid flat alike.
12. **Keymap: settled during planning** in the adoption plan's §Keymap, against the prototype's
    bindings and production's numeric entry. `/` stays subject Search and ⌘K becomes Find; ⌥ held
    suspends snap; snap has no letter key.

**Changed by the rulings (2026-10-03).** The Wall ruling: §1 decision 8; §4.4; §5; §6 (anatomy,
key facts, the role rule, the per-kind table); §9; §10; §14.2, §14.3, §14.5, §14.9, §14.10,
§14.13 and §14.14; §15; §16; §18; §19; §21.2. Opening's grammar as an embedded cut that may affect
connectivity: §5 and §21.1. Index result verbs acting on their own row: §11 and §21.4. Keys: §12.

## 21. Refinement reviews

Four peer reviews pressed the first draft on 2026-10-03 without prescribing answers. Each
subsection gives the question, the verdict, the comparison behind it and what changed. None of them
reopens the shell.

### 21.1 Opening: a permanent family or a contextual capability

**Question.** Is Opening a durable pointer grammar, or a capability of a selected host that More can
still find?

**Verdict: keep the permanent family, justify it by grammar, and add host-first arming.** Model A
keeps Opening as a permanent host-seeking family (a rail slot and O). Model B shows it only when an
eligible host is selected, and More still finds it.

| Criterion | A: permanent and host-seeking | B: contextual on a selected host | Better |
| --- | --- | --- | --- |
| First-use clarity | The rail shows that openings exist. Armed with nothing selected, the pointer finds eligible hosts and refuses anything else in words | Nothing at rest says openings exist; the creator must first think of selecting a wall, then find the verb | A |
| Repeated architectural work | O stays armed: six doors on six walls take six clicks, one undo step each | Select, invoke and place for every host. Keeping the tool armed across hosts would turn B into A with a hidden entry | A |
| Host discovery | The pointer finds the host, and a selected host wins ties (§5) | The selection names the host without ambiguity | A, once host first is part of it: B's one strength becomes A's tie-break |
| Future hosts: ceilings, slabs | One family. Each Kind names its host class, so a skylight seeks only ceilings, wherever ceilings are legible; a new host class is a new Kind | Every host kind grows its own creation verb, repeated on walls, ceilings and slabs | A |
| Narrow width | The rail and O are unchanged, and nothing needs the Card sheet | The Card is a Head chip, so the verb costs the chip, the sheet and the verb, or a context menu the creator has to know about | A |
| Long-term rail stability | Six slots. Opening is the one domain-specific family, and only the grammar test stops it becoming a precedent for stairs, railings or lights | Five slots and no precedent to contain | B, narrowly |

**Grammar, not frequency.** Opening is the only family whose pointer targets an existing subject
and whose gesture produces a new subject inside it: an embedded cut in the host's own coordinates,
which may affect connectivity. A door through a wall that bounds two rooms joins them
(`connectsRoomIds`); a niche or a future skylight need not join anything, so joining spaces is a
possible consequence, not the definition. Select targets existing subjects but produces
nothing new. Draw and Place produce new subjects, but they target a plane or a point, and Place
leaves its host unchanged. That pairing needs its own pointer behaviour: eligible hosts answer the
pointer, the pointer projects onto the host's axis, ineligible hosts refuse in words, and the tool
stays armed from host to host. That is a mode, and modes live on the rail. A contextual verb that
kept this behaviour would be the same mode with its entry hidden behind a selection.

**Peer evidence for B.** One peer proposal's resting bar had no Opening (Draw, Place, Measure; §18).
It is the strongest evidence for B, and it is answered on repeated work and host discovery, not on
how common doors are.

**When Opening loses the slot.** If openings become catalogue items dropped onto hosts at fixed
sizes, they are a Place variant. If host-seeking becomes a modifier that every family shares, the
grammar is no longer Opening's own.

**The Card's Do.** The first draft offered *Add opening* on the rail and again in the Card's Do row:
two creation entries for one tool, and redundant, as the review suspected. Host-first arming leaves
the Card entry nothing to do: select the wall, then press O or click the slot. The wall's scoped list
keeps *Opening on this wall (O)* for creators who look there; it arms the same tool and holds no
state. The Do row itself is withdrawn (§21.2).

**Changed:** §1 decision 1; §4.1 and §4.2 (Permanent is defined by grammar, and frequency never
qualifies); §5 (the grammar table, *Why Opening keeps its slot*, *Host first*, arming rules); §9;
§14.5; §15; §17; §20 call 3.

### 21.2 The Card's Do row

**Question.** What action is so subject-specific that seeing it beside the subject improves
comprehension, instead of duplicating the rail or More?

**Verdict: two kinds of action pass, and neither needs a row. The Do row is withdrawn.** Every entry
the first draft put in Do, classified:

| First-draft Do entry | Subject | What it really was | Where it lives now |
| --- | --- | --- | --- |
| Add opening | wall, in any derived role | the rail's Opening, a second time | O, starting on the selected host (§21.1); *Opening on this wall (O)* in the scoped list |
| Free-standing… | wall that bounds rooms | a role choice that geometry decides | nowhere as a command: the role is derived and described on the kind line; moving an end or a Wall changes it, with the consequence on Stage (§9, §20 call 9) |
| Centre on wall | window | an arrangement, like sliding the opening along its host | the opening's scoped list, first entry; its position is also a Dimensions field |
| Divide… | room | a procedure that authors a Wall across the room | the room's scoped list, first entry, and Find; drawing the Wall directly does the same |
| Align, Distribute | several things | measures of the set | the set's Dimensions, beside its extent and spacing, and its scoped list |

**The answer.** Two kinds of action improve comprehension beside the subject, because each is a
statement about the subject rather than something to do with it:

1. **Changing what the subject is**: door ↔ window, column ↔ plinth. (A Wall's role is not a kind:
   it is derived from topology, §20 call 9.) The
   kind is a fact on the Card, and what it can become is part of understanding it, so the door sits
   on the kind word itself.
2. **Resolving a condition that is true of the subject now**: Repair, Resume, Bring into view. The
   fix sits on the condition line, which exists only while the condition holds.

Everything else duplicated a tool, a handle, a measure, or a procedure that the context menu and
Find already reach.

**Relations as the entry.** The review's alternative, *Openings · 3* as the door, holds where the
relation exists: Details lists the openings with PLATE's Expand, Focus, Select and Open task, and
the Index shows them. It cannot be the entry for creating one, because PLATE shows only non-empty
relation groups. A wall without openings has no row to start from, and a permanent
*Openings · 0 · add* would be a verb row in disguise. Creation stays on the rail.

**The rule that replaces Do.** The Card acts only through a door on the fact a change alters or on
the condition it resolves, and it arms nothing. Every other subject action sits in the subject's
scoped list, opened by the Card's ⋯, the context menu or ⌘K, in one fixed order per subject kind.
Use, recency and frequency never reorder it, and it renders as a list, never as buttons. With no
row there is no slot count to fill and nothing to re-rank. The §6 table applies the rule to seven
subject kinds, and four of them (wall, room, junction, set) have no kind change at all.

**Cost.** A kind word with ▾ is quieter than a button. Its hover state, and the scoped list repeating
each change, keep it from being the only route (§17).

**Changed:** §1 decision 3; §3; §4.1 to §4.4 (the Contextual tier, admission step 4, the *kind
change* form, *order and key*); §6 (anatomy, rules and the per-kind table); §9; §10; §14.3, §14.5,
§14.7, §14.10, §14.11 and §14.13; §16; §17; §18; §20 call 2.

### 21.3 Drafting state and configuration

**Question.** Can the creator understand the important drafting condition without opening anything,
while Paper still feels visually quiet?

**Verdict: yes, with three words beside the reading switch.** The first draft's single chip failed
the first half of that test.

| Criterion | One chip, `1:100 ▾` (first draft) | Three words, `1:100 ▾   grid 1 m   snap 0.25   ⋯` |
| --- | --- | --- |
| Current scale | legible | legible |
| Grid interval | inside a closed menu | legible, following the grid ladder as the scale changes |
| Snap state and step | inside a closed menu, so learnt by surprise when a point jumps or fails to | legible; `snap held off` while the suspending modifier is held |
| Toggling grid or snap | open the chip, find the row, toggle, close; or G | one click on the word; or G |
| Visual cost at rest | one word | about 27 more characters of quiet text in the same cluster, and no new object |
| Ownership | the Sheet writes everything | the words write on or off; the Sheet writes configuration and shows on or off read-only (§8.1) |
| Drift towards a status rail | none | held by the admission rule: a word must change how a distance reads or where the next point lands; a fourth word needs an owner ruling; never messages, hints, history or tool state |
| Narrow width | fits | fits beside the Card sheet (§14.13), with no collapse rule |

**Where the words sit.** They sit beside the switch, not along the bottom edge by the scale bar,
because the Instrument docks at the bottom and would cover them during exactly the work that
snapping governs. The reading cluster is never covered (§11). The scale word requests framing from
the one Camera authority, so the cluster writes no camera state of its own.

**What stays configuration.** The grid ladder, the snap increment and targets, labels and dimension
display, rulers, cut height, the datum (displayed, set in Layout) and what to show. Later
references and overlays join the Sheet, not the cluster.

**Changed:** §1 (table and decision 5); §2; §3; §4.1 and §4.4; §8.1 (retitled; rules and a
placement table) and §8.2; §10; §11; §12; §13; §14.1, §14.2, §14.4, §14.8, §14.12 and §14.13; §16;
§17; §18; §20 call 5.

### 21.4 Find and the Index's Search

**Question.** Is More the capability vocabulary of Paper, or the universal search box for the
entire project?

**Pick: the capability vocabulary.** Find (More, ⌘K) finds tools, variants, actions, procedures,
readings, checks, keys and settings. The Index's Search and Browse (`/`) find identities, places,
levels, rooms, objects, relations and project structure. Neither renders the other's results.

Universal Find was rejected for five reasons:

1. **It regressed accepted authority.** The first draft's *Go to* merged Select and Bring into view.
   The World synthesis (§4) requires Select, Open location, Bring into view and Reveal to stay
   separate on every subject result, each with its reason. The accepted dense search board renders
   exactly that inside the Index, with its *Selected elsewhere* recovery row.
2. **Two row grammars in one list.** A capability row arms a tool, becomes a procedure or opens a
   setting's owner; a subject row offers four verbs. In one list, ↵ would mean different things on
   adjacent rows.
3. **Persistence.** Subject results are orientation, and they stay in the Index while the creator
   works through them. Find is transient: it becomes the procedure or closes as a tool arms, so a
   subject list there would vanish on first use or occupy the task surface.
4. **Scale.** Subjects grow with the project; capabilities grow with the product. In a large museum,
   "door" would bury the Door tool under forty doors.
5. **Selection is the only scope.** Find's "For North wall" group takes its scope from the
   selection. If Find could select, choosing a result would change its own scope mid-query.

**The cost, and how the two homes cooperate.** A creator meets two entrances and has to learn which
is which. So each home ends with one handoff row that carries the query and a count, never the
results: Find ends with *Search the project for "harbor" · 1 match · /*, and the Index's Search
with *"door" is also a tool · ⌘K*. An Index result's verbs act directly on that result: Bring into
view, Open location and Reveal need no prior selection, and Select is its own verb. Capabilities
still take their scope from the selection, so authoring a found subject follows Select.

**Keys.** `/` keeps the prototype's subject search, now in the Index. ⌘K moves from that search to
Find, and `?` opens Find on Keys.

**Changed:** §1 (thesis, table and decision 9); §2; §3; §4.1 and §4.4; §11 (*Find is Paper's
capability vocabulary*, *Two homes for discovery*); §12; §13; §14.1 and §14.9; §15; §16; §18; §19;
§20 call 4.

Across the four reviews, the rail keeps six slots on a stated grammar, the resting Card loses its
verb row and gains kind-word doors, the reading cluster gains three words, and Find gives up
subjects. The permanent rail, direct manipulation, Card key facts, the precision ladder, the one
World Instrument, the Paper ⟷ 3D model and consequence disclosure stand as they were.
