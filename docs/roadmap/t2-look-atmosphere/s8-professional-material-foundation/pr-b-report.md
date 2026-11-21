# PR B · Sample a Finish on either backend (E2 + E7 rendering core)

**Status: NOT ACCEPTED, merge on hold.** Base `d6291c2a` on branch `t2/s8-pr-b-material-sampling`.
The source contracts, lifecycle fixes and measurement harness are in place, and every confirmed code
defect is fixed. Three B gates have not passed: the studio highlight gate **failed** at both the
nominal rig and the one permitted half-radiance retry, on both hardware backends. The linear-target
sampling-fidelity chart (which includes the mirrored-UV1 and normal-sign pixels) and real-session
source peaks are **unmeasured**. Adopting the residency ceiling waits on an owner decision. Failed
and unmeasured gates are recorded as such here and are not waived.

## Result

- A Finish plan is sampled through one node-material graph on catalogue materials, Scene primitives
  and Forms, Wall sides, Room floors and lids, Region faces, and imported model remaps.
- Colour and data are separated before decode:
  - colour decodes as sRGB, while normals and scalars decode as raw channels;
  - rows are uploaded top-first;
  - the origin is converted once, at the sample boundary;
  - there is no second stock-map multiply.
- Finish views are owned by their generation:
  - a Canvas replacement retires only that Canvas's views;
  - a route teardown frees its views without waiting for budget pressure;
  - a lease always releases the exact entry it acquired;
  - a view still leased at teardown stays alive until its final release. The source cache hands its
    disposal duty to the view cache rather than disposing the texture itself (review R1).
- Shared source IO is reference-counted by waiter. A cancellation releases one interest. The final
  waiter aborts the shared fetch/decode and removes the in-flight cache entry.
- A cold release resolves allowlisted shipped raw maps through a fetch, the same header probe and the
  same identity decode as the editor. Private P20 bytes remain a separate map, and an unknown static
  path is never fetched.
- A Finish-view acquisition treats its supplied `{owner, generation}` token as admission proof:
  - a token that is already stale, or becomes stale during a load, is refused before it leases or
    uploads anything;
  - an independent Canvas owner is unaffected.
- Raw material maps are validated from container headers before a decoder allocates a bitmap:
  - 8-bit PNG, JPEG or WebP with a supported channel layout;
  - identity EXIF orientation;
  - static images only;
  - PNG must be untagged or sRGB.
- JPEG ICC admission (review R4): a JPEG ICC profile is admitted only when all of these hold:
  - the tag table is well-formed;
  - its v2 `desc` or v4 `mluc` description names sRGB;
  - every matrix colorant it carries matches the sRGB D50 primaries within 0.005.

  A wide-gamut profile that merely calls itself sRGB is refused, and an untagged JPEG remains supported.
- The studio rig, channel readback, offscreen inspection, request coalescing and fixed thumbnail
  contract are in place.
- Source memory is reported separately from GPU residency:
  - `textureSourceMemoryStats()` reports live compressed-source bytes, estimated decoded RGBA8 CPU
    bytes, and an independent peak for each;
  - a loader that cannot report its compressed bytes contributes zero rather than a fabricated
    estimate;
  - decoded bytes are an RGBA8 estimate from the image dimensions, not browser heap accounting.
- The dev-only `/dev/s8-gates` route and `scripts/run-s8-gates.mjs` script:
  - run the residency staircase and the 192 px highlight gate;
  - run on hardware WebGPU and on hardware WebGL2 (ANGLE Metal, with WebGPU hidden from the page);
    SwiftShader is optional and recorded as software;
  - write evidence to `evidence/s8-b-gates.json`.

## Independent review (this pass)

The review covered the whole slice, starting from head `bdca633a`. Each concern raised in the brief
was verified independently. The fixes are in this commit.

