# PR #114 — Experience V2 UX pruning and shell implementation

> **SUPERSEDED WORK ENTRY (2026-10-13).** New #114 work starts at the
> [V3 proposal](../experience-ux-v3/README.md) and its single
> [superseding implementation plan](../experience-ux-v3/implementation-plan.md).
> The owner commissioned replacement design/docs/mockups; V3 semantics await
> ratification and application implementation is not authorized by that commission.
> Do not continue UX7 from this body. Everything below is the former plan's
> preserved historical scope/status, including its earlier “active” and checkpoint
> wording. Latest UX4–UX6 review corrections are in the existing evidence record;
> they establish no final owner visual acceptance. This file is not another active plan.

**Status: active plan for PR #114 (open since 2026-10-11) over the design locked in PR #113.** UX0–UX5
have landed and UX6 is at a recorded checkpoint. UX1–UX3 are implemented, with focused verification
recorded and the owner provisionally satisfied; like every slice, their visual and integrated functional
acceptance happens once, after UX7. §5.1–§5.8 (revised 2026-10-12) are the binding surface specification
for what UX4–UX6 still owe and for the light UX1–UX3 corrections, and §3.1–§3.2 were reconciled with the
landed code in the same review. That work belongs to the existing slices.
There is no separate polish phase. This plan implements the locked Experience
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
       (Camera Path posture: ‹ edge crumb · Camera Path · Path | Journey · From origins / Journey summary)
STAGE  posture-specific: focus + View markers | Stop pins | path geometry | Cues + rig
CARD   exactly one inspector: Presentation · View · Scene subject · Stop · Guide edge ·
       Camera Path · Path point · Journey · Cue  (+ Edit Camera precision task)
DECK   one bounded, single-row lane: Guide Stops | straightened path | Journey time  (or none)
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
| Deck Peek band (pips, Overview, Preview Guide), Overview strip with Expand, L2 cards (ui:179–208) | **Replace** with the Guide Deck: named Stop chips in one non-wrapping row that scrolls inside its lane (§5.4), each followed by its outgoing edge chip for the resolved continuation — order-default, explicit destination, End, needs-repair — and `Edit Guide`. Connectors join chips only for truly adjacent destinations. Expand/L2/Peek/Overview are retired and the chip carries no `Detail` control; Edit Guide carries ordering |
| Seam triptych (FROM/TO bookends, coverage rows, Travel/Cut/Coordinate, Prepare missing routes, Pace) (ui:210–212) | **Split by owner**: Cut/Travel + aggregate coverage go to the edge Card. Per-origin coverage becomes the Path posture's *From* list. Pace moves to the Camera Path Card. *Prepare missing routes* is folded into choosing Travel (existing `prepareTravelSupport`) with an explicit repair action for gaps |
| Coordination strip (station select, Route/Beats/Holds lanes, Hold here, Name mid-route station, Invoke here) (ui:223–229) | **Replace** with the Journey posture (time Deck + Cue Card + Edit cue) and **remove the C9 strip from every Card** (Stop, edge, Cue): the Deck axis and the Stage Cues are the projection, and the Cue Card's Edit cue holds the writers (§5.6). Existing Hold/Invoke writers are reused where applicable; atomic grouped-Cue station movement is a new UX6 operation. Cue identity is the (Guide edge, connection, station) triple; moves are atomic (all beats + Activity bindings in one history step, or refused), occupied stations refuse, and multiple holds show summed Pause with `Edit holds` |
| Stop Card: Entry/Next/Pacing/Gate selects, Detour/Go, Earlier/Later, Add another Stop, Remove Stop, Expand occurrence, Preview Guide, Open Seam, Open shared Presentation (ui:45, 314–319) | **Restructure**: Presentation link, Entry, Next, Movement summary, `Edit movement`. Pacing/Gate/choices go under *Stop detail* (§5.4). Order/repeat/remove go to Edit Guide. Preview Guide moves to Head. Expand, `Show in Guide` and the Card's shared-Meaning editor are retired (Meaning is edited from its Presentation). Detour/Go stay run-time Stop resolution, distinct from the Stop's Next edge |
| Preview Guide in Index, Peek band and Stop Card; header Preview (index.html:33, ui.js:67) | **Consolidate** into Head `Preview ▾` (Presentation · Guide · Experience). No mid-Guide entry scope is added in #114 |
| Global View trail, undo/transaction counts, fabricated Saved status (`ui.js:renderHead`) | **Retire** from chrome. Navigation/return machinery and Undo stay. Session lifetime goes in help |
| Precise Camera task (Outside/Through/Plan, grips, one tape, Camera Card) | **Keep** as Edit Camera. Fix only density/label residue |
| Visitor surface (ui:321–332) | **Keep** the runtime. Ensure exactly one Exit Preview, Back/Next, and View choices labelled by View name with no author vocabulary |
| Presenter (journeys.js; Q1–Q8, A1–A10) | **Keep** the mechanism and ungated Next. Re-point recipes to the new homes in the same slice that moves each control |

## 3. Required state, selection and Camera operations

All of the following are prototype session or Camera-source changes inside existing
authorities. Verify each assumption in code before building on it (§8).

1. **Selection identities, as landed in UX4–UX6. Do not migrate them into `S.sel`.** `S.sel` stays the
   one canonical selection with its current kinds (Presentation, View use, Camera View, Stop, Scene
   subject). A Guide edge, a Path point and a Cue are readings under the selected Stop, held in session
   context, and are never added as `S.sel` kinds:
   - **Guide edge**: `S.experienceContext.seam`, the resolved continuation pair (`from`, `resolveNext(from)`).
   - **Path point**: `S.experienceContext.point`, the connection id plus the anchor id.
   - **Cue**: `S.task.params.station` on the edge's `S.task.params.connection`.

   Four rules make them behave as one selection:
   - **Owner.** Opening an edge selects its from-Stop (`openSeam` calls `A.select(from)` before setting the
     pair). `S.sel` is then the edge's from-Stop while an edge, Path, point or Cue reading is open. Today
     `openSeam` leaves `S.sel` on whatever was selected before, which can be another Stop.
   - **An outside selection closes the reading.** When `A.select(id)` changes `S.sel` to anything else (a
     Stage pick, Browse World, an Index row, a Card reference), the reading closes the way `selectStop`
     leaves a procedure: `T.end()`, then Guide posture (`depth='overview'` with its `experience-overview`
     task), with the pair, point, armed state and rehearsal cleared. The Camera does not move and no
     return is restored (§5.5). Build it as one hook that `select()` calls when the id changes, before it
     renders, registered by `experience.js` in its existing `A.registerLensWork({…})` call. Today the
     reading survives such a pick: after a Stage subject pick, `S.sel` is the subject but the Card still
     reads `Guide edge` (real-browser probe, 2026-10-12).
   - **Revalidate on read and never retarget.** The edge Card already checks `resolveNext(from).id===to` on
     every render (`staleEdgeCard`). A point whose anchor is gone falls back to the Path Card, and a station
     that holds no Cue falls back to the Journey Card. Undo and Redo restore `S.sel` only, and the readings
     then revalidate. Nothing here enters the Undo snapshot or `restoreQuiet`.
   - **One look.** While a reading is open, the Stop chips and pins render unselected (§5.2.5).

   A Scene subject never resolves as a Presentation. Posture (Guide / Camera Path / Journey / Edit Camera)
   is session context, not selection.
2. **Path points: identity and insertion order.** Identity is already stable: anchors get ids from
   `fresh(c,'anchor')`, and stations and beats bind to those ids. The evaluator follows the anchors' array
   order (`connectionPath` is the origin, then the anchors in order, then the destination). So nothing is
   re-keyed. What is missing is the order: `addAnchor` appends. On a path with two points, a point placed
   before Point 1 becomes Point 3, and the path doubles back (observer x 0 → 10 → 20 → 5 → 30 in a kernel
   check, 2026-10-12).
   - **Required (UX5 correction, §5.5).** The armed `+ Path point` inserts into the drawn path where the
     author clicked. Take `routeGeometry(…).samples`, the line the Stage draws. Find the sample segment
     nearest the click in plan (x, z), and read the progress `p` of the nearest point on it. Insert at
     `at` = the number of anchors whose station progress is below `p`, so a tie goes before the existing
     point. The proposal carries the index (`{addAnchor:position, at}`), and
     `addAnchor(c, id, position, at = route.anchors.length)` splices.
     Remove still deletes by id. Both stay Camera writes through the existing shared-route Ask, in one
     history step.
   - A Cue stays bound to its anchor id through an insertion, and only its time moves. The refusal for a
     removed station is unchanged.
   - **Aim redistribution is accepted for #114.** Each point's aim is interpolated from the two endpoints
     by its index. Any add or remove (an append too) therefore re-aims the other points, while their
     positions stay exact. That is how the evaluator is defined. The Point Card's preview shows the
     result, and no aim editor is added.
   - Display names come from the order (`Point n`), never from the stored `Anchor n` name (§3.4).
3. **Camera at this point.** `evaluatePath` at the station's progress gives the pose, which is
   rendered by the image pass (item 6). If a station's pose cannot be evaluated truthfully, the
   Card says so; it never fabricates one.
4. **Cue projection.** A Cue groups the invocation beats and the holds that share
   `(Guide edge, connection, station)`. *At* comes from `coordinateTiming`, *Pause* is the
   summed hold durations (with hold count when more than one), *Actions* are the invocations. The
   name comes from the named marker, else from the first action, else `Pause · <station>`, where
   stations read Departure, Point n (path points in authored order), the marker's name or Arrival —
   never `Anchor n`. A persisted Cue label is out of scope unless an existing field
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
with a moved control whose old recipe is still green only because it was not run — where a
recipe moves it is re-pointed to the control's new home, never weakened. **How much is run per
slice is set by §9's owner-ratified lightweight policy (2026-10-12): the focused tests that cover
the control a slice moved, plus a small real-browser smoke path, and no automatic full suite.**

