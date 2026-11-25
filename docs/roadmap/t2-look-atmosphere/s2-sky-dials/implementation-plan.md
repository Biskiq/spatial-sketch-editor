# T2 S2 Sky dials implementation plan

**Claim:** T2 S2 Sky dials.

**Base:** `main` at `a7f672db`, which merged T2.S1 Look schema (Scene 8, #354).

**Tier:** 2. S2 bumps the Scene format from 8 to 9, an incompatible change with strict refusal, and
it amends the roadmap's approved Sky model. The owner decides before merge.

**Revision 2** (2026-11-15) rewrites revision 1 after the owner's planning revision on #358.
[Review resolution](#review-resolution) lists what changed.

**Owner authorization (2026-11-15):** This revision is approved for implementation **in this same PR #358**. No separate planning merge or implementation PR. Keep the PR draft and unmerged until the implementation, independent review, browser QA and final owner acceptance. The rulings and required verification gates are recorded below.

**Authority:** [Gallery UX rev 4](../gallery-ux-recovery/ux-design.html), accepted by the owner on
13 November 2026, is the product specification. Section numbers below (§4.1–§4.3, §6, §7, §8) refer
to that sheet. The prototype script in the sheet is the visual reference for every instrument.
Line numbers are cited where an implementer should port drawing code rather than redraw it. Where
the sheet is silent, this plan states an engineering definition. The formerly open choices have owner rulings under
[Owner rulings and verification gates](#owner-rulings-and-verification-gates).

## Goal and scope

S2 delivers the Environment experience of §4 in full:

- **The Environment control** at the Stage's bottom-right. Its **Sky panel** holds:
  - the 24-hour **Time dial**;
  - the **Sun direction** row (a compass and *Aim through windows*);
  - **six preset tiles**;
  - **Haze**;
  - **More**: Sun shadows, Noon height, Exposure, Sky and Ground colours, Moon colour and strength,
    and Sun shadow softness.
- **The Celestial Dial**, the one Stage instrument for Sun, Moon, bearing and shadow.
- **The Time ↔ Sun model of §4.3**, with time, heading and arcHeight as stored fields. It covers
  day, dusk, night with a Moon, and dawn. A heading is kept when the preset changes.
- ***edited*, Reset**, and one Sky intent per gesture.
- **Rendering** of the time-driven Sun or Moon, the sky, Haze and Exposure. The Stage, Visitor
  Preview and the published visit all draw it.
- **The Scene 9 format** that stores all of this. It is S2's own first step.

In scope as well, because §7.2 and §8 assign them to S2:

- the shared popover primitive with the Card-yield rule;
- removing the Sky chip from the viewing bar;
- the Shell/PLATE amendment;
- roadmap §6/§9 amendments;
- retiring the unmounted `StageEnvironmentControl.svelte`.

Out of scope:

- S4 Finish and S6 Looks. The panel header *reserves* the `Sky · Looks` tab row space only; no
  inert tab is drawn.
- Reflections, environment maps and Volumetrics (post-WebGPU, §7.1).
- Spot/Point shadow quality (S3) and the Light Card rows (S3).
- Migrating other popovers onto the new primitive. They keep working; S3 and the shell PR adopt it.

## Superseded contracts

S2 replaces each row below in the same PR. Nothing is kept as a dual reader.

| Contract | Text today | After S2 |
| --- | --- | --- |
| S1 Scene 8 `SceneSky` | Stores `sun.{azimuth, elevation, color, intensity, softness}`, `zenith`, `horizon`, `ground`, `haze.{color, visibility}` and `hemisphere`. Three presets. Absent means Paper. | Scene 9 `SceneSky` (below). Stores `time`, `heading`, `arcHeight`, `haze`, `exposure`, `softness`, `sunShadows`, `moon` and two colours. Six presets. Absent means the Studio default. Direction, light colours and intensities are derived. |
| T2 README §6 (line 209) | "Stored as sun azimuth/elevation, colours and scalars; Time is a UI reading of elevation" | Stored as `time` / `heading` / `arcHeight`; azimuth and elevation are derived (§4.3) |
| T2 README §6 table (line 88) | "Time, Direction, Haze, Brightness; sun mark" | Time dial, Sun direction, presets, Haze, More; Celestial Dial |
| T2 README §9 / line 367 / line 378 | "Sky popover", "Sky chip", "sun mark" | The Environment control at the Stage's bottom-right; the Sky panel is the one environment writer; the Celestial Dial is its Stage instrument |
| T2 README §11 (line 417) | "drag the sun mark … Time → 16:00" | "drag the Sun along the Celestial Dial's arc … Time → 16:00" |
| T2 README §12 S2 row and line 520 | Format "—"; "Sky popover as the one environment writer" | Format **Scene 9 (Tier 2)**; "the Environment control and Sky panel as the one environment writer; the shared popover primitive with the Card-yield rule; the Sky chip retired" |
| `rendering.md` §Haze | `FogExp2(haze.color, √(ln 50)/visibility)`, stored in metres | `haze` is a percentage. Visibility and fog colour are derived (see [Rendering](#rendering)). The meteorological-visibility formula is kept as the internal mapping. |
| `scene-content.md`, `persistence.md`, `scene-codec.md`, `architecture.md`, `composition-execution.md`, `AGENTS.md` hard rule 2 | "Scene 8" | "Scene 9", with the Sky fields |
| Shell cutover plan | Sky chip in the viewing bar | Removed. The Environment control lives at the bottom-right. |
| Revision 1 of this plan | O1: keep Scene 8 and defer the Dial | Withdrawn |

## Decisions settled by existing contracts

| # | Decision | Source |
| --- | --- | --- |
| C1 | The Sun's position is a pure function of `time`, `heading` and `arcHeight`. It uses no date, latitude or clock. | §4.3 |
| C2 | A preset tile writes its full set except `heading`. *Edited* is derived by comparison and never stored. Reset rewrites the preset. | §4.3, §8 |
| C3 | Six presets: Studio, Daylight, Golden Hour, Dusk, Overcast, Moonlit. Studio is the user-facing name of today's Paper preset. | §8 owner decisions |
| C4 | Sun shadows are on by default, with a toggle under More. Moon colour and strength have subtle defaults. | §8 |
| C5 | Every release, key burst or tile is one typed Sky intent and one undo step. Esc mid-drag restores and writes nothing. | §4.3; roadmap §12 |
| C6 | The Environment control never arms, never selects and never becomes a Card. The Celestial Dial is never a selectable or Card subject, and never appears in the visitor. | §4, §4.2 |
| C7 | The Sky panel is non-modal: an outside press does not close it. Esc or a second press closes it, and focus returns to the control. | §4.3 panel spec, Esc ladder 3a |
| C8 | No reflections (E4 wait). `NoToneMapping` at exposure 1.0. Built-in materials only. No `EffectComposer`. Renderer API stays in render modules. | S0 report and pipeline; portability test |
| C9 | Idle Stage marks are admitted only with no task open; selection marks win overlaps; a claimed press beats navigation; an editing grip names a planner its adapter registers. | `stage-handles.ts`, `contribution-view.ts`, `stage-facade.ts` |
| C10 | Live preview is session-only, rAF-coalesced and never saved. `input` previews and release commits once. | `stage-light-preview.svelte.ts`, Light Card lifecycle |
| C11 | No versioned-data obligations before beta: bump, refuse strictly, no migration, regenerate fixtures. | AGENTS tiers; S1 C1; §7.3 |
| C12 | The Sky owns the only parallel light. The Directional kind is already retired (`SceneLightKind = 'point' \| 'spot'`). | §7.3, Scene 8 |

## Scene 9 schema

### Types (`packages/project-model`)

```ts
export const SCENE_SKY_PRESETS = ['studio', 'daylight', 'golden-hour', 'dusk', 'overcast', 'moonlit'] as const;
export type SceneSkyPreset = (typeof SCENE_SKY_PRESETS)[number];

export type SceneSky = {
	readonly preset: SceneSkyPreset;   // provenance: tile, label, edited/Reset target
	readonly time: number;             // hours, [0, 24)
	readonly heading: number;          // degrees, [0, 360): the Sun's bearing at solar noon
	readonly arcHeight: number;        // degrees, [20, 80]: the noon elevation
	readonly haze: number;             // percent, [0, 100]
	readonly exposure: number;         // EV, [-2, 2]
	readonly softness: number;         // [0, 1]: Sun/Moon shadow blur
	readonly sunShadows: boolean;
	readonly moon: { readonly color: string; readonly strength: number }; // strength [0, 1]
	readonly skyColor: string;         // the noon zenith; tints the sky at every time
	readonly groundColor: string;      // the noon ground; tints the ground at every time
};

export type SceneEnvironment = { readonly sky?: SceneSky; readonly treatment?: SceneTreatment };
```

`SceneEnvironmentChoice = SceneSkyPreset`. `'paper'` is gone from the model. The Plan-material
*Living | Paper* toggle and the Stage's internal `paper` render names are unrelated and stay.

### Field rules

| Field | Rule |
| --- | --- |
| `sky` absent | Equals `SCENE_SKY_DEFAULT`, the Studio start with `heading: 0`. The canonical form **drops** a Sky deep-equal to the default, so new projects serialize as today. A Studio Sky with any other heading is kept. |
| `preset` | One of `SCENE_SKY_PRESETS`. All other fields are required. |
| `time` | Finite, `[0, 24)`. Writers emit multiples of 1/12 h (5 min), computed as `k/12` for an integer `k`. The reader accepts any value in range. |
| `heading` | Finite, `[0, 360)`. World-fixed: **0° is world −Z and 90° is world +X** (clockwise seen from above, as the §4.3 prototype's `dirOf` defines). Writers emit whole degrees. |
| `arcHeight` | Finite, `[20, 80]`. Writers emit whole degrees. |
| `haze` | Finite, `[0, 100]`. 0 is clear air. Writers emit integers. |
| `exposure` | Finite, `[-2, 2]`. Writers emit multiples of 0.1, rounded to 1 decimal. |
| `softness` | Finite, `[0, 1]`. Shadow radius is `1 + 4·softness` texels (S1 C5, unchanged). Writers emit multiples of 0.05. |
| `sunShadows` | Boolean. |
| `moon.strength` | Finite, `[0, 1]`. Writers emit multiples of 0.05. |
| colours | Lowercase `#rrggbb`. |
| `environment: {}` | Dropped, as in S1. |

**Refusal codes:** S1's Sky codes, reused under the same path naming: `invalid_sky_field`,
`unknown_key` and `unsupported_format_version`. Check the exact spellings in `units/validate.ts` and
keep them.

### Preset starts (`units/sky-presets.ts`)

The values come from the §4.3 prototype, `ux-design.html` lines 1801–1809. Studio is added with the
neutral defaults. Every preset shares the default `skyColor`, `groundColor` and `moon.color`, so any
colour change makes the Sky *edited*.

| Preset | time | arcHeight | haze | exposure | moon.strength | softness | sunShadows |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `studio` | 156/12 (13:00) | 62 | 0 | 0 | 0.25 | 0.5 | true |
| `daylight` | 156/12 (13:00) | 62 | 15 | 0 | 0.25 | 0.3 | true |
| `golden-hour` | 220/12 (18:20) | 62 | 35 | 0 | 0.25 | 0.45 | true |
| `dusk` | 243/12 (20:15) | 62 | 40 | 0.5 | 0.25 | 0.6 | true |
| `overcast` | 156/12 (13:00) | 62 | 85 | 0.3 | 0.25 | 0.9 | true |
| `moonlit` | 276/12 (23:00) | 62 | 20 | 1 | 0.35 | 0.4 | true |

The shared defaults come from the shipped S1 Daylight look, so "nothing is remapped":

- `skyColor` is `#b7cfcd`, the S1 Daylight zenith.
- `groundColor` is `#e0e4d3`, the S1 Daylight ground.
- `moon.color` is `#c9d6ff`, the §4.2 night-arc pale blue ("cool and dim").

**Exports:**

- `SCENE_SKY_PRESET_STARTS: Record<SceneSkyPreset, Omit<SceneSky, 'heading'>>`.
- `SCENE_SKY_DEFAULT`.
- `skyFromPreset(preset, heading)`.
- `skyIsEdited(sky)`. It is exact equality over every field except `heading` and `preset`, against
  the preset's start. It matches the prototype's `PRESET_KEYS` plus the colours and `sunShadows`.
- `sameSky(a, b)`.
- `sunShadowRadius(softness)`.

### Persistence and compatibility

- `SCENE_UNIT_FORMAT_VERSION = 9`.
- A Scene 8 unit, project or release is refused with `unsupported_format_version`. Nothing converts
  it, following the S1 precedent.
- **Consequence, explicitly accepted by the owner:** Scene 8 projects and releases stop opening.
  There is **no in-app migration or automatic republish path** in S2: a refused Scene 8 project
  cannot simply be opened, saved, or republished. Its content must be **recreated/re-authored in
  Scene 9** (or converted through separately approved tooling, not provided here) before it can be
  published anew. Existing Scene 8 releases remain inaccessible under the strict format policy.
  This is the intentional pre-beta data-compatibility trade-off, as with S1's Scene 7 refusal.
- Layout, Camera, Experience and resources versions are unchanged.
- API save, load and release reuse `validateUnitPayload`, so no schema is duplicated.

### S4 coordination (#360)

S4 ("Finishes & Object Painting") plans no format change, states "Scene 8 validation passes", and
does not touch `units/planning.ts` or the Sky files. Its §13 already gives S2 ownership of every Sky
seam. The bump affects S4 only through the version number and the fixtures:

1. **S4 never writes `environment`.** Its Finish, palette and texture fields are unchanged by
   Scene 9.
2. **Whichever PR lands second** re-runs the fixture sweep (step A6 below) over the other's new
   fixtures. It uses the existing regeneration helpers, never hand-edited hashes. TypeScript
   fixtures import `SCENE_UNIT_FORMAT_VERSION`. The `.mjs` API fixtures need the literal changed.
3. **S4's plan text** "Scene 8 validation passes" should read "validation against the current Scene
   format passes". It is a one-line amendment in #360. S2 does not edit #360; the owner or the S4
   session applies it.
4. S4's README edits stay single-row, so the §12 S2 row changes here do not collide.

## Time ↔ light model

### Sun and Moon position

New pure module `apps/editor/src/lib/render/sky-time.ts`. It is runtime-safe and imported by the
render, panel, dial and visitor paths alike. It ports the prototype (`ux-design.html`
lines 1784–1796) exactly.

```
SR = 6.5, SS = 19.5, NOON = 13, DUSK = 21, DAWN = 4.5, NIGHT = 7.5, MOON_PEAK = 38
phase(t):  day [6.5, 19.5] · dusk (19.5, 21) · night [21, 24)∪[0, 4.5) · dawn [4.5, 6.5)
day:   u = (t − 6.5)/13;          az = heading − 90 + 180u;  el = 4 + (arcHeight − 4)·sin(πu)
night: v = wrap24(t − 21)/7.5;    az = heading − 90 + 180v;  el = 4 + 34·sin(πv)
dusk/dawn: body none; glow bearing = heading + 90 (dusk) or heading − 90 (dawn)
direction(az, el) = [sin az·cos el, sin el, −cos az·cos el]   (from the scene toward the body)
```

The module exports:

- `skyBodyAt(time, heading, arcHeight)`, returning `{ phase, body: 'sun' | 'moon' | 'none', u, az, el }`;
- `skyDirection`, `phaseName`, `hhmm` and `snapTime` (round to 5 min, wrapping);
- `phaseStarts = [4.5, 6.5, 19.5, 21]`, used by Page Up and Page Down;
- `skyKind(body, haze)`: `twilight`, `moon`, `overcast` (haze ≥ 80), `low` (el < 14°) or `sun`.
  The prototype is at line 1932.

### Light and atmosphere

New pure module `apps/editor/src/lib/render/sky-atmosphere.ts`. It resolves a `SceneSky` into
everything `WorldEnvironment` draws:

```ts
resolveSkyLook(sky): {
  body; direction; lightColor; lightIntensity; castShadow; shadowRadius;
  zenith; horizon; glow: { bearing, color, strength } | null; ground; groundFar;
  hemisphere: { skyColor, groundColor, intensity }; ambient;
  fog: { color, density }
}
```

**One parallel light.**

- The Sun and the Moon are the **same** `DirectionalLight` lease, retargeted by phase.
- In dusk and dawn, intensity is 0 and the direction holds at the boundary it just crossed: el 4°,
  az = heading ± 90.
- `castShadow` is `sunShadows`, whatever the phase. **Owner-reviewed semantics:** the UI label
  *Sun shadows* controls shadow casting by the same light **at night as the Moon**, too. Under
  Sky › More, show a brief contextual clarification (*Also applies to Moon at night*) rather than
  creating a second shadow toggle. Dusk and dawn have no direct shadow because light intensity is 0.
- This keeps the light count, the shadow count and every shader program constant across a 24-hour
  drag (see [Rendering](#rendering)).

**Intensity.**

```
L = 2^exposure
fade(el) = smoothstep(4°, 12°, el)
overcast = smoothstep(60, 100, haze)

sun:  1.9·fade(el)·(1 − 0.7·overcast)·L
moon: 0.6·moon.strength·fade(el)·L
hemisphere: key.fill·(1 + 0.4·overcast)·L
ambient: 0.12·L
```

- `fade` makes the Sun's arrival and departure at 06:30 and 19:30 continuous, although the phase
  boundary is discrete.
- The Sun peak of 1.9 is S1 Daylight's physical intensity.
- The ambient 0.12 is today's Sky ambient.
- **Exposure scales the Sky's own light, not the renderer.** S0 fixed `NoToneMapping`, where
  `toneMappingExposure` does nothing, and the artwork calibration forbids a global mapper. The sky
  background and the unlit ground are display colours and do not scale.

**Time-of-day keyframes.** Colours are interpolated in linear sRGB by a light angle `a`:

- in the day phase, `a = el`;
- dusk runs linearly from 4° at 19:30 to −12° at 21:00;
- night is −12°;
- dawn runs from −12° at 04:30 to 4° at 06:30.

The keyframes are the shipped S1 looks, with the night frame added:

| a | zenith | horizon | ground | fill sky / ground | fill intensity | Sun colour |
| --- | --- | --- | --- | --- | --- | --- |
| ≥ 40° (HIGH) | `#b7cfcd` | `#eef0e6` | `#e0e4d3` | `#f4f7f2` / `#b9b49c` | 1.5 | `#fff6df` |
| 15° (LOW) | `#e2a676` | `#f8e4c2` | `#e2c99e` | `#ffe6c4` / `#a07e58` | 1.2 | `#ffc985` |
| 0° (SET) | `#25313e` | `#8b6e5d` | `#45473c` | `#5b6884` / `#3a342c` | 0.7 | `#ff9e5e` |
| −12° (NIGHT) | `#0b1226` | `#1f2a44` | `#1a1d22` | `#2a3552` / `#15171c` | 0.25 | — (the Moon uses `moon.color`) |

**User colours tint every keyframe.**

```
tintSky    = clamp(skyColor ⊘ #b7cfcd, 0, 2.5)      per linear channel
tintGround = clamp(groundColor ⊘ #e0e4d3, 0, 2.5)

zenith  = key.zenith ⊙ tintSky
horizon = key.horizon ⊙ tintSky
ground  = key.ground ⊙ tintGround
fill    = key.fill ⊙ (tintSky, tintGround)
```

- At HIGH with the default colours the result is exactly S1 Daylight.
- A colour edit stays visible at every time of day, so no colour control is ever inert.
- **Overcast** desaturates the sky:
  `zenith' = mix(zenith, grey(zenith)·1.1, 0.8·overcast)`, and the same for the horizon.

**Glow.** In dusk and dawn the sky gets a lobe at the glow bearing:

- colour `#e9a77a` at dusk and `#d8b0c8` at dawn (the §4.2 dial colours);
- strength `1 − |progress − 0.5|·2`, where progress runs across the twilight span.

**Haze.**

```
visibility = 20000·(60/20000)^(haze/100) m      for haze > 0
density    = √(ln 50)/visibility                 (S1's formula; 0 when haze = 0)
fog colour = horizon
```

Preset readings: Daylight about 8.4 km, Golden about 2.6 km, Dusk about 2.0 km, Overcast about
145 m, Moonlit about 6.2 km. A gallery wall 15 m away keeps about 67% contrast under Overcast, so
haze reads as air and never as fog that hides the room.

**Tuning.** The constants above are implementation defaults chosen to reproduce the shipped S1
looks. Final look acceptance belongs to the owner in browser QA (AGENTS verification policy). A
retune changes constants and goldens only, never the schema or the interaction.

## Interaction contracts

### Environment control (§4.3 spec)

- **Placement.** Inside the Stage region, 10 px from its right and bottom edges. It is a new
  `stage/shell/StageEnvironmentControl.svelte`, which replaces the unmounted file of the same name
  outright, mounted by `StagePanels.svelte`.
  - 48 px high, radius 24, white with the line border, sized to its content (about 200 px with
    Daylight).
  - It holds a 36 px **medallion**, the preset name with a moss **edited dot**, a mono second line
    and a caret `▴`.
  - The medallion ports `medallionSVG`, lines 2255–2266: phase colours, the Sun or Moon at its
    height, stars at night, the ground band.
- **Second line:**
  - `hh:mm · Sun 42°` for the Sun;
  - `hh:mm · Moon`;
  - `hh:mm · No sun` in twilight;
  - `Even light` in Studio (Open decision D1).
- **Medallion-only.** When the full control would come within 12 px of the dock's band, it shrinks to
  the 48 × 48 medallion. The name and time move to the tooltip and the `aria-label`.
- **States:**
  - Hover: a moss ring.
  - Expanded: a forest border and the caret down.
  - Focus: a moss outline.
  - During any Stage drag it stays put and does not fade.
- **Behaviour:**
  - A press toggles the panel, with `aria-expanded` and `aria-controls`.
  - On open, focus goes to the Time dial (the preset tiles in Studio).
  - Esc closes the panel and returns focus to the control (ladder rung 3a).
  - It is the **last stop** in focus order (§6 focus 7). Its panel is 7a and wraps to 1.
- **Lenses.** Shown in the World lens. In the Experience lens it is not shown, and an open panel
  closes. Experience mood is out of scope (README §6). It is never in the visitor runtime.

### Shared popover primitive and the Card-yield rule

New `stage/shell/StagePopover.svelte`, the §8 handoff primitive. It takes an anchor rect, a side,
`modal: boolean`, an Esc rung and a focus-return target.

- **The Sky panel is the first consumer.** Other popovers are not migrated in S2, as scoped above.
- **Card-yield rule.**
  - The primitive publishes its rect to a small shell store, `stage/shell/stage-panel-rects.svelte.ts`.
  - If the Sky panel rect would meet the Card rect plus 12 px, the Card **yields height**. The shell
    sets `EditorCard`'s existing `--card-bottom-clearance` so the Card's bottom sits 12 px above the
    panel's top.
  - The Card body scrolls behind a soft bottom fade and keeps its header and foot.
  - Below 160 px of body, the Card folds to its identity row through its existing constrained-width
    fold.
  - The panel never covers the Card.
  - §4.1 measurements to reproduce with a Spot Card open: clear at 1440; the Card yields 100 px at
    1280 and 132 px at 1024; it never folds.

### Sky panel (§4.3 panel spec, prototype lines 2026–2110)

**Geometry.**

- 320 px wide. It rises from the control: right-aligned to it, with its bottom 10 px above the
  control.
- Where it shares x with the dock's band, its bottom stays 10 px above the dock.
- Its caret points at the control. It is non-modal (C7).
- Its height is content height. More scrolls inside `max-height`, which runs to 12 px below the
  World-controls bar.

**At ≤ 860 px Stage width** it becomes a **bottom sheet** with the same content in one column. The
control stays a medallion, and the Card folds to identity while the sheet is open.

**Fade.** During any Stage drag or dial drag, the panel body fades to 20% opacity except the control
being dragged.

- "Any Stage drag" means any live gesture lease, navigation included.
- The facade exposes this as a read-only `liveGesture: { owner, navigation } | null` on the Stage
  snapshot. Add it if it is absent: today `acquireGesture` has no observable.
- A Celestial Dial drag fades everything except the Time dial (for glyph or tip drags) or the
  compass (for a noon-mark drag).

**Contents, top to bottom.**

1. **Header.** `Sky` and the preset name. When edited, `edited · Reset` (a link button). Reset issues
   `scene-environment-set {preset: sky.preset}`. The space reserved for the S6 `Sky · Looks` tab row
   is layout only: nothing is drawn.
2. **Time dial** (a 120 px SVG, `role="slider"`, `aria-valuetext="14:20, Afternoon"`). It ports
   `timeDialSVG`, lines 1981–1999: phase sectors, 24 hour ticks, labels 00/06/12/18 with noon at
   the top, stars in the night sector, and the body glyph on the hand radius.
   - **Drag:** the angle about the centre maps to `t = angle/2π·24`, snapped to 5 min. It is
     continuous through all four phases and wraps at midnight both ways.
   - **Keys:**
     - ←/↓ −15 min and →/↑ +15 min; Shift ±1 h.
     - Page Up / Page Down go to the next or previous phase start.
     - Home is sunrise (06:30) and End is sunset (19:30).
     - All keys wrap.
   - **Readout** beside the dial:
     - large mono `hh:mm`;
     - the phase name: *Morning*, *Solar noon* (within ±2.5 min of 13:00), *Afternoon*,
       *Night · Moon*, *Dusk · no direct light* or *Dawn · no direct light*;
     - for a body, `Sun bearing 148° · 22° high` (or Moon).
3. **Sun direction row.** A 28 px compass (`role="slider"`, port `compassSVG`, line 2001), the label
   `Noon 135°`, and the link button ***Aim through windows***.
   - **Drag:** the bearing from the centre, snapped to 15°; Alt frees it.
   - **Keys:** ←/→ ±15°, Shift ±45°, wrapping.
4. **Preset tiles.** Six in one row (`repeat(6, minmax(0, 1fr))`, 6 px gap): Studio, Daylight,
   Golden, Dusk, Overcast, Moonlit.
   - Each tile shows a swatch gradient and its glyph: `tileArt` with `TILEKIND`, line 2026. Studio
     uses the `#f4f2ec → #e4dfd0` swatch with no glyph.
   - `aria-pressed` marks the current preset.
   - **Check at 320 px:** no label is clipped and text is ≥ 10 px. Fall back to 10 px labels before
     any re-layout.
5. **Haze.** A range from 0 to 100, step 1. Readout `15%`.
6. **More** (`<details>`, closed by default; its open state is kept per browser in try/catch
   `localStorage`). Rows in the §4.3 Contents order:
   - **Sun shadows** switch, on by default.
   - **Noon height**, 20–80°, step 1. Readout `62°`.
   - **Exposure**, −2 to +2, step 0.1. Readout `+0.5 EV`, `0.0 EV` or `−1.0 EV`.
   - **Sky colour** and **Ground colour** swatch rows (Open decision D3).
   - **Moon colour** swatch row, and **Moon strength** 0–1, step 0.05, with readout `25%`.
   - **Sun shadow softness**, 0–1, step 0.05, with readout `0.45`.

**Studio state** (Open decision D1). The header, the tiles, and the line *Studio light is even and
fixed. Pick a sky to set the time.*

- There is no Time dial, Sun direction, Haze or More, and no Celestial Dial: none of them would
  change the image (D18).
- The stored values, `heading` included, are kept.

**Out-of-range stored values.** The reader accepts any in-range value, and every control spans its
full stored range. Off-grid values, such as 13:07 or 137°, show exactly. The first write snaps them.

### Celestial Dial (§4.2)

**Anchor.** The UX's "World mark" has no product object yet. S2 defines it as the plan centre of
the World's content bounds at the datum. That is the point the Sun's shadow frustum already targets
(`sunMarkAnchor(bounds)` in `world-environment.ts`, which shares `resolveSkySun`'s bounds arithmetic).

**Size.** Constant screen size: ring radius 72 CSS px (144 px across), plate radius 44 px, gnomon
20 px tall. World size = px × metres-per-CSS-pixel at the anchor, recomputed per camera change.
Prototype constants are at line 1824 (`CD`): ring 1.18, plate 0.7, gnomon 0.4, Lmax 1.05 at
62 px/m.

**Parts.** Port `celestialDial` and `sunStageSVG`, lines 1849–1930.

| Part | Contract |
| --- | --- |
| Bearing ring | An ellipse in the floor plane. Ticks every 15° relative to `heading`, majors every 90° (0.9R; minors 0.95R). Ink at about .3 opacity. |
| Active arc | Day: gold `#f5b400` from heading − 90° to heading + 90°. Night: `#c9d6ff`. A dotted sweep marks the part already travelled. Boundary ticks run from R to 1.16R, with labels at 1.2R: `06:30 sunrise` / `19:30 sunset`, or `21:00 rise` / `04:30 set` at night. Below 360 px of Stage width only the time shows. |
| Glyph | One `skyGlyph` (line 1933: rayed Sun, low Sun, crescent Moon, overcast veil) on the ring at the body's bearing, radius 10 (Moon 11). Hit radius 18 px. It never floats. |
| Noon mark | A diamond at bearing heading + 180° at 1.1R, with a dashed noon line to the plate. Hit radius 11 px. |
| Gnomon, beam, shadow | A central pin; a dashed beam from the glyph to the gnomon top; the shadow from its foot, pointing away from the body, `L = min(Lmax, g/tan el)`. A dotted tip locus with hour dots (day 09/11/15/17; night 23/02). Hit radius 12 px on the tip. |
| Dusk and dawn | No body and no arc. A glow arc ±25° around the boundary just crossed; a dimmed twilight glyph; the label `Dusk · use the Time dial in Sky` at 1.32R. Nothing drags for Time; the noon mark still drags `heading`. |
| Night ink | Dial ink `#e8eeff` at night and in twilight, otherwise the guide ink. |

**Furniture.**

- Ring, arc and locus segments behind scene geometry draw at 38% through it, depth-tested in the
  Three layer.
- The glyph, the tip, the noon mark, the labels and the tag always draw on top, in the SVG layer.
- If scene geometry covers the gnomon (the anchor lies inside a Scene entity's or Wall's plan
  footprint whose top is above datum + 0.05 m), the dial moves to the nearest clear floor point
  within 2 m. Candidates are on a 0.3 m grid, nearest first. A dotted leader runs to a 3 px World
  mark dot.

**Shell panels.**

- The dial's screen footprint is the ring at 1.2R, plus 84 px on each side for labels, 22 px above
  and 8 px below (prototype `cdBox`, line 1841).
- It must clear, by 8 px, the Sky panel or sheet, the Card, the dock, the World-controls bar and the
  Environment control. Rects come from `stage-panel-rects` plus the existing shell rects.
- Otherwise it moves to the nearest clear floor point inside the World's floor bounds, with the
  leader. It hides only when no floor point is clear.
- §6 measurements to reproduce with Sky open and a Spot Card: moved 1.4 m at 1440, 2.0 m at 1280 and
  1.7 m at 1024; at 820 it sits above the bottom sheet.

**Off-screen.** If the anchor is off-screen, the dial hides and the Time dial is the instrument.
Nothing draws at the edge.

**Visibility.** Shown only while the panel is open or a dial drag is live, when all of these hold:

- the Sky is not Studio;
- the lens is World;
- no tool task is armed (C9: the Stage belongs to the armed tool);
- Visitor Preview is not open;
- *Studio light while editing* is off (Open decision D2).

A selection, with its Card open, may coexist with the dial (§6 "Sky open + Card").

**Gestures** (§4.2 and §4.3 tables):

| Grip | Writes | Rule | Feedback |
| --- | --- | --- | --- |
| Glyph | `time` on release | Moves only along the arc of the phase at press (day 06:30–19:30, night 21:00–04:30). The pointer projects to the nearest arc point, sampled every 2 min. Ties go to the point nearest the previous time. Clamps at the arc ends and never crosses twilight or midnight. Snaps to 5 min. Port `nearestT`, line 1945. | Gold ring on the glyph; mono tag `14:20 · 51° high`; panel fade except the Time dial |
| Shadow tip | `time` on release | The same, along the tip locus | The same |
| Noon mark | `heading` on release | Bearing from the anchor, minus 180°, snapped to 15°; Alt frees it. Works in every phase. | The whole arc turns; tag `Noon bearing 135°`; the noon mark turns gold |
| Esc or pointercancel | nothing | Restores `time` and `heading` | Fade ends |

**Authority.**

- A new `lib/authoring/adapters/sky.adapter.ts`, auto-registered by `catalog.ts`'s glob, with
  `plannerKinds: ['scene-sky-update']`.
- It owns no subject and no pick, and contributes nothing to the Card.
- It contributes the three grips as `idleHandles` of kind `point` with `draw.hidden: true`. The
  admitted pointer target stays live, while the dial layer draws the visuals.
- It uses `pressWhenNoTask` and `pointerIntent`, so a press on a grip beats camera navigation.
- Selection marks are listed first and win overlaps.
- A press that misses every grip falls through to selection and navigation unchanged.
- It is never offered in the visitor or the snapshot renderer.

**Rendering of the dial** (editor-only):

- `stage/shell/StageCelestialDial.svelte` is the in-canvas Three layer: plate, ring, ticks, arc,
  sweep, locus, gnomon, beam and shadow line.
  - Built-in `LineBasicMaterial` and `MeshBasicMaterial`.
  - A visible pass with depth test, plus an occluded pass at 38% with `depthFunc = GreaterDepth`.
  - `fog: false`, `castShadow: false`, `receiveShadow: false`, raycast disabled, and excluded from
    every shadow trigger source.
- `stage/shell/StageCelestialDialMarks.svelte` is the SVG top layer: glyph, tip, noon mark,
  boundary labels, the tag, and the leader dot.
- Both read one pure model, `look/celestial-dial.ts`
  (`celestialDialModel(sky, preview, camera, anchorInputs, shellRects)`). The adapter uses the same
  model for grip anchors, so drawing and hits cannot disagree.

### Gesture lifecycle (every control)

A gesture is one of:

- a pointer press through release on the Time dial, compass, any slider or a dial grip;
- one colour-picker session;
- a **key burst**: the first handled keydown through the keyup of the last held key on that control.

1. **Begin.**
   - Refused while a Sky commit is in flight (busy).
   - Captures `services.stage.snapshot().acceptedRevision` and the accepted Sky.
   - A dial grip also acquires `services.stage.acquireGesture({ owner: 'sky', policy: 'cancel-on-reading-change' })`.
2. **Move.**
   - Computes the next Sky from the captured Sky plus this control's write.
   - Sets the look preview (`previewSky`, rAF-coalesced).
   - The panel, the control, the dial and the Stage all render the preview.
3. **Commit** on release, `change` or the burst's keyup.
   - The patch is the minimal difference from the captured Sky. An empty patch writes nothing.
   - Otherwise it dispatches one `scene-sky-update` with the captured `expectedRevision`.
   - The preview is held until the accepted Sky arrives, then cleared, so nothing flashes.
4. **Cancel** on Esc (ladder rung 1), pointercancel, blur during a press, the panel closing, the lens
   changing, or Preview opening.
   - Clears the preview and restores the controls.
   - Swallows the trailing `change` and writes nothing.
   - Esc is consumed; a second Esc closes the panel (rung 3a).
5. **Revision drift.** If the accepted revision changes mid-gesture (Undo/Redo or another writer),
   the gesture cancels and writes nothing.
6. **Refusal.**
   - Clears the preview and resyncs.
   - Shows the existing look notice, except for `no-change`, which is silent.
7. **Undo/Redo.** One step per gesture, burst, tile, Reset or Aim. Undo restores the exact prior Sky.

### Presets, edited, Reset, heading

- **A tile** dispatches `scene-environment-set {preset}`. The planner writes `skyFromPreset(preset,
  current.heading)`: the full set except `heading`, which is kept.
  - This is one step.
  - A tile equal to the current state is `no-change` and silent.
  - The current preset's tile on an edited Sky resets it.
- **Edited** is `skyIsEdited(sky)`: any field except `heading` and `preset` differs from its start.
  It shows as the header's `edited · Reset` and the control's moss dot.
  - A heading change never marks a Sky edited.
  - Studio is never edited, because the planner refuses Studio field writes (below).
- **Heading** survives every preset change, Studio included (the Studio Sky keeps `heading`).
- **Studio** renders exactly today's Paper path: neutral lights, the Paper plate, no Sun and no fog.

### Aim through windows (§4.3)

- **Computation** (pure, `look/aim-through-windows.ts`, over the compiled `LayoutGeometry`):
  - For every compiled opening of kind `window`, probe both sides at
    `center.point ± center.normal·(wallThickness/2 + 0.05)`.
  - The side that lies in no `CompiledRoom.floorPolygon` is outward.
  - A window with both or neither side in a Room (an interior partition, or a free wall) is skipped.
  - Sum `outward·width·height`. The heading is `round(wrap360(atan2(x, −z)))` in the stored
    convention.
  - Port `aimThroughWindows`, line 1800.
- **The button** is one `scene-sky-update {heading}` and one step. With no qualifying window, or a
  zero-length sum, nothing is written and the notice reads *No outside windows to aim through*.
- **"Also runs once when a World is created."** The new-World seed path runs the same function over
  its initial Layout and writes the heading into the initial Scene. Today's seeds have no windows,
  so the result is `heading: 0` (the default). A unit test pins this, and any future seed with
  windows gets an aimed heading for free. Nothing recomputes when Layout changes.

## Writes

Both planners live in `packages/project-model/src/units/planning/index.ts`. S4 leaves this file to S2.
Both validate the **merged** Sky with the exported Sky validator (`validateSceneSky`, from
`units/validate.ts`), because `prepared()` does not run payload validation. Both emit
`scene.environment.updated` and leave `treatment` untouched. The canonical rule drops a Sky equal to
`SCENE_SKY_DEFAULT`.

**`scene-environment-set` (revised).**

- Payload `{ preset: SceneSkyPreset }`. `'paper'` is refused with `invalid-payload`.
- It writes `skyFromPreset(preset, (current ?? SCENE_SKY_DEFAULT).heading)`.
- An equal result is `no-change`.

**`scene-sky-update` (new).**

```ts
type SceneSkyUpdatePayload = {
	time?: number; heading?: number; arcHeight?: number; haze?: number; exposure?: number;
	softness?: number; sunShadows?: boolean;
	moon?: { color?: string; strength?: number };
	skyColor?: string; groundColor?: string;
};
```

| Condition | Code |
| --- | --- |
| Unknown key, empty payload, empty `moon`, `preset` present | `invalid-payload` |
| Merged Sky fails the validator (range, finiteness, hex) | `invalid-payload` |
| Current preset is Studio and the patch has any key other than `heading` | `unsupported-operation` |
| Merged Sky equals the current Sky (colours compared lowercase) | `no-change` |

Writers emit the grids in the field table. The planner does not re-snap: an imported off-grid value
is valid.

## Rendering

**`WorldEnvironment.svelte` and `world-environment.ts`.**

- **Input.** They take a `SceneSky` and resolve through `resolveSkyLook`. Studio, or no Sky, means
  `WorldEnvironment` is not mounted: today's Paper path.
- **Sky background.** It becomes an **equirectangular** `CanvasTexture`, 256 × 128, used as
  `scene.background` with `EquirectangularReflectionMapping`.
  - Rows interpolate horizon to zenith by elevation. The dusk/dawn glow is a lobe at its world
    bearing.
  - This is needed because the glow sits "on the heading ± 90° side", and today's screen-space
    2 × 256 gradient cannot face a bearing.
  - It sets `scene.background` only, never `scene.environment`, so there is no S0 environment leak.
  - The texture is redrawn **in place** (`needsUpdate`) only when its colour key (zenith, horizon,
    glow) changes.
- **Ground disc.** Vertex colours are updated **in place** in the existing attribute. It blends
  `ground → groundFar (= horizon)` toward the 400 m edge, keyed by `[ground, horizon]`. Nothing is
  rebuilt.
- **Lights.**
  - The one Sun/Moon `DirectionalLight` is a light-store lease updated in place: direction, colour,
    intensity, `castShadow`, shadow radius.
  - `HemisphereLight` uses props (`color`, `groundColor`, `intensity`) instead of `args`, so it
    updates in place.
  - The ambient intensity is a prop.
- **Fog.** One `FogExp2` installed for the Sky's lifetime and updated in place (colour, density).
  Density 0 is clear. Unmount restores the previous `scene.fog`.

**Program stability**, so a live drag never recompiles:

- The light count, the shadow-casting light count, the fog's presence and type, and the background's
  presence and type are all constant while a Sky is shown.
- Only a Sun shadows toggle, or a switch to or from Studio, changes the program set. Both are
  discrete clicks, never inside a drag.
- A unit test asserts that the resolved light and fog *shape* is invariant across 96 times of day.
  **This is not proof of zero recompiles.** The browser QA below must also measure actual WebGL
  compile/link activity and program counts over a full 24-hour drag after warm-up.

**Fog exemptions.**

- Unfogged by nature: the sky background, and every `ShaderMaterial` without `fog: true` (the mat
  grid and the experience lines).
- `fog: false` on every editor-only built-in material: ghosts and candidate previews, the wall pin,
  the height plane, the Celestial Dial layer, and any outline drawn with built-in materials. The
  implementer greps `Mesh*Material` and `Line*Material` under `lib/authoring` and `lib/render`, and
  lists each one in the PR. A boundary test pins the list.
- Fogged: Artwork, Layout, objects, the ground disc, the lit plate and the shadow catcher.

**Shadow invalidation.**

- `sunShadowKey(look, bounds)` covers the light direction, `castShadow`, the shadow camera frustum,
  the map size and the biases. It excludes radius, colour and intensity.
- It is passed as a new source to `StageShadowTriggers.svelte`.
- A Time, heading or Noon-height preview re-renders one map per preview frame.
- Haze, exposure, colours, Moon strength and softness re-render no map; softness needs a frame only.
- In twilight the direction is held, so a drag through 19:30–21:00 re-renders nothing.
- The key also fixes the latent stale map when the Studio-while-editing preference toggles.
- Update the trigger list in `shadow-invalidation.ts`'s doc comment.

**Preview routing.**

- Look authoring exposes `previewSky`. `stageSky = studioWhileEditing ? null : (previewSky ?? sky)`.
- `StageCanvas` passes the previewed Sky to `WorldEnvironment`, the lit plate and `sunShadowKey`.
- `StageSnapshotRenderer` keys on the **accepted** Sky.
- Visitor Preview takes the accepted Sky, and so does `groundReachMeters`.

**Parity.**

- The Stage, Visitor Preview and the published visit render through the one `WorldEnvironment` and
  `resolveSkyLook`.
- The published route already passes `sky`.
- After a commit all three show the same Sun or Moon, sky, fog and exposure.

**Zenith edge.**

- At `arcHeight = 80` the noon elevation is 80°, so the Sun never reaches straight up.
- A unit test still asserts a finite shadow matrix at el ∈ {4°, 80°}.
- It also checks the up-vector guard: up = +Z when |dir·Y| > 0.999.

**Performance** (budget against S0's measurements):

| State | Shadow maps per frame | Other per-frame cost |
| --- | --- | --- |
| Idle Stage, dial shown or not | 0 (D9 unchanged) | none |
| Time / heading / Noon-height drag | ≤ 1 × 2048², the visit baseline S0 measured as affordable | a 256 × 128 canvas redraw and upload (128 KB) when the colour key changes; a ground colour attribute update; dial geometry |
| Haze / exposure / colour / Moon drag | 0 | uniforms; a background redraw for colour |
| Orbit with the dial shown | 0 | dial rescale; the shell-clearance search, which runs only when the camera or a shell rect changes (≤ 300 candidates × 48 projected points) |

No new render targets, passes or dependencies.

**Golden.**

- Add a Scene 9 look golden before rendering changes:
  `resolveSkyLook` for each preset at its start time, for Daylight at 6 times, and for Moonlit,
  Dusk and Dawn.
- The S1 golden's Sky entries are replaced (the format changed). Its Finish entries stay
  byte-identical.

## Issue #353 disposition

Carried from revision 1, adjusted to the time model.

**Evidence.**

- The screenshots show the Dusk Sky with its shadow-casting Sun active.
- The streaks are parallel, which is consistent with the parallel light.
- The Spot uses three's 512² / bias-0 defaults, which S3 owns.
- The roughly 1 m blocks far exceed the computed Sun texel (about 3 cm, ×2.9 at 20°).
- The root cause is not established.

**Rule.**

- #353 stays open by default.
- Step G2 runs the diagnostic:
  1. A Dusk-like three-room scene. Set Golden at 18:20 (el about 20°) and Daylight at 13:00.
  2. Sun only (Spot `castShadow` off).
  3. Spot only (Studio).
  4. Cycle the Studio-while-editing preference.
- A narrow fix lands in S2 only if the Sun-only case places the cause inside `resolveSkySun`'s
  shadow parameters (bounds, bias, frustum), with a failing-then-passing descriptor test. Otherwise
  S2 comments the result on #353.

## Implementation sequence (file level)

One PR, in this order. Each lettered group is one or more commits that leave `npm run check` green.
There is no intermediate state where the old Sky popover writes Scene 9, so no temporary interaction
system is built.

**A. Scene 9** (Tier 2 core; S1's step 1–3 and 8–9 pattern):

1. `units/types.ts`: version 9; the `SceneSky`, `SCENE_SKY_PRESETS` and `SceneEnvironmentChoice`
   changes; `scene.ts` types.
2. `units/sky-presets.ts`: starts, default, `skyFromPreset`, `skyIsEdited`, `sameSky` (moved out of
   `planning.ts`) and `sunShadowRadius`. Remove `sceneSunFrom`.
3. `units/validate.ts`: rewrite `readSky` for the new fields and export it as `validateSceneSky`;
   default-dropping in normalization.
4. Scene codec canonical form (`canonical.ts`): environment key order and the default drop.
5. `units/runtime.ts`: no shape change beyond the type.
6. **Fixtures:**
   - Scene `formatVersion` 8 → 9 across the S1 list: `apps/api/tests/*.mjs`, the editor
     `__fixtures__`, `units-conformance`, `units-canonical-form`, `scene-codec`,
     `visitor-cold-runtime` and `perf/lib/workloads/registry.ts`.
   - Rewrite Scene 8 Sky fixtures as `skyFromPreset(...)`.
   - Regenerate revisions and snapshots with the existing helpers.
   - Leave the other units' versions alone.
7. Contracts: `scene-content.md` (fields and codes), `persistence.md`, `scene-codec.md`,
   `architecture.md`, `composition-execution.md`, and the `AGENTS.md` hard rule 2 version.

**B. Model (pure):**

1. `render/sky-time.ts`.
2. `render/sky-atmosphere.ts` (`resolveSkyLook`).
3. `render/world-environment.ts`:
   - build the look from `resolveSkyLook`;
   - keep `resolveSkySun` bounds/bias with direction from the model;
   - `sunShadowKey`, `sunMarkAnchor`, the up-vector guard;
   - presentation: six labels, swatches and glyph kinds; delete `WORLD_ENVIRONMENT_CHOICES` hours.

**C. Writes:**

1. `units/planning.ts`: the revised `scene-environment-set` and the new `scene-sky-update`,
   registered in `createUnitCandidatePlanners`, with `SCENE_SKY_UPDATE_KIND` exported where
   `SCENE_ENVIRONMENT_SET_KIND` is.

**D. Rendering:**

1. `render/WorldEnvironment.svelte`: the equirect background, in-place ground colours, the one
   lease retargeted Sun/Moon, hemisphere props, ambient, fog.
2. `stage/shell/StageShadowTriggers.svelte` gets the Sun key. Update `shadow-invalidation.ts` docs.
3. `fog: false` on the editor-only materials found by the grep.
4. `stage/shell/StageCanvas.svelte`: preview Sky in; Studio means the Paper path.
5. `visitor/VisitorPreviewSurface.svelte` and `routes/p/[publicationId]/+page.svelte`: type
   follow-through only.
6. Scene 9 look golden and the parity test.

**E. Shell:**

1. `stage/shell/StagePopover.svelte` and `stage/shell/stage-panel-rects.svelte.ts`.
2. `EditorCard.svelte`: the yield via `--card-bottom-clearance`, the bottom fade, fold below 160 px.
3. The facade snapshot's `liveGesture`.
4. A new `stage/shell/StageEnvironmentControl.svelte` (control and medallion), mounted in
   `StagePanels.svelte`, with the medallion-only rule against the dock rect.
5. Remove `SkyControl.svelte` and its mount from `StageToolbars.svelte` (the Sky chip leaves the
   viewing bar).
6. `StageDraftingControl.svelte` ⚙ gets *Studio light while editing · this browser* (D2).
7. Update `presentation-tokens.test.ts` for the replaced file.

**F. Sky panel:**

1. `authoring/look/sky-gesture.svelte.ts`: the lifecycle state machine for rules 1–7, shared by the
   panel and the dial.
2. `authoring/look/look-authoring.svelte.ts`:
   - `previewSky`, `updateSky(patch, revision)`, `edited`, `resetSky()`, `aimThroughWindows()`;
   - `stageSky` routing;
   - rename `editOnPaper` to `studioWhileEditing`, keeping the same browser preference key so the
     stored preference survives.
3. `authoring/environment/SkyPanel.svelte`: header, Time dial, Sun direction, tiles, Haze, More,
   Studio state, bottom sheet.
4. `authoring/environment/sky-glyphs.ts`: ported `skyGlyph`, `medallionSVG`, `timeDialSVG`,
   `compassSVG` and `tileArt` as pure SVG-string or Svelte snippets.
5. `authoring/look/sky-session.svelte.ts`: panel-open flag per project, and the live dial-drag owner
   for the fade.
6. Route wiring in `routes/project/[projectId]/spatial/+page.svelte` (one block; S4 rebases).

**G. Celestial Dial:**

1. `authoring/look/celestial-dial.ts`: the model, anchor relocation, shell clearance, arc
   projection (`nearestT`) and the tag.
2. `stage/shell/StageCelestialDial.svelte` (Three) and `StageCelestialDialMarks.svelte` (SVG),
   mounted by `StageCanvas` and `StageOverlay`.
3. `authoring/adapters/sky.adapter.ts`, `adapters/sky/sky-contributions.ts` and
   `adapters/sky/sky-dial-session.ts`: grips, pointer phases, lease, preview, commit, cancel.

**H. Aim:**

1. `authoring/look/aim-through-windows.ts` and the seed-path call.

**I. Contracts:**

1. `docs/reference/design-system/editor-shell-and-visual-system.md` (Shell/PLATE):
   - the Environment control;
   - the Sky panel as the one environment writer;
   - the shared popover primitive with the Card-yield rule;
   - the Celestial Dial as an idle world instrument;
   - Esc ladder rungs 1 and 3a;
   - focus stop 7/7a;
   - the "Look" name: the Look *module* is the resolver; *Looks* are S6 presets.
2. `rendering.md`: the time model, light model, haze mapping, exemptions, preview routing.
3. The T2 README rows in [Superseded contracts](#superseded-contracts).
4. `glossary.md`: Celestial Dial, Environment control.

**J. QA:**

1. Run the journeys below, then the #353 diagnostic (G2 in the rule above), and record both in the
   PR.

## Tests

| Area | File | Asserts |
| --- | --- | --- |
| Codec / validation | `scene-look-schema.test.ts` (extend), `units-conformance`, `units-canonical-form` | Every field's range edges (`time` 24 refused, `heading` 360 refused, `arcHeight` 19/81, `haze` −1/101, `exposure` ±2.1, non-boolean `sunShadows`, uppercase hex); unknown key refused; Scene 8 refused with `unsupported_format_version`; the default Sky is dropped canonically; a Studio Sky with heading 90 is kept; `'paper'` refused |
| Presets | `sky-presets` test | Starts match the table; `skyFromPreset` keeps heading; `skyIsEdited` ignores heading and flags any other field; `sameSky` is order- and case-independent |
| `scene-environment-set` | planner tests | Writes the full start keeping heading; Studio keeps heading; equal is `no-change`; current preset on edited resets; treatment untouched |
| `scene-sky-update` | planner tests | Each field patches alone; `moon` merges; Studio non-heading refused, heading allowed; invalid ranges refused; equal is `no-change`; Undo/Redo restore the exact Sky |
| Time model | `tests/lib/render/sky-time.test.ts` | The §4.3 formulas at 06:30, 13:00, 19:30, 21:00, 00:45 (Moon 38°), 04:30; phase boundaries; az at noon = heading; `snapTime` wrap at 23:57 → 23:55 and at 23:58 → 00:00; Page Up/Down phase starts; `hhmm` 60-minute carry |
| Light model | `sky-atmosphere.test.ts` | HIGH with default colours = S1 Daylight exactly; continuity at 06:30/19:30 (intensity → 0); twilight intensity 0 with held direction; Moon uses `moon.color`; `sunShadows` controls both day Sun and night Moon shadow casting, while twilight casts no visible direct shadow; exposure scales lights ×2^EV but not the background; overcast desaturation; tint keeps colour edits visible at night; fog density formula and clear at 0; light, fog and shadow shape invariant across 96 times |
| Shadow invalidation | `shadow-invalidation.test.ts` + a trigger test | A time/heading/arcHeight change gives exactly one invalidation per frame; haze/exposure/colour/moon give 0; twilight drag gives 0; orbit gives 0 |
| Aim | `aim-through-windows.test.ts` | Single exterior window; two opposite windows weighted by area; interior partition skipped; none → no write; seed heading 0 |
| Gesture lifecycle | `sky-gesture.test.ts` (fake services) | One intent per release or burst; Esc writes 0; trailing change swallowed; revision drift cancels; busy refuses; refusal resyncs; preview held until accepted |
| Panel | `SkyPanel` component test | Studio shows no dials; edited shows Reset; tiles `aria-pressed`; Time dial keys including wrap and Page Up/Down; compass snap and Alt; More rows in order; six tiles do not clip at 320 px (`scrollWidth ≤ clientWidth`); bottom sheet at ≤ 860 |
| Environment control | component test | Second-line variants; edited dot; medallion-only within 12 px of the dock; `aria-expanded`; Esc returns focus; non-modal (an outside press keeps it open) |
| Card yield | `EditorCard` / shell test | Panel overlap sets clearance (Card bottom = panel top − 12); body scrolls; fold below 160 px; never covered |
| Celestial Dial model | `celestial-dial.test.ts` | Constant screen radius across zoom; glyph on the ring at az; tip opposite the body with `L` clamped; `nearestT` stays in the press phase, clamps at the ends, ties toward the previous time; the noon mark sets heading with 15° snap; twilight has no time grips; furniture relocation within 2 m; shell clearance reproduces relocation, and hides when nothing is clear; off-screen hides |
| Sky adapter | `sky-dial.adapter.test.ts` | Hidden unless panel open + not Studio + World + no task + no Preview + preference off; registered planner kind; selection marks first; miss falls through; lease released on every path; one commit on release; Esc writes nothing |
| Fog boundary | `fog-exemption-boundary.test.ts` | The editor-only material list sets `fog: false`; world materials do not |
| Parity | `scene-render-description`, look golden | Stage, Preview and published resolve identically for every preset; Finish golden entries unchanged |
| Isolation | `public-surface-boundary`, `preview-surface-boundary` | No `sky.adapter`, panel, dial, `celestial-dial` or `sky-gesture` import reaches visitor chunks; `sky-time` and `sky-atmosphere` are allowed (runtime-safe) |
| Portability | `renderer-portability-boundary.test.ts` | Still passes: fog, background mapping and `depthFunc` are scene/material properties |

## Browser QA journeys (focused, manual)

Run the built editor in Chrome desktop at 1440, 1280, 1024 and 820, and record the outcomes in the
PR.

1. **Golden-hour walk** (README §11, amended):
   - Open the Environment control and pick Golden.
   - Drag the Sun along the dial's arc until light rakes through an opening.
   - Set Time to 16:00 on the dial and Softness under More.
   - The control reads `Golden hour •` and `16:00 · Sun N°`.
   - One Undo per gesture walks back each step. Reset restores 18:20 in one step.
2. **24 hours:**
   - Drag the Time dial a full turn. Expect day → dusk (no sun, glow on the heading + 90 side, dial
     hint) → night (Moon, cool and dim, its arc in blue) → dawn → day.
   - Page Up/Down land on phase starts. Wrap works at midnight.
3. **Heading:**
   - Drag the noon mark: the arc turns and the tag reads `Noon bearing N°`.
   - Pick Daylight, then Overcast: the heading is unchanged.
   - *Aim through windows* in a room with one exterior window: noon light comes through it.
4. **Cancel everywhere:** Esc mid-drag on the Time dial, compass, sliders, dial glyph, tip and noon
   mark. The image snaps back and history is unchanged. A second Esc closes the panel and focus
   returns to the control. Test the native Sky/Ground/Moon colour input specifically: Esc cancels
   without a Scene write or Undo entry, including in the supported browser's native picker.
5. **Shell:**
   - With a Spot selected and Sky open at 1440, 1280 and 1024: the Card yields (about 0, 100 and
     132 px) and never folds; the dial relocates by about 1.4, 2.0 and 1.7 m with a leader.
   - At 820: a bottom sheet, the medallion-only control, and the Card folded.
   - The panel fades to 20% during an orbit and a Beam drag.
   - The panel stays open on a Stage press.
6. **Authority:**
   - With the panel open, an object press selects and its marks win over dial grips.
   - Arm a light tool: the dial hides.
   - Experience lens: the control is absent and the panel closed.
   - Preview: no dial.
7. **Haze, Exposure, colours and Moon shadows:**
   - Overcast: walls 15 m away stay legible; grids and marks stay crisp.
   - Moonlit at +1 EV: the room is readable.
   - With *Sun shadows* on, the Moon casts shadows at night; turning it off removes both Moon
     and Sun shadows. The More caption explains the shared control. Twilight has no direct shadows.
   - A Sky colour change is visible at noon and at 23:00.
   - Preview and the published visit match the Stage.
8. **Studio:** no dials and no dial. The heading survives Studio → Daylight.
9. **Performance in a real WebGL browser (not unit tests alone):** warm the editor and then drag
   Time continuously across the full 24-hour cycle, including 06:30, 19:30, 21:00, 04:30 and
   midnight. Record before/after and peak `renderer.info.programs` counts **and actual shader
   compile/link calls** with a temporary renderer-module-only development probe (never production
   instrumentation). A stable program count alone is insufficient to prove zero recompiles.
   Expect **zero new shader compile/link calls during a warmed continuous drag**. Separately
   record the discrete Studio switch and Sun-shadows toggle, which may change shader programs.
   Record shadow-map passes per frame: idle Stage and orbit **0**; changing Sun/Moon direction
   at most **1**; held-direction twilight, and Haze/Exposure/colour edits **0**. Attach measured
   evidence and any deviations to the PR; don't claim the budget passed from unit tests alone.
10. **#353 diagnostic**, as in the rule above.

## Acceptance criteria

- Every §4 capability works as specified:
  - the Environment control and Sky panel with all contents;
  - the 24-hour Time dial with Sun, Moon, dusk and dawn;
  - six presets keeping `heading`;
  - Aim through windows;
  - the Celestial Dial with its three grips, furniture and shell rules;
  - responsive behaviour at ≤ 860;
  - the Card-yield rule;
  - the Esc ladder and focus order.
- Scene 9 stores `time`, `heading` and `arcHeight`. Azimuth and elevation are derived everywhere.
  Scene 8 is strictly refused, with no in-app migration or republish path; the incompatibility is
  explicitly documented in the PR.
- One undo step per gesture, burst, tile, Reset or Aim. Cancel writes nothing.
- The Stage, Preview and the published visit render the same Sky. Finish goldens are unchanged.
- The idle Stage renders 0 shadow maps per frame. A warmed full-24-hour Time drag produces no
  shader recompiles, **verified in a real WebGL browser** with compile/link counters and program
  counts, while discrete Studio/shadow-toggle changes are evaluated separately.
- The *Sun shadows* UI truthfully documents that the single Sun/Moon light also casts Moon shadows
  at night; this is tested. The native colour picker Esc path writes nothing and leaves no Undo.
- No reflections, no new dependency, no renderer API outside render modules, no editor module in
  visitor chunks.
- The Sky chip, `SkyControl.svelte` and the old unmounted panel are gone. Every contract in
  [Superseded contracts](#superseded-contracts) is amended.
- #353 has a recorded diagnostic and either an evidence-backed narrow fix or an issue comment.
- `npm run check`, the unit lanes, the API tests and the boundary suites pass.

## Owner rulings and verification gates

**All three choices are accepted for implementation.** D3's native-picker cancellation behaviour
and the final look tuning remain browser acceptance gates, not new planning blockers.

| # | Gap in UX rev 4 | Authorized implementation |
| --- | --- | --- |
| D1 | What the panel and control show while **Studio** is active. §4.3 lists the full contents but Studio has no time, direction or haze, and D18 forbids inert controls. | Header, tiles and the line *Studio light is even and fixed. Pick a sky to set the time.* The control's second line reads `Even light`. No Celestial Dial. Stored values, `heading` included, are kept. |
| D2 | Where the existing per-browser **"Plain Paper while editing"** preference lives. It is not in the §4.3 Contents list, and §8 puts viewing preferences in ⚙. | Move it to the ⚙ Viewing settings as *Studio light while editing · this browser*, keeping its storage key. It is never serialized. |
| D3 | Which **colour picker** the Sky, Ground and Moon swatches open. §3's radial hue/amount picker is fixed at full value, so it cannot express a dark ground or a muted sky. | A swatch row opening the native colour input: `input` previews, `change` commits, and Esc is handled by the platform. Adopt a full-value picker later only if the shell ships one. |

**Engineering definitions** the sheet leaves to implementation (not owner decisions):

- the World mark is the content-bounds plan centre;
- the compass convention is 0° = −Z;
- Exposure scales the Sky's lights, not the renderer (because of S0's `NoToneMapping`);
- haze is a percentage mapped to visibility;
- colours are time-keyframed with user tints;
- the background is equirectangular;
- one light serves as both Sun and Moon.

## Risks

- **Size.** This is the largest T2 slice. One PR is required, because a split would ship the old
  popover against Scene 9 or the new panel against Scene 8, each a temporary system. Review it per
  lettered group.
- **The format bump against S4 (#360).** Mitigated by the coordination rules: S4 touches no Sky
  seam, and the second lander re-runs the fixture sweep.
- **Look tuning.** The keyframe and intensity constants may need owner retuning in QA. Only
  constants and goldens move.
- **Shell rects.** The Card-yield rule and dial clearance depend on live shell rects. The
  `stage-panel-rects` store is the one source, and unit tests drive it with fixed rects.
- **Dial occlusion pass.** `GreaterDepth` on the occluded pass relies on the main depth buffer. The
  layer renders after the scene in the same pass (render order) and needs no extra target. If
  Threlte's ordering resists, fall back to drawing occluded segments by plan-footprint test in the
  SVG layer. The visual contract is the same.

## Readiness and effort

**Implementation authorized in PR #358.** No separate planning merge or new PR is required. Keep
this PR draft until implementation, independent review and browser/owner acceptance. D1 and D2
are final; D3's Esc cancellation and look-tuning constants require browser QA.

**Effort: very high**, about 15–20 agent working days, as one Tier 2 PR. That is roughly 30 source
files (about 8 project-model, 22 editor), about 18 new or extended test files, the fixture sweep,
and about 10 contract documents.

## Review resolution

Revision 2 answers the owner's planning revision on #358 (2026-11-15):

| Owner instruction | Resolution |
| --- | --- |
| Schema follows UX; authorize Scene 9 | Scene 9 stores `time`, `heading` and `arcHeight`; azimuth and elevation are derived. Revision 1's O1 is withdrawn. |
| 24-hour cycle, Sun/Moon, dawn/dusk, six presets, heading preserved | §4.3 model ported exactly; six presets from the prototype data; the planner keeps `heading`, Studio included. |
| Bottom-right Environment control, Celestial Dial, gestures, responsive behaviour, hierarchy | Built as specified; the toolbar popover and the polar sky-chart mark are dropped. |
| Reuse sound engineering | Kept: the planner pattern, the gesture lifecycle, live preview, `FogExp2` (now derived from `haze`), the Sun shadow key, preview routing and parity, and the #353 diagnostic. |
| Reconcile contracts; check S4 | [Superseded contracts](#superseded-contracts) and [S4 coordination](#s4-coordination-360). |
| Push back only with evidence | No pushback. Exposure is defined as a light scale because S0's `NoToneMapping` makes renderer exposure a no-op, as the S0 pipeline record documents. |
