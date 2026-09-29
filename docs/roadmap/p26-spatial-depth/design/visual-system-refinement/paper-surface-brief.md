# Decision brief — when does a wall wear paper?

**For:** principal designer (visual system) · **From:** P26 demo refinement · **Date:** 2026-09-29
**Status:** owner override in force — Option 1 (drafted surface) with Option 4 (Wall grid) as the
editor-side override; folded into [`specification-plan.md`](./specification-plan.md) §2 and §4.5.
Selection on paper (D4) is resolved: sheet stays, `lineSel` draws the contour.
**Working demo:** `Final-Design-Prototype/` (`python3 -m http.server 8826`) · **Evidence:** this folder's
`qa/` (§6).

---

## 1. The question

A wall in this editor can be drawn two ways: as **architecture** in the 3D model (light neutral
`foam`, shaded, on the dark cutting mat), or as a **drafting sheet** (bright vellum paper carrying a
1 m / 5 m measurement grid keyed to real wall distance). Both exist today.

**Owner override:** Option 1 (the settled subject or a wall off its footprint wears paper) with
Option 4 (**Wall grid**) as the editor-side override. D2/D3 are accepted as that rule's costs
(paper survives a tilt back to 3D; "view only" on the strip distinguishes displacement). **D4
is resolved:** a papered selected wall keeps the sheet and draws `lineSel`.

The inconsistency that prompted the override:

> Stand square to a straight wall and it stays plain architecture. Stand square to the round wall and
> unroll it, and it becomes paper. Same settled state, two different surfaces.

---

## 2. Terms used below

| Term | Meaning in this demo |
| --- | --- |
| **mat** | The dark cutting surface of the 3D model (`#1D3A33`, ≈11.1:1 against paper) |
| **vellum / paper ground** | The light drafting page that replaces the mat as the picture becomes square to a wall |
| **foam** | Plain architecture material for walls in 3D (`#F1F2EC`, shaded) |
| **sheet** | The vellum wall surface: opaque paper + measurement grid, calibrated to match the paper ground |
| **face / settle** | Walking to a wall and turning square to it. `settle` runs 0 → 1 during the move |
| **square (2D)** | The end state of that move: the picture is to scale (`flat` ≥ 0.97) |
| **unroll / peel** | Taking a curved wall off its footprint and laying it flat around an anchor |
| **off its footprint** | A wall displaced for viewing: unrolled, peeled, lifted or slid. Documented as view-only |
| **ghost** | Neighbouring walls, dimmed while one wall is the subject of a face view |

---

## 3. What happens today

Two mechanisms decide the surface. Both are one line of code; the conflict is between them.

1. **Displacement** sets paper (`ds.sheet = u > 0.01`). This is original behaviour and it is
   deliberate: *"a displaced wall wears the paper-sheet material for as long as it is off its
   footprint, so an unrolled wall can never be mistaken for an authored change of shape."* The strip
   says **view only** alongside it.
2. **The page** also changes: as the camera squares up, the mat crossfades to the vellum ground.
   This one *is* tied to representation (`stage.paper = flat`).

Because only mechanism 1 painted a *wall*, the owner hit this, and asked for consistency:

> "when clicking a wall and it settles, there's still a mismatch … normal wall does not become the
> 'paperlike' rotunda when unrolling. Me want: if it's 2D i.e. settle (square) make it consistent
> across, if mode is 3D still: render the color so it stays consistent."

**Implemented (owner override, commit `f3310d75`):** one predicate, `sheetWanted(id)`, in
`app/actions.js` — paper is on when *this wall is the settled subject of a face view* (`settle > 0.5`)
**or** *it is off its footprint*, straight or curved, and it stays on when the camera tilts back to
3D. Consequences: every wall in the model reads alike when squared; the curvature slider no longer
recolours the wall it rolls; that "green rotunda" reading the owner reported is gone. This is a
**wider** reading than the original plan §4.5 “off their footprint” wording; it is now the plan.

---

## 4. The three candidate rules

