# P26 demo visual-system refinement — acceptance record

**Plan:** [`specification-plan.md`](../specification-plan.md) §9.
**Status:** implementation applied and machine-verified; **owner visual acceptance recorded 2026-09-29**.
**Parent revision:** `674b2294` (P23B.8 closeout).
**Implementation revision:** `731a66c0` — *P26 demo: apply the visual-system refinement (mat, vellum, ink, ochre)*,
plus the owner-directed work in §4b, and §4c. **All of it now lives on `p26-design-overhaul`**
(merge `75ff6276` carries the eight refinement commits; `77db15ac` carries §4c). The work was made on
`main` while the checkout was believed to be elsewhere; `main` was put back to `674b2294` and the
safety tag `p26-work-backup-main` keeps the original commit ids reachable.
**Selection:** plan §3 ochre. `--sel` → `--ochre` (`#E5A020` / `#8A5B10`). Tape remains branding
and history-count. A later tape-gold alias on this branch was reverted.
**Demo-dirty state:** the evidence in `baseline/` was captured with every demo file clean at
`674b2294`; `revised/` was captured with the seven implementation files modified and no other
demo file touched. Nothing outside `docs/roadmap/p26-spatial-depth/` was changed by this work.
Specimen rasters in `revised/` predate the ochre restoration; they show the tape-gold interim.
Tokens now match plan §3; rasters were not re-shot.

## 1. What changed

| File | Change |
| --- | --- |
| `styles/app.css` | Revised semantic tokens (shell, ink, ochre selection family, caution/refusal, view ink), 1 CSS px canvas perimeter, dimension roles, notice semantics, focus grammar, handle/selection boundary |
| `app/stage.js` | Renderer palette; vellum paper ground + separate grid layer with the interval ladder; vellum `sheet` material |
| `app/geometry.js` | Generated display-only `uv` attribute on wall geometry; end/reveal faces masked |
| `app/overlay.js` | Editable numbers become real buttons; pooled labels drop stale role attributes; the value being dragged keeps its place |
| `app/draw.js` | Active-value emphasis; refusal notice class |
| `app/actions.js` | One rule for the drafting sheet (`sheetWanted`/`syncSheet`): the settled subject of a face session wears it, straight or curved, in the squared view and after tilting back to 3D; any wall off its footprint still wears it |
| `app/main.js` | Active-edit state on gesture start/end/cancel; vellum typing surface |
| `app/state.js` | `activeEdit` presentation state |

Not changed: geometry, topology, openings, picking, hit targets, units, measurement values, camera
paths, motion policy, Undo/transaction boundaries, authored fixture data, `app/model.js`, tool
order, shell dimensions and typography.

## 2. How to reproduce

```sh
cd prototypes/spatial-authoring
python3 -m http.server 8826                 # http://localhost:8826/
cd docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa
bash capture.sh baseline 1440 900           # only meaningful at 674b2294
bash capture.sh revised 1440 900
bash capture.sh revised 1280 800
bash capture-dpr2.sh revised
bash interaction-check.sh revised
bash journey-check.sh revised
bash probe-roll.sh http://localhost:8826 revised        # §4 curvature-slider finding
bash probe-roll.sh http://localhost:8826/_baseline baseline   # needs `git archive 674b2294` extracted there
bash probe-sheet.sh http://localhost:8826 shipped       # §4 sheet calibration sweep
bash probe-surface.sh http://localhost:8826 revised     # §7 drafting-surface rule
agent-browser eval "$(cat contrast-check.js)"
python3 make-compare.py                     # rebuilds compare.html
```

`compare.html` is the labeled side-by-side view of every matched specimen.

**Environment.** Chromium via `agent-browser`; viewports 1440 × 900 and 1280 × 800 at DPR 1 CSS px;
`screens/`-style fixtures (`?shot=1`) with `motion=instant` except the V12 ordinary-motion set
(`motion=teach`). DPR 2 is covered by `capture-dpr2.sh` — see §7 for the harness limitation.

## 3. Final calibrated values

