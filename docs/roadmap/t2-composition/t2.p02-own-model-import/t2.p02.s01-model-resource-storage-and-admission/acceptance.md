# T2.P02.S01 — acceptance record: Model resource storage and admission

**Slice:** T2.P02.S01 · **Status:** implemented on `t2/p02-s01-model-resource-storage` at
`3cdd54f5`, evidence recorded, **independent review owed** — not accepted, not merged ·
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
  25 MiB at its exact limit; cancellation and the 24-hour expiry delete staged bytes; an approved
  revision is never cancelled or overwritten. Structure checking covers the GLB container, chunk
  alignment and bounds, the glTF document version, buffer/view bounds and referenced-file presence;
  the server never produces or transforms a derivative.
- **Formats, number bump and strict refusal.** Resources format 2 adds the `model` kind with a
  derivative pin (whose hash is its content revision), the retained source manifest pin, recipe,
  report digest and floor placement; Scene format 3 lets a model name a catalogue asset or a
  `model` resource of the same envelope and adds the `generic` fallback. Old-number Scene and
  resources units refuse rather than migrate; unknown keys and model part fields refuse; a `model`
  resource without its lock, or a lock without its resource, is a closure finding.
- **Admission.** `prepareUnitRuntime` resolves a Scene model id against the host catalogue **or**
  the same envelope's model registry; `source-admission.ts` reaches that through the one runtime
  path, so no second decode was added. The visitor `/p` reader is unchanged and stays catalogue-only.
- **The dual grant.** `createUnitAcceptanceAdapter` and the unit planner registry accept a
  `resourceStaging` host option; a resource- or lock-changing candidate still needs the producing
  planner's `PlannerAdmission.resources` as well. No planner is granted it by this slice, so the
  live host keeps refusing resource changes.
- **Save verification.** `saveAcceptedSource` runs `verifyModelResourcePins` inside the Save
  transaction for every `model` resource: an approved revision of that project must agree on
  derivative hash, MIME, size and locator, source manifest hash/size/file count, recipe, report
  digest and placement. A refusal rolls back, so no stored version changes. Catalogue and texture
  resources keep their landed rule.

## Criteria and their evidence

| Plan criterion | Evidence |
| --- | --- |
| API DB-backed, zero skips: owner-only, hash/size mismatch, oversize, non-glTF, missing referenced file, one revision for identical bytes, cancellation and expiry delete bytes, bounds at their limit | `apps/api/tests/model-resources.test.mjs` (7 tests) against real Postgres and a real object-store contract; the whole `npm run test:api` suite green |
| Save: unknown, foreign, unapproved, or size/type/provenance-disagreeing model pin refuses with no version change; a valid envelope saves and reloads with the same resource | `model-resources.test.mjs` "Save admits a model resource pinned to an approved revision and refuses every other pin" (unknown hash, wrong size, foreign project, staging-only, version stays 2) and "a staged import…" for the accepted save/load path |
| Formats: old numbers refuse; strict readers reject unknown keys and part fields; resource without lock and lock without resource refuse | `apps/editor/tests/lib/project-model/model-resource-admission.test.ts` (14 tests) |
| No regression: catalogue/native placement, texture assets, conditional Save, conflict recovery, visitor/public boundary | `save`, `save-units`, `projects`, `assets`, `publication`, `migration*` API files; the affected editor project-model/Scene/stage contracts; the whole arch lane |

## Evidence at `3cdd54f5`

Environment: the owner's local checkout; `DATABASE_URL=postgresql://localhost:5432/biskiq`
(reachable, no skip guards); Node 26.7.0; Vitest 3.2.7.

```text
npm run check:project-model   pass   tsc --noEmit, 0 errors
npm run check:api             pass   tsc -p tsconfig.json --noEmit, 0 errors
npm run check                 pass   svelte-check: 0 errors, 0 warnings
npm run test:api              pass   12 files / 87 tests, fail 0, skipped 0, cancelled 0 (exit 0)
npm run test:arch             pass   21 files / 172 tests, default timeout, exit 0
editor affected contracts     pass   36 files / 462 tests
  npx vitest run tests/lib/project-model tests/lib/authoring/scene \
    tests/lib/authoring/stage tests/lib/authoring/stage-source-admission.test.ts
```

