# Design sketch — could the whole-Room drag use the Wall drag's quick-sketch mode?

Date: 2026-09-27. Phase: `pre-p23b.8-follow-up`. **STATUS: A SKETCH, NOT A PLAN.** No authority is
claimed and no code was written. It answers one question — *what would the room drag look like if it
used the same mechanism the wall drag uses, and what would have to stay true for the committed result to
be identical* — and it names the reads that must happen before anyone could call it safe.

Companion: `./2026-09-27-room-move-reuse-trace-record.md` (the trace this builds on).

## 1. What "quick-sketch mode" actually is

It is a shipped, tested contract, not a loose description. Its own module states it
(`layout-transient-edit.ts:1–25`):

```text
pointerdown   → capture the immutable canonical baseline + one transaction
pointermove   → derive a PROPOSAL from baseline + current intent, run the cheap canonical preflight,
                render it transiently, install nothing, write no history
pointerup     → one canonical planner call, full topology / Room / Opening / portal / render-safe
                validation, compile, then either one Layout history entry or an exact baseline
Escape/cancel → discard the proposal, the canonical baseline stays exact

"Nothing here is an acceptance authority."  The preflight "can refute an attempt early but never accept one."
```

Per move it builds `proposeWallFirstArchitectureGeometry(baseline, intent)` — **overlay centerlines only**
— plus `preflightWallFirstArchitectureCandidate(...)` for live feedback, and hands both to the Plan as a
transient intent (`layout-transient-edit.ts:170–200`, `plan-overlays.ts:703–760`). The baseline stays
installed and drawn underneath; the attempt is drawn as an overlay in the pending token language
(refused language when the preflight already refutes it). Measured cost of that per move, in protocol:
`proposal-derive` 0.6 ms p50; `pointermove-rigid` p50 0.0 ms.

## 2. The room analogue, phase by phase

```text
POINTERDOWN — unchanged
  LayoutPlanViewport.svelte:3455/:3484 — eligibility (shared isolation policy) and the immutable
  `roomUnitSnapshot` are already captured here, and the eligible unit is already resolved
  (`groupRoomIds`). Nothing about this phase moves.

PER POINTER MOVE — the change
  keep   updateLayoutRoomUnitDrag()                       // grid snap only; the room path runs no
                                                          // snap index today (measured: absent)
  add    proposeWallFirstRoomUnitGeometry(baseline, { roomIds: groupRoomIds, delta })
             → overlay walls of the moved unit at the candidate position (a RIGID translation: the
               baseline's own sampled centerlines shifted, never resampled)
  add    preflightWallFirstRoomUnitCandidate(baseline, intent, verdictScope)
             → `pending` / `known-invalid` for the same live refusal language the wall drag shows
  render the attempt through the EXISTING overlay surface — which today already draws the room unit's
         member bounds while the drag is live (`plan-overlays.ts:320`, P23.6a §S6), so this extends an
         existing overlay rather than inventing a new surface
  drop   restoreLayoutPreviewSnapshot(preview, roomUnitSnapshot)      // :3743 — 6× per gesture today
  drop   previewWallFirstRoomMove(preview, …)                          // :3745 — its compile + install
                                                                       // + preparation, 6× per gesture

POINTER RELEASE — unchanged, and this is the point
  the code ALREADY re-derives from the release point against the frozen baseline (:4042–4072):
      updateLayoutRoomUnitDrag(release point) → restoreLayoutPreviewSnapshot(...) →
      previewWallFirstRoomMove(preview, roomId, release delta) → commit | cancel
  Nothing that decides the COMMIT is touched by this sketch: the per-move installs it removes are
  preview-only — their result is discarded and replaced at release.
```

That last line is why this is worth sketching at all: today's per-move machinery is **not** the thing
that gets committed, so making it cheaper cannot change what commits *provided* the release path is left
alone and the preview stays truthful enough to predict it.

## 3. The bill, per gesture (all-curved 40-Wall fixture, Electron)

| | today | sketch |
|---|---|---|
| baseline restores | 6 × 9.9 ms | 0 per move; 1 guarded restore at release (the `layoutPreviewSnapshotMatchesLive` skip — a transient drag installs nothing, so the restore becomes a no-op) |
| full compiles | 5 × 31.0 ms | 1, at release |
| mesh preparations | 6 × 70.6 ms (≈69 ms of each is the comparison) | 1, at release |
| Plan re-renders | 8 × 8.1 ms | overlay renders per move + the one install's render at release |
| per-move work | — | one unit-sized proposal + one cheap preflight (the wall path's is 0.6 ms p50; the room's is O(moved unit) and **must be measured**) |

Measured work per gesture falls from roughly 700 ms of attributed time to roughly one release pass —
the same shape the wall drag already ships, where the whole per-gesture heavy term is the 190 ms snap
index and everything else is under 15 ms.

## 4. What must stay true for the committed result to be identical

**A. Already enforced today — the sketch must not weaken any of these.** Each is an existing test in
`layout-room-move-gesture.test.ts`, and they are the definition of "identical":

