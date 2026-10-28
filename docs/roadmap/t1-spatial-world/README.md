# T1 — Spatial world

**Track:** T1 · **Status:** approved — T1.P01 closed 2026-10-21 after S06; `T1.P02` (native Wall
creation) registered 2026-10-22 as batch E; S01 shipped by scoped owner-override,
S05 legacy retirement owner-released 2026-10-23 ([record](../../reference/decisions/post-batch-e-authorization-2026-10-23.md)) and shipped; S06 performance foundation owner-released 2026-10-24 ahead of drawing ([record](../../reference/decisions/performance-foundation-authorization-2026-10-24.md)), accepted AC-qualified 2026-10-27 and merged as `6af62eb4` (PR #190); S02 drawing was released 2026-10-27 ([record](../../reference/decisions/next-wave-authorization-2026-10-27.md)), accepted as `owner-override` and shipped on PR #201; S03 Opening was released 2026-10-27 ([record](../../reference/decisions/t1-p02-s03-authorization-2026-10-27.md)) and shipped on PR #209; under the [2026-10-28 performance-mandate suspension](../../reference/decisions/performance-mandate-suspension-2026-10-28.md), their unmeasured performance rows are historical evidence, not passes or S04 prerequisites; S04 integrated final gate was released 2026-10-28 ([record](../../reference/decisions/t1-p02-s04-authorization-2026-10-28.md)), accepted/shipped by the owner at `46a31c81`, and P1-merged in `eb0931d6`; T1.P02 closed 2026-10-28 by owner ruling; `T1.P01.S01` shipped (shared F1/F3
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
| Layout document | F2 Layout unit, wall-first `formatVersion: 6`, one floor datum, Wall role derived by the canonical compiler | Wall is the authored primitive and its spatial role is derived; levels and structures are first-class ([`architecture.md`](../../reference/architecture.md) §Ownership) |
| Plan/3D presentation | shared Stage, inspection/selection and Layout-owned Plan representation shipped in T1.P01 | extend the runtime-safe representation over canonical compiled geometry through F.3 channels |
| Layout authoring | native plinth, Wall/Opening precision and existing straight-Wall length/angle/move shipped; shared F4 Undo/Redo and conditional Save | bounded native Wall creation after legacy vocabulary retirement, followed by later architectural capabilities |
| Compiler | one canonical compiler in `@portfolio/layout-core` | unchanged ownership; representation consumes its output and never reconstructs topology |

The [closed P01 outcome](./t1.p01-stage-foundation/README.md#outcome-and-deliberate-boundary) and
[F2 persistence contract](../../reference/components/persistence.md#one-source-format-f2-clean-epoch)
describe this landed tree; production epoch activation remains a separate owner-controlled step.
Future schema/authoring changes remain proposals until their explicit cutover.

## Planning continuation

Current sequencing is the [next parallel batch](../cross-track-execution.md#next-parallel-batch).
Historically, the [convergence batch and next planning wave](../../archive/roadmap/coordination-2026-10/cross-track-execution-2026-10-23.md#convergence-batch-and-next-planning-wave)
and [main convergence plan](../../archive/roadmap/coordination-2026-10/product-convergence-2026-10-21.md#proposed-next-engineering-batch)
propose H0 shared F4 scope enforcement, build-boundary repairs and the on-demand performance/bundle
baseline, then C1 native Walls alongside C2 own-model import and the held T3 Capture/Preview scope.
T1 can plan C1 while H0 is planned: C1 keeps one datum, captures non-reusing IDs, builds on the shipped Wall-role
cutover and carries its compile/drag/commit/Undo performance proof. It is registered as
[T1.P02 — Native Wall creation](./t1.p02-native-wall-creation/README.md) (batch E,
[record](../../reference/decisions/batch-e-authorization-2026-10-22.md)): the owner accepted its drawing policy, authorized `T1.P02.S01` and released it from
the hold, starting only after `T3.P03.S01` merges. On 2026-10-23 the owner released S05 legacy retirement
([record](../../reference/decisions/post-batch-e-authorization-2026-10-23.md)); it shipped by PR #183. On 2026-10-24 the owner
registered and released S06 performance foundation ahead of drawing
([record](../../reference/decisions/performance-foundation-authorization-2026-10-24.md)) under a temporary
performance-first halt; it took C1's compile/admission deduplication and optimization experiment, was
accepted AC-qualified on 2026-10-27 and merged as `6af62eb4` (PR #190), which satisfies that halt and
blocks no inheritor. S02 was released on 2026-10-27
([record](../../reference/decisions/next-wave-authorization-2026-10-27.md)) after its plan review,
including the T3 Head/F4 and T2/T3 contribution reviews, then accepted as `owner-override` and
shipped on PR #201; its formal performance family is unmeasured historical evidence, not an S04
prerequisite after the [2026-10-28 suspension](../../reference/decisions/performance-mandate-suspension-2026-10-28.md).
S03 was released on 2026-10-27 ([record](../../reference/decisions/t1-p02-s03-authorization-2026-10-27.md))
after that acceptance and shipped on PR #209. S04 was released on 2026-10-28
([record](../../reference/decisions/t1-p02-s04-authorization-2026-10-28.md)) as the phase's
integrated final gate, accepted/shipped by the owner at `46a31c81`, and P1-merged in `eb0931d6`.
T1.P02 closed 2026-10-28 by owner ruling; T1 is not complete.

After that first wave, T1 supplies C3's rename/delete shell integration, the face-frame query for
T2's solve-once wall placement, and Stage part-selection/admission UI consuming T2's component
table, resolver and admission operations. T3 annotations follow those admitted parts. The vertical foundation cutover follows C1; a qualified overhead family follows that
cutover and its tolerance/kernel evidence. Before registering those continuations:

- **Face-frame provider:** register a bounded T1 provider plan only when T2's solve-once wall
  placement consumer names its required host/face identity, query and invalidation contract.
  The query must consume canonical compiled geometry, settle coordinate/orientation and
  refusal behavior with T2, and prove Plan/3D and transform parity; no consumer reconstructs
  architecture or infers a stable face from renderer triangles.
- **Vertical foundation:** after C1 acceptance, plan the explicit levels/datum/height and
  structure-local frame cutover with its affected Layout/Scene/Camera/F2 owners, fixture
  conversion and topology/tolerance/Room reconciliation proof. One current datum must not
  be advertised as vertical support; schema/format decisions need their own reviewed plan.
- **Coordinate qualification:** before expanding construction extent, nonzero elevations,
  nested structure transforms or face-relative placement, record supported units, ranges,
  precision/tolerance and forward/inverse frame conformance at the real consumer seam.
  Preserve project/world placement and one Camera; an unsupported range/frame needs a
  refusal and owner scope decision, not an accidental second coordinate authority.
- **Overhead admission:** register only after vertical and tolerance/kernel qualification;
  name the supported family, canonical representation, host and identity semantics and
  consuming authoring proof. Prototype roof shortcuts do not qualify a production family.

These are planning triggers and proposed dependencies, not new phases, accepted providers,
released scopes or F gates.
Feature-specific shell integration develops in its consuming slice through planning, draft, review,
build and revision under PLATE's ratified shared invariants; a complete design for every feature is
not a prerequisite to first-wave planning. All implementation not released by batch E remains under
the [owner hold](../README.md#production-implementation-hold).

## Evidence roles

- [`planning-evidence.md`](./planning-evidence.md) — obligations and open decisions carried
  forward from the retired P26 material. It is evidence for planning, not a plan or an
  authorization.
- [`broad-research/README.md`](./broad-research/README.md) — router for track-level
  computational architecture investigations.
- [`broad-research/spatial-computation-architecture.md`](./broad-research/spatial-computation-architecture.md) —
  Fundamental Computational Architecture Challenge: comprehensive computer science analysis across
  persistent data structures, incremental and self-adjusting computation, database IVM, planar
  subdivisions, dynamic BVH, canonical content hashing, and owner decision proposals (OP-1, OP-2, OP-3).
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
| T1.P02 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | [T1.P02 — Native Wall creation](./t1.p02-native-wall-creation/README.md) |

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
  `compileLayoutGeometry` adapter** — *discharged by
  [T1.P02.S05](./t1.p02-native-wall-creation/t1.p02.s05-legacy-layout-retirement/acceptance.md)*
  (PR #183; accepted 2026-10-23 as `owner-override`). The format-6 wall-first reader is the only
  Layout reader; the S01 [stop-and-report recovery](./t1.p02-native-wall-creation/t1.p02.s01-layout-identity-and-format-cutover/acceptance.md#recovery)
  keeps the measured blockers.
- `layout-core` legacy generation (`layout-compat`, `layout-migration`, `layout-migration-math`)
  was removed by PR #115 with no successor detector; nothing here re-introduces one.
- Room-level wall mesh path (`buildRoomWallMesh` + `VisitorLayoutShell` Room branch +
  `CompiledRoom.walls` from the shared compile core) — unreachable from format-6 output since
  T1.P02.S05; *retire when the visitor/editor Stage renderer parity work replaces the Room-level
  mesh tests with physical-Wall (`buildStandaloneWallMesh`) watertight coverage*; until then its
  heavy-lane tests are the only consumer.
- Camera authoring room-ownership branches (`isWorldPointInsideRoomXZ`, active-room branches in
  `createScenePathAnchorAtWorldPoint` / `createSceneCameraViewKeyframeAtWorldTarget`) —
  constant-false since T1.P02.S05 because the current-format Layout Room registry is empty;
  *retire with the Camera codec cutover that removes room-owned Camera coordinates, under T3
  review*.

**Capability rebuild and remaining boundary** (implementation-plan §4.4)

T1.P01 restored the shell, shared Plan/3D Stage, viewport, bounded Layout editing and native plinth.
The format-6 derived-role/schema cutover shipped in S01. Legacy retirement, then general native
Wall creation, remain the next proposed boundary;
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
