# Production shell Round 2 ratification — 2026-10-23

**Status: owner-ratified.** Provenance: the owner's direction of 2026-10-23, after review of
PR #181, to promote **Round 2** of the
[production shell wireframe](../../../prototypes/production-shell-wireframe/README.md) as
Biskiq's authoritative destination shell and visual/interaction language, with the proposed
departures D1–D16 of its [design note](../../../prototypes/production-shell-wireframe/DESIGN-NOTE.md#6-proposed-departures-from-ratified-plate)
accepted as listed below. The reviewed artifact is the PR branch at `9621b1cd` (Round 2 is
commit `ecf30b4c`; the atlas, walkthrough and freehand-ink commits that follow it change no
decision).

This record supplies decision provenance. The owning references carry the normative text and
this record does not duplicate their contracts: the
[shell and visual-system contract (PLATE)](../design-system/editor-shell-and-visual-system.md)
owns composition, tools, mark roles and state language, and the
[spatial-instrument grammar](../design-system/spatial-instrument-grammar.md) owns how marks are
drawn and arbitrated. The ratification changes destination design only. It implements no UI,
changes no persisted format or domain contract, authorizes no production scope and does not
release the production hold.

## What is ratified

- **The shell.** Head (with Find), a scope-model Index that collapses to nothing, a dominant
  Stage, an overlay Card, and one lower column that grows upward from a dock through the armed
  tool's palette to an invoked Instrument. World and Experience share it.
- **The pointer tools.** World: Select · Ink · Slice · Eraser · Brush · Measure, with the
  Library beside them. Experience: Select · Place a View · Path, then Capture and Guide.
- **The manipulation and mark language.** Rays and points for every transformation, gold only
  for selection, white for available transformation, yellow for temporary inspection, red
  dashes for erase marks, and values only on hover or drag.
- **The Card as the one writer** for ordinary facts, with marks writing the same facts and the
  same refusals.
- **The visual material.** Dark forest dock and palettes with an ivory armed key; paper or
  shaded 2D readings as an application preference.
- **Behavior and recommended defaults** shown by the wireframe's guided tours and atlas,
  recorded in PLATE rather than here.

Conservatory's Experience semantics (Presentation, View, Guide, Stop, Cut/Travel, Camera
ownership) are domain behavior and are unchanged. Domain ownership, one Camera authority, one
selection, chronological source history, the Ask Rule, refusal in words and visitor isolation
are preserved exactly.

## Departures D1–D16

