# Whole-Room drag — transient implementation record

Date: 2026-09-27. Phase: `pre-p23b.8-follow-up`. **STATUS: IMPLEMENTED on the working tree, UNCOMMITTED.**
Owner-authorized as expanded scope for this PR (the plan approved 2026-09-27). No cache, no Worker, no
WASM, no baseline write, no ratchet write.

Plan this implements → `./2026-09-27-research-synthesis-review-and-plan.md`.
Evidence it was gated on → `./2026-09-27-room-move-reuse-trace-record.md` (the trace) ·
`./2026-09-27-M1-release-to-presented-split-record.md` (the measured split).

---

## 0. The change in one line

A whole-Room unit drag no longer re-derives, compiles and installs the whole document on every
pointermove; it draws a transient attempt derived from the frozen baseline and compiles **once, at
release**, where the shipped path already did. Nothing else about acceptance moved.

## 1. What actually changed

| file | change |
|---|---|
| `packages/layout-core/src/layout-room-move.ts` | The planner's candidate construction is extracted as `roomUnitMoveCandidate(document, subgraph, delta)` and the planner calls it, so the preview and the release share **one** moving-set→candidate mapping (the rule the P23.11 architecture proposal already follows). Adds `proposeWallFirstRoomUnitGeometry` (translate) plus the parity-evidenced rotation pair, `rotateRoomUnitMoveCandidate` / `proposeWallFirstRoomUnitRotation`. |
| `apps/editor/src/lib/editor/layout/layout-transient-room-unit.ts` | **New.** `transientRoomUnitMove(...)`: the render-only attempt for one pointermove — the moving set's canonical centerlines, sampled through the one canonical sampler, plus the unit's Room floor outlines shifted by the same delta. Returns `null` for no baseline, no frozen moving set, or a zero delta. |
| `layout-interaction.ts` | `LayoutRoomUnitDrag` now carries `unitWallIds` / `unitJunctionIds` — the moving set, resolved **once** at pointer-down through the planner's own isolation policy, so no pointermove re-resolves it. |
| `plan-overlays.ts` | `LayoutRoomUnitMoveIntent` + `withRoomUnitMoveIntent(...)`: draws the attempt in the pending token language (`architecture-edit-intent`) as polylines, beside the committed ink. |
| `LayoutPlanViewport.svelte` | Pointerdown passes the frozen unit; pointermove builds the attempt instead of the restore+planner pair; the release uses the guarded baseline restore (`restoreTransientArchitectureBaseline`) and otherwise keeps its sequence; the attempt clears wherever the gesture ends; the overlay composes **inside** the refusal annotation. |
| `test-lanes.ts` | Parity differential → `HEAVY_FILES`; cost gate → `PERF_FILES`. |

Notes on two deliberate choices:

- **`drag.candidateValid` now records the RELEASE verdict**, not a per-move one: a transient drag has no
  per-move planner call to consult. The release assigns it from the one planner call, which is what the
  shipped release already did.
- **The legacy Room-unit path is untouched.** It commits its **last previewed candidate** rather than
  re-deriving at release, so a transient attempt there would change what commits. Its per-move installer
  stays.

## 2. The gate results

### P0.2 — translation parity: **PASSES, exactly**

`compile(translated document) ≡ translate(compile(baseline))` point-for-point (9 decimals) for every
moved Wall's samples, its length/thickness/height/endpoints, and every moved Room's floor polygon — over
all four committed fixtures (40-wall straight · target-curved · all-curved · owner-40-curved), three
deltas each. And the drawn attempt IS that geometry, not a second description of it: the proposal's
points equal the planner's compiled samples **and** equal the baseline's samples shifted, i.e. the
canonical points are moved and never resampled.

### P0.3 — rotation parity: **FAILS at sampling density** (recorded, not worked around)

A rigidly rotated isolated group compiles to the rigid image of its baseline Rooms (vertex-exact) and
preserves every Wall's length, thickness and height. But `samples(rotated)` and `rotate(samples)` **do
not agree on their sample count** — the compiler's sampling density depends on the curve's orientation,
so a rotation cannot be previewed by moving the canonical points; it would have to resample, which is
exactly the drift the translation path avoids. Asserted in the differential as a recorded negative.

### P0.4 — added-side cost: **136–197× margin** (same session, all-curved 40-Wall fixture)

| Room | added (proposal) | removed (planner + compile + prepare) | margin |
|---|---:|---:|---:|
| room-0 | 0.581 ms | 79.2 ms | **136.3×** |
| room-1 | 0.394 ms | 77.5 ms | **197.0×** |
| room-2 | 0.391 ms | 69.2 ms | **176.9×** |