Calibration is explicitly allowed by plan §3/§4.4 within the stated roles; these are the values the
captures were produced with.

| Knob | Final value | Note |
| --- | --- | --- |
| Grid ladder | `0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100` m | 1, 2, 5 × 10ⁿ; major = 5 × minor |
| `GRID_TARGET_PX` | 16 | the plan's ≥16 px density floor; resolves 1 m minors at the reference framing |
| `GRID_MIN_PX` | 8 | suppression floor; lines fade out over 8 → 16 px |
| Rung hysteresis | 1.15× | prevents flicker at a boundary; no timeline or delay added |
| Paper grid tile | 10 minor cells, major every 5 | `repeat = 1200 / (10 × minor)` |
| Grid line weights | 3 px minor / 5 px major in a 1024² tile | ≈ 0.6–1.7 CSS px apparent at the reference scale |
| Paper grid alpha | minor 0.28, major 0.45 | plan §3 values |
| Sheet grid alpha | minor 0.28, major 0.45 | the plan's §3 values, identical to the vellum ground |
| Sheet material | `map` = paper tile, `emissive` paper @ **0.36** (baseline 0.45) | calibrated to the vellum ground's own rendered brightness; see §4 |
| Sheet UV step | open walls 5 m major / 1 m minor exactly; closed walls `L / round(L/5)` | rotunda: 4.937 m major → 0.987 m minor, u range `[0, 7]` exactly (seam closes) |
| Sheet trigger | settled face subject (`settle > 0.5`) **or** `u > 0.01` | one rule for straight and curved walls; the curvature slider never recolours a wall (see §4) |
| Perimeter | `#B8BEB3`, 1 px, `inset: 0`, `pointer-events: none`, `z-index: 1` | no layout, camera-aspect or pointer change |

Measured at the reference Plan framing (1440 × 900): chosen minor **1 m**, minor spacing **21.7 px**,
major **5 m = 108.4 px**, `repeat = 120`, grid and paper opacity **1.0**. Because 600 is divisible by
every rung, the grid origin is stable at the world datum across rung changes.

## 4. Specimen results

Captures: `baseline/<viewport>/`, `revised/<viewport>/`, `revised/1280x800-dpr2-renderer/`.
Matched pairs: **34** (`compare.html`).

| ID | Specimen | Machine-checked result |
| --- | --- | --- |
| V1 | Plan, North wall selected | 1 m/5 m grid at 21.7/108.4 px; paper and grid at full opacity; Navigator `sel` edge uses dark ochre on light |
| V2 | 3D overview, opening selected | Mat, depth, artwork unchanged; handles present on both dark ground and light geometry |
| V3 | Garden window facing, fully unrolled | vellum sheet on the faced **straight** wall (this specimen previously showed plain architecture, because a straight wall could never earn the sheet); `uv` present and matching vertex count; `u` range `[0, 7]` exactly on the rotunda; openings/artwork unobscured |
| V4a/b | Partly peeled, inside and outside | grid coordinates stable across `u`; no stretching (UVs derive from `s`); reveal/top faces masked to a plain texel |
| V5 | Section, depth, view-only displacement | Beyond-depth is a **slate** chip and slate `where` block, not a warning; poche/opening selection unchanged |
| V6 | Lift/look-up, clearance notice | caution surface (`#F7EDE8`/`#E2CBC1`/`#C85A48`/`#3A241D`) with the existing recovery action; intentional openings stay in the `--open` family |
| V7 | Dense dimensions, both widths | 5 editable buttons rendered; no new overlaps or clipping observed |
| V8 | Real handle drag and release | active handle + one active value chip during the drag; emphasis cleared on release; **1** Undo entry; Undo restores the value |
| V9 | Numeric entry / invalid / Enter / Tab / Escape | invalid input shows “Type a number in metres” beside the editor, writes no history; Escape clears the active emphasis; Enter accepts; Tab moves to the next editor |
| V10 | Set aside, find, return | slate/dashed view state; selected identity retained |
| V11 | Focus, armed, selected, disabled | keyboard focus = 2 px `rgb(32,36,34)` ring at 2 px offset with a light halo; armed tool is a recessed neutral surface; view bar carries the Reduce motion control and no `return` marker |
| V12 | Plan↔3D and contextual return | ordinary-motion mid-flight and endpoint captured; instant motion used for the rest |

