# T1.P02.S01 — Layout identity and format cutover: CLOSED STUB

```text
AUTHORITY: NONE — the phase README owns slice status; this stub records scope and recovery.
STATUS:    accepted and shipped 2026-10-23 by per-slice owner-override.
SOURCE:    PR #179 accepted implementation tip 7e159370a94a1a5e3cbb6d48abe42a66f7c3bd48.
INTEGRATED: rebased S01 implementation 401b612f562e3a57d305ae3f831b24beba2dc6ae on PR #180
           merge c1e4e0307a6e5d293f25d35e233451730a34b8db.
CONSUMES:  F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES:  F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1,
           F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1,
           T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t1.p02.s04-integrated-final-gate/acceptance.md
NOT:       a new capability outcome, final-gate result, phase closure or architecture verdict.
```

## Delivered

Layout operations capture non-reusable identities for redo-safe edits, and Layout format 6 derives Wall role from reconciled Room boundary membership. The accepted stop-and-report leaves legacy Layout types/codecs and the compiler adapter for a separately authorized retirement before S02.

## Verification evidence

The recorded architecture-integration tier passed on the original S01 source revision `7e159370a94a1a5e3cbb6d48abe42a66f7c3bd48`: `npm run check` (0 errors, 0 warnings), package/API checks, fast (143 files / 1,996 tests), heavy (9 / 125), arch (22 / 173), full editor suite (174 / 2,294), and DB-backed API suite (11 / 82, 0 skipped). The recorded evidence is reused; no product checks were rerun for this documentation-only closeout. F2 open timings at S and M were not run; under the [2026-10-28 suspension](../../../../reference/decisions/performance-mandate-suspension-2026-10-28.md) they remain **unmeasured historical rows**, not an S04 prerequisite, and no benchmark is authorized.

## Owner-override scope

The closed acceptance stub records the 2026-10-23 per-slice override, exact waivers, criterion evidence, residuals, preservation report and closeout self-check. It preserves original PR #179 source provenance separately from the rebased integration revision. The override accepts this slice only. It does not authorize the §3 retirement, accept S04, or close T1.P02.

## Entry points

```text
implementation  packages/layout-core/src/layout-id-capture.ts
                packages/layout-core/src/layout-wall-first-types.ts
                packages/layout-core/src/layout-wall-first-codec.ts
                packages/layout-core/src/layout-wall-role.ts
                packages/project-model/src/units/validate.ts
validation      packages/layout-core/src/layout-wall-first-validation.ts
regressions     apps/editor/tests/lib/layout/layout-identity-capture.test.ts
                apps/editor/tests/lib/layout/t1s01-format6-differential.test.ts
                apps/api/tests/save.test.mjs
```

## Recovery

```text
git show 401b612f562e3a57d305ae3f831b24beba2dc6ae:docs/roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s01-layout-identity-and-format-cutover/implementation-plan.md
anchor  401b612f562e3a57d305ae3f831b24beba2dc6ae
 tag    closed/T1.P02.S01 → 302f966d48faf1f63d2b089cec31bca43582f178 (local only — not pushed)
```

P1 recovery requires a merge commit. The merge owner verifies the recorded anchors are reachable from merged `main`.
