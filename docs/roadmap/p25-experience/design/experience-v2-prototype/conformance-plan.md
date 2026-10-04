# Experience V2 prototype conformance — replacement implementation plan

**Status: C1–C8 in-scope conformance complete, 2026-10-04; independent external review pending.**
Current recipes, six-state visual verdicts, frozen-source gates and the external repository blocker →
[new conformance acceptance][conformance-acceptance]. No merge-readiness or phase-close claim.
External manual review exposed model/workflow gaps outside that acceptance boundary.
The additional [C9 authoring-completeness plan](./authoring-completeness-plan.md)
reconciles actual Prototype 4.1 behavior with these shell/domain gains. The revised
plan is ready for implementation; Travel preparation/live invocation and fresh
repeated-Stop visits are owner-ratified C9 decisions. C9 replaces the ordinary
per-origin Connect/departure-wait requirements and final exhaustive specimen
re-verdict with capability-first proof plus blocking structural seams. Earlier
C1–C8 proof remains valid for its tested contract, not a complete Experience parity
claim. This docs-only revision authorizes no C9 implementation.
Prepared 2026-10-03 at
`99dd7ebfca55f68775dbf26bcdb455111b17e669` on `prototype-v2`, initially clean.
This is a standalone replacement for future #113 implementation and acceptance,
not additional S10+ work. The [S0–S9 plan](./implementation-plan.md) and
[acceptance record][old-acceptance] remain unchanged historical evidence; their
completion labels confer no acceptance under this plan. The original planning request authorized no implementation. The owner resumption on 2026-10-04 authorizes C8 completion, coherent commits and push to
the existing #113 branch. PR merge/closure, major-phase closure, Paper and production work
remain outside this authorization.

**Outcome:** the single [spatial-authoring executable][prototype] genuinely
conforms to the finalized V2 behavior **and** compositions. Another implementer
must be able to execute the slices below and produce six independently
reviewable canonical states through product interactions. A passing model suite,
correctly named screenshot or inventory of controls is insufficient.

## 1. Authority, boundaries and evidence

[PLATE][plate] is the complete soft-frozen shell authority: shared landmarks,
World/Experience expression, lower-surface span, material/state grammar and return.
The [spatial-instrument grammar][instruments] owns truthful Stage representation,
helpers/grips, precision feedback and linked spatial/temporal visual semantics.
Use these references directly; compliance does not require recovering missing rules
from a historical design round.

The [final V2 synthesis][v2] and original [Design-QAs][boards] retain primary design
evidence and strong composition specimens. The [final World synthesis][world-synthesis]
and its 10-board [QA package][world-qa] calibrate shared-shell continuity. They add no
Experience canonical states beyond QA-1–QA-6. Compare information homes, relative
rank and truthful relationships, not incidental raster dimensions or drawing methods.
Material source disagreement must be resolved against accepted design evidence and
the authority for that concern; a specimen does not silently amend a live contract.

World Instrument procedure and Experience Deck editorial work share a lower-surface
grammar, not task semantics. Breadth follows information structure under PLATE's
admission rule. World Paper's Card, rail and drafting decisions do not redefine
Experience's Card/Deck or authorize Paper implementation in these slices.
[Architecture][architecture], [F][foundation] and the repository hard rules own
domain boundaries. Prototype mechanisms establish no production format.

The executable remains native ESM/DOM with one shared Stage in
`prototypes/spatial-authoring/`. Retain the accepted World fixture, compiler and
A–F behavior; the [donor][donor] remains runnable. No alternate application,
iframe, renderer, architecture reconstruction, production migration, general
route search/collision planner, general scheduler or media platform is introduced.
Paper PA0–PA12 remains the subsequent [Paper adoption plan][paper]. It does not
absorb missing Experience shell, Set, route, coordination or precision behavior.

### Inspection baseline and proof limits

Planning-audit baseline (pre-C1–C7): the bullets below record what the
planning audit observed before replacement implementation. Current
implementation and evidence live in the active
[conformance acceptance][conformance-acceptance]
and current captures; the §2 corrections remain the standing obligations.

- Read PLATE §§0.8–0.8.2, the complete relevant V2 requirements and canonical
  state descriptions, all eight original boards, the old plan/acceptance,
  current rendering/interaction/navigation code, QA harness and six saved specimens.
- Re-ran the current reconciliation browser axis on this checkout: **17/17**.
  It generated fresh captures in temporary output without replacing checked-in
  evidence. Prototype model/runtime tests: **34/34**. Neither establishes visual
  acceptance; several failures below survive both suites.
- A separate owned-browser probe used the example loader and real Card controls:
  adding a repeated Stop then accepting a Meaning edit with Enter immediately
  changed shared source and added one Undo entry with no scope question. Three
  numbered overview pins had exactly the same rendered rectangle.
- After Through → World → explicit Plan → Experience → Resume, live state was
  Plan (`flat=1`, elevation π/2), while the precise surface still said Through.
  Explicit Outside after Through also retained the through-View pose; source
  inspection confirms `posture('outside')` changes only its label.
- Current captures use `reconciliation-check.sh`, which directly resets examples,
  changes navigation pose, captures framing and adds an anchor through test APIs.
  They do not prove all six states are reachable through product controls.
- The old record's missing P23B fixture remains absent. Its reported broad-suite
  failures were not reclassified as V2 failures or re-run during this audit.
  Final implementation verification must report it separately if still unresolved.
- The planning documentation scan found no new broken references; its two
  findings are existing references to that absent fixture in the old checkpoint
  and acceptance record. Those historical files were not changed to hide them.

### Board map — eight artifacts, six canonical states

All eight boards were visually inspected. Names below identify evidence, not
state assertions. The extra boards strengthen the six-state contract.

| Board | Use in this plan |
|---|---|
| [Museum Piano Hall Tour Editor][b1] | QA-1: dominant 3D Stage, spatial View constellation, quiet vertical Card, optional Peek |
| [Museum Tour Planner Interface][b2] | QA-2: spatial numbered Stops and L0/L1 occurrence overview |
| [Museum Guide Planning Dashboard][b3] | QA-3: L2 occurrence, shared Set on Stage and in Deck, local/shared Card strata |
| [Museum Floorplan Route Editor][b4] | QA-4: useful Plan, scoped multi-origin route, View/entry glyphs, authored anchors, gap, two bookends |
| [Museum Hall Tour Dashboard Mockup][b5] | QA-5: same route with spatial/temporal station correspondence, beats and holds |
| [Under the Lid: Hall Tour Editor][b6] | QA-6 primary: Through framing gate, active grip/tape, return, editor chrome |
| [Museum Camera View Editor][b6-outside] | QA-6 companion: Outside observer, frustum/target relationship and posture controls |
| [Museum Tour Editor Interface][b-ask] | QA-3/QA-6 companion: repeated meaning, explicit scope decision and entry specialization |

## 2. State-by-state reconciliation

These are acceptance obligations, including the route into each state. The current
screens are linked so a successor can compare rather than trust their names.
Different subject names and simpler fixture geometry are permitted; missing
spatial relationships, hierarchy or disclosure are not.
**Planning-audit baseline:** each state's `Planning-audit baseline` paragraph
below preserves the pre-C1–C7 executable finding as provenance. Current
implementation and evidence live in the active
[conformance acceptance][conformance-acceptance]
and current captures.

### QA-1 — ordinary Presentation

