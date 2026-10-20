# T2.P01.S04 — acceptance record: Bounded composition loop and final gate

**Slice:** T2.P01.S04 · **Status:** implemented and final gate **PASSED** on the evidence below;
independent final-gate review recorded in [Review](#review) · phase closure is a separate owner event
**Plan:** [implementation-plan.md](./implementation-plan.md) — owns the criteria
**Phase:** [T2.P01](../README.md) · **Register:** [phase slice register](../README.md#slice-register)

**Integrated base:** `origin/main` `a4f15897` (PR #160 merge; it contains #156 and #159). The branch
merge commit `2cad26b9` joins the reviewed implementation `f39f630b` to that base, so the journeys
below ran on the corrected T1 host with TD-8 fixed. The pre-rebase evidence at `f39f630b` is
superseded by this record.

**What this slice adds:** a contributed `Compose` task (`scene-compose`) with three scoped commands —
uniform positive Resize through the existing `resize-on-floor` planner, duplicate through
`duplicate-one` with a captured id, and delete through `delete-one` — plus three Find entries
(`Resize`, `Duplicate`, `Delete`) in the arrange rail. No Head, persistence, Save UI or host seam was
added. It reuses T1's shipped source-JSON download/open, replacement guard and Reload remote.

**Capability truth.** Resize and Duplicate are offered only for a subject the planner can re-seat: an
admitted analytic primitive with a known contact, upright, and not a vertical plane. The check is
`floorTransformSupport` from the Scene planner module — the planner's own gate, not a second
capability model — so lights, planes, tilted primitives and models without verified contact show no
`Scale` Card fact and both commands are disabled with the reason shown. `beginResize` refuses before
taking the gesture lease, so a command that cannot produce a candidate never blocks Undo. Delete
needs no contact and stays available. A Resize proposal is bound to the entity it was opened for: the
panel cancels it when the canonical selection moves to another entity, so the label, the candidate
and the write cannot name different subjects.

**Accepted-install lifetime.** TD-8's fix closes the open task on every accepted install and retires
the panel's task-scoped services. The instrument therefore stops reporting through those services
after a committed Resize, Duplicate, Delete, pose Commit or **pointer commit**; only a refusal or
failure keeps using them. The pointer path is the session's outcome listener, which the adapter calls
only after its commit resolves, so it needs the same guard as the typed commands.
`scene-compose-instrument.test.ts` and `scene-proposal-lifetime.test.ts` pin that rule, and a real
browser run showed no page errors on Resize and Duplicate after the correction. This is a T2-owned
adapter fix, not a host change.

## Phase evidence matrix

Status vocabulary: **Proved** = the contract is exercised at the stated revision; **Deliberate
scope** = excluded by the approved plan with truthful refusal; **Failed** = the contract does not
hold. No row is claimed beyond its evidence.

| Contract/failure | Status | Evidence |
| --- | --- | --- |
| Canonical boot → place → commit (Scene successor to TD-1) | **Proved** | `scene-editing-surface.test.ts` (41) covers place/commit from an admitted wall-first project, including empty/no-floor refusal. The browser journey below starts from the canonical starter gallery, places one box and commits it as exactly one history result. |
| Support parity | **Proved** (numeric Resize) | `scene-composition-loop.test.ts` previews the planner re-seat and commits that exact scale and Y; the browser journeys showed `Candidate scale 2 · Y 1.000 m` in both readings and `scale 1.2 · Y 0.6 m` after a keyboard commit. Numeric scale is the guaranteed route; no direct resize handle was added. Nonzero elevation and contact-preserving re-seat are pinned by `scene-operation-planners.test.ts` ("resizes uniformly and compensates Y to keep the same contact elevation") and `place-object-candidate.test.ts` (2.5 m support elevation); coincident equivalent supports and elevation ambiguity by `layout-floor-support.test.ts`; no-support refusal by the session and panel suites. |
| Truthful geometry | **Proved, with a declared boundary** | Resize changes only the uniform `scale` plus the compensating Y. Eligibility reads the planner's own `floorTransformSupport`; a light, vertical plane, tilted primitive or model without verified contact is refused by the session and disabled in the panel, with no `Scale` fact advertised. The canonical model-footprint path is S01/S03 placement coverage, unchanged here. |
| Owned transforms | **Proved** (primitive subjects) | One finite positive scalar; zero/negative/non-finite/blank refuse without averaging; the intent carries only `scale` and `contactMinY`, preserving X/Z/yaw. Duplicate keeps pose/rotation/scale and adds the planner's +0.5 m world X/Z; delete removes only the named entity. |
| Preview/commit/lifetime | **Proved** | Preview and commit call the same retained planner with the same captured inputs; the lease is `cancel-on-reading-change`, a refused/invalid commit releases it, and the panel cancels when the canonical selection moves. An accepted install retires the panel without touching its services (new regression). Browser Resize/Duplicate produced no page errors. |
| Selection and actions | **Proved** (scoped actions) | Duplicate's completion selects the created entity at the post-accept revision; `scene-composition-loop.test.ts` asserts the new id is the canonical selection. The accepted install closes the panel, so the browser run observes the new subject through the selection card rather than a panel label. Delete retires the subject and the host clears selection. Cluster-member refusal and membership cleanup are S02 planner contracts. |
| History and concurrency | **Proved** | The browser journey downloaded the canonical source, then Undo ×2 and Redo ×2 restored **byte-identical** source (`equal: true`, 3,790 bytes): duplicate removal, scale 1→2 restoration, two entities with scale 2 at `[3,1,-1]` and `[3.5,1,-0.5]`. The Save half is proved through the mounted `EditorHead` over the real T3.P01.S02 state machine, the real F.4 host and the production Scene adapter (`head-save-journey.test.ts`): dirty versus saved, an in-flight older Save leaving newer edits dirty, and a conflict held until Reload. |
| Source persistence | **Proved** | `scene-composition-loop.test.ts` feeds the exact download bytes to `bootFromSourceJson`, asserts the edited pose survives and the new host starts at depth 1, and refuses invalid source. In the browser, the downloaded bytes were re-opened through the real `Open source JSON` replacement guard: both entities, scale 2 and positions survived into a new baseline; an invalid Open reported `The source was not opened: the JSON did not parse. The current project is unchanged.` with the mounted project and Undo still intact. T1's route regression (`spatial-route-source-replacement.test.ts`, 5/5 on this tree) proves the failed Reload keeps the local source and the `token-1` saved base. Replacement cancels an open Resize without committing it (`head-save-journey.test.ts`). |
| Wiring and isolation | **Proved** | Compose reaches the Stage only through AM-5 task/Find/instrument contributions and the existing `pointerIntent` seam (which it refuses); this slice adds no other wiring path. The mutation controls that make the relevant successor fail are S03's — `stage-host-acceptance.test.ts` (selection cleared instead of requalified, factory rebinding suppressed) and `scene-operation-acceptance.test.ts` (a mutation-control candidate the adapter admits but the record-scope guard refuses) — and remain green here. No host, route, shell, Layout or visitor file is edited by this slice. `test:arch` 163/163; boundary suites unchanged and green. |
| Creator experience | **Proved** | Real browser runs: starter gallery → Place object → Resize (numeric candidate and commit) → Duplicate → Undo/Redo → Download/Open source JSON at 1440×900 and 900×700, no page or console errors after the lifetime fix. Reduced motion was on for the final narrow-viewport run; a Resize committed by keyboard `Enter` produced `scale 1.2 · Y 0.6 m`, Undo enabled. The Plan-reading permutation is proved separately on the corrected tree: switch to Plan, open Compose → Resize…, enter scale 2 → `Candidate scale 2 · Y 1.000 m`, commit; the selection card showed `2 (uniform)` at Y 1 m, Undo enabled, and the downloaded canonical source held the same Block at `[2, 1, 2]`, `rotation [0, 0, 0]`, `scale 2` (3,294 bytes), with only Vite's connection messages in the console. |

## Repository verification

Run on the integrated working tree that becomes this slice's commit. `npm test` is the complete
suite; the lanes are reported separately because the merge gate names each one.

| Check | Result |
| --- | --- |
| `npm run check` | **0 errors, 0 warnings** |
| `npm test` (complete suite) | **2,269 / 2,269**, 171 files, exit 0 |
| `npm run test:arch` | **163 / 163**, 20 files, exit 0 (documentation gate included) |
| `npm run test:heavy` | **118 / 118**, 8 files, exit 0 |
| Focused | `scene-composition-loop` 11/11, `scene-compose-instrument` 6/6, `scene-proposal-lifetime` 9/9, `scene-editing-surface` 41/41, `scene-operation-acceptance` 9/9, `head-save-journey` 4/4, `spatial-route-source-replacement` 5/5, `save-state` 16/16, `scene-instrument-focus` 3/3 |
| Browser | starter → place → resize (2, then 1.2 by Enter) → duplicate → undo ×2 → redo ×2 → download/open source JSON; 1440×900 and 900×700; reduced motion on; `errors` empty after the lifetime fix. Plan reading: place → Plan → Compose → Resize 2 → commit → selection card `2 (uniform)` at Y 1 m, source `[2, 1, 2]` `scale 2`, no console errors. |

The merge gate must be re-run at the merge revision; this table is the branch gate.

## Deliberate scope and residuals

1. **No direct Resize handle or pointer preview.** The plan makes numeric scale the guaranteed route
   and admits a handle only when scale and pivot are legible; none was added.
2. **Resize/Duplicate are primitive-only.** A verified model-contact capability is not implemented;
   the panel and session refuse truthfully instead of approximating it. Model placement remains
   S01/S03 coverage, and a model-contact extension needs its own evidence.
3. **Cloud Save in the browser was not exercised.** This slice reuses T1's Head control and builds no
   Save UI (scope correction C4); with no API in the browser session the Save control is disabled,
   so Save is proved at the mounted-Head level above. A full cloud creator journey belongs to the
   host/S06 evidence.
4. **Delete was not separately run in the browser.** Its typed path is covered by the suite and the
   exact-source journey; it is not part of the plan's named creator-loop sequence.
5. **No 3D candidate mesh or renderer-level support test.** That is the disclosed S03 residual and is
   not reopened by this slice; the numeric candidate is the S04 presentation.
6. **The pointer commit path is guarded, not browser-dragged, in this round.** The typed commands
   were exercised in the browser; a pointer-originated commit is covered by the instrument
   regression that invokes the session's registered outcome listener with a committed outcome and
   asserts no task-service notification. The drag adapter itself is unchanged S03 code.

No criterion is marked **Failed** on this tree, and no acceptance criterion was weakened to reach the
result.

## Review

_(Independent final-gate review verdict is recorded here before closeout.)_

## Final gate

**PASSED** on this integrated tree, subject only to the independent review verdict above. This record
does not close the phase or the track; `T2.P01.S04` is the phase's declared final gate, so acceptance
makes the phase closable and leaves `PHASE CLOSE` to the owner.
