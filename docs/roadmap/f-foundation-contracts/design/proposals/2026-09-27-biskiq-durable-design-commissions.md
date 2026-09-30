# Biskiq — three durable design commissions

**Date:** 2026-09-27  
**Status:** non-authoritative research/design proposal; recommendations for owner selection.  
**Scope:** product assessment and designer handoff only. This report approves no implementation, amends no contract, changes no phase scope, and places no new gate on P23B or F. It follows the repository's `design/proposals/` convention and is hosted beside F because its findings should inform foundation consumers and amendments.  
**Handoff:** give a designer the common brief in Part B plus any one commission. The names below describe assignments, not required product modes or navigation labels.

## Part A — Product assessment

### Recommendation

Commission **Explain & Direct** first: let a creator turn spatial inspection into a reusable explanation, experience it as a visitor, and revise its subject without rebuilding the explanation. It is the strongest complement to P26 and the clearest test of Biskiq's distinctive promise beyond modeling or staging.

The three commissions, in priority order:

| Priority | Commission and principal workflow | Value now and durable output | Foundation learning | Independence and redesign risk |
| --- | --- | --- | --- | --- |
| **1** | **Explain & Direct:** inspect → capture intent → compose a performance → use it in an Experience → interrupt/rejoin → revise. | Connects P26's powerful act of looking to something an audience can understand. Reusable design for capture, scope, timing, preview, repeated visits and conflict recovery. | F.3 control/representation semantics; F.1 subjects versus uses; F.2 resource versus Experience ownership; F.4 compound capture; F.5 lifecycle and session-program needs. | A separate workspace can use a small prepared fixture. Highest interaction uncertainty: a premature universal timeline would cause substantial redesign. Start with simple views/states and reveal timing only when needed. |
| **2** | **Objects & Assemblies:** begin with an object → compose and place instances → inspect components → change one use or its definition → review an update. | Makes the broader, object-first product tangible. Reusable design for selection depth, edit scope, attachments, overrides, ingest capability disclosure and revision repair. | F.1 component/instance identity and repair; F.2 definitions, revisions and locks; F.3 frames and baseline versus inspection; F.4 coherent acceptance. | Independent fixture with declared component capabilities. Core interactions are durable; arbitrary imported hierarchy and correspondence are the largest technical dependency and source of false confidence. |
| **3** | **Publish & Review:** prepare an Experience → enter as an audience member → make a choice/give contextual feedback → revise → republish and revisit. | Tests whether the work remains useful outside the editor. Reusable design for entry, participation, release readiness, feedback context and change communication. | F.1 public locations; F.5 profiles and release context; F.2 Experience selection; F.4 stale authoring/release boundaries; separate audience records. | The most independent from geometry engineering: author, visitor and revision states can all be simulated. Core trust semantics are durable; live collaboration and the eventual delivery product are less settled. |

**Why this order.** Explain & Direct combines creative payoff with the most consequential unresolved interaction questions: what is saved from inspection, who controls a moving subject, and what returning to a presentation means. Objects & Assemblies is close behind and supplies broadly reusable authoring patterns, but a generic Scene workbench would spend too much of the commission on familiar transforms, materials and panels. Publish & Review tests the actual audience value and should be commissioned alongside the first two when capacity allows; a polished publishing form alone would miss its value.

These are design-investment priorities, not engineering dependencies. Each brief supplies its own fixture and can run while P23B continues. None waits for another prototype's code or for the entire future kernel. The first two may share visual specimens or a vocabulary after review, but should not share mutable project state merely to appear integrated.

### What the evidence changes

**The synthesis is ratified, not awaiting a general architecture decision.** The [September 27 decision record](../../../../reference/decisions/northstar-ratification-2026-09-27.md) establishes the destination; the [F target contract](../../../../reference/composition-execution.md) is also owner-ratified with amendments. F.1–F.5 are written; none is shipped. Camera's separate codec unit, its simultaneous split with the Experience-order cutover, collection-capable Experiences, and required/optional extension declarations are settled shapes. A designer should test their usability and expose missing semantics, not reopen them by casually drawing a different storage model. Exact shared interfaces are proposed by the first consumer and ratified as F amendments before landing in shared code.

**The product's opportunity is continuing creative work.** The [north star, “Ratified north star” and “Strategic success test”](../../../../reference/north-star.md#ratified-north-star) centers editable spatial experiences and the loop from creation through audience feedback and revision. No Room, tour or external modeling workflow is mandatory. Revision and reuse therefore belong in the prototype's central journey, not in a final settings screen.

**P26 is a substantial experience reference with a deliberately narrow subject.** I ran the [actual prototype](../../../p26-spatial-depth/Final-Design-Prototype/README.md), selected the Garden window, unrolled its wall, changed width from 1.60 to 1.90, returned to 3D, and used the return summary to undo the edit without undoing the viewpoint. I also exercised Journey F's finder, which explains hidden subjects. The inspected source and journey definitions cover A curved wall, B section, C ceiling, D practiced use, E ordinary cross-view editing and F recovery. This was bounded inspection, not an acceptance audit or user study.