**Written requirement →** [PLATE Experience expression][plate-experience] and
[spatial-instrument grammar][instruments]: 3D Stage and working
Presentation's unordered Set; quiet Meaning/Focus/Show Card; no Guide means no
rail, otherwise Peek only; no advanced Camera machinery until invoked. Preview
works without a Guide or authored Camera graph.

**Original board →** [QA-1 board][b1] puts distinct cyan View positions and viewing
directions around a recognizable focus, within a dominant dark spatial Stage.
The vertical Card summarizes meaning and View uses rather than presenting every
use as a settings form. Peek is a thin location rail.

**Planning-audit baseline (pre-C1–C7 executable) →** [ordinary capture][q1] has the correct 3D shell and no
Guide, but the remote whole-building framing leaves the working Set invisible.
`drawExperience()` draws only eye-position text chips; there are no View glyphs,
focus links or robust offscreen/overlap handling. `setHtml()` exposes Hints,
Precise, cue and role controls for every View in the ordinary Card, pushing
ordinary actions below its initial viewport. All verbs share a dark primary fill.
`autoView()` persists a Camera View immediately, conflating derived Auto with
explicit Capture. The old plan specified unordered data more clearly than its
spatial/disclosure expression.

**Required correction →** C2/C3/C7. Use a useful, explicitly reached 3D reading;
show the local Set with observer/direction/focus relationships and role labels,
without order edges. Make Meaning/Focus/Show and Add behavior the low-floor Card;
invoke use details and Camera depth on demand. Auto/Hints remain derived intent
until explicit Capture; preserve no-View Preview. Entry and choice roles remain
Experience-owned. Capture creates one Camera View plus its use atomically.

**Product journey / proof →** Reset → Experience → explicitly select subject and
Present this → edit Meaning → Auto/Hints → Capture distinct useful Views through
navigation/framing controls → ordinary state. No hidden pose injection. Capture
the primary no-Guide case and a companion with an existing Guide at Peek. Verify
same Set identity/roles in Plan and 3D, no Stops/edges from coexistence, and no
Camera move merely from selection or lens switching. Explicit Bring into view
may establish the specimen's useful framing; it is not a side effect of opening.

### QA-2 — Guide overview

**Written requirement →** [PLATE Deck and Guide density][plate-experience]: Peek
deliberately expands to broad Overview with L0 identity/position, L1 thumbnail,
title/entry/warning, active context and distant compression. Selection does not
force L2. Stage is
Plan or a useful spatial overview with numbered entry pins only, no facing
glyphs, no Camera graph. Repeated Presentations remain distinct occurrences.

**Original board →** [overview board][b2] uses a broad, shallow bottom Deck with
small distant cards and larger nearby summaries, while spatial numbered pins
remain readable. Card and Index keep their established landmarks.

**Planning-audit baseline (pre-C1–C7 executable) →** [overview capture][q2] uses a two-Stop example, proving
neither distant density nor repeated occurrences. Both Stops share a target, so
their pins overlap exactly. The current Peek is a centered count/Overview button,
not occurrence awareness. Density classes exist but the specimen lacks the
entry summaries, thumbnails and range of occurrences that test the composition.
Card remains a dense Presentation editor because opening overview preserves its
canonical selection; selection must not be silently changed to imitate a board.

**Required correction →** C3/C4. Implement meaningful Peek occurrence/current
position cues, L0/L1 density, usable selected-occurrence emphasis and concise
entry/warning summaries. Use several spatially distributed occurrences and at
least one repeated Presentation. Co-located occurrences must remain distinguishable
and reachable while preserving their true spatial meaning; the disambiguation
mechanism is an implementation choice. Do not invent a facing glyph or topology
in overview.

**Product journey / proof →** Add the first Stop (Peek only), add further Stops
including reuse, explicitly request Plan/useful overview, expand Peek. Select a
Stop explicitly for the selected variant. Verify each occurrence can be selected
from Deck and Stage, reorder changes only Experience order, Camera source is
unchanged, and expanded depth is not forced by simply opening the Guide.

### QA-3 — expanded occurrence

**Written requirement →** [PLATE Set, Deck and Card rules][plate-experience]: one
explicitly expanded Stop at L2; Presentation summary,
explicit entry and full unordered constellation on Stage **and schematically in
the occurrence**; shared meaning versus this Stop's use remains legible.

**Original board →** [expanded board][b3] keeps the active occurrence broad and
readable, surrounding Stops compressed, with a miniature spatial constellation
rather than a View filmstrip. [Scope companion][b-ask] makes repeated meaning and
the proposed shared edit unmistakable without moving the Card.

**Planning-audit baseline (pre-C1–C7 executable) →** [occurrence capture][q3] labels ownership correctly but
duplicates the same large per-View settings forms in Card and Deck. The expanded
card is internally clipped/scrolling; no schematic constellation is present.
Stage text chips overlap around nearly identical Views. Meaning editing calls
`updatePresentation()` directly, without Ask Rule when used by repeated Stops.

**Required correction →** C3/C4. Build an L2 summary/constellation distinct from
the detailed property editor. Keep canonical Stop identity in Card; name the
shared Presentation, its reuse, entry and local controls in clear strata. Ask
before broader edits, including shared meaning and Set roles, not only framing.
Offer shared update and Cancel where those are the only supported operations;
the board's “different story here” does not authorize a general Presentation fork.
Supported Stop-entry specialization stays explicit, atomic and undoable.

**Product journey / proof →** QA-2 → expand a repeated occurrence. Select each
View from either spatial or schematic Set. Change local entry without changing
shared meaning; propose shared Meaning, cancel, then explicitly accept. Assert
affected occurrences, one accepted history step, zero on cancellation, unchanged
Camera on selection, and an unclipped L2 constellation at the reference viewport.

### QA-4 — Seam route authoring

**Written requirement →** [PLATE Seam triptych][plate-experience] and
[route instrument grammar][instruments]: explicit route editing requests Plan
with return; unrelated occurrences compress around adjacent bookends, possible
origins, per-origin reach/gaps and destination entry;
visible Camera route and directly manipulable authored anchors; no coordination
strip yet. Opening Seam itself must preserve the existing pose/projection.

**Original board →** [route board][b4] makes spatial authoring the dominant
content: multiple labeled origin Views, destination View, supported paths, an
honest gap, solid authored diamonds versus derived markers, Camera color and
local pace/status. Narrow side context and the bottom instrument support it.

**Planning-audit baseline (pre-C1–C7 executable) →** [route capture][q4] is nominally Plan but mostly empty
paper around a small World plan. It shows a short brown dashed target line and
one diamond, with no origin/destination View glyphs or scoped spatial gap.
`drawExperience()` returns from its Seam branch before drawing any Views and
projects `path.target`, whereas Set positions use Camera eyes. This mismatch
cannot demonstrate a single navigable Camera route. Unrelated Stop context is
discarded from the Deck, and pace is available only through coordination.
The fixture shows 1/3 coverage, not the deliberate multi-origin proof.
`originCoverage()` also omits a detached Stop-specific entry use because it
enumerates only the shared Presentation Set. Existing Camera lines are drawn
even when the selected Seam's mode is Cut.

