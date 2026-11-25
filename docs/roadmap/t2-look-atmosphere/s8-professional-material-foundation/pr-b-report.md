# PR B · Sample a Finish on either backend (E2 + E7 rendering core)

**Status: ACCEPT (independent verdict below), not merged.** Branch `t2/s8-pr-b-material-sampling`.
Every B gate has now passed with reproducible evidence, on hardware WebGPU and hardware WebGL2 (Apple
M2), under the two owner decisions of 2026-11-20 recorded below. The closing pass also fixed one new
defect (null-scope Finish-view eviction) and closed review item R7 (decoded bitmaps now close after
their final owner).

## Owner decisions (2026-11-20, final)

1. **Studio recipe v2 (0.2× radiance).** The studio rig is a new versioned inspection recipe:
   `INSPECTION_LIGHTING_VERSION = 2`, with base, key and fill radiances at 0.2× of v1. Exposure 1, sRGB
   output and the strict highlight gates are unchanged. The version is part of the thumbnail key, so
   every v1 thumbnail is invalidated. v1 clipped 11.6% (nominal) and 4.2% (half); those results stay
   recorded as the failed v1 attempt.
2. **Finish-view budget stays at 256 MiB for v1.** 384 MiB passed the residency staircase on both
   hardware backends at DPR 1 and 1.5. That is recorded as **measured headroom**. Keeping the
   conservative 256 MiB ceiling below the largest passing step is an **owner-approved deviation** from
   the plan's "adopt the largest passing step" rule. `DEFAULT_FINISH_VIEW_BUDGET_BYTES` is unchanged.

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
  - run the residency staircase, the 192 px highlight gate and the linear-target fidelity chart;
  - run on hardware WebGPU and on hardware WebGL2 (ANGLE Metal, with WebGPU hidden from the page);
    SwiftShader is optional and recorded as software;
  - write evidence to `evidence/s8-b-gates.json`.

## Independent review (this pass)

The review covered the whole slice, starting from head `bdca633a`. Each concern raised in the brief
was verified independently. R1–R6 were fixed in `3ba1c804`; R7 and R9 were fixed in the closing pass.

