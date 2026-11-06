# World shell recovery — proposed implementation

Owner review corrections and their acceptance now live in the separate [review pass 1 follow-up plan](review-pass-1-plan.md); this baseline is retained unchanged below.

**Approval required before coding.** This plan implements the
[measured specification](design-specification.md) and the approved dispositions
in [the departure register](gap-analysis.md#departures-and-owner-decisions).
It is a proposal after S24, not an assertion that World has visual parity or a
release of new geometry capabilities.

The owner is the sole visual/UX acceptance authority. Agent-owned functional
checks and a basic browser smoke check precede handoff; they do not accept visuals.
No screenshot matrix, archived visual evidence, scripted visual acceptance
journey, independent visual review or lengthy acceptance report is required.

## 1. Scope and invariants

Replace the current Head, Index, Card, Sheet, Dock/palette and spatial paint with
one coherent implementation. Do not place a replacement skin over retained old
markup or keep parallel old/new shell paths behind a flag.

Preserve the actual Layout/Scene/Camera/Experience authorities, current source
formats, authored geometry/materials, selection references, canonical compilation,
Plan membership/picking, the real 2D/3D transition, history, source admission,
persistence, current Objects ownership and visitor isolation. Preserve the
bounded Paper workspace in both readings and committed-geometry-only extents.

The only proposed gesture extensions are bindings to **existing** scalar
operations (E8). Their planners are not rewritten. New coupled Opening edits,
support-aware resizing, roofs, Slice, Brush, richer Eraser/Measure, new Camera
readings and automatic Ink interpretation remain outside this recovery.

## 2. Component-level changes

The [component key](gap-analysis.md#component-key) links the existing files.
Names marked **new** below are proposed editor-only files, not additional product
authorities or persisted formats.

| Part | Exact change | Retire / replace | Nature |
| --- | --- | --- | --- |
| `shell-roles.css` | Replace the current partial map with approved source-derived colors, typography, radii, family sizes, shadows and ground-aware mark roles. Scope border-box sizing to shell components. Components consume these roles | Duplicated shell constants and generic button-family assumptions in scoped CSS | Visual |
| **New** `ShellIcon.svelte` beside shell components | One SVG vocabulary using the actual 24 × 24 wireframe paths, with 12/15/16/18/19 px role sizes and round caps/joins | Different hamburger/history/pen/Objects glyphs and text symbols serving as icons | Visual/accessibility |
| `EditorHead.svelte` | Hamburger toggles Index; title owns project actions; source lens family; inline Find; icon Undo/Redo; compact real Save/status; gold-family visitor Preview. Retain existing refusal/reload/lifecycle callbacks | “Index ▾”, separate brand word, Find `<details><summary>` entry, permanent Find label/second query field, generic history word buttons | Visual + disclosure |
| `EditorHead.svelte` / root Find composition | Keep one query; merge contributed commands with actual subject/context results. Add result grouping/icons and explicit verb callbacks; implement combobox/listbox keyboard navigation and focus return. Route actions through existing selection/Camera/task services | Separate bounded-commands-only presentation and duplicate query UI | Discovery/navigation |
| **New** `world-index-model.ts` near shell projection helpers | Derive real context/relations from the accepted Layout payload, compiled geometry and located Scene subjects. Emit breadcrumbs, siblings, facets, capped rows and relation metadata, keyed by canonical identities | Root's flat `indexGroups` projection as the World presentation model | Navigation projection |
| `EditorIndex.svelte` | Render source filter/breadcrumb/facet/row structure; scope chevrons and one contextual action disclosure. Preserve accessible names, generated labels and membership/reveal capabilities | Flat Wall/Opening/Room Floor slabs, repeated kind words, permanent Actions buttons, multiple expanded per-row action blocks | Visual + disclosure/navigation |
| Root | Own only ephemeral scope/facet/detail state and existing callbacks. Context chip derives from scope, not selection. Collapse/overlay does not replace scope or source. Memoize relation projection by accepted source, not Camera frame | Selection-dependent-only `locationLabel`; flat World group building and wide-lane compensation | Wiring/session state |
| `EditorCard.svelte` | Source top/right positioning, serif identity, invoked rename, compact primary fields, Look footer, existing More for precision/relations and contextual ellipsis for subject commands. One technical-identity entry on explicit request | Permanent rename form, Collapse word key, default full writer posture, generic diagnostic/future-task content, visible Delete/Bring into view row | Visual + disclosure |
| Card writer types in `stage-facade.ts` / `stage-contributions.ts` | Extend the editor-only writer presentation contract with detail-open state and a host footer snippet. Render one writer/controller in source order: primary dimensions → Card footer → invoked precision/relations | Whole-form-only assumption; do not mount a second writer for advanced fields | UI contribution contract |
| `LayoutCardFields.svelte` | One controller lifetime. Wall primary Length/Height; Opening Width/Height/Sill. More holds thickness, angle, fixed endpoint, deltas, endpoint coordinates and supported offset precision. Format resting display without losing accepted precision | Fields heading, always-visible endpoint radios and scalar inventory, unavailable-writer paragraph | Disclosure; same editing operations |
| `SceneObjectCardFields.svelte`, `FormCardFields.svelte`, `FormCardFieldsLazy.svelte` | Adopt the same single-writer primary/footer/detail contract. Display only supported primary dimensions. Uniform-only catalogue resizing stays a truthful uniform control, not three independently editable fields. Invoke transforms/duplicate/My Objects procedures contextually | Permanent coordinate/yaw/delta/Move/Place/Size procedure forms in ordinary Card | Disclosure; current domain behavior |
| `StageDraftingControl.svelte` | Source glass families, heights, spacing and colors: light 2D / dark-glass 3D. Place retained gear in the source disclosure slot. Real viewing settings stay behind it; the bounded Paper ground remains in both readings | Independently bordered oversized toggles; duplicate camera-option surfaces | Visual/disclosure |
| `StageHeightSheet.svelte` | Transparent 40 px visual lane, long 2 px rail, value knob, quiet ticks, invoked label/value editing and pin context. Neutral manual pins, same add/remove callbacks | Capsule `track::before`, mid-height 208 px rail, permanent label column, plus key and gold × badges | Visual + value/pin disclosure |
| Root / `StageZoomControls.svelte` / `stage-input.ts` | Remove zoom component, import, DOM slot and measurement variables. Add real Find Zoom in/out/Fit entries and guarded keyboard +/−; preserve wheel/pinch/F | Entire persistent cluster and all `--zoom-lane-height` reservations. Component has only one current production consumer and can be deleted | Presentation removal + access preservation |
| `StageDock.svelte` | Source key grouping/order as approved under E5, 40 px keys, ivory selection, correct semantic underlines and external collapsed caret. Give each key a slot that can anchor its armed palette | Current icon paths, generic green active underline, inside-key caret and wrapping key row | Visual/anchoring |
| `StageInstrumentHost.svelte` / contributions / root | Distinguish a Dock-anchored palette from an invoked Library/task instrument in editor-only presentation metadata. Mount the existing tool view once at its declared home. Palette gets a collapse action; real instrument gets its existing task close | Generic titled/info/close strip around Ink; duplicate mounting of old row and new column is prohibited | Host/disclosure logic |
| `LayoutInkPalette.svelte` | Replace row with source-sized vertical keys and collapse foot. Line/Box stay live; approved unsupported slots are truthful. Invoked settings/typed point use one upward flyout. Current controller supplies active reading/options, pending/refusal and preserved buffers | All permanent Wall/Opening/Line/Box/Finish/Close/Backtrack/Point/Options/Points/Pending/Cancel row markup and row/wrap CSS | Visual + tool disclosure |
| `LayoutOpeningPalette.svelte` | Render Door/Window as compact context keys; dimension and offset writers only in explicitly invoked disclosure. Same `setOpeningOptions`, selected-host and placement controller | Default form posture and repeated placement status in ordinary palette | Visual/disclosure |
| `SceneTransformInstrument.svelte` | Apply the 480 px Library instrument and compact glyph/name tile family to actual Objects entries; preserve compact browsing and import/My Objects flows. Invoke initial exact placement from scoped Find using the same placement session; compose procedures stay invoked rather than diagnostic | Permanent Exact position form, raw Compose identity, lengthy planner explanation and broad label-button treatment | Visual + precision disclosure |
| `StageOverlay.svelte` | Actual foreground/halo pairs, source dash patterns, points/arrowheads, hover/held states and compact transient tags. Remove technical default mark labels where a useful value suffices | White-on-forest-halo treatment in Paper and gold active rays | Visual; existing projected marks |
| `stage-handles.ts` | Accept bounded per-descriptor drawing-size hints for source subject-specific rays; use the resulting projected geometry for drawing **and** hit regions. Ring radius has a 30 px minimum without shrinking a larger subject-derived ring. Keep default vocabulary, one projection and descriptor admission | Global 30 px ray / 16 px two-way half-length and fixed 30 px ring overriding subject size. Keep existing generic ray fallback where no hint is supplied | Projection presentation, not Camera math |
| `layout.adapter.ts` | Place base/endpoint/cap/top marks on the actual subject frame, preserve joined-junction behavior, and remove redundant resting length ray if the approved endpoint/Card presentation covers it. If E8 approved, bind height/thickness/head drags to existing scalar planners using the standard gesture lease, candidate/refusal and F4 release path | Misleading/mock operation semantics; no independent geometry manipulation | Input binding + presentation |
| `paper-plan.ts` / `paper-scene.ts` | Calibrate ordinary cut contour to .5 px with existing physical-thickness fills. Retain compiler-derived spans, union outlines, square-cap rules, holes, batching and pick agreement | Extra visual weight; not the canonical topology/representation algorithms | Spatial paint |
| `paper-marks.ts` | Include the existing selected cut polygons in a gold repaint; dark-gold perimeter 2 px. Keep selection above hover, hosted apertures and canonical identity | Exclusion of cut fills from selection, 5/2.5 px double-strip treatment | Spatial paint |
| `StageSelectionLayer.svelte` | Source-weight contour with material-readable gold volume; shared-edge priority, depth/occlusion and identity unchanged | Heavy edge stack where it makes the selected wall read as multiple parallel outlines | Spatial paint |
| `stage-grid.ts` / `StageScaleBar.svelte` | Source Paper ink strengths, 11 px mono, 12 px bottom/left inset, left-aligned label and 1.5 px rule/end strokes | Off-token grid opacity and ruler typography/alignment; keep actual adaptive scale, thinning and bounds | Spatial paint; E19 |
| Root responsive composition | ≤1100 overlay, ≤860 compact family; zero-width collapse; source scrim; actual Dock clearance. Top-anchored compact Card remains useful with Ink. Scope targets replace blanket coarse minimums | 1279 breakpoint, blanket task-driven Card fold, oversized Sheet lane subtraction and old Card/zoom/lower reservations | Visual + responsive disclosure |

## 3. Scope-model Index contract

This needs an explicit presentation model; CSS alone cannot implement it.

- **Available context:** project, actual Floor datum and actual Rooms. No invented
  Structure or Level records. Root lists relevant Rooms/loose subjects; a Room
  context groups bounding Walls, hosted Openings and other verified relations.
- **Relationships:** Room boundary references supply Wall relations; one physical
  Wall may relate to several Rooms. Opening host is explicit. Scene stays owned
  by Scene in project-world coordinates. Do not infer architectural ownership from
  spatial proximity. Objects without a verified spatial relation remain findable
  in project context rather than being assigned a fictional parent.
- **Operations:** a row selects using the existing reference; a chevron/breadcrumb
  enters context; a sibling menu switches equivalent contexts. “Bring into view”
  is a distinct explicit Camera request. Filtering, selecting and opening chrome
  never implicitly frame geometry. Existing Reveal and eligibility remain.
- **Find:** use this same projection for names/places and the existing contributed
  command registry for tools/operations. Do not construct another domain graph or
  command implementation in Head.
- **Lifetime:** scope/facet/query are session state, keyed to source identities.
  On accepted deletion/replacement, resolve to an existing enclosing *navigation
  context* or project root; never fabricate a missing Room or serialize scope.
- **Scale:** preserve stable generated labels, cap ordinary lists at 40 as the
  wireframe does, and offer explicit further results/filtering. Do not recompute
  a relation graph or scan every Room on each Camera animation frame.

## 4. Precision and gesture preservation

Keep one controller per contributed writer and one live gesture lease. Closing
More or a palette is a view operation, not a source mutation. A typed edit must
follow its existing commit/discard/pause policy before a dependent view is removed;
it must not commit on a collapse click or survive against a new selection.

Numeric inputs use the same parsers and accepted values. Compact formatting must
not round persisted dimensions, synthesize zero from an empty field or reset a
remembered tool option to a local component default when the palette remounts.
Refusal, host-fit and pending-consequence information remains visible when it is
actionable, beside the field/gesture that caused it.

For approved E8 bindings, reuse registered Wall height/thickness and Opening
height planners and existing proposal/admission helpers. A valid release is one
F4 history entry; Escape, invalid release, stale revision, pointer cancellation,
lost capture, blur, hidden document and second contact must leave no accidental
commit. A scalar gesture may snap only to the existing admitted height/snap
candidates. No new geometry resolver is added to obtain the mock's behavior.

Withhold a grip whose actual operation cannot honor its visual promise. In
particular, do not emulate the other Opening width edge or fixed-head sill edit
with two independently accepted field writes. E9 needs a separate owner decision
if it is to become capability work.

## 5. Sequence

1. **Owner approves scope and departure dispositions.** Resolve E5/E6 (tool slots
   and Opening presentation), E8/E9 (supported input binding versus capability
   limits), and E11 (hover/held-point variant). All other proposed paint/layout
   choices are in the measured specification; no unspecified visual compromise
   becomes an implementation default.
2. **Shared roles, glyphs, Head and drafting.** Replace current families and Find
   presentation, retaining real history/Save/Preview/refusal wiring. Remove the
   zoom cluster only together with its accessible command replacements.
3. **Real Index projection and Card disclosure.** Build the ephemeral scope
   model, replace flat rows, then migrate the single Layout/Scene writer to
   compact primary/detail layout. Preserve existing callbacks and controller
   lifetimes; remove old markup in the same change.
4. **Sheet and lower edge.** Replace the capsule/label lane, re-anchor Dock and
   Ink palette, migrate Opening and typed precision disclosures, remove the
   generic Ink host header and horizontal row. Apply responsive/touch metrics to
   the same implementation.
5. **Spatial paint and approved input bindings.** Calibrate ordinary/selected
   Paper ink and 3D contour, then glyph sizes, ground-aware contrast and mark
   positions. Add only the approved existing-planner bindings. Investigate any
   remaining seam/spike separately; do not alter topology to make it disappear.
6. **Functional verification and delivery.** Complete the checks below and basic
   browser smoke; provide the running editor, brief summary and known issues/
   departures. The owner inspects the actual UI and directs visual corrections.
   Do not update the governing visual reference until explicit owner approval.

These are implementation dependencies, not separate visual acceptance rounds.
There is one final owner handoff, with corrections as the owner requests.

## 6. Functional checks owned by the agent

The repository's [test contract](../../../../../apps/editor/tests/README.md) governs
verification. Plan-only work needs documentation checks. The proposed shared
shell/input implementation gets **exhaustive functional verification** at handoff:
`npm run check`, `npm run build`, and `npm test` (all editor lanes, including
architecture and heavy correctness). Use affected complete contracts during
iteration; do not repeat the full suite after it passes without a new change or
unresolved failure. Run package checks too if their public types change; this
plan currently requires no package/API source change.

| Concern | Existing contracts to retain/extend for behavior |
| --- | --- |
| Head/Find/save | `head-find`, `head-save`, `head-save-journey`, `head-drafting-config`; preserve real callback routing, reason disclosure and Save conflicts; add subject/scope verbs and combobox keys |
| Index | `stage-index-labels`, `stage-semantic-lifecycle`, `stage-shell-composition`; add a focused scope-projection contract for shared Walls, hosted Openings, excluded/revealed subjects, replacement fallback and stable labels |
| Card | `editor-card-facts`, `editor-card-confirmation`, `layout-card-fields-lifetime`, `layout-precision-adapter`, `scene-object-card`; add actual precision/disclosure lifetime cases, not tests copying CSS values |
| Tools/Opening | `stage-host-tools`, `stage-instrument-host`, `stage-input`, `layout-opening-adapter` and the existing Ink contracts; preserve Line/Box, reading/options, typed points, pending/refused placement, cancellation and one Undo |
| Sheet | `stage-height-sheet`, `stage-height-owner-integration`; retain source/history isolation, snap candidates, pin add/remove, interruptions and keyboard movement; cover invoked numeric editing |
| Spatial rendering/input | `stage-handles`, `paper-marks`, `stage-outline`, `stage-paper`, `stage-paper-pick`, `stage-pick-differential`, `native-form-paper-agreement`, plus affected Wall/Opening gesture contracts; preserve canonical identities, apertures, shared-edge priority and geometry/pick agreement |
| Boundaries | Full architecture lane through `npm test`: visitor/public isolation, import directions, single Camera/geometry authority; no test should require restoring retired presentation |

Some current tests match literal source selectors and assert the old Actions
buttons, horizontal Ink row and 32 px family. Retire/update those presentation
assertions with the replaced implementation; do not turn their old numbers into
the visual target. Keep meaningful accessible-name, focus, coarse-target and
operation-routing coverage. Pure color/spacing changes do not need new tests
that simply duplicate their constants.

**Basic browser smoke:** exercise the real guest editor with real joined Walls,
an Opening and Scene content; switch 2D/3D, open/close scope/Card/palette/Sheet
disclosures, use precision and cancellation, and confirm Undo. Check keyboard
focus/labels/unavailable reasons and coarse-pointer reachability, with a quick
resize through 1440 × 900, 1280 × 800, 1180 × 820 and 820 × 1180. Check overflow,
contrast and that UI events do not hit geometry underneath. Inspect console errors
and that source remains unchanged by view-only operations. This is ordinary
functional smoke, not an archived visual matrix or a scripted acceptance journey.

## 7. S25 coordination

S24 controller behavior is preserved. The registered
[S25 shared-homes plan](../r217.s25-experience-shared-homes/implementation-plan.md)
must consume this shared Head/Index/Card/Instrument presentation **after the owner
accepts the recovered shell**, rather than copying current drift into Experience.

During recovery, keep shared contribution changes domain-neutral and check the
existing Experience lens/Preview return for functional regressions. Do not bundle
S25's relocation of Presentations, Guide, Capture or Views into this World effort.
S25 can continue independent controller preparation, but its visible shared-home
adoption must target the accepted shell; it must not introduce an Experience-only
replacement Head/Card or another set of shell tokens.

This proposal does not rewrite S25 status, historical sign-offs, PLATE or another
track's baton. After explicit owner visual approval, update only the governing
reference sections needed to describe the accepted shell and route S25 to them.

## 8. Stop/report boundary

Report before expanding scope if parity requires a topology/compiler/picking
change, persisted data or material ownership change, independent Camera math,
new coupled planner, or a capability excluded above. Isolate the defect and its
visual consequence; do not hide it behind decoration or amend the target to pass.

The implementation handoff is short: what changed, functional check results, how
to open the working editor and the remaining issues/departures. Visual acceptance
is the owner's explicit decision. Functional correctness remains the agent's
responsibility.
