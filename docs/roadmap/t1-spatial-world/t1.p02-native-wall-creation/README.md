# T1.P02 — Native Wall creation

**Phase:** T1.P02 · **Status:** registered 2026-10-22. Released scopes and their conditions are
the [release list](../../now.md). The [production hold](../../README.md#production-implementation-hold)
covers every scope that list omits. S01, S05, S06 and S02 are shipped; S06 was accepted 2026-10-27
as AC-qualified (its milestone gate passed 2026-10-26 and the T3/T2 shared-boundary review is
recorded). S02 was released 2026-10-27 ([record](../../../reference/decisions/next-wave-authorization-2026-10-27.md)), accepted as `owner-override` and shipped on PR #201 with its formal performance family deferred to S04; S03 is shipped as `owner-override` on PR #209 with its browser rerun waived, Stage bundle exception recorded, and formal F4/F8 rows assigned to S04; S04 stays `proposed` · **Track:** [T1](../README.md) ·
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
acceptance, and its complete plan and plan review are recorded 2026-10-27. S03 is accepted and shipped on PR #209; its browser rerun exception and deferred measurements are recorded in its acceptance stub. S04 still needs its own release,
and registration or a complete plan grants no release.

## Outcome

From an empty project or the starter, a creator draws straight Walls with deliberate Junction reuse,
closes an enclosure, divides a Room, adds and removes a Wall-hosted Opening and deletes a Wall.
Rooms and floors derive from canonical topology; the creator never chooses boundary or partition.
Undo/Redo and Save/reload keep identities; Plan and 3D agree; keyboard and numeric entry stay useful;
drawing meets the ratified [performance budgets](../../../reference/components/performance.md) on
reference hardware.

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
| T1.P02.S01 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Layout identity and format cutover (closed stub)](./t1.p02.s01-layout-identity-and-format-cutover/implementation-plan.md) | [record (closed stub)](./t1.p02.s01-layout-identity-and-format-cutover/acceptance.md) | owner-authorized 2026-10-22 as batch E ([record](../../../reference/decisions/batch-e-authorization-2026-10-22.md), E7); accepted and shipped 2026-10-23 as `owner-override` for PR #179 source revision `7e159370` and rebased integration `401b612f`; waived independent-review verdict and S01 F2 S/M timing prerequisites only; S/M measurements remain unrun and assigned to S04; P1 merge commit required for recovery |
| T1.P02.S05 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Legacy Layout retirement](./t1.p02.s05-legacy-layout-retirement/implementation-plan.md) | [record](./t1.p02.s05-legacy-layout-retirement/acceptance.md) | owner-authorized 2026-10-23 in the post-Batch-E release ([record](../../../reference/decisions/post-batch-e-authorization-2026-10-23.md)); accepted 2026-10-23 as `owner-override` (full-suite clean-run waiver only, on revision `588cc70f`; [acceptance stub](./t1.p02.s05-legacy-layout-retirement/acceptance.md)); shipped by PR #183 |
| T1.P02.S06 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Performance foundation](./t1.p02.s06-performance-foundation/implementation-plan.md) | [record](./t1.p02.s06-performance-foundation/acceptance.md) | owner-authorized 2026-10-24 ([record](../../../reference/decisions/performance-foundation-authorization-2026-10-24.md)); its shipped row was pruned from the release list by the [next-wave release](../../../reference/decisions/next-wave-authorization-2026-10-27.md); ran before every direct inheritor under the performance-first halt, which is satisfied; its own gates, review and evidence remained required; milestone gate passed 2026-10-26 (15/15 decision rows, full E5), T3/T2 shared-boundary review recorded 2026-10-27, and the AC-qualified disposition ratified 2026-10-27 with battery qualification deferred to S04 — all in the [acceptance record](./t1.p02.s06-performance-foundation/acceptance.md#reconciliation-follow-ons-and-closeout-readiness-2026-10-27); shipped on PR #190 (`6af62eb4`) |
| T1.P02.S02 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Draw, close, divide and delete (closed stub)](./t1.p02.s02-draw-close-divide-delete/implementation-plan.md) | [record (closed stub)](./t1.p02.s02-draw-close-divide-delete/acceptance.md) | owner-authorized 2026-10-27 ([record](../../../reference/decisions/next-wave-authorization-2026-10-27.md)); its shipped row was pruned from the release list by the [T1.P02.S03 release](../../../reference/decisions/t1-p02-s03-authorization-2026-10-27.md); accepted and shipped 2026-10-27 as `owner-override` for PR #201 product/harness revision `64b9435d` (documentation head `36c18db9`); waived only the owner-run formal performance prerequisite (F3/F4/F8 S/M, per-move evaluation, F2 open, F13 and the Stage first-load delta remain unrun and assigned to S04) and recorded the Stage route's 456.0 KiB br against the ≤400 KiB hard budget as an explicit known miss; T3 accepted the shared Head/F4 diff at `bf9007ff` and the narrow-shell repair plus 28-row two-browser journey at `2ad80bbd`; re-arms M4; P1 merge commit `ce159a1e` preserves the `36c18db9` anchor |
| T1.P02.S03 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Opening family (closed stub)](./t1.p02.s03-opening-family/implementation-plan.md) ([plan review](./t1.p02.s03-opening-family/plan-review.md)) | [acceptance (closed stub)](./t1.p02.s03-opening-family/acceptance.md) | released 2026-10-27 ([record](../../../reference/decisions/t1-p02-s03-authorization-2026-10-27.md)); accepted 2026-10-28 as `owner-override` and shipped on PR #209; owner approved without a browser rerun at `b0d4e252`, accepted the Stage bundle exception, and assigned unrun F4/F8 S/M measurements to S04; P1 merge preserves the acceptance anchor |
| T1.P02.S04 | proposed | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Integrated final gate](./t1.p02.s04-integrated-final-gate/implementation-plan.md) | [record](./t1.p02.s04-integrated-final-gate/acceptance.md) | not authorized — starts only from its own owner authorization after S01, S05, S06, S02 and S03 are accepted |

