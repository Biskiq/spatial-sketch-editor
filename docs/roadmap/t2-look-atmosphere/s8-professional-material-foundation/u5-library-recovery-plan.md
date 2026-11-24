# T2.S8 U1–U5 visual and interaction parity recovery

**Goal** Recover visual and interaction parity for the shipped U1–U5 Appearance flow on the
working [#406](https://github.com/Biskiq/spatial-sketch-editor/pull/406) foundation. Implement the
Library recovery below, the [#405](https://github.com/Biskiq/spatial-sketch-editor/issues/405)
Paint colour picker gap, and the owner-directed World toolbar, Furnish and Escape fixes.
Use the approved [#399](https://github.com/Biskiq/spatial-sketch-editor/pull/399)
[runnable design](../../../../prototypes/appearance-ux/app.html),
[responsive board](../../../../prototypes/appearance-ux/board.html) and
[decision sheet](../../../../prototypes/appearance-ux/index.html#flow) for concrete states.
The [existing Library findings](./u-prototype-production-parity-harvest.md) and the decisions
below are the implementation brief. Start implementation from them and check rendered parity
in this PR. A new prototype harvest is unnecessary.

## Delivery boundary

**U5 owns the complete Library UX**, including the approved D9 *Customise…* journey into the
Material editor. U5 builds the responsive editor surface, its draft states and the Stage
preview interaction. It connects the production operations already available and gives each
unavailable field or action a truthful state in the same surface.

**U6 extends that same editor.** It connects remaining exact-edit capabilities and the
Finish Card entry point to the U5 surface. U6 also delivers the separate Align, import and
repair workflows. **U7** connects *Save to My library* and delivers the private source and
transfer. This recovery split supersedes the earlier slice handoff. Verify shipped U1 thumbnail,
U3 colour coat and U4 Finish Card behavior along the review journeys below. Correct material
deviations with a clear approved target in those journeys. Preserve existing authoring,
selection, history, persistence and visitor boundaries.

## Paint, World toolbar and focus recovery

- **U2 Paint colour picker.** Open *Paint colour* from *Custom colour* in the quick Colours strip,
  including while the strip is collapsed. Anchor a compact floating picker above the trigger within
  the usable Stage, with the wheel prominent, Lightness, palette chips, Hex, close and a compact
  action row. Keep it reachable at narrow widths and with touch and keyboard. The tray's own
  expansion still exposes the palette and materials. Reuse the wheel, Paint state and palette
  commands. Wheel, Lightness and Hex edits stay local. *Done* arms a literal colour, a palette
  chip arms its linked slot, and *Add to palette* uses the existing one-Undo slot-add command
  and arms the returned linked slot after success. Preserve the current pick on dismiss or
  refusal, explain a full palette, and keep the picker available after a rejected add. Close and
  Escape dismiss the picker first and return focus to *Custom colour*. Opening, editing, choosing
  a swatch or arming a colour leaves project content unchanged. Paint gestures still commit
  through the existing owner.
- **World toolbar expansion.** Use Paint's detached tray as the reference. Build, Form and
  Landscape put their existing quick controls in a separate hovering strip above the stationary
  dock, with the same visible Stage gap as Paint. Use the same placement for Furnish and any
  existing Erase controls shown above the dock. Select stays strip-free. Keep matching dock
  alignment, measured side lanes, safe insets and usable scrolling on narrow screens. Show one
  tool strip at a time. Keep the existing tool choices, gestures, remembered options and collapse
  behavior. Limit the layout change to the World dock; Experience and Object Studio remain
  outside this change.
- **Furnish.** This owner decision supersedes #399's direct Library launch. Clicking or
  keyboard-activating Furnish toggles a small hovering quick strip in placeholder state, with
  the current selection intact and no placement armed. Its sole action is *Browse all*, which
  opens the shared Library on Objects in ordinary browse mode.
  Dismissing the Library returns to the strip and focuses *Browse all*. Keep existing Library
  object, artwork and light paths and their placement owners. The strip has no asset tiles or
  placement actions yet. The long-term interaction is shared with Paint: quick choices live in
  the strip, and *Browse all* leads to Library detail for customisation and adding to quick
  access. In this PR, the existing Material *Favourite* action continues to populate Paint quick
  access. Furnish's asset customisation, pinning and quick picks remain future work.
- **Escape and focus.** Fix the stale grey halo on the previously used dock key, such as Build,
  after Escape has returned the editor to Select. If focus was on that key or in the closing
  strip, move it to Select. Keep existing Stage focus when it is already there. Keep a visible,
  in-key keyboard focus indication and the separate armed state. Preserve the existing order
  for cancelling gestures, dismissing deeper surfaces and clearing selection. Library, draft
  and picker close paths still restore focus to their respective invokers.

Use the existing [World toolbar](../../../../apps/editor/src/lib/authoring/world-toolbar/WorldToolbar.svelte),
[Paint tray](../../../../apps/editor/src/lib/authoring/stage/shell/StagePaintTray.svelte)
and [Stage keyboard handler](../../../../apps/editor/src/lib/authoring/stage/route/stage-keyboard.ts)
as integration points.

## Integration decisions

- **Shell and browse.** Fit the approved Stage-bounded Library to production's measured shell lanes
  and use its portrait bottom-sheet behavior. Keep Stage context, dock access and focus return.
  Render the nested Materials families, compact project shelf with an overflow link in All, and
  square card hierarchy using the existing browse model. Keep the supported Object, Artwork and
  Light paths, search, source filters, favourites, usage and Concrete variants. Hold the last browse
  view in editor session state across close and reopen. Clear transient detail and invocation state
  when the context changes.
- **Invocation and writes.** Paint's *Browse all* opens Materials in Paint-pick mode. The dock
  and `L` open Replace with a qualified selected target in Select mode, or browse otherwise.
  *Swap…* opens Materials with the Card target and reach. Use the same action for card click
  and keyboard activation. In Paint, arm the choice with zero project writes. In Replace,
  use the existing assignment. In Swap, send eligible curated choices through the existing
  treatment-preserving command. In ordinary browse, curated cards arm Paint and project
  cards select their existing users when present. The separate detail control never chooses.
  Shift keeps the Library open for Paint, Replace and Swap; selecting users returns to the
  Stage. Show intent and write target before activation, and requalify the captured target
  and reach before a write. Refuse stale or unsupported targets in place.
- **Interactive detail.** Share the Stage's existing E7 inspection host with the thumbnail service.
  Start interactive work only for the active detail, with real geometry and lighting controls and
  resolved source facts. Release the request on change or close. Use World lighting only with a
  qualified anchor and explain unavailable modes. Browse continues to use thumbnail derivatives.

## Customise and draft editor

- **Open and retarget.** *Customise…* opens the shared Material editor directly from Library
  detail, including with no selected target or alternate sheen. Use the approved wide and portrait
  compositions. Seed the draft from the chosen Finish. Preview it on the qualified selected
  target when present, or prompt for a target. Clicking another eligible surface moves the
  cobalt proposal through the existing Stage interaction path. Use the render-only Finish
  projection where it supports the draft and target. When it cannot project the draft, keep
  the proposal visible and explain why the Finish preview is unavailable. Keep the draft target
  separate from canonical selection. Handle an ineligible target without moving the proposal.
- **Present and edit.** Build the approved draft header, target and no-write status, inspection
  and compare area, Raw material and Exact finish sections, original-value and reset states, and
  action footer. Use real resolver data wherever available. Changes and resets update the local
  draft. Preserve the working sheen adjustment and wire other fields when existing validation
  and draft preview support them. An unavailable field stays in its approved position with a real
  value when known, a disabled action and a concise inline reason. Layers, masks and brush are
  outside this flow.
- **Provide one handoff.** The existing Finish authoring adapter supplies the editor with source
  and draft values, target eligibility, preview and per-field or action availability. U6 adds
  capabilities there and reuses the editor's controls, layout and state handling. Use the
  existing inspection host and Stage ownership paths throughout.
- **Commit or cancel.** *Apply to…* uses one existing qualified authoring operation and one Undo.
  An unchanged draft can assign its existing Finish to a different qualified target. Preserve
  #406's same-Finish sheen Apply, including shared reach and stale-target refusal. Enable other
  edits only when the adapter can preview and apply the entire draft in one operation. A draft
  that existing commands cannot apply stays open with a reason. *Use for Paint* arms an existing
  eligible Finish without writing. An edited draft needs a compatible Paint path before it
  can be armed. Keep *Save to My library* visible with an unavailable state until U7 connects it.
  Cancel, close and Escape discard the draft, release its previews and return focus to the
  invoking Library control when available, or to the Library key. Preview and unavailable actions
  leave accepted state and history untouched.

## Evidence for review

Compare representative desktop and portrait states under the
[shared design-review workflow](../../../workflow.md#design-and-reference-maintenance). Use the
owner-directed outcomes above as the target for the toolbar, Furnish and Escape changes.

- **Paint and toolbar.** Compare the floating picker and a detached family strip. Open the
  picker from compact Colours, use the wheel and Hex, then exercise literal Done, linked
  swatch, palette add with Undo, full-palette refusal and Escape with focus return. Verify
  Paint quick Materials opens the correct Library context and that favouriting an eligible
  Material feeds quick access. Switch between Build, Form, Landscape, Paint and Furnish with
  one strip at a time and a visible gap where a strip is open. Exercise Furnish → *Browse all*
  → Objects → dismiss and check the return path on a constrained viewport.
- **Escape.** Activate Build, return to Select through the existing Escape sequence, and check
  that Build has no stale halo. Select a Stage item and press Escape. Confirm the normal
  selection result, visible keyboard focus during Tab navigation and correct dismissal of the
  active layer before selection clears.
- **Library and Finish.** Cover project shelf overflow, interactive detail and the draft editor
  with the Stage still available. Exercise card versus detail activation, Paint arm, Replace and
  treatment-preserving Swap with Undo, Shift and last-view reopen. Verify literal and palette-linked
  coat behavior, Finish Card reach and the existing object/artwork/light paths. Open *Customise…*
  with and without a target, retarget, try an unavailable action, cancel with focus return and
  apply a supported edit with one Undo. Verify thumbnail browsing avoids full-resolution
  catalogue requests and detail or draft teardown releases its resources.

Keep existing service and route regression coverage. Run affected editor checks and the
repository merge gate.
