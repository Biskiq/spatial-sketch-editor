# Pre-P23B.8 follow-up R1 — the release-cost ranking (produced only after M1 landed)

```text
AUTHORITY: NONE — the R1 ranking record (§5, §6 S5). It ranks what is already measured; it chooses
nothing, fixes nothing, proposes no mechanism and enters no budget. Produced AFTER M1's session
record (§5.1: ranking first is a procedural STOP, not a shortcut): the M1 record
(./2026-09-27-M1-S4-m1-session-record.md) and both M1 captures landed first.
```

## 1. What is ranked, and from where

```text
SOURCE. The same keyed capture the P23B.11 S7 record reads: S7's browser profile
(../p23b.11-wall-chain-release-delay/2026-09-27-P23B.11-S7-browser-profile.json), i.e. the closed
S7 re-measurement on the S6 protocol (settled, zero dropped boundaries), fixtures straight-40 ·
all-curved-40 · owner-40-curved (+ connected advisory), classes `p23b11:wall-authoring` and
`p23b11:room-creation-commit`, 20 measured accepted actions per class. Nothing is re-captured here:
R1 is a reading of closed evidence, in the decision doc's order (P4 · D2 · D3).

THE THREE CANDIDATES, in the decision doc's own order:
  (1) canonical compile   `p2311:chain-canonical-gates`
  (2) the install's room-geometry-compile   `p2311:room-geometry-compile`
  (3) mesh-prebuild       `p2311:mesh-prebuild`
```

## 2. The pricing rule (§5.3), and how it is applied

```text
SELF-TIME ONLY WHERE EVERY OCCURRENCE IN THE CLASS IS EXCLUSIVE-PRICEABLE, using the S7 keyed
schema's rule (`[count, p50, p95, exclusiveSelf|null, exclusiveSelfWithheld]`): a row whose self time
is withheld anywhere in its class is MARKED and never priced by self. Nothing is summed across
classes, across rows, or across release windows. Where a row is withheld, its TOTAL p50 is the only
number it has, and that is what the table shows.
```

## 3. The evidence rows (p50 ms, self where priceable)

```text
`self` = exclusiveSelf p50 where every occurrence in the class was priceable; `withheld` = the count
of occurrences in that class that could not be exclusive-priced, so the row has no self number.
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
```

## 4. The ranking

```text
1  CANONICAL COMPILE — `chain-canonical-gates`. Largest on every committed class, by total, in both
   directions: 14.00 / 12.20 (straight) · 32.90 / 39.30 (all-curved) · 23.70 / 23.40 (owner) ms p50.
   Its self time is WITHHELD IN EVERY CLASS (2–18 of 20 occurrences unpriceable), so it cannot be
   priced by self at all; its position rests on totals, and on the fact that its TOTAL exceeds the
   other two rows' SELF everywhere (14.00 > 8.9 and 7.0; 32.90 > 11.7 and 10.5; 23.70 > 8.3 and 8.3).

2  ROOM-GEOMETRY-COMPILE — the install interval. 7.40 / 7.00 (straight) · 14.50 / 16.90 (all-curved)
   · 10.60 / 10.30 (owner) ms p50 total, self-priceable in every class: 7.0 / 6.8 · 10.5 / 11.1 ·
   8.3 / 8.2.

3  MESH-PREBUILD — after P23B.6's Wall-mesh reuse. 8.90 / 9.90 (straight) · 11.70 / 18.80
   (all-curved) · 8.30 / 8.80 (owner) ms p50 total, self-priceable everywhere and ≈ its own total:
   8.9 / 9.8 · 11.7 / 18.6 · 8.3 / 8.8.

WHY 2 IS ABOVE 3, AND WHERE THAT IS FRAGILE. By SELF time, room-geometry-compile is at or below
mesh-prebuild in EVERY committed class (7.0 vs 8.9, 6.8 vs 9.8, 10.5 vs 11.7, 11.1 vs 18.6, 8.3 vs
8.3, 8.2 vs 8.8), so the order holds under the §5.3 rule. It does NOT hold by TOTALS on
all-curved-40's `room-creation-commit`, where mesh-prebuild's total (18.80) exceeds
room-geometry-compile's (16.90) even though its self (18.6) is priced above the other's (11.1): the
two rows sit in different amounts of enclosing work. The ranking follows §5.3's self-time rule, and
this is the one class where a totals-based reading would swap rows 2 and 3.
```

## 5. What R1 may say, and what it may not

```text
MAY     · the order above, with these evidence rows, under the S7 capture's conditions: one DEV
           session, one machine, advisory numbers only, self-time only where priceable
        · that the first row cannot be priced by self time at all in today's capture, so its position
           is a totals-based statement and is marked as such
        · that M1 landed first: the M1 session record and both captures exist and are cited here,
           and the remaining lag M1 makes visible (release → next presented frame) is a POST-release
           wait, measured outside the accepted actions R1 prices. R1 ranks release cost; it is not a
           ranking of the total felt wait.

MAY NOT · choose a mechanism, or recommend WHICH cost to remove
        · propose a fix, an optimization, a redesign or a numeric target
        · enter P23B.8, decide its entry, or claim anything about P23B.5's release-scope reuse
        · sum across classes or rows, or read the connected advisory rows as evidence
        · reopen P23B.4 / P23B.5 / P23B.6 / P23B.7 / P23B.11
```

## Live evidence

```text
../p23b.11-wall-chain-release-delay/2026-09-27-P23B.11-S7-browser-profile.json   (the source capture)
../p23b.11-wall-chain-release-delay/2026-09-27-P23B.11-S7-remeasurement-record.md (the closed reading)
./2026-09-27-M1-S4-m1-session-record.md    (M1 landed first — the §5.1 order of work)
./2026-09-27-M1-chrome-leg.json  ./2026-09-27-M1-electron-leg.json
```
