# T3.P03.S01 — acceptance record: Planner scope and build isolation — CLOSED STUB

```text
AUTHORITY: NONE — this is closed evidence. The live slice criteria remain in
           ./implementation-plan.md; phase status/order → ../README.md#slice-register; F.4 semantics →
           ../../../../reference/composition-execution.md#product-convergence-destination.
STATUS:    ACCEPTED (`owner-override`) and CLOSED 2026-10-22. The owner waived the independent-review
           verdict for revision `95dc052e` only (ruling below). S01 is shipped; T3.P03 stays active
           and its final gate is T3.P03.S02.
SCOPE:     No gate row, capability record or source format changed. The one exported-shape addition is
           the optional `PlannerAdmission.writes` field of the accepted F4 interface.
```

## Delivered

- **Per-planner scope.** Unit acceptance holds a candidate's changed unit domains (from content
  revisions, not intent targets) to the producing planner's write set — `domain`, plus `writes` for a
  compound planner. The host-wide compound flag is only the grant. The RR-4 overreach is refused
  targeted and untargeted with source, revision and history unchanged.
- **Registration.** A compound planner whose `writes` is missing, empty, names its own domain,
  repeats an entry or names an ungranted domain is refused (`compound-write-set`), as is a
  single-domain planner declaring `writes`. The one compound planner,
  `unit.experience-presentation-stop-create`, declares `writes: ['camera']`.
- **Build isolation.** The shared public/Preview predicate, both Vite boundary plugins and both static
  surface gate scripts forbid the live `src/lib/authoring/` tree (the replaced token named the
  deleted `src/lib/editor/`). A Preview-surface source-closure test joined the arch lane.
- **Promotion.** The F.4 current-behavior paragraph in `reference/composition-execution.md` owns the
  durable contract.

## Evidence and residuals

At `5f82c638`: `npm run check` 0 errors / 0 warnings; arch lane 21 files / 171 tests; fast lane 1,947;
heavy lane 118; F4 suites 73. At `95dc052e` (after merging `main` through PR #175): arch lane 21 / 172.
The plugin-level mutation proofs are repository tests; the real `vite build` injections and the
Preview-closure injection are session evidence only. Disclosed beyond the plan's change list: the two
static surface gate scripts and the F.4 paragraph correction.

Manual-owed: the per-merge default-timeout `npm test` rerun (last green at `ffff320d`; two earlier
runs timed out untouched suites under unrelated load). Residual: T3.P03.S02 owns the phase's
integrated exhaustive proof.

## Entry points

```text
implementation  packages/project-model/src/units/acceptance.ts            (validateChange write set)
                packages/project-model/src/f4/prepare.ts                  (registration refusals)
                packages/project-model/src/f4/types.ts                    (PlannerAdmission.writes)
                apps/editor/src/lib/authoring/f4/acceptance-coordinator.ts
                apps/editor/src/lib/visitor/preview-surface-boundary.ts   (shared forbidden predicate)
regressions     apps/editor/tests/lib/authoring/f4-acceptance.test.ts     (RR-4 + Layout/Scene controls)
                apps/editor/tests/lib/authoring/f4-unit-acceptance.test.ts
                apps/editor/tests/lib/authoring/unit-acceptance-conformance.test.ts
                apps/editor/tests/vite/public-surface-boundary-plugin.test.ts
                apps/editor/tests/vite/preview-surface-boundary-plugin.test.ts
                apps/editor/tests/lib/visitor/preview-surface-closure.test.ts
```

## Owner ruling — independent-review verdict waived (2026-10-22)

```text
DATE:       2026-10-22
RULING:     owner waiver (explicit, recorded per the slice-closeout skill)
SCOPE:      T3.P03.S01 only, at implementation revision `95dc052e`
            (review-fix commit `5f82c638` + merge of `main` through PR #175)
WAIVED:     the independent-review verdict prerequisite for acceptance
NOT WAIVED: the plan's acceptance criteria, the declared architecture-integration tier,
            and the per-merge default-timeout `npm test` rerun
STATE:      register and baton read `owner-override`, never `reviewed`
```

A review at `b36ab624` raised four findings (unvalidated compound `writes`, an admitted empty write
set, a missing Layout-only RR-4 control, stale evidence wording); the same session fixed all four in
`5f82c638`, so no reviewer independent of that commit issued a verdict on the current revision.

## Recovery

```text
plan (retained live because the phase gate checker reads its VERIFICATION / INTEGRATION ROUTE):
  ./implementation-plan.md

full acceptance and closeout body:
  git show f77d55542806ca66903bc6d880884b1b3ef60ef2:docs/roadmap/t3-experience/t3.p03-shared-acceptance-and-measurement/t3.p03.s01-planner-scope-and-build-isolation/acceptance.md
```

P1 required PR #176 to land as a **merge commit**; squash/rebase would invalidate the recovery
anchor. Post-merge verification was completed on 2026-10-23: tag `closed/T3.P03.S01` peels to
`f77d55542806ca66903bc6d880884b1b3ef60ef2`, that anchor is an ancestor of merge commit `55683981`,
and the `git show` recovery command above resolves the full acceptance body. This verifies PR #176's
preservation anchor only; it does not claim any later PR merge.

## Closed-work preservation report

```text
CLOSEOUT PRESERVATION — T3.P03.S01 (2026-10-22)
prose compacted:                 1   acceptance; plan retained for gate-checker routing
reference promotions:            1   F.4 per-planner scope paragraph in reference/composition-execution.md
renderable evidence archived:    0 files / 0 bytes
evidence stubs / manifests:      0
transient artifacts removed:     0   (untracked prototype debug files were never committed)
historical anchor:               f77d55542806ca66903bc6d880884b1b3ef60ef2 · tag closed/T3.P03.S01 (pushed)
new live → archive prose links:  0
manual-owed verification rows:   1   per-merge default-timeout `npm test`
remaining deferred items:        1   T3.P03.S02 integrated exhaustive proof
permanent stubs added:           1   the owner-ratified hybrid preservation policy's accepted cost
required merge method:           merge commit (P1); post-merge anchor verification completed 2026-10-23
```

## Closeout self-check

```text
acceptance    PASS — claims match recorded evidence at its tested revisions; manual-owed row explicit
tier          PASS — architecture-integration evidence recorded; S02 is the declared integration route
shims         PASS — no unowned shim; closeout changed no production file
promotion     PASS — F.4 durable contract lives in reference/composition-execution.md
preservation  PASS — 1 prose stub; plan retained; anchor computed, tagged and tag pushed
routing       PASS — S01 shipped; T3.P03 active; register, release list and baton agree
baton         PASS — T3 baton names the next released work only; no closed-slice narrative
stable        PASS — no pending-merge state or branch-head pin in live routers
report        PASS — preservation counts, residual owners and recovery recorded above
scope         PASS — no implementation code changed during closeout
P1            PASS — merge method recorded; post-merge anchor verification owed
```
