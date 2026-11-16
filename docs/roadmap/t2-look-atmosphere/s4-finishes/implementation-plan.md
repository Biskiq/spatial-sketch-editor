# T2 S4 — Finishes & Object Painting: implementation plan

**Status:** planning baseline for approval. This draft PR claims the capability slice **`T2.S4`**
("Finishes & Object Painting"). The plan is its first commit. After the plan is approved, the same
PR implements **S4a**. **S4b** is a second implementation PR cut from S4a's merge.

**Base:** `a7f672db`, the current `main` and the merge of PR #354 (T2.S1 Look schema, Scene 8).

**Claim check (2026-11-15):** there were no open PRs. The open issues were #357, #353, #337, #336,
#335, #334, #284, #280 and #273, and none of them claims `T2.S4`, Finishes or Paint. The worktree
`t2-s2-sky-dials` (branch `t2/s2-sky-dials`) is pristine at `a7f672db` and has no PR. S4 never
touches that worktree or branch; §13 lists the shared seams.

**Risk tier:**

- **S4a is Tier 1.** It adds new Scene planners and a record-scope grant, a host tool and a Card
  row inside the approved design, and it amends the Scene content contract. It makes no format
  change.
- **S4b is Tier 2.** It adds a new resource-bearing Scene write, an editor texture-load scope for
  creator bytes, and a release delivery path for creator images.

**Read against:**

- [T2 Look & Atmosphere](../README.md) §3–4, §9–10, §12, §14 Q3–Q5 and Q7;
- [S1 Look schema plan](../s1-look-schema/implementation-plan.md), which holds the Finish schema
  and the writer rules for S4;
- [S0 report](../s0-rendering-gate/report.md), which records no environment reflections, the
  *High gloss* top stop, built-in Three materials only and `NoToneMapping`;
- [Assets contract](../../../reference/components/assets.md), sections P20 and P22;
- [Scene content](../../../reference/components/scene-content.md);
- [Rendering](../../../reference/components/rendering.md);
- the [Eraser](../../../../apps/editor/src/lib/authoring/stage/stage-eraser.ts), which is the
  host-tool precedent Paint follows.

Where the roadmap and current code disagree on a name, this plan uses the code's name. The
roadmap's `baseTextureId` is `maps.color`, and its "Materials" Library row is the `materials`
category of `WORLD_LIBRARY_CATEGORIES`.

---

## 1. Goal

A creator can give any Scene object a **Finish** and share it deliberately:

- **pick** a curated Finish, one from *This project*, or (in S4b) one made **from their own
  image**;
- **adjust** it on the object's Card with a free colour, palette swatches, a dropper and Sheen;
- go further under **More**: exact roughness and Metal, plus Image, Scale and Direction in S4b;
- **paint** whole objects with the Paint tool: hover to preview, click to commit, one Undo per
  object;
- edit a Finish that several objects share and **choose** whether the edit applies to *Just this*
  object or to *All N*, with Cancel writing nothing.

Stage, Preview and the published visit all render the same Finish through the one resolver that
already exists. S4 adds **no Scene format** (it stays on Scene 8), **no new material system** and
no persisted field that S1 did not already land.

## 2. Scope

**In S4a:**

- the Library › Finishes shelf (curated entries and *This project*);
- the Card's Finish row: colour, palette swatches, *Save to palette*, the dropper and Sheen, with
  More holding exact roughness and the Metal switch;
- the sharing Ask rule;
- the Paint host tool for primitives, Forms and models, with its dropper;
- palette slot add, edit and remove;
- the planners and record-scope grant for all of the above;
- the registry, dock and Card placeholders becoming real.

**In S4b:**

- *+ From image* through P20, adding a texture record and a `texture` resource in the same write
  as the Finish;
- More › Image (*Replace*, *Remove*), Scale in metres and Direction;
- a texture preview on Library tiles and in the Card;
- the editor's authenticated project texture scope for Stage, Preview and the snapshot renderer;
- release-delivery tests;
- the primitive Scale correction (decision **D1**).

**Out of scope, with the slice that owns each item:**

