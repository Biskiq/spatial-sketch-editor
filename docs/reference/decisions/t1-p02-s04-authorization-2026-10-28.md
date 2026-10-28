# T1.P02.S04 authorization: Integrated final gate — 2026-10-28

**Status: owner-authorized 2026-10-28.** In the message that started this slice the owner released
`T1.P02.S04` (Integrated final gate) from the production hold, granted implementation permission for
the gate's verification, fixes and evidence, and directed that it proceed without a separate
authorization PR. The owner also directed that the work be committed, pushed and opened as an
implementation PR ready for independent review. That authorization is recorded here and in the
[release list](../../roadmap/now.md); the owner's message is the approval this record preserves.

This record is decision provenance, like the [S03](./t1-p02-s03-authorization-2026-10-27.md),
[next-wave](./next-wave-authorization-2026-10-27.md),
[performance-foundation](./performance-foundation-authorization-2026-10-24.md) and
[batch E](./batch-e-authorization-2026-10-22.md) records. It ratifies no contract and creates no
gate, format, budget, package or phase. Lifecycle stays in the
[roadmap registers](../../roadmap/README.md); the slice's scope stays in its own plan; the
[release list](../../roadmap/now.md) owns permission.

**Base.** `origin/main` `db7e5cd9` — the merge of PR #209, which shipped `T1.P02.S03`
(acceptance anchor `cbdb4785`; `T1.P02.S02` shipped earlier on PR #201). `T1.P02.S01`, `S05`, `S06`,
`S02` and `S03` are all accepted and shipped at this base. The consumed gates
`F1.reference@1`, `F2.unit-envelope@1`, `F4.intent-acceptance@1` and `T1.viewport-projection@1`
are `accepted` in the [gate register](../../roadmap/README.md#gate-register), and each required
scope (`unit-resolution-v1`, `unit-envelope-v1`, `unit-acceptance-v1`,
`conditional-save-units-v1`, `viewport-projection-v1`) is `active`.

## Authorized and released

| Scope | Condition | Plan |
| --- | --- | --- |
| `T1.P02.S04` — Integrated final gate | Released. Owner-authorized 2026-10-28 from the trusted base `db7e5cd9`, with no separate authorization PR required. Exhaustive independent acceptance of native Wall creation on the integrated tree, including the deferred performance rows on the designated reference machine. Starts through the [T1 runbook](../../operations/t1-spatial-world/README.md) eligibility step, rechecking every consumed gate and active scope at its own trusted base. | [Integrated final gate](./../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s04-integrated-final-gate/implementation-plan.md) |

## Preserved

- S04 is the phase's declared **FINAL PHASE GATE**. Passing makes `T1.P02` closable; it does not
  close it. Phase closure remains an explicit, separate owner instruction, and this authorization
  does not merge or close `T1.P02`.
- the standing independent implementation PR and **P1 merge commit** rule;
- the slice's declared `exhaustive` verification tier and the complete repository contract: fast and
  heavy kernel correctness, the full editor suite, the unconditional architecture lane, root
  `check`/`build`, the affected shared-package checks, and `check:api` plus a DB-backed `test:api`
  with zero skips;
- every recorded exception and deferred obligation from S01, S02, S03, S05 and S06, including S01's
  unrun F2 S/M timings, S02's formal performance family and its 456.0 KiB br Stage hard-budget miss,
  S03's Opening F4/F8 family and Stage bundle exception, and S06's battery qualification,
  grid-XL/sweep rows and FO-1 … FO-5;
- the designated reference machine for hard performance rows (Apple MacBook Air M2, 16 GB; batch E,
  E6 amendment), the recorded power state, and the rule that an unmeasured row is never a pass;
- every hard budget, the one-compiler rule, the serialized shared `units/**` merge rule and each
  lane's own recorded shared-file claim;
- the [production hold](../../roadmap/README.md#production-implementation-hold) for every scope the
  [release list](../../roadmap/now.md) omits.

## Not authorized or changed

- no merge or formal closure of `T1.P02`; no track-completion or architecture-cycle event;
- no new product feature, format, gate, budget, package or dependency; fixes are limited to defects
  the gate's own verification demonstrates, and an unrelated improvement is reported rather than
  absorbed;
- no change to a recorded hard miss: S04 rechecks, and cannot erase, S02's 456.0 KiB br Stage result
  or any other recorded miss;
- no deployment, release, epoch activation or production-hold release beyond this slice;
- T2, T3, T4 and T5 successor scopes are unchanged.

## Owner signature

```text
T1.P02.S04 Integrated final gate approved and released — work autonomously through preparation,
implementation, verification, fixes and evidence; commit, push and open an implementation PR ready
for independent review; do not merge or close T1.P02.
Owner: repository owner (2026-10-28 direction)   Date: 2026-10-28
```
