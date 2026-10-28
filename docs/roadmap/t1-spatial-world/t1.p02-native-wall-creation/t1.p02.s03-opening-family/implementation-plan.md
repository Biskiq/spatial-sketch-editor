# T1.P02.S03 — Opening family: implementation plan

**Slice:** T1.P02.S03 · **Status:** approved — released 2026-10-27; the complete plan and its
pre-build [plan review](./plan-review.md) are recorded before implementation ·
**Phase:** [T1.P02](../README.md#slice-register) · **Track:** [T1](../../README.md) ·
**Runbook:** [T1 operations](../../../../operations/t1-spatial-world/README.md) ·
**Design:** [shell draft — Opening (S03)](../shell-draft.md#opening-s03) ·
**Acceptance:** [record](./acceptance.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t1.p02.s04-integrated-final-gate/acceptance.md
```

## Outcome and readiness

A creator arms Ink on a drawn or starter Wall, reads the Opening family as a second Ink reading,
places a straight door or window on a Wall face with a host-relative ghost, and removes it from the
Opening's own Card action. One accepted placement or removal is one F4 operation and one Undo step;
Plan and 3D read the same void and caps; Save/reload keeps the Opening identity. An Opening that
cannot fit its host refuses in words with a repair and writes no partial source. Deleting a Wall
still retires its Openings in that Wall's one undo step — S02 behaviour, re-proved through the new
planner path.

The slice wires layout-core's **existing** Opening planners; it adds no domain rule, format, gate,
package or shell family. The phase's
[drawing and enclosure policy](../README.md#drawing-and-enclosure-policy-owner-accepted-2026-10-22)
owns hosted consequences and refusal language and is not reopened here.

**Trusted base.** `origin/main` `98449a44`; the authorization record's batch PR #199 merge
(`a674eedb`) is an ancestor. The consumed gates are accepted at their registered versions
([gate register](../../../README.md#gate-register)), the release row is present with its condition
met ([release list](../../../now.md)), and no T1 exposure window is open or required
([architecture cycle](../../../../operations/architecture-cycle.md) — T1.P02 configures none). S01, S05,
S06 and S02 are shipped. The [plan review](./plan-review.md) records the pre-build compatibility
pass; implementation starts from this base on its own branch.

## Settled feature decisions

These are the choices the outline deferred to the complete plan; they are build decisions inside
the released scope, not a new contract.

| Concern | Decision |
| --- | --- |
| Reading, not family | Ink stays the one dock tool. Its palette reading control gains **Opening** beside **Wall**; there is no second dock key and no Opening Index family. The reading is adapter UI state and is never serialized. |
| Supported reading | A **straight** Wall face (a Wall whose canonical centerline is `line`), existing `door` and `window` kinds, `rectangular` profile. Curved Walls, other profiles, host attachments and general face-frame placement stay excluded. |
| Host preference | The pointer must deliberately land on a projected Wall face inside the existing Ink hit tolerance. If a Wall — or an Opening's host Wall — is selected and is among the candidates, that host wins the tie; otherwise the nearest candidate wins. With no candidate the palette refuses in words ("Aim at a Wall face…") and a free Stage press authors nothing. Selection is not changed by aiming; tools stay armed between hosts. |
| Placement geometry | Host-relative. The pointer's projection onto the host centerline names the **offset from the host start** (the same meter convention as the Card field); the opening extends forward by its width. Nothing is clamped: an offset that would pass the Wall end, overlap a sibling Opening or exceed the Wall height is refused rather than slid into fit. |
| Ghost and live facts | The overlay marks both candidate edges on the host and publishes transient Offset, Width, Height/Sill and the host id. The candidate is planned by the canonical create planner on every pointer move, so the ghost and the refusal come from the same call acceptance uses. |
| Precision | The palette owns the next Opening's kind, width, height and sill (door 0.9 × 2.1 sill 0, window 1.2 × 1.2 sill 1 by default) and a typed **Offset on the preferred host** action for keyboard-only placement; an empty offset centers on that host without clamping. After acceptance, the existing Card fields edit offset, width, height and sill through `layout-opening-measure` — one writer, unchanged. |
| Commit and selection | One `layout-opening-create` F4 intent carries the captured id, working level, host Wall, kind and exact metrics. Preview and acceptance are the same immutable input. Acceptance selects the created Opening and re-arms Ink on the Opening reading; one Undo removes it. |
| Unwind | A reading change while a Wall chain has live points is refused in words ("Finish or cancel the Wall chain before switching readings"); otherwise it switches and clears only the opening preview. Escape, task close, replacement and install cancel the opening preview without writing. No hidden proposal exists. |
| Removal | The selected Opening's Card contributes a destructive **Delete Opening** action with the planner's own words; it is one `layout-opening-delete` F4 intent and one Undo step. The host Wall stays selected/reachable; deleted identity is retained in correspondence (no retargeting). |
| Wall deletion | Unchanged. The S02 Wall action already retires hosted Openings through `planDeleteWall`; this slice re-proves that a Wall whose Opening came from the new create path still loses both in one undo step. |

## Owning paths and operation boundary

- `packages/layout-core/src/layout-wall-openings.ts` and `layout-opening-set.ts` remain the semantic
  authority for create/delete, fit, overlap, vertical fit and captured identity. This slice does not
  duplicate those checks in the editor and does not clamp. Any refusal wording the planner cannot
  supply is composed from the planner's rejection code/fields in the adapter, never by re-deriving
  geometry.
- A new Opening-planner module beside `drawing-planners.ts` in the Layout adapter's `layout/`
  directory owns the two F4 registrations, payload readers, intent builders, candidate
  correspondence and the creator-facing repair sentences. It registers on the **same**
  `createLayoutPlanners`/`createDrawingPlanners` coordinator as every Layout operation.
- `apps/editor/src/lib/authoring/adapters/layout/ink.ts` owns the Opening host hit test, the
  host-relative candidate/ghost model and the published palette snapshot/controller additions.
- `apps/editor/src/lib/authoring/adapters/layout.adapter.ts` owns reading state, host preference,
  pointer lifecycle, one-in-flight acceptance, selection re-arm and the Opening Card action. It
  edits no Stage host, Head, route or shell module.
- The Layout Ink palette component renders the reading control,
  Opening defaults, typed-offset placement, live facts and refusal. It is a reader/caller of the
  published surface, never a second writer.
- Tests: kernel fit/identity coverage already exists in
  `apps/editor/tests/lib/layout/layout-openings.test.ts`; new adapter/call-site proof goes beside
  `layout-drawing-adapter.test.ts`, and the host hit test beside the Ink tests. Browser evidence uses
  the existing on-demand T1 harness/supervisor, not a new build or route.

## Implementation sequence

1. **Record the plan and review.** Replace the outline with this plan, record the
   [pre-build review](./plan-review.md), and record the shared-file claim (writer, patch base,
   reviewer) in the [T1 baton](../../../../operations/t1-spatial-world/current.md) before editing.
2. **Register the two F4 operations.** `layout-opening-create` (`{ wallId, kind, offset, width,
   height, sillHeight }`, addressed at the host Wall) and `layout-opening-delete` (`{ openingId }`,
   addressed at the Opening). Both read the captured `LayoutIdCapture` and working level through the
   canonical readers, call the existing planners, record the COW candidate, materialize the source,
   and publish one candidate change. Create correspondence records the created Opening; delete
   records the retired Opening with `before` and `null` after.
3. **Host hit test and reading state.** Add a deterministic opening-host classifier over projected
   straight Walls with a preferred host id and the existing tolerance; add `wall | opening` reading
   state to the Ink surface, with reading changes guarded by a live chain. Project the ghost edges
   and publish host/offset/width/fit facts.
4. **Preview and commit.** On pointer move over a candidate host, plan the exact candidate
   (`planCreateWallFirstOpening`) on the accepted baseline with one minted capture; on press/release
   accept once through the F4 intent, reusing the same capture. When no host is deliberate, or the
   planner refuses, show words with a repair and keep the tool armed. After install, select the
   created Opening and re-arm Ink on the Opening reading.
5. **Typed precision and removal.** Add kind/width/height/sill options and typed-offset placement on
   the preferred host for the keyboard path. Add the Opening Card delete action, with the same
   captured-intent acceptance and one-step Undo; keep the host selection valid afterwards.
6. **Prove consequences and boundaries.** Re-run the Wall-deletion path with an Opening created by
   the new F4 operation (same undo step), keep the one compiler and visitor isolation untouched, and
   add focused call-site regressions for registration, captured id reuse, host preference, refusal
   with zero partial source, delete/Undo and redo identity.
7. **Observe in the browser.** Run the on-demand T1 browser supervisor against the production build:
   starter and empty projects, placement on a drawn Wall, host refusal and repair, Plan/3D
   agreement, Card delete, Undo/Redo, Save and a fresh-session reload. Record revision, viewport,
   reading/motion preference and observed consequence; a screenshot alone is not a row.

## Acceptance and verification

| Concern | Required proof |
| --- | --- |
| Creator path | Empty and starter: place a door and a window on drawn Walls; Plan and 3D agree on the void/caps; the created Opening is selected; Save/reload preserves its id; one Undo removes it and Redo restores the same id |
| Host preference | A selected Wall (or the host of a selected Opening) wins the tie against an equally aimed neighbour; aiming never changes selection; tools stay armed between hosts |
| Refusal | No host, Wall-end overflow, sibling overlap, excessive height and invalid typed numbers refuse in words with a repair, write zero partial source, and leave the live preview editable |
| Precision | Palette kind/width/height/sill and typed offset use the canonical planner; post-placement Card fields edit the same facts through `layout-opening-measure`; no second writer |
| Removal and consequences | Opening delete is one F4 operation/one Undo; deleting the host Wall still retires its Openings in the same undo step; Camera/Experience ids are not retargeted |
| Session and boundaries | Reading switch with a live Wall chain is refused; Esc/task close/replacement/install leave no hidden proposal; single compiler, one selection/session, no visitor/public authoring import |
| Verification tier | `architecture-integration` plus the named integration route; the implementation PR still runs the full required gate from [tests/README](../../../../../apps/editor/tests/README.md#what-a-change-requires) |

The implementation PR runs root `check`, `test:arch`, `test:full`, `build`, the four package checks,
and the DB-backed API suite when its contracts are touched (this slice does not touch `apps/api`;
the run's DB target is recorded if it is run). Focused iteration is not acceptance evidence.

**Performance.** On this designated reference machine (MacBook Air M2, 16 GB; batch E, E6
amendment) record F4 accept-to-presented and F8 Undo/Redo completion for Opening create and delete
at S and M with the peak-first method and the contract's workloads/budgets
([performance contract](../../../../reference/components/performance.md)). Measurements are
on-demand evidence, not Vitest timing gates; a correctness-green suite is not a latency pass. If a
formal row cannot be run in this pass, it is recorded as unrun and owed to
[T1.P02.S04](../t1.p02.s04-integrated-final-gate/acceptance.md) — never reported as a pass.

## Exclusions and decisions after build

No Opening kinds beyond the landed door/window, no rounded/pointed profile UI, no curved hosts, no
face-frame provider, no Library placement path, no levels/datums/overhead work, no new dock family,
no shell/Head redesign, no format or gate change, and no S04 final-gate work. A requirement
discovered outside this boundary goes to the reviewer or the F amendment path, never into a
phase-local encoding. S04 remains the phase's final gate; a passed slice does not close the phase.
