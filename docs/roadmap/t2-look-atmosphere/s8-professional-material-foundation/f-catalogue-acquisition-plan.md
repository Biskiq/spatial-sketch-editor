# S8 F · Catalogue and harvest plan

**Status:** proposed for owner review. Nothing has been downloaded, derived or shipped.
**Scope:** E6a catalogue intake inside [F](./implementation-plan.md#f--inspect-materials-and-qualify-the-catalogue).
E7 inspection, thumbnails and the F exit stay as the implementation plan defines them.
**Machine-readable companion:** [`f-acquisition-manifest.json`](./f-acquisition-manifest.json). It was
generated on 2026-11-21 from the Poly Haven, ambientCG and Physically Based APIs. When this page and
the manifest differ, the manifest wins for URLs, sizes and checksums; this page wins for policy.

## 1. Decision requested

The plan's E6a target is fourteen entries: the original six plus eight new ones. Replace it with an
evidence-based Core:

- **17 Core asset sets → 22 new creator-facing entries.** Five entries are presets that reuse
  another set's pinned images, so they cost no extra bytes or GPU views. The original six stay as
  they are, which makes 28 creator-facing entries in total.
- **17 Expansion sets.** They are sourced and verified here but not harvested in F. A later PR can
  append them to the same allowlist.
- **9 Deferred items.** Each needs an engine family that v1 `pbr-metallic-roughness/v1` lacks.
- **1K is the shipped default for every Core set.** 2K is derived, hashed and retained but not
  allowlisted.
- **Sources are kept byte-for-byte outside git.** Git holds only the 1K derivatives, the pins,
  licence records and derivation records.

Section 10 lists seven owner decisions, each with a recommended default.

## 2. Constraints this plan is built on

| Constraint | Value | Where |
| --- | --- | --- |
| Engine family | `pbr-metallic-roughness/v1`: opaque; colour, normal (`+Y`/`−Y`), and scalar roughness, metalness and occlusion maps chosen by component | [types](../../../../packages/project-model/src/materials/types.ts) |
| Factor semantics | Factors multiply the maps (three/glTF). Recipe colour is an sRGB hex. Tint can only darken or shift hue, never lighten | [material store](../../../../apps/editor/src/lib/render/resources/material-store.ts) |
| Image admission | ≤4096 px edge, ≤25 MiB, 8-bit only. Standard sRGB or no profile. EXIF orientation 1. Lossy data maps draw a `lossy-data` warning | [image encoding](../../../../apps/editor/src/lib/render/resources/image-encoding.ts) |
| GPU | 256 MiB Finish-view ceiling. One RGBA8 mip-chain view costs 5.33 MiB at 1K, 21.33 MiB at 2K, 85.33 MiB at 4K | [B report](./pr-b-report.md) |
| Sharing | The texture source cache keys on scope, URI and colour policy, so entries that name the same URI share one GPU source | [texture store](../../../../apps/editor/src/lib/render/resources/texture-store.ts) |
| Catalogue | Append-only. A change to pixels or meaning needs a new ID. The original six keep their values and bytes | [plan E6a](./implementation-plan.md#f--inspect-materials-and-qualify-the-catalogue) |

## 3. Existing coverage

| ID | What it is today | Gap |
| --- | --- | --- |
| `plaster-warm`, `wood-walnut`, `brass-aged` | 256² PNG colour (and roughness) maps | No normal map. **No licence record or provenance** in `assets-source/licenses` (introduced in `542bc540`) |
| `marble-light`, `velvet-dark`, `paper-aged` | Flat factors, no maps | No surface structure |

**Missing entirely:**
- floors (planks, parquet, tile, carpet, concrete)
- masonry
- veined or aggregate stone
- clean and brushed metal
- woven textile and leather
- plastic

These are the surfaces creators use most for interiors.

**Pre-existing issue to fix in F (no byte change):** add a licence record for each of the three
textured legacy images, or a "provenance unknown" record. A record should never be invented.

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
- **Scale:** A is provider-declared. B is a measured repeating feature, cross-checked to ±10%. C is
  nominal and needs a ruling (§10, D1).
- **px/m @1K:** 1024 divided by the larger tile edge.
- **Tint:** see §7.
- **Views:** GPU textures per set.
- **Src MB:** the full 4K source download.

| Set | Entries | Source | Creator | Tile · scale | px/m @1K | Tint | Views | Src MB | Alternates |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `wood-oak-veneer` | Oak Veneer | [Poly Haven oak_veneer_01](https://polyhaven.com/a/oak_veneer_01) | Jenelle van Heerden | 1.83 m · A | 560 | T0 | 3 | 170 | [white_oak_veneer](https://polyhaven.com/a/white_oak_veneer) |
| `wood-walnut-veneer` | Walnut Veneer | [Poly Haven walnut_veneer_02](https://polyhaven.com/a/walnut_veneer_02) | Jenelle van Heerden | 1 m · A | 1024 | T0-darken | 3 | 152 | [Wood051](https://ambientcg.com/a/Wood051), [smoked_walnut_veneer](https://polyhaven.com/a/smoked_walnut_veneer) |
| `wood-oak-planks` | Oak Plank Floor | [Poly Haven wood_floor](https://polyhaven.com/a/wood_floor) | Dimitrios Savva | 1.7 m · A | 602 | T0 | 3 | 147 | [laminate_floor_02](https://polyhaven.com/a/laminate_floor_02) |
| `wood-herringbone-parquet` | Herringbone Parquet | [Poly Haven herringbone_parquet](https://polyhaven.com/a/herringbone_parquet) | Jenelle van Heerden, Sergej Majboroda | 3.4 m · A | **301** | T0 | 3 | 159 | — |
| `stone-marble-white` | White Marble | [ambientCG Marble012](https://ambientcg.com/a/Marble012) | ambientCG | 1.2 m · **C** | 853 | T1 | 3 | 196 | [Travertine009](https://ambientcg.com/a/Travertine009) (A) |
| `stone-terrazzo` | Terrazzo | [ambientCG Terrazzo019L](https://ambientcg.com/a/Terrazzo019L) | ambientCG | 0.8 m · A | 1280 | T0 | 3 | 212 | [Terrazzo005](https://ambientcg.com/a/Terrazzo005) (C) |
| `masonry-brick-red` | Red Brick | [Poly Haven red_brick_03](https://polyhaven.com/a/red_brick_03) | Rob Tuytel | 1 m · A | 1024 | T0 | 3 | 65 | [Bricks059](https://ambientcg.com/a/Bricks059) |
| `masonry-brick-painted` | Painted Brick | [ambientCG PaintedBricks004](https://ambientcg.com/a/PaintedBricks004) | ambientCG | 1.55 m · A | 661 | T1 | 3 | 206 | — |
| `plaster-painted` | Painted Plaster | [Poly Haven painted_plaster_wall](https://polyhaven.com/a/painted_plaster_wall) | Amal Kumar | 2 m · A | 512 | T1 | 3 | 156 | [plastered_wall](https://polyhaven.com/a/plastered_wall) |
| `concrete-smooth` | Smooth Concrete, Polished Concrete | [ambientCG Concrete046](https://ambientcg.com/a/Concrete046) | ambientCG | 2.4 m · A | 427 | T1 | 3 | 242 | [concrete_wall_008](https://polyhaven.com/a/concrete_wall_008), [Concrete034](https://ambientcg.com/a/Concrete034) |
| `tile-ceramic-white` | White Ceramic Tile | [ambientCG Tiles107](https://ambientcg.com/a/Tiles107) | ambientCG | 1 m · A | 1024 | T1 | 3 | 111 | — |
| `metal-satin` | Satin Stainless Steel, Satin Brass, Satin Copper, Satin Gold | [ambientCG Metal032](https://ambientcg.com/a/Metal032) | ambientCG | 0.5 m · **C** | 2048 | metal | 2 | 227 | — |
| `metal-brushed` | Brushed Stainless Steel, Brushed Aluminium | [ambientCG Metal009](https://ambientcg.com/a/Metal009) | ambientCG | 0.5 m · **C** | 2048 | metal | 2 | 202 | [Metal011](https://ambientcg.com/a/Metal011) |
| `textile-linen` | Natural Linen | [Poly Haven rough_linen](https://polyhaven.com/a/rough_linen) | colormass, Rico Cilliers | 0.271 m · A | 3779 | T1-neutralize | 3 | 185 | — |
| `textile-carpet-loop` | Loop Pile Carpet | [ambientCG Carpet016](https://ambientcg.com/a/Carpet016) | ambientCG | 1.7 m · A | 602 | T0 | 3 | 251 | — |
| `leather-smooth` | Cognac Leather | [Poly Haven leather_white](https://polyhaven.com/a/leather_white) | Rob Tuytel | 0.3 m · A | 3413 | T1 | 3 | 72 | [Leather035D](https://ambientcg.com/a/Leather035D) |
| `synthetic-plastic-matte` | Matte Plastic | [ambientCG Plastic010](https://ambientcg.com/a/Plastic010) | ambientCG | 0.5 m · **C** | 2048 | T1 | 3 | 177 | [Plastic013A](https://ambientcg.com/a/Plastic013A) |

### Selection notes

- **Wood**
  - Oak (light) and walnut (dark) are the two timber anchors.
  - Planks and herringbone are the two floor layouts people ask for.
  - At 3.4 m, herringbone hides its repeat but gives only 301 px/m at 1K. It is the first 2K
    candidate (§8).
- **Stone**
  - Poly Haven has no clean polished marble. `Marble012` is the cleanest white with grey veining
    found, but it declares no size.
  - `Travertine009` (1.2 m, class A) is the fallback if class C is refused.
  - `Terrazzo019L` is chosen over the more classic white-and-black `Terrazzo005` because it is the
    only terrazzo with a declared scale.
- **Approximated maps**
  - ambientCG marks `Concrete046` and `Terrazzo019L` as `PBRApproximated`. Their normal and
    roughness maps are inferred from a colour photograph ([creation methods](https://docs.ambientcg.com/creation-methods/)).
  - They are plausible rather than measured. Qualification judges them visually. Poly Haven's
    `concrete_wall_008` is the scanned alternate.
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
  - `Tiles107` tints its grout together with the tile.
  - Coloured tile with light grout needs a mask or layer, so it is Deferred.

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
color = linear(target) / linearMean(1K colour derivative), per channel, then sRGB hex
```

Any channel above 1 means the source is too dark to reach the target, so the agent switches to the
alternate source. The entries checked against Physically Based reference albedos are marble, brick,
concrete and tile, flagged `plausibilityCheck`.

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

## 8. Resolution, derivatives and delivery

**Source:** 4K, downloaded once, byte-for-byte.

| Provider | Files downloaded |
| --- | --- |
| Poly Haven | `Diffuse` 4K JPG (colour), `nor_gl` 4K PNG, `arm` 4K PNG. The provider's 1K data PNGs are about 4–6 MB, which indicates 16-bit; that is acceptable as a source and is quantized to 8-bit on output |
| ambientCG | The 4K-PNG ZIP, which contains all maps including both normal conventions |

**Volume:**

| Scope | Total |
| --- | --- |
| Core source | 2.93 GB |
| Core + Expansion source | ≈5.6 GB |

8K is not needed. A 2K derivative from a 4K source keeps 2× supersampling, and admission caps
images at 4096 px anyway.

**Derivatives.** Each set is packed to at most three images:

| Image | Format | Notes |
| --- | --- | --- |
| `color` | lossy WebP q90, sRGB, no metadata | Metal sets have none |
| `normal` | 8-bit RGB PNG, `+Y` | |
| `orm` | 8-bit RGB PNG | R = AO (or 255 with occlusion unbound), G = roughness, B = metal (0 for dielectric, 255 for metal) |

Data maps stay lossless, so a curated entry never carries the `lossy-data` warning.

| Resolution | Role | GPU per 3-view set | All 17 Core resident | Repo |
| --- | --- | --- | --- | --- |
| 1K | **default, allowlisted** | 16 MiB (metal sets 10.7) | 261 MiB (above the 256 MiB ceiling) | committed, ≈2–4 MB per set, ≈40–60 MB Core (measured at harvest) |
| 2K | produced, hashed, retained, **not allowlisted** | 64 MiB | 1,045 MiB | not committed; hashes recorded |
| 4K | source only | 256 MiB | — | retention store |

**Why 1K by default:**
- Typical room scenes bind 4–8 sets, which is 64–128 MiB at 1K.
- The integrated acceptance case is eight 1K sets.
- Binding all 17 Core sets at once exceeds the ceiling. The B pressure path then refuses with
  `texture-budget` instead of thrashing.
- 2K would allow only three or four distinct sets per view.

**2K is held for a later quality-preference or streaming consumer.** A set with fewer than about
400 px/m at 1K is flagged as the first 2K candidate: herringbone (301) and concrete (427). Adding a
2K URI later is an append to the allowlist.

**Browser delivery cost:**
- The shelf reads published 192² thumbnail derivatives, so a warm list fetches no full-resolution
  image.
- A set's images are fetched only when a Finish binds them.
- Core and Expansion therefore differ in repository size and qualification effort, not in first-load
  bandwidth.

**Delivery classes:**

| Class | Delivery | Compatibility |
| --- | --- | --- |
| Core (public catalogue) | `apps/editor/static/textures/<set-id>/…`, pinned in `SHIPPED_MATERIAL_IMAGES`, immutable URIs | Library items reference these as frozen shipped URIs (E6b), so no copy is needed |
| Expansion (on demand) | Same mechanism in a later append-only PR, optionally from a CDN origin under the same pin contract | No runtime change. Its absence is a missing catalogue ID, never a broken pin |
| Private creator assets | P20 / E6b paths, unchanged | Curated and private images share the hash-keyed resource system |

## 9. Sources and licence evidence

| Provider | Licence evidence (verified 2026-11-21) | Integrity | Notes |
| --- | --- | --- | --- |
| Poly Haven | [polyhaven.com/license](https://polyhaven.com/license): "Our assets are all licensed as CC0" | Files API gives md5 and size per file | API needs a unique User-Agent. `dimensions` are in mm. `arm` follows glTF ORM order. Files can be re-released, which changes their md5 |
| ambientCG | [docs.ambientcg.com/license](https://docs.ambientcg.com/license/): "provided under the Creative Commons CC0 1.0 Universal License" | No checksum; ZIP size only | `dimensionX/Y` are in cm and approximate; 0 means undeclared. No per-asset author is exposed; the operator is Lennart Demes ([legal](https://docs.ambientcg.com/legal/)). Run by one person, so expect occasional unavailability |
| Physically Based | [api.physicallybased.info/v2/materials](https://api.physicallybased.info/v2/materials), `header.license = "CC0 1.0 Universal"` | — | Colour values only |

ShareTextures and cgbookcase were considered and **excluded**: their licence pages could not be
verified (HTTP 404 at research time).

Each manifest entry records, per set:
- page, API and download URLs
- creators
- maps available
- normal convention
- declared dimensions and unit
- all available resolutions with byte sizes
- chosen 4K source files with md5 (Poly Haven) or ZIP size (ambientCG)
- 1K provider reference sizes

The fields map onto
[`RightsEvidence`](../../../../apps/editor/assets-source/pipeline/provenance.ts) and the E6a
manifest fields.

## 10. Owner decisions

| # | Decision | Recommended default | If declined |
| --- | --- | --- | --- |
| D1 | Admit **scale class C** (nominal tile, recorded as nominal) for micro-surfaces and ambiguous veining: `Marble012`, `Metal032`, `Metal009`, `Plastic010` | Admit. Satin, brushed and plastic micro-structure is scale-insensitive at room distance. Marble gets 1.2 m, a common slab-veining repeat | Marble falls back to `Travertine009`. Metal and plastic ship as untextured factor entries, or are excluded |
| D2 | **Source retention store** for ≈2.9 GB of Core originals | Owner-controlled private object storage, with immutable keys `materials/<provider>/<assetId>/<file>` and sha256 in the derivation record. Never git | A private GitHub release on this repository (2 GB per file limit is fine) |
| D3 | Make **`sharp` a direct, exact-pinned devDependency** for decode and encode | `0.34.5`, already installed transitively through `@gltf-transform/cli`, so the lockfile does not grow. Filtering, normal renormalization and packing stay in our own pure code | `pngjs` + `jpeg-js` (new dependencies, no WebP; colour would ship as JPEG) |
| D4 | Allow **luminance-neutral derivatives** (a recorded colour transform) so coloured sources become tintable | Allow. Only `rough_linen` in Core | Find an undyed linen source, or ship linen as-shot light blue |
| D5 | **Presets** as separate catalogue entries that share images (six metal entries over two structure sets; polished concrete) | Allow. Each must pass distinctness on its own | Ship one entry per set (17), with colour left to the future palette |
| D6 | **1K default, 2K retained but not allowlisted** | As in §8 | Ship 2K for herringbone and concrete only (+96 MiB worst case when both are bound) |
| D7 | Replace the **fourteen-entry target** with the wording in §11 | Adopt | Keep fourteen and take the first eight Core sets in table order |

## 11. Proposed replacement for the E6a target

> **E6a catalogue intake.** Qualify the Core list in
> [`f-acquisition-manifest.json`](./f-acquisition-manifest.json) (17 asset sets, 22 creator-facing
> entries) in addition to the original six, which keep their IDs, values and bytes. The technical
> neutral base is not counted. Size follows coverage, not a quota: every Core taxonomy slot ships
> at least one qualified entry, or records why its first choice and alternates failed. A preset
> that reuses a set's pinned images is an entry only if it passes the distinctness test on its own.
> Store each new immutable ID and its manifest alongside the existing catalogue: label, source URL,
> creator, CC0 evidence, acquisition date, image purpose, measured dimensions, MIME, SHA/size,
> packing, normal convention, claimed physical tile, scale class and exact v1 recipe. Catalogue
> static paths are allowlisted and append-only. A missing licence, broken URL provenance,
> mismatched pin, failed fidelity test, or unverifiable scale (class C without the owner ruling)
> excludes that entry. Ship the cleared subset and record the count. Expansion sets are out of F
> scope.

## 12. Instructions for the F implementation agent

### Harvest

1. **Re-verify on harvest day.**
   - Re-read Poly Haven `/info` and `/files`, and ambientCG `api/v3/assets?id=…&include=maps,downloads,dimensions`, for each Core set.
   - If an md5 or size differs from the manifest, record the new value and repeat the visual check.
     The manifest is a 2026-11-21 snapshot.
2. **Download each file once.**
   - Use a project-specific User-Agent with no personal contact details. Use only API and download
     URLs; never scrape site pages.
   - Poly Haven: the three 4K files named in `source.files`. ambientCG: the `4K-PNG` ZIP.
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
5. **Retain.** Upload the originals to the D2 store and record their keys. Nothing larger than the
   1K derivatives enters git.

### Derive

Use one deterministic script under
[`apps/editor/assets-source/`](../../../../apps/editor/assets-source/), next to the existing
`pipeline/`. `textures/` is already reserved there.

1. **Decode** to float.
   - Colour: sRGB → linear.
   - Normal: [0,1] → [−1,1].
   - Data: raw.
   - 16-bit sources keep their precision until the final quantization.
2. **Downsample** 4096 → 2048 → 1024 with an exact 2× box filter per step, which is the same filter
   as GPU mip generation.
   - Normals: average the vectors, then renormalize.
   - Colour: average in linear light.
   - Data: average raw values.
   - Non-4096 or non-square sources (for example `rough_linen`, whose maximum is 8233×8251) use one
     recorded separable Lanczos-3 resample to an exact power of two. The declared tile stays the
     same.
3. **Neutralize (D4 only).**
   - Compute Rec. 709 luminance in linear light and output (Y, Y, Y).
   - Record the transform ID and parameters.
4. **Pack ORM** as in §8. Drop the provider colour map for metal sets.
5. **Encode.**
   - Colour: WebP lossy q90, method 6, no ICC, EXIF or XMP.
   - Normal and ORM: 8-bit RGB PNG with no colour chunks.
   - Every output must pass `image-encoding` admission.
6. **Check reproducibility.**
   - Using the pinned encoder, a rerun must produce identical bytes.
   - On another machine, the decoded pixels must match within 1/255. The committed bytes are the pin.
7. **Write a derivation record** per set: source sha256s, retention keys, tool versions,
   parameters, and output sha256 and size for 1K and 2K.

### Pin and record

- Commit the 1K files to `apps/editor/static/textures/<set-id>/{color.webp,normal.png,orm.png}`.
- Add the pins to `SHIPPED_MATERIAL_IMAGES`.
- Add the entries to the catalogue and to the editor facade without disturbing the original six.
- Write a licence record per set at `apps/editor/assets-source/licenses/material-<set-id>.md`.
  Follow the `sofa-03.md` layout, filled with the `RightsEvidence` fields, the scale class and the
  tint class.
- Compute each entry's recipe colour from its `targetMeanAlbedo` using the §7 rule, and record the
  measured mean beside it.

### Qualify

Write per-entry results to `evidence/s8-f-catalogue.json`. Run B's frozen studio chart first.

| Check | Pass condition |
| --- | --- |
| Clipping | Under 1% of the subject's pixels clipped in the 192² studio thumbnail |
| Distinctness | No pair of entries has thumbnail patch-mean ΔE00 < 3 **and** luminance SSIM > 0.95. Either condition alone is fine. A failing preset is dropped; a failing set goes to its alternate |
| Normal convention | Under grazing light, flipping Y reverses the +Y/−Y chart response for every set |
| Scale | Class A/B: a repeating feature on the 1 m checker plane within ±10% of the declared tile. Examples: red brick course pitch ≈ 75 mm, plank width, tile pitch. Class C: recorded as nominal |
| Seams | A 2×2 tiled 1K derivative shows no edge discontinuity: edge-wrap mean difference within the interior's neighbour difference |
| Albedo | Dielectric mean linear albedo between 0.02 and 0.9. `plausibilityCheck` entries within ±20% of the reference |
| Budget | Eight distinct 1K Core sets bound together stay under the 256 MiB ceiling, with leases at baseline after teardown |

Publish each passing entry's fixed thumbnail as its derivative. Ship the cleared subset and record
the count against §11.

## 13. Expansion and Deferred

Expansion sets are fully listed with sources in the manifest:

| Set | Source | Tile · scale | px/m @1K | Src MB | Note |
| --- | --- | --- | --- | --- | --- |
| `wood-plywood` | [Poly Haven plywood](https://polyhaven.com/a/plywood) | 0.5 m · A | 2048 | 68 | Edge-grain plywood sheet |
| `wood-maple-veneer` | [Poly Haven white_maple_veneer](https://polyhaven.com/a/white_maple_veneer) | 1 m · A | 1024 | 143 | Very light hardwood |
| `stone-travertine` | [ambientCG Travertine009](https://ambientcg.com/a/Travertine009) | 1.2 m · A | 853 | 143 | Also the D1 marble fallback |
| `stone-marble-black` | [ambientCG Marble016](https://ambientcg.com/a/Marble016) | 1.2 m · C | 853 | 148 | Dark veined marble |
| `tile-terracotta` | [Poly Haven terracotta_floor_tiles](https://polyhaven.com/a/terracotta_floor_tiles) | 2.08 m · A | 492 | 165 | Source is dark and worn |
| `tile-subway` | [ambientCG Tiles036](https://ambientcg.com/a/Tiles036) | measure · B | — | 178 | Tile = counted modules × 75×150 mm |
| `metal-corten` | [Poly Haven rust_coarse_01](https://polyhaven.com/a/rust_coarse_01) | 2.2 m · A | 465 | 175 | Weathered steel |
| `concrete-fluted` | [ambientCG Concrete045](https://ambientcg.com/a/Concrete045) | 2 m · A | 512 | 233 | Photogrammetry; relief is normal-only in v1 |
| `textile-wool-herringbone` | [Poly Haven poly_wool_herringbone](https://polyhaven.com/a/poly_wool_herringbone) | 0.27×0.276 m · A | 3710 | 204 | Upholstery weave |
| `synthetic-rubber` | [Poly Haven rubber_tiles](https://polyhaven.com/a/rubber_tiles) | 2 m · A | 512 | 162 | Studded flooring |
| `synthetic-cork` | [ambientCG Cork001](https://ambientcg.com/a/Cork001) | 0.5 m · C | 2048 | 137 | Cork board or floor |
| `ground-cobblestone` | [Poly Haven cobblestone_floor_04](https://polyhaven.com/a/cobblestone_floor_04) | 1.5 m · A | 683 | 175 | Wants height |
| `ground-paving` | [Poly Haven pavement_02](https://polyhaven.com/a/pavement_02) | 2.12 m · A | 483 | 180 | Cast-stone pavers |
| `ground-gravel` | [Poly Haven gravel_floor_02](https://polyhaven.com/a/gravel_floor_02) | 2 m · A | 512 | 186 | |
| `ground-asphalt` | [Poly Haven asphalt_02](https://polyhaven.com/a/asphalt_02) | 3 m · A | 341 | 74 | 2K candidate |
| `ground-sand` | [Poly Haven sand_01](https://polyhaven.com/a/sand_01) | 1.5 m · A | 683 | 149 | |
| `ground-forest-floor` | [Poly Haven forrest_ground_01](https://polyhaven.com/a/forrest_ground_01) | 2 m · A | 512 | 186 | |

**Known gaps with no verified source yet:**
- paper (the legacy `paper-aged` stays flat)
- undyed natural wool
- dark slate

The Deferred items are listed in §5 and in the manifest's `deferred` array.

## 14. Risks and unknowns

- **ambientCG ZIP contents** (NormalGL versus NormalDX file names) are inferred from provider
  convention, not listed by the API. Harvest step 3 checks them.
- **Approximated sources** (`Concrete046`, `Terrazzo019L`) may fail the fidelity check. Both have
  alternates.
- **Provider re-releases** change Poly Haven md5 values. Harvest step 1 catches this.
- **Physically Based colours** are spectral reductions to linear sRGB. Gold's red channel is 1.059
  and is clamped.
- **Structure maps may need factor tuning.** If a metal or plastic roughness map's range does not
  match the intended finish, it needs a recorded remap in the derivative step (§7).
- **Repository growth:** about 40–60 MB of 1K derivatives in a 635 MB `.git` with no LFS. 2K stays
  out of git under D6.
