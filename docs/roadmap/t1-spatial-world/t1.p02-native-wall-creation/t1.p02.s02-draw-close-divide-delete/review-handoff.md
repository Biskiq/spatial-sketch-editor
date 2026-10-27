# T1.P02.S02 — implementation review handoff

```text
AUTHORITY: NONE — the phase README owns slice status; the release list entry and the next-wave
           authorization record own the release. This artifact requests review; it accepts nothing.
STATUS:    implementation complete on branch `t1-p02-s02-draw-close-divide-delete`, pushed for
           independent review. No acceptance, no closeout, no merge claim.
TIER:      architecture-integration. Integration route remains T1.P02.S04.
OWED:      T3's implementation review of the shared Head/F4 diff, and the owning track's review of
           each T2/T3 adapter edit this diff touches (see “Review obligations”).
```

## What is implemented

The plan's outcome, in its own terms: a creator draws a straight Wall chain, deliberately joins
existing topology, closes an enclosure, divides a Room and deletes a Wall through the shared Stage
and F4 acceptance, with plan and 3D reading the same candidate.

| Owning path | What changed |
| --- | --- |
| `packages/layout-core/src/layout-wall-chain-policy.ts` | one bounded predicate over the planner's own primitives (`classifyWallIntersection`, the topology component keys, `roomBoundaryPolygon`) refusing the three gestures the document format tolerates but a drawing path must not author: `unconnected_crossing`, `unconnected_interior_contact`, `nested_ring_without_shared_junction`. No second compiler, no geometry reconstruction. |
| `apps/editor/src/lib/authoring/adapters/layout/drawing-planners.ts` | two registered `DomainPlanner`s on the existing registry: `layout-wall-chain-commit` (canonical `planWallChain`, one `LayoutIdCapture`, explicit working level, correspondence naming created Walls/Junctions/Rooms and retired Rooms) and `layout-wall-delete` (canonical `planDeleteWall`, hosted Openings retired in the same step, deleted identities kept on the correspondence's before side). |
| `apps/editor/src/lib/authoring/adapters/layout/chain.ts` | the framework-free draft: deliberate targets (`free` / `junction` / `host`), backtrack, explicit close, typed-point classification, the planner-derived preview and its creator-facing consequence. |
| `apps/editor/src/lib/authoring/adapters/layout/ink.ts` | the CSS-pixel hit test (Junction over Wall interior over free point), the exact point each deliberate target names, and the published palette surface the shell mounts. |
| `apps/editor/src/lib/authoring/adapters/layout/LayoutInkPalette.svelte`, `layout.adapter.ts` | the Ink task and its palette; per-point typing through the shared exact parser; one proposal lease per live chain; the pointer half (tap / drag / close-on-start); the re-arm after acceptance; the Card field writer and the scoped Wall-delete action. |
| `apps/editor/src/lib/authoring/adapters/layout/LayoutCardFields.svelte` (from `LayoutDimensionsInstrument.svelte`) | the retired Dimensions controller, parsers, refusals and lifetime moved to the Card's field writer unchanged; the Dimensions task, its Find entry and its keyboard route are gone. |
| `apps/editor/src/lib/authoring/stage/` | `stage-session.ts` proposal lease + `navigation` on a gesture lease + proposal release on install/replacement/teardown; `stage-facade.ts` `keyIntent`, `pressWhenNoTask`, `cardWriter`, `cardActions`, `home: 'dock'`; `stage-input.ts` Enter/Backspace/Delete actions and `claim`; `stage-contributions.ts` dock tools, Card writer/action records; `host-acceptance.ts` reads the live proposal instead of named gesture owners. |
| `apps/editor/src/lib/authoring/stage/shell/`, `routes/project/[projectId]/spatial/+page.svelte` | the bottom dock over declarations, the one lower column (dock + armed palette), the Card as the sole writer for ordinary Layout fields and the home of scoped actions, the Head's bounded Find, palette-first Escape and the Delete key routed through the selected subject's own disclosed action. |
| `apps/editor/perf/` | the measurement harness drives the migrated UI: a Wall is reached by selection (handles are offered with no task armed) and its exact length is typed into the Card's field writer. |

## Verification at the implementation revision

Frozen candidate `35693802eebb1233512758283f404ccd79dfc5ed` (branch head when the gate ran), all
commands from the repository root:

```text
npm run check               editor svelte-check: 0 errors, 0 warnings (svelte-kit sync + tsconfig)
npm run test:fast           180 files / 2,318 tests passed
npm run test:heavy          11 files / 138 tests passed
npm run test:arch           22 files / 180 tests passed
npm run test:full           213 files / 2,636 tests passed
npm run build               production build succeeded
npm run check:layout-core   tsc clean
npm run check:project-model tsc clean
npm run check:camera-core   tsc clean
npm run check:api           tsc clean
npm run test:api:stack      14 files, 114 checks, 0 failed, 0 skipped (local Postgres, test-auth seam)
```

The added regressions are the drawing adapter contract (pointer and typed points agree; a Junction
and a Wall interior are declared to the planner while nearness is not a snap; backtrack/close/cancel;
a refused finish writes no source; one Undo per accepted chain; ids are not reused across
delete/recreate and Undo/Redo), the Wall-delete consequences, the new Stage seams, the migrated Card
field writer's lifetime, and the Head's bounded Find.

## Performance state

**Harness smoke, not acceptance evidence.** With the retired task removed from the harness,
`PERF_SMOKE=1 PERF_TIERS=grid-S npx playwright test --config perf/playwright.config.ts
flows/drag-correlation.spec.ts --project=chromium` passes (2 tests, 1.7 min, Chromium 153.0.8010.12,
1 pointer sample and 1 Undo/Redo cycle per run):

| Row (grid-S, F3/F4/F8) | cold | warm | repeat-use |
| --- | --- | --- | --- |
| input → matching preview (ms, n=1) | 25.6 | 30.9 | 33.3 |
| drag frame interval p95 (ms, n=20) | 51.7 | 50.9 | 50.8 |
| F4 commit completion (ms) | 64.8 | 54.6 | 59.9 |
| F4 precision completion (ms) | 54.0 | 56.7 | 51.2 |
| F8 Undo / Redo completion (ms) | 22.2 / 26.6 | 28.0 / 37.3 | 38.7 / 64.5 |

Dispatched inputs all produced a ledger row (1/1 presented, 0 superseded, 0 unresolved, 0 refused,
`compilesPerPresentedFrame` 0.138). The deliberately delayed-preview proof still separates latency
from loss: 180/180 delayed inputs recorded, 0 missed samples, 11 presented and 169 superseded, p95
497 ms against a 33.5 ms baseline p95. Every row above is labelled **smoke, not evidence**.

**Still owed, by an owner-run pass.** The plan's performance acceptance — F3 input-to-matching-preview
/ latest-input age / final-preview completion / frames and long tasks, per-move evaluation, F4 commit
and F8 Undo/Redo at **S and M**, plus F2 open, F13 leak cycles and the Stage first-load delta — stays
with the designated M2 under S06's method, on the ratified harness and budgets
(`npm run perf:bench -- --profile milestone --tiers grid-L,grid-M,grid-S`). No agent run is presented
as that evidence: the harness itself records agent runs as smoke checks or censuses, and a Bench pass
needs owner direction. No row is waived here, and this handoff claims no latency acceptance.

## Review obligations (not discharged by this handoff)

1. **T3 — the shared Head/F4 diff.** The plan's condition before merge. Specific seams to review:
   `stage-facade.ts`'s four additive contribution fields and their defaults; the `proposal` lease
   contract and the `navigation` declaration in `stage-session.ts`, including release on
   install/replacement/teardown; `host-acceptance.ts` reading the live proposal; the Head's Find
   additions; the Card's writer/action contract; and the two new F4 operations' capture, scope and
   correspondence. Save, Preview, Undo/Redo semantics, lens switching and the F4 capture/admission
   wiring are not changed beyond the seam above.
2. **The owning track — adapter edits.** `layout.adapter.ts` and `layout/` are T1-owned; the diff
   changes no T2/T3 adapter, and `perf/` is T1-owned. If review reads the Stage seam as a T3-owned
   edit, T3's verdict covers it as one item rather than a separate adapter review.
3. **Acceptance and closeout are not claimed.** The slice's acceptance record still records no
   evidence, `M4` is not recorded as re-armed, and the phase register and baton are untouched.

## Known limits

- No browser journey was run: the empty/starter draw/close/divide/delete pass in 2D and 3D, keyboard
  only, invalid numeric entry, narrow/short shells, reduced motion, Card precision, Library/Guide
  arbitration and unsaved project replacement remain the plan's acceptance evidence.
- The jsdom suites cover the route's gesture, keyboard and Card wiring through the real facade and
  session; they do not drive a GPU or a real pointer.
- The harness edits (`perf/lib/flow.ts`, the flow specs, the attribution spec) were exercised by the
  grid-S smoke only.
- Documentation that describes the retired instrument as current — for example the PLATE
  design-system row and the tech-debt row found while driving the Dimensions instrument during S06 —
  is left to the slice's acceptance/closeout reconciliation, which owns the register text.

## Revision map

```text
ae86987b  feat(layout-core): refuse the drawing gestures the format tolerates
9c1db2f2  feat(layout): draw, close, divide and delete through the one acceptance path
f885f6ad  feat(stage): generalize the proposal and contribution contracts
f09b63f4  feat(shell): add the dock, the Card's writers and the Head's bounded Find
64287bfb  test: cover the drawing path, the retired Dimensions route and the new shell seams
35693802  test(perf): drive the harness through the migrated Card and selected-Wall handles
```
