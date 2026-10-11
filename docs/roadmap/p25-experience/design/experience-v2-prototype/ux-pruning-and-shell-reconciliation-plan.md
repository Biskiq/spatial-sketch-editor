# PR #114 — Experience V2 UX pruning and shell implementation

**Status: final plan, locked design (2026-10-11, PR #113). Implementation belongs to PR #114
and starts only when the owner opens it.** This plan implements the locked Experience
expression in [PLATE §0.8.1][plate-081], with its [instrument grammar][grammar] and
[six QA boards and two Camera precision specimens][boards], in the unified prototype. It re-presents accepted C9
capability; it does not reopen product or design questions. A concrete contradiction found
in code is reported and resolved in the owning reference, not improvised in the UI.

**Baseline:** the PR #113 merge of `prototype-v2` (last executable change `40b65091`; C9 evidence
in the [C9 record][c9-proof]). C9.1–C9.9 are implemented and reviewed. MP1–MP4 are
owner-accepted **for functionality** (MP3/MP4 on 2026-10-11). Final visual UX was explicitly not
accepted and is this plan's job. The executable: [spatial-authoring][prototype].

**Sequence (ratified 2026-10-11):** #113 C9 acceptance + design lock → **#114 this plan** →
#115 [Paper PA0–PA12][paper] → prototype detour closes → F interface amendments → T1–T4.

**Boundary.** Prototype-only. In scope: `prototypes/spatial-authoring/` app, styles, tests
and QA, plus its evidence and the routing docs that record status. Out of scope: `apps/`,
`packages/`, persisted production formats, F amendments, Paper, World A–F behavior, and
restoring the missing P23B fixture (a separately tracked repository-gate blocker). No new
navigation/evaluation/selection/history authority. No second renderer or Scene. No new
persisted Experience entity (Cue is a projection). No authored Camera endpoints.

The earlier version of this plan (a pre-C9 proposal with exposure amendments, a Card-side
real-thumbnail inventory and a Seam triptych) is superseded. Its surviving rulings are
folded into the sections below; Git history keeps its deliberation.

## 1. Target experience

```text
HEAD   Museum Editor · project/Experience · World | Experience · Undo/Redo · Preview ▾
INDEX  Experience — Presentations · Guide · [+ Present] [Browse World]
       (Camera Path posture: Path | Journey · From origins / Journey summary)
STAGE  posture-specific: focus + View markers | Stop pins | path geometry | Cues + rig
CARD   exactly one inspector: Presentation · View · Scene subject · Stop · Guide edge ·
       Camera Path · Path point · Cue  (+ Edit Camera precision task)
DECK   one bounded lane: Guide Stops | straightened path | Journey time  (or none)
PREVIEW visitor runtime only — Back · Next · View choices · offers · Exit Preview
```

Authoring flow: World subject → Present → Views/Default → Add to Guide → Cut/Travel →
Edit Camera Path → Journey/Cues → Rehearse → Preview. A creator may stop after any step
with a valid, previewable result.

## 2. Disposition of current UI

Anchors are to the [prototype][prototype] `app/` files at the baseline (`ui` =
`experience-ui.js`, `exp` = `experience.js`, `model` = `experience-model.js`, `cam` =
`camera-evaluation.js`). Every row's capability stays reachable; only exposure changes.

