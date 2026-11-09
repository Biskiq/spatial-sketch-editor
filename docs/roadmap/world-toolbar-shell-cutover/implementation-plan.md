# World toolbar and shell cutover — implementation plan

**Status:** draft plan; first commit of the work's draft PR. No production change is authorised by
this document. PR #285 (`6d30ccc2`, “Design study: World creation tools and the Living Draft
identity”) is the design donor, not a production contract. The prototype says so itself:
[`prototypes/world-creation-tools/README.md`](../../../prototypes/world-creation-tools/README.md)
is “the donor, not a plan”.

**Delivery shape:** one draft PR on `plan/world-toolbar-shell-cutover`, one plan commit followed by
separate implementation commits. No stacked PRs and no second PR for the capability work. The PR
stays draft until the owner has reviewed the real editor visually and accepted the cutover. Do not
merge it as part of this plan.

## Goal

Replace the World lower edge, Head, Card and Index presentation with the Living Draft shell from
#285, and bring the complete proposed World toolbar into the real editor — including capabilities
that are not implemented yet. Existing authoring is wired into the new interaction grammar without
creating a second geometry, selection, history, Camera or persistence system. Subsequent T1/T2/T5
commits then replace placeholders behind the same presentation.

The end state is a visually faithful, fully populated World toolbar in the actual editor: eight
labels, a fixed 656 × 164 instrument, the parchment plate, contextual palettes, Library, Sky, the
Living Draft Head and Card, and honest placeholders where the domain cannot yet keep the promise.

## What #285 actually specifies

The measurable reference, taken from the prototype rather than from memory:

| Element | Reference |
| --- | --- |
| Lower instrument | 656 × 164 px: 40 px words row + 62 px pictures strip + 62 px dock; bottom 14 px; radius 16; `width: min(656px, 100% - 24px)` |
| Phone | ≤ 560 px: width `100% - 16px`, dock 56 px, total 158 px, 9 px key labels |
| Plate | parchment with grain; words row 40 px; pictures strip 62 px; internal horizontal scrolling with a 44 px fade on the side that continues; no page overflow |
| Dock | forest; eight equal-width keys; separators after Select, after Furnish, before Library; armed key is a parchment tab with `border-radius: 0 0 11px 11px`; family dots are 4 px |
| Type | Fraunces display, Instrument Sans UI, DM Mono labels. Exact families, sizes, weights and variable settings come from `prototypes/world-creation-tools/styles.css` |
| Colour | Living Draft token set in `styles.css` `:root`; forest chassis, parchment plate, ink, moss, terracotta, ochre, gold and cobalt. Exact values are lifted from that file, not approximated here |
| Head | two floating forest pills, 46 px high, radius 14; left identity/history, right view cluster plus Sky; at ≤ 860 the right pill becomes a second row |
| Card | parchment, 320 px wide, radius 14; mono kind label, Fraunces name, owner pill, facts, actions |
| Sky | 336 px popover; four-column presets, hour slider, sun arc; each authored hour change is one undo step in the prototype |
| Interaction | click only; no hover tooltips or hover menus; nouns get words, variants get pictures; nothing resizes when the tool changes |

The prototype’s top control strip is prototype chrome, not proposed UI. Its readout and Spec drawer
are evidence, not production surfaces.

Captured reference frames at 1100 × 720, 1440 × 900 and 390 × 844 exist locally for the comparison
step but are not committed. The prototype can be run with:

```sh
python3 -m http.server 8840 --directory prototypes/world-creation-tools
```

## Current shell: reuse, replace, adapt

