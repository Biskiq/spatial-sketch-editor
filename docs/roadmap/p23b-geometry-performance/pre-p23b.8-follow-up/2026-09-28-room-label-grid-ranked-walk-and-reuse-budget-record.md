# Pre-P23B.8 follow-up — the Room-label grid's ranked walk, and the price of the grid's existence

Date: 2026-09-28. Phase: `pre-p23b.8-follow-up`. Status: **MEASURED, WITHIN-SESSION — one change KEPT,
one change REJECTED, and the next lever now priced.** Authority: the same three-arm DEV switch the previous
pass landed (`--label-arms`), run twice on one runtime in one afternoon, plus the grid-build counter that
travels with each attempt's arm record. **No baseline, no threshold, no ratchet.**

## 0. The question this answers

> `2026-09-28-room-label-arm-before-after-record.md`, §10: "**The next lever is unchanged and now measurable
> with one run instead of three**: the grid's *existence* per placement — a memo keyed by (Room, viewport,
> mask inputs), or a coarser cell budget when the projection has not changed. If that lands, the same
> `--label-arms` protocol prices it the same way on the same day, and **the straight fixture remains the
> falsifier that has to stay flat**."

**The answer, in four lines.**

1. **The grid's inner loop was still worth attacking, and it was attacked the same way**: each distance walk is
   now *seeded* with the slack already found, the polylines are visited **cheapest-segments-first**, and a
   per-polyline group index is built **only for a polyline long enough to earn one**. On the all-curved 40-wall
   fixture the post-release window p50 falls **113.1 → 94.9 ms** (`bend`), **107.8 → 94.9** (`rigid-wall-drag`),
   **104.5 → 92.5** (`room-creation-commit`), **111.1 → 81.7** (`wall-authoring`) and **102.9 → 91.3**
   (`whole-room-move-bridge`) — ratios **0.73–0.89**, all five classes, both percentiles, one session.
2. **The falsifier stayed flat**: on the straight 40-wall fixture the same arms move the window by
   **−2.1 / +0.3 / +0.9 / 0.0 ms** (ratios **0.92–1.03**). The intermediate engine revision — seeded walk, but
   every polyline indexed and the mask visited before the Room's own boundary — was **+10 %** on the same
   fixture (ratios 1.00–1.10) and is **recorded here as REJECTED**; see §5.
3. **The grid's existence is now priced rather than assumed**: the placer builds its eligibility grid
   **30 times per accepted action** on the straight fixture's rigid drag and **40 times** on the all-curved
   `bend` (**8–72** across the protocol, `p50 = max` in every row), against **5–6 `p2311:plan-render-model`
   renders per accepted action** — so the grid is built roughly **6–7× more often than the Plan is re-rendered**.
   On the all-curved fixture the whole grid budget is **24 ms per accepted action**, which is what a memo could
   at most remove.
4. **The grid is still the largest single consumer inside those windows, and smaller than it was**: on
   `all-curved/bend` the shipped arm's windows hold **215.7 ms** of placer self time over 7 windows
   (**30.8 ms/window**, 31.7 % of the sampled window) against the previous grid's **252.6 ms** over 6 windows
   (**42.1 ms/window**, 36.4 %). Across all 19 class rows the placer costs **9.24 ms per accepted action**
   against the previous grid's **13.30 ms** — and the pre-change grid's **33.34 ms**.

## 1. What this extends

| Record | What it established | What this adds |
|---|---|---|
| `2026-09-28-room-label-arm-before-after-record.md` | the arm itself: `pruned-grid` − `per-cell-grid` inside one session, and the grid's *existence* named as the next lever | the arm re-signed to **`seeded-grid` − `pruned-grid`**, a second implementation measured against the previous shipped one, and the build count that prices the next lever |
| `2026-09-28-post-release-window-attribution-and-room-label-fix-record.md` | the placer's grid is the largest consumer inside the post-release window; `edgeDistance` was 39.5 % of it | the same walk, pruned by a *running* slack instead of a static box, with the term order and the index existence chosen by measurement |
| `2026-09-27-room-move-reuse-trace-record.md` | reuse is worth measuring before it is built (the room-drag slice) | the same discipline for the grid: the *budget* is measured first, and the memo is **not** built this pass |

