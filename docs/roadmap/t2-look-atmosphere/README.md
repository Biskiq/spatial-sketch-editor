# T2 — Look & Atmosphere: product direction and capability batch

**Status:** proposal for owner review. Not a contract, not implementation permission, not a second
authority beside the references. **Review page:** [`review.html`](./review.html) (open directly in
a browser; SVG sketches and three small interactive studies).

**Read against:** [Shell / PLATE](../../reference/design-system/editor-shell-and-visual-system.md),
[Scene content](../../reference/components/scene-content.md) (§ Material and light semantic gaps),
[World toolbar cutover](../world-toolbar-shell-cutover/implementation-plan.md),
[T5 umbrella](../t5-expressive-geometry/umbrella-plan.md), and the
[look-development research](../../../broad-research/creative-scene-composition-ux.md) as input only.

---

## 1. Where we are (code, 2026-11-10)

| Area | Landed | Shallow or missing |
| --- | --- | --- |
| Materials | Six catalogue definitions (`content/materials.ts`), three with texture sets; `SceneMaterialInstance` carries `roughness`/`metalness`; shared-vs-unique semantics specified | **No colour on an instance.** Library › Materials tiles answer "Paint is planned" and write nothing. The Card shows a material id as a read-only fact, on forms only. Walls, floors and ceilings have no authored finish |
| Lights | Point / spot / directional entities with colour, intensity, range, angle, penumbra, `castShadow`; validated; rendered in Stage and visit | No way to create or edit one in the shell (Furnish · Lights is a placeholder). Aim is raw rotation. Units are not stated |
| Environment | `environment.preset` in Scene 5; one runtime-safe table shared by Stage, snapshots, Preview and visit | Preset id only. Hour slider is inert. `StageEnvironmentControl` (with a "later" panel) and `SkyControl` both exist; only Sky is mounted |
| Rendering | One Stage canvas, shared adapters with the visitor, `PCFShadowMap`, r187 | **No environment reflections at all.** A metalness-0.85 brass has nothing to reflect, so "polished" and "metal" cannot look right today whatever UI we add |

The last row is the finding that reorders the batch: reflective finishes are not a UI problem first.

## 2. Direction

> **A World has one Look, authored at three reaches: the Sky sets the mood, Finishes say what
> things are made of, Lights say where to look.** Each reach has exactly one home in the shell, a
> curated starting point, and no more than four everyday controls.

Creators choose *outcomes* (Polished, Warm, Golden hour, Aim here), never renderer parameters
(roughness 0.2, 3 200 K as hex, fog far 220). Parameters stay reachable under **More**, and the
model keeps storing physical values so nothing is lossy.

Three decisions make that one system rather than a properties panel:

1. **Finish, not material editor.** A Finish is *base* (Plaster, Oak, Brass, Glass…) + *colour* +
   *sheen* (Matte · Satin · Polished · Mirror). Metalness is a fact of the base, not a slider.
2. **Lights are aimed at things.** A light has a target point you drag on a surface; rotation is
   derived. Warmth, Brightness and Beam are named stops. Lights arrive as *fixtures* (Picture spot,
   Wash, Pendant, Lamp) that are presets of the three existing kinds.
3. **The Sky lights and reflects.** The environment's own sky and ground are prefiltered into the
   scene's image-based light. Reflections always match the authored mood, no HDRI concept is
   exposed, and no asset delivery is needed. This is what makes Polished and Brass worth having.

Stylized and realistic are the **same system at different settings**: a stylized World is a flat
sky, a small palette, Matte finishes without texture and crisp shadows. Paper already proves it.
We do not build a toon pipeline.

## 3. Pushback on the brief

| Brief item | Recommendation | Why |
| --- | --- | --- |
| Roughness + metallic response | One **Sheen** control; metal is a base | Two sliders produce mostly invalid combinations (half-metal plaster). Named stops are comparable across objects |
| Point / spot / directional | Keep the model; expose **fixtures** | Kinds are an implementation taxonomy. "Picture spot" tells a creator what it is for. Directional stays the Sky's sun; a second free directional is under More |
| Area lights | **Defer** | In three's WebGL path a rect area light casts no shadow and costs LTC shading on every lit material. A wide soft spot ("Wash") covers the gallery need |
| Emissive surfaces | **Glow** finish, honestly labelled | Cheap and expressive (signs, screens, lanterns), but it does not illuminate neighbours. The Card says so and offers *Add a light here*. No hidden paired light |
| Light setups | **A one-undo placement, not a persisted thing** | "Light it" and "Showcase" place ordinary lights aimed at the selection. A setup entity would be a second owner for the same lights |
| Image-based lighting | **Sky-derived only** in this batch | Uploaded or curated HDRIs add a licence decision, delivery weight and a second source of mood that can contradict the Sky |
| Reflection quality | **Not a creator setting** | Sky-derived reflections are the quality. No SSR, probes or planar mirrors this milestone |
| Glass | Clear / Frosted / Tinted as **opacity + sheen**, no transmission | Physical transmission costs an extra scene pass per frame. Revisit with measured budgets |
| Stylized looks | **Looks** = Sky + palette. No outline or toon shader | Outlines need a post pass or a material swap: that is the renderer rewrite the brief excludes |
| Shadow softness | **Crisp / Soft on the sun**; per-light *Casts shadow* with a budget | Only `PCFShadowMap` is reachable. Point-light shadows cost six passes. Refuse in words past the budget |
| Reusable materials *and* palettes *and* presets | Layer them, never overlap them (§5) | Three sharing mechanisms with unclear reach is the fastest way to lose a creator's trust |

