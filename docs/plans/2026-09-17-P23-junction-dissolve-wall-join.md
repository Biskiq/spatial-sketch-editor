# P23 concurrent slice — Delete Junction as Junction Dissolve / Wall Join

**Status:** implemented and verified on `feat/p23-junction-dissolve` — full suite
275 files / 4074 passed, editor+museum checks clean, editor+museum builds pass,
visitor-bundle verifier ok (3 server + 9 client entries). Review gaps closed:
room_identity_lost tripwire, codec round trip, 179° case, reverse-order
mixed-kind, degree-0, Arrange-gate + wiring source contracts, per-code
messages, §4 locked order, candidate copy-on-write. Ready for tracker
registration.
**Scope:** small concurrent P23 feature slice — the smallest robust inverse of Wall subdivision.
**Tracker note:** this file carries no tracker P-number yet. Per `docs/plans/README.md`
Rule 1, numbers are assigned on registration; the child-plan exception covers the
`P23.*` working title. Rename on registration; do not consume a number here.
**Branch:** `feat/p23-junction-dissolve`.
**Baseline:** `main` at P23.12 merged + PR #56 anchor-release fix (HEAD `c2a2404`
at plan time; rebase onto the P23.13-ready tree before implementation).

## 0. Product contract

```text
Wall A ── Junction ── Wall B
             ↓ Delete
        one joined Wall
```

A Junction is deletable **only** when it has exactly two incident canonical Walls
and those Walls join without inventing or losing geometry or semantics.
This is not general Junction deletion. Goal is the inverse of subdivision,
not "merge arbitrary geometry": same-kind pairs only (§3).

## 1. Non-goals (hard)

Orphan-Junction deletion; degree-1 or degree-3+ deletion; cascading Wall deletion;
topology guessing; a new topology engine; a new history system; a second selection
model; geometry approximation/refitting to force success; SceneDocument, Camera, or
visitor changes; unrelated P23 polish. Angled line+line stays rejected even though
a kinked cubic could encode it (§3) — kind change is out of scope.

## 2. Architecture (approved)

```text
selected degree-2 Junction
        ↓
planDissolveJunction()          — pure core planner, new file
        ↓
exact join + Opening rebase (Walls/Junctions/Openings only; Room boundaries
reconciliation-owned — §6)
        ↓
shared topology acceptance authority (no copy — §6)
        ↓
thin preview adapter            — one function beside deleteWallFirstWall
        ↓
one Layout transaction          — existing runLayoutMutation path
```

Required in this slice: core planner + adapter + Delete/Backspace wiring + tests.
Inspector dissolve button is **explicitly out** of this slice's acceptance: include
only as a merge-safe follow-up, otherwise it rides P23.14 (shell finish owns the
Inspector surface). There is exactly one UI entry point to accept against (§8).

## 3. Compatibility / rejection matrix

