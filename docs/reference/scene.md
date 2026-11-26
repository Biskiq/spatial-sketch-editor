# Scene — object composition and appearance

**Owns:** object definitions, placed instances, native forms, materials/Finishes, lights, world
presentation, clusters and `surfaceFinishes`. The Scene unit is Camera-free and world-local.
Camera Views and connectivity live in the Camera unit; Experience owns editorial order.

## Placement is world-local

- Scene entities and clusters reject `roomId`. There is no Room-owned placement and no room-frame
  projection branch. Placement-local bounds and footprint derivation are project/world space.
- **Architecture rooms are not scene entities.** Layout owns them.
- **Support.** Every Scene planner resolves support through `resolveSceneSupport`: the compiled Room
  floor or floor-region `top` that covers the point, otherwise the Layout's explicit horizontal
  datum. Placement therefore needs no enclosure, and an operation that must keep another resting
  elevation refuses rather than moving vertically.
- **Pointer Place** resolves the nearest **visible** upward face along the actual ray: a Room floor
  or a floor-region top. Walls, Layout objects, Scene primitives/forms and a region slab's sides and
  underside occlude it; an overhead region is never upward support. Imported model meshes and model
  placements are outside the current occluder implementation — the seam does not ray-test model
  geometry, so a pointer ray can pass through an unoccluded model. The hit's world X/Z is snapped and
  the canonical Layout query is repeated there, so the accepted elevation and its generation come
  from that query — never from a mesh hit's Y. If snapping moves the pose off the chosen surface,
  Place refuses instead of silently dropping to another elevation. The accepted choice is pinned
  through candidate and commit. An ambiguous point asks the creator rather than picking one.
- **F.1 witnesses.** Placement names the witness that actually supported the pose:
  `layout:room-floor` for a Room floor and `layout:region-top` for a region, with the Room/region
  subject, generation and sub-reference. A coplanar Room floor and region top merge into one support
  with both witnesses. Region move and Erase remain Layout-only writes: Scene bytes do not change,
  and `countSceneRootsOnFloorRegion` supplies the derived contact count on demand.
- **Plan input.** Plan authors world X/Z and supported yaw; **Y is resolved** from the selected
  support elevation plus the asset's normalized grounding/contact offset. Pitch, roll, scale and
  other non-Plan components come from shared canonical creation defaults or normalized asset
  metadata, never ad-hoc Plan resets. For an existing entity edited in Plan, Y/elevation, pitch,
  roll and scale are preserved unless the explicit operation owns one of them. The same placement
  intent plus the same support choice produces the same canonical pose whether the pointer evidence
  came from Plan or 3D.
- **Transient support is not attachment.** Support resolution is a read-only calculation; it does
  not transfer ownership from Layout to Scene and does not persist a cross-document support link.
  Persistent wall/support relationships need their own delete/move/history/cross-document contract
  before approval. A stored transform remains authoritative for rendering, bounds and serialization,
  so a derived representation may legitimately differ without changing it.
- **Preview equals commit.** Ghosts and helpers are absent from serialization. The final preview
  equals the commit within **1e-6 world units / radians**. One drag is one entry; invalid, no-op and
  cancelled gestures are none; undo and redo are exact. Support choice is resolved in the preview
  candidate and that validated candidate is committed; late invalidity refuses or rolls back.
- **View-independent selection.** Committed Scene selection is view-independent. A Plan ↔ 3D switch
  does not clear, recreate, reorder or remap selected entity ids while those entities exist, and
  creates no history entry. An entity that cannot be represented truthfully in Plan remains
  canonically selected; Plan refuses unsupported manipulation instead of deleting the selection or
  inventing a proxy. A shared multi-selection operation does not silently drop ineligible members:
  unless a future capability defines partial-operation semantics, the operation is refused for the
  whole selection. An unfinished interaction is cancelled by its owner before a reading change;
  the cancellation writes no history and preserves committed selection.

## Entity kinds

