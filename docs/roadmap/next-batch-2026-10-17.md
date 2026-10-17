# Next parallel batch — coordination proposal (2026-10-17)

**Status:** **proposed — pending owner decision.** Nothing in this document is owner-ratified,
registered or authorized. It changes no gate state, ratified contract, accepted record or cycle
state. Every "D" below is a recommendation with an empty owner-ruling cell. Implementation starts
only after the owner records rulings and the [ratification checklist](#ratification-checklist) has
been applied in a reviewed docs PR.

**Basis:** `main` at `c9aa53cf` (post-PR #135; PR #128 `T1.P01.S02` and PR #134 `T2.P01.S02`
merged). Authorities read: the [gate register](./README.md#gate-register), the four phase registers,
the batons, the [cross-track allocation](./cross-track-execution.md), AM-4/AM-5/AM-8, and the S02
acceptance records. The S02 Stage code was checked only where a doc claim needed evidence.

## Findings

### Current state (verified)

| Track | Shipped | Next candidate | Blocking fact |
| --- | --- | --- | --- |
| T1 | S01, S02 (owner-override), S03 | S04 → S05 → S06 | `T1.viewport-projection@1` is `ratified`, with provider `T1.P01.S02` and no accepted capability. |
| T2 | S01, S02 | S03, then S04 | S03 requires `viewport-projection-v1` and the host↔F4 wiring. |
| T3 | S01, S02 | S03 | None. Every required scope is `active` at ancestors of `main`. |
| T4 | — | first phase | No phase registered. F5 and `T4.prepared-reader` are `undrafted`. |

### F-1: the T1 viewport readiness route is a cycle

The S02 owner override kept `viewport-projection-v1` `ratified` "pending S06's integrated result". S04,
S05 and S06 all `Require` that capability, and S06's plan needs S01–S05 accepted first:

```text
viewport-projection-v1 accepted ← S06 integrated result ← S04, S05 accepted ← viewport-projection-v1 accepted
```

No T1 slice and no T2 consumer can become eligible. S06 cannot accept the capability either:
it consumes the capability itself, and the readiness rule forbids self-satisfaction. S02's own
approved plan intended the opposite: "Record seam acceptance independently of the phase final gate."
The coupling to S06 is an artifact of the override's wording, not a design requirement.

### F-2: the landed seam is short of AM-5 where consumers need it

These facts come from inspection of `apps/editor/src/lib/authoring/stage/`.

- AM-5's `registerStageAdapter` ratifies an "explicit task/instrument factory and disposer". Its
  selection-and-tasks row lets adapters "offer Card facts and precision writers". The landed
  `StageAdapter` has only `overlay`, `graphics`, `hitProvider` and `selectionEcho`.
  `StageInstrumentHost` content is composed by the route through a snippet.
- `installAccepted` ends **every** adapter registration and clears selection on any content change.
  It was proven only by injecting a source in a test, because no editing command existed. With live
  editing, each accepted edit would tear down every domain adapter. Selection would be dropped, where
  the interfaces require requalification through accepted correspondence.

So a consumer cannot mount a Place/Find/Card/instrument contribution without editing host and route
modules. Accepting the capability as-is would admit consumers onto a seam that cannot carry them.

### F-3: S04 and T2.S03 would co-write the same shell modules

Both need Place-family items, capability-Find entries, Card facts and a World Instrument. S04 adds the
Layout plinth, Dimensions and the name writer. T2.S03 adds Scene placement, Move/Yaw and exact X/Z.
Today those can only be added by editing the shared route and shell, and the default wiring owner
(S04's first increment) serializes T2.S03 behind all of S04, including its precision tools and the
Head Save integration.

## T1 options evaluated

| Option | Effect | Verdict |
| --- | --- | --- |
| **A. Narrow bridge slice `T1.P01.S07`** (wiring, adapter re-binding, AM-5 contribution points, seam conformance plus full merge gate on current `main`) whose acceptance records `viewport-projection-v1` | Breaks the cycle with one new proposed slice. Provider stays `T1.P01.S02`. S02 acceptance is untouched. S06 stays the exhaustive final gate. S04 and T2.S03 become parallel after S07. | **Recommended** |
| B. Revise S04–S06 boundaries: drop the viewport `Requires` from T1-internal slices and let S06 accept the capability | S06 would consume and accept its own prerequisite, which the readiness rule forbids. T2.S03 would wait for all of T1.P01, contradicting "T2/T3 UI waits for the viewport, not all of T1". | Rejected |
| C. Accept the capability now on re-run evidence, with no code, and keep the wiring in S04 | Admits consumers onto a seam missing AM-5's contribution points and install semantics (F-2). Keeps T2.S03 serialized behind all of S04 (F-3). | Rejected |
| D. Move the wiring into T2.S03 | Puts T1-owned host machinery in a T2 slice, and T1 S04 would then wait on T2. It splits one shell owner. | Rejected |

Option A preserves the sole-provider rule, S02's acceptance and the T1 cycle window, which keeps its
three exposures and is not enlarged. The scope is in the [S07 plan](./t1-spatial-world/t1.p01-stage-foundation/t1.p01.s07-stage-f4-integration-bridge/implementation-plan.md).

## Proposed decisions

| # | Proposed decision | Why | Owner ruling |
| --- | --- | --- | --- |
| D1 | **Viewport readiness route.** Register `T1.P01.S07` (Stage↔F4 integration bridge) in T1.P01. Its independently reviewed acceptance, with the complete merge gate on then-current `main`, records `T1.viewport-projection@1:viewport-projection-v1`, with `T1.P01.S02` as the unchanged sole provider. S06 remains the exhaustive `FINAL PHASE GATE` and is no longer the viewport readiness route. S02's acceptance record is not reopened or edited. | F-1, F-2. This restores S02's original plan intent with the smallest DAG change. | — |
| D2 | **Wiring owner.** Assign the host↔F4 wiring explicitly to S07, which the 2026-10-16 record lets the owner do. S07 also completes the AM-5 adapter contribution points and adapter re-binding, and it gets no Layout or Scene production writer. | F-2, F-3. It is never built twice. | — |
| D3 | **Head Save integration** stays with `T1.P01.S04`, named under the [2026-10-16 decision 1](../reference/decisions/s02-pair-authorization-2026-10-16.md) remaining-decision mechanism. `conditional-save-current-v1` joins S04's `Requires` at S04's authorization. It still precedes `T2.P01.S04`. | It keeps the critical-path bridge narrow. S04 is T1's first Head-bearing surface. | — |
| D4 | **Authorize `T1.P01.S07`** (batch A). It is not a cycle exposure, since the window is at its bound of three. | Prerequisites are accepted on `main`. | — |
| D5 | **Authorize `T3.P01.S03`** (batch A), under the [batch A protocol](./cross-track-execution.md#proposed-batch-2026-10-17), with the split-on-discovery clause. | The prerequisite closure is verified, and it is independent of T1 viewport work ([below](#t3p01s03-verification)). | — |
| D6 | **Register T4.P01** from the [registration draft](./t4-release/t4.p01-prepared-release-foundation/README.md), with all slices `proposed`. T4 moves from `planning` to `approved`. No gate changes state. | Registration is lifecycle only and authorizes nothing. | — |
| D7 | **Authorize `T4.P01.S01`** (docs-only delivery specification, batch A). | It consumes nothing and writes only T4 docs. | — |
| D8 | *Not requested now.* Ratify F5@1 from S01's draft before any `T4.P01.S02` authorization. | It mirrors the viewport precedent (shape approval before provider acceptance). | deferred |
| — | *Not requested now.* Authorize batch B (`T1.P01.S04`, `T2.P01.S03`). | Blocked until S07 ships and `viewport-projection-v1` is accepted ([conditions](#t2p01s03-launch-conditions)). | deferred |

## T3.P01.S03 verification

Each required scope is `active` and was accepted at an ancestor of `c9aa53cf`:

- `references-v1` at `ee463d0b`;
- `unit-envelope-v1` and `unit-resolution-v1` at `6dcb6d6d`;
- `inspection-v1` at `ee463d0b`;
- `local-single-domain-v1` with `acceptance-invariants-v1` at `8ec0c5f1`;
- `conditional-save-current-v1` at `8dd53260`.

S03 consumes no viewport, editor route, host or Stage module, and Stage capture/Preview belongs to the
candidate T3.P02. It is independent of T1's cycle in both directions. Its real overlap with S07 is
file-level: F4 internals, the F3 channel/ticket protocol, and `camera-core`. The batch A protocol
settles those with additive-only rules. Its `camera-handoff-v1` output is what `T4.P01.S03/S04` later
need, so it sits on T4's critical path, not T1's.

## T4 registration versus authorization

Registration (D6) creates lifecycle rows and the phase README. It gives no slice permission, and F5
stays `undrafted`, so no `Provider slice` is wired. Authorization (D7) admits only S01's documents.
F5@1 ratification (D8) is a third, later decision. The draft records which statements of the
2026-10-14 proposal are superseded by the 2026-10-15 ratification and accepted providers.

## T2.P01.S03 launch conditions

T2.S03 starts only when **all** of the following hold. None holds by virtue of this proposal.

1. **Owner authorization** of T2.S03, with its row at `approved`. This is batch B, not requested now.
2. **`T1.viewport-projection@1` is `accepted`**, with `viewport-projection-v1` `active`, in the tree
   and at T2.S03's trusted base.
3. **`T1.P01.S07` is shipped on that base.** The wiring, adapter re-binding and contribution points
   are on `main`.
4. `local-single-domain-v1` stays active and `T2.P01.S02` stays shipped. Both hold today.
5. If T2.S03 runs alongside `T1.P01.S04`, the batch B shared-file rules apply.

T2.S03 does not wait for S04's precision tools, the Head Save integration, conditional Save or T1 phase
closure. Those gate `T2.P01.S04`.

## Merge order and genuine parallelism

```text
APPROVAL → batch A, in parallel, no imposed merge order:
  T1.P01.S07  (critical path for T1 S04 and T2 S03)
  T3.P01.S03  (critical path for T3 S04 and T4 S03/S04)
  T4.P01.S01  (docs; feeds the F5@1 ratification)
S07 merged + viewport-projection-v1 accepted → batch B (owner-authorized separately):
  T1.P01.S04 ∥ T2.P01.S03
then T1.P01.S05; T2.P01.S04 after T2.S03 + T1 S04's Head Save; T1.P01.S06 last
```

Each merge reruns the full gate on then-current `main`. If T3.S03 merges first and changes the
channel module, S07 reruns its seam probes before merging. Gate-register edits touch distinct rows.

## Concrete next-batch handoff (after approval)

| Task | Route | Start step | Done means |
| --- | --- | --- | --- |
| `T1.P01.S07` | [T1 baton](../operations/t1-spatial-world/current.md) → [T1.P01](./t1-spatial-world/t1.p01-stage-foundation/README.md) → [S07 plan](./t1-spatial-world/t1.p01-stage-foundation/t1.p01.s07-stage-f4-integration-bridge/implementation-plan.md) | T1 runbook start step (eligibility + one-line cycle check: not listed, so it opens nothing) | Independent review; closeout writes the `viewport-projection-v1` record and the gate goes `accepted` |
| `T3.P01.S03` | [T3 baton](../operations/t3-experience/current.md) → [T3.P01](./t3-experience/t3.p01-camera-experience-foundation/README.md) → [S03 plan](./t3-experience/t3.p01-camera-experience-foundation/t3.p01.s03-compound-and-runtime-preparation/implementation-plan.md) | T3 runbook start step | `unit-acceptance-v1`, `conditional-save-units-v1` and `camera-handoff-v1` accepted, with real-DB evidence at zero skips |
| `T4.P01.S01` | [T4 baton](../operations/t4-release/current.md) → T4.P01 README (after D6) → [S01 plan](./t4-release/t4.p01-prepared-release-foundation/t4.p01.s01-delivery-specification/implementation-plan.md) | T4 runbook start step | Reviewed F5@1 draft package ready for D8 |

## Ratification checklist

On owner approval, one reviewed docs commit applies only the rulings granted:

1. Copy the granted rows into a new `docs/reference/decisions/next-batch-authorization-2026-10-17.md`
   with owner and date. Fill the ruling column here and link the record.
2. **D1/D2/D4:** set the T1.P01 S07 row to `approved`, citing the record. Drop "pending" wording from
   the T1.P01 README, S04/S06/T2.S03 plans and the T1/T2 batons. Leave the gate register alone; it moves
   only at S07 closeout.
3. **D3:** record the Head Save assignment in the S04 plan. S04's `Requires` changes at S04's own
   authorization, not now.
4. **D5:** set the T3.P01 S03 row to `approved`.
5. **D6:** add the T4.P01 phase-register row; set T4 `approved` in the track register; turn the draft
   into the phase README (`## Slice register`, `FINAL PHASE GATE: T4.P01.S05 → …`, `Stage: active`);
   create S02–S05 plan/acceptance stubs; fix S01's `INTEGRATION ROUTE` to the S05 plan path.
   **D7:** set the S01 row to `approved` and add its acceptance stub.
6. Run the docs/arch gates (`tests/docs/*`) before merging.

## Remaining material decisions and risks

- **Plan-cut drawing** is still unassigned, from S02's residual. It is not on any critical path, and
  the owner assigns it when planning a later shell slice.
- **`T3.camera-experience-cutover@1`** is drafted with T3.S04's authorization request (R6). It gates
  T3.S04, T3.P02 and T4.S05.
- **T3.S03 size.** A registered split (unit Save versus runtime/handoff) is the owner's option if the
  implementer proposes it.
- **S07 contribution points might need an AM-5 change.** The implementer stops and reports; it is not
  provider latitude.
- **Release Baseline, publication gap and live inventory** stay separate, evidence-backed owner
  decisions (2026-10-15 disposition 6).

## Explicit non-implications

No slice, phase or track is registered or authorized by this proposal, and no gate, capability,
cycle state or ratified contract changes. The S02 acceptance record and its owner override stand
unedited. T1's exposure list is unchanged. Batch B is not authorized by approving batch A.
