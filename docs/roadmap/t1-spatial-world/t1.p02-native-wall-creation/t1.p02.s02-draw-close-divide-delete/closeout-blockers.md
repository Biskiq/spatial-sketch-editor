# T1.P02.S02 — closeout blockers

**Slice:** T1.P02.S02 · **Branch:** `t1-p02-s02-draw-close-divide-delete` · **Tested head:** `64b9435d`
**Decision:** **closeout BLOCKED — do not record acceptance, do not mark shipped.**

T3 accepted the shared Head/F4 diff at `bf9007ff`
([review](./t3-implementation-review.md)). After that verdict the branch carries five in-scope code/harness
commits: `8db7baf2` (Card clears the measured lower column at constrained width), `132a7aac` (the
browser journey), `f26b227c` (the lower-column height comes from the observed box, keeping one
viewport measurement), `dc877396` (the completed browser matrix) and `64b9435d` (palette-bearing
clearance). The gate and browser pass below are recorded at `64b9435d`; the targeted T3 review of
the shell repair is recorded separately in [its review](./t3-shell-repair-review.md).

The [slice plan](./implementation-plan.md#acceptance-and-verification) declares the slice's
acceptance criteria. The browser journey is now recorded, but the owner-run performance family is
still absent, so the slice-closeout procedure's step 1 ("acceptance is RECORDED, not re-produced")
cannot pass.

## Missing evidence

### Owner-run performance acceptance (required proof, not recorded)

The plan requires, on the designated MacBook Air M2 under the formal acceptance method:
F3 input-to-matching-preview, latest-input age, final-preview completion, frames and long tasks;
per-move evaluation; F4 commit and F8 Undo/Redo at **S and M**; F2 open; F13 leak cycles; and the
Stage first-load delta. The owner pass must use the formal profile, not S06's milestone amendment:

```text
npm run perf:bench -- --label t1-s02-acceptance --profile acceptance --tiers grid-L,grid-M,grid-S
```

The harness refuses a partial-tier formal pass, so L runs as well as the required S and M rows.

The handoff records only a **harness smoke, not acceptance evidence** (grid-S, n=1 rows) and says the
plan's performance acceptance "stays with the designated M2 under S06's method… No agent run is
presented as that evidence." A Bench pass needs owner direction. No S/M row, power state or
owner-operated pass is recorded at `64b9435d`.

## Recorded evidence

### Browser journey — `64b9435d`

`apps/editor/perf/run-t1-s02-browser-qa.mjs` served the ordinary production build through
`vite preview`, ran the local API against a fresh private Postgres database created for this pass, and
drove `perf/flows/t1-s02-browser-acceptance.spec.ts`. Both Playwright projects ran the same four tests
with one worker, no retries:

| Project | Result | Evidence |
| --- | --- | --- |
| `chromium` (Playwright build) | 4/4 tests, 28/28 rows passed | [JSON](./evidence/2026-10-27/64b9435d/t1-s02-browser-evidence.json) · [machine facts](./evidence/2026-10-27/64b9435d/t1-s02-machine-facts.json) |
| `chrome` (branded `Google Chrome 156.0.8078.48`) | 4/4 tests, 28/28 rows passed | [JSON](./evidence/2026-10-27/64b9435d-chrome/t1-s02-browser-evidence.json) · [machine facts](./evidence/2026-10-27/64b9435d-chrome/t1-s02-machine-facts.json) |

Every row names revision `64b9435d`, its viewport and its reduced-motion state. The recorded rows
cover:

- **starter** — baseline enclosure, a free Wall joined deliberately to an existing Junction, Plan/3D
  agreement, Room division, Wall deletion with its disclosure, one Undo/Redo for the accepted delete,
  and Save/reload preserving identities;
- **empty** — typed enclosure, Plan/3D agreement, rejected numeric entry, exact Card precision,
  keyboard finish/backtrack/Escape, one Undo/Redo for the accepted chain, Room division, division
  read in 3D, divider deletion with its Room reconciliation, and the reconciled result read in 3D;
- **policy** — crossing without a Junction, collinear overlap, disconnected nested ring and invalid
  palette options all refusing with zero partial source;
- **shell** — 900×700 (below the 72 rem rule) with reduced motion: the Card and the measured lower
  column do not intersect, the palette-bearing column does not intersect the Card, and the page has
  no horizontal overflow; Head Find arms the dock tool, selection survives a Layout task and a Scene
  Library task, closing either does not re-arm Ink, the Experience Guide mounts and returning to
  World leaves Ink disarmed, and the unsaved replacement guard preserves the edited source on
  Cancel.

Screenshots for the captured rows are beside each JSON (`t1-s02-*.png`). These are browser journeys
only: they do not measure latency, frame timing or memory, and they do not substitute for the
owner-run performance pass above.

### Automated gate — `64b9435d`

Run on the committed tree, all from the repository root:

```text
npm run check               editor svelte-check: 0 errors, 0 warnings
npm run test:arch           22 files / 180 tests passed
npm run test:full           214 files / 2,653 tests passed
npm run build               production build succeeded
npm run check:layout-core   tsc clean
npm run check:project-model tsc clean
npm run check:camera-core   tsc clean
npm run check:api           tsc clean
```

`test:fast` and `test:heavy` are subsets of `test:full`, which passed at this revision. The DB-backed
API suite was last recorded at the round-2 revision (`78705c0d`); the later repairs change the shell,
the browser spec and documentation only, no API contract, so it was not re-run. The earlier T3
review's gate at `bf9007ff` remains recorded in
[t3-implementation-review.md](./t3-implementation-review.md); the targeted shell-repair review is in
[t3-shell-repair-review.md](./t3-shell-repair-review.md).

## Owner decisions

1. **Deferred (2026-10-27):** the owner directed T2.P02.S03 recovery to start before the S02 formal
   performance pass. S02 therefore remains **NOT ACCEPTED** and #201 stays unmerged; no performance
   row is recorded or waived.
2. **Known miss ruled (2026-10-27):** record the Stage route's **456.0 KiB JS br** against the ≤400
   KiB hard budget as an explicit known miss and proceed with S02 once the performance gate exists.
   #201 adds +9.0 KiB over the #199 base; the miss predates #201 and is not a waiver of any other row.
3. **T3 confirmed:** the targeted review accepts the later shell repair (`8db7baf2`, `f26b227c`)
   and the completed browser matrix (`dc877396`, `64b9435d`) with one non-blocking residual; the gate
   and browser evidence are recorded above.
4. The formal performance pass and `slice-closeout` remain outstanding; acceptance, the phase
   register's shipped row, M4 re-arm and the baton are untouched.

No phase closure, track completion, merge claim or acceptance is recorded here.
