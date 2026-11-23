# T2.S8 U5 Library recovery plan

**Goal** Recover the approved Library experience in [#399](https://github.com/Biskiq/spatial-sketch-editor/pull/399)
on top of the working [#406](https://github.com/Biskiq/spatial-sketch-editor/pull/406) implementation.
Use the [runnable design](../../../../prototypes/appearance-ux/app.html), [responsive board](../../../../prototypes/appearance-ux/board.html)
and [decision sheet](../../../../prototypes/appearance-ux/index.html#flow) for composition and interaction.
The [source comparison](./u-prototype-production-parity-harvest.md) identifies the gaps this PR
addresses. Use it to start implementation and verify rendered parity in this PR.

## Delivery boundary

**U5 owns the complete Library UX**, including the approved D9 *Customise…* journey into the
Material editor. U5 builds the responsive editor surface, its draft states and the Stage
preview interaction. It connects the production operations already available and gives each
unavailable field or action a truthful state in the same surface.

**U6 extends that same editor.** It connects remaining exact-edit capabilities and the
Finish Card entry point to the U5 surface. U6 also delivers the separate Align, import and
repair workflows. **U7** connects *Save to My library* and delivers the private source and
transfer. This recovery split supersedes the earlier slice handoff. The separate Paint
colour picker gap stays in [#405](https://github.com/Biskiq/spatial-sketch-editor/issues/405).

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

Compare the approved app and running editor at a representative desktop width and in portrait
under the [shared design-review workflow](../../../workflow.md#design-and-reference-maintenance).
Cover project shelf overflow, live detail and the draft editor with the Stage still available. Exercise
card versus detail activation, Paint arm, Replace and Swap with Undo, Shift and last-view reopen.
Open *Customise…* with and without a target, retarget the preview, try an unavailable action,
check that Cancel and Escape restore focus without a write, and apply a supported change with
one Undo. Keep #406's service and route coverage. Verify that browse avoids full-resolution
catalogue requests and that switching or closing detail or draft releases its resources. Run
the affected editor checks and the repository merge gate.
