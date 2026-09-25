# Current

PHASE: P23B
CHILD: P23B.5-caching-reuse — PLAN RATIFIED + S0 EXECUTED 2026-09-25 on `P23B.5`
       (plan revision `f26e2319`; S0 disposition PREFLIGHT-ONLY recorded in plan §0;
       M-3 implementation unauthorized and S4 not taken pending a separate owner
       scope ruling). Prior child P23B.4-compilation-invalidation SHIPPED
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
1. P23B.4 SHIPPED 2026-09-25 (PR #88; M-1 threaded, M-2a extent scan shipped,
   M-2b DROPPED at X-6; plan + evidence compacted to closed stubs, anchor
   `4cbcc370`, tag `closed/p23b.4`). Performance acceptance covers reduced
   computation and advisory Node timings; browser/settlement improvements remain
   unproven. Current step: P23B.5 — the reconciled plan (`f26e2319`) is RATIFIED
   and S0–S3 authorized; S0 is EXECUTED and recorded PREFLIGHT-ONLY. Release-scope
   M-3 reuse is NOT reachable (each release re-parses its candidate; the only
   reachable cross-chain identity is preflight→preflight on a frozen baseline,
   already routed to P23B.7 by the dependency map). ONE open owner decision:
   authorize a bounded gesture-scoped sample owner, or drop M-3 contract-only.
   Do NOT begin M-3/S4 implementation before that ruling, rewrite the baseline,
   or restart P23B.4.
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
P23B.5 plan with RATIFICATION + S0 disposition record (2026-09-25) → ../roadmap/p23b-geometry-performance/p23b.5-caching-reuse-optimization/2026-09-22-P23B.5-caching-reuse-optimization.md §0
P23B.5 S0 evidence suite (bounded test-only probes P1–P9) → apps/editor/tests/lib/layout/p23b5-s0-reachability.test.ts
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
- P23B.4 shipped (M-1 threaded, M-2a extent scan, M-2b DROPPED at X-6). P23B.5's plan is
  RATIFIED and S0 is executed (PREFLIGHT-ONLY); M-3 implementation and S4 remain unauthorized
  pending the owner's separate preflight-only scope ruling. P23B.6–P23B.8 remain unauthorized.
  No further capture is required or authorized; U-1 declined.
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
