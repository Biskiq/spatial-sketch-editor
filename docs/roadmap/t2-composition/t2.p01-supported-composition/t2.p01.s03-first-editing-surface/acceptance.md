# T2.P01.S03 — acceptance record: First coherent editing surface

**Slice:** T2.P01.S03 · **Status:** accepted 2026-10-18 — shipped
**Plan:** [implementation-plan.md](./implementation-plan.md) — owns this slice's acceptance criteria
**Phase:** [T2.P01](../README.md) · **Register:** [phase slice register](../README.md#slice-register)

**Owner acceptance:** 2026-10-18, recorded from the slice owner's deliberate `slice-closeout`
invocation, resumed after an earlier closeout stopped on a correctness defect. The invocation is the
owner acceptance event; it did not waive independent review, which is recorded below and covers this
implementation revision.

**Verification tier:** `architecture-integration`, declared by the plan. The declared **integration
route** is [T2.P01.S04](../t2.p01.s04-bounded-composition-loop/implementation-plan.md), the phase's
declared FINAL PHASE GATE; the integrated result is owed there and is not claimed here.

## Delivered

The first coherent Scene editing surface over the landed F4/host contracts:

- **Two contributed tasks** — `place-object` and `scene-arrange` — registered through S07's
  contribution points, with one shared `ScenePlacementSession` per accepted source and reading for
  pointer and typed entry (`src/lib/authoring/adapters/scene.adapter.ts`).
- **Typed exact entry** on X, Z and yaw: `setEntry` plans the same canonical F4 intent a pointer
  release would, shows the captured candidate in the form and in the overlay/ghost, and installs
  exactly that pose through `commit()`.
- **One proposal identity** — the surface registry, the overlay, the ghosts and the instrument are
  keyed by the accepted source and the *reading*, not by the frame's evaluation generation
  (`sceneReadingKey`), so the Stage's own redraw no longer destroys a live proposal.
- **Lifecycle** — a genuine reading change (Plan↔3D), an ended gesture lease, task close, accepted
  source replacement and adapter unmount all still cancel the proposal and release its lease once.
- **Canonical acceptance** — commits go through `F4.intent-acceptance@1:local-single-domain-v1`;
  undo/redo are the host's history, and Undo is unavailable while a proposal is live.

## Verification — recorded at the tested revision

The tested revision is implementation commit `8381dc54`, which carries the production change and the
tests recorded here; the closeout edits after it are documentation only. The full contract is the editor suite: `test:fast`,
`test:arch` and `test:heavy` were all run, and nothing was path-gated.

| Check | Command | Result |
| --- | --- | --- |
| Svelte/TS diagnostics | `npm run check` | 0 errors, 0 warnings |
| Fast lane | `npm run test:fast` | 138 files / 1939 tests passed |
| Architecture lane | `npm run test:arch` | 20 files / 163 tests passed |
| Heavy lane | `npm run test:heavy` | 8 files / 118 tests passed |
| Focused, component-level | `npx vitest run tests/lib/authoring/scene-proposal-lifetime.test.ts tests/lib/authoring/scene-editing-surface.test.ts` | 9 and 40 tests passed |

Focused coverage added by this slice's repair, each proved by mutation (it fails with its own
mechanism removed, and only then):

- `tests/lib/authoring/scene-proposal-lifetime.test.ts` — the real instrument mounted over a
  published surface: a live proposal and its exact entry survive ordinary re-evaluation; a reading
  change cancels it; a lease that ends under an unchanged reading cancels it (both through
  `ensureSession` and through the frame loop, each failing when its own call is removed); the form
  adopts a registry surface that replaces the same reading; the fields show the captured candidate
  and never resurrect a replaced entry; a refused entry keeps the form, a refusal that ended the
  lease closes it and keeps the reason; unmount releases the proposal it shows.
- `tests/lib/authoring/scene-editing-surface.test.ts` — the real session/facade: the typed candidate
  survives an ordinary evaluation, the overlay label, ghost centre/yaw and committed intent payload
  are the same pose, and each exact entry plans from the pose the previous one captured.
- `tests/lib/authoring/scene-instrument-focus.test.ts` — the three `focusout` scopes that previously
  cancelled the proposal `Begin` had just opened.

## Independent review

Three rounds, all recorded in this slice's review artifacts and PR #147:

1. Two independent reviewers on the first repair (reading-keyed surfaces, untracked effect,
   `onDestroy`): **APPROVE with required fix** and **REJECT on one required fix** — a lease ended
   under an unchanged reading was never cancelled. Fixed by `proposalLive()` consumption in
   `dropDeadProposal`, plus registry-authority adoption (`replaced`).
