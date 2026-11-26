# Persistence — source admission, Save and release

**Owns:** the persisted source envelope, version admission, canonical content identity, local
replacement, cloud Save/recovery and the baseline gates for source and release. Code constants own
current format-version numbers; this contract never restates an integer.

## One admitted version per format

Until the owner declares beta, each persisted format admits exactly one version. A change bumps the
owning codec's number, and every reader refuses all other versions with
`unsupported_format_version`. There is no migration, converter, dual reader, optional-on-read field
for older documents, compatibility fixture or historical differential. Fixtures are regenerated in
the same commit that bumps the number. Old files, drafts, mixed roots and unknown versions refuse
without conversion, sniffing or fallback.

- **One number per Layout unit.** `LAYOUT_UNIT_FORMAT_VERSION` is the Layout payload's
  `formatVersion` itself (`LAYOUT_WALL_FIRST_FORMAT_VERSION`), so one authority governs the unit
  header and the payload. No second version exists.
- **Refused source preserves the session.** Opening refused source leaves the current editor
  session, history and saved base intact. A refused Save leaves the stored head and receipt
  untouched.
- **Pending incompatible capture.** A pending Save carrying a recognizable incompatible Layout stamp
  keeps its exact stored bytes and remains available for download or explicit discard. A new sign-in
  handoff cannot overwrite that capture. Activation against existing storage is gated on an
  inventory of heads, revisions, pending captures and releases, a tested restore with the outgoing
  reader, and the owner's approved disposition for every affected source.
- **Released readers stay separate.** A release reader consumes prepared visitor data and never
  invokes the changing authoring validator or historical authoring compilers.

## Editable source and revision

Future expressive capabilities must retain the domain-owned source needed for their admitted edits
and declared relationships. Deliberately authored geometric controls may be source; generated
tessellation, renderer handles, session caches and chronological history remain outside authored
truth. This distinction admits no new source kind into a current codec.

- **No coequal writable forms.** Two representations may not silently compete for the same form. A
  conversion must declare supported edits/relationships retained or lost, approximation and
  recovery; no implicit bake may discard accepted meaning. The source encoding, conversion routes,
  identity-lifetime records and recovery mechanism are TBD until a real consumer requires them.
  Neither a universal operation log nor a persisted general-purpose form language is selected.
- **Exact reproduction.** Accepted controls, semantic identities and relationship decisions must
  reproduce the accepted result to the exactness the existing contracts require. Approximation
  cannot weaken exact F obligations. Undo/new edit, Save and cold reopen preserve supported meaning
  without transient caches; the bounded session-history cap is not permission to lose source
  editability.
- **Explicit repair, never retargeting.** Upgrades and changed support require explicit
  validation/repair, not geometry-based retargeting. No long-term history, branching or
  collaboration system is authorized.

## Envelope and canonical identity

