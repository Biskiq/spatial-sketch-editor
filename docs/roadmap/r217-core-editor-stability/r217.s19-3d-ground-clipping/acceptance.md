# R217.S19 — acceptance record: 3D ground clipping

**Slice:** R217.S19 · **Status:** implemented; **owner checkpoint owed** (§3a outcome: Numerical
failure). Not reviewed, not accepted, not merged · **Plan:** [implementation-plan.md](./implementation-plan.md)
(owns the criteria) · **Phase:** [R217](../README.md) · **Integration route:**
[R217.S11](../r217.s11-integrated-final-gate/acceptance.md)

This record claims no acceptance. The plan's checkpoint ran on the implementation branch
`codex/r217-s19-ground-clipping` (based on `main` `1032c09c`) at measured revision
`80340826`. The captures were taken on the same product code; the only later change before that
commit is the test-only pick baseline re-record. Rows 2, 4 and 5 fail with the specified formulas, so per §3a "the slice doesn't merge
until the owner rules". Independent review and routine closeout have not run and wait for the
ruling, because the ruling may change the revision.

## Delivered on the branch

- **Camera (`packages/camera-core/src/viewport.ts`).** `ViewportCameraInput` and the session state
  gain optional `displayGroundYMeters` (default `null`; a non-finite value is `null`). For a
  non-orthographic evaluation with a ground, `far = max(distance + sceneRadius, distance + reach)`
  and `near = max(NEAR_FLOOR, min(distance − sceneRadius, 0.9 × groundNear))`, with
  `reach = max(24 × extent, 64 × eyeHeight)` exported as `viewportGroundReachMeters`. With no ground,
  and for the orthographic Plan, the scene-sphere range is unchanged. It never enters bounds, Fit
  or the pose.
- **Session (`camera-session.ts`).** The Stage supplies `snapshot.domain.datumMeters` at creation and
  on `rebaseSource` (the two `stage-facade.ts` rebase calls pass the new datum).
- **Grid (`stage-grid.ts`).** The mat footprint is the exact clipped-frustum ∩ datum intersection
  (all twelve frustum edges), replacing the four corner rays and their clamp. The mat drawing holds
  at most `GRID_MAT_LINE_BUDGET = 6000` lines: over budget, the minor rectangle shrinks to the
  largest square around the quantised target (fallback 2's mechanism, applied always); non-minor
  levels keep the whole footprint. `GridLine` carries its own span (`stage-grid-scene.ts` draws it).
  `stageGridPlanFor` and `matGroundFor` hold the exact wiring `StageGrid.svelte` and
  `StageCanvas.svelte` use, so the sweep exercises the Stage path.
- **Mat (`StageCanvas.svelte`).** A unit plane scaled to a half-extent ≥ 1.5 × reach (rounded up to
  a power of two), centred on the target quantised to an eighth of that, with a polygon offset.
- **Tests.** `stage-grid.test.ts` keeps the §3a sweep as a test (4 viewports × 7 elevations 5–89°
  × 7 azimuths × 6 zooms × 2 targets = 2,352 poses through an admitted enclosure source, the Stage
  Camera session, `stageGridPlanFor` and `matGroundFor`), plus an every-1.25× zoom budget sweep, a
  datum-change and horizon-crossing orbit, and a datum rebase. `camera-viewport-evaluation.test.ts`
  pins row 6 and the formulas.

## §3a checkpoint — measured values

Measured from geometry and clip range (no appearance change can affect them). The sweep test
writes its summary when `S19_SWEEP_OUT` is set. Gaps are CSS px normalised to a 900 px frame.

| # | Pass | Measured | Result |
| --- | --- | --- | --- |
| 1 | 0 drawn ground samples outside grid coverage | 0 of 529,200 samples (also 0 outside the mat). Classified: 72,576 sky, 3,528 far-clipped, 1,008 near-clipped, all at the 0.01 m near floor (0.05 m zoom, 5°, ground-level target), 0 near-clipped above the floor (D28 fixed) | **pass** |
| 2 | ≤ 12 px, target plane ≥ 5 m | Sweep 14.0 px. Denser probe at 1440 × 900: 15 px at 25°, 5 m, target 1.5 m above ground; 13 px at 15° | **fail** |
| 3 | ≤ 40 px below 5 m | 14.5 px | pass |
| 4 | ≤ 6,000 lines, majors never dropped | Majors dropped: 0. Sweep worst 7,420 (1280 × 577, 1,000 m, 25 m level only). Between sweep zooms: up to 12,220 at 1440 × 900, 560 m, 5 m level only | **fail** |
| 5 | ≤ 1 mm depth step at the target distance | Scene-local target: 0.435 mm. Sweep worst 20.7 mm: translated target ~640 m from the content, where `distance − sceneRadius` < 0 puts near on the 0.01 m floor; up to 1.8 m at 560 m zoom | **fail** |
| 6 | `null` identical to today | Identical evaluation for absent, `null` and `NaN`; near/far = distance ∓ sceneRadius; Plan unchanged | pass |
| 7 | Browser, see below | Observations recorded; owner to judge | owed to owner |

**Why the failures are structural, not tuning.**

- **Row 2.** The band is the ground beyond `far`. With the 54° reference FOV and `reach ≥ 64 ×
  eyeHeight`, the angle below the horizon at the far plane is about `sin e · cos e / (1 + 64 sin e)`,
  which is 13–15 px at 900 px for elevations of 10–25°. O4's "about 12 px" does not hold at this FOV.
  Fallback 1 (fade) cannot pass a numerical row and fallback 3 (cap reach) widens the band.
- **Row 4.** Every over-budget case draws no minor level: the 5 m (or 25 m) level alone exceeds
  6,000 lines over a low-orbit footprint that is about 96 target-plane heights across. Shrinking the
  minor rectangle (fallback 2) cannot reduce it, and "major lines never dropped" forbids the only
  other lever.
- **Row 5.** The failing poses come from the specified `min(distance − sceneRadius, …)` term with the
  Stage's target-centred scene radius, not from the ground terms. Fallback 3 (cap reach) does not
  move near.

**Fallbacks taken:** none counts as taken. Fallback 2's minor-rectangle shrink is implemented but
cannot affect row 4's failing poses; fallbacks 1 and 3 were not applied because neither can resolve
rows 2, 4 or 5.

**Decisions owed (owner).** One of, per row:

- Row 2: accept a ≤ 15 px band at FOV 54°, or raise the eye-height multiple (about 80 gives ≤ 12 px),
  amending O4.
- Row 4: allow the budget to thin the non-minor level far from the target (for example, hide 5 m lines
  beyond the distance where their projected spacing falls below 8 px, which is the grid grammar's own
  rule), or raise the budget.
- Row 5: accept the floored near for a target far from the content, or let near use the scene bounds'
  actual view depth instead of the target-centred sphere (a Camera-authority change this plan does not
  name, so it stops here).

## Browser (plan §5)

Real Chromium through `agent-browser` (session `r217-s19-*`, closed), local editor dev server on
`localhost:5173` at the measured revision. A closed four-wall room with its floor was drawn with Ink ·
Wall in a new project. Orbit used real right-button drags (0.01 rad per px), zoom the Stage's + / −
controls. Console: no errors.

- **Overhead, 45°, 15°, 5° (1440 × 900):** grid and mat continuous to the frame edges and to the
  horizon; no straight cut. At 5° the frame's bottom row is gridded ground (D28's band is gone).
