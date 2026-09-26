# P23B.7 S4 — the gesture-scoped verdict set (CLOSED)

```text
AUTHORITY: NONE — closed-work stub. The live contract is owned in code
(`createWallFirstArchitectureVerdictScope` · `validateWallFirstTopologyPass` in
`packages/layout-core/src/layout-wall-first-precision.ts`; the wiring in `LayoutPlanViewport.svelte`
+ `layout-transient-edit.ts`) and by its tests. The PR #92 correction round is recorded in the
sibling correction record. Full body recoverable via the recovery line.
```

## Delivered

One gesture's verdict set: the first move of a target runs the whole-document pass verbatim on that
move's candidate; a CLEAN result initializes the target and every later move evaluates only its own
re-derived affected extent through the SAME predicates — path, code, message and first-failure
order cannot diverge. A non-clean baseline or a target change stays on the canonical pass: the
approved fallback, with no request suppressed and no failure approximated. The viewport builds one
non-reactive scope at pointer-down from the frozen baseline and drops it on both exit paths
(`finishArchitectureEditGesture`, the `cancelLocalPlanInteraction` bypass); only the preflight is
threaded.

## Evidence

OR-3 (a)–(d), OR-8 and the issue-order row driven as three-move same-target gestures: every scoped
verdict equals the frozen whole-document reference, and the F-C3 crossing is refused BY the scoped
pass. The four-cell sample/verdict matrix reproduces the committed ratchet BYTE-FOR-BYTE through the
scoped path (no re-record) with the per-move request series equal in both verdict modes — verdict
reuse removes NO sample request (the crossing gate samples per Wall before its pair loop) — and
P23B.5's absolute invariants hold per cell. Deterministic clauses are asserted against predicate-site
observations (`WallFirstTopologyEvaluation`), not candidate counts (correction round, `ee0dbecd`).

## Entry points

```text
implementation  packages/layout-core/src/layout-wall-first-precision.ts
wiring          apps/editor/src/lib/editor/layout/LayoutPlanViewport.svelte · layout-transient-edit.ts
tests           apps/editor/tests/lib/layout/p23b7-verdict-scope.test.ts ·
                p23b7-verdict-scope-wiring.test.ts · p23b7-affected-extent.test.ts ·
                p23b7-preflight-reference.test.ts (+ cases helper) ·
                apps/editor/tests/lib/bench/p23b7-sample-verdict-matrix.test.ts
```

## Recovery

```text
git show ee0dbecd:<this path>          # full body (last full commit; the correction round touched it)
git show closed/p23b.7:<this path>     # as of the accepted head
DEGRADATION (squash): branch commits are not ancestors of `main` post-merge; recovery runs via
git fetch origin refs/pull/92/head && git show <A>:<path>. tag closed/p23b.7 is local only.
```
