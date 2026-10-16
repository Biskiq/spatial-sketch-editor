# `F1.reference@1:references-v1` — accepted capability record

**Capability:** `F1.reference@1:references-v1` · **Status:** active · **Gate:**
[`F1.reference@1`](../../../README.md#gate-register) · **Provider:** `T1.P01.S01`

This is the durable record the gate register's `Accepted capabilities` cell links. It states
what one accepted capability scope landed; F.1 semantics stay owned by
[`composition-execution.md`](../../../../reference/composition-execution.md#am-1-f1-references-v1),
and the readiness rule it satisfies is owned by
[`f-foundation-contracts/README.md`](../../../f-foundation-contracts/README.md#capability-readiness).

## Accepted capability

| Capability | Anchor | Source kinds | Prerequisites | Extension slice | Exports | Conformance | Acceptance | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `F1.reference@1:references-v1` | [AM-1 F1 references v1](../../../../reference/composition-execution.md#am-1-f1-references-v1) | `layout`, `scene`, `camera` | — | `T1.P01.S01` | `packages/project-model/src/references` | `apps/editor/tests/lib/project-model/references-conformance.test.ts`, `apps/editor/tests/lib/project-model-boundary.test.ts` | `docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s01-shared-interface-providers/acceptance.md` | `ee463d0b` |

## Scope of this acceptance

Domain-qualified identity, revision, frame and channel addressing with strict validation (unknown
keys, empty identities, non-finite numbers and unsupported versions reject); typed reference
resolution against one supplied accepted snapshot — no ambient latest, and no name, label, index or
proximity fallback exists in the interface; generation-qualified correspondence whose fragments are
runtime-only and expire on recompile; and the **bounded current-domain read adapters** over the
current Layout, Scene and read-only Camera source this gate's acceptance scope names.

Revision identity is split the way the contract splits it: `exact {contentRevision}` and a
contribution's `computedFrom` name the snapshot's **content** identity (`sourceContentId`), while the
read context is bound to its **acceptance** identity, so one acceptance never impersonates another
holding identical content and the two identities are never compared with each other. A subject kind
no current adapter resolves, an unratified schema (Level, Structure, component, Room frame), a
non-null `componentId`/`capabilityId`, and a `project-lock` with no admitted F.2 reader each refuse
with a typed result instead of being invented.

## Residuals

Carried, and recorded in the linked acceptance record rather than hidden here: an adapter serves the
source object it was built with, so a caller that mutates a document must rebuild its adapters with
the new accepted snapshot (sealing or digesting the source on every resolve was not adopted); and the
identity space an admitted F.2 lock speaks in belongs to the F.2 provider when it lands — with no
reader supplied, `project-lock` stays `incompatible` and no lock is manufactured.
