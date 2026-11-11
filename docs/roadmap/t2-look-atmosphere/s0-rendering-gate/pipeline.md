# T2 S0 Gate A — verified pipeline record

**Status:** measured 2026-11-11 from the Gate A bench (`/dev/render-audit`) in the draft PR for
slice `T2.S0`. This record is the contract S3 Lights and A1 Artwork may rely on. It is **not** a
Gate B or Gate C result: reflections, Paper/Living, parity and the shadow budget remain unmeasured.

**Evidence:** [Gate A report](./report.md) · [artwork fidelity](./artwork-fidelity.md) ·
[contact sheet](./evidence/2026-11-11/gate-a-contact-sheet.png) ·
[machine-readable result](./evidence/2026-11-11/gate-a-result.json). Readback calibration passed with
a maximum channel error of **0**.

---

## 1. The pipeline as measured

| Fact | Value | How it was read |
| --- | --- | --- |
| Three revision | **r187** (`0.187.0`) | `REVISION` |
| Colour management | **enabled**, working space **`srgb-linear`** | `ColorManagement.enabled` / `workingColorSpace` |
| Output colour space | **`srgb`** | `renderer.outputColorSpace` |
| Drawing buffer | **`srgb`**, 512 × 512 at DPR 1 | `gl.drawingBufferColorSpace`, `getDrawingBufferSize` |
| Tone mapping | **`NoToneMapping`**, exposure **1.0** | `renderer.toneMapping` / `toneMappingExposure` |
| Shadow map | **`PCFShadowMap`** | `renderer.shadowMap.type` |
| Colour texture | **`srgb`**; data maps stay `NoColorSpace` | texture slot assignment in `texture-cache.ts` |
| Stage snapshot settings (bench replica) | 640 × 360, **`UnsignedByteType`**, texture colour space **`""` (NoColorSpace)** | `new WebGLRenderTarget(640, 360, { type: UnsignedByteType })`; `StageSnapshotRenderer.svelte` creates the same target |

The Stage, Visitor Preview and published visit all use the same
`createManagedWebGLRenderer` factory and set no tone-mapping, exposure or output-colour-space
override. The values above are therefore the shared runtime facts, not a bench-only configuration.

**Snapshot warning.** Three r187 renders a non-XR render target in
`ColorManagement.workingColorSpace` (linear). The Stage target and the bench replica both leave the
texture at `NoColorSpace`, so the RGBA bytes are linear but the PNG path has no sRGB encode. Snapshots
are therefore **not valid colour evidence** until E6 fixes or verifies that path. Gate A did not use
them; every number here comes from the default framebuffer immediately after `render()`.

## 2. The chosen pipeline

**`NoToneMapping`, exposure 1.0, sRGB output, `srgb-linear` working space.**

This is a decision **not to add a tone mapper** in this batch step, not an accident of defaults. E2
measured all four candidates and only the untonemapped Lambert response preserved the source
(see [artwork fidelity](./artwork-fidelity.md)). The plan's earlier Neutral recommendation is
**rejected by the measurement**:

| Candidate | Mid-tone mean ΔE00 | Verdict |
| --- | --- | --- |
| **None** | **1.30** | Met the mid-tone target; lifted near-black with the standard PBR material |
| ACES Filmic | 3.35 | Failed |
| AgX | 6.35 | Failed |
| Neutral | 4.07 | Failed |
| Neutral @ 1.1 | 2.73 | Failed |
| **Lambert + None** | **0.00** | **All 18 patches exact; chosen for Artwork** |

The unresolved tradeoff is Gate B's: if the Sky needs a tone mapper to hold highlights, that mapper
will shift artwork unless D16 changes. Gate A does **not** change D16; it chooses a lit, matte
Lambert response that keeps the current promise. If Gate B finds that a mapper is required, the
owner decides whether to accept the shift, add an explicit unlit option, or keep NoToneMapping.

## 3. Light units

