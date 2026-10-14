# PR #114 — Experience UX V3 superseding implementation plan

**Status: SUPERSEDED / INACTIVE (2026-10-13, #114).** The owner accepted
[Conservatory Round 2](../../experience-ux-alternative/README.md).
[PLATE](../../../docs/reference/design-system/editor-shell-and-visual-system.md)
owns the promoted unified shell and Experience authoring/UX acceptance.
This UX3/V3 package, standalone plan and generated PNGs are retained rationale
and Git provenance; none is an active design or implementation instruction.
Do not execute V3-A–V3-F or resume UX7. Next work is
[#115 parallel-track planning](../../../docs/roadmap/README.md).

**Original proposal/audit follows as historical text.** Earlier “active”,
“canonical”, pending-ratification and PNG-acceptance statements below describe
the superseded commission; they do not reopen current design acceptance.

**Status: proposed, implementation gated on owner ratification (2026-10-13).**
This is the **single replacement plan entry** for the Experience work on
`prototype-v2-ux-overhaul`. It supersedes the pending direction of the
[former UX0–UX7 plan](../../spatial-authoring/plans/unified-design-reconciliation/implementation-plan.md).
Prior accepted functionality/evidence remains history. Approval of this design
package should explicitly accept its product decisions and authorize these
prototype slices; creation of the package itself authorizes no application work.

Read the [product proposal](./README.md), then the affected
[design specification](./design-system.md) and [board notes](../README.md).
Use [verified implementation evidence](./implementation-evidence.md) for source
anchors, and [decisions/risks](./decisions-and-risks.md) for ratification scope.
No additional research round or historical QA reconstruction is a prerequisite.

## 1. Baseline and delivery boundary

The inspected remote/local head is
`de41341e82f4a745abe85537c59a217c160c60f3` on PR
[#114](https://github.com/Biskiq/spatial-sketch-editor/pull/114).
The latest UX4–UX6 follow-up corrected five findings and recorded Node 148/148
and 26 serial browser axes. Those are existing evidence, not checks rerun for V3.
UX7 remains unstarted. The [latest screenshots](../../spatial-authoring/screens/experience-ux456)
are implementation captures; V3 PNGs are proposed design specimens.

**All slices below can remain on #114.** Retain its plain ESM/DOM prototype,
vendored renderer, current authored sources/history and Camera evaluation. No
framework rewrite, new npm workspace, production `apps/` or `packages/` changes,
Paper authoring, PR merge, slice closure, multi-Guide manager or production schema
work belongs here. The meaningful new work is Stop-local source/runtime support;
it is not merely recoloring UX1–UX6. A separate follow-up is warranted for Paper,
advanced Cue/branch authoring and production F/T interfaces, not for V3's core
workflow. Do not implement through a second prototype executable.

## 2. Final interaction architecture

| Home | Responsibility | Session behavior |
|---|---|---|
| Head | Project, World/Experience, history, one Preview | Stable across authoring; truthful session/save signal |
| Index | Available Presentations, search, Guide task door, creation | No property forms; independently collapsible |
| Stage | World, true View observers, selected movement and rig | Selection/disclosure does not navigate |
| Card | Canonical subject identity + named task target | Available Views differs from local Stop slots |
| Guide ribbon | Stop order and resolved outgoing transitions | Direct reorder; collapse; selected Stop, no second editor |
| Movement task | Cut/Travel, route shape, compact play/scrub/Follow | No Path/Journey workspace split or straightened topology lane |
| Visitor runtime | Guided local sequence or independent free inventory | Isolated source/session; exact authoring return |

At desktop use 208 px Index, flexible Stage and 304 px Card; initial empty
projects omit Card. At 1024 use 64 px locator and 288 px Card. At 768 use one
invoked support sheet, full Stage and compact lower instrument. Keep ruler/axis
clear. Tokens/metrics are specified in the design system; no arbitrary component
CSS or inherited shell table overrides it. Changes are Experience-scoped until
another approved scope adopts them into World.

Canonical selection remains Presentation, View-use, Stop or Scene subject.
Invoked movement, point or playback is session task focus under its owner; the
Card keeps the Stop's identity header. Guide overview is an explicit task context
with summary, not a fake selected first Stop. One session context stack records
origin crumbs for View, source Presentation, Stop, transition and playback.
Back pops context without Undo or Camera motion. Inspect/Follow owns a separate,
single return token and a persistent displacement exit. Preview captures both.

Gate the one active displacement control home: View inspection has Stage Exit
and a read-only Card status; an open player owns Follow, with read-only Stage
status. Leaving the player pauses it and rehosts Stop following to Stage if still
displaced. Back never silently returns Camera or leaves a hidden player running.

## 3. Prototype-local source and runtime design

This is a **proposed prototype shape**, to implement with its first consumer after
ratification. It is not a production Experience codec, F amendment or persisted
format number. Existing authored fields remain valid until explicit conversion.

### 3.1 Stable View slots

Keep Camera Views in `cameraSource.views` and Presentation uses in
`experience.uses` / `Presentation.uses`. Add a V3 sequence on a Stop and a stable
slot table owned by Experience; equivalent normalized shape is acceptable:

```ts
type StopSequence = {
  kind: 'view-sequence';
  slotIds: StopViewSlotId[];
  end: 'wait-for-next';
};
type StopViewSlot = {
  id: StopViewSlotId;
  stopId: StopId;
  useId: ViewUseId;       // references Presentation membership, not copied pose
  dwellSeconds: number;  // finite 0..60; default 4 for new V3 slots
};
type LocalMovement = {
  guideId: GuideId;
  stopId: StopId;
  fromSlotId: StopViewSlotId;
  toSlotId: StopViewSlotId;
  mode: 'cut' | 'travel';
  connectionId?: CameraConnectionId;
};
```

Generate stable slot IDs through the existing deterministic ID allocator; never
use list indexes or View names as identity. Validate the owning Stop/Presentation,
membership, resolvable Camera reference, finite dwell and adjacency. Unresolved
authored references stay named and repairable. Execution/Preview must validate
required references; repair is not “keep viewpoint.” New creation requires a
first View; authoring an imported broken Stop must not destroy its identity.
For V3 removal operations, removing a Presentation preserves its Stop identities
as named unresolved references; removing a use preserves affected slot identity
for repair. Adapt the prototype's current destructive `removePresentation`
shortcut rather than treating it as the destination contract. Shared Camera truth
is never implicitly deleted by unlinking Experience membership.

V3 UI permits each available use once per Stop. Runtime addressing should not
assume `useId === slotId`; future repeated local uses remain possible. Same
Presentation in two Stops gets two slot sets and independent dwell. Setting
Presentation Default does not mutate either. Capturing a new available View does
not append it to any Stop. Local reorder changes the first-slot entry only.

Add prototype Guide metadata `{ id, name, execution: 'legacy' | 'view-sequence' }`.
Absent metadata is read as **legacy** without mutating source; new empty Guide
creation explicitly records `view-sequence`. A V3 Guide validates that every
ordered Stop has a sequence. Mixed modes are invalid and do not execute as V3.
Convert the entire Guide atomically, or preserve the entire Guide as legacy.
**Add to Guide** on legacy source opens conversion review before any V3 Stop is
created; refusal/cancellation changes no source. This discriminator belongs to
Experience, not a renderer/session guess from whichever Stop is selected.

Keep **one** Guide-order writer. For this prototype, the existing `experience.guide`
array can remain the canonical order behind an `activeGuide(guideId)` adapter,
with stable Guide identity/name metadata added at the first consumer. All new
slot/transition/runtime addressing accepts Guide identity. Do not add a writable
`guides[].order` beside the old array or freeze the production model to one Guide.
A later collection migration replaces the adapter/source encoding explicitly.

### 3.2 Movement context and invalidation

Local transition keys use `(Guide, Stop, from slot, to slot)`. Inter-Stop keys keep
the stable resolved Stop pair, with nominal endpoints derived from last/first
slots. They are **not** positional Guide adjacency IDs. Empty/unwritten movement
defaults to Cut; choosing Travel invokes explicit preparation and records a
Camera connection reference/support. Do not overload existing Stop→Stop
`seamKey` for an internal View step.

After slot/Stop reorder, only actually adjacent/resolved pairs execute. Retain
former authored Travel/event data for repair/Undo; do not retarget it by array
position. Newly adjacent pairs default to Cut until an explicit Travel operation.
If an existing transition's referenced View changes, revalidate its support and
show “Movement needs review” rather than silently replacing the route. Camera
endpoints remain generated from their Views; no slot serializes endpoint poses.

Only selected movement is drawn. Reuse `routeGeometry`, station progress and
nearest-segment insertion; draw the actual evaluator's geometry. Point edits use
the current reach/Ask operation and aggregate Undo. A structural removal may
orphan retained legacy events; name them and mark affected execution as requiring
repair. Do not invent “safe removal” that silently deletes event source.

### 3.3 Guided sequence execution

Add a visitor session context with Guide ID, Stop ID, stable current slot ID,
local hold elapsed, autoplay preference, running/wait phase and current transition invocation. New Stop
entry creates a fresh visit/run; local View changes preserve that visit. The
current Presentation suggestion `viewOrder`/`orderedViews` cannot serve this
cursor because it appends/de-duplicates the entire available inventory.

| Trigger | Required operation |
|---|---|
| Start guided tour | Enter first Stop/first slot; start bounded local autoplay |
| Hold completes | Request adjacent slot through its explicit Cut/Travel; enter next hold |
| Final slot hold completes | Pause automatic progression; remain at final framing awaiting Next |
| Named local View / previous-next View control | Pause autoplay/reset hold. Only settled forward adjacency uses authored local movement. Backward/nonadjacent or any in-flight selection cancels current movement and Cuts to the requested slot; no reverse path traversal |
| Pause | Freeze local Experience time mapping and Camera evaluation consistently |
| Main Next after last slot has settled | Resolve next Stop by Guide order; use authored inter-Stop movement |
| Main Next before final arrival | Cancel local movement/queue; skip remaining slots using explicit V3 Cut interruption policy; fresh next Stop visit |
| Previous stop | Cancel playback/queue, Cut to previous Stop first slot with fresh visit identity, initially paused; control absent/disabled on first Stop |
| Click Finish on final Stop | Finish; offer free exploration or restart. Final dwell completion itself remains paused/waiting |

User Play/Pause preference persists across normal Next; final-frame waiting stops
the run without changing that preference. Manual View selection/Previous stop
sets preference to paused. Play at a completed Stop is **Replay Views**: Cut to
first slot, reset local hold/cursor, preserve the current visit and restart its
sequence. Editor playback at end restarts its read-only playhead at zero.

The UI labels interrupted progression **Next now · destination**, and the
movement summary says **After the last View · Travel; skipping uses Cut**.
This proposed bounded rule replaces live-origin coverage requirements **only for
converted V3 Guide execution**. Legacy visitors still use their existing
`travelInvocation` / live-origin evaluator. If V3 instead reused existing all-origin
Travel, it would need explicit coverage for every selectable/in-flight origin;
it must never use the final slot's path from an unrelated current View.

Scrub/Play of a Stop derive one sequence schedule: holds plus Camera movement
durations, zero movement duration for Cut. Add no independent pose/FOV tween.
Use `movementTiming`/`journeyClock` for each transition and a thin ordered
composition over them. A whole-Stop player is **new composition work**; existing
rehearsal covers one nominal Journey, so merely relabeling it is insufficient.
Read-only rehearsal invokes no Activity. Editing geometry pauses/recomputes the
playhead by stable context; do not run stale evaluated samples after source changes.

### 3.4 Free exploration and Preview

Create a real independent free visitor context, not a visual toggle on the existing
Stop. No Guide cursor or forced Stop-local autoplay. Inventory contains all valid
Presentation uses. Switching Presentation enters its Default; a missing required
View is a named authoring repair state. Selecting a View can use an explicit direct
Camera Path if chosen/available under the runtime request; otherwise Cut. No
shortest-path traversal of unrelated graph connections or implicit route creation.

Preview entry chooses guided/free when a valid Guide exists, free directly when
none exists. Preserve the existing cloned sources/audition cleanup and extend
captured return with new task/slot/disclosure/inspection state. Prototype writer
guards remain required. They are **behavioral isolation**, not proof of visitor
bundle isolation: production visitor imports stay governed by existing tests and
public routes, outside this prototype implementation.

## 4. Compatibility without hidden rewrites

| Existing authored state | Treatment |
|---|---|
| Guide with legacy/absent execution metadata | Legacy adapter uses every Stop's existing Entry/Next/pacing/Gate/choices exactly; visible “Existing visit rules” notice; no mixed V3 slot execution |
| Entry follows Presentation Default | Explicit conversion freezes the currently resolved use; preview the behavior change; refuse missing target |
| Specific entry/private detached use | Preserve Camera/use identity; conversion needs explicit membership reconciliation rather than silently adding it to public free inventory |
| Keep current viewpoint | Preserve legacy policy; new fixed View sequence needs explicit Capture/Choose View; no fabricated entry |
| Explicit Next / End before final order position | Show actual destination/End on the outgoing chip; no false adjacent connector. Linear Guide conversion lists every override and requires explicit consent to return to order |
| Existing `viewOrder` / automatic switching | Preserve legacy behavior; do not reinterpret as Stop-local membership or copy all available Views |
| Holds, Gates, choices, invocations, detours | Preserve source and existing legacy execution; show effect in compatibility summary. Do not silently bypass them in a new V3 runtime |
| Travel/events whose context changes | Preserve originals; executable required support must resolve; no inferred station/connection rebinding |

Implement **Review conversion** as one concrete change summary and one atomic
command for the **whole Guide**, with Cancel and Undo. The first supported converter targets simple
Guide source: every Stop has resolvable entry, order continuation, no conflicting advanced
automatic switching/Gates/branches/events. It may convert explicit Next only when
the owner deliberately chooses the listed return-to-order changes. It refuses
unsupported combinations while preserving them and offers **Keep existing visit**.
This is a valid cutoff: fresh V3 source proves the new workflow; the prototype
does not promise migration of every advanced authored example.

Legacy Guide reordering must keep explicit continuations drawn truthfully. Do
not label it a linear V3 Guide or conceal those continuations. Hiding advanced
writers never authorizes deleting payloads. Retain legacy preview/review routing
as compatibility depth, not the primary demonstration. No automatic startup,
fixture-load, selection or Preview operation converts authored data. Conversion,
Travel preparation and framing edits use the existing compound source history.

## 5. Verified implementation targets

Paths below are within [the unified executable](../../spatial-authoring/README.md).
Inspect exact current callers before editing; the evidence doc supplies symbols.

| Area | Retain / adapt / replace |
|---|---|
| `app/experience-model.js` | Retain Presentation/use/Camera IDs and Stop identity; add slots, contextual transition helpers, validation, reach/removal/conversion; adapt one Guide-order reader |
| `app/experience-runtime.js` | Retain visit/run/Camera request path and legacy semantics; add guided slot cursor, final wait, explicit skip and independent free context |
| `app/experience-coordination.js` | Retain Camera time mapping; add stable local transition context and bounded Stop composition, no new evaluator |
| `app/experience.js` | Reuse `command`, `commitPresent`, capture/reach/framing, Travel preparation and rehearsal; adapt creation labels, slot commands, one movement task, inspection token/Follow and Preview return |
| `app/experience-ui.js` | Replace ordinary Cards, Guide reordering popover, From inventory, topology/time Deck and primary capability/Cue editors with specified homes; retain compatibility readers/writers as bounded depth |
| `app/experience-draw.js` | Replace compressed constellation/Stop pins with projected Camera observers; draw only selected movement, actual points and evaluated rig |
| `app/experience-image.js` | Retain bounded neutral preview pass; add slot/scene-revision consumers without rendering per-frame thumbnail walls |
| `app/navigation.js`, `app/camera-evaluation.js` | Retain Camera realization, route/station evaluator and return foundation; adapt one displacement owner only where required |
| `app/state.js`, `app/actions.js`, `app/tasks.js` | Retain one selection, chronological compound history and cancellation; add session context/revalidation, never serialize task/return state |
| `app/main.js`, `app/ui.js`, `index.html`, `styles/app.css` | Wire new homes and Experience-scoped tokens/layout; pointer/focus/keyboard ownership; World shell stays its approved scope |
| `app/experience-walkthrough.js`, examples/fixtures | Repoint primary demonstration to fresh V3 creator jobs; preserve old examples as compatibility evidence, never use Presenter as usability proof |
| `tests/experience-*.test.mjs`, `qa/experience-shell-check.sh`, affected visitor/continuity recipes | Replace obsolete exposure assertions; retain high-value semantics, add focused slot/interrupt/return checks at their new owner |

Do not delete tests simply because their old control moved. Repoint valuable
semantics to the new operation. Retire assertions specifically enforcing removed
surface taxonomy (topology Deck, compressed satellites, broad Cue writer/From
lists), recording why V3 replaces their product requirement. The selector
inventory is a starting map, not authority over current code.

## 6. Implementation slices with meaningful exits

These boundaries follow new source/runtime dependencies, not the former UX labels.

| Slice / depends on | Concrete work | Completion evidence |
|---|---|---|
| **V3-A — source boundary and compatibility** / ratification | Stable Guide addressing, Stop slots/local movement validity, fixed seed, one order writer, converter/review summary and legacy adapter. Fresh V3 fixture with repeated Presentation and omitted View. | Two Stops share Camera references but differ in slot order/dwell; Default change leaves sequences; converter Cancel/Undo preserves legacy explicit Next/advanced source; named unresolved use survives. Focused model/history checks. |
| **V3-B — creator composition and truthful Views** / A | Scoped tokens/adaptive shell, empty invitation, unified creation, Presentation/View Cards, capture/adjust, projected observer markers, persistent inspection exit/context stack. | Creator makes two Presentations and three Views through ordinary controls; selecting moves no Camera; switch Look-through Views then Exit returns initial standpoint; panel collapse and Back preserve source/Camera. Boards 01–04. |
| **V3-C — curate occurrences directly** / A+B | Guide ribbon/collapse, direct Stop reorder + keyboard alternative, Stop-local add/reorder/dwell, source link and Next summary; real marker projection. | Repeat same Presentation as second Stop; local order changes only that occurrence; omitted View remains available; reorder revalidates movement and never rewrites explicit legacy Next. Boards 05–07 + 14. |
| **V3-D — one movement instrument** / A+C | Cut/Travel preparation, intra-/inter-Stop contexts, shared path disclosure, Stage point edits, compact path instrument and parent Back. | Cut creates no Camera connection; Travel reuses/prepares only direct support; ordinary click adds nothing; one point gesture is one Undo; no duplicated topology lane or Camera controller. Boards 08 + 15. |
| **V3-E — timed local playback and return** / A+C+D | Slot cursor, hold/adjacent movement scheduling, Stop and movement Play/Pause/scrub, rig, explicit Follow, final wait/early skip. | Whole Stop schedule matches Camera mapping/holds; selecting pager pauses; early Next Cuts explicitly; final Next Travels correctly; Follow exit restores initial author pose; rehearsal executes no actions and writes nothing. Boards 09–10. |
| **V3-F — real visitor proof and visual verdict** / B–E | Guided/free entry and runtime contexts, curated pager/main Next distinction, finish/free browsing, full Preview return, keyboard/narrow fit and compact capture packet. | One uninterrupted ordinary creator scenario builds/reorders/moves/plays/previews; guided omissions do not hide free Views; no editor hits or writers in Preview; complete return/Undo. Boards 11–13; explicit owner product/visual verdict. |

At each exit record changed scope, focused checks, actual screenshots and unrun
checks. A builder may adapt the file split without another research cycle if
the interfaces/ownership and completion evidence remain the same. If source
validity requires a larger change, report it before expanding beyond this scope.

## 7. Acceptance and verification budget

This is a product-validation prototype. Keep the owner-ratified lightweight
verification policy: changed high-value semantics, a real browser creator smoke,
and representative complete-window screenshots. No automatic mutation chains,
full-axis sweeps or speculative production edge-case matrices. Repository-level
checks still follow the [test contract](../../../apps/editor/tests/README.md)
when implementation actually changes repository code; local scope cannot waive it.

Use this **one acceptance script** through product controls, without Presenter:

1. Empty Experience → New Presentation from current museum composition.
2. Present this on Machine → capture Overview, Inside and Output; inspect two
   Views and Exit; verify initial author standpoint return.
3. Add the Presentation twice to Guide; second occurrence chooses different
   local membership/order/dwell. Change Default; both occurrences stay fixed.
4. Add Materials, drag it between occurrences and use Move later by keyboard;
   Undo returns the prior order. Inspect actual Next and movement validity.
5. Choose one internal Travel and one inter-Stop Travel; edit one point and Undo;
   Play/Pause/scrub/Follow then restore author standpoint.
6. Preview guided: View pager and main Next differ; final View waits; early Next
   explicitly skips with Cut. Finish. Preview free: Output is available despite
   omission from a Stop; no automatic unrelated routing.
7. Exit Preview returns to the exact task/selection/disclosure/Camera; Undo one
   source edit still targets the same chronological authored operation.

Focused semantic checks must distinguish: shared Default vs fixed slot, repeated
Stop identities, unresolved vs intentional hold, stable transition adjacency,
atomic conversion/capture/Travel, early skip vs normal final Travel, source-neutral
inspection/scrub/Preview and isolation. Reuse current tests where those semantics
are already covered; add new ones only for actual new state/behavior.

Compare 1440×900 full compositions for Presentation, Stop, movement, playback and
visitor; 1024 Stop and 768 movement cover the meaningful narrow constraints.
Compare information homes, Stage allocation, ruler clearance, density, selection
vs task, truthful observers and approachable verbs. Pixel diffs of incidental
geometry, fonts or lighting do not accept the product. Record visual mismatches
with a specific board/rule and fix them; do not replace the target with screenshots
of an implementation that happened to pass a test.

The final owner review receives a small capture gallery and a short verdict:
what conforms, any intentional deviation, the creator scenario result and remaining
limits. Owner acceptance is requested once at the integrated product boundary.
No slice-closeout or major-phase closure follows automatically.
