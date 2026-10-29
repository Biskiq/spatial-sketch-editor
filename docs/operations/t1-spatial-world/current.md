# T1 — Spatial world: current baton

```text
PHASE: R217 Core Editor Stability, shared repository phase.
SLICE: R217.S02 released for implementation; trusted base 8c2c86e638e65a4a0500fa1e3e15b647932549f7 (PR #220). S01 accepted and shipped. All four consumed gates accepted and five required scopes active at base; R217.S02 is not an architecture-cycle exposure slice.
CLAIM: T1 writes the spatial route layout and shell composition at base 8c2c86e6; S03 owns its pointer and key handlers. Claimed shell files: EditorHead, EditorIndex, EditorCard, StageInstrumentHost and stage-contributions; the bounded StageFacade entry-home type also changes for Find and needs T2/T3/T5 review. T3 reviews Head, Find and Experience effects; T2 and T5 review moved entries and Card contributions. Shared-file edits serialize and must rebase and rerun the merge gate.
NEXT: Resume implementation under the owner's 2026-10-29 resize ruling, obtain reviews, verify, accept and run routine slice-closeout. Merge requires authorization.
RESUME: ../checkpoints/r217-s02-shell-composition.md
BOUNDARIES: S03 pointer handlers, S05/S06 drafting and S10 dock contents remain outside S02. T1.P02 remains closed; T1 is not complete.
CARRY: T1 maintenance retains the one-frame `lowerColumnHeight` observation; S06 FO-1 … FO-5 and T1 deferred-retirement rows remain owned in their records. Performance investigations are owner-initiated only after an observed slowdown.
```
