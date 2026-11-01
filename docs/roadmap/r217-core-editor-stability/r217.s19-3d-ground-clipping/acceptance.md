# R217.S19 — acceptance record: 3D ground clipping

**AUTHORITY: NONE.** R217.S19 was accepted on 2026-10-31 at tested revision `2096f940` on
`codex/r217-s19-ground-clipping`, based on `main` `1032c09c`. The
[phase slice register](../README.md#slice-register) owns status;
[R217.S11](../r217.s11-integrated-final-gate/acceptance.md) owns integrated campaign acceptance.
The criteria are in the [implementation plan](./implementation-plan.md) (closed to a stub; its
recovery line is in the closeout below): §3 and §3a as amended by §3b.

## Owner ruling

The first checkpoint (measured revision `80340826`) was a §3a Numerical failure: rows 2, 4 and 5
failed with the specified formulas. The owner then reported two visible defects: a dark disc on the
mat, and a grid that vanished and changed between zoom levels. On 2026-10-31 the owner asked for the
fix to be proposed and implemented with independent engineering judgement, and for the plan to be
amended. Plan §3b is that amendment. It supersedes the conflicting parts of §3 and §3a. No
prerequisite was waived.

First-checkpoint values, for history:

| Row | Value |
| --- | --- |
| 1 | 0 / 529,200 |
| 2 | 14–15 px at `64 × eyeHeight` |
| 3 | 14.5 px |
| 4 | Up to 12,220 lines |
| 5 | 0.435 mm scene-local; up to 1.8 m for a target far from the content |

Their captures are archived at `../../../archive/roadmap/r217-core-editor-stability/r217.s19-3d-ground-clipping/evidence/2026-10-31-first-checkpoint/` (`s19-*.png`).

## Delivered

- **Camera.** `packages/camera-core/src/viewport.ts`.
  - `ViewportCameraInput` and the session state gain optional `displayGroundYMeters`. The default is
    `null`, and a non-finite value becomes `null`.
  - A non-orthographic evaluation with a ground uses:
    - `far = max(distance + sceneRadius, distance + reach)`
    - `near = max(NEAR_FLOOR, min(distance − max(sceneRadius, NEAR_FLOOR), 0.9 × groundNear))`
    - `reach = max(24 × extent, 96 × eyeHeight)`, exported as `viewportGroundReachMeters`.
  - With no ground, and for the orthographic Plan, the range is the scene-sphere one, unchanged.
  - The ground never enters bounds, Fit or the pose.
- **Session.** `camera-session.ts` supplies `snapshot.domain.datumMeters` at creation and on
  `rebaseSource`; the two `stage-facade.ts` rebase calls pass the new datum.
- **Mat and grid.** `shell/StageMatGround.svelte` and `shell/stage-mat-grid.ts`.
  - **Mat.** A unit plane scaled to a half-extent of at least 1.5 × reach, rounded up to a power of
    two. It is centred on the target, quantised to an eighth of that extent. It is an opaque ground
    that writes depth, so content below the datum stays under it.
  - **Grid.** One 64 × 64 subdivided quad with a per-pixel shader. Each pixel applies the grammar's
    16 → 8 CSS px fade from its own projected spacing for the fixed 1 m, 5 m and 25 m levels. The
    25 m level cross-fades in as 5 m fades out.
  - The lattice is anchored to world zero (`uLatticeOffset`).
  - The grid writes no depth. It depth-tests against real geometry and takes a polygon offset in
    depth steps (units −4, no slope factor), so it stays ahead of the mat 6 mm below it at any distance.
  - It draws at `renderOrder 0`, under the height-plane tint. It tracks Threlte's `dpr`, and is
    never a pick root.
  - `matGridLevelWeights` and `matGroundFor` in `stage-grid.ts` are the tested twins of the shader
    weights and the mat placement.
- **Paper unchanged.** `StageGrid.svelte` and `stage-grid-scene.ts` are Paper-only. `gridPlanFor`
  takes `surface: 'paper'` only.
- **Disc.** The visitor `GroundPlinth`, a 22 m dark cylinder 8 cm below the datum, rendered inside
  the Stage through `VisitorLayoutShell` and showed through the mat as the dark disc.
  `VisitorLayoutShell` gains a `plinth` prop, default on, so the visitor is unchanged. `StageCanvas`
  passes `plinth={false}`, so the mat is the Stage's ground.
- **Contract.** The grid paragraph in the
  [shell + visual-system contract](../../../reference/design-system/editor-shell-and-visual-system.md)
  is updated. The [target specification](../post-s10-convergence/target-specification.md) carries
  the amendment note.
- **Pick baseline.** `stage-pick-differential` no longer models the plinth, and its baseline was
  re-recorded. 167 `worldPoint` coordinates moved by at most 8.5e-15. Every winner and every other
  field is unchanged.

## §3a / §3b checkpoint at the tested revision

The `stage-grid.test.ts` sweep pushes 2,352 poses through an admitted enclosure source, the Stage
Camera session and `matGroundFor`:

- 4 viewports × 7 elevations (5–89°) × 7 azimuths × 6 zooms × 2 targets.
- 529,200 ground samples.

It writes its summary when `S19_SWEEP_OUT` is set. Gaps are CSS px, normalised to a 900 px frame.

| # | Pass (amended) | Measured at `2096f940` | Result |
| --- | --- | --- | --- |
| 1 | 0 drawn ground samples outside grid coverage | 0 outside the mat. Classified: 72,576 sky; 2,772 far-clipped; 1,008 near-clipped, all at the 0.01 m near floor; 0 near-clipped above the floor (D28 fixed) | pass |
| 2 | ≤ 12 px, target plane ≥ 5 m | 9.5 px | pass |
| 3 | ≤ 40 px below 5 m | 9.5 px | pass |
| 4 | Replaced by §3b: the mat grid is one quad at constant cost | One subdivided quad, uniform-only updates, no line geometry or budget | pass |
| 5 | ≤ 1 mm where the target-centred scene sphere does not reach the eye | 0.44 mm scene-local. Residual per §3b: 20.7 mm for a target about 640 m from the content, where near stays on the scene-sphere floor | pass, with residual |
| 6 | `null` identical to today | Identical evaluation for absent, `null` and `NaN`; Plan unchanged | pass |
| 7 | Browser, see below | No disc, no straight cut, grid at every zoom and to the horizon | pass |

`matGridLevelWeights` is tested to have no dead band. While the 25 m level is at full spacing
(minor spacing 0.64–200 CSS px, every 1 %), the 5 m and 25 m weights never fall below 0.5 together,
and in the cross-fade they sum to 1. A datum change, a horizon-crossing orbit (including the
lattice anchoring) and a datum rebase are tested.

## Review

**First pass.** An independent review (Opus 5.5, high effort) of `ddd9a922` found no P1, two P2s and
four nits. All were fixed in `1f91ad5d`:

- **P2-1.** With the mat writing no depth, content below the datum painted over it.
  - Fix: the mat writes depth again.
  - The grid's depth-step polygon offset keeps it ahead of the mat.
- **P2-2.** Stale or wrong docs.
  - §3b now names the plinth as the disc's cause and lists `VisitorLayoutShell.svelte`.
  - This record and the baton are rewritten at the tested revision.
- **Nit.** The grid and the height-plane tint shared `renderOrder 1`. The grid is now 0.
- **Nit.** Float32 interpolation over one huge triangle. The quad is now subdivided 64 × 64.
- **Nit.** The pixel ratio was not reactive. It now tracks Threlte's `dpr`.
- **Nit.**
  - The ink opacities are now applied.
  - `groundDepthRange` now uses `depthRange`'s near-floor term.
  - Line width kept: an antialiased one-pixel line spans about 2 device px.

**Re-review of `1f91ad5d`** (the same reviewer, against the fix diff). Every first-pass finding was
resolved, and one new P2 was raised:

- **Finding.** The grid's polygon-offset slope factor (−1) shifts it by about one pixel of the
  ground's own depth slope. That would draw grid lines over thin geometry resting on the floor (a
  1 cm slab from about 9–13 m away) and about 1 device px into the base of walls.
