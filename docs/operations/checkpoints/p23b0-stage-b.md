# P23B.0-durable Stage B — checkpoint

TYPE: implementation
STATUS: implementation-review-ready (correction round recorded; awaiting the owner's next direction — not accepted, not merged)
GOAL: Complete owner-authorized P23B.0-durable W1–W7 on the single continuation branch/PR, correct the
      five review findings, record a fresh bounded baseline, and return for focused review. Do not
      accept/close the slice, merge its PR, alter the phase sequence, or begin P23B.4.

CONSTRAINTS:
- PR #86 is merged. Continue from updated `main` on `codex/p23b-continuation`; the phase README authorizes
  one continuation branch and one PR through the sequential P23B slices.
- Preserve the ratified P23B.0 plan (revision `4b32034f`) and its 2026-09-25 owner scope amendment (§10
  S-1…S-7). Do not reopen Stage A or change the phase SEQUENCE.
- Measurement infrastructure only: no optimization, persisted-schema change, new interaction system, or
  product behavior change while instrumentation is disabled.
- Keep deterministic enforced budgets unchanged. Add no enforced timing threshold; timing stays advisory;
  do not weaken assertions or silently rebaseline.
- Guided-3D capture remains owner-deferred.

READ:
- `docs/README.md`
- `docs/operations/current.md`
- `docs/roadmap/p23b-geometry-performance/README.md` (§SEQUENCE, the execution-routing amendment, and the
  child-slice status)
- `docs/roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/2026-09-22-P23B.0-durable-measurement-completion.md` (§10 is the 2026-09-25 scope amendment)
- `docs/roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/2026-09-24-P23B.0-durable-measurement-report.md` (W6 — read §0 first)
- `docs/roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/2026-09-24-P23B.0-budget-policy-record.md` (W7)
- `apps/editor/tests/README.md`

ESTABLISHED:
- Stage A landed at `e26bb623` (W1–W5 implementation, method v4); fixtures/ledger at `89ec1fa2`; the
  recording corrections at `805fed25`…`b9a492da`; the first recorded baseline and its records at
  `5aa79606` (PR #87). The owner returned that revision for correction on five findings (W4 unmet by
  findings 1–3; W5 partially evidenced; W6 unmet by findings 1–5; W1–W3 and W7 satisfied).
- Correction round, each an identifiable commit:
  - `d4b4763f fix(perf): correct P23B interaction timing, attribution and capture lifecycle` — consistent
    deferred-boundary origins, `plan-apply` separated from `adapter`, outcome classification
    (accepted/setup/rejected/suppressed/unclassified) with accepted-only distributions, session-isolated
    and settled capture, the straight/all-curved hosted fixtures, and the focused boundary/outcome/
    session tests with controlled clocks.
  - `2021e10e fix(perf): keep a restored viewport and a visible action outcome honest` — viewpoint
    stability read as first-vs-last (the pan/zoom path deliberately moves and restores the view) and a
    DEV per-action outcome global so an operator can see and repeat a refused action.
  - `be525f7c feat(perf): drive the P23B interaction capture from the fixed protocol` — the DEV scripted
    driver (`src/routes/dev/perf/p23b/drive.ts`) that hosts each fixture, sets one shared px/m ladder,
    performs the fixed actions, verifies each action's path/outcome against the live ledger, restores
    every mutating action through the editor's own undo, and records fixture resets.
- Owner direction 2026-09-25 (recorded in the plan's §10 and in W6 §1.1): curvature is a suspected
  amplifier and not an established root cause (a 10-room straight-wall layout also feels sluggish); the
  interaction scope was extended to the 40-straight and 40-all-curved matrix cells alongside the owner
  workload on equivalent targets, viewport, warm-ups, action counts and resets; the owner's own
  three-fixture manual capture is accepted as owner-supplied evidence with no further scripted capture
  required; report internal pipeline cost separately from interaction latency, distinguish straight-shared
  from curvature-added cost, do not assume "rendering" is the bottleneck, and move on to the fix after
  review.
- Owner payload is 61,140 bytes; raw and canonical UTF-8 SHA-256 are both
  `63f15ed8745d08bf5f65ab2c85829d1b9f1df6f36b3a9137147b70d5d09f5e05`. All six matrix cell identities and
  hashes are unchanged, and `p23b-40-wall-straight-v1` was never converted while it served as the control.

EVIDENCE:
- W6 measurement report: `docs/roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/2026-09-24-P23B.0-durable-measurement-report.md`.
- W7 budget policy record: `…/2026-09-24-P23B.0-budget-policy-record.md`.
- Recorded baseline: `apps/editor/src/lib/bench/baselines/g3-baseline.json`, method v5, SHA-256
  `5534926e3a2dbceed9e0383da5914f95ff2824d0d90a760ca48f859b56ec5a8d` (107,521 bytes), naming policy commit
  `c11938fe0d5c721a896bb92dcb722f2273480feb`, clean tree at `be525f7c`, content hash `07e72ec58fd4fff6`.
- Interaction capture: browser session `cd21940d-2c97-4e0a-bc2e-56a54ec38fce` with one isolated session per
  hosted fixture — `owner-40-curved-v1` `75a1972f…`, `p23b-40-wall-straight-v1` `d98b154e…`,
  `p23b-40-wall-all-curved-v1` `98db5040…` — all three at `19.292586186549904 px/m`, first-vs-last
  viewpoint stable, 0 dropped boundaries, settled, 5 warm-ups excluded per path, and fixture resets 75/50/75
  against 25 accepted authoring actions each.
- Owner-supplied capture (not in the baseline): sessions `3106404b…` (straight), `4907ee33…` (all-curved),
  `12072b2e…` (owner); reported in W6 §7 with the reasons the method-v5 gates cannot admit it.
- Owner fixture: `docs/roadmap/p23b-geometry-performance/40-walls.json`; ledger
  `…/p23b.0-measurement-foundation/fixture-ledger.json`.
- Scripted capture driver: `apps/editor/src/routes/dev/perf/p23b/drive.ts`; harness
  `…/p23b/+page.svelte` and `+page.server.ts`.
- Focused tests: `apps/editor/tests/lib/editor/layout/p23b-interaction-measure.test.ts`,
  `apps/editor/tests/lib/bench/p23b-baseline-contract.test.ts`,
  `apps/editor/tests/lib/layout/p23b-fixture-contract.test.ts`.
- Gate output at `be525f7c` with the v5 baseline recorded: `npm run test:perf` 7 files / 53 tests pass
  (1 skipped); `npm run test:arch` 23 files / 254 tests pass; `npm test` 324 files / 4,752 tests pass
  (1 skipped); `npm run check -w @portfolio/editor` 0 errors, 0 warnings; `npm run build` succeeds for both
  apps. Baseline write isolation: the baseline SHA-256 is identical before and after the full `npm test`
  run.

CURRENT:
- HEAD is `be525f7c` plus this correction-round documentation; the worktree is clean apart from those
  documentation edits and the re-recorded baseline. `bench:record` was the only writer of the baseline,
  run with the downloaded harness report as validated input (`--full --p23b-browser-report <report>`).
- THE FINDING (W6 §0): every fixture is slow, including the 40-straight-wall control — accepted Wall
  authoring 262.6 ms, accepted rigid edit 208.4 ms, selection click 121.7 ms at zero curvature. Curvature
  amplifies the same boundaries (Svelte flush 15.5–16.3× on selection and drag/edit, 15.3× on Plan
  pan/zoom) while the canonical planner call rises only 3.0×. Plan pan/zoom plans nothing at all, yet its
  flush is the most curvature-sensitive boundary in the record — so the cost is in the Plan reactive
  render/flush path, not in the planner and not in 3D adapter work (`adapter` is unavailable on every 2D
  path).
- The v4 report's "the cost is outside the canonical planner" conclusion is withdrawn: v5 separates
  `plan-apply` from `adapter`, and the v4 adapter bucket's owner-case values (p50 49.5/56.6 ms) reappear as
  the v5 `plan-apply` boundary (49.8/53.5 ms).
- The v4 inflated accepted-release distribution is corrected: the owner wall-authoring release moves from
  ≈95 ms (40 samples for 20 authored Walls) to 692.8 ms (25 accepted commits beside 25 recorded setup
  clicks); the all-curved cell's authoring release is 1,984.8 ms.
- Sampling statement corrected: each deterministic tier records 15 metrics, from 2 warm-up + 5 measured
  samples (chopin/small/medium) and 1 warm-up + 3 measured samples (large).
- Preview-browser approval permits the environment; it does not establish transferability to native Chrome,
  and no transferability claim is made.
- W1–W7 disposition after this round: W1 satisfied, W2 satisfied, W3 satisfied (method v5 semantics
  recorded), W4 corrected (origins, attribution, accepted-release classification, capture lifecycle), W5
  corrected and extended (three hosted fixtures, one shared viewport, enforced sampling, scripted driver),
  W6 rewritten from the recaptured evidence, W7 satisfied with aligned metric descriptions and unchanged
  enforced budgets.

NEXT:
1. Owner's next direction on the single continuation PR (#87). Accept, return, or request the optional
   native-Chrome comparison; the owner's standing direction is then to move on to the fix.
2. On acceptance: run the same-branch slice-closeout/self-check, then reconcile P23B.4's plan and complete
   its architecture-review/owner gate. Do not merge, accept, or start P23B.4 from this checkpoint.
3. P26 planning may continue independently.

OPEN:
- U-1…U-7 in the W6 report (native-Chrome comparison, presented-frame latency, GPU upload/driver cost, the
  deferred 3D path, what inside the flush dominates, why the constructed all-curved cell is slower than the
  fully curved owner case, and drag/bend gesture coverage), each with the observation that would close it.
  U-5 is the recommended first P23B.4 attribution step; it is not authorized here.
- The P23B.4 gate stays closed until this baseline is accepted. Acceptance is the owner's call and is not
  implied by these gates.
- W6 numbers are advisory wall-clock samples from one developer machine and one browser session; they are
  not a budget and cannot be enforced without a separate owner decision.
