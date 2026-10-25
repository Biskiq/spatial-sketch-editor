# T1.P02.S06 — acceptance record: Performance foundation

**Slice:** T1.P02.S06 · **Status:** approved and released; setup step implemented (PR #190) with
the owner-ratified C.2 amendment; Bench 1 recorded (owner-directed, counted by the owner's A.7
ruling, 2026-10-25); optimize step released; not accepted ·
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
2. **Characterize (plan C, step 3).** Refit each matrix row's cost model to Bench 1's per-stage
   spans (`drag:stage:*`, `precision:stage:*`, `undoRedo:stage:*`) and work counts. Compare each
   hard row against the performance contract's budgets.
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
