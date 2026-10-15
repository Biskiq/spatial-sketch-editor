# T4 first-phase proposal — prepared release foundation

**Status:** track-local proposal for review, 2026-10-14. No phase or slice is registered or
authorized by this document. Candidate IDs below describe sequence only. No F amendment, gate
version, shared contract, capability implementation or Baseline is established here.

**Recommendation:** bound the first phase around compiling the current supported project data
into one narrow prepared-visitor profile, persisting releases independently of source versions,
and replacing the public authored-snapshot reader in one coordinated cutover. Start with a
documentation-only interface and lowering specification (candidate S01), then obtain the exact
foundation amendments/providers before implementing their consumers. Publication authoring UX is
a later phase; an API-driven preparation → activation → cold visitor loop is sufficient here.

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
| Source persistence | `packages/project-model/src/project-codec.ts` strictly validates `{ id, name, layout, scene }`; Layout is wall-first format 5, Scene world-local format 1. `apps/api/src/project-persistence.ts` saves append-only numbered versions under a project row lock. Save has no expected-base revision. | Use an exact saved version and canonical content hash as current-source build input. Do not treat the Save API as landed F.4 acceptance. No historical generation detector or compatibility reader returns. |
| Publication persistence | `apps/api/migrations/003-publications.sql` makes `publications.project_id` the primary key; `active_version` selects a release keyed by `(project_id, version)`. A `releases` row physically stores **only the asset manifest** and references `project_versions`. | The roadmap's shorthand “snapshot + manifest in releases” describes delivery logically. The document is actually joined from `project_versions`; a new prepared release must be self-sufficient at read time. Record this precision here; do not rewrite shared contracts before their cutover. |
| Owner API | `apps/api/src/publication-persistence.ts` retains status, Publish/Update and Unpublish. Preparation validates and compiles Layout, checks references and hashes new R2 pins outside the transaction. Activation checks owner, publication revision and asset pins under locks. Status allocates no public ID; ABA increments revision; an exact older saved version can be selected. | Keep short activation transactions and OCC. Compilation and resource work stay outside them. A publication revision is not a source revision. |
| Anonymous API | `readPublicRelease` joins the active saved document and revalidates it with deployed `validateProject`. `readPublicReleaseAsset` uses version-qualified pins while the publication is active. `apps/api/src/app.ts` sends `no-store`, omits object keys, and disables all versioned byte delivery when unpublished. | Remove the source join/validation from the delivery path at cutover. Retain coherent bootstrap, private storage locators, revocation behavior and `no-store`. |
| Cold browser bootstrap | `public-release-client.ts` fetches metadata and version-qualified P20 textures, verifies MIME, length, bounded body and magic, then invokes `composeColdReleaseBundle`. `visitor-cold-runtime.ts` calls `prepareRuntime`; that calls `validateProject`, canonical Layout compilation, Scene resolution and graph creation. Route aborts and disposal prevent stale installs and leaked URLs. | Strict does not mean prepared or independently versioned. Retain cancellation and scope lifetime behavior while replacing the source-dependent preparation. |
| Current resource guarantee | New publication preparation checks P20 hashes. Public asset projection exposes asset ID/MIME/size, **not SHA-256**; browser download has no hash comparison. Static model/material references pass a retained registry. | Add end-to-end hash verification and actual immutable closure. A static allowlist or registry version is not a content lock. Existing release reuse does not rehash all bytes. |
| Render path | Generic visitor entities, Layout shell, materials, texture scopes and model loader remain. `AssetModel.svelte` reads the deployed `getAsset`; `MuseumMaterial.svelte` reads deployed `getMaterial`. Layout rendering consumes compiled junctions/walls; the shell also uses default materials. | Removing the source validator alone would leave deploy-dependent appearance. Prepared descriptors must supply model/material definitions and implicit shell resources, not merely wrap IDs in a manifest. |
| Camera and visitor state | `@portfolio/camera-core` owns graph routing and motion. `VisitorCameraDirector.svelte` calls `getCameraRoute`, `createCameraMotion`, `sampleCameraMotion`. Visitor state still derives order from node links; zero-node projects use neutral orbit. | Reuse Camera route/motion evaluation. Move delivery navigation decisions to the prepared program; do not leave node links and program order as competing runtime inputs. |
| Removed capabilities | Publication client/presentation, editor preview/publish routes, package ZIP orchestration and authoring asset upload/load wiring were removed. Low-level project/asset API client helpers and server assets remain. The frozen Chopin project is outside the repository. | Do not plan around a reusable publication panel or editor preview session. Rebuilding general ingest belongs to T2; native editable import/export is separate work. |

