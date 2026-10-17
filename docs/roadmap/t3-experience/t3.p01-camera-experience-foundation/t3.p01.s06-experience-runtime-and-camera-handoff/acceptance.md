# T3.P01.S06 — acceptance record: Experience runtime and Camera handoff

**Slice:** T3.P01.S06 · **Status:** in-progress — no acceptance recorded
**Plan:** [implementation-plan.md](./implementation-plan.md) — owns this slice's acceptance criteria
**Phase:** [T3.P01](../README.md) · **Register:** [phase slice register](../README.md#slice-register)

No evidence is recorded against this slice yet. `T3.P01.S06` is the owner-authorized second half of
the split `T3.P01.S03`; the role-half handoff module in PR #138 is preparatory and is not this
slice's acceptance.

When implementation completes, record here, in the form
[the tests README](../../../../../apps/editor/tests/README.md#what-a-change-requires) requires:

- the tested commit and base, the author/date and the reviewer identity;
- the criteria-to-evidence mapping for lowering, interpreter/clock, holds/continuation,
  guard/Continue/detour, the DOM companion, the three controllers and ownership/stale cleanup;
- the AM-6 trace cases with their ordered events/checkpoints and the repeated-Stop/run identities;
- exact command results for `check:project-model`, `check:camera-core`, `check`, the focused
  conformance files, `test:arch`, the editor full lane and affected heavy Camera suites;
- the import/closure evidence that Experience owns no route, pose or projection authority and that
  the modules stay inactive (no editor/visitor source imports them);
- the accepted `camera-handoff-v1` capability record, naming its whole role/ownership meaning;
- residuals, including the authored invocation-selector gap that must be decided before S04.

An ACCEPT verdict must address the whole registered slice, not merely the code increment.
