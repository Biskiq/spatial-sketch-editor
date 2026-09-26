# P23B.7 S4 — the gesture-scoped verdict set: differential, four-cell matrix, deterministic clauses (2026-09-25)

AUTHORITY: the ratified plan `./2026-09-22-P23B.7-interaction-optimization.md` §6 S4 + §7 (the
           four-cell sample-request-continuity obligation and DETERMINISTIC (i)–(iii)) + §0.8.2
           (the owner's clarification ruling) + the §0.8.3 measurement-routing amendment of
           2026-09-25 (owner ruling during S4). This record is S4's own evidence; it amends nothing
           and it does not close the slice.
STATUS:    S4 EXECUTED and green on the dedicated `P23B.7` branch, followed by S3's and S6's records.

## 1. What landed

```text
MECHANISM (layout-core, `layout-wall-first-precision.ts`)
  `createWallFirstArchitectureVerdictScope(baselineDocument)` — one gesture's verdict set:
    · INITIALIZATION: the first move of a target runs today's whole-document
      `validateWallFirstTopology(..., { openingSet: 'defer' })` VERBATIM on that move's candidate,
      wrapped in exactly one `preflight-topology` mark. If it is CLEAN, the scope records the target
      identity and every later move of that target evaluates ONLY that move's affected extent.
    · AFFECTED-ONLY PASS: `validateWallFirstTopologyPass(..., subject)` over the S3 extent
      (`wallIds` · `wallPairs` · `junctionPairs`), with `evaluateRooms: false` — the same stages in
      the same order through the SAME predicates, so path, code, message and first-failure order
      cannot diverge.
    · THE FALLBACK IS THE APPROVED ONE: a non-clean initialization never marks the target, so a
      gesture on a failing baseline (OR-3c) is served by the canonical whole-document pass on EVERY
      move — no request suppressed, no failure approximated. Underivable intents return `undefined`
      before any pass, exactly as the whole-document preflight does.
  `preflightWallFirstArchitectureCandidate(document, intent, sampling?, verdictScope?)` returns the
  scope's verdict when one is supplied; without one it is byte-for-byte the shipped path.
  `detectWallCurveTopologyCrossings(..., subject?)` scopes which Walls/pairs are EVALUATED; its
  sampling loop is untouched — every Wall is still sampled before the pair loop.

WIRING (apps/editor)
  `LayoutPlanViewport.svelte` builds ONE non-reactive scope at pointer-down from the frozen baseline
  document (`architectureEditBaselineDocument()`), after the sample-scope reset, and drops it on both
  exit paths (`finishArchitectureEditGesture`, the `cancelLocalPlanInteraction` bypass).
  `transientArchitectureEdit` threads it into the PREFLIGHT only; the proposal stage and the release
  planner keep their canonical paths. A fresh object per gesture makes "no verdict survives into the
  next gesture" structural (OR-8/OR-10), and the wiring has its own source contract
  (`p23b7-verdict-scope-wiring.test.ts`) because the component surface cannot be driven by the
  server-side harness.

TEST-SIDE EXTRACTION (no value moved)
  The S2 frozen case table moved verbatim from `p23b7-preflight-reference.test.ts` into
  `p23b7-preflight-reference-cases.ts` so S4's differential consumes the SAME table rather than a
  copy (importing the test file would have registered its suites). The S2 file keeps its four
  assertions unchanged.
```

## 2. OR-3 differential — scoped vs the frozen whole-document reference

```text
METHOD  Every case in the S2 table is driven as a THREE-MOVE, SAME-TARGET gesture — the no-op
        candidate, the midpoint, then the recorded intent — so the defect is reached by the
        affected-only pass rather than by the initialization (a single call would prove nothing).
        Each move compares `scope.verdict` against the live whole-document
        `preflightWallFirstArchitectureCandidate` on verdict, code, message and issue order, and the
        gesture's LAST move must reproduce the frozen entry — including the multi-defect
        issue-order row. The live whole-document path is re-asserted against the frozen entry
        beside it, so a simultaneous drift cannot move both sides together.

RESULT  All four OR-3 cases, the OR-8 rows and the issue-order row agree on EVERY move.
        Clean-baseline rows (committed fixtures, the cross-Room family, duplicate/zero-length and
        OR-8 rows) are served by the affected-only pass; rows whose baseline already carries a
        failure (OR-3c, the no-op-on-defective fixtures) take the canonical fallback with
        `initializations = 0` and `canonical = 3`. The F-C3 shape (a knot dragged toward an
        inter-Room crossing) is refused BY A SCOPED MOVE (`scoped` counter = 1, `canonical` = 1) with
        the exact frozen message. The issue-order row keeps the Junction stage first while its
        shadowed zero-length Wall (`w-east`) is asserted to be genuinely present in the candidate and
        inside the move's own extent.

SAMPLING CONTINUITY AT THE CORE  With the topology-gate observer attached, one canonical pass and
        one scoped pass on the same candidate report the SAME sampled-Wall set (12 for the 12-Wall
        fixture) — the crossing authority's per-Wall sampling precedes its pair loop, so scoping the
        pair loop removes no request. This is the mechanism behind the matrix's equality below.
```

## 3. The four-cell sample/verdict matrix (one axis at a time)

```text
The committed ratchet cases are driven through the SHIPPED transient path in four cells
(`p23b7-sample-verdict-matrix.test.ts` + `measureReuseRatchetCase(..., { verdict })`):

  cell  sampling  verdict mode      role
  C1    ON        whole-document    the retained pre-S4 verdict mode
  C2    ON        scoped            SHIPPED
  C3    OFF       scoped            sampling-disabled reference, production preflight re-derived
  C4    OFF       whole-document    both axes off (pre-S4 behaviour), retained only for the contrast

AXIS A — sample reuse ON/OFF with the verdict mode HELD FIXED (C1 vs C2, C4 vs C3):
  curved-40-junction-drag   requests 120 · derivations 44 (40 cold misses + 4 changed-input
                            refusals) · hits 76 · entries 44 · per-move preflight misses [40, 2, 2]
  straight-40-junction-drag all counters 0 · per-move misses [0, 0, 0] (no samples ⇒ the
                            continuity claim is vacuous there and is stated as such)
  The sampling-ENABLED cell owns `derivations`, `hits` and `preflightMissesPerMove`; the
  sampling-DISABLED cell owns `unscopedPreflightRequests` ALONE (120 / 0), and no scope miss is ever
  sourced from it. Every cell satisfies `reuseRatchetInvariantViolations([cell]) === []` ON ITS OWN,
  and `reuseRatchetCaseOf(C2)` equals the committed record BYTE-FOR-BYTE through the scoped path.

AXIS B — verdict OFF/ON with the sample scope held fixed (ON: C1 vs C2; OFF: C4 vs C3), and sampling
  ON/OFF with the verdict held fixed (C2 vs C3): the per-move verdicts are identical in every
  comparison (verdict + code + message), and the rendered attempts are deep-equal.

NON-VACUITY (verdict reuse actually ran): the shipped cells report one clean initialization and two
  affected-only moves per drag — `{"initializations":1,"scoped":2,"canonical":1}` — with the affected
  totals over the two scoped moves = 4 Walls · 10 Wall pairs · 6 Junction pairs (2/5/3 per move) on
  both ratchet fixtures. All three moves of the ratchet drag are `pending` in every cell.

SUPPRESSED REQUESTS — ACCOUNTED, NOT ASSUMED AWAY. Per cell and per move, the S4 request set equals
  the pre-S4 set: the pre-move series [40, 2, 2] / [0, 0, 0] is identical between verdict modes (and
  equals the committed record), and the counters equality is the same statement reconciled against
  the store. THE SUPPRESSED SET IS EMPTY; the request judged-vs-removed by verdict reuse is
  therefore "none", which is the §0.8.2 approved fallback — the crossing gate samples every Wall
  before its pair loop, so skipping invariant PAIRS leaves the request set, the ratchet record and
  every absolute invariant exactly as P23B.5 shipped them. `reuse:record` was NOT run and
  `reuse-counter-ratchet.json` was not touched; no hit is fabricated and no invariant is weakened.
```

## 4. DETERMINISTIC clauses (§7, corrected G-4)

```text
(i)   INITIALIZATION ONCE PER GESTURE, never per move: one clean initialization on a three-move
      gesture on both the 12-Wall and the 40-Wall fixture; the initialization is allowed to scale
      with document size and is not counted as affected work.
(ii)  INVARIANT PREDICATE EVALUATIONS ZERO on moves 2..k: after the initialization there is no
      canonical pass and no second initialization; each scoped move's evaluated subjects EQUAL that
      move's own extent by kind (Walls · Wall pairs · Junction pairs), and the moved Walls are a
      subset of the document. This is the only document-size-independent guarantee claimed.
(iii) AFFECTED CANDIDATE SETS AND VERDICTS RECOMPUTED PER MOVE: each move's counts are derived from
      ITS OWN patch (a target change re-initializes and the per-move counts then match the NEW
      target's extent, which the earlier target's extent did not contain). The per-move bound is
      that move's conservative candidate set — never a remembered superset and never a fixed count;
      its growth with the document is accepted by §0.8.1.
```

## 5. Gates at S4's commit

```text
npm run check:layout-core                     PASS (tsc --noEmit)
npm run check                                 PASS — editor + museum, 0 errors / 0 warnings
npx vitest run tests/lib/layout tests/lib/editor/layout tests/lib/bench
                                              PASS — 170 files passed | 1 skipped,
                                              2,230 tests passed | 1 skipped
npm run test:perf                             PASS — 8 files passed | 1 skipped, 62 passed |
                                              1 skipped (the reuse ratchet reproduces the committed
                                              counts through the scoped path; no re-record)
npm run test:arch                             PASS — 23 files / 254 tests
```

## 6. Limits and what S4 does not claim

```text
· No wall-clock or ms number is claimed here; S7 measures and carries §7's CARRIED LIMITS. S4's
  claims are counts, verdicts and equality.
· The matrix runs the two committed ratchet cases; the OR-3 differential runs the frozen table's
  documents. The straight control carries no sample requests, so its continuity claim is vacuous by
  construction and is recorded as such rather than dressed up.
· The four-cell matrix re-derives BOTH axes through the same production preflight at the S4
  revision; it retains the pre-S4 verdict MODE for the C1/C4 contrasts only, never as a shipped path.
· The scope is per gesture and per target; a target change or a non-clean initialization moves the
  gesture back to the canonical pass by design (§0.8.2 / R-2), so no reused negative verdict is
  claimed on an already-failing baseline.
· Per the §0.8.3 amendment: the next measurement is the ONE residual named by S6's capture
  (`commit-capture`'s 107–149 ms snapshot clone), not another full wall-authoring sweep; S5 runs only
  if that measurement (or the owner's own reproduction) names hit-test/snap, and S7 records what was
  measured.
```

## 7. Correction note — `affected` counts are CANDIDATE counts (PR #92 review, 2026-09-25)

```text
The scope stat this record prints as `affected` is renamed `candidates`: it is summed from each move's
affected EXTENT before the pass runs, so it bounds what a scoped pass may evaluate and never showed
what the predicates actually did. Everything else in this record stands as written — the frozen numbers
above ARE those candidate counts, and §4's DETERMINISTIC claims are now asserted against predicate-site
OBSERVATIONS (`WallFirstTopologyEvaluation`) that FAIL when the pass discards its subject. Both
corrections — the injective target identity and that observation — are recorded with their regression
case and both mutation runs in `./2026-09-25-pr92-correction-record.md`. §6's limits are unchanged.
```
