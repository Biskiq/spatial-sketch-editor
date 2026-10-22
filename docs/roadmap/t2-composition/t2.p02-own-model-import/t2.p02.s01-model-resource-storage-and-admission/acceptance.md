# T2.P02.S01 — acceptance record: Model resource storage and admission

**Slice:** T2.P02.S01 · **Status:** implemented on `t2/p02-s01-model-resource-storage` at
`7a90f7d8`, evidence recorded, **independent review ACCEPT** (`5a3451fb`) — owner acceptance and merge
owed ·
**Plan:** [implementation-plan.md](./implementation-plan.md) (owns the scope and criteria) ·
**Phase:** [T2.P02](../README.md) · **Register:** [phase slice register](../README.md#slice-register)

This page records the evidence the plan's declared **architecture-integration** tier requires. It
claims no acceptance, no owner ruling, no gate state and no merge. The criteria remain the plan's;
the form is [the tests README's "What a change requires"](../../../../../apps/editor/tests/README.md#what-a-change-requires).
The slice adds no editor flow, so the batch E performance table's row for it is "None".

## Delivered

- **Storage beside the image registry, not inside it.** Migration `006-model-resources.sql` adds
  `model_imports`, `model_import_files` and `model_revisions`. A staging import is project- and
  owner-scoped, carries the declared file set (path, size, SHA-256) and the recipe, and expires 24
  hours after creation. An approved revision is immutable and content-addressed by
  `(project_id, content_hash)`; the existing `assets` table and its texture lifecycle are untouched.
- **Owner-only import API.** `POST /projects/:projectId/models/imports` stages a declaration;
  the file route streams one declared file with server-side length and hash checks; `DELETE`
  cancels staging and removes its bytes; `POST .../approve` checks GLB/glTF structure, promotes the
  bytes to immutable revision keys and returns the pins; `GET .../models/content/:hash` serves the
  approved derivative privately with `ETag` and `immutable` caching. Foreign or missing projects and
  imports answer not-found, never a resource the caller does not own.
- **Owner-accepted bounds.** A declaration refuses a source set over 50 MiB or a derivative over
  25 MiB at its exact limit, and the upload route streams those exact sizes (proved with 50 MiB and
  25 MiB payloads, not only declaration arithmetic); cancellation, and the 24-hour expiry at staging
  creation, upload or approval, delete staged bytes; an approved revision is never cancelled or
  overwritten. Structure checking covers the GLB container, chunk
  alignment and bounds, the glTF document version, buffer/view bounds and referenced-file presence;
  the server never produces or transforms a derivative.
- **Formats, number bump and strict refusal.** Resources format 2 adds the `model` kind with a
  derivative pin (whose hash is its content revision), the retained source manifest pin, recipe,
  report digest and floor placement; Scene format 3 lets a model name a catalogue asset or a
  `model` resource of the same envelope and adds the `generic` fallback, whose box uses the
  approved footprint's width and depth (height stays a neutral 1 m; the placement format carries no
  height). Old-number Scene and resources units refuse rather than migrate; unknown keys and model
  part fields refuse; a `model` resource without its lock, or a lock without its resource, is a
  closure finding.
- **Admission at the host door.** `source-admission.ts` merges this envelope's approved `model`
  resources into the museum catalogue predicate before the one runtime preparation; the shared
  `prepareUnitRuntime` stays host-neutral. The visitor/cold-release host therefore refuses a creator
  model at preparation with its catalogue-only predicate, which a cold-release test observes rather
  than infers from a downstream reference check.
- **The dual grant.** `createUnitAcceptanceAdapter` and the unit planner registry accept a
  `resourceStaging` host option; a resource- or lock-changing candidate still needs the producing
  planner's `PlannerAdmission.resources` as well. No planner is granted it by this slice, so the
  live host keeps refusing resource changes.
- **Save verification.** `saveAcceptedSource` runs `verifyModelResourcePins` inside the Save
  transaction for every `model` resource: an approved revision of that project must agree on
  derivative hash, MIME and size, source manifest hash/size/file count, recipe, report digest and
  placement. A refusal rolls back, so no stored version changes. Catalogue and texture resources
  keep their landed rule.

## Criteria and their evidence

| Plan criterion | Evidence |
| --- | --- |
| API DB-backed, zero skips: owner-only, hash/size mismatch, oversize, non-glTF, missing referenced file, one revision for identical bytes, cancellation and expiry delete bytes, bounds at their limit | `apps/api/tests/model-resources.test.mjs` (8 tests) against real Postgres and a real object-store contract, including a streamed 50 MiB source and 25 MiB derivative, an upload after expiry that is refused with its bytes deleted, a missing project and a foreign owner's approve/cancel answering 404, an approved import refusing further bytes, distinct same-length hash and short-stream length refusals, and an image naming an absent `bufferView`; the whole `npm run test:api` suite green |
| Save: unknown, foreign, unapproved, or size/type/provenance-disagreeing model pin refuses with no version change; a valid envelope saves and reloads with the same resource | `model-resources.test.mjs` "Save admits a model resource pinned to an approved revision and refuses every other pin" (unknown hash, wrong size, foreign project, staging-only, a report-digest disagreement whose issue names the model's own registry index, version stays 2) and "a staged import…" for the accepted save/load path; a type disagreement is refused earlier by the format reader |
| Formats: old numbers refuse; strict readers reject unknown keys and part fields; resource without lock and lock without resource refuse | `apps/editor/tests/lib/project-model/model-resource-admission.test.ts` (13 tests) |
| No regression: catalogue/native placement, texture assets, conditional Save, conflict recovery, visitor/public boundary | `save`, `save-units`, `projects`, `assets`, `publication`, `migration*` API files; the affected editor project-model/Scene/stage/museum-asset contracts; the visitor cold-release catalogue-only test; the whole arch lane |

## Evidence at `7a90f7d8`

Environment: the owner's local checkout; `DATABASE_URL=postgresql://localhost:5432/biskiq`
(reachable, no skip guards); Node 26.7.0; Vitest 3.2.7.

```text
npm run check:project-model   pass   tsc --noEmit, 0 errors
npm run check:api             pass   tsc -p tsconfig.json --noEmit, 0 errors
npm run check                 pass   svelte-check: 0 errors, 0 warnings
npm run test:api              pass   12 files / 88 tests, fail 0, skipped 0, cancelled 0 (exit 0)
npm run test:arch             pass   21 files / 173 tests, default timeout, exit 0
editor affected contracts     pass   39 files / 483 tests
  npx vitest run tests/lib/project-model tests/lib/authoring/scene \
    tests/lib/authoring/stage tests/lib/authoring/stage-source-admission.test.ts \
    tests/lib/museum/assets tests/lib/visitor/visitor-cold-runtime.test.ts
```

The API suite includes the new 8-test file and the unchanged Save, Save-units, assets, publication
and migration contracts. The migration-fence expectation was extended to include version 6 because
this slice adds one migration; no assertion was weakened. The physical bound
test streams a 50 MiB source file and a 25 MiB derivative through the upload route, then cancels and
checks the bytes are gone; the expiry test force-expires a staging import, refuses the next upload
with 404, and checks its object and row are gone.

The editor run includes the new 13-test model-resource contract, the new 4-test footprint contract,
the 15-test visitor cold-runtime contract (including the creator-model refusal), and the 13-test
`stage-source-admission.ts` contract, which carries the end-to-end admission case and the
`modelFootprints` assertion on the admitted snapshot. The cold release is exercised with a creator
model and observed to refuse it.

The code and contract evidence is at `7a90f7d8`. Two passes shaped it: a deletion-first pass at
`b88cbc95` (one staging-expiry sweep, one structure-check function, one upload-length read, and no
overlapping test cases) and a review-fix pass at `7a90f7d8` (the render tolerance, the registry-index
refusal path, the image `bufferView` bound, and the API proofs listed above). This record and the T2
baton were updated afterwards; the whole arch lane was re-run green on the final documentation tree
(21 files / 173 tests at default), including the documentation-reference gate and the routing
preflight that reads the baton.

## Independent review

Two independent reviewers, separate from the implementation and reading one facet each (API and
persistence; formats, admission and rendering), reviewed `feb687b1` against the plan and this record.
Both returned **CHANGES REQUIRED**. Every in-scope finding was fixed at `7a90f7d8`; the rest are
disclosed in the limits below. A second pass over `7a90f7d8` is recorded at the end of this section.

| Finding | Disposition |
| --- | --- |
| The editor stage crashed on a creator-model id: `AssetModel` called the throwing catalogue lookup before the footprint fallback could draw | Fixed: the lookup is tolerant, an absent catalogue entry resolves to `generic`, and the fallback-kind seam is tested with an unknown id |
| The hash-mismatch API test never reached the hash check (it changed the length) | Fixed: a same-length tampered upload refuses as `invalid_model_file`; a short stream refuses as `invalid_upload` |
| “Approved bytes never change” was unproven | Fixed: an upload to an approved import answers 400 and the content read is byte-identical afterwards |
| A Save refusal named the filtered-list index instead of the registry index | Fixed: the walk keeps the registry index, and the provenance refusal asserts `resources[1]` behind a texture |
| An image could name a nonexistent `bufferView` and pass approval | Fixed: the index is bounds-checked, with a refusal case |
| Foreign approve/cancel and a missing project were untested | Fixed: each answers 404 in the API suite |
| Save's provenance comparison was unexercised | Fixed: a report-digest disagreement refuses; a type disagreement is refused earlier by the format reader |
| Approval is not atomic across object promotion and the revision row; a cancel can race an upload; a re-approval body is ignored; a `.glb` root must be self-contained; the content route trusts the stored length | Disclosed in the limits |
| A placed creator model has no Plan footprint or collision extent | Recorded as `T2.P02.S02` placement work in the limits |
| An authored catalogue fallback still draws that catalogue box; every model resource needs its lock even when unplaced | Disclosed in the limits |

**Second pass (two independent reviewers, `5a3451fb`; code `7a90f7d8`).** Both facets returned
**ACCEPT** with no blocker or major finding. Their remaining notes are dispositioned here: the
evidence heading now names `7a90f7d8`; the lock rule is stated against the plan's acceptance list
rather than its narrower §2 sentence; the tolerant render lookup is recorded as an allowance; and the
route-level declared-length refusals and the render seam's test boundary are disclosed in the limits.
The reviewers verified from source and tests, not by execution; the gate counts below are the owner
runs recorded in this file.

## Verification notes and limits

- **Arch-lane docs gate — environmental timeout, not a slice change.** During iteration
  `tests/docs/documentation-references.test.ts` intermittently exceeded Vitest's default 5 s
  (6.0–17 s) while the tree walked; it also passed the whole lane at default once, and at the final
  tree the whole lane passed at default (21/173 above). No documentation file was changed when the
  timeouts occurred, the scan itself reports 0 findings, and the same unchanged test passed with an
  explicit `--testTimeout=30000`. It is recorded as machine-load flakiness, matching
  the earlier "untouched suites timed out under unrelated load" note in
  [T3.P03.S01's record](../../../t3-experience/t3.p03-shared-acceptance-and-measurement/t3.p03.s01-planner-scope-and-build-isolation/acceptance.md).
- **Optional full editor run, not claimed.** `npm run test` (above the declared tier) reached
  2,250/2,251 in one attempt; the sole failure was the same docs-gate timeout. It is not recorded as
  a passing gate and no other file failed.
- **No editor flow.** This slice adds no import or placement UI, so no browser journey or performance
  row applies. The `generic` fallback is sized from the approved footprint's width and depth; its
  height is a neutral 1 m because the placement format carries no height. Applying source-unit scale
  and pivot to a placed instance remains `T2.P02.S02` placement work.
- **Object storage contract, not deployed R2.** The DB-backed suite uses the in-memory store contract
  the existing asset tests use. The real bucket, `npm run test:api:stack` and a deployed environment
  are not exercised here.
- **Expiry has no background worker.** Staging creation, upload, approval and cancellation each
  enforce the 24-hour bound; the tests prove upload and approval refuse an overdue import after
  deleting its bytes. An import that nobody ever touches again remains until its next access or the
  namespace purge — there is no timer in this service.
- **Retention while referenced is structural.** Nothing in this slice deletes an approved revision;
  project deletion cascades it. No project-deletion path exists yet, so that obligation is carried by
  `T2.P02.S03`/C3 rather than exercised here.
- **Structure check scope.** Approval proves the GLB container, document version, buffer/view bounds
  and referenced-file presence. It does not validate every glTF semantic or render the asset; the
  derivative is produced in the creator's browser, as the plan states.
- **Physical upload proof is bounded to the two owner-accepted sizes.** The suite streams exactly
  50 MiB and 25 MiB through the route; it does not open additional sockets for 50 MiB + 1 byte,
  because a declaration above either bound is already refused before an import exists.
- **No performance measurement.** The batch E table records "None: no editor flow" for this slice.
- **Review-disclosed storage edges.** Approval promotes the derivative and source objects before it
  inserts the revision row, so a crash between them can leave revision-namespace objects without a
  row; cancellation racing an in-flight upload can leave one staged object without a row. The
  content route trusts the stored length and the immutable key rather than re-hashing bytes on read.
  A second approve POST with a different report digest or placement returns the stored revision.
- **Structure check: a `.glb` root is self-contained.** External buffer or image references are
  admitted only from a `.gltf` root, which resolves them among the declared files; a `.glb` root that
  references an external file is refused rather than resolved.
- **No Plan footprint yet.** `buildPlanSceneFootprintProjection` reads the catalogue, so a placed
  creator model has no passive Plan footprint or collision extent. Extending it belongs to
  `T2.P02.S02` placement work, together with source-unit scale and pivot.
- **Fallback authored by the placement.** A creator-model entity draws the generic footprint box when
  its placement names `generic`; an authored catalogue fallback still draws that catalogue shape.
  Every model resource requires its lock entry even when unplaced: the plan's acceptance list says so,
  while its §2 Scene-model sentence only names a model a Scene places.
- **Tolerant render lookup.** A Scene model id absent from the catalogue resolves to the generic
  footprint box, so a misspelled catalogue id renders that neutral box instead of failing. Format
  admission and the cold-release reader keep this unreachable for authored and visitor documents.
- **Coverage boundaries.** The model upload route's declared-length refusals (over-ceiling, missing
  length, wrong media type, zero length) share the asset route's reader and are not separately tested
  for the model route; the definition-level bounds and the exact-size stream are. The render fix is
  proven at the fallback-resolution seam, not by rendering `AssetModel`.
- **Save reload identity.** Whole-document save/reload byte identity is the landed `save`/`projects`
  contract's assertion; this slice's Save test asserts the stored model resource's pin and detail and
  the unchanged version.

## Entry points

```text
implementation  apps/api/migrations/006-model-resources.sql
                apps/api/src/model-persistence.ts        (staging, upload, cancel, approve, content, pin verification)
                apps/api/src/model-structure.ts          (GLB/glTF structure checks)
                apps/api/src/app.ts                      (owner-only routes)
                apps/api/src/save-persistence.ts         (in-transaction pin verification)
                packages/project-model/src/units/types.ts      (model resource, placement, bounds, format 2/3)
                packages/project-model/src/units/validate.ts   (strict readers, resource closure)
                packages/project-model/src/units/runtime.ts    (approved footprint read projection)
                packages/project-model/src/units/acceptance.ts (host staging + planner resources grant)
                packages/project-model/src/units/planning.ts   (retain model detail on a byte update)
                apps/editor/src/lib/authoring/stage/source-admission.ts (editor-only model admission)
                apps/editor/src/lib/museum/assets/{fallbacks.ts,AssetModel.svelte,AssetFallback.svelte}
                apps/editor/src/lib/visitor/VisitorEntities.svelte (footprint to the fallback)
regressions     apps/api/tests/model-resources.test.mjs
                apps/editor/tests/lib/project-model/model-resource-admission.test.ts
                apps/editor/tests/lib/authoring/stage-source-admission.test.ts
                apps/editor/tests/lib/museum/assets/model-fallback-footprint.test.ts
                apps/editor/tests/lib/visitor/visitor-cold-runtime.test.ts
```

## Next

Owner review of the branch tip, whose code revision is `7a90f7d8`. Acceptance, closeout and merge are
not claimed; `T2.P02.S02` and `T2.P02.S03` stay held, and the phase's integrated proof remains
[`T2.P02.S03`](../t2.p02.s03-integrated-final-gate/acceptance.md).
