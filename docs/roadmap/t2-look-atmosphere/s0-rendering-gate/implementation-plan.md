# T2 S0 — Rendering gate: implementation plan

**Status:** Gate A accepted with follow-up corrections applied, 2026-11-11. Gate B (E4–E6) executed
2026-11-15 and is delivered in PR #349. Gate C (E7) executed 2026-11-15 on `main` at `2d73bf6f`
(including PR #349) and is delivered for review in one open, unmerged Tier 2 PR. Gate C is the final
slice of the CP0 Rendering Foundation and is flagged for the owner checkpoint. D9 is **proposed, not
adopted**. This PR claims the slice **`T2.S0`**, not a creator capability: `tools/harness/ledger.mjs`
defines capability ids as things a creator would say they can do, and a rendering gate is an
engineering slice, so no `capabilities.json` row is added. Gate A added a dev-only bench and no
production change; Gate B adds one production fix (the snapshot colour path) and no look change. The
bench is removed before merge in both gates.

**Base:** `b9908410` — the approved PR #289 baseline (T2 Look & Atmosphere, revision 4). PR #289 is
merged; this branch is based on its head, not on later `main`.

**Risk tier: Tier 2.** S0 is a gate on an approved design: its report decides what the batch may
promise (top Sheen stop, see-through bases, Glow, shadow budget, Paper reflections), and it can
change the rendering defaults every surface uses. The plan itself is docs-only; the implementation
is Tier 2 wherever it changes an approved promise or a stored-value interpretation.

**Read against:** [T2 Look & Atmosphere](../README.md) §8, §12;
[Shell / PLATE](../../../reference/design-system/editor-shell-and-visual-system.md);
[Scene content](../../../reference/components/scene-content.md);
[Performance and delivery](../../../reference/components/performance.md);
[World interaction sheet](../../../reference/design-system/world-interaction-sheet/README.md).

---

## 1. Goal

Produce the §8 S0 report with **the minimum reliable evidence first**, so the Lights and Artwork
tracks are not held behind the whole rendering investigation:

- **S3 Lights** needs one thing: an agreed pipeline record — output colour space, tone mapping,
  exposure and light units (§8 item 1).
- **A1 Artwork** needs two: that record, and artwork colour fidelity (§8 items 1 and 7).

S0 is a measurement gate, not a rendering rewrite. Every promise leaves as **go**, **go with a
renamed label**, or **wait**. Nothing is adopted because it is plausible; an unmeasured row stays
unmeasured.

## 2. What the code says today

These are the starting conditions the plan is built on. Paths are from the repo root.

| # | Finding | Evidence | Consequence for S0 |
| --- | --- | --- | --- |
| F1 | **No tone mapping or exposure is configured anywhere in production.** No `toneMapping`, `toneMappingExposure` or `outputColorSpace` appears in `apps/editor/src` or `packages`. Three's defaults apply: `NoToneMapping`, exposure 1, `SRGBColorSpace` output. | Searches over `apps/editor/src` and `packages`; `StageCanvas.svelte`, `VisitorPreviewSurface.svelte`, `managed-webgl-renderer.ts` | The premise "audit the existing tone mapping and exposure as a set" is false. There is no set. S0 must **decide whether to introduce one**, then record it. |
| F2 | **No environment reflections exist.** No `envMap`, `scene.environment`, `PMREMGenerator` or `CubeCamera` in production. The sky is a 2 × 256 canvas gradient assigned to `scene.background`. | `WorldEnvironment.svelte`, `world-environment.ts`; no matches in `apps/editor/src` / `packages` | Sky-derived reflections are greenfield, not a tuning exercise. A two-pixel gradient is not a usable reflection probe; a PMREM of it is mostly a flat ambient tint. |
| F3 | **Haze/fog is declared but unused.** `WorldEnvironmentLook.fog` is defined for every preset and never applied; there is no `THREE.Fog` in the app. Haze only colours the ground gradient. | `world-environment.ts` (`fog: [60, 220]` etc.), `WorldEnvironment.svelte` | A Haze control would be inert. D18 says nothing ships before it works, so S2 must wait for S1/S0 to apply fog. |
| F4 | **Stage and visit use different Paper rigs.** Stage: `AmbientLight 0.35` + directional 1.1 + directional 0.35, with an **unlit** flat ground/plate. Visitor Paper: `AmbientLight 0.45` + the same two directionals, plus a **lit** 90 m `MeshLambertMaterial` ground disc. | `StageCanvas.svelte`, `VisitorPreviewSurface.svelte` | "Paper parity" is not a like-for-like comparison today. It must first agree what Paper *is*, then measure. |
| F5 | **Snapshot render targets probably write linear bytes as sRGB.** The snapshot host renders into a `WebGLRenderTarget` with `UnsignedByteType` and no `texture.colorSpace`, reads pixels, and writes them into a PNG via `putImageData` with no transfer conversion. | `StageSnapshotRenderer.svelte` | Snapshots are likely darker/more contrasted than the Stage. This would corrupt parity evidence. Verify it **before** using snapshots as evidence; diagnose it as a defect, not a design choice. |
| F6 | **Snapshots drop the environment while Paper covers.** `StageSnapshotRenderer` receives `environment={environmentShown ? environment : 'paper'}`, and `environmentShown = environment !== 'paper' && !paperCovers`. The interaction sheet says snapshots keep the environment while editing on Paper. | `StageCanvas.svelte`, `paper-plan.ts` (`covers`), `experience-interaction-sheet.html` §Snapshots | Candidate parity bug. S0 item 6 must reproduce it and either fix it or record it as a separate slice; it cannot be silently inherited by S1/S2. |
| F7 | **Tone-mapped and untonemapped surfaces already coexist.** `MuseumMaterial` / `SceneInstanceMaterial` set `toneMapped={receiveLighting}`; the wall factory sets `toneMapped={emissiveIntensity === 0}` and its comment cites AgX; the Stage plate and visitor floors use `toneMapped={false}`. | `MuseumMaterial.svelte`, `SceneInstanceMaterial.svelte`, `wall-material-factory.ts`, `StageMatGround.svelte`, `VisitorLayoutShell.svelte` | A global tone mapper is already bypassed on real surfaces. "One pipeline" needs a rule for these opt-outs, not just a renderer assignment. |
| F8 | **Light units are unstated.** Scene stores `intensity` as a bare number; spot `angle` is radians; `range` is optional; there is no `decay` field. Three's physical mode (default since r155; legacy mode removed in r165) interprets point/spot intensity as candela and directional as lux. | `packages/project-model/src/scene.ts` (`SceneLightEntity`), `parse-entities.ts`, `EntityLight.svelte` | S3 cannot present a truthful Brightness control until the stored unit and the UI mapping are written down. Stored values should survive; the mapping is UI. |
| F9 | **Shadow cost is counted, not budgeted.** `PCFShadowMap`; the sun uses a 2048 map with radius 3; `shadow-invalidation.ts` counts passes and maps (a point light is six). No budget constant or refusal rule exists. | `StageCanvas.svelte`, `WorldEnvironment.svelte`, `shadow-invalidation.ts` | D9 needs numbers from item 4, not a guessed cap. |
| F10 | **Materials are `MeshStandardMaterial`; only `map` is sRGB.** Other slots are `NoColorSpace`. | `texture-cache.ts`, `MuseumMaterial.svelte` | The artwork fidelity experiment can use the real texture path; it must not invent a second material stack. |

### 2.1 What this means before any experiment

1. **"Audit tone mapping" is the wrong verb.** The real decision is whether to adopt a tone mapper
   for the Sky/Living pipeline, and what happens to the surfaces that already opt out.
2. **The artwork risk is not "tone mapping shifts colours".** With no tone mapper, the artwork is
   already multiplied by scene irradiance. Adding one can shift it further. D16 (lit and matte)
   and exact source fidelity are in tension; the gate must measure a tolerance, not assert identity.
3. **A flat sky gradient cannot prove a gloss promise.** S0 must show what a PMREM of the actual
   sky produces, indoors and outdoors, before the batch promises "sky-derived reflections".

## 3. Sequencing: the minimum evidence first

The full S0 scope stays. It is split into three gates so the blocking evidence lands first.

| Gate | Experiments | Unblocks | Why it can run first |
| --- | --- | --- | --- |
| **A — Pipeline truth** | E1 pipeline capture, E2 tone mapping + artwork fidelity, E3 light units + Brightness stops | **S3 Lights**, **A1 Artwork** | Needs no reflections, no performance run, no PBR chart, no Sky UI. It is a bench plus a decision record. |
| **B — Look truth** | E4 reflections + indoor policy, E5 Paper / Living, E6 parity | S1 Look schema, S2 Sky dials, S4 Finish, S6 Looks | Needs Gate A's tone-mapping decision fixed first, because PMREM and tone mapping interact. |
| **C — Budget truth** | E7 bounded performance + shadow budget | D9, S3 shadow defaults, S8 see-through/Glow labels | Can run in parallel with B, but only after Gate A so the numbers describe the shipped pipeline. |

**Gate A is the answer to "what can be produced first".** It is deliberately small: one bench route,
three experiments, two short decision records. It should take about one to two focused days, not a
benchmark campaign.

**Explicit non-dependencies:**

- S3 does **not** need E2, E4, E5, E6 or E7. It needs E1 and E3.
- A1 does **not** need E4, E5, E6 or E7. It needs E1 and E2.
- S0 does **not** implement P0 (the look seams). P0 is separate and behaviour-neutral.
- S0 does **not** build the S2 Sky controls. E4 measures a bench slider; the product control is S2.

## 4. Experiments

Every experiment names its question, bench, measurement and exit. Acceptance is a decision plus
evidence, never "looks fine".

### E1 — Pipeline truth capture

**Question:** what does each rendering surface actually use today, and which values are defaults
rather than decisions?

**Bench:** a dev-only `/dev/render-audit` route (after approval), or a readout added to
`/dev/materials`. No product UI, no new dependency. The route mounts the real Stage, Preview and
visit components where possible; where a surface cannot be mounted, it reports the same renderer
and material values from a minimal scene.

**Method:**

- Read at runtime, not from source: `ColorManagement.enabled`, working colour space,
  `renderer.outputColorSpace`, `renderer.toneMapping`, `renderer.toneMappingExposure`,
  `renderer.shadowMap.type`, DPR, and the renderer's drawing-buffer colour space.
- Enumerate every mounted light with its constructor, intensity, distance/decay, angle/penumbra
  and cast-shadow flag.
- Enumerate every material class in the scene with `toneMapped`, `transparent`, `alphaTest`,
  `envMapIntensity` and each texture slot's `colorSpace`.
- Repeat for Stage, snapshot target, Visitor Preview and the published visit.
- Record the Three revision and the exact commit.

**Measurements:** one machine-readable JSON plus a human table.

**Acceptance:**

- Every field S3 and A1 consume has a named runtime value; no "unknown" remains.
- Defaults are labelled as defaults, not presented as choices.
- The snapshot target's colour space is explicitly recorded (feeds E6).

**Stop:** if a surface cannot report a value, instrument it before measuring anything else.
Do not infer a runtime value from a source search.

### E2 — Tone mapping and artwork colour fidelity

**Question:** which tone-mapping pipeline, if any, preserves an artist's image closely enough under
neutral light, and what is the artwork's response?

**Bench:** the same `/dev/render-audit` route with a fixed camera, fixed 1280 × 720 viewport, DPR 1,
one white directional light at a known intensity, no sky, no shadows, and a black background.
Content:

- a neutral grey ramp and a colour chart;
- three photographic references (a skin tone, a saturated pigment, a dark textile) as textured
  quads using the real `MeshStandardMaterial` + sRGB `map` path;
- one brass and one marble sphere for a rough/metal sanity check.

**Method:**

- Render the same frame with `NoToneMapping`, `ACESFilmicToneMapping`, `AgXToneMapping` and
  `NeutralToneMapping`, all at exposure 1.0.
- For the best two, sweep exposure 0.8 / 1.0 / 1.2.
- For the artwork quad, test three responses: (a) standard lit `MeshStandardMaterial` with
  `toneMapped = true`; (b) the same with `toneMapped = false`; (c) unlit `MeshBasicMaterial` as a
  reference ceiling, not a shipping proposal.
- Sample the same patch in the source PNG and the render, in sRGB, after the renderer's output
  transform. Compute ΔE00 per patch and report clipping.

**Measurements:** per-mapper ΔE00 table, channel clipping %, grey-ramp monotonicity, and images for
the owner. No perceptual claim from a single patch.

**Acceptance (proposed thresholds, owner may tighten):**

- One pipeline is chosen and written down with its exposure.
- Mid-tone artwork patches are **ΔE00 ≤ 2** under the neutral reference; no reference patch clips
  more than 1% of its pixels.
- The artwork's hue shift is not visible to the owner in a side-by-side check. That check is a
  confirmation, not the measurement.
- If only `toneMapped = false` meets the tolerance, that is a **D16 escalation**: the batch must
  either accept a documented tolerance or add an explicit unlit-artwork option. It is not a silent
  implementation choice.

**Stop:** if no mapper meets the tolerance, stop and return to the owner with the three-way choice
(wider tolerance, unlit artwork option, or no tone mapper for this batch). Do not add a post pass
or a second material stack to rescue it.

### E3 — Light units and Brightness stops

**Question:** what does a stored `intensity` mean, and what UI stops can S3 present truthfully?

**Bench:** a 50% grey Lambertian plane at 1 m and 3 m; one point, one spot and one directional light
at a reference intensity with default decay; the fixed camera and viewport from E2.

**Method:**

- Measure relative luminance at the plane centre for each light kind and distance.
- Repeat at 0.5, 2 and 4 to test linearity.
- For spot, verify the stored `angle` is radians and the rendered half-angle matches; verify
  `penumbra` at 0 and 1.
- Verify a point light's `range` behaves as a cutoff, not as an inverse-square replacement.
- Write the stored-unit statement (candela for point/spot, lux for directional, per Three's
  physical mode) and a Brightness stop table as a UI mapping over stored values.

**Measurements:** intensity → relative luminance table; stop ratios; spot half-angle error in
degrees; range behaviour.

**Acceptance:**

- D5 is resolved: physical stored units, Brightness stops are UI only.
- Stops reproduce their target luminance ratios within ±0.5 stop.
- Existing stored values are unchanged; no migration is implied.
- S3 can implement Warmth/Brightness without inventing a unit or a curve.

**Stop:** if the three kinds cannot be made comparable without a per-kind conversion, write the
conversion down as part of the contract. Do not change stored values to make the UI simpler.

### E4 — Environment reflections and the indoor policy

**Question:** does a PMREM of the actual Sky produce a defensible reflection, and what happens
indoors?

**Bench:** the glossy-floor + rough/metal chart scene, outdoors in an open World and inside an
enclosed Room, under Daylight, Golden hour and Dusk.

**Method:**

- Add `scene.environment` from a PMREM of the same sky gradient, at `environmentIntensity` 0.3 and
  1.0, with per-material `envMapIntensity` available.
- Compare: no environment / sky environment / a neutral studio reference (the D4 candidate).
- Gate B experiment: under each candidate global mapper, measure `MeshLambertMaterial` with
  `toneMapped = true` and `toneMapped = false`; do not claim a mapper necessarily compromises artwork
  until the opt-out is measured.
- Measure PMREM generation time and the cost of rebuilding it while an elevation/azimuth slider is
  dragged.
- Photograph a glossy floor, a brass sphere and a dark textile; specifically look for the indoor
  case where a glossy floor reflects open sky through a roof.

**Measurements:** images per preset and setting; PMREM build ms; rebuild-on-drag ms; a written
indoor verdict.

**Acceptance:**

- Each reflection promise (top Sheen stop, see-through bases, Glow) leaves as **go**, **go with a
  renamed label**, or **wait**, with the image that decided it.
- The indoor policy is one of: accept, damp by enclosure, or schedule an interior capture. It is
  not left implicit.
- The reflection rebuild policy is throttled or on release, with a measured number supporting it.

Shadow budget (D9) is E7 and Paper reflections are E5. Neither is an E4 acceptance criterion.

**Stop:** if sky leak indoors is unacceptable and damping is insufficient, schedule the interior
capture as its own slice and keep the top Sheen stop at **High gloss**. Do not ship a gloss label
the images do not earn.

### E5 — Paper / Living

**Question:** should the editor's Paper reading gain reflections or any Sky-derived light, and what
does that cost in neutrality?

**Bench:** the same content in Paper and Living, with and without the E4 environment; the Stage and
the visit side by side.

**Method:**

- Capture Paper today (neutral rig, unlit ground) and Living with the Sky.
- Add the neutral studio environment to Paper as the D4 candidate, not the Sky environment.
- Compare before/after for walls, a pale finish, a dark finish, gold selection ink and a black
  artwork.
- Record the exact light intensities and ground treatment in each surface.

**Measurements:** before/after images; a table of the two rigs' values; a neutrality check that the
Sky does not relight Paper.

**Acceptance:**

- D4 is decided from images: **no added light**, neutral studio reflection only, or no reflection.
- Paper stays neutral and unlit by the Sky, or the owner explicitly accepts the change.
- The Stage and visit Paper difference is either reconciled or recorded as intentional with a
  reason.

**Stop:** if the only way to make Paper look "finished" is to give it the Sky, that contradicts the
approved "Paper stays neutral" promise; return to the owner instead of changing the promise in S0.

### E6 — Parity and the snapshot colour path

**Question:** do Stage, snapshot, Preview and the visit resolve the same look values, and is the
evidence itself trustworthy?

**Bench:** one scene, one authored View, one environment; all four surfaces at the same pose.

**Method:**

- **First**, isolate F5: render a known 50% grey patch on the Stage canvas and in a snapshot; compare
  the sRGB values. If they differ, the snapshot target's colour space or readback is wrong. Fix the
  target and re-verify before using any snapshot as parity evidence.
- Add a debug readout of the resolved values (tone mapping, exposure, sky preset, sun, hemisphere,
  material flags) to each surface; assert they are identical.
- Compare pixels on world content only, excluding marks, grid and selection ink.
- Check the visitor boundary: no editor module in visitor chunks (the existing boundary test).
- Record visit cold-start using the existing `visitor:mounted` / `visitor:entry-frame` marks.

**Measurements:** a resolved-value table per surface; a pixel-difference summary; boundary test
result; cold-start marks.

**Acceptance:**

- Identical resolved look inputs on all four surfaces, or a named, justified difference.
- Snapshot vs Stage world pixels agree within a stated tolerance after the colour-space fix.
- Zero editor imports in visitor chunks.
- Cold-start cost is recorded, not estimated.

**Stop:** any editor module reaching visitor chunks blocks the gate. Report it; do not weaken the
boundary test.

### E7 — Bounded performance and the shadow budget

**Question:** what frame time and shadow cost do the reference Worlds actually have, and what is D9?

**Bench:** three Worlds — empty, a small room, and a gallery wall (textured quads if A1 has not
landed). Stage and visit. Fixed 1280 × 720, DPR 1, idle orbit and a short drag, 10 s each.

**Devices:** the owner's integrated-GPU laptop; a phone-class device only if the owner supplies one.
Follow [performance.md](../../../reference/components/performance.md): performance work is
owner-initiated and bounded. **Do not run `npm run perf:spot`** — it measures architectural grids,
not rendering — and do not run a full suite.

**Measurements:** p50/p95 frame interval; `renderer.info` calls, triangles and allocated textures;
shadow maps per frame; PMREM ms (from E4); the device and browser.

**Acceptance:**

- D9 is a shadow budget with numbers and a refusal rule in words.
- The reference laptop has a stated p95 target per surface. Proposal: Stage drag ≤ 2 display
  periods; gallery p95 ≤ 33 ms; Visitor idle ≤ 1 display period (16.7 ms) as the aspirational
  target, with a proposed 1.1-period (~18.3 ms) p95 allowance.
- Any device not measured is marked **unmeasured**, never extrapolated.

**Stop:** no "smooth" claim without p95; no desktop-to-phone extrapolation. If the budget cannot be
met with the approved light kinds, reduce the default shadow set rather than silently capping at
runtime.

**Execution (2026-11-15).** The bench ran on `main` at `2d73bf6f`: Apple M2 / ANGLE Metal / Chrome
153, 1280 × 720 DPR 1, 10 s per run, three Worlds (`empty`, 7 × 6 small room, 12 × 7 gallery wall
with six textured quads), Stage through `StageCanvas` and visit through the visitor renderer path,
plus a gallery shadow-off control and three real-surface cold starts. Stage `rest` rendered zero
frames; every Stage orbit/drag and visit run rendered 600–601 frames. p50 was 16.70 ms throughout;
p95 was 17.6–17.7 ms (one 28.10 ms gallery Stage outlier). Stage rendered **0 shadow maps/frame**;
visit rendered **1**. Shadows off removed 10+ calls and 1,228 triangles with no p95 change, because
the laptop is vsync-bound. Stage drag and gallery targets were met; visit idle p95 (17.6–17.7 ms)
fell within the proposed 1.1-period (18.3 ms) allowance but **missed** the aspirational 16.7 ms
target, even on the empty World. Full numbers and the D9 proposal are in
[report.md](./report.md#gate-c--e7-rendering-performance-and-shadow-budget). The visit idle target and
D9 itself require owner authorisation.

## 5. Decisions this plan asks the owner to make

| Decision | Recommendation | When |
| --- | --- | --- |
| Tone mapping | **Measured: no mapper.** E2 rejected Neutral (mid-tone ΔE00 4.07), ACES (3.35) and AgX (6.35); None + Lambert scored 0 across all 18 patches. E4 then measured Lambert + `toneMapped = false` under all three mappers: **ΔE00 0**, so a mapper would not by itself compromise artwork. Still no mapper: the Sky's blocker is the indoor environment leak, not tone mapping. | Gate A accepted; opt-out measured in Gate B |
| D5 light units | Keep physical stored units; Brightness stops are a UI mapping fixed by E3. | After E3 |
| D4 Paper reflections | **Decided: no reflection on Paper.** A neutral studio probe at 0.3 already relights it (pale wall 139 → 167 sRGB); at 1.0 the pale wall reaches 217 (ΔE00 21.7). The Sky is worse (ΔE00 26.4). | Decided in E5, 2026-11-15 |
| D9 shadow budget | **Proposed: preserve the measured one-Sun baseline (2048² PCF, radius 3; 1 map/frame visit, 0/frame Stage while moving) and the approved Spot/Point Shadow controls; Point stays off by default. The earlier refusal of a second caster/point shadow is withdrawn. Per-caster maps, multi-caster totals unmeasured; owner chooses measure/cap/ship-unmeasured. Visitor idle 16.7 ms is aspirational, with a proposed 18.3 ms allowance. Not adopted.** Measured: Stage 0 maps/frame; visit 1 map/frame; shadow-off removes 10+ calls / 1,228 triangles with no p95 change (vsync-bound). | Proposed in E7, 2026-11-15; owner decision pending |
| D16 artwork response | **Approved baseline: `MeshLambertMaterial` + `NoToneMapping`.** It was exact (ΔE00 0); the standard PBR material lifted near-black by ΔE00 5.16. Gate B confirmed `toneMapped = false` is exact under ACES, AgX and Neutral, so the baseline survives a future mapper. | Gate A accepted; opt-out measured in Gate B |
| Snapshot colour path | **Fixed in E6.** The writer encodes linear → sRGB; a 50% grey patch now reads 128 on the Stage and 128 in a snapshot (it was 55). Treated as a defect, not a look decision. | Done, 2026-11-15 |

### Gate A outcome (2026-11-11)

- **E1:** pipeline captured from the shared factory at Three r187: sRGB output, `srgb-linear` working
  space, `NoToneMapping`, exposure 1.0, `PCFShadowMap`; readback calibration passed with maximum
  channel error **0**. E1 did not instantiate each production surface; parity is Gate B/E6.
- **E2:** `MeshLambertMaterial` + `NoToneMapping` reproduced all 18 source patches exactly (ΔE00 0,
  no clipping). The standard PBR material passed the mid-tone target but lifted near-black by 5.16;
  ACES, AgX, Neutral and Neutral @ 1.1 all failed the mid-tone target.
- **E3:** stored intensity is physical (candela for point/spot, lux for directional) with `decay = 2`.
  The π reference produced the calibrated 50% grey response at 1 m for all three kinds; it is a
  material calibration, not unit physical irradiance. The five Brightness factors measured
  0.252 / 0.496 / 1.000 / 2.011 / 3.999.
- **Decision:** keep `NoToneMapping`, exposure 1.0, and give Artwork a diffuse-only lit material.
  This keeps D16 lit and matte; it does not change the promise.
- **Snapshot:** the 640 × 360 `UnsignedByteType` target has `NoColorSpace`, so r187's linear target
  bytes are not sRGB-encoded. Gate A did not use it; E6 owns the fix.
- **Unblocked:** S3 Lights and A1 Artwork may consume [pipeline.md](./pipeline.md) and
  [artwork-fidelity.md](./artwork-fidelity.md). Gate B and Gate C remain waiting.

### Gate B outcome (2026-11-15)

Executed against `main` at `dddbdd01` (including merged PR #347). Full record:
[report.md](./report.md#gate-b--e4e6).

- **E4 — reflections and indoor policy: wait.** `scene.environment` from the real Sky leaks open-sky
  light into an enclosed Room almost unchanged: Daylight floor ΔE00 13.53 / 15.04 with luminance
  ×1.80 / 1.94, pale wall ΔE00 17.82, and Golden hour is worse (19.37 / 21.32, pale wall 23.70).
  r187 offers no per-material opt-out: `envMapIntensity = 0` measured **identical** to `1.0`, because
  the renderer writes the intensity uniform from `scene.environmentIntensity` when the material has
  no own `envMap`. No `scene.environment` ships; the top Sheen stop stays **High gloss**; interior
  capture is scheduled as its own slice. PMREM cost is affordable and recorded: build p50 9.9 ms
  (max 14.5), drag rebuild p50 8.5 ms (p95 11.2), intensity-only 0 ms.
- **E4 — Lambert opt-out (the Gate A open question): passes.** `MeshLambertMaterial` +
  `toneMapped = false` reproduced all 18 patches exactly (ΔE00 0, 0% clipping) under ACES Filmic, AgX
  and Neutral. With `toneMapped = true` the same mappers measured 4.06 / 5.29 / 4.33. A future mapper
  would not by itself compromise artwork; the Sky is blocked by the environment leak instead.
- **E5 — Paper / Living: D4 = no reflection on Paper.** A neutral studio probe at 0.3 relights Paper
  (pale wall 139 → 167 sRGB, floor 161 → 195); at 1.0 the pale wall is 217 (ΔE00 21.70) and the white
  artwork 226 (ΔE00 21.44). The Sky is worse (pale wall ΔE00 26.43). Stage vs visit Paper is identical
  on 8 of 10 surfaces; only the ground differs (unlit plate 161,163,158 vs lit disc 233,235,230,
  ΔE00 18.09), recorded as intentional.
- **E6 — parity and snapshot colour path: go.** The snapshot writer now encodes linear → sRGB
  (`apps/editor/src/lib/authoring/stage/snapshot-image.ts`); a 50% grey patch reads 128 on the Stage
  and 128 in a snapshot, where it read 55. Against the Stage frame: mean channel difference 0.54,
  96.42% of channels within 2, p99 5, mean ΔE00 0.61 (max 2.01); the residual is silhouette aliasing
  (the default framebuffer is multisampled, the target has 0 samples). Stage and Preview resolve
  identical look inputs; the sun's distance and the host material sets are the two named differences.
  Gate B reported that `visitor:entry-frame` does not exist; that was **incorrect**. The mark has
  existed since `f6de016d`, but it is a two-rAF proxy gated on an active visitor runtime. E6's
  cold-start criterion was deferred, not met. Gate C adds a renderer-observed `visitor:first-frame`
  mark and records the baseline (61.0–72.0 ms warm-page mount → first frame; 100.7 ms first surface
  mount); see the Gate C outcome.
- **Assumption recheck.** F1 superseded by PR #347 (Canvases now pass `NoToneMapping`; the factory
  still sets none); F2, F3 and F7 still true; F4 partly superseded (light values match, ground
  treatment differs); F5 confirmed and fixed; **F6 confirmed and still present** — a snapshot taken
  while Paper covers a Living World is rendered with the Paper look, recorded as a separate slice
  rather than bundled into this PR.
- **Checks run for this gate:** `npm run check` (0 errors), the focused snapshot colour-path tests,
  `npm run test:arch`, `npm run build`, and the bench run that produced the evidence with zero
  sampling misses. The bench route and its save endpoint are removed before merge.

### Gate C outcome (2026-11-15)

Executed against `main` at `2d73bf6f` (including merged PR #349). Full record:
[report.md](./report.md#gate-c--e7-rendering-performance-and-shadow-budget).

- **E7 — frame intervals: measured, no smoothness extrapolation.** On the reference laptop the
  Stage's settled surface rendered **0 frames**; orbit/drag rendered 600 and 120 frames, and the
  visit rendered 600–601 in every pattern. p50 was 16.70 ms; p95 was 17.6–17.7 ms in every run
  except the gallery Stage orbit's single 28.10 ms frame. The laptop is vsync-bound, so frame time
  does not separate the Worlds; renderer workload does.
- **E7 — shadow cost: measured.** Stage orbit drew **0 shadow maps/frame** in all three Worlds
  (on-demand invalidation holds). Visit drew **1 shadow map/frame** and, on the gallery, 24–26 calls
  / 2,908–2,912 triangles / 6 allocated textures / 7 compiled programs. The shadow-off control
  measured 14 calls / 1,680 triangles / 4 allocated textures / 6 compiled programs: at least 10
  calls and 1,228 triangles are the shadow pass. p95 was 17.70 ms both ways. These counters are
  allocations, not per-frame texture bindings.
- **D9 — proposed, awaiting owner.** Preserve the measured one-Sun baseline: 2048² PCF (radius 3),
  one map per frame on the visit, zero while the Stage camera moves. T2's approved Spot/Point Shadow
  controls remain live; Point stays off by default. Per-caster maps are budgeted, but multi-caster
  totals are unmeasured; the earlier refusal of Spot/Point shadows is withdrawn. The owner chooses
  measure / visible cap / ship-unmeasured for multi-caster Worlds. Architecture refusals remain:
  maps >2048², cascades, baked/cached shadows, per-frame Stage updates, and silent runtime caps.
  The D9 row above carries the proposal.
- **Frame target.** Stage drag p95 ≤ 33.3 ms **met**; gallery p95 ≤ 33 ms **met**; Visitor idle p95
  17.6–17.7 ms is **within the proposed 1.1-period (18.3 ms) allowance** but **misses the
  aspirational 16.7 ms target**, including on the empty World. p50 is 16.70 ms.
- **Cold start — baseline recorded, not optimised.** Gate C adds `visitor:first-frame`
  (`apps/editor/src/lib/visitor/first-frame.ts`, `VisitorFirstFrame.svelte`) and measures the real
  `VisitorPreviewSurface` with a one-view program: mount → first frame 61.0–72.0 ms on a warm page
  (100.7 ms on the first surface mount), with the existing `entry-frame` 1.2–1.4 ms later. These are
  surface cold starts, not network/bundle loads. No optimisation was made.
- **Correction.** Gate B's claim that `visitor:entry-frame` does not exist was wrong; the mark has
  existed since `f6de016d`. It is a two-rAF scheduling proxy gated on an active runtime, which the
  Gate B surface did not have. Gate C keeps it and adds a renderer-observed mark rather than
  renaming or removing it.
- **Checks run for this gate:** `npm run check` (0 errors, 12 pre-existing warnings), the focused
  `first-frame` unit test (3 cases), `npm run test:arch`, `npm run build`, and the 19-run bench. The
  bench route and runner are removed before merge; provenance stays in the Gate C commit.

## 6. Deliverables

| Artifact | Owner | Consumers |
| --- | --- | --- |
| `report.md` — the §8 report, one section per item, each with its verdict | S0 | Owner, S1/S2/S4/S6 |
| `pipeline.md` — the Gate A decision record: colour space, tone mapping, exposure, light units, Brightness stops | S0 | **S3**, A1, S1 |
| `artwork-fidelity.md` — source-vs-render patches, chosen response, tolerance | S0 | **A1** |
| `evidence/YYYY-MM-DD/<sha>/` — images and JSON with a concrete retention purpose | S0 | Review |
| Optional renderer change | S0 | Only the settings E1/E2 prove; no speculative look module |

Contract edits happen only if a real change lands, per T2 §12: the Shell/PLATE Paper row if D4
passes, and Scene content's stored light units if E3 changes their statement. The plan edits none.

## 7. Scope

**In:** the bench route, E1–E7, the report, the two decision records, and the minimal renderer
settings the evidence proves.

**Out:** S3's light UI, A1's Artwork entity, S1's schema, S2's Sky controls, P0's seams, any post
pass, interior reflection capture, area lights, transmission, baked or cached shadows, a full PBR
chart beyond E2/E4's needs, and any refactor of the 5,901-line spatial route.

## 8. Dependencies and order

```text
Gate A (E1 → E2 → E3) ──▶ pipeline.md ──▶ S3 Lights
        │                    └──────────▶ A1 Artwork (with E2)
        │
        ├──▶ Gate B (E4 → E5 → E6) ──▶ S1 / S2 / S4 / S6
        │
        └──▶ Gate C (E7) ──▶ D9 shadow budget
```

- E2 depends on E1's captured values.
- E4 and E6 depend on E2's tone-mapping decision.
- E5 depends on E4's reflection result.
- E7 depends on E1 for a stable pipeline; it can overlap E4–E6.
- No gate depends on P0, S1, S2 or S3.

## 9. Risks and pushback

1. **The brief's premise is wrong in one place.** "Tone mapping, exposure and light units have never
   been audited as a set" is true, but stronger: there is no tone mapping or exposure to audit.
   Treating this as an audit would produce a description of defaults and call it a decision. The
   deliverable must be a decision record, including the decision *not* to add a mapper.
2. **ACES is not the safe default for artwork.** It is a filmic look that shifts saturated colours.
   Choosing it because it is familiar would create the exact fidelity problem §7 warns about.
   Neutral is the better candidate; E2 must prove it, not assume it.
3. **Sky reflections will be modest.** A 2 × 256 gradient PMREM is a coloured ambient, not a mirror.
   The batch should not promise interior capture or mirror gloss from it. The top Sheen stop stays
   **High gloss** unless E4 earns more.
4. **"Not visible to an artist" is not a test.** E2 uses ΔE00 plus an owner eye check. Also, a lit
   matte surface cannot equal an emissive source pixel-for-pixel; D16 and exact fidelity conflict.
   The honest promise is "no visible hue shift under the neutral reference", and the owner should
   confirm that wording.
5. **Item 4 cannot use the existing spot check.** `npm run perf:spot` measures grid-M/grid-L
   architecture work and is owner-initiated; it is not a render benchmark. A phone-class device may
   not exist in this environment. E7 defines a bounded protocol and marks missing devices
   unmeasured; it does not extrapolate. **Gate C measured only the M2 laptop and found it
   vsync-bound:** the frame interval hides shadow cost, so D9's budget is map/pass and draw-work,
   not a GPU-time cap. A slower device may turn the measured 10-call shadow pass into a cost this
   bench cannot see.
6. **Paper and Living are not twins today.** Different ambient intensity, different ground
   geometry, different lit/unlit treatment. Calling that a parity bug before defining "Paper is the
   editor-only neutral reading" would force the wrong fix. E5 defines the semantics first.
7. **The snapshot path may be invalidating its own evidence.** F5 is a probable colour-space defect.
   If it is real, every snapshot comparison in the batch is suspect. E6 verifies it before parity
   evidence is accepted.
8. **Haze is already an inert promise waiting to happen.** The fog values exist and are unused. S2
   must not ship a Haze control until S0/S1 applies fog; D18 is explicit.
9. **"One pipeline" is not one renderer assignment.** Several surfaces already set
   `toneMapped={false}`. The gate needs a rule for which surfaces may opt out and why, or the batch
   will have a pipeline in name only.

## 10. Checks for this PR

This section originally described the planning-only PR. It is retained as history; the current Gate C
PR is not planning-only.

- **Planning PR:** `git diff --stat` showed the plan file only; no unit, integration, build or
  benchmark run was required or claimed. The plan's paths and line-level claims were read from base
  `b9908410`.
- **Gate C PR:** `npm run check` (0 errors, 12 pre-existing warnings), the focused
  `tests/lib/visitor/first-frame.test.ts` (3 cases), `npm run test:arch`, `npm run build`, and the
  bounded 19-run matrix. No `perf:spot` or full suite was run. The bench route and runner are
  removed before merge.

## 11. Approval gate

The owner reviews this plan in the draft PR. On approval:

1. Gate A starts in this same PR and produces `pipeline.md`, `artwork-fidelity.md` and the Gate A
   evidence. S3 and A1 may start against those records.
2. Gate B follows, then Gate C. Gate C is the final CP0 Rendering Foundation slice; its PR is
   flagged for the owner checkpoint and is not merged by the implementer.
3. If Gate A overturns a T2 promise (top Sheen, see-through, Glow, artwork response), stop before
   Gate B and return to the owner. The gate exists to decide what may be promised; it must not
   quietly rewrite the promise.
4. D9 and the visit idle frame target are owner decisions. No later slice may cite D9 as adopted
   until the owner records that decision.
