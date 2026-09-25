# Current

PHASE: P23B
CHILD: P23B.0-durable — sequence step 10; owner ratified plan revision `4b32034f` on 2026-09-24, approved
       O-1–O-4 and authorized W1–W7, then amended the measurement scope on 2026-09-25 (§10 S-1…S-7).
       Stage B is implementation-review-ready at checkpoint `checkpoints/p23b0-stage-b.md`: W1–W2 are
       committed at `89ec1fa2`, W3–W5 implementation at `e26bb623`, the recording corrections at
       `805fed25`…`b9a492da`, the review correction round at `d4b4763f`/`2021e10e`/`be525f7c`, the second
       correction round at `0bef0a48` (post-release boundary scheduling), and the
       post-policy, pre-optimization method-v5 baseline is recorded in `apps/editor/src/lib/bench/
       baselines/g3-baseline.json` (SHA-256 `5534926e…`) with the W6 measurement report and W7
       budget-policy record in the P23B.0 workspace. The interaction capture covers the owner workload
       plus the size-40 straight and all-curved matrix cells at one shared 19.292586 px/m viewport in one
       browser session.
       HEADLINE FINDING: the straight control is sluggish (accepted authoring 262.6 ms, rigid edit
       208.4 ms); curvature is not necessary and amplifies several observed costs. Plan update work is
       a justified investigation target, not a proved explanation for every editing delay.
       COVERAGE: the preserved capture predates corrected post-release scheduling. Synchronous and
       observed press/move/wheel measurements remain useful; missing post-release pairs include
       selection/pan releases as well as edits. No complete action-settlement claim is supported.
       REVIEW RECOMMENDATION: accept the explicitly partial baseline (W6 §10.3 disposition A), then
       close out the slice and reconcile P23B.4's plan and architecture gate. No additional capture
       campaign is recommended. Owner acceptance remains pending.
       The single continuation PR is the review surface; the slice is not accepted and its PR is not
       merged. P23B.4 remains gated until P23B.0's baseline is accepted.
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
       P23B.0-durable's Stage A plan is ratified; its measurement infrastructure is implemented at
       `e26bb623`. P23B.1 harvest and P23B.2 research artifacts retain their
       own review states; the separate P23B.2 ACCEPT/PART-RETURN decision is unrelated to P23B.3a.

NEXT:
1. Recommended: owner accepts the explicitly partial P23B.0 baseline (W6 §10.3 A). Review Stage B on the single continuation branch/PR: the
   recorded method-v5 baseline, the W6 measurement report and the W7 budget-policy record, read together
   with `checkpoints/p23b0-stage-b.md`. Read W6 §0 first, then §0.2 (the post-release coverage gap) and
   §10.3 (the two dispositions: accept the partial baseline, or authorize only the targeted replacement
   capture through the corrected harness). Do not merge by default and do not begin P23B.4 until a
   baseline is accepted. Owner direction 2026-09-25 stands: report, then move on to the fix once accepted.
2. P23B.1 harvest review and the P23B.2 ACCEPT/PART-RETURN evidence decision remain separate open matters;
   their status does not reopen P23B.3a.
3. P26 planning may continue in parallel. Read
   ../roadmap/p26-spatial-depth/2026-09-24-P26-continuous-spatial-authoring-umbrella.md; reconcile its
   proposed architecture against landed P23B, resolve slice-specific decisions and prepare the
   implementation plan/proofs. The accepted prototype does not authorize implementation or open the
   validation window.
4. P23 carries 13 owner-carried verification rows into later work and 5 deferred debt items; they are
   named in the closed gate stub, not silently dropped, and P23B neither claims nor closes them.

ROUTE:
P23B.0-durable Stage B resume checkpoint → checkpoints/p23b0-stage-b.md
phase status/order → ../roadmap/README.md
P23B planning + ratified sequence → ../roadmap/p23b-geometry-performance/README.md (§SEQUENCE)
P23B.3a shipped plan stub → ../roadmap/p23b-geometry-performance/p23b.3a-independent-placement-topology-policy/2026-09-22-P23B.3a-independent-placement-topology-policy.md
P23B.3a QA/acceptance stub → ../roadmap/p23b-geometry-performance/p23b.3a-independent-placement-topology-policy/qa/2026-09-24-P23B.3a-qa-gate-record.md
P23B.0-durable plan → ../roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/2026-09-22-P23B.0-durable-measurement-completion.md
P23B.0-durable Stage A ratification handoff → ../roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/2026-09-24-P23B.0-ratification-handoff.md
P23B.0-durable W6 measurement report → ../roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/2026-09-24-P23B.0-durable-measurement-report.md
P23B.0-durable W7 budget policy → ../roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/2026-09-24-P23B.0-budget-policy-record.md
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
- P23B.0-durable's W1–W7 are implemented and recorded, so the remaining blocker is the owner review
  itself: the baseline (and the W6 UNKNOWNs U-1…U-6, including the native-Chrome comparison and the
  owner-deferred 3D path) needs an accept/return decision before P23B.4 opens. Live browser
  DPR/renderer details and actual per-path sampling settings are recorded in the baseline and the W6
  report; the recording corrections that were required first are identifiable perf commits on the same
  continuation branch.
- The P23B.2 ACCEPT/PART-RETURN evidence decision remains open and separate from P23B.3a.
- P26 implementation readiness remains gated; planning may continue, but the validation window is not
  open.

READY FOR REVIEW:
- Corrected implementation is at `0bef0a48`; the preserved method-v5 capture is at `be525f7c`.
  W6 distinguishes the verified implementation from its partial capture coverage. Local documentation
  reconciliation remains uncommitted; do not describe the current worktree as clean or these edits as
  already present in PR #87. Baseline bytes and enforced budgets are unchanged.

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
