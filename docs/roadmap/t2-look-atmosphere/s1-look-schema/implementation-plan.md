# T2 S1 Look schema implementation plan

**Claim:** T2 S1 Look schema. **Tier:** 2 (Scene format bump, D2), so the owner decides before merge.
**Base:** `main` at `17d86b00`, which includes the [T2 roadmap](../README.md), S0 Gates A–C
([report](../s0-rendering-gate/report.md), [pipeline](../s0-rendering-gate/pipeline.md)) and A1
Artwork (Scene 7).
**Revision 2** (2026-11-15) addresses the peer review of #354. See
[Review resolution](#review-resolution).

## Goal and scope

S1 adds the authored Scene data for the Look: **Sky**, **Finish**, **Palette** and **Treatment**.
It covers the types, the strict codec, the canonical form, unit validation, persistence, the runtime
projection and the one shared render resolver. The Stage, Visitor Preview and the **published
visit** then draw the same stored look. S1 also adapts the one existing Look writer,
`scene-environment-set`, to the new Sky shape.

The schema is complete for the roadmap's later no-bump slices. S2, S4 and S6 are marked "—" in the
slice table's Format column. They must be able to ship by writing fields defined here.

S1 adds **no control**, per D18. After S1 the editor behaves as it does today:

- every preset and every existing Finish renders with identical descriptors;
- no UI writes a new field.

Out of scope:

- S2: Sky dials, the sun mark, *edited* and Reset UI, and Haze rendering.
- S4: the Finish Card row, Sheen, Paint and From image.
- S6: Looks, Adopt palette and the Treatment control.
- S5: surface finishes and assignments.
- S8: map-slot UI, set import, curated sets, see-through and Glow.
- Issue #353, and sky reflections.

## Decisions settled by existing contracts

| # | Decision | Source |
| --- | --- | --- |
| C1 | One Scene bump for the look schema: **Scene 7 → Scene 8**. Every other version is strictly refused. No migration and no dual reader; fixtures are regenerated. | D2; pre-beta strict-refuse policy |
| C2 | Treatment is authored world presentation, stored in Scene and applied only at resolve time. It never rewrites a Finish. | D11, §6 |
| C3 | No `scene.environment`, no sky-derived reflection, no `envMapIntensity`. No reflection field exists or is promised. | S0 E4 (*wait*) |
| C4 | Paper means no reflection, and Paper is the absence of a Sky. | S0 E5, D4 |
| C5 | Built-in Three materials only, from the shared factory. No shader, TSL or post pass. Treatment is a parameter change. | S0 pipeline, §6 |
| C6 | An Artwork and a Finish never share identity. Artwork keeps `source.assetId`. | D14 |
| C7 | Lights keep their physical units and literal colours. They never follow the palette. | D5, D6 |
| C8 | Scale is in metres, because forms emit metre UVs. | §4 |
| C9 | The Sky is stored as sun azimuth and elevation plus colours and scalars. Time reads elevation; Direction reads azimuth. | §6 |
| C10 | S2, S4 and S6 take no format bump, so S1 carries every field they write. | §12 slice table |

## Final decisions (revision 2)

| # | Question | Decision |
| --- | --- | --- |
| O1 | Palette slots | **Bounded, user-named, ordered slots** with stable ids: 1–8 entries `{id, name, color}`. A follower references the `id`, so renaming a slot never breaks a follower. No architectural roles. |
| O2 | Opacity and emissive | **Still deferred** (pushback below). If S0 later clears see-through or Glow, S8 adds them with its own bump. The S8 Format cell changes from "—" to "bump if see-through/Glow land". This is the only roadmap amendment S1 asks the owner to accept. |
| O3 | Mapping offset | **Included** as `mapping.offset`, in tile fractions [0, 1)², and rendered. No UI. |
| O4 | Haze and shadow softness | **Included.** `haze.visibility` (metres, optional) and `sun.softness` ([0, 1], required). Softness renders in S1 at exact parity. Haze has no render path today, and S2 lands its rendering together with its first writer. |
| O5 | Treatment constants | **Named, tunable render defaults, not schema.** They may be retuned freely until S6 exposes Treatment. After that they are frozen under the catalogue rule: a changed look needs a new treatment id. |

## Scene 8 authored shape

All fields below live in the **Scene unit payload** (`CameraFreeSceneDocument`). The internal
world-local format-1 document keeps its envelope. Its material record gains the Finish fields
because `validateSceneDocument` parses materials. It does not gain palette or environment.

The following rules apply throughout:

- New colours are lowercase `#rrggbb`. An uppercase value is refused with `invalid_color`. Light
  colours keep their current either-case rule.
- The reader returns the **normalized** value: default values and empty objects or arrays are
  dropped. Canonical bytes and content revisions hash that value (`createDomainUnit`).
- Unknown keys are refused with the existing `unexpected_property` / `unknown_property` codes.

### Finish (`SceneMaterialInstance`)

```ts
export type SceneColor = string /* #rrggbb lowercase */ | { readonly slot: string /* palette id */ };

export type SceneFinishMaps = {
	readonly color?: string;      // SceneTextureAsset.id → render slot `map`
	readonly normal?: string;     //                      → `normalMap`
	readonly roughness?: string;  //                      → `roughnessMap`
	readonly occlusion?: string;  //                      → `aoMap`
	readonly metalness?: string;  //                      → `metalnessMap`
};

export type SceneFinishMapping = {
	readonly tileMeters?: readonly [number, number]; // one tile's size in metres, u then v
	readonly rotation?: number;                      // radians about the UV centre (0.5, 0.5)
	readonly offset?: readonly [number, number];     // shift in tile fractions, u then v
};

export type SceneMaterialInstance = {
	readonly id: string;
	readonly name: string;
	readonly baseMaterialId: MaterialId;   // required: a curated catalogue Finish
	readonly color?: SceneColor;
	readonly roughness?: number;
	readonly metalness?: number;
	readonly maps?: SceneFinishMaps;
	readonly mapping?: SceneFinishMapping;
	readonly normalScale?: number;
	readonly normalFlipY?: boolean;
};
```

| Field | Rule | Default (dropped) | Refusal code |
| --- | --- | --- | --- |
| `baseTextureId` | **Retired.** Replaced by `maps.color`. | — | `unexpected_property` |
| `color` | A lowercase hex literal, or `{slot}` | absent | `invalid_color`, `invalid_type` |
| `color.slot` | Must name an `id` in `palette`; checked by the unit validator | — | `unknown_palette_slot` |
| `roughness`, `metalness` | Finite, in [0, 1], as today | absent | existing unit-interval code |
| `maps.*` | Non-empty string naming a `textures[].id` | `{}` | `unknown_texture` (existing) |
| `mapping.tileMeters` | Two finite numbers, each in [0.01, 100] | absent | `invalid_dimension` |
| `mapping.rotation` | Finite, in [0, 2π) | `0` | `invalid_value` |
| `mapping.offset` | Two finite numbers, each in [0, 1) | `[0, 0]` | `invalid_value` |
| `normalScale` | Finite, in (0, 10]. Only allowed with `maps.normal`. | `1` | `invalid_value`, `normal_map_required` |
| `normalFlipY` | Boolean. Only allowed with `maps.normal`. | `false` | `invalid_type`, `normal_map_required` |

Rendering semantics, implemented in the shared resolver:

- **Colour.** The effective factor is the resolved `color` (a literal, or the follower's slot
  value), otherwise the base's `fallbackColor`. This is **today's rule unchanged**: the colour
  multiplies the colour map (glTF `baseColorFactor`), and a catalogue or instance texture is tinted
  by `fallbackColor` exactly as `main` tints it.
  - An untinted image is written explicitly as `color: '#ffffff'`. S4's From image writes that.
  - No new default applies when `maps.color` is present.
- **Maps, per slot.** A slot named in `maps` replaces the base's texture for that slot. Unnamed
  slots keep the base's textures. `maps.color` reproduces `baseTextureId` byte for byte in the
  descriptor and texture spec.
- **Mapping.**
  - `tileMeters` replaces the base's `defaultTileSizeMeters`.
  - `rotation` replaces the 0 that `scene-entity-representation.ts` currently passes.
  - `offset` becomes `Texture.offset` (one unit is one tile).
  - Imported models keep their own UVs, so mapping is ignored on model remaps.
- **Normal.** `normalScale` sets `(s, normalFlipY ? -s : s)`. A catalogue `normalScale` is the
  fallback when the instance sets none. No shipped entry defines one today.

### Texture identity

**A map slot names a `SceneTextureAsset.id`, never a P20 id directly.** The texture record already
carries closure (a typed `texture` resource), release pinning by URI and cold verification by URI.
Keeping it as the one handle leaves all three unchanged.

New rule: if `uri` is `/project-assets/{x}`, then `id` must equal `x`. Otherwise the record is
refused with `texture_id_mismatch`. As a result, one P20 image has exactly one texture record, and
Finishes made from the same image share it.

Artwork's image path stays separate (C6). S4 creates the texture record and its `texture`
resource in the same write as the Finish. Shipped catalogue texture records keep their ids.

### Palette

```ts
export const SCENE_PALETTE_MAX_SLOTS = 8;
export type ScenePaletteSlot = { readonly id: string; readonly name: string; readonly color: string };
// payload: palette?: readonly ScenePaletteSlot[]   (ordered; order is authored)
```

| Rule | Refusal code |
| --- | --- |
| 1–8 entries. An empty array is dropped as absent. | `invalid_palette` |
| `id` is a non-empty string of at most 64 characters, unique within the palette. It is never shown and never changes. | `duplicate_id`, `invalid_value` |
| `name` is trimmed, non-empty, and at most 40 characters. It is shown and editable. Names need not be unique. | `invalid_value` |
| `color` is a lowercase hex value. | `invalid_color` |
| A follower `{slot}` must name an existing `id`. It is checked after delegation, like the Artwork Library closure. | `unknown_palette_slot` |

**Literal versus follower.**

- A follower moves when its slot's colour changes.
- A literal never changes, except through S6's explicit *Adopt palette*.
- Lights, Sky colours, Artwork and frame colours are always literal.

**Writer rules** for S4 and S6 (no writer in S1):

- The write that creates the first follower also creates the palette.
- Deleting a slot converts its followers to literals holding the slot's last colour, in the same
  write, so `unknown_palette_slot` is never reachable from the UI.
- S6 applies a curated Look's palette **by position**: slot *n* takes the Look's colour *n*, and
  names are kept. Adopt palette maps literals to their nearest slot colour. Neither needs roles.

This keeps palettes meaningful for worlds without architecture, such as a standalone object or a
presentation.

### Environment: Sky and Treatment

```ts
export const SCENE_SKY_PRESETS = ['daylight', 'golden-hour', 'dusk'] as const;
export const SCENE_TREATMENTS = ['flat-colour', 'clay'] as const;

export type SceneSky = {
	readonly preset: SceneSkyPreset;   // provenance: Reset target, label, editor plate
	readonly sun: {
		readonly azimuth: number; readonly elevation: number;
		readonly color: string; readonly intensity: number;
		readonly softness: number;
	};
	readonly zenith: string;
	readonly horizon: string;
	readonly ground: string;
	readonly haze: { readonly color: string; readonly visibility?: number };
	readonly hemisphere: { readonly skyColor: string; readonly groundColor: string; readonly intensity: number };
};

export type SceneEnvironment = { readonly sky?: SceneSky; readonly treatment?: SceneTreatment };
// payload: environment?: SceneEnvironment
```

| Field | Rule |
| --- | --- |
| `sky` absent | **Paper:** no Sky and no Sun, as today |
| `treatment` absent | **Natural:** Finishes are shown as authored. `'natural'` is never written and is refused. |
| `environment: {}` | Dropped |
| `preset` | One of `SCENE_SKY_PRESETS`. Every other field is required except `haze.visibility`. |
| `sun.azimuth` | [0, 2π), measured from +Z toward +X |
| `sun.elevation` | [0, π/2] |
| `sun.intensity`, `hemisphere.intensity` | Finite, ≥ 0, in physical units as today (D5) |
| `sun.softness` | [0, 1]. Shadow blur radius = `1 + 4·softness` shadow-map texels. Preset starts use `0.5`, which is today's radius of 3. |
| `haze.color` | Ground-to-horizon fade colour, as today |
| `haze.visibility` | Optional, in metres, [5, 100000]. Absent means clear air, which is today's look. |
| colours | Lowercase hex |

Rules and their reasons:

- **Sun direction:** `from = [sin(az)·cos(el), sin(el), cos(az)·cos(el)]`.
- **Haze semantics (fixed now; S2 implements them):** `visibility` is meteorological visibility,
  meaning the distance at which a surface's contrast against the haze colour falls to 2%.
  - It renders as Three `FogExp2(haze.color, √(ln 50) / visibility)`.
  - S2 decides with evidence which world elements are exempt from fog (sky background, ground
    disc, editor marks). It lands that rendering in the shared `WorldEnvironment` together with
    the first writer, so the Stage and the visit change in one PR.
  - S1 renders absence only. No writer can store a value before S2.
- **Shadow tint** is not a field. It is a reading of the hemisphere fill colours, which S2 edits.
  **Brightness** is not a field. It is an S2 writer that scales both intensities.
- **Preset starts move to project-model as pure data.** `SCENE_SKY_PRESET_STARTS` holds one
  `SceneSky` per preset. Each is converted from today's `WORLD_ENVIRONMENT_LOOKS`:
  - `from` becomes azimuth/elevation: `atan2(x, z)` normalized into [0, 2π), and `asin` of the
    unit vector's y.
  - Values are written with at least 12 significant digits.
  - Colours and intensities are copied unchanged, `softness` is `0.5`, and there is no
    `visibility`.
  - The editor's presentation (`label`, `sub`, `plate`) stays in `render/world-environment.ts`,
    keyed by `preset`. The unused `fog` tuples are deleted.
- **Presets are copied into the World.** Retuning a start never changes a saved World. *Edited*
  means the stored Sky differs from `SCENE_SKY_PRESET_STARTS[preset]` by exact comparison; that
  reading belongs to S2.

### Treatment resolution (non-destructive)

`treatment` is applied inside `resolveSceneMaterial`. The Stage, Preview and the visit all share
that resolver, so there is no surface-specific code. It runs after the Finish resolves and never
writes to the document.

| Treatment | Maps | Colour | Roughness | Metalness |
| --- | --- | --- | --- | --- |
| Natural (absent) | as resolved | as resolved | as resolved | as resolved |
| `flat-colour` | none | resolved factor | `max(r, FLAT_MIN_ROUGHNESS)` | 0 |
| `clay` | none | `CLAY_COLOR` | `CLAY_ROUGHNESS` | 0 |

- The defaults live in `render/materials/treatment.ts`: `FLAT_MIN_ROUGHNESS = 0.6`,
  `CLAY_COLOR = '#d6d3cd'` and `CLAY_ROUGHNESS = 0.9`. They follow the O5 rule.
- In S1, Treatment reaches only what goes through the resolver: primitives, forms, and models
  remapped by a Finish. Artwork, models that keep their own materials, default Layout surfaces and
  editor marks are untouched. S6 must extend Treatment to them before exposing the control (D18).
- Treatment applies in both Living and Paper. The Living/Paper toggle is an editor viewing
  preference.
- Q7 (image average colour) is S6's decision and needs no schema change.

### Curated Finish identity, sharing and versioning

- A **curated Finish** is a catalogue `MaterialId`. A **project Finish** is a
  `SceneMaterialInstance` that references one through `baseMaterialId`.
- Sharing means entities reference the same `materialInstanceId`. The Ask rule and *Just this*
  belong to S4.
- **Versioning is a rule, not a field.** Catalogue ids are append-only, and each id's complete
  definition is immutable: `fallbackColor`, roughness, metalness, `normalScale`, tile size and
  texture URIs. A changed curated look needs a new id, and the old one stays resolvable. A test
  pins every full definition.
- Sky preset starts are copied into Worlds, so neither the catalogue nor the presets carry a
  version number.

### Future surfaces and assignment-level mapping

S1 adds no assignment record and reserves no keys. A Finish names neither its users nor a surface
kind.

`SceneFinishMapping` is exported so that S5a's Layout-keyed `surfaceFinishes` record can carry an
optional `mapping` override, with its own bump. The precedence is documented now and implemented
then: **assignment override, then Finish mapping, then base default.**

## Runtime and published-visit parity

The look must reach every surface through `RuntimeScene`, the one value the Stage, Preview and the
cold release bundle already share.

- `RuntimeScene` gains `palette?` and `environment?` (Sky and Treatment), attached in
  `prepareValidatedUnitRuntime` from the Scene unit. Retained-scene reuse stays keyed by the Scene
  unit, which now contains both.
- **The published visit is fixed in S1.**
  - Today `/p/[publicationId]/+page.svelte` never passes `environment`, so a published World always
    renders Paper, while the cold bundle's envelope carries the Sky.
  - S1 changes the environment shape and must touch every consumer anyway. So
    `VisitorPreviewSurface` replaces its `environment?: SceneEnvironmentPreset` prop with
    `sky?: SceneSky | null`, and the public route passes `readyBundle.scene.environment?.sky ?? null`.
  - Treatment and palette need no prop, because the resolver reads them from `scene`.
  - The editor's snapshot `environmentShown` override keeps its current meaning: an absent Sky
    means Paper.

## Writes in S1

`scene-environment-set` keeps its payload, `{preset: 'paper' | SceneSkyPreset}`:

- `paper` removes `sky`, keeps `treatment`, and drops an environment that becomes empty.
- A preset writes a fresh copy of `SCENE_SKY_PRESET_STARTS[preset]` and keeps `treatment`.
- `no-change` happens only when the stored Sky deep-equals that start, or is already absent for
  `paper`. Choosing the current preset on an edited Sky therefore acts as Reset.
- The change kind stays `scene.environment.updated`.

There are no Finish, palette or treatment writers in S1; those are S4's and S6's. Fixtures and
tests construct these fields directly.

## Persistence and compatibility

- `SCENE_UNIT_FORMAT_VERSION = 8`. A Scene 7 unit, project or release is refused with
  `unsupported_format_version`. Nothing converts it (pre-beta policy).
- API save, load and release reuse `validateUnitPayload`, so no schema is duplicated. Release pins
  already cover every texture record by URI; S1 adds a test for map-named P20 textures.
- The internal world-local format stays at 1, and its codec admits the new material fields.

## Implementation steps (file level)

**Parity golden (step 0).** Before any source change, add
`apps/editor/tests/lib/render/materials/__fixtures__/look-parity-golden.json` and its generator
test. It records the current `sceneLookFor` and `resolveSkySun` output on `main` for:

- every catalogue id with no instance;
- every id with a roughness/metalness instance;
- every id with a `baseTextureId` instance, which later becomes `maps.color`;
- the three presets plus Paper.

Commit it first, so later steps compare against `main` rather than against themselves.

1. **Types** (`packages/project-model`):
   - `scene.ts`: the new `SceneMaterialInstance`, `SceneColor`, `SceneFinishMaps` and
     `SceneFinishMapping`. `RuntimeScene` gains `palette?` and `environment?`.
   - `units/types.ts`:
     - version 8;
     - `SceneSky`, `SceneEnvironment`, `SCENE_SKY_PRESETS` and `SCENE_TREATMENTS`;
     - `ScenePaletteSlot`, `SCENE_PALETTE_MAX_SLOTS`, and `palette?` on `CameraFreeSceneDocument`;
     - remove `SCENE_ENVIRONMENT_PRESETS`, and export `SceneEnvironmentChoice = 'paper' | SceneSkyPreset`.
   - New `units/sky-presets.ts`: `SCENE_SKY_PRESET_STARTS`, `sceneSunFrom(sun)` (unit vector) and
     `sunShadowRadius(softness)`.
   - Exports in `index.ts` and `units/index.ts`.
2. **Codec:**
   - `scene-codec/parse-entities.ts`: the new `parseMaterialInstance` key set;
     `parseSceneColor`, `parseFinishMaps` and `parseFinishMapping`; default-dropping; and
     `texture_id_mismatch` in `parseTextureAsset`.
   - `readers.ts`: `LOWER_HEX_COLOR_PATTERN`.
   - `parse-document.ts`: `maps.*` checked against textures, replacing the `baseTextureId` check.
   - `canonical.ts`: the new material fields.
3. **Unit validation** (`units/validate.ts`):
   - `validateCameraFreeScenePayload` admits `palette`, and parses `palette` and `environment`
     (Sky and Treatment).
   - After delegation it runs the follower check (`unknown_palette_slot`).
   - The normalized value drops empty values.
   - The texture-resource closure is unchanged.
4. **Planner** (`units/planning.ts`): `scene-environment-set`, as specified under Writes.
5. **Runtime** (`units/runtime.ts`): attach `palette` and `environment` to the `RuntimeScene`.
6. **Render** (`apps/editor/src/lib/render`):
   - `materials/scene-instance-material.ts`:
     - The resolver takes `Pick<RuntimeScene, 'materials' | 'textures' | 'palette' | 'environment'>`.
     - It handles per-slot maps, the colour rule, `tileMeters`, `rotation`, `offset`, normal scale
       and flip, and Treatment. It returns `rotation`, `offset` and `normalScale`.
     - `variantSeed` adds treatment. The variant key adds offset.
   - New `materials/treatment.ts`, holding the O5 constants and a pure `applyTreatment`.
   - `resources/material-descriptor.ts` and `material-store.ts`: an optional
     `normalScale: [x, y]` on the standard descriptor.
   - `resources/scene-render-item.ts`: `SceneTextureSpec` gains `rotation` and `offset`.
   - `resources/texture-store.ts`: `variantKey`, `cloneMaps` and `acquire*Variant` take an offset,
     with a default of `[0, 0]`.
   - `scene-entity-representation.ts`: pass the spec's rotation and offset instead of `0`.
   - `scene-render-description.ts`: thread the `RuntimeScene`. A model remap ignores mapping.
   - `world-environment.ts`:
     - Build the look from a `SceneSky`: the sun comes from `sceneSunFrom`, and the shadow
       `radius` from `sunShadowRadius(sky.sun.softness)`.
     - Presentation stays keyed by `preset`.
     - Delete the `fog` tuples.
   - Replace `environment.preset` reads with `environment.sky` in `WorldEnvironment.svelte`,
     `StageCanvas.svelte`, `VisitorPreviewSurface.svelte`, `StageEnvironmentControl.svelte`,
     `SkyControl.svelte`, `look-authoring.svelte.ts` and the spatial route. Tiles show the
     `preset`, or Paper when the Sky is absent. No new control is added.
7. **Delivery:**
   - `routes/p/[publicationId]/+page.svelte`: pass `sky`.
   - `visitor/visitor-cold-runtime.ts` `validateColdReleaseReferences`: check every `maps.*` id,
     replacing `baseTextureId`.
   - `apps/api` release pins: add a test only. No change is expected.
8. **Fixtures:**
   - Change Scene-unit `formatVersion: 7` to 8, and import `SCENE_UNIT_FORMAT_VERSION` in
     TypeScript files. This covers:
     - `apps/api/tests/{test-support,save-units,model-resources,projects}.mjs`;
     - `apps/editor/tests/lib/authoring/__fixtures__/{unit-envelope-fixtures,s17-mixed-project,counting-scene}.ts`;
     - `apps/editor/tests/lib/experience/__fixtures__/x-fixtures.ts`;
     - `units-conformance`, `units-canonical-form`, `scene-codec` and `visitor-cold-runtime`;
     - `perf/lib/workloads/registry.ts`.
   - **Leave Layout's `formatVersion: 7` alone.**
   - Rewrite `baseTextureId` fixtures as `maps.color`, and `{preset}` environments as
     `{sky: SCENE_SKY_PRESET_STARTS[p]}`.
   - Regenerate revisions and snapshots with the existing helpers. Never hand-edit hashes.
9. **Contracts** (in this PR):
   - `docs/reference/components/scene-content.md`: fields, codes, the catalogue rule and palette
     writer rules.
   - `persistence.md` and `scene-codec.md`: Scene 8.
   - `assets.md`: the texture id rule.
   - `rendering.md`: the colour rule, mapping, softness, the Haze semantics owned by S2, and
     Treatment.
   - `architecture.md` and `composition-execution.md`: the format number.
   - `AGENTS.md`: "Scene 7" becomes "Scene 8".
   - Roadmap §12: the S8 Format cell (O2), with owner acceptance.

**Dependencies:** step 0 comes first, then steps 1 to 7 in order (4 and 5 after 3). Step 8 runs
alongside 2–7, and step 9 comes last. It is one PR with no parallel split, because every step shares
the Scene types.

## Tests

| Area | File | Must prove |
| --- | --- | --- |
| Material parity | `scene-instance-material.test.ts` against the step-0 golden | Every golden case is identical after the change, with `baseTextureId` re-expressed as `maps.color`. This includes the tinted map: `wood-walnut` keeps `#3d2a1a` over its map. |
| Codec | `tests/lib/content/scene-codec.test.ts` | Each row of the field tables. `baseTextureId` is refused. Defaults are dropped, and parse(canonical(parse(x))) equals parse(x). `texture_id_mismatch`. `unknown_texture` for every map key. `normal_map_required` for both fields. Uppercase hex is refused. Offset of `1` is refused. |
| Unit | `units-conformance`, `units-canonical-form` | Scene 7 is refused and 8 admitted. Palette bounds (9 entries refused; `[]` dropped to absence, per the Palette table), duplicate ids, name rules, `unknown_palette_slot`. Each environment bound (softness, visibility, elevation, `'natural'`). `environment: {}` dropped. Key order doesn't affect the canonical form. |
| Presets | new `sky-presets.test.ts` | `sceneSunFrom(start.sun)` equals today's normalized `from` within 1e-9. Colours and intensities equal the old table. `sunShadowRadius(0.5) === 3`. |
| Sky parity | `world-environment.test.ts` against the golden | `resolveSkySun` descriptors are identical for every preset. Paper is still null. |
| Planner | unit planner tests | Paper removes the Sky and keeps the treatment. A preset writes a fresh start and keeps the treatment. Reset of an edited Sky. `no-change`. |
| Resolver | `scene-instance-material.test.ts` | Follower and literal colours. Per-slot override. Tile, rotation and offset reach the spec. Normal scale and flip. Flat colour and Clay outputs. Treatment never mutates the input (deep-frozen). Model remaps ignore mapping. |
| Parity | `scene-render-description.test.ts`, Stage/visitor parity tests | One `RuntimeScene` gives identical descriptors on the Stage and visitor paths, with and without Treatment. |
| Published visit | `visitor-cold-runtime.test.ts`, public route test | A Golden-hour envelope's bundle carries `scene.environment.sky` equal to the stored Sky. The public page passes it to the surface. An unknown `maps.normal` blocks. A map-named P20 texture needs release bytes. |
| Catalogue | `materials.test.ts` | The **complete** definition of each of the six ids is pinned: label-independent appearance fields and texture URIs. `SHIPPED_MATERIALS.textureUris` equals each editor definition's texture values. |
| Isolation | existing `public-surface-boundary` / chunk tests | No editor import reaches the visitor chunks; the presets live in project-model. |

## Failure cases

These must all be refused:

- Scene 7;
- `baseTextureId`;
- a follower naming a missing slot;
- a palette with 9 slots, or with duplicate ids (an empty palette is dropped, not refused);
- `normalScale` without a normal map;
- `rotation = 2π`;
- `offset = [1, 0]`;
- `tileMeters = [0, 1]`;
- a P20 texture whose id differs from its asset;
- a Sky missing `haze.color` or `sun.softness`;
- `elevation > π/2`;
- `visibility = 1`;
- `treatment: 'natural'`.

A release whose Finish names a P20 texture without bytes is a blocking cold-runtime issue.

## Acceptance criteria

1. `npm run check`, `npm test`, `npm run check:api` and `npm run test:api` pass.
2. Every Scene unit in the repo is format 8. In production code (`apps/*/src`, `packages/*/src`),
   `git grep` finds no `baseTextureId`, `environment.preset`, `SCENE_ENVIRONMENT_PRESETS` or
   preset `fog` reads. Tests that assert refusal may name them.
3. The step-0 golden holds: material and Sun descriptors for every catalogue look, every
   `baseTextureId` conversion, Paper and the three presets are identical to `main`.
4. The Stage, Preview and a **published** release render the same stored Sky and Treatment. A
   Golden-hour release opened at `/p/…` shows the Golden-hour Sky. The evidence is focused manual
   browser QA (Stage, Preview, local published visit); final acceptance stays with the owner.
5. Fixtures exercise every new field through save, reopen and release.
6. The step 9 contracts are amended, and the owner has accepted or changed O1–O5.

## Review resolution

| Review item | Verified against | Outcome |
| --- | --- | --- |
| 1 Published visit | The `/p/[publicationId]` route passes no `environment`; `composeColdReleaseBundle` returns only `RuntimeScene` | **Accepted, fixed in S1** through `RuntimeScene.environment` and a `sky` prop. |
| 2 S2 readiness | §12 marks S2 with no format change; §6 lists Haze and shadow softness | **Accepted.** `haze.visibility` and `sun.softness` are added. Softness renders now (r187 PCF reads `shadow.radius`, today fixed at 3). Haze rendering lands with its writer in S2; its meaning is fixed here. |
| 3 Material parity | The resolver always uses `catalogue.fallbackColor`, so `baseTextureId` maps are tinted today | **Accepted.** Revision 1's white-under-image rule would have changed looks. It is dropped, and a golden from `main` is required. |
| 4 Palette | §14 Q5 recommended fixed roles for predictable Looks | **Accepted, with a refinement.** Stable ids are kept separate from names, and Looks apply by position, which keeps Adopt and Look application deterministic without roles. |
| 5 Offset | §4 lists `mapping { tileMeters, rotation, offset }` | **Accepted**, in tile fractions, and rendered. |
| 6 O2 | §12 marks S8 "—" but says "see-through and Glow **as S0 allows**"; S0 gave neither a go | **Pushed back.** Fields with unproven rendering contradict §8 ("S0 is a gate"), and transparency affects sorting, depth and shadows. S8 takes a cheap bump if S0 clears them (D2). |
| 6 O4 / O5 | — | O4 is reversed (item 2). O5 constants are tunable defaults, frozen once S6 ships, because releases render through current code. |
| 7 Tests | The catalogue has two sources: editor `content/materials.ts` and project-model `SHIPPED_MATERIALS` | **Accepted.** Full definitions plus cross-source consistency are pinned. Obsolete-field searches are scoped to production code, since refusal tests must name retired keys. |

## Remaining risks

- **Haze is authored before it renders.** Until S2, a stored `visibility` (fixtures only) renders
  clear air on every surface alike. S2 must land the fog together with its first writer, and must
  evaluate fog's effect on Artwork and editor marks.
- **Softness is in texels.** As today, blur width scales with the World-sized shadow camera.
  Acceptable for parity; S2 may revisit it under evidence, with a bump.
- **Palette by position** makes a curated Look's palette meaningful only in slot order. S6 owns
  how it presents that.
- **Strict refusal** means existing Scene 7 drafts and releases stop opening after merge (accepted
  pre-beta policy).
- **Treatment covers only part of a World** until S6 extends it; no control exists before then.

## Readiness

Implementation can proceed with **no further architectural decision**. One owner acceptance is
outstanding, and it does not block coding: O2's S8 Format-cell amendment, plus confirmation of
O1–O5 at the Tier 2 checkpoint. Recommended effort: **high**. The work is a multi-package format
bump of about 18 source files and about 50 fixture/test files, with a golden-parity obligation. One
agent should do it in one PR, followed by one fresh-context review that reports every verified
finding.
