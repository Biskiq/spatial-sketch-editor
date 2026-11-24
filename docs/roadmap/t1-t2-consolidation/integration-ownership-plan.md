# X9 Integration ownership recovery

**Status:** draft plan, the first commit of its own pull request. This is Tier 2: it replaces
guards (a check change) and restructures the shared shell. The owner decides before
implementation and again before merge. C4 and U7 are held until this pull request merges.

**Base:** `main` at `41814cd91`, after C3 #412 and U6 #411. Line references below are to
`apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` at that commit ("the route").

## Goal

Recover integration ownership of the spatial editor, so that a capability added to an existing
workspace lands in its own feature module and changes little or no shared composition. The
refactor preserves behavior. It changes no UX, no Camera evaluation, no F4 acceptance, no input
arbitration semantics, no rendering and no visitor/public surface.

X3 left the route at 1,507 lines. Ten days later it is 3,572 lines, despite the X1–X3 guards. This
plan fixes why the boundaries failed. It does not repeat the extraction.

## 1. Evidence

### 1.1 Route growth since X3 (#329, 2026-11-14)

| Measure | At X3 `843d62665` | Now `41814cd91` |
| --- | ---: | ---: |
| Lines (file / script) | 1,507 / 1,045 | 3,572 / 2,721 |
| Imports | 63 | 121 |
| `$state` / `$derived` / `$effect` | 6 / 62 / 7 | 14 / 95 / 33 |
| Top-level functions / `let` | 30 / 13 | 47 / 30 |
| Forward references (`let x!`) | — | 8 (`studio`, `experience`, `finishes`, `artworkInteraction`, `unfoldGestures`, `sliceDraw`, `stageInput`, `stageKeyboard`) |
| Repeated boot gates (`boot.status === 'ready' \|\| … 'empty'`) | — | 36 |
| Lens gates / Preview gates | — | 31 / 39 |
| `untrack(` / `document.querySelector` | — | 11 / 8 |

37 of the 136 commits since X3 touched the route. Blame attributes the growth to these families:

| Family | Approx. lines added |
| --- | ---: |
| Appearance (S8 U1–U6) | ~1,013 |
| Layout readings (Lift, Slice, near-wall cutaway, Unfold, Wall Face) | ~520 |
| Studio and Place copy | ~420 |
| Sky dial | 152 |
| Spot Look-through | 123 |

### 1.2 Growth of the integration hubs since X3

| Module | X3 | Now |
| --- | ---: | ---: |
| `stage/route/stage-shell-state.svelte.ts` (about 70 getters) | 744 | 901 |
| `stage/route/stage-shell-commands.ts` | 726 | 870 |
| `stage/route/stage-keyboard.ts` | 280 | 396 |
| `stage/route/stage-project-epoch.svelte.ts` | 336 | 385 |
| `stage/stage-adapter-host.ts` | 115 | 228 |
| `stage/shell/StageViewportRegion.svelte` | 709 | 1,020 |
| `stage/shell/StageCanvas.svelte` | 408 | 697 |
| `look/finish-authoring.svelte.ts` | — | 2,292 |
| `project-session/project-session.svelte.ts` | 986 | 1,112 |
| `stage/stage-facade.ts` (domain adapter seam) | 2,844 | 840 |

The facade shrank because the domain adapter seam gave every domain somewhere to go. The layout
adapter went from 7,571 to 638 lines in the same way. The host side had no equivalent seam.

### 1.3 What the route still owns

Every block of the route has a single owner in the target (§4.6). Its cross-feature integration is
hand-written:

- **Lifecycle chains.** Four functions encode cross-feature ordering by hand:
  - `resetViewContext` (2046)
  - `endMaterialOperations` (2073)
  - `interruptForReplacement` (2086)
  - `changeLens` (571)

  So do the epoch callback bag (296–336), the `onMount` start and teardown (2362–2410), the
  blur listener and the singleton-reset effects (1941, 1955, 1964).
- **Escape ladder.** `createStageKeyboard` (1333–1456) receives 61 inputs. About two dozen of
  them are feature callbacks (dismiss rungs and their guards) whose bodies are written in the
  route.
- **Presentation bags.**
  - `canvas` (2454–2530): 47 keys from seven owners.
  - `overlay` (2605): it concatenates core, Sky, Artwork and Slice lists.
  - Region props: EditorHead 36, StageViewportRegion 29, StagePanels 13 and StageToolbars 8.
- **Module singletons reset by the route:**
  - `experienceFocus`, `interiorLift`, `wallFace`, `wallUnfold`, `sliceReading` and
    `nearWallCutaway`
  - the `cutaway-resolved` and `slice-resolved` mirrors
- **Core-to-feature leaks.**
  - `StageAdapterServices.finishes` exposes the whole `FinishAuthoring` type to core. Its only
    reader is `look/FinishCardSection.svelte`.
  - `stage-shell-commands.ts` imports `look/light-tool` (`armedLightKind`) and
    `slice/slice-reading` (`sliceReading.level()`) at runtime.
  - The same file imports `studio/studio-model` (`isStudioWorldTool`) at runtime, and Experience
    types.

### 1.4 Guards

- **`spatial-route-boundary.test.ts`** (318 lines, 11 cases). Its `OWNERSHIP_SITES`,
  `X2_OWNERSHIP_SITES` and `X3_OWNERSHIP_SITES` are regex blacklists of historical names. Their
  negative controls only prove that an old name is still detected. A responsibility under a new
  name passes, which is what happened for Appearance, readings, Studio, Sky and Spot
  Look-through.
- **`authoring-controller-boundary.test.ts`** (363 lines, 7 cases). It approves controller imports
  per controller, which is sound. It does not cover the route's own content.
- **`stage-shell-composition.test.ts`** (793 lines, 22 cases, 19 reading the route). These are
  source-shape assertions that freeze strings in the route.
- **Prose rules.** `composition-execution.md` "Route as composition root" (584) already says a
  capability "adds a module and a wiring line, not route branches". No check enforced it.

### 1.5 Routing feasibility spike (bounded, deleted)

A throwaway `routes/dev/workspace-spike/[projectId]/(workspace)/{world,experience}` was run in dev
and in a production build. It had a `{#key projectId}` project layout, a persistent workspace
layout and two pages registering toolbar/panel snippets.

