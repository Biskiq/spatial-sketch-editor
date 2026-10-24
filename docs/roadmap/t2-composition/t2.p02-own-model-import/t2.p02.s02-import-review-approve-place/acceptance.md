# T2.P02.S02 — closed acceptance record and preservation stub

**AUTHORITY: NONE.** This stub routes to the closed acceptance record preserved in Git. Current contract
lives in [assets](../../../../reference/components/assets.md#creator-model-import-and-placement-t2p02s02),
[Scene content](../../../../reference/components/scene-content.md), and
[persistence](../../../../reference/components/persistence.md).

## Acceptance and source identity

**Owner-override accepted 2026-10-24** for PR #185 at implementation tree `082e384c`. The branch head
differs from that tree only by documentation. The owner's closeout request states that the owner
reviewed the slice, the review fixes are pushed and the merge gate passed, and it authorizes closeout
and merge. That ruling waives the current-revision independent-verdict prerequisite: the independent
review recorded in the full record covers the pre-fix revision, and no separate verdict is recorded for
the post-review fixes `5d86ebbf`, `4dcf3765` and `f8ebf4d5`. The status is `owner-override`, never
`reviewed`.

Owner decisions carried from the slice (recorded, not re-decided here):

- The T1 host patch (`StageCanvas.svelte` `modelUrls` prop, `host-acceptance.ts` resource-staging grant,
  route approved-model threading) was reviewed and accepted 2026-10-24.
- Editable Card facts: option (b), read-only, decided 2026-10-23. Numeric entry stays in the adapter
  instrument; no writable Card fact is claimed.
- The selection gap for a placed creator model is kept unfixed by owner decision 2026-10-24 and is
  recorded as a T1/T2 follow-up.
- Preview: accepted on wiring and boundary evidence 2026-10-23; T2.P02.S03 rechecks Preview with a real
  mapped derivative.

## Recorded evidence

On implementation tree `082e384c` (merge gate before the review-fix pass): `npm run test` 189 files /
2,440 tests; `test:arch` 178; `test:heavy` 125; `check`, `check:api` and `check:project-model` with zero
errors; `npm run build`; `perf:bundle` keeps Import and decoders outside every route load set;
`test:api:stack` 97 pass, 0 skipped on the default `biskiq` stack.

Closeout run on the same tree, 2026-10-24:

| Command | Result |
| --- | --- |
| `npm run test:fast` | 158 files / 2,137 tests passed |
| `npx playwright test --config perf/playwright.config.ts flows/import.spec.ts --project=chromium` (`PERF_RUNS=1 PERF_WARMUP=1`, fresh production build with `PUBLIC_API_ORIGIN=http://localhost:8788`, preview on `localhost:5173`, T2 local API on `8788`) | 2 passed. Pre-flight only, not acceptance: F5/F6 S and M cold/warm/repeat-use; F13 heap baseline 10.12 MiB, final 12.43 MiB (+2.31 MiB). The `chrome` project was not run. |
| `npx vitest run --config vitest.arch.config.ts tests/docs` (documentation cross-reference checker included) | 56 / 56 passed |

The browser journey through the local test-auth seam ran on 2026-10-23: a 2 m box with a 2050 px map
was reviewed (1 reduced, footprint 2.000 × 2.000 m, contact 0.000 m), approved, placed on the floor,
saved and rendered again on a fresh load from its pin. The API seam is the lane's `biskiq-t2` stack.

## Unrun rows (owner-run or blocked; never claimed)

1. Shell observations: selection and rest, near-bound file pickers, cancel at each step, offline
   approval and retry, keyboard-only procedures and transforms, local refusal text, narrow desktop,
   reduced motion, lens park and Resume, Preview exit, and the import-model accessible-name and
   focus-return checks.
2. Preview pixels of an approved mapped derivative (T2.P02.S03 recheck).
3. Reference-machine F5/F6/F13 budgets: ten measured runs per row, the worker-thread split, and the
   GPU-memory row at M (Chromium exposes no GPU memory). The reduced pre-flight numbers are not budgets.
4. Draco-compressed and KTX2 (`KHR_texture_basisu`) sources.
5. Derivative above 25 MiB refused, and a real 50 MiB+ source (only the declared-size cap is proven).
6. Real R2 or a deployed object store (the local object-store contract was used).
7. Worker-message timing and cancellation across the worker boundary.

## Residuals and follow-ups

- In-flight fetch dedupe across overlapping model resolutions (T2 follow-up).
- A model-failure notice can overwrite an unrelated route notice (T2 follow-up).
- A placed creator model is not canonically selected by any reachable UI path; Compose Delete, Resize
  and Duplicate need that selection. Owner decision 2026-10-24: a T1/T2 follow-up, kept unfixed.
- `locator` is trusted from the payload (non-empty only). It is authored metadata, and bytes are fetched
  by hash through the owner-only route, with Save verifying the pin. Tightening belongs to the S01
  validator or a later follow-up.
- No local byte verification of the pin in the browser, by design; the API pins and Save verifies.
- Project-deletion cleanup of model revisions remains T3's C3 lifecycle work.

## Entry points

```text
import procedure  apps/editor/src/lib/authoring/adapters/scene/import/{types,ingest,worker,worker-client,session,definitions}.ts
                  apps/editor/src/lib/authoring/adapters/scene/import/ImportModelInstrument.svelte
transport         apps/editor/src/lib/platform/model-import-client.ts
placement         packages/project-model/src/scene-planning/model-resource.ts
                  packages/project-model/src/scene-planning/planners.ts (single resources-granted planner)
                  apps/editor/src/lib/authoring/adapters/scene/placement.ts
render            apps/editor/src/lib/authoring/scene/model-bytes.ts
                  apps/editor/src/lib/authoring/scene/plan-scene-footprint.ts
                  apps/editor/src/lib/museum/assets/AssetModel.svelte
structure gate    apps/api/src/model-structure.ts (required EXT_meshopt_compression fallback)
regressions       apps/editor/tests/lib/authoring/scene-import-ingest.test.ts
                  apps/editor/tests/lib/authoring/scene-model-render.test.ts
                  apps/editor/tests/lib/authoring/scene-operation-acceptance.test.ts
                  apps/editor/tests/lib/project-model/model-resource-admission.test.ts
                  apps/editor/tests/lib/project-model/scene-operation-planners.test.ts
                  apps/editor/tests/lib/platform/model-import-client.test.ts
                  apps/api/tests/model-resources.test.mjs
```

## Close-out preservation — T2.P02.S02 (2026-10-24)

```text
prose compacted:                 2   stubs at their own paths
reference promotions:            3   assets.md, scene-content.md, persistence.md
renderable evidence archived:    0 files / 0 bytes
evidence stubs / manifests:      0
transient artifacts removed:     0
historical anchors:              0d5995e3381cb06d2e441db829efea5f4fb4ea12f (acceptance record)
                                 dabdb29a611ba39e72250277eb1b5f19783aaa97 (implementation plan)
                                 tag closed/T2.P02.S02 at 0d5995e3 (local only, not pushed)
new live → archive prose links:  0
manual-owed verification rows:   7   the unrun rows above, carried by owner ruling
remaining deferred items:        6   residuals above; S03 integrated gate; phase close (owner-invoked)
permanent stubs added:           2   one per closed prose artifact
```

PR #185 lands by merge commit (`--merge`, never squash or rebase) so both anchors stay reachable from
`main`. Verify after merge with `git merge-base --is-ancestor <anchor> main` and `git show <anchor>:<path> | head -3`.

## Recovery

```text
git show 0d5995e3381cb06d2e441db829efea5f4fb4ea12f:docs/roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s02-import-review-approve-place/acceptance.md
```
