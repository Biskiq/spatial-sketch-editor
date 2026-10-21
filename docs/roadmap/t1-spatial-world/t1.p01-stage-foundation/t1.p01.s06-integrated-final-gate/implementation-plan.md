# T1.P01.S06 — implementation plan — CLOSED STUB

```text
AUTHORITY: NONE — the phase README owns status; the closed acceptance stub records outcomes and recovery.
STATUS:    accepted and shipped 2026-10-21 by routine slice-closeout under a scoped owner-override.
PROVENANCE: PR #168; owner acceptance at implementation revision d63bdb6c0ffbcbd6d2670d4f1c725f66e52194fa.
ROLE:      recovery route for the approved exhaustive integration scope and its verification tier.
NOT:       product contract · acceptance authority · phase closure · architecture verdict.
VERIFICATION: exhaustive
```

## Delivered

T1.P01.S06 completed the integrated final gate for the Stage host: the approved source/session race
repair, pointer/overlay coordinate correction, press-scoped drag evaluation and reading-interruption
preservation, plus the Index-selection cloneability correction. It integrates the existing Plan/3D,
Layout, F2 Save/reload, Camera and shared Stage paths without adding a second authority.

## Accepted contract

- `CONSUMES`: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1,
  T1.viewport-projection@1, T3.camera-experience-cutover@1.
- `REQUIRES`: F1 `unit-resolution-v1`; F2 `unit-envelope-v1`; F4 `unit-acceptance-v1` and
  `conditional-save-units-v1`; T1 `viewport-projection-v1`.
- Verification tier: **exhaustive**. S06 is T1.P01's declared final integration route.
- Output: recorded phase integration acceptance only; no new gate capability or provider outcome.
- Owner override: the owner accepted S06 at the implementation revision above and waived the
  independent-review verdict for this slice and revision. All acceptance criteria, trusted-base
  prerequisites and exhaustive verification rows remain required and are recorded as satisfied in
  the acceptance artifact.

## Evidence

The [closed acceptance stub](./acceptance.md) records the owner-override, phase closure and residuals.
The complete criterion matrix, browser fixtures and implementation gate are recoverable at the phase
close anchor below: check/build and package/API checks passed; full editor suite 170 files / 2,227
tests; arch 20 / 166; heavy 8 / 118; DB-backed API 80 passed with zero skips. No performance
threshold or speed claim was accepted.

## Entry points

```text
implementation  apps/editor/src/routes/project/[projectId]/spatial/+page.svelte
                apps/editor/src/lib/authoring/stage/stage-facade.ts
                apps/editor/src/lib/authoring/adapters/layout/
validation      apps/editor/tests/lib/authoring/spatial-route-gesture.test.ts
                apps/editor/tests/lib/authoring/spatial-route-source-replacement.test.ts
                apps/editor/tests/lib/authoring/stage-facade.test.ts
                apps/editor/tests/lib/authoring/layout-wall-manipulation.test.ts
```

## Residuals

- Card-over-Compose remains owned by T1 shell composition.
- Layout-plinth dimension editing has no shipped writer and is not claimed.
- Four development-only `derived_inert` warnings occur after Resume destroys the prior instrument; the
  recorded browser and mounted tests found no stale instrument or paused marker.

## Recovery

```text
git show b786ccff126a33286627bd6510671199b7354279:docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s06-integrated-final-gate/implementation-plan.md
anchor   b786ccff126a33286627bd6510671199b7354279 (full plan body)
tag      closed/T1.P01.S06 at b786ccff (local only — not pushed)
```
