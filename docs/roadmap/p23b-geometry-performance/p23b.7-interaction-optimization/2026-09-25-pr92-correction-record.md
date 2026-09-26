# P23B.7 S4 correction — the target identity is injective, and the evaluation evidence is observed (PR #92 review, 2026-09-25)

AUTHORITY: the owner's **return for correction** of PR #92 at `73a5167c` (2026-09-25): two P2 blocking
           findings plus non-blocking dispositions. This record is the correction's evidence; it closes
           neither finding of the review nor the slice, and it changes no acceptance state.
STATUS:    BOTH corrections EXECUTED on `P23B.7` in ONE revertible commit. PR #92 stays OPEN, not
           merged and not accepted; re-review is the owner's call.

## 1. P2 — target-key collisions could reuse an invalid initialization (FIXED)

```text
THE DEFECT. `architectureIntentTargetIdentity` joined a target's fields with `:` — and Layout IDs may
CONTAIN `:` (`ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/`, in BOTH codecs:
`layout-wall-first-codec.ts:69` and `layout-codec.ts:16`). So two different targets shared one identity:

    (wall "A:B", knot "C")   ->  curve-control-move:A:B:C
    (wall "A",   knot "B:C") ->  curve-control-move:A:B:C

The scope compares that string, so a TARGET CHANGE could reuse the previous target's initialization:
the reviewer's reproduction has a schema-valid document whose baseline carries a crossing, moves the
first target's knot to REPAIR it (clean initialization), then switches to the colliding target whose
candidate still carries the crossing. The canonical gate refuses
(`unsupported_wall_topology`); the scoped path returned `pending` — INV-1 violated, and the promised
target-change re-initialization not honoured. (Not evidence that an ordinary drag switches targets:
the viewport holds its target fixed.)

THE FIX (smallest correction, as the review asked): every target kind now encodes its fields as a
TUPLE —

    function targetIdentity(fields: readonly string[]): string { return JSON.stringify(fields); }

— which keeps the components separable whatever they contain and stays a plain string, so the scope's
comparison is unchanged.

THE REGRESSION (`p23b7-verdict-scope.test.ts`, describe 'the target identity is injective'):
  · fixture `collidingTargetDocument()` — two Rooms in DIFFERENT COMPONENTS, both wall IDs and knot IDs
    schema-legal: Room 1's Wall `A:B` bulges through the Room exactly as OR-3(c)'s already-crossed
    baseline does (its knot `C` repairs it), Room 2's Wall `A` carries knot `B:C`. Different components
    is what makes the case discriminating: the second target's affected extent cannot contain Room 1's
    crossing, so a reused initialization cannot see it.
  · move 1 (repair) initializes clean; move 2 (the colliding target) must RE-INITIALIZE and return the
    canonical refusal — asserted as verdict, code and message equality with the live whole-document
    preflight, with `candidates` evidence `{ initializations: 1, canonical: 2, scoped: 0 }`.

MUTATION EVIDENCE (the guard bites): with the encoding reverted to `fields.join(':')`, the regression
FAILS — `expected { status: 'pending' } to deeply equal { status: 'known-invalid', … }` — while the
other 13 tests in the file pass. That is the reviewer's reproduction, reproduced by our own suite.
```

## 2. P2 — the deterministic clause was asserted against candidate counts, not evaluations (FIXED)

