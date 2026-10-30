# R217.S09 — acceptance record: Native form marks

**Slice:** R217.S09 · **Status:** implementation reviewed — routine closeout pending · **Plan:**
[implementation-plan.md](./implementation-plan.md) (owns the criteria) · **Phase:**
[R217](../README.md) · **Integration route:** [R217.S11](../r217.s11-integrated-final-gate/acceptance.md)

## Independent review repair — S09-E2

Reviewed base head: `2d10d7afeff73ebd1d2933e5830041892d93bee0` (PR #228,
branch `codex/r217-s09-native-form-marks`). Worktree changes remain uncommitted. The focused
repair adds `native-form-paper-agreement.test.ts` and records evidence in
[`evidence/independent-paper-and-policy.md`](./evidence/independent-paper-and-policy.md).

Criterion 2 now has a rotated, hit-resolved Width edit through the mounted Stage host. The test
reads the accepted runtime Scene and retained Plan footprint, compares it with a fresh
`evaluateFormMesh` expectation, then feeds that same runtime projection into Paper. It verifies the
new Paper polygon matches Plan, the previous silhouette is gone, and the edit adds one history
entry. A second admitted fixture exercises centered Height with factor 2 in Plan and verifies the
preview scale, accepted scale, preserved support contact, and one history entry.

Existing policy tests confirm the mark and Card share the `[0.001, 100] m` extent bounds and refusal
without a policy change. The project-model planner continues to enforce scale factors `[0.01, 100]`.

## Verification recorded

All results below were run on the reviewed base head plus the current uncommitted shared worktree.
The S09-E2 contract is complete; this record does not accept S09 or claim the R217 final gate.

| Command | Result |
| --- | --- |
| `npx vitest run tests/lib/authoring/native-form-paper-agreement.test.ts` (from `apps/editor`) | Passed: 2 tests |
| `npx vitest run tests/lib/authoring/native-form-paper-agreement.test.ts tests/lib/authoring/shape-reading-adapter.test.ts tests/lib/authoring/native-form-marks.test.ts tests/lib/authoring/scene/plan-scene-form-footprint.test.ts tests/lib/authoring/stage-paper.test.ts` (from `apps/editor`) | Passed: 5 files, 61 tests |
| `npm run check` | Passed: 0 Svelte/type errors, 0 warnings |
| `npm run test:arch` | Passed: 23 files, 193 tests |
| `npm run test:heavy` | Passed: 11 files, 138 tests |
| `npm test` | Passed: 245 files, 3,122 tests |
| `npm run build` | Passed: editor production build completed; existing bundler warnings were emitted |

The R217.S11 integrated final gate is not claimed. Its required slice-acceptance prerequisites and
journey evidence are not established here. API checks were not part of this editor-only repair.

## Independent cumulative review — 2026-10-30

**Verdict: ACCEPT FOR ROUTINE CLOSEOUT.** No open P0–P2 finding or mandatory acceptance-evidence gap remains in the reviewed implementation. The owner explicitly authorized routine closeout after blockers were cleared and requested merge order **S06 / #227, then S09 / #228**. Formal acceptance and mechanical closeout are the next step; this review does not close the slice or phase.

The independently reproduced findings, their repairs, criterion-by-criterion review and exact code/test manifests are recorded in [evidence/independent-final-review.md](./evidence/independent-final-review.md). Final combined verification passed **247 files / 3,154 tests**, editor type checking with zero errors/warnings, and the production build. The explicit heavy run passed 138 tests. All kernel type checks and API type checking passed; the DB-backed API suite passed **122 tests with zero skips across 15 contracts** against a task-private PostgreSQL container, subsequently removed. Package/API sources and tests are unchanged by these editor repairs.

S11's remaining slices, phase journeys and phase-close decision remain owed to S11. This record establishes the per-implementation-PR merge gate for these two slices and does not claim the R217 final gate. Deferred grid, Wall ghost, direct manipulation and general UX convergence remain outside this work.
