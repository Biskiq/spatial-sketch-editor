# X9 Integration ownership recovery

**Status.** Implementation and acceptance evidence are tracked in draft PR #413. This is Tier 2
because it changes architecture checks and restructures the shared shell. The owner approved
the direction on 2026-11-24 with these amendments.

- **R1:** nested URLs are deferred. X9 is component-level World/Experience decomposition. It keeps a
  future navigation seam and independent Studio ownership (§3, §8).
- **R2:** replacing the X1–X3 guards is approved, on condition that every existing architectural
  guarantee is preserved. Appendix B maps each old assertion to its replacement.

The owner decides again before merge. C4 and U7 stay held until this pull request merges.

**Base:** `main` at `41814cd91`, after C3 #412 and U6 #411. Line references below are to
`apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` at that commit ("the route").

## Goal

Recover integration ownership of the spatial editor. A capability added to an existing workspace
should land in its own feature module, and its only change to shared composition should be bounded
declarative registration (§5.4). The refactor preserves behavior. It changes none of the following:

- UX
- Camera evaluation
- F4 acceptance
- input arbitration semantics
- rendering
- the visitor/public surface

X3 left the route at 1,507 lines. Ten days later it is 3,572 lines, despite the X1–X3 guards. This
plan fixes why the boundaries failed. It does not repeat the extraction.

Two kinds of work stay outside X9 unless a demonstrated correctness blocker requires them (§7):

- converting singletons to instances
- refactoring feature internals

## Recovery decisions

- The Stage session owns the canonical lens rune. The binding observes it and keeps the existing
  refusal and camera transitions. A plain reader failed mounted reactivity checks. The direct
  subscription experiment also failed mounted lifecycle checks. A session-owned rune passed those
  checks and removed the binding's mirror. The single lifecycle cell still installs the ordered
  lifecycle once. Explicit deferred callbacks expose Preview and command operations once their
  respective owners exist.
- Core owns the viewport element, coordinate reads, project readiness, shared frame arbitration,
  selection presentation and contribution views. The selection presentation can temporarily hide
  the canonical primary during Experience link picking. The project session owns source download.
  Experience owns focus and Preview views. Studio owns its Stage adapter. Core keeps a single
  World Index memo per mounted workspace.
- Feature owners install effects at construction. Paint registers before the draft publisher.
  Layout Readings registers hold release before Artwork cancellation. An experiment moving all
  effects to owner construction without preserving that order failed the mounted blur case.
  The host compatibility phase table is now empty.
- Appearance's Canvas contribution uses explicit live getters. The shared Material Editor is
  keyed by Draft/Finish mode. The mounted tests check live proposal publication and the original
  remount and focus behavior while the Canvas remains mounted.
- The keyboard arbiter keeps the existing Escape ordering. Sky registers its own rung through
  the same protocol exercised by the admission probe. Core retains the prelude and the steps
  that share unwind context or established core ports.

### Scratch feature admission

The uncommitted Quux probe added a reactive reading, a World button, a live overlay mark, a
selection effect and owner callbacks for reset, lens leave, project leave and Escape. Type
checking and the mounted selection, overlay, Escape and lens round-trip case passed. Lifecycle
reset and project leave were registered in the probe and were outside that case's assertions.

| Shared file | Added / removed lines | Registration |
| --- | ---: | --- |
| `protocol.ts` | 2 / 1 | One feature ID |
| `lifecycle-order.ts` | 3 / 0 | Three ordered lifecycle steps |
| `escape-ladder.ts` | 1 / 0 | One ordered rung ahead of Palette |
| `region-ownership.ts` | 1 / 1 | Append one owner to marks |
| `workspace-host.svelte.ts` | 6 / 2 | Import, construction, lifecycle, Escape, overlay and view |
| `WorkspaceHost.svelte` | 2 / 0 | Component import and World trailing mount |
| `integration-ownership.manifest.ts` | 3 / 0 | One feature entry |

The scratch owners and placement were 52 lines across three files. The probe required four explicit
registration surfaces in addition to the original list in §5.4: feature identity, the Escape
handler registration, overlay contribution and publication of the view. They carry typed values
and make the dispatch and mount sites visible in review. The scratch test added 26 lines.

### Production line changes

These counts use `git diff --no-renames --numstat` under `apps/editor/src` at production
checkpoint `a66a2a9cb`. They include comments and blank lines.

| Area | From `41814cd91` added / removed | From `380b871f0` added / removed |
| --- | ---: | ---: |
| Spatial route | 4 / 3,567 | 0 / 0 |
| Workspace host and wiring | 1,849 / 0 | 377 / 919 |
| Workspace protocol and placements | 610 / 0 | 55 / 3 |
| Stage core and shell | 1,346 / 156 | 324 / 46 |
| Feature and project owners | 3,702 / 7 | 328 / 98 |
| Other | 2 / 1 | 0 / 0 |
| Total | 7,513 / 3,731 | 1,084 / 1,066 |

The whole extraction is +3,782 lines. The recovery is +18, with the host and wiring down 542.
The host factory is 921 lines with no local runes. It still assembles wide dependency objects
and some multi-step callbacks. Canvas and region assembly remain reactive cross-feature
presenters. Their reads preserve individual region invalidation and the snapshot sampling point
for the idle Unfold anchor.

### Acceptance evidence and open decisions

The production checkpoint passed the fast lane (6,345 cases), the heavy lane (138), type
checking (zero errors, 10 existing warnings) and a clean provenance build. Fast includes 229
mounted route cases across gesture, Experience homes, source replacement, resume Save, viewport,
lifecycle order and reactive semantics. GitHub reported green merge gate, guard, Linux, editor,
package and API jobs on that checkpoint. The subsequent test-only guard revision runs the
architecture lane against the same production code (388 cases). Reinstating the checkpoint's
spread merge and unkeyed editor in a scratch tree made both new Appearance tests fail.

| Co-trigger in the mounted characterization | Asserted behavior |
| --- | --- |
| Selection | Finish gesture cancellation, rename consumption, Unfold anchor and cutaway hosts preserve order |
| Lens and tool changes | Lift scope survives, Slice clears on lens leave, and tool leave disarms the draft while keeping the committed cut |
| Preview entry | Inspection and held cutaway release before Preview takes the Stage |
| Paint disarm | The tray and draft settle through the ordered owner effects |
| Source replacement and project teardown | Lift, Slice and resolved mirrors reset |
| Render-root revision | Studio retries framing before Camera bounds publish |

The eager spatial closure measured 1,428.718 → 1,438.264 KiB gzip with 74 files at both
revisions (+0.67%). The home, editor, projects and publication closures kept 23, 24, 33 and 58
files respectively, with each gzip change below 0.02%. The provenance-backed first-load and
publication authoring exclusions passed. The Vite walk from the reported eager file sets
measured 133.526 → 133.524 KiB lazy gzip, with 32 JS and 18 CSS in both builds. The original
baseline table reports 19 lazy CSS files. Comparing the current pair, dynamic entry names
match after normalizing the package path and the content hash for Form evaluation. Neither
changed its eager/lazy classification.

Five instrumented switches on an empty production project at 1280 × 800 kept the same Stage
Canvas and recorded one route mount on each build. The base control-update times in ms were
9.6, 4.7, 2.3, 5.4 and 1.9. Recovery measured 10.1, 4.5, 6.4, 3.5 and 2.0. The median was
4.7 → 4.5 ms, and the next-animation-frame median was 15.4 → 16.0 ms. Each run loaded two
scripts during first use and recorded no fetch or XHR during the switches. The mounted suites
verify persistence suppression through their API and session assertions.

Browser comparisons covered World, Experience, Library, Paint, Import with a checker image,
Object Studio entry and default Slice at 1280 × 800 and 1024 × 768, plus the readings menu and
Lift at 1024 × 768.
Both builds opened the Project actions menu after startup. Desktop Library thumbnails were at
different loading stages in the captures. The full visual matrix remains open for Align,
Material Editor, Repair, Spot Look-through and Preview. The mounted UI tests cover
several of those feature interactions.

Both `SPOT_REQUIRE_VERIFIED=1` invocations, from clean base and production checkpoint trees,
timed out on the Project actions menu before opening either grid. The partial ledgers contain
matching build identity marks. Both harness reports are `unverified` because they stopped before
their provenance check. M and L editing timings and labels are unmeasured. A product browser
check of the menu after startup worked on both builds. The failure's cause inside the
measurement flow remains unconfirmed. The spot runs were performed once per revision.

Appendix B replay is unfinished. The legacy controller and route assertions and their synthetic
controls still run. The new markup guard replays eight of the old presentation placement
controls at both roots. The ownership checks resolve static aliases, namespace members and
barrels for named authorities. The domain rules record exact retained Stage edges and
type-only bridges. Remaining enforcement work includes strict CR4 callback projections,
complete CR5 attribute and EC2 return shapes, the remaining call ownership and singleton
member classifications, and full equivalence replay before guard retirement.

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

Every block of the route has a single owner in the target (§4.2). Its cross-feature integration is
hand-written:

- **Lifecycle chains.** These hand-written functions encode cross-feature ordering:
  - `resetViewContext` (2046)
  - `endMaterialOperations` (2073)
  - `interruptForReplacement` (2086)
  - `changeLens` (571)
  - `setReading` (2187)
  - the Undo/Redo bindings (2737, 2738, 2823)
  - Studio's `settlePending` (1086)

  Other ordering also lives in the route:
  - the epoch callback bag (296–336)
  - the `onMount` start and teardown (2362–2410)
  - the blur listener
  - the singleton-reset effects (1941, 1955, 1964)
- **Escape ladder.** `createStageKeyboard` (1333–1456) receives 61 inputs. About two dozen of
  them are feature callbacks (dismiss rungs and their guards) whose bodies are written in the
  route. The ladder interleaves core and feature rungs (§4.5).
- **Presentation bags.**
  - `canvas` (2454–2530): 47 keys from seven owners.
  - `overlay` (2605): it concatenates core, Sky, Artwork and Slice lists.
  - Region props: EditorHead 36, StageViewportRegion 29, StagePanels 13 and StageToolbars 8.
- **Module singletons reset by the route:**
  - `experienceFocus`, `interiorLift`, `wallFace`, `wallUnfold`, `sliceReading` and
    `nearWallCutaway`
  - the `cutaway-resolved` and `slice-resolved` mirrors
- **Core-to-feature leaks.**
  - `StageAdapterServices.finishes` exposes the whole `FinishAuthoring` type to core.
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
- **`stage-shell-composition.test.ts`** (793 lines, 22 cases). Eleven of these cases read the route
  source; they freeze strings in the route.
- **Twelve other files read the route source:**
  - `tests/helpers/import-closure.ts` (`composedSpatialHost`)
  - `editor-host-no-write`
  - `stage-grid`
  - `scene-pick-hidden`
  - `slice-lifecycle`
  - `slice-press-refusal`
  - `presentation-tokens`
  - `experience-shared-homes`
  - `playback`
  - the five route-mount suites (which mount the route rather than read its text)

  Appendix B maps every one of these readings.
- **Prose rules.** `composition-execution.md` "Route as composition root" (584) already says a
  capability "adds a module and a wiring line, not route branches". No check enforced it.

### 1.5 Routing feasibility spike (bounded, deleted)

A throwaway `routes/dev/workspace-spike/[projectId]/(workspace)/{world,experience}` was run in dev
and in a production build. It had three parts:

- a `{#key projectId}` project layout
- a persistent workspace layout
- two pages registering toolbar/panel snippets

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

### 1.6 Client bundle at the base

