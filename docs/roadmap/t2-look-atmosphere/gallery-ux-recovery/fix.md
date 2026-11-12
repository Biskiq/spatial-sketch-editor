# T2 · Gallery UX Recovery — diagnosis and specification

**Status:** design accepted by the owner (all decisions in §2), amended by the PR #314 review
(§2.1). Nothing is implemented.
**Companion:** [`ux-design.html`](./ux-design.html) — interactive sheet; panel ids are cited as `#id`.
**Reviewed at:** `main` `ad1742b0`.
**Evidence:** seven owner screenshots; the code cited inline; the focused light suites (5 files,
45 tests) and the architecture lane (24 files, 202 tests), all green. The light suites pin the
current behaviour, including behaviours listed as defects below.

**Authority.** This file is the specification. Where the sheet and this file differ, this file
wins; the sheet is schematic and its pixel styling is not normative. Where this file is silent, the
implementer keeps current behaviour and does not invent. Every number here is exact unless marked
*(tunable)*.

**Not done in this review:** no editor browser session was run. §9 lists the two items read from
code that need one manual confirmation.

Paths are relative to `apps/editor/src/lib/` unless they start with `packages/` or `routes/`.

---

## 1. Verdict

Lighting, Light it and Framing write correct data: every gesture and Card commit goes through one
planner (`create-light`, `update-light`, `ARTWORK_TRANSFORM`), one release is one history entry,
cancel writes nothing, and the frame record round-trips through the Scene codec. No engine change
is needed. The instrument layer is what is wrong: 11 defects, 9 confusing behaviours, 5 missing
pieces (the fifth is live lighting feedback, §5.8).

## 2. Accepted decisions

| # | Decision | Accepted outcome |
| --- | --- | --- |
| O1 | Where a new light sits | Point 0.30 m off walls/ceilings; Spot 0.10 m; both 2.20 m above a floor click (§5.6) |
| O2 | Moving a light body | Horizontal plane through the body, plus a height stem (§5.2) |
| O3 | Moving a Spot body | Keeps its target; Shift keeps its direction (§5.4) |
| O4 | Directional dial position | Centre of the scene bounds on the datum while that is in view; otherwise under the view centre. Constant screen size (§5.5, amended by A3) |
| O5 | Creating a Directional | On shelf pick, no Stage click (§5.5) |
| O6 | Brightness chips | `0.25× 0.5× 1× 2× 4×`, with the row label (§6.1) |
| O7 | Turn grip on wall-hung Artwork | Hidden (§7.3) |
| O8 | Approved T2 text | Updated in the implementing PR (§10) |
| O9 | Card "More" | Renamed **Advanced**; grouped list, one group open (§6.2) |

O2, O4, O5 change approved-design text and O9 changes a shared Card surface: Tier 2 / Tier 1 under
`docs/workflow.md`. Owner acceptance is recorded here.

### 2.1 Amendments from the PR #314 review

Targeted changes to the accepted design. The visual language (§4) and the Card layout are unchanged.

| # | Gap | Amendment | Sections |
| --- | --- | --- | --- |
| A1 | Lighting changes were visible only after commit | Card sliders, gizmo drags and placement ghosts preview the actual illumination and cast shadows before commit through one session-only preview | §5.8, §6.2, §5.7, §8 |
| A2 | Spot: inverted soft-edge ring; Aim coupled to Reach; no rule above 80° | Inner ring at the renderer's full-brightness angle; Aim never reads or writes Reach; wide beams are drawn clamped and edited from the Card | §5.4, §5.6, D10 |
| A3 | Directional dial could sit off-screen or be unreadable in a large project; several Directional lights were indistinguishable | View-anchored fallback, constant screen size, a Direction row on the Card, a name chip and ticks for the other Directional lights | §5.5, §6.1 |
| A4 | Artwork Move was undefined at wall ends, openings and corners | Fit test, hold-at-edge, jump across corners, Shift for free move | §7.3 |
| A5 | Ghost refusal, failed release and preview/commit agreement were undefined; light commits drop refusals | One lifecycle table; the commit is the last drawn candidate | §5.7, D11 |

A1 adds a shared Stage shell primitive and A3 adjusts O4: Tier 1.

---

## 3. Defects found (each is closed by the section named)

| # | Defect | Evidence | Closed by |
| --- | --- | --- | --- |
| D1 | A new Directional light has two dead handles. It is created pointing straight down; there the azimuth drag yields the same direction for every angle, and the elevation drag-plane normal is `[0,0,0]` so `rayPlane` returns `null` on every move | `adapters/light.adapter.ts:832-834`, `:756-783`, `:221-225` | §5.5 |
| D2 | "Elevation" is the travel direction: straight down reads −90°, and +20° lights from below the floor | `:261-267`; `LightCardFields.svelte` direction block | §4.3, §5.5 |
| D3 | Aiming a Spot rewrites its Reach to target + 0.5 m on every drag | `:698-703` | §5.4 |
| D4 | Three different aim points: the handle sits at the cutoff (`:1177-1178`); the Card and the Aim fact use a fixed 1.5 m point (`:493-496`, Card `sync()`); the file header (`:10-13`) describes a third rule. The Reach handle is a short ray on top of the Move cross (`:1226-1238`) | as cited | §5.4 |
| D5 | Point Reach guide radius is `sqrt(range² − h²)` (`:996-1000`); the handle's `extent` is `range` (`:1208-1218`). They coincide only at `h = 0` | as cited | §5.3 |
| D6 | No height control on the Stage; plan §5.8's move plane was not built (the code drags on the horizontal plane, `:681-685`) | as cited | §5.2 |
| D7 | No emitter is drawn. `EntityLight.svelte:52-57` renders an invisible proxy; `lightGlyphAt` (`:126`) only picks. T2 §5 requires a glyph when armed, hovered or selected | as cited | §5.1 |
| D8 | The Card states untrue things: the Paper/Living note is unconditional (`LightCardFields.svelte:487`); Point lights get an Aim triplet and Aim fact; Reach and Intensity print raw floats (`String(range)`) | as cited | §6.1, §4.4 |
| D10 | The Spot soft-edge ring is inverted. The renderer is at full brightness inside `angle × (1 − penumbra)` (three.js `WebGLLights.js:368`); the handle sits at `capRadius × penumbra`, so a sharp beam draws the ring at the centre and a fully soft beam draws it on the rim | `adapters/light.adapter.ts:741-755`, `:1262-1277` | §5.4 |
| D11 | Light commits drop refusals. `commitPlacement` and `commitGesture` discard the accept outcome, so a refused placement or drag ends silently | `adapters/light.adapter.ts` (`void commitPlacement`, unused `acceptFormCommand` result) | §5.7 |
| D9 | Artwork selection ink covers the frame: a 3 px gold line on every mesh edge of up to four meshes; a Float face is 1.5 cm | `stage/shell/StageSelectionLayer.svelte:162`, `:283-300`; `packages/project-model/src/artwork-frame.ts:36` | §7.1 |

