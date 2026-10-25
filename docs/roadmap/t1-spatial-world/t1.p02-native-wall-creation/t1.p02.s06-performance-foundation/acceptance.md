# T1.P02.S06 — acceptance record: Performance foundation

**Slice:** T1.P02.S06 · **Status:** approved and released; setup step implemented (PR #190) with
the owner-ratified C.2 amendment; Bench 1 recorded (owner-directed, counted by the owner's A.7
ruling, 2026-10-25); optimize step released and implemented in part (D.1, D.2, D.4; D.3/H4–D.6
not landed); Bench 2 not run; not accepted ·
**Plan:** [implementation-plan.md](./implementation-plan.md) (owns the scope and criteria) ·
**Decision package:** [scale-reconciliation.md](./scale-reconciliation.md) ·
**Phase:** [T1.P02](../README.md) · **Register:** [phase slice register](../README.md#slice-register)

`T1.P02.S06` is an owner-authorized, released child of T1.P02
([record](../../../../reference/decisions/performance-foundation-authorization-2026-10-24.md)).
This record claims no measurement, gate state, capability entry or acceptance. It is not the
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
   before Bench 2. Bench 2 and Bench 3 at the same hard-tier method as Bench 1, so the passes stay
   comparable.
5. **Pending outside S06.** PR #189's merge as research (D7, its owner); the realistic-L
   prerequisites (D9); the execution-plan lab plan, due before Bench 2 (D6).

## Optimize step (D.1–D.6) — implementation state (2026-10-25)

**Owner direction (2026-10-25).** Move to optimization; do not reopen Bench 1, repeat broad
profiling or re-quantify confirmed superlinear behaviour. Bench 1 and Bench 1b jointly count as the
first pass under the A.7 ruling, and its characterization is accepted as the implementation starting
point. H6/H8/H10, WebGPU, a new Plan renderer, HLOD, streaming, new content identity and the
world-scale laboratory stay out of scope.

**Landed in this step (branch `t1/p02-s06-bench-setup`, PR #190):** D.1 (H3), D.2 (H2) and D.4
(H5). **Not landed:** D.3 (H1, H4) and D.6 (H9). Nothing below is Bench 2 evidence: every figure is
a deterministic Node count or a disposable diagnostic, and each is labelled as such.

### Amended measurement scope — request recorded, not yet ruled

Bench 1 and Bench 1b jointly count as the first of three passes (A.7). The remaining passes are
proposed as follows. **The omissions stay open obligations until the owner rules**; nothing here
waives them.

| Obligation | Proposed Bench 2/3 disposition | Why |
| --- | --- | --- |
| Hard S/M/L rows: F2 admission and open, F3, F4, F8, F7, F13, D4, and the per-edit evaluation budget | **Kept unchanged** — same method, same budgets, same cache states | These are the hard budgets; nothing here dilutes them |
| `grid-XL` browser timing | **Omitted** from Bench 2/3; the existing grid-XL smoke and census rows stay labelled *probe* | 4–8 h per pass for a Target row that the L row already bounds. Its **hard** clause — no crash, no context loss, no single main-thread block over 1 s, an honest progress/refusal state — stays open and is rechecked by the grid-XL smoke and the T1.P02.S04 gate |
| Sweep latency rows (H3/H10/D3/D10 latency, incl. F3/F4/F8 at sweep-H10) | **Omitted** from Bench 2/3 | 20+ h per pass, mostly the report-only F3/F4/F8 leg; E5 already carries the semantic-independence and pixel evidence at ×3/×10 |
| E5 (browser, all seven workloads) | **Kept** — E5 on the optimized revision before Bench 2, as the plan requires | The correctness differential the optimize step must not lose |
| realistic-L | Stays unrun (prerequisites unchanged, D9) | Unchanged |

Proposed ruling for the record: *"Bench 2 and Bench 3 run the hard S/M/L tiers at Bench 1's method,
with E5; grid-XL timing and the sweep latency rows are deferred to the T1.P02.S04 exhaustive gate,
not waived."* Until that ruling exists this record disposes of none of those rows.

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
216–233 ms p95). Confirmed only by Bench 2.

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

### Not landed, and why

| Item | State | What it costs today | What it needs |
| --- | --- | --- | --- |
| D.3 / H4 representation (retained per-entity meshes, one imperative subtree) | **Not landed** | F4 at L still spends 167 ms in two representation builds; F8 164 ms; F2 at L 4.9 s in the Stage mount | T3-owned shared Stage code and a Svelte-component-per-mesh rewrite; a dedicated slice with its own correctness gates |
| D.3 / H4 ownership (release superseded geometries) | **Not landed** | +2,968 live geometries per commit at L — a **hard** F13 clause ("geometries and textures back to baseline") still missed | Same rewrite owns the lifetime; a standalone release pass would fight the mount path |
| D.3 / H1 incremental compiler | **Not landed** | The second compile per accepted result (~95 ms at L), the whole move compile, and the per-edit evaluation budget (≤ 8 ms at M, ≤ 16 ms at L) which D.1 does not reach | The locality derivation, its dependency set and the full-compile oracle; the largest single experiment in the matrix |
| D.6 / H9 shadow invalidation, render-on-demand | **Not landed** | F7 meets every row; idle-frame rendering is a flat saving, not a budget risk | A browser framebuffer differential, which this step did not run |

**Review finding carried forward (pre-existing, not introduced here).** A physical Opening's key
embeds `['physical-wall-geometry', floorId, wallId]` — the host Wall's *identity*, not its geometry —
and `layout-geometry.ts` did so before this change as well (the same literal appears in the removed
line of the D.1 diff). An Opening's compiled point and tangent change when its Wall moves while that
key does not, so the key is not change-detecting for retention. Nothing consumes `.cacheKey` for
retention today; it matters to H4, and it is recorded here rather than changed, because changing it
would re-pin the observation digests again.

### Predicted position after D.1, D.2 and D.4 (hand calculation, not evidence)

Bench 1's stage split scaled by the measured counts. Stage rows are **disjoint** as Bench 1 listed
them; the representation and mount terms are unchanged, which is why the L rows stay over budget.

| Row (budget) | Bench 1 p95 | Predicted now | Verdict |
| --- | --- | --- | --- |
| F3 at M (≤ 50 ms hard) | 48 ms | ~18–22 ms | ✓ |
| F3 at L (≤ 100 ms hard) | 216–233 ms | ~70–90 ms | ✓ predicted |
| F4 at M (≤ 100 ms hard) | 163–174 ms | ~100–110 ms | **risk** |
| F4 at L (≤ 200 ms hard) | 717–784 ms | ~400–430 ms | **hard miss** |
| F8 at M (≤ 100 ms hard) | 112 ms | ~85–95 ms | borderline |
| F8 at L (≤ 200 ms hard) | 637–671 ms | ~300–360 ms | **hard miss** |
| Per-edit Layout evaluation at M (≤ 8 ms hard) | move 31 ms, compile 24 ms | ~17–20 ms | **hard miss**, H1 |
| Per-edit Layout evaluation at L (≤ 16 ms hard) | move 164 ms, compile 118 ms | ~75–90 ms | **hard miss**, H1 |
| F2 admission at L | 219 ms | ~105–115 ms | ✓ |
| F2 open at L (Target ≤ 2.0 s) | 5,216 ms | ~5.1 s | unchanged (mount) |
| F13 per accepted edit at L (≤ 5 MiB warm, geometries back to baseline) | 6.0–6.2 MiB and +2,968 geometries | ~5.9 MiB and +2,968 | **hard clause still missed** (H4) |

### Review corrections applied

An independent four-lens review (admission semantics, layout-core indexing, evidence integrity,
code quality) produced these changes to the work above, all included in this commit: the sharing
predicate now compares the whole unit header and every lock-entry field (a revision-only predicate
could install a baseline `unitId` under a captured revision); the Room × Opening join restores
document order for a boundary-ordered walk; the Junction sweep falls back to exhaustive enumeration
when a coordinate is non-finite (a `NaN` makes the sort comparator inconsistent); the plan-box index
keeps inverted boxes in its `wide` list and restarts its query stamp before `Int32` wrap; the pair
counts count unique pairs again so they remain comparable with Bench 1; the H5 probe measures the
coordinator's real copy arm and no longer prints GC noise as retained heap; and the record above
gained the missing hard rows, the recorded facts digests, the corrected F8-at-L arithmetic and the
two open hard clauses.

### Required reviews

`packages/project-model/src/units/**` and `packages/project-model/src/f4/**` (admission and the
adapter contract) are T3-owned: the additions are `shareUnchanged` (optional) and
`prepareValidatedUnitRuntime` / `serializeValidatedProjectEnvelope` (splits that keep the validating
entry points as the only public meaning — each must be handed the value
`validateProjectEnvelope` returned for that same input). The coordinator and Stage admission are
editor-side T3 surfaces. D.1 is `packages/layout-core` (T2). None of these changes a canonical
geometry, an authored format, a selection/preview semantic, visitor isolation or a refusal code.

### Verification at this tree

`check:layout-core`, `check:project-model`, `check:camera-core` and `check` (svelte-check, 0 errors
and 0 warnings) pass; `test:fast` 159 files / 2,147 tests pass; `test:arch` 22 / 178 and `test:heavy`
9 / 125 pass. The probes (`perf/census/probe-d1-differential.ts`, `probe-d2-accept.ts`,
`probe-h5-capture.ts`) are Node-only, take `PERF_WORKLOAD_DIR` pointing at the cached workloads, and
are in no lane. No browser benchmark was run in this step.

### Bench 2 readiness — lean proposed command

```
npm run perf:bench --workspace @portfolio/editor -- --label bench-2 --tiers grid-S,grid-M,grid-L --no-sweep-latency
```

Same method, budgets and cache states as Bench 1b for the hard tiers, plus E5 over the seven
workloads and the transferred rows; no grid-XL tier and no sweep latency rows (subject to the scope
ruling above). Expected runtime ≈ 3 h (2.5–3.5 h): Bench 1b took 95 min for grid-M 2,555 s +
grid-S 1,737 s + E5 858 s + transferred 148 s, and grid-L alone was 7,234 s at Bench 1's slower
revision. Run E5 alone first if the pass is split.

### Owner decisions genuinely required

1. **Amended measurement scope** (above) — ratify, or keep grid-XL and the sweep rows in Bench 2/3.
2. **F4 hand-over contract** — may an adapter attest the acceptance proof on its candidate so the
   host admission reuses the planner's compile (one compile per accepted result)? Without it F4 at L
   cannot meet 200 ms even after H4; it needs T3 contract review, and its alternative is H1.
3. **H4 in this PR or a follow-up slice** — it is the only lever for F2 at L, the representation half
   of F4/F8, the F13 geometry clause and the Opening-key retention gap named above.
4. The already-open Bench 1 question (sweep-H10 drag row method for Bench 2/3) still does not block.
