# T5.P01.S01 — acceptance record: Native form source and evaluation

**Status:** Option B implemented on PR #208; independent technical review and final verification recorded below. Owner acceptance remains pending. The slice is not closed, merged or deployed. [Plan](./implementation-plan.md) · [Phase](../README.md).

## Owner decisions and scope

On 2026-10-28 the owner approved **Option B**: satisfy criterion 6 fully in S01, including production Plan and 3D selection, Index/Find and supported Card operations. Selection is not deferred and the criterion is not weakened. Preview follows its existing visitor interaction contract: it renders the identical result without editor selection or authoring UI; return to Stage preserves canonical selection.

The original 2026-10-27 Stage first-load exception was **431.3 KiB Brotli** against the **425 KiB** hard budget. On 2026-10-28 the owner explicitly extended it to **439.0 KiB**. The final build measures **439.0 KiB JS Brotli**; CSS-inclusive delivery is a different row. This exception covers only Stage bundle size. The owner also directed: **“Continue on AC and record battery verification as pending.”** This authorizes diagnostic measurement on AC and does not waive battery performance acceptance.

The [dated baseline](./acceptance-a1ded6a3.md) preserves the original determinism investigation, unchanged 48 goldens, numerical and occlusion benchmarks, shadow comparisons and earlier failed verification attempts. Its absent-selection and pending-review statements describe the earlier tree, not this implementation.

## Implementation and criterion 6

Scene contributes a production hit provider to the existing Stage facade and semantic selection path. Plan uses canonical footprints (triangle-union projection for tilted forms), containment and a six-pixel halo, checked against actual visible geometry. 3D uses registered mounted renderer roots and nearest visible mesh intersections. Layout, floor, models and primitives participate in occlusion. Conservative bounds are prepared on renderer/source arrival and checked against live hierarchy, transform and position-version stamps; a stale RuntimeScene cannot pick. This registry supplies geometry to Stage; it creates no second picking or selection authority.

Index and Head Find share adapter subjects with domain-qualified locator IDs and canonical F1 references. Selecting a form opens its Card with Move, Turn, Place on floor, independent Width/Height/Depth Size, Duplicate and confirmed Delete. All writes use existing Scene planners through F4, capture accepted revisions and preserve identity/history semantics. Duplicate selects its allocated identity. Save/reopen serializes authored truth only.

The full browser journey uses real Stage canvas clicks in both readings, both generator planes, Index and Find, all supported operations, Undo/Redo, API-backed Save and a fresh browser-context reopen. It compares actual Stage Float32 mesh buffers to canonical evaluation and Preview buffers/world matrices to Stage. Preview exposes no editor Card, Find or form fields, and returning restores the same selection. In-session size, deletion and shadow rendering are exercised. Screenshots and raw ledgers are under [Option B evidence](./evidence/option-b/README.md).

Integration regressions exercise the mounted Scene adapter and actual mesh registry, not only isolated hit functions: nonzero viewport offsets, semantic reference/Card/actions, source identity, floor/Wall occlusion, rolled forms, model/primitive scale and visibility, live transforms, unregistration, six history operations, no-history refusals and exact saved reopen. A 32-form admission supersession test proves a project replacement during the new task boundary cannot install stale truth.

## Determinism and cold boundaries

Native **Ubuntu 24.04 Linux x64**, Node 22.23.4, GitHub Actions [run 40646896735](https://github.com/Biskiq/spatial-sketch-editor/actions/runs/40646896735), passed all **142 geometry/boundary tests**, including all **48 unchanged goldens**. The workflow explicitly asserts Linux/x64; emulation is not counted. Earlier native run [40644483606](https://github.com/Biskiq/spatial-sketch-editor/actions/runs/40644483606) also passed.

The bounded 32-entry numerical profile memo stores independent copies of typed arrays and bounds, distinguishes signed zero and structural types, and leaves canonical arithmetic/digests unchanged. It supplements the existing 256-entry editor form-mesh LRU. Strict validation precedes the cold admission task boundary. Full body validation, typed refusal issues and epoch checks remain intact. Visitor/public imports stay isolated; cold publication continues to refuse forms pending T4 admission.

## Reviews

T1 and the independent T2/T3/T4 reviewer reviewed concrete diffs and verification evidence in the existing review chats. Review receipts record scope, findings, corrections and final disposition in [Option B evidence](./evidence/option-b/README.md). These are independent technical reviews, not fabricated track-owner signatures or owner acceptance. Earlier findings about floor/Wall/model occlusion, tilted projection and scale have integration regressions.

## Verification

Final command results and browser/performance measurements are recorded in [Option B evidence](./evidence/option-b/README.md). Required lanes include editor check/build, fast/architecture/heavy/full tests, all package checks, API build and DB-backed API tests with zero skips. The complete Agent E2E and all seven branded Chrome T1 S02/S03 preservation scenarios run against the production build. An earlier preservation attempt under concurrent test load failed one collinear-pointer assertion; the isolated run passed with camera settling and projection traces, with no refusal policy or no-write assertion weakened. The failed attempt is retained as evidence.

## Performance and remaining acceptance gate

Measurements use the designated MacBook Air M2 (Mac14,2), 16 GB, macOS 15.8.2, branded Chrome 156.0.8078.48, Low Power Mode off, **AC power**. One warm-up plus ten cold browser contexts measure 60 forms ×128 smooth anchors (pinned shared outline, distinct extents), full Stage pick cost, Size and Undo/Redo through accepted result to the repository's first-rendering-opportunity metric. Raw samples and form-open long-task windows are retained. This workload does not claim all possible distinct-profile or adversarial overlap scenes. CPU-only create/size evaluation is separately labelled and does not claim renderer presentation.

**Battery-mode performance verification remains pending.** AC diagnostics are not formal battery acceptance. No other hard gate is waived. Reference Laptop A is not available in this task. S01 has no product drawing/create entry point; S02 owns it, so create-form host timings are CPU measurements rather than an invented UI journey. The closing side-quad texture seam remains the documented low-priority renderer limitation from the baseline.

## Criteria

| # | Criterion | Disposition |
| --- | --- | --- |
| 1 | Corpus closure and typed refusals | verified |
| 2 | Pinned goldens, deterministic arithmetic, import boundary | verified on native Linux x64 and macOS arm64; no golden regenerated |
| 3 | Scene 4 canonical read/write and strict refusal | verified |
| 4 | Planners, supported operations and record scope | verified through host and running Card |
| 5 | Undo/Redo, Save and reopen exact | verified including fresh browser context |
| 6 | Stage, Plan and Preview draw and select the same result | verified according to each surface contract; Preview visitor isolation preserved |
| 7 | Visitor isolation, package direction, cold refusal | verified |
| 8 | Performance evidence | AC diagnostics recorded; Stage exception439.0 KiB approved; battery acceptance pending |
| 9 | Complete repository verification | results in linked evidence; no skipped API DB tests |
| 10 | Reference updates | Scene contract, plan and T5 operational baton updated in this PR |

This record requests owner acceptance only after remaining gates are resolved. It grants no merge, deployment or slice closeout authority.
