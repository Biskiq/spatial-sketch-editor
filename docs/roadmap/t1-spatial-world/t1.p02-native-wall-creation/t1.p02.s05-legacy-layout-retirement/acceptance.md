# T1.P02.S05 — acceptance record: Legacy Layout retirement — CLOSED STUB

```text
AUTHORITY: NONE — the phase README owns slice status; this stub records acceptance and recovery.
STATUS:    ACCEPTED (`owner-override`, 2026-10-23) and SHIPPED by PR #183 (base main fff7dc14).
REVISION:  588cc70f26ee80364a0cb211233d0cd82836db25 — the tested and independently re-reviewed revision.
TIER:      architecture-integration; integrated exhaustive proof remains T1.P02.S04.
PHASE:     T1.P02 remains active; S04 is its declared final gate. S02 remains held and unauthorized.
```

## Delivered

The Room-owned legacy Layout document surface is gone. The format-6 wall-first reader, identities,
one canonical compiler and compiled behaviour are unchanged. Retired: `layout-types.ts`,
`layout-codec.ts`, `layout-room-frame.ts`, the legacy half of `layout-portals.ts`,
`compileLayoutGeometry` / `legacyCompilerSource`, the legacy document create/parse/serialize/validate
entries and `deriveLayoutRoomFrame` / `layoutRoomPoint` / `layoutRoomLocalPoint`.
`compileWallFirstLayoutGeometry` → `compileLayoutGeometrySource` is the single compiler dataflow.
No second reader, migration, alias, forwarding shim or compatibility path remains. New dependencies: none.

Owned replacements: `layout-coordinates.ts` (`LayoutVec2`), `layout-path.ts` (`DraftPath`,
`DraftSegment`, `LayoutInteriorAnchor`), `layout-issue.ts` (`LayoutDocumentIssue`,
`LayoutDocumentValidationError`), `layout-wall-portals.ts` (live wall-first portal relations only).
The compiler types are owned by `layout-geometry-types.ts`; `CompilerSource.wallIdScope` was removed in
review (no producer or test set `'room'`).

Cross-track exceptions, both reviewed and approved on 2026-10-23:

```text
scene-planning/frame.ts      normalizeLayoutRoomYaw moved to Scene as private normalizeFrameYaw with
                             identical arithmetic; pinned by tests/lib/project-model/placement-frame.test.ts.
                             Reviewer: T2 (Scene) — approved. T2.P02.S02 does not touch frame.ts.
project-layout-semantics.ts  LayoutRoomRegistryEntry keeps {id, name, position, rotation}; the
                             legacy floor/room types are gone. createEmptyLayoutRoomRegistry is the only
                             constructor; get() → undefined; getRequired / point / localPoint still throw
                             `Unknown project layout room: <id>`; the world-local reader still refuses an
                             authored roomId (`room_id_forbidden_in_world_local`).
                             Reviewer: T3 (reader/Camera) — approved after consumer inspection.
```

## Gate evidence

Owner-accepted evidence at the tested revision. Re-run by the implementer and reviewer; not re-run by
this closeout (only the documentation gate was re-run, see the preservation report).

```text
revision tested    588cc70f on t1/p02-s05-legacy-layout-retirement (base main fff7dc14), PR #183
npm run check                  1822 files, 0 errors, 0 warnings
npm run check:layout-core / check:project-model / check:camera-core / check:api   clean
npm run build                  produced
apps/editor npm test (full, 183 files / 2385 tests), two runs at load average 48–55 on 8 cores
                               (sibling lanes' browser runs): 2380 and 2382 pass; every failure a
                               5000 ms timeout, no assertion failure; the failing set differed per run
                               (documentation-references, p23b11-correspondence-reference,
                               p23b4-shared-derivation, p23b8-d5-identity-falsifier)
those four files rerun alone   4 files / 75 tests pass
lanes run separately at load   fast 2081/2082, heavy 124/125, arch 177/178 — the three failures were
                               timeouts; watertight-matrices 8/8 and documentation-references 25/25
                               pass alone
npm run test:api:stack (BISKIQ_STACK=biskiq-t1, BISKIQ_DB_PORT=5436, isolated local Compose db on
  127.0.0.1:5436; no credentials recorded)   95 tests, 95 pass, 0 fail, 0 skipped, 0 todo;
  stack /health/ready 200, then torn down
```

