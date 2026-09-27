# Pre-P23B.8 follow-up M1 S4 — the session record: gesture frames · presented frame · long-frame incidence · D7 · D13

```text
AUTHORITY: NONE — the M1 session record (§6 S4): "the §4.2 drag-attached series and the §4.3 row
with its signal label and coverage, on both runtimes; D7's post-fix `commit-capture` number; D13's
coverage limit noted beside M1's session row". Both captures beside this file are LIVE and are the
machine-readable source (§7); S2 and S3 record the two legs and their conditions. Nothing here is a
threshold, a budget, a baseline, a ratchet or a claim about a mechanism.
```

## 1. The rows, by signal — what may be called what

```text
The plan's §4.3 separates two release-side signals, and §4.2's series is a third thing again. This
table is the label the record puts on each row, so a reader can never mistake one for another.
```

| row | signal | definition, as recorded | labelled |
| --- | --- | --- | --- |
| release → next presented frame | `presented-frame` | the next presented frame strictly after the synchronous release ended, on a calibrated CDP presentation clock (`AnimationFrame::Presentation` from the page's own renderer), never an rAF callback | **presentation-grade latency** |
| release → next rAF callback | `proxy` | the existing `browser-frame` boundary = [synchronous release end, next requestAnimationFrame callback]; it encloses that input's flush and is not presented-frame latency | **PROXY — labelled, coverage reported** |
| frames during a drag | gesture series | rAF callback interval during a real Plan drag (pointerdown → the action resolving), correlated with the product's own `p2311:pointermove-rigid` / `p2311:pointermove-bend` marks | **PROXY — never presented-frame latency, never paint or GPU time** |
| long frames | incidence | `long-animation-frame` entries (frames at or over 50 ms only); `startTime`/`duration`/`renderStart`/`styleAndLayoutStart` are not presentation times | **INCIDENCE — never a latency row** |

```text
EVERY ROW BELOW CARRIES ITS COVERAGE, and the two M1 additions carry the clock's own uncertainty:
the page emits `console.timeStamp(...)` and reads `performance.now()` in one synchronous block, the
trace's `TimeStamp` event identifies the renderer process id and the offset between the two clocks,
and the pair is taken before and after the run. Residual: CHROME 0.125 ms · ELECTRON 0.293 ms.
Nothing was reported as a presented frame on a guessed clock.
```

## 2. The presented-frame row (item (b1)) — and the proxy beside it

`release → next presented frame`, p50 ms, with the class's own `browser-frame` PROXY p50 for the same
release spans. COVERAGE IS 100% ON EVERY ROW ON BOTH RUNTIMES: 20 of 20 releases (23 of 23 for the
two authoring classes), zero unmeasured, on all 19 classes of both legs.

| class | fixture | Chrome presented | Chrome proxy | Electron presented | Electron proxy |
| --- | --- | --- | --- | --- | --- |
| `rigid-wall-drag` | `p23b-40-wall-straight-v1` | 36.6 | 10.1 | 31.5 | 11.0 |
| `whole-room-move-bridge` | `p23b-40-wall-straight-v1` | 42.9 | 13.2 | 62.4 | 14.0 |
| `wall-authoring` | `p23b-40-wall-straight-v1` | 44.2 | 15.1 | 66.3 | 16.2 |
| `room-creation-commit` | `p23b-40-wall-straight-v1` | 41.4 | 15.6 | 63.3 | 15.9 |
| `rigid-wall-drag` | `p23b-40-wall-all-curved-v1` | **218.6** | 25.8 | **229.5** | 27.5 |
| `bend` | `p23b-40-wall-all-curved-v1` | **214.5** | 25.6 | **329.3** | 40.3 |
| `whole-room-move-bridge` | `p23b-40-wall-all-curved-v1` | **278.4** | 32.2 | **308.1** | 40.4 |
| `wall-authoring` | `p23b-40-wall-all-curved-v1` | **292.4** | 5.1 | **315.9** | 7.1 |
| `room-creation-commit` | `p23b-40-wall-all-curved-v1` | **291.9** | 128.0 | **349.8** | 137.2 |
| `rigid-wall-drag` | `owner-40-curved-v1` | 77.6 | 15.9 | 154.2 | 24.6 |
| `bend` | `owner-40-curved-v1` | 86.9 | 16.6 | 140.4 | 22.1 |
| `whole-room-move-bridge` | `owner-40-curved-v1` | 85.3 | 19.3 | 157.2 | 26.8 |
| `wall-authoring` | `owner-40-curved-v1` | 96.4 | 0.2 | 183.3 | 5.7 |
| `room-creation-commit` | `owner-40-curved-v1` | 84.7 | 29.4 | 171.7 | 56.8 |

```text
WHAT THIS ROW IS, AND IS NOT. It is the wait from the end of the synchronous release to the next
frame the compositor reports as presented, on the page's own renderer. It is NOT paint time, GPU
time, or a promise about what a display shows, and on a headless/offscreen runtime the presented
surface is offscreen — both captures state that in their limitations rather than hiding it.
Note: the two clocks are sampled at one instant and correlated after the trace closes; a calibration
marker that never arrived would have made the row NOT MEASURED rather than correlated.

THE PROXY DOES NOT BOUND THIS ROW, and that is the second thing this table shows. On the heavy
all-curved fixture the `browser-frame` proxy reads 5.1–128.0 ms p50 while the presented frame reads
214–292 ms p50 (Chrome); on the owner fixture 0.2–29.4 vs 84.7–96.4 ms. A reader who had only the
proxy — as every capture before this session did — would have been told a number an order of
magnitude smaller than the wait the compositor reports. The proxy is still reported, labelled, and
never presented as latency.
```

## 3. The gesture-frame series (item (a)) — attached to real drags

rAF callback interval during a real drag, p50 / p95 ms, per drag class per fixture. All three drag
classes run as real pointer gestures (down · moves · up); the two authoring classes are taps and are
NOT the workload for this row (§4.2).

| class | fixture | Chrome p50 / p95 | frames | Electron p50 / p95 | frames |
| --- | --- | --- | --- | --- | --- |
| `rigid-wall-drag` | `p23b-40-wall-straight-v1` | 16.7 / 98.2 | 150 | 16.7 / 78.4 | 150 |
| `whole-room-move-bridge` | `p23b-40-wall-straight-v1` | 179.8 / 358.3 | 151 | 156.0 / 239.7 | 150 |
| `rigid-wall-drag` | `p23b-40-wall-all-curved-v1` | 95.9 / 355.2 | 152 | 98.4 / 356.9 | 157 |
| `bend` | `p23b-40-wall-all-curved-v1` | 103.0 / 348.5 | 151 | 122.8 / 513.8 | 170 |
| `whole-room-move-bridge` | `p23b-40-wall-all-curved-v1` | 367.9 / 695.1 | 150 | 469.5 / 865.2 | 150 |
| `rigid-wall-drag` | `owner-40-curved-v1` | 19.2 / 181.3 | 150 | 28.5 / 318.6 | 152 |
| `bend` | `owner-40-curved-v1` | 18.6 / 188.1 | 150 | 17.7 / 217.9 | 150 |
| `whole-room-move-bridge` | `owner-40-curved-v1` | 222.8 / 367.2 | 151 | 323.2 / 576.0 | 152 |

```text
COVERAGE, STATED RATHER THAN IMPLIED — drags / frames / product pointermove marks / frames that fell
inside a pointermove mark's own window, CHROME then ELECTRON:

  rigid-wall-drag          straight  25/150/100/16   ·  25/150/100/15
  whole-room-move-bridge   straight  25/151/0/0     ·  25/150/0/0
  rigid-wall-drag          all-curved 25/152/100/13 ·  26/157/104/23
  bend                     all-curved 25/151/100/17 ·  25/170/100/1
  whole-room-move-bridge   all-curved 25/150/0/0    ·  25/150/0/0
  rigid-wall-drag          owner     25/150/100/19  ·  25/152/100/0
  bend                     owner     25/150/100/6   ·  25/150/100/4
  whole-room-move-bridge   owner     25/151/0/0     ·  25/152/0/0

Only the frames that fall inside a `p2311:pointermove-rigid` / `pointermove-bend` window were produced
while the product's own preview work was on the stack; the rest of the series is the drag's frames
with no such mark inside them. The whole-Room class carries ZERO pointermove marks on both runtimes
(the product marks the rigid and bend previews; a whole-Room move rides the same `plan-drag-edit`
path but emits neither), so its series is reported with that coverage and no share is implied.
A frame count over 150 is not a longer drag: the class retried an action that did not land on its
intended path, and retries are recorded, never averaged in.
```

## 4. Long-frame incidence (item (b2)) — never the latency row

```text
SUPPORTED ON BOTH RUNTIMES (`PerformanceObserver.supportedEntryTypes` reports
`long-animation-frame` on Chrome 152 and on Electron 35). Frames at or over 50 ms, per class, with
the entry count and the p50 of the entry durations:

  committed fixtures total   CHROME 1,356 long frames   ·   ELECTRON 1,519 long frames
  per class / per fixture     see the S3 pair table (identical numbers, same source)

The row is an INCIDENCE row: it says a frame ran long and how long it ran, not when the compositor
presented anything. It is kept because it speaks to the owner-noticed lag — on the heavy curved
fixture, every whole-Room drag and wall-authoring class reports 76–182 long frames on both runtimes.
It is never presented-frame latency and never summed with the presented row above.
```

## 5. D7 — the post-fix `commit-capture` number

`p2311:commit-capture`, the product mark in the commit path, per class per fixture. Pre-fix browser
evidence was 107–149 ms (S1/S6, per the decision doc's D7 entry); no post-fix browser number existed
before this session.

| class | fixture | Chrome n / p50 ms | Electron n / p50 ms |
| --- | --- | --- | --- |
| `rigid-wall-drag` | `p23b-40-wall-straight-v1` | 20 / 0.90 | 20 / 0.80 |
| `whole-room-move-bridge` | `p23b-40-wall-straight-v1` | 20 / 1.10 | 20 / 0.90 |
| `rigid-wall-drag` | `p23b-40-wall-all-curved-v1` | 20 / 1.90 | 20 / 1.90 |
| `bend` | `p23b-40-wall-all-curved-v1` | 20 / 1.90 | 20 / 2.90 |
| `whole-room-move-bridge` | `p23b-40-wall-all-curved-v1` | 20 / 2.40 | 20 / 2.80 |
| `rigid-wall-drag` | `owner-40-curved-v1` | 20 / 2.00 | 20 / 3.10 |
| `bend` | `owner-40-curved-v1` | 20 / 2.10 | 20 / 2.90 |
| `whole-room-move-bridge` | `owner-40-curved-v1` | 20 / 2.20 | 20 / 3.00 |

```text
THE MARK IS ABSENT FROM THE TWO AUTHORING CLASSES ON BOTH RUNTIMES — `wall-authoring` and
`room-creation-commit` never reach `commit-capture`, on either leg, on any fixture. That is not a
missing measurement: the class is reported with a reason instead of a zero, and the same absence
appears in the closed P23B.11 S7 capture for the same two classes. The number D7 asked for is
therefore reported from the classes that carry the mark (the three drag classes), on both runtimes,
and NOT from the authoring classes P23B.6's S1b numbers came from. Comparing 0.8–3.1 ms here against
107–149 ms there would compare two different commit paths, so this record does not do it: the
post-fix `commit-capture` number is REPORTED, and no delta is claimed.
```

## 6. D13, noted beside this session's row

```text
D13 — the accepted partial baseline (P23B.0-durable disposition A) covers synchronous press/move-phase
boundaries only: it has NO post-release flush/frame coverage and no end-to-end settlement claim.
M1 does NOT extend, re-capture or rewrite it. This session is NEW advisory evidence standing beside
the baseline, not a revision of it; `apps/editor/src/lib/bench/baselines/g3-baseline.json` and the
P23B.5 reuse ratchet were neither read nor written by anything in this slice (§7 NEVER TOUCHED).
```

## 7. What this session may say

```text
MAY     · one protocol, one session of work, two runtimes, both captures settled with zero dropped
          boundaries, each with its own provenance and its own JSON
        · the gesture-frame series and release → next presented frame now EXIST on both runtimes,
          each with its signal definition and its coverage, and the proxy row is labelled as one
        · the long-frame incidence row exists on both runtimes and is labelled an incidence
        · D7's post-fix `commit-capture` number is recorded from the classes that carry the mark
        · the connected case ran LAST under the same protocol and is marked advisory, excluded from
          D1's and D7's rows

MAY NOT · explain, attribute or refute P23B.6's final-capture increases (a session that does not
          reproduce them is a finding, not a fix)
        · name a cause for the browser/node gap, or any mechanism
        · propose a threshold, a target, a budget or a budget metric
        · rank a cost — that is R1, produced only after this record (§5.1)
        · carry a statistical claim: one machine, one DEV session, advisory numbers only
```

## Live evidence

```text
./2026-09-27-M1-chrome-leg.json      the Chrome leg (provenance, 19 class rows, D1, D7, presented
                                     rows + proxy, gesture series, long frames)
./2026-09-27-M1-electron-leg.json    the Electron leg, same schema
./2026-09-27-M1-S2-chrome-leg-record.md   the Chrome leg's conditions and the defects it found
./2026-09-27-M1-S3-electron-leg-record.md the Electron leg and the pair tables
```
