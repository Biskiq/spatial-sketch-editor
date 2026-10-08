# World Authoring Prototype — implementer reference

This is the current executable prototype mechanics reference, preserving P26 A–F. The prototype in this folder is a **working model of the hardest interactions**, not production code. Use it to answer "what exactly should happen, frame by frame" and "what is the rule", then build it on the real compiler, selection, history and PLATE shell.

Read [rationale.html](./rationale.html) for the product model and [QA acceptance](./qa/ACCEPTANCE.md) for current coverage and harvested predecessor evidence. This file covers mechanics; PLATE §0.8 owns shell design.

```text
Run:    python3 -m http.server 8826   →  http://localhost:8826/
Debug:  window.__me = { S, ctx, A, JOURNEYS }   (state, stage/museum, all actions, scripted journeys)
Jump:   ?journey=A|B|C|D|E|F&step=N   ?motion=adaptive|teach|brisk|instant   ?reduced=1   ?shot=1
```

| File | Owns |
|---|---|
| `app/model.js` | Sample museum; wall frames (`frameAt`, `frameUnrolled`); wall-top profile (`topAt`); opening outline (`archHeight`, `openingTopAt`, `springOf`); validation (`validateOpening`, `validateWall`, `validateCeiling`) |
| `app/geometry.js` | Wall/slab tessellation with profile tops and arches; `horizontalCaps` (plan / look-up poche); `sectionCaps` (vertical poche + crossings) |
| `app/stage.js` | Three.js adapter: realizes navigation's Camera output, paper blend (`applyPaper`), clipping (`setClips`), caps, displaced copies (`buildAway`, `setAway`, `revealIn`), picking, inset render |
| `app/actions.js` | Spatial commands/reading lifecycle, knife, membership, source edits/Undo, current-source parking validation |
| `app/navigation.js` + `app/camera-evaluation.js` | Camera intent/resolution, projection, realization, input/motion profiles, evaluated observer routes/stations/timing, neutral hold, opaque invocation origins and chronological recipe trail |
| `app/tasks.js` | Capability dispatch, identity/target/focus, one task in hand, Precision |
| `app/cancel.js` | Ordered, idempotent cancellation of every unaccepted writer/candidate/preview/aim |
| `app/main.js` | Frame loop (consumes navigation projection; owns clip/cap presentation); dispatches input, handle drags, typed values and keys to owners |
| `app/draw.js` | Per-frame overlays: the legibility gate, one opening kit for Plan / 3D / face, sheet, section (label budget, locator), lid, look-up, plan, knife grips, beacon |
| `app/overlay.js` | Keyed element pool and priority declutter |
| `app/ui.js` | Index, canonical identity Card, Details, invoked Instrument/Precision, trail and locator |
| `app/anim.js` | Tween clock, command queue, motion policy |

---

## 1. One camera, and "settle"

**Rule.** There is one camera state; flatness is *derived*, never a mode flag.

```js
cam = { target, az, el, frameH, flat, mirror }        // frameH = visible height at target (zoom)
fov(flat)  = exp(lerp(ln 40°, ln 0.9°, flat))         // Camera kernel fovFor
dist       = frameH / (2·tan(fov/2))                  // dolly-zoom: framing constant while fov shrinks
position   = target + dist·(cos el·sin az, sin el, cos el·cos az)
up         = el > 89° ? (−sin az, 0, −cos az)          // plan: az=0 → north up
           : el < −89° ? (sin az, 0, cos az)           // look up: az=π → north up, east on the left
           : (0,1,0)
near/far   = dist − 140 / dist + 260                   // keeps depth precision at huge dist
```

Per frame (`navigation.js readingProjection`; `main.js` consumes the output for clips/materials):

```js
freeFlat = smoothstep(70°, 88.5°, el)                        // the plan detent
if (session) {
  detent = 1 − smoothstep(4°, 30°, angle(viewDir, session.home))
  flat   = lerp(freeFlat, detent · (session.flatWanted ?? 1), session.settle)
  planF  = freeFlat · (1 − session.settle)                   // plan cut fades while a session takes over
} else { flat = S.flatHold ?? freeFlat; planF = freeFlat }
paper = slewPaper(flat, now)                                  // mat → paper, lights, line weight
```

