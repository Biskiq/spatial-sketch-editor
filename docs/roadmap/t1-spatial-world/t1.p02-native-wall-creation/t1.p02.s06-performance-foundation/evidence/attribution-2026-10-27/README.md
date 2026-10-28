# Post-Bench-2 attribution (2026-10-27)

Targeted attribution, **not** a bench pass and **not** another S06 acceptance method. It answers one
question: what did the Plan/pick work between Bench 2 (`e8cc2fc0`) and the frozen candidate
(`d89554b1`) actually change at runtime?

The existing S06 milestone PASS is not reopened. This check ran on the designated reference machine
(Apple M2, 16 GiB, macOS 24.6.0), with the installed pinned Chrome 156.0.8078.48, the N1 network
profile, 1920×1080 at DPR 1, AC power. Both revisions ran through the **same** spec, the same
workloads, the same browser and the same interaction values.

## Revisions and isolation

| Role | Revision | Build |
| --- | --- | --- |
| Bench 2 product | `e8cc2fc0` | detached worktree `/private/tmp/s06-attribution-e8cc`; `npm ci --ignore-scripts`, `npm run build` |
| Frozen candidate | `d89554b1` | current checkout; `npm run build` |
| Harness | PR #190 at `c5e499d3` plus the attribution spec in the working tree | `apps/editor/perf/attribution/*`; the spec and this evidence are one commit |

The candidate build is the same product source as the milestone pass (`25d61deb` and later commits
change no product file). The old worktree has its own workspace links and its own `layout-core`; no
candidate source was copied into it.

## Method

`attribution.spec.ts` uses the unchanged diagnostic profile's settings only as a harmless report
label; it is not collected by `npm run perf` and writes a separate report. One session per tier:
open the cached canonical workload, switch to the Plan reading, Fit, warm the Plan once, then:

1. **Pan** — 94 continuous background pointer drags (left button, no shift), one pan intent per
   move, at 16 ms pacing. A camera-pose comparison before/after confirms the camera moved; the
   validation pair records `pan:cameraMoved = 1` on both revisions.
2. **Pick, ordinary** — select Wall A through the Index to learn its handle midpoint, select Wall B
   so the selection is elsewhere, close the selection card, clear the Index filter, then click A's
   midpoint. The measured window is the click dispatch and its synchronous hit handler; the Index
   row update is awaited outside the window.
3. **Pick, repeats** — three further clicks alternating A and B against the same Plan generation.
4. **Pick, late-order** (L only) — a Wall at 90 % of the declared order, the old scan's worst case.
5. **Local edit** — one typed length commit (3.7 m, +0.01 at L) through the shipped Dimensions
   instrument; the window ends at the accepted revision, and the first rendering opportunity is
   recorded separately.
6. **Post-edit pick** (L only, one paired session) — the first click after that accepted edit, to see
   whether the pick index's build reappears.

Windows record wall time, CDP `TaskDuration` / `ScriptDuration` / `LayoutDuration` /
`RecalcStyleDuration` deltas, net `JSHeapUsedSize` and `Nodes`, rAF intervals and long tasks, and
every relevant work-ledger count. Three paired rounds were run for the main windows; the post-edit
pick is one paired session. The raw rows, including all counters, are in [raw.json](./raw.json).

## Results

Medians of three paired rounds; times in ms. `task` is CDP main-thread task time in the window, not
function self-time.

| Tier | Window | e8cc2fc0 | d89554b1 | Change |
| --- | --- | ---: | ---: | --- |
| L | Pan, 94 moves, task total | 3,482.7 | 1,701.7 | **−51 %** |
| L | Pan, task per move | 37.05 | 18.10 | **−51 %** |
| L | First ordinary pick, wall | 23.0 | 54.0 | **+31.0 (2.35× slower)** |
| L | Repeat pick, wall | 24.0 | 17.3 | −28 % |
| L | Late-order pick, wall | 52.7 | 16.1 | **−69 % (3.27× faster)** |
| L | Local edit, task | 170.2 | 173.3 | +1.8 % (no change) |
| L | Local edit, first presentation | 102.1 | 100.1 | −2.0 (no change) |
| S | Pan, task per move | 4.09 | 3.12 | −24 % |
| S | First ordinary pick, wall | 4.2 | 6.5 | +2.3 |
| S | Local edit, task | 27.5 | 35.0 | **+27 %** |
| S | Local edit, first presentation | 15.5 | 16.3 | no change (n=2 each; one run recorded none) |

