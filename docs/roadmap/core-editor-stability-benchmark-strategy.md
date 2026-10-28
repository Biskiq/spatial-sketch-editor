# Core Editor Stability — benchmark strategy

**Status: proposal for review, 2026-10-28. Unratified.**

```text
QUESTION    At the typical project, does editing feel smooth? At the expected
            maximum, does editing stay usable and correct if it lags?
EFFECT      None until an owner adopts this method. No harness change, no
            benchmark run, no budget edit, no acceptance gate.
SUSPENSION  The 2026-10-28 mandate suspension stands. An investigation still
            starts only when the owner has seen a slowdown.
REVIEW      Peer review of PR #213, conditionally approved. Early stop is a
            decision test: four samples when the label is clear, a short
            extension only while it is ambiguous, outliers kept. A second
            session is for an unresolved label or a transient contaminant.
            Smoothness compares frames and handler-to-presentation delay with
            the measured display period.
LEAVES      The performance contract remains the historical method and budget
            record. The harness, workloads and Bench 1 / Bench 2 / milestone
            evidence stay in the tree. Core Editor Stability gains no acceptance
            area from this page.
```

The [performance contract](../reference/components/performance.md) and
[suspension](../reference/decisions/performance-mandate-suspension-2026-10-28.md) still describe the
landed method. This page proposes the sample plan a later owner-initiated investigation would use.
Adopting it is a separate decision. Implementing it is a separate change.

## The question that earns a measurement

Two workloads, from the contract's own scale table:

| Workload | Fixture already in the harness | Scale |
| --- | --- | --- |
| **M — typical** | `grid-M` (grid-7) | about 112 walls, 112 openings, 49 rooms |
| **L — expected maximum** | `grid-L` (grid-14) | about 420 walls, 420 openings, 196 rooms |

M should feel very smooth: pointer motion stays on the display period, and a commit does not hitch.
L may show modest lag. Interaction there has to finish, leave a correct document, and stay in the
range a person can keep using. M and L use separate labels, defined below.

S (`grid-3`) and XL (`grid-20`, and anything at 10,000 rooms or 100,000 entities) answer a different
question — town-scale feasibility — which this strategy leaves to a separate owner request.

## What the recorded passes actually spent

Two owner-run passes fix the cost. Figures are from the
[S06 acceptance record](./t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/acceptance.md)
and the [harness readme](../../apps/editor/perf/README.md).

| Pass | Recorded time | Where the time went |
| --- | --- | --- |
| Bench 1, formal acceptance plan | 3 h 36 min | The within-run sample plan. Setup and about 450 opens were 10–15 min of that. |
| Milestone gate, 2026-10-26 | 43.9 min (2,632.7 s) | E5 851.2 s, L 740.9 s, cool-down 360 s, M 335.0 s, S 267.7 s, transferred rows 64.6 s, setup 13.1 s |

The milestone had already cut setup to 13.1 s. The remaining time is repetitions, orbits, leak
cycles, the sweep, and 360 s of cool-down (180 s before M and 180 s before S).

The formal plan (`acceptance` in `apps/editor/perf/lib/profile.ts`) is still the default when no
profile is set: 1 discarded warm-up + 10 measured runs, every cache state, 60 pointer inputs, 5
drags and 5 typed commits per run, 20 Undo/Redo cycles, 20 edits × 10 cold and 10 repeat-use leak
cycles. The harness readme accounts that leak journey as 460 accepted edits per tier, including
discarded cycles. Arithmetic on the drag quota alone is 10 runs × 3 cache states × 5 drags × 60
inputs = 9,000 pointer moves per tier, which the formal report then pools into a few percentiles.