- **The ground's identity is rate-limited** (`slewPaper`). `paper` follows `flat`, but no pan, orbit
  or fly can repaint the frame's largest surface faster than `PAPER_SLEW_MS` (420 ms), and one step
  is capped at `PAPER_SLEW_STEP_MS` (42 ms) so a dropped frame cannot turn the limit into a jump. A
  steady pose still lands on its exact value — the step clamps — so every endpoint and every spec
  specimen is unchanged. The session detent band is 4°–30° rather than 2.5°–20° for the same reason:
  at a 55°/s rotate the old band swapped the whole ground in ~200 ms, which reads as a flicker. Any
  future change to either constant must be re-measured with
  `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/probe-flicker.sh`, not judged by eye.

- `session.settle` is animated 0→1 by entering and 1→0 by leaving, so entering from Plan passes *through* perspective and lands flat. The same formula makes leaving back to Plan continuous.
- **Release rule** (`settleAfterOrbit`): inside a session, if the view is within 14° of `home`, animate back to `home`. In free mode, el > 79° snaps to 90° (Plan) with `az` rounded to 90°.
- **Settle gates nothing.** It is a statement about the picture. Handles are gated per handle by legibility (§6), in every view.
- **"To scale" is per screen axis** (`main.js truthBar`). The frame appears at `flat > 0.97`. It always has a vertical scale bar; the horizontal bar is hidden while a curved wall is not flat (`scale-h-off`), with the label `Heights to scale · the curve foreshortens widths`. Bars are chosen from 0.5/1/2/5/10 m at more than 70 px.
- **Language rule**: numbers are *measured* (always model values); the picture is *to scale* (only settled, per axis). No UI string says "true measure".

Production note: a sub-degree perspective is a stand-in for orthographic. A matched `OrthographicCamera` swap at `flat ≥ 0.999` is fine, but **handle maths, picking and overlays must use exactly the rendered projection**.

## 2. Plan is the camera tipped down

```js
h = lerp(9.5, 1.20, ease(planF))       // horizontal cut height above floor
clip keep y < h;  poche = horizontalCaps(museum, h)
```

The cut slides down through the building as you tilt in and rises as you tilt out. Look up uses the same mechanism pointed up (keep `y > h`, h → 1.60).

## 3. Sessions: one lifecycle for every open state

```js
KIND[kind] = { setup(s), apply(s, p), teardown(s) }    // actions.js
openSession(sess, home, { label, narr, base, via, arrive, parent, onTween, arc, restore })
backInner()          // Esc: one level out — re-enter sess.parent exactly
exitSessionInner(to) // ⇧Esc / first crumb: close the whole chain, return to sess.origin.cam
backTo(depth)        // a breadcrumb click
```

- **`apply(s, p)` must be a pure function of `p ∈ [0,1]`.** The same code then drives enter (0→1), exit (1→0), switching, scrubbing, and "hurry" (jump to 1).
- **Nest vs replace.** Opening a session while one is open: if the kinds differ it **nests** (`parent = recipeOf(old)`); if they match it **replaces** (`parent = old.parent`). So section → face nests, face → face hops. `origin` and `undoFrom` are always inherited from the root.
- **Recipes** (`recipeOf`) are the one description of "standing here": `{ kind, cam, label, parent, subject?, id?, u?, side?, cut?, reveal?, mirror? }`. `enterRecipe` re-enters one **exactly**: it tweens to `recipe.cam` (`arrive`), not to the canonical home, and restores `u`, `side`, `reveal` and `mirror`. Esc, breadcrumbs and the trail all use it.
- **Instrument**: breadcrumb `origin › parent… ›` then the current state (kind above title, with `· view only` when displaced). The close button reads **Back** when there is a parent, and **Put it back** otherwise. `crumbs()` walks `parent` links.
- **Exit summary** (`summarize`): when the root closes and `S.undo.length > sess.undoFrom`, `S.summary` lists those entries. *Undo these* pops back to `undoFrom`. It clears on the next edit, on manual Undo, or on opening a session.

