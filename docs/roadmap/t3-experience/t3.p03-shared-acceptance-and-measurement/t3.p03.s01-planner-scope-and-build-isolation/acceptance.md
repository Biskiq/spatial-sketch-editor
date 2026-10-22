# T3.P03.S01 — acceptance record: Planner scope and build isolation

**Slice:** T3.P03.S01 · **Status:** closed out 2026-10-22, awaiting the owner's merge of
`t3/p03-s01-planner-scope-build-isolation` · **Acceptance:** `owner-override` — the independent-review
verdict prerequisite was waived by the owner ruling below, for revision `95dc052e` only ·
**Plan:** [implementation-plan.md](./implementation-plan.md) (owns the scope and criteria) ·
**Phase:** [T3.P03](../README.md) · **Register:** [phase slice register](../README.md#slice-register)

**Basis.** Accepted by the owner's explicit closeout request and the waiver ruling in this record
(see [Owner ruling](#owner-ruling--independent-review-verdict-waived-2026-10-22)). Acceptance covers the
plan's criteria and its declared **architecture-integration** tier at the tested revision below. No
independent-review verdict exists for this revision; none is claimed.

**Tested revisions.** Review-fix head `5f82c638` (on top of `b36ab624`), and merged head `95dc052e`
(merge of `origin/main` through PR #175). The merged head is the revision this record and the phase
register name.

**Verification evidence** (run in session; numbers are as recorded, not re-run for this close):

| Check | At `5f82c638` | At `95dc052e` |
| --- | --- | --- |
| `npm run check` | 0 errors, 0 warnings | not re-run |
| `npm run test:arch` | 21 files, 171 tests passing | 21 files, 172 tests passing |
| `npm run test:fast` | 1947 tests passing | not re-run |
| `npm run test:heavy` | 118 tests passing | not re-run |
| F4 suites (`f4-acceptance`, `f4-unit-acceptance`, `unit-acceptance-conformance`) | 73 tests passing | not re-run |

Acceptance rows covered:

1. The RR-4 overreach planner is refused both untargeted and Scene-targeted, with source, revision and
   history unchanged. Layout-only and Scene-only controls succeed. The joint Experience planner
   succeeds. The same planner with a Layout write is refused. A compound planner with a missing, empty,
   self, repeated or ungranted write set cannot register.
2. Plugin mutation tests: an authoring import from the public root and from the Preview root each fails
   its plugin; the runtime-safe controls pass. The Preview closure test is in the arch lane.
3. The existing proofs still pass, per the lanes above.

**Owed.** The full default-timeout `npm test` gate is a per-merge rerun the owner runs at the merged
head. It is not claimed here. Per the disclosure below, the last green `npm test` ran at `ffff320d`.

**Not in this record.** No capability entry, gate row or source format changes. `T3.P03.S01` is not the
phase's final gate: the phase's exhaustive proof routes to
[`T3.P03.S02`](../t3.p03.s02-measurement-workflow-and-final-gate/acceptance.md).

Acceptance records the evidence its declared **architecture-integration** tier requires — plus the
named integration-route obligations — in the form
[the tests README](../../../../../apps/editor/tests/README.md#what-a-change-requires) requires.

**Disclosures.**

For that review: the implemented change also retargets the two static surface gate scripts (the same
dead deleted-tree token) and corrects the F.4 current-implementation paragraph, neither of which the
plan's change list names, so acceptance must disclose both. The plugin-level mutation proofs (an
authoring module imported by each root, directly and through a leaf, plus runtime-safe controls)
are repository tests; only the real `vite build` injections and the Preview-closure injection are
session evidence. Review hardening also refuses, at registration, a compound write set that is
empty, repeats an entry, names the planner's own domain or a domain the profile does not admit, and
adds a Layout-only control beside the Scene-only one in the RR-4 regression. The default-timeout `npm test` gate ran
green at `ffff320d` once host load fell; two earlier runs timed out untouched suites under unrelated
load average 47, and the per-merge rerun remains as the contract requires.

## Owner ruling — independent-review verdict waived (2026-10-22)

```text
DATE:     2026-10-22
RULING:   owner waiver (explicit, recorded here per the slice-closeout skill)
SCOPE:    T3.P03.S01 only, at implementation revision `95dc052e`
          (review-fix commit `5f82c638` + merge of `main` through PR #175)
WAIVED:   the independent-review verdict prerequisite for acceptance
NOT WAIVED: the plan's acceptance criteria, the declared architecture-integration tier,
          and the per-merge default-timeout `npm test` rerun
STATE:    register and baton read `owner-override`, never `reviewed`
```

Context: a review of the implementation at `b36ab624` raised four findings: compound `writes`
unvalidated at registration, an empty compound write set admitted, a missing Layout-only control in
the RR-4 regression, and stale evidence wording here and in the plan status. The same session fixed
all four in `5f82c638`, so no reviewer independent of that fix commit has issued a verdict on the
current revision. The owner waives that verdict for this slice and revision only. The waiver does not
carry to any other slice or to any later revision of this one.
