# T2 · D8 — Visible fixtures and reusable lighting rigs

**Status:** direction, P1–P5 and the D8s specimen recommendations O1–O3 accepted by the owner
(2026-11-27/28), with the bounded corrections folded in below. P6 is accepted (2026-11-28) and D8p
has landed against it; D8d and D8f remain unimplemented. No fixture asset is ingested and no
dependency beyond the plan is admitted. The plan grants permission only for the slices in §10.

**Inputs:** the [T2 roadmap](../README.md) (§5 Lights, Groups and Rigs, D8, D12, D18, §9 Homes),
the landed [G1 groups](../g1-groups/implementation-plan.md), [S8](../s8-professional-material-foundation/implementation-plan.md)'s
fixture/rig track line, the [T5 umbrella](../../t5-expressive-geometry/umbrella-plan.md) (T5.3
`scene.object-definition`, T5.4 `studio.assembly-reuse`), and the
[Scene](../../../reference/scene.md), [Resources](../../../reference/resources.md),
[Persistence](../../../reference/persistence.md) and [Rendering](../../../reference/rendering.md) contracts.

| Build | Leave out |
| --- | --- |
| A small curated set of CC0 fixture models, each one ordinary catalogue model grouped with one ordinary point or spot light | Live-linked rigs or instances, articulated heads, new light kinds, area/linear lights, emitter-linked glow |
| Placement of a fixture on a ceiling or wall as one write, one Undo | Floor-standing fixtures (none on the approved shortlist), group nesting or merging, a parent transform, Scene-surface support (a lamp on a table), a second ceiling-resolution authority |
| Save any eligible group to My Objects; insert it into any project as a detached, editable copy | Artwork, planes, creator models or models without admitted contact inside a saved group; carrying project Finishes (§4.2 Finish rule); offered library updates |
| The missing shipped-asset closure, so a catalogue model can be placed in a new project | A resources or Scene format bump, a new resource kind, a transfer route for groups |
| One shared group-template source shape, reused by curated fixtures and saved groups | Any abstraction shared with T5 object definitions beyond the library seams in §3 |

## 1. What exists on main

Investigated on `ad8b1bdc0`. The facts that shape the design, starting with the gaps:

1. **A catalogue model cannot be placed in a new project.** Envelope closure requires a
   `{kind:'asset', id}` resource for every catalogue model entity
   ([envelope.ts](../../../../packages/project-model/src/units/validate/envelope.ts), the
   `requiredResources` block). No production planner creates one: `place-object` grants only the
   creator `model` resource
   ([model-resource.ts](../../../../packages/project-model/src/scene-planning/model-resource.ts)).
   Only test fixtures build `asset` resources (`s17-mixed-project.ts` pins `sha256-…` from the shipped
   file with a `resource:asset` lock). [catalogue-models.ts](../../../../apps/editor/src/lib/authoring/adapters/scene/catalogue-models.ts)
   therefore hides every catalogue model a project does not already hold. Fixtures inherit this gap.
2. **Shipped models carry no byte pin.** `SHIPPED_MODELS` in
   [shipped-static.ts](../../../../packages/project-model/src/shipped-static.ts) is append-only and maps
   `assetId → productionFile`, with no hash. Curated textures, by contrast, are pinned by sha256, MIME
   and size (`SHIPPED_MATERIAL_IMAGES`). A pure planner cannot grant an exact asset revision without
   a pin.
3. **Model placement is floor-only, but a lifted model is valid source.** `place-object` admits only
   `supportedSurfaces: ['floor']` and resolves Y from support. `set-lift`, Move and G1 transforms
   already keep an upright model *lifted* above the highest support at or below its base
   (`resolveDestinationSupport`, G1 §3.4). A pendant or sconce is therefore representable today as a
   lifted upright model. Only the creator path that places one is missing.
4. **Two placement precedents cover the remaining mounts.** Light placement already picks a Stage
   surface and reads its normal: floor-like hits hang at 2.2 m, walls and ceilings use a standoff
   ([light-presentation.ts](../../../../apps/editor/src/lib/authoring/look/light-presentation.ts)).
   `artwork-place` accepts an editor-derived wall pose without a planner wall check and stores no wall
   relation. For ceilings, T1 already owns the authority: `queryOverheadSupports`
   ([floor-support.ts](../../../../packages/layout-core/src/room/floor-support.ts)) returns closed-Space
   lids and overhead-region undersides at an X/Z point, ordered by elevation, from compiled records
   only, with the same tolerances, witnesses and generation checks as the floor query Scene planners
   already call (`scene-planning/support.ts`). No Scene code consumes it yet. V3 shed and gable forms
   are sequenced but unplanned, so no sloped overhead is published today; today's overhead-region fit
   refuses a sloped Wall top beneath it.
5. **Groups are flat clusters with no frame.** `SceneObjectCluster {id, name, memberIds≥2}`, with one
   group per entity. Groups are not nested or merged (`group-operations.ts` refuses a second
   membership). A group has no origin, no saved pose and no resource identity, so the cluster alone
   cannot be a reusable resource. Rigid Move/Turn
   ([rigid.ts](../../../../packages/project-model/src/scene-planning/rigid.ts)) already keeps every
   spot's forward vector and target within 1e-6 of the rigid image. `create-light-rig` builds exactly
   three lights plus one cluster for Showcase.
6. **My Objects holds only `form` and `material` items.** The strict shared readers live in
   [library/](../../../../packages/project-model/src/library/index.ts). The API stores items in
   `form_library_items` with `CHECK (kind IN ('form','material'))`
   ([001-baseline.sql](../../../../apps/api/migrations/001-baseline.sql)). A form item is inserted
   through `place-form-copy`, which carries the item inline and creates a detached copy with no link
   back. The form payload drops a project Finish and keeps the catalogue `materialId`.
7. **There is no Fixtures UI.** The Library's Lights shelf lists Point and Spot only
   (`LIGHT_SHELF`, [look-authoring.svelte.ts](../../../../apps/editor/src/lib/authoring/look/look-authoring.svelte.ts)).
   The approved [Light & Sky target](../../../../prototypes/light-and-sky-ux/README.md) reserves a
   *Physical fixture* layer ("Scene · authored object") and draws a dashed future *Fixture* glyph. D18
   forbids an empty Fixtures row.
8. **The current catalogue is unusable for D8.** Its lamp and chandelier are CC BY 4.0. Only Sofa 03
   (Poly Haven) is CC0. The admission inventory
   ([object-definition-policy.ts](../../../../apps/editor/src/lib/authoring/scene/object-definition-policy.ts))
   admits one verified floor model (the salon chair), and its contacts come from recorded loader
   verification, never live bounds. A shipped file is therefore necessary but not sufficient for a
   model to be placed: without an admitted definition and recorded contact the planner refuses
   `missing-definition` or `missing-contact-metadata`.
