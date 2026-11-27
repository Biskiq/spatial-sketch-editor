# T2.G1 · Groups

**Status:** draft implementation plan for review. It covers the G1 slice of the
[T2 planning baseline](../README.md#capability-slices) and turns D12 and §5 *Groups* into operations,
selection rules and acceptance criteria. It grants no implementation permission beyond G1 and
creates no authority beside [Scene](../../../reference/scene.md) and the
[design system](../../../design-system.md). Written against main `f1ad6d506` (Scene 12).

**The slice in one line.** A group is the existing flat cluster made selectable and rigid: click
selects the group, a second click selects the member, and Move, Turn, Duplicate and Erase act on
every member at once. Members keep their world transforms and visitors render them as if they were
ungrouped.

| Commitment | Scope |
| --- | --- |
| Deliver in G1 | Group and Ungroup, group-first selection with member drill-down, rigid Move and Turn, group Duplicate and Erase, the group Card and its Index row, *Group with …* after *Light it*, *Light it* on a group, and the Showcase rig |
| Establish for extension | One pure rigid-pose helper, one hit-to-target selection mapping, one clone-with-remap core and one closed insert union. Fixture models, saved rigs and T5 assemblies reuse these later without a second mechanism |
| Leave out | Nesting, shared strata on the group Card, group Lift or scale, live-linked rigs, a rig library, persistent hosting, and any parent transform |

## 1. What exists on main

Most of the model is already in place. The missing parts are any operation that writes a group, any
rigid multi-entity operation, and every piece of the UI.

| Existing behaviour | Consequence for G1 |
| --- | --- |
| `SceneObjectCluster {id, name, memberIds}` in the Scene unit. The codec refuses fewer than two members, duplicates, unknown members, multiple membership, `roomId`, and **Artwork members** (`invalid_cluster_member`, added by A1 #294). [codec](../../../../packages/project-model/src/scene-codec/parse-document.ts) | The record is reused unchanged. Lifting the Artwork refusal is a validation change, so **G1a bumps Scene 12 → 13**. The T2 batch table listed G1 as format-neutral; that was written before A1 added the refusal |
| `cluster` is already an F.1 Scene subject. Members resolve by their own id and never through a cluster path. [resolver](../../../../packages/project-model/src/references/unit-resolution.ts) · `references-conformance.test.ts` | Selecting a group needs no new reference kind. The selection is `scene/cluster/<id>` and a member is `scene/entity/<id>` |
| [Record scope](../../../../packages/project-model/src/scene-planning/record-scope.ts) forbids any operation from creating a cluster, changing its fields or dropping it. The only exception is the `allowClusterCleanup` path of `delete-one` | Extend the scope with declared cluster changes rather than adding a bypass (§3) |
| Every Scene planner writes one entity. `duplicate-one` and `duplicate-light` refuse cluster members; `delete-one` prunes membership and drops a cluster that falls below two. [lifecycle](../../../../packages/project-model/src/scene-planning/operations/lifecycle.ts) · [lights](../../../../packages/project-model/src/scene-planning/light-operations.ts) | Member-level behaviour is already correct and is kept. Group-level operations are new compound planners |
| Transform paths differ by kind. Floor objects use `move-horizontal`/`set-yaw` and re-resolve support. Lights use `update-light`, and Artwork uses `artwork-transform`; neither has floor contact. Stored rotation is Euler XYZ, the renderer's order. | A rigid group move has to respect each member's own rule. Turning an aimed light about world Y is not a yaw add, so the rotation has to be composed (§3.2) |
| [Selection](../../../../apps/editor/src/lib/authoring/stage/semantic-selection.ts) is an ordered list with a primary. Every Stage, Plan and Index producer [replaces the selection with one subject](../../../../apps/editor/src/lib/authoring/stage/route/stage-shell-selection.ts). Pointer presses go to the primary selection's domain adapter. | **No creator gesture can build a multi-selection today.** S7's "several works, one Wash" path is reachable only from tests. G1 has to add a set selection before anyone can Group |
| The visitor and the render description never read `clusters`. The runtime projection carries them. [runtime](../../../../packages/project-model/src/units/runtime.ts) | Runtime parity is a regression proof, not new runtime work |
| [`cluster-obb.ts`](../../../../apps/editor/src/lib/authoring/scene/cluster-obb.ts) (a PCA box over member roots) and [`scale-vector.ts`](../../../../apps/editor/src/lib/authoring/scene/scale-vector.ts) have no importers | G1b either adopts `cluster-obb` as the group boundary mark or deletes it, whichever the approved mark requires. `scale-vector` is deleted because G1 adds no group scale |
| [Scene contract](../../../reference/scene.md#entity-kinds) says “a full cluster is duplicated as a cluster; a partial member selection is ungrouped with a warning” | No code does this. G1a replaces the line with the behaviour below |

## 2. Behaviour

### 2.1 Membership

- **Admissible members:** a model, a form, a box/cylinder/sphere primitive that the floor-transform
  gate admits, a light, or an Artwork. A vertical plane, a tilted primitive or a form without
  contact refuses Group with the member named. Each of these already refuses Move on its own, and
  joining a group must not give it a capability it does not have. This is
  `floorTransformSupport(entity).supported || kind ∈ {light, artwork}`, reusing the planners' own gate.
- **One level only** (§14 *Group nesting*, adopted): Group refuses a subject that is already a
  member (*Ungroup “Still life” first*). There is no add-member or merge operation. *Group with …*
  is hidden when either party is already grouped, so a Showcase rig cannot silently absorb its
  subject.
- **Default name:** `Group`, `Group 2`, … chosen by the editor's existing `nextEntityName` and
  carried in the intent; renaming uses the same `SCENE_NAME_LIMIT`. The Showcase rig is named `Showcase` the same way.

### 2.2 Selection and drill-down

One pure function, `selectionTargetForHit(hit, selection, scene)`, owns the mapping. The Stage,
Plan/Paper, hover and Erase all call it.

| Gesture | Current selection | Result |
| --- | --- | --- |
| Click a member body of group G | Anything other than G or one of its members | Select **G** |
| Click a member body of G | G, or any member of G | Select **that member** (drill-down; sibling to sibling stays drilled) |
| Click an ungrouped subject | — | Unchanged: select it |
| Shift-click (Stage, Plan, Index row) | — | Toggle the mapped target in the ordered set; the last added becomes primary |
| Esc with no live gesture | A drilled member | Select its group (drill up) |
| Esc with no live gesture | G | Clear (unchanged) |
| Index group row / member row | — | Select G / the member directly |
| Hover over a member | Not drilled into G | Hover cue on every member of G |

- Drill-up is one more rung on the existing Escape ladder (`compileEscapeLadder`), below every
  gesture, placement and palette owner that already claims Escape.
- After **Group**, the selection is the new group. After **Ungroup**, the selection is the former
  members as a set with the first member primary. After **Duplicate**, it is the copy.
- A **loose set** (shift-built, not a group) is an explicit supported set under the design-system
  rule. It offers exactly **Group**, **Light it** and Clear. Move, Duplicate and Erase on a loose set
  stay unsupported and are not shown.
- **Undo/Redo** go through the existing requalification. A selected group that no longer resolves
  clears with `subject-retired`; no new rule is added.
- A press on a member body while G is selected is claimed by the Scene adapter, because the
  cluster's domain is `scene`. It starts a group drag, never the member's own drag. Light and
  Artwork adapters keep their claims only while their member is drilled.

### 2.3 Rigid actions

| Action | Group G selected | Member drilled |
| --- | --- | --- |
| Move (Stage drag, gizmo) | `scene-group-transform` with an XZ delta. Y is preserved for every member | Unchanged member move |
| Turn (gizmo) | `scene-group-transform` with yaw θ about the group pivot | Unchanged member turn/aim |
| Duplicate (Card, key) | `scene-group-duplicate`: every member and a new cluster at +0.5 m X/Z, one write | **Refused, unchanged** (*Duplicate the group, or Ungroup first*). A copy that silently left or joined the rig is the ambiguity the existing refusal guards. `artwork-duplicate` gains the same refusal |
| Erase (Card, Delete key, Erase tool) | `scene-group-erase`: members and cluster, one write; the disclosure reads *Erase group · 3 items* | Unchanged `delete-one`. A two-member group dissolves and the Card says so |
| Place on floor, Resize, Lift | Not offered | Unchanged member operations |

- **Pivot:** the centre of the XZ extent of the member **positions**. It is pure and computable from
  source alone, so the planner and preview agree without async mesh bounds. The gizmo sits at the
  pivot, at the lowest member's resting height.
- **Support:** each floor member re-resolves support at its new XZ under `move-horizontal`'s exact
  rule: its own resting elevation, or the support beneath when lifted. Lights and Artwork translate
  freely. **If any member refuses, the whole operation refuses and names it** (Scene's rule against
  silently dropping members of a set). An ambiguous support refuses the group operation rather than
  asking once per member.
- A **spot keeps its aim:** after Turn, each light's forward vector and its target point are the
  rigid image of the originals within 1e-6.

### 2.4 Card and Index

- **Group Card:** the editable name, the reading *Group · 3 items*, and a member list where each row
  selects that member. The foot holds **Ungroup**, **Duplicate** and **Erase**, plus **Light it**
  when the group contains a non-light. *Light it* on a group works on its non-light members as one
  set, so they get one Wash, and the new light is not added to the group (D12).
- **Shared strata are deferred** (decision G-2). §5 says the Card shows the strata all members
  share. No Scene writer edits one stratum across several entities in one write; Paint is
  per-object, and the Finish reach is per Finish. A read-only stratum would break D18, and a
  multi-entity stratum writer is a separate capability. The group Card shows none.
- **Member Card:** the member's own Card, unchanged, with a context line *In “Still life” · Select
  group* that drills up.
- **Group with *Still life*:** on the Card foot of a light that *Light it* has just placed for one
  ungrouped subject. One tap groups the two, and the selection becomes the group. The pairing is
  session state in the light adapter, never stored, and is cleared by any selection change or
  project epoch change.
- **Index:** each group contributes one subject row `scene:cluster:<id>` under Objects. Member rows
  stay where they are today (Objects or Lights) with a secondary reading *· Still life*. G1 adds no
  Index nesting.

### 2.5 History and runtime

- Every action above is one F4 intent and one Undo; Undo/Redo restore source exactly. A drag or turn
  is one entry. No-op, invalid and cancelled gestures write nothing. Preview equals commit within
  1e-6 m / rad, because the drag preview renders each member at the pose the planner returns.
- Visitor Preview and the published reader render a grouped Scene identically to the same Scene with
  `clusters` removed, and no group mark reaches a visitor chunk.

## 3. Model seams (G1a)

### 3.1 Declared cluster scope

Replace `allowClusterCleanup: boolean` in `SceneRecordScope` with
`clusters: { created, removed, renamed, cleanup }`, where each list names cluster ids. The checker
admits exactly the declared changes. A created cluster's members must be accepted or created
entities that are not in any other cluster. A removed cluster disappears whole. `delete-one`
declares `cleanup`, which keeps today's semantics. Every other existing planner declares nothing
and behaves exactly as before. This is a widening of the guard's vocabulary, not a bypass.

### 3.2 Rigid pose helper

`scene-planning/rigid.ts` is pure, has no `three` dependency, and is runtime-safe:

- `rigidYaw(pose, pivotXZ, θ)` returns the rotated position and composed rotation. Upright floor
  members take an exact yaw add and keep their sub-tolerance pitch/roll, as `set-yaw` does. Lights
  and Artwork use `Ry(θ)·R(xyz)` decomposed back to Euler XYZ, with a declared branch at
  |m₀₂| ≈ 1.
- Equality is tested on rotation matrices and forward vectors, never on Euler components.
- **Riskiest assumption, probed first:** a property test samples spot aims (including straight down
  and the gimbal branch) and Artwork wall poses, and asserts the round-trip and the 1e-6 aim
  invariance before any planner depends on it. The helper is also the natural home for T5.3's
  part-local pitch/roll (§5).

### 3.3 Operations

They live in one module, `scene-planning/group-operations.ts`, and are registered with the Scene
adapter's planner list (`plannerKinds` derives from it).

| Kind | Payload | Writes |
| --- | --- | --- |
| `scene-group-create` | `memberIds` (≥2, ordered as selected), captured `clusterId`, `name` | One cluster |
| `scene-group-ungroup` | `clusterId` | Removes the cluster; entities untouched |
| `scene-group-rename` | `clusterId`, `name` | Cluster name |
| `scene-group-transform` | `clusterId`, `{kind:'move', deltaXZ}` or `{kind:'turn', yaw}`, frame, captured contacts per floor member | Member poses only |
| `scene-group-duplicate` | `clusterId`, captured entity ids per member, captured cluster id, contacts | N entities + one cluster |
| `scene-group-erase` | `clusterId` | Removes N entities + the cluster |

- Each operation reuses the existing per-kind gates (`readObject`, `readContactMinY`,
  `restSupport`, `resolveSupport`, light and Artwork field validation). It does not reimplement
  them.
- Duplicate's core is `cloneMembers(scene, memberIds, idMap, offset)`. It calls the existing
  per-kind clone (`cloneEntityWithId`, the light and Artwork copies), preserves material sharing,
  and remaps by captured id, never by name or order. G1c's insert and a future saved-rig insert
  call the same core.
- Refusals use the existing codes (`missing-target`, `unsupported-transform`, `unsupported-set`,
  `invalid-value`, `no_op`) with the offending member in the diagnostics. G1 adds one code,
  `already-grouped`.

### 3.4 Format

- **Scene 13:** remove the Artwork refusal. `invalid_cluster_member` stays for a non-admissible
  kind (§2.1), so the codec and the planner gate agree. Strict refusal of every other version, with
  fixtures regenerated in the same change.
- No new cluster fields. Pivot, bounds and the group boundary are derived and never serialized.

## 4. Fixtures

- `groupedSceneFixture()` in `packages/project-model/tests/__fixtures__` builds the *still life*
  case: a form plinth, a model on it, an Artwork on a wall, and a Picture spot aimed at it, grouped
  as G. It also has an ungrouped neighbour and a second two-member group. The planner, codec,
  acceptance, render-description and editor tests all build from it, so no lane hand-writes its own
  cluster.
- The editor's counting and pick fixtures gain the grouped case once, for Stage hit and hover tests.
- G1c adds `showcaseRigFixture()` (three lights + cluster) and nothing else.

## 5. Seams kept for later, not built

| Later work | What G1 leaves for it | What G1 does not do |
| --- | --- | --- |
| **Fixtures** (D8, S8 fixture/rig track) | A fixture is an ordinary model grouped with an emitter. Inserting one is `scene-group-insert` (G1c) with a `model` variant admitted to its closed union, which runs `place-object`'s own validation | No fixture catalogue, no model variant, no empty Fixtures row (D18) |
| **Saved rigs** | A saved rig is a saved group inserted as a detached copy (§5, My Objects precedent): a library payload fed to `cloneMembers` and `scene-group-insert` | No library payload, kind or API. Live-linked rigs wait for T5.6 linked instances, arriving for objects and lights together |
| **T5.3 Object definitions** | Groups and assemblies stay distinct: a group has no root, frame or component identity, and an assembly root is one entity. An assembly root can be a group member. The root → component drill-down extends `selectionTargetForHit` rather than adding a second mapping. The rigid helper is available for component-local transforms | No third click into components; component selection stays in Object Studio. No silent group → assembly conversion. A later explicit *Make object from group* is named here only |
| **T5.4 Assembly reuse** | The same `cloneMembers` remap discipline (captured ids, no name/order matching) | No My Objects entry for groups |
| **Persistent hosting** | Members keep world poses, so a later Scene support relation applies member by member | No wall bond |

## 6. Delivery

The split follows review lanes. G1a changes a shared codec and needs the API gates. G1b is editor and
UX work against a visual target. G1c depends on G1a only, but its UI needs a target that does not
exist yet.

| PR | Accepted increment | Requires | Gates |
| --- | --- | --- | --- |
| **G1a · Group model** | §3 and §4: Scene 13, declared cluster scope, rigid helper (probe first), six planners registered and accepted through F4 with history, `artwork-duplicate` refusal, scene.md *Clusters* rewritten. It proves the operations headless and does not claim a creator journey | — | project-model + editor unit, `check:api`, zero-skip DB-backed `test:api`, version-refusal per family, `test:arch` |
| **G1b · Group interaction** | §2: set selection, the mapping and drill-down, group hover/selection marks and gizmo, group Card, Index row, Erase/Duplicate/Delete routing, *Group with …*, *Light it* on a group, ⌘G / ⇧⌘G if free in `stage-keyboard`, removal or adoption of the orphan helpers | G1a; owner approval of the UX specimen (G-4) | editor unit + mounted route, `test:arch` (visitor isolation), focused browser QA on the live Stage against the approved specimen |
| **G1c · Showcase rig** | `scene-group-insert` (closed union, `light` only) creates key, fill and rim plus their cluster in one write through `light-recipes.ts`. *Light it ▾ Showcase*. The rig is not grouped with the subject | G1a, G1b; Showcase specimen (G-4) | as G1b |

## 7. Acceptance

**G1a (headless, against the fixtures):**

1. Group/Ungroup/rename: one record and one Undo each; refusals for a single subject, an already-grouped
   subject, a vertical plane, and a missing or duplicate id. Ungroup leaves every entity byte-identical.
2. Move: every member translates by exactly the delta. Floor members re-resolve support and lifted
   members keep their lift. One member over a gap refuses the whole move, names it, and writes nothing.
3. Turn 90° and 37°: positions rotate about the pivot. Each spot's forward and target point are rigid
   within 1e-6, including straight-down and gimbal-branch aims. The Artwork stays flush with its
   rotated plane. The rigid-helper property test passes before planners use it.
4. Duplicate: N new entities plus one new cluster at +0.5 m X/Z, materials shared, ids from the
   intent. A support failure for any copy refuses the whole duplicate. `duplicate-one`,
   `duplicate-light` and `artwork-duplicate` still refuse a member.
5. Erase: members and cluster go in one write; Undo restores the identical source. A member
   `delete-one` in a two-member group dissolves it with `cluster-membership-cleaned`.
6. Record scope: every pre-G1 planner refuses a cluster create, rename or drop exactly as before.
7. Scene 13 admits an Artwork member and refuses Scene 12. Save → cold Load round-trips the grouped
   fixture, and the API save tests run with zero skips.
8. Parity: the grouped fixture's render description equals the ungrouped one, and the visitor chunk
   imports nothing new.

**G1b (live Stage, the still life journey):**

9. Click the painting → group selected (every member outlined); click again → painting drilled;
   click the spot → spot drilled; Esc → group; Esc → nothing.
10. Drag the plinth with the group selected: everything moves, the preview equals the commit, and one
    Undo puts it back. Turn 90°: the spot still lights the painting on the rendered Stage.
11. Duplicate the group along the wall: the copy is a group, selected, and lights its own painting.
    Erase it: one disclosure, one Undo.
12. Shift-click two paintings → *Light it* → one Wash, not grouped. Shift-click painting and spot →
    Group → the group is selected; the Index shows the group row and each member's *· Group* reading.
13. *Light it* on an ungrouped painting → *Group with “Painting”* → the group is selected. The offer is
    absent when either is grouped and after any selection change.
14. Plan/Paper follows the same click rules. Visitor Preview shows no mark and is pixel-identical to
    the ungrouped Scene. Reload restores the group.

**G1c:** 15. *Light it ▾ Showcase* on an object creates three lights and one group in one Undo,
none grouped with the subject. Clicking any rig light selects the rig.

## 8. Decisions

| # | Question | Recommendation |
| --- | --- | --- |
| G-1 | Group nesting (§14) | **One level.** Group refuses grouped subjects; no add or merge until a case needs it |
| G-2 | Shared strata on the group Card (§5 wording) | **Defer.** No multi-entity stratum writer exists, and a read-only stratum would breach D18. Needs owner agreement because it narrows §5 |
| G-3 | Duplicate on a drilled member | **Keep the existing refusal.** An ungrouped copy and an auto-joined copy are both plausible, so neither is silent |
| G-4 | Visual target | No approved specimen covers group selection, the group Card, set selection or *Light it ▾*. G1b adds a *Groups* section to the [World interaction sheet](../../../design-system/world-interaction-sheet.html) (marks, drill-down, Card, Index). G1c extends the [Light & Sky UX](../../../../prototypes/light-and-sky-ux/index.html) *Light it* foot with Showcase. Each is approved in its PR before the code merges |
| G-5 | Group pivot | **Centre of member-position XZ extent.** It is deterministic from source; bounds-based pivots need async mesh bounds in the planner |

**Contracts amended on landing:** Scene (*Clusters* paragraph, G1a; selection rules, G1b) and the
design-system Stage grammar (group selection and drill-down, G1b). The T2 README's G1 row is amended
by this plan.