**Required correction →** C2/C5. Generate one Camera-owned route representation
for rendering, editing, estimates and execution, with explicit observer/target
semantics. Draw all scoped origin Views, destination entry and their actual
connectivity, authored interior anchors and derived endpoints/sample cues. Use
shapes/text as well as the Camera domain accent; do not draw a real edge for a gap
or Cut.
Retain bookends and compressed unrelated occurrence context. Put route pace and
status at normal Seam depth. Route editing can explicitly request useful Plan
framing and must expose canonical return; selection/Seam opening cannot do so.
Coverage must include every legitimate end-of-Stop View, including a specialized
entry and supported cue/choice Views; it must agree with runtime departure
resolution. A missing or intentionally held entry needs an honest unresolved or
not-applicable route state, not fabricated support. When Cut is selected, existing
Camera connectivity remains authored but is not painted as this Seam's travel.

**Product journey / proof →** QA-3 → open adjacent Seam while in 3D (prove zero
movement) → choose Travel → connect two of three legitimate origins through
controls → Edit route → manipulate interior anchor on Stage. Capture Plan with
2/3 reach and a visible third-origin gap before repairing it. Then repair only
that gap and prove 3/3 support. Cut creates no edge; unresolved Travel refuses
locally. Generated endpoints cannot be dragged/authored as interior anchors.

### QA-5 — local coordination

**Written requirement →** [PLATE local coordination][plate-experience] and
[linked instrument grammar][instruments]: the **same Seam and spatial route** as
QA-4, with invoked local strip inside the central triptych; common stable stations
and visible event/hold correspondence in both projections;
Camera route/pace versus Stop-local beats/holds; geometry edited only on Stage.
Existing coordination is disclosed when that Seam is reopened.

**Original board →** [coordination board][b5] retains Plan and the route, adds
quiet station ticks, distinct beat and hold lanes, and spatial/temporal selection
correspondence. The Card names the selected identity and local edit reach.

**Planning-audit baseline (pre-C1–C7 executable) →** [coordination capture][q5] adds dropdowns and text boxes,
not a temporal/station projection. Stage adds station labels but no visible beat
attachment; selector existence is the current QA's proxy for mirroring. Authored
anchor diamonds disappear outside route depth. Reopening a Seam with beats shows
a strip but resets `connection` to null, while Stage station drawing depends on
the separate coordination depth. The visible two projections can disagree.

**Required correction →** C5/C6. Keep the route and identifiable stations
visible; add a compact local distance/time reading with Camera orientation ticks,
Experience beat markers and duration holds. Selecting a station/beat highlights
its counterpart without replacing canonical selection merely for task focus.
An explicit Select may choose an authored beat; never invent selectable authored
identity for a generated sample. Reopening resolves the relevant connection or
asks which supported route to coordinate; never silently adopts the first route
when multiple choices have different beats. Saved coordination and its spatial
markers must disclose together. No path editing in the strip.

**Product journey / proof →** Continue QA-4 without changing pose, route, origins
or Camera source → Coordinate → bind a hold and supported contribution to stable
stations. Compare QA-4/5 side by side. Move an anchor on Stage, change Camera pace
with scope confirmation where shared, and show derived timing changes with stable
references. Reopen, test multiple origins/routes and delete a referenced station:
repair/refusal replaces silent rebinding. Execute only the traversed route's
beats; Cut executes none. Preview timing and displayed timing must agree.

### QA-6 — precise Camera

**Written requirement →** [PLATE progressive Camera precision][plate-experience]
and [Camera framing instrument grammar][instruments]: reachable directly from a View with no
Guide; Through preferred for the canonical specimen, recognizable editor chrome,
precise spatial grip, only active grip's value, Camera owner/reach and stable
Card. Outside/Through/Plan operate on the same View/route.

**Original board →** [Through board][b6] makes the image a framing instrument:
frame gate, target/horizon cues, active grip/tape, posture switch and return.
[Outside companion][b6-outside] shows the observer/frustum in spatial context.
The View Card remains on the right; there is no Guide Deck without Guide work.
The Outside circle is a specimen technique for the observer/framing relationship,
not a required orbit or fixed-distance constraint.

**Planning-audit baseline (pre-C1–C7 executable) →** [precision capture][q6] has editor chrome and one numeric
input, but places the precision form in a large bottom Deck and shows only a
`frameH` chip on the subject. No frame gate, observer/frustum or adequate framing
instrument is present. Outside is just a label change after Through; Through
resumes with a stale posture label after other-lens navigation. Closing precision
does not expose the board's canonical spatial return. Shared framing has a scope
question, but the Camera View and current-use distinction needs a clearer Card.

**Required correction →** C2/C3/C7. Provide a Stage-local framing instrument with
grips whose geometry matches their operation, plain labels for framing/aim/lens
values, and one active tape next to the grip. Keep context/scope in Card; Camera
depth alone must not instantiate a Guide Deck. All postures use the same Camera
owner and explicit navigation/return. Outside initially remains an allowed
experiment; QA-6 deliberately invokes Through. Neutral Resume reactivates work
at the current standpoint and truthfully reports its reading, with an explicit
Look through/Plan action when alignment is needed.

**Product journey / proof →** From a no-Guide Presentation select View → Precise
→ Through → activate and drag/enter one grip → scope decision. Capture with the
active tape and a useful image. Exercise Outside, Plan and Put it back; cancel a
live drag on Escape/lost capture/lens crossing. Preview hides every instrument,
then returns to the exact authoring context without source changes.

## 3. Material drift and dispositions

**D** implementation defect; **P** prior-plan underspecification or mistaken
constraint; **Q** evidence/QA defect; **V** intentional visual variance;
**F** genuinely deferred work. Multiple labels describe distinct causes, not an
excuse to downgrade a requirement.

| Finding / evidence anchor | Disposition and required result | Slice |
|---|---|---|
| Set as chips/forms; ordinary depth crowded; missing useful spatial Set (`experience-draw.js`, `setHtml`) | D/P/Q — spatial and schematic constellations, progressive controls and canonical QA-1/3 | C3/C4 |
| `button()` emits `.verb` for virtually everything; `.verb` is dark filled; Focus relation inherits caution colors | D/P — semantic action, selection, armed, focus, reference and refusal roles, not uniformly primary actions or false warnings | C3 |
| Two-Stop specimen, overlapping pins, no meaningful distant L0/L1 proof | D/Q — distinct occurrence access and adequate fixture; density architecture is required, while the Deck crop-docking mechanism remains experimental | C1/C4 |
| Target-polyline route; View endpoints/gaps absent; pace hidden behind Coordinate | D/P/Q — one readable scoped Camera route and normal route/pace depth | C2/C5 |
| `originCoverage` excludes detached Stop entry; Cut still renders route lines | D — coverage includes legitimate occurrence origins, agrees with execution, and Cut never implies traversal of stored connectivity | C2/C5 |
| Coordination is a form; reopening and multi-route context inconsistent | D/P/Q — actual mirrored projection, resolving context and preserved route | C6 |
| Precision occupies Deck without Guide, missing spatial rig/return, false posture labels | D/P/Q — Scale × Depth and neutral, truthful posture/return | C2/C7 |
| `updatePresentation`, role edits and anchor drags bypass scope confirmation; only framing/pace partly ask | D/P — determine reach before every broader source edit, stage proposal then explicitly accept; no unsupported fork options | C3/C5/C7 |
| `autoView()` calls authored `addView`; Hints first enters precise task | D/P — separate derived Auto/Hint intent from Capture and precision; explicit Capture is the authored boundary | C2/C3 |
| `lowerCamera()` used for visitor snapshot but authoring glyphs/Through read raw source poses | D — one resolved Camera evaluation for relative framing, fixed-framing review, Stage, Through, routes, estimates and visitor; never silently diverge after World edits | C2 |
| Projection policy in `main.frameState`; interpolation in `Stage.lerpCam`; direct input camera writes; Experience builds route paths and retains return poses in `routeReturn` | D/P — consolidate ownership beneath navigation; importing one helper or calling `applyPose` at the end is insufficient. Preserve specialized World motion profiles | C2 |
| Neutral World reentry captures requested `a0` and writes `flatHold` from actions; Experience restores remembered posture metadata; route Resume omits return context | P/D/Q — replace snapshot patching with a canonical neutral lifecycle, full realized-pose proof and current invocation return | C2 |
| Existing QA accepts label/control presence and API-built specimens | Q — real journeys, visible-geometry checks, deliberate six-pair review and targeted successor mutation proof | C1/C8 |
| Exact lens hue/location, small wording/spacing, board file count, incidental raster noise | V — tolerate if meaning/hierarchy and accepted shared-shell behavior are preserved; no corrective slice | All |
| Paper rail/Card/topology/creation, production F/T work, general Presentation forks, route search, full media | F — remain outside this prototype plan; none excuses missing V2 behavior | Boundary |

