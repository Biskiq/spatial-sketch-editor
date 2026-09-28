# 2026-09-28 — The Room-label grid's reuse rate, measured, and the pass that produces it named

**Phase:** [`../README.md`](../README.md) · Pre-P23B.8 follow-up
**Predecessor:** [`2026-09-28-room-label-grid-ranked-walk-and-reuse-budget-record.md`](./2026-09-28-room-label-grid-ranked-walk-and-reuse-budget-record.md)

## 1. What this pass was asked to answer

The previous pass priced the placer's grid instead of guessing at it: the counter that travels with each
attempt's arm record showed **8–72 eligibility grids built per accepted action against 5–6 `p2311:plan-render-model`
renders**, and left one question explicitly open —

> the redundant share is unmeasured, and **no memo, cache or key was added**; counting how many of those builds
> repeat identical inputs is the next pass's first step.

This pass answers that question with DEV-only instrumentation, then — in the same session — runs a second
DEV-only census that names *which* pass does the repeating (§10). **No product behaviour was touched, and no memo,
cache or key reached the product path** — §7 states why, and §10 states what the naming leaves open rather than
assuming it.

## 2. The instrument: a key per build, and the order they arrived in

Two pieces, both in the DEV arm module ([`p23b-m1-room-label-arm.ts`](../../../../apps/editor/src/lib/editor/layout/p23b-m1-room-label-arm.ts)),
whose single read the placer already made:

| Piece | What it is | Why |
|---|---|---|
| `p23bM1GridBuildKey` | 64-bit FNV over **every input that determines the grid** — the projected polygon, the mask with its clearances, the semantic centre — hashed over each coordinate's **exact bits** | Two builds with one key would have produced one identical grid, so `builds − distinctKeys` is exactly the work a memo could have skipped. Exact bits, not rounded: a rounded key would merge two different grids and **overstate** the rate, the one direction this measurement must not drift in |
| `byAction[].keySequence` | The attempt's builds **in arrival order**, each as the ordinal of its key in first-seen order (`1 2 1 2 1`) | The counts say *how much* repeated; the order says **whether a cache would have been there when the repeat arrived**. Recording the order lets every policy (one entry, N entries, the whole attempt) be simulated offline from the same capture instead of one policy being baked into the instrument |

The placer passes the three inputs to the same call it already makes to read its arm
([`plan-room-labels.ts`](../../../../apps/editor/src/lib/editor/layout/plan-room-labels.ts), `freeSpaceCandidates`): by reference, nothing copied,
allocated or hashed unless the gate is on — and reading them is not a decision, which is why the placement suites
are unchanged. The page hands the class's key summary and the attempt's own sequence to the record; `byAction`
carries `builds`, `distinctBuilds` and `keySequence` per accepted action, the class carries the key histogram, and
`buildsPerAction.distinct` makes `total − distinct` the attempt-scoped ceiling for a memo.

## 3. The number

One session, the protocol of the previous records: four fixtures, 19 classes, 25 accepted actions each, three arms
interleaved per attempt, pinned headless Chrome 152.0.7977.54, calibration residual **0.833 ms**, 4,434 presented
frames. **479 attempts carried a sequence; 0 were missing one; 0 had a sequence whose length disagreed with the
attempt's own build count** — the instrument is self-consistent on every attempt it recorded.

**14,680 grid builds; 10,304 of them used inputs the attempt had not already built; 4,376 builds (29.8 %) rebuilt
byte-identical inputs.**

| fixture | builds | repeats | share |
|---|---|---|---|
| `p23b-40-wall-straight-v1` | 3,830 | 1,035 | 27.0 % |
| `p23b-40-wall-all-curved-v1` | 4,850 | 1,565 | 32.3 % |
| `owner-40-curved-v1` | 4,154 | 1,195 | 28.8 % |
| `connected-curved-grid-v1` | 1,846 | 581 | 31.5 % |

| class (all-curved) | builds | repeat share |
|---|---|---|
| `rigid-wall-drag` | 890 | 43.8 % |
| `bend` | 900 | 44.4 % |
| `whole-room-move-bridge` | 500 | 50.0 % |
| `wall-authoring` | 760 | 32.9 % |
| `room-creation-commit` | 1,800 | 15.3 % |