| Pair | Verdict | Joined centerline |
|---|---|---|
| line + line, `E1,J,E2` collinear | ✅ join | `{kind:'line'}` — exact inverse of straight `planWallSplit` (`layout-wall-noding.ts:159-176`) |
| line + line, angled | ⛔ `non_collinear_straight_pair` | A single chord would cut the corner (invented geometry). Kinked-cubic encoding is mathematically possible but converts `line`→`cubic-chain`; the codebase treats that boundary as significant (`deleteWallCurveKnot` never falls back to `line`, `layout-wall-curve-algebra.ts:20-21,483-485`). Deferred, never silent. |
| cubic-chain + cubic-chain | ✅ join | Concatenated chain, J demoted to one fresh interior knot (§5). Zero math on controls. |
| line + cubic-chain (either order) | ⛔ `incompatible_wall_pair` | Split never produces mixed-kind fragments (straight split → two lines; curve split → two chains per `noding.ts:175-176,199-206`), so same-kind-only loses no split-inverse coverage and avoids kind-change semantics. The exact straight-cubic bridge exists (`resolveCurveTarget` + `allowStraight`, `layout-wall-first-precision.ts:535-576` via `deriveChainSpans`) for a future slice only. |
| role differs | ⛔ `incompatible_wall_pair` | Only `boundary` feeds face extraction (`layout-wall-first-types.ts:56`). Precedent: migration rejects conflicting coincident walls rather than merging (`layout-migration.ts:839-854`). |
| thickness differs (exact `!==`) | ⛔ `incompatible_wall_pair` | Feeds offset-clearance validation (`layout-geometry.ts:400`) and 3D. Same precedent. |
| height differs (exact `!==`) | ⛔ `incompatible_wall_pair` | Per-wall authored height; Room ceiling derives as max (`layout-wall-first-types.ts:129-142`). |
| names: both absent / equal / exactly one present | ✅ join | Absent, that string, or the single name. No conflict, no loss (P23.12: name is metadata, `types.ts:157-163`). |
| names: both present, different | ⛔ `incompatible_wall_pair` | Keeping either drops authored data; no merge rule without owner input. |
| non-J endpoints identical (`E1===E2`) or self-loop incident Wall | ⛔ `degenerate_wall_pair` | Join would be a zero-span loop. Also required by codec (`layout-wall-first-codec.ts:150-162`: Walls reference two distinct Junctions). |
| another Wall already spans `E1—E2` | ⛔ `duplicate_joined_wall` | Explicit pre-check; codec would otherwise reject as duplicate Walls (`layout-wall-first-codec.ts:150-162`), but the dedicated code is cheaper to test and message. |
| incident Wall count ≠ 2 (0/1/3+, incl. any third Wall at J) | ⛔ `junction_degree_not_two` | Degree counts **all** referencing Walls. |
| unknown Junction | ⛔ `unknown_junction` | — |
| Malformed Room correspondence (faces fail to match baseline Rooms) | ⛔ reconciliation codes (`unsupported_component`, `ambiguous_room_correspondence`, `room_reconciliation_rejected`) or the `room_identity_lost` assert (§6) | No manual boundary rewrite exists to go wrong: faces are extracted from the joined graph and `reconcileRooms` owns all boundary reconstruction. |

Collinearity test (line+line) — locked policy, no open item. Do **not** use
`orientXZ(...) === 0`: Museum robust orientation deliberately applies no
epsilon — the exact sign is topology truth (`layout-robust-orientation.ts:18-23`,
H3 §4.4). A tolerance is still required, but for a different reason: straight
subdivision places J through floating `distance / length` interpolation
(`pointAtSpanDistance`, `layout-wall-noding.ts:44-50`), so a mathematically
straight split can carry tiny double-rounding residue. Use a **dissolve-local
numerical straightness tolerance** (not a topology tolerance, not the Junction
identity tolerance):
```text
scale = max(1, |all coordinates|, |E2 − E1|)
tol   = 64 * Number.EPSILON * scale
|(E2−E1) × (J−E1)| / |E2−E1| <= tol,  plus strict-between dot tests
(dot(J−E1,E2−E1) > 0 and dot(J−E2,E1−E2) > 0)
```
Wording lock: *this tolerance only decides whether collapsing two line
fragments changes authored geometry beyond floating-point noise. It never
establishes Junction identity, connectivity, intersection, snapping, or Room
topology.* H3 exact orientation stays intact for all of those.

## 4. Operation contract

```text
planDissolveJunction(document: LayoutDocumentWallFirst, junctionId: string)
  : DissolvePlan
DissolvePlan =
  | { kind:'success'; document; survivorWallId; retiredWallId;
      retiredJunctionId; createdKnotId? }
  | { kind:'rejected'; rejection: DissolveRejection }
DissolveRejection = WallFirstOpRejection | DissolveSpecificRejection
// DissolveSpecificRejection carries the dissolve-only codes
// (unknown_junction, junction_degree_not_two, degenerate_wall_pair,
// duplicate_joined_wall, incompatible_wall_pair, non_collinear_straight_pair,
// room_identity_lost) in the same { code; message; wallIds?; junctionIds? }
// shape, so the shared generic validateAndCompile<T> passes existing
// WallFirstOpRejection objects through with no casts.
```

