# R217.S04 — closed-work acceptance stub

**AUTHORITY: NONE.** S04 makes settled Plan a drawing on Paper over the Plan evaluation and Scene
footprints the Stage already computes. The phase [slice register](../README.md#slice-register) owns
status; the current interaction and Plan-appearance contract is owned by
[architecture.md](../../../reference/architecture.md#editor-interaction-authorities).

- **Accepted:** 2026-10-29 by owner closeout and merge direction, after the one independent technical
  review at accepted revision `7bbbea5938f0291cf544283795df61bd7e2f0015`. That review raised two P2
  findings — partial union edges and registered-but-empty Scene roots — both fixed and covered by
  focused regressions before acceptance; no GitHub approval was recorded. The authorization covers
  S04 only and did not add a release-list row.
- **Delivered:** Vellum Paper with cut Wall poché, projected ink, hidden dashes, Opening symbols,
  Room-floor tint and Scene/model/primitive/native-form outlines. Paper reads the same
  `PlanEvaluation` and footprint projection as the pick path; appearance is a camera layer mask, so
  drawn and picked subjects agree without changing `Object3D.visible`. 3D sits on the dark mat with
  no fog; Shaded Plan remains the viewing preference; Camera pose, selection, armed tool, open work
  and history are preserved.
- **Verification:** `apps/editor npm run test:full` — 239 files / 3,021 tests passed; focused
  `stage-paper.test.ts` — 20 passed; `stage-paper-pick.test.ts` — 7 passed (real Three roots, both
  masks, late lazy mesh); `npm run test:arch` — 23 files / 193 passed; `npm run check` — 0 errors /
  0 warnings; `npm run build:editor` — success. Stage route Brotli 151,675 → 159,788 B (+8,113 B,
  +5.35%). Closeout documentation gate — 2 files / 56 passed, including every link and anchor this
  close moved. Built chunk scan found `StagePaper` / `buildPaperPlan` only in the Stage route chunk.
  Browser observation in Chromium covered 3D, Paper and Shaded Plan, a selected Wall, an Ink-placed
  door and a native primitive; the visual record is the archived evidence below. No automated
  screenshot diff was added.
- **Contract and entry points:** implementation
  `apps/editor/src/lib/authoring/stage/paper-plan.ts`,
  `apps/editor/src/lib/authoring/stage/paper-scene.ts`,
  `apps/editor/src/lib/authoring/stage/shell/StagePaper.svelte`,
  `apps/editor/src/lib/authoring/stage/shell/StageCamera.svelte`,
  `apps/editor/src/lib/authoring/stage/shell/StageCanvas.svelte`,
  `apps/editor/src/lib/authoring/scene/plan-scene-footprint.ts`,
  `apps/editor/src/lib/authoring/scene/scene-pick-source.ts`; regressions
  `apps/editor/tests/lib/authoring/stage-paper.test.ts`,
  `apps/editor/tests/lib/authoring/stage-paper-pick.test.ts`.
- **Integration route:** [R217.S11](../r217.s11-integrated-final-gate/acceptance.md) owns the phase's
  integrated final gate and full-tree result.
- **S07 handoff:** put Canvas marks on `STAGE_OVERLAY_LAYER` (2) with `depthTest: false` and
  `renderOrder` above `PAPER_LAYER.sceneFootprint` (60); never write `Object3D.visible` for
  appearance, selection or hover; do not parent overlay geometry under a pick root. Reuse
  `buildPaperPlan` and filter its entries by `sourceId` rather than regrouping streams. S04 owns none
  of S07's selection/mark files.
- **Residuals:** the Opening symbol is the representation's straight `centerPolyline`, with no swing
  arc until the representation carries one; S07 must remove its `root.visible` write; settled Shaded
  Plan remains a dark mesh field on the mat and may need a later appearance slice; S11 retains the
  integrated gate.
- **Evidence:** [archived captures and manifest](../../../archive/roadmap/r217-core-editor-stability/r217.s04-paper-plan/evidence/CLOSED.md).
- **Preservation:**

  ```text
  CLOSEOUT PRESERVATION — R217.S04 (2026-10-29)
  prose compacted:                 2   stubs at their own paths
  reference promotions:            1   Plan presentation, Plan ranks and appearance mask in docs/reference/architecture.md
  renderable evidence archived:    3 files / 260,110 bytes
  evidence stubs / manifests:      1   evidence/CLOSED.md
  transient artifacts removed:     0
  historical anchor:               7bbbea5938f0291cf544283795df61bd7e2f0015 · tag closed/r217.s04 (local only — not pushed)
  merge method:                    P1 GitHub merge commit (PR #223); post-merge anchor verification owed
  new live → archive prose links:  0
  manual-owed verification rows:   0
  remaining deferred items:        4   Opening swing representation · S07 visible-write removal · Shaded Plan restyle · S11 integrated gate
  permanent stubs added:           2
  ```

- **Recovery:**
  `git show 7bbbea5938f0291cf544283795df61bd7e2f0015:docs/roadmap/r217-core-editor-stability/r217.s04-paper-plan/acceptance.md`
  · tag `closed/r217.s04`.