**The straight fixture is not a falsifier here, and the record says so rather than implying otherwise.** A falsifier
discriminates a *timing* change; this is a *rate*, and every fixture repeats (27.0 % on the straight fixture against
32.3 % on the all-curved one). The rate is a property of how the Plan is planned, not of curved geometry — which is
itself the reason to look before building anything on top of it.

## 4. The structure: one full pass, then a trailing subset rebuilt

Compressing every action's sequence into runs of fresh (`N`) and repeated (`R`) keys gives one shape per class, and
it is the same shape on every action of it:

| fixture / class | shape (fresh, repeated) | actions |
|---|---|---|
| `p23b-40-wall-straight-v1` / `rigid-wall-drag` | `N20 R10` | 25 of 25 |
| `p23b-40-wall-straight-v1` / `whole-room-move-bridge` | `N10 R10` | 24 of 25 |
| `p23b-40-wall-straight-v1` / `room-creation-commit` | `N61 R11` | 25 of 25 |
| `p23b-40-wall-all-curved-v1` / `bend` | `N20 R10` · `N20 R20` | 10 · 15 |
| `p23b-40-wall-all-curved-v1` / `whole-room-move-bridge` | `N10 R10` | 25 of 25 |
| `owner-40-curved-v1` / `bend` | `N18 R9` | 22 of 25 |
| `connected-curved-grid-v1` / `room-creation-commit` | `N25 R5` | 25 of 25 |

So each accepted action builds the fixture's Rooms once, and then rebuilds a **trailing subset** of them —
half of them, or all of them — from *identical* inputs. No repeat is adjacent, none of the shapes is periodic, and
the repeated keys are always the tail of the pass. The mechanism behind that second partial pass is **not
identified here**: the placer has one production call site and one grid build per Room per call, so the trailing
rebuilds come from *more than one* `placeRoomLabels` call per accepted action, and which passes those are — and
whether the second one is *needed* — is a question about the Plan's render path, not about the grid.

## 5. What each cache policy would have hit

Replaying the recorded order under a cache of a given size (a hit = one grid build skipped):

| cache | hits | share of all grid builds |
|---|---|---|
| 1 entry (last key) | 0 | **0.0 %** |
| 2 entries | 0 | **0.0 %** |
| 4 entries | 456 | 3.1 % |
| 8 entries | 581 | 4.0 % |
| 16 entries | 4,376 | 29.8 % |
| whole attempt | 4,376 | 29.8 % |

Two facts fall out, and both matter more than the headline:

- **A small "last key" cache is worthless.** Zero hits on every class, on every fixture. The repeats are separated
  by a whole pass, so nothing catches them within a build or two.
- **The cache has to hold the pass.** 16 entries captures exactly what an unbounded per-attempt cache captures on
  this protocol, and on `connected-curved-grid-v1` 4 entries already do — i.e. the required size is **the fixture's
  Room count**, not a constant: 4, 9, 10, 18, 20, 25, 55, 61 keys appear in these sequences. A fixed-size cache is
  therefore only ever as good as the smallest Room count it was sized against.

## 6. What a memo would have to be, and what it would buy

Taking the number at its word, a memo that captured these repeats would be:

- **keyed by an exact-bit hash of every grid input** — because nothing cheaper identifies "the same grid": the
  polygon, the mask and the centre all change per frame, and the hash that exists today lives **only in the DEV
  instrument**;
- **alive across `placeRoomLabels` calls**, since the repeats straddle a whole pass;
- **sized by the Room count** with its own eviction, holding projected geometry;
- and correct only while that hash covers **every** input the grid ever grows to accept — a new term in the grid
  that the key missed would silently return a stale grid, i.e. wrong labels.

Its ceiling is the arithmetic of §3 against the previous record's attribution: 29.8 % of grid builds, and the grid
at 31.7 % of the sampled `bend` window, is **at most ≈9 % of that window** (94.9 → ~86 ms), before the hash's own
per-build cost is subtracted — on the class whose window the previous pass already cut by 18 %.

