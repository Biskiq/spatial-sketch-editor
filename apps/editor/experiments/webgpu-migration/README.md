# WebGPU migration · PR 1 and PR 2 harnesses

Owner-run evidence for the approved T2 WebGPU migration. **Nothing here is
shipped**: the tree is outside `apps/editor/src` and no route imports it. The PR 1
harnesses compare against native WebGL through their own isolated scenes; the PR 2
runner drives the shipped one-renderer product route.

## Run

```sh
cd apps/editor
npm run webgpu:qualify   # r187 API / lifecycle probes, ~30 s
npm run webgpu:perf      # matched A/B/C gallery, ~3 min
npm run webgpu:evidence  # both
node experiments/webgpu-migration/pr2-product.mjs --backend=webgpu --dpr=1
node experiments/webgpu-migration/pr2-product.mjs --backend=webgl2 --dpr=1.5
```

The runner bundles `api/main.ts` with esbuild, serves it from a loopback HTTP
origin (WebGPU requires a secure context) and drives branded Chrome through
Playwright. It writes `qualification.json`, `performance.json` and
`environment.json` to
`docs/roadmap/t2-look-atmosphere/webgpu-renderer-migration/evidence/<date>/`.
The PR 2 runner drives the shipped published route from the ordinary production
build: two fresh browser processes × five cleared-cache contexts, a warm
re-entry, a real pointer orbit and one device-loss recovery per backend/DPR.
`--backend=webgl2` hides `navigator.gpu` in the page so Three's automatic
selection takes its WebGL2 fallback with no product toggle; the observed backend
is asserted from the initialized renderer. `PR2_SKIP_BUILD=1` reuses the last
production build. It writes `pr2-product-<backend>-dpr<dpr>.json` and one
screenshot per row to the same evidence directory.

None of this is part of `npm test`, CI, or the product build.

## What is measured

- **A** `WebGLRenderer` (the shipped native path).
- **B** `WebGPURenderer` with native WebGPU selected.
- **C** `WebGPURenderer` forced to its WebGL2 backend.

The backend is read from the initialized renderer; a B row that obtained WebGL2
fails the harness. The gallery is 1280 × 720 at DPR 1, 12 × 7 m with six
textured wall quads, one shadowed Sun and a frozen interior camera. Animation
intervals are a presentation-opportunity proxy, not scanout. Synchronized
columns include a GPU wait/readback and are diagnostics, not displayed frames.

## Files

- `api/qualification.ts` — initialization, one-core identity, simultaneous
  devices/shared textures, projection/scissor, TSL clip and Artwork shadow
  masks, wide lines, stencil, colour/readback, pipelines and loss.
- `api/performance.ts` — startup, three 10-second steady windows, shadow and
  light-variant deltas.
- `lifecycle/` — stock-Canvas and ready-gated Canvas candidates sharing one
  generation owner and `CanvasLifecycle`.
- `baseline/fixtures.json` — frozen commit, packages, S0 poses, asset hashes,
  publication protocol and the explicitly unfrozen current-world item.

The tests that hold the frozen behaviour live in
`apps/editor/tests/lib/render/` (`webgpu-*`).
