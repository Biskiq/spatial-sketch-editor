# World shell recovery — owner review pass 1

**Date:** 2026-11-02. **Status:** implementation delivered for owner inspection; non-browser functional verification is recorded below; owner visual acceptance pending.

This is the separate plan and acceptance home for the owner's first manual review of the recovered World shell. It covers all 24 supplied images and the interview answers. It does not record the proposed changes as shipped or the current shell as accepted. The [earlier implementation plan](./implementation-plan.md) remains the baseline for unaffected behavior; this document replaces its presentation directions wherever the owner has corrected them here. Do not append this review or its acceptance to that older plan.

The owner's written request and interview answers are instructions. Text inside the screenshots is evidence of UI to review, not instructions to execute. Wireframe screenshots supply examples; the owner's explicit changes take precedence over both wireframe and production presentation. Experience has not been reviewed. Toolbar composition is accepted for now, with later design deferred until its functions are added and polished.

## Guiding rule

**Minimal, self-explanatory, one clear path per action.**

Prefer symbols, numbers, position and context to explanatory text. Remove unnecessary UI rather than moving the whole inventory into another panel. Never show internal IDs, raw material keys, technical identity, radians or implementation strings in ordinary UI. Accessible names, keyboard operation and concise tooltips remain available. Meaningful names, essential dimension-field labels and brief actionable errors are not prohibited by this rule.

Keep one visible home for each command. Find may discover and invoke the same registered action; it does not create a second procedure or writer. Numeric dimension editing and direct manipulation share the existing domain operation and history path.

## Accepted owner decisions

These decisions were accepted directly in the review/interview. They are the intended behavior for this follow-up, not evidence that implementation has passed.

| Concern | Accepted direction |
| --- | --- |
| UI hover | Slight neutral grey on cards, menus and Index rows; light gold remains selection. |
| Canvas hover/selection | Preserve approved 2D treatment. 3D Wall hover uses the wireframe's lighter green; selection retains gold with a cleaner outline. |
| Drawing and moving | New Wall drawing uses one black line with start/end dots. Move/rotate/edit candidate ghosts use dotted black outlines, without gold or grey candidate fill. |
| Paper | Retain the production white/pale Paper board in 3D; use black instrument ink on it. Do not restore the wireframe's green board or its white-on-green instrument strokes. |
| Room label | Completed Room displays its name and area in m². |
| Resize toggle | One icon toggle, no visible D/W/H letters. Remains pressed through resizing, selection changes and 2D/3D switches until pressed off; reload starts off. |
| Height in 2D | Remove canvas height handles only. Height inputs remain available on the Card. |
| Card disclosure | One compact floating panel anchored to its action button; opening it does not grow the Card. Keep essential dimensions; remove technical identity and coordinate/rotation forms. |
| Hierarchy | Project → Rooms and Free objects; hide the single Floor breadcrumb until real level navigation exists. Room grouping is organizational, not transform parenting or cascading deletion. |
| Membership control | One Room control in the Card disclosure: Auto, a named Room, or Free. Explicit choices persist; Auto follows accepted placement. |
| Invalid drawing | One local problem marker with a short explanation on hover/focus; no duplicate technical warnings. Empty-workspace warnings disappear. |
| Rename | Double-click the Card name, type, Enter. No separate ordinary Rename row/button. |
| Scope | World review only. Preserve toolbar composition for now; Experience review remains outstanding. |

## 1. Clean 3D Wall outline and exact colours

**Complaint:** production outlines the Wall's thickness and many mesh edges, creating a heavy stack; wireframe hover is lighter green and selection is brighter gold. Images 1–2.

