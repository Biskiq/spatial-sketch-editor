# Batch B authorization: T1.P01.S04 ∥ T2.P01.S03

**Date:** October 17, 2026. **Status:** **owner-authorized**. The owner authorizes `T1.P01.S04` and
`T2.P01.S03` to run in parallel as batch B, the batch the
[2026-10-17 next-batch record](./next-batch-authorization-2026-10-17.md#explicit-non-implications)
deferred until `T1.P01.S07` shipped and `viewport-projection-v1` was accepted. The authorization lands
in the development-wave preparation PR (which also adds the local Docker Compose backend) and takes effect only when that PR merges after
independent review. Until then nothing here is claimable work.

This record is decision provenance, like the
[2026-10-16 S02 pair record](./s02-pair-authorization-2026-10-16.md). It changes no ratified contract:
AM-1–AM-8 and PLATE are unchanged, lifecycle and gate identity stay in the
[roadmap register](../../roadmap/README.md#gate-register), and each slice's scope stays in its plan.

## Authorization

| Slice | Phase | Plan | Consumes / Requires at authorization |
| --- | --- | --- | --- |
| `T1.P01.S04`: Existing Layout precision, with the Head Save integration | T1.P01 | [plan](../../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s04-existing-layout-precision/implementation-plan.md) | `F1.reference@1`, `F4.intent-acceptance@1`, `T1.viewport-projection@1` / `references-v1`, `local-single-domain-v1`, `conditional-save-current-v1`, `viewport-projection-v1` |
| `T2.P01.S03`: First coherent editing surface | T2.P01 | [plan](../../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s03-first-editing-surface/implementation-plan.md) | `F1.reference@1`, `F4.intent-acceptance@1`, `T1.viewport-projection@1` / `references-v1`, `local-single-domain-v1`, `viewport-projection-v1` |

**Prerequisites, verified against post-PR #142 `main` (`a8e4d45e`).** Every consumed gate is
`accepted` and every required scope is `active` in the [gate register](../../roadmap/README.md#gate-register):

- `F1.reference@1:references-v1`, accepted at `ee463d0b`.
- `F4.intent-acceptance@1:local-single-domain-v1` with its prerequisite `acceptance-invariants-v1`,
  accepted at `8ec0c5f1`.
- `F4.intent-acceptance@1:conditional-save-current-v1`, accepted through `T3.P01.S02` at `8dd53260`
  (PR #133).
- `T1.viewport-projection@1:viewport-projection-v1`, accepted through `T1.P01.S07` at `ab8504aa`, with
  `T1.P01.S02` as the unchanged sole provider. S07 shipped in PR #137 (merge `a0026cf4`), so the
  host↔F4 wiring, adapter re-binding and the AM-5 contribution points are on `main`.

All five commits are ancestors of `a8e4d45e`. The in-phase prerequisites hold: `T1.P01.S02`, `S03` and
`S07` are shipped for S04, and `T2.P01.S01` and `S02` are shipped for T2.P01.S03. Neither slice consumes
the other, and no T3 or T4 output is a prerequisite of either. Each slice's runbook start step still
re-checks eligibility at its own trusted base (`git merge-base HEAD main`), which must contain PR
#137's merge.

## Rulings

| # | Ruling | Live statement owner |
| --- | --- | --- |
| B1 | **`T1.P01.S04` is authorized with the Head Save integration in scope.** This applies ruling D3 and decision 1 of the S02 pair record. `conditional-save-current-v1` was accepted at authorization, so it joins S04's `Requires` and register row now; the scope is fixed here and never changes mid-slice. S04 is the Head's sole writer while it runs, and it must be accepted before `T2.P01.S04` starts. | T1.P01 README; S04 plan |
| B2 | **`T2.P01.S03` is authorized.** Launch conditions 1–4 of its plan hold at authorization, and condition 5 (the shared-file protocol) is in force for the batch. It does not wait for S04, the Head Save integration or conditional Save. | T2.P01 README; S03 plan |
| B3 | **The batch runs under the [batch B protocol](../../archive/roadmap/coordination-2026-10/cross-track-execution-2026-10-23.md#authorized-batch-b-2026-10-17).** S04 alone writes the Head and Layout adapter modules, and T2.P01.S03 alone writes its Scene adapter modules. Both register Place/Find/Card/instrument entries only through S07's contribution points, and neither edits a host core, route or shell module. A needed change there is a stop-and-report to T1. There is no imposed merge order inside the batch. Every merge reruns the complete merge gate on the then-current `main`. | cross-track execution |
| B4 | **No architecture-cycle transition.** `T1.P01.S04` is a listed exposure of the T1.P01 window, which `T1.P01.S02` opened on 2026-10-16. S04's start records no new opening; its exposure row and mechanism verdicts are recorded at its own closeout. `T2.P01.S03` is not an exposure. | architecture cycle; S04 plan |

## Explicit non-implications

- **No other slice is authorized.** `T1.P01.S05`–`S06`, `T2.P01.S04` and `T3.P01.S04` stay `proposed`.
  T3.P01.S04 has its own [authorization path](../../roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s04-live-ownership-cutover/implementation-plan.md#authorization-path),
  and nothing in batch B shortens it.
- **No T4 work of any kind.** Ruling R1-D stands: T4 stays `planning` until Core Editor Stability is
  accepted and the owner renews authorization.
- **No gate changes state.** No register row, version, provider or Accepted-capabilities entry
  changes. `T3.camera-experience-cutover` and `F5.release-envelope` stay `undrafted`.
- **No artificial cross-track dependency.** Batch B adds no edge to T3 or T4. The only cross-track
  inputs are the accepted F1/F4 scopes and the T3-owned Save state machine that S04 mounts.
- **No milestone claim.** Batch B feeds the Layout-editing, Scene-composition and durable-Save rows of
  [Core Editor Stability](../../roadmap/core-editor-stability.md), whose criteria and acceptance route
  are unchanged.

## Provenance

Owner request in the coordinating session on 2026-10-17, against post-PR #142 `main` (`a8e4d45e`), in
the development-wave preparation PR. That PR also adds the local Docker Compose backend and reconciles
T3 bookkeeping. Independent review precedes merge, and no implementation starts before the merge.