The strict reader, `/p/[publicationId]`, real-Postgres API tests and public import-closure plugin
are retained deliberately, not leftovers to delete early. Existing guards include
`visitor-cold-runtime.test.ts`, `visitor-public-route.test.ts`, `visitor-identity-isolation.test.ts`,
the public/preview Vite boundary suites and `apps/api/tests/publication.test.mjs`.

The owner-stated covered-data ledger is empty and there are no product releases. This permits a
small migration strategy; it is not a live database audit, nor permission to discard newly created
data. Do not create another ledger. Recheck actual rows and bytes before cutover.

## Proposed first phase and its limit

Candidate phase name: **T4.P01 — Prepared release foundation**. Its completed outcome would be:
an exact current-format saved version and explicit Experience selection compile reproducibly;
an immutable prepared package and verified resource closure persist; an owner activates a selected
Experience pointer with OCC; `/p/:publicationId` loads that prepared package in a detached session;
the old API/browser snapshot reader and publisher are retired together.

Initial profile proposal: **static world + manual guided Camera navigation**, one selected
Experience per build initially, while the envelope and storage support a collection and
per-Experience pointers from the start. A neutral zero-camera entry is supported explicitly.
Use a small fixture set: empty project; physical curved walls/junction/opening plus primitive;
connected two-way Camera travel with directional framing; a shipped GLB and catalogue material;
P20 texture; two independently published selections. These are architecture fixtures, not proof
of a restored creator journey.

Reject unsupported source meaning with a path and capability diagnostic. In particular, cycles,
detours, ambiguous/nonreciprocal order, inaccessible locked entry, nontrivial holds/continuation,
or other editorial semantics cannot be silently flattened. S01 must decide which can be supported
truthfully by the narrow profile and which fail compilation. Current stored timing/hold fields
and behavior actually exercised by the public controller are not necessarily identical:
`VisitorCameraDirector` does not currently pass `getCameraMotionOptions` into `createCameraMotion`.
Preserving realized playback and defining newly supported timing are separate acceptance claims,
to reconcile with T3 rather than silently changing motion during packaging.

F.5's program slots remain present and versioned. Propose the smallest meaningful profile:
occurrences and manual order; explicit Camera invocation; literal guards; typed initial session/run
state with reset; identity local-time mapping; one exclusive Camera contribution; run-scoped
enter/complete/cancel events. No arbitrary expressions or effects. Non-empty conformance examples
must exercise initialization, guard failure, reset and separate invocation identity. Empty arrays
alone do not prove those semantics. The exact minimum, including any bounded operator subset,
requires F/T3 reconciliation; T4 does not invent a separate Experience language. If that minimum
is not accepted, keep lowering experiments offline and block activation, rather than silently
weakening F or waiting for the entire performance engine.

**Outside this phase:** publication panel, draft/save/publish choreography, share dialog and link
polish, editable ZIP import/export, general asset ingest, localization authoring, configurable
publication UX, embedding/SDK, film/still output, live data, collaboration and audience records.
The package still needs explicit visitor meaning, motion policy and semantic entries for its
supported content. Deferring authoring UX does not excuse a broken visitor or missing failure UI.

## Lowering current data into prepared data

The proposed build is a pure semantic pass over a frozen input, followed by verified resource IO
and persistence. Do not serialize `RuntimeScene`, `NavigationGraph`, compiled geometry or a
Three motion object blindly as a durable schema.

