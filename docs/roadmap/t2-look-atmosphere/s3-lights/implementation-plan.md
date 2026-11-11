# T2 S3 — Lights: implementation plan

**Status:** planning baseline for approval. This draft PR claims the capability slice **`T2.S3`**
(“Lights”). The plan is its first commit; the same PR then implements **S3a** after the plan is
approved. **Look through** is a separate implementation PR (**S3b**) because it touches the one
Camera authority.

**Base:** `0ce09d70` — current `main`, the merge of PR #292 (P0 Look seams). PR #289 (the approved
Look & Atmosphere baseline) is merged at `37ef36ba`; this branch is cut from `origin/main` after
both.

**Claim check (2026-11-11):** open PRs were #291 (`T2.S0`, Gate A) and #293 (`T1 A0`); open issues
were #284, #280 and #273. None claims `T2.S3`, `T2.S7`, `T2.G1` or a Lights slice. No worktree or
branch other than this one claims S3.

**Risk tier:** **S3a — Tier 1** (contract details inside the approved design; a shared Stage and
visitor renderer change; a Scene content contract update). **S3b — Tier 2** (the one Camera
authority). The plan itself is owner-reviewed because it fixes the interaction grammar and replaces
one line of the Scene light contract.

**Read against:** [T2 Look & Atmosphere](../README.md) §5, §8, §9, §12, §13;
[Spatial instrument grammar](../../../reference/design-system/spatial-instrument-grammar.md);
[Scene content](../../../reference/components/scene-content.md) § Material and light semantic gaps;
[Camera contract](../../../reference/components/camera-tour.md);
[S0 Gate A pipeline record](https://github.com/Biskiq/spatial-sketch-editor/pull/291) (PR 291, not
yet merged);
[Camera session](../../../../apps/editor/src/lib/authoring/stage/camera-session.ts);
[P0 Look seam](../../../../apps/editor/src/lib/authoring/look/look-authoring.svelte.ts);
[Review study](../review.html) — the three light-kind studies.

---

## 1. Goal

A creator can **place, find, select and edit Point, Spot and Directional lights** in the World
without leaving the Stage, and can see exactly what each light is aimed at:

- free placement in space, with surfaces as magnets rather than hosts;
- camera-style aiming: a body plus the thing it looks at, with a target mark, a frustum guide and
  direct handles;
- a light Card with the approved everyday controls, an Index group, selection and one undo per
  gesture;
- physical stored units with the Gate A Brightness mapping and angle conversions;
- truthful Stage / Preview / visitor behavior, including the Paper “guide only” state;
- **Look through** for a spot, realised through the existing Camera inspection authority, in its
  own PR.

The result is a normal Scene light entity. S3 adds **no persisted field and no format bump**. It
does not group, does not create fixtures and does not implement *Light it*: **G1 owns grouping and
S7 owns *Light it* recipes**. S3 only makes lights ordinary, editable Scene entities that those
slices can consume.

## 2. What the code says today

These are the facts the plan is built on.

