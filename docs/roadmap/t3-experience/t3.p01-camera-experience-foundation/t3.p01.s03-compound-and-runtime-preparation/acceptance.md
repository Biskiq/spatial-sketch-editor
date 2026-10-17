# T3.P01.S03 — accepted and closed record — CLOSED STUB

```text
AUTHORITY: NONE — this is closed work. Current truth lives in the phase README's slice register and
           the gate register; the accepted evidence lives in S05's and S06's records, which are not
           compacted here.
STATUS:    ACCEPTED and SHIPPED 2026-10-17. S03's obligations were executed by its registered split
           halves, `T3.P01.S05` (PR #140, commit 279e1340) and `T3.P01.S06` (PR #141, commit
           f6962e1c), each independently reviewed and accepted. This record reconciles every original
           S03 criterion to that accepted evidence; it accepts no capability of its own and infers
           nothing from the split's registration or from green tests alone.
ROLE:      umbrella reconciliation and preservation route for T3.P01.S03.
NOT:       product contract · plan · status store · authority for declined or residual capabilities.
```

## Delivered and accepted

S03 was the largest T3 slice: the F4 unit-acceptance and unit-Save extension plus the F3
`camera-handoff-v1` and Experience-runtime preparation. It was split by registered owner decision
into two slices with different evidence contracts, and both are now accepted on `main`:

- [`T3.P01.S05`](../t3.p01.s05-unit-acceptance-and-unit-save/acceptance.md) — F.2 candidate planners,
  one-envelope validation, admitted resource staging, single/compound install with whole-operation
  history, and conditional unit Save on real PostgreSQL. Accepted capabilities:
  [`unit-acceptance-v1`](../t3.p01.s05-unit-acceptance-and-unit-save/capability-unit-acceptance-v1.md)
  and
  [`conditional-save-units-v1`](../t3.p01.s05-unit-acceptance-and-unit-save/capability-conditional-save-units-v1.md).
- [`T3.P01.S06`](../t3.p01.s06-experience-runtime-and-camera-handoff/acceptance.md) — the complete
  F3 handoff, the one Experience lowering/interpreter over `ExecutionProgram@1`, the semantic
  companion and the three profile controllers. Accepted capability:
  [`F3.channels@1:camera-handoff-v1`](../t3.p01.s06-experience-runtime-and-camera-handoff/capability-camera-handoff-v1.md).

