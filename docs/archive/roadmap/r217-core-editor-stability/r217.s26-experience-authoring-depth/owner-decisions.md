# R217.S26 — owner decisions

The owner's directions (OD1–OD6) and rulings (R1–R6) are recorded as given. Each decision E1–E17
carries its recommendation, and the owner approved the plan with them on 2026-11-03.

## Owner directions (2026-11-03, planning conversation for PR #262)

| # | Direction |
| --- | --- |
| OD1 | **R217 becomes a stable product milestone**, not only a shell recovery: Experience authoring depth is part of it, and S11 certifies it |
| OD2 | **Every Conservatory capability is harvested in this plan.** After it, no prototype is harvested again |
| OD3 | **Several guided Views in a Stop are included** (reverses this plan's earlier deferral) |
| OD4 | **Five slices**, R217.S26–S30 |
| OD5 | **Testing split for S26–S30.** The writer owns the test code and checks correctness and visual tokens; there are no browser journey runs or lengthy captures by the writer. The owner runs the acceptance journeys manually |
| OD6 | **Reconciliation, lock and promotion come after the final slice**, once everything is accepted, when the owner triggers them; this plan does not prepare them |

## Owner rulings (2026-11-03, final planning follow-up for PR #262)

| # | Ruling |
| --- | --- |
| R1 | **The five-slice structure is approved.** Exception for these slices: no separate doc approval |
| R2 | **S11 stays lightweight:** no additional acceptance rounds beyond the owner's own |
| R3 | **Manual journeys:** the owner handles end-to-end acceptance; acceptance is given in the PR, with no separate record |
| R4 | **S27 timing:** timed Views advance automatically; an untimed final View waits for Next. Reordering re-resolves transitions without inventing Camera paths ([E3](#e3)) |
| R5 | **E9 and E15 are approved as proposed**, including subject framing and Conservatory's visitor workflow |
| R6 | **S27 format and gate:** a clean version break, strict refusal and no migration. The Experience unit format goes from 2 to 3 and `ExecutionProgram@2` to `@3`, and R217.S27 provides **`T3.camera-experience-cutover@2`**. S27's PR adds the `@2` gate-register row; the accepted `@1` row is unchanged ([E2](#e2)) |

<a id="r7"></a>
## Owner follow-up ruling (2026-11-03, S29 Camera connectivity)

| # | Ruling |
| --- | --- |
| R7 | **Independent Travel pairs are approved.** One Camera graph may carry A–B and C–D as separate connected components. A Guide may Travel A → B, Cut B → C, then Travel C → D; a Cut adds no Camera edge. Camera-unit admission and runtime share one explicit connectivity policy, while a direct Scene document keeps its single-component default. No migration, authored setting, second validator or bridge edge is introduced. |

## Decisions

| # | Decision | Recommendation |
| --- | --- | --- |
| [E1](#e1) | Where S26–S30 run relative to S11 | Before S11, which certifies the milestone (OD1) |
| [E2](#e2) | New planners, the format change and derived reads | Approve the ledger as one set |
| [E3](#e3) | Guided Views in a Stop: model and moves | A View sequence with holds; moves inside a Stop use the Cut/Travel rule |
| [E4](#e4) | Removal rules | No silent replacement; named consequences; Camera truth removed only when unshared |
| [E5](#e5) | The door for additional Guides | Add to Guide ▸ New Guide…; Guide Card owns rename and Opening Guide |
| [E6](#e6) | A Guide's start | Show it; change it from the Stop's `•••` |
| [E7](#e7) | Lens and Eye height | The three-step presets over exact values |
| [E8](#e8) | Height for Place a View | Camera defaults, no working-height control |
| [E9](#e9) | Present this framing | Bring the subject into view visibly, then capture it |
| [E10](#e10) | Snapshot rendering | The Stage's own renderer, offscreen, at the capture-frame aspect |
| [E11](#e11) | How a Travel gets Camera support | A deliberate *Add a Camera path* |
| [E12](#e12) | *Crosses a wall* warning | Include, through a Layout-owned read |
| [E13](#e13) | Hold-less Stops in the timeline | A *waits* segment, outside the total |
| [E14](#e14) | Where Show ▾ lives | Beside the Stage reading control, Experience only |
| [E15](#e15) | Visitor reach and Preview modes | Harvest Conservatory's: free-exploration switch, welcome chooser, end into free exploration, back to the tour |
| [E16](#e16) | Review and test route | Writer: tests, correctness, tokens; independent review for domain parts; owner: manual journeys |
| [E17](#e17) | *Back* in the Card | A back link in the Round 2 kind line, plus Alt+← |

<a id="e1"></a>
## E1 — Sequencing against S11

**Recommendation: register S26–S30 in R217 and run them before S11**, which then needs them merged and
gains Experience journeys ([execution plan §6](execution-plan.md#6-r217-s11-and-milestone-sequencing)).
OD1 settles the earlier alternative (run S11 first and move Experience to a T3 phase): S11 now
certifies the stable product, Experience included. The milestone's *Camera/Experience authoring* row
and R217's non-goal *Experience Guide and Path redesign* need amending at registration.

<a id="e2"></a>
## E2 — New planners, the format change and derived reads

**Recommendation: approve the [ledger](capability-inventory.md#12-operations-that-are-missing) as
one set.** It holds:

- the Experience planners: `experience-update`, `experience-guide-update`, multi-Guide
  `experience-guide-create`, the `viewIds` permutation, the four removals, and the Stop-sequence and
  reach fields;
- the Camera planners: `camera-connection-create` and `camera-connection-update`;
- the derived reads: the Guide time map and the route-versus-Wall read;
- **one format change, in S27:** the Experience unit's Stop View sequence, the Presentation's
  free-exploration flag and the Experience's welcome text, with the `ExecutionProgram`, lowering and
  interpreter changes they need.

The format change is a clean version break (R6): Experience unit format 2 → 3, `ExecutionProgram@2` →
`@3`, and the new gate version `T3.camera-experience-cutover@2`, provided by R217.S27. Strict readers
refuse the old format, fixtures are regenerated, and nothing is migrated. Approving the set clears
campaign checkpoint 3 for exactly these items; anything else still stops there.

The Camera planners write Camera-owned facts. `camera-core` still resolves routes and evaluates
motion, and the time map is a `camera-core` read beside `experience-controllers.ts`, not a second clock.

<a id="e3"></a>
## E3 — Guided Views in a Stop

**Recommendation.** A Stop carries an ordered, non-empty list of guided Views from its Presentation,
each with an optional hold. The first is the entry, which replaces the single `entryViewId`. Its
`holdSeconds` becomes the per-View hold. The Stop's continuation is unchanged.

- **New Stops:** one View, the Presentation's Default (Conservatory), with no hold set.
- **Include:** appends a View with a 3 s hold. Leaving out the last View is refused (*A Stop shows at
  least one View*). Reordering is Stop-local. None of these changes the Presentation's Default
  (Conservatory, PLATE).
- **Timing (R4):** timed Views advance automatically. An intermediate View always has a hold (3 s when
  none is set), because a visitor never waits inside a Stop. Only the final View may be untimed; it
  waits for Next ([E13](#e13)).
- **Reordering** re-resolves the step and continuation transitions against the new first and last
  Views. A Travel without a connection becomes a named gap; no Camera path is invented.
- **Moves inside a Stop** use the same rule as between Stops: Cut by default, Travel when a Camera
  connection joins the two Views, with the gap named otherwise. Conservatory's fixed 1.6 s glide is a
  shortcut and is not promoted. The step's Cut/Travel choice is stored per guided View, beside its
  hold.
- **Visitor:** guided playback advances the Views by their holds and waits for *Next stop* between
  Stops (Conservatory).

<a id="e4"></a>
## E4 — Removal rules

**Recommendation:** every removal is one operation, one Undo entry and one consequence summary shown
before it runs. Nothing is replaced silently.

| Removing | Rule |
| --- | --- |
| A Stop | Removed from `stops` and from every Guide that orders it. A continuation targeting it falls back to the Guide order, named. A Guide's start moves to the Stop that followed it (or preceded it, if it was last), named. **The only Stop of a Guide:** refused, *A Guide keeps at least one Stop — remove the Guide instead*. A Detour that uses it: refused with that reason |
| A View from a Presentation | **The last View:** refused, *remove the Presentation instead*. **The Default:** the summary asks for the new Default; no automatic choice. Stops that guide through it lose it from their sequences, and a Stop left with no View enters at the Default, named. The Camera View and its connections are deleted only when no other Presentation lists it; otherwise *Still used by ⟨Presentation⟩* |
| A Presentation | Its Stops (Stop rules apply, so a Guide left empty refuses), its Gates, and its unshared Camera Views with their connections. Summary: *and its 2 Stops*, *and 1 Camera path* |
| A Guide | Its Stops that no other Guide orders. If it is the Opening Guide, the next Guide becomes it, named; with none left, `entryGuideId` becomes `null` and the Index says *No Guide yet* |

<a id="e5"></a>
## E5 — Additional Guides

**Recommendation:** the Presentation `•••` *Add to Guide* becomes a submenu: the Guides (the active
one first), then **New Guide…**, which asks for the name inline as D8 does. A new Guide becomes active
but not the Opening Guide unless it is the first. The Guide Card owns rename and **Make this the
opening Guide**. The Index Guides group gains an *opens* tag. No Index *New* (D1).

<a id="e6"></a>
## E6 — A Guide's start

**Recommendation:** a *Start* tag on the start Stop's card. **Start the tour here** in the selected
Stop's `•••` changes it. New Guides start at their first Stop. Reordering never moves the start.

<a id="e7"></a>
## E7 — Lens and Eye height

**Recommendation:** Conservatory's two three-step controls as shortcuts over exact Camera values.

- **Lens:** Wide, Normal and Close map to the retained `CAMERA_LENS_PRESETS` (24, 50 and 85 mm).
  The control shows *Custom · 35 mm* when the View matches none. Conservatory's mock field-of-view
  values (72°, 52°, 32°) are not promoted.
- **Eye height:** Seated, Standing and Raised are 1.15 m, the Camera default of 1.65 m, and 2.5 m.
  A step moves eye and target by the same amount, so aim is kept.
- The hero tag reads *Normal · Standing*. Writes go through `camera-view-update`.

<a id="e8"></a>
## E8 — Place a View height

**Recommendation:** the eye is at the Camera default of 1.65 m above the Floor and the target at 1.25 m
along the drag. There is no working-height control.

<a id="e9"></a>
## E9 — Present this framing

**Recommendation:** harvest Conservatory's *a first View framed on it* without capturing what the
creator has not seen.

- **In 3D:** Present this issues the Stage's existing **Bring into view** request on the subject.
  This is a deliberate Camera move, which PLATE allows. It then captures the framed pose as the
  Presentation's first View, in one acceptance. The Stage stays on that framing, and the hero and Look
  through show it.
- **In Plan:** Present this arms Place a View aimed at the subject.

Conservatory's `frameObject` heuristic is not promoted.

<a id="e10"></a>
## E10 — Snapshots

**Recommendation:** render each View through `camera-core` projection with the Stage's own renderer
into an offscreen target at the Look-through capture-frame aspect. Snapshots render lazily for visible
slots, are cached by View pose and source revision, and are never serialized. No extra WebGL context.

<a id="e11"></a>
## E11 — Camera support for Travel

**Recommendation:** choosing Travel never creates movement. A gap's Card offers **Add a Camera path**,
which creates one straight connection from the exit View to the entry View with computed timing, through
`camera-connection-create`. The red connector's menu offers the same action. The same action covers a
Travel step inside a Stop ([E3](#e3)).

<a id="e12"></a>
## E12 — *Crosses a wall*

**Recommendation:** include it, as a runtime-safe Layout read in `layout-core`. It tests the evaluated
route's planar samples against the Layout representation's Wall solids, which Openings pierce. The
warning is advisory: it never blocks, never moves a point and never becomes a Camera guard.

<a id="e13"></a>
## E13 — Hold-less Stops in the timeline

**Recommendation:** a Stop whose last View has no hold waits for the visitor's *Next*. On the bar it is
a hatched *waits* segment of fixed width. The total counts seconds and adds *+ 2 waits*, and playback
pauses there until Play is pressed again.

<a id="e14"></a>
## E14 — Show ▾ placement

**Recommendation:** in the Experience lens only, a **Show ▾** popover beside the Round 2 Stage reading
control, with Conservatory's content: *Whole Guide* or *Selection only*; Camera markers, View
frustums, Camera paths and Labels; and *n off* on the key. Session state only.

<a id="e15"></a>
## E15 — Visitor reach and Preview modes

**Recommendation: harvest Conservatory's visitor model.** The camera-tour contract leaves these
policies to domain planning; this decision is that planning.

| Capability | Where it lives |
| --- | --- |
| **Open in free exploration** (per Presentation, default on) | Presentation Card *Visitors reach it*; View Card *Hidden from free exploration*; S27 format |
| **Welcome chooser:** Experience name and welcome text; *Take the guided tour* (*n stops · about 0:41*) and *Explore freely* (*n places*) | Preview, S30. The welcome text is bounded plain text like a Presentation's Information text, edited on the Guide Card under More |
| **Guided controls:** Pause/Resume, *Next stop*, *Finish tour*, *Explore freely* | Preview, S30 |
| **Places** drawer listing open Presentations and their Views | Preview, S30 |
| **Back to the tour · Stop N** | Preview, S30 (the visitor runtime's resume) |
| **End of the tour:** *Keep exploring — including views the tour skipped* and *Start the tour again* | Preview, S30 |
| **Guide Card mode cards** as Preview entries (guided or free) | Guide Card, S30 |

*Remove if unwanted:* the welcome text is the only new visitor-facing text field. Dropping it keeps the
chooser with the name alone.

<a id="e16"></a>
## E16 — Review and test route (OD5)

| Who | Owns |
| --- | --- |
| **Writer** | All test code: planner contracts, controller and component tests, the architecture lane, and the heavy Camera contracts where the slice consumes motion. Correctness checks. A visual-token check: the slice's controls use the shell contract's role tokens and metrics (colour roles, type roles, control sizes, 44 px coarse targets), asserted in component tests or one short computed-style check. No journey runs, no screenshots, no capture archive |
| **Independent reviewer** | Domain and Camera parts only: S26, S27, S29 and S30 (planners, format, program, time map, Layout read) |
| **Owner** | The acceptance journeys, run manually; visual acceptance |

<a id="e17"></a>
## E17 — *Back* in the Card

**Recommendation:** harvest Conservatory's selection-history Back without new chrome. When the
previous selection is not the kind line's parent, the Round 2 kind line shows *‹ Stop 2* before the
kind. Alt+← does the same. Back only changes what you look at; it never undoes. History is session
state, up to 40 entries. Round 2 owns the Card container, so the owner confirms this reuse of the kind
line.
