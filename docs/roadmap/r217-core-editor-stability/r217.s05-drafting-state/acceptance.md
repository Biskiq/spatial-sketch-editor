# R217.S05 — acceptance record: Drafting state

**Slice:** R217.S05 · **Status:** accepted and closed out 2026-10-29; PR #226 remains open pending owner merge · **Plan:**
[implementation-plan.md](./implementation-plan.md) (owns the criteria) · **Phase:**
[R217](../README.md) · **Integration route:** [R217.S11](../r217.s11-integrated-final-gate/acceptance.md)

The owner authorized recovery and repair of existing PR #226 on 2026-10-29, limited to the
approved S05 plan and required verification. The independent review found the repair acceptable.
The owner-authorized closeout is recorded below. Merge remains a separate owner action; no phase
closure or merge is claimed here.

## Repair review evidence — 2026-10-29

**Tree:** branch `codex/r217-s05-drafting-state`, based on interrupted commit
`d5c7fe4854dda29c71e51ef4baa2ac025a2535bb` merged with `origin/main`
`ac944f02beaa892aa5579a03e0b5fa4561831cae`. Scene conflicts were resolved from S08's Card/marks
structure, retaining S05's shared drafting behavior. The first repair review ran against
`8c5e39b5325dab650cf6e3640a4ecac2623f5338` (tree
`25d96ef517a6b621fe04285e4e537d9fc8ca4294`). The follow-up repair adds an Automatic/Override
interval model, S08 Move regressions, and the narrowly scoped owner-authorized R217.S05 release
row. Verification for this follow-up is recorded below after the tested revision is finalized.

### Findings

- **P1 fixed — shared Snap ownership.** Layout Ink, pointer and typed Scene Place, and S08 object
  Move read the live drafting fact and the same adaptive current Grid minor. Alt/Option suspends
  snapping; support and Layout Junction/Wall precedence remain in front of free-point rounding.
  Grid and Snap announce the same interval, including below the configured 1 m reference interval.
- **P1 fixed — S08 integration.** The obsolete Arrange position/yaw editor was not restored. S08's
  object Card writers, Move/Turn/Size marks, support admission and F4 planner path remain in place.
- **P2 repaired — configured interval semantics.** Automatic mode refines with zoom. Override
  mode uses the selected interval as the lattice basis and shared Snap interval, coarsening only as
  needed to keep visible spacing legible. The 8–16 px transition, finer-line fade, and suppression
  rules remain. Both Grid and Snap labels use the same evaluated interval; regression coverage
  includes very small and very large overrides.
- **S08 Move regression coverage:** independent assertions cover Snap on, Snap off, and Alt/Option
  held; a captured Move observes a shared interval change; stale per-session Place state is ignored;
  movement is refused when snapping reaches the support floor boundary; accepted Move creates one
  F4 entry and Undo restores the prior position. Snap is not reintroduced into Card writers.

### Verification

- Follow-up verification was run on commit `c5273726f3b3d854c845857b79fdcbb7339373e8`:
  `npm run test:arch` passed, 193 tests
  across 23 files; full `npm test` passed, 3,101 tests across 243 files; the focused 10-suite
  S05/S08 run passed, 227 tests; `npm run check` passed with 0 errors and 0 warnings; and
  `npm run build` passed. Build emitted existing dependency externalization, unused import, and
  chunking notices. `git diff --check` passed. No API code changed; DB-backed API tests were not
  run.
- Browser: actual Ink and Place pointers were exercised in 2D/3D at 1:20 with Snap on/off and Alt
  held where applicable. Grid/Snap labels tracked Automatic zoom changes and a 5 m Override.
  Nothing was saved. Pointer Move could not be completed in this ephemeral `create=1` scene because
  the selected subject became stale after undo and the surface displayed “selected subject no
  longer exists in the restored source”; S08 Move behavior is covered by the numeric assertions
  above.

### Independent recovery review — 2026-10-29

The reviewing conversation `01a18a8e-a188-7e93-ae0f-c8b613fa7174` independently reviewed the
follow-up at `a1112eb6d091892c76a1a6acded8fd5f046e1039`, whose product implementation remains
`c5273726f3b3d854c845857b79fdcbb7339373e8`. Verdict: **acceptable for the owner-authorized
slice closeout; no unresolved substantive finding**. S08's object Card and mark modules are
unchanged against the merged S08 base. The interval override defect and release-list guard
failure from the earlier review are resolved. The reviewer reran the six affected grid, drafting,
Layout Ink, Scene editing, floor support and mounted-route contracts: **160 tests passed**.

The reviewer also closed the prior browser Move evidence gap on this same product revision:
in a fresh Enclosed room on the worktree's Vite server at port 5174, Place created a box at
X/Z `(2, 2)`, Place was closed, and the reading switched to 2D. Dragging the selected object's
Move mark with the active 0.5 m Snap committed `(1.5, 1.5)`. Repeating the same pointer path with
Snap off committed `(1.626129983, 1.365477549)`. Alt-modified keyboard input announced `Snap held`,
and repeating that path committed those same unsnapped coordinates. Releasing Alt restored
`Snap 0.5 m`. One Undo after each completed Move restored `(2, 2)` with the Card and marks still
available; no stale-selection warning occurred. Nothing was saved. The task-owned browser and
Vite server were closed after verification.

### Acceptance and closeout — 2026-10-29

Accepted following independent review of PR #226 revision
`a1112eb6d091892c76a1a6acded8fd5f046e1039`, with product implementation and full verification at
`c5273726f3b3d854c845857b79fdcbb7339373e8`. The approved architecture-integration tier and its
S11 integration route are recorded above; this slice does not claim the integrated final-gate
result. No source, test, or config files changed after product verification. The review re-ran six
affected behavioral suites (160 passed) and completed the real-browser Move scenarios recorded
above. Manual verification remains separate from automated tests; no DB-backed API tests were run.

**Outcome:** all S05 criteria are accepted at the reviewed revision. The independent review found
no unresolved substantive finding. Durable shared drafting behavior remains owned by the current
implementation and the S05 plan; no new cross-slice reference contract was required. S08 Card
writers and marks remain intact. The S11 final phase gate is outstanding, and R217 remains active.

Preservation details will be recorded in the closed-work stub at this path after its full body has been committed and anchored.

Closeout is documentation-complete. PR #226 remains open and unmerged; the owner retains the merge
decision. No phase closure, track completion, or cycle transition is implied.
