# S09 independent repair evidence — size baseline

Finding: `S09-P2-2` — a fixed 30 CSS-pixel size glyph was treated as the current world endpoint, so an unchanged pointer could alter an accepted form's scale.

## Change

`scene.adapter.ts` now captures the hit-resolved pointer's closest-axis coordinate at pointerdown for Width, Depth and 3D Height. On move, the delta from that captured coordinate is applied to the accepted handle's actual local extent (`dimension / factor`). Plan Height retains its CSS-delta path and its `handle.factor` conversion. The existing `axisTravelFromRay`, `FormSizeMeasurement`, `formSizeScaleFromTravel`, planner policy and geometry limits remain in place.

The size regression coverage now includes a hit-resolved stationary Width move and a tiny move, deterministic Plan Depth resizing on a yaw-rotated form, repeated Width resizing, 3D Height on a rotated form, existing out-of-range refusal checks, and one-entry history behavior. The 3D Height target is computed from the press ray's actual closest-axis coordinate, and the dimension assertion retains five-digit precision. The neighboring Paper agreement contract is included because it consumes the same form marks.

## Verification

- `npx vitest run tests/lib/authoring/shape-reading-adapter.test.ts tests/lib/authoring/native-form-marks.test.ts tests/lib/authoring/native-form-paper-agreement.test.ts tests/lib/project-model/scene-operation-planners.test.ts` — passed; 4 files, 81 tests.
- `npm run check` — passed; svelte-check reported 0 errors and 0 warnings.
- `npm run test:arch` — passed; 23 files, 193 tests.
- `git diff --check` — passed.

This is repair evidence only. The S11 architecture-integration gate, full merge gate and slice acceptance/closeout were not run or claimed here.

Real admitted centered-height coverage is being added by the separate evidence task; this repair evidence does not claim that case.

## Worktree state

Branch `codex/r217-s09-native-form-marks`, based on reviewed commit `2d10d7afeff73ebd1d2933e5830041892d93bee0`. Changes are uncommitted. Concurrent Move-fix and Paper-agreement edits are present in shared paths; this evidence file records only the size-baseline finding.
