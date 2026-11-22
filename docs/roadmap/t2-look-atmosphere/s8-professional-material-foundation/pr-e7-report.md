# T2.S8 E7: material inspection and catalogue thumbnails

**Status:** implementation complete on `t2-s8-e7-inspection-thumbnails`, based on `main@45993c29`;
**not merged**. One [owner decision](#owner-decision) is open and no independent review has run.
Authority: [plan § F](./implementation-plan.md#f--inspect-materials-and-qualify-the-catalogue), E7
and the F exit. U is not started.

## Owner decision

**The studio thumbnails are very dark and hard to tell apart at shelf size (72×28).**
Painted Plaster (swatch `#d6d1cb`) renders at mean green 64/255 and peak 88, white ceramic at mean
70 and walnut at mean 16. The flat swatches they replace are more legible; see the
[shelf capture](./evidence/s8-e7-editor-shelf.jpg).

All 21 pictures have a centre mean of at most 69/255, darker than their #555555 background (85).
Cropped and scaled to the tile, the closest pairs differ by a mean of 0.9/255 (loop carpet and
linen), 1.4 (the two concretes) and 2.5 (white ceramic and matte plastic). The plan says an
indistinguishable entry fails catalogue intake. The gate does not measure that, so its 20 passes do
not settle that clause at tile size.

The likely cause is the studio v2 recipe frozen in [B](./pr-b-report.md) (base radiance 0.024):
F's board evidence under the same rig is equally dark, and the same draw path matches the Stage in
Current World. E7 does not change that recipe. The owner chooses one:

1. accept the pictures as they are;
2. keep colour swatches on the shelf until U, retaining the derivatives;
3. approve a brighter thumbnail recipe version, then regenerate.

## What E7 adds

- **Inspection host** (`src/lib/render/materials/inspection-host.ts`): one scheduler over the
  existing material factory, light realizer and Finish views, with cancellation, a bounded queue and
  cache, texel readings and renderer-generation recovery.
- **Subjects and World sampling** (`inspection-subject.ts`, `inspection-world.ts`): catalogue,
  accepted Finish or draft through `sceneFinishFor`; Sky, Paper, lights and Treatment at an anchor.
- **Frames at any size and geometry** (`inspection.ts`): keys include dimensions, geometry and the
  recipe versions.
- **21 reference derivatives**, their manifest, generator and stale-safe lookup, shown on the
  existing Finishes shelf with the swatch as fallback.
- **`/dev/materials`**: a real-project fixture and the in-browser F exit gate.
- **Two small shared seams**: an optional `clip: false` material descriptor, and one constants file
  for the Stage's neutral lights (same values).

F's catalogue, the engine, shaders, persistence and R2 are unchanged.

## Acceptance (F exit)

Chromium 153.0.8010.12: 20 of 20 checks pass on each of WebGPU and WebGL2.
[Recorded result](./evidence/s8-e7-gate.json).

| Requirement | Measured |
| --- | --- |
| Accepted Finish and corrected draft on each geometry | every tested display ready |
| Roughness 0.2 narrower and brighter than 0.8 | 5.124× brighter; half-peak component 809 vs 4538/4540 px; no clipping |
| Normal Y reverses the grazing response | +0.0704 / −0.0704 |
| Current World vs Stage, patch ΔE00 ≤ 2 | Sky max 0.544 WebGL2, 0.5507 WebGPU; Paper 0.2971, 0.3046 |
| UV orientation and metre spacing | all sampled checker points match; a half-metre tile repeats twice per metre |
| Derivatives across backends | max ΔE00 0.4306 on WebGL2, 0 on WebGPU |
| Absent UV1 | partial, never a thumbnail |
| Rapid switching and settled work | 40 requests give 1 draw of the last; settled gives 0 draws |
| Shelf opened and closed 20 times | 0 full-resolution fetches, 0 draws |
| Teardown mid-readback | nothing published; leases return to baseline |
| Device loss | resumes on generation 1 on the same backend |
| Project, history, Camera | unchanged |

Captures: [WebGPU World](./evidence/s8-e7-webgpu-world.jpg),
[WebGL2 World](./evidence/s8-e7-webgl2-world.jpg). Each backend logged only the provoked Device
Lost error. The real editor was spot-checked on a fresh project: 21 tiles, no texture fetch on
reopening and no console error.

Reproduce from `apps/editor`, with its dev server running:

```bash
S8_GATE_BASE_URL=http://localhost:5176 node scripts/run-s8-e7-gate.mjs
```

## Verification

Local evidence, run after the last code change:

- `npm run check`: 0 errors, 16 baseline warnings.
- `npm run build`: pass. The built `/` and `/p/[publicationId]` contain no host or thumbnail code.
- `test:arch`: 38 files, 358 tests pass.
- `test:fast`: 473 files, 5,842 tests pass with `--maxWorkers=3 --testTimeout=60000`.
- `npm test` and `test:heavy` were not run locally; CI certifies them.

## Deviations and limits

- **192×192** is the versioned reference size by owner clarification, not a fixed API size.
- **No product inspection UI.** The host's only consumer is `/dev/materials`; U owns the UX. The
  20-opening check uses that page's shelf list, not the editor's popover.
- **Stage comparison.** Fog is removed for the reading, the Stage sphere has 32×24 segments against
  inspection's 48×32, and Current World has no cast shadows or occluders.
- **Sphere orientation sampling** accepts points with facing ≥ 0.2 (plane and block 0.6) and covers
  3 of the checker's 8 colours; plane and block cover all 8.
- **Device loss is provoked.** On WebGPU the gate destroys the device and delivers the loss report
  itself, because Three drops a self-caused one. On WebGL2 it takes the product's Retry.
- **CIEDE2000 reference values** in the unit test (Sharma et al.) were entered from memory and not
  compared with the published table. They agree with the implementation.
- **Derivatives are generated on WebGPU**; WebGL2 is held by patch tolerance, not byte identity.
- **The shelf crops** each square picture to a centre band, as project tiles do.
- **G's `uploadFinishThumbnail`** still accepts only 192×192 frames.
- **`MaterialPreviewItem.svelte`** is unused now that the old dev page is replaced. It is left in
  place for a separate removal.
