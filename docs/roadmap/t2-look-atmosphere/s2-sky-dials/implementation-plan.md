# T2 S2 Sky dials implementation plan

**Claim:** T2 S2 Sky dials. **Base:** `main` at `a7f672db` (T2.S1 Look schema, Scene 8, #354).
**Tier:** 1 for the work itself: a shared shell surface and contract details, with no format change.
**O1** below departs from the owner-accepted Gallery UX rev 4 §4.3, which makes the PR **Tier 2**
until the owner rules on O1. Everything else follows from merged contracts.

## Goal and scope

S2 makes the Scene 8 Sky editable. The existing toolbar **Sky popover** gains live dials:

- Time, Direction, Haze and Brightness;
- a **More** group with the colours and shadow softness;
- an *edited* state and **Reset**.

A **sun mark** on the Stage drags the Sun directly. S2 also renders Haze in the shared
`WorldEnvironment`, so the Stage, Visitor Preview and the published visit change together. The
popover becomes the one environment writer, and the unmounted environment panel is retired.

In scope:

- planner `scene-sky-update`, the one new write;
- the popover dials and More rows, the edited state, Reset and the chip reading;
- the session-only Sky preview;
- the sun mark through a new `sky` Stage adapter;
- Haze rendering, its fog exemptions, and Sun shadow invalidation;
- retiring `StageEnvironmentControl.svelte`, the inert hour slider and the fake hours table;
- contract amendments: Shell/PLATE and `rendering.md`;
- a #353 diagnosis step, with a correction only under the ownership rule below.

Out of scope:

- S4 Finish, S6 Looks and Treatment UI;
- reflections and environment maps;
- the Celestial Dial, the bottom-right Environment control, Moon, night and twilight phases (O1);
- any Scene format change;
- Spot/Point shadow quality (S3);
- a colour-picker redesign, and exact-number fields.

## Decisions settled by existing contracts

| # | Decision | Source |
| --- | --- | --- |
| C1 | No format change. S2 writes only Scene 8 fields: `sun.{azimuth, elevation, color, intensity, softness}`, `zenith`, `horizon`, `ground`, `haze.{color, visibility}`, `hemisphere.{skyColor, groundColor, intensity}`. | Roadmap §12 ("—"); S1 plan; user constraint |
| C2 | Time is a UI reading of `sun.elevation`, never stored. Brightness is a writer over the two intensities. Shadow fill is a reading of the hemisphere colours. | S1 plan, Sky shape |
| C3 | *Edited* is exact equality with `SCENE_SKY_PRESET_STARTS[sky.preset]`. A preset choice writes the full start and keeps Treatment. Paper removes the Sky. Choosing the current preset on an edited Sky resets it. | S1 `scene-environment-set` |
| C4 | Haze renders as `FogExp2(haze.color, √(ln 50) / visibility)`. An absent `visibility` is clear air. S2 chooses the exemptions. | `docs/reference/components/rendering.md` §Haze |
| C5 | Softness maps to `radius = 1 + 4·softness` texels on the one Sun. | S1, `sunShadowRadius` |
| C6 | The Sky is not a Card subject (D7). The unmounted environment panel retires with S2. The inert hour slider goes (D18). No control is shown before it works. | Roadmap D7, D18, §12 |
| C7 | One undo step per gesture. A cancelled gesture writes nothing. | Roadmap §12 checks |
| C8 | Live preview is session-only, rAF-coalesced and never saved. It follows `stage-light-preview.svelte.ts` and the Light Card slider lifecycle: `input` previews, `change` commits once, Esc restores. | Light authoring precedent |
| C9 | Stage marks: idle marks via `idleHandles`, claimed by `pressWhenNoTask` + `pointerIntent`, and selection marks win overlaps. An editing grip names a planner its adapter registers. | `stage-handles.ts`, `contribution-view.ts`, `stage-facade.ts` |
| C10 | No reflections (E4 wait). Built-in materials only. No `EffectComposer`. Renderer API stays in render modules. | S0 report; renderer-portability boundary test |

## Owner decisions

**O1 — Time model and the Celestial Dial (the one genuine conflict).**

UX rev 4 §4.3 stores `time`, `heading` and `arcHeight`, with azimuth and elevation derived. It adds
Moon, dusk and dawn phases, six presets and a Celestial Dial in a bottom-right Environment control.
That model needs a Scene format bump. Merged Scene 8 stores `azimuth`/`elevation`, and this brief
forbids a bump and a UI overhaul.

**Recommendation (planned below):**

- S2 implements the §4.3 *day-arc reading* over the stored fields: the afternoon half, for Time.
- Direction is the stored azimuth.
- The Celestial Dial, the bottom-right control, the morning half, night/Moon and twilight phases, and
  "presets never write heading" go to a later presentation-plus-format slice.

The owner confirms this, or chooses to bump the format first (S2 then waits). Until then the PR is
Tier 2.

**O1 consequences the owner accepts with it:**

- (a) Morning times are not expressible. Each elevation reads as one afternoon time, so Time and
  Direction stay independent.
- (b) A preset tile resets Direction too, because S1's planner writes the full start and there is
  no stored heading to keep.
- (c) The sun mark is a polar sky-chart mark on the floor, not the §4.3 dial ring.

No other owner decision is needed: every other row below follows from C1–C10 or is an
implementation default named explicitly.

## Interaction contracts

### Popover structure and states

The chip in the drafting bar (`SkyControl.svelte`) keeps its place and trigger.

- **Chip text:**
  - Paper: `Paper`.
  - A Sky: `{preset label}[ · edited] · {Time reading}`, e.g. `Golden hour · edited · 18:00`.
  - The fake `hours` table is removed.

- **Header:**
  - The title `Sky`.
  - On an edited Sky only, a text button **Reset**. It dispatches `scene-environment-set
    {preset: sky.preset}`. It is absent otherwise, never disabled (D18).

- **Tiles:** Paper · Daylight · Golden hour · Dusk.
  - The current preset's tile shows `aria-pressed="true"`.
  - An edited Sky's tile also carries a small `edited` tag.
  - Pressing a tile is unchanged from S1: the full start, Paper removes, and pressing the current
    tile on an edited Sky resets.
  - Tile subtitles come from `WORLD_ENVIRONMENT_PRESENTATIONS`.

- **Dials** (only with a Sky): Time, Direction, Haze, Brightness, in that order. Each is a label,
  a range input and a readout.

- **More** (a disclosure, closed by default; its open state is per-browser `localStorage`, guarded
  by try/catch):
  - Sun colour.
  - Sky: Zenith and Horizon.
  - Ground: Ground and Far (`haze.color`).
  - Shadow fill: Fill (`hemisphere.skyColor`) and Bounce (`hemisphere.groundColor`).
  - Softness.

- **Paper:** no dials and no More, only the line `Pick a Sky to adjust it.`

- **"Plain Paper while editing · this browser" on:** the dials stay operable and the sun mark is
  hidden. One note line reads `Stage shows Paper · Preview shows this Sky.`

- **Busy** (a commit in flight): every dial and tile is `aria-disabled`, and a new gesture is
  refused. The input values stay put.

- **Non-modal popover** (a change from today):
  - An outside pointerdown no longer closes it, so the user can drag the sun mark and orbit with
    the popover open.
  - It closes on the chip press, Esc when no gesture is live, or switching to the Experience lens.
  - Width stays 286 px. Height grows; with More open it scrolls internally (`max-height:
    calc(100vh - toolbar - 24px)`).

- **During a sun-mark drag:** the popover fades to opacity 0.2 and `pointer-events: none`. It
  returns on release or cancel.

### Dials: mappings, ranges, defaults

All angles are stored in radians and shown in degrees. `D = 180/π`. Each dial's thumb reads the
current Sky, or the preview while a gesture is live. There are no separate defaults: every
preset's start *is* the default, and Reset restores it.

**Time** (elevation, the afternoon day arc):

- `ARC = 62°`, the §4.3 default arc height. Range 13:00 → 19:30 (sunset).
- **Write:** `u = (t − 6.5)/13`, `el = ARC·sin(πu)`. 19:30 gives exactly `0`.
- **Read:** `el ≤ ARC` gives `t = 6.5 + 13·(1 − asin(el/ARC)/π)`.
- **Out of range:** `el > ARC` reads `13:00` with a **hollow, pinned thumb**, and the readout shows
  the exact elevation. Dragging from it writes normally.
- **Readout:** `HH:MM · N° high` (minutes rounded, degrees rounded), e.g. `18:00 · 22° high`.
- **Presets read** Daylight `14:41 · 57° high`, Golden hour `18:00 · 22° high`, Dusk
  `18:07 · 20° high`.
- **Snap:** 5 minutes on pointer drag. Keys: ←/→ ±15 min, Shift ±1 h, Home 13:00, End 19:30.
  No wrap.
- **Slider units:** minutes since 13:00, `min=0 max=390 step=5` (pointer) and `step=1` for
  hollow-thumb display. Keys are handled explicitly; see the gesture rules.

**Direction** (azimuth; 0 = +Z, increasing toward +X):

- Range 0°–360°. Stored `[0, 2π)`, so 360° writes `0`.
- **Readout:** `N°`, e.g. `148°`. There is no compass name: the Stage has no north.
- **Snap:** 15° on pointer drag, freed while Alt is held. The modifier is read from the latest
  pointer or key event of the gesture, because range `input` events carry none.
- **Keys:** ←/→ ±15°, Shift ±45°, wrapping at 0/360.
- **Presets read** 32°, 287°, 148°.

**Haze** (visibility, log scale):

- Slider `h ∈ [0, 1]`, step 0.01.
- `h < 0.02` is **Clear**: it writes `haze.visibility` absent (patch `null`).
- Otherwise `visibility = 500·(15/500)^h` m: 500 m at `h → 0`, 15 m at `h = 1`.
- **Read:** absent gives `h = 0`. Otherwise `h = ln(500/v)/ln(500/15)`, clamped.
- **Out of range:** `v > 500` or `v < 15` (valid S1 values from 5 to 100 000) shows a hollow pinned
  thumb with the exact readout.
- **Readout:** `Clear` or `N m visibility` (`N` to 2 significant figures). Presets read `Clear`.
- **Keys:** ±0.05, Shift ±0.2.

**Brightness** (a scale over the preset's start intensities):

- `k = sun.intensity / start.sun.intensity`.
- **Write:** `sun.intensity = start.sun.intensity·k` and
  `hemisphere.intensity = start.hemisphere.intensity·k`.
- **Slider:** `p ∈ [0, 1]`, `k = 4^(2p − 1)`, so ¼×–4×.
- **Detents** at ½×, 1× and 2× (`p = 0.25, 0.5, 0.75`). Pointer values within ±0.02 snap; Alt frees.
- **Readout:** `1×`, `1.4×` (2 significant figures).
- **Non-proportional hemisphere:** if `|hemi.intensity/start.hemi.intensity − k| > 1e-6·k`, the
  readout appends `· custom fill`. The first Brightness write normalizes both.
- **Out of range:** `k` outside ¼–4 shows a hollow pinned thumb. A zero start intensity cannot
  occur in the three presets; if it did, the dial is not rendered (D18).
- **Keys:** p ±0.05, Shift ±0.2.

**Colour rows** (More):

- Native `<input type="color">`: `input` previews, `change` commits once. Values are written
  lowercase `#rrggbb`.
- Each row shows a swatch and its label.
- The Light Card's warmth/hue dial lives inside `LightCardFields.svelte`; it is not extracted in S2.

**Softness** (More):

- Range `[0, 1]`, step 0.01, with a detent at 0.5 (±0.02).
- **Readout:** `Crisp` (< 0.15), `Soft` (0.15–0.75) or `Very soft` (> 0.75), followed by the value
  to 2 decimals.
- **Keys:** ±0.05, Shift ±0.2.

### Gesture lifecycle (dials, colour rows, keys)

One **gesture** is one of:

- a pointer press on a slider through release;
- one colour-picker session (first `input` through `change`);
- a **key burst**: the first handled keydown through the keyup of the last held key on that input.

Rules:

1. **Begin.**
   - Refused while busy.
   - Captures `acceptedRevision` from `services.stage.snapshot()` and the accepted Sky.
2. **Move.**
   - Computes the full next Sky from captured Sky + the dial's write. It never reads the preview
     back.
   - Sets the look preview, rAF-coalesced.
   - Brightness writes both intensities from the captured preset start.
3. **Commit** on `change`, pointerup, or the burst's keyup.
   - Builds the patch as the difference between the preview Sky and the captured Sky.
   - An empty patch commits nothing.
   - Otherwise it dispatches one `scene-sky-update`, with `expectedRevision` = the captured
     revision.
   - It keeps the preview until the accepted Sky lands, so nothing flashes, then clears it.
4. **Cancel** on Esc, pointercancel, blur during a pointer gesture, the popover closing, the lens
   changing, or Preview opening.
   - Clears the preview and resets the input to the accepted reading.
   - Swallows the trailing `change`.
   - Writes nothing.
   - Esc is consumed: it does not also close the popover. A second Esc closes it.
5. **Revision drift.** If the accepted revision changes mid-gesture (Undo/Redo or another writer),
   the gesture cancels and writes nothing.
6. **Refusal.**
   - Clears the preview and resyncs the input.
   - Shows the existing look notice, except for `no-change`, which is silent.
   - A `stale-revision`-class refusal is handled the same way.
7. **Undo/Redo.** One step per committed gesture. A key burst of four presses is one step. Undo
   restores the prior Sky exactly, including an absent `visibility`.

### Sun mark

**Authority:**

- A new `sky.adapter.ts` with `plannerKinds: ['scene-sky-update']`. It owns no subject and no
  pick, and is never selectable.
- It contributes through `idleHandles` only, so it appears only when no task is open.

**Shown when all of these hold:**

- the Sky popover is open (`sky-session.svelte.ts` `skyPopoverOpen(projectId)`, module state on
  the `light-tool.svelte.ts` precedent);
- the accepted Sky is present;
- Plain Paper while editing is off;
- the lens is World and `worldMarksOffered` holds;
- Visitor Preview is not open.

It is never in the visitor, the published route or the snapshot renderer.

**Geometry** (a polar sky chart on the datum plane):

- **Anchor `C`:** the Sun target's plan centre at datum height, from a pure
  `sunMarkAnchor(look, frame)` in `world-environment.ts`, which shares the bounds arithmetic with
  `resolveSkySun`.
- **Radius `R`:** the host ring calibration (72 CSS px, 144 px across) × `metersPerCssPixel` at
  `C`. It is recomputed per frame while idle and **frozen at press** for the drag.
- **Sun grip** (`point`): at `C + R·(1 − el/(π/2))·(sin az, 0, cos az)`, with `stem: C`. Zenith
  sits at the centre and the horizon on the ring.
- **Bearing grip** (`ring`): radius `R` about +Y, phase at `az`.

**Drag:**

- **Sun grip:** intersect the pointer ray with the datum plane. With `d = hit − C`:
  - `az = atan2(d.x, d.z)` normalized to `[0, 2π)`;
  - `el = (π/2)·(1 − clamp(|d|/R, 0, 1))`.
  - A grazing ray (no hit, or beyond 1000 m) keeps the last value.
  - Elevation snaps to the Time dial's 5-minute grid when `el ≤ ARC` (it is free above), and
    azimuth to 15°. Alt frees both.
- **Bearing grip:** azimuth only, relative to the press angle (`az₀ + Δθ`), with the same snap.
  Elevation is untouched.
- **Value tag** at the grip: `Sun 148° · 22° high · 18:00`. Above `ARC` it drops the time.
- **Feedback:**
  - Hover: grip emphasis and the tag.
  - Drag: grip, stem and a faint direction ray from `C` toward the Sun at ink weight.
  - The popover fades (see above). Dials follow the preview live.

**Transaction:**

- Press: acquire `services.stage.acquireGesture`, capture the revision and Sky.
- Move: preview.
- Release: one `scene-sky-update {sun: {azimuth, elevation}}`. An unchanged result commits nothing.
- Esc or pointercancel: restore and write nothing.
- Revision drift cancels. Release the lease on every path.

**Conflicts:**

- Selection marks win overlaps; the host lists them first.
- A press that misses both grips falls through to navigation and selection as today.
- A claimed press beats camera navigation.
- In Plan view the mark draws the same way, since it sits on the datum plane.
- With a task open the mark is hidden, so tools are unaffected.

### Presets, edited, Paper and Living

- A tile press or Reset follows C3.
  - Edited → Reset → not edited: one undo step.
  - A tile on an unedited current preset is `no-change`, silent.
- **Paper** removes the Sky; Undo restores it exactly. Dials, More and the sun mark disappear,
  with no inert remnant.
- **Living | Paper** in the toolbar is the Plan *material* toggle, not lighting. S2 does not
  change it.
- **Plain Paper while editing:** see the popover states. Stage rendering uses
  `editOnPaper ? null : (previewSky ?? sky)`.

## Planner `scene-sky-update`

**Location:** `packages/project-model/src/units/planning.ts`, next to
`createSceneEnvironmentSetPlanner`. It is registered in `createUnitCandidatePlanners`.

**Payload** (strict reader; unknown keys are refused):

```ts
type SceneSkyUpdatePayload = {
  sun?: { azimuth?: number; elevation?: number; color?: string; intensity?: number; softness?: number };
  zenith?: string; horizon?: string; ground?: string;
  haze?: { color?: string; visibility?: number | null }; // null removes visibility
  hemisphere?: { skyColor?: string; groundColor?: string; intensity?: number };
};
```

`preset` is not patchable. An empty payload, or an empty nested object, is `invalid-payload`.

**Refusals:**

| Condition | Code |
| --- | --- |
| No Sky (Paper) | `unsupported-operation` |
| Payload shape wrong or unknown key | `invalid-payload` |
| Merged Sky fails the S1 Sky validator (ranges, hex, finiteness) | `invalid-payload` |
| Merged Sky equal to the current Sky | `no-change` |

**Validation:**

- Export the private `readSky` from `units/validate.ts` as `validateSceneSky(input, path)`. It
  returns the issues and stays the single source of the ranges.
- Validate the **merged** Sky, because `prepared()` does not run payload validation.
- Canonicalize colours to lowercase before the equality check.

**Change:** one change of the same kind `scene-environment-set` uses (`scene.environment.updated`).
It replaces the Sky with the merged Sky and leaves `treatment` untouched.

**Shared equality:** move the private `deepEqual`/`sameSkyValue` from `planning.ts` into
`units/sky-presets.ts` and export:

- `sameSky(a, b)`;
- `skyIsEdited(sky) = !sameSky(sky, SCENE_SKY_PRESET_STARTS[sky.preset])`.

Both are runtime-safe: no Node-only imports. The planner and the UI use the same functions.

## Rendering

**Haze (`WorldEnvironment.svelte`):**

- While a Sky is shown it installs one `FogExp2` on the scene for the Sky's lifetime. It sets
  `color = haze.color` and `density = visibility ? √(ln 50)/visibility : 0`.
- The fog is updated in place. A constant `scene.fog` object means toggling clear ↔ hazy and
  dragging recompiles no programs.
- On unmount (Paper) it restores the previous `scene.fog`.
- Density 0 is visually clear air. Its cost is one shader term.

**Fog exemptions:**

- **Exempt by nature:** the sky background (a scene background texture is never fogged) and every
  `ShaderMaterial` without `fog: true` (the mat grid and the experience lines).
- **Explicitly exempt (`fog: false`):** editor-only built-in materials. These are ghosts and
  candidate previews, the wall pin and height plane, mark and handle meshes drawn in the scene,
  and selection outlines, if built in.
  - The implementer greps `new Mesh*Material` and `T.Mesh*Material` under `lib/authoring` and
    `lib/render` and lists each in the PR. A boundary test pins it (see Tests).
- **Fogged:**
  - Artwork, layout, walls and objects.
  - The 400 m ground disc and the lit plate, so the world blends to `haze.color` at distance.
  - The `ShadowMaterial` catcher, so shadows fade with the ground.
- **Overlay:** the sun mark and the Stage's 2D overlay are not in the fogged scene.

**Rebuild economy (live drag):**

- Key the background `CanvasTexture` on `[zenith, horizon]` and the ground vertex colours on
  `[ground, haze.color]`, not on look identity. A Time, Direction, Brightness or Haze-density drag
  then rebuilds neither.
- `HemisphereLight`: replace `args={…}` with props (`color`, `groundColor`, `intensity`), so it
  updates in place instead of being recreated.
- The Sun remains one light-store lease updated in place (`light-store.ts`). An unchanged key
  is a no-op.

**Shadow invalidation (`StageShadowTriggers.svelte`, `shadow-invalidation.ts` doc):**

- Add a `sunShadowKey(look, frame)` string: position, target, mapSize, bias, normalBias and the
  camera frustum. Radius, colour and intensity do not re-render a map.
- Pass it as a trigger source from `StageCanvas` (`skyShadowKey`). When it changes the controller
  invalidates once, coalesced per frame.
- This also fixes a latent bug: toggling *Plain Paper while editing* today changes `sky` without
  changing `scene`, which leaves the Sun's map stale or never rendered.
- `radius` is read at sample time in PCF, so softness needs a frame (`invalidate`), not a map
  re-render.

**Preview routing:**

- Look authoring exposes `previewSky`. `stageSky = editOnPaper ? null : (previewSky ?? sky)`.
- `StageCanvas` receives the previewed Sky for `WorldEnvironment`, the lit plate and
  `sunShadowKey`.
- Unchanged:
  - `StageSnapshotRenderer` keys on the **accepted** Sky. It never captures a preview.
  - Visitor Preview takes the accepted `look.sky`.
  - `groundReachMeters` stays on the accepted Sky.

**Parity:** Stage, Visitor Preview and the published visit all render through the one
`WorldEnvironment` and `worldEnvironmentLook`. The published route already passes `sky`. After a
commit all three show the same fog, colours and Sun.

**Performance:**

- Idle Stage: 0 shadow maps per frame (unchanged, D9 proposed).
- A Time/Direction/sun-mark drag: at most one 2048² Sun map per previewed frame. That equals the
  visit baseline and was measured as affordable in S0.
- A Haze, Brightness or colour drag: 0 maps, uniforms only.
- No new render targets, passes or dependencies.

**Edge:** `el = π/2` puts the Sun straight up. `resolveSkySun`'s `lookAt` then needs a non-parallel
up vector. A unit test asserts a finite shadow camera matrix at `el ∈ {0, π/2}`. Fix only if it
fails: choose up = +Z when `|dir·Y| > 0.999`.

## Issue #353 disposition

**Evidence (screenshots in the issue):**

- The Sky chip reads `Dusk · 19:20`, and the plate tone is Dusk's `#9a9c96`. So the World
  environment and its shadow-casting Sun were active. The Living | Paper toggle there is only the
  Plan material.
- The artifacts are parallel bright streaks through several openings, consistent with the
  directional Sun.
- The scene also has a Spot, which uses three's defaults: 512² map, bias 0, normalBias 0
  (`light-store.ts`). That is S3's ownership.
- The staircase blocks look about 1 m across. The computed Sun texel at the 40 m minimum bounds is
  about 3 cm, ×2.9 stretched at 20° elevation. Plain Sun resolution does not explain them, so the
  **root cause is not established**.

**Rule:** S2 keeps #353 open with no change by default. Implementation step 11 runs the diagnostic
below.

- A correction lands in S2 only if a **Sun-only** reproduction places the cause inside
  `resolveSkySun`'s shadow parameters: bounds/reach, bias/normalBias, or the camera frustum. It
  needs a failing-then-passing unit test on the descriptor and an updated look golden.
- Otherwise S2 posts the diagnostic result on #353 and leaves the fix to S3 (Spot) or a later
  rendering slice. A stale map from the *Plain Paper* toggle is fixed regardless by
  `sunShadowKey`; the comment says whether it explains the report.

**Diagnostic:**

1. Rebuild a Dusk three-room scene with openings.
2. Sun only: Spot `castShadow` off. Compare at 20° and 45° elevation, and with the Plain Paper
   toggle cycled.
3. Spot only: set the Sky to Paper and turn the Spot shadow on.
4. Record which case shows the streaks.

## Implementation steps (file level)

1. **Shared Sky helpers** — `packages/project-model/src/units/sky-presets.ts`: export `sameSky`
   and `skyIsEdited`. Remove the private copies from `planning.ts`.
2. **Validator export** — `units/validate.ts`: export `validateSceneSky` from `readSky`, with no
   behaviour change.
3. **Planner** — `units/planning.ts`: `SCENE_SKY_UPDATE_KIND`, `createSceneSkyUpdatePlanner` and
   its payload reader. Register it in `createUnitCandidatePlanners`. Re-export through the package
   index the way `SCENE_ENVIRONMENT_SET_KIND` is.
4. **Sky math (pure)** — new `apps/editor/src/lib/authoring/look/sky-dials.ts`:
   - `ARC`, `timeFromElevation` and `elevationFromTime` (with the out-of-range flag);
   - `directionDegrees` and `azimuthFromDegrees`;
   - `hazeFromVisibility` and `visibilityFromHaze`;
   - `brightnessFromSky` and `skyWithBrightness`;
   - softness labels;
   - the snap functions and the readout formatters;
   - `skyPatch(captured, next)`, which returns the minimal patch, or `null`.
5. **Look authoring** — `look/look-authoring.svelte.ts`:
   - `previewSky`, rAF-coalesced, with `setPreviewSky` and `clearPreviewSky`;
   - `updateSky(patch, expectedRevision)`, the guarded intent dispatch on the `setEnvironment`
     pattern;
   - `edited` from `skyIsEdited`;
   - `resetSky()`;
   - `stageSky` uses the preview.
6. **Gesture controller** — new `look/sky-gesture.svelte.ts`: one framework-light state machine
   (idle → live → committing) implementing rules 1–7 for any dial or colour row. It is used by
   the popover and, through a port, by the sun-mark adapter.
7. **Popover** — `world-toolbar/SkyControl.svelte`:
   - the header and Reset;
   - the edited tag and the chip reading;
   - the four dials, More, the Paper line and the Plain Paper note;
   - make it non-modal, add the fade-during-mark-drag state, and the Esc layering.
   - Remove the `hours` table and the inert hour row with its `Planned · T2` tag.
   - Publish its open state to `sky-session.svelte.ts`.
   - Route props through `StageToolbars.svelte` and `routes/project/[projectId]/spatial/+page.svelte`
     (`look.edited`, `look.updateSky`, `look.resetSky`, preview setters, busy).
8. **Sun mark**:
   - new `lib/authoring/adapters/sky.adapter.ts` (auto-registered via `catalog.ts`'s glob);
   - `adapters/sky/sky-contributions.ts` (`idleHandles`, `pressWhenNoTask`, `pointerIntent`);
   - `adapters/sky/sky-mark-session.ts` (lease, capture, preview, commit, cancel, on the
     `light-gesture-session.ts` pattern);
   - `look/sky-session.svelte.ts` (open flag per project, mark-drag flag for the fade).
   - Add `sunMarkAnchor` to `render/world-environment.ts`.
9. **Rendering**:
   - `render/WorldEnvironment.svelte`: fog lifecycle, keyed rebuilds, hemisphere props.
   - `render/world-environment.ts`: `sunShadowKey`, plus the zenith up-vector guard if needed.
   - `stage/shell/StageCanvas.svelte`: preview Sky in; `skyShadowKey` to `StageShadowTriggers`.
   - `StageShadowTriggers.svelte`: the new source.
   - `fog: false` on the editor-only materials found by the grep.
   - Update the doc comment in `shadow-invalidation.ts` to list the Sun key as a trigger.
10. **Retire and document**:
    - Delete `stage/shell/StageEnvironmentControl.svelte` and drop it from
      `tests/lib/design/presentation-tokens.test.ts`.
    - `docs/reference/design-system/editor-shell-and-visual-system.md` (Shell/PLATE): the Sky
      popover is the one environment writer; non-modal; the sun mark is an idle world mark.
    - `docs/reference/components/rendering.md` §Haze: the exemptions as built and the preview
      routing.
    - Roadmap §6: note that O1 defers the Celestial Dial.
11. **#353 diagnostic** — run it and apply the ownership rule. Comment on the issue.
12. **QA and goldens** — the focused browser journeys below. Update the look goldens only for
    fog-bearing fixtures: the S1 presets have no visibility, so existing goldens must stay
    byte-identical.

## Tests

| Area | Test (file) | Asserts |
| --- | --- | --- |
| Planner writes | `packages/project-model` planner test, beside the S1 environment-set tests | Each patch field writes exactly that field; nested merge keeps siblings; `haze.visibility: null` removes the key; `preset` and `treatment` untouched; colours lowercased. |
| Planner refusals | same | Paper → `unsupported-operation`; unknown key, empty payload, empty nested object, `NaN`, elevation > π/2, azimuth = 2π, visibility 4, bad hex → `invalid-payload`; equal result → `no-change`. |
| Undo/Redo | same, through the unit apply/invert path | One update inverts to the exact prior Sky, including an absent visibility. Redo re-applies. |
| Edited | `sky-presets` test | `skyIsEdited` false on each start, true after any single-field change, false after Reset; `sameSky` key-order and case independent. |
| Dial math | new `tests/lib/authoring/look/sky-dials.test.ts` | Time round-trip within 1 min on the grid; 19:30 → 0; 13:00 → ARC; el > ARC flagged; preset readings 14:41 / 18:00 / 18:07; Haze round-trip, `h < 0.02` → absent; Brightness k round-trip, detents, normalization; azimuth wrap 360 → 0; `skyPatch` minimal and `null` when unchanged. |
| Gesture lifecycle | new `sky-gesture` test (fake services) | Begin captures revision; moves preview only; commit dispatches once with the captured revision; key burst = 1 intent; Esc → 0 intents, preview cleared, trailing change swallowed; revision drift cancels; busy refuses begin; refusal clears and resyncs; `no-change` silent. |
| Look authoring | `tests/lib/authoring/look/look-authoring.test.ts` | `stageSky` = preview ?? sky; `editOnPaper` wins; preview never reaches the save path or `sky`; Reset dispatches `scene-environment-set` with the current preset. |
| Sun mark | new `tests/lib/authoring/adapters/sky-mark.test.ts` | Hidden unless open + Sky + not Plain Paper + World + no task + no Preview; grip position from (az, el); drag maps a ground hit back to (az, el); ring changes az only; grazing ray keeps the value; Esc writes nothing; one commit on release; lease released on every path; selection mark listed first; registered planner kind. |
| Adapter contract | existing catalog/adapter-contract tests | `sky` adapter auto-registers; its grips name `scene-sky-update`; no subjects or pick. |
| Rendering | `tests/lib/render/world-environment*.test.ts` | Fog density formula; clear → 0; `sunShadowKey` changes with az/el/bounds, not with softness/colour/intensity; finite shadow matrix at el 0 and π/2; `sunMarkAnchor` = bounds centre at the datum. |
| Shadow invalidation | `tests/lib/render/shadow-invalidation.test.ts` + a trigger test | A Sun-key change → exactly one invalidation per frame; an orbit → 0; a Brightness or Haze preview → 0 map renders. |
| Fog boundary | new `tests/lib/render/fog-exemption-boundary.test.ts` | Every editor-only built-in material listed in the plan sets `fog: false`; the ground disc, plate and catcher do not. |
| Parity | `scene-render-description` / look-parity golden | Stage, Preview and published resolve the same fog and Sun for a hazed Sky; existing S1 goldens unchanged. |
| Portability | `renderer-portability-boundary.test.ts` | Still passes: `FogExp2` is a scene object, not a renderer API outside render modules. |
| Retirement | `presentation-tokens.test.ts`; a SkyControl test | No `StageEnvironmentControl`; no `Planned · T2`; no hours table; Paper shows no dials. |

## Browser QA journeys (focused, manual)

Run them in the built editor, Chrome desktop. Record the outcome in the PR.

1. **Golden-hour walk** (roadmap §11):
   - Open a room scene, choose Golden hour, and open Sky.
   - Drag the sun mark until light rakes through an opening.
   - Set Time to 16:00 and Softness to Soft.
   - The chip shows `Golden hour · edited · 16:00`.
   - One Undo per gesture walks back each step. Reset returns `Golden hour · 18:00` in one step.
2. **Cancel everywhere:** Esc mid-drag on each dial, on the sun mark and on a colour picker. The
   Stage snaps back, history is unchanged, and the popover stays open until a second Esc.
3. **Haze:**
   - Drag Haze to 40 m. Far walls and the ground fade to the Far colour; the sky gradient, grid
     and marks stay crisp.
   - Open Preview: the same haze. Publish and visit: the same haze.
   - Clear restores today's image.
4. **Brightness and colours:** 2× brightens Sun and fill together. A Fill colour change shows in
   shadowed faces. Reload: everything persists.
5. **Stage authority:**
   - With the popover open, orbit and pan from empty space; the camera moves.
   - Click an object: it selects, and its marks win over the sun mark where they overlap.
   - Open a Light task: the sun mark hides.
   - Switch to the Experience lens: the popover closes.
6. **Plain Paper while editing:** toggle it on. The Stage shows Paper, the mark hides and the note
   shows. Dials still change Preview. Toggle it off: the Sun shadow is correct at once, with no
   stale map.
7. **Paper and presets:** Paper removes the dials and the mark. Undo restores the edited Sky
   exactly. Each tile resets Direction too (O1 b).
8. **Performance:** orbit idle with the work counter on: 0 shadow updates. Drag Time: about one
   per frame. Release: back to 0.
9. **#353 diagnostic** (step 11).

## Acceptance criteria

- Every control writes, previews live and cancels cleanly. No inert control remains.
- One undo step per gesture or key burst. Esc and pointercancel write nothing.
- Edited and Reset match `scene-environment-set` semantics exactly. Paper hides every dial.
- The sun mark never selects, never steals a press it does not hit, never shows with a task open,
  in Experience, in Preview or in the visit.
- Haze renders identically in the Stage, Preview and the published visit, with the listed
  exemptions. Existing goldens are unchanged.
- Idle Stage does 0 shadow-map renders per frame. Only Sun-geometry previews re-render the map.
- No format change, no new dependency, no reflections, no renderer API outside render modules.
- `StageEnvironmentControl.svelte` and the inert hour row are gone. Shell/PLATE and `rendering.md`
  are amended.
- #353 has a recorded diagnostic and either an evidence-backed narrow fix or an issue comment.
- `npm run check`, unit tests and the boundary suites pass.

## Risks

- **Non-modal popover vs other popovers:** if the toolbar has a single-open-popover policy,
  opening another popover closes Sky. Keep that policy; only the outside-press close goes.
- **Fog on overlooked editor meshes:** the boundary test lists them. A missed one shows as a
  fogged guide in the haze journey.
- **Hollow-thumb dials:** values written elsewhere (an imported Scene) can sit outside dial
  ranges. The pinned thumb and the exact readout keep them honest, and the first drag rewrites them.
- **O1 not ruled on:** the implementation stands on the stored fields either way. A later format
  slice replaces the Time reading without touching the planner.

## Readiness

The plan is implementation-ready once the owner confirms O1. Recommended effort: **high**, as one
PR. It touches about 14 source files (3 package, about 11 editor) and about 8 new or extended test
files, plus 3 doc amendments.
