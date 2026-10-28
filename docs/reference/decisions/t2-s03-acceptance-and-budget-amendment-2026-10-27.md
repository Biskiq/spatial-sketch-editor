# T2.P02.S03 acceptance, Stage budget amendment and T2.P02 phase close — 2026-10-27

**Status: owner-ruled 2026-10-27.** The owner accepted the recovered `T2.P02.S03` final gate at
`b9ba493b`, amended the Stage route first-load JS hard budget from ≤400 to ≤425 KiB br, deferred the
unverified formal performance rows to named follow-up owners, and directed `T2.P02` to close.

This record is decision provenance. The [acceptance artifact](../../roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s03-integrated-final-gate/acceptance.md)
owns the gate evidence; the [phase README](../../roadmap/t2-composition/t2.p02-own-model-import/README.md)
owns lifecycle and the `PHASE CLOSE` block; [performance.md](../components/performance.md) owns the
amended row; the [release list](../../roadmap/now.md) owns permission. No track completion, gate
version, format, package or production state is created here.

## Accepted gate

`T2.P02.S03 — Integrated final gate` is **accepted by owner ruling** on the recovered product, tests
and harness revision `b9ba493b`. The documentation head that carried the evidence was `dc9a16de`; the
trusted base was integrated `main` `e1870769` (PR #204), including the T1 #201 merge `ce159a1e`. The
acceptance is not an `owner-override`: no accepted product row was waived.

Recorded evidence at that revision:

- exhaustive repository contract: 215 files / 2,663 tests, arch 22 files / 180 tests, heavy 11 files /
  138 tests, `check` 0 errors / 0 warnings, `build` clean, API 14 suites / 114 tests with 0 skips;
- branded-Chrome acceptance 3/3 in 45.8 s, including the empty-project draw-then-place journey and
  selection, move/turn, resize, duplicate and delete on the placed creator model;
- Stage route first-load JS 422.3 KiB br against the amended ≤425 KiB hard row (2.7 KiB headroom).

The empty-project line is ruled as **draw the enclosure, then import and place**, with the guidance
the acceptance record asserts. The creator-model manipulation finding is repaired and demonstrated.

## Stage first-load budget amendment

The owner ruled the evidence-backed [amendment proposal](../../roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s03-integrated-final-gate/delivery-budget-proposal.md)
in favour of the measured floor:

```text
previous  Delivery: Stage route first-load JS (br, cold)   ≤ 400 KiB   Hard
amended   Delivery: Stage route first-load JS (br, cold)   ≤ 425 KiB   Hard
measured  422.3 KiB br at b9ba493b                         2.7 KiB headroom
```

The existing rule that a slice may not grow the route by more than 25 KiB br without a recorded
reason is unchanged. The visitor `/p` first-load row is unchanged.

The amendment is **not retroactive**. `T1.P02.S02`'s 456.0 KiB br at `64b9435d` remains a recorded
miss against the ≤400 KiB budget that applied at that revision; its acceptance record is not
rewritten, and `T1.P02.S04` still carries its own integrated Stage recheck and the S02 performance
family.

## Deferred verification — not passes

The owner deferred the following rows to the named follow-up owners. **No row is recorded, waived or
promoted as a pass.** Deferral dispositions the acceptance prerequisite; it does not turn an
unmeasured or proxy row into evidence.

| Row or family | Disposition | Follow-up owner |
| --- | --- | --- |
| F5 formal pass-scoped admission long tasks | deferred; the 60-window clean observation stays an observation | T2 performance follow-up (T2 track) |
| F5 chosen → placed on the 5/25 MiB budget workloads | deferred; the S/M fixtures are not the budget files | T2 performance follow-up (T2 track) |
| F6 as defined (sequenced drag, input-to-matching-preview and completion) | deferred; the armed→accepted proxy is not the contract flow | T2 performance follow-up (T2 track) |
| F9 presented local feedback and durable receipt | deferred; DOM timestamps and loopback are not presentation/service baselines | T2 performance follow-up (T2 track) |
| F13 cold/repeat-use ten-cycle rows, geometry/texture/live-context clauses | deferred; the ten place/undo cycles are partial | T2 performance follow-up (T2 track) |
| GPU memory at M | blocked by the browser's per-page exposure; deferred for a capability disposition | T2 performance follow-up (T2 track) |
| F2, F3, F4, F7, F8 formal method; worker-thread split; real workload timing | deferred, unrun under the formal method | T2 performance follow-up (T2 track) |
| Shell observations; Draco/KTX2 sources; real R2; real >50 MiB decode; worker-boundary timing | deferred, owner-run | repository owner (owner-run), tracked by T2 |
| Placed model's own Index subject row; pointer move/turn decision | deferred product follow-up, not a gate claim | T2 track |

## T2.P02 phase close

The final gate is accepted, so the phase is closable. The owner also directly directed the phase to
close in the same request. The phase README records `PHASE CLOSE — Stage: closed`, the T2 phase
register reads `shipped`, and the T2 baton is reconciled to the closed phase. This is one bounded
phase close: it is **not** T2 track completion, and the track's remaining objectives stay owned by
future planning.

## Preserved

- the failed-gate disposition at `a025e2dd` and the first/intermediate recoveries at `7d1212b6`,
  `ea42c745` and `8cb97fe8` remain historical evidence for their own revisions;
- every accepted product row, the exhaustive contract and the browser journeys are recorded in the
  acceptance artifact and its `b9ba493b` evidence;
- `T1.P02.S02`'s acceptance, the 456.0 KiB br known miss and the S02 performance family deferred to
  `T1.P02.S04` are unchanged;
- T3, T4 and T5 lifecycles, batons and holds are untouched.

## Owner signature

```text
T2.P02.S03 accepted at b9ba493b; Stage hard budget amended to ≤425 KiB br JS
Formal performance rows deferred to the named owners; no row is a pass
T2.P02 closed by direct owner direction — one phase, not track completion
Owner: repository owner (2026-10-27 direction)   Date: 2026-10-27
```