| Current surface (anchor) | Disposition in #114 |
| --- | --- |
| Index footer `+ Presentation`, `Present environment`, `Present region` (ui:23) | **Consolidate** into `+ Present` (aggregate capture). Region/environment become focus operations in the Presentation menu (`Change focus…`), reusing `experience-region` |
| Index "Scene subjects" list (ui:23) | **Retire** after `Browse World` reaches every formerly listed subject (UX1 gate) |
| Presentation Card Name field (ui:41/66) | **Relocate** to one Rename writer (Index row menu / Card menu) |
| "What the visitor hears in Preview" textarea, Additional contributions, Intent, Advanced builder, View suggestions/estimate (ui:66–70, 285) | **Relocate** to *Advanced authoring*, **except** one compact ordinary `Add explanation` entry that stays on the Presentation Card even with no content (opens the existing focused writer; becomes a quiet summary/edit door once authored). When content is authored, the Card shows one quiet summary/door |
| Focus with Select/Operate links (ui:41) | **Simplify** to a Focus line. Operate moves to the subject Card. Select is a navigation verb in the locator |
| "Show · unordered Set" rows (ui:41) | **Rename/restructure** into the Views list (★ Default) plus Stage View markers |
| Auto · Hints · Capture · Bring into view · Add to Guide actions; Hints toolbar (ui:222) | **Restructure**: `+ Capture view`, `Add to Guide` on the Card. *Recommended framing…* (Hints) moves into the Views menu. Bring into view goes to the locator/context menu |
| "Reuse a Camera View" select | **Relocate** to Views menu → *Use existing View…* |
| View Card: Precise Camera, Bring into view, properties, Movement speed select, Entry/Visitor choice role buttons, Automatic View cue (ui:50, 287) | **Restructure** to: preview, Look through, Set as Default (`setRole('entry')`), Edit Camera, Rename, Remove from Presentation. Speed goes to advanced Camera request detail. *Visitor choice* is implicit (every non-Default View is a choice, and Default stays eligible whatever the entry View — entry is not exclusion). The View cue becomes *View switching* in Advanced authoring |
| Subject Card capability rows with Try/Play/Stop/On/Off, Use in/Capture in/Update, Let visitors activate (ui:112–130) | **Restructure**: identity, Present this, Used in Experience (new derived list), `+ Add behavior`, `+ Visitor interaction`. Chooser → one operation's audition/capture after invocation (existing writers) |
| Deck Peek band (pips, Overview, Preview Guide), Overview strip with Expand, L2 cards (ui:179–208) | **Replace** with the Guide Deck (named Stop chips, per-Stop outgoing edge chips for the resolved continuation — order-default, explicit destination, End, needs-repair — `Edit Guide`). Connectors join chips only for truly adjacent destinations. Expand/L2/Peek/Overview are retired; Edit Guide carries ordering |
| Seam triptych (FROM/TO bookends, coverage rows, Travel/Cut/Coordinate, Prepare missing routes, Pace) (ui:210–212) | **Split by owner**: Cut/Travel + aggregate coverage go to the edge Card. Per-origin coverage becomes the Path posture's *From* list. Pace moves to the Camera Path Card. *Prepare missing routes* is folded into choosing Travel (existing `prepareTravelSupport`) with an explicit repair action for gaps |
| Coordination strip (station select, Route/Beats/Holds lanes, Hold here, Name mid-route station, Invoke here) (ui:223–229) | **Replace** with the Journey posture (time Deck + Cue Card + Edit cue). Writers are reused unchanged; Cue identity is the (Guide edge, connection, station) triple, moves are atomic (all beats + Activity bindings in one history step, or refused), occupied stations refuse, and multiple holds show summed Pause with `Edit holds` |
| Stop Card: Entry/Next/Pacing/Gate selects, Detour/Go, Earlier/Later, Add another Stop, Remove Stop, Expand occurrence, Preview Guide, Open Seam, Open shared Presentation (ui:45, 314–319) | **Restructure**: Presentation link, Entry, Next, Movement summary, `Edit movement`. Pacing/Gate/choices go under *Stop detail*. Order/repeat/remove go to the Deck context menu. Preview Guide moves to Head. Expand is retired. Detour/Go stay run-time Stop resolution, distinct from the Stop's Next edge |
| Preview Guide in Index, Peek band and Stop Card; header Preview (index.html:33, ui.js:67) | **Consolidate** into Head `Preview ▾` (Presentation · Guide · Experience). No mid-Guide entry scope is added in #114 |
| Global View trail, undo/transaction counts, fabricated Saved status (`ui.js:renderHead`) | **Retire** from chrome. Navigation/return machinery and Undo stay. Session lifetime goes in help |
| Precise Camera task (Outside/Through/Plan, grips, one tape, Camera Card) | **Keep** as Edit Camera. Fix only density/label residue |
| Visitor surface (ui:321–332) | **Keep** the runtime. Ensure exactly one Exit Preview, Back/Next, and View choices labelled by View name with no author vocabulary |
| Presenter (journeys.js; Q1–Q8, A1–A10) | **Keep** the mechanism and ungated Next. Re-point recipes to the new homes in the same slice that moves each control |

## 3. Required state, selection and Camera operations

All of the following are prototype session or Camera-source changes inside existing
authorities. Verify each assumption in code before building on it (§8).

