# T1.P02.S06 — acceptance record: Performance foundation

**Slice:** T1.P02.S06 · **Status:** approved and released; setup step implemented (PR #190), not
accepted. Bench 1 has not run and waits on the owner's scope decision ·
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
PR #190. Setup commit `619f578e`; review fixes `9a9b3bdc`. Later harness fixes and this record
land on the same branch.

**Verification.** At the setup tree (identical to `619f578e`), on Node 26.7: `check:layout-core`,
`check:project-model`, `check:camera-core`, `check` (svelte-check) and `build` pass, and
`npm test` passes 189 files and 2,440 tests, including the heavy and arch lanes. Later commits
change only `apps/editor/perf/**` and docs, which these lanes do not import. Node 22.11 and 23.7
fail the jsdom suites (ERR_REQUIRE_ESM; undici zlib) independently of this slice.

**Workloads** (`npm run perf:workloads`; git-ignored cache keyed by inputs, formats and generator
sources). `--verify` passes for grid-S, grid-M and the museum: the digest reproduces and the
id-rewritten copy admits without findings.

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
| realistic-L | — | — | — | — | unrun: needs per-source asset approval and an isolated API stack |

**Censuses E1–E5 — census, not timing.** Full run at the setup tree; E5 rerun at `9a9b3bdc`
with identical results. Digests as above.

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

**Smoke checks — smoke, not evidence.** `perf:bench --smoke` at `9a9b3bdc` (2,149 s, setup 11.7 s,
not contaminated, Chrome 155.0.8059.85). Every flow passes at grid-S, M, L and XL (realistic-L
reported unrun), and E5 and the transferred rows (F1, F10, F13 Preview) pass. The sweep latency
phase fails because the tab crashes at sweep-H10; see
[the decision package](./scale-reconciliation.md#1-what-the-setup-already-shows) (F2). After
that run, the drag flow waits for the Stage to settle before sampling, and each phase keeps its
own Playwright artifacts.

**Packages admitted:** none.

**Withdrawn observation.** An earlier smoke run suggested F13 retained about 166 MiB after close
at grid-XL. That was the harness's own reference to the last rendered scene, fixed in `9a9b3bdc`.

## Bench 1 handover

Not handed over yet. Bench 1's scope, its frozen command and its duration depend on the owner's
decisions D1–D9 in [the decision package](./scale-reconciliation.md#6-owner-decisions). With
today's scope the command would be
`npm run perf:bench --workspace @portfolio/editor -- --label bench-1` on Node 26, on a quiet
machine (1-minute load under 4.0) on AC power, with fresh workloads. A planning model puts it at
about 6–12 h, and the sweep-H10 drag row cannot complete.

On the owner's direction (2026-10-24), once the scope is ruled and the approved changes pass their
smoke check, the agent starts Bench 1 itself instead of handing the command over. The owner still
rules on whether the pass counts (A.7).
