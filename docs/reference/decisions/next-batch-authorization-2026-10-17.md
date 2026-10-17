# Next-batch authorization and viewport readiness route decision

**Date:** October 17, 2026. **Status:** **owner-approved** — the owner approved D1–D7 of the
[2026-10-17 next-batch proposal](../../roadmap/next-batch-2026-10-17.md#proposed-decisions) as proposed.
D1–D5 are applied by the PR that carries this record and take effect when it merges after independent
review. D6/D7 were first approved but held ([Application hold](#application-hold-d6d7--superseded-by-r1-d)). That hold is
**superseded** by the later same-day ruling [R1-D](#ruling-r1-d-t4-deferral-2026-10-17), which defers
all T4 work.

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

## Application hold (D6/D7) — superseded by R1-D

D6 (register T4.P01 with all slices `proposed`) cannot be written truthfully today, and D7 (authorize
the docs-only `T4.P01.S01`) needs a registered phase row. The register checker refuses any registered
row — `proposed` included — whose `Consumes` names a gate version that does not exist. `T4.P01.S03`–`S05`
consume `F5.release-envelope@1` (still `undrafted`, no version), and the final gate S05 also consumes the
undrafted `T3.camera-experience-cutover@1`. Dropping those from `Consumes` would be the dishonest
registration the [T3.P02 proposal](../../roadmap/t3-experience/t3.p02-capture-and-cut-preview/README.md)
already refused. The proposal missed this; it is recorded as the proposal's error, not the owner's.
The proposal listed resolutions R1–R3. *Historical:* this hold stood until the owner ruled R1-D below,
which replaces it.

## Ruling R1-D: T4 deferral (2026-10-17)

The owner ratified D1–D5 and ruled **R1-D**: **all T4 planning and implementation is deferred until
[Core Editor Stability](../../roadmap/core-editor-stability.md) is accepted.** This is a product-priority
deferral, not a dependency finding. It supersedes D6/D7 and the hold above. It does not select R1, R2 or
R3, so the F5 drafting does not run either.

| Concern | Disposition under R1-D |
| --- | --- |
| T4 track | Stays `planning`. |
| T4.P01 | Stays unregistered. The registration draft and S01 plan draft remain as **frozen evidence**: they are not work in progress and not a queue. |
| F5 and `T4.prepared-reader` | Stay `undrafted`. No F5 drafting, ratification (D8) or provider wiring. |
| T4 slices | None is registered or authorized. No temporary final gate and no checker change (R2/R3 are not taken). |
| Resumption | Two separate owner acts, in this order, and only after Core Editor Stability has a recorded acceptance: (1) renewed authorization of T4 **planning**, which re-validates the frozen drafts against then-current `main`; (2) separately, T4 registration and any implementation authorization. |
| T3 obligations kept | The T3.P01.S04 source/release **inventory**, migration/refusal coverage, quiescence/recovery plan and **publication compatibility disposition** (AM-7; [S04 plan](../../roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s04-live-ownership-cutover/implementation-plan.md#prerequisite)) are unchanged by this deferral. Because T4's prepared delivery now follows Core Editor Stability, any publication gap the owner accepts at T3.P01.S04 runs until T4's prepared-reader cutover. Existing publications need a concrete disposition before activation, and the public and owner publication routes must report honest unavailability throughout. |
| Retained delivery path | The P22 authored-snapshot reader and API publication format stay as the T4 README records ("retire at the T4 prepared-reader cutover"). The deferral neither deletes nor extends them beyond what T3.P01.S04's disposition allows. |

## Core Editor Stability rulings (2026-10-17)

After re-review, the owner approved the [Core Editor Stability](../../roadmap/core-editor-stability.md)
direction and ruled on its sequencing findings. None of these rulings authorizes implementation. Each
named owner plans through normal phase registration and slice authorization.

| # | Ruling | Intended owner |
| --- | --- | --- |
| Route | The milestone has its own acceptance route, the [product milestone acceptance](../../operations/README.md#product-milestone-acceptance) event, with evidence under `docs/roadmap/integration/core-editor-stability/`. It creates no gate row and changes no capability checker. The gate-based integration procedure is not claimed to cover it. | Owner authorizes the acceptance plan |
| Workflow | The milestone requires a useful self-contained creator workflow, not a collection of accepted core providers. Its browser acceptance includes basic responsiveness (no blocked interaction, stale state or lost input on a realistic project), with no new benchmark infrastructure. | Acceptance plan |
| K1 | One bounded editor-side GLB import is required before the milestone. There is no T4 release closure, and advanced ingest stays deferred. | T2 (after T3.P01.S04) |
| K2 | Temporary publication unavailability is accepted in principle. The actual gap is approved only at T3.P01.S04, after the live inventory and compatibility review. There is no blanket approval. | Owner, at T3.P01.S04 |
| K3 | Bounded straight-Wall creation is planned after the F2 cutover. Rooms stay derived, connections explicit and Layout the canonical authority. | T1 |
| K4 | Project rename/delete: T3 owns persistence/API in a separate small slice (not T3.P01.S04), and T1 owns the shell integration. | T3 + T1 |

## Explicit non-implications

- **No other slice is authorized.** `T1.P01.S04`–`S06`, `T2.P01.S03`–`S04`, `T3.P01.S04` and every T4
  candidate stay `proposed` or unregistered. Batch B (`T1.P01.S04` ∥ `T2.P01.S03`) needs its own
  authorization after S07 ships and `viewport-projection-v1` is accepted.
- **No T4 work of any kind** (R1-D): no planning, drafting, registration or implementation until Core
  Editor Stability is accepted and the owner renews authorization.
- **Core Editor Stability is a milestone, not authorization.** Its definition registers no gate, phase
  or slice, and authorizes no new work in T1, T2 or T3.
- **No gate changes state.** `T1.viewport-projection@1` stays `ratified` until S07's closeout.
- **No cycle transition.** The T1.P01 window stays open with exposures S02, S04 and S05.

**Later outcome (dated pointer, not a revision of the rulings above).** S07 shipped in PR #137, and its
acceptance recorded `T1.viewport-projection@1:viewport-projection-v1` accepted at `ab8504aa`. Batch B
(`T1.P01.S04` ∥ `T2.P01.S03`) was then authorized by its own
[2026-10-17 batch B record](./batch-b-authorization-2026-10-17.md). T3.P01.S03 shipped through its
registered split ([record](./s03-split-followup-authorization-2026-10-17.md)). R1-D is unchanged.

## Provenance

Owner approval in the coordinating session, 2026-10-17, against post-PR #135 `main` (`c9aa53cf`), on
PR #136. R1-D was ruled in the same session after review of the D6/D7 hold. Independent review precedes
merge, and no implementation starts before the merge.
