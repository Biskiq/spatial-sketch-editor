# T3.P01.S05 — accepted and closed record — CLOSED STUB

```text
AUTHORITY: NONE — this is closed work. Current truth lives in the phase README's slice register,
           the F4 gate register and the two accepted capability records linked below.
STATUS:    ACCEPTED and SHIPPED 2026-10-17. The owner authorized closeout after independent
           implementation review accepted the whole slice; two REJECT→ACCEPT review cycles and one
           focused ACCEPT on the F.1 accepted-read identity correction left no open in-scope finding.
           `F4.intent-acceptance@1:unit-acceptance-v1` and
           `F4.intent-acceptance@1:conditional-save-units-v1` are accepted. Routine `slice-closeout`
           compacted the plan to a stub and wrote this evidence record; no criterion was inferred from
           skill invocation or green tests alone.
ROLE:      acceptance outcome and preservation route for T3.P01.S05.
NOT:       product contract · plan · status store · authority for declined or residual capabilities.
```

## Delivered and accepted

The first half of the approved `T3.P01.S03` split: real F.2 unit candidate planning (a single-domain
Camera View update and a compound Camera View + Experience Presentation + optional Stop), one-envelope
domain/reference/dependency-lock validation, resource staging through F.1 against the accepted
snapshot, single and compound acceptance through the landed F.4 coordinator with whole-operation
history and rollback, and the `SaveAcceptedSource@1` capture/handler over F.2 exercised on real
PostgreSQL. The accepted capabilities are
[`F4.intent-acceptance@1:unit-acceptance-v1`](./capability-unit-acceptance-v1.md) and
[`F4.intent-acceptance@1:conditional-save-units-v1`](./capability-conditional-save-units-v1.md).

Product evidence is at tested revision `983d7a60` (corrections landed at `4f9ff64e`, `b4daa9ec`,
`983d7a60`); `d7ab6984` is a comment-only successor that passed `check:project-model` and the
acceptance suite. PR [#140](https://github.com/Biskiq/spatial-sketch-editor/pull/140), branch
`T3-P01-S05`, based on `d2607caf`.

F.1 read identity is part of this acceptance: an F.2 envelope keeps its baseline `acceptedRevision`
for byte-exact Undo/Redo, while F.4 owns the minted accepted revision. `createUnitReadContext` now
takes that accepted revision explicitly, preparation passes it with the snapshot digest, the unit
resolver scopes identity by project, and staging resolves targets against the accepted snapshot while
a changed resource's new identity is the intent's authored identity on the candidate registry. No
second revision is minted and the installed source bytes are never rewritten.

## Evidence and route

Independent review of the whole slice reached ACCEPT after two correction cycles (staging derivation,
profile single-sourcing, revision and capability claims, route-level inactivity proof, missing Save
cases), and a focused independent review accepted the F.1 identity correction. The coordinator
reviewed both diffs and the combined candidate. Every finding is fixed at the tested revision with a
regression that would fail on the previous behavior.

Recorded verification at `983d7a60`/`d7ab6984`, reused here and not re-run during closeout:

```text
checks            check:project-model · check:api · check (svelte-check 0 errors, 0 warnings)
focused units     53 tests — unit-resolution 14, unit-acceptance 24, f4-unit-acceptance 15
editor full lane  156 files / 2047 tests
arch lane         20 files / 161 tests
API real Postgres 9 suites / 65 tests · zero skips · save-units 12/12
combined (S05+S06, tree 078e51cd)  editor 2099 · arch 161 · heavy 118 · API 65 zero skips
```

No manual-owed acceptance row is recorded. The architecture-integration route remains
[T3.P01.S04](../t3.p01.s04-live-ownership-cutover/implementation-plan.md); the unit modules are
inactive and no live route reaches them.

## Entry points

```text
implementation   packages/project-model/src/units/planning.ts
                 packages/project-model/src/units/acceptance.ts
                 packages/project-model/src/units/acceptance-staging.ts
                 packages/project-model/src/units/save.ts
                 packages/project-model/src/f4/unit-acceptance.ts
                 packages/project-model/src/references/unit-resolution.ts
                 apps/api/src/save-persistence.ts
validation       apps/editor/tests/lib/authoring/unit-acceptance-conformance.test.ts
                 apps/editor/tests/lib/authoring/f4-unit-acceptance.test.ts
                 apps/editor/tests/lib/project-model/unit-resolution-conformance.test.ts
                 apps/api/tests/save-units.test.mjs
plan / routing   ./implementation-plan.md (closed stub) · ../README.md · ../../../README.md#gate-register
```

## Residuals

```text
integration    architecture-integration route is T3.P01.S04; unit acceptance and unit Save are
               inactive until activation, migration and the live writer switch
activation     source cutover, migration inventory, quiescence/recovery and retirement are S04's
staging        uploaded resource bytes are host-asserted until S04's storage path verifies them
revision       the envelope's embedded acceptedRevision is baseline provenance; revision authority is
               the accepted snapshot (Save stamps the saved revision)
preparation    the F.1 identity check is project-scoped; resolution is content-based, not
               revision-sensitive, by design
```

## Recovery and P1 merge requirement

```text
full approved plan:
  git show 983d7a6046509559d3b61e4453e9894dd1bfabbc:docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s05-unit-acceptance-and-unit-save/implementation-plan.md

REQUIRED MERGE METHOD — P1: merge commit (no squash, no rebase), so the plan anchor and this
record's history remain reachable on `main`. Post-merge, verify the anchor is an ancestor of `main`
and the recovery read succeeds.
anchor 983d7a6046509559d3b61e4453e9894dd1bfabbc · tag `closed/T3.P01.S05` (created at this close;
pushed).
```

## Closed-work preservation report

```text
CLOSEOUT PRESERVATION — T3.P01.S05 (2026-10-17)
prose compacted:                 2   implementation-plan.md and this acceptance record; stubs at original paths
reference promotions:            0   capability truth sits in the gate register + the two records
renderable evidence archived:    0 files / 0 bytes
evidence stubs / manifests:      0
transient artifacts removed:     0
historical anchor:               983d7a6046509559d3b61e4453e9894dd1bfabbc · closed/T3.P01.S05 (pushed)
new live → archive prose links:  0
manual-owed verification rows:   0
remaining deferred items:        4 (S04 integration; host-asserted staging bytes; baseline revision
                                 semantics; S04 activation/retirement) plus S06's disclosed residuals
permanent stubs added:           2   (owner-ratified one-per-compacted-prose-artifact cost)
required merge method:           merge commit (P1), no squash/rebase; post-merge anchor check owed
```
