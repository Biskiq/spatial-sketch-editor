# S03 split follow-up authorization: T3.P01.S05 and T3.P01.S06

**Date:** October 17, 2026. **Status:** **owner-authorized** — the owner's coordinating instruction
for the Museum Editor T3 execution authorized the two follow-up slices of `T3.P01.S03` and their
parallel implementation. This record is decision provenance, like the
[2026-10-17 next-batch record](./next-batch-authorization-2026-10-17.md) and the
[2026-10-16 S02 pair record](./s02-pair-authorization-2026-10-16.md). It changes no ratified
contract: AM-1–AM-8, F1–F5, PLATE and the Camera authority are untouched.

## Context

PR #138 is merged (`363fccd4`). Its preparatory increment implemented two provider seams — the
additive F4 unit admission (`f4/unit-acceptance.ts`, `units/acceptance-staging.ts`) and the
Follow/Look-through/Preview role half of the F3 handoff (`channels/handoff.ts`) — with conformance
suites, and recorded an **approved split direction without registering, authorizing or accepting**
any follow-up. The [split proposal](../../roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s03-compound-and-runtime-preparation/split-proposal.md)
defined the natural seam: (a) unit acceptance and unit Save, versus (b) runtime and handoff
preparation.

## Rulings

| # | Ruling | Live statement owner |
| --- | --- | --- |
| 1 | The remaining `T3.P01.S03` obligations are registered as **`T3.P01.S05` — Unit acceptance and unit Save** and **`T3.P01.S06` — Experience runtime and Camera handoff**, in that order and with numeric IDs. Literal `S03a`/`S03b` ids are not used; the register checker's qualified-id grammar is not weakened. | T3.P01 slice register |
| 2 | **`T3.P01.S05` is authorized.** It owns the F2 candidate planners (real Camera View, Presentation and optional Stop), complete domain/reference/resource-lock validation over one envelope, staged admitted resources with rollback, single/compound acceptance with atomic install and whole-operation history, the `unit-acceptance-v1` and `conditional-save-units-v1` scopes, and real-PostgreSQL Save conformance at zero skips. | [S05 plan](../../roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s05-unit-acceptance-and-unit-save/implementation-plan.md) |
| 3 | **`T3.P01.S06` is authorized.** It owns the complete F3 `camera-handoff-v1` (guided/free ownership, Follow, Look-through, Preview, return, stale-run cleanup), the one shared Experience lowering/interpreter over `ExecutionProgram@1`, deterministic reducer/clock, occurrence holds and continuation, minimal guard/Continue/detour state, the semantic DOM/Info-Panel companion, the guided/free/reduced-motion controllers and the AM-6 traces. | [S06 plan](../../roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s06-experience-runtime-and-camera-handoff/implementation-plan.md) |
| 4 | The split changes **execution ownership, not the ratified F contracts**. Every original S03 exit criterion is preserved in one of the two plans; the capability allocation moves `camera-handoff-v1` to S06 and the two unit scopes to S05, with their prerequisite sets unchanged (F2 plus the enduring `acceptance-invariants-v1`; `inspection-v1` plus the F2 program codec). | [cross-track execution](../../roadmap/cross-track-execution.md#capability-readiness-amendment) |
| 5 | **`T3.P01.S03` remains the in-progress umbrella** until both follow-ups are accepted and their original criteria reconciled. It is not closed, narrowed or relabelled by this record. `T3.P01.S04` remains `proposed` and unauthorized; its `Requires` is unchanged. | T3.P01 slice register |
| 6 | No capability is accepted by registration. `unit-acceptance-v1`, `conditional-save-units-v1` and `camera-handoff-v1` are recorded only after each slice's own independent review and full evidence, including the real-DB Save contract. | Gate register; each acceptance record |
| 7 | Neither slice may activate the new source/runtime, add a live unit writer, implement `T3.P01.S04`, begin `T3.P02` or undertake any T4 work. Current-source Save remains the only live Save route. | Both plans' non-goals |

## Application

The slices register inside their implementation PRs; there is no planning-only PR. One coordinated
registration commit is carried identically by both branches, so neither depends on unmerged work
outside its trusted base. Shared-document edits (the phase register, this record, the split proposal,
the capability allocation and the T3 baton) are authored once and applied to both branches before
implementation starts.

**Evidence/provenance:** the owner's 2026-10-17 coordinating instruction for the Museum Editor T3
execution, which explicitly authorized implementation of both follow-up slices and set their scope,
coordination rules, review route and stopping condition. This record is not a substitute for either
slice's independent review.
