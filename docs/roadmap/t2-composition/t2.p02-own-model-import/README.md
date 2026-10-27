# T2.P02 — Own model import

**Phase:** T2.P02 · **Status:** registered 2026-10-22. Released scopes and their conditions are
the [release list](../../now.md). The [production hold](../../README.md#production-implementation-hold)
covers every scope that list omits. S02 is shipped (accepted 2026-10-24); S03 is `in-progress` (released 2026-10-27, [record](../../../reference/decisions/next-wave-authorization-2026-10-27.md)), its gate ran and is **not accepted** ([record](./t2.p02.s03-integrated-final-gate/acceptance.md); [disposition](./t2.p02.s03-integrated-final-gate/disposition.md); [recovery at 7d1212b6](./t2.p02.s03-integrated-final-gate/recovery.md)) · **Track:**
[T2](../README.md) · **Roadmap:** [gate register](../../README.md#gate-register) · **Runbook:**
[T2 operations](../../../operations/t2-composition/README.md) · **Design:**
[shell draft](./shell-draft.md)

This phase is C2 of the convergence first wave. The
[current coordination](../../cross-track-execution.md#shared-files-and-merge-protocol) owns sequencing,
shared files and merge order. The historical [batch E protocol](../../../archive/roadmap/coordination-2026-10/cross-track-execution-2026-10-23.md#authorized-batch-e-2026-10-22)
and [coordination proposal](../../../archive/roadmap/coordination-2026-10/next-batch-2026-10-22.md) keep the gap findings behind S01.

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

## Landed foundation and remaining creator surface

S01 is shipped: resources format 2 and Scene format 3, owner-only staged source/derivative storage,
immutable approval, same-envelope editor admission and Save verification against a same-project
approved revision. Its [acceptance record](./t2.p02.s01-model-resource-storage-and-admission/acceptance.md)
keeps owner-override acceptance, historical review/test identities and later merge-gate evidence distinct.
The owning assets, Scene-content and persistence references describe current behavior.

T2.P02.S02 is shipped: import UI and worker preparation, source-unit scale/pivot confirmation,
resource-backed Plan footprint and contact, and placement with approved-derivative rendering and reopen.
Its owner-run rows, including Preview pixels, stay unrun and are carried by its
[acceptance stub](./t2.p02.s02-import-review-approve-place/acceptance.md). Before S02, creator IDs
rendered a generic footprint fallback; native primitive placement/contact was not proof of the complete
creator-model journey. The catalogue optimizer is not reused for imports.

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
| T2.P02.S01 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [closed plan stub](./t2.p02.s01-model-resource-storage-and-admission/implementation-plan.md) | [acceptance and preservation stub](./t2.p02.s01-model-resource-storage-and-admission/acceptance.md) | owner-authorized 2026-10-22 as batch E ([record](../../../reference/decisions/batch-e-authorization-2026-10-22.md), E7); accepted by **owner-override** 2026-10-23 for current implementation revision `623a7f73a61496d5df09c9dc0fc69ab5c6737b36`; current-verdict and current-revision evidence prerequisites waived as recorded in the acceptance stub; starts only after `T3.P03.S01` is merged on `main` |
| T2.P02.S02 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [closed plan stub](./t2.p02.s02-import-review-approve-place/implementation-plan.md) | [acceptance and preservation stub](./t2.p02.s02-import-review-approve-place/acceptance.md) | owner-authorized 2026-10-23 in the post-Batch-E release ([record](../../../reference/decisions/post-batch-e-authorization-2026-10-23.md)); shipped through PR #185 and accepted 2026-10-24 for implementation tree `082e384c` on the owner's review of the post-review fixes ([acceptance stub](./t2.p02.s02-import-review-approve-place/acceptance.md)); owner-run rows stay unrun |
| T2.P02.S03 | in-progress | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Integrated final gate](./t2.p02.s03-integrated-final-gate/implementation-plan.md) | [record](./t2.p02.s03-integrated-final-gate/acceptance.md); [failed-gate disposition](./t2.p02.s03-integrated-final-gate/disposition.md) | owner-authorized and released 2026-10-27 ([record](../../../reference/decisions/next-wave-authorization-2026-10-27.md)); starts after the coordination PR #198 merges, with S01 and S02 already accepted, and on its own trusted base; plan review complete ([review](./t2.p02.s03-integrated-final-gate/plan-review.md)); scope unchanged. The gate **ran 2026-10-27 on the integrated tree and is not accepted**: two required rows are blocked, the plan's empty-project line was unreachable on that base, and the Stage first-load hard budget misses. The failed-gate **disposition** preserves the verdict and routes the owner decisions; PR #199 is open and nothing here reads as a verdict. T1's #201 Stage change is now merged (`ce159a1e`) and the recovery at `7d1212b6` re-ran on that main: Resize/Duplicate/Delete now commit for a placed creator model, and the empty-project journey is reachable by drawing a floor first and is guided; the Stage route remains **456.7 KiB br** against the ≤400 KiB hard budget and the formal owner-run rows remain unrun, so the gate is still **not accepted** ([recovery](./t2.p02.s03-integrated-final-gate/recovery.md)) |

Every consumed gate is `accepted` and every required scope is `active` on `main` `f516e1ff`; each
slice rechecks them at its own trusted base through the runbook start step. No slice here provides a
gate. S02 is shipped; the bounded T1 host review was accepted 2026-10-24. See the [next parallel batch](../../cross-track-execution.md#next-parallel-batch).

```text
FINAL PHASE GATE: T2.P02.S03 → ./t2.p02.s03-integrated-final-gate/acceptance.md

PHASE CLOSE
Stage:        active
```

**S02 import pipeline** (see the [S02 implementation plan](./t2.p02.s02-import-review-approve-place/implementation-plan.md)). Ingest runs in a worker loaded only when Import opens:
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
- **Reference hardware:** S02's import, placement, GPU-memory and leak rows are run and accepted on
  the designated reference machine, the owner's MacBook Air M2 with 16 GB
  ([batch E, E6 amendment](../../../reference/decisions/batch-e-authorization-2026-10-22.md#amendment-e6-reference-machine-named)). S01 binds no performance row.
- **T2 writes:** `apps/api/**` and its migrations for this batch, the Scene format and planners, the
  resources format, Scene adapters and the Import procedure. Shared `units/**` edits follow the
  batch's serialized merge rule; a Stage host change is a stop-and-report to T1.
- **Excluded:** component admission or addressing, clips, variants, re-import correspondence, more
  than one model per import, formats beyond glTF/GLB, catalogue model contact, attachment, provider
  search, library scope and any T4 release closure.
- Project deletion implementation shipped with T3.P04.S01 (PR #191, `aa1db37a`; phase closed
  2026-10-25) and deletes the project's model revisions with the project. S03 verifies retained
  revision/pin integrity without adding deletion capability and does not re-accept C3.

## Follow-on triggers

The next capability wave is planning, not authorization: T1's Wall face-frame query provides the
surface frame for T2 solve-once placement, writing an ordinary world pose. Existing objects can
consume it; own-GLB import and the vertical cutover are not artificial prerequisites. After this
phase's import outcome, T2 component identity/resolution/admission and revision correspondence
precede T1 Stage part-selection/admission UI and T3 annotations. No component capability is admitted
by S02, no future slice IDs are minted here, and attachments remain separate.