1. **Release-derived, baseline-scoped.** The candidate committed is re-derived at the *release* point
   from the *immutable baseline* — never the previewed candidate, never an accumulated delta.
2. **One canonical planner call per gesture**, and exactly **one history entry** on success with exact
   Undo/Redo.
3. **An invalid final release commits nothing**, writes no history, and restores the baseline exactly —
   with the reason still on screen after the restore.
4. **A `no_op` release stays silent**, like any other select-only click.
5. **Eligibility is the shared isolation policy's** (`wallFirstRoomMoveEligibility`), evaluated before
   the gesture opens; an ineligible Room selects, shows its hint, and opens no transaction.
6. **The committed document is byte-equivalent** to what the planner produces
   (`SceneDocument` byte-equivalence through a committed move), and the accepted compile is
   **installed, not recomputed** (`preview-compile-reused`, 1× — the M-4 contract).
7. **Cancel paths** (Escape, window blur, lost capture, tool/view switch, project replacement) leave the
   canonical baseline exact and zero history.
8. **Selection survives** the commit on the same canonical Room identity.

**B. New obligations the sketch creates.**

9. **The proposal and the planner must read the same intent** — the same `{roomIds, delta}` the release
   planner receives — so the drag can never show a candidate the release would not produce.
10. **The preflight is refutation-only.** It may render `known-invalid`; it must never be an acceptance
    authority, and a `pending` attempt must not change any outcome. (Mirror the wall path's test:
    *"eight moves asked for eight proposals and reached acceptance exactly zero times"* — for rooms,
    eight moves must reach zero compiles, zero installs, zero history writes.)
11. **Rigid translation must be shown without resampling.** The overlay must reuse the baseline's own
    sampled centerlines shifted, so what the user sees during the drag is derived from the same
    canonical points the commit will produce — a resample could put the drawn curve fractionally off the
    committed one.
12. **Room-derived presentation during the drag** (room outline/fill, areas, labels, dimensions) must
    still be truthful. Today these come from the freshly installed compiled model. Under a translation
    they are invariant except in position (areas, adjacency, topology unchanged), so the honest route is
    to shift them rather than rebuild — but this must be shown, not assumed.
13. **Whatever consumes the installed preview must be identified first.** This is the sketch's real
    unknown: the prepared wall meshes and the compiled model are installed per move today, and the 3D
    surface's own read of them during a room drag has never been measured (it is the open D4-2 read). If
    the 3D surface is live and visible during the drag, the sketch needs a translated mesh input — cheap
    for a rigid move — or it changes what is on screen.
14. **Every existing room-move test must pass unmodified**, and the per-gesture compile/install counts
    should be asserted directly (1 compile, 1 install, 1 preparation, 1 history entry per gesture).

## 5. Behaviour changes the sketch cannot avoid — and their precedent

- **The original stays drawn.** A transient drag never installs, so the room appears at its old position
  (installed baseline) *and* at the candidate (overlay), styled differently. That is exactly what the
  wall drag already does and what P23.10/P23.11 accepted — for rooms it is a bigger visual delta, so it
  is the part most worth showing the owner before building.
- **Refusal timing.** Today a room drag's validity comes from the planner itself each move
  (`drag.candidateValid`, plus the planner's message). With a cheap preflight only, any refusal the
  cheap gates cannot see moves from "red while dragging" to "red at release". Either the cheap gate is
  extended to cover those cases, or that change is accepted explicitly. This is the one place where the
  sketch trades a measured cost for a user-visible difference, so it is the first thing to decide.

## 6. What this sketch does not do

- No cache, no second sample store, no Worker, no WASM, no baseline and no ratchet write. The change is
  "stop doing per-move work that the release discards", not "make the work faster" and not "keep it
  somewhere".
- It does not implement the alternative direction from the trace record — *transform the prepared
  outputs* (shift the baseline's compiled geometry and prepared meshes and install that) — which would
  keep an install per move while removing the compile and the comparison, at the cost of asking whether
  a derived-but-not-compiled generation may be installed at all. That question belongs to the compile
  authority; the sketch above avoids it entirely by installing nothing during the drag.
- It does not promise a frame number. The removed side is measured; the added side must be measured.

## 7. Reproduce / anchors

```text
TRACE      ./2026-09-27-room-move-reuse-trace-record.md §1 (both paths) and §2 (the per-action rows)
TEMPLATE   layout-transient-edit.ts:1–25 (the contract) · :92–200 (intent + attempt) ·
           plan-overlays.ts:703–760 (the overlay intent and its style) · :320 (the existing room-unit
           overlay) · layout-transient-preview.test.ts (the "proposals, never acceptance" tests)
TODAY      LayoutPlanViewport.svelte:3455 · :3484 · :3730–3748 · :4042–4072
INVARIANTS layout-room-move-gesture.test.ts (history, cancel, no-op, eligibility, byte-equivalence,
           selection survival) and layout-transient-preview.test.ts (the transient contract)
```