| kind | setup | apply(p) | clips | flatWanted |
|---|---|---|---|---|
| face | ghost all but wall + its art + floors; clip plane on the chosen `side`: `side·(P−F_side)·n ≤ depth` (arc inside: r, else 2.6 m) | `settle = p` (sheet material follows `u > 0.01`, set in `applyUnroll`) | face clip | 1 |
| section | build `near` and `beyond` ghost copies; caps | `settle = p`; near copy offset `−n·7·p`, fade `1−0.72p` | keep, depthKeep | 1 |
| lift | other ceilings ghost; `lifted` | lid `y = 2.6·p` | – | 0 |
| lookup | ceiling solid | `settle = p`; `h = lerp(−0.6, 1.6, smoothstep(.12,.55,p))`; ground off at p > 0.22 | keep `y > h` | 1 |

## 4. Facing and unfolding a curved wall

**Home**: `az = atan2(side·n.x, side·n.z)`, `el = 0`, where `n` is the room-side normal at the anchor and `side` is +1 (Inside / room side) or −1 (Outside). The anchor `sA` is the opening's centre, or, for a whole curved wall, the point nearest the camera (`arcSNearCamera`).

**Side.** **F** and **O** face from the room side. A peel faces from the side the camera is on (`sideOfCamera`). `setSide` swings the camera through 180° about the anchor (one beat, slight arc) and rebuilds the clip. Every face overlay reads a signed surface offset `side·thick/2` (`draw.js kit`).

**The rule that makes curvature a view**: the unroll is **isometric**. Distance along the displayed wall equals distance along the real wall at every `u`. So handles, tapes and dimensions are true at any curvature, from any camera. Only the picture is foreshortened. All face overlays are anchored on the displayed wall (`sampler.point(frameS(s), t, y)`), never on screen offsets, so they follow the curve in perspective.

**Curvature dial** (Instrument; `unrollTo`, `scrubUnroll`, `ui.updateStripLive`): stops at 360° (`u=0`), 180° (`0.5`) and Flat (`1`), plus a scrubber (the peel has a magnetic stop at 90° too). `wrap° = 360·(1−u)`. It moves only the wall, never the camera. **Square up** (`squareUp`) settles face-on with a frame fitted to the current curvature. **Step back** (`stepBack`) goes to a 3D standpoint (`az = home.az + 0.62`, `el ≈ 21°`, target on the anchor) and keeps the session; every handle whose axis reads from there stays live (§6). The Instrument markup doesn't depend on `u` (a live updater fills in the readout) so the scrubber is never re-rendered mid-drag. Changing curvature pushes a trail entry and never touches Undo. The trail recipe stores `u` and restores it.

**Unroll** (`model.js frameUnrolled`) — anchored at `sA`, curvature relaxes from 1/r to 0:

```js
k   = (1 − u) / r
pos = A + t·(sin(k·d)/k) + n·((1 − cos(k·d))/k)        // d = signed arc distance from anchor
tan = t·cos(k·d) + n·sin(k·d)
```

At `u = 1` the sheet lies in the tangent plane at the anchor, so the settled camera sees it exactly face-on. Distances along the sheet equal arc length, and handles convert with `s = sA + (P − anchor)·t`.

**Choreography: one beat.** The first version played six sequential beats and took 5.5 s every time. Now every open and close is a single eased tween:

```js
camAt(a, b, e, arc):  lerpCam(a, b, e);  el += sin(π·e)·arc     // lift the eye mid-flight
unfold from anywhere: openSession(face, flatHome, { arc: 22°, onTween: e => applyUnroll(s, e) })   // walk + face + unroll
unfoldInner (already facing): u0→1 while camAt(…, arc 20°)
exit / switch:        u→0 inside the same tween as the camera and apply(1→0)
```

The mid-flight lift is what shows the floor while the wall leaves it. It costs no extra beat. Measured: 2.1 s the first time (teaching speed, with a caption), 0.8 s once learned.

**While displaced** (`u > 0.01`): the wall wears the paper-sheet material. The **as-built wall** is drawn dashed on its real footprint (base ring, top ring, 8 verticals, labelled `… as built`) whenever the camera can see the floor (`|el| > 6°`). Registration lines from each opening to its floor position show while `0.01 < u < 0.985`.