The live source is `ProjectEnvelope` with the five codec-bounded units and the dependency lock
described in [architecture](./architecture.md#f2-persisted-units-and-the-project-envelope). Boot,
starter, empty, Open, Download and Save use that envelope exclusively; `prepareUnitRuntime`
compiles Layout, resolves Scene and derives connectivity from the Camera unit.

- Every unit has one strict codec, one explicit version and one validation entry.
  `validateProjectEnvelope` separates structural issues, repairable authored diagnostics and
  executable resource closure. The Stage discloses diagnostics and closure for inspection without
  inventing resources; closure refuses F4 acceptance, Save and release. An unresolved View stays
  repairable authored state and disables the affected visitor behavior.
- **Canonical source digest.** The project-model export hashes UTF-8 canonical authored-content JSON
  with `sha256Bytes`. Strict normalized source is used; ID-keyed Layout identity maps are ordered;
  only `layout.identity.cursor` is omitted. The cursor is persisted allocation bookkeeping, while
  identity assignments remain authored and affect the digest. Full canonical source retains the
  cursor for Save/Load and exact Undo/Redo. Equal digests therefore do not prove full-source byte
  equality: exact history restoration and changed-payload Save retries also compare the full captured
  source.
- Excluded from the digest: `acceptedRevision`, session/history/receipt metadata and transport
  state. Unit `contentRevision` hashes canonical domain data only; header/payload version mismatch
  rejects.
- **Local history.** One F4 chronological stack holds at most **100** accepted operations, skips
  no-ops, truncates redo after a new edit and mints fresh revisions on Undo/Redo. Open, starter,
  empty, Reload and pending-Save Resume replace the session through the host's unsaved-work and
  session-lifetime guards. No Undo crosses a replacement baseline. Selection, generated geometry,
  renderer handles and history are never serialized.

## Local Save capture

`captureUnitSave` stamps the accepted revision into canonical persistence bytes; the mounted source
keeps its embedded baseline provenance. Dirty/history comparisons use the captured mounted bytes,
while the server validates the stamped capture.

- **Preconditions.** Save compares a `create-only` or `expected-saved-base` precondition, appends a
  version under a project row lock and records an idempotent operation receipt. Reusing a revision
  for changed contents or an operation for changed bytes refuses. One concurrent saved-base
  contender wins; the loser preserves local work and gets a conflict. A network-ambiguous retry
  replays the exact capture. Reload is explicit replacement.
- **Identical retries** return the original receipt; a changed-payload retry refuses. Acknowledgment
  marks only the captured contents saved; newer local edits stay dirty. Conflicts preserve local
  work/history and remote data pending reload or explicit resolution — no automatic merge, no cloud
  Undo stack.
- **Stale writes are refused through two identities.** A local intent compares `expectedRevision`
  against the local accepted revision; cloud persistence compares a captured accepted source against
  a durable saved-base token. The saved-base token is not the local revision.
- **Image closure before the transaction.** Save resolves the complete project-image closure before
  the transaction, then defers an IO refusal until after owner-scoped receipt replay and saved-base
  checks. Under the project row lock it re-reads every captured asset row with `FOR SHARE` in
  asset-id order and compares MIME, length, SHA and object key, so a concurrent repair exposes
  either the complete old capture or a typed refusal, never a mixed one. Version and receipt append
  only after those checks. Cold Load runs the same closure against the loaded saved base before
  installing a candidate; failure preserves the current session and returns the code, project,
  saved base, asset id, expected pin, referencing paths and repair action. Verified bytes live only
  in a bounded short-lived loading cache.
- **Repair is not a new revision.** Exact-byte image repair restores the object behind an existing
  ready row; it creates no asset, source revision, version, receipt or history entry. It is
  owner-only, takes the displayed digest and loaded saved-base token, and never runs an object-store
  read while its locks are held.
- **Project lifecycle.** An owner rename is conditional on the saved-base precondition and uses the
  Save/version path, so historical versions stay readable and a no-op rename appends no version. A
  stale or ambiguous response is recovered against the acknowledged base without replacing the local
  draft. Confirmed owner deletion refuses while an active publication requires unpublishing; it
  fences project writers, records the exact owned object-key inventory, retires project rows and
  deletes bytes through durable retryable cleanup. Cleanup is project-prefix scoped, and completion
  is proved with spaced empty listings after the enforced writer bound. This is an owner-operated
  retry mechanism; it adds no background cleanup service.

## Sign-in recovery

Before redirect, the Save-owned pending-capture seam stores the exact F2 request in session storage.
The auth return page routes to `resume-save`; the spatial route offers it even after a cloud 404 for
a create-only request. Only explicit Resume installs and replays it, with the original operation ID
and precondition. Cancellation preserves source, selection, history and saved base; stale admission
after replacement cannot install. A pending incompatible-stamp capture follows the stronger rule
above and cannot be overwritten by a sign-in handoff.

## Accounts and storage boundary

Authentication uses local username/password credentials only; the API makes no external-provider
request. `local_credentials.user_id` is a one-to-one credential record for `users.id`, with a
normalized unique username and a versioned scrypt hash. New users receive `local:<uuid>` IDs.
Existing opaque legacy IDs remain valid session identities; enrollment stores a credential against
the exact existing `users.id`, and registration cannot claim a legacy owner. Signed-out recovery for
legacy owners without a current session has no approved identity-proof path and remains an owner
decision; accounts are never linked by email.

Project registry metadata lives in Postgres; heavy image and model bytes live in private R2 through
`apps/api` only. Session/package texture URIs cannot reach semantic JSONB Save. Each asset row
carries `importState` (`pending`/`ready`/`failed`), `mime`, `byteSize`, `sha256` and `objectKey`.
The library scope is owner-scoped, not project data, and adds no project version, lock entry or
authored reference.

## Owner-gated activation

Deployment activation is an owner-controlled action, not a permission granted by documentation. The
baseline carries the schema fence as initial schema; the runner is serialized, transactional and
idempotent. A failed transaction changes nothing; post-activation recovery rolls forward without a
reverse serializer. Byte cleanup happens only after the epoch is recorded, only in the configured
namespace and only for keys the API wrote. Shared buckets, foreign namespaces and unknown provenance
refuse cleanup. The historical disposable-data ruling for a past cutover never authorizes a future
destructive reset.

A disposable database — local Compose, CI services, test schemas — is rebuilt from the baseline
freely. An existing database adopts the baseline without writes: the baseline replaces the first
migration with the full current schema, the runner skips recorded versions and ignores extra ones,
and adoption happens only after a read-only schema comparison shows it matches. Dropping, resetting
or rewriting a non-disposable database, including `schema_migrations`, needs the owner's explicit
authorization. Later schema changes are new numbered migrations; documents are refused, never
converted.

## Baselines and disposable alpha

```text
pre-baseline development data → no compatibility guarantee
Release Baseline              → visitor release durability obligations
Source Baseline               → editable source migration/version support
```

- **Disposable alpha.** There are no retained user projects or promised publications. Owner tests
  and hosted acceptance fixtures are disposable; a strict format bump may make those files, drafts
  and saved revisions unreadable by the new reader. Keep strict validation, failed-Load isolation
  and pending Save export. A format bump grants no authority to delete old rows, assets or
  snapshots. When a format change reaches a store with existing data, record the inventory and
  disposition on its PR. A retained project, promised editable file or durable publication requires
  its own preservation and recovery plan before cutover. Reassess before accepting the first
  retained trial project or promising durable delivery.
- **Release Baseline (not yet declared).** Required when external publication promises durable
  delivery. It names release formats/profiles, retained dependency closure, supported behavior and
  window, runtime patch/deprecation policy and managed-delivery promises. Before it is declared,
  provenance must be verifiable — retained source revision and dependency lock connected to build
  identity and output hashes through controlled build records or equivalent attestation. A
  self-asserted manifest is not sufficient evidence of that linkage.
- **Source Baseline (not yet ratified).** Ratified only after the composition/Experience formats
  stabilize. It establishes durable editable-project and resource migration/version-support
  obligations, independent of release durability: an already supported visitor package does not
  force every intermediate source schema to become permanent.
- **Development-stage compatibility.** Until a baseline is declared, development schemas may break:
  new work does not add migration layers, tolerant decoders, multi-version canonical types,
  compatibility-only visitor branches or legacy writers by default. Reaching `main` does not create
  a backward-compatibility obligation. A migration or compatibility path before a baseline requires
  an explicit product reason and acceptance criterion — externally distributed project files that
  must remain usable, a published snapshot intentionally declared durable, an intentional import
  format, or production data that cannot reasonably be reset — documented explicitly. Existing
  migration code is not itself evidence that compatibility remains required. A named, temporary
  internal adapter is not a supported product contract.

```text
LEGACY ADAPTER EXISTS ≠ LEGACY FORMAT IS A SUPPORTED PRODUCT CONTRACT
```

Four compatibility concerns stay distinct: editable-project schema, release representation,
evaluator semantics, and host/delivery API. A runtime build may support several semantic profiles
and a release declares those it requires; a matching major version alone is insufficient if a
required capability is absent. Unsupported required behavior fails clearly, and an authored
fallback may satisfy a declared alternative profile. A changed implementation that alters supported
behavior needs a semantic version boundary, an explicit migration/rebuild, or a documented
deprecation decision — never a silent reinterpretation of an immutable release. Conformance covers
semantic traces and selected visual/numerical tolerances, not eternal pixel identity.

## Publication readiness

Publishing compiles an accepted project revision, selected Experience(s) and a delivery profile into
a visitor-safe prepared package with an explicit semantic runtime contract, closed resource graph
and verifiable provenance. Each published Experience has its own mutable publication pointer to an
immutable release and entry point. Semantic locations survive republishing while their subjects
persist; pinned release addresses preserve historical context; removal or incompatible replacement
returns an explicit result rather than silently redirecting. A release may include several
Experiences with explicit selection/transition semantics; a simple UI may expose one.

Release formats are separate from source formats. The package excludes editor tools, unresolved
drafts, private source assets, credentials and arbitrary author-supplied executable code by default.
A native editable-project export remains a separate artifact containing supported source and
resources; a visitor package never promises reconstruction of the editable project. Immutable,
versioned, reproducible delivery derivatives are permitted outside authored documents; generated
Camera endpoints may exist in a compiled delivery descriptor but never as a second authored set of
connection anchors.

Until T4 activates the prepared reader, Publish/Update return `prepared-reader-required`. Public
metadata and asset reads return an honest 404 with `Cache-Control: no-store`; no old-document reader
is a live delivery fallback. Owned status and OCC-checked Unpublish remain. The prepared package,
reader boundary and activation gate are specified in
[the prepared release design](../plans/t4-release/prepared-release-design.md).

## Hard don'ts

A converter, format sniffer, dual reader or compatibility fixture before a baseline · a second
Layout version number · a Save transaction that reads object-store bytes under lock · a cloud Undo
stack or automatic merge · silently retargeting authored references on upgrade · deleting old rows
or assets because a format bumped · serving an old document through a deployed reader as a fallback
· writing session, history, selection, renderer handles or generated geometry into authored source.
