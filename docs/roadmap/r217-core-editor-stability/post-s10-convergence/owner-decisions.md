# Post-S10 convergence — owner decisions

**All nine accepted by the owner on 2026-10-30, as recommended.** Everything else in the [target specification](./target-specification.md) follows from evidence or an existing contract. The alternatives and tradeoffs stay here as the record of what was decided against. The owner then directed registration as R217.S12–S25, and proposed one [campaign authorization](../../../reference/decisions/r217-convergence-campaign-2026-10-30.md) for the batch, which takes effect when PR #230 merges.

Decisions marked **amends a contract** change ratified text. The implementing slice updates that text at cutover, not before; until then the landed contract still describes current behaviour.

## Summary

| # | Decision | Ruling | Governs |
| --- | --- | --- | --- |
| O1 | Selection strength | Mat .28, Paper .22 with dark gold edge | S18 calibration only |
| O2 | What dragging a Wall body does | Slide along the Wall's normal; neighbours stretch | S15 |
| O3 | Plan orientation change | Right +X, up −Z at azimuth 0 | S12 |
| O4 | 3D ground reach and line budget | The specified reach, budget and horizon band | S19 |
| O5 | Permanent home for Head utilities | Stage settings control and the project name | S20 final placement |
| O6 | What a Wall's end point does | Moves the Junction; the ray keeps length | S15 |
| O7 | Fixed grid and snap values | 1 m grid, 5 m major, 0.5 m snap, drawing only thins | S13 |
| O8 | Scale control | Remove from the toolbar; add zoom and Fit controls | S13 |
| O9 | Dragging something not yet selected | Select first, except a hovered Junction with a mouse | S16, S17 |

## O1 — Selection strength

**Amends a contract:** S07 accepted a 0.18 tint and bright Paper gold.

- **Recommendation:** tint .28 on the mat; tint .22 on Paper with a dark gold `#74560c` edge, the wireframe's own values.
- **Alternative:** keep .18 and bright gold. Least change, but selected geometry stays faint, which is what you noticed.
- **Tradeoff:** a stronger tint hides more underlying drawing. The Scene Paper fill is a defect and ships either way.

## O2 — Dragging a Wall body

**Why it needs you:** this sets how Walls feel, and the old editor did something different.

| Option | Behaviour | For | Against |
| --- | --- | --- | --- |
| **A, recommended** | Slides along the Wall's normal; neighbours stretch | Rooms stay square; matches the ratified "move parallel" grip and common floor-planning tools; no modifier, so touch is equal | Moving a Wall along its own direction needs its Junctions or the Card |
| B | Free X/Z, as pre-prune | Restores the old behaviour exactly | One small sideways wobble skews both neighbours. Snap reduces this but does not remove it |
| C | Free by default, Shift locks to the normal | Both available | Shift-drag already orbits in 3D, and touch has no Shift |

`planRigidWallMove` accepts any delta, so this choice changes only how a pointer becomes a delta. It is cheap to reverse after you have used it.

## O3 — Plan orientation

**Amends a contract only by reading:** `T1.viewport-projection@1` does not fix a Plan screen-up, so no new gate version is needed. The owner confirmed that reading.

- **Recommendation:** accept. At azimuth 0, Plan becomes right +X, up −Z, the only orientation continuous with 3D.
- **Alternative:** keep today's Plan orientation and rotate 3D's convention instead. That moves every 3D default view, which is more disruptive.

## O4 — 3D ground limits

