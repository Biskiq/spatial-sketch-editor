# S8 F · Catalogue and harvest plan

**Status:** amended after the first owner review. Proposed for final owner approval. Nothing has
been downloaded, derived or shipped, and no dependency has been added.
**Scope:** E6a catalogue intake inside [F](./implementation-plan.md#f--inspect-materials-and-qualify-the-catalogue).
E7 inspection, thumbnails and the F exit stay as the implementation plan defines them.
**Machine-readable companion:** [`f-acquisition-manifest.json`](./f-acquisition-manifest.json)
(schema `s8-f-acquisition-manifest/2`). It was generated on 2026-11-21 from the Poly Haven,
ambientCG and Physically Based APIs. When this page and the manifest differ, the manifest wins for
URLs, sizes, checksums and screening numbers; this page wins for policy.

## 1. Decision requested

Replace E6a's fourteen-entry target with qualified coverage:

- **17 Core asset sets → 22 creator-facing entries.** Five entries are presets that reuse another
  set's pinned images. These counts describe what is proposed. The shipped count is whatever
  qualifies, and it is reported rather than targeted (D7).
- **Per-material resolution.** Each set ships one resolution, 512, 1K or 2K, chosen by a texel-density
  screen and a visual check in representative scenes (§8). The screen starts:
  - 7 sets at 512
  - 9 sets at 1K
  - 1 set at 2K, herringbone

  Only the resolution that qualifies is allowlisted. There is no universal default.
- **2K lossless sources, no 4K.** The Core source download is 0.87 GB, against 2.93 GB in the first
  draft. Sources are retained byte-for-byte outside git (D2).
- **The six legacy entries leave the shelf but stay resolvable** (§3, D8). Creator-facing defaults move to
  qualified replacements. No provenance is invented for the placeholders.
- **The image codec is `@napi-rs/image` (MIT).** It is recommended as a build-time devDependency for
  decode and encode only, and installed only after approval (§10, D3).
- **17 Expansion sets and 9 Deferred items** are unchanged in structure.

§12 lists eight owner decisions with recommendations. Its closing checklist names what still needs
owner approval before F starts.

## 2. Constraints this plan is built on

| Constraint | Value | Where |
| --- | --- | --- |
| Engine family | `pbr-metallic-roughness/v1`: opaque; colour, normal (`+Y`/`−Y`), and scalar roughness, metalness and occlusion maps chosen by component | [types](../../../../packages/project-model/src/materials/types.ts) |
| Factor semantics | Factors multiply the maps (three/glTF). Recipe colour is an sRGB hex. Tint can only darken or shift hue, never lighten | [material store](../../../../apps/editor/src/lib/render/resources/material-store.ts) |
| Image admission | ≤4096 px edge, ≤25 MiB, 8-bit only. Standard sRGB or no profile. EXIF orientation 1. Lossy data maps draw a `lossy-data` warning. Lossless WebP (`VP8L`) is admitted | [image encoding](../../../../apps/editor/src/lib/render/resources/image-encoding.ts) |
| Sampling | Mipmaps are generated on upload. Linear magnification, trilinear minification, **anisotropy 1** | [texture store](../../../../apps/editor/src/lib/render/resources/texture-store.ts) |
| Camera and display | Default vertical FOV 54° (range 10–120°). Canvas DPR is capped at [1, 1.5]. Eye height 1.65 m | [camera types](../../../../packages/camera-core/src/scene-types.ts) |
| GPU | 256 MiB Finish-view ceiling. One RGBA8 mip-chain view costs 1.33 MiB at 512, 5.33 at 1K, 21.33 at 2K and 85.33 at 4K | [B report](./pr-b-report.md) |
| Sharing | The texture source cache keys on scope, URI and colour policy, so entries that name the same URI share one GPU source | [texture store](../../../../apps/editor/src/lib/render/resources/texture-store.ts) |
| Catalogue | Append-only. A change to pixels or meaning needs a new ID | [catalogue](../../../../packages/project-model/src/materials/catalogue.ts) |
| Dependencies | New dependencies are owner-admitted (Tier 2). Outside T5, admission is permissive-only | [Assets · Dependency licensing](../../../reference/components/assets.md#dependency-licensing) |

## 3. Existing coverage and legacy placeholders

| ID | What it is | Product roles today |
| --- | --- | --- |
| `plaster-warm` | Placeholder: two 256² PNGs (colour, roughness) | **Default wall, shape, candidate and definition material**; surface fallback |
| `wood-walnut` | Placeholder: two 256² PNGs | Colour-overridden fallback-shape parts |
| `brass-aged` | Placeholder: one 256² PNG | **Room portal default**; fallback-shape parts |
| `marble-light` | Flat factors, no images | Fallback-shape parts |
| `velvet-dark` | Flat factors, no images | Fallback-shape parts |
| `paper-aged` | Flat factors, no images | Finish-image base (`#ffffff` override); model fallback in the render description and cold visitor runtime; fallback-shape parts |

The three textured placeholders were temporary demo images. They were added for a demo scene in
`542bc540` and have no recorded source. They are not professional catalogue entries, and **this plan
does not write licence records or invent an origin for them**.

The IDs are nonetheless load-bearing. They are named in:
- the typed `MaterialId` union and `MATERIAL_IDS`
- `SHIPPED_MATERIAL_IMAGES` and `shipped-static.ts`
- the S8 E0 baseline and look-parity goldens
- about 55 test and fixture files
- any saved project that chose one

The manifest's `legacy` block lists every product file per ID.

**Retirement in F (recommended, D8):**

1. **Leave the shelf.** All six leave the creator-facing shelf and the catalogue count. They become
   hidden legacy bases.
2. **Stay resolvable.** Each ID keeps its recipe, pins and bytes unchanged. Saved projects, the E0
   baseline, goldens and fixtures that name them keep validating and rendering identically.
3. **Move creator-facing defaults.** Each default moves to its qualified replacement:

   | Default | Replacement |
   | --- | --- |
   | Default wall, shape, candidate and definition material, `plaster-warm` | `plaster-painted` |
   | Room portal, `brass-aged` | `metal-brass-satin` |

   If a replacement fails qualification, that default stays on its legacy ID and the failure is
   recorded. Defaults for walls without an explicit Finish are generated rather than authored, so
   existing projects that rely on them will also render with the new default. Their goldens are
   updated in the same PR.
4. **Leave internal uses unchanged in F:**
   - colour-overridden fallback-shape parts
   - the Finish-image base
   - model fallbacks
5. **Record no provenance.** The catalogue marks each ID as a legacy placeholder with no catalogue
   provenance.

**After F:** one cleanup PR removes the six IDs, the five images and their pins, and re-points the
internal uses. It runs once no baseline needs them, as a strict Scene format change: readers refuse
the old IDs, fixtures are regenerated, and there is no migration. That is the pre-beta stance.

**Why not alias or delete now:**
- An alias would silently change the pixels behind a stored ID, which the append-only rule forbids,
  and it would break the E0 comparison.
- Deleting in F would add a format change and a fixture rewrite with no product benefit while S8
  baselines still need the IDs.

**Missing entirely today:**
- floors (planks, parquet, tile, carpet, concrete)
- masonry
- veined or aggregate stone
- clean and brushed metal
- woven textile and leather
- plastic

## 4. Taxonomy

The catalogue is grouped by what a creator looks for. Engine families are a separate axis (§5).

| Category | Subcategories | Core sets | Expansion sets |
| --- | --- | --- | --- |
| Wood | veneer · boards & parquet · engineered | oak veneer, walnut veneer, oak planks, herringbone | plywood, maple veneer |
| Stone | polished · natural · composite | white marble, terrazzo | travertine, black marble |
| Masonry | brick · block | red brick, painted brick | (paving under Exterior) |
| Plaster & Concrete | plaster · concrete | painted plaster, smooth concrete (+ polished) | fluted concrete |
| Tile & Ceramic | glazed tile · terracotta | white ceramic tile | subway tile, terracotta |
| Metal | polished/satin · brushed · weathered | satin set (steel, brass, copper, gold), brushed set (steel, aluminium) | corten |
| Textile | woven · pile/carpet | linen, loop carpet | wool herringbone |
| Leather | upholstery | smooth leather (cognac) | — |
| Synthetic & Paper | plastic · rubber · cork · paper | matte plastic | rubber, cork; paper still unsourced |
| Exterior Ground | paving · loose · organic | — | cobblestone, pavers, gravel, asphalt, sand, forest floor |

**Rules that keep redundancy low:**
- Colour variants are not separate assets. One neutral set plus the recipe colour covers them,
  and later the UX palette.
- Two entries need visibly different structure or a materially different optical response.

## 5. Catalogue categories versus engine families

Every Core and Expansion entry is `pbr-metallic-roughness/v1`. The surfaces below are recognisable
but render wrongly in v1, so they are Deferred to the family that owns the missing signal. They
are not approximated inside Core.

| Family (future) | Unlocks | Deferred items |
| --- | --- | --- |
| Cloth / sheen | velvet, satin, plush | velvet (Poly Haven `velour_velvet` is sourced) |
| Clearcoat | lacquer, car paint, glazed ceramic | lacquered wood, car paint |
| Anisotropy | true brushed highlights | anisotropic brushed metal (Core approximates brushing with normals) |
| Coverage (alpha) | perforated metal, wicker, foliage | — |
| Transmission | glass, water | — |
| Emission | signage, LED | — |
| Height / parallax | cobbles, rock walls, deep relief | Exterior Ground stays Expansion; v1 flattens relief to normals |
| Layered / mask | coloured tile with light grout; paint over brick; wear | coloured glazed tile |
| Procedural | wear, dirt, smudges | — |

## 6. Core shortlist

**Column key:**
- **Scale:**
  - A: provider-declared.
  - B: a measured repeating feature, cross-checked to ±10%.
  - C: nominal; admitted only as D1 allows.
- **Class:** the §8 design class. `*` marks a feature-defined surface.
- **Start:** the screened starting resolution. `c` means conditional, with the fallback in brackets.
- **Src MB:** the 2K lossless source download.

| Set | Entries | Source | Creator | Tile · scale | Class | Start | Src MB | Alternates |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `wood-oak-veneer` | Oak Veneer | [Poly Haven white_oak_veneer](https://polyhaven.com/a/white_oak_veneer) | Jenelle van Heerden | 0.5 m · A | object | 512 c (1K) | 59 | [oak_veneer_01](https://polyhaven.com/a/oak_veneer_01) (1.83 m, 2K) |
| `wood-walnut-veneer` | Walnut Veneer | [Poly Haven walnut_veneer_02](https://polyhaven.com/a/walnut_veneer_02) | Jenelle van Heerden | 1 m · A | object | 1K c (2K) | 57 | [Wood051](https://ambientcg.com/a/Wood051), [smoked_walnut_veneer](https://polyhaven.com/a/smoked_walnut_veneer) |
| `wood-oak-planks` | Oak Plank Floor | [Poly Haven wood_floor](https://polyhaven.com/a/wood_floor) | Dimitrios Savva | 1.7 m · A | surface* | 1K | 57 | [laminate_floor_02](https://polyhaven.com/a/laminate_floor_02) |
| `wood-herringbone-parquet` | Herringbone Parquet | [Poly Haven herringbone_parquet](https://polyhaven.com/a/herringbone_parquet) | Jenelle van Heerden, Sergej Majboroda | 3.4 m · A | surface* | **2K** | 57 | — |
| `stone-marble-white` | White Marble | [ambientCG Marble012](https://ambientcg.com/a/Marble012) | ambientCG | 1.2 m · **C** | surface | 512 c (1K) | 49 | [Travertine009](https://ambientcg.com/a/Travertine009) (A) |
| `stone-terrazzo` | Terrazzo | [ambientCG Terrazzo019L](https://ambientcg.com/a/Terrazzo019L) | ambientCG | 0.8 m · A | surface | 512 | 54 | [Terrazzo005](https://ambientcg.com/a/Terrazzo005) (C) |
| `masonry-brick-red` | Red Brick | [Poly Haven red_brick_03](https://polyhaven.com/a/red_brick_03) | Rob Tuytel | 1 m · A | surface* | 1K | 23 | [Bricks059](https://ambientcg.com/a/Bricks059) |
| `masonry-brick-painted` | Painted Brick | [ambientCG PaintedBricks004](https://ambientcg.com/a/PaintedBricks004) | ambientCG | 1.55 m · A | surface* | 1K | 55 | — |
| `plaster-painted` | Painted Plaster | [Poly Haven painted_plaster_wall](https://polyhaven.com/a/painted_plaster_wall) | Amal Kumar | 2 m · A | surface | 1K c (2K) | 60 | [plastered_wall](https://polyhaven.com/a/plastered_wall) |
| `concrete-smooth` | Smooth Concrete, Polished Concrete | [ambientCG Concrete046](https://ambientcg.com/a/Concrete046) | ambientCG | 2.4 m · A | surface | 1K c (2K) | 60 | [concrete_wall_008](https://polyhaven.com/a/concrete_wall_008), [Concrete034](https://ambientcg.com/a/Concrete034) |
| `tile-ceramic-white` | White Ceramic Tile | [ambientCG Tiles107](https://ambientcg.com/a/Tiles107) | ambientCG | 1 m · A | surface* | 1K | 27 | — |
| `metal-satin` | Satin Stainless Steel, Satin Brass, Satin Copper, Satin Gold | [ambientCG Metal032](https://ambientcg.com/a/Metal032) | ambientCG | 0.5 m · **C** | object | 512 c (1K) | 51 | — |
| `metal-brushed` | Brushed Stainless Steel, Brushed Aluminium | [ambientCG Metal009](https://ambientcg.com/a/Metal009) | ambientCG | 0.5 m · **C** | object* | 1K | 50 | [Metal011](https://ambientcg.com/a/Metal011) |
| `textile-linen` | Natural Linen | [Poly Haven rough_linen](https://polyhaven.com/a/rough_linen) | colormass, Rico Cilliers | 0.271 m · A | object* | 512 | 71 | — |
| `textile-carpet-loop` | Loop Pile Carpet | [ambientCG Carpet016](https://ambientcg.com/a/Carpet016) | ambientCG | 1.7 m · A | surface | 1K | 66 | — |
| `leather-smooth` | Cognac Leather | [Poly Haven leather_white](https://polyhaven.com/a/leather_white) | Rob Tuytel | 0.3 m · A | object | 512 | 24 | [Leather035D](https://ambientcg.com/a/Leather035D) |
| `synthetic-plastic-matte` | Matte Plastic | [ambientCG Plastic010](https://ambientcg.com/a/Plastic010) | ambientCG | 0.5 m · **C** | object | 512 c (1K) | 47 | [Plastic013A](https://ambientcg.com/a/Plastic013A) |

### Selection notes

- **Wood**
  - Oak (light) and walnut (dark) are the two timber anchors. Planks and herringbone are the two
    floor layouts people ask for.
  - **Oak veneer changed source.** `white_oak_veneer` repeats every 0.5 m and starts at 512.
    `oak_veneer_01`'s 1.83 m figure needs 2K, at 64 MiB against 4 MiB. The repeat check (§8.5)
    decides. If the 0.5 m repeat is conspicuous at the overview, the alternate ships at 2K and its
    budget cost is reported.
  - Herringbone's 3.4 m repeat hides the pattern but gives 301 px/m at 1K. It is the one 2K start.
- **Stone**
  - Poly Haven has no clean polished marble. `Marble012` is the cleanest white with grey veining
    found, but it declares no size (D1).
  - `Terrazzo019L` is chosen over the more classic white-and-black `Terrazzo005` because it is the
    only terrazzo with a declared scale.
- **Approximated maps**
  - ambientCG marks `Concrete046` and `Terrazzo019L` as `PBRApproximated`. Their normal and
    roughness maps are inferred from a colour photograph ([creation methods](https://docs.ambientcg.com/creation-methods/)).
  - They are plausible rather than measured, and qualification judges them visually. Poly Haven's
    scanned `concrete_wall_008` is the concrete alternate. Its 2.71 m repeat needs 2K.
- **Metals**
  - Only structure is used: normal plus ORM.
  - Colour is measured F0 from [Physically Based](https://physicallybased.info/), CC0 1.0. Its v2
    API states `srgb-linear`; values are clamped to 1 and sRGB-encoded:

    | Metal | sRGB colour |
    | --- | --- |
    | stainless | `#d6d1cb` |
    | brass | `#f5e4ae` |
    | copper | `#f7cfbf` |
    | gold | `#ffe496` |
    | aluminium | `#f5f6f6` |

  - Poly Haven has no clean metal, so all metal structure sets come from ambientCG.
- **Textiles and leather**
  - Linen is chosen for scale (0.27 m declared) and weave clarity. Its blue source needs a
    luminance-neutral derivative (D4).
  - `rough_linen` also ships anisotropy and sheen maps. v1 ignores them, which is the reason velvet
    is Deferred.
- **Tile**
  - `Tiles107` tints its grout together with the tile. Coloured tile with light grout needs a mask
    or layer, so it is Deferred.

## 7. Recolouring strategy

**Tint classes:**

| Class | Sets | Rule |
| --- | --- | --- |
| **T0 as shot** | oak, planks, herringbone, terrazzo, red brick, carpet | Recipe colour `#ffffff`. The material's identity is its natural colour |
| **T0-darken** | walnut | Measured factor that darkens a species-true but mid-brown source to a classic walnut |
| **T1 neutral base** | marble, painted brick, plaster, concrete, tile, leather, plastic | Light, near-neutral source. The recipe colour sets the hue |
| **T1-neutralize** | linen | Same, after a recorded luminance-neutral derivative (D4) |
| **metal** | satin and brushed sets | No colour map. Colour factor is measured F0 |

**Measured, not guessed.** The manifest gives each tinted entry a `targetMeanAlbedo` instead of a
hex value. The F agent computes:

```
color = linear(target) / linearMean(colour source), per channel, then sRGB hex
```

Box filtering preserves the mean, so any ladder level gives the same value within rounding. Any
channel above 1 means the source is too dark to reach the target, and the agent switches to the
alternate source. Marble, brick, concrete and tile are checked against Physically Based reference
albedos and flagged `plausibilityCheck`.

**Presets.** Each preset is its own catalogue entry with its own recipe. It references the same
pinned URIs as its set, so it adds zero bytes and zero GPU views.

| Set | Presets |
| --- | --- |
| Satin metal | stainless, brass, copper, gold |
| Brushed metal | stainless, aluminium |
| Concrete | polished concrete (roughness factor 0.45) |

**Factor ranges.** A roughness or colour factor can only lower the value that the map supplies. A
set whose roughness map is too glossy cannot be roughened by its recipe. If that happens, the remap
belongs in a recorded derivative step, not the recipe.

## 8. Resolution and texel density

### 8.1 What the research implies

The [Beyond Extent texel-density deep dive](https://www.beyondextent.com/deep-dives/deepdive-texeldensity)
(Timothy Dries, updated 2026-04-03) treats texel density as a consistency tool rather than a fixed
number:
- Derive the density from how close the camera gets and how large the surface then appears on
  screen.
- First-person contexts need the most density; distant, top-down ones need the least.
- Assets a viewer inspects closely may deviate upward.
- Tiling materials reach their density through tile count.
- Mipmapping handles distance, so the closest approach is the design question.

Biskiq is a first-person browser walkthrough with close object inspection, on ordinary laptops at
1080p–1440p. The plan therefore derives each set's resolution from our camera, displays and viewing
distances. It does not adopt a universal px/m figure.

### 8.2 Viewing model

On screen, one metre of a surface facing the camera at distance `d` covers
`H / (2 · d · tan(vfov / 2))` device pixels. Here `H` is the canvas drawing-buffer height and
`vfov` is the default 54°. A tiling set's texel density is its resolution divided by its larger
tile edge. **Magnification** is screen px/m divided by texel px/m. Above 1, the texture is
stretched over more screen pixels than it has texels.

| View | Distance | 1080p class (H ≈ 1000) | 1440p class (H ≈ 1300) |
| --- | --- | --- | --- |
| Overview of a room | 4 m | 245 px/m | 319 px/m |
| **Surface approach** (wall, floor near the feet) | 1.5 m | 654 px/m | **850 px/m** |
| **Object close-up** (furniture, fittings, upholstery) | 0.8 m | 1227 px/m | **1595 px/m** |

- The 1440p class also covers a laptop scaled at the 1.5 DPR cap.
- A 1440p pass implies a 1080p pass, since 1080p magnification is 0.77 times the 1440p value.
- E7 inspection fits the 1 m sample to 80% of the panel's shorter side, about 0.8 × panel height
  px/m. Even a full-canvas panel (≈1040 px/m) stays below the object design case, so the object
  class covers inspection.

### 8.3 Screening rule

Each set has a design class:
- **Surface:** architecture and floors, judged at the 1.5 m approach.
- **Object:** furniture, fittings and upholstery, judged at the 0.8 m close-up.

A set is **feature-defined** when it reads through sharp periodic features: grout, mortar, board
joints, weave or brushing. Screen at the 1440p class:

| Magnification | Result |
| --- | --- |
| ≤ 1.5 | **Pass** |
| 1.5–2 | **Conditional.** A low-frequency, stochastic surface may pass on the visual check, with the next step up as its fallback. A feature-defined surface escalates |
| > 2 | **Escalate** one step |

The starting resolution is the lowest step on the 512 → 1K → 2K ladder that passes or is
conditional. If 2K still fails, the remedy is another source or a declared scale, not 4K.

The screen only chooses where qualification starts. The visual check (§8.5) decides.

### 8.4 Screening results (Core, 1440p class)

| Set | Class | Tile | ×@512 | ×@1K | ×@2K | Start | Fallback | GPU at start |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| oak veneer | object | 0.5 | 1.56 | 0.78 | 0.39 | 512 c | 1K | 4 MiB |
| walnut veneer | object | 1.0 | 3.11 | 1.56 | 0.78 | 1K c | 2K | 16 |
| oak planks | surface* | 1.7 | 2.82 | 1.41 | 0.71 | 1K | — | 16 |
| herringbone | surface* | 3.4 | 5.65 | 2.82 | 1.41 | **2K** | — | 64 |
| white marble | surface | 1.2 C | 1.99 | 1.00 | 0.50 | 512 c | 1K | 4 |
| terrazzo | surface | 0.8 | 1.33 | 0.66 | 0.33 | 512 | — | 4 |
| red brick | surface* | 1.0 | 1.66 | 0.83 | 0.42 | 1K | — | 16 |
| painted brick | surface* | 1.55 | 2.57 | 1.29 | 0.64 | 1K | — | 16 |
| painted plaster | surface | 2.0 | 3.32 | 1.66 | 0.83 | 1K c | 2K | 16 |
| smooth concrete | surface | 2.4 | 3.99 | 1.99 | 1.00 | 1K c | 2K | 16 |
| white tile | surface* | 1.0 | 1.66 | 0.83 | 0.42 | 1K | — | 16 |
| satin metal | object | 0.5 C | 1.56 | 0.78 | 0.39 | 512 c | 1K | 2.7 |
| brushed metal | object* | 0.5 C | 1.56 | 0.78 | 0.39 | 1K | — | 10.7 |
| linen | object* | 0.271 | 0.84 | 0.42 | 0.21 | 512 | — | 4 |
| loop carpet | surface | 1.7 | 2.82 | 1.41 | 0.71 | 1K | — | 16 |
| leather | object | 0.3 | 0.93 | 0.47 | 0.23 | 512 | — | 4 |
| matte plastic | object | 0.5 C | 1.56 | 0.78 | 0.39 | 512 c | 1K | 4 |

**Totals:**

| Case | All 17 Core sets resident |
| --- | --- |
| Start | 229 MiB |
| Every conditional escalates | 417 MiB |
| Uniform 1K, for comparison | 261 MiB |
| Uniform 2K, for comparison | 1,045 MiB |

The per-set approach spends resolution where the repeat is large (herringbone, and plaster or
concrete if they escalate). It saves it where the repeat is small (textiles, leather, metals,
terrazzo).

### 8.5 Visual qualification (the gate)

Qualification renders each candidate in fixed, reproducible scenes:
- 1920×1080 at DPR 1
- 2560×1440 at DPR 1, or a 1440p-class laptop at DPR 1.5

| Scene | Contents | Views |
| --- | --- | --- |
| Living room | Herringbone floor, painted plaster, painted-brick feature wall, walnut cabinet, linen sofa, leather chair, satin brass, marble table top | Overview 4 m; wall and floor approach 1.5 m; object close-up 0.8 m |
| Kitchen | White tile, terrazzo floor, oak veneer cabinets, brushed steel, matte plastic, plaster, concrete worktop | Same |
| Gallery or office | Oak planks, concrete and plaster walls, red brick, loop carpet, oak desk, leather chair, brushed fittings | Same |
| E7 inspection | Sphere, block and plane under studio and grazing light | The recorded rig |

A set ships at the lowest resolution that meets all of these:

| Check | Pass condition |
| --- | --- |
| Feature fidelity | At the design distance, the defining features hold without visible blockiness or smear: grain and pores, grout and mortar edges, weave, brushing, aggregate |
| Next step down | The next lower resolution is shown beside it and judged worse, with the reason recorded. If it is not worse, it ships instead. 512 is the floor |
| Repeat | At the overview, no conspicuous repeating feature across a 4 m wall or floor, or across a 2 m furniture panel for object sets |
| Budget | Each representative scene's catalogue working set at the qualified resolutions stays at or below **128 MiB**. That is half the Finish-view ceiling, leaving the rest for model, Artwork and project images |

Against the budget check, the screened starts give:

| Scene | At start | If every conditional escalates |
| --- | --- | --- |
| Living room | 127 MiB | 243 MiB |
| Kitchen | 71 MiB | 191 MiB |
| Gallery or office | 99 MiB | 207 MiB |

When qualification pushes a scene over 128 MiB, the agent tries cheaper qualified options first: a
smaller-repeat alternate, or the lower conditional level. It then reports any remaining excess to
the owner.

**Not a resolution problem.** With anisotropy 1, floors and walls seen at grazing angles blur
because of isotropic mip selection, and a larger texture does not fix that. Qualification judges
floors at the approach view, not at the horizon. Anisotropic filtering is separate render-quality
work (§8.6).

### 8.6 Not in F

The following are future work. Each needs its own consumer and evidence:
- adaptive resolution streaming or progressive refinement
- automatic quality selection by device
- a user texture-quality preference
- anisotropic filtering
- GPU-compressed (KTX2/Basis) derivatives

F ships one qualified resolution per set. Adding another resolution of a set later is an allowlist
append under a new URI, never a change to an existing pin.

## 9. Sources, derivatives and delivery

**Source rule.** Download the highest resolution F can use: 2K, the top of the production ladder,
in a lossless format, once and byte-for-byte. A 2K lossless source:
- qualifies all three ladder levels without a second harvest
- gives every 512 and 1K derivative a clean 2× or 4× box downsample
- keeps lossy re-compression out of derivatives

**4K is not acquired.** It is admissible for one set only with a recorded reason the owner can see,
for example a visible defect in the provider's 2K file.

| Provider | Files downloaded |
| --- | --- |
| Poly Haven | `Diffuse`, `nor_gl` and `arm` as 2K PNG. The provider's PNGs are 16-bit; precision is kept until the final 8-bit quantization |
| ambientCG | The `2K-PNG` ZIP, which contains all maps including both normal conventions |

**Volume:**

| Scope | Total |
| --- | --- |
| Core source | 0.87 GB |
| Expansion source | 0.93 GB, harvested only when Expansion is admitted |

For the herringbone set, which starts at 2K, derivation is a repack (ORM packing, quantization and
encoding) with no resample.

**Derivatives.** Each set is packed to at most three images:

| Image | Format | Notes |
| --- | --- | --- |
| `color` | Lossy WebP q90, sRGB, no metadata | Metal sets have none |
| `normal` | Lossless WebP (`VP8L`), `+Y` | PNG if D3 falls back to the pure-JS codec |
| `orm` | Lossless WebP (`VP8L`) | R = AO (or 255 with occlusion unbound), G = roughness, B = metal (0 for dielectric, 255 for metal). PNG under the same fallback |

Data maps stay lossless, so a curated entry never carries the `lossy-data` warning. Lossless WebP is
typically smaller than PNG for the same pixels, which matters for browser-first delivery.

**What is produced, committed and allowlisted:**

| Item | Treatment |
| --- | --- |
| Ladder (512, 1K, 2K) | Produced from the 2K source for qualification. Each level is hashed in the derivation record |
| Qualified level | The only level committed and allowlisted |
| Other levels | Not committed. Reproducible from the retained source |

**Browser delivery cost:**
- The shelf reads published 192² thumbnail derivatives, so a warm list fetches no full-resolution
  image.
- A set's images are fetched only when a Finish binds them.
- The fetch size per set follows its qualified resolution. It is measured and recorded at harvest:
  roughly 0.5–1 MB at 512, 2–4 MB at 1K and 8–15 MB at 2K.
- Core and Expansion differ in repository size and qualification effort, not in first-load
  bandwidth.

**Delivery classes:**

| Class | Delivery | Compatibility |
| --- | --- | --- |
| Core (public catalogue) | `apps/editor/static/textures/<set-id>/…` at the qualified resolution, pinned in `SHIPPED_MATERIAL_IMAGES`, immutable URIs | Library items reference these as frozen shipped URIs (E6b), so no copy is needed |
| Expansion (on demand) | Same mechanism in a later append-only PR, optionally from a CDN origin under the same pin contract | No runtime change. Its absence is a missing catalogue ID, never a broken pin |
| Private creator assets | P20 / E6b paths, unchanged | Curated and private images share the hash-keyed resource system |

## 10. Image-processing dependency

**Distribution.** Derivation is an offline, build-time step. Its outputs are images, and no codec
reaches users' browsers, so none of the candidates below is distributed with Biskiq. The
[dependency admission policy](../../../reference/components/assets.md#dependency-licensing) still
applies:
- A new direct dependency is a Tier 2 owner decision.
- Outside T5 capability plans, admission is permissive-only.

| Option | Licence | Codecs | 16-bit PNG in | Already in tree | Admission |
| --- | --- | --- | --- | --- | --- |
| **`@napi-rs/image` 1.16.0** | MIT | Rust crates: `image`, `png`/`lodepng`, `oxipng`, `mozjpeg-sys`, `libwebp-sys`, `libavif`, `resvg`, and others. No copyleft is apparent; each crate's licence is confirmed at admission | Yes (`rawPixels` keeps native depth) | No | Permissive; fits current policy |
| `sharp` 0.34.5 | Apache-2.0, but its prebuilt `@img/sharp-libvips-*` 1.2.4 is **LGPL-3.0-or-later** | libvips 8.17.3 bundles glib, pango, librsvg, libheif and libexif (LGPL), plus cairo (MPL-2.0) and permissive codecs | Yes | Yes, transitively through `@gltf-transform/cli` (dev) | Offline use triggers no LGPL distribution duty. Admitting it directly still needs an owner ruling that extends the weak-copyleft review beyond T5 |
| `fast-png` 8 + `jpeg-js` 0.4 | MIT, BSD-3 | Pure JS; PNG 8/16-bit, baseline JPEG; **no WebP** | Yes | No | Permissive. Colour would ship as JPEG and data maps as PNG |

**Recommendation:** `@napi-rs/image`, exact-pinned as a devDependency of the derivation script, used
only to decode and encode. It is the simplest sound option:
- **Licence:** permissive throughout, under the existing policy.
- **Platforms:** prebuilt binaries for macOS, Linux (glibc and musl) and Windows.
- **Formats:** reads 16-bit PNG; writes lossy and lossless WebP and PNG.
- **Maintainer:** the napi-rs author.

**Our own pure code owns all pixel maths, so the codec stays swappable:**
- sRGB ↔ linear
- the 2× box filter
- normal decode, averaging and renormalization
- the Lanczos-3 resample for non-power-of-two sources
- luminance neutralization
- ORM packing

**Reproducibility:**
- Pin the exact codec version in the lockfile and record it in every derivation record.
- A rerun on the same platform must produce identical bytes.
- Another platform must decode to the same pixels within 1/255.
- The committed bytes are the pin.

## 11. Sources and licence evidence

| Provider | Licence evidence (verified 2026-11-21) | Integrity | Notes |
| --- | --- | --- | --- |
| Poly Haven | [polyhaven.com/license](https://polyhaven.com/license): "Our assets are all licensed as CC0" | Files API gives md5 and size per file | API needs a unique User-Agent. `dimensions` are in mm. `arm` follows glTF ORM order. Files can be re-released, which changes their md5 |
| ambientCG | [docs.ambientcg.com/license](https://docs.ambientcg.com/license/): "provided under the Creative Commons CC0 1.0 Universal License" | No checksum; ZIP size only | `dimensionX/Y` are in cm and approximate; 0 means undeclared. No per-asset author is exposed; the operator is Lennart Demes ([legal](https://docs.ambientcg.com/legal/)). Run by one person, so expect occasional unavailability |
| Physically Based | [api.physicallybased.info/v2/materials](https://api.physicallybased.info/v2/materials), `header.license = "CC0 1.0 Universal"` | — | Colour values only |

ShareTextures and cgbookcase were considered and **excluded**: their licence pages could not be
verified (HTTP 404 at research time).

Each manifest set records:
- page, API and download URLs
- creators
- maps available
- normal convention
- declared dimensions and unit
- available resolutions with byte sizes
- the chosen 2K source files with md5 (Poly Haven) or ZIP size (ambientCG)
- the density screen (`resolution`) for the set and its cached alternates

The fields map onto
[`RightsEvidence`](../../../../apps/editor/assets-source/pipeline/provenance.ts) and the E6a
record fields.

## 12. Owner decisions

| # | Decision | Recommendation and rationale | If declined |
| --- | --- | --- | --- |
| D1 | **Nominal versus verified tile** | **Verified tile (A or B) for every set whose scale a viewer can judge:** wood, stone, masonry, tile, textile, leather, carpet. **Nominal tile (C)** only for micro-surfaces with no recognisable size (`Metal032`, `Metal009`, `Plastic010`), labelled nominal in the record and the inspector; the screen uses the nominal tile. `Marble012`'s veining is perceptible, so C is admitted only if it reads as plausible slab-scale veining beside a known-size reference at the overview. A wrong tile breaks both perceived scale and density; a micro-surface's does not | Marble falls back to `Travertine009` (A). The metal and plastic sets ship as untextured factor entries, or are excluded |
| D2 | **Source retention without mandatory 4K** | **Retain exactly what was downloaded:** 2K lossless, 0.87 GB Core, byte-for-byte with sha256, in an owner-controlled private object store under immutable keys `materials/<provider>/<assetId>/<file>`. Never in git, and not as a release on this public repository. Provider re-releases change files under the same URL, so URL plus md5 alone cannot reproduce a derivative | Record provider URL, md5 or size and the download date only. A re-release then leaves the committed derivative as the sole authority |
| D3 | **Image-processing dependency** | **`@napi-rs/image` 1.16.0, exact-pinned devDependency, codec only** (§10). Permissive under the current policy; derivation maths stays in our code | `sharp`, with an owner ruling extending weak-copyleft review to build-time tooling; or `fast-png` + `jpeg-js` (colour ships as JPEG) |
| D4 | **Neutralizing linen** | **Allow one recorded, luminance-preserving derivative step:** linear-light Rec. 709 luminance to grey, for `rough_linen` only, with a transform ID and parameters in the derivation record. The weave is the asset's value; its dye blocks tinting, because factors only darken or shift hue | Find an undyed linen source (none verified), or ship linen as-shot light blue |
| D5 | **Shared-image presets** | **Allow presets as separate entries** over one set's pinned images: four satin and two brushed metals, plus polished concrete. Each must pass distinctness on its own. Zero bytes, zero extra views | One entry per set (17), with colour left to the future palette |
| D6 | **Per-material resolution qualification** | **Adopt §8:** density screen, then visual qualification in representative scenes, then the lowest passing level of 512, 1K or 2K. Only that level is allowlisted. 2K is selective; no 4K production in F. Scene budget target ≤128 MiB. Density follows tile and viewing distance, so small-repeat object sets pass at 512 and large repeats need 2K | Uniform 1K: 261 MiB all-resident. Herringbone is then under-resolved at 2.8× magnification, and small-tile sets are over-resolved |
| D7 | **Coverage-based acceptance** | **Replace the fourteen-entry target with §13.** Every Core taxonomy slot ships at least one qualified entry, or records why its first choice and alternates failed. The count is reported, not targeted, and the legacy six are not counted | Keep a numeric target of fourteen new entries, taken in table order |
| D8 | **Legacy placeholders** | **Retire in F as hidden compatibility bases, as in §3.** IDs stay resolvable with unchanged bytes; creator-facing defaults move to `plaster-painted` and `metal-brass-satin`; nothing is invented. A later strict-format cleanup removes them. This protects saved projects, the E0 baseline, goldens and fixtures | (a) Delete in F: strict bump, regenerated fixtures, loss of E0 continuity. (b) Keep them visible on the shelf |

### Approval checklist before F starts

| Item | Kind | Owner action |
| --- | --- | --- |
| D3 | New dependency (Tier 2) | Approve `@napi-rs/image` or choose a fallback. Nothing is installed until then |
| D2 | Owner infrastructure | Name the private retention store |
| D8 | Visible default change on the visitor surface (Tier 1); amends the approved S8 design | Approve the retirement and the default re-pointing |
| D1, D4–D7 | Amend the approved S8 design | Approve, or rule otherwise. The contract wording in §13 and the implementation plan already reflects the recommendations |

The screening constants, scene list and agent instructions follow from these decisions and need no
separate approval:
- the 1440p design display
- the 1.5 m and 0.8 m design distances
- the 1.5 and 2 magnification thresholds
- the 128 MiB scene target

The owner retains final visual acceptance of the qualified catalogue.

## 13. E6a wording (amended in the implementation plan)

> **E6a catalogue intake.** Qualify the Core list in
> [`f-acquisition-manifest.json`](./f-acquisition-manifest.json). Size follows coverage, not a quota:
> every Core taxonomy slot ships at least one qualified creator-facing entry, or records why its
> first choice and alternates failed, and the shipped count is reported. The technical neutral base
> and the legacy placeholders are not counted. A preset that reuses a set's pinned images is an
> entry only if it passes the distinctness test on its own. Each set ships one resolution, 512, 1K
> or 2K: the lowest that passes the density screen and the visual comparison in the representative
> scenes ([plan §8](./f-catalogue-acquisition-plan.md#8-resolution-and-texel-density)). Only that
> resolution is allowlisted, and no universal size applies. Sources are the highest resolution the
> ladder uses (2K lossless), retained outside git; 4K is not required. Store each new immutable ID
> and its record alongside the existing catalogue: label, source URL, creator, CC0 evidence,
> acquisition date, image purpose, measured dimensions, MIME, SHA/size, packing, normal convention,
> claimed physical tile, scale class, qualified resolution with its screening and visual evidence,
> and exact v1 recipe. Catalogue static paths are allowlisted and append-only. Changing pixels or
> meaning needs a new ID and registry revision. Use F's fixed thumbnail and manifest digest to
> publish a small derivative. A missing licence, broken URL provenance, mismatched pin, failed
> fidelity or resolution qualification, or unverifiable scale (class C outside the admitted
> micro-surface sets) excludes that entry. Ship the cleared subset and record the count. Creator
> files follow P20. The six legacy IDs (`plaster-warm`, `wood-walnut`, `brass-aged`,
> `marble-light`, `velvet-dark`, `paper-aged`) leave the creator-facing shelf. They stay resolvable
> with unchanged values and bytes for existing documents and baselines, and gain no invented
> provenance. Creator-facing defaults move to qualified replacements. Removing the IDs is a later
> strict format change.

## 14. Proposed Assets reference text

[Assets](../../../reference/components/assets.md) describes current behavior, so this text is
promoted by the F implementation PR when its gates land, not before. It belongs after
*Finish images (T2.S4b)*.

> ### Curated material textures (T2.S8 F)
>
> **Current.** Each curated material set ships one qualified resolution (512, 1K or 2K), chosen per
> material by texel density at the design viewing distance and by visual qualification. There is no
> universal size. Its images live at `/textures/<set-id>/{color.webp,normal.webp,orm.webp}`, pinned
> by sha256, MIME and byte length in the shipped manifest, and are append-only. The editor and the
> visitor runtime fetch a set's images only when a Finish binds them; catalogue lists read 192²
> thumbnail derivatives. Upload builds a full mip chain and samples with linear magnification,
> trilinear minification and anisotropy 1. GPU residency is accounted per view against the
> Finish-view ceiling and refuses with `texture-budget` instead of thrashing. Source files are
> retained byte-for-byte outside git. Derivation and licence records live under
> `apps/editor/assets-source/`. The six legacy placeholder IDs resolve for existing documents but
> are not offered for new use.
>
> **Not current (destination).** Adaptive resolution streaming or progressive refinement, automatic
> quality selection by device, a user texture-quality preference, anisotropic filtering,
> GPU-compressed (KTX2/Basis) derivatives and CDN-origin Expansion delivery. Each needs its own
> consumer and evidence. Adding another resolution of a set is an allowlist append under a new URI,
> never a change to an existing pin.

Under *Dependency licensing*, the F PR records the admitted codec if D3 is approved: name, exact
version, licence, build-time-only use, and that it never reaches a browser bundle.

## 15. Instructions for the F implementation agent

### Harvest

1. **Re-verify on harvest day.**
   - Re-read Poly Haven `/info` and `/files`, and ambientCG
     `api/v3/assets?id=…&include=maps,downloads,dimensions`, for each Core set and each alternate
     you may need.
   - If an md5 or size differs from the manifest, record the new value and repeat the visual check.
     The manifest is a 2026-11-21 snapshot.
2. **Download each file once.**
   - Use a project-specific User-Agent with no personal contact details. Use only API and download
     URLs; never scrape site pages.
   - Poly Haven: the three 2K PNGs named in `source.files`. ambientCG: the `2K-PNG` ZIP.
   - Keep each download in its own empty directory. Treat archives as untrusted: list a ZIP before
     extracting it and refuse absolute or `..` paths.
3. **Verify and hash.**
   - Check the Poly Haven md5.
   - Compute sha256 for every downloaded file, every ambientCG ZIP and every extracted member.
   - Confirm each ZIP holds `*_NormalGL.png`. This is still unverified, because the ambientCG API
     does not list ZIP members.
4. **Snapshot licence evidence.**
   - Save the Poly Haven and ambientCG licence pages on harvest day.
   - Record their sha256 as `evidenceSnapshotHash`, and the date as `acquiredAt`.
5. **Retain.** Upload the originals to the D2 store and record their keys. No source enters git.

### Derive

Use one deterministic script under
[`apps/editor/assets-source/`](../../../../apps/editor/assets-source/), next to the existing
`pipeline/`. `textures/` is already reserved there. The D3 codec only decodes and encodes; every
step below is our own code.

1. **Decode** to float.
   - Colour: sRGB → linear.
   - Normal: [0,1] → [−1,1].
   - Data: raw.
   - 16-bit sources keep their precision until the final quantization.
2. **Bring the source to 2048²** where it is not already.
   - Use one recorded separable Lanczos-3 resample. `rough_linen`, for example, comes from an
     8233×8251 master and may arrive slightly off-square.
   - The declared tile stays the same.
3. **Neutralize (D4 only).**
   - Compute Rec. 709 luminance in linear light and output (Y, Y, Y).
   - Record the transform ID and parameters.
4. **Build the ladder** 2048 → 1024 → 512 with an exact 2× box filter per step, the same filter as
   GPU mip generation.
   - Normals: average the vectors, then renormalize.
   - Colour: average in linear light.
   - Data: average raw values.
5. **Pack ORM** as in §9. Drop the provider colour map for metal sets.
6. **Encode every ladder level.**
   - Colour: WebP lossy q90, method 6, no ICC, EXIF or XMP.
   - Normal and ORM: lossless WebP. Use PNG with no colour chunks under the D3 fallback.
   - Every output must pass `image-encoding` admission.
7. **Check reproducibility.**
   - Using the pinned codec, a rerun must produce identical bytes.
   - On another machine, the decoded pixels must match within 1/255.
8. **Write a derivation record** per set:
   - source sha256s and retention keys
   - tool and codec versions
   - parameters
   - every ladder level's sha256 and size
   - the qualified level

### Pin and record

- **Images.** Commit only the qualified level to
  `apps/editor/static/textures/<set-id>/{color.webp,normal.webp,orm.webp}` and pin it in
  `SHIPPED_MATERIAL_IMAGES`.
- **Catalogue.** Add the entries to the catalogue, `MaterialId`, `MATERIAL_IDS` and the editor
  facade.
- **Licence records.** Write one per set at `apps/editor/assets-source/licenses/material-<set-id>.md`.
  Follow the `sofa-03.md` layout, filled with the `RightsEvidence` fields, the scale class, the tint
  class and the qualified resolution.
- **Colours.** Compute each tinted entry's recipe colour from its `targetMeanAlbedo` using the §7
  rule, and record the measured mean beside it.

### Retire the legacy six (D8)

1. Mark the six IDs as legacy: resolvable, excluded from the shelf and from counts. Leave their
   recipes, pins and bytes untouched.
2. Re-point the creator-facing defaults in the manifest's `legacy[].creatorDefaults` to the
   qualified replacements.
3. Leave `internalUses` alone.
4. Update the tests that assert the old defaults. Regenerate only the goldens whose default
   surfaces changed, and record which.
5. Write no licence record for the placeholders.

### Qualify

Write per-entry results to `evidence/s8-f-catalogue.json`. Run B's frozen studio chart first.

| Check | Pass condition |
| --- | --- |
| Clipping | Under 1% of the subject's pixels clipped in the 192² studio thumbnail |
| Distinctness | No pair of entries has thumbnail patch-mean ΔE00 < 3 **and** luminance SSIM > 0.95. Either condition alone is fine. A failing preset is dropped; a failing set goes to its alternate |
| Normal convention | Under grazing light, flipping Y reverses the +Y/−Y chart response for every set |
| Scale | Class A/B: a repeating feature on the 1 m checker plane within ±10% of the declared tile. Examples: red brick course pitch ≈ 75 mm, plank width, tile pitch. Class C: recorded as nominal, and marble passes the D1 plausibility check |
| Seams | A 2×2 tiled qualified derivative shows no edge discontinuity: edge-wrap mean difference within the interior's neighbour difference |
| Albedo | Dielectric mean linear albedo between 0.02 and 0.9. `plausibilityCheck` entries within ±20% of the reference |
| Resolution | The §8.5 checks pass at the qualified level, and the next lower level is shown and judged worse (except 512). Screen numbers, views and the judgement are recorded |
| Budget | Each §8.5 scene's catalogue working set ≤128 MiB at the qualified levels, or the excess is reported to the owner. Leases return to baseline after teardown |

Publish each passing entry's fixed thumbnail as its derivative. Ship the cleared subset and record
the count against §13.

## 16. Expansion and Deferred

Expansion sets are fully listed with sources and screening in the manifest. Their starting
resolutions apply only when a later PR harvests them.

| Set | Source | Tile · scale | Class | Start | Src MB | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `wood-plywood` | [Poly Haven plywood](https://polyhaven.com/a/plywood) | 0.5 m · A | object* | 1K | 23 | Edge-grain plywood sheet |
| `wood-maple-veneer` | [Poly Haven white_maple_veneer](https://polyhaven.com/a/white_maple_veneer) | 1 m · A | object | 1K c (2K) | 54 | Very light hardwood |
| `stone-travertine` | [ambientCG Travertine009](https://ambientcg.com/a/Travertine009) | 1.2 m · A | surface | 512 c (1K) | 35 | Also the D1 marble fallback |
| `stone-marble-black` | [ambientCG Marble016](https://ambientcg.com/a/Marble016) | 1.2 m · C | surface | 512 c (1K) | 41 | Dark veined marble |
| `tile-terracotta` | [Poly Haven terracotta_floor_tiles](https://polyhaven.com/a/terracotta_floor_tiles) | 2.08 m · A | surface* | 2K | 60 | Source is dark and worn |
| `tile-subway` | [ambientCG Tiles036](https://ambientcg.com/a/Tiles036) | measure · B | surface* | at harvest | 47 | Tile = counted modules × 75×150 mm |
| `metal-corten` | [Poly Haven rust_coarse_01](https://polyhaven.com/a/rust_coarse_01) | 2.2 m · A | surface | 1K c (2K) | 63 | Weathered steel |
| `concrete-fluted` | [ambientCG Concrete045](https://ambientcg.com/a/Concrete045) | 2 m · A | surface* | 2K | 57 | Photogrammetry; relief is normal-only in v1 |
| `textile-wool-herringbone` | [Poly Haven poly_wool_herringbone](https://polyhaven.com/a/poly_wool_herringbone) | 0.27×0.276 m · A | object* | 512 | 74 | Upholstery weave |
| `synthetic-rubber` | [Poly Haven rubber_tiles](https://polyhaven.com/a/rubber_tiles) | 2 m · A | surface* | 2K | 59 | Studded flooring; [Rubber004](https://ambientcg.com/a/Rubber004) (0.75 m) starts at 512 |
| `synthetic-cork` | [ambientCG Cork001](https://ambientcg.com/a/Cork001) | 0.5 m · C | object | 512 c (1K) | 62 | Cork board or floor |
| `ground-cobblestone` | [Poly Haven cobblestone_floor_04](https://polyhaven.com/a/cobblestone_floor_04) | 1.5 m · A | surface* | 1K | 68 | Wants height |
| `ground-paving` | [Poly Haven pavement_02](https://polyhaven.com/a/pavement_02) | 2.12 m · A | surface* | 2K | 65 | Cast-stone pavers |
| `ground-gravel` | [Poly Haven gravel_floor_02](https://polyhaven.com/a/gravel_floor_02) | 2 m · A | surface | 1K c (2K) | 67 | |
| `ground-asphalt` | [Poly Haven asphalt_02](https://polyhaven.com/a/asphalt_02) | 3 m · A | surface | 2K | 26 | |
| `ground-sand` | [Poly Haven sand_01](https://polyhaven.com/a/sand_01) | 1.5 m · A | surface | 1K | 62 | |
| `ground-forest-floor` | [Poly Haven forrest_ground_01](https://polyhaven.com/a/forrest_ground_01) | 2 m · A | surface | 1K c (2K) | 72 | |

**Known gaps with no verified source yet:**
- paper (the legacy `paper-aged` stays an internal technical base)
- undyed natural wool
- dark slate

The Deferred items are listed in §5 and in the manifest's `deferred` array.

## 17. Risks and unknowns

- **ambientCG ZIP contents** (NormalGL versus NormalDX file names) are inferred from provider
  convention, not listed by the API. Harvest step 3 checks them.
- **Approximated sources** (`Concrete046`, `Terrazzo019L`) may fail the fidelity check. Both have
  alternates.
- **Conditional sets may escalate.** If walnut or plaster escalates to 2K, the living-room scene
  (127 MiB at start) exceeds the 128 MiB target. §8.5 makes that a reported trade-off, not a silent
  one.
- **Oak veneer repeat.** If `white_oak_veneer`'s 0.5 m repeat fails the overview check, the 2K
  alternate adds 60 MiB wherever oak is bound.
- **Grazing-angle blur** comes from anisotropy 1, not from resolution. It may be mistaken for low
  texture quality. It is recorded as separate render-quality work.
- **Provider re-releases** change Poly Haven md5 values. Harvest step 1 catches this, and D2
  retention keeps derivatives reproducible.
- **Physically Based colours** are spectral reductions to linear sRGB. Gold's red channel is 1.059
  and is clamped.
- **Structure maps may need factor tuning.** If a metal or plastic roughness map's range does not
  match the intended finish, it needs a recorded remap in the derivative step (§7).
- **Codec maturity.** `@napi-rs/image`'s 16-bit decode and lossless WebP encode are confirmed with a
  fixture at admission. If either fails, D3's fallback applies.
- **Repository growth** is estimated at 30–60 MB of qualified derivatives, measured at harvest. The
  repository's `.git` is 635 MB and uses no LFS. Non-qualified ladder levels stay out of git.
