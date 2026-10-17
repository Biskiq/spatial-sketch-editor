# T1.P01.S07 — Stage↔F4 integration bridge: implementation plan

**Slice:** T1.P01.S07 · **Status:** in-progress — owner-authorized 2026-10-17 (D1–D4,
[record](../../../../reference/decisions/next-batch-authorization-2026-10-17.md)); the host wiring and
the owner-approved AM-5 completion are implemented with lane and browser evidence, the merge-revision
gate and independent slice acceptance are still withheld ·
**Phase:** [T1.P01](../README.md) · [slice register](../README.md#slice-register) · **Track:**
[T1](../../README.md) · **Runbook:** [T1 operations](../../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F3.channels@1, F4.intent-acceptance@1
REQUIRES: F1.reference@1:references-v1, F3.channels@1:inspection-v1, F4.intent-acceptance@1:local-single-domain-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t1.p01.s06-integrated-final-gate/implementation-plan.md
```

The slice ID is allocation order, not execution order: S07 runs **before** S04, S05 and S06.

**Engineering principle.** Exercise ambitious independent engineering judgment: challenge
assumptions, investigate missing invariants and cross-system failure modes, pursue stronger or
simpler solutions, and resolve demonstrated defects without speculative abstractions or
unauthorized contract changes.

## Why this slice exists

Before ruling D1, the route was as follows. `T1.P01.S02` shipped under owner-override, and its
acceptance kept
`T1.viewport-projection@1:viewport-projection-v1` `ratified` "pending S06's integrated result". S04,
S05 and S06 each `Require` that capability, and S06 cannot start before S01–S05 are accepted. The
viewport capability therefore waits for S06, which waits for S04/S05, which wait for the capability:
a cycle no consumer (T1 or `T2.P01.S03`) can enter. This slice is the smallest route out. It does
the provider-side integration S02's narrowed tier deferred and records the capability's acceptance
evidence independently of the phase final gate — which is what S02's own approved plan specified
("record seam acceptance independently of the phase final gate"). S06 stays the phase's exhaustive
final gate; it stops being the viewport readiness route.

The slice does **not** consume `T1.viewport-projection@1`. It completes and proves the scope the gate's
sole provider, `T1.P01.S02`, authored. A consumer cannot supply its own prerequisite, so S07 must
never declare the gate it makes ready.

## Prerequisite

`F1.reference@1:references-v1`, `F3.channels@1:inspection-v1` and
`F4.intent-acceptance@1:local-single-domain-v1` (with `acceptance-invariants-v1`) are accepted at
`ee463d0b`/`8ec0c5f1`, ancestors of current `main`. S02's shipped host, Stage and viewport code is on
`main` (PR #128). No T2, T3 or T4 output is consumed.

## Produces

1. The live **host↔F4 wiring** assigned to "S04's first increment by default" by the
   [2026-10-16 decision](../../../../reference/decisions/parallel-slice-authorization-2026-10-16.md),
   moved here by owner ruling D2.
2. The adapter contribution points AM-5 already ratifies but the landed seam lacks.
3. The recorded acceptance evidence for `T1.viewport-projection@1:viewport-projection-v1`, provider
   `T1.P01.S02`, on the then-current `main`.

No new gate, gate version, capability scope, F amendment or authored format.

## Scope

**Host↔F4 wiring.** One editor host owns one `createAcceptanceCoordinator` per project epoch.

- An accepted install replaces the Stage read snapshot through the single accepted-source slot:
  S02's composed snapshot gives way to the AM-4 `AcceptedSnapshot@1` export without renaming consumers.
- Undo and Redo are host commands through the shared boundary. The Head's history controls become
  live, and unavailability keeps a visible reason (live proposal, empty stack).
- Project replacement starts a new history baseline under a new epoch. Prior-epoch acceptance,
  history and Camera completions cannot install.
- Selection **requalifies through accepted correspondence** on install
  ([interfaces](../interfaces.md#viewport-projection-v1)). It is not cleared wholesale, and it is not
  re-resolved by coordinate. A subject that no longer exists clears with a reason.
- The inspection Camera output rebases on every content change and re-acquires at the same pose
  without moving or refitting the view. This is the path S02 proved only by injecting a source in a
  test; here a real F4 accept drives it.

**Adapter lifetime across installs.** The landed `installAccepted` ends every adapter registration on a
content change, because a domain adapter binds to the source it was built from. With live editing
that would tear down every T2/T3 adapter after each accepted edit. Replace this with host-owned
re-binding: an adapter registers a factory, and the host rebuilds it for each accepted snapshot and
disposes the previous binding exactly once. Replacement still disposes everything.

**Contribution points (AM-5 completion, no amendment).** AM-5's `registerStageAdapter` ratifies an
"explicit task/instrument factory and disposer". Its selection-and-tasks rule lets adapters "offer
Card facts and precision writers". The landed `StageAdapter` exposes only overlay, graphics, hit
provider and selection echo, and the instrument host is composed directly by the route. Add the
missing registration points so a domain adapter contributes, without editing shell or route modules:

- a task/instrument factory mounted in the one `StageInstrumentHost`;
- Card facts for its own subjects;
- the PLATE rail-family/capability-Find entries that invoke its tasks, such as a Place item or a
  measure operation.

Entries carry their owning adapter ID and order deterministically. Unknown required capabilities
still refuse mounting. If a needed contribution cannot be expressed inside AM-5's ratified meaning,
stop and report: that is an F amendment, not provider latitude.

**Out of scope.** No Layout or Scene production writer: precision, plinth and Wall manipulation stay
in S04/S05, and Scene placement in `T2.P01.S03`. The Head Save integration stays with S04 (ruling D3). There
is no Plan-cut drawing (still unassigned), no new Plan family property and no Camera authoring. The
[conformance Layout planner](../t1.p01.s03-local-acceptance-and-history-foundation/implementation-plan.md)
is the only writer, and only in tests.

## Shared files

S07 is the sole writer of the editor route, host, Stage and shell modules and of `camera-core`'s
existing modules for its duration. The project-model `src/f4/**` module and the editor
`authoring/f4/**` coordinator are consumed through their public exports. A needed change to either
is additive and coordinated with `T3.P01.S03` under the
[batch protocol](../../../cross-track-execution.md#authorized-batch-2026-10-17). Barrels and the test-lane
list change by appending only.

## Acceptance criteria

- **Real accepted install.** A test-only T2-style adapter submits a stub planner intent through the
  live coordinator. Exactly one install occurs, with the view pose unchanged and the claim
  re-acquired. Selection requalifies to the surviving subject. The adapter is re-bound once, and its
  previous binding is disposed once. Identical content leaves the claim in place.
- **History.** Undo/Redo through host commands reverts exactly the latest accepted result, across
  mixed Layout/Scene conformance planners. A live proposal makes Undo unavailable with a reason.
  Navigation, reading changes and focus create no history.
- **Replacement.** Replacement yields a new baseline and an empty stack. Prior-epoch accepts, loads,
  gestures and Camera completions cannot install.
- **Contributions.** A T3-style probe mounts and unmounts an instrument through the factory without
  moving the Camera. A Card fact and a Find entry contributed by a probe adapter appear and disappear
  with its registration. No probe imports private Stage state.
- **Mutation controls.** Clearing selection on install, skipping the rebind or installing a
  prior-epoch result makes the relevant test fail.
- **Seam conformance on the integrated tree.** The [AM-5 probe table](../interfaces.md#viewport-projection-v1)
  re-runs on the merged tree. That covers projection/inverse, Layout correspondence, T2/T3-style
  consumers, replacement/lifetime and shell/isolation. The arch lane's visitor/public/preview
  boundaries also run.
- **Complete merge gate on the then-current `main`.** This is the gate S02's override waived as an
  acceptance prerequisite. It is recorded with revision, not inherited. Browser evidence covers
  edit → Undo/Redo → replacement in both readings on the starter project, using the conformance planner
  through a test-only route hook if no production writer exists, with the hook absent from production
  chunks. Unobserved items are disclosed and not claimed.

## Capability outcome (closeout consequence, not planned here)

Once independent review accepts this slice, routine closeout writes the durable
`viewport-projection-v1` capability record and moves `T1.viewport-projection@1` to `accepted`. The
provider slice stays `T1.P01.S02`. The record names this slice's acceptance and an ancestor commit,
following the register legend. Consumers become eligible only at a trusted base that contains that
merge.

## Architecture cycle

S07 is **not** a listed exposure. The T1.P01 window already holds the maximum of three (S02, S04,
S05), and adding one is an owner amendment, never an automatic fourth. Its start runs the runbook's
one-line cycle check and opens nothing, since the window is already open. S07 has no production
Layout writer, so M1/M2 exposure stays S04's. Its replacement-baseline evidence is ordinary regression
proof, and M5's composed exposure stays S05's.

## Readiness declaration

This slice is **authorized** (owner, 2026-10-17) and **in progress**. Its prerequisites are accepted on
`main`, and implementation started from `main` at `fcf1fbaa` through the T1 runbook's start step (the
eligibility row is `in-progress` and the one-line cycle check opens nothing: S07 is not a listed
exposure). The host wiring, adapter re-binding and contribution points are committed and independently
reviewed; the owner approved the [bounded AM-5 completion](./am5-reconciliation.md), which is
implemented on the branch: the source-independent accepted read, ordered F.1 selection with one
primary, and the lens/task parking and explicit revalidated Resume. Focused suites, the arch lane, the
full editor suite and a browser session in both readings cover it, and the production build excludes
every probe sentinel — all recorded in [acceptance.md](./acceptance.md) with
[browser evidence](./evidence/browser-actions.json).

The AM-5 increment is committed at `a67793e4` with review fixes through `933bf285` and was reviewed
in three rounds, but the complete gate has not run at a merge revision (API suites included). S07 therefore remains **unaccepted**: the actual
merge-revision gate, fresh independent review of the increment and of the PR head, independent slice
acceptance and routine closeout remain required; the viewport capability stays ratified.