| # | Finding | Evidence | Consequence |
| --- | --- | --- | --- |
| L1 | Three light kinds already exist in Scene 5: `point`, `spot`, `directional`, with `color`, `intensity`, optional `range`, `angle` (radians, `(0, π]`), optional `penumbra`, `castShadow`. Directional rejects `range`/`angle`/`penumbra`; point rejects `angle`/`penumbra`; spot requires `angle`. | `packages/project-model/src/scene.ts` (`SceneLightEntity`), `scene-codec/parse-entities.ts` | S3 writes the existing fields. No codec or schema change; no migration. |
| L2 | Lights render in Stage and visit through the shared `EntityLight.svelte`; stage and visitor both mount it through `VisitorEntityGroups`. Stage and visitor use `PCFShadowMap`. | `EntityLight.svelte`, `VisitorEntityGroups.svelte`, `StageCanvas.svelte`, `VisitorPreviewSurface.svelte` | One renderer, one set of light values. S3 does not fork a light renderer. |
| L3 | Lights are **not pickable**. The Scene adapter’s `pick` returns `null` when every entity is a light, skips lights in the measure path, and documents “Lights are never picked”. Its `subjects` list still includes them. | `apps/editor/src/lib/authoring/adapters/scene.adapter.ts` (`pick`, `subjects`, `eraseAction`) | S3 must add light selection and move lights out of the object Card/pick path. |
| L4 | No light creation, update, duplicate or light-specific Card exists. The Scene planners are object/form operations only; `duplicate-one` calls `readObject` and refuses a light. | `packages/project-model/src/scene-planning/operations.ts`, `planners.ts`; `object-marks.ts` (“Lights are not objects”) | New pure planners and a light adapter are required. |
| L5 | The World toolbar has a `Lights` tool at `stage: 'planned'` with Point/Spot/**Area** placeholder tiles. The Library’s `lights` category renders disabled “Planned · T2” tiles, including Area, which is not a Scene kind. | `world-toolbar/registry.ts`, `WorldToolbar.svelte` | S3 must land the tool, remove Area, and replace the placeholder with the P0 Look shelf. D18 forbids leaving the inert tiles. |
| L6 | P0 added `createLookAuthoring` with three empty strata: `cardStratum`, `stageMarks` and `libraryShelf`. The route already reads all three; the Card writer overrides the adapter writer, and the Library sub-tab appears only when the shelf has entries. | `look-authoring.svelte.ts`; `spatial/+page.svelte` (card stratum, `look.stageMarks`, `lookShelf`) | S3 fills these seams. No second route writer. |
| L7 | P0’s `stageMarks` is `readonly StageMarkView[]` — **projected handle glyphs** (point/ray/ring/track), not arbitrary world lines. A frustum outline cannot be expressed as a `StageMarkView` without faking every edge as a handle. | `stage-handles.ts` (`StageMarkView`), `StageOverlay.svelte` | A minimal typed `StageGuide` extension is required. It is a Stage instrument layer, not a second Look writer. See §5.5. |
| L8 | The Card already supports a domain writer component (`StageInstrumentContent.view`) and a generic action list. It does not support selecting a referenced subject from a fact. | `EditorCard.svelte`; `StageCardFact` | *Lit by* needs one small generic fact-select affordance; see §5.10. |
| L9 | Scene lights render on Paper, because `VisitorEntityGroups` mounts `EntityLight` unconditionally while the Stage/visitor Paper rig adds its own neutral lights. | `VisitorEntityGroups.svelte`, `StageCanvas.svelte`, `VisitorPreviewSurface.svelte` | The approved “On Paper, lights are not rendered” rule is currently false. S3 fixes it with one `includeLights` prop. |
| L10 | There is no light-specific name, no light Card controller and no `Lit by` reading. The Scene adapter’s generic Card facts include `Yaw` in radians and `Position`, which would be wrong for a light. | `scene.adapter.ts` (`cardFacts`), `object-card.ts` | The light stratum owns the light Card; the Scene adapter excludes lights from object facts. |
| L11 | Gate A (PR #291) measured the pipeline: `NoToneMapping`, exposure 1.0, sRGB output, `srgb-linear` working space, point/spot candela, directional lux, `decay = 2`, reference intensity π, five measured Brightness factors. | S0 `pipeline.md` in PR #291 | The Brightness mapping is fixed by evidence, not invented. **PR #291 is still an open draft; S3a implementation depends on its merge or an owner-authorised port of the record.** |
| L12 | Gate C has not run. There is no shadow budget constant or refusal rule. `castShadow` is authored per light and the sun always casts. | S0 `report.md`; `shadow-invalidation.ts` | S3 must not invent a shadow budget, a maximum, or a silent shadow default. See §6.4. |

## 3. Scope

### In scope

- Point, Spot and Directional light **emitters** (no fixture model).
- Free placement in space; surface magnet; working-height fallback.
- Camera-style aiming; target, rim, inner-ring, reach-ring and direction-dial marks.
- Frustum guides: spot cone, point reach sphere/ring/stem, directional box, footprint trace.
- Light Card controls, Index group, selection, rename, duplicate, delete, undo/redo.
- Gate A units, Brightness stops and degree/radian conversions.
- Stage, Paper, Preview and visitor truth; visitor-chunk isolation.
- *Lit by* as a derived, non-stored reading.
- *Look through* planned here, implemented in **S3b**.

### Explicitly out

- **Grouping** — G1 owns it. S3 does not group, does not group-select, and does not add a group
  Card. A light is a flat Scene entity like any other. S3 **refuses to duplicate a clustered
  light** rather than silently changing a group; `delete-one` keeps its existing cluster cleanup.
- ***Light it*** — S7 owns the recipes (Picture spot, Wash, Showcase), the fitted frustum and the
  one-undo recipe. S3 exposes the ordinary `create-light` planner S7 will call.
- **Fixtures, rigs, saved groups, live-linked rigs, area lights** — D8/S8 or G1.
- **Shadow budget, maximum, cost display, automatic defaults** — S0 Gate C / D9.
- **Format bump** — none.
- **Post-processing, bloom, transmission, baked/cached shadows** — later, gated.
- **Performance benchmarking** — none in this slice.
- **A second Camera, a light camera, a second navigation graph** — *Look through* uses the one
  Camera inspection authority; S3b adds no evaluator or pose interpolation.

## 4. The one-writer rule and the data flow

```text
Library shelf pick ──▶ light tool session (session-only)
                         │
Stage press/drag ────────┴──▶ candidate (update-light / create-light planner preview)
                         │
release ─────────────────────▶ one AuthoringIntent ──▶ F4 acceptance ──▶ Scene 5 install
                                                          │
                                                    one history entry
                                                          │
Card commit ─────────────────────────────────────────────┘
```

- **Every authored write** goes through one pure Scene planner and the route’s one
  `StageAcceptanceHost.accept`. There is no direct `SceneDocument` mutation, no editor-local undo,
  and no second writer.
- **A live gesture never writes.** Pointer moves update a candidate only. Release submits one intent.
  Esc/cancel/blur/lens change/rebind submits none. The last displayed candidate is the committed
  candidate.
- **The Card and the marks share one dispatcher.** Typing `4.2 m` and dragging to the same value
  produce the same planner call, the same refusal words and the same one history entry.
- **Session state is not source.** Armed kind, hover, disclosure, the open placement press and the
  Look-through posture are session-only and never serialized.

## 5. Interfaces

### 5.1 Scene planners (`packages/project-model/src/scene-planning/`)

Add to `SCENE_OPERATION_KINDS`:

```ts
'create-light', 'update-light', 'duplicate-light'
```

These join the existing Scene planner registry (`createScenePlanners`) and the same
`SCENE_PLANNER_ADMISSION` (`scene` only; no compound, units or resources). `delete-one` and
`set-name` already accept any entity and are reused unchanged.

```ts
export type LightKind = 'point' | 'spot' | 'directional';

export type SceneLightChanges = {
  readonly position?: Vec3;
  readonly rotation?: Vec3;
  readonly color?: string;
  readonly intensity?: number;
  /** `null` clears the optional authored range. */
  readonly range?: number | null;
  readonly angle?: number;
  /** `null` clears the optional authored penumbra. */
  readonly penumbra?: number | null;
  readonly castShadow?: boolean;
};

export function planCreateLight(input: {
  readonly context: SceneOperationContext;
  /** Captured by the creation session, never minted inside the planner. */
  readonly entityId: string;
  readonly name: string;
  readonly light: LightKind;
  readonly position: Vec3;
  readonly rotation: Vec3;
  readonly color: string;
  readonly intensity: number;
  readonly range?: number;
  readonly angle?: number;
  readonly penumbra?: number;
  readonly castShadow: boolean;
}): SceneOperationResult;

export function planUpdateLight(input: {
  readonly context: SceneOperationContext;
  readonly entityId: string;
  readonly changes: SceneLightChanges;
}): SceneOperationResult;

export function planDuplicateLight(input: {
  readonly context: SceneOperationContext;
  readonly entityId: string;
  readonly newEntityId: string;
}): SceneOperationResult;
```

**Payloads** (strict readers in `intent-payload.ts`; unknown keys are refusals):

```ts
| {
    readonly kind: 'create-light';
    readonly name: string;
    readonly light: LightKind;
    readonly position: Vec3;
    readonly rotation: Vec3;
    readonly color: string;
    readonly intensity: number;
    readonly range?: number;
    readonly angle?: number;
    readonly penumbra?: number;
    readonly castShadow: boolean;
  }
| {
    readonly kind: 'update-light';
    readonly entityId: string;
    readonly changes: SceneLightChanges;
  }
| { readonly kind: 'duplicate-light'; readonly entityId: string };
```

**Validation (the planner is the authority; the codec is the final backstop):**

- `create-light` and `duplicate-light` capture exactly one new entity id through
  `readSceneOperationAllocation`; the id must be unused. `create-light` addresses no existing
  subject; `update-light` and `duplicate-light` address exactly one Scene entity at the snapshot’s
  exact content revision.
- Name: trimmed, non-empty, ≤ `SCENE_NAME_LIMIT` (120). Creation names are generated by
  `nextLightName(scene, kind)` in the editor (see §5.7), not by the planner.
- `color` is `#rrggbb`; `intensity` finite ≥ 0; `range` finite > 0 or absent; `angle` in
  `(0, π]`; `penumbra` in `[0, 1]`. Spot requires `angle`; point rejects `angle`/`penumbra`;
  directional rejects `range`/`angle`/`penumbra`. The planner validates the **resulting** entity,
  not just the changed fields, so clearing a field cannot leave an invalid kind.
