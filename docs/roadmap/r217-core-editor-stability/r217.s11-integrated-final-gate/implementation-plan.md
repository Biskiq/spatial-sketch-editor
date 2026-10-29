# R217.S11 — Integrated final gate: implementation plan

**Slice:** R217.S11 · **Status:** approved (plan); not released · **Phase:** [R217](../README.md) ·
[slice register](../README.md#slice-register) · **Writer:** T1 · **Reviewers:** T2, T3, T5 and an
independent reviewer · **Runbook:** [T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: exhaustive
```

This is R217's declared **FINAL PHASE GATE** and the integration route for S01–S10. It adds no
feature. Fixes are allowed only for defects the gate itself finds, each recorded with its owner's
review.

## Prerequisite

R217.S01–S10 are accepted with routine closeout, and every consumed gate and required scope is
rechecked at this slice's trusted base.

## Evidence

On one integrated tree at a recorded revision:

1. **Merge gate:** the complete merge gate in the [test contract](../../../../apps/editor/tests/README.md#what-a-change-requires), including `test:heavy`, the arch lane, checks and builds, and DB-backed `test:api` with zero skips.
2. **Journeys:** every journey below, in two browsers per the agent E2E contract, with screenshots kept as the acceptance artifacts:
   - with a fine pointer at 1440 × 900 and 1280 × 800;
   - under coarse-pointer and touch emulation (`hasTouch`, `pointer: coarse`, `hover: none`) at 1024 × 768 and 768 × 1024.

   A real-iPad pass is recorded as an owner-run observation when available. It is not a
   prerequisite.
3. **Isolation:** visitor, public and preview boundaries are green, and no new module is in a `/p` chunk.
4. **Seams:** the S06 Height Sheet consumer seam and the S07 descriptor admission are reviewed.
5. **Review:** an independent review of the integrated diff since the phase base.

Performance is not measured: the mandate is
[suspended](../../../reference/decisions/performance-mandate-suspension-2026-10-28.md). The Stage
bundle delta for the phase is reported, and no budget is claimed.

## Journeys

Fixtures: the starter, an empty project, an L Layout fixture, and a fixture containing a catalogue
object, a primitive and a native form.

| # | Journey | Must observe |
| --- | --- | --- |
| J1 | **Shell composition.** Open a project at each width; collapse and expand the Index; select and deselect; open the Library; open the app menu and Find (⌘K) | Head stays one row with the location chip while the Index is collapsed; a collapsed Index takes no width; no empty Card; the Card never covers the Instrument or drafting words; narrow sheets behave per PLATE; the Camera target, scale and pose never change on a layout change |
| J2 | **Plan truth.** Open the starter; switch to 2D; select a Wall from its line; flip to 3D and back; switch to shaded Plan | Paper is the default; every stream is drawn; the pick hits what is drawn; gold ink in 2D and a gold contour in 3D on one identity; target and scale kept; 90° azimuth detent; no refit; armed tool and open work survive; shaded changes appearance only |
| J3 | **Drafting.** Zoom across the range; toggle Grid and Snap; hold the snap-suspending modifier; draw a Box room; Measure a Wall; use Scale detents and Fit all | No grid spacing below 8 px, and a fixed origin; words name the state; Box gives one Undo step with Rooms derived; Measure adds no history and no dirty state; Fit all goes through Camera |
| J4 | **Height Sheet.** Drag it past a Wall top and a found surface; add a pin; use it from the keyboard; switch to Experience; reload | The Plan cut changes visibly; snap names show while dragging; the 3D plane is a neutral tint; there is no history and no dirty state; it is absent in Experience; pins and height reset after reload |
| J5 | **Legibility.** Hover and select a Wall, an Opening, an object and a form in both readings; navigate by keyboard only | Hover is never gold; selection is echoed in Stage, Index and Card; Esc clears; the focus cue is distinct from selection and hover |
| J6 | **Walls and Openings.** Drag a Wall end, length and angle; move an Opening; set thickness in the Card; release one drag invalidly; type a value at the gesture | One Undo step per valid release and none for an invalid one; Junctions are preserved; Plan and 3D agree; the refusal shows at the mark or field; Esc restores then cancels; blur never commits |
| J7 | **Objects and forms.** Move and turn an object; tap its scale point and resize uniformly; size a form per axis and by depth; match each with a Card edit | The tag names the verb; the base stays on its support; mark and Card give identical source and refusal; the form's Plan symbol follows its 3D form |
| J8 | **Eraser.** Arm it; hover a Wall and an object; erase each; try an ineligible target; Undo twice | Red dashes only while armed; one step each; the refusal is in words; Undo restores the same identities |
| J9 | **Coarse pointer and touch.** Repeat J1, J5, J6, J7 and J8 under touch emulation; start a two-finger gesture during a drag | Every control, mark and the Sheet knob has at least a 44 × 44 px target; hover reveals have touch paths (press feedback, tap the scale point, the Eraser's press-and-slide-off); the second finger cancels the drag cleanly; no mis-pick falls through to navigation |
| J10 | **Interrupted gestures.** Start a drag, then trigger each of: pointer cancel, lost capture, window blur, hidden tab, Esc, reading flip, lens switch. Start an Ink chain, then blur and return | Each drag cancels: no history entry, no dirty change, selection kept, Undo available again with no stale reason, and an immediate restart works. The Ink chain stays open until Finish, Backtrack or Esc. Save during a live drag saves only the last accepted source |
| J11 | **Source versus history and state.** After J2–J8, Save; Undo once and Redo; reload; reopen from the project list | The source after reload is byte-identical to the saved bytes. After reload, Undo and Redo are unavailable with their reason. Selection, hover, armed tool, reading, grid and snap, Sheet height and pins are back at defaults. App preferences (Paper or shaded, Reduce motion) are kept. No session or view state is in the Save payload |

## Acceptance criteria

Every row of every journey passes in both browsers with the specified pointer, and every evidence item
above is recorded in [the acceptance record](./acceptance.md) with its revision. A failed or
unevidenced row blocks acceptance. Waiving one needs an explicit owner ruling recorded there.
Passing this gate makes R217 closable; phase close stays owner-invoked.
