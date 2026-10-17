# T1.P01.S07 — acceptance record: Stage↔F4 integration bridge

**Slice:** T1.P01.S07 · **Status:** in-progress — **no acceptance recorded** · **Plan:**
[implementation-plan.md](./implementation-plan.md) (owns the criteria) · **Phase:**
[T1.P01](../README.md)

This record claims **no result, no tested revision, no gate state, no capability, no commit and no
readiness**. S07 is owner-authorized (2026-10-17,
[record](../../../../reference/decisions/next-batch-authorization-2026-10-17.md)); implementation began
from `main` at `fcf1fbaa`. The focused and lane results below were observed on this worktree before it
was committed, so they name the commands rather than a commit; the plan's own merge-gate and browser
evidence remain unproduced.

## Implementation under review (not evidence)

| Plan output | Landed implementation |
| --- | --- |
| Host↔F4 wiring: one coordinator per project epoch, accepted install through the one slot, Undo/Redo host commands with visible reasons, replacement baseline | `apps/editor/src/lib/authoring/stage/host-acceptance.ts`; route wiring in `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte`; live Undo/Redo controls in `shell/EditorHead.svelte` |
| Selection requalification through accepted correspondence | `apps/editor/src/lib/authoring/stage/selection-requalification.ts`; `installAccepted(next, { requalify })` in `stage-session.ts` and `stage-facade.ts` |
| Camera output rebase and re-acquisition at the same pose | unchanged mechanism in `stage-facade.ts`, now reached from a real accept rather than an injected source |
| Adapter re-binding across installs | `StageAdapter.bind` factory, host-owned `rebindAdapters()`, `StageContentInstall.reboundAdapters` |
| AM-5 contribution points: task/instrument factory, Card facts, rail-family/Find entries | `StageAdapterBinding.tasks`, `.cardFacts`, `.findEntries`, `.instrument`; `StageFacade.tasks()`, `.openContributedTask()`, `.findEntries()`, `.cardFacts()`; generic shell consumption through `stage-contributions.ts` → `EditorIndex` groups, Card facts and the one `StageInstrumentHost` |
| Requalification identity | `selection-requalification.ts` matches subject kind **and** id, refuses a changed owner/kind and a retired component sub-ref |

## Verification status

### Observed in this worktree (coordinator-run, not yet independent)

- **Typecheck:** `npm run check` (editor, `svelte-check`) reports only the one **pre-existing** error in
  `tests/lib/project-model/camera-output-conformance.test.ts:345` (identical on `main` at `fcf1fbaa`);
  no error is introduced by this slice.
- **Lanes, passed on this worktree:** `npm run test:arch` (161 tests), `npm run test:fast`
  (~1,740 tests), `npm run test:heavy` (118 tests) and the whole `tests/lib/authoring/` directory,
  each green with the slice's tests included. The counts move with added tests; the lane result, not
  the number, is the claim.
- **Focused suites, passed:** `tests/lib/authoring/stage-host-acceptance.test.ts` — real accept → one
  install, unchanged pose, re-acquired claim, requalified selection, one rebind and one disposal;
  Layout+Scene Undo/Redo; Undo-unavailable reason; replacement baseline; contributions appear and
  disappear; contributed instrument content; requalified-selection echo exactly once; **live-proposal
  history state agrees with the command** (`canUndo` false with the live reason, `undo` returns
  `unavailable/live-proposal`, then the change installs); **an accept in flight across a replacement
  is refused by the coordinator's generation guard** with no install and no revision move; **a
  non-lifetime install refusal reverses the committed acceptance** so the coordinator's content and
  cursor describe what is mounted; **the contribution-surface signal** fires on registration and
  disposal and not on an identical-content install; **a static binding receives the surviving
  selection once**; and **mutation controls** that run the real install path with requalification
  disabled, showing the requalification assertion failing exactly there, and **a factory-rebinding
  control that suppresses the rebuild through the symbol-keyed test seam and shows the rebind
  assertion failing**, paired with the same install in force; and **navigation, reading changes,
  selection and focus create no history** (depth, position and accepted revision unchanged). Also
  `stage-content-change.test.ts`, `stage-facade.test.ts`, `stage-session.test.ts`,
  `stage-consumer-probes.test.ts` — all green.
- **Requalification unit cases:** surviving subject, retired subject, no correspondence, id collision
  across subject kinds, changed kind/domain, retired component sub-ref, a subject-level entry that
  must not keep a selected component, and an interval-qualified selection whose subject moved.
- **Contribution-surface reactivity:** a rebuild discovered inside a read is notified on a microtask,
  never synchronously, so a derived view never mutates state during its own evaluation.
- **Compensation side effect, recorded:** a reversed acceptance restores the content and cursor but
  mints a fresh revision and leaves the refused state reachable by Redo, because the coordinator owns
  the one bounded stack. Later Save/revision reasoning must not assume the refused revision vanished.

### Still unobserved — not claimed

- **AM-5 probe table** re-run on the integrated tree: not run.
- **Complete merge gate on the then-current `main`**: the three editor lanes above ran on this
  worktree, but the gate as the plan defines it is recorded at merge against then-current `main`, and
  the DB lane does not apply to this slice. Not recorded.
- **Browser evidence (edit → Undo/Redo → replacement in both readings):** not captured. No production
  writer exists and no test-only route hook was added, so this plan item is **unmet and disclosed**.

## What acceptance still requires

1. The AM-5 probe table re-run on the merged tree, and the arch lane's visitor/public/preview
   boundaries.
2. The complete merge gate on the then-current `main`, recorded with its revision.
3. The browser evidence above, in both readings, with the probe hook absent from production chunks.
4. Independent review, then routine closeout — which alone writes the
   `T1.viewport-projection@1:viewport-projection-v1` capability record and moves the gate to
   `accepted` with `T1.P01.S02` as the unchanged provider.
