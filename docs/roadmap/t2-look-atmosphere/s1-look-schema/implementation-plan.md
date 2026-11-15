# T2 S1 Look schema implementation plan

**Claim:** T2 S1 Look schema. **Tier:** 2 (Scene format bump, D2). The owner decides before merge.
**Base:** `main` at `17d86b00`. It includes the [T2 roadmap](../README.md), S0 Gates A–C
([report](../s0-rendering-gate/report.md), [pipeline](../s0-rendering-gate/pipeline.md)) and A1
Artwork (Scene 7).

## Goal and scope

S1 adds the authored Scene data for the Look: **Sky**, **Finish**, **Palette** and **Treatment**.
This covers types, the strict codec, canonical form, unit validation, runtime projection and the one
shared render resolver, so that the Stage, Visitor Preview and the published visit draw the same
stored look. It also adapts the one existing Look writer, `scene-environment-set`, to the new Sky
shape.

S1 adds **no control**, following D18 (no inert controls). After S1 the editor looks exactly as it
does today: every preset renders pixel-identically, and no new field is written by any UI.

Out of scope:

- **S2:** Sky dials, the sun mark, *edited* and Reset UI, and the retirement of the unmounted panel.
- **S4:** the Finish Card row, Sheen, Paint, and From image.
- **S6:** the Looks UI, Adopt palette, and the Treatment control.
- **S5:** surface finishes and their assignment record.
- **S8:** map-slot UI, set import, opacity, glow and curated sets.
- **Issue #353.**
- Fog, shadow softness and sky reflections.

## Decisions settled by existing contracts

| # | Decision | Source |
| --- | --- | --- |
| C1 | One Scene bump for the whole look schema: **Scene 7 → Scene 8**. Readers refuse every other version strictly. No migration, no dual reader. Fixtures are regenerated. | D2; pre-beta strict-refuse policy |
| C2 | Treatment is authored world presentation. It lives in Scene, is applied only when the look is resolved, and never rewrites a Finish. | D11, §6 |
| C3 | No `scene.environment`, no sky-derived reflection, no `envMapIntensity`. The schema has no reflection field, and nothing promises one. | S0 E4 (*wait*) |
| C4 | Paper has no reflection, and Paper is the absence of a Sky. | S0 E5, D4 |
| C5 | Renderer portability: built-in Three materials, built only by the shared factory. No shader, TSL or post pass. Treatment is parameter changes only. | S0 pipeline, §6 |
| C6 | An Artwork and a Finish never share identity. Artwork keeps `source.assetId`. | D14 |
| C7 | Light colours and units are untouched. Lights stay literal and never follow the palette. | D5, D6 |
| C8 | Scale is stated in metres, because forms emit metre UVs. | §4 |
| C9 | The Sky is stored as sun azimuth and elevation, plus colours and scalars. Time is a UI reading of elevation, and Direction is a UI reading of azimuth. | §6 |

## Owner decisions (defaults the implementation uses)

Each default below is reversible before merge. Changing one changes only the named section.

| # | Question | Default in this plan | If changed |
| --- | --- | --- | --- |
| O1 | Palette: free swatches or fixed roles? (§14 Q5) | **Fixed roles:** `wall · floor · trim · accent · ink` | §Palette slot list |
| O2 | Opacity and emissive in Scene 8? | **Excluded.** S0 never cleared see-through or Glow, so S8 adds them with its own bump. The roadmap's More row lists them; this plan defers them. | Add two fields and a resolver path |
| O3 | Mapping `offset`? | **Excluded.** No planned control (Scale, Direction) writes it. | Add `offset: [u, v]` |
| O4 | Fog distances and shadow softness stored now? | **Excluded.** Neither renders today: fog is unused, and the shadow radius is fixed at 3. S2 adds each field together with its rendering. | S2 bump |
| O5 | Treatment constants | Flat colour: roughness ≥ 0.6, metalness 0. Clay: `#d6d3cd`, roughness 0.9. S6 may retune these with no format change. | Constants only |

## Scene 8 authored shape

All fields below live in the **Scene unit payload** (`CameraFreeSceneDocument`). The internal
world-local format-1 document keeps its envelope. Its material record gains the new Finish fields
because `validateSceneDocument` parses materials; it does not gain palette or environment.

The following rules apply throughout:

- Colours are lowercase `#rrggbb`. A new field written in uppercase is refused with `invalid_color`.
  Light colours keep their current either-case rule.
