# T1.P02.S04 — Integrated final gate: implementation plan

**Slice:** T1.P02.S04 · **Status:** authorized 2026-10-28 and implemented; acceptance evidence is
recorded in the [gate artifact](./acceptance.md) and independent review remains required · **Phase:** [T1.P02](../README.md) ·
[slice register](../README.md#slice-register) · **Track:** [T1](../../README.md) · **Runbook:**
[T1 operations](../../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: exhaustive
```

This plan is the phase's declared **FINAL PHASE GATE** and the integration route that S01, S05, S06, S02
and S03 send their deferred exhaustive proof to; its acceptance record is the phase's declared final-gate
artifact. It is registered (batch E, E1) and owner-authorized 2026-10-28. The implementation and
correctness/browser evidence are recorded; the slice is not accepted until independent review and the
P1 merge complete.

## Prerequisite

`T1.P02.S01`, `S05`, `S06`, `S02` and `S03` accepted with routine closeout, and every consumed gate `accepted` with
every `Requires` scope `active` at this slice's own trusted base. S04 adds no product feature: it is
the independent, integrated acceptance of native Wall creation.

## Scope

Record independent acceptance on the integrated tree, from an empty project and from the starter:

- empty → draw → close → divide → add an Opening → delete a Wall with its Openings → Save → reload,
  with identities, Rooms and floors preserved and Plan and 3D agreeing at each step;
- every unsupported case in the owner-accepted
  [drawing policy](../README.md#drawing-and-enclosure-policy-owner-accepted-2026-10-22) refusing in
  words with a repair and no partial source;
- the S01 identity guards rechecked through creator journeys: delete and recreate, Undo then a
  different edit, Redo, and Save/reload/edit never reuse or collide an identity;
- format 6 strict refusal of format 5 and unknown versions in the editor and the API Save path, with
  JSON download recovery;
- Experience and Camera references to a deleted Wall keeping their retained identity with derived
  diagnostics;
- S05 legacy surface/export absence, defect-equivalent fixture coverage and preserved
  registry/Scene-frame behavior on the integrated tree;
- S06's deduplication differentials and scale oracles still green; its historical measurements are
  not re-run under the 2026-10-28 performance-mandate suspension;
- the bounded dock/Ink, Card fact migration, lower-column arbitration and keyboard path as built and browser-revised, at narrow and
  short shells and with reduced motion.

## Acceptance criteria

**Required evidence:** the complete repository contract — fast and heavy kernel correctness, the full
editor suite, the unconditional architecture lane, root `check`/`build`, the affected shared-package
checks, and `check:api` plus a DB-backed `test:api` with **zero skips** — together with browser
journeys recorded with their revision, viewport and reduced-motion state. Use
[tests/README](../../../../../apps/editor/tests/README.md) for lane and command policy and
[browser hygiene](../../../../../.agents/skills/browser-hygiene/SKILL.md) when launching a browser.
No performance benchmark is required: the owner suspended that mandate on 2026-10-28, and an
unmeasured performance row stays unmeasured rather than passing.

Passing makes T1.P02 **closable**; only an explicit owner phase-close request closes it, and no phase,
track or cycle closure is fabricated here.

## Performance recheck — suspended 2026-10-28

The owner suspended the mandatory performance-benchmarking strategy indefinitely
([decision](../../../../reference/decisions/performance-mandate-suspension-2026-10-28.md)). S04 runs
**no** formal F2/F3/F4/F8/F13 matrix, no battery-mode certification and no full `npm run perf`
workflow; none is an acceptance prerequisite. Performance investigations are owner-initiated only,
when an observed slowdown is named.

The deferred rows keep their historical status and are **unmeasured**, not passes: S01's F2 S/M
timings; S02's formal F3/F4/F8/F2/F13 family, per-move evaluation and Stage first-load delta; S03's
F4/F8 Opening create/delete rows; and S06's battery qualification, grid-XL and sweep rows. Their
recorded hard misses (S02's 456.0 KiB br Stage result and S03's 426.7 KiB br exception) remain
recorded and are neither repaired nor erased. Existing measurements, harnesses and raw evidence
stay available for a future owner-commissioned investigation.

## Readiness declaration

This slice is owner-authorized and implemented; it claims no gate state, capability or commit beyond
its acceptance record, and no performance row. It consumes the same accepted gates as its siblings
and no new or retired scope; it cannot supply its own prerequisite by editing a register. A passed
final gate makes the phase closable, not closed. The architecture cycle is unchanged by this slice:
S02's closeout records M4 as re-armed, and the owner's verdicts stay the owner's.