- `update-light` computes the next light, then compares it to the accepted one. No change is
  `no_op`; an invalid result is refused with a field path. It does not clamp.
- `duplicate-light` copies every field, keeps the rotation and `castShadow`, keeps the authored
  name, and offsets X and Z by `LIGHT_DUPLICATE_OFFSET_METERS = 0.5` (the Scene duplicate
  precedent). It preserves Y. It refuses a clustered light with `unsupported-set` until G1
  defines group duplication; it never silently duplicates a group member.
- `delete-one` is the existing delete; Undo restores the same id and all fields.

**Record scope:**

| Operation | Created | Changed fields | Removed |
| --- | --- | --- | --- |
| `create-light` | one | — | — |
| `update-light` | — | the keys actually present in `changes`, including `range`/`penumbra` when cleared | — |
| `duplicate-light` | one | — | — |

All three end in `finalizeSceneCandidate`, so a planner cannot touch another entity, a cluster or a
Camera field.

### 5.2 Light units module (`apps/editor/src/lib/authoring/look/light-units.ts`)

Pure, editor-only, no Svelte and no Three. It is the **only** place the UI mapping lives.

```ts
export const LIGHT_REFERENCE_INTENSITY = Math.PI;
export const LIGHT_BRIGHTNESS_STOPS = [
  { stop: -2, factor: 0.25, label: '−2' },
  { stop: -1, factor: 0.5, label: '−1' },
  { stop: 0, factor: 1, label: '0' },
  { stop: 1, factor: 2, label: '+1' },
  { stop: 2, factor: 4, label: '+2' }
] as const;

export type LightUnit = 'cd' | 'lx';
export function lightUnitOf(kind: LightKind): LightUnit; // point/spot cd, directional lx
export function intensityForStop(stop: number): number;
export function brightnessStopOf(intensity: number): number | 'custom';
export function intensityLabel(intensity: number, kind: LightKind): string;
export function beamHalfAngleDegrees(angleRadians: number): number;
export function beamRadiansFromDegrees(degrees: number): number;
export function penumbraPercent(penumbra: number | undefined): number;
export function penumbraFromPercent(percent: number): number;
export function warmthOf(color: string): 'warm' | 'neutral' | 'cool' | 'custom';
```

**Exact mapping:**

- Stored `intensity` is physical: **candela** for point and spot, **lux** for directional, with
  `decay = 2` for point/spot (Gate A). The document never stores a stop or a label.
- Stop 0 is `π`; every stop is `π × factor`. `brightnessStopOf` returns a stop only when the stored
  intensity is within **0.5%** of that stop’s value; otherwise `'custom'`. A custom value is never
  rounded or rewritten by reading it.
- `intensityLabel` is `3.14 cd` or `3.14 lx`; More shows the exact value.
- Spot `angle` is the **half-angle** in radians. The Card’s Beam reads `30°`, meaning a **30°
  half-angle** (60° full cone), matching the contract and Gate A’s 30° radius check. More labels
  the field **Half-angle** so the reading is unambiguous.
- `penumbra` is stored `0..1`; the inner ring and More read `0..100%`.
- Warmth is a **reading of the stored colour**, not a temperature model. The three provisional
  sRGB stops are `warm #ffd6a5`, `neutral #ffffff`, `cool #dbe9ff`. An exact stop reads its name;
  any other colour reads `Custom` and is edited under More. The Card never shows kelvin. These
  tokens are provisional UI values and do not claim a physical colour temperature; S4’s palette may
  replace them without touching stored light data.

**Creation defaults** (explicit, not inferred):

| Field | Point | Spot | Directional |
| --- | --- | --- | --- |
| `color` | `#ffffff` | `#ffffff` | `#ffffff` |
| `intensity` | `π` (stop 0) | `π` (stop 0) | `π` (stop 0) |
| `range` | absent (unbounded) | distance to the released target, or absent on a plain click | absent (rejected by the kind) |
| `angle` | absent (rejected) | `π/6` (30° half-angle) | absent (rejected) |
| `penumbra` | absent (rejected) | absent (hard edge, 0%) | absent (rejected) |
| `castShadow` | `false` | `false` (provisional; see §6.4) | `false` (provisional; see §6.4) |

No default `range` is invented for a point or a plain-click spot. An absent range is **Unlimited**,
which is truthful and is shown as such.

### 5.3 Light aim module (`apps/editor/src/lib/authoring/look/light-aim.ts`)

Pure. Rotation is the only stored aim truth; there is **no target field**.

```ts
export function directionFromRotation(rotation: Vec3): Vec3;
/** Zero roll, finite direction only. */
export function rotationFromDirection(direction: Vec3): Vec3;
export function lightTarget(light: SceneLightEntity, guideReach: number): Vec3;
export function spotCone(light: SceneLightEntity, guideReach: number): SpotCone | null;
export function spotCapRing(cone: SpotCone, segments?: number): Vec3[];
export function spotInnerRing(cone: SpotCone, penumbra: number, segments?: number): Vec3[];
export function pointReachRing(light: SceneLightEntity, floorY: number, guideReach: number): PointReach | null;
export function directionalBasis(rotation: Vec3): { right: Vec3; up: Vec3; forward: Vec3 };
export function directionalBox(bounds: Bounds, rotation: Vec3): DirectionalBox;
```

- `rotationFromDirection` returns a canonical zero-roll Euler triple for the entity’s local `−Z`
  forward axis (the convention `EntityLight.svelte` already uses). The round-trip
  `directionFromRotation(rotationFromDirection(d)) ≈ d` is the test, not a second convention.
- `spotCone` uses the stored `angle` and `range ?? guideReach`. The cap is
  `position + direction × reach`; its radius is `reach × tan(angle)`. At
  `angle > LIGHT_GUIDE_MAX_HALF_ANGLE = 80°` the cap radius is not drawn (a finite cap would be a
  lie at the tangent asymptote); the guide draws the axis and a **Beam beyond the guide’s cap**
  reading. The exact field still accepts the codec’s full `(0, π]`. This is a **drawing** limit,
  not an authored maximum, and never clamps or rewrites a value.
