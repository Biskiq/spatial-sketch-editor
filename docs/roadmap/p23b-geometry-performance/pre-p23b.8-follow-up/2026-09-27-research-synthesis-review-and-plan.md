# Review of the external research synthesis + the plan it implies

Date: 2026-09-27. Phase: `pre-p23b.8-follow-up`. **STATUS: REVIEW + PROPOSED PLAN. No authority is
claimed and no product code was touched by this pass.** The synthesis reviewed is the external
research returned against
`./2026-09-27-external-research-brief-room-drag-preview.md` (not committed to this repo).

Companions: `./2026-09-27-room-move-reuse-trace-record.md` (the trace) ·
`./2026-09-27-room-move-quick-sketch-design-sketch.md` (the earlier sketch) ·
`./2026-09-27-M1-release-to-presented-split-record.md` (the measured split).

---

## 0. Verdict in one paragraph

The synthesis reaches the **right architectural conclusion by the right argument**, and its two
guiding exclusions (do not build an incremental compiler now; do not move work to another thread) match
what the measurements say. Its central mechanism — *gesture-scoped transient transform, canonical
compile once at release, frozen baseline retained* — is not a metaphor here: it is the shipped,
test-enforced contract of `layout-transient-edit.ts`, and the room release path **already** re-derives
from the frozen baseline at the release point, which is the one fact that makes removing the per-move
work safe. Three things in it are wrong or unknown in ways that change the plan: it assumes a
room-unit proposal that **does not exist** (and treats it as a route rather than new core surface); it
treats the 3D consumer as an open unknown when it is **resolved in our favour**; and it prices the
trade as a refusal-colour loss when the per-move validity signal is in fact **read by no production
renderer**. One term it never prices — the cost of the *added* per-move work — is the largest
uncertainty in the whole proposal.

---

## 1. What is confirmed in code (not inferred)

**1.1 The template is real and stricter than the synthesis assumes.** `layout-transient-edit.ts:1–25`
states the contract verbatim (capture baseline + transaction · proposal + cheap preflight, install
nothing, write no history · one planner call at release · cancel leaves the baseline exact) and says of
itself *"Nothing here is an acceptance authority"* and *"the preflight can refute an attempt early but
never accept one."* The release entry point (`releaseArchitectureEdit`) documents that it "owns only
the *order and the count*: at most one planner call, exactly one of commit/cancel, and an exact
baseline whenever the planner refuses."

**1.2 The room release is already baseline-scoped and release-point-derived — so the per-move work is
preview-only.** `LayoutPlanViewport.svelte:4021–4090`, decisively at `:4046–4047`:

```text
updateLayoutRoomUnitDrag(interaction, point, …)          // the RELEASE point
restoreLayoutPreviewSnapshot(preview, roomUnitSnapshot)  // the frozen baseline
previewWallFirstRoomMove(preview, drag.roomId, drag.translation)
  → success ? onLayoutTransactionCommit() : onLayoutTransactionCancel() + restore
```

The comment above it says so: *"re-derive the candidate once from the RELEASE point: the final pointer
position is authoritative, so an invalid final release can never commit the previously previewed
candidate."* The synthesis's load-bearing claim ("the per-move installs are discarded at release") is
therefore **verified in shipped code**, and Slice A cannot change what commits *provided this path is
left alone*.

**1.3 The synthesis's "generalize the intent to a set of walls" is the smallest core change, and the
soundness argument survives it.** The proposal and the preflight share **one** intent→candidate mapping
(`architectureCandidatePatch` → `spliceWallFirstArchitectureCandidate`, documented as *"the **single**
intent→candidate mapping shared by the render proposal and the preflight below, so neither can invent
geometry the other does not have"*). Extending the intent to a wall set extends both at once, so the
preflight's "sound by construction" property (same function, same values, same gate the planner runs
first) is preserved rather than re-argued.

**1.4 The two exclusions match our evidence.** Incremental compilation is not needed to remove the
measured jank (the per-move work is *repetition*, not magnitude), and no Worker/WASM path can shorten a
wait that the split already placed after the page's last JavaScript mark.

---

## 2. Three corrections — each of which changes the plan

### 2.1 There is no room-unit proposal and no room-unit preflight. It is new core surface.

