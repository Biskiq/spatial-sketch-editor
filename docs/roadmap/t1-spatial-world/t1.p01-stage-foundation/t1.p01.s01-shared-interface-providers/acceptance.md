# T1.P01.S01 — acceptance record: Shared interface providers

**Slice:** T1.P01.S01 · **Status:** implemented — **no acceptance recorded**; independent review owed ·
**Plan:** [implementation-plan.md](./implementation-plan.md) (owns the criteria) · **Phase:** [T1.P01](../README.md)

No acceptance is claimed. This record carries the implementer's evidence so the reviewer can verify
it; the verdict, the tested-revision confirmation and any gate promotion belong to that review, not
to the implementation diff. The register's `ratified` F1/F3 rows state interface ratification, never
implementation or acceptance.

## Implementation evidence (implementer-reported — not acceptance)

Delivered on base `main` @ `aeb464b2` (PR #125, including merged PR #124), branch
`T1-P1-S1-implementation`. The evidence below was produced on a clean tree at that base plus this
branch's diff; a later edit invalidates the rows it touches.

| Surface | Delivered in |
| --- | --- |
| `F1.reference@1` (`references-v1`) exports | `packages/project-model/src/references/` (shapes, strict validation, resolver host + resolution, frame resolution, generation-qualified correspondence, stable ID ordering) |
| `references-v1` bounded current-domain read adapters | `packages/project-model/src/references/read-adapter.ts` — actual Layout entities, actual Scene entities and read-only current Camera subjects from one supplied `ProjectDocument` |
| `F3.channels@1` (`inspection-v1`) exports | `packages/project-model/src/channels/` (address/descriptor/typed values, the two v1 families including the ratified policy inputs, negotiation, the Camera-output ticket protocol) |
| F1 conformance | `apps/editor/tests/lib/project-model/references-conformance.test.ts` — 31 cases |
| F3 conformance | `apps/editor/tests/lib/project-model/channels-conformance.test.ts` — 26 cases |
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
npm test                      vitest run (complete suite)               118 files, 1588 tests  PASS
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
  `SnapshotIdentity@1` they were built for — the read context must be that snapshot, the supplied
  source must be that snapshot's project, and the reference's revision context must be that
  snapshot's accepted revision — so a stale exact revision, a dependency lock resolving another
  project or a revision the source is not, and a non-null `componentId`/`capabilityId` that no
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
  inputs, declared as open domain-owned sets and not required — and negotiation: a family's owning
  domain must agree with the address's owner domain; one property scope is the **complete**
  reference identity (domain, revision context, subject, instance path, location, component,
  capability) plus the address's own qualification and scope instance; exclusive conflict rejection
  with domain/address/owners and an actionable reason; same-invocation deliberate replacement;
  ordered replacement per run epoch; set union over declared identities; staleness rejection on a
  declared invalidation input; depth-absence reported as an unsatisfied family rather than an
  evaluated inspection.
- AM-3's Camera-output ticket protocol as interface and negotiation behaviour: `{outputId,
  sourceRevision, sessionEpoch, ownerId, runEpoch}`, one exclusive owner per viewport/session,
  acquire/request/replace/return/cancel, return validating the current source/output context, and
  stale owner/epoch rejection. Ownership order is **monotonic**: every accepted transition —
  including a return to a replaced run, which keeps its identity and role under a strictly newer
  epoch — moves forward, so a spent ticket cannot re-enter after a return, a cancellation or a
  replacement, and cancellation clears the output only for the complete matching ticket. No
  runtime, evaluator, output controller, projection or navigation.
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

## Owed to review (not implementer judgement)

- The independent verdict against the plan's acceptance criteria, and the tested-revision
  confirmation.
- Whether the corrected return/epoch semantics and the complete-ticket cancellation are the
  intended reading of AM-3's ordered handoff, and whether the bounded adapter's subject-kind set is
  the right breadth for `references-v1` — both are interface decisions the reviewer owns.
- Whether binding an exact `contentRevision` to the supplied snapshot's `acceptedRevision.revisionId`
  is the intended reading for this bounded single-source adapter. AM-1 makes both opaque and warns
  that neither the digest nor the epoch is the revision token, and F.2's later per-unit
  `contentRevision` hashes domain data only; the reading taken here is that for the current
  single-document source the accepted revision *is* the concrete revision a resolution records. A
  different reading needs a revision token the current source JSON does not carry.
- That the binding holds only while the source object is not mutated in place: an adapter serves the
  object it was built with, so a caller that mutates a document must rebuild its adapters with the
  new accepted snapshot. Sealing or digesting the source on every resolve was not adopted, since the
  accepted-metadata arrangement the phase draft describes puts that obligation on the caller.
- Whether to promote `F1.reference@1` and `F3.channels@1` to `implemented` (exports + conformance
  paths) and `accepted` (acceptance record + ancestor commit), and to record the
  `F1.reference@1:references-v1` / `F3.channels@1:inspection-v1` Accepted-capabilities entries.
  Until that happens both rows stay `ratified` with empty evidence columns and no consumer may
  Require either scope.
- Any residual risk the review finds in the recorded contracts.

The record is filled against the plan's acceptance criteria by the reviewer once real code and a
run exist, following the evidence convention in
[`apps/editor/tests/README.md`](../../../../../apps/editor/tests/README.md) and the
[T1 runbook](../../../../operations/t1-spatial-world/README.md): implementation → review →
acceptance → routine closeout → merge.