## 7. The decision this pass makes, and the one it does not

- **Not built: the memo.** What the number justifies is not a local concern of the placer in the sense this thread
  requires. A cache that must outlive a single `placeRoomLabels` call, be sized by the Room count, and be keyed by a
  hash *shipped into the product path* is new owning state with a new correctness invariant (the key must cover
  every grid input, forever), and its ceiling is ~9 % of one class's window. It is not a thing to land on the
  strength of this measurement alone, and it is not a thing this pass builds quietly.
- **Not built either: the structural fix.** The shape in §4 — one full pass plus a trailing partial pass over the
  same inputs — reads like the Plan being planned more than once per settle. If it is, the honest fix is at that
  seam, not a cache in front of it; but that is a change to the Plan's render path, which is exactly the class of
  change this thread stops and asks about rather than deciding alone.
- **Landed: the measurement.** The instrument, the capture and this record, so the next step is a decision with a
  price on it instead of another round of counting.

**The question this pass hands over:** name the second pass (§4) with one more DEV-only census — how many
`placeRoomLabels` calls an accepted action makes, with how many Rooms each, under which `reason` — and let that
choose between removing the redundancy at its source and paying for a cache. No product code changes for the
census. **That census has since been run in the same session; §10 names the pass, and the choice it leaves is
stated there rather than made here.**

## 8. Verification

| Gate | Result |
|---|---|
| `apps/editor` `npm run check` (svelte-check) | 0 errors, 0 warnings |
| `tests/lib/editor/layout/p23b-m1-room-label-arm.test.ts` | 16/16 — the gate, the build counter, the key's exact-bit identity, the arrival-order sequence (including that it is a copy and that a new attempt starts its own order), the call census with the build range each call produced and the pass's own wall time from a real placement, the class histogram, and the three-arm placement parity |
| `tests/lib/bench/p23b-m1-record.test.ts`, `p23b-m1-frame-timing.test.ts` | 40 + 18 — the key summary, the sequence and the call census as the class row carries them |
| `tests/lib/layout/plan-room-labels.test.ts` | 30/30 — the placer's own suite, unchanged by the instrument |
| `apps/editor` `npm test` | 366 test files / 5,210 tests pass (2 files / 4 tests skipped by their own gates) |

## 9. Live evidence / reproduce

- `2026-09-28-room-label-grid-reuse-rate-chrome-leg.json` — the compact capture of the leg below, single line, with
  each per-occurrence label array folded to the counts the capture documents in its own `labelsFolded` field and
  nothing else removed. It carries `byAction[].keySequence` for all 479 recorded attempts.
- `2026-09-28-room-label-grid-call-census-chrome-leg.json` — the second leg of the same protocol and the same
  instrument, which carries everything the first one does **plus `byAction[].labelCalls`**. §10 (the census) was
  read from it, and its own key readings are the second independent run behind §3's reproducibility bound.