- A reader returns the normalized value: values that equal their default and empty objects are
  dropped, so absence and the default produce the same bytes.
- A key the reader does not know is refused with the existing `unexpected_property` /
  `unknown_property` codes.

### Finish (`SceneMaterialInstance`)

```ts
export type SceneColor = string /* #rrggbb lowercase */ | { readonly slot: ScenePaletteSlot };

export type SceneFinishMaps = {
	readonly color?: string;      // SceneTextureAsset.id → render slot `map`
	readonly normal?: string;     //                      → `normalMap`
	readonly roughness?: string;  //                      → `roughnessMap`
	readonly occlusion?: string;  //                      → `aoMap`
	readonly metalness?: string;  //                      → `metalnessMap`
};

export type SceneFinishMapping = {
	readonly tileMeters?: readonly [number, number]; // one tile's size in metres, u then v
	readonly rotation?: number;                      // radians, about UV centre (0.5, 0.5)
};

export type SceneMaterialInstance = {
	readonly id: string;
	readonly name: string;
	readonly baseMaterialId: MaterialId;   // required, a catalogue (curated) Finish
	readonly color?: SceneColor;
	readonly roughness?: number;           // [0, 1]
	readonly metalness?: number;           // [0, 1]
	readonly maps?: SceneFinishMaps;
	readonly mapping?: SceneFinishMapping;
	readonly normalScale?: number;         // (0, 10]
	readonly normalFlipY?: boolean;
};
```

| Field | Rule | Default (dropped) | Refusal code |
| --- | --- | --- | --- |
| `baseTextureId` | **Retired.** Its job moves to `maps.color`. | — | `unexpected_property` |
| `color` | A lowercase hex string, or `{slot}` where `slot` is one of `SCENE_PALETTE_SLOTS` | absent | `invalid_color`, `invalid_palette_slot` |
| `color.slot` | Requires a Scene `palette` (checked by the unit validator) | — | `palette_required` |
| `roughness`, `metalness` | Finite and in [0, 1], as today | absent | existing unit-interval code |
| `maps.*` | A non-empty string naming a `textures[].id` | `{}` is dropped | `unknown_texture` (existing) |
| `mapping.tileMeters` | Two finite numbers, each in [0.01, 100] | absent | `invalid_dimension` |
| `mapping.rotation` | Finite and in [0, 2π) | `0` is dropped | `invalid_value` |
| `normalScale` | Finite and in (0, 10]. Admitted only with `maps.normal`. | `1` is dropped | `invalid_value`, `normal_map_required` |
| `normalFlipY` | A boolean. Admitted only with `maps.normal`. | `false` is dropped | `invalid_type`, `normal_map_required` |

Rendering semantics, implemented in the shared resolver:

- **The colour multiplies the colour map**, as glTF `baseColorFactor` does. The effective colour is
  resolved in this order:
  1. the resolved `color`;
  2. otherwise `#ffffff` if `maps.color` is present;
  3. otherwise the base's `fallbackColor`.

  Today a catalogue `fallbackColor` tints catalogue textures, and this order keeps that look
  exactly.
- **Map precedence is per slot.** A slot in `maps` replaces the base catalogue's texture for that
  slot. Slots not named in `maps` keep the base's textures.
- **Mapping:**
  - `tileMeters` replaces the base `defaultTileSizeMeters`.
  - `rotation` replaces the rotation of 0 currently passed by `scene-entity-representation.ts`.
  - Imported models keep their own UVs, so mapping is ignored on model remaps.
- `normalScale` sets `normalScale = (s, flipY ? -s : s)` on the standard material.

### Texture identity (roadmap Q: P20 id or `SceneTextureAsset`)

**A map slot names a `SceneTextureAsset.id`, never a P20 id directly.** The texture record already
carries closure (a typed `texture` resource), release pinning by URI (API `prepareArtworkPins`) and
cold verification by URI. Keeping it as the one handle leaves all three unchanged.

New rule: when `uri` is `/project-assets/{x}`, `id` must equal `x`. A mismatch is refused with
`texture_id_mismatch`. The rule gives one P20 image exactly one texture record, so two Finishes
from the same image share it.

The Artwork image path is separate and unchanged (C6). S4 creates the texture record and its
`texture` resource in the same write as the Finish that uses it. Shipped catalogue texture URIs keep
their current ids.

