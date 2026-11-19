# J — Surface references and lineage (T1 × T2), first commit of S5a

**Status:** Owner-approved for S5a implementation on 2026-11-17 (six OD-J rulings, PR #368).
**S5b closeout (2026-11-19):** Scene 11 admits `region-face` `top`/`underside` (an `edge` is
refused with `unknown_surface_face`), Paint reaches Room floors, present lids and Region faces,
and Region duplicate carries top/underside lineage by shared Finish identity. OD-J2's containment
rule, OD-J3's plane inheritance and OD-J4's dormant/retired split are applied unchanged; no new
surface identity or material path was introduced.
This preserved first commit remains the planning authority; implementation and the V1d
reconciliation are recorded in follow-up commits on the same draft PR.
**Capabilities:** `look.surface-finish` *new* (S5a, S5b). T1 obligations are recorded against
existing T1 ids.
**Planning base:** `main` at `c0a7c92e`; this is the base preserved by the first planning commit.
**Implementation base:** `main` at `cd5222fc` (V1d PR #380). The planning commit was rebased without
changing its contract; implementation reconciles against the newer Layout surface API below.

**Authority.** The T2 proposal ([§10](../README.md#10-coordination), D1, D2, S5a/S5b rows) and the
T1 next batch ([T1–T2 contract](../../t1-spatial-world/next-batch/README.md#t1t2-contract), Q3,
Q13, Q14, Q17, Q18, Lane D row **J**). Also the SP-plan (§§3.3, 5, 11, 16), the V-plan (§5.6,
§5.7, §14 H-8), the C-plan (§5), A1 #296, A2 #308 and A5 #348. Where a sentence here differs from
one of those sources, the difference is listed in §11 as an owner ruling. This plan never resolves
such a difference silently.

**Original goal.** S5a was planned to avoid new semantic decisions, and to leave SP1, V1 and C free
to land later without a conflicting T2 surface model. The implementation-base reconciliation above
records the intervening V1d API and keeps V1c region-authoring/Lift work out of this PR.

## 0. Summary

| # | Question | Answer here |
| --- | --- | --- |
| 1 | Surface identity | One tagged `LayoutSurfaceRef`: authored source id plus fixed role. It is typed, owned by Layout and opaque to T2. It is never compiled (§2) |
| 2 | Finish ownership | Scene `surfaceFinishes`, one record per surface, in the Scene unit 10 bump. Layout stays appearance-free (§3) |
| 3 | Lineage | Layout planners register runtime `surfaceLineage` metadata, a precedence map from new surfaces to old ones. One Scene-owned function applies it. There is one table per operation (§4) |
| 4 | Unresolved | `present`, `dormant` or `retired` is read from authored Layout only. A retired assignment is pruned in the same acceptance. A dormant one is kept and comes back when its role returns. Viewing readings never count (§5) |
| 5 | Atomic history | Already possible: history stores whole-envelope states, and compound planners exist. Every Layout planner becomes `compound, writes: ['scene']` through one wrapper (§6) |
| 6 | Space scope | `surfacesOfSpace`, a Layout query over the oriented boundary. It expands to per-surface assignments when the gesture is made (§7) |

## 1. Planning-time verified facts (code at `c0a7c92e`)

These facts explain the original J proposal; they are not a claim about the later implementation
base. The explicit V1d API reconciliation and current implementation status follow in §§2 and 9–10.

| # | Fact | Where |
| --- | --- | --- |
| V1 | No Scene or Experience record holds a durable Layout reference today. Scene format 1 says that no record carries `roomId`. S5a introduces the first one | `project-model/src/scene.ts:476` |
| V2 | Cross-unit references inside the envelope are plain typed ids. A missing target produces a non-blocking envelope diagnostic and the record stays authored (`unresolved-view`) | `units/validate.ts:1508` |
| V3 | F.1 `SemanticReference` carries an exact or locked revision, so it is a boundary form, not a stored key. The Layout unit resolver refuses every `componentId` today | `references/types.ts:73`, `unit-resolution.ts:161` |
| V4 | **Verify-first item 7 is answered: yes.** `AuthoringHistory` stores accepted envelope states, and Undo restores a state, not an inverse. Compound planners (`compound: true, writes: [...]`) exist: Experience already writes Camera. The Stage host grants compound | `f4/history.ts`, `f4/types.ts:183`, `units/planning.ts:971`, `stage/host-acceptance.ts:211` |
| V5 | Layout planners are registered through one factory with `{ domain: 'layout', compound: false }` | `adapters/layout/precision.ts:239` |
| V6 | `CorrespondenceEntry` has `created` with `before: null`, so it cannot say that a created subject came from something. Split reports the new Wall as `created` | `f4/types.ts:126`, `split-planners.ts:186` |
| V7 | A split keeps the start fragment's id **and its direction**. The boundary is rewritten in the same orientation | `layout-wall-noding.ts:475` |
| V8 | **A join can reverse a surviving Wall.** When neither Wall ends at the Joint, the smaller id survives, and the joined Wall starts at the survivor's far end. If the survivor started at the Joint, its stored direction flips while its id is kept, which exchanges its left and right sides | `layout-wall-dissolve.ts:255–294` |
| V9 | Duplicate builds `wallIdMap` internally but returns only the created ids | `layout-duplicate.ts:532`, `:95` |
| V10 | Reconciliation already returns `RoomLineageRecord` (`preserved`, `split-survivor`, `merge-survivor` or `created`) with `predecessorRoomIds` | `layout-room-reconciliation.ts:72` |
| V11 | Wall sides already have a vocabulary: `'left' \| 'right'` about the canonical left normal (Unroll, Face) | `layout-wall-development.ts:96`, `:811` |
| V12 | The lid already has a Layout-local key, `{ kind: 'room-lid', roomId }`, and floors are a plan source kind, `room-floor` | `layout-geometry-queries.ts:147`, `layout-plan-representation.ts:78` |
| V13 | S4 Finish normal form: a curated Finish is `materialId` and a project Finish is `materialInstanceId`. A pristine instance with no user is collected. `usersOfFinish` counts entities only. Layout's `paintAnswer` refuses with "Walls are not painted yet." | `finish-model.ts:126`, `finish-planners.ts:160`, `layout-contributions.ts:806` |
| V14 | Captured Layout ids are never reused. A recreation always receives a new id | `layout-id-capture.ts:1` |
| V15 | SP1, V1 and C have not landed (virtual edges exist only in the S2 spike). A1, A2, A4, A5, X1 and SL1–SL2 have landed. Layout is format 7 and Scene unit is format 9 | `git log`, `units/types.ts:70` |

## 2. Contract C1: surface identity

Layout-owned in `packages/layout-core/src/layout-surface-reference.ts`, the canonical
surface-reference module introduced by T1 V1d:

```ts
export type LayoutWallSide = 'left' | 'right'; // about the Wall's canonical left normal (V11)

export type LayoutSurfaceRef =
	| { readonly kind: 'wall-side'; readonly wallId: string; readonly side: LayoutWallSide }
	| { readonly kind: 'room-floor'; readonly roomId: string }
	| { readonly kind: 'room-lid'; readonly roomId: string }
	| { readonly kind: 'region-face'; readonly regionId: string; readonly face: 'top' | 'underside' | 'edge' };
```

**V1d reconciliation (PR #380, merged on the implementation base).** V1d already exported the
canonical `LayoutSurfaceRef` from this module, with the untagged forms
`{ regionId, surface: 'top' | 'underside' | 'edge' }` and
`{ roomId, surface: 'floor' | 'lid' }`. S5a extends that same exported union and module; it does
not introduce another identity system. The structural mapping is:

| V1d reference | Canonical S5a reference | Preserved meaning |
| --- | --- | --- |
| `{ regionId, surface: face }` | `{ kind: 'region-face', regionId, face }` | Same region id and `top`, `underside` or `edge` role |
| `{ roomId, surface: 'floor' }` | `{ kind: 'room-floor', roomId }` | Same Room id and floor role |
| `{ roomId, surface: 'lid' }` | `{ kind: 'room-lid', roomId }` | Same Room id and lid role |
| — | `{ kind: 'wall-side', wallId, side }` | The new stable Wall-side identity |

The region property is renamed from `surface` to `face`; Room plane roles become discriminants.
These changes make the union unambiguous while preserving authored ids, role meanings, and
V1d geometry-resolution behavior. No V1d reference was a persisted Layout or Scene identity, so
there is no old payload migration. `resolveLayoutSurfaceReference(compiled, ref)` remains in the
same canonical module and accepts `LayoutGeometrySurfaceRef`, the Space/region subset of the full
union that its compiled geometry can resolve. Its resolver behavior and compiled
`CompiledRegion.faces[].surface` geometry tags are unchanged. The authored
`resolveLayoutSurface(document, ref)` answers lifecycle status only; it never derives geometry.
OD-J5 still excludes `region-face` from Scene 10 and this PR does not take V1c region-authoring or
Lift scope.

Rules:

1. **Authored ids and fixed roles only.** The following are never part of a reference: compiled
   face, section or band indices, mesh groups, `generationId`, cycle or face keys
   (`spaceBoundaryCycleKey`), Plan `subRef`s, stations, normals or ledger display references.
   `roomId` stays the field name because the code uses it. "Space" is the product word for the same
   record (SP-plan §3.4).
2. **Opaque to T2.** Scene code stores a reference, compares it by `surfaceKey(ref)` (canonical JSON
   of the record, used only for sorting and equality, never parsed) and passes it to Layout's
   resolver. No T2 module branches on `kind` to derive geometry or membership.
3. **Wall side.** `left` is the face whose exterior normal is the canonical left normal from
   `startJunctionId` toward `endJunctionId`. A Space's own side of a boundary Wall is `left` for a
   `forward` ref and `right` for a `reverse` ref (C-plan §5). Only Layout maps a side to geometry.
4. **This J does not cover:** Wall tops, terminal caps, Opening reveals, sills and soffits (OD-J6),
   virtual edges (SP I9), corners, and C's `{ roomId, role: 'inside' }` aggregate. The aggregate is a
   Layout *query* identity used by Space scope and Unroll. It is **not** a finish key. Storing it
   would contradict the approved per-surface lineage table (§4) and C-plan §5's "coverage, not
   inheritance".
5. **F.1 qualification at the boundary** (selection, Paint hits, correspondence; never stored).
   The forms are `{ domain: 'layout', subject: { kind: 'wall', id }, componentId: 'side:left' | 'side:right' }`
   and `{ subject: { kind: 'room', id }, componentId: 'floor' | 'lid' }`. Regions later use
   `{ kind: 'region', id }, componentId: 'top' | 'underside' | 'edge'`, which ratifies V-plan §5.7
   with these spellings. `layoutScoped` (`unit-resolution.ts:161`) admits exactly these pairs. Any
   other `componentId` stays `missing`.

## 3. Contract C2: finish ownership

D1 stands: **Scene stores the assignment, and Layout publishes the identity.**

```ts
// project-model/src/scene.ts
export type SceneSurfaceFinish = {
	readonly surface: LayoutSurfaceRef;
	readonly finish: { readonly materialId: MaterialId } | { readonly materialInstanceId: string };
};
// CameraFreeSceneDocument gains:
//	surfaceFinishes?: readonly SceneSurfaceFinish[];   // Scene unit 9 → 10
```

- **Format.** Scene unit 9 → 10 (D2). Format 9 is strictly refused, there is no migration and the
  fixtures are regenerated. **The Layout format does not change.**
- **Normal form** (codec, unit-local): the field is absent when empty. Records are sorted by
  `surfaceKey` and unique by it. A curated Finish is stored as `materialId` and a project Finish as
  the `materialInstanceId` of a **non-pristine** instance, so `collectPristine` stays correct as it
  is. Codes: `invalid_type`, `invalid_value`, `unknown_surface_kind`, `duplicate_surface_finish`,
  `surface_finish_not_normal` and `missing_reference`. No `mapping` field is reserved. S1's
  assignment-level mapping override needs its own bump later.
- **Absence means the Layout default.** Removing an assignment ("Unpaint", or a lineage source with
  no assignment) deletes the record. The Layout default material is never stored as a Finish.
- **Users and reach.** `usersOfFinish` and S4's shared / Just-this Ask count `present` and `dormant`
  surface users alongside entities (V13). Palette followers and Treatment need no change, because a
  surface resolves its material through `resolveSceneMaterial` exactly as an entity does.
- **Rendering path.** The Layout compiled Wall output tags every fragment of a side face with that
  side's `LayoutSurfaceRef`. This includes the lintel and sill strips on that face and the mitre
  bridge belonging to that side (`wall-mesh-builder.ts` `Corner.front/back`). Floors and lids are
  tagged the same way. The render layer looks up `surfaceFinishes` by key and resolves the material.
  An untagged face uses the Layout default. Walls already emit metre UVs. The visitor uses the same
  runtime-safe lookup from project-model, with no editor import (hard rules 4 and 5).
- **Paint seam.** `StagePaintAnswer` gains `{ kind: 'paintable-surface'; surface: LayoutSurfaceRef }`.
  Layout's `paintAnswer(hit)` gets the side from the face tag in 3D. In Plan it uses a Layout
  function, `wallSideAt(compiled, wallId, point)`, which reads the sign of the lateral offset as in
  `layout-wall-development.ts:862`. It never uses the normal of the nearest face.

## 4. Contract C3: lineage

**Shape.** Layout emits it and it is runtime-only. It is never serialized and never enters history.

```ts
export type LayoutSurfaceLineageEntry = {
	readonly to: LayoutSurfaceRef;                 // a surface in the after-document
	readonly from: readonly LayoutSurfaceRef[];    // before-document surfaces, in precedence order
};
export type LayoutSurfaceLineage = readonly LayoutSurfaceLineageEntry[];
```

**Application.** `applySurfaceLineage(beforeScene, lineage, afterLayout)` is pure, runtime-safe and
Scene-owned (`scene-planning/surface-lineage.ts`):

1. For each entry, find the first `from` with an assignment in `beforeScene`. If there is one, `to`
   gets that same Finish: the same `materialId` or `materialInstanceId`, a shared Finish, never a
   clone. If none has one, `to` is left unassigned. Every entry reads `beforeScene` only, so a swap
   is well-defined.
2. A surface that appears in no `to` keeps its assignment as it was.
3. Prune every assignment whose reference resolves `retired` against `afterLayout` (§5).
4. Return `{ scene, report }`. `report.replaced` lists each lower-precedence `from` whose Finish
   differs from the one chosen. `report.dropped` lists pruned assignments that did not move anywhere.

**Validity**, refused as `surface_lineage_invalid` so that the whole operation writes nothing:

- No two entries share a `to`.
- Every `from` resolves in the before-document.
- Every `to` resolves `present` or `dormant` in the after-document.

Some topology planners compose several edits internally, so an intermediate surface can be born
and retired before the single accepted candidate exists. Layout normalizes that operation-local
lineage back to accepted before-document identities before Scene applies the strict checks above.
Unpainted intermediate surfaces with no accepted predecessor add no persisted source; an assigned
accepted source that is retired is rejected. Precedence order is retained through composition.

The same function runs during proposal (preview) and during commit, so a consequence line cannot
disagree with the result.

**Per operation.** In this table S is the survivor, N the new Wall, O the retired Wall and R the
Room. `S.l` means `wall-side S left`. "↦" is orientation-mapped by Layout.

| Operation | Approved rule | Entries | Producer seam | State |
| --- | --- | --- | --- | --- |
| Split (A1) and noding by a drawn Wall | The new Wall inherits both sides | `N.l ← [W.l]`, `N.r ← [W.r]`. W keeps id and direction (V7) | `NodingPlanSuccess` (`createdWallIds`, `splitWallIds`); `split-planners.ts`, `drawing-planners.ts` | Landed planner, adds output |
| Join (A2) | The survivor's finish wins, with the consequence named and Undo | For each side x of the joined Wall: `S.x ← [S.x↦, O.x↦]`. When S is reversed (V8), `S.l ← [S.r, …]` | `planDissolveJunction` exposes `survivorForward` and `otherForward` (`:293`) | Landed, adds output. OD-J1 |
| Duplicate (A4, A5) | The copy carries the same shared Finish | `C.x ← [src.x]` for each copied Wall side. `copy-room floor/lid ← [src floor/lid]` | `DuplicatePlan` exposes `wallIdMap` and the source Room (V9). Copies keep direction (asserted by test T5) | Landed, adds output |
| Divide a Room | The new Room's floor and lid inherit (OD-J3) | `new.floor ← [R.floor]`, `new.lid ← [R.lid]`. **The new divider gets nothing** (C-plan §5) | `RoomLineageRecord` `created` with `predecessorRoomIds` (V10) | Implemented in S5a |
| Enclosed merge (erase a shared Wall) | The painted survivor side wins; if it is unpainted, carry the absorbed side (OD-J1) | `S.floor ← [S.floor, A.floor]` and the same for `lid` | `merge-survivor` record | Implemented in S5a |
| Open a Room (SP1) | Nothing changes to the Space identity | No inheritance rows; the erased Wall's sides retire. The floor remains present and lid becomes dormant | Existing SP1 operation through the S5a wrapper | Applied by S5a |
| Open merge (SP1) | The painted survivor floor/lid wins; otherwise carry the absorbed plane | As for an enclosed merge | Existing Room reconciliation through the S5a wrapper | Applied by S5a |
| Close along a virtual edge (SP1) | New Wall is unpainted | No Wall-side source exists; existing Space plane refs stay | Existing SP1 operation through the S5a wrapper | Applied by S5a |
| Attach, Release, repack (C) | Every arc inherits; repack follows the seam-side survivor under Q17 | Attach as for Split. Repack as for Join | C1–C3 | **C owes it** |
| Regions (V1) | Duplicate carries; removal is unresolved; there is no split or merge | `copy.face ← [src.face]` | V1 planners | **V1 owes it** |
| Erase a Wall, remove a Room, Remove space | — | No entries. Assignments are pruned in step 3 | — | Automatic |
| Move, rotate, length, height, arc, Opening and rename edits | — | None | — | No change |
| **Any planner that keeps a Wall id but reverses its direction** | Must not swap finishes silently | `W.l ← [W.r]`, `W.r ← [W.l]` | Layout planners | Rule. Test T4 |

Each T1 slice that adds or changes a topology planner states its rows in the PR description (the
lineage duty in `implementation-prs.md`) and adds the matching T-row in §10. This plan is the
**request** that "No lineage field is added … before that plan asks for it" was waiting for.

## 5. Contract C4: unresolved references

`resolveLayoutSurface(document, ref)` is Layout-local, reads **authored** data only and returns
identity lifecycle status. It does not replace V1d's `resolveLayoutSurfaceReference(compiled, ref)`,
which resolves face geometry:

| Status | Meaning | Today |
| --- | --- | --- |
| `present` | The source exists and the role exists | Every Wall side of an existing Wall. A Room's floor and lid |
| `dormant` | The source exists, and the role is absent by stated intent | Unreachable until SP1 (`room-lid` while `open-to-sky`) and SP3 (`room-floor` of a Space that follows a region) |
| `retired` | The source subject no longer exists | Wall, Room or region removed |

Behaviour:

- **Disappears (`retired`).** The assignment is pruned in the same acceptance (§4 step 3; OD-J4).
  Ids are never reused (V14), so a retained assignment could never resolve again. It would only
  inflate Finish reach and the Library "in use" readings.
- **Temporarily unavailable (`dormant`).** The assignment is kept. It is not rendered, not offered
  by Paint and not in Space scope, but it is counted in reach.
- **Returns.** A `dormant` reference becomes `present` again when the intent changes back (Open to
  sky → Closed): the same record and the same Finish, with no write. A `retired` source returns
  only through Undo or Redo, which restores both units in one state (§6).
- **Viewing readings never count.** Lift, Level and drawn Slice, the cutaway, Unroll and Face hide
  geometry. They never change status and never write. A surface with no generated geometry (for
  example a lid ring under three points, `layout-geometry-queries.ts:146`) is still `present`.
- **Read safety.** Envelope validation reports a `retired` reference as the non-blocking diagnostic
  `unresolved-surface`, following the `unresolved-view` precedent (V2). It is never repaired at
  read, it renders the default and it is excluded from reach. Acceptance compares the **identity set**
  of retired surface refs before and after a candidate, and refuses with
  `surface_reference_orphaned` if the candidate introduces any newly retired ref. This remains
  correct when a pre-existing orphan is removed by the same operation and the diagnostic count
  stays constant or decreases. A loaded file still opens, but no edit can create an orphan.

## 6. Contract C5: atomic history

- `layoutPlanner(kind, prepare)` in `precision.ts` is the single compound wrapper:
  `admission: { domain: 'layout', compound: true, writes: ['scene'], units: false, resources: false }`.
  Each prepared candidate registers its required lineage in runtime-only metadata; a non-topology
  planner registers `[]` explicitly so there is no default that could hide a missing row.
- The wrapper runs `applySurfaceLineage` on the prepared envelope, installs the Scene unit only if
  canonical Scene data changed, and appends one `OperationChange { kind: 'scene-surface-lineage' }`
  naming the changed surface identities. One candidate means one acceptance and **one** history
  entry. Undo restores the prior envelope byte-exactly and Redo replays the captured ids (V4).
- F4 admission declares `referenceDomains: ['layout']` for the Scene-owned surface Paint intent.
  This admits a qualified Layout target reference while the write set stays Scene-only; it does not
  grant a Scene planner permission to write Layout.
- A Scene-only Paint planner (`domain: 'scene'`) reads Layout from the snapshot to check that each
  target is `present`. Face scope writes one record. Space scope writes N records in one entry.
- No Layout planner writes Scene any other way. A Scene planner never writes Layout.

## 7. Contract C6: Space paint scope

`surfacesOfSpace(document, roomId): { surfaces: readonly LayoutSurfaceRef[]; excluded: readonly { ref; reason }[] }`
and `spaceOfSurface(document, ref)`. Both are Layout queries in the canonical
`layout-surface-reference.ts` module.

- **Members**, ordered by the boundary starting at its first ref: the Space's own side of each
  boundary Wall (§2 rule 3), then `room-floor`, then `room-lid` if it is `present`. A virtual edge
  contributes nothing. A free-standing Wall inside the outline is not a member. An inner open Space's
  surfaces belong to that Space, not to the enclosing Room (SP §11, Q14).
- **Regions (after V1):** see OD-J2. The recommended rule includes a region face only when the
  region's footprint lies wholly within the Space outline: `underside` for an overhead region and
  `top` for a floor region. A region that straddles two Spaces is listed in `excluded` with
  `spans-spaces`, so the scope readout can name it. This changes the V-plan's proposed
  `regionsOverSpace` (any shared area) for Paint only. Lift keeps its own scope.
- **From a picked surface.** `spaceOfSurface` returns the one Space whose boundary references that
  side. If no Space does (an exterior side, a free-standing Wall), Space scope is not offered. If two
  Rooms reference the same side, which is possible before SP1's I6, the answer is ambiguous and the
  gesture refuses.
- **Gesture-time expansion, not a live rule.** Space scope writes one assignment per member when the
  gesture is made. A divider drawn later is not painted. This is the only reading that agrees with
  the approved per-surface lineage rows ("the new Room's floor inherits" would have no meaning under
  a live rule). It is therefore resolved here, not left as an owner question.

## 8. Refusals

Exact wording belongs to S5a and follows `adapters/layout/refusals.ts`. Each refusal writes nothing.

| Code | When | Gist |
| --- | --- | --- |
| `surface_not_paintable` | Paint over a Wall top, cap, reveal or virtual edge | "This part of a wall can't be painted." |
| `surface_not_present` | A stale hit or intent whose reference is no longer `present` | "That surface changed. Try again." |
| `surface_has_no_space` | A Space-scope intent from a side with no Space | "This side isn't inside a space." |
| `surface_space_ambiguous` | A side referenced by two Rooms | "This wall side belongs to two rooms." |
| `surface_lineage_invalid` | A §4 validity check fails (a planner defect) | The Layout operation refuses whole |
| `surface_reference_orphaned` | A candidate would add a `retired` assignment | The operation refuses whole |
| Codec codes | §3 normal form | Strict refusal on read |

## 9. Ownership and sequence

| Area | Owner | Files / implementation status |
| --- | --- | --- |
| Canonical `LayoutSurfaceRef`, lifecycle, `surfaceKey`, geometry/lateral resolvers and Space membership | T1 (Layout) | Extend V1d's `layout-core/src/layout-surface-reference.ts`; preserve the V1d compiled geometry resolver contract |
| Wall-side tags and lineage producers for Split/noding, Join, Duplicate, Divide/merge and Erase | T1 (Layout) | Layout topology planners, `layout-wall-mesh-builder.ts`, Room reconciliation and duplicate output; implemented on this PR within S5a's approved scope |
| `surfaceFinishes`, Scene 10 codec/validation, Finish reach and Scene-owned lineage application | T2 (Scene) | `scene.ts`, `units/types.ts`, `units/validate.ts`, `scene-planning/surface-lineage.ts`, `finish-model.ts` |
| Compound wrapper and Scene-only target-reference admission | Joint | `adapters/layout/precision.ts`, `f4/types.ts`, `f4/prepare.ts` |
| Face/Space Paint, preview consequence, runtime-safe lookup, material-factory rendering and visitor parity | T2 | `layout-contributions.ts`, `stage/facade/adapter-contract.ts`, Stage/visitor render layer |

**One PR, as Q18 requires.** Commit 1 is this plan and remains preserved. V1d has since landed on
`main`; this implementation extends its canonical Layout reference module without taking on
parallel V1c region-authoring or Lift work. The T1-owned Wall-side identity, qualified hit and
lineage obligations and the Scene/Stage integration are reviewed together on this PR. Future C
topology planners add their own lineage rows and tests as part of their acceptance.

## 10. Discriminating tests

| # | Test | It fails if |
| --- | --- | --- |
| T1 | Split a Wall with both sides painted differently. N carries both, with no swap. One Undo restores the envelope byte-exactly and Redo reproduces the ids and assignments | Lineage is lost, sides are swapped, or there are two history entries |
| T2 | A Wall drawn across a painted Wall nodes it. Every fragment carries the source's sides | The noding path skips lineage |
| T3 | Join where S is painted and O is painted differently: S's Finish is kept and `report.replaced` names O's. If S is unpainted and O is painted, O's Finish carries under OD-J1 | The survivor policy is read from geometry or length |
| T4 | **Head-to-head Join (V8):** the smaller-id survivor started at the Joint. Its `left` assignment ends on the face that was left in world space | An id-preserving reversal swaps finishes |
| T5 | Duplicate a painted Room with a shared Wall (A5). The copy references the *same* `materialInstanceId`. Editing that Finish with "shared" reaches both | A Finish is cloned, or reach omits surfaces |
| T6 | Divide a painted Room. The new Room's floor and lid inherit per OD-J3; both divider sides are unassigned | Coverage is treated as inheritance |
| T7 | Erase a painted Wall. Its assignments are gone in the same entry, Undo brings them back, and `unresolved-surface` stays 0 | Orphans are retained, or the prune is a separate entry |
| T8 | A candidate with a pre-existing orphan plus a newly retired painted surface is refused with `surface_reference_orphaned`, even if the diagnostic count stays constant or falls. A *loaded* orphan opens with the diagnostic and renders the default | Orphan validation compares counts instead of the identity set |
| T9 | Lift, Level cut and Face over painted surfaces leave status, Scene bytes and history unchanged | A viewing reading writes or unresolves |
| T10 | `surfacesOfSpace` on an L-shaped Room with a dividing Wall returns exactly its own sides (forward→left, reverse→right), floor and lid. The neighbour's side of the shared Wall is excluded | Membership is derived from geometry, or both sides are included |
| T11 | Space-scope Paint, then a divider drawn: the divider stays unpainted. One Undo removes all N records | Scope is stored as a live rule, or there are N entries |
| T12 | Every registered Layout planner kind runs on an all-painted fixture: no `surface_lineage_invalid`, no orphan, and an explicit `[]` from non-topology kinds | A new planner skips the wrapper |
| T13 | Codec: format 9 is refused; an unsorted, duplicate, pristine-instance, unknown-kind or bad-side record is refused | The normal form drifts |
| T14 | Visitor parity: a painted World in the cold release renders the same Finishes, and no editor module reaches the visitor chunk | The visitor needs editor code |
| T15 | Preview and commit agree: the Join consequence line equals `report.replaced` of the committed envelope | The preview recomputes on its own |
| T16 | `room-lid` after SP1: Open to sky makes it `dormant` (not rendered, kept), Closed brings it back with no write. **Originated in SP1; retained as an integration check** | The lid is pruned or re-created |

## 11. Owner rulings

| # | Decision | Approved ruling | Scope |
| --- | --- | --- | --- |
| **OD-J1 — approved** | Join or merge when the survivor's side has **no** Finish and the absorbed one has one | Carry the absorbed Finish (`from: [S, O]`); the survivor wins when both are painted. Apply orientation mapping before precedence and report the replaced Finish | S5a Join/merge |
| **OD-J2 — approved** | Which regions belong to Space scope | Wholly contained only; a straddling region is excluded and named. This is Paint scope, not a change to V1 relation or Lift queries | S5b with V1 |
| **OD-J3 — approved** | Divide a Room: does the new Room's **lid** inherit as well as its floor? | Yes; both planes inherit and the divider remains unpainted | S5b Paint; S5a emits lineage |
| **OD-J4 — approved** | A retired reference: prune it in the same acceptance, or keep it as a diagnostic like `unresolved-view`? | Prune retired refs atomically; keep dormant refs; Undo restores both units | S5a |
| **OD-J5 — approved** | What S5a's Scene 10 admits, and what it paints | Admit `wall-side`, `room-floor` and `room-lid`; S5a exposes Wall-side Paint only. Floor/lid UI is S5b. `region-face` waits for its separately admitted format change | S5a codec |
| **OD-J6 — approved** | Wall tops, caps and Opening reveals | No reference or control in S5a; use the Layout default | S5a render |

## 12. Readiness, risks and out of scope

**Implementation status.** All six rulings remain as approved in the owner comment on PR #368.
Implementation extends the V1d canonical module and planner seams on the `cd5222fc` base. The S5a
Wall-side and Room-lineage paths are in this PR; V1c region authoring and Lift work remain on their
T1 track. The acceptance evidence and final gates are recorded below and in the PR body.

**Risks.**

1. Making every Layout planner compound changes its registration. Any test registry without the
   compound grant must be updated in the same PR, which T12 catches.
2. Mitre bridges and lintel strips must carry the right side tag. Getting this wrong shows as a
   seam, so it needs a focused browser check.
3. Before SP1, a Wall side referenced by two Rooms makes Space scope refuse rather than guess.

**Out of scope.** Finish storage code, Layout schema changes, Paint UI design beyond the refusals
listed here, per-face painting on forms (T5), mapping overrides, persistent hosting of objects on
surfaces, and anything that changes V1–V3, SP or C planning.

## 13. Acceptance evidence

### T1–T15 evidence map

| # | Evidence on this PR |
| --- | --- |
| T1 | `apps/editor/tests/lib/authoring/layout-wall-split-adapter.test.ts` — a painted two-sided Wall split carries both assignments and the test verifies the accepted envelope through Undo/Redo. |
| T2 | `apps/editor/tests/lib/project-model/surface-lineage.test.ts` — the real Room-divide plan exercises boundary noding and checks the resulting fragment assignment. |
| T3 | `apps/editor/tests/lib/project-model/surface-lineage.test.ts` — competing reversed Join assignments report the replacement; the OD-J1 regression separately carries an absorbed Finish into an unpainted survivor side. |
| T4 | `apps/editor/tests/lib/authoring/layout-wall-join-adapter.test.ts` — the reversed survivor’s preview and committed orientation agree, with one byte-exact Undo/Redo entry. `layout-junction-wall-ends.test.ts` checks bridge/bevel face tags map through the canonical corner role and owned end. |
| T5 | `apps/editor/tests/lib/project-model/surface-lineage.test.ts` — Room duplication preserves Finish identity; `finish-planners.test.ts` counts present and dormant reach, excludes retired loaded refs, and safely converts surface assignments when a shared Finish returns to pristine. |
| T6 | `apps/editor/tests/lib/project-model/surface-lineage.test.ts` — an actual divide carries floor and lid, carries the noded boundary, and leaves both divider sides unassigned. |
| T7 | `apps/editor/tests/lib/authoring/layout-drawing-adapter.test.ts` — Erase prunes the Wall assignments with the accepted topology operation and exact Undo/Redo. `layout-open-space-adapter.test.ts` checks the Room-merge disclosure names competing floor/lid Finishes and the survivor records remain. |
| T8 | `apps/editor/tests/lib/project-model/surface-lineage.test.ts` — the same-size old/new orphan case returns the new identity key; both the lineage wrapper and final F4 `validateChange` gate reject newly retired identity sets. |
| T9 | `layout-room-lift-action.test.ts` checks Lift/Level reads against painted Scene bytes and history; `layout-wall-face-adapter.test.ts` checks Face/Put back likewise. |
| T10 | `apps/editor/tests/lib/project-model/surface-lineage.test.ts` — L-shaped shared-boundary membership includes only the Space’s oriented side, floor and lid; a concave-outline regression excludes a Region crossing the notch even when its vertices are inside. |
| T11 | `finish-planners.test.ts` checks Space expansion as per-Wall-side assignments in one exact Undo/Redo; the Room-divide integration above checks its later divider remains unpainted. Browser QA exercised the four-face Space consequence, visible Dark Velvet Stage rendering, Undo and Redo; screenshot attachments are in the [PR browser-QA evidence comment](https://github.com/Biskiq/spatial-sketch-editor/pull/368#issuecomment-7012390908). |
| T12 | `layout-precision-adapter.test.ts` checks the complete registered Layout planner set receives compound Scene admission, refuses a prepared candidate without lineage, and accepts explicit `[]` without changing an all-painted Scene’s canonical bytes. Topology candidate coverage is in T1–T10. |
| T13 | `apps/editor/tests/lib/project-model/scene-look-schema.test.ts` — Scene 9 is refused; duplicate, unsorted, pristine-instance, unsupported-kind and bad-side surface records are rejected. |
| T14 | `layout-room-representation.test.ts` checks Scene-aware Room materials; `layout-wall-representation.test.ts` checks both Wall sides resolve through the Scene factory again after a geometry-only rebuild; `default-wall-material.test.ts`, `material-factory-boundary.test.ts` and `test:arch` cover Stage/Visitor wiring and visitor isolation. The forced-bevel heavy matrix preserves manifold geometry and checks the default/left/right section partition, bridge pick ownership, shared `wallRanges` and complete material/pick index ranges. |
| T15 | `layout-wall-join-adapter.test.ts` compares the preview consequence to the committed report for the reversed Join; `layout-open-space-adapter.test.ts` checks Erase's Room-merge preview exposes the matching floor/lid lineage consequence. |

### Run results

- `npm run test:fast -w @portfolio/editor -- --maxWorkers=2`: **433 files, 5,368 tests passed** on the final implementation tree. The nine complete affected contracts also passed separately: **137 tests**.
- `npm run test:heavy`: **31 files, 138 tests passed** on review-correction head `9ab23688` in [GitHub merge-gate run 44547008907](https://github.com/Biskiq/spatial-sketch-editor/actions/runs/44547008907); the heavy lane completed with zero failed or pending tests.
- `npm run test:arch -- --maxWorkers=2`: **38 files, 350 tests passed**, including documentation references, visitor boundaries and the material-factory boundary.
- `npm run check -w @portfolio/editor`: **0 errors, 16 Svelte warnings**. `npm run build` completed successfully; Vite emitted its existing large-chunk advisory.
- `check:layout-core`, `check:project-model`, `check:api` and `build:api` passed after the follow-up changes. `check:camera-core` and `check:geometry-core` also passed on this implementation base; neither package changed in the follow-up.
- `npm run test:api`: **133 passed, 0 failed, 0 skipped**, against an isolated temporary PostgreSQL 16 container at `localhost:5543`; the container was stopped after the run.
- Browser QA on a task-owned local session exercised Plan Space Paint, the `Paint 4 Wall faces in this Space` consequence, Dark Velvet rendering on the Space-facing Wall sides in Stage, and one Undo/Redo entry. The browser reported no JavaScript errors. The three screenshots are attached to the [PR browser-QA evidence comment](https://github.com/Biskiq/spatial-sketch-editor/pull/368#issuecomment-7012390908); they are not repository files.

The broad fast run and architecture/build checks are local evidence on rebased base `cd5222fc` (PR #380 / V1d); required CI remains the integration gate. No sibling worktree or T1 V1c changes were modified. The branch remains a draft for review.
