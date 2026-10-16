# T1.P01.S02 — acceptance record: Shell, Stage and viewport provider

**Slice:** T1.P01.S02 · **Status:** authorized 2026-10-16; implementation **in progress and partial**
(the parallel batch of 2026-10-16) — **no acceptance recorded** ·
**Plan:** [implementation-plan.md](./implementation-plan.md) (owns the criteria) ·
**Phase:** [T1.P01](../README.md)

**No acceptance evidence is claimed.** Nothing below is a tested result: the declared
`architecture-integration` tier has not been run against this work, no independent review has
happened, and the merge gate on the then-current `main` is still owed. `T1.viewport-projection@1`
stays `ratified` with empty evidence, and no consumer may claim readiness from this slice. The
`F1.reference@1:references-v1` / `F3.channels@1:inspection-v1` prerequisites are accepted on `main`
as the plan requires; they are not this slice's evidence.

## What this increment implements (unverified)

The plan's own seam-first order, stopped at a coherent boundary:

| Layer | Artifact |
| --- | --- |
| Projection/inverse and pose family | `packages/camera-core/src/viewport-math.ts` (column-major right-handed kernel), `packages/camera-core/src/viewport.ts` (`ViewportRect`/`ViewportEvaluation`/`InspectionPose`, `evaluateViewport`, pan/orbit/zoom/Fit/Bring-into-view intents, the exact orthographic Plan endpoint and the projective transition between the readings, `projectWorld`, `pointerRay`, `intersectWorkingPlane`, `rebaseViewportSource`, the deterministic quarter-turn settlement) |
| Layout Plan representation | `packages/layout-core/src/layout-plan-representation.ts` (`cut`/`projected`/`hidden`/`symbol` streams, Layout-native `PlanSourceRef` correspondence, per-source membership with measured reasons, union `reveal`, `eligiblePlanFragments`) |
| Content identity | `packages/project-model/src/content-identity.ts` (`computeSourceContentId`), barrel export, and its invariance suite |
| Start hook | `docs/operations/architecture-cycle.md` (`open-window`: `Opened by` = `T1.P01.S02`, readiness `open`, `PHASE_1` → `PHASE_2_VALIDATING`), the phase README's S02 row and window statement, `docs/operations/current.md` (baton) |

Suites written with it (also unverified): `apps/editor/tests/lib/museum/navigation/camera-viewport-evaluation.test.ts`,
`apps/editor/tests/lib/layout/layout-plan-representation.test.ts`,
`apps/editor/tests/lib/project-model/content-identity.test.ts`, plus the additive
`viewport-math.ts` / `viewport.ts` entries in `tests/lib/museum/camera-core-boundary.test.ts`.

## What this increment does not implement

The plan's third and fourth layers are **not** delivered, so several acceptance criteria are open by
construction:

- the editor route host, explicit source-JSON open, the starter gallery/empty boot and every
  `new`/`missing`/`forbidden`/`error`/`refused` state, the blocking-compile diagnostics state, and the
  no-write call-site proof;
- the PLATE Head/Index/Stage/Card composition, the single persistent Threlte Canvas with explicit
  `PCFShadowMap`, the overlay/selection/gesture/keyboard/focus host, reduced motion, and the
  replacement epoch with its teardown;
- the public-route module-graph proof for the new editor modules (there are no new editor modules yet;
  the camera-core and layout-core additions are runtime-safe and covered by the arch lane instead);
- the T2-style and T3-style consumer probes of the seam.

`T1.viewport-projection@1`'s consumer boundary is a **public editor host**, so the gate cannot be
accepted from this increment alone. The plan authorizes the implementer to propose a registered split
in exactly this situation; the owner decides whether the host/shell layer becomes a second increment of
S02 or a registered successor slice. Until then the phase row stays `in-progress`.

## Owed before any acceptance

The complete merge gate in [`apps/editor/tests/README.md`](../../../../../apps/editor/tests/README.md)
on the then-current `main` (arch lane unconditional), the DAG/consumer-probe rows, the integration
route through [S06](../t1.p01.s06-integrated-final-gate/implementation-plan.md), and independent
review. Evidence belongs here when it exists — with the tier, tested revision, commands and results
that convention requires.
