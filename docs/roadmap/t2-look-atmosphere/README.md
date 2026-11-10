# T2 — Look & Atmosphere: product direction and capability batch

**Status:** proposal for owner review, revision 2. Not a contract, not implementation permission,
not a second authority beside the references. **Review page:** [`review.html`](./review.html)
(open directly in a browser; SVG sketches and four small interactive studies).

**Read against:** [Shell / PLATE](../../reference/design-system/editor-shell-and-visual-system.md),
[Scene content](../../reference/components/scene-content.md) (§ Material and light semantic gaps),
[Assets](../../reference/components/assets.md) (§ Current asset system, P20),
[World toolbar cutover](../world-toolbar-shell-cutover/implementation-plan.md),
[T5 umbrella](../t5-expressive-geometry/umbrella-plan.md), the T1 next-batch proposal in PR #290,
and the [look-development research](../../../broad-research/creative-scene-composition-ux.md) as
input only.

**What revision 2 changes** (owner review of revision 1): the curated controls stay, but each is
now a *view onto an open model* rather than a limit (§3, §4); lights cover all three kinds, bare
emitters versus visible fixtures, and a path to rigs (§5); Looks work on Worlds that were never
prepared for them (§6); S0 becomes a verification gate that decides what we may promise (§7);
surface finishes no longer assume enclosed Rooms (§9); a small seams slice precedes parallel UI
work and Lights ship first (§11). Where I still disagree, §12 says why.

---

## 1. Where we are (code, 2026-11-10)

| Area | Landed | Shallow or missing |
| --- | --- | --- |
| Materials | Six catalogue definitions, three with texture sets. `SceneMaterialInstance` carries `baseTextureId`, `roughness`, `metalness`. P20 uploads, lists and delivers project images into `SceneTextureAsset`. Native forms and Walls both emit **metre UVs** | No colour on an instance. No mapping fields. Library › Materials tiles write nothing. Walls, floors and ceilings have no authored finish |
| Lights | Point / spot / directional entities with colour, intensity, range, angle, penumbra, `castShadow`; rendered in Stage and visit | No way to create, find or edit one in the shell. Aim is raw rotation. Units are not stated |
| Environment | `environment.preset` in Scene 5; one runtime-safe table shared by Stage, snapshots, Preview and visit | Preset id only. Hour slider is inert. Two environment controls exist; only Sky is mounted |
| Rendering | One Stage canvas, adapters shared with the visitor, `PCFShadowMap`, r187 | **No environment reflections.** Tone mapping, exposure and light units have never been audited as a set |
| Shell wiring | World toolbar registry, self-contained Sky popover | The spatial route is **5,901 lines with 97 imports**; every look slice would edit it |

## 2. Direction

> **A World has one Look, authored at three reaches: the Sky sets the mood, Finishes say what
> things are made of, Lights say where to look.** Each reach has one home in the shell and a
> curated start.

**Curated surface, open engine.** Every everyday control is a named view onto a stored physical
value. *Sheen: Satin* is roughness 0.6; *Warm* is a colour; *Golden hour* is a sun angle and a sky.
The model never stores the label and never closes the list, so depth is added by revealing more of
the same model, not by building a second one. Three reveal levels, the same in every home:

1. **Pick** — a curated tile (a Finish, a fixture, a Sky, a Look).
2. **Adjust** — at most four named controls, in the Card or the Sky popover.
3. **More** — exact values, images, mapping. Same writer, same undo, no new panel.

Stylized and realistic remain **one pipeline at different settings** (§6).

## 3. Ship now, contract now, safely later