Two capabilities the brief did not ask for and I think matter more than several it did:

- **Light it.** With an object or artwork selected, one action places a fixture on the nearest
  ceiling (or above), aimed at it at 30° from vertical, warm, with a shadow. It is the whole
  gallery journey in one interaction and it teaches aim-by-target by example.
- **Project palette.** Five to eight colours a Finish can *follow*. Changing one recolours every
  follower. This is the cohesion lever for beginners and the entire stylized workflow.

## 4. Homes: one writer per fact, no new panel

The answer to "another collection of floating panels" is that **no new surface is introduced**.

| Home (existing) | Owns | Never |
| --- | --- | --- |
| **Sky** chip → popover (right Head pill) | The World's mood: preset, Time, Direction, Haze, Brightness; sky/ground colours and shadow softness under More; saved Looks | Per-object facts. No second environment panel: retire `StageEnvironmentControl`'s panel |
| **Stage** marks | Spatial facts by direct manipulation: a light's **aim target** and beam, the **sun mark** on the workspace rim while Sky is open | Numbers, lists, Apply |
| **Card** | The selection's Look stratum, the one writer: a **Finish** row for an object or surface; **Warmth · Brightness · Beam · Shadow** for a light | Browsing. The World's mood |
| **Library** (Instrument) | Choosing: **Finishes** (curated + This project), **Lights** (fixtures), **Looks** | Editing. A Library tile is picked, then the Card or Paint takes over |
| **Paint** (dock tool + palette) | Applying a Finish by pointer: object, wall face, room. Dropper. Five recents and the palette | Editing the Finish itself |
| **Furnish · Lights** (dock tool) | Placing a fixture by pointer | — |
| **Living \| Paper** (viewing preference) | Whether the editor shows the World's Look or plain Paper. Session-only, as today | Authored truth |

**Moving between them** is selection plus one hop, with the Stage never leaving:

```text
select object ─▶ Card · Finish row ─▶ tap swatch ─▶ Library › Finishes (pick) ─▶ back on the Card
                 Card · Light it   ─▶ fixture appears, selected ─▶ drag its aim target on Stage
                 Esc (nothing selected) ─▶ Sky chip ─▶ drag Time / the sun mark
```

The Card foot gains one Look-family action for renderable subjects: **Light it**. The Sky is
deliberately *not* a selectable subject and gets no Card: it is ambient World state with one
writer, reached from one place that is always visible.

## 5. Presets, Finishes, palette and Looks: one layering

```text
Look            = Sky settings + palette values            (World-level, applied or saved whole)
  Palette       = 5–8 project colours                      (Scene, World-level)
    Finish      = base + colour (literal | follows palette slot) + sheen   (SceneMaterialInstance)
      Assignment = this object / this wall face / this room uses that Finish
```

- **Curated finishes** in the Library are templates. Applying one creates (or reuses) a **project
  Finish** with the same name. Applying the same curated finish twice shares one Finish.
- **Shared is the default; unique is one explicit choice.** Editing a Finish used elsewhere
  triggers the existing Ask Rule in the Card: *Walnut is used by 7 things — change **just this**
  or **all 7**?* "Just this" clones once for the selected subset, per the Scene contract. The
  choice is remembered for the rest of that selection's edits, not globally.
- **A palette edit needs no Ask.** The palette is visibly global; each slot shows its follower
  count. That is the difference between the two mechanisms: Finishes are shared by *assignment*,
  palette colours are shared by *intent*.
- **Applying a Look never touches assignments or lights.** It replaces Sky settings and palette
  values, so a World built on the palette re-moods in one click and a World of literal colours
  keeps them. One undo step.
- **Presets are starting points, never modes.** After picking Golden hour and moving Time, the
  chip reads *Golden hour · edited*; Reset returns to the preset. No "custom" preset id.

## 6. Journeys

Counts are creator interactions after the geometry exists. Each is walked through in the review
page.

