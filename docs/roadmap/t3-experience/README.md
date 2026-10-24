# T3 — Experience

**Track:** T3 · **Status:** approved — `T3.P01` registered 2026-10-16 and **closed 2026-10-20**, with
all six children shipped (`T3.P01.S01` 2026-10-16 (PR #131), `S02` 2026-10-16 (PR #133), `S03`
through its split halves `S05` (PR #140) and `S06` (PR #141), and the final gate `S04` 2026-10-20
(PR #158, `9a457f6b`)); `T3.P02` registered 2026-10-20 and **closed 2026-10-24** (final gate
`T3.P02.S02`), `T3.P03` (H0) registered 2026-10-22 as batch E and **closed 2026-10-24** (final gate
`T3.P03.S02`), and `T3.P04` registered as planning-only post-Batch-E coordination and
**authorized and released as `T3.P04.S01` on 2026-10-24** ([phase register](#phase-register)) · **Runbook:**
[`../../operations/t3-experience/README.md`](../../operations/t3-experience/README.md)
**Evidence:** [`planning-evidence.md`](./planning-evidence.md) · **Gates owned:**
`T3.camera-experience-cutover` ([gate register](../README.md#gate-register)) ·
**Contracts:** [`camera-tour.md`](../../reference/components/camera-tour.md),
[`composition-execution.md`](../../reference/composition-execution.md) (F.1–F.4),
[`architecture.md`](../../reference/architecture.md), [PLATE](../../reference/design-system/editor-shell-and-visual-system.md)

## Bounded objectives

Experience: what a visitor is taken through, and how authoring expresses it. Completion evidence
for any phase in this track is a recorded acceptance against the phase's declared final gate,
with the one-Camera-authority, visitor-isolation and current-format invariants still proven.

- Experience composition over domain-qualified subjects: Presentations, Experience-wide
  Interactions, Guides and Stops, with Destination as a **role**, never a second authored entity;
- the **Camera ↔ Experience cutover**: Camera keeps views, connectivity, routes, framing,
  projection and evaluation; Experience takes editorial occurrences, order, holds, continuation,
  Gates and interaction policy — in **one** migration, not two;
- Camera and Experience authoring surfaces rebuilt on the retained pure Camera math;
- preview that shares visitor semantics, and the acceptance/history result (F.4) that makes a
  compound change atomic, undoable and stale-writer-safe;
- the visitor navigation, DOM companion and accessibility contract (the a11y/motion requirements
  in the planning evidence).

## Concern ownership and exclusions

- **Owns:** visitor-facing composition, editorial occurrences and order, Camera authoring,
  preview, the authoring history/acceptance result, and the a11y/motion contract for its surfaces.
- **Does not own:** Camera route/motion evaluation itself (retained under `@portfolio/camera-core`),
  Layout/Scene domain ownership (T1/T2), release packaging and the prepared reader (T4). The
  Experience unit's envelope is F.2 territory; T3 is its first consumer.
- **Ordering:** the landed order cutover precedes any T1 migration of Camera authoring onto the
  ownership contract; retired Camera node-order fields have no live writer or read fallback.
  Exact `Gate@Version` prerequisites govern eligibility.

## Current vs destination contracts

| Concern | Current (landed tree) | Destination |
| --- | --- | --- |
| Camera data | F2 Camera 1 owns Views/connections; `@portfolio/camera-core` evaluates | new authoring surfaces consume that same authority and codec boundary |
| Editorial order | Experience-owned Presentations, Stops and Guides; retired Camera node-order fields are rejected | richer authored composition preserves Experience ownership and one Camera evaluation authority |
| Experience document | F2 Experience 1 is collection-capable over the shared world; resources 2 and dependency locks are separate | extend explicit versioned formats for later annotation, interaction and invocation capabilities |
| History / acceptance | shared F4 unit acceptance: expected revision, atomic accepted/undo results, one bounded chronological history and conditional unit Save | new consuming scopes preserve these invariants and add explicit domain admission |
| Capture / Preview | first capture and isolated Preview shipped as `owner-override` in T3.P02.S01; first Guide creation, explicit Camera handover/return and the integrated final gate shipped as `owner-override` in T3.P02.S02 (2026-10-24); T3.P02 closed 2026-10-24 | T3.P02.S02 completes the creator loop through shared lowering/evaluation; Preview never writes source |

The [Camera contract](../../reference/components/camera-tour.md#current-vs-destination-ratified-2026-09-27-reconciled-2026-09-29)
and [F2 persistence contract](../../reference/components/persistence.md#one-source-format-f2-clean-epoch)
describe this landed tree; production epoch activation remains a separate owner-controlled step.
No old-source converter, dual writer or Camera-order authority remains.

## Planning continuation

Batch E's H0 correction and first capture shipped. The phase's final gate,
[T3.P02.S02](./t3.p02-capture-and-cut-preview/t3.p02.s02-integrated-final-gate/implementation-plan.md),
added first Guide creation, resolved the Preview Camera output/return-ticket residual against the
existing phase laws, and proved the complete creator loop, accessibility/isolation and performance
on the integrated tree; it was accepted 2026-10-24
([record](../../reference/decisions/post-batch-e-authorization-2026-10-23.md)). Both `T3.P02` and
`T3.P03` are **closed 2026-10-24**; their gate artifacts are preserved stubs and their deferred
items keep the owners named in each phase README
([closure decision](../../reference/decisions/t3-phase-close-and-p04-authorization-2026-10-24.md)).

[C3 / T3.P04](./t3.p04-project-lifecycle/README.md) is **authorized and released** as its single
child `T3.P04.S01`: project rename/delete, guarded replacement and project-owned model cleanup.
T3 owns persistence/API/client; T1 owns its explicit reviewed shell patch. It consumes post-S01 T2
storage interfaces, is strictly unrelated to the performance-first halt, and starts after its
coordination PR merges on `main`. Its planning review, the owner's directions on the project-name
authority and published-project deletion, and its corrected cleanup mechanism are in the
[resolution](./t3.p04-project-lifecycle/t3.p04.s01-project-rename-and-delete/planning-resolution-2026-10-24.md);
the release authorizes implementation and no other scope.

New consuming UI follows Round 2's shared dock, Capture/Guide, contextual Guide Instrument
and Card writer contract through current host APIs; a bounded integration patch is not a
new global shell. Part annotations still follow T2 component resolver/admission and T1
Stage part selection. Advanced interaction and attached composition remain deferred.
All additional implementation is subject to the [owner hold](../README.md#production-implementation-hold).

## Evidence roles

- [`planning-evidence.md`](./planning-evidence.md) — obligations from the retired P25 material,
  including the a11y contract, the repeated-occurrence findings and the F.4 successor criteria.
  Evidence, not authorization.
- [`camera-tour.md`](../../reference/components/camera-tour.md) — the current Camera/tour/motion
  contract.
- The archived P25 compact and the Experience prototypes — interaction references for a pre-#115
  model; not current truth.

## Phase register

One row per registered phase. The phase README owns its objectives, children and order; this
register owns lifecycle only.

| Phase | Status | Depends on | Workspace |
| --- | --- | --- | --- |
| T3.P01 | shipped | F1.reference@1, F3.channels@1, F4.intent-acceptance@1 | [T3.P01 — Camera/Experience cutover foundation](./t3.p01-camera-experience-foundation/README.md) |
| T3.P02 | shipped | F1.reference@1, F2.unit-envelope@1, F3.channels@1, F4.intent-acceptance@1, T1.viewport-projection@1, T3.camera-experience-cutover@1 | [T3.P02 — First Capture and Cut Preview](./t3.p02-capture-and-cut-preview/README.md) |
| T3.P03 | shipped | F2.unit-envelope@1, F4.intent-acceptance@1 | [T3.P03 — Shared acceptance, isolation and measurement](./t3.p03-shared-acceptance-and-measurement/README.md) |
| T3.P04 | approved | F2.unit-envelope@1, F4.intent-acceptance@1 | [T3.P04 — Project lifecycle](./t3.p04-project-lifecycle/README.md) |

T3.P01 is registered by the owner decision of 2026-10-16
([record](../../reference/decisions/parallel-slice-authorization-2026-10-16.md)) as the
source/runtime cutover phase (S01–S06, final gate S04), with its
[F amendment drafts](./t3.p01-camera-experience-foundation/f-amendment-proposals.md) as planning
evidence. **`T3.P01.S01`** shipped 2026-10-16 (PR #131) and **`T3.P01.S02`** shipped 2026-10-16 (PR
#133). **`T3.P01.S03`** shipped 2026-10-17 through its registered split, **`T3.P01.S05`** (PR #140)
and **`T3.P01.S06`** (PR #141), which accepted `unit-acceptance-v1`, `conditional-save-units-v1` and
`camera-handoff-v1`. The final gate **`T3.P01.S04`** was owner-authorized on 2026-10-19
([record](../../reference/decisions/t3-cutover-ratification-2026-10-19.md)), after AM-9 replaced AM-7
with a clean source epoch; its accepted result is the second delivery of this track's Camera →
Experience split, and `T3.camera-experience-cutover@1` is `accepted` in the gate register at
`06a8aac8`. The phase closed 2026-10-20 (its PHASE CLOSE block); **the track is not complete**, and
the owner-run production activation of the new source epoch is a separate operational step that has
not been executed.
`Depends on` lists the
external gates its slices consume; `F2.unit-envelope@1` is provided inside the phase by S01.

**`T3.P02` is registered 2026-10-20** (owner-authorized as batch D,
[record](../../reference/decisions/batch-d-authorization-2026-10-20.md), D3) once its registration
precondition — an accepted `T3.camera-experience-cutover@1` — was met by `T3.P01.S04`. Its
`T3.P02.S01` (first capture and Cut Preview) was authorized for implementation, then held by the
2026-10-22 [production hold](../README.md#production-implementation-hold). Batch E
([record](../../reference/decisions/batch-e-authorization-2026-10-22.md), E5/E7) accepted its finalized convergence scope and released it, starting only
after `T3.P03.S01` merges. `T3.P02.S02`, the phase's final gate, was owner-authorized and released 2026-10-23
([record](../../reference/decisions/post-batch-e-authorization-2026-10-23.md)), starting per the release list (`docs/roadmap/now.md`); `T3.P02.S01` is shipped. `Depends on` lists the external gates its slices consume; `F2.unit-envelope@1`,
`F3.channels@1` and the F4 unit scopes come from `T3.P01`'s accepted outputs, and
`T3.camera-experience-cutover@1` from `T3.P01.S04`. Both children shipped and the phase
**closed 2026-10-24** (its `PHASE CLOSE` block and the
[closure decision](../../reference/decisions/t3-phase-close-and-p04-authorization-2026-10-24.md));
its Scope A performance rows stay transferred to `T1.P02.S06` and its Scope B rows stay deferred
with T3.

**`T3.P03` is registered 2026-10-22** (batch E, [record](../../reference/decisions/batch-e-authorization-2026-10-22.md), E1/E2) as the H0 shared correction:
per-planner scope enforcement and build isolation (`T3.P03.S01`) and the on-demand measurement
workflow as its final gate (`T3.P03.S02`). Both are authorized, and T3.P03 is released from the hold.
`T3.P03.S01` merges first; its merge is the start gate for `T1.P02.S01`, `T2.P02.S01` and
`T3.P02.S01`. No slice provides a gate. Both children shipped and the phase **closed 2026-10-24**
(its `PHASE CLOSE` block and the
[closure decision](../../reference/decisions/t3-phase-close-and-p04-authorization-2026-10-24.md));
the L/XL fixtures and M/L drag rows stay transferred to `T1.P02.S06`, and the trace-method
disposition, reference hard rows and calibration stay open with the owner.

**`T3.P04.S01` is authorized and released 2026-10-24** ([decision](../../reference/decisions/t3-phase-close-and-p04-authorization-2026-10-24.md))
after the planning phase registered on 2026-10-22. The phase row becomes `approved` and the child
`approved`; implementation starts once the coordination PR merges on `main`. The release is
strictly unrelated to the [performance-first halt](../README.md#production-implementation-hold), so
its bounded T1 shell patch is serialized against `T1.P02.S06`'s claim under the existing rules.
`T3.P04.S01` provides no gate.

## Starting foundation

**Retained modules and gates this track builds on**

- `@portfolio/camera-core` — `camera-route.ts` + `camera-motion.ts`: connectivity, routes,
  framing, projection and evaluation. One authority; the mechanism is replaceable and "one
  motion" is not one motion kind.
- `apps/editor/src/lib/authoring/camera/` — the four §4.3-criteria pure Camera modules (framing
  envelopes, interior-anchor path editing, directed-edge timing and connectivity, route clone).
  T3 decides their later home; editorial-order parts are explicitly not among them.
- [`apps/editor/src/lib/visitor/`](../../../apps/editor/src/lib/visitor/) — the cold visitor
  runtime made strict in WP3, the isolation suites and the public route.
- Architecture gates already enforcing this track's boundaries:
  `tests/lib/museum/camera-core-boundary.test.ts`,
  `tests/lib/visitor/visitor-cold-runtime.test.ts`,
  `tests/lib/visitor/visitor-identity-isolation.test.ts`,
  `tests/lib/visitor/preview-surface-boundary.test.ts`, plus the vite public/preview
  surface-boundary plugin tests.

**Retirement and successor status** (implementation-plan §5.1)

- **Scene/Camera editorial order fields and `camera-core` main-flow/node-order orchestration** —
  retired at T3.P01.S04's clean source cutover. The shared Experience interpreter owns editorial
  execution; old fields refuse rather than load through a migration/fallback path.
- **`apps/editor/src/lib/platform/project-persistence.ts` and its asset helpers** — retained as
  foundation, with conditional unit Save and expected-revision acceptance landed in T3.P01.
- **`apps/api`** — conditional Save and the F2 source fence landed in T3.P01; prepared release
  remains T4 work. Production activation is owner-controlled.

**Capability rebuild and remaining boundary** (implementation-plan §4.4)

T3.P01 landed the Camera/Experience source split, shared interpreter, unit acceptance/history and
conditional Save. Creator Camera/Experience authoring remains the T3.P02 boundary: isolated Preview
shipped in `T3.P02.S01`, and the final gate `T3.P02.S02` was released 2026-10-23
([record](../../reference/decisions/post-batch-e-authorization-2026-10-23.md)). Publication remains unavailable until T4's prepared reader; no old public reader
is a fallback.

**Successor obligations carried into T3** (implementation-plan §7.2)

- **the F.4 acceptance criteria** — one logical result, no-op writes nothing, rollback on failure,
  bounded history depth and atomic group/duplicate validation — preserve the landed unit
  acceptance/history proof as new consuming scopes are introduced;
- **stale-writer rejection** — the expected-revision precondition for local *and* cloud writers.
  Conditional Save compares create-only or expected-saved-base under a row lock and preserves a
  losing writer's local work;
- **M5** project-replacement / Navigator guard — preserve the shared host's landed unsaved-work
  and session-lifetime guards;
- the visitor/public isolation guarantees (AGENTS rule 4) stay green throughout.
