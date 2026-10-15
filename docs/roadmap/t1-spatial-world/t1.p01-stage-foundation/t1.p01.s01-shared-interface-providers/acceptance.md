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
| F1 conformance | `apps/editor/tests/lib/project-model/references-conformance.test.ts` — 27 cases |
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
npm test                      vitest run (complete suite)               118 files, 1584 tests  PASS
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
  (`navigation-node`, `connection`). A clustered Scene entity's canonical identity is its cluster
  path, so a bare path for a clustered entity is refused rather than accepted as a second identity
  for one subject. An id the source does not author is `missing`; a subject kind no current adapter
  resolves is `incompatible`; a level, structure-instance path or Layout location the current source
  cannot author is `missing`, never silently re-qualified. No Level schema, Structure schema or
  fabricated Room frame is introduced.
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

## Owed to review (not implementer judgement)

- The independent verdict against the plan's acceptance criteria, and the tested-revision
  confirmation.
- Whether the corrected return/epoch semantics and the complete-ticket cancellation are the
  intended reading of AM-3's ordered handoff, and whether the bounded adapter's subject-kind set is
  the right breadth for `references-v1` — both are interface decisions the reviewer owns.
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