| Build input | Proposed delivery representation | Authority and checks |
| --- | --- | --- |
| Saved current-format document | Private retained source reference/hash; no full editable document in public payload | Validate once on the build side using the current codec. Pin adapter/toolchain revision. A source provider for later F.2 units can replace this input adapter without changing the delivery reader. |
| Wall-first Layout | Versioned renderer-neutral Layout payload: floors, room polygons, physical walls, openings, compiled junction ends, objects and bounds required by the visitor | Derive through `compileWallFirstLayoutGeometry` only; fail blocking issues. Use a deliberate DTO projection and validation, with source correspondence. Renderer mesh allocation over these facts remains runtime work; topology reconstruction or source compilation does not. Do not require T1's future viewport projection to deliver this static profile. |
| Scene entities and materials | Flat world transforms, primitives/lights, explicit material values/texture bindings and model descriptors | Preserve meaningful IDs/transforms; omit editor-only clusters and redundant derived `objects`. Catalogue definitions, fallback dimensions, tile metrics, model scale/shadows and shell defaults are frozen build inputs. Capture lighting/background/fog/plinth defaults as presentation data or exact versioned profile semantics; they cannot track a changing shell implicitly. Preserve or reject scale limitations explicitly. |
| Camera nodes/connections | Prepared view/connection descriptors with resolved world poses, generated endpoints, directional framing and route inputs | Current Scene resolution supplies starting evidence. Project only Camera-owned fields. Rehydrate lookup maps locally; validate endpoint continuity, finite values, IDs and references with the delivery codec. Keep the single `camera-core` route and motion implementation. |
| Node editorial fields | A derived Experience selection, Presentations, distinct Stop occurrences, entry and guide policy | Build-time conversion only, under the agreed current-data mapping. Output contains no second writable order. The new visitor state reads program occurrences; the Camera graph supplies connectivity, never editorial next/back. |
| Texture/model/catalogue dependencies | Content-addressed resources with hash, size, media type and explicit dependency edges | Include P20 bytes, shipped GLBs, nested GLB dependencies, catalogue textures and implicit shell/default resources. Reject unclosed external references, session/package URLs, missing or corrupt bytes. A fallback-only catalogue asset becomes an explicit declared primitive fallback; a failed required GLB does not silently become one. |
| Generated subjects and entries | Release-qualified source mapping and public semantic address table | Preserve subject/instance identity; qualify generated geometry with generation/source mapping. Do not use labels, order indices or nearest geometry as identity. |

Current source has no Experience unit. Preferred proposal: a **retained conversion selection map**
allocates a stable Experience identity per selected current-project scope, and stable generated
Presentation/Stop identities keyed by the preserved source Camera node identity and role. The map
is an explicit, hashed build input, reused across source revisions. It is delivery conversion
metadata, not an authored Experience unit or an alternative editable project format. Generated
lineage must remain visible; do not pretend these are pre-existing authored Stops. Release hashes,
display names and array offsets never mint those stable identities.

T3 must agree how later authored Experiences adopt or replace those identities, including removed
subjects and intentional replacement. An incompatible replacement reports removed/repair-required;
it does not silently retarget old links. Repeated Visits get distinct runtime invocation IDs, and
repeated Stops get distinct occurrence IDs even when referencing one Presentation/View. A future
T3 source provider supplies its own accepted identities and order directly; the converter must not
run after that ownership cutover.

`getCameraRoute` already routes over explicit connections without needing editorial node links,
and `camera-core` accepts a structural graph without importing `project-model`. There is therefore
no demonstrated need for a new Camera engine or for the whole T3 cutover to prepare current-data
playback. The prepared Camera graph can omit next/previous/hold/detour fields; the program chooses
intent, Camera resolves and evaluates it. Route choice ordering must be deterministic for graphs
with alternative paths. Reconcile exact timing and invocation semantics with T3 and use existing
Camera-owned primitives; do not write a T4 interpolation algorithm or bake an independent pose
sampler. Curves, maps, GPU objects and live controllers are created in memory, never stored.

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
| Source reference | Exact project revision/saved version and canonical content digest; source schema is recorded, not used as release version |
| Build key | Digest of normalized source/selection/profile inputs, dependency lock, adapter/compiler/toolchain identity and build policy |
| Build attempt ID | Operational identity for a controlled attempt and its outcome; retry timestamps are outside deterministic package bytes |
| Release ID | Content identity of the canonical release core and its artifact/resource hashes; same inputs with deterministic output produce the same release |
| Release schema / payload / profile versions | Independent semantic compatibility declarations, including required capabilities; not the saved version or coarse npm package version |
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
| Capture build input | owner + exact source ref + selection map + profile → immutable, hashed source/resource lock or typed failure | Authenticated build side; no “latest” resolution after capture. A current-format adapter must be explicitly admitted as an accepted input, not mislabelled as F.4. |
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

