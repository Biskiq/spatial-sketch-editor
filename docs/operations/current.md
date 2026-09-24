# Current

PHASE: P23B
CHILD: P23B.0-durable — next sequence step 10; plan PLANNED, UNRATIFIED. Owner inputs and authorization
       are required before committing measurement fixtures, harness changes or recorded baselines.
STAGE: P23 closed 2026-09-22 (owner ruling, PR #73; final gate P23.16 accepted). P23B (Geometry
       Performance & Stabilization) follows the owner-ratified sequence between P23 and P26. P23B.3
       synthesis and implementation criteria were ratified at `e139a18b`. P23B.3a's Option E policy was
       accepted and shipped 2026-09-24 after S1–S8 and OR-D12-1…6 passed. S5/S6 re-reviews are complete by
       owner confirmation; GitHub has no corresponding review entries. The integration of current `main`
       preserves both P23B.3a's status and P26's accepted Continuous Spatial Authoring prototype and
       reconciled phase-wide umbrella. P26 implementation remains unauthorized; its final plan must
       reconcile landed P23B, and the selected architecture validation window is not yet open. P23B does
       not depend on that reconciliation. The architecture cycle remains at PHASE_1 installed.
       P23B.0-durable's plan remains unratified. P23B.1 harvest and P23B.2 research artifacts retain their
       own review states; the separate P23B.2 ACCEPT/PART-RETURN decision is unrelated to P23B.3a.

NEXT:
1. P23B.0-durable — owner review and ratification of the bounded plan, including its fixture/gesture
   identity, reference measurement environment and harness/baseline scope. Once authorized, execute
   sequence step 10 against the post-policy gates before any optimization work.
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
phase status/order → ../roadmap/README.md
P23B planning + ratified sequence → ../roadmap/p23b-geometry-performance/README.md (§SEQUENCE)
P23B.3a shipped plan stub → ../roadmap/p23b-geometry-performance/p23b.3a-independent-placement-topology-policy/2026-09-22-P23B.3a-independent-placement-topology-policy.md
P23B.3a QA/acceptance stub → ../roadmap/p23b-geometry-performance/p23b.3a-independent-placement-topology-policy/qa/2026-09-24-P23B.3a-qa-gate-record.md
P23B.0-durable plan → ../roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/2026-09-22-P23B.0-durable-measurement-completion.md
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
- P23B.0-durable has no committed fixture identity or recorded baseline for the curved authoring case;
  its plan is unratified, so measurement-infrastructure implementation remains gated.
- The P23B.2 ACCEPT/PART-RETURN evidence decision remains open and separate from P23B.3a.
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
  from `../roadmap/p23b-geometry-performance/README.md`. The tag is local only (not pushed). P1 recovery
  uses a GitHub merge commit; post-merge anchor checks are recorded in the QA stub.
