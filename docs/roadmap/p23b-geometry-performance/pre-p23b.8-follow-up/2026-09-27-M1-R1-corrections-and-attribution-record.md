# Pre-P23B.8 follow-up — the review-correction pass and the D4 · D5 · D6 attribution

```text
AUTHORITY: NONE — this is (a) the record of three review findings against the slice's own evidence and
aggregation code, what was corrected and what regression coverage now pins it, and (b) an ATTRIBUTION
READING of M1's own rows: what one accepted action of each class actually spends its time on, split
into geometry computation · state installation · Plan rendering · presentation. It chooses no
mechanism, enters no budget, sets no threshold and touches no product module. Where it names an
optimization candidate it also names the scope expansion that candidate needs, and STOPS there.

WHY IT EXISTS. The slice closed with three defects the owner's review found in its own evidence: R1's
ranking contradicted its numbers, the gesture series pooled warm-up drags and retried attempts, and
the `wall-authoring` classes' reported population (23) could not be reconciled with the other
classes' (20). The corrections are code + coverage + a regenerated capture pair (§1, §2); the
attribution pass (§3) is the follow-up's other half: before P23B.8 is allowed to argue for a Worker or
a WASM core, the slice's own rows have to say where the time goes.

ONE FINDING WAS NOT ON THE REVIEW'S LIST AND IS REPORTED HERE. Re-running the SAME corrected protocol
in a second browser session moved every row that the correction cannot touch — boundaries, releases,
presented waits — as much as 2.6× in either direction (§2.5). M1's absolutes are therefore
SESSION-CONDITIONED, and the corrected pair is published as a pair. This does not weaken the slice's
findings (each survives in both sessions, §2.4/§3) but it does constrain what a future
"before/after" may claim, which is exactly what P23B.8's entry gate would be asked for.
```

## 0. What this pass changed, by file

```text
CODE (all DEV-only; no product module, no cache, no Worker, no WASM, no baseline, no ratchet)
  apps/editor/src/lib/bench/p23b-m1-frame-timing.ts   the gesture population rule + registry action
                                                      identity; the merge now takes the class's measured
                                                      action set and REPORTS what it left out
  apps/editor/src/lib/bench/p23b-m1-record.ts         the warm-up DECOMPOSITION (slots / accepted in
                                                      slots / filtered / measured / nominal); the
                                                      gesture series resolved over that same
                                                      population; the `populations` block; `attribution`
  apps/editor/src/lib/bench/p23b-m1-attribution.ts    NEW — the phase partition (pure, derived, no new
                                                      measurement)
  apps/editor/src/routes/dev/perf/p23b/drive.ts       `bracketGestureFrames` records the resolved
                                                      action's ledger index and outcome
  apps/editor/src/routes/dev/perf/p23b/+page.svelte   passes the registry (not a pre-merged series) and
                                                      the nominal per-class count
  apps/editor/tests/lib/bench/p23b-m1-browser-runner.cli.ts   rebuilds `attribution` when it replaces
                                                      the proxy release row with the presented one
DOCS
  2026-09-27-R1-release-cost-ranking-record.md        §4 ranking corrected in place; §6 records it
  2026-09-27-M1-S4-m1-session-record.md               §3 marked as the superseded pooled reading; the
                                                      "retries are … never averaged in" sentence
                                                      corrected to FALSE
  2026-09-27-M1-{chrome,electron}-leg.json            REGENERATED under the corrected protocol
  this record · acceptance record · plan · baton
TESTS  42 focused tests now (was 29); see §1.4
```

## 1. The three corrections

```text
1.1  R1'S RANKING — corrected in place (R1 §4, recorded in R1 §6). Rows 2 and 3 had been ordered by
     which exclusive self was the SMALLER while row 1 was placed for being the LARGEST cost, and the
     unpriceable row (self withheld in every committed class) was compared against the others' selves.
     R1 §4 now ranks in ONE direction on exclusive self, reports the inclusive-only row as
     reported-not-ranked, and names the classes where a totals-based reading disagrees. No number
     changed: what the numbers may say changed.

1.2  THE GESTURE SERIES POOLED WARM-UPS AND RETRIES — fixed in code. A bracket is per ATTEMPT; the
     reported row must be per MEASURED ACTION. The registry entry now carries the resolved action's
     ledger index and outcome, and the merge keeps only brackets whose index is in the class's measured
     population. Measured symptom in the FIRST capture pair: every drag class reported its raw bracket
     count (25 registered drags where 20 measured actions remain; Electron's all-curved
     `rigid-wall-drag` 26/157 frames, connected Chrome 29/177) — while S4 §3 claimed "retries are
     recorded, never averaged in". The corrected rows report the measured population and COUNT what
     they left out (`coverage.registeredDrags` / `excludedDrags`); S4 §3 is marked superseded.
       code      apps/editor/src/lib/bench/p23b-m1-frame-timing.ts
                 (P23B_M1_GESTURE_POPULATION_RULE, p23bM1GestureFramesFor(registry, …,
                  measuredActionIndices), mergeGestureFrameSeries(measured, registeredDrags,
                  populationActions), p23bM1RecordGestureFrames(…, action))
                 apps/editor/src/routes/dev/perf/p23b/drive.ts (`bracketGestureFrames` records the
                 resolved action's identity; an attempt that never resolves records `null`)

1.3  THE `wall-authoring` POPULATION (23 vs 20) — reconciled, RULE UNCHANGED. The population rule is
     the interaction report's own: slice the path's leading completed actions, THEN keep accepted. The
     wall-authoring sequence taps an anchor before each commit and that tap records a `setup` action of
     the SAME path, so warm-up slots are consumed by non-reported actions and the class keeps more than
     `25 − 5` accepted actions. The old row reported `warmupExcluded: min(warmup, accepted)` = 5 beside
     `measuredAccepted: 23`, which reads as an arithmetic error. The row now reports the decomposition
     — completedOfPath · warmupSlots · warmupAcceptedExcluded · consideredAfterWarmup ·
     excludedByOutcome · measuredAccepted · nominalMeasured · matchesNominal — and the session record
     carries it per class (`populations`).
       measured (every fixture, BOTH runtimes, corrected captures): `wall-authoring` completedOfPath 50
       = warmupSlots 5 (3 `setup` + 2 accepted) + excludedByOutcome 22 + measuredAccepted 23;
       `nominalMeasured` 20, `matchesNominal` FALSE — stated, not hidden. Every other class:
       completedOfPath 25 = warmupSlots 5 (5 accepted) + 0 + measuredAccepted 20, matchesNominal TRUE.
       The identity holds per class, so no count can go missing, and `populations.measuredCounts`
       reports [20, 23] for the session.
       THE RULE DID NOT CHANGE and must not: M1's mark rows, release spans and D1 rows are supposed to
       match the interaction report's population (the P23B.6 S1b comparison), and that rule is
       slice-then-filter. S7 — R1's source — uses accepted-then-slice and reports 20 for the same class
       (R1 §1). Both are stated; the two sources' rows are NEVER compared by count.

1.4  REGRESSION COVERAGE ADDED (all with the fix; 42 focused tests, was 29):
       tests/lib/bench/p23b-m1-frame-timing.test.ts   · the merge reports what it left out, and cannot
                                                        report a negative exclusion
       tests/lib/bench/p23b-m1-record.test.ts         · warm-up is decomposed in slots; the identity
                                                        holds; a class whose measured count is not
                                                        `actions − warm-up` is MARKED and both counts
                                                        are listed; the gesture series is merged over
                                                        the class's own measured population (warm-up
                                                        and unresolved brackets excluded); an empty
                                                        measured population reports NO series
       tests/lib/bench/p23b-m1-attribution.test.ts    · the phase map, the unclassified remainder, the
                                                        no-phase-total rule, exclusive-self-only ranking
```

