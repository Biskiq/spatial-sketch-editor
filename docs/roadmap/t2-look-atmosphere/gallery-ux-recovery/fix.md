# T2 · Gallery UX Recovery — diagnosis and specification

**Status:** design accepted by the owner (all decisions in §2). Nothing is implemented.
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
is needed. The instrument layer is what is wrong: 9 defects, 9 confusing behaviours, 4 missing
pieces.

## 2. Accepted decisions

| # | Decision | Accepted outcome |
| --- | --- | --- |
| O1 | Where a new light sits | Point 0.30 m off walls/ceilings; Spot 0.10 m; both 2.20 m above a floor click (§5.6) |
| O2 | Moving a light body | Horizontal plane through the body, plus a height stem (§5.2) |
| O3 | Moving a Spot body | Keeps its target; Shift keeps its direction (§5.4) |
| O4 | Directional dial position | Centre of the scene bounds on the datum (§5.5) |
| O5 | Creating a Directional | On shelf pick, no Stage click (§5.5) |
| O6 | Brightness chips | `0.25× 0.5× 1× 2× 4×`, with the row label (§6.1) |
| O7 | Turn grip on wall-hung Artwork | Hidden (§7.3) |
| O8 | Approved T2 text | Updated in the implementing PR (§10) |
| O9 | Card "More" | Renamed **Advanced**; grouped list, one group open (§6.2) |

O2, O4, O5 change approved-design text and O9 changes a shared Card surface: Tier 2 / Tier 1 under
`docs/workflow.md`. Owner acceptance is recorded here.

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
`Aim · {d} m` · `Beam {deg}°` · `Soft edge {pct}%` · `From {deg}°` · `Height in sky {deg}°`.

---

## 5. Light instruments

All marks are derived, editor-only, mounted for the selected light only (the glyph excepted, §5.1),
admitted through the existing handle host, and commit through `update-light` on release. One
release = one history entry. Esc or cancel = no entry. Existing handle ids are kept; new ids are
named below.

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

**Target distance `d`** — derived on every read, never stored:

1. Cast `pickScene` from the body along forward. If it hits at distance `t`: `d = t`, capped at
   `range` when a range is authored. Mark the target **surface-bound**.
2. No hit, range authored: `d = clamp(range − 0.5, 0.5, 3)`.
3. No hit, no range: `d = 3`.

`target = position + forward × d`. The Aim handle, the Card's Aim point and the Aim fact all use
this one value. `LIGHT_AIM_GUIDE_METERS` is no longer used for display.

**Drawn:** footprint ring (Guide) — the cone's cross-section at `d`, radius `d · tan(angle)`,
clamped for drawing at 80° as today. Two silhouette edges body → ring. **No ring at `range`.** If
a range is authored: a derived-guide axis line from the target to the cap centre
`position + forward × range`, and a 14 px bar across the axis there.

| Mark | Id | Anchor | Gesture | Writes | Clamp | Tag |
| --- | --- | --- | --- | --- | --- | --- |
| Target | `light-aim` | `target` | Pointer over a surface → that point; else existing fallback (`:688-696`) | `rotation`; **and `range` only by the extend rule** | — | `Aim · {d} m` |
| Rim | `light-angle` | on the footprint ring, screen-right | Pointer ∩ plane ⟂ forward at `d` → `angle = atan(r / d)` | `angle` | 1°…80° | `Beam {deg}°` |
| Inner ring | `light-penumbra` | footprint centre, radius `ρ·penumbra` | unchanged, measured at `d` | `penumbra` | 0…1; shown only for `0.02 ≤ p ≤ 0.98` | `Soft edge {pct}%` |
| Reach bar | `light-range` | cap centre (kind `point`) | `closestAxisPoint` along forward (unchanged) | `range` | `≥ 0.10` | `Reach {r} m`, or `… · stops before the target` when `range < d` |
| Glyph | `light-body` | body | §5.2 | `position` + `rotation` | — | `Move …` |

- **Extend rule** (fixes D3). After an aim or a body move, let `d′` be the new target distance.
  If `range` is authored **and** `range < d′ + 0.5`, write `range = d′ + 0.5` in the same
  `update-light`. Never shorten `range`. Never create a `range` that was absent.
- **Body move keeps the target** (O3). At gesture start, if the target is surface-bound, capture
  it as a fixed world point; during the drag `rotation = rotationForLightDirection(fixed −
  position)`; release commits `{ position, rotation }` (plus the extend rule) as **one** update. If
  the target is not surface-bound, or **Shift** was held at press (`StagePointerIntent.shift`),
  rotation is unchanged.
