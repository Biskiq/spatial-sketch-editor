# T1.P01.S01 — Shared interface providers: implementation plan

**Slice:** T1.P01.S01 · **Status:** approved (owner-authorized 2026-10-15) — not started
**Phase:** [T1.P01](../README.md) · [slice register](../README.md#slice-register) · **Track:** [T1](../../README.md) · **Runbook:** [T1 operations](../../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: — (this slice supplies its own gate, so it consumes no F1/F3 prerequisite)
REQUIRES: — (no Accepted-capabilities refinement is declared)
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t1.p01.s06-integrated-final-gate/implementation-plan.md
```

Nothing here is implemented, accepted or evidenced yet. Registration and authorization make this
slice claimable work; they are not a result. `Phase` owns the phase's objectives and register,
this plan owns the slice's scope, tier and criteria, and the
[acceptance record](./acceptance.md) owns recorded evidence — no evidence is recorded today.

## Prerequisite

Owner approval, granted 2026-10-15
([record](../../../../reference/decisions/f-ratification-2026-10-15.md)); the landed r186 base; the
exact F1/F3 and capability-readiness amendments; and the registered `ratified` gate rows —
`F1.reference@1` and `F3.channels@1` carry this slice as their sole provider in the
[gate register](../../../README.md#gate-register).

Install the Accepted-capabilities / Requires validation with the shared provider; do not mark
incremental readiness using overall gate state alone. The registration PR wires the register's
provider column only: the readiness enforcement itself is this slice's deliverable, and no
provider becomes `implemented` or `accepted` before real code, independent review and recorded
evidence exist.

## Produces

`F1.reference@1` and `F3.channels@1` shared exports, strict validators and conformance fixtures, as
defined in [the F drafts](../interfaces.md#f-amendment-drafts). The slice consumes neither of its
own outputs; their implementation is one coherent provider. No live shell or document cutover
belongs here.

This slice is the sole provider of both gates, so its eventual **exact accepted provider outputs
are `F1.reference@1:references-v1` and `F3.channels@1:inspection-v1`** — the capability strings a
later consumer names in its `Requires`. Neither output exists today, and neither becomes ready
`accepted` capability evidence — let alone claimable by another consumer — until all of the
following hold at this slice's own delivered work:

- real shared exports, not type-only plans, placeholder modules or draft files;
- conformance fixtures covering the declared interface that run green;
- independent acceptance evidence recorded in the [acceptance record](./acceptance.md) against this
  plan's criteria; and
- an implementation commit that is an ancestor of the trusted base a consumer evaluates against.

Until every one of those exists, both gates stay `ratified` with empty evidence columns, no
Accepted-capabilities entry is recorded for either capability, and no consumer may claim readiness
from this plan. Declaring these outputs here is planning scope, never recorded acceptance.

## Scope

Implement domain-qualified identity/revision/frame/channel addressing, typed resolution,
generation-qualified correspondence and the narrow representation value family. F.3's gate means
this exact address/value/negotiation interface, not a complete execution kernel. Camera and Layout
attach their own evaluators later. Every attachment stays owned by its own authority: this slice
adds the shared interfaces and their conformance surface, never a second Camera system, a Stage UI,
F2 unit activation or source migration, an F4 history implementation, or a T2/T3/T4 feature.

F.3's Camera session inspection family includes AM-3's shared Camera-output ticket protocol as an
exported interface and negotiation rule, with no runtime behind it: this slice ships the ticket
shapes and their stale-owner/epoch rejection semantics, and **implements neither the future Camera
runtime nor the Stage**. There is no evaluator, output controller, renderer realisation, projection
or navigation here — the S02 viewport provider owns the Stage and the one inspection controller, and
T3 later supplies the guided/free, Follow, Look-through and Preview controllers through accepted
`F3.channels@1:camera-handoff-v1` conformance.

Capability readiness follows the ratified amendment: a consumer's `Consumes` gate version is not
enough, because it must also hold the specific capability a slice requires, evaluated from recorded
evidence at its trusted base.

## Acceptance criteria

- Supported and unsupported kind, revision, units and required-extension fixtures pass; visitor-safe
  import closure is proven.
- Domain-qualified identity, revision, frame and channel addressing, typed resolution,
  generation-qualified correspondence and the narrow representation value family behave as the F
  drafts define.
- The exact address/value/negotiation interface of F.3 is exported — not a complete execution
  kernel — and independent T2/T3 contract/data work can reuse the same interfaces.
- F.3 exports AM-3's shared Camera-output ticket protocol as interface and negotiation behavior:
  the `{outputId, sourceRevision, sessionEpoch, ownerId, runEpoch}` acquire/request/replace/return/
  cancel shapes, exactly one exclusive Camera output owner per viewport/session, rejection of a
  competing exclusive contribution with domain/address/owners and an actionable reason, and stale
  owner/epoch rejection where a wrong-epoch completion or an older run cannot clear, reclaim or
  replace the active output, while `return` validates current source/output context and refuses
  otherwise. This is the validated ticket protocol only: no Camera runtime, evaluator, output
  controller or Stage is implemented, and no authored Camera capture, guided playback, Follow,
  Look-through or Preview execution is claimed.
- The Accepted-capabilities / Requires readiness enforcement is installed and does not derive
  incremental readiness from overall gate state alone.

The slice's own tier is `architecture-integration`; its narrowed proof routes through the phase's
[S06 integrated final gate](../t1.p01.s06-integrated-final-gate/implementation-plan.md). No
consumer may claim readiness from this plan alone.

## Readiness declaration

This slice supplies `F1.reference@1` and `F3.channels@1`, so it declares no consumed F1/F3
prerequisite — `CONSUMES` and `REQUIRES` stay empty because it is the provider, not a consumer, of
its own gates. Its eventual accepted provider outputs are `F1.reference@1:references-v1` and
`F3.channels@1:inspection-v1`, and it consumes no Accepted-capabilities entry of its own: it is the
consumer that first needs the readiness rule, and it installs that enforcement. No acceptance,
evidence, commit or gate promotion is claimed here.
