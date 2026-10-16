# T1.P01.S01 — acceptance record: Shared interface providers — CLOSED STUB

```text
AUTHORITY: NONE — this is closed work. Current truth lives in the phase README's slice register
           (../README.md#slice-register), the gate register's accepted F1/F3 rows
           (../../../README.md#gate-register) and their durable capability records
           (./capability-references-v1.md · ./capability-inspection-v1.md). The slice's plan of
           record is ./implementation-plan.md.

STATUS:    SHIPPED and CLOSED 2026-10-16. Routine `slice-closeout` recorded the independent
           acceptance, promoted `F1.reference@1` and `F3.channels@1` to `accepted` and compacted
           the implementer/reviewer body to this stub. Nothing was retracted: every result below
           is the one that was accepted.
ROLE:      accept and evidence the shared F1/F3 interface providers and the accepted-capabilities
           / Requires readiness enforcement the slice installed.
NOT:       a product contract · a plan · a status store · authority for new work · authority for
           any capability this slice declined to build (see Residuals).
```

## Delivered

`@portfolio/project-model` exports the shared `references-v1` (`src/references/`) and
`inspection-v1` (`src/channels/`) interfaces with their conformance suites, together with the
accepted-capabilities / Requires readiness enforcement in the arch lane's execution-structure gate
(`apps/editor/tests/docs/parallel-track-gates.test.ts`, `capabilityProblems`). No Stage, live Camera
controller, local history, source migration or downstream slice behaviour was implemented.

## Accepted contract

The slice plan owns the criteria (`./implementation-plan.md`). Its accepted outputs are the two
capability scopes `F1.reference@1:references-v1` and `F3.channels@1:inspection-v1`; the gate rows
record `accepted` and the durable records carry the accepted scope, source kinds, prerequisites,
exports, conformance, acceptance and ancestor commit. F.1/F.3 semantics stay owned by
`../../../../reference/composition-execution.md` (AM-1 / AM-3); this record never owned them.

## Provenance

```text
implementation   T1.P01.S01, owner-authorized 2026-10-15 (reference/decisions/f-ratification-2026-10-15.md)
branch           T1-P1-S1-implementation on base `main` @ aeb464b2 (PR #125, incl. PR #124)
PR               #126
accepted revision ee463d0b — the head the independent review accepted
history          c0d920d7 implementation · 5d27a96d round 1 · 236d1c73 round 2 · 0818089b round 3 ·
                 6ec5921c foundation hardening · 73bd68d3 independent-review remediation ·
                 ee463d0b re-review P1 fix
```

## Evidence

The slice plan declares tier `architecture-integration` and routes its deferred integrated proof to
the phase's final gate (`../t1.p01.s06-integrated-final-gate/implementation-plan.md`); the phase
cannot become `closable` until that integrated result is recorded. The implementer's recorded run at
the tree of `ee463d0b` exceeded that tier with the complete gate:

```text
npm run check:project-model   tsc -p tsconfig.json --noEmit                                 PASS
npm run check:layout-core     tsc -p tsconfig.json --noEmit                                 PASS
npm run check:camera-core     tsc -p tsconfig.json --noEmit                                 PASS
npm run check                 svelte-kit sync && svelte-check       0 errors, 0 warnings     PASS
npm run build                 vite build                                                    PASS
npm run test:arch             vitest run --config vitest.arch.config.ts   15 files, 137 tests PASS
npm run test:heavy            vitest run --config vitest.heavy.config.ts   8 files, 118 tests PASS
npm test                      vitest run (complete suite)               119 files, 1597 tests PASS
npm run check:api             tsc -p tsconfig.json --noEmit                                 PASS
npm run test:api              node --test (real Postgres)  39 tests, 0 skipped, 0 failed   PASS
```

`git diff --check` against base `aeb464b2` was clean. Manual-owed rows: none.

## Entry points

