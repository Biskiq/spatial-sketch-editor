# C9 — final model-first Experience reconciliation for #113

**Status: proposed plan, 2026-10-04; implementation not authorized or started.**
This is the additional, bounded authoring-completeness slice for
[PR #113](https://github.com/Biskiq/spatial-sketch-editor/pull/113), in the existing
[unified prototype][unified]. It replaces the final Experience acceptance boundary
where the [C1–C8 plan][c1-c8] omitted or weakened donor behavior. C1–C8's achieved
shell, ownership and advanced-state conformance remain evidence to preserve;
their PASS labels do not establish authoring completeness under C9.

**Outcome:** one useful Experience authoring model, reachable from Reset, combining
Prototype 4.1's creator ergonomics and behavioral richness with V2's World |
Experience shell, Presentation/Stop/Seam vocabulary, Camera authority and spatial
instruments. UI changes expose that model. They are not a separate redesign.

## 1. Authority, baseline and diagnosis

| Concern | Authority for this reconciliation |
| --- | --- |
| Creator tasks and Experience behavioral richness | Owner-directed donor authority: actual [Prototype 4.1 implementation][donor], reconstructed below; mechanisms are replaceable |
| Shell, hierarchy, information homes and visual language | [PLATE][plate], especially Experience expression and Preview/return |
| Stage facts, grips, spatial species and correspondence | [Spatial-instrument grammar][instruments] |
| Layout / Scene / Camera / Experience ownership | [Architecture][architecture], [North Star][north-star] and the [World / Experience amendment][amendment] |
| Identity, channels, acceptance and isolated execution | [F target contract][foundation]; this prototype defines no production encoding or exact F interface |
| Earlier scope and evidence | [C1–C8 plan][c1-c8] and [conformance acceptance][c8-proof]; the six boards are advanced specimens, not the complete creator contract |

Audited checkout and open PR head: `5a482eb3a639d751964d5a9a7d47d36b2cdcd9d6`
on `prototype-v2`. The starting tree was clean. Source inspection, donor domain
tests (**62/62**) and unified domain/runtime tests (**40/40**) were performed in
this planning task. Planning verification: all 111 references across the five
changed documents resolve (including the untracked new plan), section/heading
checks and whitespace pass, and the matrix has 85 unique classified behaviors
with all 18 Presenter topics. The unconditional architecture lane is **275/276**;
its sole failure is the previously recorded missing P23B fixture, not a new link
failure. Browser tests were read, not rerun; no new manual usability
PASS or implementation acceptance is claimed. Read-only Node probes constructed
temporary in-memory examples; they changed no repository source.

### Actual donor reconstruction and evidence

Read the [4.1 plan][donor-plan], all authored types/mutations in [model][d-model],
[Load Example][d-fixture], generic capability inputs in [Controls][d-controls],
capability execution in [runtime][d-runtime], domain effect realization and visitor
Camera sampling in [Scene][d-scene], [Camera adapter][d-camera], [presentation
planning][d-planning], [Inspector][d-inspector], [visitor UI][d-visitor],
[Reviewer Presenter][d-presenter], [App integration][d-app], [history][d-history],
[domain tests][d-tests], [history tests][d-history-tests], [browser journeys][d-browser]
and [browser regressions][d-regressions]. The donor's capability adapter is spread
across descriptors, generic inputs, execution and realization; it is not a separate
adapter file. Guide/Position semantics live in model, runtime and PositionInspector.

The actual donor is richer than a shot list. World subjects expose generic
capability descriptors. Reusable definitions are separate from contextual uses.
An **Encounter maps to a current Presentation**: intention/focus plus independent
View uses, explanation, Activities and visitor offers. Organizational membership
does not define start, arming scope or end. View uses can be freely chosen,
explicitly suggested in an internal order, or requested by narration cues; none
creates Guide occurrences. One explanation can span several Camera requests.

An optional Guide has ordered **Positions, now Stops**. Ordinary Guide-add makes
one occurrence referencing the whole Presentation. Position policy distinguishes
Presentation entry, a particular View and intentional hold. Default Next is
resolved from Guide order; explicit target/end and choice/detour references have
their own intent. Detours save the parent visit, pause its narration and return
without repeating entry. Exploration releases Camera and Auto; activities keep
their boundaries, and manual navigation or View choice can reclaim guidance.

Execution is session state: visits, activities, effect ownership, emitted signals,
Camera requests, captions, history and bookmarks. Narration duration/captions
derive from text; cues and finite capability completion share its simulation
clock. Auto waits for overlapping supported work plus two seconds, not a fixed
Presentation duration or the sum of all work. Manual Next is independent of that
readiness; an explicit Gate is a separate permission. Cancel, Finish and Continue
are type-based policies; completion is distinct from retaining a state result.

This reconstruction also finds donor limitations. Its activity map is keyed by
use, channel ownership uses a broad replacement policy, View definitions sit in
Experience, and editor selection can move Camera. Same-Presentation checkpoint
continuity and detour pause were trials, not permanent contracts. The later actual
model includes optional `viewOrder` and Next/Previous View controls; these must be
accounted for even though the original 4.1 plan concentrated on cues. Presenter
contains labelled provider-mutating shortcuts and some weak outcome checks.
Preserve useful behavior; do not transplant those mechanisms.

### Current-state diagnosis

Inspected unified [model/mutations][v-model], [commands and UI wiring][v-commands],
[runtime][v-runtime], [Cards/visitor/Presenter][v-ui], [capability adapters][v-caps],
[Camera evaluator][v-camera], [coordination][v-coordination], [shared integration][v-main]
and [conformance fixture][v-fixture], alongside the C1–C8 plan and evidence.

The unified implementation has useful foundations: separate Camera source, stable
Stops, unordered Set roles, aggregate history, declared channel replacement,
visit/run tokens, Camera evaluation beneath navigation, visitor takeover, route
stations and an actual local coordination strip. Much of the rich runtime exists.
The principal deficit is the **composition and invocation model plus its ordinary
authoring path**, not missing chrome alone.

| Finding | Evidence and implication |
| --- | --- |
| Capability discovery moved away from the selected subject | `experienceCardBody` shows a foreign World subject with Present this; `offerHtml` is a generic Kind/Target/Capability/Value form. The creator cannot operate that subject and capture the audition as in 4.1. |
| Meaning and explanation are disconnected in ordinary work | Meaning is static Presentation text; narration is behind Contributions/Add narration. A fresh moment does not naturally produce the donor's narrated Preview. |
| Organizational membership became activation authority | `armScope` selects by `presentationId` and starts every non-dependency contribution there. A probe with an Experience-start Activity organized under A, while previewing B, creates no run. `start.kind` and organization are not independent. |
| Hold is an entry fact, not a sustained viewing policy | A held Stop with a narration-linked View cue starts Camera movement in the probe. `emit` does not suppress that automatic request. |
| Camera readiness became an implicit permission gate | With both origin routes present, `gateState` refuses early Next during a View move: “finish the current move or rejoin.” C8 explicitly accepted this restriction; C9 changes it deliberately. |
| Coordination can duplicate activation | A destination Activity bound to arrival starts at entry and again at arrival in the probe. A station binding must replace implicit entry activation for that use, or explicitly invoke a separate use. |
| Ordinary Stop selection forces expanded editorial posture | Every `exp-stop`, including Peek buttons, dispatches `expandStop`, setting occurrence depth. There is no stable compact Guide + normal Stop Card posture. |
| Visitor agency is reduced at the product wiring | `visitorPointer` returns into drag handling whenever exploring, so direct object activation cannot occur there; accessible buttons still work. Standalone rejoin uses Stop entry, and visitor UI lacks the donor's general Presentation opening/closing and transcript controls. |
| Repair/revision is mostly a model assertion | Profiles can lose support in a test, but the product has no replacement profile picker, contribution rebind surface or routed capability repair notices. Local/shared framing is stronger than revision of other contribution kinds. |
| Example and Presenter prove less than their labels suggest | Load Example has machine cues, casing/rotor, Piano and Switch → Light, comparison and a detour to comparison. It omits the Wall detour, no-View environment, local Machine highlight, replacement case and route coordination. Presenter is four titles with Back/Skip, hidden during Preview, without task instructions or observed outcomes. |
| Reset is not the donor's empty Experience | `createExperience` always creates Saltmarsh Highlights. This masks interaction-only and no-Presentation Preview gaps. |
| Framing is weaker for compound focus | Camera `deriveFraming` uses the first subject and a constant frame height; the donor frames the collection/region extent. A comparison can therefore be structurally present but poorly framed. |

Existing A0–A22-labelled unified tests chiefly construct model state directly.
For example, A0–A2 checks a runtime with no authored Views; A21–A22 checks a pure
estimate and deterministic Scene creation, not Presenter or Reset controls.
The visitor browser script injects a Gate with an authoring API. These are useful
mechanism tests, but they do not prove the low-floor jobs their labels imply.
Keeping the donor's tests green proves donor preservation, not transplantation.

## 2. Complete parity matrix and dispositions

Classification describes **current V2**, not the proposed result. PRESERVED means
the inspected mechanism and relevant existing tests match; it does not waive C9's
product wiring proof. Every other row explains the difference and assigns a final
disposition. Gate IDs refer to §9. These rows are the acceptance inventory; a final
record must give each row a proof, an explicit change rationale, or the stated
deferral. No row may disappear behind a broad “A0–A22 PASS.”

### Subjects, framing and Presentation composition

| ID | V4.1 behavior in current vocabulary | Current V2 classification and reason | Final decision / proof |
| --- | --- | --- | --- |
| W1 | Stable real World subjects: Machine, Piano, Light, Switch, mesh, environment | PRESERVED — Scene fixtures resolve stable subjects | Preserve V2 ownership and real Stage targets; J1/J6 |
| W2 | Generic descriptors drive range, toggle and action controls | PRESENT BUT WEAKER — descriptors survive, but the capture form normalizes action controls and lacks subject-local operation | Synthesize donor discovery with current adapters; J1/J6 |
| W3 | Generic visibility/highlight apply across supported subjects | PRESENT BUT WEAKER — highlight is mesh-only; generic visibility and Machine-local highlight are absent | Restore generic capabilities where the fixture adapter supports them; J6/J8 |
| W4 | Wall unfolding as a capability-backed explanation | INTENTIONALLY SUPERSEDED — Scene `wall` profile exists without a subject; donor's stored World `unfolded` flag is not current Layout ownership | Retain visible behavior via the existing Layout representation evaluator, retire Scene-owned wall property; J6/J8 |
| W5 | Source-editable capabilities versus Experience audition | PRESENT BUT WEAKER — source inputs exist; temporary authoring auditions do not | Separate source, audition, authored use and visitor run; J1/J6 |
| W6 | Provider adds a capability without authoring UI branches | PRESENT BUT WEAKER — generic form can enumerate a profile, but no editable provider/profile trial reaches it | Fixture-load an extra declared profile; select it through World controls and use the same subject adapter; J8 |
| W7 | Replacement profile loses rotor while retaining casing | MISSING — no replacement profile/control | Add bounded provider replacement and local repair, preserving instance/geometry; J8 |
| W8 | Zero/one/many subjects, region, viewpoint and environment focus | PRESENT BUT WEAKER — model supports compounds; UI lacks a complete focus/rebind path and auto frames only first subject | Restore bounded focus selection and Camera-owned extent framing; richer compound focus may be fixture-loaded; J1/J2/J8 |
| P1 | Encounter is a reusable meaningful moment | PRESERVED — Presentation identity/meaning/focus/use references are separate from Camera | Keep Presentation vocabulary and composition; J1/J3 |
| P2 | Plain explanation with inferred duration and optional duration override, no required timing setup | PRESENT BUT HARD TO REACH — Add narration is nested under Contributions; static Meaning alone has no narration; model duration override has no writer | Put primary explanation in the ordinary Card, default use creation on acceptance, optional duration override in detail; J1/J4 |
| P3 | Multiple View uses belong to one Presentation | PRESERVED — separate Camera Views and Experience uses | Preserve; View additions change neither Stops nor connections; J2 |
| P4 | Definition versus use identity and reuse | PRESERVED — Camera View reuse makes a new Experience use | Preserve V2 Camera ownership and donor reusable-use mental model; J2/J8 |
| P5 | Automatic framing follows subjects; fixed framing warns after source edits | PRESENT BUT HARD TO REACH — relative lowering/review exist, but normal Capture always produces fixed framing and no anchoring writer exposes the alternative | Offer Follow focus / Fixed in Camera Card; use one resolver everywhere; J8/J10 |
| P6 | Accept automatic framing, or capture current view | SEMANTICALLY CHANGED — donor creation authored a default View; V2 correctly separates derived Auto from Capture | Preserve explicit V2 Capture; remove extra explanation setup so quickstart remains comparable; J1 |
| P7 | One explanation spans several cue-requested Views; named markers retain explicit local time | SEMANTICALLY CHANGED — runtime exists, but generic midpoint fractions replaced donor marker seconds; raw signals replaced phrase selection | Restore named passage/cue selection, marker identity and editable seconds; preserve explicit placement across text edits with duration validation, no general timeline; J2/J4 |
| P8 | Merely listing Views creates no progression, edges or Stops | PRESERVED — Set is unordered; roles/cues are explicit | Preserve; include Reset and loaded example mutations; J2 |
| P9 | Optional explicitly suggested View progression and Next/Previous View | MISSING — no `viewOrder` equivalent or visitor step controls | Retain a bounded, opt-in Presentation-local suggestion relation; distinguish Next View from Next Stop; J2 |
| P10 | Entry selected from the donor's first/suggested View | INTENTIONALLY SUPERSEDED — V2 has an explicit entry role | Preserve explicit entry authority; reordering manual suggestions alone cannot change entry; J2/J3 |
| P11 | No-View environmental Presentation, outside a Guide | PRESENT BUT WEAKER — API/no-View Preview exist, but Load Example omits the donor's authored environment | Restore meaningful editable environment example and normal creation/Preview; J1/J6 |
| P12 | Open/close a Presentation spatially or from visitor navigation | MISSING — visitor UI has current moment and Guide start, no independent Presentation opening/closing | Restore visitor-facing available Presentation entry/list and Close; use domain focus, no editor Index in Preview; J5 |

### Activities, relationships, effects and readiness

| ID | V4.1 behavior in current vocabulary | Current V2 classification and reason | Final decision / proof |
| --- | --- | --- | --- |
| A1 | Operate subject → Use in Experience | MISSING — generic capture form replaces audition/capture | Restore as the primary authoring path, keep form for advanced rebind only; J1 |
| A2 | Edit an already captured operation without making a duplicate | MISSING — no selected-subject captured-use binding | Update the uniquely matching use; if ambiguous, ask which existing Activity or explicitly Capture another; J1/J8 |
| A3 | Activities start at Experience, Presentation entry or dependency signal | SEMANTICALLY CHANGED — `armScope` uses organization; most start kinds are ignored | Restore explicit arming/activation scope independent of organization; J4 |
| A4 | Dependency listener may be visit-local or Experience-wide | MISSING — after references have no independent arming scope | Restore those two bounded listener scopes; do not create a general scheduler; J4 |
| A5 | End boundary distinct from organizational home | PRESENT BUT WEAKER — visit/Experience fields exist, no actual boundary picker; completion boundary not fully represented | Restore visit, completion and Experience boundaries plus adapter-defined result retention; J4/J8 |
| A6 | Casing completes → rotor starts; pending rotor disarms on early departure | PRESERVED — fixture and runtime support a local completion dependency | Preserve and expose editable example; J4 |
| A7 | Cancel / Finish / Continue differ | PRESERVED — interruption defaults and run tokens implement the core policies | Retain type defaults and optional detail; add boundary/retention cases omitted by present tests; J4 |
| A8 | Finite state/motion result survives completion to its chosen boundary | PRESERVED — completion does not erase all overrides | Preserve; test a boundary crossed during Finish and newer ownership; J4 |
| A9 | Persistent rotor crosses departure; visitor Stop remains effective | PRESENT BUT WEAKER — current `armScope` can reissue an Experience-bound use on a repeated Presentation visit | Keep a started persistent invocation; no duplicate/reclaim on framing, rejoin or continuation; J4/J5 |
| A10 | Local narration/highlight cease on ordinary departure | PRESENT BUT WEAKER — narration cleanup exists; Machine highlight is missing and held/missing cases are incomplete | Restore real local effect and ownership cleanup; J4/J6 |
| A11 | Narration, cues and Camera evaluation share explicit session time | PRESERVED — bounded steps and Camera evaluation are shared | Preserve one clock/evaluator path; J4/J7 |
| A12 | Auto uses overlap, finite work, queued movement and scheduled persistent start | PRESENT BUT WEAKER — estimator uses a new default Scene, ignores some activation semantics and per-View movement preferences | Resolve current adapters and eligible work, include actual entry/holds once; J4/J7 |
| A13 | Auto estimate and speed breakdown available in optional detail | PRESENT BUT WEAKER — timing math exists, ordinary editable Presentation estimate/speed context is absent | Camera-owned movement preference; derived estimate in Card detail, never an authored Presentation duration; J4/J7 |
| A14 | Caption passage, full transcript and caption toggle share playhead | PRESENT BUT WEAKER — moving word-window caption only, no transcript/toggle or paused caption | Restore coherent passage captions and transcript; simulated text media remains sufficient; J4/J5 |
| A15 | Missing cues/signals and dependency cycles explain local repair | PRESENT BUT WEAKER — cycles/missing use are detected, missing marker/availability/boundary validation is incomplete | Validate supported signal and scope; disable affected work, estimate valid remainder, repair explicitly; J4/J8 |
| A16 | Declared channel replacement cannot be undone by stale work | INTENTIONALLY SUPERSEDED — donor broad last-command-wins is replaced with adapter-declared replacement/run ownership | Preserve F-compatible V2 rule; unsupported exclusive conflicts reject; J4/J8 |

### Visitor interactions and agency

| ID | V4.1 behavior in current vocabulary | Current V2 classification and reason | Final decision / proof |
| --- | --- | --- | --- |
| I1 | Interaction is an offer, not an automatic Activity | PRESERVED — scope arming excludes interactions | Preserve; station invocation must not silently turn an offer into automatic work; J6/J7 |
| I2 | Activation subject differs from invocation target: Switch → Light | PRESERVED — `triggerSubjectId` is independent | Keep this distinction visible in subject-local offer capture/repair; J6/J8 |
| I3 | Interaction without a Presentation or Guide | PRESENT BUT HARD TO REACH — pure activation works, but UI capture needs Presentation context and Preview rejects no Presentation | Provide Experience-wide offer capture and world-only visitor session; J6 |
| I4 | Availability is Experience-wide or contextual, independent of organization | PRESENT BUT WEAKER — model filter exists; acceptOffer defaults contextual and has no editable availability | Restore plain availability picker/default Experience-wide; J6/J8 |
| I5 | Toggle current state, explicit Play/Stop and accessible controls | PRESENT BUT WEAKER — runtime toggle exists without author control; generic value form lacks adapter action vocabulary | Preserve descriptor-driven actions and explicit visitor toggle; J6 |
| I6 | Activate a real subject while exploring | SEMANTICALLY CHANGED — pointer handler immediately enters drag mode and cannot activate subjects | Distinguish click from drag at pointer-up; keyboard/panel activation remains available; J5/J6 |
| I7 | Multiple offers on one activation subject require deliberate choice | PRESENT BUT WEAKER — unified pointer silently picks the first match | Show available offers; never silently choose by enumeration order; J6 |
| I8 | Interaction changes no Camera or Guide state unless explicitly authored | PRESERVED — ordinary capability offers are independent | Preserve; test completed Light result and Piano Stop during exploration; J6 |
| V1 | Explore releases Camera/Auto but keeps appropriate activities | PRESERVED — reducer supports release and source isolation | Preserve; demonstrate through actual Stage movement; J5 |
| V2 | Rejoin from actual pose, preserve visit, Auto remains off | PRESENT BUT WEAKER — Guide rejoin exists; standalone rejoin has no framing target and remaining work is rebuilt from full work | Rejoin current Presentation/View intention with fresh Camera evaluation and supported remainder; J5 |
| V3 | Missed Camera cues do not replay after exploration | PRESERVED — exploration suppresses cue requests and clears queue | Preserve future-only cue behavior and generation cancellation; J5 |
| V4 | Manual Next/Previous remain usable during exploration and unfinished movement | SEMANTICALLY CHANGED — Travel introduces departure-pose wait/refusal | Allow permitted manual continuation, evaluate live-start movement through Camera; explicit gaps/Gates still refuse; J3/J5/J7 |
| V5 | Visitors select any available Presentation View without restarting narration | PRESENT BUT WEAKER — runtime does not restart, but UI exposes only `choice` role and queues explicit choice behind movement | Expose all eligible uses including entry; deliberate choice redirects, automatic cues queue; J2/J5 |
| V6 | Previous follows actual history, ordinary return is a fresh local visit | PRESERVED — history is session state and visits are distinct | Keep; explain Back versus detour Return; J3/J5 |
| V7 | Detour preserves parent visit/playhead, subject policies, explicit return | PRESENT BUT WEAKER — pause/bookmark exists; only detour-kind UI, no off-Guide route editor, parent framing/remaining-work restore is incomplete | Retain bounded pause/resume and explicit go versus detour; return from actual pose without duplicate entry; J5 |
| V8 | Final position remains explorable and exit clears effects | PRESERVED — session teardown and final navigation state exist | Preserve and exercise real controls; J5/J11 |

### Guide and revision behavior

| ID | V4.1 behavior in current vocabulary | Current V2 classification and reason | Final decision / proof |
| --- | --- | --- | --- |
| G1 | Guide optional; add Presentation makes exactly one Stop | PRESERVED — `addStop` references the Presentation as a whole | Preserve default; J3 |
| G2 | Repeated Presentation occurrences keep distinct Stop identity | PRESERVED — stable separate IDs and references | Preserve, with private runtime visits and independent entry/Next/pacing; J3/J8 |
| G3 | Default Next comes only from Guide order; explicit target/end overrides | PRESERVED — one resolver, not Camera order | Preserve for controls, runtime and Presenter; J3 |
| G4 | Reorder/remove reconnects only default order; named references stay repairable | PRESERVED — model preserves explicit target references | Preserve with actual product revision/Undo; J3/J8 |
| G5 | Entry: Presentation / specific View / keep viewpoint | PRESENT BUT WEAKER — model/control exists, but hold cues and later-entry cue cutoff are missing | Apply policy for the visit; preserve all Presentation contents, suppress earlier automatic viewing when a later entry is deliberately chosen; J3/J4 |
| G6 | Ordinary Stop editing in compact Guide context | PRESENT BUT HARD TO REACH — Peek selection expands occurrence Deck | Preserve compact awareness, select without expanding, use normal Stop Card; explicit Overview/L2 only; J3/J10 |
| G7 | Auto / dwell / supported signal pacing | PRESENT BUT WEAKER — runtime supports signal, UI offers Auto or fixed Dwell 5s | Restore editable advanced dwell/signal; default Auto stays setup-free; J3/J4 |
| G8 | Explicit Gate is distinct from duration/readiness | SEMANTICALLY CHANGED — Travel readiness is checked by the same permission result | Separate authored permission, route validity and readiness; no implicit media/movement Gate; J3/J7 |
| G9 | Labelled go choices, detour routes and return | PRESENT BUT WEAKER — UI adds only detours to main-Guide Stops, labels/kind not editable | One optional side sequence is sufficient; bounded add/edit/remove and visitor routing; J5/J8 |
| G10 | Explicit View checkpoint creation, never default promotion | INTENTIONALLY SUPERSEDED — donor's legacy batch helper does not fit ordinary Presentation occurrence language | Use explicit Add another Stop + Enter through View; retire batch-promote-Views shortcut; J3 |
| G11 | Same-Presentation checkpoint hop can share narration visit | SEMANTICALLY CHANGED — V2 starts a new visit for each Stop | Preserve V2 distinct visits; keep continuous narration only for View changes within a visit and saved detour return. Explicit donor trial retirement; J2/J3/J5 |
| R1 | Shared/local View edits; Stop-entry-only detaches atomically | PRESERVED — V2 improves reach/Ask and isolates private entry from Set | Preserve; connections are not implicitly cloned and resulting Travel gaps stay explicit; J8 |
| R2 | Local/shared narration and operation definition edits | PRESENT BUT WEAKER — shared definition proposal exists, local detachment/linked duplication controls absent | Restore bounded copy/link/detach and accurate reach; no general Presentation fork; J8 |
| R3 | Add, rename, duplicate, replace, regroup and remove uses | PRESENT BUT WEAKER — add/remove and some names exist, contribution revision is incomplete | Restore those bounded operations; organization never rewrites lifecycle; J8 |
| R4 | Remove Presentation keeps contributions and broken bindings repairable | MISSING — no actual Presentation removal operation | Preserve reusable definitions and unresolved references, offer local repair/remove; never silently promote retained content to Experience-start; J8 |
| R5 | Missing subject/trigger/target/View/cue/availability/Next/Gate repair | PRESENT BUT WEAKER — diagnostics cover a subset and most product repair writers are absent | Routed notices and compatible rebind/remove controls; required behavior refuses locally, optional behavior disables honestly; J8 |
| R6 | Missing framing never silently becomes intentional hold | INTENTIONALLY SUPERSEDED — donor `removeUse` converts a referenced explicit View position to hold | Preserve V2/F unresolved binding; explicit keep-viewpoint is a separate edit; J8 |
| R7 | Source edits, auditions and Preview effects stay separate | PRESENT BUT WEAKER — source/Preview isolated, donor authoring audition omitted | Restore ephemeral auditions outside authored snapshots/history; J1/J6/J11 |
| R8 | Continuous gesture/typing burst is one Undo edit | PRESENT BUT WEAKER — Camera drag is atomic; text commits are discrete and capability audition/edit gestures are absent | Preserve aggregate history; accepting a value/burst once or a completed gesture once, cancellation zero; J1/J8/J10 |

### Camera, coordination, Preview, Presenter and fixture

| ID | V4.1 behavior in current vocabulary | Current V2 classification and reason | Final decision / proof |
| --- | --- | --- | --- |
| C1 | Ordinary Travel needs no manual Camera graph construction | SEMANTICALLY CHANGED — Travel flag and per-origin Connect are separate required steps | Explicit Travel prepares Camera-owned direct support in one compound acceptance; §5; J7 |
| C2 | One adapter evaluates movement, timing, interruption and actual-pose rejoin | INTENTIONALLY SUPERSEDED — V2 separates Camera ownership from donor's straight tween/Experience View definitions | Keep V2 authority; extend supported live-start invocation, no donor Camera transplant; J5/J7 |
| C3 | Speed/Cut affect movement and Auto estimates without double counting | PRESENT BUT WEAKER — route pace is real, View requests/estimate default to auto and present entry cuts | Expose Camera preference in detail; use actual invoked movement in estimates exactly once; J4/J7 |
| C4 | Advanced anchors, multiple origins and honest gaps | PRESERVED — a V2 addition with real Camera evaluation | Preserve as deliberately invoked depth; J7/J10 |
| C5 | Local station + invoke + hold coordination | PRESENT BUT WEAKER — V2 addition is real, but only constructed by advanced QA and has ambiguous entry-plus-station activation/event focus | Required loaded example and real product walkthrough; exact invocation ownership, counterpart focus and runtime proof; J7 |
| C6 | Simple framing refinements without a Stage property dashboard | PRESENT BUT WEAKER — truthful V2 precision adds a floating list of six property/grip modes | Preserve Outside/Through/Plan and direct grips; move property depth to Camera Card; J10 |
| X1 | Preview selected Presentation without a Guide, even when one exists | PRESERVED — selected Presentation runtime starts standalone | Keep explicit Preview this Presentation and Preview Guide entries; J1/J3 |
| X2 | Preview interaction-only Experience / freely open moments | PRESENT BUT WEAKER — runtime parts exist, product preview requires a Presentation | Restore explicit Experience Preview with no fabricated Presentation/Stop; J5/J6 |
| X3 | Source/session and author/visitor selection isolation | PRESERVED — snapshot, private visitor state and authoring suspension/return | Keep V2's stronger exact context return; J11 |
| X4 | Reset baseline World + genuinely empty Experience; Load Example editable/no playback | SEMANTICALLY CHANGED — reset creates placeholder Presentation; loader is reduced | Empty Reset Experience; rich native example, clear transients/history, preserve accepted Museum geometry; §7; J1/J11 |
| X5 | Presenter has quickstart, advanced instructions and observed outcomes | PRESENT BUT WEAKER — four titles, no predicates, invisible in Preview | Observational/dismissible two-part walkthrough across Preview; §8; J9 |
| X6 | Presenter Back/Skip/close never authors; provider trials use visible commands | PRESENT BUT WEAKER — navigation observational, donor and V2 loader shortcuts are mixed into review surfaces | Separate explicit Reset/Load Example commands; retire Presenter provider mutation buttons; J9 |
| X7 | Complete donor example: machine/cues/lifetimes/interactions/comparison/Wall/environment/repair | PRESENT BUT WEAKER — only part of the example is loaded; six-Stop fixture is a different shallow composition | Adapt donor concepts into the existing Museum; retain conformance stress specimen separately; §7; J4–J8 |
| X8 | End-to-end creator jobs, transitions and manual comprehension | PRESENT BUT WEAKER — advanced states and mechanism tests dominate current proof | Journeys from Reset are blocking, with source/runtime results and manual prediction trials; §9 |

## 3. Reconciled model and exact policy decisions

This is a **prototype semantic contract**, not a persisted schema or new F
interface. Evolve the native ESM model, operations and runtime rather than adopt
the donor's React architecture or its definition container.

| Concept | Reconciled meaning and ownership |
| --- | --- |
| World subject | Stable domain-qualified target exposed by its domain's capability adapter; Layout architecture and Scene content remain separate |
| Presentation | Experience-owned reusable meaning/intention, focus and composition; explanation, zero/many View uses, Activities, offers and explicit local relationships |
| Camera View | Camera-owned reusable framing/projection/adaptive intent with evaluation and review status; no copy of pose in Experience |
| View use / Set | Experience reference plus local entry, availability, cue or optional suggestion relationship; membership is unordered |
| Activity definition/use | Prototype-local reusable narration or supported capability invocation plus parameters; binding, organizational home, start/arming scope, boundary, interruption and result retention are separate facts |
| Interaction | Experience-wide or contextual visitor offer, activated by one subject/event and invoking a supported target capability; an offer is never armed as an automatic Activity |
| Guide / Stop | Optional ordered occurrence sequence; Stop identity references a whole Presentation, with local entry, Next, pacing, Gate and choices |
| Seam | An Experience transition into the following resolved Stop, using Camera support and owning local holds/invocations; never a second Camera graph |
| Execution session | Private session, visit, transition and invocation identities; live Camera requests, signals, media playheads, channel ownership, visitor history and detour bookmarks |

The ordinary Card exposes a plain primary explanation. Accepting its first
non-empty text creates one default narration use; subsequent edits update that
use. It does not copy the text into two independently editable authorities.
Presentation intention/short meaning remains separately available when needed;
text that is merely a summary is not silently spoken. Existing Meaning-only
fixtures are deliberately adapted to an explanation reference, not heuristically
converted at every render. Duration/captions derive from explanation text; timing
detail is optional, including the donor's duration override. Additional narrations
remain supported after disclosure. A named passage choice creates a marker at
that passage's current local time; its stable identity and explicit seconds are
the cue reference. Rename, move, remove and out-of-duration repair are real
controls. Text/duration edits do not silently rescale explicit marker placement.
This preserves donor semantics while adding a useful phrase door; smart text
alignment is deferred. Captions and estimates honor the resolved duration.

A subject-local audition projects supported values temporarily. Use in Experience
captures them as an Activity in the named working Presentation, or explicitly at
Experience scope. Selection stays the selected subject/use; working Presentation
context does not silently replace selection. One uniquely matching captured use
is editable in place. Multiple matches require choosing the Activity or Capture
another; never mutate the first enumerated match. Let visitors activate this
creates an offer, defaulting Experience-wide, with “Activated by” separate from
“Operates.” Generic controls follow the descriptor, including Play/Stop actions.

### Activity and result policy

Support only the existing useful relationship vocabulary: Experience start,
Presentation entry, after a supported cue/completion with visit or Experience
arming scope, explicit visitor activation, and selected-Seam station invocation.
Every use has explicit activation; attaching an existing use to a station does
not add an accidental second entry trigger. The command either changes that
use's activation with scope disclosure, or creates an explicitly separate use.
Station invocation targets supported Activity uses/definitions, not visitor offers.

| Default or supported case | Required behavior |
| --- | --- |
| Ordinary captured Activity | Starts on Presentation entry; suitable local boundary from adapter; no lifecycle setup required |
| Explanation / local highlight | Cancel on ordinary departure; remove only owned local effects |
| Started finite casing motion | Finish may complete after departure; retain its result to the authored retention boundary. If a local boundary already expired, release only after genuine completion. Rich fixture explicitly retains casing to Experience end |
| Waiting casing → rotor dependency | Visit-local arming ends on departure, even if the rotor's potential running lifetime is Experience-long; Finish of the old casing cannot resurrect it |
| Started persistent rotor | Continue to explicit Stop or Experience end; later Views/Stops/rejoin do not reissue the same carried invocation. A fresh local narration visit remains independent |
| Light/state result | Completion means the operation finished, not that its output vanishes; local versus Experience retention remains explicit |
| Piano | Finite playback naturally returns to stopped; visitor Play/Stop is declared channel replacement |
| Replacement / cleanup | Only adapter-declared replacement is allowed; stale completion/cancellation cannot signal a later visit, reclaim a channel or remove newer ownership |

Regrouping, renaming and linked duplication preserve authored relationships;
organization is a locator only. Experience-wide listeners can deliberately remain
armed across departure. Missing capabilities or signals disable affected work
and preserve repairable instructions. Auto estimates only eligible supported
work, excludes hypothetical visitor activation, includes scheduled persistent
starts without infinite duration, and includes one breathing allowance. Use the
current resolved adapter data, not a fresh hardcoded Scene fixture.

### Presentation, Stop and viewing policy

One ordinary Add Presentation to Guide creates exactly one Stop and nothing in
Camera. Adding/removing/reordering Views edits neither Guide order nor Camera
connectivity. Creating a second occurrence never copies the Presentation or View
use. Entry policies are use Presentation entry, enter through this View, or keep
current viewpoint. Missing referenced framing is unresolved, not hold.

Keep current viewpoint suppresses automatic entry and automatic cue viewing for
that visit while narration/Activities continue; a visitor's explicit View choice
is still permitted and resumes viewing. Enter through a later cue View frames it
without seeking narration, suppresses automatic requests before that View's known
cue placement, and permits future requests. An unscheduled View has no invented
time placement. This bounded donor trial is retained for evaluation; no general
seek engine is introduced.

All eligible Presentation Views, including entry, are visitor-selectable. An
optional **Suggest a View order** explicitly creates a local manual suggestion
relation; its Next/Previous View controls do not change Stops, Camera edges or
entry role. Free choice remains available. Cue relationships govern automatic
viewing separately and never change Guide position. Explicit manual View choice
redirects current Camera work; automatic cues may queue behind an active move.
The active arrived View and queued/requested View are not conflated.

**Intentional donor loss:** separate Stops always produce distinct visits, even
when adjacent Stops reference the same Presentation. Local narration restarts on
an ordinary new Stop; past completion cannot unlock its Gate. The donor's
same-Presentation checkpoint continuity is retired because it made distinct
occurrences act like View steps. Continuous framing/narration belongs inside one
Presentation visit; detour return resumes its saved parent visit. F requires
private visit/run identity, while narration restart is this plan's product
recommendation, not a claim that F mandates restarting audio.

Guide order is the only default Next authority. Explicit target/end overrides
and labelled go/detour choices remain Experience facts. One main Guide plus one
optional side sequence is enough for this prototype; adding that structure does
not imply a production Guide format. Manual Next tests authored permission and
valid target/support, not narration, unfinished activity or natural readiness.
Auto additionally waits for readiness; deliberate dwell/signal overrides remain
advanced. Back, exploration and exit remain available around Gates.

## 4. Blocking low-floor journeys and conceptual budget

### J1 — useful standalone Presentation from Reset

Reset Experience → select a real Machine → Present this → write the ordinary
explanation → accept useful Auto framing with Capture (or capture current view)
→ select/operate Machine casing → Use in this Presentation → Preview.

The visible result is explanation/caption, useful framing and the actual casing
effect. Model result: one Presentation, one narration use, one Camera View/use,
one capability Activity, zero Stops/connections. Preview is a private visit.
Exit restores the exact authoring context. No Guide, route, lifecycle/cue editor,
precision rig, timing field or schema term is required. Auto can be suggested at
creation but never authors Camera data until Capture.

A source-derived donor action count is **eight core input actions**: select,
create, add explanation, type, reselect subject, operate, capture behavior,
Preview; its View was created by the checked default. Target C9 also takes eight:
select, Present this, type explanation, Capture, subject/capability access,
operate, Use, Preview. Inline explanation removes the donor's separate Add
explanation action to pay for explicit V2 Capture. Count text entry/acceptance
consistently in a real donor-versus-C9 manual trial; this is an action budget,
not a fabricated timing measurement. Renaming/intention fields are optional.

### J3 — add a two-Stop Guide without learning Camera graphs

Exit Preview → Add A to Guide → select Piano → create B (accept its suggested
framing when wanted) → Add B to Guide → Preview Guide → Next A → B.

Each Guide-add creates one occurrence of the whole Presentation. Default Next
is Guide order; default incoming transition is Cut, with no connectivity authored.
A no-View B remains a valid meaning/activity moment at the current viewpoint;
normal useful framing is one ordinary Capture, not graph setup. Repeating J1 for
B supplies the richer useful case. No Overview disclosure is required for adding,
selecting or editing either Stop. Preview Guide is directly accessible; it does
not require standalone Preview followed by an extra Start Guide action.

Compare the observed action path and help requests with the donor, including the
explicit Capture difference. Required concepts remain subject, Presentation,
explanation, View, capability, Preview, then optional Guide/Stop. A valid quickstart
must end here; advanced work is not required to fix missing defaults.

### Additional jobs that expose richness without global machinery

| Job | Actual controls → authored result → visitor/runtime result |
| --- | --- |
| Add several Views | Presentation Show / Capture or Reuse → more uses in the same Set, no new Stop/edge → choose Views or run a named cue while the same visit/explanation continues |
| Sequence capability work | Activity detail: after casing finished; local/Experience boundary → explicit dependency/arming/retention → rotor starts only after valid completion, early departure disarms waiting work |
| Offer participation | Operate Light / Let visitors activate / Activated by Switch / availability → distinct trigger and target → click Switch or use accessible control, Light changes with no navigation |
| Revise occurrence | Peek Stop / Entry, Next, Pacing, Gate in Card → only that Stop changes → Preview reflects entry/continuation permission; shared content still shared |
| Revise framing locally | Camera Card / supported local scope / accept → detach-and-retarget once → only chosen use or Stop entry changes, honest route consequences |
| Repair loss | World Machine profile replacement / repair notice / compatible rebind or remove → broken original instruction preserved until acceptance → unaffected narration/Guide still usable; required Gate explains refusal |

## 5. Camera-owned default Travel — recommended decision

**Recommendation: choosing Travel explicitly prepares the missing direct Camera
connections for that Seam, then selects Travel, in one aggregate authored edit.**
Default Guide-add remains Cut. Presentation Set membership, Guide membership,
selection, View addition and Preview never generate connectivity. Ordinary Travel
is deliberately requested; it is not an inference from coexistence.

| Option evaluated | Judgment |
| --- | --- |
| Travel plus per-origin Connect/graph construction | Retire as the ordinary path: truthful but makes a routine creator job depend on Camera topology knowledge |
| Separate lightweight Create route | Keep as advanced repair/preparation if useful; as the default it adds a concept/action the explicit Travel request can already authorize |
| Runtime-only implicit direct traversal | Reject for this prototype: obscures which Camera support was authored, is harder to edit/reuse/diagnose, and risks a hidden fallback path |
| Travel prepares direct support through Camera | Recommend: narrow explicit user intent, reusable/editable Camera-owned support, transparent consequences and one coherent history result |

Experience supplies eligible origin View references and destination viewing
intent. Camera resolves and validates those requests, reuses existing directed
connections without changing their anchors/pace, and creates only missing direct
connections. Generated endpoints come from the referenced Camera Views;
new direct connections have zero authored interior anchors. Same-View movement is
Camera's zero-distance evaluation, not a fabricated edge. Missing/unresolved entry,
unsupported Camera transition or held destination yields an explanation/repair choice,
never implicit Capture, forced Cut or a fake route. An intentional no-View/held
entry is not labelled a broken View.

This decision concerns **Guide Travel**. Presentation-local manual/cued View
requests remain Camera framing invocations, usable without authoring Guide route
connectivity. Camera supplies their supported direct movement/evaluation through
the same invocation factory. No View request creates Stops or connections, and
ordinary multi-View explanation must not acquire a graph prerequisite.

Prepare all currently legitimate origins, not just a convenient entry pair.
Once visitor UI exposes entry and every available Set View, those all count,
including the shared entry still available after Stop-specific specialization.
An additional private Stop entry is another origin. Coverage may therefore differ
from C8's three-origin specimen; truthful coverage wins over its count. Later
adding a View or changing entry does **not** automatically repair connectivity.
Show “Travel needs support for the new View” and offer one explicit Prepare missing
routes/repair action; advanced Edit route still exposes per-origin work.

Experience selects Travel and owns the Seam invocation; Camera owns creation,
route validity, pose/framing/projection and movement evaluation. Use the existing
aggregate command/history transaction for Camera additions plus local Seam policy.
One Undo restores both domains; it never restores viewpoint. Report prepared and
reused support with owner/reach. Editing an existing shared route/pace invokes
the Ask Rule; a reuse does not silently change that route. Switching to Cut leaves
Camera connectivity intact but draws/executes no traversal or route beats.

### Live start and manual continuation

Direct default connections declare Camera support for a live-start invocation.
On early Next, View choice or rejoin, Camera evaluates from the actual interpolated
pose, cancels abandoned movement/queued cues by generation, and supplies the new
path, arrival and duration. No source endpoints are moved or serialized from the
session. Experience supplies time/holds; it does not interpolate or construct a
join from the visitor eye itself.

For this bounded prototype, extend the same Camera invocation factory to the
supported anchored route: generate its departure from the live pose, preserve
authored interior observer anchors and destination, and re-evaluate path/station
timing there. The actual invoked path may differ from the nominal View-to-View
authoring projection; it is Camera's evaluated instance of that route. No collision
avoidance, safety guarantee or route search is claimed. Invalid routes/stations
remain explicit failures, but finishing a previous move is never an implicit Gate.
Do not use Cut as a hidden early-Next fallback or run a second tween to regain
departure. Prove live-start truth and source immutability before changing the C8
departure-wait assertion.

## 6. Preview and visitor runtime requirements

Preview this Presentation starts a standalone visit even when a Guide exists.
Preview Guide directly starts its chosen/default Stop. Preview Experience can
start with zero Presentations/Stops and available Experience-wide offers. These
entries share one semantic runtime with isolated sessions, not three engines.
Visitor opening another available Presentation is a deliberate navigation request;
from a Guide it saves a bounded return bookmark, otherwise it starts a fresh visit.
Closing a standalone Presentation returns to exploration, not authoring.

Free exploration pauses Auto and releases Camera, keeping activity policies and
visitor participation. Distinguish click from drag so subject activation works on
Stage in exploration; multiple offers open a small choice, not first-match execution.
Keyboard/panel offers remain equivalent. Manual Guide navigation and manual View
choice reclaim guidance from the actual pose. Standalone Rejoin restores current
Presentation viewing intent; Guide Rejoin restores current Stop intent. Both
preserve visit/playhead and leave Auto off. Skip passed Camera cues, preserve future
cues, and compute eligible remaining work rather than replaying a full estimate.

Retain the bounded detour policy: pause parent narration/captions and automatic
viewing; subject Activities follow their existing declared boundaries while the
parent visit is suspended; a new detour has its own visit. Return resumes the saved
parent run, viewpoint intention and supported remaining work from the live pose,
with Auto off. A go choice abandons the bookmark and applies ordinary departure
cleanup. Ordinary Back uses actual history and a fresh local visit. Characterize
pause-versus-continue expectations manually; no universal nested pause/seek engine.

Captions, transcript highlight, cue emission and readiness share the narration
playhead. Provide caption toggle/full transcript and truthful paused/completed
states. Simulated media remains labelled. One text reading-rate policy and small
fixed steps are sufficient; document estimate/observed tolerance (at most 0.25s
for supported examples) rather than demand arbitrary-tick scheduling equivalence.

Preview freezes Layout, Scene, Camera, Experience and source history. Auditions
are cleared/suspended before entry. Hide and deactivate every editor writer, rig,
selection affordance and task input. Reviewer instructions may remain a separate
read-only review aid, never visitor authoring machinery. Exit restores lens,
canonical selection, Card, accepted task/inspection and realized standpoint through
their existing authorities. A fresh session has no retained effects/bookmarks.
No production visitor routes/chunk architecture are changed by this static prototype.

## 7. Fixture adaptation and required local coordination

**Use the donor's authored example concepts in the current Museum/P26 World.**
Keep the accepted walls, openings, ceilings, artwork, geometry/evaluation, World
journeys A–F and shell. Do not replace them with the donor workshop. Adapt positions,
scales and Camera framing to the current World. Simple recognisable geometry is
sufficient; Machine casing/rotor must be visibly distinct and operable, Piano,
Light and Switch distinguishable, and imported mesh identified as a fixture stand-in.
This is not asset import or T2 component authoring.

Reset Experience clears Experience/Camera fixture authoring, effects, auditions,
history and review observations, retaining the current accepted Museum baseline
and real subject fixtures. It creates no placeholder Presentation. The existing
full Reset may restore the accepted baseline World as well; label the distinction
so Experience reset does not silently discard independent World source edits.
Load Example is an explicit replace/load command with the same transient cleanup;
it starts no playback, precision, Guide Overview or Camera motion. No fixture owns
selection/task/standpoint. Explicit Open and Bring into view remain product actions.

| Tier | Required authoring/editability |
| --- | --- |
| **Authorable from Reset** | J1, two-Stop J3, normal entry/Next/Auto defaults, explicit Travel preparation, subject capability capture/update, simple visitor offer, no-View environment creation, add/reuse View without Stop/edge creation |
| **Editable after Load Example** | Explanation/cue labels and placement, casing → rotor dependency and scope, lifetime/retention, generic highlight/visibility, View entry/choice/suggestion roles, Guide reorder/repeat/entry/Next/pacing/Gate, choices/detour labels/targets, local/shared definition edits, profile replacement/compatible repair, anchor/pace/hold/invocation binding |
| **May be fixture-authored** | Rich narration/cues, three separated Views, comparison multi-subject focus, off-Guide Wall detour, environmental composition, repeated occurrence stress, multiple routes/origins, authored anchors/named station and representative station-bound invoke/hold. Dynamic construction of all these structures is not a prerequisite |

The main Load Example includes:

- Machine explanation, three distinct Camera Views, named inside/output cues,
  finite casing work, local highlight and dependent persistent rotor. One main
  Stop presents the whole explanation.
- Comparison Presentation using Machine + imported mesh and a reused overview;
  a second main Stop. A repeated occurrence can be included for scope prediction
  without turning every machine View into a Stop.
- Piano Play/Stop, rotor toggle/Stop and Switch → Light offers at Experience scope,
  plus one contextual offer to prove availability versus organization.
- Existing Layout Wall assembly Presentation as an off-main-Guide detour with
  explanation and transient representation invocation; no Scene-owned fake Wall
  topology/property. Reuse `wallSampler` / `frameUnrolled` and the existing World
  representation realization through a small runtime-safe adapter, without
  calling authoring `Look`/`unfold` task/history helpers in Preview. This reuses
  the prototype evaluator, not a second reconstruction or production compiler.
- A no-View atmosphere Presentation outside the Guide, affecting Scene ambient
  intensity only in session. Keep its visitor entry reachable.
- Machine replacement profile lacking rotor and a generic extra mesh profile;
  World profile selection exposes capability gain/loss via ordinary adapter UI.
- One supported Travel Seam with a route, interior anchor/named station, an
  Experience hold of visible duration and a capability invocation whose only
  authored activation is that station. A deliberate partial-support/repair case
  may live in the conformance stress fixture.

Keep Load Conformance as the existing six-Stop advanced specimen, adapted to the
reconciled semantics; it is not a substitute for the richer example or Reset.
Both use the same model/adapters. C8's 2/3 gap is reproduced from an intentionally
partial or later-broken route through visible controls/explicit loader, not by
requiring new Travel requests to leave avoidable gaps.

### Local Camera station + beat/hold projection

This remains a required real interaction, not a new global timeline. From Peek
or the Stop Card open the selected Seam; the triptych retains source/transition/
destination. Coordinate, or existing coordination, opens the local strip inside
the central Seam instrument. The main example contains data so it is immediately
reviewable without building a timeline tool first.

| Projection/interaction | Requirement |
| --- | --- |
| Camera route row | Departure → authored interior anchors/named stations → arrival, evaluated by Camera; generated helpers remain read-only and unbindable |
| Experience event row | Distinct invoke/beat species bound to stable station identity; Card identifies the focused event, target capability and occurrence reach |
| Hold row | Distinct duration bar and editable duration, including its station binding; duration is not a copied Camera track |
| Spatial ↔ temporal focus | Selecting a station, invoke or Hold highlights its own counterpart on Stage and strip, preserves canonical Stop selection for mere task focus; event focus is not just a station dropdown |
| Geometry | Edited on Stage using Camera operations; background clicks add anchors only in explicitly armed route editing, not merely because coordination is visible |
| Pace/anchors/holds | Changes keep binding IDs stable; seconds and arrival derive from Camera evaluation plus local hold mapping, with shared Camera scope confirmation where needed |
| Execution | Only traversed route's events execute, once per transition invocation; no entry-plus-station duplicate, no automatic interaction-offer execution; Cut executes none |
| Repair | Deleted/rebound route/station or unsupported invocation is an explicit repair/refusal, no nearest station/index/time fallback |

Use the existing Camera kernel and `movementTiming`/`coordinateTiming` projection.
Consolidate any eligibility/timing differences rather than create another path
evaluator or history. Display nominal authoring station times as estimates;
actual live-start Preview uses that Camera invocation's evaluated timing. Both
must share station identity and rules. Fixture-authoring is permitted for the
initial geometry/data; focus, hold edit, supported invocation rebind, pace edit,
Stage anchor edit and Preview execution must be real product interactions.

## 8. UI changes and Reviewer Presenter

### Fit the accepted shell

| Home/posture | Required correction |
| --- | --- |
| Ordinary Presentation Card | Meaning/Focus/Show, plain primary explanation and obvious subject capability door; content earns Happens and Visitor can. No raw start/end/use/definition vocabulary or generic builder as the required path |
| Selected World subject in Experience | Honest subject identity, supported audition controls and named capture destination; Present this / Use in Experience / Let visitors activate. Do not silently select its Presentation |
| Selected Activity/offer | Resolve its real semantic identity in shared selection/Card; desired value, activation/target and repair first; lifecycle/reuse details disclosed only when wanted |
| Compact Guide / Peek | Current/selected occurrence plus enough nearby Stop names to select normally; compact overflow if needed. Selection keeps Peek and makes normal Stop Card available |
| Stop Card at ordinary depth | Entry/Next summary and accessible Entry / Next / Pacing / Gate sections; local versus shared reach remains obvious. Open Seam and Preview Guide are direct doors |
| Explicit Guide Overview | Preserve breadth, L0/L1/L2, repeat/reorder/warnings and numbered Stage pins; selection and explicit Expand occurrence are separate actions |
| Selected Seam | Existing triptych, supported default Travel/repair, deliberate Edit route and Coordinate. Opening never changes standpoint/reading |
| Camera precision | Stage has Outside/Through/Plan, truthful observer/frustum/target/frame geometry, direct grips, one active tape/value and explicit return. Move ordinary numeric/property mode list into Camera Card/sidebar; select a Stage grip directly. No floating six-property dashboard |

Keep all PLATE material/type/control roles, Index/Stage/Card landmarks, Camera
cyan/reference species, ochre local selection and explicit scope acceptance.
One active tape is allowed on Stage; a duplicate full numeric form is not.
Through remains clearly authoring with editor chrome; Preview removes it.
No new workspace rail, second renderer or shell composition is proposed.

### Observational Presenter, split into quickstart and advanced walkthrough

Presenter reads source plus recorded product/runtime outcomes. Back/Skip/close/
reopen change instructions only. Next is earned by the specific outcome, not a
button press or field existence. Do not count loaded content as Reset authoring
or invent a completion when a reviewer skips. Keep the review aid usable while
Preview is active without mounting any authoring controls there. Explicit Reset
and Load Example remain separate, labelled source-loading commands; no secret
state preparation, provider mutation or Camera positioning inside step navigation.

| Step | Creator/visitor action and observed outcome |
| --- | --- |
| Q1 | Select real subject and create one Presentation; stable subject reference and no Guide |
| Q2 | Give meaning/explanation and explicitly accept framing; one narrated moment plus Camera-owned View use |
| Q3 | Discover/operate its real capability and Use in Experience; captured parameters and visible audition, no source change |
| Q4 | Preview without Guide; explanation/caption, framing and capability execute in a private visit |
| Q5 | Exit and add that Presentation to Guide; exactly one Stop, quiet Peek |
| Q6 | Create/add a second Presentation; two whole-moment Stops, no manual graph |
| Q7 | Preview Guide and Next A → B; order resolver and distinct destination visit actually used |
| Q8 | Free exploration and rejoin; move Stage, keep participation/visit, resume framing from live pose with Auto off |
| A1 | Add/use additional Views; no new Stop/edge, explanation continues, Next View distinct from Next Stop |
| A2 | Loaded capability sequence/lifetime; observe casing completion → rotor, early disarming, carried run and visitor Stop |
| A3 | Stop entry policies; compare Presentation entry, specific later View and hold while content still runs |
| A4 | Request simple Travel; Camera prepares support, visitor travels without graph surgery |
| A5 | Open advanced Edit route; see truthful origins, path, anchors, pace, gap/repair and explicit return |
| A6 | Coordinate local Seam; select station/event/Hold, see counterparts, edit duration and Preview exactly-once invoke/hold |
| A7 | Visitor interaction; activate Switch → Light on Stage or accessible control while exploring |
| A8 | Detour/return; parent narration/playhead resumes, no duplicate entry, new travel from current pose |
| A9 | Shared versus local edit scope; predict reach before editing, cancel shared proposal, accept supported local/shared edit, Undo |
| A10 | Lose rotor capability via World profile control, follow notice and repair; preserve other content and show truthful affected Preview behavior |

A creator may stop after Q7 with a usable guided Experience, or after Q4 with a
usable standalone moment. Q8 demonstrates agency without requiring advanced
authoring. The advanced walkthrough may explicitly load the rich example; it
cannot mark quickstart authoring complete because that example exists.

## 9. Acceptance — creator jobs first, then composition

Each journey records **task → exact visible controls → authored result → runtime
result**, including intermediate states, cancellation and revision. Source
snapshots are read-only observers. The only source-building exceptions in browser
journeys are the labelled Reset/Load Example/Load Conformance controls; no test API
may select tasks, create Gates, choose final poses, create Activities or make a
product job pass. Deterministic clock stepping may test timing after real authoring,
but it cannot bypass visitor permission or substitute for one real-clock run.

| Gate | Blocking proof |
| --- | --- |
| **J1 — standalone quickstart** | From genuinely empty Reset, actual subject-local controls create explanation/framing/Activity and Preview it, no forbidden advanced disclosure. Update captured value without duplication. Freeze all source/history; test Preview return |
| **J2 — Presentation/View independence** | Add/reuse three Views with no Guide/edge; add one Stop only; cue and manual choice keep explanation/visit; opt-in suggested order is separate and does not rewrite entry or connectivity |
| **J3 — simple Guide and entry/permission** | From J1 add A/B and Preview Guide directly, early Next by button/keyboard/Auto rules; compact Stop editing without Overview; repeated identity, order/explicit/end, hold and later-entry cutoff, Gate block/release/revisit |
| **J4 — lifecycle and natural readiness** | Loaded/editable casing/rotor/local highlight; change start scope/home independently, dependency/retention/interruption, early departure, persistent carry, stale completion/newer command. Narration/caption/cues/estimates agree; finite and persistent overlap numeric oracle and actual route cost/holds counted once |
| **J5 — agency and detours** | Real Stage drag, direct subject click during exploration, manual View/Next/Back during movement, standalone/Guide rejoin, independent Presentation opening/closing, go versus detour/return. Preserve visit or create a fresh one according to §3/§6; no queued past-cue replay |
| **J6 — capability/offer breadth** | Machine/Piano/Light/Switch/mesh/environment and native Wall representation through owning adapters; global-only Experience with zero Presentations/Guide, contextual availability, multiple offers, cross-target activation, finite result and Play/Stop. No source mutation or accidental navigation |
| **J7 — Travel and coordination** | Explicit Travel after Reset creates only scoped Camera support atomically, all real origins covered, no pairwise Set autoconnection. Live-start Next/redirect/rejoin path truthful and frozen-source. Loaded route/anchor/station/invoke/Hold reachable; counterpart focus, duration, stable refs, pace/geometry change, deletion repair, Cut/no other-route execution and exactly-once invocation |
| **J8 — revision and repair** | Actual rename/copy/link/detach/replace/regroup/remove, contribution-local/shared and Stop-entry-local scope, profile loss and gain, issue links/rebind/remove, missing View/cue/availability/start/boundary/Next/Gate. Undo/Redo restores source relationships only, canceled proposals write zero |
| **J9 — Presenter** | Quickstart and all advanced outcomes observe real work; Skip/Back/close/reopen/source load isolation; review aid works across Preview; no hidden authoring or weak “field present = succeeded” check |
| **J10 — shell and instruments** | Retain six advanced specimens and required transition comparisons; add ordinary subject capability, compact Stop Card, revised Camera Card/Stage, loaded coordination focus. PLATE information homes, truthful geometry, one active tape, return, hit reachability at 1440×900 and 1024×768 |
| **J11 — isolation and preservation** | Freeze authored Layout/Scene/Camera/Experience + history during cues/offers/early Next/Auto/detour/explore; editor writers inactive; exact Preview return, both-lens parking/Resume and World A–F/regression baselines retained |
| **J12 — manual comprehension** | Presenter-closed Reset task completed without explanation of graph, lifecycle or schema; record actions/help/forced depth and donor comparison. Predict Stop/View counts, entry/Next, local/shared reach, detour pause, direct activation and station/Hold correspondence; inspect before/after model/runtime outcome |

Manual checkpoints happen after the low-floor pair (C9.1/C9.3), after Travel/agency
(C9.4/C9.5), and at the rich example/final composition gate (C9.7–C9.9).
Record comprehension failures as blocking workflow defects where they breach the
low-floor contract; improve controls before broadening the engine. For retained
experimental entry-cursor/detour-pause policies, record predicted versus observed
behavior explicitly; a test cannot ratify a policy by itself.

Keep C8's six full-window states, existing macro contracts M0–M8, and its required
Set/Overview, Overview/expanded occurrence, route/coordination and precision/Preview
comparison pairs. Add **compact Peek + Stop Card**, **subject audition → captured
Activity → Preview**, and **station/event focus → runtime hold/invoke** transitions.
Review all after the final shared UI change. Screenshots support visible hierarchy;
they are never the primary acceptance for a creator job.

Existing accepted behavior must have successor proof before assertion replacement,
under the [repository test doctrine][tests]. The specific C8 departure-wait test
and per-origin manual Connect recipe are intentionally replaced: retain their
protected single-Camera/path/source truths, prove live-start behavior through the
same evaluator, and mutation-test a second tween/unsupported fallback. Keep gap
refusal tests with deliberately missing support. Add targeted mutations for
organization-as-start, hold cue leakage, entry-plus-station double invoke, empty
Reset hidden placeholder, silent first-offer choice and Peek forcing L2. These
are behavioral/wiring obligations, not new source-name pins.

### Final verification and evidence boundary

Run the unified Node model/runtime/Camera suite and the complete prototype QA
axis driver with the new journey/Presenter checks; retain all World axes and
existing mutation obligations. Keep the donor runnable and run its typecheck,
build, domain and browser regressions with owned browser resources per
browser-hygiene. Report donor results separately from successor parity.

Repository verification is not narrowed by prototype scope: follow
[apps/editor/tests/README][tests], including unconditional architecture lane,
full required test coverage, root check/build and documentation/whitespace gates.
The existing missing P23B fixture blocker recorded in [C8 evidence][c8-proof]
remains external to C9; report it independently if still present. Do not fabricate
the fixture, erase historical references or claim merge readiness from green
prototype tests. Restore it only through separately authorized work.

Final C9 evidence records executable revision/hash, exact journey recipes,
read-only authored/runtime snapshots, per-row parity dispositions, manual review
outcomes, updated specimens and all verification results. Only then is #113's
final external product review meaningful. Paper follows #113; no phase is closed
by this plan or by C9 completion alone.

## 10. Implementation slices in dependency order

These are reviewable vertical increments inside C9/#113. Preserve accepted World
behavior in every increment. Establish tests from the failing jobs, then change
the model/runtime and expose real controls together; never defer all wiring,
fixture or Presenter work to a final cosmetic pass. Complexity is relative:
S = contained surface, M = several existing seams, L = cross-domain/runtime work
requiring careful successor proof. It is not a calendar commitment.

| Slice | Dependencies | Bounded work and review result | Gates / complexity |
| --- | --- | --- | --- |
| **C9.1 — restore the standalone creator loop** | None | Empty Reset, primary explanation/default narration, useful derived framing + explicit Capture, subject-local descriptor controls/audition/Use/update, honest Activity identity, no-Guide Preview. Introduce quickstart instructions and record baseline action comparison | J1/J11; **M**, main risk is source/audition/capture wiring |
| **C9.2 — reconcile local composition execution** | C9.1 | Separate organization/activation/arming/boundary/retention; repair missing cue/scope validation; captions/transcript, several Views, opt-in suggestions, cue cutoff and hold policy; current-adapter Auto estimates. Incrementally migrate rich machine data | J2/J4; **L**, lifecycle and estimate/playback correspondence are the largest non-Camera work |
| **C9.3 — normal Guide/Stop editing** | C9.1 + entry policy from C9.2 | Peek selection versus explicit L2, usable normal Stop Card, direct Preview Guide, one Stop per Presentation, order/target/end, default Auto plus advanced dwell/signal/Gate, repeated visits. Retire checkpoint-as-View-step semantics explicitly | J3/J10; **M**, existing model can be retained, selection/disclosure and runtime entry need joint proof |
| **C9.4 — Camera default Travel and live invocation** | C9.2–C9.3 | One explicit Travel preparation transaction, truthful full-origin coverage, scoped reuse/repair, Camera-owned live-start/redirect evaluation and timing, no departure readiness Gate. Preserve advanced route/anchors/return and replace C8 restrictions with successor proof | J7/J11; **L**, highest ownership/Camera risk; stop if a second evaluator or production interface becomes necessary |
| **C9.5 — visitor participation and agency** | C9.2–C9.4 | Interaction-only Preview, availability/trigger/target controls, multiple offers, click versus drag, all eligible Views, standalone rejoin/open/close, go choices and one side detour, parent bookmark/remaining-work behavior. Fixture and Presenter instructions accompany it | J5/J6; **L**, session transitions and run ownership need cross-case verification |
| **C9.6 — useful revision and repair** | C9.2–C9.5 | Generic profiles/replacement controls, supported capability rebind and routed notices; definition copy/link/local/shared scope, regroup/removal preservation, missing reference repair and aggregate Undo. No universal graph cloning or story forks | J8; **M**, reach/cancellation and repair usability are the review risks |
| **C9.7 — rich fixture and exercised local coordination** | C9.4–C9.6 | Finish donor example adaptation including native Wall/environment; load representative route/stations/invokes/holds. Fix activation duplication/event focus, edit duration/rebind/pace/anchor through UI, prove traversed-route-only execution; preserve stress fixture and update recipe | J4–J8/J10; **M**, existing strip/evaluator reused; runtime-safe Wall adapter must reuse World representation |
| **C9.8 — concise Camera precision surface** | C9.3–C9.4 | Move property/mode depth into Camera Card; keep direct Stage grips, active tape, postures, truthful geometry and current-context return. No new manipulation system or general gizmo | J10/J11; **S–M**, chiefly disclosure and hit/focus continuity |
| **C9.9 — Presenter completion and final acceptance** | C9.1–C9.8 | Complete outcome predicates and Preview-visible read-only instructions, all 18 required walkthrough topics, manual comprehension checkpoints, parity dispositions, final transitions/visual comparison and repository gates. Publish review evidence only after final executable freezes | J1–J12; **M**, integration/review effort; tests and Presenter already grow in earlier increments |

The program is medium-to-high complexity, not a polish pass. Model/lifecycle,
Camera live invocation and visitor transitions are the three high-risk increments;
the rest mainly reconnect existing capabilities and disclosure. One PR #113 can
contain all increments coherently because they reconcile the same executable,
model and workflow. Do not broaden it to production foundations, unrestricted
authoring tooling or another prototype to absorb that complexity.

## 11. Exact retirements, deferrals and non-goals

Retain from V4.1: subject-local capability discovery/audition/capture, reusable
meaningful Presentations, multi-View explanations, cue/dependency coordination,
independent trigger/target offers, optional one-Stop guidance, Auto versus Gate,
interruptions/result retention, free exploration/rejoin, detour pause/return,
reusable/local/shared edits, repair and genuinely empty Reset.

Preserve V2: World | Experience shell/visual language, Camera-owned Views/routes/
evaluation, explicit Capture, unordered Set and scoped spatial disclosure,
distinct Stop/visit/run identities, declared channel replacement, accurate Ask,
aggregate history, exact Preview return, both-lens parking/neutral Resume and
advanced route/coordination instruments.

Intentionally retire or change:

- Donor React shell, Experience-owned Camera definitions, editor selection
  navigation and independent Camera tween mechanisms. Useful behavior is adapted
  into current authorities, never copied as architecture.
- Donor first/suggested-View entry inference: explicit Presentation entry role
  owns entry; suggestion order is optional internal assistance.
- Donor adjacent same-Presentation checkpoint continuity and batch View promotion:
  distinct Stops are visits to whole moments; continuous View work remains inside
  one visit. Explicit extra Stop + entry selection preserves deliberate appearances.
- Donor deletion-to-hold and unrestricted last-command-wins: F requires explicit
  unresolved repair and declared channel replacement.
- Donor Scene/source Wall unfolding flag: transient Layout representation retains
  the useful assembly reveal without mutating architectural truth.
- V2 generic builder as the primary capture path, fixed five-second dwell-only
  exposure, compulsory L2 on Peek selection, departure-wait Travel permission,
  placeholder Reset and station binding layered onto implicit entry activation.
- Donor Presenter provider mutation shortcuts and V2 title-only walkthrough:
  visible source controls/explicit loaders perform changes; Presenter observes.

Explicit deferrals outside #113: production persistence/codecs/F interface
amendments, portable performance resource authoring/versioning, real media/audio,
asset import and provider integration, multiple named Guides/Experiences, event-
conditioned availability beyond Experience/Presentation scope, full narration
seek/pause/smart text alignment, arbitrary condition/script logic, generalized
scheduler, collision-aware route search, total-Guide duration service, custom
motion rates, full future 3D manipulation and production device/accessibility
qualification. These were absent/deferred in 4.1 or concern future production;
none excuses losing a behavior present in the parity inventory.

No shell redesign, ownership reopening, production persisted format, T-track
implementation, Paper work, global Camera timeline, second prototype, commit,
push, merge or phase closure is part of this planning task.

## 12. Self-review and owner decisions

Planning self-review: required donor implementation surfaces inspected; actual
later View suggestion behavior included; every meaningful behavior classified
with explicit preservation/change/retirement; failing probes separated from green
tests and unread usability evidence; no source snapshot or generated geometry is
promoted to authored truth. Low-floor tasks have concrete model/runtime results
and a donor action/concept comparison. Travel/default creation/live-start/history,
hold and station invocation policies are decided explicitly. Rich fixture tiers,
local coordination interaction, all 18 Presenter topics, manual checkpoints,
small dependency-ordered increments and repository verification are specified.

**No unresolved owner decision is required to complete this plan.** Travel
preparation, distinct repeated visits and bounded detour/cursor defaults are stated
recommendations for owner review, with losses and alternatives visible. They are
not silently ratified by writing the plan. Implementation awaits a subsequent
owner instruction. If later manual review rejects a comprehension trial, revise
this owning plan section rather than append a review diary or implement several
alternative engines. This task stops after the plan and its self-review.

[unified]: ../../../../../prototypes/spatial-authoring/README.md
[donor]: ../../../../../prototypes/experience-authoring/README.md
[donor-plan]: ../../../../../prototypes/experience-authoring/PROTOTYPE_4_1_PLAN.md
[d-model]: ../../../../../prototypes/experience-authoring/src/model.ts
[d-fixture]: ../../../../../prototypes/experience-authoring/src/fixture.ts
[d-controls]: ../../../../../prototypes/experience-authoring/src/Controls.tsx
[d-runtime]: ../../../../../prototypes/experience-authoring/src/runtime.ts
[d-scene]: ../../../../../prototypes/experience-authoring/src/Scene.tsx
[d-camera]: ../../../../../prototypes/experience-authoring/src/camera.ts
[d-planning]: ../../../../../prototypes/experience-authoring/src/presentation.ts
[d-inspector]: ../../../../../prototypes/experience-authoring/src/Inspector.tsx
[d-visitor]: ../../../../../prototypes/experience-authoring/src/Visitor.tsx
[d-presenter]: ../../../../../prototypes/experience-authoring/src/Presenter.tsx
[d-app]: ../../../../../prototypes/experience-authoring/src/App.tsx
[d-history]: ../../../../../prototypes/experience-authoring/src/history.ts
[d-tests]: ../../../../../prototypes/experience-authoring/tests/model.test.ts
[d-history-tests]: ../../../../../prototypes/experience-authoring/tests/history.test.ts
[d-browser]: ../../../../../prototypes/experience-authoring/tests/e2e/authoring.spec.ts
[d-regressions]: ../../../../../prototypes/experience-authoring/tests/e2e/regressions.spec.ts
[v-model]: ../../../../../prototypes/spatial-authoring/app/experience-model.js
[v-commands]: ../../../../../prototypes/spatial-authoring/app/experience.js
[v-runtime]: ../../../../../prototypes/spatial-authoring/app/experience-runtime.js
[v-ui]: ../../../../../prototypes/spatial-authoring/app/experience-ui.js
[v-caps]: ../../../../../prototypes/spatial-authoring/app/experience-capabilities.js
[v-camera]: ../../../../../prototypes/spatial-authoring/app/camera-evaluation.js
[v-coordination]: ../../../../../prototypes/spatial-authoring/app/experience-coordination.js
[v-main]: ../../../../../prototypes/spatial-authoring/app/main.js
[v-fixture]: ../../../../../prototypes/spatial-authoring/app/conformance-fixture.js
[plate]: ../../../../reference/design-system/editor-shell-and-visual-system.md
[instruments]: ../../../../reference/design-system/spatial-instrument-grammar.md
[architecture]: ../../../../reference/architecture.md
[north-star]: ../../../../reference/north-star.md
[amendment]: ../../../../reference/decisions/world-experience-reconciliation-2026-09-29.md
[foundation]: ../../../../reference/composition-execution.md
[c1-c8]: ./conformance-plan.md
[c8-proof]: ../../../../../prototypes/spatial-authoring/qa/EXPERIENCE-CONFORMANCE-ACCEPTANCE.md
[tests]: ../../../../../apps/editor/tests/README.md
