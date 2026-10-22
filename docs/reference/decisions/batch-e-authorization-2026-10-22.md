# Batch E authorization: H0 (T3.P03), C1 and C2 registration, and the first-wave release

**Date:** October 22, 2026. **Status:** **owner-authorized 2026-10-22.** In the batch E planning
review of PR #174, the owner approved decisions E1–E7 as the
[coordination proposal](../../roadmap/next-batch-2026-10-22.md#owner-decisions) recommended them:
"I approve E1–E7 as recommended in PR #174, with E7 decided now and each start gated on T3.P03.S01
merging."

This record is decision provenance, like the [batch B](./batch-b-authorization-2026-10-17.md),
[batch C](./batch-c-authorization-2026-10-19.md) and [batch D](./batch-d-authorization-2026-10-20.md)
records. It ratifies no contract. AM-1–AM-9, PLATE, the
[convergence destination](./product-convergence-ratification-2026-10-22.md) and the
[performance contract](../components/performance.md) are unchanged. Lifecycle and gate identity stay
in the [roadmap register](../../roadmap/README.md#gate-register), and each slice's scope stays in its
own plan. The rules are in the
[batch E protocol](../../roadmap/cross-track-execution.md#authorized-batch-e-2026-10-22).

**Base.** `origin/main` `f516e1ffb2239aab9b230ae1f6af8ae1bd445d4d`, the merge commit of PR #173
(product convergence). The proposal and this record land together in PR #174.

Verified at this base:

- `F1.reference@1`, `F2.unit-envelope@1`, `F3.channels@1`, `F4.intent-acceptance@1`,
  `T1.viewport-projection@1` and `T3.camera-experience-cutover@1` are `accepted`.
- `unit-resolution-v1`, `unit-envelope-v1`, `unit-acceptance-v1`, `conditional-save-units-v1`,
  `camera-handoff-v1` and `viewport-projection-v1` are `active`.
- `T1.P01`, `T2.P01` and `T3.P01` are closed. `T3.P02` is registered, with S01 `approved` but held and
  unimplemented, and S02 `proposed`.
- The [production hold](../../roadmap/README.md#production-implementation-hold) covers every
  implementation scope.
- The architecture cycle is `PHASE_3_EVALUATE`, `owner-verdict-owed`.

## Decisions

| # | Decides | Scope | Not decided or authorized |
| --- | --- | --- | --- |
| E1 | Register `T3.P03`, `T1.P02` and `T2.P02` | Phase-register rows, phase READMEs with slice registers, final gates, `PHASE CLOSE Stage: active`, acceptance stubs and plans for every child | Any gate, version, capability entry or architecture-cycle window |
| E2 | Authorize `T3.P03.S01` and `T3.P03.S02`; release `T3.P03` from the hold | The two slice plans as written | Any product feature, source format or gate change |
| E3 | Accept the C1 drawing and enclosure policy | The five rules in [T1.P02](../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/README.md#drawing-and-enclosure-policy-owner-accepted-2026-10-22), as written | Nested courtyards, hole semantics and non-enclosing rings |
| E4 | Accept the C2 upload, retention and derivative bounds | [T2.P02](../../roadmap/t2-composition/t2.p02-own-model-import/README.md#upload-retention-and-derivative-bounds-owner-accepted-2026-10-22) S01 and S02 | Server-side derivative processing |
| E5 | Accept `T3.P02.S01`'s finalized convergence scope | The S01 plan's finalized scope, the Experience format draft and the shell draft's Preview entry rule | Settling the format draft's two open points (implementation review settles them) |
| E6 | Reference A hardware for hard performance rows | The owner designates a Reference A machine and its operator | A Reference B substitution, which would amend the ratified performance contract |
| E7 | Authorize `T1.P02.S01` and `T2.P02.S01`; release them and `T3.P02.S01` from the hold | Each starts only after `T3.P03.S01` merges | Every later child of the three phases, and `T3.P02.S02` |

## E1 — Three phases are registered

| Phase | Track | Children | Final gate |
| --- | --- | --- | --- |
| [`T3.P03` — Shared acceptance, isolation and measurement](../../roadmap/t3-experience/t3.p03-shared-acceptance-and-measurement/README.md) | T3 (H0) | S01 planner scope and build isolation, S02 measurement workflow and final gate | `T3.P03.S02` |
| [`T1.P02` — Native Wall creation](../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/README.md) | T1 (C1) | S01 Layout identity and format cutover, S02 draw/close/divide/delete, S03 Opening family, S04 integrated final gate | `T1.P02.S04` |
| [`T2.P02` — Own model import](../../roadmap/t2-composition/t2.p02-own-model-import/README.md) | T2 (C2) | S01 model resource storage and admission, S02 import/review/approve/place, S03 integrated final gate | `T2.P02.S03` |

The registration declares only consumers. Every child consumes accepted gates and requires active
scopes at the base above, and no child provides a gate. The registers carry the exact `Consumes` and
`Requires` cells. Each slice rechecks them at its own trusted base through its runbook's start step.

S02 and S03 of T1.P02 and S02 of T2.P02 are registered with outline plans. Each slice writes its
complete plan after its predecessor's acceptance, and that plan is reviewed with its own
authorization. The two final-gate plans are complete at registration because they are the phases'
integration routes.

## E2 — H0 is authorized and released

`T3.P03.S01` and `T3.P03.S02` are authorized exactly as planned, and `T3.P03` is released from the
hold.

- **S01** passes each planner's admission into validation, adds a compound planner's declared write
  set (the ratified F.4 destination), retargets the public/Preview boundary predicates to the
  authoring tree, and adds the Preview closure test.
- **S02** installs the authorized on-demand measurement workflow and bundle report, records a baseline
  and is the phase's exhaustive final gate.

S01 merges first. S02 may run in parallel with the released first-wave slices; it never blocks them.

## E3 — The C1 drawing and enclosure policy is accepted

The [five rules](../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/README.md#drawing-and-enclosure-policy-owner-accepted-2026-10-22)
are accepted as written:

1. Every closed ring encloses.
2. Roles follow geometry.
3. Connection is deliberate.
4. Crossings, collinear overlaps and unconnected nested rings refuse with a repair.
5. Deleting a Wall takes its Openings in the same undo step and leaves Experience and Camera
   references retained.

This settles the drawing questions the
[architecture destination](../architecture.md#product-convergence-destination) left to C1. Layout
format 6 removes the authored Wall `role` under the pre-baseline rule, which also settles the
"migrate existing `partition` Walls" question.

## E4 — The C2 bounds are accepted

- **Upload size.** A source file set is at most 50 MiB per import, and its derivative is at most
  25 MiB.
- **Retention.** Unapproved staging is deleted after 24 hours. An approved revision is kept while any
  stored project version references it, and project deletion (C3) deletes it with the project.
- **Where the derivative is made.** The creator's browser worker produces it, and the server checks
  its structure.

The alternative, server-side derivative processing, is declined for the first wave.

## E5 — The `T3.P02.S01` finalized scope is accepted

The following are accepted:

- the [finalized convergence scope](../../roadmap/t3-experience/t3.p02-capture-and-cut-preview/t3.p02.s01-first-capture-and-cut-preview/implementation-plan.md#finalized-convergence-scope-owner-accepted-2026-10-22),
  including Guide-free Preview entry;
- the [Experience format draft](../../roadmap/t3-experience/t3.p02-capture-and-cut-preview/t3.p02.s01-first-capture-and-cut-preview/experience-format-draft.md),
  as the format S01 implements;
- the [shell draft's](../../roadmap/t3-experience/t3.p02-capture-and-cut-preview/t3.p02.s01-first-capture-and-cut-preview/shell-draft.md)
  Preview entry rule.

The two open points in the format draft are settled at implementation review: the text length bound
and whether `entryViewId` alone suffices. The format becomes current contract when S01 lands it,
through its own acceptance; this record does not present it as shipped. S01's historical batch D
authorization stands, and this scope refines it.

## E6 — Reference A is the hardware for the hard rows

The [performance contract](../components/performance.md#reference-baseline) stays as ratified.
Reference laptop A is the primary budget machine, and GPU, frame-time and GPU-memory gates are
accepted only from reference hardware runs.

The owner designates a Reference A machine and its operator. **Named later the same day:** see the
[E6 amendment](#amendment-e6-reference-machine-named), which designates the owner's MacBook Air M2
and keeps laptop A as the accessibility target. The rest of this section is the decision as first
recorded.

When named, record them as an amendment at the end of this record: make and model, CPU, GPU, RAM,
display, OS and power plan, plus the operator. `T3.P03.S02`'s calibration then uses that machine.

Naming the machine gates no slice's start; it gates acceptance on hard rows. GPU, frame-time and
GPU-memory rows need a run on Reference A itself. A CPU latency row measured on a developer machine
needs that machine's calibration against Reference A
([reproduction step 2](../components/performance.md#reference-baseline)). Hardware-independent
delivery rows, such as the bundle report's lazy-chunk check, need neither.

Until the machine is named:

- hard rows that need Reference A stay unrun, and developer runs remain pre-flight;
- no consuming slice is accepted on those rows.

The first acceptances that bind such rows are:

- `T3.P02.S01`: F10 capture/bind and Preview entry;
- `T1.P02.S01`: F2 project open, which its format change can move;
- `T1.P02.S02` and `T2.P02.S02`: drawing, import, placement, Undo/Redo, GPU memory and leaks.

`T3.P03.S01` and `T2.P02.S01` bind none.

## E7 — The first wave is authorized and released, gated on `T3.P03.S01`

`T1.P02.S01` and `T2.P02.S01` are authorized exactly as planned. They and `T3.P02.S01` are released
from the hold.

**Start gate.** Each of the three starts only when `T3.P03.S01` has merged on `main`. Its row in the
[T3.P03 slice register](../../roadmap/t3-experience/t3.p03-shared-acceptance-and-measurement/README.md#slice-register)
then reads `shipped` at the starting slice's trusted base. The condition is recorded in each slice's
`Authorization` cell and checked with the runbook start step's eligibility reading of that row.

Why the gate exists:

- `T1.P02.S01` changes F4 intent capture.
- `T2.P02.S01`'s admission and the planners that follow rely on enforced per-planner scope.
- `T3.P02.S01` lazily loads Preview behind the corrected Preview boundary.

## Batch E coordination

Order:

1. `T3.P03.S01` starts first.
2. After it merges, `T1.P02.S01`, `T2.P02.S01` and `T3.P02.S01` run in parallel with each other and
   with `T3.P03.S02`.

Shared unit type and validation modules merge serially, in the order and with the T3 F2 review
that the [batch E protocol](../../roadmap/cross-track-execution.md#authorized-batch-e-2026-10-22)
fixes.

Each slice:

- reruns the complete merge gate on then-current `main`;
- gets independent review;
- runs its own closeout and gets its own P1 merge commit.

## What stays held

Every implementation scope not named above stays under the hold:

- `T1.P02.S02`–`S04`, `T2.P02.S02`–`S03` and `T3.P02.S02`;
- all T4 work (R1-D) and P4.

Each later child starts only from its own authorization after its predecessor's acceptance.

## Explicit non-implications

- **Contracts and gates.** No new architecture contract, gate row, gate version, capability entry or
  gate state. No format is ratified by this record: Layout format 6, the `model` resource kind and
  Experience format 2 become current contract only when their slices land them.
- **Lifecycle.** No phase closes, no track completes and no milestone is accepted. T1, T2 and T3
  stay `approved`.
- **Architecture cycle.** No window opens. The owner's T1.P01 verdict stays owed. `T1.P02.S02`'s
  closeout records M4 as re-armed when it re-wires Junction commits.
- **Operations.** Nothing deploys, migrates deployed data, purges storage or activates the F2 epoch.

## Owner-only decisions not resolved here

1. **The Reference A machine and operator** (E6): resolved by the
   [E6 amendment](#amendment-e6-reference-machine-named).
2. **Architecture-cycle verdicts:** `owner-verdict-owed`, blocking nothing in this batch.
3. **Deployed F2 epoch activation:** owner-run and unexecuted.
4. **Later authorizations:** each lane's next slice after its predecessor's acceptance, and
   `T3.P02.S02` after S01's acceptance.
5. **Drag-preview semantics:** only if C1's bounded experiment misses at L.
6. **Core Editor Stability:** its criteria and acceptance plan after the lanes ship.

## Owner signature

```text
E1 approved  E2 approved  E3 approved  E4 approved  E5 approved
E6 approved — Reference A machine and operator owed
E7 approved — decided now; each start gated on T3.P03.S01 merged
Owner: repository owner (approved in the batch E planning review, PR #174)   Date: 2026-10-22
```

## Amendment: E6 reference machine named

**October 22, 2026, owner instruction in the same session.** The owner named the machine: "use
macbook air m2 16gb ram. current machine". The owner then kept the ratified laptop A target: "it's
ok keep the thing, we want to make it as accessible as possible hence the rail. and we assume
powerful machine get more accessible."

| Field | Value |
| --- | --- |
| Machine | Apple MacBook Air, Mac14,2 |
| CPU | Apple M2, 8 cores (4 performance, 4 efficiency) |
| GPU | Apple M2 integrated, 10 cores, Metal 3 |
| Memory | 16 GB unified |
| Display | Built-in Liquid Retina, 2560×1664 |
| OS | macOS 15.7.2 (24G325) at designation; each result records the version it ran on |
| Power | On battery, Low Power Mode off; the contract judges budgets on battery |
| Browser | Chrome stable, gating; the version is recorded with every result |
| Operator | The repository owner |

What it changes:

- **The target stays.** The [performance contract's](../components/performance.md#reference-baseline)
  laptop A and B descriptions stay as written, as the accessibility target that the budgets describe.
- **Where hard rows are run and accepted.** Hard rows, including GPU, frame-time and GPU-memory rows,
  are run and accepted on this machine. Runs on it need no CPU throttling or calibration. Another
  developer machine calibrates against this machine's calibration-page median.
- **What a pass means.** This machine is stronger than laptop A: a faster CPU and GPU, and 16 GB of
  unified memory against 8 GB shared. A pass on it is a pass on this machine, not proof on an A-class
  laptop. The owner accepted that trade-off with the assumption quoted above. Every acceptance
  record names this machine, and the budgets are unchanged.
- **The ratified contract is amended** for this designation, with this record as its provenance.
  Nothing else in the contract changes.

Effect on batch E: no slice's start ever depended on the machine. Acceptance on hard rows is now
possible on this machine for `T1.P02.S01` (F2), `T3.P02.S01` (F10) and the later slices, and
`T3.P03.S02` records its baseline on it.

```text
E6 amendment approved — reference machine: MacBook Air M2 (Mac14,2), 16 GB; operator: repository owner
Owner: repository owner (same session, PR #174)   Date: 2026-10-22
```
