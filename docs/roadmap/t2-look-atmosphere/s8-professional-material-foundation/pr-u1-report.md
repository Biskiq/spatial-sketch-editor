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

## Review follow-up

1. **Cache lifecycle.** The service now hands out *leases* (`lease`, `leaseNow`) instead of bare
   URLs. A picture leaving the LRU, a scope forget or a dispose revokes its object URL at once if no
   tile holds it, and at the last `release()` if one does; a tile's picture is never pulled from
   under it. A draw still in flight when its picture is evicted, forgotten or disposed makes no URL
   at all, so nothing can leak. Shared work is cancelled only when its last holder leaves: one
   cancelled tile no longer fails a draw another tile still wants, and an abandoned draw is
   forgotten so the next ask starts fresh.
2. **Stale thumbnails.** `FinishTile` clears the previous picture in the same effect run that sees
   a new source, takes an already-made picture synchronously (no empty frame on a parent re-render),
   drops late or out-of-order answers by abort, and releases what it holds on every change and on
   unmount.
3. **Rendering pressure.** The host already runs one render lane with a 128-job queue and per-job
   texture leases held only to readback. The service now also bounds its own draws to
   `FINISH_TILE_RENDER_CONCURRENCY` (2) in flight; a shelf's remaining Finishes wait in the
   service, and a tile that leaves before its turn is never drawn. Catalogue tiles never reach the
   host (committed masters), so only project Finishes queue.
4. **Product-shell QA.** In the editor (`/project/u1qa/spatial?create=1`, WebGPU): placed a box,
   recoloured its Painted Plaster to `#b5472c`, which creates the project Finish "Painted Plaster
   2". Library › Finishes then showed that Finish as a rendered 64 px picture (blob URL) beside the
   catalogue tiles, with no console errors. Eight rapid Matte/Polished clicks on the concrete card
   ended with exactly one `<img>` for the chosen variant.

Regression tests: `finish-tiles.test.ts` (lifecycle block: evicted-and-unheld revoked, evicted-and-held
kept until release, no URL leaked after 230 Finishes plus dispose, forget/dispose mid-draw, one
cancel vs. shared draw, last-holder cancel and retry, `leaseNow`, 60-Finish shelf peak ≤ 2, queued
tile that left is never drawn) and `finish-tile.test.ts` (new, jsdom: clears at once, out-of-order
answers, rapid switching, cached picture with no empty frame, release and cancel on unmount).
Re-verified: `npm run check` 0 errors; `test:arch` 358/358; the full default editor suite
529 files / 6552 tests with a 120 s timeout; `npm run build` passes and the visitor closure is
still clean.

## Independent review follow-up (lease lifetime)

An independent review at `8873e3f4c` confirmed two lifetime defects in `finish-tiles.svelte.ts`,
each reproduced by a regression test that failed before the fix:

1. **Dispose revoked held leases.** `dispose()` revoked every object URL, including ones a tile
   still showed, contradicting the lease contract ("valid until `release()`"). The route's
   `onDestroy` can run before child tiles release, so a still-mounted `<img>` could lose its
   source. Fix: dispose now retires entries exactly as eviction does — unheld URLs are revoked at
   once, held ones at their last release; draws are still cancelled and new leases refused. The
   earlier test that asserted the old behaviour now releases before disposing.
2. **Eviction cancelled awaited draws.** LRU retirement aborted any unsettled job, so a shelf of
   more than 192 project Finishes requested at once lost its oldest requests (null → swatch only),
   and the picture job also refused to finish once its entry was marked dead. Fix: eviction only
   cancels a draw nobody waits for; an evicted draw with waiters completes, its lease is taken and
   its URL revoked at the last release. Forget and dispose still cancel unconditionally (their
   textures are gone). Leases awaiting a picture are counted (`waiters`), so a picture retired
   between its draw settling and its waiter taking it is neither revoked under that waiter nor
   leaked if the waiter declines it.

New tests (`finish-tiles.test.ts`, lifecycle block): held lease survives dispose and is revoked at
release; a 230-Finish shelf over the 192 limit gets every picture with no draw aborted and no URL
leaked; a picture evicted mid-draw is served, absent from the cache, and revoked exactly at its
release. Adjacent paths inspected with no further defects: draw-slot queue and abort, renderer
register/unregister and epoch retry, scope forget, shared master jobs, and `FinishTile`'s
switch/cancel/release effect.

Verification: `npm run check` 0 errors (17 pre-existing warnings); `test:arch` 38 files / 358
tests; focused materials + Finish tile suites 22 files / 353 tests; `test:fast` 482 files / 6066
tests.

## Limitations

- The cache is memory only. There is no persistent cache for project Finish pictures.
- Private-library items keep whatever thumbnail the server returns. U1 makes the contract accept a
  256 px master; nothing here renders and uploads one automatically.
- XS/S derivation uses canvas in the browser; the acceptance script sweeps them with `sharp` as a
  stand-in for the same crop and resample.
- `svelte-check` still warns about `stageInput` and similar `non_reactive_update` cases in the
  spatial page; these predate this PR.