## 2. What was added, and what it is not

| File | What it does | Where it is priced |
|---|---|---|
| `apps/editor/src/lib/editor/layout/plan-room-labels.ts` | the shipped engine: seeded walk, `SeedTerm` ranked cheapest-segments-first, `GRID_INDEX_MIN_SEGMENTS` gate, `SEED_GUARD`; the `pruned-*` functions remain the BEFORE engine, the `perCell*` functions the pre-change one | the two legs below |
| `apps/editor/src/lib/editor/layout/p23b-m1-room-label-arm.ts` | three arms (`seeded-grid`, `pruned-grid`, `per-cell-grid`), the signed pair `AFTER`/`BEFORE`, the per-attempt **grid-build counter**, and `builds` on every action record | §7 |
| `apps/editor/tests/lib/bench/p23b-m1-browser-runner.cli.ts` | signs `seeded-grid` − `pruned-grid` from the arm module's own constants instead of literals | §4–§6 |
| `apps/editor/src/lib/bench/p23b-m1-record.ts` | `byAction` entries carry `builds`, and the class row carries `buildsPerAction` (`actions`, `total`, `p50`, `max`) | §7 |
| `apps/editor/src/lib/bench/p23b-m1-frame-timing.ts` | the arm rule and note now say *every* arm is summarized and the pair is stated, not that there are two | §6 |

**Not added**: no memo, no cache, no key, no invalidation rule. The grid's *existence* remains exactly what it
was — one grid per build, built whenever the placer runs. This pass measured its budget; it did not spend it.

## 3. The change, and why it is decision-neutral

Two edits to the same engine, both priced before being written:

- **The walk is seeded.** Each term is asked for the exact distance **only if it could come in below the slack
  already found** (`seededPolylineDistance(point, polyline, closed, slack + clearance, index)`), returning
  `null` when it cannot. That removes the arithmetic for every term that cannot bind, without changing any
  eligible cell's value: a term that cannot beat the running slack could not have lowered the minimum anyway.
  A `1e-12` relative guard (`SEED_GUARD`) keeps "nothing below the seed" a statement about the geometry rather
  than one ulp of the threshold's own rounding.
- **The term order and the index existence are chosen by segment count.** The terms are sorted
  **cheapest-segments-first** once per grid build, and a polyline gets a per-group bounding-box index only when
  it has at least `GRID_INDEX_MIN_SEGMENTS` (8) segments.

**Why the second edit exists at all — the falsifier found it.** The first shipped revision of this engine ran the
mask terms first and the Room's own boundary last, which is right when that boundary is a flattened 256-vertex
curve and wrong when it is a four-segment rectangle: the *cheapest* and most selective term in the grid was being
saved for last, and an index was being built for every one-segment wall. Micro-benchmarks, one grid build per
round (index construction inside the timed region, because the product pays it per build):

| Shape (one grid build, index built inside the loop) | previous grid | first revision: masks first, every polyline indexed | shipped: ranked, index gated at 8 segments |
|---|---|---|---|
| ring=256 own, mask 40×8, cells 50² | 31.40 ms (1.00×) | 8.73 (3.59×) | **8.04 (3.91×)** |
| rectangle own, mask 40×1, cells 30² | 1.59 ms (1.00×) | 1.81 (**0.88×**) | 2.11 (0.76×) |
| rectangle own, mask 40×1, cells 50² | 2.74 ms (1.00×) | 3.89 (**0.70×**) | 2.93 (0.93×) |
| rectangle own, mask 40×8 (curved walls, straight Room), cells 50² | 11.19 ms (1.00×) | 6.91 (1.62×) | **3.56 (3.15×)** |
| ring=64 own, mask 12×4, cells 50² | 3.62 ms (1.00×) | 2.23 (1.62×) | **1.94 (1.86×)** |

Scaled to the per-build costs the leg itself reports (≈0.06 ms per build on the straight fixture, ≈0.6 ms on the
all-curved one), the same comparison over `cells ∈ {8², 12², 20²}` puts the first revision at **0.78× / 1.18× /
1.33×** on the straight shape and the shipped one at **1.47× / 1.74× / 2.35×**, with the curved shape at
**2.34×–6.82×** and **3.58×–7.61×** respectively.

