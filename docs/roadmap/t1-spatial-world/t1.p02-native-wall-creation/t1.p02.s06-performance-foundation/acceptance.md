# T1.P02.S06 — acceptance record: Performance foundation

**Slice:** T1.P02.S06 · **Status:** approved/released; setup and owner-directed Bench 1 recorded;
persistent representation takeover implemented on PR #190 and awaiting fresh independent review.
Bench 2 has not run; S06 is not accepted or merged. ·
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
   before Bench 2. Bench 2 and Bench 3 at the same hard-tier method as Bench 1, so the passes stay
   comparable.
5. **Pending outside S06.** PR #189's merge as research (D7, its owner); the realistic-L
   prerequisites (D9); the execution-plan lab plan, due before Bench 2 (D6).

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
| Per-edit Layout evaluation ≤ 8 ms M / ≤ 16 ms L (hard) | **predicted met**: per-edit compile 4.9 ms at M and 5.7–6.5 ms at L (Node diagnostic) against 23 / 100 ms cold | Bench 2 F3/F4 |
| F13 "geometries back to baseline" (hard) | **structurally met and counted**: 547 built = 547 disposed, one live geometry per Wall | Bench 2 F13 |
| F13 ≤ 5 MiB retained per accepted edit (hard) | **predicted met**: the representation no longer rebuilds or accumulates the document; heap attribution is browser-only | Bench 2 F13 |
| F2 open at L (Target ≤ 2.0 s) | **predicted ≈ 1.8–2.6 s**, not the 500 ms engineering objective: the mount population is still one component per Room surface and portal | next mount batch + Bench 2 F2 |
| F3 ≤ 100 ms p95 L, F4 ≤ 200 ms, F8 ≤ 200 ms (hard) | **predicted met** (≈ 40–60 / 80–120 / 80–120 ms) — predictions, not evidence | Bench 2 |
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

Earlier independent reviews remain recorded in [review-handoff.md](./review-handoff.md).
They reviewed earlier implementations, not these new persistent algorithms. The fresh
[independent-review map](./review-handoff.md#current-independent-review-boundary) is ready;
no new verdict is asserted. Stop here before independent review, owner benchmark and acceptance.
