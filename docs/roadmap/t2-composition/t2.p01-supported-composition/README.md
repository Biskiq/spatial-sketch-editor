# T2.P01 — Supported object composition: phase proposal

**Status:** proposed for owner review, 2026-10-14. Candidate identifiers are reserved by this
proposal only. No phase is registered, no slice is authorized, no gate is accepted and no
architecture-cycle transition is made. Routes: [T2](../README.md),
[runbook](../../../operations/t2-composition/README.md),
[shared gate register](../../README.md#gate-register).

**Recommendation:** rebuild a small, complete object-arranging experience over the current
Scene format: upright floor-supported objects, one canonical placement, Plan/3D selection,
horizontal move, yaw, positive uniform resize, duplicate, delete and exact local Undo/Redo.
Start with **S01: deterministic candidates and canonical floor support**, independently of a
working viewport. S03 is the first useful editing surface; S04 completes the bounded phase.

Use native box/cylinder/sphere objects and a verified subset of existing floor models. An
object is useful before it is an assembly. This gives creators real spatial work and a durable
operation boundary without making importer depth, a generic gizmo framework, materials, lighting,
complete Layout authoring or Experience migration prerequisites.

## Outcome and boundary

A creator explicitly starts T1's canonical starter gallery or opens a valid project with compiled
floor support, chooses an upright native/verified model object, places/moves/yaws it, and uses
exact input and shared Undo/Redo in Plan and 3D. T2 S04 adds Resize, duplicate/delete and the
safe Save/reload journey. Source JSON recovery is available from the first surface.

Genuinely empty Layout still has no floor polygon: Place refuses and offers **Start gallery**
through T1's explicit project-replacement flow or opening supported source. It never inserts
architecture silently. Neither a datum nor T1's plinth is support. General Wall drawing and
its derived-role/schema cutover are not prerequisites for a validated canonical starter.

Use the [coordinated provider/readiness/DAG proposal](../../t1-spatial-world/t1.p01-stage-foundation/cross-track-reconciliation.md) and
[shared source-independent interfaces](../../t1-spatial-world/t1.p01-stage-foundation/interfaces.md); no proposal link is a trusted-base dependency.
F4's local Layout/Scene capability, conditional Save and unit/compound capability have separate
acceptance evidence. Local edits are accepted locally and dirty until an acknowledged conditional
Save; the server need not execute every editing command. A conflict preserves local work/history.

Planning proceeds on the landed r186 base: the separate
[r186 upgrade (PR #122)](https://github.com/Biskiq/spatial-sketch-editor/pull/122) merged into `main`
as `74efb98b` (three 0.186.1, Threlte unchanged, explicit `PCFShadowMap`). Each implementation plan
verifies affected projection/model/renderer compatibility against that landed base — admitted-model
contact verification runs on r186 with loader ownership retained — rather than inheriting this
post-#116 planning inspection.

This is a composition foundation, not publication or the complete creator-to-visitor loop.
**T2 owns the next bounded single-model ingest phase**, using accepted F2/resource locks,
F4 staged/unit acceptance and T4 resource delivery. It must precede the promised creator/audience
trial; it does not wait for assemblies, a marketplace or a general importer pipeline.

## Evidence and actual surviving implementation

Inspected at `61baf02873a63d37e3f5a3e2992396f387600d38` (post-PR #116), on
`setup/t2-composition`.

The [T2 evidence](../planning-evidence.md) preserves behavioral obligations, not the old P24
sequence. [Architecture](../../../reference/architecture.md),
[Scene](../../../reference/components/scene-content.md),
[F](../../../reference/composition-execution.md), the
[ratified direction](../../../reference/decisions/northstar-ratification-2026-09-27.md) and
[World/Experience amendment](../../../reference/decisions/world-experience-reconciliation-2026-09-29.md)
govern the design.

| Inspected evidence | Finding and planning consequence |
| --- | --- |
| `packages/project-model/src/scene.ts`, `scene-codec/parse-entities.ts`, `project-codec.ts`, `wall-first-project.ts`; current Scene/project tests | Scene v1 is world-local; strict writers/readers reject Room ownership and unknown fields. Finite transforms and positive scalar scale exist. Optional legacy-looking TypeScript fields/comments do not establish supported storage. Use the public validation/serialization boundaries. |
| `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte`; [retained authoring inventory](../../../../apps/editor/src/lib/authoring/README.md) | The route is a foundation-reset notice. There is no editor session, placement controller, selection store, history runner or gizmo host to reconnect. Pure survivors need fresh behavioral and call-site proof. |
| `authoring/scene/plan-scene-footprint.ts`, `plan-scene-hit.ts` under the editor source | Canonical asset footprint → entity scale → yaw → world X/Z is retained, with containment before a six-CSS-pixel edge halo. It omits lights/missing metadata, but also ignores pitch/roll and gives planes a rectangle independent of actual orientation. Add explicit truthful eligibility; do not advertise this helper as general projection. |
| `authoring/scene/cluster-obb.ts`, `obb-util.ts`, `scale-vector.ts` under the editor source | Placement-local mesh bounds math survives; it is derived renderer data. PCA group bounds are not a stable semantic pivot. Independent-scale averaging and silent fallback in the old scale helper are unsuitable for accepted operations. Neither nested rigs nor per-axis transient truth is required. |
| `apps/editor/src/lib/types/assets.ts`, `content/assets.ts`, `museum/assets/AssetModel.svelte`; normalization/Plan-proxy pipeline | Footprints are already canonical meters. The renderer separately applies `defaultScale`/`defaultRotation` inside the instance root. A new entity starts at relative scale 1; copying `defaultScale` into it scales twice. Ground-contact metadata is not a general typed asset field today: verify and declare it for the admitted subset. |
| `packages/layout-core/src/layout-geometry-types.ts`, `layout-geometry-queries.ts` | Compiled `room-floor` polygons and `CompiledRoom.floorElevation` are usable support evidence. `findPolygonContaining` returns a first reverse-order match; it cannot resolve elevation ambiguity. Enumerate semantic candidates using the canonical compiler output; do not raycast a render mesh for authoritative Y. |
| Generic entity/material/asset renderers; [asset contract](../../../reference/components/assets.md) | Runtime-safe realization and resource lifetime machinery survive. Creator model/HDR ingestion, approval UI and project GLB upload do not. Current registry upload is image-focused. No second loader or engine upgrade is implied. |
| `apps/editor/src/lib/platform/project-persistence.ts`, `apps/api/src/project-persistence.ts` | Current readers/writers survive, but cloud saves lack an expected-revision precondition. Local history and safe cloud Save are separate deliverables. Use shared JSON recovery and consume separate early conditional-Save evidence; current Save is not already safe. |

Prototype evidence has different roles:

- [Objects & Assemblies handoff](../../../../prototypes/object-composition-prototype/HANDOFF.md)
  informs capability disclosure, explicit edit scope, refused proposals, exact input and stale
  rejection. Its import/library/attachment/compiler mechanisms are simulated or fixture-specific;
  its orbit controller, schemas and history are not selected production mechanisms.
- [World prototype implementer reference](../../../../prototypes/spatial-authoring/IMPLEMENTER-REFERENCE.md)
  informs Stage continuity, legible handles and return/cancel behavior. Its Camera/projection and
  fixture Scene behavior do not supply a production viewport or placement authority.
- [Accepted World design record](../../../../prototypes/world-experience-shell-round/README.md),
  [Conservatory](../../../../prototypes/experience-ux-alternative/README.md) and
  [Paper proposal](../../../../prototypes/paper-authoring-commission/PAPER-SHELL-PROPOSAL.md)
  inform the ratified [shared shell](../../../reference/design-system/editor-shell-and-visual-system.md)
  and [spatial instrument grammar](../../../reference/design-system/spatial-instrument-grammar.md).
  Earlier permanent inspector/chrome treatment is superseded. Detailed 3D object tools remain a
  declared non-blocking coverage gap to resolve in S03/S04's real surface review.

No historical editor source is restored by this plan, and prototype QA is not production evidence.

## Ownership and invariants

| Concern | Single authority |
| --- | --- |
| Object records, placement candidates, root transforms, operation validity | Scene / `SceneDocument`; shared pure Scene planning in project-model with injected normalized asset policy |
| Architecture and floor evidence | Layout's canonical compiler/query records; a runtime-safe read-only support query, reviewed with T1, supplies floor candidates |
| Projection, rays, framing and navigation | Camera through the public T1 viewport seam; T2 never drives an independent Camera or projection transform |
| Selection, task focus, gesture lease and display lifecycle | One T1 editor host. T2 supplies Scene identity/eligibility adapters, not another selection store |
| Accepted project revision and chronological history | One shared F.4 local coordination boundary, conditionally brought forward; T2 registers Scene planners into it |
| View-specific graphics and helpers | T2 editor adapter; derived and disposable, with no path into authored JSON or visitor authoring imports |

**Frames.** The owner clarified the request during planning: keep world-local Scene storage and
preserve explicit local-frame math, without restoring Room-owned records. Project +Y is up,
X/Z horizontal, meters and radians internally. A supplied local frame transforms points and
directions once at the boundary; directions exclude translation. The inverse must round-trip
nonzero origin/yaw/elevation. Current wall-first Rooms carry no authored frame: neither
containment, polygon centroids nor legacy Room helpers may invent one. Internal asset
normalization and Scene root transforms remain distinct. Missing/stale frame context refuses.

**Shared representation.** One entity ID/pose produces both the 3D instance and its derived
Plan footprint. No Plan proxy record, second transform, support attachment, Room owner, render
handle or history data is persisted. Canonical selection survives a reading change, including
selected entities Plan cannot depict. Unsupported entities remain discoverable through the
Index/Card with a reason; no invented footprint or invisible manipulation target.

**Support.** New placement and explicit Place on floor resolve contact elevation before the
preview is displayed. Support is read-only, revision-qualified evidence, not a host relationship.
Horizontal Move preserves existing Y, pitch/roll and scale; it refuses a destination that cannot
support that resting elevation. A different floor requires explicit Place on floor, which owns
the resulting Y. Yaw preserves all other components. Resize on floor explicitly owns uniform
scale and the Y adjustment needed to keep the same contact elevation. No continuous grounding
after Layout edits, mesh-based Y correction after commit or automatic floor reassignment.

**Determinism.** Allocate IDs/capture metadata before preparation; evaluate against one expected
project revision. Pointer, keyboard and exact fields submit the same typed operations. One
accepted gesture/action produces one Scene history result; invalid, stale, cancelled and exact
structural no-op results produce none. Redo restores captured IDs/results; it does not query the
live catalogue, recalculate a new support choice or allocate fresh IDs.

## Proposed slice boundaries

This is a **candidate sequence**, not a live slice register. All rows are proposed; the gate
versions below are recommendations, and no listed gate is ready on this base. Earlier slice
acceptance/merge is also required. [Contracts](./contracts.md) owns the detailed draft shapes.

| Candidate | Consumes, accepted at trusted base | Requires (proposed capability field) | Capability and exit evidence |
| --- | --- | --- | --- |
| T2.P01.S01 | F1.reference@1 | F1.reference@1:references-v1 | Pure deterministic Scene candidates, canonical floor-support enumeration and verified normalization. Existing typed Scene transform payloads; no F3 execution-channel prerequisite. |
| T2.P01.S02 | F1.reference@1, F4.intent-acceptance@1 | F1.reference@1:references-v1, F4.intent-acceptance@1:local-single-domain-v1 | Register actual Scene operations in the shared current-source coordinator; mixed chronological history, stale/no-op/refusal proof. |
| T2.P01.S03 | F1.reference@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:references-v1, F4.intent-acceptance@1:local-single-domain-v1 | Place, Move, Yaw, re-seat and shared Undo on the public Stage. Source recovery; Save shown only when its separate accepted capability is available. |
| T2.P01.S04 | F1.reference@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:references-v1, F4.intent-acceptance@1:local-single-domain-v1, F4.intent-acceptance@1:conditional-save-current-v1 | Resize, duplicate/delete and integrated starter → arrange → Undo → safe Save/reload. Exhaustive final gate. |

T3 S04 migrates existing callers and unfinished plans to accepted F2 `unit-envelope-v1`, F1
`unit-resolution-v1` and F4 `unit-acceptance-v1` from T3 S01/S03, with
`conditional-save-units-v1` for Save users. Replace current-source capability requirements then;
do not consume a retired adapter. Plain Scene caller migration does not require T3 Camera-authoring
UI or the gate produced by that same activation slice. All prerequisite evidence must already be
on main at trusted base; no consumer satisfies itself with its own readiness edits.

### S01 — deterministic candidates and canonical floor support

VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ./README.md#s04--complete-and-verify-the-bounded-composition-loop

Implement operation-specific pure planners and the bounded support query described in
[contracts](./contracts.md#floor-support-query). Keep Scene planning in the existing shared
project-model package, asset normalization policy injected, compiled floor evaluation Layout-owned
and renderer bounds editor-only. A small read-only Layout query addition is proposed work for
this slice under Layout/T1 review, not authorization to alter geometry or topology.

Admit native box/cylinder/sphere with analytical ground contacts and yaw-only floor models with
verified normalized footprint/contact metadata. Use at least one real catalogue model with a
non-unit source normalization scale (piano is a useful discriminating fixture). Do not promise
the whole catalogue: missing contact metadata or unverified correction yields an explicit reason.
Do not use asynchronously loaded mesh bounds as an unrecorded placement input. Plane primitives,
wall/ceiling/surface models, light editing, tilted models and ambiguous default orientation are
outside admission; existing records still load and render unchanged.

**Exit:** equivalent Plan-point and 3D-hit evidence prepares the same entity, including Y;
raised-floor and transformed-input-frame cases pass; no support rejects; distinct elevations
request a choice; coincident equivalent supports deduplicate without array-order dependence.
The current Scene/project codec accepts every candidate, normalization is applied exactly once,
all unrelated fields remain exact and a `roomId` property is never created. The admitted
metadata inventory and exclusions are reviewable artifacts, not notes buried in a UI handler.

### S02 — one accepted Scene edit and history result

VERIFICATION: architecture-integration
INTEGRATION ROUTE: ./README.md#s04--complete-and-verify-the-bounded-composition-loop

Consume the shared acceptance foundation; register Scene operations and validation, not another
history runner. Keep the current-source adapter explicitly bounded to the landed project format.
Validate the entire current project with host catalogue policy before atomic installation.
Preserve Layout and existing Camera fields, material/resource bindings and unrelated Scene records.
Missing targets or an invalid batch leave everything unchanged. Acquire no resources here.

Prepare all phase operations here, even where their UI follows in S04: place, move-horizontal,
set-yaw, place-on-floor, resize-on-floor, duplicate-one, delete-one. Duplicate is exactly +0.5 m
world X and Z, retaining Y, rotation, scale and material sharing. It does not silently re-ground;
if the shifted contact has no equivalent support, refuse and offer ordinary Place separately.
New duplication of cluster members/sets is refused with a reason in this phase. Deletion cleans
cluster membership and removes an empty cluster atomically, with selection correspondence supplied
to the host; there are no Camera/Experience subject-reference schemas to invent.

**Exit:** identical intent/captured inputs is deterministic; one edit gives one undo result;
Undo/Redo use fresh revision tokens and exact stored snapshots; stale/local previous-epoch results
cannot install; new edit truncates redo; no-op/invalid/cancel writes nothing. Prove alternating
Layout and Scene edits share one chronological stack and undoing Scene never rolls back an
intervening Layout result. A direct caller bypass test must fail if Scene writes skip acceptance.

### S03 — first coherent editing surface

VERIFICATION: architecture-integration
INTEGRATION ROUTE: ./README.md#s04--complete-and-verify-the-bounded-composition-loop

Use the existing shell's Place family/Find registration, Index, Card, task home and gesture lease.
Arming changes session state only. Place stays armed after success until Esc/Select; the newly
created object becomes selected. Both views display the same prepared candidate; a 3D surface
hit resolves back to compiled Layout evidence. A wall, plinth or another object's mesh cannot
be mistaken for floor support. Card continues to describe accepted identity/facts; proposed
values and precision live in the invoked World Instrument.

Offer horizontal drag and yaw around the entity's declared placement pivot, plus X/Z and angle
entry through the same writer. Snap is an explicit session option (off by default here); any
enabled grid step is captured in the intent's resolved candidate, visible in feedback and never
a hidden commit correction. Withhold a foreshortened grip and retain exact access. No camera
fit occurs because selection changes, a Card opens or a sheet resizes.

The shared host invokes this operation's declared cancel-on-reading-change policy once. An
accepted Plan↔3D change cancels the unfinished pointer interaction before the reading changes,
restores the accepted baseline, preserves the armed task/tool and committed selection, releases the lease once and
invalidates delayed pointer-up. Blur, capture loss, task replacement, project replacement and
adapter unmount use the same cancel path. A replacement epoch cannot be reached by old asset
loads or gesture callbacks. View-only changes create no source history.

**Exit:** from a valid floor project, a creator can place an object, move it, rotate it, switch
readings, enter an exact value and undo/redo without data/UI divergence. Include a Plan-ineligible
selected entity, missing model bytes, unsupported host and mid-gesture reading switch. Review
desktop, narrow, keyboard-only and reduced-motion journeys on the real surface. The last valid
displayed candidate equals its committed pose within 1e-6 meters/radians; no post-preview Y fix.

### S04 — complete and verify the bounded composition loop

VERIFICATION: exhaustive

Add explicit positive uniform Resize on floor, using the same support/contact result in preview
and commit. Numeric scale is the guaranteed route; add a direct handle only if its scale and
pivot are legible. Admit every finite positive scalar the operation can represent; do not import
the old helper's silent minimum/reset policy. Non-finite, zero, negative or unequal-axis input
refuses without averaging. Expose no independent-scale mode or misleading light scale control.

Add duplicate/delete through the common scoped actions/Find list and the S02 operations.
Complete canonical source JSON download/parse/reload through the shared project replacement
guard. Reload validates everything before installation, cancels one active preview, starts a new
session/history baseline and never creates a synthetic source edit. It is source JSON with
existing static references, not a portable asset package. Cloud reads use retained validated paths. Consume T3 S02's separately accepted conditional-save-
current-v1 capability for create-only/expected-saved-base Save and reload. Dirty state tracks
local accepted contents versus the acknowledged saved digest; an in-flight older Save cannot
mark newer edits saved. Conflicts preserve work and require reload/explicit resolution. Persistence
does not add another Undo stack or source edit. After T3 activation use the accepted unit Save adapter.

**Exit:** run the full evidence matrix below, including all required repository verification;
review all four slice outcomes together. Record any detailed 3D UX decisions with their scope
and evidence. This is proposed acceptance work, not an acceptance record.

## Minimum dependencies and reconciliation decisions

The [coordinated proposal](../../t1-spatial-world/t1.p01-stage-foundation/cross-track-reconciliation.md) owns the proposed sole-provider allocation, exact capability
IDs, two-field readiness amendment and safe merge DAG. Ratification and implementation are distinct:
current gate state alone cannot prove incremental capability readiness. No live register changes here.

| Dependency | Exact scope and owner |
| --- | --- |
| F1 | T1 S01 supplies references-v1, separate accepted revision/content/epoch and explicit frame/source qualification. Required for S01; do not invent locks. |
| F4 local | T1 S03 supplies local-single-domain-v1 admitting registered Layout/Scene operations. T2 S02 registers actual planners and conformance, not another F4 provider/history. |
| Conditional Save | T3 S02 extends F4 with conditional-save-current-v1, independent of F2/viewport activation. Needed for S04's safe Save journey; S03 arranging does not wait for it. |
| Viewport | T1 S02 supplies the source-independent validated facade, rendered matrices/planes, one selection/task/gesture host and Camera output protocol. Required only for S03 onward. Floor support remains a Layout-owned query drafted by T2 S01. |
| F3 | No direct prerequisite for this phase's simple typed Scene operation payloads. The viewport owns its F3 dependency; T2 does not create runtime channels to place an object. A future real channel consumer must declare its exact capability. |
| F2/T3 transition | No new source units in T2's initial current-source phase. T3 S04 integrates current callers into already accepted F2/unit-aware adapters; canonical Scene operation semantics remain unchanged. No indefinite current-source writer. |
| F5/T4 | Not consumed by this phase. Later ingest requires closed release resource delivery; source JSON recovery alone proves no release closure. |

No complete T1, new drawing, levels, representation expansion or full T3 authoring prerequisite.
A compatible adapter/kind admission records additional capability evidence; incompatible shared
semantics requires a new gate major and consumer redeclaration. The shared F4 timing and bounded
current-source exception must be explicitly ratified before S02. The landed r186 base (`74efb98b`)
is the required implementation baseline. Source-first conversion and visitor activation stay T3/T4-owned.

## Acceptance evidence to collect

These are required future proofs. None is asserted as run by planning.

| Contract/failure | Evidence and practical pass condition |
| --- | --- |
| Canonical boot → place → commit (Scene successor to TD-1) | Production entry from a valid wall-first project with a reconciled floor (including explicit starter gallery) creates exactly one Scene entity, one history result, finite world pose and no `roomId`. Empty/no-floor boot refuses with useful copy and no edit. T3 owns the original Camera-node equivalent; this phase cannot close that obligation. |
| Support parity | Plan and 3D input for the same X/Z/support yields the same candidate; nonzero floor elevation, local-frame conversion, shared boundary, coincident candidates, overlapping elevations and no support. Reorder query arrays: result does not change. Mesh hit height corruption must not change committed Y. |
| Truthful geometry | Native centered primitive contact, canonical model footprint and non-unit normalization. Tilted model and ordinary vertical PlaneGeometry get an eligibility reason, not a fake horizontal rectangle. Missing metadata/bytes do not become successful fallback placement. |
| Owned transforms | Move/yaw preserve non-owned fields exactly; explicit re-seat/resize owns Y; different support elevations require choice. No Layout, Camera or resource mutation. Scale is positive/uniform and applied once. Pivot is placement identity, never PCA or a changing render bound. |
| Preview/commit/lifetime | Pose tolerance 1e-6 meters/radians (scale is the exact prepared scalar). Reading flip, lost capture, replacement, blur/unmount and delayed callbacks cancel exactly once; invalid candidate cannot commit the last valid pose on its behalf. No ghost/helper in JSON. |
| Selection and actions | Same selected source ID across views; ineligible selection stays selected; hit halo measured in CSS pixels; deterministic tie order; no silent subset transform. Cluster duplicate/set operation refuses; member deletion cleans references atomically. |
| History and concurrency | Captured IDs replay; stale local writer refuses; accepted project installed once; invalid/no-op produces zero entries; exact Undo/Redo, redo truncation, mixed-domain chronological order through one stack. Field and pointer paths reach the same writer. |
| Source persistence | Strict source-adapter validation and canonical serialize→parse→reload preserve entities, scale/material references and unrelated domains; conditional Save validates under atomic expected-base comparison and create-only collision handling. Invalid file/resource resolution leaves the current project intact. No new historical decoder; frozen external project stays outside scope. |
| Wiring and isolation | Mutation controls reintroduce mesh-Y authority, a direct Scene write, a persisted Plan proxy or skipped cancellation and make the relevant successor fail. Full arch lane proves project-model, Layout shell, Camera and visitor boundaries; helpers/imports do not enter visitor chunks. |
| Creator experience | Place → select → arrange → resize → duplicate → undo → reload works through real routes in both readings; reasoned support choice/refusal, one precision writer, selected identity visible, no unsolicited framing; keyboard/narrow/reduced-motion evidence. |

Use the [test contract](../../../../apps/editor/tests/README.md#what-a-change-requires): behavioral
tests for planners/results, narrow call-site proof for wiring, source checks only for genuine
ownership/import boundaries. Restore dedicated Scene helper coverage where this phase depends
on it. Keep relevant dense cases in heavy; no new timing benchmark or copied broad test matrix.
Each implementation PR merge keeps the complete repository gate including heavy and affected
package/app checks, regardless of the narrower iteration tier. API changes, if later admitted,
also require real-Postgres checks with zero skips; they are not planned here.

**Proposed FINAL PHASE GATE:** T2.P01.S04, exhaustive integrated acceptance of this bounded loop.
No acceptance artifact or phase-close record is created during planning. Acceptance would make
the phase closable; phase/track closure remains a separate owner event.

## Deliberately deferred scope and continuation

| Deferred capability | Reason and concrete continuation gate |
| --- | --- |
| Single-model ingest | Next bounded T2 phase: one flat GLB plus maps, retained source/provenance, explicit scale/pivot/footprint capabilities, stage/approve then place/reload/preview/publish. Needs accepted F.1/F.2 resource/lock interfaces, F.4 staged acceptance and T4 delivery integration; must precede the first audience trial. No provider search, full assembly correspondence or marketplace prerequisite. |
| Broader materials and lights | Preserve current rendering/values; later phases own selected-subset/shared edit reach, tint/reset, supported metric mapping, truthful light units and explicit undoable repair. Their UI is unnecessary for a trustworthy object-arranging boundary. |
| Wall/ceiling/object support and persistent attachments | Need host frames, stable reference qualification, move/delete/revision consequences and atomic history. Temporary floor support is no attachment schema. |
| Full 3D transforms and arbitrary projections | Free elevation, pitch/roll, object-local axis tools, planes with orientation-aware projection and edits in Section/Unroll require declared representation/inverse eligibility. Ordinary upright floor placement proves less and ships earlier. |
| Multi-selection, group/cluster editing and batch duplication | Require ordered set policy, stable pivots and atomic all-candidate validation. Carry the T2 evidence's full/partial cluster duplication and no silent subset rules into that phase. This phase refuses unsupported set operations. |
| Definitions/components/variants/performances | Need stable component/resource identity and channel baseline/invocation semantics. An opaque mesh and flat cluster do not establish those capabilities. |
| Camera/Experience and publication | T3 owns authored Views/order/capture, unit/compound acceptance and the early conditional Save extension; T4 owns prepared readers/releases. Existing Camera fields pass through unchanged. No hidden Camera node is created by object placement. |

No new architecture-cycle window is proposed. T1's draft names its own bounded exposures; T2
does not copy or enlarge that window, re-arm dormant Layout mechanisms, or claim a verdict.
Actual implementation follows the runbook's one-line listed-slice check against the then-live
cycle register. Evidence from T2 remains ordinary capability evidence unless the owner explicitly
amends the exposure list.

## Opening recommendation for owner review

Approve the **phase boundary** and reconcile the shared contracts before authorizing capability
work. The recommended opening slice is **T2.P01.S01**: a tested, renderer-independent Scene
candidate path over compiled floor support, with a small verified object set. It directly
addresses the removed placement system's central failures and can proceed before the viewport.

The decisions to settle are shared F1/frame identity, early F4 Layout/Scene admission and capability
readiness, source-independent viewport/output/gesture contracts, conditional Save and the Layout-
owned support query. Simple Scene planners do not require the full F3 execution machinery.
Begin with the current-source adapter; if T3 activates during this phase, migrate callers and
requirements together to its already accepted unit adapters. Authorize S02 only after the shared
acceptance provider is accepted, and S03 only after the viewport seam is accepted. None of those
decisions is ratified by this track-local proposal.

## Planning validation

Run the full architecture lane and whitespace/documentation checks on this revised proposal before
commit. This is planning validation only: it accepts no production capability, F interface,
capability scope, phase gate or architecture-cycle exposure. Actual results belong to the PR body.
