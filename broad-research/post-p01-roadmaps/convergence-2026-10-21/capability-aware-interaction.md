# Capability-aware interaction — RR-3 / RR-5 / RR-6 commission and initial findings

**Status:** research/planning proposal, 2026-10-21; inspected baseline `78cafc3acaad0f9919855901a7ea4d98aeecd85f`. No ratification, phase registration, implementation authorization or production change. Owner acceptance of P1's meaningful interactive Presentation, P2 Smart Wall and P3 Vellum is an input; P4 is explicitly deferred. Earlier roadmap language about P4 starting early does not reopen it.

**Round boundary, revised 2026-10-22:** follow the [convergence sequence](../../../docs/roadmap/product-convergence-2026-10-21.md#scope-and-sequence).
This step revises the brief only; remaining research execution is pending. Results feed combined
contract/design and canonical roadmap/DAG reconciliation in PR #173. The
[owner production hold](../../../docs/roadmap/README.md#production-implementation-hold) includes
T3.P02 despite its earlier authorization; research or merge cannot release that hold.

## Decision and first consumer

Decide the smallest honest contract that lets a creator discover an object's supported operations, compose visitor offers around it, bind typed actions, Preview, interrupt, revise and reuse the explanation. The first production consumer would be a **separately scoped later T3 interaction increment**, consuming T2's truthful resource/component admission and F's execution seams. T3.P02's bounded capture/text/Cut Preview scope remains held; this commission supplies evidence for its reconciliation rather than silently expanding or resuming it.

Proposed acceptance specimen: an object in an empty World, one Guide-free Presentation, explanatory text, two Camera Views, a visitor control and a meaningful object capability such as an admitted material variant or component reveal. The creator changes both framing and a binding, then reuses the explanation on another explicitly compatible instance. Add an optional Guide only afterward. A supplied clip is another action family, not the definition of interaction. Static files must remain useful for framing/text and truthfully refuse unsupported mechanism actions.

Answer these decisions together, without designing a universal workflow engine:

1. What separates **observed file data**, **admitted runtime operation**, and **authored binding**? Who validates each boundary?
2. Which identity survives instance duplication, resource revision and re-export; how does a reusable role interface differ from component identity?
3. Which minimal Experience offer/content records express screen controls, projected callouts and supported 3D targets without making Presentation a Scene container or a page tree?
4. How does one semantic event produce a typed domain action with run ownership, cancellation, conflicts, reset and accessible equivalents?

## Bounded read inputs

Start at [docs router](../../../docs/README.md), then read only these concerns and their named implementation evidence. Expand when a probe exposes a concrete missing contract.

| Input | Read boundary / purpose |
| --- | --- |
| [Coordination proposal](../README.md) | §§2–6, ledger rows for controls, invocation, resources and content; RR-3/5/6 and authorization route. P4 is deferred; its original early sequencing is inactive. |
| [Prototype commission](../prototype-roadmap.md) | P1 journey and §5 asset/invocation/content proofs; requirements, not demonstrated implementation. |
| [Scene contract](../../../docs/reference/components/scene-content.md) | Ratified definition/instance/capability/override/reuse and truthful-ingest paragraphs; existing clusters are not assemblies. |
| [Assets contract](../../../docs/reference/components/assets.md) | Ratified destination and current asset system; source/derivative provenance and truthful capability reporting. |
| [Camera contract](../../../docs/reference/components/camera-tour.md) | Current F2 ownership and Guide-free access; Camera is the sole viewing evaluator. |
| [F contract](../../../docs/reference/composition-execution.md) | F.1 component/resource references, F.2 domain admission, F.3 contributions, F.4 compound acceptance, session logic, AM-3/6/9; extension points for only the first consumer's missing kinds. |
| [PLATE](../../../docs/reference/design-system/editor-shell-and-visual-system.md) | §0.8.1 Presentation/subject/Preview, discovery ownership and final conformance test. Presentation is reusable composition, not a Scene container. |
| [T3.P02](../../../docs/roadmap/t3-experience/t3.p02-capture-and-cut-preview/README.md) | Bounded outcome, exclusions and slice register: S01 approved; S02 proposed. Rich controls/general animation orchestration are excluded. |
| Production evidence | `packages/project-model/src/{units/types.ts,units/experience/{lowering,interpreter,companion}.ts,program/types.ts,channels/{families,camera-output,handoff}.ts}` and `apps/editor/src/lib/museum/assets/{AssetModel.svelte,model-utils.ts}`; inspect owning validators/callers only for a specific gap. |
| P1 evidence limit | Bounded `prototypes/` listing and tracked filename/text lookup found no P1/watch executable at this HEAD; existing P1 commission is not its executable. Preserve the owner's accepted UX finding. Obtain the exact artifact/revision as a research input before claiming its import, reset, reuse or accessibility mechanism was inspected. Do not substitute Conservatory or infer absence of the accepted design. |

## Initial findings — evidence classes kept separate

**Observed repository evidence (read-only source/header inspection; no browser/runtime execution here):**

- `ExperiencePresentation` currently contains `id`, `label`, `viewId`; `ProgramContentRecord` admits text only. The program action union admits show-content, navigate-to, open-url, continue and boolean/choice set-state. No arbitrary button-to-component-capability action or rich visitor-control grammar is present in that inspected union.
- The shared interpreter already has bounded guards, typed boolean/choice state, lifecycle actions and `runId`/`runEpoch` stale-event rejection. Its reset rewinds the **same** run; a fresh run is the host's new-run path. The companion explicitly lists Presentations with no Stop. Camera output tickets already carry output/source/session/owner/run qualification and ordered ownership transitions.
- `DEFAULT_CHANNEL_FAMILIES` admits Layout Plan inspection and Camera session inspection. This is useful landed infrastructure, not generic clip/component/property orchestration. Typed resource kinds currently admit `texture` and `asset`; portable performance/explanation interfaces are not established by that union.
- F's older prose saying no reducer/general channel system exists needs status reconciliation against AM-3/6 and current source. Preserve its normative rules; do not restart those foundations or claim arbitrary capability execution is landed. Lowering currently accepts explicit preparation inputs for content/state/lifecycle, which is not proof of persisted authoring homes for all those inputs.
- The inspected `AssetModel.svelte` clones a loaded GLTF scene and reports animation **names** to inspection. No clip playback executor was found in that renderer/inspection closure. Rendering a hierarchy or displaying clip names does not admit semantic components, pivots, actions or revision continuity.

GLB JSON-chunk probe actually run with Python stdlib (`struct`, `json`, `hashlib`); geometry buffers were not decoded and pivots were not visually validated:

| Local specimen | SHA-256 | JSON results |
| --- | --- | --- |
| `apps/editor/static/museum/models/decor/clock/grandfather-clock.glb` | `c44bfabd45da819470038502130b56f7bc6863daaadc0d48909c9d14e6361420` | 4 nodes / 4 meshes; 0 parent nodes; 4 explicit TRS nodes; no animations; no node extras. |
| `apps/editor/assets-source/models/grandfather-clock/source.glb` | `e43717f8f2cf849c67da6a7dc4370921a975b1258bb11aa1fb4e0429aa892173` | 11 nodes / 4 meshes; 7 parent nodes; 6 matrix nodes; no animations; no node extras. Source hierarchy and derivative differ. |
| `apps/editor/static/museum/models/piano/grand-piano.glb` | `a360b6fcbad835f5b82fe0ba7d347538695230974d27767483a4d6fd4a08d660` | 17 nodes / 17 meshes; 0 parent nodes; 17 explicit TRS nodes; no animations; no node extras. |

These three files have no repeated nonempty node names, but that proves neither durable IDs nor mechanism semantics. The derivative extensions are meshopt compression, WebP textures and mesh quantization; none supplies the missing interaction meaning. Separate clock/piano meshes do not prove an opening, playable or exploded mechanism. Source/derivative hierarchy mismatch makes resource correspondence a real question now.

**Externally verified technical facts (primary sources, accessed 2026-10-21):**

- Core glTF names need not be unique; its core animation format stores node-transform/morph keyframes and leaves playback order, loops and runtime policy to the application. A clip/file therefore cannot define Biskiq cancellation or ownership semantics by itself. [Khronos glTF specification, §§3.3, 3.11](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
- Material variants are a genuine non-animation capability candidate: the Khronos sample shoe declares three variants through `KHR_materials_variants`. This verifies sample documentation/JSON, **not local ingest or evaluator support**; pin its source revision and inspect actual bytes before using it as a positive control. [Khronos sample README](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/MaterialsVariantsShoe/README.md), [extension specification](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_variants/README.md)
- W3C's button pattern supports Enter/Space activation and explicit toggle state. Pointer Events specifies `pointercancel` when a stream is suppressed. Thus keyboard semantics and cancellation must be mapped deliberately; a raycast click handler alone is insufficient. [WAI button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/), [Pointer Events §4.2.7](https://www.w3.org/TR/pointerevents3/#the-pointercancel-event)
- SCXML offers state-machine invocation and exit cancellation semantics. It is a comparator for event/run design, not a reason to adopt a second interpreter or its whole language. [W3C SCXML](https://www.w3.org/TR/scxml/)

**Inference / provisional recommendation:** P1's accepted outcome fits existing authority separation but needs narrowly admitted capability/offer/binding shapes. Asset evidence is presently static, and common invocation scaffolding is farther advanced than broad status prose suggests. The consequential gap is honest admission plus bounded domain effects, not another Camera, generic timeline or foundational reducer.

## Alternatives to decide with evidence

### D1 — discovery and admission

| Alternative | Strength / cost / rejection test |
| --- | --- |
| A. Infer actions from names, separated meshes or AI descriptions | Fast first impression; cannot establish pivots, legality or continuity. Reject as execution authority. AI may propose a mapping for review, never silently manufacture capability. |
| B. Explicit capability manifest/adaptor per pinned resource revision, validated by its owning domain | Truthful supported/unsupported distinction; supports static files and native objects; preparation/adaptor work must be visible. **Provisional choice.** Separate observed file features, admitted evaluators and authored offers. |
| C. Only certified source-authored semantic extensions | Strong portable author intent where present; excludes ordinary static imports and couples adoption to producer tooling. Useful optional input to B, not a prerequisite. |

**Falsifier for B:** if two realistic files require essentially arbitrary handwritten code per interaction, narrow the admitted family or choose certified packages for that family; do not disguise manual preparation as automatic ingest. Compare time and repair burden against a static text/View explanation.

### D2 — component identity and reusable roles

| Alternative | Strength / cost / rejection test |
| --- | --- |
| A. Exact resource revision + local node index/path | Honest within immutable bytes, cheap; all cross-re-export continuity unresolved. Viable initial locator, insufficient as reusable component identity. |
| B. Definition-owned stable component IDs + explicit revision-pinned locator/correspondence map | Durable authored meaning, explicit repair after replacement; requires mapping provenance and non-reused IDs. **Provisional choice**, initially permit unresolved revisions instead of guessing correspondence. |
| C. Role names as target addresses, automatically matched on replacement | Convenient reuse; role collisions and renamed/repeated parts can silently retarget. Reject as identity. Retain typed roles only as reusable **requirements**, explicitly bound to B's concrete references. |

A role such as `inspectable-subject` declares required capability family/version, parameter/value/frame constraints and multiplicity. It is not an imported component ID. Binding validates compatibility, preserves explicit missing/incompatible results, and exposes shared versus this-use reach. One resource can satisfy different roles; two instances of one definition remain distinct qualified targets.

**Falsifier for B:** if source identity survives re-export reliably through a verified producer extension, use that as correspondence evidence rather than maintaining a competing ID source. If continuity cannot be proven, keep old bindings repairable and refuse execution.

### D3 — Presentation/content representation

| Alternative | Strength / cost / rejection test |
| --- | --- |
| A. Presentation embeds a new Scene or arbitrary page/component tree | Expressive but duplicates subject ownership and creates layout/scripting scope. No current first consumer justifies it. Reject giant embedded scene/page as the default model. |
| B. Small Experience-owned offer/content records referencing external subjects/capabilities, rendered through screen/projected/3D adapters | Keeps semantic action and accessible text independent of visual projection; finite grammar and predictable ownership. **Provisional choice.** A projected label is not a new Scene object merely because it follows a subject. |
| C. Separate reusable typed UI/explanation resource immediately | Clear sharing/revision contracts; premature resource packaging may burden a single explanation. Reserve after local reuse demonstrates needed independent lifetime; if adopted, Experience holds uses/bindings, not copied Scene data. |

**Falsifier for B:** accepted P1 composition cannot be represented without exceptions that behave like arbitrary page layout. Identify the missing accepted behavior, compare a bounded additional record kind with C, and return only that design departure for decision. Do not translate the prototype DOM tree into source schema.

### D4 — event → typed action execution

| Alternative | Strength / cost / rejection test |
| --- | --- |
| A. Each control directly mutates Three objects and restores a saved whole-scene snapshot | Easy demo; bypasses channels and overwrites newer/unrelated state. Reject production use. |
| B. Existing Experience reducer dispatches bounded typed effects to domain-owned evaluators through F.3 | Reuses stale-event and Camera handoff guarantees; adds only selected capability families and validators. **Provisional choice.** Event order is explicit, with no hidden clock or arbitrary creator code. |
| C. Adopt a broad workflow/statechart/visual scripting runtime | Handles complex independent behavior; adds language, effect, scheduling and debugging scope. Keep as comparator only; deferred independent clocks/counts/participation do not justify it. |

**Falsifier for B:** the accepted first consumer demonstrably requires independent persistent activity or a condition beyond current bounded operators. Record that exact trace and propose the missing operator/lifetime; do not widen all invocation semantics speculatively.

## Proposed lifecycle to prove, not claim as landed

1. Resolve a pinned target, admitted capability and typed parameters before enabling an offer. A semantic `Activate` event names the offer, Presentation use and invocation; DOM, touch and 3D hit adapters produce the same event. Sliders/dragging require distinct typed value/commit/cancel semantics if the accepted task actually needs them.
2. Allocate a fresh activity/run epoch; acquire only its declared affected channels. Camera actions request canonical Camera output; component/material actions use their own owner evaluators. Same-channel exclusive conflict rejects unless that family explicitly defines replacement or composition; do not invent global last-writer-wins.
3. Compute from the accepted effective instance baseline and active contributions. Define completion policy per family; cancellation/exit removes only that run's contributions. Reset exposes the current valid baseline plus remaining contributors, not a stale whole-scene snapshot. A runtime baseline is never a saved authored edit.
4. Every async completion/load/failure/cleanup checks source/resource revision, session, invocation and accepted epoch before applying. Removal, source revision change and Preview exit invalidate affected work. Old callbacks cannot clear or reclaim newer channels; cancellation must be idempotent.
5. Re-entry creates a new invocation even when the Presentation or Stop is reused. Keep invocation reset distinct from current interpreter same-run reset. If a source edit occurs during rehearsal, explicitly end/rebase the session before deriving another baseline; do not restore pre-edit authored values.
6. Give each 3D/projected action a labelled DOM equivalent, visible availability/reason, logical focus/return and state announcement. Occlusion or off-screen targets do not remove semantic access. Reduced motion preserves outcome via an owner-declared endpoint/discrete equivalent, not a faster animation.

## Remaining reproducible probes — not run

Run probes in a disposable research harness outside production workspaces. Save fixture hashes, commands, expected/actual traces and explicit simulated/admitted columns. Browser execution must load the repo browser-hygiene skill first and own one reusable session; this commission launched no browser.

| Probe | Reproduction and discriminating result |
| --- | --- |
| Probe 0. Recover accepted P1 evidence | Record exact artifact path/URL/revision and startup command; enumerate every action/target and its implementation. For each, classify real source data, prepared geometry/pivot/clip, authored manifest, simulated state, runtime enforcement and accessible equivalent. Accepted UX remains accepted even if a mechanism is prepared. Stop mechanism claims where the artifact is unavailable. |
| Probe 1. Repeat current asset audit | For each table file: `b=Path(path).read_bytes(); n,t=struct.unpack_from('<II',b,12); j=json.loads(b[20:20+n])`; assert GLB magic/version and JSON chunk type, hash bytes, count nodes/meshes/parents/TRS/matrices/animations/extras, list channel target indices/properties and extensions. Decode with the actual loader separately; JSON counts alone establish no usable pivot. |
| Probe 2. Positive and negative capabilities | Pin/download Khronos MaterialsVariantsShoe and one official animated sample with model licence/attribution; inspect bytes, supported extensions, clip target/duration, transforms, source provenance and pivots. Use local static clock as negative control. Produce an admission matrix: observed / evaluator-supported / bound / unavailable. A static clock must refuse supplied-clip or explode claims. |
| Probe 3. Instance and revision addressing | Instantiate one file twice with identical names; explicitly map a role to only instance B. Reorder/rename nodes, duplicate names, change units/root transform, remove a component, re-export and replace resource revision. Assert A is untouched; old identity never resolves by name/index/nearest; authored explanation survives with typed repair. Restore through Undo/reload in a later production proof, not a fake prototype snapshot claim. |
| Probe 4. Invocation trace | Enter A, activate X, cancel at half-duration, enter B, activate X again, then deliver A's delayed completion and cleanup; repeat cancel twice. Add Y on the same exclusive channel and Z on an unrelated channel. Assert rejection/declared handoff, B and Z survive, and source hashes remain unchanged. Use explicit clock samples and manually queued callbacks for reproducibility. |
| Probe 5. Baseline and async invalidation | Set definition baseline, variant and instance override; run an effect, revise accepted source/resource, deliver old loader completion, exit/re-enter Preview. Capture evaluated baseline before/during/after, ticket owners and run IDs. Cancellation must reveal current baseline plus unrelated effects; stale completion must do nothing. No whole-scene restore. |
| Probe 6. Input and projection | Repeat the same offer with pointer, touch, Enter/Space and screen reader. Force occlusion, reframing, narrow viewport, failed target resolution, `pointercancel`, lost capture and reduced motion. Record one semantic activation per intent, clear cancel/no unintended commit, readable fallback, focus return and no required hover/drag. Test actual renderer/input integration before asserting spatial-label fidelity. |
| Probe 7. Meaningful reuse and scope | Reuse an explanation on compatible second instance, then incompatible asset. Edit one use, then an explicitly shared binding. Compare a conventional text/View explanation. Passing requires understandable repair, clear edit reach and a useful visitor outcome beyond a Play button; no Room, Guide, Stop or hidden scene clone prerequisite. |

## Deliverables, pass/stop and amendment route

**Execution bound:** start with probes 1–2 (repeatable inventory audit and one positive capability fixture), then probes 4–6 for that family. Probe 0 bounds claims about the unavailable accepted prototype; it does not block existing Guide-free capture or a truthful new native fixture. Probes 3 and 7 open to the depth of the selected instance/reuse promise; do not implement general re-export correspondence or package distribution to prove one local binding. Return a precise missing interface when it decides the question rather than building its whole provider inside the research harness.

Deliver one decision packet containing (a) P1 evidence/provenance and capability inventory; (b) pinned asset/admission matrix and source→derivative loss report; (c) the four alternative decisions with falsifiers resolved or explicitly open; (d) minimal proposed records/types and domain ownership map; (e) deterministic lifecycle traces plus rendered/input/accessibility evidence; (f) exact contract/design deltas and first consuming slice proposal. A schema sketch must be labelled unratified and distinguish authored records, compiled derivatives and session state.

Name exact North Star/design/architecture/domain/F sections to amend or retain, rejected alternatives
and remaining owner calls, missing provider/capability nodes and dependency edges, and the next slice
to plan. Distinguish consequences for static K1 admission and existing T3.P02.S01 from prerequisites
of richer interaction/reuse. The lead reconciles these with the other packets and folds the selected
owning-document amendments and canonical roadmap/DAG into this same PR. Researchers do not
independently ratify contracts or change registration/implementation authority.

**Pass to planning:** demonstrate one non-animation interaction or prove why the accepted first task specifically needs a supplied clip; truthful unsupported results; two-instance targeting; incompatible-revision repair; cancellation/re-entry/stale-callback safety; one shared semantic input path with DOM access; source unchanged by rehearsal; reuse without Scene/page cloning. Existing F/Camera guarantees are reused and only exact absent interfaces remain proposed. This enables owner review of amendments and production scope, not automatic authorization.

**Stop narrowly:** no truthful positive capability fixture (imported or native), unusable pivot, missing semantic provider, impossible correspondence or unproven lifecycle means that claim remains blocked. Identify the missing provider/API/fixture and preserve useful text/View/static work. If new independent clocks, arbitrary code, site layout, publication, libraries or the deferred P4 agent harness become necessary, record a scope decision rather than silently adding them. Unrelated proofs create no technical prerequisite for T3.P02; its owner hold still applies.

| Proposed amendment after evidence, only if needed | Owner / precise scope and risk |
| --- | --- |
| Truthful resource capability/component admission | T2 + resource-kind owner: pinned feature report, stable component IDs, locators/correspondence evidence, capability descriptors and validity; F.1/F.2 kind admission. Risk: treating a renderer node map as authored semantic authority or promising re-export continuity that was never proved. |
| Typed runtime action family and channel policy | Effect's domain owner + T3 invocation: parameters/results, target qualification, conflict operator, completion/reset/cancel policy and failure diagnostics; F.3 descriptor/operator amendment and bounded program action/profile extension if required. Camera's evaluator and ticket ownership remain sole authority. Risk: cleanup bypass, hidden interpolation or a second scheduler. |
| Experience offer/content/binding records | T3: finite event/target/action bindings, text/semantic labels, screen/projected/3D presentation adapters, shared-use scope and repair; F.2 authored home and F.5 lowering only where consumed. Do not turn deferred T4 delivery into this inquiry's prerequisite. Risk: Presentation absorbs Scene/resource state or becomes a general page model. |
| Reusable typed explanation interface | T3 + independently versioned resource owner, only after concrete reuse needs it: role requirements, explicit bindings, revision locks, local/shared edit reach and incompatibility. No parallel component identity scheme. Risk: premature packaging or automatic semantic matching. |
| PLATE interaction extension | Propose placement of invoked control/binding procedure, preview/return, selected identity and availability/repair states through PLATE conformance. Do not copy P1 chrome or silently create a third lens. Risk: rich permanent inspector inventory obscures ordinary composition. |

Research records alternatives and proposed deltas here. The combined reconciliation in PR #173 prepares
the owning contract/design amendments for explicit owner ratification before merge; registration,
implementation authorization and release from the hold remain distinct. This researcher commission
does not itself amend authoritative docs or production formats.
