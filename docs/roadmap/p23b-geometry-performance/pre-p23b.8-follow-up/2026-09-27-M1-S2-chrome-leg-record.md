# Pre-P23B.8 follow-up M1 S2 — the Chrome leg (headless Chrome 152.0.7977.54)

```text
AUTHORITY: NONE — measurement evidence for M1, and the S2 step record of the ratified plan
           (§6 S2). The live capture beside this file (§7) is the machine-readable source; this
           record is a reading of it with the conditions it was taken under. No threshold, no
           baseline, no ratchet, no budget metric, no production change.
```

## What was run

```text
ONE PROTOCOL, ONE RUNTIME. `__P23B_M1_RUN__()` on the DEV harness route (/dev/perf/p23b), driven
from outside the page by the CDP runner (`tests/lib/bench/p23b-m1-browser-runner.cli.ts`). The
runner adds the one signal a page cannot measure about itself — the presented frame — and the
harness produces everything else.

Fixtures, in harness order:  p23b-40-wall-straight-v1 · p23b-40-wall-all-curved-v1 ·
                           owner-40-curved-v1 · connected-curved-grid-v1 LAST (advisory)
Classes per fixture:        rigid-wall-drag · bend (where applicable) · whole-room-move-bridge ·
                           wall-authoring · room-creation-commit
Action rule:                25 accepted actions per class, the leading five excluded as warm-up,
                           every mutating action put back with the editor's own undo
Settle rule:                three frames after the action, per class, in its own isolated session
```

| Condition (§3.6) | This leg |
| --- | --- |
| build / mode | DEV, Plan view only |
| runtime | Google Chrome for Testing **152.0.7977.54**, headless (`HeadlessChrome/152.0.0.0`) |
| pinned to D1's major (§9.3) | yes — Chrome 152, the same major as P23B.6's S1b final-head capture |
| viewport / DPR | 1500 × 1000 CSS px, devicePixelRatio 1 (observed in-page, not assumed) |
| harness tabs | **1** (`targetOrigin: created`, one page target on the route) |
| driver action guard | 6000 ms |
| document freshness | loaded for this run: `documentAgeMs` 2940, `navigationType` `navigate` |
| commit / tree | `b6f2203b`, `treeDirty: false` — the capture belongs to exactly that tree |
| machine | arm64 / Apple M2 / 8 logical CPUs / 16 GB RAM · macOS 15.7.2 (24G325) · node v26.7.0 |
| plan ladder | 19.292586186549904 px/m (the same ladder on every fixture and both runtimes) |
| captured | 2026-09-27T22:56:52.486Z |

```text
Settlement: 19 class row(s), every fixture `settled: true`, ZERO dropped deferred boundaries. The
§3.5 STOP condition is therefore not triggered, and the run is recorded as it stands (no partial
recording, no re-run needed).
Advisory case: the connected case ran last under the same protocol and is marked `advisory: true`;
it is excluded from D1's and D7's rows (§3.2, §9.4), so nothing below cites it.
```

## D1's two rows, re-read (§3.3 — COMPARISON ONLY)

`release` boundary p50 / p95 ms, per class per fixture. The right-hand column is P23B.6's S1b
final-head capture, quoted from the closed record; the numbers are NOT a delta claim against it.

| class | fixture | Chrome 152 p50 | p95 | n | P23B.6 S1b (comparison) |
| --- | --- | --- | --- | --- | --- |
| `wall-authoring` | `p23b-40-wall-straight-v1` | 42.6 | 47.9 | 23 | 2,147.0 → 3,601.2 |
| `wall-authoring` | `p23b-40-wall-all-curved-v1` | **141.9** | 173.2 | 23 | 2,147.0 → 3,601.2 |
| `wall-authoring` | `owner-40-curved-v1` | 92.9 | 106.9 | 23 | 2,147.0 → 3,601.2 |
| `whole-room-move-bridge` | `p23b-40-wall-straight-v1` | 155.8 | 184.6 | 20 | 73.4 → 493.4 |
| `whole-room-move-bridge` | `p23b-40-wall-all-curved-v1` | **300.0** | 531.0 | 20 | 73.4 → 493.4 |
| `whole-room-move-bridge` | `owner-40-curved-v1` | 181.0 | 727.6 | 20 | 73.4 → 493.4 |

