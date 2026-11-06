# World shell recovery

**Status:** the owner-accepted World interaction language ([acceptance record](./review-pass-2-plan.md#10-owner-review-round-3-2026-11-02)) is consolidated in the [World interaction reference](../../../reference/design-system/world-interaction-sheet.html). This promotion is documentation-only and does not close a production slice or phase.

Base: `08602245` (merged `main`, after S24), branch `codex/r217-visual-correction`.
This is a dedicated World presentation recovery, not S25 or a new geometry slice.

The owner's current instruction makes the actual Round 2 wireframe and Atlas the
visual baseline, with the explicitly preserved later decisions. Existing PLATE,
plans and sign-offs supply constraints and conflicts; they do not lower that
baseline. The approved planning documents below retain their proposal wording as
the planning record; the owner’s implementation instruction supplies approval.
Historical plans retain their implementation and acceptance evidence; the consolidated visual reference removes comparison and review-round material.

- [Measured design specification](./design-specification.md): source tokens,
  dimensions, composition, responsive rules and interaction states.
- [Gap analysis and departures](./gap-analysis.md): current implementation,
  replacements, affected components, compatibility limits and owner decisions.
- [Implementation plan](./implementation-plan.md): concrete replacements,
  disclosure/navigation work, retired paths, sequencing and functional checks.
- [Owner review pass 1](./review-pass-1-plan.md): separate follow-up plan, accepted owner decisions and acceptance record. Implementation and non-browser functional verification are delivered; visual acceptance remains pending.
- [Owner review pass 2](./review-pass-2-plan.md): second review plan (drawing ink, dashed ghosts, refusal, Card More/`•••`, rename, sticker gizmos, two-knob height stem, chip scale, gear Room labels and per-view Paper) with its [World interaction reference](../../../reference/design-system/world-interaction-sheet.html). The owner accepted this visual language on 2026-11-02; it is now consolidated under `reference/design-system`. Production code and tests remain behavioral authority.

Opening follow-up for PR #270: [design and implementation boundary](./opening-design-review.md), with its [Opening specimen](../../../reference/design-system/world-interaction-sheet.html#s-opening). The visual specimen is preserved in the consolidated reference; this promotion authorizes no production expansion.

## Review basis

The review used the [live Round 2 sources](../../../../prototypes/production-shell-wireframe/README.md),
the [Atlas presets](../../../../prototypes/production-shell-wireframe/atlas.js),
the ten [tour definitions](../../../../prototypes/production-shell-wireframe/tour.js),
browser inspection and computed styles, and the current editor implementation.
The owner's 15 images in `/Users/tony/Downloads/Review/` were inspected as
illustrative comparisons, not exhaustive states or pixel measurements. Images
12/13 are crops; the supplied images also use different scenes and zoom levels.
The wireframe-only development strip is excluded from all shell dimensions.

Browser inspection used a temporary guest project containing two real reconciled
Rooms, seven Walls including a shared divider, and a door and window, built by the
existing Layout planners and admitted through Open source JSON. It compiled with
no issues. This establishes current behavior against real domain data; it is not
a deployed-production verification or a claim of visual parity. Measurements
below use CSS pixels at DPR 1. No screenshot matrix, visual evidence archive or
scripted visual acceptance journey is part of this effort.

## Approval boundary

The owner authorized the complete implementation and recommended E1–E21
dispositions in the implementation instruction. This does **not** accept its visual result. The owner alone accepts
visual/UX parity by inspecting the working editor and directing corrections.

The main proposed choices are the source Dock order with disabled unsupported
slots (E5), invoked explicit Opening settings (E6), Stage bindings for existing
scalar planners (E8), and source leaf hover with a small gold held point (E11).
Unsupported coupled Opening/object resizing remains a reported capability limit
(E9), not an implementation promise or a visual waiver.

The agent owns functional regression tests, typechecks, build, accessibility and
basic browser smoke checks. After implementation, delivery is the working editor,
a brief change summary and known issues/departures. Governing references change
only after the owner's explicit visual approval. Historical records stay intact;
there is no additional visual review round, visual score or ceremonial closeout.

## Implementation handoff

The shared Head, scoped Index, compact one-writer Card, Sheet, Dock/Ink palette,
Objects Library and spatial marks now use the approved recovery presentation.
Existing Wall height/thickness and Opening height planners have gesture bindings;
no coupled Opening or unsupported object/support planner was added (E9).
S25 visible shared-home adoption remains held for owner acceptance.

Functional verification: `npm run check`, `npm run build` and `npm test` (all
editor lanes). Basic smoke uses admitted joined Walls, shared Room membership,
Openings and Scene content at the four requested sizes, including precision,
cancellation, Undo, view-only source isolation and unavailable reasons. This is
functional evidence only; it does not establish visual parity.

Small Card labels use the existing secondary ink instead of the source’s muted
ink after the browser contrast check failed. This accessibility-preserving token
choice is explicitly offered for owner visual inspection. The existing exact
length ray remains distinct from the endpoint Junction operation; exact length,
angle, transforms and technical relations remain available through invoked
precision. Unsupported tools retain truthful disabled reasons. Guest Save needs
a connected cloud client, and Preview needs an authored Experience.
