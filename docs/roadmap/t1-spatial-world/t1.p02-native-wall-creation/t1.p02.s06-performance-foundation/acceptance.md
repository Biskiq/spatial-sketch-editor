# T1.P02.S06 — acceptance record: Performance foundation

**Slice:** T1.P02.S06 · **Status:** approved and released; setup step implemented (PR #190) with
the owner-ratified C.2 amendment; Bench 1 launched by the agent on the owner's direction
(2026-10-24); not accepted ·
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
--xl-drag-cache warm`, from the PR #190 head that carries this record. It runs on Node 26.7 with
the pinned branded Chrome 155.0.8059.85 and the fresh workloads above. The pass covers:

- every tier peak first, with grid-XL's F3/F4/F8 warm only (D5);
- the A.6 old-method rows;
- the traced windows;
- E5 over all seven workloads;
- the sweep latency rows at museum ×1 and sweep-H10 (D3);
- the transferred rows.

**Launch.** On the owner's direction (2026-10-24), the agent launched the pass itself instead of
handing the command over, and its task ended at the launch. A detached launcher waits for a quiet
machine (1-minute load under 4.0 and no Vitest, for up to 90 minutes). It then runs the command
under `caffeinate -dims`, so the Mac neither sleeps nor dims. The pass manifest records the start,
the commit, contamination, deviations and every phase. The launcher's own record (launch time,
wait, load and power) is outside the repository.

**Deviation.** The pass runs on AC power. The owner direction is on battery with Low Power Mode
off, and Low Power Mode is off. The planned duration would exhaust the battery. The manifest
records the deviation.

**Duration (planning model from the re-smoke's per-result costs, not evidence).** The tiers and
fixed phases take about 5–9 h. The sweep latency rows take about 15 h:

- sweep-H10 F3/F4/F8, about 13 h over its three cache states (F12);
- the sweep-H10 orbit, about 1.9 h;
- the museum, about 0.6 h.

Total: about 20–24 h.

**Next.** The owner rules on whether the pass counts (A.7). The agent then records it here as an
owner-directed pass.
