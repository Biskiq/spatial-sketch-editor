# T2 — Composition

**Track:** T2 · **Status:** approved — `T2.P01` registered 2026-10-16 and **closed 2026-10-20**, with
all four children shipped (`T2.P01.S01` 2026-10-16, `S02` 2026-10-17, `S03` 2026-10-18 (batch B),
`S04` final gate 2026-10-20, PR #157); `T2.P02` (own model import) registered 2026-10-22 as batch E
with `T2.P02.S01` shipped by owner-override acceptance ([track register](../README.md#track-register)) · **Runbook:**
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

| Concern | Current (landed tree) | Destination |
| --- | --- | --- |
| Scene document | world-local Scene 3 in F2, no `roomId`, Scene-owned entities/materials/lights; Camera and Experience are separate units | unchanged semantic ownership; later formats need an explicit cutover |
| Placement | T2.P01 places, moves, yaws, uniformly resizes, duplicates and deletes native primitives through shared unit F4/history in Plan and 3D; creator-model placement/contact remains T2.P02.S02 | extend the same Scene-owned intent path to declared support/attachment capabilities |
| Materials / lights | catalogue and kernel validation retained; authoring surfaces removed | truthful units, atomic subset editing, explicit repair instead of silent clamping |
| Resources | F2 resources 2 with typed definitions/revisions and dependency locks; S01 landed owner-only model staging/immutable approval and Save pin verification; creator import UI/placement remains absent | resource admission and revision workflows, including bounded creator import and later component admission |

The [current Scene contract](../../reference/components/scene-content.md#current-implementation)
and [F2 persistence contract](../../reference/components/persistence.md#one-source-format-f2-clean-epoch)
describe the landed tree; production epoch activation remains a separate owner-controlled step.
Landed contracts keep describing current behaviour until their explicit cutover.

## Planning continuation

Current sequencing is the [next parallel batch](../cross-track-execution.md#next-parallel-batch).
Historically, the [convergence batch and next planning wave](../../archive/roadmap/coordination-2026-10/cross-track-execution-2026-10-23.md#convergence-batch-and-next-planning-wave)
and [main convergence plan](../../archive/roadmap/coordination-2026-10/product-convergence-2026-10-21.md#proposed-next-engineering-batch)
propose H0 shared F4 scope enforcement, build-boundary repairs and the on-demand performance/bundle
baseline, then C1 native Walls, C2 own-GLB import and Capture/Preview. Batch E launch slices are now
shipped; remaining scopes follow the [next parallel batch](../cross-track-execution.md#next-parallel-batch). It is whole-object editor import with retained original bytes/hash,
recipe identity/version and a parts-safe derivative; no components are admitted or addressable, qualified
references keep `componentId: null`, and no T4 dependency is introduced. Its consuming slice carries
import/placement/memory evidence. It is registered as
[T2.P02 — Own model import](./t2.p02-own-model-import/README.md) (batch E, [record](../../reference/decisions/batch-e-authorization-2026-10-22.md)): the
owner accepted its upload, retention and derivative bounds, authorized `T2.P02.S01` and released it
from the hold, starting only after `T3.P03.S01` merges. The owner authorized and released `T2.P02.S02` on
2026-10-23 ([record](../../reference/decisions/post-batch-e-authorization-2026-10-23.md)), starting per the release list (`docs/roadmap/now.md`); S03 stays `proposed`, unauthorized and held, and waits for
T1.P02.S06 under the owner's [performance-first halt](../../reference/decisions/performance-foundation-authorization-2026-10-24.md#performance-first-halt-temporary).

The next planning wave pairs T1's face-frame query with T2 solve-once wall placement, and T1 Stage
part selection with T2 component resolver/admission and revision correspondence; T3 annotations
consume the latter. Attached composition and later architecture choices remain deferred. Feature
shell design develops in the consuming slice through planning, draft, review, build and revision,
preserving PLATE's ratified shared invariants; it does not block all first-wave planning. All
implementation not released by batch E remains under the
[owner hold](../README.md#production-implementation-hold).

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
| T2.P01 | shipped | F1.reference@1, F4.intent-acceptance@1, T1.viewport-projection@1 | [T2.P01 — Supported object composition](./t2.p01-supported-composition/README.md) |
| T2.P02 | approved | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | [T2.P02 — Own model import](./t2.p02-own-model-import/README.md) |

T2.P01 is registered by the owner decision of 2026-10-16
([record](../../reference/decisions/parallel-slice-authorization-2026-10-16.md)), with its
[interface/reconciliation drafts](./t2.p01-supported-composition/contracts.md).
**`T2.P01.S01`** shipped 2026-10-16; it consumed the accepted
`F1.reference@1` alone. **`T2.P01.S02`** shipped 2026-10-17, consuming `F1.reference@1` and
`F4.intent-acceptance@1`; its authorization is the owner decision of 2026-10-16
([record](../../reference/decisions/s02-pair-authorization-2026-10-16.md)).
`Depends on` lists the external gates the phase's later slices consume. **`T2.P01.S03`** was
owner-authorized 2026-10-17 as batch B with `T1.P01.S04` ([record](../../reference/decisions/batch-b-authorization-2026-10-17.md)), after
`T1.viewport-projection@1` was accepted through `T1.P01.S07`, and shipped 2026-10-18 (PR #147). S04 was
owner-authorized 2026-10-19 as batch C ([record](../../reference/decisions/batch-c-authorization-2026-10-19.md)); its T1 Head Save
prerequisite shipped through `T1.P01.S04` (PR #148). S04's final gate was accepted 2026-10-19 and
shipped in PR #157 (`99c38033`), and the owner closed the phase on 2026-10-20 (its PHASE CLOSE block).

**T2 is not complete.** Phase closure ends one bounded phase; the track's remaining objectives
(materials/lights depth, attachments, definitions, and the K1 bounded editor-side GLB import) stay
ahead of it. **`T2.P02` is registered 2026-10-22** as that K1 bounded editor-side import (batch E,
[record](../../reference/decisions/batch-e-authorization-2026-10-22.md), E1/E4/E7), superseding the closed phase's deferred-table sentence that tied it to
T4 delivery; the closed record is left as written. `T2.P02.S01` is shipped with owner-override acceptance and recorded complete merge-gate evidence;
S02 was owner-authorized and released 2026-10-23 ([record](../../reference/decisions/post-batch-e-authorization-2026-10-23.md)),
starting per the release list (`docs/roadmap/now.md`); S03 is registered `proposed`, unauthorized and held. `Depends on`
lists the external gates its slices consume. No slice provides a gate.

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
  foundation; T3.P01.S04 cut over the live source to Scene 2 with separate Camera/Experience units.
  Later Scene capabilities extend that contract through explicit formats and admission.
- The old-source authored-snapshot reader retired at T3.P01.S04's clean cutover; it is not a
  public fallback. T2 produces current F2 source, while T4 still owns the prepared delivery reader.
- The r175–r186 renderer harvest's `Object3D.dispose()` finding stays a **conditional
  implementation recheck**, not an adoption; no renderer/library upgrade follows from T2, and an
  optimization that does not reproduce under measurement is not adopted.

**Capability rebuild and remaining boundary** (implementation-plan §4.4)

T2.P01 restored supported Scene placement and editing in both readings through shared history and
Save. T2.P02.S01 adds model staging/storage, immutable approval and resource admission; the
creator-facing import/placement/rendering journey remains S02. Materials/light authoring depth
and later composition capabilities remain T2 work. The supply pipeline and normalization/footprint evidence under
`apps/editor/assets-source/pipeline/` remain evidence; C2 must establish its own source-retention and
parts-safe derivative proof rather than reuse the catalogue optimizer unchanged.

**Successor obligations carried into T2** (implementation-plan §7.2 and the planning evidence)

- **TD-1**'s bounded Scene successor landed in T2.P01: preserve canonical boot → place → commit,
  round trip, agreement across readings and honest refusal with a reasoned message. Camera capture
  remains T3's separate consuming scope;
- the atomic group/duplicate validation semantics once proven by `history-controller`,
  `document-store` and `mutation-guards`, which are F.4 acceptance criteria;
- selection/gizmo/interaction seams keep **one authority per concern** as the landed shared Stage
  gains capabilities; `tests/README.md` rule 4 is the tool if a composition root needs a targeted
  boundary proof in its own slice.
