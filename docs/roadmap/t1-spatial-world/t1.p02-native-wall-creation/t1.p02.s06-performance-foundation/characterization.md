# T1.P02.S06 — characterization from Bench 1 — CLOSED STUB

```text
AUTHORITY: NONE — the phase README owns slice status; this stub records the characterization and
           its recovery.
STATUS:    spent. The optimize step it directed is implemented and accepted; Bench 1 remains the
           first owner-run pass and keeps its original meaning.
LABEL:     Bench 1 medians over 10 measured runs per cache state (`1c5e530c`, Chrome 155, AC).
```

## What it established

The starting budget position, before any algorithm work, on the designated machine:

| Row (contract) | S | M | L |
| --- | --- | --- | --- |
| F2 open (300 / 800 ms / 2.0 s Target) | 144 ms pass | 524 ms pass | 5,216 ms Target miss |
| F3 input→preview (33 / 50 / 100) | 16 ms | 48 ms (4 % margin) | 216–233 ms fail |
| F4 commit (100 / 100 / 200) | 41–56 ms | 163–174 ms fail | 717–784 ms fail |
| F8 Undo/Redo (100 / 100 / 200) | 31 ms | 112 ms fail | 637–671 ms fail |
| F7 orbit frame p95/p99 (16.7/25, 16.7/33, 33/50) | pass | pass | pass |

Where the time went, in the plan's terms: a full whole-document compile and one full representation
build per pointer move (L compile 118 ms of a 164 ms move, with quadratic topology pair loops); two
compiles and two representation builds per accepted result; a 4.9 s L open dominated by Stage mount
DOM insertion rather than admission; per-entity submission (2,269 draws at L); idle re-rendering at
60 fps; and about 1.3 more live geometries per mesh after every commit, never released (6.0–6.2 MiB
retained per accepted edit).

Those findings set the D.1–D.6 order and the H1–H9 hypotheses. The measured outcome is in the
[acceptance record stub](./acceptance.md#s06-milestone-gate-owner-direction-2026-10-26); the
predictions this page made were hand calculations and are superseded by it.

## Recovery

```text
git show e676a363:docs/roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/characterization.md
anchor  e676a363
 tag    closed/T1.P02.S06 → e676a363 (local only — not pushed)
```

The full page — per-stage tables for F3/F4/F8, the open's traced window, memory and ownership
observations, the named superlinear terms, and the refit with its predictions — is recoverable from
the anchor.
