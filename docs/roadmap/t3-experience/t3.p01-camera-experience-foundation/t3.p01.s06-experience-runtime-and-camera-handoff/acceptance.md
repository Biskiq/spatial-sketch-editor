# T3.P01.S06 — accepted and closed record — CLOSED STUB

```text
AUTHORITY: NONE — this is closed work. Current truth lives in the phase README's slice register,
           the F3 gate register and the accepted capability record linked below.
STATUS:    ACCEPTED and SHIPPED 2026-10-17. The owner authorized closeout after independent
           implementation review accepted the whole slice; review corrections landed at
           84671384, f94e77af, b2bfed5b, 0a530a95 and ff5a14da (the rebased successors of
           575050e0, 9b18a20c, 156b3a17, 9fb1be6c and 70dee4a3), with no open in-scope finding.
           `F3.channels@1:camera-handoff-v1` is accepted. Routine `slice-closeout` compacted the
           plan to a stub and wrote this evidence record; no criterion was inferred from skill
           invocation or green tests alone.
ROLE:      acceptance outcome and preservation route for T3.P01.S06.
NOT:       product contract · plan · status store · authority for declined or residual capabilities.
```

## Delivered and accepted

The second half of the approved `T3.P01.S03` split: the complete F3 `camera-handoff-v1` ownership
protocol, the one shared Experience lowering and interpreter over `ExecutionProgram@1`, the
framework-free semantic companion, and the guided/free/reduced-motion profile controllers. The
accepted capability is [`F3.channels@1:camera-handoff-v1`](./capability-camera-handoff-v1.md).

Product evidence is at tested revision `ff5a14da` — `70dee4a3` rebased onto post-#140 `main`
(`279e1340`); the only conflict resolution was the `units/index.ts` union of S05's and S06's export
blocks. PR [#141](https://github.com/Biskiq/spatial-sketch-editor/pull/141), branch `T3-P01-S06`.
Everything stays inactive: no editor route, host, Stage, visitor bootstrap or source imports the
runtime or the handoff.

Review corrections are part of this acceptance: effects bind to the run's actual approach and
lowering order to the selected Guide; gapped paths keep the panel and the return obligation;
late arrivals cannot reissue a Camera write; an authoring jump or detour whose Travel starts at
another Stop refuses instead of borrowing a connection; an arrival-time selection cannot place
another Presentation's content in the active panel; and a completed or cancelled run is final —
every event except `reset` is ignored without effects and the terminal phase cannot flip.

## Evidence and route

Independent review of the whole slice reached ACCEPT after the correction rounds above, and the
coordinator reviewed the same diff. Every finding is fixed at the tested revision with a regression
that fails on the previous behavior.

Recorded verification at `ff5a14da`:

```text
checks            check:project-model · check:camera-core · check (svelte-check 0 errors, 0 warnings)
focused           8 files / 142 tests — experience-runtime 42, experience-controllers 5,
                  camera-handoff 13, channels-conformance 22, camera-output-conformance 11,
                  camera-position-path 11, camera-motion 32, camera-motion-timing 6
editor full lane  158 files / 2099 tests
arch lane         20 files / 161 tests
heavy lane        8 files / 118 tests
```

No manual-owed acceptance row is recorded. The architecture-integration route remains
[T3.P01.S04](../t3.p01.s04-live-ownership-cutover/implementation-plan.md); the runtime and handoff
modules are inactive and no product source reaches them.

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
                 apps/editor/tests/lib/project-model/channels-conformance.test.ts
                 apps/editor/tests/lib/project-model/camera-output-conformance.test.ts
plan / routing   ./implementation-plan.md (closed stub) · ../README.md · ../../../README.md#gate-register
```

## Residuals

```text
integration     architecture-integration route is T3.P01.S04; runtime and handoff are inactive
invocation      Experience@1 carries no authored Cut/Travel selector; lowering takes a closed binding
                set, and an authored home (or a profiles-only decision) is a pre-S04 decision
authored inputs  presentation text, invocation bindings, state, lifecycle and channel policy are
                closed-fixture inputs with no authored F2 home; no host may inject them
timing          hold/Gate time starts at editorial arrival; whether a hold waits for Camera-confirmed
                arrival is a T3.P01.S04 activation decision, and `traveling`/`arrived` stay reserved
policy          the per-edge transition table is preparation output, not an `ExecutionProgram@1`
                field; the program codec is unamended
selection       a `show-content` selection for another Presentation's content arrives with the
                matching content only and emits a typed gap; it is not a refusal
reset           `reset` rewinds the same run (`runId`/`runEpoch` unchanged); starting a new run is
                the host's new-run path
```

## Recovery and P1 merge requirement

```text
full approved plan:
  git show ff5a14da02f9b1151b9156f1b1df3cb164235ea3:docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s06-experience-runtime-and-camera-handoff/implementation-plan.md

REQUIRED MERGE METHOD — P1: merge commit (no squash, no rebase), so the plan anchor and this
record's history remain reachable on `main`. Post-merge, verify the anchor is an ancestor of `main`
and the recovery read succeeds.
anchor ff5a14da02f9b1151b9156f1b1df3cb164235ea3 · tag `closed/T3.P01.S06` (created at this close;
pushed).
```

## Closed-work preservation report

```text
CLOSEOUT PRESERVATION — T3.P01.S06 (2026-10-17)
prose compacted:                 2   implementation-plan.md and this acceptance record; stubs at original paths
reference promotions:            0   capability truth sits in the gate register + the capability record
renderable evidence archived:    0 files / 0 bytes
evidence stubs / manifests:      0
transient artifacts removed:     0
historical anchor:               ff5a14da02f9b1151b9156f1b1df3cb164235ea3 · closed/T3.P01.S06 (pushed)
new live → archive prose links:  0
manual-owed verification rows:   0
remaining deferred items:        7 (S04 integration; authored invocation selector; closed-fixture
                                 presentation text/state/lifecycle/channel policy; confirmed-arrival
                                 hold timing; transition-table portability; foreign-content selection
                                 gap; reset-is-same-run host contract)
permanent stubs added:           2   (owner-ratified one-per-compacted-prose-artifact cost)
required merge method:           merge commit (P1), no squash/rebase; post-merge anchor check owed
```