**Finding at source revision `6b17defb`:** the wireframe and production shell roles both contain leaf `#4f8f6c`, gold `#d4ad45`, gold ink `#74560c`, gold tint `#f8efd6`, and ink `#1b201c`. The production 3D selection layer also uses matching leaf/gold constants. However, hover combines a 3.5 px dark halo at .9 opacity with a 1.8 px leaf stroke at .6 opacity; selection applies a .28 gold material overlay. It enumerates edges per rendered mesh. Matching constants therefore does not establish matching apparent colour or contour weight. Material compositing is a plausible contributor; no browser/rendered-pixel parity claim has been made in this planning pass.

**Solution:**

- Use one restrained visible identity contour for the selected/hovered Wall. Derive it from existing compiled/rendered geometry, suppress internal seams and redundant near-parallel thickness edges, and preserve meaningful outer boundaries and opening apertures. Do not flatten actual Walls or change picking/topology to mimic a thin mock.
- Start from the wireframe's 2.5 px leaf hover and 3 px gold selection strokes, then assess contour density on the real thick Wall. Remove the dark hover under-stroke where it causes muddy colour; do not apply a dark halo by default on Paper.
- Use the exact semantic colour values through a shared role mapping. Inspect opacity, colour-space conversion, tone mapping, depth and compositing separately before changing any hue. Keep overlay appearance independent of authored material edits. Preserve authored materials.
- Selection wins over hover on a shared edge; hidden surfaces must not show through. Keep real openings legible, including oblique and edge-on views.

**Acceptance:** owner sees a single clean Wall identity rather than an outlined box of repeated edges; hover reads as the specified leaf and selection as gold across light/dark materials. The already-approved 2D cut-band hover/selection remains unchanged. If contour extraction requires a new architectural reconstruction, stop that expansion and report it; this plan permits presentation derived from the existing authority only.

## 2. Ink, Room labels, ghosts and live values

| Complaint / evidence | Proposed solution | Acceptance |
| --- | --- | --- |
| Boxy Wall drawing, extra handles and wordy tags (3–5) | While drawing, render one solid `#1b201c` path with small start/current-end dots. A box/closed-chain draft uses the same thin perimeter, without thickness extrusion, intermediate controls or area fill. Render physical thickness after acceptance. | 2D and 3D drawing share this language on Paper; one compact length such as `13.50 m`, no “Length”, “Angle”, “Grid” or “Aligned” text. Snap state uses the relevant geometric symbol. |
| Completed Room has no name/area (6–7) | Use the accepted Room identity/name and compiler-derived usable area. Position a quiet name plus area inside a valid interior label location, with zoom/collision decluttering. Generated names read “Room 1”, not “Draft Room 1”, once the Room is accepted. An authored name is not silently rewritten. | Closed, accepted Rooms show e.g. `Room 3` and `24.1 m²`; an open/invalid loop does not acquire a fictional Room. Edits/Undo update area; renamed Rooms update everywhere. |
| Heavy black control dots obscure arrows (7; also 1, 11) | Remove decorative anchor disks beneath self-explanatory translation/thickness/height arrow glyphs. Keep larger invisible hit targets. Keep actual endpoint/junction points where the point itself is the control, and the two drawing endpoints. | Arrows are readable without black knobs obscuring them; endpoints remain operable. This does not redesign approved 2D selection colours. |
| Gold/grey move ghosts (8, 12) | Render the proposed destination as dotted black boundary lines without candidate fill. Preserve accepted source geometry and its existing selection; never confuse it with the proposal. Use the same ghost treatment for moving, rotating and resizing Walls and supported objects. | Dots remain readable at different zoom/DPR. Commit replaces the proposal; Escape/invalid release leaves source untouched. Candidate ink is neither selection gold nor neutral-grey fill. |
| Duplicated Junction/transform tags and absolute values (8–9, 12) | One tag at the active gesture. Use signed invocation-relative values: `Δ +0.50 m`, `Δx +0.30 · Δz −0.20 m`, or `Δθ −13.4°` only as needed. Capture the baseline at gesture start; every new gesture starts at zero. Remove “Junction”, “Yaw”, “Move”, repeated wall counts and duplicate tool/handle output. | Rotate an already-rotated object: initial reading is `0°`, not its world angle. Repeated edits, snapping, cancellation and angle wrap remain correct; one tag only. |
| White ruler disappears on pale 3D board (20) | Both the Measure line/end ticks and the passive scale bar use black ink over Paper in either reading. Keep a minimal light halo only for overlap contrast. | Measurement remains readable across grid, objects and selection; values retain units. |

