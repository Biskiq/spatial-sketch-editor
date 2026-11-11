# T2 S0 — Rendering gate: implementation plan

**Status:** Gate A approved and measured, 2026-11-11. This PR claims the slice **`T2.S0`**, not a
creator capability: `tools/harness/ledger.mjs` defines capability ids as things a creator would say
they can do, and a rendering gate is an engineering slice, so no `capabilities.json` row is added.
Gate A added a dev-only bench and **no production change**. Gate B and Gate C are **not authorised**;
this draft PR carries the Gate A records and waits for the owner’s checkpoint.

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

**Bench:** a white Lambertian plane at 1 m and 3 m; one point, one spot and one directional light,
each at intensity 1 with default decay; the fixed camera and viewport from E2.

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

**Measurements:** p50/p95 frame interval; `renderer.info` calls, triangles and textures; shadow maps
per frame; PMREM ms (from E4); the device and browser.

**Acceptance:**

- D9 is a shadow budget with numbers and a refusal rule in words.
- The reference laptop has a stated p95 target per surface. Proposal: Stage drag ≤ 2 display
  periods; visit idle ≤ 1; gallery p95 ≤ 33 ms on the reference laptop.
- Any device not measured is marked **unmeasured**, never extrapolated.

**Stop:** no "smooth" claim without p95; no desktop-to-phone extrapolation. If the budget cannot be
met with the approved light kinds, reduce the default shadow set rather than silently capping at
runtime.

## 5. Decisions this plan asks the owner to make

| Decision | Recommendation | When |
| --- | --- | --- |
| Tone mapping | **Measured: no mapper.** E2 rejected Neutral (mid-tone ΔE00 4.07), ACES (3.35) and AgX (6.35); None + Lambert scored 0 across all 18 patches. Gate B may reopen only through a D16 decision. | Gate A done |
| D5 light units | Keep physical stored units; Brightness stops are a UI mapping fixed by E3. | After E3 |
| D4 Paper reflections | **No Sky reflection on Paper**; a neutral studio reflection at most, and only if E5 shows it does not relight Paper. | After E5 |
| D9 shadow budget | Set from E7; refuse in words beyond it. | After E7 |
| D16 artwork response | **Measured: lit, matte, diffuse-only.** `MeshLambertMaterial` + `NoToneMapping` was exact (ΔE00 0); the standard PBR material lifted near-black by ΔE00 5.16. No unlit option needed. | Gate A done |
| Snapshot colour path | Treat F5 as a defect to verify and fix, not a look decision. | E6, before parity evidence |

### Gate A outcome (2026-11-11)

- **E1:** pipeline captured at Three r187: sRGB output, `srgb-linear` working space,
  `NoToneMapping`, exposure 1.0, `PCFShadowMap`; readback calibration passed with maximum channel
  error **0**.
- **E2:** `MeshLambertMaterial` + `NoToneMapping` reproduced all 18 source patches exactly (ΔE00 0,
  no clipping). The standard PBR material passed the mid-tone target but lifted near-black by 5.16;
  ACES, AgX, Neutral and Neutral @ 1.1 all failed the mid-tone target.
- **E3:** stored intensity is physical (candela for point/spot, lux for directional) with `decay = 2`;
  intensity π produced unit irradiance at 1 m for all three kinds. The five Brightness factors
  measured 0.252 / 0.496 / 1.000 / 2.011 / 3.999.
- **Decision:** keep `NoToneMapping`, exposure 1.0, and give Artwork a diffuse-only lit material.
  This keeps D16 lit and matte; it does not change the promise.
- **Snapshot:** the 640 × 360 `UnsignedByteType` target has `NoColorSpace`, so r187's linear target
  bytes are not sRGB-encoded. Gate A did not use it; E6 owns the fix.
- **Unblocked:** S3 Lights and A1 Artwork may consume [pipeline.md](./pipeline.md) and
  [artwork-fidelity.md](./artwork-fidelity.md). Gate B and Gate C remain waiting.

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
   unmeasured; it does not extrapolate.
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

This PR is planning only. Its checks are:

- `git diff --stat` shows the plan file only; no production file changes.
- No unit, integration, build or benchmark run is required or claimed. This is deliberate and
  matches the request and the performance policy.
- The plan's paths and line-level claims were read from the base commit `b9908410`.

Once Gate A is approved, its bench route gets a focused browser QA pass; E2/E3 evidence is captured
from that route, not from a full browser journey.

## 11. Approval gate

The owner reviews this plan in the draft PR. On approval:

1. Gate A starts in this same PR and produces `pipeline.md`, `artwork-fidelity.md` and the Gate A
   evidence. S3 and A1 may start against those records.
2. Gate B follows, then Gate C.
3. If Gate A overturns a T2 promise (top Sheen, see-through, Glow, artwork response), stop before
   Gate B and return to the owner. The gate exists to decide what may be promised; it must not
   quietly rewrite the promise.