**Parity is asserted, not assumed.** Every variant is compared against the previous engine cell by cell, over
all five shapes and all scalings: **0 eligible-value mismatches and 0 sign mismatches** in every run. The parity
suite in `apps/editor/tests/lib/editor/layout/p23b-m1-room-label-arm.test.ts` then runs all three arms over the
same fixture set and requires identical labels, including the two-pass sticky-memory case; and
`apps/editor/tests/lib/layout/plan-room-labels.test.ts` — the placer's own 30-test suite, 16 of which fail under
a wrong bound — passes unchanged.

## 4. The target: `p23b-40-wall-all-curved-v1`, per class, per arm

One session, arms interleaved per attempt, arm recorded against the resolved action index. `n` is the arm's own
accepted-action count; the placer column is that arm's **self time per covered window**, from V8's samples.

| Class | window p50 previous → shipped | ratio | Δ | n before/after | placer self per window | p95 |
|---|---|---|---|---|---|---|
| `bend` | 113.06 → **94.89 ms** | 0.84 | −18.17 ms | 8 / 9 | 42.1 → **30.8 ms** | 119.5 → 96.8 |
| `rigid-wall-drag` | 107.75 → **94.88 ms** | 0.88 | −12.87 ms | 8 / 9 | 39.6 → **26.7 ms** | 114.9 → 96.1 |
| `room-creation-commit` | 104.54 → **92.53 ms** | 0.89 | −12.01 ms | 8 / 9 | 38.0 → **28.3 ms** | 110.9 → 95.9 |
| `wall-authoring` | 111.14 → **81.69 ms** | 0.73 | −29.45 ms | 7 / 8 | 50.9 → **23.6 ms** | 117.1 → 91.4 |
| `whole-room-move-bridge` | 102.90 → **91.30 ms** | 0.89 | −11.60 ms | 6 / 7 | 39.2 → **30.6 ms** | 110.9 → 101.1 |

The same arms on the other two curved fixtures, where the grid is smaller and the win is correspondingly smaller,
with **no class going the wrong way**: `owner-40-curved-v1` **0.95 / 0.95 / 0.99 / 0.89 / 0.98** (−0.7 to
−5.2 ms), and the advisory `connected-curved-grid-v1` **0.87 / 0.88 / 0.84 / 0.71 / 0.90** (−4.2 to −12.0 ms).

## 5. The falsifier: `p23b-40-wall-straight-v1`, and the revision it rejected

The straight fixture is the control: same protocol, same arms, same session, no long curved polyline for the
seed to exploit. Two legs ran in one afternoon; the second is the shipped engine.

| Class | leg 1 (first revision): p50 ratio / Δ | leg 2 (shipped): p50 ratio / Δ | shipped placer self per window |
|---|---|---|---|
| `rigid-wall-drag` | 1.01 / +0.2 ms | **0.92 / −2.1 ms** | 2.0 → 2.2 ms |
| `room-creation-commit` | 1.07 / +1.95 ms | **1.01 / +0.3 ms** | 1.3 → 2.2 ms |
| `wall-authoring` | 1.00 / +0.09 ms | **1.03 / +0.9 ms** | 9.0 → 10.5 ms |
| `whole-room-move-bridge` | 1.10 / +2.51 ms | **1.00 / 0.0 ms** | 0.9 → 2.2 ms |

**Verdict.** The first revision was **rejected** on this fixture's reading (two classes at +7 % and +10 %, and a
placer slice consistently *larger* than the grid it replaced); §3's ranking and gate are the response, and the
shipped engine reads **0.92–1.03** here. The remaining straight-fixture cost is stated rather than hidden: the
placer's own slice is **≈1 ms larger per window** on three of these four classes, which is the seeded engine's
per-term call and guard overhead on a grid whose previous engine rejected most cells with one cheap test. It is
**0.03–0.07 ms per grid build**, and it is the reason the shipped engine is described as *flat*, not *faster*, on
straight geometry.

## 6. The same split in V8's own self time