The milestone plan kept 60 inputs, 2 drags per run, 10 Undo/Redo cycles, the 20×10 leak cycles, and
the 600-frame orbit. Its profile still schedules 600 drag inputs per tier (three warm runs, one
cold check, one repeat-use check, two drags, 60 inputs). The published decision used the three warm
p95s. F7 at S and M was extended from 3 runs to 5 because a frame sitting on the 16.7 ms refresh
interval can never clear a "25 % under budget" rule. Those two tiers are 100 s of orbit reporting
16.7 ms. The plan also schedules L's warm orbit at three further runs. Each orbit run also scripts
an all-visible 3D pan and a Plan pan.

`PERF_EARLY_STOP` skips leftover runs only after three runs have already missed a hard budget by
25 %. A pass that is fine still collects the full quota. The common case is the expensive case.

### Variance that the extra samples did not buy

Within one regime, independent runs clustered. From the acceptance record's Bench 1 comparability
row (10 runs per cache state):

| Row | Bench 1 band | Milestone, slowest of 3 run p95s |
| --- | --- | --- |
| F3 input→preview, L | 164–166 ms (p95 216–233) | 16.3 ms, and the same 16.3 ms at S and at M |
| F4 commit, M | 139–141 ms | 25.5 ms (S was 17.5 ms) |
| F4 commit, L | 636–670 ms | 93.6 ms |
| F8 Undo/Redo, L | 519–536 ms | 21.6 ms (M was 12.2 ms) |
| F8 Undo/Redo, M | 95–111 ms | 12.2 ms |
| F2 open, L cold | 5,186 ms | 5,064 ms (M cold/warm 565 / 502 ms) |

The wide gaps are regime changes (before the algorithmic work, and after it) and scale steps
(M → L). They are several times larger than the within-regime bands. The widest of those bands is
F8 at M, 95–111 ms. Another ten runs would tighten a percentile. They would not move "about 100 ms"
across a decision.

Two measurements show the sample plan measuring the machinery:

- Frame p95 sat at 16.7 ms at S and at M while a separate pan check cut main-thread time from
  37.05 ms to 18.10 ms per move at L. The 600-frame row could not see a twofold CPU change. Source:
  the [attribution record](./t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/evidence/attribution-2026-10-27/README.md).
- That same record states that pick wall time includes Playwright dispatch. The number mixed harness
  delay into the editor.

The per-move work ledger was the instrument that named a cause. Bench 1's
[characterization](./t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/characterization.md)
put L compile at 118 ms of a 164 ms move. One move's spans carried that split.

## Eliminate

Routine coverage ends at the rows below. The harness files stay. A later investigation simply does
not run them.