**Value semantics:** drawing a new segment shows its current length, not a misleading displacement from an existing object. Omit a drawing-angle value unless an explicit guide supplies a meaningful relative baseline. Existing-object transform previews show changes from the captured baseline, never arbitrary world headings. Dimension fields on the Card show actual dimensions. If resizing needs both change and result, use one compact reading such as `Δ +0.20 m → 3.20 m`, not two tags.

**Geometry integrity:** a thin visual draft still uses the real planner candidate for validation and commit. Hiding thickness in the draft does not change the requested Wall thickness, snap calculation, opening fit, topology or accepted geometry. No generated preview is serialized.

## 3. Object controls and resize-mode lifetime

Images 10–12 establish the missing rotation arrows, mis-centred move cross, redundant movement point and height leakage into 2D. The resize control also closes after an edit.

- Centre the four-direction move glyph on the actual projected manipulation origin. Remove the extra dot that invokes the same movement. Draw the rotation ring with clear open arrowheads; its live reading is only the signed angular delta.
- Replace visible D/W/H text with one accessible resize icon and pressed state. Width/depth handles appear in 2D; height manipulation is canvas-only in 3D. Card height fields stay available in both readings.
- Store resize visibility as editor session intent outside a transient proposal/selected-object controller. Finishing, cancelling or refusing a resize must not reset it. Selection changes and view switches retain intent; an ineligible subject simply exposes no unsupported handles. Reload initializes it off. This state is not authored project data.
- The 2D path must not change height indirectly: a uniform-only resize that necessarily changes height cannot masquerade as width/depth-only editing. Withhold that planar handle unless an admitted operation can preserve height; use the current supported Card operation until a separate capability is available.
- Preserve separate visual glyphs and hit regions, keyboard/touch access, gesture capture, cancellation and one accepted history entry. One operation has one handle; no duplicate centre dot and cross.

**Acceptance:** turn resize on → resize repeatedly → cancel once → select another supported object → switch 2D/3D → still on; press off → hidden. No height canvas affordance in 2D, and no hidden height mutation from a purported planar resize. Ring arrows and the centred cross remain legible for short, long and rotated objects.

## 4. Compact Card, one disclosure and inline rename

Images 13–17 show the current inventory of dimensions, technical identity, transformation procedures and expanded action rows.

**Ordinary Card:** name, essential supported dimensions and a small set of useful icon actions. Keep concise dimension labels where needed to distinguish fields: Wall length/height; thickness in the compact disclosure; object width/depth/height as supported. Do not invent independent per-axis editing for uniform-only objects.

**Remove:** Datum, raw elevation facts used as diagnostics, role/bounding-derived text, fixed-endpoint radios, absolute angle/yaw, endpoint coordinates, Move ΔX/ΔZ forms, Move and Place/Turn forms, raw material keys, Canonical ID, Domain, Technical identity and duplicated transform procedures. Remove these from the ordinary product disclosure as well; do not merely hide the same long diagnostic list under another tab. Preserve underlying domain behavior and developer diagnostics outside this UI.

**One anchored panel:** use the Card ellipsis as the single secondary entry. Merge the useful remainder of More and subject actions into that compact, light panel; remove the redundant More entry. Opening it does not add rows to or push down the Card. Keep thickness and the proposed Room assignment here; retain supported secondary actions such as Duplicate/Delete/My Objects once each. Use bounded groups, no technical identity subpanel. If the available content would produce a long form again, defer that procedure instead of expanding this surface.

