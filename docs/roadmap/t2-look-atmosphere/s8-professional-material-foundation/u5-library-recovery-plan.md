# T2.S8 U5 Library recovery plan

**Goal** Recover the approved Library experience in [#399](https://github.com/Biskiq/spatial-sketch-editor/pull/399)
on top of the working [#406](https://github.com/Biskiq/spatial-sketch-editor/pull/406) implementation.
Use the [runnable design](../../../../prototypes/appearance-ux/app.html), [responsive board](../../../../prototypes/appearance-ux/board.html)
and [decision sheet](../../../../prototypes/appearance-ux/index.html#flow) for composition and interaction.
The [source comparison](./u-prototype-production-parity-harvest.md) and [#405](https://github.com/Biskiq/spatial-sketch-editor/issues/405)
identify the gaps this PR addresses.

## Integration decisions

- **Shell and browse.** Fit the approved Stage-bounded Library to production's measured shell lanes
  and use its portrait bottom-sheet behavior. Keep Stage context, dock access and focus return.
  Render the nested Materials families, compact project shelf and square card hierarchy using the
  existing browse model. Keep the supported Object, Artwork and Light paths, search, source filters,
  favourites, usage and Concrete variants. Hold the last browse view in editor session state across
  close and reopen. Clear transient detail and invocation state when the context changes.
- **Invocation and writes.** Carry the Library's intent from the dock, Paint tray or Finish Card.
  Card activation follows the visible intent and detail has a separate control. In Paint it arms
  the chosen Finish. For an eligible Replace target it uses the existing assignment. For Swap,
  route eligible curated choices through the existing treatment-preserving Finish Card command
  and reach checks. Ordinary project browse keeps the existing select-users path. Qualify the
  current target at acceptance and refuse stale or unsupported targets without retargeting.
  Preserve Shift keep-open where the approved interaction offers it and keep secondary controls
  independent of the card action.
- **Interactive detail.** Share the Stage's existing E7 inspection host with the thumbnail service.
  Start interactive work only for the active detail, with real geometry and lighting controls and
  resolved source facts. Release the request on change or close. Use World lighting only with a
  qualified anchor and explain unavailable modes. Browse continues to use thumbnail derivatives.
- **Draft handoff for review.** Keep the working no-write sheen draft under an accurate interim
  action label such as *Adjust sheen…*. U6 connects *Customise…* to the exact Material editor and
  its movable Stage preview. This PR preserves qualified Apply and one Undo. U6 also owns material
  import, repair and Align. U7 owns My library and transfer. The separate Paint colour picker gap
  stays in [#405](https://github.com/Biskiq/spatial-sketch-editor/issues/405).

## Evidence for review

Compare the approved app and running editor in a representative desktop state with project shelf
overflow and detail open, and in a portrait layout with Stage visible. Exercise card and detail
actions with pointer and keyboard, Paint arm, Replace and Swap with Undo, keep-open, reopen and Escape
focus return, and inspection/refusal and cancellation. Preserve the existing U5 service and route
coverage. Verify that browse avoids full-resolution catalogue requests, changing and closing detail
releases its request, previews leave source and history intact, and accepted changes use the existing
writer with one Undo. Run the affected editor checks and the repository merge gate.
