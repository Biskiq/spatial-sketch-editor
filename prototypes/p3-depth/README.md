# P3 · Architectural depth

A design study of how far P3 Vellum can carry intuitive, context-aware architectural creation
without becoming a CAD/BIM modelling tool. Three evaluators, one sheet, thirty fixtures.

The argument is in **[DESIGN.md](DESIGN.md)**. This file is how to run it.

> **Status: prototype only.** Nothing here is production code or ratified architecture, and
> nothing outside `prototypes/p3-depth/` was modified. It lives in its own worktree,
> `p3-depth-lab`, on branch `design/p3-architectural-depth`.

## Run it

No dependencies, no build step, no network.

```bash
npm run dev
```

Open <http://127.0.0.1:5194>. Keys `1`–`4` switch tabs, `R` resets the camera. Drag empty
paper to turn the table; scroll to zoom.

| Command | What it does |
| --- | --- |
| `npm run dev` | Static server on port 5194 |
| `npm test` | 28 tests: field, walk and card (`node --test`), no test runner dependency |
| `npm run evidence` | Builds the 30-fixture corpus, prints the table, writes `evidence.json` |

There is no install step: the prototype is plain ES modules and one canvas.

## The four tabs

**One roof.** A plan, an eave per edge, a section. Switch plan (L, T, off-axis hexagon,
courtyard) and section (straight, gambrel, mansard, vault). Click an eave; drag its dot up or
down. The pitch changes, and the hips, valleys and ridge move with it — none of them was
drawn. The card reports what the field found: valley length, hip length, ridge length, peak.
A selected eave can be made into a gable end — but only where a slope closes it inside its
authored run. Drag a run short, or switch plan with a gable set, and the card says the end is
drawn as an eave instead. Try the short end of the L: it accepts; the long walls do not.

**Dormer.** Click a slope to drop a dormer; drag the white dot to raise it, the small dot to
widen it. Below the host ridge the card says *dormer*; past it, the same object reads
*cross-gable*. Its foot is a valley, its sides are cheeks, and both are derived.

**Walk & rail.** One walking line (spiral, L, straight), one total rise, one width, one
decision at the turn (landing or winders), one rail frame (upright or pitch), one infill
(ribbon, balusters, glass, handrail only). Treads, winders, stringers, posts, the handrail and
the band are all derived. Drag the white dot for total rise; on the spiral, the small dot
changes the well.

**Corpus.** The 22 roof and 8 walk fixtures, built live by the same evaluator. Nineteen of the
nineteen ordinary roof cases build; three controls refuse in words, and so do two bad walks.
Refusals are results, not gaps.

## What the prototype is, and is not

It is a test of whether a **field over a plan**, a **walk between levels**, and a **band along
a walk** are enough to cover compound roofs, dormers, spiral stairs, railings and their
transitions without adding element types, booleans or a feature tree.

It is not a production family, a renderer, or a user study. The renderer is a canvas study
renderer with painter's-algorithm layering; the arrangement is floating point without robust
predicates; curved sections are banded, not exact; roof-to-wall junctions, roof openings,
rail terminations and baluster families are not built. DESIGN.md §8 lists all of it.

## Structure

Four layers, and the dependencies only run one way.

```
src/core/            pure models: plan.js, roof.js, walk.js, corpus.js. No DOM, no palette.
src/render/camera.js where a point lands on the sheet: camera, projection, near-plane
                     clipping, screen-space picking. No DOM, no canvas, no palette, so a
                     scene can be projected and hit-tested in Node.
src/render/ink.js    the painter: canvas 2D, washes, ink, paint layers. Knows faces, lines
                     and layers — never what a face is for.
src/scenes/          one demo per file. A builder is a pure function: demo state in,
                     geometry + the card's words out.
  faces.js           the only place derived geometry becomes ink, so a roof or a walk
                     looks the same in every scene that shows it.
  roof.js, dormer.js, walk.js, corpus.js
  format.js          number helpers: the one format, the one clamp; index.js is the surface.
src/ui/sheet.js      a scene's ui description → DOM. Holds no state and no geometry.
src/app.js           the sheet itself: one TABS table declares each demo's state factory,
                     builder, chip reducer, handle table and optional gestures (place,
                     select, camera). It looks a handle up by kind and reads no slice.
```

**State has one owner.** Each demo's slice lives under its tab id in `state` (`state.roof`,
`state.dormer`, …), is created by that demo's own `*State()`, and is changed only by its own
`apply*` reducer — or by a gesture `app.js` forwards to it (a handle drag, a click on a
slope). No scene reads another demo's slice, and the corpus cannot drift from the demos
because it runs the same builder and the same ink.

**A handle owns its own drag.** The demo that draws a handle exports its `tip`, its `begin`
(the value it grabs at pointerdown, and any selection a grab implies) and its `drag`. A new
handle is one entry in the scene that emits it, not a branch in the shell. The gable rule
works the same way: `core/roof.js` settles it and words the fallback, so the chip that asks
and the card that reports cannot disagree.

## Screenshots

None are checked in: the demo is the artefact, and the study renderer is not the argument.
Open it and drag something.
