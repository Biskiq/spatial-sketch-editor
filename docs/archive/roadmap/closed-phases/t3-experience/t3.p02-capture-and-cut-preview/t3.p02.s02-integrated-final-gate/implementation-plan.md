# T3.P02.S02 — First Guide, Camera return and integrated final gate — CLOSED STUB

```text
VERIFICATION: exhaustive
AUTHORITY: NONE — closed work. Slice lifecycle → ../README.md#slice-register. The result, owner rulings,
           verification counts and deferred residuals → ./acceptance.md (the live FINAL PHASE GATE artifact).
STATUS:    shipped as `owner-override` (not reviewed) 2026-10-24 at merged revision `335820d6`
           (merge `bf6b2e1f` of main `0b96c577` plus the round-4 fix). Phase T3.P02 is CLOSABLE, not closed.
DELIVERED: first Guide creation (`experience-guide-create`, and `firstGuide` in `experience-capture-bind`:
           one accepted result, one undo payload); Camera-output handover/return for Preview
           (`enterPreview` / `returnPreview` / `cancelPreview`; a refused return re-acquires inspection);
           bounded Round 2 Capture/Guide dock expression; warm Preview surface (built when the Experience
           lens opens, hidden, inert and on-demand between sessions; zero WebGL draws while hidden).
CONTRACT:  the plan's scope, bounded changes, file surfaces and integrated acceptance matrix are preserved
           at the recovery copy below. Matrix results: ./acceptance.md#acceptance-matrix.
PROVENANCE: implementation 44990fad · Preview-chrome fix 035965e8 · journey spec 6df26f3e · warm entry
           f6de016d · review and round-4 fixes 335820d6 · merge bf6b2e1f · PR 184.
EVIDENCE:  ./acceptance.md#verification-record — type check 1825 files 0 errors; npm test 2403/2405 (both
           failures 5 s timeouts under host load ~58, each passing in isolation); arch 178 passed; heavy 125
           passed; test:api 95 passed, 0 skipped; integrated journeys 6 passed; focused 12 + 9 passed.
           Performance rows are starter-workload pre-flight at f6de016d, deferred by owner ruling.
ENTRY POINTS:
  implementation  packages/project-model/src/units/planning.ts
                  apps/editor/src/lib/authoring/experience/commands.ts
                  apps/editor/src/lib/authoring/experience/preview-handover.ts
                  apps/editor/src/lib/authoring/experience/ExperienceSurface.svelte
                  apps/editor/src/lib/authoring/stage/camera-session.ts
                  apps/editor/src/lib/visitor/VisitorPreviewSurface.svelte
                  apps/editor/src/lib/visitor/VisitorCameraDirector.svelte
                  apps/editor/src/routes/project/[projectId]/spatial/+page.svelte
  validation      no separate fixture; the browser proof is the two specs below
  regressions     apps/editor/tests/lib/experience/first-guide.test.ts
                  apps/editor/tests/lib/experience/preview-handover.test.ts
                  apps/editor/tests/lib/visitor/visitor-camera-director.test.ts
                  apps/editor/perf/flows/integrated-journeys.spec.ts
                  apps/editor/perf/flows/preview-lifecycle.spec.ts (listed only; not run)
RESIDUALS  (named in ./acceptance.md#owner-ruling--performance-and-unrun-rows-deferred-2026-10-24):
  performance, Scope A  traced Preview first frame; capture/bind completion ≤ 100 ms; M-workload F10 rows;
                        F13 re-measure at the final revision; owner reference-machine run and H0 trace-method
                        ruling; Stage initial-load delta. Owner: a future performance/scale exploration.
  unrun, Scope B        Preview-then-source-replacement browser probe; dense 20/50-View and 15/30-Stop
                        fixtures; touch/coarse pointer; DOM reach / Info without raycast; Experience paused
                        editing; Ask Rule; browser Save/download/reload journey; partial Two-Experiences
                        shared-Camera row; Travel/detour browser rows.
  seam (T1)             host EditorCard has no Experience contribution seam; Presentation and Stop facts stay
                        in the Experience lens inspector.
  shared file           PR 185 (T2.P02.S02) also edits +page.svelte and VisitorPreviewSurface.svelte; whichever
                        merges second merges main and reruns its gate.
RECOVERY:  git show 6d87e25b9ab4695472d96c0b3ef3a15b777bc062:docs/roadmap/t3-experience/t3.p02-capture-and-cut-preview/t3.p02.s02-integrated-final-gate/implementation-plan.md
           · git show closed/T3.P02.S02:docs/roadmap/t3-experience/t3.p02-capture-and-cut-preview/t3.p02.s02-integrated-final-gate/implementation-plan.md
```