12. **Existing asset records are few and unchecked.** No production path writes an `asset` resource,
    so persisted records come only from test fixtures or hand-built projects. The s17 fixture derives
    `sha256-…` from the bytes on disk at test time. One editor test builds `{kind:'asset', id,
    unresolved:null}` with no revision. Nothing compares an asset revision with bytes: the runtime
    loads `productionFile` by path, and the API checks only that the id is shipped. Reprocessing a
    file in place today would silently change every copy that names its id.
9. **Visitor and release accept only shipped catalogue models.** The cold runtime refuses unknown
   asset ids, and the API's `isKnownAssetId` reads `SHIPPED_MODELS`. Publish still returns
   `prepared-reader-required` until T4; visitor Preview shares the runtime evaluators.
10. **Rendering limits.** No Glow or emission family exists ("Glow lights nothing"; opacity and
    emission are later material families). Whole-object Finish assignment does not preserve imported
    glass or alpha. D9 is proposed, not in force: it sets no caster cap and refuses silent light caps.
    No recipe casts shadows.
11. **The ingestion pipeline exists.** `normalize-asset.sh` (pinned `@gltf-transform/cli`, already a
    dev dependency) has only the `furniture-floor` recipe. Licence and provenance follow
    `assets-source/licenses/*.md` and `classifyRights` (A/B/C/D, where unknown never approves). The
    texture records snapshot the licence page into the retention store.

## 2. Scope: two tracks over one source shape

D8's two outcomes share one requirement: **a frame-local description of several ordinary Scene
entities that becomes one new group in one write.** A curated fixture is a shipped instance of that
description: one catalogue model and one light, posed relative to a mount datum. A saved rig is an
owner's instance of it, captured from an accepted group. Both insert through one operation,
`place-group-copy`, and land as ordinary entities plus an ordinary cluster. After insertion, G1 owns
every behaviour: click group then member, rigid Move/Turn, Duplicate, Ungroup, Erase, the Light
Card and Undo.

This is the smallest foundation that satisfies both outcomes. The challenges considered:

- **Rigs do not need fixtures.** A lights-only rig, such as a saved Showcase, needs no asset
  ingestion. The rig track (D8e → D8f) and the fixture track (D8c → D8d) share only the foundation
  (D8a → D8b → D8p) and neither depends on the other (§11).
- **A fixture does not need a new entity kind or field.** The model gains no light type, the light
  gains no host, and the cluster gains no `fixture` flag. Emitter alignment is the light member's
  frame-local pose, which rigid group transforms already preserve.
- **A reusable group does need new source.** The cluster has no frame or closure, so the template
  (§4.2) is new. It lives only in the library item, in shipped catalogue code and in the intent
  payload. Scene stores nothing new, and an inserted copy keeps no link to its source.
- **Not shared with T5.** A group template has no root, definition revision or component identity,
  and an object definition cannot hold lights. §3 records what is shared.
- **Deliberately small:**
  - one emitter per curated fixture;
  - ceiling and wall mounts only, because the approved shortlist has no floor fixture; a floor
    fixture later is an additive catalogue entry using the `support` origin saved groups already use;
  - no thumbnails for saved groups;
  - no refactor of `create-light-rig`. Showcase keeps its planner. A later multi-light recipe may
    express itself as a template if one appears.

## 3. Reconciliation with T5.3 and T5.4

| Concern | D8 | T5.3 / T5.4 | Verdict |
| --- | --- | --- | --- |
| Library item envelope: owner authorisation, canonical bytes, sha256 content id, 256 KiB / 1,000 limits, immutable items, older-format listing | Adds kind `group` | T5.4 adds an object-definition kind | **Shared, as it exists.** D8e generalises the kind dispatch in `@portfolio/project-model/library` and the API, with one numbered migration. T5.4 adds its kind through the same seam. |
| Detached-copy insertion | Intent carries the payload inline and the planner re-reads it strictly. Captured fresh ids are created in one F4 write. Nothing links back. | "Insert copy" allocates new root, definition and component ids in one F4 operation | **Shared rule, separate planners.** Each owns its remap: D8 has no internal references beyond the member list, while T5.4 remaps component references. |
| Closure classes | Catalogue materials, pinned shipped models; private resources refused | Catalogue appearance only; imports, textures and private dependencies refused; "external model dependencies wait" | **Shared vocabulary.** D8a's shipped-asset grant is the piece a later T5 leaf naming a shipped model would reuse. |
| Payload meaning | Loose members (light, catalogue model, form, primitive) and one flat cluster; frame-local poses; no identity beyond order | One root entity referencing a project-local definition resource with stable component ids and an exact lock; native-form leaves | **Distinct.** A group never becomes an object definition, and no conversion between them is planned (G1 §5). |
| After insertion | Ordinary entities; editing changes entities | Editing creates a new definition revision | **Distinct.** |
| Lights | First-class members | Not admitted as components | **Distinct by design.** A light inside a definition is a light-emitting object, which D12 reserves for definition/instance semantics shared by objects and lights. |

**Resequencing: none warranted.**

- D8 needs no root, component identity or definition resource. Detached copies of flat groups are
  fully served by G1's cluster.
- T5.3 and T5.4 need nothing from D8: their leaves are native forms with catalogue appearance.
- The one ordering effect is mechanical: whichever lands first adds the third library kind and the
  kind-dispatch seam. D8e is likely first, because T5.3 has not started.
- If T5.4 is planned before D8e lands, it should reuse D8e's dispatch design rather than invent a
  second one.
- T5 must not admit a light leaf to work around this boundary.

## 4. Source contracts

### 4.1 Shipped model identity, pin and asset grant (D8a)

**Invariant: one shipped asset id names one byte revision, forever.** Once an id ships with a pin,
its pin and its production file bytes never change. Reprocessing an asset (a new decimation, a
texture fix, a re-derived pivot) ships a **new id** with a new file and a new pin. Existing copies keep
the old id and the old bytes, and new placements use the new id. The old file stays served while
its id is in the registry, and the registry is append-only. So a copy's appearance changes only
through an authored edit.

```ts
// shipped-static.ts — append-only by id; a pin, once set, is immutable.
type ShippedModelPin = { sha256: string; byteSize: number; mime: 'model/gltf-binary' };
type ShippedModelEntry = {
  assetId: string;
  productionFile: string | null;
  fallbackOnly: boolean;
  pin: ShippedModelPin | null; // null exactly when productionFile is null
};

// scene-planning/shipped-asset-resource.ts — the production form of the s17 fixture.
shippedModelResourceEntry(assetId): { resource: TypedResource; lock: DependencyLockEntry } | null
// resource: { kind: 'asset', id: assetId, contentRevision: `sha256-${pin.sha256}`, pin: null, unresolved: null }
// lock:     { domain: 'resource:asset', subjectKind: 'resource', subjectId: assetId, instancePath: [],
//             contentRevision, requiredCapabilities: [], pin: null }
```