### Palette

```ts
export const SCENE_PALETTE_SLOTS = ['wall', 'floor', 'trim', 'accent', 'ink'] as const;
export type ScenePaletteSlot = (typeof SCENE_PALETTE_SLOTS)[number];
export type ScenePalette = { readonly [S in ScenePaletteSlot]: string };
// payload: palette?: ScenePalette
```

- All five slots are required when `palette` is present, and each is a lowercase hex value.
  A missing slot is refused with `invalid_palette`; an unknown key with `unexpected_property`.
- **Literal versus follower:**
  - A `{slot}` colour follows the palette, so editing a palette value moves every follower.
  - A literal never changes, except through S6's explicit *Adopt palette*.
  - Lights, Sky colours, artwork and frame colours are always literal.
- S1 defines no default palette constant. The first writer that creates a follower (S4/S6) writes
  the palette in the same accepted operation, which keeps `palette_required` satisfiable.
- The unit validator refuses a follower when the palette is absent (`palette_required`), checked
  after delegation, in the same way as the Artwork Library closure.

### Environment: Sky and Treatment

```ts
export const SCENE_SKY_PRESETS = ['daylight', 'golden-hour', 'dusk'] as const;
export const SCENE_TREATMENTS = ['flat-colour', 'clay'] as const;

export type SceneSky = {
	readonly preset: SceneSkyPreset;      // the start it came from: Reset target, label, editor plate
	readonly sun: { readonly azimuth: number; readonly elevation: number; readonly color: string; readonly intensity: number };
	readonly zenith: string;
	readonly horizon: string;
	readonly ground: string;
	readonly haze: string;                // horizon fade colour
	readonly hemisphere: { readonly skyColor: string; readonly groundColor: string; readonly intensity: number };
};

export type SceneEnvironment = { readonly sky?: SceneSky; readonly treatment?: SceneTreatment };
// payload: environment?: SceneEnvironment
```

| Field | Rule |
| --- | --- |
| `sky` absent | **Paper.** There is no Sky and no Sun, as today. |
| `treatment` absent | **Natural**, meaning finishes are shown as authored. |
| `environment: {}` | Dropped by the reader. |
| `sun.azimuth` | In [0, 2π), measured from +Z toward +X |
| `sun.elevation` | In [0, π/2] |
| `sun.intensity`, `hemisphere.intensity` | Finite and ≥ 0, in physical units as today (D5) |
| every colour | Lowercase hex |
| `preset` | One of `SCENE_SKY_PRESETS`. Every other field is required. |

- **Sun direction:** `from = [sin(az)·cos(el), sin(el), cos(az)·cos(el)]`.
- **Preset starts move to project-model as pure data.** `SCENE_SKY_PRESET_STARTS` holds a
  `SceneSky` for each preset. The values are converted from today's `WORLD_ENVIRONMENT_LOOKS`:
  - Each `from` vector becomes an azimuth/elevation pair: `atan2` normalized into [0, 2π), and
    `asin` of the unit vector's y component.
  - Every value is written with at least 12 significant digits.
  - The colours and intensities are copied unchanged.
- **The editor keeps its presentation-only data.** `label`, `sub` and `plate` stay in
  `render/world-environment.ts`, keyed by `preset`. They never enter the schema. Fog and the shadow
  radius are not authored (O4).
- **A preset is copied into the World.** Retuning a preset start later never changes a saved
  World. *Edited* means the stored Sky differs from `SCENE_SKY_PRESET_STARTS[preset]` by exact
  value comparison; that reading is for S2.

Brightness is not a field. It is a later S2 writer that scales the sun and hemisphere intensities.

### Treatment resolution (non-destructive)

`treatment` is applied inside `resolveSceneMaterial`. Because the Stage, Preview and the visit share
that resolver, Treatment needs no surface-specific code. It is evaluated after a Finish resolves
normally, and the authored Finish is never written to.

| Treatment | Maps | Colour | Roughness | Metalness |
| --- | --- | --- | --- | --- |
| Natural (absent) | as resolved | as resolved | as resolved | as resolved |
| `flat-colour` | none | the resolved colour factor (palette slot or literal, otherwise fallback) | `max(r, 0.6)` | 0 |
| `clay` | none | `#d6d3cd` | 0.9 | 0 |

