# T1.P02.S04 — Integrated final gate: implementation plan

**Slice:** T1.P02.S04 · **Status:** proposed — **not authorized**; it starts only from its own owner
authorization after `T1.P02.S01`–`S03` are accepted · **Phase:** [T1.P02](../README.md) ·
[slice register](../README.md#slice-register) · **Track:** [T1](../../README.md) · **Runbook:**
[T1 operations](../../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: exhaustive
```

This plan is the phase's declared **FINAL PHASE GATE** and the integration route that S01, S02 and
S03 send their deferred exhaustive proof to; its acceptance record is the phase's declared final-gate
artifact. It is registered (batch E, E1) and unauthorized: nothing here is implemented, accepted,
ready or evidenced.

## Prerequisite

`T1.P02.S01`, `S02` and `S03` accepted with routine closeout, and every consumed gate `accepted` with
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
- the rail, Card/instrument arbitration and keyboard path as built and browser-revised, at narrow and
  short shells and with reduced motion.

## Acceptance criteria

**Required evidence:** the complete repository contract — fast and heavy kernel correctness, the full
editor suite, the unconditional architecture lane, root `check`/`build`, the affected shared-package
checks, and `check:api` plus a DB-backed `test:api` with **zero skips** — together with browser
journeys recorded with their revision, viewport and reduced-motion state. Use
[tests/README](../../../../../apps/editor/tests/README.md) for lane and command policy and
[browser hygiene](../../../../../.agents/skills/browser-hygiene/SKILL.md) when launching a browser.

Passing makes T1.P02 **closable**; only an explicit owner phase-close request closes it, and no phase,
track or cycle closure is fabricated here.

## Performance recheck

Recheck the integrated F2 open, F3 drawing, F4 commit, F8 Undo/Redo and F13 leak flows and the Stage
first-load delta against the [performance contract](../../../../reference/components/performance.md),
on the designated reference machine (MacBook Air M2, 16 GB; batch E, E6 amendment). Each earlier slice
supplies its own evidence before its acceptance; S04 verifies integration and cannot defer or erase an
earlier hard-budget miss.

## Readiness declaration

This slice is `proposed` and holds no implementation permission. It consumes the same accepted gates
as its siblings and no new or retired scope; it cannot supply its own prerequisite by editing a
register, and it claims no gate state, capability, evidence or commit. A passed final gate makes the
phase closable, not closed. The architecture cycle is unchanged by this slice: S02's closeout records
M4 as re-armed, and the owner's verdicts stay the owner's.