| # | Severity | Finding | Outcome | Regression / evidence |
| --- | --- | --- | --- | --- |
| R1 | High | **Two owners dispose the same texture at teardown.** Both product teardowns (`project-texture-scope`, `visitor-texture-scope`) call `releaseFinishViewsForScope` and then `releaseTextureScope`. The first marks a still-leased view `retired` and promises to dispose it on its final release. The second disposed every cached `top` source in the scope, including that leased texture. A live draw could then sample a disposed texture, the backend would silently re-upload it outside the budget, and the final release disposed it a second time. | **Fixed.** `releaseFinishViewsForScope` detaches a leased entry's source from the texture store (`detachFinishTexture`), so the view cache becomes its only owner. Idle views and other sources are disposed as before. | `finish-views.test.ts`: "keeps a leased view alive through the full product teardown". It fails on the old code (disposed while leased) and passes with the fix. |
| R2 | High (evidence) | **The 4096² residency transient uploaded only its base level.** `DataTexture` defaults to `generateMipmaps=false` with Nearest filtering, so the "~85.3 MiB mip chain" was a 64 MiB single level. The harness also recorded no allocation error or recovery signal. | **Fixed.** `createResidencyTransient()` requests a full trilinear chain. Each step records levels expected and observed (WebGPU `mipLevelCount`; WebGL `TEXTURE_IMMUTABLE_LEVELS`), plus allocation errors from WebGPU error scopes or WebGL `getError`/context loss. All 13 levels were observed at every step on both hardware backends. | `s8-gate-metrics.test.ts` transient case; `s8-b-gates.json` `transientLevelsObserved` |
| R3 | High (evidence) | **The "WebGL2" gate ran on SwiftShader.** `--disable-features=WebGPU` does not hide WebGPU in headless Chromium, and the previous runner used SwiftShader for WebGL2. Neither run qualified the M2 GPU on WebGL2. | **Fixed.** The WebGL2 case now uses `--use-angle=metal` and hides `navigator.gpu` from the page before load. The observed adapter is `ANGLE (Apple, ANGLE Metal Renderer: Apple M2…)`, and the page's renderer reports `webgl2`. SwiftShader is optional (`S8_GATE_INCLUDE_SOFTWARE=1`) and is flagged as software. | `run-s8-gates.mjs`; adapter strings in `s8-b-gates.json` |
| R4 | Medium | **ICC v4 `mluc` offsets were read as profile-absolute.** ICC.1 §10.15 makes record offsets relative to the start of the tag. Every standard v4 sRGB JPEG was therefore refused, and a crafted record could borrow text from elsewhere in the profile. Admission also trusted the description string alone, so a Display-P3 matrix profile named "sRGB" was admitted. | **Fixed.** Offsets are tag-relative and bounded inside the tag (record count 1–64, even length 2–1024). Admission also requires any `rXYZ`/`gXYZ`/`bXYZ` colorants to match sRGB D50. | `image-encoding.test.ts`: v4 `mluc` admitted (fails on old code); out-of-tag record refused; P3-named-sRGB refused (fails on old code) |
| R5 | Medium (evidence) | **The highlight metrics read clipped 8-bit pixels.** Peak ratio and half-peak area were computed from final sRGB bytes, so the 0.2 peak saturated at 1.0 (the reported ratio of 1.328 was a clipped value). "Clipped" also counted channels ≥250 rather than exact 255. | **Fixed.** Peak and connected half-peak area are now read from a half-float linear target drawn through the same lease and studio. Clipping is read from the final sRGB frame at exactly 255, and ≥250 is recorded separately as near-clip. The verdict combines the two readings. | `s8-gate-metrics.test.ts` linear/sRGB cases; `s8-b-gates.json` `linear[]` |
| R6 | Medium (evidence overclaim) | **A gate row reported "Pass" for a chart that was never captured.** The row for linear patch interiors at 1/255, rotated/mirrored UV1 normals and transparent raw cited the 12-case product-canvas pixel compare. That compare is a 512 px screenshot regression oracle against a self-recorded baseline, with tolerance 3/255 and a mean of up to 2.175/255. It is not the plan's linear-target fidelity chart: 1/255 interiors, AO under separate direct and indirect lighting, normal sign under opposed grazing lights, mirrored and rotated UV1, both request orders, and instrumented sample and upload counts. | **Corrected.** The gate is now recorded as unmeasured; the 12-case compare is kept as a regression oracle only. | Gates table below |
| R7 | Low (open) | The plan requires closing decoded bitmaps after their final owner. Successful `ImageBitmap`s are closed only on late or error paths; after the final release they are left to GC. Variant clones share the bitmap, so closing it needs final-owner tracking across clones. | **Open.** Not fixed in this pass: it is a lifecycle change across shared sources, and no B gate measures it. Owner B/E follow-up. | `texture-store.ts` raw loader; `visitor-texture-scope.ts` |
| R8 | Low (note) | Wide-gamut refusal applies only to raw roles in B. Colour-role checks for new professional sets belong to E's import path. | No change in B (scope). | — |

