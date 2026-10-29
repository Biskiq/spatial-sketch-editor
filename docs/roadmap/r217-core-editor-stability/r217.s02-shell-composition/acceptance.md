# R217.S02 — closed-work acceptance stub

**AUTHORITY: NONE.** S02 delivers the shared Head, locator Index, contextual Card and lower
working edge with browser-local preferences. The owner's 2026-10-29 ruling preserves Camera target,
orientation and vertical world extent on viewport resize; meters per CSS pixel follows viewport
height. No Camera implementation changed.

- **Accepted:** 2026-10-29, reviewed implementation and tests at `535af8d5`; independent T3, T2
  and T5 agent reviews were clean after corrections. These were technical reviews, not GitHub
  approvals. The owner's combined acceptance and closeout direction is limited to S02.
- **Verification:** `npm test` 234 files / 2,952 tests; `npm run test:arch` 23 files / 193 tests;
  editor check 0 errors / 0 warnings; editor build, Layout/project-model/Camera/API checks and
  isolated DB-backed API tests (122 passed, 0 skipped). Agent-browser checked coarse controls and
  Card/Instrument/furniture boxes at 1024 × 768 and 768 × 1024, and Experience Capture and Preview.
  The first full run's unrelated timeout passed in the isolated final run. No benchmark ran.
- **Entry points:** `apps/editor/src/lib/authoring/stage/shell/`,
  `apps/editor/src/lib/platform/app-preferences.ts`,
  `apps/editor/tests/lib/authoring/stage-shell-composition.test.ts`,
  `apps/editor/tests/lib/authoring/spatial-route-gesture.test.ts`,
  `apps/editor/tests/lib/authoring/spatial-route-resume-save.test.ts`.
- **Residuals:** S04 consumes the appearance preference, S05/S06 fill furniture slots, S10 owns dock
  completion, and S11 owns the exhaustive integrated gate. S03 separately integrates its claimed
  pointer/key handlers. Editor motion speed maps inspection time; Preview timing remains unchanged.
- **Preservation:**

  ```text
  CLOSEOUT PRESERVATION — R217.S02 (2026-10-29)
  prose compacted:                 2   stubs at their own paths
  reference promotions:            1   current shell summary
  renderable evidence archived:    0 files / 0 bytes
  evidence stubs / manifests:      0
  transient artifacts removed:     1   work checkpoint
  historical anchor:               63e925baa2aa64e75f562039348b7b1eddfc16f5 · tag closed/r217.s02 (local only — not pushed)
  merge method:                    P1 GitHub merge commit; post-merge anchor verification owed
  new live → archive prose links:  0
  manual-owed verification rows:   0
  remaining deferred items:        5   S03 integration, S04, S05/S06, S10, S11
  permanent stubs added:           2
  ```

- **Recovery:** `git show 63e925baa2aa64e75f562039348b7b1eddfc16f5:docs/roadmap/r217-core-editor-stability/r217.s02-shell-composition/acceptance.md` · tag `closed/r217.s02`.
