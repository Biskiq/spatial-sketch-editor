# T2.P01.S04 — acceptance record: Bounded composition loop and final gate

**Slice:** T2.P01.S04 · **Status:** implemented on `T2-P01-S04`, **not accepted** · no gate
state or capability record is written here.
**Plan:** [implementation-plan.md](./implementation-plan.md) — owns the criteria
**Phase:** [T2.P01](../README.md) · **Register:** [phase slice register](../README.md#slice-register)

**Base revision:** `919c2904` (`origin/main`, PR #155 merge). This base does **not** contain
T1's TD-8 fix, which is `T1.P01.S05`'s first increment on the sibling branch. The journeys in
this slice therefore ran (and are expected to run) on the pre-fix host; no Resize/Duplicate/Delete
journey crosses an accepted install and then reuses the same mounted task panel, which is the
TD-8 shape.

**What this slice adds:** a contributed `Compose` task (`scene-compose`) with three scoped
commands — uniform positive Resize through the existing `resize-on-floor` planner, duplicate
through `duplicate-one` with a captured id, and delete through `delete-one` — plus three Find
entries (`Resize`, `Duplicate`, `Delete`) in the arrange rail. No Head, persistence, Save UI or
host seam was added. It reuses T1's shipped source-JSON download/open, replacement guard and
Reload remote.

**Capability truth.** Resize and Duplicate are offered only for a subject the planner can
re-seat: an admitted analytic primitive with a known contact, upright, and not a vertical plane.
The check is `floorTransformSupport` from the Scene planner module — the planner's own gate, not a
second capability model — so lights, planes, tilted primitives and models without verified
contact show no `Scale` Card fact and both commands are disabled with the reason shown.
`beginResize` refuses before taking the gesture lease, so a command that cannot produce a
candidate never blocks Undo. Delete needs no contact and stays available. A Resize proposal is
bound to the entity it was opened for: the panel cancels it when the canonical selection moves to
another entity, so the label, the candidate and the write cannot name different subjects.

**Primary new evidence:** `apps/editor/tests/lib/authoring/scene-composition-loop.test.ts`
(session parity/refusal tests, capability gating, duplicate/delete intents, an accepted-host
journey with exact-source undo/redo, and the downloaded canonical JSON reloaded through
`bootFromSourceJson`), plus `scene-compose-instrument.test.ts` (the mounted Compose panel's
disabled commands and selection-change cancel).

## Phase evidence matrix

Status vocabulary: **Written** = a focused test asserting the contract exists in this branch and
the coordinator is running it; **Partial** = some of the contract is proven and the remainder is
named; **Not run** = no evidence was produced. No row is claimed as accepted.

| Contract/failure | Status | Evidence and remaining work |
| --- | --- | --- |
| Canonical boot → place → commit (Scene successor to TD-1) | **Partial** | S03's `scene-editing-surface.test.ts` already covers place/commit from an admitted wall-first project, including empty/no-floor refusal. S04 changes neither boot nor placement; the new journey starts from the same admitted fixture. A production-route browser boot was not run. |
| Support parity | **Written** (numeric Resize) | `scene-composition-loop.test.ts` "previews the planner re-seat and commits that exact scale and Y": the shown candidate Y is the planner's `elevation − scale × contactMinY` and commit sends that same scale/contact pair. Plan/3D pointer parity for resize is not added: numeric scale is the guaranteed route and no direct resize handle was added. Nonzero elevation, boundary and choice-required cases remain S02/S03 coverage. |
| Truthful geometry | **Partial, with a named limit** | Resize preserves the entity's authored dimensions and changes only the uniform `scale` plus the compensating Y. **Resize and Duplicate are primitive-only** and exclude vertical planes and tilted primitives: eligibility reads the planner's own `floorTransformSupport`, so the disabled control, the session refusal and the planner cannot disagree. A light, plane, tilted primitive or a model without verified contact is refused by the session and disabled in the panel, and no `Scale` fact is advertised. A verified model-contact path is not implemented and no new native contact or footprint math was introduced. |
| Owned transforms | **Written** (primitive subjects) | Resize is one finite positive scalar; zero/negative/non-finite/blank are refused without averaging, the planner refuses a no-op, and X/Z/yaw are preserved by the planner — the intent itself carries only `scale` and `contactMinY`. Duplicate keeps pose/rotation/scale and adds exactly the planner's +0.5 m world X/Z. Delete removes only the named entity. |
| Preview/commit/lifetime | **Partial** | Resize preview and commit call the same retained planner with the same captured inputs; the lease is `cancel-on-reading-change` and a refused/invalid commit releases it. The panel cancels an open Resize when the canonical selection moves (`scene-compose-instrument.test.ts`). Duplicate/delete are immediate commands with no candidate to leave stale. Lost-capture and a direct pointer Resize handle are not implemented (numeric route only). |
| Selection and actions | **Written** (scoped actions) | Duplicate's completion selects the created entity at the post-accept revision; delete retires the subject and the host clears the selection. The planners (unchanged) refuse cluster-member duplication with `unsupported-set` and clean cluster membership on delete; those planner contracts are S02 coverage. |
| History and concurrency | **Partial** | The journey asserts the one host stack advances by exactly one entry per Resize/Duplicate/Delete and that Undo/Redo restore the **exact canonical source** (whole `snapshot.canonicalJson`, not just the tested fields). The Save half — dirty versus saved, an in-flight older Save not marking newer edits saved, a conflict preserving work until Reload — is cited from `save-state.test.ts`, not proven through the mounted Head, so this row is not Written. |
| Source persistence | **Partial overall — gate blocker** | Download writes `snapshot.canonicalJson`; `scene-composition-loop.test.ts` feeds exactly those bytes to `bootFromSourceJson` (the route's one open path), asserts the edited pose survives and the new host starts at depth 1 with no synthetic edit, and asserts an invalid source is `refused` rather than accepted. **Not proven:** cancellation of an active preview on replace, preservation of the previously mounted source after a refused open, and the Save creator journey through the mounted Head. The UI is T1's (PR #148) and was not re-driven in a browser here. |
| Wiring and isolation | **Partial** | Compose reaches the Stage only through AM-5 task/Find/instrument contributions and the existing `pointerIntent` seam (which it refuses). No host, route, shell, Layout or visitor file is edited. `test:arch` passed 163/163 (20 files, documentation gate included), but this slice adds no dedicated mutation control of its own. |
| Creator experience | **Partial** | Typed Resize → Duplicate → Delete → Undo → Reload is proven through the accepted host and real planners, not through a browser route. Place → select → arrange → resize → duplicate → undo → reload in both readings, keyboard focus order and reduced motion were **not run**; they remain the residual evidence gap for this gate. |

## Repository verification

Run by the coordinator on this branch, on the working tree that becomes the slice commit. These are
lane results on a branch, **not** a merge gate against a merge revision.

| Check | Result |
| --- | --- |
| `npm run check` | **0 errors, 0 warnings** |
| `npm run test:fast` | **1954 / 1954**, 140 files, exit 0 |
| `npm run test:arch` | **163 / 163**, 20 files, exit 0 (documentation gate included) |
| `npm run test:heavy` | **118 / 118**, 8 files, exit 0 |
| Focused | `scene-composition-loop` 11/11, `scene-compose-instrument` 3/3, `scene-editing-surface` 41/41, `scene-operation-acceptance` 9/9, `save-state` 16/16, `scene-instrument-focus` 3/3 |

The full contract required by
[`apps/editor/tests/README.md`](../../../../../apps/editor/tests/README.md#what-a-change-requires)
is therefore satisfied on the branch; the merge gate still has to be re-run at the merge revision.

## Final gate

**The phase final gate is NOT passed on this revision.** S04's implementation is coherent and the
lanes are green, but the persistence row still lacks the route-level proofs the plan names:
active-preview cancellation on replace, previous-source preservation after a refused open, and the
Save creator journey through the mounted Head.

**Unproduced work, with a named host boundary.** The behaviours exercised live in
`apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` and the Head Save mount, which
are T1 host files, but the plan makes *proving the journey* this slice's job ("This slice reuses
them and proves the journey"). A test-only harness that mounts and drives those modules is not a
host source edit, so these proofs are **outstanding in T2**, not blocked from being attempted. What
is genuinely cross-track is a behaviour change those tests might expose — for example, a refused
invalid-JSON Open that replaces the visible source would be a T1 host defect and would need a T1
follow-up or an explicit owner amendment, because the S04 plan forbids this slice from editing host,
Head, persistence or Save UI (`Scope correction, batch C ruling C4`). The review's capability defect
(plane/tilted eligibility) and the exact-source history proof are fixed on this branch; they do not
close the gate.

## Residuals

1. No direct Resize handle or pointer preview: the plan makes numeric scale the guaranteed route,
   so this is an admitted omission, not a defect.
2. No browser journey or reduced-motion evidence for the creator loop.
3. Resize and Duplicate are primitive-only and exclude vertical planes and tilted primitives. The
   docs now say so; verified model-contact capture is a separate capability, not something this
   slice quietly approximates.
4. S04 is the phase **final gate**. This record does not declare the phase closable or closed; the
   missing proofs above are the reason. They are unproduced T2 work, not a Scene-code blocker; any
   host behaviour they expose is T1-owned.
