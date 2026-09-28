# Pre-P23B.8 follow-up — why a whole-Room move pays its pipeline per pointer move

Date: 2026-09-27. Phase: `pre-p23b.8-follow-up`. Status: TRACED + MEASURED, both runtimes.
Authority: **read-only.** This pass changed no code: it reads the shipped paths and the already-captured
protocol rows of the split pass. Gates therefore stand exactly as recorded in
`2026-09-27-M1-release-to-presented-split-record.md` §9 (same worktree, no edit since). No commit, no
baseline, no ratchet, no cache.

## 0. The question

> Trace the reuse decision on a whole-Room preview frame and report whether the per-frame work is
> required by changed geometry or caused by a rebuilt generation identity that never consults the
> reference.

**Answer: neither, and the two halves have different causes.**
The **restore and the compile are per-move by mechanism** — the room gesture re-derives the whole
document from the immutable baseline on every pointer move, so 100 % of the document is compiled for a
delta that changes ~3.3 of 40 Walls. The **preparation's 62–68 ms is caused by identity, not by changed
geometry** — and the reference *is* consulted every time: the comparison that consults it reuses ~36.7
of 40 Walls per frame. The work is not "a rebuilt identity that never consults the reference"; it is a
rebuilt identity that consults it *by value*, which is exactly what costs the tens of milliseconds.

## 1. The two gestures are different code paths

Reached from the same input path (`plan-drag-edit`) and the same press handler, but they are not the
same mechanism.

```text
A PRESS INSIDE A ROOM INTERIOR
  LayoutPlanViewport.svelte:3455   if (target.kind !== 'room') return;
  LayoutPlanViewport.svelte:3484   beginRoomUnitDrag(event, target.roomId, 'translate', point, point, subgraph.roomIds)
  → per POINTER MOVE (LayoutPlanViewport.svelte:3730)
      updateLayoutRoomUnitDrag(...)                        // total delta from startWorld
      restoreLayoutPreviewSnapshot(preview, roomUnitSnapshot)   // :3743 — the baseline goes BACK
      previewWallFirstRoomMove(preview, roomId, translation)    // :3745 — full re-derive + install
        layout-preview-state.svelte.ts:2162  planWallFirstRoomMove(layout, roomId, delta)
        layout-preview-state.svelte.ts:2171  applyWallFirstDocumentPlan(...)   // "one bundle, one compile"
          → applyCompiledLayout (state:640) → installWallMeshes + resolveWallMeshes(geometry, reference)

A PRESS ON A CANONICAL WALL
  LayoutPlanViewport.svelte:3431   beginArchitectureEditGesture(event, { kind: 'wall-move', … })
  → per POINTER MOVE (LayoutPlanViewport.svelte:3716)
      p2311Measure('pointermove-rigid', () => previewArchitectureEdit(event))
        LayoutPlanViewport.svelte:1113 — one snap, one transient proposal, one Plan update
  → acceptance (canonical planner + validation + compile) once, on RELEASE (LayoutPlanViewport.svelte:1205)
```

The room path's own design note is explicit and is the mechanism's reason, not an accident — P23.6a
(`../p23-layout-depth/2026-09-12-P23.6a-wall-first-room-unit-move.md` §S6): *"Each pointer move:
`updateLayoutRoomUnitDrag()` (total delta from `startWorld`, never accumulated), then
`restoreLayoutPreviewSnapshot(preview, roomUnitSnapshot)`, then `previewWallFirstRoomMove()` with that
total delta. The candidate is always derived from the immutable baseline."* The wall path's own note is
the mirror image: *"a move costs one snap, one proposal and one Plan update. Acceptance — the canonical
planner, the full validation suite and the compile — runs exactly once, on release."*

Why the room never takes the compiled-generation reuse is also by construction, not by accident:
`resolvePreviewCompile` (state:680) reuses only when `reusesAcceptedCompile(layout, reuse)` — canonical
JSON equality against an **accepted planner compile** that the caller hands in. During a drag there is
no accepted compile yet, so the room path takes the fallback `preview-compile` every move; the wall path
reaches the same fallback exactly once (acceptance) and then installs that result as
`preview-compile-reused` (1× per gesture, measured).

## 2. What each gesture pays per accepted action — in protocol, both runtimes

`xN` = occurrences per accepted action, `p50` = the row's own p50 in ms. All-curved 40-Wall fixture,
Electron / Chrome.

