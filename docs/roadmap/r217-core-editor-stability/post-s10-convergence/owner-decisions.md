# Post-S10 convergence — owner decisions

**These are the only choices that need you.** Everything else in the [target specification](./target-specification.md) follows from evidence or an existing contract. Each decision has a recommendation, so saying "accept all" gives a complete, buildable plan. Nothing here is released until you rule and register the slices.

Decisions marked **amends a contract** change ratified text. If accepted, the implementing slice updates that text at cutover, not before.

## Summary

| # | Decision | Recommendation | Blocks |
| --- | --- | --- | --- |
| O1 | Selection strength | Mat .28, Paper .22 with dark gold edge | C10 calibration only |
| O2 | What dragging a Wall body does | Slide along the Wall's normal; neighbours stretch | C07a |
| O3 | Plan orientation change | Accept it | C08 |
| O4 | 3D ground reach and line budget | Accept the specified values | C09a |
| O5 | Permanent home for Head utilities | Stage settings control and the project name | C01 final placement |
| O6 | What a Wall's end point does | Moves the Junction; the ray keeps length | C07a |
| O7 | Fixed grid and snap values | 1 m grid, 5 m major, 0.5 m snap, drawing only thins | C09b |
| O8 | Scale control | Remove from the toolbar; add zoom and Fit controls | C09b |
| O9 | Dragging something not yet selected | Select first, except a hovered Junction with a mouse | C07b, C06 |

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

**Amends a contract only by reading:** `T1.viewport-projection@1` does not fix a Plan screen-up, so no new gate version is needed. You confirm that reading.

- **Recommendation:** accept. At azimuth 0, Plan becomes right +X, up −Z, the only orientation continuous with 3D.
- **Alternative:** keep today's Plan orientation and rotate 3D's convention instead. That moves every 3D default view, which is more disruptive.

## O4 — 3D ground limits

- **Recommendation:** reach `max(24 × extent, 64 × eyeHeight)`, at most 6,000 lines, and a horizon band up to about 12 px, per the [specification](./target-specification.md#3d-ground-clipping).
- **Alternative:** a fade to the mat near the horizon. It looks softer but needs per-vertex alpha and is more code. It stays available if the band reads badly in C09a's browser check.

## O5 — Utility home

- **Recommendation:** viewing preferences in the Stage's existing settings control; project lifecycle and source under the project name. Find gives every one of them an interim route, so visual work does not wait.
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

**Why 1 m and 0.5 m:** they are the wireframe's values and PLATE's reference scale. Half of all snap points therefore land between lines; the snap mark shows the landing, so this should read fine, and C09b checks it.

**Precision is preserved:** typed values, Alt to free the pointer, and semantic snap targets are unaffected. Interval state stays internal, ready for a preference later, with no toolbar control.

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

- **Opening selection in Plan:** always selecting the Wall contradicts the architecture contract's rank order. It is a defect.
- **Wall and Opening marks ignoring Snap:** a defect.
- **Ruler in Plan only:** a scale bar is true only at the target plane in perspective, and the wireframe also draws it in Plan only.
- **Paper grid extent:** follow the wireframe's model-local sheet.
- **Primitive click placement:** the instrument offers typed X/Z only; click placement already exists for models.
- **Card during a gesture:** it must not cover what is being edited.
- **Junction onto Junction:** stays a refusal, because the planner rejects it and no merge operation exists. Adding one is new topology work and is outside this plan.

## Contract conflicts

| Contract | Says | Desired | Resolution |
| --- | --- | --- | --- |
| Grammar, Wall row | End points edit length | Junction editing | O6 |
| PLATE, drafting state | Scale · Grid · Snap | Grid and Snap only | O8 |
| PLATE, grid and S05 | Interval ladder; Snap follows it | Fixed values | O7 |
| S07 | 0.18 tint, bright Paper gold | Stronger selection | O1 |
| S07 | No angle ring; no height or thickness grips | Unchanged | Kept. Not reopened |
| Grammar, mark table | Red dashes mean erase only | A refused preview | Kept. Refusal uses neutral dashes and a tag, never red |
| `plan-pick-provider.ts` "locked Wall → Opening order" | Wall wins in Select | Opening selectable | Defect against `architecture.md` Plan ranks |
| PLATE, drafting state | Configuration reachable from the words | No interval selector | Reached from preferences, per O7 and O5 |
