# PR B · Sample a Finish on either backend (E2 + E7 rendering core)

**Status: review follow-up and measurement harness complete; merge on hold.** Base `d6291c2a` on
branch `t2/s8-pr-b-material-sampling`. This report accompanies the follow-up diff after `2f89c781`.
Every code finding below is fixed in this diff; unavailable measurement gates are recorded as
unmeasured or failed, not as passes.

## Result

- A Finish plan is sampled through one node-material graph on catalogue materials, Scene primitives and
  Forms, Wall sides, Room floors/lids, Region faces and imported model remaps.
- The texture path separates colour from data before decode: sRGB colour, raw channels for normals and
  scalars, top-first upload rows, one origin conversion at the sample boundary, and no second stock-map
  multiply.
- Finish views are generation-owned: a Canvas replacement retires only that Canvas's views, a route
  teardown frees its views without waiting for budget pressure, and a lease always releases the exact
  entry it acquired.
- Shared source IO is reference-counted by waiter. A cancellation releases one interest; the final
  waiter aborts the shared fetch/decode and removes the in-flight cache entry.
- A cold release resolves allowlisted shipped raw maps through fetch plus the same header probe and
  identity decode as the editor; private P20 bytes remain a separate map, and an unknown static path
  is never fetched.
- A Finish-view acquisition treats its supplied `{owner, generation}` token as admission proof. A token
  that is already stale, or becomes stale during a load, is refused before it leases or uploads
  anything; an independent Canvas owner is unaffected.
- Raw material maps are validated from container headers before a decoder allocates a bitmap
  (8-bit PNG/JPEG/WebP, supported channels, identity EXIF orientation, static, untagged or sRGB PNG).
  A JPEG ICC profile is admitted only when its profile description identifies the standard sRGB space;
  an unverified or wide-gamut profile is refused, while an untagged JPEG remains supported.
- The studio rig, channel readback, offscreen inspection, request coalescing and fixed thumbnail
  contract are in place. The bench now publishes the observed renderer to a control outside the
  Threlte DOM and draws through the production readback path; manual 192 px readbacks report
  `webgl2 192x192` and `webgpu 192x192`.
- Source memory is reported separately from GPU residency. `textureSourceMemoryStats()` exposes live
  compressed-source bytes, estimated decoded RGBA8 CPU bytes, and independent peaks for each. A
  loader that cannot report its compressed bytes contributes zero rather than a fabricated estimate;
  decoded bytes are an RGBA8 dimension estimate, not browser heap accounting.
- Scope teardown now aborts in-flight source reads, removes source and variant entries, disposes
  uploaded textures and drops material-load promises. Historical peaks survive teardown; live totals
  return to zero. The cold Visitor uses a narrow release wrapper so its module never imports the
  texture-store source token.
- A dev-only `/dev/s8-gates` route and `scripts/run-s8-gates.mjs` run the residency staircase and the
  192 px highlight gate on whatever backend Chromium actually obtains. They record the adapter name
  and mark software adapters rather than treating SwiftShader as the M2 GPU. Evidence from this host
  is in `evidence/s8-b-gates.json`.

## Review follow-up