| Kind | Contract |
| --- | --- |
| **Model** | Catalogue asset or a model resource pinned in the same envelope; world-local. Catalogue models may declare `Asset.footprint {width, depth, outline?}` in metres relative to the pivot; a missing or invalid footprint is ineligible for Plan projection. `defaultScale` and `defaultRotation` are already reflected and are not applied again. |
| **Primitive** | `box \| plane \| cylinder \| sphere`; dimensions finite and greater than zero. |
| **Form** | Authored native outline evaluated by `@portfolio/geometry-core`. `FormMesh` is derived, deterministic, renderer-neutral and never serialized; the editor derives normals and metre UVs. |
| **Light** | Point or Spot. The Sky owns the only Sun; a `directional` entity refuses with `unsupported_light_kind`. |
| **Artwork** | World-local centre and rotation, tagged image source with its immutable P20 id and oriented pixel dimensions, one authored width in metres; height follows the image aspect. Optional frame `{style: none\|thin\|gallery\|float, mat, color}`; absent is the canonical no-frame/no-Mat default, and a present none/no-Mat record canonicalizes away. Frame/Mat dimensions, generated geometry and physical colours are never serialized; they come from one real-world table at render. Artwork Library entries live in the Scene unit and survive deletion of a hanging. A hanging carries its own entity id and pose; it has no Finish, uniform scale or persistent wall host. Wall snapping sets the placement pose from compiled wall geometry; eye-line and neighbour guides are editor-only. Undo/redo restore accepted Scene records while P20 retains the bytes. **Replace image** changes the hanging's source in one accepted write and preserves identity, pose, frame and a custom name; the old shelf entry and bytes remain. |

**Native forms.** `form` holds `generator {kind:'extrude', plane:'plan'|'elevation'}`, a keyed
`outline` of 3–256 anchors, `extent` in `[0.001, 100]` m, a per-axis `scale` in `[0.01, 100]` and
`nextKey` greater than every outline key. Anchors are unique positive integer keys with coordinates
inside ±50 m; the profile is validated exactly (edge length, collinearity, simplicity, winding) and
a rejected outline refuses with its issue code and anchor keys. A form refuses an entity-level
`scale` and `roomId`: its size is `form.scale`, so size has one writer.

- `create-form` creates one form. `set-form-size` writes a full per-axis scale resting on the
  evaluated contact. Move, Turn, Place on floor, Duplicate and Delete use existing planners.
- **`place-form-copy`** inserts one **detached** editable copy from a My Objects item: the payload
  carries the strict library payload, world X/Z, yaw and the captured contact; the planner
  re-validates the payload, re-evaluates that contact, refuses a disagreement, re-resolves support
  from the accepted snapshot, allocates a new entity id, writes the saved source verbatim (keys,
  scale and `nextKey` included) and returns one accepted result. The copy carries no resource, lock
  entry, reference or other link to the library item. One history entry; Undo/Redo is the ordinary
  F4 path. `resize-on-floor` refuses a form because uniform scale would contradict `form.scale`.
- A selected form offers three per-axis size rays (Width, Height, Depth); a ray previews through
  `set-form-size` and release commits one intent, while the Card's per-axis fields remain the one
  writer for exact values. Evaluation is deterministic and cached in the editor; Stage and Preview
  draw the same mesh. Publication refuses a form in the cold release check until T4 admits it.

**Clusters.** Named member-id groups rendered flat by the visitor. They are **not** a durable
assembly/instance model: membership only, one group maximum, no nesting, no Three parenting as an
authored hierarchy, no prefab library. Deleting entities cleans references and selection through one
Scene authority; no dangling member survives. Duplicate uses a deterministic **+0.5 world X/Z**
offset, preserves Y and material sharing, and adds no hidden move or grounding entry. A full cluster
is duplicated as a cluster; a partial member selection is ungrouped with a warning. Validate all
clone candidates before one commit; an invalid batch leaves the document unchanged.

**Lights.** `color` is `#rrggbb`; `intensity` finite ≥ 0; `range` finite > 0; `angle` in `(0, π]`;
`penumbra` in `[0, 1]`. Point lights reject angle/penumbra; spot lights require angle. Editor-only
helpers mount for selected lights only and are never serialized: the emitter body has no scale
control and no screen-space range gizmo; a selected Point may show a derived reach ring, a selected
Spot a derived far-cap rim plus cone edges. Those are line-only frustum instruments, not handles that
scale the light. Exact Reach remains a Card field. An editable spot half-angle is presented in
degrees against canonical radians.