| Question | Observed |
| --- | --- |
| Does the workspace layout persist across a same-project `goto(…, { replaceState: true, noScroll: true, keepFocus: true })`? | Yes. Same host instance, host state kept, one host mount, `history.length` unchanged. |
| Does page-local state survive World → Experience → World? | No. The page is destroyed; its counter reset 1 → 0. |
| In what order do the two pages switch? | `beforeNavigate` → incoming page script → outgoing page cleanup → incoming page effect. The incoming workspace initialises before the outgoing one tears down. |
| Can a workspace refuse to be left? | Yes. `beforeNavigate` + `cancel()` holds `goto`, links and popstate; a refused popstate restores URL and history position. |
| Direct entry at `/experience`? | One host mount. The page effect runs before the host's `onMount`. |
| Project switch under `{#key}`? | The new host initialises before the old host is destroyed (overlapping lifetimes). |
| Chunking in a production build? | Each workspace page is its own route-node chunk (World 856 B, Experience 911 B); host-imported code stays in the layout chunk. |
| Registration from a page `$effect`? | It loops if the registry is read and written in tracked scope; it needs `untrack`. |

## 2. Root causes

1. **Blacklist guards cannot see new responsibilities.** They name what used to be in the route.
   Nothing positively states what a composition root may contain.
2. **There is no host-side contribution seam.** The domain adapter seam (`StageAdapter`,
   `StageAdapterServices`, posture layer) works. There is no equivalent for host features:
   - workspace regions
   - canvas and overlay presentation
   - Escape rungs
   - lifecycle steps

   The route was the only integration point, so every post-X3 capability landed there.
3. **X1–X3 split the route by technical layer, not by owner.** The layers were epoch, input and
   presenters. A capability's state, commands, presentation, interaction and lifecycle therefore
   span the route and four shared hubs. The hubs (§1.2) grew with the route.
4. **Module singletons with route-owned resets.** Each reading's lifetime is owned by whoever
   remembers to reset it. Today that is route effects and `resetViewContext`.
5. **Construction cycles.** Eight forward references and port bags (`finishes: () => finishes`)
   hide the dependency graph. Route ports leaked into `StageAdapterServices` as a result.
6. **Cross-feature lifecycle is hand-ordered code.** Replacement, lens leave, blur, Escape and
   teardown are written per call site, so every feature edits all of them.
7. **Policy is prose without enforcement or growth signals.** Nothing reports when a hub gains
   state, effects or dependencies.

## 3. Alternatives and decision

