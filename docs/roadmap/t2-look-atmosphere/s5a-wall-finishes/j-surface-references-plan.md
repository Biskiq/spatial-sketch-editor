# J — Surface references and lineage (T1 × T2), first commit of S5a

**Status:** Tier 2 plan, awaiting owner rulings in §11. This is planning only. It adds no
production code, no schema, no fixture and makes no edit to an approved roadmap.
**Capabilities:** `look.surface-finish` *new* (S5a, S5b). T1 obligations are recorded against
existing T1 ids.
**Base:** `main` at `c0a7c92e`. Line references were read at this commit and will drift.

**Authority.** The T2 proposal ([§10](../README.md#10-coordination), D1, D2, S5a/S5b rows) and the
T1 next batch ([T1–T2 contract](../../t1-spatial-world/next-batch/README.md#t1t2-contract), Q3,
Q13, Q14, Q17, Q18, Lane D row **J**). Also the SP-plan (§§3.3, 5, 11, 16), the V-plan (§5.6,
§5.7, §14 H-8), the C-plan (§5), A1 #296, A2 #308 and A5 #348. Where a sentence here differs from
one of those sources, the difference is listed in §11 as an owner ruling. This plan never resolves
such a difference silently.

**Goal.** S5a can be implemented without inventing anything, and SP1, V1 and C can land later
without reconciling against T2.

## 0. Summary

| # | Question | Answer here |
| --- | --- | --- |
| 1 | Surface identity | `LayoutSurfaceRef`: the authored source id plus a fixed role. It is typed, owned by Layout and opaque to T2. It is never compiled (§2) |
| 2 | Finish ownership | Scene `surfaceFinishes`, one record per surface, in the Scene unit 10 bump. Layout stays appearance-free (§3) |
| 3 | Lineage | Layout planners return `surfaceLineage`, a precedence map from new surfaces to old ones. One Scene-owned function applies it. There is one table per operation (§4) |
| 4 | Unresolved | `present`, `dormant` or `retired` is read from authored Layout only. A retired assignment is pruned in the same acceptance. A dormant one is kept and comes back when its role returns. Viewing readings never count (§5) |
| 5 | Atomic history | Already possible: history stores whole-envelope states, and compound planners exist. Every Layout planner becomes `compound, writes: ['scene']` through one wrapper (§6) |
| 6 | Space scope | `surfacesOfSpace`, a Layout query over the oriented boundary. It expands to per-surface assignments when the gesture is made (§7) |

## 1. Verified facts (code at `c0a7c92e`)

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

Layout-owned, in a new `packages/layout-core/src/layout-surface.ts`:

```ts
export type LayoutWallSide = 'left' | 'right'; // about the Wall's canonical left normal (V11)

export type LayoutSurfaceRef =
	| { readonly kind: 'wall-side'; readonly wallId: string; readonly side: LayoutWallSide }
	| { readonly kind: 'room-floor'; readonly roomId: string }
	| { readonly kind: 'room-lid'; readonly roomId: string };
// Added by the first slice that paints a region (V1 + S5b), with its own Scene bump:
//	| { readonly kind: 'region-face'; readonly regionId: string; readonly face: 'top' | 'underside' | 'edge' };
```

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

The same function runs during proposal (preview) and during commit, so a consequence line cannot
disagree with the result.

**Per operation.** In this table S is the survivor, N the new Wall, O the retired Wall and R the
Room. `S.l` means `wall-side S left`. "↦" is orientation-mapped by Layout.

| Operation | Approved rule | Entries | Producer seam | State |
| --- | --- | --- | --- | --- |
| Split (A1) and noding by a drawn Wall | The new Wall inherits both sides | `N.l ← [W.l]`, `N.r ← [W.r]`. W keeps id and direction (V7) | `NodingPlanSuccess` (`createdWallIds`, `splitWallIds`); `split-planners.ts`, `drawing-planners.ts` | Landed planner, adds output |
| Join (A2) | The survivor's finish wins, with the consequence named and Undo | For each side x of the joined Wall: `S.x ← [S.x↦, O.x↦]`. When S is reversed (V8), `S.l ← [S.r, …]` | `planDissolveJunction` exposes `survivorForward` and `otherForward` (`:293`) | Landed, adds output. OD-J1 |
| Duplicate (A4, A5) | The copy carries the same shared Finish | `C.x ← [src.x]` for each copied Wall side. `copy-room floor/lid ← [src floor/lid]` | `DuplicatePlan` exposes `wallIdMap` and the source Room (V9). Copies keep direction (asserted by test T5) | Landed, adds output |
| Divide a Room | The new Room's floor inherits | `new.floor ← [R.floor]`, plus `new.lid ← [R.lid]` if OD-J3 is accepted. **The new divider gets nothing** (C-plan §5) | `RoomLineageRecord` `created` with `predecessorRoomIds` (V10) | Landed, adds output |
| Enclosed merge (erase a shared Wall) | Survivor wins, as for an open merge | `S.floor ← [S.floor, A.floor]` and the same for `lid` | `merge-survivor` record | Landed, adds output. OD-J1 |
| Open a Room (SP1) | Nothing changes | No entries. The erased Wall's sides retire. Floor and lid refs keep the Space id | SP1 | **SP1 owes it** |
| Open merge (SP1) | The survivor's floor finish wins | As for an enclosed merge | SP1 | **SP1 owes it** |
| Close along a virtual edge (SP1) | — | No entries. The new Wall is unpainted | SP1 | **SP1 owes it** |
| Attach, Release, repack (C) | Every arc inherits; repack follows the seam-side survivor under Q17 | Attach as for Split. Repack as for Join | C1–C3 | **C owes it** |
| Regions (V1) | Duplicate carries; removal is unresolved; there is no split or merge | `copy.face ← [src.face]` | V1 planners | **V1 owes it** |
| Erase a Wall, remove a Room, Remove space | — | No entries. Assignments are pruned in step 3 | — | Automatic |
| Move, rotate, length, height, arc, Opening and rename edits | — | None | — | No change |
| **Any planner that keeps a Wall id but reverses its direction** | Must not swap finishes silently | `W.l ← [W.r]`, `W.r ← [W.l]` | Layout planners | Rule. Test T4 |

Each T1 slice that adds or changes a topology planner states its rows in the PR description (the
lineage duty in `implementation-prs.md`) and adds the matching T-row in §10. This plan is the
**request** that "No lineage field is added … before that plan asks for it" was waiting for.

## 5. Contract C4: unresolved references

`resolveLayoutSurface(document, ref)` is Layout-local, reads **authored** data only and returns:

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
  read, it renders the default and it is excluded from reach. Acceptance **refuses a candidate that
  increases** the number of `unresolved-surface` diagnostics (`surface_reference_orphaned`). A
  loaded file still opens, but no edit can create an orphan.

## 6. Contract C5: atomic history

- `layoutPlanner(kind, prepare)` in `precision.ts` becomes the single compound wrapper:
  `admission: { domain: 'layout', compound: true, writes: ['scene'], units: false, resources: false }`.
  Its `prepare` returns `{ outcome, surfaceLineage }`, and the type makes `surfaceLineage` required.
  A non-topology planner returns `[]` explicitly, so there is no default that could hide a missing
  row.
- The wrapper runs `applySurfaceLineage` on the prepared envelope, installs the Scene unit only if it
  changed, and appends one `OperationChange { kind: 'scene-surface-lineage' }`. One candidate means
  one acceptance and **one** history entry. Undo restores the prior envelope byte-exactly and Redo
  replays the captured ids (V4).
- A Scene-only Paint planner (`domain: 'scene'`) reads Layout from the snapshot to check that each
  target is `present`. Face scope writes one record. Space scope writes N records in one entry.
- No Layout planner writes Scene any other way. A Scene planner never writes Layout.

## 7. Contract C6: Space paint scope

`surfacesOfSpace(document, roomId): { surfaces: readonly LayoutSurfaceRef[]; excluded: readonly { ref; reason }[] }`
and `spaceOfSurface(document, ref)`. Both are Layout queries in `layout-surface.ts`.

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

| Area | Owner | Files |
| --- | --- | --- |
| `LayoutSurfaceRef`, `surfaceKey`, `resolveLayoutSurface`, `surfacesOfSpace`, `spaceOfSurface`, `wallSideAt` | T1 (Layout) | new `layout-core/src/layout-surface.ts` |
| Lineage output from landed planners | T1 | `layout-wall-noding.ts`, `layout-wall-dissolve.ts`, `layout-duplicate.ts`, `layout-room-reconciliation.ts` (expose; no behaviour change) |
| F.1 `componentId` admission | T1 | `project-model/src/references/unit-resolution.ts` |
| Compiled face tags | T1 | Layout compiled Wall and Room output; `wall-mesh-builder.ts` classification |
| `surfaceFinishes`, codec, Scene 10, `applySurfaceLineage`, the reach change in `usersOfFinish` | T2 (Scene) | `scene.ts`, `units/types.ts`, `units/validate.ts`, `scene-planning/surface-lineage.ts`, `finish-model.ts` |
| Compound wrapper | Joint | `adapters/layout/precision.ts` |
| Paint for surfaces, Face and Space scope, consequence lines, render lookup, visitor parity | T2 | `layout-contributions.ts`, `stage/facade/adapter-contract.ts`, the render layer |

**One PR, as Q18 requires.** Commit 1 is this plan. The T1 half comes next as separate commits with
a T1 review: it is behaviour-neutral, makes no format change, and any T1 change it needs is
reported rather than assumed. The T2 half follows. In-flight T1 slices (SP1, V1, C) add their
lineage rows and tests as part of their own acceptance.

## 10. Discriminating tests

| # | Test | It fails if |
| --- | --- | --- |
| T1 | Split a Wall with both sides painted differently. N carries both, with no swap. One Undo restores the envelope byte-exactly and Redo reproduces the ids and assignments | Lineage is lost, sides are swapped, or there are two history entries |
| T2 | A Wall drawn across a painted Wall nodes it. Every fragment carries the source's sides | The noding path skips lineage |
| T3 | Join where S is painted and O is painted differently: S's finish is kept and `report.replaced` names O's. Join where S is unpainted and O is painted: carried under OD-J1 (or unpainted under the alternative) | The survivor policy is read from geometry or length |
| T4 | **Head-to-head Join (V8):** the smaller-id survivor started at the Joint. Its `left` assignment ends on the face that was left in world space | An id-preserving reversal swaps finishes |
| T5 | Duplicate a painted Room with a shared Wall (A5). The copy references the *same* `materialInstanceId`. Editing that Finish with "shared" reaches both | A Finish is cloned, or reach omits surfaces |
| T6 | Divide a painted Room. The new Room's floor inherits; the lid inherits per OD-J3; both divider sides are unassigned | Coverage is treated as inheritance |
| T7 | Erase a painted Wall. Its assignments are gone in the same entry, Undo brings them back, and `unresolved-surface` stays 0 | Orphans are retained, or the prune is a separate entry |
| T8 | A candidate envelope with an injected retired assignment is refused with `surface_reference_orphaned`. A *loaded* one opens with the diagnostic and renders the default | The orphan rule bricks loads, or lets edits through |
| T9 | Lift, Level cut and Face over painted surfaces leave status, Scene bytes and history unchanged | A viewing reading writes or unresolves |
| T10 | `surfacesOfSpace` on an L-shaped Room with a dividing Wall returns exactly its own sides (forward→left, reverse→right), floor and lid. The neighbour's side of the shared Wall is excluded | Membership is derived from geometry, or both sides are included |
| T11 | Space-scope Paint, then a divider drawn: the divider stays unpainted. One Undo removes all N records | Scope is stored as a live rule, or there are N entries |
| T12 | Every registered Layout planner kind runs on an all-painted fixture: no `surface_lineage_invalid`, no orphan, and an explicit `[]` from non-topology kinds | A new planner skips the wrapper |
| T13 | Codec: format 9 is refused; an unsorted, duplicate, pristine-instance, unknown-kind or bad-side record is refused | The normal form drifts |
| T14 | Visitor parity: a painted World in the cold release renders the same Finishes, and no editor module reaches the visitor chunk | The visitor needs editor code |
| T15 | Preview and commit agree: the Join consequence line equals `report.replaced` of the committed envelope | The preview recomputes on its own |
| T16 | `room-lid` after SP1: Open to sky makes it `dormant` (not rendered, kept), Closed brings it back with no write. **Added by SP1** | The lid is pruned or re-created |

## 11. Owner rulings

| # | Decision | Recommendation | Blocks |
| --- | --- | --- | --- |
| **OD-J1** | Join or merge when the survivor's side has **no** Finish and the absorbed one has one | **Carry the absorbed Finish** (`from: [S, O]`). "Survivor's finish wins" then still holds when both are painted, and nothing is lost when only one is. The alternative, strict survivor state, reads Q17 literally and loses the paint | S5a (Join) |
| **OD-J2** | Which regions belong to Space scope | **Wholly contained only**; a straddling region is excluded and named. Predictable, in the spirit of Q14. The alternative is the V-plan's any-overlap reading | S5b with V1 |
| **OD-J3** | Divide a Room: does the new Room's **lid** inherit as well as its floor? | **Yes**, by the same reasoning as the floor row | S5b paint, but the lineage is emitted in S5a |
| **OD-J4** | A retired reference: prune it in the same acceptance, or keep it as a diagnostic like `unresolved-view`? | **Prune** (§5). Ids never recur, so a kept record is permanent garbage that distorts reach | S5a |
| **OD-J5** | What S5a's Scene 10 admits, and what it paints | **Admit `wall-side`, `room-floor` and `room-lid`** (all resolvable today, so S5b needs no bump). **S5a paints Wall sides only**, which is the approved slice scope. Floor and lid Paint UI ship in S5b. `region-face` waits for its own bump after V1 | S5a codec |
| **OD-J6** | Wall tops, caps and Opening reveals | **No reference and the Layout default in S5a**. No control is shown (D18). Per-face painting is later work | S5a render |

## 12. Readiness, risks and out of scope

**Readiness.** S5a can start once OD-J1, OD-J4 and OD-J5 are answered. Its specification needs no
other invention: OD-J6 has a default that implementation can proceed on, and OD-J2 and OD-J3 do not
gate S5a's Wall-side scope. T1 owes the §9 Layout half, which is behaviour-neutral. SP1, V1 and C
inherit duties, not open questions.

**Risks.**

1. Making every Layout planner compound changes its registration. Any test registry without the
   compound grant must be updated in the same PR, which T12 catches.
2. Mitre bridges and lintel strips must carry the right side tag. Getting this wrong shows as a
   seam, so it needs a focused browser check.
3. Before SP1, a Wall side referenced by two Rooms makes Space scope refuse rather than guess.

**Out of scope.** Finish storage code, Layout schema changes, Paint UI design beyond the refusals
listed here, per-face painting on forms (T5), mapping overrides, persistent hosting of objects on
surfaces, and anything that changes V1–V3, SP or C planning.