`first presentation` is the first animation frame after the typed `command:instrument` resolves — the
window beside the accepted-revision one, not inside it. L has three values per revision; S has two,
because one S run per revision recorded no frame after the commit.

L first-pick task is 44.1 → 79.3 ms; repeat task 40.0 → 30.3; late-order task 62.2 → 26.9. The
post-edit L pick (n=1) is 31.5 → 23.4 ms wall, 40.7 → 42.7 ms task, and rebuilds the index
(3,919 nodes, 151,230 build comparisons, 11,403 output fragments), so the deferred cost reappears
after the commit. The ordinary first pick already pays 3,917 nodes, 147,126 comparisons and 11,396
fragments; a repeat pays no build, 35–37 node tests and 640–680 projections; the recorded L
late-order window pays 75 node tests and 1,048 projections.

Frame intervals do **not** discriminate: L and S pan p95 is 16.7 ms and long-task count is 0 on both
revisions. The rAF proxy saturates at the display floor under this dispatch pattern, so the CPU
change is headroom, not a demonstrated frame-rate gain.

## What the counters prove

- **Pan.** The candidate records no `plan:*` or `plan-pick:*` work during the pan. The old route keys
  its Plan on the camera target (`+page.svelte` at `e8cc2fc0`, key built at line 1113) and calls
  `stage.plan()` when it changes (line 1119); the candidate keys on `stage.planDependencyKey()`
  (`+page.svelte:1542`), which excludes a target the parameters do not use
  (`stage-facade.ts:1569`). The measured pan is the genuine elimination of the per-move Plan
  evaluation, not a cache of the previous frame.
- **Edit.** The candidate derives **8** sources (3 Walls, 3 Openings, 2 room floors), applies **1**
  compiler root delta and compares **0** unrelated sources. That is the local Plan work the design
  claims. The same window still materialises **420** compiled Wall slots, **196** Room slots and
  **225** Junction slots, reads **1,289** aggregate children and merges **1,357**, and produces
  **1,036** membership rows for the Index. Those whole-project terms are unchanged and dominate the
  end-to-end edit.
- **Pick.** The broad phase is built lazily on the first click of a generation: 3,917 nodes and
  147,126 union comparisons at L. Subsequent clicks query 35–37 nodes and 640–680 projections, with
  no build. The recorded L late-order window costs 75 node tests and 1,048 projections instead of
  the old full scan. Every accepted edit creates a new Plan; the next click rebuilds the index and the complete
  fragment output, so the saving is per generation, not per edit.
- **Deferred work.** Plan fragments are demand-driven: an edit does not materialise them, but the
  first pick after that edit does (11,403). The edit itself is not faster; its Plan saving is paid
  forward to the next click that needs the output.

Net heap deltas were noisy (e.g. L edit +17.6 vs +27.8 MiB; repeats varied by ±48 MiB with GC), so
they are recorded but not used as allocation evidence.

## Findings

1. **The real, large win is continuous pan.** At L the same 94 moves consume 1.70 s instead of 3.48 s
   of main-thread task time; at S 0.29 s instead of 0.38 s. This matches the removal of a per-move
   `O(N)` Plan evaluation. It is not visible in the frame-interval proxy, and it is not a claim about
   presented frame rate.
2. **The spatial pick index is a worst-case and repeated-click optimisation, not an all-case win.**
   The first ordinary click on a cold Plan is 31 ms slower at L because it pays the BVH build; a
   repeat is 28 % faster; a late-order Wall is 3.3× faster. For a creator who clicks once and then
   edits, the index has not improved the interaction.