**A. Gallery lighting (5).** Sky → *Dusk* · select the painting → Card **Light it** (a Picture
spot lands on the ceiling, 30°, 3000 K, shadow on) · drag the aim dot to the canvas centre · Beam
→ *Narrow* · Duplicate along the wall for the row (existing Duplicate keeps each copy's aim offset).

**B. Product showcase (4).** Sky → *Paper* (studio-neutral reflections) · select the product →
Finish swatch → Library › *Polished brass* · **Light it ▾ Showcase** (key, fill, rim in one undo) ·
Sheen → *Satin* to calm the highlight.

**C. Architectural daylight (5).** Sky → *Daylight* · drag the **sun mark** round the plan rim
until light rakes through the window · Time → 16:00 · Paint: *Oak* with Room scope on the floor,
*Plaster* on walls · Shadows → *Soft*.

**D. Deliberately stylized (4).** Library › Looks → *Riso* (flat two-tone sky, crisp tinted
shadows, five-colour palette) · Paint palette colours with *Matte* onto forms · change the
**Accent** palette slot and watch every follower move · Sky › *Save as look*.

## 7. Ownership and interaction decisions

| # | Decision needed | Recommendation | Tier |
| --- | --- | --- | --- |
| D1 | Who stores a Wall / floor / ceiling finish? | **Scene** stores surface-finish assignments keyed by stable Layout identity (wall + Inside/Outside face, room floor, room ceiling). Layout stays appearance-free; deleting the Layout subject drops the assignment through F.4 compound acceptance | 2 (hard rule 2 reading) |
| D2 | Scene format | **One bump, Scene 5 → 6**, carrying every field in §8 at once: bump and strict refuse, no migration | 2 |
| D3 | Paint ownership (registry says "after T5") | **T2 lands Paint** for whole object, wall face and room scope. **T5 extends** it to per-face / region on forms and solids when face identity exists. T2 exposes no per-face control on forms | owner call |
| D4 | Environment reflections on Paper | Paper gains a **neutral studio reflection** with no added diffuse light, so finishes read correctly while editing on Paper. Changes the "neutral illumination only" row of PLATE | 2 (approved design) |
| D5 | Stored light units | Keep three's physical units as stored truth (candela for point/spot, lux for sun); Brightness stops are a UI mapping. Resolves the contract's "truthful stored units" gap without a field change | 1 |
| D6 | Warmth | Store `color` only (as today). The Card shows a Warmth slider when the colour lies on the blackbody ramp, otherwise *Custom colour* with *Back to warmth* | 0 |
| D7 | Sky as Card subject | **No.** Sky popover is the one writer; retire the unmounted `StageEnvironmentControl` panel | 1 (shell rule) |
| D8 | Curated texture sets | ~14 finishes, 1k albedo + normal + roughness, CC0 sources only, lazy with the existing fallback-colour path | 2 (licence / assets) |
| D9 | Shadow-casting light budget | Sun + 3 spot shadows; point lights cast none in this batch; the fourth request refuses in words. Number set by the S0 measurement, not by this document | 1 |

Standing interaction rules for the batch:

- Every slider drag is **one** undo step on release; live preview during the drag is session state.
- A light's helpers (beam, target) are mounted for the selection only and never serialized.
- "Plain Paper while editing" remains the only editor-only rendering deviation and stays visibly
  session-scoped. Everything else resolves through one runtime-safe look module read by Stage,
  snapshots, Preview and the visit; a parity check compares the resolved values, not pixels.
- PMREM output is a derived renderer resource with scope and disposal, never authored truth.

## 8. Implementation batch

Proposed capability ids (ledger shape is the owner's; these are names to claim against):
`scene.look-schema`, `render.sky-lit`, `scene.environment-edit`, `scene.light-author`,
`scene.finish-assign`, `scene.surface-finish`, `scene.look-palette`, `scene.finish-catalogue`.

```text
          ┌─ S2 Sky dials ───────────────────────────────┐
S0 sky-lit ┤                                              ├─ S6 Palette & Looks
          │        ┌─ S3 Lights: place, aim, Card ─ S7 Light it
S1 schema ─┴────────┼─ S4 Finish: Card, Library, Paint ─┬─ S5 Wall/floor/ceiling finishes
                    └───────────────────────────────────┴─ S8 Curated set, Glass, Glow
```

| Slice | Delivers | Depends on | Tier | Notes |
| --- | --- | --- | --- | --- |
| **S0 Sky-lit rendering** | One runtime-safe resolved-look module; scene environment prefiltered from the Sky (and the neutral studio for Paper); Stage / snapshot / visit parity check; shadow-budget measurement | — | 1 (+D4) | No UI, no format change. Every existing World looks slightly better; brass stops being black. Bounded spike first: confirm `PMREMGenerator.fromScene` cost and regeneration policy on r187 (regenerate on Sky commit, never per frame) |
| **S1 Scene 6 look schema** | Types, codec, validation only: environment overrides (sun azimuth/elevation or time, haze, exposure, sky/ground colours, shadow softness); material instance `color` (literal or palette slot), `finish` kind, `opacity`, `emissive`; `palette`; `surfaceFinishes` | D1, D2 | 2 | Pure `project-model`. Lets S2–S6 run in parallel without a second bump |
| **S2 Sky dials** | Popover: Time, Direction, Haze, Brightness, More; sun mark on the Stage rim; *edited* / Reset; hour slider becomes real | S0, S1 | 1 | Replaces the inert slider and the "later" rows |
| **S3 Lights** | Furnish · Lights places fixtures; Library › Lights; Card light stratum; aim target + beam mark; degrees-for-radians and the explicit out-of-range repair from the Scene contract | S1 (D5 only) | 0–1 | No schema need beyond D5; can start before S1 merges |
| **S4 Finish** | Card Finish row (swatch, colour, Sheen); Library › Finishes picks; Paint for whole objects with dropper and recents; shared / just-this Ask | S0, S1 | 1 | Replaces the "Paint is planned" notice |
| **S5 Surface finishes** | Paint with wall-face and Room scope; floor and ceiling; renders through the existing wall material factory seam | S4, D1 | 1 | Needs T1's persistent Inside/Outside faces (landed in #287's line) |
| **S6 Palette & Looks** | Palette editor in Paint's palette; *follows palette* on a Finish; Library › Looks (curated + saved); Save as look | S2, S4 | 1 | The stylized journey ships here |
| **S7 Light it** | Card action: Picture spot / Wash / Showcase placement aimed at the selection, one undo | S3 | 0 | Ceiling-seeking uses Layout queries read-only |
| **S8 Catalogue** | ~14 curated finishes with map sets; Glass (Clear/Frosted/Tinted); Glow | S4, D8 | 2 | Asset pipeline and licence review; Glow copy must say it does not light the room |

**Independently executable after S0 + S1:** S2, S3 and S4 touch different surfaces (Sky popover,
light Card + Stage marks, finish Card + Library + Paint). The practical conflict is the route file
(`spatial/+page.svelte`, ~5 000 lines): each slice should land its wiring as a small, separately
rebased hunk, and whoever merges second rebases.

**Suggested order for value:** S0 → S1 → S3 + S2 in parallel → S4 → S7 → S6 → S5 → S8. Lights
first after the foundation because, per the research and our own Dusk preset ("Your lamps carry
it"), lighting is the shortest path from raw architecture to an art-directed space, and it needs
no schema change.

**Checks per slice** follow the test contract: codec and validation (S1), resolved-look parity
(S0), one-undo-per-gesture and Ask Rule write-nothing-on-cancel (S2–S6), visitor-chunk isolation
for every Stage mark (S2, S3). Browser QA is focused and manual; nothing here needs scripted E2E.

## 9. Deferred, with reasons

Area lights · uploaded/curated HDRIs · physical glass transmission · bloom and any post pass ·
outlines / toon shading · per-face finishes on forms (T5) · decals and wall graphics · texture
upload as a Finish image and metric tile control (delivery exists in P20; the UX is its own slice
once S8 proves the catalogue path) · look snapshots / A–B comparison · **per-Stop lighting or time
of day in Experience** (highest-value follow-up, but it is an Experience design, not T2).

## 10. Unresolved questions

1. **Time vs sun angle.** Is "Time" an honest clock (needs a latitude and north) or a mood dial
   along a curated arc? Recommendation: a mood dial labelled with hours, plus free Direction. A
   real solar model is an architectural-accuracy feature we have not been asked for.
2. **Imported models.** Whole-object assignment replaces every mesh material and loses imported
   glass/alpha (Scene contract). Should the Finish row on a model offer only *tint* and *sheen
   offset* by default, with full replacement behind an explicit choice?
3. **Texture mapping on forms.** Walls emit metric UVs. Do native forms have a mapping that makes
   a textured finish look right, or do forms get untextured bases until T5 decides UV provenance?
4. **Glow and expectation.** Is a Glow that lights nothing acceptable without bloom, or does it
   wait for a post pass?
5. **Light it without a ceiling.** Outdoors or under a lifted ceiling, where does the fixture go:
   a free-standing height above the subject, or refuse in words?
6. **Dusk and shadow budget.** A candlelit World wants many small lights. Is three spot shadows
   plus shadowless points enough, or is this the first real case for baked or cached shadows?
7. **Palette slot names.** Free-named swatches, or fixed roles (Wall, Floor, Trim, Accent, Ink)
   that curated Looks can target reliably? Fixed roles make Looks far more predictable.
8. **Editor default.** With a real Sky, should a new World open *Living* instead of Paper?
