# Persistence and schema

**Read when:** scene/layout/project codecs, cloud Save/Load, asset durability, publication,
release delivery, fidelity.
**Last reviewed:** 2026-10-13 (#115 WP4 — strict current-format generation; the editor session,
import/export and the chronological history stack are gone; `chopin-project.json` is scoped to the
frozen external project). The ratified direction below is unchanged; a landed contract keeps
describing current behavior until its explicit cutover.

---

## Current vs destination (ratified 2026-09-27)

**Current (everything below, until its explicit cutover).** The Layout/Scene codecs, the
`ProjectDocument` envelope, cloud Save/Load and the P22 release path are the landed
implementation.

**Destination.**

- **Storage units:** one explicit codec-bounded, versioned unit per semantic
  domain (Layout, Scene, Camera, Experience, typed resources) inside a project
  envelope holding the accepted project revision and dependency lock (F.2). The
  Experience unit supports a collection; Camera is settled as its own
  codec-bounded unit, split in the same cutover as the Experience order
  cutover. Codec boundaries prescribe neither database tables nor physical
  files nor one blob per resource.
- **Identity and references:** domain-qualified semantic identity, stable
  instance-ID paths and revision context; names, indices and mutable hierarchy
  paths never establish identity; generation-qualified fragments carry source
  correspondence (F.1).
- **Compound acceptance:** one expected project revision; typed, serializable
  authoring intents; validation across affected domains and resource locks; one
  atomic accepted result and one undo result (F.4). Naive stale writers are
  rejected by the expected-revision precondition; at the Experience cutover one
  acceptance can capture a Camera View, bind it to a Presentation and optionally
  create a Stop referencing the Presentation. Event
  sourcing, CRDTs, branch merge and selective actor undo remain separate
  decisions.
- **Release formats stay separate from source formats:** the release reader
  consumes prepared visitor data and never depends on the authoring validator or
  historical compilers (F.5). A native editable project export remains a
  separate artifact.
- **Audience records:** comments, approvals, saved visitor configurations and
  shared-session snapshots live outside authored source, anchored by public
  semantic address and release context, with their own retention/privacy rules
  (see [`../architecture.md`](../architecture.md) §Semantic authorities).
- **Source-trial migrations:** before the Source Baseline, accepted trial
  projects receive bounded, scripted migrations as named pre-baseline
  exceptions; merging a development schema does not create permanent
  compatibility.

**Open:** history implementation (snapshot/op-log/CRDT), and exact
codec/envelope interfaces are drafted by their first consumer then ratified as
F amendments. Camera is settled as its own codec-bounded unit, split in the
same cutover as the Experience order cutover
([`../composition-execution.md`](../composition-execution.md)).

## One document format (post-#115)

The product supports **one** document format and accepts nothing else:

- wall-first Layout, `formatVersion: 5`;
- world-local Scene, `formatVersion: 1`.

There is deliberately **no legacy recognition contract**: no `unsupported_generation`
diagnostic, no legacy detector or classifier, no compatibility facade and no migration path.
`project-compat`, `scene-world-conversion`, `standalone-scene-import`, the legacy Scene decoder,
the legacy `createEmptyProject`, and layout-core's `layout-compat`, `layout-migration` and
`layout-migration-math` were removed with their readers; `prepareCompatibleRuntime` became
`prepareRuntime`. A malformed, incomplete or historical payload **still fails**, by ordinary
current-format validation with the validator's own message — no schema rule is relaxed and no
unknown field or missing `formatVersion` is tolerated.

The current-format validation, canonicalization and deterministic serialization rules are
otherwise unchanged: what a valid document means did not move.

**Scene:** `textures` · `materials` · `entities` · `clusters?` · `navigationNodes` ·
`connections`. Canonical shape is world-local (`formatVersion: 1`): project/world coordinates, no
`roomId` (codec-enforced). The former versionless room-local compatibility shape (room-frame
coordinates plus `roomId`) is **no longer decoded** — it is not converted on import and is never
authored. Primitives: `box|plane|cylinder|sphere` only. Connection view tracks retain `forward` /
`reverse` key arrays and may add a directional `framingEnvelope`; each present direction has
exactly four finite ordered unit-interval bounds (`enterStart ≤ enterEnd ≤ exitStart ≤ exitEnd`).
Canonical output deep-clones and emits the envelope only when authored; absence stays absent. The
standalone scene codec forbids `roomId`; envelope shape/order is validated, and the project codec
owns cross-document room-reference + world-space camera-pose validation and repeats envelope
range/order checks at export. The canonical scene/project model and codecs live in
`@portfolio/project-model`. The editor's `lib/content/scene.ts` `resolveSceneDocument` is the
retained runtime seam over that model, and it no longer carries a Room-registry parameter where
one existed only for room-local resolution. `SceneTextureAsset = { id, name, uri }` (P20 S0):
static safe URIs remain public resources, `/local/...` and package rewrites are session/package
only, and `/project-assets/{assetId}` is a logical authenticated registry reference resolved by
the product app.