In S1, Treatment reaches only looks that go through the resolver: primitives, forms, and models
remapped by a Finish. Artwork, models that keep their own materials, default Layout surfaces and
editor marks are untouched. S6 must extend Treatment to those before it exposes the control (D18).
Treatment applies in both Living and Paper; the Living/Paper toggle is an editor viewing preference
and stays separate. Whether *Flat colour* uses an image's average colour (Q7) is S6's decision and
needs no schema change.

### Curated Finish identity, sharing and versioning

- A **curated Finish** is a catalogue `MaterialId`. A **project Finish** is a `SceneMaterialInstance`
  that references it through `baseMaterialId`.
- Sharing means entities reference the same `materialInstanceId`. The Ask rule and *Just this*
  cloning belong to S4.
- Catalogue versioning is a documented rule, not a field: **catalogue ids are append-only and their
  appearance is immutable.** A changed curated look gets a new id, and the old id stays resolvable.
  A test pins today's six ids. Sky preset starts are copied (above), so neither the catalogue nor
  the presets carry a version number.

### Future surfaces and assignment-level mapping

S1 adds no assignment record and reserves no keys. A Finish names neither its users nor a surface
kind. `SceneFinishMapping` is exported so that S5a's Layout-keyed `surfaceFinishes` record can carry
an optional `mapping` override with its own bump. The precedence is documented now and implemented
then: **assignment override → Finish mapping → base default.**

## Writes in S1

- `scene-environment-set` keeps its payload `{preset: 'paper' | SceneSkyPreset}`:
  - `paper` removes `sky`, keeps `treatment`, and drops an environment that ends up empty.
  - Any other preset writes a fresh copy of `SCENE_SKY_PRESET_STARTS[preset]` and preserves
    `treatment`.
  - `no-change` is returned only when the stored Sky deep-equals that start, or is already absent
    for `paper`. Choosing the preset of an edited Sky therefore acts as Reset.
  - The change kind stays `scene.environment.updated`.
- There are no Finish, palette or treatment writers; those belong to S4 and S6. Fixtures and tests
  construct these fields directly.

## Persistence and compatibility

- `SCENE_UNIT_FORMAT_VERSION = 8`. A Scene 7 (or any other version) unit, project or release is
  refused with `unsupported_format_version`. Saved Scene 7 projects stop opening, per the pre-beta
  policy; nothing converts them.
- Canonical bytes come from the normalized reader value (`createDomainUnit`), so the omitted
  defaults are part of the canonical form.
- API save, load and release reuse `validateUnitPayload`. No API schema is duplicated. The one API
  change is in the release-pin path (step 7).
- The internal world-local format stays at 1, and its codec admits the new material fields.

## Implementation steps (file level)

1. **Types** (`packages/project-model`):
   - `scene.ts`: the new `SceneMaterialInstance`, `SceneColor`, `SceneFinishMaps`,
     `SceneFinishMapping`, `ScenePaletteSlot` and `SCENE_PALETTE_SLOTS`. `RuntimeScene` gains
     `palette?` and `treatment?`.
   - `units/types.ts`: the version 8 constant, `SceneSky`, `SceneEnvironment`, the presets and
     treatments, `ScenePalette`, and `palette?` on `CameraFreeSceneDocument`. Remove
     `SCENE_ENVIRONMENT_PRESETS` and its `'paper'` member, and export
     `SceneEnvironmentChoice = 'paper' | SceneSkyPreset` for the planner payload.
   - New `units/sky-presets.ts`: `SCENE_SKY_PRESET_STARTS` and `sceneSkyFrom(sun)`, which returns
     the unit vector.
   - Update the exports in `index.ts` and `units/index.ts`.
2. **Codec:**
   - `scene-codec/parse-entities.ts`: rewrite `parseMaterialInstance` to the new key set, add
     `parseSceneColor`, `parseFinishMaps`, `parseFinishMapping` and default-dropping, and add the
     `texture_id_mismatch` rule to `parseTextureAsset`. Add `LOWER_HEX_COLOR_PATTERN` in
     `readers.ts`.
   - `parse-document.ts`: check `maps.*` for unknown textures, replacing the `baseTextureId` check.
   - `canonical.ts`: write the new material fields explicitly.
3. **Unit validation** (`units/validate.ts`):
   - `validateCameraFreeScenePayload` admits the key `palette` and parses `palette` and
     `environment` (sky and treatment).
   - After delegation, it refuses a follower without a palette (`palette_required`).
   - The normalized return value drops empty values.
   - The texture-resource closure (lines ~1494–1512) is unchanged.
