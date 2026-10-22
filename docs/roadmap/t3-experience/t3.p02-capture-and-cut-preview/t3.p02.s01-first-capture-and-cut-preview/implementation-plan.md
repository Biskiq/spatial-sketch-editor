# T3.P02.S01 — First capture and Cut Preview: implementation plan

**Slice:** T3.P02.S01 · **Status:** approved — owner-authorized 2026-10-20 as batch D
([record](../../../../reference/decisions/batch-d-authorization-2026-10-20.md), D3); **not
implemented** · **Phase:** [T3.P02](../README.md) · [slice register](../README.md#slice-register) ·
**Track:** [T3](../../README.md) · **Runbook:** [T3 operations](../../../../operations/t3-experience/README.md)

**Implementation held, 2026-10-22:** the [owner hold](../../../README.md#production-implementation-hold)
overrides launch/resume under the earlier authorization. PR #173 must reconcile this plan with
the selected convergence decisions; explicit owner release is required before implementation.
The scope and registered `approved` state below are preserved, not silently widened or revoked.

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F3.channels@1, F4.intent-acceptance@1, T1.viewport-projection@1, T3.camera-experience-cutover@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F3.channels@1:camera-handoff-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t3.p02.s02-integrated-final-gate/acceptance.md
```

This slice is authorized and unimplemented: nothing here is accepted, ready, evidenced or shipped.
It delivers the phase's first useful authoring surface and routes its deferred exhaustive proof
through `T3.P02.S02`.

## Scope

A creator, on the shared Stage, can:

1. **Create or select an Experience** when none exists — explicitly, never by implicit document
   creation on first edit. A collection-capable source holds several Experiences over one world; the
   UI may concentrate on one and must switch between two in conformance.
2. **Capture a Camera View** from the current Stage framing (eye, target, FOV and the frame's aspect)
   as a deliberate, validated Camera action. Capture is not a silent side effect of selection, and it
   discloses shared reach when the View is already referenced.
3. **Bind a Presentation** — Default role plus subject/use, and optionally a Guide Stop — in **one**
   accepted operation with one undo payload. Rebinding to a deliberately captured View is the narrow
   alternative to editing a shared one in place.
4. **Reuse one Presentation at distinct Stops**, and **reorder Stops by stable identity**; a repeated
   visit to one Stop starts a fresh run.
5. **Edit bounded editorial fields**: Stop and Presentation labels, Information-panel text, finite
   holds, and explicit continuation targets (including nonadjacent targets and End).
6. **Use a first coherent Cut Guide**: the Guide renders as one ordered set of Stops whose Cuts
   resolve Views without travel and without manufacturing Connections. Existing supported **Travel**
   is selectable where Camera connectivity supports it, and an unsupported transition reports a gap;
   Experience never silently falls back to a Cut or searches the Camera graph.
7. **Enter an isolated visitor Preview** over the same lowering/interpreter the visitor uses, and
   **return** through the Camera return token with authoring identity, selection and history intact.
   Source edits stop stale playback; Preview never writes source.
8. **Undo/Redo, Save and reload** through F2/F4: one chronological source history for lenses and
   authoring, a conditional unit Save with conflict preservation, and a reload that preserves Views,
   Presentations, Stops and order.

**Interaction surface.** Mount through the accepted public T1 Stage seam: selection, task focus and
gestures stay host-owned; the slice contributes AM-5 task/Find/instrument entries and adapter-backed
commands. Exactly one Camera output ticket governs inspection, Look-through, Follow and Preview
handover. Exact numeric/keyboard routes are first-class peers of pointer routes, and every command
that can produce a candidate has a truthful refusal path.

**Explicitly out of scope:** rich interactive control authoring beyond the first Cut Guide (Gate and
choice grammar, conditional branching), advanced path/anchor authoring and Camera path editing tools,
a second Camera controller or a second navigation graph, a second Experience timeline or sequence
editor, general animation orchestration, media authoring/playback, publication or prepared readers,
and any change to Layout/Scene ownership. The richer interaction grammar is the
[PR #154 prototype's](../../../../../prototypes/README.md) exploration; this slice neither invents it nor
imports it.

## Sequence

1. **Experience unit surface.** Reconcile the accepted F2 Experience unit and F1 resolution with what
   capture needs: Experience create/select, Presentation and Stop identity, Guide order as one list of
   stable Stop IDs, holds/continuation. Where the accepted unit needs an additive, compatible
   extension for the authored Cut/Travel selector or presentation text, propose it as an **AM-9
   amendment draft** in the phase artifacts; do not change a ratified shape unilaterally. An
   incompatible change is a new gate major and a re-declared consumer, which stops and reports.
2. **Capture and binding.** View capture through the Camera unit + `camera-core` evaluation; one typed
   F4 intent carrying the new View/Presentation/Stop IDs, captured frame and precondition; one
   planner result; one history entry.
3. **Guide and editorial fields.** Order by stable identity, holds/continuation resolution by
   occurrence, and one order writer.
4. **Preview.** Isolated session over the shared interpreter, with entry/exit through the Camera
   return token, and no editor machinery in the preview chunk.
5. **Save/reload.** Unit conditional Save with receipts and conflict preservation; strict admission for
   pre-epoch or unknown-version sources.
6. **Surface review.** Real-route browser review in both readings, narrow viewport and reduced motion,
   including the shell-layout observation `T3.P01.S04` carried forward (the Card overlapping Compose
   buttons) where this slice's surface touches it.

## Acceptance criteria

Recorded acceptance requires the phase's
[acceptance evidence](../README.md#acceptance-evidence-to-carry) rows that this slice can prove, at
this declared **architecture-integration** tier: behavioral planner/acceptance tests for the capture,
binding and order operations; narrow call-site proof for the Stage contribution and the Preview
entry/exit wiring; F4 history and stale-writer proof; Save/conflict/reload proof with the API lane
where the Save path is exercised; the visitor isolation and public-surface boundary suites; and real
route browser journeys with recorded revision, viewport and reduced-motion state. Dense 20/50-View and
15/30-Stop fixtures prove discovery and orientation without becoming product limits.

The exhaustive integrated result — including two Experiences over one world, the full editorial
matrix, DOM reach with gap explanation and the complete repository gate — is `T3.P02.S02`'s
declared integration route, recorded in
[its acceptance](../t3.p02.s02-integrated-final-gate/acceptance.md). Focused iteration never
substitutes for that gate, and every implementation-PR merge keeps the complete repository gate,
including heavy correctness and `check:api`/`test:api` with zero skips for the Save path.

## Shared-file ownership (batch D)

| Area | Writer in batch D |
| --- | --- |
| Stage host (`stage-facade.ts`, `stage-session.ts`, `stage-input.ts`, `stage-contributions.ts`, adapter host, `stage/shell/**`) and the spatial route | `T1.P01.S06` (which also lands the narrow TD-10 repair) |
| `packages/project-model/src/units/**` (Experience unit, lowering, runtime) and `camera-core` | `T3.P02.S01`, additive and stopping-and-reporting on any incompatible change; `T1.P01.S06` is read-only |
| Editor `lib/authoring/adapters/**` and new T3 authoring surface directories | `T3.P02.S01`; additive registration only where a host contract exists |
| `apps/api/**` and migrations | neither slice — read-only for batch D |
| Root barrels, `package.json` exports, `test-lanes.ts` | append-only; the second merger resolves |
| Boundary tests and lane lists | additive assertions only; no existing assertion is weakened |
| Gate register, phase registers, batons | each slice edits only its own rows and its own track's baton |

A file outside the slice's row is read-only. A needed host change is a stop-and-report to T1, not an
edit.

## Readiness declaration

This slice starts only from a trusted base where every consumed gate is `accepted` and every
`Requires` scope is `active` (all true on `main` `9a457f6b` after `T3.P01.S04`), and in which
`T3.camera-experience-cutover@1` is `accepted` rather than `ratified`. The runbook start step re-checks
it. It does not wait for `T1.P01.S06`: S06 is the integrated gate for the authoring foundation that
already shipped and its evidence excludes unaccepted T3.P02 work. No gate state, capability entry,
acceptance or commit is claimed here, and this slice neither opens nor waits for an architecture-cycle
window.
