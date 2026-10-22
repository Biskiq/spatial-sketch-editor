# T1 — Spatial world

**Track:** T1 · **Status:** approved — T1.P01 closed 2026-10-21 after S06; `T1.P02` (native Wall
creation) registered 2026-10-22 as batch E with `T1.P02.S01` authorized; `T1.P01.S01` shipped (shared F1/F3
providers accepted); S02, S03, S04 and S07 shipped (S07 accepted `viewport-projection-v1`); S05
shipped; S06 accepted and shipped 2026-10-21 by scoped owner-override in PR #168. The T1 track is
not complete ([track register](../README.md#track-register)) · **Runbook:**
[`../../operations/t1-spatial-world/README.md`](../../operations/t1-spatial-world/README.md)
**Evidence:** [`planning-evidence.md`](./planning-evidence.md) · **Gates owned:**
`T1.viewport-projection` ([gate register](../README.md#gate-register)) ·
**Contracts:** [`architecture.md`](../../reference/architecture.md),
[`north-star.md`](../../reference/north-star.md),
[PLATE](../../reference/design-system/editor-shell-and-visual-system.md),
[spatial instrument grammar](../../reference/design-system/spatial-instrument-grammar.md)

## Bounded objectives

The spatial world: how architecture is represented, read in Plan and 3D, and authored.
Completion evidence for any phase in this track is a recorded acceptance against the phase's
declared final gate, with the kernel invariants (compile, topology, Junction, curve, Room
reconciliation, precision) still proven and the visitor/public boundary still green.

- the shell, Stage, viewport and projection seam, and the Plan/3D readings;
- Layout representation, including architectural fragment streams (cut / projected / hidden /
  symbol) with source correspondence;
- Layout authoring: the authored Wall primitive and its derived role, levels, structures,
  closed enclosures, openings, overhead forms;
- the retained precision and accessibility seams ([`../../../apps/editor/src/lib/authoring/`](../../../apps/editor/src/lib/authoring/)).

## Concern ownership and exclusions

- **Owns:** Layout representation and authoring, Plan/3D projection and viewport, wall-mesh and
  Junction-consuming presentation, the shell/Stage that hosts them, and the T1 half of the
  precision/a11y seams.
- **Does not own:** Scene placement, materials, lights, ingest (T2); Camera/Experience authoring,
  preview, history and acceptance (T3); publication UI and the prepared reader (T4). The F
  interface semantics stay owned by
  [`composition-execution.md`](../../reference/composition-execution.md); T1 is one consumer.
- **Ordering:** T2/T3 authoring consumes the T1 viewport/projection seam and does not wait for
  T1's later representation slices. Exact `Gate@Version` prerequisites, never track order,
  govern eligibility.

## Current vs destination contracts

| Concern | Current (landed tree) | Destination |
| --- | --- | --- |
| Layout document | F2 Layout unit, wall-first `formatVersion: 5`, one floor datum, authored `role: 'boundary' \| 'partition'` | Wall is the authored primitive and its spatial role is derived; levels and structures are first-class ([`architecture.md`](../../reference/architecture.md) §Ownership) |
| Plan/3D presentation | shared Stage, inspection/selection and Layout-owned Plan representation shipped in T1.P01 | extend the runtime-safe representation over canonical compiled geometry through F.3 channels |
| Layout authoring | native plinth, Wall/Opening precision and existing straight-Wall length/angle/move shipped; shared F4 Undo/Redo and conditional Save | bounded native Wall creation and its role/schema cutover, followed by later architectural capabilities |
| Compiler | one canonical compiler in `@portfolio/layout-core` | unchanged ownership; representation consumes its output and never reconstructs topology |

The [closed P01 outcome](./t1.p01-stage-foundation/README.md#outcome-and-deliberate-boundary) and
[F2 persistence contract](../../reference/components/persistence.md#one-source-format-f2-clean-epoch)
describe this landed tree; production epoch activation remains a separate owner-controlled step.
Future schema/authoring changes remain proposals until their explicit cutover.

## Proposed continuation

The [convergence batch and next planning wave](../cross-track-execution.md#convergence-batch-and-next-planning-wave)
and [main convergence plan](../product-convergence-2026-10-21.md#proposed-next-engineering-batch)
propose H0 shared F4 scope enforcement, build-boundary repairs and the on-demand performance/bundle
baseline, then C1 native Walls alongside C2 own-model import and the held T3 Capture/Preview scope.
T1 can plan C1 while H0 is planned: C1 keeps one datum, captures non-reusing IDs, resolves the Wall-role
cutover and carries its compile/drag/commit/Undo performance proof. It is registered as
[T1.P02 — Native Wall creation](./t1.p02-native-wall-creation/README.md) (batch E,
[record](../../reference/decisions/batch-e-authorization-2026-10-22.md)): the owner accepted its drawing policy, authorized `T1.P02.S01` and released it from
the hold, starting only after `T3.P03.S01` merges; S02–S04 stay `proposed`.

After that first wave, T1 supplies C3's rename/delete shell integration, the face-frame query for
T2's solve-once wall placement, and Stage part-selection/admission UI consuming T2's component
table, resolver and admission operations. T3 annotations follow those admitted parts. The vertical foundation cutover follows C1; a qualified overhead family follows that
cutover and its tolerance/kernel evidence. These are proposed dependencies, not new F gates.
Feature-specific shell integration develops in its consuming slice through planning, draft, review,
build and revision under PLATE's ratified shared invariants; a complete design for every feature is
not a prerequisite to first-wave planning. All implementation not released by batch E remains under
the [owner hold](../README.md#production-implementation-hold).

## Evidence roles

- [`planning-evidence.md`](./planning-evidence.md) — obligations and open decisions carried
  forward from the retired P26 material. It is evidence for planning, not a plan or an
  authorization.
- [`prototypes/spatial-authoring/`](../../../prototypes/spatial-authoring/) (World) and the
  Paper family — runnable interaction references and QA; their geometry and parameterizations
  are not requirements.
- PLATE and the spatial instrument grammar — the ratified shell/visual-system and
  representation-grammar destination for their own domains.
- Kernel suites in the fast/heavy lanes ([`tests/README.md`](../../../apps/editor/tests/README.md))
  — the correctness proof a T1 slice must keep green.

## Phase register

One row per registered phase. The phase README owns its objectives, children and order; this
register owns lifecycle only.

| Phase | Status | Depends on | Workspace |
| --- | --- | --- | --- |
| T1.P01 | shipped | — | [T1.P01 — Stage and authoring foundation](./t1.p01-stage-foundation/README.md) |
| T1.P02 | approved | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | [T1.P02 — Native Wall creation](./t1.p02-native-wall-creation/README.md) |

The `Depends on` column stays empty for T1.P01: the phase's first slice, `T1.P01.S01`, is itself
the sole provider of `F1.reference@1` and `F3.channels@1`, so listing either as a phase dependency
would be a self-dependency the phase cannot satisfy before it starts. The owner-ratified F1/F3
contracts remain this phase's design basis, consumed as ratified shapes rather than as an accepted
prerequisite gate.

T1.P01 is closed, and **T1.P01.S01 is accepted and shipped** (owner-authorized 2026-10-15,
[record](../../reference/decisions/f-ratification-2026-10-15.md); independently accepted at
`ee463d0b`). S01 supplied the shared `F1.reference@1` and `F3.channels@1` providers — its accepted
outputs `F1.reference@1:references-v1` and `F3.channels@1:inspection-v1` — and the
capability-readiness enforcement. **T1.P01.S02 and T1.P01.S03 are owner-authorized 2026-10-16**
([record](../../reference/decisions/parallel-slice-authorization-2026-10-16.md)) to run in parallel
with `T2.P01.S01` and `T3.P01.S01`; both shipped, S02 by owner-override. **T1.P01.S07** (the
Stage↔F4 bridge, owner-authorized 2026-10-17) shipped in PR #137 and recorded
`T1.viewport-projection@1:viewport-projection-v1` accepted. **T1.P01.S04** was owner-authorized
2026-10-17 as batch B with `T2.P01.S03` ([record](../../reference/decisions/batch-b-authorization-2026-10-17.md)), with the Head Save integration in
scope, and shipped 2026-10-18 (PR #148). **T1.P01.S05** is owner-authorized 2026-10-19 as batch C ([record](../../reference/decisions/batch-c-authorization-2026-10-19.md)); **S06** was owner-authorized as batch D and accepted and shipped 2026-10-21 under a scoped owner-override (PR #168). No authorization extends to another phase, slice or track.

## Starting foundation

**Retained modules and gates this track builds on**

- `@portfolio/layout-core` — canonical compiler, topology/noding/faces, Junction
  resolution/identity, curve algebra, Room reconciliation and the snap/align/duplicate/
  room-move/dissolve planners. Retained as foundation; refactored at T1's own semantic cutovers.
- [`apps/editor/src/lib/layout/wall-mesh-builder.ts`](../../../apps/editor/src/lib/layout/wall-mesh-builder.ts)
  and [`apps/editor/src/lib/render/wall-geometry-adapter.ts`](../../../apps/editor/src/lib/render/wall-geometry-adapter.ts)
  — junction-aware mesh built from compiled geometry, adapter-owned buffers/materials/lifetime.
- `apps/editor/src/lib/authoring/layout/` — hit resolution against compiled query records with a
  locked priority, and exact-value parsing/validation, consumed by the landed T1 Stage/precision
  adapters.
- `apps/editor/src/lib/authoring/a11y/` — the keyboard roving-focus primitive; the later owner is
  the T1 shell for further accessibility depth.
- Architecture gates already enforcing this track's boundaries:
  `tests/lib/layout/layout-geometry-boundary.test.ts`,
  `tests/lib/museum/layout/wall-mesh-shell-boundary.test.ts`,
  `tests/lib/museum/camera-core-boundary.test.ts`, `tests/lib/project-model-boundary.test.ts`
  ([`test-lanes.ts`](../../../apps/editor/test-lanes.ts)).

**Deferred-retirement rows with exact conditions** (implementation-plan §5.1)

- `layout-core` **legacy floors/rooms types, `layout-codec`, `layout-room-frame` and the legacy
  `compileLayoutGeometry` adapter** — *retire at T1's first Layout schema cutover*. Concrete
  dependency: `layout-types.ts` and `layout-codec.ts` host definitions consumed by 37 and 9
  wall-first modules, so separating them **is** the authored-schema redesign T1 owns (Wall roles
  and levels). Precondition: after PR #115 they are reachable only from wall-first internals and
  tests, never from a project/API/runtime reader. **Condition (2026-10-22): the first cutover
  (format 6) landed without the separation, so it is deferred to its own authorized slice, which
  must land before T1.P02.S02 starts** — the measured blockers and the remaining work are the
  [stop-and-report](./t1.p02-native-wall-creation/t1.p02.s01-layout-identity-and-format-cutover/acceptance.md).
- `layout-core` legacy generation (`layout-compat`, `layout-migration`, `layout-migration-math`)
  was removed by PR #115 with no successor detector; nothing here re-introduces one.

**Capability rebuild and remaining boundary** (implementation-plan §4.4)

T1.P01 restored the shell, shared Plan/3D Stage, viewport, bounded Layout editing and native plinth.
General native Wall creation and the derived-role/schema cutover remain the next proposed boundary;
levels, structures and overhead forms remain later work.

**Successor obligations carried into T1** (implementation-plan §7.2)

- editor/visitor mesh parity — preserve the shared Stage renderer's parity, honouring the
  rule that no editor helper enters `MuseumScene` or visitor imports;
- **M1** Layout semantic mutation call-site proof — retain the proof for the landed Layout
  adapters and shared F4 acceptance path, alongside core planner tests;
- **M5** project-replacement / Navigator guard — preserve the landed host's unsaved-work and
  session-lifetime guards when adding new replacement paths;
- the Plan-representation invariant — the retained grammar must not own a second camera/world
  transform;
- **TD-2** non-recurrence — the PLATE number field must not reproduce the numeric-field
  `:invalid` defect;
- **TD-5**'s lesson — do not deep-proxy compiled geometry; measure against the input the editor
  actually hands in.

T1.P01 also routes the [coordinated T1–T4 allocation/readiness/DAG](../cross-track-execution.md); its F amendments and readiness rule are owner-ratified 2026-10-15, while the allocation itself registers no gate, phase or slice.