Earlier implementation revision `4b385b33` (history only): fast 2082/2082, heavy 125/125, arch
178/178, full 2385/2385 passed and the API stack 95/95 passed before the acceptance review's five
findings were fixed in `588cc70f`.

Independent acceptance review (2026-10-23) of revisions `4b385b33..588cc70f` raised five findings:
the `wallIdScope` dead input; an incomplete retirement predicate; unrecorded semantic deltas 4–5;
the undocumented `isWorldPointInsideRoomXZ` stub; and stale legacy comments. All five were fixed in
`588cc70f` and re-reviewed with no open finding. The named T3 and T2 reviews above are recorded.

## Owner ruling — full-suite clean-run waiver (2026-10-23)

```text
RULING:  The owner waived the requirement for one clean full-suite `npm test` run on 588cc70f.
SCOPE:   Only the full editor suite's clean-run requirement for this slice and revision.
BASIS:   Every test passed at least once on 588cc70f; all failures were load-induced 5000 ms timeouts
         with no assertion failure; the failing files pass in isolation; the same timeout reproduced on
         the untouched base fff7dc14.
NOT WAIVED: Nothing else. No assertion or timeout was changed.
EFFECT:  The phase register and T1 baton read `owner-override`, never `reviewed`.
```

## Fixture coverage (retired assertion → wall-first successor)

The pre-removal compiled-output observations are kept live at
[observations/legacy-compiled-observations.json](./observations/legacy-compiled-observations.json)
(captured at `fff7dc14` from the retired `compileLayoutGeometry`; JSON evidence, not renderable, so not
archived). Every converted g1, g2, scale and mesh case keeps the defect it detected (topology closure,
orientation, opening host and offset, profile, elevation datum, object footprint, disconnected or
self-intersecting boundary, mesh watertightness, determinism, seed divergence). No assertion was
narrowed, and no `skip`, `only`, `todo`, snapshot or tolerance was added. The reviewer's differential
matched the observation artifact on every other converted g1 case and all three scale tiers (6 dp).
Successors: `layout-g1-fixtures.ts`; `layout-g2-fixtures.test.ts` (room-derived wall detail is now an
ordered layer-3 assertion); `layout-geometry.test.ts` ("emits each wall-first Wall once…" plus per-span
id uniqueness); `layout-geometry-boundary.test.ts` (legacy-module absence, one compiler, consumers);
`tests/helpers/wall-mesh-fixtures.ts`; `__fixtures__/layout-scale-fixtures.ts`. The retired multi-floor
cases are asserted directly on the empty document in `layout-geometry-boundary.test.ts`.

## Intentional semantic deltas

```text
1 rooms of an uncompilable Room  An uncompilable Room contributes no fill/stroke, but its authored Walls are
                                 independent canonical geometry and still commit to layer 3
                                 (layout-g2-fixtures.test.ts, "T1.P02.S05 delta").
2 ceiling from Walls             Room ceilings come from boundary Wall heights; the retired Floor storey
                                 scalar is gone, so floor-derived ceilings exist only for a direct caller.
3 multi-floor documents          No wall-first expression; the cases are retired (delta evidence in the
                                 observation artifact).
4 curved Wall length             A physical Wall's `length` is the arc length of its samples; the retired
                                 room-derived record reported the chord sum. g1-auto-bezier
                                 `room-rectangle:wall:0`: 6.363454 → 6.363855; the 33 sample points are
                                 identical.
5 invalid-geometry bounds        g1-invalid-geometry bounds grow (max x 6.08 → 7.08; z ±0.08 → −0.193…4.193)
  and issue target ids           because uncompilable Rooms' Walls still compile (delta 1); the disconnected
                                 issue's targetId is `room-disconnected:wall:0` (was `d:wall:0`); codes unchanged.
```