All versions below are **requested first-major candidates**, not present gate records. The final
reviewed slice plan must use the versions actually accepted at its trusted base, not “F.5 ready”.

| Dependency | Needed for | First-phase treatment |
| --- | --- | --- |
| `F5.release-envelope` | Persisted envelope, profiles/program slots, reader negotiation and cutover | Mandatory. S01 drafts; a separately accepted provider implements shared exports/conformance before consumer slices begin. Proposed version 1 is not readiness today. |
| `F1.reference` | New stable Experience/Stop/public addresses, revision qualification and traceability | A genuine shared-interface dependency. Reuse its accepted exact version. If no provider is assigned, propose the minimal shared provider with F ownership; do not invent T4-local reference strings. F.5 must identify its F.1 dependency. |
| `F2.unit-envelope` | Reading new split source units | Not needed merely to read the retained current-format snapshot through an explicitly admitted adapter. Needed before accepting future F.2 source envelopes; do not introduce an imitation source envelope in T4. |
| `F4.intent-acceptance` | Claiming F.4 accepted revisions or issuing compound authoring intents | Not needed to hash an immutable saved version or OCC-switch a publication. F owner must decide if the current saved-version adapter is an admissible first release input. If not, durable activation waits for an accepted revision provider. |
| `F3.channels` | Persisting new typed channel addresses/operators or dynamic representation effects | Do not invent them in the static profile. If the ratified minimum program introduces those exact shapes, its provider becomes a real prerequisite. Static exclusive Camera execution is not permission to mint an alternative channel format. |
| `T1.viewport-projection` | Editor viewport integration | No dependency for cold static delivery. Future dynamic architectural representation consumes T1's runtime-safe representation interface and F.3, not editor inspection tools. |
| T2 resources/Scene | New resource kinds, ingest or Scene semantics | Current texture registry and catalogue are enough for the bounded profile once bytes/definitions are closed. Require a domain lowering contract and fixtures only when a new capability is admitted, not completion of T2. |
| `T3.camera-experience-cutover` | Consuming the new Camera/Experience units and retiring source node-order writers | Not inherently a prerequisite for agreed current-data conversion. T3 must reconcile stable identities, program semantics and later handoff. If conversion is rejected or new T3 source already replaces current source, use its accepted exact interface/cutover; never race a second writer. |
| `T4.prepared-reader` | Declaring the delivery replacement complete | Output gate of final integration, not a prerequisite the cutover slice claims to consume itself. Its accepted evidence must include API + visitor atomic replacement. |

Immediately parallel planning: exact F.5/F.1 draft, current-data support/mapping tables, resource
closure inventory, DTO projection design, SQL migration design and isolation/test design. After
accepted interfaces: pure compiler/resource closure and an offline prepared-reader harness can be
developed in parallel, alongside storage preparation. No offline harness is reachable from public
production routing before cutover, and no feature-local persistent format is used while waiting.
Work touching the same API publication module or T3 visitor state needs a named integration owner
and coordinated merge order, even when it has no gate dependency.

The architecture cycle currently selects an unopened T1 spatial-foundation window. Its phase
planning hook belongs to T1; unrelated T4 envelope work does not configure or open it. Follow the
runbook's eligibility/start check once real slices are approved. Gate acceptance must already be
at `git merge-base HEAD main`; changing the register in a consumer diff cannot satisfy it.

## Candidate slice sequence

The phase/slice registers remain unchanged. Before registration, expand these rows into reviewed
plans with exact `Consumes`, `Effects`, authorization and acceptance routes. A foundation provider
does not consume the same gate it produces; register at most one provider per gate/version.
If T4 is assigned the first F.1 provider, insert a separate provider slice before S02 and renumber
the actual register. Its acceptance/merge must precede S02; it cannot be hidden inside S02's diff.

