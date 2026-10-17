# T2.P01.S03 — First coherent editing surface: implementation plan

**Slice:** T2.P01.S03 · **Status:** approved — owner-authorized 2026-10-17 as batch B ([record](../../../../reference/decisions/batch-b-authorization-2026-10-17.md)), implementation started on its own worktree after PR #145 merged · **Phase:** [T2.P01](../README.md) ·
[slice register](../README.md#slice-register) · **Track:** [T2](../../README.md) · **Runbook:**
[T2 operations](../../../../operations/t2-composition/README.md)

```text
CONSUMES: F1.reference@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:references-v1, F4.intent-acceptance@1:local-single-domain-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t2.p01.s04-bounded-composition-loop/implementation-plan.md
```

## Prerequisite

S02 accepted, and `T1.P01.S03`'s local acceptance accepted at this slice's trusted base. By owner
rulings D1/D2 of 2026-10-17 ([record](../../../../reference/decisions/next-batch-authorization-2026-10-17.md)),
`T1.P01.S07` owns the host↔F4 wiring (accepted install into the Stage, Undo/Redo commands,
replacement baseline, selection requalification, Camera-output rebase, adapter re-binding and the AM-5
contribution points), and its acceptance records `viewport-projection-v1`, with `T1.P01.S02` as
provider. This slice is in batch B, **after** S07
([conditions](../../../next-batch-2026-10-17.md#t2p01s03-launch-conditions)). It may start only when
all of these hold. Conditions 1–4 were verified at authorization against `main` `a8e4d45e`
([batch B record](../../../../reference/decisions/batch-b-authorization-2026-10-17.md)); the runbook start step re-checks 2–4 at this slice's own trusted
base:

1. The owner authorizes it, and its register row reads `approved`. **Met:** batch B authorization,
   2026-10-17 (the earlier next-batch decision did not authorize it).
2. `T1.viewport-projection@1` is `accepted`, with an `active` `viewport-projection-v1` entry, both in
   the tree and at this slice's trusted base (`git merge-base HEAD main`). **Met on `main`:** accepted
   at `ab8504aa` through S07.
3. `T1.P01.S07` is shipped on that base. The host↔F4 wiring, adapter re-binding across installs and
   the AM-5 contribution points (task/instrument factory, Card facts, Place/Find entries) are then on
   `main`. This slice registers through them; its only host edits are the additive pointer, surface
   invalidation and task-close seams authorized by the
   [T2 host-seam exception](../../../../reference/decisions/t2-s03-host-seams-2026-10-17.md).
   **Met on `main`:** PR #137 (merge `a0026cf4`).
4. `local-single-domain-v1` stays `active`, and `T2.P01.S02` stays shipped. Both hold today.
5. If it runs alongside `T1.P01.S04`, the [batch B shared-file protocol](../../../cross-track-execution.md#authorized-batch-b-2026-10-17)
   is in force: each writes only its own adapter and the host seams it owns; T1 writes the Head Save
   mount, Card-name contribution and Layout proposal lease, and T2 only the additive pointer,
   surface and task-close seams named in its exception.

It does **not** wait for S04's precision tools, the Head Save integration (`T2.P01.S04`'s
prerequisite), conditional Save or T1 phase closure.

## Scope

Use the existing shell's Place family/Find registration, Index, Card, task home and gesture lease.
Arming changes session state only. Place stays armed after success until Esc/Select; the newly
created object becomes selected. Both views display the same prepared candidate; a 3D surface hit
resolves back to compiled Layout evidence. A wall, plinth or another object's mesh cannot be mistaken
for floor support. Card continues to describe accepted identity/facts; proposed values and precision
live in the invoked World Instrument. A support choice, when one is ever required, is presented here.

Offer horizontal drag and yaw around the entity's declared placement pivot, plus X/Z and angle entry
through the same writer. Snap is an explicit session option (off by default here); any enabled grid
step is captured in the intent's resolved candidate, visible in feedback and never a hidden commit
correction. Withhold a foreshortened grip and retain exact access. No camera fit occurs because
selection changes, a Card opens or a sheet resizes.

The shared host invokes this operation's declared cancel-on-reading-change policy once. An accepted
Plan↔3D change cancels the unfinished pointer interaction before the reading changes, restores the
accepted baseline, preserves the armed task/tool and committed selection, releases the lease once and
invalidates delayed pointer-up. Blur, capture loss, task replacement, project replacement and adapter
unmount use the same cancel path. A replacement epoch cannot be reached by old asset loads or gesture
callbacks. View-only changes create no source history.

## Exit criteria

From a valid floor project, a creator can place an object, move it, rotate it, switch readings, enter
an exact value and undo/redo without data/UI divergence. Include a Plan-ineligible selected entity,
missing model bytes, unsupported host and mid-gesture reading switch. Review desktop, narrow,
keyboard-only and reduced-motion journeys on the real surface. The last valid displayed candidate
equals its committed pose within 1e-6 meters/radians; no post-preview Y fix.

## Readiness declaration

This slice is **approved** (owner-authorized 2026-10-17 as batch B, [record](../../../../reference/decisions/batch-b-authorization-2026-10-17.md)) and
in implementation on its isolated worktree, started through the T2 runbook start step after the
authorizing PR (#145) merged. Nothing here claims acceptance, completion or readiness; the
verification gates run at review, and evidence belongs in [acceptance.md](./acceptance.md).
