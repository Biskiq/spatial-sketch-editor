# Research brief — live preview of a rigid multi-element transform costs ~10× the frame budget

*Self-contained problem summary for external research. No internal code names or paths are needed to
answer the questions in §6.*

---

## 1. The product and the gesture

A browser-based 2D floor-plan / spatial sketch editor (SVG plan view, Svelte front end, also shipped as
an Electron desktop app). Users draw walls; **rooms are derived regions bounded by walls** (the room is
not independent geometry — move its walls and the room, its area, its labels and its topology follow).
Editing is direct manipulation with the pointer.

Two of the gestures are the subject here:

- **Drag a single wall** — a rigid translation of one wall (both endpoints move by one delta).
- **Drag a whole room** — a rigid translation of a room and every wall bounding it (possibly several
  connected rooms at once).

Both are committed as one edit when the pointer is released.

## 2. The symptom

User-reported and instrumented:

| gesture | median frame interval | frames over 50 ms | input blocked, median |
|---|---:|---:|---:|
| drag a wall, straight walls | 17 ms (≈60 fps) | 1 of every 6 | ~8 ms |
| drag a wall, curved walls | 18 ms | 3 of every 6 | ~93 ms on the slow frames |
| **drag a room, straight walls** | **109 ms** | **5 of every 6** | **62 ms** |
| **drag a room, curved walls** | **231 ms** | **5 of every 6** | **176 ms** |

So: dragging a wall feels smooth (one hitch per gesture), dragging a room is continuously choppy, and
curved walls roughly double the cost. Releasing the pointer — the commit itself — is *not* part of the
problem; it is measured and feels fine.

Measured on a 40-wall document, one machine, dev builds, two browser engines (Chromium 134 in Electron,
Chrome 152), synthetic gestures of 4 pointer moves each. The *ratios and per-move counts* are the durable
findings; the absolute milliseconds are session-conditioned.

## 3. What each gesture does per accepted action (measured, 40-wall document)

**Drag a room** — every pointer move:

1. restores a snapshot of the document taken at pointer-down (the *frozen baseline*) — **6× per gesture,
   ~10 ms each**;
2. re-derives the whole document from that baseline with the current total pointer delta
   (`baseline + translate(room, delta)`);
3. **recompiles the whole document** through the single canonical compile function — **5× per gesture,
   ~31 ms each**;
4. installs the compiled result and rebuilds a derived geometry/mesh cache — **6× per gesture,
   ~71 ms each**;
5. re-renders the plan view — **8× per gesture, ~8 ms each**.

**Drag a wall** — per pointer move: one snap resolution and one transient *proposal* (overlay geometry
only, ~0.6 ms). The compile happens **once, on release** (acceptance), and then the accepted compile is
*installed* rather than recomputed. Its only heavy term per gesture is one snap-index derivation
(~190 ms) that runs once, not per frame.

## 4. The two findings that matter for research

**(a) Only ~3.3 of the 40 walls actually change per pointer move** (the drag also runs for a single wall:
~3 of 40 change). Yet 100 % of the document is recompiled and 100 % of the walls are re-checked on every
move. The work is *repeated*, not heavy.

**(b) The reuse mechanism works and is nonetheless the dominant cost.** The derived mesh cache is keyed
by the *identity of the compiled geometry object*. Every move installs a new object, so the cache misses;
the fallback is a per-element **value comparison** across the whole document, which then correctly reuses
**~36.7 of 40 walls** and rebuilds ~3.3. That comparison is ~69 ms of the ~71 ms preparation. In other
words: the system pays a whole-document comparison to *discover* that 92 % of the document is unchanged,
when the caller already knew what it had changed (`baseline + translate(room, delta)`).

## 5. The constraints any recommendation has to survive

This is where generic advice (threads, caching, GPUs) tends to be inapplicable:

1. **One canonical geometry authority.** The committed geometry must be produced by one compile function;
   a preview that is computed differently must not be able to commit something else.
2. **Frozen-baseline derivation.** Every preview candidate must be derived from the immutable
   pointer-down baseline plus the *total* pointer delta — never accumulated per move, never from a
   remembered intermediate. The commit is re-derived once at release from the release coordinate against
   that same baseline.
