# T1.P02 — Native Wall creation

**Phase:** T1.P02 · **Status:** registered 2026-10-22 and **closed 2026-10-28** by owner ruling after S04's final gate. Released scopes and their conditions are
the [release list](../../now.md). The [production hold](../../README.md#production-implementation-hold)
covers every scope that list omits. S01, S02, S03, S04, S05 and S06 are shipped; S06 was accepted 2026-10-27
as AC-qualified (its milestone gate passed 2026-10-26 and the T3/T2 shared-boundary review is
recorded). S02 was released 2026-10-27 ([record](../../../reference/decisions/next-wave-authorization-2026-10-27.md)), accepted as `owner-override` and shipped on PR #201; S03 is shipped as `owner-override` on PR #209 with its browser rerun waived and Stage bundle exception recorded; under the [2026-10-28 performance-mandate suspension](../../../reference/decisions/performance-mandate-suspension-2026-10-28.md), S01/S02/S03/S06's unmeasured performance rows stay **unmeasured**, not passes, and are no longer S04 prerequisites; S04 is `shipped`, owner-released 2026-10-28 ([record](../../../reference/decisions/t1-p02-s04-authorization-2026-10-28.md)), accepted by owner 2026-10-28 ([acceptance](./t1.p02.s04-integrated-final-gate/acceptance.md)) at `46a31c81`, and P1-merged in `eb0931d6`; the explicit closeout trigger supplied the owner review/waiver, and the owner directed phase close on 2026-10-28. T1.P02 is **closed**; T1 is not complete · **Track:** [T1](../README.md) ·
**Roadmap:** [gate register](../../README.md#gate-register) · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md) · **Design:**
[shell draft](./shell-draft.md)

This phase is C1 of the convergence first wave. The
[current coordination](../../cross-track-execution.md#next-parallel-batch) owns authorized
sequencing and shared-file allocation; the
[batch E decision](../../../reference/decisions/batch-e-authorization-2026-10-22.md)
owns historical authorization. Execution order is
**S01 → S05 retirement → S06 performance foundation → S02 → S03 → S04**. The owner registered S06
ahead of drawing on 2026-10-24 under a temporary
[performance-first halt](../../../reference/decisions/performance-foundation-authorization-2026-10-24.md#performance-first-halt-temporary);
S06 is now accepted (2026-10-27) and merged (`6af62eb4`), so that halt is satisfied and blocks
nothing. The owner then released S02 on 2026-10-27
([record](../../../reference/decisions/next-wave-authorization-2026-10-27.md)), which shipped on
PR #201; S03 was released on 2026-10-27
([record](../../../reference/decisions/t1-p02-s03-authorization-2026-10-27.md)) after S02's
acceptance, and its complete plan and plan review are recorded 2026-10-27. S03 is accepted and shipped on PR #209; its browser rerun exception is recorded in its acceptance stub, and its unmeasured performance rows stay unmeasured under the 2026-10-28 suspension. S04 was released on 2026-10-28
([record](../../../reference/decisions/t1-p02-s04-authorization-2026-10-28.md)) from `main` at the verified PR #209
merge, accepted by the owner on 2026-10-28 at `46a31c81`, and P1-merged in `eb0931d6`. Registration
or a complete plan grants no release; the passed final gate made T1.P02 closable, and the owner's
2026-10-28 phase-close request closed it. No track-completion event is recorded.

## Outcome

From an empty project or the starter, a creator draws straight Walls with deliberate Junction reuse,
closes an enclosure, divides a Room, adds and removes a Wall-hosted Opening and deletes a Wall.
Rooms and floors derive from canonical topology; the creator never chooses boundary or partition.
Undo/Redo and Save/reload keep identities; Plan and 3D agree; keyboard and numeric entry stay useful.
The [performance budgets](../../../reference/components/performance.md) remain the historical reference
criteria; the mandatory benchmark strategy is suspended, so no performance pass is an acceptance
prerequisite.

## Starting evidence and landed cutover

- `@portfolio/layout-core` already plans chains, segments, splits, crossings, subdivision, Wall
  deletion, first-enclosure creation and Opening create/delete. None is wired to the editor; the
  live Layout planners are the eight precision/plinth planners.
- S01 shipped identity capture and strict format 6: authored Wall roles are gone and the
  canonical compiler derives them. Its scoped owner-override and remaining exceptions are
  recorded in the [acceptance stub](./t1.p02.s01-layout-identity-and-format-cutover/acceptance.md).
- The legacy authored types/codec/compiler adapter still remain as live internal vocabulary;
  S05 retires them before drawing. Occupancy-derived curve allocators remain outside
  accepted intents until an explicitly scoped curve-authoring cutover.
- A Layout drag runs the whole candidate finalization (validate, topology, faces, reconciliation,
  Openings, portals, compile) per pointer move; an accepted edit compiles again at install; Undo/Redo
  re-admits and recompiles.
- The Stage registers tasks through the adapter contract. Contributed tasks render as Index groups
  carrying a `family`; no pointer rail exists (destination: the Round 2 dock; see the bounded shell cutover). Junctions are not selectable subjects, Stage input
  has no finish key, and the live-proposal Undo block names two gesture owners by hand.

## Drawing and enclosure policy (owner-accepted 2026-10-22)

The [architecture destination](../../../reference/architecture.md#product-convergence-destination)
leaves these to C1. The owner accepted this policy as written (batch E, E3,
[record](../../../reference/decisions/batch-e-authorization-2026-10-22.md)); every slice of this
phase implements it, and a change to it is a new owner decision:

1. **Every closed ring encloses.** A closed ring at the working level derives a Room. An
   intentionally non-enclosing ring is not supported in this phase.
2. **Roles follow geometry.** A Wall that closes no ring is free-standing. A Wall between two points of
   one Room's boundary divides it, using the landed reconciliation (split survivor by evidence order,
   one Room born). Deleting a Wall merges or opens Rooms through the same reconciliation.
3. **Connection is deliberate.** An endpoint connects only by landing on an existing Junction or on a
   Wall's interior, which splits that Wall there. Nearness never adopts a coordinate.
4. **Unsupported cases refuse in words, with a repair, and leave no partial source:** a crossing without
   a Junction, a collinear overlap, and a closed ring nested inside a Room without sharing a Junction
   with it. Nested courtyards and hole semantics wait for the closure/vertical cutover.
5. **Hosted consequences are disclosed.** Deleting a Wall deletes its Openings in the same undo step.
   Experience or Camera references to a deleted identity keep their retained ID with derived
   diagnostics; nothing is retargeted.

## Layout format 6

Format 6 is format 5 without the authored `role`; the compiler derives bounding, dividing and
free-standing Walls, and face extraction considers every Wall. Under the North Star's
[pre-baseline rule](../../../reference/north-star.md#release-and-source-baselines) there is no
migration, dual reader or negotiation: the number moves to 6, readers refuse anything else, and the
starter, fixtures and evidence JSON are regenerated. This settles the "migrate existing `partition`
Walls" question the architecture contract carried. As T1's first Layout schema cutover, format 6
also triggers the [legacy types/codec retirement row](../planning-evidence.md#17-legacy-layout-typescodec-retirement-row).

## Slice register

Each slice's scope, exit evidence and verification tier live in its plan; this register owns
lifecycle and prerequisites only.

| Slice | Status | Consumes | Requires | Effects | Plan | Acceptance | Authorization |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1.P02.S01 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Layout identity and format cutover (closed stub)](./t1.p02.s01-layout-identity-and-format-cutover/implementation-plan.md) | [record (closed stub)](./t1.p02.s01-layout-identity-and-format-cutover/acceptance.md) | owner-authorized 2026-10-22 as batch E ([record](../../../reference/decisions/batch-e-authorization-2026-10-22.md), E7); accepted and shipped 2026-10-23 as `owner-override` for PR #179 source revision `7e159370` and rebased integration `401b612f`; waived independent-review verdict and S01 F2 S/M timing prerequisites only; S/M measurements remain unmeasured historical rows, not an acceptance prerequisite after the [2026-10-28 suspension](../../../reference/decisions/performance-mandate-suspension-2026-10-28.md); P1 merge commit required for recovery |
| T1.P02.S05 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Legacy Layout retirement](./t1.p02.s05-legacy-layout-retirement/implementation-plan.md) | [record](./t1.p02.s05-legacy-layout-retirement/acceptance.md) | owner-authorized 2026-10-23 in the post-Batch-E release ([record](../../../reference/decisions/post-batch-e-authorization-2026-10-23.md)); accepted 2026-10-23 as `owner-override` (full-suite clean-run waiver only, on revision `588cc70f`; [acceptance stub](./t1.p02.s05-legacy-layout-retirement/acceptance.md)); shipped by PR #183 |
| T1.P02.S06 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Performance foundation](./t1.p02.s06-performance-foundation/implementation-plan.md) | [record](./t1.p02.s06-performance-foundation/acceptance.md) | owner-authorized 2026-10-24 ([record](../../../reference/decisions/performance-foundation-authorization-2026-10-24.md)); its shipped row was pruned from the release list by the [next-wave release](../../../reference/decisions/next-wave-authorization-2026-10-27.md); ran before every direct inheritor under the performance-first halt, which is satisfied; its own gates, review and evidence remained required; milestone gate passed 2026-10-26 (15/15 decision rows, full E5), T3/T2 shared-boundary review recorded 2026-10-27, and the AC-qualified disposition ratified 2026-10-27, whose battery qualification is now an unmeasured historical row rather than an S04 prerequisite ([2026-10-28 suspension](../../../reference/decisions/performance-mandate-suspension-2026-10-28.md)) — all in the [acceptance record](./t1.p02.s06-performance-foundation/acceptance.md#reconciliation-follow-ons-and-closeout-readiness-2026-10-27); shipped on PR #190 (`6af62eb4`) |
| T1.P02.S02 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Draw, close, divide and delete (closed stub)](./t1.p02.s02-draw-close-divide-delete/implementation-plan.md) | [record (closed stub)](./t1.p02.s02-draw-close-divide-delete/acceptance.md) | owner-authorized 2026-10-27 ([record](../../../reference/decisions/next-wave-authorization-2026-10-27.md)); its shipped row was pruned from the release list by the [T1.P02.S03 release](../../../reference/decisions/t1-p02-s03-authorization-2026-10-27.md); accepted and shipped 2026-10-27 as `owner-override` for PR #201 product/harness revision `64b9435d` (documentation head `36c18db9`); waived only the owner-run formal performance prerequisite (F3/F4/F8 S/M, per-move evaluation, F2 open, F13 and the Stage first-load delta remain **unmeasured**, and are no longer S04 prerequisites after the [2026-10-28 suspension](../../../reference/decisions/performance-mandate-suspension-2026-10-28.md)) and recorded the Stage route's 456.0 KiB br against the ≤400 KiB hard budget as an explicit known miss; T3 accepted the shared Head/F4 diff at `bf9007ff` and the narrow-shell repair plus 28-row two-browser journey at `2ad80bbd`; re-arms M4; P1 merge commit `ce159a1e` preserves the `36c18db9` anchor |
| T1.P02.S03 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Opening family (closed stub)](./t1.p02.s03-opening-family/implementation-plan.md) ([plan review](./t1.p02.s03-opening-family/plan-review.md)) | [acceptance (closed stub)](./t1.p02.s03-opening-family/acceptance.md) | owner-authorized 2026-10-27 ([record](../../../reference/decisions/t1-p02-s03-authorization-2026-10-27.md)); its shipped row was pruned from the release list by the [T1.P02.S04 release](../../../reference/decisions/t1-p02-s04-authorization-2026-10-28.md); accepted 2026-10-28 as `owner-override` and shipped on PR #209; owner approved without a browser rerun at `b0d4e252`, accepted the Stage bundle exception; its F4/F8 S/M rows remain **unmeasured**, not passes, and are no longer an S04 prerequisite after the [2026-10-28 suspension](../../../reference/decisions/performance-mandate-suspension-2026-10-28.md); P1 merge preserves the acceptance anchor |
| T1.P02.S04 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Integrated final gate (closed stub)](./t1.p02.s04-integrated-final-gate/implementation-plan.md) | [acceptance (closed stub)](./t1.p02.s04-integrated-final-gate/acceptance.md) | owner-authorized and released 2026-10-28 ([record](../../../reference/decisions/t1-p02-s04-authorization-2026-10-28.md)) from the trusted base `db7e5cd9` (PR #209 merge), with no separate authorization PR; rebased onto `1e6e73aa` (PR #208) for the final evidence at `d1fe6e5c`; exhaustive integrated **correctness and functional** acceptance of native Wall creation. The [2026-10-28 suspension](../../../reference/decisions/performance-mandate-suspension-2026-10-28.md) removes the performance recheck as a prerequisite and leaves every unmeasured performance row unmeasured, not passed. Accepted by owner 2026-10-28 at `46a31c81`; the explicit closeout trigger is the owner's review/waiver of the separate independent-review verdict for this slice only, with no correctness or performance evidence waived. P2 ownership correction applied; the plan is a closed stub and the gate artifact stays live. P1 merge `eb0931d6` (PR #210); T1.P02 closed 2026-10-28 (PHASE CLOSE below) |

The consumed gates and scopes were accepted/active at the batch E base; each slice rechecks
them at its own trusted base through the runbook. No slice provides a gate. S05, S06 and S02 are
shipped (PR #183, PR #190, PR #201); S03 is shipped with an owner-accepted Stage bundle exception;
S04 is accepted and shipped as the final gate; T1.P02 closed 2026-10-28.
Under the [2026-10-28 performance-mandate suspension](../../../reference/decisions/performance-mandate-suspension-2026-10-28.md),
the unmeasured performance rows from S01, S02, S03 and S06 remain **unmeasured, not passes**, and
are not S04 prerequisites. S05 retires S01's residual legacy surface; S06
installs the peak-first harness, the L/XL and realistic workloads, and the measured
algorithm work on the compile/admission/representation path; S02 adds drawing and the bounded
dock/Card cutover; S03 adds Opening; S04 owns integrated exhaustive **correctness and functional**
proof, including S05's and S06's deduplication differentials and scale oracles. No registration
waives a correctness requirement; no performance benchmark is owed or authorized.

```text
FINAL PHASE GATE: T1.P02.S04 → ./t1.p02.s04-integrated-final-gate/acceptance.md

PHASE CLOSE
Stage:        closed
Closed:       2026-10-28 — owner ratification recorded in `eb0931d6` (PR #210 merge; owner
              phase-close request)
Owner ratification: closed by owner ruling 2026-10-28 (`eb0931d6`)
Final gate:   T1.P02.S04 → ./t1.p02.s04-integrated-final-gate/acceptance.md — accepted 2026-10-28
              at `46a31c81`
Integration:  exhaustive integrated correctness/functional acceptance at `d1fe6e5c` — 4 journeys
              / 26 rows in Chromium and Chrome; check 0/0, arch 23/188, heavy 11/138, full
              224 files / 2,874 tests, API 14/115 with zero skips; builds clean. Performance is
              suspended and unmeasured.
Preservation: gate artifact is a closed stub at its path; 32 final PNGs are archived byte-identically;
              anchor `eb0931d6`; tags `closed/T1.P02` (push after this PR) and `closed/T1.P02.S04`
              (pushed).
```

**S06 performance obligations (historical, owner replanning 2026-10-24).** These were S06's own
measurement scope; they are not a current gate. The install-compile and Undo/Redo
re-admission deduplication, with its heavy-lane differential and deterministic compile-count oracle,
and the bounded incremental or worker experiment inside the one compiler move from S02 to
[S06](./t1.p02.s06-performance-foundation/implementation-plan.md). S06 records F2, F3 handle drag,
F4, F7, F8, F13 and per-edit evaluation at S/M/L on the designated M2 with the peak-first method,
in at most three owner-run benches. It also takes, as measurement:
- T3.P02.S02's deferred Scope A performance rows: F10 at S/M, capture/bind, the F13 re-measure,
  the reference-machine run and the Stage initial-load delta. The H0 trace-method ruling stays with
  the owner.
- T3.P03.S02's L/XL fixtures and the M/L drag rows.

If F3 still misses at L after S06's experiment, the "preview equals planner output" semantics is an
owner call.

**S02 performance obligations — historical and suspended (2026-10-28).** The owner-run formal pass
for S02's F3 drawing drag (input-to-matching-preview, latest-input age, final-preview completion,
frames, long tasks), per-move evaluation, F4 commit and F8 Undo/Redo at S and M, F2 open, F13 leak
cycles and the Stage first-load delta was deferred on 2026-10-27; S02 was accepted as
`owner-override` on PR #201. No row is a pass. The 2026-10-28
[suspension](../../../reference/decisions/performance-mandate-suspension-2026-10-28.md) ends the
deferral to S04: the rows stay unmeasured historical evidence, not an acceptance prerequisite.
S04 cannot erase the recorded Stage 456.0 KiB br hard-budget miss.

## Dependencies and boundaries

- **Before implementation:** H0's `T3.P03.S01` merged (S01 changes F4 intent capture; S02 adds
  Layout planners under enforced scope). S05 and S06 are shipped (PR #183, PR #190; S06 merged
  `6af62eb4`). S02 shipped as `owner-override` on PR #201
  ([record](../../../reference/decisions/next-wave-authorization-2026-10-27.md)); its formal
  performance family remains unmeasured historical evidence, not an S04 prerequisite. S03 shipped
  on PR #209. S04 was released 2026-10-28
  ([record](../../../reference/decisions/t1-p02-s04-authorization-2026-10-28.md)), accepted by the
  owner at `46a31c81` as the phase's integrated final gate, and P1-merged in `eb0931d6` (PR #210).
  The policy above is accepted. Nothing waits on C2 or T3.P02; T1.P02 closed 2026-10-28.
- **Performance:** the mandatory strategy is suspended indefinitely
  ([record](../../../reference/decisions/performance-mandate-suspension-2026-10-28.md)). No slice or
  final gate owes a benchmark; investigations are owner-initiated only on an observed slowdown. The
  designated reference machine, budgets and harnesses remain historical method for such an
  investigation; no performance row is authorized or passed here.
- **T1 writes:** layout-core, the Layout unit in project-model, Layout adapters, the Stage host and
  shell, the starter gallery. Changes to shared F4 capture or the Head are reviewed by T3; the dock/invoked-home
  contribution seam admits T2/T3 capabilities without shell edits per tool. S05's bounded
  project-model registry/frame exception was reviewed by T3 (reader/Camera) and T2 (Scene).
- **Excluded:** curved or circular drawing, levels, structures, datums, overheads, attachments, the
  face-frame query (next wave), compound acceptance of new cross-domain operations.
- **Architecture cycle:** the T1.P01 window is closed with the owner verdict still owed; this phase
  configures no window. S02 re-wires Junction commits, so its closeout records M4 as re-armed in the
  [mechanism register](../../../operations/architecture-cycle.md#mechanism-register).
