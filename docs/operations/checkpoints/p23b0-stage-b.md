# P23B.0-durable Stage B — checkpoint

TYPE: implementation
STATUS: implementation-review-ready (baseline recorded; awaiting owner review — not accepted, not merged)
GOAL: Complete owner-authorized P23B.0-durable W1–W7 on the single continuation branch/PR, then stop implementation-review-ready. Do not accept/close the slice, merge its PR, alter phase sequence, or begin P23B.4.

CONSTRAINTS:
- PR #86 is merged. Continue from updated `main` on `codex/p23b-continuation`; phase README authorizes one continuation branch and one PR through the sequential P23B slices.
- Preserve the ratified P23B.0 plan and Stage A handoff. Do not reopen Stage A or change the phase SEQUENCE.
- This is measurement infrastructure only: reuse the existing benchmark/DEV instrumentation; no optimization, persisted-schema change, new interaction system, or product behavior change while instrumentation is disabled.
- Preserve canonical Layout compilation, Plan/3D/visitor parity, visitor isolation, document ownership, deterministic selection/history, and existing camera navigation/motion.
- Keep deterministic enforced budgets unchanged. Add no enforced timing threshold and do not weaken assertions or silently rebaseline.
- No commits unless required to complete the authorized reviewable implementation. The user explicitly requested identifiable implementation commits. Do not merge, run slice-closeout, mark accepted, or start P23B.4.

READ:
- `docs/README.md`
- `docs/operations/current.md`
- `docs/roadmap/p23b-geometry-performance/README.md` (§SEQUENCE and owner-authorized execution arrangement)
- `docs/roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/2026-09-22-P23B.0-durable-measurement-completion.md`
- `docs/roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/2026-09-24-P23B.0-ratification-handoff.md`
- `docs/roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/2026-09-24-P23B.0-durable-measurement-report.md` (W6)
- `docs/roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/2026-09-24-P23B.0-budget-policy-record.md` (W7)
- `apps/editor/tests/README.md`

ESTABLISHED:
- Updated `main` included merged PR #86 at `32d8f5bb`; branch `codex/p23b-continuation` is based there. Stage A landed on this branch at `e26bb623` (W1–W5 implementation); the branch now also carries the recording corrections, the recorded v4 baseline, and the W6/W7 records.
- Commit `89ec1fa2 test(perf): add P23B durable fixture ledger` committed the exact owner payload, fixture ledger, deterministic six-cell CLASS 5 matrix, CLASS 2/3/4 fixture constructors, and initial fixture contract coverage.
- Owner payload is 61,140 bytes; raw and canonical UTF-8 SHA-256 are both `63f15ed8745d08bf5f65ab2c85829d1b9f1df6f36b3a9137147b70d5d09f5e05`. The test confirms canonical bytes exactly equal the committed owner JSON and validators/compiler pass.
- Commit `e26bb623 feat(perf): measure P23B editor paths with method v4` completed W3–W5 implementation: `BENCH_METHOD_VERSION = 4`, six interaction metrics and six paths, DEV/`__P2311_PERF__`-gated marks in the Plan viewport, preview state, Layout preview scene and camera controls, the recorder/report contract (`validateP23BBrowserReport`), and the `/dev/perf/p23b` harness.
- `p23b-fixtures.ts` gained a closed `P23BCorrectnessCaseId` union so the correctness dispatch is exhaustively typed under `svelte-check`.
- The six matrix cells and separate owner case run through the existing benchmark APIs. Wall-first compiler and standalone-wall mesh support were added after the first diagnostic exposed legacy-room assumptions.
- Recording corrections committed after the implementation commit, each an identifiable perf commit: `805fed25` (sub-threshold release is a selection, not an edit boundary), `14b48dc7` (a sub-threshold press records no drag boundary), `4bd41245` (the shipped guided-camera transport is marked), `a82dfc76` (owner-deferred paths are recorded explicitly instead of silently omitted), `6f0ccbf8` (shipped Plan handlers stay under their own names), `41fd3f17` (a knot-control bend is `bend-knot-edit`), `a6d58af0` and `b9a492da` (a press boundary is timed first and named from the interaction it turns out to be, because a Wall press both selects and arms a move).
- `a82dfc76` added `deferredInteractionPaths` to both the browser report and the baseline, so the owner's 3D deferral is auditable and a missing input/release sample is admissible only with non-empty owner-decision text.
- Owner decisions carried into the record: the preview browser is an approved measurement browser (native is stronger, so results transfer); the owner's manual samples are complementary evidence, not a second authority; guided 3D navigation capture is deferred because the reported slowdown is in the 2D Plan paths.

