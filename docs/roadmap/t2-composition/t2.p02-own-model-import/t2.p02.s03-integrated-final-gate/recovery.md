# T2.P02.S03 — first recovery attempt at `7d1212b6` — CLOSED STUB

```text
AUTHORITY: NONE — this stub records a historical recovery attempt.
STATUS:    HISTORICAL. The first recovery at 7d1212b6 repaired creator-model Resize/Duplicate,
           the Resize focus handoff, the silent empty-project refusal and the import digest split.
           It measured 456.7 KiB br Stage JS against the then ≤400 KiB hard budget; the later
           b9ba493b recovery measured 422.3 KiB br and the owner accepted it on 2026-10-27.
NOT:       the current verdict or a pass for any performance row.
```

## What it recorded

The first recovery made the creator-model manipulation and empty-project legs reachable and proved
them with a 2/2 acceptance run and 4/4 diagnostics in branded Chrome. It did not discharge the formal
performance rows, and the Stage bundle still missed the budget at that revision. The later
[recovery-head.md](./recovery-head.md) and the [acceptance stub](./acceptance.md) own the repaired
revision and the accepted verdict.

## Recovery

```text
git show 221facc4252b680695084765a2b97f35097d7b94:docs/roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s03-integrated-final-gate/recovery.md
anchor  221facc4 · tags closed/T2.P02.S03 and closed/T2.P02
```
