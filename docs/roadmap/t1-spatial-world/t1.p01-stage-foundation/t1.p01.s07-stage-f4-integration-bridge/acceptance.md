# T1.P01.S07 — acceptance record: Stage↔F4 integration bridge

**Status: ACCEPTED 2026-10-17. Merge withheld at the owner's instruction; PR #137 is unmerged, so the
slice is not yet shipped.** [Plan](./implementation-plan.md) · [phase](../README.md) ·
[AM-5 reconciliation](./am5-reconciliation.md) · [verification](./evidence/verification.md).
`T1.viewport-projection@1` moves to **accepted** with `viewport-projection-v1` active; provider stays
`T1.P01.S02`. The durable record is
[capability-viewport-projection-v1.md](./capability-viewport-projection-v1.md).

## Delivered

- **Host↔F4 wiring** (committed `bbc1203a`): one accepted install into the shared Stage, host
  Undo/Redo commands, replacement baseline with additive admission, adapter re-binding and exact
  disposal, contribution re-binding, and retained facade/context refusal after their lifetime ends.
- **AM-5 completion** (`a67793e4` plus review fixes through `ab8504aa`): encoding-neutral accepted
  read behind an explicit current adapter; ordered F.1 selection with one primary and canonical
  deduplication; lens/task parking with writer cancellation and explicit revalidated Resume.