## 2. The regenerated evidence — the corrected capture pair

### 2.1 Conditions, unchanged from the slice

```text
BOTH LEGS, same protocol id and same conditions as the committed pair: one harness tab, 1500×1000 DPR 1,
ladder 19.292586186549904 px/m, guard 6000 ms, warm-up 5, 19 class rows, every committed fixture
`settled: true`, 0 dropped boundaries, advisory connected case last and excluded from D1/D7.

  CHROME   presented frames 4,419 · calibration residual 0.454 ms · one harness tab (`created`)
  ELECTRON presented frames 4,405 · calibration residual 0.367 ms · one harness tab (`existing`)

PROVENANCE, STATED PLAINLY: both captures carry commitSha `33d532f5` and `treeDirty: true`, because the
corrections above are NOT committed (the owner's instruction: no commits). The captures therefore
describe `33d532f5` + this pass's worktree diff, which is exactly the code that produced them. The
FIRST pair, kept beside the runner logs for the comparisons below, is in the committed tree at the same
paths (recoverable with `git show HEAD:<path>`).
```

### 2.2 The population, decomposed (both runtimes identical)

```text
class                     completedOfPath  warmupSlots  accepted in slots  filtered  MEASURED  nominal  matches
the four drag/tap classes        25             5               5              0         20       20     true
`wall-authoring`                 50             5               2             22         23       20     FALSE
measuredCounts = [20, 23]     ·     no row over one count is compared with a row over the other
```

### 2.3 The gesture coverage after the fix (registered → merged, excluded, frames)

```text
CHROME                                                            ELECTRON
rigid-wall-drag      straight   25 → 20  (5 excluded)  121 frames  ·  120
whole-room-move      straight   25 → 20  (5)           123         ·  120
rigid-wall-drag      all-curved 25 → 20  (5)           120         ·  120
bend                 all-curved 25 → 20  (5)           120         ·  121
whole-room-move      all-curved 25 → 20  (5)           121         ·  120
rigid-wall-drag      owner      25 → 20  (5)           120         ·  120
bend                 owner      25 → 20  (5)           123         ·  121
whole-room-move      owner      25 → 20  (5)           125         ·  121
rigid-wall-drag      connected  29 → 20  (9 excluded)  122         ·  120
bend                 connected  25 → 20  (5)           121         ·  122
whole-room-move      connected  25 → 20  (5)           120         ·  122
```

### 2.4 Before / after, and the decomposition that separates the FIX from the SESSION

