# Pre-P23B.8 follow-up R1 — the release-cost ranking (produced only after M1 landed)

```text
AUTHORITY: NONE — the R1 ranking record (§5, §6 S5). It ranks what is already measured; it chooses
nothing, fixes nothing, proposes no mechanism and enters no budget. Produced AFTER M1's session
record (§5.1: ranking first is a procedural STOP, not a shortcut): the M1 record
(./2026-09-27-M1-S4-m1-session-record.md) and both M1 captures landed first.

CORRECTED 2026-09-27 (§6). The first version of §4 ranked rows 2 and 3 in the OPPOSITE direction to
the one it used for row 1 — row 1 was ranked for being the LARGEST cost and rows 2/3 were ordered by
which was SMALLER — and it compared a withheld inclusive total with priceable exclusive selves. §4
is rewritten in one direction only. NO number in §3 changed: the correction is about what the
numbers are allowed to say.
```

## 1. What is ranked, and from where

```text
SOURCE. The same keyed capture the P23B.11 S7 record reads: S7's browser profile
(../p23b.11-wall-chain-release-delay/2026-09-27-P23B.11-S7-browser-profile.json), i.e. the closed
S7 re-measurement on the S6 protocol (settled, zero dropped boundaries), fixtures straight-40 ·
all-curved-40 · owner-40-curved (+ connected advisory), classes `p23b11:wall-authoring` and
`p23b11:room-creation-commit`, 20 measured accepted actions per class. Nothing is re-captured here:
R1 is a reading of closed evidence, in the decision doc's order (P4 · D2 · D3).

THE SOURCE'S POPULATION IS NOT M1'S. S7's per-class rows are taken over the class's accepted actions
with the warm-up sliced from THOSE (accepted-then-slice), which is why every S7 class reports 20. M1
slices the path's leading completed actions first and then keeps the accepted ones (the interaction
report's own rule), which is why M1's two `wall-authoring` classes report 23. Both are stated where
they appear; the two sources' rows are NEVER compared by count (§6.3).

THE THREE CANDIDATES, in the decision doc's own order, with what each one actually wraps:
  (1) canonical compile   `p2311:chain-canonical-gates`   — the wall-chain commit's FINAL GATES:
      document validation plus a FULL wall-first compile, so it ENCLOSES a
      `p2311:room-geometry-compile` occurrence. Its p50 is INCLUSIVE by construction.
  (2) the install's room-geometry-compile   `p2311:room-geometry-compile` — the shared core compile
      (`compileLayoutGeometrySource`) inside the wall-first compile.
  (3) mesh-prebuild       `p2311:mesh-prebuild` — one full-generation wall-mesh preparation inside
      the install (reported only on a cache miss).
```

## 2. The pricing rule (§5.3), and how it is applied

```text
SELF-TIME ONLY WHERE EVERY OCCURRENCE IN THE CLASS IS EXCLUSIVE-PRICEABLE, using the S7 keyed
schema's rule (`[count, p50, p95, exclusiveSelf|null, exclusiveSelfWithheld]`): a row whose self time
is withheld anywhere in its class is MARKED and never priced by self. Nothing is summed across
classes, across rows, or across release windows.

AND THE ONE DIRECTION THIS RECORD RANKS IN. A row is placed by the size of what it COSTS, never by
which of two rows happens to be smaller: the largest comparable cost is first. Two rows are
comparable ONLY when both have exclusive self; an inclusive total and an exclusive self are never
ordered against each other, and a row with no exclusive self is REPORTED but not RANKED. Where a
ranking claim rests on an inclusive total instead, it is stated as such and is not called a ranking
of exclusive cost.
```

## 3. The evidence rows (p50 ms, self where priceable)

```text
`self` = exclusiveSelf p50 where every occurrence in the class was priceable; `withheld` = the count
of occurrences in that class that could not be exclusive-priced, so the row has no self number.
`total` is INCLUSIVE: it contains the work of every mark nested inside the row.
```