### Option 1 — Drafted surface *(implemented today)*
Paper means **"this wall is the drawing being shown"**: on from the moment a wall settles, whatever
the camera's squareness or the wall's curvature, plus any wall off its footprint.

- **Fixes:** straight and curved walls agree in every settled state; no surface change from curvature;
  the surface also survives tilting to 3D, so nothing flips while you watch.
- **Costs:** inside a face view, tilting away from square leaves a bright paper wall standing on the
  dark mat, so the mat/paper contrast boundary cuts through one scene; paper no longer distinguishes
  "off its footprint" from "the subject", so the view-only signal is diluted; the paper replaces the
  selection material (§5).
- **Spec impact:** §4.5's wording changes from *"walls off their footprint"* to *"the settled subject
  or a wall off its footprint"*; §5 needs a selection treatment for papered walls; journeys A and D
  narrate paper as displacement ("the unrolled sheet wears paper, and the strip says view only") and
  would need rewording.

### Option 2 — Paper is the 2D page
Paper means **"you are reading a measured drawing"**: the faced wall wears it while the picture is
square to it (`flat ≥ 0.97`), and it reverts to architecture as the camera tilts out; a wall off its
footprint keeps paper in both modes.

- **Fixes:** paper means exactly what its grid is for (measurement), and 3D always reads as
  architecture (mat + foam), so the surface boundary is the mode boundary the viewer already
  understands. Selection material returns in 3D automatically.
- **Costs:** the wall's surface then changes *with the camera*, which is the class of change the owner
  described as "turns green while I drag" — it must therefore be quiet, not a flash. Needs a
  threshold and hysteresis, and a decision on instantaneous vs crossfaded (no added delay is allowed).
- **Spec impact:** supported by an invariant already in the plan §2: *"Paper treatment follows existing
  representation progress."* §4.4's "do not add animation that delays a view transition" is the
  constraint on the swap. §4.5 needs the mode clause added; §5 needs the paper selection treatment.

### Option 3 — Off its footprint only *(the original rule, unchanged)*
Paper means **"this wall has left its place"**: unrolled, peeled, lifted or slid walls wear it,
straight or curved; settled walls never do.

- **Fixes:** restores the selection material everywhere except displaced walls, and keeps the
  view-only warning unambiguous.
- **Costs:** reinstates the mismatch the owner reported. A squared rotunda at Flat is *displaced*, so
  it is paper; a squared straight wall is not, so it is not. That asymmetry is the whole complaint.
- **Spec impact:** §4.5 stands as written, and **V3 has to be re-scoped** — the plan's V3 asks for a
  faced straight wall to show "vellum sheet, honest along-wall grid spacing", which this rule can
  never produce. Under Option 3 the grid is only ever seen on a curved or displaced wall.

### Option 4 — The editor decides *(owner proposal, implemented as a control)*
Paper stops being an inference and becomes a **control**: the view bar's **Wall grid** (`#draftBtn`,
`S.wallDrafting`, `G`, on by default) draws the wall being worked on as drafting paper with its 1 m /
5 m grid; off, every wall keeps its **real material** in every view, whatever the curvature, so an
editor can judge the surface they are editing.

- **Fixes:** removes the guessing entirely — the two readings the owner described (work on the wall
  vs visualise the layout) become two states a person chooses, not two states the software infers.
- **Costs:** it does **not** remove the need for a default — the toggle has to pick an initial state,
  so Options 1 vs 2 still have to be decided for the "on" case. A global control also cannot express
  intent per wall in a scene where several walls matter, and it is one more thing to remember to set
  before presenting or reviewing.
- **Spec impact:** plan §2 excludes new features, so this is an owner-directed addition like Reduce
  motion; §4.5 gains a user-facing clause; the Help overlay and Journey E carry it.
- **Measured:** with the control on, a settled wall is `sheet` and the button reads pressed; with it
  off, the same wall is `foamSel` + `lineSel` in every view; a displaced wall with the control off
  keeps its dashed slate footprint, so the "view only" cue survives without the paper. Journeys
  50/50, interactions 27/27, 0 console errors.

