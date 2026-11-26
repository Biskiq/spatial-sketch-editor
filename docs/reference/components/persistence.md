# Persistence and schema

> **Covers:** project envelope, unit versions, Save/Load, assets, publication delivery.
> **Invariants:** strict admitted versions, no converter/fallback, conditional append-only Save.
> **Governs:** persisted source and delivery contracts; current versions are listed below.

**Read when:** scene/layout/project codecs, cloud Save/Load, asset durability, publication,
release delivery, fidelity.
**Last reviewed:** 2026-11-20 (project image pin verification and exact-byte repair). The code contract below describes
the F2 cutover tree. Deployment and schema baseline remains owner-controlled after merge; it does not
claim production activation.

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
- **One version per format:** until the owner declares beta, each persisted
  format admits exactly one version. A change bumps the number, and readers
  refuse every other version with `unsupported_format_version`. There is no
  migration, converter, dual reader, optional-on-read field for older documents,
  compatibility fixture or historical differential. Fixtures are regenerated in
  the same commit that bumps the number.

**Further changes:** collaboration/history alternatives and future codec meanings require
versioned F amendments. Camera and Experience already have distinct codec-bounded units
([`../composition-execution.md`](../composition-execution.md)).

## Editable source and revision (destination)

Future expressive capabilities must retain the domain-owned source needed for their admitted edits
and declared relationships. Deliberately authored geometric controls may be source; generated
tessellation, renderer handles, session caches and chronological history remain outside authored
truth. This distinction does not admit a new source kind into any current codec.

No two coequal writable representations may silently compete for the same form. A conversion must
declare supported edits/relationships retained or lost, approximation and recovery; no implicit bake
may discard accepted meaning. The source encoding, conversion routes, identity-lifetime records and
recovery mechanism remain TBD for a real consumer. Neither a universal operation log nor a persisted
general-purpose form language is selected.

Accepted controls, semantic identities and relationship decisions must reproduce the accepted result
to the exactness required by the existing contracts. Approximation cannot weaken exact F obligations.
Undo/new edit, Save and cold reopen must preserve supported meaning without transient caches; the
bounded session-history cap is not permission to lose source editability. Upgrades and changed
support require explicit validation/repair, not geometry-based retargeting. No new long-term history,
branching or collaboration system is authorized.

These are future consumer obligations within F.1/F.2/F.4, not amendments to their formats or accepted
scopes. Current payload versions, strict refusals, history and Save behavior below remain the landed
contract until an explicitly reviewed cutover.

## One source format (F2 clean epoch)

