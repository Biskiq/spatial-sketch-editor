# Experience final reconciliation: defect ledger and implementation plan (sheet §33)

**Status:** revision 2, for owner review, 2026-11-05. Design only: no product code has changed in this round.
**PR:** Biskiq/spatial-sketch-editor#271 on `claude/eloquent-goldberg-yrasgu`, open and not accepted. R217.S11 does not begin until the [final gate](#9-final-gate) passes.
**Design:** [sheet §33](../../../reference/design-system/experience-interaction-sheet.html#s33), with interactive prototypes A–G, the linear-Guide table (H), the ownership table and the change table.
**History:** [fix-plan.md](./fix-plan.md) (review 1) and [guide-playback-plan.md](./guide-playback-plan.md) (§31/§32, slices 1–7) stay as the record. This file is the implementation-ready plan for the current round.

**Evidence used:** the PR #271 code at head `da61716d`; sheet §5, §25, §27, §28, §31 and §32; the existing contracts ([composition-execution AM-11](../../../reference/composition-execution.md#am-11-guide-pacing-explore-and-return)); and a throwaway reproduction test, run once and then deleted (§1.1). The owner's screenshots are not in the repository. The dark compact reference is taken from the sheet's own forest strip (§32 A), which matches the owner's description.

### What revision 2 changes

The owner approved the rest of §33 and decided the open questions (§2, D-1 to D-8), then added four rules in the same spirit (D-9 to D-12). The Guide becomes **one linear sequence**: the first Stop starts, the last Stop ends, and the order is the route. Rather than hiding *Starts at*, *Next goes to* and an early End, they leave format 4. The Guide Card is retired, because each Guide setting already has a home on the strip or the Experience Card. A Travel exists only between two different Views, and never after the last Stop, so any edit that would break either rule writes a Cut. Removing a linked World object unlinks its Presentation and keeps the name, and World never marks an object as linked. The first Stop creates the first Guide, named *Tour*, with no prompt; a single Guide is the Opening Guide without asking. The slices are recut around a new model slice (§4, slice 2), and §2.2 lists the remaining tradeoffs, including where the owner's decisions meet the architecture.

The sheet's visitor-HUD defect is also fixed. A global `.cur` rule from an earlier section (white, `min-height: 150px`) leaked into the current progress segment and drew a pale box over the HUD. That was a sheet defect only, not a product one.

## 1. Gap ledger

Severity: **S1** breaks authoring or playback; **S2** a wrong or misleading behaviour; **S3** UX debt or a duplicate; **V** visually unfinished only.
"Verified" says how each was confirmed: **R** a reproduction run, **C** code reading at the cited lines, **T** an existing test.
"Closed by" names the slice, or *model* where revision 2 removes the thing that was broken.

### 1.1 Confirmed broken

| # | Issue | Expected | Actual | Evidence | Sev. | Closed by |
|---|---|---|---|---|---|---|
| G1 | **Reorder after a Travel leaves no path** | A reorder that gives a Travel a new pair of different Views adds a straight path in the same change | `moveStopTo` sends `guideOrderIntent` with Stop ids only, and the `experience-guide-order` planner is non-compound and never writes Camera. The Travel keeps pointing at its new neighbour, the validator reports `travel-gap`, and `lowerExperienceProgram` refuses the **whole** Guide (`travel-gap`), so Preview and the strip's ▶ go dead. | R: reorder `[s1(travel), s2, s3]` → `[s1, s3, s2]` gives `travel-gap: … no Camera connection joins "view-1" to "view-3"`. C: `experience-controller.svelte.ts` `moveStopTo` (L904); `commands.ts` `guideOrderIntent` (L323); `planning.ts` guide-order admission (L1323). | S1 | 3 |
| G2 | **Insert or append after a Travel leaves no path** | The edge into the new Stop is joined in the same change | `addStop`, `addToGuide` and `createGuide` send `stopCreateIntent`/`guideCreateIntent` with no path. The earlier Stop's `sequence-next` Travel now targets the new Stop. A Travel left dormant on the last Stop re-activates on append. | C: controller L834–L900, L1334–L1390; `planning.ts` stop-create (L1172) and guide-create (L1021) admissions are non-compound. | S1 | 2 (no dormant Travel), 3 |
| G3 | **Changing a Stop's *Enter at* leaves the Travels in and out without paths** | Both affected pairs are joined, or become a Cut if they now share a View | `setStopEntry` → `updateStop` without `travelPath`. The `experience-stop-update` planner can add one path, but only when asked, and only one. | C: controller `setStopEntry` (L992); planner `travelPath` is a single pair (`planning.ts` L1692). | S1 | 3 |
| G4 | **Reordering a Presentation's Views breaks Guide Travels that follow the Default** | The steps *and* the Guide pairs that change are joined | `writePresentationViews` joins only the Presentation's own steps; Stops with `entryViewId: null` move with the new View 1, and their Guide Travels are not joined. | C: controller L1027–L1100 (`travelPaths` built from the steps only) and `movePresentationView` (L1103). | S1 | 3 |
| G5 | **Removing a Stop or a View leaves the new neighbours' Travel unjoined** | The removal plan names the straight path it adds and installs it | `planStopRemoval` returns `camera: null` and keeps the Cut/Travel choice; `planPresentationViewRemoval` keeps the step's kind. | C: `experience-structure.ts` L188–L304; removal planners `planning.ts` L2478 and L2504 (non-compound). | S1 | 3 |
| G6 | **An explicit continuation to another Stop keeps Travel with no path** | — | `setContinuation` → `updateStop` without `travelPath`. | C: controller `setContinuation` (L1126). | S2 | model (2): explicit continuations leave the format |
| G7 | **Travel between two Stops on the same View is accepted, then cannot be fixed** | It is a Cut, with no Travel on offer | `setTransition` passes no path when `fromViewId === toViewId`, the edge is still saved as Travel, and the validator and lowering report a gap that no path can fill. A second visit to the same Presentation at the Default produces this. | R: two Stops entering `view-1`, Travel → `travel-gap: … joins "view-1" to "view-1"`. C: controller L1144–L1162. | S1 | 2 (rule), 3 (every edit) |
| G8 | **Success feedback is shown as a refusal** | Typed success, info and refusal | `messageRefused` is `message !== '' && !accepted.has(message)`, and the set holds only `'Accepted.'` plus lines wrapped in `succeed()`. `setGuidePacing` (both directions), `setPresentationStep`, `movePresentationView`, *had no Default View* and the S29 endpoint notice all reach the creator styled red. | C: controller L511, L969–L990, L1093–L1121, L1863; the spatial route's `experience-feedback` `class:refused`. | S2 | 1 |
| G9 | **The source diagnostics chip is misleading and exposes ids** | Plain language with Stop numbers and names, a *Show* link, and ids only in *Copy details* | The summary always says *Some links point at things that are gone*, whatever the code, and the list prints the raw validator messages with Stop and View UUIDs. A missing Camera path, which is a connectivity fault, reads as deleted content. | C: the spatial route `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` L5859–L5890; validator messages `validate.ts` L1319, L1421. | S2 | 4 |
| G10 | **A creator warning for work the edit should have done** | No warning; the edit reconciles | The S29 effect says *Travel 2 → 3 now joins different Views. Check the Camera path.* after a reorder, and the strip offers a manual **+** path button on every gap chip. | C: controller L394–L423; `ExperienceGuide.svelte` L1015–L1028. | S2 | 3, 5 |
| G11 | **Choosing End hides the only control that undoes it** | — | `{#if !isEnd && continuation !== null}` wraps the *Next goes to* select, so once End is chosen the select disappears and only Undo recovers. | C: `ExperienceTransitionWriter.svelte` L212–L222, `segmentReason` L84–L92. | S2 | model (2): End leaves the format |
| G12 | **Visitor progress indexes program order** | One segment per Stop in the Guide's order; a jump marks only what was visited | `currentStopNumber` and the dashes index into `program.stops`. With *Starts at* past Stop 1 the visitor read *Stop 3 of 5* at the start. The linear model removes that case. What's left: after a visitor jumps forward with Places, the skipped Stops show as done. | C: `VisitorPreviewSurface.svelte` L105–L116 and L464–L470. Not reproduced in the browser. | S3 | 9 |
| G26 | **A Stop that a Detour uses can't be removed, and nothing can remove the Detour** | Removing the Stop removes the Detours that use it in the same change, and says so | `planStopRemoval` refuses `detour-uses-stop` (*A Detour uses this Stop; remove the Detour first*), and no command or UI removes a Detour. An imported file with a Detour therefore pins its Stops forever. | C: `experience-structure.ts` L94–L98; no Detour command in `commands.ts` or the controller. | S2 | 2 |
| G27 | **One Stop in two Guides is representable, which makes its outgoing transition ambiguous** | A Stop belongs to exactly one Guide | No command creates it (reorders are permutations, and every create makes a new Stop), but the validator accepts it and computes several successors for one Stop (`successorIdsByStopId`), so one stored Cut/Travel would govern two different pairs. | C: `validate.ts` L1360–L1372; guide-order permutation check `planning.ts` L1345–L1355. | S3 | 2 |

### 1.2 Visually unfinished, or a duplicate to remove

| # | Issue | §33 | Actual | Evidence | Sev. | Closed by |
|---|---|---|---|---|---|---|
| G13 | Guide strip styling | Dark compact cards, quiet forest selection | Light `#f3f4ef` cards with a 2 px gold selected border; gold selected chips, caret and Follow | `ExperienceGuide.svelte` L1401–L1423, L1530–L1534, L1577–L1585 | V | 5 |
| G14 | *Next goes to* in the ordinary Transition Card | Gone; order is the route | A select listing every Stop plus End | `ExperienceTransitionWriter.svelte` L212–L222 | S3 | 2 |
| G15 | Two timelines | One track: card rails plus Travel gutters | Per-card `stop-progress` rails **and** a separate proportional `.scrub` bar (§28 only partly delivered) | `ExperienceGuide.svelte` L985 and L1043–L1090 | S3 | 5 |
| G16 | Travel time not visible | `↗ 5 s` on the gutter | An adjacent gutter draws only a glyph; the seconds are in the accessible name only | `ExperienceGuide.svelte` L300–L317 and L1002–L1012 | V | 5 |
| G17 | Card metadata duplicates the timeline | No `Start`, `0:05` or `⏸` text on the card | `start-tag`, the `stop-time` text and the wait glyph on every card | `ExperienceGuide.svelte` L972–L982 | V | 5 |
| G18 | The Guide Card duplicates the strip | No Guide Card | *Add stop*, *Play from the start*, large pacing cards, *Guided tour / Free exploration* launch cards, *Build the tour* instructions | `ExperienceGuideWriter.svelte` L66–L160 | S3 | 6 |
| G19 | *Starts at* hidden in a context menu | Gone; Stop 1 starts | Reachable only through the Stop context menu's *Start the tour here* | the spatial route L5317–L5330; `setGuideStart` (controller L1314) | S3 | model (2) |
| G20 | Welcome text owned by the wrong Card | Experience Card | In the Guide Card's *more* snippet | `ExperienceGuideWriter.svelte` L164–L170 | S3 | 6 |
| G21 | Pacing edited away from the strip | Strip popover only | The strip label opens the Guide Card, where the large cards edit it (as §32 decided; §33 amends it) | `ExperienceGuide.svelte` L817–L825 | S3 | 5 |
| G22 | Gold reorder indicator in the View rail | A thin, light insertion line | A 2 px gold inset bar | `ExperienceViewRail.svelte` L495–L498 | V | 5 |
| G23 | No direct View → Stop | ＋ Stop per View row; drag a View onto the strip | Every creation path sends `entryViewId: null`, though both planners accept an entry | controller L860, L890, L1349, L1381; `planning.ts` L1076, L1182 | S3 | 7 |
| G24 | §27 not delivered | Live name, link and unlink, picker; removal unlinks | `label` is a required string; Present this stores the entity's name as a copy; the Presentation Card shows no subject; the controller has no link or unlink command | `types.ts` `ExperiencePresentation` (L236); controller `presentationLabel` (L1796); `ExperiencePresentationWriter.svelte` (no subject UI) | S2 | 8 |
| G25 | Visitor progress is ordinal dashes only | A segmented, continuous bar | Fixed 26 px dashes with no stay, Travel, wait or freeze state | `VisitorPreviewSurface.svelte` L466–L470, L880–L897 | V | 9 |

### 1.3 Verified as working, so not planned again

| Behaviour | Verified | Notes |
|---|---|---|
| Cut → Travel on a Guide connection adds the straight path in the same Undo | C + T (`experience-controller.test.ts` L343–L389) | Kept; G1–G5 generalise it |
| Cut → Travel on a Presentation step adds its path; a range is one Undo | C (`writePresentationViews`) | Kept |
| Travel → Cut keeps the path; Travel again reuses it | C: the planner joins on an unordered pair (`sameUnorderedPair`, `planning.ts` L1852) | Passes the owner's rule |
| Paths are never stretched or retargeted by a reorder | C: no Experience planner rewrites a connection's endpoints | Passes. G1's failure is that it adds *nothing*, not that it retargets. |
| Two paths on one pair are refused, never guessed | C: lowering `travel-ambiguous` (`lowering.ts` L240–L290) | Passes; only the wording changes (G9) |
| A Presentation can't list a View twice, so its own steps never join a View to itself | C: `validate.ts` L541 (`names a View twice`) | Same-View is a Guide-only case |
| Strip overflow, paging arrows, keyboard roving, drag reorder, touch targets | C: `pageCards` L480, `onCardKeydown` L544, `onCardPointerDown` L622, touch rules L1556–L1830 | Re-skinned, not rewritten |
| One Guide clock; stays count after arrival; Explore freezes; Back's 2 s lead-in | T: `guide-run-parity.test.ts`, `visitor-runtime-state.test.ts`, `experience-runtime.test.ts` | The HUD reads it; nothing changes there |
| Detours: an authored excursion returns to its origin before any continuation; a nested one keeps the outer return | C + T: `interpreter.ts` L812–L820 and L890–L901; `experience-runtime.test.ts` | Sound; kept as is (§2, D-8) |
| The Stop and guide-create planners accept `entryViewId` | C | G23 is controller and UI only |
| The Presentation planner accepts `subject` | C: `planning.ts` L1503–L1508 | G24 needs no new Experience planner kind |

### 1.4 The owner's missing-path diagnostics: causes

The owner's *Some links point at things that are gone* chips are `travel-gap` findings, and they have **one missing-reconciliation cause and one architectural edge**:

1. **Missing reconciliation (G1–G5, the cause in every ordinary case).** Only the Cut → Travel switch, and the Presentation spine, ask the planner for a path. Every other command that changes a Travel's endpoints (order, insert, entry, the Default, removal) sends no path and goes through a planner that cannot write Camera. The model and Camera authority are right; the commands are incomplete.
2. **An architectural edge (G7).** A Travel between two identical Views is representable but meaningless, and no path can join a View to itself. Revision 2 makes it unrepresentable in ordinary authoring: such a pair is always a Cut.

Neither is a Camera or interpreter defect. The lowering refusal is correct, because a Travel is never silently downgraded. Ordinary edits must simply never produce one.

## 2. Decisions

### 2.1 The owner's decisions (5 November) and how §33 applies them

| # | Decision | Applied as |
|---|---|---|
| D-1 | **One polished, predictable linear Guide.** The strip's order is the route: first Stop starts, last Stop ends. Visitors still jump between Stops; the editor seeks anywhere without changing the order. | `Guide.entryStopId` and `Stop.continuation` leave format 4 (§5). The Cut/Travel choice stays, as `Stop.transition`. Preview-from-here and visitor Prev, Next and Places stay as run-time navigation. Sheet §33 H. |
| D-2 | **Retire the Guide Card.** | No Guide subject in the Card. Name: rename in place on the strip, and on the Index row. Pacing: the strip pill. Order and playback: the strip. Remove Guide: the strip's ⋯ and the Index row menu. Opening Guide and welcome: the Experience Card, which is the Card when nothing is selected. The Guide Card's *Reaches* summary is dropped, not moved. Sheet §33 B. |
| D-3 (O-1) | **A Cut or Travel follows the Stop it leaves** on reorder; existing paths are preserved; no surprising dormant transitions. | The transition moves with its card. A Stop that becomes the last one gets a Cut in the same change, so no Travel is ever dormant. Paths are never deleted (D-5). |
| D-4 (O-3) | **Deleting a linked World object just works.** The Presentation keeps its last name, Views and Stops, and is unlinked automatically. No World warning or recovery UX. | One accepted change: the Scene removal also unlinks every Presentation about that object and writes its effective name as the own name. One Undo restores both. The feedback line says it once; there's no removed state. See T-3 for the architectural cost. |
| D-5 (O-4) | **Leave unused Camera paths alone** for now. | Kept. A later Camera tidy-up may list them. |
| D-6 (O-5) | **Amend format 4 directly**, with no compatibility or migration. | §5. |
| D-7 (O-7) | **Same View to itself is simply a Cut.** Don't offer Travel; handle it the same way after reorders. | The Transition Card shows *✂ Cut · Both Stops show Front* and no switch. Any edit that makes a Travel's two Stops share a View writes a Cut in the same change. The validator refuses a same-View Travel in a file (`travel-same-view`). |
| D-8 | **Keep the Transition Card** for both Cut and Travel. **No branching** in this milestone; keep the existing Detour semantics if they're sound. | The Transition Card keeps Cut or Travel, the path, its time and its shape. Detours are sound (§1.3) and keep their data, lowering and runtime; G26's dead end is fixed by letting a Stop removal take its Detours with it. No Detour authoring UI is added. |
| — (O-2, O-6) | Superseded by D-1. | Early End and jumps leave the model; *Start the tour here* goes with *Starts at*. |
| D-9 | **The first Stop creates the first Guide** automatically, with a default name. No setup or naming prompt; rename inline on the strip later. | The first ＋ Stop, Add to Guide, View-row ＋ Stop or View drop creates a Guide labelled *Tour* in the same change. A further Guide made from the Index is *Tour 2*, *Tour 3*, and so on. The D8 naming prompt and `firstGuideLabel` are removed. |
| D-10 | **One Guide is automatically the Opening Guide.** Expose the choice only when several Guides exist. | `entryGuideId` stays in the format, maintained by the planners: the first Guide created sets it, and removing the opening Guide moves it to the next one (already the case). The Experience Card shows *Opens with* only with two or more Guides. See T-8. |
| D-11 | **No World-side badge, warning or indicator** because an object is linked to a Presentation. The relationship is managed from the Presentation. | The Stage, Plan and World object Card show nothing about links. Today they show nothing either (C: `plan-scene-footprint.ts`'s `presentationForEntity` is visual styling, not Experience), so this is a guard: a boundary test keeps Experience reads out of World chrome. A World removal's feedback is the ordinary *Pleyel piano removed.*; the unlink is a plan consequence shown only on the Experience side. |
| D-12 | **The last Stop has no outgoing transition.** Moved back into the middle, it gets a fresh Cut; hidden Travel settings are never resurrected. | `Stop.transition` is absent on the last Stop (`travel-after-last` refuses it in a file), and nothing remembers what it was, so a Stop moved back into the middle leaves by a Cut. Its Camera path stays (D-5), so choosing Travel again reuses its shape. Same as D-3 and T-2. |

### 2.2 Challenges and remaining tradeoffs

These are where the decisions meet the architecture, or where a simpler model was weighed. ★ is the recommendation.

- **T-1 · The Guide and the Presentation should follow the same rule.** D-3 puts a Guide edge on the Stop it *leaves*. A Presentation's step is stored on the View it *arrives at* (`ExperiencePresentationView.transition`, *the step into this View*). Dragging a Stop carries its outgoing chip, while dragging a View carries its incoming one: the same gesture, two behaviours, in two Cards. ★ Amend the Presentation inside format 4 so a View's `transition` is the step to the **next** View, and the last View has none. That gives one rule everywhere: *a Cut or Travel belongs to the item before it*. Cost: inside slice 2 (lowering's step loop, `writePresentationViews`, the View rail's chip placement, fixtures). *Alternative:* keep the Presentation as it is and document the asymmetry.
- **T-2 · Writing a Cut is lossy over a round trip.** Moving a Travel Stop to the end and back, or making two Stops share a View and then separating them, leaves a Cut where there was a Travel. That is the price of "no dormant transitions". The Camera path is kept, so choosing Travel again restores the same shape and time in one press, and the feedback line names every Cut that an edit wrote. ★ Accept. *Alternative:* keep the dormant Travel and show it greyed out, which the owner ruled out.
- **T-3 · D-4 needs the first registered Scene → Experience write.** Scene planners are documented and admitted as single-domain (`packages/project-model/src/scene-planning/planners.ts`: `compound`, `units` and `resources` false; *the landed registry refuses anything wider*). D-4's single undoable change therefore needs `delete-one`, the only Scene removal, admitted as `compound: true, writes: ['experience']`, the same mechanism that Experience → Camera uses. To keep the authorities separate, Scene never edits Experience data itself: it calls one pure Experience helper, `unlinkSceneSubject(experience, entityId, effectiveName)`, and the plan lists *1 Presentation keeps the name "Pleyel piano"* as a consequence. ★ Do this: it's the honest cost of "just works". *Fallback,* if a Scene compound is unwanted: Presentations store a name snapshot (`label` always a string, plus a "follows the object" flag), the Card treats a dangling subject as unlinked, and nothing writes at removal. That fallback shows the name from the last time the Presentation was written, which may predate a World rename, and it leaves a dangling reference in the file until the next edit. Not recommended.
- **T-4 · Program v4 keeps `stop` and `end` continuations.** Lowering will only ever emit `sequence-next`. The program's `stop` and `end` kinds, and the interpreter's handling of them, become unreachable from authoring but stay valid runtime. ★ Keep them this milestone: the interpreter isn't touched, and a compiled derivative isn't authoring surface. *Option:* prune them later, with the branching design, which will define its own shape anyway.
- **T-5 · One Stop, one Guide.** The linear model needs a Stop's outgoing transition to have one meaning (G27). ★ Add the invariant to validation: every Stop is listed by exactly one Guide, once. *Considered:* nesting Stops inside their Guide (`guide.stops[]`). That's a stronger shape, but it rewrites every Stop path, planner and fixture for the same guarantee. Not recommended now.
- **T-6 · Removing a Stop removes the Detours that use it.** This replaces an existing refusal with a cascade. ★ Do it, listed in the removal's consequences and undone together. *Alternative:* keep the refusal and add Detour authoring, which is branching UX the owner deferred.
- **T-8 · The Opening Guide: a field, or "the first Guide opens"?** D-1 says the first Stop starts. The same principle could say the first Guide in the Index opens, which would remove `entryGuideId` too, with the choice made by dragging a Guide to the top of the Index. That's one fewer field, but it hides a visitor-facing choice in list order, and the Index's Guide order means nothing else today. ★ Keep `entryGuideId`, maintained automatically (D-10), with *Opens with* shown only when there's a choice. *Alternative:* the first Guide opens, and the field is removed in slice 2.
- **T-7 · Projects saved on this branch stop opening.** Format 4 has never been on `main`, so there's no migration. Any format-4 project the owner saved while testing PR #271 carries `entryStopId` (and possibly `continuation`), and the strict reader will refuse it as an unknown key. ★ Accept, per D-6, and say so in the PR. Re-create test projects after slice 2.

## 3. Code boundary

**Project model** (`packages/project-model/src/units/`): the only place Travel validity is decided.

- `types.ts` (format 4 amendment, §5): `ExperienceGuide` loses `entryStopId`. `ExperienceStop` loses `continuation` and gains `transition?: ExperienceTransitionKind`, the step to the next Stop in its Guide (absent means Cut). `ExperiencePresentation.label` becomes `string | null`. With T-1, `ExperiencePresentationView.transition` becomes the step to the next View. `ExperienceContinuation` is deleted.
- `validate.ts`: the strict reader drops the removed keys, so a file that carries them is refused as an unknown key. New structural findings:
  - `stop-guide-membership`: a Stop is listed by zero Guides, or by two (T-5).
  - `travel-after-last`: a Travel on a Guide's last Stop, or, with T-1, on a Presentation's last View.
  - `travel-same-view`: a Travel whose two Stops enter the same View.
  - `label: null` is admitted only with a Scene-entity subject.

  `travel-gap` and `travel-ambiguous` stay. Adjacency is now simply each Guide's consecutive pairs.
- `experience-structure.ts`: three pure functions.
  - **New** `normalizeTransitions(experience) → { experience, cuts }`. It writes a Cut on every last Stop and every same-View pair, and returns them for the feedback line.
  - **New** `requiredTravelPairs(experience, connections) → ViewPair[]`. It returns every distinct unordered pair that a remaining Travel uses (Guide adjacencies and Presentation steps) and that no connection joins, in sorted order.
  - **New** `unlinkSceneSubject(experience, entityId, effectiveName)`, used by T-3.

  `planStopRemoval` drops `detour-uses-stop`, removes the Detours that use the Stop, and reports `{ kind: 'detour-removed' }`. Guide removal does the same for the Stops it removes. Removal plans return the straight connections they add (`camera` non-null), as `{ kind: 'connection-added', … }`.
- `planning.ts`: every planner that can change an endpoint builds its candidate, then calls `normalizeTransitions` and then `withRequiredTravelPaths(candidate, capturedIds('connection'))`. That covers guide-order, stop-create, guide-create, stop-update, presentation-update, stop-remove, guide-remove and presentation-view-remove. `withRequiredTravelPaths` generalises today's `withStraightConnections`. The planner refuses `travel-paths-incomplete` if the id pool runs short, so an accepted change can never create a gap. Admissions become `compound: true, writes: ['camera']` for guide-order, stop-create, guide-create, stop-remove and guide-remove. The guide-start planner and the stop-update `continuation` and `travelPath` payloads are deleted.
- **Captured ids:** the controller supplies a pool of `connection` ids sized to an upper bound (the number of Travel uses in the candidate, plus one). The planner consumes them in sorted-pair order and ignores the rest, so planners still never allocate.
- `experience/lowering.ts`: the order is `guide.stopIds`, and entry is `options.entryStopId ?? order[0]`, the editor's preview-from-here option and never authored. The adjacent transition reads `stop.transition`. The explicit-continuation block and its refusals go, every `ProgramStop.continuation` is `sequence-next` (T-4), and detour edges are unchanged. `presentationDisplayName(presentation, sceneEntities)` resolves `label ?? entity name` and is exported for the editor. `travel-same-view` and `travel-after-last` are refused. **The interpreter is not touched.**

**Scene planning** (`packages/project-model/src/scene-planning/planners.ts`): `delete-one` is admitted `compound: true, writes: ['experience']`. When a Presentation names the entity, it calls `unlinkSceneSubject` and lists the consequence. That is its only Experience write (T-3).

**Editor controller and commands** (`apps/editor/src/lib/authoring/experience/`):

- `experience-controller.svelte.ts`:
  - **Removed:** `setGuideStart`, `setContinuation`, `resolveContinuation` (replaced by `transitionOf(stopId)`), the S29 `travelEndpoints` effect, and the `guide` Card subject's writer.
  - **Changed:**
    - Every endpoint-changing command passes the `connections` id pool.
    - `setTransition` refuses Travel on a same-View pair or after the last Stop, and the Card never offers it.
    - `addStop`, `addToGuide` and `createGuide` take `entryViewId`.
    - With no Guide, `addStop` and `addToGuide` create the first Guide labelled *Tour* (D-9); `firstGuideLabel` and the naming prompt go. `createGuide` picks the next free *Tour n*.
  - **New:**
    - `setPresentationSubject(presentationId, entityId | null)`. Unlink writes the effective name as `label` in the same intent.
    - `followSubjectName(presentationId)`, which sets `label: null`.
    - `presentationLabel` returns the effective name.
  - **Typed feedback:** `feedback: { kind: 'success' | 'info' | 'refusal'; text } | null` replaces `message` and `messageRefused`. A plan's `cuts` and `connection-added` consequences are appended as one sentence (*Stop 2 → 3 is now a Cut: both show Front.*).
- `commands.ts`: the order, create, update, remove and presentation intents accept the connection id pool. `captureBindIntent` sends `label: null` when it binds a subject. `guideCreateIntent` drops `entryStopId`; `stopCreateIntent` drops `firstGuideLabel` and always sends the default label when it creates the first Guide.
- `experience-paths.ts`: no `'same-view'` state is needed; a same-View pair is a Cut.
- **New** `experience-problems.ts`, pure. It maps envelope diagnostics (code and path) to `{ sentence, subject, fix?, detail }`, using Stop numbers in the context Guide, the Guide's name, effective Presentation names and View labels. `travel-gap.ts` is folded into it. With revision 2, every finding it words comes from a file the editor didn't write.
- `focus.svelte.ts`, `experience-model.ts` and `experience-card-model.ts`: a new subject kind, `{ kind: 'experience' }`, is the Card when nothing is selected. Selecting a Guide sets the context Guide (its strip) and shows the Experience Card. `guideCardModel` is deleted.

**Components:**

- `ExperienceGuide.svelte` (§33 A):
  - re-skinned cards, with no start mark;
  - the gutter text `↗ 5 s`;
  - the separate `.scrub` bar removed;
  - one segmented track, with per-segment pointer mapping (extend `timeline-scrub.ts` from a fraction of the whole width to a segment plus a local fraction);
  - the pacing popover;
  - the header name renamed in place (<kbd>Enter</kbd>, <kbd>Esc</kbd>, blur) and a ⋯ menu with Rename and Remove Guide;
  - the **+** gap button removed.
- `ExperienceGuideWriter.svelte`: **deleted**.
- New `ExperienceExperienceWriter.svelte`: the name, the welcome, and *Opens with* only when there are two or more Guides (D-10).
- `ExperienceTransitionWriter.svelte`: *Next goes to* and End are removed; a same-View pair shows *✂ Cut · Both Stops show Front* with a link to the Stop, and no switch.
- `ExperienceViewRail.svelte`: ＋ Stop per row, guided or explore tags, and a light insertion line. With T-1, the step chip moves to below the View it leaves.
- `ExperiencePresentationWriter.svelte`: the *About* section (link, unlink, Show in World, pick, the Capture suggestion) and the name field's follow state. There is no removed state, and the first-Guide naming prompt is removed (D-9).
- World chrome (the Stage, Plan and the World object Card): **unchanged**, with no link indicator (D-11). `preview-surface-boundary`-style coverage extends to assert that World components don't read Experience subjects.
- The spatial route (`apps/editor/src/routes/project/[projectId]/spatial/+page.svelte`):
  - the problems chip from `experience-problems.ts`;
  - feedback styled by kind;
  - the Stage pick-to-link mode (one shot, <kbd>Esc</kbd>);
  - a View row dropped onto the strip;
  - the `guide` Card branch removed;
  - the context menu's *Start the tour here* removed;
  - the Index Guide row menu with Rename and Remove Guide.
- `VisitorPreviewSurface.svelte`: the segmented progress (§33 F).
  - Order comes from `guideRunFromProgram` (`visitor/guide-run-map.ts`).
  - The stay fill comes from the run state's `holdRemainingMs` and the Stop's `staySeconds`.
  - The Travel fill comes from a new `onTravelProgress(fraction)` callback on `VisitorCameraDirector.svelte`, which reports its existing `transitionProgress`. There is no new timer.
  - Segments mark *visited*, not *index below current*, so a Places jump doesn't fill skipped Stops.

**Not touched:**
- `packages/camera-core` (authority, evaluation, `guide-time-map.ts`)
- the interpreter
- program v4's shape (T-4)
- Layout evaluation and Scene evaluation
- resources

**Test families:**
- Admissions: `apps/editor/tests/lib/authoring/unit-acceptance-conformance.test.ts` and `stage-source-admission.test.ts`, including the new Scene compound.
- Project model: `apps/editor/tests/lib/project-model/units-conformance.test.ts`, `program-conformance.test.ts`, `units-canonical-form.test.ts`, `references-conformance.test.ts`.
- Experience: in `apps/editor/tests/lib/experience/`:
  - `experience-structure.test.ts`, `experience-controller.test.ts`, `experience-authoring.test.ts`, `first-guide.test.ts`
  - `camera-paths.test.ts`, `travel-gap.test.ts` (which becomes the problems test), `timeline-scrub.test.ts`, `playback.test.ts`
  - `experience-homes-components.test.ts`, `experience-card-model.test.ts`, `experience-model.test.ts`, `experience-marks.test.ts`, `experience-runtime.test.ts`
  - the shared fixtures `fixtures.ts` and `__fixtures__/x-fixtures.ts`
- Camera: `guide-time-map.test.ts`.
- Visitor: `apps/editor/tests/lib/visitor/visitor-runtime-state.test.ts`, `guide-run-parity.test.ts`, `preview-surface-boundary.test.ts`.

About 50 test and fixture files mention `entryStopId` or `continuation`. Most change mechanically in slice 2.

## 4. Implementation slices

Ordered by dependency. Complexity: **S** under half a day, **M** one to two days, **L** three or more.

| # | Slice | Contains | Entry | End | Size |
|---|---|---|---|---|---|
| 1 | **Typed feedback** | G8: the `feedback` shape, `run`/`say` typed, the route styling, tests updated from `messageRefused` | — | Manual ⇄ Automatic shows a green line; a refusal stays red; no string whitelist remains | S |
| 2 | **The linear Guide model** | D-1, D-7's rule, D-8, T-1 (if accepted), T-5, T-6. Format 4 amended: `entryStopId` and `continuation` out, `Stop.transition` in. `stop-guide-membership`, `travel-after-last` and `travel-same-view`. `normalizeTransitions`. Lowering simplified. Stop removal takes its Detours. Controller and Transition Card lose *Starts at*, *Next goes to* and End; the context-menu Start goes. Fixtures and tests rewritten. Closes G6, G7 (rule), G11, G14, G19, G26, G27. | 1 | R27–R31 pass. No product file mentions `entryStopId` (except lowering's preview option) or `ExperienceContinuation`. Journeys A–H still pass, minus *Starts at*. | M |
| 3 | **Travel reconciliation** | G1–G5, G7 (every edit), G10's notice: `normalizeTransitions` and `requiredTravelPairs` in every endpoint-changing planner, compound admissions, the id pool through every command, removal plans adding paths, the S29 notice deleted | 2 | R1–R12 pass; no ordinary edit produces `travel-gap`, `travel-same-view` or `travel-after-last`; Undo removes the edit, its Cuts and its paths together | L |
| 4 | **Problems** | G9: `experience-problems.ts`, the chip's sentences and *Show*, *Copy details* holding the codes | 3 | R13–R15; a duplicate imported path reads in plain language and *Show* opens its Transition Card | M |
| 5 | **Guide strip and one timeline** | G10's **+** button, G13, G15–G17, G21, G22: cards, gutter time, the segmented scrub, the pacing popover, rename in place and the ⋯ menu, the insertion line, chip selection | 1 | Journeys I and L; R32; the §28 keys pass on the new track; no gold remains on the strip or the rail | L |
| 6 | **Retire the Guide Card; the Experience Card** | D-2, D-10, G18, G20: `ExperienceGuideWriter.svelte` and `guideCardModel` deleted; the `experience` subject and Card with the welcome and, with two or more Guides, *Opens with*; the Index Guide row menu | 2, 5 | Journey Q; R20, R33, R36; the welcome is edited only in the Experience Card | M |
| 7 | **View → Stop, and the first Guide** | G23, D-9: `entryViewId` through the creation commands; ＋ Stop per row; a View dropped onto the strip; the first Stop creates *Tour* with no prompt | 3 | Journey J; R16, R35 | S |
| 8 | **Presentation follows its object** | G24, D-4: the `label: string \| null` amendment; `presentationDisplayName` in lowering and the controller; Present this and Capture bind with `label: null`; the *About* section; link, unlink and follow commands; the Stage picker; the Scene `delete-one` compound (T-3); the D-11 guard test | 3 | Journey M; R17–R19, R34, R37; the Index, strip, Cards, caption and Places all agree | L |
| 9 | **Visitor progress** | G12, G25: segments in the Guide's order; visited marking; stay and Travel fill; Manual outline; freeze; Back | 2 | Journey N; R21–R23 | M |
| 10 | **Acceptance** | Journeys A–H re-run, plus I–Q; `npm test`, `npm run test:arch`, `npm run check`, `npm run build`; AM-11 and the persistence reference amended | all | §9 | M |

Slice 1 goes first and is small. Slice 2 then fixes the model that everything else builds on, and slice 3 remains the critical path. Slices 4, 7 and 8 can run in parallel after slice 3; slice 5 can run alongside slices 2–3, because it touches only the strip's presentation.

Against revision 1: *Continuation pruning* (old slice 6) is absorbed into slice 2, which deletes rather than hides. The Guide Card slice becomes a removal. Slice 2 is new and moves reconciliation one step later, but makes it simpler, because there are no explicit continuations to join.

## 5. Schema implications

**Yes, format 4 changes, and it stays format 4** (D-6). Format 4 exists only on this PR's branch (`main` is at format 3), so it is amended in place. There's no bump, migration, compatibility reader or dual representation, and format 3 stays strictly refused. T-7 covers the cost to projects saved on this branch.

| Field | Before (format 4 on PR #271) | After (format 4, amended) |
|---|---|---|
| `ExperienceGuide.entryStopId` | Required Stop id | **Removed.** The first of `stopIds` starts. |
| `ExperienceStop.continuation` | Optional `sequence-next` / `stop` / `end`, with `transition` on the first two | **Removed.** |
| `ExperienceStop.transition` | — | **New**, optional `'cut' \| 'travel'` (absent means Cut): the step to the next Stop in its Guide. Never `'travel'` on a last Stop, nor between two Stops that enter the same View. |
| `ExperiencePresentation.label` | Required string | `string \| null`. `null` means the linked Scene entity's live name, and is admitted only with a Scene-entity subject. |
| `ExperiencePresentationView.transition` | The step **into** this View | With T-1, the step **to the next** View, never on the last. Without T-1, unchanged. |
| `Experience.detours` | Unchanged | Unchanged; a removal cascade keeps them valid. |
| Membership | Implicit | Every Stop is listed by exactly one Guide, once (`stop-guide-membership`). |

**Program v4:** unchanged in shape (T-4). `ProgramPresentation.label` is the resolved effective name, so visitor runtimes and published releases never resolve Scene names. `ProgramStop.continuation` is always `sequence-next`. `ExecutionProgram.entryStopId` is the first Stop, or the editor's preview start.

**Not a format change:** Travel reconciliation, typed feedback, the Experience Card, rename in place, View → Stop and the HUD are behaviour only. The `cuts`, `connection-added` and `detour-removed` consequences are planning types and are not persisted.

## 6. Regression matrix

| # | Case | Expected |
|---|---|---|
| R1 | Reorder: a Travel gets a new pair of different Views with no path | One straight path added; one Undo removes both |
| R2 | Reorder: the new pair already has a path (either direction) | Reused; nothing added |
| R3 | Reorder back | If the Travel survived, the original custom path is used again, geometry and time unchanged |
| R4 | Reorder never edits a connection's endpoints, anchors or timing | Camera unit diff is additions only |
| R5 | Insert after a Travel (D-3) | The earlier Stop's Travel now leads into the new Stop, with a path added (or a Cut if they share a View); the new Stop's own step is a Cut |
| R6 | Append after the last Stop | The new edge is a Cut, because the last Stop never holds a Travel |
| R7 | *Enter at* change on a Stop with a Travel in and out | Each pair joined, or written as a Cut if it now shares a View |
| R8 | Presentation View reorder that changes the Default | Steps and Guide pairs joined; Stops with their own entry unaffected |
| R9 | Remove a Stop between two Travel Stops | The removal plan lists *path added* and installs it, or a Cut for a same-View pair |
| R10 | Remove a View that is a Travel step's endpoint | The new neighbours' step joined; the removed View's unshared paths released (existing rule) |
| R11 | Same Presentation twice, same entry, adjacent | Always a Cut; the Transition Card offers no Travel |
| R12 | Same Presentation twice, different entries | A path between the two Views; shared ×2 with the Presentation step when they're adjacent |
| R13 | Imported file with two paths on one pair | `travel-ambiguous` worded with View labels; *Show*; nothing guessed |
| R14 | Imported file with a Travel gap | Plain sentence with Stop numbers; *Show*; ids only in *Copy details* |
| R15 | Travel → Cut → Travel | The path kept, then reused |
| R16 | View → Stop for View 3 of a Presentation; the Default moves later | The Stop keeps entering View 3 |
| R17 | Following Presentation; the World object is renamed | The Index, strip, Stop, Transition and Presentation Cards, caption and Places all change; no Experience write |
| R18 | Own name; then *Use the object's name*; then unlink | The own name stays put through renames; following resumes; unlinking stores the current name; one Undo each |
| R19 | Linked object removed in World | The Presentation is unlinked with its last effective name, its Views and Stops intact, in the same change as the removal; no warning |
| R20 | Manual ⇄ Automatic | Stays kept; the strip, Stop Card and visitor agree; green feedback |
| R21 | Visitor: Automatic stay, Travel, Pause, Explore, Back with under 2 s left | Fill frozen while paused and exploring; Back restores it with the lead-in; Travel fills its connector |
| R22 | Visitor: Manual | No stay fill; the current segment outlined; Next continues |
| R23 | Visitor: a second visit to one Presentation; a Places jump forward | The second visit is its own segment; skipped Stops are not marked visited |
| R24 | Strip: scrub across cards of different stay lengths | Each card maps its own stay; the tooltip names the time and the Stop |
| R25 | Strip keys | <kbd>←</kbd>/<kbd>→</kbd> 1 s, <kbd>Shift</kbd> 5 s, <kbd>PgUp</kbd>/<kbd>PgDn</kbd>, <kbd>Home</kbd>/<kbd>End</kbd>, <kbd>Space</kbd>; <kbd>Alt</kbd>+<kbd>←</kbd>/<kbd>→</kbd> reorders; the popover's arrows, <kbd>Esc</kbd> and focus return |
| R26 | Strip at 12 and 30 Stops; touch hold-to-drag | Scroll and paging keep working; the selected or playing Stop stays in view |
| R27 | A Stop with a Travel is moved to the end (D-3) | Its step becomes a Cut in the same change; the path stays; feedback names it; Undo restores the Travel |
| R28 | A reorder makes a Travel's two Stops share a View, then a second reorder separates them | The first writes a Cut; the second keeps the Cut; choosing Travel reuses any path the pair has |
| R29 | Remove a Stop that a Detour uses | The Detour goes in the same change, listed; Undo restores both; lowering and the interpreter still honour the remaining Detours |
| R30 | A file with `entryStopId`, `continuation`, a Travel on a last Stop, or a same-View Travel | Refused strictly, with a plain sentence; never repaired on read |
| R31 | A file that lists one Stop in two Guides, or a Stop in none | `stop-guide-membership` |
| R32 | Rename the Guide on the strip: <kbd>Enter</kbd>, <kbd>Esc</kbd>, blur, an empty name | Kept, cancelled, kept, refused; focus returns to the name |
| R33 | Nothing selected | The Card is the Experience Card; selecting a Guide in the Index shows its strip and keeps that Card |
| R34 | Linked object removed, then Undo | The object, the link and the following name all come back in one Undo |
| R35 | An Experience with no Guide: ＋ Stop on a View row; then a second Guide from the Index | One change creates *Tour* and its first Stop, with no prompt; the second is *Tour 2*; both rename in place |
| R36 | One Guide; then two; then remove the opening one | One: no *Opens with*, and it opens. Two: *Opens with* appears. After removal, the remaining Guide opens and the choice disappears again. |
| R37 | Linked object in World: select it, hover it, rename it, remove it | No badge, outline, warning or Card section about the link; removal feedback is the ordinary line |
| R38 | A Stop with a Travel is moved to the end, then back into the middle (D-12) | At the end it has no outgoing step; back in the middle it leaves by a fresh Cut; its path is unused and kept |

## 7. Browser acceptance journeys (in addition to A–H)

Journeys A–H are re-run without *Starts at*; any step that used it starts the Guide by dragging that Stop to the front.

- **I · Reorder a Travelling tour.** Make Stop 2 → 3 a Travel and shape it. Drag Stop 3 to the end. ▶ plays at once with no chip or warning. Drag it back: the shaped path returns. Drag Stop 2 to the end: the feedback says its Travel became a Cut. Drag it back into the middle: it leaves by a fresh Cut, and nothing of the old Travel returns until you choose Travel, which reuses the path. Undo four times.
- **J · Build from Views.** Start from an Experience with no Guide. In the Pleyel piano's Card, press ＋ Stop on *Keyboard*: a Guide called *Tour* appears with that Stop, with no prompt, and opens the Experience. Then press ＋ Stop on *From the window*. Both Stops enter where you chose. Make the connection between them a Travel, then reorder the Presentation's Views. Nothing breaks.
- **K · Change where a Stop enters.** On a Stop with a Travel in and out, change *Enter at*. Both Travels still play. Change it to the View the Stop before it shows: that step becomes a Cut, and its Transition Card offers no Travel.
- **L · Pacing from the strip.** Open the pill and choose Manual with the keyboard. Focus returns to the pill. The feedback is green. Play: it stops at each ⏸, and ▶ continues. Switch back: the stays are as they were.
- **M · The object's name.** Present a World object. Rename it in World, and check every place it shows. Type your own name, rename the object again (yours stays), then press *Use the object's name*. Unlink. Link with *Pick on the Stage*, then press <kbd>Esc</kbd> once mid-pick. Select the object in World: nothing there mentions the Presentation. Remove the object: the Presentation, its Views and Stops stay, it reads as unlinked with its last name, and nothing warns. Undo.
- **N · Visitor progress.** Preview an Automatic Guide that visits one Presentation twice. Watch a Travel fill. Pause, Explore, then Back with little time left. Jump forward with Places. Switch to Manual and preview again.
- **O · A file the editor didn't write.** Open a project file whose Stop carries `continuation`, or whose Guide carries `entryStopId`. It's refused with a plain sentence, and nothing is repaired on read.
- **P · Problems.** Make two Stops on the same View: the Transition Card shows a Cut and offers no Travel. Open an imported file with a duplicate path: the chip names the Stops and Views, *Show* opens the Card, and *Copy details* has the ids.
- **Q · No Guide Card.** With nothing selected, the Card is the Experience Card: change the welcome. With one Guide there is no *Opens with*. Add a second Guide from the Index (*Tour 2*): *Opens with* appears. Press the Guide's name on the strip, rename it, and press <kbd>Esc</kbd> on a second try. Remove a second Guide from the strip's ⋯, then Undo.

## 8. Out of scope and deferred

Not in this round, and not to be grown into by accident:

- Narration and audio; walking or free movement in Explore; published hosting and sharing; analytics.
- **Branching with consequences**, choice points, Detour authoring UI and mixed pacing (one wait in an Automatic Guide). Detours keep their data and runtime (D-8); nothing is added for them beyond the removal cascade.
- Pruning program v4's `stop` and `end` continuations (T-4).
- Visitor scrubbing; per-visit Travel time; automatic deletion of unused paths (D-5).
- Layout-element subjects for §27. Preview still does not resolve them (`unresolved-subject`); §33 links Scene entities only, and D-4's unlink applies to Scene removal only.
- Any Camera authority, evaluation or `guide-time-map.ts` change; any interpreter rewrite; any second timer.
- Multi-select of Stops, Guide duplication, and Stop copy and paste.
- The ratified-text Gates cleanup (`north-star.md`, `architecture.md`, the shell contract) remains the open owner item from PR #271's description.

## 9. Final gate

PR #271 can be accepted, and R217.S11 can begin, only when:

1. Slices 1–9 are merged on this branch, with every G-row in §1.1–§1.2 closed or explicitly waived by the owner.
2. R1–R38 pass as automated tests where they're testable, and in the browser otherwise.
3. Journeys A–H and I–Q pass in the owner's browser run.
4. No ordinary authoring path can produce `travel-gap`, `travel-same-view`, `travel-after-last` or `stop-guide-membership`. A property-style test runs random reorders, inserts, entry changes, View reorders and removals over a fixture with Travels, a repeated Presentation and a Detour, and lowering never refuses.
5. `npm test` and `npm run test:arch` show no failure beyond the base `parallel-track-gates` and `spatial-route-gesture` set PR #271 recorded. `npm run check` reports 0 errors and `npm run build` passes.
6. AM-11 in [composition-execution.md](../../../reference/composition-execution.md#am-11-guide-pacing-explore-and-return) and the persistence reference record the format 4 amendments (§5) and the reconciliation rule, and sheet §33 matches what shipped.
7. T-1 to T-8 are answered by the owner, and the answers are recorded here.
