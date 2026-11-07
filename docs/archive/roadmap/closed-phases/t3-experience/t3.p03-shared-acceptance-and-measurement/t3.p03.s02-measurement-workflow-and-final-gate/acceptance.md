# T3.P03.S02 — acceptance record: Measurement workflow and final gate — CLOSED STUB

**AUTHORITY: NONE.** This is the compacted record of the phase's closed final gate.
`T3.P03.S02` was accepted 2026-10-23 as `owner-override` at `eabd4b88`, shipped by slice-closeout,
and `T3.P03` closed 2026-10-24. This stub stays at the phase's declared `FINAL PHASE GATE` path and
at the integration route `T3.P03.S01` names; the phase's closed state is in
[../README.md](../README.md). The full 837-line record — the correction
history, review rounds, stack/cleanup evidence, per-row tables, statistics and residual inventory —
is recoverable at the Git anchor below. Nothing here is planning authority or readiness.

```text
delivered      The owner-ratified on-demand measurement workflow: `@playwright/test` 1.63.0 as an
               editor devDependency with its own `apps/editor/perf/` config and explicit
               `perf`/`perf:bundle` scripts that no Vitest lane, root gate or default build collects;
               runtime-gated `perf-marks` correlation inert unless a harness sets its flag;
               cold/warm/repeat-use flows F1, F2 (S/M), F3/F4/F8 drag, F7 orbit, F9 Save through the
               local test-auth seam and F13 repeated open/close; calibration entry; bundle report
               with `--forbid`, `--forbid-file` and real Rollup/`BUNDLE_PROVENANCE=1` module proof
               that fails closed on missing, partial, stale or edited evidence; a separate
               trace-proof image/feedback diagnostic; plus the retention repairs the lifetime work
               exposed (shared WebGL texture ownership, Dimensions continuations, Svelte 5.57.0
               head anchor).
contract       `docs/reference/components/performance.md` (acceptance/workflow) and the F.4
               destination; no product feature, source encoding or accepted capability changed.
provenance     Batch E permission 2026-10-22 (E1/E2); accepted and shipped 2026-10-23 as
               owner-override at `eabd4b888974127d891cedf840e5e056ad0c016a`; merged as P1 merge
               `c1e4e030`. Trace-method deviation:
               `docs/reference/decisions/t3p03s02-trace-correlation-deviation-2026-10-22.md`
               (unratified).
evidence       final combined validation: 62/62 unique browser cases across 13 files, both browsers,
               zero skips; final repository gate: check 0/0, full editor 176 files / 2,264 tests,
               arch 21 files / 172, heavy 8 files / 118, root build, check:api, DB-backed API 80
               tests / 11 reports / 0 skips; S01 recheck 6 files / 88 tests and both static surface
               gates. Real module proof: authoring absence over 233 Rollup identities, known visitor
               presence refused (11 hits), maps-only and no-evidence refusals. Trace: 22/22 pure
               controls, causal held-input positive (501.9 ms observed) and real zero-hold negative
               rejected, both browsers. This close validated the record and re-ran nothing.
entry points   harness         apps/editor/perf/playwright.config.ts · perf/serve.mjs · perf/lib/*
               flows           apps/editor/perf/flows/{startup,project-open,orbit,save,cycles,
                               drag-correlation,calibration,trace-proof}.spec.ts
               calibration     apps/editor/perf/calibration/entry.ts
               bundle report   apps/editor/perf/bundle-report.mjs
               marks           apps/editor/src/lib/platform/perf-marks.ts
               regression      apps/editor/tests/lib/platform/perf-marks.test.ts
               contracts       docs/reference/components/performance.md · apps/editor/tests/README.md
residuals      trace-method disposition, reference hard rows, calibration, GPU counters, L/XL and
               M/L workloads, viewer/Preview rows and the hard-budget decision all remain open or
               unrun; see below. No hard budget is claimed anywhere in this record.
recovery       git show a65db2e0ef1df53d6f2d9439d9ee137a7491d85c:<this path>
               tag closed/T3.P03 (local; its target is the anchor commit)
               earlier slice-closeout anchor eabd4b88 · tag closed/T3.P03.S02
```

## Measured pre-flight rows (no budget accepted)

Summary only; the full per-row tables, sample counts, statistics and limitations are at the anchor.
Machine: Apple M2 / 16 GiB, Chrome and Chromium, 1920×1080 DPR 1, N1, CPU 1×. All values are
agent-operated pre-flight observations, never the owner-run reference pass.

