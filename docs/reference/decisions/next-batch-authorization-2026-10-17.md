# Next-batch authorization and viewport readiness route decision

**Date:** October 17, 2026. **Status:** **owner-approved** — the owner approved D1–D7 of the
[2026-10-17 next-batch proposal](../../roadmap/next-batch-2026-10-17.md#proposed-decisions) as proposed.
D1–D5 are applied by the PR that carries this record and take effect when it merges after independent
review. **D6/D7 are approved but not applied**: see [Application hold](#application-hold-d6d7).

This record is decision provenance, like the
[2026-10-16 S02 pair record](./s02-pair-authorization-2026-10-16.md). It changes no ratified contract:
AM-1–AM-8 and PLATE are unchanged, lifecycle and gate identity stay in the
[roadmap register](../../roadmap/README.md#gate-register), and each slice's scope stays in its plan.

## Rulings applied

| # | Ruling | Live statement owner |
| --- | --- | --- |
| D1 | `T1.P01.S07` (Stage↔F4 integration bridge) is registered in T1.P01. Its independently reviewed acceptance, with the complete merge gate on then-current `main`, records `T1.viewport-projection@1:viewport-projection-v1`, with `T1.P01.S02` as the unchanged sole provider. `T1.P01.S06` remains the exhaustive `FINAL PHASE GATE` and is no longer the viewport readiness route. The S02 acceptance record and its 2026-10-17 override are not reopened or edited. | T1.P01 README; S07, S04 and S06 plans |
| D2 | The host↔F4 wiring is assigned to `T1.P01.S07` (the explicit assignment the 2026-10-16 record provides for), together with adapter re-binding across installs and the AM-5 adapter contribution points. S07 has no Layout or Scene production writer. | S07 and S04 plans; T2.P01.S03 plan |
| D3 | The Head Save integration stays with `T1.P01.S04` (decision 1 of the S02 pair record). `F4.intent-acceptance@1:conditional-save-current-v1` joins S04's `Requires` at S04's own authorization, and the integration still precedes `T2.P01.S04`. | S04 plan |
| D4 | `T1.P01.S07` is **authorized**. It is not an architecture-cycle exposure; the T1.P01 window keeps its three. | T1.P01 slice register |
| D5 | `T3.P01.S03` is **authorized**, under the [batch A protocol](../../roadmap/cross-track-execution.md#authorized-batch-2026-10-17) and the split-on-discovery clause in its plan. | T3.P01 slice register |

Every consumed gate and required scope of S07 and T3.P01.S03 is `accepted` and `active` at ancestors
of post-PR #135 `main` (`c9aa53cf`); the proposal lists the commits. Batch A runs S07 and T3.P01.S03 in
parallel; neither consumes the other.

## Application hold (D6/D7)

D6 (register T4.P01 with all slices `proposed`) cannot be written truthfully today, and D7 (authorize
the docs-only `T4.P01.S01`) needs a registered phase row. The register checker refuses any registered
row — `proposed` included — whose `Consumes` names a gate version that does not exist. `T4.P01.S03`–`S05`
consume `F5.release-envelope@1` (still `undrafted`, no version), and the final gate S05 also consumes the
undrafted `T3.camera-experience-cutover@1`. Dropping those from `Consumes` would be the dishonest
registration the [T3.P02 proposal](../../roadmap/t3-experience/t3.p02-capture-and-cut-preview/README.md)
already refused. The proposal missed this; it is recorded as the proposal's error, not the owner's.
The owner's choice between the resolutions listed in the proposal is pending; until then T4.P01 stays
an unregistered draft and nothing in T4 is authorized.

## Explicit non-implications

- **No other slice is authorized.** `T1.P01.S04`–`S06`, `T2.P01.S03`–`S04`, `T3.P01.S04` and every T4
  candidate stay `proposed` or unregistered. Batch B (`T1.P01.S04` ∥ `T2.P01.S03`) needs its own
  authorization after S07 ships and `viewport-projection-v1` is accepted.
- **No gate changes state.** `T1.viewport-projection@1` stays `ratified` until S07's closeout.
- **No cycle transition.** The T1.P01 window stays open with exposures S02, S04 and S05.

## Provenance

Owner approval in the coordinating session, 2026-10-17, against post-PR #135 `main` (`c9aa53cf`), on
PR #136. Independent review precedes merge, and no implementation starts before the merge.
