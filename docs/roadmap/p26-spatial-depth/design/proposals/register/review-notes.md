# REGISTER — review evidence and prototype limits

**Design artifact only · unratified · 2026-09-22.** The product specification is [direction.md](./direction.md); [evidence.md](./evidence.md) records the inspected baseline. No P26 product acceptance is claimed. Completion here means *review-ready*, not ratified or implementation-ready.

## Completion pass — verification actually run

Performed on branch `codex/p26-register-design` on top of `769d69f`. The pass only fixed presentation and consistency. It did not redesign REGISTER, and it changed no production code.

**Visual QA.** Viewed all **27** boards at full frame and the drawing canvas at 1:1 (one frame CSS pixel per screenshot pixel) in the in-app browser. The fit-to-window view was also checked at a realistic 1280 × 800 laptop viewport: the frame scales to 1240 px with no horizontal page scroll. Rendered the three exported SVGs with `rsvg-convert` at native 1440 × 900 and at 0.6 scale (864 × 540), and inspected all six renders.

**Automated sweep of every board.** For each of the 27 boards the sweep checks:

- canvas text clipped at the Paper edge;
- overlapping labels;
- drawing content hidden under a Paper message;
- horizontal overflow in the shell rows (Navigator, contextual host, head, status, Inspector properties);
- registration-map text overflow;
- `undefined`/`NaN` in the frame;
- malformed SVG path numbers;
- a frame size other than 1440 × 900 CSS px.

**Result: 0 findings on all 27 boards and an empty console.** The first sweep before fixes had findings on 15 boards.

**Defects found and corrected:**

| Defect | Consequence | Correction |
|---|---|---|
| Two SVG path templates joined numbers with no separator (`…331.2 275` rendered as `…331.2275`). | The projected east window and curved partition were malformed in Section A. The same malformed paths appeared in the exported Section frame and the excluded/crop boards. | Separator added. Window and partition now draw correctly in the atlas and the export. |
| The S5 **Trim gable against flat** action shared its name with the `joint` board id. | Clicking it only reloaded the board. The trim/undo-joint demonstration the notes described never ran. | Action renamed; trim and undo now verified. |
| The depth value carried over between boards. | After S6, the crop, return and Section C boards showed depth 2.00 instead of 4.50. Changing depth below 4 on S2 jumped to S6 while keeping O-DOOR, so O-DOOR was flagged "outside depth". | Each board sets its own depth. A depth change never changes selection or board; O-WINDOW simply leaves the drawing. |
| The registration map always showed Section A. | Contradicted every elevation, curve, Section B, Section C, Ceiling Focus and empty board. | One map per instrument: host wall and face with look direction, curve tangent, Section B normal to the C-GABLE ridge, Section C (illustrative), Focus plan orientation, empty state. Header and caption follow the map. |
| The contextual strip did not match spec §§2, 4, 5. | Elevations offered Depth/Cut only/Edit cut. Focus lacked the floor-relative and look-up readouts. Plan boards claimed an active section. | Strip content now depends on the instrument kind: <ul><li>**Section:** "Looking east" and the range row.</li><li>**Elevation:** face switch and "Background 0.30 m".</li><li>**Curve:** arc-length station.</li><li>**Focus:** Cut Y, floor +1.60, "up 5.00 m → Y 6.75" and Reset to floor +1.60.</li><li>**Plan:** "Resume section" / "Discard section".</li><li>**Tools:** section placement and the ceiling tool.</li></ul> |
| Ceiling-profile section title mismatch. | Opening the C-GABLE profile section was titled Section A in the strip but Section B on Paper. | Unified as Section B. |
| The S9 edge-on board drew a W-EAST window elevation. | Title "Head stays fixed. The spring line moves." and a West face, while the scenario is W-SHARED elevation with O-WINDOW edge-on. | Now shows W-SHARED's north face with the W-EAST junction edge-on at screen-left. East/west (or north/south) orientation letters were added to all wall elevations. |
| Selected state was inconsistent. | O-DOOR edges and elevation grips were drawn as selected while O-WINDOW or W-SHARED was the target. The plan door rect was highlighted during the ceiling draft. | The selected treatment follows the canonical target only. |
| The empty-project board showed the Two galleries hierarchy with O-DOOR selected. | Contradicted "an empty project". | Empty Navigator, "Untitled project", no selection, default depth 5.00 m, Section tool armed. |
| The S9 deleted-host board still listed W-SHARED with editable Gable properties. | Kept a stale editable source (spec §4). | Navigator marks it deleted and the Inspector shows no selection. Undo deletion restores W-SHARED as the selection. |
| The S9 unclosed-outline board selected the existing C-GABLE with full properties. | "Close outline" jumped to the room-seeded S5 C-SPAN story. | The draft region is the target and is not in the document. Suspended is proposed (spec §5); Create is disabled until the outline closes. Closing stays on the board with no history. |
| The C-SPAN Inspector said "Uncovered east strip retains generated Y 4.35". | C-SPAN covers both rooms entirely. | Region-specific text. |
| Navigator missing C-FLAT. | Listed C-GABLE without C-FLAT on the multiple, joint and Focus boards. | C-FLAT listed. |
| The S9 room-stretch board was titled "The same O-DOOR, back in Plan". | Title contradicted the scenario. | Titled for the refusal; draws the attempted two-room marquee without handles. |
| The tray always showed Select armed. | Wrong for section placement, the empty state and the ceiling tool. | The armed tool follows the board (`aria-pressed` too). |
| Paper messages covered the stroke legend. | The legend was hidden on six boards. | Messages moved to the top of Paper. |
| Overlapping or clipped labels. | Span vs. footer, HIGH Y vs. room name, 0.50 and 11.00 vertical dimensions, platform rise and artwork labels, gable eave label on its own line, "+0.15" datum clipped at the Paper edge. Focus labels ran into geometry after mirroring; anchors are now mirrored with the geometry. Room labels sat under the twelve-room cut line. | All repositioned. |
| Height missing from the Inspector. | Spec §4 makes height a readout beside the sill/head writers. | Added to the atlas and the Section export. |
| Crop… jumped to the S6 section crop board from any instrument. | Wrong board and selection outside Section. | Crop… opens the S6 board only from Section. Elsewhere it reports the crop behaviour. |
| Duplicate Undo deletion. | Appeared in the Inspector as well as on Paper. | Kept on Paper only. |
| Redundant "Open elevation". | Offered while that elevation was already active. | Replaced with a note. |

