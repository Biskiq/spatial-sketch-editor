# PR #137 verification evidence — 2026-10-17

**Acceptance withheld.** [Owning record](../acceptance.md) ·
[AM-5 completion](../am5-reconciliation.md).

Two increments are recorded here and they are **not interchangeable**:

| Increment | Revision | State | Evidence |
| --- | --- | --- | --- |
| Host wiring, contributions, adapter re-binding | committed `bbc1203a` (base `fcf1fbaa`) | pushed, PR [#137](https://github.com/Biskiq/spatial-sketch-editor/pull/137), independently reviewed | this file's later section, plus the files listed there |
| AM-5 completion (source-independent read, F.1 selection, lens/task lifecycle) | **uncommitted** on top of `bbc1203a` | **not committed, not reviewed** | this file's first sections |

## AM-5 increment — tested source identity

Working tree `T1-P01-S07`, HEAD `bbc1203acbb83530780e429b3ab3b930b82169db` plus the uncommitted
increment. The 22 changed/untracked implementation, test and probe files are individually hashed in
[am5-source-manifest.json](./am5-source-manifest.json); aggregate SHA-256
**`a50bbd174ff66931e764f9ceeb6fd627011630e2b272ae2e8394e724963334fe`**. Documentation, screenshots
and the browser transcript are outside that manifest.

## AM-5 increment — check results

All run on that tree, in this order, after the last source edit. Raw summaries in
[check-summaries-am5.txt](./check-summaries-am5.txt).

| Command | Observed result |
| --- | --- |
| `npm run check` | **0 errors / 0 warnings** |
| `npm run test:fast` | 127 files / **1,761 tests** passed |
| `npm run test:heavy` | 8 files / 118 tests passed |
| `npm run test:arch` | 20 files / 161 tests passed |
| `npm test` | 155 files / **2,040 tests** passed |
| `npm run build` | ordinary production build passed |
| `npm run check:layout-core`, `check:project-model`, `check:camera-core`, `check:api` | all passed |
| `git diff --check` | passed |

**Not run:** `npm run test:api` (the DB-backed API contracts, which need a disposable Postgres this
round did not create) and any run against a merge revision. No API or package source changed.

The focused set that covers the increment directly:
`tests/lib/authoring/stage-semantic-lifecycle.test.ts` (7), `stage-host-acceptance.test.ts` (33),
`stage-session.test.ts` (7), `stage-facade.test.ts` (12), `stage-content-change.test.ts` (5),
`stage-source-admission.test.ts` (9), `stage-consumer-probes.test.ts` (2) — all passing.

### Defects the increment had to fix before these results

1. The final planner-port edit left the host's `registerPlanner` typed against `ProjectDocument`, so
   `npm run check` failed. Widening the host port fixed it; the delete-probe test now registers
   through `currentStagePlanner`, exercising the explicit adapter.
2. The retained `select()` dropped a valid Layout selection whenever the source compiled **no**
   floors (objects but no enclosure): the F.1 location was built from `geometry.floors[0]`. The
   authored `layoutLevelId` is now carried by the accepted read. This was caught by
   `stage-consumer-probes.test.ts`, not by the focused set.
3. An adapter binding's context was guarded by the session's writer generation, so opening then
   closing a task made a live adapter's `select()` silently inert. Context lifetime now ends with
   its binding; instrument services keep the generation guard. Both the S02 consumer probe and the
   lens-exit invalidation test pass with that split.
4. Ordered selection could hold one canonical subject twice (a Layout entity qualified
   `project-root` and `layout-location`). Admission now stores the resolver's canonical location and
   dedups on it, with a test for the alias case.

## AM-5 increment — production exclusion

[production-exclusion.json](./production-exclusion.json): after `npm run build`, all **349** emitted
files under `.svelte-kit/output` and `.vercel/output` were scanned for 14 probe sentinels (writer,
probe state, the three planner kinds, adapter id, entity id, replacement hook text, plugin name,
the four instrument labels, the module name). **Zero matches.**

## AM-5 increment — browser reproduction

From `apps/editor`:

```sh
npx vite --config vite.stage-conformance.config.ts --host 127.0.0.1 --port 5177 --strictPort
```

Open `/project/probe-s07/spatial?create=1`, choose **Enclosed room**, then:

1. In **Plan**: open **Conformance height** (3 m), apply it (4 m), Undo (3 m), Redo (4 m).
2. **Create conformance entity**, open **Conformance Scene**, **Select conformance entity** — the
   Card names `entity-conformance` with its contributed facts and the adapter echo reports it.
3. **Toggle conformance entity shadow**, then Undo and Redo: the Scene selection keeps its primary.
4. Switch to **Experience**: the instrument closes, the inactive-task notice appears, the selection
   and history stay. **Back to World** keeps it inactive. **Resume Conformance Scene** restores the
   instrument with the same selection, history and pose.
5. In **3D**: repeat the Scene edit, Undo and Redo with the Scene selection live.
6. **Replace conformance starter** in 3D and again in Plan: the real guard replaces the project,
   both history buttons disable, the Scene group and selection disappear.

[Action transcript and DOM observations](./browser-actions.json) hold all 267 commands with settled
reading, instrument summary, content identity, history availability, Card text, probe echo, canvas
size and command exit codes. Content identity: `sha256-4525f51d10787400dce43d04131c9af36f8a8407db69889d9089dc7cea1d2754`
at 3 m and `sha256-e5364103646a1559b0d9ee1aabee9754c7b175819a2f639ff512ea93a34d5f7b` at 4 m; Undo and
replacement restore the first, Redo the second. These are the same identities the committed
increment recorded, so the conformance source did not drift.

Two commands exited non-zero and both are disclosed rather than hidden: a screenshot path resolved
against the wrong directory (re-run with an absolute path), and a real defect — the Resume button
covered by the selection Card. Fixing the second also uncovered why the Experience panel's **Back to
World** did nothing: the pointer-driven Stage captured the press before the button's click. Both
panels now stop their own pointer/click events, and the parked-task notice moved to the top-left.
The successful run follows the failure in the same transcript.

| Reading | Baseline | Edit | Undo | Redo | Replacement |
| --- | --- | --- | --- | --- | --- |
| Plan | [3 m](./plan-baseline.png) | [4 m](./plan-edit.png) | [3 m](./plan-undo.png) | [4 m](./plan-redo.png) | [3 m, empty history](./plan-replacement.png) |
| 3D | [Scene entity selected](./3d-scene-selection.png) | [shadow on](./3d-edit.png) | [shadow off](./3d-undo.png) | [shadow on](./3d-redo.png) | [baseline, empty history](./3d-replacement.png) |

Scene selection and lifecycle: [selection + Card](./plan-scene-selection.png),
[Scene edit](./plan-scene-edit.png), [Scene undo](./plan-scene-undo.png),
[Scene redo](./plan-scene-redo.png), [lens inactive](./plan-scene-lens-inactive.png),
[back in World, still inactive](./plan-scene-lens-return.png),
[explicit Resume](./plan-scene-resume.png).

### Limits of this evidence

- The browser session used the test-only Vite configuration; it is not production authoring.
- A **Layout-only** accepted edit clears a Scene selection, because the accepted correspondence for
  that operation lists only Layout subjects and the host refuses to assume an unlisted subject
  survived. This is the intended conservative rule, and it is why the 3D reading uses a Scene edit.
- No independent reviewer has seen this increment, and no merge-revision gate exists.

## Committed increment (`bbc1203a`) — preserved record

Pre-commit verification HEAD: `bdaf5721`; review fixes then committed as `bbc1203a` at the owner's
request. Its tested files are individually hashed in [source-manifest.json](./source-manifest.json),
SHA-256 `95ee5251038526cd8d69ca1203d052e0c056f34bcb2ef891d263776104a21ae1`. The integration candidate
applied the complete PR delta onto main `d2607caf85e35d9ae54241b5fb72fd2f45b31cbe` in a detached
disposable worktree; that record is unchanged and is **not** a merge or an acceptance.

| Command | Observed result |
| --- | --- |
| `npm run test:arch` | 20 files / 161 tests passed |
| `npm test` | 156 files / 2,056 tests passed |
| `npm run test:fast` (preceding) | 128 files / 1,777 tests passed |
| `npm run test:heavy` (preceding) | 8 files / 118 tests passed |
| `npm run check` | 0 errors / 0 warnings |
| `npm run build` | passed |
| `npm run check:api`, `npm run test:api` | typecheck passed; 8 API contracts / 53 tests / **0 skips** on disposable DB `biskiq_pr137_20261017` |
| `git diff --check` | passed |

Raw output for that increment is in [check-summaries.txt](./check-summaries.txt); the two mutation
controls (original disposer restored, replacement baseline committed before validation) are in
[mutation-summaries.txt](./mutation-summaries.txt). Its browser workflow (Layout height in both
readings) is preserved in
[browser-actions-prior-increment.json](./browser-actions-prior-increment.json); the PNG names it
referenced were re-captured by the AM-5 run above, which reproduces the same 3 m/4 m identities. The
narrow-shell sweep is in [shell-actions.json](./shell-actions.json) and was not re-run.

Commit `bbc1203a` was independently reviewed with a final **no remaining actionable implementation
findings** verdict (eight suites, 105 tests). That verdict explicitly withholds slice acceptance and
does **not** extend to the AM-5 increment.
