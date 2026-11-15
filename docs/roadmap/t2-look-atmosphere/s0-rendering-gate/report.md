# T2 S0 — Gate A, Gate B and Gate C report

**Status:** Gate A (E1–E3) accepted, 2026-11-11, with follow-up corrections applied. Gate B (E4–E6)
executed 2026-11-15 and delivered in PR #349. Gate C (E7) executed 2026-11-15 on `main` at
`2d73bf6f` (including merged PR #349) and is delivered for review in one open, unmerged Tier 2 PR.
**D9 is proposed, not adopted:** it requires owner authorisation. No PR merge authorisation.

This report carries the Gate A, Gate B and Gate C slices of the §8 S0 report. Gate C closes the
performance and shadow-budget evidence; D9 and the reference-laptop frame target remain owner
decisions.

## Verdicts

| S0 item | Result | Verdict |
| --- | --- | --- |
| 1. Pipeline audit | Output sRGB, working `srgb-linear`, `NoToneMapping`, exposure 1.0, physical light units; readback calibration exact. E1 measured the shared renderer factory; E6 then measured each production surface. See [pipeline](./pipeline.md). | **Go**, with the pipeline recorded |
| 2. PBR chart / indoor policy | `scene.environment` leaks open-sky light into an enclosed Room almost unchanged (Daylight floor ΔE00 13.5, luminance ×1.8; Golden hour ΔE00 19.4–23.7), and r187 has **no per-material opt-out**: `envMapIntensity = 0` measured identical to `1.0`. E4 images and numbers below. | **Wait** — no global environment; interior capture is its own slice |
| 3. Live Sky | PMREM of the real preset sky builds in 9.9 ms p50 (14.5 max), rebuilds in 8.5 ms p50 during a 12-step drag; an intensity-only change costs 0 ms. The cost is affordable; the look is not yet defensible indoors. | **Go on cost, wait on look** |
| 4. Performance / D9 | Three reference Worlds measured at 1280 × 720, DPR 1 on an Apple M2 / ANGLE Metal laptop. Stage orbit p95 17.6–17.7 ms with **0 shadow maps/frame**; visit p95 17.6–17.7 ms with **1 shadow map/frame**; gallery shadow-off control removes 10+ draw calls and 1,228 triangles without changing p95. D9 is proposed as a per-caster 2048² PCF budget that preserves the approved Spot/Point Shadow controls. | **Proposed for owner authorisation**; visit idle is within the proposed 1.1-period allowance but misses the aspirational 16.7 ms target |
| 5. Paper / Living | Even a neutral studio reflection at 0.3 relights Paper (pale wall 139 → 167 sRGB; floor 161 → 195); at 1.0 the pale wall reaches 217 (ΔE00 21.7). Paper and Living stay different readings. | **Go with D4 = no reflection on Paper** |
| 6. Parity | Snapshot colour path fixed and measured: a 50% grey surface reads 128 on the Stage and 128 in a snapshot (it was 55); mean channel difference 0.54, 96.4% of channels within 2, mean ΔE00 0.61. Stage and Preview resolve the same look inputs. One separate snapshot defect is recorded (F6). Visitor cold start was deferred by Gate B and is now recorded as a **baseline** in Gate C (first frame 61.0–72.0 ms after a warm-page mount request; 100.7 ms on the first surface mount). | **Go** for the colour path; parity differences named; cold-start baseline recorded |

## Gate A — E1–E3

### Blocking findings

1. **There was no tone mapping to audit on the renderer factory.** The factory runs `NoToneMapping` at
   exposure 1, and the gate decided not to add a mapper because no tested mapper meets the artwork
   target. The Canvases did not run that pipeline: Threlte's `<Canvas>` applied `AgXToneMapping` until
   the 2026-11-15 correction (see [pipeline.md](./pipeline.md#1-the-pipeline-as-measured)).
   The `Lambert + toneMapped = false` opt-out is untested and remains a Gate B experiment.
   **Gate B, 2026-11-15:** measured — the opt-out is exact under ACES Filmic, AgX and Neutral
   (ΔE00 0 on all 18 patches, 0% clipping); see [E4](#e4--environment-reflections-and-the-indoor-policy).
2. **The snapshot target is not colour-safe.** It is an `UnsignedByteType` target with no sRGB
   texture colour space; r187 renders it in the linear working space, and the PNG writer treats the
   bytes as sRGB. Do not use snapshots as parity or fidelity evidence until E6 fixes this.
   **Gate B, 2026-11-15:** fixed and verified — see [E6](#e6--parity-and-the-snapshot-colour-path).
3. **Artwork cannot use the standard PBR material without a visible dark-end lift.** A diffuse-only
   lit material is exact under the neutral reference and still satisfies D16.
4. **The plan's Neutral recommendation is rejected.** This is not a product-promise change; it is the
   measurement doing its job. If Gate B needs a mapper for the Sky, it must first test the Lambert
   opt-out; only then is the remaining shift an owner D16 decision.
   **Gate B, 2026-11-15:** the opt-out passes exactly, so a global mapper would not by itself
   compromise artwork. Gate B still does not adopt one: the blocker for the Sky is the environment
   leak indoors, not tone mapping.

### What is now unblocked

- **S3 Lights** may rely on the light-unit and Brightness-stop record in
  [pipeline.md](./pipeline.md). Shadow defaults remain blocked on Gate C.
- **A1 Artwork** may rely on the colour-fidelity record in
  [artwork-fidelity.md](./artwork-fidelity.md). Placement, formatting, transparency and release
  pinning remain A1's own checks.

### Dev route policy

The Gate A `/dev/render-audit` bench (`apps/editor/src/routes/dev/render-audit/`), its
`+page.server.ts` 404 guard, and the focused colour-math test (`gate-a-audit.test.ts`) were removed
before merge, per the owner's retention policy. The bench is not a product route and is not retained
in the tree. Its source remains reproducible from commit
`1a669fb1a752c0b5bf86bfb487fe31c81707024c`, which generated the evidence below:

```bash
git show 1a669fb1a752c0b5bf86bfb487fe31c81707024c:apps/editor/src/routes/dev/render-audit/audit.ts
git show 1a669fb1a752c0b5bf86bfb487fe31c81707024c:apps/editor/src/routes/dev/render-audit/+page.svelte
```

Re-running Gate A requires a new owner-approved bench; this slice does not reinstate it.

### Evidence (Gate A)

- [Contact sheet](./evidence/2026-11-11/gate-a-contact-sheet.png)
- [Machine-readable result](./evidence/2026-11-11/gate-a-result.json)
- Source provenance: commit `1a669fb1a752c0b5bf86bfb487fe31c81707024c` (removed from the tree; see
  Dev route policy).

## Gate B — E4–E6

### Execution addendum

The plan's §4 was written against base `b9908410`. Before executing, every plan assumption was
rechecked against `main` at `dddbdd01` (which includes merged PR #347); the recheck is
[below](#plan-assumption-recheck). Three things changed the method, not the questions:

1. **The Canvases now pass `NoToneMapping` (PR #347).** Gate A's follow-up correction landed, so
   Gate B measured the shipped pipeline instead of Threlte's `AgX` default.
2. **r187 renders a non-XR render target in the working colour space regardless of
   `target.texture.colorSpace`.** The snapshot fix therefore had to encode on write, not set a texture
   colour space; E6 measured that path through the shipped writer.
3. **The bench had to be rebuilt twice before its numbers were trustworthy.** The first pass resized
   the renderer between the Stage capture and the snapshot capture, which cropped the frame; the
   second sampled world points through a vertical mapping that hit the wrong surfaces (an unlit grey
   patch reported ΔE00 8.1). The shipped bench gives every measurement its own correctly sized
   renderer, uses one top-down row convention, and refuses a sample whose raycast does not hit the
   named surface (`samplingMisses`, `greyMisses`). Every number below comes from a run with **zero**
   misses.

Everything ran on one machine: Apple M2, ANGLE Metal, Chrome, one 960 × 600 default-framebuffer
readback at DPR 1 per variant, `NoToneMapping`, exposure 1.0.

### Results

| Experiment | What was measured | Verdict |
| --- | --- | --- |
| [E4](#e4--environment-reflections-and-the-indoor-policy) | 24 variants (3 presets × 4 reflection settings × outdoor/indoor), 10 sampled surfaces each; PMREM build and drag rebuild; Lambert opt-out under four mappers and under the environment | **Wait**: no sky reflection ships; top Sheen stop stays **High gloss**; interior capture is its own slice |
| [E5](#e5--paper--living) | Paper and Living under no environment, neutral studio at 0.3 and 1.0, and the Sky; Stage vs visit Paper | **Go with D4 = no reflection on Paper** |
| [E6](#e6--parity-and-the-snapshot-colour-path) | Stage vs snapshot through the shipped writer, the analytic sky expectation, resolved values on both production surfaces, cold-start marks | **Go** for the snapshot colour path; two named parity differences |

### E4 — Environment reflections and the indoor policy

**Bench.** A glossy floor, a brass sphere, a dark textile, a pale wall, a dark wall, a black artwork,
a white artwork, a Lambert colour chart and an unlit mid-grey patch. Outdoors: open ground, eye
`[4.6, 2.6, 6.2]`, fov 40. Indoors: a room shell with a roof, eye `[3.2, 1.75, 2.9]`, fov 46, looking
at the same content. Sky environments are PMREMs of the preset's actual 2 × 256 gradient; the
"neutral studio" is a flat grey studio probe. ΔE00 is against the same variant with no environment,
in sRGB, on the rendered pixel.

**The environment relights everything, indoors as much as outdoors.** Daylight, `scene.environment`
from the Sky at `scene.environmentIntensity = 1.0`:

| Surface | Outdoor ΔE00 | Indoor ΔE00 | Indoor luminance ratio |
| --- | --- | --- | --- |
| Glossy floor (near / far) | 13.54 / 15.35 | 13.53 / 15.04 | **1.80 / 1.94** |
| Brass sphere | 39.23 | 40.65 | 86.31 |
| Pale wall | 17.82 | 17.82 | 2.21 |
| White artwork | 16.21 | 16.21 | 1.97 |
| Dark textile | 10.79 | — (outside the indoor frame) | — |
| Dark wall | 9.59 | — (outside the indoor frame) | — |
| Black artwork | 2.65 | 9.66 | 2.53 |
| Lambert chart | 5.18 | 5.54 | 2.26 |
| Unlit grey patch | 0 | 0 | 1.00 |

The zero for the unlit patch is the bench's proof that the sampling is honest: an `MeshBasicMaterial`
must not move when an environment is added, and it does not. The room shell changes the floor's
brightness by **4%** and the pale wall not at all. `scene.environment` is not occlusion-aware, so a
roof is not a hint to it. The indoor sweeps confirm this is not a Daylight quirk — indoor floor
ΔE00 by preset: Golden hour 19.37 / 21.32, Dusk 8.15 / 9.30, Daylight 13.53 / 15.04; the pale wall
moves 17.52–23.70 in all three.

![Indoor Daylight under the Sky environment](./evidence/2026-11-15/gate-b/gate-b-e4-indoor-daylight-sky.png)

**There is no per-material opt-out in r187.** `floorMaterial.envMapIntensity = 0` while
`scene.environmentIntensity = 1.0` measured **identical** to leaving it at 1 — all ten surfaces,
ΔE00 0 between the two, the same image. r187 writes the environment's intensity uniform from
`scene.environmentIntensity` whenever the material has no own `envMap`, so a material cannot opt out
of the scene environment; only the scene-level intensity exists. Damping by enclosure would therefore
need a new scene-graph-aware policy (per-room environment intensity), which is an architecture
decision this gate does not take.

**A global environment also relights the artwork itself.** With a Lambert material on the chart,
adding the Sky environment at 0.3 / 1.0 moves patches by ΔE00 3.50 / 9.28, lifts near-black from
18,18,20 to 21,21,23 / 26,26,29, and clips 5.6% / 22.2% of patch pixels. The material-level opt-out
`toneMapped = false` does **not** help here: that flag controls tone mapping, not the environment.

**PMREM cost is affordable.** Daylight build, 8 samples: p50 **9.9 ms**, max **14.5 ms**. Rebuilding
while a 12-step elevation/azimuth drag runs: p50 **8.5 ms**, p95 and max **11.2 ms**. Changing only
the reflection intensity: **0 ms** (no rebuild). A throttled rebuild on release would fit a frame
budget; this is not what blocks the feature.

**Lambert opt-out under a global mapper (the Gate A open question).** 18 chart patches, one white
directional light at the calibrated intensity, sRGB readback:

| Mapper | `toneMapped = true` | `toneMapped = false` |
| --- | --- | --- |
| None | ΔE00 0 | ΔE00 0 |
| ACES Filmic | ΔE00 4.06 (max 5.65), near-black 18,18,20 → 4,4,4 | **ΔE00 0**, 0% clipping |
| AgX | ΔE00 5.29 (max 10.41), near-black → 8,8,11 | **ΔE00 0**, 0% clipping |
| Neutral | ΔE00 4.33 (max 9.74), near-black → 1,1,4 | **ΔE00 0**, 0% clipping |

So `MeshLambertMaterial` + `toneMapped = false` preserves Gate A's exact artwork under **any** of the
three mappers. D16's baseline is safe if a mapper is ever adopted for another reason. That does not
change this gate's verdict, because the Sky's blocker is the environment leak, not tone mapping.

**E4 verdict — wait.** No `scene.environment` ships in this batch. The measured indoor leak is a new
open-sky light in rooms, the only mitigation r187 offers is a scene-wide intensity, and the plan's stop
condition applies: schedule the interior capture as its own slice and keep the top Sheen stop at
**High gloss**. S1/S2/S4/S6 must not promise "sky-derived reflections" from this evidence, and S4's
gloss labels must not cite it. The PMREM numbers are recorded so that slice starts from a known cost.

**Indoor policy:** accept no reflections indoors (the shipped state), and schedule an interior capture
as a separate slice. Not "damp by enclosure": that needs a mechanism this gate does not have.

### E5 — Paper / Living

**Bench.** The same content under the Paper rig (neutral lights, unlit plate) and the Living rig
(Daylight preset), then Paper with a neutral studio probe at `environmentIntensity` 0.3 and 1.0, and
Paper with the Sky at 1.0. ΔE00 against Paper with no environment.

| Surface | Paper (sRGB) | + studio 0.3 | + studio 1.0 | ΔE00 (studio 1.0) | ΔE00 (Paper vs Living) |
| --- | --- | --- | --- | --- | --- |
| Glossy floor | 161,163,158 | 195,197,190 | 253,255,246 | 22.11 | 12.03 |
| Pale wall | 139,136,128 | 167,164,154 | 217,212,199 | **21.70** | 14.09 |
| White artwork | 146,144,138 | 175,173,165 | 226,223,212 | **21.44** | 14.53 |
| Brass sphere | 22,16,6 | 84,66,37 | 143,114,68 | 36.47 | 0.61 |
| Dark textile | 16,15,20 | 29,27,34 | 47,45,53 | 9.54 | 3.05 |
| Dark wall | 35,33,39 | 45,43,49 | 62,60,67 | 8.65 | 4.22 |
| Black artwork | 6,6,7 | 9,9,11 | 15,15,18 | 2.07 | 0.90 |
| Lambert chart | 19,15,10 | 24,20,14 | 34,29,21 | 5.06 | 3.58 |
| Unlit grey | 128,128,128 | 128,128,128 | 128,128,128 | 0 | 0 |

The D4 candidate fails its own condition. The plan allowed "a neutral studio reflection at most, and
only if E5 shows it does not relight Paper"; at **0.3** the neutral probe already moves the pale wall
from 139 to 167 and the floor from 161 to 195, and at 1.0 it takes them to 217 and 253 (ΔE00 21.7 and
22.1). The Sky is worse (pale wall ΔE00 26.43). Paper stops being the neutral reading as soon as it
gains any environment.

![Paper and Living side by side](./evidence/2026-11-15/gate-b/gate-b-e5-paper-vs-living.png)

**Stage vs visit Paper.** Eight of the ten sampled surfaces are **identical** (ΔE00 0: pale wall, white
artwork, dark wall, black artwork, brass, textile, chart, grey). Only the ground differs — the Stage's
unlit plate reads 161,163,158 where the visitor's lit ground disc reads 233,235,230 (ΔE00 18.09). That
is F4 in pixel terms: the rig values are now the same (ambient 0.12, hemisphere 1.5, sun 1.9), and the
difference is the ground treatment. It is **recorded as intentional**, not reconciled: the editor's
mat is a measured ground, the visitor's ground is lit world content. Changing either is a design
decision outside this gate.

**E5 verdict — go, with D4 = no reflection on Paper.** Paper keeps no `scene.environment` and no
Sky-derived light. The Shell/PLATE Paper row stands unchanged; the contract edit the plan anticipated
for a passing D4 does not apply.

### E6 — Parity and the snapshot colour path

**The defect.** The Stage snapshot renders into an `UnsignedByteType` `WebGLRenderTarget` whose texture
is `NoColorSpace`. r187 renders any non-XR render target in `ColorManagement.workingColorSpace`
(`srgb-linear`) whatever the texture says, and the PNG writer put those linear bytes into the image as
if they were sRGB. A surface authored as 50% grey — `#808080`, 128 — therefore appeared at **55**.

**The fix.** `apps/editor/src/lib/authoring/stage/snapshot-image.ts` is now the one writer:
`encodeSnapshotPixels` flips the bottom-up readback to top-down, maps each channel through the exact
sRGB encode (a 256-entry table over the linear bytes), and forces alpha opaque;
`snapshotDataUrl` returns the PNG data URL. `StageSnapshotRenderer.svelte` calls it and keeps its
shipped 640-wide, `UnsignedByteType` target — the fix costs no GPU memory and no extra draw.

| Measurement | Before (old writer) | After (shipped writer) |
| --- | --- | --- |
| 50% grey patch, Stage framebuffer | 128,128,128 | 128,128,128 |
| Same patch, snapshot | **55,55,55** | **128,128,128** |
| Mean channel difference vs Stage (640 × 400) | not comparable (the pre-fix bench resized its renderer) | **0.54** |
| Channels within 2 levels | — | **96.42%** |
| p99 channel difference | — | **5** |
| Mean ΔE00 over the sampled surfaces | — | **0.61** (max 2.01) |

The remaining maximum channel difference of 152 occurs on object silhouettes: the default framebuffer
is multisampled (`antialias: true`) and the snapshot target has 0 samples, so edge pixels differ while
interior pixels agree. The colour path is exact; edge parity is not claimed.

The real component snapshot agrees with the analytic expectation for the preset sky: the top pixel is
**183,207,205** against an expected 183,207,205 (**error 0**), the bottom row 238,239,230 against
238,240,230 (**error 1**), at a 640 × 400 drawing buffer.

![Snapshot before and after](./evidence/2026-11-15/gate-b/gate-b-e6-snapshot-before-after.png)

**Resolved look values, Stage and Visitor Preview (live production components).** Identical on both:
`toneMapping` 0 (`NoToneMapping`), exposure 1.0, output `srgb`, working `srgb-linear`,
`PCFShadowMap`, background a texture with `colorSpace` `srgb`, `environment` **null**,
`environmentIntensity` 1, ambient 0.12, hemisphere 1.5 (`#f4f7f2` / `#b9b49c`), sun 1.9 (`#fff6df`).
Two differences are named and justified: the sun's **distance** (Stage 22.2, 63.42, 34.88; Preview
8.8, 25.13, 13.82 — the same direction, different shadow-bounds framing), and the material set (the
Stage draws its plate and ink, the Preview draws the visitor's lit ground and Lambert content).

**Cold start: deferred by Gate B, closed as a baseline in Gate C.** The Preview surface records
`visitor:mounted` at **298.5 ms**. Gate B reported that no `visitor:entry-frame` mark exists; that
report was **inaccurate**. The mark has existed since commit `f6de016d` (2026-10-23), but it is a
two-rAF scheduling proxy and is gated on an active visitor runtime (`program` and
`experienceOptions`), which a zero-node Gate B surface does not have. Gate C corrects the record,
adds a renderer-observed `visitor:first-frame` mark, and measures the cold-start baseline on a real
`VisitorPreviewSurface` with a one-view bench program. The `visitor:mounted` value is still not a
load time; the measured first-frame numbers are in [Gate C](#cold-start-baseline--visitor-first-frame).

**One separate defect is recorded, not fixed (F6).** `StageCanvas.svelte` still passes
`environment={environmentShown ? environment : 'paper'}` to the snapshot renderer, so a snapshot taken
while Paper covers a Living World is rendered with the Paper look — while the interaction sheet says
snapshots keep the environment. Fixing it changes what snapshots show and belongs in its own slice
with its own before/after; E6's remit was the colour path, and this gate does not bundle a look change
into it.

**E6 verdict — go** for the snapshot colour fix. Stage, snapshot, Preview and the published visit now
share the pipeline Gate A accepted; snapshots are valid colour evidence within the stated tolerance,
and no longer valid edge-parity evidence.

### Plan assumption recheck

Each F-row of the plan's §2 was re-read against `main` at `dddbdd01` before the bench was built.

| # | Plan claim | Status on `dddbdd01` |
| --- | --- | --- |
| F1 | No tone mapping or exposure is configured anywhere in production | **Superseded by PR #347.** Both Canvases pass `CANVAS_TONE_MAPPING = NoToneMapping`; the factory still sets none. E6 measured `toneMapping` 0 on both surfaces. |
| F2 | No environment reflections exist | **Still true.** `environment: null`, `environmentIntensity` 1 on both surfaces; no `PMREMGenerator` in production. |
| F3 | Haze/fog is declared but unused | **Still true.** `WorldEnvironmentLook.fog` exists for every preset; no `THREE.Fog` is applied, and the Stage's mat comment says so explicitly. |
| F4 | Stage and visit use different Paper rigs | **Partly superseded.** The light values now match (0.12 / 1.5 / 1.9); the difference is the ground and material treatment. E5 measured it: 8 of 10 surfaces exact, ground ΔE00 18.09. |
| F5 | The snapshot target probably writes linear bytes as sRGB | **Confirmed and fixed.** 55 → 128 on the same grey patch. |
| F6 | Snapshots drop the environment while Paper covers | **Confirmed, still present.** Recorded as a separate slice. |
| F7 | Tone-mapped and untonemapped surfaces already coexist | **Still true.** The bench adds the rule: `toneMapped = false` is exact; `envMapIntensity = 0` is not an opt-out. |

### Remaining risks

1. **The gloss promise is still unearned.** No sky reflection ships, so S1/S2/S4/S6 must not describe
   surfaces as reflecting the Sky or the ground. The top Sheen stop stays **High gloss**; a "mirror"
   or "sky-lit gloss" label would still be false.
2. **A future `scene.environment` will leak indoors** unless it arrives with an enclosure-aware policy.
   The measured leak is 4% attenuation by a roof; a scene-wide intensity cannot fix it, and
   `envMapIntensity` is not an escape hatch in r187.
3. **F6 remains a real snapshot look difference.** A snapshot taken under Paper shows Paper even when
   the World is Living.
4. **Cold start was deferred by Gate B and is now a baseline, not a target.** The `visitor:entry-frame`
   mark did exist; Gate B searched a surface with no active visitor runtime. Gate C adds
   `visitor:first-frame` and records the baseline. Do not quote the 298.5 ms mount time as a load
   time, and do not treat the baseline as an optimisation target.
5. **One device, one browser.** PMREM timings are Apple M2 / ANGLE Metal only; no phone-class
   extrapolation.
6. **The bench is not retained.** It is removed before merge; the numbers are reproducible from the
   Gate B commit (below), not from `main`.

### Dev route policy (Gate B)

The Gate B bench (`apps/editor/src/routes/dev/render-audit/` with its `+page.server.ts` 404 guard and
its dev-only `save/+server.ts` evidence writer) was removed in the same PR, following Gate A's policy.
It is not a product route and is not retained in the tree. Its source is reproducible from the Gate B
commit (see Evidence).

### Evidence (Gate B)

- [Contact sheet — 24 variants, the opt-out, the chart and the E6 tiles](./evidence/2026-11-15/gate-b/gate-b-contact-sheet.png)
- [Indoor Daylight under the Sky environment](./evidence/2026-11-15/gate-b/gate-b-e4-indoor-daylight-sky.png)
- [Outdoor Daylight under the Sky environment](./evidence/2026-11-15/gate-b/gate-b-e4-outdoor-daylight-sky.png)
- [Paper vs Living](./evidence/2026-11-15/gate-b/gate-b-e5-paper-vs-living.png)
- [Snapshot before and after](./evidence/2026-11-15/gate-b/gate-b-e6-snapshot-before-after.png)
- [Machine-readable result](./evidence/2026-11-15/gate-b/gate-b-result.json) — every number above,
  with its sampling misses (all zero)
- Source provenance: commit `120419bf` on `t2/s0-gate-b-look-truth`, delivered in PR #349 (removed
  from the tree; reproduce with `git show 120419bf:apps/editor/src/routes/dev/render-audit/audit.ts`)

## Gate C — E7 rendering performance and shadow budget

**Status:** measured 2026-11-15 on `main` at `2d73bf6f`; delivered in one open, unmerged Tier 2 PR
([#351](https://github.com/Biskiq/spatial-sketch-editor/pull/351)). Gate C is the final slice of the
CP0 Rendering Foundation and is flagged for the owner checkpoint. D9 is **proposed**, not adopted.

Gate C asked for bounded Stage and Visitor readings on reference Worlds, not a benchmark campaign.
It ran three Worlds through the shipped Stage and the visitor rendering path at 1280 × 720, DPR 1,
for 10 s per run: `empty`, `small-room` (the canonical 7 × 6 starter enclosure) and `gallery-wall`
(a 12 × 7 room with six textured Plane primitives on the far wall; these are scene primitives, not
A1 Artwork). Stage was measured through `StageCanvas`; visit frame time through a bench host that
mirrors `VisitorPreviewSurface`'s renderer and visitor components without the HUD or Camera input.
Cold start used the real `VisitorPreviewSurface` with a synthetic one-view program. `rest`, `orbit`
and `drag` (2 s of movement in the 10 s window) were sampled, plus a shadow-off control on the
gallery visit. The bench camera sits inside each room; an earlier capture that put it outside the
near Wall was discarded and the matrix rerun.

### Environment and method

| Fact | Value |
| --- | --- |
| Device | Apple M2, 8-core GPU, 16 GB |
| Browser / GPU backend | Chrome 153, ANGLE Metal, hardware acceleration on |
| Viewport | 1700 × 950 page; measured surfaces **1280 × 720**, DPR 1 |
| Display | 60 Hz; frame intervals are vsync-quantised |
| Sampling | 10 s per run; `requestAnimationFrame` intervals; renderer `info.render` read once per frame after the frame boundary |
| Stage path | Shipped `StageCanvas`, orbit input through the production Camera controller |
| Visit path | Bench host with the same `createManagedWebGLRenderer`, `WorldEnvironment`, layout shell, entities and shadow settings as `VisitorPreviewSurface`; no HUD, no Camera input |
| Worlds | `empty`; `small-room` 7 × 6 m; `gallery-wall` 12 × 7 m + six textured quads |
| Shadow control | Gallery visit with the sun's `castShadow` off, all else identical |

The runner is a visible Chromium instance with background throttling disabled. The in-app preview
tab reported `document.hidden = true` and paused `requestAnimationFrame`, so its numbers were not
used.

### Frame intervals and workload

Stage `rest` rendered **0 frames** in every World: the shipped on-demand loop is confirmed. The
Visitor loop always renders. `orbit` and `drag` for the Stage, and all three patterns for the visit,
produced 600–601 frames per 10 s window. The table gives the p50, p95 and maximum of the frame
interval distribution and the median per-frame renderer counts. `Allocated textures` is
`renderer.info.memory.textures`, and `Compiled programs` is `renderer.info.programs.length`: these
are allocation counters, **not per-frame texture bindings or draw calls**. `Calls` and `Triangles`
are the per-frame draw counters.

| World | Surface | Pattern | Frames | p50 ms | p95 ms | max ms | Calls | Triangles | Allocated textures | Compiled programs | Shadow maps/frame |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| empty | Stage | orbit | 600 | 16.70 | 17.70 | 18.00 | 4 | 70 | 3 | 4 | 0.00 |
| empty | Stage | drag | 120 | 16.70 | 17.60 | 19.00 | 4 | 70 | 3 | 4 | 0.00 |
| empty | Visit | rest | 600 | 16.70 | 17.60 | 18.30 | 3 | 450 | 4 | 3 | 1.00 |
| empty | Visit | orbit | 601 | 16.70 | 17.70 | 18.30 | 3 | 450 | 4 | 3 | 1.00 |
| empty | Visit | drag | 601 | 16.70 | 17.70 | 17.90 | 3 | 450 | 4 | 3 | 1.00 |
| small-room | Stage | orbit | 600 | 16.70 | 17.60 | 17.90 | 11 | 908 | 4 | 6 | 0.00 |
| small-room | Stage | drag | 120 | 16.60 | 17.60 | 17.80 | 11 | 908 | 4 | 6 | 0.00 |
| small-room | Visit | rest | 601 | 16.70 | 17.60 | 17.70 | 14 | 2,120 | 4 | 6 | 1.00 |
| small-room | Visit | orbit | 600 | 16.70 | 17.70 | 18.80 | 14 | 2,120 | 4 | 6 | 1.00 |
| small-room | Visit | drag | 601 | 16.70 | 17.60 | 17.80 | 14 | 2,120 | 4 | 6 | 1.00 |
| gallery-wall | Stage | orbit | 599 | 16.70 | 17.70 | 28.10 | 15 | 1,300 | 6 | 7 | 0.00 |
| gallery-wall | Stage | drag | 120 | 16.70 | 17.70 | 17.90 | 17 | 1,304 | 6 | 7 | 0.00 |
| gallery-wall | Visit | rest | 601 | 16.70 | 17.60 | 18.30 | 26 | 2,912 | 6 | 7 | 1.00 |
| gallery-wall | Visit | orbit | 601 | 16.70 | 17.70 | 19.60 | 24 | 2,908 | 6 | 7 | 1.00 |
| gallery-wall | Visit | drag | 600 | 16.70 | 17.70 | 17.80 | 25 | 2,910 | 6 | 7 | 1.00 |
| gallery-wall | Visit | orbit, shadows off | 600 | 16.70 | 17.70 | 18.00 | 14 | 1,680 | 4 | 6 | 0.00 |

Stage `rest` is absent from the table because it rendered nothing. Its counts are zero by definition,
not a missing sample. One gallery Stage orbit frame reached 28.10 ms; the p95 is 17.70 ms and no
other run exceeded 19.60 ms.

**Reading the table.** The reference laptop is **vsync-bound** at 60 Hz: p50 is 16.70 ms in every
rendering run, and the p95 spread (17.6–17.7 ms) is scheduling jitter, not scene cost. The workload
columns are therefore the useful shadow evidence; the frame interval alone cannot distinguish a
450-triangle empty visit from a 2,912-triangle gallery visit on this device.

### Shadow cost

The gallery visit is the controlled comparison. With the sun casting:

- **24–26 draw calls**, **2,908–2,912 triangles**, **6 allocated textures**, **7 compiled programs**, **1 shadow pass and 1 shadow map per frame**.

With the sun's shadow off, all else identical:

- **14 draw calls**, **1,680 triangles**, **4 allocated textures**, **6 compiled programs**, **0 shadow passes, 0 maps**.

The shadow pass costs at least **10 draw calls, 1,228 triangles, two allocated textures and one
additional compiled program**. It does **not** move the p95 (17.70 ms both ways) because the frame
is vsync-bound. That is the key limitation of a wall-clock-only budget: on this reference laptop the shadow cost is
visible in the renderer workload, not in the frame interval. The Stage confirms the on-demand path:
**0 shadow maps per frame** in every 600-frame orbit, including the gallery. The Stage's shadow map is
drawn on dependency change, not per frame.

### D9 proposal — shadow budget and refusal policy

**Status: proposed for owner authorisation. Not adopted by this PR.**

**Measured baseline — preserved.** The bench measured one shadow-casting Sun: one **2048 × 2048**
`PCFShadowMap`, radius 3, `normalBias` 0.02 on the visitor path and 0.05 on the flat Stage plate;
**1 map per frame on the visit** and **0 maps per frame on the Stage** while the camera moves.

**The approved Shadow controls stay live.** T2 approves a Shadow control on Spot and Directional,
and on Point with Shadow **off by default** (T2 README §5; S3 plan §6.4). D9 must not disable, hide or
auto-change those controls, and S3's provisional `castShadow: false` creation default is unchanged.
A creator can still turn a Spot or Point shadow on. The earlier Gate C draft refused “a second
caster” and “a shadow-casting point light”; that refusal is **withdrawn** because it conflicted with
the approved controls and would have left them inert. No Shadow control is disabled by D9.

**Proposed budget — per caster, not a cap on the approved controls.**

- One 2048² PCF shadow map per shadow-casting Directional or Spot; a shadow-casting Point light uses
  six cube faces/maps. The measured Sun is one map.
- Visit: one shadow map per enabled caster per frame, except the Point cube shadow's six faces;
  Stage: zero shadow maps per frame while the camera moves (invalidation on dependency change only).
- The one-Sun World is the only measured total: **1 map per frame**. Multi-caster totals are
  **unmeasured**; D9 does not invent a maximum caster count or a multi-caster frame cost.

**Refusal rule — architecture and quality, not the approved controls.** A map larger than 2048²,
cascaded shadow maps, a baked or cached shadow architecture, and a per-frame shadow update on the
Stage remain refused for this batch. Any silent runtime map-size reduction, shadow disablement or
light cap also remains refused. Additional Spot/Point casters are **not refused**; they are
contract-valid but unbudgeted until measured.

**Unresolved owner policy — multi-caster shadows.** D9 cannot set a multi-caster total from
one-caster evidence. Choose one:

1. **Measure before promising (recommended):** measure additional Spot/Point casters on the same
   Worlds in S3 or its own bounded slice, then set a total map/caster budget. Controls stay live
   meanwhile, with no performance promise for multi-caster Worlds.
2. **Cap in D9 before S3:** set a maximum simultaneous map/caster count with a visible
   refusal/notification state; never disable a control silently or leave it inert.
3. **Ship with no multi-caster budget:** keep the controls and mark multi-caster cost unmeasured,
   with no “budgeted” claim.

**Frame targets on the reference laptop.** Stage drag p95 ≤ 2 display periods (33.3 ms): **met** at
17.6–17.7 ms. Gallery visit p95 ≤ 33 ms: **met** at 17.6–17.7 ms. Visitor idle: the original p95 ≤ 1
display period (16.7 ms) is retained as **aspirational**; the proposed allowance is **1.1 display
periods (~18.3 ms) p95**. The measured 17.6–17.7 ms is within the proposed allowance and misses the
aspirational target. p50 is 16.70 ms; the difference is about 1 ms of scheduler jitter, not scene or
shadow work.

**Owner decisions requested:**

- Adopt D9's measured one-Sun baseline, per-caster 2048² PCF budget, withdrawn Spot/Point refusal,
  and the 18.3 ms Visitor idle allowance with 16.7 ms retained as aspirational.
- Choose the unresolved multi-caster policy: measure, cap visibly, or ship unmeasured.
- Confirm that phone-class hardware remains **unmeasured** and that no phone extrapolation is made
  from the M2 numbers.

### Cold-start baseline — Visitor first frame

Gate B deferred visitor cold start because it could not find a first-frame mark. Gate C adds the
minimal measurement and records a baseline, not a target:

| World | Mount request → mounted | → first rendered frame | → existing `entry-frame` |
| --- | ---: | ---: | ---: |
| empty (first surface mount after page load) | 78.9 ms | 100.7 ms | 104.6 ms |
| small-room (fresh mount, warm page) | 15.5 ms | 61.0 ms | 62.4 ms |
| gallery-wall (fresh mount, warm page) | 15.2 ms | 72.0 ms | 73.0 ms |

**Instrumentation.** `visitor:mounted` and `visitor:entry-frame` already existed. `entry-frame` is a
two-rAF scheduling proxy gated on an active visitor runtime. Gate C adds `visitor:first-frame`,
which observes the renderer's own `info.render.frame` counter at the next scheduling opportunity
(`apps/editor/src/lib/visitor/first-frame.ts`, mounted by `VisitorFirstFrame.svelte` inside the
Preview Canvas). It is inert unless performance marks are enabled. It is a renderer-observed frame,
not a physical scanout proof. The existing `entry-frame` remains; it is not renamed or removed.

**How to read it.** These are **surface** cold starts on an already-loaded page, with a synthetic
one-view program: they include the visitor renderer and its first frame, but not network, bundle
parse, or the welcome/published route. The first-ever empty mount (100.7 ms to first frame) includes
module and page warm-up; the warm-page mounts are 61.0–72.0 ms. The baseline is recorded; no
optimisation target is set and no code was changed to move it.

### Limitations and remaining risks

1. **One device, one browser.** Apple M2 / ANGLE Metal / Chrome 153 only. Phone-class hardware is
   **unmeasured**; do not extrapolate thermal, memory or fill-rate behaviour.
2. **The laptop is vsync-bound.** Frame intervals hide shadow cost at 60 Hz. D9's budget is a
   map/pass and draw-work budget, not a measured GPU-time cap. A slower device could turn the
   10-call / 1,228-triangle shadow pass into a visible cost that this bench cannot see.
3. **The visit path is not the full product surface.** HUD, Camera input, selection and the welcome
   route are excluded. The visit frame-time host mirrors the renderer and visitor components, but it
   is a bench host, not `VisitorPreviewSurface` itself. Cold start does use the real surface.
4. **The gallery is primitives, not Artwork.** Six textured Plane entities exercise the shadow path;
   they do not measure A1's material palette or texture sizes.
5. **No GPU timer queries.** The renderer counts are CPU-side `info.render` readings. They are
   consistent with the shadow-off control but are not a GPU profile.
6. **The bench is removed before merge.** Gate A/B policy: no product route. The numbers are
   reproducible from the Gate C commit, not from `main`.
7. **D9 is not in force until the owner adopts it.** S3 Lights and A1 Artwork must not cite this as an
   accepted budget before then.

### Evidence (Gate C)

- [Machine-readable result](./evidence/2026-11-15/gate-c/gate-c-result.json) — all 19 runs, the three
  cold starts, environment, sampling and the proposed budget
- [Stage — gallery wall at 1280 × 720](./evidence/2026-11-15/gate-c/gate-c-stage-gallery.png)
- [Visitor — gallery wall at 1280 × 720](./evidence/2026-11-15/gate-c/gate-c-visit-gallery.png)
- Source provenance: commit `4ee65fb8` on `t2/s0-gate-c-rendering-budget` (bench route and runner
  removed in the next commit; reproduce the evidence writer from `4ee65fb8`)

### Checks (Gate C)

- `npm run check`: 0 errors, 12 pre-existing warnings.
- `npx vitest run tests/lib/visitor/first-frame.test.ts`: 3 tests pass.
- `npm run test:arch`: pass.
- `npm run build`: pass.
- The 19-run matrix completed and wrote 19 runs plus three cold starts to the evidence
  JSON; two captures were saved.
