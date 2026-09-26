# P23B.7 S4 correction — injective target identity + predicate-site evaluation evidence (CLOSED)

```text
AUTHORITY: NONE — closed-work stub. The corrected contract is owned in code (`targetIdentity` ·
`WallFirstTopologyEvaluation` in `packages/layout-core/src/layout-wall-first-precision.ts`) and by
the regressions in `apps/editor/tests/lib/layout/p23b7-verdict-scope.test.ts`. The owner ACCEPTED
the corrected head 2026-09-25 with no blocking findings. Full body recoverable via the recovery line.
```

## Delivered (both P2 findings fixed, one revertible commit `ee0dbecd`)

```text
(1) TARGET IDENTITY. `architectureIntentTargetIdentity` joined a target's fields with `:` while
    Layout IDs may contain `:` (ID_PATTERN admits it in BOTH codecs), so `(wall "A:B", knot "C")` and
    `(wall "A", knot "B:C")` shared one key — a target change could reuse the previous target's
    initialization and report `pending` where the canonical gate refuses (`unsupported_wall_topology`).
    Targets now encode their fields as a JSON TUPLE; the reviewer's collision case is a regression
    (`collidingTargetDocument`) that FAILS under the old encoding.
(2) EVALUATION EVIDENCE. `stats.affected` was summed from each move's extent BEFORE the pass ran, so
    the reviewer's whole-document mutation stayed green. It is renamed `stats.candidates` and
    documented as a BOUND; what the predicates were actually asked is OBSERVED AT THE PREDICATE SITES
    (`WallFirstTopologyEvaluation`; unset by default, try/caught, never set in production) for every
    stage. Test `(ii)` now requires every scoped move's evaluations to lie inside its own extent by
    kind, to be non-empty, and to be strictly fewer than the initialization's; discarding the pass's
    subject FAILS that test (verified by mutation).
```

Nothing else moved: no verdict, predicate, stage order, message, sample request or ratchet value
changed; no baseline or budget metric was touched.

## Entry points

```text
implementation  packages/layout-core/src/layout-wall-first-precision.ts
regressions     apps/editor/tests/lib/layout/p23b7-verdict-scope.test.ts
                (collidingTargetDocument · assertEvaluationsStayInsideExtent)
```

## Recovery

```text
git show ee0dbecd:<this path>          # full body (the correction commit)
git show closed/p23b.7:<this path>     # as of the accepted head
DEGRADATION (squash): branch commits are not ancestors of `main` post-merge; recovery runs via
git fetch origin refs/pull/92/head && git show <A>:<path>. tag closed/p23b.7 is local only.
```
