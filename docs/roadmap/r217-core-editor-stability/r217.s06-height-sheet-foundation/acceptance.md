# R217.S06 — closed-work acceptance: Height Sheet foundation

**AUTHORITY: NONE.** R217.S06 is shipped. The phase [slice register](../README.md#slice-register)
owns status; the Height Sheet seam remains described by the [implementation plan](./implementation-plan.md)
stub and the R217 phase contract. **Accepted 2026-10-30** after the owner-authorized independent
review verdict [ACCEPT FOR ROUTINE CLOSEOUT](./evidence/independent-final-review.md). The review
covers every approved criterion and prerequisite at the reviewed code/test manifest; no P0–P2
finding remains.

- **Delivered:** session-scoped Height Sheet, Plan-cut consumer, owner-provided Layout/Scene ticks,
  pins, access behavior and quiet 3D plane. Height and pins remain outside source and F4 history.
- **Verification:** architecture-integration tier via S11 route. Final combined `npm run test:full`
  passed 247 files / 3,154 tests; explicit heavy 11 files / 138; architecture 23 files / 193;
  `npm run check` 0 errors/warnings; build passed. Kernel/API checks passed; DB-backed API 122
  passed, 15 contracts, zero skipped. Focused documentation gate: 2 files / 56 tests. Evidence and
  exact code/test manifests are in `evidence/independent-final-review.md` and sibling evidence.
- **Entry points:** implementation `apps/editor/src/lib/authoring/stage/stage-height-sheet.ts`,
  `apps/editor/src/lib/authoring/stage/shell/StageHeightSheet.svelte`,
  `apps/editor/src/lib/authoring/adapters/scene.adapter.ts`,
  `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte`; regressions
  `apps/editor/tests/lib/authoring/stage-height-owner-integration.test.ts`,
  `apps/editor/tests/lib/authoring/spatial-route-gesture.test.ts`.
- **Residuals:** P3 one-time hint flag is module-scoped and may span separate Stage sessions; hint
  repetition only, owned by T1 follow-up TD-15. Grid, Wall ghost, direct-manipulation and general UX
  convergence remain outside this slice. S11 retains its integrated journey and final-gate work.
- **Renderables:** none captured. No reference promotion or new live-to-archive prose link.
- **Recovery:** `git show 9b5a42fe9c254db561a864905eaf3a3a7f989426:docs/roadmap/r217-core-editor-stability/r217.s06-height-sheet-foundation/implementation-plan.md`
  (anchor commit recorded below); tag `closed/r217.s06`.

## Closeout preservation — R217.S06 (2026-10-30)

- Prose compacted: 1 approved plan stub; detailed independent review/evidence retained.
- Reference promotions: 0. Renderable evidence archived: 0 files / 0 bytes.
- Evidence stubs/manifests: 0. Transient artifacts removed: 0.
- Historical anchor: `9b5a42fe9c254db561a864905eaf3a3a7f989426` · tag `closed/r217.s06` (pushed to origin).
- Merge method: P1 GitHub merge commit (PR #227); post-merge anchor verification required.
- New live → archive prose links: 0. Manual-owed verification rows: 0.
- Remaining deferred items: 1 P3 hint repetition; phase integration and deferred convergence remain S11/out-of-scope.
- Permanent stubs added: 1.
