# Pre-P23B.8 follow-up — what is inside the post-release window, and the Room-label cost that was in it

Date: 2026-09-28. Phase: `pre-p23b.8-follow-up`. Status: MEASURED, IN PROTOCOL, FIXED.
Authority: the window split and the CPU profile are DEV/harness instrumentation; **the fix itself is a
product change** (`apps/editor/src/lib/editor/layout/plan-room-labels.ts`) — the first in this slice.
The product change and this record land together (the slice's placer commit). **No baseline. No cache, no
Worker, no WASM.** P23B.8's compute-bound prerequisite stays **UNPROVEN**.

## 0. The question this answers

> The release-to-presented split priced the post-release wait and left 43–59 % (Chrome) / 47–78 %
> (Electron) of it unexplained, because the runner kept trace event INSTANTS and not durations. With
> durations in place: what IS the wait made of, and is any of it product work?

**The answer, in two lines.** The wait is ~96–97 % JavaScript and it is *contained* in one Svelte
runtime task per release — the trace can name the container and nothing inside it. A V8 CPU profile
resolves the container, and inside it the largest single consumer is the **Room-label free-space
placer's eligibility grid**: `edgeDistance` at 39.5 % of the window's sampled time on the all-curved
fixture, and the **largest row of the entire 285-second profile** (17.11 %) before the fix.

Two exact changes to that placer's grid — a bounding-box prune on the point-to-polyline distance and a
per-row even-odd inside test — take those two rows to **9.96 %** and **0.08 %** of sampled run time
respectively, with the placer's share of the all-curved post-release window falling **57.4 % → 41.0 %**.

## 1. What this extends

| Record | What it established | What this pass adds |
|---|---|---|
| `2026-09-27-M1-release-to-presented-split-record.md` | the wait is 0 ms of restore and 0 ms of commit after the release; 43–78 % of it is after the page's last mark | that remainder, priced by name |
| `2026-09-27-M1-R1-corrections-and-attribution-record.md` | mesh-prebuild is the larger *exclusive* cost in 5 of 6 classes; every absolute is session-conditioned | the per-class composition *inside* the window, and one lever that was sitting in it |
| `2026-09-28-room-drag-follow-ups-record.md` | the transient room-unit contract and the before/after frame series | the same runner, one more instrument |

## 2. What was added, and what it is not

| Where | What | Read by |
|---|---|---|
| `src/lib/bench/p23b-m1-frame-timing.ts` | script rows now carry the function's **definition site** (line + column) and are keyed by it, not by name + file | the window table's `scriptFunctions` |
| `src/lib/bench/p23b-m1-cpu-profile.ts` *(new)* | V8 CPU profile summarizer: self time per frame, whole run and sliced to each class's post-release windows, with the two-clock check | the runner, and a 4-test suite |
| `tests/lib/bench/p23b-m1-browser-runner.cli.ts` | `--cpu-profile <path>`, `--cpu-profile-interval-us`, retention of `lineNumber`/`columnNumber`, the `presented.cpuProfile` block | the three legs below |
| `src/lib/editor/layout/plan-room-labels.ts` | **product**: five decision-neutral changes to the eligibility grid (§5) | the app |

WHY THE DEFINITION SITE, and it is the whole reason the CPU profile was needed next. The largest
window row is `(anonymous)` in `deps/chunk-AI5TZSIZ.js` — a name + file key merges every anonymous
function in a pre-bundled chunk into one row, which cannot be acted on. With the line retained, the row
resolves to `deps/chunk-AI5TZSIZ.js:739:20`, which is Svelte 5's `internal/client` microtask wrapper
(`queueMicrotask(() => { if (tasks === micro_tasks) run_micro_tasks(); })`). That names the *container*
and still says nothing about the work: a `FunctionCall` span's duration includes everything it calls,
and the app frames inside never appear as spans. A sampled profile attributes each sample to the top
frame on the stack, which is exactly the missing resolution.

## 3. The post-release window, by trace durations

Chrome for Testing 152.0.7977.54, headless, one harness tab, viewport 1500×1000 DPR 1, 4 fixtures ×
5 classes, 25 actions per class with 5 warm-ups excluded. `windowMs` is the p50 of the per-action
release-end → first-presented interval; `script` is the union of `FunctionCall` spans inside it (the
phases nest, so they are never summed).

| class | windowMs p50 — leg A / B / C | script p50 — leg A / B / C |
|---|---|---|
| straight / rigid-wall-drag | 26.6 / 23.7 / 65.9 | 22.4 / 19.6 |
| straight / wall-authoring | 33.8 / 30.6 / 63.6 | 31.7 / 28.7 |
| all-curved / rigid-wall-drag | 149.6 / 126.6 / 216.8 | 144.9 / 121.8 |
| all-curved / bend | 162.8 / 122.6 / 186.7 | 157.5 / 116.8 |
| all-curved / wall-authoring | 199.6 / 120.4 / 285.5 | 196.2 / 118.0 |
| all-curved / room-creation-commit | 213.7 / 116.7 / 278.1 | 208.6 / 113.0 |
| owner-curved / rigid-wall-drag | 74.0 / 64.4 / 59.1 | 67.9 / 59.8 |
| connected-curved-grid / bend | 81.1 / 99.3 / 71.2 | 75.8 / 92.5 |

`frameOccupiedMs` is 0 in every class in every leg: no `AnimationFrame` span lands inside these
windows, and `FireAnimationFrame`'s union tracks `script`, so the window is one rAF/microtask turn.
`Layout`, `Paint` and `UpdateLayoutTree` are 0.4–1.8 ms p50 throughout: **the wait is not rendering.**

The one row that is the JavaScript, verbatim from leg B (`p23b-40-wall-all-curved-v1`, rigid-wall-drag,
20 windows, window p50 149.6 ms):

| functionName | script | site | occurrences | windowsPresent | p50 of union | max |
|---|---|---|---|---|---|---|
| *(anonymous)* | `deps/chunk-AI5TZSIZ.js` | **739:20** | 20 | 20 | 143.4 | 165.9 |
| `handle_event_propagation` | `deps/chunk-C25YA357.js` | 85:34 | 90 | 20 | 1.3 | 1.4 |
| *(anonymous)* | `hooks/shortcuts.svelte.ts` | 83:9 | 10 | 10 | 0.6 | 1.0 |

**Read that table honestly: it says the window is one runtime task and nothing more.** Which is why §4
exists.

## 4. The same window, priced by V8's own samples

`Profiler.setSamplingInterval 1000 µs`, started before the calibration marker, stopped after tracing
closed; `summarizeCpuProfile` slices samples into each class's windows. Row shares are **within one
run** — the only comparison this method supports, see §7.

Placer rows = every top frame whose script is `plan-room-labels.ts`, as a share of that class's
sampled window time:

| class | leg A (before) | leg B (+distance prune and early exits) | leg C (+row-crossing table and allocations) |
|---|---|---|---|
| all-curved / rigid-wall-drag | **57.4 %** | 46.3 % | 41.0 % |
| all-curved / room-creation-commit | 52.1 % | 45.9 % | 37.9 % |
| connected-curved-grid / bend | 50.1 % | 45.3 % | 35.7 % |
| owner-curved / rigid-wall-drag | 25.1 % | 20.4 % | 12.7 % |
| straight / rigid-wall-drag | 7.1 % | 5.2 % | 4.4 % |

The rows inside it, leg A, all-curved rigid-wall-drag (3,054 ms of sampled window time):

| row | script | self ms | share of the window |
|---|---|---|---|
| `edgeDistance` | `layout/plan-room-labels.ts` | 1,207.0 | **39.5 %** |
| `pointStrictlyInside` | `layout/plan-room-labels.ts` | 310.7 | 10.2 % |
| `worldToPlanScreen` | `layout/layout-plan-transform.ts` | 201.4 | 6.6 % |
| `polylineDistance` | `layout/plan-room-labels.ts` | 179.6 | 5.9 % |
| `(program)` | — | 162.8 | 5.3 % |
| `mergeWallGroup` | `src/layout-snap.ts` | 115.0 | 3.8 % |
| `(garbage collector)` | — | 106.8 | 3.5 % |
| `farthestEndpointPair` | `src/layout-snap.ts` | 94.0 | 3.1 % |

Whole run, leg A: **`edgeDistance` is the largest row of the entire profile — 49,764 ms, 17.11 %** — with
GC at 27,443.69 ms (9.4 %) and `(program)` at 22,380.55 ms (7.7 %). The placer's grid was setting the
terms the rest of the run paid for as well as the window.

What the grid does, in one sentence: for each Room a mask of eligible cells is built at ≥ 8 px, capped at
24,000 cells, and `pointSlack` asks every cell for its exact distance to the Room's whole boundary, to
every protected edge polyline, and to every obstacle polygon. **A curved Room's boundary is a long
polyline, so the cell count is capped while the vertex count is not.** On the all-curved fixture that
product is what the post-release window was mostly made of.

## 5. The fix — five changes, none of them a decision

All in `src/lib/editor/layout/plan-room-labels.ts`. Every one of them removes work or allocation; none
can change which cell is eligible, which cell represents a component, or where a label rests.

1. **`segmentLowerBound` in `polylineDistance`.** A point's distance to a polyline is set by the few
   segments next to it. A segment whose bounding box is already farther than the best distance so far
   cannot hold the minimum, so the two `Math.hypot`s are not paid for it. The bound is a *lower* bound —
   the box distance, not the segment distance — so skipping is exact rather than approximate.
   *The mistake actually made here is worth recording:* the first version used `point − lo` instead of
   `point − hi`, i.e. the distance to the FAR edge, which prunes segments that do hold the minimum. It
   failed 16 of the placement suite's 28 tests, and the point is in the code comment.
2. **`polygonBoundaryDistance` without the closed copy.** `[...polygon, polygon[0]]` allocated an array
   per cell (up to 24,000 per Room per placement); closed by index instead, with the same prune.
3. **Early exit once the slack is negative.** The grid stores one slack per cell and its only readers are
   `slack < 0` and, for cells that passed, the value as a clearance to rank with — a failed cell's
   *magnitude* is never read. So the first failing obstacle ends the walk. This is what made the
   39.5 % of `edgeDistance` mostly *discarded arithmetic*.
4. **Active-text inflation hoisted** to once per placement (it was recomputed per cell), and the Room
   bbox computed in one pass instead of four mapped arrays.
5. **The inside test per ROW, not per cell.** Every cell in a row shares its z, so the even-odd
   crossings are the same set for the whole row: `rowCrossings` collects them once per row (same
   orientation, same expression as the per-point test, so the two agree bit for bit), and each cell's
   answer is the parity of the crossings strictly to its right — parity does not care in what order the
   edges were toggled. Up to 24,000 × *n* becomes *rows* × *n* plus a walk. The BFS neighbour array was
   replaced by four direct visits in the same edit (one array allocation per cell before).

## 6. What it bought

Function-level shares of sampled run time, whole run, same protocol and same flags on all three legs:

| row | leg A | leg B | leg C |
|---|---|---|---|
| `edgeDistance` | 49,764 ms — **17.11 %** | 11,301 ms — 4.78 % | 20,095 ms — 5.67 % |
| `segmentLowerBound` *(new)* | — | 12,251 ms — 5.18 % | 21,579 ms — 6.08 % |
| distance loop total | 17.11 % | **9.96 %** | 11.75 % |
| `pointStrictlyInside` | 12,805 ms — 4.40 % | 13,393 ms — 5.66 % | **293 ms — 0.08 %** |
| `rowCrossings` *(new)* | — | — | 653 ms — 0.18 % |
| inside-test total | 4.40 % | 5.66 % | **0.26 %** |
| `(garbage collector)` | 27,443.69 ms — 9.4 % | 14,096.11 ms — 6.0 % | 20,261.27 ms — 5.7 % |

The two effects that are read directly, because the deleted and the replacement rows are the same
computation in the same protocol: the prune took the distance loop from 17.11 % to 9.96 % (−42 %), and
the row table took the inside test from 4.40–5.66 % to 0.26 % (−95 %). End-to-end, leg A → leg B moves
every all-curved window down by 17–49 % (e.g. room-creation-commit 213.7 → 116.7 ms, wall-authoring
199.6 → 120.4 ms) and 16 of 19 classes down at all.

**Leg C's window column is NOT read as a delta**, and the reason is in §7: its run took 354.7 s of
sampled time against leg B's 236.5 s on the same protocol, and the class that cannot be affected by
change 5 at all (straight / rigid-wall-drag, whose placer share is 5 %) moves 23.7 → 65.9 ms. A run
that moves a class the change cannot touch has measured the session, not the change. Change 5 is read
on its own rows and on the in-window shares of §4.

## 7. Limitations

- **Three sessions, one machine.** The M1 finding stands: absolutes are session-conditioned. The same
  protocol on the same tree gave the all-curved rigid-wall-drag window p50 **230.5 ms** in the first
  window-phase run and 149.6 ms in leg A — ×1.54 with no code change between them. Only within-run
  shares and within-window composition are compared across legs.
- **A sampled profile is not an instrument.** Rows are the work V8 attributed while a frame was the top
  of the stack; a frame whose callees were inlined into it carries their time, and a function that ran
  but was never sampled has no row at all. "Absent from the rows" in the capture means *below the
  15-row limit* — the exact figures in §6 were recomputed from the raw profile artifact, not from the
  trimmed table.
- Both the profiler and tracing ran for the whole protocol and their overhead is in every row; all legs
  carry it identically.
- The window slice maps a sample into the trace clock by adding nothing. The two anchors' gap is
  reported rather than assumed: leg A's profile starts 272 ms before the trace's own calibration marker
  and ends 4.5 s after the closing one — elapsed time between anchors on one clock, not an offset.
- 20 windows per class (23 for `wall-authoring`), 5 warm-ups excluded, 25 actions per class; a class
  row is a p50 over 20 actions, not a distribution of enough actions to read a tail.
- The profile is not a claim about what a *user* waits for: the harness drives synthetic input at a
  fixed cadence on a headless runtime with an offscreen presentation surface, in a dev build with
  Vite's pre-bundled Svelte.

## 8. Verification

```text
check                  0 errors / 0 warnings
tests                  365 files passed | 2 skipped (367);  5,181 passed | 4 skipped (5,185)
test:arch              23 files passed / 254 tests
cpu-profile suite      4 tests
frame-timing suite     15 tests (site keying added)
room-label suite       30 tests (28 pre-existing + 2 new curved-room fixtures)
```

Parity evidence for the product change, in the order it was obtained:

- The placement suite pins anchors, tiers, drop order, candidate stickiness and the reappearance gate.
  **Reintroducing the far-edge bound fails 16 of its 28 pre-existing tests** — measured twice — so that
  suite is sensitive to this exact change.
- Two new tests cover the shape the suites never had: a 256-vertex boundary (anchor strictly inside,
  clear of the boundary by ≥ the core reserve, deterministic across calls) and a 64-vertex protected
  edge (the anchor moves off the edge and stays inside). **These two pass against the far-edge bound as
  well**, and that is stated rather than glossed: they are coverage for curved faces, not the teeth.
- Scratch property checks, both run outside the suite: the prune against the unpruned distance over
  300,000 random polylines with degenerate runs injected → **0 mismatches, 37.1 % of segments pruned**;
  the row-crossing table against the per-point even-odd test over 168,000 grid comparisons →
  **0 mismatches**.

## 9. Live evidence / reproduce

```text
.freebuff/m1-window-phases-chrome-sites.json        40.0 MB  leg A (before) — window table (+sites),
.freebuff/m1-window-phases-chrome-sites.cpuprofile    6.7 MB       224,413 samples / 285,410 ms
.freebuff/m1-window-phases-chrome-labelfix.json     39.8 MB  leg B (+§5.1–5.4), 4,409 presented frames
.freebuff/m1-window-phases-chrome-labelfix.cpuprofile 6.2 MB       205,875 samples / 232,515 ms
.freebuff/m1-window-phases-chrome-labelfix2.json    43.3 MB  leg C (+§5.5), 4,436 presented frames
.freebuff/m1-window-phases-chrome-labelfix2.cpuprofile 7.9 MB      269,083 samples / 349,790 ms
```

All six are gitignored working files, not records; the numbers above are the record. The dev server and
the pinned Chrome were started for the pass and are not left running.

```text
node .freebuff/launch-chrome.mjs 9223 /tmp/p23b-chrome-labelfix      # pinned 152.0.7977.54, headless
cd apps/editor && npm run dev -- --port 5173
cd apps/editor && npm exec -- vite-node --config vitest.config.ts \
  tests/lib/bench/p23b-m1-browser-runner.cli.ts -- \
  --port 9223 --runtime "Google Chrome for Testing 152.0.7977.54 (headless, one harness tab, viewport 1500x1000 DPR 1)" \
  --out ../../.freebuff/<leg>.json --cpu-profile ../../.freebuff/<leg>.cpuprofile --budget-ms 10000
```

## 10. What this changes, and what it does not

- The 43–78 % post-release remainder is no longer unexplained: on curved fixtures it was mostly the
  Room-label placer's eligibility grid, and about half of *that* was arithmetic on cells it had already
  decided to discard.
- The placer is still **37–41 % of the post-release window** on the all-curved fixture after both
  changes, and `worldToPlanScreen` (7–13 %), the Svelte proxy `get` rows (9–14 %) and `(program)`
  (8–18 %) are now the visible remainder around it. The next lever inside this module is the grid's
  *existence* per placement — a memo keyed by (Room, viewport, mask inputs), or a coarser cell budget
  when the projection has not changed — not another constant factor in its inner loop.
- The end-to-end proof that the user-visible wait improved needs what this pass could not do with three
  back-to-back sessions: **one session, both code paths** (the DEV arm pattern the room-drag slice
  already uses), so the before/after is a within-session pair rather than two runs of the same
  conditioned machine. **DONE, and it lands in the same commit**: the arm runs both grids interleaved
  per attempt in every class and reports −70.0 ms of window p50 on all-curved `bend` (ratio 0.68 on all
  five classes there), −8.7…−10.2 ms on owner-curved and a NULL on the straight fixture where the grid
  has nothing to measure → `./2026-09-28-room-label-arm-before-after-record.md`.
- Nothing else in the two changes is a decision: no cache, no threshold, no new state, no change to
  where a label rests, and the placement suite is the argument.