```text
The published-first column is session 1's pooled reading. The re-read column re-reads SESSION 1's own
retained frame intervals under the corrected rule (its trailing 120-frame window, i.e. the frames left
once the warm-up drags are dropped — an APPROXIMATION: it drops a window rather than identifying the
excluded drags, so it isolates them where they are contiguous and not where they are interleaved).
The corrected column is the regenerated capture. The last column is the class's `release` boundary p50
in the two sessions — a CONTROL: it comes from the measured population in BOTH captures (§2.5), so its
movement is machine/session variance, and it is what the gesture row would have moved by had the fix
done nothing.

p50 ms                                    CHROME                                        ELECTRON
class / fixture            S1 pooled   S1 re-read   S2 corrected   release S1→S2   S1 pooled   S1 re-read   S2 corrected   release S1→S2
rigid-wall-drag straight      16.7        16.7          16.8       50.7 → 33.3       16.7        16.7          16.7       44.5 → 36.3
whole-room      straight     179.8       177.4          96.6      155.8 → 83.9      156.0       155.0         110.3      129.6 → 94.6
rigid-wall-drag all-curved    95.9        95.9*         17.8       97.1 → 69.0       98.4        16.8          17.8      101.2 → 86.2
bend            all-curved   103.0        17.7          18.2       94.5 → 66.5      122.8       123.4          76.0      144.1 → 78.1
whole-room      all-curved   367.9       377.1         212.8      300.0 → 170.1     469.5       505.0         241.9      353.8 → 188.5
rigid-wall-drag owner         19.2        17.4          23.3       70.5 → 72.8       28.5        28.5          17.5      112.0 → 53.2
bend            owner         18.6        18.6          17.7       73.5 → 51.8       17.7        17.7          20.4       98.1 → 56.7
whole-room      owner        222.8       226.0         159.1      181.0 → 130.4     323.2       323.8         167.1      249.2 → 131.3
rigid-wall-drag connected    104.1       104.6          83.4       71.9 → 57.5      199.7       201.3          77.1      133.4 → 50.7
bend            connected     26.5        26.5          18.3       33.7 → 27.6       17.5        17.4          17.6       41.5 → 33.2
whole-room      connected    103.8       103.0          79.8       69.0 → 53.2      195.0       195.0          78.5      127.8 → 52.8
* the trailing-window re-read cannot isolate this class's excluded frames (they are interleaved, not
  trailing); the corrected re-run reads 17.8 and the Electron row of the SAME class re-reads 16.8.

WHAT THIS SAYS, WITH THE FIX AND THE SESSION SEPARATED:
· On the drag and bend classes the FIX is the whole story: Electron all-curved `rigid-wall-drag` reads
  98.4 pooled and 16.8 re-read in the SAME session — −83 % with no code change other than the
  population — and the corrected re-run reads 17.8. Chrome all-curved `bend`: 103.0 → 17.7 same session,
  18.2 corrected. Their release CONTROL barely moved (×0.85, ×0.70).
· On the whole-Room classes the fix is NOT the story: Electron all-curved re-reads 505.0 against 469.5
  pooled in the same session, and Chrome re-reads 377.1 against 367.9. The published drop to 241.9 /
  212.8 is the SECOND SESSION being faster, which the release control independently confirms for the
  same class (353.8 → 188.5 = ×0.53 against the gesture's ×0.52).· SO THE CORRECTED WHOLE-ROOM FIGURE IS A PAIR, NOT A NUMBER: 212.8 / 377.1 Chrome and 241.9 / 505.0
  Electron for the all-curved fixture, and 96.6 / 177.4 and 110.3 / 155.0 straight. It is ≥ 96.6 ms p50
  in every session and every reading, against 16.7–23.3 ms for the drag classes on the same surface.
```

### 2.5 The control: what the correction could NOT change, and it did not

```text
The gesture series was the ONLY row merged over the registry. In BOTH captures the boundary rows, the
release spans, the presented-frame row and the mark rows were already taken over `measured`
(`m1Population` fed `measured` to `summarizeContainmentByPath` and to `releaseSpansOf` before this
pass, and still does). The evidence that this is so, rather than an assurance: the population split
(releases 20/20 and 23/23, coverage 1.0 on 17 of 19 classes) and the mark/boundary counts are identical
in the two captures — only the gesture coverage changed shape (25→20 brackets, 150→120 frames).

THEREFORE every movement in a boundary or presented row between the two sessions is MACHINE, not code:

p50 ms, session 1 → session 2                                                 CHROME              ELECTRON
`release`, all-curved whole-Room move                                        300.0 → 170.1        353.8 → 188.5
`release`, all-curved rigid-wall-drag                                         97.1 →  69.0        101.2 →  86.2
`release`, owner-curved rigid-wall-drag                                       70.5 →  72.8        112.0 →  53.2   (×1.03 and ×0.47)
presented wait, all-curved rigid-wall-drag                                   218.6 → 154.9        229.5 → 184.5
presented wait, all-curved wall-authoring                                    292.4 → 170.3        315.9 → 195.2
presented wait, owner-curved room-creation-commit                             84.7 →  71.5        171.7 →  91.2
presented wait, straight rigid-wall-drag                                      36.6 →  24.9         31.5 →  25.3
`browser-frame` PROXY, all-curved rigid-wall-drag                             26.4 →  20.2         28.9 →  28.2

THE SESSION FACTOR SPANS ×0.38 … ×1.03 ACROSS THE 38 ROWS WITH NO CODE CHANGE. Two consequences, both
recorded as limits and not as findings: (i) M1's absolutes are condition-bound — a row is comparable to
another row IN ITS OWN SESSION, and the second session's readings are the second session's; (ii) any
future "before/after" for an optimization must be taken in one session or it will measure the machine.
This is also why the owner's "all 38 p50s reproduce" reading remains true and is not contradicted here:
that claim was about re-deriving the rows from the SAME capture, which is what §2.4's re-read column
does. Cross-session reproduction was never claimed and does not hold.
```

### 2.6 D1's rows and long-frame incidence in the corrected pair (for the leg records)

```text
READING RULE, because the leg records (S2/S3) and the session record (S4) were written from the FIRST
pair and their live captures beside them are now the RE-RUN: every per-class table in those records
describes SESSION 1 (head `b6f2203b`, clean tree). The corrected session's tables are the ones below and
the captures themselves; a number quoted from those records must say WHICH session it came from.

D1 ROWS, `release` boundary p50 / p95 ms, corrected pair (COMPARISON ONLY, as before — a differently-run
capture is never a delta claim, and P23B.6's S1b numbers are unchanged in the closed record):

  class                     fixture                CHROME S1 → S2                         ELECTRON S1 → S2
  wall-authoring            straight-40            42.6 → 32.6  (p95 47.9 → 33.7)        39.5 → 35.2  (p95 → 38.7)
  wall-authoring            all-curved-40         141.9 → 84.5  (p95 173.2 → 102.3)     165.2 → 86.6  (p95 → 127.3)
  wall-authoring            owner-curved           92.9 → 59.7  (p95 106.9 → 64.7)     157.1 → 65.3 (p95 → 84.5)
  whole-room-move-bridge    straight-40           155.8 → 83.9  (p95 184.6 → 87.1)     129.6 → 94.6 (p95 → 118.0)
  whole-room-move-bridge    all-curved-40         300.0 → 170.1 (p95 531.0 → 189.5)    353.8 → 188.5 (p95 → 222.3)
  whole-room-move-bridge    owner-curved          181.0 → 130.4 (p95 727.6 → 149.3)    249.2 → 131.3 (p95 → 166.3)
  counts unchanged: 23 for every `wall-authoring` row, 20 for every whole-room row.
This is the D1 finding AGAIN and it is the same finding: P23B.6's S1b increases (2,147.0 → 3,601.2 and
73.4 → 493.4) are NOT reproduced in either session, no cause is claimed, and the two sessions differ
from each other by the same machine factor as everything else (§2.5).

LONG-FRAME INCIDENCE (committed fixtures only; ≥ 50 ms by the observer's own threshold), corrected pair:
  CHROME 1,305 long frames, 838 of them ≥ 100 ms      SESSION 1 was 1,356
  ELECTRON 1,297 long frames, 866 of them ≥ 100 ms    SESSION 1 was 1,519
The incidence is an incidence row and never a latency row (§S4), and its two sessions agree far more
closely than the latencies do — which is why it is reported beside the session and never folded into a
latency claim.
```

