# Pre-P23B.8 follow-up — D4/D5/D6 live attribution, and the optimization that did not ship

Status: **EXECUTED, measured, in the working tree — NOT committed** (the owner asked for no commits).
Owner-authorized expanded scope for this PR: "The proposals are authorized as expanded scope for this
PR." That authorization covered the *directions* in
`./2026-09-27-optimization-directions-proposal.md`; this record reports what each direction measured,
including the one whose candidate implementation was measured out and reverted.

Read beside: `./2026-09-27-optimization-directions-proposal.md` (the directions),
`./2026-09-27-M1-R1-corrections-and-attribution-record.md` (§3 the first attribution — two of its claims
are corrected here), `./2026-09-27-M1-chrome-leg.json` / `-electron-leg.json` (the captured evidence —
both working tree only, NOT committed; gitignored).

**No commit, no baseline, no ratchet.** `apps/editor/src/lib/bench/baselines/g3-baseline.json` and the
P23B.5 reuse ratchet were neither read nor written. Every number below is advisory and one-machine.

---

## 0. What was asked, and what came back

```text
ASKED                                          CAME BACK
D4  attribute whole-Room per-move compile/     ATTRIBUTED. Reuse already works per Wall (4 built /
    install; report the reuse accounting       36 reused with a stated reason); the cost is the
                                               per-Wall VALUE COMPARISON of the whole generation,
                                               ~80 % of each preparation — not the builds.
D5  the wall-snap index — implement the        CANDIDATE REVERTED. The exact hull + rotating-calipers
    smallest evidence-backed optimization      extent sweep was implemented, proven output-identical,
                                               and then measured up to 2.2× SLOWER at this input's real
                                               k. The measured cost is the READS, not the arithmetic:
                                               12.1× on identical data, live, in one drag.
D6  falsify the post-release wait before       FALSIFIER NEGATIVE: the idle surface paces at 16.67 ms
    pricing it                                  p50, so the wait is not measurement-surface pacing.
                                               SUPERSEDED IN PROTOCOL (§4): the steady-state split in
                                               `./2026-09-27-M1-release-to-presented-split-record.md`
                                               finds 0.0 ms of restore and 0.0 ms of commit after a
                                               release in all 38 class rows; both land INSIDE the
                                               release. The cold live observation below stands only
                                               as a cold observation.
```

---

## 1. The instruments this pass added (DEV-only, inert by default)

| where | what | gate |
| --- | --- | --- |
| `packages/layout-core/src/layout-snap.ts` | `recordSnapInputProbe` — one entry per Wall-snap-index **cache miss**: the input shape (`spans`, `walls`, `maxEndpointsPerWall`, `endpointsP50`) beside `givenMs` (the real merge) and `plainMs` (**the same merge over a JSON copy of the same spans**) | `import.meta.env.DEV` **and** `globalThis.__P2311_SNAP_INPUT_PROBE__ === true` |
| `apps/editor/src/lib/editor/layout/p23b-mesh-identity.ts` | new phase `prebuild-stats` + `p2311ObserveWallMeshStats(stats, geometry)` — publishes one preparation's own `{ built, reused, refusedByReason }` on its own record | existing DEV **and** `__P2311_PERF__` |
| `apps/editor/src/lib/editor/layout/prepared-wall-meshes.ts` | four additive marks inside one preparation: `mesh-inputs`, `mesh-input-validate`, `mesh-room-meshes`, `mesh-build` | `p2311Measure` (DEV + `__P2311_PERF__`) |
| `apps/editor/tests/lib/bench/p23b-m1-browser-runner.cli.ts` | `presentedCadence` on the preflight output — gaps between consecutive presented frames of the **idle** rAF loop | preflight (`--dry-run`) only |

The snap probe's flag is deliberately **not** `__P2311_PERF__`: a recorded capture turns measurement on,
and no capture may turn this on. `mesh-inputs`/`mesh-input-validate`/`mesh-room-meshes`/`mesh-build` are
additive — `mesh-prebuild` still wraps all four, so no existing row changes meaning, and the containment
tree's exclusive self for `mesh-prebuild` now reads as *the per-Wall value comparison*.

---

## 2. D5 — the candidate that did not ship

### 2.1 What was built

