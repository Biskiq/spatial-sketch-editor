# T2 — Composition: planning evidence and obligations

**Read when:** planning the T2 composition phase, or deciding what the deleted P24
material still obliges the product to do.

**What this is.** Consolidated evidence and obligations carried forward from the
retired P24 phase (implementation-plan §8.4). It is an **evidence and obligations
record, not an implementation plan and not an authorization**: it names what a
later T2 plan must respect, and preserves the decisions and counter-cases the
deleted documents held. Nothing here is an accepted plan, a slice, or a
capability claim.

**Authority.** T2 is re-derived against the ratified decision record and the
F contracts, not against P24's staging-only scope. P24's plans, annex, minimum
freeze, child briefs and sequence were **pre-redesign evidence**, and the former
"P23B then P26 precede P24" order is superseded; T2 data work proceeds alongside
T1 and its authoring surface consumes T1's viewport/projection seam rather than
waiting for T1's later representation slices. No frozen minimum binds the
re-derived plan. Landed truth for current Scene behavior lives in
`docs/reference/components/scene-content.md`; the F.1/F.2 shapes live in
`docs/reference/composition-execution.md`.

## 1. One semantic Scene placement, view-specific projection

- Placing a Scene asset creates exactly **one** canonical `SceneEntity` owned by
  `SceneDocument`. Plan and 3D are input/rendering lenses only; the viewport in
  which a placement starts or commits never changes mutation ownership.
- `LayoutDocument` is consulted for spatial support when needed but is never
  mutated by Scene placement, and a mixed Layout/Scene transaction is not
  introduced.
- A shared world-local placement write is valid only against canonical Scene
  meaning, which carries an explicit Scene format discriminator. A legacy
  room-local Scene must be migrated/adapted before the shared world-local
  operation runs; never mix a roomless world-space entity into a legacy
  room-local document.
- The Plan representation of a model is **derived** from the entity's id and
  transform plus its asset definition's Plan metadata / `AssetFootprint`. No
  per-instance proxy, Plan transform, support record or duplicate Plan entity is
  authored or persisted; a no-Plan-metadata asset is Plan-ineligible rather than
  given invented geometry.
- Entry points may differ (library, Inspector, keyboard, future drag); they must
  arm the **same** placement intent and converge on the same Scene-owned commit
  semantics. Arming creates session/preview state only.
- Surface: an asset a view cannot represent truthfully is refused with a reason.

## 2. Derived footprint, X/Z/yaw input, support-owned Y

- In Plan, Plan authors world X/Z and supported yaw; **Y is resolved** from the
  selected valid support elevation plus the asset's normalized grounding/contact
  offset. Pitch, roll, scale and other non-Plan components come from the shared
  canonical creation defaults / normalized asset metadata, never from ad-hoc Plan
  resets.
- For an existing entity edited in Plan, Y/elevation, pitch, roll and scale are
  preserved unless the explicit operation owns one of them.
- The same placement intent plus the same support choice must produce the same
  canonical pose whether the pointer evidence came from Plan or 3D.
- A stored transform/dimensions remain authoritative for rendering, bounds and
  serialization, so a derived representation may legitimately differ from the
  stored one without changing it.

## 3. Transient support consultation is not host attachment

- Support resolution is a **read-only calculation**. It does not transfer
  ownership from `LayoutDocument` to `SceneDocument` and does not persist a
  cross-document support link by default.
- For Layout-owned floor support the canonical source is the shared compiled
  Layout geometry/query seam. Plan may start from X/Z pointer evidence and 3D
  from a rendered hit; both must normalize that evidence to the same semantic
  support result before the Scene write. A rendered hit is never the authority
  for floor elevation.
- No valid support → reject the commit with a visible reason. Different
  elevations require a choice; equivalent coincident results deduplicate;
  an unsupported or unresolved case is refused, not guessed.
- Persistent wall/support relationships (a durable cross-document reference) need
  their own delete/move/history/cross-document contract before approval. They are
  a follow-up, not an implied capability.

## 4. View-independent selection and explicit ineligibility

