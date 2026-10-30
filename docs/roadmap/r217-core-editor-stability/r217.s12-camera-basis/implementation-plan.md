# R217.S12 — closed plan: Camera basis

**AUTHORITY: NONE.** R217.S12 is shipped. The phase [slice register](../README.md#slice-register)
owns status; Camera basis behaviour remains owned by `T1.viewport-projection@1` and the
[target specification](../post-s10-convergence/target-specification.md#camera-basis). This stub
replaces the approved plan body; the full plan is recoverable at the anchor below.

```text
delivered     Plan's up vector is the overhead limit [-sin a, 0, -cos a]; at azimuth 0 Plan reads
              screen right +X and up -Z, and a 3D/Plan flip no longer rolls the drawing 180 degrees.
contract      O3 Camera basis; T1.viewport-projection@1 unchanged (it fixes no Plan screen-up).
provenance    PR #231, P1 merge; independent T3 review ACCEPT at 87d2eb3e.
evidence      npm test 248 files / 3,188 tests; arch 23 / 194; check 0/0; camera-core check;
              signed continuity 601 frames x 21 pose pairs both directions; 20 settled cycles;
              browser flips at azimuth 0 and 90 at 1440x900.
entry points  implementation  packages/camera-core/src/viewport.ts (upForReading)
              regressions     apps/editor/tests/lib/museum/navigation/camera-viewport-evaluation.test.ts
              pinned captures apps/editor/tests/lib/authoring/native-form-marks.test.ts,
                              apps/editor/tests/lib/authoring/__fixtures__/stage-pick-baseline.json
residuals     none for this slice; integrated R217 journeys remain S11's.
recovery      git show 050a30d9418a9a910a320388ae2ea4d879f1b34c:docs/roadmap/r217-core-editor-stability/r217.s12-camera-basis/implementation-plan.md
              git show closed/r217.s12:docs/roadmap/r217-core-editor-stability/r217.s12-camera-basis/implementation-plan.md
```