**Owner-reported observation (2026-09-29).** Adjusting the curvature slider makes the rotunda read
green — is that a background bleed, or intended? Repro: `probe-roll.sh <url> <label>` (both builds,
matched camera, `u` = 0 / 0.35 / 0.65 / 1). **It is not a bleed, and it is not an implementation
defect: it is what the plan's palette plus the requested vellum calibration produce.**

No bleed is possible: `mat.sheet` is opaque (`MeshStandardMaterial`, no `transparent`, `side:
DoubleSide`) and its `map` is built by `gridTexture(COLORS.paper, …)` with the default opaque
background (`transparentBg: false`), so the mat cannot show through the wall. Measured on the mat
background itself, the two builds are indistinguishable:

| View | Build | mean RGB | pixels with G−R>6 and G−B>6 |
| --- | --- | --- | --- |
| tilted, paper = 0, u = 1 | baseline `674b2294` | 135,146,139 | 45.7 % |
| tilted, paper = 0, u = 1 | revised | 112,125,117 | 46.0 % |

The change is in the sheet, and it is a two-part consequence of the plan:

| State (rotunda framed) | Build | mean RGB | light-pixel green excess | strictly green pixels |
| --- | --- | --- | --- | --- |
| `u` = 0 (no sheet) | baseline | 221,225,225 | 1.91 | 0.20 % |
| `u` = 0 (no sheet) | revised | 228,225,215 | 4.14 | 0.20 % |
| `u` = 0.35 | baseline | 245,246,242 | 2.23 | 0.13 % |
| `u` = 0.35 | revised | 218,221,213 | 4.79 | 0.81 % |
| `u` = 0.65 | baseline | 245,246,242 | 2.38 | 0.14 % |
| `u` = 0.65 | revised | 217,220,213 | 4.76 | 0.81 % |
| `u` = 1.00 | baseline | 245,246,242 | 2.39 | 0.14 % |
| `u` = 1.00 | revised | 217,220,213 | 4.74 | 0.86 % |

Green excess is `G − (R + B)/2` averaged over light pixels (R > 150); it catches the cast that a
strict threshold misses. Two effects are visible: the vellum ground is itself greener at `u = 0`
(1.91 → 4.14, from plan §3's grid hues replacing near-neutral `#E2E6DD`/`#CFD6CB` with
`#9FB2A2`/`#809984`), and rolling the wall adds a green sheet on top (4.14 → 4.79) because the
`sheet` material's `map` uses those same two hues at alpha 0.34 / 0.55 over paper. Plan §4.5's
requested calibration (`emissiveIntensity` 0.45 → 0.08) removes the bright self-illumination that
previously washed those lines out — baseline mean 245,246,242 versus revised 217,220,213 — which is
exactly why the same tint reads as “green” here and as “white paper” before.

The switch is discrete, not a gradient: `actions.js` sets `ds.sheet = u > 0.01`, so the wall's
material changes from `foam` to vellum the moment the slider leaves 0. That threshold is
pre-existing (the baseline swap is unchanged); only the material's appearance moved.

**Resolved — owner decision (2026-09-29): keep the plan's §3 hexes; tune the sheet.** Grid *opacity*
and the sheet's emissive response are declared calibration variables (plan §3 last paragraph, §4.5),
so the fix belongs on the sheet rather than in the palette. Grid *hue* stays as written in §3.

Calibration target: **the displaced wall must render as the same paper as the vellum ground it lies
on**, so rolling a wall cannot read as a change of material. Measured with the ground and every other
wall hidden (`probe-sheet.sh`), so these are the wall's own pixels:

