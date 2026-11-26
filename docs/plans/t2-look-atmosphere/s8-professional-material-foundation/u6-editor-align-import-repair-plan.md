# T2.S8 U6 · Material editor, Align, import and repair

**Status** In-flight pre-PR6 plan grandfathered in `docs/plans/` until U6 merges (delete on merge; new single-PR plans live on their GitHub PR). Implementation has not started. Base: `main` at `693bbb3f4`, which includes the
U1–U5 parity recovery ([#408](https://github.com/Biskiq/spatial-sketch-editor/pull/408)). The owner ruled on R1 and R2 on
2026-11-23 (see [Owner rulings](#owner-rulings-2026-11-23)), so no decision remains open. #408 is the accepted baseline, and U6 must not regress it.

**Goal** Deliver U6 with full visual, interaction and functional parity with the approved
[#399](https://github.com/Biskiq/spatial-sketch-editor/pull/399) Appearance design. U6 covers four things:
- the complete Material editor and its entry from the Finish Card;
- Align on wall and floor;
- the Import sheet;
- Repair.

Parity, subject only to the [approved deviations](#authority-and-resolved-conflicts), is a same-PR acceptance requirement. Passing functional tests alone does not accept U6, and no known U6 gap moves to a later recovery PR.

**Authorities, in order:**
1. The latest explicit owner rulings, including the shared [#408 Index coexistence rule](../../../design-system.md#binding-shell-invariants) and the
   [2026-11-22 implementation rules](./implementation-plan.md#owner-rulings-on-the-u-design-2026-11-22).
2. The approved design: the [decision sheet](../../../../prototypes/appearance-ux/index.html), the
   [runnable prototype](../../../../prototypes/appearance-ux/app.html) and the
   [responsive board](../../../../prototypes/appearance-ux/board.html).
3. Shared shell guidance in [`docs/design-system.md`](../../../design-system.md).
4. Production conventions.

Architectural and ownership contracts stay authoritative throughout: the AGENTS hard rules, E4, E5, E7, contract C and Camera. The
`git show 2ca766335:docs/roadmap/t2-look-atmosphere/s8-professional-material-foundation/u5-library-recovery-plan.md` set the boundary: U6 extends the U5 editor in place.

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
- the *derived recipe* payload on the two assign commands, under [Ownership and seams](#ownership-and-seams).

## Authority and resolved conflicts

| # | Conflict | Resolution | Authority |
| --- | --- | --- | --- |
| C1 | The decision sheet and prototype show a *Layers · future* section with a disabled *Add layer*. The 2026-11-22 rules forbid visible placeholders for future features. | **Approved deviation:** omit Layers. The right column ends after Mapping. | 1 over 2 |
| C2 | The prototype's sheen positions come from `finish.js` STEPS (0.9 / 0.55 / 0.2). The accepted rule says "sheen targets per material family". Production reads Matte 0.8 / Satin 0.5 / Gloss 0.2 within 0.05, and anything else as *Custom*. | **Approved deviation:** the production table sets the slider ticks and the Card steps. The never-rougher-than-capture floor stays. | 1 over 2 |
| C3 | Production's Card has a *More* disclosure (Roughness, Metal, Tile size, Direction). The prototype Card has none. D8 splits the quick Card from the exact editor. | Remove *More*. Its values become editor fields. The Card keeps Pattern −, + and ↻ 90° and gains the Align link. | 2 over 4 |
| C4 | The prototype's *Save to My library* works. #408 and the U5 plan keep it visible but unavailable until U7. | Show it visible and disabled, with an inline reason, in the Card foot and the draft foot. | 1 |
| C5 | Repair dots in the Index | None. The owner ruled that U leaves the Index unchanged, and the prototype's comment agrees. | 1 |
| C6 | Typography: the prototype uses `system-ui` and `ui-monospace`. Production uses the Instrument Sans and DM Mono tokens, accepted in #408. | Use the production font families. Sizes, weights, case and mono usage follow the prototype (see the [spec](#visual-acceptance-spec)). | 4 for family, 2 for the rest |
| C7 | *Needs repair* is amber in the design (`--amber` #b7791f). The editor host runs `data-shell="living-draft"`, where `--shell-caution` resolves to `--ld-caution` #a9631f and `--shell-caution-bg` to #f8ecd9. Only the `:root` fallback is #c85a48. | DOM inks use `--shell-caution` and `--shell-caution-bg` as they are. The Stage hatch uses a new semantic `repair` paint role at the existing caution amber #a9631f; no new colour (**R1, approved**). | 1 over 2 |
| C8 | Opening a project with a broken image: the prototype opens the project with hatched surfaces. Contract C refuses the load before install. | **Approved deviation (R2):** keep the strict Load refusal. The boot panel gains exact-byte recovery. Hatching applies only to runtime failures in an open session. | 1 and contract |
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
| ⋯ menu | Rename…, *Select all using this Finish (n)*, *Give this surface its own copy*, *Reset to original (n)*, *Remove unused* (disabled with a reason while it has users) | Rename… and Reset to original only | Incomplete | Add the three items:<br>• *Select all*: `selectFinishUsers`, with reach set to All; disabled when n < 2.<br>• *Own copy*: an assign command with a [derived recipe](#ownership-and-seams) of no edits and `identity: 'fresh'` on the Card target only. It always creates a new Finish id, never reuses an identical one, and leaves the other users on the original. One undo; toast *This surface now has its own copy*. Disabled when n < 2 or the Finish is curated (prototype `editFinish(…, {}, 'this')`). `scene-finish-patch` cannot do this today: `readPatchEdits` refuses an empty list as `invalid-value` (`finish-planners.ts` ~902), and `applyFinishPatch` would refuse it as `no-change`.<br>• *Remove unused*: shown disabled with its reason, because a Card's Finish always has users. |
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
| Draft Apply and Paint | `assignRecipe` → `recipeRef` (`model.js`): the draft recipe lands as a curated ref when it has no overrides, reuses an identical project Finish (`findFinish`: same base and overrides, name ignored), or creates one. Only the named targets are reassigned, and no Finish is edited. Paint re-arms the resulting Finish, so later strokes reuse it. | An edited draft is refused unless the target already wears the draft's Finish (`finish-authoring.svelte.ts` ~893, `library-draft.ts` ~87). On a wearing target it patches the Finish: `in-place` for a sole user, `just-this` (always a fresh id) when shared (`library-draft.ts` ~102–118). *Use for Paint* is disabled once changed. | Conflicting | Every draft Apply and the first draft paint go through one [derived recipe](#ownership-and-seams) assign with `identity: 'reuse'`, on the named targets only. Remove both guards, the draft's `scene-finish-patch` path and the disabled Paint reason. |
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
| Runtime image failures | The prototype's missing image stands for any image the session cannot draw | Every Stage caller of `acquireFinishViews` releases an incomplete lease and shows the plain fallback, with at most a dev warning: `render/layout/wall-material-factory.ts` ~154, `render/layout/scene-surface-materials.ts` ~83, `render/scene-entity-representation.ts` ~287 and `render/scene-model-representation.ts` ~462. `image-load-failed` carries only a message string. | Missing | Report each target's outcome to the issues service. Acquisition and decode failures become repair issues; pending and cancelled loads do not (see [design](#repair)). |
| Stage hatch | Diagonal hatch on affected surfaces | None | Missing | Render-only layer, drawn only on targets whose own outcome failed or that a static issue names, in the approved `repair` role (R1) |
| Cold-load image failure | Opens hatched | The whole load is refused (contract C); `repairAsset` has no UI | Conflicting | Keep the strict refusal (C8, R2 approved) and add exact-byte recovery to the boot panel |
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
| Derived recipe on targets (draft Apply, draft first paint, *Own copy*) | `scene-finish-assign` and `scene-surface-finish-assign` (`project-model/scene-planning/finish-planners.ts`) | **Contract detail.** Both payloads gain an optional `derive: { edits: FinishPatchEdit[]; identity: 'reuse' \| 'fresh' }`. The `finish` ref names the source. The planner builds the recipe by copying the source (a curated ref becomes `base: { catalogue }`; a project ref keeps its base and overrides) and applying `applyFinishPatch`. An empty list is the source recipe itself, and the `no-change` check does not apply. Then, by identity:<br>• `reuse` follows the prototype's `recipeRef`. A curated base with no overrides is the curated ref, handled by the existing assign path, including its pristine-instance rule for models. Otherwise the first project Finish in document order with an identical base and pruned overrides (canonical JSON, name ignored) is reused, and no allocation is admitted. Failing both, exactly one allocated id creates the Finish.<br>• `fresh` always requires one allocated id and never reuses. It serves *Own copy* only.<br>Either way, only the named targets are reassigned, no existing Finish definition changes, and it is one operation with one undo. New Finishes are named by the rule `scene-finish-patch` already uses for a `just-this` copy (U4 `treatmentFacts`; `nextFinishName` for a renamed source). One pure helper, `findIdenticalFinish(materials, base, overrides)` in `project-model`, is shared by the planner and by the editor's allocation prediction, so the two cannot disagree. A stale prediction refuses as `missing-allocation` or `unexpected-allocation`, and nothing is written. When the resolved Finish is the one the target already wears, the editor shows *X already wears this* in place and sends nothing. Without `derive`, both commands behave exactly as today. The output is an ordinary project Finish, so the persisted format and every reader are unchanged. Rejected alternatives: `scene-finish-patch` refuses non-users by design (`invalid-target`, ~2103) and edits shared definitions; `scene-finish-register` vendors a digest-verified recipe, which would lose the curated base that *Original* and Reset read. |
| Library draft | `finish-authoring.svelte.ts` `libraryDraft`, `applyLibraryDraft`; `library-draft.ts` `libraryDraftPlan` | The draft holds a full `FinishPatchEdit[]` instead of a sheen step. Every edited-draft Apply is one assign with `derive` and `identity: 'reuse'` on the requalified target only, whether or not the target wears the draft's Finish. The U5 draft `scene-finish-patch` plan (`in-place` for a sole user, `just-this` when shared) is removed, so a draft never edits a Finish definition and cannot reach users other than its target. The previous Finish of a sole-user target simply becomes unused, as after any Paint; *Remove unused* and Undo cover it. Remove the "worn today" refusal and the `Select a surface wearing …` guard. An unchanged draft keeps #406's plain assign, which is the reuse case. |
| Editor state | New `authoring/look/finish-editor.svelte.ts`, created by `createFinishAuthoring` and exposed as `authoring.editor`, like `card` | Keeps the 1864-line adapter from growing. It owns mode, target, reach, view settings, field views and change count. It holds no Scene data. |
| Draft *Use for Paint* | `authoring/look/paint-pick.ts`, paint commands | New pick `{ kind: 'draft', ref, edits, name }`. An unchanged draft arms its Finish as today. The first paint of an edited draft commits one assign with `derive` and `identity: 'reuse'` on the stroked targets. It then re-arms as `{ kind: 'finish', key }` of the resulting Finish, which is reused or new, so later strokes add no Finish (prototype `commitPaint`). |
| Preview | E7 `createInspectionHost` (`render/materials/inspection-host.ts`) | `InspectionRequest` gains an optional `lightTurnRadians` (rig yaw). `requestKey` appends it only when it is non-zero, so every existing key stays byte-identical. Display already exists. |
| Align camera | `wallFace` store (`standpoint`, `face`, `putBack` → `camera.restoreStandpoint`) and its route port; camera-core `requestViewingIntent` | The reading names a wall side or a floor. A wall face takes its side from the Card target's surface ref, never `wallFaceSide`. The port gains `frameFloor(bounds)`: Plan reading, then `fit`. Put back keeps the store's exact reversal. camera-core `fit` takes its extent from the declared endpoint. |
| Align overlay | New `authoring/stage/shell/StageFinishAlign.svelte` | View-only SVG over the Stage region. Ruler, grid and handles come from the surface's metric mapping frame (resolved by the existing surface-mapping code), projected through the faced camera. The conservative `wallFaceFrame` only frames the view. |
| Plan appearance during floor Align | The route getter `planAppearance` that feeds `StageCanvas`, and `paperVisible` (`routes/project/[projectId]/spatial/+page.svelte` ~2177, ~1263) | One derived effective value, `finishAlign?.surface === 'floor' ? 'shaded' : shell.preferences.planAppearance`, feeds both. The stored preference never changes. |
| Import | E5 `prepareDraft` and `acceptDraft` (`material-set.ts`), `importProjectImage` | New `authoring/library/material-import.svelte.ts` session and `MaterialImportSheet.svelte` |
| Runtime image outcomes | `render/resources/project-texture-scope.ts` (fetch, pin check, `createImageBitmap`), `texture-store.ts` (the shared source entry keeps `error` as a string), `finish-views.ts` (`image-load-failed`), and the four Stage callers listed in the [Repair matrix](#repair) | The scope throws a typed `ImageLoadFailure { phase: 'acquire' \| 'verify' \| 'decode'; httpStatus? }`. Scope closed and superseded stay cancellations. The store keeps the typed failure on its source entry, and `image-load-failed` gains `phase` and `httpStatus`. Each Stage caller reports `{ targetKey, finishKey, state, issues }` to a session-only sink instead of dropping the lease. `state` is `pending` (loading, cancelled or generation-mismatch, which re-acquire), `ready`, `budget` (`texture-budget`) or `failed` (`image-load-failed`). The plain fallback drawing is unchanged. Render state only: never serialized and never on a visitor or public path. |
| Issues | `inspectFinish` (`project-model/scene-planning/finish-inspect.ts`) plus the runtime sink | New `authoring/look/appearance-issues.svelte.ts`. Static issues are derived per accepted revision as `{ finishKey, code, role, affected }`, with target analysis from the existing model-facts preparation. Runtime failures are merged per `(finishKey, role, code)` with the failing targets as `affected`. `affected` is always a subset of the Finish's users: a `missing-uv` on one model never lists the walls that share its Finish. Pending and `budget` targets never count as issues. A session-owned fix list `{ finishKey, code, action, history }` feeds *Repaired (…)*. It is never serialized and is cleared on project switch. An entry with `history: 'authored'` is dropped when Undo brings its issue back; a `history: 'none'` entry stays. The renderer keeps its fallback and still warns in dev. |
| Hatch | Stage presentation layers; `design/spatial-paint.ts` role map | New `StageRepairLayer.svelte` beside `StageSelectionLayer.svelte`. It draws only on the union of open issues' `affected` targets, in a new `repair` role (`SPATIAL_PAINT_ROLES.repair: '#a9631f'`, `--stage-repair: #a9631f`). That is the existing living-draft caution amber, approved as R1, and the token test pins it equal to `--ld-caution`. |
| Exact-byte repair | `platform/project-persistence.ts` `repairAsset(projectId, assetId, bytes, { expectedPin, savedBaseToken }, signal?)` | Called from the Card strip (*Relink…*) and the boot panel. It writes asset storage only, never an authored document, so it creates **zero history entries**. In-session success invalidates that source (`invalidateTextureSource`, `invalidateFinishViewsForSource`) and the targets re-acquire. |

### Material editor

**Finish mode.** *Edit material…* opens the editor on the Card target with the Card's reach. Each completed control is one E4 patch, committed on release as one undo. While a control is moving, the Card adapter's `preview` shows the change render-only. The reach chip and the Card's reach segment share one value. In *This side* on a shared Finish, the first edit forks through `edit-just-this`, as the Card does today, and later edits go in place on the copy. The original is the base recipe, through `baseRecipeOf`, never the state when the session opened. Field changes are computed against it, and Reset all writes one patch resetting every changed group. *Done*, × and Escape close back to the Card. Nothing is pending, because every release has already committed.

**Draft mode.** The editor keeps U5's no-write rule. Each field edits the draft's `FinishPatchEdit[]` and re-projects the render-only preview on the draft target. `applyLibraryDraft` checks the whole patch with `applyFinishPatch` before enabling *Apply to X*. A refusal stays as a line under the field. *Apply to X* and *Use for Paint* work on any qualified target. Each is one assign with `derive` and `identity: 'reuse'` on the named targets only: an identical Finish is reused, otherwise one is created, and no shared user of any Finish changes. An unchanged draft keeps its #406 assignment behaviour.

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

**Camera-core correction.** `fit` currently derives its extent from `settled.reading`. During a Plan flip, that is still the reading being left, so a `fit` sent right after `set-reading` frames 3D extents. `requestViewingIntent` documents that intents during a flip apply to the declared endpoint. Make `fit` use `settled.transition?.to ?? settled.reading`. Add unit tests next to `camera-viewport-evaluation.test.ts` for both directions: a `fit` during 3D → Plan frames Plan extents, and one during Plan → 3D (including a face transition) frames 3D extents. No other Camera change.

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

**Issue sources.** The issues service merges two sources. Both feed the same pill, drawer, strip, badge and hatch.
- **Static:** `inspectFinish` per accepted revision. Its codes are `missing-image`, `missing-pin`, `missing-uv`, `missing-normal-frame` and `mapping-requires-metric-basis`.
- **Runtime:** each Stage target's outcome for the images the session actually tries to draw:

| Runtime outcome | Meaning | Repair issue | Hatched |
| --- | --- | --- | --- |
| `pending` | Loading, cancelled, or superseded by a newer generation; it re-acquires | None. Not counted and no line. The plain fallback shows, as today. | No |
| `budget` | `texture-budget` | None. The readiness line *Too many large textures open · Retry* | No |
| `failed`, phase `acquire`, HTTP 404 or 410, or image not registered | The bytes are not available to this session | `image-unavailable` | Affected targets only |
| `failed`, phase `acquire`, network error or 5xx | Transient | `image-unreachable` | Affected targets only |
| `failed`, phase `verify` | Bytes arrived but do not match the saved pin | `image-mismatch` | Affected targets only |
| `failed`, phase `decode` | Bytes cannot be decoded here | `image-undecodable` | Affected targets only |

The runtime codes are editor-side presentation codes, not project-model issue codes, and none of them is persisted.

**Affected targets.** A target counts as affected only when its own outcome is `failed` or a static issue names it. Only affected targets are hatched, badged with *Needs repair* and listed under the issue. Other users of the same Finish that draw correctly are not marked. For example, a model with no UV set is hatched while the walls sharing its Finish are not. An issue clears once none of its affected targets still fails.

**Surfaces.**
- **Head pill:** the count of open issues. Pending and budget states never count.
- **Drawer:** groups issues by Finish and lists the affected targets. *Open its Card* focuses the first affected target and opens the Card strip. *Repaired (…)* lists the session's fix list.
- **Subject card:** *Needs repair* on each affected part row.
- **Hatch layer:** the union of the open issues' affected targets.

**Card strip actions and history.**

| Issue | Action | Writer | History |
| --- | --- | --- | --- |
| `missing-image`, `image-unavailable`, `image-mismatch` | *Relink…* (offered when the project holds the image's pin) | Choose the original file, then `repairAsset` against the saved pin, then invalidate the source and re-acquire | **None.** Exact-byte recovery restores storage, not authored truth. Undo neither reverts it nor brings the issue back. |
| the image codes above, plus `missing-pin` and `image-undecodable` | *Replace image…* | The S4 replace path (`finish-image.svelte.ts`) | One undo. Undo restores the old binding and its issue. |
| any image code on the colour role | *Use colour instead* | E4 `maps.color` `disable` plus the tint rule | One undo |
| any image code on another role | *Turn off* that map (the raw-row copy) | E4 `maps.<role>` `disable` | One undo |
| `image-unreachable` | *Retry* | Re-acquire, through `host.retry()` for the preview | None |
| `missing-uv` on a model target | *Use UV set 0* | E4 `mapping` uv set 0 | One undo |
| | *Surface mapping* | E4 surface `mapping`, offered only when a metric basis exists | One undo |
| `missing-normal-frame` | *Turn off relief* | E4 `maps.normal` `disable` | One undo |

A refused repair (wrong bytes 422, stale saved base 409, inaccessible 404) leaves one line in the strip, and nothing changes. A successful exact-byte recovery adds a `history: 'none'` entry to *Repaired*; an authored correction adds a `history: 'authored'` entry.

**Cold load (R2 approved).** Contract C keeps refusing an image failure before install. The boot panel and the replacement notice gain *Repair with the original file…*. It reads the chosen file, calls `repairAsset(projectId, assetId, bytes, { expectedPin, savedBaseToken }, signal)` (`platform/project-persistence.ts` ~171), then retries the whole Load. This creates **zero history entries**: no document changes, and the reloaded session starts with fresh history. The previous session stays open throughout, and a refusal keeps the panel open with one line.

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
Repair   target ─load→ pending ─ready→ ready · ─texture-budget→ budget (readiness line, no issue) · ─failed→ issue (affected targets hatched)
         issue ─Relink→ recovering ─ok→ re-acquire → cleared (no history; Undo does not bring it back)
         issue ─authored correction→ writing ─ok→ cleared (one undo; Undo restores the issue) · any ─refusal→ issue (line in strip)
Boot     refused Load ─Repair with the original file…→ recovering ─ok→ Load retried (no history) · ─refusal→ refused (line)
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
| Runtime image failure | The target keeps the plain fallback, and the issue and hatch appear for that target only. Pending and budget states are never shown as failures. |
| Context switch mid-flow | Editor, Align and Import close by their cancel paths and release previews and leases |

## Visual acceptance spec

The implementation PR must show prototype-versus-production pairs for every state below, at three viewports:
- **desktop** 1440 × 900, fine pointer;
- **narrow** 1024 × 768, Index open;
- **iPad portrait** 820 × 1180, coarse pointer.

**Reproducing the prototype.** Serve the repository root and open `prototypes/appearance-ux/app.html` with the query shown. The reference captures are in `git show 2ca766335:docs/roadmap/t2-look-atmosphere/s8-professional-material-foundation/evidence/u6-plan/`. The current production captures in the same folder are the starting point.

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

Exact sizes, radii, spacing and colours are owned by the approved specimen and the shared shell
tokens; U6 matches them in the listed states rather than restating their measurements here.

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
| Stage hatch on affected surfaces | `--stage-repair` / `SPATIAL_PAINT_ROLES.repair`, #a9631f (R1 approved: a semantic role at the existing caution amber, pinned equal to `--ld-caution`) |
| Unavailable-image thumbnail (raw row, strip) | The existing Card missing-image treatment with `--shell-caution` ink; no new pattern |
| Align surround | `--shell-ivory` |
| Fonts | `--shell-sans`, `--shell-mono`; sizes from `--shell-text-*` where equal, otherwise the prototype value |

## Regression protection

**U1–U5 baseline.** Keep the existing suites green. Run editor vitest groups one at a time:
- `authoring/library/*`
- `authoring/look/finish-card`, `paint-pick`, `paint-tray-service`, `colour-coat-port`
- `stage-paint-tray*`, `stage-keyboard`, `stage-boot-states`, `spatial-route-viewport`
- `render/materials/inspection*`, `finish-tiles`, `render/resources/texture-store`, `finish-views`, `project-texture-scope`
- `project-model/finish-planners`, `material-set-proposal`, `colour-coat`
- `design/presentation-tokens`
- visitor and public-surface boundary tests

**New focused tests:**

| Area | Test |
| --- | --- |
| Editor facet | Each field group emits the exact E4 patch. Release commits once. Double-click reset and Reset all are one patch each. Changed count matches against `baseRecipeOf`. The ORM switch is one patch. Refusals map to the line copy. |
| Draft | An edited draft applies as one assign with `derive` and `identity: 'reuse'`, on wearing and non-wearing targets alike. Applying it to one user of a shared Finish leaves every other user's Finish and definition byte-identical, and so does applying it to a target whose Finish has a single user. Applying the same edited draft to a second target reuses the Finish the first Apply created. A draft whose recipe matches an existing project Finish reuses it. An unchanged draft keeps #406 behaviour. Cancel writes nothing. *Use for Paint* on an edited draft resolves one Finish on the first stroke and re-arms its key, and the second stroke adds no Finish. |
| Card | No *More*. The foot items. The three ⋯ items' commands and disabled reasons. The Align link only on wall sides and room floors; a curved wall refuses with the line. |
| Derived recipe | `finish-planners.test.ts`, for both assign commands:<br>• `reuse` with no identical Finish creates one project Finish (base kept, overrides patched) with exactly one allocation, in one undo.<br>• `reuse` with an identical Finish (name ignored, first in document order) reuses it and refuses an allocation as `unexpected-allocation`.<br>• `reuse` resolving to a curated base with no overrides takes the curated path, including the pristine-instance rule for models.<br>• `fresh` with no edits always creates a new id, even when an identical Finish exists, and refuses without an allocation.<br>• No existing Finish definition changes; only the named targets move.<br>• An inadmissible edit refuses with the E4 problem code.<br>• Without `derive`, the existing assign expectations are unchanged.<br>`findIdenticalFinish` gets its own unit test, and the editor's prediction uses it. |
| Inspection | `lightTurnRadians: 0`, or the field left out, keeps the request key and thumbnail key byte-identical. Compare holds one live request. The probe reads the displayed canvas and resets on leave. |
| camera-core | `fit` sent during a 3D → Plan flip frames Plan extents; `fit` sent during Plan → 3D and during a face transition frames 3D extents. Existing evaluation tests are unchanged. |
| Align | Snap and step math. One commit per release and per key release. Reset is one patch. Put back restores reading, pose and FOV. The wall face uses the Card target's side even when the camera starts on the other side. Floor Align leaves the stored `planAppearance` preference unchanged. The Library over Align closes first on Escape. |
| Import | Session over E5: slow-read progress, conflict choice and *Change*, detected and generic normals, acknowledgement, size and name validation, mixed-kind segment, no-target *Import*, each refusal code, abort on cancel, focus and recents after accept |
| Runtime outcomes | `project-texture-scope` throws `ImageLoadFailure` with the right phase for HTTP 404, network error, pin mismatch and decode failure; scope closed and superseded stay cancellations. `texture-store` keeps the typed failure for every waiter. `finish-views` copies `phase` and `httpStatus` into `image-load-failed`. Each of the four Stage callers reports `pending`, `ready`, `budget` and `failed` correctly, keeps its plain fallback, and reports nothing on a visitor path. |
| Issues | Static derivation from `inspectFinish` and runtime merging. Pending, cancelled, generation-mismatch and budget never count or hatch. The `affected` set is exactly the failing or named targets: a Finish shared by a failing model and drawing walls hatches only the model. Exact-byte *Relink* creates zero history entries; afterwards, Undo neither reverts it nor restores the issue, and the source re-acquires. Each authored correction is one undo, and Undo restores its issue exactly. The fix list keeps `none` entries, drops `authored` entries on Undo, and clears on project switch. Boot-panel repair calls `repairAsset` with `{ expectedPin, savedBaseToken }`, creates no history, then reloads. |
| Arch | Editor-only modules stay out of visitor and public chunks (`public-surface-boundary`) |

**Browser journeys.** These are focused manual browser QA under the
[editor test contract](../../../../apps/editor/tests/README.md#browser-qa-policy), at the three viewports, with comparison captures:
1. **Task 1:** Paint walnut, then Card → *Edit material…* → Sheen → Done; Undo.
2. **Task 2:** Import the messy set, resolve it, register on three wall faces; then Card → *Edit material…* → Grazing, Compare, View Relief; Partition Side A → *This side* → Pattern 0.6 m or *Align on wall…*; Undo each.
3. **Floor Align** in the Paper preference; Put back restores the view and Paper.
4. **Task 4:** Repair a missing image and a UV mismatch.
   - *Relink* with the original file: the hatch clears, no history entry appears, and Undo does not bring it back.
   - *Replace* and *Use colour instead*: each is one undo, and Undo restores the issue and hatch exactly.
   - *Use UV set 0*: the model's hatch clears, and walls sharing its Finish were never hatched.
   - A throttled load stays unhatched while pending. A served 404 and a corrupt image each hatch only the targets that use them.
5. **Cold load** with a corrupted pin: Load is refused; boot-panel repair, then Load. The reloaded session's history is empty.
6. **U1–U5 recheck:**
   - Library browse and detail, Customise draft retarget and Apply (including Apply on a shared Finish's user, which leaves the other users unchanged);
   - Paint picker and tray;
   - Swap, Replace and Shift keep-open;
   - Escape order and focus return across every new layer.

Full Playwright capture remains owner-authorized only.

## Execution plan

This is one PR. It touches the shared shell surface, plus two contract details that every existing reader still satisfies: the camera-core `fit` fix and the optional patched-copy payload. The steps run in order. Each one ends green on its focused tests.

| Step | Work | Depends on | Acceptance | Stop if |
| --- | --- | --- | --- | --- |
| 0 | Root-cause the #408 departure: Oak reads as flat grey on Stage walls. It reproduces on `main` with no material issue logged. Align and the Card need a legible wall pattern. First check whether the wall's view lease is incomplete: `wall-material-factory.ts` drops it silently and shows the plain fallback. | — | Cause identified. Fixed if it lies in the Finish projection or view acquisition. | The cause is in World lighting or the renderer → report to the owner before step 5 |
| 1 | Tokens: replace hard-coded inks with the [ink table](#inks-and-type); add the approved `repair` Stage role (R1) | — | Token test green, including `--stage-repair` equal to `--ld-caution` | — |
| 2 | Derived-recipe payload and `findIdenticalFinish` on both assign commands; editor facet and Finish mode: Card foot, *More* removal, ⋯ items (*Own copy* fresh), subject-card badge slot, Card anatomy | 1 | Planner, editor and Card tests; desktop pairs for Card and editor | An E4 field cannot express a prototype control, or the derive payload needs a persisted-format change → escalate |
| 3 | Preview: display, probe, turn, split compare, readiness lines | 2 | Inspection tests; Compare and Relief pairs | A turned rig changes the turn-0 pixels |
| 4 | Draft mode on every field; Apply and *Use for Paint* on any target through `reuse`; remove the U5 draft patch path | 2, 3 | Draft and paint-pick tests, including the shared-user isolation tests; draft pairs | — |
| 5 | Camera-core `fit` fix + Align wall and floor | 0, 2 | Camera and Align tests; Align pairs at three viewports | The fix changes an existing evaluation expectation |
| 6 | Import sheet on E5 | 1, 3 | Import tests; four import pairs | E5 needs a contract change |
| 7 | Typed runtime image outcomes and the Stage callers' reports; issues service, pill, drawer, strip, badge, hatch; in-session and boot-panel exact-byte recovery | 1, 2 | Runtime outcome and issues tests; repair pairs | A Stage caller cannot report an outcome without changing its fallback drawing → escalate |
| 8 | Responsive: iPad two-column sheet, 1024 lanes, Escape order, focus return | 2–7 | Every pair at the three viewports; keyboard journey | — |
| 9 | Full journeys, the complete merge gate, PR evidence table | 1–8 | Every spec row paired, with deviations C1–C13 listed | Any unpaired row |

## Owner rulings 2026-11-23

| # | Ruling | Effect on the plan |
| --- | --- | --- |
| R1 | **Approved.** Add the semantic `repair` role using the existing caution amber. | `SPATIAL_PAINT_ROLES.repair: '#a9631f'` and `--stage-repair: #a9631f`, pinned equal to `--ld-caution` by the token test. No new colour value. DOM inks keep `--shell-caution`. |
| R2 | **Approved.** Retain the strict Load refusal, with exact-byte recovery from the boot panel. | Contract C is unchanged (C8). The boot panel's *Repair with the original file…* calls `repairAsset` and retries Load with zero history entries. Hatching applies only to runtime failures in an open session. |

No decision remains open. Any new conflict found during implementation is escalated, not resolved in the PR.

## Integration risks

- **Wall pattern legibility (step 0).** The #408 grey-wall departure blocks Align parity until it is resolved.
- **Adapter growth.** The editor facet lives in its own module. `finish-authoring.svelte.ts` only wires it.
- **Derived recipe.** The one planner change that writes. It is additive and optional, and its output is an ordinary Finish. Reuse depends on the planner and the editor agreeing on identity, so both use `findIdenticalFinish`, and a stale prediction refuses rather than writing. *Own copy* is the only `fresh` caller.
- **Draft behaviour change.** Removing the U5 draft patch path changes what an edited draft does to a sole-user Finish: it reassigns instead of editing in place, matching the prototype. Re-run the U5 draft journeys.
- **Runtime outcomes.** Typing image failures touches the shared texture store and four Stage callers. The fallback drawing must stay identical, and no outcome may reach visitor chunks.
- **Draft Paint pick.** A new pick kind crosses the paint path, and the first stroke creates a Finish that later strokes must reuse. Cover it with paint-pick and tray tests.
- **Camera timing.** Floor Align relies on the `fit` correction. Wall Align relies on the face port plus an explicit side.
- **Align frame accuracy.** The ruler must come from the surface's metric mapping frame, not from `wallFaceFrame`, or ticks drift from the pattern.
- **E5 wiring and P20 IO.** First product use of E5. Mostly covered by the existing proposal tests; cancellation and stale-revision get session tests.
- **One live E7 request.** Split compare draws sequentially. A slow original frame delays the labels, by design.
- **iPad sheet layout.** The sheet is restructured; check it at 768 and 820 portrait widths.

## Recommended implementation

Assign one implementer with high effort, preferably the strongest available model. The work crosses the Finish adapter, the assign planners, the texture store, E7, Camera and the Stage route, and it is judged on rendered parity. The implementation lands in this PR (#411) as steps 0–9. Use a fresh-context reviewer. The owner checks the paired evidence before merge, and the full prototype-parity gate is unchanged: every spec row paired, deviations C1–C13 only.
