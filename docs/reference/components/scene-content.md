# Scene content

**Read when:** entities, asset library, materials/textures, lights, clusters, transforms.
**Last reviewed:** 2026-10-28 (My Objects independent-copy insertion implemented, on the S02 Shape reading
and per-axis sizing and the S01 native-form and Scene 4 baseline — that date's evidence, before the
Scene 5 world-presentation cutover. Current behavior is below; production activation remains
owner-controlled)

---

## Current implementation

The live Scene is the world-local Scene 7 payload of the F2 envelope. Camera Views and
connections live in the separate Camera unit; Experience owns editorial order. Strict unit
validation rejects old versions and retired fields. There is no legacy recognition or conversion.

Editable entity kinds: **model** / **primitive** (`box|plane|cylinder|sphere`) / **form** /
**light** (`point|spot`) / **artwork** · textures · material instances · clusters.

Artwork stores a world-local centre and rotation, a tagged image source with its immutable P20 ID
and oriented pixel dimensions, and one authored width in metres. Height follows the image aspect.
It may also carry one optional frame record: `{ style: none|thin|gallery|float, mat, color }`.
Absent is the canonical no-frame/no-Mat default, and a present none/no-Mat record canonicalizes
away. Frame and Mat dimensions, generated geometry and physical colours are never serialized;
they come from one real-world table at render time. Artwork Library entries live in the Scene unit
and survive deletion of a hanging. A hanging carries its own entity ID and pose. It has no Finish,
uniform scale or persistent wall host. Wall snapping sets the placement pose using compiled wall
geometry; eye-line and neighbouring centre guides are editor-only and inferred from the artwork's
pose, so no wall host is added. Undo and redo restore accepted Scene records, while P20 retains the
bytes. Replace image changes the hanging's source in one accepted write and preserves its identity,
pose, frame and a custom name; the old shelf entry and bytes remain.

Stage and Visitor Preview share a diffuse-only Lambert image with an sRGB map, fractional colour
alpha and a binary alpha cutoff for shadow silhouettes. The same generated frame, Mat and backing
surround it on both surfaces. A framed image gets a backing so alpha reads as a print; an unframed
image stays a cut-out. The neutral reference uses NoToneMapping at exposure 1. The project shelf,
placement controls and hanging guides stay in authoring.
**Architecture rooms are not scene entities** — see [`../architecture.md`](../architecture.md).

| Assets | Today |
|------------|--------|
| Models | Catalogue assets or same-envelope approved model resources; world-local placement, no Room ownership |
| Shapes | Box / plane / cylinder / sphere |
| Forms | Native drawn outlines extruded by `@portfolio/geometry-core`; authored source only, generated geometry never stored |
| Lights | Point / spot — spot aims by rotation; the Sky owns the only Sun |
| Textures | URI/file → bind via materials (not scene objects); project assets use logical `/project-assets/{assetId}` refs resolved by authenticated context |

Clusters = named member-id groups; the visitor renders them flat; **no** prefab library.
Current clusters are **not** a durable assembly/instance model: they carry member IDs and
editor-only hierarchy metadata, and cloning a Three hierarchy supplies no authored component
identity or revision policy. GLB provenance: [`assets.md`](./assets.md).

**Native forms (current).** T5.P01.S01 lands the authored form source and T5.P01.S02 lands the
creator entry point. R217.S17A puts it in the **Objects** panel, the dock's one place to create and
insert objects; Ink draws architecture only. Box and Round create a standard 1 m form on a click and
the form two corners span on a drag; Free takes clicked corners and drawn smooth runs and closes on
its start, Enter or Finish. Live validity is `validateProfile`, and an invalid outline names its
issue. Each creation issues exactly one `create-form` intent, and the preview body comes from the
same planner candidate the commit installs, so it cannot differ from the result. Upright forms stay
fully supported in the model, in saved projects and on the Card, but the Stage does not draw them
until T1's face-frame query arrives.