| Area | Current owner | Decision | Seam |
| --- | --- | --- | --- |
| Head | `apps/editor/src/lib/authoring/stage/shell/EditorHead.svelte` and the route | **Keep behaviour, replace presentation.** Restyle in place; add the Living Draft view cluster and Sky. Do not create a second Head. | Project menu, lens, Find, Undo/Redo, Save, Preview and source replacement keep their existing props and owners |
| Dock | `StageDock.svelte`, `stageDockKeys()` | **Replace in World.** The old order (`Select · Ink · Slice · Erase · Brush · Measure · Objects · Library`, including two unavailable disclosures) becomes eight registry-driven keys. | New `WorldDock.svelte`; remove the World mount of `StageDock`; keep the component only if another lens still uses it |
| Palette | `StageInstrumentHost.svelte` in `presentation: 'palette'` mode | **Replace the palette surface, keep the instrument host.** The plate is a new component; `StageInstrumentHost` remains the home for invoked procedures such as Import, My Objects and precision entry. | New `ToolPlate.svelte`; do not stretch the old 42 px palette or 480 px instrument into the fixed plate |
| Lower column | route `.lower-column` CSS | **Replace geometry.** Fixed instrument; keep the measured Height Sheet lane and invoked instruments above the plate. | `column-reverse` stays; the plate and dock become one fixed-size child |
| Card | `EditorCard.svelte` | **Keep the one writer and its actions; restyle and re-measure.** | Add the owner label from the selected subject’s adapter, not from the armed tool |
| Index | `EditorIndex.svelte` | **Keep (it is not in #285), restyle subordinate.** It remains the canonical locator and collapses to no width. | Living Draft parchment/ink; no second navigation surface |
| Reading and view preferences | `StageDraftingControl.svelte` in `.stage-actions` | **Relocate into the Head.** 3D/Plan becomes a first-class control; grid, snap, paper/shaded, sheet side and motion preferences move into a compact View popover. | Reuse the existing component and props; delete the duplicate `.stage-actions` mount |
| Environment | `StageEnvironmentControl.svelte` | **Replace with Sky.** Presets keep their current data and persistence semantics. | New `SkyControl.svelte`; hour and arc are planned until the Scene environment owns an authored hour |
| Height Sheet | `StageHeightSheet.svelte` and route lane measurement | **Keep.** #285 does not show it; existing authoring needs it. | Preserve lane insets; centre the fixed instrument in what remains |
| Selection | canonical `selection`, Card writer, adapter actions | **Keep.** The selection plate is a second presentation of the same actions, never a second writer. | `ToolPlate` reads the same action records; no new selection store |
| History | `StageAcceptanceHost` / `history()` / `undo()` / `redo()` | **Keep.** No new history. | Placeholders cannot commit; plate actions run the same adapter action records |
| Camera | one `StageCamera` authority | **Keep.** Head controls call the existing `setReading`; no new pose/FOV state. | No Camera changes in this cutover |
| Experience | `ExperienceDock.svelte`, `ExperienceGuide.svelte` | **Keep separate.** The World toolbar mounts only when `lens === 'world'`. | Shared tokens and shell primitives only; no merged dock |
| Save / load | `HeadSave`, project session, `ProjectLifecycleActions` | **Keep.** Save status and Preview stay truthful. | Head restyle only; no persistence change |
| Stage marks | proposal, selection, refusal, measurement | **Keep.** #285’s blue-pencil tokens are an interaction presentation, not a new renderer. | No geometry or mark rewrite in the shell commits |
| Tests and browser flows | `apps/editor/tests`, `apps/editor/perf/flows` | **Update selectors and key expectations.** | The old shell’s `data-stage-dock`, `data-dock-tool`, `paletteOpen` and dock-order assertions are replaced, not aliased indefinitely |

## Ownership and non-negotiables

1. **Layout, Scene, Camera and Experience keep their authorities.** The toolbar is a capability
   placement description and a presenter; it never plans geometry, mutates a document, evaluates a
   route or stores an authored fact.
2. **One selection.** The plate, Card and Index resolve the same canonical subject. The Card remains
   the one writer for ordinary facts.
3. **One history.** Every landed plate action calls the existing adapter action record. Placeholders
   never create an acceptance, an undo step or a selection change.
4. **One Camera.** 3D/Plan, Fit and Measure use the existing stage services. The cutover adds no
   navigation graph, pose store or evaluator.
5. **One Save.** Save, load, source replacement, conflict/reload and Preview keep their current
   state machines and reasons.
6. **Experience is not merged into World.** It keeps its own dock and Guide; only shared tokens and
   primitives are reused.
7. **No visitor leakage.** Nothing in `world-toolbar/` may be imported by `visitor/*` or the public
   surface. The existing isolation and architecture gates must stay green.
8. **No second capability registry.** The new registry describes presentation and placement. It
   resolves landed actions through `StageFacade` entries; it does not declare tasks, planners or
   domain capabilities of its own.
9. **No fake functionality.** A planned entry is labelled, focusable for its reason, and inert. It
   never opens a task, changes the Stage cursor, writes a document or reports success.
10. **Click only.** No hover tooltip, hover menu or guidance sentence in the toolbar. Labels are
    visible or accessible; reasons live in the plate.

## Capability truth table

`landed` means the current tree can do it. `partial` means a real subset exists but the #285 control
goes further. `planned` means the control is fully drawn and clearly unavailable. This table is the
input to the registry and the acceptance tests.

| Dock / tool | Current reality | Cutover disposition | Later owner |
| --- | --- | --- | --- |
| Select | Landed: canonical selection, Card, drag marks | Wire; selection plate | — |
| Build · Walls | Partial: Layout Ink straight Wall chains as Line or Box; exact thickness/height; typed X/Z; Finish/Close/Backtrack | Wire; shape Line/Box; heights and exact entry under More; Arc, Circle and roof offer planned | T1 |
| Build · Opening | Partial: door/window, rectangular/rounded/pointed, exact width/height/sill, host offset | Wire; Kind Door/Window; profile and exact measures under More; arch, round, niche and wide planned | T1 |
| Build · Stair | Planned | Placeholder; palette complete | T1 with Levels |
| Build · Building | Planned | Placeholder; definition/storey palette complete | T5 placed structures |
| Form · Form | Planned: no draw-a-solid stage gesture | Placeholder; shared shape and size groups complete | T2/T5 |
| Landscape · Ground, Water, Path, Plants | Planned; no owner ruling | Placeholders; no implementation until the owner is named | Owner decision |
| Furnish · Objects | Landed: Place task, catalogue assets, native primitives, My Objects, import, exact initial position | Wire; shelf/recent items; size/finish only where the existing placement session supports them, otherwise planned | T2 |
| Furnish · Lights | Planned | Placeholder; fixture categories complete | T2 |
| Paint | Planned: Brush is approved but not landed | Placeholder; five recent material swatches and All → Library Materials are visible; no paint stroke | T2 |
| Erase | Landed: Eraser task and its own clear/filters | Wire; keep its existing filters and clear behaviour | — |
| Measure | Landed: Measure task | Move to the Head; palette in the plate | — |
| Slice | Planned | Placeholder in the Head | T1/T2 |
| Library | Partial: Objects, My Objects, Import, Materials; no single plate mode | Adapt into Library mode; real categories and tiles; Manage/Import opens the existing instrument | T2/T5 |
| Sky | Partial: environment presets; no authored hour | Presets wire to the existing environment control; hour and sun arc planned until Scene owns them | T2 Scene environment |
| 3D / Plan | Landed | Wire to the existing reading command | — |
| Living / Paper | Partial: paper/shaded viewing state, no full render profile | Wire as a viewing preference using existing state where it is truthful; otherwise mark the segment planned. Never persist it as an authored world change. | T2 render profile |
| Undo / Redo | Landed | Keep | — |
| Save / Preview | Landed | Keep in the Head | — |
| Experience | Landed | Keep separate | — |

### Placeholder grammar

A planned tool is a complete visual member of the toolbar:

- the dock key is drawn at full size with a hollow availability dot and an accessible
  `“<Tool> — planned for <T1/T2/T5>”` name;
- clicking it arms the family/tool **for inspection**: its words and picture options are rendered,
  its primary options are `aria-disabled` and focusable, and the plate carries a visible
  `Planned · T1` (or T2/T5/owner) label;
- clicking a disabled option announces the reason in a live region; it does not open a task, arm a
  Stage cursor, alter selection or create history;
- Esc returns to the previous landed tool or Select;
- no placeholder is ever styled as selected in a way that suggests an edit exists.

This is deliberately more useful than a hidden key: the owner can review the whole proposed
experience in the actual shell, then prune or promote entries.

## Interaction specification

### Dock and family memory

- Order: `Select | Build  Form  Landscape  Furnish | Paint  Erase | Library`.
- Clicking a family arms the tool last used in that family. Session memory only; not serialized.
- Clicking a tool word arms that tool. Its family key stays armed and its word is underlined in the
  family accent.
- Clicking the already-armed family key does nothing; the fixed plate never folds. There is no
  collapse caret in the plate. Invoked instruments still close.
- Dots under a family key show its tool count and which tool is current. Direct keys have no dots.
- Library is a mode: its key is armed parchment; the previously armed family is `held` (translucent
  parchment on forest). Clicking a family while Library is open leaves Library and arms that family.
  Clicking Library again returns to the previous tool.

### Plate modes

| Mode | Words row | Pictures strip |
| --- | --- | --- |
| Tool | family tools; armed word underlined | option groups for the armed tool; group label names the current choice |
| Selection | gold pip, selected name, canonical kind | existing action records; planned actions disabled; property-like choices stay in the Card |
| Library | Library kinds; close control | catalogue tiles, swatches or rows |
| Planned | tool/family words plus `Planned · <area>` | complete groups, disabled |
| Empty Select | “Nothing selected” | no invented actions; quiet instruction only where needed |

- **Selection plate only while Select is armed** (or the selection was made with Select). A drawing
  tool keeps its own palette; the Card still updates on selection. This prevents the plate from
  hiding tool options mid-draft.
- Selection actions are the same records the Card’s ⋯ list uses. Actions that do not exist yet are
  planned, not locally faked. “Roof a room”, “Turn”, “Duplicate”, “Replace from Library” and “Save to
  Library” only appear as landed when their owner supplies the action.
- Property-like choices (roof style, storeys, wall height) remain Card writers unless the owning
  domain exposes a true action. The plate must not become a second writer.
- Library tiles read the existing catalogue sources: `apps/editor/src/lib/content/assets.ts`,
  materials, and the Scene My Objects library. Import and management open the existing instrument
  above the plate; the plate stays visible.
- The plate is never a command bar: no Apply, no procedure steps, no guidance prose.

### Head

The two-pill Living Draft Head keeps every current app action:

- **Left pill:** Index toggle, leaf/mark, project name (existing menu: rename, delete, source
  download and replacement), World/Experience lens, Undo/Redo, Find (`⌘K`), Save status.
- **Right pill:** 3D | Plan, Living | Paper, Measure, Slice (planned), Sky chip, View settings
  (existing grid/snap/paper/shade/sheet/motion controls), Preview.
- Project load/source replacement stays on the existing project menu and route seam.
- Responsive: ≤ 860 the right pill becomes a second row; ≤ 560 the brand word, project tag and
  non-critical view labels collapse, but Save, Preview, lens and Undo/Redo remain reachable. The
  right pill must not cover the Stage’s start card or the Card.
- No hover tooltips. Accessible names carry the shortcut; the Keys reference carries the full map.

### Sky

- Chip shows the current hour (or the current preset’s representative hour) and opens a 336 px
  parchment popover.
- Presets map to the existing environment control and keep its current persistence and history
  semantics. The popover does not invent a second environment store.
- Hour slider and sun-arc drag are drawn at full fidelity. Until Scene environment owns an authored
  hour, they are `Planned · T2` and inert. When T2 lands, each hour change is one typed intent and
  one undo step, not a session-only tweak.
- Esc closes Sky as the second rung, before selection.

### Keyboard and Esc

Existing keys are preserved unless listed. The canonical new map:

| Action | Key | Note |
| --- | --- | --- |
| Select | V | existing |
| Walls | W | P remains a legacy alias for Walls while Path is planned |
| Opening | O | |
| Stair | T | planned tool; key arms its inspection plate |
| Building | B | planned tool |
| Form | D | planned tool |
| Ground / Water / Path / Plants | G / A / P / N | landscape placeholders; P is not used until the Walls alias retires |
| Objects | F | Fit moves to `Shift+F` and the Head’s Fit control |
| Lights | — | planned; no key until T2, because L remains Library |
| Paint | C | planned tool |
| Erase | E | existing |
| Measure | M | existing; now in the Head |
| Library | K, with L as the existing alias | both open Library |
| Shapes | 1–6 | 1 Line, 2 Arc, 3 Box, 4 Circle, 5 Freehand, 6 Outline, **while a drawing tool is armed** |
| Readings | 2 / 3 | still Plan/3D when no drawing tool is armed; the same key never has two meanings in one context |
| Fit | Shift+F | plus Head control |
| Size | [ / ] | while a size-capable tool is armed |
| Finish / Backtrack / Delete | Enter / Backspace / Delete | existing |
| Dismiss | Esc | see ladder |

The key map is one table in the registry; `stage-input.ts` consumes it. Text-entry and control
guards stay exactly as they are. Tests must cover both contexts for 2/3, the legacy P/L aliases, and
the F/Shift+F split.

**Esc ladder** (one ordered function, deepest first):

1. cancel the live draft/proposal;
2. close Library or Sky;
3. dismiss amend/consequence tokens;
4. clear selection;
5. close the open disclosure or invoked instrument and restore the armed tool’s default plate;
6. return to Select.

The existing destructive disclosure and press interruption order remains ahead of this ladder. No
second Escape handler is added in a component.

## Code shape

New shell-owned modules under `apps/editor/src/lib/authoring/world-toolbar/`:

| File | Responsibility |
| --- | --- |
| `registry.ts` | Typed capability placement: families, tools, keys, option groups, library kinds, availability, owner, planned area and reason. The single source for dock/plate/Sky/Keys |
| `bindings.ts` | Resolve landed tools to the existing `StageFacade` entries/task kinds/action records. Missing binding makes a tool unavailable with a truthful reason |
| `toolbar-model.ts` | Pure view model for the plate: mode, words, groups, selection actions, empty state. No adapter imports |
| `library-model.ts` | Adapt existing catalogue sources into library kinds/tiles; no new content store |
| `WorldToolbar.svelte` | Fixed instrument: plate above dock |
| `WorldDock.svelte` | Eight keys, family memory display, separators, held/armed/planned states |
| `ToolPlate.svelte` | Words row, pictures strip, scrolling masks, selection/library/planned modes |
| `world-icons.ts` | Port the #285 icon paths into the existing `ShellIcon` names; one icon set, no prototype JS import |
| `sky.ts` | Preset data/adapters for the existing environment control; no renderer |

Modified:

- `EditorHead.svelte`: Living Draft markup/CSS and the view cluster; keep props, lifecycle, Find,
  Save, Preview and project actions. Add `HeadViewCluster.svelte` if the markup would bloat it.
- `EditorCard.svelte`: Living Draft presentation; keep identity, facts, actions, writer and menu.
- `EditorIndex.svelte`: Living Draft presentation; keep model and collapse semantics.
- `StageDraftingControl.svelte`: presentation inside the Head View popover; keep the same state.
- `StageEnvironmentControl.svelte`: replace its rendered chip/panel with Sky; reuse its preset data
  and environment calls.
- route `spatial/+page.svelte`: mount `WorldToolbar`; remove the World `StageDock` branch and
  `paletteOpen`; keep `taskHost`, invoked instrument, selection/Card wiring, Save/Preview, Experience.
- `stage-input.ts`: consume the registry shortcut table; return a generic tool id; keep one
  keydown owner.
- `stage-contributions.ts`: delete `StageDockKey`/`stageDockKeys()` from the World path (or keep only
  for non-World consumers); keep `stageDockTools` as the facade query used by bindings/Find.
- `presentation-tokens.css`: scoped `[data-shell='living-draft']` shell roles, family accents and
  font roles. `--stage-*` is not overridden.
- `static/fonts/` + `app.html`: vendored Fraunces, Instrument Sans and DM Mono WOFF2 with licences
  and preload; no runtime Google Fonts.
- `docs/reference/design-system/editor-shell-and-visual-system.md`: update only after the owner
  accepts the visual result. This is a Tier 2 approved-design change.

No domain adapter, planner, Camera, persistence or visitor file is edited by the shell commits.

## The single PR: commit sequence

Every commit is a review boundary and must leave the tree usable. The final PR gate is the complete
repository contract; intermediate commits run the affected focused checks plus `check` and `arch`.
No commit stages the plan’s local screenshot artifacts.

### Commit 0 — this plan

- Add this document only.
- Run the documentation/architecture gate, not product suites.
- Owner reviews the plan in the draft PR; implementation starts only after the plan is accepted.

### Commit A1 — Living Draft roles, fonts and icons

- Scoped shell tokens, vendored fonts/licences, grain, family accents, icon paths.
- No mount yet; no behaviour change.
- Acceptance: existing surfaces outside the editor are unchanged; `--stage-*` paint is unchanged;
  font fallbacks remain readable if a font fails.

### Commit A2 — registry, bindings, toolbar model and tests

- Add the typed registry, binding resolver, selection/library models and unit tests.
- No mount yet.
- Acceptance: every tool has an availability, owner and reason-if-planned; every landed tool has a
  binding; ids, keys and option ids are unique; no adapter/planner imports in shell modules.

### Commit A3 — Head, Card and Index presentation

- Restyle the existing components in place; add owner labelling to the Card; keep behaviour.
- Keep the old dock and `.stage-actions` mounted until A4, so authoring stays reachable.
- Acceptance: project menu, lens, Find, Undo/Redo, Save, Preview, Card writer/actions and Index
  collapse are unchanged; the World layout still works at 1440/1100/390.

### Commit A4 — World toolbar cutover and existing capability wiring

- Mount `WorldToolbar`; remove the World `StageDock`/`paletteOpen` path and the old `.stage-actions`
  reading/environment controls; move 3D/Plan, Measure, Slice and Sky into the Head.
- Wire Select, Build/Walls, Build/Opening, Erase, Furnish/Objects and Library entry; all other
  entries render as complete planned plates.
- Keep the invoked `StageInstrumentHost` above the plate for Import, My Objects and precision.
- Acceptance: every landed World capability is reachable and behaves as before; no duplicate
  selection/history/Camera; placeholders are inert; the instrument is fixed-size.

### Commit A5 — Library, selection plate, Sky and input grammar

- Library mode over the same catalogue; selection actions from the same records; Sky presets;
  family memory, held/armed states, full key map and Esc ladder; accessibility and focus order.
- Acceptance: Library placement/import/My Objects still work; selection actions produce one history
  step; Sky presets keep their existing semantics; key and Esc tests pass; no hover tooltips.

### Commit A6 — browser visual comparison and polish

- Add the manual Playwright visual comparison and measurement spec; capture the editor and #285 at
  1440 × 900, 1100 × 720 and 390 × 844; fix the deltas; record intentional differences.
- Owner reviews the real editor side by side with the prototype. This is the prune checkpoint before
  any T1/T2/T5 work.

### Owner checkpoint — after A6

The owner accepts, prunes or changes entries before capability implementation. Possible outcomes:

- an entry is removed because the family/verb does not hold together;
- an entry is promoted earlier because its domain already supports it;
- an adaptation (Index, Height Sheet, Save/Preview in the Head) is changed;
- the fixed dimensions or breakpoints are adjusted for the real app.

Registry entries make a prune one descriptor plus its plate group, not a shell rewrite.

### T1 — Layout capability commits

After A6 acceptance, in the same PR:

- Walls: Arc/Circle where Layout supports them; bending; roof offer and accepted Layout Roof.
- Opening: arch, round, niche, wide; multiple kinds in one plate.
- Stair: with Levels.
- Roof/turn/duplicate/replace selection actions as Layout actions.
- Building stays planned until T5 placed structures.

Each commit flips one registry availability from `planned` to `landed`, adds the typed planner and
tests, and does not edit the shell. The placeholder visual is replaced by the real palette in the
same descriptor.

### T2 — Scene capability commits

- Form drawing and its shared shape keys; Object shelf/rows, size/finish; Lights; Paint and real
  material application; library content.
- Sky hour as authored Scene environment: one typed intent, one undo step; sun arc.
- Living/Paper full render profile if it needs renderer work.
- Scene selection actions (turn, duplicate, replace, save to Library) where Scene owns them.

### T5 — Expressive geometry commits

- Building definitions and placed structures; saved forms and Studio; Library definitions.
- Replace the corresponding Build/Library placeholders without shell edits.

### Landscape

No implementation commit until the owner names the domain owner and the first gesture. The dock key
and complete planned plate remain visible in the meantime.

## Acceptance criteria

### Visual and geometry

- At ≥ 561 px: instrument exactly 656 × 164 (allow ±1 px), rows 40/62/62, bottom 14, radius 16.
- At ≤ 560 px: width `100% - 16px`, dock 56, total 158, labels 9 px; no page horizontal scroll.
- Eight equal dock keys; separators in the specified positions; armed key parchment tab; held
  family translucent; planned dot hollow; active underline 2 px in the family accent.
- Plate and dock never resize across tool, selection, Library, planned or empty modes; long strips
  scroll inside with the correct fade and keep keyboard focus visible.
- Fraunces/Instrument Sans/DM Mono are actually loaded; the computed families match; fallbacks do
  not change the plate’s geometry.
- Head pills, Card and Index use the scoped Living Draft roles; no literal colour copies in
  components.
- Card is 320 px at wide widths, within the viewport at narrow widths, and never covers the plate.
- Height Sheet lane is respected; the instrument centres in the remaining Stage; Index open/closed
  does not put the instrument under the Index.

### Capability truth

- Every dock key, tool word, option and library kind has an explicit availability.
- Every planned item has an owner, planned area and reason; none dispatches a task, acceptance,
  selection or history entry.
- Every landed item resolves to the existing facade entry/action and retains its current behaviour.
- No placeholder uses success language, fake geometry or a fake undo step.

### Existing workflows

- Select/Card, Wall Line/Box, Opening door/window, Erase, Measure, Objects placement, Import, My
  Objects, Undo/Redo, Save, source download/replacement and Preview all work after A4/A5.
- 3D/Plan, Fit, Camera navigation and Experience lens/dock/Guide are unchanged.
- Save conflict/reload, loading and project lifecycle keep their existing states and reasons.
- One selection, one Card writer, one history, one Camera, one Save. No duplicate stores.
- Visitor/public isolation and editor-helper boundaries remain green.

### Interaction and accessibility

- Family memory, tool words, Library held state, selection plate, Sky, keys and Esc ladder behave as
  specified.
- Click only; no hover tooltip/menu; every toolbar control has an accessible name, state and
  shortcut; focus order is dock → plate → invoked instrument, matching reading order.
- Planned options are focusable for their reason, not merely invisible; live-region announcements
  are quiet and non-duplicative.
- Touch targets reach the existing 44 px coarse-pointer minimum; the plate remains usable at 390.
- Reduced-motion preferences are respected by any toolbar transition; motion does not gate state.

### Visual comparison

The browser comparison is a review instrument, not a CI baseline. The repository has no browser
baseline recorder and this plan does not reintroduce one.

- A Playwright flow captures the production editor and the #285 prototype at 1440 × 900,
  1100 × 720 and 390 × 844 for: Select empty, Select with a room selection, Build/Walls,
  Build/Opening, Furnish/Objects, Paint planned, Library/Objects, Library/Materials, Sky open, Plan,
  3D and a constrained narrow view.
- It writes screenshots, a measurements JSON (bounding boxes, computed families/colours) and a
  side-by-side `index.html` gallery under the ignored perf results directory. Nothing is committed.
- Geometry checks are ±1 px where the reference is measurable. Intentional deltas (app actions in
  the Head, Index, Height Sheet, Save/Preview) are listed in the gallery manifest and approved by
  the owner.
- The owner inspects the real editor before any placeholder is pruned. Tests alone do not satisfy
  this criterion.

## Checks

- **Plan commit:** documentation and architecture gates only; no fabricated product runs.
- **Implementation commits:** `npm run check`, the affected Vitest contracts, `npm run test:arch`
  and the affected browser flows; `npm run build` at the cutover commit.
- **Final PR gate:** the repository’s complete merge-gate contract, including `npm test`,
  `npm run test:heavy`, `npm run build`, the package checks and any required API lane. No skipped
  check counts as green.
- **New unit contracts:** registry invariants; binding resolution; toolbar view model; library
  mapping; key map/Esc; Card/selection identity; architecture boundary for `world-toolbar/`.
- **Browser contracts:** landed tools still arm/finish/undo; placeholders do not; Save/Preview/lens
  still work; fixed geometry and no overflow; visual comparison capture.
- **Flows to update:** every spec or test locating `data-stage-dock`, `data-dock-tool`, the old dock
  order, `paletteOpen`, `Select · Ink · Slice · Erase · Brush · Measure`, or the old `.stage-actions`
  reading controls. Search before editing; do not leave a second selector map.
- **Existing open issues to respect:** #273 (perf flows still locate the removed ☰ menu and the
  Stage’s Open source JSON) and #284 (Height Sheet entry/pin removal TBD). Neither is fixed by this
  plan; avoid making their browser flows worse.

