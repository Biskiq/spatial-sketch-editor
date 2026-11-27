# T2.G1 · Groups

**Status:** **accepted** implementation plan, revision 2. The owner has decided G-1 to G-7, Scene 13
and the coarse-pointer set interaction (§9). After this plan merges, G1a and the specimen proceed
independently and in parallel.
This plan covers the G1 slice of the [T2 planning baseline](../README.md#capability-slices) and turns
D12 and §5 *Groups* into operations, selection rules and acceptance criteria. It grants no
implementation permission beyond G1 and creates no authority beside
[Scene](../../../reference/scene.md), [Persistence](../../../reference/persistence.md) and the
[design system](../../../design-system.md). It was checked against main `f1ad6d506` (Scene 12).

**The slice in one line.** A group is the existing flat cluster, made selectable and rigid. A click
selects the group and a second click selects the member. Move, Turn, Duplicate and Erase act on
every member at once. Members keep their world transforms, and visitors render them as if they
were ungrouped.

| Commitment | Scope |
| --- | --- |
| Deliver in G1 | Group and Ungroup, group-first selection with member drill-down, normalized Shift-click sets, rigid Move and Turn, group Duplicate and Erase, member Duplicate as an independent copy, the group Card and its Index row, *Group with …*, *Light it* on a group or set, and the Showcase rig |
| Leave out | Nesting, shared strata editing, group Lift or scale, add/remove-member operations, saved or live-linked rigs, fixture models, persistent hosting, any parent transform, and any composition abstraction for T5 |

## 1. What exists on main

| Existing behaviour | Consequence for G1 |
| --- | --- |
| `SceneObjectCluster {id, name, memberIds}` in Scene 12. The codec refuses fewer than two members, duplicate or unknown members, multiple membership and `roomId`. It also refuses **Artwork members** (`invalid_cluster_member`, added by A1 #294). [codec](../../../../packages/project-model/src/scene-codec/parse-document.ts) | The record is reused. Admitting Artwork is a validation change, so the slice bumps to **Scene 13** under the strict policy |
| `cluster` is already an F.1 Scene subject. Members resolve by their own id and never through a cluster path. [resolver](../../../../packages/project-model/src/references/unit-resolution.ts) | Selecting a group needs no new reference kind: `scene/cluster/<id>` for the group, `scene/entity/<id>` for a member |
| [Record scope](../../../../packages/project-model/src/scene-planning/record-scope.ts) already keeps unrelated entities and clusters byte-identical and in order. It forbids creating a cluster, editing a cluster field and adding a created entity to a cluster in the same write. Only `delete-one` may prune membership (`allowClusterCleanup`) | Extend it to exact declared identities (§3.2); do not loosen it |
| Every Scene planner writes one entity. `duplicate-one` and `duplicate-light` refuse a cluster member. `delete-one` prunes the member and drops a cluster that falls below two. Transform paths are per kind: floor objects (`move-horizontal`, `set-yaw`), lights (`update-light`) and Artwork (`artwork-transform`). Rotation is stored as Euler XYZ | Group operations are compound planners that reuse each kind's own gates. The member-duplicate refusals are replaced by G-3 |
| **Lifted support has a defect.** A lifted object's move or duplicate resolves its destination with `requiredElevation: null`, which accepts any single candidate. A lifted base at 0.5 m moved where the only support is a region top at 0.8 m is accepted with a negative lift. A floor below plus a mezzanine top above refuses as "ambiguous", although only one of them is beneath the base. [support](../../../../packages/project-model/src/scene-planning/support.ts) · [transform](../../../../packages/project-model/src/scene-planning/operations/transform.ts) | One corrected destination rule serves single and group moves (§3.4) |
| [Selection](../../../../apps/editor/src/lib/authoring/stage/semantic-selection.ts) is an ordered list that always has a primary. Every Stage, Plan and Index producer replaces the selection with one subject, so **no creator gesture builds a set**; S7's "one Wash for several works" is reachable only from tests. About 25 Card, command, gesture and Library consumers read `selectionState().primary` | G1 adds sets and has to stop every primary-only consumer from treating a set as one subject (§2.3) |
| The pending-Save reader classifies only an incompatible **Layout** stamp as recoverable. Any other stamp mismatch fails validation as `invalid`, and the capture is **deleted**. [pending save](../../../../apps/editor/src/lib/platform/project-pending-save.ts) | The Persistence contract requires pending-Save export. After Scene 13, a pending Scene 12 capture would be silently lost. G1a closes this (§6) |
| The renderer and visitor never read `clusters`; the runtime projection carries them. [runtime](../../../../packages/project-model/src/units/runtime.ts) | Runtime parity is a regression proof |
| The former cluster bounds and scale vector helpers had no importers. Scene.md's sentence "partial member selection is ungrouped with a warning" described code that did not exist | G1a updated the [Scene contract](../../../reference/scene.md). G1b removed both helpers and uses [group marks](../../../../apps/editor/src/lib/authoring/adapters/scene/group-marks.ts) with the shared [rigid transform math](../../../../packages/project-model/src/scene-planning/rigid.ts) |

## 2. Behaviour

### 2.1 Membership integrity versus operation eligibility

- **Durable integrity (codec, Scene 13):** two or more distinct existing entities, each in at most
  one cluster, any entity kind. Nothing about the current transform eligibility of a member is
  persisted or validated at Load. A Scene that was valid stays valid when a member later becomes
  unmovable.
- **Operation eligibility (planners, at the moment of the operation):** a member is rigidly movable
  when `floorTransformSupport(entity).supported` holds or its kind is `light` or `artwork`; this is
  the planners' own gate. Group **Create** refuses a currently ineligible subject, so nobody creates
  a group that cannot move. **Move, Turn and Duplicate** re-check every member and refuse the whole
  operation, naming the member, if any is ineligible then. The remedy offered is Ungroup. **Erase,
  Ungroup and rename** never depend on eligibility.
- **Flat (G-1):** Create refuses a subject that is already a member (`already-grouped`). There are no
  add, remove or merge operations. *Group with …* is offered only when both parties are ungrouped.
- **Default name:** `Group`, `Group 2`, … from the editor's `nextEntityName`, carried in the intent.
  The rig is named `Showcase`. Renaming reuses `SCENE_NAME_LIMIT`.

### 2.2 Click, drill-down and hover

`selectionTargetForHit(hit, selection, scene)` owns the mapping, and every selection producer calls
it.

| Gesture | Current selection | Result |
| --- | --- | --- |
| Click a member of group G | Not G and no member of G | Select **G** |
| Click a member of G | G, or a member of G | Select **that member** (sibling to sibling stays drilled) |
| Click an ungrouped subject | — | Select it (unchanged) |
| Esc with no live gesture | A drilled member | Select its group: one more rung on the existing `compileEscapeLadder`, below every owner that already claims Escape |
| Esc | G | Clear (unchanged) |
| Index group row / member row | — | Select G / select the member directly |
| *Lit by* link | — | Select the light directly, as the Index does |
| Hover a member | Not drilled into G | Hover cue on every member of G |

- **Tools keep entity targets.** Paint, the dropper, Measure, Experience subject picking and Studio
  entry act on the entity hit, never on the group. The **Erase tool** maps group-first, with the
  disclosure *Erase group · 3 items*.
- While G is selected, a press on any member body is claimed by the Scene adapter (the cluster's
  domain) as a group drag. Light and Artwork handles are offered only to a drilled member. Light
  guides of the members of a selected group stay visible.

### 2.3 Sets (Shift-click and coarse pointer)

- **Normalized targets.** A set holds only top-level targets: an ungrouped Scene entity or a whole
  group. Shift-click and Index Shift-click map the hit to its top-level target and toggle it. A
  coarse pointer has no Shift key, so the specimen defines one touch gesture for adding and removing
  a target. Its exact form is the specimen's to choose; G1b implements the approved gesture through
  the same toggle and the same normalization. A
  drilled member is first normalized to its group, so a set never holds both a group and one of its
  members, or two members of one group. Layout subjects are not admitted to a set; Shift-click on
  one refuses with a reason. A set that falls to one target becomes an ordinary single selection.
- **A set has no primary.** Today `admitSelection` demands a primary for every non-empty
  selection. G1b changes the invariant: a single subject (including a group) has a primary, and a
  set of two or more has `primary: null`. Every primary-only consumer therefore sees "no single
  subject" and cannot act on part of a set. The shell shows a **set Card** in place of the
  primary's Card.
- **What a set offers:** **Group** (refused if it contains a group, G-1), **Light it** and Clear.
  Delete, Duplicate, Paint, transform gestures, *Look through*, Library *Apply to*, Studio entry and
  Experience linking refuse with *Select one subject or a group*. They never act on one member of
  the set.
- **Audit:** a mounted-route test builds a loose set and invokes each command, keyboard shortcut and
  Card action that reads the selection (the consumers listed in §1). It asserts no write, plus either
  a refusal or the absence of the command. An architecture test forbids reading `.primary` from
  `selectionState()` outside `semantic-selection.ts` and a projection helper, so a new consumer
  cannot reintroduce primary-only behaviour silently.

### 2.4 Actions

| Action | Group G selected | Drilled member | Set |
| --- | --- | --- | --- |
| Move / Turn | `scene-group-transform`, rigid (§3.4) | Unchanged member operation | Not offered |
| Duplicate | `scene-group-duplicate`: N copies + new cluster at +0.5 m X/Z; the copy is selected | **G-3:** an independent ungrouped copy made by the kind's existing duplicate behaviour (+0.5 m X/Z for objects and lights; Artwork keeps its 0.15 m offset along the image's horizontal axis); the original membership is unchanged and the copy is selected. The refusals in `duplicate-one`, `duplicate-light` and `artwork-duplicate` are removed | Refused |
| Erase / Delete key | `scene-group-erase`: members + cluster | Unchanged `delete-one`; a two-member group dissolves, and the Card says so | Refused |
| Group / Ungroup | Ungroup → selection is the former members as a set | — | Group → selection is the new group |
| Light it | S7's recipe over the non-light members: a Picture spot for one Artwork, otherwise one Wash. The new light is not grouped (D12) | Unchanged | One Wash over every top-level target, with a group contributing its non-light members. A light as a top-level target refuses, as today. The light is not grouped |
| Place on floor, Resize, Lift | Not offered | Unchanged | Not offered |

### 2.5 Card and Index

- **Group Card:** editable name, the reading *Group · 3 items*, and a member list whose rows drill.
  The foot holds Ungroup, Duplicate, Erase, and *Light it* when there is a non-light member.
  **Shared strata are not shown (G-2):** no writer edits one stratum across several entities, and a
  read-only stratum would breach D18.
- **Member Card:** unchanged, with a context line *In “Still life” · Select group*.
- **Set Card:** *3 selected*, with Group, Light it and Clear.
- **Group with *Still life*:** on the Card foot of the light that *Light it* has just placed for one
  ungrouped subject. One tap groups the two and selects the group. The pairing is session state in
  the light adapter, cleared by any selection change or project epoch change.
- **Index:** one `scene:cluster:<id>` row per group under Objects. Members keep their current rows
  (Objects or Lights) with a secondary reading *· Still life*. No Index nesting.

### 2.6 History and runtime

- Every action is one F4 intent and one Undo, and Undo/Redo restore source exactly. A drag or turn is
  one entry. No-op, invalid and cancelled gestures write nothing.
- Preview equals commit within 1e-6 m and 1e-6 rad. During a group drag, every member, lights and
  Artwork included, is drawn at the pose in the planner's candidate Scene through that kind's own
  candidate mark; no member is left without a preview.
- A selected group that Undo retires clears through the existing `subject-retired` requalification.
- Visitor Preview and the published reader render a grouped Scene identically to the same Scene
  with `clusters` removed. No group mark or set state reaches a visitor chunk.

## 3. Semantic foundation (G1a)

### 3.1 Operations

The six group operations and the rig live in `scene-planning/group-operations.ts` and are
registered in the Scene adapter's planner list.

| Kind | Payload | Writes |
| --- | --- | --- |
| `scene-group-create` | `memberIds` (≥2, in the order selected), captured `clusterId`, `name` | One cluster |
| `scene-group-ungroup` | `clusterId` | Removes the cluster only |
| `scene-group-rename` | `clusterId`, `name` | The cluster's name |
| `scene-group-transform` | `clusterId`, `{move: deltaXZ}` or `{turn: yaw}`, frame, captured contact per floor member | Member poses |
| `scene-group-duplicate` | `clusterId`, captured id per member, captured `clusterId`, contacts | N entities + one cluster |
| `scene-group-erase` | `clusterId` | N entities + the cluster removed |
| `create-light-rig` | Three light records (validated as `create-light` validates), captured ids, captured `clusterId`, `name` | Three lights + one cluster |

- Each operation reuses the existing per-kind gates (`readObject`, `readContactMinY`,
  `restSupport`, the light and Artwork validators) and the existing per-kind clone. Copies preserve
  material sharing and are remapped by captured id, never by name or order.
- `create-light-rig` is concrete and has one consumer. It is not a generic insert union; fixture or
  saved-rig insertion decides its own shape when it exists.
- Refusals reuse `missing-target`, `unsupported-transform`, `unsupported-set`, `invalid-value`,
  `no-support`, `support-choice-required` and `no_op`, with the offending member in the diagnostics.
  G1 adds one code, `already-grouped`.

### 3.2 Exact record scope

`SceneRecordScope` replaces `allowClusterCleanup: boolean` with exact declarations:

```text
clusters: {
  created:  [{ id, memberIds }]   // exact final membership, appended in declared order
  removed:  [id]                  // removed whole
  renamed:  [id]                  // name only
  pruned:   [id]                  // delete-one: membership minus removed entities, dropped below 2
}
```

- The checker verifies that every cluster not declared is byte-identical and keeps its relative
  order, and that created clusters are appended after them. A created cluster's members must exactly
  equal its declaration. Each member must be an existing or created entity in no other cluster. A
  created entity may join a cluster in the same write only through such a declaration.
- Entities keep today's rules: created entities appended, removed entities exactly the declared
  ones, and changed entities only in their declared fields.
- A test per compound operation covers it: create, rig creation (created entities joining a created
  cluster), group duplicate (created members equal the declared copies), member duplicate (the copy is
  ungrouped and the source cluster untouched), erase and ungroup. Each also covers an undeclared
  edit to an unrelated cluster or entity, which must refuse. Every pre-G1 planner still refuses any
  cluster change.

### 3.3 Rigid pose

`scene-planning/rigid.ts` is pure and runtime-safe, with no `three`.

- **Move** adds `(dx, 0, dz)` to every member position. **Turn** rotates every position about the
  pivot (G-5: the centre of the XZ extent of the member positions) and pre-multiplies each rotation
  by `Ry(θ)`. **Y and every relative pose are preserved exactly;** nothing is re-grounded.
- An upright floor member's rotation is composed by an exact yaw add that keeps its sub-tolerance
  pitch and roll, as `set-yaw` does. A light or Artwork is composed as `Ry(θ)·R` and decomposed back
  to Euler XYZ, with a declared branch at |m₀₂| ≈ 1. Tests compare rotation matrices and forward
  vectors, never Euler components. The whole orientation — right and up as well as forward — is the
  rigid image; inside the last `1e-8` of the singular band the declared branch reconstructs it to
  `O(cos y)`, and outside it the stable branch stays conditioned there, so both bounds sit well
  inside the 1e-6 target tolerance.
- **Probe first:** a property test over spot aims (including straight down and the gimbal branch)
  and Artwork poses proves the round-trip, and that each light's forward vector and target point
  are the rigid image within 1e-6, before any planner uses the helper.

### 3.4 Support without reseating

Every member keeps its Y. Support is **revalidated**, never used to reposition. A floor member at
destination point *p*:

- **Resting** (base on a support at the origin): needs a support at *p* within the coplanar
  tolerance of its unchanged base elevation. This is `move-horizontal`'s rule today.
- **Lifted:** its support at *p* is the highest candidate at or below its unchanged base, within the
  coplanar tolerance, and it refuses when there is none. A candidate above the base, such as a
  mezzanine top, is not its support and is ignored. The origin applies this same rule from the
  encoded pose; a support within the coplanar tolerance of the base, including a platform top just
  above it at a seam, is what it rests on. **This corrects the defect in §1**, and one shared
  destination helper (`resolveDestinationSupport`) replaces the lifted branch of `move-horizontal`
  and `duplicate-one`, so single and group moves cannot disagree (G-6, approved). The captured
  choice is checked at the destination, never at the origin: an ambiguity cannot strand an accepted
  pose, and an origin with a higher support beneath it cannot veto a choice the destination yields.
- **Explicit reseating is unchanged.** *Place on floor*, `set-lift` and placement keep their current
  semantics and remain the only operations that change a member's Y.
- Whether a body intersects a slab or a wall is collision. Support candidates carry no thickness,
  and no Scene operation checks collision today; G1 adds none.
- Lights and Artwork have no support check.
- **Any member failing refuses the whole operation** and names the member, the destination and the
  available elevations. An ambiguous destination refuses rather than asking once per member.

Tests use the fixture's raised platform: the group crossing the platform's edge; resting members on
the floor and the platform moved together (accepted when both destinations match, refused when
either lands on a different elevation); a lifted member moved where the only support is above its
base (refused); a lifted member moved over a floor below with a mezzanine above (accepted, with the
floor as its support); a lifted member moved over a lower floor (accepted, the lift grows, Y is
unchanged); and Turn sweeping a member off the platform (refused).

### 3.5 Format and stored source (Scene 13)

- **Codec:** remove the Artwork refusal and add no kind refusal (§2.1). Every other Scene version is
  refused with `unsupported_format_version`. Fixtures are regenerated in the same change, and the
  Scene family keeps its version-refusal test.
- **Failed-Load isolation:** editor Load and API Save of a Scene 12 envelope refuse, preserving the
  session, its history, the saved base and the stored head. The tests are the existing per-family
  refusal tests, extended to 12 → 13.
- **Pending Save recovery:** the pending-capture reader recognizes an incompatible stamp on **any**
  unit, not only Layout. The status becomes `incompatible-source`, naming the unit and its stamp. The
  capture keeps its exact bytes and is offered for download or explicit discard, and a sign-in
  handoff cannot overwrite it. A test seeds a Scene 12 capture under the Scene 13 reader and proves
  it is not deleted.
- **Activation and inventory (G-7, approved):** deploying the Scene 13 reader to any
  non-disposable store is an owner action. Before it, G1a records on its PR a read-only inventory of
  the Scene 12 heads, revisions, pending captures and releases in each affected store. The
  disposition, under disposable alpha, is: stored source stays in place, unreadable by the new
  reader and never converted or deleted; an incompatible pending capture is preserved byte for byte
  until it is explicitly exported or discarded.
- **Rollback:** restore is redeploying the outgoing build. The outgoing reader refuses Scene 13
  source written after activation, and its pending-Save path would delete a capture whose non-Layout
  stamp it cannot read. **Incompatible pending captures must therefore be exported before any
  rollback.** There is no migration, converter or dual reader.

## 4. Fixtures

- `groupedSceneFixture()` in `packages/project-model/tests/__fixtures__` builds a Layout with a
  floor and a raised region. On it stand a form plinth on the platform, a model on the floor, an
  Artwork on a wall and a Picture spot aimed at the Artwork, grouped as *Still life*. It also has a
  lifted member, an ungrouped neighbour and a second two-member group for order and isolation
  checks. Planner, scope, codec, acceptance, render-description and editor tests build from it.
- The editor's counting and pick fixtures gain the grouped case once.
- `showcaseRigFixture()` holds three lights and their cluster.

## 5. Later work

Each of these reuses G1 code only if, when it is planned, it shows the same requirement. G1 builds
nothing for them.

- **Fixtures and saved rigs:** a fixture is a model grouped with an emitter (§5 of the T2 README),
  and a saved rig is a saved group inserted as a detached copy. Whether group duplicate's clone or
  `create-light-rig` fits is decided when that track has its payload.
- **T5.3/T5.4 object definitions and reuse:** groups and assemblies stay distinct. A group has no
  root, frame or component identity, and an assembly root is one entity that may be a group member.
  If T5.3's root-to-component selection or component-local rigid transforms turn out to need the
  same rules as §2.2 or §3.3, it extends those modules; otherwise it owns its own. No group-to-object
  conversion is planned.

## 6. Delivery

Two implementation PRs follow the review lanes. The visual specimen is approved before G1b's
implementation starts (G-4). It is a design-only change that can run in parallel with G1a.

| Step | Accepted increment | Requires | Gates |
| --- | --- | --- | --- |
| **G1a · Semantic foundation** | §3 and §4: Scene 13; exact record scope; the rigid helper (probe first); the corrected lifted rule; the seven planners registered and accepted through F4 with history; G-3 member duplicates; pending-Save recovery for any unit; Scene.md *Clusters* rewritten; the inventory and disposition on the PR. Headless, so it claims no creator journey | — | project-model and editor unit tests, `check:api`, zero-skip DB-backed `test:api`, the version-refusal family, `test:arch` |
| **Specimen** | A *Groups* section in the [World interaction sheet](../../../design-system/world-interaction-sheet.html): group and drill marks, hover, set selection with both pointer and **coarse-pointer** set
building, the group, member and set Cards, the Index row, the Erase disclosure and *Group with …*. The [Light & Sky UX](../../../../prototypes/light-and-sky-ux/index.html) *Light it* foot gains Showcase | Owner approval | Static page, no console errors, `test:arch` doc links |
| **G1b · Creator interaction** | §2: sets with no primary plus the audit; the mapping, drill-down and Escape rung; group marks, gizmo and candidate preview; the Cards; the Index row; Erase, Duplicate and Delete routing; *Group with …*; *Light it* on a group or set; Showcase (the recipe in `light-recipes.ts` and the Light it choice); keyboard ⌘G / ⇧⌘G if free; adoption or removal of the orphan helpers | G1a; the approved specimen | Editor unit and mounted-route tests, `test:arch` (visitor isolation and the `.primary` rule), focused browser QA on the live Stage against the specimen |

**Why not a separate G1c:** Showcase is one recipe in an existing module, one planner already in
G1a, and one choice on a foot the specimen already covers. Its recipe casts no shadow (none of the
landed recipes do), so it adds nothing to the unresolved D9 budget. Splitting it out would add a
review cycle without isolating any risk. If G1b goes past its `tools/metrics/budgets.json` limits,
or the specimen approval separates the two, Showcase moves to its own PR, and only then.

## 7. Acceptance

**G1a**, headless, against the fixtures:

1. Create, Ungroup and rename each make one record and one Undo. Create refuses a single subject, an
   already-grouped subject and a currently ineligible subject. Ungroup leaves every entity
   byte-identical.
2. Scene 13 Loads hand-authored source whose cluster contains a vertical plane. A transform of that group refuses and names
   the plane; Erase and Ungroup succeed.
3. Move translates every member by exactly the delta, Y included, and keeps every relative pose. The
   §3.4 support cases are accepted or refused as stated, and a refusal writes nothing.
4. Turn by 90° and by 37° rotates positions about the pivot. Each spot's forward vector and target
   point are rigid within 1e-6, including the straight-down and gimbal-branch aims. The
   rigid-helper property test passes before any planner uses it.
5. Group duplicate creates N copies and a new cluster with the declared ids, shared materials and
   rigid offset. A support failure for any copy refuses the whole duplicate. Member duplicate of a
   model, a light and an Artwork makes an ungrouped copy and leaves the source cluster
   byte-identical.
6. Erase removes members and cluster in one write, and Undo restores identical source.
   `delete-one` on a member of a two-member group dissolves the group with
   `cluster-membership-cleaned`.
7. The record-scope tests in §3.2 pass, and every pre-G1 planner still refuses a cluster change.
8. A single-object move of the fixture's lifted member to a point supported only above its base now
   refuses, and the same move over floor-plus-mezzanine is accepted. Every other pre-existing move
   and duplicate test still passes.
9. Scene 12 refuses at Load and at API Save, preserving the session and the head. A pending Scene 12
   capture is offered for export and is not deleted. Save → cold Load round-trips the fixture, and
   API tests run with zero skips.
10. The grouped fixture's render description equals the ungrouped one, and the visitor chunk
    imports nothing new.

**G1b**, on the live Stage, against the approved specimen:

11. Click the painting → group (every member marked). Click again → the painting drilled. Click the
    spot → the spot drilled. Esc → the group. Esc → nothing.
12. Drag the plinth with the group selected: every member moves, Y is unchanged, the preview equals
    the commit, and one Undo restores. Turn 90°: the rendered spot still lights the painting. A
    drag off the platform's edge shows a refusal and writes nothing.
13. Duplicate the group: the copy is a selected group lighting its own painting. Duplicate a drilled
    spot: an ungrouped copy is selected and the original group is unchanged. Erase the group: one
    disclosure, one Undo.
14. Shift-click two paintings → *Light it* → one ungrouped Wash. Shift-click a drilled painting and
    a vase → the set holds the group and the vase, never the painting alone. With a set, every
    audited command writes nothing, and the audit and `.primary` architecture tests pass. At coarse
    pointer, the approved touch gesture builds the same normalized set.
15. *Light it* on an ungrouped painting → *Group with “Painting”* → the group is selected. The offer
    is absent when either party is grouped and after any selection change. *Light it ▾ Showcase*
    makes three lights and one group in one Undo, none grouped with the subject.
16. Plan/Paper follows the same rules. Visitor Preview shows no mark and is pixel-identical to the
    ungrouped Scene. Reload restores the group.

## 8. Readiness

- **G1a is ready to implement** once this plan merges. Everything it touches exists on main, the
  riskiest assumption (the rigid rotation helper) is probed first inside the PR, and the only
  external step is the owner's activation at deploy under the approved G-7 disposition.
- **The specimen proceeds in parallel with G1a** and needs nothing from it.
- **G1b is blocked only on the specimen.** The selection-invariant change (a set has no primary)
  is the widest edit. It is bounded by the audit test and the architecture rule, and it is
  implemented first within G1b.

## 9. Decisions

| # | Question | Outcome |
| --- | --- | --- |
| G-1 | Nesting | **Decided:** flat groups, no nesting |
| G-2 | Shared strata on the group Card | **Decided:** deferred; the Card shows none |
| G-3 | Duplicate on a drilled member | **Decided:** an independent copy outside the group that keeps the kind's existing duplicate behaviour (Artwork keeps its image-local horizontal offset); membership preserved; the copy selected. G1a implements it |
| G-4 | Visual target | **Decided:** approved specimens before interaction implementation (§6) |
| G-5 | Pivot | **Decided:** the centre of the XZ extent of the member positions |
| Format | Scene 13 | **Decided:** strict policy; obligations in §3.5 |
| G-6 | Lifted support | **Decided:** corrected consistently for single and group Move/Duplicate. No collision detection; explicit reseating unchanged (§3.4) |
| G-7 | Stored Scene 12 source at activation | **Decided:** the disposable-alpha disposition in §3.5: stored source and incompatible pending captures preserved, inventory recorded for affected stores, captures exported before any rollback |
| G-8 | Coarse-pointer sets | **Decided:** the specimen includes a coarse-pointer set interaction (§2.3, §6) |

**Contracts amended on landing:** Scene (*Clusters*, membership integrity, the duplicate rules and
the lifted-support rule in G1a; selection and set rules in G1b); Persistence (pending recovery for
any unit, G1a); the design-system Stage grammar (group selection, drill-down and sets without a
primary, G1b).