Three's physical mode is active (legacy lighting was removed in r165). The stored `intensity` is
interpreted as:

- **Point and Spot:** luminous intensity in **candela**, with `decay = 2` and inverse-square
  attenuation.
- **Directional:** illuminance in **lux**, with no distance attenuation.

The bench's reference is **intensity π** on a white Lambertian plane at normal incidence. That gives
unit irradiance and an exact `#808080` readback (128,128,128). All three kinds produce the same
centre luminance at one metre, which is the check S3 needs before presenting one Brightness control.

### Measured Brightness stops

Stored intensity is unchanged; the stop is a UI multiplier. The bench measured each factor on
directional, point and spot with identical results:

| Stop | Factor | Stored intensity | Linear luminance | Measured ratio | sRGB centre |
| --- | --- | --- | --- | --- | --- |
| −2 | 0.25 | 0.7854 | 0.05448 | **0.2524** | 66 |
| −1 | 0.5 | 1.5708 | 0.10702 | **0.4958** | 92 |
| 0 | 1 | 3.1416 | 0.21586 | **1.0000** | 128 |
| +1 | 2 | 6.2832 | 0.43415 | **2.0113** | 176 |
| +2 | 4 | 12.5664 | 0.86316 | **3.9987** | 239 |

Ratios are within 0.5% of the nominal factors. Because the chosen pipeline has no tone mapper, the
visual response is linear in stored intensity; S3 can implement stops as direct multipliers without
inventing a curve.

### Spot and range

- Spot `angle` is stored in **radians**. A 30° half-angle (`π/6`) at 1 m produced a measured radius
  of **0.574 m** against the expected **0.577 m**; error **−0.003 m**. The 0.5-luminance edge is the
  measurement boundary, so this is within one pixel-class tolerance.
- Spot `penumbra` is a fraction of the cone; `0` was used for the radius check.
- Point `range` is a cutoff, not a replacement for decay. At 3 m, `range = 2` measured **0.0000**
  centre luminance; `range = 5` measured **0.0185**. An absent or zero range is unbounded.

## 4. What S3 Lights may rely on

- Write existing `SceneLightEntity.intensity` and do not introduce a second unit or a legacy-light
  conversion.
- Present Brightness as the five factors above (or a subset), labelled as stops; stored values are
  the physical intensity. Do not bake the stop label into the document.
- Warmth is a colour reading; the bench used a white light, so the colour contract is unchanged.
- Point and spot use `decay = 2`; do not add a decay field for this batch.
- Spot aims by rotation/target and uses radians internally; present degrees in the UI by converting
  at the edge.
- Shadow budget is **not** set here. Gate C owns D9; do not infer a cast-shadow default from Gate A.

## 5. What A1 Artwork may rely on

- Use a **diffuse-only lit material** (the bench used `MeshLambertMaterial`) with an **sRGB** image
  texture. Under unit white light it reproduces all 18 reference patches exactly (ΔE00 = 0),
  including near-black, while still responding to lights and casting shadows.
- Do **not** use `MeshStandardMaterial` for the artwork surface by default: its dielectric specular
  lobe lifts near-black (18,18,20 → 35,35,36) and produces a maximum patch ΔE00 of 5.16 under the
  neutral reference. That is a real, visible fidelity cost.
- No environment map and no sky reflection. Once Gate B adds `scene.environment`, the artwork
  material must set `envMapIntensity = 0` (or use a material that does not sample it).
- Keep the image's `colorSpace = SRGBColorSpace`; never treat it as a data map.
- Do not use the Stage snapshot path as a fidelity reference until E6 fixes its colour space.

## 6. Limits

- The chart is synthetic and the light is one white directional light at normal incidence. Real
  artwork, coloured lights, shadows, transparency and skylight are A1's and Gate B's tests.
- One device and one browser; no performance or shadow-cost claim.
- Gate B and Gate C are **not authorised** by this record. Gate B owns reflections, indoor policy,
  Paper/Living and parity; Gate C owns the shadow budget.
