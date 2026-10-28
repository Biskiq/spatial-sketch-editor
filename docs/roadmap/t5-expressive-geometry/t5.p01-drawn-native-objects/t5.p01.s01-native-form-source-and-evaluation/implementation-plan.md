# T5.P01.S01 — Native form source and evaluation: implementation plan

**Slice:** T5.P01.S01 · **Status:** approved by the owner's merge of the T5 planning PR
([record](../../../../reference/decisions/t5-object-focus-planning-2026-10-27.md)); released on the
[release list](../../../now.md) · **Phase:** [T5.P01](../README.md) ·
[slice register](../README.md#slice-register) · **Track:** [T5](../../README.md) · **Direction:**
[umbrella plan](../../umbrella-plan.md) · **Runbook:**
[T5 operations](../../../../operations/t5-expressive-geometry/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t5.p01.s03-integrated-final-gate/acceptance.md
```

## 1. Outcome

A native form exists in the product as Scene truth. A Scene unit at format 4 can hold `form`
entities; strict codecs read and write them; a new runtime-safe package,
`@portfolio/geometry-core`, evaluates each form deterministically into a closed mesh with regions,
bounds, footprint and contact; two new Scene planners create a form and size it per axis; the
existing move, turn, place-on-floor, duplicate and delete operations work on forms; and Stage and Plan
draw and select them through the shared paths; isolated Preview draws the same accepted forms
without editor selection or writers. Undo, Redo, Save and cold reopen are exact.

Creators gain no new entry point in this slice. Forms reach the editor through opened documents,
fixtures and tests; the drawing entry point is S02.

## 2. Start conditions

Start through the [T5 runbook](../../../../operations/t5-expressive-geometry/README.md) start step,
and only when all of these hold at this slice's own trusted base:

1. The owner has added this slice's row to the [release list](../../../now.md).
2. No other T2 writer holds the Scene unit types, codec, validation and planner files listed in §3.
   (`T2.P02.S03`, which this slice waited for, merged with PR #199, and T2.P02 closed on 2026-10-27.)
3. Every consumed gate is `accepted` and every required scope is `active`.

## 3. Scope

**In scope**

- A new workspace package `packages/geometry-core` (`@portfolio/geometry-core`), decision D3.
- Scene unit format 3 → 4 adding the `form` entity: types, codec, canonical form, validation,
  fixtures and seeds (decision D4).
- Scene planners `create-form` and `set-form-size`; form support in the existing operations;
  dotted-path grants in Scene record scope.
- The shared Scene renderer's form branch, Plan footprint and hits, selection, Index/Head Find subject discovery, semantic selection, and the Card's form facts and supported
  Move, Turn, Place on floor, per-axis Size, Duplicate and Delete controls.
- A typed refusal of forms in the cold release check (publication remains T4's).
- API fixtures and tests that carry Scene units.
- The landed reference updates this format change requires.

**Out of scope:** any Ink, stroke or Shape reading; per-axis size handles (S02);
Object Focus, sections and outline revision; operations stacks; materials beyond the existing
material choice; publication of forms; any F4/Save protocol, Camera or PLATE contract change. The owner-approved Option B expansion
includes the Stage-host and Head Find wiring required for production form selection.

**Files T5 writes:** `packages/geometry-core/**`; the native-form parts of
`packages/project-model/src/scene.ts`, `scene-codec/**`, `scene-validation.ts`, `units/**` and
`scene-planning/**`; `apps/editor/src/lib/museum/entities/` (new form entity component);
`apps/editor/src/lib/visitor/VisitorEntities.svelte` (form branch only);
`apps/editor/src/lib/visitor/visitor-cold-runtime.ts` (form refusal only);
`apps/editor/src/lib/authoring/scene/plan-scene-footprint.ts`; the Scene adapter's resize gating
and Card fields/actions; the Stage facade and spatial host locator, hit and selection wiring; root and package manifests and scripts; `apps/editor/test-lanes.ts`; tests and
fixtures; `apps/api/tests/**` fixtures; the reference documents in §8.

## 4. Design

### 4.1 Package `@portfolio/geometry-core`

- Mirror `@portfolio/layout-core`'s manifest, `tsconfig` and `check` script; add the root script
  `check:geometry-core`.
- Runtime dependencies: `robust-predicates` (already in the tree, Unlicense, `^3.0.3`) and `earcut`
  (already resident at 2.2.4, ISC, as a transitive dependency; declare `^2.2.4`). Record both
  versions and licences in the acceptance record. No other dependency.
- It imports no `three`, no DOM or browser global, no Svelte, and no `@portfolio/*` package. It
  carries no Scene, Layout or Camera meaning: its inputs are plain numbers and arrays.
- Public API (names are binding; internals are the implementer's):

```ts
export const GEOMETRY_CORE_EVALUATOR_VERSION = 1;

export type ProfileAnchor = { readonly key: number; readonly u: number; readonly v: number; readonly smooth: boolean };
export type ProfileIssueCode =
  | 'too-few-anchors' | 'too-many-anchors' | 'non-finite' | 'out-of-range'
  | 'duplicate-key' | 'edge-too-short' | 'collinear' | 'self-intersecting' | 'clockwise';
export type ProfileIssue = { readonly code: ProfileIssueCode; readonly anchorKeys: readonly number[] };

export function validateProfile(anchors: readonly ProfileAnchor[]): readonly ProfileIssue[];
export function canonicalizeWinding(anchors: readonly ProfileAnchor[]): readonly ProfileAnchor[];
export function evaluateProfile(anchors: readonly ProfileAnchor[]): EvaluatedProfile;
export function extrudeProfile(input: {
  readonly profile: EvaluatedProfile; readonly extent: number;
  readonly scale: readonly [number, number, number]; readonly plane: 'plan' | 'elevation';
}): FormMesh;
export function formMeshDigest(mesh: FormMesh): string; // stable text digest of positions + indices + regions
```

`EvaluatedProfile` holds the ordered profile points (`Float64Array`), each point's owning edge key,
the base-cap triangulation (`Uint32Array`) and the profile's bounds. `FormMesh` holds `positions`
(`Float64Array`, local metres), `indices` (`Uint32Array`), a per-triangle region array
(`0` base cap, `1` top cap, `2 + edge index` for sides, with the edge index mapped to its key),
bounds, an XZ footprint ring and `contactMinY`.

### 4.2 Profile rules

- **Counts and ranges.** 3–256 anchors; keys are positive safe integers and unique; `u` and `v`
  within ±50 m.
- **Edges.** Every control edge, including the closing edge, is at least 1 mm long.
- **Collinearity.** No anchor may be exactly collinear with its two neighbours (`orient2d === 0`).
- **Smooth anchors.** A smooth anchor `P` with neighbours `A` and `B` is replaced by a quadratic
  Bézier from `Ma = (A + P) / 2` through control `P` to `Mb = (P + B) / 2`. Its segment count is
  `n = 2 · ceil(m / 2)` with `m = ceil(sqrt(|Ma − 2P + Mb| / (4 · 0.001)))`, clamped to `[2, 16]`,
  so the chordal error is about 1 mm or less and `t = 0.5` is always a sample. Samples use
  `t = k / n` and `B(t) = (1 − t)²·Ma + 2t(1 − t)·P + t²·Mb`, evaluated in that order.
- **Straight anchors** are profile points as they are. The profile between consecutive anchors
  belongs to the edge keyed by the first anchor. A smooth anchor's curve splits at `t = 0.5`.
- **Simplicity** is decided on the evaluated profile with exact `orient2d`: no two non-adjacent
  segments may intersect or touch, and adjacent segments may meet only at their shared point.
  Use a deterministic sweep or a bounded uniform-grid broad phase; the worst case is 4,096 points.
- **Winding.** Canonical winding is counter-clockwise in `(u, v)` (positive exact signed area).
  `validateProfile` reports `clockwise`; `canonicalizeWinding` reverses ring order and keeps keys.
- **Triangulation.** `earcut` over the evaluated profile's `(u, v)` points. Accept the result only
  if it has `points − 2` triangles and every triangle has positive exact `orient2d`; otherwise the
  profile refuses as `self-intersecting`. Earcut performs only basic arithmetic, comparisons and
  integer bit operations, so it is deterministic under §4.4.

### 4.3 Extrusion and result

- **Planes.** For `plan`, profile `(u, v)` maps to local `(x, z) = (u, v)` and the body occupies
  `y ∈ [0, extent]`. For `elevation`, `(u, v)` maps to local `(x, y) = (u, v)` and the body occupies
  `z ∈ [0, extent]`.
- **Scale.** Positions are multiplied per axis by `scale` after extrusion, about the local origin.
  Scale factors lie in `[0.01, 100]`, and every scaled dimension in `[0.001, 100]` m.
- **Mesh.** Base and top caps reuse the profile triangulation with opposite orientation. Sides are
  one quad per profile segment, split on a fixed diagonal. Side vertices are duplicated at straight
  anchors and shared along a smooth anchor's samples, so ordinary vertex normals crease at corners
  and stay smooth along curves. Every triangle faces outward; the signed volume is positive.
- **Result.** Bounds; the XZ footprint ring (the scaled profile for `plan`; the rectangle
  `[minX, maxX] × [0, extent·sz]` for `elevation`); and `contactMinY` (`0` for `plan`; the minimum
  scaled profile `v` for `elevation`).
- **Derivatives.** Normals and UVs are render derivatives computed in the editor (§4.7), not in the
  canonical result.

### 4.4 Determinism

- Canonical modules use only `+ − × ÷`, `Math.sqrt`, comparisons, `Math.abs/min/max/floor/ceil/
  round/sign`, integer bit operations, and the two admitted libraries. `Math.sin/cos/tan/asin/acos/
  atan/atan2/exp/log/pow/hypot/cbrt/expm1/log1p/sinh/cosh/tanh`, `**` and `Math.random` are forbidden.
- Iteration order is fixed by array order; no object-key or `Set` iteration feeds arithmetic.
- An architecture-lane test scans `packages/geometry-core/src/**` for forbidden tokens and imports.
- Numerical profile evaluation may memoize up to 32 exact structural inputs; signed zero is
  distinguished, invalid inputs never reuse a valid entry, and every caller receives independent
  buffers and bounds. This is generated numerical state, not a second form-mesh cache or source.
- Golden digests (`formMeshDigest`) for the corpus in §6 are pinned per evaluator version. Changing
  canonical output for an accepted source requires a Scene format bump and new goldens.

### 4.5 Scene unit format 4

Add to `packages/project-model/src/scene.ts`:

```ts
export type SceneFormSource = {
  generator: {
    kind: 'extrude';
    plane: 'plan' | 'elevation';
    outline: Array<{ key: number; u: number; v: number; smooth: boolean }>;
    extent: number;
  };
  scale: Vec3;
  nextKey: number;
};

export type SceneFormEntity = SceneRenderableEntityBase & {
  kind: 'form';
  form: SceneFormSource;
  materialId: MaterialId;
  castShadow: boolean;
  receiveShadow: boolean;
};

export type SceneEntity = SceneModelEntity | ScenePrimitiveEntity | SceneFormEntity | SceneLightEntity;
```

- `SCENE_UNIT_FORMAT_VERSION` becomes `4`. Readers refuse every other number; there is no
  migration, under the [pre-baseline rule](../../../../reference/north-star.md#development-stage-schema-compatibility-pre-baseline).
- The codec reads a form with `assertAllowedKeys`, refuses `roomId` and the entity-level `scale`
  key, parses the transform as other entities do, checks `isKnownMaterialId`, and calls
  `validateProfile`; any profile issue refuses the unit with its code and anchor keys. It also
  refuses `extent` outside `[0.001, 100]`, out-of-range scale, `nextKey` that is not a safe integer
  greater than every outline key, and unknown generator kinds or planes.
- `canonical.ts` writes a fixed key order: the shared entity fields in the primitive entity's
  order, then `form, materialId, castShadow, receiveShadow`; form `generator, scale, nextKey`;
  generator `kind, plane, outline, extent`; anchor `key, u, v, smooth`.
- Regenerate every fixture and seed that carries Scene format 3, in the editor, packages and API
  tests. No derived value is ever written.

### 4.6 Planners and operations

- **Record scope.** A grant may name a nested field by dotted path (`form.scale`). The parent
  object's other fields still compare exactly. Existing grant forms keep their meaning.
- **`create-form`** (new kind; `SCENE_PLANNER_ADMISSION`, no resources). The payload carries
  `plane`, the outline as `(u, v, smooth)` points in drawing order, `extent`, the World `position`
  of the base origin, `yaw`, `materialId`, `name`, and the captured support evidence that
  `place-on-floor` uses. The planner validates, canonicalizes winding, assigns keys `1…n` in ring
  order and `nextKey = n + 1`. It recentres the outline so the evaluated bounds' `u` centre (and the
  `v` centre for `plan`) is at the origin and, for `elevation`, the minimum evaluated `v` is `0`,
  moving `position` by the same offset in World. It resolves floor support exactly as
  `place-on-floor` does and writes one new entity with `scale [1, 1, 1]` and rotation `[0, yaw, 0]`.
  Refusals use the existing codes plus `invalid-value` carrying the profile issue code in its
  message and fields.
- **`set-form-size`** (new kind). The payload carries the entity id and a full per-axis scale.
  It refuses a non-form target, out-of-range values and a no-op; it rests the result on its support
  as `resize-on-floor` does, using the form's contact, and grants `form.scale` and `position[1]`
  only.
- **Existing operations.** `floorTransformSupport` admits upright forms. Contact for a form is
  computed from its source through geometry-core; a captured contact that disagrees refuses
  `missing-contact-metadata`, as for primitives. `resize-on-floor` refuses forms with
  `unsupported-transform` and the message that forms are sized per axis. `duplicate-one` copies the
  form source verbatim. `move-horizontal`, `set-yaw`, `place-on-floor` and `delete-one` need no
  form-specific behaviour beyond contact and footprint.
- **Footprint.** A placement check that needs a simple footprint uses the form result's XZ ring.
- `SCENE_OPERATION_KINDS` gains both kinds, and `createScenePlanners` registers them, one planner
  per kind. Payload readers follow `intent-payload.ts`'s strict pattern.

### 4.7 Editor rendering, Plan and selection

- **Evaluation service.** One editor-side cache maps a form's source identity (stable canonical
  JSON of `form` plus `GEOMETRY_CORE_EVALUATOR_VERSION`) to its `FormMesh`, with a bounded LRU of 256
  entries. Stage, Plan and Preview read it; nothing else evaluates forms.
- **Renderer.** A new `EntityForm.svelte` beside `EntityPrimitive.svelte` builds one
  `BufferGeometry` from the cached mesh. Positions convert to `Float32Array`; normals come from
  `computeVertexNormals`; UVs are metre-scale (caps use `(x, z)` or `(x, y)`, sides use cumulative
  profile length and height), so `SceneInstanceMaterial` with `surfaceSize` tiles at real scale.
  Geometry is disposed when the source changes or the entity unmounts.
- `VisitorEntities.svelte` dispatches `kind: 'form'` to `EntityForm.svelte` through a dynamic
  import, so documents without forms load no form code. Stage and Preview therefore draw the same
  result.
- **Plan.** `PlanSceneFootprint` gains `kind: 'form'`, with points from the form's footprint ring
  under its transform. Upright forms retain their concave ring; admitted tilted forms project
  the canonical triangle union with the full XYZ transform. Plan hits reuse the footprint path
  with rendered visibility, including the six-CSS-pixel edge halo. The Stage renderer supplies
  mounted Scene and Layout meshes as geometry data; the existing adapter hit provider remains
  the selection policy. Models, scalar scale, floors and Walls participate in nearest visible
  body resolution. Cold opens with at least 32 forms yield between strict validation and runtime
  preparation; accepted installs retain their known-identity path and existing epoch checks. Nothing in the render geometry source selects or writes authored source.
- **Owner-approved Option B.** Production Plan footprint hit testing and 3D Scene picking run through
  the existing Stage `hitProvider` seam and its one semantic selection authority. Scene hits carry
  F.1 references without fabricated Layout representation. Adapter-owned subject rows feed Index
  and Head Find; both select through the same `setSelection`. Selection identity requalifies
  through existing F4 installs/history. Preview draws the same source in its isolated visitor run;
  it offers no editor selection, Card, history or authoring controls, and returning restores Stage
  selection. Visitor isolation is unchanged.
- **Selection and Card.** Forms select through the existing Scene pick paths in Plan and 3D. The
  Card shows the form's name, material and Width, Depth and Height from the scaled bounds, with
  per-axis Size through the existing `set-form-size` planner.
  The Card also offers Move, Turn, Place on floor, Duplicate and confirmed Delete. The uniform resize affordance is not offered for forms, following `floorTransformSupport`'s
  pattern. Move, Turn, Place on floor, Duplicate and Delete work as for other objects.

### 4.8 Visitor and publication boundary

Publication is unavailable today (`prepared-reader-required`). `validateColdReleaseReferences`
reports a form entity as an issue ("native forms are not admitted for publication"), so a future
release cannot carry forms by omission; T4 owns any admission. The visitor isolation suites must
stay green: geometry-core is runtime-safe, and no editor module reaches visitor chunks.

### 4.9 API

`apps/api` validates units through `@portfolio/project-model`, so format 4 reaches Save and load
without API source changes. Regenerate `apps/api/tests` fixtures that carry Scene units. Any
API source change beyond fixtures is a stop-and-report to T2.

### 4.10 Limits

| Limit | Value |
| --- | --- |
| Anchors per outline | 3–256 |
| Profile points after smoothing | ≤ 4,096 |
| Minimum control edge | 1 mm |
| Coordinates | ±50 m |
| Extent | 1 mm–100 m |
| Scale factor per axis | 0.01–100, scaled dimension 1 mm–100 m |
| Smooth-anchor segments | 2–16, even |

## 5. Commit sequence

Each commit leaves the affected contracts green.

1. `geometry-core`: package, profile rules, smoothing, triangulation, extrusion, digest; unit tests,
   corpus and goldens; boundary and determinism-scan test added to the architecture lane.
2. Scene format 4: types, codec, canonical writer, validation; regenerated fixtures and seeds;
   strict-refusal tests.
3. Planners: record-scope dotted grants, `create-form`, `set-form-size`, form support in existing
   operations; planner and record-scope tests.
4. Editor: evaluation cache, `EntityForm.svelte`, renderer dispatch, Plan footprint, selection,
   Card facts, resize gating, cold-release refusal; editor tests.
5. API fixtures; `check:api` and DB-backed `test:api`.
6. Reference updates (§8), performance evidence and the acceptance record.

## 6. Tests

- **Corpus** (`apps/editor/tests/lib/geometry-core/`): at least 40 valid sources (convex, concave,
  L, U and comb shapes, all-smooth, mixed, minimum-edge, 256-anchor, near-limit coordinates and
  extents, both planes, non-uniform scales) and at least 25 invalid ones, one for each issue code and
  for touching, overlapping and collinear-run cases. For every valid source: the mesh is closed
  (every edge used by exactly two triangles in opposite directions), Euler characteristic `2`,
  positive signed volume, every region present, footprint and contact consistent with the mesh, and
  the golden digest unchanged.
- **Determinism:** the source scan; repeated evaluation equality; goldens.
- **Codec:** canonical round trip; strict refusal of format 3 and of each malformed-form case;
  key-order canonicalization.
- **Planners:** creation, recentring and keying; every refusal path produces no candidate;
  `set-form-size` scope rejects an outline change; contact and support on both planes; existing
  operations on forms; `resize-on-floor` refusal.
- **Acceptance integration:** one history entry per accepted form edit; Undo and Redo restore exact
  source; refused and no-op edits add no history; Save then cold reopen gives identical digests.
- **Editor:** form footprint projection; renderer adapter (positions, UV scale, disposal); cache
  identity and bound; cold-release refusal; visitor isolation unchanged.
- **Agent E2E:** open a fixture project containing forms on both planes; select in Plan and 3D;
  move, turn, duplicate, delete; Undo, Save, reload; Preview shows the same objects.

## 7. Acceptance criteria

1. Every valid corpus source evaluates to a closed, outward-oriented 2-manifold; every invalid one
   refuses with its typed code and no partial source.
2. Goldens are pinned; the determinism scan passes; geometry-core imports only its two libraries.
3. Scene unit format 4 reads and writes forms canonically; format 3 and malformed forms refuse.
4. `create-form` and `set-form-size` produce one accepted result each; existing operations work on
   forms; record scope holds.
5. Undo, Redo, Save and cold reopen are exact for forms.
6. Stage, Plan and Preview draw and select the same form result according to each surface's
   interaction contract: Plan and 3D Stage genuinely select forms and expose supported Card
   operations; Index and Head Find reach the same canonical subjects. Preview draws the same
   accepted forms as an isolated visitor run, exposes no editor selection/writers, and return
   preserves the Stage selection. Form selection is not deferred.
7. Visitor isolation and package-direction tests pass; the cold-release check refuses forms.
8. Performance rows in §9 are recorded.
9. The complete merge-gate contract passes, per [tests/README](../../../../../apps/editor/tests/README.md):
   fast and heavy suites, the full editor suite, the whole architecture lane, root `check` and
   `build`, `check:project-model`, `check:layout-core`, `check:geometry-core`, `check:api`, and a
   DB-backed `test:api` with zero skips.
10. The reference updates in §8 land in the same PR.

## 8. Reference updates in this slice

These describe the behavior this slice lands, so they move with it:

- [Scene content](../../../../reference/components/scene-content.md): the `form` entity, its source,
  limits, operations and render path.
- [Persistence](../../../../reference/components/persistence.md): Scene unit format 4.
- The package-direction statement in the [architecture](../../../../reference/architecture.md) that
  lists workspace packages, if it enumerates them.

## 9. Performance evidence

Measured with the [performance contract](../../../../reference/components/performance.md#budgets)
workflow on the designated reference machine, with Laptop A reported:

- evaluation of a 32-anchor and a 256-anchor all-smooth form, and of `set-form-size`, against the
  per-edit evaluation row (≤ 4 ms S, ≤ 8 ms M);
- `create-form` and `set-form-size` commit, and their Undo/Redo, ≤ 100 ms;
- cold open of the M fixture with 60 forms of up to 128 anchors: no main-thread task over 50 ms
  attributable to form evaluation;
- Stage and visitor first-load JS deltas, within ≤ 25 KiB br growth for the Stage and its
  ≤ 425 KiB br hard row, subject only to the explicit owner Stage exception in the acceptance
  record. The form renderer and Card fields load lazily; registered Scene planners require the
  kernel at first load. No other gate is waived.

## 10. Reviews

- **T2** reviews the Scene types, codec, validation, record scope, planners, fixtures and Scene
  adapter changes (D2).
- **T4** reviews the cold-release refusal.
- **T3** reviews the bounded Head Find subject integration and existing F4 usage; no Save or F4
  protocol changes are authorized.
- **T1** reviews the Stage host, hit/semantic selection and Index/Head Find changes required by
  the owner-approved Option B expansion, including the existing shadow-host diff.
- An independent code review before merge, as for every implementation PR.

## 11. Stop conditions

Stop and report rather than widening scope if:

- a concurrent T2 change edits the same Scene files;
- an F4/Save protocol, Camera or PLATE contract change appears necessary beyond the approved
  Stage/Head selection expansion;
- a dependency beyond `robust-predicates` and `earcut` appears necessary;
- the triangulation or simplicity strategy cannot meet the 256-anchor commit row;
- a hard performance row misses;
- an API source change beyond fixtures appears necessary.

## 12. Handoff

S02 consumes `validateProfile` and `evaluateProfile` for the live Shape reading, `create-form` and
`set-form-size` as its intents, and the form footprint and contact for its previews. S03 consumes
the corpus, goldens and fixtures and runs the cross-engine golden check.
