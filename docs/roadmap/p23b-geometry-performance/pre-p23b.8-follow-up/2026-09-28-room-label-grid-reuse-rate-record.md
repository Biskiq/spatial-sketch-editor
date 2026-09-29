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
| `tests/lib/editor/layout/p23b-m1-room-label-arm.test.ts` | 17/17 — the gate, the build counter, the key's exact-bit identity, the arrival-order sequence (including that it is a copy and that a new attempt starts its own order), the call census with the build range each call produced and the pass's own wall time from a real placement, the result digest (identical inputs ⇒ identical digest, a different placement ⇒ a different one), the class histogram, and the three-arm placement parity |
| `tests/lib/bench/p23b-m1-record.test.ts`, `p23b-m1-frame-timing.test.ts` | 40 + 18 — the key summary, the sequence and the call census as the class row carries them |
| `tests/lib/layout/plan-room-labels.test.ts` | 30/30 — the placer's own suite, unchanged by the instrument |
| `apps/editor` `npm test` | 366 test files / 5,211 tests pass (2 files / 4 tests skipped by their own gates) |

## 9. Live evidence / reproduce

- `2026-09-28-room-label-grid-reuse-rate-chrome-leg.json` — the compact capture of the leg below, single line, with
  each per-occurrence label array folded to the counts the capture documents in its own `labelsFolded` field and
  nothing else removed. It carries `byAction[].keySequence` for all 479 recorded attempts.
- `2026-09-28-room-label-grid-call-census-chrome-leg.json` — the second leg of the same protocol and the same
  instrument, which carries everything the first one does **plus `byAction[].labelCalls`**. §10 (the census) was
  read from it, and its own key readings are the second independent run behind §3's reproducibility bound.
