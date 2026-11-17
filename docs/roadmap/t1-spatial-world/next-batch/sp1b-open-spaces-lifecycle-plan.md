# T1 SP1b — Open Space lifecycle: implementation plan

**Status:** draft, awaiting owner approval. **Tier 2.** This commit contains no production code.

**Capability:** `layout.space` (new). **Base:** `main` at `d596152f` (SP1a, format 8, merged as #371).

**Authority:** [SP-plan](./sp-plan-open-spaces.md) §5, §6, §10, §13–§14; the approved
[T1 next batch](./README.md#spaces) rules 1–7; the [Layout contract](../../../reference/components/layout.md).
The SP-plan is followed as written. Nothing here reopens B1–B4, the extended merge rule or any
default ratified in its §15.

## 1. Goal

An erase that removes a boundary Wall keeps the same persistent Room record as an **open Space**:
same id, name, thicknesses, overhead, object associations and surviving Wall refs, with one stated
virtual edge per erased boundary stretch. Redrawing the Wall closes it again with the same id.
Removing a shared Wall still merges, and now merges an open Space correctly. A Space that loses its
last Wall retires.

The whole lifecycle ships **behind a planner option** `openSpaces: 'retire' | 'keep'` that defaults
to `retire`, so the editor's behaviour, the existing test suite and every current call site are
unchanged. SP1c flips the default, surfaces the editor words and deletes the option.

## 2. What is already in `main` (SP1a)

Already landed and not re-implemented:

- format 8, required `virtualEdges`/`overhead`, codec closure checks (I1–I3, I6, I8 reference pass);
- `composeSpaceBoundary`, `spaceBoundaryCycleKey`, `roomBoundaryPolygon` over the composer,
  `spaceOpenSideCount`;
- compiler outline segments, floor/area/bounds, lid removal for `open-to-sky`, blocking I4/I7 issues
  (`space_outline_not_positive`, `space_outline_self_intersects`, `space_overlap`,
  `space_contains_space`), `spacePlacementIssues`;
- certified world index for open outlines and `delegate-cold` for any changed open-boundary
  Wall/Junction (`openRoomWallIdSet` / `openRoomJunctionIdSet`);
- `layout-duplicate.ts` copying `virtualEdges`/`overhead` (the record copy only — see §5.6);
- docs: Layout contract's open-Spaces section, persistence, glossary.

SP1b therefore changes **no schema, no format version, no compiled geometry and no reference doc**.

## 3. Design

### 3.1 The policy input

`reconcileRooms` gains one optional input, matching SP-plan §5:

```ts
export type SpaceLifecyclePolicy = {
  /** `retire` = today's behaviour: an unclaimed predecessor retires. */
  openSpaces: 'retire' | 'keep';
  /** Wall ids this operation removes, resolvable in `baseline`. */
  removedWalls?: readonly string[];
  /** Predecessors the operation intends to retire (Remove Room). */
  retireRoomIds?: readonly string[];
  /** What a carried Space failing I4/I7 does. Default `reject`. */
  invalidOutline?: 'retire' | 'reject';
};
```

`reconcileRooms` also returns two additive fields:

```ts
carriedRoomIds: readonly string[];          // open predecessors preserved by the carry rule
spaceRetirements: readonly SpaceRetirement[]; // why an open Space retired (for §5.4 and SP1c words)
```

`SpaceRetirement` is `{ roomId, reason, otherRoomIds?, successorRoomId? }` with reasons
`explicit-remove | last-boundary-wall | merged | outline-self-intersects | outline-not-positive |
overlaps | contains`. `retiredRoomIds` keeps its current meaning and remains the union used by
object/portal remapping.

**Where the option lives.** Only a Wall **removal** can open a Space, so the public option is on the
two removal entry points (`planDeleteWall`, `planRemoveRoom`) and on the new set form
`planDeleteWalls`. Every non-removal planner (chain, move, precision, dissolve, circular room)
passes `openSpaces: 'keep'` internally: §5.1 requires moves, splits, closure and duplicate to
preserve an already-open Space, and refusing to carry it would destroy the record on an unrelated
edit. This is the only reading that satisfies both "the option defaults to retire" and the
"Move a Junction or Wall on an open Space's boundary — Allowed" row.

### 3.2 Correspondence (F2, F3)

- **F2.** `buildCorrespondenceComponents` builds the M-3 claim map from **enclosed** predecessors
  only (`virtualEdges.length === 0`). An open predecessor's Wall-only cycle key says nothing about
  its virtual edges, so it may never claim a face by key. It can still be unioned by witness,
  overlap and the component-set authorization.
- **F3.** `CorrespondenceAuthorization.predecessorComponentKeyByRoomId` becomes
  `predecessorComponentKeysByRoomId: ReadonlyMap<string, ReadonlySet<string>>`: the set of component
  keys of the predecessor's surviving boundary Walls. `unionAuthorized` requires the face's single
  component key to be **in** that set. A space with two opposite Walls erased then closes correctly
  from either side. The defensive "neither side resolves" branch is unchanged.

### 3.3 The carry rule (replaces the "room disappearance" block)

Evaluation order, exactly SP-plan §5:

1. Face components run unchanged; a predecessor claimed by a face gets that face's boundary and
   `virtualEdges: []`.
2. `retireRoomIds` retires by intent (reason `explicit-remove`) and is applied **before** face
   classification: a forced predecessor is removed from every component, so it never survives on a
   face it would otherwise claim. If removing it leaves a candidate face with no predecessor, the
   command rejects `unsupported_component` rather than birthing a replacement Room.
3. If `openSpaces === 'retire'`, every remaining unclaimed predecessor retires as today.
4. **Carry.** For each remaining predecessor, compose its baseline boundary. Each Wall edge whose
   `wallId` is in `removedWalls` is replaced, in place, by one virtual edge between that ref's
   oriented ends; existing virtual edges stay in their gap order. Surviving Wall refs keep their
   persisted order and directions. This is one pure function over the composer, so adjacent erased
   Walls keep the intermediate Junction (R0 is not reintroduced).
5. **Open merge.** If a removed Wall is referenced by two carried predecessors, splice their cycles
   at that Wall's ends into one Space (§3.4). A Wall referenced by three or more carried Spaces
   rejects `unsupported_component` (parity with today's 3+→1).
6. **Support.** A carried Space with no surviving Wall ref retires (`last-boundary-wall`); its
   virtual edges and any Junction only it referenced go.
7. **Outline gate.** Provisional candidate rooms = face results + carried results. Each **carried**
   Space is checked with the SP1a predicates (positive signed area, `spaceOutlineSelfIntersects`,
   `spacePlacementIssues`). A failure either retires it (reason) or rejects
   `space_outline_invalid` with the Space id and failed invariant, per `invalidOutline`.
   Carried Spaces are evaluated in baseline document order; a retired failure is removed before the
   next is checked, so the outcome is deterministic.
8. Anchors are pruned **after** reconciliation (see §5.5): a released Junction stays when a surviving
   Wall or any final Space's virtual edge references it.

### 3.4 Open merge (ratified, §5.3)

Given carried Spaces A and B sharing removed Wall W (A traverses W `p→q`, B `q→p`):

- A's surviving edges from `q` back around to `p`, then B's surviving edges from `p` back around to
  `q`, form the spliced cycle. W becomes no virtual edge. Boundary refs and virtual edges are
  re-derived from that edge list.
- **Survivor** is `chooseMergeSurvivor` reused unchanged with a synthetic face whose polygon is the
  spliced outline; greatest overlap with the merged outline wins, exact tie by Room id. Each
  predecessor's full area lies inside the merged outline, so this is the existing rule, not a new one.
- `floorThickness`/`ceilingThickness` conflicts keep today's `metadata_merge_conflict` refusal.
  Overhead conflict: the survivor's value wins (ratified default; the consequence line is SP1c).
- The survivor emits a `merge-survivor` lineage record, so object associations and door relations
  remap through the existing maps; the retired predecessor gets reason `merged`.

### 3.5 Overhead

`planRoomMetadataUpdate` accepts `overhead: 'closed' | 'open-to-sky'`. `virtualEdges` stays refused
(correspondence-owned) alongside `boundary`; the no-op comparison includes `overhead`.

### 3.6 Remove space

New `planRemoveSpace(document, roomId, levelId)` in `layout-wall-topology-ops.ts`:

- refuses a record with no virtual edges (`not_open_space`);
- removes only the Room record; every Wall stays;
- clears `LayoutObject.roomId` for objects associated with it and clears `connectsRoomIds` on every
  Opening naming it (one vanished endpoint is **cleared**, never a guess);
- prunes only Junctions that the removed Space's virtual edges referenced and that no surviving Wall
  or other Space references (T16's scoped sweep);
- no face extraction and no reconciliation; runs the same canonical validation + compile gate;
- one history entry at the caller. The Card/Index surface is SP1c.

### 3.7 Closure, split and redraw

No new planner logic: a Wall drawn between the two ends of a virtual edge makes the Space a face, so
`buildCorrespondenceComponents` unions 1→1 by witness/overlap (and F3 authorization), and the
existing 1→1 branch writes `virtualEdges: []`. Closure, "closure wins" and B3's remainder all fall
out of one path. The carry rule never runs for a space a face claimed.

## 4. File-by-file specification

| File | Change |
| --- | --- |
| `packages/layout-core/src/layout-room-reconciliation.ts` | policy + result fields; F2 claim-map filter; F3 component-key set; carry rule; open merge; support; outline gate; `space_outline_invalid` rejection code; docs for the new order. `RoomBoundaryLookup` unchanged. |
| `packages/layout-core/src/layout-space-outline.ts` | **new** home for the pure outline predicates (`spaceOutlineSignedArea`, `spaceOutlineSelfIntersects`, `polygonContainsPolygon`, `spacePairIssue`). It imports only coordinates, face predicates and robust orientation, so `layout-room-reconciliation.ts` can use it without importing `layout-space-placement.ts`. |
| `packages/layout-core/src/layout-space-placement.ts` | keeps the document-level `spacePlacementIssues`/`isOpenSpace` and re-exports the moved predicates, so the SP1a public surface is unchanged. It imports the outline module and `roomBoundaryPolygon`; nothing imports it from reconciliation. |
| `packages/layout-core/src/layout-wall-topology-ops.ts` | `planDeleteWall(..., options?: { openSpaces })`; new `planDeleteWalls(document, wallIds, capture, levelId, options?)`; removal pipeline reconciles before pruning; junction pruning includes final virtual edges; `planRemoveRoom(..., options?)` passes `retireRoomIds` and `invalidOutline: 'reject'`; `planDeleteWall` passes `invalidOutline: 'retire'`; `RoomMetadataPatch.overhead`; new `planRemoveSpace`; plan results carry `spaceRetirements`; rejection codes `not_open_space`, `space_outline_invalid`. |
| `packages/layout-core/src/layout-wall-chain.ts` | `reconcileRooms` call passes `{ openSpaces: 'keep' }` (non-removal). No public option, no behaviour change for enclosed docs. |
| `packages/layout-core/src/layout-wall-dissolve.ts` | refuse when the dissolved Junction is the start or end of any `virtualEdges` entry: new code `open_side_ends_here`, message **An open side ends here**; reconcile passes `keep`; open predecessors are carried, not faced. |
| `packages/layout-core/src/layout-circular-room.ts` | reconcile call passes `{ openSpaces: 'keep' }`. |
| `packages/layout-core/src/layout-room-isolation.ts` | `collectBoundaryGraph` validates and includes every virtual-edge endpoint in `junctionIds`; `connectedRoomIds` treats those Junctions as part of the Room's connectivity, so a group move takes them and a stationary Wall touching one refuses isolation. |
| `packages/layout-core/src/layout-room-move.ts` | `roomBoundaryCycleKey(document, room)` switches to `spaceBoundaryCycleKey`; components skip open rooms; identity assertion counts `carriedRoomIds` and compares composed keys + virtual edges for carried Rooms; reconcile passes `keep`. |
| `packages/layout-core/src/layout-wall-first-precision.ts` | reconcile passes `keep` and skips open rooms in the declared 1→1 components (they are carried); identity assertion counts carried Rooms and compares composed keys; `validateWallFirstTopology` composes an open Room's boundary instead of requiring a Wall-only chain, and its short-boundary gate uses the composed polygon; `planExactRectangleDimensions` refuses any open Space with `unsupported_geometry`; `PrecisionRejection` gains `space_outline_invalid`. |
| `packages/layout-core/src/layout-duplicate.ts` | no record-copy change (SP1a); isolation now supplies virtual-edge Junctions, so the existing remap is complete. |
| `apps/editor/tests/lib/layout/sp1b-open-spaces-lifecycle.test.ts` | **new** lifecycle suite (§5). |
| The two S2 spike files under `apps/editor/tests/lib/layout/spikes/` (`s2-space-conversion.*`) | **deleted** once their production cases live in the SP1b/SP1a suites (SP-plan §13 acceptance). |
| existing tests | mechanical updates only where the F3 authorization shape and the `roomBoundaryCycleKey` signature changed. |

No change: codec, geometry compiler, geometry delta, world index (already delegates), plan
representation, editor src, visitor, docs/reference. The editor is not wired in SP1b.

## 5. Checks

### 5.1 §5.1 lifecycle table — one core test per row, through the real planner

Suite `sp1b-open-spaces-lifecycle.test.ts`, fixtures: `gallery()` (6×4 enclosed Room, one Opening, one
associated object, non-default thicknesses), `twoRooms()` (shared Wall), `threeRooms()`,
`openRectangle()` (one Wall + three virtual edges), `openU()` (three Walls + one virtual edge),
`lShape()`.

| SP-plan §5.1 row | Planner | Assertion |
| --- | --- | --- |
| Erase outside Wall of enclosed Room | `planDeleteWall(..., { openSpaces: 'keep' })` | same id/name/thicknesses/overhead; object keeps `roomId`; one virtual edge between the erased Wall's ends; area 24 m²; erased Wall's Opening gone |
| Erase second outside Wall, adjacent | same, twice | two virtual edges; intermediate corner Junction survives with no Wall; `spaceOpenSideCount === 1`; area 24 |
| Erase second outside Wall, opposite | same | two virtual edges; surviving Walls have different component keys; area 24 |
| Erase the last Wall | same | `retiredRoomIds` + `spaceRetirements` = `last-boundary-wall`; object `roomId` cleared; no Room |
| Erase a Wall between two enclosed Rooms | `planDeleteWall` (default policy) | unchanged 2→1 merge; byte-identical to the base-commit result |
| Erase a Wall between open Space and any Space | `planDeleteWall(..., keep)` then shared Wall | one open Space, survivor deterministic, no coincident virtual pair; overhead/thickness policy |
| Erase a set joining 3+ Spaces | `planDeleteWalls` | `unsupported_component`, document unchanged |
| Draw a Wall exactly along a virtual edge | `planWallChain` + junction snaps | face appears; same id; `virtualEdges` empty; reads Room; area unchanged |
| Draw Walls enclosing by another path | `planWallChain` around the gap | Space takes the new (larger) face; virtual edges gone; same id; area stated by the compiled floor |
| Draw a Wall dividing an open Space | `planWallChain` with host snaps | Space becomes the enclosed Room (B3); remainder is unnamed ground; no second Room |
| One stroke encloses two faces inside an open Space | `planWallChain` (existing 1→2 shape) | existing 1→2 split; survivor keeps id as a Room |
| Draw a Wall across/ending on a virtual edge, closing nothing | `planWallChain` | Space unchanged; new Wall free-standing; virtual edges untouched |
| Draw along part of a virtual edge from one end | `planWallChain` | pre-SP1d behaviour: Wall free-standing, Space unchanged, same endpoints |
| Move a Junction or Wall on an open boundary | `planExactJunctionMove` / `planRigidWallMove` | allowed, area changes, id preserved |
| Move that would self-cross the outline | `planExactJunctionMove` | refused; input document byte-identical; no history entry |
| Split a boundary Wall | `planWallSubdivision` | Room identity and virtual edges unchanged |
| Join at a Junction where a virtual edge ends | `planDissolveJunction` | `open_side_ends_here`, message "An open side ends here" |
| Move or rotate a Space | `planWallFirstRoomMove` / `planWallFirstRoomRotation` | all Walls and virtual-edge Junctions travel; two-component Space stays whole; area preserved |
| Duplicate an isolated open Space | `planDuplicateIsolatedRoom` | remapped virtual edges + same overhead; source untouched; copy area equals source |
| Exact rectangle dimensions on an open Space | `planExactRectangleDimensions` | `unsupported_geometry` |
| Remove space | `planRemoveSpace` | record removed; Walls stay; object cleared; door relation cleared; only released anchors pruned |
| `planRemoveRoom` on enclosed Room with shared Walls | `planRemoveRoom` | target retires (not merged); neighbour keeps id; unchanged portal rules |
| Destructive erase would invalidate a Space (self-cross / overlap) | `planDeleteWall(..., keep)` | Wall erased, Space retires with the named reason, one history entry, exact Undo |
| Non-erase operation would invalidate a Space | move / chain / duplicate | atomic refusal; byte-identical document; no history entry |

### 5.2 Other required checks

- **Inert default.** The complete existing suite is green with no test edits beyond §4's mechanical
  signature updates; every current delete/merge/retire expectation is unchanged.
- **B1 vs §5.4 separation.** A parameterised case proves the same invalid geometry retires through
  `planDeleteWall` and refuses through `planExactJunctionMove`.
- **F2, F3.** (a) An open U whose free ends are dragged together so the Walls close with identical
  refs still closes through evidence, never by key. (b) Opposite Walls erased, one redrawn, then the
  other: same id throughout. (c) An L-shaped open Space whose witness falls outside the naive
  triangle still keeps its identity (composer polygon at every caller).
- **Merge.** Open + enclosed and open + open both splice; thickness conflict rejects; overhead
  conflict keeps the survivor's value.
- **I8 / T16.** After erase → open → last Wall → Remove space: no orphan anchor is left, and a
  pre-existing unreferenced Junction elsewhere is untouched.
- **Undo/Redo.** `AuthoringHistory` restores exact canonical bytes for erase → open → redraw; replay
  with the same capture is byte-identical, replay with a different capture keeps the same Space id.
- **S2 deletion.** Every production case the S2 spike asserted (identity, composer area, certified
  index, closure, last-Wall retirement, shared-Wall merge, undo/redo determinism) is present as a
  production test before the stub is deleted.

### 5.3 Verification commands

From `apps/editor`:

```sh
npx vitest run tests/lib/layout/sp1b-open-spaces-lifecycle.test.ts
npx vitest run tests/lib/layout/sp1a-open-spaces.test.ts
npx vitest run tests/lib/layout/layout-room-move.test.ts tests/lib/layout/layout-room-duplicate.test.ts \
  tests/lib/layout/layout-wall-delete.test.ts tests/lib/layout/layout-wall-dissolve.test.ts \
  tests/lib/layout/layout-wall-chain.test.ts tests/lib/layout/layout-p23b3a-d12-hazard.test.ts \
  tests/lib/layout/p23b11-conditional-mechanisms.test.ts
npm run check
npm run check:layout-core
npm run test:arch
```

Full `test:fast` / `test:heavy` and the build are the PR gate (CI), not duplicated locally unless a
failure needs reproduction. Any existing test that changes must be named in the PR with the reason.

## 6. Scope

**In:** everything above; the planner option; the two new planners (`planDeleteWalls`,
`planRemoveSpace`); `overhead` metadata; the lifecycle tests; deletion of the S2 spike.

**Out (SP1c/SP1d as scheduled):** flipping the default or deleting the option; editor intents,
consequence lines, Card/Index words, Overhead control, selection, open-side handles, dashed ink,
Remove-space UI; open-side handles and partial-wall absorption; visitor changes; docs promotion;
SP2/SP3.

## 7. Interpretations recorded (no settled decision reopened)

1. **Option placement.** `openSpaces` is a public option on Wall removals only; other planners pass
   `keep` because §5.1 requires them to preserve an existing open Space. At `retire`, a document that
   already contains an open Space would retire it on a removal — unreachable in the shipped editor,
   which cannot create one until SP1c.
2. **Set erase.** §5.1's "erase a set that would join three or more Spaces" has no reachable planner
   today (`planWallRemovalSet` is private). SP1b exposes `planDeleteWalls` as the set form of the same
   authority so the row is tested through a real planner; `planDeleteWall` delegates to it.
3. **`invalidOutline` by operation.** `planDeleteWall`/`planDeleteWalls` pass `retire`;
   `planRemoveRoom` passes `reject`, because §5.4 says Remove Room is not a destructive Wall erase and
   must refuse if removing its exclusive Walls invalidates a different Space.
4. **Carry records.** Carried Rooms are reported through `carriedRoomIds`, not fake face lineage; an
   open merge emits the existing `merge-survivor` record so object/portal remapping is reused.
5. **Authorization shape.** F3 changes the exported authorization field to a set. Existing tests that
   read the single key are updated mechanically (`.has(...)`); no product consumer exists.
6. **`roomBoundaryCycleKey`** gains the document argument so it can compose virtual edges. Test call
   sites are updated; the exported name is kept.
7. **Outline-gate ordering.** Carried Spaces are checked in baseline document order, each retired
   failure removed before the next check.
8. **Docs.** No reference edit: SP1b is inert and SP1c promotes the creator-facing lifecycle contract,
   as the SP-plan schedules.

If any of these is not the intended reading, this is the point to say so; otherwise approval of this
plan approves them as written.

## 8. Risks and rollback

- **Reconciliation is the most delicate module.** Containment: the `retire` default leaves every
  existing path byte-identical, and the complete suite must stay green before any lifecycle test is
  added.
- **Merge splice** is new geometry assembly. It is exercised by both mixed pairs and opposed by the
  3+ refusal; a failure is a rejection, never a partial write.
- **Curved-Wall chord changes area** (ratified). The B1 test uses a genuinely curved Wall because a
  straight chord equals its Wall.
- **Rollback.** Revert SP1b alone: the option disappears and the default behaviour is already today's,
  so no saved format-8 document becomes unreadable.

## 9. Owner clarifications (approved)

Two constraints were added at approval. Both are incorporated above; neither changes scope.

1. **Forced retirement overrides a face claim.** `retireRoomIds` is applied before component
   classification, so a predecessor the operation explicitly retires cannot be preserved by a
   candidate face (a 2→1 component becomes 1→1 in favour of the other predecessor). Regression
   coverage includes `planRemoveRoom` on a Room that shares a Wall, plus the case where the target
   and a neighbour would both claim one face. A face left with no predecessor refuses
   `unsupported_component`; the operation never silently births a Room in place of the removed one.
2. **One outline authority, no dependency cycle.** The pure outline predicates move to
   `layout-space-outline.ts`; `layout-room-reconciliation.ts` imports only that module, and
   `layout-space-placement.ts` keeps the document-level gate and re-exports the moved API. The
   import direction stays `placement → reconciliation → outline → face predicates`; no module
   imports its consumer.
