# T1 — Spatial world: current baton

PHASE: T1.P02 Native Wall creation (registered 2026-10-22, batch E) →
       ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/README.md
       T1.P01 closed 2026-10-21; all its registered slices are shipped.
ACTIVE: none yet. T1.P02.S01 is `approved` and released from the hold (batch E, E7), but it starts
        only after T3.P03.S01 is merged on `main`; S02–S04 are `proposed` and not authorized.
NEXT: When T3.P03.S01 reads `shipped` in the T3.P03 slice register on `main`, start T1.P02.S01
      through the T1 runbook start step from that base. The drawing policy is owner-accepted (E3).
      Hard performance rows need the Reference A machine the owner still has to name (E6).
ROUTE: ../../roadmap/t1-spatial-world/README.md#phase-register →
       ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/README.md →
       ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s01-layout-identity-and-format-cutover/implementation-plan.md
       → ../../reference/decisions/batch-e-authorization-2026-10-22.md (provenance)

T1.P01's S06 final gate is accepted and recorded under a scoped owner-override. The phase README
records the owner ratification; its final-gate stub carries the exact recovery anchor. PR #168 merged by P1 merge commit `e8e83490`; its slice and phase recovery anchors were verified
in merged `main` ancestry.

BOUNDARIES: P1 merge commit and preservation ancestry verified. Card-over-Compose remains owned
by T1 shell composition (T1.P02.S02's Card/instrument arbitration); Layout-plinth dimension editing is not claimed. No T1 TRACK COMPLETE
event or architecture verdict is recorded.