**Interactive demonstration re-run** (scripted clicks and form submissions against the live atlas):

- **Opening head:** head 2.10 → 2.30 commit (1 history entry), then Return to Plan and Undo → 2.10 (0 entries). 3D keeps O-DOOR.
- **Reveal and Undo are independent:** on S6, Reveal, then sill 1.10 → 1.20 commit, then Undo → 1.10 with Reveal still active. Restore view then clears Reveal and leaves the sill unchanged.
- **Refusal:** head 4.50 is refused. The document stays unchanged and the typed value stays in the field (`aria-invalid`).
- **No-op:** resubmitting 2.10 writes no history.
- **Draft ceiling:** Create stays disabled until the outline closes.
- **Focus cut:** 2.00 → readouts "floor +1.85 · up 5.00 m → Y 7.00", and Reset returns to 1.75.
- **Joint:** trim, then undo joint.
- **Deleted host:** Undo deletion restores W-SHARED as the selection.
- **Face switch:** keeps W-SHARED/O-DOOR.

**Twenty-seven scenarios against the spec.** Board count 27. The S1–S10 references are unchanged. The figures agree with direction.md:

- **Section and ceilings:** S2 depth 4.50, East gallery excluded; 1.00 m generated gap at the shared wall; C-SPAN 3.55 → 4.55 with a 0.745 gap at the shared wall; C-FLAT/C-GABLE 0.50 m overlap; 1 m east strip at Y 4.35.
- **Ceiling Focus:** default cut floor +1.60 = Y 1.75, 5.00 m upward range.
- **Twelve-room wing (S4):** 24 × 15 m, 6 in / 6 out, cut at column 2.
- **Column and platform (S8):** 0.40 × 0.40 column, base 0.15 / top 3.35; platform top 0.60, base 0.40, thickness 0.20.
- **Wall elevation:** the S7 opening demonstration; S3 window rise 0.90 → 0.45.

