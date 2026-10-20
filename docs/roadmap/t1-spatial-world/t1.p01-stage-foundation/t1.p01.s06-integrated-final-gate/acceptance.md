# T1.P01.S06 — acceptance record: Integrated final gate

**Slice:** T1.P01.S06 · **Status:** in progress — **not accepted** (owner-authorized 2026-10-20 as batch D, ruling D1)
**Plan:** [implementation-plan.md](./implementation-plan.md) (owns the criteria) · **Phase:** [T1.P01](../README.md) · **Declared** `FINAL PHASE GATE` artifact of T1.P01

This record claims only what was executed. TD-10 is closed, two further Stage-host defects found by the
browser leg are fixed, every automated lane the plan requires is green on this revision, and **most** of
the browser journeys now have recorded evidence. The fixture battery and two smaller observations are
still unexecuted, so the gate is **not accepted** and `T1.P01` is **not closable**.

```text
tested revision   branch `T1-P01-S06`, based on `origin/main` `bb166c67` (the batch D merge)
                  TD-10 increment `21c18402`
                  Stage pointer/drag repair `5beb1e83` (this increment)
run               2026-10-20, local checkout, Node 26, macOS (arm64), local Postgres 18 on :5432
browser           Chromium via agent-browser (owned sessions), Vite dev on 127.0.0.1:5173,
                  API on :8787 with the test-auth seam (`agent-user-a`), 1280×757 and 720×640
```

## Authorization note — one deviation, flagged for the owner

Batch D ruling D1 authorizes "the exhaustive integrated verification this plan declares and the narrow
TD-10 disposition", and no code outside the TD-10 repair. The browser leg could not be executed without
repairing two host defects that made Plan selection and direct manipulation unreachable
([TD-11 and TD-12](../../../../operations/tech-debt/README.md#td-11--stage-pointer-hits-and-overlay-markers-mix-stage-local-and-viewport-css)):
with the Index open, a Plan click resolved a subject one panel away, and a 3D handle drag never committed.
Both are one-boundary translations/state fixes with three new unit cases and no API, protocol or
store change. They are recorded here as a **deliberate scope excursion**, not as authorized work; the
owner should ratify or revert `5beb1e83` before this record is treated as acceptance evidence.

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

## TD-11 / TD-12 — fixed (this increment)

- **TD-11 — pointer and overlay spaces.** The route sends Stage-local CSS while the Camera projects into
  viewport CSS. `resolveSourceHit` now adds the evaluated rect once, `overlays()` and the route's
  selection echo subtract it once, and no adapter or shell keeps a second translation. New cases:
  `stage-facade.test.ts` (offset hit resolution, offset adapter marker) and
  `layout-wall-manipulation.test.ts` (handle claim from Stage-local CSS).
- **TD-12 — press-scoped evaluation.** Adapter drags re-read `evaluationId()` on every phase; the Camera
  raises the generation per frame, so the press paused after its first move and could not commit. The
  press now carries the evaluation it was measured in and is cancelled when the gesture lease ends
  (reading change), instead of released.
- **Owed:** route-level tests for the selection echo offset and for press-scoped evaluation identity;
  today they are covered by the facade/adapter cases plus the browser journeys below.

## Automated gate — green on `5beb1e83`

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
`test:arch` / `test:heavy` invocation in this run reported one 5-second timeout each
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

## Browser journeys — still not executed

- The fixture battery the plan names: nonzero floor datum, curved Wall, shared Junction, duplicate names,
  Opening void/cap, independent coincident structures, dense geometry, long identity. Their kernel and
  architecture coverage is green, but this is **not** the browser evidence the plan requires.
- Empty boot → **native plinth**: `Place plinth` was opened on the empty baseline and a Stage press
  accepted nothing; whether that is a correct typed refusal (no enclosure/support yet) or a broken
  placement was not established in this run.
- Reduced-motion **behaviour** (settled vs animated readings) beyond the control and media emulation.
- A narrow/short shell *interaction* pass (only overflow and layout were observed at 720×640).

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

## What therefore remains before acceptance

1. Run the fixture battery and the empty-baseline plinth journey in the browser, and establish whether
   the plinth press is a typed refusal or a defect.
2. Owner ratification (or revert) of `5beb1e83`, which exceeds D1's TD-10-only scope.
3. The route-level tests TD-11/TD-12 still owe, and the reduced-motion behaviour observation.
4. Then this record's acceptance, which is what makes `T1.P01` **closable** — closing it stays an
   explicit owner event, and the architecture-cycle verdicts stay `owner-verdict-owed`.
