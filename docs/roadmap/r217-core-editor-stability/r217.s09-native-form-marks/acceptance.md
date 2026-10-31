# R217.S09 — closed-work acceptance: Native form marks

**AUTHORITY: NONE.** R217.S09 is shipped. The phase [slice register](../README.md#slice-register)
owns status; native-form mark behavior remains described by the accepted implementation. **Accepted
2026-10-30** after the owner-authorized independent review verdict
[ACCEPT FOR ROUTINE CLOSEOUT](./evidence/independent-final-review.md). All six approved criteria and
prerequisites were adjudicated; no P0–P2 finding remains.

- **Delivered:** native forms use the shared Stage Move and Turn marks, a no-write Scale disclosure,
  and Width, Height and Depth rays through the existing form-size planner/F4 path. Card and marks
  share size facts and refusal policy; old form-size and delete overlay marks are removed.
- **Verification:** architecture-integration tier via S11 route. Final combined `npm run test:full`
  passed 247 files / 3,154 tests; explicit heavy 11 files / 138; architecture 23 files / 193;
  `npm run check` 0 errors/warnings; build passed. Kernel checks and API check passed; DB-backed API
  122 passed, 15 contracts, zero skipped. The focused documentation gate is recorded in the S06
  closeout; S09 closeout documentation gate: 2 files / 56 tests passed.
- **Entry points:** implementation `apps/editor/src/lib/authoring/adapters/scene.adapter.ts`,
  `apps/editor/src/lib/authoring/adapters/scene/shape/form-size.ts`; regressions
  `apps/editor/tests/lib/authoring/shape-form-marks.test.ts`,
  `apps/editor/tests/lib/authoring/native-form-paper-agreement.test.ts`,
  `apps/editor/tests/lib/authoring/native-form-marks.test.ts`.
- **Contract:** marks call the existing planner and measurement path; dimensions remain 0.001–100 m
  with scale [0.01, 100]. Plan Paper follows the exact accepted runtime projection; no planner or
  form-policy change was needed.
- **Residuals:** Object Focus, outline editing, sections, shaping and anchors remain T5.P02 scope.
  Integrated R217 journeys and final-gate work remain owned by S11. Deferred grid, Wall ghost,
  direct-manipulation and general UX convergence remain outside this slice.
- **Renderables:** none captured. No reference promotion or new live-to-archive prose link.
- **Recovery:** the full plan and acceptance body are preserved at commit `ca1a149512b42e7618b74db2e2e08fcd58fe486c` under tag
  `closed/r217.s09`.

## Closeout preservation — R217.S09 (2026-10-30)

- Prose compacted: 1 approved plan stub; detailed independent review/evidence retained.
- Reference promotions: 0. Renderable evidence archived: 0 files / 0 bytes.
- Evidence stubs/manifests: 0. Transient artifacts removed: 0.
- Historical anchor: `ca1a149512b42e7618b74db2e2e08fcd58fe486c` · tag `closed/r217.s09` (pushed to origin).
- Merge method: P1 GitHub merge commit (PR #228); post-merge anchor verification required.
- New live → archive prose links: 0. Manual-owed verification rows: 0.
- Remaining deferred items: T5.P02 scope, S11 integrated journeys and final gate, plus deferred convergence.
- Permanent stubs added: 1.