1. **Selection identities.** `S.sel` gains three kinds, resolved by `subject()`:
   - **Guide edge**: the resolved continuation pair (`from` Stop, `resolveNext(from)` destination), today held as `S.experienceContext.seam`. Revalidate on every read; a stale pair clears or reports needs-repair, never retargets to a positional neighbor.
   - **Path point**: connection id + anchor identity.
   - **Cue**: Guide edge + connection id + station identity.

   They are selected deterministically, stored in the Undo snapshot's `sel`, and cleared by
   `restoreQuiet` when invalid. A Scene subject never resolves as a Presentation. Posture
   (Guide / Camera Path / Journey / Edit Camera) is session context, not selection.
2. **Stable path-point identity.** `+ Path point` inserts at the clicked segment, and Remove
   deletes. Both are Camera operations through the existing shared-route Ask and one history
   step. If anchors or stations are index-keyed ("Anchor N", even parameter steps at
   cam:15–19), first give anchors stable ids. Then cover Cue/beat rebinding and the existing
   refusal for a removed station with tests. Insertion must not silently retarget a Cue.
   Interpolation stays as the evaluator defines it. Draw exactly what it evaluates. The
   early UX5 insertion/removal proof decides whether aim redistribution is acceptable; it
   authorizes no new Camera aim editor.
3. **Camera at this point.** `evaluatePath` at the station's progress gives the pose, which is
   rendered by the image pass (item 6). If a station's pose cannot be evaluated truthfully, the
   Card says so; it never fabricates one.
4. **Cue projection.** A Cue groups the invocation beats and the holds that share
   `(Guide edge, connection, station)`. *At* comes from `coordinateTiming`, *Pause* is the
   summed hold durations (with hold count when more than one), *Actions* are the invocations. The name comes from the named station/marker, else
   from the first action. A persisted Cue label is out of scope unless an existing field
   carries one. `+ Cue` at a station uses Hold here / Invoke here. Moving a Cue rebinds all
   of its beats plus each invoked Activity's station binding within the same Guide edge
   and Camera connection, as one validated history transaction or refused without
   mutation; an occupied destination station refuses rather than merging. Selection
   follows a successful move; Undo restores the previous grouping. One hold: Pause edits
   it directly. Several: the Card shows summed Pause with `Edit holds` for individuals;
   no summary-field edit consolidates, deletes or replaces distinct authored holds.
   Explicit consolidation is deferred. Marker placement at arbitrary progress is not added.
5. **Journey timeline and Rehearse.** The Deck maps time through the same
   `movementTiming`/`coordinateTiming` used at run time, for the selected origin's
   nominal Journey; the origin is shown and changeable within Journey posture. Rehearse is a session playhead (play,
   pause, scrub) whose rig pose is `evaluatePath` at the time-mapped progress. It is drawn on
   Stage. It never drives live navigation, writes source or runs invocations.
6. **Bounded image pass.** A Stage-owned derivative render feeds:
   - the selected View preview;
   - Camera at this point;
   - optional Stop-chip and visitor-choice images.

   Use the existing renderer, Scene and builders, with one reusable small target and the
   current Stage aspect (letterboxed). It applies a normal-World projection: no selection,
   inspection, gizmos, drafting aids or audition values. Live state is restored in a
   synchronous `finally`. A ≤ 32-image session cache is keyed by resolved pose + World
   generation + aspect. Work is limited to one draw per idle turn, under 50 ms, and paused
   during gestures, travel and Preview. Failure leaves a named placeholder and live state
   intact. Never move live navigation to take an image. The inset's paper/no-fog styling is
   not acceptable as the projection.
7. **Derived "Used in Experience".** For a subject, list Presentations focusing it,
   behaviors/offers targeting or triggered by it, and their Stops, from existing references.
   It is read-only. Each row opens its owner.
8. **Aggregate Present.** One command creates the Presentation, its first View use as Default
   and the Camera View in one Undo step, with no Stop, route or narration.
   - It captures the live Camera through a snapshot-and-interrupt that stops in-flight motion
     at the sampled pose.
   - **Present this** uses Camera's recommended framing for the subject extent. A logical
     subject with no extent captures the current view.
   - Invalid input changes nothing.
   - From a Plan reading, offer *Compose in 3D* (primary), *Use plan as visitor View* or
     *Cancel*, and create nothing before the choice. If Preview cannot reproduce a Plan capture
     through the same kernel, that option is unavailable with a reason.
9. **Locator coverage.** Extend shared Search/Browse to the Experience lens and to
   `ctx.sceneSource.subjects`, deduplicated by identity and refreshed on source change. Logical
   subjects are marked as having no Stage geometry. Querying is neutral; Select calls `A.select`;
   navigation verbs stay separate.