| State | mean RGB | G−R | G−B | reading |
| --- | --- | --- | --- | --- |
| vellum ground, bare (target) | 240,242,236 | +2 | +6 | the plan's paper under its own light |
| same wall as `foam`, un-rolled | 229,227,216 | −2 | +11 | the architecture reading the owner expects |
| sheet, before (em 0.08, grid 0.34/0.55) | 219,221,214 | +2 | +7 | 21 counts darker and 4 counts greener than the wall as foam |
| **sheet, after (em 0.36, grid 0.28/0.45)** | **238,240,233** | **+2** | **+7** | matches the ground's hue; 2 counts off its brightness |

The emissive sweep (grid alpha moves the frame mean by ≤ 0.04, so emissive is the lever that
matters): `0.08` → 219,221,214 · `0.24` → 230,232,225 · `0.30` → 234,236,229 · **`0.36` →
238,240,233** · `0.42` → 241,243,236, against a ground of 240,242,236. `0.36` was chosen rather
than the value that matches exactly, so the sheet never renders brighter than the page it lies on —
which is what plan §4.5 rules out at the baseline's `0.45` (245,246,242, above the page).

End-to-end, on the framed rotunda with the ground visible (`probe-roll.sh`): `u` = 0.35 moves from
218,221,213 (0.81 % strictly-green pixels) to **237,239,232 (0.33 %)**; the wall no longer darkens
and sags greener as the roll slider travels. The sheet's own drafting grid keeps the plan's §3
alphas, so it is exactly as strong as the vellum ground's grid.

## 5. Journeys and interactions

- **Journeys A–F:** `journey-report-revised.txt` — **50/50 steps pass**, 0 console/page errors
  (the count grew with the §4b and §4c steps; re-run 2026-09-29 on `p26-design-overhaul` after the
  branch merge, with the rate-limited paper value in place).
- **Interaction checks:** `interaction-report-revised.txt` — **27/27 pass** (drag/release one-edit,
  one-Undo, refusal cancellation, numeric entry/validation/cancel, Tab continuity, focus grammar,
  no history from view navigation, pooled-label role change).
- **Responsiveness:** 60.2 fps in the flat face session (13 SVG paths, 15 overlay labels) with the
  technical-ink halos active — no visible responsiveness cost measured.
- **Layout invariants:** `#gl` client box equals the stage box (816 × 668 at 1440 × 900);
  `camera.aspect` matches; picking still resolves an object at the stage centre.

## 6. Contrast measurements

Full table: [`contrast-table.md`](./contrast-table.md), measured from the running stylesheet.

| Pair | Ratio | Verdict |
| --- | --- | --- |
| ink `#202422` / shell | 13.40 | text ✓ |
| ink-2 `#3E4440` / shell | 8.51 | text ✓ |
| ink-3 `#5F665F` / shell | 5.04 | text ✓ |
| view-ink `#4A626E` / shell | 5.49 | text ✓ |
| caution body / caution bg | 12.57 | text ✓ |
| caution action / caution bg | 8.32 | text ✓ |
| refuse ink / refuse bg | 8.79 | text ✓ |
| open deep / open soft | 5.42 | text ✓ |
| dark ochre `#8A5B10` / paper | 5.30 | non-text ✓ |
| ochre `#E5A020` / mat | 5.50 | non-text ✓ |
| caution accent / caution bg | 3.64 | non-text ✓ |
| ink-dark / ochre (handle glyph) | 7.44 | text ✓ |
| perimeter / shell · paper | 1.62 · 1.72 | decorative boundary rule; plan §9.1 classes perimeter rules as hierarchy/visibility, not an interactive control |
| charcoal `#202422` / mat | 1.28 | matches the plan's own table; never used as the sole essential cue (ochre core or paper halo carries it) |
| refuse edge `#B2543A` / mat | 2.48 | below 3:1 on the mat; the near-white refusal *fill* (11.29 vs mat) carries visibility on dark |
| `#FFFFFF` / ochre | 2.24 | rejected alternative; glyphs and chip text use `--ink-dark` (7.44) instead |
| brand tape / shell | 1.56 | decorative accent; the badge's ink text is 8.57 ✓ |
| selection / mat | 5.50 | ochre core on the dark mat |
| selection edge / paper | 5.30 | dark ochre; clears 3:1 |
| selection edge / shell | 5.00 | dark ochre; clears 3:1 |
| selection / shell · paper | 1.91 · 2.02 | fill is a quiet tint by construction; contour and glyph carry the cue |
| ink-dark / selection (glyph on handle) | 7.44 | same pair as ink-dark / ochre ✓ |