| Finding | Outcome | Evidence |
| --- | --- | --- |
| 1. S4 prepare suppresses a sampled Finish | **Fixed.** Prepare and active consumers share one verified project read; each decode policy keeps its own result; a pin change still supersedes both. | `project-texture-scope.test.ts` prepare/sample join and pin-change cases |
| 2. Budget drops accounting while GPU allocation survives | **Fixed.** Zero-reference views stay charged, eviction disposes the upload, scope teardown releases its own views, and an exact lease cannot delete a newer entry. | `finish-views.test.ts` eviction, teardown and old-generation cases |
| 3. Inspection readback inverted on WebGL2 fallback | **Fixed.** Backend is observed, not requested; asymmetric readback proves the row flip. | `inspection.test.ts` WebGL2/WebGPU orientation cases |
| 4. One Canvas resets another Canvas's leases | **Fixed.** Generations are owned per Canvas host; advancing one host retires only its views and never refuses another host's in-flight acquisition. | `finish-views.test.ts` two-Canvas recovery case; `CanvasHost.svelte` owner token |
| 5. Cancelled/unrelated requests hold up active loads | **Fixed.** Cancelled waiters leave immediately, queues are per scope, and shared IO aborts on its final waiter. | `finish-views.test.ts` cancellation/budget cases; `texture-store.test.ts` shared-IO cases |
| 6. Raw policy applied after browser decoding | **Fixed.** Every raw loader probes the container first; the raw policy never falls back to the colour-managed loader. | `image-encoding.test.ts`; project scope and visitor raw cases |
| 7. Imported remaps retain an old graph or another scope's texture | **Fixed.** The model style key includes the Finish plan and slot URIs; imported remaps participate in the view signature. | `scene-render-description` style key; `material-store.test.ts` imported-remap case |
| 8. Model qualification assumes UV0 before the GLB arrives | **Fixed.** The adapter binds provisionally and `model-realization` re-checks the actual draw UV sets and normal frame. Explicit UV0 and UV1 are exercised through `realizeModel` on real `uv`/`uv1` attributes. | `model-realization.test.ts` explicit UV0/UV1 and missing-UV1 cases |
| 9. Normal maps disappear as the camera moves closer | **Fixed.** Identity UV0 uses mesh tangents and handedness; derivative frames use a scale-relative singularity test. | `finish-sampling.test.ts` tangent and near-singular cases |
| 10. Replaced inspection requests publish stale pixels | **Fixed.** Submission advances the serial, the active draw is cancelled, and terminal results are gated on the current serial and generation. | `inspection.test.ts` replacement and stale-result cases |
| 11. Studio bake places lights opposite the specified directions | **Fixed.** `directionFor` is the inverse of Three r187's `equirectUV`; the baked directions are tested through the consumer mapping. | `inspection.test.ts` studio direction case |
| 12. Evidence cannot establish the PR B exit gates | **Measured where this host supports it; open/failed gates recorded here.** The dev harness now runs the real Finish-view cache through all four residency targets and the production 192 px studio readback on both observed backends. Residency completes at 384 MiB estimated on both, but has no GPU-memory reading; the highlight gate fails its clipping check at nominal and half radiance on both. Mirrored-UV1 normal pixels remain unmeasured. Nothing here is claimed as a qualified ceiling or a passed highlight gate. | `s8-gates` route, `run-s8-gates.mjs`, `s8-b-gates.json`, this report |
| 13. Cold Visitor cannot load shipped raw maps | **Fixed.** A raw role looks in the private release-byte map first; an allowlisted shipped URI is fetched only after the registry check and is probed before decode. Unknown static paths still refuse without a fetch. Warm Plaster and Walnut roughness maps are the regression fixture. | `visitor-cold-runtime.test.ts` shipped-raw and unknown-static cases |
| 14. A stale Canvas token is admitted at the latest generation | **Fixed.** `acquireFinishViews` validates the supplied generation before reuse, decode or upload. A stale-at-entry token returns `generation-mismatch` with zero loads; a token that advances during load still aborts; another owner's generation does not refuse this one. | `finish-views.test.ts` stale-entry, generation-change and two-Canvas cases |
| 15. JPEG ICC profiles are silently accepted | **Fixed.** An ICC-tagged raw JPEG is admitted only when the ICC description identifies standard sRGB; unverified, Adobe RGB, Display P3 and malformed profiles return `unsupported-image-encoding`. Untagged JPEG remains admitted. | `image-encoding.test.ts` sRGB/Display P3/Adobe RGB cases |
| 16. Bench readback is unreachable and loops | **Fixed.** The readback button was rendered inside Threlte's hidden DOM, and its rebuild effect read and wrote `material`. The control now sits outside `CanvasHost`, the host publishes an optional renderer-state callback, and the effect tracks its inputs while untracking the rebuild. Manual 192 px readbacks succeed on both observed backends. | `CanvasHost.svelte`, `BenchReadback.svelte`, `s8-bench/+page.svelte`; manual `webgl2 192x192`, `webgpu 192x192` |
| 17. Separate compressed-source and decoded-CPU peaks are absent | **Implemented and unit-tested.** `textureSourceMemoryStats()` reports live and peak values independently; invalidation and scope release subtract live bytes without erasing peaks, and the raw Finish map records actual fetched bytes plus its 256×256 decoded size. Decoded bytes are explicitly an RGBA8 estimate, not browser heap. | `texture-store.test.ts` scoped peaks, invalidation, teardown and raw-byte cases; `texture-store.ts` |

## Gates and observations

