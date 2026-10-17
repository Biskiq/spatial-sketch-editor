# T3.P01.S02 — accepted and closed record — CLOSED STUB

```text
AUTHORITY: NONE — this is closed work. Current truth lives in the phase README's slice register,
           the F4 gate register and the accepted capability record linked below.
STATUS:    ACCEPTED and SHIPPED 2026-10-16. Owner-authorized adjudication found the recorded
           independent review and verification satisfy the approved criteria.
           `F4.intent-acceptance@1:conditional-save-current-v1` is accepted. Routine `slice-closeout`
           compacted the full evidence to this stub; no criteria or evidence were inferred from skill
           invocation or green tests alone.
ROLE:      acceptance outcome and preservation route for T3.P01.S02.
NOT:       product contract · plan · status store · authority for declined or residual capabilities.
```

## Delivered and accepted

The current-source conditional-Save protocol (`SaveAcceptedSource@1`), its one server write path with
an atomic version/pointer/receipt commit, the framework-free client Save state and the conditional
client transport are accepted at implementation revision
`8dd53260d4ba1545ef2977612d78a00f80d8d393`. The accepted capability is
[`F4.intent-acceptance@1:conditional-save-current-v1`](./capability-conditional-save-current-v1.md).
The plan's integrated result remains owed to
[T3.P01.S04](../t3.p01.s04-live-ownership-cutover/implementation-plan.md); this does not make the
phase closable or closed.

## Evidence and route

Independent review on PR #133 — server concurrency, the framework-free state machine and
transport/draft integrity, plus two follow-up P1 rounds — recorded every substantiated in-scope
finding as fixed at the tested revision, with no in-scope defect remaining open. The recorded evidence
at `8dd53260` includes the focused suites (39 tests), the architecture lane (18 files / 151 tests),
the complete editor suite (140 files / 1,856 tests), the package/editor checks, and the DB-backed
`test:api` lane on real PostgreSQL 14.19 (53 tests, zero skips) covering same-base contention,
concurrent create-only, owner-blind collision, no partial version/pointer update, retry receipts,
refusals and editor/API admission parity. Product suites and the DB lane were reused, not rerun during
closeout. No manual-owed acceptance row is recorded.

The full evidence body and exact test notes are recoverable from the historical anchor below. The
approved plan is recoverable there as well.

## Entry points

```text
implementation   packages/project-model/src/save/protocol.ts
                 packages/project-model/src/save/index.ts
                 apps/api/src/save-persistence.ts
                 apps/editor/src/lib/authoring/save/save-state.ts
                 apps/editor/src/lib/platform/project-persistence.ts
validation       apps/editor/tests/lib/project-model/save-protocol.test.ts
                 apps/editor/tests/lib/authoring/save-state.test.ts
                 apps/editor/tests/lib/platform/project-persistence.test.ts
                 apps/editor/tests/lib/authoring/save-call-sites.test.ts
                 apps/editor/tests/lib/authoring/save-admission-parity.test.ts
                 apps/api/tests/save.test.mjs
plan / routing   ./implementation-plan.md · ../README.md · ../../../README.md#gate-register
```

## Residuals

```text
integration      architecture-integration route is T3.P01.S04; not claimed here
successor scope  F2/unit/compound Save (`conditional-save-units-v1`) is T3.P01.S03
activation       source cutover, migration inventory, retirement and recovery are T3.P01.S04's
host wiring      the PLATE Head Save control, unsaved-work signalling and reload-through-guard are
                 T1's host↔F4 slice (T1.P01.S04 by default)
deferred defects TD-6 (migration-runner concurrency) and TD-7 (foreign-row lock before owner test)
                 now live in ../../../../operations/tech-debt/README.md
```

## Recovery and P1 merge requirement

```text
full evidence and approved plan:
  git show 429b40a930b6460a73aec76f5de123418b106889:docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s02-early-conditional-save/acceptance.md
  git show 429b40a930b6460a73aec76f5de123418b106889:docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s02-early-conditional-save/implementation-plan.md

REQUIRED MERGE METHOD — P1: merge commit (no squash, no rebase), so the full accepted bodies and
this anchor remain reachable on `main`. Post-merge, verify the anchor is an ancestor of `main` and
both `git show <anchor>:<path>` recovery reads succeed.
anchor 429b40a930b6460a73aec76f5de123418b106889 · tag `closed/T3.P01.S02` (created for this close;
pushed).
```

## Closed-work preservation report

```text
CLOSEOUT PRESERVATION — T3.P01.S02 (2026-10-16)
prose compacted:                 2   implementation-plan.md and acceptance.md; stubs at original paths
reference promotions:            0   the capability sits in the gate register + its durable record
renderable evidence archived:    0 files / 0 bytes
evidence stubs / manifests:     0
transient artifacts removed:     0
historical anchor:               429b40a930b6460a73aec76f5de123418b106889 · closed/T3.P01.S02 (pushed)
new live → archive prose links:  0
manual-owed verification rows:   0
remaining deferred items:        4 (S04 integration; S03 unit/compound Save; S04 activation/retirement;
                                 T1 Head wiring) plus tech-debt TD-6 and TD-7
permanent stubs added:           2   (owner-ratified one-per-compacted-prose-artifact cost)
required merge method:           merge commit (P1), no squash/rebase; post-merge anchor check owed
```
