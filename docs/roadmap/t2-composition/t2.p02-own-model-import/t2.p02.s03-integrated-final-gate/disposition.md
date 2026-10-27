# T2.P02.S03 — failed final-gate disposition — CLOSED STUB

```text
AUTHORITY: NONE — the phase README owns slice status; this stub records a historical disposition.
STATUS:    HISTORICAL. The gate failed at a025e2dd and was repaired through 7d1212b6, ea42c745 and
           8cb97fe8 to b9ba493b, where the owner accepted it on 2026-10-27 and closed T2.P02.
NOT:       a current verdict, a pass for any performance row or a phase/track state.
```

## What this record preserved

The failed gate at `a025e2dd`: two required rows were blocked, the plan's empty-project line was
unreachable on that base, and the Stage route first-load JS measured 447.0 KiB br against the then
≤400 KiB hard budget. The disposition separated the product repairs from the owner decisions on the
empty-project interpretation, the Stage budget and the formal pass-scoped performance method. Those
decisions were ruled on 2026-10-27: draw-then-place is accepted, the Stage budget is amended to
≤425 KiB br, and the unverified performance rows are deferred to named owners, never recorded as
passes.

The current verdict and the row-by-row evidence are in the [acceptance stub](./acceptance.md); the
ruling is in the
[decision record](../../../../reference/decisions/t2-s03-acceptance-and-budget-amendment-2026-10-27.md).

## Recovery

```text
git show 221facc4252b680695084765a2b97f35097d7b94:docs/roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s03-integrated-final-gate/disposition.md
anchor  221facc4 · tags closed/T2.P02.S03 and closed/T2.P02
```
