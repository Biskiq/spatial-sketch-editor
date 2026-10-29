# T1 — Spatial world: current baton

```text
PHASE: R217 Core Editor Stability, shared repository phase; T1 owned S01.
SLICE: R217.S03 released for implementation at trusted main 8c2c86e638e65a4a0500fa1e3e15b647932549f7 (PR #220). Four consumed gates accepted and five required scopes active; S03 is not an architecture-cycle exposure slice. S02 shipped on main in PR #221; S03 integrates it by rebase.
CLAIM: S03 writes stage-facade.ts, stage-session.ts, stage-input.ts, spatial route pointer/key handlers, and bounded pick/press adaptations in layout.adapter.ts and scene.adapter.ts, from 8c2c86e6. S02 owns spatial route shell markup and shell components; shared route, baton and release-list integration is serialized on the S02 merge. T2, T3 and T5 review their specified boundaries.
RESUME: ../checkpoints/r217-s03.md
NEXT: Correct the independent review finding, verify the integrated tree, then obtain acceptance before routine slice-closeout. Leave the PR unmerged pending authorization and serialize S02 integration.
BOUNDARIES: S04 Paper ranks and S07 visible selection/hover are deferred; S02 shell composition remains outside S03. T1.P02 remains closed; T1 is not complete.
CARRY: T1 maintenance retains the one-frame `lowerColumnHeight` observation; S06 FO-1 … FO-5 and T1 deferred-retirement rows remain owned in their records. Performance investigations are owner-initiated only after an observed slowdown.
```