10. **Remove from Presentation.** Verify whether C9.6's removal supports unlinking one ordinary
    View use. If it does, expose it. If not, add a bounded local unlink. It discloses Default,
    explicit Stop entry, Cue and Travel consequences, keeps Camera truth used elsewhere, never
    picks a replacement Default, and Undo restores exactly. Never wire the global `removeView`.

## 4. Architecture and ownership boundaries

- **One Camera authority:** endpoints, path points, pace, evaluation, recommended framing,
  snapshot and Camera at this point all live in Camera code. Experience reads its evaluations.
- **Experience owns** Guide order, Stops, Cut/Travel choice, Cues (as beats and holds), pauses
  and visitor semantics. A Cue never writes a Camera pose.
- **Layout/Scene untouched:** subject extents come from neutral Stage/World output, never a
  reconstruction. World A–F behavior is unchanged.
- **One selection, one chronological history:** session postures, images, the playhead and
  caches are never serialized or put into Undo.
- **Visitor isolation:** Preview keeps its frozen source clone, refuses authoring actions and
  exits to the exact authoring context. No authoring DOM or hit target is live in the visitor.
  The static prototype's isolation is not production chunk proof; production gates remain
  separate.

## 5. Implementation slices

Each slice is a usable increment with its tests/QA updated in the same slice. No slice ends
with a moved control whose old recipe is still green only because it was not run.

| Slice | Depends on | Work | Exit gate |
| --- | --- | --- | --- |
| **UX0 — Harness and baseline** | — | Add `qa/experience-shell-check.sh` to `run-all.sh`, with semantic `data-home`/`data-act` selectors. Inventory every QA string/selector tied to Peek/Overview/Set/Seam/beat terms (the audit counts ~40 selector uses in conformance-check, 17 rich, 13 experience, 11 composition). Capture before-state at 1440×900 and 1024×768 | Full baseline green (24 axes, Node suite, mutations) recorded at the #114 start head |
| **UX1 — Shared chrome and locator** | UX0 | Head Preview ▾ with scopes. Remove duplicate Preview entries, trail, counts and fake Saved. Index restructure (`+ Present`, `Browse World`, Guide row). Locator coverage (§3.9), then retire the Scene list | Every formerly listed subject reachable by pointer and keyboard. Exactly one Preview control. World shell/return regressions green |
| **UX2 — Presentation and Views** | UX1 | Aggregate Present + Plan intent (§3.8). Presentation Card with ordinary `Add explanation` (existing focused writer; quiet summary/edit door once authored). Views list + Stage View markers (semi-spatial placement around a resolved focus anchor, deterministic crowding). View Card with preview (image pass §3.6, neutrality proven first per §8). Set as Default, Rename, Remove (§3.10), Recommended framing, Use existing View. *Advanced authoring* home receiving narration/contributions/suggestions/View switching | QA 3 acceptance (§7). Creator narration/capture/offer jobs still execute through the new doors. First-time creator scenario (Present → explain → capture → Preview) works without Presenter |
| **UX3 — Scene subject** | UX1 | Subject Card (§3.7), invoked behavior/interaction chooser using existing descriptors and audition/capture writers | QA 5 acceptance. Audition writes nothing; capture/update/ambiguity semantics unchanged |
| **UX4 — Guide, Stops, edges** | UX2 | Guide Deck (per-Stop outgoing resolved-continuation chips), Edit Guide ordering menu, Stop Card, edge identity and Card (Cut/Travel, coverage, Edit Camera Path). Retire Peek/Overview/Expand/L2/triptych | QA 4 acceptance. One-, six- and repeated-Stop fixtures, plus explicit-nonadjacent-Next, reorder, Undo, End and return-to-order fixtures. Travel preparation is still one Undo step and creates no edge from View work or Preview |
| **UX5 — Camera Path posture** | UX4 | Posture task + Path\|Journey switch. *From* list (connection choice). Path point species, armed insert, drag, remove (§3.2), with the insertion/removal proof first: retained identities/positions, aim, Cue bindings/timing, shared reach and Undo. The proof decides whether aim redistribution is acceptable; no new Camera aim editor is authorized here. Path/point Cards with Pace and Camera at this point. Straightened Deck lane naming the Guide edge occurrence | QA 1 acceptance. Shared-path Ask, refusal and Undo proven. Ordinary click adds nothing |
| **UX6 — Journey and Rehearse** | UX5 | Cue projection (§3.4), time Deck for the selected origin's nominal Journey (origin visible/changeable in posture; header names Guide edge + origin), Cue Card with occurrence disclosure, focused *Edit cue* (existing Hold/Invoke writers reused where applicable) plus `Edit holds`, atomic grouped-Cue station movement as a **new operation to implement and test in UX6** (all affected beats plus required Activity bindings as one validated history transaction; occupied destinations refuse; no silent merging or hold consolidation), Rehearse/scrub (§3.5), Look through at playhead. Shared-connection double-occurrence fixtures (distinct pauses, one selection each). No mid-Guide Preview entry | QA 2 acceptance. Exactly-once/traversed-route-only execution unchanged in Preview. Rehearse writes and executes nothing. Late-Journey edit → real Preview → exact-return loop measured and cost-reported |
| **UX7 — Preview, Presenter, integrated acceptance** | UX1–UX6 | Visitor surface audit (§7 QA 6). Q1–Q8/A1–A10 recipes re-pointed. Responsive/keyboard pass. Final capture packet and written verdict | All gates in §6–§7. Owner visual review requested |