| Slice | Depends on | Work | Exit gate |
| --- | --- | --- | --- |
| **UX0 — Harness and baseline** · landed | — | Add `qa/experience-shell-check.sh` to `run-all.sh`, with semantic `data-home`/`data-act` selectors. Inventory every QA string/selector tied to Peek/Overview/Set/Seam/beat terms (the audit counts ~40 selector uses in conformance-check, 17 rich, 13 experience, 11 composition). Capture before-state at 1440×900 and 1024×768 | Full baseline green (24 axes, Node suite, mutations) recorded at the #114 start head |
| **UX1 — Shared chrome and locator** · landed; light fix §5.3 | UX0 | Head Preview ▾ with scopes. Remove duplicate Preview entries, trail, counts and fake Saved. Index restructure (`+ Present`, `Browse World`, Guide row). Locator coverage (§3.9), then retire the Scene list | Every formerly listed subject reachable by pointer and keyboard. Exactly one Preview control. World shell/return regressions green |
| **UX2 — Presentation and Views** · landed; light fixes §5.3 | UX1 | Aggregate Present + Plan intent (§3.8). Presentation Card with ordinary `Add explanation` (existing focused writer; quiet summary/edit door once authored). Views list + Stage View markers (semi-spatial placement around a resolved focus anchor, deterministic crowding). View Card with preview (image pass §3.6, neutrality proven first per §8). Set as Default, Rename, Remove (§3.10), Recommended framing, Use existing View. *Advanced authoring* home receiving narration/contributions/suggestions/View switching | QA 3 acceptance (§7). Creator narration/capture/offer jobs still execute through the new doors. First-time creator scenario (Present → explain → capture → Preview) works without Presenter |
| **UX3 — Scene subject** · landed; light fixes §5.3 | UX1 | Subject Card (§3.7), invoked behavior/interaction chooser using existing descriptors and audition/capture writers | QA 5 acceptance. Audition writes nothing; capture/update/ambiguity semantics unchanged |
| **UX4 — Guide, Stops, edges** · landed; owes §5.4 | UX2 | Guide Deck (per-Stop outgoing resolved-continuation chips), Edit Guide ordering menu, Stop Card, edge identity and Card (Cut/Travel, coverage, Edit Camera Path). Retire Peek/Overview/Expand/L2/triptych | QA 4 acceptance; §7 checklist C3–C5. One-, six- and repeated-Stop fixtures, plus explicit-nonadjacent-Next, reorder, Undo, End and return-to-order fixtures. Travel preparation is still one Undo step and creates no edge from View work or Preview |
| **UX5 — Camera Path posture** · landed; owes §5.5 | UX4 | Posture task + Path\|Journey switch. *From* list (connection choice). Path point species, armed insert, drag, remove (§3.2), with the insertion/removal proof first: retained identities/positions, aim, Cue bindings/timing, shared reach and Undo. Aim redistribution is accepted and insertion goes into the nearest segment (§3.2); no new Camera aim editor is authorized here. Path/point Cards with Pace and Camera at this point. Straightened Deck lane naming the Guide edge occurrence | QA 1 acceptance; §7 checklist C6. Shared-path Ask, refusal and Undo proven. Ordinary click adds nothing |
| **UX6 — Journey and Rehearse** · checkpoint; owes §5.6–§5.7 | UX5 | Cue projection (§3.4), time Deck for the selected origin's nominal Journey (origin visible/changeable in posture; header names Guide edge + origin), Cue Card with occurrence disclosure, focused *Edit cue* (existing Hold/Invoke writers reused where applicable) plus `Edit holds`, atomic grouped-Cue station movement as a **new operation to implement and test in UX6** (all affected beats plus required Activity bindings as one validated history transaction; occupied destinations refuse; no silent merging or hold consolidation), Rehearse/scrub (§3.5), Look through at playhead. Shared-connection double-occurrence fixtures (distinct pauses, one selection each). No mid-Guide Preview entry | QA 2 acceptance; §7 checklist C7. Exactly-once/traversed-route-only execution unchanged in Preview. Rehearse writes and executes nothing. Late-Journey edit → real Preview → exact-return loop measured and cost-reported |
| **UX7 — Preview, Presenter, integrated acceptance** · not started | UX1–UX6 | Visitor surface audit (§7 QA 6). Q1–Q8/A1–A10 recipes re-pointed. Responsive/keyboard pass. Final capture packet and written verdict | All gates in §6–§7. Owner visual review requested |

UX3 may run in parallel with UX2. UX5 needs UX4's edge identity, and UX6 needs UX5's posture.

### 5.1 Where the slices stand, and the next step

| Slice | Standing (2026-10-12) |
| --- | --- |
| UX0–UX3 | Implemented; focused verification recorded; owner provisionally satisfied; integrated acceptance after UX7. Only the light corrections in §5.3 remain. Resolved review findings are not reopened |
| UX4, UX5 | Landed, with the Deck name-block reconciliation. Their remaining visual deviations are specified in §5.4 and §5.5 |
| UX6 | Checkpoint: one clock (`journeyClock`), Cue identity, the atomic move (`moveCueCommand`), the origin choice (`setJourneyOrigin`) and the Rehearse playhead are in. The Journey surfaces in §5.6 and the Escape ladder in §5.7 complete it |
| UX7 | Not started. The visitor Preview design stays reserved for the owner discussion |

**Next step: one implementation pass, in this order.** §5.2 shared rules → §5.4 → §5.5 → §5.6 and §5.7
(completes UX6) → §5.3 → re-point tests per §5.8 → run the focused axes those tests live in → take the
§7 captures → stop before UX7 for the owner. Record each part under its own slice's evidence heading
(UX4 correction, UX5 correction, UX6). The rules below fix composition, hierarchy, ownership and layout
behavior. Where they leave a detail open (an icon, a 1–2 px nudge), take the established visual system's
nearest role. The same order carries the four reconciliations from the 2026-10-12 review: the selection
owner and close rule (§3.1) and the Deck focus helper (§5.4) go with §5.4, and insertion order (§3.2) and
the posture's return (§5.5) go with §5.5.

**Names.** Every hook that §5 or §5.8 calls *kept* exists at `44011d6`. These names are new, and the pass
creates them: `unwindExperience()`, `cueName()`, the selection hook (§3.1), the focus helper (§5.4),
`#pathInstrument`, the actions `exp-cue-look` and `exp-journey-origin`, and the hooks `data-gd-step`,
`data-path-origin`, `data-posture`, `data-cue-actions`, `data-exp-cue-edit` and `data-stop-reach`. New CSS
classes are the ones the §5 blocks define.

### 5.2 Shared surface rules

These hold for every Experience surface touched below.

1. **Card anatomy.** `.c-k` is the kind in capitals with no owner suffix: `PRESENTATION`, `VIEW`,
   `STOP 3`, `GUIDE EDGE`, `CAMERA PATH`, `PATH POINT · 2 of 3`, `JOURNEY`, `CUE`, or the subject's kind.
   `.c-t` is the name. `.c-ref` is at most one or two lines of context and shared reach, for example
   `Presentation · Piano · in 2 Stops`. Every block aligns to the Card's own left edge. Drop the extra
   16 px inset that `.exp-fact`, `.exp-label`, `.exp-more`, `.exp-summary`, `.exp-views`, `.exp-ops`,
   `.exp-preview` and `.ask-rule` add inside `.card`, so the header, facts and buttons share one column.
2. **Rows.** A labelled value or writer is one row: `.exp-row { display:grid;
   grid-template-columns:72px minmax(0,1fr); align-items:center; gap:8px; }`. The label uses the
   `.c-sec` type (10 px, caps, `--ink-3`). Selects and inputs in a row are md (26 px) and full width.
3. **Copy.** Ordinary Cards carry no ownership or architecture narration. This retires `Owner · …`,
   `Selection stays this subject…`, `Camera owns this geometry…`, `The only creation path…`,
   `Removing one point keeps…`, `Authors Camera's recommended framing…`, `No capability is operated…`
   and `Order, repeat and removal live in…`. Keep text that states a consequence before a
   consequential edit (Ask rules, one removal line) and refusal reasons. Hints are at most one line.
   Raw ids appear only behind Technical details.
4. **Action weight.** A Card has at most one `primary` (ink-filled) action, and only for the creation or
   acceptance that is its current decision: `+ Capture view`, `Present this`, `+ Cue`, or an Ask's
   accept. Deck and Stage controls never use `primary`, so `+ Path point` and `Rehearse` become
   default instrument buttons.
5. **One look per state**, wherever it appears (Index row, chip, pill, Stage chip, Deck node):
   - **Selected** (canonical): `--sel-edge` contour plus `--sel-soft` fill, with text staying `--ink`.
     A numbered badge fills with `--sel` and keeps its number; it is never replaced by `◉`.
   - **Current context or task focus** (posture segment, the From row being edited, the Guide row in
     Guide posture, the Edit Guide row of the selected Stop): `--recess` fill with `aria-current` or
     `aria-pressed`, the existing pressed baseline. Never amber.
   - **Camera infrastructure** (Travel pill, endpoints, path, topology lane, playhead): `--camera`.
   - **Gap or repair**: the refusal tokens (`--refuse-bg/-edge/-ink`). Never amber.
   - **One identity looks selected at a time.** While an edge is the Card's identity, its Stop chips
     and pins render unselected (`guideItem`: selected only when `!S.experienceContext.seam`).