```text
THE GAP. `WallFirstArchitectureVerdictScopeStats.affected` was documented as "predicate evaluations the
scoped passes actually performed", but it was summed from each move's EXTENT BEFORE the pass ran. The
reviewer forced `validateWallFirstTopologyPass` to discard its scoped subject and evaluate the whole
document; all 38 tests across the five topology/matrix files still passed, so the slice's central
optimization could be removed without failing the assertion that claimed to guard it.

THE FIX, two parts.

(a) NAMES SAY WHAT THEY ARE. The stat is renamed `affected` -> `candidates` and documented as a BOUND
    ("summed from each move's affected extent BEFORE the pass runs, never a count of what it did"); the
    scope-stats header no longer says "count of predicate evaluations".

(b) EVALUATIONS ARE OBSERVED AT THE PREDICATE SITES. New test-only instrumentation in layout-core —
    `WallFirstTopologyEvaluation` plus `setWallFirstTopologyEvaluationObserverForTest` /
    `clearWallFirstTopologyEvaluationObserverForTest` — called immediately where a pass substitutes a
    subject into a predicate, for every stage:
      'junction-coincidence' (both branches) · 'zero-length-wall' · 'wall-chord' (both branches) ·
      'wall-self-crossing' · 'wall-pair-crossing' (both branches — after the component skip, the
      straight-pair skip and the extent prune, i.e. exactly where the predicate itself runs).
    Unset is zero behaviour change; the call is try/caught so an observer can never break the gate; and
    it is never set in production. The evaluation happens once per PREDICATE SUBSTITUTION: the
    crossing observer sits after the prune, so a skipped pair is not counted as evaluated.

(c) THE CLAIM IS NOW ASSERTED AGAINST THE OBSERVATION (the `(ii)` test, rewritten):
      · every observed evaluation belongs to THAT move's extent by kind — Walls for 'zero-length-wall'
        and 'wall-self-crossing', Junction pairs for 'junction-coincidence', Wall pairs for 'wall-chord'
        and 'wall-pair-crossing';
      · every scoped move evaluates SOMETHING (so a deleted observation cannot pass vacuously);
      · every scoped move evaluates STRICTLY FEWER subjects than the initialization did (the
        whole-document work is provably gone, not merely unmeasured);
      · the candidate counts are asserted separately, as the bound they are;
      · no second initialization and no canonical pass after the initialization, and the moved Walls
        stay a strict subset of the document (the fixture HAS unaffected subjects).

MUTATION EVIDENCE (the reviewer's mutation, now failing): passing `undefined` as the pass's subject —
i.e. discarding the scoped subject and evaluating the whole document — makes `(ii)` FAIL with
`junction-coincidence room-0:j1|room-0:j2: expected false to be true`, an evaluation outside that move's
extent, while the other 13 tests in the file pass. The assertion that claimed the invariant now
actually observes it.
```

## 3. What did NOT change

```text
· NO verdict, predicate, stage order, message, sample request or sample store changed: the correction
  adds an observation and an encoding, and removes nothing from the gate.
· The committed reuse ratchet is untouched and reproduces exactly (`test:perf` green; `reuse:record`
  was NOT run); `g3-baseline.json` was neither read nor written; no budget metric was added.
· The S4 record's frozen numbers stand as the evidence they were, with ONE naming correction: what it
  printed as `affected` is the candidate count, now named `candidates` (see its §6.1).
· S5 is still NOT taken; P23B.6/P23B.8 are untouched and unauthorized; the model-free capture fix is
  unaffected and its own record still stands.
```

## 4. Non-blocking dispositions (accepted as stated)

```text
· THE SNAPSHOT GUARD stays, with its stated limits: a name-based scan cannot establish universal
  absence of readers (aliases and unrecognised syntax escape it), and the payload bound detects a
  re-introduced clone, not arbitrary discarded work. Current consumer inspection, type checking and
  behavioural tests are what support the fix; the guard is defence in depth.
· RETENTION / HEAP: the review found no independent strong root introduced by the WeakMap and asked for
  a bounded heap comparison (repeated edits, history eviction, clearing) BEFORE any redesign. That is a
  named follow-up, not part of this correction; no redesign is proposed here.
```

## 5. Gates at the correction commit

```text
npm run check:layout-core                     PASS
npm run check (editor + museum)               PASS — 0 errors / 0 warnings
the topology/matrix suites                    PASS — 34 tests across
                                              p23b7-verdict-scope · p23b7-affected-extent ·
                                              p23b7-preflight-reference · p23b7-sample-verdict-matrix
npm test (full suite)                         PASS — 347 files passed | 1 skipped,
                                              4,913 tests passed | 1 skipped
npm run test:arch                             PASS — 23 files / 254 tests
npm run test:perf                             PASS — 8 files passed | 1 skipped, 62 passed |
                                              1 skipped (ratchet reproduced; no re-record)
npm run build (root; editor + museum)         PASS (adapter-vercel)
```

## 6. Limits

```text
· Both mutations above were run by editing the shipped source temporarily and reverting it; the tree
  at the correction commit contains neither mutation (verified by the gates above and the diff).
· The new instrumentation is test-only and off by default; it adds one function call per predicate
  substitution when an observer is attached, and none when it is not.
· The collision class fixed here is the DELIMITER class. The tuple encoding is injective for arbitrary
  strings, so no other field content can re-open it; the regression pins the class, not every possible
  future intent kind — a future kind must encode its fields as a tuple too, and the identity function
  is the single place that does so.
```
