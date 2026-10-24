# T3 — Experience: current baton

Track-scoped handoff. **Replace only this file for T3 work.**

```text
PHASE: T3.P01 Camera/Experience foundation → closed 2026-10-20
       T3.P02 First Capture and Cut Preview → closed 2026-10-24
       ../../roadmap/t3-experience/t3.p02-capture-and-cut-preview/README.md
       (final gate T3.P02.S02 accepted 2026-10-24 as owner-override at 335820d6)
       T3.P03 Shared acceptance and measurement → closed 2026-10-24
       ../../roadmap/t3-experience/t3.p03-shared-acceptance-and-measurement/README.md
       (final gate T3.P03.S02 accepted 2026-10-23 as owner-override at eabd4b88)
       T3.P04 Project lifecycle → approved
       ../../roadmap/t3-experience/t3.p04-project-lifecycle/README.md
ACTIVE: T3.P04.S01 Project rename and delete — authorized and released 2026-10-24, NOT started.
        No implementation, migration, route or UI exists for it; this coordination PR is
        documentation only.
NEXT:   Start T3.P04.S01 after its coordination PR merges on main:
        1. runbook start step — re-verify F2.unit-envelope@1:unit-envelope-v1 and
           F4.intent-acceptance@1:conditional-save-units-v1 at the slice's trusted base, and its
           now.md row;
        2. read the planning resolution's five mechanisms and its two review corrections — the
           name/publication contract rulings are PROPOSED and not ratified, so nothing about
           rename/delete persistence is frozen; the cleanup design is a revocable write lease
           with an enforced write bound, a persisted complete key set (including approved source
           copies) and a bounded scoped sweep, not a listing-only sweep;
        3. T2 review of the API handoff (owned-key inventory, the `model_revisions.source_keys`
           column and its backfill, and the revocable lease at uploadModelFile and
           approveModelImport with per-writer compensation) before touching shared API files —
           no project-owned writer may bypass the lease;
        4. the bounded T1 shell patch is serialized against T1.P02.S06's recorded claim and
           T1-reviewed before implementation.
RELEASE: ../../reference/decisions/t3-phase-close-and-p04-authorization-2026-10-24.md
         (closes T3.P02 and T3.P03, authorizes and releases T3.P04.S01; the live release row is
         docs/roadmap/now.md)
         ../../reference/decisions/performance-foundation-authorization-2026-10-24.md
         (T1.P02.S06's release and the temporary performance-first halt — unchanged by this PR;
         T3.P04.S01 is strictly unrelated to it but must not edit S06's shared harness/fixtures)
ROUTE:   ../../roadmap/t3-experience/t3.p04-project-lifecycle/t3.p04.s01-project-rename-and-delete/planning-resolution-2026-10-24.md
         → ../../roadmap/t3-experience/t3.p04-project-lifecycle/t3.p04.s01-project-rename-and-delete/implementation-plan.md
         (closed gate artifacts remain stubs at their own paths: T3.P02.S02 and T3.P03.S02
         acceptance.md, anchors 8cc30c94 and a65db2e0, tags closed/T3.P02 and closed/T3.P03)
BLOCKER: none. S06 owns the T1 shell-file claim; P04 queues behind it and behind the reference-machine
         perf lock. No T3 phase close or track event is pending.
CARRY:   T3.P02 Scope A (performance, deferred 2026-10-24, not claimed): traced Preview first frame;
         capture/bind completion; M-workload F10 rows; F13 re-measure; reference-machine run; Stage
         initial-load delta. Transferred as measurement to T1.P02.S06; a miss in T3-owned code is
         reported back to T3. The H0 trace-method ruling stays with the owner.
         T3.P02 Scope B (unrun, deferred, not waived): Ask Rule; Experience paused editing; dense
         20/50-View and 15/30-Stop fixtures; browser Preview-replacement probe; browser
         Save/download/reload; touch/coarse pointer; DOM reach without raycast; partial shared-Camera
         row; Travel/detour browser rows. Owned by T3; no owner command exists for some of them.
         T3.P03: L/XL fixtures and M/L drag rows transferred to T1.P02.S06; trace-method disposition
         (t3p03s02 deviation record), reference hard rows and calibration stay open with the owner.
         Deferred T1 seam: host EditorCard still has no Experience contribution seam.
         F2 epoch migration 005 production activation remains a separate owner-run operation.
         Track completion and Core Editor Stability acceptance are separate owner events.
```
