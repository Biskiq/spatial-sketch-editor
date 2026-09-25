# Current

PHASE: P23B
CHILD: P23B.5-caching-reuse — SHIPPED and closed 2026-09-25 (PR #90 squash-merged) after the
       owner REVIEWED AND ACCEPTED it with no remaining blocker; routine slice-closeout ran on
       the `P23B.5` branch. M-3 = SHIPPED (preflight-only) — one bounded gesture-scoped sample
       owner for the transient preflight only; release-scope M-3 stays unreachable and
       unimplemented. The plan is a path-preserving closed stub (anchor `75fbd8a0`, tag
       `closed/p23b.5`). The committed reuse-counter gate stays LIVE (perf lane +
       `reuse-counter-ratchet.json`), whose only writer is `npm run reuse:record --reason "…"`
       (requires the reason, refuses a dirty tree, refuses an incoherent measurement, no test
       writes it) — no budget metric added, no baseline re-recorded.
       NEXT STEP: the owner-authorized MEASUREMENT-ONLY step (phase README, P23B.5-closeout
       routing amendment) — P23B.7 S1 extended to the wall-authoring release plus P23B.6 S1, on
       a new branch from updated `main`; it starts no optimization and ends at a ranking.
       Prior child P23B.4-compilation-invalidation SHIPPED
       2026-09-25 on `P23B4` (PR #88; accepted HEAD `4cbcc370` vs base `d7b9de4e`;
       stubs + anchor `4cbcc370`, tag `closed/p23b.4`). U-1 declined, Rust/WASM
       undecided until P23B.8.
STAGE: P23 closed 2026-09-22 (owner ruling, PR #73; final gate P23.16 accepted). P23B (Geometry
       Performance & Stabilization) follows the owner-ratified sequence between P23 and P26. P23B.3
       synthesis and implementation criteria were ratified at `e139a18b`. P23B.3a's Option E policy was
       accepted, shipped and merged through PR #82 at `c11938fe` on 2026-09-24 after S1–S8 and OR-D12-1…6
       passed. S5/S6 re-reviews are complete by owner confirmation; GitHub has no corresponding review
       entries. P1 post-merge anchor recovery passed; the original `main` ruleset was restored after the
       owner-authorized, temporary linear-history exception. The integration of current `main`
       preserves both P23B.3a's status and P26's accepted Continuous Spatial Authoring prototype and
       reconciled phase-wide umbrella. P26 implementation remains unauthorized; its final plan must
       reconcile landed P23B, and the selected architecture validation window is not yet open. P23B does
       not depend on that reconciliation. The architecture cycle remains at PHASE_1 installed.
       P23B.0-durable SHIPPED 2026-09-25: the owner accepted the explicitly partial method-v5 baseline
       (W6 §10.3 disposition A — post-release flush/frame coverage deferred, no further capture) and
       PR #87 merged (squash `d7b9de4e`; tree identical to continuation HEAD `935c5ada`).
       PRESERVED: baseline `apps/editor/src/lib/bench/baselines/g3-baseline.json` SHA-256
       `5534926e3a2dbceed9e0383da5914f95ff2824d0d90a760ca48f859b56ec5a8d` (107,521 bytes,
       captured at `be525f7c`, naming policy commit `c11938fe`); advisory-only timing policy
       (`ENFORCED_BUDGET_METRICS` unchanged, `bench:record` the only writer); explicit coverage limit
       (synchronous + press/move-phase pairs sound, post-release pairs missing, no settlement claim).
       HEADLINE FINDING: the straight control is sluggish (accepted authoring 262.6 ms, rigid edit
       208.4 ms); curvature is not necessary and amplifies several observed costs. Plan update work is
       a justified investigation target, not a proved explanation for every editing delay.
       Routine slice closeout completed on `P23B4` (P2: squash-merge compaction;
       stubs + anchor `d7b9de4e`, tag `closed/p23b.0`; checkpoint retired, not archived).
       Closeout gates on the closeout tree: `test:perf` 7 files / 56 pass (1 skipped); `test:arch`
       23 files / 254 pass; `npm test` 324 files / 4,755 pass (1 skipped); `check` (editor + museum)
       0 errors, 0 warnings; both apps build; baseline hash unchanged.
       P23B.4's architecture-review gate PASSES (recorded in the reconciled plan §11); entry anchors
       re-verified against current source there.
       P23B.1 harvest and P23B.2 research artifacts retain their
       own review states; the separate P23B.2 ACCEPT/PART-RETURN decision is unrelated to P23B.3a.

NEXT:
1. P23B.5 SHIPPED and closed 2026-09-25 (PR #90 squash-merged) after owner acceptance with no
   remaining blocker. M-3 = SHIPPED (preflight-only): one bounded gesture-scoped sample owner
   threaded into the transient preflight only, reset at pointer-down / finish / cancel / the
   snapshot-clearing bypass. Measured on curved-40: 120 preflight requests → 44 derivations
   (40 cold misses + 4 changed-input refusals) / 76 hits (63%), 0 failed derives, 0 cached
   undefined, straight control 0 requests; advisory per-drag preflight p50 26.7 → 8.9 ms.
   Those counters are watchable live (DEV harness `/dev/perf/p23b`) and GATED (perf-lane
   ratchet with absolute invariants, movable only through
   `npm run reuse:record --reason "…"`). Release-scope reuse remains unreachable and
   unimplemented (each release re-parses its candidate). Do NOT claim release reuse, re-own the
   sample store, rewrite the baseline or restart P23B.4.
   CURRENT STEP: the owner-authorized MEASUREMENT-ONLY step is EXECUTED on `p23b-measurement`
   (unpushed), per the phase README routing amendment of 2026-09-25 — P23B.7 S1 extended to the
   wall-authoring release plus P23B.6 S1 — and is now in CORRECTION PASS 1 after owner review.
   Every `p2311:` component mark is bound to the action and outcome whose boundary interval
   encloses it, with exclusive time only where containment holds, an explicit unbound remainder
   per action, an unattributed pool and an `ambiguous` (identical-interval) report; four
   release-path marks were added (`selection-hit`, `gesture-commit`, `authoring-release`) plus the
   commit split (`commit-capture` / `commit-matches` / `commit-replace`).
   Record → ../roadmap/p23b-geometry-performance/p23b-measurement-only-step/2026-09-25-release-containment-record.md
   HEADLINE (CORRECTED): the revision-1 ranking is WITHDRAWN. Its leading claim — that the
   history commit's restore re-installs live state and misses the wall-mesh cache (85–97 ms
   `restore-mesh-install`) — is REFUTED: `captureLayoutPreviewSnapshot` holds `state.geometry` by
   reference, so a restore of a live snapshot re-derives nothing, and the production commit step
   re-derives nothing either (three deterministic tests). No slice is named first, P23B.6 is
   neither named first nor excluded, P23B.7's gesture-topology gate is named but not first, and
   P23B.8 has no measured demand. Revision 1's numbers are NOT reused: that capture ran on a dirty
   tree at `d9a56a2b` and no artifact of it is committed. Surviving facts: the whole-document
   preflight gate is single-digit ms per move (1.5 straight / 3.6–3.9 curved, matching the owner's
   1.7/7.8/9.9) and UN-1 re-derives by symbol (planner + `deriveInstallBundle` + preview install
   all INSIDE `plan-apply`; P23B.1's line anchors are stale). Re-rank needs a clean-commit capture,
   the raw intervals of the restore pair, and `gesture-commit` exclusive time from the split
   marks. Coverage limit: the all-curved-40 capture aborted on the driver's own 6000 ms action
   guard (not raised — it is part of the protocol).
   The step STOPS here for the owner's ruling; P23B.6–P23B.8 optimization work stays
   unauthorized and nothing is merged.
2. P23B.1 harvest review and the P23B.2 ACCEPT/PART-RETURN evidence decision remain separate open matters;
   their status does not reopen P23B.3a or P23B.0.
3. P26 planning may continue in parallel. Read
   ../roadmap/p26-spatial-depth/2026-09-24-P26-continuous-spatial-authoring-umbrella.md; reconcile its
   proposed architecture against landed P23B, resolve slice-specific decisions and prepare the
   implementation plan/proofs. The accepted prototype does not authorize implementation or open the
   validation window.
4. P23 carries 13 owner-carried verification rows into later work and 5 deferred debt items; they are
   named in the closed gate stub, not silently dropped, and P23B neither claims nor closes them.

ROUTE:
phase status/order → ../roadmap/README.md
P23B planning + ratified sequence → ../roadmap/p23b-geometry-performance/README.md (§SEQUENCE)
P23B.3a shipped plan stub → ../roadmap/p23b-geometry-performance/p23b.3a-independent-placement-topology-policy/2026-09-22-P23B.3a-independent-placement-topology-policy.md
P23B.3a QA/acceptance stub → ../roadmap/p23b-geometry-performance/p23b.3a-independent-placement-topology-policy/qa/2026-09-24-P23B.3a-qa-gate-record.md
P23B.0-durable closed plan stub → ../roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/2026-09-22-P23B.0-durable-measurement-completion.md
P23B.0-durable Stage A closed handoff stub → ../roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/2026-09-24-P23B.0-ratification-handoff.md
P23B.0-durable closed W6 record (finding + coverage limit + preservation report) → ../roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/2026-09-24-P23B.0-durable-measurement-report.md
P23B.0-durable closed W7 policy stub → ../roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/2026-09-24-P23B.0-budget-policy-record.md
P23B.4 closed plan + evidence stubs (SHIPPED 2026-09-25, anchor `4cbcc370`, tag `closed/p23b.4`) → ../roadmap/p23b-geometry-performance/p23b.4-compilation-invalidation-optimization/2026-09-22-P23B.4-compilation-invalidation-optimization.md + ../roadmap/p23b-geometry-performance/p23b.4-compilation-invalidation-optimization/2026-09-25-P23B.4-evidence-findings.md
P23B.5 SHIPPED (2026-09-25) closed plan stub — §0.2/§0.4/§0.6 rulings, §5 S0–S6 records, evidence, preservation report (anchor `75fbd8a0`, tag `closed/p23b.5`) → ../roadmap/p23b-geometry-performance/p23b.5-caching-reuse-optimization/2026-09-22-P23B.5-caching-reuse-optimization.md
LIVE P23B.5 reuse record (perf-lane gate; a test imports it by path) → ../roadmap/p23b-geometry-performance/p23b.5-caching-reuse-optimization/reuse-counter-ratchet.json
Next authorized step (measurement-only; routing amendment) → ../roadmap/p23b-geometry-performance/README.md §Owner-authorized execution routing amendment — 2026-09-25 (P23B.5 closeout + measurement-only step)
P23B.5 S0 evidence suite (bounded test-only probes P1–P9) → apps/editor/tests/lib/layout/p23b5-s0-reachability.test.ts
P23B.5 S2–S5 proofs (equivalence, refusal, lifetime, direct measurement) → apps/editor/tests/lib/layout/p23b5-preflight-scope.test.ts
P23B.5 S4 call-site wiring proof (gesture start / finish / bypass / preflight threading) → apps/editor/tests/lib/layout/p23b5-gesture-scope-wiring.test.ts
P23B.5 S5 live DEV readout of gesture reuse (per-drag counters + harness panel) → apps/editor/src/lib/editor/layout/p23b-gesture-sampling-report.ts · panel in apps/editor/src/routes/dev/perf/p23b/+page.svelte · tests/lib/editor/layout/p23b-gesture-sampling-report.test.ts
Recorded v5 baseline → apps/editor/src/lib/bench/baselines/g3-baseline.json
Scripted capture protocol (DEV harness driver) → apps/editor/src/routes/dev/perf/p23b/drive.ts
P23B.1 internal harvest → ../roadmap/p23b-geometry-performance/p23b.1-internal-geometry-pipeline-harvest/2026-09-22-P23B.1-harvest-record.md
P23B.2 research report → ../roadmap/p23b-geometry-performance/p23b.2-external-geometry-performance-research/2026-09-22-P23B.2-external-geometry-performance-research.md
P26 planning and accepted direction → ../roadmap/p26-spatial-depth/2026-09-24-P26-continuous-spatial-authoring-umbrella.md
P26 accepted prototype → ../roadmap/p26-spatial-depth/Final-Design-Prototype/README.md
P23 (closed, evidence only) → ../roadmap/p23-layout-depth/README.md
P23 close record → ../roadmap/p23-layout-depth/README.md §PHASE CLOSE
P23 final-gate evidence → ../roadmap/p23-layout-depth/2026-09-08-P23.16-final-whole-product-integration-closeout.md (stub)
P23.16 verification results → ../roadmap/p23-layout-depth/p23.16-whole-product-integration-closeout/qa/2026-09-22-P23.16-qa-gate-record.md (stub)
post-P23 debt → ../operations/tech-debt/README.md

BLOCKER:
- P23B.5 shipped and closed (PR #90; stub + anchor `75fbd8a0`, tag `closed/p23b.5`). No
  release-scope reuse claim and no sample-store re-ownership: the sample scope stays the
  gesture-scoped preflight owner only. P23B.6–P23B.8 OPTIMIZATION work remains unauthorized;
  the only authorized next step is the measurement-only step, which ends at a ranking and a
  stop for the owner's ruling. U-1 declined.
- The P23B.2 ACCEPT/PART-RETURN evidence decision remains open and separate from P23B.3a/P23B.0.
- P26 implementation readiness remains gated; planning may continue, but the validation window is not
  open.

CLOSED (2026-09-22):
- P23 closed by owner ratification (PR #73, HEAD 645f43e). Final gate P23.16 accepted: A1–A14 all pass
  (complete suite 316+1 skipped files / 4619+1 skipped tests; visitor bundle gate 3 server / 9 client
  entries; API suites 39 tests on real local Postgres), and TD-3 / issue #35 was delivered inside the
  gate as the approved amendment (be4e23b).
- Closed work compacted to path-preserving stubs with recovery anchors: P23.16 plan and QA/gate record
  (645f43e) and the gate artifact (650f7c15); tags closed/p23.16, closed/p23 and closed/p23.15 cover
  every recorded anchor, verified by ancestry. 0 renderable-evidence copies (none existed).
- Owner-carried rows stay explicit: the published-visitor leg of M1, the P23.15 J-row visual halves
  (M2–M10), the screen-reader row (M15) and the device rows (M16); the legacy relic smoke is waived by
  owner decision and those relics may drift.

CLOSED (2026-09-24):
- P23B.3a accepted and shipped; S5/S6 owner-confirmed re-reviews have no separate GitHub entries, S7
  corrections are accepted, and corrected S8 evidence plus all integrated-tree acceptance lanes pass.
- Policy, code/test entry points, acceptance evidence and the `closed/p23b.3a` recovery tag are routed
  from `../roadmap/p23b-geometry-performance/README.md`. PR #82 merged at `c11938fe`; the post-merge P1
  ancestry/recovery checks passed and the original ruleset was restored. The tag is local only (not pushed).

CLOSED (2026-09-25):
- P23B.0-durable accepted (partial baseline, disposition A) and shipped; PR #87 squash-merged at
  `d7b9de4e` (tree identical to continuation HEAD `935c5ada`). Routine closeout compacted the plan, W6,
  W7 and Stage A handoff to path-preserving stubs at their own paths; recovery anchor `d7b9de4e`, tag
  `closed/p23b.0` (verified: ancestor of `main`, all four bodies recoverable). 0 renderable-evidence
  copies (none existed; the baseline JSON stays live as the test-enforced baseline). 0 reference
  promotions (measurement-only slice). The Stage B checkpoint was retired after promoting its durable
  content into the stubs; no raw checkpoint archived. Continuation-branch commits are not ancestors of
  `main` (squash); recovery runs against the squash anchor/tag. Closeout gates: `test:perf` 56 pass,
  `test:arch` 254 pass, `npm test` 4,755 pass (each +1 skipped file/test); `check` 0/0 both apps; both
  apps build; baseline SHA-256 unchanged.
- Owner-carried forward: U-2…U-7, the deferred post-release flush/frame coverage, P23B.4–P23B.8 work,
  P23B.1 review and the P23B.2 evidence decision — named in the closed stubs, not silently dropped.
  U-1 was open when P23B.0 closed and was subsequently DECLINED by the owner on 2026-09-25.
- P23B.4 accepted and shipped; PR #88 squash-merged (accepted HEAD `4cbcc370` vs base
  `d7b9de4e`; F1–F3 corrections ACCEPTED, no remaining blockers). Routine closeout compacted the plan and the
  evidence record to path-preserving stubs at their own paths; recovery anchors `cb9b83ab` (plan)
  and `4cbcc370` (evidence) via `git fetch origin refs/pull/88/head` (squash degradation recorded
  in the stubs), tag `closed/p23b.4` local only (verified post-merge in-session: both bodies
  recoverable via the PR head ref). 0 renderable-evidence copies (none existed). 0 reference promotions (key grammar
  owned in code; S9/S10 findings inherited by roadmap slices via anchor). No active checkpoint to
  retire. Owner-verified gates at acceptance: full lane 4,786 passed, `test:arch` / `test:perf`
  green, `check` 0/0 both apps, both apps build, visitor bundle verified, baseline SHA-256 unchanged;
  closeout re-run skipped per explicit owner instruction.
- P23B.5 reviewed and ACCEPTED with no remaining blocker; PR #90 squash-merged (reviewed
  implementation head `75fbd8a0`, docs-only after the recorded implementation commit `e080b35b`,
  which the verification record and the ratchet's `recordedCommit` both name). Routine
  slice-closeout ran on the same branch; the plan was compacted to a path-preserving closed stub
  (rulings §0.2/§0.4/§0.6, stage records S0–S6, evidence, residual ledger, preservation report) and
  `reuse-counter-ratchet.json` stays LIVE (a test imports it by path). 0 renderable-evidence copies
  (none existed). 0 reference promotions (key grammar + lifetime owned in code; the gate is owned by
  `apps/editor/tests/README.md` and its committed record). No active checkpoint to retire. Closeout
  gates on the closeout tree: `check` 0/0 both apps, `test:arch` 254 pass, `test:perf` 62 pass
  (+1 skipped file/test); the implementation's full-lane numbers are reused because closeout changed
  no implementation code. Baseline SHA-256 `5534926e…` unchanged; no budget metric added.
  NEXT: the owner-authorized measurement-only step (P23B.7 S1 extended to the wall-authoring release
  + P23B.6 S1) on a new branch from updated `main`, ending at a ranking and a stop for the owner's
  ruling; P23B.6–P23B.8 optimization work stays unauthorized.
