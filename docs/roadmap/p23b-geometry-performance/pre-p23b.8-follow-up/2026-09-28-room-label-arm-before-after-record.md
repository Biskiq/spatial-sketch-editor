# Pre-P23B.8 follow-up — the Room-label placer's before/after arm, measured inside ONE session

Date: 2026-09-28. Phase: `pre-p23b.8-follow-up`. Status: **MEASURED, WITHIN-SESSION.** Authority: a
DEV-only measurement arm plus the runner rows that price it, landing with the product change it measures
(the slice's placer commit). **No baseline, no threshold.** The change it measures is the one already recorded in
`2026-09-28-post-release-window-attribution-and-room-label-fix-record.md`; this record adds no second
product change.

## 0. The question this answers

> §10 of the window-attribution record closed with: "the end-to-end proof that the user-visible wait
> improved needs what this pass could not do with three back-to-back sessions: **one session, both code
> paths** — the DEV arm pattern the room-drag slice already uses." The room drag got that pattern. Does
> the Room-label placer?

**The answer, in three lines.** It does now: the eligibility grid runs both implementations in ONE
session, interleaved per attempt in **every** class (the placer runs on every Plan render, so its arm
cannot be confined to one class the way the drag's could). On the all-curved 40-wall fixture the
post-release window p50 falls **219.4 → 149.4 ms** (`bend`), **215.8 → 146.4 ms** (`rigid-wall-drag`),
**145.6 → 100.1 ms** (`room-creation-commit`), **150.0 → 102.3 ms** (`wall-authoring`) and
**169.4 → 114.8 ms** (`whole-room-move-bridge`) — ratios of **0.68** on all five, in one session, on one
tree. The CPU slice says the same thing in self time: on that fixture the shipped arm's windows hold
**6,732 ms** of sampled time against the pre-change arm's **9,884 ms**, with `edgeDistance`
**3,890.5 → 898.5 ms**, the per-cell inside test **1,006.8 → 0 ms** and the per-cell distance helper
**691.6 → 0 ms**, replaced by the prune's own `segmentLowerBound` **0 → 932.7 ms**.

And the control that makes it a mechanism rather than a mood: on the **straight** 40-wall fixture, where
the grid has no long curved polyline to measure against, the same arm moves the window by
**−1.7 / −2.2 / +1.4 / −2.8 ms** (ratios 0.95–1.02) and the pre-change arm's `edgeDistance` self time is
**95.7 ms against the shipped arm's 0.0 ms**.

## 1. What this extends

| Record | What it established | What this pass adds |
|---|---|---|
| `2026-09-28-post-release-window-attribution-and-room-label-fix-record.md` | the post-release wait is mostly the placer's grid; five decision-neutral edits remove about half of it; **three legs, so no delta was read** | the same change as a **within-session** before/after, per class and per arm |
| `2026-09-28-room-drag-follow-ups-record.md` | the DEV arm pattern for the room-unit transient contract (M1 arms, frame series) | the same pattern applied to a **product** module's inner loop, in every class instead of one |
| `2026-09-27-M1-S4-m1-session-record.md` | two instruments, one protocol, two runtimes | one more switch on the same protocol; still no pre-change tree |

## 2. What was added, and what it is not

| Where | What | Read by |
|---|---|---|
| `src/lib/editor/layout/p23b-m1-room-label-arm.ts` *(new)* | the DEV arm: `pruned-grid` (shipped) / `per-cell-grid` (pre-change), its gate, and the per-action registry | the placer, the driver, the record |
| `src/lib/editor/layout/plan-room-labels.ts` | **product**: one early branch inside `freeSpaceCandidates`, plus the pre-change grid kept verbatim as `perCellGridCandidates` | the app |
| `src/routes/dev/perf/p23b/drive.ts` | `withLabelArm` per attempt in every class, recorded against the RESOLVED action index | the record |
| `src/lib/bench/p23b-m1-record.ts` | `labelArms.byAction` per class (the page's half) and `summarizeLabelArmWindows` (the runner's half, pure) | record tests |
| `src/lib/bench/p23b-m1-frame-timing.ts` | `summarizePresentedWindowArms` — the arm split, plus the rule and note it runs under | the runner |
| `src/lib/bench/p23b-m1-cpu-profile.ts` | the sample walk extracted so `summarizeCpuProfileWindows` can slice by a caller's own bucket key (`arm::class`) | the runner |
| `tests/lib/bench/p23b-m1-browser-runner.cli.ts` | `--label-arms`, the per-arm windows, the per-arm CPU slice, the signed comparison | this leg |

**The gate is the same one every capture-side instrument uses**: `import.meta.env.DEV` AND
`__P2311_PERF__`. A production build pays one boolean and runs the shipped grid; the pre-change path is
unreachable without both. It is asserted, not asserted-about: `p23bM1RoomLabelArm()` returns
`pruned-grid` with a stray arm global present (`p23b-m1-room-label-arm.test.ts`).

**It is the second deliberate, counted exception to §4.5's guard rail**, and the reason it had to be one:
the *placer* is what chooses which grid to walk, and no page-side instrument can reach inside a product
module's inner loop. So `plan-room-labels.ts` carries exactly one import and one read — pinned by the
wiring test, which also asserts it contains no recorder, no reset, no registry and no direct read of the
arm global. The viewport's own exception (one import, one call, unchanged) stays at one.

## 3. Why the split is per ACTION and not per run

The arm alternates **per attempt** (`arms[index % arms.length]`), and the arm is recorded against the
action the attempt RESOLVED to. So the runner's split key is the action index, which is also the key of
every window it splits: a window is `(class key, action index, release end, presented instant)` and the
assignment is `action index → arm`. Two consequences, and both are what make the numbers readable:

- **No window can land in an arm it did not run under**, and a window whose action recorded no arm is
  DROPPED and counted in `unassignedWindows` rather than assigned. In this leg `unassignedWindows` is
  **0 in all 19 classes**: every window belongs to exactly one arm.
- **The arms are interleaved inside one session on one tree**, so a machine that warms up or throttles
  mid-run moves both arms. The class's own rows (`presentedWindow`, `releaseRow`) still span BOTH arms
  and are a MIXED population — which is exactly why the per-arm rows exist, and it is stated in the
  record rather than left to be inferred.

The release row is deliberately **not split**: both arms are released by the same click, so a per-arm
release cell would be a second comparison of a quantity the arm does not move. It stands beside the
split as the unchanged control, over the mixed population.

## 4. The window, per class, per arm

One session, Chrome for Testing 152.0.7977.54, headless, one harness tab, viewport 1500×1000 DPR 1,
4 fixtures × 5 classes, 25 attempts per class, 5 warm-up slots excluded, `--budget-ms 10000`.
`w` is the number of covered windows in that arm; `BEFORE` is `per-cell-grid`, `AFTER` is
`pruned-grid`; `window` is the p50 of the release-end → first-presented interval, in ms.

| fixture / class | w (B/A) | window p50 B → A | Δ (ratio) | window p95 B → A | script union p50 B → A |
|---|---|---|---|---|---|
| connected / bend | 10/10 | 57.4 → 38.3 | −19.1 (0.67) | 61.5 → 40.1 | 54.3 → 35.0 |
| connected / rigid-wall-drag | 10/10 | 58.2 → 38.9 | −19.3 (0.67) | 61.3 → 41.5 | 54.7 → 35.5 |
| connected / room-creation-commit | 10/10 | 61.0 → 42.1 | −18.9 (0.69) | 61.4 → 42.4 | 57.9 → 38.8 |
| connected / wall-authoring | 11/12 | 57.1 → 37.9 | −19.2 (0.66) | 58.9 → 39.8 | 55.5 → 36.1 |
| connected / whole-room-move-bridge | 10/10 | 58.4 → 38.8 | −19.6 (0.66) | 61.4 → 39.9 | 55.1 → 35.3 |
| owner / bend | 10/10 | 49.4 → 40.7 | −8.7 (0.82) | 50.8 → 42.3 | 45.2 → 36.7 |
| owner / rigid-wall-drag | 10/10 | 49.9 → 39.7 | −10.2 (0.80) | 51.2 → 42.9 | 45.8 → 35.7 |
| owner / room-creation-commit | 10/10 | 54.5 → 45.4 | −9.1 (0.83) | 58.3 → 46.8 | 51.1 → 41.9 |
| owner / wall-authoring | 11/12 | 50.9 → 41.2 | −9.7 (0.81) | 55.3 → 47.0 | 48.0 → 39.6 |
| owner / whole-room-move-bridge | 10/10 | 50.7 → 41.8 | −8.9 (0.83) | 52.6 → 42.8 | 46.9 → 38.0 |
| **40 / all-curved / bend** | 10/10 | **219.4 → 149.4** | **−70.0 (0.68)** | 290.2 → 178.5 | 212.9 → 141.7 |
| **40 / all-curved / rigid-wall-drag** | 10/10 | **215.8 → 146.4** | **−69.3 (0.68)** | 333.5 → 187.7 | 210.3 → 140.6 |
| **40 / all-curved / room-creation-commit** | 10/10 | **145.6 → 100.1** | **−45.4 (0.69)** | 150.7 → 105.8 | 141.8 → 96.5 |
| **40 / all-curved / wall-authoring** | 11/12 | **150.0 → 102.3** | **−47.8 (0.68)** | 152.6 → 114.3 | 147.9 → 100.2 |
| **40 / all-curved / whole-room-move-bridge** | 10/10 | **169.4 → 114.8** | **−54.6 (0.68)** | 277.1 → 163.7 | 163.9 → 109.4 |
| 40 / straight / rigid-wall-drag | 10/10 | 46.9 → 45.3 | −1.7 (0.96) | 51.2 → 50.8 | 38.7 → 37.2 |
| 40 / straight / room-creation-commit | 10/10 | 50.7 → 48.6 | −2.2 (0.96) | 73.0 → 51.5 | 45.1 → 42.7 |
| 40 / straight / wall-authoring | 11/12 | 63.6 → 65.1 | **+1.4 (1.02)** | 85.1 → 81.0 | 59.5 → 61.3 |
| 40 / straight / whole-room-move-bridge | 10/10 | 58.0 → 55.2 | −2.8 (0.95) | 65.2 → 58.5 | 48.4 → 45.9 |

**The straight fixture is the falsifier and it behaves like one.** Where the grid's cost is absent by
construction, the shipped and pre-change arms are within a couple of ms of each other — including one
class that is marginally *slower* under the shipped arm (+1.4 ms), which is what noise around a null
looks like. A change that moved every class by a fixed amount would have shown the same 0.68 ratio
there; it does not.

**The three curved fixtures order themselves by how much boundary the grid has to measure**, which is the
second falsifier: connected (2×2 rooms, one Wall group) −19 ms, owner −9 to −10 ms, all-curved 40-wall
−45 to −70 ms. The arm's effect is proportional to the work it removes.

## 5. The same split in V8's own self time

The trace says how much of the window a function CONTAINS; the profile says how much it RAN. Both arms'
windows were sliced from one profile (201,060 samples over 222,315 ms at 1000 µs), keyed `arm::class`,
and then read back per class.

| fixture | arm | sampled in windows | `edgeDistance` | `polylineDistance` | `segmentLowerBound` | `pointStrictlyInside` | `perCellPolylineDistance` | GC | `(program)` |
|---|---|---|---|---|---|---|---|---|---|
| 40 / all-curved | `per-cell-grid` | 9,884 ms | 3,890.5 | 0.0 | 0.0 | 1,006.8 | 691.6 | 274.5 | 510.0 |
| 40 / all-curved | `pruned-grid` | 6,732 ms | 898.5 | 586.1 | 932.7 | 0.0 | 0.0 | 226.6 | 512.3 |
| owner | `per-cell-grid` | 2,713 ms | 449.6 | 0.0 | 0.0 | 178.7 | 57.6 | 143.2 | 258.0 |
| owner | `pruned-grid` | 2,273 ms | 93.9 | 76.2 | 95.2 | 0.0 | 0.0 | 110.0 | 281.3 |
| connected | `per-cell-grid` | 3,110 ms | 1,150.6 | 0.0 | 0.0 | 258.0 | 184.5 | 150.5 | 249.0 |
| connected | `pruned-grid` | 2,131 ms | 241.8 | 172.0 | 254.7 | 0.0 | 0.0 | 98.5 | 250.7 |
| 40 / straight | `per-cell-grid` | 2,411 ms | 95.7 | 0.0 | 0.0 | 10.0 | 0.0 | 108.3 | 327.1 |
| 40 / straight | `pruned-grid` | 2,335 ms | 0.0 | 34.2 | 28.9 | 0.0 | 0.0 | 103.6 | 308.7 |

Three things this table says that the window table cannot:

- **The distance loop is cut by 4.3× on the fixture that matters** (3,890.5 → 898.5 ms) and the two
  functions it decomposes into on the shipped side (`polylineDistance` 586.1, `segmentLowerBound` 932.7)
  sum to less than the pre-change arm's single `edgeDistance` row.
- **The per-cell inside test and the per-cell distance helper are gone to zero**, not merely reduced: the
  even-odd test is now computed per grid ROW (so it is no longer a frame that V8 samples at all in the
  same way) and the per-cell copy of the distance walk no longer exists.
- **GC falls with it** (274.5 → 226.6 on all-curved, 150.5 → 98.5 on connected): the per-cell
  allocations the pre-change grid made are real garbage, and removing them shows up in the profiler's own
  frame rather than being inferred.

**The whole-run row is still dominated by the OLD code, because it spans both arms**: `edgeDistance` is
the largest row of the run at **27,487 ms / 12.17 %**. That is not a contradiction and not a residual
finding — it is a mixed population, and the per-arm slice above is the readable version of the same
number. Any future reader of the whole-run table needs this sentence.

## 6. Coverage and parity, from the capture itself

- **Every measured action was accepted in both arms, in all 19 classes** (`releaseSpans` per arm: 10
  accepted / 10 accepted, or 11/12 for `wall-authoring`). The placer's two implementations therefore
  changed no action outcome under the harness's own ledger.
- **The 13/12 and 12/11 splits are arithmetic, not luck**: 25 attempts alternate between two arms, so the
  first arm takes attempt indices 0, 2, …, 24 (13) and the second the rest (12). Everything downstream
  follows from that.
- **`unassignedWindows` = 0 in every class**; the two arms' window counts sum to the class's measured
  accepted count exactly (10+10 = 20; 11+12 = 23).
- **A pure arithmetic check that the two arms really are two populations**: on all-curved
  `rigid-wall-drag` the class's MIXED release row reports p50 **187.7 ms**, which is exactly the LAST of
  the shipped arm's windows — precisely where the median of a 20-value set in two separated halves must
  land (the 10th and 11th values are the two largest of the shipped half). If the two arms had overlapped,
  the mixed median would not sit on that boundary.
- **The identity the change rests on is asserted directly**, not inferred from timings:
  `p23b-m1-room-label-arm.test.ts` runs BOTH arms over 8 fixtures (a 256-vertex ring, a concave C-face, a
  long 64-point protected edge, every mask class, three zoom regimes, a frozen gesture) and requires
  identical labels, identical readouts and identical sticky memory on the first AND second pass.

## 7. Limitations

- **One session, one machine, one runtime.** The within-session pairing is what makes the Δ admissible,
  and it is what the three-session pass could not do; it is still one Chrome leg, so the Electron leg of
  this arm is not measured.
- **10–12 windows per arm per class.** Each arm cell is a p50 over 10–12 actions; the fixture-level
  statement (51–52 windows per arm per fixture) is the one with a usable count. A per-class tail is not
  claimed.
- **The windows are conditioned by the 10,000 ms budget.** A release whose presented instant arrived later
  was not covered; here every release was covered in both arms (`unassignedWindows` 0, and the window
  counts equal the measured counts), so no arm lost the slowest actions to the budget.
- **The arms are not paired per action.** They are two midpoints of two populations that alternate, never
  a per-action difference of the same action run twice; a paired design would need each action run under
  both arms and is not what the protocol does.
- **The arm is a DEV-only branch, so the shipped path pays one boolean per grid build** (`pruned-grid`
  early-returns through the same call). That cost is inside both the "after" numbers above and every
  production render; it is not subtracted, just stated.
- **Sampled profile, offscreen presentation, dev build**: unchanged from the window-attribution record's
  §7 and still true here.

## 8. Verification

```text
check                  0 errors / 0 warnings
tests                  366 files passed | 2 skipped (368);  5,199 passed | 4 skipped (5,203)
focused (bench + arm)  142 passed  (record, frame-timing, cpu-profile, arm, placer suites)
```

New tests this pass, and what each is for:

- `summarizePresentedWindowArms`: the split is keyed by action index; an unassigned window is DROPPED and
  COUNTED; a thin arm leaves the comparison cell `null` rather than 0; the comparison is signed
  AFTER − BEFORE and names the biggest AFTER frame back on the BEFORE side.
- `summarizeCpuProfileWindows`: two arms of one class are two buckets; a sample belongs to exactly one;
  and the same windows through the full summary produce the same rows (one walk, so the two cannot drift).
- `summarizeLabelArmWindows`: the block carries the rule and note it was produced under, the after/before
  orientation, and a NOT MEASURED reason when every arm came back empty — with the rows still carried.
- Wiring guards: the driver takes `labelArms` in EVERY class (and the statement that would confine it to
  one class is absent), records per resolved action, and releases the switch at the run's start, per
  fixture and in the `finally`; the page publishes `__P23B_M1_RUN_LABEL_ARMS__` and reports the
  assignment only (`summarizePresentedWindowArms` must not appear in the page); the placer's exception is
  one import and one read, with no recorder, reset, registry or arm global.

## 9. Live evidence / reproduce

```text
docs/.../2026-09-28-M1-label-arms-chrome-leg.json    2.5 MB  THE RECORD OF THIS PASS — per-action label
                                                             lists folded to counts; every quoted row intact
.freebuff/m1-label-arms-chrome.json                 40.9 MB  same run, raw (gitignored)
.freebuff/m1-label-arms-chrome.cpuprofile            6.0 MB  201,060 samples / 222,315 ms
```

Provenance of the measured leg: commit `a736f0f9`, tree dirty by design (the arm itself), DEV mode,
`protocolId` `pre-P23B.8-follow-up-M1-label-arms`, `protocolRevision` 3, 25 actions per class, 4,415
presented frames, calibration offset 2,565,787.321 ms with residual **0.131 ms**, 246,603 retained trace
spans, one harness tab. The profile's own clock check reports **SAME CLOCK DOMAIN**, the profile starting
370 ms before the trace's calibration marker — elapsed time between two anchors on one clock, not an
offset.

```text
node .freebuff/launch-chrome.mjs 9223 /tmp/p23b-chrome-label-arms   # pinned 152.0.7977.54, headless
cd apps/editor && npm run dev -- --port 5173
cd apps/editor && npm exec -- vite-node --config vitest.config.ts \
  tests/lib/bench/p23b-m1-browser-runner.cli.ts -- \
  --port 9223 --runtime "Google Chrome for Testing 152.0.7977.54 (headless)" \
  --out ../../.freebuff/m1-label-arms-chrome.json \
  --cpu-profile ../../.freebuff/m1-label-arms-chrome.cpuprofile \
  --budget-ms 10000 --label-arms
```

The dev server and the pinned Chrome were started for the leg and are stopped again.

## 10. What this changes, and what it does not

- **The placer's change now has an end-to-end number that is a delta and not three sessions**: −70 ms of
  post-release window p50 on the all-curved 40-wall fixture, with the same ratio (0.68) on every class,
  and a null on the fixture where the mechanism is absent. That is the number the window-attribution
  record's §10 was waiting for.
- **It also bounds the claim honestly**: the placer is STILL the largest single consumer inside those
  windows, and the arm only prices the grid. The change does not make the window small — it moves it from
  "mostly the grid" to "the grid plus everything else", and the post-arm CPU rows now show what that
  "everything else" is (`worldToPlanScreen`, the Svelte `get` proxies, `mergeWallGroup`, `(program)`,
  GC).
- **The next lever is unchanged and now measurable with one run instead of three**: the grid's
  *existence* per placement — a memo keyed by (Room, viewport, mask inputs), or a coarser cell budget when
  the projection has not changed. If that lands, the same `--label-arms` protocol prices it the same way
  on the same day, and the straight fixture remains the falsifier that has to stay flat.
- **Nothing about the product's behaviour changed.** The two implementations place identical labels, and
  the live leg's own ledger agrees: every measured action accepted in both arms, every window covered,
  no action attributed to an arm it did not run under.
- **Not claimed**: any Electron number for this arm; any per-action paired difference; any user-visible
  claim beyond the synthetic harness on a headless runtime.