EVIDENCE:
- W6 measurement report: `docs/roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/2026-09-24-P23B.0-durable-measurement-report.md`.
- W7 budget policy record: `docs/roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/2026-09-24-P23B.0-budget-policy-record.md`.
- Recorded baseline: `apps/editor/src/lib/bench/baselines/g3-baseline.json`, method v4, SHA-256 `ccf6c6e42c7ca8f60b248879dddc4d5342d6859bd3aeec7d51c549fbd061fad1` (57,239 bytes), naming policy commit `c11938fe0d5c721a896bb92dcb722f2273480feb`, clean tree at `b9a492da`, content hash `9a59d9178e577ebb`.
- Committed fixture ledger: `docs/roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/fixture-ledger.json`.
- Owner fixture: `docs/roadmap/p23b-geometry-performance/40-walls.json`.
- Fixture contracts: `apps/editor/tests/lib/layout/p23b-fixture-contract.test.ts`.
- Existing benchmark extensions: `apps/editor/src/lib/bench/plan-bench.ts`, `browser-bench.ts`, `bench-types.ts`, `bench-report.ts`, and `record-baseline.ts`.
- Interaction instrumentation: `apps/editor/src/lib/editor/layout/p23b-interaction-measure.ts`, `LayoutPlanViewport.svelte`, `LayoutPreviewScene.svelte`, `layout-preview-state.svelte.ts`, `EditorCameraPreviewControls.svelte`, `EditorCameraRig.svelte`, and the dev-only `initialLayout`/`initialScene` seeds in `EditorApp.svelte`.
- DEV harness: `apps/editor/src/routes/dev/perf/p23b/+page.svelte` and `+page.server.ts`.
- Focused contract tests: `apps/editor/tests/lib/bench/p23b-baseline-contract.test.ts` (5), `apps/editor/tests/lib/layout/p23b-fixture-contract.test.ts` (3), `apps/editor/tests/lib/editor/layout/p23b-interaction-measure.test.ts` (5).
- Gate output on the recorded HEAD: `npm run test:perf` 7 files / 35 tests pass (1 skipped); `npm run test:arch` 23 files / 254 tests pass; `npm test` 324 files / 4,734 tests pass (1 skipped); `npm run check -w @portfolio/editor` 0 errors, 0 warnings; `npm run build -w @portfolio/editor` succeeds.
- Baseline write isolation: the baseline hash is identical before and after the full `npm test` run.

CURRENT:
- HEAD is the baseline commit on `codex/p23b-continuation`; the worktree is clean apart from this ops/checkpoint update. `bench:record` was the only writer of the baseline, run with the downloaded harness report as validated input (`--full --p23b-browser-report <report>`).
- W1–W7 are complete: fixture identity and contracts (W1/W2), method-v4 metric vocabulary (W3), presentation-gap boundaries (W4), harness + the recorded post-policy/pre-optimization baseline (W5), the W6 report, and the W7 policy record.
- The capture recorded all five 2D paths with 20 completed actions each (selection, plan-drag-edit, bend-knot-edit, plan-pan-zoom at the default view; wall-authoring in a view panned/zoomed to the ratified `[24,24]`→`[28,24]` region). `guided-3d-navigation` carries the owner's deferral text.
- The failed/superseded capture attempts are not evidence: one attempt was recorded and deliberately reverted so the source content hash matches the final HEAD, and one preparation attempt was invalidated when the DEV server exited mid-run.
- Native Chrome on this machine is Chrome 153.0.8010.54; the recorded capture used the owner-approved preview browser (Chromium 130 / Electron 33.4.11) at DPR 1 with the renderer recorded. The difference is stated as an environment limit in W6.

NEXT:
1. Push `codex/p23b-continuation`, create/update exactly one continuation PR (baseline + W6/W7 records + this checkpoint) and stop implementation-review-ready. Do not merge, accept, or start P23B.4.
2. Await owner review; the owner may optionally repeat the six captured paths in native Chrome (the report states what that would close). No further implementation is authorized by this checkpoint.

OPEN:
- U-1..U-6 in the W6 report (native-Chrome comparison, presented-frame latency, GPU upload/driver cost, the deferred 3D path, the flush cost split across the 39 nested marks, and the gesture-kinds coverage of the drag/bend populations) remain open, each with the observation that would close it.
- The P23B.4 gate stays closed until this baseline is accepted. Acceptance is the owner's call and is not implied by these gates.
- `W6` numbers are advisory wall-clock samples from one developer machine and one session; they are not a budget and cannot be enforced without a separate owner decision.
