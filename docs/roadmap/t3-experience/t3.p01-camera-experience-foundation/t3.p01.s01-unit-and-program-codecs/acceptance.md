# T3.P01.S01 — acceptance record: Shared unit and program codecs — CLOSED STUB

```text
AUTHORITY: NONE — this is closed evidence. The live slice criteria remain in
           ./implementation-plan.md; phase status/order → ../README.md#slice-register; F status →
           ../../../README.md#gate-register; F semantics → ../../../../reference/composition-execution.md.
STATUS:    ACCEPTED and CLOSED 2026-10-16. Independent implementation review accepted revision
           6dcb6d6d9e7e43c0f25f3305672c3cc79e0d577e. S01 is shipped; T3.P01 remains in progress.
SCOPE:     F2 unit-envelope-v1 and additive F1 unit-resolution-v1 are distinct accepted scopes,
           each with its own prerequisites and capability record. No runtime activation,
           interpreter behavior or source cutover is accepted here.
```

## Delivered and accepted

Strict F2 unit/envelope codecs, additive F1 unit resolution over accepted unit sources/locks, the
standalone `ExecutionProgram@1` codec and pure AM-7 candidate/report converter passed the approved
plan and independent review. Capability details, accepted exports and conformance:

- [`F2.unit-envelope@1:unit-envelope-v1`](./capability-unit-envelope-v1.md), requiring accepted
  `F1.reference@1:references-v1` and `F3.channels@1:inspection-v1`.
- [`F1.reference@1:unit-resolution-v1`](./capability-unit-resolution-v1.md), additive to and
  preserving the original F1 scope, requiring accepted `F1.reference@1:references-v1` and
  `F2.unit-envelope@1:unit-envelope-v1`.

The execution program and converter are AM-6/AM-7 deliverables, not extra gate capabilities.
The implementation review and full acceptance evidence are recoverable from `6dcb6d6d` and
`c25a7d3916201413c99f856e97b1c028909fe160` respectively (commands below). The accepted implementation
revision is `6dcb6d6d9e7e43c0f25f3305672c3cc79e0d577e`, PR #131.

## Verification and residuals

Closeout against current `main` (`bbff4f2005180748e99f2d6d63bbbd37faf3424c`) passed architecture
(16 files / 144 tests), full editor (125 / 1,693), heavy (8 / 118), editor/package/API type checks,
build, API integration (39 tests / zero skips), docs references and gate-register validation, and
`git diff --check`. One parallel full run and one serial run under load timed out in unchanged
exhaustive tests; the isolated F3 test and final complete serial suite passed. No implementation,
test or config file changed during closeout. Manual-owed rows: 0.

Residuals: T3.P01.S03 owns the one interpreter and behavioral trace requirements. T3.P01.S04 owns
runtime/source activation, inventory, writer quiescence, baseline/CAS installation, cutover, recovery
and legacy retirement. Structural admission does not replace content-revision recomputation or
selected-program executable closure in a future trusted reader.

## Recovery

```text
plan (retained live because the phase gate checker reads its VERIFICATION / INTEGRATION ROUTE):
  ./implementation-plan.md

review body:
  git show 6dcb6d6d9e7e43c0f25f3305672c3cc79e:docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s01-unit-and-program-codecs/independent-review.md

full acceptance and initial closeout body:
  git show c25a7d3916201413c99f856e97b1c028909fe160:docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s01-unit-and-program-codecs/acceptance.md
```

P1 requires this PR to land as a **merge commit**; squash/rebase invalidates the recovery anchors.
After merge, verify each anchor is an ancestor of `main` and run the two `git show <anchor>:<path>`
commands above. No merge or post-merge check is claimed here.

## Closed-work preservation report

```text
CLOSEOUT PRESERVATION — T3.P01.S01 (2026-10-16)
prose compacted:                 2   review and acceptance; plan retained for gate-checker routing
reference promotions:            0   current AM-2/AM-6/AM-7 semantics already own the durable contract
renderable evidence archived:    0 files / 0 bytes
evidence stubs / manifests:       0
transient artifacts removed:      0
historical anchor:                c25a7d3916201413c99f856e97b1c028909fe160 · tag closed/T3.P01.S01 (push pending)
new live → archive prose links:   0
manual-owed verification rows:    0
remaining deferred items:         3   S03 interpreter; S04 activation/cutover/recovery; trusted-reader closure
permanent stubs added:            2   the owner-ratified hybrid preservation policy's accepted cost
required merge method:            merge commit (P1); post-merge anchor verification remains owed
```
