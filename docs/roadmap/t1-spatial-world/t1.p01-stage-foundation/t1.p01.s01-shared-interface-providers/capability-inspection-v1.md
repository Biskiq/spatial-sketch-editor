# `F3.channels@1:inspection-v1` — accepted capability record

**Capability:** `F3.channels@1:inspection-v1` · **Status:** active · **Gate:**
[`F3.channels@1`](../../../README.md#gate-register) · **Provider:** `T1.P01.S01`

This is the durable record the gate register's `Accepted capabilities` cell links. It states what
one accepted capability scope landed; F.3 semantics stay owned by
[`composition-execution.md`](../../../../reference/composition-execution.md#am-3-f3-inspection-and-camera-output-v1),
and the readiness rule it satisfies is owned by
[`f-foundation-contracts/README.md`](../../../f-foundation-contracts/README.md#capability-readiness).

## Accepted capability

| Capability | Anchor | Source kinds | Prerequisites | Extension slice | Exports | Conformance | Acceptance | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `F3.channels@1:inspection-v1` | [AM-3 F3 inspection and Camera output v1](../../../../reference/composition-execution.md#am-3-f3-inspection-and-camera-output-v1) | `layout`, `camera` | `F1.reference@1:references-v1` | `T1.P01.S01` | `packages/project-model/src/channels` | `apps/editor/tests/lib/project-model/channels-conformance.test.ts`, `apps/editor/tests/lib/project-model/camera-output-conformance.test.ts` | `docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s01-shared-interface-providers/acceptance.md` | `ee463d0b` |

## Scope of this acceptance

The F.3 address/descriptor/typed-value/negotiation interface — the shape of the inspection channel,
not a complete execution kernel: strict address and descriptor validation, typed values per declared
kind (a set value compared by membership, not sequence), and negotiation against one supplied
`ChannelEvaluationContext`. Contention is the structural property scope of the **resolved** canonical
owner plus the address's own qualification, so distinct F.1 references stay distinct while one
subject contends for one property; union properties hold one contribution per invocation with each
contributor's own run epoch and provenance; one freshness rule drives negotiation, reads and
`pruneChannelState`; and withdrawal is epoch-qualified, with retired runs unable to revive.

The v1 families are the Layout ordinary Plan inspection family and the Camera session inspection
family (including the ratified reading/projection and motion policy inputs, declared as open
domain-owned sets). AM-3's shared Camera-output ticket protocol ships as interface and negotiation
behaviour — `{outputId, sourceRevision, sessionEpoch, ownerId, runEpoch}`, one exclusive owner per
output, acquire/request/replace/return/cancel plus `rebaseCameraOutputSource`, monotonic ownership
order and stale owner/epoch rejection. **No Camera runtime, evaluator, output controller, projection
or Stage is implemented**, and no authored Camera capture or guided playback is claimed.

## Residuals

Carried, and recorded in the linked acceptance record rather than hidden here: returns nest one deep
(deeper unwinding is refused with a reason, not mis-transferred); union members are declared
identities and are not resolved against the source; declared invalidation inputs other than
`accepted-revision` and `generation` are the owning evaluator's duty; epoch marks are retained for
the life of a channel state; and an output at the run-epoch ceiling can only be cancelled until a new
host session.
