# T2.P02.S02 — Import, review, approve and place: outline plan

**Slice:** T2.P02.S02 · **Status:** proposed — **not authorized**; it starts only from its own owner
authorization after `T2.P02.S01` is accepted · **Phase:** [T2.P02](../README.md) ·
[slice register](../README.md#slice-register) · **Track:** [T2](../../README.md) · **Runbook:**
[T2 operations](../../../../operations/t2-composition/README.md) · **Design:**
[shell draft](../shell-draft.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t2.p02.s03-integrated-final-gate/acceptance.md
```

This is an **outline** registered with the phase (batch E, E1). The complete plan is written after
S01's acceptance, from the tree S01 leaves, and is reviewed with this slice's own authorization.
Nothing here is implemented, authorized or evidenced.

## Outline scope

- **Import procedure** in the Place family, following the [shell draft](../shell-draft.md#flow):
  choose, read, review what was found, confirm scale, pivot and footprint, approve, place. Import code
  stays lazy and out of the Stage first-load set.
- **Worker ingest** within the owner-accepted
  [bounds](../README.md#upload-retention-and-derivative-bounds-owner-accepted-2026-10-22): glTF
  validation and the observed-versus-admitted report; Draco, meshopt or KTX2 decoders loaded only when
  the source uses them; recipe `creator-import@1` keeps every node, empty and mesh, appends a pivot
  root, records the node map, re-encodes geometry with meshopt and textures as WebP, and caps textures
  at 2048 px with the reduction reported. The runtime then needs only the existing meshopt decoder.
- **Placement.** The first placement adds the `model` resource and its lock entry in the same
  accepted result as the entity, through the one placement planner granted resources under the
  per-planner scope `T3.P03.S01` enforces; Undo removes both. Approval is outside source history; a
  cancelled, stale or project-replaced upload or approval never installs.
- **Contact.** Move, turn, resize, duplicate and delete use the placement definition's contact for
  every Scene planner.
- **Save, reopen and Preview.** A reopened project admits the model; Preview shows it once
  `T3.P02.S01` has merged, otherwise that check moves to S03.

## Outline acceptance

1. Import, approve and place one own GLB with its maps, then move, turn, resize, duplicate, delete,
   Save and reopen; two instances share one immutable revision with independent identities.
2. Oversize, malformed, cancelled, stale and project-replaced imports install nothing and say why.
3. Hard performance rows, on the designated reference machine (MacBook Air M2, 16 GB; batch E, E6 amendment): F5 import (long tasks during admission, worker time, peak heap, GPU memory delta,
   chosen → placed), F6 placement at S and M, the GPU-memory row at M, F13 leak cycles with repeated
   import/place/delete, and the Stage first-load delta.

Excluded: component admission or addressing, clips, variants, re-import correspondence, more than one
model per import, formats beyond glTF/GLB, catalogue model contact, attachment, provider search,
library scope and any T4 release closure.
