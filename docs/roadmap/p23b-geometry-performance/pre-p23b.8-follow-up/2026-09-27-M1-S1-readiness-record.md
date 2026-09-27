# Pre-P23B.8 follow-up — S1 readiness (CLOSED)

```text
AUTHORITY: NONE — step record. The live contracts are the harness code routed from the plan's §10
(protocol → apps/editor/src/routes/dev/perf/p23b/drive.ts · frame timing →
apps/editor/src/lib/bench/p23b-m1-frame-timing.ts · record shape →
apps/editor/src/lib/bench/p23b-m1-record.ts · presented-frame correlation → the same module, driven by
apps/editor/tests/lib/bench/p23b-m1-browser-runner.cli.ts). This record describes what those files do;
it owns nothing.
ROLE:     prove the slice's two authorized instrumentation items landed DEV-only, that the harness and
          the whole gate set are unchanged by them, and that BOTH runtimes can host the route and expose
          a presentation-grade signal — before either leg is spent.
NOT:      a capture · a measurement · a threshold · a budget · a baseline or ratchet write.
```

## 1. The two authorized items, as landed

```text
(a) GESTURE FRAMES — `p23b-m1-frame-timing.ts` (page-side, DEV-gated).
    A drag is bracketed and every rAF callback interval inside it is recorded with its own clock read;
    the series is reported with its frame count, its drag count and how many frames fall inside a
    `p2311:pointermove-rigid` / `p2311:pointermove-bend` window. The bracket is installed in the DRAG
    classes only (`rigid-wall-drag`, `bend`, `whole-room-move-bridge`) — the tap-based `wall-authoring`
    class has no pointer movement between its taps and is never the workload for that row (§4.2).
(b) RELEASE SIDE — two additions, one authorization (§4.3).
    (b1) presentation-grade: `AnimationFrame::Presentation` instants from the harness page's own renderer,
         read over CDP tracing by `p23b-m1-browser-runner.cli.ts`, correlated to each accepted release's
         end on a calibrated clock. This is the ONLY signal the record may call presented-frame latency.
    (b2) `long-animation-frame` observer, per class window: its own INCIDENCE row, never a latency row.
    PROXY: the existing release-side `browser-frame` boundary, reported beside (b1) and always labelled a
         proxy, with its coverage (how many releases carry it, out of how many).
    
WHY NO PRODUCT MODULE WAS TOUCHED (§4.5 guard rail): both items are page-side. The product already emits
the marks the gesture series correlates with, so the instrumentation needed no product call site; the
wiring test `p23b-m1-record.test.ts` asserts that the five product modules nearest this path carry
neither `p23b-m1` nor `p23bM1`. Nothing is added to the product bundle by the instrumentation beyond the
harness route's own lazy DEV chunk.
```

## 2. Provenance of the two items (what a reader must be able to check)

```text
gesture row      definition travels with it: "requestAnimationFrame callback interval during a real Plan
                 drag (pointerdown → the action resolving) … A callback interval is a PROXY: it is not
                 presented-frame latency, not paint time and not GPU work."
long-frame row   definition travels with it: "PerformanceObserver long-animation-frame entries (frames at
                 or over 50 ms only) … an INCIDENCE row and never a latency row." A runtime without the
                 entry type reports NOT MEASURED with its reason, never a zero.
presented row    definition travels with it: "the next presented frame strictly after the synchronous
                 release ended, on a correlated presentation clock (CDP display/trace events), never an
                 rAF callback." Where the correlation is unavailable the row stays the labelled PROXY.
coverage         every row carries it: frames/drags and pointermove share for (a); release coverage for
                 (b1) and (b2); releases/covered for the proxy.
```

## 3. Both runtimes can host the protocol (preflight, no protocol run)

