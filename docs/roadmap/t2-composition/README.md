# T2 — Composition

**Track:** T2 · **Status:** approved — T2.P01 registered 2026-10-16; `T2.P01.S01` shipped
2026-10-16; `T2.P01.S02` shipped 2026-10-17; S03 shipped 2026-10-18 (batch B); S04 unauthorized, proposed as batch C ([track register](../README.md#track-register)) · **Runbook:**
[`../../operations/t2-composition/README.md`](../../operations/t2-composition/README.md)
**Evidence:** [`planning-evidence.md`](./planning-evidence.md) ·
**Contracts:** [`scene-content.md`](../../reference/components/scene-content.md),
[`assets.md`](../../reference/components/assets.md),
[`composition-execution.md`](../../reference/composition-execution.md) (F.1–F.4),
[`architecture.md`](../../reference/architecture.md)

## Bounded objectives

Composition: what the world is made of and how it is placed, lit and supplied. Completion
evidence for any phase in this track is a recorded acceptance against the phase's declared final
gate, with Scene ownership, current-format validation and the visitor boundary still proven.

- **one semantic Scene placement with view-specific projection** — Plan and 3D are lenses over a
  single canonical `SceneEntity`, and Y is support-resolved rather than authored in Plan;
- materials and lights, including the semantic gaps (instance tint/reset, atomic
  selected-subset editing, truthful light units, explicit repair for out-of-range values);
- ingest, provenance and resource locking — truthful declarations, typed resources with exact
  revision identity and a project dependency lock;
- the user-facing single-model loop: import or build → place → direct → publish → receive
  feedback → revise → re-share.

## Concern ownership and exclusions

- **Owns:** Scene object composition, placed instances, materials, lights, world presentation,
  asset ingest and resource staging, and the placement/materials/lights/ingest half of capability
  rebuild.
- **Does not own:** Layout topology and architectural representation (T1); Camera/Experience
  authoring and the cross-domain acceptance cutover (T3, F.4); release packaging and delivery
  (T4). Layout is consulted for support and is never mutated by Scene placement; a mixed
  Layout/Scene transaction is not introduced.
- **Ordering:** the T2 authoring surface consumes the T1 viewport/projection seam rather than
  waiting for T1's representation slices. Exact `Gate@Version` prerequisites govern eligibility.

## Current vs destination contracts

| Concern | Current (post-#115 foundation) | Destination |
| --- | --- | --- |
| Scene document | world-local `formatVersion: 1`, no `roomId`, Scene-owned entities/materials/lights | unchanged ownership; the Scene unit is codec-bounded under F.2 |
| Placement | **removed** with the editor shell; the predecessor wiring was defective (TD-1) | one Scene-owned placement intent, Plan and 3D converging on the same commit, Y resolved from support |
| Materials / lights | catalogue and kernel validation retained; authoring surfaces removed | truthful units, atomic subset editing, explicit repair instead of silent clamping |
| Resources | P20 project-scoped texture registry + catalogue; no general resource system | typed resources with logical identity, revision/content identity and dependency locks |

Landed contracts keep describing current behaviour until their explicit cutover.

## Evidence roles

- [`planning-evidence.md`](./planning-evidence.md) — obligations, counter-cases and the TD-1
  acceptance tests carried forward from the retired P24 material. Evidence, not authorization;
  where it describes a removed editor system it records history or an obligation, never a reusable
  seam.
- [`scene-content.md`](../../reference/components/scene-content.md) — the current Scene contract,
  including the kernel-level validation/transform rules.
- `prototypes/` — interaction references only. Acquisition/approval is outside authoring history.

## Phase register

One row per registered phase. The phase README owns its objectives, children and order; this
register owns lifecycle only.

| Phase | Status | Depends on | Workspace |
| --- | --- | --- | --- |
| T2.P01 | approved | F1.reference@1, F4.intent-acceptance@1, T1.viewport-projection@1 | [T2.P01 — Supported object composition](./t2.p01-supported-composition/README.md) |

T2.P01 is registered by the owner decision of 2026-10-16
([record](../../reference/decisions/parallel-slice-authorization-2026-10-16.md)), with its
[interface/reconciliation drafts](./t2.p01-supported-composition/contracts.md). Only
**`T2.P01.S01`** shipped 2026-10-16; it consumed the accepted
`F1.reference@1` alone. **`T2.P01.S02`** shipped 2026-10-17, consuming `F1.reference@1` and
`F4.intent-acceptance@1`; its authorization is the owner decision of 2026-10-16
([record](../../reference/decisions/s02-pair-authorization-2026-10-16.md)).
`Depends on` lists the external gates the phase's later slices consume. **`T2.P01.S03`** was
owner-authorized 2026-10-17 as batch B with `T1.P01.S04` ([record](../../reference/decisions/batch-b-authorization-2026-10-17.md)), after
`T1.viewport-projection@1` was accepted through `T1.P01.S07`, and shipped 2026-10-18 (PR #147). S04
stays `proposed`. Its T1 Head Save prerequisite shipped through `T1.P01.S04` (PR #148), and its
authorization is proposed as batch C ([prepared record](../../reference/decisions/batch-c-authorization-2026-10-19.md)).

## Starting foundation

**Retained modules and gates this track builds on**

- `@portfolio/project-model` — Scene types, codec and world-local validation, world transforms,
  and the strict current-format project readers/writers.
- [`apps/editor/src/lib/content/`](../../../apps/editor/src/lib/content/) — catalogue, materials,
  Scene document helpers and validation; [`apps/editor/src/lib/types/`](../../../apps/editor/src/lib/types/)
  for the authored type surface.
- [`apps/editor/src/lib/museum/`](../../../apps/editor/src/lib/museum/) — the generic renderer
  (assets, entities, material and texture-cache machinery) and `wall-material-factory`.
- `apps/editor/src/lib/authoring/scene/` — placement-local bounds, footprint derivation and hit
  resolution (shell-free); whether any of it moves into the shared packages is a T2 decision with
  a successor proof.
- Architecture gates already enforcing this track's boundaries:
  `tests/lib/project-model-boundary.test.ts`, `tests/lib/museum/layout/wall-mesh-shell-boundary.test.ts`,
  `tests/lib/museum/camera-core-boundary.test.ts`.

**Deferred-retirement rows with exact conditions** (implementation-plan §5.1)

- `project-model` **Scene types/codec/validation (world-local) and world transforms** — retained as
  foundation; **refactor later at T2** (the Scene unit) and **T3** (Camera extraction).
- The P22 authored-snapshot reader is **retired at T4**, not here; T2 must keep producing
  current-format documents that the strict reader accepts.
- The r175–r186 renderer harvest's `Object3D.dispose()` finding stays a **conditional
  implementation recheck**, not an adoption; no renderer/library upgrade follows from T2, and an
  optimization that does not reproduce under measurement is not adopted.

**Capability losses this track owns rebuilding** (implementation-plan §4.4)

Placing, lighting and applying materials to a Scene; importing a single model; asset upload and
ingest staging. The supply pipeline and normalization/footprint evidence under
`apps/editor/assets-source/pipeline/` remain evidence, but staging is a T2 rebuild.

**Successor obligations carried into T2** (implementation-plan §7.2 and the planning evidence)

- **TD-1**'s five acceptance tests (canonical boot → place → commit; round trip; both surfaces
  agree; legacy untouched; honest refusal with a reasoned message), with the replaced
  camera-node placement specifics decided by the re-derived T2/T3 plans;
- the atomic group/duplicate validation semantics once proven by `history-controller`,
  `document-store` and `mutation-guards`, which are F.4 acceptance criteria;
- the removed selection/gizmo/interaction seams are **rebuilt as one authority per concern**, never
  restored verbatim; `tests/README.md` rule 4 is the tool if a composition root needs a targeted
  boundary proof in its own slice.
