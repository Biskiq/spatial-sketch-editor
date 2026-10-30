# R217.S05 — acceptance record: Drafting state

**Slice:** R217.S05 · **Status:** approved (plan); independent repair review pending · **Plan:**
[implementation-plan.md](./implementation-plan.md) (owns the criteria) · **Phase:**
[R217](../README.md) · **Integration route:** [R217.S11](../r217.s11-integrated-final-gate/acceptance.md)

The interrupted PR repair has been implemented in the R217.S05 worktree and is awaiting the
parent conversation's independent review. The slice is not released or accepted, and this is not
slice closeout.

## Repair review evidence — 2026-10-29

**Tree:** branch `codex/r217-s05-drafting-state`, based on interrupted commit
`d5c7fe4854dda29c71e51ef4baa2ac025a2535bb` with `origin/main`
`ac944f02beaa892aa5579a03e0b5fa4561831cae` merged in the working tree. The Scene conflicts were
resolved from the S08 main-side Card/marks structure, carrying only S05's shared placement snap
into it. Final repaired commit identity is recorded after the merge-resolution commit.

### Findings

- **P1 fixed — shared Snap ownership.** Layout Ink, pointer and typed Scene Place, and S08 object
  Move read the live drafting fact and the same adaptive current Grid minor. Alt/Option suspends
  snapping; support and Layout Junction/Wall precedence remain in front of free-point rounding.
  Grid and Snap announce the same interval, including below the configured 1 m reference interval.
- **P1 fixed — S08 integration.** The obsolete Arrange position/yaw editor was not restored. S08's
  object Card writers, Move/Turn/Size marks, support admission and F4 planner path remain in place.
- **P2 open — configured interval semantics.** While a Camera evaluation is active, changing the
  configuration's “Minor interval” updates view state but does not change the adaptive interval
  drawn or used by Snap. Automatic decimation must refine below 1 m, but the approved plan also
  calls this setting an interval override; the intended interaction between those behaviors needs
  owner review. The control is labeled accurately as the current Grid interval for Snap.

### Verification

- Focused S05/S08 contracts: `157 passed` across drafting arithmetic, adaptive grid, Layout Ink,
  Scene floor support, Scene editing and mounted route interaction.
- `npm run check`: passed. `npm run check:api`: passed.
- `npm run build`: passed; Vite emitted its existing dependency and chunking notices.
- `npm run test:heavy`: passed (`138 tests`).
- `npm run test:arch`: `192 passed, 1 failed`. The failure is
  `tests/docs/parallel-track-gates.test.ts`: the T1 baton names the owner-authorized recovery slice
  R217.S05, which is absent from the release list. The checkpoint explicitly records owner
  authorization to recover despite that stale release-list wording; no release-list row was added
  by this repair.
- Full `npm test`: `3097 passed, 1 failed` across 243 files. Its only failure is the same
  release-list guard described above. The targeted adaptive-interval assertions all pass.
- The DB-backed API test suite was not run: this worktree has no `.env` or `DATABASE_URL`, and the
  changed product surface is the editor. Creating a shared/default database target was avoided.
- **Browser:** the worktree Vite server was started explicitly on `localhost:5174`, then a fresh
  `Enclosed room` project was opened. Plan and 3D switched
  in both directions; mouse orbit and wheel zoom changed the 3D view; Scale detents and Fit all
  changed framing; Grid/Snap showed the same `0.5 m` active interval; Snap off, Alt/Option hold and
  release, and Grid off/on updated their words and visibility. No source was saved.

### Acceptance status

Independent owner review is pending. The release-list gate exception and configured-interval
semantics remain visible review items. This record does not claim slice acceptance, release,
closeout or phase status change.