Earlier uncommitted work on this branch has not been adopted. It switched the inspection to a
half-float target with an ACES Filmic output transform (`INSPECTION_VERSION` 2). That departs from the
plan's thumbnail recipe ("exposure 1, output sRGB") and its fallback rule, so it is an owner decision
(option C below). It is preserved in the local stash, not on the branch.

## Review follow-up (previous rounds)

| Finding | Outcome | Evidence |
| --- | --- | --- |
| 1. S4 prepare suppresses a sampled Finish | **Fixed.** Prepare and active consumers share one verified project read, each decode policy keeps its own result, and a pin change still supersedes both. | `project-texture-scope.test.ts` prepare/sample join and pin-change cases |
| 2. Budget drops accounting while GPU allocation survives | **Fixed.** Zero-reference views stay charged, eviction disposes the upload, scope teardown releases its own views, and an exact lease cannot delete a newer entry. | `finish-views.test.ts` eviction, teardown and old-generation cases |
| 3. Inspection readback inverted on WebGL2 fallback | **Fixed.** The backend is observed, not requested, and an asymmetric readback proves the row flip. | `inspection.test.ts` WebGL2/WebGPU orientation cases |
| 4. One Canvas resets another Canvas's leases | **Fixed.** Generations are owned per Canvas host. Advancing one host retires only its own views and never refuses another host's in-flight acquisition. | `finish-views.test.ts` two-Canvas recovery case; `CanvasHost.svelte` owner token |
| 5. Cancelled or unrelated requests hold up active loads | **Fixed.** Cancelled waiters leave immediately, queues are per scope, and shared IO aborts when its final waiter leaves. | `finish-views.test.ts` cancellation/budget cases; `texture-store.test.ts` shared-IO cases |
| 6. Raw policy applied after browser decoding | **Fixed.** Every raw loader probes the container first, and the raw policy never falls back to the colour-managed loader. | `image-encoding.test.ts`; project scope and visitor raw cases |
| 7. Imported remaps retain an old graph or another scope's texture | **Fixed.** The model style key includes the Finish plan and slot URIs, and imported remaps take part in the view signature. | `scene-render-description` style key; `material-store.test.ts` imported-remap case |
| 8. Model qualification assumes UV0 before the GLB arrives | **Fixed.** The adapter binds provisionally, and `model-realization` re-checks the actual draw UV sets and normal frame. | `model-realization.test.ts` explicit UV0/UV1 and missing-UV1 cases |
| 9. Normal maps disappear as the camera moves closer | **Fixed.** Identity UV0 uses mesh tangents and handedness. Derivative frames use a scale-relative singularity test. | `finish-sampling.test.ts` tangent and near-singular cases |
| 10. Replaced inspection requests publish stale pixels | **Fixed.** Submission advances the serial, the active draw is cancelled, and terminal results are gated on the current serial and generation. | `inspection.test.ts` replacement and stale-result cases |
| 11. Studio bake places lights opposite the specified directions | **Fixed.** `directionFor` is the inverse of Three r187's `equirectUV`. | `inspection.test.ts` studio direction case |
| 12. Evidence cannot establish the PR B exit gates | **Superseded by R2, R3, R5 and R6.** | Gates table below |
| 13. Cold Visitor cannot load shipped raw maps | **Fixed.** A raw role checks the private release-byte map first. An allowlisted shipped URI is fetched only after the registry check and is probed before decode. | `visitor-cold-runtime.test.ts` shipped-raw and unknown-static cases |
| 14. A stale Canvas token is admitted at the latest generation | **Fixed.** `acquireFinishViews` validates the supplied generation before any reuse, decode or upload. | `finish-views.test.ts` stale-entry, generation-change and two-Canvas cases |
| 15. JPEG ICC profiles are silently accepted | **Fixed, then corrected by R4** (`mluc` offsets and colorant check). | `image-encoding.test.ts` |
| 16. Bench readback is unreachable and loops | **Fixed.** The control now sits outside `CanvasHost`, and the rebuild effect untracks its writes. | `CanvasHost.svelte`, `BenchReadback.svelte`, `s8-bench/+page.svelte` |
| 17. Separate compressed-source and decoded-CPU peaks are absent | **Implemented and unit-tested.** | `texture-store.test.ts`; `texture-store.ts` |

