# T1.P01.S06 — acceptance record: Integrated final gate

**Slice:** T1.P01.S06 · **Status:** in progress — **not accepted** (owner-authorized 2026-10-20 as batch D, ruling D1)
**Plan:** [implementation-plan.md](./implementation-plan.md) (owns the criteria) · **Phase:** [T1.P01](../README.md) · **Declared** `FINAL PHASE GATE` artifact of T1.P01

TD-10 and the browser-discovered host defects are repaired. The owner ratified the bounded TD-11/12
amendment and the separate Index correction. The fixture browser pass now has recorded observations.
The corrected implementation and updated composition guard are at `d63bdb6c0ffbcbd6d2670d4f1c725f66e52194fa`, based on `origin/main`
`f412865512bfa2b5aa2d6ef58a9142c46a8b799a` through merge `5bca5d11`.
**Acceptance remains the owner's review; no phase closure, merge or architecture verdict is claimed.**

## Preserved browser and automated baseline — October 20

```text
tested revision   branch `T1-P01-S06`, based on `origin/main` `bb166c67` (the batch D merge)
                  TD-10 increment `21c18402`
                  Stage pointer/drag repair `5beb1e83` (this increment)
run               2026-10-20, local checkout, Node 26, macOS (arm64), local Postgres 18 on :5432
browser           Chromium via agent-browser (owned sessions), Vite dev on 127.0.0.1:5173,
                  API on :8787 with the test-auth seam (`agent-user-a`), 1280×757 and 720×640
```

## Authorization — owner ratified