This is a clean `vite build` of this branch, whose only change from `41814cd91` is this document.

The eager closure is the complete set of files a cold navigation loads. `npm run perf:bundle`
reports it from SvelteKit's node `imports` and `stylesheets`, and it includes:

- the client entry and app
- the root layout and error nodes
- the leaf node
- every transitive static import, JS and CSS

The lazy closure is every chunk reachable from the eager set through `dynamicImports` in
`.svelte-kit/output/client/.vite/manifest.json`, followed transitively, minus the eager set. All
gzip sizes use level 9.

| Set | Files | Raw | Gzip |
| --- | ---: | ---: | ---: |
| `/project/[projectId]/spatial` eager (`perf:bundle`) | 74 | 4,950.9 KiB | 1,428.7 KiB |
| — of which JS | — | 4,663.9 KiB | 1,382.2 KiB |
| `/project/[projectId]/spatial` lazy (manifest walk) | 32 JS + 19 CSS | 367.8 KiB | 134.8 KiB |
| `/p/[publicationId]` eager | 58 | 2,368.8 KiB | 689.6 KiB |
| `/` eager | 23 | 109.2 KiB | 43.4 KiB |
| `/editor` eager | 24 | 309.4 KiB | 105.9 KiB |
| `/projects` eager | 33 | 364.0 KiB | 125.9 KiB |

An independent walk of the Vite manifest from the same roots agrees with `perf:bundle` to within
0.2% (73 files, 4,943.3 KiB raw, 1,427.5 KiB gzip).

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
6. **Cross-feature lifecycle is hand-ordered code.** Replacement, lens leave, blur, Escape, Undo,
   reading change and teardown are written per call site, so every feature edits all of them.
   Effect creation order is a second, implicit ordering. Nothing states which behaviors depend on it.
7. **Policy is prose without enforcement or growth signals.** Nothing reports when a hub gains
   state, effects or dependencies.

## 3. Alternatives and decision

| Option | Gains | Costs in this repository |
| --- | --- | --- |
| **A. Nested routes** (`(workspace)/+layout.svelte` host; `world` and `experience` pages as workspaces) | URL-addressed workspaces; route-node code splitting; file-level separation | **Second lens authority.** The Stage session's `changeLens` (`stage-session.ts:534`) is the synchronous, refusal-capable writer with task parking. The router would be a second requester for the same fact.<br>**Pages cannot own state.** State that must survive a round trip cannot live in a page (spike). Pages could only activate, and their contributions would overlap during a switch.<br>**Behavior change.** Reload, Back and direct entry would change.<br>**Rework:** the unsaved-work guard, the boot query parameters, Studio entry links and about 184 route-mount cases.<br>**No splitting gain** while Experience must load eagerly (#280). |
| **B. Component-level workspace decomposition** with a typed feature protocol | Fixes the root causes (seam, positive guards, lifecycle tables). One Stage, session, history and renderer by construction. Lens authority unchanged. Route tests keep mounting `+page.svelte` unchanged. | No URL addressing, and no splitting yet |
| **C. Extract more controllers from the route** (repeat X3) | Smallest diff | Repeats root causes 2, 3 and 6; the route would regrow |

**Decision (owner ruling R1): B.** Nested URLs are deferred, and the navigation seam stays open
(§8). Under B, World and Experience are two workspace modules selected by the Stage session lens.
Studio is an independent feature that World mounts (§4.6).

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
route   routes/project/[projectId]/spatial/+page.svelte    composition root
host    workspace/host/workspace-host.svelte.ts            createWorkspaceHost(): construction sequence only
        workspace/host/WorkspaceHost.svelte                shared regions in today's DOM order
        workspace/host/wiring/<controller>.ts              one wiring function per large core construction
work-   workspace/world/WorldWorkspace.svelte              placements only
spaces  workspace/experience/ExperienceWorkspace.svelte
proto-  workspace/protocol.ts                              ids, view types, lifecycle/rung types, late()
col     workspace/lifecycle-order.ts                       LIFECYCLE_ORDER (data)
        workspace/escape-ladder.ts                         ESCAPE_LADDER (data)
        workspace/region-ownership.ts                      REGION_KEY_OWNER, REGION_LIST_KEYS, contribution<>()
        workspace/lifecycle-runner.ts                      createFeatureLifecycle(): ordered fan-out per event