The panel closes on Escape/outside activation, returns focus to its trigger, stays within the viewport and does not forward pointer events to the Stage. Closing never commits a partially typed value. One writer instance remains mounted/owned across disclosure changes; stale drafts cannot apply to a different subject. The existing planner determines dimension-edit anchoring; removing fixed-endpoint controls must not introduce a silent, different resizing rule. Any missing way to express necessary endpoint intent is a separately reported interaction gap.

**Rename:** double-click the name replaces that title in place with a selected text input. Enter commits via the existing name writer; Escape cancels; clicking away cancels an uncommitted draft. Keep keyboard Enter/F2 on the focused title and touch activation on the same title as access paths. No extra Rename form, submit button or duplicate menu command. Blank names retain the prior name with one concise local validation message; failures preserve the editable draft. Commit updates Card, Index, room labels and Find and creates one history entry; Undo restores the name. Verify Wall, native form and catalogue-object name-writer availability; report any missing writer as capability work rather than faking a session-only name.

## 5. Light menus, grey hover and quiet empty states

- Use light Card-family material for the gear panel in 2D and 3D (18–19). Replace bare native-looking form controls with shared styled selects/segmented controls as appropriate, retaining keyboard semantics, focus and contrast. Existing real settings remain functional; the final gear-menu contents are TBD.
- Use `Lorem ipsum` only for explicitly nonfunctional placeholder content awaiting design. Placeholder rows must not look like working settings. Do not replace actual setting names, errors, object names or accessible descriptions with filler text; do not add placeholders where removal leaves a cleaner useful surface.
- Use a subtle neutral-grey hover role on light UI surfaces instead of leaf tint. Keep held/selected rows light gold and keyboard focus distinct. Leave the established dark toolbar composition alone in this pass.
- Remove the empty-workspace warning (21) without replacing it with another banner. An empty project is an ordinary usable state; Ink/Objects remain the obvious entry points.
- Replace the duplicate crossing warnings in 22–23 with one local problem marker at the relevant geometry. Hover, keyboard focus or touch reveals a concise remedy, e.g. “End this line on the wall.” No UUID, internal chain name or “Junction” terminology. Keep a brief accessible announcement when commit is refused; do not silently accept invalid geometry or silently fail.
- Route each problem through one presentation owner. The tool, overlay and global toast must not all repeat it. Technical diagnostics remain available to development tooling; legitimate save/import errors remain actionable, without raw identities.

**Acceptance:** opening menus does not change geometry; grey hover never reads as selection; dropdowns match the Card family; there is one discoverable explanation for an invalid operation and zero empty-workspace warning banners.

## 6. Hierarchy proposal and capability boundary

Image 24 also shows three competing location actions. The accepted shell direction is a navigable Project containing Rooms and Free objects, not a fictional multi-level structure.

### Navigation now

- Hide the single Floor breadcrumb/context row; retain the actual Layout datum internally. Do not delete or migrate it to achieve a cleaner breadcrumb. Real level navigation is future work.
- A row selects; the Room chevron enters that Room's context; breadcrumbs return to an ancestor. Remove “Open location” and “Go to Room…” duplicates. Keep one framing icon in the Card for Bring into view; do not duplicate it in expanded Index action rows. Framing invokes the existing Camera service and remains separate from navigation/selection.
- A Room context shows its true bounding Walls, hosted Openings and related objects. Shared Walls can appear as references in both Rooms without duplicate source objects. Room counts must count the displayed member subjects consistently.
- Auto-grouped objects appear once at the relevant Room; unassigned/free objects stay at project scope in a Free group. Search can still find every object. A spatial relation is not an authored transform parent.

### Automatic and explicit membership

The one Room control offers **Auto / named Room / Free**. The owner accepted persistent explicit choices. This is an organizational relationship; choosing a Room must not teleport an object, rewrite its world transform, attach it to a floor, or change Layout ownership.