| Candidate | Bounded result | Dependency / verification |
| --- | --- | --- |
| **S01 — Interface and lowering specification (recommended first)** | A reviewable F.5 amendment draft plus the release-relevant F.1 interface proposal; concrete input/output examples for the fixture set; exact source selection/identity/order mapping; profile support/rejection matrix; compiler/reader import split; SQL/API proposal; conversion and rollback rehearsal specification. Submit decisions below for F/domain reconciliation. **Docs only, no format or capability code.** | No implemented gate consumed merely to draft. Planning/docs + architecture checks; integration route is the proposed final phase gate. Does not ratify F.5, allocate a gate version or declare acceptance. |
| S02 — Shared foundation provider | Implement only the ratified release schema/profile codec, negotiation, canonical hashing rules and conformance fixtures in shared code; a minimal reference provider is accepted first if F.1 has no other provider. Name exports and review evidence. No public delivery switch. | Separate provider ownership/authorization and ratified amendment required. Consumes the actual accepted F.1 version; provides F.5. Acceptance/merge precedes every F.5 consumer. Architecture integration tier; final integration below. |
| S03 — Compile and read offline | Pure current-source lowering, verified complete closure, controlled provenance linkage, immutable artifact round-trip and prepared reader instantiated through Camera. Freeze payload projections deliberately; test without source validators/live catalogue in the reader closure. Compiler and reader work may proceed in parallel against accepted exports. | Accepted exact F.5/F.1; any actually introduced F.3 shape also needs its accepted provider. Agreed current-data/T3 mapping and minimum program. Architecture integration tier; no public second reader. |
| S04 — Durable preparation and inactive migration staging | API-side build capture/prepare, independent release persistence, retained bytes/provenance, per-Experience pointer schema and migration rehearsal. Failed builds cannot activate. Existing public read/write authority stays intact until the next slice; new pointer staging remains inactive. | Same accepted interfaces; API/storage ownership coordination with T3. Architecture integration tier, real Postgres with zero skips at its implementation gate. |
| **S05 — Atomic public cutover and final gate** | Fence old writers, verify/convert any covered rows, switch API metadata/resources and `/p/` reader together, wire prepared program navigation, remove old snapshot delivery/writer code and live catalogue resolution, prove rollback and release independence. Provides `T4.prepared-reader` with exact exports/conformance/acceptance identity. | F.5/F.1 and any additional real prerequisites accepted at trusted base; S03/S04 integrated. **Exhaustive** final phase verification, including real-DB suites with zero skips and browser evidence. No publication authoring UX. |

Do not mark the phase closable merely because offline reader tests pass. Its **proposed final
phase gate** is the complete API-driven loop on independent releases, atomic retirement of the
authored delivery path, source-validator-free cold playback, provenance/resource verification,
and the acceptance matrix below. Acceptance makes it closable; explicit owner phase closure is
still a separate event. A docs-only review can approve this sequence without authorizing code.

## Migration, cutover and rollback

1. **Inventory and freeze scope.** At execution time, count actual publication/release/source rows,
   active pointers, resource pins and in-flight writers. Back up metadata and retained bytes.
   Confirm whether the empty-release owner statement still holds. If it does, migrate an empty
   delivery population; do not invent historical reader support. If not, name the specific covered
   versions and rehearse a bounded conversion while their source tooling still exists.
2. **Stage candidates without activating them.** Add prepared tables/artifacts and compile exact
   covered versions. Persist an explicit old `(project, version, public ID)` → new
   `(release, Experience, entry)` mapping where needed. Verify identities, closure, hashes and
   old-visible behavior. Never rewrite an old immutable release in place or silently reinterpret it.
3. **Use one coordinated delivery barrier.** Briefly fence publication mutations and drain old
   API instances; complete delta conversion; verify all active pointers can resolve prepared data.
   Deploy the prepared API and browser route as a compatible pair, switch pointer authority and
   reopen traffic only after smoke checks. With no durable releases, a short maintenance barrier
   is simpler than maintaining two protocol authorities. Exact host/deployment steps are an S05
   preflight decision, not assumed infrastructure in this proposal.