## Transforms and validation

- `position` and `rotation` are required finite `Vec3`; `scale` is optional, finite and greater than
  zero (`invalid_scale`). Scale is a single scalar — there is no per-axis scale field in the schema.
- Primitive dimensions must be finite and greater than zero (`invalid_dimension`).
- **Allowed keys only.** An unknown property on a document, entity, cluster or resource is rejected,
  so a document carrying a retired field does not silently load.
- **World presentation** is optional `environment`. Sky records provenance (`preset`), time in
  `[0,24)`, noon heading in `[0,360)` clockwise from world −Z, noon elevation (`arcHeight`) in
  `[20,80]`, haze percentage `[0,100]`, exposure EV `[-2,2]`, softness and Moon strength `[0,1]`.
  `sunShadows` controls the shared Sun/Moon light. `skyColor`, `groundColor` and `moon.color` are
  lowercase `#rrggbb`. Invalid fields refuse with `invalid_sky_field`; unknown keys with
  `unknown-key`. Studio at its default heading/settings and an empty environment normalize to
  absence. `treatment` admits `flat-colour` and `clay`.
- **Texture URIs** are safe root-relative public paths: no scheme, `//`, backslash, query or
  fragment, control characters, `.`/`..` segment, and stable under repeated percent-decoding.
- **Palette.** At most eight ordered slots; `id` a stable non-empty id (≤64 characters), `name` a
  non-empty label (≤40), `color` a lowercase literal. Duplicate ids refuse; an empty palette
  normalizes to absence; a follower must name a slot in the same Scene. The write that creates the
  first follower also creates the palette; deleting a slot converts its followers to literals holding
  the slot's last colour in the same write, so `unknown_palette_slot` is unreachable from the UI. A
  curated Look seeds a palette only when the World has none; an existing palette always wins. **Adopt
  palette** is the only colour mover: every literal Finish without an image tint becomes a follower
  of the nearest slot in CIE Lab ΔE76 in one undoable write, revalidating each literal, slot id and
  colour against its recomputed plan (`stale-adoption` on a mismatch). Image tints and inherited
  colours are counted, never rewritten. Lights, Sky colours, Artwork and frames stay literal.

## Finishes and surface assignments

A Finish is `{id, name, base, overrides?}`. Its base names one curated `catalogue` id or one project
`material` definition by recipe digest. Sparse `overrides` may set `color` (a lowercase literal or a
`{slot}` follower), `roughness`, `metalness`, `occlusionStrength`, `normalScale`, the set `mapping`
(`target`, `surface` or `uv`) and per-role `maps` (`color`, `normal`, `roughness`, `metalness`,
`occlusion`). An absent field inherits the base; **`null` explicitly disables one base map**; an
empty override container is never persisted, so canonical bytes hash authored content only. A map
override binds a Scene texture. A colour is a lowercase `#rrggbb` literal or a `{slot}` follower;
the unit validator owns follower closure because it is the only reader holding the palette.

- **Guard:** the F4 Finish patch refuses a patch that sets `normalScale` (or resets the normal map
  while leaving an authored `normalScale`) when no normal binding remains
  (`normal-control-without-normal`).
- Mappings: a `target` or `surface` mapping carries a metric (`tileMeters`, `rotation`, `offset`); a
  `uv` mapping names a native UV set, repeat, rotation and offset. Rotations normalize to `[0,2π)`
  radians and offsets to `[0,1)`. The codec does not tie `normalScale` to a normal map: a disabled
  normal map keeps its stored strength dormant.
- A project texture's Scene `id` is its logical asset id: `/project-assets/{assetId}` requires
  `id === assetId` (`texture_id_mismatch`). One image has one Scene texture record, so Finish maps
  sharing an image share one release pin. Material definitions live in the resources unit, never in
  Scene.
- **Curated catalogue ids are append-only.** Each id's complete definition (`fallbackColor`,
  roughness, metalness, `normalScale`, tile size, texture URIs) is immutable; a changed curated look
  needs a new id and the old one stays resolvable.