| # | Severity | Finding | Outcome | Regression / evidence |
| --- | --- | --- | --- | --- |
| R1 | High | **Two owners dispose the same texture at teardown.** Both product teardowns (`project-texture-scope`, `visitor-texture-scope`) call `releaseFinishViewsForScope` and then `releaseTextureScope`. The first marks a still-leased view `retired` and promises to dispose it on its final release. The second disposed every cached `top` source in the scope, including that leased texture. A live draw could then sample a disposed texture, the backend would silently re-upload it outside the budget, and the final release disposed it a second time. | **Fixed.** `releaseFinishViewsForScope` detaches a leased entry's source from the texture store (`detachFinishTexture`), so the view cache becomes its only owner. Idle views and other sources are disposed as before. | `finish-views.test.ts`: "keeps a leased view alive through the full product teardown". It fails on the old code (disposed while leased) and passes with the fix. |
| R2 | High (evidence) | **The 4096² residency transient uploaded only its base level.** `DataTexture` defaults to `generateMipmaps=false` with Nearest filtering, so the "~85.3 MiB mip chain" was a 64 MiB single level. The harness also recorded no allocation error or recovery signal. | **Fixed.** `createResidencyTransient()` requests a full trilinear chain. Each step records levels expected and observed (WebGPU `mipLevelCount`; WebGL `TEXTURE_IMMUTABLE_LEVELS`), plus allocation errors from WebGPU error scopes or WebGL `getError`/context loss. All 13 levels were observed at every step on both hardware backends. | `s8-gate-metrics.test.ts` transient case; `s8-b-gates.json` `transientLevelsObserved` |
| R3 | High (evidence) | **The "WebGL2" gate ran on SwiftShader.** `--disable-features=WebGPU` does not hide WebGPU in headless Chromium, and the previous runner used SwiftShader for WebGL2. Neither run qualified the M2 GPU on WebGL2. | **Fixed.** The WebGL2 case now uses `--use-angle=metal` and hides `navigator.gpu` from the page before load. The observed adapter is `ANGLE (Apple, ANGLE Metal Renderer: Apple M2…)`, and the page's renderer reports `webgl2`. SwiftShader is optional (`S8_GATE_INCLUDE_SOFTWARE=1`) and is flagged as software. | `run-s8-gates.mjs`; adapter strings in `s8-b-gates.json` |
| R4 | Medium | **ICC v4 `mluc` offsets were read as profile-absolute.** ICC.1 §10.15 makes record offsets relative to the start of the tag. Every standard v4 sRGB JPEG was therefore refused, and a crafted record could borrow text from elsewhere in the profile. Admission also trusted the description string alone, so a Display-P3 matrix profile named "sRGB" was admitted. | **Fixed.** Offsets are tag-relative and bounded inside the tag (record count 1–64, even length 2–1024). Admission also requires any `rXYZ`/`gXYZ`/`bXYZ` colorants to match sRGB D50. | `image-encoding.test.ts`: v4 `mluc` admitted (fails on old code); out-of-tag record refused; P3-named-sRGB refused (fails on old code) |
| R5 | Medium (evidence) | **The highlight metrics read clipped 8-bit pixels.** Peak ratio and half-peak area were computed from final sRGB bytes, so the 0.2 peak saturated at 1.0 (the reported ratio of 1.328 was a clipped value). "Clipped" also counted channels ≥250 rather than exact 255. | **Fixed.** Peak and connected half-peak area are now read from a half-float linear target drawn through the same lease and studio. Clipping is read from the final sRGB frame at exactly 255, and ≥250 is recorded separately as near-clip. The verdict combines the two readings. | `s8-gate-metrics.test.ts` linear/sRGB cases; `s8-b-gates.json` `linear[]` |
| R6 | Medium (evidence overclaim) | **A gate row reported "Pass" for a chart that was never captured.** The row for linear patch interiors at 1/255, rotated/mirrored UV1 normals and transparent raw cited the 12-case product-canvas pixel compare. That compare is a 512 px screenshot regression oracle against a self-recorded baseline, with tolerance 3/255 and a mean of up to 2.175/255. It is not the plan's linear-target fidelity chart: 1/255 interiors, AO under separate direct and indirect lighting, normal sign under opposed grazing lights, mirrored and rotated UV1, both request orders, and instrumented sample and upload counts. | **Corrected, then measured.** The 12-case compare is kept as a regression oracle only; the closing pass captured the real linear-target chart (`?gate=fidelity`). | Gates table below |
| R7 | Low | The plan requires closing decoded bitmaps after their final owner. Successful `ImageBitmap`s were closed only on late or error paths, and clones share the bitmap. | **Fixed (closing pass).** `retainDecodedImage` counts every texture that owns a closable decoded image (source, variant clones, Finish views; legacy, raw, default and scoped loaders) and closes it on the last owner's `dispose`, once. A non-closable `<img>` is ignored. `decodedImageStats()` reports open and closed counts. | `decoded-image-lifecycle.test.ts` (5 cases): double dispose closes once; `<img>` ignored; a live variant keeps its bitmap after source invalidation and closes at scope teardown; a load finishing after teardown closes; a Finish view leased across `releaseFinishViewsForScope` + `releaseTextureScope` closes only at its final release. |
| R9 | Medium | **An unscoped Finish view was evicted under the wrong source key** (found in the closing pass). For a null scope, views are keyed `global`, but the source cache key has no scope prefix. Eviction and teardown released `global::…`, missed the real entry, and disposed the texture while the source cache still held it. A re-acquire then received a disposed texture. | **Fixed.** Each entry keeps the texture scope it was loaded under (`null` for unscoped) and releases or detaches through it. | `finish-views.test.ts`: "evicts an unscoped view through the source cache, so a re-acquire never gets a disposed texture". It fails on the old code. |
| R8 | Low (note) | Wide-gamut refusal applies only to raw roles in B. Colour-role checks for new professional sets belong to E's import path. | No change in B (scope). | — |