### 2.7 Coverage of the presented row in the corrected pair

```text
Chrome  20/20 on 18 of 19 classes; owner-curved whole-Room move 19/20 (coveredShare 0.95)
Electron 20/20 or 23/23 on 18 of 19; connected rigid-wall-drag 18/20 (0.90) — the advisory case, and
        the only row any D1/D7 reading excludes anyway.
No presented row is reported without its coverage; no missing release is imputed.
```

## 3. The attribution: what one accepted action spends its time on

```text
METHOD. Read out of the class's own keyed rows in the corrected captures; the partition is the one the
harness now writes into every class row (`attribution`), produced by
apps/editor/src/lib/bench/p23b-m1-attribution.ts and pinned by its own tests. Two rules travel with
every number below:

  NO PHASE TOTAL, EVER. The labels nest: on all-curved whole-Room move the class reports SIX
  `mesh-prebuild` occurrences per accepted action inside ONE release, each with its own p50. Summing a
  phase would count the same millisecond several times. Occurrence counts and per-occurrence
  distributions are therefore reported side by side, and `occurrencesPerAction` is stated so a
  once-per-gesture row and a once-per-wall row are never read as the same size.

  EXCLUSIVE SELF ONLY, AND ONLY WHERE PRICEABLE. `p50` is the row's INCLUSIVE interval; a row whose
  self is withheld has no comparable exclusive number and is never ranked or subtracted. Where a row
  encloses another (`preview-compile`, `chain-canonical-gates`, `acceptance-compile` all enclose a full
  compile), the row says so.

  A LIMIT STATED UP FRONT. M1's record retains keyed rows, not the containment TREE, so which boundary
  a mark sat inside is generally not recoverable from the capture. Phase membership below is the
  label's own meaning and its caller in the code — stated as such. ONE placement question is settled by
  arithmetic rather than inference, and §3.2 uses that.

THE PHASE MAP (label → phase, as committed): geometry computation (room-geometry-compile ·
preview-compile · preview-compile-reused · chain-canonical-gates · acceptance-compile · curve-sampling ·
finite-thickness · junction-resolution · standalone-wall-build · face-extraction · correspondence ·
snap-wall-index · snap-resolution · architecture-snap-resolution · wall-chain-plan · proposal-derive ·
preflight · preflight-topology · topology-pre · topology-post · chain-topology-gate · structural-pre ·
structural-post · junction-partition · room-reconciliation · opening-set · portal-relations) ·
state installation (mesh-prebuild · preview-install · wall-chain-commit-install · commit-capture ·
commit-replace · commit-matches · gesture-commit · selection-hit · baseline-restore ·
restore-mesh-install · restore-project-clone · restore-model-project · restore-reactive-write ·
restore-issues-clone · restore-bookkeeping) · Plan rendering (plan-render-model · plan-salience ·
plan-presentation · plan-svg-context-ink · svg-attributes) · presentation (the release-side signal
reported BESIDE the phases, never a phase member) · unclassified (everything else, WITH its rows: an
unknown DEV mark, or a mark that wraps more than one phase — `authoring-release`, a whole wall-authoring
release; `pointermove-rigid` / `pointermove-bend`, a whole pointer-move's preview handling).
```

### 3.1 D4 — the whole-Room move: six mesh preparations per accepted action

> **CORRECTED IN THIS PASS.** The heading below said "six full-generation mesh preparations". The
> preparations are NOT full generations: each one reuses 36 of 40 Walls and rebuilds exactly the 4 whose
> compiled Wall changed, with the reason recorded (`{ built: 4, reused: 36, refusedByReason: {
> 'compiled-wall-changed': 4 } }`). What is paid six times per accepted action is a full-generation
> **comparison** — 61–68 ms of each 72–81 ms preparation — not a full-generation rebuild. Every
> "full-generation" claim in this section and in §4 is superseded by
> `./2026-09-27-D4-D5-D6-live-attribution-record.md` §3, which measured the accounting the mark could
> not state.

`whole-room-move-bridge`, all-curved fixture, corrected session. `self` = exclusive self p50,
`p50` = inclusive p50; occurrences per accepted action beside.

| row | occ / action | Chrome p50 (self) | Electron p50 (self) | phase |
| --- | --- | --- | --- | --- |
| `mesh-prebuild` | **6** | **62.7 (61.8)** | **71.6 (70.5)** | state installation |
| `preview-compile` | 5 | 27.9 (withheld) | 32.3 (withheld) | geometry computation (encloses a compile) |
| `room-geometry-compile` | 10 | 12.5 (7.4) | 14.7 (10.2) | geometry computation |
| `baseline-restore` | 6 | 10.0 (withheld) | 10.8 (withheld) | state installation |
| `restore-reactive-write` | 6 | 9.4 (withheld) | 10.3 (withheld) | state installation |
| `plan-render-model` | 8 | 8.5 (8.5) | 9.7 (9.7) | Plan rendering |
| `commit-capture` | 1 | 1.3 (1.3) | 1.4 (1.4) | state installation |
| `plan-salience` | 8 | 0.5 (0.5) | 0.5 (0.5) | Plan rendering |
| `preview-install` | 5 | 0.0 (0.0) | 0.0 (0.0) | state installation |
| `commit-replace` | 1 | 0.9 (withheld) | 1.0 (withheld) | state installation |
| boundary `release` | 1 | 170.1 | 188.5 | presentation (boundary) |
| boundary `browser-frame` | 6 | 34.5 | 39.6 | presentation (boundary) |
| presented wait after release | 1 | 150.8 | 183.0 | presentation |