3. **The local edit did not improve end-to-end.** Plan derivation is genuinely local (8 sources, no
   unrelated comparisons), but compile aggregate/materialisation, complete membership assembly and
   whole-document commit work remain. L task and first presentation are unchanged within noise. At S the
   candidate is consistently ~7 ms slower (27.5 → 35.0 task), which is small in absolute terms but
   outside the old range in these three runs; it is recorded, not explained away.
4. **Deferral is not elimination.** The pick index and the complete Plan output are built on first
   read, cached per Plan, and thrown away by the next accepted edit. The post-edit click rebuilds
   151k comparisons and 11,403 fragments, so the old per-click cost reappears exactly when a creator
   commits and then keeps working.
5. **The S06 milestone suite has a real blind spot here.** Its F3 drag row is continuous and would
   see per-move Plan work, and its decision rows passed; but it has no canvas-pick row and no
   post-commit first-click row. Its F7 pan/zoom is a scripted key/wheel loop, not a continuous pointer
   drag. A future performance slice should add (a) a continuous pan CPU row, (b) a pick-after-commit
   row that counts index builds and fragment materialisations, and (c) the whole-project compile /
   membership terms as explicit counters, so a local-Plan win cannot be mistaken for an
   end-to-end edit win.

## Decision

No product change is warranted before merge on this evidence. The S06 milestone gate remains a pass;
the S edit increase is ~7 ms and inside every budget; the L edit and first click are not regressions
against the old revision in any hard row. The following are owned follow-ons, not merge blockers:

- reuse or incrementally maintain pick boxes across a compile generation instead of rebuilding
  `O(F log F)` and materialising the complete fragment set on the first click;
- reduce the remaining compile aggregate/materialisation and complete membership assembly on an
  accepted edit, which is what now dominates L and hides the local Plan gain;
- characterise the small-project fixed overhead that makes the S edit ~7 ms slower.

T3 ownership review remains separate. Nothing is merged or closed.

## Limits

Single machine and one pinned Chrome build; AC power; `n=3` paired medians for the main windows and
`n=1` for the post-edit click; sorted medians, not population estimates. `TaskDuration` and
`ScriptDuration` are main-thread/JS totals, not per-function self-time; allocation is net heap, not
total allocation. The old app has no `plan:*` counters, so the structural counts are candidate-only;
the old route's Plan evaluation is established from its source and the measured CPU difference. The
frame proxy sits at 16.7 ms and cannot resolve the headroom. Pick wall time includes Playwright
dispatch and the synchronous handler, but not the Index DOM update or the selection card's panel
update; those are awaited outside the window and are not separately attributed. The ordinary target
is the first Wall (the scan's best case); the late-order target is one Wall at 90 % of the declared
order, not a proven miss, and no XL/realistic-L workload ran.

## Commands

```sh
git worktree add --detach /private/tmp/s06-attribution-e8cc e8cc2fc0
cd /private/tmp/s06-attribution-e8cc && npm ci --ignore-scripts --prefer-offline --no-audit --no-fund
cd apps/editor && npm run build
PERF_SKIP_BUILD=1 PERF_PORT=4174 node perf/serve.mjs

cd <candidate>/apps/editor && npm run build
PERF_SKIP_BUILD=1 PERF_PORT=4173 node perf/serve.mjs

# candidate (repeat once per round; the old command differs only in base URL, SHA and results dir)
PERF_TIERS=grid-S,grid-L PERF_PROFILE=diagnostic PERF_APP_REVISION=d89554b1 \
  PERF_BASE_URL=http://127.0.0.1:4173 PERF_RESULTS_DIR=/tmp/biskiq-attribution-final-current \
  npx playwright test --config perf/attribution/playwright.config.ts

PERF_TIERS=grid-S,grid-L PERF_PROFILE=diagnostic PERF_APP_REVISION=e8cc2fc0 \
  PERF_BASE_URL=http://127.0.0.1:4174 PERF_RESULTS_DIR=/tmp/biskiq-attribution-final-old \
  npx playwright test --config perf/attribution/playwright.config.ts
```

The attribution spec and its Playwright config were removed with the multi-hour suite on 2026-10-28. The commands above are the historical reproduction; they are not a current entry point.
