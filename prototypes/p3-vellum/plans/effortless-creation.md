# Vellum P3 · Round 4: effortless creation — implementation plan

Status: **for owner review**. Prototype-only: everything happens in `prototypes/p3-vellum`. No changes to `apps/`,
packages, or `docs/reference`. No commits unless the owner asks, and never an agent footer in a commit message.

**Implementation status at this revision.** Phase 0 is verified, including the cottage fixture after hips, fullness
and overhang (§3.1). Phase 1 (the section model) and the pure half of Phase 2 (zones, detents, ridge turning) are
implemented and tested. Phase 5's compound geometry and Phase 6's offer qualification are implemented as pure model
code. **Not wired into the UI yet:** Hold zones and their handles/highlights/card hint, the Edit Shape sheet, ink
from meaning, Settings' *one span* control, the pen tips, `opAddMezzanine`/`opAddStairTo`, and every browser check in
§11.2 that depends on them. No Phase 3–6 acceptance is claimed.

Intent comes from [the design summary](../DESIGN.md#point-of-view) and
[the working prototype summary](../README.md#whats-real-prepared-simulated-or-unsupported): draw what you mean,
read it back, and preserve accepted work through revision. This plan proposes the next round; only what §3.1 lists
is claimed as implemented.

---

## 1. Goal

Keep what makes Vellum good: the pen that reads a stroke, the sheet, the four marks (ink, pencil, red pencil, blue),
ripples, one-step undo, peeks that spring back, and Tell/Visit. Make the common acts of making a building feel nearly
effortless:

- **Roofs are sculpted by holding the roof itself.** A few hover-revealed gestures replace about 16 permanent dots.
- **Edit Shape** is the one deliberate place for deeper control. It works the same for every roof and is shown in the
  context of the building.
- **Geometry is clean by construction.** Ordinary gestures cannot produce seams, cliffs, spikes or slivers. Limits are
  felt as click-stops with a readout.
- **Ink lines mark meaning** (ridges, hips, valleys, creases, steps, edges), never triangle seams.
- **L-, T- and U-shaped plans get proper roofs**, with wings and valleys.
- **The first shapes are easy:** Box and Round pen tips, plus mezzanine and stair offers where they make sense.

### Principles (normative for this round)

| # | Principle |
| --- | --- |
| P1 | **Three depths.** *Hold* (default, Select): the object itself, about four gesture meanings at most, revealed on hover, always producing a clean result. *Shape* (Edit Shape, entered on purpose): joints, parts and outline. *Settings* (the card): numbers and switches, folded away. Alternate access to the same action (card, key, direct gesture) is welcome; competing gesture meanings at one depth are not. |
| P2 | **One kind of roof.** Every roof is one authored section (`Overhead.profile`) across an outline. Presets are starting points only. Every roof has Edit Shape. Gable and vault/dome get the most support in Hold. |
| P3 | **Clean by construction.** Every edit passes through the same validation (§4.4). Soft detents help the hand; hard validity limits preserve the shape and explain the stop. ⌥ turns off snapping, quantisation and soft detents, never hard limits. The last preview is the committed result. |
| P4 | **Context, not isolation.** Edit Shape hides other *controls*, never the building. |
| P5 | **Ink from meaning** (§7). |
| P6 | **One authored truth.** `ProfilePt[]` stays the only stored section shape; outline, form, direction, hip, fit and the explicit coverage choice remain ordinary roof inputs. Sections, parts, families, zones and wings are derived on demand and never stored. Names describe the result; they never decide which geometry is retained. |
| P7 | **One gesture, one step.** Every model-changing gesture previews through `store.setPreview(op)` and commits once on release, with a plain-language label. Clicks, no-ops and cancellation add no history. |
| P8 | **Show the reach.** A local grab that affects both slopes, both ends, all wings or several rooms highlights that reach before and during the edit and names it in the readout. Pencil previews and alternative readings stay within the same step. |
| P9 | **Offers earn trust.** An automatic offer must fit before it is offered. When no candidate fits, explain the missing space and keep manual drawing available; never knowingly place a broken result and leave the newcomer to repair it. |

**Effort means decisions, discovery and recovery as well as gestures.** A clear action with a predictable result is
better than a shorter action whose reach is hidden. Hold introduces no compulsory tutorial or confirmation dialog.

### Acceptance scenario (the round's success test)

A newcomer builds an L-shaped cottage in under five minutes without opening Edit Shape, and nothing looks broken:

1. Box a room, then Box a wing.
2. Cover both with a pitched roof.
3. Hip the ends, make the slopes fuller, and add overhang.
4. Add a mezzanine in the taller room and a stair up to it.

Then change the roof and recover the previous result with one Undo. §11.3 separates automated correctness from
the human test of discovery and speed. The five-minute target is a hypothesis until newcomers try it.

---

## 2. Starting implementation evidence

The paths and mechanisms below were checked during plan review. The numerical L-plan observation is carried from
the original investigation and must become a reproducible Phase 0 fixture before it is used as a baseline.

| Area | Today |
| --- | --- |
| Roof handles | `src/scene/handles.ts`, overhead case: a peak bead (up/down plus sideways lean), two hip rings, two shoulder rings, an eave bead and edge rings. As detail: profile points `pp:*` and outline corners `n:*`. In Select, dragging the surface bends the profile (`interact.ts` `beginRoofBend`). About 16 targets on a gable. |
| Profile | `ProfilePt { u, h, crease, id }` in `types.ts`. Editing functions in `src/model/overheadGeom.ts`: `movePeak`, `pullShoulder`, `ensureShoulder`, `moveProfilePoint`, `bendProfile`, `insertProfilePoint`, `removeProfilePoint`, `setCrease`, `presetProfile`, `describeProfile`. Limits: `MAX_RISE`, `PEAK_MARGIN`, `SHOULDER_MARGIN`. |
| Pad | `src/ui/ProfilePad.tsx`, 270×128 with a non-uniform scale (heights are stretched). Point drag, line bend, freehand redraw, double-click for a crease or a new point. |
| Mesher | `src/scene/build/overheads.ts` `buildOverhead`. One section spans the outline's full extent along `dir`; hips are the min of the cross slope and the end slope, built from clipped cells. |
| Ink | `stage.ts` `addSolid` uses `THREE.EdgesGeometry(geo, 28°)`, which gives stray lines on curved slopes and clipping seams. |
| L plans | Measured: a 10×6 m block with a 4 m wing under a gable has its inner edges 1.0–1.4 m above the eave (they should be 0). This shows up as cliffs. |
| Drawing | Closed strokes are squared (`strokes.ts`); readings come from `readings.ts`; ⇧ draws a straight line (`interact.ts` `addStrokePoint`). |
| Offers | The room card has *+ Add a floor above* and *Cover it*. Decks have no stair offer. |
| Peeks | `store.beginPeek / updatePeek / commitPeek / cancelPeek`, `pushView`, `back`. |
| Input and saves | In `interact.ts`, ⌥-pointer-down currently starts camera interaction before handles are tested. `store.ts` autosaves and loads project JSON: existing user roofs must not silently change just because the new mesher is available. |

---

## 3. Phases, order and cut lines

Phase numbers identify work packages, not mandatory serial order. Start with Phase 0, then Phase 1. Prove the
small end-to-end journey with Box/room adjacency (Phase 6), compound coverage (Phase 5), Hold (Phase 2) and semantic
ink (Phase 4) before building the full section sheet (Phase 3). Finish the offers (Phase 6), then human acceptance.
Each implementation phase ends with `npm run typecheck`, `npm test` and `npm run build` passing **from this prototype's
directory**, and the app still usable. A plan-only review uses the repository documentation gates.

| Phase | Content | Size | Risk | Cut rule |
| --- | --- | --- | --- | --- |
| 0 | Feasibility fixtures: L/T/U roof continuity, fitted overhang, the §11.3 cottage, usable mezzanine and stair space; Hold edit and cancellation semantics — **model done, see §3.1** (Hold's UI is Phase 2) | S | high | Resolve the headline journey's geometry before expanding the UI. Record unsupported cases precisely. |
| 1 | Section model: parts, joints, families, clean rules (pure) | M | low | — |
| 2 | Hold gestures on the roof (zones, detents, turn the ridge) | M | medium | — |
| 3 | Edit Shape (state, section sheet with context, joints and parts) | L | medium | — |
| 4 | Ink from meaning for roofs | M | medium | Curved roofs must have correct boundaries without triangle seams. If incomplete, defer that family and its claim; returning stray mesh edges does not pass P5. |
| 5 | Roofs for L, T and U plans (wings and valleys); covering neighbouring rooms together | L | high | §8.8 is a prerequisite for the headline journey. A smaller round may ship as partial, but cannot claim Round 4 acceptance without it. |
| 6 | Box and Round pen tips; Platform reading; mezzanine and stair offers | M | low | — |
| 7 | *(optional)* Room sides push/pull | M | medium | Skip if any edge case would need a tie or touch semantics change. |

**Phase 0 deliverable.** Use the actual fitted outline (including default and changed overhang), unequal wing widths,
both ridge orientations and hipped/full slopes. Compare mesh and evaluator at joins, with a candidate loft and stair
inside the resulting room. §8's rectangle algorithm is a candidate, not an established correctness result. Resolve
its failures in pure geometry before assigning size or claiming that every downstream consumer follows automatically.
The required L/T/U baseline is a gable and the fuller slopes used in the journey; other families qualify individually.

### 3.1 Phase 0 — verified results and the decisions they make normative

Run from `prototypes/p3-vellum`: `npm run typecheck`, `npm test` (14 files, 165 tests) and `npm run build` all pass.
Phase 0's evidence lives in `tests/wings.test.ts` (compound roofs and resize continuity), `tests/offers.test.ts`
(mezzanine and stair), `tests/journey.test.ts` (the §11.3 cottage, end to end in model operations) and
`tests/section.test.ts` (the gesture validator and the nearest-preset tolerance). Nothing here is wired into the UI
yet; §5 and §6 still own that.

**Files this phase added or changed.**

| File | Role |
| --- | --- |
| `src/model/profileCurve.ts` (new) | `sampleProfile`, `sampleRaw`, `profileH`, `profilePeak` — the one sampling primitive. It sits below both the roof surface and the section model, so `section.ts` and `overheadGeom.ts` never import each other (§4.4). |
| `src/model/wings.ts` (new) | The pure candidate decomposition, its qualification result and the per-wing height evaluator. |
| `src/model/overheadGeom.ts` | `ohH`, `ohRidge`, `ohSpan` read the wing state; export the sampling primitives. The single-span path is untouched. |
| `src/model/types.ts` | `Overhead.oneSpan?: boolean` (absent = legacy single span). |
| `src/scene/build/overheads.ts` | Compound mesher: per-cell upper envelope of the active wings, fascia from the same evaluator. |
| `src/model/section.ts` (new) | Joints, parts, families, clean rules, edits, freehand readings (§4). |
| `src/model/offers.ts` (new) | Qualified mezzanine and stair candidates (§9.3, §9.4), including the clear-floor scan. |
| `src/model/detents.ts` (new) | Structural-before-pitch stops for Hold (§5.2). Pure; not wired. |
| `src/model/roofZones.ts` (new) | Hold zones for a single-span or compound roof (§5.1). Pure; not wired. |
| `src/model/ops.ts` | `opCoverRooms(..., { wings })`, so a grouped cover is one step and the profile uses the primary span. |
| `tests/journey.test.ts` (new) | The §11.3 cottage end to end in model operations: continuity after the modifiers, the 3 m negative, the 5 m mezzanine-and-stair positive. |

**Compound roofs: what is now proven.** Fixtures: L = 10×6 block with a 4×8 wing; the T, U and plus plans from §8.8;
unequal wing widths (3/5 and 5/3); fitted overhangs 0.30, 0.45, 0.60 and 0.90 m, plus 0.80 m after a resize; hips of
1, 2 and 3.5 m; a bowed (fuller) section; and a wing resized from 4×8 to 5×10 by moving its wall nodes.

- L, T, U and plus give **2, 2, 3 and 3 wings**; the plus splits its cross wing at the primary ridge.
- **Mesh and evaluator agree within 5 mm** at joins, valleys and ownership boundaries on every fixture (probes at
  0.27–0.37 m spacing, top faces only), not merely in total area.
- **Projected top area equals the outline area within 0.1 m²**, and no region is covered twice.
- **Every eave edge parallel to its wing's ridge is at height 0 within 1 cm**, which reverses the measured 1.0–1.4 m
  inner-edge error; this holds at every fitted overhang and after changing the overhang on a live roof.
- **Only exposed ends hip**; joined ends have `hip = 0` at every tested hip length.
- **One pitch across unequal wings**: `scale = wingSpan / primarySpan` to 1e-6, so equal widths and 3/5 give the same
  ridge-height/span ratio.
- **Deterministic** under reversed and cycled outline vertex order and under turning the ridge 90°.
- Existing roofs with `oneSpan` absent still evaluate and mesh as one span; the compound path is opt-in.

**Compound roofs: what the candidate refuses, with a plain reason** (`unsupported.reason`, never a silent fallback):

- an outline edge more than 2° off the frame axes (a slanted wing);
- more than four rectangles (a comb plan);
- a section with steps (`clerestory`, `sawtooth`) or an asymmetric one (saltbox, gambrel at this stage);
- **a wing whose scaled peak stands above the roof it runs into** — the join has no continuous end, so the candidate is
  refused rather than closed with a seam.

**The primary wing can flip when the fitted outline changes, and the rule is now implemented and tested.** At 0.45 m
overhang one L massing is primary; at 0.90 m the other is. Both are continuous roofs, so a fixed primary cannot be the
rule. `continuedWings(prev, next)` compares the gesture-start decomposition with the candidate: the same rectangles,
spans and exposed/joined ends within 8 cm are kept, recomputed for the new outline (fresh scales and hips, never a
replayed old shape). Anything else is refused with the reason *"these walls would give the roof a different massing,
so the last valid roof is kept"* and the caller keeps its last valid preview. A one-span cover appearing under a
compound roof is refused the same way; a plan that has genuinely become one rectangle has no wings left and is
allowed, which is a plan change, not a primary flip. `tests/wings.test.ts` walks a wing from 4 m to 12 m against a
fixed gesture start: 3 cm is kept with the eaves still at 0 and the mesh matching the new outline, every larger step
is refused with the reason, and the sweep crosses a real primary change (several different `primarySpan` values). The
new roof being valid on its own is not enough; continuity is a separate test.

**Gesture-validation semantics (normative for every edit route).**

1. An edit takes the **gesture-start** profile and returns a candidate recomputed from that snapshot on every move.
2. Every candidate goes through `cleanSection(...)`, which is **idempotent including ids** (tested on presets, saltbox,
   gambrel and a bowed section). Preview and commit run the same function on the same input; the last valid preview is
   committed, with no post-release cleanup.
3. An invalid candidate is not committed: the last valid preview stands and the limit is named
   (`at the eave`, `close step (under 30 cm)`, `piece needs more room`, `straight slope limit · 75°`).
4. Untouched parts are never rewritten to make room for an edit; interior points of the two parts touching a moved
   joint keep their fractional place and their offset from the chord, so bows survive.
5. R6 tidy is **removal of a redundant smooth point whose removal moves the sampled curve under 1 cm**, only inside a
   part this gesture redrew. It never touches a joint and never a part the gesture did not touch.
6. Detents are **structural before suggestive**: `centred` / `level with the other side` win over `30°/45°/60° pitch`
   when both are in range. ⌥ (`free`) disables every soft stop; the 75° straight-part cap, the height range and the
   `minPartU` room rule stay hard.
7. `pullPart` normalises the envelope at the **grabbed sampled point**, so the surface under the hand follows it
   before any clamp; a flat or straight part gains exactly one smooth point.

The section model also settles two things the plan left open:

- **Ids on read are deterministic.** `readSection` keeps a document profile's own ids and gives a bare array positional
  ids (`p0`, `p1`, …) instead of random ones, so two reads of the same points agree and a joint can be addressed by id
  from either read. New points created by an edit still come from `newProfileId()`.
- **Freehand readings ship tidy + as-drawn only** for now. The tidy reading is offered only when it keeps the drawing's
  joint/step kinds and moves no point more than `max(0.05 m, 0.02 · span)`; the ridge is snapped only for the gable and
  saltbox families, and a near-symmetric drawing is mirrored exactly. The "nearest preset" reading in §4.5 is **not
  implemented** and must not be claimed until a tolerance test exists.

**Mezzanine and stair offers: what is now proven.** See §9.3 and §9.4 for the amended rules; the fixtures show:

- a 10×6 room under a 5.2 m flat roof qualifies two end strips (5 × 6 m, 2.40 m clear below, 2.50 m above, a stair
  each), and the same room at 3.0 m qualifies nothing with the reason *"Needs more headroom over a usable floor area"*;
- a gable with 3.2 m eaves qualifies nothing although its peak clears 4.80 m — the eaves decide;
- a void and an existing slab are cut out of the footprint, a footprint left with a hole is not offered (it cannot be
  expressed as a deck outline), and a deck filling the room removes the offer entirely;
- plans reach the deck edge, are 1.3 m wide, land on a floor at the deck's foot, and disappear when a wall crosses the
  approach;
- **the §11.3 cottage is fixtured, not just the fixtures around it** (`tests/journey.test.ts`). The L plan is built
  with the model operations the gestures commit: two rooms, one grouped cover with wings in a single accepted step,
  the ridge at 45° over the 6 m room, an even hip (3.57 m at the 0.45 m overhang it is taken at), a bowed (fuller)
  section and a 0.6 m overhang. The roof stays one continuous compound roof (two spans 5.44 m and 7.44 m, mesh top
  area equal to the outline area within 0.1 m², symmetric bowed profile).
  - **At the exact 3.0 m wall top it offers nothing**, and the reason is recorded precisely: the default *flat* ceiling
    sits at the wall top, so a 2.70 m deck leaves 0.30 m everywhere, measured at every 0.4 m sample. The roof itself
    rises to 6 m at the ridge; the ceiling, not a broken roof, is why. This is the same 3.0 m result as the flat-room
    case and it is not weakening the 4.80 m arithmetic.
  - **With the wall top raised to 5.0 m** (the same cottage, the same modifiers, one height change) it qualifies a
    mezzanine and its stair together. Every candidate's clearance is measured from the hipped compound surface,
    `below ≥ 2.40`, `above ≥ 2.10`; the candidate carries its own 1.3 m stair, `fromY = 0`, `toY = deck top`, a run of
    at least `rise · 1.6 − 0.45` and a landing on the room's floor. Preview changes nothing (`decks` and `stairs`
    stay empty); one accepted step makes the deck and the stair, and the stair's `to` is that deck.
  - **The wall-top arithmetic is the caveat, and the fixture states it:** `2.40 below + 0.30 slab + 2.10 above =
    4.80 m`. A cottage with a mezzanine over a 2.70 m deck needs 4.80 m at the eave, so the journey's "taller room"
    is a real requirement, not a UI nicety. The 3 m version is kept as the negative so the boundary is tested.

**Not proven in Phase 0, and not to be claimed:** compound roofs in a live UI (only model operations); the Hold
gesture's UI lifecycle (only its model semantics); every automatic offer's discovery in the UI (the model qualifies
it, `RoomCard` does not show it yet); and every Phase 2–7 wiring item.

---

## 4. Phase 1 — The section model (pure, tested)

New file: **`src/model/section.ts`**. It holds no state and does no rendering. It reads and edits `ProfilePt[]`.

### 4.1 Reading a section

```ts
export type JointKind = 'eave' | 'ridge' | 'valley' | 'crease' | 'step';
export interface Joint {
  id: string;      // the profile point's id (a step: its first point's id)
  kind: JointKind;
  i: number;       // index in the profile
  j: number;       // = i, or i + 1 for a step (or an end that forms a vertical pair)
  u: number;
  h: number;       // pts[i].h
  h2: number;      // pts[j].h (= h unless a step)
}
export type PartKind = 'flat' | 'straight' | 'bowed' | 'curve';
export interface Part {
  id: string;           // `${joints[a].id}>${joints[b].id}`
  kind: PartKind;
  a: number; b: number; // indices into joints
  interior: number[];   // profile indices strictly between joints[a].j and joints[b].i
  dir: -1 | 0 | 1;      // falling / level or mixed / rising, left to right
}
export interface Section { pts: ProfilePt[]; joints: Joint[]; parts: Part[] }
export function readSection(pts: ProfilePt[]): Section;
```

Joint detection (`EPS_U = 1e-6`):

1. **Ends.** The first and last points are always `eave` joints. If an end forms a vertical pair with its neighbour,
   the pair is the eave joint (`j = i + 1` at the start, `i = n − 2` at the end).
2. **Steps.** A vertical pair (`|Δu| < EPS_U`) that isn't at an end becomes a `step` if `|Δh| ≥ 0.05`. A smaller pair
   is a duplicate; clean rule R2 merges it, and `readSection` treats it as a crease.
3. **Creases.** Any other point with `crease: true` is a joint. It's a `ridge` if it is at least 0.02 m higher than
   both neighbouring points, a `valley` if at least 0.02 m lower than both, and a `crease` otherwise.
4. **Smooth points are never joints.**

Part kinds, for each pair of consecutive joints A and B:

- **No interior points:** `flat` if `|B.h − A.h2| < 0.05`, otherwise `straight`.
- **Interior points:** take the part's slice of `sampleProfile(pts)`, i.e. the samples with `u` in `[A.u, B.u]`.
  - If the samples are monotone (no reversal larger than 0.01 m), the part is `straight` when every interior point is
    within `STRAIGHT_TOL = 0.01 m` of the chord, and `bowed` otherwise.
  - If they are not monotone, the part is a `curve` (it contains a smooth top, as on a vault).
- `dir` is the sign of `B.h − A.h2` when `|Δ| ≥ 0.05`, otherwise 0. A `curve` is always 0.

### 4.2 Families: names describe the shape

Joint and part geometry determines editing capabilities. Family names are display labels, never a gate that
changes the mesher or removes an action as the shape crosses a naming tolerance. Freeze gesture capability,
symmetry partners and point identities at pointer-down; update the name from the valid preview.

```ts
export type Family = 'flat' | 'shed' | 'gable' | 'saltbox' | 'gambrel' | 'vault' | 'pointed-vault'
  | 'clerestory' | 'sawtooth' | 'butterfly' | 'folded' | 'dome' | 'cone' | 'free';
export function sectionFamily(sec: Section, form: Overhead['form']): Family;
export const FAMILY_NAMES: Record<Family, string>;
export function roofName(oh: Overhead): string;   // family name with hip status; replaces describeProfile
export function roofDetail(oh: Overhead): string; // e.g. "40° pitch", "ridge 35% across", "rises 2.4 m"
```

The first rule that matches wins:

1. No step or vertical end pair, and the entire sampled section is level within 0.05 m → **flat**.
2. `form === 'revolve'`: any `bowed` or `curve` part → **dome**, else **cone**. A step adds "with a lantern" to the
   detail.
3. Repeated ramps separated by vertical resets → **sawtooth** (count a reset at an end too); otherwise one interior
   step → **clerestory**. Multiple arbitrary steps are not necessarily sawtooth; unmatched sections reach **free**.
4. One part: `curve` → **vault**; `straight` or `bowed` → **shed**.
5. Two parts meeting at a `ridge`:
   - both `bowed` with interior points above the chord → **pointed-vault**;
   - otherwise, if `|ridge.u − 0.5| ≤ 0.03` and both eave heights are within 0.05 m → **gable**;
   - otherwise → **saltbox**.
6. Four parts with `dir` `[+1, +1, −1, −1]` and joints `crease, ridge, crease`, where each lower part is steeper than
   the upper one on its side → **gambrel**.
7. Two parts meeting at a `valley` → **butterfly**.
8. Three or more ridges and valleys in total → **folded**.
9. Otherwise → **free**, shown as "As drawn".

Names: *Flat roof, Shed roof, Gable, Saltbox, Gambrel, Vault, Pointed vault, Clerestory, Sawtooth, Butterfly, Folded
plate, Dome, Cone, As drawn.*

`roofName` adds the hip status for the gable family:
- `hip > 0` → "Hipped gable" (or "Hipped saltbox", "Hipped gambrel");
- hip at its maximum → "Pointed hip"; use "Pyramid" only when the evaluated roof actually has planar faces meeting
  at one apex. A curved or compound roof does not become a pyramid just because a scalar reaches its cap.

Detail strings:

| Case | Detail |
| --- | --- |
| Straight gable or shed | `"40° pitch"`, where pitch = `atan(|Δh| / (Δu · span))`, rounded to 1° |
| Saltbox | `"ridge 35% across"` |
| Bowed gable | `"bowed slopes"` |
| Others | `"rises 2.4 m"` |

Uses of `describeProfile` change as follows:
- in `Inspector.tsx`, use `roofName`;
- keep `describeProfile(oh)` as a thin wrapper that returns `roofName(oh).toLowerCase()`, so other callers don't
  change.

### 4.3 Editing joints and parts

The same functions back the section sheet (§6.3) and the 3D joint handles (§6.2). Each one returns a new profile, and
each uses `withIds`.

```ts
export interface EditOpts {
  span: number;             // metres (ohSpan)
  form: Overhead['form'];
  free?: boolean;           // ⌥: no detents
  solo?: boolean;           // ⇧: break symmetry (move one side only)
  tolU?: number;            // detent radius in u (from the caller's px scale)
  tolH?: number;            // detent radius in metres
}
export const minPartU = (span: number) => Math.min(0.2, 0.4 / Math.max(span, 1e-6));

export function moveJoint(pts: ProfilePt[], jointId: string, u: number, h: number, o: EditOpts):
  { profile: ProfilePt[]; label?: string; merged?: boolean };
export function moveStepEdge(pts: ProfilePt[], jointId: string, edge: 'lo' | 'hi', h: number, o: EditOpts):
  { profile: ProfilePt[]; label?: string };
export function pullPart(pts: ProfilePt[], partId: string, s: number, o: EditOpts & { uGrab: number }): ProfilePt[];
export function splitPart(pts: ProfilePt[], partId: string, u: number, kind: 'crease' | 'step', o: EditOpts):
  { profile: ProfilePt[]; jointId: string } | null;
export function removeJoint(pts: ProfilePt[], jointId: string, o: EditOpts): ProfilePt[] | null;
export function setJointSharp(pts: ProfilePt[], jointId: string, sharp: boolean): ProfilePt[];
```

The minimum is a guard for **new** joints and deliberate merges, not a licence to erase existing short parts.
Existing accepted folds remain editable. Validate finite, positive span before calling these helpers.

**`moveJoint`**
- **Eave joint.** `u` stays fixed and `h' = clamp(h, 0, maxRiseM)`, where `maxRiseM = max(1, MAX_RISE · span)`.
- **Ridge, crease, valley or step joint.**
  - The allowed range is `lo = prev.u + minPartU`, `hi = next.u − minPartU`, where `prev` and `next` are the
    neighbouring joints. For an existing narrower part, use its gesture-start gap as that side's minimum; beginning
    a drag must not jump the joint or erase accepted detail.
  - If `u` passes either limit by more than `minPartU / 2`, preview `removeJoint(...)` when allowed, with
    `merged: true` and *"Merge with its neighbour"*. Keep a pencil trace of the original joint. Moving back restores
    it from the gesture-start section. Release commits exactly that preview; no extra cleanup occurs after release.
  - Otherwise `u' = clamp(u, lo, hi)`. If `lo > hi`, `u` doesn't move.
  - A step moves both of its points in `u` and ignores `h` (heights go through `moveStepEdge`).
- **Height clamp.** For a non-step joint, `h' = clamp(h, 0, maxRiseM)`. Against each neighbouring joint across a
  `straight` part, it is also limited so that `|Δh| ≤ tan(75°) · |Δu| · span`.
- **Symmetry.** When `profileSymmetric(pts)` holds at gesture start, the joint has a mirror partner other than itself, and `!o.solo`,
  the partner moves to `(1 − u', h')`. A centred ridge has no partner, so moving it sideways makes a saltbox.
- **Detents** (unless `o.free`):
  - in `u`: 0.5 when the joint is the only ridge;
  - in `h`: the other joints' heights, and the 30°/45°/60° pitch heights of the straight part towards the nearest
    eave;
  - in both: the mirror position when solo.
  - The label names the detent: "centred", "level with the other side", "45° pitch".
  - **Structural stops outrank pitch suggestions** (settled in Phase 0): if `centred` or `level with the other side`
    is in range, it wins over a pitch stop at the same distance. A pitch stop is a suggestion about the slope; a
    structural stop is what the hand meant. The solo mirror stop returns the joint to its symmetric place (label
    "mirrored") and is a no-op at gesture start, so it never fights the first move.
- **Parts keep their shape.** Interior points of the two parts that touch the joint keep their relative position
  `t = (u − uA) / (uB − uA)` and their offset from the chord: `h_new = chord'(t) + (h_old − chord(t))`. Bows survive
  the move.

**`moveStepEdge`**
- `h' = clamp(h, 0, maxRiseM)` for the chosen edge.
- If the step becomes shorter than `MIN_STEP`, preview the closed crease and label it *"Close this step"*.
  Retain the original pair in the gesture snapshot so reversing the drag restores it. The final preview and commit
  must match.
- Neighbouring parts are remapped as in `moveJoint`.

**`pullPart`**
- **Straight, bowed or flat part.** If the part has no interior point, insert one smooth point at the chord midpoint.
  Then move every interior point perpendicular to the chord, working in metres `(u·span, h)`:
  - use the envelope `w(t) = sin(πt)`, zero at the end joints;
  - normalise its response at the **grabbed point on the sampled curve**, so that point follows the requested
    normal displacement `s` before a hard limit. Normalising at the most central control point makes off-centre
    grabs slip. Near-zero influence belongs to the joint hit region; do not amplify it into a spike;
  - positive `s` is "above the chord" (outward).
  - Afterwards, `u` is clamped to `(uA + 0.02, uB − 0.02)` and kept in order, and `h ≥ 0`.
  - The mirror part moves too under the same symmetry rule as `moveJoint`.
- **Curve part.** Reuse the bend kernel only with its actual vertical-height delta (it is not a normal-distance API).
  Convert the pointer movement in section metres and validate the sampled curve; do not pass `s` unchanged and
  claim that the grabbed point follows the normal.

**`splitPart`**
- Returns `null` if either new piece would be narrower than `minPartU`.
- `'crease'`: `insertProfilePoint`, then `setCrease(true)`.
- `'step'`: at `u`, insert `(u, hc)` and `(u, hc + 0.6)`, where `hc` is the curve height at `u`. Then raise every
  point after the step, up to the next eave or ridge joint at `u_end` (not including it), by
  `0.6 · (1 − (u_k − u) / (u_end − u))`. The far joint stays where it was. On a gable's left slope this gives a
  clerestory; the ridge doesn't move.

**`removeJoint`**
- Returns `null` for an eave, and for the only joint higher than 0.05 m (use the Flat preset to flatten a roof).
- Removing a step removes both of its points.
- The result goes through `cleanSection`.

**`setJointSharp`** wraps `setCrease`. A smooth ridge stops being a joint, so a gable with a smooth ridge reads as one
`curve` part (a vault).

**Fullness in Hold vs in Edit Shape.** In Hold (§5), fullness keeps using the existing `pullShoulder`, which slides the
slope's points sideways with mirroring and suits gables, vaults and domes. In Edit Shape, dragging a part uses
`pullPart`. Both are kept on purpose: one shapes a whole side of the roof, the other shapes one part.

### 4.4 Clean rules

```ts
export const MIN_STEP = 0.3, MAX_SLOPE_DEG = 75, STRAIGHT_TOL = 0.01;
export interface CleanResult { profile: ProfilePt[]; notes: string[]; valid: boolean }
export function cleanSection(pts: ProfilePt[], o: {
  span: number; form: Overhead['form']; protect?: string[];
  before?: ProfilePt[]; edited?: string[]; allowMerge?: string[];
}): CleanResult;
```

The rules below are candidate normalisations inside a **gesture validator**, not a global rewrite of accepted
profiles. Evaluate from the gesture-start snapshot on every move. `protect` includes the active joint, both ids of
a step and any mirror partner; it prevents unrelated cleanup, not the deliberate merge requested by that gesture.
Use the same protection and result at preview and commit. Presets, freehand readings, Hold, Shape and Settings all
use this boundary; reject an invalid candidate by retaining the last valid preview and naming the limit.

| Rule | Behaviour | Note |
| --- | --- | --- |
| R1 heights | Limit the proposed edit to `[0, maxRiseM]`; reject non-finite input. Do not alter untouched points to accommodate it. | "as tall as it goes" / "at the eave" |
| R2 order | Preserve profile order and ids during edits; never sort crossing joints into a different topology. Freehand input may be ordered before its readings are offered. Collapse coincident duplicates only in the affected region and show the candidate. | "points meet here" |
| R3 short steps | A deliberately shortened step under `MIN_STEP` may preview as one crease at the higher height, keeping its first id. An untouched step does not close as a side effect. | "close step (under 30 cm)" |
| R4 slivers | Stop newly created parts at `minPartU`; an explicit merge may remove the touched joint (§4.3). Preserve existing short parts. Never merge an unrelated joint to make space. | "piece needs more room" / "merge with neighbour" |
| R5 steepness | Limit a changed straight non-step part to 75°. Do not invent a glazed step to repair a steep drag; Step is an explicit Shape action. Smooth vault/dome tangents may be steeper: test them for folds, unintended vertical runs and overshoot rather than applying the straight-part cap blindly. | "straight slope limit · 75°" |
| R6 tidy | Simplify only if the **sampled curve**, not just control points, stays within `STRAIGHT_TOL` of its previous shape. Preserve authored joints unless the gesture explicitly removes them. | "straight" when returning a new bow to its chord |
| R7 ids | New points get `newProfileId()`. Reading keeps a document profile's ids and gives a bare array **deterministic positional ids** (`p0`, `p1`, …), so two reads of the same points agree; a gesture can address a joint by id from either read. | — |

**R6 as implemented:** the tidy step removes a *redundant smooth point* whose removal moves the sampled curve by
less than `STRAIGHT_TOL`, and only inside a part every interior point of which this gesture edited. It never removes
a joint and never edits a part the gesture did not touch. This is the reading that satisfies both "simplify only if
the sampled curve stays" and "preserve authored joints"; flattening a genuine bow to its chord is not tidy and is not
done. Phase 0 also settled that an invalid candidate is simply not committed, rather than repaired.

`cleanSection` must be **idempotent**: `clean(clean(x)) ≡ clean(x)`, including ids. Validate after all rules and repeat
only to a bounded fixed point; if they oscillate or remain invalid, reject the candidate. Sampled curves must be
finite, ordered and free of accidental vertical segments, zero-area folds and overshoot beyond the permitted
height. Inspect the interpolation itself, not only the control polygon. Presets remain unchanged over their
supported span range; changing that range requires explicit evidence, never silent removal of sawteeth or folds.

**Revolve has one radial shape.** The current evaluator consumes only `u ∈ [0, 0.5]`. In Shape show/edit that radial
half with the opposite half as a mirrored preview, and mirror edits into `ProfilePt[]`. Disable solo for revolve;
never offer editable points on an unused half. A pre-existing asymmetric profile is shown honestly and is only
normalised by an explicit previewed reading. `section.ts` and the evaluator must not form a circular import:
shared sampling primitives sit below both; the naming wrapper sits above them.

### 4.5 Reading a freehand section

```ts
export interface SectionReading { id: string; label: string; detail: string; profile: ProfilePt[] }
export function readSectionStroke(raw: V2[] /* (u, h) */, o: { span: number; form: Overhead['form'] }): SectionReading[];
```

1. Validate `fitProfile(raw, span)` with `cleanSection(..., { span, form })`; `base` is the valid result's profile.
   `fitProfile` already exists in `strokes.ts`. Invalid results produce no destructive replacement reading.
2. **Tidy reading.** Take the family of `base`, then:
   - for a gable or saltbox, snap the ridge to `u = 0.5` when within 0.06;
   - snap eave heights under 0.15 m to 0;
   - snap straight-part pitches to the nearest 5°;
   - mirror exactly when every joint pairs with its mirror within 0.04 in `u` and 0.1 m in `h`;
   - clean again.

   Label: the family name with its detail.
3. **As drawn.** `base`, labelled "As drawn".
4. **Nearest preset.** Compare only form-compatible, validated candidates in physical height over 50 samples,
   preserving step topology where present. Offer a preset only when the error is within a declared, tested tolerance;
   do not always invent a third choice for a distant shape. Skip it when equivalent to the tidy reading.
   **Implemented and tested.** `PRESET_TOL(span) = max(0.12 m, 0.035 · span)` is the largest physical height error
   a preset may have; `nearestPreset` returns the closest form-compatible preset within it, comparing only presets
   with the same step topology as the drawing. The reading appears after the tidy reading and before *As drawn*, and
   is dropped when it repeats either. Tests in `tests/section.test.ts` bound it in both directions: a gable 0.9·tol
   high is read as a gable (error reported and ≤ tol), one 1.15·tol high has no preset reading at all and keeps *As
   drawn*; the same 0.20 m miss is rejected at a 3 m span (tol 0.12) and accepted at 10 m (tol 0.35); and a
   clerestory drawing is never flattened into a smooth family. The tolerance is not tuned per stroke.

Remove duplicate profiles by sampled geometry and joint/step topology (within 1e-4), ignoring ids. Apply Tidy first
only when its maximum displacement is within `max(0.05 m, 0.02 · span)` and it preserves the drawing's joints and
steps; otherwise As drawn is first. Degenerate scribbles leave the old roof unchanged, with no empty undo step.

### 4.6 Tests: `tests/section.test.ts`

- `readSection` on every preset gives the expected joints, parts and family:
  - gable: 3 joints, 2 straight parts, **gable**;
  - vault: 2 joints, 1 curve part, **vault**;
  - clerestory: 1 step, **clerestory**;
  - also butterfly, sawtooth, fold, dome and cone.
- **saltbox** comes from `moveJoint` of a gable's ridge to `u = 0.35`, and **gambrel** from two `splitPart` creases
  pulled out.
- `cleanSection` is idempotent and leaves presets unchanged.
- Deliberately shortening a step previews its closure; release does not change the preview. Adding a sliver is
  refused; an unrelated existing narrow part survives. A steep straight drag stops without inventing glazing.
  Near-straight simplification compares the sampled curve. Include repeated fold/sawtooth presets over small and
  large supported spans, constant elevated flat roofs, end resets, and revolve edits on the consumed radial half.
- `moveJoint`:
  - stays within `minPartU` of its neighbours, and merges past `minPartU / 2`;
  - mirrors a symmetric section, and not with `solo`;
  - honours the 75° limit against straight neighbours;
  - keeps the bows of neighbouring parts (their offsets from the chord are unchanged);
  - stops at the 45° pitch detent, and doesn't with `free`.
- `pullPart` inserts at most one point per affected part, makes the sampled grab follow the requested displacement
  before limits, and mirrors. Include off-centre grabs and nearly vertical/flat tangents.
- `splitPart('step')` keeps the far joint and the ridge in place; `removeJoint` refuses eaves and the only ridge.
- `readSectionStroke`: a wobbly near-symmetric ∧ reads first as **Gable** at `u = 0.5` with a pitch snapped to 5°,
  and has an "As drawn" alternative.
- Ids survive every edit except removal.
- Replaying sparse or dense pointer samples from the same gesture start gives the same final geometry and ids;
  reversing a merge/closure before release restores the original. Every mutation route passes the same validator.

---

## 5. Phase 2 — Hold gestures on the roof

### 5.1 Zones (pure): `src/model/roofZones.ts`

```ts
export type RoofZone =
  | { kind: 'ridge'; wing: number }
  | { kind: 'ridgeEnd'; end: 'A' | 'B'; wing: number }
  | { kind: 'endFace'; end: 'A' | 'B'; wing: number }
  | { kind: 'slope'; side: 'L' | 'R'; wing: number; locked: boolean }
  | { kind: 'eave'; edge: number }
  | { kind: 'flatTop' }
  | { kind: 'apex' };
export interface ZoneTol { ridge: number; end: number; eave: number } // metres (caller converts from px via mpp)
export function roofZoneAt(oh: Overhead, q: V2, tol: ZoneTol): RoofZone | null;
export function zoneGeometry(oh: Overhead, z: RoofZone): { lines: [number, number, number][][]; ring?: [number, number, number] };
export const ZONE_TIPS: Record<RoofZone['kind'], string>;
```

`wing` is always 0 until Phase 5. Classification uses `ohFrame` (`f`) and `profilePeak` (`pk`), with:
`wr = f.wmin + pk.u·(f.wmax − f.wmin)`, `ea = [−d₁, d₀]`, `vA = f.emin + f.hip`, `vB = f.emax − f.hip`,
`w = dot(q, d)` and `v = dot(q, ea)`. The first rule that matches wins.

These metre-space rules generate candidates. Resolve ambiguous hits against the **visible projected surface** in
CSS pixels, including inspection lift/cut transforms. Hidden ridges cannot steal a visible eave; at small scales,
overlapping zones show one stable candidate with a little hysteresis, not a flickering list. `flatTop` means a level
sampled section, including a constant elevated one, not simply `pk.h < 0.05`. Ridge zones require a real interior
ridge or smooth crown; a shed's high edge and a butterfly's two high edges must not masquerade as a central ridge.

**Revolve:**
1. A level section → `flatTop`.
2. Within `tol.end` of `f.center` → `apex`.
3. Within `tol.eave` of an outline edge → `eave`.
4. Otherwise → `slope 'L'`.

**Extrude:**
1. **Flat** (level section): within `tol.eave` of an outline edge → `eave`; otherwise → `flatTop`.
2. **Ridge ends**, when the roof can hip (the same condition as today's `canHip` in `handles.ts`): within `tol.end`
   of `(wr, vA)` → `ridgeEnd 'A'`; within `tol.end` of `(wr, vB)` → `ridgeEnd 'B'`.
3. **Ridge**: `|w − wr| < tol.ridge` with `v` in `[vA − tol.ridge, vB + tol.ridge]` → `ridge`. A flat-topped ridge
   (`pk.i0 < pk.i1`) uses the band between the two points' `w`.
4. **Eave**: `distToPolyEdge(q, outline) < tol.eave` → `eave`, on the nearest edge.
5. **End face**: `f.hip > 0` and `hipH(f, v) < profileH(f.samples, ohU(oh, q)) − 1e-6` → `endFace`; A when
   `v < (f.emin + f.emax) / 2`.
6. **Slope**: L when `w < wr`, otherwise R. It is unlocked only when the section has a qualified continuous side
   supported by the fullness operation; steps, repeated folds and ambiguous multi-crown shapes direct to Shape.
   Evaluate capabilities from geometry, not the display family string.

`zoneGeometry` returns world coordinates without lift, 0.03 m above the top surface. Draped lines are sampled every
0.25 m and lifted with `ohTopAt`.

| Zone | Geometry |
| --- | --- |
| ridge | the ridge segment |
| ridgeEnd | a ring at the end, plus the ridge segment |
| slope | the boundary of `outline ∩ {w < wr}` (or `> wr`), from `clip.intersection` with a large half-plane rectangle, draped |
| endFace | the boundary of `outline ∩ {v < vA}` (or `> vB`), draped |
| eave | the edge, draped |
| flatTop | the outline ring |
| apex | a ring at the apex |

**Phase 2 model implemented (verified in `src/model/roofZones.ts`, `tests/zones.test.ts`); the wiring in §5.3 is not.**

- The zone rules above hold, with three decisions the fixtures forced:
  - a compound roof classifies in the frame of the wing that **owns** the point (the highest wing whose rectangle
    contains it, ties by wing index) — the wing index must be the original index, not the index within the filtered
    list, or every wing reports wing 0;
  - on a compound roof the ridge and ridge-end tests run **before** the eave test, so a ridge end that meets the eave
    can still be grabbed, while a joined end never reports `ridgeEnd`;
  - a point covered by no wing (only reachable with a stale state) falls back to `eave`/`flatTop` rather than guessing.
- A slope is `locked` when its side of the section contains a step or reverses direction; a step anywhere on the side
  makes Hold's sideways pull a Shape job. A vault's smooth crown is a `ridge`; a shed's high edge and a butterfly's
  two high edges are not.
- `ridgeDirections` returns **span** directions (outline edge + 90°), because `oh.dir` is the span; `nextRidgeDir`
  skips any direction within 2° of the current one, so a turn always visibly turns. Turning preserves the authored
  heights (tested) and the old ridge line stops being a ridge.
- `zoneGeometry` drapes polylines with `ohTopAt` + 0.03 m and clips slope/end-face regions to the wing rectangle.
  The pixel-space tie-break and hysteresis between overlapping zones remain a caller responsibility.
- `detents.ts` implements `detent` with 1.5× hysteresis, coincident-stop merging and deterministic nearest ties;
  structural stops precede pitch stops at the section level (§4.3). **Even hip is defined as half the roof's span**,
  so it stays distinct from "ends meet" (`(emax − emin) / 2`). A fullness stop exists only where the side has a
  smooth point; its displacement is that side's mean offset from the chord.

`ZONE_TIPS` (plain language):

| Zone | Tip |
| --- | --- |
| ridge, apex | "Drag up or down: taller or flatter" |
| ridgeEnd | "Drag along the ridge: hip both ends" |
| endFace | "Push in to hip both ends" |
| slope | "Push or pull: fuller or pointier" |
| slope (locked) | "Double-click to edit this shape" |
| eave (fitted roof) | "Drag out for more overhang" |
| eave (otherwise) | "Push or pull this edge" |
| flatTop | "Pull up to give it a peak" |

### 5.2 Detents: `src/model/detents.ts`

```ts
export interface Stop { at: number; label: string }
export function detent(v: number, stops: Stop[], radius: number, free: boolean,
  active?: number): { v: number; label?: string; active?: number };
```

| Gesture | Stops | Radius |
| --- | --- | --- |
| Ridge height (gable, saltbox or shed with straight parts) | the heights giving 30°, 45° and 60° on the side with the longer run | `max(0.06, 8px·mpp)` |
| Hip | 0 ("gable ends"); `W / 2` ("even hip") only for symmetric straight gables; `(emax − emin) / 2` ("ends meet") | `max(0.25, 10px·mpp)` |
| Fullness | The displacement that actually straightens the affected slope; on an initially straight slope, 0 returns the original without adding a point. Also expose the gesture-start value as "as it was" when different. | `max(0.05, 6px·mpp)` |
| Overhang | 0, 0.30, 0.45, 0.60 m | 0.05 |

Discard unreachable stops, merge coincident ones and choose the nearest with deterministic ties. Hold a detent
until the pointer leaves 1.5× its capture radius; this state belongs to the gesture. Measure capture distance along
the projected drag axis, avoiding oversized catch zones at shallow camera angles. Releasing ⌥ re-enables soft
stops without resetting the gesture origin. Hard limits always report their reason.

### 5.3 Wiring

**Not started.** Everything in this subsection is still to do; the model above is the verified part of Phase 2.

**`src/scene/handles.ts`**
- Add `zoneHandle(stage, oh, zone, hit): Handle | null`. It builds a transient `Handle`, the same way `beginRoofBend`
  does today:

  | Zone | Mode | Drag |
  | --- | --- | --- |
  | ridge, apex, flatTop | `vertical` at the hit point | `h = clamp(pk.h + (y − y0), 0, maxRise(oh))` with applicable ridge detents, then `movePeak(prof, pk.u, h, false)`. FlatTop explicitly grows a centred peak above its existing level (including elevated flat profiles), preserving the ends. Readout: "rises 2.40 m · 40°" only for a straight pitch, plus the hard-limit reason. Commit: "Made {name} taller" or "Made {name} flatter". |
  | ridgeEnd | `plan` at ridge height | Today's hip-ring logic (`hip = clamp(along − emin, 0, half)`) with the hip detents. |
  | endFace | `plan` at the hit height | `hip = hip0 + inward displacement along ea`, with the hip detents. |
  | slope | `surface`, origin = hit plan point, `tan = f.d` | See the fullness paragraph below. Commit: "Made {name} fuller" or "Made {name} pointier". |
  | eave, fitted roof | `plan` at the eave | `dd = dot(pt − grab, outward normal of the edge)`, then update `fit.overhang` within `[0, 1.5]`, rounding to 0.05 m unless ⌥ is held, with overhang detents. Settle's fit pass redraws the outline in the same step. Readout: "all edges · overhang 45 cm"; highlight the whole fitted boundary. |
  | eave, other roofs | `plan` at the eave | Today's `e:i` edge push (gives the roof its own outline). |

  **Slope fullness.** Let `s` be the drag distance, in section metres, along the slope's outward normal, where the
  slope's tangent runs from its eave to `(pk.u·W, pk.h)`.
  - Convert it to a sideways move: `du = ∓ s / (max(0.2, sin θ) · W)`, with − for L and + for R, θ being the slope
    angle.
  - On the first move, call `ensureShoulder` (on both sides when `profileSymmetric`), then `pullShoulder(base, side,
    du)`.
  - The fullness detent applies.
  - Allocate inserted ids once and reuse the gesture-start baseline, never the last preview. Reversing the drag
    must undo its own deformation. For a pre-bowed part, derive the straightening displacement or omit that detent;
    zero movement must never be labelled "straight" when the slope is still bowed.
  - Hip and fullness highlight all ends/slopes they will change. The current `hip` is shared, so neither gesture nor
    copy may promise independent end editing. Wing scaling and linked reach are specified in §8.4.
- **Hold-mode handles for a selected overhead** (not shaping):
  - remove the peak bead, hip rings, shoulder rings, `pp:*` points, `n:*` corners and `e:*` rings;
  - keep the eave bead only for a free roof (`!restsOn && !fit`), labelled "height", because a canopy has no walls to
    follow;
  - everything else is a zone.

**`src/scene/interact.ts`**
- **Idle hover** (Select, Make, a roof selected, whether or not it is being shaped; §6.2 keeps the zones active in
  Edit Shape). Replace the `overRoof` cursor logic:
  - pick; if the hit is the selected roof, `zone = roofZoneAt(shownRoof, hitPlan, tol)` with tolerances from
    `stage.mpp()`: ridge 14 px, end 18 px, eave 12 px;
  - call `ov.setZone(zoneGeometry(...), ZONE_TIPS[...])`;
  - cursor: `ns-resize` for ridge, apex and flatTop; `ew-resize` for ridgeEnd and endFace; `grab` for slope and eave;
    `default` when locked;
  - clear the highlight when the pointer leaves the roof.
- **`onDown`**: explicit camera commands (right/middle button, Space) keep priority. For primary-button Select,
  test joint/outline handles, then the selected roof's visible zone. ⌥ on those targets means a free edit; ⌥ on
  other surfaces keeps the existing orbit shortcut. Choose the owner once at pointer-down; modifier changes do
  not transfer a running drag to the camera.
- Arm a zone gesture on down, then start its preview after 4 CSS px of movement. Below threshold it is a click,
  creates no history, and double-click can still enter Shape. Locked zones retain the ordinary camera behaviour,
  with a visible Edit shape action. Camera orbit remains available over the entire roof by explicit camera gesture.
- **Delete `beginRoofBend`** and the "drag the picked roof's surface" branch in `onMove`.
- **Keys** (all currently free in `onKey`):
  - **R**: turn the ridge (§5.4) when a roof is selected;
  - **Enter**: enter Edit Shape (§6.1).

**`src/scene/overlays.ts`**
- Add `setZone(g | null, tip?: string)`:
  - draws the zone lines with one reusable `Line2` (blue, 2 px, `depthTest: false`, `renderOrder: 22`) plus a ring
    mesh, and the tip as a `handle-tip` label at the pointer;
  - while dragging, `interact` refreshes the geometry from `store.shown` each frame in `flushHandleMove`;
  - preserve scene occlusion when revealing a zone; `depthTest: false` must not expose a zone behind another part.
- The **blue section line** (`this.section`) shows only while shaping (§6), no longer whenever a roof is selected.
- `visibleHandle`: remove the `store.ui.allHandles` branch.

**`src/store.ts`, `src/ui/Inspector.tsx`:** remove `allHandles` and the *Show every point* toggle. Walls keep
detail-tier handles that appear as the pointer comes near.

### 5.4 Turn the ridge

`src/model/overheadGeom.ts`:

```ts
export function ridgeDirections(oh: Overhead): number[]; // distinct outline edge directions mod π (merged within 2°),
                                                         // sorted by total edge length, at most 4
export function nextRidgeDir(oh: Overhead): number | null; // the one after the current dir (match within 2°);
                                                           // null for revolve, flat, or fewer than 2 directions
```

It is offered three ways:
- the roof card's **"Turn the ridge"** button;
- **R**;
- the context menu (§6.1).

Each is one step: `opOverhead(id, { dir })`, "Turned {name}'s ridge". The degree slider stays in Settings.
`oh.dir` is the **span** direction; the displayed ridge is perpendicular to it. Preview turning on button hover/focus
and validate the changed span, height limits, fit and compound coverage before committing. Preserve authored profile
heights; do not quietly rescale them on a turn. A compound roof whose result is unchanged has no Turn action.

### 5.5 Roof card in Hold

`OverheadCard` in `Inspector.tsx`, top to bottom:
1. Head: `kind = "Roof · " + roofName(oh)` and the editable name.
2. Facts: area, eave, highest point, and `roofDetail(oh)`.
3. **`SectionThumb`**, a new read-only canvas (270×90, uniform scale, ink only). Clicking it enters Edit Shape.
4. Buttons: **Edit shape** (primary) and **Turn the ridge** (when `nextRidgeDir` isn't null).
5. A `details` element named **Settings** (replacing *Shapes & settings*): span direction slider, spans one way /
   spins round, eave, overhang or *Fit to the walls below*, thickness, and *Cover as one span* (Phase 5).
6. Presets move to Edit Shape.
7. The Remember list and the Remove row, unchanged.

**Discovery without dots.** The selected roof card keeps one short hint: *"Hold the ridge, a slope, an end or an
edge"*. Hover/focus over the corresponding words reveals those zones without moving the camera or editing.
Unavailable meanings are omitted. Keyboard focus reaches Edit shape, Turn and Settings; shortcuts ignore text
inputs and editable names. The hint is persistent enough for a newcomer to discover the gestures without Help.

**Gesture lifecycle (all depths).** Esc, pointer cancellation, lost capture, window blur, mode/tool change or deletion
of the target cancels the preview and queued animation-frame work without a history entry. Release flushes the last
pointer position, commits only a changed valid result once, then clears preview. A click, cancelled gesture, or drag
back to the original creates no undo step. A new action cannot accidentally commit a leftover hover preview.

### 5.6 Tests: `tests/zones.test.ts`

- On a 6×10 m gable, `roofZoneAt` gives: ridge at the ridge midpoint, ridgeEnd A and B at the ends (hipped), eave
  near each edge, slope L and R either side, and endFace inside a hipped end.
- A vault gives slope zones that aren't locked; a clerestory gives locked slope zones; flat gives `flatTop`; a dome
  gives `apex` at the centre.
- Detent tests:
  - the ridge drag stops at 45°;
  - the hip snaps to 0, to a qualified even hip and to ends meeting, with truthful names;
  - fullness near 0 returns the original profile, with no point added;
  - `free` disables all of these.
- `nextRidgeDir` cycles through two directions on a rectangle and returns null on a dome.
- The overhang drag on a fitted roof changes `fit.overhang`, keeps the fit, and the settled outline grows by the
  difference.
- Test modifier precedence before and during a drag, detent hysteresis, no-op clicks/double-clicks, cancellation,
  overlapping projected zones, inspection lift, and shared-end copy/highlights. Flat elevated roofs and sheds get
  truthful capabilities. On a pre-bowed roof, zero displacement preserves the bow and says "as it was".

---

## 6. Phase 3 — Edit Shape

### 6.1 State, entry and exit

- **State.** `UIState.shaping: string | null` (a roof id) and `UIState.seeThrough: boolean`. This is session state
  only, with no authored history. Entering saves prior inspection state and keyboard focus; leaving restores them.
  Face the section uses the existing view stack, with one return snapshot per shaping session.
- **Entering**, in Select with a roof:
  - double-click the roof (`onDbl`: a roof hit in Select calls `enterShaping(id)`; any other hit still isolates as
    today);
  - **Enter**;
  - the card's **Edit shape** button, or a click on the thumbnail;
  - the context menu.

  `enterShaping(id)` selects the roof and sets `shaping`.
- **Context menu.** New `src/ui/ContextMenu.tsx`, with state `UIState.menu: { at: [x, y]; id: string } | null`.
  - In `onDown`, a button-2 press records `{x, y, t}` (it still enters the camera state).
  - In `onUp`, if that press moved less than 4 px and lasted less than 350 ms, and its pick is a roof, open the menu
    with three items: *Edit shape*, *Turn the ridge* and *Remove*. *Remove* uses the same op and preview as
    `RemoveRow`.
  - Esc, a click outside, or choosing an item closes it.
- **Leaving:**
  - **Done**, **Enter**, or **Esc** when no drag is in progress. Esc exits shaping before `store.back()` does anything
    with the view;
  - a click on anything other than the shaping roof or its handles. That click **only exits**, it doesn't select, so
    it can't surprise you;
  - `store.select(other)`, switching to Draw, or the roof no longer existing.
- **Undo and redo** keep `shaping` while the roof exists. Each gesture inside is its own step, as everywhere else.
- **Focus and keys.** R, X, Enter and Delete never intercept typing in names/settings. The sheet has a focusable
  region and labelled controls. Leaving returns focus to its entry control when present. Context-menu items support
  keyboard activation and Escape; right-drag remains camera movement. The menu is an alternate entry, not a
  prerequisite for any operation.

### 6.2 The 3D view while shaping

- **Nothing dims.** The building renders as usual.
- **Picking.** Hover and selection of other elements are suspended in `interact` (when `ui.shaping` is set, any hit
  whose id isn't the shaping roof is treated as empty for hover). Camera gestures are unchanged.
- **The blue section line** is drawn on the roof (the existing `ov.section`, now only while shaping).
- **`handlesFor` in shaping mode** returns, all at primary tier:
  - `j:<jointId>` dots on the section at `ohSection(oh).at(u, h)` for every joint (eaves included, so an eave can be
    raised);
  - for a step, `jlo:<id>` and `jhi:<id>` at its two heights, plus `j:<id>` at its middle for sliding it;
  - all in `surface` mode on the section plane: `sec.uh` gives `(u, h)`, then `moveJoint` or `moveStepEdge` with
    `tolU` and `tolH` derived from `mpp`. Every preview uses §4.4's gesture validator, protecting both ids of a step
    and mirror partners; commit reuses the same validated result;
  - outline corners `n:*` and edges `e:*`, using today's logic. On a fitted roof their titles say *"Pull to give it
    its own outline (it stops following the walls)"*;
  - the eave bead (the whole roof up or down).
- **The Hold zones on the surface stay active,** with the same meaning (P1), so dragging the roof surface does the same
  thing at both depths. Fine bending is in the sheet (§6.3).
- **See through** (X, or the sheet toggle): the shaping roof's top and underside render with a new
  `m.roofSee` (a clone of the roof material, `transparent`, `opacity 0.28`, `depthWrite false`) and stay pickable.
  Add `shaping` and `seeThrough` to the roof's build key in `stage.ts`.
- **Face the section** (sheet button):
  - call `store.pushView('face the section')` once per shaping session, before its first view change;
  - then `stage.ctl.glideTo(az, 1.18)`, with `az` perpendicular to the section plane on whichever side the camera
    already is, as Slice does at the end of its gesture.

  Esc after leaving Edit Shape returns to the earlier view.

### 6.3 The section sheet: `src/ui/SectionSheet.tsx`

`SectionSheet.tsx` replaces `ProfilePad.tsx`. `ProfilePresets` moves into it; delete `ProfilePad.tsx`. While shaping,
the inspector renders **`ShapeCard`** instead of `OverheadCard`, with the class `inspector shaping` (`width: 380px`).
380 px is the desktop target, bounded by the viewport. Fit the canvas to the available column and compute its hit
coordinates in CSS pixels; device-pixel ratio affects drawing resolution only. At 1280×800 the model, Done and
readout remain reachable without overlapping the creation controls.

**Layout, top to bottom:**
1. A head with the live family name and detail (`roofName` and `roofDetail` of the shown roof), with the roof's name
   small underneath.
2. A canvas, 352×232 CSS px.
3. A status line: the live readout (detent label, clean notes, or the measure).
4. A chip row, depending on context:
   - for a selected joint: *sharp · smooth · remove*;
   - after a freehand drawing: the readings (§6.5).
5. *Start from a shape* presets, using the existing logic.
6. A footer: *See through*, *Face the section*, *Done*.

**Scale and coordinates.** One uniform metres-to-pixels scale `k`, so slopes are true. This replaces the pad's
stretched heights.
- Horizontally, `x` runs over `[−0.15·span, 1.15·span]` in section metres (`x = u·span`).
- Vertically, `y` runs from `min(context floor y) − 0.3` to `eave + max(maxH, 2) + 1.0`, frozen during a drag as the
  pad's `frozenMax` is today.
- `k = min((352 − 24) / Δx, (232 − 24) / Δy)`, centred.

**Drawing order:**
1. A faint grid.
2. The context (§6.4), in pencil grey:
   - floors and decks as solid 1.5 px lines, ceilings dashed;
   - walls in thin ink from base to top;
   - neighbouring roofs faint;
   - people as 1.75 m figures in the existing scale-figure style;
   - headroom bands as red-pencil hatching with a label, e.g. "1.6 m headroom".
3. The eave line, dashed.
4. **The roof section** as a band `thick` deep, with an ink outline and card fill.
5. Joints as squares; step edges as short bars.
6. Selection and hover in blue.

**Hit testing** (CSS px): distinguish the step's two height bars from its slide grip first, then ordinary joints
(8 px), then parts (7 px from the curve), then paper. When projected targets overlap, expand their hit presentation
or provide the selected-joint controls; a generic joint target must not swallow both step edges.

**Gestures:**

| Press on | Drag does |
| --- | --- |
| Joint | `moveJoint`, with ⌥ = free and ⇧ = solo |
| Step edge | `moveStepEdge` |
| Part | `s` = the pointer's movement along the part's outward normal at the grab point, in metres; then `pullPart(..., { uGrab })` (a curve part bends) |
| Empty paper | A stroke over 8 CSS px begins a replacement section with a pencil trace of the old one; read on release (§6.5). A click deselects only. |

Other actions:
- **Double-click a joint:** sharp ↔ smooth (`setJointSharp`).
- **Double-click a part:** a small menu at the pointer with *Crease here* and *Step here (glazing)* (`splitPart`),
  each shown only when allowed.
- **⌥-click a joint**, or **Delete / Backspace** on the selected joint: `removeJoint`. The sheet stops these keys from
  reaching the roof, as the pad does today.
- **Esc in the sheet:** cancel the drag, otherwise deselect the joint, otherwise exit shaping.

**Every frame of a drag:**
- preview the valid `opOverhead(id, { profile })` from §4.4, or keep the last valid preview with its limit readout;
- on release, commit exactly that preview with labels such as "Moved {name}'s ridge", "Made {name} fuller here",
  "Added a step to {name}", "Removed a crease from {name}", "Drew a new section for {name}".

### 6.4 Context in the section: `src/model/sectionContext.ts` (pure)

```ts
export interface SectionContext {
  x0: number; x1: number;      // section metres
  lines: { kind: 'wall' | 'floor' | 'ceiling' | 'deck' | 'neighbour'; pts: [number, number][]; faint: boolean }[];
  people: { x: number; y: number }[];
  headroom: { x0: number; x1: number; y: number; clear: number }[];
}
export function sectionContext(p: Project, d: Derived, oh: Overhead): SectionContext;
```

**The section line.**
- Extrude roofs: the line through `f.center` along `f.d`, with `x = dot(pt, d) − f.wmin` over `[x0, x1]`. This is
  the same line `ohSection` uses.
- Revolve roofs: the line through the centre along `f.d`, with `x = s + R`.
- Intersect room, deck, hole and wall boundaries analytically, then sample curved heights within each interval
  (at most 0.05 m apart, including breakpoints). Sampling alone must not skip thin walls, void edges or short steps.

**What it collects:**
- **Rooms** (`d.rooms`): the stretches of samples inside `r.poly` (`pointInPolyHoles`), merged into intervals. Each
  interval gets a floor line at `r.floorY`, and a ceiling line at `r.topY` when `r.seed.ceiling === 'flat'`.
- **Decks:** the same, with lines at `dk.y` and `dk.y − dk.thick`.
- **Walls** (`d.walls`): where the section segment crosses the wall's centreline (`runGeom(w.run).ps.pts`), a
  vertical line from `w.run.baseY` to `wallTopAt(w, s)`.
- **Neighbours:** other overheads crossing the line, as their `ohTopAt` profile.
- **People:** one figure at the midpoint of each floor or deck interval of at least 1.2 m inside the roof outline.
- **Headroom:** use the lowest actual overhead obstruction: the room's flat ceiling if present, intervening deck
  underside, or the roof underside when open to it. Runs with `clear < 2.0` become bands, including zero/negative
  clearance as an intersection. Use these same clearance queries for placement offers (§9), so the sheet and the
  offer cannot disagree. These are prototype usability thresholds, consistent with README's simulated checks.
- Anything outside the roof outline (`!ohCovers(oh, midpoint)`) is `faint`.

### 6.5 Freehand sections, with readings

Releasing a drawing on empty paper commits `readings[0]` like this:

```ts
store.commit(label, opOverhead(id, { profile }), {
  readings: rs.map((r) => ({ id: r.id, label: r.label, detail: r.detail, op: opOverhead(id, { profile: r.profile }) })),
  readingIndex: 0,
});
```

The chip row then lists `store.top.readings` while the top step is this drawing. Clicking a chip calls
`store.amendReading(i)`. **Tab** cycles them while the sheet has focus. This is the same "read aloud, Tab for another
reading" behaviour as the pen.

### 6.6 Tests and checks

- **`tests/sectionContext.test.ts`:** a room 3 m tall under a gable gives two walls, a floor, a ceiling and a person.
  A deck at 2.4 m under a 2.6 m eave gives a headroom band where the slope is low. Rooms outside the outline are
  faint.
- **Model test:** a short-step closure is visible before release and commit matches it, including ids.
- **Browser** (§11.2): every entry and exit path works; Esc order is drag cancel → deselect sheet joint → exit
  shaping → view back (skip absent states); the
  building is never dimmed; clicking elsewhere exits without selecting.

---

## 7. Phase 4 — Ink from meaning

**Ink lines are the boundaries between regions that mean different things.** A "group" is a piece of roof surface
with one meaning: `(wing, surface, part)`.
- `surface` is `F` (the cross slope), `GA` or `GB` (a hipped end face).
- `part` is the section part index from `readSection`.

Boundaries between groups are ridges, hips, valleys, creases and steps. The union's outer boundary is the roof's
edge.

**Changes:**
1. **`buildOverhead`** gains `OverheadMesh.facets: { group: string; poly: MPoly; y: (p: V2) => number }[]` and
   `OverheadMesh.ink: number[]` (flat xyz pairs).
   - Every `top.flatM` call for the roof surface also pushes its pieces, group and height function. For hipped end
     rows (`layG`), the part index comes from the end slope's sample `t·hipU`.
   - **The geometry must not change:** `tests/hip.test.ts` has to pass unchanged.
2. **New `src/scene/build/roofInk.ts`:** `roofInk(oh, facets, foot, breaks): number[]`.
   - For each group, take `union(...pieces)` (from `clip.ts`) in plan to find candidate boundaries. Retain each
     source facet's polygon and height function; a curved group has **many** planes, not one height function. For each ring:
     - split its edges at the global break lines (the sample `w` positions, and the hip `v` positions when hipped)
       and every 0.5 m;
     - split again where the supporting source facet changes, then lift each fragment with that facet's height
       function, not a representative group plane or `ohH`. Preserve one-sided heights at steps so both bottom and
       top edges remain;
     - emit the segments and drop any shorter than 1 cm.
   - Deduplicate coincident 3D segments. Across wings, coplanar/tangent joins are not ink merely because the wing
     index changed; retain actual ridges, hips, valleys and authored sharp joints. A discontinuity in a supposedly
     continuous compound surface fails validation instead of acquiring a line that disguises it.
   - **Fascia:** the outline ring (and skylight holes) at `yT − thick`, plus vertical lines at ring vertices where the
     outline turns more than 20°.
3. **Revolve roofs** (in `buildRevolve`): rim rings at the top and bottom, a ring at each crease joint's radius
   `R(1 − 2u)`, the lantern's two rings and the oculus ring. No meridian lines.
4. **`stage.ts`:**
   - call `addSolid(part, mesh.top.geometry(), this.m.roof, { edges: false })`;
   - then, when not `live`, call a new **`addInk(part, pts)`**. It does what `addLines` does, plus the ghost twin
     (`this.m.ghostEdge`, `computeLineDistances`, hidden, `renderOrder: 3`, pushed to `part.ghosts`), copying the
     `addSolid` pattern;
   - glass keeps `EdgesGeometry` (plain quads);
   - selection recolouring already iterates `part.edges`.

**Tests: `tests/ink.test.ts`**, using `buildOverhead`:
- A gable on a rectangle: every ink segment is on the outline (within 1 cm), on the ridge line (`|w − wr| < 1e-6`),
  or a vertical corner line.
- A vault: **no segment has both ends more than 5 cm inside the outline.**
- A hipped gable: interior ink lies on the ridge or the hip lines, where the cross height equals the end height
  within 1e-5.
- A clerestory: interior ink lies at the step's `w`, at both heights.
- A dome: only rings.
- A curved group spanning several facets lifts every boundary to the actual surface. Coplanar wing joins have no
  seam, shared lines are emitted once, and holes remain outlined with no chords across them. Compare semantic ink
  and mesh during drag as well as after release; expensive final ink may be deferred while the active blue outline
  remains responsive, but the gesture must not reveal a different final shape.

---

## 8. Phase 5 — Roofs for L, T and U plans

### 8.1 Model: `src/model/wings.ts` (pure)

```ts
export interface Wing {
  rect: [number, number, number, number]; // [w0, w1, v0, v1] in the roof frame (d, e = perp(d))
  span: 'w' | 'v';                        // the short side is spanned; the ridge runs along the long side
  scale: number;                          // heights and hip scale by span / primary span (same pitch)
  ends: { lo: 'exposed' | 'joined'; hi: 'exposed' | 'joined' }; // along the ridge
}
export function roofWings(oh: Overhead): Wing[] | null; // convenience read; null is not fallback permission
```

Cache the result in a `WeakMap` keyed like `ohFrame`'s key, plus `oneSpan`.
Keep the qualification result alongside it (`single`, `compound`, or `unsupported` with a reason), so callers can
distinguish intended single-span coverage from a failed compound edit without rerunning or guessing at the cause.

**Returns `null` (no qualified compound candidate) when any of these hold:**
- `oh.oneSpan !== false`, or `form !== 'extrude'`;
- an outline edge is more than 2° off the `d` or `e` axes, or there are more than 16 vertices;
- the section lacks the qualified continuous single-crown topology (no steps; two monotone sides from zero eaves);
  gable and the journey's fuller slopes qualify first; saltbox, gambrel, vault and pointed-vault need their own fixtures;
- either eave height is above 0.05 m.

`null` is not permission to replace an existing compound roof with a one-span roof. The caller distinguishes
single-span intent, unsupported geometry and an invalid candidate. Reject or offer an explicitly previewed change
when an edit leaves the supported set. Small naming-tolerance changes never select a different coverage path.

**Algorithm:**
1. **Grid.** Project the outline into the frame. Take the unique `w` and `v` coordinates (merged within 0.05 m) as the
   grid lines. A cell is inside when its centre is in the outline.
2. **Maximal rectangles.** Enumerate every axis-aligned rectangle of inside cells that can't be extended in any
   direction. Brute force is fine at these sizes.
3. **Cover.** Sort them by area (largest first), with deterministic frame-coordinate ties, and take each one that covers a cell not yet covered, until every
   cell is covered. If that gives 1 rectangle, return `null` (one span). If it gives more than 4, return `null`.
4. **Thin wings.** If any rectangle's short side is under 1.2 m, return `null`.
5. **Primary and scale.** The primary wing is the largest by area. A wing whose sides are within 5% of each other
   takes its span axis from `oh.dir`. Each wing's `scale = wingSpan / primarySpan`.
6. **Joins, in rank order.** For each secondary wing S, let O be the higher-ranked wing it overlaps most.
   - **Perpendicular spans:** S's ridge runs into O. If O's ridge line (O's `span0 + pk.u·span`) crosses S's long
     extent strictly inside S, as in a plus-shaped plan, **split S in two at that line**. Otherwise **trim S's end
     inside O back to O's ridge line**. Either way, that end is `joined`.
   - **Parallel spans:** nothing is trimmed.
7. **Ends.** An end is `exposed` only when its full usable edge lies on the outer boundary within tolerance. Mixed
   exposed/joined edges require a split and revalidation, or are unsupported; a 50% vote can leave a cliff. Apply the
   four-piece budget after splitting as well. **Only exposed ends hip**, by `min(oh.hip · scale, wing half-length)`.

**Validate the decomposition.** Its union must equal the fitted footprint, without holes filled or gaps omitted.
At every trimmed/joined boundary, prove the selected height is continuous from both sides. A rectangle cover plus
`max` is not by itself that proof: unequal widths, parallel overlaps and a trimmed high wing can expose a vertical
drop. Area ranking must be deterministic under reversed/cycled outline vertices. Compare before/after evaluations
when a resize changes primary wing or decomposition; an abrupt jump becomes a rejected candidate with an explanation,
not a surprising automatic re-roof. Preserve the gesture-start decomposition while it stays valid.

**Phase 0 implementation notes (verified).** Each wing carries a `support` rectangle — its `rect` extended (or trimmed)
along its ridge to the ridge of the roof it runs into — and the surface is the upper envelope of every wing whose
*support* contains the point. The support therefore never ends where that wing is the higher roof, which is what makes
the envelope continuous across a trim; `rect` still decides which wing owns a cell for meshing and ink. The candidate
refuses these with a reason: an edge more than 2° off-axis, more than four rectangles, a section with steps or an
asymmetric one, and **a wing whose scaled peak stands above the roof it runs into** (that join has no continuous end).
The primary wing can legitimately flip between two fitted outlines of the same plan (0.45 m vs 0.90 m overhang on the
L) — both are continuous roofs, so §8.6's control must preview the change rather than assume a stable primary.
Phase 0 did not wire this into Hold, Settings or a live UI.

### 8.2 Heights

```ts
export function wingH(oh: Overhead, wg: Wing, q: V2): number; // section · scale, min with its hipped exposed ends
```

`ohH(oh, p)` becomes:
- with wings: the **max** of `wingH` over the wings whose rectangle contains `p` (0 if none);
- without wings: today's formula.

`ohUndersideAt`, `ohTopAt` and `ohRidge` must use the same evaluated surface as the mesher. `ohRidge` is the actual
maximum over all visible wings, not merely the primary profile's peak. Audit walls rising to the roof (`derive.ts`),
ceilings, posts, skylights, picking and `sectionContext`; each must consume that surface or have an explicit limitation.
`ohSection` and editing span use the primary wing, but name that frame separately from the whole outline frame to
avoid recursive `ohFrame` → `roofWings` → `ohSpan` evaluation. Derived geometry never enters saved authored data.

### 8.3 Mesher: `buildCompound(oh, wings, holes)`, in `overheads.ts`

`buildOverhead` dispatches to it when `roofWings(oh)` is not null. **The single-span path stays as it is.**

1. **Global breaks.**
   - `W`: every wing's `w` bounds; the sample positions of each wing spanning along `w`; the hip break positions of
     each wing whose ridge runs along `w`.
   - `V`: the same in `v`.
   - Merge within 1e-5.

   In each grid cell, every wing's cross slope and end slopes are then planar.
2. **Per cell.** The candidates are the wings whose rectangle contains the cell centre.
   - Each candidate gives pieces: its cross plane, clipped against each hipped end plane by sign, keeping the min.
     This generalises the existing `clipHalf`.
   - Combine the candidates by **upper envelope**. Partition the entire cell into non-overlapping regions and retain
     the greatest active plane in each. Preserve portions covered by only one candidate; pairwise intersections
     alone lose those portions. The final pieces must cover the cell's footprint exactly once.
3. **Output.** Each final piece goes through `piecesOf` (outline clipping), then `top.flatM`, `under.flatM` and
   `facets`, with group `${wingIndex}:${surface}:${part}` (§7).
4. **Fascia.** Split the outline rings at all `W` and `V` breaks, then skirt them using `yT = baseY + thick + ohH`.
5. **No glazing.** Wing families have no steps.

### 8.4 Hold zones with wings

- `roofZoneAt` finds the wings that contain `q`, and uses the one with the greatest `wingH` there (the visible one) in
  its own frame. That gives ridge, ridgeEnd (exposed ends only), endFace and slope zones per wing. Eave zones work as
  before.
- **All wings share one section,** so dragging any ridge changes the height of all of them, and the hip is shared.
  A drag on wing `i` maps its local displacement back through `scale_i` (e.g. `ΔprimaryH = ΔlocalH / scale_i`), so
  the grabbed surface follows the pointer. Limits are the intersection of valid ranges across all wings. Highlight
  every affected wing and say *"All wings · same pitch"*; a local highlight alone would promise a local edit.
- `zoneGeometry` draws the wing's own ridge and slope region, intersected with the area where that wing is the
  visible one. Use the mesher's visible ownership boundaries; a rectangle-only clip is not sufficient at valleys.

### 8.5 Edit Shape with wings

The sheet shows the primary wing's section, with the note *"Every wing follows this section."* The blue line locates
that section on the actual primary wing, not the whole outline's centroid. In compound regions distinguish the
authored section from the resulting roof cut where another wing dominates; headroom uses the resulting surface.

### 8.6 Settings

`Overhead.oneSpan?: boolean`, shown in Settings as *Cover the whole outline as one span*. Absent means legacy
single-span behaviour, preserving existing localStorage/JSON projects. Newly accepted grouped covers explicitly
set `false` only after qualification; sample authors opt in explicitly. List the control when a compound candidate
exists or the roof already uses one. Hover/focus previews the alternative and its effect on walls/headroom; click
commits one step. An invalid alternative is explained and cannot be committed as a routine clean result.

### 8.7 Covering neighbouring rooms together

Today, *Cover it* in `RoomCard` covers only the selected room (`opCoverRooms([s.id], preset)`). For an L-shaped
cottage, the default should be one roof over the whole group.

- **New helper in `derive.ts`: `coverGroup(d, roomId): string[]`.** Starting from the room, collect the rooms
  connected to it through shared walls that:
  - stand on the same level;
  - have no roof;
  - have a top within 0.3 m of the **starting room's** top (no cumulative height drift through a chain).

  Use the derived wall arrangement to establish an actual shared boundary segment of meaningful length (at least
  0.3 m). Expanded polygons are not adjacency: they also match corner touches, gaps and nearby disconnected rooms.
- **The chips.** When the group has more than one room, the preset chips cover the whole group, under the heading
  *"Cover {A} and {B}"* (or *"{A} and 2 more"*). One extra chip, *Only {A}*, keeps today's single-room cover.
- Hover/focus previews the full grouped roof and highlights its rooms. The action names the reach before acceptance;
  no existing roof is replaced. Alternate coverage can amend that same step through the existing readings mechanism.
- `opCoverRooms` already accepts several rooms, but its fallback `coverOutline` retains only the largest union
  polygon's outer ring. Qualify connected groups and preserve courtyards/holes or decline that group explicitly;
  never silently drop an island or cover a courtyard. Revalidate the **fitted** footprint after overhang and taller
  neighbour exclusions, not just the room-centre polygons.
- **Implemented:** `opCoverRooms(roomIds, preset, { wings: true })` sets `oneSpan: false` **at creation**, so a grouped
  cover is one accepted step — not "cover, then find and flip the Settings toggle" — and the section profile is
  scaled on the primary wing's span from the start rather than on the whole outline's. The opt-in is explicit: no
  saved roof with `oneSpan` absent changes behaviour.

### 8.8 Tests: `tests/wings.test.ts`

- **L** (10×6 m with a 4×8 m wing), **T**, **U** and **plus** plans give 2, 2, 3 and 3 wings respectively; the plus
  gives 3 because its cross wing is split at the primary ridge.
- **Every outline edge parallel to its wing's ridge has height 0 within 1 cm** along its length, which reverses
  today's measured 1.0–1.4 m. The inner corner is 0.
- **The projected top area equals the outline area** within 0.1 m², using the same method as `hip.test.ts`.
- **No cliffs:** test one-sided heights at every join, trim, ownership boundary and re-entrant corner, plus random
  interior probes. For straight qualified slopes also apply the 75° bound. A coarse 0.1 m grid alone can miss a seam;
  intentional smooth vault tangents are not subject to a universal 75° bound.
- **Valleys exist:** at the L's inner diagonal, both wings' heights are equal. `roofInk` has segments there, starting
  from the inner corner.
- **Joined ends never hip;** exposed ends hip.
- **Covering together:** `coverGroup` on an L of two 3 m rooms returns both. A neighbour 2 m taller isn't included,
  and neither is one that already has a roof. Covering the group gives one fitted roof with 2 wings.
- Rectangles, rounded plans, outlines off-axis by more than 2°, stepped plans with more than 4 rectangles, and
  clerestory sections all return `null`.
- Vary wing width, rotation, reversed/cycled outline order, near-square primary wings, overhang, hips and fullness.
  Assert no double-covered mesh area and mesh/evaluator agreement, not only total projected area. Reject disconnected
  coverage, corner-only room contact and a height-drifting chain. Covering a U must preserve its open court.
- Existing saved roofs load identically without an explicit coverage change; undo/redo and JSON round-trip preserve
  the choice. A failed compound edit leaves the last valid roof and its dependents unchanged.

---

## 9. Phase 6 — Pen tips and offers

### 9.1 Box and Round tips

- **State.** `UIState.penTip: 'sketch' | 'box' | 'round'`, default `'sketch'`, kept for the session.
- **Dock.** While Draw is active in Make, a small segmented control after Draw shows *Sketch · Box · Round* with
  icons. Tooltips: "Box: drag corner to corner (⇧ square)" and "Round: drag out from the centre". No new keys.
- **In `interact.ts`, a new `Stroke.shape`.** In `addStrokePoint`, when the tip isn't `'sketch'`, the purpose is
  `draw`, the stroke isn't on a wall, and `s.a0` is set:
  - **Box**:
    - The frame angle is the direction of the nearest straight wall segment within 4 m of `a0` on the same level,
      otherwise 0. Freeze it at pointer-down and show the alignment guide; do not switch frames while dragging.
    - The opposite corner is `snapPoint(pen, { anchors: [a0], ... }).p`, expressed in the frame.
    - Both sides are rounded to 0.05 m unless ⌥ is held; ⇧ makes a square. Sides under 0.6 m mean no shape yet.
    - The trail shows the rectangle; the readout uses the actual contextual reading (e.g. "Room · 4.20 × 3.60 m"
      on the floor, "Mezzanine" on a raised sheet), not a hard-coded Room label.
  - **Round**: the centre is `a0`; radius is distance to the pointer, rounded to 0.05 m unless ⌥ is held. Below 0.4 m
    there is no shape yet; a tiny drag must not create a minimum-size surprise. The readout names the contextual
    reading and diameter.
- **In `buildReadings`, when `s.shape` is set:**
  - build the `StrokeFit` directly:
    - box: `{ kind: 'closed', pts: the 4 corners counter-clockwise, bulge: [0, 0, 0, 0], closed: true, center:
      centroid, radius: 0, length: perimeter, curved: false, corners: 4 }`;
    - round: `{ kind: 'circle', pts: [], bulge: [], closed: true, center, radius, length: 2πr, curved: true,
      corners: 0 }`;
  - set `rawFit = fit` only after wall-face and floor-to-floor intent have been resolved. Preserve a genuine stair
    stroke; explicit closed-shape drawing then skips the later stair inference;
  - call `readStroke` as usual. On the ground that gives Room, Platform, Court and Canopy; on the sheet, Roof,
    Mezzanine, Lightwell and so on;
  - filter out the `'freehand'` reading, since it would be identical.
- **A box against an existing wall builds only the missing walls.** This is how you add a wing.
  - It applies when one box edge lies entirely within one straight segment of an existing wall on the same level
    (collinear within 5 cm).
  - The first reading becomes **"Room beside {room}"**: an open run of the other three sides, made with
    `opAddRunTouching(fit, { baseY }, touchA, touchB)` exactly as the open-stroke wall reading does. Its ends only
    touch the host wall, and the ripple offers Join.
  - For partial host overlap, either construct and validate only the missing spans or decline the adjoining-room
    reading with a clear preview. Do not silently add a doubled wall as the default. Show the host contact as a guide
    while drawing; the joining offer remains deliberate and does not follow merely from contact.
- **Wall faces and floor-to-floor strokes** ignore the tip (openings and stairs draw as before).

### 9.2 The Platform reading

In `readings.ts`, the `plinth` reading's label "Raised floor" becomes **"Platform"**, with the detail "a raised floor,
0.6 m up". "Round platform" is already named that way.

### 9.3 The mezzanine offer

- **Candidate generation, pure.** Consider strips at both ends along the room's major axes and the local roof wing's
  ridge, starting at depth `max(2.5, 0.35·L)`. Intersect with the room minus holes, voids and existing decks. Vary depth
  and height within a small deterministic candidate set. Do not assume a gable end has the most headroom: a hip
  slopes down there, and a full-width strip reaches the low eaves.
- **Qualification.** Query actual overhead clearance as in §6.4 over the **entire proposed footprint**, including
  roof breaks and corners. With the current 0.30 m deck, require `y − 0.30 − floorY ≥ 2.40 m` below and minimum
  clearance above the deck ≥ 2.10 m. Thus 4.80 m is an early rejection bound, not proof of feasibility at the peak.
  Retain one connected, useful area (initial heuristic: at least 2.0×2.5 m usable, no narrow necks), valid support
  under the prototype's rules, and at least one feasible stair approach (§9.4). Never create a void or move accepted
  architecture as an unmentioned placement side effect.
- **Choice.** Rank qualified candidates by usable area, clearance and an uncomplicated stair approach. Show at most
  three meaningfully different placements, with stable order. Equal candidates use a deterministic coordinate tie.
- **Where/how.** `RoomCard` offers **+ Add a mezzanine** only with a qualified candidate. Hover/focus previews it in
  pencil and reads both clearances, e.g. *"2.40 m below · at least 2.10 m above"*. Click commits and selects the deck.
  Alternate placements appear as readings of this same step (Tab or click). Each accepted deck remains an ordinary
  editable deck; choosing a suggestion does not install a hidden placement rule.
- **New op:** `opAddMezzanine(roomId, candidate)` revalidates against the current project, then uses `opAddDeck`.
  Candidate geometry and ordering are computed once per project revision; preview, click and reading amendments
  use the same candidates. With no valid candidate, the card explains why (e.g. *"Needs more headroom over a usable
  floor area"*) and points to drawing on the sheet. It does not offer a failing automatic action.

**Phase 0 implementation (verified in `src/model/offers.ts`, `tests/offers.test.ts`).** Pure and deterministic;
**not yet wired to `RoomCard` and `opAddMezzanine` does not exist.**

- Constants: `DECK_THICK 0.30`, `MIN_BELOW 2.40`, `MIN_ABOVE 2.10`, `MIN_AREA 5 m²`, `MIN_SIDE 2.0 m`,
  `MIN_NECK 1.2 m`. The deck top is `floorY + 2.70`, with one alternate height 0.30 m higher to show the
  clearance trade-off; both are rejected on clearance, not assumed feasible.
- Candidate set, two families, both clipped to the room minus holes, voids and slabs whose vertical span touches the
  usable volume (the largest connected piece is kept and simplified at 2 cm):
  1. **End strips.** The room's longest edge direction plus the covering roof's ridge direction (deduplicated), both
     ends of each axis, at depths `max(2.5, 0.35 L)` and up to `0.5 L`.
  2. **Clear floor, anywhere in the room.** A 0.25 m lattice in the room's axis frame, a cell clear when the overhead
     surface (or a flat ceiling, whichever is lower) leaves `MIN_ABOVE + 0.12 m`; maximal rectangles are extracted
     from the mask, the two largest per axis and height are kept, inset half a cell so their own boundary is clear,
     and each is offered whole and as bands 3.0/4.0/5.0/6.0 m long from either end. The bands exist because a loft
     spanning the whole clear length of a hipped roof has no approach at either end: a shorter band leaves room for
     its stair to run along the ridge, which is the only servable loft in the §11.3 cottage. Cells over a void or a
     slab crossing the deck's height are not clear, so a footprint with a hole is never produced; a cut that would
     leave one is refused instead of silently covering the void.
- Qualification samples the **fitted overhead surface** on a 0.30 m grid over the whole footprint plus the outline
  vertices: `below = deckTop − thick − floorY`, `above = min(roof underside or flat ceiling) − deckTop`. The usable
  area must be one connected region of at least 5 m², at least 2.0 m on its shorter side, containing a 1.2 m square
  (the no-neck heuristic), and must carry at least one qualified stair plan (§9.4).- Ranking: usable area, then clearance above, then the candidate id; at most three placements, and a candidate covering
  more than 70% of an already-chosen one is dropped as not meaningfully different.
- Measured outcome to keep as the baseline: 10×6 m room, 5.2 m flat roof → two end strips 5 × 6 m, 2.40 m below and
  2.50 m above, each with a 4.32 m stair; the same room at 3.0 m → no offer; 8×6 m gable with 3.2 m eaves → no offer
  even though the peak clears 4.80 m; an 8×6 m room open to the roof with a 3.0 m gable rise → a ridge-band loft with
  its stair, which the old end-strip grammar could not find. A void, an existing slab and a deck filling the room each
  remove or trim the offer. **Hipped headroom is now fixtured** by the §11.3 cottage, whose compound roof has an even
  hip and whose qualified candidate's clearances are measured over that hip. The §11.3 cottage at 3.0 m offers nothing
  because its flat ceiling is at the wall top (0.30 m over a 2.70 m deck, sampled); at 5.0 m it offers a mezzanine and
  its stair together. The wall-top arithmetic `2.40 + 0.30 + 2.10 = 4.80 m` is the honest caveat, and the journey's
  "taller room" is therefore required.

### 9.4 The stair offer

- **Where.** In `DeckCard`, including floors made by *Add a floor above*, when no stair connects it and a valid
  candidate exists. A full floor may need an opening; do not offer a stair through its slab without an explicitly
  previewed opening. Automatic opening creation is outside this round.
- **Candidates.** Test free edge segments with enough width, at their midpoint and a bounded set of alternate
  positions/directions. Resolve `floorUnder` at each proposed **lower endpoint**, not an undefined deck centre;
  ground fallback alone does not prove a usable landing. Start with `L = rise · 1.6`, using the actual stair width.
- **Qualification.** Test the swept stair footprint and walking/headroom envelope, not only the path centreline:
  continuous support at the lower landing, contact with a usable deck edge at the upper landing, clear approach
  areas, no wall/slab/roof intersection, no crossing a void, and the existing prototype slope/fit checks. The final
  path rises to the edge; an offset parallel path that never reaches it is not a fallback.
- **How.** **+ Add a stair** previews the best candidate on hover/focus. Click commits and selects it. Up to three
  qualified alternatives can amend the same step. `opAddStairTo(deckId, candidate)` revalidates and calls
  `opAddStair(path, below.ref, { kind: 'deck', id }, below.y, deck.y)`.
- **No candidate.** Say *"No clear stair approach here"* and point to the existing floor-to-floor drawing gesture.
  Never place the first option anyway. These checks are prototype fit heuristics, not construction-code claims.

**Phase 0 implementation (verified).** `stairPlansFor(project, outline, deckY, floorY)` and
`stairCandidates(project, deckId)` in `src/model/offers.ts`; `opAddStairTo` does not exist yet.

- Free outline edges at least `STAIR_WIDTH + 0.8` (2.1 m) long, at the midpoint and at 28%/72%, on the outward normal.
- A straight run `L = max(1.2, rise · 1.6)` whose top tread sits 0.35 m onto the deck, so the run **reaches the edge**;
  width 1.3 m. The lower end must lie in a room whose floor is the stair's `fromY` — ground fallback alone is refused.
- Rejected when the 1.3 m swept footprint leaves that room, crosses a wall (except within 0.45 m of the deck edge),
  crosses a void, intersects another slab between the floors, climbs through the slab it serves, or finds less than
  2.0 m of headroom under a roof along the run.
- Stable order: edge index, then position; at most three plans. Measured baseline: a 2.7 m deck in a 10×6 room gives
  three 4.32 m plans from the free edge; adding walls across the remaining floor removes them all.

**The shared offer grammar:** pencil preview → one accepted edit → optional alternate reading → one Undo. Reuse the
existing ripple/readings UI rather than adding a wizard. Hover/focus leaving cancels only its own preview; Esc
cancels it without accepting. Keep alternatives few and visibly different, with no speculative auto-placement.

### 9.5 Tests

- In `tests/model.test.ts`:
  - a box `StrokeFit` reads Room first, with Platform among its readings;
  - a box with one edge inside an existing wall reads *Room beside …* first, adds a three-sided open run whose ends
    touch that wall (no tie), and `derive` finds two rooms with no doubled wall;
  - mezzanine candidates satisfy minimum clearance above and below over their entire usable area, including slab
    thickness; a tall narrow peak, hipped end, flat ceiling, room hole and intervening deck cannot produce a false offer;
  - stair candidates reach the deck with their full width and clear approaches; reject wall collisions, voids, missing
    lower support, blocked headroom and full slabs with no opening;
  - failed offers are non-mutating; preview equals commit; alternative placement amends one step and Undo restores
    the complete pre-offer project. Modifier-free creation and manual drawing remain available.

---

## 10. Phase 7 (optional) — Pushing and pulling a room's sides

When a **room** is selected in Select, its card's floor and ceiling beads stay, and **side zones** are added. These
apply to each room polygon edge that maps onto a single straight segment of a single run: collinear within 2 cm,
overlapping at least 95%, with neither moved node a tied end.

- **Hover:** highlight that wall's face inside the room, at mid-height.
- **Drag:** along the room's outward normal, 5 cm steps, snapped with `snapPoint` on the segment midpoint.
- **New op: `opMoveSegment(runId, seg, delta: V2)`:** moves `pts[seg]` and `pts[seg + 1]` (wrapping for closed
  runs), keeping `bulge`. Settle handles ties to that run; fitted roofs follow.
- **Readout:** "+1.20 m · Studio 6.2 × 4.0 m", plus the other room's new size when this is a dividing wall.
- **Cut rule:** if this needs tie or touch semantics changed to stay correct, skip the phase and add it to DESIGN.md
  "next".

---

## 11. Verification

Record completed evidence separately from planned checks. A passing model test does not establish gesture
discoverability, and a screenshot does not establish geometric continuity. No implementation or human acceptance
has been completed merely by approving this plan.

### 11.1 Every phase

- `npm run typecheck`, `npm test` and `npm run build` pass.
- New suites:
  - `section.test.ts`, `zones.test.ts`, `sectionContext.test.ts`, `ink.test.ts`, `wings.test.ts`, `offers.test.ts`,
    `journey.test.ts`;
  - additions to `model.test.ts`. (Present today: `section`, `zones`, `wings`, `offers` and `journey`; the other two
    belong to phases not yet built.)
- Existing suites (`hip`, `sculpt`, `profile`, `samples`, `storey` and others) keep passing. Update them only where
  this plan deliberately changes behaviour: removing `allHandles`, removing the Select surface bend, and
  `describeProfile` now returning `roofName`.
- New coverage choice and old projects survive autosave/load and JSON round-trip; generated wings/zones, preview,
  Shape mode and view state are absent from authored exports. Existing sample geometry changes only by explicit
  sample edits. Run the repository documentation gate after README/DESIGN/help-reference changes.

### 11.2 Browser

Use the `vellum` launch config (port 5191) and the dev handles `window.__vellum`, `window.__app` and `window.__t`.
Follow the repository's browser-hygiene skill when launching or attaching. Use the launch config if present, otherwise
this prototype's `npm run dev`; record browser, viewport and hardware for responsiveness evidence.
**Add these testkit helpers to `src/dev/testkit.ts`:**
- `__t.zoneAt(x, y)` returns the zone under a screen point;
- `__t.dragZone(roofId, kind, dx, dy)` sends real pointer events from the zone's screen position;
- `__t.shaping()` returns `ui.shaping`.

Check:
- **Hold:**
  - a selected gable shows no dots until hovered;
  - ridge, ends, slopes and eaves highlight correctly;
  - each drag is one undo step;
  - applicable detents stop at 45°, an even hip, ends meeting and a truly straight slope;
  - ⌥ turns them off;
  - R turns the ridge.
- **Edit Shape:**
  - each entry path works (double-click, Enter, the menu, the button, the thumbnail);
  - the building isn't dimmed;
  - other elements don't hover;
  - clicking elsewhere exits without selecting;
  - Esc order is drag → selected sheet joint → shaping → view, skipping absent states;
  - joint and part gestures update the 3D roof live;
  - a freehand drawing gives readings, and Tab amends the same step;
  - See through and Face the section work, and Esc then returns the view.
- **Ink:** on a vault, no lines cross the curved surface; a hipped gable shows its ridge, hips and edges only.
  Screenshots before and after.
- **Wings:** cover an L-shaped pair of rooms. It shows valleys, eaves at 0 and walls meeting the roof. Turning on *as
  one span* previews the legacy geometry; commit only when qualified (§8.6). A cliff-producing fallback is visibly
  unavailable, not a successful clean edit.
- **Tips and offers:** Box and Round give a Room, and Tab offers Platform; a mezzanine, then a stair; the ripple card
  reads sensibly.
- **Recovery:** cancel each gesture by Esc and pointer cancellation; click/double-click and return-to-origin drags
  produce no history; undo/redo returns the full pre/post state. Switching Make/Tell/Visit clears edit previews and
  controls without changing geometry. A cancelled hover offer cannot leak into the next action.
- **Everyday use:** repeat at 1280×800, 100% and 125% browser zoom, and high device-pixel ratio. Check text-field key
  isolation, keyboard focus and trackpad orbit over a selected roof. Measure input-to-preview latency during the
  cottage journey on recorded hardware (target p95 ≤ 50 ms, no stalls over 100 ms); reduce derived work if the
  building trails the hand. Human discovery is tested below, without `__t` identifying the target for the person.

### 11.3 Acceptance script

Through `__t`, using pointer events, not direct store calls:
1. Box a 10×6 m room. Box a 4×8 m wing against one of its long walls; it reads as *Room beside Room 1*.
2. On the first room: *Cover Room 1 and Room 2* → Gable. The result is one roof with two wings.
3. Raise the ridge to the 45° stop to make usable loft space. Drag a ridge end to an even hip; drag a slope 0.3 m
   fuller; drag an eave to 0.6 m of overhang. The readouts/highlights reveal that ends, slopes, wings and fitted
   edges are linked.
4. Set the room's wall top to 5.0 m — the mezzanine step needs `2.40 + 0.30 + 2.10 = 4.80 m` at the eave — then
   *Opens up to the roof* (the flat ceiling at the wall top otherwise leaves 0.30 m over the deck; at the exact 3.0 m
   of step 1 the qualified result is **no offer**, and the card must say why), then *+ Add a mezzanine*, then
   *+ Add a stair* on the new mezzanine. Phase 0's model evidence for this geometry is in `tests/journey.test.ts`;
   the card and stair offer still have to be wired.

Pass conditions:
- each accepted model edit is one undo step; selection, inspection, hover, cancellation and no-ops add none;
- `derive` reports no clash or floating issues;
- `wings.test`-style probes on the live roof pass (eaves at 0, no cliffs);
- resizing a wall with a compound roof keeps the last valid roof and **says why** when the change would alter the
  massing; a silent primary-wing jump is a failure, not a valid preview (§3.1);
- screenshots are attached.

**Revision/recovery script.** Without entering Shape, change the roof height again and inspect its effect on the
mezzanine, then undo. A previously accepted deck is not relocated or deleted to keep the new roof convenient; any
reduced clearance is shown as a consequence. Cancel a second edit halfway. Try another offered stair placement
within its creation step, undo it, redo it, and reload/export/import. All unaffected work and explicit relationships
remain intact. Also revise a vault, a clerestory and a free canopy so the round does not improve only cottages.

**Human success test.** Ask five first-time non-professionals to make and revise the cottage using the goal, not the
numbered instructions or hidden testkit targets. Initial target: at least four complete the creation in five minutes
without coaching or Edit Shape; all can undo a revision and explain which parts a shared gesture changed. Record
time to first room and usable roof, pauses for discovery, unwanted edits, Help/Settings visits, recovery attempts and
total gestures. If the target is missed, improve the observed friction before adding optional Phase 7. Until these
sessions occur, report "automated journey passed; human effortless-creation acceptance pending" when appropriate.

---

## 12. Docs and in-app help, updated in the same round

- **`README.md` gesture table:**
  - the Roof row becomes the Hold zones, Edit Shape (how to enter and leave), Turn the ridge (R) and *as one span*;
  - the Roof profile pad row becomes the section sheet (joints, parts, menu, readings, See through, Face);
  - a new pen tips row;
  - the offers go into the Add-floor row's neighbourhood;
  - remove *Show every point*.
- **`README.md` "What's real":** add parts and joints, clean rules, roofs for L/T/U plans, ink from meaning, Box and
  Round, and the offers.
- **`DESIGN.md`:**
  - in §3 *Draw the shape you mean*, rewrite roofs around the three depths, one kind of roof, clean by construction,
    context not isolation, and ink from meaning;
  - add pen tips (a box is still read aloud);
  - Rough edges: publish the actually qualified wing families/outlines; Edit Shape edits the primary wing's section;
    auto-offers use prototype fit heuristics and may explain that no candidate fits;
  - Next: room-level push and pull if Phase 7 was cut; lifting rooms on stilts; whole-building moves across storeys.
- **`src/ui/Panels.tsx` Help:**
  - "Things to try" gains *Sculpt a roof by holding it*, *Edit a roof's shape in context*, *Box a room*, and *Add a
    mezzanine and a stair*;
  - update the keys list (R, Enter, X).

---

## 13. Not in this round

- Whole-building height or extension across storeys and split levels. This needs real levels and belongs to
  production.
- Lifting rooms on stilts. Posts as pencil suggestions already exist for canopies.
- Free roof rotation; roofs for plans that aren't right-angled (straight skeleton); dormers; merging roofs over rooms
  that were covered separately.
- Separate Platform or Stairs tools (they are readings and offers).
- Click-to-drill-down selection (room first, then wall). Considered, and deferred as too disruptive for this round.
- Touch gestures, numeric entry, multi-select.

---

## 14. Defaults chosen, so the work isn't blocked

| # | Decision | Default |
| --- | --- | --- |
| D1 | How to enter Edit Shape | Double-click (roofs only; other elements keep isolate), Enter, the right-click menu, the card button and the thumbnail. |
| D2 | A selected roof in Hold | Shows no dots; hover reveals zones. The eave bead remains only on free canopies. |
| D3 | Fullness | `pullShoulder` (sideways, mirrored) in Hold; `pullPart` (bow along the normal) in Edit Shape. |
| D4 | Roofs for L/T/U plans | New grouped covers use wings when qualified; an explicit, valid *Cover the whole outline as one span* choice opts out. Existing saves retain their coverage. |
| D5 | Clicking elsewhere during Edit Shape | Exits only; it never selects. |
| D6 | Pitch detents | 30°, 45° and 60°. |
| D7 | Mezzanine offer threshold | 4.8 m is only an early height screen; the actual footprint, slab, headroom and stair approach must fit (§9.3). |
| D8 | Pen tip keys | None. |
| D9 | Where the section sheet lives | In the inspector column (380 px) while shaping, so the 3D view stays clear. |
| D10 | Existing saved roofs | Preserve their coverage; only new qualified grouped covers and deliberately updated samples opt into wings. |
| D11 | Automatic placement | At most three qualified pencil suggestions, editable through readings in one step; no knowingly broken fallback. |
| D12 | Scope of acceptance | L/T/U coverage and the cottage journey are required; room push/pull is optional. Missing required evidence is reported as partial completion. |

The inspector location and 30°/45°/60° stops are deliberate starting choices to test during the human journeys.
Revisit them when observed friction warrants it. No unresolved owner preference blocks the plan's feasibility work;
implementation and human acceptance remain future work.