**Chosen: Option 1 + Option 4.** The default is drafted-surface (settled subject or off-footprint);
**Wall grid** is the override. Option 2 remains the unelected alternative: paper as a property of
the 2D page rather than of the wall. Selection on paper is independent: the sheet stays, `lineSel`
draws the contour.

---

## 5. Selection on paper (D4) — resolved

The paper state used to **suppress the wall's selection cue**. Restyle now keeps the sheet and draws
the ochre contour (`lineSel`) whenever the wall is highlighted:

| State | Wall body material | Wall outline material |
| --- | --- | --- |
| straight wall selected, 3D | `foamSel` (ochre selection tint) | `lineSel` (ochre) |
| straight wall selected, settled square | `sheet` (paper + grid) | `lineSel` (ochre) |

No ochre fill on the page. Wall grid off still shows `foamSel` + `lineSel` so the editor can judge
the real wall; that toggle is a surface override, not the selection fix.

---

## 6. Evidence behind this brief

All numbers are from the running demo, reproducible with the scripts in `qa/` (§7).

**The paper surface was calibrated to the page** so that "paper" reads as the same material
everywhere (commit `67e90eb6`). Rendering, with the ground and other walls hidden, so each row is the
wall's own pixels:

| State | mean RGB | Reading |
| --- | --- | --- |
| vellum ground, bare (target) | 240,242,236 | the page under its own light |
| the same wall as **foam** in 3D | 229,227,216 | architecture: warm, mid-tone |
| the wall as **paper** (before calibration) | 219,221,214 | 21 counts darker than the page — this read as green |
| the wall as **paper** (now) | 238,240,233 | matches the page's hue, 2 counts under its brightness |

**What each state gives a wall today** (`qa/probe-surface.sh`):

| State | Before this work | Now |
| --- | --- | --- |
| 3D overview, nothing open | foam | foam |
| straight wall settled square | foam (selection tint) | **paper** |
| rotunda settled square | paper | paper |
| rotunda faced, curvature slider at 0 | foam | **paper** — the slider no longer recolours the wall |
| rotunda settled, then tilted off square | paper | paper |
| every wall in the model, settled in turn | mixed | **all paper** |

**The measurement grid is honest on a straight wall** (matters for V3): the North wall settled square
measures 16.26 m along its length and 4.00 m up, at 5 m per texture repeat — 1 m minor / 5 m major
intervals, 32 CSS px per metre at that framing, comfortably above the plan's 16 px decimation floor.
The grid derives from wall distance, so partial unroll states stay unstretched.

**Specimens to look at** (`qa/compare.html` is the labelled side-by-side of all 34 pairs):
`revised/1440x900/v01-plan-north`, `v03-face-flat-gwin` (the faced straight wall, which the old rule
left bare), `v04a-peel-inside` / `v04b-peel-outside` (displaced), `v07-dense-dims`, `v11-states`.

**Behaviour is unaffected by this question:** journeys A–F 49/49, interaction checks 27/27, 0 console
errors, 60.2 fps in the flat face view. Nothing here touches geometry, values, units, camera paths,
history or picking — the whole question is which of two materials a mesh wears.

---

## 7. How to see it

```sh
cd Final-Design-Prototype && python3 -m http.server 8826
cd ../design/visual-system-refinement/qa
bash probe-surface.sh http://localhost:8826 revised   # §6 state table, plus the grid check
bash probe-roll.sh    http://localhost:8826 revised   # curvature slider, settled rotunda
bash probe-sheet.sh   http://localhost:8826 shipped   # the calibration sweep in §6
```

In the browser: select a wall, press `F` to face it, `S` to square up. Then `Esc`, select the round
wall, press `O`. Curvature control is on the strip; **Motion** is at the end of the status rail and
**Reduce motion** is in the view bar.

---

## 8. Remaining

None on this question. Option 1 + Option 4 and the paper-selection contour are the demo rule.
