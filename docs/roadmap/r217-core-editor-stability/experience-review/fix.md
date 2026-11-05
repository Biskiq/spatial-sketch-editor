# Experience final reconciliation: defect ledger and implementation plan (sheet §33)

**Status:** for owner review, 2026-11-05. Design only: no product code has changed in this round.
**PR:** Biskiq/spatial-sketch-editor#271 on `claude/eloquent-goldberg-yrasgu`, open and not accepted. R217.S11 does not begin until the [final gate](#9-final-gate) passes.
**Design:** [sheet §33](../../../reference/design-system/experience-interaction-sheet.html#s33), with interactive prototypes A–H, the new ownership table and the change table.
**History:** [fix-plan.md](./fix-plan.md) (review 1) and [guide-playback-plan.md](./guide-playback-plan.md) (§31/§32, slices 1–7) stay as the record. This file is the implementation-ready plan for the current round.

**Evidence used:** the PR #271 code at head `da61716d`; sheet §5, §25, §27, §28, §31 and §32; the existing contracts ([composition-execution AM-11](../../../reference/composition-execution.md#am-11-guide-pacing-explore-and-return)); and a throwaway reproduction test, run once and then deleted (§1.1). The owner's screenshots are not in the repository. The dark compact reference is taken from the sheet's own forest strip (§32 A), which matches the owner's description.

## 1. Gap ledger

Severity: **S1** breaks authoring or playback; **S2** a wrong or misleading behaviour; **S3** UX debt or a duplicate; **V** visually unfinished only.
"Verified" says how each was confirmed: **R** a reproduction run, **C** code reading at the cited lines, **T** an existing test.

### 1.1 Confirmed broken

| # | Issue | Expected | Actual | Evidence | Sev. |
|---|---|---|---|---|---|
| G1 | **Reorder after a Travel leaves no path** | A reorder that gives a Travel a new endpoint pair adds a straight path in the same change | `moveStopTo` sends `guideOrderIntent` with Stop ids only, and the `experience-guide-order` planner is non-compound and never writes Camera. The Travel keeps pointing at its new neighbour, the validator reports `travel-gap`, and `lowerExperienceProgram` refuses the **whole** Guide (`travel-gap`), so Preview and the strip's ▶ go dead. | R: reorder `[s1(travel), s2, s3]` → `[s1, s3, s2]` gives `travel-gap: … no Camera connection joins "view-1" to "view-3"`. C: `experience-controller.svelte.ts` `moveStopTo` (L904); `commands.ts` `guideOrderIntent` (L323); `planning.ts` guide-order admission (L1323). | S1 |
| G2 | **Insert or append after a Travel leaves no path** | The edge into the new Stop is joined in the same change | `addStop`, `addToGuide` and `createGuide` send `stopCreateIntent`/`guideCreateIntent` with no path. The earlier Stop's `sequence-next` Travel now targets the new Stop. A Travel left dormant on the last Stop re-activates on append. | C: controller L834–L900, L1334–L1390; `planning.ts` stop-create (L1172) and guide-create (L1021) admissions are non-compound. | S1 |
| G3 | **Changing a Stop's *Enter at* leaves the Travels in and out without paths** | Both affected pairs are joined in the same change | `setStopEntry` → `updateStop` without `travelPath`. The `experience-stop-update` planner can add one path, but only when asked, and only one. | C: controller `setStopEntry` (L992); planner `travelPath` is a single pair (`planning.ts` L1692). | S1 |
| G4 | **Reordering a Presentation's Views breaks Guide Travels that follow the Default** | The steps *and* the Guide pairs that change are joined | `writePresentationViews` joins only the Presentation's own steps; Stops with `entryViewId: null` move with the new View 1, and their Guide Travels are not joined. | C: controller L1027–L1100 (`travelPaths` built from the steps only) and `movePresentationView` (L1103). | S1 |
| G5 | **Removing a Stop or a View leaves the new neighbours' Travel unjoined** | The removal plan names the straight path it adds and installs it | `planStopRemoval` returns `camera: null` and keeps the Cut/Travel choice; `planPresentationViewRemoval` keeps the step's kind. | C: `experience-structure.ts` L188–L304; removal planners `planning.ts` L2478 and L2504 (non-compound). | S1 |
| G6 | **An explicit continuation to another Stop keeps Travel with no path** | Joined like any other pair | `setContinuation` → `updateStop` without `travelPath`. | C: controller `setContinuation` (L1126). | S2 (UI to be retired, G14) |
| G7 | **Travel between two Stops on the same View is accepted, then cannot be fixed** | Travel is unavailable, with the reason *Both Stops show Front* | `setTransition` passes no path when `fromViewId === toViewId`, the edge is still saved as Travel, and the validator and lowering report a gap that no path can fill. A second visit to the same Presentation at the Default produces this. | R: two Stops entering `view-1`, Travel → `travel-gap: … joins "view-1" to "view-1"`. C: controller L1144–L1162. | S1 |
| G8 | **Success feedback is shown as a refusal** | Typed success, info and refusal | `messageRefused` is `message !== '' && !accepted.has(message)`, and the set holds only `'Accepted.'` plus lines wrapped in `succeed()`. `setGuidePacing` (both directions), `setPresentationStep`, `movePresentationView`, *had no Default View* and the S29 endpoint notice all reach the creator styled red. | C: controller L511, L969–L990, L1093–L1121, L1863; the spatial route's `experience-feedback` `class:refused`. | S2 |
| G9 | **The source diagnostics chip is misleading and exposes ids** | Plain language with Stop numbers and names, a *Show* link, and ids only in *Copy details* | The summary always says *Some links point at things that are gone*, whatever the code, and the list prints the raw validator messages with Stop and View UUIDs. A missing Camera path, which is a connectivity fault, reads as deleted content. | C: the spatial route `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` L5859–L5890; validator messages `validate.ts` L1319, L1421. | S2 |
| G10 | **A creator warning for work the edit should have done** | No warning; the edit reconciles (G1–G6) | The S29 effect says *Travel 2 → 3 now joins different Views. Check the Camera path.* after a reorder, and the strip offers a manual **+** path button on every gap chip. | C: controller L394–L423; `ExperienceGuide.svelte` L1015–L1028. | S2 |
| G11 | **Choosing End hides the only control that undoes it** | Explicit End is visible and recoverable | `{#if !isEnd && continuation !== null}` wraps the *Next goes to* select, so once End is chosen the select disappears and only Undo recovers. The Cut/Travel switch is disabled too. | C: `ExperienceTransitionWriter.svelte` L212–L222, `segmentReason` L84–L92. | S2 |
| G12 | **Visitor progress uses program order, not the run** | One segment per occurrence, in the order the run plays | `currentStopNumber` and the dashes index into `program.stops`. With *Starts at* past Stop 1, or an explicit continuation, the visitor reads *Stop 3 of 5* at the start, and the skipped Stops are marked done. | C: `VisitorPreviewSurface.svelte` L105–L116 and L464–L470. Not reproduced in the browser. | S2 |

### 1.2 Visually unfinished, or a duplicate to remove

| # | Issue | §33 | Actual | Evidence | Sev. |
|---|---|---|---|---|---|
| G13 | Guide strip styling | Dark compact cards, quiet forest selection | Light `#f3f4ef` cards with a 2 px gold selected border; gold selected chips, caret and Follow | `ExperienceGuide.svelte` L1401–L1423, L1530–L1534, L1577–L1585 | V |
| G14 | *Next goes to* in the ordinary Transition Card | Retired; order is the route | A select listing every Stop plus End | `ExperienceTransitionWriter.svelte` L212–L222 | S3 |
| G15 | Two timelines | One track: card rails plus Travel gutters | Per-card `stop-progress` rails **and** a separate proportional `.scrub` bar (§28 only partly delivered) | `ExperienceGuide.svelte` L985 and L1043–L1090 | S3 |
| G16 | Travel time not visible | `↗ 5 s` on the gutter | An adjacent gutter draws only a glyph; the seconds are in the accessible name only | `ExperienceGuide.svelte` L300–L317 and L1002–L1012 | V |
| G17 | Card metadata duplicates the timeline | No `Start`, `0:05` or `⏸` text on the card | `start-tag`, the `stop-time` text and the wait glyph on every card | `ExperienceGuide.svelte` L972–L982 | V |
| G18 | Guide Card duplicates the strip | Summary only | *Add stop*, *Play from the start*, large pacing cards, *Guided tour / Free exploration* launch cards, *Build the tour* instructions | `ExperienceGuideWriter.svelte` L66–L160 | S3 |
| G19 | *Starts at* not on the Guide Card | Guide Card · Starts at | Reachable only through the Stop context menu's *Start the tour here* | the spatial route L5317–L5330; `setGuideStart` (controller L1314) | S3 |
| G20 | Welcome text owned by the wrong Card | Experience Card | In the Guide Card's *more* snippet | `ExperienceGuideWriter.svelte` L164–L170 | S3 |
| G21 | Pacing edited away from the strip | Strip popover; Guide Card read-only | The strip label opens the Guide Card, where the large cards edit it (as §32 decided; §33 amends it) | `ExperienceGuide.svelte` L817–L825 | S3 |
| G22 | Gold reorder indicator in the View rail | A thin, light insertion line | A 2 px gold inset bar | `ExperienceViewRail.svelte` L495–L498 | V |
| G23 | No direct View → Stop | ＋ Stop per View row; drag a View onto the strip | Every creation path sends `entryViewId: null`, though both planners accept an entry | controller L860, L890, L1349, L1381; `planning.ts` L1076, L1182 | S3 |
| G24 | §27 not delivered | Live name, link and unlink, picker, removed state | `label` is a required string; Present this stores the entity's name as a copy; the Presentation Card shows no subject; the controller has no link or unlink command | `types.ts` `ExperiencePresentation` (L236); controller `presentationLabel` (L1796); `ExperiencePresentationWriter.svelte` (no subject UI) | S2 |
| G25 | Visitor progress is ordinal dashes only | A segmented, continuous bar | Fixed 26 px dashes with no stay, Travel, wait or freeze state | `VisitorPreviewSurface.svelte` L466–L470, L880–L897 | V |

### 1.3 Verified as working, so not planned again

| Behaviour | Verified | Notes |
|---|---|---|
| Cut → Travel on a Guide connection adds the straight path in the same Undo | C + T (`experience-controller.test.ts` L343–L389) | Kept; G1–G6 generalise it |
| Cut → Travel on a Presentation step adds its path; a range is one Undo | C (`writePresentationViews`) | Kept |
| Travel → Cut keeps the path; Travel again reuses it | C: the planner joins on an unordered pair (`sameUnorderedPair`, `planning.ts` L1852) | Passes the owner's rule |
| Paths are never stretched or retargeted by a reorder | C: no Experience planner rewrites a connection's endpoints | Passes. G1's failure is that it adds *nothing*, not that it retargets. |
| Two paths on one pair are refused, never guessed | C: lowering `travel-ambiguous` (`lowering.ts` L240–L290) | Passes; only the wording changes (G9) |
| Strip overflow, paging arrows, keyboard roving, drag reorder, touch targets | C: `pageCards` L480, `onCardKeydown` L544, `onCardPointerDown` L622, touch rules L1556–L1830 | Re-skinned, not rewritten |
| One Guide clock; stays count after arrival; Explore freezes; Back's 2 s lead-in | T: `guide-run-parity.test.ts`, `visitor-runtime-state.test.ts`, `experience-runtime.test.ts` | The HUD reads it; nothing changes there |
| The Stop and guide-create planners accept `entryViewId` | C | G23 is controller and UI only |
| The Presentation planner accepts `subject` | C: `planning.ts` L1503–L1508 | G24 needs no new planner kind |

### 1.4 The owner's missing-path diagnostics: causes

The owner's *Some links point at things that are gone* chips are `travel-gap` findings, and they have **one architectural cause and one missing-reconciliation cause**:

1. **Missing reconciliation (G1–G6, the cause in every ordinary case).** Only the Cut → Travel switch, and the Presentation spine, ask the planner for a path. Every other command that changes a Travel's endpoints (order, insert, entry, the Default, removal, continuation) sends no path and goes through a planner that cannot write Camera. The model and Camera authority are right; the commands are incomplete.
2. **An architectural edge (G7).** A Travel between two identical Views is representable but meaningless. No path can join a View to itself, so the state is permanently invalid. It needs a guard, not reconciliation.

Neither is a Camera or interpreter defect. The lowering refusal is correct, because a Travel is never silently downgraded. What's missing is that an ordinary edit should never produce one.

## 2. Decision ledger

| Earlier decision | §33 | Notes |
|---|---|---|
| §5 Choosing Travel creates its path | **Kept, generalised** | Every edit that changes a Travel's pair joins it in the same change |
| §25 Compact Guide, wide white cards, time on the card, `⚠` only for broken data | **Amended** | Dark compact cards; no time or *Start* on the card; no **+**; overflow kept |
| §28 One scrubber on the cards | **Kept, delivered** | The separate bar is retired |
| §27 Name follows the object; link, unlink, picker; removed state | **Kept, delivered**; removed state amended (O-3) | Format: `label: string \| null` inside format 4 (§5) |
| §31 Model, pacing semantics, Explore and Back, journeys A–H | **Kept** | HUD progress amended (G25) |
| §31/§32 Pacing edited in the Guide Card | **Retired** | Edited in the strip's popover; the Guide Card shows it |
| §32 One owner and one field per setting | **Kept** | The table is superseded by [§33's](../../../reference/design-system/experience-interaction-sheet.html#fz-own) for pacing, welcome, *Next goes to*, path creation and Start |
| §32 A Transition Card from the chip; B the View rail and its fold | **Kept** | The rail's gold drop bar is restyled (G22) |
| §32 Start Stop: Guide Card · Starts at | **Kept, delivered** | The Stop context menu item is retired (O-6) |
| Welcome is unchanged (§31) | **Moved** | It belongs to the new Experience Card |
| *Next goes to* in the Transition Card (§25/§31) | **Retired from ordinary authoring** | The data, lowering and interpreter are kept; an exception chip and one recovery are shown (O-2) |
| Gates, per-View holds, multi-View Stops | **Stay retired** | Not reintroduced |

### Owner decisions, with recommendations

- **O-1 · Where a Cut or Travel lives on reorder and insert.** ★ It belongs to the Stop it leaves (`continuation.transition`, which is the current data). It moves with its card, and reconciliation joins its new pair. An inserted Stop's own outgoing connection is a Cut. *Alternative:* the transition belongs to the position, so the gutter stays put and the cards move through it. That needs a model change and is not recommended. The owner's *Cut is the default for a new edge* holds for every newly created Stop's outgoing edge. The one case it doesn't cover is the edge *into* an inserted Stop, which inherits the earlier Stop's choice.
- **O-2 · Explicit End and jumps.** ★ Stop creating them in ordinary authoring. Show existing ones as an exception chip (*■ End*, *→ 4*), dim the Stops they skip, and offer one recovery. Without branching, an early End only makes Stops unreachable, which removal or a second Guide states more honestly. The data, lowering, interpreter and detours stay dormant for a future branching design.
- **O-3 · A linked object is removed.** ★ The World removal writes the Presentation's last effective name into `label` in the same accepted change, and lists it in the removal's consequence line (*1 Presentation keeps the name "Pleyel piano"*). The subject reference stays, so the Card shows the removed state and the repair. This needs the Scene entity removal to be a compound intent that also writes Experience (`scene-planning/operations.ts`). *Fallback,* if that compound write is disproportionate: no write, and the Card shows *A removed object* with the same repair, while the name is unavailable until the creator relinks or names it. Either way, nothing silently retargets.
- **O-4 · Unused straight paths.** ★ Keep them for this pass: they're cheap, they let a move back reuse the same path, and deleting Camera geometry from an Experience edit is a boundary we shouldn't blur. A later Camera tidy-up can list unused paths. *Note:* step-wise keyboard moves can leave intermediate straight paths behind, as the §33 prototype shows.
- **O-5 · Format.** ★ Amend format 4 in place (§5). *Alternative:* bump to 5, with no migration. Not recommended, because format 4 has never been on `main`.
- **O-6 · The Stop context menu's *Start the tour here*.** ★ Retire it; the Guide Card owns Start. *Alternative:* keep it as an accelerator that writes the same command.
- **O-7 · An edit that creates a same-View Travel** (a reorder or an entry change). ★ Keep the authored Travel and show the one creator-facing repair (*Use a Cut*, or *Open Stop n*). Never silently convert it to a Cut.

## 3. Code boundary

**Project model** (`packages/project-model/src/units/`): the only place Travel validity is decided.

- `experience-structure.ts`: **new** pure `requiredTravelPairs(experience, connections) → ViewPair[]`. It returns every distinct unordered pair that a Travel uses and no connection joins: every Guide's `sequence-next` adjacency, explicit `stop` continuations, and each Presentation's Travel steps. It skips same-View pairs (reported separately) and sorts deterministically. The removal plans call it and return the straight connections they add (`camera` non-null), with a new consequence `{ kind: 'connection-added', connectionId, fromViewId, toViewId }`.
- `planning.ts`: each Experience planner that can change an endpoint (guide-order, stop-create, guide-create, stop-update, presentation-update, stop-remove, guide-remove, presentation-view-remove) builds its candidate, then calls one shared `withRequiredTravelPaths(candidate, capturedIds('connection'))`, a generalisation of today's `withStraightConnections`. That planner then refuses `travel-paths-incomplete` if any required pair is left unjoined because ids ran short, so an accepted change can never create a gap. Admissions become `compound: true, writes: ['camera']` for guide-order, stop-create, guide-create, stop-remove and guide-remove. The single `travelPath` payload field on stop-update goes; the planner derives the pairs.
- **Captured ids:** the controller supplies a pool of `connection` ids sized to an upper bound (the number of Travel uses in the candidate, plus one). The planner consumes them in sorted-pair order and ignores the rest. This keeps "planners never allocate". *Alternative:* the controller predicts the exact pairs through the same pure candidate builders and the planner checks them; it is stricter but means extracting every candidate builder. Recommend the pool, which `capturedIds` already supports.
- `validate.ts`: `travel-gap` stays. Same-View Travel gets its own code, `travel-same-view`, so the editor can word it. `label: null` is admitted only with a resolvable Scene-entity subject (§5).
- `experience/lowering.ts`: `ProgramPresentation.label` stays a required string; lowering resolves the effective name (`label ?? scene entity name`) through one helper, `presentationDisplayName(presentation, sceneEntities)`, exported for the editor. A same-View Travel is refused as `travel-same-view`. The interpreter is not touched.

**Editor controller and commands** (`apps/editor/src/lib/authoring/experience/`):

- `experience-controller.svelte.ts`: every endpoint-changing command passes a `connections` id pool. The S29 `travelEndpoints` effect is deleted. `setTransition` refuses Travel on a same-View pair with the reason. `addStop`, `addToGuide` and `createGuide` take `entryViewId`. New: `setPresentationSubject(presentationId, entityId | null)` (unlink writes the effective name as `label` in the same intent) and `followSubjectName(presentationId)` (`label: null`). `presentationLabel` returns the effective name. **Typed feedback:** `feedback: { kind: 'success' | 'info' | 'refusal'; text } | null` replaces `message` and `messageRefused`; `run(builder, success)` returns that shape, `succeed()` and the `accepted` set go, and refusals keep `creatorMessage`.
- `commands.ts`: `guideOrderIntent`, `stopCreateIntent`, `guideCreateIntent`, `stopUpdateIntent`, `presentationUpdateIntent` and `removeIntent` accept the connection id pool, and `captureBindIntent` sends `label: null` when it binds a subject.
- `experience-paths.ts`: an occurrence's state gains `'same-view'`.
- **New** `experience-problems.ts`, pure: it maps envelope diagnostics (code and path) to `{ sentence, subject: ExperienceSubject, fix?, detail }`, using Stop numbers in the context Guide, the Guide's name, effective Presentation names and View labels. `travel-gap.ts` is folded into it.
- `focus.svelte.ts`, `experience-model.ts` and `experience-card-model.ts`: a new subject kind, `{ kind: 'experience' }`, for the Experience Card.

**Components:**

- `ExperienceGuide.svelte`: re-skinned cards (§33 A); the gutter text `↗ 5 s`; the separate `.scrub` bar removed; one segmented track over the card rails and gutters, with per-segment pointer mapping (extend `timeline-scrub.ts` from a fraction of the whole width to a segment and a local fraction); the pacing popover; the **+** gap button removed; the explicit End and jump chips.
- `ExperienceGuideWriter.svelte`: summary-only (§33 B), with *Starts at*.
- New `ExperienceExperienceWriter.svelte`: name, *Opens with* and the welcome, reached from the Index header's Experience name.
- `ExperienceTransitionWriter.svelte`: *Next goes to* removed; exception and recovery block; same-View reason.
- `ExperienceViewRail.svelte`: ＋ Stop per row, guided or explore tags, and a light insertion line. `ExperiencePresentationWriter.svelte`: the *About* section (link, unlink, Show in World, pick, the Capture suggestion and the removed state) and the name field's follow state.
- The spatial route (`apps/editor/src/routes/project/[projectId]/spatial/+page.svelte`): the problems chip from `experience-problems.ts`; feedback styled by kind; the Stage pick-to-link mode (one shot, <kbd>Esc</kbd>); a View row dropped onto the strip; the context menu's *Start the tour here* retired.
- `VisitorPreviewSurface.svelte`: the segmented progress (§33 F). Order comes from `guideRunFromProgram` (`visitor/guide-run-map.ts`), the stay fill from the run state's `holdRemainingMs` and the Stop's `staySeconds`, and the Travel fill from a new `onTravelProgress(fraction)` callback on `VisitorCameraDirector.svelte`, which reports its existing `transitionProgress`. There is no new timer.

**Not touched:** `packages/camera-core` (authority, evaluation, `guide-time-map.ts`), the interpreter, program v4's shape, Layout and Scene evaluation, and resources.

**Test families:** `apps/editor/tests/lib/authoring/unit-acceptance-conformance.test.ts` and `stage-source-admission.test.ts` (admissions); `apps/editor/tests/lib/project-model/units-conformance.test.ts`, `program-conformance.test.ts`, `units-canonical-form.test.ts`, `references-conformance.test.ts`; `apps/editor/tests/lib/experience/experience-structure.test.ts`, `experience-controller.test.ts`, `experience-authoring.test.ts`, `first-guide.test.ts`, `camera-paths.test.ts`, `travel-gap.test.ts` (becomes the problems test), `timeline-scrub.test.ts`, `playback.test.ts`, `guide-time-map.test.ts`, `experience-homes-components.test.ts`, `experience-card-model.test.ts`; `apps/editor/tests/lib/visitor/visitor-runtime-state.test.ts`, `guide-run-parity.test.ts`, `preview-surface-boundary.test.ts`.

## 4. Implementation slices

Ordered by dependency. Complexity: **S** under half a day, **M** one to two days, **L** three or more.

| # | Slice | Contains | Entry | End | Size |
|---|---|---|---|---|---|
| 1 | **Typed feedback** | G8: the `feedback` shape, `run`/`say` typed, the route styling, tests updated from `messageRefused` | — | Manual ⇄ Automatic shows a green line; a refusal stays red; no string whitelist remains | S |
| 2 | **Travel reconciliation** | G1–G7: `requiredTravelPairs`, `withRequiredTravelPaths`, compound admissions, the id pool through every command, removal plans adding paths, `travel-same-view`, the S29 notice deleted | — | Regression rows R1–R12 pass; no ordinary edit produces `travel-gap`; Undo removes both the edit and its paths | L |
| 3 | **Problems** | G9, G10: `experience-problems.ts`, the chip's sentences and *Show*, *Copy details* holding the codes, the **+** gap button removed | 2 | R13–R15; a duplicate imported path reads in plain language and *Show* opens its Transition Card | M |
| 4 | **Guide strip and one timeline** | G13, G15–G17, G21, G22: cards, gutter time, the segmented scrub, the pacing popover, the insertion line, chip selection | 1 | Journeys I and L; the §28 keys pass on the new track; no gold remains on the strip or the rail | L |
| 5 | **Guide Card, Experience Card** | G18–G20: summary-only Guide Card with *Starts at*; the new `experience` subject and Card with the welcome; the context-menu Start retired | 4 | R20; the welcome is edited only in the Experience Card | M |
| 6 | **Continuation pruning** | G11, G14: *Next goes to* removed; End and jump chips; recovery | 2, 4 | Journey O; existing explicit continuations still lower and play unchanged | S |
| 7 | **View → Stop** | G23: `entryViewId` through the creation commands; ＋ Stop per row; a View dropped onto the strip; the first-Guide name prompt | 2 | Journey J; R16 | S |
| 8 | **Presentation follows its object** | G24: the format 4 amendment (§5); `presentationDisplayName` in lowering and the controller; Present this and Capture bind with `label: null`; the *About* section; link, unlink and follow commands; the Stage picker; O-3 | 2 | Journey M; R17–R19; the Index, strip, Cards, caption and Places all agree | L |
| 9 | **Visitor progress** | G12, G25: segments from the run; stay and Travel fill; Manual outline; freeze; Back | — | Journey N; R21–R23 | M |
| 10 | **Acceptance** | Journeys A–H re-run, plus I–P; `npm test`, `npm run test:arch`, `npm run check`, `npm run build`; AM-11 and the persistence reference amended | all | §9 | M |

Slices 1 and 9 depend on nothing and can go first. Slice 2 is the critical path.

## 5. Schema implications

- **§27 needs a current-format change: yes, and it can stay format 4.** `ExperiencePresentation.label` becomes `string | null`. `null` means "the linked Scene entity's live name"; a string is the creator's own. Format 4 exists only on this PR's branch (`main` is format 3), so the field is amended in place: no bump, no migration, no compatibility reader and no dual representation. Format 3 stays strictly refused. Every format-4 file already on disk carries a string, so it reads unchanged, as an own name. *Use the object's name* switches one to following.
- **Validation:** `label: null` requires `subject` to be a Scene entity. A missing entity is the existing `unresolved-subject`; with O-3, a removal never leaves `label: null` on a removed entity. An empty string is refused, as today.
- **Program v4:** unchanged in shape. `ProgramPresentation.label` is the resolved effective name, so the visitor runtime and published releases never resolve Scene names themselves.
- **No other format change:** Travel reconciliation, typed feedback, the Experience Card, View → Stop and the HUD are behaviour only. The removal consequence `connection-added` is a planning type, not persisted.

## 6. Regression matrix

| # | Case | Expected |
|---|---|---|
| R1 | Reorder: a Travel gets a new pair with no path | One straight path added; one Undo removes both |
| R2 | Reorder: the new pair already has a path (either direction) | Reused; nothing added |
| R3 | Reorder back | The original custom path is used again, geometry and time unchanged |
| R4 | Reorder never edits a connection's endpoints, anchors or timing | Camera unit diff is additions only |
| R5 | Insert after a Travel (O-1) | The earlier Stop travels to the new one, with a path added; the new Stop's outgoing connection is a Cut |
| R6 | Append after a last Stop whose Travel is dormant | Joined, or Cut if O-1 is decided otherwise |
| R7 | *Enter at* change on a Stop with a Travel in and out | Both pairs joined |
| R8 | Presentation View reorder that changes the Default | Steps and Guide pairs joined; Stops with their own entry unaffected |
| R9 | Remove a Stop between two Travel Stops | The removal plan lists *path added* and installs it |
| R10 | Remove a View that is a Travel step's endpoint | The new neighbours' step joined; the removed View's unshared paths released (existing rule) |
| R11 | Same Presentation twice, same entry, Travel | Travel disabled with the reason; an edit that creates it shows the repair (O-7) |
| R12 | Same Presentation twice, different entries | A path between the two Views; shared ×2 with the Presentation step when they're adjacent |
| R13 | Imported file with two paths on one pair | `travel-ambiguous` worded with View labels; *Show*; nothing guessed |
| R14 | Imported file with a Travel gap | Plain sentence with Stop numbers; *Show*; ids only in *Copy details* |
| R15 | Travel → Cut → Travel | The path kept, then reused |
| R16 | View → Stop for View 3 of a Presentation; the Default moves later | The Stop keeps entering View 3 |
| R17 | Following Presentation; the World object is renamed | The Index, strip, Stop, Transition and Presentation Cards, caption and Places all change; no Experience write |
| R18 | Own name; then *Use the object's name*; then unlink | The own name stays put through renames; following resumes; unlinking stores the current name; one Undo each |
| R19 | Linked object removed; Undo | O-3 consequence shown; repair offered; Undo restores following |
| R20 | Manual ⇄ Automatic | Stays kept; the strip, Guide Card, Stop Card and visitor agree; green feedback |
| R21 | Visitor: Automatic stay, Travel, Pause, Explore, Back with under 2 s left | Fill frozen while paused and exploring; Back restores it with the lead-in; Travel fills its connector |
| R22 | Visitor: Manual | No stay fill; the current segment outlined; Next continues |
| R23 | Visitor: *Starts at* Stop 3, and a second visit to one Presentation | Segments follow the run; the second visit is its own segment |
| R24 | Strip: scrub across cards of different stay lengths | Each card maps its own stay; the tooltip names the time and the Stop |
| R25 | Strip keys | <kbd>←</kbd>/<kbd>→</kbd> 1 s, <kbd>Shift</kbd> 5 s, <kbd>PgUp</kbd>/<kbd>PgDn</kbd>, <kbd>Home</kbd>/<kbd>End</kbd>, <kbd>Space</kbd>; <kbd>Alt</kbd>+<kbd>←</kbd>/<kbd>→</kbd> reorders; the popover's arrows, <kbd>Esc</kbd> and focus return |
| R26 | Strip at 12 and 30 Stops; touch hold-to-drag | Scroll and paging keep working; the selected or playing Stop stays in view |

## 7. Browser acceptance journeys (in addition to A–H)

- **I · Reorder a Travelling tour.** Make Stop 2 → 3 a Travel and shape it. Drag Stop 3 to the end. ▶ plays at once with no chip or warning. Drag it back: the shaped path returns. Undo twice.
- **J · Build from Views.** In the Pleyel piano's Card, press ＋ Stop on *Keyboard*, then on *From the window*. Both Stops enter where you chose. Make the connection between them a Travel, then reorder the Presentation's Views. Nothing breaks.
- **K · Change where a Stop enters.** On a Stop with a Travel in and out, change *Enter at*. Both Travels still play.
- **L · Pacing from the strip.** Open the pill and choose Manual with the keyboard. Focus returns to the pill. The feedback is green. Play: it stops at each ⏸, and ▶ continues. Switch back: the stays are as they were.
- **M · The object's name.** Present a World object. Rename it in World, and check every place it shows. Type your own name, rename the object again (yours stays), then press *Use the object's name*. Unlink. Link with *Pick on the Stage*, then press <kbd>Esc</kbd> once mid-pick. Remove the object, then Undo.
- **N · Visitor progress.** Preview an Automatic Guide that starts at Stop 3 and visits one Presentation twice. Watch a Travel fill. Pause, Explore, then Back with little time left. Switch to Manual and preview again.
- **O · An imported End.** Open a project whose Stop 3 continues to End. The gutter says *■ End* and Stops 4–5 are dimmed. *Continue to Stop 4* restores it.
- **P · Problems.** Make two Stops on the same View and choose Travel: the Card says why it can't. Open an imported file with a duplicate path: the chip names the Stops and Views, *Show* opens the Card, and *Copy details* has the ids.

## 8. Out of scope and deferred

Not in this round, and not to be grown into by accident:

- Narration and audio; walking or free movement in Explore; published hosting and sharing; analytics.
- General branching: detours, choice points, explicit-target authoring, and mixed pacing (one wait in an Automatic Guide). The data and runtime stay dormant (O-2).
- Visitor scrubbing; per-visit Travel time; automatic deletion of unused paths (O-4).
- Layout-element subjects for §27. Preview still does not resolve them (`unresolved-subject`); §33 links Scene entities only.
- Any Camera authority, evaluation or `guide-time-map.ts` change; any interpreter rewrite; any second timer.
- Multi-select of Stops, Guide duplication, and Stop copy and paste.
- The ratified-text Gates cleanup (`north-star.md`, `architecture.md`, the shell contract) remains the open owner item from PR #271's description.

## 9. Final gate

PR #271 can be accepted, and R217.S11 can begin, only when:

1. Slices 1–9 are merged on this branch, with every G-row in §1.1–§1.2 closed or explicitly waived by the owner.
2. R1–R26 pass as automated tests where they're testable, and in the browser otherwise.
3. Journeys A–H and I–P pass in the owner's browser run.
4. No ordinary authoring path can produce `travel-gap` or `travel-same-view`. A property-style test runs random reorders, inserts, entry changes and removals over a fixture with Travels, and lowering never refuses.
5. `npm test` and `npm run test:arch` show no failure beyond the base `parallel-track-gates` and `spatial-route-gesture` set PR #271 recorded. `npm run check` reports 0 errors and `npm run build` passes.
6. AM-11 in [composition-execution.md](../../../reference/composition-execution.md#am-11-guide-pacing-explore-and-return) and the persistence reference record the `label: string | null` amendment and reconciliation rule, and sheet §33's ★ choices match what shipped.
7. O-1 to O-7 are answered by the owner, and the answers are recorded here.
