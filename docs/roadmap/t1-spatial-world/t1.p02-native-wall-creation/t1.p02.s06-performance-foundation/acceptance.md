# T1.P02.S06 — acceptance record: Performance foundation

**Slice:** T1.P02.S06 · **Status:** approved/released; setup and owner-directed Bench 1 recorded;
persistent representation takeover implemented on PR #190 and independently reviewed (round 3:
implementation correctness passes in the reviewed scope; step acceptance withheld). Bench 2 ran as
the owner-approved **diagnostic** pass and remains contaminated/non-acceptance. The owner direction
of 2026-10-26 replaced the formal Bench 3 **for S06** with the decision-driven milestone gate,
which is implemented, independently reviewed and executed; **it passed (15/15 decision rows,
27/27 verdicts, full E5)** and its results and adjudication are in
[S06 milestone gate](#s06-milestone-gate-owner-direction-2026-10-26). Four owner-directed locality
passes are recorded below — the interaction pass, the incremental Plan evaluator, the compiler-delta
pass and its generation-capture fix — the last three independently reviewed. The branch integrates
`main`. S06 is not merged; T3 ownership sign-off remains separate. ·
**Plan:** [implementation-plan.md](./implementation-plan.md) (owns the scope and criteria) ·
**Decision package:** [scale-reconciliation.md](./scale-reconciliation.md) ·
**Phase:** [T1.P02](../README.md) · **Register:** [phase slice register](../README.md#slice-register)

`T1.P02.S06` is an owner-authorized, released child of T1.P02
([record](../../../../reference/decisions/performance-foundation-authorization-2026-10-24.md)).
This record records evidence; it changes no gate state, capability entry or acceptance. It is not the
phase's final gate: its deferred exhaustive proof routes to
[`T1.P02.S04`](../t1.p02.s04-integrated-final-gate/acceptance.md). The criteria stay in the plan.

## Setup step (agent) — evidence so far

**Base and revisions.** Started 2026-10-24 at trusted base
`2215af341a650ac3a99a0fbb36e48de7e901411e` (merged `main`), branch `t1/p02-s06-bench-setup`,
PR #190. Setup commit `619f578e`; review fixes `9a9b3bdc`; PR #189's reconciliation `4b136543`.
The C.2 amendment (the owner's D1–D9 rulings, 2026-10-24) and this record land in the next commit
on the same branch.

**Verification.** At the setup tree (identical to `619f578e`), on Node 26.7: `check:layout-core`,
`check:project-model`, `check:camera-core`, `check` (svelte-check) and `build` pass, and
`npm test` passes 189 files and 2,440 tests, including the heavy and arch lanes. The C.2 amendment
adds inert work counts to `packages/layout-core` (they do nothing without an observer), so the
lanes ran again with it: every `check:*`, `check` and `npm test` (189 files, 2,440 tests) pass.
The final review edits after that run touch only `apps/editor/perf/**`, which the lanes do not
import, and the documentation gate passes on the edited docs. Node 22.11 and 23.7 fail the jsdom
suites (ERR_REQUIRE_ESM; undici zlib) independently of this slice.

**Workloads** (`npm run perf:workloads`; git-ignored cache keyed by inputs, formats and generator
sources). `--verify` passes for grid-S, grid-M and the museum: the digest reproduces and the
id-rewritten copy admits without findings. The C.2 generator change (variant C) made the museum
family stale; regenerating it reproduced every museum, H and D digest below byte for byte.

| Workload | Walls | Openings | Rooms | Placements | Content digest |
| --- | --- | --- | --- | --- | --- |
| grid-S | 24 | 24 | 9 | 0 | `sha256-c681c3a89aa1c39ad185628eed80d3d45af7a462e1fd0a5847939dca65becfc7` |
| grid-M | 112 | 112 | 49 | 0 | `sha256-8b5e18bb070e78647a811c241d070bcdb4353bf23c6886491bce086a4c1017de` |
| grid-L | 420 | 420 | 196 | 0 | `sha256-70e4abb91516146ee296267404b38ee154479b44c302c122a0d14f982d9dcc1c` |
| grid-XL | 840 | 840 | 400 | 0 | `sha256-fc0642456415f5b3283357f90df049ab0b28494dc48350e9369c12f4dd0f4d91` |
| museum | 328 | 137 | 56 | 92 | `sha256-7c0bbcc76ab9935b10ced13f2f00865cefce97fb97fec7a4c7e4ac3b43316ad9` |
| sweep-H3 | 1,000 | 137 | 350 | 236 | `sha256-8c31e2ab4ee8dedae13c894f6e17cd976db158a02d4ffab1edda0b9a35cbd650` |
| sweep-H10 | 3,240 | 137 | 1,330 | 716 | `sha256-b1ad8b97a5152924d4ae6580830d8c7ac899b248ecfa102aa5297a3ec3203248` |
| sweep-D3 | 1,000 | 137 | 350 | 236 | `sha256-aeb968539cb960b44d6f0fc30ed9a35eec1548a02fc6466f817852603cbbdb68` |
| sweep-D10 | 3,240 | 137 | 1,330 | 716 | `sha256-7a7b9526fd5d240cd0b0706937ec04275e10a4c21035df46773ba746b95f4150` |
| sweep-C3 | 965 | 514 | 350 | 236 | `sha256-01ca1587e01d6ea9aeebfb44f553af75657011f63aef894da8c5f049ae9ee3d4` |
| sweep-C10 | 3,065 | 1,774 | 1,330 | 716 | `sha256-01c4d1ad2008a2a0b17e1112e02fc128b5a4e365d7b7c015389878f96d8995ad` |
| realistic-L | — | — | — | — | unrun: needs per-source asset approval and an isolated API stack |

**Censuses E1–E5 — census, not timing.** Full run at the setup tree; E5 rerun at `9a9b3bdc`
with identical results, and again with the C.2 tree (variant C added). Digests as above.

- **E1 (dependency).** Exhaustive at S and M; stratified samples at L (334/420 Walls), XL (114/840)
  and the museum (328/328) within the 600 s bound; no refusals. Median k/N on the museum: length
  0.8 %, angle 1.0 %, move 1.2 % (max 2.6 %), so the H1 premise holds for every edit class.
- **E2 (visibility).** 36 poses over 56 Rooms: median visible fraction 7.1 %, worst 16.1 %
  (Focus wing — enfilade, 9 Rooms). This supports the cell-and-portal proposal.
- **E3 (sharing).** Museum: 92 placements, 5 definitions, 25 unique triples, 471 materials
  created (5.12 per placement). H10/D10: 716 placements and 3,592 materials. A finding for T2,
  which owns `cloneModelScene`.
- **E4 (residency).** Per Stop, texture bytes at RGBA8+mips: median and max 68.9 MiB (17.2 MiB at
  1 B/px) against the 384 MiB laptop-A row. Texture bytes only, never total GPU memory.
- **E5 (irrelevance).** Semantic independence holds at ×3 and ×10 for H and D. Above their I1
  bounds: entity evaluations (slope 1.00 per added entity per move; H1), pair visits (98.03;
  H3), digest bytes per commit (2,324; H2/H7), frozen objects (246; H5) and history bytes per step
  (664; H5). R at H×10 per move: about 2,253–3,379 for compile, 20,274–30,411 for whole-document
  passes. Browser readback at the fixed View: the fixed edit changes 3,120 pixels, and H3 and H10
  differ from ×1 by 0 pixels before and after the edit (D also 0, recorded, not asserted).
  **Variant C (connected, with Openings; C.2).** Semantic independence holds at ×3 and ×10. Per
  added entity per move: H3 pair visits 1,089 (H: 98), every counted pair loop 5,075 (H: 5,268),
  linear Junction lookups 4,027 and cache-key characters 96,738. R at C×10 per move: about
  2,673–4,010 for compile, 24,057–36,086 for whole-document passes. In the browser, one commit at
  C10 visits 4.7 M Room×Opening and 10.9 M Wall×Opening pairs (H10: 0.36 M and 0.89 M). C3 and
  C10 differ from ×1 by 0 pixels at the fixed View, recorded, not asserted.
- **Scale census (D2, C.2).** Node only. 1k Rooms admitted in 2.4 s, 3k in 9.6 s; one per-move
  plan took 3.8 s and 22.6 s; 10k ran out of the 12 GiB heap during admission. Details and
  counts: [decision package F11](./scale-reconciliation.md#7-rulings-and-implementation-2026-10-24).

**Smoke checks — smoke, not evidence.** `perf:bench --smoke` at `9a9b3bdc` (2,149 s, setup 11.7 s,
not contaminated, Chrome 155.0.8059.85). Every flow passes at grid-S, M, L and XL (realistic-L
reported unrun), and E5 and the transferred rows (F1, F10, F13 Preview) pass. The sweep latency
phase fails because the tab crashes at sweep-H10; see
[the decision package](./scale-reconciliation.md#1-what-the-setup-already-shows) (F2). After
that run, the drag flow waits for the Stage to settle before sampling, and each phase keeps its
own Playwright artifacts.

**Harness defects found while implementing C.2, both fixed.**

- That smoke and every earlier browser figure ran on a **Svelte dev-mode build**: `vite-node`'s
  `NODE_ENV=development` reached the bench's `vite build`. The bench now strips it from every
  child and refuses a build with dev markers (decision package F8).
- Rows named **Chrome 153.0.8010.12**: the `Desktop Chrome` device descriptor overrides the user
  agent with Playwright's bundled Chromium version. The launched binary was the installed branded
  Chrome. Rows now record `browser.version()`, 155.0.8059.85, the pinned build (D8).

**Re-smoke at the C.2 tree** (`perf:bench --smoke`, production build, 3,508 s, setup 11.3 s;
contaminated only by load, 5.21 at start, which a smoke does not gate). Every phase passes: grid-S,
M, L and XL (realistic-L reported unrun), E5 over all seven workloads, the sweep latency rows
(museum ×1 and sweep-H10) and the transferred rows. After the final review edits, a grid-S F7 run
re-checked the GPU-timer path and an F13 Preview run the browser label. D4's bounded failure row
was not exercised, because nothing crashed. Single runs, one sample each:

- **Open (F2 cold total).** 0.14 s at S, 0.54 s at M, 5.2 s at L and 21.1 s at XL (admission
  0.46 s at XL). The dev build was not the cause; decision package F9 locates the term.
- **Submission versus GPU (F7, all-visible after Fit).** The browser exposes
  `EXT_disjoint_timer_query_webgl2`, so rows carry GPU time. CPU time inside `render()` per frame
  against GPU time: grid-XL 3D 20.3 ms against 6.0 ms, Plan 20.4 against 4.9 ms; museum 3D 5.9
  against 5.5 ms; sweep-H10 3D 51.2 against 19.2 ms, Plan 40.7 against 14.4 ms. Plan submits as
  many draws as 3D at every grid tier.
- **Compatible bins (one frame).** The grids draw one program in 7 material states: 91–4,681
  draws fall into 7 merge bins. The museum's 1,421 draws fall into 32 merge bins and 900 instance
  bins; sweep-H10's 10,398 into 32 and 6,286.
- **Ownership.** Each accepted commit leaves more live geometries while materials and meshes stay
  constant: +108 at S, +700 at M, +2,968 at L, +6,160 at XL and +6,010 at sweep-H10 per commit.
- **Heap after forced GC.** grid-XL: 344 MiB after the open, 482 MiB after the F3/F4/F8 sequence;
  sweep-H10: 898 and 1,475 MiB. F13 grid-XL: the first edit of a cycle retains about 90 MiB.
- **sweep-H10 F3/F4/F8 completes** on the production build (decision package F12).

**Packages admitted:** none.

**Withdrawn observation.** An earlier smoke run suggested F13 retained about 166 MiB after close
at grid-XL. That was the harness's own reference to the last rendered scene, fixed in `9a9b3bdc`.

## Bench 1 launch

**Frozen command:** `npm run perf:bench --workspace @portfolio/editor -- --label bench-1
--xl-drag-cache warm`, from commit `1c5e530c` (PR #190), on Node 26.7 with the pinned branded
Chrome 155.0.8059.85 and the fresh workloads above. On the owner's direction (2026-10-24) the agent
launched it itself, detached, under `caffeinate -dims`, at 2026-10-25 00:17 local, at a 1-minute
load of 3.22 on AC power. The plan's direction is battery with Low Power Mode off, and Low Power
Mode was off; the manifest records the AC deviation. The machine was briefly on battery during the
grid-L tier (the start and end snapshots both read AC).

## Bench 1 scope change (owner direction, 2026-10-25)

The re-smoke's per-result costs, re-fitted to grid-L's first measured row (1.5× the model), put
the ruled pass at about 25–30 h, most of it sweep-H10's report-only F3/F4/F8. The variance is
small and the counts are deterministic, so the owner directed the agent to stop the pass after
grid-L and run the remaining hard tiers, E5 and the transferred rows as a continuation. grid-XL
and the sweep latency rows are dropped from Bench 1.

**A.7 ruling (owner, 2026-10-25).** `bench-1` (interrupted at the grid-L boundary on the owner's
direction) and `bench-1b` together count as Bench 1, the first of the three passes, with the AC
deviation accepted. No rerun. The owner released the optimize step.

| Invocation | Command | Ran | Result |
| --- | --- | --- | --- |
| `bench-1` (`2026-10-25T04-17-42-938Z-bench-1`) | as frozen above | 00:17–02:18; realistic-L reported unrun, grid-L 7,234 s | stopped by SIGINT at the grid-L boundary (exit 130); not contaminated |
| `bench-1b` (`2026-10-25T06-18-45-011Z-bench-1b`) | `… -- --label bench-1b --tiers grid-M,grid-S --no-sweep-latency` | 02:18–03:53; grid-M 2,555 s, grid-S 1,737 s (after 180 s cool-downs), E5 858 s, transferred rows 148 s | clean (exit 0); not contaminated, not aborted |

Both ran commit `1c5e530c`. Both manifests record a dirty tree: another session edited
`prototypes/production-shell-wireframe/README.md` at 00:58, outside every workspace, the build and
the served product. The pass directories are in the machine's results directory
(`$TMPDIR/biskiq-perf-results/`), outside the repository.

## Bench 1 results (owner-directed; counted under A.7)

Medians with p95 over 10 measured runs per cache state (cold / warm / repeat-use). Budgets are not
judged here; the optimize step compares them against the performance contract.

| Row | grid-S | grid-M | grid-L |
| --- | --- | --- | --- |
| F2 open, admission → first architectural frame (cold) | 143 ms (p95 144) | 522 ms (p95 524) | 5,186 ms (p95 5,216) |
| F2 open (warm / repeat-use) | 28 / 28 ms | 441 / 442 ms | 5,124 / 5,123 ms |
| F2 admission alone (cold) | 36 ms | 70 ms | 219 ms |
| F3 input → matching preview | 14.5 ms (p95 15.7–16.3) | 31.3–31.6 ms (p95 48) | 164–166 ms (p95 216–233) |
| F3 drag commit completion | 24–30 ms (p95 41–56) | 142–144 ms (p95 163–174) | 635–683 ms (p95 717–784) |
| F4 typed length completion | 27–30 ms | 139–141 ms | 636–670 ms |
| F8 Undo completion | 29.4 ms (p95 31) | 95–111 ms (p95 112) | 519–536 ms (p95 637–671) |
| F7 frame interval (orbit) | 16.7 ms (p99 16.8) | 16.7 ms (p99 16.8) | 16.7 ms (p99 16.8) |
| F7 CPU / GPU per frame | 1.0 / 2.0 ms | 2.2 / 2.1 ms | 7.0 / 3.4 ms |
| F13 retained per accepted edit | 0.27 MiB | 1.3 MiB | 6.0–6.2 MiB |

- **Drag at L.** 3,000 inputs per state, all presented, none superseded or refused. Each drag run
  does 62 full compiles (7.3 s) and 61 acceptance compiles (7.2 s); topology pre/post checks
  visit 10.7 M Wall×Wall and 3.1 M Junction×Junction pairs, and cache keys serialize 6.0 G
  characters per run.
- **Ownership.** Each accepted commit leaves +2,968 live geometries at L (3,753 → 30,465 over ten
  commits); materials and meshes stay constant. Heap after the F3/F4/F8 sequence: 400 MiB at L,
  against 147 MiB after the open.
- **F7.** Orbit holds 60 frames/s through L, and the Stage renders every frame at rest (120 of
  120 in the idle window). CPU submission exceeds GPU time from M upward.
- **E5 (browser).** H3 and H10 match ×1 at the fixed View, 0 differing pixels before and after the
  edit; D and C are also 0 (recorded). The edit itself changes 3,120 pixels.
- **Transferred rows.** F1 starter: hub interactive 865 ms cold, 585 ms warm; Stage first frame
  1,148 ms cold. F10 Preview: press to frame 84 ms cold at S, 69 ms at M. F13 Preview: 2.7 MiB
  post-GC growth over 10 enter/exit cycles.
- **Not in Bench 1.** grid-XL and the sweep latency rows (owner direction above); realistic-L
  (unrun, prerequisites unchanged). Their smoke and census figures stay labelled as such above.

## Hand-off: the optimize step (released 2026-10-25)

The owner counted Bench 1 under A.7 and released the optimize step. A fresh agent resumes from
this section.

1. **Owner gate still open.** A ruling on the sweep-H10 drag row for Bench 2 and 3: full method,
   warm only, or one run. It does not block the optimize step.
2. **Characterize (plan C, step 3). Done 2026-10-25:** [characterization.md](./characterization.md)
   gives the budget position, the per-stage split, the named superlinear terms and the refit
   order. Hard misses: F4 and F8 at M and L, F3 at L.
3. **Candidates the evidence names, in matrix order (D.1–D.6), each checked by hand calculation:**
   - whole-document recompiles per move and commit (H1; E5's R of 2,000–36,000 at ×10);
   - the topology gates' Junction×Junction and Wall×Wall loops and the Wall×Opening and
     Room×Opening joins (H3; decision package F10);
   - cache keys that serialize whole collections (`cache-key:chars`, 6.0 G per drag run at L);
   - linear Junction lookups (`lookup:junctions`);
   - live geometries never released after a commit (about 1.3 per mesh per commit);
   - per-mesh submission: 7 merge bins against 2,269 draws at L, CPU above GPU;
   - the Stage rendering every frame at rest (render-on-demand, next to H9);
   - Stage mount: Threlte's Context DOM insertion, about 86 % of the XL open (decision package F9).
4. **Keep.** The correctness lanes, differentials and count oracles. E5 on the optimized revision
   before the diagnostic Bench 2. The diagnostic keeps the hard tiers and real interactions but
   reduces observations; Bench 3 returns to Bench 1's formal hard-tier method, so its passes stay
   comparable.
5. **Pending outside S06.** PR #189's merge as research (D7, its owner); the realistic-L
   prerequisites (D9); the execution-plan lab plan, due before Bench 2 (D6).

## S06 milestone gate (owner direction, 2026-10-26)

**Status: the owner replaced the formal Bench 3 for S06 with a decision-driven milestone.** The
[owning contract](../../../../reference/components/performance.md#s06-milestone-decision-method-owner-amendment-2026-10-26)
is amended to authorize it; every budget, workload, cache-state definition and the original Bench 1
and Bench 2 meanings are unchanged. The milestone is S06 acceptance evidence only and is not
production-scale, rare-tail, grid-XL or ultimate geometry/rendering certification. A later consumer
that needs formal statistics still uses the 10-run method.

**Method.** Each decision row starts at three independent runs and spends one more run at a time
(to 10; F7 to 5) only while it is borderline. A pass requires every run's p95 at or below 75 % of
the budget; a fail requires every run above the budget; at the bound the contract's pooled p95
decides and the instability is recorded. Frame rows pass at the display floor ±0.05 ms. A row that
cannot produce three usable runs by its bound is a failure of evidence, never a pass. The full
method, including why no confidence level or sequential test is invented, is in
`apps/editor/perf/lib/milestone.ts` and the contract amendment.

**Coverage.** F2 cold+warm at S/M; F3 input latency, latest-input age, frame-time p95/p99 and long
tasks, F4 completion and F8 Undo/Redo warm at S/M/L; the per-edit Layout compile at M; F7 warm
p95/p99 and zero long tasks at S/M; F13 cold and repeat-use ten-cycle growth at S/M/L; the full E5
matrix. F13's first measured cycle is a one-time first-load sample for both cold and repeat-use;
steady growth starts at the second measured cycle and is normalised to ten cycles. Cold/repeat-use
F3/F4/F8 are one-run checks; F2 L and F7 L are Target rows; F13 warm is one cycle. These are
recorded, never statistical gates. A.6, the delayed-preview proof, F2 repeat-use, F7 cold/repeat-use,
grid-XL, realistic-L and the sweep latency rows are not measured, are named in the manifest and
rows, and may not be read as passing.

**Implementation and review.** `perf/lib/milestone.ts` owns the pure rule, `perf/lib/profile.ts` the
milestone plan, `perf/lib/browser.ts` the bounded extension, the four flow specs the per-row
verdicts and `perf/bench.ts` the pass-scoped 15-row gate. Two independent read-only reviews and the
first execution found and fixed: the F7 extension assertion, the missing F7 p99 clause, the
unmeasured F3 frame-time clauses, dropped undecided rows, silently short completion samples, the
F13 interval normalisation and first-load baseline, pass-unaware per-flow reports, and missing
completed-run counts. Details and tests are in the
[review handoff](./review-handoff.md#s06-milestone-gate-owner-direction-2026-10-26).

**Verification.** Focused milestone/profile suites pass (24 tests); targeted perf typecheck reaches
only the two pre-existing `registry.ts` Buffer overload errors; a milestone grid-S smoke passes
with F3 frame evidence; real grid-L F13 rows pass at 2.55/2.54 MiB normalised growth after the
baseline fix.

**Environment.** Designated M2, AC power (a recorded deviation from the contract's battery
condition), Low Power Mode off, 1920×1080 CSS at DPR 1, N1, branded Chrome 156.0.8078.48. Chrome
auto-updated from 155.0.8059.85 during the first milestone attempt; that mixed-build attempt was
discarded and the build was re-pinned to 156 with the reason in `perf/chrome-pin.json`. Bench 1 and
Bench 2 remain 155, so every comparison to them is cross-build and labelled as such.

### Execution and adjudication

**Verdict: pass.** The milestone gate ran end to end on the designated machine and all **15 promised
decision-row groups (27 recorded verdicts) passed**. The pass was complete (`aborted: false`), clean
(`contaminated: false`, no contamination entries) and `acceptanceEvidence: true`; E5 ran inside the
same pass over all seven workloads. The product bundle is the frozen candidate `d89554b1`; no
product, Plan, Stage or rendering source changed between it and the measured tree (checked by
`git diff --name-only d89554b1..25d61deb`).

**Provenance.** Pass `2026-10-26T22-49-48-537Z-milestone-s06-156` in
`$HOME/biskiq-perf-results/` (raw results stay outside Git), 22:49:48.557Z–23:33:41.276Z,
**2,632.7 s (43.9 min)**: 13.1 s setup, 360 s cool-down, grid-L 740.9 s, grid-M 335.0 s, grid-S
267.7 s, E5 851.2 s, transferred rows 64.6 s. Product candidate `d89554b1`; benchmark-harness and
manifest commit `25d61deb` (`dirtyTree: false`). Node v26.7.0, macOS 24.6.0, Apple M2 8-core /
16 GiB, 1920×1080 CSS at DPR 1, network N1, branded Chrome **156.0.8078.48** matching
`perf/chrome-pin.json`. Start/end 1-minute load 2.33/4.38; no thermal or performance warning at any
phase boundary; Low Power Mode off; **AC power** (the manifest's only deviation). Workloads were
verified and their digests recorded. Two earlier attempts were discarded and never treated as
evidence: the first exposed the F13 first-load baseline defect (false 10.9 MiB growth), the second
ran across Chrome's auto-update from 155 to 156. A post-pass harness edit corrected only the
manifest's omission wording (it still said drag frame time was unmeasured); no sample, row or
verdict changed, and the measured manifest remains the `25d61deb` artifact.

**Sampling and stopping.** One sample is one independent measured run, never a pointer event. The
plan's minimum is three runs per decision row; a row was extended one independent run at a time
only while its rule was undecided.

| Row group | Independent runs | Stopping decision |
| --- | --- | --- |
| F2 cold and warm, grid-S and grid-M (4 rows) | 3 each | all runs inside 75 % of the budget at run 3; no extension |
| F3 latency/age, F4, F8, F3 frame at grid-S (5 verdicts) | 3 | all pass at run 3 |
| F3 latency/age, F4, F8, F3 frame, per-edit evaluation at grid-M (6 verdicts) | 3 | all pass at run 3 |
| F3 latency/age, F4, F8 at grid-L (4 verdicts) | 3 | all pass at run 3 |
| F7 warm, grid-S and grid-M (2 rows) | **5 each** | first run's p95 was 16.8 / 16.79 ms, above the 16.75 ms frame pass bound but within 0.1 ms of the display floor; extended to the 5-run bound, where the pooled p95 16.7 ms decided **pass** with the instability recorded |
| F13 cold and repeat-use, grid-S/M/L (6 rows) | 1 each (10 measured cycles) | leak-rate check, not a statistical gate: 2.2–2.54 MiB per ten cycles against 10 MiB, geometries and textures back to baseline. One 10-cycle series is decisive at this margin; no extension |
| E5 | 1 browser session | all seven workloads completed in-pass |
| F1 and preview lifecycle | 3 | transferred informational rows |

The 43.9 min total includes E5 and the ten-cycle F13; Bench 2 was 31 min **plus** a separate 12.3-min
E5 rerun (43.3 min) while sampling less per row, so the decision-driven method cost about the same
as the diagnostic and less than a formal 10-run pass.

**Decision rows.** F3 is input→matching-preview, F4 accepted-commit completion and F8 Undo/Redo,
all warm; each figure is the slowest of the three independent run p95s. `EVAL` is the per-edit
Layout compile.

| Tier | F3 (budget) | F4 (budget) | F8 (budget) | F3 frame p95 (budget) | EVAL (budget) |
| --- | --- | --- | --- | --- | --- |
| grid-S | **16.3** (33) | **17.49** (100) | **14.3** (100) | **16.7** (16.7) | — |
| grid-M | **16.3** (50) | **25.51** (100) | **12.21** (100) | **16.8** (20) | **1.3** (8) |
| grid-L | **16.34** (100) | **93.61** (200) | **21.63** (200) | Target row, recorded | — |

Latest-input age p95 is 16.3 / 15.9 / 16.2 ms at S / M / L, inside the same budgets. The L frame
row is not a decision row (Target); its recorded p99 is 33.3 ms (inside Target ≤ 50). It logged 3
long tasks over 50 ms across the three runs, longest 91 ms; because the row aggregates runs and
retains no per-drag split, the Target's ≤ 1 per drag is **not demonstrated** — neither shown to pass
nor shown to fail.

| Row | Observed (p95) | Budget | Headroom | Verdict |
| --- | --- | --- | --- | --- |
| F2 grid-S cold / warm | 172.0 / 91.9 ms | 300 | 43 % / 69 % | **pass** |
| F2 grid-M cold / warm | 565.2 / 501.8 ms | 800 | 29 % / 37 % | **pass** (cold is the nearest decision margin) |
| F7 grid-S / grid-M warm | 16.7 / 16.7 ms pooled; worst run 16.8 | 16.7 | at the display floor | **pass at the 5-run bound**, instability recorded |
| F13 grid-S cold / repeat-use | 2.40 / 2.20 MiB per 10 cycles | 10 | 76 % / 78 % | **pass** |
| F13 grid-M cold / repeat-use | 2.54 / 2.37 MiB per 10 cycles | 10 | 75 % / 76 % | **pass** |
| F13 grid-L cold / repeat-use | 2.50 / 2.49 MiB per 10 cycles | 10 | 75 % / 75 % | **pass** |

**Recorded Target and non-gate rows (not passes of a gate).** F2 grid-L cold 5,064.4 ms (p95
5,132.8) and warm 4,971.7 ms (p95 5,093.2) against the 2.0 s Target — **Target miss**; the 6.0 s hard
budget is met. Admission alone is 290.7 ms cold and 264.3 ms warm. F7 grid-L p95 16.75 ms (3 runs,
0 long tasks) against Target 33 ms — met. F3 grid-L frame: p99 33.3 ms (Target ≤ 50) met; the
≤ 1-long-task-per-drag Target is **not demonstrated** (3 tasks across three runs, no per-run split).
F3 grid-L refused 81 of 360 inputs (the shipped drag
refuses sub-minimum lengths; none was superseded or unresolved). Cold/repeat-use F3/F4/F8 single
runs are recorded checks, not gates; F3 tracks warm within about half a millisecond. F1
`stageFirstFrame` p95 is 1,246 ms.

**E5 correctness and locality.** The same pass ran the full matrix (`E5 browser counts`, exit 0):
six semantic-independence cells, the museum control, and the fixed-view comparison. All six sweep
cells show **0 differing pixels** before and after the fixed edit; the museum positive control
changes **3,120 pixels**, identical to Bench 1, so the check can see a change. Programs (14) and
textures (34) are constant, shadow work is flat (1 map, 24 draws/frame), and D3/D10 match H3/H10.

| Workload | draws/frame | triangles/frame | live geometries | meshes |
| --- | ---: | ---: | ---: | ---: |
| museum (×1) | 1,447 | 1,116,418 | 926 | 1,372 |
| H3 = D3 (×3) | 3,542 | 2,719,638 | 2,186 | 3,353 |
| H10 = D10 (×10) | 10,526 | 8,067,110 | 6,386 | 9,953 |
| C3 (×3) | 4,679 | 2,917,246 | 3,323 | 4,490 |
| C10 (×10) | 15,443 | 8,921,038 | 11,303 | 14,870 |

H10 is 10,526 draws against Bench 1's 10,398 (+1.2 %; museum +1.8 %): the known one-mesh-per-Wall
path (H6), not a new regression and not a pixel failure. Draw calls remain above the 2,500 L Target
at both ×10 variants.

**Memory/lifecycle.** F13 at L: cold raw growth 64.63 MiB and repeat-use 11.00 MiB over ten cycles,
but the steady rate after the one-time first-load step is **2.50 / 2.49 MiB per ten cycles** (2.40
and 2.20 at S, 2.54 and 2.37 at M). The steady baseline is 55.2 MiB, reached by a 53.8 MiB one-time
step from the 1.45 MiB entry, with textures 3→6 and programs 2→4; that step is excluded and the
remaining intervals are normalised to ten cycles. Stage geometries return
to the baseline every cycle (2,409 at L; 547 at M), textures 6, programs 4; DOM nodes 650, listeners
61 and documents 2 are flat at L, and materials 1,850 / meshes 2,269 at peak are constant. Retained
per accepted edit at L is **1.27 MiB** (cold 1.31, warm 1.46), against Bench 1's 6.0–6.2 MiB — a
4.8× reduction. This is within-cycle post-edit retention, not the cross-cycle leak; the leak is the
2.5 MiB / ten-cycle rate. F13 warm is one cycle (8.76 MiB baseline-to-final, 1.46 MiB within-cycle
retention per edit) and is a check, not a rate estimate. The open itself still leaves 137.6 MiB heap at L and the F3/F4/F8 sequence 162.7 MiB
(median), against 147 / 400 MiB in Bench 1.

**Bench 1 → Bench 2 → milestone.** Bench 1 is 10 runs/state at `1c5e530c` on Chrome 155; Bench 2 is
the 3-run diagnostic at `e8cc2fc0` on Chrome 155, a dirty tree, and an aborted E5 completed separately;
the milestone is this pass on Chrome 156. All three ran on AC. Bench 2 medians/maxima and milestone
per-run p95 are different statistics and are not interchangeable.

| Row | Bench 1 | Bench 2 (diagnostic) | Milestone |
| --- | --- | --- | --- |
| F3 L | 164–166 ms (p95 216–233) | 15.5 ms median, max 25.0 | **16.34 p95** (16.2 pooled) |
| F4 L | 636–670 ms | 94–116 median, max 151 | **93.61 p95** (101.06 pooled) |
| F8 L | 519–536 ms | 37–51 median, max 88.5 | **21.63 p95** (21.22 pooled) |
| F3 M | 31.3–31.6 ms (p95 48) | 15.4–15.6, max 16.6 | **16.3 p95** |
| F4 M | 139–141 ms | 24.6–37.5, max 51.8 | **25.51 p95** |
| F8 M | 95–111 ms | 7.4–10.8, max 11.9 | **12.21 p95** |
| F3 S | 14.5 ms (p95 15.7–16.3) | max 16.5 | **16.3 p95** |
| F4 / F8 S | 27–30 / 29.4 ms | max 28.9 / 14.4 | **17.49 / 14.3 p95** |
| F2 L cold | 5,186 ms | 5.16 s | **5,064 ms** (3 runs) |
| F7 L | 16.7 ms (p99 16.8) | 16.7 p95, max 33.3 | **16.75 p95** (3 runs) |
| F13 L per edit | 6.0–6.2 MiB | not comparable (1/2/1 cycles) | **1.27 MiB** (20 edits/cycle, first load excluded) |
| H10 draws | 10,398 | 10,526 | **10,526** |

Methodology and provenance differences that bound the comparison: Chrome 156 vs 155; milestone F13
uses 20 edits per cycle with the first-load cycle excluded, so its 1.27 MiB is a within-cycle rate,
not Bench 1's ten-run p95 of the same rate; Bench 2's F13 was a 1/2/1-cycle leak check and its E5
rerun was a bare Playwright invocation with no manifest; the milestone F2 L is 3 runs, not 10. The
large falls are attributable to the frozen product candidate: its source did not change between
`d89554b1` and the measured tree, and the interaction rows use the same shipped drag, workloads and
budgets; the harness method changes (three-run decisions, frame evidence, F13 cycle definition) are
named above.

**What this does not certify.** This is **S06 milestone acceptance**, not production-scale, grid-XL,
realistic-L or rare-tail certification; the small-sample p95s are not estimates of rare tails. A.6,
the delayed-preview proof, F2 repeat-use, F7 cold/repeat-use, grid-XL, realistic-L and the sweep
latency rows were not measured and are named in the manifest — no omitted row may be read as a
pass. The battery condition of the contract remains untested (all three passes are AC, and the
Bench 1 A.7 ruling accepted that deviation), and the milestone result is therefore certified for
the recorded AC reference condition, not for battery. F13 warm is one cycle; live WebGL contexts
and detached nodes are not captured; the per-edit Layout evaluation is adjudicated at M only; drag
frame time covers the drag window, not idle or the whole session. The composite drag rows retain
each clause's slowest-run p95, its run count and the pooled samples, not the full per-run array; for
a pass the slowest run is the rule's input, but the run-to-run spread of those clauses is not in the
record (F2, F7 and every F13 cycle are retained run by run).

**Remaining performance targets and structural limits.** L cold open is still 5.06 s against the
2.0 s Target with the 6.0 s hard budget met; the open is admission + mount, and the optimization
step did not target it. L draw submission is 10,526–15,443 calls against the 2,500 Target (H6,
one mesh per Wall, deferred). The commit envelope is still whole-document work: at C10 the accepted
commit canonicalises 8.85 MB and reads 6.06 M generated snapshot properties, so F4 grows with
document size (93.61 ms p95 at L against 25.51 at M). F3's L drag logged 3 long tasks across three
runs (91 ms longest), so the per-drag Target is not demonstrated; L frame time is Target, and its p99
33.3 ms is inside it. F2 M cold has only 4.3 % headroom to the 600 ms pass band (29 % to the 800 ms
hard budget) and is the first row a different build or power state could move out of the milestone
band without failing the contract. None of these is a hard-gate breach, and none was addressed by changing product code.

**Decision.** The frozen S06 candidate **satisfies the ratified S06 milestone gate** on the recorded
AC reference condition: every hard S/M/L decision row passes, E5 is correct, memory growth is 4×
inside its budget with stable geometry counts, and the large interaction improvements survive
independent sampling. The L cold-open and draw-call Targets remain open (both missed), and the F3 L
long-task Target is not demonstrated; all three were open before the pass. S06 step acceptance and
T3 ownership sign-off remain separate; nothing is merged or closed.

## Optimize step (D.1–D.6) — implementation state (2026-10-25)

> Historical implementation record through the reconciliation table below. The current
> [persistent takeover](#persistent-representation-takeover) supersedes its complexity claims and
> budget predictions; prior review findings and evidence are preserved as history.


**Owner direction (2026-10-25).** Move to optimization; do not reopen Bench 1, repeat broad
profiling or re-quantify confirmed superlinear behaviour. Bench 1 and Bench 1b jointly count as the
first pass under the A.7 ruling, and its characterization is accepted as the implementation starting
point. H6/H8/H10, WebGPU, a new Plan renderer, HLOD, streaming, new content identity and the
world-scale laboratory stay out of scope.

**Landed in this step (branch `t1/p02-s06-bench-setup`, PR #190):** D.1 (H3), D.2 (H2), D.3 (H1 and
H4) and D.6 (H9). D.5's entity-level structural sharing is deferred, as the plan records. Nothing
below is Bench 2 evidence: every figure is a deterministic Node count, an exact-output differential
or a disposable diagnostic, and each is labelled as such.

### Amended measurement scope — request recorded, not yet ruled

Bench 1 and Bench 1b jointly count as the first of three passes (A.7). On 2026-10-26 the owner
approved **Option A**: Bench 2 is a diagnostic pass (not acceptance evidence), and Bench 3 carries
the formal statistics. The diagnostic cannot discharge a hard-row gate. The formal Bench 3
dispositions below are unchanged; the omissions stay open obligations until the owner rules on the
lean plan.

| Obligation | Formal Bench 3 disposition (diagnostic Bench 2 in brackets) | Why |
| --- | --- | --- |
| Hard S/M/L rows: F2 admission and open, F3, F4, F8, F7, F13, D4, and the per-edit evaluation budget | **Kept unchanged** in Bench 3 — same method, budgets and cache states. **Bench 2 diagnostic:** 3 runs per row, 2 drag/precision samples, 5 Undo/Redo cycles, F2 cold+warm, F7 warm only, F13 1/2/1 cycles × 10 edits; not acceptance evidence | These are the hard budgets; the diagnostic guides the next step but cannot pass or fail a gate |
| `grid-XL` browser timing | **Omitted** from Bench 2/3; the existing grid-XL smoke and census rows stay labelled *probe* | 4–8 h per pass for a Target row that the L row already bounds. Its **hard** clause — no crash, no context loss, no single main-thread block over 1 s, an honest progress/refusal state — stays open and is rechecked by the grid-XL smoke and the T1.P02.S04 gate |
| Sweep latency rows (H3/H10/D3/D10 latency, incl. F3/F4/F8 at sweep-H10) | **Omitted** from Bench 2/3 | 20+ h per pass, mostly the report-only F3/F4/F8 leg; E5 already carries the semantic-independence and pixel evidence at ×3/×10 |
| E5 (browser, all seven workloads) | **Kept in full** — E5 on the optimized revision, including the diagnostic Bench 2 | The correctness differential the optimize step must not lose |
| realistic-L | Stays unrun (prerequisites unchanged, D9) | Unchanged |

**Approved structure (2026-10-26).** Bench 2 is the diagnostic pass, counts as the second authorized
pass and **cannot discharge a statistical acceptance gate**. Bench 3 runs the hard S/M/L tiers at
Bench 1's method with E5; grid-XL timing and the sweep latency rows remain deferred to the
T1.P02.S04 exhaustive gate, not waived. The [strategy section](./review-handoff.md#bench-23-strategy-implemented-diagnostic-bench-2-2026-10-26)
records the implemented diagnostic profile, its omissions and the still-unratified lean Bench 3 plan.

### D.1 / H3 — repeated work inside the compile

**Changes.** Cache keys are built once from their parts and embed nested keys by reference instead
of re-serializing and re-escaping them (`layout-geometry-keys.ts`); the Room × Opening,
Wall × Opening, Wall × query-AABB and face × Room joins are id-indexed (`layout-geometry.ts`,
`layout-opening-set.ts`); the topology gate's Junction × Junction and Wall × Wall loops, the
curve-crossing gate and the plan-box lookups are indexed (`layout-plan-box-index.ts`,
`layout-wall-first-precision.ts`, `layout-junction-identity.ts`); the room-path compile no longer
recomputes segment and opening dependencies per query record.

**Differential — exact, and recorded here so it is auditable from the record.** A digest of each
workload's compiled output with **every `cacheKey` removed** (`probe-d1-differential.ts`) is
identical at the pre-change revision (`c4ce6c83`) and this tree:

| Workload | Facts digest (both revisions) |
| --- | --- |
| grid-S | `91b50932995f…` |
| grid-M | `eb25da47ba61…` |
| grid-L | `d7becd96a605…` |
| museum | `5fdfef03dabd…` |
| sweep-H3 | `37825f6ef6b4…` |
| sweep-D3 | `ad98701a54a4…` |
| sweep-C3 | `0eaa7b14afa2…` |

Those seven are the workloads the probe compiles (the four larger sweep and XL documents are not
cached in this tree). Key **values** changed in encoding only. The **consumer inventory** the plan
requires: `apps/editor/src/**` reads `.cacheKey` nowhere (0 matches); the only consumers are
layout-core's own geometry and the two observation digests below.

**Counts, grid-L, Node** (`probe-d1-differential.ts`, one sample per revision, same probe both
trees; durations are single-sample and run-to-run variance is a few per cent):

| Count | Before | After |
| --- | --- | --- |
| Compile, all passes (`totalMs`) | 200.0 ms | 95.3 ms |
| `cache-key:chars` | 97.4 M | 17.0 M |
| Cache keys in the output | 24,616 | 24,616 (encoding, not count) |
| Join visits (Room × Opening + Wall × Opening + Wall × AABB + object × Room) | 429,552 | 1,420 |
| Topology Wall × Wall pairs | 87,990 | 1,174 |
| Topology Junction × Junction pairs | 25,200 | 0 |
| Topology curve pairs | 87,990 | 1,174 |
| `lookup:junctions` | 567,000 | 2,520 (2 per Wall, no scan) |
| Topology gate | 40.2 ms | 5.8 ms |
| Opening set | 2.4 ms | 1.7 ms |

Two labels changed meaning and are not one series: `pairs:wall-wall`, `pairs:wall-wall-curve` and
`pairs:junction-junction` now count **unique pairs handed to the rule** (the old loops counted every
visited pair), and `lookup:junctions` now counts **identity lookups** (2 per Wall) instead of scan
visits. The pre-change figures were re-measured with the same probe in the same units, so the pairs
above are comparable.

**Hand calculation against Bench 1.** Bench 1's L compile was 118 ms of a 164 ms move
(characterization §2); halving it puts the compile at ~59 ms and the indexed topology checks (27 ms
at L, exponent ≈ 1.9) at a few ms. Predicted F3 at L ≈ 70–90 ms against the 100 ms hard row (was
216–233 ms p95). Confirmed only by the formal Bench 3 (the diagnostic Bench 2 can guide but cannot
confirm).

### D.2 / H2 — one check per fact on the accept path

**Changes.** Admission (`units/acceptance.ts`) drops a post-normalization unit-revision rehash that
could not disagree with the values normalization had just stamped, and serializes the envelope from
the value validation returned (`serializeValidatedProjectEnvelope`) instead of validating it again
to trust it; the dependency-lock check reuses the envelope digest admission already computed. Stage
admission (`source-admission.ts`) prepares the **validated** envelope
(`prepareValidatedUnitRuntime`) instead of validating the same bytes twice.

**Counts, the admission pair of one accepted result at grid-L, Node** (`probe-d2-accept.ts`, one
sample per revision, same probe both trees). It measures the adapter's `admit` plus the host
admission half over one unchanged grid-L envelope: no planner, no candidate clone, no compile
before admission.

| Count | Before | After |
| --- | --- | --- |
| Envelope validations | 5 | 3 |
| Canonical digest passes | 13 | 7 |
| Digested bytes | 4.08 MB | 2.45 MB |
| Envelope serializations | 1 | 1 |
| Runtime preparations / compiles in admission | 1 / 1 | 1 / 1 |
| Adapter admission | 31.9 ms | 18.6 ms |
| Host admission | 255.7 ms | 116.3 ms |
| Admission total | 297.1 ms | 137.9 ms |

Most of that fall is D.1's compile (the same probe reports the compile span 250.4 → 118.6 ms; the
D.1 probe's 200.0 → 95.3 ms is a different measurement — seven compiles in one process, layout-core
warm, versus the first compile in a cold process here). **One duplicate compile per accepted result
remains** (planner, then admission) — see the risk table.

### D.4 / H5 — unit-level structural sharing

**Changes.** `AcceptanceSourceAdapter` gains an optional, adapter-owned `shareUnchanged(captured,
baseline)`; the unit adapter implements it on **unit identity**: the data hashes to the same content
revision *and* the header carries the same `unitId`, `formatVersion` and `domain` (the revision
covers `data` only, so it alone is not the whole unit). Lock entries are shared only when the
identity key, revision, required capabilities and byte pin all match. The coordinator's capture
therefore freezes what it was handed instead of `structuredClone`-ing the whole source — including
its several-megabyte canonical string — on every accepted result.

**Differential and counts**, grid-L, Node (`probe-h5-capture.ts`; 10 tests in
`tests/lib/authoring/f4-structural-sharing.test.ts`):

- capture clone per accept: **1 → 0** (`f4:clone` 1 in the copy arm, 0 in the share arm);
- capture step: **2.5 ms → 0.5 ms** (single sample);
- four of five units (Scene, Camera, Experience, Resources for a Layout edit) are shared by identity,
  so a 100-entry history holds one copy of them;
- **null result:** `f4:freeze-object` does *not* fall at grid-L (2,927 both arms) because the frozen
  graph is dominated by the one rebuilt Layout unit. H5's predicted freeze reduction is therefore
  unproven; the measured gain is the clone and the retained memory it removes;
- `serializeProjectEnvelope(shared)` equals the recorded `canonicalJson` byte for byte and
  `computeEnvelopeSourceContentId(shared)` equals the recorded content id;
- falsifiers: a unit whose data changed is never shared even when its header is left stale; a header
  whose `unitId` changed while the data did not is never shared; a lock entry whose capability or pin
  changed while its revision did not is never shared; two different projects are never shared.

### D.3 / H1 — the incremental compile (landed)

**Changes.** `createLayoutCompileSession` / `withLayoutCompileSession` (`packages/layout-core/src/layout-geometry.ts`, `layout-geometry-reuse.ts`): the canonical compiler takes an optional retained store. Each Wall, Junction, Room source and compiled object and Room keeps the value it produced plus the authored inputs it was computed from; an entity whose inputs are unchanged is installed **by reference**. There is one compiler and one assembly, so a session result is the cold result by construction rather than by a second implementation.

Consumers: the layout planners share one process-local session (`adapters/layout/precision.ts`); a Stage host keeps one for its lifetime (`stage/host-acceptance.ts`); `admitSource` / `prepareValidatedUnitRuntime` take it as an optional argument, and boot, Preview and the visitor runtime pass nothing.

**Keys — the prerequisites review had carried forward are landed.** Retention is proved by keys, so each key now names everything its compiled value reads:

- an Opening's key embeds its host Wall's **geometry** (centerline, thickness, height, Floor datum), not only its identity;
- a Room's key carries the Floor id and elevation, the document's first-Wall thickness fallback, and whether a sampling derivation was supplied;
- a Junction's key carries the Floor id and elevation as well as its point and legs;
- the plan-box index tests inversion **per axis**, so a box inverted on both axes (positive span, negative extent) is kept instead of silently dropped, and a direct index suite pins it.

The two `p23b4` observation digests were re-pinned in `1c003057` because the Opening key's value changed: the sampled fixtures' `compiled` digests moved `6b5f6c5c…` → `1999efc1…` and `a386d7f6…` → `2c25ca62…`, and every verdict string stayed `topology=admitted openingIssues=[] compileIssues=[]`.

**Consumer inventory update.** `apps/editor/src/**` now reads `.cacheKey` for the first time: the retained Wall and object representations key their meshes on the compiled Wall/object key and on the Junction keys at a Wall's ends. The keys are therefore load-bearing for rendered output as well as for compile retention.

**Differential.** `t1s06-incremental-compile.test.ts` compares a session compile with `compileWallFirstLayoutGeometry` **with every `cacheKey` included** across the three invalidation arms (own authored fields, host geometry, neighbour identity), plus the Floor datum, a first-Wall thickness edit and a cross-document session. Each key line was falsified by removing it and watching the differential fail; the Room fallback-thickness and Junction Floor-datum cases were both caught that way.

**Counts** (`probe-h1-incremental.ts`; deterministic counts, single-sample durations labelled diagnostic):

| Workload | Entities | Cold compile (diagnostic) | Evaluated per edit (24-edit average) | Reused | Cache-key chars: cold → per edit |
| --- | --- | --- | --- | --- | --- |
| grid-S | 49 | 15.8 ms | 15.5 | 34 | 428 k → 130 k (3.3×) |
| grid-M | 225 | 23.0 ms | 12.8 | 212 | 2.84 M → 172 k (16.5×) |
| grid-L | 841 | 100.0 ms | 13.3 | 828 | 17.1 M → 440 k (38.9×) |
| museum | 771 | 57.2 ms | 12.3 | 759 | 6.30 M → 134 k (46.9×) |

The evaluated set is a property of the edit's neighbourhood, not of the document: 13.3 entities at L against 841 (63×), and the same 13.3 at M where the document has 100 Rooms. Cache-key characters fall 38.9× at L, and the ratio grows with document size — the direction I1 asks for.

**Store bounds and lifetime.** A store holds at most the current document's units: every compile prunes the ids the new document no longer contains, and `released()` reports how many went. Three stores exist — the Stage host's (local to the host closure, released with it), the planners' (module-level, so it holds the last planned document's units after that document closes; bounded by one document, never accumulating across documents, and not observable by any consumer), and one created per probe or test. This is an F13 attribution note, not an accumulating resource: no store grows with edit count or with documents opened, and none of them retains a superseded compiled value — the units are the current values.

**What remains O(N), precisely.** A session still visits every entity once to compare its authored inputs (3.6 ms of an unchanged recompile at L, ≈ 4.3 µs per entity, so ≈ 45 ms at 10 k Rooms and ≈ 450 ms at 100 k). The cause is the authored document: each candidate is a deep clone, so unchanged entities are *equal but not identical*, and proving equality means walking them. Removing that term needs entity-level structural sharing — a candidate that shares unchanged entities by reference — which the plan defers beyond S06. Assembling the compiled snapshot (pushing every entity's records into fresh arrays) is also O(N) pointer work at a much smaller constant (≈ 0.2 ms at L).

### D.3 / H4 — retained Stage representation (landed)

**Changes.** `lib/render/layout-wall-representation.ts` and `lib/render/layout-object-representation.ts` each own one imperative subtree: one mesh per compiled Wall and per compiled object, keyed by the entity's `cacheKey` (plus the Junction keys at a Wall's ends), swapped in place, released in the same update, with materials created once for the representation's lifetime. Room floor and ceiling `Shape`s are retained by Room key in the shell. The shell mounts each subtree once (`<T is={…} />`), so what used to be one Svelte component pair per drawn entity is now one object.

Two defects were found while landing it and are fixed here:

- assigning `children[index] = mesh` instead of attaching through `add()` left `parent` unset, which silently disabled `removeFromParent()` and leaked the mesh — `attachAt()` plus `parent` assertions in both suites;
- the shell's update effect returned `dispose()`, and Svelte runs a returned cleanup before each re-run, so every compile would have disposed the representation and then updated a disposed one — update and teardown are separate effects, pinned by the boundary test.

**Counts** (`probe-h4-representation.ts`, ten sequential single-Junction edits, throws on violation):

| Workload | Walls | Wall meshes rebuilt per edit | Meshes retained per edit | Live meshes after 10 edits | Geometries built / disposed |
| --- | --- | --- | --- | --- | --- |
| grid-S | 24 | 10.2 | 14 | 24 | 126 / 126 |
| grid-M | 112 | 11.7 | 100 | 112 | 229 / 229 |
| grid-L | 420 | 12.7 | 407 | 420 | 547 / 547 |
| museum | 328 | 10.0 | 318 | 328 | 428 / 428 |

The chained grid plans re-miter along the chain (12.7 of 420 at L); on the isolated-cell fixture the bound is 4. Either way the mesh population stays one per entity and the geometry ledger balances — F13's *"geometries back to baseline"* clause in count form.

**Object coverage gap, recorded.** The retained-cache workloads carry **no Layout objects** (their 3-D content is Scene placements), so `layout-object-representation.ts` has fixture-level evidence only: 30 objects at S, one mesh each, one shared material, `built = 1` for a one-object move, `disposed = 1` per release, buffers equal to a from-scratch build. Bench 2's E5 rows will not close that either; it needs a workload with Layout objects, which is a workload change, not an S06 one.

### D.6 / H9 — shadow and idle rendering (landed)

`lib/render/shadow-invalidation.ts` owns the Stage's shadow-map decision: `autoUpdate = false`, one pass per reported dependency change, `needsUpdate` on mount and on `webglcontextrestored`. `StageShadowTriggers.svelte` reports the compiled `geometry`, the resolved `scene`, the Room registry and `modelUrls`; the camera is deliberately not a trigger.

Two conservative arms keep correctness where an exact trigger cannot be established:

- a Scene that carries a **model entity** keeps today's per-frame updates, because a parsed model's meshes arrive after its URL and that arrival is not observable at this boundary;
- an **animated caster** would set the same mode; no Stage caster animates today.

**Idle rendering.** The camera realizer's task invalidated every frame it ran, which is why Bench 1 counted 120 of 120 idle frames. It no longer invalidates itself: a new evaluation asks for one frame, and every other image-changing input invalidates through Threlte's own reactivity.

**Oracle.** `shadow-invalidation.test.ts` proves, with a fake shadow map that follows three's own contract: one pass on mount, **zero** across 60 orbit frames, one per trigger after coalescing, six maps for a point light, zero passes with no casting light, mode switching, context restore, shared ownership across mounts, and restore on dispose. What is **not** run is the plan's **framebuffer differential** (the same orbit image under always-update and under invalidation, and after every trigger). It needs the browser, so it is an explicit Bench 2 E5 obligation below, not a claimed pass.

### F4 compile hand-over — resolved without a new contract

The previous record's open decision asked whether an adapter may attest the acceptance proof so the host reuses the planner's compile. **That contract change is not needed and was not made.** Admission's compile is now the same compiler over the session's retained store, so the second compile per accepted result is ≈ 6 ms at L instead of ≈ 95–170 ms, with no new authority and no unchecked attestation. The one shared-authority surface that changed is an **optional parameter**: `prepareValidatedUnitRuntime(validated, sceneOptions, compileSession?)` and `admitSource(input, context, { compileSession })`. Both keep their validating entry points as the only public meaning, and a caller that passes nothing keeps the cold compile. **T3 review is required for those two signatures.**

### Corrected ownership

The earlier record called `packages/layout-core/**` T2-owned. **It is T1-owned under S06.** The T3-owned surfaces this step touches are `packages/project-model/src/units/**` (the optional session on `prepareValidatedUnitRuntime`), the editor's Stage admission (`stage/source-admission.ts`, `stage/host-acceptance.ts`), and the shared visitor/Stage rendering files (`visitor/VisitorLayoutShell.svelte`, `authoring/stage/shell/**`, `lib/render/**`). No canonical geometry, authored format, selection/preview semantic, visitor isolation rule or refusal code changed.

### Outstanding obligations — disposition

| Obligation | State at this tree | Where it closes |
| --- | --- | --- |
| Per-edit Layout evaluation ≤ 8 ms M / ≤ 16 ms L (hard) | **predicted met**: per-edit compile 4.9 ms at M and 5.7–6.5 ms at L (Node diagnostic) against 23 / 100 ms cold | Bench 3 F3/F4; diagnostic Bench 2 guides |
| F13 "geometries back to baseline" (hard) | **structurally met and counted**: 547 built = 547 disposed, one live geometry per Wall | Bench 3 F13; diagnostic Bench 2 checks |
| F13 ≤ 5 MiB retained per accepted edit (hard) | **predicted met**: the representation no longer rebuilds or accumulates the document; heap attribution is browser-only | Bench 3 F13; diagnostic Bench 2 checks |
| F2 open at L (Target ≤ 2.0 s) | **predicted ≈ 1.8–2.6 s**, not the 500 ms engineering objective: the mount population is still one component per Room surface and portal | next mount batch + Bench 3 F2 |
| F3 ≤ 100 ms p95 L, F4 ≤ 200 ms, F8 ≤ 200 ms (hard) | **predicted met** (≈ 40–60 / 80–120 / 80–120 ms) — predictions, not evidence | Bench 3; diagnostic Bench 2 guides |
| grid-XL hard clause: no crash, no > 1 s main-thread block, honest progress/refusal | **open, unchanged**; the *timing* omission is the proposed scope ruling, the functional clause is not omitted | grid-XL smoke + `T1.P02.S04` gate |
| H9 framebuffer differential | **open**: the count oracle is landed, the image comparison is not run | Bench 2 E5 |
| E5 semantic independence, browser, 7 workloads | **open for this revision** | Bench 2 |
| realistic-L | unrun, prerequisites unchanged (D9) | unchanged |
| H10 and sweep latency omission | **needs the owner ruling recorded above**; this table waives nothing | owner |

### Reconciliation of every review finding

**Previously fixed → preserved.** The D.1/D.2/D.4 corrections recorded in `review-handoff.md` at `245dd9a4` are untouched and their falsifiers still run: the sharing predicate compares the whole unit header and every lock field; the Room × Opening join restores document order and multiplicity; the Junction sweep falls back to exhaustive enumeration on a non-finite coordinate; the plan-box index keeps inverted boxes in `wide` and restarts its stamp; pair counts count unique pairs; the H5 probe measures the coordinator's real capture.

**Newly identified → fixed in this step.**

| Finding | Severity | Disposition |
| --- | --- | --- |
| A Room's compiled `wallThickness` falls back to the document's first Wall, which no Room key named, so editing that Wall left every other Room stale | BLOCKER | **Fixed** + falsifier |
| A Junction's key omitted the Floor id (compiled id) and elevation (bounds), and a Room's key omitted the Floor id and the sampling-derivation flag | BLOCKER | **Fixed** + falsifiers |
| The shell's update effect disposed the representation on every re-run, so the first edit would have thrown | BLOCKER | **Fixed** + boundary assertion |
| Shadow triggers ignored the Room registry, and had no safe mode for a model whose meshes arrive after its URL | MAJOR | **Fixed**: `rooms` is a trigger; a Scene with a model entity keeps per-frame updates |
| The shadow mode could not change after mount, and two mounts could fight over one shadow map | MAJOR | **Fixed**: `setAlwaysUpdate`, shared ref-counted controller |
| Pass/map counters over- and under-counted (a pass with no casting light; a point light is six maps) | MINOR | **Fixed** |
| The room-derived representation path created and disposed a material factory on every compile | MINOR | **Fixed**: skipped when no Room carries wall detail |
| The Wall representation resolved tints through a Room map it never used (a Wall's mesh carries its own id as `roomId`) | MINOR | **Fixed**: neutral tint constant, behaviour identical to the old factory call |
| The H1 probe printed the cold cache-key count as "incremental" | MINOR | **Fixed**: measures the incremental passes |
| The H4 probe printed without failing | MINOR | **Fixed**: throws on a whole-document rebuild or an unbalanced ledger |
| The doubly inverted box had no direct test | MINOR | **Fixed**: index suite with 4 cases |
| Retention keys' preconditions (sampling derivation is process-constant; the Junction resolver is pure in the key's facts; `sameAuthored` is total on plain records) were undocumented | MINOR | **Documented** in the modules that rely on them |

**Outstanding → owner decision.** The amended measurement scope (above, still unruled); the sweep-H10 drag-row method; realistic-L's prerequisites; and whether the imperative Room-surface/portal subtree — the remaining mount cost — is S06's next batch or a follow-on slice.

## Persistent representation takeover

**Current independent-review boundary.** This is the owner-directed continuation from pushed
764175e0 on the same branch and PR #190. Runtime changes are d47c25e1, 5cdccb79 and 48126338;
the bounded comparison and corrected counter definitions are bd443412 and its follow-up.
No new source format, persistent content identity, F4 acceptance authority, PR, merge, Bench 2,
slice acceptance or independent-review verdict is claimed.

The pre-takeover “Fundamental Computational Architecture Optimization” claims are withdrawn:
native slices were linear, Map copies and BVH clones were linear, chunk directories and flattened
outputs were linear, and accepted-node/evaluation slopes did not account for them. Whole-document
copying was an implementation choice, not a mathematical requirement of immutable F4 snapshots.
The earlier unsupported HAMT ratios, gesture percentages and OP benefit forecasts are not evidence.

### Implemented changes and competing designs

The [architecture dossier](../../broad-research/spatial-computation-architecture.md) owns the
source-level audit, competing persistent/spatial/dataflow representations and complete cost model.
The selected combination is deliberately small: blocked persistent vectors, augmented persistent
AVL maps, shared static ID/incidence directories, current-source views, fat spatial partitions
with reinsertion, retained materialized views, lazy flat adapters and session-owned historical roots.

This replaces the BVH8 and flat chunk-directory implementation rather than defending it. Fixed
refit, adaptive centroid and adaptive four-extrema policies are compared. HAMT/CHAMP, RRB/B+ trees,
page COW, modification boxes, overlays/MVCC, event journals, dynamic AABB/R* trees, priority search
structures and four-dimensional dominance reporting were evaluated analytically. Their comparison
status and space/update tradeoffs are explicit; no unmeasured library speed rankings remain.

In particular, exact rectangle overlap can be expressed as 4D dominance. Stronger reporting bounds
exist. The selected index guarantees logarithmic maintenance paths, **not** logarithmic queries
for arbitrary distributions. This remains a measured engineering choice rather than an optimality
or impossibility claim.

### Source-level work and measured operations

The [checked-in evidence](./evidence/persistent-2026-10-25/README.md) contains the exact before/after
work tables, all timing samples, allocation estimates, full counter maps, retained heap observations,
oracle digests and reproduction commands. It identifies the exact measured revision and machine.
It is bounded Node evidence, not the owner-run benchmark or product budget acceptance.

The principal 100,002-entity Room fixture has 7,143 Rooms, 28,572 Walls, 28,572 Junctions,
14,286 Openings and 21,429 objects, using the existing seeded curve/profile/object mix. One operation
includes candidate planning, certification, index installation, compilation and a one-Wall/query read.
The second 100,000-entity fixture has 31,250 real Walls, 62,500 Junctions and 6,250 Windows, retaining
seeded curves in some cells. Its target Wall hosts a Window. These are separate shapes and affected
outputs, not interchangeable points on a single timing curve.

For the Room fixture, a local move at the base copied 57,144 source slots, 171,432 Map entries,
14,286 walk slots, 1,386,774 spatial buffer bytes plus 18,724 scratch bytes, 2,287,343 query slots
and 92,859 compiled/list slots. The retained path materializes none of those complete collections:
it copies 512 bounded vector slots and allocates 215 map nodes and 161 vector nodes. Those
allocations and path reads are reported; they are not disguised as zero work.

The semantic work for that edit is **three Walls, two Junctions, two Openings and one Room**:
eight evaluations per compile, not “two or three entities in total.” The accepted flow still
runs two incremental compiles in distinct planner/Stage stores. It does not install an unchecked
planner result as authoritative source.

Small local rows include Wall/object mesh installation; the larger rows omit representation
construction/installation. The accepted rows include real F4 preparation/capture, Layout admission,
unit normalization/hashing, revision/history creation, Stage admission and imperative installation.
Full Room Svelte templates, frame traversal, draw submission and GPU execution are not measured.
The accepted fixtures have empty other domain payloads and an empty dependency lock: their times
do not establish locality for Scene/Camera preparation, large reference closure or resource-heavy
projects. The dossier models those remaining cross-domain terms explicitly.

### What the counters prove

- Array/Map/buffer copies are reported in their own units. Entity evaluations and legacy pass
  counts exclude them. The old E5 whole-pass ratio was not total work and has been removed.
- E5's index traversal column now uses every tested node bound, including rejected children.
  Raw legacy node-visit counts remain available and cannot be compared as the same unit.
- Entry, irregular scan, result, radix read/write and bucket-write counters cover query work.
  Balanced height alone does not prove selectivity.
- Native source materialization, Layout parse entries, cloned property slots, canonical UTF-16
  assembly, UTF-8/digest bytes, explicit typed buffer copies and renderer buffer copies remain visible.
- Logical node/slot counts do not specify V8 object size or every VM allocation. The 4 KiB V8
  allocation sampler estimates the complete counted window, including observer/profiler overhead;
  it is not an exact allocation-byte oracle. Unobserved whole-operation timings include uncounted
  engine work. Inclusive spans are not summed as disjoint time.
- Serialization-call counts do not measure bytes. The source strings retained by history are
  not measured heap by Buffer.byteLength. Heap/external/array-buffer/RSS readings and GC probe
  reachability are reported separately.

### Correctness, history and lifecycle

Every successful replay compares exact ordered geometry, query records, cache keys and issues
against a cold canonical compile in a separate process over the exact final authored JSON.
Cross-revision digests must match too; accepted rows also compare the existing source-content ID
and the SHA-256 of the serialized envelope. Moving the cold oracle to a separate process avoids
a verification peak holding two full compiler graphs. The earlier instrumentation replacement
bug and in-process oracle OOM attempts were discarded; they are not successful evidence rows.

The focused falsifiers preserve and extend the prior tests:

- Persistent vector/map branches, non-power-of-two lengths, frozen 100,000-slot borrowed roots,
  map deletion/rotations and bounded clone handoff. Borrowed-range diff and proof visits are
  independently bounded to 32 slots after a one-slot edit.
- 2,000 long moves, 2,000 insert/remove/irregular transitions, historical spatial isolation,
  fixed-refit degradation, equal-centroid slabs and large sorted result populations.
- Repeated real-geometry cold differentials; previously absent spatial dependencies and refusal
  classes remain covered by the swept-bounds and canonical planner suites.
- Known immutable compile roots restore without entity traversal, including membership-changing
  histories and branches. The snapshot directory is session-local; reset is cold.
- A shallow freeze, accessor, exotic object, modified sampler or mutable-then-frozen parser output
  cannot mint the required reuse proof. Strict codec reference checks still reject a removed
  Junction even when its referencing Walls are cached.
- Stage sealing preserves deep generated immutability without forcing lazy arrays. Junction
  incidence participates in Wall mesh diffs. Existing renderer tests check release/dispose,
  deletion, replacement and stable material ownership.
- The complete F2/F4, dependency-lock, resource-staging/lifecycle, stale/ABA/refusal, source byte
  identity, historical restoration and visitor/public isolation suites remain green.

The 110-edit bounded history replay retains the actual 100-entry coordinator policy and probes
ten early source roots after GC. The evidence reports which roots remain, including a fixture-held
initial baseline where applicable. This is reachability evidence, not a claim that all history,
compiled geometry or canonical strings cost zero memory.

### Remaining costs and precise ownership boundaries

| Concern | Current disposition |
| --- | --- |
| Local persistent storage / compiled aggregates | No global container copy on the demonstrated certified Wall path; O(k log N + affected geometry + spatial tests/results) |
| Spatial reporting | Tests can still be Theta(N); overlap/irregular/output populations are counted. A stronger dynamic dominance index remains an internal alternative |
| Accepted Layout source | Changed native arrays are captured/materialized; codec collection/reference checks remain global. Immutable normalized entities share safely. Replacing the admitted native-source/read boundary requires a precise T3 ownership decision |
| Existing canonical identity | Changed Layout + envelope still stream flat canonical SHA-256 bytes and retain source JSON. Merkle identity is different and is not installed |
| Historical restoration | Known compile roots restore in constant root work across membership changes; accepted identity/JSON proofs are reused. Membership-changing representation reconciliation still has a full fallback |
| Cold or uncertain operations | Arbitrary input, absent/expired lineage, ambiguous numeric certificate, global datums and topology changes retain canonical fallback costs |
| Stage / render | Ordinary Wall buffers update locally. Whole Room/portal/template consumers and full frame/draw costs remain unproven and sometimes linear |
| Other runtime / closure | Camera projection, Scene resolution and lock/reference preparation still traverse their inputs. A T3 cache/read-set decision must include options and external dependency epochs; Layout-only timing does not discharge it |
| Owner hypotheses | OP-1 inverse journal, OP-2 identity/Save migration and OP-3 batching are hypotheses, with corrected benefits and scope in the dossier, not ratified solutions |
| Shared review | T3 must review immutable capture/codec interaction, qualified handoff and Stage admission; shared renderer compatibility needs T2/T3 review |
| Product acceptance | Existing measurement-scope questions, grid-XL functional clause, browser semantic/framebuffer work and owner-run Bench 2/3 remain open |

Source immutability, authoritative accepted source, canonical byte identity, full JSON output and
rendering are different constraints. This implementation removes avoidable work without silently
changing any of their contracts. No Rust/WASM, inverse journal, serialized ID or Merkle format was
introduced.

### Verification and review status

The complete editor suite passes **202 files / 2,524 tests**. The architecture lane passes
22 files / 180 tests; the heavy lane passes 11 files / 138 tests. Layout-core, project-model and
camera-core checks, editor check (zero errors/warnings) and build pass. Exact commands, revisions
and final documentation-gate rerun are in the evidence directory.

Earlier independent reviews remain recorded in [review-handoff.md](./review-handoff.md), and the
[independent-review map](./review-handoff.md#current-independent-review-boundary) carries review
round 3 on the persistent algorithms: two substantiated findings fixed with falsifiers, the rest
documented preconditions, no expensive performance work re-run. Its verdict is PASS for
implementation correctness in the reviewed scope and WITHHOLD for step acceptance until the diagnostic
Bench 2 and the formal Bench 3.

### Diagnostic Bench 2 profile (owner-approved, 2026-10-26)

- **Decision.** Bench 2 is a diagnostic pass, not acceptance evidence, and counts as the second
  authorized pass. It cannot discharge a statistical gate; Bench 3 carries the formal method.
- **Profile.** `PERF_PROFILE=diagnostic` (or `perf:bench --profile diagnostic`): 3 measured runs per
  row, 2 drag/precision samples, 5 Undo/Redo cycles, F2 cold+warm, F3/F4/F8 cold 1/warm 3/repeat-use
  1, F7 warm only, F13 cold 1/warm 2/repeat-use 1 cycles at 10 edits, traces at grid-L only, no A.6
  or delayed-preview proof, full E5. Real chooser, inputs, preview marks, cache states, lifecycle,
  frame sampling and trace provenance are unchanged. Expected duration is 40–50 min on the Bench 1
  machine.
- **Marking.** Rows print `[diagnostic, not evidence]`; reports record `profile: diagnostic`,
  `acceptanceEvidence: false`, the exact sample plan and the incomplete gates. Smoke, env-reduced
  and partial-hard-tier acceptance-profile runs also record `acceptanceEvidence: false`.
- **Early stop.** Implemented default-off for hard rows only: at least 3 measured runs, every
  per-run statistic beyond the budget by 25 %, recorded as a demonstrated failure, never a pass. F3
  uses each run's p95; F4/F8 each run's minimum completion.
- **Verification.** Profile/early-stop unit suites pass (10 tests); project typecheck passes;
  targeted perf-library typecheck passes; the docs gate passes 56/56; a diagnostic grid-S smoke
  passes (4 flows, 34.3 s) and writes non-acceptance reports. A targeted tsc including bench/flows
  reaches only two pre-existing `registry.ts` Buffer overload errors. No Bench 2/3 pass was run.

**E5 C10 open bound (2026-10-26).** The diagnostic Bench 2 aborted at E5 because C10 did not reach
`f2:open-admitted` within 300 s. Isolated reproduction on the same warm/N0 session: H10 admitted at
2.135 s, C10 at 322.414 s; neither crashed, and C10 stayed on “Loading project” with the main thread
blocked before Stage activation. C10 completes just beyond the old bound, so E5 now passes it a
600,000 ms wait bound and wraps every non-crash E5 failure with the workload id. This is a harness
reliability change, not a measurement change: the C10 open time is setup, never a timing row, and E5
remains mandatory. Bench 2's tier rows remain non-acceptance evidence.

**Diagnostic Bench 2 result (2026-10-26).** The owner ran `diagnostic-2` at `e8cc2fc0` (dirty tree,
AC power, start load 4.51 > 4.0): grid-L/M/S, the grid-L traces and the transferred rows completed,
then the pass aborted at E5 on the C10 bound above — 1,860 s total, manifest `contaminated` and
`aborted`, every row non-acceptance evidence. The tier rows classify **clear on every hard band**
(L F3 15.5 ms median / 25 ms max; L F4 94–116 ms / 151 ms; L F8 37–51 ms / 88.5 ms; M and S clear;
F7 16.7 ms p95 with 0 long tasks and 0 dropped frames; F13 stage geometries constant with no
per-cycle climb across 1/2/1 cycles), with the L F2 cold 5.16 s Target recorded as a miss and
Bench 1's F3/F4/F8 of 164–166 / 636–670 / 519–536 ms superseded directionally. After the C10 bound
fix the owner reran E5 alone under `PERF_PROFILE=diagnostic`: `1 passed` in 12.3 min with all seven
workloads, H3/H10 at 0 differing pixels before and after the fixed edit (D/C recorded at 0), the
museum control at 3,120 changed pixels — identical to Bench 1 — and identical fixed-view hashes.
E5 also records two findings, not gates: main-pass draws scale with added Walls (1,447 → 10,526 at
H10, +1.2 % over Bench 1's 10,398; shadow passes/draws, programs and textures stay flat), and the
fixed edit's commit still canonicalizes and digests the whole envelope (583 KB → 6.02 MB at H10,
8.85 MB at C10, `snapshot` reads 604,623 → 6,150,293) while `compile = 2` — an I1/I4 named-global
finding, never local work. No hard row misses; Bench 3's formal method is unchanged and has not run;
the owner still rules under A.7 whether the aborted attempt consumes the second authorized pass.

## Plan interaction locality (2026-10-26, owner-directed continuation)

**Scope and method.** Owner direction: raise the architectural ambition, and use source analysis,
mathematics and correctness testing only. **No benchmark, profiling pass, timing probe or browser
measurement was run for this section.** Every quantity below is a derived operation count, an exact
output differential or a complexity statement; none is a measurement, and none is presented as one.
The pass is `c8ac273a` on PR #190, pushed to `t1/p02-s06-bench-setup`; it contains no source-format,
identity or acceptance-authority change.

**What the audit found.** The previous takeover made a *certified local edit* local. It did not make
the two most frequent interactions local, because both live outside the compiler:

1. **Panning re-evaluated the whole Plan representation, every frame.** `pose.target` moves when the
   camera pans (`camera-core/src/viewport.ts`, the `pan` intent), the spatial route keyed its Plan
   cache on that target
   (`apps/editor/src/routes/project/[projectId]/spatial/+page.svelte`, `refresh()`), and
   `StageFacade.planFor` called `evaluateLayoutPlan` afresh on each miss. The evaluator copies and
   id-sorts every Wall, Opening, object and Room, measures every candidate, then builds, sorts and
   filters the fragment array. But it reads the inspection target in **exactly one** place — the
   `lateral-span` membership stage — and the provider default is explicit unbounded coverage
   (`plan-parameters.ts`). So the work was `O(N log N)` per pan frame for a result that could not
   change.
2. **A click scanned the whole project.** `StageFacade.resolveSourceHit` sorted every eligible
   fragment and then projected every surface of every fragment until one fell inside the 8 px
   tolerance: `O(F log F + F·S)` projections for one pointer position.
3. **A selected subject scanned the whole project once per frame.** The route's selection echo did
   `plan.fragments.find(...)`, which runs on every presented frame while something is selected.

The audit also recorded two paths that are **not** live and were therefore not changed:
`lib/authoring/layout/plan-hit.ts` (the older pure Plan resolver) has no product caller — only
suites — and `layout-core`'s `resolveLayoutSnap` has no caller in `apps/editor/src`, so snapping is
not on the live drag path at all. Both are findings for their owners, not work S06 silently retired.

**Implemented.**

| Concern | Before | After |
| --- | --- | --- |
| Pan frame | Full `evaluateLayoutPlan` (`O(N log N)`: four id-sorts, a candidate record per source, a fragment sort, four stream filters) plus a fresh `planView` that re-grouped every membership row in the Index | One retained evaluation. The route's key names the target only when `planDependsOnTarget` is true; the facade retains the evaluation and reports the **live** target through it |
| Click | Sort every eligible fragment, then project every surface of every fragment (`O(F log F + F·S)`) | Static AABB hierarchy queried in screen space: `O(log F + c)` node visits, ≤ 8 projections each, then the **same** exact test in the **same** priority order |
| Selected subject, per frame | `plan.fragments.find(...)`, `O(F)` | Map probe against an index retained per fragment array, `O(1)` |

**Changed files.** `packages/layout-core/src/layout-plan-representation.ts` (`planDependsOnTarget`,
`planTargetsLiveView`, `planFragmentOf`, and the target-independence documentation on
`PlanSourceContext`/`PlanEvaluation`); `apps/editor/src/lib/authoring/layout/plan-pick-index.ts`
(new); `apps/editor/src/lib/authoring/stage/stage-facade.ts` (retained Plan, the additive
`planDependencyKey()` a presenter caches on, retained pick index, indexed hit path);
`apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` (keys on the facade's dependency
key and indexes its fragment lookups). No authored format, canonical geometry, selection/preview
semantics, acceptance authority, refusal code, budget or benchmark method changed.

**Why the indexed hit path is exact, not approximate.** The broad phase can only *narrow*: a node is
pruned only when no point of its world box can project within the tolerance, and the box is a
superset of everything the fragment's exact test projects (a compiled Wall's own bounds plus its
declared vertical extent, not the Plan cut). The candidate set is therefore a superset of the
fragments that can hit, returned in the hit path's own priority order, and the existing exact test
still decides. Two tests make that falsifiable rather than asserted:

- `tests/lib/authoring/plan-pick-index.test.ts` proves the pruning invariant directly — for 180
  boxes, every 40 px pointer on a 1280 × 720 frame and tolerances 0/8/40 px, *no box whose projected
  extent can reach the pointer is ever pruned* — plus the adversarial cases: coincident boxes
  (termination), a box straddling the camera plane (never pruned), an empty population, and a
  non-increasing population where the count oracle shows the query does not scale with it;
- `tests/lib/authoring/stage-facade.test.ts` proves the behavioural half: every eligible fragment's
  own projected vertices still resolve, and a pan keeps one evaluation (same object, same
  `fragments` array) while `plan.target` still tracks the camera.

A real pruning bug was found and fixed while writing the invariant test: node boxes were unioned
over array positions rather than through the build's permutation, so a node's box did not contain
its children and could prune a real hit. The test above is the falsifier that caught it.

**One deliberate design choice worth review.** The retained plan is the same object across a pan, so
nothing downstream re-derives; `PlanEvaluation.target` is therefore a **live getter** over the
camera's current target rather than a value captured at evaluation time. It is exact because the
evaluated fields are target-independent, and it falls back to the evaluated target if the live
reading is non-finite (which the parameter boundary refuses, so no evaluated plan can honestly carry
one). The alternative — a retained plan with a stale `target` field — was rejected as a dormant
correctness hazard.

**Counters added** (inert without a work observer, per I6): `plan-pick:node-built`,
`plan-pick:build-compare`, `plan-pick:node-test`, `plan-pick:node-prune`, `plan-pick:leaf-box`,
`plan-pick:projection`, `plan-pick:candidate`.

**Hand-derived complexity, before and after.** `N` is the project's entity count, `F` eligible
fragments, `S` surfaces per fragment, `c` the fragments whose projected extent is near the pointer.

| Path | Before | After | Remaining global term |
| --- | --- | --- | --- |
| Pan frame | `O(N log N)` + `O(N)` membership regrouping | `O(1)` | none |
| Click | `O(F log F + F·S)` | `O(log F + c)`, ≤ 8 projections per visited node | `c → F` when boxes really overlap in screen space — real overlap, counted |
| Selection echo, per frame | `O(F)` | `O(1)` | none |
| Build (first click per evaluation) | — | `O(F log F)` once, retained with the evaluation | rebuilds only when the Plan is re-evaluated |

**What remains global, named rather than hidden.** (a) An accepted edit still re-evaluates the Plan
once for the new compile generation: `O(N log N)` with four id-sorts and a fragment sort. It is now
the largest whole-project term left in the interaction layer, and it is the natural next slice — an
incremental Plan evaluator keyed per compiled source would need a merge-preserving order rather than
a re-sort, which is a contract-visible change to a ratified evaluator, so it was **not** attempted
here. (b) The fixed edit's commit still canonicalizes and digests the whole envelope, `Ω(bytes)`,
which the flat SHA-256 content identity requires. (c) Draw submission is still one draw per mesh,
`O(V)` per frame; batching remains the owner decision H6 records. (d) Cold open is unchanged.

**Verification (correctness only).** `check:layout-core`, `check:project-model`,
`check:camera-core`, the editor `check` (svelte-check, zero errors and zero warnings) and `build`
pass. The full editor suite passes **205 files / 2,557 tests**; the fast lane passes 172 files /
2,239 tests; the architecture lane passes 22 files / 180 tests, including the documentation gate.
No performance number in this section is measured.

**Review still owed.** The spatial route and the Stage host are shared surfaces; T3 review of the
Plan-key change and the retained-target protocol is required, as the record already requires for
`stage/**` and `visitor/**`. Independent review of this pass has not happened.

### Techniques considered for this pass

The research package this pass started from names production mechanisms by name. What was adopted,
adapted or refused, and why — no candidate was adopted on reputation:

| Technique | Decision | Reason grounded in this code |
| --- | --- | --- |
| Figma's *compute only what is needed* (separate the ordered list from per-element presentation) | **Adopted in shape** | The Plan already separates membership from fragments; the defect was that a *pan* re-derived both. Retention by real dependency is the same idea applied to the cache key rather than to a new type |
| Figma's lazy derived properties, rope-like sequences, 99 % memory result | **Not applied** | Those solve quadratic descendant-list retention in deeply nested trees. This path's collections are flat compiled arrays behind the persistent roots the previous takeover landed, so no quadratic retention is derivable here for this pass to fix |
| tldraw's revision-diff derived views (return the previous value when unchanged) | **Adopted, smaller** | Implemented as one retained evaluation plus a live-target view, not as a general derived-value engine: the Plan has exactly one host, so a framework would be new machinery for one consumer |
| RBush / Flatbush | **Rejected** | Both are 2D plan indexes; the pick is a **screen-space** query under a live projection, which neither answers. The pruning has to happen in CSS, so a world-space R-tree would still project every candidate it returned |
| A screen-space grid rebuilt per evaluation | **Rejected** | Exact and simple, but `O(F)` per evaluation; during a camera move that is the whole project per frame, which is the defect being removed |
| `three-mesh-bvh` | **Rejected for this path** | It accelerates triangle raycasts. The hit semantics here are *screen distance to drawn surfaces* at a cut/face elevation, not a mesh raycast, and the picking path deliberately reads compiled Layout rather than the renderer |
| Salsa red-green / DBSP incremental views | **Studied, not adopted** | The useful half — reuse what provably did not change — is what the compile session (D.3) and this retention already do. Adopting the engines would create a second dependency graph beside the compiler's own, duplicating the authority rule 6 protects |
| Batched / instanced rendering (MapLibre buckets, deck.gl attribute invalidation, `BatchedMesh`) | **Deferred, unchanged** | The plan's Exclusions make a new rendering architecture an owner decision (H6). The measured draw counts stay recorded as the evidence for that decision; this pass did not touch submission |
| WebGPU | **Deferred** | No measurement in this pass could justify an API migration, and none may be produced here |
| Merkle / BLAKE3 content identity | **Refused** | It changes the ratified source identity contract. The flat SHA-256 stays; the remaining cost is named above |
| CGAL arrangements, Clipper2, `polygon-clipping`, Earcut | **Not applied** | They address topology-changing geometry and polygon booleans, not the interaction path this pass covers; no boolean, offset or retriangulation runs on a pan, a pick or a commit |
| A new abstraction layer for locality | **Refused** | The two wins are a cache key and a broad phase. Adding a "world" or "derived view" service for two consumers would be machinery with no measured return |

**Bench 2/3 strategy (2026-10-26).** The retained Bench 1 result files decompose the 3 h 36 min
ceiling: F3/F4/F8 is 78 min of the L tier, F7 17.5 min and F13 11 min; setup is 4.8–8.7 % of the
drag wall and all ~450 opens cost ~10–15 min. Valid consolidation is therefore capped at ~10–15 min
per pass. The owner approved **Option A**: Bench 2 is a **diagnostic** pass and Bench 3 carries the
formal statistics. The [implemented strategy](./review-handoff.md#bench-23-strategy-implemented-diagnostic-bench-2-2026-10-26)
records a diagnostic profile of 3 runs per row, 2 drag/precision samples, 5 Undo/Redo cycles, F2
cold+warm, F7 warm only, F13 1/2/1 cycles × 10 edits, traces at L only, no A.6 or delay proof, and
the full E5 matrix. It keeps the real interactions, 60 pointer inputs per drag, every hard tier and
the source/build/browser identity. Its honest estimate is **40–50 min**, not 35–45; medians are
diagnostic only and no p95 or hard-row verdict is formal. Bench 2 counts as the second authorized
pass but **cannot discharge an acceptance gate**; no acceptance default changed. The lean Bench 3
plan (F3/F4 3 samples, F8 5 cycles, F7 last-run windows, F13 10 edits) is **not ratified**. Review
recommends rejecting the F8 and F13 cuts for formal acceptance unless a separate 20-deep
Undo/Redo proof and a deep-cycle leak proof are added; without them, a lean Bench 3 is about
2 h 50 min–3 h 05 min, with all six cuts about 2 h 25 min–2 h 45 min. The opt-in early stop is
implemented and default-off (3 measured runs minimum, 25 % margin, never a pass). Bench 2 ran on
2026-10-26, aborted at E5, and its seven-workload E5 matrix was completed by the standalone rerun
recorded above; the pass remains contaminated and non-acceptance. Bench 3 has not run.
## Incremental Plan evaluation (2026-10-26, owner-directed continuation)

**Scope and method.** Owner direction: keep pushing interaction locality, then independent correctness
review. **No benchmark, profiling pass, timing probe, microbenchmark or browser measurement was run
for this section.** Everything below is a derived operation count, an exact output differential or a
complexity statement. The pass is `3e7efdbe` on PR #190, branch `t1/p02-s06-bench-setup`; no authored
format, canonical geometry, source identity, acceptance authority, refusal code or budget changed.

**What the audit found, and one assumption it corrected.** The previous section recorded the next
slice as "an incremental Plan evaluator keyed per compiled source would need a merge-preserving order
rather than a re-sort, which is a contract-visible change to a ratified evaluator". Half of that was
wrong, and the audit is what established which half:

1. **The order does not require a contract change, and it does not require a sort.** Fragment order is
   a function of `(kind, sourceId, interval start, interval end)` only. A source's placements are
   therefore contiguous, and inserting or removing a source is an insertion into a **maintained**
   order, not a re-ordering of the population. This is now implemented inside the existing
   `layout.plan@1` contract: the observable array is unchanged.
2. **The per-generation fragment pass does.** Every `PlanFragment.ref` carries `generationId`, and a
   selection's staleness check reads it (`semantic-selection.ts`), so an accepted edit — which
   changes the generation, because the generation *is* `compile:<sourceContentId>` — must produce new
   fragment objects for every fragment. `Ω(F)` per generation is a property of the ratified
   correspondence, not of this implementation; the retainer charges it once and removes everything
   else.
3. **The whole re-derivation was three separate whole-project costs**, not one: four full-array id
   sorts; a `Candidate` and an `Evaluated` per candidate plus a per-source array in a `Map`; and a
   global fragment sort followed by four stream filters and a bounds fold (six passes over `F`).
4. **The hit path carried a second, weaker comparator.** `stage-facade.ts` restated the fragment
   comparator without the interval-`end` tiebreak and sorted the eligible fragments into
   "priority order" on every first click after an evaluation. The array it sorted was already in the
   canonical (stronger) order, and `Array.prototype.sort` is stable, so that `O(F log F)` pass could
   not change its input. It is deleted, not replaced.
5. **`plan.streams` has no runtime consumer in the editor.** The Stage draws compiled geometry through
   `VisitorLayoutShell`; no product code reads the four streams or `plan.bounds`. They remain part of
   the contract and are still produced — now in the single assembly pass rather than four extra
   scans — but this is recorded so a later reader does not mistake them for a render source.

**Implemented.**

| Concern | Before | After |
| --- | --- | --- |
| Accepted edit (new generation) | Four id sorts, a candidate + measured candidate + membership row per source, a fragment sort, six `F` passes: `O(N log N)` with `O(N)` allocations on top of `O(F)` fragments | One walk of the compiled sources confirming each retained record (`O(N)` numeric comparisons, no allocation), derivation only for the sources that changed (`O(k)`), then one assembly pass: `O(F)` fragments, no sort of any kind. Sources that did not change keep their identical membership rows |
| Same inputs repeated (per frame, per click) | `O(N log N)` when the retention key missed | `O(1)` — returned by identity |
| Parameter change (cut, depth, span, filter, reveal) | `O(N log N)` | `O(N)` re-derivation + `O(F)` assembly; the maintained order still means no sort |
| Source id added/removed | `O(N log N)` | `O(N)` walk + `O(k log S)` binary insertion for a few ids, one `O(S log S)` rebuild when many change |
| Click: pick-index build | `O(F log F)` sort + build | Build only; the eligible projection preserves the declared order, so the sort is gone |
| Membership lookup, per presented frame | `plan.membership.find(...)`, `O(S)` | Indexed against the membership array, `O(1)` |
| Both per-source lookups on first use | Map built by scanning the finished array | Filled by the assembly pass that already walks every source |

**Changed files.** `packages/layout-core/src/layout-plan-representation.ts` (`createPlanRetainer`,
`PlanRetainer`, the shared `measureCandidate`/`sourceMembership`/`fragmentFor` extraction, the
uncapped-estimate comparisons `wallUnchanged`/`openingUnchanged`/`objectUnchanged`/
`roomFloorUnchanged`, `planMembershipOf` index, and `SOURCE_KIND_ORDER` derived from
`PLAN_SOURCE_KINDS` so the comparator and the assembly order cannot drift);
`apps/editor/src/lib/authoring/stage/stage-facade.ts` (one retainer for the facade's lifetime, the
redundant comparator and sort removed); `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte`
(indexed membership reads); `apps/editor/src/lib/authoring/layout/plan-pick-index.ts` (complexity
rectified, see below); `apps/editor/tests/lib/layout/layout-plan-retainer.test.ts` (new).

**Why it is exact, not merely equal on the cases tested.** The retainer is not a second definition of
the family. It calls the same `wallCandidatesOf`/`openingCandidate`/`objectCandidate`/
`roomFloorCandidate`, the same `measureCandidate`, the same `sourceMembership` and the same
`fragmentFor` as `evaluateLayoutPlan`; it differs only in *how it reaches the declared order* and
*when it does the work*. The one thing it can get wrong is believing a retained record still
describes its source, so that belief is checked against **the fields the derivation reads** — a
reference-first, allocation-free comparison of extent, interval and plan geometry per entry, with the
candidate count compared first so "a Wall gained a span" cannot hide behind "its first span is
unchanged". Two cases it cannot model — a source id shared by two kinds (the reference merges them
into one membership row) and a source id repeated within one kind — are detected during the walk,
which clears the retained state and delegates to the reference evaluator.

`tests/lib/layout/layout-plan-retainer.test.ts` is a **differential oracle**: every case asserts the
retainer's entire `PlanEvaluationResult` deep-equals the reference's, over a first evaluation, a
generation-only change, moved spans, a Wall losing its solids, a Wall gaining a span, widened and
raised openings, a dropped floor, a widened footprint, added and moved objects, id insertion out of
order, sources appearing and disappearing, every parameter and target change, a refusal followed by
recovery, both fallback shapes, and 60 randomized steps. Two further assertions make the suite test
*reuse* rather than agreement: after a generation-only change every membership row is the same
object, and after one Wall changes exactly one row is re-derived. The oracle was falsified on purpose
before it was trusted — forcing `wallUnchanged` to return `true` makes the sequence and randomized
cases fail, so the assertions do bite.

**What the independent review found.** Two reviewers with different mandates (correctness versus
integration) read the change after it was pushed. Both found the same real divergence, and it was
mine: a Wall with **no compiled solid spans** places no geometry, so its reuse predicate checked only
that its plan extent was the empty polyline — but the derivation still reads the Wall's declared
`height` for the candidate extent, which is what the depth window measures. A height change on such
a Wall therefore kept a stale `reason` and `depthBelowCutMeters` on its membership row (fragments,
streams and bounds were unaffected, which is exactly why the differential corpus did not catch it:
it mutates a Wall's spans or drops its solids, but never its height while solid-less). Fixed by
comparing the retained extent, pinned by a dedicated regression case that flips
`no-meaningful-projection` to `outside-depth`, and confirmed to fail without the fix. The same review
found two stale comments (a doc block claiming the reconcile helper returns `true`, and the hit path
restating the superseded `O(log F + c)`), both corrected; its other reported concerns — retained plan
arrays being equal-valued but distinct instances, and a repeated identical evaluation returning the
same object — are the documented consequences of reuse, not divergences.

**The pick index's complexity claim was wrong as written.** The previous record said the query is
`O(log F + c)`. It is `O(v + c log c)`: the tree addresses a **permutation** of the caller's indices,
so surviving candidates leave the traversal in tree order and are sorted back into rank order before
they are returned, and `v` — nodes whose projected extent reaches the pointer — is `O(log F + c)` only
in the ordinary case. The adversarial cases are now named in the module: screen-space overlap pushes
`c` toward `F`; a box straddling the camera plane cannot be bounded and is never pruned; a view where
every box projects large enough to reach the pointer keeps every node. All three are overlap or
projection degenerate, never unrelated project size — but the earlier claim was too clean, and this
record corrects it rather than leaving it standing.

**Hand-derived complexity and the remaining global terms.** `N` compiled sources, `F` fragments, `k`
sources an edit changed, `S` sources.

| Path | Before | After |
| --- | --- | --- |
| Accepted edit | `O(N log N) + O(F log F) + O(N)` allocations | `O(N·c) + O(k log S) + Ω(F)` |
| Unchanged repeat | `O(N log N)` | `O(1)` |
| Parameter change | `O(N log N)` | `O(N·c) + Ω(F)` |
| Click after an evaluation | `O(F log F + F·S)` | `O(v + c log c)`, build `O(F log F)` once |
| Selection / membership, per frame | `O(F)` / `O(S)` | `O(1)` / `O(1)` |

What is **not** removed, named rather than hidden:

- **`Ω(F)` fragment objects per generation.** Forced by `ref.generationId`. Removing it means moving
  the generation off the fragment — a change to the ratified correspondence and to the staleness
  check that reads it. Owner decision, not taken here.
- **`O(N·c)` reconcile walk.** The input is the whole compiled geometry, so proving a source is
  untouched costs reading it. A compiler-published changed set would make this `O(k log S)`; the
  retainer needs no change to use one, and the walk allocates nothing meanwhile.
- **Parameter changes** still re-derive every source, because every placement reads the cut, the depth
  window and the reveal set. Only the sort is gone.
- **Envelope canonicalization and the flat SHA-256 digest**, `Ω(bytes)`, unchanged (T3).
- **Draw submission**, one per mesh, unchanged (H6 owner decision).
- **Cold open**, unchanged.
- **Retained memory**: the retainer holds at most one evaluation and one record per source. A record
  keeps the plan geometry it was derived from, so unchanged sources may hold arrays from several
  generations — at most one array per source, `O(N)` in total, never `O(N)` per edit. If the compiler
  hands back the same arrays (structural sharing), nothing beyond the current geometry is retained.
  `PlanRetainer.clear()` drops it all.

**Techniques considered for this pass.**

| Technique | Decision | Reason grounded in this code |
| --- | --- | --- |
| Persistent / merge-preserving ordered collections (the mission's "order-preserving merge") | **Adopted, in the simplest sufficient form** | The id set rarely changes and a source's placements are contiguous, so a maintained sorted id array plus binary insertion is `O(k log S)` with no tree, no node allocation and no iterator protocol. A persistent treap would have the same asymptotics and more machinery — it is not adopted on reputation |
| tldraw's "return the previous value when unchanged" | **Adopted at three levels** | The whole evaluation, the per-source derivation, and the maintained id list each return the previous value when nothing relevant changed |
| Lazy derived properties (getters for `streams`, `bounds`, `fragments`) | **Rejected** | `planTargetsLiveView` spreads the evaluation on the pan path, so getters would either force the work anyway or need `Object.defineProperties` clones to avoid it — and `fragments` cannot be lazy: `ref.generationId` makes `Ω(F)` unavoidable per generation. Complexity for no asymptotic gain |
| Content hashing a compiled record to decide reuse | **Rejected** | A hash strong enough to be safe is still probabilistic in a canonical authority, and computing it allocates and reads the record — no cheaper than the field comparison that is exact |
| A generic incremental-computation framework (Salsa/DBSP-shaped) | **Rejected** | The dependency graph here is one function of one compiled object with a fixed, known set of inputs. A framework would be a second authority beside the compiler's |
| Moving `generationId` off the fragment onto the evaluation | **Escalated, not implemented** | It is the only way to break `Ω(F)`, and it changes a ratified correspondence field plus the staleness check that reads it |
| RBush/Flatbush, `three-mesh-bvh`, GPU batching, WebGPU, Merkle/BLAKE3 identity, CGAL/Clipper2 | **Unchanged from the previous record's rejections** | Nothing in this pass altered the reason each was refused; no rendering, identity or geometry contract was touched |

**Verification (correctness only).** `check:layout-core`, `check:project-model`, `check:camera-core`,
the editor `check` (svelte-check: 0 errors, 0 warnings) and `build` pass. The full editor suite passes
**206 files / 2,570 tests**; the fast lane **173 files / 2,252 tests**; the architecture lane **22 files
/ 180 tests**, including the documentation gate. No performance number in this section is measured.

**Review.** Independent review of this pass had not happened when it was pushed; it was reviewed in
the following pass's round (below), which found and fixed a divergence in the reuse predicate. T3
review is still required for the Plan evaluator's retention protocol and for the previously flagged
Plan-key/retained-target change; the route and the Stage host remain shared surfaces. The owner also
owns the decision this pass deliberately did not take: whether the compile generation belongs on
every fragment.

## Plan maintenance from the compiler's own delta (2026-10-26, owner-directed third pass)

**Scope and method.** Owner direction: one further implementation pass over the remaining interaction
ceilings, then independent correctness review. **No benchmark, profiling pass, timing probe,
microbenchmark or browser measurement was run for this section.** Every quantity below is a derived
operation count, a deterministic work-counter assertion, an exact-output differential or a complexity
statement. The pass is on PR #190, branch `t1/p02-s06-bench-setup`; no authored format, canonical
geometry, source identity, acceptance authority, refusal code, budget or ratified correspondence
changed.

**The four ceilings the owner named, checked rather than assumed.**

1. **Hidden full-array materialization — confirmed, and removed.** `compiled.walls` and `compiled.rooms`
   are lazy arrays over persistent vectors (`layout-geometry-delta.ts`, `lazyArray`); reading either
   one allocates a slot array and copies every element, which the retainer was doing on every
   evaluation. The retained world now exposes iteration over the same root
   (`forEachRetainedCompiledWall` / `forEachRetainedCompiledRoom`), so the retainer visits the same
   objects in the same order without producing the legacy array. Measured as a counter, not a time:
   `materialize:compiled-walls:slots` and `materialize:compiled-rooms:slots` are **0** on a cold
   evaluation and on an accepted edit.
2. **"`Ω(F)` per generation" — half right, and the right half was the wrong obligation.** Producing
   the *complete ratified output* for a generation is `Ω(F)`: every `PlanFragment.ref` carries the
   generation, so all `F` fragment objects must exist before any consumer can see the array. But an
   accepted edit was paying that for output nobody had asked for. The evaluation now exposes
   `fragments`, `membership`, `streams`, `bounds` and `unmatchedRevealIds` as **lazily materialized,
   cached** views, while `planFragmentOf` and `planMembershipOf` answer from the retained per-source
   records directly. The contract is untouched — a consumer that reads `plan.fragments` gets exactly
   the same array, once — and the cost moved to the caller that needs it. The live editor asks for
   one selected source's fragment and one membership row; a click asks for the eligible set.
3. **Trusted changed-set propagation — built, and it is the compiler's own evidence.**
   `diffCompiledSources(before, after)` compares two compiled snapshots' persistent roots with
   `PersistentVector.diff`, which skips shared subtrees, and reports the compiled records whose
   identity actually changed. The retainer consumes it: it re-derives exactly those records, and
   nothing else. **No caller can assert which entities are dirty** — the delta exists only as the
   difference between two snapshots the compiler retained, and it is `undefined` (⇒ the complete
   walk) for an unretained or hand-built snapshot, the same snapshot twice, a membership change (a
   different length, or a different id at a position), an Opening that changed host (its ids are
   derived by first-host order), or a Room that stopped compiling.
4. **"Binary insertion is `O(log S)`" — wrong, and corrected below.** `Array.prototype.splice` shifts
   up to `S` entries. The maintained id array is retained anyway — it is still the cheapest structure
   that answers "the declared order" exactly — but its cost is stated honestly now.

**The predicate behind the old fallback was over-conservative, and that hid an `O(N)` term.** The
previous pass claimed `O(N)` allocation-free comparisons per edit. That was true of *allocations*; it
was not true of *derivations*. `wallUnchanged` compared the retained placements index to index against
`wall.solidSpans`, but a derivation orders its placements by interval (`compareEntries`) while the
compiler emits spans in its own order, and a Wall can carry two spans with the same interval at
different elevations. The result was that untouched Walls failed the proof and were re-derived: adding
one Wall to the fixture re-derived **11** sources at 10 Rooms and **41** at 40 Rooms — linear in the
project, disguised as a bounded walk. The predicate now pairs by the whole derived placement
(interval, elevation, plan points), so a Wall is proved unchanged unless something the derivation reads
actually moved: the same insertion now re-derives a **constant** number, at both sizes. This is
asserted, not observed: `tests/lib/layout/layout-plan-locality.test.ts` asserts the derivation count is
size-invariant, and fails (`expected 41 to be 11`) when the positional pairing is restored.

**Implemented.**

| Concern | Before | After |
| --- | --- | --- |
| Retained source walk | `compiled.walls` / `compiled.rooms` (lazy arrays: one allocation and a full copy each) | Iteration over the retained persistent root, same objects and order, no legacy array |
| Which sources changed | Every source compared field by field (`O(N)`) | Compiler root difference: only the records whose identity changed (`O(Δ log N)` visits), then `O(Δ)` derivation |
| Complete output on an edit | Built eagerly: `F` fragment objects, `S` membership rows, four stream arrays, a bounds fold | Built on first read, and cached; the two per-frame questions are answered from the per-source records instead |
| A Wall's neighbours on an edit | Re-derived whenever the interval-paired proof failed (11 for a one-Wall edit) | Re-derived only when the record they were derived from actually changed (1 for the same edit) |
| Index panel | The route derived the complete located-subject list on every Plan evaluation, into a `hidden` (not `{#if}`-ed) panel body | The list is derived only while the panel is open; the collapsed "Selected: …" line is one indexed membership probe |
| Live-target view | `{ ...plan, get target() }` | `Object.create` over the property **descriptors** |

**Why the descriptor copy matters.** `planTargetsLiveView` used to spread the evaluation and override
`target`. With lazily materialized fields a spread reads every getter — which would have made a pan
materialize the complete output, the exact work the pass exists to avoid. Copying descriptors
preserves every getter without invoking it, and the live wrapper shares the wrapped evaluation's
cached values and source view.

**Hand-derived complexity.** `N` compiled sources, `F` fragments, `S` sources (`S ≤ N`), `k` sources an
edit changed, `c` placements per source, `Δ` compiled records whose identity changed.

| Path | Before this pass | After |
| --- | --- | --- |
| Accepted edit, delta proved | `O(N·c)` comparisons + `O(k·c)` derivation + `O(F)` fragments eagerly | `O(Δ log N)` root visits + `O(k·(c + log S))` derivation and record-map writes + **no comparison**, no materialization; `Ω(F)` only if a consumer reads the array |
| Accepted edit, delta unprovable (insert/remove/membership) | `O(N·c)` comparisons, but over-conservative `unchanged` ⇒ `O(N·c)` derivations | `O(N·c)` comparisons + `O(k'·c)` derivations, where `k'` is what actually moved |
| Cold evaluation | `O(N·c)` + materialized legacy arrays | `O(N·c)`, no legacy array |
| Parameter change | `O(N·c)` re-derivation + `O(F)` fragments | `O(N·c)` re-derivation; output lazy |
| `planFragmentOf` / `planMembershipOf` | `O(F)` / `O(S)` on first use, then `O(1)` | `O(log S)` from the retained records (one persistent-map probe per kind); the arrays are still indexed if a consumer materializes them |
| Pan frame | `O(1)` | `O(1)` — unchanged, and now genuinely so: the live view does not force the lazy fields |
| Click | Build the pick index `O(F log F)` once per evaluation, then `O(v + c log c)` | Unchanged |

**Remaining global terms, named.**

- **`O(Δ log N)` root visits.** A proven delta still walks the paths of the persistent tree whose
  subtrees differ; a world rebuilt wholesale degenerates to `O(N)`. That is the tree's cost of
  *proving* the difference, not a scan of the sources.
- **The object unit has no persistent root.** `CompiledObjectsUnit.compiledObjects` is a plain array,
  so when the unit is rebuilt the delta compares it by reference over all objects, `O(Objects)`. That
  is why an object edit's answer is a reference scan rather than a root difference; giving the unit a
  persistent root is the next slice for that path, not a change of plan.
- **A membership change cannot be proved positionally.** An insertion or removal shifts every later
  slot, so the delta is `undefined` and the complete walk runs: `O(N·c)` comparisons, `O(k'·c)`
  derivations, still no sort and still no legacy array.
- **Id-order maintenance is `O(k·S)` in the worst case, not `O(k log S)`.** Inserting an id copies
  the array's tail (the previous pass used `splice`, which shifts it; this pass replaces the array
  instead, at the same copy cost, so a captured reference stays valid). For a handful of ids that is
  what it says; a balanced tree would be `O(k log S)` with node allocation and an iterator protocol
  for a set that barely changes. This pass keeps the array and corrects the claim.
- **Retained records live in a persistent map, so a probe is `O(log S)`, not `O(1)`.** That is the
  price of letting an assembled evaluation capture its own view with `fork()` instead of copying the
  map; the alternative — a plain `Map` — makes a returned plan read records a later evaluation wrote,
  which is a correctness defect, not a trade. `k` writes per edit at `O(log S)` each.
- **Envelope canonicalization and the flat SHA-256 digest**, `Ω(bytes)`, unchanged (T3).
- **Draw submission**, one per mesh, unchanged (H6 owner decision). **Cold open**, unchanged.
- **The pick index still rebuilds per generation** (`O(F log F)`, on the first click after an
  evaluation). A delta-updated broad phase is possible — the index is static, so it would need
  insertion and deletion with rebalancing — but a click is a discrete user action, not a frame or an
  edit loop, and the rebuild is already off the evaluation path. Rejected as machinery without a
  defensible interaction return.

**Corrections to earlier claims in this record.** (a) "`O(k log S)` binary insertion" was wrong;
insertion shifts the array's tail, so it is `O(k·S)` worst case (above). (b) "`O(N·c)` **allocation-free** comparisons"
was true of allocation and false in effect: the predicate often failed to prove an untouched Wall, so
the walk cost derivations too. (c) "`Ω(F)` fragments per accepted edit" stands for the *complete
output*, but not for an edit: the output is now demand-driven, and the obligation belongs to whoever
reads it. The ratified correspondence itself — one fragment per placement, each carrying its
generation — is unchanged and was not renegotiated.

**Changed files.** `packages/layout-core/src/layout-geometry-delta.ts`
(`forEachRetainedCompiledWall`, `forEachRetainedCompiledRoom`, `diffCompiledSources` and its
`CompiledSourceDelta`); `packages/layout-core/src/layout-plan-representation.ts` (the demand-driven
`assemble`, `PLAN_VIEWS` and the source-indexed `planFragmentOf`/`planMembershipOf` fast paths, the
descriptor copy in `planTargetsLiveView`, `reconcileAll`/`applyDelta`/`deltaOf`, the retained-root
walks, and `wallUnchanged`'s placement pairing);
`apps/editor/src/lib/authoring/stage/shell/EditorIndex.svelte` (a `selectedLabel` prop; the group list
is derived only while open); `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` (that
label, from one indexed membership probe); `apps/editor/tests/lib/layout/layout-plan-locality.test.ts`
(new).

**Counters added** (inert without a work observer, per I6): `plan:source-compared`,
`plan:source-delta-applied`, `plan:source-derived:<kind>`, `plan:output-fragments`,
`plan:output-membership`.

**Why it is exact.** The delta's authority is record identity: a compiled record that is the *same
object* as the one a derivation was computed from cannot derive differently, and a record the root
difference names is re-derived. A returned plan's lazily materialized output is exact for the same
reason: it reads the sources it captured at assembly, never the retainer's later state. Everything the delta cannot prove falls back to the complete walk,
which is the previous pass's path with a stronger predicate; and anything the walk cannot model (a
source id shared by two kinds, or repeated within one) is handed to `evaluateLayoutPlan` itself. The
`layout-plan-retainer.test.ts` differential oracle still holds every case against the reference, and
the new suite adds: a cold evaluation is exact with **zero** legacy-array materialization and **zero**
complete-output production; a one-Wall edit derives exactly one source with **zero** comparisons at
both 10 and 40 Rooms; an insertion (no provable delta) derives a size-invariant constant; the two
per-frame questions are served without materializing, and a consumer that asks for `fragments` gets
exactly `F` generation-qualified fragments once and nothing on the second ask; hand-built geometry
still matches the reference across generations.

**Verification (correctness only).** `check:layout-core`, the editor `check` (svelte-check: 0 errors,
0 warnings) and `build` pass. The fast lane passes **174 files / 2,257 tests**, the architecture lane
**22 files / 180 tests** (including the documentation gate) and the heavy lane **11 files / 138
tests**. The all-in-one run (`vitest run`, which includes the heavy files) passes except for two
heavy files that exceed their per-test defaults when 200+ files transform in parallel; each of them
passes alone in about two seconds, inside the heavy lane and in the fast lane, so this is measured
lane contention, not a regression — the lanes are the reported result. No performance number in this
section is measured.

**Techniques considered for this pass.**

| Technique | Decision | Reason grounded in this code |
| --- | --- | --- |
| Persistent-container diff as a change certificate (Salsa/DBSP's "reuse what provably did not change", in the simplest sufficient form) | **Adopted** | The compiler already keeps every snapshot on persistent roots, so the certificate is a comparison of two roots — no new dependency graph beside the compiler's, and nothing is accepted on a caller's claim |
| Incremental materialized views / lazy output (Figma, tldraw) | **Adopted as demand-driven getters** | The contract is a plain object of arrays; making the arrays lazy preserves it exactly and charges `Ω(F)` to the consumer that asks. A separate view abstraction would be new machinery for one host |
| A generic derived-value engine (revision-diffed views) | **Rejected** | One host, one dependency, one generation. The retained records already are the derived value |
| Persistent ordered collections (treap/rope) for the id order | **Rejected, corrected instead** | `O(k·S)` `splice` over an array that changes by a handful of ids is cheaper in constant and simpler than a tree with node allocation; the previous `O(k log S)` claim was the error, not the structure |
| Treating `compiled.walls` as an array and accepting the copy | **Rejected** | The copy is `O(N)` allocation per evaluation and pins the legacy array alive; the root iteration is the same visit order with none of it |
| Moving `generationId` off the fragment to break `Ω(F)` for output consumers | **Escalated, not implemented** | Still a ratified-correspondence change and no longer on the edit path, so the case for it is weaker than last pass's, not stronger |
| Delta-updated picking index | **Rejected for now** | See the remaining-terms list: a static tree would need rebalancing for a cost that is already off the evaluation path |
| RBush/Flatbush, `three-mesh-bvh`, GPU batching, WebGPU, Merkle/BLAKE3 identity, CGAL/Clipper2 | **Unchanged refusals** | Nothing in this pass altered the reason each was refused; no rendering, identity or geometry contract was touched |

**What the independent review found, and what was fixed.** Two reviewers with different mandates
(correctness, and integration/regression) read the pushed commit and edited nothing. The substantive
finding was mine and it was a real defect, not a documentation gap:

1. **A lazily materialized plan could describe a later generation's sources.** The getters closed
   over the retainer's live index, so holding a `PlanEvaluation` across a later `evaluate` and then
   reading `fragments`/`membership`/`bounds`/`streams`/`unmatchedRevealIds` — or asking
   `planFragmentOf`/`planMembershipOf` — produced the *newer* records under the *older*
   `generationId`. The differential suite missed it because it compares each result immediately.
   Fixed by having `assemble` capture its own view: each kind's id array (now copy-on-write, never
   `splice`d) and a `fork()` of its record map (a persistent map, `O(1)`, so no `O(S)` copy returns).
   A regression case evaluates a second generation with a different cut height and then asserts the
   first plan still materializes its own sources, its own streams, its own bounds and its own
   per-source row; it fails (`expected […(1560)] to deeply equal […(1560)]`) when the `fork()` is
   replaced by the live handle.
2. **A refused delta could leave a partial apply.** `applyDelta` derived as it validated, so a late
   refusal left records stamped with the current pass — which the fallback walk reads as a duplicate
   id and answers by dropping all retention (output stayed exact; the retainer went cold). It now
   validates every named source before deriving anything, so a refusal mutates nothing.
3. **A doc block overstated the fallback's repair** (it said a partial apply was repaired by
   `unchanged` comparison; the stamp check fires first) and an optional `EditorIndex` prop was
   guarded as if required. Both corrected — the prop is required, which is what its one caller passes.

The reviewers also confirmed, independently: the delta's bail-outs are complete for the compiler's
current producers (insertion/removal, id reordering, an Opening changing host, a Room that stopped
compiling, an unretained or hand-built snapshot); no product code spreads or clones a `PlanEvaluation`
(so no hot path forces the lazy fields); the retained walk's order equals `geometry.walls`/
`geometry.rooms` on every path that produces a compiled snapshot; and `wallUnchanged`'s pairing cannot
report a changed Wall as unchanged (equal counts plus an injective match is a bijection over the field
set the derivation reads).

**Review still owed.** T3 review remains required for the Plan evaluator's retention protocol, the
compiler-delta certificate and the previously flagged Plan-key/retained-target change; the route, the
Stage host and the Index panel remain shared surfaces. The owner still owns whether the compile
generation belongs on every fragment.

## Final integration review and Bench 3 candidate (2026-10-26)

**Scope and method.** Owner direction: stabilise the candidate, integrate it with `main`, review it
independently and hand it to Bench 3 — not another optimisation round. **No benchmark, profiling
pass, timing probe, microbenchmark, deployment or merge to `main` was performed for this section.**
Everything below is a command result, an exact-output differential, a work-count assertion or a
hand-derived bound.

**The reviewed implementation.** The candidate is the branch head on PR #190, `t1/p02-s06-bench-setup`:
merge commit `d7600576` (main `51dcb764` integrated into the reviewed S06 head `86fb631e`), with the
final review corrections committed as `d89554b1`; `f3564867` on top of it is this record only, no
code. `d89554b1` is therefore the exact code SHA this section describes and the one Bench 3 should
check out (a later docs-only head changes no behaviour). The S06-relevant commits are `c8ac273a`
(interaction locality),
`3e7efdbe` + `09f18a56` (incremental Plan evaluator and its solid-less-Wall repair), `6b53ae95`
(compiler-delta maintenance, retained-root iteration, demand-driven output) and `f9502a5a`
(generation capture, validate-before-mutate).

**Integration with `main`.** The branch was 41 commits behind and reported non-mergeable; it is now a
merge commit, not a rebase, so every S06 commit and all benchmark provenance keep their original
SHAs. Seven files conflicted, and each was resolved **additively** — no side's behaviour was dropped:

| File | Resolution |
| --- | --- |
| `units/canonical.ts` | S06's frozen-object revision memo and work counters stay; main's `SaveWorkInstrumentation` is threaded through the encode and digest phases |
| `package-sha.ts` | S06's digest counters stay; main's optional `measureSync` wraps the same bytes |
| `units/acceptance.ts` | `verifyUnitDependencyLocks(envelope, { knownSourceContentId?, instrumentation? })` — one options object carrying both sides' optional inputs; both call sites updated (`units/acceptance.ts` admission, `units/save.ts`) |
| `stage/host-acceptance.ts` | Union of both import sets and helpers (S06's persistent compile session wiring and main's unit read context / lifecycle paths) |
| `platform/perf-marks.ts` | Both helpers kept (`perfRenderer` for S06's render counters, `perfMeasureSync`/`perfMeasureAsync` for main's Save attribution) |
| `spatial/+page.svelte` | Union of imports; main's lifecycle work and S06's Plan retention do not share a statement |
| `perf/README.md` | S06's fuller flow descriptions plus main's project-lifecycle row; the F9 row now uses main's finer span chain, which is what `flows/save.spec.ts` actually reads |

Nothing in the merge redefines Bench 3's comparison conditions. `perf/bench.ts`'s `TIER_FLOWS` is
unchanged and does not include the newly documented lifecycle flow, which runs through its own
supervisor, so the measured pass composition is identical to Bench 1/2. The one *interpretive* change
is recorded rather than fixed: because a deeply frozen unit answers a repeated digest from the
frozen-object memo, its `save.unit.*` phases do not appear in that row — the work did not run, so
attributing it would be false. `perf/README.md` now states that F9 rows and Benches must be compared
at like cache state.

**Independent review of the merged candidate.** Two reviewers with different mandates read the merged
tree and edited nothing: correctness (merge resolutions plus the S06 claims) and ownership/provenance
(the T3-shaped mandate). Findings and dispositions:

1. **Attributed Save work now depends on memo state** (medium, provenance): on a Save that
   re-normalises an already-admitted envelope, `save.unit.*` phases are served from the memo and do
   not appear, while earlier pinned F9 artifacts contain them. Not an identity or acceptance
   divergence — the revision value is unchanged and `verifyUnitContentRevisions` still recomputes
   independently — but an owner must compare like cache state. Documented in `perf/README.md` and in
   the memo's own comment rather than "fixed" by re-emitting phases for work that did not run.
2. **A contract comment had drifted** above the new options type instead of the function it documents;
   restored, and a one-line contract sentence added for the options object.
3. **The memo comment over-promised** ("attribution still sees the digest it replaces"); corrected to
   say a memo hit emits no phases and why.
4. **A subtle invariant was undocumented**: `reconcileKind`'s `removed = size - walked.length` is
   correct only because `size` is read after the walk (fresh insertions cancel against `walked`).
   A comment now says so, because the "obvious" simplification would leak stale ids.
5. Confirmed intact, independently: the delta certificate's bail-outs are complete for the compiler's
   producers (including an Opening changing host and a Room that stopped compiling); `applyDelta`
   mutates nothing when it refuses; lazy output is snapshot-isolated (`fork()` + copy-on-write ids) so
a plan read after a later evaluation is exact; `planTargetsLiveView`'s descriptor copy resolves
every getter against the same closures; `wallUnchanged`'s pairing is a bijection over the derivation's
field set, so it cannot prove a changed Wall unchanged; the route keeps exactly one Plan retention
point and every subject read goes through the indexed probes; lifecycle leases and the deletion fence
still refuse before any snapshot installs; visitor rendering imports nothing from the authoring Plan
or compile session.
6. **A merge-induced attribution defect, found and fixed** (`d89554b1`): `main` passed
   `SaveWorkInstrumentation` to `verifyUnitDependencyLocks` *positionally*, and the S06 signature
   takes an options object, so the merged `save.ts` call passed the instrumentation in as options and
   `options.instrumentation` was `undefined`. The lock's `save.lock-source-id` digest still ran, but
   unmeasured, so an F9 trace would have shown a silently missing phase with no failing test to say
   so. The call site now passes `{ instrumentation }`. This is attribution, not identity: the
   resolved source id and every refusal are unchanged, and admission's `knownSourceContentId` path
   was already correct.
7. **Record staleness corrected**: the header status and one earlier paragraph still described the
   review and Bench 2 state from before those rounds ran.

One reviewer's low-severity finding did **not** hold on inspection, and is recorded as dismissed
rather than "fixed": the phase-list assertion in `units-canonical-form.test.ts` cannot be
order-dependent, because the memo is written only for a deeply frozen value (`canonical.ts:148`) and
the test's plain object literal is never frozen — so calling the plain digest first cannot warm a hit
the instrumented call would then miss.

**Test-policy changes made during integration, and why they are not weakening.** Three whole-tree or
whole-sweep correctness tests crossed the default 5 s budget only when ~200 files transform in
parallel (`legacy-isolation`'s tree scan runs in 1.5 s alone and 7 s under full parallel load; the two
layout sweeps run in ~2 s alone and ~9 s under load). Each now states its own budget — an option
object only — and no assertion changed. The lifecycle deletion case replaced a single flushed
macrotask with a wait on the observable condition (`vi.waitFor(() => publicationReads === 1)`); it
still proves the refusal it names (no dialog, the unpublish-first notice, no delete call) and then the
inactive-publication dialog and post-cleanup navigation. That test was flaky 1-in-3 before the change
and passed five consecutive runs after it.

**Correctness verification actually run on the merged tree.** `check:project-model`,
`check:layout-core`, `check:camera-core`, `check:api`, the editor `check` (svelte-check: 0 errors,
0 warnings) and the editor `build` pass. The API suite passes; the editor's fast lane passes
**176 files / 2,282 tests**, the architecture lane **22 files / 180 tests**, the heavy lane **11 files /
138 tests**, and the durable default `npm test` — all 209 files, **2,600 tests** — passes after the
budget correction. The all-in-one contention is now characterised rather than guessed: it is
machine saturation from transforming ~200 files concurrently, not product work (the same tests run in
1.5–2.3 s alone and pass in their own lanes).

**Locality the owner can test in Bench 3, and what it still costs.** `N` compiled sources, `F`
fragments, `S` sources, `k` changed sources, `c` placements per source, `Δ` records whose identity
changed:

| Interaction | Guarantee | Remaining cost |
| --- | --- | --- |
| Accepted edit (delta proved) | only the changed records re-derive; zero field comparisons; no legacy-array materialisation; output built on first read | `O(Δ log N)` root visits + `O(k·(c + log S))` |
| Accepted edit (no provable delta) | complete allocation-free walk, still no sort | `O(N·c)` comparisons + `O(k'·c)` derivations |
| Parameter change | re-derives every source once | `O(N·c)`; no sort |
| Pan / orbit | one retained evaluation; live target through the wrapper; lazy fields are not forced | `O(1)` in the Plan |
| Selection echo, membership, card facts | indexed probes | `O(log S)` per probe |
| Click | screen-space broad phase, same exact test and priority order | build `O(F log F)` once per generation, then `O(v + c log c)` |

Global terms that remain, named rather than hidden: the object unit has no persistent root, so a
rebuilt object unit is compared by reference over all objects; a membership change cannot be proved
positionally and takes the complete walk; array insertion for ids is `O(k·S)`; a retained record map
probe is `O(log S)`; envelope canonicalisation and the flat SHA-256 are `Ω(bytes)` (T3); draw
submission is one per mesh (H6); cold open is unchanged; and a deeply frozen unit's repeat digest is
served from the memo (documented above).

**Bench 3 candidate readiness.** The candidate is exact on every correctness check this record can
run, integrates `main` with no rebase and no method change, and its interaction layer no longer
contains a whole-project term an edit must pay. **Owner decisions still open:** Bench 3 itself
(owner-run, and the only place these gains become measured claims); T3 review of the Plan evaluator's
retention protocol, the compiler-delta certificate and the Plan-key/retained-target change; whether
the compile generation belongs on every fragment; and the already-open H6/H9 questions. Nothing was
merged or deployed, and no acceptance state changed.

Stop here before the owner benchmark and acceptance.
