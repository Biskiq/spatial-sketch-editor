# T5 — Expressive Geometry

**Track:** T5 · **Status:** planning — registered 2026-10-27; **G0 approved 2026-10-27**, executable
once PR #198 merges ([decision](../../reference/decisions/t5-g0-approval-2026-10-27.md)); **no phase,
gate, release or implementation is authorized** ([track register](../README.md#track-register)) ·
**Gates owned:** none · **Phase register:** none · **Operations:** none yet (see
[Operations](#operations-and-authorization-route))

## Mission

Build a sophisticated, production-grade geometric capability foundation that enables **immediate
creation, progressive mastery and unbounded expression** — without becoming a separate modeling
application or another disposable prototype.

T5 exists because the product now needs geometry that is authored, revised and reused rather than
only compiled: constructive solids, robust curves and surfaces, freeform deformation, shape
modification, geometric relationships, correspondence and durable revision. That is a different
engineering problem from drawing a Wall well, and it must not be solved by duplicating the Layout
compiler or by promoting a prototype.

**Product direction (owner, 2026-10-27).** Biskiq supports effortless semantic and geometric editing
in **World**, alongside a dedicated **Object Focus workspace** for deeper, more precise and
expressive 3D modeling. Both share the same authored source, identity, relationships and history,
and the drawing-first philosophy with its progressive learning curve is preserved — without limiting
the eventual geometric capability to what today's prototypes demonstrate. The final Object Focus UX
and technical architecture stay open for G0
([decision](../../reference/decisions/t5-g0-approval-2026-10-27.md)).

## Bounded objectives

A T5 phase is authorized only against a registered, bounded objective. The track's near-term work is
planning:

1. **G0 — foundation architecture (approved 2026-10-27; executable once PR #198 merges).** The
   [G0 foundation-architecture brief](./g0-foundation-architecture-commission.md) delivers one
   recommended geometric architecture with alternatives, library/kernel strategy, integration
   boundaries, an editable operation/correspondence model, incremental-evaluation requirements and
   an implementation-ready sequence with a real first consumer. G0 authorizes no implementation.
2. **First capability phase (future).** Registered only after the owner rules on G0's architecture,
   and only with a plan, review path and release. It must deliver production-owned capability to a
   real consumer — not a laboratory result.

Completion evidence for any T5 phase is a recorded acceptance against that phase's declared final
gate, with the domain boundaries below intact and the accepted contracts unbroken.

## Concern ownership and boundaries

This allocation is the **proposal this track starts from**, to be validated by G0 against existing
contracts. A more precise allocation may be recommended, but no ratified authority changes without the
owning decision.

| Concern | Owner |
| --- | --- |
| Architectural semantics, Layout topology and the **canonical architectural compiler** | T1 (unchanged; [`layout-core`](../../reference/architecture.md)) |
| Scene objects, definitions, instances and composition | T2 (unchanged) |
| Experience/Camera runtime, acceptance/history and Save | T3 / F4 (unchanged) |
| Reusable geometric algorithms, mathematical kernels and appropriate shared representations | **T5**, consumed through established domain boundaries |
| F contracts (F.1–F.5) and their accepted capability scopes | existing owners; T5 creates none |

**What T5 does not get.** No competing persisted document, source format, history store, acceptance
authority or second compiler. T5 geometry is an input to the existing boundaries: authored content
enters through the owning document/unit, acceptance through F4, rendering through the shared Stage and
renderer, and publication through T4. A cross-domain geometric interface T5 needs becomes an **F
amendment** (or an owned capability scope) through the ratified path — never a track-local protocol.

**What is deliberately open.** The kernel, representation and library strategy (including permissive
third-party mathematics, geometry or WASM/native kernels where justified), the division between
persistent T5 structures and existing ones, and the exact package boundaries are G0's decisions to
recommend — not prerequisites this registration pre-ratifies.

## Evidence roles

- [E0 execution plan](./e0-execution-plan.md) — bounded disposable comparison of contextual
  creation with competent explicit controls, derived from the G0 reconciliation's §10. Planning
  only: no prototype implementation, production slice registration or R1 scope decision.
- [G0 commission](./g0-foundation-architecture-commission.md) — the actionable planning brief,
  approved by the owner 2026-10-27
  ([decision](../../reference/decisions/t5-g0-approval-2026-10-27.md)); it authorizes no
  implementation.
- [Native Form Lab (PR #194)](https://github.com/Biskiq/spatial-sketch-editor/pull/194) and
  [native object shaping (PR #196, merged `4a1ff08d`)](https://github.com/Biskiq/spatial-sketch-editor/pull/196) —
  **creative and technical evidence**: what native creation wants to feel like and which operations
  matter, durable in
  [`prototypes/native-object-shaping/UX-SPEC.md`](../../../prototypes/native-object-shaping/UX-SPEC.md).
  Prototype code, not production authority.
- [Depth prototypes (PR #195)](https://github.com/Biskiq/spatial-sketch-editor/pull/195) and the
  [spatial modeling depth study (PR #192)](https://github.com/Biskiq/spatial-sketch-editor/pull/192) —
  design evidence for depth, shape and creative operation sets.
- [S06 performance foundation](../t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/acceptance.md)
  (PR #190, merged `6af62eb4`) — the **accepted computational starting point**: one canonical
  compiler, incremental evaluation, retained Plan/representation and the measured limits.
- [World-scale architecture study](../../../broad-research/all-visible-editing-and-town-overview.md) —
  historical research (PR #189), useful for alternatives and long-term scaling, not a plan.
- [PLATE destination shell and visual system](../../reference/design-system/editor-shell-and-visual-system.md)
  — the ratified shell authority. **Vellum**
  ([`prototypes/p3-vellum/DESIGN.md`](../../../prototypes/p3-vellum/DESIGN.md), Make/Tell/Visit, its
  pen and sheet) and **Shape Focus**
  ([`prototypes/native-object-shaping/UX-SPEC.md`](../../../prototypes/native-object-shaping/UX-SPEC.md))
  are interaction evidence for feel and operation vocabulary; both are design evidence, not ratified
  production implementation. T5 defines creative-operation **semantics** for engineering; it does
  not commission another UX prototype or impose a tool/panel design.
- [`reference/architecture.md`](../../reference/architecture.md) and
  [`reference/composition-execution.md`](../../reference/composition-execution.md) — the ownership and
  interface contracts any T5 phase must satisfy.

## Phase register

No T5 phase is registered. A phase is added here only by an authorized plan, with its own README and
its own slice register; G0 is a planning commission, not a phase row.

| Phase | Status | Depends on | Workspace |
| --- | --- | --- | --- |
| — | — | — | — |

## Operations and authorization route

T5 deliberately has **no runbook and no baton** yet: a planning track with no registered phase has no
start step to route, and creating them now would be empty scaffolding. The runbook (`operations/t5-expressive-geometry/README.md`)
and baton (`operations/t5-expressive-geometry/current.md`) are added by the change that registers T5's
first phase, which also routes them from [`operations/current.md`](../../operations/current.md).

```text
1 OWNER DECISION   **approved 2026-10-27** — G0 is T5's next planning activity, executable once
                   this PR merges; it authorizes no production implementation
2 ARCHITECTURE     the commissioned architect writes one recommended architecture + alternatives,
                   ownership boundaries, operation/correspondence model, incremental requirements and
                   an implementation-ready sequence, as its own artifact
3 OWNER RULING     accept, revise or reject that architecture; any cross-domain interface goes through
                   the F amendment path and any new package through the licensing ruling
4 REGISTRATION     register the first T5 phase + slice plan with a real consumer and measurable
                   acceptance; add the runbook and baton in that change
5 RELEASE          the owner lists the slice in the release list; only then does implementation start
```

No step above is authorized by this README. Registration and a complete plan grant no release, and
nothing here edits the [release list](../now.md).