- **Reach bar is absent when `range` is absent.** Reach is then set from the Card (§6.2).
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

**Dial.** Centre `C` = centre of `sceneBoundsUnion()` projected to the datum; no bounds →
`[0, datum, 0]`. Radius `R = max(1, 0.25 × sceneRadius)`, `sceneRadius` = half the bounds diagonal.

Drawn: the ring (Guide, world radius `R`, on the datum, with the 0° tick); a derived-guide spoke
`C → C + R·sₕ`; a derived-guide quarter arc from the ring up to overhead in the vertical plane of
From; three parallel arrows (Guide, 1.5 px, arrowheads) of length `1.35 R`, travelling along `f`,
spaced `0.4 R` apart across the dial. **Delete** `directionalBoxSegments` (`:917-969`) and the
1.5 m forward ray.

| Mark | Id | Anchor | Gesture | Writes | Clamp | Tag |
| --- | --- | --- | --- | --- | --- | --- |
| Ring bead | `light-azimuth` (kind `point`) | `C + R·sₕ` | Pointer ∩ datum → `From = bearing(point − C)` | `rotation` | — | `From {deg}°` |
| Arc bead | `light-elevation` (kind `point`) | `C + R·s` | Pointer ∩ vertical plane through `C` containing the From direction → `H = atan2(y, horizontal distance from C)` | `rotation` | Stage 5°…90°; Advanced field −90°…90° | `Height in sky {deg}°` |

No Move grip. No body mark.

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
constants. Spot aim on a plain click stays straight down with no `range`; a press-drag aims at the
release point and writes `range = d + 0.5` (unchanged).

### 5.7 Ghosts — `#placement`

One behaviour for everything placed from the Library:

| State | Shows |
| --- | --- |
| **Armed**, pointer over the Stage | Ghost at the candidate pose · contact mark on the surface · chip `Click to place · Esc cancels` |
| **Pressed** | Same ghost. Spot only: cone and footprint to the pointer, tag `Aim · {d} m`, chip `Release on what it should light` |
| **Refused** | Ghost in refusal ink with the planner's reason |
| **Released** | One history entry; subject selected; tool stays armed |

| Subject | Change |
| --- | --- |
| **Object** | None. Reference behaviour |
| **Point / Spot** | Implement the adapter's `hoverIntent` (hook exists, `stage/stage-facade.ts:702`; the light adapter lacks it). On hover compute the §5.6 body and publish through `candidatePreview`: ghost-ink drop stem + a 12 × 8 px cross at the contact point + the glyph at 75 % opacity (interim: a ghost-ink 10 px disc). Spot adds a straight-down footprint at half-angle 30° on the surface below. Pressed state uses the same preview with the live target |
| **Artwork** | Keep the 65 % image ghost. Add a 1 px ghost-ink outline on the outer frame rectangle and the size tag `{w} × {h} cm`. While the texture is loading, draw the outline alone (`EntityArtwork` renders nothing until it resolves). Add the chip |
| **Directional** | No ghost (§5.5) |

---

## 6. Light Card

### 6.1 Everyday rows — `#cards`

Header: name, kind line. Then labelled rows, label column 74 px, in this order:

| Kind | Rows |
| --- | --- |
| **Point** | Warmth · Brightness · Reach · Shadow |
| **Spot** | Warmth · Brightness · Beam · Shadow |
| **Directional** | Warmth · Brightness · Shadow |

- **Warmth:** chips `Warm` `Neutral` `Cool` (existing tokens). A stored colour that matches no
  chip shows a fourth read-only chip: the Warmth name + ` white` when on the white ramp (§6.3),
  else `Custom`.
- **Brightness:** chips `0.25×` `0.5×` `1×` `2×` `4×`; off-stop shows a read-only chip with the
  multiplier (`1.41×`).
- **Reach** (Point): chip `Unlimited` + metres field. Chip writes `range: null`; a typed value
  writes it.
- **Beam** (Spot): degrees field, 1…80, unit `°`. Above 80° the field shows the value and the
  note `Wider than the guide can draw`.
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

**Commit rule.** A slider or the dial commits **once, on release** (`change`), as one
`update-light`. While dragging, only the row's value text and the group summary update; no write.
A typed exact value commits on Enter. (A live rendered preview during the drag needs a Stage
transient-entity override that does not exist; it is listed in §8 and is not part of this work.)

**Groups, in fixed order:**

