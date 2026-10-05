# Current

PHASE: F — foundation contracts; status/order → ../roadmap/README.md;
       registration → ../roadmap/f-foundation-contracts/README.md.
CHILD: F.1–F.5 target contract WRITTEN and OWNER-RATIFIED; NO IMPLEMENTATION AUTHORIZED.
       Normative text → ../reference/composition-execution.md. Draft each exact interface
       with its first consumer and ratify it as an amendment; tracks do not mint their own.
NEXT: #113 C9.2/C9.3 implemented; the five external MP2 review blockers (route writer,
       explanation binding, Experience-scoped output, Auto remaining work, signal scope)
       repaired with regression and mutation coverage, and the review's folded second pass
       (station invocation contract, cue-scope versus Gate scope, remaining-work edge cases,
       stale provenance) repaired with its own coverage, and all 18 prototype axes rerun
       green at the repaired revision (`9a44678a`); stopped for MP2 human review →
       ../roadmap/p25-experience/design/experience-v2-prototype/authoring-completeness-plan.md.
       C9.1 implemented; MP1 accepted explicitly by owner in this thread (2026-10-04).
       Creator-loop regression hardening retains World/Camera/history and exact Preview return.
       Evidence → ../../prototypes/spatial-authoring/qa/EXPERIENCE-C9-EVIDENCE.md.
       Travel and fresh repeated-Stop visits owner-ratified; C9.4/C9.5 wait for MP2.
PRODUCTION ROUTE: (resumes after the prototype detour closes, below) remains F interface
       amendments, then re-derived T1 Spatial/P26, T2 Composition/P24, T3 Experience/P25 and
       T4 Release. P26 implementation and the architecture validation window remain gated.
PROTOTYPE BATON (owner-decided sequence, 2026-10-03): #112 close/merge → #113 Experience V2
       + real World ↔ Experience continuity → Paper PA0–PA12 in the next PR → prototype
       detour closes → F exact-interface amendments → T1/T2/T3/T4.
       #113 — C1–C8 in-scope behavioral/visual conformance complete (2026-10-04),
       under its tested contract. External manual review exposed donor parity and
       ordinary-workflow gaps; revised C9 plan, ratified Travel/Stop decisions →
       ../roadmap/p25-experience/design/experience-v2-prototype/authoring-completeness-plan.md.
       Earlier contract →
       ../roadmap/p25-experience/design/experience-v2-prototype/conformance-plan.md.
       Proof, exact executable provenance, final gates and Paper handoff →
       ../../prototypes/spatial-authoring/qa/EXPERIENCE-CONFORMANCE-ACCEPTANCE.md.
       The missing P23B fixture remains the external repository-gate blocker;
       restoration needs separate scope authorization. Earlier owner authorization
       covered C8 completion, coherent commits and push; C9.2/C9.3 is committed as `12652d9b`,
       the first external-review repair as `db83a9d7`, and the second review repair as
       `9a44678a`, with the evidence/status update as its docs-only child — all pushed to
       `origin/prototype-v2` on owner instruction. The current C9 instruction authorizes
       implementation through MP2, with MP1 accepted; no merge, closure or Paper work was
       performed.
       This work satisfies no F/T1 gate.
       C9 acceptance prioritizes capability semantics and blocking structural seams;
       detailed visual refinement belongs to the following dedicated UI/UX slice,
       separately scoped and unstarted. No PR placement assigned by this plan.
       PAPER — next PR after #113, not started: World Paper adoption, PA0–PA12 →
       ../roadmap/p26-spatial-depth/design/paper-authoring-prototype/implementation-plan.md;
       contract → PLATE §0.8.4 (accepted 2026-10-03).
BLOCKERS: none for F. Owner calls remain: P23B phase-wide compaction and P23B.1/.2
       review statuses → ../roadmap/p23b-geometry-performance/README.md;
       PLATE keyboard focus and mat↔paper transition (motion-speed placement settled by §0.8.4) →
       ../reference/design-system/editor-shell-and-visual-system.md §0.3, §0.7.6.
       Internal-component selectable identity, source/placement override semantics and
       production representation of temporary readings → ../../prototypes/world-experience-shell-round/README.md.
CARRY: TD-4 release costs · TD-5 `$state` proxy cost · D5 follow-up probes · M1
       session-conditioning limitation → ./tech-debt/README.md.
