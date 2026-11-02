# World shell recovery — owner proposal

**Status: analysis and proposed implementation only. Owner approval is required before production edits.**

Base: `08602245` (merged `main`, after S24), branch `codex/r217-visual-correction`.
This is a dedicated World presentation recovery, not S25 or a new geometry slice.

The owner's current instruction makes the actual Round 2 wireframe and Atlas the
visual baseline, with the explicitly preserved later decisions. Existing PLATE,
plans and sign-offs supply constraints and conflicts; they do not lower that
baseline. No production source, historical record or governing reference has
been changed by this proposal.

- [Measured design specification](./design-specification.md): source tokens,
  dimensions, composition, responsive rules and interaction states.
- [Gap analysis and departures](./gap-analysis.md): current implementation,
  replacements, affected components, compatibility limits and owner decisions.
- [Implementation plan](./implementation-plan.md): concrete replacements,
  disclosure/navigation work, retired paths, sequencing and functional checks.

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

Approval of this proposal would authorize the listed implementation and selected
departures. It would **not** accept its visual result. The owner alone accepts
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
