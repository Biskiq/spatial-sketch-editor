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

A creator opens a valid current project with an existing compiled floor, chooses a supported
object through Place/Find, sees its proposed resting pose, commits it, selects it in either
reading, arranges it by pointer or exact values, revises scale, duplicates/deletes it and
recovers with Undo/Redo. Source download and atomic source reload preserve the authored result.
Refusal explains missing support, ambiguous elevation, unavailable model metadata or unsupported
manipulation without corrupting selection or accepted work.

This is a composition foundation, **not the first audience-delivery loop**. An entirely empty
Layout has no floor polygon: Place honestly refuses and offers access to available Layout work
or opening an existing project. A Floor datum alone and T1's native plinth are not floor support.
The phase does not create an enclosing Room, silently insert architecture, restore cloud Save,
author Camera/Experience content or publish. Do not make the old museum a required boot fixture.

Single-model creator import remains required before the first creator/audience trial. Its
bounded follow-on is identified below; it is not postponed until a complete asset pipeline.

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
| `apps/editor/src/lib/platform/project-persistence.ts`, `apps/api/src/project-persistence.ts` | Current readers/writers survive, but cloud saves lack an expected-revision precondition. Local history and safe cloud Save are separate deliverables. This phase offers source JSON recovery, not a false cloud-safety claim. |

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

| Candidate | Consumes, after acceptance at trusted base | Capability and exit evidence |
| --- | --- | --- |
| T2.P01.S01 | `F1.reference@1`, `F3.channels@1` | Pure deterministic placement/transform candidates; canonical support enumeration; verified native/catalogue normalization; explicit eligibility/refusals. No viewport or accepted history needed. |
| T2.P01.S02 | `F1.reference@1`, `F3.channels@1`, `F4.intent-acceptance@1` with the early single-domain admission amendment | Register Scene operations into the shared current-source accept/undo path. Prove Scene-only atomic results, full project validation, stale rejection, no-op/cancel behavior and exact replay. No private store or UI needed. |
| T2.P01.S03 | `F1.reference@1`, `F3.channels@1`, `F4.intent-acceptance@1`, `T1.viewport-projection@1` | Mount one Scene adapter: Place, canonical selection, Move, Yaw and Place on floor in ordinary Plan/3D with exact input and shared Undo. This is the earliest coherent creator editing capability. |
| T2.P01.S04 | `F1.reference@1`, `F3.channels@1`, `F4.intent-acceptance@1`, `T1.viewport-projection@1` | Complete uniform Resize on floor, single-entity duplicate/delete, source recovery and the integrated acceptance matrix; review the real 3D interaction design. Proposed final phase gate. |

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

An accepted Plan↔3D change cancels the unfinished interaction before the reading changes,
restores the accepted baseline, preserves committed selection, releases the lease once and
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
existing static references, not a portable asset package. Cloud reads may use retained validated
paths; cloud Save remains unavailable until its expected-revision provider is accepted.

**Exit:** run the full evidence matrix below, including all required repository verification;
review all four slice outcomes together. Record any detailed 3D UX decisions with their scope
and evidence. This is proposed acceptance work, not an acceptance record.

## Minimum dependencies and reconciliation decisions

