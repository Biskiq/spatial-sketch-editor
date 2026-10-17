# T3.P01.S06 — Experience runtime and Camera handoff: implementation plan

**Slice:** T3.P01.S06 · **Status:** in-progress — owner-authorized 2026-10-17
([record](../../../../reference/decisions/s03-split-followup-authorization-2026-10-17.md)) · **Phase:** [T3.P01](../README.md) ·
[slice register](../README.md#slice-register) · **Track:** [T3](../../README.md) · **Runbook:**
[T3 operations](../../../../operations/t3-experience/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F3.channels@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F3.channels@1:inspection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t3.p01.s04-live-ownership-cutover/implementation-plan.md
```

**Engineering principle.** Exercise independent engineering judgment: challenge assumptions,
investigate missing invariants and cross-system failure modes, pursue stronger or simpler solutions,
and resolve demonstrated defects without speculative abstractions or unauthorized contract changes.

## Prerequisite

S01, S02 and the landed F3 provider accepted at this slice's trusted base. Every required scope is
`active` at post-PR #139 `main` (`d2607caf`): `unit-envelope-v1`/`unit-resolution-v1` at `6dcb6d6d`,
`inspection-v1` at `ee463d0b`. The program codec (`@portfolio/project-model/program`) is part of the
accepted F.2 delivery entry; this slice imports it only and defines no second program.

The split of `T3.P01.S03` is recorded in
[the approved split proposal](../t3.p01.s03-compound-and-runtime-preparation/split-proposal.md) and
[the follow-up authorization record](../../../../reference/decisions/s03-split-followup-authorization-2026-10-17.md).
S03 stays the in-progress umbrella; this slice owns the original F3 handoff and Experience-runtime
obligations. S05 owns unit acceptance and unit Save and this slice consumes none of its output.

## Scope

Complete the F3 `camera-handoff-v1` capability and prepare the one shared Experience runtime against
closed fixtures. Everything is inactive: no editor route, host, Stage, visitor bootstrap or source
reads it, and no source/runtime cutover happens here.

1. **`camera-handoff-v1`.** Complete the role half already landed over the F3 ticket protocol with
   guided and free ownership, Follow, Look-through, Preview, return and stale-run cleanup. One
   output has one owner; a handoff is a declared ordered transfer that issues exactly one return
   obligation; cleanup is epoch-qualified and cannot clear or replace a newer run; a stale event from
   an ended run is rejected, never replayed. No second OrbitControls pose writer, no Experience route
   search and no pose/FOV interpolation. The module exports the scope constant only when the whole
   allocated meaning exists.
2. **Experience lowering.** Lower one selected Experience plus its Camera unit to the accepted
   `ExecutionProgram@1` codec: labelled Presentations and content records, stable Stop occurrences,
   Camera invocation bindings, finite holds, explicit continuation, guards, channel policies,
   lifecycle actions and the required reduced-motion/semantic-DOM profile. Lowering selects an
   authored Guide (the entry guide by default); an explicit `order` is admitted only when it equals
   that Guide's `stopIds` exactly, so no caller can reorder, drop, mix or invent an editorial
   sequence. It validates Experience→Presentation→View and Camera connection closure through F.1/unit
   resolution and refuses an unsupported or missing binding. It copies no pose, path, FOV, graph,
   renderer object or source history into the program.
3. **One interpreter.** A deterministic reducer plus an explicit integer clock executes the lowered
   program: fresh run identity per visit, sequence-next/explicit Stop/End continuation, finite holds
   with Continue, boolean/choice state with initial/reset and literal/state/equality/conjunction
   guards, covered detour and return-to-origin, and the run-scoped `enter`/`arrival`/`complete`/
   `cancel` events with `show-content`/`navigate-to`/`open-url`/`continue`/`set-state` actions. A
   covered detour returns to its origin occurrence before resolving **any** continuation kind, and a
   lifecycle `show-content` applied before a panel exists is deferred to the arrival that creates it
   rather than dropped; a lifecycle `continue` resolves the occurrence once, only when it is ready
   (never through a hold or a Gate), and is explicitly ignored where no occurrence can advance.
   Occurrence identity is never an array index, label, Room or Camera view id. A run also carries the
   lowering source identity: an event prepared from a different source is stale and cannot advance
   the run. The same required instruction means the same thing in Preview and publication; an
   unsupported required program, state, operator or profile refuses.
4. **Semantic companion.** A framework-free DOM/Info-Panel view model: current presentation label and
   text content, every admitted destination reachable by keyboard/DOM navigation, occurrence-derived
   `aria-current`/progress, repair/gap explanations with useful labels and links, panel focus-in/
   Escape/return, and no raycast dependency. It exposes the one explicit Continue control a Gate
   needs (availability, label, reason, and the occurrence it advances), clears the current
   destination and bounds progress when the run ends or a Stop repeats. It contains no editor
   selection, history or gizmo state.
5. **Profile controllers.** Guided, free and reduced-motion controllers in new `camera-core` modules
   that realize Camera intents through the existing Camera authority: guided evaluates route/timing
   and holds, free releases guided ownership and rejoin evaluates from the actual current pose with
   autoplay paused, reduced motion reaches the same destinations without accelerated travel. A
   missing route is a reported gap, never an implicit Cut; a Cut realizes a resolved View without
   travel.
6. **Traces.** Closed AM-6 trace fixtures cover repeated Stops/runs, initialization/reset, guard
   failure, finite hold/Continue, directed travel and a travel gap, Cut, detour return, ownership
   handoff and stale-event cleanup.

## Camera and Experience authority

Camera remains the sole owner of view eye/target/FOV, framing, projection, connectivity, route
geometry, intrinsic directed timing and evaluation. Experience owns editorial order, Stops, holds,
continuation, gates, detour policy and invocation time mapping. The interpreter emits Camera intents
and consumes Camera samples; it never lerps pose/FOV, never searches the Camera graph and never
writes a second animation or navigation timeline. Renderer cameras realize evaluated output only.

## Declared interface decision: invocation bindings

The ratified F.2 `ExperienceStop` carries order, hold and continuation but **no authored Camera
invocation selector** (Cut versus Travel). This slice therefore does not infer one. Lowering takes an
explicit, closed binding set (`cut` for a resolved View, `travel` for a real Camera connection) and
refuses a missing binding for a non-entry Stop rather than defaulting to Cut. The binding is runtime
preparation input, not a second persisted format and not an Experience-owned camera graph. Recording
an authored invocation selector is a contract decision for `T3.P01.S04`/`T3.P02`; it is named as a
residual in the acceptance record and must be resolved before activation. No F2 shape is changed
here.

Two further inputs follow from the same ratified minimum. `ExperiencePresentation` has no text
content field, so lowering takes a closed presentation-content record set; and `ExecutionProgram@1`
has no Gate or detour slot, so the interpreter takes them as policy. Gate and detour policy is
**derived from the authored Experience** (`deriveExperienceRuntimePolicy`) and refuses a dangling
identity; only presentation text has no authored home at all. All three are disclosed activation
gaps for S04/T3.P02, not new formats, and none of them changes F2, the program codec or the Camera
authority.

The remaining lowering inputs — `state` declarations, `lifecycle` actions, `channels`/`capabilities`
and invocation bindings — are **closed-fixture declarations only**. They exist so the runtime can be
prepared and traced before F2 carries an authored home for them; no host, route or visitor
bootstrap may author or inject them, and this slice adds no persisted slot for them. They are
activation gaps owned by `T3.P01.S04`/`T3.P02`, not a second authoring surface.

## Explicit non-goals

- No source/runtime activation, editor Preview route, Stage capture, host wiring or visitor bootstrap
  edit; no live program execution in the product.
- No unit acceptance, candidate planning or Save (`T3.P01.S05`); no second Save or writer.
- No F2/F3/F4 contract or persisted-format change; `ExecutionProgram@1` is used exactly as accepted.
- No second Camera evaluator, route search in Experience, OrbitControls pose writer, animation system
  or scene renderer.

## Criteria and evidence

| Original S03 obligation | This slice's evidence |
| --- | --- |
| `camera-handoff-v1` with guided/free ownership, Follow, Look-through, Preview, return and stale cleanup | Conformance: one owner per output; guided→follow→preview→return unwinds in order; return refuses a wrong token/source/session; cancel after replacement is ignored; a stale run cannot clear, reclaim or advance the newer output; source rebase ends the claim. |
| Shared lowering/interpreter using the accepted codec | Lowered fixtures validate against `validateExecutionProgram`; every binding resolves or refuses; a supplied order that is not an authored Guide order refuses; no pose/path copy; lowering is deterministic and replayable. |
| Deterministic reducer/clock, occurrence holds, continuation | Replay from identical events produces identical state; clock is explicit; repeated Stop visits get fresh run ids; hold boundaries, sequence-next, nonadjacent Stop, End and detour return resolve by occurrence. |
| Minimal guard/Continue/detour state | Guard failure skips the guarded action; Continue is explicit at a gate/hold; lifecycle `continue` advances a ready occurrence once and is ignored through a hold or Gate; `show-content` before a panel is deferred to its arrival; state initializes/resets and choice values are bounded; every detour returns to its origin occurrence regardless of the target's continuation kind. |
| Semantic DOM companion/Info Panel | Every admitted destination is keyboard/DOM-reachable with the same Activate meaning; `aria-current`/progress are occurrence-derived and bounded; a Gate exposes an explicit Continue control with its reason; panel focus-in/Escape/return and gap explanations work without raycast. |
| Guided/free/reduced-motion controllers against closed fixtures | Guided plays supported travel with directed timing; a gap reports; free releases guided control and rejoin pauses autoplay; reduced motion reaches the same destination without accelerated travel. |
| Required AM-6 traces and stale-event behavior | The trace fixture set above, asserting ordered events/checkpoints, not implementation snapshots; a stale event from an ended run or a different lowering source cannot advance, complete or clear the newer run. |
| No second Camera/Experience authority | Import/closures prove Camera owns route/motion/evaluation; Experience code has no BFS, no pose/FOV interpolation and no second timeline. |

## Verification

Tier: **architecture-integration** (integration route `T3.P01.S04`). Run on the tested commit and
record exact results in [acceptance.md](./acceptance.md):

- `npm run check:project-model`, `npm run check:camera-core`, `npm run check` (editor);
- the focused experience/handoff/controller conformance files and affected whole contracts,
  including the existing `camera-output-conformance`, `channels-conformance` and camera route/motion
  suites;
- `npm run test:arch` whole (F.2/F.3 inactivity, camera-core boundary, program closure);
- `npm run test` and the heavy camera dense sweeps when a Camera module changes
  (`npm run test:heavy`);
- no DB evidence is claimed by this slice; it adds no Save or API change.

## Residuals and handoff obligations

- Everything stays inactive at acceptance. `T3.P01.S04` owns activation, the Stage/Preview caller
  integration, source migration and the retirement of the current visitor orchestration.
- The authored invocation selector is unresolved by the ratified F2 shape and must be decided before
  S04 activation; the lowering's explicit binding input is the disclosed interim contract.
- Presentation text, invocation bindings, state declarations, lifecycle actions and channel/
  capability policy have no authored F2 home; they remain closed-fixture inputs, must not be
  host-authored, and need an authored home (or a deliberate profiles-only decision) before S04
  activation.
- `camera-handoff-v1` is recorded at acceptance only with the whole role/ownership meaning; the
  partial module landed in PR #138 is not acceptance evidence on its own.