UX3 may run in parallel with UX2. UX5 needs UX4's edge identity, and UX6 needs UX5's posture.

## 6. Responsive, keyboard and accessibility

- **1440×900 and 1024×768 are the review sizes.** At 1024, Index and Card are invoked sheets
  over an unresized Stage. The Deck is a reserved band whose height never exceeds 40 % of the
  viewport, with no document horizontal scroll and no nested scrollers inside chips. Card
  identity, Entry/Next and the Deck heading stay hit-reachable at the same time. Never close
  the Deck to pass a Card test.
- **Keyboard:**
  - Every Stage-selectable thing has a list or locator equivalent: Views list, Guide chips,
    *From* list, Deck path points and Cues.
  - Arrow keys move within the Deck lane.
  - Enter opens; Esc unwinds one level (cancel draft → leave posture → rest) and is never Undo.
  - Armed `+ Path point` is cancellable.
  - Focus visibility does not depend on hue alone.
- **Layout changes never navigate.** Opening a sheet, posture or Deck, or producing an image,
  writes no Camera intent.
- **Reduced motion:** Rehearse supports stepping; the rig marker does not need continuous animation.

## 7. Acceptance criteria (six boards + two specimens)

Boards are guardrails for homes, hierarchy and semantics, not pixels ([PLATE §0.8.1][plate-081]).
A criterion passes only when the real writer and domain effect are exercised.

| Board | Must be true |
| --- | --- |
| **QA 1 Camera Path** | Stage shows endpoints, the evaluated path and ○ points with amber ◎ selection, and no Cues/timing. `+ Path point` is the only creation path. Point Card shows Remove, an evaluated Camera preview, Look through and Used by. Deck lane mirrors selection with no time. *From* lists origins with connected/gap status |
| **QA 2 Journey** | Path handles are not hit-eligible. ◆ Cues sit at their stations. The time Deck runs 0:00 → derived total for the selected origin's nominal Journey, which equals Camera time + pauses, and names its Guide edge and origin. Rehearse plays and scrubs with a moving rig while the author view is unchanged. Cue Card shows occurrence, At/Pause/Actions/Edit cue (summed Pause with hold count and `Edit holds` when several). Moving a Cue rebinds its beats plus Activity bindings atomically within the edge; occupied stations refuse. Dragging offers only valid stations |
| **QA 3 Presentation/Views** | One `+ Present`. Compact named markers around the focus, ★ Default, no Stage thumbnails or order cues. Selecting a View shows its faithful rendered preview and operations in the Card without moving the Camera. Set as Default leaves Guide/Camera/Stop overrides intact |
| **QA 4 Guide/Stops** | One Guide home in a bounded Deck. Stop and edge each have their own Card, never both. Cut/Travel lives on the edge. Edge chips show resolved outgoing continuation (order-default, explicit destination, End, needs-repair); connectors only join truly adjacent destinations. No Camera paths on Stage in Guide posture. The resolved entry View is labelled by its own name |
| **QA 5 Scene subject** | Clicking a visible subject selects it. `Browse World` reaches the rest through the same selection. Card order: identity → Present this → Used in Experience → Add behavior / Visitor interaction. No capability controls at rest. No Presentation looks selected |
| **QA 6 Visitor Preview** | No author terms, chrome or hit targets. Back/Next, View choices by name, offers and exactly one Exit Preview. Exit restores the exact authoring context. Source is unchanged |
| **Camera precision** | Edit Camera opens neutrally. Outside/Through/Plan, one tape, Camera Card and explicit return all work. No six-property dashboard |
| **Global** | Density: no ordinary Card needs scrolling for its primary actions at 1440×900. Only one inspector and one Deck posture are visible. Visual roles match PLATE §0.7 (ivory surfaces, teal Camera, amber selection, thin borders, no heavy shadows) |