- Committed Scene selection is view-independent. An accepted Plan ↔ 3D switch
  must not clear, recreate, reorder or remap the selected Scene entity ids while
  those entities exist. Selection order and primary/active intent stay owned by
  the existing Scene selection reducer; a view transition creates no replacement
  selection identity and no history entry.
- A selected entity that cannot be represented or edited truthfully in Plan
  remains canonically selected; Plan refuses unsupported manipulation instead of
  deleting the selection or inventing a proxy.
- For a shared multi-selection operation, Plan must not silently drop ineligible
  members and mutate only the eligible subset: unless a future capability
  explicitly defines partial-operation semantics, the operation is unavailable
  or refused for the whole selection.
- A Plan-ineligible entity exposes no misleading Plan placement/transform handle.
- Current seam to close: canonical world-local selection still needs the
  Room-context cleanup — the behavioral contract is view-independent, but the
  live workspace-selection and selectability seams are not yet fully Room-free.

## 5. Gestures cancel at real transitions

- If a Plan ↔ 3D transition is accepted while a shared placement or transform
  interaction is unfinished, the **interaction owner cancels it before** the view
  changes: restore the last committed baseline; end the transient
  pointer/drag/preview session exactly once; produce no history result; preserve
  the committed Scene selection for a view-change cancellation; only then apply
  the requested transition.
- Recorded live gap (not an alternate semantics to preserve): switching was
  disabled while an interaction was active. That is safe against an accidental
  commit but is not the accepted-switch → cancel → switch behavior above.
- Both views' plan cells stay mounted and inert when hidden; teardown is
  defensive only, and a delayed pointer-up after a cancel cannot commit. The
  interaction owners are the existing gizmo host, the Plan gesture owner and the
  pending-placement owner — a second interaction state machine is rejected.

## 6. A preview candidate equals its commit

- Ghosts and helpers are absent from serialization.
- The final preview equals the commit, within a stated pose tolerance
  (1e-6 world units / radians in the source acceptance).
- One drag is one entry; invalid, no-op and cancelled gestures are none; undo and
  redo are exact. Support choice is resolved **in the preview candidate** and that
  validated candidate is committed; late invalidity refuses or rolls back.
- Recorded live gap (R3 support/Y integration): a rigid "keep on floor" commit
  ran after the last displayed preview, so Y could change between the last
  displayed candidate and the authored commit. The obligation is the preview =
  commit rule above, not a second preview system.

## 7. One acceptance/history result

- All authored operations use the existing Scene transaction/validation/history
  authorities. One logical commit = one tagged Scene history entry;
  invalid/cancel/structural no-op = none; undo restores the prior state and redo
  replays the committed ids/result.
- No Layout write accompanies Scene work. One user action remains one Scene
  history result; no mixed-document gesture, no hidden support-side write without
  an explicit atomic contract.
- Project/environment replacement resets baseline history under the existing load
  semantics, with no synthetic user edit and no mid-gesture conversion.

## 8. Mutations follow entity authority

- Scene entities, primitives, lights, materials and their instances are
  `SceneDocument`-owned; Layout structure stays Layout-owned.
- Scene placement and transforms create records **without Room ownership** —
  not even a room field holding undefined.
- Existing authorities are reused: one selection/history system, one
  transform/gizmo host with domain adapters, one Layout compiler/query core, one
  camera graph. Second selection, history, gizmo, geometry or navigation systems,
  persisted Three objects and nested transform rigs are rejected.
- Acquisition/approval is outside editor history; scene state is serializable
  semantic data only.

## 9. TD-1 — acceptance tests the fix owes (verbatim)

TD-1 (floor-supported placement unreachable in canonical wall-first projects) is
closed as **implementation removed, not fixed**: the defective placement wiring
was deleted with the editor shell. Its owed acceptance tests transfer here
verbatim (implementation-plan §8.6, §8.4). The replacement for camera-node
placement specifics is decided by the re-derived T2/T3 plans; the obligations
below are the contract.

