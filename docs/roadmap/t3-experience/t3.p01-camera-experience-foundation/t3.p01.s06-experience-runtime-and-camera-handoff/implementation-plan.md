# T3.P01.S06 — implementation plan — CLOSED STUB

```text
AUTHORITY: NONE — this is closed work. Current truth lives in the phase README's slice register,
           the F3 gate register and the slice's accepted capability record.
STATUS:    ACCEPTED and SHIPPED 2026-10-17 (PR #141). Routine `slice-closeout` replaced the approved
           plan body with this stub after independent review accepted the whole slice.
ROLE:      recovery and orientation stub for T3.P01.S06.
NOT:       product contract · status store · active plan.
```

## Delivered

The second half of the approved `T3.P01.S03` split, consumed as the architecture-integration route
toward `T3.P01.S04`:

- the complete F3 `camera-handoff-v1` — guided/free ownership, Follow, Look-through, Preview, one
  return obligation per declared transfer and epoch-qualified stale-run cleanup;
- one lowering of a selected Experience and its Camera unit into the accepted `ExecutionProgram@1`
  codec, with strict Experience→Presentation→View and Camera connection closure;
- one deterministic reducer with an explicit integer clock, occurrence-based Stops and holds,
  explicit continuation, guards, covered detour return and run-scoped lifecycle events;
- derived runtime policy for Gates and detours, plus the closed inputs the ratified F2 shape does not
  yet author;
- the framework-free semantic DOM companion and Info Panel view model;
- guided, free and reduced-motion controllers in new `camera-core` modules that realize Camera
  intents through the existing Camera authority;
- closed AM-6 trace fixtures for repeated Stops/runs, guards, holds, Cut, travel and travel gaps,
  detour return, ownership handoff and stale-event cleanup.

Everything stays inactive: no source cutover, no live program execution and no product route.

## Contract

- [`F3.channels@1:camera-handoff-v1`](./capability-camera-handoff-v1.md)
- F.3 semantics: [`composition-execution.md`](../../../../reference/composition-execution.md#am-3-f3-inspection-and-camera-output-v1)
- Evidence and acceptance outcome: [`acceptance.md`](./acceptance.md)

## Residuals

```text
integration   T3.P01.S04 owns activation, Stage/Preview caller integration, migration and retirement
invocation    no authored Cut/Travel selector in Experience@1; lowering takes a closed binding set
authored      presentation text, bindings, state, lifecycle and channel policy are closed fixtures
timing        hold/Gate time starts at editorial arrival; confirmed-arrival timing is an S04 decision
portability   the per-edge transition table is preparation output, not an ExecutionProgram@1 field
consumer      no editor, visitor or product source imports the runtime or the handoff
```

## Recovery

```text
git show ff5a14da02f9b1151b9156f1b1df3cb164235ea3:docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s06-experience-runtime-and-camera-handoff/implementation-plan.md
anchor ff5a14da02f9b1151b9156f1b1df3cb164235ea3 · tag `closed/T3.P01.S06` (pushed)
REQUIRED MERGE METHOD — P1: merge commit, no squash/rebase, so this anchor stays reachable.
```

## Entry points

```text
implementation   packages/project-model/src/channels/handoff.ts
                 packages/project-model/src/units/experience/lowering.ts
                 packages/project-model/src/units/experience/interpreter.ts
                 packages/project-model/src/units/experience/policy.ts
                 packages/project-model/src/units/experience/companion.ts
                 packages/camera-core/src/experience-controllers.ts
validation       apps/editor/tests/lib/experience/experience-runtime.test.ts
                 apps/editor/tests/lib/experience/experience-controllers.test.ts
                 apps/editor/tests/lib/project-model/camera-handoff.test.ts
```
