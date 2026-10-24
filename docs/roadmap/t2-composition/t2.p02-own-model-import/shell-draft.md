# T2.P02 — Shell draft: import, review and place an own model

**Status:** S02 design destination, released with S02 on 2026-10-23; T1 review of the bounded host patch pending; no acceptance.
[Production shell Round 2](../../../reference/decisions/production-shell-round-2-ratification-2026-10-23.md)
and [PLATE](../../../reference/design-system/editor-shell-and-visual-system.md#084-world-paper-authoring-destination)
own the destination. This draft applies them to import; it does not commission a full shell rebuild.
The landed Dimensions surface remains current for native primitives and catalogue objects; S02 adds Card
fields for creator models only and cuts nothing else over.

## Home and continuity

Import is a **Library procedure**, invoked from the Library beside the dock or Head Find's explicit
command. It uses the one lower Instrument for its steps, validation and acceptance. No Import or
Place permanent pointer tool, separate Dimensions destination, side inspector or second Stage is
introduced. The bounded current-project approved-model entry starts another placement without
re-import; general library management is outside S02.

Keep the Head, scope Index, Stage and selected identity coherent. The Card is an overlay and the one
writer for settled selected-object facts. A procedure's unapproved scale/pivot choices are procedure
parameters, not competing selected-object fields. Ordinary selection does not arm placement. The
Library's explicit placement action arms the approved model; explicit cancel returns to rest.

## Flow

| Step | Library Instrument | Stage and Card | Refusal / cancel |
| --- | --- | --- | --- |
| Choose | Import model…; one GLB or one glTF with local buffers/maps | Keep existing selection and standpoint | Wrong type/size refuses before expensive work; chooser cancellation returns focus |
| Read | Named preparation progress and reachable Cancel | Keep context; no authored changes | Plain validation reasons; cancel releases worker and staging work |
| Review | Observed size, triangles, maps and texture reductions; parts/animation/variants labeled found but not admitted | Unselected proposed-model ghost, not a selected authored instance | Never imply part or animation capability |
| Confirm | Bounds in metres; explicit source-unit scale; bottom-centre or bounds-centre pivot; footprint/contact confirmation | Ghost and floor footprint update together | No silent unit guess; invalid parameters refuse beside their field |
| Approve | Approve and place uploads source/derivative and approves the immutable revision | Approval alone keeps source and selection unchanged | Network failure retains valid review for retry; stale/project-replaced completion cannot install |
| Place | Library shows the armed model and an explicit cancel/return | Floor pointer or keyboard/typed placement proposes one pose; accepted instance becomes selected | Local support refusal commits nothing; valid acceptance adds resource/lock/entity atomically |

The model stays available for another explicit placement in the current project. Name, dimensions,
angle and supported position facts live in Card fields; advanced fields use More. Duplicate/Delete
use the fixed scoped list shared by Card ⋯, context menu and Head Find. Existing Scene semantics
still determine support/refusal; unavailable operations earn no handle or field.

## Manipulation, state and return

Use Stage rays and points: white available transformations, gold selection, yellow temporary
inspection; values appear on hover or drag. The gesture and Card edit the same domain fact with the
same refusal. During a live gesture its Card field displays the transient value and cannot start a
second writer. Valid release or explicit field commit makes one undo step; invalid release commits
none. Numeric entry has explicit acceptance, Esc restore/cancel and no blur commit. Undo/Redo explains
why it is unavailable while a proposal is live. Do not adopt XYZ gizmos or permanent W/D/H labels.

The lower column grows dock → palette → invoked Instrument; palette collapse and Esc unwind one
level at a time. Cancel is visible during preparation/upload. Keyboard operation reaches every step,
reports progress/refusal and returns focus to the invoking Library/Find entry. Task replacement or
project replacement invalidates late work; lens return never silently resumes a writer. A parked
procedure resumes only explicitly after project/source/epoch revalidation, otherwise explains why
it must restart. Preview entry/exit preserves the authoring return contract and does not install
pending approval or placement.

On narrow desktop the procedure and Card obey the shared arbitration: reachable local controls,
Stage context and selected identity, without an independent viewport or permanently allocated Card
column. Reduced motion preserves state and progress without requiring animation.

## Bounded host integration

T2 contributes its task/Find entry, Instrument view, Card subject/name/facts, pointer proposals,
ghosts and overlays through the existing Stage adapter seam. T2 owns import state, validation,
resource resolution and intents. T1 owns host/shell/route changes. The current generic Card offers
read-only facts plus a name writer, so S02 must agree a minimal editable-field contribution with
T1 (stable identity, units/value, transient read-only state, commit/refusal and focus return), along
with Library/Head Find invocation and any renderer input needed. Stop and report a missing seam;
record the T1-reviewed patch owner/merge order before implementation. This integration does not
create a global shell prerequisite or permit T2 to rewrite the host.

## Review and observation

Before build, review flow/report wording, the bounded host contribution and the Card/ray cutover.
No departure from PLATE is proposed; any required departure is named for owner review before build.
After build, record revision, viewport, reduced motion and browser observations, then revise:

- empty/starter import → approve → place → manipulate → duplicate → Save → fresh reopen → Preview;
- ordinary/rest/selected states, near-bound and invalid inputs, conditional decoder sources and
  observed-but-not-admitted parts/animation;
- cancel at each step, offline approval/retry, stale approval and project replacement;
- keyboard-only import/placement/Card editing, local refusal, narrow desktop, lens parking and
  explicit revalidated Resume, Preview return and reduced motion.

Use the Round 2 interactive states/guided tours for composition and interaction acceptance. Prototype
pixels, mock state mechanisms and keymap are not implementation contracts.