| | Ship in this batch | Extensibility contract (model and seams now, UI later) | Can wait |
| --- | --- | --- | --- |
| **Finish** | Curated tiles; **any colour** (picker, palette, dropper); Sheen; **a Finish from your own image** through P20; Scale in metres and Direction; shared / just-this Ask | Schema carries every PBR map slot, mapping, opacity and emission as open numeric fields. One material factory, so a new property is one resolver change | Full PBR-set import UX, per-assignment mapping overrides, per-face on forms (T5), decals, painting |
| **Light** | Bare emitters of all three kinds placed and edited on the Stage; Lights in the Index; **Light it** | A fixture is an ordinary object grouped with an emitter. Lights are ordinary group members, so a saved rig is a saved group | Fixture models, articulated heads, saved rigs, live-linked rigs, area lights |
| **Sky** | Presets as starts; Time, Direction, Haze, Brightness; sun mark; sky-derived reflections **if S0 passes** | Stored as sun angles, colours and scalars, never as a preset-shaped blob. One resolved-look module with a quality input | Uploaded HDRIs, interior reflection capture, real solar model, per-Stop mood (Experience) |
| **Look** | Atmosphere + Treatment apply to **any** World; palette for followers; opt-in *Adopt palette* | A Look is data over the same fields; a Treatment is a resolve-time transform, never a rewrite | Outline / toon / bloom (post pass), look A/B snapshots |
| **Rendering** | What S0 measures and nothing else | No slice builds a material or light outside the shared factory and resolved-look module | Transmission glass, probes, baked or cached shadows, post |

## 4. Finishes: simple row, open model

A **Finish** is the project's reusable appearance (`SceneMaterialInstance`). The Card shows one
row; depth opens in place.

| Level | Creator sees | Stored |
| --- | --- | --- |
| Pick | Library › Finishes: curated, **This project**, **+ From image** | Instance referencing a base and optional maps |
| Adjust | **Colour** (palette swatches, then a free picker and dropper) · **Sheen** (Matte · Satin · Gloss · High gloss) | `color` as a literal or a palette-slot reference · `roughness` |
| More | **Image** (replace, remove) · **Scale** ("one tile = 1.2 m") · **Direction** (0° / 90°, free angle) · exact roughness · **Metal** on/off · bump strength · opacity · glow | map slots by P20 asset id · `mapping { tileMeters, rotation, offset }` · `metalness` · `normalScale` · `opacity` · `emissive` |

Decisions inside this:

- **Free colour is first-class**, not an advanced feature. Palette swatches sit in front of the
  picker because they are the cohesion lever, not because literals are discouraged.
- **Sheen is a view of roughness.** An exact value between stops reads *Custom* and the stops stay
  one tap away. I keep **Metal as a switch under More, not a second everyday slider**: half-metal
  values are almost always a mistake, but a custom Finish must be able to say "this image is metal".
- **A Finish from your image ships now.** P20 already uploads, lists and resolves project images
  and `baseTextureId` already exists; the missing parts are the Card entry and the mapping fields.
  Because forms and Walls emit metre UVs, **Scale is stated in real units** and one brick image
  tiles identically on a wall and a plinth.
- **Full PBR sets are a contract, not a UI, in this batch.** The schema carries normal, roughness,
  AO and metalness map slots from Scene 6. A drop-a-folder import that recognises a set is S8.
  Most creators have a photo, not a matched set; a single image plus Sheen and bump strength is
  the honest first step.
- **Mapping lives on the Finish.** A different scale on one wall is *Just this* (a clone). A
  per-assignment override is a later field on the assignment, noted so S1 does not preclude it.
- **Sharing is unchanged from revision 1:** shared by default, the Ask Rule on edit (*just this /
  all 7*), palette edits need no Ask because the palette is visibly global.

## 5. Lights: placed and edited on the Stage

**Emitter versus fixture.** An *emitter* is the Scene light entity. Visitors never see it; they see
its light. A *fixture* is a visible object (a pendant, a track head) grouped with an emitter. The
model gains no new light type: the Library › Lights shelf has two rows, **Light only** and
**Fixtures**, and a fixture is placed as one group whose Card shows the same light stratum.
A lampshade that should look lit uses a Glow finish; the emitter does the lighting.

Emitters ship now. Fixtures need models we do not have (an asset decision, D8), and an aimable
track head needs an articulated pivot, so they follow in S8 on the same contract.

**Finding invisible things.** Emitter glyphs appear while Lights is armed, while a light is
selected, and on hover. Lights get their own Index group, so a light is always selectable by name.