**`surfaceFinishes`.** Optional, nonempty, sorted and unique assignments to canonical Layout
`wall-side`, `room-floor`, `room-lid` or `region-face` references. A Region face must be `top` or
`underside`; **`edge` is refused** (`unknown_surface_face`) because a perimeter strip has no Finish
face. Each assignment names exactly one curated `materialId` or non-pristine `materialInstanceId`;
an empty field is omitted. Unknown reference kinds, duplicate identities, unsorted records and
non-normal Finish references refuse. Assignments resolve through the canonical Layout surface API,
use the Layout default when absent, and keep shared Finish/material-instance identity through
topology lineage. Retired identities are pruned in the same accepted topology edit; **dormant lids
stay assigned while open to sky**; a loaded unresolved reference stays diagnostic and renders the
default.

**Finish Card.** The Card header stays the selection; which surface is open is Card-local session
state. Every control is one `scene-finish-patch` (rename: `scene-finish-rename`), so one Undo
restores it. A slider previews render-only on every reached user and writes once on release; Esc,
deselection or a reach switch cancels with no write.

- **Reach is shown before the edit.** A curated Finish on one user materializes; on several it
  defaults to *This*. A project Finish on one user edits in place; on several it defaults to *All*
  (in place) and *This* copies. *All* on a curated Finish reaches **same-kind users only**; the Card
  says how many of the other kind keep it. While *All* is chosen, other reached users draw as
  Paint-tone proposals (a surface outlines its owning Wall or Room). The patch carries the inspected
  users; if Paint changed them meanwhile the write refuses, the Card re-reads reach in place and
  nothing changes.
- **Colour modes:** Natural (no colour), Stained (colour over the kept colour image) and Painted
  (colour with the image removed, structurally a colour coat). Plain bases offer Natural/Painted.
  Chips follow palette slots; `+` writes a literal.
