# Decision brief — when does a wall wear paper?

**For:** principal designer (visual system) · **From:** P26 demo refinement · **Date:** 2026-09-29
**Status:** one rule is implemented and working; it answers the owner's complaint but was chosen by the
owner as a stopgap. **A principal design call is needed**, then the spec is reconciled and revised.
**Working demo:** `Final-Design-Prototype/` (`python3 -m http.server 8826`) · **Evidence:** this folder's
`qa/` (§6) · **Plan under revision:** [`specification-plan.md`](./specification-plan.md) §2, §4.5, §5.

---

## 1. The question

A wall in this editor can be drawn two ways: as **architecture** in the 3D model (light neutral
`foam`, shaded, on the dark cutting mat), or as a **drafting sheet** (bright vellum paper carrying a
1 m / 5 m measurement grid keyed to real wall distance). Both exist today. What is not decided is
**which wall, in which state, gets which surface** — and the two representations are currently
inconsistent in a way a viewer notices immediately:

> Stand square to a straight wall and it stays plain architecture. Stand square to the round wall and
> unroll it, and it becomes paper. Same settled state, two different surfaces.

The owner's decisions needed, in priority order:

- **D1 — the rule.** What does the paper *mean*? (three options in §4)
- **D2 — the mode boundary.** If paper is tied to the squared/2D representation, exactly what
  triggers the swap as the camera tilts, and must it be instantaneous? (plan §4.4 forbids adding
  delay to a view move)
- **D3 — displacement.** A wall that has left its footprint already wears paper — that is the
  "this is a view, not an edit" signal. Does it keep that signal under the new rule, and if paper
  also marks the subject, how are the two readings told apart?
- **D4 — selection on paper.** Not a taste call, see §5: a papered wall currently loses its
  selection cue entirely.

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

**Implemented now (owner's interim choice, commit `f3310d75`):** one predicate, `sheetWanted(id)`, in
`app/actions.js` — paper is on when *this wall is the settled subject of a face view* (`settle > 0.5`)
**or** *it is off its footprint*, straight or curved, and it stays on when the camera tilts back to
3D. Consequences: every wall in the model reads alike when squared; the curvature slider no longer
recolours the wall it rolls; that "green rotunda" reading the owner reported is gone. This is a
**wider** reading than the plan's §4.5 wording, and it was taken as an owner decision, not a design
resolution — hence this brief.

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
  It also resolves §5's conformance gap in the "off" state: the selection material returns with the
  real material (measured: body `sheet` → `foamSel`, outline `line` → `lineSel`), because the paper
  is what was overriding it.
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

**Recommendation: a combination.** The control (Option 4) is the right *override* — it gives the
editor both readings on demand, which no inference can. But it does not answer the question underneath
it: what the wall should look like **by default**, before anyone touches the control. For that default
I still recommend **Option 2**, because it is the only rule that makes the surface a property of the
*representation* rather than of the wall — which is precisely the inconsistency the owner hit twice
(straight vs curved wall; surface changing with curvature) — and it is what the plan's own §2
invariant already asserts: *"Paper treatment follows existing representation progress."* It also keeps
the drafting grid where it is informative, on the measured page, while 3D keeps architecture as
architecture. Either way, pair the decision with the conformance fix in §5 for the case the control
is on.

---

## 5. What must be fixed whichever option wins (D4)

The paper state currently **suppresses the wall's selection cue**. Measured on the same wall, same
selection, differing only in representation:

| State | Wall body material | Wall outline material | Overlay selection marks |
| --- | --- | --- | --- |
| straight wall selected, 3D | `foamSel` (ochre selection tint) | `lineSel` (ochre) | — |
| straight wall selected, settled square | `sheet` (paper) | `line` (**plain ink**) | 0 |

Plan §5 requires the selected subject to keep a "persistent contour", and specifies "dark ochre on
paper" for it, so the papered wall should carry a dark-ochre boundary (`#8A5B10`, 5.30:1 against
paper — already in the palette and already used in the Navigator). Today the subject is still
identifiable in a face view because every other wall is ghosted and its handles are drawn, so
nothing is unusable; the conformance gap is the missing contour and fill on the selected wall itself.
This is a bug relative to §5, not a design preference, but the fix should be made together with the
rule so the paper's handling of selection is decided once.

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

## 8. What I need from you

1. **Which rule is the default (§4)?** My recommendation is Option 2, with displaced walls keeping
   paper in both modes — and Option 4's control above it as the override. If you would rather the
   default stay Option 1, the control still gives editors the real material on demand, but the
   straight-vs-curved inconsistency remains for anyone who never touches it.
2. **If Option 2: what exactly triggers the swap?** Candidate: the squared threshold already used for
   the page (`flat ≥ 0.97`) with hysteresis on the way back, riding the existing move and adding no
   delay. Or tie it to `settle`/the "Square" action instead, so the surface changes when the *wall*
   settles rather than when the *page* does.
3. **Does the paper keep its displacement meaning?** If the subject is paper *and* a displaced wall is
   paper, one visual has two meanings. Alternatives: keep both and let the strip's "view only" carry
   the distinction; or give the displaced state a second cue (a dashed paper edge, a slight lift) so
   the two are separable.
4. **Do you accept the §5 conformance fix as part of this?** A papered selected wall needs its dark
   ochre boundary (and a restrained fill decision) rather than no cue.
5. **Is the drafting grid wanted on a faced straight wall at all?** V3 says yes; if the answer is no,
   V3 has to be re-scoped and the UV work is only justified for curved and displaced walls.

Once you decide, the reconciliation is small and I can do it: §2/§4.5/§5 wording, the V3/V4 specimen
definitions, journeys A/D narration, and the `sheetWanted` predicate plus the paper selection
treatment — then re-run the specimens, journeys and interaction checks, and update the acceptance
record.
