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
| `StageReadSnapshot` | Immutable validated current ProjectDocument, F.1 revision context/content identity, session epoch, compile generation and resolved runtime-safe Layout/Scene inputs. One coherent source snapshot; compiled geometry is never authored or deep-proxied. Later F.2 snapshots enter through an explicit reader adapter, not a cast. | Project coordination; T1 read adapter until T3 cutover |
| `ViewportRect` | CSS left/top/width/height and DPR, all finite, width/height positive. CSS coordinates drive input/overlays; framebuffer pixels only drive rendering. Hidden/zero-size viewport yields unavailable output rather than division by zero. | Stage host |
| `ViewportEvaluation` | Immutable output ID, epoch, source revision, evaluation generation, realized eye/target/up, view and projection matrices plus inverses, near/far, target-plane meters per CSS pixel, projection kind, settled reading, working-plane qualification and diagnostics. Matrices use a documented column-major right-handed convention with project +Y up and X/Z horizontal. | Camera evaluation |
| `projectWorld(point, evaluationId)` | Returns `{css:[x,y], ndcDepth, visibility}` for finite project-world meters. Visibility is `visible`, `outside-frame`, `clipped` or `behind`; projection is not a membership/selection decision. Invalid input/stale evaluation fails explicitly. | Camera projection |
| `pointerRay(cssPoint, evaluationId)` | Returns finite project-world ray origin and unit direction from the **same** rendered matrix/inverse. Orthographic rays have varying origins/parallel directions. No separately inferred FOV or pixels-per-meter transform. | Camera projection |
| `intersectWorkingPlane(ray, frame, evaluationId)` | Returns world point and qualified local coordinates, or `parallel`, `behind`, `outside-supported-domain`, `invalid-frame`, `stale-evaluation`. The plane/frame is explicit, never nearest Room. Snapping/host/support constraints are downstream domain operations. | Camera ray math; frame validity from owning domain |
| `requestViewingIntent(intent, expectedOutputEpoch)` | Pan/orbit/zoom, Plan↔3D reading, Fit extent, Bring into view, explicit return-context operations; returns accepted/rejected/superseded. Intent supplies finite target/frame/scale and explicit policy inputs, never shell-generated tween poses. Duration/reduced-motion changes scheduling, not endpoint meaning. | Camera session controller/evaluator |
| `evaluateLayoutPlan(compiled, parameters, sourceContext)` | Returns four typed streams, per-fragment correspondence, per-source membership with exclusion reasons, bounds and diagnostics. It clips/projects canonical sampled solids/query records and never re-fits curves or extracts another topology. | Runtime-safe Layout representation |
| `resolveSourceHit(candidate, readSnapshot)` | Candidate carries source F.1 identity, generation and optional domain sub-reference. Reject stale fragments; resolve to canonical identity or explicit failure. Opening void/cap uses host+compiled intervals/profile, never nearest mesh face. | Domain hit adapter, hosted by Stage |
| `registerStageAdapter(adapter)` | Editor-only registration of domain/required capabilities, world graphics, overlay contribution, eligible hit provider, selection echo, explicit task/instrument factory and disposer. Unknown required capability refuses mounting. No unowned writable store is passed to it. | T1 host; adapter content T2/T3 |
| `acquireGesture(owner, outputEpoch, evaluationId)` | One captured pointer/writer lease with revision and domain parameterization; supplies cancellation on loss, replacement, owner unmount. Navigation and overlays cannot steal a captured gesture. Projection changes require adapter revalidation; stale samples cannot silently commit. | Editor session host |

Public editor access also exposes read-only canonical selection plus `select(reference)` and
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
adds Follow/Look-through/Preview, it must declare handoff/return policy through this same owner.

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
them into F with stable anchors, consumer list, version and conformance before implementation.
No change to F/reference, the global gate register or another track is made by this proposal.

### F.1 Reference and resolution — S01 provider

Propose `SemanticReference@1` with the following required fields. All IDs are opaque nonempty
stable strings; ordering is stable ID ordering, never a parsed display label.

| Field | Exact proposed meaning |
| --- | --- |
| `version: 1`, `domain` | Domain is Layout, Scene, Camera, Experience or a declared typed-resource kind; unsupported required domain/kind is incompatible. |
| `revision` | Tagged `exact {revisionId}` (immutable content identity) or `project-lock {projectId}` resolved **against the supplied accepted snapshot and lock**. No ambient latest lookup. A resolution records its concrete revision. Session acceptance tokens are not persisted references. |
| `subject {kind, id}` | Stable canonical subject; kind declares target scope and resolver. Components/capabilities have their own opaque IDs where addressable; absent component/capability is explicit, not fabricated. |
| `instancePath: readonly ID[]` | Ordered stable instance IDs; empty path explicitly denotes the root subject. Mutable hierarchy/name paths are not accepted. |
| `location` | Tagged `project-root` or `layout-location {levelId, structureInstancePath}`. Current Layout floor ID maps explicitly to level qualification in the read adapter; empty structure path means the project root. No Level schema or fake Room/structure is introduced. |
| `componentId`, `capabilityId` | Explicit nullable stable addressable identity. Unknown component/capability returns typed resolution/repair result; no nearest/name matching. |

