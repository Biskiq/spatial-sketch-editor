# T2 — Look & Atmosphere: product direction and capability batch

**Status:** **approved planning baseline** (owner approval of the direction and first milestone,
2026-11-11; revision 4 closes the last five questions under delegated design authority). It
authorises the direction and the batch, **not** the implementation of any slice: each slice is
claimed, planned where §12 says so, and reviewed on its own, and every Tier 2 item is still decided
in that slice's PR. It is not a reference contract; §12 lists the contracts each slice must amend. **Review page:** [`review.html`](./review.html)
(open directly in a browser; SVG sketches and five small interactive studies).

> **UX authority (13 November 2026).** For lighting presentation, the Light Cards, the Environment
> control (Time and Sky) and the shell placement of these controls, the finalized
> [`gallery-ux-recovery/ux-design.html`](./gallery-ux-recovery/ux-design.html) (revision 4) is the
> **authoritative T2 UX reference for subsequent implementation**. It wins where it disagrees with
> the `fix.md` sections its §0 lists; everywhere else `fix.md` remains the contract. PR #314
> implements that `fix.md` recovery and stays open for review. The newer design is delivered in
> **separate follow-up PRs**, with functional seams and visual presentation separated. Nothing here
> brings a deferred capability forward: Directional retirement, stored Sky fields, grouping,
> volumetrics and WebGPU work stay gated by their own slices.

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
prepared for them (§6); S0 becomes a verification gate that decides what we may promise (§8);
surface finishes no longer assume enclosed Rooms (§10); a small seams slice precedes parallel UI
work and Lights ship first (§12). Where I still disagree, §13 says why.

**What revision 3 adds:** **Artwork as content** (§7): a creator's own paintings, photographs and
graphics as first-class objects that are placed, framed, lit and visited, with a recorded path to
a 2D Artwork Studio. It also folds in group behaviour, camera-style free light placement and
frustum beam controls (§5). I found no written record of those three decisions in the repository
or on the PRs, so §5 states them **as I understood them**; correct anything that differs.

**What revision 4 settles** (reasoning in §13): *Light it* does not group automatically; the beam
guide is kept visibly separate from the light itself; S3 gets an implementation plan and group
behaviour becomes its own slice; S8 separates manual map assignment from automatic set import; no
control is shown before it works.

---

## 1. Where we are (code, 2026-11-10)

| Area | Landed | Shallow or missing |
| --- | --- | --- |
| Materials | Six catalogue definitions, three with texture sets. `SceneMaterialInstance` carries `baseTextureId`, `roughness`, `metalness`. P20 uploads, lists and delivers project images into `SceneTextureAsset`. Native forms and Walls both emit **metre UVs** | No colour on an instance. No mapping fields. Library › Materials tiles write nothing. Walls, floors and ceilings have no authored finish |
| Lights | Point / spot / directional entities with colour, intensity, range, angle, penumbra, `castShadow`; rendered in Stage and visit | No way to create, find or edit one in the shell. Aim is raw rotation. Units are not stated |
| Environment | `environment.preset` in Scene 5; one runtime-safe table shared by Stage, snapshots, Preview and visit | Preset id only. Hour slider is inert. Two environment controls exist; only Sky is mounted |
| Rendering | One Stage canvas, adapters shared with the visitor, `PCFShadowMap`, r187 | **No environment reflections.** Tone mapping, exposure and light units have never been audited as a set |
| Artwork | P20 stores PNG / WebP / JPEG up to 25 MB and releases pin them | **No image object exists.** The only route today is a `plane` primitive with a textured material instance, which makes a painting a shared Finish that stretches when resized |
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

The three reaches serve a fourth thing that is not appearance at all: **the work on show**.
Artwork is content (§7). It is in this batch because it is what the Sky, the Finishes and the
Lights are *for*, and because "hang it, frame it, light it, walk up to it" is a result an owner
can judge by eye.

## 3. Ship now, contract now, safely later