| Mode | Behavior |
| --- | --- |
| Auto (default) | Resolve the object's actual resting/support relation against the accepted compiled Room floor. Re-evaluate after committed placement/move and accepted floor/topology changes. Use the existing support authority; do not build an independent nearest-Room/point-in-polygon resolver in the shell. |
| Named Room | Keep the chosen organizational association after moves until changed by the user. It may differ from physical location. Do not claim it is physical support. |
| Free | Keep the object at project scope even if placed on a Room floor. This is explicit, not a temporary failure to calculate Auto. |

For Auto, use an unambiguous resolved support contact, not mere plan-view overlap. A floating object or unresolved/ambiguous contact remains Free; a named assignment is not inferred from closest centre or largest overlap. Reuse the domain's support tolerance and qualified result. If that result does not expose a stable Room identity, defer the grouping rather than guess. During dragging, keep the Index stable; update after acceptance. Undo/Redo restores assignment-related accepted state. Room deletion must leave objects intact and visible at project scope; deletion recovery and explicit-assignment invalidation need a domain policy, not a hidden shell mutation.

### What can land with presentation, what needs a follow-up

**Verified constraint:** [Scene content](../../../reference/components/scene-content.md) currently specifies world-local placement and explicitly rejects `roomId` on Scene entities/clusters. Its support resolver uses a compiled Room floor or the Layout datum. The current [Index projection](../../../../apps/editor/src/lib/authoring/stage/shell/world-index-model.ts) adds Room relations for Layout objects with existing membership, but does not derive Scene support membership. Therefore the full proposal is not a CSS-only recovery.

| Work | Boundary / owning follow-up |
| --- | --- |
| Hide Floor breadcrumb, simplify navigation and remove duplicated actions | Recovery shell presentation; retain real source datum and existing selection/Camera services. |
| Display verified Auto membership | T1/T2/T5 support-consumer integration, only if existing qualified support can be consumed without a new persisted format or competing resolver. Otherwise defer with the missing query explicitly named. |
| Persistent Auto/named/Free policy | Separate Scene organizational-association design with Layout references, persistence, validation, deletion and Undo semantics. Never add a forbidden `roomId` property or use shell local storage as a fake durable substitute. T2 owns Scene integration, T5 native forms, T1 Room/support references. |
| Multiple Levels/Structures and their navigation | Deferred architectural capability; expose only once actual domain records and navigation exist. |

Until durable membership is available, show only verified relationships and keep all other objects reachable at project scope. Do not present a working named/Free control that forgets its selection on reopen. Record the missing capability in this plan's delivery section and carry it into shell/domain reconciliation; the UI proposal is accepted, its storage contract is not yet designed.

## 7. Implementation sequence and source map

The owner released this implementation on 2026-11-02 and requested a commit after completion. The recovery verification contract applies. The owner explicitly prohibited browser launches, captures and browser smoke for this pass; the agent owns code correctness and the owner owns visual acceptance. No slice or phase is closed by this delivery.

| Order | Work / principal existing owners |
| --- | --- |
| 1 | Establish semantic paint roles and clean 3D identity contour: `shell-roles.css`, `StageSelectionLayer.svelte`, `stage-outline.ts`. Confirm colour processing before tuning opacity. Preserve `paper-marks.ts` selected/hovered cut-band behavior. |
| 2 | Thin draft and dotted candidate rendering, one delta tag, black Measure/scale bar: `StageOverlay.svelte`, Layout/Scene adapters and their candidate renderers. Retain canonical candidates, shared projection and existing gesture leases. |
| 3 | Correct projected glyph placement, ring arrows, dot removal and planar admission: `stage-handles.ts`, Scene object/form marks and `scene.adapter.ts`; move resize-toggle intent to session lifetime. |
| 4 | Compact Card and one anchored panel, inline name editor, neutral UI hover, light styled gear: `EditorCard.svelte`, `LayoutCardFields.svelte`, `FormCardFields.svelte`, `SceneObjectCardFields.svelte`, `StageDraftingControl.svelte`. |
| 5 | Room name/area, simplified Index and verified hierarchy projection: `EditorIndex.svelte`, `world-index-model.ts` and the existing Room/Scene read models. Decide capability admission before adding any membership writer. |
| 6 | Remove empty banner and duplicate refusal surfaces; run functional verification and deliver working editor for owner inspection. Record results and explicit deferrals below. |

