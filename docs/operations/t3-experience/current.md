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
       T3.P04 Project lifecycle → active
       ../../roadmap/t3-experience/t3.p04-project-lifecycle/README.md
ACTIVE: T3.P04.S01 Project rename and delete — implementation started 2026-10-25 from trusted
        base `976323da9e18e96978649e595bc555021964631a` (PR #188 merged on main).
        R1/R2 were ratified by the owner on 2026-10-25; the plan and phase references carry the
        accepted rules. T3's additive client transport and unrun client probes are prepared;
        acceptance remains pending.
NEXT:   1. Obtain T2 review of the [API handoff material](../../roadmap/t3-experience/t3.p04-project-lifecycle/t3.p04.s01-project-rename-and-delete/t2-api-handoff.md)
           before editing shared API files: owned-key inventory, `model_revisions.source_keys`
           migration/backfill, and revocable leases plus compensation at `uploadModelFile` and
           `approveModelImport`.
        2. Keep the bounded T1 shell patch behind T1.P02.S06's recorded shell-file claim and T1
           pre-implementation review ([handoff material](../../roadmap/t3-experience/t3.p04-project-lifecycle/t3.p04.s01-project-rename-and-delete/t1-shell-handoff.md));
           do not touch claimed files.
        3. Complete the T3-owned lifecycle API and remaining lifecycle/concurrency/cleanup probes
           after the T2 handoff review; the T1-owned dirty-state integration remains with its shell
           review. Verification is exhaustive, but the owner has deferred all tests, builds and
           other heavy verification until S06 is explicitly finished.
        4. Open a draft implementation PR while reviews and required verification remain pending;
           do not accept/close the slice or phase or merge it.
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
BLOCKER: T2 review gates shared API edits. S06's recorded claim and required T1 review gate only the
         shell patch. The reference-machine benchmark prohibits tests/builds/heavy verification
         until the owner confirms S06 is finished; do not infer completion or poll for it.
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