4. **Planner** (`units/planning.ts`): `scene-environment-set` as described under Writes.
5. **Runtime** (`units/runtime.ts`): after `resolveSceneDocument`, attach `palette` and
   `environment.treatment` from the unit to the `RuntimeScene`. Retained-scene reuse stays keyed by
   the Scene unit, which now contains both.
6. **Render** (`apps/editor/src/lib/render`):
   - `materials/scene-instance-material.ts`:
     - The resolver takes `Pick<RuntimeScene, 'materials' | 'textures' | 'palette' | 'treatment'>`.
     - It applies per-slot maps, the colour order, mapping (`tileMeters`, `rotation`), the normal
       scale and flip, and Treatment.
     - `variantSeed` adds the rotation and the treatment.
     - It returns `rotation` and `normalScale`.
   - `resources/material-descriptor.ts` and `material-store.ts`: add an optional
     `normalScale: [x, y]` to the standard descriptor, set on `MeshStandardMaterial`.
   - `resources/scene-render-item.ts`: `SceneTextureSpec` gains `rotation`.
   - `scene-entity-representation.ts`: pass the spec rotation instead of 0.
   - `scene-render-description.ts`: thread the `RuntimeScene` through. A model remap ignores
     mapping.
   - `world-environment.ts`:
     - The look is built from a `SceneSky`: the sun `from` comes from `sceneSkyFrom`, and the
       colours and intensities come from the stored values.
     - Presentation stays keyed by `preset`.
     - `resolveSkySun` is unchanged apart from its input.
   - `WorldEnvironment.svelte`, `StageCanvas.svelte`, `VisitorPreviewSurface.svelte`,
     `StageEnvironmentControl.svelte`, `SkyControl.svelte`, `look-authoring.svelte.ts` and
     `routes/project/[projectId]/spatial/+page.svelte`: read `environment.sky` in place of
     `environment.preset`. The tiles show the preset, with Paper when the Sky is absent. No new
     control is added.
7. **Delivery:**
   - `visitor/visitor-cold-runtime.ts` `validateColdReleaseReferences`: check every `maps.*` id
     against the scene textures, replacing `baseTextureId`.
   - `apps/api/src/artwork-persistence.ts` release pins: confirm that texture pins already cover
     every texture record. No change is expected; add a test if none exists.
8. **Fixtures:**
   - Bump every Scene-unit `formatVersion: 7` to 8, and import `SCENE_UNIT_FORMAT_VERSION` where
     the file is TypeScript. Files include `apps/api/tests/{test-support,save-units,model-resources,projects}.mjs`,
     `apps/editor/tests/lib/authoring/__fixtures__/{unit-envelope-fixtures,s17-mixed-project,counting-scene}.ts`,
     `apps/editor/tests/lib/experience/__fixtures__/x-fixtures.ts`, `units-conformance`,
     `units-canonical-form`, `scene-codec`, `visitor-cold-runtime` and
     `perf/lib/workloads/registry.ts`.
   - **Do not touch Layout's `formatVersion: 7`** (`LAYOUT_WALL_FIRST_FORMAT_VERSION`).
   - Rewrite `baseTextureId` fixtures as `maps.color` (in `counting-scene.ts`,
     `place-object-candidate.test.ts` and the codec and render tests).
   - Rewrite environment fixtures from `{preset}` to `{sky: SCENE_SKY_PRESET_STARTS[p]}`.
   - Regenerate the content revisions and canonical snapshots through the existing helpers; never
     hand-edit hashes.
9. **Contracts** (amended in the same PR):
   - `docs/reference/components/scene-content.md`: the Finish, palette, environment and Treatment
     fields, the validation codes, and the catalogue id rule.
   - `persistence.md` and `scene-codec.md`: Scene 8.
   - `assets.md`: the texture id rule and map slots.
   - `rendering.md`: the colour order, mapping, normal scale and Treatment.
   - `architecture.md` and `composition-execution.md`: the format number.
   - `AGENTS.md`: "Camera-free Scene 7" becomes "Scene 8". This is a one-word edit to the landed F2
     encoding sentence.

Dependencies: 1 → 2 → 3 → 4/5 → 6 → 7. Step 8 runs alongside 2–7, and step 9 comes last. The work
is one PR, with no parallel split: every step shares the Scene types.