Confusing-but-working behaviours (black four-strut cone, far-cap ring, scene-bounds box, derived
Reach ring, unlabelled chips, eight-field Artwork Card, in-plane Artwork move, no light ghost) are
closed by the same sections and not listed separately.

---

## 4. Design language (normative for §5–§8)

### 4.1 Ink

Use existing tokens and constants. Do not introduce hex values.

| Role | Value | Used for |
| --- | --- | --- |
| **Guide** | `--shell-ink` at 45 % opacity, 1 px, solid | Authored light geometry: footprint ring, cone edges, dial ring |
| **Guide, derived** | Guide, dashed 4 px on / 4 px off | Anything not a stored value: drop stem, axis beyond the target, altitude arc, the Reach ring |
| **Grip** | 10 px disc, `--shell-field` fill, `--shell-ink` 1.5 px stroke | Every draggable light mark except the glyph and lift knob |
| **Grip, hover/held** | Selection gold (`GOLD` in `StageSelectionLayer`) fill | Same marks while hovered or dragged |
| **Selection** | Selection gold, 1 px | Artwork outline (§7.1) |
| **Ghost** | The existing candidate blue (`0x2a62d6`, `StagePrimitiveGhost.svelte`), dashed | Any not-yet-placed subject |
| **Refusal** | The existing erase/refusal ink (`ERASE`, `--shell-caution`), dashed | Refused candidate |
| **Tag** | The Stage's existing live-tag style | Value beside a hovered or held grip |

Rules: guide ink is never 100 % black, never filled, never tinted by the light's colour, never
brighter where light is stronger (T2 §5 "the guide is not the light" stands). A cone is **two**
silhouette edges, never four struts.

### 4.2 Sizes

| Thing | Size |
| --- | --- |
| Emitter glyph | 20 px overall, screen-space, constant at any zoom |
| Grip disc | 10 px; hit area 22 px fine / 44 px coarse (existing host rule) |
| Lift knob | Existing `draw.glyph: 'lift-knob'`, 26 px above the body in screen space |
| Floor dot | 6 px, guide ink |
| Artwork outline offset | 6 px outside the outer frame edge, screen space |
| Artwork corner grip | 9 px hollow square, 1.5 px gold stroke; hit area 24 px (existing) |

### 4.3 Vocabulary

The Card and every tag use the left column. The right column never appears in UI text.

| UI word | Stored field / code term |
| --- | --- |
| **Warmth** (Candle · Warm · Neutral · Cool · Sky) | `color`, on the white ramp (§6.3) |
| **Colour**, **Colour amount** | `color`, hue and saturation |
| **Brightness** | `intensity` |
| **Beam width** (Card row label: **Beam**) | `angle` (half-angle) |
| **Edge softness** (Sharp … Soft) | `penumbra` |
| **Reach**, **Unlimited** | `range`, absent |
| **Aim**, **Aim point** | derived target (§5.4); never stored |
| **From** | bearing toward the source (§5.5) |
| **Height in sky** | source angle above the horizon (§5.5) |
| **Height** | `position[1] − datum` |
| **Cast shadows** | `castShadow` |
| **Advanced** | the Card's former "More" |
| Artwork: **Tilt · Turn · Roll** | `rotation[0] · [1] · [2]` |

### 4.4 Numbers

| Quantity | Display | Step |
| --- | --- | --- |
| Metres | 2 decimals + ` m` | 0.05 |
| Centimetres (Artwork) | 1 decimal + ` cm` | 0.1 |
| Degrees | whole degrees on the Stage, 1 decimal in fields, + `°` | 1 / 0.5 |
| Brightness | multiplier, up to 2 decimals, trailing zeros dropped, + `×` (`1×`, `1.41×`) | 0.1 stop |
| Exact intensity | 3 decimals + ` cd` (Point, Spot) or ` lx` (Directional) | 0.001 |
| Percent | whole + `%` | 1 |

A field displays the rounded value. **Enter on unchanged text is a no-op**, so rounding never
rewrites a stored value. Enter commits, Esc restores, blur never commits (existing rule).

### 4.5 Tags (exact strings; `{}` = formatted value)

`Move {x}, {z} m` · `Height {h} m` · `Reach {r} m` · `Reach {r} m · fades to nothing here` (Point
ring) · `Reach {r} m · does not reach the floor` · `Reach {r} m · stops before the target` ·
`Aim · {d} m` · `Beam {deg}°` · `Beam {deg}° · wider than the guide` · `Soft edge {pct}%` ·
`From {deg}°` · `Height in sky {deg}°` · `Stops at the wall edge` (Artwork Move, §7.3) ·
`Placing…` (§5.7).

---

## 5. Light instruments

All marks are derived, editor-only, mounted for the selected light only (the glyph excepted, §5.1),
admitted through the existing handle host, and commit through `update-light` on release. One
release = one history entry. Esc or cancel = no entry. Existing handle ids are kept; new ids are
named below. During every drag the light itself is rendered at the dragged value (§5.8).

### 5.1 Emitter glyph (Point, Spot) — `#point`, `#spot`

- **Shape.** Point: 13 px disc with eight 4 px rays. Spot: 13 px disc with a 15 px wedge pointing
  along the screen projection of forward. Directional: none (it has no position).
- **Visible when** the Lights shelf is open or a light kind is armed; **or** any light is
  selected; **or** the pointer is within the existing 18 px pick radius (`LIGHT_PICK_CSS`).
  Otherwise hidden. Visitors never see it.
- **Ink.** `--shell-field` fill, `--shell-ink` stroke; selection gold fill when selected.
- **Role.** On the selected light the glyph *is* the Move grip (`light-body`); remove
  `draw.cross`. On an unselected light a click selects (existing pick).
- **Occlusion.** Hidden behind geometry by the same test `lightGlyphAt` already uses (`:139-153`).
- **Interim.** Until the shared glyph primitive exists (§8), the selected light uses the existing
  point mark with `draw.pointRadius: 6.5`; unselected glyphs wait.

### 5.2 Move and Height (Point, Spot)