**Peel** (`beginPeel` / `peelTo` / `endPeel`, pointer in `main.js`): the dog-ear (`draw.js dogEar`) sits on the top of a selected curved wall, or above a selected opening in one. Pointer-down opens a face session **in place**: `settle = 1`, no camera motion, side from the camera, `home = faceHome` for Square up. Then `u = |drag| / 260 px`. On release: `u < 0.04` closes silently with no trail entry; within ±0.035 of 0.5, 0.75 or 1 it snaps; otherwise it stays. A click without a drag is `unfold()`.

## 5. Opening along a line (Section)

```js
cut = makeCut(p0, p1, side, depth)   // d = unit(p1−p0); n = side·perp(d) = look direction
cutPlanes(cut) → keep (far side), nearKeep, depthKeep (≤ depth), beyond (> depth)
sectionHome(cut): az = atan2(−n.x, −n.z), el = 0; frame the museum's extent projected on d
```

- **Default look side** (`defaultSide`): in 3D, look away from the camera. In Plan, look "up the screen" (north), or east for a north–south line. `Tab` flips it.
- **Preview before commit**: in 3D the clips apply in place, with a near-half ghost at zero offset and live caps. In Plan (where in-place is invisible) a **peek inset** renders the settled section with scissor (`renderInset`). The Instrument shows depth, look word, Flip, Open, Cancel. The line, arrow and depth band are drawn on the ground.
- **Commit**: the near copy slides toward the viewer and fades while the camera swings to `home` and settles.
- **Depth** is view state (`setDepth`): the Instrument number is draggable and ± buttons step it. The **far edge of the band on the locator card is draggable**. Depth writes no history.
- **Exploring before commit**: in the aim stage the drawn line has a **slide grip** (drag along `n`) and **end grips**. They are view handles (`spec.view`) that skip Undo and set `knife.dirty`, so the caps, the in-place preview and the peek re-derive live (`main.js dragKnifeGrip`).
- **Sliding an open cut** (`slideCut`): drag the cut line on the locator (`[data-cut-line]`). Its axis runs along the line of sight in the section, so by the legibility rule the control lives in plan.
- **Excluded recovery**: `memberOf` now returns `lo`, `hi` and, for `beyond`, `need = ceil((hi + 0.2)·10)/10`. `includeIt` sets depth to `need` and pushes the trail. `goToHost` faces the host wall (or lifts a ceiling); it nests, so Esc returns to the same cut and depth. The selected-but-excluded source keeps a **locator** on the drawing (a dashed ring at its true place — displaced by the part offset if `away` — plus its reason).
- **Label budget** (`drawSection`): unselected sources show their reference quietly (`W-ROT 6.00`, `O-GD`, `C-LONG 4.20`, priority ~25). The selection gets its name at full strength. Derived facts (`X of wall above`) appear only for the selection or its host. The ceiling-to-ceiling relation note appears only with nothing, or a ceiling, selected. Labels are skipped in perspective (`flat < 0.85`); handles are not.
- **Membership** (`memberOf`): `cut` (straddles), `in`, `away` (near half), `beyond` (past depth), each with a reason string. The Index badges and Precision "where it is" read it. ⚠ Production: this must be the **same** evaluation the renderer and hit-tester use (I11). The prototype's clipping is separate.
- **Reveal** (`toggleReveal`): marks one source in the `beyond` / `near` copy as solid x-ray at its true place. Depth is unchanged and nothing enters Undo. Changing depth closes it.
- **Edits at the cut**: only values the cut shows truthfully — the head/sill of openings it crosses and a level wall top at the crossing.

## 6. Handles, typed values and refusal — one writer

**The legibility gate** (`draw.js legible`, `handleIf`) decides whether a handle exists, in every view:

```js
a = P(world);  b = P(world + axis·0.1);  c = P(world + cameraRight·0.1)
legible = !a.behind && |ab| ≥ 0.34·|ac|  && |ab|·10 ≥ 14 px/m      // cos 70°, and not microscopic
```

`axis` is `[0,1,0]` for heights (head, sill, rise, wall top, ceiling height) and the displayed wall tangent for along-wall drags (jambs, move). A withheld handle is pushed to `S.gated`; its tape stays typeable. So in Plan, sill and head handles drop out (edge-on); tilt toward 3D and they appear; on a round wall, jambs near the silhouette drop out. The one hand-made exception: **profile details** (arch rise, ridge) are offered only while facing (`opts.profile`).