Per accepted action, over all 19 class rows of the session (advisory fixture included, each arm over its own
actions): placer self time **13.30 ms** (previous grid) → **9.24 ms** (shipped) → **33.34 ms** (pre-change).
Inside `all-curved/bend`'s shipped windows the remaining placer time is still the walk itself —
`edgeDistance` 91.1 ms of 215.7 (13.4 % of the sampled window), `seededPolylineDistance` 62.0, `segmentLowerBound`
53.8 — against the previous arm's `segmentLowerBound` 96.5 + `edgeDistance` 82.6 + `polylineDistance` 48.4 = 227.5
of 252.6. Outside the placer the windows are now spread thin: `worldToPlanScreen` 74.5 ms (10.9 %),
`(program)` 52.4, `farthestEndpointPair` 45.0 (6.6 %, `packages/layout-core/src/layout-snap.ts`), and the Svelte
`get` proxies 42.1 — which is the same "the grid plus everything else" reading the previous record closed on,
one step further down.

## 7. The grid-build budget: what the next lever can be worth

The counter is read once per eligibility grid the placer builds, and it is reset when the attempt's arm is set,
so each record's `builds` is that attempt's own. It is **arm-independent by construction** — every arm rebuilds —
which is why it is a statement about the product rather than about the measurement.

| Fixture / class | grid builds per accepted action (`p50 = max`) | `p2311:plan-render-model` per accepted action |
|---|---|---|
| `p23b-40-wall-all-curved-v1` / `bend` | **40** | 5.4 (107 over 20, max 6) |
| `p23b-40-wall-all-curved-v1` / `rigid-wall-drag` | **40** | — |
| `p23b-40-wall-all-curved-v1` / `room-creation-commit` | **72** | — |
| `p23b-40-wall-all-curved-v1` / `wall-authoring` | **40** | — |
| `p23b-40-wall-all-curved-v1` / `whole-room-move-bridge` | **20** | — |
| `p23b-40-wall-straight-v1` / `rigid-wall-drag` | **30** | 5.0 (100 over 20, max 5) |
| `p23b-40-wall-straight-v1` / `room-creation-commit` | **72** | — |
| `p23b-40-wall-straight-v1` / `wall-authoring` | **50** | — |
| `p23b-40-wall-straight-v1` / `whole-room-move-bridge` | **30** | — |

Across the whole protocol the count is **8–72 per accepted action**, identical for every arm, and identical in
both legs.

**What this does prove**: the grid is not built once per Plan render. It is built **5–8× more often** than the
Plan is re-rendered on the two 40-wall fixtures (40 builds against 5.4 renders on `bend`; 30 against 5.0 on the
straight rigid drag), and each build on the all-curved fixture costs ≈**0.6 ms**, so the whole grid budget there
is ≈**24 ms per accepted action** — the ceiling on anything a reuse scheme could remove.

**What this does not prove**: that those builds are *redundant*. The counter counts builds, not repeated inputs;
it says nothing about how many of the 40 share a (Room, viewport, mask) key, and a memo over inputs that never
repeat would remove nothing while adding a correctness surface. **That measurement is the next pass's first
step, not this one's conclusion** — the key-hit rate has to be counted before a memo is designed, exactly as the
room-drag slice counted its reuse before building it.

## 8. Coverage, from the capture itself

- `notMeasuredReason` is `null` and **every one of the 19 rows reports `unassignedWindows: 0`**: no released
  action was left out of the split, and none was attributed to an arm it did not run under.
- Arm populations are stated per row and are unequal by construction (the arm is chosen per attempt index and the
  arms are summarized over their own actions): e.g. `bend` 8 previous / 9 shipped, `whole-room-move-bridge`
  6 / 7. The **cross-arm totals** are 154 previous / 172 shipped / 153 pre-change accepted actions; the
  per-class counts beside each delta are the ones to read, and the cross-arm aggregate in §6 is stated with them.
- Calibration residual **0.062 ms** (leg 2: 0.222 ms) with the same clock-domain check the previous leg recorded;
  4,418 presented frames of 4,418 across processes (leg 2: 4,426), 19 class rows, one harness tab.

## 9. Limitations

- One machine (arm64 / Apple M2 / 8 CPUs / 16 GB), one DEV session per leg, headless Chrome for Testing
  `152.0.7977.54`, one viewport (1500×1000, dpr 1), one harness document, synthetic fixtures. **Advisory.**
