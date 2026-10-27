# T1.P02.S02 — acceptance record: Draw, close, divide and delete — CLOSED STUB

```text
AUTHORITY: NONE — the phase README owns slice status; this stub records acceptance and recovery.
STATUS:    ACCEPTED (`owner-override`, 2026-10-27) and SHIPPED on PR #201; P1 merge commit
           ce159a1e. The anchor and tag were verified reachable from main after the merge.
SOURCE:    PR #201 implementation and harness revision 64b9435d; documentation head 36c18db9.
TIER:      architecture-integration; integrated exhaustive proof remains T1.P02.S04.
INTEGRATION ROUTE: ../t1.p02.s04-integrated-final-gate/acceptance.md
PHASE:     T1.P02 remains active; S04 is its declared final gate.
NOT:       a phase closure, track completion or architecture verdict.
```

## Delivered

A creator draws straight Walls with deliberate Junction reuse, closes an enclosure, divides a Room
and deletes a Wall through the shared Stage and the one F4 acceptance path. The slice also lands the
bounded shell cutover: the bottom dock over declarations, one lower column, the Card as the sole
ordinary Layout field writer and home of scoped actions, Head Find, palette-first Escape, and the
Junction/Wall hit test that makes deliberate targets exact. Plan and 3D read the same candidate;
one Undo/Redo covers each accepted chain or delete; Save/reload keeps identities.

The drawing policy is enforced by one bounded `layout-core` predicate over the planner's own
primitives: an unconnected crossing, an unconnected interior contact and a nested ring without a
shared Junction refuse in words with zero partial source. Wall deletion retires hosted Openings in
the same undo step and reconciles Rooms. S02 re-wires Junction commits, so the closeout records
**M4 re-armed** in the architecture-cycle mechanism register.

## Evidence

- **Independent implementation review.** T3 accepted the shared Head/F4 diff at `bf9007ff`
  ([review](./t3-implementation-review.md)) and accepted the later narrow-shell ResizeObserver
  repair and the completed browser matrix at `2ad80bbd`
  ([review](./t3-shell-repair-review.md)). One non-blocking residual remains: `lowerColumnHeight`
  can be one observed frame stale while Preview unmounts the lower column.
- **Browser journey.** `64b9435d`: four tests and **28/28 rows** in both Playwright Chromium and
  branded Google Chrome 156.0.8078.48 —
  [Chromium](./evidence/2026-10-27/64b9435d/t1-s02-browser-evidence.json) and
  [Chrome](./evidence/2026-10-27/64b9435d-chrome/t1-s02-browser-evidence.json). Every row names its
  revision, viewport (1440×900 or 900×700) and reduced-motion state. Screenshots sit beside each
  JSON; byte-identical copies of the final PNGs are
  [archived](../../../../archive/roadmap/t1-spatial-world/t1.p02.s02-draw-close-divide-delete/evidence/2026-10-27/CLOSED.md).
- **Automated gate at `64b9435d`** — `check` 0/0; `test:arch` 22 files / 180 tests; `test:full`
  214 files / 2,653 tests; `build` succeeded; `check:layout-core`, `check:project-model`,
  `check:camera-core` and `check:api` clean. The DB-backed API suite was last recorded at
  `78705c0d`; later commits change the shell, browser spec and documentation only, not the API
  contract.
- **Deferred performance family — not evidence.** F3 input-to-matching-preview, latest-input age,
  final-preview completion, frames and long tasks; per-move evaluation; F4 commit and F8 Undo/Redo at
  S/M; F2 open; F13 leak cycles; and the Stage first-load delta were **not** measured under the
  formal acceptance method. No row is recorded as a pass.

## Owner ruling — per-slice owner-override (2026-10-27)

