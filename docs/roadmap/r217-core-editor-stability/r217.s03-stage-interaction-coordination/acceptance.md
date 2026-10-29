# R217.S03 — closed-work acceptance stub

**AUTHORITY: NONE.** S03 gives the Stage one interaction authority: a cross-domain resolver that
arbitrates only between each domain's own winner, a no-task press offered only to the primary
selection's owner, session hover on the same resolver, and one interruption path that ends the press
and discards its candidate.

- **Accepted:** 2026-10-29 by owner direction, after the dedicated independent cross-domain review
  and correction of its one P2. Reviewed implementation `4b79e367`; accepted revision `80dead05` on
  S02-integrated `main` `71100651`. The correction was verified with focused regression checks
  instead of a re-review, per the owner's direction. These were technical reviews, not GitHub
  approvals.
- **Verification:** at `a78c8057` (the pre-integration implementation tree): `npm test` 235 files /
  2,976 tests including heavy correctness; `npm run test:arch` 23 files / 191 tests; editor check 0
  errors / 0 warnings; editor build; Layout, project-model, Camera, geometry-core and API checks;
  isolated DB-backed API suite 122 passed, 0 skipped. The corrected integrated tree (`80dead05` on
  `71100651`) passed the eight affected suites, 165 tests, including both Shape depth interruption
  regressions, and editor check 0/0. The corrected 2,400-sample pick differential (three fixtures ×
  two readings) was independently reproduced against pre-S03 `8c2c86e6` with zero baseline mismatch.
  Real-browser multi-touch capture ordering remains jsdom-stubbed; no browser capture trace was taken.
- **Entry points:** `apps/editor/src/lib/authoring/stage/stage-pick.ts`,
  `apps/editor/src/lib/authoring/layout/plan-pick-provider.ts`,
  `apps/editor/src/lib/authoring/stage/stage-facade.ts`,
  `apps/editor/src/lib/authoring/stage/stage-session.ts`,
  `apps/editor/src/lib/authoring/stage/stage-interruption.ts`,
  `apps/editor/src/lib/authoring/adapters/scene.adapter.ts`,
  `apps/editor/src/lib/authoring/adapters/scene/shape/reading.ts`,
  `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte`;
  regressions `apps/editor/tests/lib/authoring/stage-pick.test.ts`,
  `apps/editor/tests/lib/authoring/stage-pick-differential.test.ts`,
  `apps/editor/tests/lib/authoring/spatial-route-gesture.test.ts`,
  `apps/editor/tests/lib/authoring/stage-facade.test.ts`,
  `apps/editor/tests/lib/authoring/stage-interruption.test.ts`,
  `apps/editor/tests/lib/authoring/shape-reading-adapter.test.ts`.
- **Contract:** current interaction authorities and the cross-domain rule (finite forward 3D
  ray–surface hits outrank tolerance-only winners; Layout reports `depthMeters: null` when its finite
  pick surface is missed) are owned by
  [`architecture.md`](../../../reference/architecture.md#editor-interaction-authorities). Plan ranks
  and Paper appearance are now owned with S04's layer order.
- **Integration route:** [R217.S11](../r217.s11-integrated-final-gate/acceptance.md) owns the
  phase's integrated final gate and the full-tree result; this record covers S03's own evidence.
- **Residuals:** S04 supplies Paper layer ranks; S07 owns visible hover and the mark language; S10
  owns dock completion including Erase and Measure. Real-browser multi-touch capture ordering
  remains manual-owed.
- **Preservation:**

  ```text
  CLOSEOUT PRESERVATION — R217.S03 (2026-10-29)
  prose compacted:                 2   stubs at their own paths
  reference promotions:            1   interaction authorities in docs/reference/architecture.md
  renderable evidence archived:    0 files / 0 bytes
  evidence stubs / manifests:      0
  transient artifacts removed:     1   work checkpoint
  historical anchor:               80dead057d2925b2183280cdec40144c4781b30f · tag closed/r217.s03 (local only — not pushed)
  merge method:                    P1 GitHub merge commit; post-merge anchor verification owed
  new live → archive prose links:  0
  manual-owed verification rows:   1   real-browser multi-touch capture ordering
  remaining deferred items:        4   S04, S07, S10, S11
  permanent stubs added:           2
  ```

- **Recovery:**
  `git show 80dead057d2925b2183280cdec40144c4781b30f:docs/roadmap/r217-core-editor-stability/r217.s03-stage-interaction-coordination/acceptance.md`
  · tag `closed/r217.s03`.