4. **Retire all authored delivery callers in that cutover.** Remove `readPublicRelease`'s source
   join/validator, browser source preparation/`composeColdReleaseBundle` delivery use, source-version
   publication insertion/activation, and legacy-order consumption from the prepared public visitor.
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
| One editorial authority | Prepared visitor next/back follows program occurrences, including two distinct Stops referencing one View and two distinct runs of one Stop. Contradictory source/node-order fields cannot influence the prepared runtime. No source writer for the conversion map or program is created. |
| Executable closure | Missing View/subject/asset binding blocks activation with explicit diagnostic. Missing, same-length-corrupt, wrong-type, oversized and nested-external GLB/texture cases fail before installing a scene. Test default shell materials and fallback-only catalogue entries too. Hash verification covers actual downloaded bytes. |
| Version/capability negotiation | Unsupported format major, required profile, program kind, state type or capability fails explicitly. Unknown optional extensions are ignored only where declared safe. Golden prepared fixture survives a supported runtime security update without authoring tooling. |
| Provenance | Recompute source/lock/artifact hashes against retained controlled build evidence; tampered output, mismatched source, fabricated record or unauthorized source linkage fails. Public projections leak no object key, credentials or unauthorized source detail. |
| Real-DB lifecycle | Prepare/activate/update/unpublish/republish; status creates no ID; same-release activation is a no-op; stale/ABA/concurrent writers get conflict; failed preparation/activation leaves prior release active. Owner/stranger/guest and cross-Experience membership checks remain enforced. |
| Coherent delivery | Resolve one release then update pointer during artifact fetch: no mixed versions. Old pinned bytes remain available while published; Unpublish disables every managed metadata/artifact/byte route, including aliases. No-store and private storage mapping remain intact. |
| Session isolation/lifetime | Two releases with colliding logical asset IDs use separate caches and state. Route switch/Back/Forward/abort prevents stale install, partial URLs are revoked, disposal is idempotent and no editor globals or source writes appear. |
| Migration and rollback | Rehearse empty and non-empty populations on temporary Postgres/storage fixtures; conversion is restartable, mapping is explicit, publication ID continuity is proven, interruption before switch leaves old authority intact, and post-switch rollback uses a compatible prepared runtime/pointer. Mutation controls catch an old snapshot reader or duplicate active-pointer writer reintroduced into the public path. |

Existing suites protect the strict path until S05; change their input fixtures and expectations only
where the prepared successor catches the same defect. Extend the owning publication/visitor suites
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

| Decision and owner | Recommended resolution | What remains blocked |
| --- | --- | --- |
| **D1 — Exact F.5 interface/provider (F owner with T4 as first consumer)** | Ratify one envelope/negotiation/canonicalization/provenance amendment and assign one shared provider plus conformance exports. Assign version only through that process. Include the meaningful minimum program/profile, not just reserved empty fields. | S02's shared format implementation until ratification/authorization; S03–S05 until accepted provider at trusted base. |
| **D2 — Reference interface and conversion identity (F.1 owner + T3 + T4)** | Agree shared revision/public address shapes and the retained conversion selection map; stable generated identities, traceability and later T3 adoption/removal policy. Assign/reuse one F.1 provider. | Persisted IDs/addresses, current-data lowering and pointer migration that would otherwise invent identity semantics. |
| **D3 — Accepted input boundary (F.4/F.5 owners + T3/T4)** | Admit exact current-format saved versions plus canonical digest and explicit selection/lock as a bounded build input, clearly distinct from F.4 acceptance. Future F.2/F.4 providers replace capture, not the reader. | If admission is refused, activation waits for an accepted source-revision provider. Do not impose the whole T3 track as a proxy prerequisite. |
| **D4 — Program/Camera handoff (T3 + Camera owner + F owner)** | Agree current node-order conversion, supported hold/lock/detour/cycle cases, manual continuation, invocation lifecycle and timing policy. Keep `camera-core` as evaluator; retire node-order consumption in the prepared visitor. | Any unsupported editorial/timing semantics and final visitor navigation wiring; no second Experience model in T4. |
| **D5 — Domain delivery projections (T1/T2/Camera owners + T4)** | Agree versioned serializable projections and source correspondence for existing compiled Layout, Scene/material/model and Camera data, with per-domain conformance. Retain canonical math; avoid wholesale export of implementation types. New typed channel/resource formats route back to F. | Payloads whose semantics/projections are not agreed; does not block unrelated static DTO or closure work. |
| **D6 — Disclosure, durability and cutover policy (product/release owner + T4)** | Agree provenance disclosure/retention, actual covered rows, stable-pointer conversion, deployment barrier, rollback and protocol refresh behavior. Declare Release Baseline separately before durable external use. | Production switch without inventory/rehearsal; durable external promise without a Baseline. No Source Baseline or publication UX dependency is added. |

The next review should approve or revise this bounded scope and S01, assign the F.5/F.1 amendment
and provider owners, and settle D2–D4 with the source/Experience owners. Only then register a real
phase and slice plans. No shared reference, gate register, baton or capability code changes are
part of this proposal.
