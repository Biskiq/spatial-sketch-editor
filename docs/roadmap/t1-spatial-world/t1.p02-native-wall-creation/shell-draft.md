# T1.P02 — Shell draft: Ink Walls, Opening and delete

**Status:** proposed feature composition for S02/S03 review, reconciled 2026-10-23.
[Production shell Round 2](../../../reference/decisions/production-shell-round-2-ratification-2026-10-23.md)
is the destination; [PLATE](../../../reference/design-system/editor-shell-and-visual-system.md)
owns composition, Card facts, tool/state language, return and responsive rules. This draft
allocates bounded implementation work under those rules; it authorizes no production scope.
It supersedes this phase's pointer-rail/Draw-family/Dimensions-writer draft.

## Current and destination

The landed partial shell has the Head, collapsible Index, shared Stage, overlay Card and
contributed task Instruments. Ordinary Layout precision still writes through Dimensions;
tasks still appear in Index groups. Those remain current until the consuming cutover ships.
Round 2's whole World/Experience shell is destination, not a delivered state or this phase's
mandate. The prototype's key map, pixels, hit algorithms and geometry are not requirements.

## Bounded S02 cutover

S02 proposes the original shared-shell integration scope in Round 2 terms:

- Introduce **Select** and **Ink** in the bottom dock with Ink's straight-Wall reading;
  the dark forest dock/palette, armed ivory key and single upward-growing lower column
  follow PLATE. Expose only supported readings, not empty Slice/Eraser/Brush/Measure slots,
  Sketch/Box/Round options, Scene Shape or roofs. Adding a tool requires its own capability.
- Contributions describe capabilities and homes; the shell does not hard-code a T1 family
  that T2/T3 must edit. Keep existing placement/composition tasks reachable in compatible
  Library/Guide-style invoked homes through their owners' adapters. Audit mapping and
  keyboard access before removing any Index task. Retire migrated task entries when their
  dock/Find/invoked route works; do not strand or duplicate a foreign contribution.
- Provide the bounded **Find in Head** access needed to discover and arm these tools and
  invoke migrated existing tasks, using PLATE's explicit verbs. Do not claim the full
  scope-model Index, global subject search or every future Find command is delivered.
  T3 reviews Head changes; broad search/index redesign is outside this allocation.
- Move ordinary **Layout** Wall/Opening facts into the Card, using the existing domain
  planners/parsers/refusals and undo units. Wall thickness is advanced Card content and
  derived role is read-only; no role chooser. Remove the migrated Dimensions writer and
  its task/keyboard route in the same cutover. This does not silently move Scene/Camera
  writers; review contributor compatibility with those owners. A second writer or a
  renamed Dimensions Instrument is not the target.
- Dock, palette and one invoked Instrument form one lower column. Card arbitration keeps
  facts readable beside it; at constrained width collapse Card to identity with explicit
  expansion rather than covering the task. No automatic Camera reframe. Retain PLATE's
  task-appropriate span, canonical identity and explicit return behavior.

Before build, owner/design review confirms this bounded allocation, exact Card fields and
contributor homes. If migrating the existing contributors requires whole-shell or foreign
semantic redesign, stop for a scope decision. Ratification alone cannot authorize that work.

## Draw (S02)

Ink is armable with nothing selected and arming does not change selection. Selecting a
Junction/Wall end can supply the first point; otherwise the Stage or a typed coordinate
supplies it. Existing Junction, explicit Wall-interior split and free-point marks differ;
nearness without a deliberate target never connects. There is one shared Stage/Camera.

| State | Visible reading | Source and unwind |
| --- | --- | --- |
| Armed | Ink key and supported straight-Wall palette, remembered options; Scale/Grid/Snap remain drafting state | No source write or selection change |
| Drawing | Ghost chain and transient length/angle facts; planner-derived free-standing/encloses/divides consequence | Each point can be typed; backtrack removes a live point; cancel discards the whole chain |
| Finishing | Start-Junction close, open-chain finish action or deliberate existing-host end; named consequence before the gesture | Entire chain is one accepted result/undo step; last Wall selects and Ink stays armed |
| Refused | Crossing/overlap/disconnected-nested-ring words with a repair at the gesture | No partial source; live chain remains editable |
| Live proposal | Undo/Redo explain finish/cancel first | Generic proposal ownership, not a list of named gesture owners |

Esc follows PLATE: collapse an open palette first; the following unwind cancels the live
chain before disarming Ink. Tool switch, reading change and project replacement obey the
session's cancellation/revalidation policy and cannot hide a live proposal. Exact key
bindings and numeric-entry focus order are reviewed against existing commands before build;
no prototype keymap is promoted by this draft. Keyboard-only creation, precise point/length/
angle entry, cancellation and delete must remain complete paths.

Marks follow the [spatial grammar](../../../reference/design-system/spatial-instrument-grammar.md):
gold selection, white available transformation, yellow temporary inspection, red erase
marks; values appear when useful on hover/drag or numeric entry. This phase adds no XYZ
gizmo or permanent W/D/H labels. Card and marks write the same domain fact/refusal.

## Delete (S02)

The selected Wall's Card action and keyboard delete disclose hosted Openings and derived
Room merge/open consequences before acceptance, with counts from the planner. One undo
step removes the Wall and hosted Openings. Camera/Experience retain deleted IDs with
computed diagnostics; no retargeting. A refused delete leaves source unchanged. This
bounded delete does not implement the general Eraser tool or topology-review threshold.

## Opening (S03)

Opening is an **Ink reading on a Wall face**, not a dock family. S03's complete plan must
settle the supported straight opening reading, target/host preference, precision and unwind
against the same canonical Layout planner. Show a host-relative ghost and transient offset/
width facts; refuse ineligible hosts or overlaps in words. Ordinary settled offset, width,
height and sill live in the Card through the fields migrated by S02. Delete stays in the
Opening's scoped Card action. No round opening, curved Wall or general face-frame placement
provider is inferred from the vocabulary. S03 needs its own authorization and feature review.

## Review and observation

Before S02 build, review the bounded dock/Find integration, Card migration, contributor
homes, numeric focus and command conflicts. After build observe empty/starter → draw →
close → divide → delete in both readings, keyboard-only, narrow/short and reduced motion;
include existing invoked tasks and Card arbitration. Record revision, viewport and observed
result, then revise the consuming implementation. S03 repeats this for Opening.

Production key map, calibrated responsive thresholds and unsupported Ink readings remain
feature decisions; accepted drawing policy and Round 2 invariants do not. These reviews
are slice acceptance work, not a new shell gate or production release.