`resolveReference(reference, snapshotContext)` returns a tagged result: `resolved` with canonical
subject, concrete revision and owner; or `missing | removed | incompatible | unauthorized |
repair-required` with original reference, code/message and explicit supported repair actions.
Resolvers perform no repair as a read effect. S01 also defines the shared read-context identity
`SnapshotIdentity@1 = {projectId, sourceContentId}`; current-source readers use the canonical
serialized source's content identity. They resolve exact references against that supplied
snapshot, and return `incompatible` for project-lock resolution without an admitted F.2 lock
reader. Do not manufacture a dependency lock. On valid source acceptance the selection owner
explicitly requalifies a surviving canonical subject through the acceptance correspondence to
the new concrete revision; missing/retired subjects never retarget by proximity. This preserves
one identity without pretending an exact old-revision reference resolves to new content.
Current adapters support actual Layout entities,
Scene entities and read-only current Camera subjects; Experience/resource subjects may remain
explicitly unresolved until their provider lands. No fake occurrence identity is admitted.

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
propertyId, frame}` with no delimiter-string parsing. `frame` is tagged project-world,
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

### F.4 Intent/revision/result and early local foundation — S03 conditional provider

**Exact timing amendment requested:** replace the first-implementation constraint with:
“A bounded shared local acceptance/history foundation may precede the Experience cutover for
single-domain Layout intents over the current project encoding. The first compound acceptance,
Camera-unit/Experience-order cutover and cloud expected-revision Save remain T3 obligations.
The early provider neither accepts multi-domain/resource-changing intents nor labels the current
document as the F.2 destination envelope.” The owner must also approve T1's bounded provider
assignment or assign it to T3 before S03 starts. This is a sequencing/scope amendment, not
permission for separate acceptance semantics.

Draft common interfaces (implemented in shared project coordination, not phase-local code):

- `RevisionToken@1`: opaque project identity, session epoch, monotonic accepted sequence and
  canonical source content identity. Cloud revision tokens are an explicitly supported future
  extension, not a session sequence sent to today's Save API. Token equality is exact.
- `AuthoringIntent@1`: version, registered kind/owning domain, expected revision token, stable
  operation ID, qualified canonical target references, typed serializable payload and captured
  inputs/allocated identities. No closure, Three object, clock/random call or pending gesture.
- `PrepareResult@1`: candidate plus domain diagnostics/correspondence and unchanged baseline
  context, or typed rejection. Domain planners keep operation-specific results behind this
  coordination adapter; the interface does not force one Layout planner protocol.
- `AcceptanceResult@1`: `accepted {beforeRevision, afterRevision, snapshot, changes, undoResult}`,
  `no-op {revision}`, or `rejected {revision, code, diagnostics}`. Failure retains the supplied
  expected snapshot. Changes/correspondence are domain-qualified source identities; no generated
  mesh IDs. Selection mapping is an explicit editor policy over that result, not hidden retargeting.

S03 admits current-source, single-Layout intents only. The current-source read adapter preserves
Scene/Camera and all existing resource bindings verbatim, runs the full current project validator
and Layout gates, and refuses any operation that needs new units, lock changes, external staging
or compound changes. It does not invent an empty dependency lock for an asset-bearing project.
Its accepted snapshot/revision/history wrapper is session coordination, never serialized into
ProjectDocument. New F.2 envelope/resource consumers must declare their accepted interface gates
and install the complete lock/resource validation before they are admitted; unsupported intents
fail explicitly. The current-source adapter retires when T3's cutover reader replaces that source
shape, with its callers migrated together and no indefinitely writable legacy branch.

One Layout gesture/field enters prepare/validate/accept once. Snapshot installation and its undo
result are one logical publication; partial state is never visible. Validation/refusal/no-op/stale
results do not mutate selection or history. Snapshot undo/redo uses this same acceptance boundary
with fresh tokens, canonical validation and unchanged resource context; it is not a privileged
backdoor. Initial history depth is 100; source comparison uses canonical authored content, not
display rounding or incidental allocation bookkeeping. Domain-specific no-op diagnostics map to
the common no-op outcome without a history entry.

Fixtures: identical intent/captured inputs deterministic; captured plinth ID reused on replay;
local stale writer; previous-epoch
completion; invalid/no-op rollback; one valid undo result; redo truncation/depth; download/parse
round trip; resource/compound/unsupported-unit refusal; call-site bypass; untouched Scene/Camera.
F4 gate acceptance must name this **local scope**. It is not the T3 compound/camera-experience gate
or evidence that cloud Save is safe. T3 extends the same accepted interface with its required
unit/lock/staging/compound adapters, using a new major version if the interface breaks.

### F.2 and F.5 disposition

**No new F.2 unit/envelope or F.5 release interface is needed by S01/S02.** Current strict
ProjectDocument reads remain the landed encoding; ephemeral snapshot/generation/viewport state
does not create a new authored unit. F.2's Camera split remains simultaneous with T3's order
cutover. The F.4 early-current-source exception above must be explicitly ratified; it must not be
presented as an already conforming F.2 envelope or resource lock.

T2/T3 draft their first unit header/envelope/lock interfaces with their actual persisted
consumers. T4 drafts the release manifest/profile/reader interface. This phase exports no
prepared program, new publication format or authoring machinery to visitor releases, and
neither consumes nor provides `F2.unit-envelope` or `F5.release-envelope`. If implementation
finds it needs a new persisted header, resource lock or cross-domain unit format, stop that
dependent slice and route an exact F amendment/provider prerequisite; do not invent it locally.