The preparatory increment merged earlier (PR #138, `b13c5d73`) remains what it claimed to be: provider
seams accepted only as an increment. Its F4 admission and F3 role half are acceptance evidence only
through S05's and S06's completed, independently reviewed scopes.

## Criterion reconciliation

| Original S03 obligation / exit criterion | Accepted evidence | Outcome |
| --- | --- | --- |
| Extend F4 with `unit-acceptance-v1` and `conditional-save-units-v1` | S05 acceptance + both capability records; F4 gate register names both scopes active | accepted |
| Actual Camera View + Presentation + optional Stop candidates; complete domain/reference/resource-lock validation; staged admitted resources | S05 planning/acceptance conformance (24 + 15 focused tests); staging compared with the captured set | accepted |
| Unit single/compound operations, whole-operation history, resource rollback | S05 acceptance suite and coordinator history/rollback regressions; API transaction-failure case leaves the prior version and base intact | accepted |
| Unit Save with real-DB conformance at zero skips, no new live writer | S05 `save-units` 12/12 inside the API lane's 65 tests / 9 suites, zero skips; source-level inactivity proof keeps the live route current-source-only | accepted |
| Extend F3 with `camera-handoff-v1` through the shared ticket protocol; guided/free ownership, Follow, Look-through, Preview, return, stale cleanup | S06 handoff conformance (13 tests) and the accepted capability record | accepted |
| Shared Experience lowering/interpreter over the exact `ExecutionProgram@1` codec; reducer/clock, occurrence holds/continuation, guard/Continue/detour | S06 runtime conformance (42 tests); lowering validates against the accepted codec and refuses unsupported bindings | accepted |
| Semantic DOM companion / Info Panel | S06 runtime and companion assertions: keyboard/DOM reachability, occurrence-derived `aria-current`, Gate Continue, focus/return, gap explanations | accepted |
| Guided/free/reduced-motion controllers; no second Camera authority | S06 controller conformance (5 tests) plus channels, camera-output, route and motion suites (142 focused tests across 8 files) | accepted |
| Supported program traces (AM-6) and ownership/stale-event behavior | S06 trace fixtures for repeated Stops/runs, guards, holds, Cut, travel and gaps, detour return, handoff and stale cleanup; terminal-run finality regressions | accepted |
| Accept extension scopes on `main` before S04 consumes them | `unit-acceptance-v1`, `conditional-save-units-v1` and `camera-handoff-v1` are active in the F4/F3 gate rows on `main` (`f6962e1c`) | accepted |
| Never relabel T1's base acceptance as complete F4 readiness | T1's provider records are unchanged; S05 names F2 and `acceptance-invariants-v1` as prerequisites, S06 names `inspection-v1` | unchanged |

Nothing in S03's plan remains unimplemented or unowned. Deferred product decisions are recorded as
S04/T4 obligations below, not as gaps in this acceptance.

## Evidence and route

S05's recorded evidence at `983d7a60`/`d7ab6984`: clean project-model/API/editor checks, 53 focused
unit tests, the 156-file / 2047-test editor lane, 161 arch tests, and 65 API tests with zero skips.
S06's recorded evidence at `ff5a14da` (rebased onto post-#140 `main`): clean project-model,
camera-core and editor checks, 142 focused tests across 8 files, the 158-file / 2099-test editor lane,
161 arch tests and 118 heavy tests. Both PRs paired the evidence with an independent ACCEPT and a
coordinator review. These results are reused from the half-slice records, not re-run here.

The architecture-integration route remains [`T3.P01.S04`](../t3.p01.s04-live-ownership-cutover/implementation-plan.md):
all three capabilities are accepted but inactive, and no product source imports them.

## Entry points

```text
umbrella record   ./acceptance.md (this file) · ./split-proposal.md · ../README.md#slice-register
half slices       ../t3.p01.s05-unit-acceptance-and-unit-save/acceptance.md
                  ../t3.p01.s06-experience-runtime-and-camera-handoff/acceptance.md
capabilities      ../../README.md#gate-register (F3 and F4 rows)
integration       ../t3.p01.s04-live-ownership-cutover/implementation-plan.md
```

## Residuals

```text
integration     T3.P01.S04 owns activation, caller migration, the AM-7 inventory, quiescence and
                recovery, and retirement of the current visitor orchestration
contract        T3.camera-experience-cutover@1 is undrafted and unratified; S04 is unauthorized
invocation      Experience@1 has no authored Cut/Travel selector; lowering takes a closed binding set
authored inputs presentation text, bindings, state, lifecycle and channel policy have no authored F2
                home and may not be host-injected
timing          hold/Gate time starts at editorial arrival; confirmed-arrival timing and the
                transition table's authored home are S04/T3.P02 decisions
staging         uploaded resource bytes stay host-asserted until S04's storage path verifies them
revision        the envelope's embedded acceptedRevision is baseline provenance; the accepted
                snapshot is revision authority
live Save       conditional-save-current-v1 remains the only live Save route
```

## Recovery and P1 merge requirement

```text
full original obligations and split record:
  git show f6962e1c:docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s03-compound-and-runtime-preparation/implementation-plan.md
  git show f6962e1c:docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s03-compound-and-runtime-preparation/split-proposal.md

REQUIRED MERGE METHOD — P1: merge commit (no squash, no rebase), so this anchor and the half-slice
records' history stay reachable on `main`. Post-merge, verify the anchor is an ancestor of `main`.
anchor f6962e1c · tag `closed/T3.P01.S03` (created at this close; pushed).
```

## Closed-work preservation report

```text
CLOSEOUT PRESERVATION — T3.P01.S03 (2026-10-17)
prose compacted:                 2   implementation-plan.md and this acceptance record; stubs at original paths
reference promotions:            0   all three capability records were promoted by S05/S06 closeouts
renderable evidence archived:    0 files / 0 bytes
evidence stubs / manifests:      0
transient artifacts removed:     0
historical anchor:               f6962e1c · closed/T3.P01.S03 (pushed)
new live → archive prose links:  0
manual-owed verification rows:   0
remaining deferred items:        7 (S04 activation; undrafted cutover gate; authored invocation
                                 selector; authored input/presentation home; confirmed-arrival timing;
                                 host-asserted staging bytes; baseline revision semantics)
permanent stubs added:           2   (owner-ratified one-per-compacted-prose-artifact cost)
required merge method:           merge commit (P1), no squash/rebase; post-merge anchor check owed
```