File names in this table refer to the existing [app modules][app] and
[styles][styles]. Structural controls and colors are within scope even though
minor metric matching is not. No visual failure may be recategorized as F merely
because S0–S9 omitted it.

## 4. Implementation contracts

### Shared authority and transaction contract

- Keep `S.sel` as the only canonical authoring selection. View use, Camera View,
  Stop and authored beat identity remain distinct; task target, station focus,
  hover and expanded occurrence are session context, not substitute selections.
  Index/Stage/Card/Deck projections must agree. Foreign selection stays honest.
- Keep Layout architecture, Scene world subjects/content, Camera Views/routes/
  framing/projection/evaluation and Experience Presentations/Stops/Guide/meaning/
  order/coordination separate. Keep one aggregate source transaction/history seam
  as prototype coordination, without proposing a format.
- One accepted edit, including detach-and-retarget, yields one Undo step.
  Unaccepted fields, scope prompts and drags cancel once on teardown, lens switch,
  Preview, Escape or lost capture. Source Undo never restores standpoint.
- Calculate edit reach from current source at proposal and again at acceptance.
  Shared meaning, View-use roles, framing, route geometry/pace and reused
  contributions all announce affected uses/occurrences as applicable. Local
  choices appear only for supported detachment semantics. No name/proximity repair.

### One Camera/navigation authority, including Neutral Resume

C2 is a bounded prototype ownership correction, not production Camera work.
`navigation.js` is the public control seam; pure Camera operations can be split
into prototype-local Camera modules behind it. The renderer realizes evaluated
results. Shell/Experience pass viewing intent or time/progress; they do not own
pose interpolation, projection rules, route construction or return snapshots.

1. Inventory and migrate the actual writers: `Stage.lerpCam/placeCamera`,
   `main.frameState` flatness and pointer/tilt/exploration writes, World operations
   in `actions.js`, and Experience posture/route/Preview paths. Extract existing
   World profiles intact; one authority does **not** require one interpolation
   kind or a switch from guided PerspectiveCamera to another system.
2. Camera resolves View intent against current World facts once. It supplies
   observer/target/projection, route geometry, generated endpoints, stations,
   timing and evaluation. Authoring and execution consume these same results.
   Choose and document the prototype anchor coordinate meaning in that owner;
   every handle, line and executed path must agree. No target-only line may be
   presented as the observer route unless the observer path actually coincides.
3. Experience retains visit/run clocks, editorial order, holds and invocation
   time mapping. It requests Camera evaluation; it does not construct fallback
   paths or independent pose/FOV tweens. A returned evaluated pose is allowed as
   ephemeral output, never as a second writable Camera authority.
4. Canonical navigation owns return contexts. Task/Preview callers hold opaque
   session handles; move the active `routeReturn` pose and return mechanics out
   of Experience task parameters. Parking stores accepted identity/parameters
   only, no Camera pose or old return token. Derived endpoints never enter the
   authored anchor array. Preserve existing source identities where valid.
5. Lens exit cancels proposals and movement callbacks, parks procedure inactive,
   and preserves the **realized** eye, target/direction, up, FOV, mirror and
   projection. Return to a lens is ordinary with current selection/standpoint;
   only an existing Guide's quiet Peek is allowed.
6. Explicit Resume revalidates original selection, binding, bookends, route,
   stations and accepted parameters. Activate surface and temporary reading as
   one neutral operation. Navigation holds the current realized standpoint
   through setup, later frames and idle; do not move away then restore it.
   Create the new invocation's return context from **now**, so subsequent Put it
   back cannot rewind navigation performed in the other lens.
7. Remembered precise posture is intent, not evidence of the actual picture.
   If current viewpoint is not Through/Plan, show the actual reading and a
   separate explicit navigation action. Resume never silently aligns it. An
   explicit route/Through invocation creates its own canonical return; returning
   a resumed route must work even though its old return pose was discarded.
8. Preview uses an independent canonical suspension/return lifecycle, restoring
   lens, selection, Card context, standpoint and accepted inspection, rather
   than lens parking. Visitor session effects/source snapshots cannot mutate
   authored data; authoring inputs are inactive, not merely hidden by CSS.
   Keep pure execution/Camera modules free of authoring session, selection,
   history, gizmo and shell imports. The static prototype's shared page is not a
   production visitor chunk; production route/import isolation remains protected
   by repository architecture gates and is not changed by this prototype work.

Tests must assert complete rendered state across frames, not just `eye + fov`
rounded into a string or `nav.plainPose()` before rendering. Preserve the World
numerical tolerance policy; it is not a visual-raster tolerance.

### Shell and semantic visual hierarchy

- Persistent Head, locator Index and vertical identity Card surround one dominant
  Stage. Contextual Deck is a stable bottom landmark for Guide Peek/Overview/Seam;
  Camera precision is local spatial work, not a mandatory Guide branch. Hints
  appear on demand in their Camera/use context without forcing a rig or Deck.
- Use light, restrained chassis/instrument surfaces, clear section/identity type
  ranks and existing PLATE semantic color/control roles; do not introduce local
  ad-hoc button colors. Primary acceptance, ordinary actions, relation links,
  segmented states, destructive actions and disabled controls must differ. The
  Camera domain accent, selected/manipulated ochre, warning/refusal and neutral
  armed states follow PLATE semantics, reinforced by labels/shapes/focus grammar.
  Use the boards to judge relative visual rank, not to sample pixels or infer
  token values.
- Across Peek → Overview → Seam, Stage remains dominant and canonical content
  and spatial instruments remain legible and reachable. Disclosure alone never
  moves or refits Camera; explicit Bring into view may request framing through
  canonical navigation. Whether Deck disclosure overlays, crops or minimally
  reallocates Stage remains the PLATE crop-docking/spatial-memory choice.
  Evaluate spatial memory across these transitions without prescribing a fixed
  renderer canvas or docking mechanism; the usability experiment cannot waive
  Stage dominance, content usability or Camera continuity.
- At 1440×900 all canonical identities, routes, bookends, active grip and scope
  decision must be readable without stacked scrolling through duplicate forms.
  At 1024×768 use the existing compact/sheet pattern and deliberate task depth;
  keep controls reachable and Stage meaningful, with no auto-refit. No Paper
  redesign is needed. Keep World shell geometry/behavior stable outside shared
  corrections necessary for these contracts.

