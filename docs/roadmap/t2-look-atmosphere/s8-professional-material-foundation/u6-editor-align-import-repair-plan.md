# T2.S8 U6 · Material editor, Align, import and repair

**Status** Plan for review. Implementation has not started. Base: `main` at `693bbb3f4`, which includes the
U1–U5 parity recovery ([#408](https://github.com/Biskiq/spatial-sketch-editor/pull/408)).

**Goal** Deliver U6 with full visual, interaction and functional parity with the approved
[#399](https://github.com/Biskiq/spatial-sketch-editor/pull/399) Appearance design. U6 covers four things:
- the complete Material editor and its entry from the Finish Card;
- Align on wall and floor;
- the Import sheet;
- Repair.

Parity, subject only to the [approved deviations](#authority-and-resolved-conflicts), is a same-PR acceptance requirement. Passing functional tests alone does not accept U6, and no known U6 gap moves to a later recovery PR.

**Authorities, in order:**
1. The latest explicit owner rulings, including the #408 Index decision and the
   [2026-11-22 implementation rules](./implementation-plan.md#owner-rulings-on-the-u-design-2026-11-22).
2. The approved design: the [decision sheet](../../../../prototypes/appearance-ux/index.html), the
   [runnable prototype](../../../../prototypes/appearance-ux/app.html) and the
   [responsive board](../../../../prototypes/appearance-ux/board.html).
3. Shell guidance, where it is compatible.
4. Production conventions.

Architectural and ownership contracts stay authoritative throughout: the AGENTS hard rules, E4, E5, E7, contract C and Camera. The
[U5 recovery plan](./u5-library-recovery-plan.md) set the boundary: U6 extends the U5 editor in place.

## Delivery boundary

**U6 owns:**
- the Finish Card items that lead into or belong to the exact editor (foot, ⋯ menu, Pattern link, diagnostic strip);
- the Material editor in two modes on one surface:
  - **Finish mode** edits an accepted Finish from the Card;
  - **draft mode** is the U5 Library *Customise…* draft, with every field connected;
- Align on wall and floor;
- the Import sheet on E5;
- in-session Repair and the cold-load repair entry.

**Outside U6:**
- *Save to My library* and the My library source (U7; the button stays visible and unavailable);
- Layers, masks and brush;
- any Index change;
- phone widths;
- a general Shell redesign;
- the prototype's validation scaffolding: Tasks drawer, *Set up* presets and the *Preset · not saved* badge.

Two contract details sit outside the Appearance UI. Neither is a new capability; both serve prototype behaviour that production cannot express today:
- the camera-core `fit` correction under [Align](#align);
- the *patched copy* payload on the two assign commands, under [Ownership and seams](#ownership-and-seams).

## Authority and resolved conflicts

| # | Conflict | Resolution | Authority |
| --- | --- | --- | --- |
| C1 | The decision sheet and prototype show a *Layers · future* section with a disabled *Add layer*. The 2026-11-22 rules forbid visible placeholders for future features. | **Approved deviation:** omit Layers. The right column ends after Mapping. | 1 over 2 |
| C2 | The prototype's sheen positions come from `finish.js` STEPS (0.9 / 0.55 / 0.2). The accepted rule says "sheen targets per material family". Production reads Matte 0.8 / Satin 0.5 / Gloss 0.2 within 0.05, and anything else as *Custom*. | **Approved deviation:** the production table sets the slider ticks and the Card steps. The never-rougher-than-capture floor stays. | 1 over 2 |
| C3 | Production's Card has a *More* disclosure (Roughness, Metal, Tile size, Direction). The prototype Card has none. D8 splits the quick Card from the exact editor. | Remove *More*. Its values become editor fields. The Card keeps Pattern −, + and ↻ 90° and gains the Align link. | 2 over 4 |
| C4 | The prototype's *Save to My library* works. #408 and the U5 plan keep it visible but unavailable until U7. | Show it visible and disabled, with an inline reason, in the Card foot and the draft foot. | 1 |
| C5 | Repair dots in the Index | None. The owner ruled that U leaves the Index unchanged, and the prototype's comment agrees. | 1 |
| C6 | Typography: the prototype uses `system-ui` and `ui-monospace`. Production uses the Instrument Sans and DM Mono tokens, accepted in #408. | Use the production font families. Sizes, weights, case and mono usage follow the prototype (see the [spec](#visual-acceptance-spec)). | 4 for family, 2 for the rest |
| C7 | *Needs repair* is amber in the design (`--amber` #b7791f). The editor host runs `data-shell="living-draft"`, where `--shell-caution` resolves to `--ld-caution` #a9631f and `--shell-caution-bg` to #f8ecd9. Only the `:root` fallback is #c85a48. | DOM inks use `--shell-caution` and `--shell-caution-bg` as they are. The Stage hatch has no paint role (`design/spatial-paint.ts` holds the only Three-side inks): **remaining decision [R1](#remaining-decisions)**. | 1 over 2 |
| C8 | Opening a project with a broken image: the prototype opens the project with hatched surfaces. Contract C refuses the load before install. | **Remaining decision [R2](#remaining-decisions).** Reversible default: keep C, and give the boot panel an exact-byte repair action. | Contract |
| C9 | Coarse pointer | Hit targets are 44 px (prototype CHECKS, `--shell-touch-target`). The visible chrome follows the prototype. | 2 and 4 agree |
| C10 | The 860–1100 px Index lane. At ≤ 1099 px the prototype's Index is an overlay, and Align and the editor span beneath it. | **Approved deviation:** the #408 rule extends to the Finish-mode editor, Align and the Import sheet, which take the lane beside the open Index. | 1 over 2 |
| C11 | Align as a separate panel: the prototype simulates the faced view inside a panel. Its own comment names Camera `face`, "not a second camera". | Align uses the live Stage through Camera, with the panel's chrome around it. | Contract and 2 |
| C12 | Align keys: the prototype commits on every keydown. The 2026-11-22 undo rule says a held arrow key previews and commits once on release. | **Approved deviation:** one commit per key release. A held-key burst is one undo. | 1 over 2 |
| C13 | Layout surfaces with no prototype state: room lids (ceilings) and region faces. The prototype's Layout targets are walls and floors only. | No new design: the Align link is not shown on lids or region faces. Their Pattern row keeps Size, −, + and ↻ 90°. A curved wall side refuses Align with one line in the Card. | 2 (no exploration) |

## Parity matrix

Classes:
- **Correct**: matches; keep it under regression.
- **Incomplete**: exists but differs.
- **Missing**: absent.
- **Conflicting**: production contradicts the design.

Prototype sources are under `prototypes/appearance-ux/app/`. Production paths are under `apps/editor/src/lib/` unless a row says otherwise.

### Finish Card entry

| Item | Prototype | Production today | Class | U6 resolution |
| --- | --- | --- | --- | --- |
| Foot *Edit material…* opens the editor on this Finish | `ui-card.js` surfaceFoot | Absent. The foot has ★ and ⋯ only (`authoring/look/FinishCardSection.svelte`) | Missing | Add it. It opens Finish mode for the Card target and reach. |
| Foot *Save to My library* | Present | Absent | Missing | Visible and disabled until U7 (C4) |
| Foot ★ favourite | Present | Present | Correct | Keep |
| *More* disclosure | None | Roughness, Metal checkbox, Tile size, Direction (`data-finish-more`) | Conflicting | Remove (C3) |
| Pattern *Align on wall… / Align on floor…* link | Layout targets only | Absent | Missing | Add it beneath Pattern on wall sides and room floors (C13). It enters [Align](#align). |
| ⋯ menu | Rename…, *Select all using this Finish (n)*, *Give this surface its own copy*, *Reset to original (n)*, *Remove unused* (disabled with a reason while it has users) | Rename… and Reset to original only | Incomplete | Add the three items:<br>• *Select all*: `selectFinishUsers`, with reach set to All; disabled when n < 2.<br>• *Own copy*: an assign command with an empty [patched copy](#ownership-and-seams) on the Card target, one undo, toast *This surface now has its own copy*; disabled when n < 2 or the Finish is curated. `scene-finish-patch` cannot do this today: `readPatchEdits` refuses an empty list as `invalid-value` (`finish-planners.ts` ~902), and `applyFinishPatch` would refuse it as `no-change`.<br>• *Remove unused*: shown disabled with its reason, because a Card's Finish always has users. |
| Diagnostic strip | `diagStrip`: title, text, mono file, channel actions, footnote | Absent | Missing | See [Repair](#repair) |
| Row anatomy: icon column; label ink and size; *Original* placement | Icons for Shared, Material, Colour, Sheen and Pattern. Labels at 12.5 px in secondary ink. | No icons. Labels at 11 px in pale grey. | Incomplete (U4 residual) | Restore the prototype anatomy inside the existing `EditorCard` host. U6 rebuilds the Card's lower half, so the new rows must sit in the approved anatomy. |
| Subject card *Needs repair* | A part row whose Finish has an open issue shows *Needs repair* in amber under its name (`ui-card.js` subject card) | Absent | Missing | From the issues service; `--shell-caution` ink |
| Card hosted in the Wall inspector (‹ back, Length and Height above) | Not modelled | Shell integration accepted with U4 | Correct (out of U6) | Keep |

### Material editor: frame

| Item | Prototype | Production today (`authoring/library/LibraryMaterialEditor.svelte`) | Class | U6 resolution |
| --- | --- | --- | --- | --- |
| Finish mode (from the Card) | `ui-editor.js` card wide | Absent. The editor opens only from a Library draft. | Missing | Same component, `mode: 'finish' \| 'draft'` |
| Placement, wide | 560 × to-tray, right inset 10, top 54. It replaces the Card. | 562 × 776, right inset 52, top 56. Draft only. | Incomplete | Right inset 10. The bottom stops 14 px above the tray or dock lane. |
| Head | ‹ *Finish* back, 40 px thumb, name, reach chip (*Applies to …* / *Applies to All n*, or *Draft*), × | Draft header only | Incomplete | Build the prototype head. The reach chip toggles the Card's reach when n > 1. |
| Two columns | Left 224 (preview and controls). Right 296, scrolling inside (`.ed-r`, overflow auto). | Columns present; the right column does not scroll independently | Incomplete | Scroll the right column only. The head and foot stay fixed. |
| Finish foot | *Same as the original material*, or *n changes from original · Reset all*. *Done* on the right. 39 px tall. | No Finish foot | Missing | Build it |
| Draft strip | *Draft · from X · n changes · nothing is written yet · Reset all* + *Previewing on X · click another surface to move it* | Target and no-write status (U5) | Correct (wording check) | Keep. Add the change count and Reset all. |
| Draft foot | Cancel · Save to My library (pushed right) · Use for Paint · Apply to X (primary) | Present (U5). Foot 73 px, buttons 32 px. | Incomplete | Foot 39 px with fine-pointer buttons at 26 px (44 px hit area on a coarse pointer) |
| Edited draft on any target | *Apply to X* and *Use for Paint* work for an edited draft on any target | Refused unless the target already wears the draft's Finish (`finish-authoring.svelte.ts` ~893, `library-draft.ts` ~87); *Use for Paint* is disabled once changed | Conflicting | The [patched copy](#ownership-and-seams) path. Remove both guards and the disabled Paint reason. |
| Hard-coded inks | Tokens | `#3157c8`, `#2a4aa8`, `#8a5a12`, `#8a3a12`; also `StageLibrary.svelte` `#8a3a12` and `#d98a3a` | Conflicting | Map them to tokens (see the [ink table](#inks-and-type)) |

### Material editor: preview column

| Item | Prototype | Production today (`authoring/library/FinishInspectionView.svelte`) | Class | U6 resolution |
| --- | --- | --- | --- | --- |
| Canvas | 224 square, radius 12, warm ground; `hover to probe` chip at bottom-left | E7 canvas, no probe | Incomplete | Size and chrome as the prototype |
| Shape | Sphere / Flat / Tile | Geometry segment present | Correct | Keep |
| Light | Studio / Grazing / *This World* + ↻ *Turn the light* | Studio / Grazing / World; no turn | Incomplete | Label *This World*. Add ↻: the steps are 0.4 rad, wrapping −1.2…1.2. |
| No world anchor | *This World* disabled with *Place it to see it in this room*; Studio and Grazing work (readiness rules) | World unavailable line | Incomplete | Disabled segment with that reason |
| Texture budget | A flat swatch and *Too many large textures open · Retry* (readiness rules) | E7 issue line | Incomplete | That line, with Retry calling `host.retry()` |
| View | Select: Lit, Colour, Relief, Roughness, Metal, Occlusion | Lit only (`display: 'lit'` is hard-coded) | Missing | Map to E7 `InspectionDisplay`: `'lit'`, `'unlit-color'` and `{ solo: role }` |
| Probe | Hover shows `#hex  L* n` of the displayed pixel; on Flat, also the metres across the sample (`ui-editor.js` pointermove) | Absent | Missing | Read the pixel from the view's own 2D canvas, which holds the displayed frame. Metres come from the sample-tile framing. `host.texel()` reads source channels, so it is not the probe. |
| Compare | *Compare with original* switch; split *Original \| Now* on one canvas with a 2 px white divider | Whole-frame toggle (sheen only) | Incomplete | Split composite (see [design](#preview-and-inspection)) |
| Light note | One line per light | Absent | Missing | Copy verbatim from `previewCol` |

### Material editor: raw material and exact finish

| Item | Prototype | Production today | Class | U6 resolution |
| --- | --- | --- | --- | --- |
| *RAW MATERIAL* header + material name | h6, 10 px mono uppercase | Present | Correct | Keep |
| Map rows | 28 px thumb, label (*Colour*, *Relief*, *Sheen · occlusion*), mono file, *View* link, switch | Rows with disabled switches; no View | Incomplete | The switch runs E4 `disable` or `reset` on every role the image serves (an ORM row is one patch). *View* sets View to that channel; pressed again, it returns to Lit. |
| No colour image | The Colour row reads *— · no colour image · plain material*, with no switch | n/a | Missing | Same row, from the effective recipe |
| Caption | *Captured at 1 m · CC0 source · curated* | Partial | Incomplete | From resolver provenance |
| Colour | Natural / Stained / Painted (plain Natural / Painted when the base has no stain), wheel (+), hex field (placeholder *material's own*), palette link and Unlink | U5 placeholder | Missing | Through the U3 coat port and E4 `color`; the wheel reuses the Card picker |
| Typed fields | Enter or blur commits; Escape reverts the field and does not close the editor | n/a | Missing | Same, per the 2026-11-22 undo rule |
| Sheen | Continuous slider (value = 1 − r), floor at the capture, ticks, original mark, readout `r 0.64 · ×1.00 on scan`, caption | Draft step only | Incomplete | E4 `roughness` factor; ticks per C2 |
| Metal | Slider 0–1, readout | Placeholder | Missing | E4 `metalness` |
| Relief | Slider 0–2, step 0.05; disabled *map off* | Placeholder | Missing | E4 `normalScale`. Disabled when no normal map is bound (E4 `normal-control-without-normal`). |
| Pattern | Size m (0.02–20), Angle °, Offset → m, Offset ↑ m; *Real size* note; *Align on …* link | Placeholder | Missing | E4 `mapping` (uv repeat, rotation, offset; or surface metric). The link closes the editor to the Card and opens Align. |
| Mapping | Model targets: UV set 0 / UV set 1 / Metres. Layout: read-only. | Placeholder | Missing | E4 `mapping` kind. A surface mapping on a model needs a metric basis; otherwise it refuses in place. |
| Changed field | Label darkens; faint original tick on the slider | Partial (sheen) | Incomplete | Every field |
| Field reset | Double-click the label or slider: one undo | Sheen step reset only | Incomplete | E4 `reset` per field group |
| Reset all | Foot or strip link: one undo | Absent | Missing | One patch resetting every changed field |
| Layers | Future placeholder | n/a | Deviation | Omitted (C1) |

### Align

| Item | Prototype (`ui-align.js`) | Production today | Class | U6 resolution |
| --- | --- | --- | --- | --- |
| Entry | Card or editor *Align on wall… / floor…* (Layout surfaces) | None. Card *More* has numeric Tile size and Direction. | Missing | Build it |
| Camera | Faced straight on through `face`, "not a second camera" | `wallFace` store with an A6 route port (`authoring/layout/wall-face-store.ts`). `wallFaceSide` picks the side toward the camera, and `wallFaceFrame` is a conservative frame, not an exact elevation. | Incomplete | Wall: face the Card target's own side. Floor: Plan reading + `fit` (see [design](#align)). |
| Frame | Bar: title, target and size, mono readout (offset → ↑, angle, repeat), Reset, *Put back* (primary). Note bar. Card stays at the right. | None | Missing | Build it in the Stage region |
| Ruler and grid | Left and bottom ruler: 0.1 m ticks, metre labels. Dashed repeat lines at tile boundaries. | None | Missing | Overlay from the surface's metric mapping frame, not the conservative face frame. View-only. |
| Handles | Square drags the offset (1 cm snap; Shift 1 mm). Round drags the rotation (15°; Alt for any angle). | None | Missing | Overlay handles. Preview while dragging; one E4 commit on release. |
| Keyboard | Square: arrows 0.01 m (Shift 0.1). Round: arrows ±15°. Each keydown commits. Esc = Put back. | None | Missing | One commit per key release; a held-key burst is one undo (C12) |
| Reset | No offset and no turn: one undo | None | Missing | One E4 `mapping` patch |
| Floor in Paper | n/a (the prototype has no Paper) | Paper hides Finishes in Plan | Conflicting | A view-only Living override while Align is active. The preference is never changed. |

### Import

| Item | Prototype (`ui-panels.js` importer) | Production today | Class | U6 resolution |
| --- | --- | --- | --- | --- |
| Entry | Library head *Import…* | None. E5 is used only by dev fixtures. | Missing | Library *Import…* opens the file picker. Dropping files on the open Library or sheet also works. |
| Sheet | Modal 940 wide; radius 16; head (icon, *IMPORT MATERIAL · DRAFT* mono kicker, *n files dropped*, ×); bottom sheet on portrait | None | Missing | Build it |
| Slow reading | After 300 ms the summary reads *Reading k of n…*; Esc cancels with nothing written (readiness rules) | None | Missing | From the session's read progress |
| Summary | *n files · Name · k things to check* (count in caution ink) + reading sentence | None | Missing | From the E5 `SetProposal` |
| Collision | Refusal box *Two files claim roughness. Choose one — nothing imports until you do.* with choices. Once chosen, an ok box names the choice with *Change*. | None | Missing | E5 `conflicts` (`material-authoring/types.ts`) → one `prepareDraft` edit per choice; *Change* reopens the choice |
| Normal | Generic name: *+Y up · OpenGL (proposed)* / *−Y · DirectX* + acknowledgement checkbox. Detected (clean set, `_gl`): ok box *Normal direction: OpenGL (+Y), from “_gl” in the file name.* with *Change*. | None | Missing | E5 acknowledgement requirement; the detected case comes from the proposal's normal convention evidence |
| Size and name | *PHYSICAL SIZE* 0.05–20 m per image; *NAME* 1–120 characters | None | Missing | Inline validation, line in place |
| Register on | Target list; a mixed-kind selection shows a kind segment and the two-step note. Nothing selected: *Nothing selected — it lands in This project; paint it from Materials.* | None | Missing | One kind per registration (E handoff limitation) |
| *Show files (n)* | Table: *File*, *Reads as* (role and note), state mark (ok, acknowledge, clash, skip) | None | Missing | From `fileFacts` and the proposal's role assignments |
| Previews | *DRAFT · FLAT SAMPLE · STUDIO*; *NORMAL TEST · LIGHT FROM ABOVE* | None | Missing | E7 with the draft subject (`createDraftTextureScope`) |
| Foot | Status (*Answer the k questions above to continue.* / *Ready. One undo removes the import and its assignments.*) · Cancel · *Import & apply to n*, or plain *Import* with no targets | None | Missing | `acceptDraft`; one undo |
| After accept | Sheet closes; focus moves to the first target's Card; toast *Name is on n surfaces · paint it on objects from Materials — same Finish*; the Finish joins recents | None | Missing | Same; recents through the existing creator-preference service. With no targets, focus returns to *Import…*. |

### Repair

| Item | Prototype (`main.js`, `ui-card.js`, `stage.js`) | Production today | Class | U6 resolution |
| --- | --- | --- | --- | --- |
| Head pill | *⚠ n to repair*; pressed state while the drawer is open; icon only at ≤ 900 px | None. Issues reach only a dev `console.warn` (`render/materials/scene-finish.ts`). | Missing | `EditorHead.svelte`; the count stays in the accessible name when the label hides |
| Drawer | *Appearance issues*: one card per issue (name, text, users, *Open its Card*); *Repaired (…)* after a fix | None | Missing | Build it. *Repaired* comes from a session-owned fix list (see [design](#repair)). |
| Card strip | Missing image: Relink…, Replace image…, Use colour instead. Model mismatch: Use UV set 0, Surface mapping. Footnote. | None | Missing | Channel actions (see [design](#repair)) |
| Stage hatch | Diagonal hatch on affected surfaces | None | Missing | Render-only layer |
| Cold-load image failure | Opens hatched | The whole load is refused (contract C); `repairAsset` has no UI | Conflicting | Default: keep C and add boot-panel repair (R2) |
| Index | No change | No change | Correct | Keep |

### Responsive, focus and cancellation

| Item | Prototype | Production today | Class | U6 resolution |
| --- | --- | --- | --- | --- |
| iPad portrait editor | Bottom sheet from y≈401 at 820 × 1180; **two columns** (preview 200; fields 580) | Sheet from 407 that collapses to **one column**; Compare sits beside the preview | Conflicting | Two columns down to 768 px wide |
| 1024 with the Index open | Editor beside the Index | Beside the Index (#408) | Correct | Keep. Align and Import follow the same lanes. |
| Escape order | picker › Library detail › Library › Align › editor › import › drawers › dropper › tray › draft | Library, draft and picker handled | Incomplete | Insert Align, editor (Finish mode), import and the issues drawer in this order (`authoring/stage/route/stage-keyboard.ts`). The Library can open over Align, so Escape closes the Library first. |
| Focus return | To the invoker | Library, draft and picker do this | Incomplete | Edit material… → editor → Done returns to *Edit material…*. Align → Put back returns to the Align link. Import → Cancel returns to *Import…*; an accepted import moves to the first target's Card. Drawer → *Open its Card* moves to the Card strip. |
| Slider keys | Arrows; a burst is one undo | n/a | Missing | Commit on key release (no timer) |

## Implementation design

### Ownership and seams

No new writer, evaluator or Camera path. Every commit is an existing F4 command; two of them gain one optional payload field.

| Concern | Owner (existing) | U6 change |
| --- | --- | --- |
| Finish edits (Card, editor, Align, repair) | `scene-finish-patch` through `finish-card.svelte.ts` (`edit`; the internal `schedulePreview` behind `previewColour` and `previewRoughness`) | The Card adapter exports one generic `preview(target, edits)` over `schedulePreview`. The editor facet reuses `edit` and `preview`. Field groups map to E4 fields as in the [matrix](#material-editor-raw-material-and-exact-finish). |
| Patched copy on targets (*Own copy*; an edited draft applied or painted where its Finish is not worn) | `scene-finish-assign` and `scene-surface-finish-assign` (`project-model/scene-planning/finish-planners.ts`) | **Tier 1 contract detail.** Both payloads gain an optional `copy: { edits: FinishPatchEdit[] }`. When present, the planner requires exactly one allocated Finish id and copies the source Finish (a curated ref becomes `base: { catalogue }`; a project ref keeps its base and overrides). It applies `applyFinishPatch`, where an empty list is a plain copy and the `no-change` check is skipped because the new id is the change, and assigns the new Finish to the named targets. All of this is one operation and one undo. The output is an ordinary project Finish, so the persisted format and every reader are unchanged. Without `copy`, both commands behave exactly as today. Rejected alternatives: `scene-finish-patch` refuses non-users by design (`invalid-target`, ~2103), and `scene-finish-register` vendors a digest-verified recipe, which would lose the curated base that *Original* and Reset read. |
| Library draft | `finish-authoring.svelte.ts` `libraryDraft`, `applyLibraryDraft`; `library-draft.ts` `libraryDraftPlan` | The draft holds a full `FinishPatchEdit[]` instead of a sheen step. Apply on a target that wears the draft's Finish stays one `scene-finish-patch` (U5 path, `base: { catalogue }` when materializing). Apply elsewhere is one assign with `copy`. Remove the "worn today" refusal and the `Select a surface wearing …` guard. |
| Editor state | New `authoring/look/finish-editor.svelte.ts`, created by `createFinishAuthoring` and exposed as `authoring.editor`, like `card` | Keeps the 1864-line adapter from growing. It owns mode, target, reach, view settings, field views and change count. It holds no Scene data. |
| Draft *Use for Paint* | `authoring/look/paint-pick.ts`, paint commands | New pick `{ kind: 'draft', ref, edits, name }`. An unchanged draft arms its Finish as today. The first paint of an edited draft commits one assign with `copy` on the painted targets, then re-arms as `{ kind: 'finish', key }` of the new Finish, so later strokes reuse it. |
| Preview | E7 `createInspectionHost` (`render/materials/inspection-host.ts`) | `InspectionRequest` gains an optional `lightTurnRadians` (rig yaw). `requestKey` appends it only when it is non-zero, so every existing key stays byte-identical. Display already exists. |
| Align camera | `wallFace` store (`standpoint`, `face`, `putBack` → `camera.restoreStandpoint`) and its route port; camera-core `requestViewingIntent` | The reading names a wall side or a floor. A wall face takes its side from the Card target's surface ref, never `wallFaceSide`. The port gains `frameFloor(bounds)`: Plan reading, then `fit`. Put back keeps the store's exact reversal. camera-core `fit` takes its extent from the declared endpoint. |
| Align overlay | New `authoring/stage/shell/StageFinishAlign.svelte` | View-only SVG over the Stage region. Ruler, grid and handles come from the surface's metric mapping frame (resolved by the existing surface-mapping code), projected through the faced camera. The conservative `wallFaceFrame` only frames the view. |
| Plan appearance during floor Align | The route getter `planAppearance` that feeds `StageCanvas`, and `paperVisible` (`routes/project/[projectId]/spatial/+page.svelte` ~2177, ~1263) | One derived effective value, `finishAlign?.surface === 'floor' ? 'shaded' : shell.preferences.planAppearance`, feeds both. The stored preference never changes. |
| Import | E5 `prepareDraft` and `acceptDraft` (`material-set.ts`), `importProjectImage` | New `authoring/library/material-import.svelte.ts` session and `MaterialImportSheet.svelte` |
| Issues | `inspectFinish` (`project-model/scene-planning/finish-inspect.ts`) | New `authoring/look/appearance-issues.svelte.ts`. It holds a derived list of `{ finishKey, issue, users }` per accepted revision, with target analysis from the existing model-facts preparation. It also holds a session-owned fix list of `{ finishKey, issue, action, revision }` for *Repaired (…)*: never serialized, cleared on project switch, and an entry is dropped when Undo brings its issue back. The renderer keeps its fallback and still warns in dev. |
| Hatch | Stage presentation layers | New `StageRepairLayer.svelte` beside `StageSelectionLayer.svelte`, drawn with the stage role mirrored in `stage-paint.ts` |
| Exact-byte repair | `platform/project-persistence.ts` `repairAsset` | Called from the Card strip and the boot panel |

### Material editor

**Finish mode.** *Edit material…* opens the editor on the Card target with the Card's reach. Each completed control is one E4 patch, committed on release as one undo. While a control is moving, the Card adapter's `preview` shows the change render-only. The reach chip and the Card's reach segment share one value. In *This side* on a shared Finish, the first edit forks through `edit-just-this`, as the Card does today, and later edits go in place on the copy. The original is the base recipe, through `baseRecipeOf`, never the state when the session opened. Field changes are computed against it, and Reset all writes one patch resetting every changed group. *Done*, × and Escape close back to the Card. Nothing is pending, because every release has already committed.

**Draft mode.** The editor keeps U5's no-write rule. Each field edits the draft's `FinishPatchEdit[]` and re-projects the render-only preview on the draft target. `applyLibraryDraft` checks the whole patch with `applyFinishPatch` before enabling *Apply to X*. A refusal stays as a line under the field. *Apply to X* and *Use for Paint* work on any qualified target: on a target that wears the draft's Finish, Apply is the U5 `scene-finish-patch`; on any other target, Apply and the first paint are one assign with `copy`. An unchanged draft keeps its #406 assignment behaviour.

**Field groups.** Sheen maps to `roughness`; the slider shows 1 − effective r, with its floor at the captured r. Metal maps to `metalness`. Relief maps to `normalScale`. Colour maps to `color` through the U3 coat port for Stained and Painted. Pattern and Mapping map to `mapping`. A raw-map switch runs `maps.<role>` `disable` or `reset` for each role its image serves. Group roles by image digest, so an ORM row toggles occlusion, roughness and metalness in one patch. E4 problems display in place as one line:
- `invalid-value` → the field's range sentence;
- `normal-control-without-normal` → *Relief needs its map*;
- `mapping-requires-metric-basis` → *This model has no metric basis; use a UV set*;
- `no-change` → nothing.

### Preview and inspection

`FinishInspectionView` gains `display`, `lightTurnRadians`, `compare` and `probe`. E7 keeps exactly one live request. For Compare, the view first renders the original subject and holds that frame for the current key (shape, light, turn, display, size). It then observes the draft or accepted subject. The canvas shows the left half of the original frame and the right half of the live frame. The *Original | Now* labels change only when both halves belong to the same key, extending #408's caption-tied-to-frame fix. A 2 px white line divides the halves. The probe reads the hovered pixel from the view's own 2D canvas, the frame the creator sees, and shows `#hex  L* n`, plus metres across the sample on Flat. Pointer leave restores *hover to probe*. `lightTurnRadians` rotates the Studio and Grazing rigs about +Y and the World sample's azimuth. At 0 the field is left out of the request key and the pixels are unchanged, so U1 thumbnails and the E7 references stay valid.

### Align

**Entry and exit.** The Align link appears on wall sides and room floors only (C13). Align captures the entry standpoint, closes an open editor to the Card and requests the face:
- **Wall:** the `wallFace` face of the Card target's own side, taken from its `wall-side` surface ref rather than the side toward the camera. A perspective view of a straight plane perpendicular to the view axis has uniform scale, so the ruler is exact. A curved wall side has no single faced plane: Align refuses with one line in the Card, *Align needs a straight wall · use Pattern size and ↻ 90°*, and nothing moves.
- **Floor:** `set-reading: 'plan'`, then `fit` on the floor bounds, both through the route port.

*Put back* and Escape call the store's `putBack`, which restores the captured entry state (reading, pose and FOV) through `camera.restoreStandpoint`. Leaving the target or switching context exits Align the same way. The Library may open over Align, as in the prototype's Escape order. Swap, Replace or Paint from it keep Align open on the same target, and Escape closes the Library first. A Camera refusal leaves Align open with one line in the bar.

**Camera-core correction (Tier 1).** `fit` currently derives its extent from `settled.reading`. During a Plan flip, that is still the reading being left, so a `fit` sent right after `set-reading` frames 3D extents. `requestViewingIntent` documents that intents during a flip apply to the declared endpoint. Make `fit` use `settled.transition?.to ?? settled.reading`. Add unit tests next to `camera-viewport-evaluation.test.ts` for both directions: a `fit` during 3D → Plan frames Plan extents, and one during Plan → 3D (including a face transition) frames 3D extents. No other Camera change.

**Overlay.** The Stage region becomes the faced view. The prototype's bar is above it, its note bar below, and the ruler padding is l 44, r 24, t 20, b 40. Ruler, grid and handles are placed from the surface's metric mapping frame, so a tick sits where the Finish's metre falls on the surface. Outside the faced surface's projected rectangle, the overlay draws the panel surface (`--shell-ivory`), so the surface reads alone as in the prototype. The Stage stays live underneath and the Card stays at the right. Ruler, grid, handles and the surround are DOM or SVG and are never serialized.

**Edits.** Dragging the square or the round handle previews through the Card adapter's `preview`. Release commits one E4 `mapping` patch:
- surface metric `offset` and `rotation` for Layout targets;
- offsets stored in E4's normalized form, displayed as metres (offset × tile size).

Snap is 1 cm, or 1 mm with Shift. Rotation is 15°, or free with Alt. Keyboard nudges preview on keydown and commit on key release (C12). Reset writes `rotation: 0` and `offset: [0, 0]` in one patch. Size stays the Card's control.

### Import

**Entry.** *Import…* in the Library head, or files dropped on the open Library, start a session. The session runs E5 proposal → correction → `prepareDraft` with the session's `AbortSignal` and keeps file bytes session-owned. Reading longer than 300 ms shows *Reading k of n…* in the summary. The sheet renders the proposal:
- **Conflicts** become the refusal box. Choosing applies a role edit; the box becomes an ok box naming the choice, with *Change*.
- **Generic normals** need the acknowledgement. A normal convention the proposal detects from the file name shows as an ok box with *Change*, which returns to the segment and clears the acknowledgement.
- **Size** defaults to 1 m when no size is given.
- **Name** is validated to 1–120 characters.
- **Register on** defaults to the qualified selection. A mixed Scene and Layout selection shows the kind segment and the two-step note.

**Accept.** *Import & apply to n* (plain *Import* with no targets) calls `acceptDraft` with the chosen targets. Success commits one undo, closes the sheet, focuses the first target's Card, shows the prototype toast and adds the Finish to recents. `aborted`, `stale-revision`, `target-pending`, `image-pin-mismatch` and `unresolved-role` keep the sheet open with one line in place. *stale-revision* re-proposes. Cancel, × and Escape abort the in-flight work. Ready uploads keep P20 retention.

### Repair

**Issues.** The issues service lists every accepted Finish with `inspectFinish` issues. Each record names the channel (`role`), the users and the corrective action.
- **Head pill:** shows the count.
- **Drawer:** groups issues by Finish. *Open its Card* focuses the first user and opens the Card strip. *Repaired (…)* lists the session's fix list.
- **Subject card:** a part row whose Finish has an open issue shows *Needs repair*.
- **Hatch layer:** draws on users that fail.

**Card strip actions.** Each action is one undo; the issue clears, and Undo restores it exactly.

| Issue | Action | Writer |
| --- | --- | --- |
| `missing-image`, `missing-pin` (image unavailable this session) | *Relink…* | Choose the original file, then `repairAsset` for an exact-byte match, then retry the image read |
| | *Replace image…* | The S4 replace path (`finish-image.svelte.ts`) |
| | *Use colour instead* | E4 `maps.color` `disable` plus the tint rule |
| `missing-uv` on a model target | *Use UV set 0* | E4 `mapping` uv set 0 |
| | *Surface mapping* | Offered only when a metric basis exists |
| `missing-normal-frame` | *Turn off relief* | E4 `maps.normal` `disable` |

A refused repair (wrong bytes 422, stale 409, inaccessible 404) leaves one line in the strip.

**Cold load.** Contract C still refuses an image failure before install (default for R2). The boot panel and the replacement notice gain *Repair with the original file…*. It calls `repairAsset(projectId, assetId, bytes, { expectedPin, savedBaseToken }, signal)` (`platform/project-persistence.ts` ~171), then retries the whole Load. The previous session stays open throughout.

### State transitions

```
Editor   closed ─Edit material…/Customise…→ open(finish|draft)
         open ─drag→ previewing ─release→ committed(finish) | drafted(draft) → open
         open(finish) ─Done/×/Esc→ closed (focus → invoker)
         open(draft)  ─Apply→ committed → Card · ─Use for Paint→ armed · ─Cancel/Esc→ closed (nothing written)
Align    idle ─link→ facing(entry standpoint, surface) ─drag/key→ previewing ─release/keyup→ committed → facing
         facing ─Reset→ committed → facing · ─Library→ facing (Library over it) · ─Put back/Esc/context change→ restoring → idle
         idle ─link on a curved wall side→ idle (line in the Card)
Import   closed ─files→ reading (k of n after 300 ms) → proposing ─proposal→ resolving(k blocking) ─k=0→ ready ─accept→ writing
         writing ─ok→ closed + toast + recents (focus → first target's Card) · ─refusal→ resolving (line in place) · ─stale→ proposing
         any ─Cancel/Esc→ aborting → closed (nothing written)
Repair   issue ─action→ writing ─ok→ cleared (Undo restores) · ─refusal→ issue (line in strip)
```

### Responsive behaviour

| Viewport | Editor | Align | Import |
| --- | --- | --- | --- |
| ≥ 1100 (1440 × 900) | 560 wide, right inset 10, replacing the Card | Stage region between the Index and the Card (prototype 856 × 612 at 266, 90) | Centred modal, 940 × ≤ 778 |
| 860–1100 with the Index (1024 × 768) | Beside the Index (#408 lane) | Between the Index and the Card | Centred, width = viewport − 2 × 12 |
| ≤ 860 or portrait (820 × 1180) | Bottom sheet from y≈401, two columns (preview 200) | Region left of the Card (prototype 492 wide); the bar wraps to two lines | Bottom sheet, radius 16 16 0 0, from y≈393 |

At ≤ 900 px the head's repair pill shows its icon only.

### Failure handling

| Failure | Behaviour |
| --- | --- |
| E4 refusal | One line in place under the control. The control returns to the accepted value. No write. |
| Stale target or reach at commit | The existing requalify-then-refuse rule, with a line in place |
| E7 request failure or unavailable World | The view's existing issue line. Compare and probe are disabled with a reason. |
| Camera intent rejected | Align does not open. The link shows a line. The standpoint is untouched. |
| Import refusal codes | See [Import](#import). No partial Finish. |
| Repair refusals | See [Repair](#repair). The old key and the session are preserved. |
| Context switch mid-flow | Editor, Align and Import close by their cancel paths and release previews and leases |

## Visual acceptance spec

The implementation PR must show prototype-versus-production pairs for every state below, at three viewports:
- **desktop** 1440 × 900, fine pointer;
- **narrow** 1024 × 768, Index open;
- **iPad portrait** 820 × 1180, coarse pointer.

**Reproducing the prototype.** Serve the repository root and open `prototypes/appearance-ux/app.html` with the query shown. The reference captures are in [`evidence/u6-plan/`](./evidence/u6-plan/). The current production captures in the same folder are the starting point.

**Tolerances:**
- control position ±4 px;
- control size ±2 px;
- type size ±0.5 px;
- colours exact to the mapped token;
- the same scroll owner, focus order and copy (sentence case except small mono metadata).

| State | Prototype query | Reference | What must match |
| --- | --- | --- | --- |
| Card, object | `?scene=walnut&focus=table:top&card=finish` | `desktop-card-finish-prototype.jpg` | Row icons, foot (★ · Save to My library · Edit material… · ⋯), no *More* |
| Card, wall + Align link | `?scene=walnut&focus=wall-n:a&card=finish` | `desktop-card-finish-wall-prototype.jpg`, `ipad-card-finish-prototype.jpg` | Pattern row: Real size, −, +, ↻ 90°, *Align on wall…* |
| Editor, object | `…&edit=table:top` | `{desktop,narrow,ipad}-editor-prototype.jpg` | Frame, head, columns, raw rows, Colour, Sheen, Metal, Relief, foot |
| Editor, wall | `?scene=walnut&focus=part:a&card=finish&edit=part:a` | `desktop-editor-wall-prototype.jpg` | Pattern fields + Align link; read-only Mapping |
| Compare | `…&edit=table:top&compare=1` | `desktop-editor-compare-prototype.jpg` | Split *Original \| Now* labels on the canvas |
| Grazing + Relief view | `…&light=grazing`, View = Relief | `desktop-editor-grazing-relief-prototype.jpg` | Solo normal display, light note |
| Changed fields | wall editor; Size 0.6, relief map off | `desktop-editor-changed-prototype.jpg` | Darkened labels, original ticks, *n changes from original · Reset all*, Relief *map off* |
| Scrolled | wall editor, right column at the end | `{desktop,ipad}-editor-scrolled-prototype.jpg` | Only the right column scrolls; Mapping is last (no Layers, C1) |
| Draft | `?scene=walnut&focus=wall-n:a&draft=wood-oak-veneer` | `{desktop,narrow,ipad}-draft-prototype.jpg` | Strip, draft chip, foot order |
| Align wall | `?scene=walnut&focus=part:a&align=part:a` | `{desktop,narrow,ipad}-align-wall-prototype.jpg` | Bar, ruler, grid, both handles, note, Card beside |
| Align floor | `?scene=walnut&focus=floor&align=floor` | `{desktop,narrow,ipad}-align-floor-prototype.jpg` | Plan, Finish visible in Paper preference, ruler |
| Import, ambiguous | `?scene=artist` | `{desktop,narrow,ipad}-import-messy-prototype.jpg` | Head, summary, refusal box, normal segment, ack, size, name, Register on, previews, disabled primary |
| Import, files | `?scene=artist`, open *Show files* | `desktop-import-messy-files-prototype.jpg` | Files table |
| Import, resolved | choose *ORM green channel*, tick ack | `desktop-import-messy-resolved-prototype.jpg` | Ready state, enabled *Import & apply to 3* |
| Import, clean | `?scene=walnut&focus=wall-n:a&import=clean` | `desktop-import-clean-prototype.jpg` | No blocking box; ready |
| Repair drawer | `?scene=repair` | `desktop-repair-drawer-prototype.jpg` | Pill pressed, drawer anatomy |
| Repair, image | drawer → first *Open its Card* | `{desktop,narrow,ipad}-repair-card-tile-prototype.jpg` | Strip anatomy, actions, hatch |
| Repair, model | drawer → second *Open its Card* | `desktop-repair-card-oak-prototype.jpg` | *Use UV set 0* / *Surface mapping* |
| Readiness states | Not in the prototype; the copy is in the [decision sheet's readiness rules](../../../../prototypes/appearance-ux/index.html#readiness) | No capture; copy only | Budget: flat swatch + *Too many large textures open · Retry*. No world anchor: *This World* disabled with *Place it to see it in this room*. Slow import: *Reading k of n…*. Each one line in place, using the matching inks. |

**Measured anatomy (prototype, desktop):**

| Element | Measure |
| --- | --- |
| Editor frame | 560 wide; head 56 (top 54 → 110); foot 39; *Done* 50 × 26, radius 7, forest on white |
| Preview | 224 × 224, radius 12. Segments 24 tall, pill radius. |
| Section heading | 10 px mono uppercase, secondary ink |
| Field label | 11.5 px |
| Raw row | 45 tall. Name 600 12 px. File 10.5 px mono, ellipsis. Switch 36 × 20. |
| Inputs | 24 tall, 12 px mono, radius 7 |
| Reach chip | 25 tall, pill, 11.5 px, padding 3 9 |
| Align | Bar 41 tall, white, 12 px. Note 46 tall, 11 px. Frame radius 14. |
| Import | Head 59; foot 51 (iPad 61). Refusal box radius 9, padding 8 10, 12 px. |
| Card strip | Radius 9, padding 8 10, 12 px; action pills 24 tall |
| Head pill | 28 tall, radius 8, 12 px, white on the needs-repair ink; forest when pressed |
| Drawer | 400 wide, full height below the head |
| iPad portrait | Editor sheet from y 401 with preview 200 and fields 580. Align panel 492 wide; bar 107 (wrapped). Import sheet from y 393, width 796. |

### Inks and type

| Prototype role | Token |
| --- | --- |
| Primary ink | `--shell-ink` |
| Secondary text (rgb 93 102 95) | `--shell-ink-2` |
| Primary button (rgb 18 38 29) | `--shell-action` / `--shell-on-action` |
| Pressed pill (rgb 45 94 72) | `--shell-forest-3` |
| Refusal box (bg rgb 248 233 225, ink rgb 122 50 30) | `--shell-refuse-bg` / `--shell-refuse` |
| *Will change* (reach, draft target) and the cobalt *Draft* chip | `--stage-proposal` (the DOM already uses it) |
| Selected | `--shell-gold` |
| Needs repair (`--amber`, `--amber-tint`): pill, *Needs repair* badge, summary count, diagnostic strip (`.diag`) | `--shell-caution` / `--shell-caution-bg` (amber #a9631f / #f8ecd9 under `living-draft`). The strip's border and title inks (#e6c888, #6b4a0a) map to the same pair. |
| Ok and repaired (`--moss`, `--moss-tint`, `--moss-ink`): import ok box, `.diag.fixed`, *Repaired* | `--shell-positive` / `--shell-positive-bg` |
| Stage hatch on affected surfaces | R1 (a Stage paint role) |
| Unavailable-image thumbnail (raw row, strip) | The existing Card missing-image treatment with `--shell-caution` ink; no new pattern |
| Align surround | `--shell-ivory` |
| Fonts | `--shell-sans`, `--shell-mono`; sizes from `--shell-text-*` where equal, otherwise the prototype value |

## Regression protection

**U1–U5 baseline.** Keep the existing suites green. Run editor vitest groups one at a time:
- `authoring/library/*`
- `authoring/look/finish-card`, `paint-pick`, `paint-tray-service`, `colour-coat-port`
- `stage-paint-tray*`, `stage-keyboard`, `stage-boot-states`, `spatial-route-viewport`
- `render/materials/inspection*`, `finish-tiles`
- `project-model/finish-planners`, `material-set-proposal`, `colour-coat`
- `design/presentation-tokens`
- visitor and public-surface boundary tests

**New focused tests:**

| Area | Test |
| --- | --- |
| Editor facet | Each field group emits the exact E4 patch. Release commits once. Double-click reset and Reset all are one patch each. Changed count matches against `baseRecipeOf`. The ORM switch is one patch. Refusals map to the line copy. |
| Draft | A full-field draft on a wearing target applies as one `scene-finish-patch` (materializing a curated base). The same draft on a non-wearing target applies as one assign with `copy`, and its recipe equals `applyFinishPatch(source, edits)`. An unchanged draft keeps #406 behaviour. Cancel writes nothing. *Use for Paint* on an edited draft creates one Finish on the first stroke and re-arms its key; the second stroke reuses it. |
| Card | No *More*. The foot items. The three ⋯ items' commands and disabled reasons. The Align link only on wall sides and room floors; a curved wall refuses with the line. |
| Patched copy | `finish-planners.test.ts`, for both assign commands: `copy` with edits creates one project Finish (base kept, overrides patched) on the named targets in one undo. `copy: { edits: [] }` copies a project Finish. A missing or extra allocation refuses. An inadmissible edit refuses with the E4 problem code. Without `copy`, the existing assign expectations are unchanged. |
| Inspection | `lightTurnRadians: 0`, or the field left out, keeps the request key and thumbnail key byte-identical. Compare holds one live request. The probe reads the displayed canvas and resets on leave. |
| camera-core | `fit` sent during a 3D → Plan flip frames Plan extents; `fit` sent during Plan → 3D and during a face transition frames 3D extents. Existing evaluation tests are unchanged. |
| Align | Snap and step math. One commit per release and per key release. Reset is one patch. Put back restores reading, pose and FOV. The wall face uses the Card target's side even when the camera starts on the other side. Floor Align leaves the stored `planAppearance` preference unchanged. The Library over Align closes first on Escape. |
| Import | Session over E5: slow-read progress, conflict choice and *Change*, detected and generic normals, acknowledgement, size and name validation, mixed-kind segment, no-target *Import*, each refusal code, abort on cancel, focus and recents after accept |
| Issues | Derivation from `inspectFinish`. Each action's writer and its Undo restoring the issue. The fix list feeds *Repaired*, drops an entry when Undo restores its issue, and clears on project switch. Boot-panel repair calls `repairAsset` with `{ expectedPin, savedBaseToken }`, then reloads. |
| Arch | Editor-only modules stay out of visitor and public chunks (`public-surface-boundary`) |

**Browser journeys.** These are focused manual browser QA under the
[editor test contract](../../../../apps/editor/tests/README.md#browser-qa-policy), at the three viewports, with comparison captures:
1. **Task 1:** Paint walnut, then Card → *Edit material…* → Sheen → Done; Undo.
2. **Task 2:** Import the messy set, resolve it, register on three wall faces; then Card → *Edit material…* → Grazing, Compare, View Relief; Partition Side A → *This side* → Pattern 0.6 m or *Align on wall…*; Undo each.
3. **Floor Align** in the Paper preference; Put back restores the view and Paper.
4. **Task 4:** Repair a missing image (Relink, Replace, Use colour instead) and a UV mismatch. The hatch clears, and Undo restores it exactly.
5. **Cold load** with a corrupted pin; boot-panel repair, then Load.
6. **U1–U5 recheck:**
   - Library browse and detail, Customise draft retarget and Apply;
   - Paint picker and tray;
   - Swap, Replace and Shift keep-open;
   - Escape order and focus return across every new layer.

Full Playwright capture remains owner-authorized only.

## Execution plan

This is one Tier 1 PR. It touches the shared shell surface, plus two contract details that every existing reader still satisfies: the camera-core `fit` fix and the optional patched-copy payload. The steps run in order. Each one ends green on its focused tests.

| Step | Work | Depends on | Acceptance | Stop if |
| --- | --- | --- | --- | --- |
| 0 | Root-cause the #408 departure: Oak reads as flat grey on Stage walls. It reproduces on `main` with no material issue logged. Align and the Card need a legible wall pattern. | — | Cause identified. Fixed if it lies in the Finish projection. | The cause is in World lighting or the renderer → report to the owner before step 5 |
| 1 | Tokens: replace hard-coded inks with the [ink table](#inks-and-type); the Stage hatch role as R1 is ruled | — | Token test green | — |
| 2 | Patched-copy payload on both assign commands; editor facet and Finish mode: Card foot, *More* removal, ⋯ items, subject-card badge slot, Card anatomy | 1 | Planner, editor and Card tests; desktop pairs for Card and editor | An E4 field cannot express a prototype control, or the copy payload needs a persisted-format change → escalate (Tier 2) |
| 3 | Preview: display, probe, turn, split compare, readiness lines | 2 | Inspection tests; Compare and Relief pairs | A turned rig changes the turn-0 pixels |
| 4 | Draft mode on every field; Apply and *Use for Paint* on any target | 2, 3 | Draft and paint-pick tests; draft pairs | — |
| 5 | Camera-core `fit` fix + Align wall and floor | 0, 2 | Camera and Align tests; Align pairs at three viewports | The fix changes an existing evaluation expectation |
| 6 | Import sheet on E5 | 1, 3 | Import tests; four import pairs | E5 needs a contract change |
| 7 | Issues service, pill, drawer, strip, hatch, boot-panel repair | 2 | Issues tests; repair pairs | R2 is ruled the other way → re-plan the cold-load part only |
| 8 | Responsive: iPad two-column sheet, 1024 lanes, Escape order, focus return | 2–7 | Every pair at the three viewports; keyboard journey | — |
| 9 | Full journeys, the complete merge gate, PR evidence table | 1–8 | Every spec row paired, with deviations C1–C13 listed | Any unpaired row |

## Remaining decisions

| # | Decision | Reversible default |
| --- | --- | --- |
| R1 | The Stage hatch ink. The DOM uses `--shell-caution` as is (C7), but Three-side inks come only from the `design/spatial-paint.ts` role map, which has no caution role. Either add a `repair` role whose value is the existing living-draft caution #a9631f (a new role name, no new colour), or draw the hatch with an existing Stage role. The 2026-11-22 rule allows no new colour tokens beyond D12, so this needs an owner ruling. | Add the `repair` role at #a9631f, mirrored as `--stage-repair: var(--ld-caution)`. Reverting is a one-role edit. |
| R2 | Cold open with a broken image. Keep contract C (refuse, then repair from the boot panel), or adopt the prototype's hatched open, which would change C. | Keep C |

## Integration risks

- **Wall pattern legibility (step 0).** The #408 grey-wall departure blocks Align parity until it is resolved.
- **Adapter growth.** The editor facet lives in its own module. `finish-authoring.svelte.ts` only wires it.
- **Patched copy.** The one planner change that writes. It is additive and optional, and its output is an ordinary Finish, but it serves three entry points (*Own copy*, draft Apply elsewhere, draft first paint). Each gets a planner test.
- **Draft Paint pick.** A new pick kind crosses the paint path, and the first stroke creates a Finish that later strokes must reuse. Cover it with paint-pick and tray tests.
- **Camera timing.** Floor Align relies on the `fit` correction. Wall Align relies on the face port plus an explicit side.
- **Align frame accuracy.** The ruler must come from the surface's metric mapping frame, not from `wallFaceFrame`, or ticks drift from the pattern.
- **E5 wiring and P20 IO.** First product use of E5. Mostly covered by the existing proposal tests; cancellation and stale-revision get session tests.
- **One live E7 request.** Split compare draws sequentially. A slow original frame delays the labels, by design.
- **iPad sheet layout.** The sheet is restructured; check it at 768 and 820 portrait widths.

## Recommended implementation

Assign one implementer with high effort, preferably the strongest available model. The work crosses the Finish adapter, E7, Camera and the Stage route, and it is judged on rendered parity. Plan about 9 focused steps in one PR. Use a fresh-context reviewer at Tier 1. The owner checks the paired evidence before merge.
