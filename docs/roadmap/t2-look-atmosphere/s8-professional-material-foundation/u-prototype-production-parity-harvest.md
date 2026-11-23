# U5 Library recovery findings

Source comparison of the [approved Appearance UX](../../../../prototypes/appearance-ux/README.md)
with U5 as merged in [#406](https://github.com/Biskiq/spatial-sketch-editor/pull/406). The
[U5 report](./pr-u5-report.md) records functional verification. [#405](https://github.com/Biskiq/spatial-sketch-editor/issues/405)
tracks open design findings, including the separate Paint picker gap. Use #406 as the foundation
for the forward correction. Rendered parity remains to be checked in the implementation PR.

| Area | What the correction needs to resolve |
| --- | --- |
| Placement and responsive behavior | The approved Library leaves the Stage legible between shell surfaces and becomes a bottom sheet in portrait. The merged Library covers Index and Card with a nearly full-workspace inset and wraps sources where the design folds them into a menu. Fit the approved composition to the actual shell lanes. |
| Browse hierarchy | Nest families under Materials. Show a compact project shelf with an overflow link in All, then the curated gallery. Keep square samples, readable names and secondary controls visible on the card. Retain real sources, search and filters, favourites, usage and D1 Concrete variants. My library enters with U7. |
| Context actions | A card chooses for the current Paint, Replace, Swap or browse context, while a separate action opens detail. The merged card opens detail for every intent, and the Finish Card retains its interim Swap picker. Use the existing operation owners, keep the applicable Shift behavior and restore the last browse view on reopen. |
| Inspection | The approved detail uses a live square preview with geometry and lighting controls plus source and treatment facts. The merged detail uses a static tile. Reuse E7 for an active detail request, with lightweight derivatives for browse and truthful fallback when a view is unavailable. |
| Draft handoff | The current sheen draft preserves no-write preview and one Undo on Apply. D9's Customise opens a draft in the exact Material editor with Stage preview. Preserve the existing functionality and resolve the handoff to U6, which owns the full editor. |

Design evidence lives in the [decision sheet](../../../../prototypes/appearance-ux/index.html#flow),
[responsive board](../../../../prototypes/appearance-ux/board.html) and
[Library prototype](../../../../prototypes/appearance-ux/app/ui-library.js).

For review, compare representative wide and constrained layouts with project items and detail
open. Exercise card choice and separate inspection, keep-open and focus return, and a qualifying
Apply or Swap with Undo. Confirm that browsing avoids full-resolution catalogue requests and that
inspection and cancelled drafts leave project and history unchanged.
See [Workflow](../../../workflow.md#design-and-reference-maintenance) for the shared review policy.