## Risks, flags and owner decisions

| Risk / decision | Handling |
| --- | --- |
| **Tier 2:** this changes the approved shell design and adds font assets/licences | Owner review before implementation; references updated only after acceptance |
| **New fonts** | Vendor WOFF2 with OFL licence files; no runtime font CDN; fallbacks keep the shell readable. If the owner declines the assets, use the closest existing families and accept a recorded fidelity gap |
| **#285 has no Index or Height Sheet** | Keep both, restyle subordinate. This is an intentional adaptation, not a silent omission |
| **Save/Preview/Find/lens are not in #285’s Head** | Add them to the two pills; responsive two-row layout. If the Head becomes too wide, the owner chooses a compact overflow rather than hiding Save |
| **Keyboard deviations** | P stays Walls (Path later), L stays Library (Lights later), F becomes Objects (Fit moves to Shift+F), 2/3 stay readings unless a drawing tool is armed. All are recorded in the Keys reference and tests |
| **Living/Paper is only a partial render profile** | Wire only what existing viewing state can express; mark the rest planned. Do not create a second renderer or persist a viewing choice as authored data |
| **Sky hour is not authored Scene state yet** | Presets now; hour/arc planned with an explicit T2 dependency. Do not fake undo |
| **Landscape has no owner** | Complete placeholder only; no implementation until the owner decision |
| **Placeholder UI looks like working UI** | Availability is visible text, accessible name and inert action; tests assert no task/history/selection change |
| **The old shell's selectors are used by tests and perf flows** | Update them in the cutover commit; run the affected browser flows and the whole arch lane. Do not add compatibility aliases that keep two dock models alive |
| **Stage rendering is not part of this cutover** | The world’s parchment diorama, lighting, shadows and full Living render profile are separate T2 work. Visual comparison judges the shell chrome and records the Stage delta explicitly |
| **One PR is large** | Commit A1–A6 are separately reviewable and each leaves the tree usable. Review at commit boundaries; the PR stays draft until the owner accepts A6 |

## Non-goals

- No Layout/Scene geometry, Camera, Experience, persistence or visitor changes in the shell commits.
- No T1/T2/T5 capability implementation before the A6 visual review.
- No new performance benchmark, browser baseline ratchet or scheduling job.
- No prototype JavaScript imported into production.
- No merge and no production activation as part of this plan.

## Review request

The owner is asked to accept or amend:

1. the two-pill Head adaptation that adds existing app actions (Find, Save, Preview, lens, Index)
   to #285’s identity/view pills;
2. keeping the Index and Height Sheet as subordinate Living Draft surfaces;
3. the keyboard compromises (P/L/F and the contextual 2/3 shapes);
4. the partial Living/Paper mapping and the planned Sky hour;
5. the vendored font set and its licences;
6. the placeholder grammar (inspectable plate, inert actions, visible planned label);
7. the A1–A6 commit sequence in one draft PR, with the owner visual checkpoint after A6.