| Mark | Id | Gesture | Writes | Clamp | Tag |
| --- | --- | --- | --- | --- | --- |
| Glyph | `light-body` | Ray ∩ horizontal plane through the body's Y (unchanged) | `position` x, z (Spot also rotation, §5.4) | none | `Move {x}, {z} m` |
| Lift knob | `light-height` (new) | Closest point on the vertical line through the body to the pointer ray (reuse `closestAxisPoint`, `:241`) | `position` y only | `≥ datum + 0.05` | `Height {h} m` |

- **Drop stem:** derived-guide line from the body straight down to the first surface below it
  (`pickScene` with a downward ray; no hit → the datum), ending in the floor dot. No hit area.
- The lift knob is a `ray` handle on axis `[0,1,0]`, anchored at the body, drawn with
  `draw.glyph: 'lift-knob'` and `screen.offset: [0, -26]`.

### 5.3 Point light — `#point`

| State | Drawn |
| --- | --- |
| `range` absent (**Unlimited**, the creation default) | Glyph, drop stem, lift knob. **No ring.** Delete the derived half-scene ring (`guideReachFor` for points, `:907`) |
| `range ≥ h` | One derived-guide floor ring, centre under the body on the datum, radius `ρ = sqrt(range² − h²)`. One grip on the ring at the point nearest the camera's screen-right |
| `range < h` | No floor ring. A 30 px screen-space ring around the glyph with its grip at screen-right |

`h = max(0, position[1] − datum)`.

- **Handle** `light-reach`: `extent` = `ρ` when `range ≥ h` (fixes D5). Gesture unchanged:
  pointer on the datum → `range = distance(body, point)`; in the `range < h` state →
  `range = horizontalDistance`. Clamp `≥ 0.10`.
- **Tags:** `Reach {r} m · fades to nothing here` (floor ring); `Reach {r} m · does not reach the
  floor` (`range < h`).
- A Point light has **no Aim**: remove the Aim triplet and the Aim fact for `light === 'point'`.

### 5.4 Spot light — `#spot`

**Target distance `d`** — derived on every read, never stored, and **independent of `range`**:

1. Cast `pickScene` from the body along forward. If it hits at distance `t`: `d = t`. Mark the
   target **surface-bound**.
2. No hit: `d = 3`.

`target = position + forward × d`. The Aim handle, the Card's Aim point and the Aim fact all use
this one value. `LIGHT_AIM_GUIDE_METERS` is no longer used for display. `range` is never an input
to `d`, and no Aim or Move gesture writes `range` (fixes D3).

**Drawn:** footprint ring (Guide) — the cone's cross-section at `d`, radius `ρ = d · tan(angle)`.
Two silhouette edges body → ring. **No ring at `range`.** If a range is authored: a 14 px bar
across the axis at the cap centre `position + forward × range`, joined to the target by a
derived-guide axis line. When `range < d` the bar sits between the body and the target and the
footprint ring and silhouette edges switch to derived-guide ink (the beam stops before it lands).

| Mark | Id | Anchor | Gesture | Writes | Clamp | Tag |
| --- | --- | --- | --- | --- | --- | --- |
| Target | `light-aim` | `target` | Pointer over a surface → that point; else existing fallback (`:688-696`) | `rotation` only | — | `Aim · {d} m` |
| Rim | `light-angle` | on the footprint ring, screen-right | Pointer ∩ plane ⟂ forward at `d` → `angle = atan(r / d)` | `angle` | 1°…80° | `Beam {deg}°` |
| Inner ring | `light-penumbra` | on the inner ring, screen-left | Pointer ∩ the same plane → `penumbra = 1 − atan(r / d) / angle` | `penumbra` | 0…0.95 | `Soft edge {pct}%` |
| Reach bar | `light-range` | cap centre (kind `point`) | `closestAxisPoint` along forward (unchanged) | `range` only | `≥ 0.10` | `Reach {r} m`, or `… · stops before the target` when `range < d` |
| Glyph | `light-body` | body | §5.2 | `position` + `rotation` | — | `Move …` |

- **Inner ring** (fixes D10). Derived-guide ring, radius `ρᵢ = d · tan(angle × (1 − penumbra))`:
  the edge of full brightness, matching the renderer. `penumbra = 0` puts it on the footprint
  ring; dragging toward the centre softens. Its grip is at screen-left so it never sits on the Rim
  grip. The Card field still accepts 0…100 %.
- **Wide beams** (`angle > 80°`). The footprint ring and silhouette edges are drawn at 80° in
  derived-guide ink. The Rim and Inner ring grips are **not mounted**. The Target grip shows
  `Beam {deg}° · wider than the guide` under its Aim tag. Beam width is edited from the Card
  (§6.1); the first Card value ≤ 80° restores both grips. No gesture ever writes an angle above
  80°, and no gesture rewrites a stored angle it did not edit.
- **Body move keeps the target** (O3). At gesture start, if the target is surface-bound, capture
  it as a fixed world point; during the drag `rotation = rotationForLightDirection(fixed −
  position)`; release commits `{ position, rotation }` as **one** update. If
  the target is not surface-bound, or **Shift** was held at press (`StagePointerIntent.shift`),
  rotation is unchanged.
- **Reach bar is absent when `range` is absent.** Reach is then set from the Card (§6.2). Reach is
  a cutoff the author sets on purpose; nothing sets it implicitly.
- **Light it** (`look/light-recipes.ts`) is unchanged. A Picture spot's forward ray hits its
  Artwork, so its target is surface-bound on the picture.

### 5.5 Directional light — `#directional`

**Presentation maths** (stored rotation is unchanged; `f` = `lightForward(rotation)`):

- `s = −f` (unit vector toward the source).
- **Height in sky** `= degrees(asin(s.y))`. Straight down → 90°.
- **From** `= (degrees(atan2(s.x, −s.z)) + 360) mod 360`. 0° is world −Z, 90° is world +X. When
  the horizontal part of `s` is shorter than `1e-6`, From keeps its last displayed value (0° if
  none) and gestures use that value.
- Inverse: `s = [sin(From)·cos(H), sin(H), −cos(From)·cos(H)]`, `f = −s`.

No compass letters: tags and fields show degrees. The dial marks 0° with a tick.

**Dial** (amended, A3). The dial is a screen-sized instrument placed in the world.