- `pointReachRing` is the reach sphere’s intersection with the nearest horizontal support plane
  below the light. If the sphere does not reach that plane, the ring is drawn at the light’s own
  height with radius `range ?? guideReach`, dashed as a derived helper. Dragging a floor ring at
  height `h` sets `range = √(ρ² + h²)`; dragging a light-height ring sets `range = ρ`.
- `directionalBox` projects the scene bounds onto the plane perpendicular to the light direction,
  takes the min/max in the two basis axes, and extrudes that rectangle through the bounds. It
  anchors at the bounds centre, **not** at the light position, because a directional light has no
  meaningful position. With no bounds it uses a 10 m cube.

`guideReach(light, bounds)`:

- spot with authored `range`: `range`;
- spot without `range`: `max(1, distance from the light to the farthest scene-bounds corner)`;
- point ring: `range ?? max(1, half the scene-bounds diagonal about the light)`;
- directional: `max(1, scene-bounds diagonal)`;
- no bounds: 5 m for point/spot, 10 m for directional.

This is a **derived guide distance**, never an authored value and never a performance limit.

### 5.4 Light adapter (`apps/editor/src/lib/authoring/adapters/light.adapter.ts`)

The catalogue auto-discovers `*.adapter.ts`; this adapter registers no planners (the Scene
planner registry already owns them) and binds per accepted snapshot like the Scene adapter.

```ts
export const createAdapter: StageAdapterFactory = (services) => {
  // session state, not source
  const placement = createLightPlacementSession(services);
  const binding: StageAdapterBinding = {
    subjects: lights.map(...),            // group: 'light'
    handles(context) { ... },             // only for the selected light
    pick(query, context) { ... },         // emitter glyph, depth-tested
    pressWhenNoTask: true,
    pointerIntent(intent, context) { ... }, // placement + body/target/ring/dial drags
    selectionKeyIntent(intent, context) { ... }, // Delete/Backspace -> delete-one
    cardFacts(subject) { ... },           // Lit by for non-light subjects
    cardName(subject) { ... },            // set-name for lights
    eraseAction(hit) { ... },             // delete-one via the shared action
    hostTools: ['erase'],                 // no measure: a light has no body
    plannerKinds: ['update-light'],       // the only planner a mark names
    dispose() { placement.cancel(); }
  };
  return { id: 'light', ...binding };
};
```

Key decisions:

- **Ownership is split, not duplicated.** The Scene adapter stops publishing lights:
  `subjects` filters `entity.kind !== 'light'`; `pick` already skips them; `cardFacts`,
  `cardWriter`, `cardActions` and `heightTicks` return nothing for a light. The light adapter
  publishes the one light subject. There is one Index row per light, and the host asks the binding
  that owns the subject for marks.
- **Selection is a body-glyph hit, not a cone hit.** The glyph is the projected light position,
  with a 22 px fine / 44 px coarse hit area. The hit is depth-tested against
  `context.pickScene(ray)`: if a rendered surface is nearer than the light, the light is not picked.
  The guide is never a pick target; a click on an empty cone edge selects what is behind it.
- **While the Lights tool is armed**, all emitter glyphs are shown at low emphasis. A press on an
  existing light glyph selects it and disarms the tool; a press on an admitted mark edits the
  selected light; a press elsewhere begins placement. Marks win over placement, so a light can be
  edited immediately after it is placed.
- **Emitter glyphs show** while Lights is armed, on hover and on selection. At rest an unselected
  light has an invisible but hit-testable glyph; hovering reveals it. This is the “finding
  invisible things” rule, not a second selection.
- **`selectionKeyIntent`** claims Delete/Backspace for a selected light and runs the same
  `delete-one` action as the Card; it never opens a second confirmation path.

### 5.5 P0 Look seams (`apps/editor/src/lib/authoring/look/look-authoring.svelte.ts`)

S3 fills the three P0 strata and makes **one typed extension** where P0’s Stage layer cannot carry
the approved mark.

```ts
export type LightLibraryEntry = LookLibraryEntry & {
  readonly icon?: 'light';
  readonly kind?: LightKind;
  /** A secondary entry is revealed under More; no inert entry is shown. */
  readonly tier?: 'primary' | 'more';
};

export type LookStageGuide = {
  readonly id: string;
  readonly role: 'selection' | 'hover' | 'armed';
  readonly segments: readonly (readonly [Vec3, Vec3])[];
  readonly polygons: readonly (readonly Vec3[])[]; // line-only; never filled
  readonly labels?: readonly { readonly world: Vec3; readonly text: string }[];
};
```

- **Card stratum.** For a selected light, `cardStratum(subject)` returns:
  - facts: name/kind are the Card header, so no duplicate; the light-specific readings live in the
    writer;
  - writer: a `StageCardWriterRecord` with `adapterId: 'look.light'`, `summary: 'Light'`,
    `fieldIds` for the fields the writer edits, and `view.component = LightCardFields.svelte`;
  - actions: Duplicate (secondary) and Delete (destructive), both built by
    `light-actions.ts` and both calling the same planners.
  For a non-light subject the stratum returns empty. *Lit by* is contributed by the light adapter,
  not here, because it needs the adapter’s `sceneBounds`.
- **Stage marks.** `stageMarks` stays a projected `StageMarkView[]`; it is used only for any
  non-interactive glyph the light adapter does not own. **Frustum guides are `LookStageGuide[]`**
  returned by a new `stageGuides` getter. `StageOverlay` gains a `guides` prop and one line-only
  `<path>` per guide; the route projects each world point once through the same `facade` evaluation
  it uses for marks. This is the P0 Stage mark layer extended to a line species, not a second
  shell writer and not a second camera.
  - **Why not `StageMarkView`:** its `point`/`ray`/`track`/`ring` vocabulary draws a stem, a knob
    or a handle hit area. A cone has four edges and a cap; faking each edge as a `track` would
    advertise four drag targets that do not exist. The line layer is the truthful representation.
  - **Why not the candidate layer:** `StageCandidatePreview` is the temporary proposal layer; a
    selected light’s guide is persistent while selected. Reusing the candidate layer would make a
    selected light look like an uncommitted proposal.
- **Library shelf.** `libraryShelf` returns
  `{ label: 'Lights', entries: [Point, Spot, (More) Directional] }`. Point and Spot are primary;
  Directional is under `tier: 'more'`, matching the approved study’s “Lights › More”. The shelf has
  no Fixtures row until D8/S8. `pickLibraryEntry(id)` calls `lightTool.arm(kind)`.
- **World toolbar.** The `lights` tool becomes `stage: 'landed'`, opens the Library on the Lights
  shelf, and the old disabled `lights` category/Area tiles are removed. The `Area` option is not
  retained anywhere: S3 has no area light.