These filenames identify inspection entry points, not a restriction on verification scope. Inspect callers and tests before changing shared contracts. Geometry, F4 transactions, history, persistence, existing typed precision operations, Camera and visitor isolation remain intact. Unsupported per-axis scaling, automatic wall splitting or attachment behavior must not be smuggled into visual cleanup.

## 8. Verification and acceptance record

### Planning verification

Run the [documentation gates](../../../../apps/editor/tests/README.md#running) for this Markdown-only change. No product behavior or browser parity is claimed by this planning pass. The preserved owner attachments are source evidence, not newly generated acceptance screenshots.

### Implementation verification required

The inherited tier is **exhaustive functional verification**: `npm run check`, `npm run build`, `npm test` (all editor lanes), plus affected package/API checks if future admitted changes reach them. Run meaningful complete affected contracts while iterating; do not replace functional coverage with tests that copy CSS constants.

- Exercise thick/joined/opening-bearing Walls in 3D; verify outline identity and picking remain aligned and approved 2D paint is preserved.
- Draw Line/Box/closed Room in both views; inspect thin drafts, commit geometry, name/area and cancellation.
- Move a Wall endpoint and junction, rotate an already-rotated object, resize repeatedly, cross the angular wrap and snap; confirm signed zero-based deltas, one tag, black dotted candidates and one Undo per accepted operation.
- Check resize-toggle lifetime, supported/unsupported subjects, planar height preservation and retained Card height editing.
- Rename Wall/form/object by pointer and keyboard; check Enter/Escape/blur, refusal, persistence, Undo and all name consumers.
- Open/close the panel/gear with keyboard, pointer and touch; verify focus return, accessible names, invisible hit targets, no click-through and no accidental write on dismissal.
- Verify Room/Free visibility, shared Walls, deletion, search, Undo and any admitted support-derived membership. Persistent assignment needs save/reopen coverage when its capability lands.
- Check empty and refused drawing states, one problem marker/explanation and no identity leaks. Check actual save/import errors remain available.
- Browser smoke and captures are excluded by the owner's implementation instruction. Mounted DOM tests exercise shared shell and editor interactions; exhaustive domain, architecture and build checks cover functional regressions. The owner inspects appearance, contrast and clipping in the working editor. This is not an Experience design review.

Visual/UX acceptance belongs exclusively to the owner inspecting the working editor. No agent visual score, independent visual approval, new screenshot matrix or phase-close ceremony substitutes for it.

### Acceptance — recorded only here

| Item | State |
| --- | --- |
| Review instructions and interview decisions | Accepted by owner on 2026-11-02; folded into the rules above. |
| Technical implementation | Implemented in the delivery commit containing this record, based on `6b17defb`; commit identity is reported with delivery. Existing materials and 2D cut-band paint remain unchanged. |
| Documentation checks | Planning check passed 2026-11-02: `npx vitest run --config vitest.arch.config.ts tests/docs` from the editor workspace; 2 files, 56 tests. The complete implementation suite also passed both documentation files (56 tests). `git diff --check` passed. |
| Functional implementation checks | Passed 2026-11-02: `npm run check` (0 errors, 0 warnings), `npm run build`, `npm test` (271 files, 3,510 tests; all editor lanes), `npm run check:layout-core` and `npm run check:project-model`. Mounted DOM coverage includes dismissal, inline rename, one writer, cancelled drafts, history and Save isolation. Domain coverage includes planar height preservation, resize intent, accepted support projection, concave Room labels and joined/opening-bearing contour extraction. No browser was launched and no capture was taken, per owner instruction. |
| Owner World visual/UX acceptance | Partial, 2026-11-02: the owner reports every item not reopened in [review pass 2](./review-pass-2-plan.md) as good and addressed. Reopened: draft end mark, drag-candidate presentation, refusal marker, Card disclosure, rename coverage, object/Wall gizmo glyphs and knobs, 3D Room labels. |
| Experience design acceptance | Not reviewed; outside this pass. |
| Capability deferrals | Durable Auto/named/Free assignment and real Level navigation remain deferred under §6. Verified Auto projection is implemented through `resolveSceneSupport`, admitted contact metadata and unambiguous Room witnesses. Native forms, catalogue/primitive objects and Rooms have no contributed persisted name writer; their titles do not offer a fake rename. Wall and Opening inline rename use the existing writer. Removing fixed-endpoint radios retains the existing default anchor; choosing the other fixed endpoint remains an interaction gap. |

The delivery records implementation and check outcomes here. The owner's visual acceptance statement/date remains pending until explicitly given. A proposal acceptance or a passing test suite must not be recorded as visual acceptance. Keep further corrections folded into their owning sections rather than appending a chronological review diary.

### Reconciliation after owner visual acceptance

Update only the affected owning sections of the [shell contract](../../../reference/design-system/editor-shell-and-visual-system.md) and [spatial instrument grammar](../../../reference/design-system/spatial-instrument-grammar.md): ground-relative black ink, delta-only feedback, reduced anchor disks, neutral UI hover, Card disclosure/rename, persistent resize mode and truthful hierarchy projection. Keep unchanged domain semantics and distinguish landed behavior from deferred membership/level capability. The [Scene contract](../../../reference/components/scene-content.md) must not describe persistent organizational assignment as landed before its own explicit cutover. Route S25 to the accepted shared shell without treating this World review as Experience approval. Old recovery plans receive a link only; historical acceptance records remain intact.

## Supplied image evidence

Images are byte-for-byte copies of the owner's attachments, numbered in submission order. They are observations/examples, not authority for unrelated functionality visible in a screenshot.

| Images | Evidence |
| --- | --- |
| [1](./review-pass-1-images/image-01.png), [2](./review-pass-1-images/image-02.png) | Production / wireframe 3D Wall outlines and colours. |
| [3](./review-pass-1-images/image-03.png), [4](./review-pass-1-images/image-04.png), [5](./review-pass-1-images/image-05.png) | Thin wire drawing versus boxy production line/Room draft and labels. |
| [6](./review-pass-1-images/image-06.png), [7](./review-pass-1-images/image-07.png) | Completed Room name/area and excessive control disks. |
| [8](./review-pass-1-images/image-08.png), [9](./review-pass-1-images/image-09.png) | Move candidates, duplicate values and technical Junction tag. |
| [10](./review-pass-1-images/image-10.png), [11](./review-pass-1-images/image-11.png), [12](./review-pass-1-images/image-12.png) | Object movement/rotation glyphs, centre alignment, height leakage and Yaw feedback. |
| [13](./review-pass-1-images/image-13.png), [14](./review-pass-1-images/image-14.png), [15](./review-pass-1-images/image-15.png) | Wall/object Card clutter, technical identity and transform forms. |
| [16](./review-pass-1-images/image-16.png), [17](./review-pass-1-images/image-17.png) | Compact light floating action-panel and Card references. |
| [18](./review-pass-1-images/image-18.png), [19](./review-pass-1-images/image-19.png) | Production gear versus light styled disclosure reference; content remains TBD. |
| [20](./review-pass-1-images/image-20.png) | Low-contrast white ruler over pale Paper. |
| [21](./review-pass-1-images/image-21.png) | Unwanted empty-workspace warning. |
| [22](./review-pass-1-images/image-22.png), [23](./review-pass-1-images/image-23.png) | Repeated example of duplicate crossing warnings with raw identity. |
| [24](./review-pass-1-images/image-24.png) | Redundant Room navigation actions. |