```text
THE SAME MARK ON TWO PATHS, SAME FIXTURE, SAME SESSION — this is the D4 finding:
  whole-Room move   `mesh-prebuild` SIX occurrences per accepted action at 61.8 / 70.5 ms self
  rigid-wall-drag   `mesh-prebuild` ONE occurrence per accepted action at 12.7 / 12.7 ms self
  and the S7 wall-chain commit (R1's source) reports 11.7 ms p50 for the same mark (R1 §3).
The mark's magnitude is a property of the GESTURE — how much geometry one preview invalidates — not of
the mark. Moving one wall re-prepares one generation ONCE, at commit. Moving the whole Room runs a
preparation on EVERY preview frame: the class makes 5–6 preview updates per accepted action
(`preview-install` 5, `preview-compile` 5, frames-per-action 6) and every one of them lands its own
`mesh-prebuild`. Each of those preparations REUSES 36 of 40 Walls (measured, §3 of the live-attribution
record); the 62–72 ms is the comparison that finds the 4 that changed.

FRAME-LEVEL CROSS-CHECK (medians of two different populations, never summed — §3's first rule): the
median per-occurrence self of that row against the median frame INTERVAL of the same class's drag:
  Chrome   straight 45.2 ms of 96.6 ms  ·  all-curved 61.8 ms of 212.8 ms
  Electron straight 52.3 ms of 110.3 ms ·  all-curved 70.5 ms of 241.9 ms
So on the straight fixture mesh preparation is ~47 % of the median frame, and on the curved fixture ~29 %
of a frame that is itself 2.2–2.4× longer. The whole-Room class is also the only one whose frames are
UNIFORMLY long: 100 of 123 frames ≥ 50 ms (Chrome straight), 100 of 121 (Chrome all-curved), 100 of 120
(Electron, both) — ~4 in 5 — against 20 of 121 for the straight drag and 60 of 120 for the curved drag
classes, whose p95 (225–327 ms) is where their stalls sit instead.
```

### 3.2 D5 — the wall-snap index, and a placement this pass can PROVE

`p2311:snap-wall-index`, one occurrence per accepted action, `self` = its own duration:

| class | fixture | Chrome p50 (self) | Electron p50 (self) | class `release` p50 | class frame p50 |
| --- | --- | --- | --- | --- | --- |
| `rigid-wall-drag` | straight-40 | 13.3 (13.3) | 13.8 (13.8) | 33.3 / 36.3 | 16.8 / 16.7 |
| `rigid-wall-drag` | all-curved-40 | **173.2 (173.2)** | **231.3 (231.3)** | 69.0 / 86.2 | 17.8 / 17.8 |
| `bend` | all-curved-40 | 168.6 (168.6) | 217.1 (217.1) | 66.5 / 78.1 | 18.2 / 76.0 |
| `rigid-wall-drag` | owner-curved | 87.9 (87.9) | 73.9 (73.9) | 72.8 / 53.2 | 23.3 / 17.5 |
| `bend` | owner-curved | 67.1 (67.1) | 75.1 (75.1) | 51.8 / 56.7 | 17.7 / 20.4 |
| `bend` | connected (advisory) | 59.2 (59.2) | 72.2 (72.2) | 27.6 / 33.2 | 18.3 / 17.6 |
| `whole-room-move-bridge` | every fixture | absent (count 0) | absent (count 0) | — | — |
| `rigid-wall-drag` | connected (advisory) | absent (count 0) | absent (count 0) | 57.5 / 50.7 | 83.4 / 77.1 |

```text
WHAT THIS SAYS. The same 40-wall document costs 13.3 ms on the straight control and 173.2 ms all-curved
on one runtime in one session — a 13× spread that tracks the per-wall span set (curved walls carry their
sample spans), not the wall count. It is absent from the whole-Room path entirely, and (in the connected
advisory fixture's drag class) from that fixture too.

THE PLACEMENT IS NOW ARITHMETIC, NOT INFERENCE. For each action the mark is either inside the `release`
boundary's interval or outside it. If it were inside for a majority of actions, then for those actions
release ≥ 173.2 ms and hence p50(release) ≥ 173.2 ms. The class reports p50(release) = 69.0 ms (Chrome)
and 86.2 ms (Electron). Therefore the mark is NOT inside the release for a majority of accepted actions
on either runtime: it is paid OUTSIDE the synchronous release — which is what D5's premise asserts
(non-document-independent POINTER-MOVE work) and what this pass can now state as measured rather than
inferred. The same inequality holds on EVERY curved row in the table above (bend 168.6 > 66.5 and
217.1 > 78.1; owner rigid 87.9 > 72.8 and 73.9 > 53.2; owner bend 67.1 > 51.8 and 75.1 > 56.7;
connected bend 59.2 > 27.6 and 72.2 > 33.2) and against `plan-apply` (57.1 / 71.7 ms, all-curved
rigid). It does NOT hold on the straight control, where the mark (13.3 / 13.8) is small enough that
containment inside the release (33.3 / 36.3) cannot be excluded — so the proof is specifically about the
curved rows, which are the ones that matter here. Nor can the mark be inside the class's MEDIAN frame on
the curved fixture (17.8 ms): it lands on the frames that make the class's p95 238–327 ms.

MECHANISM, READ FROM THE CODE AND MARKED AS SUCH (not measured here):
  packages/layout-core/src/layout-snap.ts
    wallSnapIndex(geometry)              memoized per geometry object; the mark wraps the miss
      dedupeWallSpans(span)              groups the wall spans, then per wall
        mergeWallGroup                    tries a proven traversal extent (O(k)), else
          farthestEndpointPair            a quadratic scan over that wall's OWN span endpoints
          withinChordTolerance            a chord scan over the same endpoint set
  Caller: LayoutPlanViewport resolves snaps per pointer move via resolveLayoutSnap, which is where the
  index is reached from — consistent with the arithmetic above, and no longer merely consistent with it.
```

