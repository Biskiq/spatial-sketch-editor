# P3 model — counts × unit costs (prepared, not run)

Status: a candidate prediction model for the owner's Gate C decision. This file does **not** claim a
Gate C pass, does not authorize Gate C, and contains no real Stage timing. It states the formula,
the M-series prediction for one named World, the arithmetic reference estimate, and the protocol a
device check must follow.

Source evidence: P1 counts in [`census/census.md`](./census/census.md) and P2 constants in
[`README.md`](./README.md).

## Formula

For one presented frame on one backend:

```
S = c0 + cDraw · D + cTri · T + cLight · L + cShadow · P
```

| Term | Meaning | Source |
| --- | --- | --- |
| `S` | synchronized serial frame, ms | P2 timing definition |
| `c0` | fixed per-backend cost: clear, present, base sun, and the P2 readback | base point minus its counted terms |
| `D` | draw submissions in the frame | P1 `renderer.info.render.calls` |
| `T` | triangles submitted | P1 `renderer.info.render.triangles` |
| `L` | unshadowed lights **beyond** the base directional sun | P1 lights, minus one |
| `P` | shadow passes in the frame (a point light costs six) | P1 shadow-casting lights × pass count |
| `cDraw`, `cTri` | per-draw and per-triangle submit cost | P2 mesh-count and triangle fits |
| `cLight` | per unshadowed point-light cost at the frame's N | P2 point-light fits, N=1,000 or 5,000 |
| `cShadow` | per shadow pass at the frame's caster count | P2 shadow fits, N=1,000 or 5,000 |

`c0` is derived from the base row (1,000 draws, 12,000 triangles, one directional sun, no shadows):

| Backend | Base `S` | `cDraw·1000` | `cTri·12000` | `c0` |
| --- | ---: | ---: | ---: | ---: |
| A · WebGLRenderer | 6.35 | 0.6753 | 0.0119 | **5.6628** |
| B · WebGPU | 6.90 | 2.4351 | 0.0197 | **4.4452** |
| C · forceWebGL | 7.10 | 3.1920 | 0.0170 | **3.8910** |

`c0` absorbs the P2 1×1 readback (about 1.5 ms) and the base sun. A reading measured without that
readback must subtract the same overhead on the base point before comparing, or use the same
readback. Comparing a model in these units to a vsync-clamped 16.7 ms rAF median is invalid.

## M-series prediction for the named World

World: **Untitled project**, `project:f924b61c…`, 31 Walls, 10 Rooms. Fixed Stage view:

| Counter | Stage | Visit |
| --- | ---: | ---: |
| Draws `D` | 64 | 58 |
| Triangles `T` | 44,937 | 25,203 |
| Unshadowed lights `L` (beyond the sun) | 2 (1 ambient + 1 extra directional) | 2 |
| Shadow passes `P` | 0 | 0 |

Substituting the A constants:

```
Stage  S = 5.6628 + 0.0006753·64 + 9.943e-7·44,937 + 0.19636·2 = 6.14 ms
Visit  S = 5.6628 + 0.0006753·58 + 9.943e-7·25,203 + 0.19636·2 = 6.12 ms
```

| Backend | Stage prediction | Visit prediction | ±30 % band (Stage) |
| --- | ---: | ---: | --- |
| A · WebGLRenderer | 6.14 ms | 6.12 ms | 4.30–7.99 ms |
| B · WebGPU | 5.20 ms | 5.15 ms | 3.64–6.75 ms |
| C · forceWebGL | 4.63 ms | 4.58 ms | 3.24–6.02 ms |

B predicts faster than A despite costing more per draw because the World submits only 64 draws;
A's fixed cost is higher on this backend pair. The difference is small and inside the band overlap
between all three.

**This prediction is intercept-dominated.** `c0` is 92 % of A's Stage value; the World's 64 draws
and 45 k triangles contribute only 0.09 ms. A Gate C reading can confirm the bookkeeping and the
fixed cost, but it cannot validate the per-draw or per-triangle slopes at this scale. The reference
estimate below is the slope test.

## Cinematic reference (arithmetic, not built)

Same formula, reference counts: `D = 6,600`, `T = 9,000,000`, `L = 12`, one shadow-casting
directional with `P = 1` pass over ≈6,600 casters. The shadow constant was fitted at 1,000 and 5,000
casters, so this scales it linearly by 6.6 — an assumption, labelled [A].

