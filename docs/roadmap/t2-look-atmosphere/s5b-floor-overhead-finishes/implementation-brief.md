# S5b — Floor and overhead Finishes: implementation brief

**Status:** implementation brief, first commit of the S5b PR (T2 `look.surface-finish`).
**Base:** `main` at `ec7ef4ba` (T1 V1c #381 and T2 S5a #368 merged).
**Planning authority:** [J surface references and lineage](../s5a-wall-finishes/j-surface-references-plan.md)
(the approved S5a contract; this brief does not replace it), plus OD-J2/OD-J5 and the T2
proposal's S5b row. This is a slice brief, not a roadmap or a second architecture.

## 0. Scope in one sentence

Use S5a's existing Layout surface identity, Scene `surfaceFinishes`, Paint scope, material
factory, compound Layout history and Scene lineage application to paint **Room/Space floors and
lids** and **Region top/underside faces**, admitting `region-face` in a strict Scene 11 bump, with
no second identity, planner family or rendering pipeline.

## 1. Existing infrastructure reused

| Area | Landed mechanism | Reused for S5b |
| --- | --- | --- |
| Identity | `packages/layout-core/src/plan/surface-reference.ts`: tagged `LayoutSurfaceRef`, `surfaceKey`, `resolveLayoutSurface` lifecycle, `resolveLayoutSurfaceReference` geometry | Unchanged vocabulary; Region faces already exist |
| Space scope | `surfacesOfSpace` already returns boundary Wall sides, floor, a `present` lid and wholly-contained Region faces (`top` for floor Regions, `underside` for overhead); straddling Regions are `excluded: spans-spaces` | Do not rewrite; extend `spaceOfSurface` to the same members |
| Storage | `CameraFreeSceneDocument.surfaceFinishes` and `SceneSurfaceFinish`, Scene unit 10, strict codec normal form | Same record; Scene 11 only widens the admitted reference union |
| Assignment | `scene-surface-finish-assign` Scene planner, `resolveSceneSurfaceFinish`, `finalizeSceneCandidate` scope grants | Same planner and record-scope grant; widen the surface payload and target qualification |
| Lineage | Layout planners register runtime `surfaceLineage`; one `layoutPlanner` compound wrapper applies `applySurfaceLineage` after every Layout acceptance; Scene owns pruning/retirement | Region duplicate adds one lineage row; removal prunes automatically |
| History | Compound Layout acceptance installs the Scene unit in one envelope state; Undo restores it | No new history kind |
| Paint | Stage Paint controller, Face/Space scope, dropper, recents, Palette, `StagePaintAnswer`, `layout-contributions.paintAnswer` | Same tool; widen the answer and the Space expansion |
| Finish model | `finish-model.ts`: `finishKeyOfSurface`, `usersOfFinish`, material-instance normal form, shared / Just-this Ask | Unchanged; region and Room refs already resolve through `resolveLayoutSurface` |
| Materials | `sceneLookFor` → shared catalogue/instance material factory; `resolveSceneSurfaceLook`; `createRoomSurfaceMaterials` leases through the Canvas `MaterialStore` | Reuse for Region faces; no new texture or material path |
| Render | `layout-room-representation.ts` already resolves `room-floor`/`room-lid`; `layout-region-representation.ts` draws top/underside/edge groups; Stage and Preview both mount `VisitorLayoutShell` | Room path already complete; add the Region look input and split the material groups |
| Codec/lifecycle | `unresolved-surface` diagnostic, atomic pruning, dormant lid policy | Unchanged |

The gap is narrow: **the storage union, Paint answer and Region renderer do not yet accept Region
faces; floors and lids are storable but not reachable by the Paint UI; Region duplicate emits no
lineage.**

## 2. Exact changes

### 2.1 Layout (identity and queries; no new vocabulary)

1. `layout-surface-reference.ts`
   - Add `duplicateRegionSurfaceLineage(sourceRegionId, createdRegionId)`, one entry for `top` and
     one for `underside`; `edge` is not a Finish face (see §4).
   - Extend `spaceOfSurface`:
     - `room-floor`/`room-lid` → `{kind: 'unique', roomId}` while the source exists;
     - `region-face` → every Room whose compiled outline wholly contains the Region footprint,
       using the **same predicate already used by `surfacesOfSpace`** (extract it to one helper so
       inclusion and membership cannot disagree);
     - more than one Room → `ambiguous`; none → `none`; `wall-side` unchanged.
2. `region-planners.ts` (editor adapter)
   - Region duplicate registers `duplicateRegionSurfaceLineage`. Creation, edits and fits keep
     `[]`; removal needs no row because pruning is automatic.
   - Replace the now-false comment that Region faces are never Scene Finish subjects.

No Layout schema change: Layout stays appearance-free.

### 2.2 Scene (the strict format change)

1. `units/types.ts`: `SCENE_UNIT_FORMAT_VERSION` 10 → **11**.
2. `scene.ts`: `SceneSurfaceRef = LayoutSurfaceRef` (Region faces admitted); keep
   `SceneSurfaceFinish` unchanged.
3. `units/validate.ts` `readSurfaceFinishes`:
   - admit `region-face` (`regionId`, `face`);
   - admit `face` values `top` and `underside` only; `edge` is refused with a new
     `unknown_surface_face` code and the message names Scene 11;
   - normal form, sorting, uniqueness, pristine-instance and `missing_reference` rules unchanged.
4. `scene-planning/surface-lineage.ts`: remove the explicit `region-face` rejection so an accepted
   target can carry a Finish; the rest of the applicator is unchanged.
5. `scene-planning/finish-planners.ts`:
   - rename `readWallSideRefs` to a canonical surface reader accepting all four kinds and rejecting
     `edge` in the payload;
   - accept the finish assignment for a Room or Region surface;
   - qualify each target against Layout exactly as Wall sides are qualified today:
     Wall → `{kind:'wall', id}`, component `side:left|right`;
     Room → `{kind:'room', id}`, component `floor|lid`;
     Region → `{kind:'region', id}`, component `top|underside`;
   - require `resolveLayoutSurface(...) === 'present'`; a dormant lid (open to sky) refuses
     `surface_not_present`, so no assignment is created for a surface that cannot be seen;
   - generalize the payload/refusal wording from "Wall side" to "surface".
6. `finish-model.ts` needs no logic change; reach already reads `resolveLayoutSurface` and therefore
   includes Region and dormant records.

### 2.3 Stage Paint

1. `adapter-contract.ts`: `StagePaintAnswer` keeps one shape. Add the only new hit kind in the
   Stage vocabulary needed to name a lid, `'room-lid'` (see §2.4), in `StageSourceHit`.
2. `layout-contributions.ts` `paintAnswer`:
   - Wall: unchanged side resolution, including Plan's `wallSideAt`.
   - `room-floor` → `{kind:'room-floor', roomId: hit.sourceId}`.
   - `room-lid` → `{kind:'room-lid', roomId: hit.sourceId}`, only when `present`.
   - `region` → use the hit's `componentId` (`top`/`underside`); an `edge` hit refuses with
     "This part of a region can't be painted." (Plan and 3D already carry the face).
   - Space scope: `surfacesOfSpace(document, roomId).surfaces` **without the Wall-side filter**, so
     the gesture expands to Wall faces, floor, `present` lid and wholly-contained Region faces in
     one write. A Region with no unique containing Space offers no Space scope.
3. `stage-painter.ts`: widen `surface`/`assignmentSurfaces` from Wall-side-only to
   `LayoutSurfaceRef`; Face scope writes the picked surface, Space scope writes the whole
   expansion; consequences name the count and the Space instead of "Wall faces". Dropper copy and
   `isSurfaceAlready` accept any Scene surface.
4. `finish-authoring.svelte.ts`: `paintSurface`/`copySurface`/`activeSurfaceIsAlready` accept any
   `SceneSurfaceRef`; build the qualified target per §2.2 item 5. Shared / Just-this is untouched
   because Paint only assigns a Finish.

### 2.4 Renderer (one pipeline)

1. `layout/surface-look.ts`: `SceneSurfaceRef` becomes the full canonical union.
2. `scene-surface-look.ts`: unchanged resolution; it already takes a surface ref.
3. `layout-region-representation.ts`:
   - take the same optional Scene look resolver and texture scope as the Room representation and a
     `setScene`-equivalent update so a Finish write re-leases materials without rebuilding
     geometry;
   - split the compiled groups: **top → material 0**, **underside → 1**, **edge → 2**;
   - defaults stay as today: a floor Region's top uses the floor look, a Region's underside and
     edge use the dark plaster/edge look; a painted face replaces only its own group;
   - keep the lifted layer, identity tag, shadow flags and `cacheKey` retention unchanged.
4. `layout-region-representation` callers (`VisitorLayoutShell.svelte`) pass `scene`,
   `textureScope`, the shared `resolveSurfaceLook` and an invalidate callback; Stage and Preview
   then share identical behaviour automatically.
5. Room lid picking identity: tag the generated ceiling with `renderIdentity('lid', roomId)`
   (`render-identity.ts`), map it in `scene-pick-source.ts` as `layoutKind: 'lid'`, and add
   `'lid'` to the Stage render-paint hit path (`plan-pick-provider.ts`) as `sourceKind:
   'room-lid'`. The tag must **not** make the lid a Slice cap source (`sectionSources` already
   skips `floor`; it must skip `lid` too), a selectable subject or a cutaway occluder.
6. `buildRegionMeshGeometry` material grouping changes from `top ? 0 : 1` to
   `top → 0, underside → 1, edge → 2`; the existing per-triangle `regionSurfaces` attribution is
   unchanged.

### 2.5 UI copy (no new control)

No new panel, Card row or tool. The armed Paint palette already shows the active Finish, dropper,
recents, Face/Space and the consequence line. The only visible changes are the surface names in
the hover/consequence/notice copy (`floor`, `lid`, `Region top`, `Region underside`) and a Space
count that now includes planes and Regions.

## 3. J rules applied

| Rule | Application |
| --- | --- |
| Space containment (OD-J2) | Space scope names a Region face only when its footprint is wholly inside the Space outline; a straddling Region is `excluded` and named. This reuses the S5a predicate and changes no Lift/association query |
| Duplicate inheritance | A duplicated Region's `top` and `underside` inherit the source assignment by shared Finish identity (no clone); `edge` has no Finish |
| Region removal | The retired identity is pruned in the same accepted envelope; Undo restores both units |
| Region edits | Move, rotate, footprint, elevation, thickness, name and fits keep the Region id, so assignments stay and no lineage row is needed |
| Dormant lids | An open-to-sky lid is never offered by Paint or Space scope, but an assignment painted while closed is kept dormant and returns when the Space is closed; no write on the transition |
| Retired references | Loaded orphans remain `unresolved-surface` and render the default; no new edit may create one (`surface_reference_orphaned`) |
| Viewing readings | Lift, Slice and the near-wall cutaway change no surface status, write no Scene byte and do not affect the assignment |
| Shared reach | `usersOfFinish` counts present and dormant Room/Region surfaces, so shared / Just-this readings remain complete |

## 4. Implementation choices recorded (no genuine contract ambiguity)

These are ordinary choices inside the approved contracts, not questions for the owner:

1. **`edge` is not paintable.** S5b's stated scope is top/underside; a Region edge is a generated
   perimeter strip whose direction varies by side, and OD-J6 already excludes Wall caps. Scene 11
   therefore refuses `edge` rather than storing an assignment nothing can render.
2. **A lid gets a Stage-only `'lid'` render/pick identity.** The ceiling has no Layout Plan source
   kind, and representing it as `room-floor` would lie about the face. `'room-lid'` is a Stage hit
   kind, not a Plan fragment kind; the Layout Plan representation and Layout format are unchanged.
3. **Space scope expands at gesture time.** This is J §7's approved rule; no live query is stored.
4. **A nested-Space ambiguity refuses.** If more than one Room wholly contains a Region footprint,
   `spaceOfSurface` answers `ambiguous` and Space Paint refuses instead of guessing, matching the
   existing duplicated-Wall-side rule.
5. **Plane defaults are unchanged.** An unpainted floor, lid or Region face renders exactly as it
   does today, so S5b creates no visual diff on an existing World.
6. **Copy is generalized, not redesigned.** No new label, shortcut or control; the existing Paint
   palette/marks are used.

No contract contradiction was found. If implementation reveals one (for example a Region that is
contained by two Spaces and no refusal is acceptable to the UX), it stops and is reported rather
than silently resolved.

## 5. Format and version impact

- **Scene 10 → 11, strict refuse.** The new `region-face` record is not a legal Scene 10 value and
  must not be silently accepted. There is no migration; a Scene 10 file is refused with
  `unsupported_format_version`.
- **Layout format unchanged.** No Layout field, schema or codec changes.
- Fixtures and tests that hard-code Scene 10 are regenerated/updated to 11. The API save-unit
  fixture already reads `SCENE_UNIT_FORMAT_VERSION`, so it follows the constant.
- `unresolved-surface`, pruning, dormant and compound history have no format change of their own.

## 6. Integration risks

1. **Lid identity can leak into non-Paint paths.** A tagged ceiling could become a Slice cap source
   or a selectable/occluding hit. The change must explicitly skip `lid` in `sectionSources` and
   keep selection on the Plan floor.
2. **Material-group indices are observable.** Existing Region tests construct a two-material array;
   the three-group change must update them and preserve the visible default (top floor, dark
   underside/edge).
3. **Space-scope counts change.** Wall-only Space Paint previously reported N Wall faces; it now
   includes planes and Regions. Tests and copy must assert the new membership, not the old count.
4. **Containment must be one rule.** `surfacesOfSpace` and `spaceOfSurface` must share the helper;
   two predicates would let a Region be offered in Space scope but report no Space from itself.
5. **Hover cost.** `paintAnswer` already compiles Layout for Wall Space scope. Region Space scope
   adds the same read; the implementation must not add a second compile per hover.
6. **Browser availability.** V1c records that the Region tools are reached through the planned
   `Form` family default; the browser pass must verify Terrace/Roof can actually be armed before
   claiming Region paint acceptance.

## 7. Focused acceptance tests

| # | Test | Fails if |
| --- | --- | --- |
| B1 | Codec: Scene 11 admits `region-face` `top`/`underside`, refuses `edge`, refuses Scene 10, preserves sorting/uniqueness/pristine rules | The union or normal form drifts |
| B2 | Paint one Region top and its underside with two Finishes; exact Undo/Redo; the other face stays default | Face identity is collapsed or history splits |
| B3 | Space Paint from a Room floor writes Wall sides, floor, lid and wholly-contained Region face in one entry; a straddling Region is excluded and named; a neighbour Space's side is excluded | Membership is geometry-guessed or a live rule |
| B4 | Duplicate a painted Region: the copy references the same `materialInstanceId`; editing shared reaches both | A Finish is cloned or reach omits surfaces |
| B5 | Remove a painted Region: assignment pruned in the same entry; Undo restores it; `unresolved-surface` stays 0 | Orphans retained or prune is a second entry |
| B6 | Paint a lid, set the Space open-to-sky: assignment kept, not rendered/offered; close it: same assignment, no write | Dormant is pruned or recreated |
| B7 | Region move/footprint/elevation/thickness keep the assignment; Lift, drawn Slice and cutaway write nothing | Edits retire identity or viewing writes |
| B8 | Stage Paint answers: Room floor, 3D lid, Region top/underside are paintable; Region edge and open-to-sky lid refuse in words | Paint still only reaches Wall sides |
| B9 | Renderer: Room floor/lid and Region top/underside resolve through the one Scene material resolver; unpainted faces keep today's defaults; texture leases release | A second material path or a leaked lease |
| B10 | Stage/Preview parity: both mount the same representations and resolve the same Scene assignment; no editor module reaches visitor chunks | Visitor needs editor code |
| B11 | Finish reach counts present Room/Region surfaces and dormant lids, excludes retired loaded refs | Shared-risk readings omit surfaces |
| B12 | Every registered Layout planner still supplies explicit lineage; a Region duplicate's row is the only new one; topology fixture has no invalid lineage | A planner skips the wrapper or emits an invalid row |

## 8. Verification and browser evidence

Automated: the affected codec, lineage, planner, Stage-paint, renderer and region suites in
`test:fast`; `test:arch` for visitor/import/material-factory boundaries; `check` for the editor and
the changed packages; `build`; API save-unit test. The PR records the exact commands and results.

Browser: one real Chromium journey on the task-owned local stack using the existing QA project —
paint a Room floor, a lid and a Region top/underside, use Face and Space scope, Undo/Redo, save and
reload, open Stage 3D and Visitor Preview, and confirm the visible materials and console. Evidence
is captured in the PR comment, not committed as screenshots.

**Region-tool availability investigation.** V1c's evidence records the Form family's default as the
planned `Form` tool, with Terrace and Roof only in the family strip, and notes partial browser
coverage. The browser pass must first prove that `Form → Terrace`/`Roof` arms Ink and that the
Region plate is reachable at the QA viewport; if it is not, that is a blocker to report, not a
reason to claim Region paint acceptance. No browser acceptance will be claimed beyond the journeys
actually captured.

## 9. Out of scope

S8 materials and map slots, G1 grouping, pitched or non-flat roofs, Wall tops/caps/reveals,
per-face painting on forms, persistent hosting of objects on surfaces, a mapping override on an
assignment, any second surface identity or material pipeline, and unrelated T1 work. Region
authoring, Lift and Slice behaviour are consumed as landed; any defect found in them is reported,
not repaired here.