## 8. Risks and assumptions to verify in code first

| Risk / assumption | Verify | If false |
| --- | --- | --- |
| Anchors/stations have stable identity | `model` connection anchors, `cam` `stations()`, beat binding fields | Add ids + fixture migration in prototype source, with rebinding tests (§3.2) |
| Seam-key selection survives Undo/reorder | `restoreQuiet`, guide reorder paths | Resolve the edge by the continuation pair (`from`, `resolveNext(from)`). If either Stop is removed or the Next no longer resolves there, clear the selection (and any dependent Cue selection), never retarget it |
| Image pass can restore every live state | `stage.js` frame/restyle, `main.js:frameState`, `experience-scene.js:realizeCapabilities` | Narrow the projection rather than add a renderer. Prove neutrality (selection, ghost, clipping, audition, capability state, failure, edits/cache) before UX2 View-Card work. If a fidelity gap remains, report it before UX2 exit |
| Cue name source | beat/marker fields | Derive the label, adding no persisted Cue type |
| C9.6 local View unlink | removal APIs | Bounded unlink per §3.10, or omit Remove with an explicit owner note |
| QA string coupling | UX0 inventory | Migrate selectors to semantic hooks in the slice that moves the control. Never weaken assertions to pass |
| Rehearse timing equals run-time timing | `experience-coordination.js` | One mapping function shared by both, with a unit test asserting equality for identical invocation inputs (distinct live departures may differ) |

## 9. Regression coverage that must stay green

- **Behavior:** all 24 `qa/run-all.sh` axes, the prototype Node suite and the complete successor
  mutation proof (World + V2 + composition obligations) keep passing. Moved controls get new
  selectors, not weaker assertions.
- **MP3/MP4 recipes** (promoted from the retired #113 checkpoint; `Seam` below is the Guide edge) stay executable through the new homes. Re-point each control to its new home in the slice that moves it (UX7).
- **Presenter:** Q1–Q8/A1–A10 demonstrations work through visible controls. Next stays
  ungated, and outcomes stay advisory and truthful (including the Q7/A4 refusal reporting).
- **Isolation, history, selection:** Preview isolation, exact return and one Undo per accepted
  command. Session state is never in source.
- **World:** A–F journeys and shell checks are unchanged.
- **Repository:** `npm run test:arch` is green. Root test/check/build retain only the known
  P23B fixture failure, reported as such.

### MP3/MP4 regression recipes (owner-accepted for functionality 2026-10-11)

Perform with the Presenter closed. Each step names what must be observable, not merely what to click.

**MP3 — Travel and agency.**

- *Explicit Travel preparation*: in an ordinary session build a Guide whose departure
  Presentation holds more than one Framed use, open the Seam and choose Travel. One step
  must leave every legitimate origin supported (`Prepared n Camera route … · Camera owns
  route geometry`), no origin as a gap, and the whole preparation as one Undo step. Adding
  or selecting a View, and starting a Preview, must never add Camera connectivity by
  themselves.
- *Visible Camera flight*: Preview on a Travel Seam and press Next. The Camera must fly the
  authored route instead of snapping; Cut on the same Seam must snap and execute no route
  beats.
- *Early/manual navigation during movement*: press Next again while the first flight is in
  flight. The new move must start from where the Camera actually is, on the supported
  directed route, with no "finish the current move" demand, and arrive at the authored
  destination.
- *Redirect and rejoin*: redirect to another eligible View mid-visit, then Rejoin. Rejoin
  must restore the Stop's viewing intent from the live pose without replaying route stations
  or queued cues.
- *Exploration*: Explore and orbit freely — no offer may fire from exploration.
- *Direct visitor interaction*: click a used subject, then (separately) drag over it. A click
  activates what the subject offers; a drag only orbits.
- *Multiple-offer behavior*: on a subject offering more than one interaction, a click must
  open an explicit choice naming each offer's activation and target subject, with Cancel;
  nothing may run before the visitor chooses, and any deliberate navigation must settle an
  open choice.
- *Deliberate View choice*: the eligible View controls must re-frame without restarting
  narration incorrectly — compare caption/transcript state before and after.
- *Standalone/Guide Presentation open and close*: open another available Presentation — a
  Guide Stop is parked with exactly one Return that restores it with no duplicate entry;
  Close on a standalone Presentation returns to exploration, never to authoring.
- *One side detour and return*: take one authored detour, then Return; a second detour
  before returning must be refused with a visible reason rather than replacing the first.
- *Predicted versus observed cursor/pause*: predict a Stop's readiness/Auto count (Camera
  movement counted once, invoked station work counted at its own station) and compare it
  with the visitor panel; pause and resume Auto and confirm the clock continues rather than
  restarting.
