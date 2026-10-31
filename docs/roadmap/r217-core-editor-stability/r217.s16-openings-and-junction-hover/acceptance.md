# R217.S16 — acceptance record: Openings and Junction hover

**Slice:** R217.S16 · **Status:** implementation evidence refreshed; integration and slice
acceptance pending · **Plan:** [implementation-plan.md](./implementation-plan.md) (owns the
criteria) · **Phase:** [R217](../README.md) · **Integration route:**
[R217.S11](../r217.s11-integrated-final-gate/acceptance.md)

Implementation branch: `codex/r217-s16-opening-junction-hover` · implementation commit `334a38f4` ·
review-fix commit `6d0d37d9` · Pull request:
[#237](https://github.com/Biskiq/spatial-sketch-editor/pull/237).

The independent review found four P2 issues. This update fixes the shared 4 CSS px click
threshold for Junction and Opening-body presses, selected-Opening hit priority, Junction X/Z
numeric entry, and the missing cancellation, refusal, history, persistence, and viewport
evidence. The independent review has completed; no second review was requested. Integration and
slice acceptance remain pending.

## Verification

- `npm run check` — passed; Svelte check reported 0 errors and 0 warnings.
- Six affected contract files — passed, 191 tests:
  `plan-pick-index`, `stage-paper-pick`, `layout-wall-manipulation`, `stage-host-tools`,
  `stage-handles`, and `spatial-route-gesture`.
- `npm run test:arch` — passed, 23 files / 194 tests.
- The new contracts cover sub-threshold click behavior, Opening-over-Junction press priority,
  Junction numeric X then Z entry, Escape rollback, refused release, reading-flip interruption,
  exact Undo restoration, and Save-envelope read/admission with accepted Opening and Junction
  edits.

### Merge-gate repairs — 2026-10-31

The bounded repair starts at `df0ebddfa162fbb04ecbc5940aeee3da3d1039e7` and preserves the
earlier S16 gesture fixes. It addresses the two merge-gate failures:

- **3D hosted-Opening priority:** the new Select override ran in both readings. Stage only
  arbitrates between domain winners, so it could not recover the host Wall after Layout
  returned an Opening. The override now requires the rendered Plan reading; the existing
  Eraser policy stays intact. The facade contract asserts the host Wall's identity in 3D
  and its Opening's identity in Plan at the fixture's overlapping picks.
- **400-Room timeout:** the unchanged heavy contract passed all six tests in isolation, with
  the 400-Room case taking 44.4 s. Its exhaustive cold-compile and complete-output comparisons
  exceeded the old 120 s timeout under full-suite contention. The test now has 300 s of
  timeout headroom; all 24 edits, all three Room counts and every correctness assertion remain.

Verification of the repair:

- Four complete picking contracts (`stage-facade`, `plan-pick-index`, `stage-paper-pick`,
  `stage-host-tools`) — 58/58 tests passed.
- `npm test` — 255/255 files, 3,274/3,274 tests passed, exit 0; includes the complete heavy
  lane. The 400-Room case passed in 62.9 s. An earlier run alongside build/API work passed
  every assertion (including the 400-Room case in 209.6 s), but exited with Vitest's internal
  `Timeout calling "onTaskUpdate"` error; that run is not counted as a green gate. The
  complete suite was rerun with those jobs finished, without changing runner configuration.
- `npm run test:arch` — 23/23 files, 194/194 tests passed.
- `npm run check` — 0 errors, 0 warnings; `npm run build` — passed.
- Layout, project-model, Camera, geometry-core and API type checks — passed.
- `DATABASE_URL=postgresql://localhost:5432/biskiq npm run test:api` — 128/128 tests across
  all 15 API contracts passed, zero skips, using local PostgreSQL.
- `git diff --check df0ebddfa162fbb04ecbc5940aeee3da3d1039e7` — passed for the pending repair.

The browser captures below precede this repair; no new browser journey is claimed. Integration,
fresh independent review, merge and slice acceptance remain pending.

## Browser evidence

Manual journeys ran in the local editor at `http://localhost:5173` with the Index collapsed.
These captures support review; they do not record integration or slice acceptance.

| Viewport | Evidence |
| --- | --- |
| 1440 × 900 | Opening hover, slide preview and accepted slide, resize preview and accepted resize, and idle Junction hover: [Opening hover](./evidence/review-1440x900-opening-hover.png), [slide preview](./evidence/review-1440x900-opening-slide-preview.png), [slid](./evidence/review-1440x900-opening-slid.png), [resize preview](./evidence/review-1440x900-opening-width-preview.png), [resized](./evidence/review-1440x900-opening-resized.png), [Junction hover](./evidence/review-1440x900-junction-hover.png). |
| 1280 × 800 | Selected Opening and idle Junction hover: [Opening](./evidence/review-1280x800-opening-selected.png), [Junction](./evidence/review-1280x800-junction-hover.png). |
| 1180 × 820 | Selected Opening and idle Junction hover: [Opening](./evidence/review-1180x820-opening-selected.png), [Junction](./evidence/review-1180x820-junction-hover.png). |
| 820 × 1180 | Plan framing, selected Opening, idle Junction hover, rollback, refused resize, reading flip, Undo, and source JSON reopen: [Plan](./evidence/review-820x1180-plan.png), [Opening](./evidence/review-820x1180-opening-selected.png), [Junction](./evidence/review-820x1180-junction-hover.png), [source JSON reopened](./evidence/review-820x1180-source-roundtrip-after.png). |

### Transaction and persistence journeys

- **Escape rollback:** a Junction preview proposed X 0.500 m / Z 1.000 m; Escape discarded it and
  left the room outline unchanged. See [preview](./evidence/review-820x1180-junction-preview.png)
  and [rolled back](./evidence/review-820x1180-junction-escape-cancelled.png).
- **Refused release:** dragging the Opening width beyond the host Wall showed the planner
  refusal. Releasing kept Offset 3.5 m and Width 0.05 m unchanged. See
  [refusal preview](./evidence/review-820x1180-opening-outside-preview.png) and
  [unchanged Opening](./evidence/review-820x1180-opening-refused-unchanged.png).
- **Reading flip:** a live Junction proposal was canceled when the Stage switched to 3D; the
  post-release view has no proposal and Undo remains disabled. See [before](./evidence/review-820x1180-reading-flip-before.png)
  and [after release](./evidence/review-820x1180-reading-flip-after-release.png).
- **Undo:** an accepted Junction move changed the room outline; one Undo restored the original
  rectangle. The contract also asserts exact canonical source restoration. See
  [moved](./evidence/review-820x1180-junction-moved.png) and
  [restored](./evidence/review-820x1180-junction-undo-restored.png).
- **Save/reload:** the local editor exported source JSON and reopened it through Open source JSON;
  see the [reopened project](./evidence/review-820x1180-source-roundtrip-after.png). The separate
  Save-envelope contract captures accepted Opening and Junction edits, reads the envelope,
  admits it, and compares the reloaded units. The cloud Save control redirected to sign-in, so
  no account or remote save was created.

No release or merge is recorded here.