Earlier uncommitted work on this branch has not been adopted. It switched the inspection to a
half-float target with an ACES Filmic output transform (`INSPECTION_VERSION` 2). That departs from the
plan's thumbnail recipe ("exposure 1, output sRGB") and its fallback rule, so it was offered as an owner option and
not chosen (the owner adopted recipe v2). It is preserved in the local stash, not on the branch.

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
| 17. Separate compressed-source and decoded-CPU peaks are absent | **Implemented, unit-tested and measured in a real session.** | `texture-store.test.ts`; `evidence/s8-b-session.json` |

## Gates and observations

Hardware means Apple M2: WebGPU (`apple metal-3`) and WebGL2 (`ANGLE Metal Renderer: Apple M2`, with
WebGPU hidden from the page). SwiftShader runs as a software reference and never qualifies a gate.

| B gate | Observed | Status |
| --- | --- | --- |
| Colour/data rejection of one source used under two roles | Unit cases, plus the chart's linear target in both request orders on both backends: grey 128 reads 0.21582 as colour (expected 0.21586) and 0.50195 as raw (expected 0.50196) | **Pass** |
| Opaque sampling through catalogue, primitives/Forms, Walls, Room floor/lid, Region top/underside | Retained representations and the appearance oracle use the same descriptor and view path | **Pass** (unit and oracle cases) |
| Imported transparency in *Model's own*, Stage/snapshot parity | Existing model-realization and snapshot oracles remain green | **Pass** (existing suites) |
| Budget refusal without a partial lease | A full set that cannot fit returns `texture-budget` with required and available bytes, and disposes pending uploads | **Pass** (`finish-views.test.ts`) |
| Scope switch during decode, generation loss after upload, one of two users releasing, preview closing during readback, teardown with a live lease | Cancellation, generation-mismatch, exact-entry release and full-teardown cases | **Pass** (`finish-views.test.ts`, `inspection.test.ts`, `decoded-image-lifecycle.test.ts`) |
| Cold Visitor shipped raw maps | Allowlisted fetch, header probe and identity decode; unknown static paths make zero fetches | **Pass** (`visitor-cold-runtime.test.ts`) |
| Row orientation on both backends | Unit asymmetric readback, plus the chart's labelled checker corners on both backends | **Pass** |
| **Linear-target sampling-fidelity chart** | 76 checks per request order, both orders, on each adapter; all pass and the two orders give identical readings. Details below. | **Pass** on hardware WebGPU and hardware WebGL2 (SwiftShader also passes) |
| **192×192 studio highlight, roughness 0.2 vs 0.8 (recipe v2)** | Nominal v2, no retry: **0.0%** of subject pixels clipped at 255 and 0.0% near-clip, at both roughnesses. Linear peak 0.782 vs 0.153, ratio 5.13 (WebGPU 5.126, WebGL2 5.131, SwiftShader 5.171). Connected half-peak area 811 vs 7,344 px. No pixel exceeds linear 1. | **Pass** on both hardware backends at the nominal rig (`adoptedRadianceScale` 1, meaning v2 as shipped) |
| 128/192/256/384 MiB working set at DPR 1 and 1.5 per backend, plus the 4096² RGBA8 full-chain transient | Every step completed on hardware WebGL2 and WebGPU at both DPRs. Estimated view bytes were 134,217,696 / 201,326,544 / 268,435,392 / 402,653,088. Each step uploaded an 89,478,484-byte transient with 13 of 13 levels observed. No allocation errors and no context or device loss. | **Pass.** The v1 ceiling is 256 MiB, and 384 MiB is measured headroom (owner decision 2). |
| Separate compressed-source and decoded-CPU peaks, released at teardown | Real editor session on the local stack (below): peaks 416,553 B compressed and 2,097,152 B decoded. After route teardown: 0 live sources, 0 compressed and 0 decoded bytes, 0 live Finish views (0 bytes), and 0 open decoded bitmaps (1 closed). | **Pass** (`evidence/s8-b-session.json`) |
| Close decoded bitmaps after their final owner | Final-owner counting across clones and leases (R7) | **Pass** (unit; session shows the one raw bitmap closed at teardown) |

### Fidelity chart