| Group | Kinds | Controls | Summary |
| --- | --- | --- | --- |
| **Colour** | all | Mode switch `White` / `Colour`. White: **Warmth** slider (§6.3). Colour: **colour dial** + `Colour amount` readout + hex field (§6.4) | `Warm white` / `Colour #ffa04d` |
| **Brightness** | all | **Brightness** slider (§6.5) with the exact intensity field beside it | `1.41×` |
| **Shape** | Point, Spot | Spot: **Beam width** slider 1…80°, ends `Narrow`/`Wide`; **Edge softness** slider 0…100 %, ends `Sharp`/`Soft`; **Reach** (`Unlimited` chip + slider 0.5…10 m + field). Point: **Reach** only | `30° · sharp · unlimited` |
| **Direction** | Directional | **From** slider 0…359°; **Height in sky** slider 0…90°, ends `Horizon`/`Overhead`, field accepts −90…90 | `From 300° · 50° high` |
| **Position** | Point, Spot | **Position** `X` · `Height` · `Z` (m). Spot adds **Aim point** `X` · `Height` · `Z` (m): committing it writes `rotation` toward that point and applies the extend rule (§5.4) | `3.00 · 2.20 · 2.00 m` |
| **Shadows** | all | `Cast shadows` (same field as the everyday row) | `On` / `Off` |

`Height` fields are `position[1] − datum`.

**Growth rules** (so later features never crowd the Card):

1. A new feature is **one row in an existing group**. A new group is allowed only when no group
   fits; it is appended **after Shadows**.
2. A group holds **at most five rows**. A sixth forces a split into a new group.
3. At most **eight groups** per kind. Beyond that the owner decides what leaves.
4. The **everyday rows are frozen** at four per kind (§6.1). Nothing is promoted without an owner
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

- **Move follows the wall.** During a Move drag, pick under the pointer with the same filter
  placement uses (`isArtworkWallFace`). On a wall face the candidate takes `artworkPlacement`'s
  position and yaw for that hit; otherwise it stays in its own plane (current behaviour). Hanging
  guides and height snap apply in both cases. Release commits `{ position, rotation }` as one
  `ARTWORK_TRANSFORM`.
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
| **Transient entity override** so a Card drag re-renders the light before commit | Missing | Live preview for §6.2 sliders. Not in scope |
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

## 10. Contract text to update in the implementing PRs (O8)

| Document | Change |
| --- | --- |
| `s3-lights/implementation-plan.md` §5.7 | Stand-offs (§5.6); Directional created on shelf pick (§5.5); pre-press ghost (§5.7) |
| same, §5.8 | Body = horizontal plane + height stem; target at the surface, not the far cap; Reach bar; dial at scene centre with two beads; no box |
| same, §5.9 | Row labels; `Advanced` with groups; From / Height in sky |
| `t2-look-atmosphere/README.md` §5 table | Spot target is "the point it hits", not "far-cap centre"; Directional volume is the dial, not a box frustum |
| `a1-artwork/implementation-plan.md` | Selection outline, Card order, wall-following Move |

## 11. Execution order

One PR per step; each leaves the product working.

| # | Scope | Sections | Depends on |
| --- | --- | --- | --- |
| 1 | Defect pass: elevation fallback, From / Height in sky presentation, aim extend rule, Point reach extent, Card truthfulness and number formats | D1–D5, D8; §4.4, §5.3–§5.5 maths | — |
| 2 | Light Card everyday rows | §6.1 | 1 |
| 3 | Advanced container, registry, Warmth, colour dial, Brightness slider | §6.2–§6.5 | 2 |
| 4 | Artwork selection and Card | §7.1, §7.2 | — |
| 5 | Spot gizmo | §5.4 | 1 |
| 6 | Point gizmo, height stem, placement stand-offs | §5.2, §5.3, §5.6 | 1 |
| 7 | Directional dial and shelf-pick creation | §5.5 | 1 |
| 8 | Light hover ghost and emitter glyph | §5.1, §5.7 | R0 glyph primitive (interims otherwise) |
| 9 | Artwork move, turn, ghost polish | §7.3, §5.7 | §9 item 2 |

**Acceptance for every step.** Update the suites that pin replaced behaviour
(`light-adapter-lifecycle.test.ts`, `light-card-fields.test.ts`) and add unit tests for each new
pure rule: target distance, extend rule, From / Height in sky round-trip, Warmth ramp both
directions, Brightness mapping, stand-off table. Run the focused suites, `npm run check` and
`npm run test:arch`. Then one focused manual browser pass per changed gesture: drag → release
gives one undo entry; Esc mid-drag gives none; Undo and Redo restore exactly; save → reload keeps
the value. Compare each mark and string against §4 and the matching sheet panel.