**Layout:** canonical `units: 'meters'`. Canonical Layout is wall-first (`formatVersion: 5`): one
floor datum, junctions → walls → reconciled rooms → openings → layout objects, project/world-local.
The former versionless shape (floors → rooms each carrying a finite `frame.origin: [x, z]` plus a
normalized radian `frame.yaw`) is **no longer decoded**. Opening `offset` = meters along a segment,
never a sample index. Door-only `connectsRoomIds: [string, string]` relations are explicit,
validated, never inferred from geometry; windows unpaired. The authored layout contract and
renderer-neutral compiler live in `@portfolio/layout-core`; the editor compatibility facades that
re-pointed at it are gone.

**Layout vertical authority (P23.6H/I):** `LayoutWall.height` is the only authored vertical extent, measured upward from the Floor elevation (`bottomY = floor.elevation`, `topY = floor.elevation + wall.height`); it is finite, strictly positive, and has no global upper bound — a Wall may be shorter or taller than its neighbours. The Floor carries a horizontal datum only (`id`, `name`, `elevation`, no vertical extent; a `height` key is rejected as `unknown_key`), so the enclosure is defined by its Walls and a Room ceiling is the maximum of its boundary Wall heights. New and split Walls take height from layout-core's birth/inheritance rule — explicit height, else the unique incident Wall height, else the named authoring default. The landed model is one floor; a multi-floor payload is **not accepted**. Captured from P23.6H/P23.6I, which made this the final Wall-defined vertical model with no durable clause anywhere in `docs/reference/`.

**Layout canonical curve geometry (P23.11):** a Wall's `centerline` is either a straight `line` between its endpoint Junctions or an explicit `cubic-chain` through them and its ordered interior bend points. Endpoints stay Junction-owned — the chain stores no endpoint point. Bend points carry stable identity; spans are positional (`spans.length === knots.length + 1`), one cubic each, and carry no identity and no lookup by ID. The persisted controls are the read-path authority: nothing re-derives or re-fits them, so subdivision and translation stay exact. Evaluating the stored cubics in order to render them is expected and permitted, not a violation. Wall orientation (start → end) is stable and identity-bearing because Opening `offset` is measured in meters from the canonical Wall start. Captured from P23.11, which selected this persisted model in code and in its slice plan while no reference contract stated it — a re-fit or re-orientation on the read path is the regression this clause exists to prevent.

**Layout Junction identity at commit (P23.1→P23.15):** resolution is global — a draft endpoint falling within the `1e-9` identity tolerance of any Junction in the baseline adopts that Junction's stored coordinate and its ID, and connectivity follows from the committed record. Retirement is scoped — noding retires only the coincident duplicate records participating in the committed relationship, because a baseline already carrying two records for one node is a pre-existing identity defect that a gesture must not silently rewrite. Snapping is separate — an unaccepted snap suggestion, a hover/acquire radius and screen-space proximity have no effect by themselves; what connects is the committed coordinate, so exact or near-exact unsnapped input can join an existing Junction, deliberately. The tolerance is a coordinate identity tolerance only, never a screen-space acquisition or geometry/intersection tolerance. Core and editor closure are distinct: the planner closes a chain implicitly when its final point coincides with its first, while the editor run closes it by resolved Junction ID. Captured from P23.1→P23.15, where commit-time identity existed only in code and slice plans.

**Editor workspace (removed).** The Layout Plan workspace, the editor layout session
(import/copy/download/reset over `layout.json`), the room-unit relocation command, the transient
independent scene/layout documents and their domain dirtiness checks were editor machinery and
were removed with the editor shell in #115 (implementation-plan §4.4). The canonical
`serializeLayoutDocument()` baseline and the layout-core planner behavior they sat on survive as
pure kernel semantics; their authoring wiring is a T1/T3 rebuild, and the product cannot currently
author Layout at all.

**Layout object transforms:** `position` = world/layout center; Euler `rotation` = radians;
`dimensions` = full local extents before rotation. Plan footprints + bounds use rotation-aware
world AABBs. Authored `box | plane | cylinder | sphere` objects are editable; imported `profile`
objects round-trip unchanged and are read-only.