| Backend | draw | triangles | lights | shadow | `c0` | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A | 4.46 | 8.95 | 2.36 | 1.51 | 5.66 | **22.9 ms** |
| B | 16.07 | 14.76 | 3.12 | 6.75 | 4.45 | **45.2 ms** |
| C | 21.07 | 12.73 | 2.80 | 5.30 | 3.89 | **45.8 ms** |

All three exceed 16.7 ms. The estimate omits texture sampling for 120 2K maps and the 40-material
mix, so it is a lower bound, not a complete reference-frame cost. It is also the arithmetic case for
the assessment's point: the reference is a work-elimination problem. Instancing collapses `D` by
orders of magnitude; making the same 6,600 submissions faster does not reach the budget.

## Gate C protocol

The goal is to test the model, not to demonstrate a renderer. Gate C remains the owner's decision;
this protocol is the reading that decision would need.

### Device and session

1. Record the device: model, chip, memory, OS, browser version, GPU string, DPR, power source and
   battery/thermal state. Use one browser session per device, with the tab visible.
2. Run the P2 page **on that device, in that session**, before the World reading. All three backends,
   about 20 minutes. Recompute `c0` and the constants from that device's base row; do not reuse the
   M2 JSON for an Iris Xe laptop.
3. Keep power and thermal state unchanged between P2 and the World reading. A laptop that switches
   to battery or throttles mid-run invalidates the comparison.

### Same World, same views, same counters

4. Open the same World (`Untitled project`, 31 Walls, 10 Rooms), at the same fixed Stage view used in
   P1. Record `__BISKIQ_CENSUS_READ__('stage')`: draws, triangles, programs, lights by type,
   shadow-casting lights, shadow casters, shadow maps, materials/meshes, textures and bytes.
5. Enter the same visitor view (the draft Experience used in P1) and record
   `__BISKIQ_CENSUS_READ__('preview')` with the same fields.
6. If any counter differs from the P1 table, use the new counts in the formula and say so. Do not
   compare a 64-draw prediction to a frame that renders a different count.

### Same timing definition

7. Measure `S` with the P2 definition: 30 warm-up frames, then 24 synchronized samples (1×1
   `readPixels` for WebGL, `onSubmittedWorkDone()` for WebGPU), median. Do not compare the model to
   a `requestAnimationFrame` median on a vsync-clamped display; if rAF is the only reading, report
   CPU submit and GPU time separately and mark the comparison inconclusive.
8. Compare `S_model` with `S_measured` for each backend. The proposed band is **±30 %**. Report the
   signed residual, not only pass/fail.

### What the residual means

- Model too low: texture sampling, material count, culling differences, or a shadow caster count
  above the fitted range.
- Model too high: the ambient/extra-directional lights are cheaper than the point-light constant, or
  the frame culls more than the P1 view did.
- Residual inside the band on this World only confirms the fixed cost and count bookkeeping. The
  reference estimate is the separate slope check; it remains arithmetic until that scene is built.

### Devices and a reduced phone sweep

Required: the M2 laptop (this record) and one Iris Xe-class Windows laptop, as the assessment asks.
A phone is optional.

If a phone is added, run 16 configurations instead of 62, roughly 2–3 minutes: base; N=1,000 and
5,000 separate; instanced at both; batched at 1,000; 8/32/64 point lights at 1,000; 16/32 at 5,000;
2/8 shadowed lights at 1,000; cached 2/4 at 1,000; the 4→5-light compile step. That keeps the
submission, light, shadow and compile questions and drops the triangle, material, spot, map-size and
10,000-draw sweeps.

## Limits

- One device so far. The constants are an M2 direction, not a device-class fact.
- `cLight` is a **point**-light constant. The World's ambient and second directional light are priced
  as points, which likely overestimates them; the model has no directional or ambient term yet.
- No texture, material-count or culling term. The World's 2 textures and 34 materials are small; the
  reference's 120 maps are not.
- `c0` includes the P2 readback and the base sun, so it is not a pure engine constant.
- The per-draw fit is the weakest of the three (A R² 0.943). Inter-run variation in `cDraw` of up to
  about 2× was observed; the ±30 % band is wider than one run's noise but not a guarantee.
- The 64-light point is outside the linear range and is excluded from budgets. Do not extrapolate
  `cLight` past 32 lights.
- This model says nothing about visual quality, post-processing, or whether a WebGPU trial is
  desirable. It prices counts on the measured backends only.