6. **Stage labels.** Experience Stage chips (`.exp-view-pin`, `.exp-stop-pin`, `.exp-station`,
   `.exp-rig`, `.exp-gap`, `.exp-focus-mark`) override `.tape`'s mono with
   `font:500 var(--tsm)/1 var(--ui); font-stretch:100%`. Mono stays for measures. Chips name things:
   no `origin`/`destination`/role sub-line, no `◁`/`◉` prefix, no seconds, no `Anchor n`. Endpoint
   chips (`marker()` with `end`, given an `endpoint` class) are filled:
   `background:var(--camera); color:var(--instrument); border-color:var(--camera)`.
7. **Disclosures keep their state.** A `<details>` that holds a writer (Edit Guide, Edit cue, Edit
   holds) keeps its open state in session across re-render, following the `S.expExplain` pattern.
   Opening or closing one writes nothing.
8. **The Deck band** (Guide posture, Path, Journey) is one flex row: the name block (`.deck-block`),
   then the posture's lane. The name block has three lines: kicker, title, and a foot row. In the Guide
   the foot row carries `n Stops` on the left and the ops (`Edit Guide`, `Done`) on the right. The
   Journey's Rehearse controls take a fourth row of their own, and the Path has no ops.

   ```css
   .exp-deck:not(.ordinary) { display:flex; align-items:center; gap:16px; padding:10px 12px; }
   .deck-block { flex:0 0 200px; min-width:0; padding-left:12px; border-left:3px solid var(--ink-2);
                 display:flex; flex-direction:column; gap:2px; }
   .deck-block .deck-k { font:600 var(--t2xs) var(--ui); letter-spacing:.09em; text-transform:uppercase; color:var(--ink-3); }
   .deck-block .deck-t { font:600 var(--tmd) var(--ui); color:var(--ink); }
   .deck-block .deck-s { font-size:var(--txs); color:var(--ink-3); }
   .deck-block .deck-t, .deck-block .deck-s { min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
   .deck-foot { display:flex; align-items:center; justify-content:space-between; gap:8px; min-width:0; }
   .deck-block .gd-ops { display:flex; align-items:center; gap:6px; flex-wrap:nowrap; margin:0; }
   .deck-block > .gd-ops { margin-top:6px; }          /* the Journey's own Rehearse row */
   body.guide-band .index { padding-bottom: calc(var(--guide-band-h, 216px) + 24px); }
   @media (max-width:1060px) { .deck-block { flex-basis:168px; } }
   ```

   No lane wraps or grows with its content. The band's height is the same for 1, 6 or 20 Stops: about
   76 px for the Guide, about 66 px for the Path and at most 112 px for the Journey at both review sizes
   (measured on a scratch mock of these rules). The ≤ 40 % reservation stays as the test guard. Popovers
   open over the Stage and never change the band's height.

### 5.3 UX1–UX3 light corrections

Everything not named here stays as accepted.

| Surface | Change |
| --- | --- |
| Index (UX1) | Remove the head note `Meaning in the same World`, the `Add` group heading and its three explanatory notes. The Index ends with one row of two md buttons, `+ Present` (`exp-create`) and `Browse World` (`find-world`), with no text beneath |
| Presentation Card (UX2) | Kicker `PRESENTATION`. `.c-ref` reads `In n Stops · m Views`, dropping the duplicate `★ Entry`. Focus is one line, `Focus · <subject>`, with `Change…` as an xs summary on that line (`[data-exp-menu=focus]` kept). After the Views list and the `+ Capture view` / `Recommended framing…` row, add a Guide line: `In 2 Stops` (or `Not in the Guide`) with `Add to Guide` (`exp-add-guide`) as a default sm button rather than a reference link. This is the creator flow's next step and must read as one |
| View Card (UX2) | Kicker `View` — the kind on its own, so the owner (`Presentation · <name>`) is read as context below it rather than repeated in the kicker. `.c-ref` is two lines: `Presentation · <name>`, then `★ Default` or `Visitor choice`. Drop `the shared Views`, `fixed framing` and `Reach · …`, since reach appears in the Ask when it matters. Actions follow QA 3's order as equal-weight md buttons: `Look through`, `Set as Default`, `Edit Camera`, Rename (inline field), `Remove from Presentation`. Remove the `Camera framing · fixed · Perspective` section. The removal note (`[data-view-consequences]`) becomes one line that still contains "Camera framing is kept". The two disclosures stay |
| Subject Card (UX3) | The kicker is the subject's kind (`SCENE OBJECT` unless the provider names one). Remove `Scene · <id>`, `Selection stays…` and the hints under `Present this` and under the two doors |
| Stage (UX3 integration) | Draw a Presentation's View constellation and its `◇ focus` mark (`drawViews`) only while the canonical selection is that Presentation, one of its View uses, or, in ordinary depth, one of its Stops. With a Scene subject selected the Stage shows World geometry and that subject's own selection, so no Presentation looks selected (QA 5) |

### 5.4 UX4 correction — Guide Deck, Stop and edge

**Overflow behavior (decided; endorsed in the 2026-10-12 review).** The Guide lane is one non-wrapping
row that scrolls horizontally inside the lane. It has edge fades, step buttons, and an always-revealed selected chip, and connectors scroll
with their chips. Chips shrink to a readable minimum before the lane scrolls, so a normal Guide (up to 6
Stops) fits at 1440×900 with no scrolling. A dense Guide scrolls while the band keeps its height. Not
adopted: wrapping (it grew to a five-row grid at 20 Stops and covered the Stage), number-only chips
(they lose names) and any fit-everything compression (the retired Overview idea).

DOM (`guideLane`/`guideItem`/`edgeChip` in `app/experience-ui.js`):

```html
<div class="deck-block">
  <small class="deck-k">Guide</small><b class="deck-t">Saltmarsh evening Guide</b>
  <div class="deck-foot"><small class="deck-s">20 Stops</small>
    <div class="gd-ops"><details class="exp-more gd-menu" data-exp-guide-menu><summary>Edit Guide</summary>
      <div class="gd-menu-pop">…one .gd-edit row per Stop…</div></details>
      <button class="exp-action reference" data-act="exp-close">Done</button></div></div>
</div>
<div class="gd-scroll">
  <button class="gd-step" data-gd-step="-1" tabindex="-1" aria-label="Earlier Stops">‹</button>
  <ol class="gd-lane" data-guide-lane>
    <li class="gd-item"><article class="stop-card gd-stop-card compact [selected]" data-stop="…">
      <button class="peek-stop gd-stop" data-act="exp-stop" …><span class="gd-num">3</span>
        <span class="gd-names"><b class="gd-name">Piano</b></span></button></article>
      <button class="gd-edge order travel" data-act="exp-seam" data-from data-to data-continuation="order">Travel</button></li>
  </ol>
  <button class="gd-step" data-gd-step="1" tabindex="-1" aria-label="Later Stops">›</button>
</div>
```

The block below is the lane's complete styling; nothing in it relies on a rule this section deletes.

```css
.gd-scroll { flex:1 1 auto; min-width:0; display:flex; align-items:center; gap:4px; }
.gd-lane { flex:1 1 auto; min-width:0; list-style:none; margin:0; padding:4px; display:flex;
           flex-wrap:nowrap; align-items:center; overflow-x:auto;
           overflow-y:hidden; /* explicit: x:auto alone computes y to auto, which trips the band's nested-scroller law */
           scroll-padding-inline:28px; overscroll-behavior-x:contain; scrollbar-width:none; }
.gd-lane::-webkit-scrollbar { display:none; }
.gd-scroll.more-before .gd-lane { mask-image:linear-gradient(to right, transparent, #000 28px); }
.gd-scroll.more-after .gd-lane { mask-image:linear-gradient(to left, transparent, #000 28px); }
.gd-scroll.more-before.more-after .gd-lane {
  mask-image:linear-gradient(to right, transparent, #000 28px, #000 calc(100% - 28px), transparent); }
.gd-step { flex:0 0 24px; height:24px; padding:0; border:1px solid var(--rule); border-radius:3px;
           background:var(--instrument); color:var(--ink-2); font:600 var(--tmd) var(--ui); }
.gd-step:disabled { opacity:.4; }
.gd-item { display:contents; } /* chip and edge become the lane's own flex items, so each chip shrinks to its
                                  112 px floor before the lane scrolls; a wrapper box would size from the full name */
.gd-stop-card { flex:0 1 auto; min-width:112px; max-width:184px; height:34px; display:flex; align-items:center;
                padding:0 10px 0 6px; border:1px solid var(--rule); border-radius:3px; background:var(--instrument); }
.gd-stop { flex:1 1 auto; min-width:0; height:100%; display:flex; align-items:center; gap:8px; margin:0; padding:0;
           border:0; background:none; font:inherit; color:inherit; text-align:left; cursor:pointer; }
.gd-num { flex:0 0 20px; height:20px; display:grid; place-items:center; border-radius:50%;
          border:1px solid var(--rule); font:600 var(--txs) var(--ui); color:var(--ink-2); }
.gd-names { flex:1 1 auto; min-width:0; display:flex; flex-direction:column; }
.gd-name { font:600 var(--tmd) var(--ui); color:var(--ink); }
.gd-pres { font-size:var(--txs); color:var(--ink-3); }
.gd-name, .gd-pres { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.gd-lane.scrolls .gd-stop-card { flex-shrink:0; } /* once the lane must scroll anyway, chips keep their natural width */
.gd-stop-card:hover { border-color:var(--ink-3); background:var(--chassis-hover); }
.gd-stop-card.selected { border-color:var(--sel-edge); background:var(--sel-soft); box-shadow:inset 0 0 0 1px var(--sel-edge); }
.gd-stop-card.selected .gd-num { background:var(--sel); border-color:var(--sel-edge); color:var(--ink); }
.gd-edge { flex:0 0 auto; height:20px; padding:0 6px; border:1px solid var(--rule); border-radius:3px;
           background:var(--instrument); font:500 var(--txs) var(--ui); color:var(--ink-2); white-space:nowrap; }
.gd-edge.order { position:relative; margin:0 12px; }
.gd-edge.order::before, .gd-edge.order::after { content:''; position:absolute; top:50%; width:12px; border-top:1px solid var(--ink-3); }
.gd-edge.order::before { right:100%; } .gd-edge.order::after { left:100%; }
.gd-edge.travel { color:var(--camera); border-color:var(--camera); }
.gd-edge.explicit { margin:0 16px 0 6px; }                 /* "⇥ Stop 7": no connector */
.gd-edge.end { border:0; background:none; color:var(--ink-3); margin:0 4px 0 8px; }
.gd-edge.gap { background:var(--refuse-bg); border-color:var(--refuse-edge); color:var(--refuse-ink); margin:0 16px 0 6px; }
.gd-edge.selected { border-color:var(--sel-edge); background:var(--sel-soft); box-shadow:inset 0 0 0 1px var(--sel-edge); color:var(--ink); }
```