#### Normative macro composition contracts (M0–M8)

Authority: [PLATE shared shell][plate-shared], [Experience expression][plate-experience],
[visual/state grammar][plate-visual], [return][plate-return] and
[spatial instruments][instruments]. M0–M8 apply those composition and information-home
rules. Retained synthesis/boards are evidence; incidental raster geometry is not a
contract (see Non-contracts below).

- **M0 — Shared-shell continuity.** Every Experience canonical state uses the
  shared Head and persistent shell landmarks from PLATE: project/application identity,
  World | Experience lens switch, save/history state and Preview remain the same
  shared Head grammar; Index, Stage and Card retain the same shell landmarks
  and chassis/material language. Lens-specific contents differ, but Experience
  must not recreate a parallel or simplified shell. World calibration does not
  import World Instrument controls, Paper Card restrictions or its six-tool rail
  into Experience.

- **M1 — Shell-owned Deck with information-driven span.** Overview, Seam and
  coordination use the lower breadth beneath Index + Stage + Card because order,
  adjacent bookends and linked route/event relationships require horizontal
  continuity. The upper Index/Card retain their semantic landmarks; breadth does
  not require their collapse. Groups size from their information rather than
  stretching sparse controls. Peek is the same Deck's quiet shallow posture at
  the Stage edge and need not paint the full breadth. Adding the first Stop
  opens Peek; no Guide means no rail. Precision alone creates no Deck. Span stays
  stable within a task posture. Overlay/crop/minimal reallocation and exact sizes
  remain usability choices after semantic span is decided, preserving Stage
  dominance, spatial memory and Camera continuity. This does not force every
  World Instrument to adopt Guide breadth.
- **M2 — Stage is the dominant spatial authoring surface.** Stage owns spatial
  truth and direct manipulation in every state: working-Set geometry, numbered
  Stop entry pins, scoped Camera routes/anchors, framing rig/grips and observer/
  framing relationships, in the appropriate Plan/3D/Outside/Through reading.
  Instruments follow [spatial truth, affordance and hit-legibility rules][instruments]:
  geometry corresponds to Camera/domain evaluation, authored controls remain
  distinct from derived helpers, and a guide does not imply an unsupported orbit
  or movement constraint. Exact widths, canvas sizes and minor control placement
  are implementation choices; dominance, legibility, reachability and Camera
  continuity are not.
- **M3 — Card stays the stable canonical identity/owner/reach surface.** Card
  remains at its vertical landmark, answers target/owner/reach at the decision
  point, carries the Ask Rule scope decision, and collapses lower strata by
  actual content. It never becomes the Deck, the current tool, the World
  Instrument/Seam instrument or inspection focus. A canonical Stop Card carries
  occurrence-local facts and shared-use scope; it never absorbs Deck order,
  occurrence cards, bookends or the central coordination structure. A beat/hold
  detail may use task focus under This Stop without inventing another selection.
- **M4 — Guide Overview is the editorial occurrence surface.** Deck owns
  editorial order and occurrence density: L0 compact identity/position, L1
  summary (thumbnail/title/entry/warning), L2 expanded detail (Presentation summary,
  View constellation, Guide-specific details). Selection receives emphasis and
  appropriate density; explicit L2 expansion is separate and is not forced by
  every selection. Nearby occurrences may stay L1; distant occurrences compress
  toward L0 (fisheye, never equal-width clutter). Stage owns spatial Stop
  locations as numbered entry pins only — no entry-facing glyphs, no Camera
  graph/topology.
- **M5 — Seam is the local-transition triptych.** The Seam Deck posture is
  previous-Stop/source bookend → central Seam instrument → next-Stop/destination
  bookend, with unrelated occurrences strongly compressed to minimal
  identity/position cues (not full cards); the exact compact representation is
  an implementation choice. Opening a Seam preserves pose/projection and never
  auto-switches to Plan; explicit route editing may request a useful Plan
  reading with a return crumb through canonical navigation. Broad lower span is
  required; the compact Index spine/Card header in b4 are permitted compression,
  not compulsory side-panel collapse in every Seam state.
- **M6 — Seam information homes.** The source bookend owns the source Stop and
  its possible origin Views with per-origin reach/gap state. The destination
  bookend owns the destination Stop and its entry-View context. The central
  Seam instrument owns the transition itself: Travel/Cut state, route summary
  over shared Camera infrastructure, pace, aggregate reach/spatial status and Coordinate
  invocation. Normal Seam depth shows route/pace/status with no coordination
  strip yet. Cut creates no Camera edge; Travel references only supported
  connectivity with honest gaps. Card keeps canonical identity and property
  owner/reach, including the scope of a shared Camera route/pace edit, rather
  than duplicating the triptych. Every legitimate origin contributes to reach.
- **M7 — Coordination extends the same Seam instrument.** Coordinate invokes
  (or existing coordination discloses) a local temporal projection inside the
  central instrument: Route/stations from departure to arrival, Beats and Holds,
  with intelligible distance/time readings where relevant. Spatial
  route and temporal strip are two projections of one authored relation sharing
  stable stations (depart, anchor k, arrive, named marker); beats/holds bind to
  stations and survive pace changes; generated points never become authored
  station references. Camera routes/authored anchors/derived helpers and
  Experience events/holds use the species and semantic roles in [spatial-instrument
  grammar][instruments]. Counterpart emphasis must visibly connect an event/hold
  to its station without changing selection merely for task focus. Card exposes
  the active local beat/hold's binding and reach. Rows must compose those
  relationships, not just contain buttons named Route, Beats and Holds.
  Path geometry edits only on Stage; the
  strip never becomes a second route editor, a global timeline, an unrelated
  generic settings/dashboard composition, and it never inherits or recreates the
  rejected legacy global Camera Timeline lane/chrome model. Stage remains
  dominant. Exact raster colors and a particular units toggle remain specimens.
- **M8 — Scale × Depth disclosure.** Ordinary Experience stays quiet; Camera
  precision is reachable directly from a View without opening Guide work, and
  expanding Guide context never forces precision. Auto/Hints/Capture/Precise are
  independent disclosure depths, not compulsory sequential setup. Hints appear
  in Camera/use context; Precise supplies a direct Stage instrument. Outside
  exposes the observer–target/framing relationship through real operations;
  Through makes the image a framing instrument with editor chrome and explicit
  return; Plan exposes supported spatial work. All operate on the same Camera
  View/route. Only the active precise grip shows its tape. A literal Outside
  circle is optional and must not imply a nonexistent orbit constraint. Initial
  Through versus Outside remains a usability choice. Precision never creates
  a Guide Deck, and Capture is always deliberate.

#### Per-QA composition acceptance (C-QA1–C-QA6)

Each canonical state must meet M0–M8 plus its state-specific composition below.
Bracketed boards are specimens of relative rank and information homes, never
pixel contracts.

- **C-QA1 — ordinary Presentation [b1].** Head/Index/dominant-Stage/vertical-Card
  frame; no Guide means no rail/Deck; existing Guide means quiet Peek rail only.
  Stage shows the working Presentation's unordered spatial Set around its focus
  with observer/direction/focus relationships and role labels, no order edges.
  Card is low-floor Meaning/Focus/Show plus explicit add-behavior/offer. No
  global timeline, Camera rig or advanced Camera machinery. Preview reachable
  with no Guide or Camera graph.