**Project:** `{ id, name, layout, scene }`. The visitor-safe shared codec validates the nested
layout and scene in one shape, prefixes nested issues, and rejects scene room references absent
from the same layout. **In the frozen external project** (no longer in this repository) the
`chopin-project.json` / `chopin-project.ts` pair is that project's sole production layout/scene
source and validates once to expose the project, one room registry, the resolved scene, a
navigation graph and the runtime. **Product cloud and guest projects are independent of it:** a
product project is the `ProjectDocument` saved through `apps/api` and read by
`@portfolio/project-model` (`validateProject` / `prepareRuntime`), with no Chopin file involved.
No assets, binary payloads, UI or history live in the envelope. Portable package IDs,
manifest/filename rules and `sha256Bytes` also live in `@portfolio/project-model`; the ZIP/Blob
orchestration that used to sit in the editor import/export path was removed with the editor shell.

**Cloud persistence (P19 shipped 2026-09-03):** authenticated owned Save/Load wraps the same
canonical `ProjectDocument` — a `projects` row plus versioned JSONB in `project_versions`. Save
validates the full current-format document, locks the project row, appends a version, and bumps
`latest_version`; Load reads the latest version and revalidates; the project hub lists owned
projects with their versions. Save takes no expected-base-version precondition today — row locking
serializes writes but a stale full document can still save as a newer version; a stale-write /
revision precondition is a ratified destination obligation (F.4) before simultaneous human/agent
writers, not current behavior.

**Project asset durability (P20 shipped 2026-09-04):** registry metadata in Postgres, heavy
texture bytes in private R2 through `apps/api` only. Session/package texture URIs cannot reach
semantic JSONB Save (durability gate). Assets are not normalized into `ProjectDocument` — the
registry/storage boundary stays separate, and each asset row carries `importState`
(pending/ready/failed), `mime`, `byteSize`, `sha256` and `objectKey`.

**Publish + releases (P22 shipped 2026-09-08):** one `publications` row per project (unique project ID, unique random public ID allocated only by first Publish, nullable active version, monotonic publication revision, timestamps) plus immutable `releases` keyed by `(project_id, version)` carrying the validated delivery manifest (saved `ProjectDocument` snapshot + pinned P20 asset key/SHA-256/MIME/size). Publish/Update/Unpublish run a short SQL transaction (row lock, ownership + expected-revision + saved-version recheck, release insert/reuse, active-pointer switch, revision bump); R2 verification (bounded streaming hash/size/MIME check) happens before the transaction, never inside it, and publication **fails closed** on a pending, missing, corrupt or wrong-size asset. First publish alone allocates the stable public ID; status GET never creates one. ABA (`N → unpublished → N`) still bumps revision, so stale writers get 409. Anonymous reads resolve the active release once per bootstrap (document + manifest share one version); unpublish disables all document/byte delivery for that public ID. `Cache-Control: no-store` on public metadata/bytes. Owner API: `GET/PUT/DELETE /projects/:id/publication`; anonymous: `GET /publications/:id` plus version-qualified asset content. This is the current path to cut over to the versioned prepared-payload reader (T4); publication pointers belong to published Experiences in the destination, not exclusively to the project. The product's publication **UI** is removed — the API is the current surface.

**Asset policy:** static safe URIs remain public resources; scene model entities reference shipped
catalogue `assetId`s. Project-local GLB import is absent: the editor's ingest/resource staging path
was removed with the editor shell, and rebuilding it is a T2 obligation, not a current capability.

**History (removed; F.4 is the destination).** The editor's one chronological undo stack — entries
tagged `layout` | `scene`, a 100-entry cap, domain-scoped undo/redo, no-op skipping and
import/reset clearing the stack — was editor-session state and was removed with the editor shell.
It was never serialized and was never a collaboration operation log. The accepted destination is
the F.4 model above: one expected project revision, validated typed intents across affected
domains and resource locks, and one atomic accepted result with one undo result
([`../composition-execution.md`](../composition-execution.md)). The history implementation stays
an open decision there.

**Session-only (editor, removed):** the session `scaleVector` map, lighting overrides, UI chrome
and pending ghosts were editor session state and went with the editor shell. The pure
`scale-vector` helper is retained under `apps/editor/src/lib/authoring/scene/`, and a visitor may
still render a legacy session scale vector lossily until a later format version.

**Fidelity:** independent (per-axis) scale may be lossy for visitors; the editor-only mesh
desync (until a shared factory/bake) went with the editor mesh path; there is no automatic
repository writeback.
