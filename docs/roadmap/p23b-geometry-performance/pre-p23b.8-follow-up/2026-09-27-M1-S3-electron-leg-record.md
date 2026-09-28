# Pre-P23B.8 follow-up M1 S3 — the Electron leg and the side-by-side pair

```text
AUTHORITY: NONE — measurement evidence for M1, and the S3 step record of the ratified plan (§6 S3:
"ONE capture under the same protocol in the same session ... Evidence: the Electron capture JSON +
the side-by-side pair table (per row, per fixture)"). The live captures beside this file are the
machine-readable source. No threshold, no baseline, no ratchet, no budget metric.

           CORRECTED 2026-09-27 (this leg was RE-RUN on the same machine, protocol and runtime): the
           gesture rows in the first capture pooled warm-up drags and retried attempts, and the
           `wall-authoring` classes' population (23 measured accepted, not 20) needed reconciling. The
           capture beside this file is the RE-RUN (head `33d532f5` + this pass's diff, uncommitted at
           capture time, `treeDirty: true`); the conditions and per-class tables BELOW are the FIRST session's (head
           `b6f2203b`, clean tree) and must not be quoted as the re-run's. The corrected session's
           per-class tables are in ./2026-09-27-M1-R1-corrections-and-attribution-record.md §2-§3, and
           that record separates the FIX from the SESSION with the release control (§2.4-§2.5).
```

## What was run

```text
THE SAME PROTOCOL THE CHROME LEG RAN, not a similar one: same fixtures in the same order (connected
case LAST, advisory), same five classes, same 25-accepted-action rule with the leading five excluded,
same three-frame settle, same 19.292586186549904 px/m plan ladder, same 1500×1000 DPR 1 protocol
viewport, same 6000 ms driver action guard, same `p23b-m1:` session prefix, same restore discipline.
Both legs ran in one session of work; each got its own runtime, its own capture and its own record,
and nothing is merged across them (§3.7).
```

| Condition (§3.6) | Chrome leg | Electron leg |
| --- | --- | --- |
| runtime | Google Chrome for Testing 152.0.7977.54 (headless) | Electron **35.0.2** (Chromium **134.0.6998.88**) |
| host | headless browser, offscreen surface | offscreen Electron host, one BrowserWindow, no menu, throttling disabled |
| viewport / DPR | 1500 × 1000, DPR 1 (observed in-page) | 1500 × 1000, DPR 1 (observed in-page) |
| harness tabs | 1 (`targetOrigin: created`) | 1 (`targetOrigin: existing` — see below) |
| document freshness | `documentAgeMs` 2940, `navigate` | `documentAgeMs` 875, `navigate` |
| action guard / ladder | 6000 ms / 19.292586186549904 px/m | 6000 ms / 19.292586186549904 px/m |
| all classes settled | yes, 19 class rows, 0 dropped boundaries | yes, 19 class rows, 0 dropped boundaries |
| presented frames traced | 4406 of 4407 (page renderer) | 4433 of 4433 (page renderer) |
| clock residual | 0.125 ms | 0.293 ms |
| commit / tree | `b6f2203b`, clean | `b6f2203b`, clean |
| captured | 2026-09-27T22:56:52.486Z | 2026-09-27T22:48:14.870Z |

```text
THE ONE RECORDED DIFFERENCE, AND WHY IT IS NOT A PROTOCOL DIFFERENCE. Electron's browser target does
not implement `Target.createTarget` (`{"code":-32000,"message":"Not supported"}`), so the runner
attaches to the page target the host already provides and records `targetOrigin: 'existing'`. The
protocol is one harness tab either way; the fallback is written into the capture rather than left
implicit. STOP CONDITION (§6 S3: "STOP if the protocol could not be run identically — report which
condition differed"): the protocol ran identically; this is the only condition that differed, it is
the target-acquisition path, and it is recorded here and in both captures.
```

## The pair, per row, per fixture

Every table below is one row per class per fixture, the three committed fixtures only. The advisory
connected case is not in any of them (§3.2, §9.4). Nothing may be summed across classes or rows.

### D1 — the `release` boundary, p50 / p95 ms (comparison beside P23B.6, never a delta)

| class | fixture | Chrome p50 / p95 | Electron p50 / p95 | P23B.6 S1b (comparison) |
| --- | --- | --- | --- | --- |
| `wall-authoring` | `p23b-40-wall-straight-v1` | 42.6 / 47.9 | 39.5 / 44.3 | 2,147.0 → 3,601.2 |
| `wall-authoring` | `p23b-40-wall-all-curved-v1` | 141.9 / 173.2 | 165.2 / 275.9 | 2,147.0 → 3,601.2 |
| `wall-authoring` | `owner-40-curved-v1` | 92.9 / 106.9 | 157.1 / 181.1 | 2,147.0 → 3,601.2 |
| `whole-room-move-bridge` | `p23b-40-wall-straight-v1` | 155.8 / 184.6 | 129.6 / 163.4 | 73.4 → 493.4 |
| `whole-room-move-bridge` | `p23b-40-wall-all-curved-v1` | 300.0 / 531.0 | 353.8 / 526.2 | 73.4 → 493.4 |
| `whole-room-move-bridge` | `owner-40-curved-v1` | 181.0 / 727.6 | 249.2 / 382.9 | 73.4 → 493.4 |