| | Ship in this batch | Extensibility contract (model and seams now, UI later) | Can wait |
| --- | --- | --- | --- |
| **Finish** | Curated tiles; **any colour** (picker, palette, dropper); Sheen; **a Finish from your own image** through P20; Scale in metres and Direction; shared / just-this Ask | Schema carries every PBR map slot, mapping, opacity and emission as open numeric fields. One material factory, so a new property is one resolver change | Full PBR-set import UX, per-assignment mapping overrides, per-face on forms (T5), decals, painting |
| **Artwork** | Import PNG / JPEG / WebP as an **Artwork object**; place on a wall or free in 3D; size in real units with the aspect locked; transparency kept; four frame styles and a mat; **Light it** fitted to the frame; a derived *Lit by* reading; identical in Visitor Preview | Artwork `source` is a tagged union (image now, drawing later). Frame geometry is generated from parameters. Card-action and Library-entry slots that show nothing until a capability fills them | Trim (crop, straighten), wall labels, glazing, persistent hosting on a moving wall, SVG / video, the Artwork Studio |
| **Light** | Bare emitters of all three kinds placed **free in space** and aimed like a camera; **frustum** beam handles; *Look through*; Lights in the Index; **Light it** | A fixture is an ordinary object grouped with an emitter. Lights are ordinary group members, so a saved rig is a saved group | Fixture models, articulated heads, saved rigs, live-linked rigs, area lights |
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
| More | **Image** (replace, remove) · **Scale** ("one tile = 1.2 m") · **Direction** (0° / 90°, free angle) · exact roughness · **Metal** on/off · opacity · glow. From S8: **Maps** | map slots by P20 asset id · `mapping { tileMeters, rotation, offset }` · `metalness` · `normalScale` · `opacity` · `emissive` |

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
- **PBR maps arrive in two distinct steps, both in S8; the schema is open from S1.**
  - **S4 ships one image:** the colour image, with Sheen. No bump control appears, because there
    is no bump map to control.
  - **S8a, manual assignment:** More › **Maps** lists named slots (Colour · Bump · Roughness ·
    Shading · Metal). Each slot picks one project image. Bump strength and *Flip bump* appear only
    once a bump map is assigned. This is deterministic and is the escape hatch for everything else.
  - **S8b, automatic set import:** drop several files together and Biskiq *proposes* one Finish,
    matching slots by the common filename suffixes, with a preview and the slot list open for
    correction. Nothing is assigned silently; an unrecognised file is left unassigned and said so.
  - Manual comes first because automatic import is built on it and must fall back to it. Packed
    (three-in-one) maps and gloss-instead-of-roughness conversion wait.
- **Mapping lives on the Finish.** A different scale on one wall is *Just this* (a clone). A
  per-assignment override is a later field on the assignment, noted so S1 does not preclude it.
- **Sharing is unchanged from revision 1:** shared by default, the Ask Rule on edit (*just this /
  all 7*), palette edits need no Ask because the palette is visibly global.

## 5. Lights: placed like a camera, shaped like a frustum

**Emitter versus fixture.** An *emitter* is the Scene light entity. Visitors never see it; they see
its light. A *fixture* is a visible object grouped with an emitter. The model gains no new light
type. Emitters ship now; fixture models are an asset decision (D8) and follow in S8.

**Free placement, camera-style.** A light is not bound to a ceiling or a wall. Like a Camera View
it is a body somewhere in space plus the thing it looks at. Surfaces are a magnet during placement,
never a requirement, and the ordinary move and rotate gizmos always work. This replaces revision
2's mount-first gesture, and it removes the "no ceiling" problem instead of working around it.

- **Place:** press where the light body goes (on a surface under the pointer, otherwise at the
  working height), drag, release on what it should hit. A plain click aims straight down.
- **Look through** (Card foot): the Stage shows the view from the light, under a state pill
  (*Looking through Picture spot · Done*). What is inside the circle is what gets lit; orbiting
  re-aims. It is realised as a Camera inspection pose through the one Camera authority, not a
  second camera, and it writes only the light's transform, once, on Done.