An exact convex-hull + rotating-calipers farthest-endpoint pair, reproducing the per-pair scan's
lexicographic tie-break, with the scan kept as a DEV A/B arm
(`globalThis.__P2311_SNAP_EXTENT_LEGACY__`) and as the fallback for inputs of ≤ 16 points. It was
verified output-identical (the committed `layout-snap-extent-parity.test.ts` reference plus a dedicated
differential/property suite) and **deleted in this pass** with the parity and snap suites green before
and after.

### 2.2 Why it did not ship: it is slower at the input the editor actually hands in

Node, `vite-node`, both arms **interleaved per sample**, 5 warm-ups + 15 samples, p50 ms, one machine.
`ratio` = legacy scan ÷ hull sweep: **below 1.0 the candidate is slower**.

| fixture | wall spans | max endpoints / Wall | hull sweep p50 | per-pair scan p50 | ratio |
| --- | ---: | ---: | ---: | ---: | ---: |
| `p23b-12-wall-straight-v1` | 528 | 96 | 0.078 | 0.081 | 1.028 |
| `p23b-12-wall-target-curved-v1` | 544 | 128 | 0.122 | 0.109 | 0.891 |
| `p23b-12-wall-all-curved-v1` | 768 | 128 | 0.412 | 0.270 | **0.656** |
| `p23b-40-wall-straight-v1` | 1,760 | 96 | 0.144 | 0.155 | 1.074 |
| `p23b-40-wall-target-curved-v1` | 1,776 | 128 | 0.153 | 0.141 | 0.924 |
| `p23b-40-wall-all-curved-v1` | 2,560 | 128 | 1.358 | 0.898 | **0.661** |
| `owner-40-curved-v1` | 1,432 | 108 | 0.709 | 0.342 | **0.482** |

```text
WHY. A sampled curve's convex hull is nearly all of its points, so the sweep's advantage never
appears at this scale: k = 128 endpoints is 8,128 pairs — 87 µs of comparisons, measured. The
sweep's sort, its two point maps and its calipers cost more than the pairs they replace.
The exact form of the candidate was right; the ORDER-OF-GROWTH premise was wrong for k ≤ 128.
```

### 2.3 What the live instrument then showed: the cost is the READS

Live, in the app's own Chromium (DEV), all-curved 40-Wall fixture, the protocol's own view ladder
(19.292586186549904 px/m), one **rigid-Wall drag** dispatched with the harness's own synthetic pointer
gesture at the harness's own `MATRIX_TARGETS` grab point (wall `room-0:wall-1`, 25 % of its chord):

```text
INPUT the derivation was handed    2,560 wall spans · 40 walls · max 128 endpoints/Wall · p50 128
                                   — the SAME shape the node probe measured. The input is not a
                                   surprise input; there is no hidden 10× geometry.
givenMs (the live merge, proxied)  43.7 ms
plainMs (SAME spans, JSON copy)     3.6 ms      → 12.1× on identical values
mark, same action                  p2311:snap-wall-index        42.5 ms
                                   └ inside architecture-snap-resolution 104.4 ms
                                     └ inside pointermove-rigid        114.3 ms
```

Confirmed independently in the same page, isolating the container: merging the fixture's spans is
**2.4 ms** as plain objects and **25–27 ms** through `svelte/internal/client`'s `proxy()`, ~11×.

**A copy-first fix does NOT pay** — measured, because reading through the traps once is itself the cost:

| arm (median of 5) | ms |
| --- | ---: |
| merge the proxied spans directly | 27.0 |
| `JSON.stringify` the proxied spans (one pass of reads) | 31.1 |
| `JSON.stringify` + parse + merge the plain copy | **37.2** |

```text
VERDICT. The arithmetic is not the cost and a local copy is not the fix. The snap path is handed the
editor's `$state`-proxied baseline geometry, and every field read inside the merge pays a trap. The
cheapest correct fix is that the snap path receive geometry that is NOT proxied — a decision about the
IDENTITY the frozen baseline is stored under (preview-state / snapshot ownership, the P23B.7 family),
not a change inside `layout-snap.ts`. That is a ruling this pass reports rather than takes.
The `provenTraversalExtent` O(k) path already handles the STRAIGHT case (13.3 / 13.8 ms against
173.2 / 231.3 ms on the same 40-Wall document), which is the same mechanism seen from the other side:
straight walls avoid the pair scan; curved ones cannot, and both pay the traps.
```

### 2.4 What changed in the tree

`layout-snap.ts` ships the **per-pair scan** with a note recording that the sweep was implemented,
proven equal and measured slower; the hull helpers and the DEV A/B switch are deleted; the dedicated
fast-path test is deleted; the input probe (the instrument, not the optimization) is kept.