- **Centre `C`.** `B` = centre of `sceneBoundsUnion()` projected to the datum (no bounds →
  `[0, datum, 0]`). `C = B` when `B` projects inside the Stage viewport inset by 96 px on every
  side. Otherwise `C` = the pointer-ray through the viewport centre ∩ the datum plane; if that ray
  misses the datum, `C = B`. `C` is evaluated every frame and **frozen from press to release** of
  either bead.
- **Radius `R`.** The world radius whose screen-right ring point projects 72 px *(tunable)* from
  `C`'s projection; never below 0.5 m. `R` is frozen with `C` during a drag.

Drawn: the ring (Guide, world radius `R`, on the datum, with the 0° tick); a derived-guide spoke
`C → C + R·sₕ`; a derived-guide quarter arc from the ring up to overhead in the vertical plane of
From; three parallel arrows (Guide, 1.5 px, arrowheads) of length `1.35 R`, travelling along `f`,
spaced `0.4 R` apart across the dial. **Delete** `directionalBoxSegments` (`:917-969`) and the
1.5 m forward ray.

| Mark | Id | Anchor | Gesture | Writes | Clamp | Tag |
| --- | --- | --- | --- | --- | --- | --- |
| Ring bead | `light-azimuth` (kind `point`) | `C + R·sₕ` | Pointer ∩ datum → `From = bearing(point − C)` | `rotation` | — | `From {deg}°` |
| Arc bead | `light-elevation` (kind `point`) | `C + R·s` | Pointer ∩ vertical plane through `C` containing the From direction → `H = atan2(y, horizontal distance from C)` | `rotation` | Stage 5°…90°; Advanced field −90°…90° | `Height in sky {deg}°` |
| Other light tick | `light-directional-other:{entityId}` (kind `point`, no drag) | `C + R·sₕ` of that light | Click selects that light | nothing | — | that light's name |

No Move grip. No body mark.

**Several Directional lights.**

- **Name chip.** The selected light's name is drawn at `C` in the Tag style, truncated to 18
  characters with `…`. It is always on while the dial is mounted.
- **Other lights.** Every other Directional light in the scene draws a 6 px derived-guide tick on
  the ring at its own From bearing. Hover shows its name; click selects it (the dial then redraws
  for that light). Ticks never drag and draw no arrows, spoke or arc. Where ticks overlap, the
  nearest to the pointer wins; the Index lists every light by name.
- With no Directional light selected nothing is drawn on the Stage; a Directional light is selected
  from the Index or the Lights shelf list.

**Without the dial.** The Card's **Direction** row (§6.1) and the Advanced Direction sliders
(§6.2) write the same two values and are always available, whatever the view shows.

**Creation** (O5, fixes D1). Picking *Directional* on the Lights shelf issues `create-light`
immediately, selects the light, and does **not** arm placement. Position `[0, datum, 0]`
(unchanged). Direction: with `c` = camera forward projected on the datum and normalised (fallback
`[0,0,−1]`) and `left = cross([0,1,0], c)`: `sₕ = normalize(−c + left)`, Height in sky = 50°. The
light comes from behind the viewer's left shoulder. One history entry.

### 5.6 Placement of Point and Spot (O1) — `#placement`

`n` = surface normal at the hit, flipped to face the camera (existing, `:582-588`).

| Hit | Point body | Spot body |
| --- | --- | --- |
| Floor-like (`n.y ≥ 0.5`) | hit + `[0, 2.20, 0]` | hit + `[0, 2.20, 0]` |
| Wall (`|n.y| < 0.5`) | hit + `0.30 · n` | hit + `0.10 · n` |
| Ceiling-like (`n.y ≤ −0.5`) | hit + `0.30 · n` | hit + `0.10 · n` |
| Nothing | ray ∩ datum plane + `[0, 2.20, 0]`; no intersection → no candidate | same |

Replace `LIGHT_SURFACE_STANDOFF_METERS` and `LIGHT_WORKING_HEIGHT_METERS` with these four
constants. Spot aim on a plain click stays straight down; a press-drag aims at the release point.
Neither writes `range`: a new Spot is always **Unlimited** (amended, A2; today the press-drag
writes `range = d + 0.5`).

### 5.7 Ghosts — `#placement`

One lifecycle for everything placed from the Library (amended, A5).

**The candidate.** One pure function per subject, `candidateFor(pointer) → Candidate | null`,
produces the full create payload (pose, and for a pressed Spot its rotation). The ghost draws the
stored candidate; release commits the stored candidate. Release resolves the final up event
**synchronously** through the same function as a final move, publishes that final candidate,
then commits it. A queued animation-frame preview must not overwrite the final input. Nothing
recomputes a pose from the up event on a second path (today `finishArtworkResize` and `place()` do).

| State | Shows | Writes |
| --- | --- | --- |
| **Armed**, candidate exists | Ghost at the candidate · contact mark · chip `Click to place · Esc cancels` | — |
| **Armed**, no candidate (nothing under the pointer that this subject can sit on) | No ghost. Chip states the need: `Point at a surface` (lights, objects), `Point at a wall` (Artwork) | — ; a click does nothing |
| **Armed**, candidate fails the planner's predicate | Ghost in refusal ink; Tag = the planner's `message` | — ; a click does nothing |
| **Pressed** | Same ghost. Spot only: cone and footprint to the pointer, tag `Aim · {d} m`, chip `Release on what it should light` | — |
| **Committing** (release sent, outcome pending) | Ghost held at the candidate, chip `Placing…`; pointer moves and clicks are ignored | — |
| **Installed** | Ghost removed in the frame the accepted subject renders; subject selected; tool stays armed | one history entry |
| **Unchanged / no-op** | Ghost continues | none |
| **Refused on release** | Ghost stays at the candidate in refusal ink; Tag = `refused.message`; cleared by the next pointer move or after 4 s | none |
| **Failed** (the commit throws or rejects, e.g. an image import fails) | As Refused, with the error's user message on the existing notice surface; nothing partial remains | none |
| **Esc / tool change** | Ghost removed | none |

Rules:

- **Truthful refusal.** Refusal ink before release appears only when the candidate fails the
  **same pure predicate the planner evaluates**; the text is the planner's. The adapter invents
  no reasons. Where a planner exposes no predicate, the ghost stays in ghost ink and the refusal
  arrives on release.
- **Recovery.** After Refused or Failed the tool is still armed, the selection is unchanged, no
  history entry exists, and the next pointer move starts a fresh candidate.
- **Agreement.** The committed payload deep-equals the last drawn candidate. A unit test asserts
  it for each subject.