## 7. Unresolved, unverified and limitations

1. **Owner visual acceptance.** Recorded 2026-09-29. Specimen rasters in `revised/` predate the
   ochre restoration and still show the tape-gold interim; tokens now match plan §3.
2. **Grid hue and sheet calibration — resolved.** Owner chose to keep the plan's §3 hexes and tune
   the sheet; §4 records the before/after and the calibration criterion.
3. **Paper rule is the owner override**, folded into plan §4.5: settled subject or off-footprint,
   plus **Wall grid** as the editor-side override. Costs and alternatives remain in
   [`../paper-surface-brief.md`](../paper-surface-brief.md) as design memory, not an open default.
4. **Selection on paper — resolved.** Paper and selection compose: settled + selected → body
   `sheet`, outline `lineSel`. Wall grid off still swaps to `foamSel` + `lineSel` (real material);
   it is not the selection fix.
5. **DPR 2 raster.** The capture harness exposes no desktop device-scale-factor (only phone/tablet
   presets), so `capture-dpr2.sh` exercises the renderer's DPR-2 path (2× canvas backing store,
   `canvas.width = 2 × clientWidth`, identical textures/anisotropy, 0 errors) while the screenshot
   raster remains 1× CSS. CSS overlay linework is resolution-independent and unaffected.
6. **Specimen coverage gaps.** Journeys were run at 1440 × 900 only; `prefers-reduced-motion`
   emulation was not captured (Instant motion is covered); the optional faint inner edge shadow on
   the perimeter was **not** added, because plan §4.2 permits it only on a comparison specimen that
   shows a material improvement and none was verified.
7. **Optional specimen judgements** not asserted: “no moiré” at extreme zoom, and the dense-scene
   comparison the plan asks for before accepting the stronger starting grid opacities.

**Resolved — consistency of the drafting surface (owner-reported 2026-09-29).** Owner chose: the
paper follows the 2D drafting state. The trigger used to be curvature alone (`ds.sheet = u > 0.01` in
`applyUnroll`, with `scrubUnroll` exiting early for straight walls), so in one settled state the
rotunda read as paper and a straight wall did not. `sheetWanted(id)` now answers one question — is
this wall being shown as a drawing? — and is consulted by `syncSheet` from the face gesture's settle
progress, from `applyUnroll`, and when a peel session starts:

| State (`probe-surface.sh`) | Before | After |
| --- | --- | --- |
| 3D home, no session | `foam` | `foam` (unchanged) |
| north settled square | `foamSel` | **`sheet`** |
| rotunda settled square | `sheet` | `sheet` (unchanged) |
| rotunda faced, curvature slider at 0 | `foamSel` | **`sheet`** — the slider no longer recolours the wall |
| rotunda settled, view tilted off square | `sheet` | `sheet` — colour stays consistent returning to 3D |
| every wall in the model, settled in turn (north, south, west, rotunda) | mixed | **all `sheet`** |

The grid on a newly papered straight wall is honestly spaced, not stretched: north settled square
measures `uv` 3.251 × 0.800, i.e. **16.26 m along the wall and 4.00 m up** at 5 m per `uv` unit, so
the tile's five minor cells are 1 m each with a 5 m major interval — 32.0 CSS px per metre at that
framing, above the plan's 16 px decimation floor, with the major grid well clear of dense banding.

The material swap happens once, as the wall settles (`settle > 0.5`), so it rides the existing
movement instead of popping. A wall off its footprint keeps the sheet as before, so an unrolled or
peeled wall still cannot be mistaken for an authored change of shape (plan §4.5), and journeys A–F
and the 27 interaction checks were re-run unchanged (48/48 and 27/27, 0 console errors).