```text
1. Canonical boot → place → commit: a wall-first document with one reconciled Room +
   `beginCameraPlacement()` + the floor hit ⇒ exactly one unsequenced node, one history
   entry, `roomId` absent, world-space eye/target finite.
2. Round trip: that project passes `validateProject` and Save/Publish
   (no `scene_not_world_local`, no `unknown_room`).
3. Both surfaces: Camera · Plan and Camera · 3D reach the same result for the same
   floor point.
4. Legacy is untouched: the existing `live-rooms.test.ts` room-first behaviour and the
   frozen relic keep passing, including the throw-free `rooms.point/getRequired` contract
   for room-first documents.
5. Refusal is honest: clicking outside any Room still refuses, with a reasoned message
   and no history entry.
```

Two factual notes on the verbatim text, neither altering its obligation:
`live-rooms.test.ts` was removed by #115 with the editor shell, so item 4's
room-first coverage now lives in the frozen project's own suite; and the refusal
copy item 5 names is not preserved literally — the refusal must be **reasoned**,
and reusing the resolution-reason vocabulary rather than inventing a second one
was already owed.

## 10. Atomic group/duplicate validation

- Flat cluster semantics are retained: membership-only grouping preserves poses,
  one group maximum, no nesting, no Three parenting as an authored hierarchy.
- Deleting entities cleans references and selection through the existing
  authority; no dangling member survives.
- Duplicate: deterministic +0.5 world X/Z offset, Y and material sharing
  preserved, no hidden move or grounding entry.
- A full cluster is duplicated as a cluster; a partial member selection is
  ungrouped with a warning. Missing targets and overlap are deterministic, and an
  invalid batch leaves the document unchanged.
- **Validate all clone candidates before one commit**; atomically commit or not
  at all.

## 11. Positive/uniform scale versus independent scale

- Expose **positive uniform scale** only. Disable light scale and independent
  (per-axis) scale with a visible reason.
- Detect any existing unequal-axis transient state before commit: block it or
  offer an explicit conversion — never silently average it.
- Do not add a per-axis schema. Independent-scale persistence is a depth tail,
  not a minimum requirement.
- The legacy session scale vector is session-only state that a visitor may render
  lossily until a later format version; no per-axis persistence is introduced.

## 12. Material and light semantic gaps

Materials (definitions/instances and shared-vs-unique already exist):

- Gaps to close: instance tint and reset, metric tile size where the mapping path
  supports it (no UV editor), approved PBR map sets, and atomic selected-subset
  editing that protects unselected shared users by default.
- A default edit clones once per shared instance for the selected subset and
  retains sharing inside it; an explicit "edit shared" path discloses the
  total/outside user count. Cancelled choice, unsupported target and failure write
  nothing.
- Whole-object assignment replaces all mesh materials and does **not** promise
  imported glass/alpha preservation; clearing a model assignment restores the
  imported appearance.
- Arbitrary UVs expose unsupported metric controls with a reason rather than an
  automatic projection. No shader/node graph, slot editor or texture painting.

Lights and environment:

- Three light types exist. Gaps to close: truthful stored units, an editable
  spot half-angle presented in degrees against canonical radians, and an
  **explicit undoable repair** for legacy values outside the supported maximum —
  never a silent load-time clamp or reinterpretation, and new publication blocked
  until repaired.
- Editor-only helpers are mounted for selected lights only and are never
  serialized; no light scale, and no range-drag gizmo.
- Authored environment is global Scene-level intent (asset id, intensity, Y
  rotation, background mode) with the legacy implicit baseline preserved when
  absent; an explicitly authored mode with no environment is valid. Rotation
  affects image-based lighting and the environment background consistently.
- No hidden assist/baseline sum: any editor assist light is visibly session-only
  and off for comparisons and visitors. PMREM/environment caches are **derived
  renderer resources** with scope, reference counts and asynchronous
  cancellation — never authored Scene truth.

## 13. Static-model source drift

- A static-only catalogue ceiling no longer binds T2, but the delivered bytes must
  be authoritative for **actual loading**, not only for validation: cold model
  load uses the retained compatibility source even when the live catalogue changes
  or disappears, and an already-published release keeps its retained static
  mapping.