- **Lights** (fixes D11). `commitPlacement`, `commitGesture` and the Card commits read the
  `StageAcceptOutcome`. A refused handle drag clears the preview, returns the light to its accepted
  value and shows `refused.message` at the grip for 4 s.

| Subject | Change |
| --- | --- |
| **Object** | Lifecycle rows above only |
| **Point / Spot** | Implement the adapter's `hoverIntent` (hook exists, `stage/stage-facade.ts:702`; the light adapter lacks it). On hover compute the §5.6 body and publish through `candidatePreview`: ghost-ink drop stem + a 12 × 8 px cross at the contact point + the glyph at 75 % opacity (interim: a ghost-ink 10 px disc). Spot adds a straight-down footprint at half-angle 30° on the surface below. Pressed state uses the same preview with the live target. **The candidate also lights the scene** (§5.8) |
| **Artwork** | Keep the 65 % image ghost. Add a 1 px ghost-ink outline on the outer frame rectangle and the size tag `{w} × {h} cm`. While the texture is loading, draw the outline alone (`EntityArtwork` renders nothing until it resolves). Add the chips |
| **Directional** | No ghost (§5.5) |

### 5.8 Live lighting preview (A1)

Every lighting change is seen as light before it is committed.

**Primitive.** A session-only `StageLightPreview`, owned by the Stage session:
`{ overrides: Map<entityId, LightEntity>, candidate: LightEntity | null }`. The editor Stage shell
merges it into a **render-only** entity projection: an overridden light is replaced by
its preview value; the candidate is appended under one reserved session id. The accepted Scene
remains the only input for picking, selection, source identity, dirty state and persistence; the
candidate is not registered as an authored/pickable entity. `VisitorEntityGroups` and `EntityLight`
are unchanged and no visitor chunk imports the preview (hard rules 4, 5).

**Shadows.** Previewing a shadow-casting light must update its cast shadow with its illumination.
`StageShadowTriggers` currently invalidates on accepted Scene/geometry identities, so include a
render-only preview revision as an invalidation input. Do not mutate the accepted Scene or create
another renderer. Coalesce shadow invalidation to at most once per rendered frame; on cancel or
refusal, restore the accepted illumination **and** shadow.

| Source | Preview written | Commit |
| --- | --- | --- |
| Gizmo drag (every §5 handle) | `overrides[id]` = the light at the dragged value, on each pointer move | Release: one `update-light` with the last preview value |
| Card slider or colour dial (§6.2) | `overrides[id]` on each `input` event | `change`: one `update-light` with the last preview value |
| Point / Spot placement (§5.7) | `candidate` = the create payload, in Armed and Pressed states with a valid candidate | Release: one `create-light` with that payload |

Rules:

- **Never authored.** The preview is not in the document, history, save, dirty state, selection or
  any release payload. It does not survive a reload.
- **One entry.** Preview writes create no history. Release creates exactly one entry. Esc, cancel
  and a refused release create none and restore the accepted light.
- **Cleared** after successful install in the same presentation as the accepted light (the
  pending `Committing` preview stays visible), or on Esc, pointer cancel, pointer leaving the Stage
  (candidate only), refused or failed commit, tool or selection change, reading change, task close,
  and dispose. A refusal restores the accepted illumination and shadow.
- **Agreement.** The commit payload is the final synchronously resolved candidate, including the
  release event. Hold that candidate as the pending preview; never commit an older throttled frame.
- **Rate.** At most one rendered preview update per animation frame; later moves in a frame replace
  earlier. The final release value is captured synchronously even if a render frame is pending.
- **Candidate mount.** While a Point or Spot is armed the candidate stays mounted, at intensity 0
  when there is no valid candidate, so the light count changes on arm and disarm rather than on
  every hover. The candidate uses the creation defaults, including `castShadow`.
- **Where it shows.** Wherever lights render: the 3D readings and 2D Living. In 2D Paper only the
  guides move (the §6.1 note already says so).
- **Typed fields** commit on Enter and do not preview.

---

## 6. Light Card

### 6.1 Everyday rows — `#cards`

Header: name, kind line. Then labelled rows, label column 74 px, in this order:

| Kind | Rows |
| --- | --- |
| **Point** | Warmth · Brightness · Reach · Shadow |
| **Spot** | Warmth · Brightness · Beam · Shadow |
| **Directional** | Warmth · Brightness · Direction · Shadow |

- **Warmth:** chips `Warm` `Neutral` `Cool` (existing tokens). A stored colour that matches no
  chip shows a fourth read-only chip: the Warmth name + ` white` when on the white ramp (§6.3),
  else `Custom`.
- **Brightness:** chips `0.25×` `0.5×` `1×` `2×` `4×`; off-stop shows a read-only chip with the
  multiplier (`1.41×`).
- **Reach** (Point): chip `Unlimited` + metres field. Chip writes `range: null`; a typed value
  writes it.
- **Beam** (Spot): degrees field, 1…90, unit `°`. Above 80° the note `Wider than the guide can
  draw` appears (§5.4). A stored value above 90° is shown as it is and is not rewritten until the
  author types a new one (see §9 item 3).
- **Direction** (Directional): two degree fields, `From` 0…359 and `Height` 0…90 (Height in sky).
  Same writers as the dial beads (§5.5); available whatever the view shows.
- **Shadow:** checkbox `Cast shadows`.
- **Readout line** (kept): `{brightness} · {exact intensity} · {kind}`.
- **Note** `Paper shows the guide only. Living shows the light.` — only in the 2D Plan reading
  with Paper selected. Never in 3D (fixes D8).
- **Foot:** `Advanced ⌄` · Duplicate · Delete.

### 6.2 Advanced — `#advanced`

**Container.** The foot's `Advanced` toggle expands a list inside the same Card, below the
everyday rows. No second panel, no modal.

- The list is **groups**. Each group is one 32 px row: name left, a one-line **summary** of its
  current values right (mono, `--shell-ink-2`).
- **One group open at a time.** Opening one closes the other. Clicking the open group closes it.
- The open group and the Advanced toggle are **session state**, remembered per light kind; never
  saved, never in history.
- The Card scrolls internally when the list exceeds its maximum height; the header and foot stay.
- A group with no control for the selected kind is **not rendered**. There are **no disabled or
  placeholder controls** (D18).
- Each control row: label (92 px) · control · small exact value/unit. Sliders show plain end
  labels beneath.

**Commit rule** (amended, A1). A slider or the dial commits **once, on release** (`change`), as
one `update-light`. While dragging (`input`), the row's value text, the group summary, the Stage
guides **and the rendered light** follow the thumb through the live preview (§5.8); nothing is
written. Esc during the drag restores the accepted value and writes nothing. If the Card unmounts
mid-drag the preview is cleared and nothing is written. A typed exact value commits on Enter.