| Drop | Recorded cost or quota | Why another run would not change an editing decision |
| --- | --- | --- |
| `grid-S` | Milestone tier 267.7 s | Input latency matched M and L at 16.3 ms. Commit (17.5 ms) and open (about 0.2 s) sit in the same regime as M. The scale step that changes the story is M → L. |
| `grid-XL` | Report-only stress tier; crash-handler watchdog exists because Chrome misbehaved here | Above the expected maximum. Omitted from the milestone on purpose. |
| 1k / 3k / 10k Room census | Node, up to 10 min per point | Census of asymptotic feasibility. Answers a town-scale question. |
| 100,002-entity Room fixture, and the unratified 100,000-entity browser target | Copy-count proof in the S06 acceptance record; the 100k browser target in the [scale proposal](./t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/scale-measurement-proposal.md) was never ratified | A local move there copied hundreds of thousands of slots. That proof is already recorded. It is a stress fixture, not a responsiveness sample. |
| `realistic-L`, `museum`, `sweep-H/D/C` | E5 was 851.2 s of the milestone. Full workload generation is about 25 min. | E5's independence cells differed by 0 pixels, and the museum control changed 3,120, so the check can see a change. Repeating it times a correctness result the test suites own. Draw-call totals on those sweeps (H10/D10 10,526, C10 15,443) are a structural census. |
| 60-input drag quota, 5 in-session drags, cold and repeat-use drag runs | 600 drag inputs per tier in the milestone; 9,000 in the formal plan | The contract itself says pointer events inside one run are one experiment. The decision used three p95s. Those p95s then sat on the refresh interval at every tier. |
| 600-frame / 10 s orbit, extended until the frame floor | S and M alone were 100 s in the milestone, result 16.7 ms | Measures the display period once the main thread returns inside a frame. |
| 10-run quota, discarded warm-up, p95 and p99 | Formal default | With ten samples, p95 and p99 are the maximum. The historical bands above are already visible in a handful of samples. |
| 20 or 10 Undo/Redo cycles | Milestone: 10 per run | After the fix, undo was 12–22 ms at S, M and L, cheaper than the commit beside it. A deep stack repeats that result. |
| F13 leak cycles (20 edits × 10 cold × 10 repeat-use, ~460 edits per tier) | Inside the M and L phase times | Milestone growth was about 2.5 MiB at S, M and L against a 10 MiB line, and geometries, textures, programs, DOM nodes and listeners returned to baseline. |
| Cold, warm and repeat-use on every flow | Three contexts × every row | M cold and warm opens were 565 and 502 ms. The cache gap is small next to L's 5.1 s open. Repeat-use reloads measure HTTP and code-cache hits. |
| 180 s cool-down before M and before S | 360 s recorded | Paid so a multi-minute tier would not heat the next one. A few seconds of interaction does not create that debt. |
| N1 / N2 network throttle on local editor work | 40 ms RTT on N1 | Larger than M's entire post-fix commit (26 ms). It times the throttle on a loopback fixture. |
| CPU-throttle calibration, battery certification, Safari/Firefox matrix | 20-run calibration search | Equivalence machinery. This strategy reports the machine it ran on. |
| Screenshots, trace images, screenshot-clock correlation | Trace diagnostic; F9 lifecycle requires exact screenshot identity | The harness readme states that tracing and the identity overlay perturb the workload. Screenshot latency includes consumer delay. Bench 1 already holds the method proof. |
| A.6 old-method rows, delayed-preview proof, stage traces on every tier | Formal plan runs them on all tiers | Method and attribution proofs already recorded. |
| F1 startup, F5 import, F6 placement, F9 Save, F10 capture/preview, F11/F12 viewer | Milestone transferred rows were 64.6 s, and a full pass runs more | Different questions: shell bytes, import, network receipt, visitor load. Each is its own investigation when that is the slowdown someone saw. |
| Full `npm run perf` | Walks realistic-L, L, XL, M, S, then E5 and the transferred rows | The command remains. The routine investigation does not invoke it. |

Functional specs that live under `apps/editor/perf/flows/` and capture screenshots (integrated
acceptance, import QA, native-form checks) stay correctness evidence. They are outside this timing
strategy.

## Retain

| Keep | What an engineer does with it |
| --- | --- |
| One fresh-context open of `grid-M` and one of `grid-L` | M open is about half a second; L open is about 5.1 s. That gap is a real scale finding. Per-stage admission and compile spans name which stage owns it. |
| A short wall drag at M and at L | Confirms the preview path. The label uses editor time and handler-to-presentation delay, each compared with the display period. Low editor time on its own does not make the gesture smooth. |
| One typed commit at M and at L | The row that scales: 17 ms (S), 26 ms (M), 94 ms (L) at the milestone. |
| A short pointer pan at M and at L | Per-move task time. This is the signal the orbit hid (L: 37 → 18 ms/move in the attribution check). |
| One pick, the commit, and one pick after the commit | The milestone gate had no pick-after-commit row. The attribution check showed the index and fragment set rebuild on the first click after an edit. One click sees the rebuild count. |
| One Undo at L, and at M when the commit is over 50 ms | Catches a restore path that has grown into the commit's cost. The historical post-fix undo was 12 ms at M and 22 ms at L, so M usually skips it. |
| Rest-frame counters, once per workload | Draws, triangles, `render()` CPU, geometries and textures. One frame. The sweep's 10k-draw totals are cited as history beside the new count, and the new count is the grid's own number. |
| Work-ledger spans | Compile, representation, pair visits, canonical bytes, index-build counts. These are the figures that choose a next change. |
| Cached workload JSON, one production preview, one machine line | Commit, browser, power source, load average, display period, workload digest. Regenerate a workload only when its input key is stale. Generate M or L only. |
| Correctness suites | A fast wrong result is still wrong. This strategy does not re-prove pixel identity or compiler equality. |

