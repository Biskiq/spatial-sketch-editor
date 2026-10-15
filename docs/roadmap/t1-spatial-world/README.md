# T1 — Spatial world

**Track:** T1 · **Status:** planning — evidence recorded, **no implementation authorized**
([track register](../README.md#track-register)) · **Runbook:**
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

| Concern | Current (post-#115 foundation) | Destination |
| --- | --- | --- |
| Layout document | wall-first `formatVersion: 5`, one floor datum, authored `role: 'boundary' \| 'partition'` | Wall is the authored primitive and its spatial role is derived; levels and structures are first-class ([`architecture.md`](../../reference/architecture.md) §Ownership) |
| Plan/3D presentation | **removed** with the editor shell; the Plan grammar returns as a T1 capability | Layout-owned, runtime-safe representation over canonical compiled geometry, parameterized by F.3 channels |
| Compiler | one canonical compiler in `@portfolio/layout-core` | unchanged ownership; representation consumes its output and never reconstructs topology |

Landed contracts keep describing current behaviour until their explicit cutover; nothing in the
destination column is shipped.

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

No T1 phase is registered. A phase is added here by an authorized plan, with its own README
under `./t1.p01-<capability>/` and its own slice register.

**Owner-review proposal:** [T1.P01 — Stage and authoring foundation](./t1.p01-stage-foundation/README.md)
recommends the first bounded phase, its early viewport provider and its unopened cycle window.
It is track-local planning, not a registered phase, a ratified F amendment or implementation
authorization. The register below stays unchanged pending the owner's decision.

| Phase | Status | Depends on | Workspace |
| --- | --- | --- | --- |
| — | — | — | — |

## Starting foundation

**Retained modules and gates this track builds on**

- `@portfolio/layout-core` — canonical compiler, topology/noding/faces, Junction
  resolution/identity, curve algebra, Room reconciliation and the snap/align/duplicate/
  room-move/dissolve planners. Retained as foundation; refactored at T1's own semantic cutovers.
- [`apps/editor/src/lib/layout/wall-mesh-builder.ts`](../../../apps/editor/src/lib/layout/wall-mesh-builder.ts)
  and [`apps/editor/src/lib/render/wall-geometry-adapter.ts`](../../../apps/editor/src/lib/render/wall-geometry-adapter.ts)
  — junction-aware mesh built from compiled geometry, adapter-owned buffers/materials/lifetime.
- `apps/editor/src/lib/authoring/layout/` — hit resolution against compiled query records with a
  locked priority, and exact-value parsing/validation; the later owner is the T1
  viewport/precision slice.
- `apps/editor/src/lib/authoring/a11y/` — the keyboard roving-focus primitive; the later owner is
  the T1 shell.
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
  tests, never from a project/API/runtime reader.
- `layout-core` legacy generation (`layout-compat`, `layout-migration`, `layout-migration-math`)
  was removed by PR #115 with no successor detector; nothing here re-introduces one.

**Capability losses this track owns rebuilding** (implementation-plan §4.4)

Plan and 3D viewing/authoring of a project: the shell, Stage, viewport, Layout authoring,
placement of architectural reality, and the removal notice at `/project/:id/spatial` standing in
for it today. Each is a T1 capability, not a regression.

**Successor obligations carried into T1** (implementation-plan §7.2)

- editor/visitor mesh parity — re-established at the first editor Stage renderer, honouring the
  rule that no editor helper enters `MuseumScene` or visitor imports;
- **M1** Layout semantic mutation call-site proof — the editor mutation runner and its call-site
  test were removed; core planner tests remain. Re-armed by the first T1 slice that introduces
  Layout mutation wiring, which supplies the call-site proof;
- **M5** project-replacement / Navigator guard — dormant likewise, re-armed by the first T1 or T3
  slice introducing project/session replacement;
- the Plan-representation invariant — the retained grammar must not own a second camera/world
  transform;
- **TD-2** non-recurrence — the PLATE number field must not reproduce the numeric-field
  `:invalid` defect;
- **TD-5**'s lesson — do not deep-proxy compiled geometry; measure against the input the editor
  actually hands in.

The phase proposal also routes the [coordinated T1–T4 allocation/readiness/DAG](./t1.p01-stage-foundation/cross-track-reconciliation.md), pending ratification.