### 3.3 D6 — the post-release wait is a property of the FIXTURE, not of the release

`release → next presented frame` (presentation-grade, coverage stated per class) beside the synchronous
release of the SAME actions. Corrected session, p50 ms, CHROME / ELECTRON.

| class | fixture | release p50 | presented wait p50 | `browser-frame` PROXY |
| --- | --- | --- | --- | --- |
| `rigid-wall-drag` | straight-40 | 33.3 / 36.3 | 24.9 / 25.3 | 12.3 / 11.9 |
| `whole-room-move-bridge` | straight-40 | 83.9 / 94.6 | 23.0 / 49.2 | 14.3 / 15.6 |
| `wall-authoring` | straight-40 | 32.6 / 35.2 | 30.6 / 54.1 | 16.7 / 16.4 |
| `room-creation-commit` | straight-40 | 32.6 / 33.9 | 29.1 / 56.0 | 16.3 / 16.2 |
| `rigid-wall-drag` | all-curved-40 | 69.0 / 86.2 | 154.9 / 184.5 | 20.2 / 28.2 |
| `bend` | all-curved-40 | 66.5 / 78.1 | 154.1 / 189.4 | 18.4 / 22.8 |
| `whole-room-move-bridge` | all-curved-40 | 170.1 / 188.5 | 150.8 / 183.0 | 34.5 / 39.6 |
| `wall-authoring` | all-curved-40 | 84.5 / 86.6 | 170.3 / 195.2 | 12.3 / 16.0 |
| `room-creation-commit` | all-curved-40 | 108.2 / 93.2 | **214.0** / 184.6 | 92.0 / 73.6 |
| `rigid-wall-drag` | owner-curved | 72.8 / 53.2 | 78.8 / 83.3 | 18.3 / 13.3 |
| `bend` | owner-curved | 51.8 / 56.7 | 60.9 / 81.8 | 12.4 / 12.5 |
| `whole-room-move-bridge` | owner-curved | 130.4 / 131.3 | 62.9 / 75.5 | 27.2 / 30.4 |
| `wall-authoring` | owner-curved | 59.7 / 65.3 | 64.2 / 66.9 | 9.7 / 11.5 |
| `room-creation-commit` | owner-curved | 65.0 / 60.3 | 71.5 / 91.2 | 24.4 / 21.0 |
| `rigid-wall-drag` | connected {advisory} | 57.5 / 50.7 | 75.6 / 83.7 | 21.2 / 20.6 |
| `bend` | connected | 27.6 / 33.2 | 71.0 / 75.8 | 10.1 / 12.2 |
| `whole-room-move-bridge` | connected | 53.2 / 52.8 | 72.5 / 86.2 | 19.9 / 21.7 |
| `wall-authoring` | connected | 31.3 / 31.6 | 75.3 / 91.8 | 16.7 / 15.9 |
| `room-creation-commit` | connected | 35.0 / 31.6 | 81.9 / 69.2 | 33.1 / 29.5 |

```text
THE WAIT IS A FIXTURE PROPERTY. On the all-curved document EVERY class waits 150.8–214.0 ms (Chrome) /
183.0–195.2 ms (Electron) after its release ended — including both TAP classes, whose release is
84.5 / 86.6 ms in one of them. On the straight document the same classes wait 23.0–56.0 ms. The
synchronous release moves ×2.4 for the same fixture change (36.3 → 86.2 ms, rigid); the wait moves ×7.3
(25.3 → 184.5). The two rows therefore do NOT track each other, which is what the review said and what
this table shows on every class: the biggest release on the curved fixture (whole-Room, 170.1 / 188.5)
has one of the SMALLER waits (150.8 / 183.0), and the biggest wait (all-curved room-creation-commit
214.0) belongs to a class whose release is 108.2 ms.

R1'S PRICED ROWS ARE NOT A PREDICTOR OF THIS ROW. R1 prices only synchronous release work; this row is
what happens AFTER that work has finished, and it exceeds the release on 14 of 19 classes (Chrome) and
15 of 19 (Electron) — and where it does NOT, it is the straight fixture's light classes (23.0–30.6 ms
waits over 32.6–83.9 ms releases), which is the direction a reader expects.

THE PROXY PROVABLY DOES NOT BOUND IT. `browser-frame` — [synchronous release end, next rAF callback] —
reads 18.4–34.5 ms on the all-curved classes whose presented wait is 150.8–214.0 ms. On the straight
fixture the proxy (12.3–16.7) is the same order as the wait (23.0–56.0), and on the curved fixture it is
5–8× smaller. The old reading stands, reproduced on the corrected session: the proxy is not a bound on
presented-frame latency.

THE PAGE'S OWN POST-RELEASE WORK IS SMALL NEXT TO IT. In the all-curved whole-Room class every
post-release page-side row is small against a 150.8 / 183.0 ms wait: `plan-render-model` 8.5 / 9.7 ms
per occurrence, `plan-salience` 0.5, `plan-presentation` 0.0 self, `plan-svg-context-ink` 0.0 self. In
the two tap classes the Plan marks are ≤ 2.2 ms p50.

WHAT THE TRACE RETAINS, AND WHAT IT DOES NOT. Same window, both legs — presented frames against event
COUNTS: Chrome 4,419 against 8,144 `Paint`, 4,424 `PrePaint`, 4,420 `Layerize`, 8,840
`AnimationFrame::Render` / `::StyleAndLayout`, 5,704 `::Script::Execute`, 3,984 `UpdateLayoutTree`,
2,418 `Layout`, 540 `HitTest`; Electron 4,405 against 7,415 / 4,410 / 4,406 / 8,812 / 5,664 / 3,994 /
2,428 / 546. So a presented frame carries ~1.7–1.8 Paint and one PrePaint/Layerize — the
wait sits in the render/paint stage — but M1's runner retains COUNTED event names, not their durations,
so the stage is not PRICED here. Pricing it is a measurement expansion (compositor-grade event
durations) and the mechanism stays with its owner (P26 P6/P1, decisions-doc D6).
```