Its useful design language is concrete: persistent subject identity across Navigator/viewport/Inspector, direct handles paired with exact fields, contextual instruments, visible “view only” changes, explanations for invisibility, and separate document Undo, view trail and nested return. The prototype is plain HTML/CSS/ES modules with vendored Three.js and no build step. `app/model.js` holds the fixture and local validation; `state.js` holds session state; `actions.js` handles edits and inspection; `stage.js` renders; `draw.js`/`ui.js` provide overlays and controls; `journeys.js` drives demonstrations. It is not the production Svelte 5/Threlte application.

The [implementer reference, “Prototype-only shortcuts”](../../../p26-spatial-depth/Final-Design-Prototype/IMPLEMENTER-REFERENCE.md#prototype-only-shortcuts-do-not-copy) explicitly excludes its analytic caps, separate clipping/membership logic, per-frame retessellation and JSON-snapshot history as production contracts. Camera and Arrange are disabled in the prototype; Scene objects are passive. The [reconciliation, §5](../../../p26-spatial-depth/Final-Design-Prototype/REVIEW-RECONCILIATION.md#5-not-demonstrated) also records missing new-wall authoring, scale/accessibility evidence and user testing. This leaves substantial room for all three commissions.

**P26 also has limits worth challenging explicitly.** Its “building versus view” distinction needs to grow to include definition, instance, authored presentation and active run. A view-only trail is not a saved performance. A room-organized Navigator does not answer object-first composition. Its fixed side panels put pressure on central working space. Preserve its successful continuity and recovery while proposing scoped alternatives to workspace composition. P26's accepted journeys remain experience/QA authority; its internal state model does not become the next product model.

**Current production is a starting point, not the proposed feature set.** The [architecture authority table](../../../../reference/architecture.md#semantic-authorities-ratified-destination) and selective source checks establish:

| Landed evidence | Design implication |
| --- | --- |
| Layout has one canonical compiler; current Layout is wall-first with one floor datum. Scene is world-local and stores models, primitives, lights, materials and clusters. | Object-first creation is legitimate, but multi-level Layout and reusable assemblies must be labeled target behavior. Do not make a Room a universal parent. |
| [`SceneDocument` and `SceneModelEntity`](../../../../../packages/project-model/src/scene.ts) contain no general reusable definition/component system; clusters are editor hierarchy metadata. [`AssetModel.svelte`](../../../../../apps/editor/src/lib/museum/assets/AssetModel.svelte) loads and clones render objects. | A render hierarchy or organizational group is not proof of authored component identity. Import capabilities must be explicit. |
| [`walkFlowChain`](../../../../../packages/camera-core/src/camera-route.ts) follows Camera node links and rejects repeated nodes before returning to the start. Experience is not implemented. | Repeated editorial visits need distinct occurrences; copying a Camera node to fake the second visit would hide the very design problem worth testing. |
| [`EditorHistoryController`](../../../../../apps/editor/src/lib/editor/store/history-controller.svelte.ts) has chronological Scene/Layout entries; F.4 compound acceptance is not present. | Prototype atomic actions and their failure/Undo behavior as intended interaction, without claiming the existing history engine already provides them. |
| P20 handles project image textures; general creator model import is future work. P22 already publishes, but [`readPublicRelease`](../../../../../apps/api/src/publication-persistence.ts) revalidates source snapshots with deployed authoring code. | Neither model ingest nor publishing starts from zero, but general resources and prepared release packages are destination capabilities. A UI mock cannot establish compatibility or resource closure. |

### Relationship to active and future work

The [current baton](../../../../operations/current.md) remains **P23B**. P23B.11 is shipped/closed; the pre-P23B.8 M1 measurement and R1 release-cost ranking are next and require the owner's go. These commissions change neither that work nor its performance claims.

The [roadmap](../../../README.md) now re-derives **T1/P26 spatial**, **T2/P24 composition data**, **T3/P25 Experience data**, and **T4 release** against F. T2/T3 data work can proceed alongside T1; their editing UI consumes T1's viewport/projection seam. T3's order cutover precedes T1's migration of Camera authoring tools. T4 can begin its envelope and existing-data lowering independently. The older P24/P25/P26 umbrellas remain evidence, not a binding waterfall or feature ceiling.

Useful retained planning context: P24 identifies ordinary placement/material/light work and ingest; P25 supplies Destination, repeated Stop, semantic content and accessible navigation problems; P26 supplies continuous inspection. Superseded assumptions include P24's staging-only ceiling, P25's blanket rejection of variables/conditions and Camera-owned editorial order, and P26's editor-only representation framing. P27 components, P28 direction, P29 reuse/participation and P30 delivery/review are **provisional capability labels**, not promised schedules.

### Alternatives considered

| Territory | Judgment for this commission round |
| --- | --- |
| Broad Scene Composition Workbench | Too generic if it stops at arrange/style/group. Commission 2 earns its place by proving object-first scope, reuse and revision; those remain valuable when gizmos and schemas change. |
| More architectural inspection, multi-level editing or alternatives | Strategically important, particularly for level-qualified identity and Layout reuse. P26 already supplies a rich inspection reference; slab/ceiling ownership and structure expansion need focused Layout proofs. Prefer a later targeted brief when one of those decisions needs interaction evidence. |
| A universal timeline or visual behavior graph | Would prematurely organize the product around execution machinery. Commission 1 starts from an explanation and reveals only necessary control; it can still discover a good timing surface. |
| Asset marketplace, advanced renderer or full visitor website builder | Would pull effort toward supply infrastructure, visual polish or generic web layout. They answer less of the current foundation uncertainty than reuse, direction and durable audience revision. |

### How design should inform F

F's guarantees are settled; their practical expression and several domain policies remain open. The briefs distinguish **interaction evidence**, **small engineering proofs**, and **implementation choices**. Record findings as a creator problem, observed behavior, proposed semantic consequence, owning contract and remaining proof. A pleasant animation is evidence about comprehension and control, not evidence of valid geometry, deterministic seeking, durable identity or visitor isolation.

The immediate decision after each commission is which interaction and semantic requirements to carry into a consuming plan or explicit F amendment. It is not approval of the prototype's data structures. No general kernel, schema or production component API should be designed as part of these commissions.

## Part B — Extractable designer briefs

### Common brief — include with any selected commission

**Product and audience.** Biskiq is a browser-native environment for composing, inspecting, directing and publishing editable spatial work. Start with one capable creator explaining or reviewing something for another person. Architecture, objects and audience experience are valid entry points. The brief's scenario is a concrete test fixture; its visual subject may change if the same interaction pressures remain.

**Authority and design freedom.** These are unratified creative assignments. New concepts follow the ratified northstar/F contracts. [PLATE](../../../../reference/design-system/editor-shell-and-visual-system.md) remains normative for existing editor shell composition and visual language. A new workspace may explore a different composition; explicitly document any proposed departure from PLATE or accepted P26 behavior and the problem it solves. Such a proposal does not silently amend the shell. Visitor-facing presentation can have its own appropriate identity and does not inherit an editor Inspector or tool tray.

**Shared guarantees, expressed as design constraints:**

| Concern | What the design must make true or legible |
| --- | --- |
| Semantic ownership | Layout owns architecture and architectural representations; Scene owns object composition, instances and world presentation; Camera owns views/routes/framing/projection/evaluation; Experience owns visitor meaning, occurrences/order and contextual bindings. Reusable performances are typed resources. One workspace may coordinate these without merging their truth. |
| One compiler and one Camera authority | Architectural presentations derive from the canonical Layout output. A lifted ceiling does not create a new traversable opening. All Camera behavior realizes intent through Camera; a different timing UI or visitor controller does not acquire independent pose/FOV interpolation. Production algorithms and current filenames are replaceable. |
| Identity, references and edit scope | Names and hierarchy positions are not identity. Selection resolves coherently across surfaces. Make the affected scope visible before an edit and explain what changed afterward. References may be missing, incompatible or unauthorized and require explicit repair. |
| Lifetimes and history | Distinguish accepted source, temporary inspection, authored presentation, active run and audience record. Playback never edits the source. One logical accepted cross-domain action has one Undo result; refusal or stale acceptance preserves prior accepted work. View return is separate from document Undo. |
| Runtime and delivery | Preview/visitor semantics use runtime-safe domain evaluation; visitor delivery excludes editor selection, history, gizmos and authoring infrastructure. Immutable compiled delivery derivatives are permitted outside authored source. A prepared visitor package and an editable project export are different products. |

**Visual and interaction starting point.** PLATE combines cool structural Chassis, Paper for spatial work and integrated Instruments. Use clear information rank, restrained surfaces, humanist UI type and mechanical mono for precise values. Selection blue is not a universal active-state color. Hover, armed tool, selection, focus, derived information and refusal must remain distinguishable without hue alone. Existing shell metrics/type roles come from PLATE §§5–7, not copied scoped CSS. P26's contextual instruments, visible return, precise fields beside direct manipulation, and “why can't I see it?” explanations are reusable interaction ideas. Its tutorial journey controller is outside the product; do not turn it into an authored Experience by relabeling it.

**Prototype and handoff standard.** Deliver a runnable, self-contained interactive prototype with resettable fixtures and direct access to important states. It should support meaningful alternate actions, revision, cancellation and recovery rather than only a linear click-through. Use real spatial interaction where it decides the design; simulate unavailable evaluators, ingest, storage and network behavior openly. A mock exploded component is valid presentation evidence, not proof of a production representation engine. No backend, live publication, full asset pipeline or source-schema integration is required.

Include an annotated journey/state map, reusable interaction/visual specimens, key terminology and scope rules, a short rationale including rejected alternatives, and a handoff listing implemented versus simulated behavior, semantic assumptions, technical proofs and proposed contract departures. Use a desktop creator surface and a narrower density specimen; visitor flows additionally need a touch-size specimen. Demonstrate keyboard access, visible focus, reduced-motion meaning and recovery from failure in the core journey. Record actual user observations if testing is conducted; otherwise label usability conclusions as hypotheses. Production is Svelte 5/Threlte, but prototype technology is free and no prototype code is presumed shippable.

**Small shared reading route:**

- [North star — “Ratified north star” and “Composition, behavior, and direction model”](../../../../reference/north-star.md#ratified-north-star): product promise and distinctions among state, performance, Destination, Stop and Experience.
- [PLATE — §0, §§4–7, §18 and the section owning a proposed shell change](../../../../reference/design-system/editor-shell-and-visual-system.md): visual authority, scope of freedom and state language.
- [P26 prototype README](../../../p26-spatial-depth/Final-Design-Prototype/README.md): run locally with the documented command; use its rationale and the specific journeys named below. Consult its implementer reference for behavior, not architecture to copy.
- [F target contract](../../../../reference/composition-execution.md): read only the subsections named in the chosen brief. Its opening status/interface-ownership box applies to all three.

### Commission 1 — Explain & Direct

#### Creative territory

Let an exhibition maker, educator or product storyteller discover a useful view of a spatial subject and turn it into an explanation someone else can explore. The principal workflow is **inspect → intentionally capture → arrange an explanation → preview as a visitor → revise**. The experience should communicate that direction is editable intent over a shared world, with approachable states and richer performances when needed.

This is a coherent direction workspace spanning inspection capture, reusable presentation and a small Experience. It is not a complete editing suite. Supply the objects and their supported capabilities; their ingestion and assembly authoring belong to Commission 2.

#### Design challenge

- How can a creator understand what capture will save, where it will live, and what remains temporary? Selection, authoring aids and camera browsing history should not become audience behavior incidentally.
- How does a simple view/state explanation grow into timed behavior without forcing a professional timeline onto every task? Conversely, how does the design represent activity that continues across a Camera change rather than pretending endpoints describe everything?
- How do creators distinguish a reusable performance, its local use, a repeated Stop and a currently running preview? Which information must be visible at the moment of editing?
- How should pause, hold, visitor inspection and return communicate who currently controls a subject? How can conflicts be repaired in ordinary creator language?
- When a subject changes, what remains valid, what needs reframing, and what explanation needs editorial review even if its reference still resolves?

#### Demonstration scenario

**Explain a working water pump.** Provide a small native architectural bay and two instances of one pump definition. The fixture declares an independently running rotor and a supported casing-opening capability; no physical simulation is implied.

1. Begin with one pump selected. Inspect its casing and briefly open the bay's architectural representation to see the installation. Return without saving: the source placement is unchanged. Then explicitly capture a useful Camera view and eligible representation/state intent for an explanation; show the scope before accepting.
2. Build “How it works”: introduction → inside pump A → comparison with pump B → return to pump A → end. The two visits to A have different content and occurrence identity, while sharing the subject. Creating a view and its Stop is one logical action that can be undone together.
3. Reuse one opening performance on both instances, with a slower local use on B. Let the rotor or narration continue across a Camera cut so the author must address independent activity. A cut need not imply a spatial route; an unsupported travel choice must expose a route gap.
4. Preview the explanation. Pause its owned presentation, enter visitor inspection, attempt to open a casing already controlled by the performance, and resolve the conflict through an explicit supported yield/stop/handoff. Show what continued, what paused and how rejoining behaves. Reset gives a fresh run, not mutated Scene defaults.
5. Reuse the explanation in a second, short service Experience over the same world. Change only its invocation or content, and make the unaffected first Experience evident. This is a bounded reuse specimen, not a second full authoring journey.
6. Move pump A and alter the casing's displayed separation. Compare intentionally locked framing with subject-assisted framing; surface an infeasible locked shot and an explanation needing review. Repair one use without changing the shared opening definition. Inject a failed/stale compound capture and show no half-created view or Stop.

#### Established context and P26 relationship

Build a **separate direction workspace sharing P26/PLATE language**, with a short contextual transition from inspection. Literal integration is optional. Reference P26's A/B/C inspections, E's edit/history separation and F's recovery. A prepared initial inspection state is enough; do not rebuild P26's geometry demonstrations.

Explicitly evolve P26's “view only” distinction: a captured representation is authored intent, while the inspection that produced it remains a session. The prototype's `recipeOf`/trail objects and raw camera tweens are not performance resources. Camera remains the single motion authority; Experience owns order and continuation; typed resources own reusable performances. Runtime conflict resolution is distinct from definition → variant → instance baseline precedence. A held final pose is still an owned contribution, not an automatic baseline write.

#### Creative freedom

Explore the composition, navigation and information hierarchy of the direction workspace, the relation of spatial manipulation to a sequence or timing surface, capture language, reusable-performance editing and diagnostics. Compare at least two ways to progress from simple states to timing before committing to one. No global node graph, fixed track layout or existing Camera sidebar arrangement is prescribed. Identify proposed shell changes explicitly; preserve coherent identity, return and editing scope.

#### Expected deliverables

Apply the common standard. Make capture, reuse, two distinct visits, interruption/rejoin and revision repair interactive. Provide specimens for simple state-only work and a richer timed explanation, plus a transition/ownership map for play, pause, inspect, return, cancel and reset. Include the failed compound-action state and a reduced-motion explanation that preserves meaning. Stop before a general animation editor, curve editor, media suite or execution debugger.

#### Foundation questions and experiments

| Kind | Question and evidence to produce |
| --- | --- |
| **Interaction design** | Test whether a creator can predict the scope of capture and a timing edit, tell repeated visits apart, and explain which activity continues during inspection. If ordinary edits repeatedly require knowledge of hidden override layers, propose a simpler authoring model inside the ratified ownership boundaries. |
| **Small technical proof — engineering follow-up** | Use one supported representation channel and canonical Camera evaluation to track a displayed casing through seek, retiming and inspection/rejoin. Check reproducible output for the same supported inputs, explicit exclusive-control refusal and no source mutation. This exposes whether the intended capture/channel/time interfaces carry enough context; a visual tween cannot answer it. |
| **Small technical proof — engineering follow-up** | Prepare a Camera view plus Stop against one expected revision, reject a stale/invalid candidate, then accept and Undo as one result. This tests the F.4 interaction promise separately from the prototype's history implementation. |
| **Implementation choices remain open** | Channel-specific operators/defaults, exact time-mapping interfaces, scheduling, caches, history machinery, media support and serialized program encoding. Do not derive these from the prototype's control layout. |

**Future relevance and risk.** T3/P25 can use the simple occurrence/capture/preview design; T1/P26 the capture and runtime-representation seam; T2/P24 the scoped bindings; provisional P27–P29 the component, performance and participation interactions; T4 the supported preview/release semantics. F.1–F.4 and F.5 program slots are relevant, but full performance scheduling is not thereby added to early T3. The main durability risk is overfitting everything to one linear timeline. Keep object-only performance use, repeated occurrences and independent ambient behavior visible in the fixture. Rich playback depends on later domain proofs; the commission itself does not.

#### Curated codebase references

- [North star — “Composition, behavior, and direction model”](../../../../reference/north-star.md#composition-behavior-and-direction-model) and [decision record — “Editorial order, nesting, and concurrency”](../../../../reference/decisions/northstar-ratification-2026-09-27.md#editorial-order-nesting-and-concurrency): vocabulary and lifecycle constraints; use these instead of reconstructing older Camera/P25 assumptions.
- [F.3/F.4 and session state](../../../../reference/composition-execution.md#f3-channels-and-representation-parameters): control conflicts, explicit capture's surrounding acceptance boundary and isolated runs.
- [P26 implementer reference §§3, 8, 11 and shortcuts](../../../p26-spatial-depth/Final-Design-Prototype/IMPLEMENTER-REFERENCE.md#3-sessions-one-lifecycle-for-every-open-state): precise inspection/return behavior. `app/state.js` and `app/actions.js` beside it show why copying a session is insufficient.
- [Camera contract — “Current vs destination”](../../../../reference/components/camera-tour.md#current-vs-destination-ratified-2026-09-27); [`camera-route.ts` / `walkFlowChain`](../../../../../packages/camera-core/src/camera-route.ts) and [`camera-motion.ts` / `createCameraMotion`](../../../../../packages/camera-core/src/camera-motion.ts): current order limitation and canonical evaluation seam, not a required UI.
- [T3/P25 phase README](../../../p25-experience/README.md): cutover obligations and the boundary between first Experience work and later performance depth.

### Commission 2 — Objects & Assemblies

#### Creative territory

Give a product designer, exhibit maker or spatial communicator a credible **object-first** home: bring in meaningful material, combine it, place several uses and revise confidently. The workflow is **inspect what arrived → compose → place instances → change one or many deliberately → accept or repair a revision**. The result should feel like working with understandable objects, not managing a raw scene graph.

This commission turns the useful part of a Scene Composition Workbench into a focused product proposition: composition whose ownership and revision remain understandable. It includes enough placement, materials and lighting to make a convincing spatial arrangement, not the entire Stage backlog.

#### Design challenge

- How does a creator begin with a single object without first drawing a Room? How does architecture later enter the same work without becoming an object group with different labels?
- What makes the distinction between definition, placed instance, internal component, organizational group and attachment discoverable through use?
- Can selection descend into a component, act on a whole instance, and return predictably across viewport, hierarchy and Inspector? How are duplicated names and hidden components disambiguated?
- How can a creator predict the reach of an edit before dragging? How are an inherited value, an instance override, an inspection displacement and a runtime action distinguished?
- How should a revised import communicate retained capability, loss and uncertain correspondence without promising that names or mesh order establish continuity?

#### Demonstration scenario

**Compose a reusable display light.** Start in an empty, object-centered project. Supply a compact articulated desk-light fixture with base, arm and shade, plus a flat decorative model with no supported internal components.

1. Simulate importing each. Inspect a truthful capability summary: the light supports declared parts, a finish slot and one bounded articulation; the decorative model supports only whole-object operations. Retained source/provenance is visible when needed. Neither starts playing merely because it was imported.
2. Combine the light with a plinth into a reusable composition and place two instances. Give the second a different allowed shade finish. Select a shade from the viewport and identify exactly which instance/component is active. Arrange a temporary group without implying that grouping creates a reusable definition or a physical attachment.
3. Enter inspection and visually separate the parts. Change an allowed component property and return; the presentation separation disappears, the accepted edit remains. Preview the articulation and reset it without writing its last pose into the instance baseline. Do not build a performance editor.
4. Add a prepared native architectural bay and attach one light to a supported wall location. Move that host and inspect the declared relationship. Attempt an invalid placement or removed host, receive an intelligible refusal/repair state, and cancel without half-applying the relationship. Architecture remains Layout-owned.
5. Offer definition revision 2 with a changed shade and one removed component. Compare the effects on both instances before acceptance: a renamed but identity-preserved part stays linked, the instance finish remains an override where compatible, and the removed target stays unresolved. Repair or deliberately detach one use. Show which existing presentation reference needs review; no presentation-authoring workspace is required here.
6. Reuse the accepted definition in a small second-project specimen with an authorized retained copy/reference. Distinguish accepting an offered revision, staying pinned and creating an independent fork. Undo an accepted local change coherently. Simulated storage must be labeled as such.

#### Established context and P26 relationship

Build a **separate object/composition workspace** with recognizable PLATE materials and P26 directness. It may be a sibling lens on the same conceptual project rather than a new permanent product mode. Reuse selection continuity, precise fields, temporary inspection cues, “where is it?” recovery and return summaries. Challenge the museum/Room-first Navigator assumption explicitly.

Scene owns nonarchitectural definitions, instances, components, attachments and presentation defaults. Reusable architecture remains Layout-owned and uses its canonical compiler; neither the light fixture nor a grouping UI absorbs it. Placement is world-local with explicit internal frames. Proximity is not attachment. Imported render meshes do not automatically become supported semantic components. Two immutable delivery copies can represent one resource revision; detaching for independent editing creates a new authored identity. Production currently has catalogue models, primitives, lights and clusters, not this resource/assembly system.

#### Creative freedom

Explore selection depth, scope indication, hierarchy versus direct spatial discovery, component isolation, revision comparison, resource access and workspace navigation. The designer need not adopt a classic prefab editor, scene-tree hierarchy or permanent asset browser. Panel layout and terminology are open proposals within the common constraints. Compare a direct contextual scope approach with a more explicit resource-editing surface; evaluate predictability rather than minimum clicks.

#### Expected deliverables

Apply the common standard. Deliver a manipulable fixture with both instances, distinct selection/edit scopes, a temporary inspection, one attachment, an offered revision, retained override and unresolved target. Include reusable patterns for capability disclosure, scope/impact, inherited values and repair. Provide state specimens for unavailable resources and cancelling an update. Stop before a universal importer, mesh editor, constraint solver, marketplace or full multi-level Layout editor.

#### Foundation questions and experiments

| Kind | Question and evidence to produce |
| --- | --- |
| **Interaction design** | Ask creators to change only the second light, then improve the shared definition, then inspect without editing. Can they predict which instances and references change? Rename/reorganize a component during the exercise: if identity becomes unintelligible, improve its presentation without making hierarchy paths authoritative. |
| **Interaction design** | Present a partial revision failure. Can the creator distinguish an incompatible override from a removed component and choose repair, pin or fork? Test whether proposed specialization layers can be understood before expanding them. |
| **Small technical proof — engineering follow-up** | Ingest one real structured model and a revised export with reordered/removed parts. Establish exactly what structure and source correspondence survive, which overrides can be reapplied, and which references must fail. Verify two independently configured instances and one retained reusable revision across a second project. Do not claim an automatic correspondence algorithm from the mock. |
| **Small technical proof — engineering follow-up** | For one supported attachment plus presentation offset, validate canonical/displayed frames, picking back to the source component, and atomic failure on an invalid host. A convincing exploded view cannot establish a valid inverse edit or architectural attachment. |
| **Implementation choices remain open** | Definition/container encoding, component correspondence, importer/clip support, storage, transform operators and constraint algorithms. Layout structure expansion, level mechanisms and slab/ceiling ownership remain focused Layout decisions, not decisions made by this object hierarchy. |

**Future relevance and risk.** T2/P24 can use object-first entry, ordinary placement, capability disclosure and instance scope; T1/P26 selection/projection integration; provisional P27 component editing/attachments; P29 cross-project reuse and revision repair. F.1/F.2 reference and resource interfaces, F.3 frame/baseline policy and F.4 compound acceptance receive concrete consumer requirements. The greatest risk is promising universal component fidelity from arbitrary files. Use one declared structured fixture and one honest flat asset; record unsupported actions. Technical proof may narrow initial capability support while preserving the design for scope and repair.

#### Curated codebase references

- [Scene content — current implementation and ratified destination](../../../../reference/components/scene-content.md): distinctions between grouping, definitions, instances, intrinsic capability, composition overrides and invocation overrides.
- [Assets — “Ratified destination” and “Current asset system”](../../../../reference/components/assets.md#ratified-destination-not-shipped): truthful ingest, offered revisions, retention and today's image-focused registry.
- [F.1–F.4](../../../../reference/composition-execution.md#f1-identity-and-reference): read identity, resource/unit, channel/frame and acceptance rules; no schema design is requested.
- [`scene.ts` — `SceneModelEntity`, `SceneObjectCluster`, `SceneDocument`](../../../../../packages/project-model/src/scene.ts) and [`AssetModel.svelte`](../../../../../apps/editor/src/lib/museum/assets/AssetModel.svelte): the current whole-object/render-instance boundary; useful for avoiding false claims about landed assemblies.
- [T2/P24 README](../../../p24-scene-staging/README.md) and [P26 implementer reference §§6, 8, 11](../../../p26-spatial-depth/Final-Design-Prototype/IMPLEMENTER-REFERENCE.md#6-handles-typed-values-and-refusal--one-writer): future composition scope and reusable editing/recovery behavior.

### Commission 3 — Publish & Review

#### Creative territory

Help a creator send spatial work to a client or audience, learn from its use and revise without breaking the recipient's understanding. The workflow is **prepare → enter/participate → give contextual feedback → revise → revisit**. The experience should communicate that a link leads to intentional, understandable work with a clear revision context.

This is a paired creator/audience commission. A Publish panel is only one transition in it. Supply a prepared world and two small Experiences; do not build their composition or direction editors.

#### Design challenge

- What does an audience member need to understand before navigating a spatial work, and how can they act without learning editor conventions?
- How can free inspection or a bounded choice coexist with guided meaning, accessible content and a clear way to resume?
- What must a creator see to distinguish a working draft, prepared release preview and currently published Experience? How much compatibility detail helps them make a decision?
- How can someone return to “the same place” after a revision while seeing the correct historical context for a comment or approval?
- How should a removed subject, unsupported capability or unavailable resource preserve trust and offer recovery?

#### Demonstration scenario

**Review a small exhibition installation.** Supply one shared pavilion/object arrangement, two valid presentation alternatives, and two Experiences: a client review and a concise public explanation. Alternatives are prepared valid fixtures, not interpolated topology.

1. As creator, select the client Experience, inspect its readiness and preview the release candidate. Separate unsaved/working changes from the accepted revision being prepared. Choose what the audience may inspect or compare and the intended entry point; do not expose raw compiler settings as the normal workflow.
2. Simulate publishing. Enter through the recipient link on a touch-size viewport, understand the purpose, visit a semantic location and choose between the prepared alternatives. Show an accessible content/navigation path and meaningful reduced-motion behavior. The visitor choice is private execution state, not a Scene default edit.
3. Leave a contextual comment and mark a reviewed location against this release. Return to the creator side and find that subject in the draft with its original release context visible. Feedback is a separate audience record, not authored scene content.
4. Revise the installation: move one retained subject and remove another. Show impact before preparing the next release. Intentionally inject a missing required capability/resource; preparation fails clearly and the previous published release remains available. Recover and prepare the new release.
5. Update the client Experience without changing the public explanation's publication. Reopen the current publication at a surviving semantic location, open a pinned historical location, and inspect the removed subject's comment. The surviving subject may resolve forward; the removed one is orphaned/explicitly unavailable, never silently matched by name. Prior approval remains approval of the earlier release only.
6. Unpublish the hosted client link and show its unavailable state. Explain the separate status of any already exported package: hosted Unpublish cannot retract an independently held copy. Resetting the visitor run clears its temporary choices without rewriting the source or deleting feedback.

#### Established context and P26 relationship

Build an **independent creator/audience experience**, sharing PLATE on the creator side and using an audience-appropriate presentation for the visitor. P26 supplies continuity, understandable inspection and return as conceptual references. Its Navigator, editor selections, view trail and gizmos never become visitor infrastructure. Audience inspection uses supported runtime capabilities, not P26's editor session object.

A release identifies an accepted revision, selected Experience(s) and delivery profile. Each published Experience has its own pointer to an immutable release/entry point. Public locations carry semantic identity and concrete release context. Audience comments, approvals and saved configurations have a separate lifetime. Current P22 publishes project snapshots; prepared packages, per-Experience publication and audience records are destination behavior. No visual mock proves old packages load under future code.

#### Creative freedom

Explore audience entry, spatial/semantic navigation, content hierarchy, choice presentation, feedback placement, change communication and the transition between reviewing a release and editing its source. Visitor branding and composition need not resemble PLATE chrome. Choose the lightest creator presentation that still makes release context and consequences understandable. No dashboard, CMS, social feed, analytics suite or permission system is prescribed.

#### Expected deliverables

Apply the common standard. Deliver connected creator and audience flows with distinct draft/candidate/live/historical states, two publication pointers, one bounded visitor choice, feedback, revision and a removed-target outcome. Make current versus pinned links behaviorally different in the mock. Include mobile/touch, keyboard and reduced-motion specimens, failed preparation, unavailable publication and preserved prior approval. Stop before live multi-user infrastructure, billing, comprehensive moderation, generalized analytics or a film/export tool suite.

#### Foundation questions and experiments

| Kind | Question and evidence to produce |
| --- | --- |
| **Interaction design** | Can creator and recipient identify the revision and Experience they are seeing? After republishing, ask what an old approval means and where a comment on a deleted subject should go. If the answer requires reading implementation IDs, improve the hierarchy and language rather than hiding release context. |
| **Interaction design** | Test a visitor detour/choice and return with semantic content and reduced motion. Determine which session values need explicit initial/reset behavior and whether choices need a named saved-configuration action. A mock save is an audience record, not an edit to source defaults. |
| **Small technical proof — engineering follow-up** | Prepare one bounded release, change authoring code/schema, and load the old package without the authoring validator. Check closure, required-capability refusal, editor-code exclusion and source/release-preview semantic agreement. This establishes F.5 feasibility for the supported subset, not universal future compatibility. |
| **Small technical proof — engineering follow-up** | Resolve one surviving and one removed semantic location across two releases, preserving the original comment context; update one Experience's publication independently. This tests the address/resolution interface the interaction relies on. |
| **Implementation choices remain open** | Release encoding, compile placement, storage/access/retention for audience records, delivery infrastructure, live session transport and runtime compatibility machinery. Exact supported profiles need domain conformance evidence, not a designer-selected quality dropdown. |

**Future relevance and risk.** T4 uses release readiness, preview, publication and compatibility explanations immediately; T3/P25 uses visitor entry, bounded interaction and content/accessibility; provisional P29/P30 use participation, review and delivery. F.1/F.5 addresses, profiles and program slots and the F.2 Experience collection get concrete requirements. F.4 governs accepted source changes; switching a publication pointer does not become source Undo. The main risk is designing a collaboration platform before validating the spatial review loop. Keep one reviewer and a small set of explicit audience records. The commission is independent of cloud implementation; its durability claims remain engineering hypotheses until the separate proofs pass.

#### Curated codebase references

- [North star — “Preview and publish”](../../../../reference/north-star.md#preview-and-publish) and [“Ownership, authority, and lifetimes”](../../../../reference/north-star.md#ownership-authority-and-lifetimes): publication, immutable releases and the audience-record boundary.
- [F.1 public addresses, session state and F.5](../../../../reference/composition-execution.md#f5-release-envelope-and-program-slots): semantic locations, release capabilities, reset/isolation and prepared delivery requirements.
- [Architecture — “Product routes” and “Release packages”](../../../../reference/architecture.md#product-routes-current): current preview/publication routes and visitor/editor isolation; current paths are context, not prescribed prototype navigation.
- [Persistence — “Publish + releases” paragraph](../../../../reference/components/persistence.md) and [`publication-persistence.ts` — `readPublicRelease`, `publishVersion`](../../../../../apps/api/src/publication-persistence.ts): landed publication/version checks versus the target prepared reader.
- [T3/P25 README](../../../p25-experience/README.md): retained visitor meaning/accessibility and expanded session semantics. P26 Journey F and its [recovery reference §11](../../../p26-spatial-depth/Final-Design-Prototype/IMPLEMENTER-REFERENCE.md#11-where-is-it--one-resolver) are useful for legible spatial recovery, not visitor code to import.

### Commission review

For the chosen commission, review the principal journey, its alternate path and its revision/failure case together. Ask the designer to show what a creator can now understand or do, what carries across a change, where the concept challenges an existing design, and which claims still require technical proof. Select the interaction direction and its required semantics before deriving implementation scope. Preserve useful rejected alternatives as rationale; do not promote this report or prototype internals into product authority by default.
