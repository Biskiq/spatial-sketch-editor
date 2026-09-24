# Current

PHASE: P23B
CHILD: none in execution — P23B is in planning; the umbrella is landed, P23B.3 is authored and the child
       plans exist, but NOTHING is approved and no implementation has started
STAGE: P23 closed 2026-09-22 (owner ruling, PR #73; final gate P23.16 accepted). P23B (Geometry
       Performance & Stabilization) is wired between P23 and P26: umbrella landed, child slices
       proposed, no implementation approved. The post-P23 execution order is owner-ratified and
       deliberately sequential for evidence quality, not elapsed time. P26 remains in planning — its
       synthesis is the authoritative research input and the designer brief is written
       (p26-spatial-depth/design/briefs/2026-09-22-p26-designer-brief.md). Proposals are not started.
       The architecture cycle sits at PHASE_1 installed — Phase 0 adjudication is recorded
       (phase-0/adjudication.md) and the justified capture is installed, so no owner action is
       pending there. P26 is the selected validation window: selected, not yet open. The cycle
       reports ready for validation only once P26's prepared implementation plan is reconciled
       against the installed mechanisms, and Phase 2 opens on P26's first implementation slice.
       P23B implementation does not depend on that reconciliation — it waits only on its own gate.
       P23B.3 (synthesis + optimization direction + the operational dependency map + the curved-crossing
       owner decision record) is AUTHORED and awaits owner ratification at SEQUENCE step 8; its child
       plans for P23B.0-durable and P23B.4–P23B.10 are written and unratified. The owner-directed
       direction for INDEPENDENT SPATIAL PLACEMENT with explicit topological connection is folded in as
       decision-record OPTION E, together with the source-traced topology ownership model and its
       per-slice consequences. The owner RULED on 2026-09-22: **D-1 Option E**, **D-9 confirmed as
       written** (explicit Junction identity governs connectivity; coincident INDEPENDENT components are
       permitted; accidental duplicates WITHIN one connected component stay invalid; only an explicit join
       adopts an id — NO new representation is introduced), **D-10** Join/Connect at planning level,
       **D-11 ARRANGEMENT 1** (a dedicated, narrowly scoped topology-policy slice placed BEFORE
       `P23B.0-durable`, inside this branch and PR, so the recorded baseline is POST-POLICY by
       construction), and **D-12 owned by that slice** (the reconciliation identity proof, discharged
       before the slice's acceptance). The implementation plan and the performance acceptance criteria
       are now **RATIFIED by the owner (2026-09-22, review of `e139a18b`)** with THREE BINDING P23B.3a
       EXECUTION AMENDMENTS recorded in that slice's plan STATUS block: **AM-1** S4 must not require a
       case's pre- and post-policy verdicts green at once; **AM-2** D-12 requires an explicit
       IMPLEMENTATION-and-proof step (S3a), not an oracle alone; **AM-3** F8 is scoped to the
       NO-IMPLICIT-JOIN guarantee while Join/Connect stays deferred (D-10) — plus the ruling that S3's
       known-red reproduction stays outside every mandatory green lane until S3a fixes it. The slice is
       STAGED as **P23B.3a — Independent Placement & Topology Policy**, inserted into the
       authoritative `SEQUENCE` as step 9 ahead of the durable measurement, with the umbrella scope
       amendment and its own plan workspace; the staging commit `839772cb` is NOT rewritten. All
       required evidence is
       landed: the two historical P23B.0 read-only pass reports (archived verbatim, NOT benchmark
       baselines), the P23B.1 plan + harvest record, and the P23B.2 external research report — so
       SEQUENCE step 6 is satisfied as to artifact. Both the harvest record and the research report are
       still marked awaiting review by their own status blocks.

NEXT:
1. IMMEDIATE — EXECUTE **P23B.3a** (the P23B RATIFICATION GATE, SEQUENCE step 8, is SATISFIED: the owner
   ratified the synthesis, the implementation plan and the performance acceptance criteria on 2026-09-22
   at `e139a18b`, with the three binding execution amendments AM-1…AM-3). Run the slice's ratified S1–S8
   workflow — reference-first freeze, the general connectivity test, the D-12 implementation-and-proof
   step, the component-scoped gates, the authoring intent split, ingress parity, acceptance — and STOP
   at that slice's implementation review with OR-D12-1…6 evidence.
   IN EXECUTION, not awaiting authorization: S1 (reference freeze), S2 (general connectivity test), S3
   (the D-12 hazard, quarantined) and S3a (the D-12 implementation-and-proof, **ACCEPTED by the owner**
   at `ba54e9cf`) have landed; S4 (the component-scoped subject for `validateWallFirstTopology` and the
   sampled crossing authority, with its own oracle) has landed and is **ACCEPTED by the owner** (review
   of `858d796f`: no implementation blocker, with three instructions carried into S5 and one non-blocking
   OR-3a variant-coverage note owed before closeout); and S5 (the chain gate re-scoped in BOTH halves
   with the transitional `{ subject: 'document' }` escape removed, plus the component-scoped
   `duplicate_junction_point` coincidence rule D-9, with its own oracle) has landed; review found ONE
   blocker — the unattached-Junction sentinel was a STRING that a valid authored Wall id could claim,
   mis-classifying an unattached Junction as connected to that Wall — and the focused S5 correction now
   makes the sentinel collision-proof (a symbol, no schema change) with a codec-valid regression, so S5
   awaits RE-review.
   S6–S8 remain, and the policy is still NOT DELIVERED: no fixture or document may cite Option E as
   shipped until the slice is accepted. Follow the slice plan's PROGRESS record for the step-by-step state.
   The Arrangement-1 STAGING is DONE (umbrella scope amendment · `SEQUENCE` insertion of P23B.3a as
   step 9 · the named slice workspace), and **D-7 and D-8 are RESOLVED** — the slice is P23B.3a and the
   `layout-duplicate.ts` comment correction lands inside it. Still open alongside it: the P23B.2 evidence
   decision (ACCEPT/PART-RETURN).
   This ratification authorizes P23B.3a ALONE: no benchmark implementation, no other topology change and
   no optimization slice (P23B.0-durable, P23B.4–P23B.8) starts yet — P23B.0-durable begins only once the
   policy implementation and OR-D12-1…6 are ACCEPTED. Order in brief: Phase 0
   evidence → owner adjudication → Phase 1 installation → P23B.0 read-only measurement → P23B.1 harvest
   → P23B.2 external research → P23B.3 synthesis → owner ratification of the implementation plan and
   performance acceptance criteria → **P23B.3a topology policy** → durable P23B.0 measurement against
   the post-policy gates → optimization slices, verify, review, close out.
   AUTHORITATIVE SEQUENCE (order and gate placement, recorded once) →
   ../roadmap/p23b-geometry-performance/README.md §SEQUENCE
2. Read-only profiling and measurement planning may precede implementation authorization; committed
   benchmark-infrastructure changes (fixtures, harness, baselines, budgets) may not.
3. P26 product planning may continue in parallel, but it is not the primary next-work instruction.
   The designer brief is written
   (../roadmap/p26-spatial-depth/design/briefs/2026-09-22-p26-designer-brief.md). Next P26 artifact,
   when that work is picked up, is independent design proposals and then a reconciled direction
   and child plan. No P26 implementation starts without an approved plan. The brief does not open
   the validation window.
4. P23 carries 13 owner-carried verification rows into later work and 5 deferred debt items; they are
   named in the closed gate stub, not silently dropped, and P23B neither claims nor closes them.

ROUTE:
phase status/order → ../roadmap/README.md
P23B planning + ratified sequence → ../roadmap/p23b-geometry-performance/README.md (§SEQUENCE)
P23B umbrella (rationale/boundaries only; includes the owner-approved P23B.3a scope amendment) → ../roadmap/p23b-geometry-performance/2026-09-22-P23B-geometry-performance-stabilization-umbrella.md
P23B.3a topology policy (owner-selected slice; SEQUENCE step 9; holds the D-12 acceptance contract) → ../roadmap/p23b-geometry-performance/p23b.3a-independent-placement-topology-policy/2026-09-22-P23B.3a-independent-placement-topology-policy.md
P23B.3 synthesis + direction (authored, awaiting ratification) → ../roadmap/p23b-geometry-performance/p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-synthesis.md
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
- P23B has no measured baseline yet; its durable measurement waits on P23B.3a landing AND being
  accepted (the policy is not delivered by a ruling, and P23B.0-durable's baseline is post-policy by
  construction). The P23B.3 ratification itself is DONE (2026-09-22 at `e139a18b`), so P23B.3a execution
  is unblocked. Phase 0 adjudication and the justified Phase 1 response are installed and do not block
  that work
- P23B.3 is RATIFIED (2026-09-22 at `e139a18b`), so the scoped-validation direction (verdict reuse and
  the negative fixture's polarity) is now plannable against the designated post-policy behaviour — but
  the POLICY ITSELF is not yet DELIVERED: its verdicts become the shipped ones only when P23B.3a lands,
  and no fixture may claim a verdict the shipped gates do not produce. Owner decisions recorded in the
  P23B.3 synthesis §9.1/§9.2
- Option E is RULED (D-1) with D-9 CONFIRMED as written — connectivity is explicit graph identity,
  never coordinates alone; coincidence is permitted across independent components while duplicate-node
  validity is retained within one; and NO new representation is needed (the obstacle was a document-wide
  validation invariant plus planWallChain's adoption reflex, not a schema gap). D-11 selects
  ARRANGEMENT 1 and D-12 is owned by that policy slice. D-7 and D-8 are RESOLVED, and the slice is
  STAGED as P23B.3a (SEQUENCE step 9, umbrella amendment landed) and now RATIFIED for implementation
  with AM-1…AM-3 binding. What is STILL OPEN is the P23B.2 evidence decision, and the policy's own
  DELIVERY: until P23B.3a lands and its OR-D12-1…6 are accepted, no downstream slice, fixture or
  document may cite Option E as shipped
- P23B.0 has no committed fixture identity and no recorded baseline for the curved authoring case, so no
  optimization may yet be measured honestly; its durable completion is planned and unratified
- P26 has a designer brief and no child plan yet; proposals are not started. Planning is the current work, not a blocker to it

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
