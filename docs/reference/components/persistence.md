# Persistence and schema

**Read when:** scene/layout/project codecs, cloud Save/Load, asset durability, publication,
release delivery, fidelity.
**Last reviewed:** 2026-10-20 (T3.P01.S04 implementation; PR #158 review pending).
The code contract below describes the F2 cutover tree. Deployment and migration 005 remain
owner-controlled after merge; it does not claim production activation.

---

## Current vs destination (ratified 2026-09-27)

**Current implementation.** The one live source is F2 `ProjectEnvelope`: Layout, Scene, Camera,
Experience and resources, each codec-versioned, with accepted-revision provenance and a dependency
lock. Boot, starter, empty, Open, Download and Save use that envelope exclusively.
`prepareUnitRuntime` compiles Layout, resolves Scene and derives connectivity from the Camera unit.

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

**Further changes:** collaboration/history alternatives and future codec meanings require
versioned F amendments. Camera and Experience already have distinct codec-bounded units
([`../composition-execution.md`](../composition-execution.md)).

## One source format (F2 clean epoch)

`ProjectEnvelope` format 1 contains `id`, `name`, `acceptedRevision`, `dependencyLock` and
`units`. Unit payload versions are Layout 5, Scene 3, Camera 1, Experience 1 and resources 2.
Only declared F2 versions are admitted; old files, mixed roots, old drafts and unknown versions
refuse. There is no converter, format sniffing, fallback or dual write.

Scene 2 carries `textures`, `materials`, `entities` and optional `clusters`; it carries no Camera
or editorial fields. Camera carries Views and connections. Connection endpoints are generated,
only interior anchors are authored, and directional framing envelopes retain their kernel rules.
`validateProjectEnvelope` separates structural issues, repairable authored diagnostics and
executable resource closure. The Stage discloses diagnostics and closure for inspection without
inventing resources; closure refuses F4 acceptance, Save and release. An unresolved View remains
repairable authored state and disables the affected visitor behavior.

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

**Editor workspace.** One Stage acceptance host installs unit candidates through F4. T1 Layout
and T2 Scene planners retain separate ownership and share one chronological, bounded history.
Open, starter, empty, Reload and pending-Save Resume replace the session through the host's
unsaved-work and session-lifetime guards. No Undo crosses a replacement baseline.

**Layout object transforms:** `position` = world/layout center; Euler `rotation` = radians;
`dimensions` = full local extents before rotation. Plan footprints + bounds use rotation-aware
world AABBs. Authored `box | plane | cylinder | sphere` objects are editable; imported `profile`
objects round-trip unchanged and are read-only.

**Project and Save.** `captureUnitSave` stamps the accepted revision into canonical persistence
bytes; the mounted source keeps its embedded baseline provenance. Dirty/history comparisons use
the captured mounted bytes, while the server validates the stamped capture. Save compares a
`create-only` or `expected-saved-base` precondition, appends a version under a row lock and records
an idempotent operation receipt. Reusing a revision for changed contents or an operation for changed
bytes refuses. One concurrent saved-base contender wins; the loser preserves local work and gets a
conflict. A network-ambiguous retry replays the exact capture. Reload is explicit replacement.

**Sign-in recovery (TD-9).** Before redirect the Save-owned pending-capture seam stores the exact
F2 request in session storage. The auth return page routes to `resume-save`; the spatial route
offers it even after a cloud 404 for a create-only request. Only explicit Resume installs and
replays it with the original operation ID and precondition. Cancellation preserves source,
selection, history and saved base; stale admission after replacement cannot install.

**Clean epoch.** Migration 005 removes authored rows in one transaction and installs the
`unit-envelope-v1` schema fence, retaining users and migration history. The runner holds a session
advisory lock; rerun is a no-op and pre-epoch writers refuse. Namespace-owned R2 purge is a separate
owner action after the epoch; unknown or foreign keys refuse the purge. No production data reset
or deployment is implied by this source contract. Activation follows AM-9's owner-run runbook.

**Project asset durability (P20 shipped 2026-09-04):** registry metadata in Postgres, heavy
texture bytes in private R2 through `apps/api` only. Session/package texture URIs cannot reach
semantic JSONB Save (durability gate). Assets are not normalized into `ProjectDocument` — the
registry/storage boundary stays separate, and each asset row carries `importState`
(pending/ready/failed), `mime`, `byteSize`, `sha256` and `objectKey`.

**Publication gap (AM-9).** Publish/Update return `501 prepared-reader-required`. Public metadata
and asset reads return honest 404 with `Cache-Control: no-store`; no old-document reader is a live
delivery fallback. Owned status and OCC-checked Unpublish remain. T4 owns the prepared reader.

**Asset policy:** static safe URIs remain public resources; scene model entities reference shipped
catalogue `assetId`s or a model resource pinned in the same envelope. T2.P02.S01 adds owner-only
staging and immutable approved model revisions in the project registry; Save verifies each model's
derivative/source pins, recipe, report digest and placement against an approved revision owned by
that project, refusing the save without changing the stored version when they disagree. Resources
format 2 carries the model resource and lock; Scene format 3 may reference it. The visitor/public
reader remains catalogue-only, and the import/review/approve UI and full placement flow remain later
T2 work.

**History.** One F4 chronological stack holds at most 100 accepted operations, skips no-ops,
truncates redo after a new edit and mints fresh revisions on Undo/Redo. Session selection, generated
geometry, renderer handles and history are never serialized. This is not a collaboration log.

**Session-only (editor, removed):** the session `scaleVector` map, lighting overrides, UI chrome
and pending ghosts were editor session state and went with the editor shell. The pure
`scale-vector` helper is retained under `apps/editor/src/lib/authoring/scene/`, and a visitor may
still render a legacy session scale vector lossily until a later format version.

**Fidelity:** independent (per-axis) scale may be lossy for visitors; the editor-only mesh
desync (until a shared factory/bake) went with the editor mesh path; there is no automatic
repository writeback.