3. **Preview is not an acceptance authority.** The drag may show a candidate the release will refuse; the
   release planner decides, and refusal must be visible while dragging as advisory feedback.
4. **One history entry per accepted gesture**; a refused or no-op release must leave the baseline exactly
   as it was and write no history.
5. **No new caches.** Retention of derived data is owned by an existing reuse ratchet that is
   test-enforced; adding a second store for this would be rejected.
6. **No threads, no WASM.** The published constraint is that the fix must not be "move it elsewhere".

## 6. The questions

1. **Live-preview architecture for rigid transforms of many elements.** What do mature editors do —
   transient overlay/ghost layer over an unchanged model, or live re-evaluation? How do they guarantee
   the preview and the committed result cannot diverge, given the preview may use a cheaper path?
2. **Avoiding whole-model recompute when a small connected subgraph changes.** What invalidation
   architectures are standard — dirty flags / per-node revisions, dependency or action graphs,
   incremental recompute, retained scene graphs, structural sharing, memoization on content hashes?
   Which of these survive a "one canonical compile" authority?
3. **Cheaply answering "what changed".** How do mature systems avoid value-comparing everything? (first-
   class transform/provenance records, versioned nodes, identity-based reuse with generation lineage,
   content-addressed keys, change journals.) What are the failure modes?
4. **Derived and aggregate data under a rigid translation** (rooms, areas, labels, adjacency, spatial
   indices, pick/frame indices): shift them, rebuild them, or defer them — and how is consistency proven?
5. **Presentation-layer invalidation** for SVG/Canvas editors: incremental paint, layer promotion,
   avoiding full re-render per frame, and how that interacts with a retained derived model.
6. **Budgets and measurement practice.** What frame-time / input-latency budgets and instruments
   (long-animation-frame, INP, trace-based paint timing) do comparable products hold themselves to, and
   how do they distinguish "our JS is slow" from "the compositor/present stage is slow"?

## 7. Prior art worth checking (starting points, not a closed list)

- **CAD / parametric modelers** — Revit's regeneration and dependency graph with per-element dirty flags;
  Fusion 360 / Onshape feature-tree incremental rebuild; FreeCAD's recompute; AutoCAD *transparent
  commands* and its graphics-system preview ("drag a selection with a ghost, regenerate once").
- **Direct-manipulation modelers** — SketchUp's inference engine and move-tool preview layer; Blender's
  modal operators with a preview that is discarded unless confirmed.
- **Design tools** — Figma / Sketch / Penpot: what is retained during a multi-select drag, and how the
  document model stays untouched until release.
- **Incremental computation** — self-adjusting computation, incremental / demand-driven computation,
  build-system action graphs, fine-grained reactive (signal) graphs, and the "dirty cell" recalc model in
  spreadsheets.
- **EDA physical design** — incremental placement/routing with dirty regions is the closest structural
  analogy to "cheaply recompute the part of a large derived model that changed".
- **Text/reflow** — rope / piece-table buffers with incremental layout.

## 8. What a useful answer looks like here

- Named patterns with the invariants they preserve, not just techniques.
- For each: what it would change in the design above, its retention and memory cost, and its correctness
  risk against constraints §5 — especially (2) frozen-baseline derivation and (1) one compile authority.
- Prior art with specifics (product, subsystem, and ideally a description of their preview-vs-commit
  split).
- A recommendation for the **smallest** change that removes per-move whole-document recompilation and
  whole-document comparison while keeping a preview that cannot commit something different from what it
  showed.

## 9. Glossary

- **Compiled geometry** — the derived, renderable geometry produced by the single canonical compile.
- **Frozen baseline** — the immutable document snapshot captured at pointer-down; every candidate is
  derived from it.
- **Prepared mesh set / derived cache** — per-generation derived meshes, keyed by the identity of the
  compiled geometry object, with per-element reuse.
- **Transient proposal** — overlay geometry drawn for the live attempt; never installed, never history.
- **Long frame / blocking duration** — a frame ≥50 ms, and the portion of it that blocked input handling.
