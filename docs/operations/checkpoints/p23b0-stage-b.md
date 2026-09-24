# P23B.0-durable Stage B — checkpoint

TYPE: implementation
STATUS: in progress
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
- `apps/editor/tests/README.md`

ESTABLISHED:
- Updated `main` included merged PR #86 at `32d8f5bb`; branch `codex/p23b-continuation` is based there.
- Commit `89ec1fa2 test(perf): add P23B durable fixture ledger` committed the exact owner payload, fixture ledger, deterministic six-cell CLASS 5 matrix, CLASS 2/3/4 fixture constructors, and initial fixture contract coverage.
- Owner payload is 61,140 bytes; raw and canonical UTF-8 SHA-256 are both `63f15ed8745d08bf5f65ab2c85829d1b9f1df6f36b3a9137147b70d5d09f5e05`. The test confirms canonical bytes exactly equal the committed owner JSON and validators/compiler pass.
- Commit `e26bb623 feat(perf): measure P23B editor paths with method v4` completed W3–W5 implementation: `BENCH_METHOD_VERSION = 4`, six interaction metrics and six paths, DEV/`__P2311_PERF__`-gated marks in the Plan viewport, preview state, Layout preview scene and camera controls, the recorder/report contract (`validateP23BBrowserReport`), and the `/dev/perf/p23b` harness. `npm run check -w @portfolio/editor` is clean (0 errors/warnings); the three focused P23B files pass (9 tests).
- `p23b-fixtures.ts` gained a closed `P23BCorrectnessCaseId` union so the correctness dispatch is exhaustively typed under `svelte-check`.
- The six matrix cells and separate owner case run through the existing benchmark APIs. Wall-first compiler and standalone-wall mesh support were added after the first diagnostic exposed legacy-room assumptions.
- Before the implementation commit, `npm run test:perf` showed exactly one expected failure: `bench-report.test.ts` revalidates the checked-in baseline, which is still method v3 and is re-recorded in the remaining W5 step. All other PERF files pass.
- `g3-baseline.json` remains method v3. No P23B baseline report has been downloaded or recorded.

EVIDENCE:
- Committed fixture ledger: `docs/roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/fixture-ledger.json`.
- Owner fixture: `docs/roadmap/p23b-geometry-performance/40-walls.json`.
- Fixture contracts: `apps/editor/tests/lib/layout/p23b-fixture-contract.test.ts`.
- Existing benchmark extensions: `apps/editor/src/lib/bench/plan-bench.ts`, `browser-bench.ts`, `bench-types.ts`, `bench-report.ts`, and `record-baseline.ts`.
- Interaction instrumentation: `apps/editor/src/lib/editor/layout/p23b-interaction-measure.ts`, `LayoutPlanViewport.svelte`, `LayoutPreviewScene.svelte`, `layout-preview-state.svelte.ts`, `EditorCameraPreviewControls.svelte`, `EditorCameraRig.svelte`, and the dev-only `initialLayout`/`initialScene` seeds in `EditorApp.svelte`.
- DEV harness: `apps/editor/src/routes/dev/perf/p23b/+page.svelte` and `+page.server.ts`.
- Focused contract tests: `apps/editor/tests/lib/bench/p23b-baseline-contract.test.ts` and `apps/editor/tests/lib/editor/layout/p23b-interaction-measure.test.ts`.

CURRENT:
- HEAD is `e26bb623`; only the ops/checkpoint documents remain modified in the worktree. `g3-baseline.json` is untouched.
- Remaining work is W5 recording, W6 report and W7 budget policy: live browser capture on `/dev/perf/p23b`, the CLI record, the slice record, and the continuation PR.
- Native Chrome is Chrome 153.0.8010.54. DPR and active renderer/GPU have not yet been captured. The ratified Wall-authoring target `[24,24]`→`[28,24]` may require an unmeasured view pan before capture. Do not change the fixed target without checking whether it is reachable.

NEXT:
1. Commit the ops/checkpoint update so the tree is clean, then reload `/dev/perf/p23b` in native Chrome and record actual browser/UA, DPR, renderer/GPU, machine/OS/Node and sampling. Capture all six interaction paths and download the report; make actual counts/unavailable boundaries explicit and confirm the fixed Wall-authoring target is reachable.
2. Record through the existing CLI with `--full --p23b-browser-report <report>` (the CLI must remain the only baseline writer), write the W6 report outside baseline JSON, run full PERF/check/architecture/build gates and baseline-write isolation checks, then create/push/update exactly one continuation PR. Stop implementation-review-ready and wait for owner review.

OPEN:
- Latest `bench-report.ts` validation requires seven workloads, six path protocols and all boundaries; `bench-report.test.ts` stays red until the v4 baseline lands in the same PR.
- Determine actual native Chrome graphics/DPR metadata and confirm the target Wall-authoring area can be sampled with the ratified settings.
- Capture real per-path sample counts and mark nesting; do not infer GPU upload or painted presentation from Svelte `tick()` or `requestAnimationFrame`.
- W6 report must list p50/p95, workload/path provenance, bottleneck attribution limits, mark nesting without summing, and remaining unknowns. Keep historical Pass A/B values clearly non-comparable and outside baseline JSON.
