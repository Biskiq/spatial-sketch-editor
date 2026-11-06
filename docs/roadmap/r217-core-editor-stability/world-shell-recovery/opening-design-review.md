# Opening design — PR #270 owner review

Proposal, 2026-11-04. The accepted World visual language is now consolidated under the design-system reference. Production
code and domain contracts remain the functional authority. This addition changes
no production source, persisted format, track status or S11 acceptance.

Open [Opening specimen in the World interaction reference](../../../reference/design-system/world-interaction-sheet.html#s-opening).
The adjacent bundle is required when copying the sheet. It opens directly from disk.
Choose Door/Window, hover the Wall, click to place, then drag the sticker grips.
For keyboard placement, open More, enter Offset, then Place. Width/height remain
visible; sill/offset are in More. Plan and 3D show the same accepted document.

## Proposed decisions

- Keep Ink/Pen and its palette. Give Door and Window labeled entries beside the
  existing supported Wall, Room and Shape readings. Selecting one sets Opening
  intent and its defaults; avoid a second mixed Wall/Opening settings menu.
  The specimen shows the affected palette subset, not a replacement shell.
- Hover resolves a Wall; a dashed ghost shows the exact planner proposal. Refusal
  uses the existing red dashed language and planner-derived repair. Never clamp
  to make a candidate fit. No host means no placement; no fallback operation.
- Plan: Door has a clear threshold plus D badge; Window has paired glazing lines
  plus W badge. These are proposed symbols, not authored hinge/swing semantics.
  Production must preserve cut/projected visibility from Layout representation;
  the specimen deliberately shows both types together for comparison.
- Selected Opening: one body slide grip; a separated right-edge width grip;
  one vertical stem with Top and Sill grips. Top edits height with sill fixed;
  Sill edits sill with height fixed. No coupled left-edge resize is implied.
  In Plan the height stem is a schematic instrument, not a world-space vertical.
- Width/height lead the Card. More discloses sill, offset, derived head and host.
  The stage and Card address the same scalar operation. Production should expose
  the matching field when a grip is invoked and preserve existing precise entry.

## Implementation boundary

| Improvement | Existing capability / immediate follow-up after owner review | Boundary |
| --- | --- | --- |
| Ink Door/Window entries | Existing Opening reading and kind defaults; presentation and routing changes | Do not rename or replace domain operations |
| Placement ghost | `planCreateWallFirstOpening`, Opening F.4 planner and existing host targeting | Wire rendering to the same prepared candidate used for acceptance; retain captured identity, stale-result protection and no-host refusal |
| Refusal | `openingRefusalWords` already expresses bounds, height and overlap repairs | No UI fit solver or automatic relocation |
| Plan distinction | Kind already exists; add symbols over canonical Layout representation | Respect cut height and hit precedence; D/W do not add hinge or leaf state |
| Slide, width, height, sill | `layout-opening-measure` calls `planUpdateWallFirstOpening` for one scalar | Width changes right edge only; a left-edge resize holding the far edge would need a separately admitted coupled operation |
| Card hierarchy | Existing scalar writers and disclosure | Keep one writer and existing cancellation/history semantics |
| Future face-targeted Pen | Shared palette and an explicit surface/reading intent can be designed now | Face-lock drawing needs domain admission, stable face/frame targeting and gesture integration before shipping |
| Future Box/Round/Sketch profiles | Extension point only | No arbitrary cuts, boolean geometry, unsupported styles or recognition engine in this PR; future profile validation, compilation, Plan representation and persistence require T1/T5 agreement |

Production wiring still needs technical tests of candidate/commit identity,
cancel/interruption, host ambiguity, picking, cut-height symbols and scalar
operation semantics. These are implementation obligations, not claims established
by this design specimen. No production work beyond PR #270's existing changes
has been started for this request.

## Future Pen contract — concept only

One session intent separates **tool**, **target surface**, **intended reading** and
**profile gesture**. These are proposed session concepts, not a new persisted schema.

- Floor/Plan offers only admitted Wall/Room/Shape interpretations. A Wall face
  offers Opening profile, with Door/Window chosen explicitly. Surface changes
  can change the offered palette but never silently change an armed intent.
- Before press, highlight and name the eligible host and face. Where multiple
  candidates remain ambiguous, require an explicit host choice. An edge hit
  does not guess a face. Unsupported or occluded targets do not receive strokes.
- Press captures host identity, face frame, source revision and intended reading.
  Keep them locked through the gesture. Crossing onto another surface cannot
  convert the stroke. Cancel, host loss, revision invalidation or reading change
  clears the proposal without source writes; restarting is explicit.
- Box/Round/Sketch describe future editable profile gestures, not semantic
  recognition. A recognition suggestion, if ever added, would require explicit
  acceptance and cannot reinterpret an already committed operation.
- T1 retains Opening identity, host attachment, admissibility and architectural
  compilation. T5 may contribute reusable profile editing/geometry under an
  agreed interface; it does not create Scene-owned holes or a second compiler.

## Specimen implementation and verification

[Source](../../../reference/design-system/world-interaction-sheet/opening.js) imports current Layout planners, production Plan symbols and production
refusal wording. The HTML keeps the styles used by this external bundle, including cutouts,
transparent hit areas and dashed Door swings. [Bundle](../../../reference/design-system/world-interaction-sheet/opening.bundle.js) packages them for offline
review. Geometry on screen is schematic SVG; there is one host and session-local
state, no F.4 coordinator, undo stack, persistence, production raycast or compiled
Opening mesh. In particular this is real planner validation, not a full editor.
The other sheet sections retain their existing illustrative screen maths.

Rebuild from repository root after changing the specimen or imported planners:

```sh
node -e "require('esbuild').buildSync({entryPoints:['docs/reference/design-system/world-interaction-sheet/opening.js'],bundle:true,minify:true,format:'iife',define:{'import.meta.env.DEV':'false'},outfile:'docs/reference/design-system/world-interaction-sheet/opening.bundle.js'})"
```

Minimal verification: bundle builds cleanly; jsdom smoke exercises initialization,
Door/Window creation, overlap/bounds refusals, cancellation, view switching,
disclosure and reset. Browser smoke verifies Plan and 3D cutouts, transparent hit areas,
production Door/Window symbols, placement, keyboard sliding and a 390 px layout without
overflow or browser errors. The production Plan contract passes all 26 tests;
`npm run test:arch` passes all 23 files / 209 tests, including documentation references.
`git diff --check` is clean. Final visual acceptance remains with the owner.
