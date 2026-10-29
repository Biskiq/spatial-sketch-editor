# T5.P01.S03 — Integrated final gate: implementation plan — CLOSED STUB

```text
AUTHORITY: NONE — the phase README owns lifecycle; the acceptance record owns the gate verdict,
           evidence, residuals and owner direction. This stub preserves the approved scope and
           recovery path only.
STATUS:    ACCEPTED 2026-10-28 at 9bcbd7ebe4142d59d2b82d6ef428e7ffdcbfde4c; shipped through
           PR #218 (P1 merge 25e1bd8f). T5.P01 closed 2026-10-28 by owner ruling; T5 is not complete.
VERIFICATION: exhaustive
CONSUMES:  F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES:  F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1,
           F4.intent-acceptance@1:unit-acceptance-v1,
           F4.intent-acceptance@1:conditional-save-units-v1,
           T1.viewport-projection@1:viewport-projection-v1
NOT:       T5.P01 closure, track completion, a performance pass or a Wall-face delivery.
```

## Approved scope

The phase's declared **FINAL PHASE GATE** and the integration route for S01, S02 and S04. It added
no product feature. It proved drawn native objects from an empty project and the starter: draw,
read, pull depth and create floor and upright-sheet forms; place, turn, size per axis, duplicate
and delete; exact Undo/Redo for every accepted edit and no history for refused, cancelled, stale or
no-op edits; Save and cold reopen with identical golden digests; the two-project My Objects reuse
journey with independent copy, item and project A; Plan/3D/Preview agreement; strict refusal of
Scene format 3 and malformed forms; the cold-release form refusal; and the golden corpus in V8 plus
a non-V8 engine with bit-identical digests.

The owner walkthrough required three different objects from an empty project, one reused in a
second project through My Objects. Wall-face creation waits for T1's face-frame query; the approved
hand-aligned upright sheet is the delivered upright route.

## Result

Accepted. The complete repository contract, 3 Chromium journeys / 27 rows, three-engine digest
parity and the one authorized spot check are recorded in the
[acceptance record](./acceptance.md). The spot measured `not-usable` M/L under load; it is
unfavorable evidence, not a performance pass. The comprehensive performance matrix stays
suspended and unmeasured rows stay unmeasured.

## Evidence

- [Acceptance record](./acceptance.md)

The raw JSON/data, logs, screenshots and capture scripts were transient and pruned from the final
tree at owner direction after acceptance; recover them from `574a823b` and `9bcbd7eb` as recorded
in the acceptance record.

## Entry points

```text
regressions apps/editor/tests/lib/visitor/visitor-cold-runtime.test.ts
            apps/editor/tests/lib/content/form-evaluation.test.ts
            apps/editor/tests/lib/geometry-core/**
            apps/editor/tests/lib/authoring/scene-operation-acceptance.test.ts
            apps/api/tests/form-library.test.mjs
```

## Recovery

```text
git show c13a949d:docs/roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s03-integrated-final-gate/implementation-plan.md
full gate/raw evidence  git show 574a823b:docs/roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s03-integrated-final-gate/acceptance.md
capture harness         git show 9bcbd7eb:apps/editor/perf/flows/t5-p01-s03-integrated-final-gate.spec.ts
anchor  c13a949d — full approved plan body on main
         574a823b — full acceptance body and raw evidence
merge   PR #218 — P1 merge 25e1bd8f; no squash or rebase
phase   T5.P01 closed 2026-10-28 — PHASE CLOSE in the phase README
tags    closed/T5.P01.S03 → da091a7f; closed/T5.P01 → the phase-close P1 merge commit
```