**Groups, in fixed order:**

| Group | Kinds | Controls | Summary |
| --- | --- | --- | --- |
| **Colour** | all | Mode switch `White` / `Colour`. White: **Warmth** slider (§6.3). Colour: **colour dial** + `Colour amount` readout + hex field (§6.4) | `Warm white` / `Colour #ffa04d` |
| **Brightness** | all | **Brightness** slider (§6.5) with the exact intensity field beside it | `1.41×` |
| **Shape** | Point, Spot | Spot: **Beam width** slider 1…80°, ends `Narrow`/`Wide`, with a field 1…90 (above 80° the thumb pins to `Wide` and the summary shows the true value); **Edge softness** slider 0…100 %, ends `Sharp`/`Soft`; **Reach** (`Unlimited` chip + slider 0.5…10 m + field). Point: **Reach** only | `30° · sharp · unlimited` |
| **Direction** | Directional | **From** slider 0…359°; **Height in sky** slider 0…90°, ends `Horizon`/`Overhead`, field accepts −90…90 | `From 300° · 50° high` |
| **Position** | Point, Spot | **Position** `X` · `Height` · `Z` (m). Spot adds **Aim toward (direction only)** `X` · `Height` · `Z` (m): committing it writes `rotation` toward that point and nothing else (§5.4). The typed coordinates are an aiming input, not a saved target; the fields subsequently display the derived surface intercept or 3 m fallback, which may differ from the entered coordinates | `3.00 · 2.20 · 2.00 m` |
| **Shadows** | all | `Cast shadows` (same field as the everyday row) | `On` / `Off` |

`Height` fields are `position[1] − datum`.

**Growth rules** (so later features never crowd the Card):

1. A new feature is **one row in an existing group**. A new group is allowed only when no group
   fits; it is appended **after Shadows**.
2. A group holds **at most five rows**. A sixth forces a split into a new group.
3. At most **eight groups** per kind. Beyond that the owner decides what leaves.
4. The **everyday rows are frozen** at four per kind (§6.1; Directional reaches four with A3). Nothing is promoted without an owner
   decision.
5. Every row has a plain-word label from §4.3 or a new entry added to that table in the same PR.
6. Every row contributes to its group summary, so closed groups stay readable.

**Implementation shape.** One registry, `adapters/light/light-advanced.ts`: an ordered list of
groups, each an ordered list of row descriptors `{ id, kinds, label, control, read(light),
write(value) → update-light payload, summary(light) }`. `LightCardFields.svelte` renders the
registry; it holds no per-row markup. Adding a feature is adding a descriptor.

Reserved slots the sheet illustrates under "later" (examples only, **not in scope**): Colour
filter, Fade with distance, Beam pattern, Shadow softness, and a *Behaviour* group.

### 6.3 Warmth (white balance)

Writes `color` only. No kelvin value is stored or shown (T2: warmth tokens are sRGB, not kelvin
claims).

Slider `w` ∈ [−100, +100], integer steps. Colour is piecewise-linear per sRGB channel between:

| `w` | Name | Colour |
| --- | --- | --- |
| −100 | Candle | `#ffb46b` |
| −50 | Warm | `#ffd6a5` (existing token) |
| 0 | Neutral | `#ffffff` (existing token) |
| +50 | Cool | `#dbe9ff` (existing token) |
| +100 | Sky | `#b8d0ff` |

Channels round to the nearest integer. **Name shown:** `w ≤ −75` Candle; `≤ −25` Warm; `< 25`
Neutral; `< 75` Cool; else Sky. The ramp draws behind the track; ends labelled `Candle`,
`Neutral`, `Sky`.

**Reading a stored colour:** find the `w` whose ramp colour is nearest; if every channel is within
±1, the light is in **White** mode at that `w`. Otherwise it is in **Colour** mode. The two end
colours are *(tunable)*; the three middle stops are fixed tokens.

### 6.4 Colour dial

Writes `color` only. A 132 px disc: **angle = hue** (0° at screen-right, clockwise), **distance
from centre = Colour amount** (0 % centre, 100 % rim). Colour = HSV(hue, amount, 1): value is
always 1, because darkness is Brightness's job. Readout `Colour amount {pct}%`; hex field beside
it (six-digit sRGB, Enter commits). Switching `White → Colour` starts at the current colour's hue
and amount; `Colour → White` snaps to the nearest ramp `w` and commits that colour.

### 6.5 Brightness slider

`intensity = π × 2^s`, `s` ∈ [−3, +3], step 0.1 (0.125× … 8×). Chips sit at `s = −2, −1, 0, 1, 2`
and the slider snaps to a chip within ±0.05. Ends labelled `Dim`, `1×` (centre), `Bright`. The
exact field accepts any finite value ≥ 0; outside the slider's range the thumb pins to the end and
the summary shows the true multiplier.

---

## 7. Artwork and Frame — `#artwork`

### 7.1 Selection

- `StageSelectionLayer`: skip the mesh contour pass for `kind === 'artwork'` when the tone is
  `selection`. Hover and erase tones are unchanged.
- `artwork/ArtworkResizeOverlay.svelte`: draw one closed 1 px selection-gold polygon through the
  four projected outer-frame corners (`artworkHandlePoint`), each pushed 6 px outward from the
  polygon centre in screen space. Nothing is drawn on the frame or the image.
- Corner grips (§4.2) sit on that polygon's corners. Move grip stays at the centre.
- **Size tags, always on while selected:** `{w} cm` centred 14 px below the bottom edge;
  `{h} cm` 14 px right of the right edge; both are the **image** size. During a corner drag the
  readout becomes `{w} × {h} cm · framed {fw} × {fh}`.

### 7.2 Card

Top to bottom:

1. **Size** — `Width` and `Height` fields in cm with a lock glyph between them (aspect is always
   locked; editing either rewrites both). Line beneath: `Framed {fw} × {fh} cm`, plus
   ` · {depth} cm deep` when the frame has depth.
2. **Hang** — one field: `{cm} cm centre above floor` = `(position[1] − datum) × 100`.
3. **Frame** — four tiles with a drawn thumbnail and label: `None` `Thin` `Gallery` `Float`.
   Colour chips with names: `Black` `Walnut` `Ivory` (disabled at 40 % for `None`). Checkbox
   `Mat, 6 cm` inside this section. One plain line: `{Style} · {Colour}` + ` · Mat 6 cm`; for
   None without Mat: `No frame`.
