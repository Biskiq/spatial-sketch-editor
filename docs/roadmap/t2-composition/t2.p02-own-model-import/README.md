# T2.P02 — Own model import

**Phase:** T2.P02 · **Status:** registered 2026-10-22 — `T2.P02.S01` owner-authorized as batch E
(E1/E7, [record](../../../reference/decisions/batch-e-authorization-2026-10-22.md)) and released from
the [production hold](../../README.md#production-implementation-hold), starting only after
`T3.P03.S01` merges; S02 and S03 registered `proposed`, not authorized · **Track:**
[T2](../README.md) · **Roadmap:** [gate register](../../README.md#gate-register) · **Runbook:**
[T2 operations](../../../operations/t2-composition/README.md) · **Design:**
[shell draft](./shell-draft.md)

This phase is C2 of the convergence first wave. The
[batch E protocol](../../cross-track-execution.md#authorized-batch-e-2026-10-22) owns sequencing,
shared files and merge order, and the [coordination proposal](../../next-batch-2026-10-22.md) keeps
the gap findings behind it.

## Outcome

A creator imports one of their own GLB models with its maps, reviews what was found, confirms scale,
pivot and footprint, approves it, then places, moves, turns, resizes, duplicates and deletes it,
saves and reopens the project, and sees it in Preview. Two placed instances share one immutable
resource revision with independent instance identity. The original bytes and hash, the recipe
identity/version and a parts-safe derivative are retained; no part, clip or variant is admitted, and
qualified references keep `componentId: null`. There is no T4 dependency and no publication.

The closed T2.P01 deferred table still says single-model ingest needs "T4 delivery integration" and
includes publish. That sentence predates owner ruling K1; K1, the
[Core Editor Stability](../../core-editor-stability.md) criteria and this phase exclude T4. The closed
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

## Upload, retention and derivative bounds (owner-accepted 2026-10-22)

The owner accepted these bounds (batch E, E4, [record](../../../reference/decisions/batch-e-authorization-2026-10-22.md)); S01 enforces them on the API and S02
in the editor:

- **Size.** A source file set is at most 50 MiB per import, and its derivative at most 25 MiB.
- **Staging.** Unapproved staging, its bytes included, is deleted after 24 hours.
- **Retention.** An approved revision is kept while any stored project version references it. Project
  deletion (C3) deletes the project's revisions with it.
- **Derivative.** The creator's browser worker produces the derivative; the server checks the
  structure of source and derivative and never processes model bytes itself.

## Slice register

Each slice's scope, exit evidence and verification tier live in its plan; this register owns
lifecycle and prerequisites only.

| Slice | Status | Consumes | Requires | Effects | Plan | Acceptance | Authorization |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T2.P02.S01 | approved | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Model resource storage and admission](./t2.p02.s01-model-resource-storage-and-admission/implementation-plan.md) | [record](./t2.p02.s01-model-resource-storage-and-admission/acceptance.md) | owner-authorized 2026-10-22 as batch E ([record](../../../reference/decisions/batch-e-authorization-2026-10-22.md), E7); released from the hold; starts only after `T3.P03.S01` is merged on `main` |
| T2.P02.S02 | proposed | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Import, review, approve and place](./t2.p02.s02-import-review-approve-place/implementation-plan.md) (outline) | [record](./t2.p02.s02-import-review-approve-place/acceptance.md) | not authorized — starts only from its own owner authorization after S01 is accepted |
| T2.P02.S03 | proposed | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Integrated final gate](./t2.p02.s03-integrated-final-gate/implementation-plan.md) | [record](./t2.p02.s03-integrated-final-gate/acceptance.md) | not authorized — starts only from its own owner authorization after S01 and S02 are accepted |

Every consumed gate is `accepted` and every required scope is `active` on `main` `f516e1ff`; each
slice rechecks them at its own trusted base through the runbook start step. No slice here provides a
gate. S02 carries an outline plan: it writes its complete plan after S01's acceptance, for review
with its own authorization.

```text
FINAL PHASE GATE: T2.P02.S03 → ./t2.p02.s03-integrated-final-gate/acceptance.md

PHASE CLOSE
Stage:        active
```

**S02 import pipeline** (see the [S02 outline plan](./t2.p02.s02-import-review-approve-place/implementation-plan.md)). Ingest runs in a worker loaded only when Import opens:
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
  on per-planner scope). The bounds above are owner-accepted. Nothing waits on C1. Preview evidence
  needs T3.P02.S01; if it has not merged when S02 is accepted, the check moves to S03.
- **Reference hardware:** S02's import, placement, GPU-memory and leak rows are accepted only on, or
  calibrated against, the Reference A machine the owner designates under batch E decision E6. S01
  binds no performance row.
- **T2 writes:** `apps/api/**` and its migrations for this batch, the Scene format and planners, the
  resources format, Scene adapters and the Import procedure. Shared `units/**` edits follow the
  batch's serialized merge rule; a Stage host change is a stop-and-report to T1.
- **Excluded:** component admission or addressing, clips, variants, re-import correspondence, more
  than one model per import, formats beyond glTF/GLB, catalogue model contact, attachment, provider
  search, library scope and any T4 release closure.
- Project deletion (C3) must delete a project's model revisions; C3 inherits that obligation.
