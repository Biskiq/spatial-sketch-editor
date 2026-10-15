# T1.P01.S02 — Shell, Stage and viewport provider: implementation plan

**Slice:** T1.P01.S02 · **Status:** proposed — not authorized · **Phase:** [T1.P01](../README.md) ·
[slice register](../README.md#slice-register) · **Track:** [T1](../../README.md) · **Runbook:**
[T1 operations](../../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F3.channels@1
REQUIRES: F1.reference@1:references-v1, F3.channels@1:inspection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t1.p01.s06-integrated-final-gate/implementation-plan.md
```

## Prerequisite

S01's gates accepted at trusted base.

## Produces

`T1.viewport-projection@1`, with the [exact seam](../interfaces.md#viewport-projection-v1).
This is the expected cycle opener. Re-arm M5 at actual project/session replacement wiring.

## Scope

Replace the spatial notice with a real route host: current-format cloud read, explicit
current-format source-JSON open, validated starter-gallery/empty boot, loading/error/refusal, single replacement
epoch and teardown. No legacy recognizer. Starter template boot compiles a real floor and has no live Wall-creation
command; it does not re-arm M4. Replacement validates first, then atomically cancels
writers, clears old selection/task/return context and swaps project/session; stale load and
Camera completions cannot affect the replacement. No project-specific singleton survives it.

Build the minimal PLATE Head, Index, Stage, contextual Card and one instrument host needed by
consumer conformance. Defer broad Search/Browse depth and nonessential shell polish to S04;
keep selection, focus, keyboard/narrow posture and the required semantic host here. At rest there
is no empty Card/instrument. Add minimal selection and subject Search/Browse; keep Select,
Open location and Bring into view separate. Experience has a real empty/unavailable lens
posture until T3 mounts its adapter; Preview/Save explain unavailable capability. Do not
invent Presentations, Guides, Views or a mock editable Experience.

Use one persistent Threlte Canvas/Stage across readings and lenses. Select the shadow-map type
explicitly at the new Canvas, as the landed r186 upgrade does (`PCFShadowMap`); no boolean `shadows`
that would resolve to the removed PCFSoft filtering path. Render canonical Layout
and existing Scene through runtime-safe adapters. Add Layout-owned ordinary Plan evaluation
from compiled solids/queries: cut/projected/hidden/symbol streams, source correspondence,
finite depth and reasoned membership. This is ordinary horizontal Plan only, not Section or
Unroll. Add Camera-owned pan/orbit/zoom, explicit Fit/Bring into view and Plan↔3D evaluation.
Plan is exactly orthographic; transitions use the authority's evaluated projective projection,
not a near-orthographic FOV hack, shell tween or second Plan affine transform.

## Acceptance criteria

shared projection drives meshes, overlays, pointer rays and working-plane
inverses; top-down axes are to scale; flip preserves target and target-plane scale, settles
azimuth at the nearest 90° and returns to last working elevation without refitting. Card,
instrument and sheets do not resize/reframe Stage; resize updates projection aspect without
an implicit fit. Empty, free-standing/curved/shared Walls and hosted Openings render truthfully.
Editor/visitor Wall positions, surfaces and Junction attribution agree for identical compile
inputs. Hidden/ineligible targets cannot intercept input. T2/T3-style consumer probes consume
the seam through the public editor interface and no private Stage state (details in interfaces).
Keyboard/focus, reduced-motion endpoints, replacement teardown and public isolation pass.
Record seam acceptance independently of the phase final gate, then make it available at a
subsequent consumer's trusted base. No consumer may claim readiness from this plan alone.

## Readiness declaration

`T1.viewport-projection@1` is recorded with this slice as its expected sole provider
([interface draft](../interfaces.md#viewport-projection-v1)). This slice is **proposed and not
authorized**: its authorization, implementation and acceptance are separate owner decisions, and
the gate's own state stays `ratified` until real code, independent review and recorded evidence
exist. It may not begin until every `CONSUMES` gate is accepted at the trusted base, and both
`REQUIRES` capabilities are accepted — a ratified interface is neither implemented nor accepted.
Because this slice is listed under the phase's bounded exposure window, its first authorized
implementation is what opens that window (see
[Bounded architecture-cycle window](../README.md#bounded-architecture-cycle-window)); it may not
start without that hook.
