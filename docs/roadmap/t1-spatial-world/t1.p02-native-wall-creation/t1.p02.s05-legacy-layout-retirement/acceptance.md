# T1.P02.S05 — acceptance record: Legacy Layout retirement

**Slice:** T1.P02.S05 · **Status:** implementation complete, merge gate green, **not accepted, not
merged** — awaiting owner acceptance (named T3/T2 reviews recorded below) · **Plan:**
[implementation-plan.md](./implementation-plan.md) · **Phase:** [T1.P02](../README.md#slice-register)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
TIER:     architecture-integration; integrated exhaustive proof stays T1.P02.S04
ROUTE:    ../t1.p02.s04-integrated-final-gate/acceptance.md
AUTHORITY: NONE YET — the phase README owns slice status. Nothing here accepts the slice,
          discharges the retirement condition or unblocks S02.
```

S02 stays blocked until this scope is owner-accepted and merged. S01's unrun F2 S/M timings stay
assigned to S04; this record grants no waiver, no performance claim and no phase closure.

## Delivered

The Room-owned legacy Layout document surface is gone; the format-6 wall-first reader, identities,
one canonical compiler and compiled behaviour are unchanged.

```text
deleted modules    packages/layout-core/src/layout-types.ts
                   packages/layout-core/src/layout-codec.ts
                   packages/layout-core/src/layout-room-frame.ts
                   packages/layout-core/src/layout-portals.ts (legacy half)
deleted exports    LayoutIssue, LayoutValidationResult, LayoutDocumentValidationResult
                   compileLayoutGeometry, legacyCompilerSource
                   deriveLayoutRoomFrame, layoutRoomPoint, layoutRoomLocalPoint,
                   normalizeLayoutRoomYaw (moved to Scene, see below)
                   validateLayoutRoomGeometry, validateLayoutDocumentGeometry, validateLineRoom
                   createEmptyLayoutDocument, parseLayoutDocumentJson, serializeLayoutDocument,
                   validateLayoutDocument, projectLayoutPortalRelations, portalOpeningHasRoomPair
new owned modules  layout-coordinates.ts  LayoutVec2 (neutral plan tuple)
                   layout-path.ts         DraftPath / DraftSegment / LayoutInteriorAnchor
                   layout-issue.ts        LayoutDocumentIssue / LayoutDocumentValidationError
                   layout-wall-portals.ts the live wall-first portal relations only
retyped compiler   CompilerSource / CompilerFloorEntry / CompilerFloorSource /
                   CompilerRoomSource (+ CompilerRoomShell) / CompilerBoundarySource /
                   CompilerOpening are owned by layout-geometry-types.ts;
                   validatePreparedLayoutRoomGeometry takes CompilerRoomValidationSource.
                   CompilerSource.wallIdScope was removed in review: room-scoped segment ids
                   were legacy-only, and no producer or test set `'room'`. Output is unchanged
                   (document scope was always the effective value).
cross-track        packages/project-model/src/scene-planning/frame.ts — normalizeFrameYaw
exceptions         packages/project-model/src/project-layout-semantics.ts —
                   LayoutRoomRegistryEntry keeps {id, name, position, rotation}
docs               docs/reference/architecture.md, docs/reference/components/persistence.md,
                   docs/reference/north-star.md (current-encoding number), diagrams/architecture.md,
                   diagrams/overall-flow.md, docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/README.md
                   (EVIDENCE-PATHS history), docs/operations/t1-spatial-world/current.md (baton)
```

`compileWallFirstLayoutGeometry` → `compileLayoutGeometrySource` is the single compiler dataflow;
no second reader, migration, alias, forwarding shim or legacy compatibility path remains. New
dependencies: **none**.

## Gate evidence

```text
revision tested    implementation commit 4b385b33 on t1/p02-s05-legacy-layout-retirement,
                   trusted base main fff7dc14; PR #183 (open, not merged)
npm run check                  0 errors, 0 warnings (svelte-check)
npm run check:layout-core      clean (tsc --noEmit)
npm run check:project-model    clean (tsc --noEmit)
npm run check:camera-core      clean (tsc --noEmit)
npm run check:api              clean (tsc --noEmit)
npm run build                  adapter-vercel build produced (.svelte-kit/output)
apps/editor npm run test:fast  152 files / 2082 tests, 0 failed
apps/editor npm run test:heavy 9 files / 125 tests, 0 failed
apps/editor npm run test:arch  22 files / 178 tests, 0 failed
apps/editor npm run test:full  183 files / 2385 tests, 0 failed (same effective suite as npm test)
npm run test:api:stack (BISKIQ_STACK=biskiq-t1, BISKIQ_DB_PORT=5436)
                               12 reports / 95 tests, 95 pass, 0 fail, 0 skipped, 0 todo
```

DB target for the API run: the isolated local Compose database of stack `biskiq-t1` on
`127.0.0.1:5436` (`postgresql://biskiq@localhost:5436/biskiq`); no credentials are recorded here and
the shared stack was never reset. The full local stack was also brought up once for this slice with
`BISKIQ_STACK=biskiq-t1 BISKIQ_DB_PORT=5436 BISKIQ_API_PORT=8790 npm run stack:up`: db healthy,
migrate exited 0, api healthy, `GET /health/ready` 200, then torn down. That run needed one local
environment fix, not a code change — this worktree's `.env` lacked `R2_OBJECT_NAMESPACE`
(`apps/api/src/config.ts:135`), which the owner authorized as `R2_OBJECT_NAMESPACE=local`. The file
is gitignored and no value is recorded here.

**Fast-lane timing control.** An earlier `test:fast` run failed with
`p23b11-correspondence-reference.test.ts › nonce locality … Test timed out in 5000ms` while the
machine carried load average 63–73 from the two sibling lanes. The same lane was then run on the
untouched trusted base (changes stashed, then restored byte-identically) and failed the same way,
with that case at 4001 ms against the 5000 ms default. The final fast, heavy, arch and full runs
above are all green.

## Fixture coverage mapping (retired assertion → wall-first successor)

Pre-removal observations: [observations/legacy-compiled-observations.json](./observations/legacy-compiled-observations.json),
captured at `fff7dc14` by running the retired `compileLayoutGeometry` over the legacy documents
(the capturing file was scratch and is deleted). It records, per case, floor ids, per-Room
elevation/ceiling/thickness, floor polygon, walls, openings, objects, query counts and bounds; the
`howCaptured` / `caseAliases` / `retiredCases` fields state how it was produced, that the g2 fixtures
delegate to the g1 factories, and which cases are deliberately not converted.

```text
g1-line-rectangle        rectangle topology, four Walls, room + wall query records   → layout-g1-fixtures.ts
g1-l-shaped              L-shape closure, six Walls, wall-line render order          → layout-g1-fixtures.ts
g1-auto-bezier           curved boundary/Wall sampling and knot spans                → layout-g1-fixtures.ts
g1-multiple-openings     multiple Wall-hosted openings, offsets, host rebase         → layout-g1-fixtures.ts
g1-profile-matrix        rectangular/rounded/pointed arch profiles                   → layout-g1-fixtures.ts
g1-elevated-floor        non-zero floor datum → floor/ceiling elevations             → layout-g1-fixtures.ts
g1-object-matrix         object kinds, footprints, rotation-aware bounds             → layout-g1-fixtures.ts
g1-invalid-geometry      disconnected chain + bow-tie self-intersection defects      → layout-g1-fixtures.ts
mesh-rhombus / mesh-notch  watertight mesh matrices (heavy lane)                      → tests/helpers/wall-mesh-fixtures.ts
scales small/medium/large  determinism, seed divergence, pinned mix, compile at scale → __fixtures__/layout-scale-fixtures.ts
qualifies same-named wall query records by room (retired) → "emits each wall-first Wall once with no
                        per-Room wall duplication" (layout-geometry.test.ts), plus the restored
                        per-span id uniqueness assertion in the same case
room-derived wall detail → "Rooms carry no wall detail: the walls layer never comes from a Room"
                        (layout-g2-fixtures.test.ts), now an ordered layer-3 assertion
legacy multi-floor cases → retired, not converted: format 6 has one floor datum; the empty document
                        is asserted directly (validate + compile) in layout-geometry-boundary.test.ts
```

Each converted case keeps the same defect it detected (topology closure, orientation, opening host
and offset, profile, elevation datum, object footprint, disconnected/self-intersecting boundary,
mesh watertightness, determinism, seed divergence). No assertion was narrowed to match output: the
fixtures author Junctions, Walls, Rooms and Openings, and every expectation is explained by
topology-derived Rooms. No `skip`, `only`, `todo`, snapshot or tolerance was added.

## Intentional semantic deltas

```text
1 rooms of an uncompilable Room  A Room that fails to compile contributes no fill/stroke, but its
                                 authored Walls are independent canonical geometry and still
                                 commit to layer 3. Recorded inline in
                                 layout-g2-fixtures.test.ts ("T1.P02.S05 delta").
2 ceiling from Walls             Room ceilings come from boundary Wall heights; the retired Floor
                                 storey scalar is gone, so floor-derived ceilings exist only when
                                 a direct caller supplies one.
3 multi-floor documents          No wall-first expression; the cases are retired with the
                                 observation artifact as the delta evidence.
4 curved Wall length         A canonical physical Wall reports `length` as the arc length of its
                             samples (`samples.at(-1).distance`); the retired room-derived wall
                             record reported the chord sum. g1-auto-bezier `room-rectangle:wall:0`:
                             6.363454 (observation) → 6.363855; the 33 sample points are identical
                             (their chord sum is still 6.363454). Same sampling, different metric.
5 invalid-geometry bounds    g1-invalid-geometry document bounds grow from max x 6.08 / z ±0.08 to
  and issue target ids       max x 7.08 / z −0.193…4.193 because the uncompilable Rooms' Walls still
                             compile (delta 1); the disconnected-boundary issue's targetId is the
                             renamed Wall id `room-disconnected:wall:0` (was `d:wall:0`); codes unchanged.
```

Reviewer differential (acceptance review, 2026-10-23): every other converted g1 case (line-rectangle,
L-shape, multiple-openings, profile-matrix, elevated-floor, object-matrix) and all three scale tiers
match the observation artifact on rooms, elevations, thicknesses, floor polygons, per-Wall
length/thickness/sample count/sections/openings/profiles/solid spans, objects, issue codes and bounds
(6 dp).

## Cross-track exceptions

```text
frame.ts            normalizeLayoutRoomYaw moved to Scene as private normalizeFrameYaw with identical
                    arithmetic (`((yaw + PI) % 2PI + 2PI) % 2PI - PI`, `-0`/EPSILON → 0). Still
                    pinned by tests/lib/project-model/placement-frame.test.ts. Scene owns the only
                    surviving frame; layout-core has no Room frame left.
project-layout-      LayoutRoomRegistryEntry loses `floor`/`room`; {id, name, position, rotation}
semantics.ts         remain. createEmptyLayoutRoomRegistry is the only constructor, entries stay [],
                    get() → undefined, getRequired/point/localPoint still throw
                    `Unknown project layout room: <id>`, pointInFrame/localPointInFrame stay the
                    identity tuple while refusing a present roomId. No Room frame is manufactured,
                    no Camera evaluation changes, and the world-local Scene reader still refuses an
                    authored roomId (`room_id_forbidden_in_world_local`).
```

Review status: an independent in-slice diff review ran over four slices (packages, cross-track +
editor consumer, fixture/test conversion, docs/artifact) and its findings were resolved before the
gate — the ordered layer-3 assertion, the per-span id uniqueness assertion, the perf root in the
retirement walk, the stale comments in `layout-geometry.ts`, `layout-geometry-types.ts`,
`layout-geometry-validation.ts`, `layout-wall-portals.ts` and `editor-camera-path.ts`, the
`diagrams/architecture.md` class names, the orphan `LayoutOpening` class, the format-6 numbers in
`persistence.md`/`north-star.md`, and the artifact's capture/alias notes.

### Named owner reviews

Performed by the acceptance reviewer under owner direction on 2026-10-23:

- **T3 (reader/Camera) — `project-layout-semantics.ts`: approved.** Consumers inspected:
  `units/runtime.ts` (sole constructor, `createEmptyLayoutRoomRegistry`),
  `visitor/VisitorEntities.svelte` (`getRequired` inside try/catch; reads only `id`/`position`/
  `rotation`, which survive), `authoring/camera/editor-camera-path.ts` and `editor-camera-view.ts`
  (`point`/`localPoint` still throw `Unknown project layout room` for a present roomId;
  `isWorldPointInsideRoomXZ` returns false exactly as the empty registry's `get()` did). No Room
  frame manufactured, Camera evaluation unchanged, world-local reader refusal
  `room_id_forbidden_in_world_local` preserved.
- **T2 (Scene) — `scene-planning/frame.ts`: approved.** `normalizeFrameYaw` is byte-identical to the
  retired `normalizeLayoutRoomYaw` arithmetic, private to the Scene frame owner, pinned through
  `frameYawToWorld`/`frameYawFromWorld` by `tests/lib/project-model/placement-frame.test.ts`; no
  base test referenced the old export, so no coverage was lost. T2.P02.S02 (PR #185) does not touch
  `frame.ts`, so no rebase order applies.

The slice is still not accepted: acceptance is recorded later by closeout.

## Retained surface, deliberately not removed

```text
CompilerFloorSource.height             optional storey scalar retained as the shared core's fallback;
                                       no format-6 document can define one.
layout-wall-portals.ts                 the wall-first portal relations live here (Save-blocking
                                       adjacency); only the retired legacy projection was deleted.
buildRoomWallMesh Room branch          VisitorLayoutShell's Room-level mesh branch and its heavy-lane
(VisitorLayoutShell)                   watertight tests (fed by tests/helpers/wall-mesh-fixtures.ts
                                       compileRoom, which assembles a Room with its canonical Walls) are
                                       kept per the plan's mesh-primitive preservation; no format-6
                                       output reaches the branch. Deferred-retirement row in the T1 README.
isWorldPointInsideRoomXZ               editor-camera-path.ts keeps the function as constant `false`
(Camera authoring)                     (registry empty → identical result); its two callers' active-room
                                       branches are unreachable. Deferred-retirement row in the T1 README.
```

## Verification still owed

```text
T1.P02.S04   integrated exhaustive proof, S01's F2 S/M open timings on the designated M2
S02          owner authorization, a complete plan drafted from its outline, and this slice's
             acceptance + merge first
```
