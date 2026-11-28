# D8c.1 fixture probe

Test-only harness for the D8c fixture qualification. It builds the Salon and Gallery reference
Worlds through the real Layout planner and renders candidate GLBs through the real editor
renderer. Results and the qualified shortlist are in [`probe-report.md`](./probe-report.md).

Nothing here is production code or production asset data. Candidate GLBs are served from the
retention store outside the repository; no candidate bytes are committed.

## Prerequisites

- The acquisition tree from D8c.1:
  `/Users/tony/Documents/Biskiq/fixture-retention/acquisition/`, containing
  `<slug>/probe-source.glb`, `<slug>/probe-stripped.glb` and the source downloads.
- Editor dependencies installed (`npm ci` in `apps/editor`).
- Playwright's Chromium (provided by the editor's dev dependency).

## Serve the probe page

```sh
cd apps/editor
D8C_RETENTION=/Users/tony/Documents/Biskiq/fixture-retention/acquisition \
D8C_PROBE_PORT=5321 \
npx vite --config vite.d8c-probe.config.ts --host 127.0.0.1
```

Open `http://127.0.0.1:5321/tests/e2e/d8c-probe/index-fixture.html`. The config sets
`publicDir` to the editor's `static` directory, so the real fonts and material assets load.

## Capture the matrix

With the server running:

```sh
node tests/e2e/d8c-probe/capture.mjs
node tests/e2e/d8c-probe/capture-delta.mjs
```

`capture.mjs` writes the 45-scenario matrix (four candidates, Salon and Gallery close views,
WebGPU and WebGL2, source and stripped emission, On and Off, range) plus the alternate
bulb/mouth anchors. `capture-delta.mjs` adds the six qualified-candidate views. Images and
`capture-report.json` go to `evidence/`.

Headless WebGPU needs the Metal flags already set in the scripts:

```sh
--enable-unsafe-webgpu --enable-features=Metal --use-angle=metal
```

Do not poll `page.evaluate` while the renderer initializes: a repeated cross-process evaluate
starves headless Dawn and the WebGPU device is lost. The capture scripts wait 9 s and read the
probe record once.

## Measure highlight clipping

```sh
node tests/e2e/d8c-probe/exposure.mjs
```

Writes `evidence/exposure-metrics.json` with full-frame and centre-region clipped fractions (all
channels > 250) and mean luma for every close capture. It uses Playwright's Chromium as the
decoder, so no image dependency is added.

## Query parameters

`index-fixture.html` accepts:

| Parameter | Values |
| --- | --- |
| `candidate` | `hanging-industrial`, `lantern`, `modern-ceiling`, `wall-sconce` |
| `world` | `salon`, `gallery` |
| `view` | `room`, `close`, `range` |
| `emission` | `source`, `stripped` |
| `state` | `on`, `off` |
| `anchor` | `auto`, `mouth`, `bulb` |
| `kind` | `point`, `spot` |
| `intensity` | candela |
| `range` | metres |
| `angle` | spot half-angle, degrees |

`smoke.mjs` is a one-scenario check for the renderer connection:

```sh
D8C_CANDIDATE=hanging-industrial D8C_VIEW=close \
D8C_QUERY='&anchor=bulb&kind=point&intensity=3.141592653589793' \
node tests/e2e/d8c-probe/smoke.mjs
```

## Scenario data

`config.ts` owns the candidate metadata and the reference Worlds. The Worlds use the real
planner and real primitives; the test-owned ceiling box in each World exists only because the
generated room lid is an upward-facing plane that is invisible from inside. It uses the existing
`plaster-painted` material and 0.04 m thickness, and is part of the probe scenario, not the
editor.

`derive.mjs` creates the stripped-emission GLBs: it zeroes emissive factors, removes emissive
textures and drops `KHR_materials_emissive_strength`, while keeping
`KHR_materials_transmission` registered so the glass still renders.