- **Route.** The route still constructs `createLookAuthoring` once and reads
  `look.cardStratum`, `look.stageGuides` and `look.libraryShelf`. It adds `stageGuides` to the
  overlay’s props and passes `onSelectReference` to the Card for *Lit by*. No other route-level
  light writer is added.

### 5.6 Light tool session (`apps/editor/src/lib/authoring/look/light-tool.svelte.ts`)

A small editor-only session store, analogous to the existing `wallUnfold` store:

```ts
export type LightToolState = {
  readonly armed: LightKind | null;
  arm(kind: LightKind): void;
  disarm(): void;
  /** The one route notice line; never source or history. */
  notify(message: string): void;
};
```

- `arm(kind)` writes no source and opens no history. `disarm()` ends the placement posture.
- The light adapter reads `armed` in `pointerIntent`; the P0 shelf calls `arm`; Select/Esc/tool
  change calls `disarm`.
- A content install, lens change or adapter rebind cancels a live press and disarms; no candidate
  crosses a source change.

### 5.7 Placement session and state machine

`createLightPlacementSession(services)` is part of the light adapter (session-only).

| State | Entry | Press | Move | Release | Cancel |
| --- | --- | --- | --- | --- | --- |
| `idle` | Select/Esc/tool change | normal Stage pick | — | — | — |
| `armed(kind)` | shelf pick | mark → mark; light glyph → select + disarm; elsewhere → `pressing` | — | — | Esc disarms |
| `pressing(kind, body, target)` | `armed` press | captured | candidate only; no write | one `create-light`; select new light; stay `armed` | Esc/cancel/rebind → `armed`, no history |

**Placement rules:**

- **Point:** click a surface or the working plane. The body is the hit point; one click commits.
  There is no drag-aim.
- **Spot:** press the body, drag, release on the target. The target is a rendered surface hit, else
  the intersection with the horizontal plane through the body’s Y. A plain click (no drag beyond
  the Stage’s existing drag threshold) aims straight down and writes no range.
- **Directional:** click anywhere; the body is stored at `[0, datumMeters, 0]` and has no body
  mark. The direction dial appears for aiming. A directional has no meaningful position.
- **Surface magnet:** a rendered Scene/Layout hit places the body at `hit.point + normal ×
  LIGHT_SURFACE_STANDOFF_METERS` (0.02 m) toward the ray origin. A surface is a magnet, never a
  host; the light is free in space afterwards. If there is no hit, the body is at
  `datumMeters + LIGHT_WORKING_HEIGHT_METERS` (1.5 m, the T2 eye line) on the horizontal plane.
- **No floor-grid snap.** Lights are free spatial subjects; the architecture/object grid snap is
  not applied. Surface hits are exact. The Card is the exact-value path.
- **Target distance:** a spot target drag always writes `range = distance(position, target)`. On a
  plain click, `range` is omitted. The Card’s Reach/More can clear it to Unlimited.
- **Preview:** the candidate frustum is a line-only `StageCandidatePreview` with a body point and a
  “Place spot” / “Place point” label. It is the same planner candidate that commits; the last
  displayed pose is the committed pose.
- **One undo:** one release = one history entry. Cancel = none. The new light is selected; the
  Lights tool stays armed; Esc/Select disarms.

**Name generation:** `nextLightName(scene, kind)` returns “Point light”, “Spot light” or
“Directional light”, appending ` 2`, ` 3` … when that name is taken. The name is authored and
renameable; the Index’s `Kind n` is only for unnamed subjects and is never serialized.

### 5.8 Editing marks

All marks are derived, editor-only, and admitted by the Stage host. A mark is shown only for the
selected light and only when its kind supports it.

| Kind | Mark | `kind` | Fact | Planner | Gesture |
| --- | --- | --- | --- | --- | --- |
| Point/Spot | **Body** | `point` | `position` | `update-light` | Drag in the camera-facing plane through the body; no scale, no hidden axis |
| Spot | **Target** | `point` | `aim` | `update-light` | Drag across surfaces to aim; radial travel sets `range`; live tag is the distance |
| Spot | **Rim** | `ring` (actual world cap) | `beam` | `update-light` | Drag the cap radius; `angle = atan(radius / reach)`; refused beyond 180° |
| Spot | **Inner ring** | `ring` (actual world cap) | `soft-edge` | `update-light` | Shown only when `0.02 ≤ penumbra ≤ 0.98`; drag sets `penumbra`; otherwise the Card/More is the writer |
| Point | **Reach ring** | `ring` | `reach` | `update-light` | Drag on the floor/support plane; range from the sphere intersection; live tag “Reach 5.0 m” |
| Point | **Stem** | derived line | — | — | No hit; reads the height to the nearest surface |
| Directional | **Compass ring** | `ring` at the World mark | `azimuth` | `update-light` | Drag the ring to set the azimuth; the stored rotation is derived |
| Directional | **Elevation ray** | `ray` at the ring point | `elevation` | `update-light` | Drag vertically to set the elevation; the stored rotation is derived |
| Directional | **Direction dial** | the two marks above | — | — | No body, no position mark |

**Mark rules:**

- The body point is a small disc; its live tag is the delta or the position while dragging. It is
  **not** a universal three-axis translate gizmo. The camera-facing plane is the camera-inspired
  move; exact X/Y/Z are under More.
- The target, rim and inner ring are **actual world geometry** for a spot, not calibrated glyph
  sizes: the cap is the measured relationship the creator is editing. Their hit bands stay at least
  22 px fine / 44 px coarse.
- The rim and inner ring do not overlap at the centre; the inner ring is withheld at the degenerate
  ends. At `angle > 80°` the rim is withheld and the Card/More is the writer; the guide says why.
- The direction dial is at the **World mark** (world origin at the datum), not at the light body.
  Its compass ring radius is `max(1, 0.25 × sceneRadius)`; the elevation ray sits at the current
  azimuth. It writes rotation only.
- No light scale: the Scene contract’s “no light scale” stays. No mark writes `scale`.
- The **range-drag gizmo** is not reintroduced. See §6.1 for the exact contract reconciliation.

### 5.9 Card

The Card header is the light name and “Spot light” / “Point light” / “Directional light”. The
writer is `LightCardFields.svelte`; it reads the accepted light and calls the same planners.

**Adjust (at most four named controls, per kind):**

| Kind | Controls |
| --- | --- |
| **Point** | Warmth · Brightness · Reach · Shadow |
| **Spot** | Warmth · Brightness · Beam · Shadow |
| **Directional** | Warmth · Brightness · Shadow |

- **Warmth:** Warm / Neutral / Cool; `Custom` when the stored colour is not an exact stop. More
  has the exact colour and hex reading.