```text
The runner's `--dry-run` attaches, sets the protocol viewport (1500×1000 CSS px, DPR 1), navigates to the
harness route, calibrates the presentation clock twice and counts presented frames — WITHOUT running the
protocol. This is §3.1's STOP condition checked before a leg is spent: a runtime that cannot host the
route is reported, never compared against a differently-run capture.

runtime                        presented frames (window)   calibration residual   route
Google Chrome for Testing 152  301                        0.143 ms              loaded, viewport honoured
Electron 35.0.2 (Chromium 134) 181                        0.736 ms              loaded, viewport honoured
(both ≈60 Hz, 5 s / 3 s windows)

evidence   LIVE ../../../../../.freebuff scratch during the slice; the preflight JSONs are transcribed
           into the S2/S3 records' provenance tables (the captures themselves are the cited evidence).
TARGET     Chrome: one target CREATED. Electron: Electron's browser target does not implement
           `Target.createTarget`, so the runner attaches to the page target it already hosts; the leg
           records `targetOrigin: existing`. One harness tab on both, which is what §3.6 requires.
LOAF       both runtimes report `long-animation-frame` in `PerformanceObserver.supportedEntryTypes`
           (Chrome 152 · Electron 35/Chromium 134), so (b2) is measurable on both legs.
PIN        §9.3: the Chrome leg uses the pinned Google Chrome for Testing 152.0.7977.54 — the same major
           as the P23B.6 S1b capture D1's numbers came from — so no protocol-flagged version delta is
           needed. Electron is NOT pinned by the plan; its version is recorded per capture.
```

## 4. Gates (all green at the readiness head; the legs run at this commit)

| Gate | Result |
| --- | --- |
| `npm run check` | editor + museum svelte-check: 0 errors / 0 warnings |
| `npm run build` | editor + museum production builds ok |
| `npm run verify:visitor-bundle -w @portfolio/museum` | visitor bundle ok (3 server / 9 client entries) |
| `npm test` | 357 files / 5,098 passed; 2 files and 4 tests skipped (baseline was 355 / 5,078: +2 files = this slice's two new test files) |
| `npm run test:arch` | 23 files / 254 passed |
| `npm run test:heavy` | 7 files / 89 passed |
| `npm run test:perf` | 8 files / 63 passed (1 skipped); budgets + P23B.5 ratchet reproduced unchanged |
| focused | `tests/lib/bench/p23b-m1-frame-timing.test.ts` (8) + `p23b-m1-record.test.ts` (11) = 19 passed |

```text
NO BASELINE/RATCHET TOUCH: `bench:record` and `reuse:record` were not run; `g3-baseline.json` and the
P23B.5 reuse ratchet are neither read nor written by anything this slice adds. The M1 classes are
`p23b-m1:`-prefixed action-class sessions, which the harness keeps as containment records only — the
scripted baseline capture still runs the three committed fixtures alone.
```

## 5. What S1 does NOT prove (and where it is proven)

```text
"the harness still reports settled + zero dropped boundaries" is a property of a REAL capture, and S1 is
by design capture-free. It is proven by the legs themselves: the driver throws on any class whose ledger
is not `settled` or whose `droppedBoundaries` is non-zero, so a leg that produced a capture IS that proof,
per class, and the S2/S3 records carry the per-class ledger rows. Nothing here is papered over: if a leg
had failed either check it would have produced no capture at all.
```

## 6. Owner decisions the plan left open (§9), as applied

```text
9.1 authorize §4.2 (gesture frames)                    AUTHORIZED — landed as item (a).
9.2 authorize §4.3 (release side: b1 + b2)             AUTHORIZED — landed as item (b), one method both legs.
9.3 pin the Chrome leg to D1's major                   PINNED — Chrome for Testing 152.0.7977.54 is present
                                                       locally; no protocol-flagged delta is needed.
9.4 connected case advisory-only, never recorded       CONFIRMED — hosted LAST, action-class sessions only.
9.5 R1 stays a ranking with no mechanism               CONFIRMED — the ranking record recommends nothing.
```

## 7. Route

```text
protocol (as code)      apps/editor/src/routes/dev/perf/p23b/drive.ts → runM1 / P23B_M1_ACTION_CLASSES
frame timing (as code)  apps/editor/src/lib/bench/p23b-m1-frame-timing.ts
record shape            apps/editor/src/lib/bench/p23b-m1-record.ts
runner (as code)        apps/editor/tests/lib/bench/p23b-m1-browser-runner.cli.ts
harness page            apps/editor/src/routes/dev/perf/p23b/+page.svelte → __P23B_M1_RUN__ / M1 button
plan                    ./2026-09-27-pre-P23B.8-follow-up-plan.md (§3 · §4 · S1)
```