## 4. What this pass supports, what it does not, and the scope expansion required

```text
4.1 SUPPORTED BY THE EVIDENCE (routes, not decisions; each keeps its existing owner):
    (i)   D4 — the whole-Room move pays a full-generation mesh COMPARISON on every preview frame:
          6 occurrences per accepted action at 61.8 / 70.5 ms self, against ONE occurrence at
          12.7 ms for a single-wall drag on the same fixture and session. The class's frames are
          uniformly long (4 in 5 ≥ 50 ms, both runtimes, straight AND curved). Measured later (live
          attribution §3): 36 of 40 Walls are REUSED inside each of those preparations and 4 are
          rebuilt with a stated reason, so the price is the per-Wall value comparison of the whole
          generation, ~80 % of each preparation. Owner: P26 §3.5.
    (ii)  D5 — the drag's largest priceable term is the wall-snap index, 173.2 / 231.3 ms self on the
          all-curved fixture against 13.3 / 13.8 ms on the straight control, ONE occurrence per
          accepted action, and PROVABLY outside the synchronous release (§3.2). Owner: the P23B.7
          family.
    (iii) D6 — the post-release presented wait is a 100 %-covered row of 150.8–214.0 / 183.0–195.2 ms
          on the curved fixture that is a property of the FIXTURE, is not explained by the release, is
          not bounded by the proxy, and is not explained by any retained page-side row. Owner: P26
          P6/P1; needs compositor-grade pricing before anyone attributes it.
    (iv)  METHOD — the corrected gesture population rule and the session-control discipline (§2.4, §2.5)
          are what make the above readable. They are committed to the harness, not to prose.

4.2 NOT SUPPORTED:
    · NO Worker / WASM case is made by this evidence. The largest priceable single term here is a
      per-geometry derivation (0.17–0.23 s) whose cost is NOT the shape of its arithmetic: the exact
      O(k log k) replacement was implemented, proven output-identical and measured up to 2.2× SLOWER
      at this input's real k, while the same merge over the same values as plain objects is 12.1×
      faster (live-attribution §2). The D4 cost is a full-generation COMPARISON per preview frame —
      repeated work whose cheapest fix is to compare less (a reuse/ruling question), not to compare
      elsewhere. P23B.8's compute-bound prerequisite therefore remains UNPROVEN — the entry gate's own
      condition.
    · NO performance delta is claimed by this pass. NO product module, cache, Worker or WASM path was
      added, and no baseline or ratchet was read or written. The only measured differences between the
      capture pairs are (a) the corrected gesture population and (b) the session itself, separated in
      §2.4.

4.3 SCOPE EXPANSION REQUIRED (reported, NOT taken). The follow-up's authorization is "only DEV-only
    instrumentation; if a product module must be touched, STOP and report", and the owner additionally
    forbade new cache / Worker / WASM paths. The smallest evidence-backed optimizations are therefore
    NOT in scope; this pass stops at the evidence. Asked for, in evidence order:
    (a) packages/layout-core/src/layout-snap.ts — the wall-snap extent merge
        (`dedupeWallSpans` / `mergeWallGroup` / `farthestEndpointPair` / `withinChordTolerance`).
        Evidence: §3.2 (173.2 / 231.3 ms self per derivation, 13× the straight control on the SAME
        40-wall fixture, one occurrence per accepted action, provably pointer-time). Blast radius: snap
        candidate semantics — correctness-authority adjacent; the parity and snap suites
        (`layout-snap-extent-parity.test.ts`, `layout-snap.test.ts`) are the guard rails, and curved
        extent semantics must not change.
        TAKEN in this pass and REVERSED: the exact sweep was implemented and measured out (§2 of the
        live-attribution record). The remaining change inside this module is a DEV probe; the fix the
        evidence supports is about the IDENTITY the snap path is handed, which is not this module's.
    (b) the whole-Room preview path's mesh preparation (owner to name the module: the preview install /
        prepared-mesh state, not a new cache). Evidence: §3.1 (61.8 / 70.5 ms self, 6 occurrences per
        accepted action, ~4 in 5 frames ≥ 50 ms). NOTE THE SHAPE, because it decides the authorization:
        the per-Wall REUSE already happens (36 of 40 reused, measured), so the candidate is not a cache
        and not transform-aware reuse — it is the per-Wall value comparison of the entire generation,
        run per preview frame, whose owner decides how much of it is necessary. Under the P23B.5
        ratchet, i.e. a ruling; the ratchet must not be touched by whoever takes it.
    Both are product changes with correctness surfaces; neither is authorized by the follow-up plan, and
    this record implements neither.
    A DIRECTION for all three targets (including D6's, which is a measurement before it is a fix) is
    proposed in ./2026-09-27-optimization-directions-proposal.md: for each one, the first move, whether
    that move is already authorized, and what single measurement makes it decidable. Read that beside
    this section — it is the ordered version of what is written here.
```

## 5. Remaining uncertainty

