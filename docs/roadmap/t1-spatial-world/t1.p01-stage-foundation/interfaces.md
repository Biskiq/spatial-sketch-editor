# T1.P01 — interface and F amendment drafts

**Status:** owner-review draft, 2026-10-14. This is the exact proposed surface for the
[phase proposal](./README.md), not a shared contract, implemented export or accepted gate.
Names and version 1 below are recommendations for ratification. Shared F semantics remain
owned by [composition-execution.md](../../../reference/composition-execution.md); gate identity
remains owned by [the roadmap register](../../README.md#gate-register).

## Viewport projection v1

**Proposed gate:** `T1.viewport-projection@1` · owner T1 · sole provider T1.P01.S02.
**Consumer boundary:** T2/T3 editor adapters can project/pick/register graphics and invoke
Camera viewing intent through a public editor host without reaching into Stage internals.
Acceptance covers ordinary project-world Plan/3D; it does not promise Section, peel, arbitrary
surface inverses, Scene support resolution or Camera authoring.

### Inputs, outputs and methods

The following names describe intended exports, not existing files. Runtime-safe evaluation
belongs in the existing Layout/Camera packages. The mounting facade belongs in the editor
authoring host. Svelte components/functions/Three objects are never part of a serializable F
reference, value, intent or accepted document.

| Surface | Required shape and behavior | Owner |
| --- | --- | --- |
| `StageReadSnapshot` | Source-independent validated read facade: AcceptedRevision, separate content identity/session epoch, admitted source kind/version, compile generation and immutable domain-owned Layout/Scene/Camera read access. No public required current-ProjectDocument field. Current/F2 adapters own strict decoding and canonical domain views; derived geometry is never authored or deep-proxied. | Shared project coordination; T1 initial adapter, replaced by T3 S04 |
| `ViewportRect` | CSS left/top/width/height and DPR, all finite, width/height positive. CSS coordinates drive input/overlays; framebuffer pixels only drive rendering. Hidden/zero-size viewport yields unavailable output rather than division by zero. | Stage host |
| `ViewportEvaluation` | Immutable output ID, epoch, source revision, evaluation generation, realized eye/target/up, view and projection matrices plus inverses, near/far, target-plane meters per CSS pixel, projection kind, settled reading, working-plane qualification and diagnostics. Matrices use a documented column-major right-handed convention with project +Y up and X/Z horizontal. | Camera evaluation |
| `projectWorld(point, evaluationId)` | Returns `{css:[x,y], ndcDepth, visibility}` for finite project-world meters. Visibility is `visible`, `outside-frame`, `clipped` or `behind`; projection is not a membership/selection decision. Invalid input/stale evaluation fails explicitly. | Camera projection |
| `pointerRay(cssPoint, evaluationId)` | Returns finite project-world ray origin and unit direction from the **same** rendered matrix/inverse. Orthographic rays have varying origins/parallel directions. No separately inferred FOV or pixels-per-meter transform. | Camera projection |
| `intersectWorkingPlane(ray, frame, evaluationId)` | Returns world point and qualified local coordinates, or `parallel`, `behind`, `outside-supported-domain`, `invalid-frame`, `stale-evaluation`. The plane/frame is explicit, never nearest Room. Snapping/host/support constraints are downstream domain operations. | Camera ray math; frame validity from owning domain |
| `acquireCameraOutput(role, expectedContext, policy)` | One Camera-owned ticket `{outputId,sourceRevision,sessionEpoch,ownerId,runEpoch}` for inspection, guided/free navigation, Follow, Look-through or Preview. Unsupported controller capability refuses; competing exclusive control rejects unless explicit replacement/handoff policy permits it. | Camera output owner |
| `requestViewingIntent(intent, ticket)` | Pan/orbit/zoom, reading, Fit, Bring into view or declared guided/free output; finite domain intent/policy and explicit clock, never shell tween poses. Returns accepted/rejected/superseded. All realized matrices come from Camera evaluation. | Camera evaluator |
| `replaceCameraOutput(ticket, role, returnPolicy)` / `returnCameraOutput(ticket, returnToken)` / `cancelCameraOutput(ticket)` | Ordered ownership transfer, Camera-owned return context and idempotent epoch-qualified cancellation. Former runs cannot clear/reclaim a replacement. Return validates current source/output context, otherwise refuses with a reason. No shell viewpoint history. | Camera output owner |
| `evaluateLayoutPlan(compiled, parameters, sourceContext)` | Returns four typed streams, per-fragment correspondence, per-source membership with exclusion reasons, bounds and diagnostics. It clips/projects canonical sampled solids/query records and never re-fits curves or extracts another topology. | Runtime-safe Layout representation |
| `resolveSourceHit(candidate, readSnapshot)` | Candidate carries source F.1 identity, generation and optional domain sub-reference. Reject stale fragments; resolve to canonical identity or explicit failure. Opening void/cap uses host+compiled intervals/profile, never nearest mesh face. | Domain hit adapter, hosted by Stage |
| `registerStageAdapter(adapter)` | Editor-only registration of domain/required capabilities, world graphics, overlay contribution, eligible hit provider, selection echo, explicit task/instrument factory and disposer. Unknown required capability refuses mounting. No unowned writable store is passed to it. | T1 host; adapter content T2/T3 |
| `acquireGesture(owner, outputEpoch, evaluationId, transitionPolicy)` | One captured pointer/writer lease with accepted revision and operation parameterization. Policy is continue-after-revalidation, suspend-proposal or cancel-on-reading-change. The host calls the policy once before projection changes and invalidates old samples; loss, lens/project/task exit or unmount cancels once. Navigation cannot steal the lease. | Editor session host |

Public editor access also exposes one read-only ordered selection/primary value plus `select(reference)` and
task open/close requests. There is one selection owner and one instrument home. A domain adapter
may offer its own Card facts/precision, but may not create another lens selection or history.
The host arbitrates **gesture ownership and eligible candidates**, not domain validity or one
global priority among Camera, Scene and Layout species. Each adapter declares its hit policy;
retained Layout priority stays deterministic within Layout. Same-class ties use stable source
identity and documented distance/order, not Map iteration or changing labels.

### Camera/projection decision

Keep one logical viewport output and one accepted controller. Add Camera-owned **session
inspection viewing intent** to camera-core without editing authored Camera storage. A single
Canvas persists through Plan/3D/lens changes. Renderer Camera objects are realizers only.

Use an **exact orthographic Plan endpoint**, perspective 3D and a Camera-evaluated projective
transition between them. The evaluator owns projection weight, framing scale and pose together;
renderer, raycasting and overlays consume its actual matrices during the transition. The
implementation may realize those matrices on a generic Three Camera or controlled perspective/
orthographic objects; it cannot introduce two camera states or two controllers. Do not select
the prototype's tiny-FOV/distant-camera substitute as the Plan measurement authority.

The flip preserves the current target and visible target-plane height. Nearest-90° azimuth
settlement uses a deterministic tie rule (lower normalized detent); 3D returns to last working
elevation about the **current** target. Fit is a separate explicit request. Aspect change
preserves target, orientation and vertical framing scale; off-target geometry may naturally
change its screen extent under perspective. Scale claims apply to settled Plan axes, not all
depths or foreshortened 3D geometry. Output up vectors remain nondegenerate at vertical views.

S02 must prove the projective transition numerically and in the real renderer before accepting
the seam. Singular/non-finite projection, depth precision failure or disagreement among ray,
overlay and mesh is a provider defect; do not ship a second SVG transform as a fallback. These
evaluation additions do not consume the T3 authoring cutover, because they create no authored
View, path, node, order, timing or unit. Existing guided-motion fixtures remain unchanged.

Camera session ownership permits declared replacement of the active inspection command:
newer accepted intent supersedes the older run; epoch-qualified old completion/cancellation
cannot reclaim or clear the new output. No editor OrbitControls object independently writes
Camera pose/FOV. Pointer controllers translate input into authority requests. When T3 later
adds Follow/Look-through/Preview controllers, it requires accepted `F3.channels@1:camera-handoff-v1`
conformance through this protocol. S02 proves role negotiation/unavailability and inspection
ownership; its read-only probe does not prove authored Camera capture or Preview execution.

### Minimal ordinary Plan representation

S02 admits one horizontal Plan on the current floor's datum. Proposed initial values:
`cutHeightMeters = 1.2` above that datum; **required finite** `depthMeters = 100` below the cut;
crop/span either explicit finite ranges or explicit unbounded lateral coverage; visible source
kind filter and Reveal set explicit. Defaults are calibration choices to ratify with the
family, not values copied into authored Layout. Wall height stays unconstrained by them.

Streams are `cut | projected | hidden | symbol`. Every selectable primitive includes canonical
source reference, compile/representation generation, stream, and optional domain `subRef`
(e.g. Wall side or Opening interval). Never merge selectable primitives and lose membership.
Keep compiled canonical curves and hosted intervals; a rendered subdivision is not a new Wall.
Cut/hide/show changes neither authored topology nor source ownership.

The single Layout membership stage reports `included` or one of `outside-depth`,
`outside-span`, `outside-crop`, `filtered-type`, `no-meaningful-projection`. Depth/crop exclusions
are discoverable in the selected subject/Search state with **Reveal**, a source-qualified
temporary contribution that explicitly alters display/hit eligibility without changing depth
or history. Projection's `outside-frame` is a separate camera/framing reason. Reveal is not
permission to invent an inverse or select obscured/inactive handles. Default 3D enclosure,
floor/ceiling presentation and Plan cuts agree on the same compiled source.

Section/peel/lift families remain explicitly unsupported by this implementation; unknown
required families reject, optional absent families are reported unavailable and may be omitted.
The common F.3 address can grow through declared families; v1 is not a generic property-write
API that can change topology or interpolate Camera FOV outside Camera.

### Provider acceptance and consumer conformance

The gate is ready only after real exports and conformance fixtures exist and an independent
acceptance names the provider/commit. The owning gate row must later point at those exact
artifacts; this draft does not prefill readiness paths. Intended proof homes are durable
viewport/representation tests under the editor's mirrored test tree and runtime-safe package
exports; they are created with implementation, not fake files during planning.

| Probe | Required proof |
| --- | --- |
| Projection/inverse | Plan/3D/intermediate poses, pan/zoom/nonzero datum, offset canvas, DPR 1/2, aspect change: world→CSS→ray/known-plane agrees within declared numerical tolerance; behind/clipped/offscreen/parallel/stale results differ. Target-plane scale and exact Plan orthogonality hold. |
| Layout | Free-standing/shared/curved Walls, varying heights, junction surfaces, Opening void/caps: correspondence remains source-correct; finite-depth exclusion/Reveal is reasoned; no selectable merge or second compiler. |
| T2-style consumer | A test-only adapter projects an existing canonical Scene entity's world transform/footprint in both readings, acquires a working-plane ray, and returns an explicit point to a stub Scene planner. Host never authors Y or chooses support; T2 owns those. Demonstrate same source identity and teardown without private Stage imports. No T2 production placement is implemented as a probe. |
| T3-style consumer | A test-only overlay adapter projects an existing read-only Camera eye/target and consumes a Camera inspection request; an instrument slot can mount/unmount without Camera authoring. No order, View capture or migration is implemented. Verify one output/controller and same matrices. |
| Replacement/lifetime | Dispose adapters, materials/buffers, listeners, leases and pending callbacks once. Prior-epoch load, ray, gesture and Camera completion cannot affect the new project. |
| Shell/isolation | Overlay/sheet changes do not fit or move Camera; canonical selection/focus distinctions persist; narrow/long-name/reduced-motion states work. Neither public visitor nor shared evaluator imports the editor host, history or authoring helpers. |

After gate acceptance, T2/T3 can declare exact `T1.viewport-projection@1` and import the public
facade. They need not consume later T1 precision or representation-depth slices. Supported
optional adapter extensions keep major version 1 with amendment evidence; breaking coordinate,
identity, lifetime or required-method semantics require a new version and consumer re-declaration.
Ratification/implementation in a consumer's own diff cannot satisfy its trusted-base prerequisite.

## F amendment drafts

These are the smallest exact interfaces needed by this proposal. The owner must promote/ratify
them into F with stable anchors, consumer list, version and conformance before implementation. The proposed Accepted-capabilities / Requires extension in
[cross-track readiness](../../cross-track-execution.md#small-readiness-amendment-proposed-for-ratification)
is also a prerequisite; today's checker does not enforce it.
No change to F/reference, the global gate register or another track is made by this proposal.

### F.1 Reference and resolution — S01 provider

Propose `SemanticReference@1` with the following required fields. All IDs are opaque nonempty
stable strings; ordering is stable ID ordering, never a parsed display label.

| Field | Exact proposed meaning |
| --- | --- |
| `version: 1`, `domain` | Domain is Layout, Scene, Camera, Experience or a declared typed-resource kind; unsupported required domain/kind is incompatible. |
| `revision` | Tagged `exact {contentRevision}` (immutable domain/source content identity) or `project-lock {projectId}` resolved **against the supplied accepted snapshot and lock**. No ambient latest lookup. A resolution records its concrete revision. Session acceptance tokens are not persisted references. |
| `subject {kind, id}` | Stable canonical subject; kind declares target scope and resolver. Components/capabilities have their own opaque IDs where addressable; absent component/capability is explicit, not fabricated. |
| `instancePath: readonly ID[]` | Ordered stable instance IDs; empty path explicitly denotes the root subject. Mutable hierarchy/name paths are not accepted. |
| `location` | Tagged `project-root` or `layout-location {levelId, structureInstancePath}`. Current Layout floor ID maps explicitly to level qualification in the read adapter; empty structure path means the project root. No Level schema or fake Room/structure is introduced. |
| `componentId`, `capabilityId` | Explicit nullable stable addressable identity. Unknown component/capability returns typed resolution/repair result; no nearest/name matching. |

`resolveReference(reference, snapshotContext)` returns a tagged result: `resolved` with canonical
subject, concrete revision and owner; or `missing | removed | incompatible | unauthorized |
repair-required` with original reference, code/message and explicit supported repair actions.
Resolvers perform no repair as a read effect. S01 also defines the shared read-context identity
`SnapshotIdentity@1 = {acceptedRevision, sourceContentId}` with a separate host SessionEpoch;
AcceptedRevision is opaque `{projectId, revisionId}`, while current-source content identity hashes
the canonical serialized source. S01 owns these read-context types; F4 reuses them. Validated
read-only boot establishes a captured baseline, without claiming a mutation/history capability.
The adapter holds accepted metadata outside current source JSON. Resolvers evaluate exact
references against that supplied
snapshot, and return `incompatible` for project-lock resolution without an admitted F.2 lock
reader. Do not manufacture a dependency lock. On valid source acceptance the selection owner
explicitly requalifies a surviving canonical subject through the acceptance correspondence to
the new concrete revision; missing/retired subjects never retarget by proximity. This preserves
one identity without pretending an exact old-revision reference resolves to new content.
Current adapters support actual Layout entities,
Scene entities and read-only current Camera subjects; Experience/resource subjects may remain
explicitly unresolved until their provider lands. No fake occurrence identity is admitted.

`FrameReference@1` tags project-world or an owner-qualified frame identity/reference and revision.
The owning domain resolves origin/orientation/datum and validates point/vector conversion; a
current Room without an authored frame cannot qualify. F3 addresses and T2 typed operation inputs
reuse this identity contract; no generic execution machinery is required to transform a point.

`DerivedSourceRef@1 = {source: SemanticReference, generationId, stream, subRef?}` is runtime-only.
Selection stores its canonical source, not fragment identity; generation-qualified fragment
details expire on recompile. Repeated names, repeated instances and repeated future Stop uses
must not collapse into one identity. Fixtures include nonzero floor qualification, root Scene,
stable instance-path round trips, generation invalidation, missing/unauthorized/unsupported
resolution, and refusal of nearest/name repair. Unsupported required extensions reject; optional
ones cannot change core identity. F1 gate acceptance proves this common interface and registry
admission rules, not every future domain resolver or public-address implementation.

### F.3 Address/value and inspection families — S01 provider, S02 evaluator

Propose `ChannelAddress@1 = {ownerReference, instancePath, componentId, capabilityId,
propertyId, frame}` with no delimiter-string parsing. `frame` uses shared FrameReference@1, tagged project-world,
Layout-level, Wall-host or declared internal/room-local frame with stable ID and revision;
validity/conversion comes from its owner. Current Room without a frame does not qualify as one.

`ChannelDescriptor@1` declares value type, units, finite range/categorical values, output/session
scope, supported operators/interpolation, required/optional capability, invalidation inputs and
validator identity. `ChannelContribution@1` carries descriptor/address, typed value, invocation
identity and monotonic accepted run epoch. It is separate from an authored baseline. F3's shared
gate validates these shapes/negotiation/conflict rules; it does not expose unrestricted setters.

Initial admitted families:

| Family | Values/units | Operator and invalidation |
| --- | --- | --- |
| Layout ordinary Plan | Cut height relative to explicit datum (finite meters); depth (finite meters >0, required); optional explicit finite lateral span/crop; source-kind filter; source-qualified Reveal set | Exclusive baseline inspection contribution; deliberate replacement allowed within the same inspection owner. Reveal is set union for declared source identities only. Re-evaluate on accepted Layout revision, parameters, generation or frame change. |
| Camera session inspection output | Finite target in project-world meters, azimuth/elevation in radians, positive target-plane frame height in meters, reading/projection policy, motion policy inputs | One exclusive resolved controller per output; accepted ordered replacement/handoff. Camera evaluates pose/projection; no generic pose/FOV lerp. Re-evaluate on intent, explicit clock, viewport rectangle, source extent or epoch change. |

Conflicting unsupported exclusive contributions reject with domain/address/owners and actionable
reason. Replacement invalidates older run cleanup; wrong epoch cannot clear the active output.
Representation parameters remain semantic values; editor recipes assemble them but do not own
their meaning. Fixtures cover finite default/depth absence, invalid units/frame/range, unknown
required family, optional unsupported family, conflict, replacement and stale cleanup, plus
runtime-safe import direction. Rich execution operators are later declared extensions.

### F.4 Intent/revision/result and early local foundation — S03 provider

Proposed sole common provider: T1.P01.S03, with `local-single-domain-v1` admission for registered
Layout or Scene planners. The exact timing amendment permits this shared local foundation and
early conditional Save before Experience. First compound Camera/Experience acceptance remains T3.
The initial local capability proves neither cloud persistence nor unit/lock/resource admission.

Ratify these source-independent signatures before implementation:

- `AcceptedRevision@1 = {projectId, revisionId}`: opaque accepted identity, fresh on every source
  change and Undo/Redo. `SourceContentId` hashes canonical authored contents/resource context;
  `SessionEpoch` guards host lifetime. Neither digest nor epoch is the accepted revision token.
- `AuthoringIntent@1`: version, registered kind, operation ID, expected AcceptedRevision, qualified
  targets, typed serializable payload and captured inputs/allocated IDs. No clock/random/network,
  closure, pending gesture or renderer handle enters deterministic planning.
- `AcceptedSnapshot@1`: validated read facade with accepted revision, source-content identity,
  admitted source-kind/version and domain read access. Domain payloads/candidates remain behind
  source/domain adapters. No required signature embeds current ProjectDocument or F2 encoding.
- `prepareIntent(snapshot, intent, capturedInputs)`: unchanged expected baseline plus validated
  candidate changes/correspondence/diagnostics, or typed rejection. Keep operation-specific Layout
  planner outputs behind coordination; no universal planner algorithm or base class.
- `AcceptanceResult@1`: accepted `{operationId,beforeRevision,afterRevision,snapshot,changes,
  correspondence,undoResult}`, no-op `{operationId,revision}`, or rejected `{operationId,code,
  expectedRevision,actualRevision when authorized,diagnostics}`. One logical install/undo result.

`local-single-domain-v1` registers Layout and Scene adapters, runs complete current-project
validation and unchanged-domain/resource enforcement, and refuses multi-domain, new-unit,
external-staging or resource-changing operations. Prove one real Layout candidate and one
validated Scene scalar candidate through the registration seam; T2 owns its production placement/
transform operations. Preserve co-located Camera fields exactly. Do not manufacture a dependency
lock or serialize this session wrapper into current source.

Use one 100-entry chronological snapshot history through the same acceptance boundary. Undo/Redo
validates current-source restoration with fresh revisions; no-op/refusal/cancel changes neither
source nor history; new edits truncate redo. Selection requalification uses explicit correspondence.
Compare authored contents rather than revision/allocation bookkeeping. Prior-epoch callbacks cannot
install; project replacement starts a new baseline. No privileged direct UI/history write bypass.

T3 S02 adds `conditional-save-current-v1` using captured local accepted source plus create-only or
expected-saved-base persistence. This is independent of F2/Stage and introduces no cloud Undo stack.
T3 S03 adds `unit-acceptance-v1` and `conditional-save-units-v1` to the same implementation, with
full F2/reference/lock validation, admitted resource staging, real Camera/Experience compound
planners and whole-operation history. The [coordinated readiness proposal](../../cross-track-execution.md#small-readiness-amendment-proposed-for-ratification)
requires explicit capability evidence on the trusted base; base gate acceptance cannot satisfy them.

T3 S04 migrates all Stage/acceptance/Save/starter callers and retires current-source adapters in one
source transition. Retirement ends the current-source adapter admission only; the revision/result/history
invariants above endure as prerequisites of the unit capabilities, and shipped `local-single-domain-v1`
evidence stays valid history. This is an explicit persisted-format cutover, not a second F4 protocol. Keep the
F4 major only because revision/result/facade semantics are reconciled now; breaking changes later
require a new major and consumer redeclaration. Administrative migration resets source history
with retained recovery material; normal Undo never reinstalls the retired schema.

Conformance: captured-input determinism and IDs, local stale/ABA rejection, real Layout/Scene
registration, exact mixed chronological Undo/Redo, redo depth/truncation, full validation rollback,
unsupported compound/resource refusal, untouched Camera bytes, and bypass-sensitive caller proof.
Cloud/unit readiness requires the separately named extension records, never inferred coverage.

### F.2 and F.5 disposition

**No new F.2 unit/envelope or F.5 release interface is needed by S01/S02.** Current strict
ProjectDocument reads remain the landed encoding; ephemeral snapshot/generation/viewport state
does not create a new authored unit. F.2's Camera split remains simultaneous with T3's order
cutover. The F.4 early-current-source exception above must be explicitly ratified; it must not be
presented as an already conforming F.2 envelope or resource lock.

T3 S01 is the sole proposed F2 unit/envelope/lock provider; T4 S02 provides F5 using T3's shared
ExecutionProgram codec. Their scopes and readiness are reconciled in
[cross-track allocation](../../cross-track-execution.md#provider-and-acceptance-matrix). This phase exports no
prepared program, new publication format or authoring machinery to visitor releases, and
neither consumes nor provides `F2.unit-envelope` or `F5.release-envelope`. If implementation
finds it needs a new persisted header, resource lock or cross-domain unit format, stop that
dependent slice and route an exact F amendment/provider prerequisite; do not invent it locally.