```

The guards assign each module to exactly one layer through the manifest (§5.1), not by directory:

| Layer | Contents | May import |
| --- | --- | --- |
| Composition roots | The route, the host factory and component, wiring modules, workspace components | §5.2 D4–D5, §5.3 |
| Features | Per feature: one entry, its sub-owners, its region components and one view type module (§4.2) | Core, domain, own members (D2) |
| Core controllers | `stage/route/**`, `project-session/**` and the new core modules of §4.2 | Core, domain |
| Core presentation | Shell region components under `stage/shell/**` and `world-toolbar/**` | Presentation types only (D9) |
| Shared reading state | The module singletons (§4.3.1) | Domain |
| Card sections | Domain presentation components rendered by adapter Cards (§4.3.3) | Domain, core presentation, the adapter contract |
| Domain | `adapters/**`, `layout/**`, the `look/**` domain modules, `packages/*`, `$lib/render`, `$lib/content` | Domain, and the adapter-contract core modules only (D10) |

A file joins a feature by being listed in the manifest. So `stage/route/light-look-through.svelte.ts`
can be a sub-owner of `light-inspection` without moving.

### 4.2 Features and sub-owners

A feature is a public entry composing **cohesive sub-owners**. The entry is not an integration
module. It holds no state, effects or logic of its own (entry contract below). Each sub-owner has
one responsibility, stated in the manifest beside it. A sub-owner is either an existing module or
a new module that takes over one route block.

| Feature | Entry | Sub-owners (responsibility; absorbed route lines) | Region components and view type |
| --- | --- | --- | --- |
| `light-inspection` | `look/light-inspection-feature.svelte.ts` | `stage/route/light-look-through.svelte.ts` (existing: the Spot Look-through session)<br>`look/light-inspection/light-inspection-guards.svelte.ts` (port and cancel rules: `lightInspection`, `lightInspectionPort` 287–295, cancel effects 563–568, lifecycle steps)<br>`look/light-inspection/light-coverage.ts` (`lightCoverage` 2660) | view type `light-inspection-view.ts` |
| `layout-readings` | `stage/readings/layout-readings-feature.svelte.ts` | `stage/readings/lift-host.svelte.ts` (Lift reading host: 1486–1591, Lift-space effect 1814, `lift` rung)<br>`stage/readings/slice-host.svelte.ts` (resolved Slice and its effect, `slicePill`, `putBackSlice` 1592–1823, `sliceDraw` construction, Slice draft overlay 2584–2604, lens-leave and Slice-tool effects 1955 and 1964, `slice-draft` and `slice` rungs)<br>`stage/readings/cutaway-host.svelte.ts` (cutaway hosts, classification, mirrors and stub 1623–1734; `W` hold; hold release on blur)<br>`stage/readings/unfold-host.svelte.ts` (`selectedCurvedWall`, Unfold anchor effect 1457–1473, `unfoldGestures` construction, Unfold camera executor 2334, dispose)<br>`stage/readings/wall-face-host.ts` (Wall Face camera port 2279)<br>`stage/readings/plan-parameters.svelte.ts` (plan-parameter effect 1735) | `stage/readings/LayoutReadingsOverlay.svelte`; view type `layout-readings-view.ts` |
| `sky` | `look/sky-feature.svelte.ts` | `look/sky/sky-host.svelte.ts` (`skyRects`, `look` 904–915, `dialPlacement` and `dial` 2425–2453, Sky overlay parts, `sky` rung) | view type `sky-view.ts` |
| `artwork` | `artwork/artwork-feature.svelte.ts` | `stage/route/stage-artwork-interaction.svelte.ts` (existing: the Artwork gesture owner, constructed by the entry)<br>`artwork/artwork-host.svelte.ts` (`canPlaceArtwork` 1937, cancel effect 1969, hanging guides 1977–1989, `leaveProject` dispose, overlay `candidates`) | view type `artwork-view.ts` |
| `library` | `library/library-feature.svelte.ts` | `library/library-host.svelte.ts` (`libraryEntries`, `libraryTileSource`, `libraryObjects`, `LIBRARY_INVOKERS`, `returnLibraryFocus`, `closeLibrary` 670–871, `library` rung) | `library/LibraryWorldRegion.svelte` (the `{#key}` + `StageLibrary`); view type `library-view.ts` |
| `appearance` | `look/appearance-feature.svelte.ts` | `look/appearance/card-session.svelte.ts` (Finish Card selection effect 582, Card gesture cancel steps, `finish-gesture` rung, `finishCard` adapter port, `canvas.scene` Finish preview)<br>`look/appearance/paint-session.svelte.ts` (Paint tray state, reset effect, `paintLine` 635–665, `paint-picker` and `paint-tool` rungs)<br>`look/appearance/import-session.svelte.ts` (`materialImport` and its reference builders through `libraryDraftStatus` 683–832, `material-import` rung, `cancel-image` step)<br>`look/appearance/library-draft-session.svelte.ts` (`finishShelf`, `libraryTarget`, library-draft effects and `endLibraryDraft` 1230–1250, `material-editor` rung)<br>`look/appearance/align-session.svelte.ts` (Align region and framing 2254–2278, `alignProject`, `alignInspectedNow`, ownership and reframe effects 2531–2583, `alignCutaway` port, `align` rung)<br>`look/appearance/repair-session.svelte.ts` (repair drawer state, the Appearance half of the 1201 reset effect, `repair-drawer` rung, Head repair keys)<br>`look/appearance/operations.ts` (`endMaterialOperations` 2073: the ordered end of the sessions above, exposed as two lifecycle steps)<br>`look/finish-authoring.svelte.ts` (existing; constructed by the entry, not split) | `look/AppearanceWorldRegions.svelte` (Import sheet, Align, the two `LibraryMaterialEditor` modes, Paint tray); `look/AppearanceSharedRegions.svelte` (Repair drawer); view type `appearance-view.ts` |
| `studio` | `studio/studio-feature.svelte.ts` | `studio/studio-controller` (existing; constructed by the entry)<br>`studio/studio-port.ts` (`objectStudioPort`, `studioRevision`, `studioArmPending` 275–286)<br>`studio/studio-entry-session.svelte.ts` (`runStudioEntry`; retry-frame, entry, Place-copy and arm effects 1846–1934; `leave` rung)<br>`studio/studio-find.ts` (`studioFind` 618) | `studio/StudioWorldRegions.svelte` (Transfer strip, Scope strip, Root panel); view type `studio-view.ts` |
| `experience` | `experience/experience-feature.svelte.ts` | `stage/route/stage-experience-binding.svelte.ts` (existing; constructed by the entry)<br>`experience/experience-preview-host.svelte.ts` (`previewController` and its `prepareArtwork` 438–492)<br>`experience/experience-host-ports.ts` (`experienceFloorDatum`, `experienceShownCard`, the cursor port `viewEditKind`/`placingView`, `lookThroughSession`, the Preview key gate) | none (its region keys feed shared regions); view type `experience-view.ts` |

The implementer may merge two sub-owners of one feature only if both are under 80 lines and share
one lifecycle. Any such merge is listed in the pull request. A sub-owner never grows a second
responsibility in X9.

**Entry contract** (checked on the AST, §5.3):

| Rule | Statement |
| --- | --- |
| EC1 | The entry exports one `create<Feature>Feature(deps)` factory, plus types. When a feature needs a compatibility phase, the factory's returned object carries it (§6 rule 3). |
| EC2 | The factory body is `const` constructions of its sub-owners (CR4 literal rules), then one `return` of an object whose members are:<br>- getters of a single `return <member chain>`<br>- methods that delegate in one call<br>- `regions`, `rungs`, `lifecycle` and `ports` records whose values are sub-owner member references |
| EC3 | No runes. No `let`, function declarations, `untrack` or browser globals. No statement-bodied arrows, except a compatibility phase, whose body is only sub-owner calls. |
| EC4 | Sub-owners do not import a sibling sub-owner at runtime: the entry injects siblings by construction. So the entry is the one place a feature's parts are composed. |

**Core keeps** everything that is arbitration or shared infrastructure:

- boot and the project session
- the Stage session, epoch, asset leases and viewport
- the selection and its views
- shell state and commands
- input arbiter and keyboard
- dock, find, index, Card and task presentation
- Head, notices and panels
- history and source download

The new core modules take over what the route held:

| New core module | What it takes over |
| --- | --- |
| `stage/route/route-input.svelte.ts` | The project id and URL, derived from `page` as the route does today |
| `stage/route/project-ready-port.svelte.ts` | The 36 boot gates. It exposes `snapshot()`, `envelope()` and `datumMeters()`, each `null`/neutral while not ready. |
| `stage/route/stage-viewing.ts` | `submit`, `setReading`, `fit`, `zoom`, `pan`, `orbit`, `bringIntoView`, `requestScaleDetent`, `patchDrafting` (2177–2253). `setReading` runs the `readingChange` event (§4.4). |
| `stage/route/stage-history-command.ts` | `undo()` and `redo()`: the `historyStep` event, then `stageEpoch.undo/redo` (2737, 2738, 2823) |
| `stage/route/stage-window-listeners.ts` | The window `keydown`, `keyup` and `blur` listeners (2367–2385). They route to the keyboard and to the `windowBlur` event. |
| `stage/route/stage-content-bounds.svelte.ts` | 1824, 1924–1936 |
| `stage/route/look-through-frame.svelte.ts` | The frame effect (556). It composes the Experience view session port and the light-inspection session port. |
| `stage/route/stage-cursor.ts` | The `stageCursor` precedence (2620), unchanged. It reads an Experience port `{ viewEditKind(), placingView() }`. |
| `stage/route/core-region-views.ts` | Core's region contributions: the core keys of `canvas`, `overlay`, `viewport`, `head`, `toolbars` and `panels`, as getter objects |
| `stage/route/core-lifecycle-steps.svelte.ts` | The bodies of every `core:` lifecycle step, moved verbatim from the route chains |
| `stage/route/boot-repair.svelte.ts` and `stage/shell/StageBootPanels.svelte` | The core half of 1196–1229 and the boot markup (3344–3426) |
| `stage/shell/StageReplaceDialog.svelte` | 3428–3435 |

`stage-shell-state.svelte.ts` is not split. A getter moves out only if all its readers and writers
belong to one feature; the implementer checks each by search and lists any moves in the pull
request. The hotspot ratchet (§5.5) records it so it cannot grow.

### 4.3 Typed ports and dependency policy

- Each feature factory takes `deps: Pick<StageCorePorts, …>` plus its declared cross-feature
  ports, and returns a frozen object of getters and methods.
- `StageCorePorts` is a type, not a runtime object passed around. The host builds each feature's
  argument as an object literal of thunks.
- There is no context lookup, global registry or service locator.
- Svelte `setContext` remains only where it already exists (finish tiles).

Cross-feature data flows only through host-wired thunks. Each edge is listed in
`CROSS_FEATURE_PORTS` in the manifest:

| From → To | Port |
| --- | --- |
| `appearance` → `layout-readings` | `alignCutaway(): AlignCutawayRequest \| null`. Align hides Walls through the cutaway mask. |
| `layout-readings` → `artwork` | `resolvedSlice()`, for `pickVisibleFaceThroughSlice` |
| `studio` → core canvas `plan` | `suppressesPlan(): boolean` (`studio.active && context === 'mat'`) |
| `library` → `appearance` and `scene` placement | `open()`, `invocation()`, `close(returnFocus)` |
| `experience` → core cursor and look-through frame | `viewEditKind()`, `placingView()`, `lookThroughSession()` |
| `light-inspection` → core look-through frame | `session()` |

A shared reading state module (§4.3.1) is not a port. Appearance's `finish-align` already calls
`wallFace`, and that call is governed by the singleton policy, not by this table.

Core never imports a feature at runtime. These leaks are removed:

| Leak | Fix |
| --- | --- |
| `StageAdapterServices.finishes: { current: FinishAuthoring \| null }` | `finishCard?: StageFinishCardPort`, declared structurally in `stage-adapter-host.ts` with exactly the members the Card section uses (§4.3.3); the type checker settles the set. `stage-adapter-host.ts` then imports nothing from a feature. |
| `stage-shell-commands.ts` runtime imports: `armedLightKind`, `sliceReading.level()`, `isStudioWorldTool` | Command input ports: `lightArmed(projectId)`, `levelSlice()`, `isStudioTool(id)`. The `light-inspection`/`sky`, `layout-readings` and `studio` features wire them. |
| Type-only Experience imports in `stage-shell-commands.ts` | These, and every other existing type-only core → feature import, go into the shrink-only `TYPE_ONLY_CORE_TO_FEATURE` allowlist. A new one fails. |

#### 4.3.1 Shared reading state (the module singletons)

The nine module singletons below are their own layer, shared reading state, placed under domain.
They are not feature members. Core and adapter modules read them today; because the singletons
are not feature members, those readers do not import a feature, and D1 holds without exceptions.
Converting them to project-scoped instances is outside X9 (§7). Each singleton's **lifetime** has
exactly one owner:

| Singleton | Lifetime owner | Retained non-owner consumers after X9 (members) |
| --- | --- | --- |
| `experienceFocus` | `experience` | none (`experience-controller` and the binding are Experience sub-owners) |
| `interiorLift` | `layout-readings` | `adapters/layout/layout-contributions.ts` (`reading`; `lift`, `putBack`) |
| `wallFace` | `layout-readings` | `adapters/layout/layout-contributions.ts` (`isActive`; `face`, `putBack`); `look/finish-align.svelte.ts` (`face`, `faceFloor`, `reframe`, `putBack`) |
| `wallUnfold` | `layout-readings` | the adapter Card and gesture modules (below); `stage/shell/StageCanvas.svelte` (`state`); `stage/shell/StageWallDevelopment.svelte` (`state`, `previewOpening`, `presentationAngle`) |
| `sliceReading` | `layout-readings` | none, once `stage-shell-commands` takes `levelSlice()` as a port |
| `nearWallCutaway` | `layout-readings` | none |
| `slice-resolved` mirror | `layout-readings` | `layout/plan-pick-provider.ts` (`resolvedSliceNow`) |
| `cutaway-resolved` mirror | `layout-readings` | `layout/plan-pick-provider.ts`, `stage/slice/stage-slice-pick.ts` (`resolvedCutawayNow`) |
| `worldIndexModel` | core | none (`stage-selection-view` is core) |

The `wallUnfold` adapter consumers are:

- `adapters/layout/LayoutCardFields.svelte`: `state`, `anchorForWall`; `enter`, `exit`
- `adapters/layout/LayoutWallUnfold.svelte`: `state`; `setU`, `flip`, `exit`
- `adapters/layout/curve-gesture-session.ts`: `isActive`
- `adapters/layout/layout-contributions.ts`: `isActive`, `state`, `presentationAngle`

The manifest classifies every member of every singleton. A member it does not classify fails the
guard.

| Class | Members |
| --- | --- |
| lifecycle (ends a reading or installs a host executor) | `clear`, `reset`, `setCameraPort`, `setCameraExecutor` |
| sync (host-derived state pushed by an owner effect) | `setScope`, `ensureAnchor`, `evaluate`, `setSelectionHosts`, `setHeld`, `setResolvedSlice`, `setResolvedCutaway` |
| intent (a creator action through a Card, gesture or rung) | `lift`, `putBack`, `face`, `faceFloor`, `reframe`, `enter`, `exit`, `flip`, `setU`, `setAnchor`, `recordPick`, `setOpeningPreview`, `set`, `level`, `setDepth`, `setDrawnDepth`, `setDrawnSegment`, `flipDrawn`, `setMode`, `select`, `openExperience`, `openGuide`, `previous`, `back` |
| read | every other member: getters and queries such as `reading`, `isActive`, `state`, `anchorForWall`, `presentationAngle`, `previewOpening`, `pinnedOpeningId`, `drawn`, `mode`, `classified`, `effective`, `decision`, `stubTopY`, `subject`, `experienceId`, `guideId`, `read`, `resolvedSliceNow`, `resolvedCutawayNow` |

| Rule | Statement |
| --- | --- |
| S1 | Only the lifetime owner's feature members call lifecycle and sync members. |
| S2 | Intent members are called by the owner, or by a retained consumer listed for that member in `SINGLETON_CONSUMERS`. The list is exactly today's non-owner call sites, and it is shrink-only. A new caller outside the owner goes through the owner's feature port. |
| S3 | Read members may be read by any module. A new reader outside the owner adds one `SINGLETON_CONSUMERS` line, which is visible in review and needs no approval. |
| S4 | No module except the singleton's own file constructs or replaces it. |

The spike showed that the next host initialises before the previous one is destroyed. Owners
therefore keep today's reset timing, and a step 1 test pins it.

#### 4.3.2 Adapters

Adapters stay domain modules, behind the existing seam:

| Rule | Statement |
| --- | --- |
| A1 | Adapters reach Stage modules only through `stage-adapter-host` (the existing `stage-shell-composition` guard, kept). |
| A2 | Adapters import no feature member, workspace, host, wiring, route or `stage/route/**` module, at runtime or type-only. |
| A3 | Adapters may import shared reading state (S1–S3 apply to them) and Card sections (§4.3.3). |
| A4 | Every `StageAdapterServices` member's type is declared in core or domain, never in a feature module. After the `finishCard` change the members are `lightInspection` (wired from light-inspection), `objectStudio` (Studio) and `finishCard` (Appearance), all core-declared. The member count is in the ratchet (§5.5). |
| A5 | The epoch receives service ports as one typed record of thunks from the host, instead of the `finishes` thunk. The epoch and the adapter host keep their internal order. |

#### 4.3.3 Shared Card integration

The Card is core: `EditorCard` renders adapter Card contributions through `stage-contribution-view`.
The Finish section is the one shared Card integration.

`adapters/layout/LayoutCardFields.svelte`, `adapters/layout/LayoutRoomCard.svelte` and
`adapters/scene/SceneObjectCardFields.svelte` import `look/FinishCardSection.svelte` and pass it
`services`. The section reads `services.finishes.current`.

| Rule | Statement |
| --- | --- |
| C1 | `FinishCardSection.svelte` is a **Card section**: a domain presentation component that Appearance owns, listed in `CARD_SECTIONS`. Its runtime closure is fixed: `FinishTile`, `FinishSwapPicker`, the `finish-card.svelte.ts` helpers, `StagePaintWheel` and their domain imports. It imports no feature entry, sub-owner, workspace, host, route or `stage/route/**` module. It reaches the Appearance runtime only through `services.finishCard`. |
| C2 | Its consumers are exactly the three adapter Card field components above. A new consumer is one manifest line. |
| C3 | Appearance contributes no Card region key. The Card's subject, open state and gesture fade stay core. The Finish Card session's lifetime belongs to Appearance's `card-session`. That lifetime covers the selection change, `historyStep`, `readingChange`, `settlePending`, blur and the Escape rung. |
| C4 | `finish-card.svelte.ts` and `finish-authoring.svelte.ts` stay `look/**` domain modules, composed by the Appearance entry. Neither is split (§7). |

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
| `historyStep(direction)` (2737, 2738, 2823) | `appearance:cancel-card-gesture` → `core:run-history` |
| `readingChange(reading)` (`setReading`, 2187) | `appearance:cancel-card-gesture` → `core:submit-reading` → `core:end-press-for-reading` |
| `settlePending` (Studio port, 1086; refusal-capable) | `core:refuse-during-gesture` → `appearance:cancel-card-gesture` → `artwork:cancel` → `core:arm-select` |
| `leaveLens(next)` (Head workspace switch, route `changeLens`, 571; refusal-capable) | `studio:leave-for-lens` (when `next !== 'world'`) → `appearance:end-operations-restore-camera` (when `next !== 'world'` and the lens is World) → `light-inspection:cancel` → `experience:change-lens` |
| `windowBlur` (2377) | `core:release-snap` → `layout-readings:release-hold` → `appearance:cancel-card-gesture` |
| `leaveProject` (teardown of the 1941 effect) | `layout-readings:clear-readings` (`interiorLift.clear`, `sliceDraw.disarm`, `sliceReading.clear`, `setResolvedSlice(null)`, `nearWallCutaway.reset`, `setResolvedCutaway(null)`; in that order) → `appearance:cancel-image` → `artwork:dispose` → `core:dispose-artwork-assets` |
| `start` (`onMount`, 2362) | `core:perf-mark` → `experience:start` → `core:start-shell` → `core:start-viewport` → `core:install-listeners` → `core:install-interruptions` → `core:load-project` |
| `dispose` (`onMount` cleanup) | `appearance:end-operations-no-camera` → `appearance:reset-issues` → `layout-readings:dispose-unfold` → `light-inspection:dispose` → `experience:dispose` → `core:mark-torn-down` → `core:dispose-viewport` → `core:dispose-shell` → `core:clear-hover` → `core:remove-listeners` → `layout-readings:release-hold` → `layout-readings:clear-cutaway-mirror` → `core:remove-interruptions` → `core:dispose-epoch` |

The Head's workspace control requests `leaveLens(next)`. Experience-owned contextual commands
such as **Show** on a source finding and **Open in World** use the Experience binding's own
navigation path. Both paths converge in the binding, which delegates the lens write through the
facade to the Stage session. Contextual navigation retains the binding's existing press
interruption and the Stage session's gesture release. A mounted case pins the difference when a
live Studio gesture makes the Head refuse.

**Registration is declarative.**

- Each feature entry returns `lifecycle: { [event]: { [step]: handler } }`. Each handler is a member
  reference to a sub-owner method.
- `core-lifecycle-steps.svelte.ts` supplies the `core:` handlers.
- `createFeatureLifecycle({ core, features: [ … ] })` builds the runner. It takes order only from
  `LIFECYCLE_ORDER`; the `features` array is a set.
- When the runner is constructed it throws if a table step has no handler or two handlers, or if a
  handler is not in the table. The admission guard checks the same bijection statically.
- A conditional step (`when next !== 'world'`) keeps its condition inside its owner's handler,
  verbatim.

`createStageProjectEpoch`'s callback bag is replaced by `lifecycle: () => FeatureLifecycle`. Its
internal call order is unchanged. This is the host's single `late()` cell (§4.7). Steps are
synchronous, as today.

The reactive reconciliations stay as `$effect`s inside their owning sub-owners, never in a
composition root. Examples are the Card-rename effect (934) and the selection-change effect (582).
Their creation order is migration compatibility (§6 rule 3), not part of this contract.

### 4.5 Escape ladder and regions

**Escape.** Today the `dismiss` case of `stage-keyboard.ts` hard-codes rung positions. A new
feature rung would therefore need new keyboard logic. In X9 the ladder becomes data:
`workspace/escape-ladder.ts` exports `ESCAPE_LADDER`, the complete ordered rung list with one owner
per rung.

The `dismiss` case calls each rung's handler in table order and stops at the first that returns
`'handled'`. Core rung bodies move verbatim into named functions inside `stage-keyboard.ts`.
Feature rung handlers come from the feature entries' `rungs` records.

Some of today's rung conditions read core state:

- `armedHostTool === 'paint'`
- `!claimed`
- `lens === 'world'`
- `settleFocus()`

Those conditions move with their rung. The core state comes through `EscapeContext`, which the
keyboard computes where today's code does. The unwind claim is computed once, by the
`core:unwind-claim` marker rung, at its current position.

| # | Rung | Owner | # | Rung | Owner |
| ---: | --- | --- | ---: | --- | --- |
| 1 | `pending-delete` | core | 15 | `paint-tool` | `appearance` |
| 2 | `finish-gesture` | `appearance` | 16 | `slice-draft` | `layout-readings` |
| 3 | `adapter-gesture-cancel` | core | 17 | `palette` | core |
| 4 | `disclosure` | core | 18 | `task` | core |
| 5 | `adapter-keyboard-cancel` | core | 19 | `world-tool` | core |
| 6 | `press` | core | 20 | `sky` | `sky` |
| 7 | `library` | `library` | 21 | `furnish-strip` | core |
| 8 | `align` | `appearance` | 22 | `world-plate` | core |
| 9 | `material-editor` | `appearance` | 23 | `unwind-claim` (always passes) | core |
| 10 | `material-import` | `appearance` | 24 | `leave` | `studio` |
| 11 | `repair-drawer` | `appearance` | 25 | `selection` | core |
| 12 | `measure` | core | 26 | `lift` | `layout-readings` |
| 13 | `erase` | core | 27 | `slice` | `layout-readings` |
| 14 | `paint-picker` | `appearance` | | | |

The keyboard prelude stays as code: the `W` hold, the Artwork Escape, the Preview key gate, the
posture capture and text entry. It is key routing, not the dismiss ladder. Its feature inputs come
from ports: `artwork.escape`, `experience.previewKeys` and `layout-readings.setCutawayHeld`. The
precedence comments move beside the table rows.

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
| `canvas.geometry`, `canvas.contentBounds`, `canvas.framedViewport`, `canvas.hover`, `canvas.hoverTone` | core |
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
| `head.save`, `head.onUndo`, `head.onRedo` | core (`onUndo`/`onRedo` are `history.undo`/`history.redo`) |
| `head.repairIssueCount`, `repairOpen`, `onToggleRepair` | `appearance` |
| `toolbars.paintLine` | `appearance` |
| `toolbars.experience`, `viewLine` | `experience` |
| `panels.environment` | `sky` |

The implementer assigns the remaining keys by what each current expression reads, and the type
check proves the table is exhaustive.

List-valued overlay keys keep today's concatenation order through `REGION_LIST_KEYS`:

- `marks`: `['core', 'sky']`
- `candidates`: `['core', 'artwork']`

The scalar overlay keys `celestial` and `sliceDraft` belong to `sky` and `layout-readings`, respectively.

The host concatenates each list key in table order, with one generic expression for all of them.
A new owner of a list key is therefore one table entry (§5.4).

### 4.6 Workspaces and the host

**Rule:** a surface moves into a workspace component exactly when today's mount condition includes
the lens. Mount and unmount behavior is then unchanged, because such a surface was already
remounted on a lens switch. All other surfaces stay in `WorkspaceHost.svelte`, so their component
instances survive lens switches as today. Workspace components hold no state, and all feature
state lives in feature objects that the host creates once.

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

Compound mount conditions move into the region component that owns the surface. Examples are
`preview === null`, `adapterServices !== null` and `!shell.libraryOpen`. The region component then
mounts its child under the original condition, verbatim. A Svelte component adds no DOM of its
own, so the DOM and the mount and unmount timing are unchanged. Workspace components and
`WorkspaceHost.svelte` branch only on a single host member (CR5).

The route `<style>` (3438–3572) moves with the markup it styles. Scoped rules move to the
component that now holds the element; existing `:global` rules stay global.

**Studio** is an independent feature, not part of World:

- Its regions mount from the World workspace's `leading` placement.
- Its contextual entries are unchanged: the Card via `objectStudio`, the `?studio` URL via
  `studio-entry`, and Place copy.
- The Studio feature imports nothing from `workspace/world/**` and no World-only feature member.
- World imports only Studio's region component.

Promoting Studio to a third workspace later means adding `'studio'` to `WorkspaceId` and moving one
placement. No feature internals change.

### 4.7 Composition roots

`+page.svelte` becomes:

```svelte
<script lang="ts">
	import { page } from '$app/state';
	import { createWorkspaceHost } from '$lib/authoring/workspace/host/workspace-host.svelte';
	import WorkspaceHost from '$lib/authoring/workspace/host/WorkspaceHost.svelte';
	const host = createWorkspaceHost({ page: () => page });
</script>

<WorkspaceHost {host} />
```

`createWorkspaceHost` runs synchronously during the route's initialisation, so every `$effect`
and `onMount` created by core and feature factories belongs to the route component, as today. Its
body is a short construction sequence:

- core factories, each either a direct call or a `wire<Controller>(deps)` call
- feature entries
- compatibility phase calls, while any remain (§6 rule 3)
- `installLeaveProject(cell)` and `installStageMount(cell)`, which register today's 1941 teardown
  and `onMount` at their current positions
- `createFeatureLifecycle(...)`, then the one `late()` cell is set

It then returns the host view. Forward references become construction order. `late<T>()` is an
assign-once cell that throws if read before it is set.

Large core constructions get their own wiring module, `workspace/host/wiring/<controller>.ts`. Today
their argument bags are dozens of keys:

- input arbiter
- keyboard
- shell state
- shell commands
- epoch
- project session
- viewport

Each wiring module is one function returning one factory call with a CR4 literal. The host body
stays a short list, and no bag becomes a monolith.

## 5. Hardening and enforcement

All guards run in the `test:arch` lane. They reuse `tests/helpers/import-closure.ts`, plus the
`svelte/compiler` `parse` and `typescript` already used by existing boundary tests, so there are no
new dependencies. Each guard is a pure function `check…(sources, manifest) → Violation[]`. Its
test asserts `[]` for the real tree and runs the negative controls (§5.6) through the same
function. No guard encodes source order.

### 5.1 One manifest

A new `integration-ownership.manifest.ts`, beside the editor's architecture tests in
`apps/editor/tests/lib/authoring/`, is the single policy table. It declares:

- the layer of every classified module (§4.1)
- each feature's `id`, `entry`, sub-owners (with a one-line responsibility each), region components
  and view type
- `AUTHORITIES`, `CALL_OWNERS` and `REGION_MOUNTS` (§5.2)
- `CROSS_FEATURE_PORTS`
- `SHARED_READING_STATE`, with its member classes, lifetime owners and `SINGLETON_CONSUMERS`
- `CARD_SECTIONS` and their consumers
- the shrink-only lists: `TYPE_ONLY_CORE_TO_FEATURE`, `DOMAIN_TO_CORE`, `COMPAT_PHASES`
- per root, the import allowlist (`ROOT_IMPORTS`) and the `STRUCTURAL_ELEMENTS` list
- `APPROVED_BOUNDARIES`, folded in from `authoring-controller-boundary.test.ts`

It does not state lifecycle or rung order. Those are the source tables (§4.4, §4.5).

### 5.2 Dependency direction and authority

| Rule | Statement |
| --- | --- |
| D1 | Core and domain never import a feature entry, sub-owner, region component or view type, or a workspace, host, wiring or route module. This holds at runtime and type-only, except the shrink-only `TYPE_ONLY_CORE_TO_FEATURE` list. |
| D2 | A feature entry imports its sub-owners, region components and view type, plus core and domain. It imports other features' entries type-only. A sub-owner imports core, domain and its own feature's types, never a sibling sub-owner at runtime (EC4), and never another feature's members. |
| D3 | Workspaces import only feature region components, core region components and `workspace/protocol.ts` types. They never import the other workspace, a feature entry or a sub-owner. |
| D4 | Only the route imports the host. The host imports wiring modules, core factories, feature entries, workspace components, the protocol and the lifecycle runner. |
| D5 | The route imports only `ROOT_IMPORTS.route`. |
| D6 | Studio members import nothing from `workspace/world/**` and no World-only feature member. |
| D7 | Every `lib/authoring` module reachable from the route is classified exactly once (§4.1), so there are no unowned modules. |
| D8 | Adapters follow A1–A5 (§4.3.2). |
| D9 | Presentation never reaches a controller. Core region components, workspace components, feature region components and Card sections never import, at runtime or as types, the host, a wiring module, a core controller, a feature entry or a sub-owner. They type their props from `workspace/protocol.ts`, their own feature's view type module, or domain types. |
| D10 | Domain reaches core only through the adapter-contract modules. Today's domain → core edges form the shrink-only `DOMAIN_TO_CORE` list. |
| AU | **Authority uniqueness.** Each `AUTHORITIES` factory has exactly one construction site in `src/**`, at the site the manifest names. The check counts AST calls across the source tree, not route text. The list:<br>- epoch, asset leases, project session, Stage session, `createStageFacade`, viewport<br>- press tracker, input arbiter, keyboard, Unfold gestures, Artwork interaction<br>- Experience binding, `createExperienceLens`, `createExperiencePlayback`<br>- shell state, shell commands, selection view, dock view, find view<br>- Save state and Head Save, history command, window listeners<br>- lifecycle runner, `late()` |
| CO | **Call ownership.** Each `CALL_OWNERS` call or member form is called only from its listed owner modules, generated from today's call sites and shrink-only. The list:<br>- `createStageAcceptanceHost`, `mountStageAdapter`, `createStageAdapterServices`<br>- the session's `replace` and `changeLens` (facade alone calls the latter; Experience binding alone calls the facade lens transition)<br>- Head workspace requests are the only callers of `leaveLens`; Experience contextual actions stay on the binding path (§4.4)<br>- model pin resolution, `stageArtworkScope`, adapter-factory iteration<br>- `stageKeyAction`, `stageKeyFromTextEntry`, `stageKeyFromControl`<br>- the Artwork resize and placement planners, the Unfold pick and opening-drag planners<br>- `requestViewingIntent`; the epoch's `undo` and `redo`<br>- window `addEventListener('keydown' \| 'keyup' \| 'blur')` in the composed host |
| RM | **Region mounts.** Each `REGION_MOUNTS` component is mounted exactly once, at its listed site, across all composition roots and region components:<br>- `EditorHead`, `StageProjectNotices`, `StageViewportRegion`, `StagePanels`, `StageToolbars`, `StageCanvas`, `StageCamera`<br>- `EditorIndex`, `EditorCard`, `ExperienceGuide`, `ExperienceDock`, `StageDraftingControl`, `StageScaleBar`, `StageHeightSheet` |

The existing visitor/public guards are unchanged.

### 5.3 Positive contracts for composition roots and feature entries

The composition roots are the route, `WorkspaceHost.svelte`, `workspace-host.svelte.ts`, the
wiring modules, `WorldWorkspace.svelte` and `ExperienceWorkspace.svelte`. These rules are checked
on their AST:

| Rule | Statement |
| --- | --- |
| CR1 | **No runes,** except one `let { … } = $props()` in a `.svelte` root. |
| CR2 | **Statements.** The top level holds only imports, type declarations, `const` declarations and that `$props()` destructuring. It has none of the following:<br>- `function` declarations (except the one wiring function of a wiring module)<br>- other `let`, classes, loops, `if` or `try`<br>- `untrack`, `window`, `document`, timers, `queueMicrotask` or `requestAnimationFrame` |
| CR3 | **Imports** only from that root's `ROOT_IMPORTS`. |
| CR4 | **Construction.** The host factory body contains only:<br>- `const x = <allowlisted factory or wiring function>(<literal>)`<br>- compatibility phase calls `x.attachY();`, each listed in `COMPAT_PHASES` for `x`'s feature and called exactly once<br>- the registrar calls `installLeaveProject(cell);` and `installStageMount(cell);`, once each<br>- one `const lifecycle = createFeatureLifecycle({ core, features: [ …identifiers ] })`<br>- one `late()` and one `.set(…)`<br>- one `return` of an object of identifiers, member chains and single-`return` getters<br><br>A wiring module is one exported function whose body is a single `return create<X>(<literal>)`.<br><br>**Literal values** are identifiers, literals, member chains, nested object and array literals, projection expressions and projection arrows. A projection uses only identifiers, literals, member access, calls, `!`, comparison, `&&`, `\|\|`, `??` and the conditional operator. It has no assignment, update, `new`, `await`, `void`, sequence, template, block body or nested function, and at most 12 AST nodes. A longer expression is an owner's getter. |
| CR5 | **Markup** in `.svelte` roots contains only:<br>- components, snippets, `{@render}` and spreads of host members<br>- `{#if m}`, `{:else}` and `{#key m}`, where `m` is a single member chain on `host` with no operator; a compound condition belongs to the owning region component (§4.6)<br>- the elements in that root's `STRUCTURAL_ELEMENTS` list, today only the stage container and `.editor-body` in `WorkspaceHost`; each has a static `class` and attributes that are a single member read or a template literal of single member reads<br>- event attributes that are a member reference, or an arrow whose body is one call on a member chain with identifier or literal arguments<br>- a `<style>` block<br><br>Every `onUndo` and `onRedo` binding is `history.undo` or `history.redo`. |
| EC1–EC4 | **Feature entries** follow the entry contract (§4.2). |

Logic that does not fit belongs to its owner. Under any name, a new responsibility fails CR1, CR2,
CR4, CR5 or EC. That is the contract.

### 5.4 Feature admission

A capability is admitted when it has all of the following, and the admission guard checks them:

- an owning feature (existing or new) with an entry, sub-owners and a view type
- its canonical writers, declared in the entry's doc comment: the authority it writes through
  (F4 planners via adapters, the Stage session, the project session, or its own session state)
- its lifecycle steps in `LIFECYCLE_ORDER`
- its rungs in `ESCAPE_LADDER`
- its region keys in `REGION_KEY_OWNER` and its list keys in `REGION_LIST_KEYS`
- its singletons in `SHARED_READING_STATE`
- its cross-feature edges in `CROSS_FEATURE_PORTS`

The admission guard enforces consistency:

- Each lifecycle table entry has exactly one handler from its owner, and each handler has exactly
  one table entry.
- Each rung has exactly one handler from its owner.
- Region key ownership and exhaustiveness are type checks run by `svelte-check`.
- Singleton calls obey S1–S4.
- No new feature has compatibility phases.

**Realistic admission demo.** The demo runs in review on a throwaway branch from the finished X9
head. It adds a scratch World reading, `quux`, through the same paths a real reading uses:

- **State:** a `$state` reading in a sub-owner.
- **Command:** `quux.toggle()`, invoked from its own placement component.
- **Presentation:** a World `trailing` placement component and an overlay `marks` contribution.
- **Selection reaction:** a sub-owner `$effect` on `deps.selection()` that clears the reading.
- **Lifecycle:** steps in `resetPresentation`, `leaveLens` and `leaveProject`.
- **Escape:** one rung in `ESCAPE_LADDER`, before `palette`.

The allowed changes to shared files are bounded declarative registration only:

- one manifest feature entry
- three `LIFECYCLE_ORDER` lines
- one `ESCAPE_LADDER` line
- one `REGION_LIST_KEYS.marks` owner
- one `WorldWorkspace` placement line
- one host `const quux = createQuuxFeature({ … })` line, with a CR4 literal of core ports
- `quux` added to the lifecycle `features` array

All implementation is in `quux`'s own files. The pull request records the demo's full diffstat and
every shared-file hunk. If any shared hunk is anything other than one of those entries, the
protocol has a gap, and that is a stop condition. The demo is not committed.

A new Canvas (3D) ink kind, or a new prop on a core region, is a core contract change. It is not
declarative registration: it raises the hotspot record and goes through review. X9 adds no generic
Canvas layer slot, because nothing consumes one today (§12 default).

### 5.5 Growth monitoring

A new `integration-hotspots.json`, in the same directory, records, for each integration hub:

- LOC
- imports
- `$state`, `$derived` and `$effect` counts
- top-level functions
- exported members (getters, for `stage-shell-state`)
- `StageAdapterServices` members (for `stage-adapter-host.ts`)
- projection arrows (for the host factory and wiring modules)

The hubs are:

- `stage-shell-state`, `stage-shell-commands`, `stage-keyboard`, `stage-project-epoch`,
  `stage-adapter-host`
- `StageViewportRegion`, `StageCanvas`, `EditorHead`, `StageToolbars`, `StagePanels`
- `project-session`, `finish-authoring`
- the host factory, each wiring module, each feature entry and each sub-owner

The guard fails when a measure changes in either direction:

- **Growth.** The failure names the metric and says to move the responsibility to its owner, or to
  raise the recorded value in the same change. A raise is allowed, and visible in review.
- **Shrinkage.** The failure says to lower the record. This is the existing shrink-only pattern of
  `renderer-portability-boundary`.

This is not a size limit. Composition roots and entries get absolute contracts (§5.3) instead.

### 5.6 Negative controls

Every guard has controls built by mutating copies of the real files. Each mutation must yield
exactly the expected violation. To prove the guard catches responsibilities it has never seen,
every control uses fresh identifiers, not historical names. Separately, Appendix B's replay
re-runs every old synthetic control against the new guards.

| Guard | Mutation |
| --- | --- |
| CR | Insert `let quuxPanel = $state(false)` into the route. Add a `$effect` to the host. Add a 13-node projection arrow to a wiring literal. Add a compound `{#if}` to `WorldWorkspace`. Add a `<div>` not in `STRUCTURAL_ELEMENTS`. Import an unlisted `$lib` module into `WorkspaceHost.svelte`. Bind `onUndo` to an inline arrow. |
| EC | Add `$state` to an entry. Add a statement-bodied method. Runtime-import a sibling sub-owner from a sub-owner. |
| D1–D10 | Add a runtime import of a sub-owner to `stage-shell-commands.ts`. Make a feature import another feature's sub-owner. Add a new type-only core → feature import. Add an orphan module listed nowhere. Import shell-state types into a region component. Import an Appearance sub-owner into `FinishCardSection`. Import `stage/route/**` into an adapter. |
| AU, CO, RM | Call `createStagePressTracker()` from a sub-owner. Call `stageKeyAction(` from an entry. Call the epoch's `undo` from a region view. Mount `EditorCard` in a workspace. |
| Lifecycle | Implement `quux:reset` without a table entry. Add a table entry without an implementation. List one step twice. |
| Escape | Add a ladder rung handled by a non-owner, and a ladder row without a handler. |
| Regions | A `@ts-expect-error` type fixture in which a feature contributes another owner's key, or a key not in the table |
| Singletons | Call `nearWallCutaway.reset()` from Appearance (S1). Call `wallFace.reframe` from a new core module (S2). Add a reader without a consumer line (S3). |
| Compatibility | Add a phase call not in `COMPAT_PHASES`. |
| Hotspots | Add one getter to `stage-shell-state`. Remove one import from `stage-keyboard` (stale record). |

### 5.7 Where each rule lives

| Rule | Home |
| --- | --- |
| Dependency direction, authorities, composition-root and entry contracts, admission consistency, singleton and Card policy, hotspot ratchet | Executable guards (§5.1–§5.6). Failure messages link to the reference section below. |
| Workspace host, feature protocol, lifecycle and Escape ownership, how to add a capability (enduring) | `docs/reference/composition-execution.md`: replace "Route as composition root" (584) with "Workspace host and feature modules". Update the Interaction coordination paragraph of `docs/reference/architecture.md` (about 405–415) to name the ladder table. |
| Agent entry point | `apps/editor/AGENTS.md`: five lines saying where a capability goes, which tables it extends and which test proves admission, with a link to the reference. No policy is duplicated. |
| Studio rules | `apps/editor/src/lib/authoring/README.md` (Studio section): the Studio-is-a-feature sentence |
| Workflow | No change. There is no new process, label or gate. |

After replacement, these are retired:

- the blacklist sections of `spatial-route-boundary.test.ts`
- `authoring-controller-boundary.test.ts` (folded into the manifest)

Every other route-reading assertion is retargeted or replaced as Appendix B states. No assertion is
deleted before its replacement is green and its old negative control fails under the new guard.

## 6. Migration sequence (this pull request)

Rules for every step:

1. **Tests.**
   - Run the five route-mount suites unchanged at every step: `spatial-route-gesture` (121 cases),
     `-experience-homes` (55), `-source-replacement` (20), `-resume-save` (8) and `-viewport` (4).
   - Run the step 1 suites at every step.
   - Run `test:fast` and `test:arch`, one at a time.
   - No assertion in the route-mount or step 1 suites changes. Only a step's own string
     retargets are allowed, and they map one-to-one (Appendix B).
2. **One owner per step.** Each step moves one owner's code, together with its effects, lifecycle
   steps, rungs and region keys.
3. **Effect creation order is migration compatibility, not architecture.** Svelte runs the effects
   dirtied in one flush in creation order. During the moves (steps 4–12), the host therefore
   reproduces the base creation sequence (Appendix A), so each step changes one owner and the
   mounted suites prove that step alone.
   - Today a feature's creation points are not contiguous: Appearance has points at 582–683,
     1147–1233 and 2556–2565. A feature exposes the later groups as compatibility phases
     (`x.attachAlign()`, …). Each phase is listed in `COMPAT_PHASES` with its Appendix A row, and
     the host calls it once.
   - A base effect whose body spans owners is split in one of two ways:
     - An ordinary effect becomes adjacent per-owner effects, in body order, at the same position.
       Example: 1201 becomes the Appearance issue/drawer reset, then the core boot-repair reset.
     - A teardown becomes a lifecycle event: 1941 becomes `leaveProject`.
   - A feature that only sets a notice or calls a core command through a port is not mixed. An
     example is the Lift-space effect at 1814.
   - Step 13 removes every phase that mounted behavior does not need. The architecture's reactive
     semantics are then defined by mounted tests, not by source order. No guard checks creation
     order.
4. **Rollback.** Implementation commits revert as a unit.

| Step | Content |
| --- | --- |
| 1 | **Characterization**, green on the unmodified route, before any production change.<br>`spatial-route-lifecycle-order.test.ts` spies on the existing modules and pins:<br>- each §4.4 event's call order, including `historyStep`, `readingChange` and `settlePending`<br>- Head departure refusal and contextual **Show** gesture release share the same Stage session lens writer<br>- the full Escape ladder order with every rung active, and the prelude (Artwork, Preview gate, posture capture)<br>- session continuity across 5 lens round trips: StageCanvas mock mounted once; the same facade and history instance; `projectSession.load` called once; epoch `activate` unchanged<br>- **Undo/Redo cancellation**: with a live Finish Card gesture, Head Undo, Head Redo and the Studio Root panel's Undo each call `card.cancel` before the epoch's `undo`/`redo`; the gesture writes nothing; the history step runs once<br>- Undo/Redo after a lens round trip<br>- project switch and replacement: singletons reset, mirrors null, and nothing leaks into the next project<br>- Lift retains its active state and scope across World → Experience → World. Leaving World clears Slice and nulls its resolved pick mirror. Project replacement and teardown end both readings.<br><br>`spatial-route-reactive-semantics.test.ts` covers the co-triggered effects:<br>- For every pair of Appendix A effects with different owners, the implementer lists the reactive sources each reads (reads inside `untrack` excluded) and the state each writes.<br>- A pair is co-triggered when the two share a source, or when one writes what the other reads.<br>- Each co-triggered pair gets a mounted case. The case triggers the source and asserts both effects' observable outcomes, plus their relative order when one feeds the other.<br>- The minimum set is: selection change (582, 934, 1468, 1721), removal of the scoped Lift room from admitted geometry (1814), lens change (556, 564, 1955, 2556), Preview start (567, 1541), replacement and accepted (1201, 1230, 1233, 1735, 1935), tool change (649, 1230, 1964), Artwork placement eligibility on boot, lens, Preview or Unfold (1969) and project switch (1941).<br>- The pull request records the pair table.<br><br>Also record the base `integration-hotspots.json` (report-only), the §1.6 bundle sets and the §9 M/L spot run. |
| 2 | **Protocol.**<br>- Add `workspace/protocol.ts`, `lifecycle-order.ts`, `escape-ladder.ts`, `region-ownership.ts` and `lifecycle-runner.ts`.<br>- The route builds its existing chains through the runner, with inline step closures.<br>- The keyboard's `dismiss` case iterates `ESCAPE_LADDER`. Core rung bodies move verbatim; feature rungs are still route closures.<br>- The step 1 tests prove that table order equals today's order. |
| 3 | **Core modules.**<br>- Add the §4.2 core modules: route input, ready port, viewing, history command, window listeners, content bounds, look-through frame, cursor, core region views, core lifecycle steps, boot repair and panels, replace dialog.<br>- Narrow `StageAdapterServices` to `finishCard`.<br>- Replace the shell-command runtime imports with ports. |
| 4 | `light-inspection` feature |
| 5 | `layout-readings` feature, with singleton lifetime ownership |
| 6 | `sky` feature |
| 7 | `artwork` feature |
| 8 | `library` feature |
| 9 | `appearance` feature, with its sub-owners and region components. It is the largest step, and it may be committed as card/paint, import/library draft, and Align/repair/operations. |
| 10 | `studio` feature |
| 11 | `experience` feature. After it, the route keeps no feature logic. |
| 12 | **Workspaces and host.**<br>- Add `WorldWorkspace`, `ExperienceWorkspace`, `WorkspaceHost.svelte`, `createWorkspaceHost` and the wiring modules.<br>- The route becomes §4.7, and styles move.<br>- Compare re-render counts of the StageCanvas props, base versus branch. |
| 13 | **Remove compatibility phases.**<br>- Collapse one phase at a time into its feature factory, then run the mounted suites and the step 1 suites.<br>- Keep a phase only when a named mounted case fails without it. Record that case beside the phase in `COMPAT_PHASES`.<br>- For each surviving phase, open a follow-up issue to replace the order dependency with an explicit event or derivation. That replacement is not done in X9.<br>- The pull request lists each phase and its outcome. |
| 14 | **Guards.**<br>- Add the manifest and these guards, all enforcing: D1–D10, AU, CO, RM, CR1–CR5, EC, admission, singleton and Card policy, the hotspot ratchet, and the negative controls.<br>- Execute Appendix B: retarget or replace every listed assertion, then replay every old synthetic control against the new guards. Each must fail.<br>- Then delete the blacklist sections and `authoring-controller-boundary.test.ts`.<br>- Update `test-lanes.ts`. |
| 15 | **Promotion.** Make the reference and `AGENTS.md` edits of §5.7. Run the admission demo (§5.4) and record it. Delete this plan. |

## 7. Scope

**In scope:**

- route, host, workspace and feature extraction, into the sub-owners of §4.2
- the core modules listed in §4.2
- narrowing `StageAdapterServices.finishes`
- the `stage-keyboard` input shape and the `ESCAPE_LADDER` form of its dismiss case (same rungs,
  same order, same guards)
- `stage-project-epoch` callbacks → lifecycle
- removing compatibility phases where mounted behavior allows
- guards, the lane manifest, and the reference/`AGENTS.md` promotion

**Out of scope, unless a demonstrated correctness blocker requires it:**

- C4, U7 and any new capability
- UX changes and Studio promotion
- URL-addressed workspaces (R1)
- lazy Experience (#280)
- kernel, Camera, F4 or rendering changes
- converting module singletons to instances
- refactoring feature internals. These modules move or are composed as they are:
  - `finish-authoring.svelte.ts` (it gains a ratchet entry; its split is a follow-up)
  - `studio-controller`, `stage-unfold-gestures`, `light-look-through`
  - the Experience binding and controller
  - the adapters
- splitting `stage-shell-state` beyond single-owner getters
- keyboard decision logic outside the dismiss ladder
- a generic Canvas layer slot
- visitor/public modules

A **demonstrated correctness blocker** is a mounted test that cannot pass without the change. It is
reported to the owner before the change is made (§11).

## 8. Future navigation seam (R1: deferred)

X9 adds no nested route. These conditions keep URL-addressed workspaces a contained later change:

- The Stage session's `changeLens` stays the only lens writer. The facade delegates to it from
  the Experience binding. The Head's workspace switch uses the refusal-capable `leaveLens`
  event. Experience contextual navigation uses the binding directly and keeps its existing
  interruption behavior. A future workspace request can use the same seam as the Head.
- `WorkspaceHost` selects the workspace from one host member, and workspaces hold no state. A future
  `(workspace)/+layout.svelte` can therefore host `WorkspaceHost`, with thin pages that only request
  a workspace.
- Studio is a feature that workspaces mount, so becoming a third workspace needs no feature change.
- Nothing in X9 reads the URL path for the lens.

Taking up URLs later is its own owner decision. That decision covers URL names, reload and Back
behavior, the unsaved-work guard, the boot query parameters and the route test harness.

## 9. Verification

| Area | Evidence |
| --- | --- |
| Behavior | The step 1 suites plus the five route-mount suites, with unchanged assertions, at every step |
| Reactive semantics | `spatial-route-reactive-semantics` (step 1 pair table), green before step 2 and after steps 12 and 13 |
| Workspace transitions | World ↔ Experience with each live state:<br>- Align active: put back, or refusal holds the lens<br>- Studio pending task: refusal<br>- Material Editor or Import open: closes<br>- Lift retains active state and scope across the round trip<br>- Slice ends on leaving World and its resolved pick mirror is nulled<br>- Paint tray, Library, Spot Look-through and Preview: as today |
| Session continuity | One StageCanvas mount, one facade, history and project session across round trips (step 1 test). No persistence or reload traffic during switches, checked through the test's persistence mock and in browser QA network inspection. |
| Cancellation and Undo/Redo | The Escape ladder order test; the replacement and teardown order tests; the Undo/Redo cancellation cases; Undo/Redo across a lens round trip |
| Guarantees | Every Appendix B row green; every replayed old control fails |
| Lanes | `test:fast`, `test:arch` and `test:heavy` (one at a time), `npm run check`, `npm run build` |
| Eager client closure | `npm run perf:bundle -- --json` at the base and at the head, from clean builds. The complete `/project/[projectId]/spatial` cold-load set (§1.6) stays within +1% gzip of 1,428.7 KiB. `/`, `/editor`, `/projects` and `/p/[publicationId]` keep the same file counts and stay within ±0.5%. `perf:bundle:first-load` and the visitor forbid checks pass. |
| Lazy closure | The manifest walk of §1.6: the same dynamic-import entry modules, and within ±1% of 134.8 KiB gzip. Nothing moves from lazy to eager. |
| M/L editing performance | One `SPOT_REQUIRE_VERIFIED=1 npm run perf:spot` at the base and one at the head, from clean committed trees, against `npm run preview`, on the same machine at a similar load. It measures `grid-M` and `grid-L`: drag, pick, typed Length commit, pan and Undo. Editor time and presentation are reported separately. A median regression above 10% on M, or an L interaction that does not finish correctly, stops the work. Following D1, a run is not retried. A run that ends `incomplete` (the known 300 s accepted-result timeout, `measurements.md` E12) is recorded as unmeasured and reported to the owner. |
| Lens switching | The existing `stage:route-mounted` mark and `perfMeasureSync` signals, plus a `performance.measure` around five lens switches in a production preview, base versus head. Report medians; a regression above 10% stops the work. |
| Visual parity | Focused browser QA at desktop and iPad widths: World idle, Library, Paint tray, Align, Material Editor, Import, Repair drawer, Studio, Lift, Slice, Spot Look-through, Experience, Preview. Screenshots against production in the same state; no console errors. |
| CI | `merge gate`, `check guards`, `linux-x64` |

## 10. Acceptance criteria

- **Route.** `+page.svelte` satisfies CR1–CR5, imports only `ROOT_IMPORTS.route`, and has no
  forward references.
- **Host.** It has exactly one `late()` cell, satisfies CR4, and contains no logic. Its wiring
  modules satisfy CR4.
- **Features.**
  - Every block in §4.2 lives in its named sub-owner.
  - Every entry satisfies EC1–EC4.
  - D1–D10, AU, CO and RM hold with an empty violation list.
  - `TYPE_ONLY_CORE_TO_FEATURE` and `DOMAIN_TO_CORE` contain only pre-existing entries.
- **Lifecycle.**
  - Every §4.4 event and every `ESCAPE_LADDER` rung resolves through the tables.
  - The step 1 suites pass unchanged.
  - `COMPAT_PHASES` contains only phases whose named mounted case fails without them, each with a
    follow-up issue.
- **Shared state.**
  - Singleton calls obey S1–S4.
  - The Card section obeys C1–C4.
  - `stage-adapter-host.ts` imports no feature module.
  - `stage-shell-commands.ts` has no runtime feature imports.
- **Guarantees (R2).**
  - Every Appendix B row has its replacement green.
  - Every old synthetic control fails under the new guards.
  - Every new guard has at least one fresh-identifier negative control.
- **Admission demo.** The §5.4 demo is admitted with only the listed declarative entries in shared
  files. The pull request records the diffstat and the shared hunks.
- **Gates.** Bundle, M/L performance, lens switching, visual parity and CI as in §9.
- **Docs.** The reference and `AGENTS.md` are updated, and this plan is deleted before merge.

## 11. Risks and stop conditions

| Risk | Mitigation |
| --- | --- |
| Effect or lifecycle reorder changes behavior | Step 1 suites first, including the co-trigger pair table; the creation sequence is kept during the moves; explicit events where order cannot be kept |
| Removing a phase changes untested behavior | The pair audit gives every co-triggered pair a mounted case before step 2; a phase is removed only with those green; a doubtful phase is kept and recorded |
| The ladder conversion changes Escape precedence | Step 1 pins the full ladder with every rung active, before step 2; core rung bodies move verbatim; `EscapeContext` values are computed where today's code computes them |
| Scoped CSS breaks when markup moves | Styles move with their elements; parity screenshots; computed-style checks on moved surfaces |
| Getter spreading loses fine-grained tracking or adds updates | Spreads of getter objects stay lazy; StageCanvas prop re-render counts are compared base versus branch in step 12 |
| Wiring literals hide logic | The CR4 projection limit (12 nodes, a closed operator set) and the projection-arrow count in the ratchet |
| Singleton reset timing across project switch | Pinned by a step 1 test; owners keep today's timing |
| Large single pull request | Per-owner commits, each one green; implementation commits revert as a unit |
| Concurrent route edits | The C4/U7 hold; other route-touching pull requests wait for this merge |

**Stop and report to the owner, without improvising, if:**

- a route-mount or step 1 assertion would have to change
- a lifecycle or effect order cannot be preserved or made explicit
- Camera evaluation, F4 acceptance, input arbitration semantics, an adapter's behavior or a
  visitor/public module would have to change
- a demonstrated correctness blocker needs singleton conversion or a feature-internal refactor
- an existing guarantee has no replacement of equal or greater strength (Appendix B)
- the eager closure grows more than 1%, anything moves from lazy to eager, or a performance gate
  in §9 regresses
- a composition root or entry needs logic that CR1–CR5 or EC forbid and no owner fits (a protocol
  gap)
- the admission demo needs a non-declarative shared change

## 12. Flags and owner rulings

**Ruled (2026-11-24):**

- **R1 — URL-addressed workspaces.** Deferred. X9 is component-level World/Experience
  decomposition with the §8 seam and independent Studio ownership.
- **R2 — Guard replacement (Tier 2: removing a check).** Approved, conditional on preserving every
  existing architectural guarantee. Appendix B is the mapping. Step 14 deletes no old assertion
  until its replacement is green and the old controls fail under the new guards.

**Owner action — Hold.** `focus.md` still reads "Hold: none". The C4/U7 hold is recorded here and
in #413. The owner records it in `focus.md`; agents do not change that file.

**No further ruling is needed to start.** The owner reviews this revision. These defaults are
reversible, and recorded here:

- The hotspot ratchet allows recorded raises without owner approval.
- Singletons keep module scope, with one lifetime owner each.
- `finish-authoring.svelte.ts` is not split here.
- #280 stays `needs-ux`; nothing here makes Experience lazy.
- X9 adds no generic Canvas layer slot. A future feature's new ink kind is a reviewed core change.
- Compatibility phases are removed in X9 where mounted behavior allows (step 13). The survivors get
  follow-up issues.

## Appendix A — Base creation sequence (migration compatibility)

This is a migration record, not a contract. It lists the route's factory calls and route-level
`$effect`/`onMount` registrations at the base, in source order. `$derived` values are lazy and are
not listed. Steps 4–12 reproduce this sequence, so each step changes one owner. Step 13 then
removes every phase that mounted behavior does not need (§6 rule 3). The "phase" entries below are
the compatibility phases that exist at the end of step 12.

| # | Base lines | Creation points | Owner → host call |
| --- | --- | --- | --- |
| 1 | 224–254 | subject scope, API, auth, Stage session, proofs, analyses, light preview, scene pick, `pickThroughSlice`, verified images, finish tiles, asset leases | core |
| 2 | 296 | project epoch (`lifecycle: late()`) | core (`wireStageProjectEpoch`) |
| 3 | 337 | project session | core (`wireProjectSession`) |
| 4 | 387 | shell state | core (`wireStageShellState`) |
| 5 | 407–438 | Experience binding, Experience preview | `createExperienceFeature` |
| 6 | 494 | press tracker | core |
| 7 | 501 | light look-through | `createLightInspectionFeature` |
| 8 | 512 | viewport | core (`wireStageViewport`) |
| 9 | 556 | look-through frame effect | core `createLookThroughFrame` |
| 10 | 564–567 | light cancel effects (lens leave, Preview) | phase `lightInspection.attachGuards()` |
| 11 | 580 | selection view | core |
| 12 | 582–683 | Finish Card selection effect, paint tray state, paint tray reset effect, material import | `createAppearanceFeature` |
| 13 | 904–905 | panel rects, look authoring | `createSkyFeature` |
| 14 | 934 | Card-rename effect | core |
| 15 | 943 | shell commands | core (`wireStageShellCommands`) |
| 16 | 990 | Studio controller | `createStudioFeature` |
| 17 | 1147–1233 | finish authoring, issues reset effect, two library-draft effects | phase `appearance.attachAuthoring()` |
| 18 | 1242 | artwork interaction | `createArtworkFeature` |
| 19 | 1263–1282 | Unfold gestures, Slice draw | `createLayoutReadingsFeature` |
| 20 | 1292–1333 | input arbiter, keyboard | core (`wireStageInput`, `wireStageKeyboard`) |
| 21 | 1468–1814 | Unfold anchor, cutaway hold, resolved Slice, classification, selection hosts, cutaway mirror, plan parameters, Lift space effects | phase `readings.attachReadings()` |
| 22 | 1847–1919 | retry frame, Studio entry, Place copy, arm and creation effects | phase `studio.attachEntry()` |
| 22a | 1935 | Camera content-bounds effect | core |
| 23 | 1941 | leave-project teardown (mixed owners) | core `installLeaveProject(cell)` (§4.4 `leaveProject`) |
| 23a | 1955–1964 | lens-leave Slice exit, Slice-tool disarm | phase `readings.attachTeardown()` |
| 24 | 1969 | artwork cancel effect | phase `artwork.attachGuard()` |
| 25 | 2279–2334 | Wall Face camera port, Unfold camera executor | phase `readings.attachCameraPorts()` |
| 26 | 2362 | `onMount` (start and dispose tables) | core `installStageMount(cell)` |
| 26a | 2452 | Scope the Sky dial binding to the admitted adapter session and dispose the prior binding | phase `sky.attachSession()` |
| 27 | 2556–2565 | Align ownership, Align reframe | phase `appearance.attachAlign()` |
| — | — | lifecycle runner; `late()` set | core |

`library` has no creation points. Its factory runs at row 12, before Appearance consumes it.

## Appendix B — Old → new assertion mapping (R2 condition)

Each row is one old test case, or a group of route readings in one file. It names the guarantee,
the replacement, and how the replacement is at least as strong. Old means the base file; new
means the step 14 guard or the step 1 suite. **String retarget** means the same assertion, read
from the module that now owns the code, which AU or the manifest locates. Step 14 executes the
table. The pull request lists every old `expect` against its row.

### B.1 Authority uniqueness

| Old (file: case) | Guarantee | New | Strength |
| --- | --- | --- | --- |
| `spatial-route-boundary`: constructs the epoch and asset controllers (`createStageProjectEpoch`, `createStageAssetLeases`, `activate(snapshot)`, `markTornDown()`, `dispose()`, `artworkScope` getter) | One epoch and one asset-lease owner, driven by the composition root | AU: one construction site each, anywhere in `src/**`. CO: `activate`, `markTornDown` and `dispose` only from `core-lifecycle-steps.svelte.ts`, project-session and the epoch. The `artworkScope` getter is a string retarget in the epoch wiring module. | Whole tree, not route text |
| `spatial-route-boundary`: no second epoch, history or asset-lease owner (`OWNERSHIP_SITES`: acceptance host, adapter mount, adapter services, `session.replace`, model resolution, route `undo`/`redo` functions, artwork lease, subscriptions, adapter loop) | No second acceptance writer, adapter mount, replacement, model-resolution or history implementation | CO for each call form, with today's owners. CR1, CR2 and CR4 forbid functions, `let` and statements in every composition root. EC3 forbids them in entries. | Any module and any name; the old synthetic lines are replayed into the route, host, a workspace and an entry, and each fails |
| `spatial-route-boundary`: imports the controllers directly; no `host-acceptance` import; no executable `stage-adapter-host` import; one `createStageFacade` import | Composition is explicit; acceptance stays in the epoch | D4 and D5 (`ROOT_IMPORTS`; executable `stage-adapter-host` is not listed for any root). CO: `host-acceptance` only from the epoch and the adapter host. AU: `createStageFacade` has one construction site, the epoch's `createFacade` callback (today route 314; after X9 the epoch wiring module). | Applies to every root, not one file |
| `spatial-route-boundary`: composes the X3 controllers and four regions; each region exactly once; `hostTools: shell.hostToolOverlay` | One binding, shell state, shell commands, selection view, dock view and find view; each shell region mounted once | AU for the six factories. RM for the regions. `REGION_KEY_OWNER` gives `overlay.hostTools` to core, and the string is retargeted to `core-region-views.ts`. | Mount uniqueness across all roots and region components |
| `authoring-controller-boundary`: shares the route press tracker; no controller is a replacement or acceptance writer | One drag/click authority | AU: `createStagePressTracker` once. CO: `createStageAcceptanceHost` and `session.replace`. The three gesture owners keep `press` in their factory input type. | Same |
| `stage-shell-composition`: drives pose only through the host's inspection claim; no `.applyIntent(` | One viewing-intent owner, through the claim | Kept. The source set becomes the manifest's whole composed host: roots, core controllers, entries, sub-owners and region components. CO covers `requestViewingIntent`. | Larger source set |
| `stage-shell-composition`: one Canvas, one camera, no control object, Three importer list | One renderer, one realizer | Unchanged. It reads Stage files, not the route. RM adds `StageCamera` and `StageCanvas`. | Same plus mount sites |
| `stage-shell-composition`: measures the viewport in one place; the route never measures; `stageViewport.measure()`; no `requestAnimationFrame(tick)` | One viewport measurer | Kept on the larger source set. "Route never measures" becomes "no root, workspace, entry, sub-owner or region measures". `stageViewport.measure()` is a string retarget to `core-lifecycle-steps.svelte.ts` (`core:start-viewport`). | Larger source set |
| `stage-shell-composition`: binds the project read to the session (`importClosure([ROUTE])`, `constructsImportedOwner(ROUTE, …, createProjectSession)`) | A stale load cannot install | Kept. The closure from the route still reaches project-session. The construction proof moves to the AU site, and `constructsImportedOwner` is extended to `.ts` sources. | Same |
| `editor-host-no-write`: one `+page` in the host graph; the route calls no persistence; Save controller construction proof; `save={headSave}` | Only authorized write paths; one Head Save | The graph walk is unchanged, and its member set grows with the host. The construction proof moves to AU. `save={headSave}` becomes the `head.save` key, owned by core in `REGION_KEY_OWNER`, as a string retarget in `core-region-views.ts`. "Route calls no persistence" applies to every root. | Same, wider |
| `experience-shared-homes` and `playback`: one closed-by-default Guide owner; one playback owner; `createStageExperienceBinding({` in the route; `onPreview={` only at the route | One lens, one clock, one Preview entry | Owner searches unchanged, over the manifest source set. The route literal becomes AU. `onPreview={` is allowed only at the `EditorHead` mount site (RM: `WorkspaceHost.svelte`). | Same |
| `tests/helpers/import-closure.ts` `composedSpatialHost()` and `postureSources()` (they require route-text factory calls) | Host-wide negative checks cover the whole host | Derived from the manifest. They throw if a listed file is missing, or if a reachable `lib/authoring` module is unclassified (D7). | No silent shrink of the scanned set |

### B.2 Input ownership

| Old (file: case) | Guarantee | New | Strength |
| --- | --- | --- | --- |
| `spatial-route-boundary`: one input arbiter, keyboard, Unfold and Artwork owner; pointer delegation lines; `stageKeyboard.handleKey(event)` | Stage pointer and key events reach the one arbiter and keyboard | AU for the four factories. The delegation object is the core `viewport` key; it is a string retarget to `core-region-views.ts`, and its values are member references to the arbiter. CO: window `keydown`, `keyup` and `blur` listeners only in `stage-window-listeners.ts`, routing to `handleKey`/`handleKeyUp` and `windowBlur`. The gesture suite (98 cases, unchanged) drives these paths. | Positive owner, plus behavior |
| `spatial-route-boundary`: no second pointer, keyboard, Unfold or Artwork implementation (`X2_OWNERSHIP_SITES`) | No shadow gesture implementation | CR2 and EC3 forbid functions and handlers in roots and entries. CO: `stageKeyAction`, `stageKeyFromTextEntry` and `stageKeyFromControl` only from today's callers; the Artwork resize and placement planners only from `stage-artwork-interaction` and the artwork domain; the Unfold pick and opening-drag planners only from `stage-unfold-gestures` and the layout domain. | Any module; old synthetic lines replayed |
| `authoring-controller-boundary`: no controller imports the route; no forbidden indirect dependency; the epoch, asset and X2 owners keep their approved boundaries; the asset leases execute only two render owners | Controllers stay cohesive; none becomes a parallel owner | `APPROVED_BOUNDARIES` moves into the manifest unchanged for the six controllers, and the same `forbiddenIndirect` predicate is kept. The walk also runs from every entry and sub-owner (D2). | Same rules, more roots |
| `authoring-controller-boundary`: a forbidden edge behind an alias, barrel, namespace or dynamic import | The walker cannot be bypassed | Kept verbatim on the same `moduleBindingEdges` walker | Same |
| `stage-shell-composition`: every pointer capture goes through a guarded helper | A failed capture cannot strand a claim | Kept, with counts unchanged, on the manifest source set | Larger source set |
| `stage-shell-composition`: gesture contract (`setReading` interrupts the press after the lease policy; `createStagePressTracker()` in the route; pointer handlers in `stage-input`) | Refusals and every ending release once | The `setReading` slice is a string retarget to `stage-viewing.ts`. The tracker literal becomes AU. The `stage-input` and `StageViewportRegion` readings are unchanged. Step 1 adds the `readingChange` event order. | Same plus event order |
| `slice-press-refusal`: `sliceToolArmed:` wired from `shell.activeWorldTool === 'slice'` | A Stage press while Slice is armed is refused | String retarget to `wiring/stage-input.ts`, located by AU | Same |
| Keyboard ladder (no old test; the order lived only in code) | Escape precedence | `ESCAPE_LADDER`, with one handler per rung; step 1 pins the full order | New |

### B.3 Undo/Redo cancellation

| Old (file: case) | Guarantee | New | Strength |
| --- | --- | --- | --- |
| `spatial-route-boundary`: `onUndo={() => { finishes.card.cancel(); void stageEpoch.undo(); }}` and the same for `onRedo` (regexes on the route) | Every Undo/Redo entry drops a live Finish Card gesture before the history step, through the one epoch history owner | Four checks:<br>(a) `LIFECYCLE_ORDER.historyStep` = `appearance:cancel-card-gesture` → `core:run-history`.<br>(b) CO: the epoch's `undo`/`redo` are called only from `stage-history-command.ts`.<br>(c) CR5: every `onUndo`/`onRedo` binding in roots and region components is `history.undo`/`history.redo`. This covers Head and the Studio Root panel; the old regex covered Head only.<br>(d) The step 1 mounted cases: with a live gesture, Head Undo, Head Redo and Studio Undo each call `card.cancel` before the epoch, write nothing from the gesture, and run one history step. They are green on the unmodified route first. | Behavior instead of text; covers the Studio entry the old regex missed |

### B.4 Presentation dependency boundaries

| Old (file: case) | Guarantee | New | Strength |
| --- | --- | --- | --- |
| `spatial-route-boundary`: no old X3 presentation ownership in the route (`X3_OWNERSHIP_SITES`: lens construction and install; disclosure and task `let`s; selection and contribution projections; shell frame classes; Index, Card, Guide, Dock, Drafting, Scale and Height Sheet markup) | Presentation state and projections stay in their X3 owners; shell markup stays in regions | CR1 and CR2 forbid state, `let` and functions in every root. CR5 allows only components, single-member conditions and `STRUCTURAL_ELEMENTS`. RM: each of those seven components has one mount site, inside its current region. AU: `createExperienceLens` once, and CO: `install` once, both in the binding. | Any root, any name; old synthetic lines replayed |
| `spatial-route-boundary`: regions import no route owner (binding, shell state, commands, selection view, contribution view, lens, facade, project session) | Presentation never reaches a controller | D9, over core region components, workspace components, feature region components and Card sections, against every controller-layer module, at runtime and type-only | Larger forbidden set, more components |
| `stage-shell-composition`: one geometry set (`geometry: boot.snapshot.domain.geometry` in the route) | One compiled geometry reaches the Canvas | String retarget to the core `canvas.geometry` getter in `core-region-views.ts`. The other readings in the case are unchanged. | Same |
| `stage-shell-composition`: Card fade (`syncGestureFade` owner; `gesturing: shell.cardGesturing`) | The Card fades only for authored gestures | The owner search is unchanged, over the manifest source set. The binding is a string retarget to `core-region-views.ts`. | Same |
| `stage-shell-composition`: no plain "Nothing selectable there." | One empty-click wording | Kept, on the manifest source set | Larger source set |
| `stage-shell-composition`: pin creation (`shell.addHeightPin`, `onAddPin: shell.addHeightPin`; no `pinHintSeen`, `removeHeightPin` or `onRemovePin`) | Pin removal stays unexposed | The positives are a string retarget to `core-region-views.ts`. The negatives scan every root and `core-region-views.ts`. | Same, wider negatives |
| `stage-shell-composition`: constrained Index ends above the lower column; no `100vmax`; `class="editor-body"` with the `--lower-column-height` style | Lane variables sit on the body that holds the Index | The regex is a string retarget to `WorkspaceHost.svelte`; CR5 allows that template literal. The `100vmax` scan uses the manifest source set. | Same |
| `stage-shell-composition`: scrim stacking | z-order | Unchanged (it reads panels, toolbars and Card) | Same |
| `stage-grid`: `get contentBounds() { return paperContentBounds; }` in the route; no `candidateBounds` in the host | The workspace reads committed geometry only | String retarget to the `canvas.contentBounds` getter. The negative scans the manifest source set. | Same |
| `scene-pick-hidden`: `pickVisibleFace: pickVisibleFaceThroughSlice(scenePick, () => resolvedSlice)` in the route | Artwork placement picks through the Slice | String retarget to the Artwork entry's construction of `createStageArtworkInteraction`. `resolvedSlice` becomes the `layout-readings → artwork` port. | Same |
| `slice-lifecycle`: `interiorLift.clear()` and `sliceReading.clear()` at the teardown and reset anchors; Slice cleared and mirror nulled on leaving World; `setResolvedSlice(null)` at least twice | Project replacement and teardown end Lift and Slice. Leaving World ends Slice and clears its pick mirror. Lift keeps its active state and scope across the lens round trip. | `LIFECYCLE_ORDER`: `resetPresentation` and `leaveProject` contain the `layout-readings` steps in order. S1: only `layout-readings` calls `clear` and `setResolvedSlice`. Step 1 mounted cases: replacement and teardown clear both readings and null the resolved mirrors. Leaving World clears Slice and its pick mirror. A lens round trip preserves the active Lift and its scope. | Behavior instead of source counts |
| `presentation-tokens`: the route is in the token-checked file list | Moved markup keeps the shell tokens | The list adds every component that receives route markup or styles: `WorkspaceHost`, both workspaces, the feature region components, `StageBootPanels` and `StageReplaceDialog`. The route stays listed. | Wider |
| `stage-shell-composition`: adapters reach Stage modules only through the adapter host | The domain adapter seam | Kept (A1). Its future-consumer scan adds `workspace/**`. | Same, wider |
