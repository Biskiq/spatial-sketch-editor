# T1.P02.S05 — Legacy Layout retirement: implementation plan — CLOSED STUB

```text
AUTHORITY: NONE — the phase README owns slice status; this stub records scope and recovery.
STATUS:    accepted (`owner-override`, 2026-10-23) and shipped by PR #183 (merge commit recorded in Git).
SOURCE:    PR #183 implementation revision 588cc70f26ee80364a0cb211233d0cd82836db25 (base main fff7dc14).
CONSUMES:  F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES:  F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1,
           F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1,
           T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t1.p02.s04-integrated-final-gate/acceptance.md
NOT:       a new capability outcome, final-gate result, phase closure, track completion or architecture verdict.
```

## Delivered

Retired the Room-owned legacy Layout document surface while keeping the format-6 wall-first reader,
identities, the single canonical compiler and compiled behaviour. Discharges S01's stop-and-report
(not a second format cutover). The full scope, ownership rules, fixture conversion sequence and
acceptance criteria are recoverable from the anchor below.

## Contract

The retirement contract is owned by the [acceptance record stub](./acceptance.md): the retired modules and
exports, the owned replacement modules, the two cross-track exceptions (Scene `frame.ts` and the
`project-layout-semantics.ts` registry facade) and their T2/T3 approvals, and the retained surface.

## Evidence

Full evidence (tested revision `588cc70f`, owner ruling, fixture mapping, semantic deltas) is in the
acceptance stub. Architecture-integration tier as declared; the integrated exhaustive proof remains with
T1.P02.S04.

## Entry points

```text
implementation  packages/layout-core/src/layout-coordinates.ts
                packages/layout-core/src/layout-path.ts
                packages/layout-core/src/layout-issue.ts
                packages/layout-core/src/layout-wall-portals.ts
                packages/layout-core/src/layout-geometry.ts
                packages/layout-core/src/layout-geometry-types.ts
                packages/layout-core/src/layout-geometry-validation.ts
                packages/project-model/src/project-layout-semantics.ts
                packages/project-model/src/scene-planning/frame.ts
validation      apps/editor/tests/lib/layout/layout-geometry-boundary.test.ts
regressions     apps/editor/tests/lib/layout/layout-geometry.test.ts
                apps/editor/tests/lib/layout/layout-g2-fixtures.test.ts
                apps/editor/tests/lib/project-model/placement-frame.test.ts
```

## Residuals

```text
- T1 track README deferred-retirement rows: Room-level wall mesh path; Camera room-ownership branches
- S01 F2 S/M open timings: assigned to T1.P02.S04 on the designated MacBook Air M2
- Curve-authoring allocator tripwire: occupancy-derived curve-knot/interior-anchor allocators stay
  outside accepted intents until the first curve-authoring slice
```

## Recovery

```text
git show 6d87e25b9ab4695472d96c0b3ef3a15b777bc062:docs/roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s05-legacy-layout-retirement/implementation-plan.md
anchor  6d87e25b9ab4695472d96c0b3ef3a15b777bc062
 tag    closed/T1.P02.S05 → 588cc70f26ee80364a0cb211233d0cd82836db25 (acceptance anchor; local only — not pushed)
```

P1 recovery requires a merge commit. The merge owner verifies the recorded anchors are reachable from merged `main`.