- `2026-09-28-room-label-grid-pass-cost-chrome-leg.json` — the third leg, whose `labelCalls` additionally carry
  `durationMs` (each call's own wall time, entry to exit). §11 (the price) was read from it.
- `2026-09-28-room-label-grid-result-identity-chrome-leg.json` — the fourth leg, whose `labelCalls` additionally
  carry `labelsDigest` and `memoryDigest`. §12 (what the pass produces) was read from it.

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

## 12. Follow-on, same session: what the trailing pass PRODUCES

§11 priced the pass; this asks whether it produces what the pass before it produced — the question that decides
between reusing its result and only reusing its grids. Every call now also carries two digests of what it returned,
built from the same exact-bit machinery as the grid key: **`labelsDigest`** (each label's Room id, tier, both
anchors, accepted rectangle and its lines' text/style/baseline, plus the readout — what a render paints) and
**`memoryDigest`** (the sticky entries the next pass inherits).

Fourth leg, same protocol (Chrome 152 headless, residual 0.092 ms, 4,406 frames, 479 accepted actions). For each
action, the trailing call compared with the previous call that actually built grids:

| what is compared | equal | share |
|---|---|---|
| **inputs** (same grid keys, same order) | **479** | **100.0 %** |
| **labels** (same digest) | **229** | **47.8 %** |
| memory (same digest) | 356 | 74.3 % |
| all three | 229 | 47.8 % |

**Identical grid inputs do not imply identical labels.** The placement has an input the grid key does not cover —
the sticky `memory`, which the pass before it has just written — so the trailing `lod` pass resolves at the sticky
anchors (and can even place a label for a Room the earlier `geometry` pass suppressed) and lands somewhere else in
**52 %** of actions. Per class it splits cleanly: **0 %** on both 40-wall fixtures (straight *and* all-curved, every
action), **0 %** on `owner-40-curved-v1` / `whole-room-move-bridge`, and **100 %** on `connected-curved-grid-v1` in
all five classes and the other four `owner-40-curved-v1` classes.

The digest is shown discriminating before its equalities are read: **487 distinct labels digests** across the calls,
and only **65.8 %** of *consecutive* call pairs share one — a constant digest would read 100 % here and make every
equality above vacuous.

**What that settles — and it is the opposite of what §6 assumed:**

- **The result-level memo is refused by the evidence.** Returning the previous placement would paint the previous
  pass's labels, and those differ in half the actions.
- **Skipping the trailing pass is refused too.** The render it belongs to would then paint nothing — or the previous
  render's labels, which are not what it produces.
- **What survives is exactly the grid**, and it survives for a reason nothing else has: identical key ⇒ identical
  grid *necessarily*, whatever else about the two calls differs. A memo keyed by the grid's own inputs is therefore
  sound where a result memo is not, and it is the only reuse that preserves the placement that genuinely differs.
- **Its ceiling** is the grid share of the priced pass: at §11's p50s the trailing pass is 8.5 ms and the `frozen`
  baseline puts ~0.8 ms of that in the placement walk, so ≈7.7 ms per accepted action — ≈24 % of measured placer
  wall time and ≈24–33 % of the curved post-release windows. It is not a *small* cache either: the trailing pass
  rebuilds every Room's grid, so a memo has to hold the pass's key set, which §5 sized at the fixture's Room count.
- **Not claimed:** which line or tier diverges in the 52 % (the digests say *that* the labels differ, not where), and
  no product change of any kind.

## 13. What this changes, and what it does not

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
share §6 bounded the memo against, because the redundancy is a whole pass rather than a fraction of one. And §12
narrows the shape of a fix rather than widening it: identical grids do **not** mean identical labels (47.8 %), so
the result-level memo and the skipped pass are both refused on evidence, and **only a grid-level memo survives** —
which is the reuse §6 was wary of, now the only one the data supports.
- **Not changed:** anything the editor does. No placement decision, no arm default, no product path — the key, the
  sequence and the counting are DEV-only, and the placement suite plus the arm parity differential are the
  evidence.
- **Not claimed:** any timing delta (this pass measured no change, so there is no before/after to read), any cause
  for the trailing pass, any Electron number for this arm, and no user-visible claim beyond the synthetic harness
  on a headless runtime.

## 14. Follow-on, same session: the memo arm, and what the reuse is worth

§12 left exactly one reuse standing — the grid, keyed by its own inputs — and said it needed state that outlives
a render, which the placer has never held. That state now exists, as a FOURTH ARM rather than as shipped
behaviour: **`memo-grid`**, the same `seeded-grid` behind a content-addressed cache of the derived candidates,
keyed by the grid's own exact inputs, cleared per attempt (so its lifetime is one action and its key IS its
invalidation) and bound at 256 entries — above any attempt's key set, which §5 sized at the fixture's Room count.
The arm changes only how MANY times a grid is built, never which one, so its parity with `seeded-grid` is by
construction: asserted as such, with a test that also proves the memo HIT, because a cache that never hit would
pass a parity test by doing nothing at all.

Fifth leg, same protocol (Chrome 152 headless, residual 0.120 ms, 4,426 frames, 19 class rows), now with the arm
interleaved in EVERY class beside the other three, so the reuse is read inside one session against its own base.

**First, did it hit at all?** The counts cannot say — the arm records the KEY of every request it serves, so a
repeated key looks the same whether it rebuilt the grid or came from the cache. Two readings do say:

- **The profile, per arm, pooled over all 19 classes inside the measured post-release windows.** The placer's own
  self time falls from **1108.4 ms** (`seeded-grid`) to **548.9 ms** (`memo-grid`), and the grid functions in it
  from **983.4 ms** to **487.3 ms** — `edgeDistance` 480.0 → 231.0, `seededPolylineDistance` 279.7 → 144.6,
  `segmentLowerBound` 201.1 → 104.5. **Half the grid work is not done**, which is what a cache that hits looks
  like; the memo's own lookups are not a measurable cost (the only `get` in the whole profile is bundle-internal:
  504.6 ms under `memo-grid` against 527.0 under `seeded-grid`).
- **The counts, as a non-contradiction rather than as evidence.** `builds − distinctBuilds` is **28.0 %** under
  `memo-grid` against **28.1 %** under each of the other three arms: the redundancy is still recorded — every
  request still carries its key — it is just no longer paid for. This is also why the arm's reuse cannot be read
  off `distinctBuilds`, which counts distinct INPUTS, not builds; the profile above is the evidence that it hit.

