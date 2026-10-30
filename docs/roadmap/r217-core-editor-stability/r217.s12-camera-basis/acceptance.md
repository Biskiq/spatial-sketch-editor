# R217.S12 — acceptance record: Camera basis

**AUTHORITY: NONE.** R217.S12 is shipped. The phase [slice register](../README.md#slice-register)
owns status. **Accepted 2026-10-30** after the independent T3 Camera/Experience review returned
**ACCEPT** at `87d2eb3e`; its two P2 evidence-integrity findings were corrected in that revision and
a second fresh reviewer confirmed them. No P0–P2 finding remains. **Plan:** closed stub
[implementation-plan.md](./implementation-plan.md) · **Phase:** [R217](../README.md) · **Integration
route:** [R217.S11](../r217.s11-integrated-final-gate/acceptance.md)

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
  half. Before re-recording, all 1,200 Plan samples (3 fixtures × 400) matched the old basis at the
  mirrored sample on **every field except `worldPoint`** — including `kind`, `sourceKind`, `sourceId`,
  `subRef`, `stream` and `generationId`. The 132 samples that carry a world point differ by at most
  1.8e-15 m, i.e. floating-point noise. The 3D half is the untouched historical capture.

## Verification

Tier: `affected-subsystem`; the integrated result remains owed to
[R217.S11](../r217.s11-integrated-final-gate/implementation-plan.md).

- `npm test`: 248 files / 3,188 tests passed.
- `npm run test:arch`: 23 files / 194 tests passed.
- `npm run check`: 0 errors, 0 warnings. `npm run check:camera-core`: passed.
- `camera-viewport-evaluation.test.ts`: 27 tests pass, including new signed continuity across 601
  frames for 21 pose pairs in both directions, the signed Plan endpoint at quarter-turn ties,
  mid-transition reversal, repeated fast switching, the reduced-motion cut and 20 settled cycles.
  On the old basis the continuity sweep, the signed endpoint/20-cycle checks and the reduced-motion
  cut fail (right/up dot −1; Plan right −X); reversal and fast switching already stayed continuous.
- Browser, Chromium at 1440×900 on the local editor: flips at azimuth 0 and 90°, a Wall on
  screen-left before the flip stays left in Plan, selection/Card, armed Select tool and source are
  unchanged, and Plan hover and pan track the pointer. Captures and journeys are in the
  [archived evidence manifest](../../../archive/roadmap/r217-core-editor-stability/r217.s12-camera-basis/evidence/2026-10-30-browser/CLOSED.md);
  the live path holds the [evidence pointer](./evidence/README.md).

## Evidence limits

One Chromium session at 1440×900; native touch, Safari, authenticated save/reload, dense scenes and
the integrated R217 journeys remain S11's. Native form marks and pick baselines are corrected only
where they pinned the old Plan orientation; their own contracts are S17/S18 scope.

## Residuals

None known for this slice. No waiver or deferred item is carried by this record.

## Closeout preservation — R217.S12 (2026-10-30)

```text
prose compacted:                 1   approved plan -> stub at its own path
reference promotions:            0   O3 is already the target specification's Camera basis
renderable evidence archived:    8 files / 2,129,128 bytes
evidence stubs / manifests:      1   archive CLOSED.md + live evidence pointer
transient artifacts removed:     0
historical anchor:               050a30d9418a9a910a320388ae2ea4d879f1b34c · tag closed/r217.s12 (pushed to origin)
new live -> archive prose links: 0   evidence links are to the archive manifest, not prose authority
manual-owed verification rows:   0
remaining deferred items:        0 known defects; S11 integrated journeys only
permanent stubs added:           1   the closed plan
```

P1 merge required (PR #231). After merge, verify the historical anchor is an ancestor of `main`,
inspect the recovery path with `git show <anchor>:<path>`, and confirm the tag target retains the
anchor. The branch head is deliberately not pinned here because this PR's merge will change it.