- Attribution that a source requires survives into library and publication output.
- A missing, failed or corrupted resource is visible and never silently accepted;
  provider/signed URLs are not shipped as the durable source. Fallback resolves
  separately and visibly.
- A render-ready derivative must never be advertised as a preserved semantic
  assembly.

## 14. Truthful ingest, provenance and resource locking

- Ingest **declares** which structure, clips, material slots, pivots and metadata
  survived and which operations are supported, and retains source bytes and
  conversion provenance where later reprocessing requires them.
- Definitions, states, performances and clips are typed resources with logical
  identity plus an exact revision or content identity, project and library scopes,
  and a project dependency lock. Availability, authorization and retention travel
  with reuse.
- A locked reference is never silently rewritten; an incompatible replacement is
  reported for repair, never auto-matched by name or position.
- Names and indices may locate data inside a source revision; they do not prove
  continuity across a re-export.

## 15. Single-model import belongs in the first trial loop

- User single-model import moves into the **first creator/audience loop**
  (import or build → place → direct → publish → receive feedback → revise →
  re-share). It is no longer deferred behind a complete asset pipeline, and the
  static catalogue is not the scope ceiling.

## 16. No renderer/library upgrade is implied

- The renderer dependency baseline is a **conditional** choice made at
  implementation freeze, not a pin to a newer revision. No decoder or engine
  upgrade follows from T2.
- The r175–r186 harvest's `Object3D.dispose()` finding is downgraded from an
  adoption to a **conditional implementation recheck**, because of the Threlte
  disposal interaction and the later point-shadow disposal fix. Preserve scoped
  caches, reference counts, clone ownership and asynchronous cancellation; do not
  infer recursive disposal or delete ownership logic.
- An optimization that does not reproduce under measurement is not adopted, and a
  benchmark family with no enforced threshold is not treated as a regression
  guard.

## 17. Ingest/resource staging must be rebuilt

- The editor's ingest/resource staging path was removed with the editor shell, and
  the upload path does not today accept HDR/model bytes. The supply pipeline and
  the normalization/footprint evidence survive under
  `apps/editor/assets-source/pipeline/` and remain **evidence**, but staging is a
  T2 rebuild, not a preserved capability.
- Approval of a derivative is atomic and outside editor history: no half-approved
  derivative and no Scene acquisition state. Acquisition metadata never enters
  viewport state.
- A single model and its maps must be placeable, Save/Load-able, previewable and
  publishable as one coherent loop before catalogue breadth is expanded.

## 18. Authoring-module routes

- T2 placement slices consume the retained pure modules under
  `apps/editor/src/lib/authoring/scene/` — placement-local bounds, footprint
  derivation and hit resolution — which match the "derived footprint,
  support-owned Y" obligation and are shell-free.
- Whether any of that math moves into the shared project-model packages is a T2
  decision at its own slice, with a successor proof; no move is implied here.
- Kernel-level Scene transform-validation facts belong in
  `docs/reference/components/scene-content.md`, which stays the current Scene
  contract. Proof routes for T2 gates are the lane and change-impact rules in
  `apps/editor/tests/README.md`.

## Provenance

Baseline for `git show` recovery: `e90a58224443bdbf44114d7285d55c983b79cc84`.

Consulted (all now retired or relocated): the P24 umbrella, P24A annex and
reconciliation sequence; R3 shared Plan/3D placement contract; R4 cross-view
interaction contract; R5–R7 maturity reconciliation; R8 presentation
reconciliation; R9 minimum freeze and implementation gate; the P24 minimum child
briefs (P24.0–P24.5); the deleted `placement` component contract; the retired
TD-1 entry in the P24-deferred tech-debt ledger; and the ratified Scene
destination in `docs/reference/components/scene-content.md`. Recover any of them
with `git show e90a58224443bdbf44114d7285d55c983b79cc84:<old-path>`. Ratified
authority remains the decision record and the F contracts listed at the top.