---

## 3. D4 — whole-Room preparation, attributed per phase

New marks, live whole-Room move, all-curved 40-Wall fixture, one accepted action, app Chromium (DEV).
`occ` = occurrences inside one preparation. Six preparations per accepted action, as the M1 record says.

| phase inside one `mesh-prebuild` | what it is | ms (live, per preparation) |
| --- | --- | ---: |
| `mesh-inputs` | collect the per-Wall inputs | 0.0 – 0.2 |
| `mesh-input-validate` | the DEV-only structural verdict | **8.4 – 10.5** (DEV only; skipped in a production build) |
| `mesh-room-meshes` | per-Room meshes (never cross generations) | **0.0** |
| `mesh-build` | the 4 Walls that actually changed | 2.6 – 4.7 |
| remainder of `mesh-prebuild` | **the per-Wall VALUE COMPARISON of all 40 Walls** | **61.2 – 68.5** (126.3 on the one preparation that built nothing) |
| `mesh-prebuild` total | | 72.2 – 81.3 |

The preparation's own accounting, published for the first time by the new `prebuild-stats` row:

```text
preview preparations   { built: 4,  reused: 36, refusedByReason: { 'compiled-wall-changed': 4 } }
every one of them      the 4 rebuilt Walls are room-0's own boundary — a Room move genuinely changes them
restore preparation    { built: 0,  reused: 40 }   ← a preparation that builds NOTHING
```

```text
THIS CORRECTS §3.1 OF THE CORRECTIONS RECORD. "Six full-generation mesh preparations per accepted
action" is WRONG: each preparation reuses 36 of 40 Walls and rebuilds exactly the 4 whose compiled
wall changed, with the reason recorded. The cost is not "doing the whole job six times" — it is SIX
FULL-GENERATION COMPARISONS, at 61–68 ms each, to discover that 4 Walls differ. A preparation that
builds nothing still costs 126 ms, which is the comparison and nothing else.

WHAT IT MEANS FOR THE CANDIDATE. The proposal's first move for D4 ("report the reuse accounting and let
it decide between a one-liner and a ruling") has now been taken, and it returns the RULING branch — not
because reuse is missing, but because the comparison is a deep value walk of every compiled Wall
(including a curved Wall's whole sample array) on every preview frame. Same root cause as §2.3 from the
other side: the walk reads the editor's `$state`-proxied geometry, and the candidate Walls are compared
against a previous generation's objects. Owner: preview installation / prepared meshes (P26 §3.5),
under the P23B.5 ratchet, which must not be touched.
```

---

## 4. D6 — the falsifier ran and came back NEGATIVE

The preflight (`--dry-run`) now reports the presented-frame cadence of its own **idle rAF loop** — no
fixtures, no drags, no compiles. Pinned runtime, fresh document, offscreen 1500×1000 window:

```text
Electron 35.0.2 / Chromium 134 (offscreen DEV host)   calibration residual 0.168 ms
481 presented frames in 8,000.1 ms
gaps between consecutive presented frames   p50 16.668 ms · p95 17.360 ms · min 7.210 · max 33.304

⇒ The surface paces at 60 Hz when idle. The M1 presentation rows (release end → next presented frame,
  214–292 ms Chrome / 229–350 ms Electron on the curved classes) are therefore NOT measurement-surface
  pacing, and the caveat I expected to write — "every presented-wait row is really the surface floor" —
  does NOT hold. The wait is real in the measured protocol.
```

What the live probe shows inside that window, on one whole-Room action of a **freshly loaded document**
(cold — stated, because it matters):

```text
baseline-restore        120.8 ms  (inclusive; the app's own transient-architecture-baseline teardown)
└ restore-mesh-install  129.2 ms  (wrapping a preparation of { built: 0, reused: 40 })
restore-reactive-write    3.6 ms
restore-project-clone     3.3 ms
```

```text
HONEST BOUNDARY. This is ONE action, cold (the first preparation in the document), in the app's own
Chromium rather than the pinned runtimes — and the M1 session's own `baseline-restore` row for the same
class reads 10.0 / 10.8 ms inclusive per occurrence over 6 occurrences. So the 126–129 ms figure is a
COLD observation and MUST NOT be quoted as steady state; what it establishes is narrower and still
useful: the post-release window contains the app's own baseline restore AND a mesh reinstall, and the
reinstall's dominant term is another whole-generation comparison. The corrections record's "the page's
own post-release work is small next to it" (from `plan-render-model` 8.5 / 9.7 ms) did not consider the
restore path's install, and should.
THE MEASUREMENT THAT SETTLES IT is now available: the four new preparation marks run inside the restore
path too, so a future leg can report the restore's own preparation phase-by-phase in steady state.
```

