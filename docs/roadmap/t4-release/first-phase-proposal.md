# T4 first-phase proposal — prepared release foundation

**Status:** track-local proposal for review, 2026-10-14. No phase or slice is registered or
authorized by this document. Candidate IDs below describe sequence only. No F amendment, gate
version, shared contract, capability implementation or Baseline is established here.

**Reconciled 2026-10-17.** Several gate-state statements below predate the 2026-10-15 F ratification
and the accepted F1–F4 providers. The [T4.P01 registration draft](./t4.p01-prepared-release-foundation/README.md#reconciliation-of-the-2026-10-14-proposal-against-post-pr-135-main)
records which statements are superseded and by what. This proposal stays as evidence and is not
rewritten.

**Recommendation:** compile accepted F2 Camera/Experience source into one bounded prepared profile,
persist releases independently of source versions, and replace public snapshot delivery in one
coordinated T4 cutover. T3 owns the sole authored-source conversion and visitor semantic transition;
T4 reuses its ExecutionProgram codec/lowering/interpreter. No default legacy Experience identity map.

Use the [coordinated provider/readiness/DAG proposal](../cross-track-execution.md) and
[T3 unit/program draft](../t3-experience/t3.p01-camera-experience-foundation/f-amendment-proposals.md). F5 provider work needs the shared program codec, not T3 activation;
offline lowering/storage can use closed F2 fixtures and accepted runtime primitives. Final public
activation consumes accepted T3 S04, never completion of T3 authoring/track. These remain proposals.
Planning proceeds on the landed r186 base: the separate
[r186 upgrade (PR #122)](https://github.com/Biskiq/spatial-sketch-editor/pull/122) merged into `main`
as `74efb98b` (three 0.186.1, Threlte unchanged, explicit `PCFShadowMap`),
with compatibility verified against that actual baseline. Do not alter the upgrade in these PRs.

## Evidence and governing boundaries

Inspection baseline: clean `setup/t4-release` at
`61baf02873a63d37e3f5a3e2992396f387600d38`, the merged PR #116 closeout of the reset executed under
PR #115. GitHub reports [PR #115](https://github.com/Biskiq/spatial-sketch-editor/pull/115) merged
2026-10-14; its initial planning-only description is not evidence that execution remains pending.
The landed code, R115 closure and present track register establish the surviving foundation.
No deployed database or storage inventory was inspected for this proposal.

The [T4 roadmap](./README.md), [T4 runbook](../../operations/t4-release/README.md),
[gate register](../README.md#gate-register), [F.5](../../reference/composition-execution.md#f5-release-envelope-and-program-slots),
[release architecture](../../reference/architecture.md#release-packages-destination), and
[Baseline policy](../../reference/north-star.md#release-and-source-baselines) govern this proposal.
F.1–F.5's destination shapes are owner-ratified; their exact interfaces are all still
`undrafted`, without versions, provider slices or acceptance evidence. A ratified shape is not an
accepted implementation dependency. Source encoding remains current until its own explicit cutover.

Preserve these boundaries throughout:

- Layout owns architecture and its one canonical compiler; Scene owns composition and presentation;
  Camera owns connectivity, routes, framing, projection and evaluation; Experience owns editorial
  occurrences, order and continuation. Release compilation derives artifacts from these authorities.
- A visitor has no editor session, selection, history, gizmo, authoring infrastructure or source
  writes. Sharing runtime-safe domain math does not violate isolation.
- The prepared reader validates delivery data, not authored documents. It imports neither current
  authoring validators nor historical source compilers. Build-time lowering may use both current
  validation and the canonical compiler.
- Generated Camera endpoints may occur in an immutable delivery descriptor. They never become
  authored anchors. Playback continues through the single Camera engine.
- Keep source revision, release identity, format versions and publication concurrency distinct.
  Neither a source-schema migration nor a deploy silently changes an existing release's meaning.

## What actually survives the reset

| Surface | Landed behavior and evidence | Consequence for T4 |
| --- | --- | --- |
| Source persistence | `git show 0d2f6ceb^:packages/project-model/src/project-codec.ts` records the pre-cutover reader, which strictly validates `{ id, name, layout, scene }`; Layout is wall-first format 5, Scene world-local format 1. `apps/api/src/project-persistence.ts` saves append-only numbered versions under a project row lock. Save has no expected-base revision. | Baseline evidence only: current Save is not F4 acceptance. Live T4 builds wait for T3's accepted/saved F2 revision and exact lock; no default legacy build adapter or historical detector. |
| Publication persistence | `apps/api/migrations/003-publications.sql` makes `publications.project_id` the primary key; `active_version` selects a release keyed by `(project_id, version)`. A `releases` row physically stores **only the asset manifest** and references `project_versions`. | The roadmap's shorthand “snapshot + manifest in releases” describes delivery logically. The document is actually joined from `project_versions`; a new prepared release must be self-sufficient at read time. Record this precision here; do not rewrite shared contracts before their cutover. |
| Owner API | `apps/api/src/publication-persistence.ts` retains status, Publish/Update and Unpublish. Preparation validates and compiles Layout, checks references and hashes new R2 pins outside the transaction. Activation checks owner, publication revision and asset pins under locks. Status allocates no public ID; ABA increments revision; an exact older saved version can be selected. | Keep short activation transactions and OCC. Compilation and resource work stay outside them. A publication revision is not a source revision. |
| Anonymous API | `readPublicRelease` joins the active saved document and revalidates it with deployed `validateProject`. `readPublicReleaseAsset` uses version-qualified pins while the publication is active. `apps/api/src/app.ts` sends `no-store`, omits object keys, and disables all versioned byte delivery when unpublished. | Remove the source join/validation from the delivery path at cutover. Retain coherent bootstrap, private storage locators, revocation behavior and `no-store`. |
| Cold browser bootstrap | `public-release-client.ts` fetches metadata and version-qualified P20 textures, verifies MIME, length, bounded body and magic, then invokes `composeColdReleaseBundle`. `visitor-cold-runtime.ts` calls `prepareRuntime`; that calls `validateProject`, canonical Layout compilation, Scene resolution and graph creation. Route aborts and disposal prevent stale installs and leaked URLs. | Strict does not mean prepared or independently versioned. Retain cancellation and scope lifetime behavior while replacing the source-dependent preparation. |
| Current resource guarantee | New publication preparation checks P20 hashes. Public asset projection exposes asset ID/MIME/size, **not SHA-256**; browser download has no hash comparison. Static model/material references pass a retained registry. | Add end-to-end hash verification and actual immutable closure. A static allowlist or registry version is not a content lock. Existing release reuse does not rehash all bytes. |
| Render path | Generic visitor entities, Layout shell, materials, texture scopes and model loader remain. `AssetModel.svelte` reads the deployed `getAsset`; `MuseumMaterial.svelte` reads deployed `getMaterial`. Layout rendering consumes compiled junctions/walls; the shell also uses default materials. | Removing the source validator alone would leave deploy-dependent appearance. Prepared descriptors must supply model/material definitions and implicit shell resources, not merely wrap IDs in a manifest. |
| Camera and visitor state | `@portfolio/camera-core` owns graph routing and motion. `VisitorCameraDirector.svelte` calls `getCameraRoute`, `createCameraMotion`, `sampleCameraMotion`. Visitor state still derives order from node links; zero-node projects use neutral orbit. | Reuse Camera route/motion evaluation. T3 replaces node-order visitor semantics; T4 consumes its shared program/interpreter. Prepared Camera data supplies connectivity only; never revive legacy editorial inputs. |
| Removed capabilities | Publication client/presentation, editor preview/publish routes, package ZIP orchestration and authoring asset upload/load wiring were removed. Low-level project/asset API client helpers and server assets remain. The frozen Chopin project is outside the repository. | Do not plan around a reusable publication panel or editor preview session. Rebuilding general ingest belongs to T2; native editable import/export is separate work. |

The strict reader, `/p/[publicationId]`, real-Postgres API tests and public import-closure plugin
are retained deliberately, not leftovers to delete early. Existing guards include
`visitor-cold-runtime.test.ts`, `visitor-public-route.test.ts`, `visitor-identity-isolation.test.ts`,
the public/preview Vite boundary suites and `apps/api/tests/publication.test.mjs`.

The owner previously stated an empty covered-data ledger and no product releases. This planning
pass supplies no live evidence of either. Inventory actual rows/bytes before either transition and
obtain owner acceptance for any gap; do not discard data or create a duplicate standing ledger.

## Proposed first phase and its limit

Candidate **T4.P01 — Prepared release foundation** delivers an exact accepted and saved F2 source
revision × selected Experience × delivery profile, immutable prepared resources/artifacts, per-
Experience OCC activation, and detached cold /p/ execution. API-driven prepare/activate/update/
unpublish is sufficient for this bounded phase. **T4 owns the immediate thin publication-UI follow-on**:
select Experience, show readiness/refusal, prepare/activate/update, open link and Unpublish. Full
sharing/polish is later. The first four phases do not complete the full creator-to-visitor journey.
T2 owns bounded single-model ingest before the promised creator/audience trial.

First profile uses T3's **ExecutionProgram@1**, not a second language/interpreter: labelled
Presentations/text content, distinct Stop occurrences/visit runs, Cut, supported directed Travel,
sequence/explicit Stop/End continuation, finite holds/Continue and covered return-to-origin policy;
boolean/choice initial/reset state and literal/state-read/equality/conjunction guards; exclusive
Camera contribution/handoff, run lifecycle, reduced motion and semantic DOM navigation. Unknown
required capability/operator/state/profile refuses. Existing unsupported source meaning reports a
path/action; no silent flattening or Travel→Cut. Neutral zero-Camera entry requires an explicitly authored selected Experience. A source with no
Experience refuses with experience-selection-required; release lowering never fabricates one.

T3 S01 supplies the shared codec and source identities; S03 supplies sole semantic lowering/runtime
primitives; T3 S04 activates source/runtime. T4 persists the resulting program as an immutable delivery
derivative. Editor Preview uses the same semantic lowering/evaluation, whereas release Preview runs
the actual package. F5 acceptance proves schema/negotiation, not actual runtime/public replacement.

Fixtures: empty/new-unit project with no Experience (explicit refusal), deliberately authored
empty Experience with neutral zero-Camera entry; curved walls/Junction/Opening plus primitive; directional Camera
Travel/framing; repeated Presentation with distinct Stops/runs; hold/Continue/guard failure/reset;
GLB/catalogue material and texture closure; two independently published Experience selections. Retain
source/compiler/resource provenance, with no dependence on mutable catalogue definitions at read time.

Outside this phase: creator publication panel, sharing polish, general asset ingest, editable ZIP,
localization authoring, media scheduling, embedding/SDK, film/still output, live data, collaboration
and audience records. A Release Baseline is required before durable external publication; this phase
does not declare it or Source Baseline. Accessible visitor behavior is part of the supported profile.

## Lowering accepted units into prepared data

Build from a frozen accepted F2 source and exact dependency lock, followed by verified resource IO
and durable recording. Reject an unsupported source epoch rather than sniffing legacy source. No
retained legacy Experience converter/selection map in the default sequence. T3's covered conversion
already preserves/authors the Experience/Presentation/Stop identities; T4 uses them directly.

| Build input | Delivery representation | Authority and checks |
| --- | --- | --- |
| Exact accepted/saved F2 envelope | Private source revision/content/lock/build record | Validate on build side with accepted source adapter; pin codec/toolchain and dependencies. No editable source in public payload. Offline candidate fixtures are marked as such and do not authorize live publication. |
| Layout unit | Versioned renderer-neutral floor/Room/wall/Opening/Junction/object/bounds DTO | Derive only through canonical compiler. Preserve source correspondence and blocking-issue refusal. No topology reconstruction/source compilation in the reader and no editor viewport dependency. |
| Scene unit | Explicit world transforms, primitives/lights/material/texture/model descriptors | Freeze normalization, fallback dimensions, sampler metrics, shell materials/lighting/background defaults and all definition dependencies. No live catalogue lookup or silent appearance drift. |
| Camera unit | Versioned prepared View/Connection descriptors with generated endpoints/directional route inputs | Use Camera-owned preparation/evaluation, validate finite values/IDs/continuity and deterministic route ordering. Hydrate runtime maps locally. Never store Three/curve/controller objects or another pose sampler. |
| Experience units | Shared ExecutionProgram with authored Experience/Presentation/Stop identities and supported invocation/context | Call T3's sole semantic lowering; Guide order/continuation/holds remain Experience-owned. No node-link conversion, generated authored occurrence identity, separate BFS or release interpreter. |
| Exact typed resource revisions | Content-addressed resources with MIME/size/hash/dependency edges | Include textures, GLBs and nested dependencies, catalogue definitions and implicit shell/default resources. Refuse missing/corrupt/external-unclosed inputs; explicit primitive fallback is distinct from failed required GLB. |
| Semantic identities/source maps | Release-qualified public address/authorized traceability table | Use shared F1 release addressing; removed/incompatible subjects report explicit results. No names/offsets/nearest retargeting. Public projection excludes private source details/locators. |

S03 compares prepared route samples/traces with the canonical engine and T3 shared interpreter.
Intrinsic directed timing is consumed deliberately; the retained old public controller's missing
getCameraMotionOptions call is baseline evidence, not a playback policy to preserve in new releases.
Neither T3's new source schema nor release encoding may silently reinterpret an existing release.

## Interface proposals for reconciliation

These are proposed shapes and boundaries, not a new shared contract. Names and numeric versions
remain provisional until the owning F amendment assigns them. Separate concerns before choosing
whether shared release exports live in an existing package or a dedicated package: the latter is
justified only if API compilation and visitor-only reading need independent import/lifetime closure.
Prefer explicit read/compile subpath exports with separate dependency closures before adding more
packages. A facade re-exporting `project-model`'s validator is not an independent reader, and
tree-shaking an authoring barrel does not establish that boundary.

### Identity and version domains

| Value | Meaning |
| --- | --- |
| Source reference | Exact accepted F2 revision plus saved-base context and canonical source/lock digest; schema is recorded, not used as release version |
| Build key | Digest of normalized source/selection/profile inputs, dependency lock, adapter/compiler/toolchain identity and build policy |
| Build attempt ID | Operational identity for a controlled attempt and its outcome; retry timestamps are outside deterministic package bytes |
| Release ID | Content identity of the canonical release core and its artifact/resource hashes; same inputs with deterministic output produce the same release |
| Release schema / payload / profile versions | Independent semantic compatibility declarations, including required capabilities; not the saved version or coarse npm package version. Independent of the installed Three.js version (landed base 0.186.1): a renderer/runtime update changes the Reader/runtime build identity and its supported-format matrix, never an existing release's bytes or meaning — S05's golden-fixture survival probe proves it |
| Reader/runtime version | Independently released runtime build with a declared supported-format/profile/capability matrix; a security patch changes this identity without rebuilding or reinterpreting compatible releases |
| Publication ID and revision | Stable public Experience pointer and monotonic OCC token; activation/Unpublish mutate this row, not the release |
| Optional release sequence | Owner-facing ordinal if useful later; never a source-version primary key or semantic format version |

Suggested envelope core, expressed as fields rather than executable TypeScript:

```text
kind, releaseFormat
sourceContext: retained revision/content identity + dependency-lock digest
build: buildKey + compiler/adapter/toolchain identities + input-record digest
profile: kind/version + requiredCapabilities + optionalCapabilities
experiences[]: stable identity + explicit entry + supported selections/transitions
payloads[]: domain/kind/version + content hash + size
resources[]: content hash + media type + size + dependency hashes
program: versioned occurrences, bindings, state, guards, time, channels, lifecycle
meaning: Presentations/content/alternatives/locales supported by this profile
publicInterface: semantic addresses + declared parameters/actions/events/host permissions
traceability: release-qualified runtime-to-source mapping
```

Use a single `releaseId` derived from this canonical core; exclude its own hash, mutable pointer
revision, timestamps and storage locators from the hash preimage. Define normalization of numbers,
absent values, object keys and identity-keyed sets. Preserve meaningful editorial order and ordered
Camera connections; sorting a Guide or changing BFS tie order is a semantic change. Include
resource bytes and definition digests in the lock, not registry labels alone. Rebuild reproducibility
must compare actual artifacts, not just two declarations of the same input digest.

Public responses carry no credentials or object keys. Detailed retained source records and source
identity maps need an explicit disclosure policy: expose only authorized semantic mappings/digests,
with private provenance detail behind owner access. An immutable input record binds source/lock,
toolchain and authorization; its digest enters the canonical core. A separate controlled output
attestation binds that input record to release ID, artifact hashes and attempt outcome. The output
attestation is outside the release hash preimage, avoiding a cycle between a manifest hash and a
record that hashes the manifest. Hashing a self-authored manifest proves byte consistency, not
authorized provenance. A retained source plus lock and independently recomputable/controlled
records are the proposed first-party proof; signing and third-party verification can follow
demonstrated need.

Proposed interfaces:

| Interface | Input → output | Boundary |
| --- | --- | --- |
| Capture build input | owner + exact accepted F2 source ref + authored Experience selection + profile → immutable, hashed source/resource lock or typed failure | Authenticated build side; no “latest” resolution after capture. Only the accepted F2 source adapter is admitted for live releases; no legacy saved-version exception. |
| Lower release | frozen source + exact lock + profile/toolchain → prepared descriptors + trace map + closure requests or diagnostics | Pure, no DB, R2, browser globals or editor state; domain-owned compiler/evaluators do the semantic work. |
| Close and record build | descriptors + verified bytes → immutable release and controlled provenance record | Bounded IO, hash/size/type verification; no publication switch on partial success. |
| Read prepared release | untrusted envelope/artifacts + supported capability set → validated prepared bundle or typed unsupported/corrupt/invalid result | Runtime-safe delivery codecs only. Hydrate maps and renderer objects after validation; no source decode fallback. |
| Instantiate session | validated bundle + selected Experience/semantic entry + host policy → detached session + dispose | Runtime invocation identity, Camera engine and per-release resource scopes; no shared mutable authoring state. |
| Activate / Unpublish | owner + Experience pointer + expected publication revision + release/entry → new pointer revision or conflict | One short transaction; verify release ready, ownership, membership and entry. Recheck input locks if the activation policy requires freshness. Exact old source revisions may publish deliberately. |

Typed failures should distinguish invalid source, unresolved executable binding, unsupported
capability, closure failure/corruption, stale pointer, unauthorized, missing/removed entry and
unsupported release format. Authored repairable drafts can save under future F rules; executable
closure must reject a required unresolved binding before activation. Visitor errors stay visible
and retryable where appropriate; no partially installed scene. S01 also sets bounded counts,
per-resource and aggregate byte limits, reference depth and decode policy for this profile, so a
valid-looking manifest cannot cause unbounded preparation or visitor allocation.

## Persistence and delivery proposal

Retain Postgres metadata and private object storage. No new service or job queue is necessary to
prove a bounded synchronous build; measure size/duration before introducing worker infrastructure.

- Add immutable **prepared releases** keyed by independent release ID, containing the envelope and
  artifact digests. Keep source references for provenance without joining source on anonymous reads.
  One source revision can produce several selections, profiles or compiler outputs.
- Record build attempts separately from canonical release content. Ready status follows verified
  durable artifacts; a failed attempt may remain inspectable but cannot be activated.
- Retain immutable resource objects by content hash with private storage-locator mappings. A
  release pins bytes independently of mutable asset/catalogue rows. Do not delete pinned bytes
  during asset cleanup; candidate garbage collection follows explicit reachability/retention rules.
- Give each published Experience a pointer with `(project, experience identity)` uniqueness,
  stable public ID, nullable active release/entry, and monotonic revision. A release can be referenced
  by multiple pointers; activation verifies selected-Experience membership. Multi-pointer atomic
  publication is deferred unless the first profile actually needs it.
- Owner preparation could be `POST /projects/:id/release-builds`; activation/status/Unpublish could
  be scoped under `/projects/:id/experiences/:experienceId/publication`. Exact routes and request
  schemas are S01 proposals, not changes to the current API. Initial tests/CLI can call them.
- Keep `/p/:publicationId` as the visitor entry. Anonymous metadata resolves its pointer **once**
  to release ID, selected Experience and entry. Fetch remaining artifacts by that pinned context;
  concurrent Update cannot mix releases. Resource authorization checks publication membership as
  well as content identity; a hash URL alone must not bypass Unpublish.
- An already-started visit may finish fetching its pinned prior release after an Update, while the
  pointer stays published. Unpublish denies managed manifest/artifact/resource reads for every
  version. Preserve `no-store` and omit storage keys on all public responses. Re-publish reuses
  public identity and increments revision; no-op activation does not. Downloaded copies and already
  decoded in-memory data cannot be revoked.
- Verify artifact and resource hashes in the visitor, including shipped assets. Material/model
  rendering uses prepared definitions and a release-owned resolver; it never falls back to a live
  catalogue or default unscoped texture cache. Runtime decoder dependencies are part of the
  declared compatible runtime/toolchain, with no unpinned network fetch.

## Exact dependencies and work that can run in parallel

All versions/scopes are proposed. The [shared readiness amendment](../../archive/roadmap/coordination-2026-10/cross-track-execution-2026-10-23.md#capability-readiness-amendment)
adds Accepted capabilities to the gate row and Requires to consumer rows. Each exact scope/prerequisite
must be accepted in current HEAD and trusted base; overall gate acceptance alone is insufficient.
Pending extensions never count as ready. One provider per gate/version remains: F1/F3 T1 S01,
F4 T1 S03, F2 T3 S01 and F5 T4 S02. T4 adds F1 public-address conformance, not another F1 provider.

F5's actual F2 dependency is T3 S01's **shared ExecutionProgram codec/identity**. It is not a reason
to wait for T3 runtime/source activation. F3 is real here because the supported program uses typed
Camera channels/ownership. Simple T2 transforms do not inherit that dependency. T4 never consumes
T1 viewport or whole-track completion. Static domain projection/closure research can proceed now;
implementation requires the landed r186 base and accepted precise interfaces before their consumers start.

## Candidate slice sequence

All candidate IDs remain unregistered/proposed. No gate, authorization or phase status changes here.
Base and extension requirements include their prerequisite closure in the coordinated proposal.

| Candidate | Consumes | Requires (proposed capability field) | Bounded result and verification |
| --- | --- | --- | --- |
| T4.P01.S01 | — | — | Docs-only F5/profile/DTO/SQL/API specification using T3's shared program and source-first activation. Can proceed now; creates no format code and ratifies nothing. Planning/docs + arch checks. |
| T4.P01.S02 | F1.reference@1, F2.unit-envelope@1, F3.channels@1 | F1.reference@1:references-v1, F2.unit-envelope@1:unit-envelope-v1, F3.channels@1:inspection-v1 | Sole F5 provider with prepared-envelope-v1; extend F1 release-addresses-v1. Shared codecs/canonicalization reuse T3's ExecutionProgram codec. Architecture-integration; no public switch. |
| T4.P01.S03 | F1.reference@1, F2.unit-envelope@1, F3.channels@1, F5.release-envelope@1 | F1.reference@1:release-addresses-v1, F2.unit-envelope@1:unit-envelope-v1, F3.channels@1:camera-handoff-v1, F5.release-envelope@1:prepared-envelope-v1 | Offline unit lowering, closure, canonical program/Camera trace parity and independent reader using accepted T3 S03 primitives, without live cutover. Architecture-integration. |
| T4.P01.S04 | F1.reference@1, F2.unit-envelope@1, F3.channels@1, F5.release-envelope@1 | F1.reference@1:release-addresses-v1, F2.unit-envelope@1:unit-envelope-v1, F3.channels@1:camera-handoff-v1, F5.release-envelope@1:prepared-envelope-v1 | Inactive DB/storage/API preparation and migration rehearsal. Real coordinator/temp fixtures; no fake production accepted revision/pointer. Production build admission waits for actual accepted/saved F2 source after T3 S04. Architecture-integration; real Postgres zero skips. |
| T4.P01.S05 | F1.reference@1, F2.unit-envelope@1, F3.channels@1, F5.release-envelope@1, T3.camera-experience-cutover@1 | F1.reference@1:release-addresses-v1, F2.unit-envelope@1:unit-envelope-v1, F3.channels@1:camera-handoff-v1, F5.release-envelope@1:prepared-envelope-v1 | Atomic prepared API/artifact/resource/pointer/browser activation and source snapshot delivery retirement. Sole T4.prepared-reader@1 provider; never consumes itself. Exhaustive final gate with DB/browser and actual inventory. |

The eventual registered rows retain separate `Consumes` gate versions and exact `Requires`
capabilities, including their declared prerequisite closure; capability names are not new gates. S02 does not consume its own
F5/public-address outputs. S04 storage-schema preparation can run alongside S03; its build harness follows S03 exports.
S01's specification and S02–S04 narrow tiers integrate through S05's
exhaustive final gate; every implementation PR still owes the full repository merge contract.

**Proposed FINAL PHASE GATE:** T4.P01.S05. Only API→immutable resources/program→cold browser
replacement can accept it; an offline parser pass cannot. Acceptance makes the phase closable,
not closed. No phase/track/Baseline closure follows automatically.

T3 owns source/Save and visitor semantic modules through its S04. T4 coordinates inactive storage
work, then owns delivery/publication changes and reuses the shared interpreter. Rebase/review
against each actual main before overlapping caller edits; do not merge competing visitor models.
T1's cycle window stays selected/unopened until its listed authorized slice starts. Unrelated T4
work neither configures it nor waits for its verdict. The landed r186 base (`74efb98b`) applies to all capability work.

## Migration, cutover and rollback

1. **Inventory and freeze scope.** At execution time, count actual publication/release/source rows,
   active pointers, resource pins and in-flight writers, coordinated with T3's source inventory. Back up
   metadata and retained bytes. T3 S04 owns authored-source conversion/activation; T4 owns delivery.
   A publication gap requires verified inventory and explicit owner acceptance before T3 activation.
   Confirm whether the empty-release owner statement still holds. If it does, migrate an empty
   delivery population; do not invent historical reader support. If not, name the specific covered
   versions and rehearse a bounded conversion while their source tooling still exists.
2. **Stage candidates without activating them.** Add prepared tables/artifacts and compile exact
   covered versions. Only if actual covered releases require a ratified exception, persist an explicit old
   `(project, version, public ID)` → prepared `(release, authored Experience, entry)` recovery mapping.
   Reuse T3's sole source conversion; this is bounded covered-publication migration, not the removed
   default legacy Experience selection map. Without that approved disposition, T3 activation waits. Verify identities, closure, hashes and
   old-visible behavior. Never rewrite an old immutable release in place or silently reinterpret it.
3. **Use one coordinated delivery barrier.** Briefly fence publication mutations and drain old
   API instances; complete delta conversion; verify all active pointers can resolve prepared data.
   Deploy the prepared API and browser route as a compatible pair, switch pointer authority and
   reopen traffic only after smoke checks. With no durable releases, a short maintenance barrier
   is simpler than maintaining two protocol authorities. Exact host/deployment steps are an S05
   preflight decision, not assumed infrastructure in this proposal.
4. **Retire all authored delivery callers in that cutover.** Remove `readPublicRelease`'s source
   join/validator, browser source preparation/`composeColdReleaseBundle` delivery use, source-version
   publication insertion/activation. Verify that T3's legacy-order retirement remains intact; do not
   reintroduce it in the prepared visitor.
   Preserve authored Save/Load and build-side validation. Rehome or delete old cold helpers only
   after inspecting all callers. A small projection adapter to existing render components can live
   at the prepared boundary, with no validation fallback and a named retirement condition if temporary.
5. **Do not use per-request fallback or dual writes.** No “try prepared, then source”; no format
   dispatch that reactivates the authored reader; no second writable active pointer. A staged codec
   and offline harness are not an additional runtime authority. Any historical URL alias, if actual
   covered traffic requires it, resolves only the converted prepared release and has an explicit
   removal condition. Old JS clients need an explicit incompatible-protocol/refresh outcome; a
   no-store API header alone does not evict already-loaded browser code.
6. **Rollback before barrier release** restores the prior application/pointer authority together,
   while candidates remain inert. After prepared activations, prefer the previous compatible
   prepared runtime or pointer to a prior prepared release. Do not send prepared rows to the old
   snapshot application. A return to source delivery would require a separately approved, fenced
   reverse migration accounting for every new activation; it is not an automatic fallback. Restore
   pointer targets with a new revision to prevent ABA, rather than resetting concurrency tokens.
7. **Retention and Baseline.** Keep source/lock/build records needed for verification and pinned
   resources needed for delivery/rollback. Collect unreferenced candidates only after a declared
   retention boundary. Before an intentionally durable external release, reconcile and declare
   the separate Release Baseline: supported profiles, support window, security patch/deprecation,
   retention, managed revocation and compatibility policy. This phase does not declare either
   Baseline, and the Source Baseline is not a prerequisite for release mechanics.

## Acceptance and evidence required by the implementation plans

| Proof | Acceptance / defect caught |
| --- | --- |
| Deterministic build | Compile the same canonical input/lock/selection/profile/toolchain twice with different clock/attempt IDs; byte-compare canonical core/artifacts and release ID. Change one source/resource/profile/compiler input and show the resulting identity changes appropriately. No hidden current catalogue or environment state. |
| Independent release identity | Build the same source version for two selections or profiles without PK collision; preserve an earlier release while producing a new compiler output. Updating source format or live source name cannot mutate old release bytes/meaning. |
| Independent reader | Load a recorded prepared fixture after source codec/validator and live catalogue modules are made unavailable in the reader dependency closure; playback still works. Inject a forbidden direct, transitive or dynamic import and require the boundary/build proof to fail. Package-root tree-shaking alone is insufficient. |
| One Camera engine | Compare compiled-payload route samples with the canonical engine for forward/reverse framing, endpoints, FOV, joins, target-only travel and supported timing. Test reduced motion, zero-node entry and disconnect failure. A second pose/FOV evaluator or route graph is forbidden. Preserve existing dense Camera invariants; do not replace them with two happy-path samples. |
| One editorial authority | Prepared visitor next/back follows program occurrences, including two distinct Stops referencing one View and two distinct runs of one Stop. Contradictory source/node-order fields cannot influence the prepared runtime. No separate conversion-map writer or program interpreter is created. |
| Executable closure | Missing View/subject/asset binding blocks activation with explicit diagnostic. Missing, same-length-corrupt, wrong-type, oversized and nested-external GLB/texture cases fail before installing a scene. Test default shell materials and fallback-only catalogue entries too. Hash verification covers actual downloaded bytes. |
| Version/capability negotiation | Unsupported format major, required profile, program kind, state type or capability fails explicitly. Unknown optional extensions are ignored only where declared safe. Golden prepared fixture survives a supported runtime security update without authoring tooling. |
| Provenance | Recompute source/lock/artifact hashes against retained controlled build evidence; tampered output, mismatched source, fabricated record or unauthorized source linkage fails. Public projections leak no object key, credentials or unauthorized source detail. |
| Real-DB lifecycle | Prepare/activate/update/unpublish/republish; status creates no ID; same-release activation is a no-op; stale/ABA/concurrent writers get conflict; failed preparation/activation leaves prior release active. Owner/stranger/guest and cross-Experience membership checks remain enforced. |
| Coherent delivery | Resolve one release then update pointer during artifact fetch: no mixed versions. Old pinned bytes remain available while published; Unpublish disables every managed metadata/artifact/byte route, including aliases. No-store and private storage mapping remain intact. |
| Session isolation/lifetime | Two releases with colliding logical asset IDs use separate caches and state. Route switch/Back/Forward/abort prevents stale install, partial URLs are revoked, disposal is idempotent and no editor globals or source writes appear. |
| Migration and rollback | Rehearse empty and non-empty populations on temporary Postgres/storage fixtures; conversion is restartable, mapping is explicit, publication ID continuity is proven, interruption before switch leaves old authority intact, and post-switch rollback uses a compatible prepared runtime/pointer. Mutation controls catch an old snapshot reader or duplicate active-pointer writer reintroduced into the public path. |

Existing suites protect each current path until its owning T3 semantic or T4 delivery cutover.
During an approved publication gap, exercise explicit refusal with a real /p/ route; do not retain
old editorial code merely to keep an old fixture green. Change fixtures/expectations only where
the successor catches the same defect. Extend the owning publication/visitor suites
and import-closure helpers instead of adding a duplicate parser or test framework. Preserve the
real `/p/` root so the public-surface build gate cannot pass vacuously. Also prove API anonymous
read separation; visitor chunk isolation alone does not catch server-side source revalidation.

The [test contract](../../../apps/editor/tests/README.md#what-a-change-requires) owns commands and
tier details. Documentation/planning verification is docs + architecture gates. Implementation
integration must include editor fast/arch/heavy correctness, editor build/check, affected shared
package checks, and separate API check/build/test with reachable Postgres and **zero skips**;
record the DB target and exact tested revision/diff. The T4 runbook requires fresh DB-backed
evidence at its implementation gates. Browser evidence covers a cold public link, error/retry,
motion preference, navigation and two-release isolation. Focused results are iteration evidence,
not inherited final acceptance; no existing CI or benchmark automation is presumed.
Every implementation PR still runs the complete required merge gate before merging, including
S02's provider before downstream slices consume it. A narrowed intermediate tier does not defer
that merge obligation to S05; S05 also owes the integrated exhaustive result.

## Decisions to reconcile before dependent implementation

| Decision | Recommended owner ratification |
| --- | --- |
| Shared provider/readiness | Adopt the [coordinated matrix](../cross-track-execution.md) and Accepted-capabilities / Requires rule; one gate provider, capability-specific accepted evidence on trusted base. |
| F5/program | T4 S02 provides one prepared envelope/profile using T3 S01's ExecutionProgram codec and S03's sole interpreter. Support the bounded semantics above; unsupported required behavior refuses. |
| Accepted input | Source-first accepted/saved F2 units and authored Experience selection. No default legacy saved-source admission, retained selection map or separate Experience identity adoption. |
| Domain delivery | Canonical Layout compiler, Scene/resource descriptors and Camera evaluation remain domain-owned; delivery DTOs freeze sufficient values/bytes and avoid live catalogue dependencies. |
| Activation/covered data | Actual source/release inventories, backups/refusal coverage/quiescence/recovery and converter retirement precede live transitions. T3 owns source/runtime; T4 owns prepared public barrier. Gap only after verification and explicit owner acceptance; covered releases need a concrete disposition first. |
| Product/durability | API-driven foundation, then T4-owned thin publication UI; T2 owns model ingest before the promised trial. Agree disclosure/retention and Release Baseline before durable external use; do not imply Source Baseline. |

The next independent review checks all four revised proposals together; owner ratification and
registration follow separately. No implementation, live gate/lifecycle/cycle change or Baseline is
made here. First capability implementation waits for the separately landed r186 base (`74efb98b`).