These replace the current `.gd-lane`, `.gd-item`, `.gd-stop-card*`, `.gd-edge*` blocks and their
`@media(max-width:1060px)` line. Delete the retired rules: `.peek-occurrences`, `.peek-stop*`,
`.stop-strip`, `.stop-card*`, `.stop-summary`, `.stop-thumbnail`, `.occurrence-content`, `.set-*`,
`.seam-*`, `.beat*`, `.coordination-strip*`, `.station-*`, `.temporal-lane`, `.coord-*`, `.hold-duration`
and `.exp-deck .seam-*`/`.exp-deck.coordination *`. Move the chip's focus ring into the shared
`:focus-visible` rule as `.gd-stop` rather than `.peek-stop`, and take `.stop-details` out of the shared
`.contribution, .offer-draft, .stop-details` box rule. The classes `stop-card`, `compact` and `peek-stop`
stay on the chip markup as test hooks only and carry no styling.

Behavior:

- **Chip content.** The badge always shows the occurrence number. The chip reads the Stop's name, which
  defaults to its Presentation's. A second line, `Presentation · <name>`, appears only when the Stop
  carries its own different name. Remove the `Detail` button (`exp-expand-stop`) and the expanded
  branch (`.gd-entry`, `.gd-more`). Add a `title` with the full `Stop n · name`.
- **Edge chip.** It reads one word: `Cut` or `Travel`, adding the `travel` class for Travel. An explicit
  non-adjacent Next reads `⇥ Stop n`, End reads `⊘ End`, and a repair state reads `! Next needs repair`.
  `data-continuation`, `data-act`, `aria-label` and the adjacent-only connector are unchanged.
- **Scrolling.** `renderDeck` reads the lane's `scrollLeft` before replacing `innerHTML` and restores it
  after, so a re-render never jumps the lane. When the selected key (Stop id or edge pair) changed since
  the last render, reveal it. Measure from `getBoundingClientRect` of the lane and the chip, and move
  `scrollLeft` just enough to keep the chip 28 px clear of either end. Then update the lane's state in
  this order: remove `scrolls`, and add it back if the lane still overflows with every chip at its 112 px
  floor (so chips shrink only when shrinking avoids scrolling); set `more-before` / `more-after`; set the
  steps' `hidden`/`disabled` state.
- **Listeners**, attached once when `#experienceDeck` is created: a click on `[data-gd-step]` scrolls
  by 80 % of the lane width (`behavior:'smooth'`, or `'auto'` under reduced motion); a captured `scroll`
  updates the fade classes; `wheel` with vertical delta over an overflowing lane scrolls it horizontally.
  None of these writes source, history or Camera intent.
- **Keyboard focus survives the rebuild.** Today Enter on a focused chip selects the Stop, the Deck is
  rebuilt, focus drops to `<body>`, and the next Tab lands on `Edit Guide` (real-browser probe,
  2026-10-12). Reuse the World Instrument's landed restore (`app/ui.js`, the `was`/`restore` pair near
  line 845) as one small helper. Before replacing `innerHTML`, if focus is inside the home, remember the
  control's `data-act` and its identity attributes (`data-id`, `data-from`, `data-to`, `data-anchor`,
  `data-delta`, `data-posture`). After the rebuild and the `scrollLeft` restore, focus the control that
  matches all of them. Failing that, focus one that matches the identity attributes alone (a posture
  segment loses its `data-act` once it is current). Failing that, focus the selected chip, or else leave
  focus alone. Use `focus({preventScroll:true})`, so the reveal rule above stays the only thing that
  scrolls. Apply the helper to the Deck, to the Experience Index (the From rows and the Path | Journey
  switch) and to the Experience lens's `renderCard` rebuild, which today restores only `[data-field]`
  inputs. Opening and closing `<details>` keep their §5.2.7 state.
- **Step buttons stay out of the Tab order** (`tabindex="-1"` and an `aria-label`). Keyboard users Tab
  through the chips, and a focused chip scrolls clear of the fades through the lane's
  `scroll-padding-inline`. The steps are a pointer convenience. No roving and no extra key handling are
  added.
- **Ordinary posture** (the compact strip inside the Stage) uses the same `.gd-scroll` lane. Its first
  child replaces the `deck-head` row and its `Open Guide` button with a name block whose kicker and title
  are one button:
  `<div class="deck-block compact"><button class="deck-open" data-act="exp-guide"><small class="deck-k">Guide</small><b class="deck-t">…</b></button><small class="deck-s">n Stops</small></div>`.
  Style it with `.exp-deck.ordinary { display:flex; align-items:center; gap:10px; padding:6px 8px; height:auto; }`,
  `.exp-deck.ordinary .deck-block { flex:0 0 auto; max-width:180px; border-left-width:2px; padding-left:8px; }`
  and `.deck-open { display:flex; flex-direction:column; align-items:flex-start; padding:0; border:0; background:none; color:inherit; font:inherit; text-align:left; cursor:pointer; }`.
  Target height ≤ 56 px; it may scroll even at 6 Stops.
- **Name block (Guide posture).** `GUIDE` · Guide name · a foot row with `n Stops` and the ops
  `Edit Guide` and `Done`. `Done` is the `exp-close` hook with the reference weight and replaces the label
  `Close Guide`.

**Edit Guide popover.** Keep `<details class="exp-more gd-menu" data-exp-guide-menu>` and its rows and
writers (`[data-edit-stop]`, `exp-move-stop` ±1, `exp-add-guide` Repeat, `exp-remove-stop`). Wrap the
rows in a `.gd-menu-pop` that opens upward over the Stage:

```css
.gd-menu { position:relative; margin:0; }
.gd-menu > summary { list-style:none; height:24px; display:inline-flex; align-items:center; padding:0 8px;
                     border:1px solid var(--rule); border-radius:3px; background:var(--instrument);
                     font:500 var(--txs) var(--ui); color:var(--ink-2); cursor:pointer; }
.gd-menu > summary::-webkit-details-marker { display:none; }
.gd-menu[open] > summary { background:var(--recess); color:var(--ink); }
.gd-menu-pop { position:absolute; left:0; bottom:calc(100% + 8px); z-index:40; width:320px;
               max-height:min(420px, 60vh); overflow-y:auto; padding:6px; background:var(--instrument);
               border:1px solid var(--rule); border-radius:4px; box-shadow:0 10px 26px rgba(23,32,29,.18); }
.gd-menu .gd-edit { min-height:28px; display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:8px; }
```

Each row is `n · name` (ellipsis) plus four xs (20 px) controls: `←`, `→`, `Repeat`, and `Remove` in the
destructive role. The selected Stop's row takes the current-context look and is scrolled into view on
open. Drop the hint paragraph. The menu stays open across moves and repeats (§5.2.7) and closes on Esc,
on an outside press, or after Remove. The shadow is the one the Head Preview menu already uses.

**Stage, Guide posture** (`drawExperience`, overview branch):

- Stops whose resolved entry View is the same View share one pin group. That is one chip holding one
  `.exp-stop-pin` button per Stop (`4 · 6`), each still `data-act="exp-stop"` with its own `data-id`,
  so distinct access is kept and repeats stop fanning out leaders.
- The selected Stop's resolved entry View is drawn as one View marker labelled by its own name, never
  "Presentation Default".
- While an edge is the Card's identity, the Stage keeps today's edge reading: its origin and destination
  entry Views only, with no pins.

**Stop Card** (`r.kind==='Stop'`), in QA 4's order:

```text
STOP 3
Power switch
Presentation · Power switch · in 1 Stop        name is a reference button (exp-open); line carries data-stop-reach (new)
Entry     [Presentation Default (Gallery entry) ▾]   data-exp-entry; the row keeps data-stop-entry
Next      [Guide order (Stop 4 · How the drive works) ▾]   data-exp-next
Movement  Travel · Gallery entry → Entry · Camera Path ready   (or Cut / End of Guide / Camera Path · 1 gap)
[Edit movement]                                 exp-seam, default md; absent at End
Stop detail ▸                                   data-exp-stop-detail: Pacing, Gate, Detour/Go, authored choices
```

Entry options read `Presentation Default (<resolved View>)`, each View use by name, and
`Keep current viewpoint`. Keep `.stop-details` as an unstyled wrapper whose direct `<details>` child is
`[data-exp-stop-detail]`, because `.stop-details > details > summary` is a live test hook. Remove the
`Owner …` line and both reach explanations, the `THIS STOP` section and its `Entry · …` fact, the bordered
`Entry · Next` box and its summary line, the Edit Guide hint, `Show in Guide`, the
`Shared Presentation` section (meaning text, `Open shared Presentation`, `Edit shared Meaning`) and
`coordinationDetail()`.

**Edge Card** (`edgeCard`):