`ProjectEnvelope` format 1 contains `id`, `name`, `acceptedRevision`, `dependencyLock` and
`units`. Unit payload versions are Layout 10, Scene 12, Camera 1, Experience 4 and resources 3
(Layout 10 in T1 Wave 4 C1; Scene 12 / resources 3 in S8 D, #390). Scene 12 / resources 3 is the sole canonical format; by owner ruling (S8 E) no
Scene 11 → 12 conversion, saved-head inventory or rollback campaign exists.
Layout's envelope unit version is not a second number: `LAYOUT_UNIT_FORMAT_VERSION` is the Layout
`formatVersion` itself (`LAYOUT_WALL_FIRST_FORMAT_VERSION`), so one authority governs the unit
header and the payload.
[Experience 4](experience.md#current-authoring-and-runtime-contract) defines linear Guides,
entry Views, stays, invitations, outgoing transitions and Presentation naming. Earlier shapes
are refused without conversion.
Only declared F2 versions are admitted; old files, mixed roots, old drafts and unknown versions
refuse. There is no converter, format sniffing, fallback or dual write.

Layout 9 and earlier source is refused at Open, Load and Save. Opening refused source preserves the
current editor session. A refused Save leaves the stored head and receipt untouched.
A pending Save with a recognizable incompatible Layout stamp keeps its exact stored bytes
and remains available for download or explicit discard. A new sign-in handoff cannot
overwrite that capture. Activation against existing storage remains gated on an inventory
of heads, revisions, pending captures and releases, a tested restore with the outgoing reader,
and the owner's approved disposition for every affected source. See the
[verticality cutover gate](../../roadmap/t1-spatial-world/next-batch/v-plan-verticality.md#stored-source-and-activation).

**Scene 12** carries `textures`, `materials`, `entities`, optional `clusters`, optional `palette`,
optional `environment`, optional `surfaceFinishes`, and the project Artwork shelf. `surfaceFinishes`
contains one assignment per qualified Layout Wall-side, Space-floor, Space-lid or Region
`top`/`underside` reference; a Region `edge` has no Finish. Layout does not store appearance. The shelf owns project-local image entries. Every
Artwork source must resolve to a shelf entry with matching oriented dimensions. An Artwork may
carry one optional frame record (`style`, Mat, colour); absent is the canonical no-frame/no-Mat
default, and generated frame dimensions are never stored. This additive record does not bump the
Scene unit; a reader that predates it refuses a framed document at strict validation. Scene carries
no Camera or editorial fields. Scene 4 introduced the `form` entity,
whose authored source (generator, outline, extent, per-axis scale, next key) is stored verbatim;
Scene 12 stores world presentation as an optional `environment`. The Sky records time, noon
heading, noon height, haze, exposure, softness, the shared shadow switch, Moon colour and strength,
and Sky and Ground colours. The optional Treatment is `flat-colour` or `clay`. Absent Sky uses
Studio light. A Finish is `{id, name, base, overrides?}`. Its base names one curated `catalogue` id or
one project `material` definition by recipe digest. Sparse `overrides` may set `color` (a lowercase
literal or a palette follower), `roughness`, `metalness`, `occlusionStrength`, `normalScale`, the set
`mapping` (`target`, `surface` or `uv`), and per-role `maps` (`color`, `normal`, `roughness`,
`metalness`, `occlusion`). A map override binds a Scene texture; `null` explicitly disables the
base's map. An empty override container is never persisted. `palette` holds at most eight ordered
slots. Retired single-map and tile fields are refused as unknown keys. Resources 3 adds the `material` kind: `id === contentRevision`
is the canonical recipe digest, with one exact `resource:material` lock requiring
`pbr-metallic-roughness@1` and exactly one local image source per bound digest.

Scene 11 and earlier projects and releases are refused with `unsupported_format_version`; there is
no converter, dual reader or automatic republish path. Authors recreate such a project in Scene 12
before publishing it again (pre-baseline policy, below).

Scene 7 retired the authored `directional` Light
kind (the Sky owns the only Sun): any `directional` entity is refused with a typed error, never
converted or dropped. Generated geometry is never serialized, and a reader refuses older Scene formats rather
than converting them. Camera carries Views and connections. Connection endpoints are generated,
only interior anchors are authored, and directional framing envelopes retain their kernel rules.
`validateProjectEnvelope` separates structural issues, repairable authored diagnostics and
executable resource closure. The Stage discloses diagnostics and closure for inspection without
inventing resources; closure refuses F4 acceptance, Save and release. An unresolved View remains
repairable authored state and disables the affected visitor behavior.

**Layout:** canonical `units: 'meters'`. Canonical Layout is wall-first (`formatVersion: 10`, the only
recognised version): one floor datum, junctions → walls → reconciled rooms (with optional `round: { center, radius }` and seam-anchored boundary order) → openings → layout
objects → regions, project/world-local. The former versionless shape (floors → rooms each carrying a finite
`frame.origin: [x, z]` plus a normalized radian `frame.yaw`) is **no longer decoded**, and
T1.P02.S05 removed its reader, codec and Room-frame helper entirely. Opening `offset` = meters along a segment,
never a sample index. Door-only `connectsRoomIds: [string, string]` relations are explicit,
validated, never inferred from geometry; windows unpaired. The authored layout contract and
renderer-neutral compiler live in `@portfolio/layout-core`; the editor compatibility facades that
re-pointed at it are gone.

**Layout vertical authority (P23.6H/I):** `LayoutWall.height` is the only authored vertical extent, measured upward from the Floor elevation (`bottomY = floor.elevation`, `topY = floor.elevation + wall.height`); it is finite, strictly positive and within the shared 1,000 m geometry envelope — a Wall may be shorter or taller than its neighbours. The Floor carries a horizontal datum only (`id`, `name`, `elevation`, no vertical extent; a `height` key is rejected as `unknown_key`), so there is no Floor-relative cap and a Room ceiling is the maximum of its boundary Wall heights. New and split Walls take height from layout-core's birth/inheritance rule — explicit height, else the unique incident Wall height, else the named authoring default. The landed model is one floor; a multi-floor payload is **not accepted**. Captured from P23.6H/P23.6I, which made this the final Wall-defined vertical model with no durable clause anywhere in `docs/reference/`.

**Layout canonical curve geometry (P23.11):** a Wall's `centerline` is either a straight `line` between its endpoint Junctions or an explicit `cubic-chain` through them and its ordered interior bend points. Endpoints stay Junction-owned — the chain stores no endpoint point. Bend points carry stable identity; spans are positional (`spans.length === knots.length + 1`), one cubic each, and carry no identity and no lookup by ID. The persisted controls are the read-path authority: nothing re-derives or re-fits them, so subdivision and translation stay exact. Evaluating the stored cubics in order to render them is expected and permitted, not a violation. Wall orientation (start → end) is stable and identity-bearing because Opening `offset` is measured in meters from the canonical Wall start. Captured from P23.11, which selected this persisted model in code and in its slice plan while no reference contract stated it — a re-fit or re-orientation on the read path is the regression this clause exists to prevent.

**Layout closed Wall and periodic Openings:** equal `startJunctionId` and `endJunctionId` are one
isolated closed Wall, not a second shape kind. Its `cubic-chain` is exactly 16 symmetric cubic
spans (15 interior bend points) and the single Junction is the persisted seam; the reader refuses
a closed Wall in any other shape. A closed host is periodic: an authored Opening keeps one
`offset` in `[0, circumference)` and one canonical id, and may compile to two intervals across the
seam without becoming two entities. Format 7 and every other declared version are refused, with no
migration or dual reader.

**Layout open Spaces (format 8):** every Room carries required `virtualEdges` and `overhead`.
`boundary` remains the ordered Wall-side cycle; `virtualEdges` are stated straight segments
between existing Junctions that close the gaps between consecutive Walls, and `overhead` is
`closed` or `open-to-sky`. The codec composes one closed cycle and refuses a gap without enough
virtual edges, a virtual edge where no gap exists, a chain that starts twice at one Junction, and
a Wall side used by two Spaces. The compiler certifies a simple positive outline, derives area and
floor from it, keeps virtual edges out of compiled Walls and Openings, and blocks overlap or
containment except an open Space lying wholly inside an enclosed one. An enclosed Room's geometry
and cache keys are unchanged; `open-to-sky` removes only the generated lid and the ceiling
thickness from the Room bounds. Unroll and its development map are display-only session state and never
appear in persisted Layout.

**Layout geometry envelope (2026-10-31):** authored Wall height/thickness, Opening offset/width/height/sill height, and each Wall span are limited to 1,000 m. A straight Wall is measured by its chord; a curved Wall by its control-polygon length, which bounds its arc length. Junction positions are not dimensions, so rigid translation remains unrestricted. Exactly 1,000 m is accepted; an over-limit edit is refused without changing source or history, and canonical reads refuse an imported Layout before compilation or Stage admission with a subject-specific issue. This measured boundary keeps the authoring path within the tested geometry-cost envelope; the implementation records the measurement basis in `packages/layout-core/src/geometry/limits.ts`.

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

**Project image closure (T2.S8 · PR C).** The Scene texture registry and Artwork shelf are one
storage closure, enumerated by `@portfolio/project-model` for Save, cold Load and delivery. Save
resolves the complete closure before the transaction, then defers an IO refusal until after
owner-scoped receipt replay and saved-base checks. Under the project row lock it re-reads every
captured asset row with `FOR SHARE` in asset-id order and compares MIME, length, SHA and object
key; a concurrent repair therefore exposes either the complete old capture or a typed refusal,
never a mixed one. Version and receipt append only after those checks. Cold Load runs the same
closure against the loaded saved base before installing a candidate; failure preserves the current
session and returns `{code,projectId,savedBase,assetId,expectedPin,paths,action}`. Verified bytes
live only in a bounded short-lived loading cache.

Image repair restores the physical object behind an existing ready row; it is not a new asset,
revision, version, receipt or history entry. The owner-only
`PUT /projects/:projectId/assets/:assetId/repair` takes raw bytes plus the displayed digest and the
loaded saved-base token. Two phases bracket the stream: prove owner, base, saved-head membership
and pin under the project-then-asset update lock and record a 24-hour attempt; stream to a fresh
private staging key and verify length, digest, MIME and declared dimensions; then re-prove the same
facts and conditionally swap only the object key if it is still the one phase 1 observed. No
object-store read runs while those locks are held: a concurrent winner is observed there, verified
after release, then its exact row, pin and object key are re-proved before success, so Saves and
other repairs never wait on image bytes. A healthy row answers without a write; a wrong file or
stale base leaves the old key and session untouched. The swap consumes the attempt row, and the
next scoped asset access claims expired attempts in one statement before deleting an unreferenced
staging key, so a delayed commit can never adopt a claimed key. Failed staging is released, and
there is no background worker.

Project lifecycle (T3.P04.S01): an owner rename is conditional on the saved-base precondition and
uses the Save/version path, so historical versions remain readable and a no-op rename appends no
version. A stale or ambiguous response is recovered against the acknowledged base without replacing
the local draft. Confirmed owner deletion refuses while an active publication requires unpublishing;
it fences project writers, records the exact owned object-key inventory, retires project rows, and
deletes bytes through durable retryable cleanup. Cleanup is project-prefix scoped and completion is
proved with spaced empty listings after the enforced writer bound. A late visible key remains
repairable through completed-record verification. This is an owner-operated retry mechanism; it adds
no background cleanup service and does not change T2 model admission or the separate F2 epoch
activation procedure.

**Sign-in recovery (TD-9).** Before redirect the Save-owned pending-capture seam stores the exact
F2 request in session storage. The auth return page routes to `resume-save`; the spatial route
offers it even after a cloud 404 for a create-only request. Only explicit Resume installs and
replays it with the original operation ID and precondition. Cancellation preserves source,
selection, history and saved base; stale admission after replacement cannot install.

**Current account authentication (migration 009).** Authentication uses local username/password
credentials only; the API makes no external-provider request. `local_credentials.user_id` is a
one-to-one credential record for `users.id`, with a normalized unique username and a versioned
scrypt hash. New users receive `local:<uuid>` IDs. Existing `google:<subject>` IDs remain opaque,
valid session identities: migration 009 does not rewrite `users`, project owner IDs, or any other
owner foreign key. An existing legacy user may set a username/password only from an already
authenticated session; enrollment stores the credential against that exact `users.id`. Registration
always creates a new local ID and cannot claim a legacy owner. Signed-out recovery for legacy owners
without a current session has no approved identity-proof path yet and remains an owner decision;
accounts are never linked by email.

Passwords are constrained to 8–128 characters and usernames to 3–32 ASCII letters, digits, dot,
underscore or hyphen; usernames are lowercased before uniqueness checks. Hash records use the
`scrypt-v1` encoding with N=131072, r=8, p=1, a random 16-byte salt and a 64-byte derived key.
Credential endpoints cap request bodies at 2,048 bytes, return generic login failures for unknown
usernames and wrong passwords, and use database-backed 15-minute windows keyed by client source: 30
consumed attempts per source (failed logins and register/enroll attempts), and 10 failures per
source + normalized username, so one source cannot lock a username out for every other source. A verified login records no failure and clears that source's
budget for the username; register/enroll consume the source attempt budget. The per-account budget
is deliberately not global, so distributed guessing is bounded per source rather than per account;
existing `ip:` rows keep counting and legacy global `name:` rows are ignored and age out. Client
source is Fastify's `request.ip`, so a proxy deployment must set `TRUST_PROXY` to the terminating
proxy's addresses/CIDRs; without it forwarded headers are ignored and every client shares one
source. Login verification/failure and register/enroll admission share a transaction-scoped advisory
lock for the source, so API workers cannot race mixed credential actions past the same count. Local
non-proxy development ignores forwarded headers; when running behind a proxy, configure only its
actual peer addresses/CIDRs. One password-hash operation is admitted per API process at a time.
Successful authentication uses the existing `@fastify/secure-session` cookie: HttpOnly, Secure,
SameSite=Lax, seven-day expiry; browser-origin checks remain required for unsafe requests. The
test-only issuer remains isolated from production and creates the same app session.

**Clean epoch.** The retired clean-source epoch migration removed authored rows in one transaction and installed the
`unit-envelope-v1` schema fence, retaining users and migration history. The runner holds a session
advisory lock; rerun is a no-op and pre-epoch writers refuse. Namespace-owned R2 purge is a separate
owner action after the epoch; unknown or foreign keys refuse the purge. No production data reset
or deployment is implied by this source contract. Activation follows AM-9's owner-run runbook.

**My Objects library storage.** Migration 008 adds
`form_library_items`, the library-scope storage for the `form` kind. It is owner-scoped, not project
data: `owner_id` references `users`, while no project/release/asset foreign key exists, so deleting
a project leaves its items. Each row carries a server logical id, name, kind, payload format number,
the `sha256` content id and the exact canonical payload bytes in Postgres (small payloads, not R2),
plus a creation time. Items are immutable revisions: Save inserts, Remove deletes. The API
recomputes the content id from the canonical bytes and refuses unknown keys, other format numbers,
a mismatch, more than 256 KiB and more than 1,000 items per owner; the count is serialized by an
owner-scoped advisory lock in the same transaction. The owner predicate is on every list, read and
delete statement, so another owner's id answers as not found. The library is outside F2 project
Save: it adds no project version, dependency-lock entry or authored reference, and a Scene
`place-form-copy` writes a detached form source with a new entity id.

**Material library (T2.S8 G).** Migration 011 widens the same table's `kind` check to `material` and
adds the portable `recipe_hash`, the optional complete thumbnail key/hash/recipe/byte-size set, and
`material_library_images` (primary key `(item_id, hash)`, exactly one private object key or shipped
URI). A material item keeps the canonical `{kind:'material',formatVersion:1,name,recipe}` payload in
the existing bounded column. Save verifies exact source pins and streams private copies through the
ObjectStore before atomically inserting metadata, image rows and a `library_receipts` row; abandoned
staging rows are collected after 24 hours on the next owner-scoped library/transfer access. Transfer
runs under the destination project row lock, reuses a matching ready asset row or inserts a new one
with the destination project's own object key, and records its response receipt. The destination
never references a library or source-project key. Thumbnail and item reads are owner-filtered and
private/no-store. Removing an item cascades its image rows and reclaims only keys no committed row
still names.

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
format 2 carries the model resource and lock; Scene format 5 may reference it. The visitor/public
reader remains catalogue-only. T2.P02.S02 adds the import and placement flow that writes these revisions
and their Scene references through the S01 routes and Save verification, which it reuses unchanged.

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

## Library compatibility and baseline decision

My Objects stores authored source, never generated mesh. Inserting creates a detached editable copy
with a new identity; later changes to the item, source or copy do not propagate to the others.
Each item records a strict format number. An older-format item remains listed and removable but
cannot be inserted; there is no tolerant reader or upgrader before the baseline.
The owner commitment is that project/library versioning and migrations begin at an owner-declared
beta baseline. How that commitment relates to the separately declared Source Baseline remains an
explicit unresolved decision; no baseline is declared by this documentation consolidation.

## Source epoch activation safeguards

Deployment activation is an owner-controlled action, not a permission granted by documentation.
The baseline carries that fence as initial schema. The runner is serialized, transactional and idempotent. A failed
transaction changes nothing; post-activation recovery rolls forward without a reverse serializer.
Byte cleanup happens only after the epoch is recorded, only in the configured namespace and only
for keys the API wrote. Shared buckets, foreign namespaces and unknown provenance refuse cleanup.
The historical disposable-data ruling for that cutover never authorizes a future destructive reset.

## Preview and publish

Publishing compiles an accepted project revision, selected Experience(s), and a
delivery profile into a **visitor-safe prepared package** with an explicit
semantic runtime contract, closed resource graph and verifiable provenance:

```text
accepted revision × selected Experience(s) × delivery profile
→ versioned release reader
→ compatible visitor runtime
→ interactive · embed · presenter · stills/film adapters
```

Each published Experience has its own mutable publication pointer to an immutable
release and entry point. Semantic locations survive republishing while their
subjects persist; pinned release addresses preserve historical context; removal
or incompatible replacement returns an explicit result rather than silently
redirecting. A release may include several Experiences with explicit
selection/transition semantics; a simple UI may expose one.

**Release formats are separate from source formats.** The release reader consumes
prepared visitor data and never invokes the changing authoring validator or
historical authoring compilers. Visitors never receive editor session
infrastructure: selection, undo/redo, gizmos, Inspector, editor shell state,
authoring stores, or asset-management UI. The package excludes editor tools,
unresolved drafts, private source assets, credentials and arbitrary
author-supplied executable code by default. A native **editable project export**
remains a separate artifact containing supported source and resources; a visitor
package does not promise reconstruction of the editable project.

**Delivery-derivative exception.** Immutable, versioned, reproducible delivery
derivatives are permitted outside authored documents (they were formerly
forbidden by a blanket rule). Generated Camera endpoints may exist in a compiled
delivery descriptor; they remain forbidden as a second authored set of connection
anchors. Three objects, GPU handles, selection and transient editor state remain
excluded.

**Baselines** — see [Release and Source Baselines](#release-and-source-baselines).

**Current implementation:** P22 stores an authored `ProjectDocument` snapshot plus
an asset manifest, and the public read path revalidates it with deployed code;
cold preparation also uses deployed decode/compiler code. That path is current
behavior to be cut over, not the destination. Its `RuntimeScene`/`RuntimeConnection`
forms, including resolved Camera poses/paths, are starting evidence, not schemas
to freeze or serialize blindly.



## Release and Source Baselines

**Release Baseline (destination; not yet declared).** Required when external
publication is promised durable. It names the release formats/profiles, retained
dependency closure, supported behavior/window, runtime patch/deprecation policy,
and managed-delivery promises. Its reader consumes prepared visitor data without
invoking the authoring validator or historical authoring compilers. Before it is
declared, provenance must be verifiable — retained source revision and dependency
lock connected to build identity and output hashes through controlled build
records or equivalent attestation. A self-asserted manifest is not sufficient
evidence of that linkage.

**Source Baseline (destination; not yet ratified).** Ratified only after F's
formats land and the supported composition/Experience units stabilize. It
establishes durable editable-project and resource migration/version-support
obligations. It is independent of release durability: an already supported
visitor package does not force every intermediate source schema to become
permanent.

**Disposable alpha.** Biskiq currently has no retained user projects or promised publications.
Owner tests and hosted acceptance fixtures are disposable. A strict Layout format bump may
make those files, drafts and saved revisions unreadable by the new reader. No converter,
dual reader or migration subsystem is required for disposable alpha source. Keep strict
validation, failed-Load isolation and pending Save export. A format bump grants no authority
to delete old rows, assets or snapshots.

When a format change reaches a store with existing data, record the inventory and disposition
on its PR. A retained project, promised editable file or durable publication requires its own
preservation and recovery plan before cutover. Reassess this policy before accepting the first
retained trial project or promising durable delivery.

**Before the Source Baseline**, each persisted format has exactly one admitted
version. A format change bumps the number and every reader refuses the other
versions; there is no migration, converter, dual reader, optional-on-read field
or compatibility fixture. A database is handled in one of two ways. A
disposable database — local Compose, CI services, test schemas — is rebuilt from
the baseline freely. An existing database adopts the baseline without writes:
the baseline replaces migration `001` with the full current schema, the runner
skips recorded versions and ignores extra ones, and adoption happens only after a
read-only schema comparison shows it matches. Dropping, resetting or rewriting a
non-disposable database, including `schema_migrations`, needs the owner's
explicit authorization. Later schema changes are new numbered migrations;
documents are refused, never converted.

```text
pre-baseline development data → no compatibility guarantee
Release Baseline → visitor release durability obligations
Source Baseline (after F lands) → editable source migration/version support
```

### Development-stage schema compatibility (pre-baseline)

Until the relevant baseline is declared, development schemas may break: new
work does not add migration layers, tolerant historical decoders, multi-version
canonical types, compatibility-only visitor branches or legacy writer support by
default, and obsolete compatibility code is removed rather than carried forward
solely because an earlier development revision existed. Reaching `main` does not
by itself create a backward-compatibility obligation; merge history records what
the code did, not a durability claim about what users own.

A migration or compatibility path before a baseline requires an explicit
product reason and acceptance criterion — externally distributed project files
that must remain usable, a published snapshot intentionally declared durable, an
intentional import format or external integration, or production data that
cannot reasonably be reset — documented explicitly. Existing migration code is
not itself evidence that compatibility remains required.

```text
LEGACY ADAPTER EXISTS
≠
LEGACY FORMAT IS A SUPPORTED PRODUCT CONTRACT
```

A pre-baseline reader may legitimately exist because internal demo content,
benchmark goldens or another not-yet-migrated internal asset still depends on
the older representation: a development dependency with a named owner and a
planned removal path, documented as temporary — not a promise that the format
keeps loading. This does not weaken canonical validation: current documents are
validated strictly, deterministic operations preserve ownership/history
invariants, and editor/visitor parity remains required. Intentional format
conversion (an importer that deliberately converts an external or separately
supported format into canonical project state) is a product capability, not
backward compatibility.

Keep four compatibility concerns distinct: editable-project schema, release
representation, evaluator semantics, and host/delivery API. A runtime build may
support several semantic profiles and a release declares those it requires; a
matching major version alone is insufficient if a required capability is absent.
Unsupported required behavior fails clearly, and an authored fallback may satisfy
a declared alternative profile. A changed implementation that alters supported
behavior needs a semantic version boundary, an explicit migration/rebuild, or a
documented deprecation decision — never a silent reinterpretation of an immutable
release. Conformance covers semantic traces and selected visual/numerical
tolerances, not eternal pixel identity.

*(This split replaces the former single Compatibility Baseline concept; earlier
statements of one milestone no longer describe the destination.)*