**Frustum beam handles.** A selected light draws the same kind of mark a Camera View does: an
outlined volume, never a filled one, with its footprint traced on the surfaces it reaches.

| Kind (shelf name) | Volume when selected | Handles | Card (Adjust) |
| --- | --- | --- | --- |
| **Spot** (Picture spot, Wash, Downlight) | A cone frustum from the body to its far cap | **Target** (far-cap centre: drag across surfaces to aim, push or pull for distance) · **rim** of the far cap (Beam) · **inner ring** (soft edge) | Warmth · Brightness · Beam · Shadow |
| **Point** (Bulb, Pendant, Lamp) | A reach sphere, drawn as its ring on the floor and a stem to the nearest surface | **Ring** (reach) · body | Warmth · Brightness · Reach · Shadow (off by default) |
| **Directional** (the Sun; Fill, Moon) | A box frustum: direction and the area it shadows. The Sun stays the Sky's and moves by the sun mark | **Direction dial** at the World mark (compass ring + elevation arc) | Warmth · Brightness · Shadow |

**The guide is not the light.** The frustum says where a light *can* reach; the rendered picture
says what it *does*. They must never be confused:

- The guide is **line only, in mark ink**: never filled, never tinted with the light's colour,
  never brighter where the light is stronger. It ignores occlusion and falloff by design.
- Illumination is **only ever the rendered result**, with shadows, falloff, Brightness and the
  Sky's exposure. No mark imitates it and no overlay "previews" it.
- The far cap is where the light reaches nothing, not where it is bright. A light at Brightness 0
  still shows its guide.
- On **Paper**, where lights are not rendered, a selected light shows the guide with a state pill
  (*Guide only · Living shows the light*), so nobody reads an outline as a lit wall.
- *Look through* shows the rendered scene; the circle on it is the same guide.

Rotation stays the stored truth. Target, rim, ring, frustum and dial are derived editor marks,
mounted for the selection only and never serialized. **Finding invisible things:** emitter glyphs
show while Lights is armed, on hover and on selection, and Lights have their own Index group.

**Groups.** One rule set for fixtures, lit artworks and rigs:

