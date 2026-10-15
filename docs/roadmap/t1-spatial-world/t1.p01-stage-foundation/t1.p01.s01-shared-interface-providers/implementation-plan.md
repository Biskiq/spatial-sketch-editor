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

## Scope

Implement domain-qualified identity/revision/frame/channel addressing, typed resolution,
generation-qualified correspondence and the narrow representation value family. F.3's gate means
this exact address/value/negotiation interface, not a complete execution kernel. Camera and Layout
attach their own evaluators later. Every attachment stays owned by its own authority: this slice
adds the shared interfaces and their conformance surface, never a second Camera system, a Stage UI,
F2 unit activation or source migration, an F4 history implementation, or a T2/T3/T4 feature.

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
- The Accepted-capabilities / Requires readiness enforcement is installed and does not derive
  incremental readiness from overall gate state alone.

The slice's own tier is `architecture-integration`; its narrowed proof routes through the phase's
[S06 integrated final gate](../t1.p01.s06-integrated-final-gate/implementation-plan.md). No
consumer may claim readiness from this plan alone.

## Readiness declaration

This slice supplies `F1.reference@1` and `F3.channels@1`, so it declares no consumed F1/F3
prerequisite and no Accepted-capabilities refinement of its own — it is the consumer that first
needs the readiness rule, and it installs that enforcement. No acceptance, evidence, commit or
gate promotion is claimed here.