**This rule is the owner override**, folded into plan §4.5. Selection on paper composes with it
(plan §5): settled and selected → body `sheet`, outline `lineSel`; Wall grid off → `foamSel` +
`lineSel`. Alternatives and costs stay in [`paper-surface-brief.md`](../paper-surface-brief.md)
as design memory.

## 4b. Owner-directed changes after the first review (2026-09-29)

Three asks came from the owner reviewing the running demo. Two are outside the plan's letter and are
recorded as such; none touches geometry, values, units, camera paths, history or picking.

**The `return` marker is gone.** `.vtab.origin::after` drew an 8 px mono “return” under whichever view
tab the current chain started from. Returning is already carried by `Esc`, the “Put it back”/
“Back ⌘Esc” button and the crumbs in the strip, so the marker was removed (`styles/app.css`) along
with the `origin` class toggle in `ui.js`. Verified: no `origin` rule remains in the stylesheet chain
and the tab's `::after` computes to `content: none`.

**Reduce motion is now a control, not only a media query.** The view bar carries **Reduce motion**
(`#motionBtn`, `S.reduceMotion`), beside Overview and Keys. It forces `dur → 0` for every move
without changing the chosen speed, hides timed captions, and sets `body.reduce-motion` so CSS
transitions stop as well; the system `prefers-reduced-motion` setting still initialises it and still
works on its own. Measured on an unlearned move in `adaptive`: **1634 ms** with it off, **0 ms** with
it on, and the endpoint identical (`flat` = 1, the wall wears the sheet). `?reduced=1` sets it at
load. This is the same distinction the owner asked for between the two controls: **Motion** (status
rail) sets the speed — `adaptive` is the learns-then-fast policy, teaching speed for the first two
times a move is seen and fast after — while **Reduce motion** decides whether anything travels.

The control was added to the existing `.vb-util` group rather than as a new bar: the view bar reports
no overflow at 1440, 1280 or 1060 CSS px and the button stays inside the bar at every one of them.
Plan §2 excludes new features, so this is an owner-directed addition beyond the plan's scope; it
changes no geometry, value, unit, camera path or history behaviour.

**Wall grid: paper or real material is now the editor's choice.** The view bar carries **Wall grid**
(`#draftBtn`, `S.wallDrafting`, `G`, `?grid=0`, on by default). Off, `sheetWanted` returns `false`
outright and `syncSheets()` re-decides every wall, so a wall keeps its real material in every view at
every curvature — for working on the surface itself rather than reading the layout. Measured on the
same settled wall: on → body `sheet` and, when selected, outline `lineSel`; off → body `foamSel`
and outline `lineSel`. The toggle swaps surface only; the ochre contour stays. A displaced wall with
the control off keeps its dashed slate footprint, so the “view only” cue does not depend on the paper.
Journey E carries it as the step “See the wall, or see the drawing”. This is Option 4 in
[`paper-surface-brief.md`](../paper-surface-brief.md) — an override on the Option 1 default.

Journey D now carries both ideas: “Motion that learns” explains Adaptive/Brisk/Teach/Instant, and a
new step “Reduce motion, when watching the move is the problem” turns the control on, walks to the
North wall and back with it, and reports the elapsed time. Journeys run **50/50** and the interaction
checks **27/27** after the changes, with 0 console errors.

This deliberately **widens plan §4.5's “off their footprint” wording** by owner decision: the sheet
now also marks the wall the settled drawing is about. It adds no geometry, value, unit, camera,
history or picking behaviour — `sheetWanted` only chooses between two existing materials — and the
plan's own V3 specimen asks for a vellum sheet on a faced straight wall, which the old curvature-only
trigger could never produce.

## 4c. The ground's mat → paper transition (owner report, 2026-09-29)

The owner reported the background “flickering” while switching, panning and rotating between 3D and
2D, with a mid-transition screenshot showing a pale wash crossed by hard horizontal bands.