- **Sheen** is Matte/Satin/Gloss over effective roughness (factor × the base map's scanned mean)
  against per-family targets. **±0.05** shows a step; anything else reads Custom; a step needing a
  factor above 1 is disabled; the original step resets roughness.
- **Swap** sets a curated base and keeps the treatment (colour mode re-derived, effective sheen,
  metal, direction; real size reset). An untreated swap collapses to the curated Finish. **Naming:**
  `Material · Colour[ stain][ · Sheen]` regenerates while the name is still generated; a renamed
  Finish keeps its name. Curated names are not editable. *More* keeps exact roughness, Metal, the
  colour image and tile size/direction through the same writer and reach.
- **Colour image:** one P20 image per Finish, its Scale in metres and Direction. The image is a
  `scene.textures` record plus one pinned `texture` resource, created with the Finish in one write;
  Cancel, refusal or Undo leaves the asset under P20 retention and writes no Scene state. Mapping is
  per object kind: a Form's UVs are metres, a primitive's repeat is its authored face size × the
  entity's uniform scale (box sides use width × depth), and a model hides Scale and Direction because
  its own UVs are authoritative. Scale writes `tileMeters [s, s × h/w]` from the image aspect, or
  `[s, s]` with no aspect; Direction writes radians normalized to `[0,2π)`. A map-less Finish shows
  neither. **Remove** deletes the image and restores the base's colour rule. Under Flat colour the
  image keeps its authored colour field and drops its base map; there is no average colour.

**Looks.** Curated Atmosphere + Treatment tiles in the Environment popover, a Natural / Flat colour
/ Clay switch and explicit palette adoption. A Look is **not stored**: identity is an exact
`(sky, treatment)` match with the noon heading ignored. `scene-look-apply` writes the Look's Sky at
the World heading, its Treatment and its palette only when the World has none;
`scene-treatment-set` changes the resolve-time tag alone; `scene-look-restore` puts back the
environment captured by the previous Look apply (session-scoped A/B; any other environment write
clears it); `scene-palette-adopt` moves literals to followers. Each is one record and one Undo.
Treatment covers resolver surfaces, imported models that keep their own materials, and default
Layout floors, ceilings and walls; it never reaches Artwork, the Sky, lights, the plinth, door frames
or editor marks.

## Codec boundary

`packages/project-model/src/scene-codec/` is the unit's one codec:

```text
index.ts          public barrel: validate/parse/serialize + public types
readers.ts        shared leaf: typed JSON readers + JsonRecord
parse-entities.ts entities, materials, textures, clusters
parse-document.ts nodes, waypoints, connections, timing, semantic validation
canonical.ts      clone helpers + deterministic serializer (consumed by index only)
```

- **Only `index.ts` is public.** Consumers import from `@portfolio/project-model`. The app seam is
  `apps/editor/src/lib/content/scene.ts`, which re-exports the barrel and supplies catalogue
  validation options from `scene-validation.ts`. No consumer imports siblings. The boundary is a
  convention (`@internal` JSDoc), not module-system enforced; restructuring files is safe while the
  package surface is unchanged.
- **Connectivity context.** `SceneValidationOptions.connectivity` defaults to `single-component`: a
  direct Scene document requires every edge-bearing navigation node in one connected graph. A
  Camera unit explicitly uses `independent-components` through the one named
  `CAMERA_UNIT_SCENE_VALIDATION` constant; Camera-unit admission and its runtime Scene projection
  force that policy after merging host catalogue options. Only the global reachability walk is
  skipped in that context — reciprocal adjacency, one direct edge per unordered pair,
  endpoint/anchor/timing/pose checks and unknown-field refusal are unchanged. The choice is an
  internal validation context, never an authored setting, and introduces no second graph or route
  evaluator.
- **Catalogue seams.** The pure model cannot know which asset or material ids a host ships, so the
  host injects policy through `SceneValidationOptions` / `withSceneValidationOptions`. An
  unresolvable entry fails by name (`unknown_asset`, `unknown_material`, `invalid_fallback`).
- `validateSceneDocument` separates structural issues, repairable authored diagnostics and
  executable resource closure. Closure refuses F4 acceptance, Save and release.

## Material and light semantic gaps

- S4a closed whole-object Finish authoring remains: the Library lists curated and project Finishes
  and Paint assigns one whole object per click. Project Finishes follow the assignment normal form:
  primitives and Forms carry no needless instance, a model reaches a curated Finish through one
  pristine instance, and a pristine instance with no user is collected in the same write. *Model's
  own* deletes the instance and restores the imported material.
- Whole-object assignment replaces all mesh materials and does not promise imported glass/alpha
  preservation; clearing a model assignment restores the imported appearance.
- Arbitrary UVs expose unsupported metric controls with a reason rather than an automatic
  projection. Shader/node graphs, a slot editor and texture painting are not current capabilities;
  they enter, if admitted, through the appearance authoring destination in
  [architecture](./architecture.md#appearance-authoring).
- Remaining gaps: per-face and Wall painting (T5/S5) and approved PBR map sets. Save and cold Load
  verify the complete Finish/Artwork image closure through the shared project-image enumerator.
- An editor assist light is visibly session-only and off for comparisons and visitors.
  PMREM/environment caches are derived renderer resources with scope, reference counts and
  asynchronous cancellation — never authored Scene truth.
- **Static-model source drift.** Delivered bytes are authoritative for actual loading: cold model
  load uses the retained compatibility source even when the live catalogue changes or disappears, and
  an already-published release keeps its retained static mapping. Attribution survives into library
  and publication output. A missing, failed or corrupted resource is visible and never silently
  accepted; provider/signed URLs are not the durable source. Fallback resolves separately and
  visibly. A render-ready derivative is never advertised as a preserved semantic assembly.
- **Truthful ingest.** Ingest declares which structure, clips, material slots, pivots and metadata
  survived and which operations are supported, and retains source bytes and conversion provenance
  where later reprocessing requires them. Names and indices locate data inside one source revision;
  they do not prove continuity across re-export.
- **No renderer upgrade is implied.** The renderer dependency baseline is a conditional choice made
  at implementation freeze. Scoped caches, reference counts, clone ownership and asynchronous
  cancellation are preserved; recursive disposal or ownership is never inferred. An optimization
  that does not reproduce under measurement is not adopted, and a benchmark family with no enforced
  threshold is not a regression guard.