The synthesis's Slice A reads as "route the room drag through the existing transient mechanism." That
mechanism does not cover room units. Core exports exactly:

```text
proposeWallFirstArchitectureGeometry(document, intent)     // junction / rigid wall / curve / bend
preflightWallFirstArchitectureCandidate(document, intent)  // the cheap canonical gate
planWallFirstRoomMove(...)                                 // the FULL room planner
```

— and nothing else. So the per-move work the room drag pays today is not "a proposal done
expensively": `LayoutPlanViewport.svelte:3744–3757` calls **`previewWallFirstRoomMove` — the full
planner — on every pointermove**, which is why the trace measured 5 full compiles and 6 mesh
preparations per accepted action.

Consequence for the plan: Slice A is **(a) new core surface** (a room-unit proposal, i.e. a rigid
translation of the moved unit's own sampled centerlines; optionally a room-unit preflight) **+ (b) the
viewport rewiring**. Core lives in `packages/layout-core`, the canonical geometry authority's package,
so (a) is not a viewport-local refactor and needs that owner's authorization. The synthesis's "smallest
change" framing is right; its implied boundary is wrong.

### 2.2 The 3D consumer is resolved, and it is not a blocker.

Both the earlier sketch and the synthesis treat "who consumes the installed preview during the drag"
as the first read to do. It is already answered:

- `LayoutPreviewScene.svelte` takes **both** a committed source and an optional transient bundle, and
  the deriveds prefer the transient: `activeGeometry = transient?.geometry ?? geometry`,
  `activeModel = transient?.model ?? model`, `activeWallMeshes = transient?.wallMeshesByRoom ?? …`.
- `Workspace3DView.svelte:419` **does** wire it — `transient={layoutTransient}`, written by the gizmo
  adapter at `:472`.
- But `Workspace3DView` is mounted in an **`{:else}` branch** of `EditorApp.svelte:2250`: the Plan cell
  and the 3D cell are alternatives, not coexistents.

So during a **Plan** room drag — the only place a room-unit drag can start
(`LayoutPlanViewport.svelte:3455/:3484`) — **the 3D scene is not mounted**, and nothing consumes the
per-move installed generation outside the Plan. No translated mesh input is required, and the
presentation set is Plan-local. *Caveat to carry: if room units ever become draggable in 3D, this
reopens — and the transient bundle the 3D scene accepts is today written by a path that derives a
**full** candidate (`layout-gizmo-candidate.ts:300–338`, a complete `derivePreviewBundle`), which is
prior art for the seam and not a cheap source.*

### 2.3 The refusal-feedback trade is not the trade the synthesis thinks it is.

The synthesis warns that cheapening the preview moves refusals from "red while dragging" to "red at
release". Measured against the code:

- per move, the failure path writes `preview.statusMessage = result.message`
  (`LayoutPlanViewport.svelte:3747`);
- per move, it also sets `drag.candidateValid` — and **no production renderer reads it**. In
  `apps/editor/src` the symbol appears only at its declaration/comments in `layout-interaction.ts`
  (*"never part of an undo snapshot"*, presentation-only) and at the two write sites; the only
  assertions on it anywhere are gesture tests and an opening-placement test for a different feature.

So today's live signal is (i) a status line on failure and (ii) **the geometry itself** — the drag
shows a fully recompiled candidate with junctions, walls and rooms already resolved. Moving the planner
to release therefore does not remove a rendered refusal colour; it changes **what the drag's geometry
is**: a fully evaluated candidate becomes a rigidly translated copy of the unit. That is a geometry-
fidelity change, not a feedback change, and it is the same change the wall drag already ships and
P23.10/P23.11 already accepted.

It also follows that **the fast path does not require a preflight at all.** The wall path has one
because it renders live refusal; the room path's only live refusal is a status line, which the release
planner can still deliver. A proposal-only per move is strictly smaller, adds no gate, and — see §3 —
avoids re-introducing the snap index.

---

## 3. The term nobody has priced: the added per-move work

The synthesis tabulates what the fast path **removes** and correctly notes the added side "must be
measured". The measurement that matters, from our own D5 pass:

> a single-Wall drag's *entire* per-gesture heavy term is `snap-wall-index` at **173.2 / 231.3 ms p50**
> on all-curved (13.3 / 13.8 ms on the straight control), and it is provably paid outside the
> synchronous release.

The room path today runs **no snap index at all** — grid snap only (`layout-interaction.ts:1457–1462`,
the translate branch is `snapToGrid(currentWorld)` and nothing else). So a room preflight that consults
wall topology could inherit a cost of the same order as everything it removes, and would move the
problem rather than delete it. This is not a reason to stop; it is the reason the plan's first step is a
**probe, not a patch**, and it is the reason to prefer proposal-only (no preflight) as Slice A0 and any
preflight as a separately measured Slice A1.

Falsifier to state up front: if the added per-move proposal + preflight costs ≥ the removed per-move
work on the all-curved fixture, the fast path fails and the room drag keeps its current pipeline.

---

## 4. What the synthesis cannot know about this repo, and the plan must respect

- **The reuse ratchet measures this exact path per move.** `p23b5-reuse-ratchet.ts:203–227` drives
  `transientArchitectureEdit` over `REUSE_RATCHET_MOVES` and counts fresh calls per move. A new
  room-unit transient is therefore *expected* to be measured there; the ratchet is test-enforced and
  only `npm run reuse:record --reason "…"` may move it. No new cache, no second sample store.
- **The instruments are DEV-only and product modules are fenced.** The follow-up's authorized scope was
  measurement + ranking, expanded once by explicit owner authorization. Product modules
  (`packages/layout-core`, the viewport) are not covered by that.
- **P23B.8's entry gate is unaffected either way.** Nothing here establishes a compute-bound
  prerequisite; the synthesis's exclusion of Worker/WASM is consistent with our measured placement of
  the cost.
- **Session conditioning.** M1's absolutes move ×0.38–×1.03 between sessions; any before/after is
  same-session only.

---

## 5. The plan

Sequenced so that every step is falsifiable, the first step changes no product code, and the fast path's
one irreversible UX consequence is decided by the owner before it is built.

### P0 — price the added side (no product change; DEV-only probe) — *this is the gate*

1. **Parity differential for rigid translation.** For each committed fixture class, compare
   `translate(baseline)>compile<` against `compile(baseline translated as a document)` over the moved
   unit: centerline sample identity, junctions, openings, room faces/boundaries, label anchors,
   bounds. Report the classes where they are **not** equivalent and say so — do not claim equivalence
   for a fixture where it fails. Output: the exact fixture list on which the fast path can be truthful.
2. **Cost probe.** Measure the room-unit proposal (rigid shift of the unit's own sampled centerlines,
   no resampling) and a candidate room-unit preflight, per move, on the all-curved fixture, against the
   per-move work they replace (5 compiles × 31.0 ms + 6 preparations × 70.6 ms + 6 restores × 9.9 ms,
   Electron p50, same session). **Go/no-go: the added side must be at least an order of magnitude
   smaller than the removed side.**
3. **Consumer census.** Instrument/diff to prove that during a Plan room drag the only readers of the
   installed generation are the Plan surfaces (i.e. `Workspace3DView` unmounted; no other per-move
   subscriber), so the presentation set is complete.
4. **Per-gesture call-count baseline** to compare against: restores, compiles, installs, preparations,
   Plan renders, history writes per accepted action, by class.

### P1 — core: the wall-set intent (owner authorization required)

5. Extend `WallFirstArchitectureProposalIntent` (or add a sibling room-unit intent) to a set of source
   Wall IDs, implemented inside the existing `architectureCandidatePatch` /
   `spliceWallFirstArchitectureCandidate` pair so proposal and preflight continue to share one mapping.
6. Differential tests: the new proposal must agree with `planWallFirstRoomMove`'s own resulting unit
   translation on the P0.1 fixture list, and must be **refutation-neutral** if a preflight is added
   (a `pending` verdict may never change an outcome).
7. Add the path to the reuse ratchet's measured set and record nothing else.

### P2 — viewport: the room drag stops calling the planner per move

8. Replace the per-move `restoreLayoutPreviewSnapshot` + `previewWallFirstRoomMove` pair with the
   transient proposal, rendered as an overlay in the existing pending token language
   (`plan-overlays.ts` already draws the room unit's member bounds while a drag is live —
   `plan-overlays.ts:320`, P23.6a §S6).
9. Leave the release path textually intact. Assert per gesture: **1 compile, 1 install, 1 preparation,
   1 history entry**; and per move: **0 compiles, 0 installs, 0 history writes**.
10. Keep `drag.candidateValid`'s existing semantics or delete its write sites deliberately — do not
    leave a flag that is written and never read as if it were a signal.

### P3 — presentation

11. Overlay = the baseline's own sampled centerlines **shifted**, never resampled (a resample could
    place the drawn curve fractionally off the committed one).