**Support.** Every Scene planner resolves support through `resolveSceneSupport`: the compiled Room
floor that covers the point, otherwise the Layout's explicit horizontal datum. Placement therefore
needs no enclosure, and an operation that must keep another resting elevation refuses rather than
moving vertically. A verified catalogue model is offered only where the envelope holds its asset
resource, because the entity cannot close without it.

Once present a form is ordinary Scene truth: `create-form` creates one, `set-form-size` writes a
full per-axis scale resting on the evaluated contact, and Move, Turn, Place on floor, Duplicate and
Delete work through the existing planners. `place-form-copy` inserts one **detached** editable copy
from a My Objects item: its payload carries the strict library payload, world X/Z, yaw and the
captured contact; the planner re-validates the payload, re-evaluates that contact and refuses a
disagreement, re-resolves support from the accepted snapshot, allocates a new entity id, writes the
saved source verbatim (keys, scale and `nextKey` included) and returns one accepted result. The copy
carries no resource, lock entry, reference or other link to the library item. It is one history
entry; Undo and Redo are the ordinary F4 path. `resize-on-floor` refuses a form (uniform scale would
contradict `form.scale`). A selected form offers three per-axis size rays (Width, Height, Depth); a
ray previews through `set-form-size` and release commits one intent, while the Card's per-axis Size
fields remain the one writer for exact values. Evaluation is deterministic and cached in the editor;
Stage and Preview draw the same mesh (metre UVs, computed normals). Production Plan footprints and
3D mounted-mesh hits feed the existing Stage selection authority. Forms appear in Index and Head
Find; their Card exposes Move, Turn, Place on floor, per-axis Size, Duplicate and confirmed Delete
through existing Scene planners/F4. Preview preserves visitor isolation and return to Stage
preserves selection. Publication still refuses a form in the cold release check; T4 owns any
admission. Limits and the codec rules are above; implementation evidence routes through the
[T5.P01.S01 acceptance and evidence stub](../../archive/roadmap/closed-phases/t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s01-native-form-source-and-evaluation/acceptance.md)
and [T5.P01.S02 acceptance record](../../archive/roadmap/closed-phases/t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s02-shape-reading-and-sizing/acceptance.md),
with the [reference decision](assets.md) owning the plan.

