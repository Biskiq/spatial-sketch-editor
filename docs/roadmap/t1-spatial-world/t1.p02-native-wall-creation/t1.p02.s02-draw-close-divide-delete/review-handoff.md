# T1.P02.S02 — implementation review handoff

```text
AUTHORITY: NONE — the phase README owns slice status; the release list entry and the next-wave
           authorization record own the release. This artifact requests review; it accepts nothing.
STATUS:    implementation complete and repaired through three peer-review rounds, then reviewed by
           T3 on branch `t1-p02-s02-draw-close-divide-delete`. T3 accepted the shared Head/F4 diff
           at `bf9007ff` ([review](./t3-implementation-review.md)). No acceptance, no closeout, no
           merge claim.
TIER:      architecture-integration. Integration route remains T1.P02.S04.
OWED:      no adapter edit outside T1 was found, so no owning-track adapter review is outstanding;
           the T3 shared Head/F4 review is discharged by
           [t3-implementation-review.md](./t3-implementation-review.md). The slice's browser and
           owner-run performance rows remain owed by the owning track (see “Review obligations” and
           “Known limits”). Round 2 repaired four peer-review findings, round 3 repaired the one the
           re-review raised against them, and round 4 repaired the five findings T3's review
           confirmed.
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

## Peer-review round — findings and dispositions

The four findings were each checked against the code before repair; none was withdrawn, and the
scope of two was narrowed by what the code actually does.

| Finding | Verdict | Repair | Regression evidence |
| --- | --- | --- | --- |
| **P1 — a fresh drag-to-draw authored nothing** | **Confirmed.** The release path appended only the released point, so a chain begun by dragging held one point and `commitChain` refused it as `insufficient_chain`: the primary gesture could not draw a Wall. The press target was also overwritten by `pointermove`, so even the release-only reading started wherever the hand last hovered. | `layout.adapter.ts`: `inkPress` now keeps the press's own deliberate target apart from the hover, and `dragInkWall` authors the pressed point and the released point in one acceptance (`beginChain` for a fresh chain, so capture and proposal lease are unchanged). A drag from the live tip still adds one leg. | `layout-drawing-adapter.test.ts` drives the real facade, session and F4 host: one drag ⇒ one Wall between the pressed and released points, one history entry, entried restored by one Undo; and a drag pressed on the enclosure's `(0, 4)` Junction keeps that authored Junction (no parallel Junction minted). Both fail on the pre-repair adapter (verified by reverting it). |
| **P1 — curved Walls read as their endpoint chords** | **Confirmed, both directions.** Straight hosts are exact under `classifyWallIntersection`; a **curved** host was classified by the chord its two Junctions span, so a leg the real centerline crossed was admitted (the policy's whole purpose), and a leg crossing empty space under a bow was refused for geometry the document does not contain. | `layout-wall-chain-policy.ts`: a curved host is read through the canonical sampled authority the topology gate itself runs — `wallCenterlineSamples` plus the sampled crossing predicate, behind the same extent prune — while straight hosts keep the exact chord classifier. An undeclared coincidence at a host endpoint station stays permitted through the kernel's own shared-station seam, and a sampled leg that cannot be derived falls back to the chord reading. No second intersection recipe and no new tolerance; the planner still owns identity, allocation and every gate. | `layout-wall-chain-policy.test.ts` builds the host by bending a chain through the canonical curve planners and pins: the arc-crossing leg (chord provably clear) refuses, the chord-only leg is permitted **and** `planWallChain` accepts it, a leg leaving the host's own station is permitted, and the same start aimed through the bow still refuses. |
| **P1 — a confirmation outlived its subject** | **Confirmed.** The Card compared `confirming` against `action.id`, which every Wall-deletion action shares, so switching subjects kept “Confirm Delete Wall” standing over consequences the creator had never read; the route's offer compared subject and action id only, so a Wall left and re-selected spent an offer read for an earlier selection, and a content change that altered the consequences (a hosted Opening) ran the deletion without re-disclosing it. | `EditorCard.svelte` keys the confirmation by the subject **and** the adapter's own disclosed words and drops it when either changes; the route stores a fingerprint (subject, action, disclosed detail) that the second `Delete` compares against the **live** Card action before running it, spends the offer on a selection change, and clears it on replacement. The notice also stops doubling the full stop the adapter's sentence ends with. | `spatial-route-gesture.test.ts` on the mounted route: switching subjects returns the Card to its own disclosure and deletes nothing; a Wall left and re-selected demands a fresh press before it can be deleted (both fail against the pre-repair Card/route — the route case deletes immediately). |
| **P3 — “This deletes deletes …”** | **Confirmed, and wider than the example.** The clause list produced “This deletes deletes 1 hosted Opening in the same undo step”, chained a second “and” onto an enclosure clause that already carried one, and read “This deletes changes no Room” for a Wall with no Room consequence. | `drawing-planners.ts`: the disclosure is two sentences from the same planner counts — what goes (the Wall, then the hosted Openings sharing its undo step) and what happens to the Rooms (merge / enclosure / create / no change), with the plural rule in one helper. The substrings the earlier suite already asserted are preserved. | `layout-drawing-adapter.test.ts` asserts the full sentence for the Opening+enclosure case, and the existing `contains` assertions still hold. |

Diff review for unintended effects: none of the four repairs touches F4 capture minting (one capture per
operation, still `beginChain`/`commitChainOnce`), correspondence, the proposal-lease contract, the
Stage contribution field shapes or their defaults, admission/install, or the shell's writer/action
records. The policy edit is a pure function in `layout-core`; the wording edit changes only words; the
confirmation edit changes shell state that never reaches the source.

### Peer-review round 3

The re-review read the round-2 repairs as sound and carried the three P1s and the P3 as resolved. It
raised one further finding against the round-2 confirmation repair, which is confirmed here.

| Finding | Verdict | Repair | Regression evidence |
| --- | --- | --- | --- |
| **P2 — the Card's confirmation was not action-specific** | **Confirmed.** Round 2 keyed the confirmation by the subject plus the **entire** contributed action list, so one subject with two destructive actions marked both as confirmed: each action's first press ran it, and the creator never read the second action's consequences. The contract permits it — every mounted adapter contributes actions for one subject and only `detail` is required of a destructive one, so nothing caps how many are destructive. The Card's action list was keyed by `action.id` alone, and the record type stamps `adapterId` precisely because an id is unique per adapter rather than across them, so two adapters' same-named actions were already a duplicate-key hazard. | `EditorCard.svelte`: the confirmation now names **one action** — subject, owning adapter, action id and that adapter's own disclosed words — and the live key set decides what is stale, so a neighbour discloses its own consequences instead of inheriting the confirmation the first action opened. The action list is keyed by adapter **and** id. The route's own `Delete` route needed no change: `requestDelete` already refuses unless the subject has exactly one destructive action, so the hole was local to the Card. | New `editor-card-confirmation.test.ts` mounts the Card: two destructive actions each disclose their own words and only the confirmed one runs; two adapters' same-named actions stay apart; a subject change and reworded consequences both drop the disclosure. The first two fail against the round-2 Card (verified by reverting only that file) — the neighbour reads “Confirm wall-dissolve” with no disclosure of its own, and the duplicate-key case raises `each_key_duplicate`. |

Diff review for round 3: the repair is Card-local confirmation state plus one `{#each}` key, and both are
render-time only. It changes no operation, capture, correspondence, lease, contribution field shape or
adapter contract; `data-card-action` keeps its existing value, so the route's mounted regression and the
Card's own selectors are unaffected.

### T3 implementation review — round 4 repairs

T3 reviewed the shared Head/F4 diff at `161a0570` and confirmed five defects, recorded in full in
[t3-implementation-review.md](./t3-implementation-review.md): a global `Enter`/`Backspace`/`Delete`
map stole a focused control's activation; a click stopped selecting whenever any contributed task
was open; invoking another operation left the dock tool stale, so a later completion re-armed it;
Wall handles painted under a foreign task; and the dock keyed tools by an id that is unique only per
adapter. The repairs are shell-local state plus one render guard; no capture, admission,
correspondence, Save or history semantic changed.

```text
bf9007ff  fix(stage): bind Stage commands to the live tool and the focused control
```

Verification at `bf9007ff`, all commands from the repository root and run on the committed tree:

```text
npm run check               editor svelte-check: 0 errors, 0 warnings
npm run test:fast           181 files / 2,335 tests passed  (+6 round-4 regressions)
npm run test:arch           22 files / 180 tests passed
npm run test:heavy          11 files / 138 tests passed
npm run test:full           214 files / 2,653 tests passed
npm run build               production build succeeded
npm run check:layout-core   tsc clean
npm run check:project-model tsc clean
npm run check:camera-core   tsc clean
npm run check:api           tsc clean
```

The new regressions are the focused-control key guard (`stage-input.test.ts`) and three mounted-route
cases: Enter on the palette's Backtrack button does not accept the chain, a click still selects while
Place plinth is open, and another operation's task closing does not re-arm Ink
(`spatial-route-gesture.test.ts`). A scratch integration branch at `origin/main` merged this branch
and T2's #199 with no conflicts; its full suite, check and arch lane passed, and the cross-track
smoke results are recorded in the review artifact. None of that is slice acceptance evidence.

## Verification at the implementation revision (round 1)

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

The documentation-only commit that added this record was re-verified through the arch lane, which
owns the documentation tests: 22 files / 180 tests passed at `95860013`.

The added regressions are the drawing adapter contract (pointer and typed points agree; a Junction
and a Wall interior are declared to the planner while nearness is not a snap; backtrack/close/cancel;
a refused finish writes no source; one Undo per accepted chain; ids are not reused across
delete/recreate and Undo/Redo), the Wall-delete consequences, the new Stage seams, the migrated Card
field writer's lifetime, and the Head's bounded Find.

## Verification at the repair revision (round 3)

Branch head `fda568bc` (`fix(shell): bind a Card confirmation to the action it disclosed`), all
commands from the repository root and run on the committed tree:

```text
npm run check               editor svelte-check: 0 errors, 0 warnings
npm run test:fast           181 files / 2,329 tests passed  (+4 round-3 regressions)
npm run test:arch           22 files / 180 tests passed
```

`test:fast` was run three times at this revision and passed each time (2,329 tests, 181 files). One
earlier run of the same command exited non-zero before its output was captured, and its failing test
name was lost to a `tail` pipe; it has not reproduced across those three runs, so it is recorded here as
an unreproduced transient rather than as a pass. The round-2 revision's heavy lane, full suite, both
package checks, the build and the API stack run are unchanged by a Card-local repair and are kept above;
they were not re-run for round 3, and this handoff does not present them as round-3 evidence.

## Verification at the repair revision (round 2)

Branch head `78705c0d1c4162129223e2b0da2d450db25c1bec` (`fix(layout): word a Wall deletion's
disclosure as two sentences`; the round-2 commits are listed under “Revision map”), all commands from
the repository root and run on the committed tree:

```text
npm run check               editor svelte-check: 0 errors, 0 warnings
npm run test:fast           180 files / 2,325 tests passed  (+7 round-2 regressions)
npm run test:heavy          11 files / 138 tests passed
npm run test:arch           22 files / 180 tests passed
npm run test:full           213 files / 2,643 tests passed  (+7)
npm run build               production build succeeded
npm run check:layout-core   tsc clean   (also run standalone over the policy module)
npm run check:project-model tsc clean
npm run check:camera-core   tsc clean
npm run check:api           tsc clean
npm run test:api:stack      14 test files, no failures, 0 skipped (local Postgres, test-auth seam)
```

The round-2 regressions are the three drag cases, the three policy geometry cases, and the two
mounted-route confirmation cases listed above. Each was run against the pre-repair code (reverting
only the file it covers) to confirm it fails there; the drag pair and the route confirmation case
were verified that way in-session.

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

Re-run on the round-2 repair revision `78705c0d` (same command, 4 tests passed in 2.3 min, Chromium
153.0.8010.12):

| Row (grid-S, F3/F4/F8) | cold | warm | repeat-use |
| --- | --- | --- | --- |
| input → matching preview (ms, n=1) | 38.2 | 28.9 | 30.3 |
| F4 commit completion (ms) | 63.0 | 59.4 | 60.4 |
| F4 precision completion (ms) | 48.4 | 54.4 | 51.9 |
| F8 Undo / Redo completion (ms) | 33.1 / 25.3 | 39.5 / 35.3 | 22.0 / 32.3 |

Dispatched inputs still all produced a ledger row (1/1 presented, 0 superseded, 0 unresolved,
0 refused in every row). The delayed-preview proof still separates latency from loss: 180/180 delayed
inputs recorded, 0 missed samples, 10 presented and 170 superseded, p95 470 ms against a 33.3 ms
baseline p95. These remain **smoke, not evidence**: the repairs add sampled-centerline work only for
curved hosts, which this straight-Wall workload does not contain, so no latency claim is made from it.

**Still owed, by an owner-run pass.** The plan's performance acceptance — F3 input-to-matching-preview
/ latest-input age / final-preview completion / frames and long tasks, per-move evaluation, F4 commit
and F8 Undo/Redo at **S and M**, plus F2 open, F13 leak cycles and the Stage first-load delta — stays
with the designated M2 under S06's method, on the ratified harness and budgets
(`npm run perf:bench -- --profile milestone --tiers grid-L,grid-M,grid-S`). No agent run is presented
as that evidence: the harness itself records agent runs as smoke checks or censuses, and a Bench pass
needs owner direction. No row is waived here, and this handoff claims no latency acceptance.

## Review obligations

1. **T3 — the shared Head/F4 diff: DISCHARGED.** T3 reviewed the seams named in the plan and
   accepted the implementation at `bf9007ff` ([review](./t3-implementation-review.md)), after
   repairing the five findings that review confirmed. Save, Preview, Undo/Redo semantics, lens
   switching and the F4 capture/admission wiring were checked and are unchanged beyond the reviewed
   seam.
2. **The owning track — adapter edits: none outstanding.** `layout.adapter.ts` and `layout/` are
   T1-owned; the diff changes no T2/T3 adapter, and `perf/` is T1-owned. T3's verdict covers the
   shared Stage seam as one item.
3. **Acceptance and closeout are not claimed.** The slice's acceptance record still records no
   evidence, `M4` is not recorded as re-armed, and the phase register and baton are untouched. The
   browser and owner-run performance rows below remain owed.

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

round 2 (peer-review repairs)
8528decc  fix(layout): draw the Wall a fresh drag names
5296f678  fix(layout-core): admit a drawing against a curved Wall's real centerline
b7b0f9d4  fix(shell): bind a delete confirmation to its exact subject and words
78705c0d  fix(layout): word a Wall deletion's disclosure as two sentences

round 3 (re-review repair)
fda568bc  fix(shell): bind a Card confirmation to the action it disclosed

round 4 (T3 implementation-review repairs)
bf9007ff  fix(stage): bind Stage commands to the live tool and the focused control
```
