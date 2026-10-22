# T3.P02.S02 — Integrated final gate: implementation plan

**Slice:** T3.P02.S02 · **Status:** proposed — **not authorized**; it starts only from its own owner
authorization after `T3.P02.S01` is accepted · **Phase:** [T3.P02](../README.md) ·
[slice register](../README.md#slice-register) · **Track:** [T3](../../README.md) · **Runbook:**
[T3 operations](../../../../operations/t3-experience/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F3.channels@1, F4.intent-acceptance@1, T1.viewport-projection@1, T3.camera-experience-cutover@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F3.channels@1:camera-handoff-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: exhaustive
```

This plan is the phase's declared **FINAL PHASE GATE** and the integration route `T3.P02.S01` routes
its deferred exhaustive proof to; its acceptance record is the phase's declared final-gate artifact.
It is proposed and unauthorized: registering it is not authorizing it, and nothing here is
implemented, accepted, ready or evidenced.

## Prerequisite

`T3.P02.S01` accepted with routine closeout, and every consumed gate `accepted` with every `Requires`
scope `active` at this slice's own trusted base. `T3.P02.S02` adds no product feature of its own: it is
the independent, integrated acceptance of the phase's creator loop.

## Scope

Record independent acceptance of first capture and Cut Preview on the integrated tree, from a real
starter or composed subject:

- Experience create/select, then capture a View and bind a Presentation with an optional Guide Stop in
  one operation; one Presentation reused at two distinct Stops with distinct holds and entry roles;
- reorder by stable identity, bounded label/text/hold/continuation edits, and one Guide order;
- a first coherent Cut Guide with supported existing Travel and truthful gap reporting;
- **two Experiences over one world**, switching between them with shared-Camera reach disclosed;
- source Undo, conditional unit Save, conflict preservation and reload;
- a standalone Presentation with zero Guides/Stops entering and leaving Preview, plus the
  complete Guide path; isolated visitor Preview entry and return through the Camera return token, with authoring identity,
  selection and history preserved and no editor machinery in the visitor/public chunks;
- the accessibility and reduced-motion contract, DOM reach to every admitted destination, and the
  Info Panel without raycast.

Advanced path/anchor editing is not an acceptance prerequisite, and rich interaction grammar is not in
scope.

## Acceptance criteria

**Required evidence:** the complete repository contract — fast and heavy kernel correctness, the full
editor suite, the unconditional architecture lane (documentation/execution gates and
visitor/public/preview boundaries), root `check`/`build`, the affected shared-package checks, and
`check:api` plus a DB-backed `test:api` with **zero skips** for the Save path — together with browser
journeys recorded with their revision, viewport, reduced-motion state and any consumer conformance
probes. Use [tests/README](../../../../../apps/editor/tests/README.md) for lane and command policy and
[browser hygiene](../../../../../.agents/skills/browser-hygiene/SKILL.md) when launching a browser.

The phase's [acceptance evidence](../README.md#acceptance-evidence-to-carry) table is the requirement;
this record owns the result. Passing makes T3.P02 **closable**; only an explicit owner phase-close
request closes it, and no phase, track or cycle closure is fabricated here.

## Convergence performance recheck

Recheck the integrated capture, Guide-free/Guide Preview, Save/history, lazy delivery and repeated
entry/exit flows against the owner-accepted performance contract. S01 supplies its own evidence
before acceptance; S02 verifies integration and cannot defer or erase an S01 hard-budget miss.
This planning clarification releases no implementation scope and preserves the declared full gate.

## Readiness declaration

This slice is `proposed` and holds no implementation permission. It consumes the same accepted gates
as `T3.P02.S01` and no new or retired scope; it cannot supply its own prerequisite by editing a
register, and it does not claim gate state, capability, evidence or commit. A passed final gate makes
the phase closable, not closed. Under the architecture cycle, this slice neither opens nor waits for
the window: the T1.P01 window is closed and the terminal verdicts stay the owner's.