- **Brightness:** five stops −2 … +2; `Custom` when the stored intensity is between stops. More has
  the exact intensity with `cd`/`lx`.
- **Reach:** metres or `Unlimited` (point). A typed value commits one `update-light`; `Unlimited`
  clears `range` with `null`. Spot’s distance is the target/range and is exact under More; the
  Adjust row follows the approved study and does not add a second Reach control.
- **Beam:** half-angle degrees, `1° … 80°` for the drawn guide; More accepts the exact codec range
  up to `180°` and labels it **Half-angle**. A value above 80° reads “Custom” with the guide note,
  never a silent clamp.
- **Shadow:** a toggle writing `castShadow`. No budget, cost estimate or maximum is shown; see
  §6.4. Point starts off (the approved study); spot/directional start off **provisionally** until
  Gate C.
- **More:** exact intensity/unit, exact colour, exact position X/Y/Z (point/spot), exact range
  (point/spot), exact half-angle and soft edge (spot), azimuth/elevation (directional). Every
  exact field commits on Enter, cancels on Esc, and blur never commits. There is one writer.

**Foot / actions:**

- Spot only: **Look through** — absent in S3a, added by S3b (D18: no inert control).
- **Duplicate** (secondary): `duplicate-light`, one history entry; refuses a clustered light.
- **Delete** (destructive): `delete-one`, with the existing undo restoration.
- The Eraser uses the same delete action, so Card and Eraser cannot diverge.

### 5.10 Index and *Lit by*

**Index:**

- `StageSubject` gains `group?: 'light'`; the light adapter publishes each light with
  `group: 'light'`, and the Scene adapter excludes lights. The Index has one row per light.
- `EditorIndex` adds a **Lights** facet (`icon: 'light'`), shown only when at least one light row
  exists. The project-scope “all” list shows a separate **Lights** section after Objects. Search,
  scope, keyboard roving focus and rename use the existing Index paths.
- The kind word for a light is its kind: “Spot light” / “Point light” / “Directional light”.
  `index-labels.ts` gains `lightKindWord(kind)`; `sceneKindWord('light')` remains the fallback.
- Index select goes through the existing `setSelection({ reference })`; the light adapter owns the
  binding, so its marks are the ones the host asks for. Double-click rename goes through the light
  adapter’s `cardName` (`set-name`).
- The Index row’s “bring into view” uses the light’s `worldPoint` (its position). A directional
  light is not a meaningful world point; its row is still listed and selecting it shows the
  direction dial at the World mark. It has no “bring into view” target, so the control is absent
  for a directional (D18).

***Lit by* (derived, never stored):**

- The light adapter contributes one Card fact to a **non-light** subject when at least one light
  guide reaches it:
  `{ label: 'Lit by', value: 'Picture spot · Fill light', select: { reference: lightReference } }`.
  Up to two names are shown, then `+N`; tapping selects the first light in authored order. A full
  list waits for S7/G1.
- Reach is the **guide** test, not illumination and not occlusion: spot = any object-bounds corner
  inside the cone and within `range`; point = distance from the light to the nearest bounds point
  ≤ `range` (or unbounded); directional = the box crosses the bounds. It is recomputed from the
  accepted Scene per selection; there is no side table, relation or serialized field.
- `StageCardFact` gains an optional `select?: { readonly reference: SemanticReference }`. The Card
  renders that fact as a text button and calls the route’s existing `selectStageReference`. This is
  a navigation affordance, not a writer.

### 5.11 Stage, Paper, Preview and visitor

- **Living Stage:** Scene lights render. The selected light shows its line-only guide and marks.
- **Paper Stage:** **Scene lights do not render.** `VisitorEntityGroups` gains
  `includeLights?: boolean` (default `true`); the Stage passes `environment !== 'paper'`, and the
  visitor/Preview passes the same. The existing Paper neutral rig is unchanged. A selected light
  on Paper shows its guide with the state pill **“Guide only · Living shows the light”**. The guide
  is the same line-only mark; it never imitates illumination.
- **Preview:** the authored environment; lights render; no marks, guides, Card, Index or editor
  machinery. The same `EntityLight` values as Stage.
- **Visitor:** the same; no editor chunk. The light guide/authoring modules are editor-only and
  are added to the visitor isolation sweep.
- **Snapshot:** Gate A says the snapshot target is not colour-safe until E6. S3’s brightness and
  Paper evidence uses the live Stage/Preview framebuffer, never a snapshot.
- **Shadow invalidation:** a light edit changes the accepted Scene revision; the existing
  `StageShadowTriggers`/`shadow-invalidation` owner re-renders the shadow maps. S3 adds no shadow
  controller and no budget counter.
- **Guide drawing:** line only, in mark ink; never filled, never tinted with the light colour,
  never brighter where the light is stronger. Selected guide solid for authored facts, dashed for
  derived helpers (unbounded reach, footprint trace, stem). Hover reveals the glyph, not a second
  guide. A light at Brightness 0 still shows its guide.
- **Footprint trace:** for a spot, 16 rays from the apex through the cap rim hit the rendered
  surfaces; connecting hits draw the line-only footprint. It is recomputed on selection, accepted
  edit and drag frames only; it never runs while idle. Misses terminate the line; it is a guide,
  not an illumination prediction. At `angle > 80°` there is no cap and no footprint trace.

### 5.12 *Look through* (S3b, separate PR)

The interface is fixed here so S3a does not paint itself into a corner:

```ts
export type LightLookThrough = {
  readonly lightId: string;
  readonly eye: Vec3;       // the light position, fixed
  readonly target: Vec3;    // derived from the stored rotation and guide reach
  readonly fovYDegrees: number; // the Stage's current lens
};
```

- Enter through `camera.beginLookThrough({ viewId: 'light:' + id, presentationId:
  'light-inspection', label: light.name, eye, target, fovYDegrees })`. This is Camera’s
  **inspection posture**, not a Camera View and not a second camera.
- Orbit/aim uses `reaimLookThroughRay` / `turnLookThrough` at the fixed eye. The light’s position
  does not move; only the provisional target does. No source is written while orbiting.
- **Done** derives `rotationFromDirection(provisional.target − eye)`, submits exactly one
  `update-light { rotation }`, ends the inspection and selects the light. **Exit/Esc** ends the
  inspection and writes nothing. One undo on Done; none on Exit.
- The state pill is **“Looking through Picture spot · Done”**; there is no Camera “Update View”.
- **Spot only.** A point shines every way and a directional has no position, so their Cards have no
  Look-through action.
- **Paper:** entering Look through switches the Stage to Living for the inspection session and
  restores the prior Paper/Living reading on exit. The change is session-only, not authored.