### Release → next presented frame, p50 / p95 ms (the §4.3(b1) row; coverage 20/20 or 23/23 on every row)

| class | fixture | Chrome | Electron |
| --- | --- | --- | --- |
| `rigid-wall-drag` | `p23b-40-wall-straight-v1` | 36.6 / 47.1 | 31.5 / 65.3 |
| `whole-room-move-bridge` | `p23b-40-wall-straight-v1` | 42.9 / 50.3 | 62.4 / 74.0 |
| `wall-authoring` | `p23b-40-wall-straight-v1` | 44.2 / 49.8 | 66.3 / 68.8 |
| `room-creation-commit` | `p23b-40-wall-straight-v1` | 41.4 / 49.7 | 63.3 / 66.4 |
| `rigid-wall-drag` | `p23b-40-wall-all-curved-v1` | 218.6 / 273.5 | 229.5 / 256.6 |
| `bend` | `p23b-40-wall-all-curved-v1` | 214.5 / 249.4 | 329.3 / 419.9 |
| `whole-room-move-bridge` | `p23b-40-wall-all-curved-v1` | 278.4 / 378.5 | 308.1 / 411.0 |
| `wall-authoring` | `p23b-40-wall-all-curved-v1` | 292.4 / 351.0 | 315.9 / 510.9 |
| `room-creation-commit` | `p23b-40-wall-all-curved-v1` | 291.9 / 407.2 | 349.8 / 521.0 |
| `rigid-wall-drag` | `owner-40-curved-v1` | 77.6 / 101.7 | 154.2 / 227.2 |
| `bend` | `owner-40-curved-v1` | 86.9 / 102.8 | 140.4 / 156.7 |
| `whole-room-move-bridge` | `owner-40-curved-v1` | 85.3 / 129.6 | 157.2 / 230.1 |
| `wall-authoring` | `owner-40-curved-v1` | 96.4 / 101.7 | 183.3 / 212.2 |
| `room-creation-commit` | `owner-40-curved-v1` | 84.7 / 95.3 | 171.7 / 212.3 |

### Gesture frames — rAF callback interval during a real drag, p50 / p95 ms and frame count (§4.2 item (a))

```text
CORRECTED 2026-09-27 — and this table is the FIRST session's, not the re-run's. The first pair's gesture
rows pooled every bracketed drag — warm-up drags and retried attempts included — so a class reported 25
(and 26/29 with retries) where only 20 measured accepted actions remain (26/157 frames for this leg's
all-curved `rigid-wall-drag`, 98.4 ms p50). The capture beside this file is now the RE-RUN (head
`33d532f5` + this pass's diff, uncommitted at capture time, `treeDirty: true`); its rows are merged over the class's own
measured population and state both counts (`drags` / `registeredDrags` / `excludedDrags`), reading
17.8 ms p50 with 20 of 25 brackets merged. Corrected per-class tables →
./2026-09-27-M1-R1-corrections-and-attribution-record.md §2.
```

| class | fixture | Chrome p50 / p95 | Chrome frames | Electron p50 / p95 | Electron frames |
| --- | --- | --- | --- | --- | --- |
| `rigid-wall-drag` | `p23b-40-wall-straight-v1` | 16.7 / 98.2 | 150 | 16.7 / 78.4 | 150 |
| `whole-room-move-bridge` | `p23b-40-wall-straight-v1` | 179.8 / 358.3 | 151 | 156.0 / 239.7 | 150 |
| `rigid-wall-drag` | `p23b-40-wall-all-curved-v1` | 95.9 / 355.2 | 152 | 98.4 / 356.9 | 157 |
| `bend` | `p23b-40-wall-all-curved-v1` | 103.0 / 348.5 | 151 | 122.8 / 513.8 | 170 |
| `whole-room-move-bridge` | `p23b-40-wall-all-curved-v1` | 367.9 / 695.1 | 150 | 469.5 / 865.2 | 150 |
| `rigid-wall-drag` | `owner-40-curved-v1` | 19.2 / 181.3 | 150 | 28.5 / 318.6 | 152 |
| `bend` | `owner-40-curved-v1` | 18.6 / 188.1 | 150 | 17.7 / 217.9 | 150 |
| `whole-room-move-bridge` | `owner-40-curved-v1` | 222.8 / 367.2 | 151 | 323.2 / 576.0 | 152 |

### Long-frame incidence — frames at or over 50 ms, count and p50 duration ms (§4.3(b2))