| B gate | Observed | Status |
| --- | --- | --- |
| Colour/data rejection of one source under two roles | Colour byte 128 reads ≈0.216 and raw ≈0.502 in either load order | Pass (unit + pixel cases) |
| Opaque sampling through catalogue, primitives/Forms, Walls, Room floor/lid, Region top/underside | Retained representations and the appearance oracle use the same descriptor and view path | Pass (unit and oracle cases) |
| Imported transparency in *Model's own*, Stage/snapshot parity | Existing model realization and snapshot oracles remain green | Pass (existing suites) |
| Budget refusal without a partial lease | A full set that cannot fit returns `texture-budget` with required/available bytes and disposes pending uploads | Pass (`finish-views.test.ts`) |
| Scope switch during decode, generation loss after upload, one of two users releasing, preview closing during readback | Cancellation, generation-mismatch and exact-entry release cases | Pass (`finish-views.test.ts`, `inspection.test.ts`) |
| Cold Visitor shipped raw maps | Warm Plaster and Walnut roughness maps load through the allowlisted fetch, header probe and identity bitmap options; unknown static paths make zero fetches | Pass (`visitor-cold-runtime.test.ts`) |
| Stale Canvas admission | A stale token is refused before any load or lease; a generation change during load is refused; an independent owner proceeds | Pass (`finish-views.test.ts`) |
| Row orientation on both backends | WebGL2 fallback and WebGPU are distinguished by the observed backend; asymmetric readback covers the flip; the 12-case chart captured on both observed backends | Pass |
| 192×192 studio highlight, roughness 0.2 vs 0.8 | Production readback at 192 px on both observed backends. Nominal radiance ratio 1.328/1.315, half 2.658/2.622; the 0.2 half-peak component is smaller in every run. Clipping fails: 11.77%/11.79% at nominal and 4.30%/4.30% at half, against `<1%`. No rig variant is adopted. WebGL2 is ANGLE/SwiftShader, so the both-hardware-backend qualification is also unavailable. | **Failed / unmeasured** — no studio variant meets the clipping gate; the WebGL2 result is software |
| 128/192/256/384 MiB working-set ceiling and 4096² transient headroom | The dev harness steps the real Finish-view cache through all four estimated targets and adds a 4096² RGBA8 transient at each step. SwiftShader and WebGPU Metal both completed 384 MiB estimated + transient with recovery; measured estimated bytes were 134,217,696 / 201,326,544 / 268,435,392 / 402,653,088. There is no device GPU-memory reading, so this does not establish a ceiling; the WebGL2 result is software. | **Unmeasured** — harness observation only; v1 remains provisional 256 MiB |
| Separate compressed-source and decoded-CPU peaks | Instrumentation now reports both peaks independently. Unit cases exercise scoped loads, invalidation and teardown; a raw Finish map reports actual fetched source bytes and a 256×256 RGBA8 decoded estimate. No production profile session with real project assets was run here, and legacy `TextureLoader` paths have no compressed-byte count. | **Implemented; synthetic peaks verified. Real-session peaks unmeasured** |
| Linear patch interiors, 1/255 tolerance, rotated/mirrored UV1 normals, transparent raw RGB and alpha | 12-case pixel compare against the frozen chart on both observed backends; largest mean channel difference 2.175/255 | Pass on both observed backends; dedicated mirrored-UV1 normal pixel row unmeasured |
| Bench readback | Manual clicks now reach the production probe and report `webgl2 192x192` and `webgpu 192x192`; the earlier zero-size control and effect loop are fixed | Observed; this is tooling, not the 192 px calibration gate |

## Gate harness

The dev-only route is `apps/editor/src/routes/dev/s8-gates/+page.svelte`; the runner is
`apps/editor/scripts/run-s8-gates.mjs`. From the repository root, with the dev server running:

```bash
node apps/editor/scripts/run-s8-gates.mjs \
  --out docs/roadmap/t2-look-atmosphere/s8-professional-material-foundation/evidence/s8-b-gates.json
```

The runner launches Chromium for each observed backend, opens both gate modes, waits for the page's
real renderer, and records the adapter string. `?gate=residency` uses the actual Finish-view cache and
lease path; `?gate=highlight` uses a `MaterialStore` lease and the production 192 px readback. The
pure metrics are in `lib/dev/s8-gate-metrics.ts` and are covered by `s8-gate-metrics.test.ts`.

Observed on 2026-11-21 (`evidence/s8-b-gates.json`):

- **WebGPU:** `apple metal-3`, no software flag. **WebGL2:** `ANGLE (Google, Vulkan 1.3.0
  (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)`, marked as software.
- **Residency:** both observed backends completed all four estimated targets (24/36/48/72 views;
  134,217,696 / 201,326,544 / 268,435,392 / 402,653,088 bytes) and the 4096² transient at each step,
  including DPR 1 and 1.5. This is a cache-allocation observation, not a GPU-memory ceiling; there is
  no device memory reading in Chromium here.
- **Highlight:** nominal peak ratios were 1.328 (SwiftShader) and 1.315 (Metal); half-radiance ratios
  were 2.658 and 2.622. The half-peak component was smaller at 0.2 in every run. Clipping failed every
  run: 11.77%/11.79% at nominal, 4.30%/4.30% at half, against `<1%`. No radiance variant was adopted,
  and the gate stays failed. Because WebGL2 is SwiftShader, the both-hardware-backend requirement is
  also unmet.

