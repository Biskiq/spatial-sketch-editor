# PR B · Sample a Finish on either backend (E2 + E7 rendering core)

**Status: ready for review.** Base `d6291c2a` on branch `t2/s8-pr-b-material-sampling`; this report
accompanies the review follow-up commit. The full review report is kept outside the repository in the
worktree's git metadata; every finding below is either fixed in this diff or recorded as a measurement
this machine cannot take.

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
- Raw material maps are validated from container headers before a decoder allocates a bitmap
  (8-bit PNG/JPEG/WebP, supported channels, identity EXIF orientation, static, untagged or sRGB PNG).
- The studio rig, channel readback, offscreen inspection, request coalescing and fixed thumbnail
  contract are in place; the bench now draws through `CanvasHost` and the production readback path.

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
| 12. Evidence cannot establish the PR B exit gates | **Partially measured, recorded here.** The bench uses `CanvasHost` and the production readback path, and capture comparison fails on a missing or mismatched capture. The residency and live-highlight rows are unmeasured on this host. | `s8-bench` route, `BenchReadback.svelte`, `capture-s8-pixel-baseline.mjs`, this report |

## Gates and observations

| B gate | Observed | Status |
| --- | --- | --- |
| Colour/data rejection of one source under two roles | Colour byte 128 reads ≈0.216 and raw ≈0.502 in either load order | Pass (unit + pixel cases) |
| Opaque sampling through catalogue, primitives/Forms, Walls, Room floor/lid, Region top/underside | Retained representations and the appearance oracle use the same descriptor and view path | Pass (unit and oracle cases) |
| Imported transparency in *Model's own*, Stage/snapshot parity | Existing model realization and snapshot oracles remain green | Pass (existing suites) |
| Budget refusal without a partial lease | A full set that cannot fit returns `texture-budget` with required/available bytes and disposes pending uploads | Pass (`finish-views.test.ts`) |
| Scope switch during decode, generation loss after upload, one of two users releasing, preview closing during readback | Cancellation, generation-mismatch and exact-entry release cases | Pass (`finish-views.test.ts`, `inspection.test.ts`) |
| Row orientation on both backends | WebGL2 fallback and WebGPU are distinguished by the observed backend; asymmetric readback covers the flip; the 12-case chart captured on both observed backends | Pass |
| 192×192 studio highlight, roughness 0.2 vs 0.8 | Requires a live GPU canvas; this host exposes only headless SwiftShader WebGL2 and no WebGPU adapter | **Unmeasured** |
| 128/192/256/384 MiB working-set ceiling and 4096² transient headroom | Requires the #385 reference machine on each actual backend | **Unmeasured**; v1 constant remains the provisional 256 MiB |
| Linear patch interiors, 1/255 tolerance, rotated/mirrored UV1 normals, transparent raw RGB and alpha | 12-case pixel compare against the frozen chart on both observed backends; largest mean channel difference 2.175/255 | Pass on both observed backends; dedicated mirrored-UV1 normal pixel row unmeasured |
| Bench readback | Wired to the production probe; not clicked manually in this pass | Not manually observed; code path is unit-tested |

## Checks run locally

| Command | Result |
| --- | --- |
| `npm run check` | 0 errors; 16 pre-existing editor warnings |
| `npx vitest run tests/lib/render` | 530 passed / 61 files |
| `npm run test:arch` | 352 passed / 38 files |
| `npm run check:project-model` | pass |
| `npm run build` | pass |
| S8 pixel compare, 12 cases | pass on both observed backends; max mean channel Δ 2.175/255 |
| `git diff --check` | clean |

CI owns the full merge gate: the required `merge gate`, `check guards` and `linux-x64` checks plus the
suite matrix. No assertion was weakened for a pass.

## Unmeasured rows and next evidence

1. **Working-set ceiling.** The pixel chart observed both backends on the Apple M2 through explicit
   Chromium launch flags (WebGL2 through ANGLE/SwiftShader, WebGPU through Metal). The plan's
   128 → 384 MiB step test and the 4096² transient allocation were not run, and the default headless
   environment exposes no WebGPU adapter. The code keeps the 256 MiB v1 constant explicitly
   provisional; adoption requires the reference machine's two-backend residency result.
2. **Studio calibration at 192 px.** The roughness-0.2/0.8 highlight gate (≥1.1× peak, smaller
   half-peak area, <1% clipping) needs a live GPU draw. The rig is frozen and versioned; the gate stays
   open.
3. **Dedicated normal-map and mirrored-UV1 GPU pixels.** Unit and chart coverage exist, but no
   dedicated GPU-backed pixel capture of the mirrored UV1 mesh or the opposed normal-sign chart was
   taken on this host.

These are recorded as unmeasured, not passed. They do not change the source contracts, which are
covered by the unit and architecture suites above.