**Second, what was it worth?** Post-release window p50, `seeded-grid` → `memo-grid`, per class (five windows
each; the control is the same session's `seeded-grid` → `pruned-grid`):

| fixture | classes | `memo-grid` ÷ `seeded-grid` | control `seeded-grid` ÷ `pruned-grid` |
|---|---|---|---|
| `p23b-40-wall-all-curved-v1` | 5 | **0.804 – 0.849** | 0.736 – 0.885 |
| `connected-curved-grid-v1` | 5 | 0.761 – 0.974 | 0.674 – 0.882 |
| `owner-40-curved-v1` | 5 | 0.903 – 1.094 | 0.858 – 1.027 |
| `p23b-40-wall-straight-v1` | 4 | 0.841 – 1.040 | 0.950 – 1.064 |

Median of the 19 class p50s: **38.50 ms → 36.08 ms** (the same session's `pruned-grid` median is 43.26 ms).
Median per-class ratio **0.849** — the memo arm is 15 % faster — median per-class delta **−4.87 ms**, and the memo
arm is faster in **17 of 19** classes. The all-curved fixture, the one §11 reads the `bend` window on, moves
**88.1 → 72.2**, **88.0 → 72.1**, **92.4 → 76.1**, **78.3 → 66.5** and **89.8 → 72.2** ms, i.e. **−15 % to
−20 %**. The two classes that are SLOWER are both `rigid-wall-drag`, on the fixtures with the smallest windows
(`owner` **+3.7 ms**, straight **+1.0 ms**), and are read as noise at five windows rather than as a cost of the
arm.

**What that settles.** The reuse is real, and it is worth **≈15 % of the post-release window** across the protocol
and **15–20 %** on the all-curved fixture — smaller than §11's ≈24–33 % bracket, because the memo skips the
trailing pass's BUILDS and not its placement, which still runs on the memory it inherits. For scale, the same
session's `seeded-grid` → `pruned-grid` control is 0.882 (the previous pass's kept change, reproduced in this leg
at the same order), so the memo's own delta is of that order too.

**Status AT THIS POINT: measured, not shipped.** `memo-grid` is reachable only through the DEV switch,
`seeded-grid` is still the default, and the placement suite plus the four-arm parity differential are unchanged in
what they require. Promoting it is a separate decision, not taken here.

> **SUPERSEDED FOR STATUS — read §15 and §16.** The decision this paragraph left open was taken: the cache now
> reaches the shipped placer (§15), so "no cache reaches the product path" is no longer true of this work, and the
> arm above is named `no-memo-grid` (§15). The paragraph is kept as the record of what was true when §14 was
> written, which is also why `memo-grid` appears in it and nowhere else. §16 then re-prices the shipped cache on a
> workload whose geometry does not repeat — the number a session can count on is ≈0.87 of the bypass, not the 0.694
> §15 read on a repeated loop.

**Not claimed:** any Electron number for this arm, any user-visible claim beyond the synthetic harness on a
headless runtime, and any cross-session comparison — every arm above was read inside this one leg, and the two
classes that regressed are stated rather than smoothed.

## 15. The reuse is PROMOTED, and re-measured on the shipped path

§14 measured the reuse behind a DEV arm and left promoting it as a separate decision. It is now taken: the
SHIPPED path runs the seeded grid through a bounded, content-addressed cache of the derived candidates, owned by
the placer's own module, and the arm that measured it became **`no-memo-grid`** — the same grid with the cache
BYPASSED, which is what the comparison below needs to price.

**What shipped.** `plan-room-labels.ts` owns one `Map` keyed by the grid's own exact-bit inputs, bounded at 256
entries with oldest-first eviction (above the measured working set — the fixture's Room count, 4–61) and cleared
by nothing, because it is SELF-INVALIDATING: the grid reads the projected polygon, the mask and the centre and
nothing else, and those are exactly what the key hashes, so a hit means identical inputs and therefore an
identical grid. It needs no invalidation owner, no shared store and no new dependency. The key itself moved out
of the arm instrument into its own module (`room-label-grid-key.ts`) so that a shipped path is not keyed by a
module whose job is to measure it; the instrument imports the same function and the same primitives, so there is
exactly one implementation of the hashing and §12's digests still mean what they say. The legacy `pruned` and
`per-cell` grids never consult the cache — they build DIFFERENT grids from the same inputs — and `no-memo-grid`
skips it on purpose.

**The lifetime is deliberately the module's, not one settle's.** A per-settle lifetime would need a hook in the
render path to clear the cache, i.e. a new invalidation owner for a cache whose key already IS its invalidation.
This pass does not add one; bounded SIZE is what keeps the cache honest, and §5's measurement is the bound it is
sized from.

**Output identity, before any timing.** The arm parity differential now runs the shipped path against the bypass
on EVERY fixture, and each case asserts both that the cache was EXERCISED (hits > 0, from the cache's own
counters) and that the shipped path places exactly what the bypass places — labels AND the sticky memory — so the
reuse is shown to be invisible in the output before its price is read.

**Sixth leg, same protocol** (Chrome 152 headless, residual 0.134 ms, 4,420 frames, 19 class rows). The bypass
arm reproduces the PRE-promotion shipped path to within 1 % on the same classes (pooled grid-function self time
991.5 ms against §14's 983.4; `bend` window p50 85.1 against §14's 88.1 ms), so the two legs line up and the rows
below compare a cache against the same grid without one.

**The cache's own price**, post-release window p50, per fixture (median over its classes):

| fixture | classes | shipped ÷ bypass | shipped ÷ pre-change |
|---|---|---|---|
| `p23b-40-wall-all-curved-v1` | 5 | **0.630** | 0.549 |
| `connected-curved-grid-v1` | 5 | **0.636** | 0.558 |
| `owner-40-curved-v1` | 5 | 0.899 | 0.845 |
| `p23b-40-wall-straight-v1` | 4 | 0.851 | 0.879 |

Median across the 19 classes **0.694**, and the shipped path is faster in **19 of 19** classes — no class
regressed, so the straight fixture read as the falsifier did not fire (it shows the SMALLEST gain, 0.851, exactly
where grids are cheapest). On the all-curved fixture the absolute move is 85.1 → **53.6** (`bend`), 84.6 → 51.8,
88.6 → 55.6, 75.8 → 50.5 and 86.0 → 54.5 ms. Against the grid it replaced, the shipped path is 0.549–0.879 of the
pre-change window across the four fixtures.

**The mechanism, from the profile.** Pooled over all 19 classes inside the measured windows, the grid functions'
self time falls from **991.5 ms** (`no-memo-grid`) to **1.5 ms** (shipped): the rebuilds are not made. The sampled
time inside those windows falls with it (4,810 → 3,503 ms), and on `bend` alone 436.9 → 273.0 ms, which is the
same order as that class's own window movement (−31.5 ms), so the window it saved is the grid it skipped.

**THE LIMIT, and it is the one that matters.** This protocol repeats ONE action per class (25 attempts, the same
drag restored between them), so a PERSISTENT cache also collects CROSS-ATTEMPT hits that the reuse §14 measured
does not: §14's arm cleared its cache per attempt and read **0.849**, and this leg reads **0.694**, so the
difference belongs to the cache outliving the attempt and to this workload's repetition — NOT to a claim about an
arbitrary session. What generalises is the within-settle reuse §14 justified (≈15 % of the window, 15–20 % on the
all-curved fixture); what a session that revisits the same geometry gets on top of that is real, is bounded, and
is not quantified here. Also not claimed: any Electron number, any user-visible claim, and any cross-session or
cross-tree comparison — every arm above was read inside this one leg.

## 16. The shipped cache re-measured with the geometry NOT repeating — it holds, at about half the price

§15 priced the shipped cache on a protocol that repeats ONE action per class, and said so: the undo between
attempts returns the geometry to a state the previous attempt already drew, so a persistent cache serves the next
attempt from it. That made **0.694** a repeated-workload number, and left the question it cannot answer — how much
of it survives when the geometry does not come back — open. This section closes it with a second workload run in
the SAME session, so the two readings are a within-leg comparison and not a cross-session one.

**The cold workload (`--label-arms-cold`, protocol revision 5).** After each fixture's five classes, the SAME five
classes run again under the `p23b-m1-cold:` prefix with one pan dispatched before every attempt, its direction
advancing by the golden angle. Everything else is identical — the class list, the order, the gestures, the undo
restore, the four-arm interleave, the window definition — so the only variable is whether a projection can recur.
**It is a PAN and not a zoom**, which is what makes it a controlled read rather than a second workload: a pan
translates the projected polygon and nothing else, so the cell budget (the polygon's own screen bounding box) and
the mask shift with it and the placer does exactly the same work per action, with only the cache KEY moving. The
pan is its own ledger action, deliberately left unassigned to any arm, so its windows are counted as
`unassignedWindows` and never merged into a class's gesture population.

### The workload check, and a measurement error in this pass that is recorded so it is not repeated

**THE ATTEMPT-SCOPED ORDINALS IN `byAction[].keySequence` MUST NEVER BE COMPARED ACROSS ACTIONS.**
`setP23bM1RoomLabelArm` resets `attemptKeys` on every attempt, so ordinal `1` means "the first new key THIS attempt
built" — ordinal 1 in action 2 is a different key from ordinal 1 in action 1. An earlier reading of this session
pooled those ordinals and reported a **96.8 % cross-action repeat** for the repeat workload; that number is an
artifact of the ordinal space (every attempt restarts at 1, so "already seen" is automatic), not a measurement,
and it is retracted. The cross-action-safe measure is the CLASS-scoped histogram (`labelArms.gridBuildKeys`),
which is what the numbers below use; the within-attempt share uses `byAction[].builds − Σ distinctBuilds`, the same
basis §5's replay used.

| workload | builds (attempt-scoped) | within-attempt reuse — **§5's measure** | builds (class histogram) | class-scoped distinct keys | one key rebuilt at most |
|---|---|---|---|---|---|
| repeat | 14,341 | **28.2 %** | 24,281 | 563 | **118×** |
| cold | 20,583 | **35.4 %** | 30,418 | **13,044** | **6×** |

The two columns answer the two halves of the question, and both moved the right way:

- **The within-attempt reuse §14 justified is KEPT** — 28.2 % on the repeat workload (reproducing §5's 29.8 % from
a different mechanism and a different leg) against 35.4 % cold, which is *higher* because the cold classes render
the camera move inside the attempt as well. That reuse lives inside one settle and is what a real session gets.
- **The cross-attempt recurrence is REMOVED** — 563 distinct keys became **13,044** (23×), and the worst single key
went from being rebuilt up to **118 times** to at most **6**. Per class the fall is consistent: `p23b-m1:rigid-wall-drag`
20 distinct keys / 75 rebuilds of one key against `p23b-m1-cold:rigid-wall-drag` 520 / 5.

So the cold pass is the other end of the bracket: the repeat pass is the session shape that gives a persistent cache
the most, the cold pass the shape that gives it the least.

### The price, both workloads in one session

The seventh leg carries BOTH workloads in one run (Chrome 152 headless, 439 s, residual **2.335 ms**, 10,656
presented frames, 38 class rows — the 19 repeat classes and their 19 cold twins, `connected-curved-grid-v1`
advisory as always). Post-release window p50, shipped ÷ bypass, median over each fixture's classes:

| fixture | classes | repeat | **cold** |
|---|---|---|---|
| `p23b-40-wall-straight-v1` (falsifier) | 4 | 0.829 | **0.958** |
| `p23b-40-wall-all-curved-v1` (target) | 5 | 0.620 | **0.804** |
| `owner-40-curved-v1` | 5 | 0.875 | **0.960** |
| `connected-curved-grid-v1` (advisory) | 5 | 0.621 | **0.859** |
| **all 19 classes** | | **0.739** | **0.872** |

Shipped is faster in **19 of 19** classes in **both** workloads, so the cache neither washes out nor regresses when
the geometry stops repeating. The repeat pass's own numbers here (all-curved 0.620, owner 0.875, median 0.739) are
the same workload as §15 on a different runtime and are **not** compared with §15's figures; they exist so the two
workloads can be read against each other inside one session, which is the only comparison the protocol admits.
Median class p50 35.51 → 39.58 ms (repeat) and 38.21 → 40.25 ms (cold).

**What it costs in the window.** Reading the cold column as the generalisable one: the cache is worth about
**13 % of the post-release window** (median ratio 0.872) once the geometry stops coming back, against about **26 %**
(0.739) on the repeated workload — i.e. **roughly half of §15's benefit was the undo loop**. On the target fixture
the cold ratios are 0.787–0.851, deltas of 12–18 ms; on the falsifier the straight fixture's cold ratio is 0.958,
a delta of **0.6 ms** — which is INSIDE this leg's 2.335 ms clock residual and therefore must not be read as a
measured 4 % gain. On the smallest windows, in a session that does not repeat geometry, the cache is a near-wash.

### The mechanism, from the profile

Pooled over the measured windows, 99 per arm per workload (thin — see the limits), the grid functions' self time:

| workload | `seeded-grid` (shipped) | `no-memo-grid` (bypass) | skipped |
|---|---|---|---|
| repeat | **0.0 ms** | 970.0 ms | 100 % |
| cold | **479.7 ms** | 977.4 ms | **50.9 %** |

`plan-room-labels` self time falls 1,126.4 → 3.8 ms and 1,131.7 → 553.6 ms on the same two. The repeat workload's
0.0 ms is the loop in one number — every grid request inside the measured windows is a cache hit — and the cold
workload's **50.9 %** is the answer to the question §15 left open: **about half the grid work the shipped cache
skips is within-settle reuse that any session gets, and about half was the geometry recurring.**

### Verdict: the cache STAYS, and the repeat-loop number stops being the headline

The persistent cache is not a wash and not a regression, so the bounded-lifetime alternative §15 deferred is
**not** taken, for the reason §15 gave and one new one:

1. A per-attempt lifetime would need a hook in the render path to clear the cache — a NEW invalidation owner for a
   cache whose key already IS its invalidation — to buy back a difference (0.872 → 0.739 on the repeat workload)
   that exists only inside a loop. The cold workload shows the same cache at ~0.87 with no such hook at all.
2. **The cold workload IS the bounded-lifetime case in effect.** A per-attempt-cleared cache and this cache are
   the same thing whenever the geometry does not recur, which is exactly what the cold pass constructs; so the
   column that stands in for the bounded design is already measured, and it is 0.872 — the shipped persistent
   cache reaches it by having nothing to hit rather than by being cleared.

What changes is the **claim**, not the code. §15's 0.694 and this leg's 0.739 are **repeated-workload** ratios and
must be quoted as such; the number a session can count on is **≈0.87, about 13 % of the post-release window**, and
**0.80 on the all-curved fixture** (deltas of 14–18 ms). No product behaviour changed in this section: the cold
workload is a DEV protocol mode, the shipped path still runs the one cache §15 promoted.

```text
node .freebuff/launch-chrome.mjs 9223 /tmp/p23b-chrome-cold                # pinned 152.0.7977.54, headless
node .freebuff/start-dev.mjs 5199 /tmp/p23b-dev-cold.log                   # this workspace's editor
cd apps/editor && npm exec -- vite-node --config vitest.config.ts \
  tests/lib/bench/p23b-m1-browser-runner.cli.ts -- \
  --port 9223 --url http://127.0.0.1:5199/dev/perf/p23b \
  --runtime "Chrome 152.0.7977.54 headless (cold workload)" \
  --out .freebuff/m1-label-arms11-cold-chrome.json \
  --cpu-profile /tmp/p23b-cold.cpuprofile \
  --budget-ms 10000 --label-arms-cold
```

Like §5's leg, the dev server and the pinned Chrome were started for it and stopped afterwards, and the raw capture
and the V8 profile are working artifacts (84 MB / the profile in `/tmp`) that are not committed — only the folded
capture is, 7.26 MB because it carries both workloads' 38 class rows.

**Limits, and they are not small.** The arms are thin: 99 windows per arm per workload pooled, i.e. **5–6 per arm
per class**, because one leg now carries two workloads through a four-way interleave. The clock residual is
2.335 ms (the leg ran 439 s, against 0.1 ms on the shorter legs), which is why the straight fixture's cold delta is
reported as inside the noise rather than as a gain. The cold pass is the **LOW end of a bracket, not a simulation
of a user**: a real session repeats some geometry (dragging the same Wall twice, undoing, returning to a view) and
sits between 0.872 and 0.739, and where in that range it sits is NOT quantified here. Also not claimed: any Electron
number, any user-visible claim, and any cross-session or cross-tree comparison — both workloads above were read
inside this one leg, and `connected-curved-grid-v1` stays advisory and never recorded.
