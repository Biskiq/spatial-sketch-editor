# Current

PHASE: P23B
CHILD: none in execution — P23B is in planning; the umbrella is landed, P23B.3 is authored and the child
       plans exist, but NOTHING is approved and no implementation has started
STAGE: P23 closed 2026-09-22 (owner ruling, PR #73; final gate P23.16 accepted). P23B (Geometry
       Performance & Stabilization) is wired between P23 and P26: umbrella landed, child slices
       proposed, no implementation approved. The post-P23 execution order is owner-ratified and
       deliberately sequential for evidence quality, not elapsed time. P26 remains in planning — its
       synthesis is the authoritative research input and the design brief is still the next artifact.
       The architecture cycle sits at PHASE_1 installed — Phase 0 adjudication is recorded
       (phase-0/adjudication.md) and the justified capture is installed, so no owner action is
       pending there. P26 is the selected validation window: selected, not yet open. The cycle
       reports ready for validation only once P26's prepared implementation plan is reconciled
       against the installed mechanisms, and Phase 2 opens on P26's first implementation slice.
       P23B implementation does not depend on that reconciliation — it waits only on its own gate.
       P23B.3 (synthesis + optimization direction + the operational dependency map + the curved-crossing
       owner decision record) is AUTHORED and awaits owner ratification at SEQUENCE step 8; its child
       plans for P23B.0-durable and P23B.4–P23B.10 are written and unratified. Two factual gaps are
       recorded rather than papered over: P23B.2 (external precedent research, SEQUENCE step 6) was NEVER
       EXECUTED and no artifact exists, and the two historical P23B.0 read-only profiling reports are not
       in the repository (their numbers survive only as reported values in the P23B.1 plan §2). PR #82's
       description claims both, which is inaccurate.NEXT:
1. IMMEDIATE — the P23B RATIFICATION GATE (SEQUENCE step 8): the owner reviews P23B.3 and RATIFIES the
   synthesis plus the performance acceptance criteria, RULES on curved-crossing validity (options A–D;
   it blocks verdict reuse and the negative fixture's polarity), and DECIDES the P23B.2 sequencing call
   (authorize the missing external research and re-open P23B.3, or ratify with the external-precedent
   dimension explicitly not established). No benchmark implementation, topology fix or optimization
   (P23B.0-durable, P23B.4–P23B.8) starts before that ratification. Order in brief: Phase 0
   evidence → owner adjudication → Phase 1 installation → P23B.0 read-only measurement → P23B.1 harvest
   → P23B.2 external research → P23B.3 synthesis → owner ratification of the implementation plan and
   performance acceptance criteria → durable P23B.0 measurement → optimization slices, verify, review,
   close out.
   AUTHORITATIVE SEQUENCE (order and gate placement, recorded once) →
   ../roadmap/p23b-geometry-performance/README.md §SEQUENCE
2. Read-only profiling and measurement planning may precede implementation authorization; committed
   benchmark-infrastructure changes (fixtures, harness, baselines, budgets) may not.
3. P26 product planning may continue in parallel, but it is not the primary next-work instruction:
   author the design brief from the landed synthesis
   (research/synthesis/p26-architectural-spatial-depth-synthesis.md), then proposals and a reconciled
   child plan. No P26 implementation starts without an approved plan.
4. P23 carries 13 owner-carried verification rows into later work and 5 deferred debt items; they are
   named in the closed gate stub, not silently dropped, and P23B neither claims nor closes them.

ROUTE:
phase status/order → ../roadmap/README.md
P23B planning + ratified sequence → ../roadmap/p23b-geometry-performance/README.md (§SEQUENCE)
P23B umbrella (rationale/boundaries only) → ../roadmap/p23b-geometry-performance/2026-09-22-P23B-geometry-performance-stabilization-umbrella.md
P23B.3 synthesis + direction (authored, awaiting ratification) → ../roadmap/p23b-geometry-performance/p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-synthesis.md
P23B.3 operational dependency map / child plan index → ../roadmap/p23b-geometry-performance/p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-implementation-and-dependency-map.md
P23B curved-crossing owner decision (required) → ../roadmap/p23b-geometry-performance/p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-curved-crossing-owner-decision.md
P26 planning → ../roadmap/p26-spatial-depth/README.md
P23 (closed, evidence only) → ../roadmap/p23-layout-depth/README.md
P23 close record → ../roadmap/p23-layout-depth/README.md §PHASE CLOSE
P23 final-gate evidence → ../roadmap/p23-layout-depth/2026-09-08-P23.16-final-whole-product-integration-closeout.md (stub)
P23.16 verification results → ../roadmap/p23-layout-depth/p23.16-whole-product-integration-closeout/qa/2026-09-22-P23.16-qa-gate-record.md (stub)
post-P23 debt → ../operations/tech-debt/README.md

BLOCKER:
- P23B has no measured baseline and no approved child plan; its implementation waits on the owner
  ratifying P23B.3 and the performance acceptance criteria (SEQUENCE step 8)
- P23B.2 was never executed, so P23B.3 cannot reconcile external precedent; no mechanism is admitted on
  an external precedent that was never established. Owner decision recorded in the P23B.3 synthesis §9.2
- The two historical P23B.0 read-only profiling reports are not in the repository; PR #82's description
  claims them (and a P23B.2 report) as branch contents. The phase README is the accurate record
- P26 has no compiled design brief or child plan yet; planning is the current work, not a blocker to it

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
