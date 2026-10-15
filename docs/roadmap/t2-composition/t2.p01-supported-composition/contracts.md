# T2.P01 — Contract drafts and reconciliation requests

**Status:** owner-review drafts, 2026-10-14; companion to the [phase proposal](./README.md).
These names describe intended interfaces, not shipped exports or accepted gates. Shared exact
formats must be reconciled with T1/T3 and ratified as amendments to
[F](../../../reference/composition-execution.md), then implemented in shared code. This document
neither changes F nor establishes a parallel T2 reference/envelope/history protocol.

## Common identity and frame interfaces

Prefer the [T1 source-independent interface draft](https://github.com/Biskiq/spatial-sketch-editor/blob/codex/t1-stage-proposal/docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/interfaces.md) and
[coordinated readiness proposal](https://github.com/Biskiq/spatial-sketch-editor/blob/codex/t1-stage-proposal/docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/cross-track-reconciliation.md).
Use shared SemanticReference/SnapshotIdentity/DerivedSourceRef and explicit frame qualification.
Scene operation payloads use canonical domain transform types, not a new runtime channel family. T2 adds requirements,
not another encoding:

| Shared shape | T2 requirement |
| --- | --- |
| Semantic source reference | Domain Scene, stable entity subject ID, explicit revision context and instance path; root object selection is distinct from a rendered mesh/component. Current-source resolution uses explicit content identity; project-lock resolution without an admitted F.2 lock reader returns incompatible. |
| Layout support reference | Stable Layout source plus floor/level qualification, with generation-qualified derived floor fragments retaining source correspondence. A Room ID can identify the compiled floor source, never the owner/frame of the Scene object. Preserve all equivalent source witnesses. |
| Resolution result | Resolved with concrete revision, or typed missing/removed/incompatible/unauthorized/repair-required. Preserve original identity and diagnostics; no fallback by name, mesh order, nearest Room or position. |
| Frame | Tagged project-world or an explicitly supplied owner-qualified local frame with stable ID/revision and validated conversion. A working plane, asset-internal frame and Room frame are distinct; absent Room frame is not identity. |
| Scene operation transform payload | Canonical position in meters, Euler radians using the existing renderer's convention, and positive scalar scale. First operations own X/Z, yaw, or explicit floor-contact+scale changes. Allowed operators and writable masks are domain-declared, not generic channel property mutation. |

Instance/root references are shared source identity; generation-qualified footprint/hit IDs are
runtime-only correspondence. Selection requalification after a source edit uses accepted
correspondence, never pretending an exact old revision is the new source revision.

For an explicit yaw-only local frame with origin `(ox, oy, oz)` and angle `a`:

```text
world.x = ox + local.x*cos(a) + local.z*sin(a)
world.y = oy + local.y
world.z = oz - local.x*sin(a) + local.z*cos(a)
```

Inverse removes the origin then applies inverse yaw. Direction conversion omits origin; yaw
conversion composes the supplied frame once. Contact elevation comes from Layout support, not
the frame's incidental origin. Current source records store the resulting world-local pose;
no `roomId`, authored Room frame or legacy migration branch is added.

## Normalized object definition input

Proposed pure Scene-planner input, supplied by a host policy adapter rather than importing the
app catalogue or Three into project-model:

| Field | Meaning and validity |
| --- | --- |
| `definitionKey`, `metadataContentId` | Existing native-kind/catalogue identity plus immutable identity of the captured operation metadata. This is not a new persisted resource reference or invented dependency lock. |
| `admission` | Allowed operation set and reasoned exclusions; first phase only upright floor-supported box/cylinder/sphere or verified floor model. |
| `footprintMeters` | Valid simple canonical local X/Z polygon around the placement pivot. Already includes source normalization; multiply only by authored instance scale. Missing/invalid metadata refuses Plan admission. |
| `contactMinY` | Finite minimum/support contact height in normalized placement-local meters, with verification provenance. Analytical `-height/2` for centered box/cylinder, `-radius` for sphere; verified contact for admitted models, often zero. No asynchronous bounding-box guess. |
| `creationDefaults` | Existing entity kind/fallback/material/dimensions/name policy, root rotation and relative scalar scale 1. Defaults and generated entity ID are captured explicitly before preparation. |
| `renderNormalization` | Source scale/orientation correction identity for parity verification. Retained renderer applies it once inside the root; it is not copied into authored instance scale/rotation. |

Example: piano footprint meters are already the declared 1.48 × 1.59 extent. Its asset
`defaultScale: 0.032` is renderer normalization. Instance scale 2 doubles both canonical
footprint and normalized model; it does not yield `2 * 0.032` as the authored root scale.

Models whose corrected source geometry cannot be proven to match the footprint/contact stay
excluded with a reason. The fixed application catalogue remains the current supply contract.
Arming may initiate a model load; commit admission requires verified model readiness captured
by the host before preparation. A loading/failed model may show a labelled placeholder, but
cannot silently become an accepted fallback placement. Loading state is session-only.
Capturing operation metadata makes local replay deterministic; it does not solve post-deployment
catalogue/source drift or durable resource retention. New creator resources require F.1/F.2
locks and staged F.4 acceptance in the follow-on phase.

## Floor support query

Proposed public runtime-safe Layout-owned query, implemented against the existing canonical
compiled Layout. T2 drafts its first consumer; T1/Layout review must settle its export/ownership.
No new architectural compiler, Room lookup service or renderer authority is admitted.

```text
queryFloorSupports(compiledSnapshot, worldXZ, explicitScope)
  -> candidates | none | invalid-input | stale-generation | unsupported

chooseFloorSupport(candidates, explicitChoice?)
  -> resolved | choice-required | invalid-choice
```

Inputs contain source content identity, compile generation, finite world X/Z and explicit
level/floor scope if the creator chose one. A 3D hit supplies source/generation evidence; its
mesh face Y is discarded as authority. A chosen active level is an explicit filter, not an
inferred nearest-level heuristic. Plan's cut plane and camera working plane do not establish
physical floor support.

Each candidate carries Layout source witness(es), floor qualification, region membership,
canonical elevation, upward normal, generation and stable diagnostic/display label. Enumerate
all compiled `room-floor` polygons containing X/Z, including declared boundary tolerance; get
elevation from the corresponding compiled Room/floor facts. Reject contradictory/missing facts.
Do not use `findPolygonContaining`'s one reverse-order winner as resolution.

Proposed numerical policy for review: boundary and coplanar elevation tolerance **1e-6 m**;
up-normal equivalence **1e-9** per component. These are operation/query tolerances, not global
Layout compiler epsilon changes. Canonical values are preserved; tolerance never rounds a Y.
Equivalent coincident floor results with identical legal support meaning deduplicate into one
choice retaining all source witnesses. Distinct elevations or incompatible contexts remain
separate; deterministic source-ID ordering only orders the choices. It never chooses an elevation.

The first phase proves contact at the placement anchor. It does not claim whole-footprint
containment, collision avoidance, clearance or physical stability. Footprint graphics show
occupied shape, not a safety envelope. A Layout object footprint, arbitrary floor datum,
wall face or model mesh is not admitted support. Outside every valid compiled floor → no support.

With upright root pose and positive uniform scale `s`:

```text
entity.position.y = support.elevation - s * normalized.contactMinY
```

The support choice, normalized contact data and resulting pose belong to the prepared candidate.
Support is checked at acceptance against the same source revision/generation. A revision change
rejects; there is no late re-query that silently alters the pose. Choice-required has no accepted
ghost or source write until the user chooses. All support evidence stays transient; the persisted
entity has a pose, not a live floor attachment. Subsequent Layout movement leaves it unchanged.

## Scene operations and prepared candidates

Proposed domain-level functions; names are illustrative exports, not a required universal
planner base class. F.4's ratified common intent wraps these serializable domain payloads.

| Operation | Owned values and rules |
| --- | --- |
| `place-object` | Captured new entity ID/defaults/normalized definition, world X/Z/yaw and explicit support choice. Prepare one new entity; root scale defaults to 1 and contact determines Y. |
| `move-horizontal` | Existing single entity, destination X/Z and explicit frame/snap resolution. Preserve Y, pitch/roll, scale, dimensions and bindings. Require support at its existing contact elevation; offer explicit re-seat for a different elevation. |
| `set-yaw` | Existing single entity and target yaw in the declared frame. Preserve Y and all non-owned components; admit only truthful upright floor operation. |
| `place-on-floor` | Existing admitted entity, X/Z and explicit support choice. Explicitly owns contact-resolved Y; preserves rotation/scale/materials unless its declared payload owns yaw. This is a deliberate re-seat, not an attachment. |
| `resize-on-floor` | Finite positive scalar and a resolved current support/contact. Own scale and compensating Y; preserve X/Z/yaw and all unrelated data. Nonuniform vector is unsupported, never averaged. |
| `duplicate-one` | Captured new ID; add exactly 0.5 m to world X/Z. Preserve original Y/rotation/scale/material sharing; validate shifted support at that contact elevation. Cluster member/set duplicate is unsupported here; do not silently change grouping. |
| `delete-one` | Remove the exact source entity, clean membership references and empty clusters, and supply canonical selection correspondence. One candidate/acceptance. Future admitted cross-domain references must be checked by F.4; do not invent them. |

Every intent contains the common version/kind/expected revision/operation ID and qualified
targets, plus captured external inputs and allocated IDs. No pointer event, closure, Three
object, live asset lookup, random allocation or implicit clock enters deterministic evaluation.

A prepared domain result carries baseline identity, operation, candidate Scene, changed subjects,
unchanged-domain evidence, validated support/definition provenance and diagnostics; or typed
refusal. Required domain refusal codes include no-support, support-choice-required,
unsupported-surface, missing-footprint, missing-contact-metadata, unsupported-transform,
unsupported-set, invalid-value, missing-target, stale-revision and stale-generation. Common
F result spelling is reconciled centrally; creator messages are local and actionable.

T2's eligibility adapter returns separate `canRepresentPlan`, `canSelect`, and supported operation
sets with reasons. A Scene record may remain selected/renderable in 3D while unsupported in
Plan. Do not force all three booleans to agree. Current upright floor metadata can supply a
footprint; pitched/rolled models and ordinary vertical PlaneGeometry cannot use the retained
yaw-only helper as if it were a correct projection. Lights have no object-footprint manipulation.

## Shared local acceptance and F.4 amendment

Use T1's source-independent AcceptedRevision/AuthoringIntent/AcceptanceResult/AcceptedSnapshot
contract. Proposed sole F4@1 provider is T1 S03 with **local-single-domain-v1**: registered Layout
or Scene intents, complete current-source validation, one coherent install/undo result and unchanged
Camera/resource enforcement. The early timing/admission amendment requires ratification. T2 S02
supplies actual Scene planners/conformance; it never provides a competing protocol or history.

AcceptedRevision is opaque project/revision identity; source-content digest compares authored
contents, and SessionEpoch guards callbacks. Undo/Redo gets fresh revisions even when contents
match an earlier snapshot. Captured metadata/support/IDs and canonical results make replay exact;
redo never queries a changing catalogue or picks support again. A shared chronological 100-entry
stack restores whole operations; invalid/no-op/cancel/stale writes nothing and new edits truncate redo.

Initial admission preserves co-located Camera fields byte-exactly and refuses new units, compound
changes and resource acquisition. Full project validation is mandatory, including unchanged-domain
checks. Scene serialization grants no right to edit Camera order. Source replacement validates
before installation, cancels callbacks/leases once and starts a new history baseline.

T3 S02 provides **conditional-save-current-v1** on the same F4 contract: capture immutable local
accepted source/revision/digest and create-only or expected-saved-base precondition; atomically
compare/validate/append on the server. Conflict preserves local work/history and remote contents.
Retry receipts prevent duplicate versions. Acknowledgment marks only the captured contents saved;
newer local work stays dirty. No server-per-command prerequisite, unrestricted stale PUT or cloud
Undo protocol. S04 requires this separate accepted capability; base local acceptance is insufficient.

T3 S03 accepts **unit-acceptance-v1** and **conditional-save-units-v1** against candidate F2 source.
T3 S04 migrates existing T2 callers/unfinished plan requirements to those accepted capabilities and
retires current adapters with their readers/writers. The unit adapter supplies normalized definition
inputs from accepted immutable resource pins rather than a live catalogue. Scene-only placement
admits native procedural definitions and already pinned palette entries; a missing pin reports
unavailable, never silently changes the lock. The F2 starter/migration may install an explicitly
captured bounded palette as part of its baseline. Adding other resources belongs to T2's staged
resource follow-on, not a Scene-only transform. This is one source transition, not two editable
formats. Incompatible intent/revision/result semantics needs a new major; compatible registered
adapter admission keeps F4@1 with explicit new evidence. The [readiness amendment](https://github.com/Biskiq/spatial-sketch-editor/blob/codex/t1-stage-proposal/docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/cross-track-reconciliation.md#small-readiness-amendment-proposed-for-ratification)
requires both Consumes and exact Requires capabilities accepted at trusted base before use.

## Minimum T1 viewport consumer contract

Consume `T1.viewport-projection@1` through its public editor facade once accepted. T2 needs:

| Surface | Required behavior for this phase |
| --- | --- |
| Read snapshot | Source-independent validated domain read facade, AcceptedRevision, separate content identity/session epoch and compiled Layout generation; no required current ProjectDocument shape. Accepted data remains shallow/raw Svelte state; no deep reactive compiler/Three objects. |
| Projection/ray | World-to-CSS and CSS-to-world ray use the exact evaluated matrices rendered by Camera in Plan, 3D and transitions; CSS/DPR/viewport offset explicit. Stale/hidden/zero-size/parallel/behind results fail explicitly. |
| Working-plane input | Explicit finite world point/frame output or reasoned failure. It supplies pointer evidence, not authoritative support, snapping, Scene Y or semantic eligibility. |
| Adapter graphics/hits | Mount accepted entities, proposed ghost, truthful derived Plan footprint, selection echo and source-qualified hits. One semantic hit arbitration path; passive helpers cannot intercept the active operation. |
| Canonical selection/task slots | Read the one ordered selection/primary value; request select or invoke a task through the host. T2 owns Scene eligibility/correspondence, not a Scene-only store. Card shows accepted identity; Instrument owns one precision writer. |
| Gesture lease/transition | One shared-host writer captures accepted revision/output epoch. Declare cancel-on-reading-change for Scene pointer operations; cancel once before the switch while retaining armed task/tool and selection. Lens/project/task exit, capture loss and unmount cancel once; invalidate delayed completion. No private transition FSM. |
| Viewing intent | Acquire/request/replace/return/cancel use the common epoch-qualified Camera output ticket. Explicit Bring into view/Fit requests enter Camera; selection, sheet/Index changes and T2 adapter mounting never move it implicitly. No copied orbit controller, FOV tween or second affine Plan transform. |
| Lifetime | Dispose hit providers, leases, preview graphics/listeners and scoped asset clones once; stale callbacks cannot attach into a replacement project. Retained renderer caches keep their declared ownership/refcount rules. |

Stage owns host orchestration; T2 supplies Scene logic. One shared gesture owner coordinates
domain adapters, rather than a gizmo host and separate Plan placement state machines. A transient
preview can be rendered separately without becoming a second accepted document authority.

Within Scene, retain containment-before-halo and six CSS pixels for the Plan edge halo. Current
array order may define paint order, but tie-breaking must be documented and replay-stable; use
stable entity ID after any declared equal-priority/distance ties. Depth/occlusion constrains
eligible 3D hits; it does not invent support. Grip priority exists only for the active supported
operation. No global Camera/Scene/Layout species priority is ratified by T2.

The T1 provider should prove a test-only Scene consumer can project a real entity/footprint,
obtain working-plane evidence, mount/unmount an instrument and cancel a lease without private
Stage imports. T2 S03 proves real production wiring. Mock-only consumer success cannot establish
rendered ray/mesh/overlay agreement. Later T1 Section, peel, lift, vertical expansion, new Wall
authoring and track completion are not needed for this consumer contract.

## F.2, resources and release boundary

This phase keeps the strict landed project encoding; no envelope header, resource lock,
definition/instance schema or Camera extraction is introduced. That is a deliberate bounded
current-source exception requested through F.4, not a claim that today's document already
implements F.2. A new persisted resource/reference requirement pauses that dependent slice for
an explicit F.1/F.2 amendment/provider decision.

The next import consumer reuses T3 S01's accepted F2 unit/envelope/dependency-lock and shared
resource identity, T3 S03's staged/unit F4 acceptance and T4's accepted resource delivery. It adds
only the missing typed model-resource admission/conformance; it does not mint a second F2 provider. Do not add
ad hoc model URLs, base64 bytes, upload status, signed URLs or normalization provenance fields
to Scene v1. Acquisition/approval is outside authoring history; installing an approved resource
and its first placement, when offered together, needs one staged F.4 accepted result.

F.5/T4 prepared release interfaces remain outside this phase. Current JSON round trip proves
source integrity only; it does not prove byte retention, catalogue-drift resistance, a portable
package or historical release compatibility. Original TD-1 Camera-node and publish obligations
remain assigned to their T3/T4 consumers rather than marked satisfied by Scene placement.