## Retained surface, deliberately kept

```text
CompilerFloorSource.height      optional storey scalar kept as the shared core's fallback; no format-6
                                document can define one.
layout-wall-portals.ts          the wall-first portal relations (Save-blocking adjacency); only the
                                retired legacy projection was deleted.
buildRoomWallMesh Room branch   VisitorLayoutShell's Room-level mesh branch and its heavy-lane watertight
                                tests (fed by compileRoom in tests/helpers/wall-mesh-fixtures.ts) are kept
                                per the plan's mesh-primitive preservation; no format-6 output reaches the
                                branch. Deferred-retirement row in the T1 track README.
isWorldPointInsideRoomXZ        editor-camera-path.ts keeps the function as constant `false` (empty registry
(Camera authoring)              gives the identical result); its two callers' active-room branches are
                                unreachable. Deferred-retirement row in the T1 track README.
```

## Verification still owed

```text
T1.P02.S04   integrated exhaustive proof, and S01's still-unrun F2 S/M open timings on the designated M2
S02          owner authorization, plan review, the T3 review of the shared Head/F4 shell allocation,
             T2/T3 contribution-compatibility review, and its own acceptance and merge
```

## Entry points

```text
implementation  packages/layout-core/src/layout-coordinates.ts
                packages/layout-core/src/layout-path.ts
                packages/layout-core/src/layout-issue.ts
                packages/layout-core/src/layout-wall-portals.ts
                packages/layout-core/src/layout-geometry.ts
                packages/layout-core/src/layout-geometry-types.ts
                packages/layout-core/src/layout-geometry-validation.ts
                packages/project-model/src/project-layout-semantics.ts
                packages/project-model/src/scene-planning/frame.ts
validation      apps/editor/tests/lib/layout/layout-geometry-boundary.test.ts
regressions     apps/editor/tests/lib/layout/layout-geometry.test.ts
                apps/editor/tests/lib/layout/layout-g2-fixtures.test.ts
                apps/editor/tests/lib/layout/layout-scale-compile.test.ts
                apps/editor/tests/lib/project-model/placement-frame.test.ts
```

## Recovery

```text
git show 588cc70f26ee80364a0cb211233d0cd82836db25:docs/roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s05-legacy-layout-retirement/acceptance.md
anchor  588cc70f26ee80364a0cb211233d0cd82836db25
 tag    closed/T1.P02.S05 → 588cc70f26ee80364a0cb211233d0cd82836db25 (local only — not pushed)
```

The plan's recovery anchor is `6d87e25b9ab4695472d96c0b3ef3a15b777bc062` (see the plan stub).
P1 recovery requires a merge commit: the merge owner verifies both anchors are reachable from `main`.

## Preservation report

```text
CLOSEOUT PRESERVATION — T1.P02.S05 (2026-10-23)
prose compacted:                 2   plan and acceptance record → stubs at their own paths
reference promotions:            0   in-slice reference/* updates (architecture, persistence, north-star,
                                     diagrams, T1 README/EVIDENCE-PATHS) landed with the implementation
renderable evidence archived:    0 files   (observation artifact is JSON: kept live, not archived)
evidence stubs / manifests:      0
transient artifacts removed:     0
historical anchor:               588cc70f (acceptance) · 6d87e25b (plan) · tag closed/T1.P02.S05 → 588cc70f
                                 (local only — not pushed)
new live → archive prose links:  0
manual-owed verification rows:   0 (none recorded as manual)
remaining deferred items:        2   T1 track README deferred-retirement rows (Room-level mesh path,
                                     Camera room-ownership branches); S01 F2 S/M timings → S04
permanent stubs added:           2   (the owner-ratified cost: one per closed prose artifact)
```