4. **Foot** — `Light it` (primary) · `Replace image` · `Advanced ⌄`.
5. **Advanced** — same container rules as §6.2. Groups: **Position** (`X` · `Height` · `Z`, m) and
   **Rotation** (`Tilt` · `Turn` · `Roll`, °). Then Duplicate, Delete.

Writers, payloads and refusals are unchanged (`ARTWORK_TRANSFORM`).

### 7.3 Move and Turn

- **Move follows the wall** (amended, A4). On every pointer move during a Move drag:
  1. Pick under the pointer with the placement filter (`isArtworkWallFace`).
  2. **On a wall face:** pose `P` = `artworkPlacement`'s position and yaw for that hit, then the
     hanging guides and height snap. Run the fit test on `P`.
  3. **Fit test.** Nine points on the outer frame rectangle of `P` (centre, four corners, four
     edge midpoints). From each, start 0.05 m in front of the wall and cast back along `−normal`.
     Every ray must hit a wall face with the **same `wallId`** as the pointer hit within 0.07 m.
     A miss, a farther hit or another `wallId` fails: the Artwork would overhang a wall end, an
     opening or a corner.
  4. **Curved Walls.** Preserve the existing flat, centre-tangent Artwork placement. Do not apply
     the 0.07 m straight-face corner proximity threshold to curved faces: their flat corners may
     naturally stand off the curve. Check wall ends and openings against the same T1 compiled
     Wall support, without introducing conformal/bending Artwork geometry.
  5. **Pass:** the candidate becomes `P`. **Fail:** the candidate **holds the last passing pose**
     and shows the tag `Stops at the wall edge`.
  6. **Not on a wall face** (a gap, a doorway, the floor, empty space): the candidate holds the
     last passing pose. No tag.
- **Corners.** There is no interpolation around a corner. While the pointer is within reach of the
  corner the fit test fails and the Artwork holds on its wall; once `P` fits on the adjoining
  wall the candidate jumps there with that wall's yaw. The same rule crosses a gap or an opening
  onto the next wall, and onto the far side of a doorway on the same wall.
- **Which side.** The face under the pointer, as placement already resolves it. An Artwork never
  moves to a face the pointer is not on.
- **Free move.** If **Shift** was held at press, or the start pose itself fails the fit test
  (free-standing or already overhanging), the Artwork moves in its own plane as today. A
  free-standing Artwork without Shift attaches at the first passing wall pose and follows walls
  from then on.
- **Release** commits the last drawn candidate `{ position, rotation }` as one `ARTWORK_TRANSFORM`
  (§5.7 agreement). A candidate equal to the start pose commits nothing.
- **Turn grip** is shown only when the Artwork is **not hung**: a ray from its centre along its
  back normal hits no wall face within 0.01 m. Hung Artwork turns only through Advanced.
- **Preview.** While a resize, move or turn ghost is live, the accepted Artwork is hidden and the
  ghost is drawn opaque (see §9).

---

## 8. Dependencies on shared T1/T2 R0 infrastructure

| Need | State | Blocks |
| --- | --- | --- |
| Pre-press hover hook (`hoverIntent`) | Exists | — |
| Point / ray / ring handles, lift-knob glyph, `screen.offset` | Exist (`stage/stage-handles.ts`) | — |
| A **screen-space glyph** an adapter can publish for previews and for unselected subjects | Missing. `StageCandidatePreview` has polygons, segments, labels (`stage-facade.ts:273-281`). `StageWorldGraphic` (`:294`) is `{id, kind, world}`; whether an adapter may contribute it is unconfirmed | Final §5.1 glyph and §5.7 light ghost. Interims are specified |
| A **screen-space bar / custom draw** for one handle | Missing | §5.4 Reach bar draws as a grip disc until then |
| **`StageLightPreview`** (§5.8): render-only light overrides and candidate, plus preview shadow invalidation | Missing. No transient render path exists; `registerProposal` (`stage/stage-session.ts`) is a lease record only. `StageShadowTriggers` observes accepted Scene identity | Live illumination and cast shadows (A1). **In scope**, step 1a. Shared with any later T1/T2 instrument that previews an entity |
| A **planner predicate** an adapter can call before release | Per planner; not uniform | Pre-release refusal ink (§5.7). Without it the refusal arrives on release |
| Wall pick facts `wallId`, `wallNormal` on `SceneRenderedHit`, from T1 compiled wall geometry | Exist (`artwork/artwork-placement.ts`) | §7.3 fit test. Openings are whatever T1 compiles; no second wall model |
| Viewport-centre ray and CSS-pixel projection for an adapter | Projection exists for handles; a viewport-centre ray for an adapter is unconfirmed | §5.5 dial fallback centre and constant screen radius |
| One ghost token set shared by Object, Artwork and Light | Not shared | Consistency only |
| Artwork manipulation through the Stage handle system | Not there: DOM buttons driven from `routes/project/[projectId]/spatial/+page.svelte:1030-1096` | Nothing here. Migration is an R0 decision |
| Camera navigation | Joint R0 | Not touched |

## 9. Verify in the browser before sizing

1. **Light shadows.** No per-light `shadow.camera`, `mapSize` or `bias` is set anywhere in `lib/`.
   With three.js defaults a Directional shadow frustum is a ±5 m box at `[0, datum, 0]`. Test:
   *Cast shadows* on, a wall 10 m from the origin. If shadows are missing, record it under Gate C;
   it is out of scope here.
2. **Resize double image.** `+page.svelte:4871` passes `artworkResizeGhost` to `StageCanvas`,
   which draws it at 65 % while the accepted Artwork still renders. Confirm, then apply §7.3.

3. **Beam above 90°.** The codec accepts a half-angle up to 180°; three.js documents 90° as the
   Spot maximum and its shadow camera uses `2 × angle` as field of view. Set 100° and look. If the
   light or its shadow misbehaves, keep the Card field at 1…90 as specified; if it is correct, the
   owner may widen the field.
4. **Preview cost.** Arm a Point light in the reference project and hover. Look for a visible
   hitch when the candidate mounts. Observation only; no benchmark.

## 10. Contract text to update in the implementing PRs (O8)