- **Horizon in frame, zoomed out (5° and 15°):** grid reaches the horizon with a dense line haze over
  the last few px, and no hard edge. A soft dark ellipse around the room is visible on the mat. It
  matches the directional light's shadow-map extent, which S19 does not touch; it was not compared
  against `main`.
- **Close-up (5°, zoomed in):** no mat/grid fighting. The room floor in wall shadow shows grazing-angle
  shadow striping. Toggling the mat's polygon offset by HMR did not change it, so it is shadow-map acne
  on the room floor, not depth-range fighting.
- **Orbit:** a four-step drag from overhead to the horizon stayed continuous at each step. Smoothness
  was observed, not timed (timing is not a criterion).
- **Widths:** the low orbit at 1440 × 900, 1280 × 800, 1180 × 820 and 820 × 1180. No horizontal page
  overflow at any width.
- **D29:** not reproduced as a material defect. After two dev-server HMR reloads mid-session the room
  floor keeps its material: overhead, the lit corner reads lighter and the rest is the walls' shadow,
  matching the pre-reload overhead capture.

Evidence (`./evidence/`, captured at the measured revision): `s19-overhead-1440.png`,
`s19-elev45-1440.png`, `s19-elev15-1440.png`, `s19-elev5-1440.png`,
`s19-elev5-zoomed-out-horizon-1440.png`, `s19-elev15-zoomed-out-1440.png`, `s19-elev5-closeup-1440.png`,
`s19-orbit-seq-1-1440.png` to `s19-orbit-seq-4-1440.png`, `s19-low-orbit-1440x900.png`,
`s19-low-orbit-1280x800.png`, `s19-low-orbit-1180x820.png`, `s19-low-orbit-820x1180.png` and
`s19-d29-overhead-after-hmr-1440.png`.

## Verification at the measured revision

Iteration evidence only; the merge gate has not run, because the slice cannot merge before the ruling.

| Command | Result |
| --- | --- |
| `npx vitest run tests/lib/authoring/stage-grid.test.ts` | 24 tests: 22 passed, 2 failed (the §3a sweep: rows 2, 4, 5; the zoom-budget sweep: row 4) |
| `npx vitest run tests/lib/museum/navigation/camera-viewport-evaluation.test.ts` | 31 passed |
| `npm run test:fast` | 224 files / 2,992 tests: 2,989 passed, 3 failed: the two checkpoint tests above, and `stage-pick-differential.test.ts`, whose pinned baseline moved by ≤ 8.9e-15 in 177 `worldPoint` values with every winner unchanged. That baseline was re-recorded (test-only) and the file re-run: 2 / 2 passed |
| `npm run test:arch` | 23 files / 194 tests passed |
| `npm run check` | 2038 files, 0 errors, 0 warnings |
| `npm run check:camera-core` | exit 0 |

## Residuals

- The two failing sweep tests stay red on the branch on purpose: they are the checkpoint, and the
  owner's ruling decides their thresholds or the formulas.
- Manual-owed rows (coarse pointer, native touch, Safari, integrated journeys) remain S11's.