**Guards** (all D8a, all tests rather than runtime checks):

- a committed pin ledger (`shipped-model-pins.json`, id → pin) that a test compares with
  `SHIPPED_MODELS`: removing an id or changing an existing pin fails; appending passes;
- a test that hashes every shipped production file against its pin.

**Grant rule**, used by `place-object` for an admitted catalogue model and by `place-group-copy`:

| Held `asset` resource for the id | Result |
| --- | --- |
| None | Add the resource and its lock with the entity, in the same accepted result |
| Resolved, revision equals the pin (with or without a lock) | Reuse unchanged; add the lock if absent |
| Resolved, revision differs from the pin, or a lock pins another revision | Refuse `incompatible-resource`; never rewrite |
| Unresolved, or no revision | Refuse `incompatible-resource`; never resolve silently |

An unused asset resource stays. Closure permits it, and Undo restores the whole envelope.

**Compatibility before tightening.** Save and Load do not refuse on asset revisions until compatibility
with existing records is established. D8a is split:

1. **Audit.** Run a read-only script over the repository's fixtures and seeds and over the owner's
   development database. For each `asset` resource, compare the revision with the new pin and classify
   it as *matches*, *no revision* or *differs*. Commit the report summary to the PR, not to `docs/`.
2. **Pins, ledger, grant.** Land them regardless of the audit. The grant never rewrites a held record,
   so it is compatible with any record the audit finds.
3. **Tighten.** Only when the audit finds nothing outside *matches*, add the Save and cold-Load check
   that a resolved `asset` revision equals its pin (`asset-revision-mismatch`). Fix test fixtures that
   lack a revision in the same change. If the development database holds any other class, stop and
   ask the owner: changing persisted projects is a destructive data action. The check is a guard, not a
   D8 dependency, and D8 proceeds without it.

**No format change:** resources stay format 3, Scene stays 13. Required asset locks are not added,
because tightening closure would be a format change with no D8 consumer.

### 4.2 Group template (D8b)

One strict codec in `@portfolio/project-model/scene-planning` (`group-template.ts`), used by curated
fixtures, the library payload and the intent:

```ts
type GroupTemplate = {
  name: string;                    // 1–120 characters, trimmed, as form items
  members: GroupTemplateMember[];  // 2–64; order is the cluster's member order
};
// Each member is a Scene entity record without `id` and without `materialInstanceId` (the Finish
// rule below), with `position` and `rotation` in the template frame (metres, Euler XYZ).
type GroupTemplateMember =
  | Omit<SceneLightEntity, 'id'>                                    // point | spot, all light fields
  | Omit<SceneModelEntity, 'id' | 'materialInstanceId'>             // assetId, fallback, scale?
  | Omit<SceneFormEntity, 'id' | 'materialInstanceId'>              // form source verbatim
  | Omit<ScenePrimitiveEntity, 'id' | 'materialInstanceId'>;        // box | cylinder | sphere only
```

- **Validation** goes through the Scene entity codec, so the template admits exactly what Scene 13
  admits.
