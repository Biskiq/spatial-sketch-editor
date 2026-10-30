# S09-E2 — independent Paper and policy evidence

**Reviewed base:** `2d10d7afeff73ebd1d2933e5830041892d93bee0` · PR #228 ·
`codex/r217-s09-native-form-marks`
**State:** repair evidence only; all work remains uncommitted. The slice is **NOT ACCEPTED**.

## Width → Plan → Paper

`apps/editor/tests/lib/authoring/native-form-paper-agreement.test.ts` drives a selected form's
disclosed Width mark through hit resolution and the mounted Stage pointer/acceptance host. The
fixture yaw is `0.37` radians. After release, assertions read the accepted envelope from the live
facade snapshot, then obtain the Plan footprint through the same `planSceneFootprintsFor` runtime
path used by the Stage adapter, passing the mounted runtime Scene and its model-footprint map.

The test independently evaluates the accepted `form` with `evaluateFormMesh`, transforms that
evaluated footprint by the accepted yaw and translation, and compares those points with the live
Plan footprint. The exact runtime projection feeds `buildPaperPlan`; its Paper polygon equals the
Plan points. Both Plan and Paper differ from the pre-edit silhouette, and host history increases by
exactly one entry. This is intended to fail if the accepted runtime projection or Paper drawing
keeps the old form footprint.

## Centered Height

The same contract admits a real elevation form with vertical profile coordinates `[-0.5, 0.5]` and
entity Y `+0.5`, so its support contact is at world Y `0` and the measured Height handle factor is
`2`. In settled Plan, the test drags the actual Height mark by 20 CSS pixels. It checks the live
preview against the evaluation's target-plane scale, then checks the accepted scale, preserved
support contact, and exactly one history entry.

## Existing size policy

No range or planner policy was changed. `packages/project-model/src/scene-planning/operations.ts`
rejects any scale axis outside `PROFILE_LIMITS.minScale = 0.01` and
`PROFILE_LIMITS.maxScale = 100`. The profile evaluator separately restricts scaled dimensions to
`0.001–100 m`. The existing `shape-reading-adapter.test.ts` contract exercises the invalid extent
edges through mark preview and Card and asserts equal refusals with no source/history write; it
also verifies valid Card and ray sizing agree. The full host contract passed.

## Verification

Commands/results on the current uncommitted shared worktree:

- `npx vitest run tests/lib/authoring/native-form-paper-agreement.test.ts` — passed, 2 tests.
- `npx vitest run tests/lib/authoring/native-form-paper-agreement.test.ts tests/lib/authoring/shape-reading-adapter.test.ts tests/lib/authoring/native-form-marks.test.ts tests/lib/authoring/scene/plan-scene-form-footprint.test.ts tests/lib/authoring/stage-paper.test.ts` — passed, 5 files / 61 tests.
- `npm run check` — passed, zero errors and warnings.
- `npm run test:arch` — passed, 23 files / 193 tests.
- `npm run test:heavy` — passed, 11 files / 138 tests.
- `npm test` — passed, 245 files / 3,122 tests.
- `npm run build` — passed. Vite emitted external dependency and large-chunk warnings.

These runs do not record S09 acceptance or R217.S11 completion. The full gate's slice-acceptance
prerequisites and journey evidence remain outside this bounded repair.