- **Reentrant lens exit** (`ab8504aa`, the approver's remaining P2): a cancellation callback that
  opens a task for the departing lens no longer leaves it active in the destination lens. The
  deliberate replacement is preserved, parked, and its writers are cancelled; a task that belongs to
  the destination lens is left alone. Regression:
  `tests/lib/authoring/stage-semantic-lifecycle.test.ts`.

## Acceptance criteria and adjudication

| Plan criterion | Recorded outcome |
| --- | --- |
| Real accepted install | `stage-host-acceptance.test.ts` + conformance adapter: exactly one install, pose unchanged, claim re-acquired, selection requalified, one re-bind and one dispose of the previous binding, identical content leaves the claim. |
| History | Mixed Layout/Scene conformance planners Undo/Redo exactly the latest accepted result; a live proposal refuses with a reason; navigation/reading/focus create no entry. Browser run confirms the buttons and content identities. |
| Replacement | New baseline and empty stack; prior-epoch accepts, loads, gestures and Camera completions cannot install. Browser run confirms disabled history and restored baseline. |
| Contributions | T3-style probe mount/unmount moves no Camera; Card fact and Find entry appear/disappear with registration; probes import no private Stage state. |
| Mutation controls | The recorded mutation controls (cleared selection, skipped re-bind, prior-epoch install) fail the relevant suites. |
| Seam conformance on the integrated tree | The AM-5 probe table re-ran on the merge candidate; arch lane 20 files/161 tests green; production exclusion scan clean. |
| Complete merge gate on then-current `main` | Run at merge candidate `049e89f5` against `origin/main` `279e1340`; see the gate table below and [verification](./evidence/verification.md). |
| Browser evidence | 267-command workflow in both readings, plus a 17-command 390 px spot check after the review fixes, plus a merge-candidate spot check (selection → lens park → explicit Resume at 1280×900; 390×844 layout measurement). |

## Evidence identity

Merge candidate **`049e89f5a40d3ecf8c18214ca7fcd604265b8929`** — `origin/main`
`279e1340` merged into `T1-P01-S07`, whose tested code head is **`ab8504aa`**
(`a67793e4` + `4127b63f` + `4c831fc5` + `933bf285` + `ab8504aa`, base `bbc1203a`). The 22
changed/added `src`/`tests` files are individually hashed in
[am5-source-manifest.json](./evidence/am5-source-manifest.json); aggregate SHA-256
**`1ecf8fc9e8cdd5974dfa9136d4935ae2a906a3fdcc1d8915773a3f110cdf8830`** over the sorted
`<path>` TAB `<sha256>` newline lines that the manifest defines. Documentation, screenshots and
transcripts are outside that manifest.

## Gate results at the merge candidate

| Command | Observed result |
| --- | --- |
| `npm run check` | 0 errors / 0 warnings |
| `npm run test:arch` | 20 files / 161 tests passed |
| `npm run test:fast` | 130 files / 1,812 tests passed |
| `npm run test:heavy` | 8 files / 118 tests passed |
| `npm test` | 158 files / 2,091 tests passed |
| `npm run build` | production build passed |
| `npm run check:layout-core`, `check:project-model`, `check:camera-core`, `check:api` | all passed |
| `npm run test:api` | **65 tests, 65 pass, 0 fail, 0 skipped** in 9 contract files on disposable PostgreSQL 14.19 database `biskiq_s07_merge_20261017` |
| Production exclusion | 349 emitted files scanned for 15 probe sentinels: **0 matches** |
| `git show --check` | clean on `ab8504aa` and the merge commit; the historical docs commit `95fff696` keeps its disclosed EOF blank line, fixed in `308c6659` |

## Independent review

Four rounds reviewed this PR. The committed host wiring was reviewed to **no remaining actionable
implementation findings** at `bbc1203a`. The AM-5 increment had three rounds: four passes in round 1,
a fix/record round, and a delta round, fixed in `4127b63f`, `4c831fc5` and `933bf285`.

The approver then accepted the direction with one remaining P2: a cancellation callback opening a
task for the departing lens left it active in the destination lens. That is fixed in `ab8504aa`, and
a focused independent review of that delta returned **accept with nits**: the guard runs after the
parked-restore block so the deliberate replacement survives and the old task is not resurrected; the
condition agrees with `openTask`'s ownership rule (`lens ?? 'world'`); the late writer is cancelled
exactly once; and the updated regression fails on the pre-change code. Its comment nit (the
"always parks" wording ignored a canceller that changes lens itself) is fixed. No finding was
argued away. The two sibling reentrancy asymmetries it reported are recorded under limits, not
fixed here.

## Browser evidence

[Browser actions and DOM observations](./evidence/browser-actions.json) hold the 267-command
workflow: Layout height 3 → 4 m with Undo/Redo, Scene entity selection with Card facts and
`selectionChanged` echo, Scene shadow edit surviving Undo/Redo, lens parking with explicit Resume,
and replacement restoring the baseline. Content identities `sha256-4525f51d…` at 3 m and
`sha256-e5364103…` at 4 m were observed again on the merge candidate.

Merge-candidate spot check (owned browser session against the conformance server, no console
errors):

1. Starter loaded, Conformance height applied (`wall height 4 m`, identity `sha256-e5364103…`).
2. Scene entity created, Conformance Scene opened, entity selected (`receiveShadow true` after the
   toggle), then **Experience**: instrument closed, selection Card and history retained.
3. **Back to World**: parked notice naming the inactive task, **Resume Conformance Scene**
   restored the instrument with `Scene entity entity-conformance`, `receiveShadow true` and the
   selection echo intact.
4. At 390 × 844: `scrollWidth` 390 (no horizontal overflow), instrument panel `x 11–379`,
   `y 679–832`.

The browser run does not exercise the reentrant cancellation callback; that path is covered by the
regression test only, and is stated as such.

## Known limits

- **Instrument services are partly narrowed.** `setSelection`, `select`, `acquireGesture` and
  `accept` are task-scoped; the rest of the facade remains reachable from a captured instrument
  closure and is session/epoch guarded. A narrower instrument-services type is the next step.
- **Correspondence must state canonical addresses.** A planner emitting a valid non-canonical
  qualification finds no entry and the subject is reported as `no-correspondence`; deliberate rule,
  documented, no in-repo planner emits one.
- **Resume of a retired target is not exercised end to end.** The negative test resumes a target
  that no longer resolves; requalification retirement itself is covered in
  `stage-host-acceptance.test.ts`.
- **`closeTask` keeps its own reentrancy asymmetry.** A canceller that opens a task while
  `closeTask` is cancelling has it cleared on return — the mirror of the lens case now fixed. Not a
  defect of this acceptance; recorded for the next consumer of the task lifecycle.
- **`installAccepted` ends the replaced task before cancelling its writers**, so a task opened from
  a canceller during that sweep stays active while the result reports `closedTask: true`. The task
  is opened against the new current source, so it is not generation-stale; the semantic decision is
  owed.
- **A world task is not resumable from the Experience lens**, so the parked panel appears only in
  the lens whose Resume can succeed.
- **Layout-only accepted changes clear a Scene selection** (the correspondence lists only Layout
  subjects).
- This is bounded conformance evidence on a test-only Vite configuration, not production
  authoring.

## Closeout state and remaining step

Routine closeout records acceptance, the capability, the phase register and the baton. **Closed-work
compaction, the `closed/T1.P01.S07` anchor tag and the post-merge anchor verification are deferred to
the authorized merge**, because a P1 anchor is only reachable after the merge commit and the merge is
currently withheld. The full evidence therefore stays live at its own paths; nothing here claims it
was archived.

## Entry points

```text
implementation  apps/editor/src/lib/authoring/stage/
                apps/editor/src/routes/project/[projectId]/spatial/+page.svelte
                packages/camera-core/src/viewport.ts
                packages/layout-core/src/layout-plan-representation.ts
validation      apps/editor/tests/lib/authoring/stage-host-acceptance.test.ts
                apps/editor/tests/lib/authoring/stage-consumer-probes.test.ts
                apps/editor/tests/lib/authoring/stage-semantic-lifecycle.test.ts
regressions     apps/editor/tests/lib/authoring/stage-session.test.ts
                apps/editor/tests/lib/authoring/stage-facade.test.ts
                apps/editor/tests/lib/authoring/stage-content-change.test.ts
evidence        apps/editor/tests/e2e/stage-conformance/ (test-only harness)
recovery        merge candidate 049e89f5a40d3ecf8c18214ca7fcd604265b8929
```