## Gates and observations

| B gate | Observed | Status |
| --- | --- | --- |
| Colour/data rejection of one source used under two roles | Colour byte 128 reads ≈0.216 and raw ≈0.502, in either load order | Pass (unit cases) |
| Opaque sampling through catalogue, primitives/Forms, Walls, Room floor/lid, Region top/underside | Retained representations and the appearance oracle use the same descriptor and view path | Pass (unit and oracle cases) |
| Imported transparency in *Model's own*, Stage/snapshot parity | Existing model-realization and snapshot oracles remain green | Pass (existing suites) |
| Budget refusal without a partial lease | A full set that cannot fit returns `texture-budget` with required and available bytes, and disposes pending uploads | Pass (`finish-views.test.ts`) |
| Scope switch during decode, generation loss after upload, one of two users releasing, preview closing during readback, teardown with a live lease | Cancellation, generation-mismatch, exact-entry release and full-teardown cases | Pass (`finish-views.test.ts`, `inspection.test.ts`) |
| Cold Visitor shipped raw maps | Allowlisted fetch, header probe and identity decode; unknown static paths make zero fetches | Pass (`visitor-cold-runtime.test.ts`) |
| Row orientation on both backends | The backend is observed, and an asymmetric readback covers the flip | Pass (unit) |
| **192×192 studio highlight, roughness 0.2 vs 0.8** | Both hardware backends (and SwiftShader) gave the same readings. **Nominal:** linear peak 3.91 vs 0.762 (ratio 5.13); half-peak area 811 vs 7,360 px; **11.6%** of subject pixels clipped at 255. **Half radiance:** ratio 5.13, 4.2% clipped. Exploratory scales, recorded but not adopted: 0.25 gives 0.0% clipped (linear 0.2 peak 0.978, 0.9% near-clip); 0.2 gives 0.0% clipped. | **FAILED.** Peak ratio and area pass; clipping fails at both permitted rigs on both backends. Per the plan, B holds. |
| 128/192/256/384 MiB working set at DPR 1 and 1.5 per backend, plus the 4096² RGBA8 full-chain transient | Hardware WebGL2 (ANGLE Metal, M2) and WebGPU (Metal, M2) each completed every step at both DPRs. Estimated view bytes were 134,217,696 / 201,326,544 / 268,435,392 / 402,653,088. Each step uploaded a transient of 89,478,484 bytes with 13 of 13 levels observed. There were no allocation errors and no context or device loss. In the final run (2026-11-21 UTC, host heavily loaded), steady upload took ≤206 ms and the transient ≤56 ms. | **Measured: largest passing step is 384 MiB on both backends. Ceiling not adopted.** Adoption waits on an owner decision (see below). The v1 constant stays at 256 MiB. |
| Separate compressed-source and decoded-CPU peaks | Instrumentation reports both peaks; unit cases cover scoped loads, invalidation and teardown | **Implemented. Real-session peaks are unmeasured.** |
| **Linear-target sampling-fidelity chart:** 1/255 patch interiors, AO under separate direct and indirect light, normal sign under opposed grazing lights, mirrored and rotated UV1, both request orders, transparent raw RGB and alpha, instrumented sample and upload counts | Not captured. The 12-case product-canvas compare (512 px screenshot, tolerance 3/255, max mean Δ 2.175/255) is a regression oracle and does not measure these. | **UNMEASURED** |

## Gate harness

The dev-only route is `apps/editor/src/routes/dev/s8-gates/+page.svelte`, and the runner is
`apps/editor/scripts/run-s8-gates.mjs`. Start a dev server for this checkout, then run from the
repository root:

```bash
S8_GATE_EXPLORE=0.25,0.2 S8_GATE_INCLUDE_SOFTWARE=1 node apps/editor/scripts/run-s8-gates.mjs \
  --out docs/roadmap/t2-look-atmosphere/s8-professional-material-foundation/evidence/s8-b-gates.json
```

The two gate modes:

- **`?gate=residency`:**
  - uses the real Finish-view cache and lease path;
  - adds the full-chain 4096² transient at each step;
  - observes allocation errors and the mip levels actually allocated.
