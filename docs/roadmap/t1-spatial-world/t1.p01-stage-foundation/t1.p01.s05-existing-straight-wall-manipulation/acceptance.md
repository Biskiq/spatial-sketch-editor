# T1.P01.S05 — acceptance record: Existing straight-Wall manipulation

**Slice:** T1.P01.S05 · **Status:** implemented on the slice branch, **not accepted** — independent
review and the merge gate are outstanding ·
**Plan:** [implementation-plan.md](./implementation-plan.md) (owns the criteria) ·
**Phase:** [T1.P01](../README.md)

**Tested revision:** branch `T1-P01-S05`, commits `1fb51ed8`, `7ab64ebf` and the doc-only
`4730fd1b` on base `919c2904` (batch C coordination, PR #155). The lane results below ran at
`7ab64ebf`; `test:arch` (including the documentation gate) was re-run after the
documentation-only commits. No merge gate
has been run on a merge revision, no capability or gate state is written, and nothing here claims
readiness or acceptance.

## What landed

| Area | Change | Evidence |
| --- | --- | --- |
| TD-8 (first increment, ruling C5) | The task-scoped instrument services no longer capture a writer generation; they capture the **task object** they were opened for. `instrumentForTask` answers live only while `session.task()` is that same object and the binding still owns the contributed task. Every accepted install closes the open task (there is no keep-open install path), so the old services refuse truthfully with `inactive-task` instead of the opaque `stale-epoch`; the install notifies the contribution surface synchronously so the panel learns immediately and can resume/reopen, which hands out fresh services. `Resume`, same-contribution re-open, close and disposal revoke the old services the same way. | `tests/lib/authoring/stage-host-acceptance.test.ts`: “re-provisions usable services after an accepted install closed the task”; “invalidates the previous services when the contributed task is replaced”; “refuses the same task-scoped services after the contributed task has ended”; “notifies the contribution surface synchronously when an accepted install closes the open task” |
| Exact length | `layout-wall-length` wraps the retained `planExactWallLength`; the payload carries one explicit `fixed: 'start' | 'end'`. | `tests/lib/authoring/layout-wall-manipulation.test.ts`: “honours the explicit fixed endpoint and writes exactly one history entry”; “registers one planner per Wall operation and refuses bad payloads and wrong addressees” |
| Exact angle | `layout-wall-angle` wraps `planExactWallAngle`; the intent carries canonical `atan2(z, x)` **radians**, the Dimensions field displays and accepts degrees. | “sets an exact angle in degrees and preserves the Wall length and identity” |
| Rigid translation | `layout-wall-move` wraps `planRigidWallMove`; both deltas are one intent and one history entry, and the typed deltas return to zero after acceptance. | “translates rigidly from both deltas as one intent, then clears the deltas” |
| Dimensions surface | A selected straight Wall gains Length, Angle (degrees), Move ΔX and Move ΔZ alongside the S04 fields, plus an explicit Start/End fixed-endpoint choice. A curved Wall keeps its S04 scalar fields and gains none of the straight-only ones. | “offers the Dimensions instrument with the Wall manipulation fields only for a straight Wall” |
| Pointer handles | The Layout adapter claims a press only while its Dimensions task owns it: endpoint drag = length (opposite endpoint fixed), shift-drag = angle, body drag = rigid translation. Preview is the retained planner's candidate from an immutable baseline; release commits once through the same `wallManipulationIntent`; Esc, an adapter `cancel`, task close, replacement, pointer cancel and capture loss cancel with no change. The route sends captured-loss adapter drags through the same explicit `cancel` as a pointer cancel (`cancelAdapterDrag`), not only through the host lease release. | “commits the same document as the typed length, with one history entry”; “shift-drags an endpoint to an exact angle and commits it once”; “translates the body rigidly from the pointer delta”; “cancels with no document change and releases the gesture lease”; “cannot pick through an inactive helper”; `stage-shell-composition.test.ts`: “holds the gesture contract at the route: refusals and every ending release once” (capture loss reaches the adapter cancel) |
| Reading flip | A changed evaluation id mid-gesture ends the writer **without a commit**, preserves the last explicit parameter as a paused proposal named in the overlay, and refuses the stale pointer-up. | “pauses on a reading flip, keeps the proposal, and never commits on the stale up” |
| Shared-Junction invalidity | A candidate that folds the Wall onto its shared boundary is refused by the retained planner; every Wall/Junction/Opening identity and the accepted content are unchanged, and no history entry is added. | “rejects a shared-Junction-invalid angle atomically and keeps every identity” |

## Criteria status

| Plan criterion | Status |
| --- | --- |
| Pointer and numeric paths yield the same document for the same explicit intent | **Verified** for exact length through the real adapter/facade: the Wall frame agrees at 1e-9 and the Wall and Opening id lists are equal. Pointer angle is now exercised separately (shift-drag → exact 5° with the fixed endpoint unmoved) and pointer body translation is exercised separately; a *same-document* comparison for angle and move is still not claimed. |
| One gesture has one history result | **Verified** on both paths for length, angle and rigid move (depth +1 per accepted operation, one entry per gesture). |
| Shared-neighbour invalidity rejects atomically | **Verified** for the 90° fold; no partial write and no identity churn. |
| Wall/Opening/Room identities and curve data preserved by supported operations | **Partial.** Wall and Opening ids are asserted for length and angle; curve data is preserved by construction because the retained planners refuse a curve (`curved_wall_unsupported`) and this slice exposes no straight-only field for one. Room identity is the planner's own reconciliation gate; the suite does not separately pin a Room id. |
| Plan and 3D handles/highlights resolve the same source | **Partial.** Handles are projected through the one live evaluation and the press is refused unless the canonical selection names a straight Wall. Highlight parity beyond the shared projection is not separately measured. |
| Inactive helpers do not pick | **Verified** (no contributed task open → the press is not claimed). |
| Navigation, reading changes, grid/snap and Esc generate no document-history entries | **Partial.** Reading change and Esc/cancel are verified with zero history entries. No grid/snap configuration exists in this host, so that clause is vacuous rather than exercised; navigation itself is the host's own gesture path and is unchanged by this slice. |
| M1/M2/M5 real composed-path exposure | **Verified through composition**: M1 by the F4 planner/intent path (not a direct document write), M2 by the sibling S04 scalar authority being untouched, M5 by the facade/factory rebuild and the gesture cancellation paths. The exposure-row mechanism verdicts remain the owner's separate closeout event. |
| M4 Wall-birth/noding identity | **Dormant and unexposed**, as the S04 record states; this slice creates no Wall. |

## Known gaps and risks

1. **Pointer resume is explicit but not a one-click control.** A reading flip preserves the
   parameter and names it; the creator applies it from the Dimensions fields (or cancels with Esc).
   There is no dedicated Resume button, so the plan's “offer explicit resume” is met by the typed
   path rather than by a pointer affordance.
2. **No grid/snap step exists in this host.** The drag parameter is exact; the plan's snap wording
   is therefore not exercised by this increment.
3. **Room identity** is protected only by the retained planner's reconciliation; no test pins a
   Room id across a supported edit.
4. **Affected-neighbour preview is not drawn.** A shared-Junction edit shows the planner's
   candidate for the manipulated Wall and names its refusal, but it does not separately highlight
   the neighbours that reshape. The plan's “preview affected neighbours/reach” is therefore met by
   the refusal/acceptance of the canonical planner, not by a neighbour overlay.
5. The **architecture-integration** tier's integration route (`T1.P01.S06`) and the full lane gate
   are outstanding. Lane results belong to the coordinator/merge gate, not to this record.
6. Browser evidence for the pointer journey is not recorded here.
7. **TD-8 followed option 2, not the plan's option 1.** The plan says “fix it host-side (TD-8
   option 1)” — rebuild the panel's services on `onAdaptersChanged`. The implementation instead
   makes the services' authority the task instance plus a synchronous close notification, because
   the same signal also fires for selection and re-binds and would have the panel re-acquire
   services on events that do not end its authority. This is a deliberate deviation from the named
   option; its rationale and the resulting lifetime contract (every accepted install closes the
   task, so the panel resumes/reopens; replacement and close revoke) are recorded in
   `docs/operations/tech-debt/README.md` TD-8. The record does not present it as the prescribed
   fix.

## Verification run at this revision

Run by the coordinator on this branch, on the working tree that becomes the slice commit. These are
lane results on a branch, **not** a merge gate against a merge revision.

| Check | Result |
| --- | --- |
| `npm run check` | **0 errors, 0 warnings** |
| `npm run test:fast` | **1959 / 1959**, 139 files, exit 0 |
| `npm run test:arch` | **163 / 163**, 20 files, exit 0 (documentation gate included) |
| `npm run test:heavy` | **118 / 118**, 8 files, exit 0 |
| Focused | `layout-wall-manipulation` 15/15, `stage-host-acceptance` 37/37, `stage-shell-composition` 7/7, `layout-precision-adapter` 13/13 |

The suites this slice adds or changes are:

- `apps/editor/tests/lib/authoring/layout-wall-manipulation.test.ts` (new; pointer shift-drag angle added)
- `apps/editor/tests/lib/authoring/stage-host-acceptance.test.ts` (TD-8 block)
- `apps/editor/tests/lib/authoring/stage-shell-composition.test.ts` (capture-loss → adapter cancel)
- `apps/editor/tests/lib/authoring/layout-precision-adapter.test.ts` (planner list)