`?gate=fidelity` (`routes/dev/s8-gates/fidelity.ts`) acquires every view through the production
Finish-view cache and texture store on the static A fixtures. It builds each material with the
production `finish-sampling` graph and draws into a 128 px half-float linear target. Expected values
come from `lib/dev/s8-fidelity-metrics.ts`, which never touches the renderer:

- sRGB bytes go through the IEC transfer, and raw bytes read as `byte/255`;
- normal responses come from the authored, transformed UV basis of the actual mesh;
- image corners come from the UV affine plus the storage-row origin.

The chart runs in two request orders: (a) colour then data, (b) data then colour. Each order uses
separate cache keys on the same bytes.

| Group | Cases | Tolerance | Result (worst case, hardware) |
| --- | --- | --- | --- |
| Unlit colour | Swatch, four quadrant interiors, through `unlit-color` | 1/255 | max error 0.0004 |
| Raw channels | Swatch R, G, B and A solo, four quadrants each, including the transparent quadrant's straight RGB (40, 80, 220) and alpha 0, and alpha 128 | 1/255 | max error 0.0005 |
| Packed ORM | (0.2, 0.75, 1) with strength 0.5, roughness factor 0.8, metalness 1 → (0.5996, 0.5991, 1.0) against expected (0.6, 0.5992, 1); border also within tolerance | 1/255 | pass |
| Sample and upload counts | One ORM fetch, one view created, one source entry, and one texture-sample node serving three role reads | exact | 1 / 1 / 1 / 1 |
| AO | Direct-only light: centre/border ratio 1.000 (AO ignored). Indirect-only ambient: 1.9618 against expected 0.2/(26/255) = 1.9615 | 1% | pass |
| Normal sign | Opposed grazing lights (±X, ±Y) on +Y/−Y images, with a −Y convention on a +Y image. Cases: the plane (UV0, and UV0 rotated 90°), the GLB on UV0, mirrored UV1, and mirrored and rotated UV1. 32 signed responses, none zero. | sign, \|Δ\| ≥ 4/255 | 32 / 32 |
| UV1 and origin | Labelled checker corners on the two-UV GLB: legacy UV0, explicit glTF UV0, mirrored UV1, mirrored and rotated UV1 (16 corner patches) | 1/255 | 16 / 16 |

## Real-session peaks and teardown

`npm run dev:local` ran the full local stack: PostgreSQL, SeaweedFS, the API and Vite, on this
worktree. The session used a local test account, and the editor ran in the desktop browser pane on
WebGPU. The editor's live texture-store and finish-views module instances were read through Vite;
the same module instance was verified, and no product hook was added. The journey:

1. Created a new project and placed a Box (catalogue Warm Plaster: one colour view and one raw
   roughness view).
2. Saved to the cloud.
3. Uploaded a creator Finish image (walnut, 53,591 B) through the authenticated P20 project scope.
4. Placed a second Box, uploaded plaster (47,350 B), then replaced it with brass (76,488 B).
5. Opened Object Studio.
6. Saved, then navigated client-side back to `/projects` (route teardown).

The numbers are in `evidence/s8-b-session.json`. `released` (7) exceeds `created` (5) because the
counter counts every transition to zero references, so a reused view counts again.

## Gate harness

The dev-only route is apps/editor/src/routes/dev/s8-gates/+page.svelte, and the runner is
apps/editor/scripts/run-s8-gates.mjs. Start a dev server for this checkout on port 5199, then run
from the repository root:

```bash
S8_GATE_INCLUDE_SOFTWARE=1 node apps/editor/scripts/run-s8-gates.mjs --out docs/roadmap/t2-look-atmosphere/s8-professional-material-foundation/evidence/s8-b-gates.json
```

The runner captures 12 cases: highlight, fidelity, and residency at DPR 1 and 1.5, each on hardware
WebGL2, hardware WebGPU and SwiftShader. The gate modes:

- **`?gate=highlight`** leases its material from `MaterialStore`. It reads clipping from the production
  192 px sRGB readback, and reads peak and half-peak area from a half-float linear draw of the same
  scene. `S8_GATE_EXPLORE` scales are recorded under `exploratory` and never change the verdict.
- **`?gate=fidelity`** runs the chart above.
- **`?gate=residency`** uses the real Finish-view cache and lease path, adds the full-chain 4096²
  transient at each step, and observes allocation errors and the mip levels actually allocated.