The owner explicitly approved the [D1 corrective amendment](./d1-amendment.md) during the takeover,
ratifying `5beb1e83`'s TD-11/12 increments and the necessary existing S05 paused-proposal correction and
regressions. The owner separately approved the one-line raw Plan-state correction after a real
Index-selection `DataCloneError` reproduction. The [Batch D record](../../../../reference/decisions/batch-d-authorization-2026-10-20.md#d1-corrective-amendment--owner-approved-october-20-2026)
records both approvals. All other ownership constraints remain unchanged.

## TD-10 — closed (first increment)

`openSourceJson` and `applyReloadOffer` installed their admitted result without re-checking the session
epoch, unlike `load` and the resumed-save path. Both now capture `session.token()` before the admission
await and abandon a result whose epoch is no longer current, **before** any status branch, so a stale
action installs no source, adopts no saved base and reports neither a success nor a refusal.

**Regression:** `apps/editor/tests/lib/authoring/spatial-route-source-replacement.test.ts` — four
mounted route cases (delayed admitted Open superseded by an admitted reload; delayed refused Open;
delayed admitted Reload superseded by an admitted Open; delayed refused Reload), each proving the newer
project, its Stage node and its saved base survive with no stale notice.
**Mutation proof:** disabling either guard fails exactly those four cases (4 failed | 6 passed);
restoring them passes 10/10, and the paired `spatial-route-resume-save` suite stays 5/5.
Ledger: [TD-10 fixed](../../../../operations/tech-debt/README.md#td-10--a-late-successful-source-open-applies-after-a-newer-session-epoch).

## TD-11 / TD-12 — fixed, with takeover route regressions

- **TD-11 — pointer and overlay spaces.** The route sends Stage-local CSS while the Camera projects into
  viewport CSS. `resolveSourceHit` now adds the evaluated rect once, `overlays()` and the route's
  selection echo subtract it once, and no adapter or shell keeps a second translation. New cases:
  `stage-facade.test.ts` (offset hit resolution, offset adapter marker) and
  `layout-wall-manipulation.test.ts` (handle claim from Stage-local CSS).
- **TD-12 — press-scoped evaluation.** Adapter drags re-read `evaluationId()` on every phase; the Camera
  raises the generation per frame, so the press paused after its first move and could not commit. The
  press now carries the evaluation it was measured in. A reading change ends its lease, reaches the
  existing exact paused-proposal path, and clears ownership without a release commit.
- **Route coverage added:** `spatial-route-gesture.test.ts` uses the existing mounted-route probes
  with real Camera, facade, Layout adapter and F4. It covers offset hits/echo, uninterrupted evaluation
  updates, reading pause with exact Resume/Discard, stale release, navigation stability and cancellation.

## Preserved automated gate — green on `5beb1e83`

| Check | Result |
| --- | --- |
| `npm run check` (svelte-check, editor) | exit 0 — 0 errors, 0 warnings |
| `npm run build` (editor) | exit 0 |
| `npm run check:api`, `check:project-model`, `check:layout-core`, `check:camera-core` | exit 0 each |
| `npm run test:full` (complete editor suite) | exit 0 — **169 files / 2,218 tests** |
| `npm run test:arch` (unconditional lane) | exit 0 — 20 files / 166 tests |
| `npm run test:heavy` | exit 0 — 8 files / 118 tests |
| DB-backed `npm run test:api` (isolated database `biskiq_s06_gate`, no skips) | exit 0 — 11 files / **80 tests, 0 failed, 0 skipped** |
| Migration + concurrent-runner fence (`migration.test.mjs`, `migration-fence.test.mjs`) | inside the API lane above |

The full suite rose from 2,215 to 2,218 with exactly the three TD-11 cases (`5beb1e83`). The first
`test:arch` / `test:heavy` invocation in that earlier run reported one 5-second timeout each
(`documentation-references`, `camera-motion-dense-sweeps`) while the machine was loaded by the preceding
full-suite run; both lanes passed unchanged on an immediate clean re-run and neither suite touches the
changed files. The isolated gate database had to be recreated in this environment (`createdb
biskiq_s06_gate`) before the API lane; the lane then ran with migrations and the fence, not with skips.

## Browser journeys — executed

Same-origin evidence from the real route; the API-backed journeys ran against the local stack described
above, with the test-auth seam standing in for the external OAuth ceremony (its documented purpose).

| Journey | Observed |
| --- | --- |
| Starter boot, shared Stage, Plan/3D readings | Gallery boots through the real admission path and compiles; both readings render from one Stage |
| Plan select → precision edit | Selected Wall's `Dimensions` instrument accepted a 0.5 m length edit; Card and overlay followed the moved Wall |
| Typed refusal | A non-numeric length produced a typed refusal and no acceptance; the Wall stayed where it was |
| Undo / Redo | One accepted edit → Undo restores the pre-edit Plan, Redo reapplies it; history depth and labels tracked |
| Direct 3D edit and cancel | Handle drag previews live and commits once; **Escape** during a live drag clears the preview and leaves Undo disabled (mid-drag marker present, post-Escape marker count 0) |
| Save (create) | Signed in, a local starter saved as a cloud row at version 1; Head reported "Saved — All accepted changes are saved." |
| Conflict + *Reload remote* | A second session saved version 2; the first session's Save answered the typed conflict banner ("The cloud copy changed. Download your local work or reload the remote copy; nothing is merged automatically."). *Reload remote* asked the unsaved-work confirm, then installed the remote copy: history returned to baseline, the local rename was gone, and the server row still held the remote rename |
| Canonical source download | The download control produced 5,192 canonical bytes naming the project and the accepted revision, including the remote rename |
| Guarded replacement | `Open source JSON` opened the "Replace the current project?" guard; *Replace* installed the chosen source and reset history to a create-only baseline |
| Source reopen + refusal | Reopening the captured canonical source admitted it (`Nothing to undo`, `Save to Cloud`); a document for another project was refused with "The source was not opened: it is not the current document format… ($.acceptedRevision.projectId…)", project unchanged |
| TD-9 sign-in Save resume | Signed-out Save wrote the pending capture and redirected to sign-in; returning with `resume-save=1` offered "Resume pending Save" (never automatic); *Resume* replayed the exact capture, saved version 1, cleared the draft and reported "The pending Save completed." |
| Empty baseline | `Begin empty` mounts the empty baseline with its visible note and the Layout/Scene task set |
| Reduced motion | The Head's control toggles to "Reduced motion on" (`aria-pressed=true`); `prefers-reduced-motion: reduce` emulation is reported by the page |
| Narrow shell | At 720×640 the shell has no horizontal overflow |

The `Dimensions` observation from the previous revision is **resolved, not a defect**: the Card's
*Open task* opens the Plan membership body for a Layout subject, while the adapter field surface is
reached through the Index's `Inspect · Layout → Dimensions` task. Both are deliberate task homes; the
finding was an instrument/lens mismatch in how the journey was driven, not a missing contribution.

## Residual — Card over the Compose instrument (owner: T1 shell composition)

Reproduced, not fixed. With a subject selected and a Scene task open at **1280×900**:

```text
.card        box x 368 → 704, y 627 → 884   z-index 12   (from `.stage-frame`, `bottom: 1rem`, `inset-inline-start: 1rem`)
.instrument  box x 369 → 1262, y 658 → 888  z-index  6   (`left: 50%`, `bottom: 0.75rem`, centred)
```

The Card paints over the instrument's left third, hiding the Compose actions and clipping its text. The
cause is deterministic (two bottom-anchored overlays, the Card nearer the viewer). It stays a residual
because the correction is a shell-composition decision: how the Card and the bottom instrument band dock.
Owner: T1 shell composition, next T1 increment.

## Takeover implementation and browser evidence — October 20–21, 2026

**NOT ACCEPTED — owner review outstanding.** The owner instructed that further independent review
stop and that the result be pushed for their own review. After an immediate-wrap-up interruption, the
owner resumed completion of verification. No slice-closeout or phase closure has been performed.
Earlier automated results below remain historical; the final implementation results are recorded
separately at the end.

**Authorization:** the owner explicitly approved the [narrow D1 amendment](./d1-amendment.md), ratifying
TD-11/12 and the necessary S05 compatibility repair/regressions, then separately approved the Index
selection cloneability correction. No API, Camera-core, Layout/Scene planner or T3 authoring code changed.
The branch includes trusted `origin/main` `f412865512bfa2b5aa2d6ef58a9142c46a8b799a`. The
implementation revision is **`d63bdb6c0ffbcbd6d2670d4f1c725f66e52194fa`** (production repair `b1ffa4e3`). The research/prototype
changes brought in from accepted main are not S06 edits or acceptance evidence.

**Reading-flip verdict:** reproduced through the mounted route before repair. `setReading` dropped the
route press after the lease ended without reaching the Layout adapter's paused-proposal path.
The host now evaluates through the existing Camera and forwards a noncommitting changed-evaluation
move, then cancels pointer ownership. The adapter's existing mismatch path retains the exact request.
Ordinary frame generations retain the press id. Wheel/Fit/keyboard navigation is refused during a
claimed adapter drag so it cannot silently remap that press. No second controller or evaluator exists.

**Index selection:** real browser row selection threw `DataCloneError` when a reactive Plan fragment
reference reached immutable selection. Generated Plan evaluations are now `$state.raw`, replaced whole.
Mounted Index selection and real browser selection both work after this correction.

| Required condition | Actual takeover evidence |
| --- | --- |
| Nonzero datum and curved Wall | Admitted [fixture](./evidence/datum-curve-opening.json): 12 Walls, 3 Rooms, datum 1.25 m. Curved Wall Dimensions exposes Height/Thickness, no straight-only fields; height 3 → 3.2 accepted with Undo enabled. [Capture](./evidence/01-curved-datum.png) |
| Shared Junction | Real endpoint preview showed `Length 11.097 m · fixed start` and `Neighbour room-0:wall-2 reshaped by this edit`; Escape cancelled. [Capture](./evidence/13-shared-junction-preview.png) |
| Opening void/cap | Window fixture (offset 2, width 1.2, height 1.2, sill .8) admitted and selected in Plan and 3D; [precision](./evidence/05-opening.png), [3D](./evidence/14-opening-3d.png). A [focused 3D view](./evidence/15-opening-focused.png) after Bring into view/zoom/orbit visibly shows the void, sill and surrounding cap. Deeper correctness is covered by existing mesh/kernel suites. |
| Duplicate names | Two different Wall ids `room-0:wall-0` / `room-0:wall-1` selected independently; both Card name inputs read `Duplicate Wall`. Index labels remain identity-based. [Capture](./evidence/12-duplicate-names.png) |
| Independent coincident structures | Existing d12 exact-coincidence [fixture](./evidence/coincident.json), 8 Walls/2 Rooms; `k-a1` and `c-a1` independently selected with distinct canonical Card ids. [Capture](./evidence/06-coincident.png) |
| Dense geometry and long identity | Existing 40-Wall/10-Room all-curved [fixture](./evidence/dense-long.json); all 40 Wall rows present, search `wall-long-identity` located the 258-character id, Card retained it, no horizontal overflow. [Identity](./evidence/10-dense-long.png), [Plan](./evidence/11-dense-plan.png). The [same three search inputs](./evidence/browser-observations.json) were observed on 12-Wall and 40-Wall sources; all expected rows returned. Times were highly noisy (roughly 32 ms–14.7 s in this headless software-rendered run), so no speed/regression inference or threshold is claimed. |
| Empty → native plinth → precision → reopen | Numeric Place plinth succeeded. Repeated with X `2.734567890123`, Z `3.912345678901`; [downloaded source](./evidence/empty-plinth-source.json) and guarded reopen retain exact position `[2.734567890123,.5,3.912345678901]` and dimensions `[.8,1,.8]`, with Undo disabled after reopen. [Capture](./evidence/08-empty-reopened.png). Precision here is placement/inspection: Layout-plinth resize has no shipped writer; the Wall precision edit is the separate grouped journey. S04's historical “place → dimension edit” wording exceeds its delivered planner inventory and is not claimed. |
| Reduced-motion behaviour | Real browser normal Plan → 3D: first sampled frame still Plan, later frame 3D. Reduced motion on: Plan endpoint reached in the first two sampled frames. The [successful repeated observation](./evidence/browser-observations.json) used a fresh admitted source after dismissing an HMR/beforeunload interruption. |
| Narrow/short reachable controls | At 720×640: clicked Index collapse/expand, Plan, 3D, Fit, Open source guard and Cancel; clicked Place plinth, entered X=1.25/Z=2.5, placed a second object, then actual Undo/Redo buttons. Two object rows after Redo, Undo enabled, Redo disabled, no horizontal overflow. [Capture](./evidence/09-narrow-controls.png) |
| Reading pause and Resume | Browser retained `9.961108398437501 m · fixed start`, showed Resume/Discard, and Resume removed paused markers/instrument and enabled Undo. [Paused](./evidence/02-reading-paused.png), [resumed](./evidence/03-reading-resumed.png) |

**Executed takeover verification:** mounted route, source replacement, resumed Save, Wall manipulation
and facade suites: **5 files / 58 tests passed**. The new mounted route suite is **9/9**, covering
Index selection, offset hit/echo, continuous drag over evaluation updates, navigation stability,
exact-angle Resume, Discard, stale release, pointer cancellation, capture loss and Escape. It checks
one accepted history entry and subsequent Plan switching after Resume. Mutation controls: restoring the broken echo translation fails 1/9; per-frame press identity fails
7/9; direct reading-flip abort fails 2/9; reactive Index Plan state fails 1/9. Navigation before the
guard fails 1/9. Restoring the final implementation passes all nine. Final implementation verification is recorded below.
The mounted Resume path emits Svelte `derived_inert` development warnings after the old instrument
is destroyed; the browser and mounted assertions found no surviving paused marker/instrument.

**Review:** an independent agent initially found the reading-flip blocker and later ran the 9/9
mounted suite on the correction. It found the narrow approach technically sound, but did not accept
the complete slice. At the owner's subsequent instruction, no further independent review is sought.
The owner will review the pushed commit themselves.

**Acceptance frontier:** owner review remains outstanding. Existing Save/conflict/Reload/TD-9 evidence
above is preserved. Card-over-Compose remains the recorded T1 shell residual. Layout-plinth dimension
editing is not claimed. Four development-only `derived_inert` warnings arise after Resume destroys
the old instrument; subsequent reading changes work and no stale instrument or paused marker survives.
**BLOCKED for acceptance pending owner review; not merge-ready.**

## Final implementation gate — `d63bdb6c0ffbcbd6d2670d4f1c725f66e52194fa`

Executed October 21, 2026 on `d63bdb6c0ffbcbd6d2670d4f1c725f66e52194fa`. Subsequent changes are
documentation/evidence only; production, tests, package manifests and configuration are unchanged.

| Gate | Final result |
| --- | --- |
| `npm run check` | 0 errors, 0 warnings; exit 0 |
| `npm run build` | exit 0 |
| `check:api`, `check:project-model`, `check:layout-core`, `check:camera-core` | exit 0 each |
| `npm run test:full` | **170 files / 2,227 passed**, exit 0 |
| `npm run test:arch` | **20 files / 166 passed**, exit 0 |
| `npm run test:heavy` | **8 files / 118 passed**, exit 0 |
| DB-backed `npm run test:api` | **80 passed, 0 failed, 0 skipped**, exit 0; local `localhost:5432/biskiq_s06_gate` |

The API run includes all 11 prescribed files, migration rehearsal and concurrent-runner fencing.
An initial full run caught the composition suite's literal expectation of the old one-line abort.
The bounded source assertion now allows the existing adapter notification before ending the route
press; the real mounted test remains the behavioral proof. Final full, arch and heavy lanes passed
unchanged after that test correction. No assertion of a published gate, deployed activation, phase
closure or owner architecture verdict follows from these results.

The final documentation update reruns the whole arch lane before push. The owner requested no
further independent review; the pushed implementation awaits their acceptance. Until then the
required status is **BLOCKED / awaiting owner review**, with no slice-closeout or merge.
