# T2.S8 E7: material inspection and catalogue thumbnails

**Status:** implementation complete on `t2-s8-e7-inspection-thumbnails`, based on `main@45993c29`;
**not merged**. F's catalogue distinctness criterion **failed and is deferred to U by the owner**.
The automated technical checks pass; they are not acceptance of F's catalogue intake.
Authority: [plan § F](./implementation-plan.md#f--inspect-materials-and-qualify-the-catalogue). U is
not started.

## Ownership and the deferred criterion

E7 owns inspection correctness, rendering infrastructure and reference derivatives. U owns final
thumbnail appearance, responsive card design, display-size readability and visual presentation.

The [owner-approved deferral](./implementation-plan.md#owner-approved-deferral-catalogue-distinctness-2026-11-21)
of 2026-11-21 does not waive F's rule. [Measured](./evidence/s8-e7-distinctness.json) on the 192 px
references, three pairs fail it (mean patch ΔE00 < 3 with luminance SSIM > 0.95):

- smooth and polished concrete: 0.27, 0.994;
- satin and brushed stainless: 1.18, 0.979;
- painted plaster and matte plastic: 1.98, 0.973.

F does not define the patch or window, so the evidence gives two readings. The same pairs fail in
both; under a maximum-patch reading only the concretes fail. No entry has a clipped subject pixel.

The references also fail visually as product thumbnails. All 21 have a centre mean luma of at most
68/255, darker than their #555555 background (85); Painted Plaster (swatch `#e7e1d7`) renders at
mean green 64/255. Two causes apply: the frozen studio v2 lighting (base radiance 0.024) and, in
this branch's first version, the crop of a sphere into a 72×28 shelf band
([capture of that withdrawn shelf](./evidence/s8-e7-editor-shelf.jpg)). The [shelf keeps colour
swatches](./evidence/s8-e7-editor-swatches.jpg), which avoids the dark pictures but does not cure
distinctness: the two concretes share `#bababa` and the two stainless entries share `#d6d1cb`, so
only their labels differ. The [swatch treatment](./implementation-plan.md#first-deliverable-of-u-swatch-treatment)
is U's first deliverable, with its technique TBD for dedicated planning in U's design. U must
complete the [revalidation list](./implementation-plan.md#thumbnail-revalidation-required-in-u).

## What E7 adds

- **Inspection host** (`src/lib/render/materials/inspection-host.ts`): one scheduler over the
  existing material factory, light realizer and Finish views, with cancellation, a bounded queue and
  cache, texel readings and renderer-generation recovery.
- **Subjects and World sampling** (`inspection-subject.ts`, `inspection-world.ts`): catalogue,
  accepted Finish or draft through `sceneFinishFor`; Sky, Paper, lights and Treatment at an anchor.
- **Frames at any size and geometry** (`inspection.ts`): keys include dimensions, geometry and the
  recipe versions.
- **21 engineering reference derivatives**, their manifest, generator and stale-safe lookup. No
  product surface shows them; the Finishes shelf is unchanged from `main`.
- **`/dev/materials`**: a real-project fixture and the in-browser technical checks.
- **Two small shared seams**: an optional `clip: false` material descriptor, and one constants file
  for the Stage's neutral lights (same values).

F's catalogue, the engine, shaders, persistence and R2 are unchanged.

## Automated technical checks

These are **not complete F acceptance**. They do not measure distinctness between entries, catalogue
clipping, display-size readability, or F's density and budget records.

Chromium 153.0.8010.12: 20 of 20 technical checks pass on each of WebGPU and WebGL2.
[Recorded result](./evidence/s8-e7-gate.json).

| Requirement | Measured |
| --- | --- |
| Accepted Finish and corrected draft on each geometry | four displays reach ready (readiness, not appearance) |
| Roughness 0.2 narrower and brighter than 0.8 (synthetic drafts) | 5.124× brighter; half-peak component 809 vs 4538/4540 px; no clipping |
| Normal Y reverses the grazing response (synthetic ± chart on a plane, not each set) | +0.0704 / −0.0704 |
| Current World vs Stage, 7 sphere patches, ΔE00 ≤ 2 | Sky max 0.544 WebGL2, 0.5507 WebGPU; Paper 0.2971, 0.3046 |
| UV orientation and metre spacing | all sampled checker points match; a half-metre tile repeats twice per metre (plane only) |
| Derivatives across backends | max ΔE00 0.4306 on WebGL2, 0 on WebGPU |
| Absent UV1 | partial, never a thumbnail |
| Rapid switching and settled work | 40 requests give 1 draw of the last; settled gives 0 draws |
| Dev reference list opened and closed 20 times | 0 full-resolution fetches, 0 draws |
| Teardown mid-readback | nothing published; leases return to baseline |
| Device loss | resumes on generation 1 on the same backend |
| Project, history, Camera | unchanged |

Captures: [WebGPU World](./evidence/s8-e7-webgpu-world.jpg),
[WebGL2 World](./evidence/s8-e7-webgl2-world.jpg). Each backend logged only the provoked Device
Lost error. The real editor was spot-checked on a fresh project: 21 swatch tiles, no reference
derivative requested and no console error.

Reproduce from `apps/editor`, with its dev server running:

```bash
S8_GATE_BASE_URL=http://localhost:5176 node scripts/run-s8-e7-gate.mjs
```

## Verification

Local evidence, run after the last code change:

- `npm run check`: 0 errors, 16 baseline warnings.
- `npm run build`: pass. In the client build only the `/dev/materials` node contains the host or the
  reference lookup.
- Regenerating the references left all 21 PNGs byte-identical.
- `test:arch`: 38 files, 358 tests pass.
- `test:fast`: 473 files, 5,843 tests pass with `--maxWorkers=3 --testTimeout=60000`.
- `npm test` and `test:heavy` were not run locally; CI certifies them.

## Deviations and limits

- **192×192** is the versioned reference size by owner clarification, not a fixed API size.
- **No product inspection UI.** The host's only consumer is `/dev/materials`; U owns the UX. The
  20-opening check uses that page's reference list, not the editor's shelf.
- **Stage comparison.** Fog is removed for the reading, the Stage sphere has 32×24 segments against
  inspection's 48×32, and Current World has no cast shadows or occluders.
- **Sphere orientation sampling** accepts points with facing ≥ 0.2 (plane and block 0.6) and covers
  3 of the checker's 8 colours; plane and block cover all 8.
- **Device loss is provoked.** On WebGPU the gate destroys the device and delivers the loss report
  itself, because Three drops a self-caused one. On WebGL2 it takes the product's Retry.
- **CIEDE2000 reference values:** the unit test's 15 pairs were compared with the authors' published
  test data and match. The other 19 published pairs are not in the test.
- **Derivatives are generated on WebGPU**; WebGL2 is held by patch tolerance, not byte identity.
- **The references deploy unused:** 576 KiB of PNGs under `static/`, with no product consumer until U
  decides.
- **G's private library** accepts only 192×192 uploads from the editor, and at most 192 px and
  256 KiB at the API, in one slot. The proposed U masters do not fit it as built.
- **`MaterialPreviewItem.svelte`** is unused now that the old dev page is replaced. It is left in
  place for a separate removal.
