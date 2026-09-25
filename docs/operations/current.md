# Current

PHASE: P23B
CHILD: P23B.4-compilation-invalidation — plan reconciliation underway on `codex/p23b4-reconciliation`
       from updated `main` (owner direction 2026-09-25: new `codex/` branch for this step, superseding
       the continuation-branch arrangement; `codex/p23b-continuation` is retired, not deleted).
       The reconciled plan is UNRATIFIED; implementation awaits owner approval.
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
       Routine slice closeout completed on `codex/p23b4-reconciliation` (P2: squash-merge compaction;
       stubs + anchor `d7b9de4e`, tag `closed/p23b.0`; checkpoint retired, not archived).
       Closeout gates on the closeout tree: `test:perf` 7 files / 56 pass (1 skipped); `test:arch`
       23 files / 254 pass; `npm test` 324 files / 4,755 pass (1 skipped); `check` (editor + museum)
       0 errors, 0 warnings; both apps build; baseline hash unchanged.
       P23B.4's architecture-review gate PASSES conditional on owner ratification (recorded in the
       reconciled plan §11); entry anchors re-verified against current source there.
       P23B.1 harvest and P23B.2 research artifacts retain their
       own review states; the separate P23B.2 ACCEPT/PART-RETURN decision is unrelated to P23B.3a.

NEXT:
1. Owner reviews the reconciled P23B.4 plan + §11 gate on `codex/p23b4-reconciliation` (unmerged):
   ratify plan/acceptance criteria and authorize implementation, or return it. Do not implement
   optimizations before that approval. U-5 (flush attribution via nested P23.11 marks) is the
   recommended first investigation once authorized.
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
P23B.4 reconciled plan (UNRATIFIED; §11 holds the architecture-review gate) → ../roadmap/p23b-geometry-performance/p23b.4-compilation-invalidation-optimization/2026-09-22-P23B.4-compilation-invalidation-optimization.md
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
- P23B.4 implementation awaits owner approval of the reconciled plan (§11 gate + OR-1…OR-11/X-1…X-8).
  The baseline gate is satisfied; no further capture is required or authorized.
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
- Owner-carried forward: U-1…U-7, the deferred post-release flush/frame coverage, P23B.4–P23B.8 work,
  P23B.1 review and the P23B.2 evidence decision — named in the closed stubs, not silently dropped.