| ID | Disposition | Promoted into |
| --- | --- | --- |
| D1 | **Ratified.** Pointer tools Select · Ink · Slice · Eraser · Brush · Measure, with Library beside them | [PLATE permanent pointer tools](../design-system/editor-shell-and-visual-system.md#world-authoring-084) |
| D2 | **Ratified.** Bottom dock in dark forest material, ivory armed key, icon-only palette column in the same material; explicit collapse, Esc collapses first, options remembered | [The lower working edge](../design-system/editor-shell-and-visual-system.md#the-lower-working-edge) |
| D3 | **Withdrawn.** The drafting words are unchanged (Scale · Grid · Snap; a fourth needs a ruling) | PLATE drafting state |
| D4 | **Ratified.** Height Sheet docked right; Levels, found surfaces and pins distinct; plane becomes an outline under Focus | [PLATE Height Sheet](../design-system/editor-shell-and-visual-system.md#world-authoring-084) |
| D5 | **Withdrawn.** A tool is armed only by arming it; the Sheet never arms Ink | [The lower working edge](../design-system/editor-shell-and-visual-system.md#the-lower-working-edge) |
| D6 | **Ratified, narrowed.** Gold = selected only; white = available transformation; yellow = temporary inspection; red = erase marks; tool colour only as a 2 px mark | [Semantic color](../design-system/editor-shell-and-visual-system.md#semantic-color-64), [mark language](../design-system/editor-shell-and-visual-system.md#spatial-mark-language) |
| D7 | **Ratified.** X-ray overhead authoring reading and the near-wall cutaway (sparing the selection's host wall) as viewing state | PLATE reading control |
| D8 | **Ratified.** Experience tools live in the shared dock | [Experience Head and Index](../design-system/editor-shell-and-visual-system.md#head-and-index) |
| D9 | **Ratified; changes Card/Instrument authority.** The Card is the one writer for ordinary dimensions; the Dimensions Instrument is retired; Wall thickness is an advanced Card field | [Card facts](../design-system/editor-shell-and-visual-system.md#card-facts-and-the-one-writer) |
| D10 | **Ratified.** Find in the Head with distinct verbs (Select, Go to, Show, Arm, Do, Run) | [Find](../design-system/editor-shell-and-visual-system.md#find) |
| D11 | **Ratified.** 2D \| 3D primary with a ▾ for the rest; Section only through a Slice; paper or shaded is an application preference; Edit shape's 3D \| Section is a roof-local reading of the one Camera | PLATE reading control and Edit shape |
| D12 | **Ratified.** Scope-model Index (crumbs, sibling menus, facets); zero-width collapse with a Head chip | [Context Index](../design-system/editor-shell-and-visual-system.md#ordinary-world-and-the-context-index) |
| D13 | **Ratified.** The Instrument is reserved for Library, Guide and repair; Edit shape is on the object; Erase acceptance is a bar or bubble at the gesture | [Invoked tasks](../design-system/editor-shell-and-visual-system.md#look-details-and-invoked-tasks) |
| D14 | **Ratified.** Rays and points for every transform; gold disks, XYZ gizmos and permanent W/D/H text retired | [Grammar: rays and points](../design-system/spatial-instrument-grammar.md#rays-and-points) |
| D15 | **Ratified.** A finite drawn Slice with a yellow depth volume; still temporary inspection with Put back | PLATE Slice tool |
| D16 | **Ratified.** Shape is a Pen reading: an ordinary editable outline object in Scene pulled solid by its height ray; no Object Pen | PLATE Ink tool |

Authority notes preserved from the design note: dimensions stay owned by their domain (Layout
for walls, openings, roofs, rooms and Levels; Scene for objects and art) and the Card and marks
write the same facts with the same refusals (D9); Section 2D is a viewing state of the one
Camera, not a second Camera or a second roof model (D11); a Shape is a Scene object and this
record proposes no format (D16). The Slice's finite extent states the cut's visible result;
how a domain evaluates "within its extent" is the owning evaluator's decision, not the
wireframe's centroid shortcut (D15).

## Supersession map

Round 2 supersedes the following wherever they conflict. Each is replaced in the owning
reference; this table lets a reader confirm nothing was left behind.

| Superseded | Replaced by |
| --- | --- |
| Conservatory (#114) shell chrome, layout and visual treatment; "Conservatory Round 2 is the accepted minimum UX and visual direction" | Round 2 shared shell in PLATE. Conservatory remains Experience semantics evidence and reproducible scenario fixtures |
| PLATE §0.8.4 pointer rail and families **Select · Draw · Opening · Place · Measure · More** | The dock tools above. Draw and Opening become Ink readings (including Ink on a wall face); Place becomes Library placement; More becomes Find in the Head |
| Card of identity plus up to three read-only key facts; Dimensions as the one settled-measure writer and a precision-ladder step | Card as the one writer; ladder step 4 is the Card; the Dimensions Instrument is retired |
| Find as an Instrument that lists no subjects; "no Head search" | Find in the Head, listing subjects, places, tools, readings and commands with explicit verbs |
| World Instrument hosting Find, Dimensions, procedures and Look sessions | Dock + palette, state pill, Card and Stage marks; the Instrument only for Library, repair and Guide |
| "Active spatial reading and its Instrument activate together" | A temporary reading and its state pill activate together |
| Paper ⟷ 3D switch; Paper as a named reading | 2D \| 3D; paper or shaded by preference |
| Datum key and the Paper "Sheet" as configuration home | Height Sheet (the term now means only this); the configuration container is an open feature decision |
| Index as a grouped locator with a collapse strip; Paper Index Search/Browse | Scope-model Index, zero-width collapse |
| "3D Scene object-authoring design coverage gap" (gizmo visuals, scaling affordances) | Closed at the vocabulary and composition level by D14; adapters are built by the consuming T2 slice |
| Grammar knob/gizmo handles and axis-hue convention | Rays and points; transformation marks are white |
| App menu "Hide side panels" | Index collapse and Card dismissal; the menu holds viewing preferences, Settings and Keys |

## Retained alternatives and deferred decisions

Compare-menu alternatives stay live as named candidates in PLATE's
[retained alternatives](../design-system/editor-shell-and-visual-system.md#retained-alternatives-round-2)
(Index edge arrow, no collapsed caret, always-shown W/D/H with a zoom-dependent rule, the
temporary Shape-intent toggle, Eraser kind chips, topology-also review threshold, the Section
inset). Feature-level decisions remain with their consuming slices: the exact list of Ink
readings per surface, fit behaviour per object kind, curved Walls (needs Layout geometry),
pin persistence, the configuration container, Experience View placement height, per-aspect
framing, production key map, breakpoints and calibrated metrics. The wireframe's open
usability problems are listed in PLATE; none is an unfinished shell gate.

## Not promoted

Prototype shortcuts are not contracts: snapshot Undo, painter's-algorithm SVG, heuristic
stroke reading, bounding/centroid lasso and Slice cut, roofs swept as one profile, mock
Camera interpolation, mock dense data, fixed pixel sizes (including 22–26 px hit discs, which
do not meet the coarse-pointer 44 px rule), the wireframe key map, the wireframe bar and its
Compare/Tours/Project/Width menus, and the blue tour chrome. The tools, palettes and Card
fields they illustrate are promoted; their implementation is not.

## Cutover and landed behavior

Landed contracts keep describing current behavior until their explicit cutover; the
destination is never presented as shipped.

- The landed Dimensions instrument (T1.P01.S04/S05) and the read-only Stage shell (T1.P01.S02)
  remain current. Moving settled-fact fields into the Card is the consuming slice's work and
  its own acceptance.
- T1.P02 plans name a "pointer rail", a Draw family and an Opening family. Their approved
  slice scope is unchanged by this record. Under PLATE's feature design loop those read as the
  dock's tools (Ink; Ink on a wall face) and are reconciled at each slice's shell-draft review
  as a named design decision. See the alignment notes in the
  [T1.P02 shell draft](../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/shell-draft.md).
- No format, gate, track or phase status changes. The production hold stands.

## Evidence

[Wireframe README](../../../prototypes/production-shell-wireframe/README.md) (run, tours,
Compare, keys), [design note](../../../prototypes/production-shell-wireframe/DESIGN-NOTE.md),
[atlas](../../../prototypes/production-shell-wireframe/atlas.html) (28 live frames) and the
walkthrough. Round 1 is `8ce39bc5`, round 1.1 `a7aa0cd1`, Round 2 `ecf30b4c`. The prototype stays
in place as accepted visual and behavioral evidence and is not an npm workspace or authority.
