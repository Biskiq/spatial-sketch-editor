# T1.P01.S05 — acceptance record: Existing straight-Wall manipulation

**Slice:** T1.P01.S05 · **Status:** implemented on the slice branch, **not accepted** — independent
review and the merge gate are outstanding ·
**Plan:** [implementation-plan.md](./implementation-plan.md) (owns the criteria) ·
**Phase:** [T1.P01](../README.md)

**Tested revision:** `982bbe20` on branch `T1-P01-S05`, base `919c2904` (batch C coordination, PR
#155). The lane results below ran on the working tree committed as `982bbe20`, which includes the
round-2 fixes (signed pointer parameter, exact paused resume, full neighbour reach). The commits
`1fb51ed8`, `7ab64ebf` and `4730fd1b` are the earlier increments, not the tested tree; this record's
own documentation-only commit follows the tested tree and was checked with `test:arch` only. No merge
gate has been run on a merge revision, no capability or gate state is written, and nothing here
claims readiness or acceptance.

## What landed

| Area | Change | Evidence |
| --- | --- | --- |
| TD-8 (first increment, ruling C5) | The task-scoped instrument services no longer capture a writer generation; they capture the **task object** they were opened for. `instrumentForTask` answers live only while `session.task()` is that same object and the binding still owns the contributed task. Every accepted install closes the open task (there is no keep-open install path), so the old services refuse truthfully with `inactive-task` instead of the opaque `stale-epoch`; the install notifies the contribution surface synchronously so the panel learns immediately and can resume/reopen, which hands out fresh services. `Resume`, same-contribution re-open, close and disposal revoke the old services the same way. | `tests/lib/authoring/stage-host-acceptance.test.ts`: “re-provisions usable services after an accepted install closed the task”; “invalidates the previous services when the contributed task is replaced”; “refuses the same task-scoped services after the contributed task has ended”; “notifies the contribution surface synchronously when an accepted install closes the open task” |
| Exact length | `layout-wall-length` wraps the retained `planExactWallLength`; the payload carries one explicit `fixed: 'start' | 'end'`. | `tests/lib/authoring/layout-wall-manipulation.test.ts`: “honours the explicit fixed endpoint and writes exactly one history entry”; “registers one planner per Wall operation and refuses bad payloads and wrong addressees” |
| Exact angle | `layout-wall-angle` wraps `planExactWallAngle`; the intent carries canonical `atan2(z, x)` **radians**, the Dimensions field displays and accepts degrees. | “sets an exact angle in degrees and preserves the Wall length and identity” |
| Rigid translation | `layout-wall-move` wraps `planRigidWallMove`; both deltas are one intent and one history entry, and the typed deltas return to zero after acceptance. | “translates rigidly from both deltas as one intent, then clears the deltas” |
| Dimensions surface | A selected straight Wall gains Length, Angle (degrees), Move ΔX and Move ΔZ alongside the S04 fields, plus an explicit Start/End fixed-endpoint choice. A curved Wall keeps its S04 scalar fields and gains none of the straight-only ones. | “offers the Dimensions instrument with the Wall manipulation fields only for a straight Wall” |
| Pointer handles | The Layout adapter claims a press only while its Dimensions task owns it: endpoint drag = length (opposite endpoint fixed), shift-drag = angle, body drag = rigid translation. Preview is the retained planner's candidate from an immutable baseline; release commits once through the same `wallManipulationIntent`; Esc, an adapter `cancel`, task close, replacement, pointer cancel and capture loss cancel with no change. The route sends captured-loss adapter drags through the same explicit `cancel` as a pointer cancel (`cancelAdapterDrag`), not only through the host lease release. A length dragged **across** the fixed endpoint is refused: the parameter keeps its sign, so the preview cannot mirror to the opposite side the pointer never named. | “commits the same document as the typed length, with one history entry”; “shift-drags an endpoint to an exact angle and commits it once”; “refuses a length dragged across the fixed start endpoint and commits nothing”; “refuses a length dragged across the fixed end endpoint and commits nothing”; “translates the body rigidly from the pointer delta”; “cancels with no document change and releases the gesture lease”; “cannot pick through an inactive helper”; `stage-shell-composition.test.ts`: “holds the gesture contract at the route: refusals and every ending release once” (capture loss reaches the adapter cancel) |
| Reading flip | A changed evaluation id mid-gesture ends the writer **without a commit**, publishes the last explicit parameter as a paused proposal named in the overlay, and refuses the stale pointer-up. Dimensions offers **Resume** (apply the captured request exactly, revalidated by the retained planner) and **Discard**; the overlay label is full precision, and Resume never re-parses display text — the test asserts the submitted intent carries the captured radian value by strict equality. The overlay marker reads the same proposal store as the panel, so Discard removes it immediately. | “pauses on a reading flip, keeps the proposal, and never commits on the stale up”; “resumes a paused angle proposal at the exact captured value and adds one history entry” |
| Affected neighbours | A shared-Junction edit previews the reach: every Wall incident to a junction the request moved is marked at that junction's candidate point, read from the candidate document — not a second solve. A length/angle edit moves one junction; a rigid body move moves both, so both shared neighbours are marked. The marker reads Junction points, so a curved neighbour (which has no straight frame) is named too. | “commits the same document as the typed length, with one history entry” (length case) and “translates the body rigidly from the pointer delta” (both-junction case) |
| Shared-Junction invalidity | A candidate that folds the Wall onto its shared boundary is refused by the retained planner; every Wall/Junction/Opening identity and the accepted content are unchanged, and no history entry is added. | “rejects a shared-Junction-invalid angle atomically and keeps every identity” |

## Criteria status

| Plan criterion | Status |
| --- | --- |
| Pointer and numeric paths yield the same document for the same explicit intent | **Verified** for exact length through the real adapter/facade: the Wall frame agrees at 1e-9 and the Wall and Opening id lists are equal. Pointer angle is now exercised separately (shift-drag → exact 5° with the fixed endpoint unmoved) and pointer body translation is exercised separately; a *same-document* comparison for angle and move is still not claimed. |
| One gesture has one history result | **Verified** on both paths for length, angle and rigid move (depth +1 per accepted operation, one entry per gesture). |
| Shared-neighbour invalidity rejects atomically | **Verified** for the 90° fold; no partial write and no identity churn. |
| Wall/Opening/Room identities and curve data preserved by supported operations | **Partial.** Wall and Opening ids are asserted for length and angle; curve data is preserved by construction because the retained planners refuse a curve (`curved_wall_unsupported`) and this slice exposes no straight-only field for one. Room identity is the planner's own reconciliation gate; the suite does not separately pin a Room id. |
| Plan and 3D handles/highlights resolve the same source | **Partial.** Handles and affected-neighbour markers are projected through the one live evaluation, and the press is refused unless the canonical selection names a straight Wall. Highlight parity beyond the shared projection is not separately measured. |
| Inactive helpers do not pick | **Verified** (no contributed task open → the press is not claimed). |
| Navigation, reading changes, grid/snap and Esc generate no document-history entries | **Partial.** Reading change and Esc/cancel are verified with zero history entries. No grid/snap configuration exists in this host, so that clause is vacuous rather than exercised; navigation itself is the host's own gesture path and is unchanged by this slice. |
| M1/M2/M5 real composed-path exposure | **Verified through composition**: M1 by the F4 planner/intent path (not a direct document write), M2 by the sibling S04 scalar authority being untouched, M5 by the facade/factory rebuild and the gesture cancellation paths. The exposure-row mechanism verdicts remain the owner's separate closeout event. |
| M4 Wall-birth/noding identity | **Dormant and unexposed**, as the S04 record states; this slice creates no Wall. |

## Known gaps and risks

1. **Resume is a Dimensions control, not a pointer affordance.** A reading flip publishes the
   exact captured request; Dimensions shows its full-precision label with Resume/Discard. The
   creator returns to the panel to apply it, rather than clicking the overlay, because the
   overlay contributes no click surface in this host.
2. **No grid/snap step exists in this host.** The drag parameter is exact; the plan's snap wording
   is therefore not exercised by this increment.
3. **Room identity** is protected only by the retained planner's reconciliation; no test pins a
   Room id across a supported edit.
4. **Neighbour preview is one marker per reshaped Wall**, at the moved junction's candidate point.
   It does not draw the neighbour's full candidate body or its other endpoints; the canonical
   candidate remains the authority.
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
| `npm run test:fast` | **1962 / 1962**, 139 files, exit 0 |
| `npm run test:arch` | **163 / 163**, 20 files, exit 0 (documentation gate included) |
| `npm run test:heavy` | **118 / 118**, 8 files, exit 0 |
| Focused | `layout-wall-manipulation` 18/18, `stage-host-acceptance` 37/37, `stage-shell-composition` 7/7, `layout-precision-adapter` 13/13 |

The suites this slice adds or changes are:

- `apps/editor/tests/lib/authoring/layout-wall-manipulation.test.ts` (new; pointer shift-drag angle, endpoint crossing, exact paused resume with intent-payload assertion, and neighbour preview for both one-junction and rigid-move edits added)
- `apps/editor/src/lib/authoring/adapters/layout/paused-proposal.ts` (new; the paused parameter store)
- `apps/editor/tests/lib/authoring/stage-host-acceptance.test.ts` (TD-8 block)
- `apps/editor/tests/lib/authoring/stage-shell-composition.test.ts` (capture-loss → adapter cancel)
- `apps/editor/tests/lib/authoring/layout-precision-adapter.test.ts` (planner list)
