# R217.S11 — Integrated final gate: implementation plan

**Slice:** R217.S11 · **Status:** approved (plan); awaits an owner release-list row · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** T1 ·
**Reviewers:** T2, T3, T5 and an independent reviewer · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: exhaustive
```

## 1. Outcome

One integrated tree at a recorded revision proves the Core Editor Stability **Shell coherence**
criterion end to end, with a fine pointer and a coarse one. R217 becomes closable. This slice adds no
feature.

## 2. Why this is the smallest sensible slice

S01–S10 and S12–S25 each prove their own seams and send exhaustive proof here. This slice proves only what
needs the pieces together: journeys that cross Shell, Plan, drafting, marks and dock, and the
persistence classes.

## 3. Dependencies

- R217.S01–S10 and R217.S12–S25 accepted with routine closeout, and every consumed gate and required scope rechecked
  at this slice's trusted base.
- Agent browser runs follow the `browser-hygiene` skill.
- Fixes are allowed only for defects the gate finds, each as a bounded patch reviewed by its owner
  and recorded in the acceptance record.

## 4. Design

### 4.1 Fixtures

| Fixture | Contents |
| --- | --- |
| **starter** | The product starter |
| **empty** | A new empty project |
| **L** | The existing L Layout fixture from the H0 harness |
| **mixed** | A 3 × 2 room plan with a plinth, one catalogue model, one primitive and one native form, including a 0.9 m low Wall and a 0.75 m table |

The *mixed* fixture is added as a checked-in project JSON in `apps/editor/tests/lib/authoring/fixtures/`.

### 4.2 Pointer and viewport matrix

| Pointer | Viewports | Browsers |
| --- | --- | --- |
| Fine | 1440 × 900, 1280 × 800 | Chromium, Chrome |
| Coarse (`hasTouch`, `pointer: coarse`, `hover: none`) | 1024 × 768, 768 × 1024 | Chromium, Chrome |

A real-iPad run is recorded as an owner-run observation when available. It is not a prerequisite.

### 4.3 Evidence

1. **Complete merge gate** per the [test contract](../../../../apps/editor/tests/README.md#what-a-change-requires):
   - `npm run check` and `npm run test:arch`;
   - `npm run test:heavy` and `npm test`;
   - `npm run build`;
   - `npm run check:api`, and DB-backed `npm run test:api` with zero skips.
2. **Journeys** J1–J15 below, run by an agent in each cell of the matrix. Screenshots are archived as
   PNGs in this slice's workspace, and a row passes only with its PNG.
3. **Isolation:** the visitor, public and preview boundary tests, plus a build-chunk scan proving no
   R217 module is in a `/p` chunk.
4. **Seam reviews:**
   - S06: a test-only Sheet consumer registers without editing the Sheet;
   - S07: descriptor admission refuses an editing grip with no registered planner, and admits the
     scale-point disclosure mark, which has no planner;
   - S04: Paper hides meshes through the camera layer mask only, with no `.visible` writes;
   - S03: the resolver asks each domain for one winner and arbitrates only between winners; host
     tools ask exactly the domains that declare them.
5. **Independent review** of the integrated diff since the phase base.
6. **Bundle:** the Stage route br delta since the phase base is reported. No budget is claimed.
   Performance is not measured; the mandate is
   [suspended](../../../reference/decisions/performance-mandate-suspension-2026-10-28.md).

## 5. Journeys

| # | Journey | Must observe |
| --- | --- | --- |
| J1 | **Shell composition.** At each viewport: collapse and expand the Index; select and deselect; open the Library; open the Stage's viewing preferences; open Find with ⌘K | The Head stays one row, with the location chip while the Index is collapsed. A collapsed Index takes zero width. There is no empty Card. The Card never covers the Instrument, dock, reading control or drafting words. Narrow sheets match S02 §4.5. The Camera target, scale, azimuth and elevation are unchanged by every layout change |
| J2 | **Plan truth.** Open *starter*; switch to 2D; select a Wall by its poché and the model by its Paper outline; flip to 3D and back; switch to Shaded and back | Paper is the default, and cut, projected, hidden and symbol are drawn as specified. The pick hits what is drawn, including object outlines under Paper. Gold ink in 2D and a gold outline in 3D are on the same id. Target and scale are kept, the 2D azimuth is a multiple of 90° and there is no refit. The armed tool and open work survive. Shaded changes appearance only |
| J3 | **Drafting.** On *empty*, then *mixed*: zoom across the scale range; toggle Grid and Snap; hold Alt; draw a Box room; Measure one Wall, then from a Wall end to the model's corner; choose Scale 1:50 from Find, then press Fit; draw again at another zoom | No grid spacing below 8 px, and a fixed origin. Snap stays 0.5 m at every zoom, and points drawn at different zooms share one lattice. The Paper grid frames the drawing, and the ruler has no fill. The words name their state. Box is one Undo step with a derived Room and snapped corners. Measure leaves history, dirty state and Undo availability unchanged. The framing changes go through Camera |
| J4 | **Height Sheet.** On *mixed*: drag the Sheet from 1.2 m to 0.6 m and back; add a pin; step it by keyboard; switch to Experience and back; reload | The 0.9 m Wall moves cut ↔ projected. Ticks show Floor, the plinth top and 0.75 m. The snap name shows while dragging. The 3D plane is a neutral tint, not yellow or gold. No history and no dirty state. The Sheet is absent in Experience. After reload the height is 1.2 m and there are no pins |
| J5 | **Legibility.** On *mixed*: hover then select a Wall, an Opening, the model and the form, in both readings; then repeat by keyboard only | Hover is never gold, and is drawn for every kind. Selection is echoed in Stage, Index and Card. Esc clears. The focus cue is distinct from hover and selection |
| J6 | **Walls and Openings.** Drag a selected Wall's body, its move grip, an end point and its length ray; move and widen an Opening; set thickness in the Card; release one drag invalidly; type `3.5` during a length drag; press Esc twice | One F4 entry per valid release and none for the invalid one. Shared Junctions stay shared, and the live preview matches the accepted result. Wall and Opening drags honour Snap. Plan and 3D agree. The refusal shows at the mark or field. Typed entry commits once. Esc restores, then cancels. Blur never commits |
| J7 | **Objects and forms.** On *mixed*: move and turn the model; tap its scale point, check that Undo is still available, and resize it; press Esc twice; resize the form's Width and Height; match each value in the Card | Opening the scale point adds no history, and the first Esc closes it before the second clears selection. The tags name the verb. The base stays on its support. Mark and Card give identical source and refusal. The form's Plan footprint follows its 3D form. There is no Arrange instrument |
| J8 | **Eraser.** Arm it; hover and erase a Wall, an Opening, the model, the primitive and the form; click a Room floor and the plinth; Undo five times | Red dashes appear only while armed. Each erase is one step through its owning domain, with the Wall's consequence disclosure shown. The Room floor and the plinth refuse in Layout's words. Undo restores the same ids |
| J9 | **Coarse pointer and touch.** Repeat J1, J5, J6, J7, J8, J14 and J15 in the coarse cells; start a second finger during a mark drag; press, slide off and release with the Eraser | Every control, mark, dock key and the Sheet knob has a hit area of at least 44 × 44 px. Every hover reveal has its touch path. A second finger cancels the drag cleanly with no entry. Eraser slide-off erases nothing. No mis-pick falls through to navigation |
| J10 | **Interrupted gestures.** During a Wall drag, an object drag and a pan, trigger each in turn: pointer cancel, lost capture, window blur, hidden tab, Esc, reading flip, lens switch. Then start an Ink chain, blur and return. Click Save during a live drag | Each drag ends with no F4 entry and no dirty change. Selection is kept. Undo becomes available with no stale reason. An immediate new press works. The Ink chain survives blur and return. Save during the drag saves only the last accepted source (byte comparison) |
| J11 | **Source versus history and state.** After J3–J8 on *mixed*: Save; Undo once, then Redo; reload; reopen from the project list in a new session | The source after reload is byte-identical to the saved bytes. After reload and after reopen, Undo and Redo are unavailable, with their reason. Selection, hover, armed tool, reading, grid and snap, Sheet height and pins are at defaults. The app preferences (Paper or Shaded, Reduce motion) are kept. The Save payload contains no session or view state (key scan) |
| J12 | **Plan flip.** On *mixed*: flip between 3D and 2D at four azimuths, including during a transition, then repeat quickly | No frame reverses the screen axes, and a Wall on screen-left stays there. Target and scale do not drift. Selection, tool and source are unchanged |
| J13 | **3D ground.** On *mixed* and *empty*: orbit from overhead to shallow with the horizon in frame, and zoom to both extremes | Grid and ground run to the visible edges with no straight cut, moiré band or close-up fighting. Line count stays within the budget |
| J14 | **Direct Plan editing.** On *starter*, using the Stage only: drag a selected Wall's body; drag an end point at a shared Junction; hover and drag a corner with nothing selected; click an Opening, then slide and resize it; drag a Junction onto another Junction; pan from an unselected Wall | Neighbours stretch and stay connected, and each valid release is one Undo step. Clicking an Opening selects it. The refused drop writes nothing and gives a readable reason near the pointer. Panning edits nothing. The Index is never needed |
| J15 | **Every subject.** For a primitive, a catalogue object, an approved model and a native form, in Plan and in 3D: place it; drag it by its body; turn it; size it; duplicate it; drag it off a floor; undo each step | The ghost follows the pointer and matches the accepted result, and an off-floor release writes nothing. The Card never covers the subject during a gesture |

## 6. Acceptance criteria, reviews and stop conditions

- **Pass bar:** every journey row passes in every applicable matrix cell, and every evidence item in
  §4.3 is recorded in [the acceptance record](./acceptance.md) with its revision. A failed or
  unevidenced row blocks acceptance. Waiving a row needs an explicit owner ruling recorded there.
- **Reviews:** T2, T3 and T5 for their domains' rows; an independent reviewer for the integrated
  diff.
- **Stop and report if:** a fix would exceed a bounded owner patch, or would change a planner,
  format or Camera rule. That goes back to its owning slice or owner.

## 7. Handoff

Passing this gate makes R217 closable; phase close stays owner-invoked. The Core Editor Stability
acceptance plan cites this record for the Shell coherence criterion.
