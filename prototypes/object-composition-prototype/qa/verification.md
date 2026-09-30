# C2 prototype verification — 2026-09-27

**Result:** ready for owner design review. No production feature acceptance or
user-study result is implied. All changes in this continuation are inside C2.

## Executed checks

| Check | Result |
| --- | --- |
| `qa/checks.js` in Chromium with real DOM/WebGL | **32 passed, 0 failed** |
| All six presenter steps | Completed using the same actions as the UI |
| All thirteen named direct states | Loaded/rendered without an uncaught browser error |
| `npm run test:fast` | **318 files, 4,676 tests passed** |
| `npm run test:arch` | **23 files, 254 tests passed** |
| `npm run check` | Editor and museum: **0 errors, 0 warnings** |
| Local HTML link targets | All exist, including the completed handoff |

The 32 browser checks include: cancelled import; flat capability boundaries;
nonmutating reach preview; shared-default/instance-override separation;
inspection return; preview/reset baseline isolation; invalid attachment atomicity;
host following; cross-domain host-removal Undo; reversible repair controls;
stale acceptance and the other writer's preserved rename; revision Undo;
removed versus review-needed presentation references; detach for composition and
direct imported uses; distinct IDs when composing repeated source uses;
second-project isolation; library acceptance/Undo, pin, fork and outage; bench
discard and one-action Apply.

## Browser interaction and visual pass

Checked the default empty project and intake with the presenter open; inspection,
preview/range, attachment refusal, source revision and second-project review at
**1440 × 900** (initial inspection also at 1440 × 960). Checked compact revision
review at **1024 × 700**, including wrapped Cancel and scrollable repair content.
Rationale and specimen pages rendered successfully.

Actual pointer/keyboard checks, in addition to action-level assertions:

- Imported the lamp through its Add button. Inspected the capability card and
  preview before acceptance.
- Selected Clear glass in inspection and pressed Escape: separation cleared,
  the accepted edit remained, and the return summary offered its Undo.
- Picked the first light's shade in the 3D viewport: selection resolved to
  `U-A4D1/lamp/p.shade` in Contents and Inspector.
- Dragged the second use from `[-0.7, 0, -0.62]` to `[-0.35, 0, -0.85]`:
  history advanced from 9 to 10. Command-Z restored its placement and history.
- Changed the refused window placement from 3.9 m to 2.3 m via the exact field,
  then accepted Hang: one attachment to `W-FJSK`, height 1 m.
- Focused the canvas and pressed Tab: focus moved to the Select control.
- Opened Find, searched Diffuser, checked active-result announcement and Tab
  containment, selected with Enter and inspected with I.
- Used Show range under reduced motion: static endpoint ghosts and the chosen
  47° pose were visible alongside the unchanged 30° baseline; End preview reset
  the displayed contribution.
- Changed revision repair choices through the actual controls. Their options
  remained available for reconsideration before acceptance.

## Completion fixes

- Corrected the reach specimen's swapped scope/value arguments.
- Deferred framing until new scene objects and display transforms exist.
- Moved/enlarged the intake preview clear of the presenter; reduced excessive
  lamp illumination that obscured materials.
- Kept repair controls stable after a choice; preserved their keyboard focus.
- Added exact wall/along/height inputs using the same attachment validation as
  pointer placement. Wrapped contextual controls at narrow widths.
- Removed the canvas Tab trap; added bracket-key sibling traversal and Finder
  active-result/focus recovery. Selected the arm on direct preview entry.
- Fixed direct-import detachment and repeated-component identity collisions.
- Disabled unimplemented reference-only loading with an explicit explanation.
- Restored PLATE's recessed armed-tool treatment.
- Completed the handoff and updated the README/rationale to match the demo.

## Limits

These checks establish behavior of a prepared design fixture. They do not prove
arbitrary imported-model correspondence, canonical Layout attachments/inverse
frames, production Camera evaluation, persistence, authorization, simultaneous
writers, visitor isolation or a general animation system. The two engineering
proofs in the commission remain follow-up work, described in the
[handoff](../HANDOFF.md). Broader assistive-technology and real-creator testing
remain unperformed. Missing-resource-without-copy recovery is a static specimen;
the interactive reuse flow always retains a copy.

No production source changed, so dense geometry and timing lanes were not rerun.
The fast, architecture and typecheck results above are repository regression
checks; they do not replace the prototype's browser checks.