| Kind (shelf name) | Place, in 3D or Plan | Stage marks when selected | Card (Adjust) |
| --- | --- | --- | --- |
| **Point** (Bulb, Pendant, Lamp) | Click a surface. It stands off along the normal: hung below a ceiling, at lamp height above a floor. In Plan, height comes from the surface above | Glyph · **stem** to its host surface (drag = drop) · **reach ring** on the floor (drag = range) | Warmth · Brightness · Reach · Shadow (off by default) |
| **Spot** (Picture spot, Wash, Downlight) | **Press on the mount, drag, release on the target**: one gesture. A plain click aims along the normal | Glyph · **target** on the surface it hits · **cone rim** (drag = Beam) · dashed axis | Warmth · Brightness · Beam · Shadow. More: edge softness, range |
| **Directional** (the Sun; Fill, Moon) | The Sun belongs to the Sky and is moved by the sun mark. An extra directional is added from Lights › More and has no meaningful position | **Direction dial** (compass ring + elevation arc) at the World mark; parallel rays hatch the Stage during the drag | Warmth · Brightness · Shadow |

Rotation stays the stored truth and the ordinary rotate gizmo still works; the target, stem, ring
and dial are derived editor marks, mounted for the selection only and never serialized.

**Rigs.** Revision 1 said setups are one-undo placements, not stored things. I keep that for *this
batch* and no longer rule rigs out:

- **Now:** *Light it* recipes (Picture spot, Wash, Showcase) create ordinary lights, plus Duplicate.
- **Contract:** lights are ordinary group members, so a rig is a group. Saving one to the library
  follows the My Objects precedent: a typed item, inserted as a detached authored copy.
- **Later, deliberately:** a *live-linked* rig (edit once, every instance follows) needs the
  definition/instance model that objects do not have either. It should arrive for objects and
  lights together, not as a lighting special case.

## 6. Sky and Looks

**Sky** is unchanged in shape: preset tiles, then Time, Direction, Haze, Brightness, with sky and
ground colours and shadow softness under More. Presets are starting points (*Golden hour · edited*,
Reset). Stored as sun azimuth/elevation, colours and scalars; Time is a UI reading of elevation.

**A Look has three layers, and the first two need no preparation:**

| Layer | What it changes | Works on an ordinary World? | Touches authored choices? |
| --- | --- | --- | --- |
| **Atmosphere** | Sky, sun, haze, brightness, shadow softness and tint | Yes, always | Replaces the Sky settings. One undo; the prior Sky stays as a *Previous* tile for the session |
| **Treatment** | How finishes are *shown*: Natural · Flat colour (images off, sheen capped) · Clay (one neutral matte) | Yes, always | **No.** It is a World-level transform applied when the look is resolved. Turn it off and every Finish is exactly as authored |
| **Palette** | The project's colour slots | Only Finishes that follow a slot | Slot values change; literal colours never do |

So one click on *Riso* gives any World a flat sky, tinted crisp shadows and flat-colour surfaces,
without a single Finish being rewritten. Recolouring to the Look's palette is the explicit second
step: **Adopt palette** previews which literal colours would map to which slot and converts them
to followers in one undo. Applying a Look never touches lights or Finish assignments.

Treatment is authored World presentation (visitors see it). It is distinct from **Living | Paper**,
which stays an editor-only viewing preference. Treatments are parameter changes on the standard
materials, so this is still one pipeline; anything needing a post pass waits.

## 7. Rendering truth: S0 is a gate, not a foundation we assume

Revision 1 treated sky-derived reflections as settled. They are a hypothesis until measured, and
they have known limits that the UI must not paper over:

- **Sky reflections are not mirrors.** Surfaces reflect the sky and ground, never each other or
  the room. The top Sheen stop is therefore **High gloss**, not *Mirror*.
- **Indoors is the hard case.** A glossy floor in an enclosed Room would reflect open sky. S0 must
  show this and choose: accept, damp reflection by enclosure, or schedule an interior capture.
- **Opacity is not glass.** Without transmission there is no refraction or tinted shadow. The
  see-through bases ship under names S0 can defend (*Clear · Frosted · Tinted*), and the word
  *Glass* is used only if the gate images earn it.
- **Glow lights nothing**, and without bloom it only reads as "bright colour". The Card says so.

**S0 exit criteria** (a short report with images, in the S0 PR; the existing `/dev/materials`
route is the natural bench):

