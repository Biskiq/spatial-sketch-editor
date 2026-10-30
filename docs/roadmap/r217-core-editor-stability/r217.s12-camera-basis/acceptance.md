# R217.S12 — acceptance record: Camera basis

**Slice:** R217.S12 · **Status:** in-progress — implementation complete; independent T3 review pending ·
**Plan:** [implementation-plan.md](./implementation-plan.md) (owns the criteria) · **Phase:**
[R217](../README.md) · **Integration route:**
[R217.S11](../r217.s11-integrated-final-gate/acceptance.md)

## Implementation

`upForReading('plan', azimuth)` now returns `[-sin a, 0, -cos a]`, the limit the projected world
+Y approaches as the view passes overhead. At azimuth 0 Plan reads screen right +X and up −Z. No
Plan-specific basis, consumer compensation, planner, persisted format or owner-ruling change; target,
target-plane scale, quarter-turn snapping, remembered elevation and detented azimuth are unchanged.

Corrected pinned captures, named for review:

- `apps/editor/tests/lib/authoring/native-form-marks.test.ts` modelled Plan as "+Z is up"; its local
  projection now uses screen right +X and screen up −Z, and its yaw-0 Move offset expectation follows
  the projected axis (`−24` px instead of `+24`).
- `apps/editor/tests/lib/authoring/__fixtures__/stage-pick-baseline.json` re-records only its **Plan**
  half. Before re-recording, all 1,200 Plan samples (3 fixtures × 400) resolved the same semantic
  winner when mirrored onto the old basis (`kind`, `sourceKind`, `sourceId`, `subRef`); exact JSON
  differed only by floating-point world points. The 3D half is the untouched historical capture.

## Verification

Tier: `affected-subsystem`; the integrated result remains owed to
[R217.S11](../r217.s11-integrated-final-gate/implementation-plan.md).

- `npm test`: 248 files / 3,188 tests passed.
- `npm run test:arch`: 23 files / 194 tests passed.
- `npm run check`: 0 errors, 0 warnings. `npm run check:camera-core`: passed.
- `camera-viewport-evaluation.test.ts`: 27 tests pass, including new signed continuity across 601
  frames for 21 pose pairs in both directions, the signed Plan endpoint at quarter-turn ties,
  mid-transition reversal, repeated fast switching, the reduced-motion cut and 20 settled cycles.
  The four new continuity/endpoint tests fail on the old basis (right/up dot −1; Plan right −X).
- Browser, Chromium at 1440×900 on the local editor: flips at azimuth 0 and 90°, a Wall on
  screen-left before the flip stays left in Plan, selection/Card, armed Select tool and source are
  unchanged, and Plan hover and pan track the pointer. Captures and journeys:
  [browser evidence](./evidence/README.md).

## Evidence limits

One Chromium session at 1440×900; native touch, Safari, authenticated save/reload, dense scenes and
the integrated R217 journeys remain S11's. Native form marks and pick baselines are corrected only
where they pinned the old Plan orientation; their own contracts are S17/S18 scope.

## Residuals

None known for this slice. No waiver or deferred item is carried by this record.