- **Fix in `2096f940`.** The factor is 0; only the constant −4 depth steps remain. They keep the
  grid ahead of the mat 6 mm below it until about `1e5 × near / eyeHeight`, which is tens of km
  whenever the ground sets near.
- **Test.** The shader test pins the factor at 0.

Overlay layer and picking were confirmed unaffected: the grid writes no depth, sits on overlay layer
2, which the raycaster never sees, and the Stage has no GPU pick. The reviewer stated that, with the
factor at 0, the revision is clean. `2096f940` is exactly that change plus its test assertion.

Review outcome for the tested revision: clean, with no open, withdrawn or unadjudicated finding.

## Verification at the tested revision

Tested revision: `2096f940`, with a clean product tree (`git diff -- apps packages` empty) before
and after the gate. The full merge gate was run, per the
[test manual](../../../../apps/editor/tests/README.md) ("What a change requires"); the tier was never
narrowed.

| Command | Result |
| --- | --- |
| `npm run test:arch` | 23 files / 194 tests passed |
| `npm test` (complete suite) | 258 files / 3324 tests passed |
| `npm run test:heavy` | 11 files / 138 tests passed |
| `npm run check` | 2040 files, 0 errors, 0 warnings |
| `npm run build` | exit 0 |
| `npm run check:layout-core`, `check:project-model`, `check:camera-core`, `check:geometry-core` | exit 0 each |
| `npm run check:api` | exit 0 |
| `npm run test:api:stack` (DB-backed, Docker Postgres) | 128 passed, 0 failed, 0 skipped |
| `git diff --check origin/main...HEAD` | exit 0 |

