# `F3.channels@1:camera-handoff-v1` — accepted capability record

**Capability:** `F3.channels@1:camera-handoff-v1` · **Status:** active · **Gate:**
[`F3.channels@1`](../../../README.md#gate-register) · **Original gate provider:** `T1.P01.S01` ·
**Extension slice:** `T3.P01.S06`

F.3 semantics stay owned by
[`composition-execution.md`](../../../../reference/composition-execution.md#am-3-f3-inspection-and-camera-output-v1);
capability readiness is owned by
[`f-foundation-contracts/README.md`](../../../f-foundation-contracts/README.md#capability-readiness).

## Accepted capability

| Capability | Anchor | Source kinds | Prerequisites | Extension slice | Exports | Conformance | Acceptance | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `F3.channels@1:camera-handoff-v1` | [AM-3 F3 inspection and Camera output v1](../../../../reference/composition-execution.md#am-3-f3-inspection-and-camera-output-v1) | `camera`, `experience` | `F3.channels@1:inspection-v1`, `F2.unit-envelope@1:unit-envelope-v1`, `F1.reference@1:unit-resolution-v1` | `T3.P01.S06` | `packages/project-model/src/channels/handoff.ts`, `packages/project-model/src/units/experience`, `packages/camera-core/src/experience-controllers.ts` | `apps/editor/tests/lib/project-model/camera-handoff.test.ts`, `apps/editor/tests/lib/experience/experience-runtime.test.ts`, `apps/editor/tests/lib/experience/experience-controllers.test.ts` | `docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s06-experience-runtime-and-camera-handoff/acceptance.md` | `ff5a14da02f9b1151b9156f1b1df3cb164235ea3` |

## Scope of this acceptance

The complete role and ownership meaning of `camera-handoff-v1` over the landed AM-3 ticket
protocol: guided and free ownership, Follow, Look-through and Preview roles, one declared ordered
transfer, exactly one return obligation per handoff, and epoch-qualified cleanup that cannot clear or
replace a newer run. A stale event from an ended run is rejected, never replayed, and a source rebase
ends the claim. The module exports the scope constant only because the whole allocated meaning now
exists; the role half landed earlier was not acceptance evidence on its own.

The same accepted scope covers the bounded Experience session semantics that consume the shared
program: one lowering of a selected Experience and its Camera unit into the accepted
`ExecutionProgram@1` codec (labelled Presentations, content records, stable Stop occurrences,
invocation bindings, finite holds, explicit continuation, guards, channel policies, lifecycle
actions and the reduced-motion/semantic-DOM profile), one deterministic reducer with an explicit
integer clock, occurrence-based holds/continuation and covered detour return, the framework-free
semantic companion, and guided/free/reduced-motion controllers that realize Camera intents through
the existing Camera authority. Lowering validates the Experience→Presentation→View and Camera
connection closure through F.1 and refuses an unsupported or missing binding; it copies no pose,
path, FOV, graph, renderer object or source history into the program, and Experience performs no
route search or pose/FOV interpolation.

## Residuals

Activation, Stage/Preview caller integration, source migration and retirement belong to
`T3.P01.S04`. Experience@1 carries no authored Cut/Travel selector, so an authored home for it (or a
profiles-only decision) is a pre-S04 decision; presentation text, invocation bindings, state,
lifecycle and channel policy remain closed-fixture inputs with no authored F2 home; the per-edge
transition table is preparation output, not a program field; hold/Gate time starts at editorial
arrival until S04 decides otherwise. This record accepts no source cutover, no live program
execution and no new F2/F3/F4 shape.
