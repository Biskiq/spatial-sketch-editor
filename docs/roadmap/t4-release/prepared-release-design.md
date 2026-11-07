# Prepared release design

**Status:** substantive future delivery proposal; not a shipped capability or an activated public reader.
Core Product Stability is accepted at PR #271 (`ce4e232c`). Its accepted visitor Preview is distinct
from public publication. F and the owning domain contracts govern this proposal; concrete release
interfaces and activation remain owner decisions under the [workflow](../../workflow.md).

Build from accepted F2 source, selected Experiences and a delivery profile using the shared
Experience lowering/interpreter and canonical Camera authority. Current public reads remain
unavailable until the prepared reader is implemented and activated. Revalidate historical code
names and actual deployed data before implementation; no destructive migration is authorized here.

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

Prepared-delivery verification compares route samples/traces with the canonical Camera engine and shared Experience interpreter.
Intrinsic directed timing is consumed deliberately; the retained old public controller's missing
getCameraMotionOptions call is baseline evidence, not a playback policy to preserve in new releases.
Neither T3's new source schema nor release encoding may silently reinterpret an existing release.

## Interface proposals for reconciliation

These are proposed shapes and boundaries, not a new shared contract. Names and numeric versions
remain provisional until the owning contract explicitly admits them. Separate concerns before choosing
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
| Release schema / payload / profile versions | Independent semantic compatibility declarations, including required capabilities; not the saved version or coarse npm package version. Independent of the installed Three.js version (landed base 0.186.1): a renderer/runtime update changes the Reader/runtime build identity and its supported-format matrix, never an existing release's bytes or meaning; a golden-fixture survival probe proves it |
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
and retryable where appropriate; no partially installed scene. The release specification also sets bounded counts,
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
  schemas are proposals, not changes to the current API. Initial tests/CLI can call them.
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

## Migration, cutover and rollback

1. **Inventory and freeze scope.** At execution time, count actual publication/release/source rows,
   active pointers, resource pins and in-flight writers, coordinated with T3's source inventory. Back up
   metadata and retained bytes. The source owner controls any required source activation; release work owns delivery.
   A publication gap requires verified inventory and explicit owner acceptance before T3 activation.
   Confirm whether the empty-release owner statement still holds. If it does, migrate an empty
   delivery population; do not invent historical reader support. If not, name the specific covered
   versions and rehearse a bounded conversion while their source tooling still exists.
2. **Stage candidates without activating them.** Add prepared tables/artifacts and compile exact
   covered versions. Only if actual covered releases require a ratified exception, persist an explicit old
   `(project, version, public ID)` → prepared `(release, authored Experience, entry)` recovery mapping.
   Use one explicitly approved source conversion only if actual covered data requires it; do not invent a legacy Experience selection map. Without that approved disposition, T3 activation waits. Verify identities, closure, hashes and
   old-visible behavior. Never rewrite an old immutable release in place or silently reinterpret it.
3. **Use one coordinated delivery barrier.** Briefly fence publication mutations and drain old
   API instances; complete delta conversion; verify all active pointers can resolve prepared data.
   Deploy the prepared API and browser route as a compatible pair, switch pointer authority and
   reopen traffic only after smoke checks. With no durable releases, a short maintenance barrier
   is simpler than maintaining two protocol authorities. Exact host/deployment steps are an activation preflight decision, not assumed infrastructure in this proposal.
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
record the DB target and exact tested revision/diff. Implementation requires fresh DB-backed evidence. Browser evidence covers a cold public link, error/retry,
motion preference, navigation and two-release isolation. Focused results are iteration evidence,
not inherited final acceptance; no existing CI or benchmark automation is presumed.
Every implementation PR runs the complete required merge gate; focused results never substitute for integrated acceptance.