- **Additional refusals:**
  - Artwork (its image is project-private);
  - planes (no honest floor contact);
  - a model that is not an **admitted shipped model**: its `assetId` must have a shipped pin
    (§4.1) *and* an admitted host definition with recorded `contactMinY`
    (`missing-definition` / `missing-contact-metadata`). A pin alone is not eligibility. This
    excludes creator `model` resources and every catalogue model whose contact is unverified;
    today only the salon chair qualifies;
  - any non-upright form, primitive or model (G1's `floorTransformSupport` rule);
  - unknown keys.
- **Finish rule** (the one policy used everywhere in this plan): a project Finish is never carried.
  `materialInstanceId` is dropped when a template is made. A form or primitive keeps its catalogue
  `materialId`, and a model keeps its own materials. A Finish never makes a member ineligible, and
  Save discloses the drop (§7). This is the landed `formLibraryPayloadFromEntity` precedent.
- **Canonical bytes** follow the library precedent: sorted keys, finite numbers, member order
  preserved.
- **The template frame** is axis-aligned with the World it came from:
  - **Curated fixture:** the origin is the mount datum (§6.1).
  - **Saved group:** `groupTemplateFromCluster(context, clusterId)` is a pure, read-only function
    over the accepted envelope.
    - The pivot X/Z is G1's `rigidPivot` (`group-motion.ts`), the centre of the members' X/Z extent.
    - The origin Y is the elevation of the highest support at or below the group's lowest point,
      resolved at the pivot. The lowest point is each support-bearing member's base, or each
      light's position.
    - Positions are stored relative to that origin; rotations are copied unchanged.
    - It refuses `no-support` when nothing resolves, and `ineligible-member` naming the first
      member that fails eligibility.
  - Inserting a saved group onto another floor therefore keeps every member's height above that
    floor.

### 4.3 `place-group-copy` (D8b)

A new Scene operation kind, registered beside `place-form-copy`:

```ts
payload: {
  template: GroupTemplate;                     // re-read strictly by the planner
  name: string;                                // cluster name; the editor applies G1's nextGroupName
  origin:
    | { kind: 'support'; worldXZ: [number, number]; supportChoice?: SceneSupportChoice }
    | { kind: 'overhead'; worldXZ: [number, number]; supportChoice?: SceneSupportChoice }
    | { kind: 'wall'; position: Vec3 };        // editor-derived, the Artwork precedent
  yaw: number;                                 // radians about +Y at the origin
  frame; frameReference;                       // as place-object
  entityIds: string[];                         // captured, one per member, in member order
  clusterId: string;                           // captured
  contacts: (number | null)[];                 // captured admitted contactMinY per member; null for lights
}
```

**Plan.** These steps run in one F4 write over Scene, resources and lock:

1. **Read.** Strictly read the template. Require `entityIds` and `clusterId` to be fresh, distinct
   and absent from the accepted Scene, with `entityIds` the same length as `members`.
2. **Resolve the origin.**
   - `support`: use the `place-object` destination rule at `worldXZ`, with the same `supportChoice`
     semantics, and set Y to the support elevation.
   - `overhead`: resolve the floor support at `worldXZ` as for `support`. Then call T1's
     `queryOverheadSupports` on the same snapshot compile and generation, with `aboveElevation` set to
     that floor elevation, and set Y to the lowest candidate's elevation. `none` refuses
     `no-overhead-support`, and `unsupported`, `stale-generation` or `invalid-input` refuse with the
     query's own code. No hit Y, `ceilingElevation` read or mesh face enters the pose, so Scene adds
     no ceiling authority. Whatever V3 publishes through this query is consumed unchanged; see §6.1.
   - `wall`: take the position as given, as `artwork-place` does. Its wall relation is not stored.
3. **Compose each member** with G1's rigid helpers about the origin:
   - position = origin + `Ry(yaw)` · local;
   - light rotation = `Ry(yaw)` · R, decomposed with G1's declared branch;
   - an upright member's rotation gets G1's exact yaw add.
4. **Revalidate support.** Each support-bearing member's base is the composed Y plus its scaled
   `contacts[i]`.
   - The member must rest on, or be lifted above, a support at or below it
     (`resolveDestinationSupport`).
   - Contacts follow `readContactMinY`: analytic for forms and primitives, the host-captured
     admitted value for models (as in G1 duplicate). A model member whose host definition is not
     admitted, or has no recorded contact, refuses `missing-definition` or
     `missing-contact-metadata`, even if its asset is pinned.
   - Any failure refuses the whole operation and names the member.
5. **Grant assets.** Apply the §4.1 grant for each distinct model `assetId`.
6. **Build and append.** Build entities with the existing builders (`buildLightEntity` and the
   model, form and primitive builders). Append them in member order, then append
   `{id: clusterId, name, memberIds: entityIds}`.
7. **Validate.** Check the candidate Scene and the envelope closure.

**Record scope:** `createdEntityIds = entityIds`, `clusters.created = [clusterId]`, plus the added
resources and lock entries. It is one Undo. Selection is session state, and the editor selects the
new group.

### 4.4 Saved group library item (D8e)

```ts
// @portfolio/project-model/library/group-library.ts
GROUP_LIBRARY_PAYLOAD_FORMAT_VERSION = 1
type GroupLibraryPayload = { formatVersion: 1; kind: 'group' } & GroupTemplate;
readGroupLibraryPayload(input) / readGroupLibraryBytes(bytes, contentId) / canonicalGroupLibraryPayload(p)
groupLibraryPayloadFromTemplate(template)
```

- **Shared limits:** 256 KiB canonical bytes, 1,000 items per owner, a sha256 content id recomputed
  by the server, and immutable items.
- **Reader dispatch.** A new `readLibraryItemPayload` in `library/index.ts` dispatches on `kind`
  (`form | material | group`) and refuses any other.
- **API.** `POST /library/items` accepts `kind: 'group'`. List, get and delete are unchanged and
  owner-only, and another owner's id answers as not found.
  - A group has no image dependencies, staging, receipt, transfer route or thumbnail.
  - A summary carries the existing fields, and the client derives counts after GET.
- **Migration.** A new numbered migration, `002-library-group-items.sql`, widens the
  `form_library_items.kind` CHECK to include `group`. It is additive; existing rows are untouched.
- **Older formats.** An item written with another `formatVersion` lists and removes as today, and
  is refused at insertion with `unsupported_format_version`.

### 4.5 Curated fixture record (D8c)

Each fixture is an editor-side catalogue entry in `$lib/content/fixtures.ts`, append-only by id:

```ts
type CuratedFixture = {
  id: string;                      // e.g. 'fixture-hanging-industrial'
  label: string; summary: string;  // Library tile text
  mount: 'ceiling' | 'wall';       // a floor mount is admissible later with a qualified asset
  template: GroupTemplate;         // exactly one model member and one light member
  provenance: { work: string; creator: string; source: 'Poly Haven'; sourceUrl: string;
                licence: 'CC0-1.0'; record: string /* assets-source/licenses/<file>.md */ };
};
```

Each fixture has five companions:

- an `Asset` entry: `category: 'lamp'`, `placementSurface` = mount, `castShadow: false`,
  `defaultScale: 1`, no `defaultRotation`, `status: 'approved'`;
- a `SHIPPED_MODELS` entry with its pin;
- a fixture verification record in the admission inventory: footprint, `contactMinY`, mount datum,
  emitter anchor, beam axis and verification id;
- admission for `place-group-copy` only. `ObjectDefinitionAdmission.operations` widens from the
  literal `['place-object']`; a fixture body is not offered alone on the Objects shelf;
- a licence record.

A test proves the template's light pose equals the recorded anchor and axis.

## 5. Asset sourcing and licence verification (D8c)

**Source: Poly Haven only, for the first set.**

- Its [licence page](https://polyhaven.com/license) puts every model under CC0 with no attribution
  requirement.
- Its files API publishes per-file sizes and MD5s.
- The repository already has two A-confidence precedents: Sofa 03, whose files match the API
  checksums, and the S8 texture harvest, whose licence-page snapshot is held in the retention store.
- The public API's README credits are needed only by apps that call the live API. The product calls
  none at runtime.
- Poly Haven's terms prohibit scraping. Acquisition is a handful of ordinary downloads checked
  against the files API, as for Sofa 03.

**Other sources considered:**

- Kenney and Quaternius (CC0) clash in style with PBR interiors.
- Smithsonian Open Access licences vary per item and its scans are heavy.
- Sketchfab's CC0 filter is uploader-asserted, so it falls to C at best under `classifyRights`.

These sources remain admissible later through the same gate.

**Shortlist approved for qualification** (P1; metadata read from `api.polyhaven.com/info`; nothing
downloaded):

| Candidate | Creator | Mount | Reported size (mm) | Poly Haven polycount | Materials | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Hanging Industrial Lamp | Kuutti Siitonen | ceiling | 550 × 550 × 1,355 | 9,530 | metal, glass | Ships an **emissive map** (P2). Its files listing has an anomalous `.bin` URL; verify every MD5. |
| Modern Ceiling Lamp 01 | James Ray Cock | ceiling | 432 × 432 × 952 | 5,602 | glass, metal | Glass globe; conditional on the glass probe |
| Lantern Chandelier 01 | Kirill Sannikov | ceiling | 579 × 575 × 878 | 5,971 | brass, glass | Fits the salon World; one emitter only |
| Industrial Wall Sconce | Ulan Cabanilla | wall | 150 × 252 × 342 | 9,826 | brass, metal | Wall mount |
| ~~Street Lamp 02~~ *(not selected)* | Josh Dean | floor | 386 × 807 × 1,675 | 20,338 | metal, glass | Exterior only; over budget. Not on the approved shortlist, so D8 ships no floor fixture |

**Excluded:**

- Desk Lamp Arm 01: rigged and articulated.
- Flood Lights, Portable Searchlight and the torches: visibly directional heads (P3).
- Chandeliers 01–03: 21–29k polycount and many candle points.
- Caged bunker fittings: style.

Poly Haven has no picture light; the Picture spot recipe remains the gallery answer (P1).

**Evidence per fixture**, following the material records:

- `RightsEvidence` must classify A. Unknown fields stop the fixture.
- Store the source ZIP's sha256 and every file's MD5 matched against the files API at acquisition.
  Retain the sources byte-identically in the retention store, never in git, as the S8 textures are.
- Snapshot the licence page with its sha256, and record the acquisition date.
- Write `assets-source/licenses/fixture-<id>.md` in the `sofa-03.md` layout: work, creator,
  canonical URL, licence and URL, optional credit, files, processing, and source and production
  metrics.
- Add a row to `assets-source/models/fixtures-acquisition-manifest.json`.

**Derivation.** Add `fixture-ceiling` and `fixture-wall` recipes to
`normalize-asset.sh`, keeping it hash-in/hash-out and atomic:

- Metres, +Y up, front +Z.
- The pivot is the mount datum, so no `renderNormalization` or `defaultScale` correction is needed:
  - ceiling: the centre top of the canopy, `--pivot above`;
  - wall: the centre of the back plate on Z = 0, a recorded translation.
- Meshopt, embedded WebP textures and MikkTSpace tangents, as Sofa 03.
- Baked emission handled per P2, and the change recorded.
- Production files go to `static/models/fixtures/<id>.glb`, not under `/museum`.

**Budgets** (engineering; the slice may tighten them): at most 15,000 triangles, at most 3
materials, at most 1 MiB GLB, textures at most 1K, qualified at 512 where texel density allows.

## 6. Geometry, emitter alignment, placement and aiming

### 6.1 Mount datum and fixture geometry

| Mount | Template origin | `contactMinY` | Intent origin |
| --- | --- | --- | --- |
| Ceiling | Canopy top centre on the overhead plane | Negative (drop length) | `overhead` at the pointer's X/Z, from any hit (floor, ceiling, region underside). The planner resolves Y through T1's overhead query (§4.3). The ghost previews the same query read-only, so editor and planner cannot disagree. |
| Wall | Back-plate centre on the wall plane, +Z out | Negative (lowest point below the datum) | `wall`. A near-vertical hit (\|normal.y\| ≤ 0.2) gives the position and `yaw` = heading of the normal. Anything else refuses `not-a-wall` in the editor. |

A saved group inserts with a `support` origin. A floor fixture, if one is qualified later, would
use the same origin.

- **Sloped overheads (V3).** D8 hangs fixtures plumb from the elevation that the overhead query
  returns at the canopy's X/Z. It claims nothing about a canopy sitting flush on a slope.
  - Today the query returns only flat lids and region undersides.
  - When V3 lands, it decides how a shed or gable underside is published through this query: as an
    elevation at X/Z, or as `unsupported`. D8 follows that decision with no change.
  - D8 adds no slope evaluator and reads no rendered face. If V3 publishes a non-vertical
    `downNormal`, the canopy still hangs plumb. Flush mounting on a slope is admissible later and
    belongs to whichever slice introduces a mount relation.

- **Pose.** Every fixture body is an upright model that is lifted below its overhead or beside its wall.
  Its base must sit at or above a support (§4.3 step 4), so a pendant longer than the room is tall
  refuses rather than passing through the floor.
- **Collisions.** Body-to-wall and body-to-ceiling intersections are not checked; no Scene
  operation checks collision (G1 §3.4).
- **No relation.** No wall or ceiling relation is stored. Like Artwork and lights, the fixture does
  not follow a later Layout edit.

### 6.2 Emitter alignment

- **Anchor.** The light member's frame-local pose is the anchor: the bulb or lamp-mouth centre. It
  is measured once by the loader-verification script from the named bulb or diffuser primitive and
  recorded with a 1 mm tolerance. It is never read from live bounds.
- **Beam axis.** A spot's beam axis is part of the same record. Tests compare forward vectors, never
  Euler components, as G1 does.
- **Defaults.**
  - Point for globes and lanterns; Spot (about 50°, soft edge 50%) for downward shades.
  - Colour from the Warmth ramp's *Warm* stop.
  - Range clipped to the fixture's design reach.
  - Shadow off.
  - Calibrated in the visual probe.
- **Rigid transforms.** Group Move, Turn and Duplicate keep alignment exactly, because they are the
  rigid image (G1 §3.3).

### 6.3 Aiming

**Without articulation, aiming means one of two things:**

- Turn the whole group, so the body and beam rotate together.
- Drill into the emitter and re-aim it with the Light Card and its Stage handles. The body does not
  follow.

**Directional heads.** This is honest only for bodies that imply no direction, which is why the
first set excludes visibly directional heads (P3). *Look through* works on a fixture's spot
unchanged.

**Shadows and glow.**

- Fixture assets declare `castShadow: false`, so a body never occludes its own emitter.
- A creator may switch the emitter's Shadow on. That is the ordinary, unchanged D9 control. The body
  still does not occlude it.
- A shade does not glow unless lit by its own emitter's illumination; there is no emitter-linked
  emission (P2).

## 7. Creator workflows

1. **Place a fixture.**
   - Open the Library's *Lights*. Beside *Point* and *Spot*, a *Fixtures* row appears only once at
     least one qualified fixture ships (D18).
   - Choosing a fixture arms placement. The ghost follows the mount rule in §6.1 and reads its
     refusal in words: "Nothing overhead to hang from here", "Point at a wall".
   - A click writes one `place-group-copy` and selects the new group, named after the fixture.
     Undo removes the body, light, cluster and any newly granted asset resource together.
2. **Adjust.**
   - A first click selects the group. Move, Turn, Duplicate (+0.5 m X/Z) and Erase act rigidly.
   - A second click selects the body or the emitter. The emitter shows the ordinary Light Card:
     Brightness, Colour, Beam or Reach, Shadow.
   - Ungroup leaves an ordinary model and an ordinary light.
3. **Compose a rig.**
   - Select several ungrouped subjects (lights, fixture bodies, forms, primitives) and choose
     *Group*, or start from Showcase.
   - Groups are flat and never merge, so combining two fixtures means ungrouping each and then
     grouping all four members. This is the landed G1 rule, unchanged.
4. **Save.**
   - A group's Card foot offers **Save to My Objects** when every member is eligible. Otherwise the
     action is present and refuses with the first reason: "Artwork stays in this project", "Imported
     models stay in this project", "Planes cannot be saved in a group", "<name> cannot be saved
     yet" (a catalogue model without admitted contact).
   - When any member has a project Finish, the save still proceeds, under the §4.2 Finish rule. The
     confirmation says "Finishes stay in this project; the copy uses each object's base material".
     This is the form precedent.
   - Save writes no revision, history entry or dirty flag.
5. **Insert anywhere.**
   - In any project, *My objects* lists saved groups beside forms. *Place copy in World* arms a
     floor-anchored placement with the same ghost.
   - A click writes one `place-group-copy` with a `support` origin and selects the new group.
   - An older-format item reads "Made with an earlier development version" and offers Remove only.
6. **Visitors** see the bodies and their light. Emitter glyphs, guides and the group are editor-only
   (G1 §2.6).

## 8. Detached-copy and cross-project closure semantics

- **Detached.** An inserted copy is ordinary Scene source.
  - No field, resource or lock names the library item or the curated fixture.
  - Editing the copy never reaches the item, and removing the item never breaks a copy.
  - Each insert mints new entity and cluster ids.
  - Member names are kept verbatim. The cluster name gets G1's `nextGroupName` suffix on collision.
- **Closure.**
  - A copy's only external dependencies are shipped, pinned catalogue models (granted by §4.1) and
    catalogue materials (already shipped).
  - Nothing is copied between projects, so groups need no transfer route or byte copy.
  - Private dependencies are never copied. Artwork and creator models make a member ineligible
    and refuse at Save. Project Finishes, with their images, are dropped under the §4.2 Finish rule
    and disclosed; they never cause a refusal.
- **Identity.** Members are identified only by order inside the payload, and carry no internal
  references. This is why T5.4's rule that "names and order do not supply the remapping" does not
  bind here.
- **Spot targets.** A spot's target is derived, so it re-derives against the new World. A rigid
  Turn still keeps the target the rigid image of the aim.

## 9. Refusals

| Code | Where | Words (creator-facing) |
| --- | --- | --- |
| `invalid-template` | planner, reader | "This group cannot be read." (issue paths in diagnostics) |
| `unsupported_format_version` | insertion | "Made with an earlier development version; remove it or save it again." |
| `ineligible-member` | Save | Names the member and its reason (§7), including a model without admitted contact |
| `group-too-large` | Save | "Groups of more than 64 items cannot be saved." |
| `no-support` | Save, planner | "Nothing below to stand on here." / names the member |
| `no-overhead-support` (and the overhead query's own codes) | planner | "Nothing overhead to hang from here." |
| `not-a-wall` | fixture placement (editor) | "Point at a wall." |
| `unknown_asset` / `missing-definition` / `missing-contact-metadata` | planner | "This object is not available in this version." |
| `incompatible-resource` | planner | "This project holds a different copy of <name>." |
| `asset-revision-mismatch` | Save, cold Load, only after D8a step 3 | Existing closure refusal envelope |
| `stale_revision`, library full, payload too large, not found | existing | Unchanged |

Any member failure refuses the whole write. Nothing is partly placed.

## 10. Slices

| Slice | Delivers | Depends on | Runs in parallel with |
| --- | --- | --- | --- |
| **D8a Shipped-asset closure** | §4.1 audit, identity invariant and pin ledger, grant; `place-object` grants admitted catalogue assets; the Objects panel lists admitted catalogue models in every project; the Save/Load check only after the audit clears | — | D8s, D8c acquisition |
| **D8s Specimen** | Amends the approved Light & Sky and Appearance targets: Fixtures row and tile, ceiling and wall ghosts and refusals, group placement ghost, fixture group Card, Save to My Objects on the group Card, My objects group tile, Place copy | — | D8a, D8b, D8c |
| **D8b Group template and `place-group-copy`** | §4.2 codec, `groupTemplateFromCluster`, §4.3 planner with `support`, `overhead` and `wall` origins, rigid composition about an origin | D8a (grant helper) | D8c, D8s |
| **D8p Group placement session** | The editor's one `group-copy-placement-session`: template ghost, origin derivation for all three origins, one gesture lease, the `place-group-copy` accept, selection of the new group. No Library entry point, so no inert control; it is exercised through the session harness | D8b · D8s ghost marks | D8c, D8e |
| **D8c Fixture qualification** | Acquisition evidence, visual probe report, derivation recipes, 3–4 ingested fixtures with pins, verification records, curated templates | D8a (pin shape); owner P1–P3 | D8b, D8e |
| **D8d Fixture placement** | Lights › Fixtures row (D18) arming D8p with a curated template | D8p, D8c, D8s | D8e, D8f |
| **D8e Library `group` kind** | §4.4 reader and dispatch, API acceptance, migration `002`, DB-backed tests | D8b (template codec) | D8c, D8d |
| **D8f Save and insert groups** | Group Card Save with eligibility and Finish disclosure; My objects group tiles arming D8p with a `support` origin; integrated acceptance | D8p, D8e, D8s | D8c, D8d |
| **Closeout** | Contract updates, plan retirement, roadmap rows | the later of D8d and D8f | — |

### D8a — Shipped-asset closure

- **Changes:**
  - step 1: the read-only audit script and its report on the PR (§4.1);
  - `shipped-static.ts`: the pin field, with pins for every existing production file, and the
    committed pin ledger;
  - `scene-planning/shipped-asset-resource.ts`;
  - the `place-object` grant for an admitted catalogue `creationDefaults.kind === 'model'`
    definition;
  - `visibleCatalogueModels` lists admitted definitions, those with recorded contact, regardless of
    held resources;
  - the s17 fixture uses the production helper;
  - step 3, only if the audit clears: Save and cold-Load revision verification.
- **Acceptance:**
  - In a blank project, placing the verified salon chair installs the entity, the asset resource
    and the `resource:asset` lock in one result.
  - Undo removes all three.
  - A second placement reuses the resource.
  - Save and reopen preserve it, and visitor Preview renders it.
  - Each grant-rule row in §4.1 has a test. A held record without a revision, or with a different
    one, refuses and is left byte-identical.
  - A pinned catalogue model without admitted contact is not listed and refuses
    `missing-contact-metadata`.
  - The ledger test fails on a changed or removed pin and passes on an append. The hash test covers
    every shipped GLB.
  - After step 3 only, a tampered `contentRevision` refuses at Save.
- **Lanes:**
  - project-model unit tests;
  - editor vitest groups, run one at a time;
  - `check:api` and zero-skip DB-backed `test:api` for the Save check;
  - `test:arch`.
- **Stop if** a format bump becomes necessary, or the audit finds development-database records that
  a check would refuse (owner decision; destructive data action).

### D8s — Specimen

- **Changes:** update the approved specimens in place: `prototypes/light-and-sky-ux/` (Fixtures row,
  mount ghosts, fixture group Card) and `prototypes/appearance-ux/` (My objects group tile, Place
  copy, Save on the group Card).
- **Decides:**
  - tile imagery: a pre-rendered fixture tile, derived reproducibly at ingestion and pinned in the
    fixture record, is recommended;
  - ghost marks within the Stage mark grammar;
  - refusal copy.
- **Acceptance:** the owner approves it (P6, a visual gate D8p, D8d and D8f wait on). No console
  errors on static serve, and the `test:arch` links pass.

### D8b — Group template and `place-group-copy`

- **Changes:**
  - `scene-planning/group-template.ts` (codec, canonical, `groupTemplateFromCluster`);
  - `intent-payload` reader for `place-group-copy`;
  - `planners/group-copy.ts`;
  - `rigid.ts` composition about an origin;
  - `SCENE_OPERATION_KINDS`;
  - a widened definition admission.
- **Contract:** §4.2 and §4.3.
- **Acceptance:**
  - Round trip: `groupTemplateFromCluster` → canonical bytes → read → `place-group-copy` at
    yaw 0 on the same floor reproduces every member pose within 1e-9 and the same cluster order.
  - At yaw θ, every spot forward vector and target point is the rigid image within 1e-6 (G1's
    property set, including straight down and the gimbal branch).
  - A support origin on a raised platform keeps heights above the floor.
  - An overhead origin under a closed-Space lid, under an overhead region inside that Space, and
    with no overhead resolves to the lid, to the region underside (the lowest above the floor) and to
    `no-overhead-support` respectively. A stale generation refuses. The pose never depends on a hit
    Y.
  - A model member with a pin but no admitted contact refuses `missing-contact-metadata`.
  - A lifted member over a void refuses and names the member, and nothing changes.
  - Ids already in the Scene refuse.
  - Artwork, plane, creator-model and non-upright members refuse at template read. A
    Finish-bearing source member yields a template with no `materialInstanceId`.
  - Asset grants are added once per distinct asset and reused when held.
  - One Undo restores the envelope byte-for-byte.
  - The record scope is exact.
- **Lanes:** project-model unit tests, `test:arch`, and budgets (new modules stay under 600 lines).

### D8p — Group placement session

- **Changes:** `group-copy-placement-session` in the scene adapter area. It takes a template, an origin
  mode (`support | overhead | wall`) and a name, then renders the ghost, derives the origin (§6.1),
  holds one gesture lease and writes one `place-group-copy`. It also adds the accept wiring and selects
  the new group.
- **Acceptance**, through the session harness:
  - Each origin mode writes exactly one intent with the expected origin.
  - Escape cancels with no write. A refusal shows its words and writes nothing.
  - The overhead ghost uses the planner's query result.
  - The new group is selected.
- **Status (2026-11-28): implemented.**
  `apps/editor/src/lib/authoring/adapters/scene/group-copy-placement-session.ts` is the one session;
  `group-copy-binding.ts` routes the Stage pointer, hover, Escape, ghost, mount line and Plan outline;
  the arm store (`armGroupCopy` / `peekArmedGroupCopy` / `clearArmedGroupCopy`) is the only seam D8d
  and D8f arm. Preview and acceptance call the same `prepareGroupCopyCandidate` with the same captured
  template, ids, contacts and origin, so the ghost's member poses are the installed poses. The harness
  `apps/editor/tests/lib/authoring/scene/group-copy-placement-session.test.ts` proves all three
  origins, preview/acceptance agreement, the approved refusal words with the complete refused ghost,
  stale-generation refusal, Escape, repeat placement with fresh identities, selection after acceptance
  and atomic Undo/Redo. No mount relation, group frame or template reference is stored.
- **Lanes:** editor vitest groups one at a time, `test:arch`.

### D8c — Fixture qualification

- **Step 1, probe before ingestion.** Acquire the shortlist locally (retention store, not git). Render
  each with its emitter on both backends in the Salon and Gallery reference Worlds. The probe
  answers:
  - glass and transmission in *Model's own*;
  - whether a lit-from-inside shade reads acceptably;
  - self-overexposure at the anchor distance, and the range clip;
  - the baked-emission comparison for P2.
  - **Output:** a short probe report on the PR with screenshots. Drop any candidate that fails.
- **Step 2, ingest and record.** Recipes, derivation, the production GLB, pins, licence records,
  manifest rows, verification records, `Asset`, `SHIPPED_MODELS` and `CuratedFixture` entries.
- **Acceptance:**
  - `classifyRights` returns A for each fixture.
  - Every source MD5 matches the files API.
  - Derivation reproduces byte-identically from the retained sources.
  - Budgets hold.
  - The template light pose equals the recorded anchor and axis.
  - The pin test passes.
  - The API publication validator knows each asset id.
  - The visitor cold runtime loads each by id.
- **Stop if** a candidate needs a new dependency, its rights fall below A, or its look depends on an
  unadmitted material family.

### D8d — Fixture placement

- **Changes:** `LIGHT_SHELF` gains a Fixtures group, shown only when `CURATED_FIXTURES` is non-empty.
  Choosing a fixture arms D8p with its template and mount origin.
- **Acceptance**, on the live Stage against the D8s target:
  - one qualified ceiling fixture and the qualified wall fixture are placed in the Salon World;
    a ceiling fixture also hangs under an overhead region;
  - the mounts tested are exactly those on the qualified shortlist. No asset is ingested to cover
    a mount, and the floor `support` origin is covered by D8f;
  - Undo, Duplicate, Turn and Ungroup work, and re-aiming the emitter leaves the body unmoved;
  - refusals read in words;
  - Save and reopen, then visitor Preview parity: the same bodies and light, with no glyphs and no
    group;
  - the Fixtures row is absent in a build with an empty fixture list.
- **Lanes:** editor vitest groups one at a time, browser QA per `apps/editor/tests/README.md`, and
  `test:arch` (visitor isolation).

### D8e — Library `group` kind

- **Changes:**
  - `library/group-library.ts` and kind dispatch;
  - the API save path accepts `group`;
  - `apps/api/migrations/002-library-group-items.sql`;
  - API types.
- **Acceptance**, DB-backed and zero-skip:
  - save, list, get and delete;
  - another owner's id answers as not found;
  - a canonical mismatch is refused;
  - the 256 KiB and 1,000-item limits hold;
  - an older `formatVersion` lists and removes;
  - the migration applies on a baseline database and is idempotent under the runner;
  - existing form and material rows are unaffected.
- **Lanes:** `check:api`, `test:api` with zero skips, and project-model unit tests.

### D8f — Save and insert groups

- **Changes:**
  - group Card Save to My Objects, with eligibility and Finish disclosure;
  - a My objects section for group items;
  - the client fetch and strict read;
  - My objects tiles arm D8p with a `support` origin.
- **Acceptance:**
  - Save Showcase in project A and insert it twice in project B: two independent groups with
    distinct ids.
  - Edit one copy; the other copy and the item are unchanged.
  - Delete the item; both copies survive Save and reopen.
  - A saved group containing the admitted salon chair grants its asset in B. Fixture bodies are
    covered too once D8c has landed, but this case does not wait for D8c.
  - A group with Artwork, a plane, a creator model or a model without admitted contact refuses at
    Save in words.
  - A Finish-bearing form or primitive saves with the disclosure and inserts on its catalogue
    `materialId`.
  - An older-format item is listed and offers Remove only.
  - Visitor Preview parity in B.
### Closeout

Lands after both D8d and D8f; it is a separate small PR, or folds into whichever of them is later.

- **Changes:**
  - contract updates in Scene and Resources (My Objects group item, `place-group-copy` and its
    origins, the shipped-asset identity invariant and grant);
  - delete this plan and the completed G1 plan;
  - update the T2 README D8 row and the plans index;
  - S8's deletion condition then waits only on integrated S8 acceptance.

## 11. Execution order

```text
now ─┬─ D8a closure ─▶ D8b template + planner ─▶ D8p placement session ─┬─ D8f save/insert ─┐
     │                        │                       ▲                 │   ▲               ├─ closeout
     │                        └─▶ D8e library kind ───┼─────────────────┼───┘               │
     ├─ D8s specimen (P6) ────────────────────────────┴─────────────────┼─ D8d fixtures ────┘
     │                                                                  │   ▲
     └─ D8c probe ─▶ D8c ingest ────────────────────────────────────────┴───┘
```

- **Independent from the start:** D8a, D8s and D8c step 1. The probe needs no repository change.
- **Shared foundation:** D8a → D8b → D8p. D8p is the only editor piece both tracks use, and it lands
  before either entry point.
- **Rig track:** D8e → D8f. It needs neither D8c nor D8d.
- **Fixture track:** D8c → D8d. It needs neither D8e nor D8f.
- **Closeout** waits for both tracks.

## 12. Decisions

### 12.1 Product decisions for the owner

| # | Decision | Owner outcome (2026-11-27) |
| --- | --- | --- |
| P1 | The first fixture set | **Accepted for qualification:** Hanging Industrial Lamp, Lantern Chandelier 01 and Industrial Wall Sconce. Modern Ceiling Lamp 01 joins only if the glass probe passes. Street Lamp 02 is not selected, so there is no floor fixture. No picture light: Picture spot remains the gallery answer. |
| P2 | Baked emission in fixture bodies | **Accepted: strip it.** A baked glow does not follow Brightness or Off, which would make Off untruthful. Emitter-linked glow waits for an authored relation and the Glow family. |
| P3 | Fixed directional heads (track cans, spots on stands) | **Accepted: defer** until articulation. Re-aiming the beam without the head would contradict the body. |
| P4 | Which groups may be saved | **Accepted: any eligible group**, with or without a light. |
| P5 | Library homes | **Accepted:** curated fixtures under **Lights › Fixtures**; saved groups under **My objects** only. |
| P6 | Specimen approval (D8s) | **Accepted (owner, 2026-11-28).** §9 is the visual target for D8p, D8d and D8f; D8p landed against it. |
| O1 | Duplicate offset for a wall fixture (D8s §8) | **Accepted: +0.5 m along the group's own X for every group.** Owning slice is group Duplicate (G1), not D8p: D8p stores no frame and this slice does not change landed G1. |
| O2 | Moving a wall fixture (D8s §8) | **Accepted as a D8 limitation.** G1 Move stays floor-plane and D8 stores no wall relation; D8d records it in its notes. |
| O3 | A saved fixture keeps its height (D8s §8) | **Accepted.** A saved group inserts with a `support` origin and keeps its height above the floor; D8p's support origin is that behaviour. |

### 12.2 Engineering decisions resolved here

| # | Decision |
| --- | --- |
| E1 | One `GroupTemplate` codec for curated fixtures, saved groups and the intent; Scene stores no template, link or provenance. |
| E2 | `place-group-copy` is a new Scene operation. `create-light-rig` and group Duplicate stay as they are; the new planner reuses `rigid.ts`, the entity builders and `resolveDestinationSupport`. |
| E3 | Origins are `support` (planner-resolved floor Y), `overhead` (planner-resolved through T1's `queryOverheadSupports`; no second ceiling authority) or `wall` (editor-derived, support-revalidated, the Artwork precedent). Mount is editor-side catalogue metadata, not payload. |
| E4 | A saved template's frame is world-axis-aligned. Its origin is the pivot X/Z (`rigidPivot`) at the support beneath the lowest point. |
| E5 | Members are bounded at 2–64 and identified by order. Ids are captured in the payload as in G1 duplicate. |
| E6 | The §4.2 Finish rule: project Finishes are always dropped with a disclosure and never refuse. Artwork, planes, creator models and models without admitted contact are refused. |
| E7 | No format bump. Shipped-model pins live in the code registry under the one-id-one-revision invariant, guarded by a committed ledger. Grants reuse only matching records and never rewrite. The Save/Load check waits for the audit. Closure is not tightened. |
| E8 | Library: one additive numbered migration, with no receipts, staging, transfer or thumbnail for groups. |
| E9 | Fixture assets are `castShadow: false` with a single emitter whose Shadow is off by default; the Shadow control stays live (D9). |
| E10 | The pivot is normalised to the mount datum at ingestion, so there is no `renderNormalization`. Production files live at `static/models/fixtures/`. |
| E11 | Anchors and contacts come from recorded loader verification, never live bounds. |
| E12 | Fixture bodies are admitted for `place-group-copy` only. Model eligibility anywhere in D8 means admitted definition plus recorded contact plus shipped pin. |
| E13 | Budgets: at most 15k triangles, at most 3 materials, at most 1 MiB, textures at most 1K. No new performance gate. |
| E14 | Wall and ceiling attachment is placement convenience with no stored relation (the Artwork precedent). |
| E15 | The `002` migration name and the `form_library_items` table name stay; renaming is churn. |
| E16 | One editor placement session (D8p) serves fixtures and saved groups; neither entry slice owns it. |
| E17 | D8 ships ceiling and wall mounts only; the acceptance gates follow the qualified shortlist, and no asset is ingested to satisfy a test. |

## 13. Risks and stop conditions

- **Visual risk.** A shade lit only from inside may read flat, or overexpose near the anchor.
  D8c's probe decides before any ingestion. If no candidate reads acceptably without emission, stop
  and return P2 to the owner.
- **Glass.** Whether transmission survives in *Model's own* on both backends is unproven. Glass
  candidates drop if the probe fails.
- **Light cost.** Each fixture adds one forward-shaded light with no cap (D9 refuses silent caps).
  The render-cost calibration's light curves are the reference, and no budget is promised.
- **Ceiling height.** Fixed-length pendants may be too long for low rooms. The support rule refuses
  a body that would cross the floor, but a body crossing the ceiling is not checked.
- **Overhead regions.** A pendant hangs from the lowest overhead above the pointer's floor, so a
  canopy region in the room takes precedence over the lid above it. This is T1's ordering, used
  unchanged. A creator who wants the lid moves the pointer or the region.
- **Stop** if:
  - any slice needs a Scene or resources format change, a new resource kind, a stored relation
    between body and emitter, nested groups, a selection model beyond G1's, or a ceiling or slope
    resolution outside T1's overhead query;
  - a dependency is needed beyond the admitted `@gltf-transform` toolchain;
  - a candidate's rights are below A.