**Exports.** Regenerated with `node docs/roadmap/p26-spatial-depth/design/proposals/register/export-frames.mjs`. Exporter updates:

- The map header and caption now come from the atlas's own map functions.
- The Focus and placement strips match the atlas.
- The twelve-room frame now reads as Plan placement: Open section, Section tool armed, no Plan-side Reveal.
- Navigator references are right-aligned; SVG had collapsed the space padding.

All three are exactly `width="1440" height="900"`, pass `xmllint`, and contain no `NaN`, `undefined` or malformed numbers.

**Syntax and whitespace.** Atlas script parses (`new Function`), `node --check export-frames.mjs` passes, `git diff --check` is clean.

**Links and sources.** 53 relative links across the README, direction, evidence, review notes, atlas and the P26 router all resolve. Every `#L` anchor is within its file both at baseline `8d583172` and at HEAD. Spot checks confirmed each anchor lands on the cited construct: `buildArchProfile`, the derived room ceiling, the Wall type, `resolveLayoutSnap`, the opening-mutation guard, the preview preflight, `beginLayout`, the view-mode types. `git diff 8d58317 HEAD -- apps packages` is empty.

**Not run:** production test lanes, since no production code changed. No automated screen-reader or contrast audit; the notes on accessible SVG grips and keyboard paths remain design intent (direction §9).

## Read the atlas as a bounded prototype

The atlas is a scenario player with a small functional opening-edit/history and view-lease demonstration. It is **not a miniature geometry implementation**. It does not:

- execute the canonical compiler;
- persist a project;
- implement arbitrary pointer dragging;
- simulate all occlusion cases;
- certify performance or accessibility.

Blue opening grips focus the matching numeric field. Ceiling creation, curve-follow, joint resolution and host-deletion recovery are illustrated transitions: their messages describe design behaviour, not production transactions. Global Undo in the prototype demonstrates opening edits only. Dedicated joint and deletion controls show those storyboard reversals separately.

Board changes swap fixtures. Actions that cross scenarios (Open elevation, Return, Open profile section, Edit cut) load the relevant board and its fixture target rather than carrying live state between drawings. The Section C and Section B map locations are illustrative. Ceiling creation shows its message but does not add a new region to the fixture.

Use the specification for the complete per-property gesture/validation rules and the delivery distinction. In particular, source-specific Reveal, independently authored arch rise, coverage subtraction, ceiling joints and datum-safe reflected derivation require the architecture seams described there. These SVGs do not prove their feasibility.

The Navigator is a visual hierarchy with a working text filter. Its rows are not a fully implemented canonical selection reducer. Unimplemented shell actions are painted as labels rather than working application controls. Reviewer controls above and below the frame are atlas UI, not proposed editor chrome. The opening's host offset (a writer in spec §4) is not shown in the Inspector demonstration.

## Outstanding owner decisions

1. **PLATE reference PNG deletion.** Commit `769d69f` ("P26 proposal") on this branch deletes `design/briefs/plate-scene-plan-1440x900.png`. The [designer brief](../../briefs/2026-09-22-p26-designer-brief.md) still embeds it at line 899, so merging as-is leaves a broken image in the brief. This pass preserved the deletion as instructed and did not restore the file. Before merge, either restore the PNG or accept the deletion and update the brief's reference.
2. **Paper-level "Undo deletion" vs. single Undo host.** Spec §4 puts "Undo deletion" on Paper for the deleted-host state. The §9 ownership table assigns global Undo to the Project Head. The atlas treats the Paper action as a contextual shortcut into the same chronological history. Ratify that reading or remove the Paper action.
3. **Tray grouping of the Ceiling tool.** The tray places Ceiling under INSPECT, but spec §5 also makes it the authoring entry point (Use room outline / Draw region). Grouping is a PLATE tray-composition question and is left for review.

The direction-level ratification table remains in [direction.md §12](./direction.md#12-decisions-for-owner-ratification).

No other P26 submissions were opened or incorporated. Routing was changed only to make this unratified artifact discoverable.