**One opening kit** (`drawOpening(o, K, opts)`) for every standpoint, where `K = kit(wall, side, around, extra)` is the displayed surface (world point, screen point, normal, tangent at any unroll):
- `dims: 'plan'`: centreline kit at y = 1.20. The move grip sits on an outside dimension line so it can't cover a jamb on a small opening. Width, sill and head tapes stack away from the wall.
- `dims: 'compact'` (free 3D): the side facing the camera; tapes by their handles, no dimension lines.
- `dims: 'full'` (facing): dimension lines anchored on the displayed wall, following the curve.

Handle specs carry `off` (the signed surface offset), so `sAlongPointer` measures along the same surface that is drawn.

**Vertical drags** use the **wall's own face plane at the handle** (the displayed normal at that `s`, carried on the handle spec), so heights stay exact in perspective and on a curve. If that face is nearly edge-on to the camera (`|n·forward| < 0.25`) they fall back to a screen-parallel plane. Section handles use the screen plane, which is the cut plane when settled.

**Along-wall drags** (jambs, move, ridge station) find the **nearest point on the displayed wall** to the pointer in screen space: a coarse 5 cm scan over ±8 m around the handle's `s`, then a 5 mm refinement (`main.js sAlongPointer`). Because the unroll is isometric, the arc length moved is the true distance along the real wall, whether the wall is round, part-unrolled or flat, and whatever the camera.

```js
dy = P.y − start.y                      // in the face plane
dt = sAlongPointer(spec, e) − spec.s0   // arc length along the displayed wall
snap 0.05 m (Alt: 0.01 m)
```

| handle | patch |
|---|---|
| `op-head` | `head = h0 + dy` (arch rides along; rise unchanged) |
| `op-sill` | `sill = s0 + dy` |
| `op-rise` | `rise = r0 − dy` (**head fixed; the spring line moves** — owner ruling R2) |
| `op-jamb` | `w = w0 + side·dt`, `s = s0 + side·(w − w0)/2` (opposite jamb holds) |
| `op-move` | `s = s0 + dt` |
| `top` / `ridge` | the profile key `+ dy`; ridge also `rs + dt`; a closed wall ties `h1 = h0` |
| `ceil-h` | `plane.base + dy` |

**Every pointer move validates.** A valid candidate is applied live, and the Precision follows because it reads the same value. An invalid candidate is not applied: the handle turns coral and the reason floats beside it. **Releasing while invalid cancels the whole gesture** (`cancelEdit`) and writes zero history. Otherwise it is **one commit** with a human label ("Garden window arch rise").

**Typed values**: any `.tape.edit` or Precision field → `applyField(spec, v)` → `editOnce(label, apply*)`. `Enter` commits, `Tab` moves to the next tape, `Esc` cancels. An invalid value keeps the field open with the reason. Handles, tapes and fields call the same `applyOpening` / `applyWallTop` / `applyCeiling`.

**Validation messages** are in `model.js` and name the fix: "Head would cross the wall top (4.20) — lower it or raise the wall"; "The ridge must sit between the two ends — move it inward or choose Slope".

## 7. Ceilings: lift, relations, look up

- `lidRelations(c)` samples each wall every 0.5 m, on the side inside the ceiling outline. Status: `gap` if `max(cy − top) > 2 cm` (or `intended` if marked), otherwise `meets` (with "rises X above"). Suspended regions have no wall relations.
- **Gap options are computed once when the popover opens** and stored on it. Recomputing against a previewed model produces nonsense ("4.00 → 4.00").
- **Preview** snapshots the model, applies the option, and restores on leave. **Commit** = restore, then apply as one edit.
- **Look up**: `az = π`, `el = −90°`; the lower building is sliced at floor + 1.60. Default is *as seen from below* (east on the left). **Mirror** flips the projection matrix x-scale; picking and overlays use the same matrix, and HTML text stays upright. Heights along the line of sight are typed, not dragged.

## 8. Two histories

