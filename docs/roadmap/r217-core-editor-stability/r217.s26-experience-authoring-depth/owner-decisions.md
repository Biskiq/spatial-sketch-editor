# R217.S26 — owner decisions

**AUTHORITY: NONE until the owner rules.** Each decision has a recommendation and the alternative
considered. E1 and E2 gate the rest: without them nothing in S26 can be registered. Rulings are
recorded here and in the phase README when the owner gives them; this file never records one itself.

| # | Decision | Recommendation |
| --- | --- | --- |
| [E1](#e1) | Where S26 runs relative to S11 | S26–S32 as R217 slices, before S11 |
| [E2](#e2) | The new planners and derived reads | Approve the ledger as one set |
| [E3](#e3) | Stop-local guided Views | Defer to a T3 phase; keep the D5 placeholder |
| [E4](#e4) | Removal rules | No silent replacement; named consequences; Camera truth removed only when unshared |
| [E5](#e5) | The door for additional Guides | Add to Guide ▸ New Guide…; Guide Card owns rename and Opening Guide |
| [E6](#e6) | A Guide's start | Show it; change it from the Stop's `•••` |
| [E7](#e7) | Lens and Eye height | Promote the three-step presets over exact values |
| [E8](#e8) | Height for Place a View | Camera defaults, no working-height control |
| [E9](#e9) | Present this in Plan; auto-framing | Arm Place a View aimed at the subject; no auto-framing |
| [E10](#e10) | Snapshot rendering | The Stage's own renderer, offscreen, at the capture-frame aspect |
| [E11](#e11) | How a Travel gets Camera support | A deliberate *Add a Camera path*, never implied by choosing Travel |
| [E12](#e12) | *Crosses a wall* warning | Include, through a Layout-owned read |
| [E13](#e13) | Hold-less Stops in the timeline | A *waits* segment, outside the total |
| [E14](#e14) | Where Show ▾ lives in the Round 2 shell | Beside the Stage reading control, Experience only |
| [E15](#e15) | Exclusions | Confirm the list |
| [E16](#e16) | Review route | Independent review for planner work; owner visual acceptance for UI |

<a id="e1"></a>
## E1 — Sequencing against S11

**Recommendation: register S26–S32 in R217 and run them before S11**, which then also needs them
merged and gains four Experience journeys ([execution plan §6](./execution-plan.md#6-r217-and-s11-sequencing)).
S11 is R217's one integrated proof. Run now, it would certify an Experience lens full of disabled
placeholders, and S26–S32 would then rework the Card, Index, route and Stage facade it just certified.
One later S11 proves the finished shell once.

*Alternative:* run S11 now on S12–S25 and register S26–S32 as a new T3 phase. R217 closes sooner,
but the Experience lens is integrated twice, and the milestone's *Camera/Experience authoring* row
already lists advanced path authoring and rich transport as *Not required*.

Either way, R217's non-goal *Experience Guide and Path redesign* needs one clarifying amendment.
S26 is not a redesign: it builds the accepted Conservatory and Round 2 design.

<a id="e2"></a>
## E2 — New planners and derived reads

**Recommendation: approve the [ledger](./capability-inventory.md#12-operations-that-are-missing) as
one set:** `experience-update`, `experience-guide-update`, multi-Guide `experience-guide-create`, the
`viewIds` permutation, the four removals, `camera-connection-create`, `camera-connection-update`, the
Guide time map and the route-versus-Wall read. They change no format, gate version or F interface,
but they are planner changes under campaign checkpoint 3. Approving them together lets each slice
start without stopping again at that checkpoint. Any planner not on the list still stops there.

The Camera planners write Camera-owned facts (connection, interior anchors, per-direction timing).
They do not move authority: `camera-core` still resolves routes and evaluates motion, and the time
map is a `camera-core` read beside `experience-controllers.ts`, not a second clock.

<a id="e3"></a>
## E3 — Stop-local guided Views

**Recommendation: defer to a T3 phase.** Several Views per Stop, their order and per-View holds need
an Experience format change, an `ExecutionProgram` and lowering change, interpreter support for
in-Stop moves through Camera (Conservatory's fixed 1.6 s glide is a shortcut), and the
`T3.camera-experience-cutover` gate. That is beyond an R217 slice, whose registration excludes format
changes. S26 keeps D5: the entry View with its hold, the other Views dimmed, *Include* disabled with
*Comes with Stop-local Views*. With no data obligations before beta, the later format change is a
version bump with strict refusal and no migration.

*Alternative:* an eighth slice, S33, with the format bump, after S32. It roughly doubles S26's
domain risk.

<a id="e4"></a>
## E4 — Removal rules

**Recommendation:** every removal is one operation, one Undo entry and one consequence summary shown
before it runs. Nothing is replaced silently.

| Removing | Rule |
| --- | --- |
| A Stop | Removed from `stops` and from every Guide that orders it. A continuation targeting it falls back to the Guide order, and the summary names it. A Guide's start moves to the Stop that followed it (or preceded it, if it was last), named. **The only Stop of a Guide:** refused, *A Guide keeps at least one Stop — remove the Guide instead*. A Detour that uses it: refused with that reason (no Detour UI exists to repair it) |
| A View from a Presentation | **The last View:** refused, *remove the Presentation instead*. **The Default:** the summary asks for the new Default from the remaining Views; no automatic choice. Stops that enter there by name revert to entering at the Default, named. The Camera View and its connections are deleted only when no other Presentation lists it; otherwise *Still used by ⟨Presentation⟩* |
| A Presentation | Its Stops (Stop rules apply, so a Guide left empty refuses), its Gates, and its unshared Camera Views with their connections. Summary: *and its 2 Stops*, *and 1 Camera path* |
| A Guide | Its Stops that no other Guide orders. If it is the Opening Guide, the next Guide becomes it, named; with none left, `entryGuideId` becomes `null` and the Index says *No Guide yet* |

*Alternative:* keep orphaned Camera Views and connections after removal. It is simpler but leaves
Camera truth no creator can reach or see.

<a id="e5"></a>
## E5 — Additional Guides

**Recommendation:** the Presentation `•••` *Add to Guide* becomes a submenu: the Guides (the active
one first), then **New Guide…**, which asks for the name inline as D8 does. A new Guide becomes the
active Guide. It does not become the Opening Guide unless it is the first. The Guide Card owns rename
(its title, as on every Card) and **Make this the opening Guide**. The Index Guides group keeps one
row per Guide and gains an *opens* tag on the Opening Guide. No Index *New*, keeping D1's
one-home rule.

*Alternative:* a *New Guide* row in the Index Guides group. It is quicker to find, but it creates a
Guide with no Stop, which the domain refuses.

<a id="e6"></a>
## E6 — A Guide's start

**Recommendation:** show a *Start* tag on the start Stop's card. **Start the tour here** in the
selected Stop's `•••` changes it (`experience-guide-update.entryStopId`). New Guides start at their
first Stop. Reordering never moves the start, as the domain rules.

*Alternative:* make the start follow the first position on every reorder. It matches Conservatory's
mock, but it writes a second field the creator did not touch.

<a id="e7"></a>
## E7 — Lens and Eye height

**Recommendation:** promote Conservatory's two three-step controls as shortcuts over exact Camera
values. Lens Wide, Normal and Close map to the retained `CAMERA_LENS_PRESETS` (24, 50 and 85 mm) and
show *Custom · 35 mm* when the View matches none. Conservatory's mock field-of-view values (72°, 52°,
32°) are not promoted. Eye height Seated, Standing and Raised (1.15 m, the Camera default 1.65 m, and
2.5 m) moves eye and target by the same amount, so aim is kept. The exact *Lens mm* and *Eye* facts
stay below as the readout. All writes go through `camera-view-update`. Numeric entry stays deferred
advanced precision (PLATE *Camera View precision*).

<a id="e8"></a>
## E8 — Place a View height

**Recommendation:** the placed eye is at the Camera default of 1.65 m above the Floor and the target
at 1.25 m along the drag. There is no working-height control (PLATE leaves it open; Levels are
non-goals). Eye height changes afterwards through E7.

<a id="e9"></a>
## E9 — Present this in Plan, and auto-framing

**Recommendation:** in 3D, Present this keeps S25's behaviour of capturing what you see. In Plan it
arms **Place a View** bound to the subject: press where the camera stands, and the aim starts pointed
at the subject; drag to adjust. Nothing is captured that the creator did not compose. Conservatory's
`frameObject` auto-framing is a prototype shortcut and is not promoted.

*Alternative:* a Camera framing request (*Bring into view*) and then a capture. It needs a recommended-
framing Camera capability that does not exist.

<a id="e10"></a>
## E10 — Snapshots

**Recommendation:** render each View through `camera-core` projection with the Stage's own renderer
into an offscreen target at the Look-through capture-frame aspect. Render lazily, only for slots in
view, cached by View pose and the source revision, and never serialized. No extra WebGL context (the
visitor Preview's existing context is unchanged). Aspect and composition agree with Look through, as
PLATE requires.

*Alternative:* schematic snapshots from the Paper Plan representation. They are cheaper but do not
show what the visitor sees.

<a id="e11"></a>
## E11 — Camera support for Travel

**Recommendation:** choosing Travel never creates movement. When the Transition has a gap, its Card
says *No Camera path joins ⟨exit View⟩ and ⟨entry View⟩* and offers **Add a Camera path**, which
creates one straight connection from the exit View to the entry View (no interior anchors, computed
timing) through `camera-connection-create`. Camera then resolves either direction. The red connector's
menu offers the same action. A later entry or exit change re-resolves, and the old connection stays
with its Views.

<a id="e12"></a>
## E12 — *Crosses a wall*

**Recommendation:** include it. The check is a runtime-safe Layout read in `layout-core`: the
evaluated route's planar samples against the Wall solids of the Layout representation, which
Openings pierce. It reuses an existing helper if bounded investigation finds one; otherwise it adds
a pure function. It is advisory only: it never blocks an edit, never moves a point and never
becomes a Camera guard.

*Alternative:* defer it. Path editing then has no feedback for its most common mistake.

<a id="e13"></a>
## E13 — Hold-less Stops in the timeline

**Recommendation:** a Stop without `holdSeconds` waits for the visitor's *Next*. On the bar it is a
*waits* segment of fixed width, hatched. The total counts seconds only and adds *+ 2 waits*.
Playback pauses there until Play is pressed again. Stops with holds and Travel links are scaled by
seconds.

<a id="e14"></a>
## E14 — Show ▾ placement

**Recommendation:** in the Experience lens only, a **Show ▾** popover beside the Round 2 Stage
reading control, with Conservatory's content: *Whole Guide* or *Selection only* (with a Guide open),
Camera markers, View frustums, Camera paths (disabled without a Guide: *Open a Guide to see its
paths*) and Labels, plus an *n off* count on the key. Session state only. Round 2 owns Stage chrome,
so the owner confirms the placement.

<a id="e15"></a>
## E15 — Exclusions

**Recommendation: confirm these as outside S26:** publishing and every T4 surface; narration,
captions, cues and beats; Gates, Detours and branching authoring; per-Presentation *Open in free
exploration* (a format addition); a guided or free chooser and a phone frame in the visitor Preview;
Experience removal; Conservatory's *Back* chip; path editing in 3D; removing a Camera path on its own;
numeric Camera precision panels; auto-framing; and every prototype shortcut in the
[S25 harvest §5](../r217.s25-experience-shared-homes/design-harvest.md#5-prototype-shortcuts-never-promoted)
plus `camera.js`'s fixed glide and Catmull-Rom curve, `evalGuide`'s lerp, the `inPoly` test and
the Round 2 mock durations.

<a id="e16"></a>
## E16 — Review route

**Recommendation:** under the owner's 2026-11-02 process change, UI is accepted by owner visual
review. Planner and Camera work is not UI, so S26, S27, S31 and S32 keep one independent review of
their domain and Camera parts (new planners, the time map, the Layout read). Every slice is then
accepted visually by the owner.