```text
· SESSION CONDITIONING (§2.4/§2.5). M1's absolutes move up to ×2.6 between sessions with no code
  change. The corrected pair is published as a pair; every cross-session comparison in this record is
  made through the release CONTROL, never as a delta. A future before/after must be same-session.
· THE SAME-SESSION RE-READ IS AN APPROXIMATION. It drops a trailing window rather than identifying the
  excluded drags, so it isolates them where the excluded frames are contiguous (Electron all-curved
  rigid 16.8) and not where they are interleaved (Chrome all-curved rigid reads 95.9, while the
  corrected session and the Electron row both read 16.8–17.8). The conclusion does not rest on it: the
  corrected pair agrees, and the fix's own effect is reproduced in the harness (`excludedDrags` 5 of 25,
  9 of 29 on connected Chrome).
· THE GESTURE ROW IS STILL A PROXY. An rAF callback interval is not presented-frame latency and not GPU
  work; only the release-side row may be called presented-frame latency, and only with its coverage.
· NESTING IS NOT RETAINED, so phase membership is a reading of the labels and their callers. ONE
  placement was promoted from inference to arithmetic in this pass (§3.2); the rest remains a reading,
  and a capture that retains the containment tree would settle them.
· THE PHASE MAP IS A READING, NOT A MEASUREMENT. `unclassified` is a real bucket in every class and is
  reported with its rows, never as a zero.
· THE TWO POPULATIONS STILL DIFFER BY SOURCE. M1's `wall-authoring` rows are over 23 measured accepted
  actions and S7's over 20; both are stated, neither is converted into the other, and no row is compared
  by count across the two sources.
· THE PRESENTED ROW IS UNPRICED BEYOND ITSELF: its composition is counted, not timed, and it is measured
  on a headless/offscreen surface on both runtimes.
· P23B.6's S1b increases remain UNRESOLVED. Neither the corrections nor the attribution explains them;
  the corrected re-run reproduces the same shape (D1 rows as comparison only).
· P23B.8's ENTRY PREREQUISITE IS UNPROVEN — the honest state to hand it (§4.2).
· ONE MACHINE, ONE DEV SESSION PER LEG, ADVISORY. No statistical claim and no numeric target. Both
  corrected captures carry `treeDirty: true` because the corrections were uncommitted at capture time
  (they land with this record).
```

## 6. The queued items, resolved or routed (the before-P23B.8 condition)

```text
Per the decisions record: "every queued item must be ratified, or explicitly routed to P23B.8 / P26,
before P23B.8 entry — nothing reaches P23B.8 undecided." This pass does not re-decide any of them; it
reports what it did to each one's evidence.

P1   randomized differential (M-3 key assumption)   FOLD, test/DEV-side only        · untouched here
D4   whole-Room per-move compile + full install     FOLD, measurement only,
                                                    mechanism stays P26 §3.5        · MEASUREMENT SUPPLIED
     → its recorded gap was "unmeasured for the move path"; §3.1 measures it, in the class's own rows,
       with occurrence counts and exclusive self. Route unchanged: P26 §3.5 keeps the mechanism.
D5   topology/snap/hit-test + pointer-move work     FOLD, measurement only,
                                                    mechanism stays P23B.7 family   · MEASUREMENT SUPPLIED
     → §3.2 supplies the pointer-time derivation's cost AND promotes its placement from inference to
       arithmetic. Route unchanged: P23B.7 family.
D6   3D adapter/GPU/presented-frame + Plan template FOLD, measurement only,
                                                    mechanism stays P26 P6/P1       · PARTIALLY SUPPLIED
     → §3.3 supplies the presented row, its coverage, its proxy comparison and the trace census to the
       limit a CDP capture supports. The compositor stage remains unpriced, and that pricing is the
       expansion the item already needed.
D7   no post-fix browser `commit-capture` number    FOLD → M1                        · SATISFIED (slice close)
     → 0.5–1.8 ms p50 in the three drag classes on both runtimes; ABSENT WITH A REASON in
       `wall-authoring` and `room-creation-commit` (those classes never reach a commit); no delta
       claimed against the pre-fix 107–149 ms.
D8   bounded heap-retention comparison               FOLD, comparison only, no redesign     · untouched
D9   retire dormant P23B.6 S6 identity mapping       FOLD, small cleanup                    · untouched
D10  P23B.5 release-scope M-3 · sample owners ·
     correspondence memoization                      FOLD (ruling only, no mechanism)       · untouched
D11  P23B.4 M-2b + declined R-tree/index work        WITHDRAW                               · untouched
D12  P23B.11 blocked M-2 (extent scope)              blocked; unblock condition unmet      · untouched
D13  accepted partial baseline coverage limit        NOTED beside M1, never folded in      · untouched
     → §2 records it beside the session again; M1 does not extend, re-capture or rewrite the baseline.

ENTRY GATE: nothing here changes a route. What changes is that D4/D5/D6 are no longer "unmeasured", and
that P23B.8's compute-bound prerequisite is still UNPROVEN — so its decision, if taken now, is taken
against evidence that does not support it.
```

## Live evidence

```text
./2026-09-27-M1-chrome-leg.json       CORRECTED Chrome leg (attribution + populations sections)
./2026-09-27-M1-electron-leg.json     CORRECTED Electron leg, same schema and protocol id
                                      (both legs: working tree only, NOT committed — gitignored)
./2026-09-27-M1-S4-m1-session-record.md          the session record (§3 marked superseded, sentence corrected)
./2026-09-27-R1-release-cost-ranking-record.md   the ranking record (§4 corrected, §6 records it)
./2026-09-27-pre-P23B.8-follow-up-acceptance-record.md   the slice's acceptance record + this pass
docs/roadmap/p23b-geometry-performance/2026-09-27-pre-P23B.8-follow-up-decisions.md  §6's source rows
apps/editor/src/lib/bench/p23b-m1-attribution.ts        the phase map and the partition (pure, tested)
apps/editor/src/lib/bench/p23b-m1-frame-timing.ts       the corrected gesture population rule
apps/editor/src/lib/bench/p23b-m1-record.ts             the corrected population decomposition
.freebuff (gitignored): m1-{chrome,electron}-leg-precorrection.json — the FIRST capture pair, kept
                        beside the runner logs for §2.4/§2.5; post-fix-full-test*.log — the gate logs
```