- **`?gate=highlight`:**
  - leases its material from `MaterialStore`;
  - reads clipping from the production 192 px sRGB readback;
  - reads peak and half-peak area from a half-float linear draw of the same scene.

Additional radiance scales passed in `S8_GATE_EXPLORE` are recorded under `exploratory`. They are
never adopted and never change the verdict. The pure metrics live in `lib/dev/s8-gate-metrics.ts`.

## Checks run locally

| Command | Result |
| --- | --- |
| `npm run check` | 0 errors; 16 pre-existing warnings |
| `npm run test:fast` | 5,656 passed, 1 failed: `stage-paper` "unions thousands of sampled 1000m Wall bands" timed out at 15 s. The host's load average was about 100 from Spotlight and storage indexing. Rerun alone, it passes. The test is untouched by this diff. |
| `npx vitest run tests/lib/render tests/lib/visitor tests/lib/dev` | 651 passed, 3 timed out under the same load: the `light-realizer-boundary` and `material-factory-boundary` source scans, at 5 s. Rerun alone, all 25 tests in those files pass. |
| `npm run test:arch` | 354 passed in 38 files, after fixing a doc-path reference in this report |
| `npm run check:project-model` | pass |
| `npm run build` | pass |
| `node apps/editor/scripts/run-s8-gates.mjs` (hardware WebGL2, WebGPU, SwiftShader) | 9 of 9 cases captured. Residency: 384 MiB passed on every backend at both DPRs with 13 of 13 transient levels. Highlight: clipping fails at nominal and half radiance on every backend. |
| `git diff --check` | clean |

CI owns the full merge gate. No assertion was weakened to make a check pass.

## Deliberate deviations

- **The ceiling is not adopted automatically.** See open gate 2.
- **JPEG ICC admission checks the description and the matrix colorants.** It does not evaluate TRC
  curves. Treating an sRGB-named profile with sRGB primaries as sRGB is the stated admission rule.
- **Cold shipped raw bytes are fetched rather than added to the private release map.**
- **Decoded CPU bytes are an estimate, not a heap measurement**, and compressed bytes are reported
  only when a loader has them.
- **The gate route uses product seams**, and the product recipe's studio radiance stays at 1.
- **Source formats are unchanged.** Scene 11 and resources 2 remain the admitted formats.

## Open gates and decisions

1. **Studio highlight: FAILED, owner decision required.** The plan's rule is to hold B if neither the
   nominal nor the half-radiance rig passes, and neither did on either backend. Options:
   - **A. Hold B as is.** Studio calibration happens outside this PR.
   - **B. Approve a quarter-radiance (0.25×) studio as a new versioned inspection recipe.** This is
     the recommended option. It keeps the "exposure 1, output sRGB" recipe and Canvas parity, and at
     0.25 clipping is 0.0% while ratio and area still pass on both backends. The 0.25 margin is thin
     (linear 0.2 peak 0.978); 0.2× gives more headroom. The version would be recorded for G, and the
     gate rerun as a normal attempt.
   - **C. Approve an ACES Filmic inspection output transform** (the stashed work). This changes the
     thumbnail recipe and parity with Canvas output.
   - **D. Redefine the clip gate.** Not recommended.
2. **Ceiling adoption: owner decision required.** 384 MiB passed on both hardware backends at both
   DPRs, with the full transient. Under the plan's rule that would make the v1 ceiling 384 MiB. It is
   not adopted in code yet, for two reasons. The plan does not define a numeric timing threshold, so
   "no timing failure" here means only that each step completed without error well inside the
   harness's 20 s step budget. And this host is assumed to be the #385 reference machine, the Apple
   M2 recorded in `e0-environment.json`, but that has not been confirmed. Recommendation: confirm the
   machine and accept "completed without allocation error or loss" as the recovery criterion, then
   adopt 384 MiB.
3. **Linear-target sampling-fidelity chart: unmeasured.** This covers the mirrored and rotated UV1
   and opposed-light normal-sign pixels, AO direct/indirect, 1/255 interiors and the sample/upload
   counts. `two-uv-glb.glb` exists, but the calibration capture does not.
4. **Real-session source peaks: unmeasured.**
5. **R7 bitmap closing: open** (low, no gate).