```text
RULING:     The owner directed on 2026-10-27 that S02's formal performance pass be deferred so
            T2.P02.S03 recovery could start; that the Stage route's 456.0 KiB JS br against the
            ≤400 KiB hard budget be recorded as an explicit known miss and S02 proceed; and then
            that PR #201 be accepted, closed out and merged after T3 review.
SOURCE:     PR #201 product and harness revision 64b9435d; documentation head 36c18db9.
WAIVED:     The S02 owner-run formal performance prerequisite only — F3/F4/F8 at S/M, per-move
            evaluation, F2 open, F13 leak cycles and the Stage first-load delta. Those rows remain
            unrun and are assigned to S04's integrated recheck.
NOT WAIVED: The browser journey, the automated gate, T3's independent review, the delivery budget as
            a comparison, S04's final gate or any other acceptance criterion. No performance row is
            recorded or waived as a pass; S04 cannot erase an S02 budget miss.
BUNDLE:     Stage route first-load JS is 456.0 KiB br against the ≤400 KiB hard budget, an explicit
            known miss (+9.0 KiB over the #199 base, whose 447.0 KiB already missed). It is recorded,
            not a waiver of any other row and not a claim that the budget is met.
STATE:      The phase register reads `shipped` with this authorization as `owner-override`.
```

## Residuals and ownership

- **S02 performance family → S04.** The formal owner-run pass remains owed on the designated M2
  under `docs/reference/components/performance.md`; the S06 milestone amendment does not apply.
- **Stage bundle hard miss → S04/owning delivery work.** 456.0 KiB br is recorded above; it is not
  repaired by this closeout.
- **Narrow-shell observation → T1 maintenance.** `lowerColumnHeight` may hold the pre-unmount height
  for one frame; the next observed frame corrects it. Non-blocking, recorded by T3.
- **S03 and S04 remain held.** S03 needs its own release; S04 remains the final gate.
- **M5 stays dormant.** This slice introduces no project/session replacement path.

## Entry points

```text
implementation  packages/layout-core/src/layout-wall-chain-policy.ts
                apps/editor/src/lib/authoring/adapters/layout/drawing-planners.ts
                apps/editor/src/lib/authoring/adapters/layout/chain.ts
                apps/editor/src/lib/authoring/adapters/layout/ink.ts
                apps/editor/src/lib/authoring/adapters/layout/LayoutInkPalette.svelte
                apps/editor/src/lib/authoring/adapters/layout/LayoutCardFields.svelte
                apps/editor/src/lib/authoring/stage/stage-session.ts
                apps/editor/src/lib/authoring/stage/stage-facade.ts
                apps/editor/src/lib/authoring/stage/stage-input.ts
                apps/editor/src/lib/authoring/stage/stage-contributions.ts
                apps/editor/src/lib/authoring/stage/shell/
                apps/editor/src/routes/project/[projectId]/spatial/+page.svelte
validation      apps/editor/perf/flows/t1-s02-browser-acceptance.spec.ts
regressions     apps/editor/tests/lib/layout/layout-drawing-adapter.test.ts
                apps/editor/tests/lib/layout/layout-wall-chain-policy.test.ts
                apps/editor/tests/lib/authoring/spatial-route-gesture.test.ts
                apps/editor/tests/lib/authoring/editor-card-confirmation.test.ts
```

## Recovery

```text
git show 36c18db9:docs/roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s02-draw-close-divide-delete/acceptance.md
anchor  36c18db9 (the full acceptance, plan and review-handoff bodies are all present here)
 tag    closed/T1.P02.S02 → 36c18db9 (pushed)
 merge  ce159a1e (P1 merge commit of PR #201; anchor and tag target verified ancestors on main)
```

P1 recovery requires a **merge commit** (no squash, no rebase); `ce159a1e` preserves the anchor.

## Preservation report

```text
CLOSEOUT PRESERVATION — T1.P02.S02 (2026-10-27)
prose compacted:                 3   plan, acceptance record and review handoff → stubs at their paths
reference promotions:            0   no new reference/* truth; M4 status updated in the
                                     operations mechanism register
renderable evidence archived:    28 files / 3.8 MiB   final 64b9435d PNGs, byte-identical copies
evidence stubs / manifests:      1   archive manifest at the copied bundle
transient artifacts removed:     1   closeout-blockers.md (superseded by this record)
historical anchor:               36c18db9 · tag closed/T1.P02.S02 (pushed) · merge ce159a1e
new live → archive prose links:  0
manual-owed verification rows:   1   S02 formal performance family (deferred above to S04)
remaining deferred items:        4   performance family, bundle hard miss, narrow-shell stale height,
                                     S03/S04 releases and final gate
permanent stubs added:           3   (the owner-ratified cost: one per closed prose artifact)
```
