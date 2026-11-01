# R217 — Post-S19 owner manual review

**Status:** Owner observations for investigation. Not an implementation approval, new slice acceptance, waiver, or R217 closeout. S15–S19 remain historically shipped. R217.S11 is still the integrated gate.

**Base:** Manual checks after R217.S15–S19 were merged, including Plan and 3D screenshots of selected Walls, invalid drags, and isolated Walls. The screenshots were supplied in the owner conversation; they are not part of this PR. Please reproduce and capture evidence in the repo.

## My review

S15 and S16 feel good functionally. I'm not asking to redo their manipulation work.

1. **S15 — invalid drag feedback on Paper.** When a Wall drag is refused, I still see a very pale/white line. It is hard to read on Paper. I also hit a long technical message with Wall IDs and `unsupported proper-crossing`, instead of a short human explanation. Is this an S15 regression, a different Layout/Room diagnostic getting through, or a shared Stage presentation problem? Trace the actual path, don't just recolor the line or hide the text.
2. **S16 — good.** No new issue from my manual check.
3. **S17 — no new verdict here.** This check is not an acceptance review of S17.
4. **S18 — selected 2D Wall looks muddy.** The gold selection outline in 3D looks good. In 2D, the selected Wall looks brown, almost like a color painted over the black Wall ink. Functionality is good, appearance isn't. I'd rather preserve crisp architectural black ink with a clear gold selection cue. Check the current Paper fill/edge treatment and propose a better result, without losing readability or selection identity.
5. **S19 — 3D ground/grid still flickers.** The obvious straight cutoff is improved, but I still notice flicker at certain camera angles and distances, especially while moving the camera. Static screenshots may miss it. Please reproduce it in motion and determine whether it comes from depth fighting, shader/LOD aliasing, camera near/far, overlapping geometry, or something else. S19 passing its sweep is not proof that the motion looks stable.
6. **Additional foundation issue — a standalone Wall looks like a sheet.** Draw a single Wall. From above it visibly has thickness; at some oblique angles it looks paper-thin, and when looking along its end it can almost disappear. Selecting it adds a translucent gold effect that doesn't make the solid read correctly. This is more serious than the selection palette. Check the actual emitted Wall mesh, not just lighting. One concrete suspicion from source inspection: `buildStandaloneWallMesh` in `apps/editor/src/lib/layout/wall-mesh-builder.ts` builds side/top/bottom faces but may not emit vertical terminal end caps; `terminalJoin()` in `packages/layout-core/src/layout-junction-resolution.ts` gives no cap surface, and `buildStandaloneEndBridge()` appears limited to connected seams. The existing degree-1 cap test checks that a mesh exists, not that terminal faces close it. **This is a hypothesis to verify, not an instruction to implement a particular fix.** Also check winding, FrontSide culling, normals, material/lighting and selection clones. A solid with 0.2 m thickness should read as a solid from every relevant direction.

7. **S19 — extreme zoom-out grid fade is uneven.** At very large zoom-out distances the grid gets inconsistent: one direction's lines, especially horizontal-looking lines on screen, fades or vanishes while the other remains. It doesn't feel like an intentional transition. I don't want to set an arbitrary max zoom-out just to hide it. The camera already clamps target-plane height to 1,000 m; the S19 shader fades each axis independently from 16 to 8 CSS px and uses 1 m, 5 m and 25 m levels. Please check whether the observed asymmetry is expected perspective minification, a derivative/shader error, precision/aliasing or depth interaction. Compare orbit at fixed zoom and zoom at fixed orbit; test both axes and all grid levels. Propose a graceful visual end state, including a clean distant mat when no grid level can be drawn reliably. Only propose a tighter zoom bound if there is an independent product-scale reason. This may overlap the S19 flicker finding, but don't assume one root cause.

## What I need from the investigation agent

Please review all the above together as a **post-S19 integration/foundation audit**, not five automatic reopenings. Some observations may be outside S15–S19, and some may already be scheduled under S20–S25 or the S11 gate. Tell me which is which.

For each finding:

- Reproduce it against current `main` with a minimal source fixture, view/angle/zoom and browser details; record captures or a short orbit sequence for flicker.
- Trace **observed symptom → exact owning code path → confirmed cause**. Separate proven facts from hypotheses, and push back if my interpretation is wrong.
- Classify it as an implementation defect, accepted-but-unpleasant visual design, pre-existing foundation gap, or already-planned work. Point to the controlling contract/plan where relevant.
- Propose the smallest sound correction with likely files, owner track, tests, risk and regression coverage. State whether it needs a separate T1 geometry fix, an S18 visual follow-up, an S19 rendering correction, or can honestly land in an existing pending slice. Don't silently expand S22 or S23.
- For the isolated Wall, include mesh watertightness/edge-incidence and terminal-face/winding checks; test unselected and selected views at both ends and both long sides. Compare editor and visitor, and avoid a `DoubleSide` cosmetic workaround for missing solid faces.
- For the S19 flicker and far-zoom fade, isolate ground/grid from Wall and selection overlays, then check orbit and zoom motion, both grid axes, 1/5/25 m transitions and the distant no-grid state. A still-frame screenshot alone is not enough. Do not prematurely limit the Camera.
- Explain what would block **R217.S11** versus what is optional polish. No unrecorded waiver.

**Deliverable:** A short cause-and-fix report and a scoped implementation proposal, including any necessary plan/acceptance amendment for owner review. Do not modify product code, change shipped acceptance history, merge this PR, or mark R217 complete from this review alone. If evidence points somewhere unexpected, say so plainly.

Relevant anchors: R217.S15 PR #234, S16 #237, S18 #242, S19 #245; `docs/roadmap/r217-core-editor-stability/r217.s11-integrated-final-gate/implementation-plan.md` (especially J2, J5, J6, J13); `docs/roadmap/t1-spatial-world/README.md` (physical-Wall watertight coverage note).