## Checks run locally

Host: Apple M2, with a load average of 55–135 from Spotlight and storage indexing throughout the run.
Every failure below was a timeout or a spawn timeout under that load, and each passes when rerun
alone.

| Command | Result |
| --- | --- |
| `npm run check` | 0 errors; 16 pre-existing warnings. The first run caught one type error in the new metrics test (a `Buffer` hash argument); it was fixed and rerun. |
| `npm run test:fast` | 5,667 passed, 6 failed under load. Three `tests/harness` cases and `stage-paper` (1000 m Wall bands) timed out at 5 s and 15 s. `spot-entrypoint` hit `spawnSync ETIMEDOUT`. `light-adapter-sessions` "reading change mid-press" asserted a history depth that is timing-sensitive. Rerun together, all 6 files pass. None is touched by this diff. |
| `npx vitest run tests/lib/render tests/lib/visitor tests/lib/dev` | 666 passed, 4 timed out at 5 s under load: the `light-realizer-boundary` and `material-factory-boundary` source scans. Rerun alone, all 25 tests pass. Before that, these scans correctly flagged the new `fidelity.ts` light and material sites, which are now in their exact dev-bench allowlists. |
| `npx vitest run tests/lib/dev` | 17 passed, including the new `s8-fidelity-metrics.test.ts` (oracle math, plus fixtures pinned to the A manifest and the served bytes' sha256) |
| `npm run test:arch` | 354 passed in 38 files |
| `npm run check:project-model` | pass |
| `npm run build` | pass |
| `node apps/editor/scripts/run-s8-gates.mjs` (hardware WebGL2, WebGPU, SwiftShader) | 12 of 12 cases captured, all passing. Highlight v2: nominal pass, 0.0% clipped. Fidelity: 76 + 76 checks pass, and the two orders agree. Residency: 384 MiB on every backend at both DPRs, with 13 of 13 transient levels. |
| Real editor session on the `dev:local` stack | Peaks recorded; every counter is back to zero at teardown (`s8-b-session.json`) |
| `git diff --check` | clean |

CI owns the full merge gate. No assertion was weakened to make a check pass.

## Deliberate deviations

- **Finish-view ceiling 256 MiB below the measured 384 MiB** (owner-approved, decision 2).
- **Studio recipe v2 at 0.2× radiance** (owner-approved, decision 1). It replaces v1 rather than
  adding a fallback rig, and the dev gate's `radianceScale` multiplier stays dev-only.
- **JPEG ICC admission checks the description and the matrix colorants.** It does not evaluate TRC
  curves. Treating an sRGB-named profile with sRGB primaries as sRGB is the stated admission rule.
- **Cold shipped raw bytes are fetched rather than added to the private release map.**
- **Decoded CPU bytes are an estimate, not a heap measurement**, and compressed bytes are reported
  only when a loader has them.
- **The real session authors colour Finish images only.** That is what the product Card offers in B.
  Raw roles in the session come from the catalogue (Warm Plaster roughness). Raw creator roles are
  covered by the chart, by the project-scope unit cases and by the cold Visitor cases.
- **Source formats are unchanged.** Scene 11 and resources 2 remain the admitted formats.

## Independent verdict

**ACCEPT.** Each B gate in the plan maps to a row above, and every row passes with an artifact that
can be rerun:

- the gate JSON, with 12 captured cases and adapter strings;
- the session JSON;
- the named unit cases.

The two gates that previously failed or went unmeasured were treated as follows:

- The highlight now passes at the nominal rig of an owner-versioned recipe. That is a recipe
  change, not a relaxed gate: exposure, output encoding, thresholds and the 1% clip rule are
  untouched.
- The fidelity chart measures the plan's own cases on a linear target with independent oracles.

No architectural contradiction was found: one sampling graph, one view cache and one texture store
serve every case. Remaining caveats do not block B:

- decoded CPU bytes are estimates;
- WebGL2 qualification is ANGLE-on-Metal (the browser path on macOS);
- the host's heavy indexing load caused only the test timeouts listed under checks.

Merge waits on green CI and the owner's acceptance.
