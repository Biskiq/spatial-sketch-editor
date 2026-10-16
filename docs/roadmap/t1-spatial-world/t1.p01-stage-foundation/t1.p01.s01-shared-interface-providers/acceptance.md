# T1.P01.S01 — acceptance record: Shared interface providers

**Slice:** T1.P01.S01 · **Status:** implemented — **no acceptance recorded**; independent review owed ·
**Plan:** [implementation-plan.md](./implementation-plan.md) (owns the criteria) · **Phase:** [T1.P01](../README.md)

No acceptance is claimed. This record carries the implementer's evidence so the reviewer can verify
it; the verdict, the tested-revision confirmation and any gate promotion belong to that review, not
to the implementation diff. The register's `ratified` F1/F3 rows state interface ratification, never
implementation or acceptance.

## Implementation evidence (implementer-reported — not acceptance)

Delivered on base `main` @ `aeb464b2` (PR #125, including merged PR #124), branch
`T1-P1-S1-implementation`. The evidence below was re-run in full for the remediation of the
independent review of `6ec5921c`, on the tree the commit carrying this record contains (the PR
description names that exact SHA); a later edit invalidates the rows it touches.

| Surface | Delivered in |
| --- | --- |
| `F1.reference@1` (`references-v1`) exports | `packages/project-model/src/references/` (shapes, strict validation, resolver host + resolution, frame resolution, generation-qualified correspondence, stable ID ordering) |
| `references-v1` bounded current-domain read adapters | `packages/project-model/src/references/read-adapter.ts` — actual Layout entities, actual Scene entities and read-only current Camera subjects from one supplied `ProjectDocument` |
| `F3.channels@1` (`inspection-v1`) exports | `packages/project-model/src/channels/` (address/descriptor/typed values, the two v1 families including the ratified policy inputs, negotiation, the Camera-output ticket protocol) |
| F1 conformance | `apps/editor/tests/lib/project-model/references-conformance.test.ts` — 33 cases |
| F3 conformance | `apps/editor/tests/lib/project-model/channels-conformance.test.ts` — 21 cases (families, values, owner qualification, exclusive/ordered/union lifecycle, Camera-value reflection) · `apps/editor/tests/lib/project-model/camera-output-conformance.test.ts` — 11 cases (ticket protocol traces plus a depth-5 exhaustive invariant exploration) |
| Accepted-capabilities / Requires enforcement | `capabilityProblems` + the register fields in `apps/editor/tests/docs/parallel-track-gates.test.ts` |
| Runtime-safe import direction | `apps/editor/tests/lib/project-model-boundary.test.ts` (arch lane) walks every file in the package |

```text
npm run check:project-model   tsc -p tsconfig.json --noEmit                                     PASS
npm run check:layout-core     tsc -p tsconfig.json --noEmit                                     PASS
npm run check:camera-core     tsc -p tsconfig.json --noEmit                                     PASS
npm run check                 svelte-kit sync && svelte-check        0 errors, 0 warnings        PASS
npm run build                 vite build                                                       PASS
npm run test:arch             vitest run --config vitest.arch.config.ts   15 files, 137 tests   PASS
npm run test:heavy            vitest run --config vitest.heavy.config.ts   8 files, 118 tests   PASS
npm test                      vitest run (complete suite)               119 files, 1597 tests  PASS
npm run check:api             tsc -p tsconfig.json --noEmit                                   PASS
npm run test:api              node --test (real Postgres)   39 tests, 0 skipped, 0 failed    PASS
```

The API is not edited by this slice, but it imports `@portfolio/project-model` (`validateProject`,
`ProjectDocument`, `SceneDocument`, publication persistence), so §7.4's API rows were run rather
than assumed: `apps/api` type-checks and its DB-backed suite passed against a reachable local
Postgres with **zero skips**, so the publication and auth paths actually executed. Whitespace
(`git diff --check` against base `aeb464b2`, staged/unstaged and worktree) is clean. The arch lane
is the lane that reads the documents this record and the register legend live in, so it was re-run
after the last documentation edit rather than inherited from an earlier green run.

## Scope actually delivered

- Domain-qualified identity, revision, frame and channel addressing with strict validation (unknown
  keys, empty identities, non-finite numbers and unsupported versions reject).
- One shared `references-v1` message/payload domain per authority: `resolved` with the canonical
  subject, its concrete revision and its owner, or `missing | removed | incompatible | unauthorized |
  repair-required` with repair actions offered and no repair performed as a read effect. Resolution
  is evaluated against one supplied accepted snapshot; there is no ambient latest, and no name,
  label, index or proximity fallback exists in the interface.
- **Bounded current-domain read adapters** over the current source, which is what this gate's
  acceptance scope names: actual Layout entities (`level` — the one authored floor ID is the level
  qualification — `room`, `wall`, `opening`, `junction`, `object`), actual Scene entities (`scene`
  root, `entity`, `cluster`, `material`, `texture`) and the read-only current Camera subjects
  (`navigation-node`, `connection`). A Scene entity's canonical identity is its stable entity ID
  with an empty instance path: cluster membership is a named same-room member group with no
  prefab/definition model and no instance frame, so it is grouping rather than instancing and it
  never changes how a subject is addressed. The adapters are bound to the one supplied
  `SnapshotIdentity@1` they were built for — the read context must be that snapshot (acceptance
  identity included, so one acceptance never impersonates another holding identical content), the
  supplied source must be that snapshot's project, and the reference's revision must name the
  content the source holds (`exact` against the snapshot's `sourceContentId`, and an admitted F.2
  lock against the same current-source content identity) — so other content, a dependency lock
  resolving another project or other content, and a non-null `componentId`/`capabilityId` that no
  current domain authors are each a typed refusal instead of a resolution read from other content.
  An id the source does not author is `missing`; a subject kind no current adapter
  resolves is `incompatible`; a level, structure-instance path or Layout location the current source
  cannot author is `missing`, never silently re-qualified. No Level schema, Structure schema or
  fabricated Room frame is introduced, and no component/capability model is invented.
- Frame qualification: `project-world` resolves to the project origin datum; the current-source
  frame adapters refuse every owner-qualified frame as `missing` because the current source authors
  no frame identity, so a Room without an authored frame cannot qualify and neither centroid nor
  containment invents one.
- `project-lock` revision resolves only through an admitted F.2 lock reader; with none supplied it
  is `incompatible` and no lock is manufactured.
- Generation-qualified correspondence: fragments are runtime-only, expire on recompile, and
  selection keeps the canonical source.
- Channel address/descriptor/typed value family, the Layout ordinary Plan and Camera session
  inspection families — including the ratified `reading-projection-policy` and `motion-policy`
  inputs, declared as open domain-owned sets and not required — and negotiation against one
  `ChannelEvaluationContext` (the F.1 read context plus the live Camera-output states): a family's
  owning domain must agree with the address's owner domain; the address must be one the family
  admits (owner subject kind, frame kind, no undeclared address qualification); the owner
  reference and any owner frame must **resolve against the supplied snapshot at its current
  content**; the contention boundary is the structural `ChannelPropertyScope` — the **canonical
  resolved owner** plus the address's own qualification, frame, property and scope instance;
  exclusive conflict rejection with domain/address/owners and an actionable reason;
  same-invocation replacement by a newer run; ordered replacement across a scope's runs;
  per-invocation `union` contributions read as a deterministic union; Camera session values
  admitted only from the run holding the Camera output; one freshness rule shared by negotiation,
  reads and `pruneChannelState`; epoch-qualified `withdrawChannelContribution`; depth-absence
  reported as an unsatisfied family rather than an evaluated inspection.
- AM-3's Camera-output ticket protocol as interface and negotiation behaviour: `{outputId,
  sourceRevision, sessionEpoch, ownerId, runEpoch}`, one exclusive owner per output,
  acquire/request/replace/return/cancel plus the source-lifetime transition
  `rebaseCameraOutputSource`. A state names its output, realising viewport, host session and
  current source, and every operation qualifies a ticket against output, session and source before
  consulting the claim. Ownership order is **monotonic**: every accepted transition — including a
  return to a replaced run, which keeps its identity and role under a strictly newer epoch — moves
  forward, so a spent ticket cannot re-enter. Every transition that ends a claim reports the
  return obligation it voids. No runtime, evaluator, output controller, projection or navigation.
- Accepted-capabilities / Requires enforcement: the two register fields, the closure walk, the
  trusted-base requirement, retirement ineligibility, self-satisfaction refusal,
  historical-evidence reporting, row residency (an entry is filed on the gate version it names) and
  the ratified record fields including admitted source kinds and the extension slice.

## Boundary the implementation keeps

The bounded current-domain adapters are in this gate because its acceptance scope names them; what
stays out is what AM-1 itself leaves unresolved or assigns elsewhere: Experience and typed-resource
subjects (no provider yet, so no resolver is registered and the shared layer reports `incompatible`
rather than a fabricated subject), later unit/public resolvers, and any resolver needing a schema
this repository has not ratified. No Stage, live Camera controller, local F4 acceptance/history,
source migration or downstream slice behaviour is implemented, and no cycle window is opened (S01
is not a listed exposure).

## Response to the first review round

The findings below were assessed against the ratified AM-1/AM-3 text and the provider matrix before
any code changed; four were confirmed as defects, one was confirmed with a corrected boundary, and
one was confirmed as a checker gap. All are fixed in this diff, each with a conformance fixture.

| Finding | Disposition |
| --- | --- |
| `returnCameraOutput` restores the replaced run's original epoch, so the returning run's spent ticket can re-acquire the output it just gave back | **Confirmed defect.** It contradicted both AM-3's ordered transition/stale protection and this interface's own "monotonic accepted run epoch". A return now mints a strictly newer epoch for the restored run (identity and role preserved); `CameraOutputState` carries the output's epoch floor, so a free output also refuses a spent epoch after cancellation. Fixture: replace → return → replay refused, restored run's old ticket `superseded`. |
| `cancelCameraOutput` compared only output, owner and epoch | **Confirmed defect.** AM-3 requires the complete ticket context; a completion from another host session or source revision could clear the output. Cancellation now requires complete ticket equality. Fixture: cross-session and cross-revision cancellation ignored. |
| Negotiation did not require the family's domain and the address owner's domain to agree; `channelScopeKey` omitted the reference's revision and location | **Confirmed defects.** F.3 makes the owning domain authoritative for a property, and a reference identifies meaning, not a location, so two addresses differing in revision or level qualification are two addresses. Added a `domain-mismatch` rejection reason and the complete reference identity in the scope key. Fixtures: mismatched-domain rejection; distinct levels and revisions no longer merge into one contention scope while the identical address still contends. |
| The Camera session inspection family published only target/azimuth/elevation/frame-height/controller | **Confirmed defect.** The ratified AM-3 row names reading/projection policy and motion policy inputs as part of the family. Both are now declared (open domain-owned identifier sets, exclusive, optional so an absent policy means the authority's declared default). Fixture: family contents and descriptor fields. |
| F1 lacks concrete current-domain resolvers; the tests register synthetic ones | **Confirmed, and the earlier boundary was wrong.** `cross-track-execution.md`'s provider matrix puts "bounded current-domain resolvers" in this provider, and the phase's F1 draft says current adapters support actual Layout entities, Scene entities and read-only current Camera subjects. Implemented as the bounded read adapters above. The ratification's own limit is kept: Experience/resource subjects, later unit/public resolvers and unratified schemas stay out. Fixtures: a fixture built from the canonical project boot, resolution per subject kind, cluster containment, refusal by name/label, level and structure qualification, Experience/resource `incompatible`, frameless refusal. |
| `capabilityProblems` did not record admitted source kinds or the extension slice, and accepted an entry naming another row's gate version | **Confirmed checker gap.** The ratified rule requires both recorded fields, so the record grammar gains `Source kinds` and `Extension slice` (both validated; the slice must exist in a phase register) and an entry must sit on the gate version it names. Fixtures cover each. |

The register legend (`docs/roadmap/README.md`) and the readiness rule's checker definition
(`docs/roadmap/f-foundation-contracts/README.md`) were updated to the enforced grammar.

## Response to the second review round

Again assessed against the ratified AM-1 text, the phase's F1 draft and the Scene ownership
contract before any code changed. All three findings were confirmed and are fixed in this diff; one
is confirmed with a corrected mechanism rather than the one the finding names, and one has a stated
boundary. Each has a conformance fixture.

| Finding | Disposition |
| --- | --- |
| Current-domain resolution does not enforce the supplied snapshot's revision: an old exact revision can resolve against a newer document containing the same subject ID, and the document's project is not checked against the snapshot's | **Confirmed defect.** `resolveReference` may not read one revision and report another, and the phase draft is explicit that the adapter holds the accepted metadata *beside* the current source JSON, never inside it. Fixed by binding: `createCurrentDomainReadAdapters` / `createCurrentDomainResolverHost` now take the source **and** its `SnapshotIdentity@1`, and every resolution refuses unless the read context is that snapshot, the source is that snapshot's project, and the reference's revision context is that snapshot's accepted revision. The mechanism is a binding check, not a content check, because the document carries no revision token of its own to compare — which is exactly why the accepted metadata is supplied separately. Fixtures: stale exact revision refused (and the source digest is not a revision token), a rescheduled revision, another digest and another project in the read context refused as `repair-required`, a source that is not the bound snapshot's project refused, and stale/foreign dependency locks refused while a lock agreeing with the snapshot still resolves. |
| Cluster membership is treated as semantic instancing: a clustered entity must carry its cluster ID in `instancePath` | **Confirmed defect, and the earlier decision was wrong.** The Scene contract states that current clusters are named same-room member groups with no prefab/definition model, and `SceneObjectCluster` carries no `roomId`-qualified frame, no transform and no definition — grouping, not an instance. Encoding membership in the identity path made identity depend on regrouping, which AM-1 forbids (hierarchy and name paths never establish identity). An entity is now addressed by its stable entity ID with an empty instance path, the cluster stays a subject of its own, and any instance path is refused as a path the current Scene cannot author. Fixture: the clustered entity resolves bare with an empty path, the cluster resolves as its own subject, and the cluster path is refused for a member, a non-member and the cluster itself. |
| `componentId`/`capabilityId` are passed through into a successful resolution without the current domain authoring them | **Confirmed defect.** AM-1 requires an unknown component/capability to be a typed result, not a nearest/name match, so a fabricated qualifier on a real entity must not resolve. Neither identity has a current author: Layout/Scene entities carry no component identity, and the F.3 capability vocabulary is declared per channel family rather than authored per subject. Every non-null qualifier is now refused as `missing` with the subject still resolving without it. No component model is introduced — a later provider that authors these identities admits them in its own resolver, and the F.1 runtime-only `DerivedSubRef` component sub-reference is unaffected because it is a fragment sub-reference, not a subject qualification. Fixtures: component and capability refusals across Layout, Scene and read-only Camera, with the unqualified subject still resolving. |

What the review's verification section says is fair: the reviewers inspected the regression tests without
independently executing the suite. The numbers quoted above are the implementer's runs on the tested
revision named at the top of this record.

## Response to the third review round

The third round raises one question rather than a defect: which identity `exact {contentRevision}`
names, and whether comparing it to `acceptedRevision.revisionId` is the ratified reading. Assessed
against the ratified AM-1 text and this phase's F1 draft **before** any code changed. The finding
is **confirmed**: the content-identity reading is the one the contract requires, and the
implementation was the outlier. No contract text, gate register or other track is amended — the
code is corrected to the contract, not the contract to the code.

| Citation | What it decides |
| --- | --- |
| AM-1 `SemanticReference@1.revision`: tagged `exact {contentRevision}` — with the F1 draft glossing it as "**immutable domain/source content identity**" | `contentRevision` names a body of content, not an acceptance event |
| AM-1 `SnapshotIdentity@1`: "AcceptedRevision is opaque `{projectId, revisionId}`, **fresh on every source change including Undo/Redo**" | an acceptance token changes for *unchanged* content, so it cannot be the immutable content identity — the two fields are different identities and comparing them is a category error |
| F1 draft: "current-source content identity hashes the canonical serialized source" | for this single-source domain the content identity is `sourceContentId` |

The reviewer's counterexample is decisive. Accept content H as R1, accept an edit as R2, undo to R3
— which holds H again. Under the old comparison a reference pinned to H is refused as `missing`
against the undo acceptance even though the content it names is exactly what the adapter holds,
while the acceptance token it named no longer exists: a no-op round trip would invalidate a durable
reference. That is precisely what AM-1's "a durable reference identifies meaning, not a location"
rules out, and it is why the acceptance correspondence — not the token — is what carries identity
across acceptances. The earlier reading, recorded as owed after round two, argued a content match
"needs a revision token the current source JSON does not carry"; that step was wrong, because the
snapshot carries the content identity beside the JSON as `sourceContentId`, which is where the
phase draft already puts the accepted metadata.

Three independent places in this provider already used the content identity, so the adapter was
inconsistent with its own package: the F3 Camera-output tickets pin `sourceRevision` to the source
content identity; the F3 contribution-staleness check compares a contribution's
`computedFrom.contentRevision` against `context.snapshot.sourceContentId`; and both conformance
suites' non-adapter fixtures already pinned `'sha256-source-7'`. Only the current-domain adapter
helper named the acceptance token.

| Corrected | What changed |
| --- | --- |
| `exact` revision | Compared against `snapshot.sourceContentId` instead of `acceptedRevision.revisionId`; the refusal names both the content the reference requested and the content (and acceptance) the source holds |
| `project-lock` revision | The admitted F.2 reader's concrete revision must be that same current-source content identity; a foreign project and other content each refuse |
| Context/project binding | Unchanged, and now explicitly an **acceptance**-identity check: a read context bound to another acceptance refuses even when the content identity is equal, so one acceptance cannot impersonate another |
| Recorded revision | The verified content revision (`sourceContentId`), never an acceptance token, which names an acceptance event rather than a body of content |
| `snapshotLabel` | Reports both identities, so a diagnostic never makes an acceptance look like a content |

Fixtures: **31 → 32 cases**. New coverage — same content under two different acceptances each
resolving the same pinned reference, and the undo acceptance refusing a context bound to the
original acceptance despite identical content; other content refused while the held content resolves
and records it; an acceptance token named as an exact content revision refused; the four binding
cases re-stated for content identity; and the dependency-lock cases re-stated as foreign project,
other content, an acceptance token posed as content, and a lock agreeing with the held content
resolving at that content revision. F1's shared core was unaffected — `resolveReference` was
already correct, and no hashing was added to a resolver, no compatibility layer and no revision
registry introduced.

## Foundation hardening (investigation round)

A deeper investigation of the provider's own invariants, run before independent review against the
ratified AM-1/AM-3 text, this phase's F1 draft, the cross-track provider matrix and the code. Four
defects were confirmed and fixed, four hypotheses were rejected or explicitly bounded with contract
evidence, and one area was challenged adversarially without finding a violation. No ratified
contract, gate register or other track is amended: every change refines an export S01 already owns,
and `references-v1` / `inspection-v1` keep their versions.

| Finding | Disposition |
| --- | --- |
| `compareReferences` was not a total order over reference identity. Two references differing only in their revision context or location qualification compared equal (`0`), so a consumer sorting a selection could not distinguish them and `compare === 0` did not mean "the same reference" — a silent merge of two references in any consumer that deduplicates by the comparator. | **Confirmed defect.** `compareReferences` now orders the complete core identity — domain, revision tag and its opaque id, subject kind and id, component id, capability id, location tag and level id, location structure-instance path, then the reference's instance path — so distinct references never compare equal and `=== 0` is exactly reference equality. `version` is the fixed interface version, and `extensions` are deliberately excluded: an entry carries no payload, so an ignorable optional extension must not change core identity, and ordering by it would let exactly that happen. Fixture: distinct revisions, a project-lock against an exact reference, a level qualification, a structure-instance path and an optional extension. |
| `sameValue` compared channel values with `JSON.stringify`, so a declared **set** value was compared as a sequence. Re-offering the same `source-kind-filter` (`identifier-set`, `exclusive` in the v1 Layout family) in another order at the same run epoch was refused as `same-run-epoch-conflict` instead of being recognised as the idempotent re-offer it is — a semantic no-op reported as a conflict. | **Confirmed defect.** Value equality is now per declared kind: scalars and vector components by value, `identifier-set` and `source-set` by membership (validation already rejects duplicates, so membership equality is set equality). Fixture: a reordered re-offer is idempotent and leaves the state untouched, a genuinely different set is still the one-contribution-per-run conflict, and a newer run replaces the whole set. |
| A return at the run-epoch ceiling minted an epoch **equal** to the one it replaced, because `Number.MAX_SAFE_INTEGER + 1 === Number.MAX_SAFE_INTEGER`. That silently stalls the protocol's core invariant ("every accepted transition moves to a strictly newer run epoch") at the numerical boundary, which is what protects replay. | **Confirmed defect.** Accepted and minted run epochs are bounded by `MAX_CAMERA_OUTPUT_RUN_EPOCH`, so a strictly newer epoch always exists; the ticket validator refuses anything above it, and a return that cannot mint one is refused with a reason instead of minting an equal epoch. Fixture: the ceiling is valid, one above it is invalid, and at the ceiling both a return and a superseding acquire are refused with the state unchanged. |
| `sessionEpoch` was enforced only while a claim existed. On a **free** output there is no claim to compare against, so a ticket minted under a closed host session could take the output — the ratified `SessionEpoch` lifetime guard was ignored exactly where it was the only guard left. | **Confirmed defect.** The ownership state now names the host session it belongs to, and every acquire qualifies its ticket against that session before reading the state, so a foreign-session ticket is refused even with no claim. A live claim's session therefore always equals the state's. Fixture: a foreign-session ticket refused on a never-claimed and on a just-cancelled output, while a new host session's own state accepts its own ticket. |
| Declared `accepted-revision` invalidation is checked against `sourceContentId`, which "may permit stale contributions across different acceptances with identical content". | **Rejected.** A contribution whose `computedFrom.contentRevision` equals the snapshot's content identity was computed from exactly the content being read, so it is current — and the acceptance token it cannot name is fresh on every change *including Undo/Redo*, so requiring it would refuse a correctly computed contribution after a no-op undo. `contentRevision` is a content identity on both sides of this provider (the F1 adapters match it against `sourceContentId`, and the F3 contribution field is named for content), so comparing it to an acceptance token would reintroduce the category error round three removed. Fixture: none needed — the existing stale-revision, stale-generation and unproven-contribution fixtures already pin this behavior. |
| Nested handoffs (A → B → C → B → A). | **Bounded, explicitly.** v1 supports one pending return: a handoff issues a return context only for the run it replaced, and the run a return restores holds none. So C returns to B, and B's further return to A is **refused** with a reason rather than silently transferring ownership to a run whose return was spent. Supporting deeper unwinding would need retained history — a persistent stack the scope does not authorize — so the limit is stated in the module and proved by fixture instead. |
| Declared invalidation inputs other than `accepted-revision` and `generation` (`parameters`, `frame`, `intent`, `clock`, `viewport-rect`, `source-extent`, `source-kind-filter`, `reveal-set`, `epoch`) cannot be verified by negotiation. | **Deferred as a documented division of duty.** `computedFrom` is the only provenance a contribution carries, so those two are the only inputs it can prove anything about; the rest are the owning evaluator's duty to re-evaluate on its declared input. Widening `computedFrom` with parameter/frame/viewport provenance would be a speculative shape change belonging to the families that need it, so the boundary is documented in the module instead. |
| Whether source-qualified Reveal identities need richer qualification now. | **Deferred, no widening.** A reveal entry is scoped to an address whose `ownerReference` carries the revision context, and negotiation evaluates one supplied snapshot at a time, so every identity resolves inside that context. Adding a revision to `ChannelSourceIdentity` would duplicate the address qualification and widen a serialized shape ahead of an admitted capability — exactly what the scope forbids. T1.P01.S02 picks the reveal semantics it consumes. |
| `unknown-family` looks unreachable from the v1 host. | **Observation, no change.** A contribution for a family the reader does not admit is answered `unsupported-required-family` (its capability is required) or `unavailable` (optional). Its declared capability decides which, so the branch is defence for a future host whose admission set differs from its family list. A consumer should not depend on `unknown-family` from this host; the two reachable answers are already fixtured. |
| Capability-readiness checker challenged adversarially: trusted-base acceptance, transitive prerequisite closure, retirement, self-satisfaction, settled/historical slices, registered-version and residency rules. | **No violation found.** The trusted base is read from `git show <merge-base HEAD main>:docs/roadmap/README.md` rather than a self-declared field; a scope accepted only in the current diff fails, a retired scope fails for a new or in-progress consumer, a capability cannot be its own prerequisite, and a `proposed` or settled slice keeps its recorded scopes. Two parity notes are recorded as observations rather than fixed, because neither violates the ratified rule: a malformed entry at the trusted base is not filtered by well-formedness (it still cannot grant eligibility, since its scope string would not match an exact token), and a prerequisite cycle that does not pass through the root capability is not reported as cyclic (the eligibility result is unaffected — every member must still be `active` in the current tree and at the trusted base). |

**Invariants established (each fixtured).**

- *Identity ordering:* `compareReferences` is a total order over the core reference identity, so `=== 0` is reference equality and a sorted selection is fully determined. Optional extensions are not an ordering key.
- *Value identity:* a declared set value is its membership; only a genuinely different or newer contributed value changes a property scope.
- *Ownership order:* every accepted Camera-output transition — acquire, ordered replacement, ordered return — moves to a strictly **newer** run epoch than the highest this output ever accepted, including at the numerical ceiling.
- *Session lifetime:* an output's ownership state belongs to one host session, and a ticket is qualified against it on every acquire, including on a free output.
- *Return depth:* exactly one pending return per output; deeper unwinding is refused with a reason, never silently mis-transferred.
- *Revision identity:* an exact reference and a contribution's `computedFrom` both name **content** identity, while the read context and the acceptance token name the **acceptance** identity — the two are never compared to each other.

**Alternatives rejected.** A persistent handoff stack for nested returns — unnecessary retained history for a case the scope does not authorize; widening `computedFrom` or `ChannelSourceIdentity` to carry provenance or revision context the current families do not need; comparing channel values as sequences (the defect above); and enforcing the F1 snapshot binding by hashing the source on every resolve rather than by the supplied snapshot pair.

## Response to the independent review of `6ec5921c`

The independent review of head `6ec5921c` raised five acceptance blockers and several adjacent
seams. Each one was re-derived from AM-1/AM-3, the phase's F drafts and the code before any change,
and each was reproduced. The remediation is **one contract** rather than five guards: (a) one
ticket-context check in the Camera-output protocol, (b) one structural property scope derived from
the *resolved* owner, (c) one shared freshness rule, and (d) epoch marks that outlive the
contributions they order. That review's verdict applies only to `6ec5921c`; the revised head needs
its own independent review.

| Finding | Disposition |
| --- | --- |
| **B1** — the ticket protocol compared a ticket's source revision with the *holder's*, never with the host's current source, so after a source change an old run could keep, regain or block the output | **Confirmed.** `CameraOutputState` now names its current `sourceRevision` (the current-source content identity, the same identity F.3 staleness uses). Every operation runs one `qualifyTicket` check — output, session, source — before it consults the claim, so an obsolete-source ticket is refused on acquire, replace, request, return and cancel, whether the output is free, held, handed off or cancelled. The new `rebaseCameraOutputSource` **ends** the live claim, voids its pending return and reports both (`ended`, `voidedReturn`); the epoch floor is kept, so ticket order stays monotonic for the whole session. Rebasing to the same source is `unchanged`, so an Undo back to identical content ends no run. *Alternatives weighed:* requalifying the holder onto the new source on its behalf (rejected — it would mint authority for intent never evaluated against that source and let a return context cross sources); keeping the claim as "stale until requalified" (rejected — a second state of ownership with no consumer, and the output would stay blocked by a run that cannot act). Trace fixture: R1 → handoff → R2 → return/request/cancel/acquire. |
| **B2** — `outputId` was unbound: on a free output any `outputId` acquired, and a ticket for one output could act on another output of the same session | **Confirmed.** The state now names `outputId` (the identity tickets name) and `viewportId` (the Stage viewport that realises it) as **separate** fields. Only `outputId` qualifies a ticket, and the protocol never assumes the two strings are equal. A mismatch is refused as `foreign-output` with the actionable reason, on every operation. The former `output-mismatch` reason (it meant a changed observation) is renamed `stale-observation`, so the two refusals cannot be confused. Fixture: two outputs in one host session, including one realised by a viewport whose id equals the other output's id. |
| **B3** — `union` collapsed several invocations into one contribution that carried the latest offer's owner, run epoch and provenance: contributor identity was lost, stale re-offers were accepted, and values computed from earlier content survived under newer provenance | **Confirmed.** A union property now holds **one contribution per invocation**, each ordered by its own run epoch. The property's value is a **derived read** (`readChannelProperty`): the union of every *current* contributor's set, members in stable ID order, with each contributor listed with its own run epoch and `computedFrom`. No aggregate owner or revision is fabricated. An owner replaces or withdraws only its own contribution. A contributor computed from other content or another generation is never read and expires on the next negotiation or prune. Trace fixture: X@5, Y@2, X@1 (stale), X@9 (replaces X only), withdraw X, then a spent X run refused; the read is independent of acceptance order; content change and an undo to identical content. |
| **B4** — multiple references to one subject established independent exclusive holders, and a stale exact or unresolved project-lock owner reference entered negotiation as though current | **Confirmed; the fix keeps F.1 qualifications distinct.** Four layers are separated. *Distinct valid F.1 references* stay distinct: `compareReferences` is unchanged. *The canonical subject* is now explicit: a resolver states the subject's canonical `location` (`ResolvedSubject.location`) — a current Layout entity sits on the one authored level, the level and every Scene/Camera subject at the project root. *The F.3 property scope* is the structural `ChannelPropertyScope`, built from the **resolved** owner, so `exact` versus admitted `project-lock`, and `project-root` versus level-qualified locations of one subject, contend for one property. *Source-content context* is enforced: negotiation resolves the owner reference (and any owner frame) through the supplied F.1 read context and requires the resolution to be at the snapshot's current content, so a stale exact reference, an unresolved lock, an unauthored level or frame, and a subject kind the family does not own are typed refusals (`unresolved-owner-reference`, `unresolved-frame`, `inadmissible-address`). Admissible qualification per family: Plan inspection is owned by a Layout `level` (project-world or a resolvable Layout-owned frame). The Camera session family is owned by the project's Camera authority root (`camera`, added to the bounded Camera subjects and addressed by project id exactly like the Scene root), in project-world only. Neither current family declares an instance/component/capability qualification below its owner. Layout's single-level limit stays explicit; no Level schema, Room frame or Scene instancing is introduced. The round-one fixture that kept "two levels" and "two revisions" as separate scopes is withdrawn: under the current source the second level and the other revision do not resolve, and are now refused rather than admitted as parallel scopes. |
| **B5** — source-set duplicate detection and identity equality joined ids with `\u0001`, which an opaque id may contain, so distinct id paths collided | **Confirmed.** Equality is structural (`sameChannelSourceIdentity`, path segment by segment), and duplicate detection uses an unambiguous canonical encoding (`JSON.stringify` of the field tuple; JSON string escaping is injective). The serialized source-identity shape and the F.1 comparator are unchanged. The property-scope key that concatenated `\u0000` is gone: scopes are compared structurally, so independently built, structurally equal scopes with differently ordered fields read the same value. Fixture: four collision pairs under single-delimiter joins, plus a delimiter inside a subject id. |

**Adjacent seams resolved in the same design.**

| Seam | Decision |
| --- | --- |
| Channel release and cleanup | One shared, epoch-qualified mechanism. `channelContributionStaleness` is the only freshness rule: declared `accepted-revision` against the snapshot content, declared `generation` against the active generation, and — for Camera values — the live output claim. Negotiation refuses a stale offer and expires stale entries in the negotiated scope (reported as `expired`), so a stale holder never blocks a new owner. Reads never return stale values, and `pruneChannelState` is the host-side cleanup when content, generation or ownership changes. `withdrawChannelContribution` removes only the presenting run's own contribution: an older run's cleanup is `ignored`, and another invocation's — including a newer owner's after replacement — is never touched. Withdrawn and replaced runs are **retired** in `ChannelEpochMark`s that outlive the contribution, so a spent run cannot revive. An *expired* run may re-offer a re-evaluated value under the same epoch, because the owning evaluator re-evaluates the same accepted run when its declared inputs change. |
| Camera controller authority | The channel no longer has its own ownership path. Every Camera session property uses the new `camera-output` arbitration and the new `output` scope (`scopeId` is the output). A Camera value is admitted only from the run that holds the output in the supplied `CameraOutputState` — `invocationId` is the claim's `ownerId`, `runEpoch` its run epoch, and the output must be in this session over this content. The `controller` value must equal the claim's role. Acquire, handoff, return, cancel and rebase are therefore the only things that change who may contribute. A handed-off run's values stop being read immediately, and its late offers are refused (`camera-output-not-held`). Within its own claim run the holder may update its values; ordering inside one run is the run's own sequential duty. This realises AM-3's "one exclusive resolved controller per output; accepted ordered replacement/handoff" through the one protocol. Under the old encoding, a previous inspection target, held `exclusive` by invocation, would have blocked a Preview owner's target. |
| Interpolation | **Corrected.** Target, azimuth, elevation and frame height declared `linear`, which advertised a generic interpolation AM-3 forbids for Camera pose/FOV. Every Camera property is now `none`, and `familyProblems` refuses a Camera family that declares generic interpolation. `none` means no *generic* channel interpolation; Camera's own evaluator still moves pose and projection. |
| Ownership diagnostics and lookup | `requestCameraOutput` qualifies the ticket first, so a foreign-output or foreign-session request is refused, never told `superseded`. A `superseded` answer now names the holder's owner only (`owners`) instead of returning the holder's full, reusable ticket. Structurally equal addresses resolve to equal scopes (above). A nested handoff A → B → C reports B's voided return to A on C's acquisition (`voidedReturn`), and B's later return to A is refused. Cancellation reports the return it voids as well. No handoff stack is introduced. |
| Capability readiness | Re-checked; no eligibility bypass found. The checker is unchanged. |

**Changed public interfaces (all within S01's own unaccepted exports; no gate row, version or
ratified text changes).** `createCameraOutputState({outputId, viewportId, sessionEpoch,
sourceRevision})` and `CameraOutputState` gain the output identity and current source;
`rebaseCameraOutputSource` is new; refusal vocabulary gains `foreign-output` and replaces
`output-mismatch` with `stale-observation`; `acquire`/`cancel` decisions report `voidedReturn`;
`superseded` reports `owners` instead of `holder`. `ResolvedSubject` and a resolver's `resolved`
outcome carry the canonical `location`; `CURRENT_CAMERA_SUBJECT_KINDS` adds `camera`.
`ChannelEvaluationContext` becomes `{read, cameraOutputs}`; `ChannelState` becomes `{entries,
marks}`; `ChannelFamily` gains `admission` and `controllerProperty`; scopes gain `output` and
arbitrations gain `camera-output`; rejection reasons gain `inadmissible-address`,
`unresolved-owner-reference`, `unresolved-frame` and `camera-output-not-held`. The accepted outcome
gains `scope` and `expired`, and its `contribution` is always the contributor's own. New exports:
`resolveChannelPropertyScope`, `readChannelProperty`, `withdrawChannelContribution`,
`pruneChannelState`, `channelContributionStaleness`, `sameChannelPropertyScope`,
`sameChannelSourceIdentity`. Removed: `channelScopeKey`, `channelPropertyKey` and
`findChannelContribution`, whose string keys and reference-qualified lookup were the defect.
Each change removes an ambiguity the review demonstrated; none was kept merely to spare tests.

**Rejected alternatives.** Collapsing F.1 references globally (it would destroy distinctions F.1
must keep); keying scopes by the reference minus its revision (still splits `project-root` from
level-qualified locations, and would silently merge distinct placements once structure instances
exist); a generic reactive invalidation kernel; feature-specific cleanup per family; a persistent
handoff stack; and requalifying Camera ownership across sources.

**Verification approach.** Each B-finding has a discriminating trace. The Camera-output protocol is
also explored **exhaustively to depth 5** over a small action alphabet (acquire by two owners
under two policies, a spent epoch, a foreign output, an obsolete source, holder and historical
return/request/cancel, and source rebases), against invariants stated independently of the
implementation: one holder, always qualified for output, session and current source; strictly
increasing ownership order; no retired ticket ever holds again; refusals change nothing; inputs are
never mutated; a rebase leaves no claim from the old source. Each original defect was re-introduced
temporarily (source qualification, output qualification, reference-qualified scope, delimiter
dedupe, epoch-blind withdrawal, non-retiring withdrawal, a collapsed union owner), and at least one
case failed every time. Nothing else changed.

**Remaining limits (stated, not hidden).** Returns nest one deep. Union members are declared
identities and are not resolved against the source; Layout's evaluator decides Reveal membership,
as before. The other declared invalidation inputs remain the owning evaluator's duty. Epoch marks
are retained for the life of a channel state, so they grow with the number of invocations in one
host session; a new session starts a new state. A Camera output at the run-epoch ceiling can only
be cancelled until a new session.

**Reviewer-owned decisions this revision introduces.** (1) Ending, rather than requalifying, a
Camera claim when the source changes. (2) Binding every Camera session value to the output claim
(`camera-output`) as the reading of AM-3's single controller and ordered handoff. (3) The
per-family owner admission: a Layout `level` for Plan inspection, and the `camera` authority root
for Camera session values, which also adds `camera` to `references-v1`'s bounded Camera subjects.
(4) Canonical `location` on resolved subjects as the F.1 output F.3 scoping depends on. Each is
within this slice's own unaccepted exports, and none amends a ratified contract. If the reviewer
reads AM-3 or AM-1 differently on any of them, that is a contract decision for the owner, not an
implementation detail.

## Response to the re-review of `73bd68d3`

The re-review accepts B1–B5 and the four reviewer-owned decisions, and raises one P1 lifecycle race.

| Finding | Disposition |
| --- | --- |
| P1 — after a contribution had **expired and been pruned**, `withdrawChannelContribution` found no entry, returned `absent` and left the run's epoch mark un-retired, so a delayed callback could re-offer the cancelled run at the same epoch as though it were a re-evaluation | **Confirmed, and fixed at that one branch.** Expiry and withdrawal are now distinct even with no entry left. Expiry keeps the mark un-retired, so the owning evaluator may re-offer a re-evaluated value under the same run epoch. A withdrawal whose run's mark is still un-retired at exactly that epoch retires the mark and answers the new `retired` outcome. `absent` remains the idempotent no-op for a run that is already retired or was never accepted, and an older run's cleanup is still `ignored`. No other arbitration, mark or freshness rule changed. Fixture, for an exclusive and a union property: prune → re-offer accepted at the same epoch; prune → withdraw (`retired`) → the same and an older epoch refused, a repeated withdrawal `absent`, a newer run accepted. With the old branch restored, the new case fails. |

Public interface: `ChannelWithdrawal` gains `{ kind: 'retired'; state }`. That re-review's verdict applies to `73bd68d3` only; this correction needs its own final re-review.

## Owed to review (not implementer judgement)

- The independent verdict against the plan's acceptance criteria, and the tested-revision
  confirmation. The review of `6ec5921c` covers that head only; the revised head is unreviewed.
- The four reviewer-owned decisions listed at the end of the response to that review (ending a
  Camera claim on source change, claim-bound Camera session values, the per-family owner admission
  including the `camera` root subject, and canonical `location` on resolved subjects).
- Whether the corrected return/epoch semantics and the complete-ticket cancellation are the
  intended reading of AM-3's ordered handoff, and whether the bounded adapter's subject-kind set is
  the right breadth for `references-v1` — both are interface decisions the reviewer owns.
- ~~Whether binding an exact `contentRevision` to the supplied snapshot's
  `acceptedRevision.revisionId` is the intended reading.~~ **Answered in round three**: it is not;
  an exact reference is matched against the snapshot's `sourceContentId`, and the correction is in
  this diff. Whether *that* reading is the intended one is still the reviewer's to confirm.
- The identity space an admitted F.2 lock speaks in. The lock branch now compares the reader's
  concrete revision against today's single-source content identity, and AM-2 says F.2 unit
  `contentRevision` values hash canonical domain data only — a different identity space. That
  resolution belongs to the F.2 provider when it lands; nothing here manufactures a lock, and with
  no admitted reader `project-lock` remains `incompatible`.
- That the binding holds only while the source object is not mutated in place: an adapter serves the
  object it was built with, so a caller that mutates a document must rebuild its adapters with the
  new accepted snapshot. Sealing or digesting the source on every resolve was not adopted, since the
  accepted-metadata arrangement the phase draft describes puts that obligation on the caller.
- Whether to promote `F1.reference@1` and `F3.channels@1` to `implemented` (exports + conformance
  paths) and `accepted` (acceptance record + ancestor commit), and to record the
  `F1.reference@1:references-v1` / `F3.channels@1:inspection-v1` Accepted-capabilities entries.
  Until that happens both rows stay `ratified` with empty evidence columns and no consumer may
  Require either scope.
- Whether the two deliberate tightenings this round introduces are the intended reading. (a)
  Camera-output ownership state now names its host session, so a host that changes session epoch
  while keeping one viewport state must start a new state: a ticket from the previous session is
  refused even on a free output. (b) Accepted run epochs are bounded one below
  `Number.MAX_SAFE_INTEGER`, so a strictly newer epoch always exists; the ratified ticket **shape**
  is unchanged and only the accepted value domain is narrowed. Both follow from AM-3's `SessionEpoch`
  lifetime guard and its strictly-newer-epoch rule as this implementation reads them.
- Any residual risk the review finds in the recorded contracts.

The record is filled against the plan's acceptance criteria by the reviewer once real code and a
run exist, following the evidence convention in
[`apps/editor/tests/README.md`](../../../../../apps/editor/tests/README.md) and the
[T1 runbook](../../../../operations/t1-spatial-world/README.md): implementation → review →
acceptance → routine closeout → merge.