2. Re-review of that fix: **APPROVE**, with the refusal-state and test-attribution gaps it named.
3. Review of the final revision: **APPROVE**, no open finding. The only change after that verdict is
   the recoverable-refusal regression case the review itself asked for (test-only; production files
   unchanged since the verdict).

## Browser evidence — desktop Chrome via `agent-browser`

Real dev server, a real enclosed-room project, real pointer/keyboard input:

| Journey | Observed |
| --- | --- |
| Begin → exact X/Z → redraw (`Fit`) → Commit → Undo → Redo | candidate `4.250, 0.500 m · 1.250 rad`; the proposal and its three fields survived the camera re-evaluation; Commit installed `4.25 / 0.5 m, yaw 1.25 rad`; Undo `1.5 / -2.5`; Redo `4.25 / 0.5` |
| Begin → exact yaw → Commit → Undo → Redo | candidate `1.500, -2.500 m · 1.250 rad`; committed yaw `1.25`; Undo `0`; Redo `1.25` |
| Move then yaw then move (stale-entry check) | `Z=5` refused `no-support` with the form still open; `Z=1` → `1.500, 1.000 m`; yaw `1.25` → `1.500, -2.500 m · 1.250 rad` with the fields reset to that pose; `X=2` → `2.000, -2.500 m · 0.000 rad` (the replaced `Z=1` was not resurrected); Commit installed `2 / -2.5, yaw 0` |
| Esc | `Cancelled; the accepted pose is unchanged.`, fields gone, document unchanged |
| Blur out of the editing subtree | same cancel, document unchanged |
| Plan↔3D mid-proposal | `Cancelled; the accepted pose is unchanged.`, fields gone, no proposal on return to 3D |

The ghost overlay, the feedback pose and the committed pose agreed in every case; the committed pose
equalled the last displayed candidate exactly (no post-preview Y correction).

**Unrecorded journeys:** narrow viewport, keyboard-only navigation and reduced motion were not
recorded. The slice's plan asks for them at review; they remain owed to the S04 integration route.

## Criteria (from the plan)

| Criterion | Evidence |
| --- | --- |
| Place, move, rotate, switch readings, enter an exact value, undo/redo from a valid floor project | browser journeys above; lane suites |
| Include a Plan-ineligible selected entity, missing model bytes, unsupported host, mid-gesture reading switch | fast lane: `scene-editing-surface`, `scene-adapter`, `stage-facade`, `scene-operation-*` refusals; mid-gesture switch covered by the reading-change cancel |
| Review desktop, narrow, keyboard-only and reduced-motion journeys | desktop recorded above; the other three are unrecorded and carried to S04 (see above) |
| The last valid displayed candidate equals its committed pose within 1e-6 m/rad; no post-preview Y fix | browser: `4.250, 0.500 · 1.250` → `4.25/0.5, yaw 1.25`; `2.000, -2.500 · 0.000` → `2/-2.5, yaw 0`; adapter test asserts the accepted payload from the same candidate |

## Residuals and limitations

- **Typed entry is one exact group per proposal.** A move entry carries X/Z and keeps the accepted
  yaw; a yaw entry carries the angle and keeps the accepted X/Z. The form now always shows the
  captured pose, so nothing is silently dropped, but a creator cannot commit a move and a rotation in
  one operation. Combined intents are an F4 decision, not an adapter one.
- **Pointer press on the Stage while the typed form is open.** The press calls `session.begin()`,
  which releases the typed lease and grants one to the drag; the form cannot see that through
  `proposalLive()`. A normal press blurs the field first and cancels through `focusout`, and Commit
  can only install the drawn candidate or refuse, so no wrong pose is written. A session-level "which
  lease owns the displayed candidate" would close this; it is not claimed here.
- **Intermittent `stale-epoch` on Begin after an accepted install** was observed once during this
  acceptance run when the task panel's services had not been rebuilt; closing and reopening the task
  recovered it, and it did not reproduce on demand in this revision. It belongs to the task-scoped
  service generation (`stage-facade.ts` `active()`), not to this slice's adapter, and is tracked as
  [TD-8](../../../../operations/tech-debt/README.md#td-8--a-tasks-scoped-services-go-stale-after-an-accepted-install-refusing-begin).
- Save, Preview, resize, duplicate and delete are outside S03; they stay with T2.P01.S04.

No active checkpoint existed for this slice.

## Preservation

**Deferred.** Closeout steps 8–11 (compaction, the historical anchor, the preservation report and the
link sweep) are performed after the merge commit, because the anchor they record is that commit.
Merge is the owner's decision and has not been taken; this record therefore claims no anchor and no
merge. Required merge method: a merge commit, so the slot anchor stays reachable.