`grid-M` and `grid-L` are architectural grids with doors and windows. The contract's M/L columns
also list scene objects, GLBs and textures. Those columns live on `realistic-L`, which is blocked
and dropped here. A slowdown caused by imported models needs a fixture that contains them. This
workflow will report a fast grid while models are the actual cost. That limit is stated again below.

## Two clocks

Every retained window records three clocks and keeps them in separate columns.

| Clock | Starts | Ends | Enters the feel label |
| --- | --- | --- | --- |
| **Editor** | Product handler mark, or the admission mark on open | Product completion mark (preview installed, revision accepted, or first architectural frame). Main-thread task time over that same window is the label input when CDP provides it. The product spans are the breakdown. | Yes |
| **Presented** | Handler mark | The rendering-opportunity frame (the existing rAF proxy) | Yes. Compared with the measured display period, together with the frame intervals. |
| **Automation** | Harness dispatch, context creation, navigation, settle waits, pointer-injection gap above the intended pace | The handler mark, plus those setup waits summed for the session | No |

When task time and the product span disagree by more than the margin of the relevant threshold,
the report shows both and the label uses the larger editor figure. Automation stays in its own
column.

Historical pick and commit wall times include Playwright dispatch. A new editor figure will read
lower than those wall times by the dispatch gap. Compare a regression against the milestone on
ledger counts and on task time inside the handler window, and say so in the report.