| Option | Gains | Costs in this repository |
| --- | --- | --- |
| **A. Nested routes** (`(workspace)/+layout.svelte` host; `world` and `experience` pages as workspaces) | URL-addressed workspaces; route-node code splitting; file-level separation | **Second lens authority.** The Stage session's `changeLens` (`stage-session.ts:534`) is the synchronous, refusal-capable writer with task parking. The router would be a second requester for the same fact. Programmatic entries (Experience homes, binding line 337) are synchronous today and would become `goto`-async, or the URL would be a cosmetic projection.<br>**Pages cannot own state.** State that must survive a round trip cannot live in a page (spike), so pages could only activate. Their contributions would also overlap during a switch.<br>**Behavior change.** Reload, Back and direct entry would change: today the lens is session-only and every load starts in World. That breaks the "behavior-preserving" scope.<br>**Rework.**<br>- `bindNavigation`'s unsaved-work guard needs a same-project exemption.<br>- Boot query parameters (`create`, `resume-save`, `studio`, `place-copy`) must be carried across workspace URLs.<br>- `studio-entry.ts`, `/`, `/projects` and `/editor` links must change.<br>- About 184 route-mount test cases need a layout-and-page harness.<br>**No splitting gain.** Code splitting buys nothing while Experience must load eagerly (#280, `needs-ux`). |
| **B. Component-level workspace decomposition** with a typed feature protocol | Fixes the actual root causes (seam, positive guards, lifecycle tables). One Stage, session, history and renderer by construction. Lens authority unchanged. Route tests keep mounting `+page.svelte` unchanged. | No URL addressing, and no splitting yet |
| **C. Extract more controllers from the route** (repeat X3) | Smallest diff | Repeats root causes 2, 3 and 6; the route would regrow |

**Decision: B, with the route-adapter seam kept open for A.**

The spike proves A is feasible, and it shows that A's real value is URL addressing and code
splitting. Neither is in scope:

- URL addressing changes product behavior.
- Code splitting is blocked on #280.

B removes the reasons the route grew. Under B the World/Experience split exists as two workspace
modules selected by the Stage session lens. A later route adapter only maps URL ↔ lens request,
with no feature changes:

- `(workspace)/+layout.svelte` hosts `WorkspaceHost`.
- Each page calls `host.requestWorkspace(id)` and contributes nothing else.

If the owner rules for A now (R1), §8 specifies the extra step.

## 4. Design

### 4.1 Layers and modules

All paths are under `apps/editor/src/lib/authoring/`. Existing files keep their paths, so unit
tests and the route tests' `vi.mock` targets stay valid. In particular, these modules do not move:

- `stage/shell/StageCanvas.svelte`
- `stage/shell/EditorHead.svelte`
- `stage/stage-facade`
- `stage/host-acceptance`
- `stage/boot-state`
- `adapters/catalog`
- `stage/shell/world-index-model`
- `scene/scene-pick-source`
- `experience/preview-entry`
- `experience/experience-homes`

```text
route  routes/project/[projectId]/spatial/+page.svelte   composition root (positive contract)
  └─ host  workspace/host/
       workspace-host.svelte.ts   createWorkspaceHost(): construction and wiring only
       WorkspaceHost.svelte       shared regions in today's DOM order
       └─ workspaces  workspace/world/WorldWorkspace.svelte, workspace/experience/ExperienceWorkspace.svelte
            └─ features  (public entry *-feature.svelte.ts + region components; members by manifest)
                 └─ stage core  stage/**, project-session/**, world-toolbar/**, region components
                      └─ domain  adapters/**, layout/**, look/** domain modules, packages/*, $lib/render, $lib/content
workspace/protocol.ts           FeatureId, WorkspaceId, lifecycle/rung/region types, late()
workspace/lifecycle-order.ts    LIFECYCLE_ORDER (data)
workspace/escape-rungs.ts       ESCAPE_RUNG_OWNER (data)
workspace/region-ownership.ts   REGION_KEY_OWNER (data) and typed contribution helpers
workspace/lifecycle-runner.ts   createFeatureLifecycle(steps): ordered fan-out per event
```

The guards place each file in a layer by the manifest (§5), not by directory. So
`stage/route/light-look-through.svelte.ts` can be a member of the `light-inspection` feature
without moving.

### 4.2 Features

| Feature | New public entry | Region components (new; markup moved from the route) | Absorbs from the route | Composes (existing) |
| --- | --- | --- | --- | --- |
| `light-inspection` | `look/light-inspection-feature.svelte.ts` | — | `lightInspection`, `lightInspectionPort` (287–295); cancel effects (563–568); `lightCoverage` (2660); its lifecycle steps | `stage/route/light-look-through.svelte.ts` |
| `layout-readings` | `stage/readings/layout-readings-feature.svelte.ts` | `LayoutReadingsOverlay.svelte` (Slice draft overlay) | `selectedCurvedWall` and the Unfold anchor effect (1457–1473); Lift (1486–1591); `resolvedSlice` and its effect; `slicePill`, `putBackSlice` (1592–1823); cutaway hosts, classification, mirrors and stub (1623–1734); plan-parameter effect (1735); Lift-space effect (1814); lens-leave and Slice-tool effects (1955, 1964) and its `leaveProject` steps (from the 1941 teardown); Wall Face camera port (2279); Unfold camera executor (2334); `sliceDraftWorld` and `sliceDraftOverlay` (2584–2604); construction of `sliceDraw` and `unfoldGestures` | `interior-lift-store`, `wall-face-store`, `wall-unfold-store`, `slice-reading`, `slice-draw`, `slice-resolved`, `near-wall-cutaway`, `cutaway-resolved`, `stage-unfold-gestures` |
| `sky` | `look/sky-feature.svelte.ts` | — | `skyRects`, `look` (904–915); `dialPlacement` and `dial` (2425–2453); Sky overlay parts | `look-authoring`, `sky-session`, `celestial-dial` |
| `artwork` | `artwork/artwork-feature.svelte.ts` | — | `artworkInteraction` construction; `canPlaceArtwork` (1937) and its cancel effect (1969); its `leaveProject` step; hanging guides (1977–1989) | `stage-artwork-interaction`, `artwork/*` |
| `library` | `library/library-feature.svelte.ts` | `library/LibraryWorldRegion.svelte` (the `{#key}` + `StageLibrary`) | `libraryEntries`, `libraryTileSource`, `libraryObjects`, `LIBRARY_INVOKERS`, `returnLibraryFocus`, `closeLibrary` (670–871) | `StageLibrary` |
| `appearance` | `look/appearance-feature.svelte.ts` | `look/AppearanceWorldRegions.svelte` (Import sheet, Align, the two `LibraryMaterialEditor` modes, Paint tray); `look/AppearanceSharedRegions.svelte` (Repair drawer) | Finish Card selection effect (582); Paint tray and `paintLine` (635–665); `finishShelf` and `libraryTarget`; `materialImport` and its reference builders through `libraryDraftStatus` (683–832); library-draft effects and `endLibraryDraft` (1230–1250); repair drawer state; `endMaterialOperations`; Align region and framing (2254–2278); `alignProject`, `alignInspectedNow`, ownership and reframe effects (2531–2583); `alignCutaway` | `finish-authoring`, `finish-card`, `paint-tray-state`, `material-import`, `align-chart`, `colour-coat-port`, `paint-pick`, `finish-tiles-provider`, `MaterialImportSheet`, `LibraryMaterialEditor` |
| `studio` | `studio/studio-feature.svelte.ts` | `studio/StudioWorldRegions.svelte` (Transfer strip, Scope strip, Root panel) | `objectStudioPort`, `studioRevision`, `studioArmPending` (275–286); `studioFind` (618); the `createStudioController` bag; `runStudioEntry`; the retry-frame, entry, Place-copy and arm effects (1846–1934) | `studio-controller`, `studio-model`, `place-copy-journey`, `platform/studio-entry`, `Studio*.svelte` |
| `experience` | `experience/experience-feature.svelte.ts` | — (its region keys feed shared regions) | `experience` binding; `previewController` and its `prepareArtwork` (438–492); `experienceFloorDatum`; `experienceShownCard`; the Experience parts of `stageCursor` and look-through as ports; `resetFocus` | `stage-experience-binding`, `experience-controller`, `experience-preview` |

**Core keeps** everything that is arbitration or shared infrastructure:

- boot and the project session
- the Stage session, epoch, asset leases and viewport
- the selection and its views
- shell state and commands
- input arbiter and keyboard
- dock, find, index, Card and task presentation
- Head, notices and panels
- history and source download

New core modules gather what the route held:

| New core module | What it takes over |
| --- | --- |
| `stage/route/project-ready-port.svelte.ts` | The 36 boot gates. It exposes `snapshot()`, `envelope()` and `datumMeters()`, each `null`/neutral while not ready. |
| `stage/route/stage-viewing.ts` | `submit`, `setReading`, `fit`, `zoom`, `pan`, `orbit`, `bringIntoView`, `requestScaleDetent`, `patchDrafting` (2177–2253) |
| `stage/route/stage-content-bounds.ts` | 1824, 1924–1936 |
| `stage/route/look-through-frame.svelte.ts` | The frame effect (556). It composes the Experience view session port and the light-inspection session port. |
| `stage/route/stage-cursor.ts` | The `stageCursor` precedence (2620), unchanged. It reads an Experience port `{ viewEditKind(), placingView() }`. |
| `stage/route/boot-repair.svelte.ts` and `stage/shell/StageBootPanels.svelte` | 1196–1229 and the boot markup (3344–3426) |
| `stage/shell/StageReplaceDialog.svelte` | 3428–3435 |

`stage-shell-state.svelte.ts` is not split. A getter moves out only if every one of its readers
and writers belongs to one feature; the implementer checks each getter by search and lists any
moves in the pull request. The hotspot ratchet (§5.5) records it so it cannot grow.

### 4.3 Typed ports, and no mutable context

- Each feature factory takes `deps: Pick<StageCorePorts, …>` plus its declared cross-feature
  ports, and returns a frozen object of getters and methods.
- `StageCorePorts` is a type, not a runtime object passed around. The host builds each feature's
  argument as an object literal of thunks.
- There is no context lookup, global registry or service locator.
- Svelte `setContext` remains only where it already exists (finish tiles).

Cross-feature data flows only through host-wired thunks. Each edge is listed in
`CROSS_FEATURE_PORTS` in the manifest (§5.1):

| From → To | Port |
| --- | --- |
| `appearance` → `layout-readings` | `alignCutaway(): AlignCutawayRequest \| null`. Align hides Walls through the cutaway mask. |
| `layout-readings` → `appearance` | `wallFace` camera port reads. `finish-align` already consumes `wallFace`. |
| `studio` → core canvas `plan` | `suppressesPlan(): boolean` (`studio.active && context === 'mat'`) |
| `library` → `appearance` and `scene` placement | `open()`, `invocation()`, `close(returnFocus)` |
| `experience` → core cursor and look-through frame | `viewEditKind()`, `placingView()`, `lookThroughSession()` |
| `light-inspection` → core look-through frame | `session()` |

Core never imports a feature at runtime. These leaks are removed:

| Leak | Fix |
| --- | --- |
| `StageAdapterServices.finishes: { current: FinishAuthoring \| null }` | `finishCard?: StageFinishCardPort`. The port is declared structurally in `stage-adapter-host.ts`, with exactly the members `FinishCardSection.svelte` uses; the type checker settles the set. `stage-adapter-host.ts` then imports nothing from `look/finish-authoring*`. `lightInspection` and `objectStudio` are already narrow core-declared ports and stay. |
| `stage-shell-commands.ts` runtime imports: `armedLightKind`, `sliceReading.level()`, `isStudioWorldTool` | Command input ports: `lightArmed(projectId)`, `levelSlice()`, `isStudioTool(id)`. The `light-inspection`/`sky`, `layout-readings` and `studio` features wire them. |
| Type-only Experience imports in `stage-shell-commands.ts` | These, and every other existing type-only core → feature import, go into a shrink-only allowlist (§5.2). Any new one fails. |

### 4.4 Lifecycle contract

Every cross-feature event is a named step table in `workspace/lifecycle-order.ts`. A step is
`'<owner>:<step>'`, where the owner is a `FeatureId` or `core`. The tables encode today's exact
order, taken from the route at the base commit. The lifecycle runner calls steps in order:

- A refusal-capable event stops at the first step that returns `false`.
- Steps that already ran are not rolled back. This matches today: `endMaterialOperations` cancels
  the Card before Align may refuse.

| Event (today's source) | Ordered steps |
| --- | --- |
| `interruptForReplacement` (epoch `interruptInput`, 2086) | `light-inspection:cancel` → `core:clear-hover` → `core:interrupt-press` → `appearance:end-operations-no-camera` → `appearance:reset-issues` |
| `resetFocus` (epoch) | `experience:reset-focus` |
| `resetPresentationBeforeSwap` (2097) | `core:collapse-expanded-presentation` |
| `resetPresentation` (`resetViewContext`, 2046) | `light-inspection:cancel` → `studio:end` → `layout-readings:reset` (`wallFace.clear`, `interiorLift.clear`, `sliceDraw.disarm`, `sliceReading.clear`, `setResolvedSlice(null)`, `nearWallCutaway.reset`, `setResolvedCutaway(null)`, failed ids cleared; in that order) → `core:reset-selection-and-shell` (selection, task, revealed, notice, pending delete, armed tool, Card open; in that order) → `artwork:cancel` (cancel, then cancelResize) → `core:reset-input` → `core:reset-viewport` |
| `facadeMounted` (2101) | `core:bind-facade` |
| `adaptersChanged` (2105) | `core:refresh-adapter-presentation` |
| `accepted` (2112) | `light-inspection:reconcile` → `core:sync-task-and-selection` → `core:invalidate-plan` → `studio:reconcile` → `studio:settle-transfer` → `core:refresh` |
| `historyInstalled` (2125) | `core:install-selection` (with its notice) → `light-inspection:reconcile` → `core:invalidate-plan` → `studio:reconcile` |
| `leaveLens(next)` (`changeLens`, 571; refusal-capable) | `studio:leave-for-lens` (when `next !== 'world'`) → `appearance:end-operations-restore-camera` (when `next !== 'world'` and the lens is World) → `light-inspection:cancel` → `experience:change-lens` |
| `windowBlur` (2377) | `core:release-snap` → `layout-readings:release-hold` → `appearance:cancel-card-gesture` |
| `leaveProject` (teardown of the 1941 effect) | `layout-readings:clear-readings` (`interiorLift.clear`, `sliceDraw.disarm`, `sliceReading.clear`, `setResolvedSlice(null)`, `nearWallCutaway.reset`, `setResolvedCutaway(null)`; in that order) → `appearance:cancel-image` → `artwork:dispose` → `core:dispose-artwork-assets` |
| `start` (`onMount`, 2362) | `core:perf-mark` → `experience:start` → `core:start-shell` → `core:start-viewport` → `core:install-listeners` → `core:install-interruptions` → `core:load-project` |
| `dispose` (`onMount` cleanup) | `appearance:end-operations-no-camera` → `appearance:reset-issues` → `layout-readings:dispose-unfold` → `light-inspection:dispose` → `experience:dispose` → `core:mark-torn-down` → `core:dispose-viewport` → `core:dispose-shell` → `core:clear-hover` → `core:remove-listeners` → `layout-readings:release-hold` → `layout-readings:clear-cutaway-mirror` → `core:remove-interruptions` → `core:dispose-epoch` |

`createStageProjectEpoch`'s callback bag is replaced by `lifecycle: () => FeatureLifecycle`. Its
internal call order is unchanged. This is the host's single `late()` cell (§4.7). Steps are
synchronous, as today. The Card-rename effect (934), the selection-change effect (582) and the
other reactive reconciliations stay as `$effect`s inside their owning modules. They are created in
the same relative order as today (§6 rule 3).

**Module singletons.** Each singleton has exactly one lifecycle owner in the manifest:

- `experienceFocus` → `experience`
- `interiorLift`, `wallFace`, `wallUnfold`, `sliceReading`, `nearWallCutaway` and both resolved
  mirrors → `layout-readings`
- `worldIndexModel` → core

Only the owner may call a singleton's lifecycle members:

- `clear`, `reset` and `putBack` when used as a reset
- `set*Port` and `set*Executor`
- `setResolved*`
- `setSelectionHosts` and `setHeld`

Other modules may read a singleton and call its non-lifecycle members, as today. The adapters'
reads in `layout-contributions.ts` and `curve-gesture-session.ts` stay. Converting singletons to
project-scoped instances is deliberately excluded (§7). The spike showed that the next host
initialises before the previous one is destroyed, so owners keep today's reset timing. A
characterization test pins it (§6 step 1).

### 4.5 Escape ladder and regions

**Escape.** `stage-keyboard.ts` keeps its decision logic and precedence comments unchanged. Its
input loses the per-feature dismiss callbacks and gains `rungs: EscapeRungs`. That is a record with
one handler per rung id. `ESCAPE_RUNG_OWNER` assigns each rung to exactly one owner:

| Owner | Rungs |
| --- | --- |
| `artwork` | `artwork` |
| `experience` | `preview` |
| `appearance` | `align`, `material-editor`, `material-import`, `repair-drawer`, `paint`, `paint-key` |
| `sky` | `sky` |
| `studio` | `studio` |
| `layout-readings` | `lift`, `slice-draft`, `slice`, `cutaway-hold` |
| `library` | `library` |

Core inputs stay as they are: palette, world tool, plates, pending delete, task, selection, focus.

**Regions.** `REGION_KEY_OWNER` records the single owner of every prop key of the shared regions:

- `StageCanvas` (the `canvas` object)
- the `overlay` object
- `StageViewportRegion`
- `EditorHead`
- `StageToolbars`
- `StagePanels`

Each feature exposes `regions.<region>` as a getter object. Its type comes from
`contribution<Owner, Region>()`, which is `Pick<Props, OwnedKeys>` with excess-property checks.
`WorkspaceHost.svelte` spreads core first, then features in manifest order:
`<StageViewportRegion {...core.viewport} {...readings.viewport} …/>`. Svelte 5's `spread_props`
reads getters lazily, so per-key tracking is as fine-grained as today. Region components' props and
internals are unchanged.

Ownership that is not obvious from the getters:

| Key | Owner |
| --- | --- |
| `canvas.scene` | `appearance` (Finish preview over the accepted Scene) |
| `canvas.plan` | core, with the Studio `suppressesPlan` port |
| `canvas.framedViewport`, `canvas.hover`, `canvas.hoverTone` | core |
| `canvas.dial`, `canvas.sky` | `sky` |
| `canvas.alignHiddenWallIds`, `proposals`, `onFinishOutcome`, `repairAffectedTargets` | `appearance` |
| Lift, cutaway, Slice and Unfold keys | `layout-readings` |
| `artworkGhost`, `onArtworkError` | `artwork` |
| `canvas.studio` | `studio` |
| `viewport.lift`, `viewport.slice` | `layout-readings` |
| `viewport.hanging`, `viewport.artwork` | `artwork` |
| `viewport.lightCoverage` | `light-inspection` |
| `experienceMarks`, `viewEditTurn`, `pendingViewWrite` (and its two callbacks), `preview`, `previewLoading`, `homes`, `onExperienceController` | `experience` |
| `head.lens`, `onLens`, `canPreview`, `onPreview`, `previewUnavailableReason` | `experience` |
| `head.repairIssueCount`, `repairOpen`, `onToggleRepair` | `appearance` |
| `toolbars.paintLine` | `appearance` |
| `toolbars.experience`, `viewLine` | `experience` |
| `panels.environment` | `sky` |

The implementer assigns the remaining keys by what each current expression reads, and the type
check proves the table is exhaustive.

List-valued overlay keys keep today's concatenation order through `REGION_LIST_KEYS`:

- `marks`: `['core', 'sky']`
- `candidates`: `['core', 'artwork']`
- `celestial`: owned by `sky`
- `sliceDraft`: owned by `layout-readings`

### 4.6 Workspaces and the host

**Rule:** a surface moves into a workspace component exactly when today's mount condition
includes the lens. Then mount and unmount behavior is unchanged: it was already remounted on a lens
switch. All other surfaces stay in `WorkspaceHost.svelte`, so their component instances survive
lens switches as today. Workspace components hold no state (§5.3). All feature state lives in
feature objects that the host creates once.

`WorkspaceHost.svelte` renders today's DOM order exactly:

1. `EditorHead` (Preview-gated)
2. `StageProjectNotices`
3. the stage container, containing:
   1. workspace placement `leading`
   2. `StageViewportRegion`, with the `toolbars` snippet and a workspace overlay placement
   3. `StagePanels`
   4. workspace placement `trailing`
   5. shared feature regions (`AppearanceSharedRegions`)
4. `StageBootPanels`
5. `StageReplaceDialog`

Each workspace module exports `{ id, leading?, trailing?, overlay? }` components:

| Workspace | `leading` | `trailing` | `overlay` |
| --- | --- | --- | --- |
| World | `StudioWorldRegions` | `LibraryWorldRegion`, then `AppearanceWorldRegions` (today's order: Library, Import, Align, library-draft editor, Material Editor, Paint tray) | `LayoutReadingsOverlay` |
| Experience | none | none | none (its contributions are region keys) |

The host selects the workspace from `experience.lensState`. Each moved block keeps its other
conditions verbatim: `preview === null`, `adapterServices !== null`, `!shell.libraryOpen`, and so
on. The route `<style>` (3438–3572) moves with the markup it styles: scoped rules move to the
component that now holds the element, and existing `:global` rules stay global.

**Studio** is a feature, not part of World:

- Its regions mount from the World workspace's `leading` placement.
- Its contextual entries are unchanged: the Card via `objectStudio`, the `?studio` URL via
  `studio-entry`, and Place copy.
- The Studio feature imports nothing from `workspace/world/**`.
- World imports only Studio's public entry and region component.

Promoting Studio to a third workspace later means adding `'studio'` to `WorkspaceId` and moving one
placement. No feature internals change.

### 4.7 Composition roots

`+page.svelte` becomes roughly:

```svelte
<script lang="ts">
	import { page } from '$app/state';
	import { createWorkspaceHost } from '$lib/authoring/workspace/host/workspace-host.svelte';
	import WorkspaceHost from '$lib/authoring/workspace/host/WorkspaceHost.svelte';
	const host = createWorkspaceHost({ projectId: page.params.projectId ?? '', url: page.url, page: () => page });
</script>

<WorkspaceHost {host} />
```

`createWorkspaceHost` runs synchronously during the route's initialisation, so every `$effect`
and `onMount` created by feature and core factories belongs to the route component, as today.
Its body makes the creation calls of Appendix A in that sequence:

- core factories
- feature factories and their `attach…` phases
- `installStageMount(lifecycle)`, which registers today's `onMount` at its current position
- the lifecycle runner, after which the one `late()` cell is set

It then returns the host view. Forward references become construction order. `late<T>()` is an
assign-once cell that throws if read before it is set. The lifecycle runner is the only one.

## 5. Hardening and enforcement

All guards run in the `test:arch` lane. They reuse `tests/helpers/import-closure.ts`, plus the
`svelte/compiler` `parse` and `typescript` already used by existing boundary tests, so there are no
new dependencies. Each guard is a pure function `check…(sources, manifest) → Violation[]`. Its
test asserts `[]` for the real tree and runs the negative controls (§5.6) through the same
function.

### 5.1 One manifest

`apps/editor/tests/lib/authoring/integration-ownership.manifest.ts` is the single policy table. It
declares:

- the layer of every composition root, host, workspace and core integration module
- each feature's `id`, `entry`, `members` (globs over existing files), `publicExports` and
  `regionComponents`
- `CROSS_FEATURE_PORTS`
- `SINGLETON_OWNERS`
- the shrink-only `TYPE_ONLY_CORE_TO_FEATURE` allowlist
- per root, the import allowlist (`ROOT_IMPORTS`)

It does not state lifecycle or rung order; those are the source tables (§4.4, §4.5).

`authoring-controller-boundary.test.ts`'s `APPROVED_BOUNDARIES` folds into this manifest, so there
is one dependency policy. Before deletion, every negative control of the old suite is replayed
against the new guard and must still fail (§6 step 12).

### 5.2 Dependency direction

| Rule | Statement |
| --- | --- |
| D1 | Core and domain never import a feature, workspace, host or route module at runtime. Type-only imports are limited to the shrink-only allowlist. |
| D2 | A feature imports core, domain and its own members. It may import another feature only through that feature's `entry`, type-only. |
| D3 | A workspace imports only feature entries, declared region components and core region components. It never imports the other workspace. |
| D4 | Only the route imports the host. The host imports core, workspaces and feature entries. |
| D5 | The route imports only `ROOT_IMPORTS.route`. |
| D6 | Studio members import nothing from `workspace/world/**`. |
| D7 | Every authoring module reachable from the host is a member of exactly one feature, or declared core or domain, so there are no unowned modules. |

The existing visitor/public guards are unchanged.

### 5.3 Positive contracts for composition roots

These rules apply to `+page.svelte`, `WorkspaceHost.svelte`, `workspace-host.svelte.ts`,
`WorldWorkspace.svelte` and `ExperienceWorkspace.svelte`, and are checked on the AST:

| Rule | Statement |
| --- | --- |
| CR1 | No `$state`, `$state.raw`, `$derived`, `$derived.by`, `$effect` or `$effect.pre`. Only `$props()`. |
| CR2 | No `function` declarations, no `let`, no statement-bodied arrows, no `untrack`, no `window`/`document`/`setTimeout`/`queueMicrotask`. |
| CR3 | Imports only from that root's `ROOT_IMPORTS`. |
| CR4 | The body of `createWorkspaceHost` contains only `const x = <allowlisted factory>(<literal>)`, one `late()`, one `.set(...)` and the `return`. Literal values are identifiers, member expressions, nested literals or expression-bodied arrows whose body is a call, member, conditional or logical expression without assignment. |
| CR5 | Markup contains only components, `{#if}`/`{:else}` on host getters, `{#key}` moved verbatim, `{@render}`, snippets and spreads. Inline handlers are expression-bodied. |

Logic that does not fit belongs to its owning module. That is the point of the contract: a new
responsibility under any name fails CR1, CR2 or CR4.

### 5.4 Feature admission

A capability is admitted when it has all of the following, and the admission guard checks them:

- an owning feature (existing or new) with an entry and members
- its canonical writers declared in the entry's doc comment: which authority it writes through
  (F4 planners via adapters, the Stage session, the project session, or its own session state)
- its lifecycle steps listed in `LIFECYCLE_ORDER`
- its rungs in `ESCAPE_RUNG_OWNER`
- its region keys in `REGION_KEY_OWNER`
- its singletons in `SINGLETON_OWNERS`
- its cross-feature edges in `CROSS_FEATURE_PORTS`

The admission guard enforces consistency:

- Each implemented step resolves to exactly one table entry, and each table entry to exactly one
  implementation.
- Each rung has a handler from its owner.
- Region key ownership and exhaustiveness are type checks run by `svelte-check`.
- Singleton lifecycle calls come only from their owner.

### 5.5 Growth monitoring

`apps/editor/tests/lib/authoring/integration-hotspots.json` records, for each integration hub:

- LOC
- imports
- `$state`, `$derived` and `$effect` counts
- top-level functions
- exported members (getters, for `stage-shell-state`)
- `StageAdapterServices` members (for `stage-adapter-host.ts`)

The hubs are:

- `stage-shell-state`, `stage-shell-commands`, `stage-keyboard`, `stage-project-epoch`,
  `stage-adapter-host`
- `StageViewportRegion`, `StageCanvas`, `EditorHead`, `StageToolbars`, `StagePanels`
- `project-session`, `finish-authoring`
- each feature entry

The guard fails when a measure changes in either direction:

- **Growth.** The failure names the metric and says to move the responsibility to its owner, or to
  raise the recorded value in the same change. A raise is allowed, and visible in review.
- **Shrinkage.** The failure says to lower the record. This is the existing shrink-only pattern of
  `renderer-portability-boundary`.

This is not a size limit. Composition roots get absolute contracts (§5.3) instead of ratchets.

### 5.6 Negative controls

Every guard has controls built by mutating copies of the real files. Each mutation must yield
exactly the expected violation. To prove the guard catches responsibilities it has never seen,
every control uses fresh identifiers, not historical names:

| Guard | Mutation |
| --- | --- |
| CR | Insert `let quuxPanel = $state(false)` into the route; add a `$effect` to the host; add a statement-bodied arrow to a host literal; import an unlisted `$lib` module into `WorkspaceHost.svelte` |
| D1–D7 | Add a runtime import of a feature member to `stage-shell-commands.ts`; add a feature importing another feature's non-entry member; add a new type-only core → feature import; add an orphan module imported by a feature but listed nowhere |
| Lifecycle | Implement `quux:reset` without a table entry; add a table entry without an implementation; list one step twice |
| Escape | Add a rung handler from a non-owner |
| Regions | A `@ts-expect-error` type fixture in which a feature contributes another owner's key, or a key not in the table |
| Singletons | Call `nearWallCutaway.reset()` from a non-owner |
| Hotspots | Add one getter to `stage-shell-state`; remove one import from `stage-keyboard` (stale record) |

### 5.7 Where each rule lives

| Rule | Home |
| --- | --- |
| Dependency direction, composition-root contracts, admission consistency, singleton owners, hotspot ratchet | Executable guards (§5.1–§5.6). Failure messages link to the reference section below. |
| Workspace host, feature protocol, lifecycle and Escape ownership, how to add a capability (enduring) | `docs/reference/composition-execution.md`: replace "Route as composition root" (584) with "Workspace host and feature modules". Update the Interaction coordination paragraph of `docs/reference/architecture.md` (about 405–415) to name the rung table. |
| Agent entry point | `apps/editor/AGENTS.md`: five lines saying where a capability goes, which tables it extends and which test proves admission, with a link to the reference. No policy is duplicated. |
| Studio rules | `apps/editor/src/lib/authoring/README.md` (Studio section): the Studio-is-a-feature sentence |
| Workflow | No change. There is no new process, label or gate. |

Retired after replacement: the blacklist sections of `spatial-route-boundary.test.ts`, and
`authoring-controller-boundary.test.ts` (folded in). The 19 route-source assertions in
`stage-shell-composition.test.ts` are retargeted to the module that now owns each responsibility,
or replaced by a behavior assertion. None is dropped without a replacement, and the pull request
lists the old → new mapping.

## 6. Migration sequence (this pull request)

Rules for every step:

1. **Tests.**
   - Run the five route-mount suites unchanged: `spatial-route-gesture` (98 cases),
     `-experience-homes` (54), `-source-replacement` (20), `-resume-save` (8) and `-viewport`
     (4). Run them with `test:fast` and `test:arch`, sequentially.
   - No assertion in the route-mount suites changes.
   - Only the step's own test moves are allowed, and they must map one-to-one.
2. **One owner per step.** Each step moves one owner's code, together with its effects, lifecycle
   steps, rungs and region keys.
3. **Creation sequence.** Svelte runs the effects dirty in one flush in creation order, so the
   host preserves the base route's creation sequence (Appendix A) exactly.

   Today a feature's creation points are not contiguous: Appearance has points at 582–683,
   1147–1233 and 2556–2565. So a feature exposes later groups as named construction phases
   (`x.attachAuthoring()`, …). The host calls each phase at its position in the sequence. A phase
   is a factory call (CR4), returns nothing and may run once.

   A base effect whose body spans owners is handled in one of two ways:

   - An ordinary effect is split into adjacent per-owner effects, in body order, at the same
     position. Example: 1201 becomes the Appearance issue/drawer reset, then the core boot-repair
     reset.
   - A teardown becomes a lifecycle event: 1941 becomes `leaveProject`.

   A feature that only sets a notice or calls a core command through a port is not mixed. An
   example is the Lift-space effect at 1814.

   Collapsing phases after proving independence is a follow-up, not part of this pull request.
4. **Rollback.** Implementation commits revert as a unit.

| Step | Content |
| --- | --- |
| 1 | **Characterization**, green on the unmodified route. Add `spatial-route-lifecycle-order.test.ts`. It spies on the existing modules and pins:<br>- each §4.4 event's call order<br>- the complete Escape ladder order with every rung active<br>- session continuity across 5 lens round trips: StageCanvas mock mounted once, the same facade and history instance, `projectSession.load` called once, epoch `activate` unchanged<br>- Undo/Redo after a lens round trip<br>- project switch under `{#key}` (singletons reset, nothing leaks into the next project)<br>Also record `integration-hotspots.json` at the base (report-only). |
| 2 | **Protocol.** `workspace/protocol.ts`, `lifecycle-order.ts`, `escape-rungs.ts`, `region-ownership.ts`, `lifecycle-runner.ts`. The route builds its existing chains through the runner, with inline step closures, so the step 1 tests prove table order equals today's order. |
| 3 | **Core ports.** `project-ready-port` (removes the 36 gates), `stage-viewing`, `stage-content-bounds`, `look-through-frame`, `stage-cursor`, boot repair and boot panels, the replace dialog. Narrow `StageAdapterServices.finishCard`. Replace the shell-command runtime imports with ports. |
| 4 | `light-inspection` feature |
| 5 | `layout-readings` feature, with singleton owners |
| 6 | `sky` feature |
| 7 | `artwork` feature |
| 8 | `library` feature |
| 9 | `appearance` feature. It includes the region components and absorbs the Escape bodies. It is the largest step and may be split into Card/Paint, Import/Library draft and Align/Repair commits. |
| 10 | `studio` feature |
| 11 | `experience` feature. After it, the route keeps no feature logic. |
| 12 | **Workspaces and host.** `WorldWorkspace`, `ExperienceWorkspace`, `WorkspaceHost.svelte`, `createWorkspaceHost`; the route becomes §4.7; styles move. |
| 13 | **Guards.**<br>- Add manifest, D1–D7, CR1–CR5, admission, singleton owners, hotspot ratchet (now enforcing) and negative controls.<br>- Replay the old controller-boundary controls, then delete the blacklist sections and `authoring-controller-boundary.test.ts`.<br>- Retarget the `stage-shell-composition` assertions.<br>- Update `test-lanes.ts`. |
| 14 | **Promotion.** The reference and `AGENTS.md` edits of §5.7. Delete this plan. |

## 7. Scope

**In scope:**

- route, host, workspace and feature extraction
- the core ports listed above
- narrowing `StageAdapterServices.finishes`
- `stage-keyboard` input shape
- `stage-project-epoch` callbacks → lifecycle
- guards, the lane manifest, and the reference/`AGENTS.md` promotion

**Out of scope:**

- C4, U7 and any new capability
- UX changes and Studio promotion
- URL-addressed workspaces (unless R1)
- lazy Experience (#280)
- kernel, Camera, F4 or rendering changes
- converting module singletons to instances
- splitting `stage-shell-state` beyond single-owner getters
- splitting `finish-authoring.svelte.ts` internally (it gains a ratchet entry; its split is a
  follow-up)
- visitor/public modules

## 8. If R1 rules for nested routes now (extra step, after step 12)

1. Add `project/[projectId]/(workspace)/+layout.svelte`, rendering `<WorkspaceHost>`, with
   `createWorkspaceHost` moved there.
2. Keep `spatial/+page.svelte` as World and add `experience/+page.svelte`. Each page is a thin
   activator: `host.requestWorkspace(id)` in `$effect`, untracked, with no contributions.
3. Workspace navigation uses `goto(url, { replaceState: true, noScroll: true, keepFocus: true })`
   and keeps today's query string.
4. `beforeNavigate` maps a same-project workspace change to `lifecycle.leaveLens(next)` and
   cancels on refusal. Programmatic lens changes keep calling `leaveLens` synchronously, then
   project the URL with `replaceState`.
5. `bindNavigation` exempts same-project workspace navigation from the unsaved-work prompt.
6. Route tests mount layout plus page through a harness fixture.
7. The owner also rules on:
   - URL names
   - whether reload stays in Experience
   - whether a switch adds a history entry (recommended: no, i.e. replace)

## 9. Verification

| Area | Evidence |
| --- | --- |
| Behavior | Step 1 characterization, plus the five route-mount suites with unchanged assertions, at every step |
| Workspace transitions | World ↔ Experience with each live state:<br>- Align active: put back, or refusal holds the lens<br>- Studio pending task: refusal<br>- Material Editor or Import open: closes<br>- Paint tray, Library, Lift, Slice, Spot Look-through and Preview: as today |
| Session continuity | One StageCanvas mount, one facade, history and project session across round trips (step 1 test). No persistence or reload traffic during switches; checked through the test's persistence mock and with browser QA network inspection. |
| Cancellation and Undo/Redo | Escape ladder order test, replacement and teardown order tests, Undo/Redo across a lens round trip |
| Lanes | `test:fast`, `test:arch`, `test:heavy` (sequentially), `npm run check`, `npm run build` |
| Bundle | Production build; the spatial route's client node and entry chunks (raw and gzip) within ±1% of base (#279 rule). Record the numbers in the pull request. |
| Performance | Existing `stage:route-mounted` mark and `perfMeasureSync` signals, plus a `performance.measure` around five lens switches in a production preview, base versus branch. Report medians; a regression above 10% stops the work. |
| Visual parity | Focused browser QA on desktop and iPad widths: World idle, Library, Paint tray, Align, Material Editor, Import, Repair drawer, Studio, Lift, Slice, Spot Look-through, Experience, Preview. Screenshots against production at the same state; no console errors. |
| CI | `merge gate`, `check guards`, `linux-x64` |

## 10. Acceptance criteria

- **Route.** `+page.svelte` satisfies CR1–CR5, imports only `ROOT_IMPORTS.route`, and has no
  forward references. The host has exactly one `late()` cell.
- **Features.**
  - Every block in §4.2 lives in its named owner.
  - D1–D7 hold with an empty violation list.
  - `TYPE_ONLY_CORE_TO_FEATURE` contains only pre-existing entries.
- **Lifecycle.** Every §4.4 event and every Escape rung resolves through the tables. The step 1
  characterization passes unchanged.
- **Integrity.**
  - `stage-adapter-host.ts` imports no `look/finish-authoring*`.
  - `stage-shell-commands.ts` has no runtime feature imports.
  - The five route-mount suites pass with unchanged assertions.
- **Guards.** Every guard has at least one fresh-identifier negative control. The old controller
  controls fail under the new guard.
- **Admission demo.** In review, a scratch feature with one region key, one lifecycle step and one
  rung is admitted by touching only:
  - its own files
  - one workspace placement line
  - one line each in `LIFECYCLE_ORDER`, `ESCAPE_RUNG_OWNER` and `REGION_KEY_OWNER`

  It touches no shared composition files. The demo is not committed.
- **Gates.** Bundle, performance, visual parity and CI as in §9.
- **Docs.** The reference and `AGENTS.md` are updated, and this plan is deleted before merge.

## 11. Risks and stop conditions

| Risk | Mitigation |
| --- | --- |
| Effect or lifecycle reorder changes behavior | Step 1 tests first; construction order rule; explicit events where order cannot be preserved |
| Scoped CSS breaks when markup moves | Styles move with their elements; parity screenshots; computed-style checks on moved surfaces |
| Getter spreading loses fine-grained tracking or adds updates | Spreads of getter objects stay lazy; re-render counts on StageCanvas props are compared base versus branch in step 12 |
| Singleton reset timing across project switch | Pinned by a step 1 test; owners keep today's timing |
| Large single pull request | Per-owner commits; each one green; implementation commits revert as a unit |
| Concurrent route edits | The C4/U7 hold. Other route-touching pull requests wait for this merge. |

**Stop and report to the owner, without improvising, if:**

- a route-mount assertion would have to change
- a lifecycle or effect order cannot be preserved or made explicit
- Camera evaluation, F4 acceptance, input arbitration semantics, adapters' behavior or a
  visitor/public module would have to change
- the bundle grows more than 1%, or the lens-switch median regresses more than 10%
- a composition root needs logic that CR1–CR5 forbid and no owning module fits (a protocol gap)

## 12. Flags and owner rulings

- **R1 — URL-addressed workspaces now?** Recommended: **no**. Keep B, with the route-adapter seam
  (§3, §8). Yes changes reload, Back and direct-entry behavior, and adds §8 plus its three
  sub-rulings.
- **R2 — Guard replacement (Tier 2: removing a check).** Replace the X1–X3 blacklist sections and
  `authoring-controller-boundary.test.ts` with the positive manifest guards in §5, which are
  strictly stronger and replay the old controls. Recommended: **approve**.
- **Owner action — Hold.** Record the C4/U7 hold in `focus.md`. Agents do not change that file.

**Defaults this plan sets** (reversible, recorded here):

- the hotspot ratchet allows recorded raises without owner approval
- singletons keep module scope, with one lifecycle owner each
- `finish-authoring.svelte.ts` is not split here
- #280 stays `needs-ux`; nothing here makes Experience lazy

## Appendix A — Creation sequence at the base

These are the route's factory calls and route-level `$effect`/`onMount` registrations, in source
order. `$derived` values are lazy and are not listed. The host reproduces this sequence; a row
whose owner is a feature becomes that feature's factory, or one of its phases.

| # | Base lines | Creation points | Owner → host call |
| --- | --- | --- | --- |
| 1 | 224–254 | subject scope, API, auth, Stage session, proofs, analyses, light preview, scene pick, `pickThroughSlice`, verified images, finish tiles, asset leases | core |
| 2 | 296 | project epoch (`lifecycle: late()`) | core |
| 3 | 337 | project session | core |
| 4 | 387 | shell state | core |
| 5 | 407–438 | Experience binding, Experience preview | `createExperienceFeature` |
| 6 | 494 | press tracker | core |
| 7 | 501 | light look-through | `createLightInspectionFeature` |
| 8 | 512 | viewport | core |
| 9 | 556 | look-through frame effect | core `createLookThroughFrame` |
| 10 | 564–567 | light cancel effects (lens leave, Preview) | `lightInspection.attachGuards()` |
| 11 | 580 | selection view | core |
| 12 | 582–683 | Finish Card selection effect, paint tray state, paint tray reset effect, material import | `createAppearanceFeature` |
| 13 | 904–905 | panel rects, look authoring | `createSkyFeature` |
| 14 | 934 | Card-rename effect | core |
| 15 | 943 | shell commands | core |
| 16 | 990 | Studio controller | `createStudioFeature` |
| 17 | 1147–1233 | finish authoring, issues reset effect, two library-draft effects | `appearance.attachAuthoring()` |
| 18 | 1242 | artwork interaction | `createArtworkFeature` |
| 19 | 1263–1282 | Unfold gestures, Slice draw | `createLayoutReadingsFeature` |
| 20 | 1292–1333 | input arbiter, keyboard | core |
| 21 | 1468–1814 | Unfold anchor, cutaway hold, resolved Slice, classification, selection hosts, cutaway mirror, plan parameters, Lift space effects | `readings.attachReadings()` |
| 22 | 1847–1919 | retry frame, Studio entry, Place copy, arm and creation effects | `studio.attachEntry()` |
| 22a | 1935 | Camera content-bounds effect | core |
| 23 | 1941 | leave-project teardown (mixed owners) | core `installLeaveProject(lifecycle)` (§4.4 `leaveProject`) |
| 23a | 1955–1964 | lens-leave Slice exit, Slice-tool disarm | `readings.attachTeardown()` |
| 24 | 1969 | artwork cancel effect | `artwork.attachGuard()` |
| 25 | 2279–2334 | Wall Face camera port, Unfold camera executor | `readings.attachCameraPorts()` |
| 26 | 2362 | `onMount` (start and dispose tables) | core `installStageMount(lifecycle)` |
| 27 | 2556–2565 | Align ownership, Align reframe | `appearance.attachAlign()` |
| — | — | lifecycle runner; `late()` set | core |

`library` has no creation points; its factory runs at row 12, before Appearance consumes it.