| fixture | class | `chain-canonical-gates` total | self | `room-geometry-compile` total | self | `mesh-prebuild` total | self |
| --- | --- | --- | --- | --- | --- | --- | --- |
| straight-40 | `wall-authoring` | 14.00 | **withheld (8/20)** | 7.40 | 7.0 | 8.90 | 8.9 |
| straight-40 | `room-creation-commit` | 12.20 | **withheld (4/20)** | 7.00 | 6.8 | 9.90 | 9.8 |
| all-curved-40 | `wall-authoring` | **32.90** | **withheld (16/20)** | 14.50 | 10.5 | 11.70 | 11.7 |
| all-curved-40 | `room-creation-commit` | **39.30** | **withheld (2/20)** | 16.90 | 11.1 | 18.80 | 18.6 |
| owner-curved-40 | `wall-authoring` | 23.70 | **withheld (18/20)** | 10.60 | 8.3 | 8.30 | 8.3 |
| owner-curved-40 | `room-creation-commit` | 23.40 | **withheld (18/20)** | 10.30 | 8.2 | 8.80 | 8.8 |
| connected (advisory) | `wall-authoring` | 11.90 | **withheld (20/20)** | 5.70 | 4.1 | 4.20 | 4.1 |
| connected (advisory) | `room-creation-commit` | 11.80 | **withheld (17/20)** | 5.70 | 4.2 | 4.50 | 4.4 |

```text
The connected rows are shown for completeness of the source only: the connected case is advisory and
is never a recorded row (the same rule M1 applies to its own tables). The ranking below reads the
three committed fixtures.

WHAT THE PAIR OF COLUMNS DOES. On all-curved-40 `wall-authoring` the two readings genuinely disagree:
room-geometry-compile's TOTAL (14.50) is above mesh-prebuild's (11.70) while its SELF (10.5) is
below mesh-prebuild's (11.7) — 4 ms of room-geometry-compile's total is work inside it that belongs
to its own children. That one class is the reason §4 ranks on self only, states the total-based
reading separately, and never mixes the two.
```

## 4. The ranking (corrected 2026-09-27)

```text
RANKED BY EXCLUSIVE SELF — the only signal both priceable rows have:

1  MESH-PREBUILD — `p2311:mesh-prebuild`. Self-priceable in every committed class, self ≈ its own
   total everywhere (it has no nested marks of its own): 8.9 / 9.8 (straight) · 11.7 / 18.6
   (all-curved) · 8.3 / 8.8 (owner) ms p50. It is the LARGER exclusive cost in FIVE of the six
   committed classes and LEVEL in the sixth (owner `wall-authoring`, 8.3 vs 8.3). No committed
   class has it below room-geometry-compile's self.

2  ROOM-GEOMETRY-COMPILE — `p2311:room-geometry-compile`, the shared core compile inside the
   wall-first compile. Self-priceable in every class: 7.0 / 6.8 (straight) · 10.5 / 11.1
   (all-curved) · 8.3 / 8.2 (owner) ms p50. At or BELOW mesh-prebuild's self in EVERY committed
   class — below in five, level in one — so it is second, and no class shows the reverse.

   This is the opposite of what this record first said. The first version ordered 2 above 3 because
   room-geometry-compile's self is the SMALLER of the two, which answers "which of these two is
   cheaper" while row 1 was placed by "which is largest". The numbers in §3 are unchanged; only the
   direction was wrong.

3  CANONICAL COMPILE — `p2311:chain-canonical-gates`. REPORTED, NOT RANKED: its exclusive self is
   WITHHELD IN EVERY COMMITTED CLASS (2, 4, 16, 18, 18 of 20 occurrences unpriceable — it encloses a
   full wall-first compile and document validation), so it has no exclusive number to compare with
   either row above and no place in an exclusive-cost ranking at all.

   Its INCLUSIVE total is the largest in every committed class (14.00 / 12.20 · 32.90 / 39.30 ·
   23.70 / 23.40 ms p50) and is larger than both other rows' TOTALS in every class. That is a
   statement about enclosing intervals, not a cost ranking: a total contains its children, and this
   row's children include a full compile.

WHY ROWS 1 AND 2 ARE CLOSE ENOUGH THAT THIS IS NOT A GAP TO CLOSE. The two exclusive selves sit
within roughly 0.5–7.5 ms of each other in every committed class, and in one class they are equal.
The ranking states an order; it does not claim a magnitude gap, and it chooses nothing (§5).
```

## 5. What R1 may say, and what it may not