| Item | Owner |
| --- | --- |
| Wall faces and Space painting | S5 |
| Per-face painting on Forms | T5 |
| Looks, palette adoption, palette rename and Treatment UI | S6 |
| More › Maps, automatic set import, opacity and Glow | S8 |
| New reflections and an environment map | E4 |
| Artwork picking ([issue #353](https://github.com/Biskiq/spatial-sketch-editor/issues/353)) | its own fix; S4 neither absorbs it nor depends on it (§7.4) |
| Finish rename and delete, and *Remove unused* | follow-up (§15) |

## 3. Vocabulary and identity

| Term | Stored as | Mutable |
| --- | --- | --- |
| **Curated Finish** | a catalogue `MaterialId` (the six entries in `apps/editor/src/lib/content/materials.ts`) | **Never.** Catalogue ids are append-only and their definitions are immutable (S1). |
| **Project Finish** | a `SceneMaterialInstance` in `scene.materials` | Yes, through the S4 writers |
| **Pristine instance** | a `SceneMaterialInstance` whose only keys are `id`, `name` and `baseMaterialId` | It renders exactly as its base does. It is treated as the curated Finish, and the shelf never lists it. |
| **Model's own** | a model with no `materialInstanceId` | It is the model's authored GLB materials. |
| **Palette** | `scene.palette.slots[]`, from 1 to 8 entries of `{id, name, color}` | Yes. A palette edit is always global. |

**Effective Finish of an object** (`finishOf(entity)`, a pure helper in `project-model`):

1. If the object has a `materialInstanceId` and that instance is not pristine, its Finish is
   `project:<instanceId>`.
2. If the object has a `materialInstanceId` and that instance is pristine, its Finish is
   `curated:<instance.baseMaterialId>`.
3. A primitive or Form with no instance has the Finish `curated:<entity.materialId>`.
4. A model with no instance has the Finish `model-own`.

**Users of a Finish** are always derived and never stored. They are the Scene objects whose
`finishOf` equals that Finish key, in document order. This makes "All N" mean the same thing in
the Card, the Ask and the planner.

**Assignment normal form** is what every S4 writer leaves behind:

- To give a primitive or Form a curated Finish B, write `materialId := B` and delete
  `materialInstanceId`.
- To give a model a curated Finish B, reuse the first pristine instance of base B in document
  order. If none exists, allocate one named after the catalogue label, for example *Walnut*.
  Models have no `materialId`, so this is the only way a model can carry a curated Finish.
- To give a primitive or Form project Finish P, write `materialInstanceId := P` and
  `materialId := P.baseMaterialId`. The fallback then stays truthful if P is ever missing.
- To give a model project Finish P, write `materialInstanceId := P`.
- To give a model *Model's own*, delete `materialInstanceId`.
- **Garbage collection in the same write:** a *pristine* instance that the write leaves with no
  user is removed. A non-pristine Finish is kept even when it has no user, so *This project*
  never loses a creator's work silently.

## 4. User journeys and UI states

### 4.1 Library › Finishes (S4a; S4b adds + From image)

The existing `materials` Library row in `WorldToolbar.svelte` is renamed to **Finishes**. Today it
shows `materials.slice(0, 6)`, and picking a tile shows `LOOK_MATERIAL_PICK_NOTICE`. That row
becomes:

- **Curated:** the six catalogue tiles. Each shows a swatch rendered from `fallbackColor` plus the
  base texture (when it has one) through a CSS background, never a live 3D render.
- **This project:** the non-pristine instances in document order. Each tile shows the effective
  colour and, in S4b, its colour image. The section is absent when the project has none; no empty
  placeholder is shown.
- **+ From image** (S4b): a file input that accepts `image/png`, `image/jpeg` and `image/webp`.

A Library pick has three outcomes:

- **One or more Scene objects selected:** the Finish is assigned to the selection as **one
  intent** (`finish-assign`), giving one Undo. Selected lights, Walls and Artwork are skipped and
  named in the notice, for example "Painted 2 objects; Walls are not painted yet." When no
  selected subject is paintable, the pick writes nothing and says why.
- **Nothing selected:** Paint arms with that Finish (§4.3). This replaces today's "Paint is
  planned for T5" notice.
- **During an Ask:** the pick is disabled, because the Ask is modal to the Card (§5).

### 4.2 The Card's Finish row (S4a; S4b adds Image, Scale and Direction)

The row lives inside `SceneObjectCardFields.svelte` and is rendered for primitives, Forms and
models. It is part of the Scene object writer, not a second writer: `stageWorldCardView` lets a
look writer *replace* the facade writer, so S4 must not go through `look.cardStratum`.

**Collapsed**, the row reads `Finish · <swatch> <name>`. For example:

- `Walnut` for a curated Finish;
- `Walnut 2 · shared by 3` for a project Finish;
- `Model's own` for a model with no instance.

Tapping the row expands it in place, as `EditorCard` already does for More.

**Expanded**, the row contains:

1. **Finish:** the name, plus *Change…*, which opens Library › Finishes scrolled to the current
   tile. For a model there is also *Use model's own*, shown only when the model has an instance.
2. **Colour** (or **Tint** when the effective Finish has a colour image, whether from the
   catalogue's texture or from `maps.color`):
   - the **palette swatches**, one per slot, with the current follower ringed;
   - a **free picker**, which is the native `<input type="color">` plus a hex field;
   - the **dropper**;
   - **Save to palette**, shown only when the current colour is a literal, the palette has fewer
     than 8 slots, and the colour is not already a slot.

   For an image Finish, the first swatch is **Original**, which writes `#ffffff`. For a curated
   base, *Original* removes the colour override, so the base's `fallbackColor` applies again.
3. **Sheen:** a segmented control with Matte, Satin, Gloss and High gloss.
4. **More** (disclosure):
   - **Roughness**, a number field from 0 to 1 with a step of 0.01;
   - **Metal**, a switch;
   - in S4b, **Image** (*Replace…* and *Remove*), **Scale** and **Direction**, for primitives and
     Forms only. For a model, a single line reads "This model uses its own texture layout," with
     no inert fields.

A **model with Model's own** shows only rows 1 and 2's *Change…*. Its colour, Sheen and More are
absent because there is no Finish to edit. The first edit of a model always starts from a Finish.

**The Sheen mapping** writes `roughness`:

| Stop | Matte | Satin | Gloss | High gloss |
| --- | --- | --- | --- | --- |
| roughness | 0.9 | 0.6 (roadmap §3) | 0.3 | 0.1 |

The reading follows these rules:

- The effective roughness is `instance.roughness ?? catalogue.roughness`.
- When it is exactly a stop (compared at 1/1000, the resolver's precision), that stop is lit.
- When it is inherited from the base and is not a stop, no stop is lit and the caption reads
  *As Walnut (0.78)*.
- When it is authored and is not a stop, the caption reads *Custom (0.42)*.
- Stops never mention reflection or sky (S0). Under the Flat Treatment the resolver caps
  roughness at 0.6; the Card still shows the authored value, because a Treatment is a view.

**Metal** writes `metalness` as either 1 or 0:

- It is on when the effective metalness is at least 0.5. Brass, at 0.85, therefore reads on.
- When the effective value is strictly between 0 and 1, the caption reads *Partly metal (0.85)*.
- Toggling writes exactly 1 or 0.
- Without environment reflections, metal reads darker. This is an honest limit, and the caption
  under More says so: "Metal shows its colour in highlights; reflections come later."

**The dropper** (the Card's colour dropper) is semantic. It copies the *authored* colour of
another Scene object, not rendered pixels:

- Lit and treated pixels are not the authored value. The native `EyeDropper` API is also
  Chromium-only and returns pixels.
- While the dropper is armed, the Stage shows the Paint hover mark (§4.3) and the cursor becomes a
  dropper.
- A click on an object copies its effective colour into the selected object's Finish through the
  same writer as a swatch tap. A palette follower is copied as the *follower* `{slot}`.
- A click on Model's own, a Wall, Artwork or empty space refuses with a notice: "That has no
  Finish colour."
- Esc, or a second press of the dropper button, disarms it.
- It never changes the selection. That is the reason it exists as a host tool mode and not as a
  plain click.

**Palette edits** (S4a):

- *Save to palette* adds the slot `{id: allocated, name: 'Colour n', color}` and turns the current
  literal into a follower in the same write.
- Long-pressing or right-clicking a swatch opens a small popover with the slot's picker and
  *Remove*. The popover states the reach, for example "Used by 4 objects."
- Editing a slot's colour is **global by definition** and has no Ask.
- *Remove* converts every follower of that slot to a literal of the slot's colour in the same
  write (the S1 rule), so nothing changes visually.
- Rename waits for S6 (decision **D4**).

**Cancel and live preview.** Every control commits on its own gesture, which gives one Undo:

- a swatch tap, a stop tap, the Metal toggle and a dropper click commit at once;
- the picker and number fields commit on `change` (picker close, Enter or blur), not on every
  `input`.

During the picker's `input` stream the Stage shows a **transient preview** of the selected
object's colour only. This is a render-only override that the route passes as `previewFinish`,
keyed by entity id. Escape or a picker closed without a change drops the preview and writes
nothing. The preview never writes, never enters Undo, and is cleared on selection change or reading
change.

### 4.3 Paint (S4a)

The dock's disabled **Brush** placeholder (`unavailable-brush` in `stage-contributions.ts`) becomes
the host tool **Paint**, shortcut `P`. The registry row
`{id:'paint', stage:'planned', after:'T5'}` becomes `stage:'landed'` with the summary "Give a
whole object a Finish." The `EditorCard` FUNCTIONS item "Paint…" for objects arms Paint with the
selected object's Finish. Its wall variant stays disabled with its existing words, because S5 owns
walls.

**The palette above the dock** when Paint is armed:

- the **active Finish** (a swatch and its name);
- the **recents**: the last five Finishes used this session, newest first, held in memory only;
- the **Finish dropper**;
- *Change…*, which opens Library › Finishes.

**Arming sources:**

- a Library pick with nothing selected;
- the dock key, which uses the last active Finish, or else the selected object's Finish, or else
  opens Library › Finishes with Paint pending;
- the Card's FUNCTIONS › Paint….

**States:**

| State | Stage | Click |
| --- | --- | --- |
| Armed, hovering a paintable object | a hover outline in the Paint ink, drawn like the Eraser's winner treatment (Paper mark, 3D outline) and never a rendered fake material | Commits `finish-assign` for that one object, giving one Undo |
| Hovering an object that already has the active Finish | a neutral outline | Writes nothing; the notice reads "Already Walnut" |
| Hovering a refused subject (a Wall, a light handle, the floor) | no outline; on click, the refusal is shown at the pointer | Writes nothing |
| Finish dropper armed | a dropper cursor and the hover outline | Makes the target's effective Finish the active Finish. Copying *Model's own* is allowed and paints *Model's own* onto models only. It writes nothing. |
| Coarse pointer | the outline on press | Commits on release; sliding off commits nothing (the Eraser rule) |
| Esc, Select key, or another tool | Paint disarms | — |

Paint **never edits a Finish**. It only assigns one (roadmap §9). Painting onto an object that
shares its old Finish with others affects only that object, so painting needs no Ask.

## 5. Sharing and the Ask rule

Finishes are **shared by default**: picking curated Walnut for two objects makes both of them
users of `curated:wood-walnut`.

An **edit** is any colour, Sheen, roughness or Metal change, and in S4b any Image, Scale or
Direction change. It is made on the selected object `o`, whose Finish is `F`, and `N` is the
number of `F`'s users. Choices are made before writing:

| `F` | N | Outcome |
| --- | --- | --- |
| `curated:B` | 1 | Writes at once (`finish-edit`, mode `just-this`). A new project Finish P is created with base B, named *Walnut 2* (the label plus the first free ordinal), and assigned to `o`. A pristine instance `o` was using is collected. |
| `curated:B` | > 1 | **Ask** |
| `project:P` | 1 | Writes at once (`finish-edit`, mode `in-place`). P is edited and nothing else changes. |
| `project:P` | > 1 | **Ask** |
| `model-own` | — | Not editable (§4.2) |

**The Ask** is an inline confirmation strip in the expanded Finish row, never a modal dialog. It
reads: "Walnut is used by 4 objects." It offers three buttons:

- **Just this** (the default focus):
  - for `curated:B`, creates P from B plus the edit and assigns it to `o` only;
  - for `project:P`, clones P to P′, named *P 2*, *P 3* and so on, with the edit, and assigns P′
    to `o` only. P keeps its other users.
- **All 4**:
  - for `curated:B`, creates P from B plus the edit and assigns it to all 4 users. Curated B is
    never mutated;
  - for `project:P`, edits P in place.
- **Cancel** writes nothing and restores the control to its committed value.

The Ask has these mechanics:

- While it is open, the transient preview (§4.2) shows the edit on `o` only. The other users are
  marked with the neutral outline, so the reach is visible.
- Esc is Cancel. A selection change, reading change or Undo while the Ask is open also counts as
  Cancel.
- The Ask is per gesture: one Sheen tap or one picker close equals one Ask. Within a single
  expanded-row session, the Card remembers the choice for the rest of that session **only when**
  the creator ticks "Apply to all edits while this is open." That box is part of the Ask and is
  unticked by default. Without it, every gesture asks. *(Engineering decision: this avoids nagging
  without silently widening a later edit.)*
- **Palette edits never Ask**, because they are global by definition (§4.2).
- **N is computed at write time** from the planner's source, and the planner refuses with
  `stale-reach` if the editor's `N` differs. This happens when a concurrent change altered the set
  of users; the Card recomputes and asks again.

**Undo/Redo.** Every outcome above is exactly one F4 intent and one Undo entry. Undo of *Just this*
removes P or P′ and restores `o`'s previous assignment, including any collected pristine instance
with its id, because Undo restores the whole previous Scene unit. Redo reapplies it with the same
allocated ids, since ids are allocated in the intent (`allocatedIds`).

## 6. Writers: planners, payloads and refusals

### 6.1 Where they live

The planners go in a new file,
`packages/project-model/src/scene-planning/finish-planners.ts`, modelled on `artwork-planners.ts`:

- `prepare()` returns
  `{kind:'prepared', candidate:{…, source: replaceUnitData(envelope,'scene',…)}}`;
- admission is `{domain:'scene', compound:false, units:false, resources:false}`.

The exception is `finish-from-image` (S4b), which needs `resources: true` and follows
`withCreatorModelResource` in `planners.ts`.

They register alongside `createArtworkPlanners()` in the Scene planner registry, not in
`units/planning.ts`, which S2 is editing.

**Record scope.** `checkSceneRecordScope` (`record-scope.ts`) treats every top-level field except
`entities`, `clusters` and `artworkLibrary` as carried and requiring exact equality. That check is
the guard which today refuses a write to `materials`, `textures` or `palette`. S4 extends
`SceneRecordScope` with explicit grants, in the same style as `addedArtworkAssetIds`:

```ts
materials?: { readonly added: readonly string[]; readonly changed: readonly string[]; readonly removed: readonly string[] };
textures?: { readonly added: readonly string[] };       // S4b
palette?: { readonly change: 'none' | 'slots' };         // 'slots' = add/edit/remove slots
```

Under these grants:

- `materials` is checked record-wise. Records outside the grant compare exactly, and order is
  preserved except for appends.
- `textures` may only append the granted ids.
- `palette` is compared exactly unless the grant says `slots`.
- Every other carried field still compares exactly.
- A grant that is absent means exactly what it means today.

### 6.2 Intents

Every payload carries the editor's view of the reach where it matters, so a stale editor is
refused instead of silently widening the edit. All new ids come through `allocatedIds`.

| Kind | Payload | Writes | Refusals (code) |
| --- | --- | --- | --- |
| `scene-finish-assign` | `{finish: {curated: MaterialId} \| {project: id} \| 'model-own', entityIds: string[]}`; allocates at most one pristine instance id (models plus curated) | the assignment normal form (§3) for each entity, with pristine-instance garbage collection | `unknown-entity`, `not-paintable` (a light, or `model-own` on a primitive or Form), `unknown-finish`, `unknown-catalogue`, `no-change` (every target already has it) |
| `scene-finish-edit` | `{entityId, from: FinishKey, reach: number, mode: 'just-this' \| 'all' \| 'in-place', edit: FinishEdit}`; allocates one instance id for `just-this` or for `all` from curated | §5 | `stale-reach` (users ≠ `reach`), `mode-mismatch` (for example `in-place` with N > 1, or `all` with N = 1), `not-editable` (`model-own`), `invalid-value`, `no-change` |
| `scene-palette-slot-add` | `{color, adoptEntityId?: string}`; allocates the slot id and creates the palette if it is absent | appends `{id, name:'Colour n', color}`. With `adoptEntityId` plus `{reach, mode}`, it turns that entity's Finish literal (which must equal `color`) into the follower under the §5 rules, Ask included. Turning a literal into a follower is a Finish edit, so a shared Finish asks *Just this* / *All N* like any other edit. Cancel writes nothing, not even the slot. | `palette-full` (8 slots), `invalid-color`, `stale-reach`, `mode-mismatch` |
| `scene-palette-slot-set` | `{slotId, color}` | slot colour | `unknown-slot`, `invalid-color`, `no-change` |
| `scene-palette-slot-remove` | `{slotId}` | removes the slot, converts its followers to literals in the same write, and removes `palette` when it would be empty | `unknown-slot` |
| `scene-finish-from-image` *(S4b)* | `{name, texture: {assetId, pin: {hash,mime,size,locator}}, entityIds: string[], replaceFinishOf?: {entityId, reach, mode}}`; allocates an instance id | in one write: appends the texture `{id: assetId, name, uri:'/project-assets/'+assetId}` if it is absent, appends the `texture` resource `{kind:'texture', id: assetId, contentRevision: pin.hash, pin, unresolved:null}` if it is absent, and creates the Finish `{base:'paper-aged', color:'#ffffff', maps:{color: assetId}}`. It then either assigns it to `entityIds` (a Library pick) or, with `replaceFinishOf`, performs *More › Image › Replace* as a `finish-edit` whose edit is `maps.color` | `invalid-pin` (not sha256, the wrong mime, or a size over the cap), `texture-mismatch` (an existing texture record with the same id but a different URI, or a resource with a different pin), plus the edit's refusals |

`FinishEdit` is a partial
`{color?: SceneColor, roughness?: number, metalness?: 0|1, colorMap?: string|null, tileMeters?: [number,number]|null, rotation?: number}`:

- `null` deletes a key. Removing an image deletes `maps.color`, and when the image was the only
  map it also restores the base's colour rule by deleting `color` if it is `#ffffff`.
- Values are validated with S1's validators: a lowercase hex colour; `tileMeters` in
  [0.01, 100]; `rotation` normalised to [0, 2π) and then validated.
- A slot follower must name an existing slot.

**Why base `paper-aged` for an image Finish:** it has no maps, so `maps.color` is the only image.
Its roughness of 0.9 is exactly *Matte*, and its metalness is 0. The S1 writer rule writes
`#ffffff` because the base's `#e2d2b0` would otherwise tint the image.

**Names:** the label of a new project Finish is `<base label or image file stem> <n>`, with the
first free ordinal from 2. Names are display-only; identity is the id.

### 6.3 Change records

Each intent emits one change named `scene-finish-*` or `scene-palette-*`, giving the affected
entity ids and the Finish id. Undo text comes from the existing Undo explanation path, for
example "Undo: Paint *Walnut* on Plinth" and "Undo: Walnut → All 4".

## 7. Rendering, caches and hit arbitration

### 7.1 One resolver

All rendering goes through `resolveSceneMaterial`, `sceneLookFor` and `sceneModelItem`, unchanged
in semantics:

- colour multiplies the map;
- a `maps` slot replaces exactly that base slot;
- a Treatment is applied at resolve time.

S4a changes no render code except the transient preview override:

- `VisitorEntityGroups.svelte` takes an optional `previewFinish: ReadonlyMap<entityId, SceneColor>`.
- Stage passes it; Preview and the visit never pass it.
- It is applied by resolving the entity against a document copy whose instance colour is
  overridden. It is the same resolver, not a second path.
- Its material is keyed like any other descriptor, so it cannot poison the store. The preview's
  descriptor is an ordinary colour variant and is released by the normal reference counting.

### 7.2 Cache correctness

The rules are already correct and S4 relies on them:

- `variantSeed` covers the slot URIs, roughness, metalness and Treatment.
- The item key adds repeat, rotation and offset.
- The descriptor-keyed material store carries colour.

S4a tests these keys explicitly:

- the same Finish on two objects shares one material;
- a *Just this* clone with an equal look shares the material but not the instance;
- a roughness change creates a new variant;
- a palette slot edit re-resolves every follower in the same frame.

### 7.3 Stage, Preview and visit parity

Stage, Preview and visitor all render through `VisitorEntityGroups`:

- **S4a** needs no bytes, so parity is automatic. The test renders one Scene through Stage
  description and visitor description and compares the descriptors.
- **S4b** is covered in §8.

### 7.4 Hit arbitration (no regression)

Paint and both droppers use the **existing host-tool arbitration** (`resolveStagePick` in
`stage-pick.ts`), exactly like the Eraser:

- Only bindings declaring a host tool answer, so **every binding that can be in front of an
  object must declare `paint`**. Otherwise the tool would skip through a Wall to the object behind
  it.
- Scene, Layout and Light bindings add `'paint'` to `hostTools`.
- The new `paintAnswer(hit)` mirrors `eraseAction`: Scene answers `paintable`; Layout answers
  `refused: "Walls are not painted yet."`; Light answers `refused: "Lights have no Finish."`.
- No pick code, depth rule or tie policy changes.

**Artwork.** It is not pick-registered (issue #353), so a click on Artwork resolves to its host
Wall and is refused with the Wall's words. S4 neither fixes nor depends on #353. When #353 lands
and Artwork becomes a pick winner, its binding must declare `paint` and refuse, and the S4 test
"Paint over Artwork never paints the Wall or an object behind it" pins that.

## 8. S4b — From image, Scale, Direction and delivery

### 8.1 Upload and identity

`importArtworkFile` (`authoring/artwork/project-artwork.ts`) is generalised into
`importProjectImage(api, projectId, file, signal, policy)`, and Artwork keeps a thin wrapper. The
steps stay the same:

1. size cap;
2. `probeArtworkImage`;
3. `verifyArtworkDecode`;
4. sha256 dedupe against `listAssets`;
5. `registerAsset`, then `uploadAsset`;
6. on failure, recover by re-listing.

The Finish policy differs from Artwork only in its caps (decision **D3**). The result is the P20
asset id plus `{sha256, mime, byteSize}`, which become the resource pin
`{hash:'sha256-'+hex, mime, size, locator}`. The locator uses the same form `prepareArtworkPins`
expects. The texture record id **is** the asset id, as the contract requires for
`/project-assets/{x}`.

The same bytes always produce the same asset id, the same texture record and the same resource. A
second *From image* of the same file reuses them and creates only a new Finish. The planner's
"if absent" rule makes this idempotent, and `texture-mismatch` catches a tampered record.

**UI states for + From image** (Library tile, or More › Image › Replace…):

| State | Shown | Writes |
| --- | --- | --- |
| Choosing | the native file dialog | — |
| Checking | a tile with a spinner and the filename, plus Cancel. Abort calls `signal.abort()` | — |
| Uploading | the same tile with progress, plus Cancel | — |
| Refused (too small or large, not decodable, unsupported) | a notice with the reason; the tile goes away | nothing |
| Network failure | a notice "Upload failed" with *Try again*, which re-lists first so a completed upload is reused | nothing |
| Done | one `scene-finish-from-image` intent (§6.2) | the texture, resource and Finish together, in one Undo |

Undo removes the Finish, the texture record and the resource, because the intent added them. The
uploaded P20 bytes stay in project assets, where the existing asset-retention rules apply. A
cancelled or failed upload never writes Scene state.

### 8.2 Editor texture scope

Today the editor installs no default texture loader. `setDefaultTextureSourceLoader` is never
called, and Stage passes no `textureScope`, so `/project-assets/…` cannot load in the editor.

S4b adds one route-owned **project texture scope lease** to `stage-asset-leases.svelte.ts`, beside
the model URL and artwork leases:

- `createProjectTextureScope(api, projectId)` returns
  `TextureLoadScope {scopeId:'project:'+projectId, loader}`.
- The loader resolves `/project-assets/{id}` through `loadAssetContent`, verifies sha256 and mime
  against the Scene's `texture` resource pin, and returns an object URL that the lease revokes when
  it ends.
- Catalogue URIs fall through to the current static path.

The lease is passed to:

- `StageEntities` and `VisitorEntityGroups` (Stage);
- the editor's `VisitorPreviewSurface` (Preview);
- the snapshot or thumbnail renderer, if it renders Scene materials. If it does not, nothing
  changes.

**Retry.** `texture-store.ts` caches source errors permanently. S4b adds
`invalidateTextureSource(scopeId, uri)`, which drops one error entry. The project scope calls it
when the texture's resource pin changes and when the creator presses *Retry* on the Card's broken
image line ("Image could not load · Retry"). While the image is broken, the object renders with the
Finish colour and no map, which is the resolver's existing missing-texture behaviour.

### 8.3 Publication and visit

Release mode already does what S4b needs:

- `prepareArtworkPins` (`apps/api/src/artwork-persistence.ts`) pins every `scene.textures` entry
  whose URI starts with `/project-assets/`;
- the cold loader verifies those pins;
- `/p` builds object URLs through `createReleaseTextureScope`.

S4b adds tests only, plus one documented gap:

- **Tests:** a published Scene with an image Finish renders on `/p` from the release manifest
  bytes; a tampered byte fails verification and falls back to colour.
- **Save-mode gap:** save mode verifies only the artworkLibrary, not texture pins. The editor
  loader's digest check covers the editor. Adding save-mode verification is a follow-up (§15) and
  does not block S4b.
- **Orphans:** a texture record left after its Finish is removed stays in the Scene and in the
  release pins. This is harmless and is not garbage-collected in S4, because collecting it would
  widen the record scope for no visible gain.

### 8.4 Mapping

| Object | Scale | Direction | Notes |
| --- | --- | --- | --- |
| Form | exact. Its UVs are metres (surface `[1,1]`), so `tileMeters` is the real tile | exact | — |
| Primitive | its UVs are 0..1 per face, and the repeat comes from `primitiveSurface`, which ignores the entity's uniform `scale` today. D1 recommends multiplying the surface by `entity.scale`. | exact (rotation about the UV origin) | Box sides use width×depth for every face. This is an existing approximation; the Card says "Scale is approximate on boxes" only for boxes. |
| Model | hidden | hidden | The model's own UVs; mapping is ignored (S1) |

**Scale UI** is one field, "One tile = [1.20] m":

- It writes `tileMeters [s, s × h/w]` from the image aspect, or `[s, s]` with no image.
- It also shows for curated textured bases (plaster, walnut, brass), where it writes the instance's
  `tileMeters`. It is absent for map-less Finishes, since there is nothing to scale (D18).

**Direction** is a segmented control with **0°**, **90°** and **Custom…**:

- *Custom…* opens a degree field.
- It writes `mapping.rotation` in radians, normalised to [0, 2π).
- It shows only when the effective Finish has a colour map.

Scale and Direction are Finish fields, so they follow the Ask (§5).

**Texture preview:** Library tiles and the Card row swatch show the colour image through a CSS
background. Its source is the lease's object URL, the same bytes the Stage uses, tinted with
`background-blend-mode: multiply` over the effective colour. No second decoder is involved.

## 9. File-level steps

### S4a

**`packages/project-model`**

1. `src/scene-planning/finish-model.ts`: `finishOf`, `usersOf`, `isPristine`, the normal-form
   assignment, `nextFinishName`, and the Sheen and Metal constants and readings (pure). The editor
   imports these readings, so the Card and the planner cannot disagree.
2. `src/scene-planning/record-scope.ts`: the `materials` and `palette` grants (§6.1). Tests cover
   granted, ungranted, reordered, appended and removed records.
3. `src/scene-planning/finish-planners.ts`: `scene-finish-assign`, `scene-finish-edit` and
   `scene-palette-slot-add/set/remove`, with payload readers following `intent-payload.ts`.
4. `src/scene-planning/index.ts`: register and export them.
5. Tests in `finish-planners.test.ts`, covering each §5 row, each refusal, garbage collection,
   Undo and Redo restoring ids, `stale-reach`, palette removal converting followers, the first
   follower write creating the palette, and Scene 8 validation passing on every output.

**`apps/editor`**

1. `authoring/look/finish-authoring.svelte.ts`: the Finish service. It holds the active Finish,
   recents, the Ask state, the transient preview map and the dropper or Paint arming. It talks to
   `services.authoring.accept` like `form-card-command.ts` does.
2. `authoring/look/look-authoring.svelte.ts`: `pickMaterial` delegates to the Finish service, and
   `LOOK_MATERIAL_PICK_NOTICE` is removed. This is a minimal, additive diff (§13).
3. `authoring/adapters/scene/SceneFinishRow.svelte`, plus a mount inside
   `SceneObjectCardFields.svelte` in the existing `more`/details flow.
4. `authoring/adapters/scene/scene-contributions.ts`: `hostTools` adds `'paint'`, and a new
   `paintAnswer` is added.
5. `authoring/adapters/layout/layout-contributions.ts` and
   `authoring/adapters/light/light-contributions.ts`: `hostTools` adds `'paint'` and `paintAnswer`
   refuses.
6. `authoring/stage/facade/adapter-contract.ts`: `paintAnswer?: (hit) => StagePaintAnswer | null`.
7. `authoring/stage/stage-painter.ts`: a new file modelled on `stage-eraser.ts`, covering the
   hover, press and up lease, the coarse-pointer rule, notices, the dropper mode and Esc.
8. `authoring/stage/stage-facade.ts`: `paintAnswer` wiring, as for `eraseAnswer`.
9. `authoring/stage/stage-contributions.ts`: `host('paint')` replaces `unavailable-brush`, and
   `STAGE_DOCK_SHORTCUTS` gains `P`.
10. `authoring/stage/paper-marks.ts` and the 3D outline: a `paint` hover tone.
11. `authoring/stage/shell/StageOverlay.svelte`: the Paint palette (active Finish, recents,
    dropper, *Change…*) and notices.
12. `authoring/stage/shell/EditorCard.svelte`: the object variant of FUNCTIONS › Paint… becomes
    real.
13. `authoring/world-toolbar/registry.ts`: the Paint row becomes landed and the category label
    becomes *Finishes*.
14. `authoring/world-toolbar/WorldToolbar.svelte`: the Finishes shelf (curated and *This
    project*).
15. `render/visitor/VisitorEntityGroups.svelte` and `StageEntities.svelte`: the `previewFinish`
    prop.
16. `routes/project/[projectId]/spatial/+page.svelte`: construct the Finish service and pass it to
    the shelf, Card and Stage. This is an additive diff.

**Docs**

- `docs/reference/components/scene-content.md`: Finish identity, the normal form, the Ask rule and
  palette writes.
- `docs/reference/components/rendering.md`: the preview override.
- The roadmap README §12: S4a landed. This uses a single-line edit, to avoid conflicting with S2.

### S4b

1. `project-model/src/scene-planning/record-scope.ts`: the `textures` grant.
2. `project-model/src/scene-planning/finish-planners.ts`: `scene-finish-from-image` with
   `resources: true`. Add a texture resource helper, `texture-resource.ts`, following
   `model-resource.ts`, which validates the pin and appends the resource. Texture resources have no
   dependency-lock entry unless the validator demands one, which is verified in its first test.
3. `editor/authoring/artwork/project-artwork.ts`: extract `importProjectImage`.
4. `editor/authoring/look/finish-image.ts`: the From-image flow and its states (§8.1).
5. `editor/render/resources/project-texture-scope.ts` plus the lease in
   `authoring/stage/route/stage-asset-leases.svelte.ts`, passed to Stage, Preview and the
   snapshot renderer.
6. `editor/render/resources/texture-store.ts`: `invalidateTextureSource`.
7. `editor/render/scene-render-description.ts`: the primitive surface multiplied by `scale`, if
   **D1** is approved.
8. `SceneFinishRow.svelte`: Image, Scale and Direction, and the broken-image Retry line.
9. `WorldToolbar.svelte`: + From image and image tiles.
10. `api` tests: release pinning and tamper checks for a Finish image.
11. Docs: the `assets.md` "Finish images" section (the slot, identity, closure, delivery and
    save-mode gap); `scene-content.md` mapping per object kind; and the README §12 row.

## 10. Tests

**Unit tests (`project-model`)**

- Every row in §5's table and both Ask outcomes.
- `stale-reach` and `mode-mismatch`.
- Garbage collection removes a pristine instance and never a customised one.
- Assigning a curated Finish to a model reuses an existing pristine instance.
- Palette: add to the cap, `palette-full`, removal converting followers, the palette removed when
  it empties.
- Record scope: every ungranted carried field is still refused, including `environment`, which
  belongs to S2.
- S4b: idempotent texture and resource creation, `texture-mismatch`, and closure validation passing
  (`units/validate.ts` requires the `texture` resource).

**Editor unit tests**

- `finishOf` and the Sheen and Metal readings shown on the Card.
- The Painter state machine (hover, click, coarse pointer, Esc, refusal, already-has-it).
- The dropper copies a follower as a follower.
- The preview map clears on selection change.
- Resolver cache keys (§7.2).
- The Stage and visitor descriptor parity test.
- Host-tool arbitration with a Wall in front of an object: Paint is refused and does not skip
  through.
- S4b: the project texture loader verifies digests, rejects a mismatch, and invalidation retries.

**Component tests**

- Finish row collapsed and expanded, Ask strip, Cancel, model's-own variant.
- No control is rendered without effect: Scale and Direction are absent without a map, and absent
  on models.

**Failure cases** (each one is tested)

- Undo while the Ask is open counts as Cancel.
- An object deleted while Paint is hovering it.
- Painting a light, which is refused.
- A Library pick with a mixed selection.
- A palette slot removed while it is swatch-selected in another open Card.
- An upload aborted mid-flight.
- An upload that completed but whose response was lost, recovered by the re-list.
- A missing texture record renders colour only and logs only in dev.
- An image Finish under the Flat and Clay Treatments (see D2).

## 11. Browser QA (focused, manual; full Playwright needs owner authorisation)

**S4a**, on a local dev project with a box, a Form and an imported model:

1. Library › Finishes › Walnut with the box selected: the box turns walnut, and one Undo reverts
   it.
2. Paint the Form and the model with Walnut. Change the box's Sheen to Gloss:
   - the Ask reads "used by 3";
   - *Just this* changes only the box;
   - Undo reverts it, and *All 3* changes all three;
   - Cancel changes nothing, and nothing appears in Undo.
3. Pick a free colour and *Save to palette*. Give a second object the swatch, then edit the slot
   colour: both change without an Ask. Remove the slot: the colours stay as literals.
4. Use the Card's colour dropper on another object, and the Paint dropper.
5. Paint over a Wall standing in front of an object: the Wall is refused and nothing behind it is
   painted. Paint over Artwork does the same.
6. Check that Preview and Paper render the same Finishes, and that a published visit matches after
   publishing.
7. Run the same flows on touch emulation (coarse pointer).

**S4b**:

1. *+ From image* with a brick photo, applied to a Form wall and a box.
2. Set Scale to 0.5 m and Direction to 90°.
3. Reload the editor: the image loads through the project scope.
4. Publish, open `/p` in a private window, and confirm the image is present.
5. Block the asset request: the object shows colour, and Retry recovers it.
6. Upload the same file twice: one asset and one texture record, and two Finishes only if asked
   for twice.

## 12. Acceptance criteria

- Every journey in §4 works as specified, and every write is one intent with one Undo.
- The Ask outcomes match §5 exactly. Cancel and Esc write nothing.
- There are no inert controls: Brush/Paint, FUNCTIONS › Paint… for objects and the registry Paint
  row are real, and nothing in the Finish row renders without an effect.
- No Scene format change. Scene 8 validation passes for every planner output. S4b's outputs pass
  resource closure.
- Hit arbitration is unchanged (§7.4 tests). #353 is neither fixed nor worsened.
- Stage, Preview and visit render identical descriptors (S4a), and the image renders on a
  published visit from pinned bytes (S4b).
- `npm run check`, the workspace unit tests and the focused QA in §11 pass.
- The contract docs are updated (§9), and this plan is deleted before the final merge (workflow).

## 13. Coordination with S2 (Sky dials)

S2 works in `worktrees/t2-s2-sky-dials` on `t2/s2-sky-dials`. S4 never edits that worktree or
branch.

| Shared seam | S2's likely change | S4's rule |
| --- | --- | --- |
| `project-model/src/units/planning.ts` (`scene-environment-set`) | the Sky and Haze writer | **S4 does not touch it.** Finish planners live in `scene-planning/finish-planners.ts`. |
| `scene-planning/record-scope.ts` | possibly none (environment goes through the unit planner) | S4 adds optional grants. An ungranted `environment` stays refused by S4's planners. |
| `authoring/look/look-authoring.svelte.ts` | Sky dials state | S4 only rewires `pickMaterial` and deletes the notice constant. The Finish service is a separate file. |
| `routes/project/[projectId]/spatial/+page.svelte` | Sky control wiring | S4 adds one service construction and its props in one block. Whichever PR lands second rebases. |
| `WorldToolbar.svelte` | none expected (Sky is a Stage control) | Finishes shelf only |
| `StageCanvas.svelte`, `WorldEnvironment`, `world-environment.ts`, `SkyControl.svelte` | S2 owns them | S4 does not touch them |
| `docs/reference/components/scene-content.md`, `rendering.md`, roadmap README | S2 adds Sky and Haze sections | S4 adds its own sections. README edits are single-row. |

If S2 merges first, S4 rebases before each implementation push. Neither PR needs the other.

## 14. Owner decisions

These are the only choices this plan cannot make on evidence. Each has a recommendation, and S4a
needs only **D4** before coding starts.

- **D1 (S4b) — Primitive Scale.** Primitives ignore their uniform `scale` when computing texture
  repeat, so a scaled box stretches its tiles. **Recommended:** multiply the surface by
  `entity.scale` in S4b. This makes Scale honest on primitives. It also re-renders existing scaled,
  textured primitives at the correct tile size, a visible change to existing projects. The
  alternative is metre UVs for primitive geometry, a larger change that belongs to T5.
- **D2 (S4b) — Image Finishes under Flat colour (roadmap Q7).** Flat turns images off. An image
  Finish's colour is `#ffffff`, so under Flat it renders **white**. **Recommended:** under Flat,
  use the image's average colour, computed render-side once per decoded texture and cached by
  texture URI. This needs no schema change. The alternative is to accept white and document it.
- **D3 (S4b) — Image quality floor (roadmap Q4).** **Recommended:**
  - refuse below 256 px on the short side;
  - accept up to 4096 px on the long side;
  - downscale nothing in S4;
  - use the existing Artwork byte cap;
  - show no tiling warning in S4.
- **D4 (S4a) — Palette slots (roadmap Q5).** **Recommended:** free swatches with automatic names
  (*Colour 1…*) in S4, no rename, and fixed roles left to S6, which would decide on adoption. If
  you prefer fixed roles, S4a's *Save to palette* needs a role picker, which adds about one day.
- **D5 (S4a, confirm) — Imported models (roadmap Q3).** **Recommended:** keep whole-object
  replacement, which is the landed renderer behaviour, plus *Use model's own*. "Tint and sheen
  offset over the model's materials" would be a second material path, which S4 is barred from.

## 15. Risks and follow-ups

**Risks**

- **Metal looks dark** without reflections. This is mitigated by the honest caption, and brass
  already ships that way.
- **The per-gesture Ask may feel heavy** on a shared Finish. It is mitigated by "Apply to all edits
  while this is open." Browser QA judges it.
- **Instances accumulate.** Customised unused Finishes are kept by design; the follow-up adds
  rename, delete and *Remove unused*.
- **The S2 rebase** on the route file is small and additive.

**Follow-ups** (not in S4):

- Finish rename, delete and *Remove unused*;
- save-mode texture pin verification;
- orphan texture garbage collection;
- an Artwork `paint` refusal once #353 lands;
- palette rename (S6).

## 16. Effort

| PR | Scope | Estimate |
| --- | --- | --- |
| **S4a** | model and planners (2 d), record scope (0.5 d), Finish service and Card row with Ask and preview (3 d), Painter, dropper and arbitration declarations (2 d), Library shelf, registry and dock (1 d), tests, docs and QA (1.5 d) | **about 10 days** |
| **S4b** | upload generalisation and From-image flow (1.5 d), texture resource planner and grant (1 d), project texture scope, lease and retry (2 d), Image, Scale and Direction plus preview (1.5 d), D1 and D2 (1 d), release tests, docs and QA (1.5 d) | **about 8.5 days** |

**Why this split:** the split recommended in the brief holds. S4b alone introduces creator bytes:
resources, the editor texture scope and release delivery. S4a is complete and useful without them,
because every curated Finish, colour, Sheen and Paint path works on catalogue textures, which load
today. Scale and Direction move with the image, because without a creator image they add little
over the curated tile sizes.