- **Beam coverage is the cone, not the Camera FOV.** S3b projects the same spot-cone geometry S3a
  already publishes through the one Camera evaluation; the Camera's current FOV is context and crop,
  never a claim that the beam is as wide as the lens. No second Camera, pose evaluator or FOV-derived
  beam is added.
- **No Camera document write:** the Camera unit’s Views and routes are untouched. No second pose
  evaluator, FOV interpolation or navigation graph is added.

## 6. Contract and conflict reconciliation

### 6.1 The previously prohibited range-drag gizmo

`docs/reference/components/scene-content.md` currently says:

> Editor-only helpers are mounted for selected lights only and are never serialized; no light
> scale, and no range-drag gizmo.

The approved T2 baseline (§5, D15/D17) adds a point **reach ring** and a spot **far-cap rim** that
edit range/beam. Read literally, the old line forbids exactly those marks. This plan resolves the
conflict rather than silently overriding either text:

- **The prohibition is kept for what it prohibited:** no screen-space radial “range drag” attached
  to the emitter body, no generic range slider on the Stage, and no light scale. The old rule was
  protecting against a gizmo that was not a real spatial relationship.
- **The approved marks are admitted as a different species:** a selected light’s reach ring is the
  intersection of its authored reach sphere with a real support plane; a spot’s rim is the actual
  far cap of its authored cone. Both are derived, line-only frustum instruments. They address a
  real authored field (`range`, `angle`, `penumbra`) and disappear when the light is deselected.
- **The replacement contract text** (applied in the S3a PR):
  > Editor-only helpers are mounted for selected lights only and are never serialized; no light
  > scale and no screen-space radial range gizmo on the emitter. A selected point light’s reach
  > ring and a selected spot’s far-cap rim are admitted frustum instruments: they are derived from
  > the authored range, angle and penumbra, are line-only, and are never serialized. The stored
  > rotation remains the sole aim truth; a target is a derived editor mark, never a field.

This is the only place S3 changes an existing Scene contract line. It is called out in the PR body
for owner confirmation.

### 6.2 Aim truth

`Scene content` says “lights aim by rotation”. T2 §5 says “rotation stays the stored truth; target,
rim, ring, frustum and dial are derived editor marks”. S3 implements exactly that: **no `target`
field, no `aim` field, no second document fact**. The target mark derives rotation; the card never
shows a target as authored data.

### 6.3 Units and angles

- Point/spot intensity is candela; directional is lux; `decay = 2` for point/spot (Gate A). No
  second unit, no legacy conversion.
- Spot `angle` is a half-angle in radians; the UI presents degrees. The Card says **Half-angle**
  under More so “Beam 30°” cannot be read as a full cone.
- `range` is a cutoff, not a decay replacement; absent means unbounded. `penumbra` is a fraction of
  the cone, presented as 0–100%.
- The codec’s existing maxima are the only authored maxima: `angle ≤ π`, `range > 0`,
  `intensity ≥ 0`. S3 adds **no** tighter authored maximum, so there is no valid-but-unsupported
  light to repair. The 80° cap limit is a **guide drawing** limit only. If a future slice adds a
  tighter authored maximum, that slice owes the explicit undoable repair and publication block the
  contract describes; S3 does not invent one.

### 6.4 Shadow defaults remain unresolved

Gate C owns D9. S3 does **not**:

- set a shadow budget, maximum light count or per-kind shadow cost;
- add a shadow-map size/quality control;
- silently pick the study’s implied spot/directional “on” default.

S3 **does** expose the existing authored `castShadow` boolean and writes `false` on every created
light as a **recorded provisional default** until Gate C. This is a reversible default, not a
budget or a performance claim. The Card’s Shadow toggle lets a creator opt in. Gate C may replace
the creation default and add the refusal/budget wording; the Card and planners are the only places
that need to change. The sun’s existing always-on shadow is untouched.

## 7. PR boundaries and order

| PR | Content | Tier | Depends on |
| --- | --- | --- | --- |
| **This draft PR (S3 plan)** | This document only, first commit. Claim `T2.S3`. | Owner review of the plan | #292 merged |
| **S3a — Lights core** (same PR, follow-up commits) | Scene light planners; units/aim; light adapter; placement; marks; guides; Card; Index; *Lit by*; Paper/visitor truth; contract updates; tests. | 1 | Plan approved; #291 Gate A record merged or ported |
| **S3b — Look through** (separate PR) | Camera inspection posture for a spot; Done writes rotation; Paper/Living session switch; tests. | 2 | S3a merged |
| **S3c — nothing** | No third PR. Visual calibration and browser QA land with S3a/S3b. | — | — |