**Current authoring.** The T2 Scene adapter places, edits, resizes, duplicates and deletes through
unit F4 planners, sharing the Stage's single history with Layout. Definitions must already be pinned
or procedural; the starter may capture a bounded verified palette. Missing or changed pins refuse
placement; no resource is silently admitted. T2.P02.S01 adds editor-host admission for a model
resource in the same envelope and Save verification against the project's approved revision. Its
`generic` fallback uses the approved footprint; part fields remain refused and `componentId` stays
null. T2.P02.S02 adds the import procedure and the placement journey; its owner-run rows, including
Preview pixels, stay unrun in its acceptance stub. The visitor reader remains catalogue-only. The shared Stage/visitor renderers remain under
`apps/editor/src/lib/museum/`, with catalogue policy in
`apps/editor/src/lib/content/scene-validation.ts`. The directory name is not a separate product.
Open and Download use F2 source JSON. Publication UI remains absent; the
[bounded capture/Guide/Preview loop](../../archive/roadmap/closed-phases/t3-experience/t3.p02-capture-and-cut-preview/README.md#bounded-outcome)
does not admit general Camera path authoring.

## Validation and transform contract (current)

These are the codec's own rules, not a destination: `packages/project-model/src/scene-codec/`
(with `parse-entities.ts` holding the entity parsers) rejects anything outside them.

- **Allowed keys only.** An unknown property on a document, entity, cluster or resource is
  rejected, so a document carrying a retired field does not silently load.
- **Transform**: `position` and `rotation` are required finite `Vec3` values; `scale` is optional
  and must be **finite and greater than zero** (`invalid_scale`). Scale is a single scalar — there
  is no per-axis scale field in the schema.
- **Primitive dimensions** must be finite and greater than zero (`invalid_dimension`).
- **Form source**: `form` holds `generator` (`kind: 'extrude'`, `plane: 'plan' | 'elevation'`,
  keyed `outline` of 3–256 anchors, `extent` in `[0.001, 100]` m), a per-axis `scale` in
  `[0.01, 100]` and `nextKey` greater than every outline key. Anchors are unique positive integer
  keys with coordinates inside ±50 m; the profile is validated exactly (edge length, collinearity,
  simplicity, winding) and a rejected outline refuses with its issue code and anchor keys. A form
  refuses an entity-level `scale` and `roomId`: its size is `form.scale`, so size has one writer.
- **World-local identity**: `roomId` is explicitly rejected on entities and clusters, so a
  Room-owned placement cannot be expressed or re-introduced. Placement-local bounds and footprint
  derivation are project/world space; the legacy room-frame projection branch is gone.
- **Lights**: `color` must be `#rrggbb`; `intensity` finite ≥ 0; `range` finite > 0; `angle` in
  `(0, π]`; `penumbra` in `[0, 1]`. Point lights reject `angle`/`penumbra`, and spot lights require `angle`. A `directional`
  light is refused with `unsupported_light_kind`; the Sky owns the only Sun.
- **Material instances**: `baseMaterialId` must resolve to a known material; `roughness` and
  `metalness` are unit-interval.
- **Texture URIs** must be safe root-relative public paths — no scheme, no `//`, no backslash, no
  query or fragment, no control characters, no `.`/`..` segment, and stable under repeated
  percent-decoding.
- **Catalogue seams.** The pure model cannot know which asset or material IDs a host ships, so the
  host injects that policy: `SceneValidationOptions` / `withSceneValidationOptions` in
  `packages/project-model/src/scene-validation.ts`, supplied in this app by
  `apps/editor/src/lib/content/scene-validation.ts`. An unresolvable entry fails by name
  (`unknown_asset`, `unknown_material`, `invalid_fallback`).

**Placement, transforms and attachment (ratified destination; not shipped).** Placement operates
on session-only proxies over world-local roots and declared internal component frames;
**Attachment** is a typed relationship with a host and parameters, and proximity or grouping never
implies ownership or connectivity. Overrides follow the composition/invocation split (instance
baseline vs invocation parameters), and placement never mutates a baseline an invocation owns.
Moving or replacing a placed instance is a deterministic domain operation over a typed,
serializable intent with an expected project revision, and cross-domain acceptance (F.4) is atomic
with one undo result. Resource revisions and dependency locks travel with definitions and
instances: placement does not silently rewrite a locked reference, and an incompatible replacement
is reported for repair, never auto-matched by name or position. Destination Stage graphics,
handles, measurement feedback and hit legibility follow the
[spatial-instrument grammar](../design-system/spatial-instrument-grammar.md); placement/domain
adapters retain legal operations, target eligibility and commit/cancel policy, and the grammar adds
no universal gizmo or transform capability.

**Open:** level/structure-qualified placement addressing, and the frame semantics for attached
components — implementation decisions within F.1/F.3
([`../composition-execution.md`](../composition-execution.md)), subject to its interface-ownership
rule.

> The uniform-versus-independent scale fidelity note and TD-1's acceptance-test obligations are
> carried in [`docs/reference/components/scene-content.md`](scene-content.md),
> not duplicated here. The pre-#115 Arrange/ghost/gizmo surface and the room-local Scene projection
> were removed with the editor shell; their content is recoverable with
> `git show e90a58224443bdbf44114d7285d55c983b79cc84:docs/reference/components/placement.md`.

## Ratified destination (not shipped)

Scene owns scene-object composition: named definitions, placed instances, components,
attachments, materials, lights, placed-instance semantics and world presentation
(environment/atmosphere, render settings, spatial trigger subjects). Distinguish a source
definition, placed instance, internal component, organizational group, and attachment; proximity
or grouping never implies ownership or connectivity.

- **Definitions and instances.** A definition exposes an intrinsic interface — what it can do,
  what its parameters mean, supported material slots, discrete configurations, limits, affected
  channels and required components. A placed instance supplies configuration, compatible
  per-component overrides and default behavior parameters. Importing a definition never authorizes
  autoplay or external effects.
- **Ambient behavior.** A Scene behavior binding may start a bounded ambient behavior when that
  Scene's execution context starts (so an object can operate with no tour or Experience). The
  binding goes through the common conductor; it is not a private animation loop writing around
  channel ownership.
- **Two override mechanisms.** Composition overrides establish the effective instance baseline
  (definition defaults → selected variant → allowed instance overrides); invocation overrides
  supply parameters, bindings, time mapping and supported local specialization without mutating
  that baseline. A captured visible pose becomes authored intent only through an explicit validated
  capture operation.
- **Reusable presentations are not instance state.** A presentation composes capabilities with
  optional/required Camera, light, media and content roles; Experience binds roles to concrete
  subjects. An object-only presentation stays usable without a camera track.

**Resources, identity, and ingest.** Definitions, states, performances and clips are typed
resources with logical identity plus an exact revision or content identity, project and library
scopes, and a project dependency lock; a project-local definition may be stored inline initially
provided it has the same identity/scope/reference semantics as a later library resource.
Availability, authorization and retention travel with reuse — an authorized shared reference or a
vendored immutable copy, never a pointer into another project's private store. Ingest is truthful:
it declares which structure, clips, material slots, pivots and metadata survived and which
operations are supported, and retains source bytes/conversion provenance where later reprocessing
requires them. A flat model remains useful at object level; an optimized render hierarchy does not
establish durable component identity. Names and indices may locate data inside a source revision;
they do not prove continuity across re-export.

**Open mechanism decisions** (implementation decisions within
[`../composition-execution.md`](../composition-execution.md), subject to its interface-ownership
rule): the definition/instance schema, component-identity mechanics, resource storage/container
encoding, and the correspondence algorithm for ingest derivatives.

## Expressive editing (destination)

the [architecture](../architecture.md#expressive-creation-and-revision-destination) owns shared
subjects and integration. Scene's current primitive/model and native-form operations above are
unchanged; no general following, sculpting or component capability is admitted by this section.

For each future admitted object edit, the domain declares the supported target/context, affected
subjects, editable controls, meaningful dependencies and the resulting validity envelope. A fact,
qualified context or current-result target may be appropriate; no universal gesture or inference
engine is prescribed. Ordinary interaction should not require construction-order knowledge.

One-time context use and persistent following are distinct. Continuing relations, member exceptions,
shared-definition changes and detachment have explicit meaning before acceptance. Their defaults,
identity rules and deletion/repair policy require the first consumer's product decision; the
proposed guide/form/arrangement workflow does not settle them. Existing solve-once placement and
the conditional attachment contract below keep their scope.

Precision and preservation promises state the quantity, frame, region, lifetime and affected
operations, and are validated on the resulting work. A typed dimension is not automatically a
constraint; a mask, unchanged ID or best geometric match is not proof of preservation. Lost or
ambiguous support reports failure/repair rather than silently retargeting. Any correspondence
mechanism must satisfy the existing qualified-reference and component-validity rules.

Concrete source/operation formats, order models, correspondence algorithms and UI remain TBD.
Capability expansion needs demonstrated creative value alongside predictable revision and cost;
this contract creates no new operation list or implementation obligation for T2.

## Product convergence destination


**Placement and attachment.** Solve-once surface placement writes an ordinary world pose and
creates no following relationship. Deliberate attachment, if selected by the owner, has a host
reference and surface parameters whose evaluated pose is the sole pose authority. Layout owns
the frame query and transport; Scene owns the binding. Shape edits may remain Layout-only;
a topology edit needing binding rewrites is a registered joint Layout/Scene acceptance.

Out-of-span, over-Opening and frame-unavailable status is derived. Detach captures the evaluated
pose only while available. The first attachment consumer must decide deletion policy. Proposed:
detach at deletion time by default; explicit alternatives delete dependents or retain a repairable
binding. If any dependent's pose cannot evaluate, default detach refuses the whole candidate
without changes and offers explicit keep/delete. A kept binding without recovery data renders
nothing and needs Re-pick, explicit placement or deletion. Its codec, any AM-2 diagnostic reuse
and compatibility are part of the versioned attachment extension, not a change to all domains.

**Parts and annotations.** An admitted component receives a non-reused opaque identity in its
owning definition/resource table, mapping to source and derivative locators pinned to the exact
revision. A changed component migrates only with explicit preserved/retired/replaced
correspondence; an unchanged identity resolves normally. Names and node order do not establish
continuity. Annotation records belong to Experience. C2 imports whole objects with `componentId`
null; later component providers and admission operations precede part-selection/admission UI.

## Composition behavior and future consumer obligations

The following constraints apply when their capability is admitted. They do not claim every
material, light, assembly, attachment or ingestion operation is implemented. Legacy-source
observations describe prior inputs; current source admission is strictly the versions in Persistence.

### Derived footprint, X/Z/yaw input, support-owned Y

- In Plan, Plan authors world X/Z and supported yaw; **Y is resolved** from the
  selected valid support elevation plus the asset's normalized grounding/contact
  offset. Pitch, roll, scale and other non-Plan components come from the shared
  canonical creation defaults / normalized asset metadata, never from ad-hoc Plan
  resets.
- For an existing entity edited in Plan, Y/elevation, pitch, roll and scale are
  preserved unless the explicit operation owns one of them.
- The same placement intent plus the same support choice must produce the same
  canonical pose whether the pointer evidence came from Plan or 3D.
- A stored transform/dimensions remain authoritative for rendering, bounds and
  serialization, so a derived representation may legitimately differ from the
  stored one without changing it.


### Transient support consultation is not host attachment

- Support resolution is a **read-only calculation**. It does not transfer
  ownership from `LayoutDocument` to `SceneDocument` and does not persist a
  cross-document support link by default.
- For Layout-owned floor support the canonical source is the shared compiled
  Layout geometry/query seam. Plan may start from X/Z pointer evidence and 3D
  from a rendered hit; both must normalize that evidence to the same semantic
  support result before the Scene write. A rendered hit is never the authority
  for floor elevation.
- No valid support → reject the commit with a visible reason. Different
  elevations require a choice; equivalent coincident results deduplicate;
  an unsupported or unresolved case is refused, not guessed.
- Persistent wall/support relationships (a durable cross-document reference) need
  their own delete/move/history/cross-document contract before approval. They are
  a follow-up, not an implied capability.


### View-independent selection and explicit ineligibility

- Committed Scene selection is view-independent. An accepted Plan ↔ 3D switch
  must not clear, recreate, reorder or remap the selected Scene entity ids while
  those entities exist. Selection order and primary/active intent are one
  Scene-owned authority — the editor's selection reducer that held them was
  removed by #115, so T2 establishes the successor as a single authority — and a
  view transition creates no replacement selection identity and no history entry.
- A selected entity that cannot be represented or edited truthfully in Plan
  remains canonically selected; Plan refuses unsupported manipulation instead of
  deleting the selection or inventing a proxy.
- For a shared multi-selection operation, Plan must not silently drop ineligible
  members and mutate only the eligible subset: unless a future capability
  explicitly defines partial-operation semantics, the operation is unavailable
  or refused for the whole selection.
- A Plan-ineligible entity exposes no misleading Plan placement/transform handle.
- Historical note (not a current seam): the removed editor's workspace-selection
  and selectability seams still carried Room context, so canonical world-local
  selection was not fully Room-free. T2's obligation is the Room-free,
  view-independent selection contract above, rebuilt with the T2 selection
  authority rather than restoring the removed seams.


### Gestures cancel at real transitions

- If a Plan ↔ 3D transition is accepted while a shared placement or transform
  interaction is unfinished, the **interaction owner cancels it before** the view
  changes: restore the last committed baseline; end the transient
  pointer/drag/preview session exactly once; produce no history result; preserve
  the committed Scene selection for a view-change cancellation; only then apply
  the requested transition.
- Recorded live gap (not an alternate semantics to preserve): switching was
  disabled while an interaction was active. That is safe against an accidental
  commit but is not the accepted-switch → cancel → switch behavior above.
- Both views' plan cells were kept mounted and inert when hidden, with teardown
  defensive only so a delayed pointer-up after a cancel could not commit (removed
  with the editor shell; a T1/T2 rebuild re-establishes equivalent safety). One
  interaction owner performs the cancellation — the editor's gizmo host, Plan
  gesture owner and pending-placement owner were the predecessors, removed by
  #115 — and a second interaction state machine is rejected.


### A preview candidate equals its commit

- Ghosts and helpers are absent from serialization.
- The final preview equals the commit, within a stated pose tolerance
  (1e-6 world units / radians in the source acceptance).
- One drag is one entry; invalid, no-op and cancelled gestures are none; undo and
  redo are exact. Support choice is resolved **in the preview candidate** and that
  validated candidate is committed; late invalidity refuses or rolls back.
- Recorded live gap (R3 support/Y integration): a rigid "keep on floor" commit
  ran after the last displayed preview, so Y could change between the last
  displayed candidate and the authored commit. The obligation is the preview =
  commit rule above, not a second preview system.


### One acceptance/history result

- All authored operations go through one Scene acceptance/validation/history
  authority (the editor transaction/history system that held this was removed by
  #115; T2/T3 rebuild it, with F.4 the cross-domain destination). One logical
  commit = one tagged Scene history entry;
  invalid/cancel/structural no-op = none; undo restores the prior state and redo
  replays the committed ids/result.
- No Layout write accompanies Scene work. One user action remains one Scene
  history result; no mixed-document gesture, no hidden support-side write without
  an explicit atomic contract.
- Project/environment replacement resets baseline history under the load
  semantics the rebuild establishes, with no synthetic user edit and no
  mid-gesture conversion.


### Mutations follow entity authority

- Scene entities, primitives, lights, materials and their instances are
  `SceneDocument`-owned; Layout structure stays Layout-owned.
- Scene placement and transforms create records **without Room ownership** —
  not even a room field holding undefined.
- One authority per concern is the contract: one selection/history authority, one
  transform/gizmo host with domain adapters, one Layout compiler/query core and
  one camera graph — rebuilt as T2/T3 capabilities, not the removed editor
  systems restored verbatim. Second selection, history, gizmo, geometry or
  navigation systems, persisted Three objects and nested transform rigs are
  rejected.
- Acquisition/approval is outside the authoring history; scene state is
  serializable semantic data only.


### TD-1 — acceptance tests the fix owes (verbatim)

TD-1 (floor-supported placement unreachable in canonical wall-first projects) is
closed as **implementation removed, not fixed**: the defective placement wiring
was deleted with the editor shell. Its owed acceptance tests transfer here
verbatim (implementation-plan §8.6, §8.4). The replacement for camera-node
placement specifics is decided by the re-derived T2/T3 plans; the obligations
below are the contract.

```text
1. Canonical boot → place → commit: a wall-first document with one reconciled Room +
   `beginCameraPlacement()` + the floor hit ⇒ exactly one unsequenced node, one history
   entry, `roomId` absent, world-space eye/target finite.
2. Round trip: that project passes `validateProject` and Save/Publish
   (no `scene_not_world_local`, no `unknown_room`).
3. Both surfaces: Camera · Plan and Camera · 3D reach the same result for the same
   floor point.
4. Legacy is untouched: the existing `live-rooms.test.ts` room-first behaviour and the
   frozen relic keep passing, including the throw-free `rooms.point/getRequired` contract
   for room-first documents.
5. Refusal is honest: clicking outside any Room still refuses, with a reasoned message
   and no history entry.
```

Two factual notes on the verbatim text, neither altering its obligation:
`live-rooms.test.ts` was removed by #115 with the editor shell, so item 4's
room-first coverage now lives in the frozen project's own suite; and the refusal
copy item 5 names is not preserved literally — the refusal must be **reasoned**,
and reusing the resolution-reason vocabulary rather than inventing a second one
was already owed.


### Atomic group/duplicate validation

- Flat cluster semantics are retained: membership-only grouping preserves poses,
  one group maximum, no nesting, no Three parenting as an authored hierarchy.
- Deleting entities cleans references and selection through one Scene authority;
  no dangling member survives.
- Duplicate: deterministic +0.5 world X/Z offset, Y and material sharing
  preserved, no hidden move or grounding entry.
- A full cluster is duplicated as a cluster; a partial member selection is
  ungrouped with a warning. Missing targets and overlap are deterministic, and an
  invalid batch leaves the document unchanged.
- **Validate all clone candidates before one commit**; atomically commit or not
  at all.


### Material and light semantic gaps

Materials (definitions/instances and shared-vs-unique already exist):

- Gaps to close: instance tint and reset, metric tile size where the mapping path
  supports it (no UV editor), approved PBR map sets, and atomic selected-subset
  editing that protects unselected shared users by default.
- A default edit clones once per shared instance for the selected subset and
  retains sharing inside it; an explicit "edit shared" path discloses the
  total/outside user count. Cancelled choice, unsupported target and failure write
  nothing.
- Whole-object assignment replaces all mesh materials and does **not** promise
  imported glass/alpha preservation; clearing a model assignment restores the
  imported appearance.
- Arbitrary UVs expose unsupported metric controls with a reason rather than an
  automatic projection. No shader/node graph, slot editor or texture painting.

Lights and environment:

- Three light types exist. Gaps to close: truthful stored units, an editable
  spot half-angle presented in degrees against canonical radians, and an
  **explicit undoable repair** for legacy values outside the supported maximum —
  never a silent load-time clamp or reinterpretation, and new publication blocked
  until repaired.
- Editor-only helpers are mounted for selected lights only and are never
  serialized. The emitter body has no scale control and no screen-space
  emitter-range gizmo; a selected Point light may show a derived reach ring,
  and a selected Spot may show a derived far-cap rim plus its cone edges. Those
  are line-only frustum instruments, not handles that scale the light or
  silently rewrite an authored field. Exact Reach remains a Card field (and the
  derived rim/ring follow it).
- Authored environment is global Scene-level intent (asset id, intensity, Y
  rotation, background mode) with the legacy implicit baseline preserved when
  absent; an explicitly authored mode with no environment is valid. Rotation
  affects image-based lighting and the environment background consistently.
- No hidden assist/baseline sum: any editor assist light is visibly session-only
  and off for comparisons and visitors. PMREM/environment caches are **derived
  renderer resources** with scope, reference counts and asynchronous
  cancellation — never authored Scene truth.


### Static-model source drift

- A static-only catalogue ceiling no longer binds T2, but the delivered bytes must
  be authoritative for **actual loading**, not only for validation: cold model
  load uses the retained compatibility source even when the live catalogue changes
  or disappears, and an already-published release keeps its retained static
  mapping.
- Attribution that a source requires survives into library and publication output.
- A missing, failed or corrupted resource is visible and never silently accepted;
  provider/signed URLs are not shipped as the durable source. Fallback resolves
  separately and visibly.
- A render-ready derivative must never be advertised as a preserved semantic
  assembly.


### Truthful ingest, provenance and resource locking

- Ingest **declares** which structure, clips, material slots, pivots and metadata
  survived and which operations are supported, and retains source bytes and
  conversion provenance where later reprocessing requires them.
- Definitions, states, performances and clips are typed resources with logical
  identity plus an exact revision or content identity, project and library scopes,
  and a project dependency lock. Availability, authorization and retention travel
  with reuse.
- A locked reference is never silently rewritten; an incompatible replacement is
  reported for repair, never auto-matched by name or position.
- Names and indices may locate data inside a source revision; they do not prove
  continuity across a re-export.


### No renderer/library upgrade is implied

- The renderer dependency baseline is a **conditional** choice made at
  implementation freeze, not a pin to a newer revision. No decoder or engine
  upgrade follows from T2.
- The r175–r186 harvest's `Object3D.dispose()` finding is downgraded from an
  adoption to a **conditional implementation recheck**, because of the Threlte
  disposal interaction and the later point-shadow disposal fix. Preserve scoped
  caches, reference counts, clone ownership and asynchronous cancellation; do not
  infer recursive disposal or delete ownership logic.
- An optimization that does not reproduce under measurement is not adopted, and a
  benchmark family with no enforced threshold is not treated as a regression
  guard.


## Stage — World composition and shared assets

Scene owns scene-object composition: imported models, primitives, materials,
lights, placement, transforms, visibility, authored object properties,
environment/atmosphere, render settings and spatial audio emitters as
destination. Plan Arrange and 3D expose supported operations through the same
continuous spatial system according to representation and capability; a
destination does not change the owning authority.

**Destination composition model.** Distinguish a source definition, placed
instance, internal component, organizational group and attachment. World-local
roots remain the default; internal components may use declared parent-relative
frames, and attachment is a typed relationship with a host and parameters.
Proximity and grouping never imply ownership or connectivity. Shared source
resources do not share mutable pose, materials, playback or overrides.

- **Definitions and instances:** an object definition exposes an intrinsic
  interface (what it can do, parameter meaning, limits, affected channels,
  required components). Placed instances supply configuration, compatible
  per-component overrides and default behavior parameters. A Scene behavior
  binding may start a bounded ambient behavior when that Scene's execution
  context starts, through the common conductor — never a private animation loop
  writing around channel ownership.
- **Reusable performances and Experience Presentations are separate from the
  instance baseline.** Portable performance resources compose capabilities with
  optional or required Camera, light, media and content roles. Experience-owned
  Presentations supply visitor meaning and bind supported uses to concrete
  subjects; neither is an instance baseline or a second copy of intrinsic
  capability.
- **Two override mechanisms:** composition overrides establish the effective
  instance baseline (definition defaults → selected variant → allowed instance
  overrides); invocation overrides supply parameters, bindings, time mapping and
  supported local specialization without mutating that baseline. A captured
  visible pose becomes authored intent only through an explicit validated
  capture operation with a stated target scope.
- **Resources:** references need logical identity plus an exact revision or
  content identity, with a project dependency lock. Availability, authorization
  and retention travel with reuse — an authorized shared reference or a vendored
  immutable copy, never a fragile pointer into another project's private store.
  Identical immutable bytes in two packages are delivery copies of one revision.
  Detaching for independent editing creates a new authored identity. A library
  update is an offered revision requiring acceptance and impact review; existing
  projects and releases keep their locked revisions.

**Truthful ingest (destination).** Ingest declares which structure, clips,
material slots, pivots and metadata survived and which operations are supported.
Retain source bytes and conversion provenance where later reprocessing requires
them. A flat model remains useful at object level; an optimized render hierarchy
does not establish durable component identity. Native procedural definitions
retain parameters and an explicit correspondence policy. Names and indices may
locate data within a source revision; they do not prove continuity across
re-export — revision-qualified identity and a supported mapping policy are ours
to supply. A render-ready derivative must not be advertised as a preserved
semantic assembly without a separate preservation contract.

**Current implementation:** P20 project-scoped texture registry + private R2
bytes; P20.2 cloud texture upload/list/use; P22 release manifests pin verified
object keys; static catalogue models declare canonical footprint metadata; Scene
clusters are named same-room member groups with no prefab/definition model; GLB
import and provider search remain deferred. The current registry is a
project-scoped implementation, not the destination resource system.
