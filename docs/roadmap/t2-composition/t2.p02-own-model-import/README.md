# T2.P02 — Own model import: registration draft

**Status:** registration-ready draft, 2026-10-22 (C2). It is **not registered**: no row exists in the
[T2 phase register](../README.md#phase-register), and nothing here is a phase, slice, gate version,
authorization or release from the [production hold](../../README.md#production-implementation-hold).
Sequencing, shared files and owner decisions live in the
[canonical batch](../../cross-track-execution.md#convergence-batch-and-next-planning-wave) and its
[coordination proposal](../../next-batch-2026-10-22.md). Routes: [T2](../README.md) ·
[runbook](../../../operations/t2-composition/README.md) · [shell draft](./shell-draft.md).

## Outcome

A creator imports one of their own GLB models with its maps, reviews what was found, confirms scale,
pivot and footprint, approves it, then places, moves, turns, resizes, duplicates and deletes it,
saves and reopens the project, and sees it in Preview. Two placed instances share one immutable
resource revision with independent instance identity. The original bytes and hash, the recipe
identity/version and a parts-safe derivative are retained; no part, clip or variant is admitted, and
qualified references keep `componentId: null`. There is no T4 dependency and no publication.

The closed T2.P01 deferred table still says single-model ingest needs "T4 delivery integration" and
includes publish. That sentence predates owner ruling K1; K1, the
[Core Editor Stability](../../core-editor-stability.md) criteria and this draft exclude T4. The closed
record is left as written.

## What the code already has (verified at `f516e1ff`)

- The API's project asset registry stores images only: kind `texture`/`procedural`, PNG/WebP/JPEG
  sniffing, a 25 MiB cap, `sha256-` hashes and mutable `pending → ready` rows whose superseded bytes
  are orphaned. Nothing accepts GLB bytes, and no row maps to an envelope resource or pin.
- Save carries unit documents only and never checks a pin against stored bytes; resource identity is
  host-asserted. The live Stage host never grants resource staging, so a planner that changes
  resources is refused.
- A placed model names a catalogue `assetId`. Editor, API and visitor admission accept only shipped
  catalogue IDs, so a reopened project with an uploaded model would refuse. The required `fallback`
  is a closed furniture enum.
- Scene placement admits native primitives only: model contact is unknown (`localContactMinY` returns
  null), so move, resize and duplicate refuse for any model.
- One runtime loader serves editor and visitor (`useGltf` with the meshopt decoder); Draco and KTX2 are
  unused. The catalogue normalizer prunes and deduplicates, which the capability research showed
  destroys parts; it is not reused for creator imports.

## Formats

Under the North Star's [pre-baseline rule](../../../reference/north-star.md#release-and-source-baselines)
each change below bumps its format number and readers refuse anything else; no migration or negotiation.

- **Resources:** a `model` resource kind for creator imports, holding the derivative pin, the retained
  source pin (the source file set's manifest hash), recipe `{id, version}`, the ingest report digest
  and the placement definition: metric scale, pivot, footprint and contact, floor placement only.
- **Scene:** a model may name either a catalogue asset or a `model` resource, and the fallback gains a
  generic value that renders the approved footprint box. Instances carry no part fields.
- Hosts admit a model ID that resolves to a `model` resource in the same envelope. The visitor `/p`
  path stays catalogue-only; publication remains unavailable until T4.

## Proposed slice register (applies on registration)

| Slice | Outcome | Tier and route | Plan |
| --- | --- | --- | --- |
| T2.P02.S01 | Model resource storage, staging, approval and the formats above; Save verifies model pins against approved stored revisions; no editor UI | `architecture-integration`, route S03 | [Launch plan](./t2.p02.s01-model-resource-storage-and-admission/implementation-plan.md) |
| T2.P02.S02 | Import, review, approve and place in the editor: worker ingest, part-preserving derivative, explicit scale/pivot/footprint, definition-based contact for every Scene planner, Save/reopen, Preview | `architecture-integration`, route S03 | written after S01 acceptance |
| T2.P02.S03 | Integrated final gate | `exhaustive` | written at registration |

All three would consume `F1.reference@1`, `F2.unit-envelope@1`, `F4.intent-acceptance@1` and
`T1.viewport-projection@1`, requiring `unit-resolution-v1`, `unit-envelope-v1`, `unit-acceptance-v1`,
`conditional-save-units-v1` and `viewport-projection-v1`, all accepted and active on `main` `f516e1ff`.
No slice provides a gate.

```text
PROPOSED FINAL PHASE GATE: T2.P02.S03 (exhaustive; DB-backed API tests at zero skips)
```

**S02 import pipeline (outline for its plan).** Ingest runs in a worker loaded only when Import opens:
glTF validation and the observed-versus-admitted report; decoders for Draco, meshopt or KTX2 sources
loaded only when the source uses them; recipe `creator-import@1` keeps every node, empty and mesh
(no prune of leaves, dedup, join or flatten), appends a pivot root, records the node map, re-encodes
geometry with meshopt and textures as WebP, and caps textures at 2048 px with the reduction reported.
The runtime then needs only the existing meshopt decoder. The first placement adds the `model`
resource and lock entry in the same accepted result as the entity, through a planner granted
resources under H0's enforced scope; Undo removes both. Approval is outside source history; a
cancelled, stale or project-replaced upload or approval never installs.

**S02 performance obligations.** F5 import (long tasks during admission, worker time, peak heap, GPU
memory delta, chosen → placed), F6 placement at S and M, the GPU-memory hard row at M, F13 leak
cycles with repeated import/place/delete, and the Stage first-load delta (Import code stays lazy).

## Dependencies and boundaries

- **Before implementation:** H0's `T3.P03.S01` merged (the resource-granting placement planner relies
  on per-planner scope). The upload bounds and derivative location in the coordination proposal are
  accepted. Nothing waits on C1. Preview evidence needs T3.P02.S01; if it has not merged when S02 is
  accepted, the check moves to S03.
- **T2 writes:** `apps/api/**` and its migrations for this batch, the Scene format and planners, the
  resources format, Scene adapters and the Import procedure. Shared `units/**` edits follow the
  batch's serialized merge rule; a Stage host change is a stop-and-report to T1.
- **Excluded:** component admission or addressing, clips, variants, re-import correspondence, more
  than one model per import, formats beyond glTF/GLB, catalogue model contact, attachment, provider
  search, library scope and any T4 release closure.
- Project deletion (C3) must delete a project's model revisions; C3 inherits that obligation.