The [T1 proposal (PR #118)](https://github.com/Biskiq/spatial-sketch-editor/pull/118) and its
interface draft were inspected on 2026-10-14. They are unmerged proposals, not trusted-base
dependencies; reconcile the candidate interfaces before authorizing an implementation plan.

| Decision/provider | Minimum needed and sequencing |
| --- | --- |
| F.1 | Reuse one shared semantic-reference/resolution/snapshot identity shape. Current-source entity references are session-qualified against explicit source identity; no fake project lock. T1 proposes first provider S01. Required before T2 S01. |
| F.3 | Reuse common frame/address/value descriptors. Add bounded Scene root-transform family/admission; no generic setters or execution kernel. T1 proposes common provider S01. Required before T2 S01. |
| F.4 timing/scope | Ratify an early shared local **single-domain Layout/Scene** acceptance/history foundation, with extensible registered planners. T1's draft currently admits Layout only: its scope must be reconciled before T2 S02 can depend on it. T1 S03 is the proposed sole common provider; T2 S02 supplies Scene conformance, not a competing F4 provider. If refused, S02 waits for T3's provider. |
| `T1.viewport-projection@1` | T1 proposes S02. Need public read snapshot, same evaluated matrices/rays for both readings, adapter graphics/hit/selection/task slots, epoch-aware gesture cancellation and explicit viewing requests. Required only for S03 onward. Floor resolution is T2/Layout work, not an implicit promise in this gate. |
| F.2 | No new persisted unit/envelope/lock in this phase. The explicit F.4 current-source exception is essential. Scene v1 remains current and Camera co-location stays untouched until T3's simultaneous Camera/Experience cutover. A new resource/schema need triggers F.2 amendment and re-gating, not a hidden phase extension. |
| F.5 / T4 | Not consumed. Current source round trip is not prepared release acceptance. T4 later closes resource delivery and visitor-runtime compatibility. |

Thus T2 S01 can follow the common F.1/F.3 provider without T1 viewport completion; S02 needs
shared local acceptance; S03 needs the accepted viewport seam. No T1 track-completion, new Wall
drawing, curved/vertical representation depth, full precision suite or Experience editor is a gate.
Acceptance requires actual exports, conformance and recorded provider/commit already accepted at
`git merge-base HEAD main`; changing a gate in the consumer's own diff cannot satisfy it.

## Acceptance evidence to collect

These are required future proofs. None is asserted as run by planning.

| Contract/failure | Evidence and practical pass condition |
| --- | --- |
| Canonical boot → place → commit (Scene successor to TD-1) | Production entry from a valid wall-first project with a reconciled floor creates exactly one Scene entity, one history result, finite world pose and no `roomId`. Empty/no-floor boot refuses with useful copy and no edit. T3 owns the original Camera-node equivalent; this phase cannot close that obligation. |
| Support parity | Plan and 3D input for the same X/Z/support yields the same candidate; nonzero floor elevation, local-frame conversion, shared boundary, coincident candidates, overlapping elevations and no support. Reorder query arrays: result does not change. Mesh hit height corruption must not change committed Y. |
| Truthful geometry | Native centered primitive contact, canonical model footprint and non-unit normalization. Tilted model and ordinary vertical PlaneGeometry get an eligibility reason, not a fake horizontal rectangle. Missing metadata/bytes do not become successful fallback placement. |
| Owned transforms | Move/yaw preserve non-owned fields exactly; explicit re-seat/resize owns Y; different support elevations require choice. No Layout, Camera or resource mutation. Scale is positive/uniform and applied once. Pivot is placement identity, never PCA or a changing render bound. |
| Preview/commit/lifetime | Pose tolerance 1e-6 meters/radians (scale is the exact prepared scalar). Reading flip, lost capture, replacement, blur/unmount and delayed callbacks cancel exactly once; invalid candidate cannot commit the last valid pose on its behalf. No ghost/helper in JSON. |
| Selection and actions | Same selected source ID across views; ineligible selection stays selected; hit halo measured in CSS pixels; deterministic tie order; no silent subset transform. Cluster duplicate/set operation refuses; member deletion cleans references atomically. |
| History and concurrency | Captured IDs replay; stale local writer refuses; accepted project installed once; invalid/no-op produces zero entries; exact Undo/Redo, redo truncation, mixed-domain chronological order through one stack. Field and pointer paths reach the same writer. |
| Source persistence | Strict `validateProject` and canonical serialize→parse→reload preserve entities, scale/material references and unrelated domains. Invalid file/resource resolution leaves the current project intact. No new historical decoder; frozen external project stays outside scope. |
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
| Camera/Experience and publication | T3 owns authored Views/order/capture, compound acceptance and safe cloud Save; T4 owns prepared readers/releases. Existing Camera fields pass through unchanged. No hidden Camera node is created by object placement. |

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

The decisions to settle are the common F.1/F.3 drafts, the early F.4 Layout/Scene scope/provider
amendment, the minimal viewport consumer surface, and the read-only Layout support-query owner.
Keep the existing current-source format through this phase. Authorize S02 only after the shared
acceptance provider is accepted, and S03 only after the viewport seam is accepted. None of those
decisions is ratified by this track-local proposal.

## Planning validation

The full architecture lane passed **131 tests** on this planning tree. The repository Markdown
parser also checked all three changed/new documents directly, including untracked proposal
files: links, headings, section numbering and whitespace had no findings. These checks verify
the proposal's documentation and unchanged architecture boundaries; they accept no capability,
F interface, phase gate or architecture-cycle exposure.