- **C-QA2 — Guide overview [b2].** Plan or useful spatial overview. Deck shows
  occurrence cards across the broad lower band with L0/L1 fisheye density,
  including L1 thumbnail/title/entry/warning, and selected-occurrence emphasis;
  Stage shows numbered Stop entry pins only. No facing glyphs, no Camera route
  graph. In the selected-Stop variant, Card keeps that Stop's identity with
  entry/Travel/shared-Presentation context; retained foreign selection is also
  represented honestly. Index keeps Presentation locator plus Guide locator. Co-located
  occurrences stay distinguishable and reachable with true spatial meaning
  preserved; disambiguation mechanism is an implementation choice.
- **C-QA3 — expanded occurrence ([b3]/[b-ask]).** One Stop at L2 broad and
  readable; neighbours compressed. The expanded Deck occurrence exposes its
  Presentation summary, entry View, full unordered schematic constellation and
  shared-vs-local strata (shared meaning vs this Stop's use). Stage shows the
  same Set spatially. Card distinguishes shared Presentation from this Stop and
  hosts the Ask Rule (`Update all` / `Tell a different story here` / `Cancel`
  or equivalent supported local/shared options only) without moving Card or
  forking unsupported semantics.
- **C-QA4 — Seam route authoring [b4].** Plan only because route editing
  requested it, with return crumb. Deck triptych M5 with compressed unrelated
  context; source bookend lists possible origins with per-origin reach/gap
  (specimen 2/3 is a fixture stress value, not a product constant); destination
  bookend names destination Stop/entry View; central instrument holds
  Travel/Cut, route summary, pace, spatial status and Coordinate invocation.
  Stage shows the scoped Camera route with all origin Views, destination entry,
  authored interior anchors vs derived endpoints/markers, pace cues and the honest
  gap using spatial-instrument species. Upper Index/Card may compress without
  losing location/identity; the full triptych belongs to the lower breadth.
  Cut draws no edge; gaps never render as real edges.
- **C-QA5 — Seam coordination [b5].** Same Seam, route and standpoint as QA-4
  plus the invoked Route/stations, Beats and Holds inside the same central
  instrument, retaining both occurrence bookends. Stable
  station IDs mirror across spatial and temporal projections with visible
  counterpart emphasis and actual event/hold attachment; task focus is distinct
  from canonical selection. Beats/holds are Stop-local and distinct from the
  shared Camera route. Card can show This Stop, the active beat/hold, its station
  binding and reach. No path editing in the strip; no global timeline.
- **C-QA6 — precise Camera ([b6] Through, [b6-outside], [b-ask] scope).** Reachable
  directly from a View with no Guide and no Guide Deck. Through is the
  canonical specimen: Stage-local framing gate, horizon/height, target, lens and
  grips with only-active-tape values, posture switch (Outside/Through/Plan) and
  explicit return (`Put it back` or equivalent). These grips must manipulate
  the represented Camera facts, not decorate an image. Outside shows the
  evaluated observer, target and framing relationship in spatial context with
  supported direct manipulation; no literal circle/orbit is required. All
  postures edit the same Camera View/route. Card keeps
  Camera owner/reach/current-use with scope decision. Preview hides every rig,
  chrome and instrument and restores the exact authoring context.

#### Non-contracts (incidental raster detail)

Never gate acceptance on: exact panel/Deck widths, pixel heights (including the
specimen ~28 px Peek height), canvas sizes, raster-sampled hues/tints, minor
copy/wording, thumbnail rendering style, optional guide-circle geometry, exact
frustum drawing method, collapsed-card icon-column width, status-footer text,
or specimen artifact counts. The fixture
stress values (six Stops, repeated Presentation, three origins, 2/3 reach,
named beats/holds) prove density/reach/coordination architecture; their exact
numbers are not product limits. Written PLATE material/color/control calibration
and semantic state roles remain authoritative; this is no waiver for arbitrary
feature colors. Required thumbnail presence differs from its rendering style.
Relative visual rank, landmark/span stability (M0–M3), information homes (M4–M7),
truthful spatial-instrument semantics and disclosure behavior (M8) are normative.

## 5. Fresh delivery slices

These slices partition the replacement outcome. Existing code is reused when it
meets these contracts; no slice inherits a pass from S0–S9. Every slice preserves
earlier invariants and has observable behavior plus appropriate verification.
C3–C7 acceptance requires §2 journeys **and** §4 macro composition contracts
M0–M8 with the applicable per-QA criteria C-QA1–C-QA6; C8 verdicts every state
against those same contracts.

| Slice | Dependencies | Affected areas and work | Acceptance to leave the slice |
|---|---|---|---|
| **C1 — Conformance fixtures and proof harness** | None | QA scripts/harness, specimen recipes and a bounded Experience fixture in the existing world. Build six-state manifest, interaction transcripts and requirement-to-test mapping before changing assertions. Preserve old evidence. | Fixture supports several Stops (six is a useful stress count, not a product limit), repeated Presentation, three distinct legitimate origins, a distinct destination, 2/3 reach, anchors and local beats. Fixtures may load authored content, including Camera View geometry, but never preselect task depth or inject the final authoring standpoint. Demonstrate which new checks fail on this baseline and which existing tests protect World/A0–A22. |
| **C2 — Camera ownership and neutral lifecycle** | C1 | `navigation.js`, `camera-evaluation.js`, Camera portions of `experience-model.js`, `stage.js`, `main.js`, `actions.js`, `tasks.js`, `experience.js`, runtime/coordination call sites, focused ownership and continuity tests. Implement §4 Camera contract. | Same resolved route and timing across Stage/estimates/visitor; no duplicate evaluation or direct consumer viewpoint writers. World A–F preserved. Neutral resume in both lenses after other-lens movement, honest posture, fresh return, stale callback cancellation, complete Preview return and frozen source. Boundary mutations must fail. |
| **C3 — Quiet shell, Set and scope** | C1, C2 for framing/resolution | `experience-ui.js`, `experience-draw.js`, Experience CSS scoped in `app.css`, `experience.js`, field wiring in `main.js`, minimal shared shell hooks in `ui.js`/`index.html`. Build low-floor Card, spatial Set, derived Auto/Hints, explicit Capture, control roles and shared-edit proposal flow. | QA-1 passes in no-Guide and Peek variants. Plan/3D use the same unordered Set; no implicit edges/Stops. Controls consume existing PLATE semantic roles, with relative visual rank reviewed against the boards and no local ad-hoc button colors. Card identity and scope stable; shared Meaning/role edits ask and cancel safely; no-Guide/no-View Preview works. World controls retain accepted behavior. |
| **C4 — Guide occurrence composition** | C3 | Guide/Stop Deck rendering, schematic Set, overview pins/overlap handling, explicit selection/expansion/reorder handlers and browser proof. | QA-2/3 pass with real distant/near/L2 density, repeat identities and readable constellation. Every co-located occurrence is distinguishable and reachable with true spatial meaning preserved. No Camera graph in overview; local entry and shared Presentation edits stay distinct. Peek does not expand automatically after Add to Guide. |
| **C5 — Spatial Seam and route authoring** | C2, C4 | Scoped Camera projection in `experience-draw.js`, Seam rendering/actions, Camera connection/anchor commands, route scope prompts, navigation return and pointer cancellation. | QA-4 passes: scoped Camera route in Plan, origin/destination Views, 2/3 reach/gap, anchors, bookends and unrelated context visibly present. Normal Seam exposes pace without Coordinate. Edit/repair is real pointer/keyboard work; one accepted drag/Undo, none on cancel; Cut/Travel/source boundaries hold. |
| **C6 — Mirrored local coordination** | C5 | `experience-coordination.js`, local strip and Stage marker projection, route/beat context resolution on reopen, beat/hold handlers and runtime station tests. | QA-5 passes against QA-4's unchanged route/standpoint. Shared station IDs align both projections; beats/holds are local, path edits Stage-only. Pace/anchor changes preserve refs and update timing; multi-origin execution, Cut, repair and shared-route scope work. Reopen/Resume retain valid context or refuse explicitly. |
| **C7 — Precise spatial Camera** | C2, C3; C4 for occurrence scope | Stage framing/observer instruments, precise/Hints UI, Camera gesture proposals and posture navigation/return. Remove precision-only misuse of Guide Deck. | QA-6 Through and Outside companion pass; precision works with no Guide, one active tape, useful grip geometry and truthful owner/reach. All three postures edit the same Camera View. Explicit local detach is atomic; neutral Resume, live drag cancellation and exact Preview return pass. |
| **C8 — Integrated behavioral and visual acceptance** | C1–C7 | Canonical browser journeys, successor mutation proof, all retained QA, new conformance acceptance artifact/specimens and live routing/handoff updates. Historical S0–S9 files remain untouched. | Every required row in §§2/4/6 green; deliberate side-by-side verdicts for all six states, plus companion/stress cases. Each full-window QA-1–QA-6 verdict checks PLATE shared Head/landmark continuity and contextual span, plus spatial-instrument truth/species and correspondence where applicable; retained World QA supplies comparison evidence without imposing World task semantics. This is one shared criterion, not ten additional Experience QA states. No unresolved material V2 defect. Required repository gates green or accurately reported blocking; no merge/close claim while blocked. Paper receives the corrected executable and current proof. |

C7 may follow C4 before C5/C6 if useful; C8 requires all. This is a dependency
choice, not authorization to delegate work or implement concurrently.

## 6. QA strategy and completion gate

### Three complementary proof layers

1. **Domain behavior:** pure Camera/Experience tests for resolved framing,
   identities, explicit role/entry/order, reach, accepted transactions, stable
   stations, timing, run ownership and source isolation. Use realistic unequal
   poses/angles and nonzero paths; self-connections cannot be the only route proof.
2. **Product wiring:** browser journeys using real selection, pointer/keyboard,
   disclosure, scope decisions and return controls. Read-only probes may observe
   identity, source hashes, canonical route/station IDs, projection and realized
   pose. Do not set `experienceContext`, write `stage.cam`, invoke `routePoint`,
   `preciseView` or `applyPose` to produce a claimed product-reachable specimen.
   Deterministic authored fixture loading and explicit user Reset/Load Example
   are allowed outside the product flow; loader must not play or open work.
3. **Visual conformance:** inspect the actual rendered six-state set against
   PLATE and spatial-instrument grammar, using the original boards as composition
   evidence. Automated structure/visibility checks support,
   but cannot substitute for, this review. No blanket pixel-diff gate or arbitrary
   global similarity percentage; masking the route, Card or instruments is forbidden.

Keep donor A0–A22 coverage mapped explicitly: creation/independence (A0–A2),
Piano and Switch→Light (A3–A4), captions/cues/readiness (A5–A7), manual/Auto/Gates
(A8–A9), cancellation/Finish/Continue/explore (A10–A12), detour characterization
(A13), repeated visits (A14), shared/local framing (A15), structural history
(A16), repair/cycles (A17), source/session isolation (A18–A19), deterministic
stepping (A20), observational Presenter/Reset (A21–A22). Reuse the current tests
where valid; no silent removal of behavior to make the new shell simpler.

### Canonical specimen protocol

For each QA-1…QA-6, the new acceptance artifact must contain:

- revision/dirty-state provenance, viewport/DPR, fixture identity and exact
  **product interaction recipe**, plus the canonical state asserted before capture;
- current selection, task/depth, Plan/3D/Through reading, expected positive and
  forbidden overlays, route/occurrence identity where applicable;
- original board and current full-window capture displayed **side by side** at
  comparable scale; matched Stage/Card/Deck detail crops if needed to inspect
  legibility, never as a replacement for the full composition;
- a verdict on **shell/Stage dominance, landmarks/disclosure, spatial reading,
  spatial instruments, identity/scope, semantic control hierarchy and reachability**;
  each dimension explicitly passes or fails, with a reason. Control hierarchy
  requires existing PLATE semantic color/control roles and the boards' relative
  visual rank, never raster-sampled or local ad-hoc button colors. The verdict
  must explicitly check §4 M0–M8 and the applicable C-QA1–C-QA6 composition rule
  for that state (Deck ownership and triptych/information homes for QA-2–QA-5;
  quiet-ordinary and precision disclosure for QA-1/QA-6); a state passes only if
  its composition homes hold, not merely if controls are present and reachable;
  explicitly inspect lower-surface span, shared-shell continuity, authored/derived
  species, truthful manipulation geometry and spatial/temporal correspondence.
  The Outside ring and exact raster technique are not acceptance targets;
- tolerated differences named narrowly. Every material failure links to a
  correction and re-capture. An existing screenshot's filename is no evidence
  that its state passed. Historical captures are not overwritten as new proof.

Automated visibility assertions must reject: coincident inaccessible Stop pins,
all Set markers offscreen, routes hidden behind panels, missing endpoint glyphs,
wrong Plan/Through reading, clipped L2 constellation, missing mirrored stations,
inactive-looking active controls and authoring instruments left active in Preview.
Test actual hit reachability where it matters, not just DOM presence or counts.

**Mandatory comparison pairs:** QA-1 versus QA-2 (Set disappears for overview);
QA-2 versus QA-3 (only expanded working Set returns); QA-4 versus QA-5 (same
spatial route, added local coordination); QA-6 versus visitor Preview (authoring
rig/chrome disappears and returns exactly). Review all six full-window pairs
together after the last shared CSS/Stage change; a local earlier pass may become
stale when another slice changes the composition.

Additional proof: ordinary Peek, no-Guide precision, Outside/Plan precision,
repeated/shared Ask Rule, both foreign-selection directions, inactive parked
procedures, neutral Resume after other-lens navigation, deleted/rebound targets,
Preview from ordinary and accepted inspections, keyboard framing/anchor edits,
reduced motion, and 1024×768 Deck/Card/visitor reachability without Camera refit.
Retain existing World viewport/DPR coverage; this is not a new device matrix.

### Replacement and authority proof

Follow [test doctrine][tests]: preserve successor evidence before replacing an
assertion; show the same protected defect fails. Add focused mutations in
disposable copies for representative boundaries: bypass the Camera evaluator;
restore an old parked viewpoint; skip shared-edit confirmation; suppress route
endpoint/anchor rendering; force all occurrence pins to one inaccessible point;
remove the station counterpart or leak an active authoring input into Preview.
Relevant successor check fails, unrelated control remains green. Do not delete
World baselines or reduce tolerances to accommodate a regression.

The existing blanket “screens are never assertions” wording must be reconciled
in the live QA guide: raster equality is not a contract, but required visual
review **is a blocking acceptance gate**. Likewise, the old acceptance's claim
that distant/near/expanded density is observational must not survive as a waiver;
only the narrowly open PLATE usability choices remain observational; they cannot
waive fixed disclosure, information homes or spatial truth.

### Executable verification

Use the [browser-hygiene skill][browser-hygiene] and one owned session/server per
axis. Fresh evidence goes to new output, never automatically into old specimens.
Read the [QA README][qa] for harness setup and [test contract][tests] for lanes.

```sh
# Inner loop: focused domain tests and the affected existing/new browser axis.
node --test prototypes/spatial-authoring/tests/*.test.mjs

# Integrated checkpoint: all World + Experience axes, then canonical captures.
QA_SHOT=0 bash prototypes/spatial-authoring/qa/run-all.sh
bash prototypes/spatial-authoring/qa/mutation-check.sh
# C1 wired the new conformance journeys into run-all and documented their capture command.

# Donor preservation.
npm --prefix prototypes/experience-authoring test
npm --prefix prototypes/experience-authoring run typecheck

# Repository ownership/isolation and documentation boundaries, never path-gated.
npm run test:arch
# Final repository gates under the applicable closeout/test contract.
npm test
npm run check
npm run build
git diff --check
```

If donor browser tests are needed for a changed harvest/replacement claim, start
their server explicitly at strict port 5173; the ordinary donor dev script uses
3000. Preserve its tests. The new plan does not authorize modifying production
code to repair the known missing P23B fixture: report any persisting external
gate blocker and request a concrete scope expansion only when necessary. A
green prototype cannot turn a red repository gate into merge readiness.

### Acceptance decision and handoff

Implementation acceptance requires all of: behavior/ownership/continuity proof;
all six reviewed visual states; real interaction reachability; preserved World
A–F and donor behavior; accurate current documentation and required gate results.
No counts of passing tests, screenshots or completed slices substitute for a
missing obligation. Keep failed V2 requirements open, never retroactively deferred.

Create a **new** conformance acceptance record and specimens, link them from live
routers, and leave the S0–S9 plan/record and captures intact as provenance. Record
only tolerated differences and relevant open PLATE usability choices: initial
precision posture, crop-docking/spatial memory and station-bound coordination
comprehension remain the three Experience experiments. Their fixed constraints
and instrument semantics are acceptance requirements.
Paper's PA0 must reconcile against the resulting shared Stage/selection/Camera/
history/cancellation contracts. No F/T gate or major phase closes as a result.
C8's pause was cleared by the owner resumption. In-scope behavioral/visual acceptance and
final verification are recorded in the new conformance acceptance; the completed checkpoint
is retired. Independent external review and the missing-fixture repository blocker remain
before any merge-readiness or formal closeout claim. No major phase closes here.

## 7. Plan self-review

- Every QA state maps prose → named inspected board → planning-audit baseline →
  correction, product recipe, owning slices and acceptance proof.
- All eight boards have a role; eight artifacts do not become eight mandatory
  canonical states. Added scope follows meaningful gaps, not raster noise.
- The old plan's useful algorithms/tests are retained as evidence; its completion
  labels, pose-patching recipe, “non-pixel” caveat and observational-density claim
  do not weaken the replacement contract.
- Camera ownership, neutral Resume, shared edit reach and resolved framing have
  concrete correction seams and adversarial proof, not cosmetic remedies.
- Source edits, cancellation, accepted World behavior, visitor isolation and
  current-source revalidation remain mandatory in every dependent slice.
- Deferred production/Paper work and supported local/shared operations are bounded;
  no owner decision is needed to plan the stated conformance corrections.
- The original planning task mutated only this document and its live routes. Under
  the subsequent owner authorization, C1–C8 implementation and conformance
  evidence are part of this work; historical S0–S9 files still remain untouched
  and no historical acceptance rewrite is part of it.

[plate]: ../../../../reference/design-system/editor-shell-and-visual-system.md
[plate-shared]: ../../../../reference/design-system/editor-shell-and-visual-system.md#shared-shell-08
[plate-experience]: ../../../../reference/design-system/editor-shell-and-visual-system.md#experience-expression-081
[plate-visual]: ../../../../reference/design-system/editor-shell-and-visual-system.md#visual-and-state-grammar-07
[plate-return]: ../../../../reference/design-system/editor-shell-and-visual-system.md#return-parking-and-preview-082
[instruments]: ../../../../reference/design-system/spatial-instrument-grammar.md
[v2]: ../../../../../prototypes/integrated-experience-authoring/design/Prototype-V2-final-synthesis.md
[world-synthesis]: ../../../../../prototypes/world-experience-shell-round/design/design-synthesis.md
[world-qa]: ../../../../../prototypes/world-experience-shell-round/QA-package/
[boards]: ../../../../../prototypes/integrated-experience-authoring/Design-QAs/
[architecture]: ../../../../reference/architecture.md
[foundation]: ../../../../reference/composition-execution.md
[prototype]: ../../../../../prototypes/spatial-authoring/README.md
[old-acceptance]: ../../../../../prototypes/spatial-authoring/qa/EXPERIENCE-ACCEPTANCE.md
[donor]: ../../../../../prototypes/experience-authoring/README.md
[paper]: ../../../p26-spatial-depth/design/paper-authoring-prototype/implementation-plan.md
[app]: ../../../../../prototypes/spatial-authoring/app/
[styles]: ../../../../../prototypes/spatial-authoring/styles/app.css
[qa]: ../../../../../prototypes/spatial-authoring/qa/README.md
[tests]: ../../../../../apps/editor/tests/README.md
[browser-hygiene]: ../../../../../.agents/skills/browser-hygiene/SKILL.md
[b1]: <../../../../../prototypes/integrated-experience-authoring/Design-QAs/Museum Piano Hall Tour Editor.png>
[b2]: <../../../../../prototypes/integrated-experience-authoring/Design-QAs/Museum Tour Planner Interface.png>
[b3]: <../../../../../prototypes/integrated-experience-authoring/Design-QAs/Museum Guide Planning Dashboard.png>
[b4]: <../../../../../prototypes/integrated-experience-authoring/Design-QAs/Museum Floorplan Route Editor.png>
[b5]: <../../../../../prototypes/integrated-experience-authoring/Design-QAs/Museum Hall Tour Dashboard Mockup.png>
[b6]: <../../../../../prototypes/integrated-experience-authoring/Design-QAs/Under the Lid_ Hall Tour Editor.png>
[b6-outside]: <../../../../../prototypes/integrated-experience-authoring/Design-QAs/Museum Camera View Editor.png>
[b-ask]: <../../../../../prototypes/integrated-experience-authoring/Design-QAs/Museum Tour Editor Interface.png>
[q1]: ../../../../../prototypes/spatial-authoring/screens/experience-v2/qa-1-ordinary.png
[q2]: ../../../../../prototypes/spatial-authoring/screens/experience-v2/qa-2-overview.png
[q3]: ../../../../../prototypes/spatial-authoring/screens/experience-v2/qa-3-occurrence.png
[q4]: ../../../../../prototypes/spatial-authoring/screens/experience-v2/qa-4-route.png
[q5]: ../../../../../prototypes/spatial-authoring/screens/experience-v2/qa-5-coordination.png
[q6]: ../../../../../prototypes/spatial-authoring/screens/experience-v2/qa-6-precise.png

[conformance-acceptance]: ../../../../../prototypes/spatial-authoring/qa/EXPERIENCE-CONFORMANCE-ACCEPTANCE.md