| class | fixture | Chrome n / p50 | Electron n / p50 |
| --- | --- | --- | --- |
| `rigid-wall-drag` | `p23b-40-wall-straight-v1` | 42 / 79.5 | 27 / 71.8 |
| `whole-room-move-bridge` | `p23b-40-wall-straight-v1` | 130 / 190.1 | 127 / 159.3 |
| `wall-authoring` | `p23b-40-wall-straight-v1` | 27 / 92.3 | 26 / 90.4 |
| `room-creation-commit` | `p23b-40-wall-straight-v1` | 27 / 91.0 | 27 / 86.1 |
| `rigid-wall-drag` | `p23b-40-wall-all-curved-v1` | 127 / 217.9 | 131 / 201.4 |
| `bend` | `p23b-40-wall-all-curved-v1` | 129 / 213.9 | 148 / 223.6 |
| `whole-room-move-bridge` | `p23b-40-wall-all-curved-v1` | 177 / 339.4 | 182 / 428.5 |
| `wall-authoring` | `p23b-40-wall-all-curved-v1` | 76 / 288.3 | 76 / 310.6 |
| `room-creation-commit` | `p23b-40-wall-all-curved-v1` | 175 / 139.9 | 175 / 157.9 |
| `rigid-wall-drag` | `owner-40-curved-v1` | 83 / 135.1 | 117 / 189.7 |
| `bend` | `owner-40-curved-v1` | 89 / 130.7 | 113 / 126.3 |
| `whole-room-move-bridge` | `owner-40-curved-v1` | 156 / 218.9 | 162 / 309.2 |
| `wall-authoring` | `owner-40-curved-v1` | 66 / 96.9 | 76 / 153.6 |
| `room-creation-commit` | `owner-40-curved-v1` | 52 / 111.7 | 132 / 58.6 |

### D7 — the `commit-capture` mark, count and p50 ms

| class | fixture | Chrome n / p50 | Electron n / p50 |
| --- | --- | --- | --- |
| `rigid-wall-drag` | `p23b-40-wall-straight-v1` | 20 / 0.90 | 20 / 0.80 |
| `whole-room-move-bridge` | `p23b-40-wall-straight-v1` | 20 / 1.10 | 20 / 0.90 |
| `wall-authoring` | `p23b-40-wall-straight-v1` | ABSENT (class never reaches `commit-capture`) | ABSENT |
| `room-creation-commit` | `p23b-40-wall-straight-v1` | ABSENT | ABSENT |
| `rigid-wall-drag` | `p23b-40-wall-all-curved-v1` | 20 / 1.90 | 20 / 1.90 |
| `bend` | `p23b-40-wall-all-curved-v1` | 20 / 1.90 | 20 / 2.90 |
| `whole-room-move-bridge` | `p23b-40-wall-all-curved-v1` | 20 / 2.40 | 20 / 2.80 |
| `wall-authoring` | `p23b-40-wall-all-curved-v1` | ABSENT | ABSENT |
| `room-creation-commit` | `p23b-40-wall-all-curved-v1` | ABSENT | ABSENT |
| `rigid-wall-drag` | `owner-40-curved-v1` | 20 / 2.00 | 20 / 3.10 |
| `bend` | `owner-40-curved-v1` | 20 / 2.10 | 20 / 2.90 |
| `whole-room-move-bridge` | `owner-40-curved-v1` | 20 / 2.20 | 20 / 3.00 |
| `wall-authoring` | `owner-40-curved-v1` | ABSENT | ABSENT |
| `room-creation-commit` | `owner-40-curved-v1` | ABSENT | ABSENT |

## What the pair does and does not say

```text
SAYS     · one protocol produced both legs in one session of work, both settled, both with zero
           dropped boundaries, both labelled by runtime and version, each with its own JSON
         · the three drag classes and both D1 classes were measured on both runtimes, so the
           cross-runtime statement M1 exists to enable is now available at this resolution
         · the release → next presented frame row exists on both runtimes with full coverage — the
           number P2 asked for and neither runtime had before

DOES NOT · establish a cause for the browser/node gap (this slice does not seek one)
         · claim a delta against P23B.6's S1b numbers, on either runtime
         · explain P23B.6's final-capture increases; a session that does not reproduce them is a
           finding, not a refutation (§8)
         · rank any cost (that is R1, and only after M1 lands)
         · support a statistical claim: one machine, one DEV session, advisory numbers only
```

## Live evidence / reproduce

```text
LIVE  ./2026-09-27-M1-electron-leg.json   (provenance, class rows, D1, D7, presented rows, gesture
                                           series, long frames — same schema as the Chrome leg)
      ./2026-09-27-M1-chrome-leg.json     (the Chrome side of every table above)
      Both legs are NOT COMMITTED — retained in the working tree, gitignored (~40k pretty-printed lines
      each); the two RE-READ commands below regenerate them.
RE-READ — start an Electron host on the harness route with `--remote-debugging-port=9225`, one
  window, viewport 1500×1000 DPR 1 (throttling disabled), then:
  cd apps/editor && npm exec -- vite-node --config vitest.config.ts \
    tests/lib/bench/p23b-m1-browser-runner.cli.ts -- \
    --port 9225 --runtime "Electron 35.0.2 (Chromium 134.0.6998.88, offscreen host, one harness tab, viewport 1500x1000 DPR 1)" \
    --out /tmp/m1-electron-leg.json --budget-ms 10000
```