- **Undo** (`beginEdit` / `commitEdit` / `cancelEdit` / `undo` / `redo`): model snapshots with a label and selection. A no-op writes nothing. **Undo never moves the camera or closes an open state.**
- **Trail** (`pushTrail`, `gotoTrail`, `[` `]`): entries are full **recipes** (§3), so going back reopens a closed cut, re-unrolls a wall to its exact curvature and side, restores Reveal and mirror, rebuilds the nesting, and lands on the recorded camera. Measured before the revision: the angle, zoom and Reveal were lost. After: all identical. It holds at most 12 entries, and consecutive duplicates collapse.
- **Nesting** is a third axis, not history: Esc walks `parent` links; `[ ]` walks time; ⌘Z walks the building.

## 9. Motion policy

```js
dur(kind, base) = Shift | hurry | S.reduceMotion | prefers-reduced-motion | 'instant' → 0
                  'teach' → 1.55·base · 'brisk' → 0.42·base
                  'adaptive' → seen[kind] < 2 ? 1.3·base : 0.48·base
```

Two controls, two different questions. **Motion** (status rail) picks the speed: `adaptive` is the
learns-then-fast policy — teaching speed for the first two times a move is seen, fast after — and
`brisk` is always fast. **Reduce motion** (Stage rail, `#motionBtn`, `S.reduceMotion`) asks whether
anything should travel at all: it forces `dur → 0` for every move *without* changing the chosen
speed, hides timed captions, and adds `body.reduce-motion` so CSS transitions stop too, mirroring the
system setting (separate `S.osReduced`, initialized at boot and followed live). The endpoint is identical either way — same
standpoint, same trail entry, same numbers.

Captions show only while `teaching(kind)`. Commands go through `run()`: a new command sets `hurry` and finishes running tweens instantly, then queues. A motion is never cut off mid-air into an inconsistent state.

## 9b. Reading controls

Two Stage rail controls decide what a surface *is*, not how it moves:

- **Wall grid** (`#draftBtn`, `S.wallDrafting`, `G`, `?grid=0`). On: the wall being worked on wears
the drafting sheet (`mat.sheet` — paper with the 1 m / 5 m wall-distance grid). Off: every wall keeps
its real material, in every view and at every curvature, so an editor can judge the surface they are
editing. `sheetWanted(id)` returns `false` outright when it is off, and `syncSheets()` re-decides
every wall when it changes. Displacement cues do not depend on it: the dashed slate footprint and the
Instrument's *view only* stay either way.
- **Reduce motion** (`#motionBtn`, `S.reduceMotion`) — see §9.