- **Every absolute is session-conditioned**, which is why nothing here is compared across legs: the previous
  grid's own `bend` window p50 reads **104.1 ms** in leg 1 and **113.1 ms** in leg 2 with no code change. Only
  the within-leg, per-arm delta is read, and only the two deltas in §4 are the kept change's.
- Deltas are differences of arm **p50s over their own actions**, not paired per-action differences; the counts
  are stated beside every one of them.
- The placer slice is a V8 self-time attribution at a 1000 µs sampling interval: it prices the *shape* of the
  work, and cells under a few samples are not read.
- Nothing about user-visible behaviour is claimed beyond the synthetic harness on a headless runtime; no Electron
  number for this arm was taken.

## 10. Verification

| Gate | Result |
|---|---|
| `apps/editor` `npm run check` (svelte-check) | 0 errors, 0 warnings |
| `tests/lib/layout/plan-room-labels.test.ts` | 30/30 — the placer's own suite, 16 of which fail under a wrong bound |
| `tests/lib/editor/layout/p23b-m1-room-label-arm.test.ts` | 8/8 — gate, build counter, per-arm reset, registry, and three-arm label parity over 8 fixtures plus the sticky-memory second pass |
| `tests/lib/bench/p23b-m1-record.test.ts`, `p23b-m1-frame-timing.test.ts` | 39 + 18 — the assignment, the build budget row, the runner's split and its signed pair |
| `apps/editor` `npm test` | 366 test files / 5,201 tests pass (2 files / 4 tests skipped by their own gates); the tip of this group |

## 11. Live evidence / reproduce

The two legs are committed beside this record as the compact captures — the runner's own JSON with each
per-occurrence label array folded to the counts the previous capture already documents in its own `labelsFolded`
field, and nothing else removed:

- `2026-09-28-room-label-grid-ranked-walk-chrome-leg.json` — the shipped engine (`seeded-grid`), 4,418 frames.
- `2026-09-28-room-label-grid-first-revision-chrome-leg.json` — the rejected first revision, 4,426 frames, kept
  because it is the capture that made the falsifier discriminating.

```text
node .freebuff/launch-chrome.mjs 9223 /tmp/p23b-chrome-label-arms   # pinned 152.0.7977.54, headless
cd apps/editor && npm run dev -- --port 5173
cd apps/editor && npm exec -- vite-node --config vitest.config.ts \
  tests/lib/bench/p23b-m1-browser-runner.cli.ts -- \
  --port 9223 --runtime "Google Chrome for Testing 152.0.7977.54 (headless)" \
  --out ../../.freebuff/m1-label-arms3-chrome.json \
  --cpu-profile ../../.freebuff/m1-label-arms3-chrome.cpuprofile \
  --budget-ms 10000 --label-arms
```

The dev server and the pinned Chrome were started for the leg and stopped again. The raw runner output and the
raw V8 profiles are working artifacts (40 MB / 6 MB per leg) and are not committed; the folded captures are.

## 12. What this changes, and what it does not

- **The kept change**: the seeded walk with a ranked term order and a gated index. It removes **18 % of the
  all-curved post-release window p50 on the `bend` class** and **11–29 ms on every one of that fixture's five
  classes**, corroborated by the CPU slice, with the straight fixture flat at **0.92–1.03** — the falsifier doing
  the job the previous record designed it for.
- **The rejected revision**: seeded walk, mask-first order, index for every polyline. It is recorded rather than
  silently rewritten, because its straight-fixture reading (**1.00–1.10**) is the evidence that the term order,
  not the seeding, is what the falsifier catches.
- **The grid is still the largest single consumer** inside those windows (31.7 % of the sampled `bend` window),
  and the next lever is now a number rather than a hypothesis: **40 grid builds per accepted action against 6
  renders**, ≈**24 ms/action** of grid on the all-curved fixture, with the redundant share **still unmeasured**.
- **Nothing about the product's behaviour changed**: every arm places identical labels (the parity suite), and
  the live legs' own coverage agrees — every window assigned, none unassigned, every measured action accepted.
- **Not claimed**: any Electron number for this arm, any per-action paired difference, any key-hit rate for a
  memo, and no user-visible claim beyond the synthetic harness on a headless runtime.
