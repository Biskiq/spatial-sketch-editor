# T2.S8 U: approved appearance prototype ↔ production parity harvest

**Authority:** owner-approved #399 / `prototypes/appearance-ux/` (D1–D12, approved 2026-11-22). **Owner ruling 2026-11-23:** a later implementation plan or older shell reference cannot dilute this approved visual/interaction target. Production domain, security, history, persistence and renderer contracts remain binding independently. See `docs/workflow.md` and `docs/reference/design-system/editor-shell-and-visual-system.md`.

**Baseline:** implementation immediately after U5 merge `9231e321` (PR #406), compared with the approved prototype. Pre-U5 state is `88aab289` (U4 merged). This harvest accompanies a **non-destructive revert PR** returning code to that pre-U5 state; #406's full implementation remains in Git history for reuse. Other shipped U slices U1–U4/U8 remain present. **This is a source and interaction-contract audit; it does not claim that matched live browser screenshots have been captured.** The final optical/behavioral acceptance checklist below is outstanding.

**Rule:** an approved runnable design is the destination. Fidelity covers placement, layout, geometry, proportions, colour roles, type scale, spacing, card anatomy, default and transient states, contextual verbs, responsive transitions and interaction outcomes. Do not merely implement a feature checklist; do not copy prototype's fake model, localStorage, WebGL2 approximation or mock history. When a real platform/domain invariant obstructs parity, obtain explicit owner approval for the deviation. Never invent a quieter/simpler design as a fallback.

## Status legend

- **MATCH-SOURCE:** shipped implementation matches that specific source/behavior contract on inspection; still needs rendered screenshot confirmation.
- **GAP:** observable difference from approved behavior or CSS/component hierarchy, unless explicitly waived.
- **CONFLICT:** a later slice plan consciously changed approved semantics without explicit owner redesign approval. Prototype wins pending an owner ruling.
- **UNVERIFIED:** source or earlier browser claims are not enough for visual acceptance.
- **NOT YET:** allocated to U6/U7 or a later explicitly excluded feature, not a U1–U5 omission.
- **REVERTED:** #406 artifact intentionally rolled back; do not count as shipped.

## A. Exact Library comparison (U5 #406; now REVERTED)

Design: `prototypes/appearance-ux/app.html`, `app/ui-library.js`, `index.html`, `board.html`. Observed implementation: [#406 StageLibrary.svelte at merge](https://github.com/Biskiq/spatial-sketch-editor/blob/9231e3210b92ed333ed92f73231f92596033ac7f/apps/editor/src/lib/authoring/library/StageLibrary.svelte) and its `library-catalogue.ts` at `9231e321` (historical files reverted from the current branch). The U5 report records DOM/network acceptance at 1440×900 and 1024×768, **no screenshot capture**, no ≤760px browser run.

| ID | Approved prototype | Observed in #406 | Verdict / requirement |
| --- | --- | --- | --- |
| L01 Placement | `#lib` fixed *inside Stage workspace*, left `calc(var(--idx) + 14px)`, right `calc(var(--card) + 24px)`, top `98px`, bottom `142px`; no-Card right `14px` | `.library` absolute with 12px inset left/right/top, bottom tied to lower column; covers Index/Card instead of reserving those homes | **GAP.** Reproduce approved workspace positioning, reconcile actual shell measurements, preserve Stage context |
| L02 Responsive | At ≤860px, Library becomes a **bottom sheet** (`height:min(86vh,760px)`, radius `16px 16px 0 0`); sheet-relative width below 760px folds source to a select; at ≤760px category rail horizontal and detail overlays from bottom | #406 remained nearly full-height at 820px, changed to full-window sheet only at ≤760px, source control wrapped rather than folded to a select | **GAP.** Match breakpoint *behavior* based on available shell room, not arbitrary U5 breakpoint |
| L03 Columns | Rail `176px` wide desktop; ≤1180px `150px`; with detail `176px | flexible browse | 260–300px detail`; detail overlays appropriately at narrow sizes | #406 rail `128px`, ≤1180px `112px`; 286px detail (260px ≤1180); overlay at ≤900px | **GAP** in visual proportions; side detail width is close but hierarchy not |
| L04 Search/header | Compact single header: Library, search (pill with search glyph), source segmented control, Import (when implemented), close ×; second row filters and contextual consequence | #406 two-line title/search, plain rectangular input, source count chips, separate family+filter strip | **GAP** in composition/typography; **NOT YET** for U6 import command |
| L05 Rail hierarchy | Materials expands to nested `All materials` + material-family taxonomy; other kinds visibly distinct; rail indented child rows | #406 flat rail for kinds; material families mixed into horizontal filter chips | **GAP**, also violates U5's own plan `Materials (with catalogue families nested)` |
| L06 Source hierarchy | All has project/My library compact **one-row shelves**, `See all n ›` when overflow, followed by curated gallery; sources All / Curated / This project / My library / Sources | #406 renders each source as full separate grid; My library omitted for U7 | **GAP** for All grouping/project shelf; **NOT YET** My library U7 / Sources third-party later |
| L07 Material grid | Card width ~128px (`--mcard:124px` minimum), 12px gap, square material image; white card with 1px border and radius 12px | #406 `minmax(104px, 1fr)`, 8px gap, 104×78 image, transparent border, radius 9px | **GAP**. No claim that 21 cards visible settles geometry; match card anatomy and scannability |
| L08 Card text | Name 12.5px, up to two lines; secondary subline 11px; consistent source anatomy | #406 11px one-line ellipsis name and 9.5px metadata | **GAP**, lower readability and different rhythm |
| L09 Card overlays | Favourite top corner; detail `⤢` top corner; usage count and Concrete variant chips over thumbnail; edited dot on name | #406 star below image, variants below image, usage badge, Project text overlay; no independent detail affordance and edited dot | **GAP** in component anatomy; preserve D1 variant behavior already implemented |
| L10 Card action | Clicking image/card *chooses* material per invoking intent (`pick`, `apply`, `swap`); Shift-click keeps open. `⤢` alone opens detail | #406 card click exclusively opens detail; actions inside detail apply/paint | **CONFLICT.** #406 U5 plan said 'click opens detail, never assigns', contrary to approved design. Prototype governs; translate action through single accepted writer |
| L11 Detail preview | Large **square live E7 inspection** with geometry Sphere/Flat/Tile and Studio/Grazing/World, rotate-light control; detail labelled Material/Finish, source and size | #406 178×128 static `FinishTile`, no geometry/lighting controls | **GAP** for Library inspection, not excused by U6 Material Editor; E7 host already landed. A real E7 preview is not permission to load every full-res image on initial browse |
| L12 Detail facts | Material/source, real physical size, sheen step and r, maps, provenance, per-user identity, contextual primary action | #406 base, family, roughness decimal, metal %, 'Used by n', warning, some actions; less provenance/map breakdown | **PARTIAL GAP**. U6 may enrich raw channel facts but Library's approved essential inspection remains U5 |
| L13 Draft intent | `Customise…` opens exact Material Editor on a **nonwriting draft**; cobalt ghost follows target/click, until Apply/Use for Paint/Save | #406 inline local sheen-only wash, requires already-wearing target, no E7 preview/Stage ghost | **INCOMPLETE SEAM**, U6 owns full editor but U5 must not redefine D9 as merely a sheen control; design-first U5/U6 integration required |
| L14 Existing functional paths | Source/filter/search, variant card, inspect user, Select all, Use for Paint, accepted writer, Undo, no full-res fetch for browse | #406 tests/DOM/network report them working | **MATCH-SOURCE** for those contracts only; no overall visual acceptance |
| L15 Empty/keyboard | Contextual empty/refusal, Esc closes detail then Library, focus, 44px touch controls | #406 implements states/trap/restore; ≤760px/coarse interaction not exercised | **MATCH-SOURCE / UNVERIFIED** at narrow devices |

**Disposition:** U5 requires a **design-first implementation** on top of the reversion baseline, optionally cherry-picking isolated nonvisual algorithms from #406. Do not re-merge #406 wholesale without parity correction. Maintain one authoring path, FinishTile/E7 lifetime discipline and U4 reach semantics.

## B. Paint picker and tray (U2, U3)

Design: `prototypes/appearance-ux/app/ui-panels.js`, `app/ui-tray.js`, `app.html`. Production: `StagePaintWheel.svelte`, `StagePaintTray.svelte`, `paint-tray-state.svelte.ts`, `stage-painter.ts`.

| ID | Approved | Observed | Verdict |
| --- | --- | --- | --- |
| P01 Picker host | Free **anchored floating popover**, width `236px`, positioned relative to initiating control; reposition above/below to fit viewport; at ≤860px becomes bottom sheet | Wheel rendered **inside expanded Paint tray** (see `StagePaintTray.svelte`) | **GAP**, owner screenshot comparison in #405 confirms |
| P02 Hue dial | `180×180px` within the popover; lightness/hex below; vertical compact flow | `8.5rem` (about 136px) dial with flex-wrapped neighboring controls | **GAP** size, composition, focus hierarchy |
| P03 Picker actions | Title 'Paint colour' or 'Stain colour'; before/now swatches, palette chips, Hex, 'Add to palette' when suitable, 'Done', ×; live preview/cancel semantics | 'Custom colour' group, 'Use colour' / 'Cancel', palette chips; add-to-palette via separate tray native colour input; no before/now header | **GAP**, reconcile actions and preview semantics without modifying colour-coat authority |
| P04 Picker keyboard/touch | Esc cancellation; arrow-key hue/saturation; press-capture pointer; bottom sheet at narrow width | Some keyboard and capture exist; actual popup/focus/bottom-sheet journey missing | **PARTIAL**, require browser QA |
| P05 Tray A | One labelled Colours/Materials tabbed tray, favourite/recents, picked item first, dropper, Surface/Space (Brush deferred), collapsible palette | U2/U3 tray/colour-coat port implements structure | **MATCH-SOURCE**; check visual parity by snapshots |
| P06 Paint semantics | A colour coats while preserving relief/sheen; a material replaces Finish; Surface/Space reach; one stroke one Undo | U2/U3 stage painter + `scene-colour-coat` planner, shared palette followers | **MATCH-SOURCE**, actual combined browser journey still needed |
| P07 Consequence/ghost | Stage bar consequence + cobalt target ghost, correct selected/will-change roles | U2 report claims implemented; no later visual differential | **MATCH-SOURCE / UNVERIFIED** optical parity |
| P08 Future tool placeholders | Prototype has Brush future mock, but owner implementation rule bars unused placeholders unless expressly approved | U2 owner explicitly retained disabled Brush until delivery; U3 enabled Colours | **ACCEPTED EXCEPTION**, do not re-add unrelated future controls |

## C. Finish Card and material capture (U4)

Design: `prototypes/appearance-ux/app/ui-card.js` and `app.html`. Production: `apps/editor/src/lib/authoring/look/FinishCardSection.svelte` / `finish-card.svelte.ts`. Domain: existing E4 authoring planners.

| ID | Approved | Production source inspection | Verdict |
| --- | --- | --- | --- |
| C01 Reach/identity | Finish name, context, This/All announced **before** editing; cobalt outline for All | U4 Card/view/selection proposal; stale reach refusal | **MATCH-SOURCE**, still needs visual screenshots |
| C02 Quick rows | Material with thumbnail+source and Swap; Colour mode+palette; three sheen steps with original dot; Pattern+size/rotation | U4 implements functional fields, but Material row is text-only and Swap opens a small internal picker rather than approved Library swap intent | **GAP** for Material row and contextual Swap pathway |
| C03 Custom colour | Card `Any colour` uses same anchored custom picker, with live Preview/Done/Cancel | U4 Card contains native `input type="color"` in the chip; not shared U2 floating picker | **GAP** with P01; one shared picker interaction needed |
| C04 Foot | ★, `Save to My library`, `Edit material…`, ⋯; editable name | U4 foot contains ★ and ⋯ only | **NOT YET** U7 save and U6 exact editor, not U4 bugs |
| C05 Align | `Align on wall/floor…` enters oriented ruler/grid handles | Not delivered in U4 | **NOT YET** U6 |
| C06 Cancellation | Drag previews transient, one accepted patch on completion, Esc/cancel/blur no write | U4 implements preview and cancellation; after-browser fixes folded in | **MATCH-SOURCE**, rerun focused mouse/keyboard when integrating shared picker |
| C07 Appearance | Approved Card ~288px, compact two-column rows (74px label), type/spacing/inset grammar | U4 Card anatomy similar but unverified against matched rendered prototype | **UNVERIFIED**, visual QA required, no blanket pass from tests |

## D. Thumbnails, dock and catalog (U1, U8)

| ID | Approved | Shipped evidence | Verdict |
| --- | --- | --- | --- |
| T01 Thumbnail | Flat lit, physical-metre sample tile, one versioned 256px master; XS/S/M derivatives; D1 concrete variants | U1 #400 sample-tile/1, 256px master, 64/112/256 derivation, 210-pair sweep; one failing comparison is the D1 within-card Concrete pair | **MATCH-SOURCE**, retain E7/backend/regression metrics |
| T02 Distinctness | Similar **cards** distinguishable, failing within-card variants disclosed as variants | U1 report 1/210 failing pair is bundled Concrete, no cross-card failures | **MATCH-SOURCE** per recorded E7 gate, rerun when card sizes/crop change |
| T03 Shared dock | 656×56 bar; key 54×46, label 10.5px, 9px hint, 20px icon; forest-3 armed | U8 #402 compared geometries: 656×56, 54×46, matched shadow 0 6px 18px; Landscape 65 vs prototype 67 | **MATCH-SOURCE with recorded minor deviation**; check screenshots, do not redesign |
| T04 Dock vs picker | Picker is a floating anchored control, not expanding dock/tray to enormous height | U2 picker diverges despite the dock matching | **GAP** P01 |
| T05 Material reads | Tile master/variant must not pull full-res textures while only browsing | U1/U2 documented scoped tile leases; #406 reported correct fetch behavior | **MATCH-SOURCE / CHECK AGAIN** after U5 redesign |

## E. Explicitly not delivered (do not misclassify as regressions)

| Slice | Approved design target | Source ownership |
| --- | --- | --- |
| U6 | Exact Material Editor (raw maps, exact values, Compare/originals, E7 preview/probe, reset), wall/floor Align reading, correctable import sheet, repair strips and source facts | `app/ui-editor.js` or equivalent prototype editor component, `app/ui-align.js`, `app/ui-panels.js`; existing E4/E5/E7 domain/inspection |
| U7 | Save private Finish, My library source, independent insertion across projects, thumbnail and what-travels explanation | `app/ui-library.js`, `app/ui-card.js`; already-built G private transfer API/codec |
| Post-S8 | Actual brush strokes, layers/masks, third-party Sources, additional products, later quick wheel accelerator | Prototype placeholders/research, **not** permission to ship inert controls |

**Caution:** features allocated to U6/U7 are not part of U5's current functional coverage. However, **U5 must retain their approved entry points and UX composition**, rather than planning an incompatible interface that future slices must undo.

## F. Owner-approved conflicts and visual acceptance protocol

### Concrete conflicts to resolve before claiming any new U5 acceptance
1. **Card click:** approved prototype card click chooses by intent, `⤢` opens detail; #406 plan replaced click with detail only. Restore prototype semantics unless owner explicitly redesigns.
2. **Source taxonomy:** approved nested Materials rail, not family chips inserted beside attribute filters.
3. **Display size:** approved square legible cards and a context-preserving Library surface, not a maximal overlay of the workspace.
4. **Library inspector:** E7 live inspection belongs in Library detail (not just the U6 editor); keep its draws demand-driven and bounded.
5. **Draft relationship:** U5 must hand off cleanly to U6 without treating a sheen wash as equivalent to an exact nonwriting Material Editor.
6. **Shared picker:** Paint and Card custom colours should respect one approved anchored interaction and preserve source ownership.
7. **No generic 'shell says otherwise' waiver:** older shell wording is superseded on #399-approved surfaces.

### Required matched browser scenario set

Capture matched viewport/states for **both** `prototypes/appearance-ux/` and the running production editor. Use same scene/category/selected surface where possible and note differences in underlying fixture. Save real side-by-side screenshot links in the PR; no synthetic markup re-creations.

| Case | Target states | Viewports |
| --- | --- | --- |
| V01 Library | closed / All / Curated / This project / family nested / search / filters / empty / favourites | 1440×900, 1280×800, 1024×768 |
| V02 Library detail | square material cards/variant, usage badge, detail open, shape+light controls, source facts | same + 820×1180 |
| V03 Context action | Paint pick and Swap pick; card click vs separate detail affordance; Shift keep-open; Esc focus return | desktop and 1024 |
| V04 Picker | colour picker on tray + Card, anchored popover, before/after, palette link, Add to palette, Done/Esc; viewport avoidance | desktop, 1024 and 820×1180 |
| V05 Finish | selected Wall side/Room surface, reach This/All, palette, sheen, patterned edit, hover cobalt, cancellation | desktop and 1024 |
| V06 U6 editor/import/repair | live preview and original Compare; Align ruler/handles; clean/messy filenames; diagnostics | after U6, desktop and 820×1180 |
| V07 U7 transfer | Save, My library, new project insert, independent edits and delete original | after U7, desktop/1024 |
| V08 Accessibility | keyboard focus/Esc ladder, roving buttons, 44px coarse hit targets, no clipped panel or horizontal page scroll | narrow/landscape + coarse pointer |
| V09 Semantic/perf | no project writes on preview, one Undo on Apply, changed reach refusal, no full-res texture fetch on browse, no leaked preview leases | all flows as relevant |

**Acceptance evidence minimum:** screenshot pair (prototype vs actual production) at each material state/viewport; table of measured/observed gaps with fix or explicit owner waiver; reproducible interaction steps; focused browser console/network readings; editor/type/arch/unit/renderer checks. DOM-only snapshots and 'all features present' are not proof of visual fidelity. Do not claim **S8 UX accepted** until the owner's visual comparison passes.

## G. Recovery plan

1. **Revert #406** as a new commit/PR, not a history rewrite. U1–U4/U8 remain intact. Keep #406 in history for reusable code; do not merge it back without approved visual/interaction fidelity.
2. **Promote authority** to `AGENTS.md`, `docs/workflow.md`, shell reference and prototype catalogue. Disallow silent design changes via scoped plan omissions.
3. **Replan and implement U5** directly against #399 after matched screenshots from the approved prototype. Use #406 pure browse/test logic when contracts survive, but reconstruct Library anatomy rather than restyle an incorrect UI in place by default.
4. **Implement U6/U7 against #399** with the same visual acceptance gate on each PR; no need to wait until the end to discover a different product.
5. Keep #405 as the rolling gap ledger, but fix design parity at the **owning slice** before claiming its acceptance. A final cross-U QA PR handles genuine residual polish only, not missing core approved design.
6. Validate the rollback with the normal code/arch/build/CI lanes; branch may not be merged until those are green and owner approves the reverted scope.

**Evidence limits:** harvested exact source markup, CSS, PR acceptance and QA reports; **no live matched production screenshots in this authoring environment**, so optical acceptance and some interaction behavior remain open. This document is the reproducible hard inventory, not a false claim that visual QA ran.