```text
implementation   packages/project-model/src/references      references-v1 shapes, validators, resolver host, bounded current-domain read adapters
                 packages/project-model/src/channels         inspection-v1 address/descriptor/values, negotiation, Camera-output ticket protocol
validation       apps/editor/tests/lib/project-model/references-conformance.test.ts
                 apps/editor/tests/lib/project-model/channels-conformance.test.ts
                 apps/editor/tests/lib/project-model/camera-output-conformance.test.ts
                 apps/editor/tests/lib/project-model-boundary.test.ts        runtime-safe import direction
                 apps/editor/tests/docs/parallel-track-gates.test.ts         readiness enforcement (capabilityProblems)
records          ./capability-references-v1.md · ./capability-inspection-v1.md
plan / routing   ./implementation-plan.md · ../README.md · ../../../README.md#gate-register
```

## Residuals

Named, none hidden, and carried forward rather than resolved here:

```text
integration tier   the declared tier is `architecture-integration`, narrowed: the integrated result
                   is owed at the phase's final gate T1.P01.S06 (INTEGRATION ROUTE). S06 acceptance
                   is what makes the phase closable; it is not claimed by this close.
adapter boundary   an adapter serves the source object it was built with, so a caller that mutates a
                   document must rebuild its adapters with the new accepted snapshot; sealing or
                   digesting the source on every resolve was deliberately not adopted.
F.2 lock identity  the identity space an admitted F.2 lock speaks in belongs to the F.2 provider when
                   it lands; with no reader supplied, `project-lock` stays `incompatible` and no lock
                   is manufactured.
bounded breadth    Experience/resource subjects and any resolver needing an unratified schema
                   (Level, Structure, component, Room frame) stay `incompatible`/`missing`, never
                   invented; the admitted subject-kind set is the reviewer-owned breadth decision.
channel limits     returns nest one deep (deeper unwinding is refused, not mis-transferred); union
                   members are declared identities, not source-resolved; declared invalidation inputs
                   other than `accepted-revision` and `generation` are the owning evaluator's duty;
                   epoch marks are retained for the life of a channel state; a Camera output at the
                   run-epoch ceiling can only be cancelled until a new host session.
```

## Recovery

```text
full accepted body (the implementer evidence, the three review rounds' per-finding dispositions, the
foundation-hardening round and the independent-review remediation — 365 lines) — the body that this
stub replaced:

  git show ee463d0b:docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s01-shared-interface-providers/acceptance.md

REQUIRED MERGE METHOD — P1: **this closeout must land as a merge commit (no squash, no rebase).**
T1-P1-S1-implementation carries no merge of `main`, so ee463d0b is an ancestor of the branch head
but not yet of `main`; a merge commit makes it one, keeping both recovery reads above resolvable and
keeping the gate register's `Commit` column (`ee463d0b`, checked by the execution-structure gate's
`ancestorOfHead` rule and its trusted-base closure) valid on `main`. A squash or rebase rewrites the
branch's revisions, would leave the `Commit` column non-ancestor on `main` and red the arch lane
there, and is recorded here as **not admissible** for this close — the checkpoint's earlier
squash-merge intent is superseded by this requirement.

Post-merge verification, owed by the owner's merge and not claimed here:

  git merge-base --is-ancestor ee463d0b main        # expect success
  git show ee463d0b:docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s01-shared-interface-providers/acceptance.md   # recovery read

anchor ee463d0b · tag `closed/t1.p01.s01` (created by this close; local only — not pushed; it
preserves this clone's reachability of the anchor until the merge lands)
```

## Closed-work preservation report

```text
CLOSEOUT PRESERVATION — T1.P01.S01 (2026-10-16)
prose compacted:                1   acceptance.md, the slice's acceptance record — this stub, at its own path
reference promotions:           1   the shared F1/F3 interface ownership → reference/architecture.md §Ownership
renderable evidence archived:   0 files
evidence stubs / manifests:     0
transient artifacts removed:    0
historical anchor:              ee463d0b · tag closed/t1.p01.s01 (local only — not pushed)
required merge method:          merge commit (P1) — no squash, no rebase; post-merge anchor check owed
new live → archive prose links: 0
manual-owed verification rows:  0
remaining deferred items:       5   the Residuals above, each with a named owner (T1.P01.S06 / the F.2 provider / review)
permanent stubs added:          1   (the owner-ratified 2026-09-22 hybrid policy's accepted cost)
retained, not compacted:        ./implementation-plan.md stays live — the execution-structure gate reads
                                its `VERIFICATION` / `INTEGRATION ROUTE` declarations through the phase
                                README's Plan cell
```
