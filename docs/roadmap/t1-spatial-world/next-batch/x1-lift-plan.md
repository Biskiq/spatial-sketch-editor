# T1 X1 — Interior Reveal, Lift (`layout.interior-reveal`)

Authority: [README](README.md) §Interior Reveal (rev 3), [implementation-prs.md](implementation-prs.md)
row X1 and its acceptance, [creator-journeys.md](creator-journeys.md) J11,
[x0-interior-visibility-evidence.md](x0-interior-visibility-evidence.md), and
[v-plan-verticality.md](v-plan-verticality.md) handoff H-1 / §5.6 / §5.9. Shell rules:
[editor-shell-and-visual-system.md](../../../reference/design-system/editor-shell-and-visual-system.md)
(temporary-reading pill, reading control ▾). Render rules:
[rendering.md](../../../reference/components/rendering.md).

This plan is written for a separate coding agent. Every section labels its content:

- **Verified** — true on `main` at `a7f672db`, read in the code.
- **Approved** — required by the roadmap documents above. Not open to change here.
- **Decided** — this plan's engineering choice. The implementer follows it; a change needs a stop
  (see [Stop conditions](#stop-conditions)).

## Goal

**Approved.** The creator lifts the overheads of one Space, or of everything, to see and work
inside. Each lifted overhead is gone from the view and from clicks, and leaves a dashed outline at
its true position. Clicking the outline (or the Room's Index row) selects it; a selected lifted
overhead draws as a translucent ghost and stays editable. A pill reads
**Lift · Gallery ▾ · Put back**. Put back, Escape and leaving the project end it. It survives a
2D/3D switch, not a reload. It never moves the Camera, never changes light or shadow, and never
reaches Preview, a snapshot or a release. It is not saved, not in history; Undo never touches it.

Out of scope (**Approved**): X2 cutaway, SL1 Slice, issue #357, V1 regions and their handles, SP1
open-to-sky, any document-format change, any generalized visibility system.

## Verified current behavior

1. **The only overhead today is the generated Room lid.** `layout-geometry.ts` ~L1693–1703 compiles
   `CompiledRoom.ceilingElevation` (the max boundary-Wall height above the Floor datum) and
   `ceilingPolygon` (a copy of `floorPolygon`). Format is 7. There is no `CompiledRoom.overhead`,
   no region, no `overheadSourcesOf` anywhere.
2. **The lid mesh.** `render/layout-room-representation.ts` builds, per Room, a group holding the
   floor (identity-tagged `'floor'`), a `floorShadow` receiver (raycast no-op) and a ceiling
   `Mesh` named `VisitorCeiling:<roomId>` at `ceilingElevation`, `rotation (π/2, 0, 0)`, with a
   `FrontSide` material. The ceiling has **no identity tag** and **`castShadow` is false**. It faces
   down.
3. **So the lid is already invisible and click-through from above** (backface culled; `Mesh.raycast`
   culls back faces for `FrontSide`). It occludes only a Camera that is under it: inside the Room,
   or looking up from below. X0's high-view screenshots match this. J11's "from above he sees a
   lid" describes V1 authored slabs, not today's lid.
4. **Room lids cast no shadow; Walls and Layout objects do** (`layout-wall-representation.ts`
   L217). Lifting a lid therefore cannot change any light or shadow today.
5. **Layers.** `paper-plan.ts` L43–44: `STAGE_WORLD_LAYER = 0`, `STAGE_OVERLAY_LAYER = 2`; layers 1
   and 3 are unused. `stageCameraLayerMask(paperVisible)` (L795) is `[OVERLAY]` with Paper, else
   `[WORLD, OVERLAY]`; `StageCamera.svelte` L96–97 applies it. `StageSnapshotRenderer.svelte` L92
   sets `camera.layers.set(STAGE_WORLD_LAYER)`. r187 draws an object only if it shares a layer with
   the camera, the `Raycaster` tests `object.layers` against its own mask (default layer 0), and
   `WebGLShadowMap` uses `shadow.camera.layers` when that mask has a bit other than 0, else the
   **viewing camera's** layers. `light-store.ts` never sets shadow-camera layers.
6. **"Appearance never writes `Object3D.visible`"** (`paper-plan.ts`): `visible` is the pick
   source's "mounted and eligible" flag. Representations hide through `reconcileHidden` on
   `group.visible` only for real removals (`setHidden`), and the room representation remembers the
   hidden set across rebuilds.
7. **One Stage Canvas.** `StageCanvas.svelte` mounts `VisitorLayoutShell` inside
   `<T.Group oncreate={scenePick.registerLayout}>`, passing `hiddenWallIds` (Unroll's display-only
   overlay). `VisitorPreviewSurface` mounts its own `VisitorLayoutShell` on a separate Canvas and
   passes no session overlay.
8. **Picking.** `scene-pick-source.ts` raycasts entity roots and the layout root with a default
   `Raycaster`; a ceiling hit is kind `'layout'`. Layout's adapter pick is
   `plan-pick-provider.ts` `createPlanPickProvider(planFor)`: screen-space distance to Plan
   fragment surfaces within `PLAN_HIT_TOLERANCE_CSS_PX = 8`, returning a `StageDomainPick` with
   `depthMeters`; `stage-pick.ts` `resolveStagePick` ranks by depth in 3D (1 mm tie), then
   `cssDistance`. A `room-floor` hit becomes the Layout subject `{ kind: 'room', id }`
   (`semantic-selection.ts` L89). There is no fragment for a lid.
9. **Session readings.** `authoring/layout/wall-unfold-store.svelte.ts` and `wall-face-store.ts` are
   module singletons imported by the route, `StageCanvas` and `layout-contributions.ts`. The route's
   `resetViewContext()` (~L701) clears them on project replacement.
10. **Card actions.** `StageCardAction.group` is `'primary' | 'secondary'`; there is no icon slot.
    The Wall Card's `layout-wall-face` action toggles its label `Face this wall` / `Put back`
    (`layout-contributions.ts` ~L1036–1096). The Room branch (`sourceKind === 'room' ||
    'room-floor'`, ~L922) contributes `layout-room-duplicate` (`secondary`).
11. **Escape.** `stage-keyboard.ts` `case 'dismiss'` ends with
    `else if (input.activeLayer()?.key(event, 'unwind') !== 'claimed' && input.selectionPresent()) input.closeSelection();`
    (L271). Preview takes Escape before the Stage.
12. **Viewing bar.** `StageDraftingControl.svelte` has the reading segment `3D | Plan`
    (`data-drafting-reading`) and **no ▾ yet**. `StageViewportRegion.svelte` owns the
    `.mode-pill` pattern (`data-look-through-pill`, `.pill-primary`, click/pointerdown
    `stopPropagation`).
13. **Editor ink.** `StageSelectionLayer.svelte` draws `Line2`/`LineMaterial` contours on layer 2
    with `OUTLINE_DEPTH_BIAS` (`stage-outline.ts`) and `STAGE_PAINT.hover` as the neutral tone.
    `material-factory-boundary.test.ts` holds an exact per-file EDITOR_INK allowlist.
14. **Name clash.** The route already has an Index "Reveal" (`revealed` / `toggleReveal`) for
    depth/crop. X1 never uses the word Reveal in code identifiers; it is `lift` throughout.

## Architecture

### Ownership (Decided, within the Approved split)

| Concern | Owner | Module |
|---|---|---|
| Which overheads exist, their outline and elevation | layout-core (pure) | `packages/layout-core/src/layout-geometry-queries.ts` → `overheadSourcesOf` |
| The reading: on/off and scope | shell session (Layout lane) | new `apps/editor/src/lib/authoring/layout/interior-lift-store.svelte.ts` |
| Drawing the lid lifted (gone from view and rays) | Layout representation | `render/layout-room-representation.ts` → `setLifted` |
| The lifted layer number | render | new `apps/editor/src/lib/render/render-layers.ts` |
| Dashed outline and selected ghost | Stage shell editor ink | new `apps/editor/src/lib/authoring/stage/shell/StageLiftLayer.svelte` |
| Clicking an outline | Layout adapter pick | `authoring/layout/plan-pick-provider.ts` |
| Entry, pill, Escape | shell | `StageDraftingControl`, `StageToolbars`, `StageViewportRegion`, `stage-keyboard.ts`, route |
| Room Card action | Layout adapter | `authoring/adapters/layout/layout-contributions.ts` |
| Camera | untouched | — (no intent is ever submitted) |
| Light store | untouched (T2/E10) | — |

### 1. Overhead sources — `overheadSourcesOf` (H-1)

**Approved:** take the overhead set from one function, `overheadSourcesOf`, lids now and regions
after V1b; until V1b, X1 computes lids itself behind that name.

**Decided.** Add to `packages/layout-core/src/layout-geometry-queries.ts` (already exported from
`index.ts`):

```ts
export type OverheadScope =
	| { readonly kind: 'all' }
	| { readonly kind: 'space'; readonly roomId: string };

export type OverheadSourceKey = { readonly kind: 'room-lid'; readonly roomId: string };
// V1b adds: | { readonly kind: 'region'; readonly regionId: string }

export type OverheadSource = {
	readonly key: OverheadSourceKey;
	/** The selectable subject that owns this overhead. */
	readonly subject: { readonly kind: 'room'; readonly id: string };
	/** Closed plan loop, world XZ, no repeated last point. */
	readonly outline: readonly LayoutVec2[];
	/** World Y of the overhead's underside. */
	readonly elevation: number;
};

export function overheadSourcesOf(
	compiled: CompiledLayoutGeometry,
	scope: OverheadScope
): readonly OverheadSource[];
```

Rules:

- One source per `CompiledRoom` with `ceilingPolygon.length >= 3` and finite `ceilingElevation`.
  Every compiled Room counts as closed today; SP1 will filter open-to-sky Rooms here, nowhere else.
- `scope.kind === 'space'` returns only that Room's lid (V1b will add `regionsOverSpace(compiled,
  roomId)` results here). An unknown `roomId` returns `[]`.
- Sorted by `key.roomId` (string compare) so callers and tests are deterministic.
- `outline` is `ceilingPolygon` copied, `elevation` is `ceilingElevation`. Pure, no caching, no
  `three`.

Consumers never read `CompiledRoom.ceiling*` for Lift; they read sources. The editor maps
`room-lid` sources to `liftedRoomIds`; a future `region` source goes to its own representation's
`setLifted` (V1c), with no change to the store or pill.

### 2. The reading — `interior-lift-store.svelte.ts`

**Decided.** One module singleton, the Unroll/Face pattern:

```ts
export type LiftScope = OverheadScope; // re-exported from @portfolio/layout-core

class InteriorLiftStore {
	#reading = $state<{ readonly scope: LiftScope } | null>(null);
	get reading(): { readonly scope: LiftScope } | null;
	isActive(): boolean;
	lift(scope: LiftScope): void;      // starts, or replaces the scope
	setScope(scope: LiftScope): void;  // no-op when inactive
	putBack(): void;                   // ends; same as clear, named for the control
	clear(): void;                     // ends; replacement / unmount
}
export const interiorLift = new InteriorLiftStore();
```

Lifecycle (**Approved** semantics, **Decided** wiring):

| Event | Effect |
|---|---|
| Reading control ▾ → Lift | `lift(initialScope())` |
| Room Card → Lift | `lift({ kind: 'space', roomId })` |
| Pill ▾ → Everything / This space | `setScope(...)` |
| Pill Put back, Room Card Put back | `putBack()` |
| Escape at the temporary-reading level | `putBack()` (see §6) |
| Project replacement, leaving the project | `clear()` in `resetViewContext()` and in the route's teardown |
| Reload | gone (never serialized) |
| 2D/3D switch, lens change, Look-through, Preview open/close, Unroll, Face | **unchanged** |
| Undo/Redo | **unchanged**; the store is not a document, not in history |
| Scoped Room no longer compiles (deleted, merged, undone away) | the route's effect calls `clear()` and posts the Stage notice "Lift ended: the Space is gone." |

`initialScope()` (route, **Decided**): the selected Layout Room (`subject.kind === 'room'`) →
`space`; else, in 3D only, the **occupied** Room: the Room whose `floorPolygon` contains the eye's
XZ (`pointInPolygon` from layout-core) and with `floorElevation <= eye.y <= ceilingElevation`,
ties broken by smallest `roomId`; else `all`. The eye is
`stage.evaluation().inverseViewMatrix[12..14]`, exactly as `StageCanvas` already derives it for
`StageSelectionLayer` (L373). The scope is frozen at entry; later Camera moves do not change it.

### 3. Lifting in the renderer — a layer, never `visible`

**Decided.** Lifting moves each lifted lid mesh off the world layer onto an unused render layer.

- New `apps/editor/src/lib/render/render-layers.ts`:
  `export const LIFTED_RENDER_LAYER = 3;` with a doc comment: "World content a session reading has
  lifted out of the Stage view and out of rays. Snapshot cameras include it; the Stage camera and
  the default Raycaster do not."
- `paper-plan.ts` re-exports it as `STAGE_LIFTED_LAYER` beside the other two. The Stage camera mask
  is **unchanged** (it never enables 3).
- `RoomRepresentation.setLifted(roomIds: ReadonlySet<string>): void` in
  `layout-room-representation.ts`. For each built Room, its ceiling mesh gets
  `mesh.layers.set(lifted ? LIFTED_RENDER_LAYER : 0)`. The set is remembered like `hidden`; a
  Room built or rebuilt later is born with the remembered state. It never touches `visible`, the
  floor, `floorShadow`, materials, geometry or `castShadow`. A Room both hidden and lifted is
  hidden (group) and lifted (mesh); the two never interact.
- `VisitorLayoutShell.svelte` gains `liftedRoomIds?: readonly string[] = []`, documented as
  "display-only session overlay, never persisted, never passed by Preview", applied in its own
  `$effect` next to the `walls.setHidden` effect: `rooms.setLifted(new Set(liftedRoomIds))`.
- `StageCanvas.svelte` passes `liftedRoomIds` from a prop the route provides. The route derives it:
  `interiorLift.reading === null ? [] : overheadSourcesOf(compiled, scope)` → `room-lid` keys →
  `roomId[]`. **`VisitorPreviewSurface` never passes it.**
- `StageSnapshotRenderer.svelte` L92 becomes
  `camera.layers.set(STAGE_WORLD_LAYER); camera.layers.enable(STAGE_LIFTED_LAYER);` with the
  comment "Snapshots are as-built: a lifted overhead is world content." Snapshots invalidate on
  `revision`; Lift does not bump it and must not (the image does not change).

Why this works, from the Verified facts: the Stage camera does not render layer 3, so the lid
disappears from the view; the default `Raycaster` (layer 0) misses it, so every `pickScene` /
`pickVisibleFace` consumer (selection, light placement, artwork placement, opening occlusion)
clicks through; the snapshot camera includes 3, so snapshots are as-built; Preview is a separate
Canvas with no overlay, so it is as-built. Camera, lighting state, materials, geometry and history
are never written.

### 4. Dashed outline and selected ghost — `StageLiftLayer.svelte`

**Decided.** A new editor-ink component mounted by `StageCanvas` next to `StageSelectionLayer`,
props `{ sources: readonly OverheadSource[]; selectedRoomId: string | null; hoveredRoomId: string | null; width; height; reading }`.

- Draws nothing when `sources` is empty or `reading === 'plan'` (in Plan the outline coincides with
  the Room boundary the Paper already draws).
- **Outline:** per source, one closed `Line2` (`LineGeometry` with the loop closed) at
  `elevation - 0.01` m, `LineMaterial({ color: STAGE_PAINT.hover, linewidth: 2, dashed: true,
  dashSize: 0.12, gapSize: 0.08, transparent: true, opacity: 0.9, toneMapped: false,
  depthTest: true, depthWrite: false, ...OUTLINE_DEPTH_BIAS, resolution })`, `computeLineDistances()`,
  `renderOrder = 19`, `layers.set(STAGE_OVERLAY_LAYER)`, `raycast = () => {}`,
  `frustumCulled = false`. Hovered source: `linewidth: 3`, opacity 1. Neutral tone only: never
  gold, yellow or cobalt (gold is selection; the selection layer draws the gold Room contour).
- **Ghost:** when `selectedRoomId` names a lifted source, one `Mesh(ShapeGeometry(outline), MeshBasicMaterial({ color: STAGE_PAINT.hover, transparent: true, opacity: 0.18, side: DoubleSide, depthWrite: false, depthTest: true, toneMapped: false }))`
  at `elevation`, rotation `(π/2, 0, 0)` (the lid's own placement), `renderOrder = 18`,
  overlay layer, `raycast = () => {}`. It is ink: never picked, never lit, never in snapshots.
- Rebuilds only when `sources` identity, the selected id, the hovered id, or the resolution change;
  disposes every geometry and material it made.
- Add `'lib/authoring/stage/shell/StageLiftLayer.svelte': { count: N }` to the EDITOR_INK allowlist
  in `material-factory-boundary.test.ts`, with `N` the exact number of material constructions in
  the file (expected 2: one `LineMaterial`, one `MeshBasicMaterial`).

**Approved vs Decided on "editable".** Approved: a selected lifted overhead draws as a ghost and
stays editable. Decided: for a generated lid, "editable" means the selection is the ordinary Room
selection, so the Room Card and every existing Room edit work unchanged while lifted. There are no
lid handles today and X1 adds none; region handles are V1c (§5.9). Selection semantics are
unchanged.

### 5. Clicking the outline — in Layout's pick

**Decided.** `createPlanPickProvider(planFor, liftedOutlines = () => [])` gains a second accessor
returning the current `OverheadSource[]` (empty when Lift is off). `layout.adapter.ts` passes
`() => liftedSourcesNow()`, a small exported function in `interior-lift-store.svelte.ts` that reads
the store and the adapter's current compiled geometry through `overheadSourcesOf`.

In the provider, only when `evaluation.renderedReading !== 'plan'` and
`query.purpose !== 'tool'` (Select and hover only; tools see no outline):

1. For each source, project each outline segment (at `elevation - 0.01`) with the provider's
   existing `project` and take the nearest `closestOnCssSegment` distance.
2. Keep the nearest within `PLAN_HIT_TOLERANCE_CSS_PX`. Its world point is the 3D point at that
   segment amount; its depth is the distance along `pointerRay` to that point.
3. **Occlusion:** `context.pickScene(ray)`; if it hits something nearer than `depth - 0.05` m, the
   outline is behind a Wall and is not hit.
4. Compare with the fragment winner the provider already computes: the outline wins when
   `outlineDepth <= winnerDepth + 0.05` or there is no winner. (Its top edge coincides with the
   inner Wall face top, so a plain 1 mm depth tie would hand it to the Wall.)
5. The returned hit is the Room's own `room-floor` fragment ref (from `retained.fragments`, the
   one with `sourceKind === 'room-floor'` and `sourceId === roomId`), with the outline world point,
   `cssDistance`, `depthMeters = outlineDepth`, `refusal: null`. If that fragment is not present
   (not eligible), return no outline hit.

So the outline selects **the Room**; `semantic-selection.ts` already maps it to `{ kind: 'room' }`.
Interior clicks never meet the outline and fall through to plinths, objects and floors, which the
lid no longer blocks (§3). The Index Room row already selects the Room; nothing changes there.

### 6. Entry, pill, Escape, Put back

**Reading control ▾ (Approved: Lift sits behind the reading control's ▾).**
`StageDraftingControl.svelte` gains one ▾ button after the `3D | Plan` segment
(`data-reading-more`, `aria-haspopup="menu"`), opening a popover with exactly one item,
**Lift** (`data-reading-lift`), shown as a checked item while Lift is on (choosing it again puts
back). No disabled or planned items (eye level, elevations, projection and roofs-from-above are not
built and do not appear). Escape closes the popover first (its own handler, `stopPropagation`, as
the ⚙ panel does). New props through `StageToolbars` `viewLine.drafting`:
`lift: { active: boolean; toggle(): void }`.

**Room Card (Approved: entered from a Room, Space or overhead Card).** In the Room branch of
`cardActions`, add `layout-room-lift`, default (`primary`) group, label `Lift` or `Put back` when
`interiorLift.reading?.scope` is `{ kind: 'space', roomId: <this Room> }`. Run: toggles that,
calls `services.stage.notifySurfaceChange()`, returns `{ kind: 'accepted' }`. When Lift is on with
scope `all`, the label is `Lift` and running it narrows to this Space. Space and overhead Cards are
this Room Card today (a lid is selected as its Room). Card actions have no icon slot; the action is
the text verb, as A6's Face this wall is.

**Pill (Approved: `Lift · Gallery ▾ · Put back`).** `StageViewportRegion.svelte` renders, while
`interiorLift.isActive()` and Preview is not showing, a `.mode-pill lift-pill` (`data-lift-pill`)
with: `Lift` label · a scope button (`data-lift-scope`) reading the scoped Room's name (as its Card titles it) or
`Everything`, with ▾ · a `Put back` `.pill-primary` button (`data-lift-put-back`). Click and
pointerdown stop propagation, like the Look-through pill. When the Look-through pill is also
present, the Lift pill follows it in the same row. The scope menu lists `Everything` and
`This space: <name>` where `<name>` is the candidate Room (selected Room ?? occupied Room ??
current scoped Room); the second item is absent when there is no candidate. The current scope is
checked. Pill and reading activate together (PLATE rule): the pill is never shown without the
reading or the reverse, except while Preview covers the Stage.

**Escape (Approved: Escape at the temporary-reading level exits).** In `stage-keyboard.ts`, add
`liftActive(): boolean` and `putBackLift(): void` to `StageKeyboardInput`, and replace L271 with:

```ts
else {
	const claimed = input.activeLayer()?.key(event, 'unwind') === 'claimed';
	if (!claimed && input.selectionPresent()) input.closeSelection();
	else if (!claimed && input.liftActive()) input.putBackLift();
}
```

So a selection (including one made inside Lift) closes first, then the next Escape puts Lift
back. Every earlier rung (gesture, disclosure, tool, palette, task, plate) still wins. Preview
still takes Escape before the Stage. The route wires `liftActive: () => interiorLift.isActive()`,
`putBackLift: () => interiorLift.putBack()`.

### 7. Plan/3D, Preview, persistence

- **Plan ↔ 3D (Approved: survives).** The store ignores reading changes. In Plan, the Paper camera
  does not draw the world layer anyway; the outline layer draws nothing; the outline pick is off;
  the pill stays. Back in 3D, the lid is still lifted.
- **Preview (Approved: never appears; Lift is still on after return).** Preview's separate Canvas
  gets no `liftedRoomIds`, so a lifted lid is drawn there as built (and would cast there if it
  cast — T-V11). The store is untouched by Preview; the pill hides while Preview shows and returns
  with it.
- **Snapshot, release (Approved: never appears).** Snapshot camera includes the lifted layer (§3);
  release and visitor code never import the store.
- **No persistence (Approved).** The store holds no document data, writes nothing, and is not a
  history participant. No format change, no project-model field, no localStorage.

## T2 boundary — the one real conflict

**Approved (T2 README §10):** "a surface hidden from the camera still casts and blocks light… T1
owns how."

**Conflict.** The layer mechanism hides a mesh from the Stage camera *and* from the Stage's shadow
pass: r187 shadow cameras with an untouched mask render the viewing camera's layers (Verified 5).
Today no lid casts (Verified 4), so Lift changes no light or shadow, and the acceptance
("every light and shadow identical before, during and after") holds. If T2 or V1 ever makes a lid
or region cast, a lifted one would silently stop casting in the Stage.

**Smallest compatible resolution (Decided).**

1. X1 does not edit `light-store.ts` (T2/E10's) and does not set `castShadow` on lids.
2. X1 adds a test that pins the contract: for a built room representation, `setLifted` leaves
   every mesh's `castShadow` / `receiveShadow` unchanged, and the set of `castShadow` meshes under
   the layout root is identical before and after `setLifted` (no lid casts).
3. The doc comment on `LIFTED_RENDER_LAYER` states the handoff, and `rendering.md` gets one
   sentence under Layers: "A lifted overhead is on `LIFTED_RENDER_LAYER`. Any light whose shadow
   must include world casters enables that layer on its shadow camera
   (`shadow.camera.layers.enable(LIFTED_RENDER_LAYER)`); the light store owns that line when the
   first overhead becomes a caster."

That one line is T2's to add, at the time it makes overheads cast. No T2 code changes in X1.

## Files

New:

- `packages/layout-core/src/layout-geometry-queries.ts` — `overheadSourcesOf` + types (edit of an
  existing file).
- `apps/editor/src/lib/render/render-layers.ts` — `LIFTED_RENDER_LAYER`.
- `apps/editor/src/lib/authoring/layout/interior-lift-store.svelte.ts` — store, `liftedSourcesNow`.
- `apps/editor/src/lib/authoring/stage/shell/StageLiftLayer.svelte` — outline and ghost ink.

Edited:

- `apps/editor/src/lib/render/layout-room-representation.ts` — `setLifted`.
- `apps/editor/src/lib/visitor/VisitorLayoutShell.svelte` — `liftedRoomIds` prop and effect.
- `apps/editor/src/lib/authoring/stage/paper-plan.ts` — re-export `STAGE_LIFTED_LAYER`.
- `apps/editor/src/lib/authoring/stage/shell/StageSnapshotRenderer.svelte` — enable the lifted layer.
- `apps/editor/src/lib/authoring/stage/shell/StageCanvas.svelte` — pass `liftedRoomIds`, mount `StageLiftLayer`.
- `apps/editor/src/lib/authoring/layout/plan-pick-provider.ts` — outline pick.
- `apps/editor/src/lib/authoring/adapters/layout.adapter.ts` — pass the accessor (L56).
- `apps/editor/src/lib/authoring/adapters/layout/layout-contributions.ts` — `layout-room-lift`.
- `apps/editor/src/lib/authoring/stage/shell/StageDraftingControl.svelte`, `StageToolbars.svelte` — ▾ and Lift item.
- `apps/editor/src/lib/authoring/stage/shell/StageViewportRegion.svelte` — the pill.
- `apps/editor/src/lib/authoring/stage/route/stage-keyboard.ts` — Escape rung.
- `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` — wiring, `initialScope`,
  `resetViewContext` / teardown `clear()`, scoped-Room-gone effect.
- `apps/editor/tests/lib/render/material-factory-boundary.test.ts` — allowlist entry.
- `docs/reference/components/rendering.md` — the one Layers sentence (T2 handoff).
- `docs/reference/components/layout.md` — one line under session readings: Lift is a Layout
  session reading, not persisted.

Not touched: `light-store.ts`, `StageCamera.svelte` / `stageCameraLayerMask`, camera-core,
project-model, format codecs, `VisitorPreviewSurface`, `scene-pick-source.ts`, history.

## Tests

Fast lane unless noted. Fixtures: the existing two-Room wall-first fixture used by
`layout-room-representation.test.ts` and the Face adapter test (one Room "Gallery" beside a second
Room), plus a plinth object inside Gallery.

1. **`overheadSourcesOf`** (new `apps/editor/tests/lib/layout/layout-overhead-sources.test.ts`, beside `layout-geometry.test.ts`): `all` returns one source per Room, sorted,
   outline = `ceilingPolygon`, elevation = `ceilingElevation`; `space` returns one; unknown Room →
   `[]`; a degenerate Room (< 3 points) is absent.
2. **Lid pin (first, before any change):** in `layout-room-representation.test.ts`, a ray from
   above the Room straight down misses the ceiling mesh and hits the floor; a ray from inside
   straight up hits `VisitorCeiling:<id>`. This pins Verified 3.
3. **`setLifted`:** lifted ceiling mesh `layers.mask === 1 << 3`; floor and `floorShadow` on 0; an
   upward ray from inside now misses the ceiling; `visible` untouched everywhere; a rebuild by
   `update` with a new `cacheKey` is born lifted; `setLifted(new Set())` restores layer 0;
   `castShadow`/`receiveShadow` unchanged and the caster set identical (T2 pin).
4. **Store:** `lift`/`setScope`/`putBack`/`clear`; `setScope` inactive no-op; never touches
   anything else (no history, no document).
5. **Pick:** `plan-pick-provider` test with a lifted Gallery in 3D: a click within 8 CSS px of the
   outline returns Gallery's `room-floor` ref; a click in the room's middle returns the plinth /
   floor beneath; an outline behind a Wall (occluded by `pickScene`) returns no outline hit; in
   Plan and for tool purposes the outline is never hit; Lift off → behavior identical to today
   (existing tests unchanged).
6. **Card:** `layout-room-lift` label `Lift` → `Put back` → `Lift`; scope `all` + run narrows to
   space; the action never submits a document change.
7. **Keyboard:** `stage-keyboard` test: selection present + Lift → first Escape closes selection,
   second puts Lift back; a claimed unwind does neither; open popover/tool wins first.
8. **Isolation (arch lane):** extend `f4-public-isolation` / public-surface boundary so
   `interior-lift-store` is unreachable from visitor/release/preview entry points; assert
   `VisitorPreviewSurface.svelte` does not mention `liftedRoomIds`; `render-layer-boundary` still
   passes with `render-layers.ts` importing nothing from authoring.
9. **Snapshot:** `StageSnapshotRenderer` (or its helper) camera mask includes layers 0 and 3 only.
10. **Composition:** `stage-shell-composition.test.ts` — the Lift item exists only behind the ▾,
    the pill appears exactly while active, Put back removes both.

## Browser QA (focused, not a full capture)

On the two-Room fixture in the dev editor:

1. Inside Gallery at eye level: ▾ → Lift. Pill reads `Lift · Gallery ▾ · Put back`. The ceiling is
   gone; a dashed neutral outline sits at the wall tops; the Camera did not move (compare
   `stage.evaluation()` pose before/after); lights and shadows look identical.
2. Click a plinth through where the lid was: the plinth selects. Click the outline: Gallery
   selects, the translucent ghost appears, the Room Card is open and its edits work.
3. Escape: selection closes. Escape again: Lift puts back, pill gone, ceiling back.
4. From above: Lift from the Room Card → same pill; switch to Plan and back → still lifted.
5. Pill ▾ → Everything → both Rooms lifted. Open Preview → ceilings as built; close → still lifted.
6. Undo/Redo a Wall move while lifted → Lift unchanged. Reload → Lift gone.

## Ordered steps

Each step ends green on `npm run check` and the step's tests.

1. **Pin.** Test 2 (lid from above/below). Completion: passes on unmodified code.
2. **layout-core.** `overheadSourcesOf` + test 1. Completion: the new layout test and `layout-geometry.test.ts` pass.
3. **Render.** `render-layers.ts`, `setLifted`, `VisitorLayoutShell` prop, paper-plan re-export,
   snapshot mask; tests 3 and 9. Completion: `test:fast` render suites and `test:arch`
   render guards pass.
4. **Store.** `interior-lift-store.svelte.ts` + test 4; route wiring for `liftedRoomIds`,
   `resetViewContext`, teardown, scoped-Room-gone effect. Completion: a dev-console
   `interiorLift.lift({kind:'all'})` lifts every lid.
5. **Ink.** `StageLiftLayer.svelte`, allowlist entry. Completion: `material-factory-boundary` passes;
   outline and ghost visible in QA step 1/2.
6. **Pick.** Outline pick + test 5. Completion: existing pick suites unchanged and green.
7. **Entry and exit.** ▾ item, Room Card action, pill, Escape; tests 6, 7, 10. Completion: QA
   steps 1–6.
8. **Isolation and docs.** Test 8, the two reference-doc sentences. Completion: `npm run test:arch`,
   `npm run test:fast`, docs-references test green.

## Acceptance (from implementation-prs.md X1, with checks)

| Approved criterion | Check |
|---|---|
| Entered from the reading control and from a Room/Space/overhead Card | tests 6, 10; QA 1, 4 |
| Lifts the selected or occupied Space, or everything | `initialScope` unit test in the route helper; QA 1, 5 |
| Each lifted overhead leaves a dashed outline that selects it | test 5; QA 2 |
| A selected lifted overhead is a ghost and stays editable | QA 2 |
| Put back and Escape exit | tests 7, 10; QA 3 |
| Camera pose, every light and shadow identical | no Camera intent (grep); test 3 T2 pin; QA 1 |
| Survives 2D/3D; not reload | test 4; QA 4, 6 |
| Never in history, Preview, snapshot, release | tests 4, 8, 9; QA 5, 6 |

## Risks

1. **Shadow coupling (T2).** Handled above; the pin test fails loudly if a lid starts casting.
2. **Outline vs Wall top edge.** The outline sits on the inner Wall face top; the 0.05 m outline
   band (§5) favors the outline within tolerance. Risk: clicking a Wall's top edge while lifted
   selects the Room. Accepted: the creator is in Lift and the outline is what is drawn there.
3. **Fragment eligibility.** The outline hit reuses the Room's `room-floor` fragment; if a Room's
   floor fragment is ever ineligible, its outline is not clickable (Index row still works).
4. **Z-fighting of the dashed line.** `elevation - 0.01` plus `OUTLINE_DEPTH_BIAS` should suffice;
   if it flickers in QA, raise the offset to 0.02, nothing else.
5. **V1/SP1 drift.** Both join only through `overheadSourcesOf`; if V1b lands first, its query
   module wins the file location and X1 adds `overheadSourcesOf` beside `regionsOverSpace`.
6. **Escape ladder regressions.** Covered by test 7 and the existing keyboard suite.

## Stop conditions

Stop and report instead of improvising if any of these arises:

- Any document-format, project-model or history change looks necessary.
- `light-store.ts`, camera-core, `StageCamera` or `stageCameraLayerMask` would need an edit.
- A lid turns out to cast a shadow on `main`, or any light/shadow difference shows in QA.
- Selection semantics must change (a new subject kind, or the Room Card cannot edit while lifted).
- The outline pick cannot be placed in `plan-pick-provider.ts` without changing `StageDomainPick`
  or `resolveStagePick`.
- SP1 or V1 code has landed and changes what an overhead is.
- The work drifts into X2 cutaway, SL1 Slice, issue #357 or a generic visibility system.

## Implementation handoff prompt

Copy-paste for the coding agent:

```text
Implement T1 X1: Interior Reveal, Lift (capability `layout.interior-reveal`) in the Biskiq
spatial-sketch-editor repo.

Plan (authoritative): docs/roadmap/t1-spatial-world/next-batch/x1-lift-plan.md. Read it fully,
then AGENTS.md and apps/editor/tests/README.md. Every "Decided" item is settled; do not
redesign. "Approved" items are product requirements.

Setup: branch `feat/t1-x1-lift` from the latest `main`. Confirm `main` still has no
`overheadSourcesOf`, no `CompiledRoom.overhead`, and the Room lid has castShadow false; if any
differs, stop (see Stop conditions in the plan).

Execute the plan's "Ordered steps" 1→8 in order, one commit per step, each green before the next:
  1 pin the lid ray test  2 overheadSourcesOf  3 render layer + setLifted + snapshot mask
  4 interior-lift-store + route wiring  5 StageLiftLayer ink + allowlist  6 outline pick
  7 ▾ Lift item, Room Card action, pill, Escape  8 isolation tests + two doc sentences

Checks before opening the PR:
  npm run check
  npm run test:arch
  npm run test:fast
  the docs-references test
  focused browser QA: the plan's "Browser QA" steps 1–6 (inside the Room and from above).
  Record Camera pose before/after Lift in QA step 1 and confirm it is identical.

Constraints: no document-format change, no history participation, no edits to light-store.ts,
camera-core, StageCamera or stageCameraLayerMask, no changes to VisitorPreviewSurface, no
generalized visibility system, no X2/SL1/#357 work, no speculative refactoring. Never write
Object3D.visible for Lift. Commit messages carry no agent footer (AGENTS.md rule 10).

Stop and report, without working around it, on any of the plan's Stop conditions.

Deliver: a PR titled "feat(layout.interior-reveal): T1 X1 Lift" with the acceptance table from
the plan filled in (check → result), the QA notes, and any deviation stated plainly. Do not merge.
```