- A group is flat membership (today's cluster): members keep world transforms, there is no parent
  transform, and visitors render members as if ungrouped.
- **Click selects the group; a second click selects the member.** Move, rotate, Duplicate and
  Erase act on the whole group rigidly, so a spot keeps its aim on its painting.
- The group's Card shows name, members and the strata all members share; a member's Card is its
  own. Ungroup is one action and changes nothing visible.

**Does *Light it* group? No, not with its subject; grouping is one optional action.** Final (D12):

- ***Light it* never groups a light with what it lights.** It places the light, leaves it
  selected, and the Card foot offers **Group with *Still life***. One tap, never automatic.
- **A recipe that makes several lights groups those lights with each other.** *Showcase* (key,
  fill, rim) is one rig; its parts mean nothing alone. The rig is still not grouped with the subject.
- **Several things selected → one light for all of them.** *Light it* then places a single Wash
  whose frustum covers the selection. This is the gallery light that serves a wall of works.
- **The Card shows a derived *Lit by* reading** (*Lit by Picture spot*; tap to select it), computed
  from which guides reach the object. It answers "which light is this?" without storing a relation.

Why not automatic: a grouped painting needs two clicks to select, which taxes the most common
object in a gallery; Duplicate would silently multiply shadow-casting lights past the budget;
Erase would take a light that also serves the neighbour; and one light for many works is ordinary
practice. The lit-row case stays cheap: group once, then Duplicate, or select painting and light
together.

**Rigs.** Recipes create ordinary lights now, grouped only as above. A
saved rig is a saved group in the library, inserted as a detached copy (the My Objects precedent).
A *live-linked* rig needs the definition/instance model objects do not have either, and should
arrive for objects and lights together.

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

## 7. Artwork as content

**Does it belong in this batch? Yes, as its own slice.** It is content, not appearance, so it does
not belong *inside* Finish or Light. But it is the highest-value addition here for the people the
product is for, it gives *Light it* its real subject, and every part of it is checkable by eye.
It needs none of the rendering gate except one colour-fidelity check, so it can run beside the
Lights track.

**An Artwork is an object, never a Finish.** Where the image enters decides what it becomes:

| Entry | Becomes | Sharing |
| --- | --- | --- |
| Drop files on the Stage, or Library › **Artwork** › Import | An **Artwork object** per file, with its own identity, size, frame and place | None. Two hangings of one image are two objects that happen to show the same bytes |
| Card › Finish › More › **Image** | A map on a **Finish** | The Finish rules of §4: shared by default, Ask on edit |

Both read the same P20 bytes; neither knows about the other. *Use as Finish* on an Artwork is a
later, explicit bridge (it is how a drawn pattern will reach a wall).

**The journey** (the Artwork study on the review page is this, end to end):

1. **Import.** Drop one or several files. Each lands in Library › Artwork › This project and the
   first is armed for placement. Aspect ratio and transparency come from the file.
2. **Place.** The artwork follows the pointer. Over a wall it turns flush and an **eye-line guide**
   (centre at 1.5 m) and neighbour centre lines appear as magnets; anywhere else it stands upright
   facing you. Mounting is optional: the gizmo moves and turns it freely in 3D at any time. Corner
   handles resize with the aspect locked and a live reading in centimetres; the Card takes exact
   width or height.
3. **Frame.** Card: **None · Thin · Gallery · Float**, a **Mat** toggle, and a frame colour. The
   frame is part of the artwork, sized in real centimetres, so it does not thicken when the
   artwork is scaled. A transparent graphic stays a cut-out when unframed.
4. **Light it.** One action: a Picture spot placed in front and above at 30°, its frustum fitted
   to the frame with a margin, left selected, with *Group with artwork* offered and not assumed.
5. **Visit.** Visitor Preview shows the same thing without marks. Save and reopen restore it.

**What ships, and how it is drawn.** A matte surface that responds to lights and casts a shadow,
with no sky reflection, so the picture is never washed by a highlight. Alpha is kept for both
colour and shadow. Frames are generated geometry from four parameters (style, width, depth, mat)
and are never stored as meshes; the frame colour is a fixed swatch set now and becomes a Finish
row once S4 lands.

**Pushback and limits.**

- **Identity, not rendering, is the point.** Internally an Artwork *is* drawn as a textured quad
  and that is fine. What is rejected is the *authoring* route that exists today, a `plane`
  primitive carrying a material instance: there the image is a shared Finish, resizing stretches
  it, and the Ask Rule fires on a painting. The Artwork owns its image reference directly; it has
  no material instance, never appears among Finishes, and Paint and the dropper do not apply to it.
- **"Mounted" is a snap, not a bond, in this batch.** An artwork placed on a wall does not follow
  that wall if the wall is later moved, which matches how every object behaves today. Persistent
  hosting should come from Scene's support relation for all objects, not as an artwork special case.
- **No glazing.** Reflective picture glass needs what S0 has not yet proved.
- **No editing in the first slice,** but see Trim below: it should come before any drawing tool.
- **Colour fidelity is the real risk.** Tone mapping shifts colours and artists will notice. S0
  gains a criterion for it (§8).

**Schema and resource dependencies** (for the slice's plan; none decided here):

- A new Scene entity kind, so a **format bump**. Fields in outline: `source`, one authored size
  (width; height follows the aspect), `frame`, optional credit. It is world-local like every entity.
- The image is a P20 project asset. Open: whether the registry row stays `texture` or gains a
  neutral `image` kind; where pixel dimensions are recorded; whether a display derivative is
  made for very large files (P20 makes none today, and the cap is 25 MB).
- **Release and visit:** the release manifest must pin images referenced by Artwork entities as it
  pins Finish textures, and the cold visitor loader must verify them. This is the one dependency
  outside the editor and the reason the slice gets a plan.

**High ceiling: a 2D Artwork Studio, without building one now.** The seams are in the model and the wiring, never on screen: **no control is shown before it works** (a standing rule for the whole batch, which also means no empty Fixtures row before fixture models exist, and that the inert hour slider goes when S2 lands).

| Seam | Now | Later |
| --- | --- | --- |
| **Source union** | `source: { kind: 'image', asset }` | `{ kind: 'drawing', document }`: an authored 2D document as a typed resource, rendered to the same displayed image. Frame, placement, lighting and visiting do not change |
| **Card action slot** | Artwork Card foot: Light it · Replace image. The foot is filled from a registry, so **no Edit control exists** until it does something | **Edit**, entering a Studio scope |
| **Studio scope** | Nothing | The **same scoped-entry pattern as T5's Object Studio** (enter from the selection, world pose kept, *Back to World*, one selection, one Card), with the Stage in a flat reading square to the picture plane. Tools live in the dock and its palette; colours come from the project palette. No new permanent panel and no second canvas application |
| **Library entry** | Artwork › Import, and nothing else | Artwork › **New drawing** beside it |
| **Bridge to surfaces** | Nothing | *Use as Finish*, so a drawn pattern can tile a wall without confusing the two identities |

Recommended order after this batch: **Trim** (crop and straighten a photographed painting; far
more artists need this than need to draw), then flat shapes, text and fills, then a brush. Layers,
filters and photo retouching are a different product and stay out.

## 8. Rendering truth: S0 is a gate, not a foundation we assume

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
7. **Artwork colour fidelity:** a reference image under neutral light at default Brightness, side
   by side with its source file. Choose tone mapping and the artwork's response so the difference
   is not visible to an artist. This item and item 1 are all the Artwork slice needs from S0.

Each promise (top Sheen stop, see-through bases, Glow, shadow budget, Paper reflections) leaves S0
as **go, go with a renamed label, or wait**. **Not ruled out, each behind its own measurement:**
interior reflection capture, area lights, transmission, a post pass, baked or cached shadows. The
contract that keeps them open is cheap: one resolved-look module with a quality input, one material
factory, no slice bypassing either.

## 9. Homes: one writer per fact, no new panel

| Home (existing) | Owns | Never |
| --- | --- | --- |
| **Sky** chip → popover | The World's mood: preset, dials, More, the Looks row | Per-object facts. A second environment panel |
| **Stage** marks | Spatial facts by direct manipulation: artwork corners and hang guides; a light's frustum, target, rim and ring; direction dial; sun mark | Numbers, lists, Apply |
| **Card** | The selection's one writer: a **Finish** row (Adjust, More in place); a light's stratum; an artwork's **Size** and **Frame**; foot actions **Light it** and *Look through* | Browsing. The World's mood |
| **Library** (Instrument) | Choosing and bringing in: **Artwork** (This project · Import), Finishes (curated · This project · From image), Lights (Light only · Fixtures), Looks | Editing |
| **Paint** (dock tool + palette) | Applying a Finish by pointer, with scope, dropper, recents, palette | Editing the Finish itself |
| **Index** | Finding: a Lights group | Appearance values |
| **Living \| Paper** | Editor-only viewing preference, session-scoped | Authored truth |

```text
select object ─▶ Card · Finish row ─▶ swatch ─▶ Library › Finishes ─▶ back on the Card ─▶ More
                 Card · Light it   ─▶ emitter appears, selected ─▶ drag its target on the Stage
drop image files ─▶ Library › Artwork ─▶ place on a wall ─▶ Card · Frame ─▶ Card · Light it
                 nothing selected  ─▶ Sky chip ─▶ drag Time or the sun mark ─▶ Looks row
```

## 10. Coordination

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
- **Lights need no host.** Free placement means *Light it* works under a canopy or an open sky
  and assumes no ceiling; an overhead surface is a magnet when one is there.
- **Artwork on a wall** uses the wall face only as a placement magnet in this batch. Persistent
  hosting is a Scene support question for all objects, to settle with T1 later.

**T5.** The Artwork Studio path reuses Object Studio's scoped-entry pattern rather than adding a second kind of studio (§7). T2 lands Paint for whole objects, wall faces and Space scope; T5 extends it to per-face and
region on forms when face identity exists (D3). T2 exposes no per-face control on forms.

## 11. Journeys

Counts are creator interactions after the geometry exists; each is on the review page.

- **Gallery, from a folder of photographs (6).** Drop the files on the Stage · place the first on
  the wall at the eye line · Card → Frame *Gallery* with a Mat · **Light it** (Picture spot in
  front and above, 30°, frustum fitted to the frame) · *Group with artwork*, then Duplicate along
  the wall and *Replace image* on each · Sky → *Dusk*. For one light over the whole wall instead:
  select the works together, then **Light it**.
- **Product showcase (4).** Sky → *Paper* · select the product → Finish → *Brass* · **Light it ▾
  Showcase** (key, fill, rim, one undo) · Sheen → *Satin*. Honest limit: the brass reflects a
  neutral studio, not the plinth beside it.
- **Architectural daylight (5).** Sky → *Daylight* · drag the sun mark until light rakes through
  the opening · Time → 16:00 · Paint *Oak* at Space scope, then **+ From image** for the client's
  own brick, Scale 0.6 m · Shadows → *Soft*.
- **Deliberately stylized, on an existing World (3).** Library › Looks → *Riso*: flat sky, tinted
  shadows and flat-colour surfaces at once, nothing rewritten · **Adopt palette** → review the
  mapping, accept · change the *Accent* slot and every follower moves.

## 12. Decisions and batch

### Decisions

The direction and first milestone are approved. Rows marked **final** were closed in revision 4
under delegated design authority. Tier 2 rows are approved as direction and are still decided, with
evidence, in the PR of the slice that carries them.

| # | Decision | Recommendation | Tier |
| --- | --- | --- | --- |
| D1 | Who stores a surface finish? | **Scene**, keyed by a Layout-published surface identity (§10). Layout stays appearance-free | 2 |
| D2 | Scene format | **One bump per slice that needs one**, numbered in landing order: Artwork, the look schema (sky, finish, palette, treatment), then surface finishes once T1's identity settles. Pre-beta a bump is strict-refuse and cheap; coupling slices to each other is not | 2 |
| D3 | Paint: T2 or T5? | T2 lands object / wall face / Space; T5 adds per-face on forms | owner |
| D4 | Reflections on Paper | Neutral studio reflection, no added light — **decided from S0 images**, not now | 2 |
| D5 | Light units | Keep physical stored units; Brightness stops are a UI mapping fixed by the S0 audit | 1 |
| D6 | Warmth | Store colour only; Warmth is a reading of it | 0 |
| D7 | Is the Sky a Card subject? | No. One popover writer; retire the unmounted environment panel | 1 |
| D8 | Curated assets | ~14 curated finishes and a few fixture models, CC0 only. Creator images go through P20 unchanged | 2 |
| D9 | Shadow budget | Set by S0 item 4; refuse in words beyond it | 1 |
| D10 | Seams slice first | Yes: P0 below, one behaviour-neutral PR | 0–1 |
| D11 | Treatment as authored presentation | Yes, in Scene 6, resolve-time only | with D2 |
| D12 | Groups, fixtures and rigs | **Final.** A group behaves as one unit (§5). *Light it* never groups a light with its subject; *Group with …* is one optional action; a multi-light recipe groups its own lights; several selected works get one shared light | 1 |
| D13 | Artwork | **Final on identity.** A first-class Scene entity kind in its own slice (A1). Drawn as a textured quad; never authored as a plane with a shared Finish | 2 |
| D14 | Image identity | One P20 image may back an Artwork and a Finish; the two never share identity. *Use as Finish* is explicit and later | 1 |
| D15 | Light placement | Free in space, camera-style, with *Look through* realised through Camera; surfaces are magnets only | 1 |
| D17 | Guide versus light | **Final.** Guides are line-only marks that never imitate illumination; the rendered result is the only light (§5) | 1 |
| D18 | No inert controls | **Final.** Nothing is shown before it works; future capabilities are seams in the model and wiring only | 1 |
| D19 | PBR maps | **Final.** S4 one colour image; S8a manual slot assignment; S8b automatic set import as a correctable proposal | 1 |
| D16 | Artwork response to light | Lit and matte, no sky reflection, fidelity proven by S0 item 7. An always-full-brightness option waits | with S0 |

### Capability slices

These are **capability slices**, not implementation plans. Per the workflow, a plan is written only
for multi-PR, Tier 2 or invention-risking work, as the first commit of that work's own draft PR.

| Slice | Delivers | Needs | Format | Plan first? |
| --- | --- | --- | --- | --- |
| **P0 Look seams** | A `look` authoring module; mount points for a Card stratum, a Stage mark layer and a Library shelf; the existing Sky and material-pick wiring moved out of the route. No behaviour change | — | — | No. One PR |
| **S0 Rendering gate** | The §8 report, then sky-lit rendering landed to the level it proved | — | — | **Yes** (invention risk) |
| **S3 Lights** | Emitters of all three kinds: free placement, frustum guides and handles, guide-only state on Paper, Index group, Card stratum, *Lit by*. *Look through* as a second PR | P0 · S0 item 1 | — | **Yes** (interaction grammar; *Look through* touches the Camera authority) |
| **A1 Artwork** | Import, the Artwork object, wall magnet and free placement, real-unit sizing, transparency, Visitor Preview, save and reopen, release pinning | P0 · S0 items 1 and 7 | **bump** | **Yes** (Tier 2: format, release) |
| **A2 Framing and hanging** | Four frame styles, Mat, frame colour; eye-line and neighbour guides; Replace image | A1 | — | No |
| **S7 Light it** | Picture spot and Wash aimed at the selection, frustum fitted to an artwork's frame, one light for a multi-selection, one undo | S3 (richer with A1) | — | No |
| **G1 Groups** | Group as one unit for every object kind: click group then member, rigid actions, group Card, *Group with …*; the Showcase rig | S3 | — | **Yes** (shell-wide selection behaviour) |
| **S1 Look schema** | Types, codec, validation for §4 and §6 fields | D2, D11 · S0 report | **bump** | **Yes** (Tier 2) |
| **S2 Sky dials** | Popover dials, sun mark, edited / Reset | P0 · S0 · S1 | — | No |
| **S4 Finish** | Card row, free colour, Sheen, Paint for objects; then From image, Scale, Direction | P0 · S0 · S1 | — | No; likely two PRs |
| **S6 Looks** | Atmosphere + Treatment for any World; palette, followers, Adopt palette | S2 · S4 | — | No |
| **S5a Wall-face finishes** | Paint with Face and Space scope on Walls | S4 · D1 | **bump** | **Yes** (Tier 2, shared with T1) |
| **S5b Floors and overheads** | The same for T1's floor and overhead surfaces | S5a · T1 identity | — | With T1 |
| **S8 Catalogue and depth** | **S8a** manual map slots · **S8b** automatic set import · curated sets and fixture models · see-through and Glow as S0 allows | S4 · D8 · G1 for fixtures | — | **Yes** (licence) |

```text
now      P0 seams ─┬─▶ S3 Lights ──┬─▶ S7 Light it ─▶ G1 Groups   (no format change)
         S0 gate ──┤               │
                   ├─▶ A1 Artwork ─┴─▶ A2 Framing and hanging   (own bump, own plan)
                   │
                   └─▶ S1 Look schema ─┬─▶ S2 Sky dials ─┐
                                       └─▶ S4 Finish ────┴─▶ S6 Looks ─▶ S8 Catalogue and depth
                                             └─▶ S5a Wall faces ─▶ S5b Floors / overheads (T1)
```

**Group behaviour is its own slice, after the milestone.** Because *Light it* no longer groups,
the first milestone needs no group machinery at all. G1 then changes selection for every object
kind at once, which is why it is planned on its own rather than hidden inside Lights.

**First milestone, and how to verify it.** P0, S3, A1, A2 and S7 together are one scene anyone can
judge without rendering knowledge: *import a painting, hang it at the eye line, frame it, light it,
open Visitor Preview, reload, and it is all still there.* I recommend that scene as the batch's
first acceptance check, ahead of any Finish or Sky work.

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

**Contracts each slice amends when it lands** (none is edited by this proposal):

| Slice | Contract |
| --- | --- |
| S0 | Shell / PLATE: the Paper "neutral illumination only" row, if D4 passes. Scene content: stored light units |
| S3, G1 | Spatial instrument grammar: light guides, the guide-versus-light rule, group selection. Scene content: clusters behave as one unit; lights aim by target |
| A1 | Scene content: the Artwork entity kind and validation. Assets: an image referenced by an entity; release pinning |
| S1, S5a | Scene content: material instance fields, palette, treatment, surface finishes. Layout: the published surface identity (T1's to write) |
| S2 | Shell / PLATE: the Sky popover as the one environment writer; the unmounted panel retired |
| S4, S8 | Scene content and Assets: Finish maps and their slots |
| all | World toolbar registry: Paint and Lights stop reading as planned for a later theme |

**Checks per slice** follow the test contract: codec and validation (S1), resolved-look parity and
visitor-chunk isolation (S0, every Stage mark), one undo per gesture and write-nothing on Ask
cancel (S2–S6). Browser QA is focused and manual.

## 13. Where I held my position, and where I moved

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
| *Revision 3:* Artwork in this batch | **Agreed, as its own slice and plan,** not folded into Finish or Light. It becomes the first milestone |
| Artwork as a textured plane (the existing route) | **Rejected.** It is the confusion with Finish textures the brief asks to avoid |
| Mounting | **Narrowed.** A placement snap now; a persistent bond only when all objects get one |
| Artwork Studio | **Seams only,** and Trim before drawing: crop and straighten serves far more artists than a brush |
| Mount-first light placement (my revision 2) | **Replaced** by free, camera-style placement with frustum handles and *Look through* |
| *Revision 4:* should *Light it* group automatically? | **No; I reversed my revision 3 default.** Optional, one tap. Recipe-specific only in that a multi-light recipe groups its own lights. Reasons in §5: selection cost, shadow budget, shared lights, Erase |
| Artwork drawn as a textured quad | **Accepted, and clarified.** My objection was only ever to authoring it as a plane with a shared Finish |
| Beam guide versus illumination | **Accepted and made a rule** (D17), including the guide-only state on Paper |
| Does S3 need a plan? | **Yes.** I was wrong to call it a plain PR: it sets interaction grammar and *Look through* touches the Camera authority. Groups split out as G1 with their own plan |
| Manual maps versus automatic import | **Clarified as S8a then S8b,** manual first because automatic must fall back to it |
| Reserved Studio controls | **Accepted and widened** to a standing rule (D18): no inert controls anywhere in the batch |

## 14. Unresolved questions

Artwork and groups (revision 3):

- **Derivatives.** Do very large images get a display derivative at import, or are originals
  delivered and clamped at load? This sets visit load time for a gallery of forty works.
- **Default size.** Long edge 0.8 m on import, or read the file's print size when it carries one?
- **Credit and labels.** Is an artwork's title and credit an object fact on the Card (recommended),
  with a visible wall label left to Experience or a later slice?
- **Group nesting.** May a lit artwork sit inside a larger group (a whole wall)? Recommended: one
  level only until a case needs more.
- **Always full brightness.** Do screens and signage need an unlit artwork before Glow exists?

Look, lights and rendering:

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