## Tests

| Area | File (new or extended) | Must prove |
| --- | --- | --- |
| Codec | `tests/lib/content/scene-codec.test.ts` | Each field's accept/refuse table above. `baseTextureId` is refused. Defaults are dropped, and the result is idempotent: parse(canonical(parse(x))) equals parse(x). `texture_id_mismatch`. `unknown_texture` for every map key. `normal_map_required` for both normal fields. Uppercase hex is refused. |
| Unit | `units-conformance`, `units-canonical-form` | Scene 7 is refused and only 8 is admitted. The palette must be complete. `palette_required`. Each environment bound for sky and treatment. `environment: {}` is dropped. Canonical bytes don't depend on key order. |
| Presets | new `sky-presets.test.ts` | `sceneSkyFrom(start.sun)` equals today's normalized `from` within 1e-9 for all three presets, and every colour and intensity equals the old table. |
| Planner | `unit-planners` / look tests | Paper removes the Sky and keeps the treatment. A preset writes a fresh start and keeps the treatment. An edited Sky plus the same preset acts as Reset. `no-change` cases. |
| Resolver | `scene-instance-material.test.ts` | A literal multiplies the map, and the colour falls back to white or to the fallback. A follower takes the palette value. Per-slot override. `tileMeters` drives the repeat. The rotation reaches the spec. Normal scale and flip. Flat colour and Clay outputs. Treatment never mutates `document.materials` (deep-freeze input). Model remaps ignore mapping. |
| Parity | `scene-render-description.test.ts`, Stage/visitor parity tests | One `RuntimeScene` gives identical descriptors on the Stage and visitor paths, with and without Treatment. Today's three presets plus Paper give unchanged sun and light descriptors (before/after equality). |
| Delivery | `visitor-cold-runtime.test.ts` | An unknown `maps.normal` is a blocking issue. P20 textures named by maps need release bytes. |
| Isolation | existing `public-surface-boundary` / chunk tests | No new editor import reaches the visitor chunks (the presets live in project-model). |
| Catalogue | `materials` test | The six catalogue ids are pinned, so the append-only rule is enforced. |

## Failure cases to handle

These must all be refused:

- a Scene 7 project;
- a Finish with `baseTextureId`;
- a follower with no palette;
- a palette missing `ink`;
- `normalScale` with no normal map;
- `rotation = 2π`;
- `tileMeters = [0, 1]`;
- a P20 texture whose id differs from its asset id;
- `environment.sky` missing `haze`;
- `elevation > π/2`;
- `treatment: 'natural'`. Natural is the field's absence and is never written.

A release whose Finish names a P20 texture without bytes is a cold-runtime blocking issue. An
unknown `maps.*` id is refused at parse, so it never reaches the resolver's development warning.

## Acceptance criteria

1. `npm run check`, `npm test`, `npm run check:api` and `npm run test:api` pass on the branch.
2. Every Scene unit in the repo is format 8. `git grep` finds no `baseTextureId` and no
   `environment.preset` reads outside `docs/archive`.
3. For the same project content (re-expressed in Scene 8), the Stage, Preview and the visit render
   Paper and the three presets with identical light and material descriptors to `main`. Focused
   manual browser QA of Paper and Golden hour on the Stage and in Preview is the evidence; owner
   acceptance stays manual.
4. Fixtures exercise each new field and round-trip it through save, load and release.
5. The contracts listed in step 9 are amended. This plan's owner decisions O1–O5 are recorded as
   accepted or changed before merge.

## Findings reported, not fixed here

- **The published visit ignores the Sky.** `/p/[publicationId]/+page.svelte` never passes
  `environment` to `VisitorPreviewSurface`, so a public visit always renders Paper. A separate
  Tier 1 fix is recommended before S2; Scene 8 keeps the data it needs.
- **Fog is defined but unused.** The preset table carries `fog`, and nothing renders it. S1 drops it
  from authored data (O4).
- **Colour multiplies the map today.** A tinted catalogue texture is current behaviour. S1 keeps it,
  and S4's From image must write no `color` (white factor) to show an image untinted.

## Recommended implementation effort

**High.** This is a multi-package Tier 2 format bump. It covers about 15 source files across
project-model, render, visitor and API, and about 50 fixture or test files. The work is mechanical
but wide, and has exact-parity obligations. One agent should do it in one PR, with one
fresh-context review that reports every verified finding.
