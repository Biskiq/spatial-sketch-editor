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
        R1/R2 were ratified by the owner on 2026-10-25. Draft PR #191 now contains the T3 API
        lifecycle routes, migration 007, three writer leases, compensation, owned-key cleanup and
        retry CLI, plus the two P1 backend fixes for monotonic lease deadlines and advisory-client
        reuse. The T2 shared API review gate is satisfied by PR #191 review 5643653030. The T1
        pre-implementation review was approved in PR #191 review 5643884439; the bounded project
        list, Head and current-route integration is implemented in the branch. A read-only three-way
        route compatibility check against S06 commit
        `1747aaeee9bdee3bfafc1a88eb1a09ee40361e92` completed without conflicts; S06's additive
        perf-work observer composes with the lifecycle route additions, and no S06 checkout, harness
        or fixture was edited. Editor `npm run check` passed with zero errors/warnings, and 10
        affected fast-contract files passed 144 tests on this implementation revision. The API
        suite passed 110 tests with zero skips at `821adf6a9bb04f66287f333720191e4d59b48253`;
        detailed fail-before/pass-after evidence is in
        [backend concurrency/deadline evidence](../../roadmap/t3-experience/t3.p04-project-lifecycle/t3.p04.s01-project-rename-and-delete/backend-concurrency-deadline-evidence-2026-10-25.md).
        Residual lifecycle API and Chrome F9 work is committed in `e41dffea`.
QA:     The initial full repository gate passed at `7c7cea0dd6c1b4a3159d9c86a2e7879874a0800e`:
        editor 190 files/2,458 tests, arch 22/178, heavy 9/125, package checks, and DB API 110/110.
        Residual validation at `e41dffea`: API check and full DB suite passed (114 tests, zero
        failures/skips); editor check and build passed; focused Save-trace tests passed 2/2. The
        integrated Chrome lifecycle journey passed, and the final strict F9 run passed 60 measured
        S/M rows with exact screenshot/frame presentation joins in Chrome 155.0.8059.85. The agent
        run was on AC power, so it is observation-only for the owner battery hard row. See the
        [evidence report](../../roadmap/t3-experience/t3.p04-project-lifecycle/t3.p04.s01-project-rename-and-delete/evidence/2026-10-25/verification.md).
        Slice acceptance remains pending.
NEXT:   1. Run the F9 hard rows under the owner-operated reference procedure on battery with Low
           Power Mode off; the current agent-operated AC run is observation-only.
        2. Obtain independent slice review. Keep PR #191 draft. Do not accept/close the slice or
           phase or merge it.
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
BLOCKER: Owner acceptance remains open. The previously listed residual API cases are covered and the
         new S/M Chrome measurement is recorded. Owner-operated battery-reference performance rows
         and independent slice review remain. Existing bounded browser semantics coverage is retained;
         no separate manual screen-reader audit gate is added. The T1 review authorizes the bounded
         shell integration, not S06 completion or release of its shared harness ownership. Verification
         does not accept the slice or authorize merge.
API:     Route contract is `PATCH /projects/:projectId` with `{name, precondition}` and
         `DELETE /projects/:projectId` with `{precondition}`; both require an expected saved-base
         token. Upload writes use a 180 s request bound, a fixed 170 s SQL lease, a 2 s heartbeat
         and a 5 s abort margin. The enforced local deadline starts before lease acquisition and
         is checked synchronously at byte-write/finalization boundaries. Approval and deletion
         cleanup use their held advisory client for protected SQL; approval renewal shares that
         client after lock acquisition. Cleanup waits 187 s before its first empty listing and
         another 187 s before the second. Owner-run retries use `npm run cleanup:project-deletions`;
         pass `--verify-completed` to check and repair completed tombstones.
VERIFY:  Residual code and evidence are in `e41dffea`. `npm run check:api` passed; `npm run test:api`
         passed 114, 0 failed, 0 skipped on a fresh private DB, dropped by shell trap. Editor check,
         editor build and focused Save-trace tests passed. Integrated headed Chrome lifecycle UI/API
         coverage passed. The final strict Chrome F9 run recorded 10 measured samples for each S/M ×
         cold/warm/repeat-use cell; every sample has the visible Saving label at the render boundary
         and an exact screenshot source/frame join to `STATE_PRESENTED_ALL` before the durable receipt.
         Browser-reported feedback p95 spans 68.1–69.5 ms for M and 71.1–71.3 ms for S; p95 durable
         receipt spans 551.7–627.6 ms for M and 122.2–127.0 ms for S. Chrome was 155.0.8059.85 on
         Mac14,2/macOS 15.7.2; power remained AC with Low Power Mode off. Agent-operated, process-local
         ObjectStore and a minimal retained GLB; not owner hard-row acceptance or physical scanout.
         Full detail and prior gate history are in the evidence report. Shared S06 databases were
         untouched.
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
