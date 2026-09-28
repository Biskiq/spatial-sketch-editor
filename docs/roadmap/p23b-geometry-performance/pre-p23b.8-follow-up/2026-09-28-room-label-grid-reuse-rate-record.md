# 2026-09-28 — The Room-label grid's reuse rate, measured

**Phase:** [`../README.md`](../README.md) · Pre-P23B.8 follow-up
**Predecessor:** [`2026-09-28-room-label-grid-ranked-walk-and-reuse-budget-record.md`](./2026-09-28-room-label-grid-ranked-walk-and-reuse-budget-record.md)

## 1. What this pass was asked to answer

The previous pass priced the placer's grid instead of guessing at it: the counter that travels with each
attempt's arm record showed **8–72 eligibility grids built per accepted action against 5–6 `p2311:plan-render-model`
renders**, and left one question explicitly open —

> the redundant share is unmeasured, and **no memo, cache or key was added**; counting how many of those builds
> repeat identical inputs is the next pass's first step.

This pass answers that question with DEV-only instrumentation, and stops at the answer. **No product behaviour was
touched, and no memo was built** — §7 states why, and it is a decision the evidence does not make on its own.

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
census.

## 8. Verification

| Gate | Result |
|---|---|
| `apps/editor` `npm run check` (svelte-check) | 0 errors, 0 warnings |
| `tests/lib/editor/layout/p23b-m1-room-label-arm.test.ts` | 14/14 — the gate, the build counter, the key's exact-bit identity, the arrival-order sequence (including that it is a copy and that a new attempt starts its own order), the class histogram, and the three-arm placement parity |
| `tests/lib/bench/p23b-m1-record.test.ts`, `p23b-m1-frame-timing.test.ts` | 40 + 18 — the key summary and the sequence as the class row carries them |
| `tests/lib/layout/plan-room-labels.test.ts` | 30/30 — the placer's own suite, unchanged by the instrument |
| `apps/editor` `npm test` | 366 test files / 5,208 tests pass (2 files / 4 tests skipped by their own gates) |

## 9. Live evidence / reproduce

- `2026-09-28-room-label-grid-reuse-rate-chrome-leg.json` — the compact capture of the leg below, single line, with
  each per-occurrence label array folded to the counts the capture documents in its own `labelsFolded` field and
  nothing else removed. It carries `byAction[].keySequence` for all 479 recorded attempts.

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

## 10. What this changes, and what it does not

- **Changed:** the redundant share is no longer unmeasured — **29.8 % of grid builds rebuild byte-identical
  inputs**, 15.3–50.0 % per class, with the per-build keys and the arrival order now travelling in every capture
  that takes the arm.
- **Changed:** the shape of the remaining lever. It is not "shave the grid's inner loop" any further (the previous
  pass did that and cut the window by 18 %), and it is not a small cache either: it is a decision between a
  cross-call cache keyed by a shipped input hash and removing a duplicated pass at its source.
- **Not changed:** anything the editor does. No placement decision, no arm default, no product path — the key, the
  sequence and the counting are DEV-only, and the placement suite plus the three-arm parity differential are the
  evidence.
- **Not claimed:** any timing delta (this pass measured no change, so there is no before/after to read), any cause
  for the trailing pass, any Electron number for this arm, and no user-visible claim beyond the synthetic harness
  on a headless runtime.