```text
GUIDE EDGE
Power switch → How the drive works
Stop 3 → Stop 4 · arrives at Entry
[ Cut | Travel ]                  one .exp-seg; exp-cut / exp-travel with aria-pressed
Travel:  Reachable from 2 of 3 Views                       data-edge-coverage; "All origins supported" when complete
         Travel needs support for the new View  [Prepare missing routes]   (gaps only; exp-prepare)
         [Edit Camera Path]       exp-route; data-id = the route from the departure Stop's entry View, else the first connected route
         Bring route into view    reference
Cut:     The visit cuts straight to Stop 4's entry.
```

The quoted phrases are read by `tests/experience-travel-agency.test.mjs` and the conformance axis, so keep
them. `.exp-seg` is a segmented pair:

```css
.exp-seg { display:inline-flex; border:1px solid var(--rule); border-radius:3px; overflow:hidden; }
.exp-seg > button { height:26px; padding:0 12px; border:0; border-left:1px solid var(--rule);
                    background:var(--instrument); font:500 var(--tsm) var(--ui); color:var(--ink-2); }
.exp-seg > button:first-child { border-left:0; }
.exp-seg > button[aria-pressed="true"] { background:var(--recess); color:var(--ink); box-shadow:inset 0 -2px var(--ink-2); }
```