- `2026-09-28-room-label-grid-pass-cost-chrome-leg.json` — the third leg, whose `labelCalls` additionally carry
  `durationMs` (each call's own wall time, entry to exit). §11 (the price) was read from it.

```text
node .freebuff/launch-chrome.mjs 9223 /tmp/p23b-chrome-label-arms   # pinned 152.0.7977.54, headless
node .freebuff/start-dev.mjs 5199 /tmp/p23b-dev.log                 # this workspace's editor
cd apps/editor && npm exec -- vite-node --config vitest.config.ts \
  tests/lib/bench/p23b-m1-browser-runner.cli.ts -- \
  --port 9223 --url http://127.0.0.1:5199/dev/perf/p23b \
  --runtime "Google Chrome for Testing 152.0.7977.54 (headless)" \
  --out ../../.freebuff/m1-label-arms5-chrome.json \
  --cpu-profile ../../.freebuff/m1-label-arms5-chrome.cpuprofile \
  --budget-ms 10000 --label-arms
```

The dev server and the pinned Chrome were started for the leg and stopped again afterwards; the raw runner output
and the V8 profile are working artifacts (43 MB / 6 MB) and are not committed, only the folded capture is.

An earlier leg of the same protocol (`p23b-40-wall-straight-v1` 27.0 %, `whole-room-move-bridge` 50.0 %,
`wall-authoring` 32.9 %, `room-creation-commit` 15.3 %) recorded only the aggregates, and agrees with the table in
§3 on every class whose recorded action count matched — a second run of the same instrument, not a second
measurement of a different thing.

## 10. Follow-on, same day: the census names the trailing pass

§4 left the mechanism unidentified and §7 handed over a census to name it. That census is now run —
**DEV-only, no product code changed** — and it records one entry per `placeRoomLabels` call: the Rooms it was
handed, its `reason`, whether it received the sticky `memory`, its entry time, and **the range of the
attempt's build order it produced**, so every repeat in §3 can be attributed to the call that built it.

Second leg, same protocol (Chrome 152 headless, residual 0.268 ms, 4,405 frames): **479 accepted actions,
2,692 placer calls — 5.62 per action** — and **14,388 builds, 4,084 of them repeats (28.4 %)**. The same
instrument run twice therefore reads the rate at 29.8 % and 28.4 %, which is the reproducibility bound on
this number.

| by call position | fresh | repeat |
|---|---|---|
| the action's **first** call | 2,970 | **0** |
| every **later** call | 7,334 | **4,084 (35.8 % repeat)** |

| call `reason` | calls | grid builds |
|---|---|---|
| `lod` | 1,248 | 10,387 |
| `frozen` | 965 | **10** |
| `geometry` | 479 | 3,991 |

**Every one of the 479 actions ends with a `lod` call that built a grid for every Room and was 100 %
repeats** (3,991 builds, 27.7 % of all builds), and **100 % of all repeats (4,084 of 4,084) came from later
calls — the first call of an action never repeated a single build.** The shape is the same in all 19 classes:

```text
#0 lod  (10 Rooms, 10 fresh)          the live render
#1..#3 frozen (10 Rooms, 0 builds)    the gesture frames — the memory skip, working
#4 geometry (10 Rooms, 10 fresh)      the settle, re-optimised
#5 lod  (10 Rooms, 10 REPEATS)        +14–36 ms, byte-identical inputs
```

So the trailing subset is **the settled-LOD pass that follows the geometry pass of the same settle**, over
Rooms whose projected polygons, mask and centre did not change between the two — and the `frozen` rows are
the proof that the placer already knows how to say "these inputs are unchanged, do not build a grid": it
does exactly that in 965 calls and builds **ten** grids in all of them. The trailing pass is classified
`lod`, which is what sends it down the free-space path instead.

**What that does to the decision, and what it still does not settle.** The repeat is not scattered — it is a
whole extra planning pass per accepted action, on inputs the previous pass had already planned, and the
cheaper half of it is provable from the capture: 3,991 grid builds whose inputs were byte-identical to the
pass 14–36 ms earlier. What the capture cannot see is whether the *placement* that pass produced differed
from the one before it, or whether its consumer needs a placement of its own at all — and that is the
difference between classifying that pass as unchanged (a change to how the Plan decides a label layer is
stale, i.e. the render path) and giving the placer a result-level memo (cross-call state keyed by a shipped
input hash). One of those is a local concern of the placer and the other is not, and neither is chosen here.
Assisted by the census: any fix has to be worth less than one whole pass per accepted action, because that
is what the redundancy costs — but only after the pass's own placement work is priced, which the grid keys
do not measure.

## 11. Follow-on, same session: what the trailing pass costs

§10 named the pass; this prices it. The census now also times each call **from its entry to its one exit**, so a
call's duration is the whole pass — its grid builds *and* the placement work around them. Third leg, same
protocol (Chrome 152 headless, residual 0.109 ms, 4,407 frames, 479 accepted actions):

| call group | n | p50 | mean | max |
|---|---|---|---|---|
| the action's first call (live render) | 479 | 4.900 ms | 10.649 ms | 80.700 ms |
| middle `lod` calls | 411 | 7.500 ms | 12.619 ms | 51.700 ms |
| middle `geometry` calls | 479 | 8.500 ms | 13.619 ms | 56.600 ms |
| **`frozen` calls (no grid builds)** | 884 | **0.800 ms** | 0.936 ms | 4.000 ms |
| **the trailing `lod` call (all repeats)** | 479 | **8.500 ms** | 13.204 ms | 53.800 ms |

**The trailing pass is 6,324.8 of 23,962.5 ms of measured placer wall time — 26.4 % of it.** And the `frozen` row is
the calibration that says where that money is: those calls walk the same Rooms and build essentially no grid
(ten grids across 965 calls), and they cost **0.8 ms p50** — so roughly seven of the trailing pass's 8.5 ms p50 is
the grid rebuild, not the placement walk. (Read that as an upper bound on how cheap the walk alone is, not as a
clean subtraction: a `frozen` call also skips the re-optimisation resolution a `lod` call performs.)

Priced against the window each pass lands in, from the **same session's** per-arm window rows:

| fixture | trailing p50 | window p50 | share of the window |
|---|---|---|---|
| `p23b-40-wall-all-curved-v1` (`bend`) | 25.4 ms | 92.6 ms | **27.4 %** |
| `p23b-40-wall-all-curved-v1` (`wall-authoring`) | 27.9 ms | 77.6 ms | **35.9 %** |
| `p23b-40-wall-all-curved-v1` (`rigid-wall-drag`) | 24.3 ms | 86.8 ms | **28.0 %** |
| `connected-curved-grid-v1` (`bend`) | 10.1 ms | 34.0 ms | **29.7 %** |
| `owner-40-curved-v1` (`bend`) | 6.1 ms | 40.5 ms | 15.1 % |
| `p23b-40-wall-straight-v1` (`wall-authoring`) | 5.4 ms | 30.7 ms | 17.6 % |
| `p23b-40-wall-straight-v1` (`rigid-wall-drag`) | 1.4 ms | 24.4 ms | 5.7 % |

The all-curved classes run **27.3–35.9 %** of their post-release window in this one redundant pass, and the
connected-curved fixture 24.3–32.8 %. For scale against the work already landed: the previous pass's kept change
(seeding and ranking the grid's walk) bought 18 % of the `bend` window; **this is the largest single remaining
item inside those windows that this thread has priced**, and unlike the grid's inner loop it is a whole extra pass
rather than a fraction of one.

**What the price does not settle, and the one measurement that would.** The claim that the pass is *skippable* rest
on identical grid inputs plus the placer's purity — the capture still does not record the pass's **placement
output**, so "the pass before it produced the same labels" is inferred, not shown. A DEV-only digest of each call's
result (the placed labels and the readout, bitwise) would turn that inference into evidence, and it is the same
kind of instrument this pass already added: one field on the call record, one leg, no product change.

## 12. What this changes, and what it does not

- **Changed:** the redundant share is no longer unmeasured — **29.8 % of grid builds rebuild byte-identical
  inputs**, 15.3–50.0 % per class, with the per-build keys and the arrival order now travelling in every capture
  that takes the arm.
- **Changed:** the shape of the remaining lever. It is not "shave the grid's inner loop" any further (the previous
  pass did that and cut the window by 18 %), and it is not a small cache either: it is a decision between a
  cross-call cache keyed by a shipped input hash and removing a duplicated pass at its source — and §10 has now
  named that pass (the settled-`lod` pass following the `geometry` pass of the same settle, 100 % repeats in all
  479 actions) without choosing between them — and §11 has now priced it: **26.4 % of all measured placer wall
time**, and **27.3–35.9 %** of the all-curved post-release windows (25.4 ms p50 of a 92.6 ms window on `bend`),
with the `frozen` baseline showing the placement walk alone costs 0.8 ms p50. The price is larger than the grid
share §6 bounded the memo against, because the redundancy is a whole pass rather than a fraction of one.
- **Not changed:** anything the editor does. No placement decision, no arm default, no product path — the key, the
  sequence and the counting are DEV-only, and the placement suite plus the three-arm parity differential are the
  evidence.
- **Not claimed:** any timing delta (this pass measured no change, so there is no before/after to read), any cause
  for the trailing pass, any Electron number for this arm, and no user-visible claim beyond the synthetic harness
  on a headless runtime.
