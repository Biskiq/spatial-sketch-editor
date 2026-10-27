# T1.P02.S02 — closeout blockers

**Slice:** T1.P02.S02 · **Branch:** `t1-p02-s02-draw-close-divide-delete` · **Tested head:** `f26b227c`
**Decision:** **closeout BLOCKED — do not record acceptance, do not mark shipped.**

T3 accepted the shared Head/F4 diff at `bf9007ff`
([review](./t3-implementation-review.md)). After that verdict the branch carries three in-scope
commits: `8db7baf2` (Card clears the measured lower column at constrained width), `132a7aac` (the
browser journey) and `f26b227c` (the lower-column height comes from the observed box, keeping one
viewport measurement). The gate and browser pass below are recorded at `f26b227c`; they do not claim
that the later shell repair was separately accepted by T3.

The [slice plan](./implementation-plan.md#acceptance-and-verification) declares the slice's
acceptance criteria. The browser journey is now recorded, but the owner-run performance family is
still absent, so the slice-closeout procedure's step 1 ("acceptance is RECORDED, not re-produced")
cannot pass.

## Missing evidence

### Owner-run performance acceptance (required proof, not recorded)

The plan requires, on the designated MacBook Air M2 under S06's measurement method:
F3 input-to-matching-preview, latest-input age, final-preview completion, frames and long tasks;
per-move evaluation; F4 commit and F8 Undo/Redo at **S and M**; F2 open; F13 leak cycles; and the
Stage first-load delta.

The handoff records only a **harness smoke, not acceptance evidence** (grid-S, n=1 rows) and says the
plan's performance acceptance "stays with the designated M2 under S06's method… No agent run is
presented as that evidence." A Bench pass needs owner direction. No S/M row, power state or
owner-operated pass is recorded at `f26b227c`.

## Recorded evidence

### Browser journey — `f26b227c`

`apps/editor/perf/run-t1-s02-browser-qa.mjs` served the ordinary production build through
`vite preview`, ran the local API against a fresh private Postgres database created for this pass, and
drove `perf/flows/t1-s02-browser-acceptance.spec.ts`. Both Playwright projects ran the same four tests
with one worker, no retries:

| Project | Result | Evidence |
| --- | --- | --- |
| `chromium` (Playwright build) | 4/4 tests, 20/20 rows passed | [JSON](./evidence/2026-10-27/f26b227c/t1-s02-browser-evidence.json) · [machine facts](./evidence/2026-10-27/f26b227c/t1-s02-machine-facts.json) |
| `chrome` (branded `Google Chrome 156.0.8078.48`) | 4/4 tests, 20/20 rows passed | [JSON](./evidence/2026-10-27/f26b227c-chrome/t1-s02-browser-evidence.json) · [machine facts](./evidence/2026-10-27/f26b227c-chrome/t1-s02-machine-facts.json) |

Every row names revision `f26b227ca987bf1a5c66f7e3f9139831f79ef01d`, its viewport and its
reduced-motion state. The recorded rows cover:

- **starter** — baseline enclosure, a free Wall joined deliberately to an existing Junction, Plan/3D
  agreement, Room division, Wall deletion with its disclosure, one Undo/Redo for the accepted delete,
  and Save/reload preserving identities;
- **empty** — typed enclosure, Plan/3D agreement, rejected numeric entry, exact Card precision,
  keyboard finish/backtrack/Escape;
- **policy** — crossing without a Junction, collinear overlap, disconnected nested ring and invalid
  palette options all refusing with zero partial source;
- **shell** — 900×700 (below the 72 rem rule) with reduced motion: the Card and the measured lower
  column do not intersect and the page has no horizontal overflow, Head Find arms the dock tool,
  selection survives a contributed task and closing it does not re-arm Ink, and the unsaved
  replacement guard preserves the edited source on Cancel.

Screenshots for the captured rows are beside each JSON (`t1-s02-*.png`). These are browser journeys
only: they do not measure latency, frame timing or memory, and they do not substitute for the
owner-run performance pass above.

### Automated gate — `f26b227c`

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
API suite was last recorded at the round-2 revision (`78705c0d`); this shell/page repair changes no API
contract, and it was not re-run for this pass. The earlier T3 review's gate at `bf9007ff` remains
recorded in [t3-implementation-review.md](./t3-implementation-review.md).

## Owner decisions required

1. Direct the owner-run M2 performance pass on S06's method and record it (or record an explicit
   owner ruling for the performance rows, including the Stage first-load delta). The integration
   measurement is 456.0 KiB JS br on the merged tree, +9.0 KiB over the #199 base; both exceed the
   ≤400 KiB hard budget.
2. Confirm the later shell repair (`8db7baf2`, `f26b227c`) as part of the reviewed implementation, or
   return it for T3 review. Its gate and browser pass are recorded above.
3. Only then rerun `slice-closeout`; acceptance, the phase register's shipped row, M4 re-arm and the
   baton are untouched until that decision.

No phase closure, track completion, merge claim or acceptance is recorded here.