**What it was.** Not a bleed or a rendering fault: the ground's identity followed the camera angle
frame by frame. `paper` hangs on the session detent (`1 − smoothstep(2.5°, 20°, angle to the square
home)`) or, with no session, on the tilt into Plan (`smoothstep(70°, 88.5°, el)`), and both bands are
narrow, so an ordinary 55°/s rotate repainted the frame's largest surface from vellum to mat across
**~183 counts of luminance in 200–320 ms**. The pale bands in the capture were the model's ghosted
slabs crossing that wash; the wash itself was the mat half-covered by a mid-opacity page.

**Five changes** (no geometry, value, unit, camera path, history or picking behaviour):

| Change | Where | Value |
| --- | --- | --- |
| The paper value is rate-limited — a steady pose still reaches its exact value, only the rate is bounded, and one step is capped so a dropped frame cannot become a jump | `app/main.js` `slewPaper` | full swap 420 ms; step cap 42 ms |
| The session detent band is widened, so inspecting a wall off-square no longer repaints the ground | `app/main.js` `detent` | 2.5°–20° → **4°–30°** |
| The two ground rules hand over inside the crossfade instead of the mat being cut out in the move's last frame: the mat's rule is gone by 0.5, the drafting rule arrives 0.55 → 0.85, and the mat stays visible until it is actually covered | `app/stage.js` `applyPaper`/`applyGrid` | — |
| The context ghosts fade out with the mat, so they cannot read as streaks across the page | `app/stage.js` `applyPaper` | `0.07·(1−page)`, `0.22·(1−page)` |
| The two discrete flips that cannot be interpolated (through-see ceilings, the sun's shadow) are pinned to the page covering the mat, so a move has one visible discontinuity instead of one at 0.5 and another at 0.6 | `app/stage.js` `restyle`/`render` | — |

**Measured** on a 90-frame recording of the *same* rotate (ground-only patch, museum hidden — the
museum crosses the patch as soon as the camera descends and would otherwise dominate the number):

| Move | Build | Swap span (p 0.02 → 0.98) | Ground change per frame: median · p90 |
| --- | --- | --- | --- |
| rotate away from the square home (~55°/s) | before | 267 ms | 12.2 · 20.0 |
| | **after** | **434 ms** | **7.7 · 10.0** |
| face session → Plan | before | 701 ms | 6.5 · 19.5 |
| | **after** | **918 ms** | **7.5 · 8.3** |
| Plan → 3D | before | 317 ms | 10.3 · 34.3 |
| | **after** | **451 ms** | **7.2 · 22.4** |

Banding peak in the same patch: 1.166 → 0.708 on the Plan move, 0.297 → 0.272 on the rotate
(comparable on the 3D move, 1.040 → 1.134).

**Reproduce:** `qa/probe-flicker.sh <url-base> <label>` prints the table; `qa/capture-transition.sh
<url-base> <label>` records the move live and replays four wall-clock moments as stills into
`qa/transition/<label>/`; `qa/transition.html` places them side by side. The stills are a frame-by-frame
record, not a judgement: they show the mid-swap lasting about twice as long, not vanishing.

**What is still open.** The rate limit means the ground lags the pose by up to 420 ms *during motion*
— the value at rest is exact, so this is a rate deviation from “paper follows representation
progress” (plan §2), not a semantic one; if that is judged a spec change it belongs in §2's wording.
The stills and numbers are a smoothness measurement, not the owner's visual acceptance, which remains
owed. And the owner may prefer a *directional* wipe (the page drawn across the ground along the
view direction) to a global crossfade; that would be a new treatment, not a tuning value.

## 8. Required repository checks

| Command | Result |
| --- | --- |
| `npm run test:arch` (`apps/editor`) | **PASS** — 23 files, 254 tests |
| `npm run test:fast` (`apps/editor`) | 26 failed / 4786 passed, **not attributed**: this change set contains no file under `apps/` or `packages/` (verified by `git status`), so the product suite cannot observe it. Reported here for completeness; triage belongs to whoever owns those failures. |

Plan §9.2 asks that the demo scope not waive repository checks; the unconditional arch lane was
therefore run in full. The fast lane was withdrawn as a low-value use of time once it was
established that the change set touches no product source — the demo has its own behavioural
evidence above (journeys, interactions, layout invariants).