The API suite includes the new 7-test file and the unchanged Save, Save-units, assets, publication,
migration and migration-fence contracts. The migration-fence expectation was extended to include
version 6 because this slice adds one migration; no assertion was weakened.

The editor run includes the new 14-test model-resource contract and the added admission case in
`stage-source-admission.test.ts` (13 tests in that file: a Scene model naming the envelope's own
`model` resource is admitted, accepted and Save-readable without a catalogue entry for it).

The code and contract evidence is at `3cdd54f5`. This record and the T2 baton were added afterwards;
the whole arch lane — including the documentation-reference gate and the routing preflight that reads
the baton — was re-run green on that final documentation tree (21 files / 172 tests at default).

## Verification notes and limits

- **Arch-lane docs gate — environmental timeout, not a slice change.** During iteration
  `tests/docs/documentation-references.test.ts` intermittently exceeded Vitest's default 5 s
  (6.0–17 s) while the tree walked; it also passed the whole lane at default once, and at the final
  tree the whole lane passed at default (21/172 above). No documentation file is changed by this
  slice (`git status` shows none), the scan itself reports 0 findings, and the same unchanged test
  passed with an explicit `--testTimeout=30000`. It is recorded as machine-load flakiness, matching
  the earlier "untouched suites timed out under unrelated load" note in
  [T3.P03.S01's record](../../../t3-experience/t3.p03-shared-acceptance-and-measurement/t3.p03.s01-planner-scope-and-build-isolation/acceptance.md).
- **Optional full editor run, not claimed.** `npm run test` (above the declared tier) reached
  2,250/2,251 in one attempt; the sole failure was the same docs-gate timeout. It is not recorded as
  a passing gate and no other file failed.
- **No editor flow.** This slice adds no import or placement UI, so no browser journey or performance
  row applies. The `generic` fallback draws a neutral 1 m box; sizing it from the approved footprint
  is placement application, which the plan assigns to `T2.P02.S02`.
- **Object storage contract, not deployed R2.** The DB-backed suite uses the in-memory store contract
  the existing asset tests use. The real bucket, `npm run test:api:stack` and a deployed environment
  are not exercised here.
- **Expiry is lazy.** There is no background worker: expired staging is deleted (bytes included) when
  the owner next touches that project's imports, which is what the tests prove. A process that never
  returns leaves the bytes until the next access or the namespace purge.
- **Retention while referenced is structural.** Nothing in this slice deletes an approved revision;
  project deletion cascades it. No project-deletion path exists yet, so that obligation is carried by
  `T2.P02.S03`/C3 rather than exercised here.
- **Structure check scope.** Approval proves the GLB container, document version, buffer/view bounds
  and referenced-file presence. It does not validate every glTF semantic or render the asset; the
  derivative is produced in the creator's browser, as the plan states.
- **No performance measurement.** The batch E table records "None: no editor flow" for this slice.

## Entry points

```text
implementation  apps/api/migrations/006-model-resources.sql
                apps/api/src/model-persistence.ts        (staging, upload, cancel, approve, content, pin verification)
                apps/api/src/model-structure.ts          (GLB/glTF structure checks)
                apps/api/src/app.ts                      (owner-only routes)
                apps/api/src/save-persistence.ts         (in-transaction pin verification)
                packages/project-model/src/units/types.ts      (model resource, placement, bounds, format 2/3)
                packages/project-model/src/units/validate.ts   (strict readers, resource closure)
                packages/project-model/src/units/runtime.ts    (catalogue or envelope model admission)
                packages/project-model/src/units/acceptance.ts (host staging + planner resources grant)
                packages/project-model/src/units/planning.ts   (retain model detail on a byte update)
                apps/editor/src/lib/authoring/stage/source-admission.ts (unchanged path; covered by test)
regressions     apps/api/tests/model-resources.test.mjs
                apps/editor/tests/lib/project-model/model-resource-admission.test.ts
                apps/editor/tests/lib/authoring/stage-source-admission.test.ts
```

## Next

Independent review of `3cdd54f5` against the plan. Acceptance, closeout and merge are not claimed;
`T2.P02.S02` and `T2.P02.S03` stay held, and the phase's integrated proof remains
[`T2.P02.S03`](../t2.p02.s03-integrated-final-gate/acceptance.md).