**THAT MEASUREMENT HAS NOW BEEN TAKEN, AND IT OVERTURNS THIS SECTION'S READING.** The M1 legs were
re-run with the split in place — see `./2026-09-27-M1-release-to-presented-split-record.md`. In
steady state, in protocol, on both runtimes:

```text
restore after the release   0.0 ms p50 / 0.0 p95 in ALL 38 class rows   (3 single-action strays, 0.0 ms)
commit  after the release   0.0 ms p50 / 0.0 p95 in ALL 38 class rows   (no commit mark at all)
restore INSIDE the release  7.0-10.8 ms on whole-Room move (4.7-8.3 % of that release's page work);
                            0.1-3.6 ms on every other class
commit  INSIDE the release  1.0-2.9 ms on whole-Room move; 7.1-28.6 ms on every other class

⇒ The post-release window this section described does NOT contain the restore in steady state. The cold
  120.8 / 129.2 ms pair was the first preparation in a freshly loaded document spanning an action whose
  transient baseline was still being installed; in the protocol the restore is inside the release
  boundary the wait is measured FROM, so it is not a component of the wait at all.
  The wait decomposes instead into: 1.6-5.3 ms of scheduling, the Plan render (17-52 % of the wait),
  and a tail after the page's last attributed mark of 47-78 % (Electron) / 43-59 % (Chrome).
```

---

## 5. What this pass does to the P23B.8 question

```text
THE COMPUTE-BOUND PREREQUISITE IS STILL UNPROVEN, and this pass shows why the three largest measured
terms are not evidence for it:

· D5 (the largest single priceable term, 173.2 / 231.3 ms self per accepted action) is 12.1× read
  amplification plus 2.4 ms of real arithmetic. Moving the arithmetic to another thread moves the same
  traps to another thread's reads — it removes nothing.
· D4's ~400 ms per whole-Room action is six full-generation COMPARISONS at 61–68 ms each, to find 4
  changed Walls. That is a comparison-scope problem with a reuse owner, not a throughput problem, and
  its cheapest fix is to compare less — never to compare elsewhere.
· D6's post-release wait survives the falsifier, so it is real work — and the part of it this pass
  reached is again the mesh reinstall over the same proxied geometry.

No Worker, no WASM, no new cache was added; no product behavior changed beyond DEV-only instruments.
```

---

## 6. Limitations, stated

```text
· One machine, DEV, advisory. Absolutes are session-conditioned (the corrections record measured
  ×0.38–×1.03 between two sessions with no code change); the RATIOS here are the durable part.
· §2.3/§3/§4's live probes ran in the app's own Chromium (Freebuff's Electron panel browser, Chromium
  134-class), NOT in the pinned Chrome for Testing 152 or the M1 Electron host. Ratios transfer;
  absolutes do not. The one exception is §4's cadence, which ran in the M1 runner's own preflight on a
  freshly launched Electron 35.0.2 host.
· §3 is one accepted action and six preparations; §4's restore figures are one COLD action. §2.3's live
  drag is one action with the harness's own 4-move gesture. None of these is a distribution.
· The panel browser throttles rAF when occluded, which is why no cadence claim is made from it.
· New marks are ADDITIVE to the M1 protocol: a future capture carries `mesh-inputs`,
  `mesh-input-validate`, `mesh-room-meshes` and `mesh-build` rows that no earlier capture has, and its
  `mesh-prebuild` self becomes the comparison. A capture pair must therefore be same-head, same-marks.
```

---

## 7. Verification run for this pass (working tree at capture time; it lands with this record)

```text
focused      120 tests / 5 files (snap parity+snap+extent, mesh identity, mesh-identity regression,
             P23B.6 S3 prepared generation) — green before and after the revert
new          8 tests / 2 files — the snap-input probe (inert by default, one entry per miss, input
             shape, result-neutral) and the new `prebuild-stats` row (published, owner-copied,
             inert without the gate)
```

Full-repo gates are reported in the section appended to
`./2026-09-27-pre-P23B.8-follow-up-acceptance-record.md`.