Re-run in the perf lane: 0.391–0.581 ms added against 69.2–79.2 ms removed. The `added × 10 < removed`
premise the plan was gated on holds by an order of magnitude, and the gate is committed as a ratio
assertion (5× floor) rather than an absolute millisecond budget.

### P0.5 — per-gesture call counts

Folded into the transient contract test rather than measured separately: over five pointermoves the live
document stays byte-identical to the frozen baseline, the frozen compiled geometry is never replaced,
and there is nothing to undo. The release then commits **exactly the planner's candidate for the RELEASE
delta** — proven against the last previewed position, which was a different delta — with one history
entry and exact Undo.

## 3. The deviation: rotation is NOT wired, and why

The approved plan said "translate and rotate". Rotation is not wired. Two independent reasons, both
found by reading the code and then confirmed by measurement:

1. **It has no reachable committable target.** The Plan's rotation handle reads the legacy Room
   registry, which is empty for a wall-first document (`'floors' in layout` is false), so a wall-first
   Room cannot enter rotation mode at all; and the legacy Room-unit path commits its **last previewed
   candidate** instead of re-deriving at release, so a transient rotation there would change what
   commits — the one thing this slice must not do.
2. **Its preview is not parity-equivalent anyway** (§2, P0.3): the sampling density is not
   rotation-invariant.

So the rotation surface is implemented, parity-evidenced and documented in core
(`rotateRoomUnitMoveCandidate` / `proposeWallFirstRoomUnitRotation`, with the reason in its own doc
comment) but deliberately not wired. Wiring it needs its own release re-derive on the path that owns
rotation; that is routed, not smuggled in here.

## 4. Behaviour changes a reviewer should see

- **The original stays drawn.** The canonical baseline remains installed for the whole gesture, so the
  Room's committed ink — fill, outline, area, label — keeps describing the baseline while the attempt is
  drawn beside it in the pending language. This is the approved ghost-overlay decision and the Wall
  drag's own shipped precedent; for a Room it is a larger visual delta.
- **The group's "moving bounds" highlight no longer follows the cursor.** `buildPlanInteractionProjection`
  was left **unchanged**: it draws each group member's bounds from the installed model, which is now the
  baseline, so that highlight sits on the original. The ghost outline is what follows the pointer. Left
  unchanged deliberately — it keeps the existing projection tests untouched — and it is coherent with
  "the original stays drawn".
- **A single-Room unit now gets an attempt.** The old group overlay only drew for multi-Room units
  (`groupRoomIds.length > 1`), because the installed model showed the motion. The new intent covers the
  one-Room case.
- **Refusals appear at release.** There is no per-move preflight, by decision. An attempt the planner will
  refuse looks pending while the pointer is down and is refused at release with the reason on screen —
  which is already the only live refusal channel this path had (`drag.candidateValid` is read by no
  production renderer). Do not add a cheap gate here without measuring it: a Room-unit preflight that
  consults wall topology is what reintroduces the snap-index cost this path does not pay today.

## 5. Verification on this tree

| gate | result |
|---|---|
| editor `check` (svelte-check) | **0 errors, 0 warnings** |
| `layout-core` `check` (tsc) | **0 errors** |
| `test` (full) | **363 files / 5,142 passed** (2 files, 4 tests skipped) — was 360 / 5,129 |
| `test:arch` | **23 / 254** |
| `test:heavy` | **8 / 92** (was 7 / 89 — the parity differential) |
| `test:perf` | **9 / 64 + 1 skipped** (was 8 / 63 — the cost gate) |
| `build` | **ok** (adapter-vercel) |
| focused invariants | `layout-room-move-gesture.test.ts` **17/17 unmodified** · `layout-transient-room-unit.test.ts` 9/9 new · `layout-transient-preview.test.ts` 27/27 · `plan-overlays` 20/20 · `layout-interaction` 33/33 · `layout-room-move` 24/24 · parity 3/3 · cost 1/1 |

### Found by the wiring guard, and fixed

The wiring guard added with the tests ("each path is called exactly once") reads the viewport's source, in
this repo's existing style, because the failure mode it hunts is implemented-but-never-called. Writing it
found a real defect that would otherwise have shipped: **two gesture-exit sites cleared
`roomUnitSnapshot` without clearing the attempt** — the broad gesture reset (the one that bypasses
`finishArchitectureEditGesture`) and `clearActiveLayoutDrag()`. A project replacement or a drag clear
between them would have left a stale attempt drawn over a baseline with no gesture. Both now clear it,
and the guard asserts the two counts are equal, so a future exit site cannot be added without dropping
the attempt with it.

### Live confirmation of the per-move call counts (DEV, one real gesture)

