# T1.P01.S07 — accepted and closed record — CLOSED STUB

```text
AUTHORITY: NONE — this is closed work. Current truth lives in the phase README's slice register,
           the gate register and the accepted capability record linked below.
STATUS:    ACCEPTED and SHIPPED 2026-10-17 via PR #137 (+ closeout complete; the record above was
           written by the routine closeout on the same branch).
           Owner-authorized 2026-10-17 ([record](../../../../reference/decisions/next-batch-authorization-2026-10-17.md));
           four review rounds, no remaining actionable implementation finding, and the complete gate
           at the merge candidate. `T1.viewport-projection@1:viewport-projection-v1` is accepted with
           `T1.P01.S02` as the unchanged sole provider. Routine `slice-closeout` compacted the plan,
           the AM-5 reconciliation, the verification evidence and the browser archive into this
           record and the recoverable anchors below; no criterion was inferred from skill invocation
           or green tests alone.
ROLE:      acceptance outcome and preservation route for T1.P01.S07.
NOT:       product contract · plan · status store · authority for residual capabilities.
```

## Delivered and accepted

- **Host↔F4 wiring** (committed `bbc1203a`): one accepted install into the shared Stage per project
  epoch, host Undo/Redo commands with visible reasons, replacement baseline with additive admission,
  adapter re-binding and exact one-time disposal, contribution re-binding, and retained
  facade/context refusal after their lifetime ends.
- **AM-5 completion** (`a67793e4` plus review fixes through `ab8504aa`): encoding-neutral accepted
  read behind an explicit current adapter; ordered F.1 selection with one primary and canonical
  deduplication; lens/task parking with writer cancellation and explicit revalidated Resume.