```text
MAY     · the corrected order above, with these evidence rows, under the S7 capture's conditions:
           one DEV session, one machine, advisory numbers only, exclusive self only where priceable
        · that mesh-prebuild is the larger exclusive cost in five of six committed classes and level
           in the sixth, and that room-geometry-compile is at or below it in every class
        · that the canonical gates row cannot be placed by exclusive cost at all (self withheld in
           every class), that its total is the largest in every class, and that this is a statement
           about enclosing intervals
        · that the total-based reading of rows 2 and 3 disagrees with the self-based one in THREE
           classes (room-geometry-compile's total is larger on all-curved `wall-authoring` 14.50 vs
           11.70, owner `wall-authoring` 10.60 vs 8.30 and owner `room-creation-commit` 10.30 vs
           8.80), which is why neither reading may be mixed with the other
        · that M1 landed first: the M1 session record and both captures exist and are cited here,
           and the remaining lag M1 makes visible (release → next presented frame) is a POST-release
           wait, measured outside the accepted actions R1 prices. R1 ranks release cost; it is not a
           ranking of the total felt wait.
        · that these rows are the WALL-CHAIN COMMIT's numbers: M1's drag classes measure the same
           mark on another path (the Plan drag preview) and report a different magnitude for it
           (./2026-09-27-M1-R1-corrections-and-attribution-record.md §3). That does NOT enter this
           ranking — different source, different path, different population — but it does mean the
           S7 numbers above must not be read as the ceiling of this mark.

MAY NOT · choose a mechanism, or recommend WHICH cost to remove
        · propose a fix, an optimization, a redesign or a numeric target
        · rank a row by an inclusive total, or compare an inclusive total with an exclusive self
        · enter P23B.8, decide its entry, or claim anything about P23B.5's release-scope reuse
        · sum across classes or rows, or read the connected advisory rows as evidence
        · reopen P23B.4 / P23B.5 / P23B.6 / P23B.7 / P23B.11
```

## 6. The correction, recorded

```text
6.1 WHAT WAS WRONG. §§1–5 above are the corrected record. Three defects were found in the first
    version by review (2026-09-27) and confirmed against the source capture:

    (a) DIRECTION. §4 ranked `room-geometry-compile` second BECAUSE its exclusive self was the
        smaller, while ranking `chain-canonical-gates` first because its total was the largest. Two
        rows cannot be ordered by opposite criteria in one ranking. Corrected: one direction, the
        larger comparable cost first (§2, §4).
    (b) A PRICING RULE USED AS AN ORDERING RULE. §5.3 says WHEN a row may be priced by self, not how
        two rows are ordered. The old §4 justified row 2's position with it anyway: "room-
        geometry-compile is at or below mesh-prebuild in EVERY committed class ... so the order
        holds under the §5.3 rule" used the SMALLER exclusive self as the reason for the HIGHER rank.
        The same paragraph then set a totals-based observation about the same pair beside that
        justification ("it does NOT hold by TOTALS on all-curved-40's `room-creation-commit`"), so a
        reader was left with one ordering argued from two different quantities in two different
        directions. Corrected: exclusive selves are compared with exclusive selves and order rows 1
        and 2; totals are stated separately and never ordered against a self (§3, §4).
    (c) THE UNPRICEABLE ROW AT THE TOP. The old §4 placed a row first whose exclusive self is
        withheld in EVERY committed class (2–18 of 20 occurrences), on the strength of a comparison
        between its total and the other rows' selves. Corrected: that row is reported, marked
        unrankable on exclusive cost, and its inclusive total is described as what it is (§4).
    (d) WHAT DID NOT CHANGE. Every number in §3 — the totals, the selves, the withheld counts — is
        exactly as the closed S7 capture reports it, re-read and confirmed. The ranking §4 is a
        different statement ABOUT those numbers; nothing was re-measured, re-captured or re-run to
        produce this correction.

6.2 WHAT THE CORRECTION PROPAGATES TO. The old ordering was cited in the baton, in the
    phase README and in the acceptance record as the slice's R1 output. Each of those now points at
    this correction. The decision doc's D2/D3 premises are NOT rewritten here: they are the decision
    record that queued the ranking, and the corrected reading is a fact beside them
    (see §6.3 and the corrections record's §4 for what it means for the queue).

6.3 WHAT THIS CORRECTION DOES NOT CLAIM. It does not say which row to remove, does not recommend a
    mechanism, and does not turn the ordering into a priority: rows 1 and 2 differ by 0.5–7.5 ms p50
    in five classes and by 0 in one. It also does not reconcile the two captures' populations into
    one number: S7's rows are over 20 measured accepted actions (accepted-then-slice) and M1's
    `wall-authoring` rows are over 23 (slice-then-filter, the interaction report's rule) — different
    evidence, both stated, never compared by count.
```

## Live evidence

```text
../p23b.11-wall-chain-release-delay/2026-09-27-P23B.11-S7-browser-profile.json   (the source capture)
../p23b.11-wall-chain-release-delay/2026-09-27-P23B.11-S7-remeasurement-record.md (the closed reading)
./2026-09-27-M1-S4-m1-session-record.md    (M1 landed first — the §5.1 order of work)
./2026-09-27-M1-R1-corrections-and-attribution-record.md  (the correction pass, §6 above)
./2026-09-27-M1-chrome-leg.json  ./2026-09-27-M1-electron-leg.json
    (both legs: working tree only, NOT committed — gitignored, ~40k pretty-printed lines each)
```