The plan's P2.9 assertion — *per gesture: 1 compile, 1 preparation; per move: 0 compiles, 0 installs,
0 history writes* — was confirmed **live**, not only at unit level, by driving one real whole-Room drag
through the harness page's own host on the real viewport (`/dev/perf/p23b`, dispatched `PointerEvents`
with the harness's pointer-capture no-op, DEV build, Chrome, `owner-40-curved-v1` at the shared ladder
zoom 19.29 px/m, `__P2311_PERF__` on). One grid step along +X from a Room-interior grab, 4 pointermoves,
then release:

| what | during the 4 pointermoves | at release |
|---|---|---|
| `p2311:room-unit-proposal` | **+1 per move** — 1 · 2 · 3 · 4, at **0.5 / 0.6 / 0.5 / 1.4 ms** | 0 more |
| `p2311:preview-compile` (+`-reused`) | **+0 per move, all four** | **exactly 1** (52.6 ms) |
| `p2311:mesh-prebuild` | **+0 per move, all four** | **exactly 1** (12.2 ms) |
| pending-language polylines drawn (`architecture-edit-intent`) | **5 while the pointer is down** (the moving unit's 4 Walls + the Room ring; 0 before the gesture) | **0 after** — the attempt dies with the gesture |
| history | — | status reads **"Moved room"** and **one** Undo returned the Room's fill rect to its exact pre-gesture position (345,194 → 341,192, the gesture's own ≈4.4 px travel) |

So the live loop pays one bounded proposal per pointermove (≤1.4 ms, ~100× under the 70 ms preparation it
replaced) and reaches the canonical path exactly once per gesture. The ghost drawn beside the committed
ink is what makes the motion visible, which is also the direct evidence for the approved "the original
stays drawn" presentation. This is a **call-count and duration** confirmation on one gesture, not a frame
series and not a before/after (see §6).

One existing test was **changed**, deliberately and not weakened: `plan-refusal.test.ts`'s source-text
guard asserted the exact literal
`withPlanRefusalAnnotation(architectureEditProjection, activePlanRefusal)`, which the new nested
composition necessarily reformats. It now asserts the nested literal — the persisted refusal still
composes **over** the whole transient chain — which is strictly stronger than the string it replaced.

## 6. Limits and what is still outstanding

- **The full live protocol run was NOT repeated.** P5's same-session before/after on the corrected M1
  protocol needs a pre-change tree to measure "before" in the same session, and every recorded M1
  absolute is session-conditioned (×0.38–×1.03 with no code change). Rather than publish a cross-session
  comparison that the evidence rules out, this record states the unit-level gate (§2) and the live
  per-gesture call counts (§5), and leaves the live **frame series** as the outstanding step. **The
  gesture-frame improvement is therefore established as a mechanism, a unit-level ratio and a live
  per-gesture call-count accounting — not as a measured browser frame series.**
- Unit-level, not app-level: the P0.4 numbers price the proposal against the planner + compile +
  preparation, which is the removed per-move work, but they are not a frame series and they are DEV-build.
- Synthetic: the committed fixtures and fixed deltas, one machine, one session. The four-move gesture and
  the 40-Wall fixtures are the same ones the M1 evidence uses, so the mapping is consistent, but no claim
  is made about the user's own project or viewport.
- No 3D consumer was touched or measured, because the 3D scene is not mounted during a Plan drag
  (`EditorApp.svelte:2250`). If Room units ever become draggable in 3D, the presentation set grows.
- Untouched by design: the per-Wall comparison remainder (D4) still runs once per release; D5's read
  amplification is unaffected; the post-JavaScript tail in the release wait is unaffected and was the
  control in the split pass.

## 7. Anchors

```text
CORE        packages/layout-core/src/layout-room-move.ts — roomUnitMoveCandidate ·
            proposeWallFirstRoomUnitGeometry · rotateRoomUnitMoveCandidate (the routed rotation)
ATTEMPT     apps/editor/src/lib/editor/layout/layout-transient-room-unit.ts
STATE       layout-interaction.ts — unitWallIds / unitJunctionIds on the drag
OVERLAY     plan-overlays.ts — LayoutRoomUnitMoveIntent · withRoomUnitMoveIntent
VIEWPORT    LayoutPlanViewport.svelte — pointerdown unit · pointermove attempt · guarded release
            restore · attempt cleared with the gesture · projection composed inside the refusal
TESTS       tests/lib/layout/p23b-room-unit-proposal-parity.test.ts (P0.2/P0.3 differential)
            tests/lib/layout/p23b-room-unit-proposal-cost.test.ts (P0.4 ratio gate)
            tests/lib/editor/layout/layout-transient-room-unit.test.ts (the transient contract)
LANES       test-lanes.ts — HEAVY + PERF additions
UNCHANGED   layout-room-move-gesture.test.ts (17/17, unmodified) · buildPlanInteractionProjection
```