```text
BOTH ROWS ARE PRESENT, which is what S2 exists to establish: a capture without
`whole-room-move-bridge` cannot answer D1. The classes are the same classes P23B.6 measured, in the
same harness order, with the same sequences for the two authoring classes.
```

## What this leg may and may not say

```text
MAY  · both D1 rows were re-read on headless Chrome 152 under the §3.6 conditions, beside P23B.6's
       numbers, as a comparison only
     · the capture is settled, records zero dropped boundaries, and belongs to commit b6f2203b with
       a clean tree

MAY NOT · that the increase is repeated, explained, refuted or attributed. THIS SESSION DOES NOT
         REPRODUCE IT: the all-curved `wall-authoring` release reads 141.9 ms p50 here against
         P23B.6's 3,601.2 ms, and the all-curved `whole-room-move-bridge` reads 300.0 ms against
         493.4 ms. A differently-run capture is never a delta claim, so those readings are a
         FINDING (§8: a re-measurement that repeats an increase is a finding, not a fix) and the
         increase remains UNRESOLVED. No cause is proposed, here or anywhere in M1.
       · that the closed P23B.11 S7 record is contradicted: S7 read 88.6 ms p50 for the same
         all-curved `wall-authoring` release (its own protocol, its own DEV session). M1's 141.9 ms
         sits beside that reading, not against P23B.6's, and neither is a delta on the other.
       · anything statistical: one machine, one DEV session, advisory numbers only.
```

## Two harness defects this leg found, and how they were closed

Both were found by reading a *completed* capture rather than by trusting the run log — which is
why the leg was captured more than once, and why only the last capture is cited here and kept live.

```text
1. THE CONNECTED CASE'S BEND WAS NOT A DRAG. The bend class derived its release point from the
   SNAPPED knot, so a fixture whose knots sit off-grid on both axes (the generated connected case)
   got 3.5 px of pointer travel — under the app's own `EDITOR_DRAG_THRESHOLD_PX` of 4 — and every
   release committed as a click: no bend action, no accepted action, and the class retried until it
   gave up. The release is now one grid increment measured from the PRESS point (identical
   committed geometry, full travel), guarded by a test that asserts the gesture clears the
   threshold on every shape the protocol presents.

2. THE ROWS OF A LONG RUN COULD NOT BE READ BACK. The class registries were written under the bare
   class name and read under the recorded `p23b-m1:` one, so every gesture series and long-frame
   window read as NOT MEASURED while the capture still looked complete; and the ledger registry
   keeps only its most recent few sessions, so a class row built after nineteen sessions lost its
   population. Both are closed (the class name is now built in one place and read through it; the
   ledger is snapshotted as each class closes), each with a test that fails on the old shape.

3. A THIRD, FOUND WHILE MEASURING, IS IN THE RUNNER AND NOT THE HARNESS: a runtime already sitting
   on the harness URL keeps the document it has when it is told to navigate to that same URL, so a
   leg could measure an older tree while reporting provenance for the run doing the measuring. The
   runner now loads `about:blank` first, records the document's own age, and refuses to start
   against a document older than two minutes. This leg reports `documentAgeMs: 2940`.
```

## Live evidence / reproduce

```text
LIVE  ./2026-09-27-M1-chrome-leg.json            (the full record: provenance, class rows, D1, D7,
                                                  presented rows, gesture series, long frames)
RE-READ (throws the capture away; ~7 minutes) — pin the browser to Chrome 152, one harness tab,
  viewport 1500×1000 DPR 1, DEV server on 5173, then:
  cd apps/editor && npm exec -- vite-node --config vitest.config.ts \
    tests/lib/bench/p23b-m1-browser-runner.cli.ts -- \
    --port 9223 --runtime "Google Chrome for Testing 152.0.7977.54 (headless, one harness tab, viewport 1500x1000 DPR 1)" \
    --out /tmp/m1-chrome-leg.json --budget-ms 10000
```