- **Reentrant lens exit** (`ab8504aa`, the approver's remaining P2): a cancellation callback that
  opens a task for the departing lens no longer leaves it active in the destination lens. Regression:
  `apps/editor/tests/lib/authoring/stage-semantic-lifecycle.test.ts`.

The accepted capability is
[`T1.viewport-projection@1:viewport-projection-v1`](./capability-viewport-projection-v1.md)
with `T1.P01.S02` the unchanged, sole provider.

## Evidence identity and tested revisions

Merge candidate **`049e89f5a40d3ecf8c18214ca7fcd604265b8929`** — `origin/main`
`279e1340` merged into `T1-P01-S07`, tested code head **`ab8504aa`**. A rebuilt candidate against the
then-moved `origin/main` is recorded below under the gate table, at candidate `bdc91c93`. The 22
changed/added `src`/`tests`
files are individually hashed in the archived `am5-source-manifest.json`; aggregate SHA-256
**`1ecf8fc9e8cdd5974dfa9136d4935ae2a906a3fdcc1d8915773a3f110cdf8830`**.

| Command (gate at `049e89f5`) | Observed result |
| --- | --- |
| `npm run check` | 0 errors / 0 warnings |
| `npm run test:arch` | 20 files / 161 tests passed |
| `npm run test:fast` | 130 files / 1,812 tests passed |
| `npm run test:heavy` | 8 files / 118 tests passed |
| `npm test` | 158 files / 2,091 tests passed |
| `npm run build` | production build passed |
| `check:layout-core`, `check:project-model`, `check:camera-core`, `check:api` | all passed |
| `npm run test:api` | 65 tests, 0 fail, **0 skipped** (disposable PostgreSQL 14.19, `biskiq_s07_merge_20261017`) |
| Production exclusion | 349 emitted files, 15 probe sentinels, 0 matches |
| `git show --check` | clean on `ab8504aa` and the merge commit |

**Rebuilt candidate `bdc91c93`** (`84a6a437` closeout compaction on `T1-P01-S07`, then
`origin/main` `dfbd6c7c` (post-PR #144, containing PRs #139–#144 incl. T3.P01.S05/S06),
clean auto-merge re-apply of the recorded candidate; code head unchanged at `ab8504aa`):

| Command | Observed result |
| --- | --- |
| `npm run check` | 0 errors / 0 warnings |
| `npm test` (full editor suite) | 160 files / 2,143 tests passed |
| `npm run test:arch` | 161 tests passed (docs gate: `tests/docs` 2 files / 55 tests) |
| `npm run test:heavy` | 8 files / 118 tests passed |
| `check:project-model`, `check:camera-core`, `check:api` | all passed |
| `npm run build` | production build passed |
| Production exclusion (re-scan on the rebuilt candidate) | 349 emitted files, 15 sentinels, **0 matches** |
| `git show --check` | clean on `ab8504aa`, `049e89f5`, the compaction commit and `bdc91c93` |

The full-suite growth (158→160 files, 2,091→2,143 tests) is entirely the T3.P01.S05/S06 test files
that arrived with `origin/main`; no Stage/viewport source changes with it. Not re-run at the rebuilt
candidate: the DB-backed API suite (`npm run test:api`, 65 tests at `049e89f5`) — the merged range
touches no API route or schema, and `check:api` typechecks clean; that is a routine re-run the owner
may require at merge time if desired.

Browser evidence (archived, below): the 267-command workflow in both readings, a 17-command 390 px
spot check after the review fixes, and the merge-candidate spot check (selection → lens park →
explicit Resume at 1280×900; 390×844 layout measurement). Content identities `sha256-4525f51d…` at
3 m and `sha256-e5364103…` at 4 m were re-observed on the merge candidate. The browser run does not
exercise the reentrant cancellation callback; that path is covered by the
`stage-semantic-lifecycle` regression only.

## Known limits

- **Instrument services are partly narrowed.** `setSelection`, `select`, `acquireGesture` and
  `accept` are task-scoped; the rest of the facade remains reachable from a captured instrument
  closure and is session/epoch guarded. A narrower instrument-services type is the next step.
- **Correspondence must state canonical addresses.** A planner emitting a valid non-canonical
  qualification finds no entry and the subject is reported as `no-correspondence`; deliberate,
  documented, no in-repo planner emits one.
- **Resume of a retired target is not exercised end to end.** The negative test resumes a target that
  no longer resolves; requalification retirement itself is covered in `stage-host-acceptance.test.ts`.
- **`closeTask` keeps its own reentrancy asymmetry.** A canceller that opens a task while `closeTask`
  is cancelling has it cleared on return — the mirror of the lens case now fixed. Recorded for the
  next consumer of the task lifecycle.
- **`installAccepted` ends the replaced task before cancelling its writers**, so a task opened from a
  canceller during that sweep stays active while the result reports `closedTask: true`. The task is
  opened against the new current source, so it is not generation-stale; the semantic decision is owed.
- **A world task is not resumable from the Experience lens**, so the parked panel appears only in the
  lens whose Resume can succeed.
- **Layout-only accepted changes clear a Scene selection** (the correspondence lists only Layout
  subjects).
- This is bounded conformance evidence on a test-only Vite configuration, not production authoring.

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
evidence (test-only harness)  apps/editor/tests/e2e/stage-conformance/
```

## Recovery

```text
git show 24671264110ba1a55864e0e63b6e91669bd2458c:docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s07-stage-f4-integration-bridge/acceptance.md          (this record, pre-compaction body)
git show bfd6cc183b781e0fcc51b07032e5cd29f5e13365:docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s07-stage-f4-integration-bridge/am5-reconciliation.md   (full AM-5 reconciliation)
git show d1c93d47d6da57bb1e370aecf1d5c7fff901877a:docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s07-stage-f4-integration-bridge/evidence/verification.md (full verification narrative)
anchor                                                     d1c93d47d6da57bb1e370aecf1d5c7fff901877a
tag                                                        closed/T1.P01.S07 at that anchor (local only — not pushed)
REQUIRED MERGE METHOD — P1                                 merge commit via PR #137; no squash, no rebase
POST-MERGE VERIFICATION OWED                               owner invokes:
  git merge-base --is-ancestor d1c93d47d6da57bb1e370aecf1d5c7fff901877a main
```

## Closeout preservation

```text
CLOSEOUT PRESERVATION — T1.P01.S07 (2026-10-17)
prose compacted:                 3   implementation-plan · am5-reconciliation · evidence/verification as stubs at their own paths
reference promotions:            1   accepted capability T1.viewport-projection@1:viewport-projection-v1 into the gate register; durable limits and reconciliation conclusions kept in this record
renderable evidence archived:    36 files / ~2.8 MB  → docs/archive/roadmap/T1.P01/t1.p01.s07-stage-f4-integration-bridge/
evidence stubs / manifests:      1   evidence/verification.md sibling stub; manifest paths inside the archived copies:
                                     am5-source-manifest.json · integrated-source-manifest.json · source-manifest.json · production-exclusion.json
transient artifacts removed:     3   browser-actions-prior-increment.json · check-summaries.txt ·
                                     check-summaries-am5.txt (superseded; the live paths at the anchor are recoverable by
                                     git show closed/T1.P01.S07:<path>)
historical anchor:               d1c93d47d6da57bb1e370aecf1d5c7fff901877a · tag closed/T1.P01.S07 (local only — not pushed; the skill that compacts does not push)
new live → archive prose links:  0   only links into archived renderable evidence exist, which is the archive's purpose
manual-owed verification rows:   0
remaining deferred items:        0 in-scope; the recorded limits above and the S04-owned Head Save are named residuals
permanent stubs added:           3   (the owner-ratified 2026-09-22 hybrid cost: one per closed prose artifact)
```

```text
required merge method:  P1 merge commit on PR #137 (no squash, no rebase, no amend) — the P1
                        anchors above are reachable on `main` only through a merge commit
post-merge:             verify every recorded anchor is an ancestor of `main` (command under
                        Recovery) and confirm consumers see `viewport-projection-v1` accepted at the
                        new trusted base; then push the `closed/T1.P01.S07` tag
```