1. **Pipeline audit:** output colour space, tone mapping, exposure and light units written down
   as one agreed set. This item alone unblocks the Lights track.
2. **PBR chart:** a roughness × metal grid and three textured sets, under each Sky preset,
   outdoors and inside an enclosed Room. Decide the indoor policy.
3. **Live Sky:** while Time or Direction is dragged, sun, sky and haze follow every frame;
   measure the reflection rebuild and choose its policy (throttled or on release).
4. **Performance:** frame time and load on reference Worlds, on an integrated-GPU laptop and a
   phone-class device, in Stage and in the visit. This sets the shadow budget (D9).
5. **Paper / Living:** Paper stays neutral and unlit by the Sky; decide D4 from before/after images.
6. **Parity:** Stage, snapshot, Preview and visit resolve identical look values through one
   runtime-safe module; no editor code reaches visitor chunks; visit cold-start cost is recorded.

Each promise (top Sheen stop, see-through bases, Glow, shadow budget, Paper reflections) leaves S0
as **go, go with a renamed label, or wait**. **Not ruled out, each behind its own measurement:**
interior reflection capture, area lights, transmission, a post pass, baked or cached shadows. The
contract that keeps them open is cheap: one resolved-look module with a quality input, one material
factory, no slice bypassing either.

## 8. Homes: one writer per fact, no new panel

| Home (existing) | Owns | Never |
| --- | --- | --- |
| **Sky** chip → popover | The World's mood: preset, dials, More, the Looks row | Per-object facts. A second environment panel |
| **Stage** marks | Spatial facts by direct manipulation: target, stem, cone rim, reach ring, direction dial, sun mark | Numbers, lists, Apply |
| **Card** | The selection's one writer: a **Finish** row (Adjust, More in place); a light's stratum; foot action **Light it** | Browsing. The World's mood |
| **Library** (Instrument) | Choosing: Finishes (curated · This project · From image), Lights (Light only · Fixtures), Looks | Editing |
| **Paint** (dock tool + palette) | Applying a Finish by pointer, with scope, dropper, recents, palette | Editing the Finish itself |
| **Index** | Finding: a Lights group | Appearance values |
| **Living \| Paper** | Editor-only viewing preference, session-scoped | Authored truth |

```text
select object ─▶ Card · Finish row ─▶ swatch ─▶ Library › Finishes ─▶ back on the Card ─▶ More
                 Card · Light it   ─▶ emitter appears, selected ─▶ drag its target on the Stage
                 nothing selected  ─▶ Sky chip ─▶ drag Time or the sun mark ─▶ Looks row
```

## 9. Coordination

