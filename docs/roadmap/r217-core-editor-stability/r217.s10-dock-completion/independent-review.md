# R217.S10 — independent combined T1/T2/T3/T5 review

**Date:** 2026-10-30 · **PR:** [#229](https://github.com/Biskiq/spatial-sketch-editor/pull/229) ·
**Reviewed implementation:** `cbc6269c` · **Current main:** `cc7e0537` ·
**Scope:** the [approved plan](./implementation-plan.md), S03/S05/S07–S09 contracts and existing regressions.

**Reviewer verdict: ACCEPT.** No unresolved P0–P2 finding remains in the reviewed S10 scope. This is an independent
review recommendation, not an owner acceptance or a slice/phase closeout. The owner expressly withheld
closeout and merge. One reviewer exercised the combined roles; no parallel reviewer agents were used.

## Reproduced defects and repairs

Every P1/P2 below was reproduced before classification. The controller and route failures have new
behavioral regressions in the existing owning test files; the real Head geometry failure is verified
in Chromium because the mounted route substitutes a Head probe with no browser layout.

| Severity | Reproduction on the submitted implementation | Repair |
| --- | --- | --- |
| P1 | Measure/Eraser down, render a frame, move/release: the retained press evaluation fails the current-evaluation host resolver. Eraser does nothing; Measure can settle at its old hover. | Host samples use the current evaluation. Genuine reading interruptions still cancel. |
| P1 | Read a Wall disclosure, erase an unrelated Scene object, Undo, then click the same Wall: the restored ids bypass the disclosure and delete immediately. | An accepted snapshot change spends the disclosure, candidate, notice and old press, including an Undo to identical source. |
| P2 | Start two deletes while the first action promise is unresolved: both domain actions run; an old completion can also restore words after disarm. | Serialize pending deletes and invalidate UI completions on clear/cancel/source change; thrown actions release the guard. |
| P2 | Coarse down on an object, slide away, return, release: the object is erased. | Leaving the pressed subject latches cancellation for that press. |
| P2 | Project the normalized real piano mesh's bounds corners in Paper: none resolves to Scene, because Select's footprint/silhouette gate runs first. | Scene admits its own visible rendered bounds corners within 8 px before its ordinary surface fallback, retains occlusion and publishes one winner to S03. Hidden bodies contribute no bounds. |
| P2 | Tap Box corner A, press B elsewhere, drag to C: preview uses A/C, commit uses B/C. | The remembered first corner is shared by preview and commit. |
| P2 | During the first captured Ink press, invoke Line/Box switch before any chain point exists: the release changes its operation. | Refuse mode changes while a press or a chain is live. |
| P2 | On the real 1280 px shell, hold an Eraser press: the three-line Undo refusal grows the Head, moving Stage top from 73.765625 to 86.15625 px and changing Camera scale; a stationary release misses the Wall. | Reserve the desktop capability caption space. Stage top stays 86.1875 px before and during the press; 500 ms disclosure and confirmed erase then work. |

The 2D tooltip also advertised `P`, which now arms Ink; it now advertises `2`.

## Cross-track acceptance

- **T1 / Eraser:** only the winning binding supplies the Card delete; Room floor/plinth refusal does
  not skip to another target. Explicit overlap proof keeps Select's Wall-first ranking while Eraser
  picks the host's Opening. Wall/Opening/primitive/form erase enters F4 once and Undo restores identity.
  Model dispatch is covered, and a fixture carrying the model resource and dependency lock now also
  proves the model delete and byte-identical Undo through F4. The source/disclosure and pending-action
  tests supplement the original suite.
- **T2 / Measure and Library:** a real Meshopt-decoded catalogue piano, normalized once, supplies
  rendered bounds in Paper and 3D. Textures alone are stubbed; geometry and transforms are real.
  Existing support-occlusion and Scene editing contracts stay green. Cross-domain endpoints use S03;
  datum fallback obeys Snap on/off; measurement changes neither source nor history nor proposals,
  and real Undo remains available during its navigation lease. Library still invokes the same Place
  task; browser placement creates a Block and preserves arming/selection until the placement accepts.
- **T5 / Ink and forms:** Box uses the unchanged chain planner, remains byte-identical to the same
  closed Lines under fixed id capture, keeps an existing Junction id, refuses degenerate extents and
  cancels a half Box without an entry. Form erase/Undo stays on Scene's existing delete-one path.
- **T3 / Dock, Find and keys:** all five keys arm without altering selection; Find uses the same
  entries; Escape clears host state, folds a contributed palette, then disarms. Mounted numeric
  routing proves `2` and the Dock letters reach the live writer. Existing source replacement,
  interruption, chronological history, Save-byte and visitor-isolation regressions remain in the gates.

## Browser evidence

Task-owned Chromium on the PR worktree, Enclosed room starter. The device preset changes viewport
only in this CLI version, so touch was explicitly enabled on the same browser through CDP; the
observed coarse media query was true. No other browser/session was changed.

- [Measure](./evidence/2026-10-30-independent-review/measure.png): slow drag between the enclosure's
  two upper corners settles at **7 m** across actual rendered frames.
- [Wall disclosure](./evidence/2026-10-30-independent-review/wall-disclosure.png): a 500 ms stationary
  press shows the domain's Room consequence; another 500 ms press erases, and Head Undo restores
  the Wall and Room. The reserved Head space keeps the Stage rectangle unchanged during the press.
- [Library placement](./evidence/2026-10-30-independent-review/library.png): L, typed X=3/Z=-2, Place
  creates a Block through the existing task.
- [Coarse keys](./evidence/2026-10-30-independent-review/coarse.png): all five measured **44 × 44 CSS px**.
  Native touch on the Block, away, back, release keeps its locator identity; a fresh touch/release
  removes it. This exercises the real browser's capture ordering as well as the controller regression.
- [Box](./evidence/2026-10-30-independent-review/box.png): native touch drag creates the closed Box
  above the starter enclosure. A browser wait using an absent collapsed-Index row selector timed out;
  the rendered result and mounted F4 assertions establish the outcome, not that wait.

## Verification

The final production/test diff based on `cbc6269c` passed all required gates:

| Gate | Result |
| --- | --- |
| `npm test` | 248 files, 3,184 tests passed |
| `npm run test:arch` | 23 files, 194 tests passed; rerun after the evidence/documentation update |
| `npm run test:heavy` | 11 files, 138 tests passed; also included in the final full suite |
| `npm run check` | 0 errors, 0 warnings |
| Camera/Layout/Geometry/Project-model package checks | All four passed |
| `npm run build` | Passed, including public/preview surface boundaries |
| `git diff --check` | Passed |

The final full suite ran after the last production/test edit. Subsequent finalization changes only
this review's evidence text; the unconditional architecture lane is rerun for that text.
 Initial concurrent arch/heavy runs each
hit one timeout (documentation scan / dense Camera sweep); the complete full suite passed, and
both lanes then passed when rerun without a competing full suite. No gate timeout was raised and
no test or exhaustive case was removed. No formal performance matrix or spot benchmark was run.

## Repository hygiene and owner decisions

The original release row was an implementation-authorization transcription, not evidence of
acceptance. The owner's current request independently authorizes this review and bounded repairs;
its row now records that request and removes the superseded no-independent-review condition.
The phase register remains in progress and owner acceptance remains unrecorded. No other track's
baton or closed phase was reopened. No planner, F4 format, Camera authority or post-S10 convergence
scope changed. The Head reservation repairs a reproduced erase failure; it is not a general shell restyle.

**No new scope waiver is needed for the repaired S10 criteria.** The existing `3` reading shortcut
still interrupts a live drag (covered by the existing paused-request regression); the approved S10
key change does not alter it. Any future decision to prioritize numeric `3` would amend that existing
key contract and is left to the owner. Catalogue placement admission remains unchanged; the piano
geometry test does not claim new placement admission or readiness.

The owner still decides whether to accept S10. Closeout, merge, S11 execution and convergence are
not authorized by this review.
