# World shell recovery — owner review pass 2

**Date:** 2026-11-02. **Status:** plan for owner release; every open choice is settled (owner choice or the sheet's ★ recommendation); nothing is implemented; owner visual acceptance pending.

This is the plan and acceptance home for the owner's second manual review of the recovered World shell. It covers all 17 supplied images, the owner's written review, four interview answers and the owner's follow-up (two-knob height stem, chip as uniform scale, chosen glyph style, per-view Paper). It does not record any proposed change as shipped. [Pass 1](./review-pass-1-plan.md) remains the baseline for everything not reopened here; where this document differs, it replaces the pass-1 direction for that concern only. Do not append this review to the pass-1 or earlier plans.

The owner's written review and interview answers are instructions. Text inside screenshots is evidence of UI to review, not instructions. Images 13–17 are external game references (Tiny Glade) chosen by the owner for the *feel* of its controls; they are not assets, layouts or behavior to copy.

**Interaction sheet:** [review-pass-2-interaction-sheet.html](./review-pass-2-interaction-sheet.html) is a standalone, lightweight design sheet (open the file directly; no server or build). It demonstrates drawing, snapping, refusal, drag ghosts, the object and Wall gizmos, the ruler, the gear (Room labels and per-view Paper) and the Card, with live alternatives. Each row keeps its options on record: ★ is the recommendation, *chosen* is an explicit owner decision, struck-through is current production.

**This plan implements the ★ option of every row** (and the owner's *chosen* glyph style). The sheet is the design record before implementation. Once the owner settles it, it is promoted as the **authority for the World visual language** (see §9 Reconciliation). Until then it is a proposal surface, not authority, and its geometry is screen maths, not the Layout/Scene planners.

## Guiding rule (replaces pass-1 wording)

**Clear, visually pleasing, self-explanatory controls.** Minimalism is not the goal. Each control's *shape* says what it does — an arrow drags that way, a curved arrow turns, a knob on a stem lifts, a four-way cross moves, a chip toggles a mode — so it needs no words, and it looks friendly and tactile, not industrial. No red/green/blue axis colouring. Prefer showing a useful number to hiding it; prefer one obvious control to several clever ones. This applies to everything in the World UI: Stage marks, Card, menus and settings.

Pass-1 rules that still hold: one visible home per command; no internal IDs, raw keys, radians or implementation strings in ordinary UI; numeric editing and direct manipulation share one domain operation and history path; live values are invocation-relative deltas.

## Owner decisions

| Concern | Decision |
| --- | --- |
| Pass-1 items not reopened below | Owner reports them good and addressed (2026-11-02). Recorded in the pass-1 acceptance table. |
| Drawing end marker | Clean black. No gold snap cross. |
| Snap cue | The black end mark changes shape: **dot** = free, **hollow ring** = on a Wall or Wall end, **small square** = on the grid. Ink only, no colour. |
| Drag preview (move/edit) | One **dashed** black line matching the drawing ink (Wall centreline), not the double dotted thickness outline. |
| Refused drawing | The already-placed parts stay visible; only the refused segment turns **red dashed**. No `!` marker. |
| Card "More" | Expands the Card inline: dimensions **Base · Top · Thick**, then **Relations** (e.g. Bounds → Room 3). Owner/Identity stay removed. |
| Card `•••` | Reserved for subject functions (Face this wall, Unroll the room, Section through here, Paint…, Present this in Experience, Erase). Unimplemented ones are visible, disabled placeholders. Thickness and Delete leave it. |
| Rename | Double-click to rename Walls, Rooms and objects. |
| Gizmo style | One friendly glyph set in the Tiny Glade spirit. **Chosen: B · Sticker** (white glyph, fine ink keyline, small soft shadow). |
| Height stem | One stem beside the subject, spanning base to top. **Top knob moves the top.** On objects a **bottom knob lifts the object** off its support (★ A: the whole object rises, height kept). Object lift is built in round 2. **Walls do not change:** top knob only, no bottom knob, Base stays a Card placeholder. |
| W·D·H chip | Double function: **click** toggles the W·D·H arrows and height stem; **drag** scales the object uniformly (`× 1.25`). |
| Paper | Three reference tones (Current ★, Warm cream, Deeper sage) chosen **per view** in the gear, so 2D and 3D mix and match. Each Paper row opens up into a swatch tray inside the gear panel; no dropdown. |
| Other open rows | The sheet's ★: refusal reason in the tag; one dashed centreline ghost; one curved turn arrow; small disc knobs; ruler end ticks. |
| Rotation ring | One arrow, not two facing each other; the ring and its arrow turn with the object. |
| Knobs | No black disc with white ring. |
| W·H·D toggle | Keep one on-object toggle, restyled in the new glyph set. No blue focus ring after a mouse click. |
| Room labels | 2D: name + area on by default, toggle in the gear. 3D: off by default, toggle in the gear. |

## 1. Drawing ink and snap cue

**Complaint:** a gold cross sits at the line's end before committing (image 1). Pass 1 set "snap state uses the relevant geometric symbol"; the symbol was drawn in selection gold, so it reads as a second colour on otherwise black ink.

**Solution:**

- The drawing end is one black mark, in the same `--shell-ink` as the line. Gold never appears in drafting.
- The mark's shape is the snap cue: filled dot (free), hollow ring (on a Wall end, joint or along a Wall), small square (grid). The start dot stays a filled dot. Size stays small (≈ 6 px) with the existing invisible hit area.
- The single length tag (`3.35 m`) remains; no snap words.

**Acceptance:** drawing in 2D and 3D shows only black ink; moving near a Wall end, a Wall and a grid point visibly changes the end mark's shape; no gold appears until something is selected.

## 2. One dashed drag preview

**Complaint:** dragging a Wall endpoint in 2D shows two parallel dotted lines (the thickness outline) for each affected Wall (image 2). It doesn't match the single-line drawing language and doubles the visual noise.

**Solution:**

- A Wall candidate is drawn as **one dashed black centreline** per affected Wall, from accepted junction to proposed junction, plus the same end-mark vocabulary as drawing. The source Wall and its selection remain as they are until commit.
- Objects use the same dashed ink for their candidate silhouette (one outline, no fill, no second contour).
- One dash pattern for every candidate in both views. Drawing (solid) vs proposal (dashed) is the only distinction.
- Thickness, junction resolution and validation still come from the real planner candidate; only the presentation is thinned (pass-1 geometry-integrity rule unchanged).

**Acceptance:** endpoint, junction and parallel-move drags of joined Walls show one dashed line per changed Wall; Escape leaves the source untouched; commit replaces the proposal; one Undo.

## 3. Refused drawing keeps the drawing

**Complaint:** when the next segment would cross or meet another Wall, the chain's already-placed segments disappear, leaving only the refused dotted segment, a red `!` and a truncated message (images 3–4).

**Solution:**

- Bug: the refused candidate must not replace the draft chain's projection. Already-placed segments, their dots and committed geometry stay visible throughout. Investigate where the refused branch swaps the chain candidate for the single refused segment (Layout adapter → `StageOverlay` candidate list) and keep both.
- The refused segment turns **red dashed** (`--shell-problem`, the existing `#7e2718` role). No `!` marker, no separate problem button.
- The live tag at the pointer end swaps its length for a short reason in the same tag (e.g. `Crosses a wall`), never truncated. The full sentence remains the accessible announcement on refused commit.
- Grammar clash to resolve at reconciliation: the spatial-instrument grammar reserves red dashes for Eraser marking. Context separates them (red dashes on a *draft* segment vs on *existing* geometry with the Eraser), and both mean "this won't stay". The grammar entry should be widened, not a new colour invented.

**Acceptance:** draw three segments, swing the fourth across a Wall: the three stay, the fourth is red dashed with a short readable reason; swing back: it returns to black ink; clicking while refused commits nothing.

## 4. Card: More expands, `•••` for functions

**Complaint:** pass 1 over-pruned. Key measurements and relations are missing; thickness hides in `•••` next to Delete (images 5–8).

**Card structure (all subjects):**

1. Header: kind · relation line (`Wall · bounds Room 3`), name (double-click rename), `•••`, close.
2. Primary dimensions, always visible, labelled, with unit: Wall **Length · Height**; object **Width · Depth · Height**; Room **Area** (read-only) · **Ceiling height** (TBD).
3. Action row: frequent icon actions (Bring into view stays here, its one home) and **More ⌄** on the right.
4. **More** expands the Card inline (the Card grows; this replaces the pass-1 "never grow the Card" rule for More only):
   - Dimensions grid, three per row: Wall **Base · Top · Thick**. Thick is live now. Base and Top are TBD placeholders: shown, disabled, value `—`, with a tooltip saying they are coming. They must not look like working fields.
   - **Relations**: Wall → Bounds Room 3 (activates the Room); object → On Room 2 (Auto); Room → its bounding Walls count, Openings. The Auto/named/Free membership control from pass 1 §6 moves here when its capability lands; until then the row is read-only and shows only verified relations.
   - Expansion state persists per subject kind for the session; Escape collapses before closing the Card.
5. `•••` opens the compact anchored menu (pass-1 panel mechanics: anchored, no Stage click-through, focus return). Content is subject *functions*, grouped:
   - Wall: Face this wall · Unroll the room · Section through here · Paint… · Present this in Experience · — · **Erase**.
   - Object: Face this · Section through here · Paint… · Duplicate · Present this in Experience · — · **Erase**.
   - Room: Unroll the room · Section through here · Paint floor… · Present this in Experience · — · **Erase**.
   Unimplemented items are rendered disabled with a quiet `Soon` cue and are not focus traps; Erase is real and is the only home of delete. Duplicate/My Objects keep their one existing home if already implemented.

**Numbers to foresee** (so the grid layout is designed for them, not to build now):

| Subject | Primary | More · Dimensions (future) | More · Relations |
| --- | --- | --- | --- |
| Wall | Length, Height | Base, Top, Thick, offset to neighbour, face area, angle to neighbour (relative) | Bounds Room(s), Openings hosted, joined to |
| Opening | Width, Height | Sill, head, offset from Wall end, reveal depth | Host Wall, Room(s) it connects |
| Object | Width, Depth, Height | Elevation above support, uniform scale | On Room / Free (membership control) |
| Room | Area | Ceiling height, perimeter, floor level, volume | Bounding Walls, Openings, objects inside |

**Acceptance:** Wall Card shows Length/Height; More reveals Base/Top (disabled `—`), Thick (editable, one history entry) and Relations; `•••` shows grouped functions with disabled placeholders and Erase last; no Thickness/Delete in `•••`; no duplicate homes.

## 5. Double-click rename for Walls, Rooms and objects

**Verified constraint:** Wall and Opening already rename through an existing writer. The persisted formats already carry names: Layout Room records include `name` (`layout-wall-first-codec.ts` `ROOM_KEYS`) and Scene entities carry `name` (`SceneEntityBase` in `project-model/src/scene.ts`). What is missing is a contributed rename operation for Rooms, Scene objects and native forms; pass 1 correctly refused a fake session-only name.

**Solution:**

- Add a Room rename planner in Layout (T1) and a Scene entity rename planner (T2, covering catalogue/primitive objects and native forms) on the existing F4 transaction path, each one history entry, validated (trimmed, non-empty, length-bounded). No new persisted field and no format bump, since the fields exist.
- The Card title uses the same inline editor for every subject (pass-1 §4 mechanics: double-click, Enter, Escape, blur cancels, F2/Enter on focus, touch).
- Also accept double-click on the Index row title (same writer). Double-click on a 2D Room label renaming in place is shown as an option in the sheet; it is not part of this pass unless the owner picks it.
- Name consumers update: Card, Index, Room labels, Find.

**Acceptance:** rename a Room, a catalogue object, a primitive and a native form by double-click; save, reopen, Undo/Redo; blank name refused with the prior name kept.

## 6. Gizmo redesign — one friendly glyph set

**Complaint:** the pass-1 black instrument ink on Paper looks off (images 9–12): thin black strokes, a rotation ring with two arrowheads facing each other, black disc knobs with white rings, a ring that stays still while the object turns, and a blue focus ring on the W·H·D chip after a click. The owner moved away from industrial RGB gizmos and designed white glyphs for a green board; Paper is now cream/white to match the 2D plan, so white glyphs lose contrast.

**Glyph set (shape = meaning):**

| Glyph | Meaning | Replaces |
| --- | --- | --- |
| Solid chunky arrow on a short dashed stem | Drag this face/edge this way (W, D, Wall thickness, height ray) | Thin open arrowheads |
| Four-way chunky cross at the base | Move on the support | Thin dashed cross |
| One curved arrow on the ring | Turn; drag anywhere on the ring | Two facing arrowheads |
| Stem with hexagon knobs, base to top | Top knob: move the top (height). Bottom knob (objects): lift off the support | Black disc + arrow |
| Small disc knob | A point you drag: Wall end, joint | Black disc with white ring |
| Rounded chip with a diagonal two-way icon | Click: W·D·H mode. Drag: uniform scale | Same chip, restyled |
| Thin solid ellipse | The rotation ring itself | Black dashed ring |

**Rotation follows the object.** The ring's arrow glyph sits at a fixed angle in the object's local frame, so during a turn the candidate rotates and the arrow travels with it; the ring stays centred on the manipulation origin. The tag reads `Δθ +15°` from a zero baseline (pass-1 rule).

**Making glyphs stand out on Paper — options on record (chosen: B):**

| Option | Treatment | Strength / risk |
| --- | --- | --- |
| A · White + halo | Pass-1/wireframe white glyph with a dark hairline halo | Familiar; on cream Paper the halo does all the work and reads grey |
| **B · Sticker (chosen)** | White filled glyph, fine ink keyline (~1.2 px), small soft shadow | Holds on cream Paper, on gold selection and on dark materials with one treatment; friendly, tactile; still white-led |
| C · Soft shadow (Tiny Glade) | White filled glyph, no keyline, warm soft drop shadow | The most elegant on mid-tone 3D materials; weakest on pale Paper unless Paper is deepened |
| D · Ink | Ink-filled glyph with white keyline | Maximum contrast on Paper; heavy, closest to what the owner disliked |

Selection stays gold; hover stays leaf. Glyph lines (ring, stems) use ink with a hairline white halo so they also hold on dark materials.

**W·D·H chip, two jobs.** A click (pointer up within ~4 px of the press) toggles W·D·H mode; pressed = ink-filled chip with a white icon. A drag from the chip scales the object uniformly about its base: the factor follows the pointer's distance from the object's centre, snaps to 0.05, shows a dashed candidate and the tag `× 1.25`, and commits through the existing uniform-scale operation (`resize-on-floor`) as one history entry. A scale drag never toggles the mode. Native forms, which are sized per axis and refuse a uniform entity scale, use their face arrows instead; the chip still toggles but does not scale them. Keyboard: Enter/Space toggles; scale stays available through the Card. Use `:focus-visible` with the shell focus ring; never the browser's blue ring after a pointer click. Pass-1 lifetime rules (session intent, survives selection and view switches) stay.

**Height stem.** The stem stands beside the subject (objects: beyond the right-most corner; Walls: beyond the free end) and spans its base to its top, so its length *is* the height. Knobs are hexagons; the top one is slightly larger.

- **Top knob** moves the top; the base stays. It uses the existing height writers: Wall height, native-form per-axis size. Uniform-only catalogue/primitive objects have no independent height, so they get no top knob; their size path is the chip drag.
- **Bottom knob (objects only)** lifts the object off its support with its height kept (★ A); the Card's Elevation follows. A lifted object leaves a dashed footprint on its support. Alternative B (move the base only, top fixed) stays on record; it is not built.
- **Object lift — built in round 2 (Scene, T2).** No new persisted field: world Y already persists. A new `lift` operation sets the object's offset above its resolved support, one history entry, refusing a negative offset. Rules:
  - **Moving a lifted object keeps its lift.** Move/resize preserve the offset above the support beneath the destination, generalizing today's "keep the resting elevation" rule; a destination with no support refuses as it does now.
  - **Room grouping:** a lifted object's reference support is the floor directly beneath it, so Auto keeps it in that Room. This extends the pass-1 Auto rule from "support contact" to "the support it rests on or is lifted from"; ambiguity still leaves it Free.
  - Lift 0 is ordinary resting; nothing distinguishes it in the file.
- **Walls do not change.** Layout has no authored Wall base (saved Wall fields: id, junctions, thickness, height, centerline, name). Walls get the top knob only; there is no Wall bottom knob, and the Card keeps Base as a placeholder. Wall Base is a separate future Layout capability (format bump plus architecture-compiler work).

**Knobs:** Wall ends and joints use the small disc knob; height and lift use the stem's hexagons. No disc under an arrow (pass-1 rule kept). Hit areas stay invisible and ≥ 22 px.

**Acceptance:** sticker glyphs throughout; one ring arrow that travels with the turn; chip click toggles and chip drag scales with one Undo; top knob changes height with the base fixed; bottom knob (where admitted) lifts with height kept and a dashed footprint left on the support; no black disc knobs; no blue click focus ring; all handles keyboard/touch reachable as before.

## 7. Gear: Room labels and Paper by view

**Complaint:** 3D Rooms show name and area (images 10–11); the owner doesn't want that in 3D. Follow-up: Paper tone becomes a per-view reference choice in the gear.

**Solution:** the gear panel (light Card family, pass-1 §5) holds view preferences only — per viewer, not authored, not in the project document, never in Save.

- **Room labels:** two switches, **In 2D** (default on) and **In 3D** (default off). Labels show name and area together. Pass-1 decluttering and placement are unchanged.
- **Paper:** two rows, **2D plan** and **3D board**, each showing its current swatch and tone name. Activating a row opens a swatch tray *inside* the panel (the panel grows; one tray open at a time; the chevron turns): three large tiles of the reference tones with their grid, the current one ringed in ink. Choosing a tile applies it to that view at once; the tray stays open until its row is activated again or the panel closes. Defaults: Current for both. Keyboard: the row is a disclosure button; tiles are a pressed-state group reachable only while open.
- **Reference tones** (exact values in the sheet): Current `#e9ece6`, Warm cream `#f3eee2`, Deeper sage `#d9dfd4`, each with its own grid ink. They map onto the existing Paper role tokens; Paper stays Paper (black ink, gold selection) in every tone.

**Acceptance:** fresh session: 2D shows `Room 3 · 24.1 m²`, 3D shows nothing; each switch works independently; each view's Paper changes independently through its tray; geometry and Save are unaffected; preferences survive reload only as per-viewer conveniences.

## 8. Implementation sequence and source map

Implementation requires the owner's release of this plan. Recovery verification contract applies; inspection entry points, not a scope limit:

| Order | Work / principal existing owners |
| --- | --- |
| 1 | Draft ink, snap end shapes, dashed candidates, refused-chain bug and red dashed refusal: `StageOverlay.svelte` (candidate/snap/problem rendering), the Layout adapter's draft candidate projection, Scene candidate renderers. |
| 2 | Sticker glyph set, ring that follows rotation, knobs, two-knob stem, chip click/drag (uniform scale through `resize-on-floor`) and focus ring: `stage-handles.ts`, `StageOverlay.svelte` mark rendering, `scene.adapter.ts`, `shell-roles.css` (new glyph roles). |
| 2b | Object lift (Scene, T2): `lift` operation and the generalized offset-preserving move/resize in `scene-planning/operations.ts` / `support.ts`, the Auto grouping rule in the Index support projection, and the object bottom knob plus Card Elevation field. Walls unchanged. |
| 3 | Card More/`•••` restructure and placeholders: `EditorCard.svelte`, `LayoutCardFields.svelte`, `SceneObjectCardFields.svelte`, `FormCardFields.svelte`. |
| 4 | Rename capability: Layout Room rename planner (T1), Scene entity rename planner (T2/T5 forms), wiring into the Card title and Index rows: `EditorIndex.svelte`, `world-index-model.ts`. |
| 5 | Gear view preferences — Room labels per view and the per-view Paper swatch tray: `StageDraftingControl.svelte` (gear), `room-labels.ts`, `StagePaper.svelte` / `StageMatGround.svelte`, `shell-roles.css` (Paper tone tokens). |
| 6 | Functional verification; record results below; deliver for owner inspection. |

Domain rules unchanged: no new persisted fields, no second writer, F4 history, Camera and visitor isolation intact. View preferences never enter the project document.

## 9. Verification and acceptance record

**Planning verification:** documentation gates (`npx vitest run --config vitest.arch.config.ts tests/docs` from the editor workspace). The interaction sheet is a standalone HTML proposal; it is not product code and is not covered by editor lanes.

**Implementation verification required:** exhaustive functional tier (`npm run check`, `npm run build`, `npm test`, plus `check:layout-core` / `check:project-model` for the rename planners). Cover: snap-shape selection; refused chain keeps placed segments; one dashed candidate per changed Wall; ring arrow follows rotation and zero-based Δθ; resize chip lifetime and focus-visible; More expansion, disabled placeholders, Thick writer, Relations activation, `•••` grouping and single Erase home; Room/object/form rename with save/reopen and Undo; chip click vs drag, uniform scale Undo and native-form refusal; top knob height with fixed base; object lift (one Undo, move keeps lift, lifted object stays grouped in the Room beneath, save/reopen); no Wall bottom knob; Room label and Paper preferences per view, absent from Save.

| Item | State |
| --- | --- |
| Review and interview decisions | Accepted by owner 2026-11-02; folded above. |
| Documentation checks | Passed 2026-11-02: editor `tests/docs` (2 files, 56 tests); `git diff --check` clean. The sheet's interactions were exercised in the in-app browser with no console errors. |
| Follow-up decisions | Accepted by owner 2026-11-02: glyph style B chosen; height stem with object-only lift built in round 2, Walls unchanged; chip click/drag; per-view Paper tray in the gear; ★ options adopted for implementation. |
| Implementation | Released by owner 2026-11-02 and implemented (uncommitted). Draft ink and snap-shape end marks; one dashed centreline candidate per changed Wall; refused chain keeps its placed legs and the refusal is red dashed with its reason tag (the "!" marker is retired); sticker glyph set with SVG path scaling (no `scale()` transform); one turn arrow that follows yaw; W·D·H chip as a click-toggle and a drag for uniform scale; Height as the stem's top knob (objects' forms and Walls, Wall knob just past the free end); object lift (`set-lift`, lift-preserving move/place/resize/duplicate, Auto grouping by the floor beneath, Card Elevation field); Card More expansion (Base/Top disabled `—`, Thick, Relations) and `•••` functions with disabled `Soon` items and Erase as the one delete home; rename by double-click for Walls, Openings, Rooms (`layout-entity-name` now covers Rooms) and every Scene entity (`set-name`), including from an Index row; gear Room labels (In 2D on, In 3D off) and per-view Paper tray (2D clear colour, 3D board plate), stored as browser preferences only. |
| Implementation verification | Passed 2026-11-02: `npm run check` (0 errors), `npm run build`, `npm test` (271 files, 3515 tests), `check:layout-core`, `check:project-model`, editor `tests/docs` (56 tests). New coverage: set-lift/set-name planners, lift-preserving move and duplicate, chip drag scale and chip click (no write), lift knob commit, Room rename (trim, blank refused), Card More/`•••` on the mounted route, view preferences round trip. In-app browser: gear Room label switches and Paper tray applied live (3D board tone change observed), draft ink clean black. |
| Scene object unification (follow-up, 2026-11-02) | Models, primitives and drawn forms are one Scene object in the editor: one Card writer (`SceneObjectCardFields.svelte`, `object-card.ts`), one action set (Duplicate, Delete) and one mark builder and gesture path (`object-marks.ts`, `scene.adapter.ts`). Sizing is the one kind-specific capability: a uniform chip scale for models and primitives, per-axis Width/Height/Depth rays and fields for forms (`form-size.ts`); Save to My Objects is form-only. The separate form Card (`FormCardFields*.svelte`, `form-card.ts`) and form gesture path were removed; a test pins one Card, action set and shared mark vocabulary for every kind. |
| Known gaps for owner review | Forms now have the Elevation field and lift knob through the shared object Card and marks. A Wall height drag shows a dashed sheet ghost (follow-up); it was not observed in the browser. Relations shows only facts adapters already publish; Wall → bounding Room is not yet a published fact. Room Card has no Ceiling height placeholder. Paper tones change the ground colour only; each tone's own grid ink is not applied. Save/reopen of renamed and lifted subjects was not exercised in the browser (planner and acceptance tests cover the writes). |
| Owner World visual/UX acceptance | Pending. |

### Reconciliation after owner visual acceptance

When the owner settles the sheet and accepts the round-2 implementation, promote the sheet as the World visual-language authority: move it under `docs/reference/design-system/` with its options record intact, route it from the [shell contract](../../../reference/design-system/editor-shell-and-visual-system.md) and the [spatial instrument grammar](../../../reference/design-system/spatial-instrument-grammar.md), and update only their affected owning sections (sticker glyphs, two-knob stem, chip scale, dashed ghosts, red-dashed refusal widening the Eraser entry, snap-shape end marks, per-view Paper). Leave this plan and its image evidence as the historical record. Promotion needs the owner's explicit statement; a passing suite is not acceptance.

## Supplied image evidence

Byte-for-byte copies of the owner's attachments, in submission order.

| Images | Evidence |
| --- | --- |
| [1](./review-pass-2-images/image-01.png) | Production 2D drawing: gold snap cross at the line end. |
| [2](./review-pass-2-images/image-02.png) | Production 2D endpoint drag: double dotted thickness candidates, black knobs. |
| [3](./review-pass-2-images/image-03.png), [4](./review-pass-2-images/image-04.png) | Production 3D chain drawing: refused segment hides the placed segments, `!` marker, truncated text; normal chain for comparison. |
| [5](./review-pass-2-images/image-05.png), [8](./review-pass-2-images/image-08.png) | Wireframe Card with inline More (Base/Top/Thick, Relations) and its `•••` function menu. |
| [6](./review-pass-2-images/image-06.png), [7](./review-pass-2-images/image-07.png) | Production Card and its `•••` panel holding Thickness and Delete. |
| [9](./review-pass-2-images/image-09.png), [12](./review-pass-2-images/image-12.webp) | Production object gizmo: black ring with facing arrowheads that stay put while the object turns, W·H·D chip with blue focus ring after a click. |
| [10](./review-pass-2-images/image-10.png), [11](./review-pass-2-images/image-11.png) | Production 3D Walls: black disc knobs; Room name/area labels in 3D. |
| [13](./review-pass-2-images/image-13.webp)–[17](./review-pass-2-images/image-17.webp) | External Tiny Glade references for control feel: white chunky glyphs, hexagon height stem, single curved turn arrow, face arrows. |