**T1 (PR #290, open-sided spaces, interior cutaways, overhead regions).** T2 does not define what
a floor or a space is.

- **Identity.** A surface finish is keyed by an **opaque surface identity that Layout publishes**
  (a wall face, a floor surface, an overhead surface). T2 never derives a surface from "a Room has
  one floor and one ceiling". An open-sided space, a courtyard or a suspended canopy is finishable
  the moment Layout names its surfaces, with no T2 change.
- **Scope.** Paint's widest scope is **Space**, answered by a Layout query ("which surfaces belong
  with this one"), not by Room enclosure.
- **Visibility.** A cutaway is a way of *seeing*; it must not relight. T2's requirement on T1's
  mechanism: a surface hidden from the camera still casts and blocks light, so the mood does not
  change when a creator looks inside. T1 owns how.
- **Sequencing.** Wall faces have landed identity (#287) and can ship first (S5a). Floors and
  overhead surfaces (S5b) wait for T1's decision and are not on this batch's critical path.
- ***Light it* finds a mount by casting upward** against whatever geometry exists, so it works
  under a canopy or an open sky and assumes no ceiling.

**T5.** T2 lands Paint for whole objects, wall faces and Space scope; T5 extends it to per-face and
region on forms when face identity exists (D3). T2 exposes no per-face control on forms.

## 10. Journeys

Counts are creator interactions after the geometry exists; each is on the review page.

- **Gallery lighting (5).** Sky → *Dusk* · select the painting → **Light it** (Picture spot above,
  30°, warm, shadow on) · drag the target to the canvas centre · drag the cone rim narrower ·
  Duplicate along the wall.
- **Product showcase (4).** Sky → *Paper* · select the product → Finish → *Brass* · **Light it ▾
  Showcase** (key, fill, rim, one undo) · Sheen → *Satin*. Honest limit: the brass reflects a
  neutral studio, not the plinth beside it.
- **Architectural daylight (5).** Sky → *Daylight* · drag the sun mark until light rakes through
  the opening · Time → 16:00 · Paint *Oak* at Space scope, then **+ From image** for the client's
  own brick, Scale 0.6 m · Shadows → *Soft*.
- **Deliberately stylized, on an existing World (3).** Library › Looks → *Riso*: flat sky, tinted
  shadows and flat-colour surfaces at once, nothing rewritten · **Adopt palette** → review the
  mapping, accept · change the *Accent* slot and every follower moves.

## 11. Decisions and batch

### Owner decisions

| # | Decision | Recommendation | Tier |
| --- | --- | --- | --- |
| D1 | Who stores a surface finish? | **Scene**, keyed by a Layout-published surface identity (§9). Layout stays appearance-free | 2 |
| D2 | Scene format | **Scene 6** carries sky, finish, palette and treatment fields. Surface finishes take **their own later bump** once T1's identity settles. Pre-beta a bump is strict-refuse and cheap; coupling S1 to T1 is not | 2 |
| D3 | Paint: T2 or T5? | T2 lands object / wall face / Space; T5 adds per-face on forms | owner |
| D4 | Reflections on Paper | Neutral studio reflection, no added light — **decided from S0 images**, not now | 2 |
| D5 | Light units | Keep physical stored units; Brightness stops are a UI mapping fixed by the S0 audit | 1 |
| D6 | Warmth | Store colour only; Warmth is a reading of it | 0 |
| D7 | Is the Sky a Card subject? | No. One popover writer; retire the unmounted environment panel | 1 |
| D8 | Curated assets | ~14 curated finishes and a few fixture models, CC0 only. Creator images go through P20 unchanged | 2 |
| D9 | Shadow budget | Set by S0 item 4; refuse in words beyond it | 1 |
| D10 | Seams slice first | Yes: P0 below, one behaviour-neutral PR | 0–1 |
| D11 | Treatment as authored presentation | Yes, in Scene 6, resolve-time only | with D2 |
| D12 | Fixtures and rigs | Fixture = object grouped with an emitter; rig = group; no new light type | 1 |

### Capability slices

These are **capability slices**, not implementation plans. Per the workflow, a plan is written only
for multi-PR, Tier 2 or invention-risking work, as the first commit of that work's own draft PR.

| Slice | Delivers | Needs | Format | Plan first? |
| --- | --- | --- | --- | --- |
| **P0 Look seams** | A `look` authoring module; mount points for a Card stratum, a Stage mark layer and a Library shelf; the existing Sky and material-pick wiring moved out of the route. No behaviour change | — | — | No. One PR |
| **S0 Rendering gate** | The §7 report, then sky-lit rendering landed to the level it proved | — | — | **Yes** (invention risk) |
| **S3 Lights** | Emitters of all three kinds: place, find, edit; marks; Card stratum | P0 · S0 item 1 | — | No |
| **S7 Light it** | Recipes aimed at the selection, one undo | S3 | — | No |
| **S1 Scene 6** | Types, codec, validation for §4 and §6 fields | D2, D11 · S0 report | **bump** | **Yes** (Tier 2) |
| **S2 Sky dials** | Popover dials, sun mark, edited / Reset | P0 · S0 · S1 | — | No |
| **S4 Finish** | Card row, free colour, Sheen, Paint for objects; then From image, Scale, Direction | P0 · S0 · S1 | — | No; likely two PRs |
| **S6 Looks** | Atmosphere + Treatment for any World; palette, followers, Adopt palette | S2 · S4 | — | No |
| **S5a Wall-face finishes** | Paint with Face and Space scope on Walls | S4 · D1 | **bump** | **Yes** (Tier 2, shared with T1) |
| **S5b Floors and overheads** | The same for T1's floor and overhead surfaces | S5a · T1 identity | — | With T1 |
| **S8 Catalogue and depth** | Curated sets, PBR-set import, fixture models, see-through and Glow as S0 allows | S4 · D8 | — | **Yes** (licence) |

```text
now      P0 seams ─┬─▶ S3 Lights ─▶ S7 Light it            (no format change: ships first)
         S0 gate ──┤
                   └─▶ S1 Scene 6 ─┬─▶ S2 Sky dials ─┐
                                   └─▶ S4 Finish ────┴─▶ S6 Looks ─▶ S8 Catalogue and depth
                                         └─▶ S5a Wall faces ─▶ S5b Floors / overheads (T1)
```

**Is S3 → S7 genuinely independent?** Yes, with one condition. Every light field already exists in
Scene 5, the marks are derived, and *Light it* writes ordinary lights, so the track needs no
format change and no reflections. The condition is S0 item 1: if the audit changes tone mapping or
units, Brightness stops are retuned. Stops are a UI mapping, so stored values survive, but running
the audit first avoids shipping stops twice. Lights are also the shortest path from bare
architecture to an art-directed space, so this is the right first delivery.

**P0, bounded.** The route keeps one construction of the look module and four mount points.
P0 proves the seam by moving the two consumers that exist today, and adds nothing speculative.
It is not a route refactor; anything beyond look wiring is out of scope and reported instead.

**Schema questions the S1 plan must answer** (not decided here): exact field names and ranges;
whether a map slot references a P20 asset id or a `SceneTextureAsset`; palette slots as free
swatches or fixed roles; where Treatment sits (recommended: `environment`); how catalogue bases are
versioned when a curated Finish changes; what the assignment record reserves for a later mapping
override and a surface identity.

**Checks per slice** follow the test contract: codec and validation (S1), resolved-look parity and
visitor-chunk isolation (S0, every Stage mark), one undo per gesture and write-nothing on Ask
cancel (S2–S6). Browser QA is focused and manual.

## 12. Where I held my position, and where I moved

| Review point | Outcome |
| --- | --- |
| Free colour, custom Finishes, imported images, mapping | **Moved.** All in the batch; image upload was wrongly deferred when P20 and `baseTextureId` already carry it |
| Full PBR-set import now | **Held, as sequencing.** The schema is open from Scene 6; the import UX waits for the single-image path to prove the flow |
| Roughness and metallic as everyday sliders | **Held.** Sheen stays the everyday control; exact roughness and a Metal switch are one level down, not removed |
| All three light kinds, emitter versus fixture | **Moved.** §5 |
| Reusable rigs | **Partly.** Saved groups are the contract; a live-linked rig entity should not precede the same capability for objects |
| More sophisticated rendering | **Moved in framing.** Nothing is ruled out; each step is gated by a measurement like S0's, not by this document |
| Looks on ordinary Worlds | **Moved, with a better mechanism than palette remapping:** a non-destructive Treatment. Automatic recolouring of literal colours stays opt-in because it rewrites authored choices |
| S5 and enclosed Rooms | **Moved.** Opaque Layout surface identity; S5b off the critical path |
| Seams slice | **Agreed**, kept to one behaviour-neutral PR with existing consumers as proof |
| One Scene bump for everything | **Reversed my own D2.** Coupling the look schema to T1's open questions costs more than a second cheap bump |

## 13. Unresolved questions

1. **Indoor reflections.** If S0 shows sky leak is unacceptable indoors, is damping by enclosure
   enough, or does an interior capture join this batch?
2. **Time.** A mood dial labelled in hours (recommended) or an honest clock needing latitude and north?
3. **Imported models.** Whole-object assignment replaces every mesh material. Should a model's
   Finish row offer only tint and sheen offset by default?
4. **Image quality floor.** Do we cap or downscale creator images, and warn on a visibly tiling photo?
5. **Palette slots.** Free swatches or fixed roles (Wall, Floor, Trim, Accent, Ink)? Fixed roles
   make curated Looks and *Adopt palette* far more predictable.
6. **Many small lights.** A candlelit World wants more shadows than any budget allows. Is that the
   first real case for cached shadows?
7. **Treatment and creator images.** Should *Flat colour* use an image's average colour (recommended)
   or the Finish's colour field?
8. **Editor default.** With a real Sky, should a new World open *Living* instead of Paper?