Settle stays once between actions (the harness's existing half-second Stage check). It is automation
time. It is not a sample.

Loopback is unthrottled. Admission spans are what to set beside the historical N1 opens, because
the 40 ms RTT is absent from the new open wall.

## Feel labels

These words are how the report talks about a result. They are proposed figures for this review.
They are not budgets, they do not edit the performance contract, and a miss is a finding for the
owner who asked for the investigation.

`R` is the display refresh period from the machine line (`1000 / Hz`). A 60 Hz panel has
`R = 16.7 ms`. The page's own intervals are compared with that `R`.

| Label | Applies | Holds when |
| --- | --- | --- |
| **Smooth** | M interaction | All of: max per-move editor time ≤ 8 ms; max handler-to-presentation delay ≤ `R + 2 ms`; every frame interval within 1 ms of `R`; commit editor time ≤ 50 ms and commit presented delay ≤ `min(50 ms, editor + R + 2 ms)`. Historical milestone on a 60 Hz-class panel: eval 1.3 ms, input→preview 16.3 ms, frames 16.7–16.8 ms, commit 25.5 ms. |
| **Usable, modest lag** | L interaction | All of: max per-move editor time ≤ 33 ms; max handler-to-presentation delay ≤ `2R + 2 ms`; every frame interval ≤ `2R + 1 ms` (on `R`, or a stable half-rate at `2R`); commit editor time ≤ 200 ms and commit presented delay ≤ `min(200 ms, editor + 2R + 2 ms)`; at most one input in four superseded. Historical: pan CPU 18.1 ms/move, commit 93.6 ms, undo 21.6 ms. |
| **Not smooth** | M missed the smooth line and still met the usable line | The typical project lags. Editor time under 8 ms does not repair a late presentation or a half-rate frame. |
| **Not usable** | Whichever workload missed the usable line | A move above 33 ms, a presentation later than `2R + 2 ms`, a frame interval above `2R + 1 ms`, a commit above 200 ms, or a gesture that supersedes more than one input in four. |
| **Open** | Reported in seconds, M and L | No feel line. Historical fresh opens: M about 0.5–0.6 s, L about 5.1 s. The stage spans say whether the seconds are compile, admission or DOM. |

8 ms is half of a 60 Hz frame: the main thread has returned in time for the next refresh. It is one
clause of smooth, beside presentation delay and the frame period. A series of intervals that agree
with each other to 1 ms is a stable rate. It is the display rate only when that rate is `R`. The
same 1 ms cluster at `2R` is a stable 30 Hz picture on a 60 Hz panel: not smooth at M, and the
modest lag L is allowed to show. On a display whose own `R` is 33.3 ms, intervals at 33.3 ms are on
that display's refresh and can be smooth.

50 ms sits between the post-fix M commit (26 ms) and the historical M budget (100 ms). The presented
clause asks the commit to reach the rAF proxy within one refresh after the editor work, and inside
50 ms. 33 ms and 200 ms remain the L editor lines: about two 60 Hz frames of main-thread work, and
a short hitch. The post-fix L numbers (18 ms per move, 94 ms commit) already sit in that band.
Presentation at L may take two refreshes. Presentation at M stays inside one.

Smooth at M and usable at L are independent. A smooth M with a not-usable L is a scale finding. A
rough M is a finding at the typical project even when L scrapes through.

## Workflows

Shared preamble, once: production preview already up, unthrottled loopback, 1920×1080 CSS at DPR 1
(so a human can set the numbers beside the historical rows), one machine line, load average recorded.
The existing contamination threshold (load average above 4, or a concurrent test run) means the
investigation waits until the machine is quiet. There is no cool-down sleep, no screenshot, no
trace, no throttle search.

M runs first. L runs only after M's report line is written. If L is usable and stable, the
investigation ends. A larger fixture is a new owner request, with its own reason.

### M — typical, one session

1. Open `grid-M` in a fresh context. Record automation (context, navigation) and editor (admission
   spans through the first architectural frame) separately.
2. One short straight drag, paced at one move per frame. Stop by the rule below.
3. One pick on an existing wall. Record editor time and whether an index build ran.
4. One typed length commit. Record editor time through the accepted revision, and the presented
   proxy beside it.
5. One pick after that commit. The number that matters is the index-build and fragment count.
6. One short pan. Stop by the rule below. Frame intervals stop by the frame rule.
7. Read rest-frame counters once.
8. One Undo only when the commit exceeded 50 ms.

### L — expected maximum, one session

The same eight steps on `grid-L`, with two differences. Step 8 always runs, because restore cost is
part of staying usable at the heavy project. The label is the usable line: a move of about 18 ms
and a commit of about 90 ms read as usable with modest lag.

The session uses that one open. Its stage spans separate first-load DOM work from compile.

### Follow-up, only after a not-usable or not-smooth label

When the label misses and the ledger already names the stage (compile, membership, canonical bytes,
render CPU, index build), the investigation stops. The next engineering change is that stage.

When the label misses and the ledger is silent, one traced window on that workload and that gesture
is the follow-up. One window. No screenshot gallery, no second tier, no quota of frames beyond the
early-stop cap.

## Early stop

A further sample exists to resolve a label. When the label is clear, collection stops. The report
lists min, median and max. Those three numbers describe the series. They do not decide whether to
continue: a whole-series range never shrinks as samples arrive, so it cannot be the stop test, and
a spread between 10% and 25% of the median is not a third verdict.

Every sample is kept. An outlier is the preserved max (or the long frame). It is listed, and a
single sample clearly past a threshold decides the worse label at the fourth sample.

The margin around a threshold `B` is `m = max(1 ms, 10% of B)`. Move and commit lines: 1 ms at 8,
3.3 ms at 33, 5 ms at 50, 20 ms at 200. Presentation lines use the same margin around `R + 2 ms`
(M) and `2R + 2 ms` (L).

**Repeated editor series** (drag moves, pan moves, handler-to-presentation delays). Take 4 samples,
then classify on the preserved max:

- `max ≤ B − m`: clearly under. Stop.
- `max ≥ B + m`: clearly over. The samples that stayed under are context. The max is kept and
  decides the worse label. Stop.
- Otherwise the max sits on the line and nothing is clearly over. Take one more sample and classify
  again. Stop when the max leaves the margin. The cap is 8. Still in the margin at 8: record
  `on the line`, keep every sample, and apply the worse label. Smoothness or usability was not shown.

Every series ends in one of those three states. The middle band has a verdict.

Four fast samples with a wide relative spread are a clear pass. Moves at 2, 3, 2 and 4 ms have a
range that is half the median and a max well under 7 ms, so M stops at four and is smooth on the
editor clause. Moves at 2, 2, 2 and 40 ms keep the 40 ms sample, label M not smooth, and do not
continue in the hope the outlier will be diluted. Moves at 7.2, 7.4, 7.6 and 7.8 ms are on the
8 ms line, so the series extends, and if it is still there at 8 the label is not smooth,
`on the line`.

**Frames.** `R` is known before the gesture. Take 8 intervals, one short beat of the display
(about 130 ms at 60 Hz).

- Every interval within 1 ms of `R`: `on refresh`. Clear.
- Any interval above `2R + 1 ms`: a stall. That interval is kept. Clear. M is not smooth and L
  is not usable.
- Every remaining interval within 1 ms of `R` or of `2R`, with at least one at `2R`: `half-rate`.
  The long interval is kept. Clear. M is not smooth. L reads it as modest lag.
- Any interval more than 1 ms away from both `R` and `2R`: ambiguous. Take one more, up to 16,
  then stop. A stall or a `2R` interval that appears is kept and classifies as above. At 16, a
  series that never landed on `R` leaves M not smooth. L treats it as modest lag when no interval
  exceeded `2R + 1 ms`.

A 1 ms cluster at 33.3 ms with `R = 16.7 ms` is `half-rate` at the eighth interval. Collection
stops. The same cluster with `R = 33.3 ms` is `on refresh`.

**Superseded inputs.** If more than one of the first four inputs is superseded, the editor is
falling behind the pointer. Apply `not usable` and stop. The fraction is the whole test. The series
does not continue until sixty inputs have a presented row.

**One-shot actions** (commit, undo, each pick). One sample, classified the same way:
`≤ B − m` is clearly under, `≥ B + m` is clearly over, and the open interval between them is
`on the line`. The project open is one sample too, reported in seconds, and it has no feel line
to sit on.

**Another session.** The next session is spent only when its result could change the label.

- A one-shot sample, or a repeated series that ended `on the line`, is unresolved. One more session
  can fall clearly on one side.
- A transient contaminant can. If the ledger names a non-editor long task inside the window (a GC,
  or a load-average spike) and removing that time would move the preserved max across the threshold
  or into the margin, repeat the session once. The contaminated sample stays in the report.

Harness time larger than editor time does not open a session. On millisecond-scale editor work that
inequality is the usual case, and another Playwright run repeats it. The two durations stay in
their columns. When the handler mark is missing, the only number mixes dispatch into the editor
span: the row is `unsplit`. A clearly-under unsplit number still supports the good label, because
the editor portion is smaller than that number. An unsplit number on the line or over it supports
no feel label, and a second session is not spent on the same missing split.

A third session happens only when the two sessions disagree on the label. The cap is 3. Every
outlier from every session stays in the report. There is no discarded warm-up and no path to 10 runs.

The historical magnitudes are clear at four samples and one session. M's 1.3 ms eval and 26 ms
commit sit outside the margins of 8 and 50. L's 18 ms move and 94 ms commit sit outside the margins
of 33 and 200. A second session is the line-sitting case.

## Expected time

From the milestone's recorded breakdown, this strategy never starts:

| Recorded slice | Seconds | Minutes |
| --- | ---: | ---: |
| S | 267.7 | 4.5 |
| E5 | 851.2 | 14.2 |
| Cool-down | 360 | 6.0 |
| Transferred rows | 64.6 | 1.1 |
| **Sum** | **1,543.5** | **25.7** |

That leaves the recorded M phase (335 s), L phase (741 s) and setup (13 s): **18.2 min**. Those
phases still contain the 600-input drags, undo cycles, orbits and leak edits this strategy drops.

What remains, at the historical per-operation costs: one L open at about 5 s, one M open under a
second, a commit under 100 ms, and a handful of moves at tens of milliseconds. The clear path stops
at 4 editor samples and 8 frame intervals. The ambiguous path adds at most 4 editor samples and 8
intervals, still well under a second of input, then at most two further sessions of the same
shape. Browser launch, one navigation and the single settle between actions dominate. The expected
investigation, one clear session per workload, is **1–2 minutes per workload, 3–5 minutes for M and
L together**, after the preview is up. Three sessions on both workloads is the capped ambiguous
path and lands near 10 minutes, because each session is one open and a short gesture.

| Comparison | Saving |
| --- | --- |
| Versus the milestone's 43.9 min | About 40 minutes, roughly nine-tenths of that pass. 25.7 of those minutes are the recorded slices the new plan never starts. The rest is the estimate for shrinking the 18.2 min of M/L sampling. |
| Versus Bench 1's 3 h 36 min | About three and a half hours. Setup was the smaller part of that pass. |
| Versus generating every workload | About 25 minutes, the harness readme's figure for a full cold generation. |
| Versus the 1k/3k/10k census | Up to 10 minutes per point, three points. |

The 3–5 minute figure is an estimate from those per-operation costs. It is not a new measured pass.
A cold production build sits outside the milestone's 13.1 s setup line and outside this estimate;
both workflows pay it once, and it is not the waste removed here.

## Limitations

- The suspension is unchanged. This page authorizes no run. Unmeasured rows stay unmeasured.
- `grid-M` and `grid-L` carry no GLB payload, no texture set and no catalogue placement. Imported-model cost is invisible here. The historical sweep draw counts (about 10k–15k) were measured on other fixtures and will not reappear as the grid-L rest count.
- One machine, the browser that actually ran, the power source that was plugged in. No battery claim, no reference-laptop-A claim, no Safari or Firefox claim.
- Four samples, or eight when the four sit on a label line, have no p95 or p99 reading. A hitch rarer than one sample in four can pass a clear series. A hitch that does land in the four is kept and decides the worse label. The 600-frame runs reported a floor rather than a tail, so the capability being given up is one the old plan claimed and, on these rows, did not deliver.
- The presented column is the rAF proxy, compared with the display period. It accounts for handler-to-presentation delay and for a stable half-rate. It is still not scanout. Exact scanout remains the existing trace diagnostic, used only as the follow-up above.
- New editor spans exclude harness dispatch, so they are not drop-in replacements for historical wall times.
- New opens exclude N1's 40 ms RTT. Compare admission spans to the historical N1 opens.
- Nothing here measures leaks, Save receipts, viewer load, or startup bytes. A slowdown in one of those is a separate short investigation, with the same rule: the smallest series that can change the decision.
- There is no multi-minute thermal soak. A failure that appears only after minutes of continuous orbit needs a longer pan, requested because that was the symptom.
- A single session is a snapshot. Judging a change needs the same short script on two revisions. That paired run is still two sessions, not a return of the matrix.
- Correctness is untouched. A wrong, fast edit passes this strategy.
- Feel thresholds are review figures for the report's vocabulary. They do not replace the contract's historical budgets, and they do not reinstate those budgets as gates.

## Adoption boundary

If an owner adopts this method, the implementation that follows adds one investigation profile and
leaves the `acceptance`, `diagnostic` and `milestone` plans, their quotas, and their historical
meanings in place. It deletes no workload generator, no evidence file and no functional spec. Until
that adoption, `npm run perf` and the contract mean what they mean today, and neither is a step on
an ordinary slice, phase or final gate.