| Row | Headline observation |
| --- | --- |
| F1 startup, first architectural frame cold / warm / repeat-use (rAF proxy) | 1,307.9 / 792.75 / 790.9 ms median; 1,320.08 / 793.36 / 792.38 p95; FCP/LCP 120 / 384 ms cold |
| F2 open S / M (median, p95) | S 144.05 / 27.1 / 26.3 ms; M 533.2 / 459.25 / 476.15 ms (p95 152.89 / 86.47 / 93.3 and 552.23 / 494.86 / 493.3) |
| F3 input→matching preview, n=600 | 15.5 ms median in every cache state, 16.6 ms max; 600/600 rows presented |
| F7 orbit M | 603 frames per run at 16.7 ms p95, 0 dropped, about 10.07 s per run |
| F9 Save receipt, corrected local stack (median / p95) | Chromium 226.65 / 231.50 / 209.35 ms; Chrome 107.85 / 108.30 / 103.60 ms; 29,594 wire bytes; labels are DOM updates, not presentation |
| F13 lifecycle, 460 accepted edits per browser (MiB after GC) | Chromium cold 1.42→11.95, warm +0.35, repeat-use +1.62; Chrome cold 1.50→11.98, warm +0.41, repeat-use +1.73 |
| Calibration, grid-7, 20 runs | 53.35 / 58.35 ms total median/p95 (developer observation; no reference median supplied) |

**Not claimed:** any hard product budget, the reference-machine rows, the trace option (A/B/C), GPU
counters, the F1/F2 first-interactive definition, and any `renderer.info` or detached-DOM row. The
hard-row table and every unrun row stay in the anchor record with the command an owner would run.

**Transferred by owner replanning 2026-10-24:** the unbuilt L/XL fixtures and the unrun M/L drag rows
are measured by [`T1.P02.S06`](../../../t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/implementation-plan.md)
(reviewed with T3 for shared harness/fixture edits). The S02 trace, hard-row and calibration items
stay as this record states them: open, unrun or unratified.

## Residuals

```text
trace           image/feedback and causal real-positive/zero controls verified both browsers;
                owner method disposition remains open and unratified
hard rows       owner-operated reference rows remain unrun (E6); no budget accepted here
calibration     reference median not recorded; other machines cannot claim equivalence yet
GPU             draw calls, triangles and GPU time/memory unrun
F13             renderer/head repair verified; warmed growth recorded; no owner disposition
workloads       L/XL, S orbit, M/L drag, Safari, Firefox, viewer F11/F12, Preview F10 unrun or
                transferred as above
save            local-stack observations only; never a production-service baseline
review          developer PASS; slice acceptance is owner-override
```

## Closed-work preservation report

```text
CLOSEOUT PRESERVATION — T3.P03.S02 → phase close (2026-10-24)
final-gate artifact compacted:   1   acceptance.md → this stub at its own path
prose already stubs:             1   review-handoff.md (slice closeout, unchanged)
live plan (unchanged):           1   implementation-plan.md — the accepted plan record
renderable evidence archived:    0 files (browser evidence and raw traces live outside Git)
historical anchor:               a65db2e0ef1df53d6f2d9439d9ee137a7491d85c · tag closed/T3.P03
                                 (local only — not pushed) · tag closed/T3.P03.S02 already pushed
anchor ancestry verified:        anchor is an ancestor of origin/main `2215af34` and of the tag target
earlier slice closeout anchor:   eabd4b88 (accepted revision) retained and still reachable
new live → archive prose links:  0
deferred/unrun rows preserved:   trace method, reference hard rows, calibration, GPU counters,
                                 transferred L/XL + M/L workloads; none claimed as passing
permanent stubs added:           0   the stub replaces the live record; no new stub path
drift report:                    phase README: PHASE CLOSE closed ✓ | track phase row: shipped ✓ |
                                 baton: T3.P04.S01 released ✓ | integration: recorded ✓
post-merge verification:         PENDING — after this PR's merge commit:
                                 git merge-base --is-ancestor a65db2e0 main && echo "anchor reachable"
                                 git show a65db2e0:docs/roadmap/t3-experience/t3.p03-shared-acceptance-and-measurement/t3.p03.s02-measurement-workflow-and-final-gate/acceptance.md | head -3
```

The phase close ran the documentation gate only (links, written paths, anchors). It is not a product
lane and does not replace the verification above, which remains the tested revision's record.