- *Rejoin and Return keep the remainder*: in a Stop whose work is a long narration,
  let part of it play, Explore, and Rejoin — the panel must owe only the part not yet played, a cue
  whose moment already passed must not be claimed again, and a cue still ahead must still arrive.
  Take one detour mid-Stop and Return: the parent's own remaining work and cue floor must come back,
  not the detour's.
- *Availability authoring*: add an offer from a Presentation and confirm the draft
  offers availability with Experience-wide selected; accept it and confirm the Card reads
  `Experience-wide` while the offer stays homed in that Presentation; switch it to another
  Presentation and confirm one Undo step and one changed scope.
- *Preview the Experience without a Presentation*: with an Experience-wide offer and
  no Presentation selected, `Preview Experience` must start a world-only visit (no Presentation, Stop
  or Guide), offer that participation, and return to authoring untouched. Without any Experience-wide
  offer the entry must be absent rather than start an empty visit.
- *Same-View Travel after moving*: on a Seam whose origin and destination are the
  same View, press Next while standing at that View (instant, zero distance), then Explore away and
  press Next again: the Camera must fly back from where it actually is rather than snap, and no route
  may be invented.

**MP4 — rich capability acceptance:** loaded route/station/invoke/Hold, visitor
interaction/detour/return, revision/repair, additional Views/entry policies, shared/local scope
and precise Camera. Review the Experience walkthrough and recheck shared structural seams.

## 10. Visual and interaction verification

1. Each slice ends with real-browser captures of its board state at both review sizes.
   Compare them side by side with the board and write findings in the #114 evidence record
   (hierarchy, homes, density, species, selection, disclosure).
2. UX7 assembles **one bounded packet**: ≤ 10 JPEG captures in
   `prototypes/spatial-authoring/screens/experience-ux/` (six boards + precision + three narrow
   states), plus a short verdict table. Retire any interim captures; do not accumulate packets.
3. Interaction is proven by the shell axis: posture switching, Esc unwinding, keyboard paths,
   no navigation on layout change, and image-pass neutrality (no source/history/selection/clock
   writes, restored live state, cold/warm timing and cache bounds reported).
4. Request owner visual acceptance of the packet and a hands-on pass. Automation does not
   accept UX.

## 11. Deferred, not part of #114

- Deep Cue/scripting shell beyond the focused Card editor.
- Explicit hold consolidation beyond `Edit holds`.
- Path smoothing/curve evaluation (a Camera evaluator decision).
- Marker placement at arbitrary progress.
- Dense-constellation clustering beyond deterministic stacking.
- Multi-select Present.
- Mid-Guide Preview entry (deferred past #114; UX6/UX7 reports the late-Journey edit → Preview → return loop cost instead).
- Independent observer/lens Camera storage.
- Production cutover and persisted Experience format.
- Paper (PR #115).

[plate-081]: ../../../../reference/design-system/editor-shell-and-visual-system.md#081-finalized-experience-shell-expression
[grammar]: ../../../../reference/design-system/spatial-instrument-grammar.md#camera-routes-and-experience-coordination-projections
[boards]: ../../../../reference/design-system/editor-shell-and-visual-system.md#experience-qa-boards
[c9-proof]: ../../../../../prototypes/spatial-authoring/qa/EXPERIENCE-C9-EVIDENCE.md
[prototype]: ../../../../../prototypes/spatial-authoring/README.md
[paper]: ../../../p26-spatial-depth/design/paper-authoring-prototype/implementation-plan.md
