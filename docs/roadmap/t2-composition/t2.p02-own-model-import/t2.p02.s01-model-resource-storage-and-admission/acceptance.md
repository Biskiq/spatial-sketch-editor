# T2.P02.S01 — closed acceptance record and preservation stub

**AUTHORITY: NONE.** This stub routes to the closed acceptance record preserved in Git. Current contract
lives in [assets](../../../../reference/components/assets.md#creator-model-resource-storage-t2p02s01),
[Scene content](../../../../reference/components/scene-content.md), and
[persistence](../../../../reference/components/persistence.md).

## Acceptance and source identity

**Owner-override accepted 2026-10-23** for the implementation currently carried by PR #177 at
`623a7f73a61496d5df09c9dc0fc69ab5c6737b36`, rebased onto main `8501e7bf8ec48c4b16835ebf11607f1966a79c7d`.
The original pre-rebase PR head was `7d8f458d2059ef1e99ce48647ec3f2837024fef0`; this is source
provenance only, not a recovery anchor. The owner ruling was: “owner overide, everything is accepted.”
It waives the current-revision independent-verdict prerequisite and the current-revision plan-tier
verification-evidence prerequisite. The status is `owner-override`, never `reviewed`.

The historical two-facet independent ACCEPT was recorded by `5a3451fb` for code `7a90f7d8`. The
architecture-integration test results were also recorded at `7a90f7d8`. No review or test run at
`623a7f73` is claimed. The full owner ruling, recorded test identities/counts, unrun rows, and
remaining limits are preserved at the recovery anchor below. The complete repository gate on
then-current main remains required before merge and is owned by the parent task.

## Recorded evidence and unrun rows

The plan-tier results at `7a90f7d8` were: `check:project-model`, `check:api`, and `check` passed with
zero errors; DB-backed `test:api` passed 12 files / 88 tests with 0 skipped; the arch lane passed 21
files / 173 tests; and affected editor contracts passed 39 files / 483 tests. The API evidence used
reachable local Postgres and the in-memory object-store contract.

No current-revision rerun is claimed. `npm run test` was attempted above the declared tier and reached
2,250/2,251; its one failure was the documentation-reference test timing out, so it is not a pass.
`test:api:stack`, deployed R2, and deployed-environment checks were not run. S01 has no editor flow,
browser journey, or performance row. Project deletion is not implemented and its cleanup is carried
to S03/C3; there is no background expiry worker. These rows and limits remain distinct from the
owner's waiver of current-revision evidence prerequisites.

## Delivered and residual ownership

S01 adds owner-only staging and immutable approved model revisions, resources format 2, Scene format 3,
editor-host admission of same-envelope model resources, and Save verification against a same-project
approved revision. Durable behavior is described in the linked reference contracts above.

The import/review/approve UI, complete placement journey, Plan footprint and source-unit scale/pivot
remain T2.P02.S02 work. Project-deletion cleanup remains T2.P02.S03/C3 work. Publication remains
outside this phase and catalogue-only. The recorded storage checks used the object-store contract;
real R2/deployed stack was not exercised. There is no background expiry worker; stale staging is
cleaned on route access or namespace purge. The GLB/glTF structural check is bounded and is not a
complete semantic validator. No editor journey or performance row applies to S01.

## Entry points

```text
implementation  apps/api/src/model-persistence.ts
                apps/api/src/model-structure.ts
                apps/api/src/save-persistence.ts
                packages/project-model/src/units/{types.ts,validate.ts,runtime.ts,acceptance.ts,planning.ts}
                apps/editor/src/lib/authoring/stage/source-admission.ts
regressions     apps/api/tests/model-resources.test.mjs
                apps/editor/tests/lib/project-model/model-resource-admission.test.ts
                apps/editor/tests/lib/authoring/stage-source-admission.test.ts
                apps/editor/tests/lib/museum/assets/model-fallback-footprint.test.ts
                apps/editor/tests/lib/visitor/visitor-cold-runtime.test.ts
```

## Close-out preservation — T2.P02.S01 (2026-10-23)

```text
prose compacted:                 2   stubs at their own paths
reference promotions:            3   assets.md, scene-content.md, persistence.md
renderable evidence archived:    0 files / 0 bytes
evidence stubs / manifests:      0
transient artifacts removed:     0
historical anchor:               cc617234f432c7c4b751728cd69867adb06a3637
                                  tag closed/T2.P02.S01 (pushed)
new live → archive prose links:  0
manual-owed verification rows:   0   S01 has no editor-flow or performance row
remaining deferred items:        4   S02 import/placement flow; S03/C3 project-deletion cleanup;
                                  T4 publication; no background expiry worker
permanent stubs added:           2   one per closed prose artifact
```

P1 preservation requires PR #177 to land as a merge commit so both anchors remain reachable. After
merge, verify that `e24ed13ceb05578514bcfdfbeb066a06f90e5fb3` and
`cc617234f432c7c4b751728cd69867adb06a3637` are ancestors of `main`, and that
`closed/T2.P02.S01` resolves to the latter. No squash/rebase merge. The complete then-current-main
gate is still owed before that merge.

## Recovery

```text
git show cc617234f432c7c4b751728cd69867adb06a3637:docs/roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s01-model-resource-storage-and-admission/acceptance.md
```

## Recorded merge gate and preservation

On `3d7eefa06626937f8fa6f9e9cdb3445acb18a389`, based on PR #179 merge `8501e7bf`, the complete editor suite passes **181 files / 2,341 tests**, architecture **22/174**, heavy **9/125**, all package/editor/API checks and the production build. Fresh DB-backed API verification passes **95 tests / twelve reports / zero failures or skips**. Documentation checks pass **56/56**. P1 merge `86033b4d` preserves both recovery anchors; their ancestry and full-body recovery were verified after merge on 2026-10-23. Exact commands/results: `/tmp/batch-e-closeout/pr177-gate/results.json`.
