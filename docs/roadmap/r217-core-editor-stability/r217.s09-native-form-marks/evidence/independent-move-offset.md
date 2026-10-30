# S09 independent review repair — Move press offset

**Finding:** S09-P2-1 · **Reviewed head:** `2d10d7afeff73ebd1d2933e5830041892d93bee0` · **PR:** #228

The form Move gesture now captures the press point's visible floor support relative to the form
origin. During Move, it subtracts that captured offset from the current visible floor support before
applying the shared S05 snap step and calling the existing Scene mark planner. This preserves the
form's position when the pointer is stationary and moves it by the pointer's world-space delta.
Move-only refusal, preview and one-entry commit behavior continue through the existing support and
planner paths.

The regression coverage drives the real Stage host. It checks stationary and small drags with three
form yaws, one history entry for a valid movement, Plan snapping, 3D movement with Alt/Option snap
hold, and refusal of an unsupported out-of-room commit with no source or history change.

## Verification

- `npm test -- tests/lib/authoring/shape-reading-adapter.test.ts -t "preserves the Move press offset|applies Move offset"` — **passed** (2 tests).
- `npm run test:arch` — **passed** (23 files, 193 tests).
- `npm run check` — **passed** (0 errors, 0 warnings).
- `npm run test:fast` — **failed** (209 files passed; 2,788 passed, 2 failed). Failures:
  - `shape-reading-adapter.test.ts` — `keeps upright-form Height on the world axis in 3D` (expected size scale 1.5, got 1.4604).
  - `native-form-paper-agreement.test.ts` — `form did not publish its Width ray`.
- `git diff --check` — **passed**.

The two fast-lane failures are in Size coverage, outside this Move repair. The same worktree has
concurrent Size-gesture edits in `scene.adapter.ts` and an untracked `native-form-paper-agreement.test.ts`;
the fast-lane failures appeared while those changes were present. They remain unresolved here and
need retesting with the Size work. This record does not claim S09 acceptance or closeout.

Changes remain uncommitted on `codex/r217-s09-native-form-marks`.