12. Room-derived presentation during the drag (fill, outline, labels, areas, dimensions) shifts with
    the unit and stays truthful; nothing canonical is updated from preview geometry.
13. The original stays drawn under the overlay (the wall drag's accepted UX, a larger visual delta for
    a room) — show the owner a still before building, since this is the visible consequence.
14. Reconciliation on commit: the accepted generation replaces the preview in one visible update — no
    double-drawn geometry, no baseline flash, no one-frame transform jump.

### P4 — verification (before any claim of improvement)

15. All eight existing invariants in `layout-room-move-gesture.test.ts` pass **unmodified** (history
    count, cancel exactness, refusal reason still on screen after restore, `no_op` silence, eligibility,
    byte-equivalence, selection survival, install-not-recompute).
16. Same-session before/after on the corrected M1 protocol, both runtimes, all four fixtures: gesture
    frame series, long-frame incidence, input-blocking duration, and the release→presented wait
    (unchanged by construction — state that it is the control, not a result).
17. Gates: `check` · `test` · `test:arch` · `test:heavy` · `test:perf` · `build` · visitor bundle ·
    focused suites. Baseline and reuse ratchet untouched except by their own writers.

### Deliberately outside this plan

- **Incremental canonical compilation** (synthesis §7) → routed to P26 as a separately measured
  problem, entry condition: accepted-generation work becomes a measured bottleneck.