## Checks run locally

| Command | Result |
| --- | --- |
| `npm run check` | 0 errors; 16 pre-existing editor warnings |
| `npm run test:fast` | 5,649 passed / 456 files |
| `npx vitest run tests/lib/render/resources/texture-store.test.ts tests/lib/render/resources/project-texture-scope.test.ts tests/lib/visitor/visitor-cold-runtime.test.ts tests/lib/dev/s8-gate-metrics.test.ts` | 54 passed / 4 files |
| `npx vitest run tests/lib/render tests/lib/visitor` | 642 passed / 74 files |
| `npm run test:arch` | 354 passed / 38 files |
| `npm run check:project-model` | pass |
| `npm run build` | pass |
| S8 pixel compare, 12 cases | pass on both observed backends; max mean channel Δ 2.175/255 |
| `node scripts/run-s8-gates.mjs` | 6/6 cases captured; residency completed 384 MiB estimated; highlight failed clipping on both observed backends |
| Manual `/dev/s8-bench` readback | `webgl2 192x192`, `webgpu 192x192` (tooling observation, not the calibration gate) |
| `git diff --check` | clean |

CI owns the full merge gate: the required `merge gate`, `check guards` and `linux-x64` checks plus the
suite matrix. No assertion was weakened for a pass.

## Deliberate deviations

- **The 256 MiB ceiling is not measurement-adopted.** The plan requires the smaller largest passing
  step from the two actual backends. That experiment is unavailable here, so the v1 constant remains
  256 MiB and is labelled provisional rather than presented as qualified.
- **JPEG ICC admission is conservative.** Raw roles now admit an ICC profile only when its description
  identifies standard sRGB. A standard sRGB-tagged JPEG remains supported and untagged JPEG is still
  admitted; an unverified profile is refused with a re-export action instead of being silently
  decoded. This is stricter than accepting every ICC profile and narrower than parsing full profile
  colour primaries.
- **Cold shipped raw bytes are fetched, not added to the private release map.** The private P20
  `bytesByUri` boundary stays private; catalogue-implied maps load only through the append-only
  shipped allowlist, with a zero-fetch refusal for any other static path.
- **Decoded CPU bytes are an estimate, not heap.** The decoded peak is `width × height × 4` from the
  decoded image dimensions. It deliberately does not claim browser image-decode or GC heap usage.
- **Compressed bytes are reported only when a loader has them.** Raw fetch/scoped paths record the
  actual source length; a legacy `TextureLoader` path that never exposes a response body contributes
  zero instead of a fabricated ratio.
- **The gate route uses product seams.** It leases its highlight material from `MaterialStore`, reads
  the adapter from the initialized backend, and leaves the product recipe's studio radiance at 1. The
  optional `radianceScale` is used only for the gate's one half-radiance retry.
- **Source formats are unchanged.** Scene 11 / resources 2 remain the admitted format; D owns the
  incompatible cutover.

## Open gates and next evidence

1. **Working-set ceiling.** The 128/192/256/384 MiB harness now exists and completed every estimated
   step plus the 4096² transient on both observed backends, including DPR 1 and 1.5. It still cannot
   measure device GPU memory, and headless WebGL2 is ANGLE/SwiftShader rather than the Apple M2 GPU.
   The 256 MiB v1 constant remains explicitly provisional and is not qualified by this observation.
2. **Studio calibration at 192 px.** The production readback now runs at 192 px on both observed
   backends with the studio 0.2/0.8 pair. The gate fails its `<1%` clipping requirement at nominal and
   at the one allowed half-radiance retry (11.77–11.79% and 4.30–4.30%), while peak ratio and compact
   area pass. No rig variant is adopted. Qualifying the gate still needs both actual backends and a rig
   whose 0.2 highlight does not clip; this is a calibration/source decision, not a missing harness.
3. **Dedicated normal-map and mirrored-UV1 GPU pixels.** Unit and chart coverage exist, but no
   dedicated two-backend pixel capture of the mirrored UV1 mesh or the opposed normal-sign chart was
   taken. The `two-uv-glb.glb` oracle asset is present; the calibration harness is not.
4. **Compressed-source and decoded-CPU peaks.** The reporting and teardown release are implemented and
   unit-tested with synthetic loads. No real project-asset profile session was run here, and legacy
   loader paths without an exposed body have no compressed-byte count. Real-session peaks remain
   unmeasured; they are not inferred from the unit fixtures.

These are recorded as unmeasured, not passed. They do not change the source contracts, which are
covered by the unit and architecture suites above.
