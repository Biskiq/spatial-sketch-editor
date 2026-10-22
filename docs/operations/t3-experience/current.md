# T3 — Experience: current baton

Track-scoped handoff. **Replace only this file for T3 work.**

```text
PHASE: T3.P03 Shared acceptance, isolation and measurement (H0; registered 2026-10-22, batch E) →
       ../../roadmap/t3-experience/t3.p03-shared-acceptance-and-measurement/README.md
       T3.P02 First Capture and Cut Preview (registered 2026-10-20) →
       ../../roadmap/t3-experience/t3.p02-capture-and-cut-preview/README.md
       T3.P01 is CLOSED 2026-10-20 (final gate `06a8aac8`, merged `9a457f6b`, PR #158).
ACTIVE: none in implementation. T3.P03.S01 is closed out (`shipped`, acceptance `owner-override`) on
        `t3/p03-s01-planner-scope-build-isolation` at merged head `95dc052e`, awaiting the owner's
        merge. Its acceptance record and owner waiver ruling are in
        ../../roadmap/t3-experience/t3.p03-shared-acceptance-and-measurement/t3.p03.s01-planner-scope-and-build-isolation/acceptance.md.
BATON: Owner merges `t3/p03-s01-planner-scope-build-isolation`. That merge releases, in parallel,
       T3.P03.S02 (the phase's final gate) and T3.P02.S01; per the release list it also releases
       T1.P02.S01 and T2.P02.S01. Each starts through the runbook start step and rechecks its base.
       The per-merge default-timeout `npm test` rerun at the merged head is still owed.
NEXT:  the owner's merge. Then the release list order, with T3.P03.S02 as the phase's final gate.
       The capture slice settles the format draft's two open points (text bound, entryViewId) at
       implementation review.
ROUTE: ./README.md → ../../roadmap/t3-experience/README.md (phase register) →
       ../../roadmap/now.md →
       ../../roadmap/t3-experience/t3.p03-shared-acceptance-and-measurement/t3.p03.s01-planner-scope-and-build-isolation/implementation-plan.md
       → ../../roadmap/cross-track-execution.md#authorized-batch-e-2026-10-22 (protocol)
       → ../../reference/decisions/batch-e-authorization-2026-10-22.md (provenance)
BLOCKER: the owner's merge of T3.P03.S01 (the start gate for the released slices above). Hard performance rows (the capture
         slice's F10, and the measurement slice's baseline and calibration) run on the owner's
         MacBook Air M2, 16 GB, operated by the owner (E6 amendment).
CARRY:  SEPARATE AND STILL OWED: the owner-run production activation of the F2 epoch (migration 005,
        API and editor deploys, namespace-scoped R2 purge, smoke checks). The S04 merge executed no
        migration against a deployed database. Residuals that move into this phase or beyond: the
        authored Cut/Travel selector and presentation text homes (the capture slice's Experience
        format draft; state/lifecycle homes stay later), model resource bytes (T2.P02.S01 verifies
        them) and other resource bytes host-asserted until storage verifies them, the envelope's
        acceptedRevision as baseline provenance only, and T4's prepared public reader under the
        approved empty publication gap. T3 track completion remains a separate owner event.
```