Pure function, no input mutation, builds the complete candidate. Preconditions run
in locked order (first failure wins, stable codes): unknown Junction →
junction degree → degenerate pair → duplicate joined wall → compatibility
(role/dimensions/name/kind) → straight collinearity. Then candidate construction
(§5), then Room correspondence + shared gates (§6). Every rejection is atomic:
no document change, no history entry.

## 5. Survivor policy, traversal-correct join, Opening rebase

**Survivor** (no geometry input):
1. Through-configuration (exactly one incident Wall has `endJunctionId === J`):
   that Wall survives — the exact split inverse (`W(A→X)` kept the ID,
   `noding.ts:10-11,221-222`).
2. Otherwise (both end at J, or both start at J): lexicographically smaller
   Wall ID survives.
3. Uniform orientation: `joined.start = survivor's non-J endpoint`,
   `joined.end = the other Wall's non-J endpoint`. Survivor keeps its ID with
   rewritten endpoints; the other record is dropped.

**Curve join — traversal-correctness fix (review blocker, resolved here).**
The v1 draft wrongly called spans "directionless control pairs" reusable in
reversed order. That is false: `wallCenterlineCubics`
(`layout-wall-centerline.ts:167-194`) proves a reverse walk must mirror each
cubic (`start↔end`, `handleOut↔handleIn`) **and** reverse cubic order, and the
module comment (`:159-163`) states endpoint-swapping alone "would trace a
different curve." `wallCenterlineSegment` (`:209-239`) is documented as the ONE
adapter — "no compiler/topology/Opening code builds Wall curve segments by hand."

Required implementation (no hand-rolled reversal in the dissolve module):

- Add ONE canonical helper in `layout-wall-centerline.ts`, beside
  `wallCenterlineCubics`, e.g. `orientedWallChainKnotsAndSpans(centerline,
  startPoint, endPoint, traversal): { knots; spans }` returning stored knots
  and spans in traversal order: forward = as stored; reverse = reversed knot
  order with each span mirrored (`handleOut↔handleIn`) in reversed span order.
- Its mirror logic must be the **single** implementation shared with
  `wallCenterlineCubics` (refactor direction — helper consumes the mirror
  routine or vice versa — is the implementer's choice; duplication is the
  rejection criterion at review).
- Dissolve calls it per side with each side's traversal toward the joined
  direction, then persists
  `knots = Ka_trav + [{ id: freshKnotId, point: J.point }] + Kb_trav`,
  `spans = Sa_trav + Sb_trav` via the existing `wallCubicChain` constructor.
  Fresh knot ID = `nextWallCurveKnotId(survivorWallId, survivorKnots ++
  otherKnots)` (`layout-wall-centerline.ts:107`).
- Consequence is unchanged from v1 (concatenation, zero control-point math —
  the `insertWallCurveKnot` principle, curve-algebra `:441-448`), but now
  correct for reverse-traversed sides. Covers knot-promoted splits (inverse of
  `partitionWallCurveChain` knot path, curve-algebra `:194-209`) and mid-span
  splits (halves preserved as two spans; no de Casteljau inversion).