S3a is intentionally one capability PR: the planners, adapter, Card and guides are one interaction
grammar. If the owner wants smaller review units, the natural commit seams are: planners + units →
adapter + placement → marks + guides → Card/Index/*Lit by* → Paper/visitor. Do not split the
planner from its Card writer; that would create a half-working control.

**No merge without owner approval** of this plan and the contract replacement in §6.1. The draft PR
stays draft until then.

## 8. Dependencies

- **P0 #292 (merged):** the seams this plan fills.
- **S0 Gate A, PR #291 (open draft):** the unit and Brightness evidence. S3a implementation may
  begin on the planner/adapter parts, but the Brightness mapping and its tests must consume the
  merged record. If #291 is not merged when S3a reaches the Card, stop and report; do not
  re-measure or invent stops.
- **S0 Gate C (not authorised):** D9 shadow budget and defaults. S3a uses the provisional
  `castShadow: false` and adds no budget. Gate C is not a blocker for placement/aim/Card; it is a
  blocker for any “shadow budget” promise.
- **S7 *Light it*:** not a dependency. S7 calls `create-light` and may fit a spot’s frustum; S3’s
  planner already supports the required fields.
- **G1 Groups:** not a dependency. S3 refuses duplicate on a clustered light and leaves group
  selection to G1.
- **A1 Artwork:** not a dependency. *Lit by* works on any object with bounds; richer subject
  fitting waits for A1/S7.

## 9. Acceptance tests

### 9.1 Unit and contract (fast lane)

- `light-units.test.ts`: all five stops round-trip to `π × factor`; custom values are not rounded;
  candela/lux labels; degrees↔radians; penumbra percent; warmth exact/custom; non-finite/negative
  refusals.
- `light-aim.test.ts`: `rotationFromDirection`/`directionFromRotation` round-trip for +X, −X, +Y,
  −Y, +Z, −Z and a sample oblique direction; zero-length refused; position change preserves
  rotation; target distance; cone cap radius at 30°; point floor-ring intersection.
- `light-planners.test.ts`: create each kind; reject invalid colour/intensity/range/angle/penumbra/
  kind; directional rejects range/angle/penumbra; point rejects angle/penumbra; spot requires
  angle; update partial changes; clear range/penumbra; no-op; duplicate offsets X/Z, preserves Y,
  rotation and all fields; clustered duplicate refused; delete restores the same id; stale revision
  refused; source unchanged on refusal; one history entry per intent.
- `light-placement.test.ts`: surface hit + 0.02 m normal standoff; working-height fallback;
  plain-click aims down; drag release aims at the hit/level plane; preview candidate equals commit;
  Esc/cancel/rebind writes nothing; one undo; no floor-grid snap.
- `light-card.test.ts`: each kind’s Adjust row; Warmth/Brightness/Reach/Beam/Shadow writes; More
  exact fields; commit on Enter only; Esc/blur no write; refused values show the planner’s words;
  no inert control for the wrong kind; Look through absent in S3a; no budget wording.
- `light-index.test.ts`: one Lights row per light, no duplicate under Objects; facet appears only
  when a light exists; search/scope/rename/select; directional has no bring-into-view.
- `light-marks.test.ts`: descriptors admitted only for the selected light; `update-light` is the
  only named planner; body/target/rim/inner-ring/reach/dial geometry; inner ring withheld at 0 and
  1; rim withheld above 80°; hit radii; no mark writes scale; no mark in the visitor graph.
- `light-guides.test.ts`: cone/ring/box geometry; authored vs derived reach; line-only style roles;
  no fill/tint; Paper guide-only state; footprint trace misses terminate; no idle recomputation.
- `light-lit-by.test.ts`: spot/point/directional reach; range cutoff; multiple lights and `+N`;
  tap selects the first; no occlusion claim; no stored relation; selection on a light does not
  produce a self *Lit by*.
- `light-paper.test.ts`: `includeLights === false` on Paper; Scene light is not mounted; the Paper
  rig is unchanged; Living still mounts it; Preview/visit use the authored environment.
- `light-undo.test.ts`: one drag = one entry; cancel = none; undo/redo exact; duplicate/delete;
  selection survives/reconciles through the existing acceptance correspondence.

### 9.2 Architecture (always before PR)

- Extend the visitor/public isolation sweep so `authoring/look/light-*`, the light adapter, light
  guides and the light Card component cannot reach `visitor/*` or the public surface.
- Extend the Stage adapter boundary tests: no second selection, history, renderer or camera; the
  light adapter uses the one facade and the one acceptance host.
- The documentation gate must resolve the new plan’s links (the S0 record link is in PR #291; if it
  is not on `main`, use the PR URL or a relative path that resolves after merge — the plan must not
  fail the docs gate on an unmerged path). **Open item:** use the GitHub URL for the S0 record until
  #291 merges, then replace it with the repository path in the same PR.

### 9.3 Focused manual browser QA (evidence, not full Playwright)

1. Library › Lights: Point/Spot primary, Directional under More; no Area, no Fixtures.
2. Point on a wall and in open space: body standoff, working height, reach ring/stem, Card
   Warmth/Brightness/Reach/Shadow.
3. Spot: press/drag/release; target/rim/inner ring; Beam and distance changes; Soft edge inner ring;
   Card Beam/Shadow; plain click aims down.
4. Directional: World-mark compass ring + elevation ray; box frustum; no body; Card has no Reach or
   Beam.
5. Index: Lights section/facet; select, rename, search, bring into view; no duplicate Objects row.
6. Undo/redo: one action per gesture; Esc cancels; delete restores.
7. Paper: Scene lights do not render; selected guide + “Guide only · Living shows the light”;
   Living renders the light. Preview/visit: light renders, no marks/guides.
8. *Lit by*: select an object under a spot; the fact names it; tap selects the light.
9. Console: no errors, no WebGL warnings from the new lights; shadow toggle does not change the
   light count unexpectedly.
10. Reload/save: the same lights, fields and names come back; no format bump.

No benchmark, no full E2E capture, no snapshot-based colour claim. The owner retains final manual
acceptance.

## 10. Risks and open items

| # | Risk / open item | Handling |
| --- | --- | --- |
| R1 | The old “no range-drag gizmo” line contradicts the approved ring/rim. | §6.1 replacement text; owner confirms in this PR. Not a silent override. |
| R2 | P0’s `StageMarkView` cannot express a frustum. | §5.5 `LookStageGuide` line layer; one Stage instrument extension, no second writer. |
| R3 | Scene lights render on Paper today. | §5.11 `includeLights` prop; shared Stage/visitor renderer change; tests. |
| R4 | Gate A is unmerged. | §8 dependency; Brightness/Card work waits for #291 or an authorised port. |
| R5 | Gate C has not run. | §6.4 recorded provisional `castShadow: false`; no budget, no maximum, no cost claim. |
| R6 | Warmth has no approved physical/token values. | §5.2 provisional sRGB stops; the Card never claims kelvin; stored colour is the truth. |
| R7 | A spot’s cap is undefined near 90° half-angle. | §5.3 80° **guide** cap; exact field still accepts 180°; no clamp, no authored maximum. |
| R8 | *Lit by* can be noisy with many lights. | §5.10 first two names + `+N`, tap first; full list waits for S7/G1. |
| R9 | A model without measured bounds cannot answer *Lit by*. | Skip it; no guessed bounds. A1/A2 owns richer subject bounds. |
| R10 | The light adapter and Scene adapter could both publish a light row. | §5.4 one owner: Scene excludes lights from subjects/pick/Card; light adapter publishes them. Tests pin one row. |
| R11 | A clustered light could be duplicated silently. | `duplicate-light` refuses with `unsupported-set` until G1; `delete-one` keeps the existing cluster cleanup. |
| R12 | The viewport can be crowded by guides at overview zoom. | Guides are selected-only, line-only, and shed the footprint trace and cap above 80°; no idle recomputation. |

## 11. Checks for this plan PR

- `npm run check` — no new type errors.
- `npm run test:arch` — the plan adds no code, but the docs/links gate runs here; it must pass with
  the S0 record link handled as in §9.2.
- No `npm test` is required for a docs-only first commit; S3a runs the full relevant lanes.

## 12. Approval gate

The plan is executable as written after the owner confirms:

1. the §6.1 replacement of the “no range-drag gizmo” line with the admitted frustum-instrument
   rule; and
2. the §6.4 provisional `castShadow: false` for created spot/directional lights until Gate C.

Everything else is an ordinary engineering choice inside the approved baseline. On approval, S3a
proceeds in this draft PR. S3b (*Look through*) is opened as its own PR after S3a merges.