| Document | Change |
| --- | --- |
| `s3-lights/implementation-plan.md` §5.7 | Stand-offs (§5.6); Directional created on shelf pick (§5.5); pre-press ghost and its lifecycle (§5.7); a new Spot has no Reach |
| same, §5.8 | Body = horizontal plane + height stem; target at the surface, independent of Reach; Reach bar; soft-edge ring at `angle × (1 − penumbra)`; wide-beam rule; screen-sized dial with two beads, name chip and other-light ticks; no box; live lighting preview (§5.8) |
| same, §5.9 | Row labels; Direction row; `Advanced` with groups; From / Height in sky; sliders preview before commit |
| `t2-look-atmosphere/README.md` §5 table | Spot target is "the point it hits", not "far-cap centre"; Directional volume is the dial, not a box frustum |
| `a1-artwork/implementation-plan.md` | Selection outline, Card order, wall-following Move with the fit test, corners and free move (§7.3); ghost lifecycle (§5.7) |

## 11. Execution order

One PR per step; each leaves the product working.

| # | Scope | Sections | Depends on |
| --- | --- | --- | --- |
| 1 | Defect pass: elevation fallback, From / Height in sky presentation, Aim independent of Reach, soft-edge ring, Point reach extent, refusals surfaced, Card truthfulness and number formats | D1–D5, D8, D10, D11; §4.4, §5.3–§5.5 maths | — |
| 1a | `StageLightPreview` in the Stage shell; existing gizmo drags write it | §5.8 | 1 |
| 2 | Light Card everyday rows, including Direction | §6.1 | 1 |
| 3 | Advanced container, registry, Warmth, colour dial, Brightness slider; sliders preview | §6.2–§6.5 | 2, 1a |
| 4 | Artwork selection and Card | §7.1, §7.2 | — |
| 5 | Spot gizmo, wide-beam rule | §5.4 | 1, 1a |
| 6 | Point gizmo, height stem, placement stand-offs | §5.2, §5.3, §5.6 | 1 |
| 7 | Directional dial (view-anchored, name chip, other-light ticks) and shelf-pick creation | §5.5 | 1, 1a |
| 8 | Light hover ghost with lit candidate, ghost lifecycle, emitter glyph | §5.1, §5.7, §5.8 | 1a; R0 glyph primitive (interims otherwise) |
| 9 | Artwork move (fit test, corners), turn, ghost lifecycle | §7.3, §5.7 | §9 item 2 |

**Acceptance for every step.** Update the suites that pin replaced behaviour
(`light-adapter-lifecycle.test.ts`, `light-card-fields.test.ts`) and add unit tests for each new
pure rule: target distance (with and without a range, to prove independence), Aim and Move leave
`range` untouched, numeric Aim edits change direction without storing a target, soft-edge radius and its inverse, wide-beam grip mounting, From / Height in sky
round-trip, dial centre selection, Warmth ramp both directions, Brightness mapping, stand-off
table, Artwork fit test (wall end, opening, corner, free start, valid centre-tangent placement on
a curved Wall), commit payload equals the latest release candidate even with a queued frame,
preview cleared with no write on Esc and on refusal. Run the focused suites, `npm run check` and
`npm run test:arch`. Then one focused manual browser pass per changed gesture: drag → release
gives one undo entry; Esc mid-drag gives none and the light returns to its accepted look; the
light and its cast shadows visibly follow the drag and both restore on cancel; Undo and Redo
restore exactly; save → reload keeps the value. Compare each mark and string against §4 and the matching sheet panel.

## 12. Implementation record

The scope above is implemented on `t2-review-pass` in PR #314 with one commit per checkpoint.
The PR stays open and unmerged.

| # | Commit | Scope |
| --- | --- | --- |
| 1 | `3dfb004b` | Corrected light presentation maths, Aim/Reach and Card truthfulness |
| 1a | `15e54ddc` | Session-only `StageLightPreview`, renderer merge and light and shadow preview |
| 2 | `fd8978a3` | Everyday Light Card rows and the Direction values |
| 3 | `bfe3801c` | Advanced registry, Warmth, colour dial and live sliders |
| 4 | `52d95d15` | Artwork selection ink, Card order and scoped Card actions |
| 5 | `da72ce8b` | Spot Aim dial, wide-beam ink and fixed surface target |
| 6 | `fd022fc2` | Point stem, screen-facing reach ring and placement stand-offs |
| 7 | `9869922f` | Directional dial and immediate Directional shelf creation |
| 8 | `f81918f0` | Light hover ghost, lit candidate and placement lifecycle |
| 9 | `1c77c42b` | Artwork wall-follow move, nine-point fit test and ghost lifecycle |

Verification follow-ups are separate commits: `80409077` moves the new colour dial onto the
`--shell-white` presentation token, `c1e6e699` fixes the Advanced White/Colour mode toggle so it
uses Card-local display state instead of writing the invalid string `colour` as a hex colour, and
`3a486ad5` makes the preview projection a shadow trigger, excludes the candidate from the pick
registry and resolves a light release through its final up position.

**Verification evidence**

- `npm test` — 347 files, 4474 tests passed.
- `npm run test:arch` — 24 files, 202 tests passed with `--maxWorkers=2`.
- `npm run check` — 0 errors; the 4 reported warnings are the existing visitor a11y warnings in
  `VisitorPreviewSurface.svelte`.
- Focused suites for this work: `directional-dial`, `light-presentation`, `light-adapter-lifecycle`,
  `light-advanced`, `light-card-fields`, `artwork-wall-move`, `artwork-overlay`, `artwork-card`.
- Browser pass on a local Vite session: Spot placement from the Lights shelf created one selected
  light and one undo entry; the Advanced Colour group opened the hue dial; the Directional shelf
  pick created a selected `Sun` immediately at From 225° / Height 50° with only the dial's From and
  Height-in-sky marks. The browser pass did not exercise Artwork move, Point placement or visible
  cast shadows because the guest scene has no Artwork asset or receiving geometry; those paths are
  covered by the focused unit suites rather than by a visual check.

**Known gaps**

- The Directional dial's centre name chip and other-Directional ticks with click selection are not
  implemented; the approved marks are the ring, From spoke, quarter arc, travel arrows and the two
  point beads.
- A hover over a surface with no passing Artwork pose uses the candidate ghost ink only; there is no
  separate refusal predicate or refusal ink because the session has no planner refusal preview for
  Wall fit.
- The Artwork fit test samples the nine outer-frame points and rejects a sample that meets another
  Wall or lies more than 0.07 m from the pointer's Wall. It adds no conformal Artwork geometry.
- The Advanced Aim triplet reads the direction's 3 m fallback point, not a surface intercept, and
  is labelled `Aim toward (direction only)` so the fields do not imply a stored target.