- Round-trip note: split→dissolve restores geometry exactly but mints a new
  knot ID (the promoted knot's original ID is gone with the split). Observable
  only across explicit split→dissolve sequences; Undo restores the exact
  pre-dissolve document via snapshot, unaffected.

**Opening rebase** (exact, inverse of `rebaseOpenings`, `noding.ts:421-450`):
joined interval `[0, L]`, `L = lenFirst + lenSecond` (straight → chord
hypotenuse; curved → shared `wallCurveChainLength`, curve-algebra `:84-87`).
Wall occupying `[s, s+lw]`, Opening `[o, o+w]`: forward traversal →
`offset' = s + o`; reverse traversal → `offset' = s + lw − o − w`.
`wallId' = survivorWallId`; all other Opening fields verbatim. No straddle case
exists (J is a Wall endpoint). Fit re-proven by the shared Opening-set gate (§6).

## 6. Room reconciliation + shared acceptance authority (review fix, resolved here)

Do **not** use `finalizeWallGeometryCandidate` — it demands cycle-key equality
(`precision.ts:1538-1547`) and every dissolve changes keys (`[W1,W2]→[W]`).
Ride the removal-pipeline correspondence instead, with **zero copied gates**:

- Correspondence calls the already-shared `reconcileRooms`
  (`layout-room-reconciliation.ts:272`) exactly as `planWallRemovalSet` does
  (`layout-wall-topology-ops.ts:516-565`): baseline predecessor
  polygons/witnesses → `buildCorrespondenceComponents` → reconcile with
  `createAuthoringRoomAllocator` (`topology-ops.ts:58`). Calling a shared
  function is reuse, not duplication; the thin per-operation preamble
  (candidate-specific inputs) stays local.
- Final gates call ONE shared implementation. `validateAndCompile`
  (`layout-wall-topology-ops.ts:211-236`, codec → compile) is currently
  module-private **and** hardcoded to `WallFirstOpPlan` callbacks/return, while
  `planDissolveJunction` returns `DissolvePlan` — a plain export would force an
  awkward result-shape map at the call site. Instead, make it a tiny generic
  shared gate (no behavior change, no new authority):
  ```ts
  function validateAndCompile<T>(
    document: LayoutDocumentWallFirst,
    reject: (rejection: WallFirstOpRejection) => T,
    success: (document: LayoutDocumentWallFirst) => T
  ): T
  ```
  Existing topology-ops planners instantiate `T = WallFirstOpPlan` with
  identical behavior; the dissolve module instantiates `T = DissolvePlan`.
  No copied codec→compile logic anywhere (review requirement).
- Because rebased Openings survive (unlike wall-delete, where they die with the
  Wall), additionally call the already-shared `validateWallFirstOpeningSet`
  (`layout-opening-set.ts:43`) and `validateWallFirstPortalRelations`
  (`layout-portals.ts:76`) on the reconciled candidate before
  `validateAndCompile`, reusing their codes (`opening_set_invalid`,
  `portal_relation_invalid`) exactly as the precision finalizer does
  (`precision.ts:1586-1600`). Shared calls, same codes — not a new authority.
- **No manual Room-boundary rewrite.** Build candidate Walls/Junctions/Openings
  only — do not touch `rooms[].boundary` before reconciliation. This is sound
  because `reconcileRooms` takes `candidateDocument: Omit<LayoutDocumentWallFirst,
  'rooms'>` (`layout-room-reconciliation.ts:274`) — candidate rooms are not
  even an input — and the 1→1 preservation branch takes predecessor metadata
  but sets the final boundary directly from the extracted candidate face
  (`finalRooms.push({ ...predecessor, boundary: [...face.boundary] })`,
  `:376-392`). Face extraction + reconciliation already own canonical
  Room-boundary reconstruction, so a `[W1,W2]→[survivor]` pair-rewriter would
  be a second boundary-authoring path for no benefit. No pair-rewriter helper
  is needed; the slice gets smaller. Baseline Room refs may be read as a
  defensive diagnostic, never mutated. A malformed case surfaces through
  reconciliation's own codes or the assert below — `room_rewrite_unmatched`
  is dropped.
- Dissolve-specific assert (new, small, lives in the dissolve module):
  `retiredRoomIds` empty **and** no `created` lineage → else
  `room_identity_lost`. Dissolve preserves the face set geometrically
  (collinear chord = same segment; chain concat = same point set), so any
  birth/retire proves a non-topology-preserving join. Stricter than wall-delete,
  as required.
- `objects`, Floor, Scene/Camera untouched.

## 7. Selection / history behavior

- One success = one `layout` history entry via the existing
  `runLayoutMutation` path (`layout-mutation-runner.ts:43` →
  `editor-store.svelte.ts:2858` → `history-controller.svelte.ts:172`).
  Undo restores the exact pre-dissolve document.
- Post-success selection: fixed `none` — wall-delete precedent
  (`EditorViewport.svelte:280`, `PlanWorkspace.svelte:301`);
  `reconcileLayoutSelection` (`layout-interaction.ts:1520`) already degrades
  dangling `junction` selections safely. Never auto-select the survivor.
- Adapter `dissolveWallFirstJunction(state, junctionId)` in
  `layout-preview-state.svelte.ts` beside `deleteWallFirstWall` (`:1768`):
  planner → `applyWallFirstDocumentPlan(state, plan.document,
  'junction-dissolve')` (document-plan path like wall-delete, not the precision
  path). Rejection → `state.lastMutationMessage`, no history write.

## 8. UI entry points (one required)

- Required: `LayoutPlanViewport.svelte` `onKeyDown` (`:3371`, `physicalWall`
  branch `:3515-3524` is the template) — new branch
  `selection.kind === 'junction' && planViewMode === 'layout'` →
  `onJunctionDissolve?.(junctionId)` through the guarded transaction
  (`onLayoutTransactionBegin/Commit/Cancel`), including the Arrange-exclusion
  rationale. Prop threads `LayoutPlanViewport → PlanWorkspace` exactly like
  `onWallDelete`.
- Follow-up (out of this slice): Inspector dissolve button, Navigator row
  action, tree row action, Plan context-menu item (`plan-menu-items.ts:73`
  `addJunction` is the symmetry precedent). None may become a second
  eligibility authority; the planner owns all decisions.

## 9. Test matrix (new files only, `p23-dissolve-*.test.ts`)

Core: degree 0/1/2/3+; unknown Junction; self-loop; shared-both-endpoints;
duplicate-`E1—E2` wall; role/thickness/height mismatches isolated; name
absent/equal/single/different; line-collinear in all three orientation
configurations; line-angled (90°, 179°); line+curve both orders;
curve+curve unrelated join (sampled-point equality); knot-promoted and mid-span
split→dissolve round trips (geometry identical); **traversal-mirror pinning test
(blocker fix): `wallCenterlineCubics(joined, E1, E2, 'forward')` must equal
`[...wallCenterlineCubics(cA,…,travA), ...wallCenterlineCubics(cB,…,travB)]`
cubic-for-cubic, exercised with at least one reverse-traversed side**;
Openings all-on-one / split-across-both / abutting-J / reverse-rebase
arithmetic / door `connectsRoomIds` preserved; Rooms single/shared/partition —
reconciled boundary must equal the expected single-survivor-ref cycle
(reconciliation-owned, never a manual rewrite) — plus forced-birth/retire
`room_identity_lost`; straightness tolerance: post-split rounding residue joins,
clearly-angled rejects; every core rejection asserts the input document is
deep-equal unchanged (history-untouched is asserted at the editor/integration
level, since the core planner owns no history). Editor: one history entry, exact-JSON Undo, selection
→ `none`, Arrange-mode Delete inert, per-code messages. Save/codec round trip
of a dissolved document.

## 10. Files changed + concurrency notes

| File | Change | Risk |
|---|---|---|
| NEW `packages/layout-core/src/layout-wall-dissolve.ts` | `planDissolveJunction` + `DissolvePlan`/`DissolveRejection` types + dissolve identity assert; calls shared `reconcileRooms`, `validateWallFirstOpeningSet`, `validateWallFirstPortalRelations`, generic `validateAndCompile<DissolvePlan>` — no pair-rewriter, no manual room rewrite | None — new file, call-only deps |
| `packages/layout-core/src/layout-wall-topology-ops.ts` | Generalize private `validateAndCompile` (`:211`) to `validateAndCompile<T>` per §6, export it — existing callers instantiate `T = WallFirstOpPlan`, behavior unchanged | Minimal; the generic is the only review-mandated refactor in shared code |
| `packages/layout-core/src/layout-wall-centerline.ts` | ONE traversal-orientation helper sharing `wallCenterlineCubics` mirror logic (§5) | Low — additive, adjacent to the logic it shares; no behavior change to existing callers |
| NEW `packages/layout-core/src/*dissolve*.test.ts` | suites | None |
| `packages/layout-core/src/index.ts` | export lines | Trivial |
| `apps/editor/.../layout/layout-preview-state.svelte.ts` (`:1768` area) | append-only adapter | Low |
| `apps/editor/.../layout/LayoutPlanViewport.svelte` (`:3515` area) | one key branch + one prop | **Merge-hot — rebase late**: P23.13 edits this file; keep the branch minimal |
| NOT touched | noding/topology-ops logic, curve algebra, history, selection model, Scene/Camera/visitor, Inspector/Navigator/tree/menus | — |

Land order for isolation: core + unit matrix first (pure, reviewable alone) →
adapter + key wiring rebased onto latest P23.13 → Inspector follow-up only if
merge-safe, else P23.14.

## 11. Acceptance criteria

1. Degree-2 joinable Junction dissolves into one Wall; Undo restores the exact
   pre-dissolve document (JSON-deep-equal).
2. All §3 ⛔ cases reject with their stable code; input document unchanged
   (asserted per code at core level; history-untouched asserted at
   editor/integration level).
3. Straight and curve split→dissolve round trips preserve sampled geometry
   exactly; the traversal-mirror pinning test passes with reverse-traversed sides.
4. Openings rebase exactly in all orientations; doors keep `connectsRoomIds`;
   shared Opening-set/portal gates green.
5. Room IDs/count preserved with reconciliation-owned boundaries; any
   birth/retire rejects (`room_identity_lost`).
6. One success = one `layout` history entry; selection → `none`;
   Arrange-mode Delete inert.
7. Delete/Backspace on a selected Junction works (the single required UI path).
8. No copied gate logic: dissolve's final validation calls the shared generic
   `validateAndCompile<T>` with `T = DissolvePlan`; reversal logic exists in
   exactly one implementation.
9. `npm test`, `npm run check`, `check:layout-core`, visitor isolation checks pass.

## 12. Identity decision (resolved — no open items remain)

**Identity ledger — resolved, no inspection needed.** The dissolve planner
performs no identity-specific mutation: the candidate carries the baseline
ledger untouched, and existing commit-time identity promotion is the authority.
Verified in `packages/layout-core/src/layout-identity.ts`: `resolveLayoutIdentity`
(`:331-368`) keeps every assignment whose canonical ID is still live (`:344-349`),
rebuilds each family from the live-ID sets so dead entries drop (`:342-361`),
and sets `cursor = next >= base >= ledger.cursor` — never backward
(`:336,359-360,364`), so a pruned reference is never reassigned. At dissolve
commit, the existing promotion seam (same path as wall-delete:
`runLayoutMutation` → `commitLayoutTransaction` → `promoteLayoutIdentity`)
therefore resolves automatically: the survivor Wall keeps its existing
assignment; the retired Wall and Junction assignments prune because their IDs
are no longer live; cursor/high-water stays monotone; the demoted curve knot
receives no reference because knots are not ledger entities
(`LayoutIdentityFamily`, `layout-wall-first-types.ts:236`). Wording lock per
review: **retired Wall/Junction display references are never reassigned
(P23.12 ledger cursor guarantee); canonical ID allocation follows the existing
allocator policy and this slice adds no new never-reuse rule.**
(The collinearity policy is locked in §3; no open items remain.)
