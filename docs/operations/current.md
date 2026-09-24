# Current

PHASE: P23B
CHILD: P23B.3a — S1–S8 implementation complete. The focused S8 acceptance-evidence correction is
       implemented and verified; owner re-review and final implementation acceptance are pending. No
       slice closeout or merge has occurred.
STAGE: P23 closed 2026-09-22 (owner ruling, PR #73; final gate P23.16 accepted). P23B (Geometry
       Performance & Stabilization) follows the owner-ratified sequence between P23 and P26. P23B.3
       synthesis and implementation criteria were ratified at `e139a18b`; P23B.3a is the authorized
       policy slice at sequence step 9. P23B.3a's Option E behavior is implemented and verified, but is
       not recorded as shipped until the owner accepts the complete slice. P23B.0-durable and later
       optimization work remain downstream of that acceptance. P26 remains in planning; `main` now
       records the accepted Continuous Spatial Authoring prototype and reconciled P26 umbrella from
       PR #84. Carry that newer P26 direction forward when resolving the PR #82 baton conflict while
       preserving P23B.3a's current state. The architecture cycle remains at PHASE_1 installed; P23B
       does not depend on P26 reconciliation.
       Required evidence artifacts for the earlier P23B.0–P23B.2 sequence steps are landed. The P23B.1
       harvest and P23B.2 report retain their own review statuses; the P23B.2 ACCEPT/PART-RETURN decision
       remains open and separate from P23B.3a.

NEXT:
1. OWNER ACTION — re-review the focused S8 acceptance-evidence correction on PR #82. The exact-coincidence
   oracle now compares the unrelated Room's boundary references and full hosted Opening record; the
   multiple-Room OR-3a oracle isolates the entire connected component and asserts both Rooms remain in it.
   Full suite, architecture, check and build lanes pass. S5/S6 re-reviews remain complete by owner
   confirmation; GitHub has no corresponding review entries. S7 corrections are in `45776941`; S8 evidence
   is in `c72b7469` plus the focused correction commit. No implementation defect is reported, and no
   slice closeout or merge has occurred.
2. AFTER P23B.3a acceptance — run routine slice-closeout, record Option E as shipped, and advance to
   P23B.0-durable measurement against the post-policy gates. No benchmark implementation or later
   optimization slice is authorized before that gate.
3. MERGE READINESS — separate from implementation acceptance. PR #82 currently conflicts with `main`;
   its title/body still describe the older documentation-only scope, and no GitHub status checks are
   listed. After implementation acceptance, refresh its metadata and resolve the
   `docs/operations/current.md` conflict on this branch, preserving the current P23B.3a status and the
   accepted P26 direction from PR #84.
4. P23B.2 ACCEPT/PART-RETURN remains a separate open evidence decision. The P23B.1 harvest and P23B.2
   report retain their own review statuses.
5. P23 carries 13 owner-carried verification rows into later work and 5 deferred debt items; they are
   named in the closed gate stub, not silently dropped, and P23B neither claims nor closes them.

ROUTE:
phase status/order → ../roadmap/README.md
P23B planning + ratified sequence → ../roadmap/p23b-geometry-performance/README.md (§SEQUENCE)
P23B umbrella (rationale/boundaries only; includes the owner-approved P23B.3a scope amendment) → ../roadmap/p23b-geometry-performance/2026-09-22-P23B-geometry-performance-stabilization-umbrella.md
P23B.3a topology policy (owner-selected slice; SEQUENCE step 9; holds the D-12 acceptance contract) → ../roadmap/p23b-geometry-performance/p23b.3a-independent-placement-topology-policy/2026-09-22-P23B.3a-independent-placement-topology-policy.md
P23B.3 synthesis + direction (ratified at `e139a18b`) → ../roadmap/p23b-geometry-performance/p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-synthesis.md
P23B.3 operational dependency map / child plan index → ../roadmap/p23b-geometry-performance/p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-implementation-and-dependency-map.md
P23B.2 external research (landed verbatim, awaiting review) → ../roadmap/p23b-geometry-performance/p23b.2-external-geometry-performance-research/2026-09-22-P23B.2-external-geometry-performance-research.md
P23B.2 readable navigation for that report (additive; the report is never edited) → ../roadmap/p23b-geometry-performance/p23b.2-external-geometry-performance-research/2026-09-22-P23B.2-research-navigation.md
P23B.0 archived read-only measurement reports (historical evidence, not baselines) → ../roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/2026-09-22-P23B.0-read-only-pass-a-12-curved-walls.md
P23B curved-crossing owner decision + Option E direction (required) → ../roadmap/p23b-geometry-performance/p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-curved-crossing-owner-decision.md
  (§2.10 Option E — owner-directed, DIRECTION ACCEPTED · §2.11 the source-traced topology ownership model, §2.11.2 the D-9 coincidence rule, §2.11.3 the reconciliation hazard · §4.1 the D-11 delivery arrangements · §5 the decision register · §6 the acceptance-test design)
P26 planning → ../roadmap/p26-spatial-depth/README.md
P26 designer brief (written, does not open the validation window) → ../roadmap/p26-spatial-depth/design/briefs/2026-09-22-p26-designer-brief.md
P23 (closed, evidence only) → ../roadmap/p23-layout-depth/README.md
P23 close record → ../roadmap/p23-layout-depth/README.md §PHASE CLOSE
P23 final-gate evidence → ../roadmap/p23-layout-depth/2026-09-08-P23.16-final-whole-product-integration-closeout.md (stub)
P23.16 verification results → ../roadmap/p23-layout-depth/p23.16-whole-product-integration-closeout/qa/2026-09-22-P23.16-qa-gate-record.md (stub)
post-P23 debt → ../operations/tech-debt/README.md

BLOCKER:
- P23B.3a has no implementation-code blocker. The focused S8 evidence correction is verified and awaits
  owner re-review and acceptance; until then, Option E is not recorded as shipped and P23B.0-durable
  measurement cannot begin. The implementation-review handoff is PR #82 on branch `p23b`.
- The P23B.2 ACCEPT/PART-RETURN evidence decision remains open and is separate from P23B.3a.
- P23B.0 has no committed fixture identity and no recorded baseline for the curved authoring case, so no
  optimization may yet be measured honestly; its durable completion is planned and unratified
- P26's accepted Continuous Spatial Authoring prototype and reconciled umbrella are recorded on `main`
  through PR #84. Carry that direction into this baton when the PR #82 conflict is resolved; P26 stays
  separate from the P23B.3a implementation review.

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