| mark | room move (`whole-room-move-bridge`) | wall move (`rigid-wall-drag`) |
|---|---|---|
| `baseline-restore` | **6× @ 9.9 / 10.4** | 1× @ 0.2 |
| └ `restore-reactive-write` | 6× @ 9.4 / 9.9 | 1× @ 0.1 / 0.2 |
| `preview-compile` (full, non-reused) | **5× @ 31.0 / 28.0** | — |
| `preview-compile-reused` | — | 1× @ 0.0 |
| `room-geometry-compile` (the core compile) | 10× @ 14.8 / 12.5 | 1× @ 9.2 / 7.0 |
| `mesh-prebuild` | **6× @ 70.6 / 64.1** | 1× @ 12.7 / 12.1 |
| `mesh-build` (Walls actually built) | 20× @ 0.4 / 0.5 → **≈3.3 per preparation** | 3× @ 0.4 / 0.7 → 3 per preparation |
| `proposal-derive` (the transient path) | **absent** | 1× @ 0.6 / 0.5 |
| `pointermove-rigid` | not marked (the room path has no such mark) | 4× @ 0.0 *(p95 212.5)* |
| `architecture-snap-resolution` | — | 2× @ 6.8 |
| `snap-wall-index` (D5's read-amplification term) | — | 1× @ 190.0 / 170.7 |
| `plan-render-model` | **8× @ 8.1 / 8.8** | 5× @ 0.2 / 0.3 |

Same shape on the straight 40-Wall fixture (room preparation 52.9 / 49.2, compile 9.9 / 8.6) and on
owner-40-curved (47.1 / 38.1, 22.5 / 17.6). On the advisory connected grid **both** classes show the
room pattern (6 restores, 6 preparations, 5 compiles, 60 builds per action) — the drag there has no
transient path either.

## 3. The verdict, item by item

| per-move cost | required by changed geometry? | cause |
|---|---|---|
| the **restore** (9.9 / 10.4 ms per move, ×6) | no | mechanism: the previous candidate is undone before the next is applied, because candidates are derived from the immutable baseline rather than accumulated |
| the **compile** (31.0 / 28.0 ms per move, ×5) | no — the compiled document changes for ~3.3 of 40 Walls | mechanism: `planWallFirstRoomMove` + `applyWallFirstRoomDocumentPlan` rebuild and compile the whole document ("one bundle, one compile") |
| the **preparation's comparison** (70.6 − 3.3 × 0.4 ≈ 69 ms per move, ×6) | **no** | identity: `prepareWallMeshes` is keyed by the generation **object** (`prepared-wall-meshes.ts`, `derivedWallMeshes` WeakMap), and every move installs a new object, so the set misses and the per-Wall value comparison runs. It **does consult the reference** (`applyCompiledLayout:644` passes the just-restored `state.geometry`) and it **does work**: ~36.7 of 40 Walls are reused per preparation |
| the **Plan re-render** (8.1 / 8.8 ms × 8) | no | the install invalidates the Plan model; the wall path re-renders on a transient proposal instead (5× @ 0.2 ms) |
| the **builds** (20 × 0.4 ms per action = 1.3 ms per move) | partially — only the ~3.3 changed Walls | correct and cheap |

So the answer to the binary is: **the per-frame work is not required by the geometry, and it is not
caused by an unconsulted reference either.** It is caused by a *whole-document* re-derive-and-install
mechanism, of which the identity-keyed mesh set then makes the value comparison the dominant term.
The comparison's own result is the proof of the second half: a preparation that reuses ~92 % of its
Walls per frame is paying to *discover* what a provenance-aware path would already have known.

For contrast, the wall move's entire per-gesture heavy term is `snap-wall-index` at 190.0 / 170.7 ms —
the D5 read-amplification finding, once per gesture, not per frame — and everything else it pays per
gesture is under 15 ms. That is what "relatively smooth" looks like in marks, and why the room move is
not.

## 4. What this does and does not establish

```text
ESTABLISHED
  · the two gestures are different paths, with a design note each saying what they intend (§1)
  · per move, the room gesture restores, re-compiles the whole document and installs it (§1, §2)
  · the mesh preparation is handed the reference and reuses ~92 % of Walls per frame (§2, §3)
  · therefore the comparison (not the build) is the per-frame mesh cost, and it is identity-keyed
  · the wall gesture pays that same class of work ONCE per gesture, so its smoothness is explained too
NOT ESTABLISHED
  · that a provenance/transform-aware path would be CORRECT (the isolation, junction and room-eligibility
    rules that the re-derive enforces are exactly what a shortcut would have to keep)
  · what fraction of the 70.6 ms comparison is `$state` proxy read amplification (the 12.1× ratio is
    measured; the per-field mechanism is not)
  · behaviour on a production build, or on layouts unlike the fixtures (wall count, room size, zoom)
  · which of the three candidate directions below is acceptable under the P23B.5 ratchet
```

## 5. The three candidate directions (product, and each needs a ruling)

1. **Provenance on the new generation** — carry «baseline + room R moved by delta» and reuse the
   baseline's prepared set, rebuilding only the moved unit's Walls, instead of comparing 40. Keeps the
   immutable-baseline guarantee; removes the comparison. Touches preview-state + the mesh-retention
   owner (P23B.5).
2. **Stop installing a compiled preview per move on this path** — the shape the wall gesture already
   uses (transient proposal per move, compile once at release). Largest behaviour change; the most
   directly comparable to something already shipped and working.
3. **Transform the prepared outputs** for a known translation rather than re-deriving geometry. Cheapest
   in principle, most invasive to the compile authority.

All three are product/ratchet decisions; nothing was implemented, and none of them is a Worker or a WASM
question — the work is repeated per move, not computationally unavoidable.

## 6. Reproduce

```text
TRACE     the anchors in §1: LayoutPlanViewport.svelte:3455 · :3484 · :3716 · :3730–3748 · :1113 · :1205;
          layout-preview-state.svelte.ts:640–652 (applyCompiledLayout) · :680–699 (resolvePreviewCompile) ·
          :2155–2175 (previewWallFirstRoomMove); layout-interaction.ts:1426 · :1448;
          prepared-wall-meshes.ts (the WeakMap and the per-Wall comparison)
ROWS      ./2026-09-27-M1-restore-split-electron.json · -chrome.json (the §2 columns: each class's `marks`
          rows — count, p50, maxPerAction — over `population.measuredAccepted`)
LIMIT     the four §2 rows come from the harness's own gestures (4 driven moves per drag), so the
          per-MOVE counts are the harness's; the per-ACTION totals are what the record quotes.
```
