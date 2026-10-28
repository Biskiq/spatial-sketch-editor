# T1.P02.S03 authorization: Opening family — 2026-10-27

**Status: owner-authorized 2026-10-27.** The owner directed the next T1 slice — `T1.P02.S03`
(Opening family) — released from the production hold after `T1.P02.S02` was accepted and shipped,
with the complete implementation plan and its plan review recorded before implementation starts.

This record is decision provenance, like the [next-wave](./next-wave-authorization-2026-10-27.md),
[performance-foundation](./performance-foundation-authorization-2026-10-24.md) and
[batch E](./batch-e-authorization-2026-10-22.md) records. It ratifies no contract and creates no
gate, format, budget, package or phase. Lifecycle stays in the
[roadmap registers](../../roadmap/README.md); the slice's scope stays in its own plan; the
[release list](../../roadmap/now.md) owns permission.

**Base.** `origin/main` `6b815770`: the [next-wave release](./next-wave-authorization-2026-10-27.md)
merged (PR #198), `T1.P02.S02` shipped on PR #201 (merge commit `ce159a1e`; anchor `36c18db9` and
tag `closed/T1.P02.S02` verified reachable), and the `T2.P02.S03` acceptance and closeout batch is
prepared on its own PR (#199), which carries this record.

## Authorized and released

| Scope | Condition | Plan review |
| --- | --- | --- |
| `T1.P02.S03` — Opening family | Released. The registered plan is an **outline**: the complete implementation plan is written and its plan review recorded before implementation starts. Starts after this record's PR (#199) merges on `main`, on its own trusted base, and rechecks every consumed gate and active scope through the runbook start step. Scope unchanged from the outline: wire layout-core's existing Opening create and delete planners as F4 Layout planners; the Opening family on the S02 rail (place on a Wall with host preference, and remove); an Opening that cannot fit its host refuses in words with a repair; deleting a Wall still takes its Openings in one undo step | [outline plan](../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s03-opening-family/implementation-plan.md) — completion and review owed before implementation |

## Preserved

- the standing independent implementation PR and **P1 merge commit** rule; no combined batch PR;
- the slice's declared `architecture-integration` verification tier and its integration route to the
  phase's declared `FINAL PHASE GATE`, `T1.P02.S04`'s integrated proof;
- every hard budget and performance row on the designated reference machine, the one-compiler rule,
  the serialized shared `units/**` merge rule and each lane's own recorded shared-file claim;
- `T1.P02.S02`'s acceptance, its 456.0 KiB br Stage known miss and its formal performance family,
  which remain `T1.P02.S04`'s and are neither re-opened nor discharged here;
- the [production hold](../../roadmap/README.md#production-implementation-hold) for every scope the
  [release list](../../roadmap/now.md) omits.

## Not authorized or changed

- `T1.P02.S04` — it starts only from its own owner release after S01, S05, S06, S02 and S03 are
  accepted;
- curves, levels, datums, overheads, nested courtyards or a general shell rebuild — S03 adds the
  Opening family only;
- T2 successor work — the next T2 step is an owner planning and authorization decision on component
  identity, resolution and admission with revision correspondence, not a registered slice;
- T4 (frozen behind Core Editor Stability) and T5 (E0 remains a separate commission decision);
- this release closes no phase, and changes no gate, format, budget or package; no deployment and no
  epoch activation.

## Owner signature

```text
T1.P02.S03 Opening family approved and released — starts after PR #199 merges; complete plan and plan review before implementation
Owner: repository owner (2026-10-27 direction)   Date: 2026-10-27
```