`npm run test:arch` and `npm test` are from a re-run at `d33751f9`. That commit adds only this record,
its evidence and the baton; `git diff 2096f940 d33751f9 -- apps packages` is empty. The first run at
`2096f940` failed one test in each lane: `documentation-references` caught a wrong relative path in
the uncommitted draft of this record. That path was fixed before `d33751f9`.

At `ddd9a922` the same gate had two failures. Both were structure tests that had not yet listed
`StageMatGround.svelte` and `stage-mat-grid.ts`. They were fixed in `1f91ad5d`, where the full gate
then passed with the same counts as above. Both runs are superseded by the table above.

## Browser (plan §5)

Real Chromium through `agent-browser` (session `r217-s19-*`, closed), against the local editor dev
server on `localhost:5173` serving `2096f940`. Orbit used real right-button drags (0.01 rad per px);
zoom used the Stage's + / − controls. Console: 0 errors.

- **Empty project zoom sequence (1440 × 900).** Nine frames, from the default 3D view out by two −
  steps each. Grid at every frame, with no all-mat band and no disc:
  `s19a-empty-zoom-0..8.png` and `s19a-empty-zoom-sheet.png`.
- **Room.** A closed four-wall room with its floor, drawn with Ink · Wall. Default, overhead, 45°,
  15°, 5°, the horizon in frame zoomed out at 5° and 15°, and a 5° close-up:
  `s19a-room-*.png`, `s19a-overhead-1440.png`, `s19a-elev*-1440.png` and
  `s19a-room-poses-sheet.png`.
  - Grid and mat are continuous to the frame edges and fade to plain mat before the horizon, with
    no straight cut and no near band.
  - The room floor and walls draw over the grid where they should.
- **Widths.** The low orbit at 1440 × 900, 1280 × 800, 1180 × 820 and 820 × 1180
  (`s19a-low-orbit-*.png`). No horizontal page overflow at any width.
- **D29.** Not reproduced as a material defect at the first checkpoint
  (`../../../archive/roadmap/r217-core-editor-stability/r217.s19-3d-ground-clipping/evidence/2026-10-31-first-checkpoint/s19-d29-overhead-after-hmr-1440.png`). Nothing since touches the room floor
  material.

Evidence: `../../../archive/roadmap/r217-core-editor-stability/r217.s19-3d-ground-clipping/evidence/2026-10-31-browser/` (manifest in [`CLOSED.md`](../../../archive/roadmap/r217-core-editor-stability/r217.s19-3d-ground-clipping/evidence/CLOSED.md)), captured at the tested revision.

## Residuals

- **Row 5 far-target near.** For a target hundreds of metres from the content, near stays on the
  scene-sphere floor (20.7 mm depth step at about 640 m). A near plane from the content's view depth
  would add bounds to Camera state; §3b proposes it separately.
- **Grid over contact.** The grid's constant four-depth-step offset can let a line show through
  geometry within four depth steps of the datum. That is sub-millimetre at room distances and
  matters only far out with a floored near.
- **Manual rows.** Coarse pointer, native touch, Safari and the integrated journeys remain S11's.

## Closeout and preservation — 2026-10-31

Acceptance was recorded by the owner's combined acceptance-and-closeout request. The independent
review verdict at `2096f940` is clean, with no open, withdrawn or unadjudicated finding, and no
prerequisite was waived. The phase register and the baton record the slice as shipped with no
owner override.

Anchors (computed before the compaction commit):

```text
plan       1f91ad5d7456c15aa603c0a1c4b350c57dec446a   last commit with the full plan body; the stub
                                                      at its path names this anchor as its recovery
acceptance 9efa6641dd2f1da63c8358dbac2215433bc7d2c8   full record; kept in full at its path
tag        closed/r217.s19 -> 9efa6641                tag target keeps both anchors reachable
merge      P1 merge commit; post-merge anchor verification recorded by the anchors follow-up
```

```text
CLOSEOUT PRESERVATION — R217.S19 (2026-10-31)
prose compacted:                 1   approved plan -> stub at its own path; acceptance record kept in full
reference promotions:            0   the mat-grid paragraph of the shell + visual-system contract already describes the landed behaviour
renderable evidence archived:    39 files / 9.2 MiB (23 browser, 16 first-checkpoint), byte-identical copies
evidence stubs / manifests:      1   docs/archive/roadmap/r217-core-editor-stability/r217.s19-3d-ground-clipping/evidence/CLOSED.md
transient artifacts removed:     0
historical anchors:              plan 1f91ad5d7456c15aa603c0a1c4b350c57dec446a; acceptance 9efa6641dd2f1da63c8358dbac2215433bc7d2c8 (full record); tag closed/r217.s19 -> 9efa6641 (push state recorded at post-merge verification)
new live -> archive prose links: 0
manual-owed verification rows:   4   coarse pointer, native touch, Safari, integrated journeys (S11)
remaining deferred items:        3   far-target near (row 5); grid depth-step offset within four depth steps of the datum; S11 manual rows
permanent stubs added:           1   approved plan
```