- **Recommendation:** reach `max(24 × extent, 64 × eyeHeight)`, at most 6,000 lines, and a horizon band up to about 12 px, per the [specification](./target-specification.md#3d-ground-clipping).
- **Alternative:** a fade to the mat near the horizon. It looks softer but needs per-vertex alpha and is more code. It stays available if the band reads badly in S19's browser check.

## O5 — Utility home

- **Recommendation:** viewing preferences in the Stage's existing settings control; project lifecycle and source under the project name. Find also reaches every one of them. That control holds only interval and snap settings today, so S13 removes it with them and S20 returns it holding viewing preferences only.
- **Alternative:** keep an app menu beside the Index toggle. It is familiar, but it is the second menu button you asked to replace.

## O6 — A Wall's end point

**Amends a contract:** the grammar says "End points (length)", and S07 implemented that. Your ask for direct Junction editing conflicts with it directly, so this cannot be resolved by a plan alone.

**Pushback on my own earlier proposal:** I recommended a Card action that arms a Junction mark. You were right to doubt it. It takes three steps to do the most common Wall edit and hides it in a panel. I withdraw it.

| Option | Behaviour | For | Against |
| --- | --- | --- | --- |
| **A, recommended** | Point moves the Junction freely; every incident Wall follows. The ray at the free end keeps length-only | Direct and discoverable; restores the pre-prune meaning; length stays one drag away, with typed entry at the gesture | Amends the ratified table; an end drag can now change angle |
| B | Point stays length; a separate square Junction mark beside it | No contract change | Two marks 30 px apart with subtly different meanings, on a 10 px Wall |
| C | Point stays length; a modifier makes it a Junction | No new mark | No touch path, and it hides the most useful behaviour |

Today's end point already moves the shared Junction, but only along the Wall's line. Option A removes that constraint rather than adding a new concept.

## O7 — Fixed grid and snap

**Amends a contract:** PLATE specifies a `1, 2, 5 × 10^n` ladder, and S05 made Snap follow it.

**Your instinct is right, and the evidence is stronger than you described.** Snap currently changes with zoom: the live editor reported 0.1 m at 1:21, 0.5 m at 1:71 and 2 m at 1:350. Zooming silently changes where the next point lands, which is a functional defect regardless of appearance.

**One pushback:** a strictly fixed drawing cannot work at every zoom. Zoomed out, 1 m lines fall below a pixel and become a solid tint. So I separate meaning from drawing:

| Option | Snap | Drawing | Verdict |
| --- | --- | --- | --- |
| **A, recommended** | Fixed 0.5 m | Fixed 1 m and 5 m lines; each simply hides when too dense; a 25 m line appears only when 5 m hides | Nothing ever changes value; the drawing only thins |
| B | Fixed | Fixed, never thinned | Rejected: solid tint when zoomed out |
| C | Fixed 0.5 m | Current ladder | Snap is fixed, but the grid still switches, which you asked to remove |
| D | Current, follows zoom | Current ladder | Rejected: the defect above |

**Why 1 m and 0.5 m:** they are the wireframe's values and PLATE's reference scale. Half of all snap points therefore land between lines; the snap mark shows the landing, so this should read fine, and S13 checks it.

**Precision is preserved:** typed values, Alt to free the pointer, and semantic snap targets are unaffected. The values stay named constants, so a later preference has one seam to extend, with no toolbar control.

## O8 — Scale control

**Amends a contract:** PLATE says "Scale · Grid · Snap remain legible", and Scale is where **Fit all** lives today.

- **Recommendation:** remove the Scale word and interval menu from the toolbar, as you asked. The ruler becomes the scale reading. Add the wireframe's lower-right zoom in, zoom out and Fit controls, because removing Scale would otherwise remove the only Fit button. Scale detents move to Find, so the capability remains.
- **Alternative:** keep a quiet Scale word for people who draw to a ratio. It serves architects printing to scale, but Biskiq has no print output today.

## O9 — Dragging before selecting

- **Recommendation:** a drag on unselected geometry pans; click selects, then drag edits. The one exception: with a mouse, hovering near any Junction reveals its point, and that point can be dragged straight away.
- **Why:** on the Stage a one-finger drag is navigation. If unselected geometry were draggable, any pan that started on a Wall in a dense plan would edit it. A small undo cost per accident is still a loss of trust.
- **Alternative:** drag moves unselected subjects directly with a mouse. It is one click faster for experienced users and is how many drawing tools behave. It raises accident risk and makes mouse and touch differ. The hit table can adopt it later without other changes.

## Resolved without a decision

The evidence is sufficient for these, so they are simply in the plan:

- **Opening selection in Plan:** always selecting the Wall contradicts the architecture contract's rank order, and the older P23.11 priority also put Openings above Wall bodies. It is a defect. **Correction, 2026-10-30:** when this was accepted, this record implied only code comments call the Wall-first order locked. The [R217 README](../README.md#shared-stage-interaction-coordination-over-domain-policy) also gives "locked Wall → Opening priority" as an example, so S16 updates that sentence too.
- **Wall and Opening marks ignoring Snap:** a defect.
- **Ruler in Plan only:** a scale bar is true only at the target plane in perspective, and the wireframe also draws it in Plan only.
- **Paper grid extent:** follow the wireframe's model-local sheet.
- **Primitive click placement:** the instrument offers typed X/Z only; click placement already exists for models.
- **Card during a gesture:** it must not cover what is being edited.
- **Junction onto Junction:** stays a refusal, because the planner rejects it and no merge operation exists. Adding one is new topology work and is outside this plan.

## Deferred: door swing

**Proposal, accepted by merging PR #230:** defer door swing from this campaign and from S16. I'd earlier listed it as a small closing item, which was wrong.

- **Evidence:** `LayoutWallOpening` has `kind: 'door' | 'window'`, with no hinge side or swing direction. The Plan representation carries only `centerPolyline`, and S04 recorded that an arc waits until the representation carries one.
- **Why not derive it:** the wireframe picks a hinge end and side with no data behind them. Doing the same in production would draw a fact nobody authored, and it could flip after an edit.
- **What it would take:** new Layout fields, a format change, representation output and Paper drawing, which is a new capability.
- **Until then:** doors keep today's straight symbol. The carry stays on the T1 baton.

## Tightening notes

The final pass settled these within the accepted rulings, each narrowing what was specified:

- **Junction hover is Plan-only (O9).** In 3D, a Junction behind a Wall would need a new occlusion policy.
- **Layout has no 3D candidate mesh.** Its 3D preview is the candidate's footprint at the datum, not the full Wall mesh, because a mesh would be a new rendering path. Scene and form ghosts stay meshes. The owner judges whether this is sufficient at the checkpoint after S15.
- **No new snap geometry.** Parallel-Wall alignment is removed, and `extension-guide` stays unused because it has no candidates. A Wall body snaps by distance.
- **S12 and S19 move to T1 ownership**, per the architecture contract.

- **O10 (2026-10-31, S17A). Pen draws architecture; Objects creates objects.** The dock's Library key becomes **Objects**, the single place to create, find and insert objects: Box, Round, Free and Sphere, verified models, My Objects and Import. A click places a standard shape and a drag draws its size, with one object type and one edit behaviour. Shape leaves Ink. This amends wireframe R9 ("one Pen, no Object Pen").
- **O11 (2026-10-31, S17A). Objects do not need a Room.** Where no compiled Room floor covers a point, the Layout's explicit horizontal datum supports it, including in a genuinely empty project. A Room floor still decides elevation where it covers. An operation that must keep another resting elevation refuses rather than moving vertically. This reverses D38 and the T2.P01 rule that a datum is not support.

## Contract conflicts

| Contract | Says | Desired | Resolution |
| --- | --- | --- | --- |
| Grammar, Wall row | End points edit length | Junction editing | O6 |
| PLATE, drafting state | Scale · Grid · Snap | Grid and Snap only | O8 |
| PLATE, grid and S05 | Interval ladder; Snap follows it | Fixed values | O7 |
| S07 | 0.18 tint, bright Paper gold | Stronger selection | O1 |
| S07 | No angle ring; no height or thickness grips | Unchanged | Kept. Not reopened |
| Grammar, mark table | Red dashes mean erase only | A refused preview | Kept. Refusal uses neutral dashes and a tag, never red |
| R217 README and `plan-pick-provider.ts`, "locked Wall → Opening" | Wall wins in Select | Opening selectable | Defect against `architecture.md` Plan ranks. S16 updates all three |
| PLATE, drafting state | Configuration reachable from the words | No interval selector | Reached from preferences, per O7 and O5 |
