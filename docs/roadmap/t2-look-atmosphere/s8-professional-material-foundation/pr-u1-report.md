# T2.S8 U1 — production material thumbnails

**Status:** implementation complete on `claude/production-material-thumbnails-0f165e`, based on
`main@343112640` (after #399). Review-ready; **not merged**.

U1 replaces the shelf's flat colour swatches with real, lit, deterministic pictures of each Finish,
rendered by the real E7 inspection host. Recipe `sample-tile/1` is a front-on plane window sized in
physical metres, lit by a sky ramp, a horizontal strip light (which gives metals their sheen band)
and a raking key.

## Decisions

- **Recipe, not a screenshot.** `sample-tile/1` is a versioned inspection recipe on the E7 host
  (`inspection-host.ts`), not a second renderer. E7's engineering references and recipes are
  unchanged: the tile key (`tile-<hash>`) covers recipe, inspection and lighting versions,
  recipeKey, framing, size and exposure, so it cannot collide with an E7 key. Any rig constant
  change requires a `sample-tile/2` bump; the E7 lighting version was deliberately not bumped.
- **Framing hints live outside the recipe.** `materialThumbnailFraming` (21 hints) is a presentation
  table: a window in metres plus a centre in tile fractions. Without a hint the window is 40 % of the
  smaller tile edge, clamped to 0.05–2 m. The Finish binds with `metricBasis` = the window.
- **One 256 px master per Finish; responsive sizes derive from it.** XS 64 (central 62.5 % crop),
  S 112, M 256 (the master). The edge is chosen by CSS px × DPR (clamped 1–3): the smallest edge
  that is at least the need, else M. Full-resolution textures are never opened to browse; the
  inspection host fetches only the maps the recipe binds.
- **Catalogue masters are committed**, with a key-validated manifest
  (`material-tiles.json`, 21 PNGs in `static/material-tiles/`). A stale master is detected by key
  and falls back to a host render, else to the swatch. `scripts/generate-material-tiles.mjs` runs
  twice and requires identical bytes.
- **Project and private-library Finishes** render on demand through the Stage-mounted
  `FinishTileRenderer`, which builds an inspection host on the Stage's existing renderer per
  renderer generation. The service (`finish-tiles.svelte.ts`) caches in memory only: masters (LRU 64),
  pictures (LRU 192), object URLs revoked on forget and dispose. Project pictures are namespaced by
  texture scope. Only successes are cached; a failure returns null and the swatch stays.
- **G contract extended.** The private thumbnail PNG edge cap is 256 (a cap, not exact), max
  256 KiB; 192 px items stay valid. 257 is refused. API and editor tests cover 192, 256 and 257.
- **D1 concrete.** Smooth and Polished concrete are one card with a Matte/Polished chip
  (`materialVariantCards`, `variantCardOf`). F's distinctness rule applies between cards, so the
  one failing pair is intentionally one card.
- **Shelf size is 32 CSS px** (the dock height constrains it); Retina is served from the 64/112
  derivatives at 2×/3×.

## Acceptance (U's five criteria, real E7 host, both backends)

Evidence: `evidence/s8-u1-acceptance-webgpu.json` and `evidence/s8-u1-acceptance-webgl2.json`,
produced by `scripts/u1-acceptance.mjs <webgpu|webgl2> <dir>` against the dev host.

| Criterion | WebGPU | WebGL2 |
| --- | --- | --- |
| Pairs failing F's rule (mean patch ΔE00 < 3 and luminance SSIM > 0.95), 210 pairs | 1 (`concrete-smooth` / `concrete-polished`, ΔE00 0.64, SSIM 0.996) | same 1 (ΔE00 0.64) |
| Same sweep on XS 64 / S 112 derivatives | same single pair at each size | same single pair at each size |
| Clipping (any channel at 255), max across 21 tiles | 0.20 % (< 1 %) | 0.20 % |
| Colour fidelity, hue/chroma ΔE vs. swatch, max | 5.56 (leather) | 5.56 |
| Backend agreement | numbers match to the third decimal | |

The single failure is the D1 pair and is one card by design, so **all distinct cards pass**. The
watch pairs: stainless satin/brushed ΔE00 2.57, SSIM 0.78 (passes on SSIM); plaster/matte plastic
3.62 (passes); brass/gold 4.57; linen/carpet 3.43. Stainless variants and plaster/plastic, which E7
flagged, are separated by sheen and texture here.

Recognisability at display size and narrow layouts were checked by eye in focused browser QA on the
shelf (brick courses, oak grain, linen weave, brushed vs. satin metal read at 32 px and 2×).
Private-library compatibility is covered by the contract tests above (192 and 256 both accepted).
Colour fidelity uses the swatch mean as reference, so it is approximate (leather 5.6, walnut 4.7).

## Verification run

- `npm run check` (editor): 0 errors (17 warnings, pre-existing `non_reactive_update` etc.).
- `npm run check:project-model`: pass.
- `npm run test:arch`: all pass; four tests timed out only when the full lane ran under load and pass
  in isolation. One real failure fixed: the light-realizer allow-list now admits the second
  directional light in the sample-tile rig.
- `npm run test:fast`: 6050 tests; 14 failed only by 5 s/15 s timeouts under machine load and all
  pass when re-run with a longer timeout; none touch thumbnails.
- `npm run build`: passes. The `/p/[publicationId]` visitor module closure (48 files) contains no
  sample-tile, finish-tiles, FinishTile, catalogue-tiles or inspection-host code.
- Focused tests: `sample-tile`, `sample-tile-derivatives`, `catalogue-tiles`, `finish-tiles`,
  `material-presentation`, `inspection-host` (sample tile) and material-library suites; API
  `material-library.test.mjs`.

Cold load, cache reuse, recipe change and failure behaviour are covered by `finish-tiles.test.ts`
(master fetch only on first need, cache hit with no second render, key change on recipe or framing
change, null on host refusal with the swatch retained, revocation on forget/dispose).

## Limitations

- The cache is memory only. There is no persistent cache for project Finish pictures.
- Private-library items keep whatever thumbnail the server returns. U1 makes the contract accept a
  256 px master; nothing here renders and uploads one automatically.
- A project-Finish picture on the shelf is unit-tested and verified on the dev host, but was not
  exercised in the product shell (a local session cannot create one without the cloud "From image"
  path).
- XS/S derivation uses canvas in the browser; the acceptance script sweeps them with `sharp` as a
  stand-in for the same crop and resample.
- `svelte-check` still warns about `stageInput` and similar `non_reactive_update` cases in the
  spatial page; these predate this PR.