- **The 62–68 ms generation-identity comparison remainder** (D4) → still needs its owner's ruling;
  Slice A removes it from the *live loop* without answering whether it should ever run per move.
- **D5's `$state` read amplification** (173–231 ms snap index) → P23B.7 family; relevant here only as
  the risk Slice A1 would take on.
- **The post-JavaScript tail in the release wait** (47–78 %) → P26 P6/P1; needs trace event durations.

---

## 6. What would make this plan wrong

- P0.1 finds translation non-equivalence on the classes that matter (i.e. the drag's honest preview
  would visibly differ from what commits) → the fast path is not admissible without a fully evaluated
  preview, and the work returns to "make the per-move evaluation cheaper" (D4/D5/D10), not "remove it".
- P0.2 finds the added side comparable to the removed side → the win is a reshaping, not a deletion,
  and the smallest useful slice shrinks to the release-only parts.
- P0.3 finds a per-move consumer outside the Plan (a live 3D mount, an export, a thumbnail) → the
  presentation set grows and needs a translated input for that consumer.

## 7. Anchors

```text
CONTRACT   layout-transient-edit.ts:1–25 · :122–200 (the attempt) · releaseArchitectureEdit
TEMPLATE   packages/layout-core/src/layout-wall-first-precision.ts:941 (proposal) · :1404 (preflight) ·
           architectureCandidatePatch / spliceWallFirstArchitectureCandidate ("the single mapping")
TODAY      LayoutPlanViewport.svelte:3455 · :3484 · :3744–3757 (the per-move FULL planner call) ·
           :4046–4047 inside :4021–4090 (the release re-derive from roomUnitSnapshot)
           layout-interaction.ts:45–53 (candidateValid = presentation only) · :1448–1462 (grid snap only)
ABSENT     packages/layout-core/src/layout-room-move.ts:158 — the planner, and no room proposal/preflight
3D         EditorApp.svelte:2250 (`{:else}` — Plan and 3D are alternatives) ·
           Workspace3DView.svelte:125 · :419 · :472 · LayoutPreviewScene.svelte:83–89 ·
           layout-gizmo-candidate.ts:300–338 (the existing transient bundle, a FULL derive)
RATCHET    apps/editor/src/lib/bench/p23b5-reuse-ratchet.ts:203–227 (per-move measurement of this path)
EVIDENCE   ./2026-09-27-room-move-reuse-trace-record.md · ./2026-09-27-M1-release-to-presented-split-record.md
```
