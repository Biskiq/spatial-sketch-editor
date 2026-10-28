# T1.P02.S03 — acceptance record: Opening family

```text
AUTHORITY: NONE — the phase README owns slice status; this record reports implementation evidence.
STATUS:    IMPLEMENTATION COMPLETE — awaiting owner acceptance, independent PR review and merge.
SOURCE:    Branch t1/p02-s03-opening-family at 985cd214, based on main 98449a44; PR #209.
TIER:      architecture-integration; integrated exhaustive proof remains T1.P02.S04.
INTEGRATION ROUTE: ../t1.p02.s04-integrated-final-gate/acceptance.md
PHASE:     T1.P02 remains active; S04 is its declared final gate.
NOT:       owner acceptance, a phase closure, a track completion or a performance pass.
```

## Delivered

Ink gains a second reading, **Opening**, without a new dock key. A creator places a straight door or
window on a projected Wall face in Plan or 3D, sees the host-relative ghost and live offset/fit
facts before release, and commits one `layout-opening-create` F4 intent. The canonical planner owns
fit, overlap, height and identity; an out-of-fit candidate refuses in words with a repair and writes
zero partial source. A typed offset can place on the selected Wall (or the host of a selected
Opening) for the keyboard path.

The selected Opening's Card contributes one destructive `layout-opening-delete` action, one undo
step, with the deleted identity retained in correspondence. Deleting its host Wall still retires
the Opening in the Wall's own undo step. After an accepted placement the shell re-arms Ink on the
Opening reading; Escape, task close, replacement or install leaves no hidden proposal.

## Evidence

- **Independent implementation review — three rounds, no unresolved finding.** Codex CLI `0.160.0`
  with its configured defaults: model `gpt-6.1-sol`, reasoning effort `high`, service tier
  `default`; `codex exec review --base main --ephemeral`. No per-invocation model or effort override
  was passed. Round 1 reproduced five defects: palette remount did not read remembered options,
  invalid fields still allowed pointer placement with stale values, pointer offsets were clamped,
  Window did not apply its canonical defaults, and no preview existed before the press. Round 2
  reproduced three: 3D wall faces were hit-tested only at datum height, the remounted palette could
  leave adapter validity false, and unpressed moves never reached the adapter. Round 3 reproduced
  three: Stage-local coordinates were used as viewport ray coordinates, 3D face ties bypassed
  selected-host preference, and a deferred rearm could resurrect Ink after an explicit close. All
  eleven were repaired; the focused suite, browser journey and full gate were rerun after the final
  round.
- **Automated gate at `985cd214`** — `check` 0 errors / 0 warnings; `test:arch` 22 files / 180 tests;
  `test:full` 216 files / 2,674 tests; `build` succeeded; `check:camera-core`,
  `check:layout-core`, `check:project-model` clean. The slice does not touch `apps/api`, so the
  DB-backed API suite was not run.
- **Browser journey at `985cd214`** — three tests and **15/15 rows** in branded Chrome:
  [evidence](./evidence/2026-10-27/985cd214/t1-s03-opening-evidence.json). Rows cover the starter
  host and hover, placement, overflow refusal and typed repair, invalid-measure blocking,
  close/reopen validity, Card removal, Undo/Redo identity, Window defaults, palette remount, Save
  and a fresh-session reload, placement on a raised 3D face, and an empty-project Wall followed by a
  keyboard-metric window. Every row names revision `985cd214`, viewport `1440x900` and
  reduced-motion state. Screenshots sit beside the JSON:
  [placed](./evidence/2026-10-27/985cd214/t1-s03-starter-placed.png),
  [reloaded](./evidence/2026-10-27/985cd214/t1-s03-starter-reloaded.png),
  [3D face](./evidence/2026-10-27/985cd214/t1-s03-3d-face.png) and
  [empty window](./evidence/2026-10-27/985cd214/t1-s03-empty-window.png).
- **S02 preservation at `985cd214`** — the shipped draw/close/divide/delete journey passed four
  tests and **28/28 rows** in branded Chrome:
  [preservation evidence](./evidence/2026-10-27/985cd214/preservation/t1-s02-browser-evidence.json).
  Its rows retain the S02 revision field `985cd214` and the same viewport/reduced-motion reporting;
  the S02 screenshots were not duplicated into this slice's bundle.
- **PR #199 preservation tags** — `closed/T2.P02.S03` and `closed/T2.P02` both dereference to
  `221facc4`, are present on `origin`, and the dereferenced commit is reachable from `main`
  (`98449a44`). No tag was moved or rewritten.
- **Deferred performance family — not evidence.** F4 accept-to-presented and F8 Undo/Redo
  completion for Opening create and delete at S and M were **not** measured on the designated M2
  under the formal peak-first method. No row is recorded as a pass; the family is owed to S04.

## Delivery budget — hard-row miss, owner decision

The Stage route first-load JS measured **426.6 KiB br** (1,778.0 KiB raw; 506.6 KiB gzip) against
the owner-amended **≤425 KiB br hard row**: **1.6 KiB over**. The trusted base is `422.3 KiB br`, so
this slice adds 4.3 KiB br — inside the ≤25 KiB per-slice growth comparison, but the absolute hard
row is missed. This record does **not** claim the budget is met and does not waive the row. The
overage is a genuine owner-level acceptance decision: either authorize the known miss with its
reported reason, or return the branch for a reduction pass. The rest of the slice's evidence is
otherwise complete.

## Residuals and ownership

- **Bundle hard miss → owner acceptance ruling.** 426.6 KiB br is recorded above. The per-slice
  growth comparison does not substitute for the hard row.
- **Formal Opening performance family → S04.** F4/F8 S and M rows remain unrun and must never be
  reported as passes.
- **S04 remains held.** It needs its own release and carries S01, S02 and S06 deferred rows plus the
  recorded Stage budget history; this slice cannot close the phase.
- **Merge and closeout are not done.** No acceptance, preservation tag or closeout report exists
  until the owner reviews the PR and the P1 merge preserves this record.

## Entry points

```text
implementation  apps/editor/src/lib/authoring/adapters/layout/opening-planners.ts
                apps/editor/src/lib/authoring/adapters/layout.adapter.ts
                apps/editor/src/lib/authoring/adapters/layout/ink.ts
                apps/editor/src/lib/authoring/adapters/layout/LayoutOpeningPalette.svelte
                apps/editor/src/lib/authoring/adapters/layout/LayoutInkPalette.svelte
                apps/editor/src/lib/authoring/stage/stage-facade.ts
                apps/editor/src/routes/project/[projectId]/spatial/+page.svelte
validation      apps/editor/perf/flows/t1-s03-opening-acceptance.spec.ts
regressions     apps/editor/tests/lib/authoring/layout-opening-adapter.test.ts
                apps/editor/tests/lib/authoring/layout-precision-adapter.test.ts
```

## Recovery

```text
branch   t1/p02-s03-opening-family
review   PR #209
head     985cd214 (implementation evidence revision)
base     98449a44 (origin/main; PR #199 merge a674eedb is an ancestor)
bundle   426.6 KiB br Stage first-load JS — known miss above; owner ruling required
merge    not performed
```

The branch is pushed for review as PR #209; no merge commit, acceptance tag or closeout
preservation report exists yet. A future P1 merge must preserve this record rather than squash it.
