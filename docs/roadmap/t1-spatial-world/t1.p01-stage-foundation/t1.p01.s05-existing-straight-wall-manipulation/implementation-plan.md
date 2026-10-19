# T1.P01.S05 — implementation plan — CLOSED STUB

```text
AUTHORITY: NONE — this is closed work. Current truth lives in the phase README's slice register,
           the architecture-cycle state, the owning track's baton and the acceptance record.
STATUS:    APPROVED and DELIVERED. Owner-authorized 2026-10-19 as batch C with `T2.P01.S04`
           (ruling C5 made TD-8 its first increment); independently accepted at `3d432836`
           (round 4, no blockers); routine `slice-closeout` ran on the same branch 2026-10-19 and
           this plan body was compacted after that acceptance.
ROLE:      recovery route for the approved scope and its exact tier.
NOT:       product contract · status store · acceptance evidence · authority for residual scope.
```

## Delivered

Bounded editing of an **existing straight Wall** on the shared Stage: exact length and angle with
an explicit fixed endpoint, and rigid translation — all through the retained Layout planners and
the one F.4 intent/acceptance path, never a direct document write. Pointer handles exist only while
the Dimensions task owns them; a reading flip pauses the writer with an exact proposal that Resume
or Discard settles. Shared-Junction edits preview their reach and refuse what the canonical planner
cannot preserve. TD-8's stale task-scoped services were fixed host-side as the first increment.

## Accepted contract

- Consumes `F1.reference@1`, `F4.intent-acceptance@1`, `T1.viewport-projection@1`; requires
  `references-v1`, `local-single-domain-v1`, `viewport-projection-v1`.
- Verification tier `architecture-integration`; the integrated route is the phase final gate,
  [`../t1.p01.s06-integrated-final-gate/implementation-plan.md`](../t1.p01.s06-integrated-final-gate/implementation-plan.md),
  which remains owed.
- Curved-Wall shape/translation handles stay deferred; its S04 scalar edits remained available.
- The architecture-cycle window's **terminal** exposure; this plan did not close the window — the
  closeout did (2026-10-19), and the mechanism verdicts remain the owner's.

## Evidence

- Acceptance record: [acceptance.md](./acceptance.md) — round-4 verdict at `3d432836`, branch lanes
  `check` 0/0 · `test:fast` 1962/1962 · `test:arch` 163/163 · `test:heavy` 118/118, focused rows and
  the known limits.
- The merge gate runs at the merge revision; the PR must land as a **merge commit** (P1).

## Entry points

```text
implementation  apps/editor/src/lib/authoring/adapters/layout/{precision.ts,instrument.ts,adapter-support.ts,layout.adapter.ts}
                apps/editor/src/lib/authoring/adapters/layout/{paused-proposal.ts,wall-gesture.ts,LayoutDimensionsInstrument.svelte}
                apps/editor/src/lib/authoring/stage/stage-facade.ts
validation      apps/editor/tests/lib/authoring/layout-wall-manipulation.test.ts
                apps/editor/tests/lib/authoring/stage-host-acceptance.test.ts
                apps/editor/tests/lib/authoring/stage-shell-composition.test.ts
regressions     apps/editor/tests/lib/authoring/layout-precision-adapter.test.ts
```

## Residuals

- The phase final gate (`T1.P01.S06`) is unaccepted and unshipped.
- No browser evidence for the pointer journey is recorded by this slice.
- Room identity is protected by the planner's reconciliation, not a pinned id.
- A refused **Source JSON Open** replacing the mounted project is a separate T1 host follow-up, not
  this slice's scope (see the acceptance record).

## Recovery

```text
git show ca5167435a7accabd00b0135435753c25cb8639f:docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s05-existing-straight-wall-manipulation/implementation-plan.md
anchor   ca5167435a7accabd00b0135435753c25cb8639f (full plan, reachable from main)
tag      closed/T1.P01.S05 at 3d432836 (local only — not pushed)
```
