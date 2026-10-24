# Batch D authorization: T1.P01.S06 ∥ T3.P02 registration and S01

**Date:** October 20, 2026. **Status:** **owner-authorized 2026-10-20.** The owner approved these
authorizations, and the two phase closures recorded below, in the post-cutover commission session of
2026-10-20. This record is decision provenance, like the
[batch B](./batch-b-authorization-2026-10-17.md) and [batch C](./batch-c-authorization-2026-10-19.md)
records. It changes no ratified contract: AM-1–AM-9 and PLATE are unchanged, lifecycle and gate
identity stay in the [roadmap register](../../roadmap/README.md#gate-register), and each slice's
scope stays in its own plan. The rules are in the
[batch D protocol](../../archive/roadmap/coordination-2026-10/cross-track-execution-2026-10-23.md#authorized-batch-d-2026-10-20).

**Base.** `origin/main` `9a457f6b3201bc1e7b151f7beaaebe59f4f83b64`, the merge commit of PR #158 (the
`T3.P01.S04` live ownership cutover). Verified at this base: PR #158 is a P1 merge commit whose second
parent is the S04 branch; the accepted implementation revision `06a8aac8` and the plan anchor
`f5147aca` are ancestors of `main`; `T3.camera-experience-cutover@1` is `accepted` with `T3.P01.S04`
as its sole provider; `F1.reference@1:unit-resolution-v1`, `F2.unit-envelope@1:unit-envelope-v1`,
`F4.intent-acceptance@1:unit-acceptance-v1`, `F4.intent-acceptance@1:conditional-save-units-v1` and
`T1.viewport-projection@1:viewport-projection-v1` are `active`; `T2.P01.S04` and `T3.P01.S04` both
carry accepted final-gate evidence. No later commit invalidated those facts.

## Phase closures recorded with this batch

Both closures are owner events carried by the same 2026-10-20 authorization, executed as their own
documentation PRs under `.agents/skills/phase-closeout`:

| Phase | Final gate | Closure PR | State |
| --- | --- | --- | --- |
| `T2.P01` — Supported object composition | `T2.P01.S04`, accepted 2026-10-19, merged `99c38033` (PR #157) | #162 | `PHASE CLOSE` `Stage: closed`; T2 phase row `shipped`; **T2 track not complete** |
| `T3.P01` — Camera-Experience foundation | `T3.P01.S04`, accepted 2026-10-20 at `06a8aac8`, merged `9a457f6b` (PR #158) | #163 | `PHASE CLOSE` `Stage: closed`; T3 phase row `shipped`; **T3 track not complete** |

Neither closure claims a track completion, a product integration acceptance, an architecture-cycle
verdict or a deployed activation.

## Authorizations

| # | Authorizes | Scope | Not authorized |
| --- | --- | --- | --- |
| D1 | `T1.P01.S06` — Integrated final gate | The existing exhaustive integrated Stage/authoring verification on the post-cutover tree, unchanged in scope | Any narrowing, any second harness, any general host refactor |
| D2 | `TD-10` disposition | A narrowly scoped host repair plus its route-level regression, landed as a standalone tech-debt PR before S06 or as S06's first increment | Broadening into session/lifetime refactoring |
| D3 | `T3.P02` — First Capture and Cut Preview | Phase registration with S01 authorized for implementation and S02 registered `proposed` | `T3.P02.S02` implementation, and any capability claim |
| D4 | Sequencing reconciliation | Correct the batch C diagram's `owner-run activation → S06/T3.P02` edges to the accepted-gate edges they actually are | Deploying, running migration 005, purging R2, or touching live data |

## D1 — `T1.P01.S06` is authorized as the post-cutover integrated gate

`T1.P01.S06` is the last unfinished slice of `T1.P01` and its declared **FINAL PHASE GATE**. Its
contract was rewritten by `T3.P01.S04` phase B, so this authorization re-declares the unit scopes
rather than the retired current-source adapter:

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1,
          T1.viewport-projection@1, T3.camera-experience-cutover@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1,
          F4.intent-acceptance@1:unit-acceptance-v1,
          F4.intent-acceptance@1:conditional-save-units-v1,
          T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: exhaustive
```

Every consumed gate is `accepted` and every required scope is `active` at the trusted base above.
The accepted route is the **post-F2 integrated Stage and authoring verification**; the pre-cutover
alternative (S06 running on current source immediately after `T1.P01.S05`) was declined by ruling C3
and stays declined.

**Scope is preserved, not resumed.** S06 keeps its exhaustive integrated acceptance: Plan/3D
selection and search, Layout precision and refusal, Stage composition, selection and history, source
replacement, Save/recovery, and the browser journeys over the existing edge-case set (empty project,
nonzero floor datum, curved Wall, shared Junction, duplicate names, Opening void/cap, independent
coincident structures, dense geometry, long identity, narrow/short shell, reduced motion). It also
verifies the now-working F2 sign-in Save resume that TD-9 required, end to end, and it remains the
phase's integration route for every narrowed sibling slice.

S06's acceptance makes `T1.P01` **closable**. It does not close `T1.P01`, does not complete the T1
track and does not transfer the owner's architecture-cycle verdicts, which stay `owner-verdict-owed`
and separate (see [Owner-only decisions](#owner-only-decisions-not-resolved-here)).

## D2 — TD-10 remains open; it is repaired before or within S06

`TD-10` records that a late successful Source JSON Open, or a late accepted *Reload remote*, can
install its source after a newer project replacement or reload has mounted, overwriting the newer
project and its saved base. **Verified present in the tree at `9a457f6b`**: `openSourceJson` and
`applyReloadOffer` in `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` capture the
admission context, await `bootFromSourceJson`, and install their result without re-checking
`session.isCurrent(token)`, while `loadProject` and the resumed-save path do check it. The refused-source
contract does not depend on the defect, which is why PR #159 kept it out of scope.

Disposition, as instructed:

- **Owner:** T1 Stage host (the spatial route). It is due **before or with** `T1.P01.S06`.
- **Route:** a narrowly scoped repair that captures the session token before admission and abandons a
  result whose epoch is no longer current, plus the route-level regression TD-10 names (a delayed
  admitted Open superseded by a newer replacement leaves the newer project, its history and its saved
  base intact, with no stale success or refusal notice). It may land as a standalone tech-debt PR
  before S06 — the precedent is PR #159 — or as S06's first increment.
- **Required outcome:** stale async admission can never replace a newer source or a newer saved base,
  and a stale result reports nothing rather than a stale notice.
- **Not authorized:** a general session/lifetime refactor, a second replacement guard, or treating a
  green suite as the fix without the regression TD-10 names.
- **S06 obligation:** S06 verifies the repaired host journey end to end and closes TD-10 in the debt
  ledger with its commit and its test. A repair that lands and leaves TD-10 open is an incomplete
  disposition, and S06 cannot claim the host journeys without it.

## D3 — `T3.P02` is registered and `S01` is authorized

`T3.P02 — First Capture and Cut Preview` is registered as a real phase at
[`../../roadmap/t3-experience/t3.p02-capture-and-cut-preview/README.md`](../../roadmap/t3-experience/t3.p02-capture-and-cut-preview/README.md),
reconciled against the accepted F2 cutover rather than copied from the 2026-10-16 proposal. Its
registration precondition — an accepted `T3.camera-experience-cutover@1` — is met at `06a8aac8`.

**`T3.P02.S01` is authorized for implementation.** The first slice lets a creator create or select an
Experience, capture a Camera View from the shared Stage, bind a Presentation with an optional Guide
Stop, reuse Presentations across distinct Stops, reorder Stops by stable identity, edit bounded
labels/text/holds/continuation, use a first coherent Cut Guide, enter an isolated visitor Preview and
return to the authoring context, and Undo/Redo, Save and reload through F2/F4.

Preserved invariants: one Camera motion/evaluation authority; Experience-owned editorial order;
Camera-owned View identity and connectivity; the shared Camera output/return tickets; visitor/editor
isolation; room-local transform semantics; deterministic selection and history; Svelte 5 runes,
Threlte and the existing Stage adapter patterns.

Excluded from S01: rich interactive control authoring, advanced path-anchor tools, any second Camera
controller, a second Experience timeline, general animation orchestration, and T4 publication.
The [PR #154 P1 Interactive Presentation Studio prototype](../../../prototypes/README.md) owns the
exploration of the richer interaction grammar; S01 neither invents nor imports that grammar.

**`T3.P02.S02` is registered and stays `proposed`.** It is the phase's declared final gate and holds
no implementation permission. Registering it is not authorizing it: S02 starts only from its own
authorization event after S01's acceptance, and it is the exhaustive integrated acceptance, not a
second feature slice.

**No capability is accepted by this registration.** S01's evidence, when it is accepted, is the
creator loop; the gate register gains no row, version or capability entry here.

## D4 — Sequencing: code, local verification, deployment, and the next consumers

Two sources had to be reconciled:

1. the batch C diagram, which drew `owner-run activation → T1.P01.S06` and
   `owner-run activation → T3.P02 registration`
   ([cross-track execution](../../archive/roadmap/coordination-2026-10/cross-track-execution-2026-10-23.md#authorized-batch-c-2026-10-19));
2. the more specific ratified text: ruling C3 ("S06 runs once, **after `T3.P01.S04` is accepted**"),
   R5 ("**the merge is the code cutover**. Activation on the deployed environment … is a separate
   owner-run step that follows the merged runbook") and AM-9 §6 (same ruling).

The four states are distinct and must not be equated:

| State | What it means | Where it stands at this base |
| --- | --- | --- |
| F2 code merged and accepted on `main` | S04's implementation is accepted, its gate is `accepted`, and every capability it exports is `active` | **Done** — `06a8aac8` accepted, merged `9a457f6b` |
| Local/disposable database verification | migration 005 and the API/Save lanes exercised on disposable local Postgres and an isolated Compose project | **Done** — recorded in the S04 gate artifact (80 API tests, zero skips, migration rehearsal, concurrent runners) |
| Deployed migration 005, API and editor activation, R2 purge | the owner-run reset on the deployed environment | **Not done, not authorized here, and not a prerequisite for either authorization below** |
| Next source consumers | S06's integrated verification, and T3.P02.S01's authoring surface | **Authorized by D1/D3**, each starting from its own trusted base |

The diagram's edges were mechanically wrong under the newer, more specific ruling: a deployed
activation is an operational step on the same accepted code, so it cannot be a gate on engineering
work that consumes that code. The reconciliation is recorded in the
[batch C section](../../archive/roadmap/coordination-2026-10/cross-track-execution-2026-10-23.md#authorized-batch-c-2026-10-19) and the
[execution DAG](../../archive/roadmap/coordination-2026-10/cross-track-execution-2026-10-23.md#execution-dag-and-earliest-product-milestones);
no new owner decision was required, and the competing sources are named here so the correction is
reviewable rather than silent. Activation stays owner-run, unexecuted and unclaimed; it is not part of
any PR in this batch.

One operational consequence is recorded for the owner rather than resolved here: until activation
runs, the deployed editor and API refuse pre-epoch clients and sources **after** the deploy, and
before it they still serve the old epoch. AM-9 §3 makes both orders refuse rather than misread, so
activation ordering is an operational choice, not an engineering prerequisite.

## Batch D coordination

`T1.P01.S06` and `T3.P02.S01` run in parallel under the
[batch D protocol](../../archive/roadmap/coordination-2026-10/cross-track-execution-2026-10-23.md#authorized-batch-d-2026-10-20): one writer
per shared file, additive registration elsewhere, the complete merge gate rerun on then-current
`main`, independent review per slice, and each slice's own closeout and P1 merge commit.

**S06 does not depend on T3.P02.S01**, and its evidence must not include an unaccepted T3.P02
implementation. S06 is the integrated gate for the authoring foundation that already shipped
(T1.P01 S01–S05/S07 plus the F2 cutover); T3.P02's creator loop is accepted by `T3.P02.S02` on its own
evidence. The only shared surfaces are the Stage host, the Camera modules and the editor test tree,
and they are owned in the protocol table.

Kept out of this batch: T1 Wall creation (K3), T2 GLB import (K1), project lifecycle (K4) and all T4
work (R1-D). Those stay subsequent candidates and are neither implemented nor newly authorized here.

## Explicit non-implications

- No new architecture contract, gate version, capability entry or gate state.
- `T1.P01` is not closed by authorizing S06; `T2` and `T3` are not complete. Phase closure is its own
  owner event, and T1's happens only after S06 is accepted and the owner invokes it.
- `T3.P02.S02` is not authorized. `T2`'s next phase is not registered.
- Nothing here deploys, migrates, purges, resets data or activates the new epoch.
- The PR #154 prototype program is untouched: no prototype is commissioned, rescheduled or blocked on
  by this record.

## Owner-only decisions not resolved here

1. **Architecture cycle verdicts.** The T1.P01 window is closed and the stage is `PHASE_3_EVALUATE`
   with readiness `owner-verdict-owed`. The per-mechanism keep/simplify/delete/not-exposed verdicts
   are the owner's event. They block neither S06 nor T3.P02.S01, and no verdict is fabricated here.
2. **Deployed activation.** Owner-run, unexecuted, and the only route to a live new epoch.
3. **Track completion.** T1, T2 and T3 each remain `approved` until their own completion events.

## Owner signature

```text
D1 approved  D2 approved  D3 approved  D4 approved
Owner: repository owner (authorized in the 2026-10-20 post-cutover commission)   Date: 2026-10-20
```


## D1 corrective amendment — owner-approved October 20, 2026

During the PR #168 takeover, the owner explicitly approved the narrow
[TD-11/TD-12 amendment](../../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s06-integrated-final-gate/d1-amendment.md),
then separately approved its supplemental Index-selection cloneability correction. The linked record
owns the exact bounded increments. No other D1–D4 scope or Batch D ownership changed. The owner later
requested that further independent review stop and the checkpoint be pushed for their own review;
that request does not itself accept S06 or close T1.P01.