**The drafting sheet rule.** `sheetWanted(id)` in `app/actions.js` is the single answer to "does this
wall wear paper": the **settled subject of a face view** (`settle > 0.5`), straight or curved, in the
squared view and after tilting back to 3D — plus any wall **off its footprint** (`u > 0.01`). It is
consulted from the face gesture's settle progress, from `applyUnroll`, and at the start of a peel.
The curvature slider therefore never recolours a wall. Prior owner calibration composes selected paper with the ochre `lineSel` outline; Wall grid off uses the real selection material. This was resolved before shell adoption, as recorded in [material acceptance §7](../../docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/ACCEPTANCE.md#7-unresolved-unverified-and-limitations). The [paper-surface brief](../../docs/roadmap/p26-spatial-depth/design/visual-system-refinement/paper-surface-brief.md) retains the original question and numerical calibration; PLATE’s owner calls remain separate.

## 10. Renderer details that mattered

- **Pad clip planes to a fixed count** (4 here, with a no-op plane): changing the count recompiles every material's shader.
- **Section caps are one mesh per source** (`userData.id = owner`), so a click on poche selects that wall or slab.
- **Sun shadows are off** in drawing states, because clipped and ghosted geometry casts shadows that no longer match what is drawn.
- **The hemisphere ground colour lerps to a light neutral** with `paper`, otherwise undersides look dark when looking up.
- **Four ground layers, ordered.** Mat (`ground`), the mat's rule (`matGrid`), the paper (`paperGround`),
  the drafting rule (`grid`), each 2–3 mm apart with explicit `renderOrder` and no depth writes on the
  line layers. The two rules **hand over inside the paper crossfade** rather than being visible at
  once: the mat's rule is gone by `p` = 0.5 and the drafting rule arrives over 0.55 → 0.85, so the
  surface passes through one clean unruled moment. The mat's rule is a **fixed 1 m / 5 m** rule (a real
  object's rule does not change with zoom, and a rung picked mid-move would step the lines underfoot);
  the paper's rule follows the 1, 2, 5 × 10ⁿ ladder and is decimated by projected CSS-pixel spacing.
  Both line layers fade out with view distance (16 → 44 m, `gridLayer`), which is what keeps a grazing
  ground from aliasing into horizontal bands.
- **The inset render must restore scene state in `finally`**: an exception there froze the frame loop during development.
- **Declutter** (`overlay.js declutter`): after each frame, HTML overlay rects are read in one pass, sorted by priority (handles 1000, warnings 92, editable tapes 88, letters 80, default 50, quiet/ref 22), and a label that overlaps anything already placed is hidden. Reads happen before writes, so it costs one layout.

## 11. Where is it? — one resolver

`whereIs(id)` answers for the Index badges, the Precision's "where" block, Find and the beacon. They never decide separately.

```js
m = memberOf(id)                                   // beyond · away · aside win first (with reasons)
p = worldOf(id)                                    // art: just off its wall on the hung side; opening: void centre
off    if p projects behind the eye or outside the paper (20 px margin)
behind if stage.occluder(p, not self, not host)    // one ray, eye → p, through drawn solid geometry only
else visible (or m.state: cut · flat · opened · lifted)
```

Actions offered by state: `beyond` → Include it (depth `need`) · Show it through · Go to its wall; `away` → Show it through · Go to its wall; `aside` → Face it instead; `off` → Bring it into view; `behind` → Look at it · Face it. **Search** (`/`, ⌘K) lists names and references with the state tag. Select changes identity without moving Camera; Open location changes context; Bring into view, Include, Reveal and Face are explicit row verbs. Recovery sets `S.beacon` at the source (clamped to the Stage edge when off-frame). The Card re-evaluates on camera release and after zoom settles. Unresolved host references return an explicit reason, never a cached-position host guess.

## 12. Colour semantics

| Colour | Means | Never means |
|---|---|---|
| ochre `#E5A020` / deep `#8A5B10` (glyph `#17201D`) | **selection and manipulation:** the selected entity, its handles, Reveal x-ray, the beacon, an active edit, cut lines, datums | branding, history count |
| tape gold `#F2B53C` | branding, history count | selection or a state colour |
| dashed slate `#56707C` | displaced for this view: the as-built ghost, view-only tags, Index "moved" badges | an authored change |
| coral | a gap, a refusal | |
| green `#2A9384` | open on purpose | |

## 13. Shell lifetimes and neutral parking

`S.sel` is the single canonical selection. `S.task` separately records subject, technical target,
local focus, parameters and Precision. An opening/artwork task can work on its host while its own
identity remains on the Card. Relation Expand/Focus/Select/Open task have distinct effects;
Browse/Search and narrow sheets own disclosure only. Direct grips and Look dispatch the same task.

Every non-accepting exit calls `cancelProposal`: model candidate rollback, numerical writer,
frozen gap/repair preview, pointer closures/capture, refusal and knife aim. Selection changes,
reading invocation/return, task end and lens switching all use it; late events cannot accept.
Gap options freeze before preview, and keyboard focus previews/cancels like hover.

`parkWorldWork` records the whole nested chain's original subjects, resolving target IDs and reading
parameters. It has no selection snapshot, Camera snapshot, origin, active geometry or writer.
`navigation.holdRealized` carries the neutral Camera projection after clips/displacement are
removed. World return never revives the chain. Resume validates current subjects, host relations,
capabilities and Section endpoints/side/depth, then re-invokes each step from the present Camera.
A fresh root captures requested pose **and** held realization; Put it back restores that root.
Nested Back restores parent depth/Reveal/curvature/mirror and its visible Instrument. Overlay
Measure/Repair resumes freshly; unaccepted candidates are never remembered.

This session-only mechanism is prototype evidence, not F storage, production Camera history or a
persisted format. Both-lens continuity is exercised by `qa/continuity-check.sh`; Experience procedures register
through `registerLensWork`, use the same task/navigation/cancellation seams and keep no parked Camera.

## Prototype-only shortcuts (do not copy)

- Caps are computed analytically from centrelines (not from compiled solids); walls are straight or **circular** arcs only.
- `memberOf` is separate from renderer clipping (I11 violated in spirit).
- Opening picking in 3D uses jamb/lintel proximity on the host wall. On drawings it uses overlay polygons from the host relation (correct in spirit, I7).
- Undo is whole-model JSON snapshots.
- Wall geometry is re-tessellated every frame during unroll and lift.
- No generated-ceiling fallback, overlap joints, spanning regions, columns or platforms.
- Occlusion for Find is one ray to one representative point; production needs the membership stage's per-source visibility.
- Plan authoring edits existing openings only; drawing new walls or openings in the one renderer is not prototyped.

Unperformed product studies include dog-ear discovery, per-axis scale comprehension and long-chain Esc usability. Keyboard line/typed controls, refusal announcements and live reduced motion are now checked; screen-reader listening, touch/pen, dense-museum/cubic performance, vertical crop/cut-only and new architecture drawing remain outside this bounded prototype. See [acceptance limits](./qa/ACCEPTANCE.md#limits-and-handoff).

## Unified Experience prototype mechanics (#113)

`experience-model.js` keeps Experience references/occurrences separate from `cameraSource` Views,
connections, interior anchors and stable stations, and from Scene capability fixture properties.
The aggregate `domainSnapshot` is prototype transaction coordination only. One accepted command
writes one shared history step; Undo restores source domains and recorded selection, never Camera.

`navigation.js` owns resolution, projection, input, movement and return. The pure
`camera-evaluation.js` kernel supplies framing, observer/target route geometry, interpolation,
stations and duration to Stage, estimates and visitor execution. **Authored anchor positions are
observer positions in project space**; Camera derives target/aim at each interior station. Generated
View endpoints never enter the authored anchor array. Relative Views resolve against current World
facts through the same resolver as Through and visitor; fixed framing reports review after movement.
`movementTiming`
in `experience-coordination.js` maps Experience holds/invocations onto the traversed Camera connection;
beats on alternate origins do not execute, and Cut ignores route coordination. Auto includes queued
Camera cues after the actual entry route and its holds. Missing framing/stations stay repairable.
No route search, collision planner or general scheduler is demonstrated.

`experience-runtime.js` adapts donor transitions using visit/run tokens, declared fixture channel
replacement and bounded 0.25s steps. Media/captions are deterministic fixture simulations. Preview
clones authored domains, deactivates authoring through the shared task seam, suppresses selection
rendering and uses a return token distinct from lens parking. Exit restores lens, canonical identity,
Card context, accepted inspection and standpoint. Runtime effects never write Scene properties.

Experience parked records carry original identity, resolving targets and accepted procedure params.
Resume refuses removed/rebound Views, routes or stations. Navigation holds the realized standpoint
before setup and locks writers during neutral activation; it never moves away and patches the pose
back. The new invocation's opaque return is captured from now. Posture labels derive from the actual
reading, with explicit Look through/Outside/Plan actions. Parked records contain no pose or old return
token. `parkedByLens` is one map; the `parked` World accessor exists for retained QA compatibility.
The ordinary return may show Guide Peek but keeps parked work inactive.

Opening precision is neutral; the initial reading remains the posture experiment. Through retains
authoring chrome with a frame gate, projected target/horizon and one active tape. Outside/Plan show
the same View's observer/frustum, evaluated at the actual viewport aspect. Camera depth uses a local
Stage instrument and never creates a Guide Deck. Route/coordination anchors remain editable on Stage;
the strip only focuses stations and authors Experience holds/invocations. Shared edits propose reach
before acceptance and recompute it at acceptance. Auto/Hints are accepted session intent until Capture.
The three V2 experiments remain initial precision posture, crop-docking/spatial memory and station
comprehension; none waives required density/instruments. See
[conformance evidence](./qa/EXPERIENCE-CONFORMANCE-ACCEPTANCE.md); the
[S0–S9 record](./qa/EXPERIENCE-ACCEPTANCE.md) is historical.