The consumed gates and scopes were accepted/active at the batch E base; each slice rechecks
them at its own trusted base through the runbook. No slice provides a gate. S05, S06 and S02 are
shipped (PR #183, PR #190, PR #201); S02's formal performance family is deferred to S04. S03 is shipped with an owner-accepted Stage bundle exception; its formal Opening performance
family remains unrun and is assigned to S04. S05 retires S01's residual legacy surface; S06
installs the peak-first measurement method, the L/XL and realistic workloads, and the measured
algorithm work on the compile/admission/representation path; S02 adds drawing and the bounded
dock/Card cutover; S03 adds Opening; S04 owns integrated exhaustive proof, including S05, S06 and
S01's still-unrun F2 S/M timings on the designated M2. No registration waives a hard budget or
independent acceptance requirement.

```text
FINAL PHASE GATE: T1.P02.S04 → ./t1.p02.s04-integrated-final-gate/acceptance.md

PHASE CLOSE
Stage:        active
```

**S06 performance obligations (owner replanning, 2026-10-24).** The install-compile and Undo/Redo
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

**S02 performance obligations — deferred to S04 (owner direction, 2026-10-27).** The owner-run
formal pass for S02's F3 drawing drag (input-to-matching-preview, latest-input age, final-preview
completion, frames, long tasks), per-move evaluation, F4 commit and F8 Undo/Redo at S and M, F2
open, F13 leak cycles and the Stage first-load delta was deferred, and S02 was accepted as
`owner-override` on PR #201. No row is a pass. S04's integrated recheck carries the family, and
S04 cannot erase the recorded Stage 456.0 KiB br hard-budget miss.

## Dependencies and boundaries

- **Before implementation:** H0's `T3.P03.S01` merged (S01 changes F4 intent capture; S02 adds
  Layout planners under enforced scope). S05 and S06 are shipped (PR #183, PR #190; S06 merged
  `6af62eb4`). S02 shipped as `owner-override` on PR #201
  ([record](../../../reference/decisions/next-wave-authorization-2026-10-27.md)), with its formal
  performance family deferred to S04; S03 is released 2026-10-27
  ([record](../../../reference/decisions/t1-p02-s03-authorization-2026-10-27.md)) and its complete
  plan and pre-build plan review are recorded (2026-10-27). S04 still needs its own release. The policy
  above is accepted. Nothing waits on C2 or T3.P02.
- **Reference hardware:** hard performance rows are run and accepted on the designated reference
  machine, the owner's MacBook Air M2 with 16 GB ([batch E, E6 amendment](../../../reference/decisions/batch-e-authorization-2026-10-22.md#amendment-e6-reference-machine-named)). Laptop A
  stays the accessibility target the budgets describe.
- **T1 writes:** layout-core, the Layout unit in project-model, Layout adapters, the Stage host and
  shell, the starter gallery. Changes to shared F4 capture or the Head are reviewed by T3; the dock/invoked-home
  contribution seam admits T2/T3 capabilities without shell edits per tool. S05's bounded
  project-model registry/frame exception was reviewed by T3 (reader/Camera) and T2 (Scene).
- **Excluded:** curved or circular drawing, levels, structures, datums, overheads, attachments, the
  face-frame query (next wave), compound acceptance of new cross-domain operations.
- **Architecture cycle:** the T1.P01 window is closed with the owner verdict still owed; this phase
  configures no window. S02 re-wires Junction commits, so its closeout records M4 as re-armed in the
  [mechanism register](../../../operations/architecture-cycle.md#mechanism-register).