Remove the `Owner · … · mode` line, the Pace select (Pace lives on the Camera Path Card), `Edit cue timing`,
the `Origins from this Stop` disclosure (the Path posture's From list owns per-origin work), the
`Destination entry` section (now in `.c-ref`), `coordinationDetail()` and `coordinationHtml()`. Offer
`Edit Camera Path` at any movement mode whenever Camera has work on this edge — a route to read, **or an
origin still to connect** (2026-10-12: a fresh edge has no route at all, and the Path posture's *From* list
is the only per-origin connect door, so a door gated on "at least one route exists" made the first origin
unauthorable; the posture opens with `params.connection` unset and its Card reads *No Camera route yet*).
`openSeam` stops entering the Journey when the edge already has beats, so selecting an edge chip always
shows this Card, and it selects the edge's from-Stop first (§3.1).

### 5.5 UX5 correction — Camera Path posture (QA 1)

**Entry and switching keep the standpoint**, as [PLATE §0.8.1][plate-081] requires ("Opening it does not
move the authoring view"; "switching posture changes neither selection nor Camera"). The owner confirmed
this in the 2026-10-12 review (§12). Today `editRoute()` calls `nav.beginReturn(…)` and then
`await bringIntoView()`, so entry and every Journey → Path switch fly the Camera into Plan. Only the
framing goes. The capture stays, because navigation keeps one return slot: without a fresh capture at
entry, the crumb would restore whatever an older `Bring … into view` left there (reproduced in a
real-browser probe). The posture owns one return context, captured at entry and used only by its own
exits:

The posture also reads an edge Camera has no route for yet, because the *From* list is where the first
origin is connected: with `params.connection` unset the Card reads *No Camera route yet* and names the From
list, the Index still carries the crumb and the From rows, and choosing a row's Connect selects that route.
A route that *was* being read and no longer resolves stays the separate *needs repair* reading.

| Moment | Camera | Return context |
| --- | --- | --- |
| Enter from the edge Card (`Edit Camera Path`) | Does not move. Drop `await bringIntoView()` and the epoch check after it from `editRoute()` | Captured: `nav.beginReturn('Return to Guide edge')` stays |
| Switch Path ↔ Journey, or pick another From row | Does not move | Kept. `editRoute()` captures only when depth is not already `route` or `coordination`; today a Journey → Path switch captures again |
| `Bring route into view`; Look through at a point, the playhead or a Cue | Moves, on request | Kept. Inside the posture `bringIntoView()` passes `captureReturn:false` to `framePoints`, and Look through never captures |
| Exit by the crumb or Esc (`returnRouteReading()`) | `nav.putBack()` returns to the entry standpoint, so nothing moves if the author never moved | Used up |
| Any other exit: an outside selection (§3.1), the lens switch, Preview | Does not move | Not restored. Each later user of the slot captures at its own entry, and Preview keeps its own token |

`resumeExperience` already captures at reactivation, so a resumed posture follows the same table. The
landed checks stay true as written: `route crumb restores previous standpoint` (experience axis),
`resumed route return uses the current invocation standpoint` (conformance axis) and P1 in
`tests/experience-mp2-review.test.mjs` (selecting elsewhere never restores).

**Index** (`cameraPathIndexHtml`). While depth is `route` or `coordination`, `experienceIndex()` returns
only this home and does not append the ordinary Index beneath it:

```text
‹ Stop 3 → Stop 4               crumb: button data-act="exp-route-return"; back to the edge Card
Camera Path                     .ix-title
[ Path | Journey ]              .exp-seg at full width, container keeps data-exp-posture-switch; current segment
                                aria-pressed with no data-act; the other is exp-route / exp-coordinate;
                                both carry data-posture="path" / "journey" (the focus key, §5.4)
JOURNEY  Gallery entry → Entry  (Journey only) then "Total · 4.0 s · 2 Cues"  (data-exp-journey-total kept)
FROM                            data-path-from kept
  Gallery entry     ✓ connected     row = one button, data-path-origin="<viewId>"; Path: exp-route
                                    data-id=<connection>; Journey: exp-journey-origin data-id=<viewId>
  Keyboard detail   ! gap  [Connect]   row is a div; status in refusal ink; xs exp-connect
  Entry             same View       row is a div, status reading `same View`, and **no Connect**: the
                                    origin that *is* the destination entry View is reached by Camera's
                                    own zero-distance evaluation, so `connectOrigin` refuses it and the
                                    From list never offers it (N1 forbids a fabricated self route)
```

The row being edited takes the current-context look. Add the small `exp-journey-origin` action
(`setJourneyOrigin(el.dataset.id)`). Remove the `Guide edge` group (the crumb replaces it), the From
explanation note, the `Origin` select (`data-exp-journey-origin`) and the `Camera travel … + … pause`
line. Add `.ix-fact { margin:2px 8px; font-size:var(--tsm); color:var(--ink-2); }`, which the facts use
and which has no rule today.

**Card: Camera Path, no point selected** (`pathCard`):

```text
CAMERA PATH
Gallery entry → Entry
Camera · used by 1 Guide edge
Pace      [auto ▾]                  data-exp-pace (a <select>; the one Pace writer)
USED BY   Guide · Stop 3 → Stop 4   (one line per edge)
No path points yet — use + Path point on the Stage.    (only with 0 points)
Bring route into view               reference (exp-bring)
```

Remove the three-line owner/edge/reach `.c-ref`, the `PATH POINTS` chip row (the Deck lane and the Stage
are the inventory), `+ Path point` (it moves to the Stage), both explanatory hints, the
`Camera owns this geometry · n s travel · …` line (no time in Path posture), `Edit cue timing` and
`Put it back`.

**Card: Path point, a point selected.** The Card becomes the point's own inspector, not a section under
the path:

```text
PATH POINT · 2 of 3
Gallery entry → Entry
Drag the point on the Stage to reshape the path.
[Remove point]                exp-point-remove, destructive role
CAMERA AT THIS POINT          [evaluated preview: data-exp-point-preview, same image pass]
[Look through]                exp-look-point
USED BY   Guide · Stop 3 → Stop 4
```

Remove `Anchor n`, `% along the route`, the observer coordinates, the removal hint, and the `Used by`
disclosure, which becomes a plain list. Esc clears the point and returns to the Camera Path Card.

**Stage** (`drawSeam` in `app/experience-draw.js`, route depth):

- **Path.** The current connection is a 2 px `--camera` line from the evaluator's samples (geometry
  unchanged). Other origins' routes stay as quiet context: 1 px at 35 % opacity, no points, not
  hit-eligible. Delete the sample dots (`exp-sample` `·`); the grammar says derived samples are not marked.
- **Points.** `.exp-anchor` loses its `◆` text and becomes a 14 px ring:
  `width:14px; height:14px; padding:0; border-radius:50%; border:2px solid var(--camera); background:var(--instrument)`,
  with a transparent 6 px hit margin. The selected point (`x.point?.anchorId===a.id`) is
  `.exp-anchor.selected { background:var(--camera); box-shadow:0 0 0 3px var(--sel); }`. Delete the
  `.working` amber that today paints every point of the route as selected. Use the aria-label
  `Path point n`.
- **Endpoints** are filled teal name chips per §5.2.6.
- **`+ Path point` is a Stage instrument.** `renderDeck` creates and removes
  `<div id="pathInstrument" class="stage-instrument">` in `#stage` while depth is `route`, beside
  `#experienceInstrument`. It is positioned with
  `position:absolute; left:12px; bottom:calc(var(--guide-band-h, 0px) + 12px); z-index:36;` and holds one
  default md button, `+ Path point` (`data-act="exp-path-point"`, `aria-pressed`), which reads
  `Cancel point` while armed. While armed, a Stage tape beside it reads `Click the Stage to place the point · Esc cancels`.
  The armed press inserts the point into the nearest segment of the drawn path, not at the end (§3.2), and
  disarms.

**Deck: straightened topology** (`pathTopologyLane`). Today its `topo-*` classes have no CSS at all.

```html
<div class="path-lane" data-path-lane="<route>">
  <span class="topo-end" data-path-end="origin"><i></i><small>Gallery entry</small></span>
  <ol class="topo-track"><li><button class="topo-point [selected]" data-act="exp-point-select"
      data-connection data-anchor aria-label="Path point 1"></button></li>…</ol>
  <span class="topo-end" data-path-end="destination"><i></i><small>Entry</small></span>
</div>
```

```css
.path-lane { flex:1 1 auto; min-width:0; display:grid; grid-template-columns:auto minmax(0,1fr) auto;
             align-items:start; padding:0 8px; background:none; border:0; }
.topo-track { position:relative; list-style:none; margin:0; padding:0 8px; height:28px; display:flex;
              align-items:center; justify-content:space-evenly; }
.topo-track::before { content:''; position:absolute; left:0; right:0; top:50%; border-top:2px solid var(--camera); }
.topo-point { position:relative; width:14px; height:14px; padding:0; border-radius:50%;
              border:2px solid var(--camera); background:var(--instrument); cursor:pointer; }
.topo-point.selected { background:var(--camera); box-shadow:0 0 0 3px var(--sel); }
.topo-end { display:grid; grid-template-rows:28px auto; justify-items:center; min-width:72px; }
.topo-end i { align-self:center; width:12px; height:12px; border-radius:50%; background:var(--camera); }
.topo-end small { font:500 var(--txs) var(--ui); color:var(--ink-2); max-width:140px;
                  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
```

With no points, the track holds one centered `<li class="topo-empty">Direct path</li>` (10 px,
`--ink-3`, on `--instrument`). The lane carries no pace, armed or time text, and no `▸`/`▮` glyphs.
Point selection mirrors the Stage through the same `x.point`.

### 5.6 UX6 completion — Journey posture and Rehearse (QA 2)

The Card owns editing. The Stage and the Deck only show where and when.

**Index:** the §5.5 home with its Journey line.

**Card: Journey, no Cue selected.** Entering the Journey selects no Cue: the station parameter is the
first free station, or `null` when every station holds a Cue.

```text
JOURNEY
Gallery entry → Entry
Stop 3 → Stop 4 · from Gallery entry
Camera 2.0 s + pauses 2.0 s
Add a Cue at  [Point 1 ▾]  [+ Cue]     data-exp-station select (free stations only) + exp-beat (primary)
Add mid-route station                  reference (exp-mark-station)
This Camera Path also serves Stop 5 → Stop 6; Cues here belong to Stop 3 → Stop 4 only.   (only when shared)
Bring route into view                  reference
```

With no free station, the add row reads `Every station holds a Cue`.

**Card: Cue, a Cue selected** (`cueCard`):

```text
CUE
Open casing                                    (Cue name, §3.4)
Stop 3 → Stop 4 · from Gallery entry [· the path also serves Stop 5 → 6]
At        0:00.3                               data-cue-at
Pause     1 s   (or "2 holds · 2.0 s")          data-cue-pause
Actions   1                                    data-cue-actions
          Open casing · Machine                one line per action, data-cue-action; "· trigger elsewhere" in refusal ink when unbound
[Edit cue]   <details data-exp-cue-edit>, closed by default, open state kept (§5.2.7):
    Pause [1] s                                one hold: data-exp-hold input   |   several: Edit holds ▸ (existing inputs)
    Add hold here                              exp-beat, xs
    [Choose Activity ▾] [Invoke here]          data-exp-invoke-use + exp-invoke-beat
    Move to [station ▾]                        data-exp-cue-move, valid stations only; one hint line
[Look through]                                 new exp-cue-look: playhead to At, then rehearsalLook(); writes nothing
```

Remove from both Journey Cards: the `Cues · n` list (`jd-cue-list`; the Deck markers are the
inventory), `Name mid-route station` in the Cue Card, the Pace select, `coordinationDetail()`,
`coordinationHtml()` (the C9 station lane, Beats/Holds lanes and `.coord-hold` inputs), `Edit Camera Path`
and `Close`. The Index switch, the crumb and Esc are the exits. One shared helper, for example
`cueName(e, route, cue)` in `app/experience-coordination.js`, gives the Deck, the Card and the Stage the
same Cue and station names.

**Stage** (coordination depth):

- The path is quiet: 1.5 px `--camera` at 60 % opacity, with no handles. Endpoints follow §5.2.6.
- A Cue chip (`.exp-station`, `data-exp-station-label` kept, `data-act="exp-cue-select"`) appears only at
  stations that hold a Cue. It reads `◆ <Cue name>`, with no seconds and no `hold` text. The ◆ is
  `--sel`, the grammar's amber Cue species. The selected Cue's chip takes the selected look (2 px
  `--sel-edge` contour, name weight 600). Stations without a Cue are not labelled.
- During Rehearse the rig is a teal frustum glyph (the View-marker glyph path) plus a 10 px `--camera` dot
  at the evaluated pose. Keep `data-exp-rig` and `data-exp-rig-playing`, and drop the `◇ rig` text.

**Deck: time axis** (`journeyHead`, `rehearseOps`, `journeyLane`):

- Name block: `JOURNEY` · pair · a foot row reading `Guide · Stop 3 → Stop 4`, and a fourth row for the
  ops. The ops depend on the rehearsal: none yet → `▶ Rehearse`; playing → `❚❚ Pause` and `■`; paused →
  `▶ Rehearse`, `■` and `Look through`. `▶ Rehearse` and `❚❚ Pause` take the default weight, `■` is an
  icon-only sm button labelled `Stop rehearsal`, and `Look through` takes the reference weight. While a
  rehearsal exists, the foot row shows `[data-exp-rehearse-time]` (`0:01.2 / 0:04.0`, 10 px mono) in place
  of the edge reference, which the crumb still shows. So that the ops row fits on one line, this block is
  wider: `.exp-deck.coordination .deck-block { flex-basis:232px; }`, or 200 px at ≤ 1060 px.
- Lane: drop the recess box (`.journey-deck { background:none; border:0; padding:0 16px; }`) and keep the
  `jd-axis` height at 72 px. The axis is a 2 px `--ink-3` track at `top:28px`, with 6 px end dots and
  `0:00` and the total under its ends in 10 px mono `--ink-3`. Each Cue is a 12 px `--sel` ◆ on a 1 px
  tick, with its name below at 10 px, `--ink-2`, max-width 120 px and ellipsis. The selected Cue gets a
  2 px `--sel-edge` outline and a 600 label. The playhead is a 2 px `--camera` stem from the top down to
  the track, with a 10 px `--camera` head. Remove the centered `jd-time` reading (it moves to the name
  block) and the `jd-none` sentence; with no Cue the axis shows only its ends.

### 5.7 Exits and Escape

Esc unwinds one level at a time. `unwindExperience()` in `app/experience.js` replaces the
`closeExperienceWork()` call in the Esc branch of `app/main.js`; drafts and Asks are still cancelled
first by the existing `held` path. The levels, in order:

1. An armed point disarms.
2. A selected point clears.
3. A selected Cue clears (the station parameter returns to the first free station).
4. Path or Journey returns to the edge Card through `returnRouteReading()`. It puts the Camera back to the
   entry standpoint (§5.5), and it now also drops the rehearsal and sets the task kind back to
   `experience-seam`.
5. An edge returns to Guide posture. Its from-Stop is already `S.sel` (§3.1), so the Stop Card shows.
6. Guide posture returns to rest.

The open Edit Guide menu closes first. Precision keeps its own Esc. The visible exits are the Index crumb
(Path/Journey) and `Done` (Guide posture). No Card carries `Close` or `Put it back` for these postures.

### 5.8 Test expectations to retire, re-point or add

These recipes encode retired homes. Re-point each one in the slice that moves its control, never by
loosening it. Line numbers are approximate at `64de0ef`. The hooks `exp-guide`, `exp-close`, `stop-card`,
`peek-stop`, `data-deck-posture`, `data-exp-anchor`, `data-endpoint`, `data-edge-coverage`,
`data-stop-entry`, `data-exp-station`, `data-exp-pace` and `data-path-from` are kept on purpose.
`experience-shell-check.sh`, `capture-experience-shell.sh` and both walkthrough axes need no re-pointing;
the shell axis only gains two of the new checks below.

| Where | Expectation today | Disposition |
| --- | --- | --- |
| `qa/composition-check.sh` ~49–56 | Overview stays L1 until Expand; Expand reaches `.stop-card.expanded` | **Retire** both. Assert instead that a chip selection reads the Stop Card (`#card [data-stop-entry]`) and that no `.gd-stop-card.expanded` or `[data-act=exp-expand-stop]` exists |
| `qa/conformance-check.sh` ~278–282, 292, 317 | `exp-expand-stop` and `.gd-stop-card.expanded` (QA-3 Expand) | **Retire** the Expand clicks and assertions. Keep ~282's law, that all six chips are visible and hit at 1440×900 |
| `qa/experience-check.sh` ~62–67, 100 | Expanded chip and `.stop-card.expanded [exp-move-stop]` | **Re-point** the move to `[data-exp-guide-menu] [data-edit-stop="<id>"] [data-act=exp-move-stop][data-delta="1"]`, opening the menu first |
| `qa/reconciliation-check.sh` ~16, 28–31 | Stop Card text "affect this Stop" / "Meaning and Views"; `Show in Guide` and `.stop-card.expanded` at 1024 | **Re-point**: shared reach is `#card [data-stop-reach]` naming `n Stop(s)`, and local is the Entry/Next selects. At 1024, assert the band is under 40 % and at most 112 px, with the selected chip visible in the lane |
| `qa/presenter-check.sh` ~242 | `press [data-act=exp-expand-stop]` | **Re-point** to `exp-stop`; the `expanded` field then reads False throughout, as ~267 already expects |
| `qa/experience-check.sh` ~90–92; `qa/conformance-check.sh` ~357–366 | Entering the Path posture requests Plan | **Re-point**: after entering, click `#card [data-act=exp-bring]`, then assert Plan and the crumb. Every recipe that presses the Stage in Path posture clicks it first. The crumb check that follows (~95, `route crumb restores previous standpoint`) stays as written; after the Bring it proves that the crumb returns to the entry standpoint (§5.5) |
| `qa/conformance-check.sh` ~357 | `#card [data-path-from]`, `#card [data-act=exp-path-point]` | **Re-point** to `#index [data-path-from]` and `#pathInstrument [data-act=exp-path-point]` |
| `qa/conformance-check.sh` ~379–381; `qa/experience-check.sh` ~161–163; `qa/rich-check.sh` ~71, 156 | `exp-coordinate` on the edge or Path Card (`Edit cue timing`) | **Re-point** to the edge Card's `exp-route`, then `#index [data-exp-posture-switch] [data-act=exp-coordinate]`. Retire ~379, "the Path Card keeps the same edge cue-timing door" |
| `qa/conformance-check.sh` ~382–400, 421; `qa/rich-check.sh` ~72–86, 157–158 | The C9 strip: `.station-projection`, `.station-tick`, `.coord-beat`, `.coord-hold`, `[data-hold-duration]`, `[data-coordination-detail]`, `.coordination-strip` text | **Re-point** to the Journey homes. Station choice is the Journey Card's `[data-exp-station]`, and `+ Cue` (`exp-beat`) then selects the new Cue. The Activity picker (`[data-exp-invoke-use]`, `exp-invoke-beat`) and the hold value (`[data-exp-hold]`) are inside `#card [data-exp-cue-edit]`, so open Edit cue first. Mirrored Cue selection is `.jd-cue.selected` with the Stage's `.exp-station.active`. Binding and "trigger elsewhere" are `#card [data-cue-action]`. Retire ~399, "Coordination lives on the edge Card" |
| `qa/conformance-check.sh` ~404–407 | Reopening an edge with saved beats re-enters coordination | **Retire**, since the edge Card always shows. Re-point to: reopen the edge → `Edit Camera Path` → `Journey` → the saved Cues are on the Deck (`.jd-cue`) and the Stage (`[data-exp-station-label]`) |
| `qa/conformance-check.sh` ~410–412; `qa/experience-check.sh` ~168–171; `qa/rich-check.sh` ~101–104 | Pace changes `.coord-hold` text; `[data-exp-pace]` in the Journey or edge Card | **Re-point**: read `#card [data-cue-at]` or `.jd-cue[data-cue-at]`. Change Pace in Path posture, where the only `[data-exp-pace]` lives, then switch back |
| `qa/conformance-check.sh` ~439–440 | `exp-coordinate` on a two-route edge yields `chooseRoute` | **Retire**, because the From list is the explicit choice. Keep the shared-route pace Ask, reached through Path posture |
| `qa/experience-check.sh` ~177–186 | `.journey-deck .jd-head b`, `[data-exp-journey-origin]`, `#card .jd-cue-row`, `#card .station-projection`, `#card [data-exp-pace]`; selecting `[data-exp-cue-move]` | **Re-point**: `.deck-block .deck-s` names the edge, and the origin is `#index [data-path-origin][aria-current=true]`. Cue markers live on the Deck only. The Cue Card has `[data-cue-at] [data-cue-pause] [data-cue-actions]`, and Edit cue (opened first) holds `[data-exp-cue-move] [data-act=exp-beat] [data-act=exp-invoke-beat]` |

**New focused checks** for the four 2026-10-12 reconciliations. Each is a few assertions in a file the pass
already runs, not a new axis or mutation script:

| Check | Where | Asserts |
| --- | --- | --- |
| Insertion order | a Node test in `tests/` | A point placed before Point 1 on a two-point path lands at index 0, and the evaluated observers run in path order. A beat bound to Point 1 keeps its anchor id |
| Posture return | `qa/experience-check.sh`, after the re-pointed Bring | Path → Journey → Path, then the crumb: the pose equals the entry standpoint (`S.seamPose`), and entering moved no Camera |
| Outside selection | `qa/experience-shell-check.sh` | With an edge open, `__me.A.select(<subject>)` (what a Stage pick runs) shows the subject's Card, clears `S.experienceContext.seam` and leaves the pose unchanged. Opening an edge chip makes `S.sel` its from-Stop |
| Keyboard focus | `qa/experience-shell-check.sh` | Focus Stop 1's chip and press Enter: the same chip still has focus, and Tab reaches its edge chip |

## 6. Responsive, keyboard and accessibility

- **1440×900 and 1024×768 are the review sizes.** At 1024, Index and Card are invoked sheets
  over an unresized Stage. The Deck is one row whose height does not depend on Stop count (§5.2.8), and
  the ≤ 40 % reservation stays as the test guard. There is no document horizontal scroll and no
  vertical scroller in the band. The Guide lane scrolls horizontally and keeps the selected chip in
  view. Card identity, Entry/Next and the Deck heading stay hit-reachable at the same time. Never close
  the Deck to pass a Card test. At 1024 the Path | Journey switch, the From list and the crumb are
  reached through the Index sheet, and Esc unwinds (§5.7).
- **Keyboard:**
  - Every Stage-selectable thing has a list or locator equivalent: Views list, Guide chips,
    *From* list, Deck path points and Cues.
  - Deck lanes are traversed with Tab and Shift-Tab in order, and focusing a chip, point or Cue scrolls
    it into view. Arrow-key roving is not required in #114.
  - Activating a control keeps focus on it across the re-render, in the Deck, the Experience Index and
    the Card (§5.4). The lane's step buttons are pointer-only.
  - Enter opens; Esc unwinds one level (cancel draft → leave posture → rest) and is never Undo.
  - Armed `+ Path point` is cancellable.
  - Focus visibility does not depend on hue alone. The lane's 4 px padding keeps chip focus rings
    from being clipped by its overflow.
- **Layout changes never navigate.** Opening a sheet, posture or Deck, scrolling a lane, or producing
  an image writes no Camera intent.
- **Reduced motion:** Rehearse supports stepping; the rig marker does not need continuous animation. Lane
  step scrolling is instant.

## 7. Acceptance criteria (six boards + two specimens)

Boards are guardrails for homes, hierarchy and semantics, not pixels ([PLATE §0.8.1][plate-081]).
A criterion passes only when the real writer and domain effect are exercised. The owner's single visual
and integrated review after UX7 is the gate. Before handing over, the implementer checks the
lightweight checklist below by looking at real captures next to the boards.

| Board | Must be true |
| --- | --- |
| **QA 1 Camera Path** | Stage shows endpoints, the evaluated path and ○ points with amber ◎ selection, and no Cues/timing. `+ Path point` is the only creation path, and it lives on the Stage. Point Card shows Remove, an evaluated Camera preview, Look through and Used by. Deck lane mirrors selection with no time. *From* lists origins with connected/gap status. A point added between two others lands between them. Entering or switching posture moves no Camera, and the crumb returns to the entry standpoint |
| **QA 2 Journey** | Path handles are not hit-eligible. ◆ Cues sit at their stations. The time Deck runs 0:00 → derived total for the selected origin's nominal Journey, which equals Camera time + pauses, and names its Guide edge and origin. Rehearse plays and scrubs with a moving rig while the author view is unchanged. Cue Card shows occurrence, At/Pause/Actions/Edit cue (summed Pause with hold count and `Edit holds` when several). Moving a Cue rebinds its beats plus Activity bindings atomically within the edge; occupied stations refuse. The Card's move offers only valid stations, and Stage dragging of Cues is not required. No C9 strip, Pace writer or Cue list in any Card |
| **QA 3 Presentation/Views** | One `+ Present`. Compact named markers around the focus, ★ Default, no Stage thumbnails or order cues. Selecting a View shows its faithful rendered preview and operations in the Card without moving the Camera. Set as Default leaves Guide/Camera/Stop overrides intact |
| **QA 4 Guide/Stops** | One Guide home in a bounded, single-row Deck whose height does not grow with Stop count. Stop and edge each have their own Card, never both, and never both look selected. Cut/Travel lives on the edge. Edge chips show resolved outgoing continuation (order-default, explicit destination, End, needs-repair); connectors only join truly adjacent destinations. No Camera paths on Stage in Guide posture. The resolved entry View is labelled by its own name. No `Detail`/Expand on chips |
| **QA 5 Scene subject** | Clicking a visible subject selects it. `Browse World` reaches the rest through the same selection. Card order: identity → Present this → Used in Experience → Add behavior / Visitor interaction. No capability controls at rest. No Presentation looks selected, on the Index or the Stage |
| **QA 6 Visitor Preview** | No author terms, chrome or hit targets. Back/Next, View choices by name, offers and exactly one Exit Preview. Exit restores the exact authoring context. Source is unchanged |
| **Camera precision** | Edit Camera opens neutrally. Outside/Through/Plan, one tape, Camera Card and explicit return all work. No six-property dashboard |
| **Global** | Density: no ordinary Card needs scrolling for its primary actions at 1440×900. Only one inspector and one Deck posture are visible. Visual roles match PLATE §0.7 (ivory surfaces, teal Camera, amber selection, thin borders, no heavy shadows) and the state looks in §5.2 |

**Lightweight visual-conformance checklist.** Use the conformance fixture (Experience examples → Load
Conformance fixture). For the dense Guide, call `__me.E.addToGuide(<presentation id>)` 14 times to reach 20
Stops. Compare each capture with its board.

| # | State | Sizes | Visibly true |
| --- | --- | --- | --- |
| C1 | Presentation selected, then one of its Views | 1440 | QA 3 homes. The Index has no explanatory notes and ends with `+ Present` / `Browse World`. The Card's columns align and its primary actions show without scrolling. The View preview is in the Card |
| C2 | Scene subject selected | 1440 | QA 5 Card order. No View constellation on the Stage and no Presentation row highlighted |
| C3 | Guide posture, 6 Stops, Stop 3 selected | 1440 + 1024 | At 1440 all six chips show in one row without scrolling, each with its number and name (an ellipsis is fine; the full name is in its tooltip and the Card), and the band is about 76 px. The Stop Card follows QA 4's order. Pins show, with the resolved entry View named |
| C4 | Guide posture, 20 Stops, Stop 15 selected | 1440 + 1024 | The band is the same height as C3 (±2 px). Chip 15 is revealed and selected. The fades and steps show more on both sides. Repeated Presentations share pin groups, and the Stage above the band stays readable |
| C5 | Edge Stop 3 → 4 selected, Travel | 1440 | Only the edge Card shows, with `Cut \| Travel` segmented and `Edit Camera Path`. The Stop chips and pins are unselected |
| C6 | Camera Path with 0 points, then 3 points with one selected | 1440 + 1024 | QA 1 homes. The Index holds only the crumb, title, switch and From. The Stage shows ○ points with one amber ring, no dots, diamonds or times, and `+ Path point` on the Stage. The Card is the Path or Path point inspector. The Deck shows the straightened topology mirroring the selection. The Camera did not move on entry |
| C7 | Journey with two Cues (one with an action), one selected; Rehearse paused midway | 1440 + 1024 | QA 2 homes. The Stage shows only named ◆ Cues and the rig. The Deck axis runs 0:00 → total with ◆ labels and the playhead. The Cue Card is shallow (At/Pause/Actions, Edit cue closed, Look through) |
| C8 | Any posture above | both | No document horizontal scroll. The Card identity and the band heading are reachable together. One inspector and one Deck posture show |

## 8. Risks and assumptions to verify in code first

| Risk / assumption | Verify | If false |
| --- | --- | --- |
| Anchors/stations have stable identity | `model` connection anchors, `cam` `stations()`, beat binding fields | **Verified 2026-10-12:** ids are stable and beats bind by id. Only the insertion order is missing (§3.2) |
| Seam-key selection survives Undo/reorder | `restoreQuiet`, guide reorder paths | **Verified 2026-10-12:** the edge revalidates on every read (`staleEdgeCard`) and never retargets. What was missing is the owner and close rule (§3.1) |
| Image pass can restore every live state | `stage.js` frame/restyle, `main.js:frameState`, `experience-scene.js:realizeCapabilities` | Narrow the projection rather than add a renderer. Prove neutrality (selection, ghost, clipping, audition, capability state, failure, edits/cache) before UX2 View-Card work. If a fidelity gap remains, report it before UX2 exit |
| Cue name source | beat/marker fields | Derive the label, adding no persisted Cue type |
| C9.6 local View unlink | removal APIs | Bounded unlink per §3.10, or omit Remove with an explicit owner note |
| QA string coupling | UX0 inventory, §5.8 | Migrate selectors to semantic hooks in the slice that moves the control. Never weaken assertions to pass |
| Rehearse timing equals run-time timing | `experience-coordination.js` | One mapping function shared by both, with a unit test asserting equality for identical invocation inputs (distinct live departures may differ) |
| Path entry no longer frames the route | recipes that press the Stage after `exp-route` | Click `Bring route into view` first (§5.8). Do not restore auto-framing in `editRoute`, and keep its entry capture (§5.5) |

## 9. Verification this PR performs (owner-ratified lightweight policy, 2026-10-12)

> **This section supersedes the earlier full-suite gate.** #114 is a UX prototype whose blocking
gate is the owner's hands-on visual review, not an exhaustive automated suite. §5's per-slice gate
and §10's evidence rules are read through this section: the earlier requirement that *all* 24+ axes,
the Node suite and the complete successor mutation chain stay green at every slice/checkpoint is
withdrawn here and kept as history rather than silently obeyed. The owner may still direct a broad
sweep at any time (typically after the integrated visual review); the change is that it is no longer
automatic.

- **Focused tests per slice.** Each slice runs the assertions that protect the behaviour it changed —
the specific axes and Node test files covering the control it moved — plus a small real-browser smoke
path through the feature's own workflow. It does **not** run `qa/run-all.sh all`, `qa/mutation-check.sh`,
or any historical mutation chain by default, before review, or at a slice checkpoint. For the §5 pass these
are the axes §5.8 touches (`experience`, `composition`, `conformance`, `rich`, `reconciliation`,
`presenter`, `experience-shell`) and `node --test tests/*.test.mjs`.
- **No new mutation scripts by default.** The existing mutation scripts stay in the tree (retained, not
deleted, and runnable when a slice genuinely needs replacement proof). New ones are added only when a
change protects a central invariant and the owner asks for it.
- **Interrupted runs are reported, not restarted.** If a mutation or suite process was interrupted, its
available result is inspected and reported honestly, and it is not automatically restarted.
- **Broad regression or mutation runs are owner-directed.** A full sweep happens because the owner asked
for one, not at slice-close.
- **Small, meaningful evidence.** Prefer a handful of screenshots and interaction observations that show
the slice's workflow, recorded in that slice's evidence section. Per-slice full-board packets and
accumulated interim capture directories are not required.
- **Never weaken a test to claim a pass.** An assertion changes only when a control genuinely moved, and
then it is re-pointed to the control's new home — not loosened. An unrun or stale test is reported as
unrun, never as green.
- **What each slice that touches them still checks:** Preview isolation and exact return, one Undo per
accepted command, deterministic selection, and one Camera authority. These are the prototype's
architectural invariants and outrank visual polish.
- **Deferred, recorded rather than fixed.** Rare edge cases, low-impact regressions and expensive
performance proofs are recorded as limitations in the slice's evidence instead of being fixed.
- **MP3/MP4 recipes** (promoted from the retired #113 checkpoint; `Seam` below is the Guide edge) stay
executable through the new homes, and each control is re-pointed to its new home in the slice that moves
it. They are the owner's hands-on plan, not an automated per-slice requirement.
- **World:** A–F journeys and shell checks are unchanged by #114; they are re-run only under an
owner-directed sweep.
- **Repository:** `npm run test:arch` and the root gates retain only the known P23B fixture failure,
reported as such.

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

## 10. Visual and interaction verification (lightweight, owner-ratified 2026-10-12)

1. Each slice ends with a **small** set of real-browser captures of the state it changed — the slice's
   primary workflow at 1440×900 and, where the invoked sheet is involved, 1024×768 — each with a short
   reading of what it shows (hierarchy, homes, density, selection, disclosure). For the §5 pass these are
   the §7 checklist states C1–C8. A handful of meaningful captures replaces the earlier per-slice
   full-board packet; interim capture directories are not accumulated.
2. Interaction checks are focused: the shell/posture axis plus a real pointer-and-keyboard smoke path
   through the slice's own controls, together with the invariants §9 names (Preview isolation and return,
   one Undo per accepted command, no navigation on layout change, and image-pass neutrality where the
   slice touches it). Each check runs as a plain command whose exit status is read.
3. UX7 assembles **one bounded packet**: ≤ 10 JPEG captures in
   `prototypes/spatial-authoring/screens/experience-ux/`, plus a short verdict table.
4. Request owner visual acceptance of the packet and a hands-on pass. Automation does not accept UX; the
   owner's visual review is the gate, and it decides whether any further automated suite is warranted.

## 11. Deferred, not part of #114

- Deep Cue/scripting shell beyond the focused Card editor.
- Explicit hold consolidation beyond `Edit holds`.
- Removing a whole Cue. No writer exists; Undo is the remedy in #114.
- Dragging Cues on the Stage; the Card's Move is the move.
- Path smoothing/curve evaluation (a Camera evaluator decision).
- Marker placement at arbitrary progress.
- Dense-constellation clustering beyond deterministic stacking and same-View pin groups.
- Journey Deck label collision layout for Cues closer than their labels.
- Stop-chip and visitor-choice thumbnails from the image pass (PLATE's optional entry-View image).
- Arrow-key roving within Deck lanes, and a narrow-width Index spine for Camera Path/Journey.
- Multi-select Present.
- Mid-Guide Preview entry (deferred past #114; UX6/UX7 reports the late-Journey edit → Preview → return loop cost instead).
- Independent observer/lens Camera storage.
- Production cutover and persisted Experience format.
- Paper (PR #115), including the World status-rail controls that still show in the Experience lens.

## 12. Owner calls

None is open. The owner's 2026-10-12 review settled these:

1. **Camera Path entry framing follows PLATE.** The prototype flew into a Plan framing of the route on
   `Edit Camera Path` and on every Journey → Path switch. That behavior predates the lock and was part of
   C9 when MP3/MP4 were accepted for functionality, but PLATE §0.8.1 says opening the posture does not move
   the authoring view and switching changes no Camera. Entry and switching now keep the standpoint,
   `Bring route into view` frames on request, and the posture's return works as in the §5.5 table. Going
   back to the C9 auto-framing would mean restoring `bringIntoView()` in `editRoute()` and amending
   PLATE's sentence.
2. **The Guide overflow policy** in §5.4 (one row that scrolls, chips shrinking first) was endorsed with
   the rest of the conformance revision.

The review's four code reconciliations are implementation-level and conflict with no ratified semantics:
the selection owner and close rule (§3.1), insertion order (§3.2), the Deck focus helper (§5.4) and the
posture's return (§5.5).

[plate-081]: ../../../../reference/design-system/editor-shell-and-visual-system.md#081-finalized-experience-shell-expression
[grammar]: ../../../../reference/design-system/spatial-instrument-grammar.md#camera-routes-and-experience-coordination-projections
[boards]: ../../../../reference/design-system/editor-shell-and-visual-system.md#experience-qa-boards
[c9-proof]: ../../../../../prototypes/spatial-authoring/qa/EXPERIENCE-C9-EVIDENCE.md
[prototype]: ../../../../../prototypes/spatial-authoring/README.md
[paper]: ../../../p26-spatial-depth/design/paper-authoring-prototype/implementation-plan.md
