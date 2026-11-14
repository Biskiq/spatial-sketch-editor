# T2 S0 Gate A — artwork colour fidelity

**Status:** measured 2026-11-11; Gate A accepted with follow-up corrections applied. This is the
colour-fidelity record A1 Artwork may rely on. It does not decide framing, placement, transparency or
release pinning; those are A1's own checks.

**Evidence:** [pipeline record](./pipeline.md) · [Gate A report](./report.md) ·
[contact sheet](./evidence/2026-11-11/gate-a-contact-sheet.png) ·
[machine-readable result](./evidence/2026-11-11/gate-a-result.json).

---

## 1. Question and method

**Question:** under the neutral reference light, which tone-mapping pipeline and artwork material
keep an image close enough to its source that an artist would not see a colour shift?

**Bench:** the dev-only `/dev/render-audit` route, removed before merge; reproduce from commit `1a669fb1` (see [report](./report.md#dev-route-policy)). A 512 × 512 sRGB chart fills a `PlaneGeometry` viewed through an
orthographic camera at 1:1 pixel mapping. The chart has 18 patches (neutrals, skin, six pigments,
paper, brass, wood, near-black, near-white) plus neutral, hue, tonal and dark-detail ramps. One white
directional light at intensity π is the bench calibration for the 50% grey patch: π renderer units of
irradiance and the Lambertian 1/π factor produce the source `#808080` readback. It is not a statement
that the surface receives one physical unit of illuminance. No sky, no environment map, no shadows,
exposure 1.0.

**Readback:** default framebuffer `readPixels` immediately after `render()`, not the snapshot target.
The calibration renders an unlit sRGB texture through the same renderer: **maximum channel error 0**
across all 18 patches. Every number below is therefore a displayed-sRGB measurement.

**Colour difference:** CIEDE2000 between source sRGB and rendered sRGB, both converted through D65
Lab. The acceptance target from the plan was **mid-tone mean ΔE00 ≤ 2**, with no patch clipping more
than 1% of its pixels. The all-patch maximum is reported as well because a mean can hide a visible
dark-end failure.

## 2. Results

| Pipeline | Mean ΔE00 | Mid-tone mean | Max ΔE00 | P95 ΔE00 | Clipping | Grey ramp |
| --- | --- | --- | --- | --- | --- | --- |
| **Lambert, NoToneMapping** | **0.00** | **0.00** | **0.00** | **0.00** | 0% | monotonic |
| Standard, NoToneMapping | 1.48 | 1.30 | 5.16 | 5.16 | 0% | monotonic |
| Standard, ACES Filmic | 3.25 | 3.35 | 5.57 | 5.57 | 0% | monotonic |
| Standard, AgX | 6.41 | 6.35 | 11.00 | 11.00 | 0% | monotonic |
| Standard, Neutral | 3.85 | 4.07 | 8.09 | 8.09 | 0% | monotonic |
| Standard, Neutral @ 0.9 | 5.58 | 5.86 | 8.67 | 8.67 | 0% | monotonic |
| Standard, Neutral @ 1.1 | 2.58 | 2.73 | 7.29 | 7.29 | 0% | monotonic |

### What the standard material does

`NoToneMapping` + `MeshStandardMaterial` passes the mid-tone target but fails the dark end:

| Patch | Source | Rendered | ΔE00 |
| --- | --- | --- | --- |
| Near black | 18,18,20 | 35,35,36 | **5.16** |
| Dark textile | 42,38,52 | 51,48,59 | **3.60** |
| Neutral 20% | 52,52,52 | 59,59,59 | 2.27 |
| Warm wood | 110,70,40 | 112,75,49 | 2.12 |

The lift is the standard material's dielectric specular lobe, not the light. At roughness 1 and
metalness 0 the specular response is broad and adds a near-constant term, which is proportionally
large on a near-black surface.

### What Lambert does

Replacing the standard material with a diffuse-only lit material (`MeshLambertMaterial`) removes that
lobe. The same 18 patches render **exactly** their source sRGB values, including near-black, with no
clipping and a monotonic ramp. It still responds to the light and can cast a shadow; it is lit and
matte, which is exactly D16.

## 3. Tone mapping is rejected by the measurement

The plan's recommendation was to adopt Neutral if it preserved artwork. It does not:

- Neutral shifts the dark end down (near-black 18 → 6; dark textile 42,38,52 → 24,16,39) and misses
  the mid-tone target by a wide margin.
- Neutral @ 1.1 improves the mean but still fails the mid-tone target (2.73) and the dark end (7.29).
- ACES and AgX both fail; AgX is the worst of the four.
- NoToneMapping is the only mapper that meets the mid-tone target, and Lambert makes it exact across
  every patch.

**Decision (owner-approved baseline):** keep `NoToneMapping`, exposure 1.0 for Gate A, and use
`MeshLambertMaterial` as A1's initial lit/matte artwork material. This does **not** change D16; it
implements "lit and matte" with the material that preserves the image.

## 4. The genuine escalation

There is a real tradeoff, and it belongs to Gate B, not Gate A:

- If the Sky needs a tone mapper to hold highlights or to make reflections readable, that mapper may
  shift artwork. There is no measured mapper that both handles a bright sky and preserves the
  reference patches. However, **`MeshLambertMaterial` + `toneMapped = false` under a global mapper is
  untested**; Gate B must measure that opt-out before claiming a mapper necessarily compromises
  artwork.
- The owner must then choose: accept a recorded artwork shift, add an explicit unlit/full-brightness
  artwork option, or keep NoToneMapping and design the Sky within its range.
- Gate A does not make that choice silently. It records the evidence and keeps the approved D16
  promise intact.

## 5. What A1 may rely on

- Image bytes reach the surface as sRGB and, under the neutral reference, can be reproduced exactly
  by a diffuse-only lit material.
- Use `MeshLambertMaterial` (or an equivalent zero-specular lit material) for the artwork surface.
  Do not use `MeshStandardMaterial` by default.
- Set no environment map, and once Gate B adds one, set `envMapIntensity = 0` on the artwork.
- Keep `toneMapped` irrelevant by keeping the pipeline at `NoToneMapping`; if Gate B proposes a
  global mapper, test both `toneMapped = true` and `toneMapped = false` with real artwork.
- Repeat the fidelity check with a real photograph and a coloured light in A1. The synthetic chart
  proves the transform; it does not prove a specific painting, a transparency, or a frame.
