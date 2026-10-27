# T5.P01.S03 — Integrated final gate: implementation plan

**Slice:** T5.P01.S03 · **Status:** proposed; approved with `T5.P01.S02` or after it · **Phase:**
[T5.P01](../README.md) · [slice register](../README.md#slice-register) · **Track:**
[T5](../../README.md) · **Runbook:** [T5 operations](../../../../operations/t5-expressive-geometry/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: exhaustive
```

This plan is the phase's declared **FINAL PHASE GATE** and the integration route that S01 and S02
send their deferred exhaustive proof to; its acceptance record is the phase's declared final-gate
artifact. It adds no product feature. Nothing here has run.

## Prerequisite

`T5.P01.S01` and `S02` accepted with routine closeout, every consumed gate `accepted` and every
`Requires` scope `active` at this slice's own trusted base.

## Scope

Record independent acceptance of drawn native objects on the integrated tree, from an empty project
and from the starter:

- draw, read, pull depth and create forms on the floor and on an upright sheet (and on a Wall face,
  if S02 delivered it), then place, turn, size per axis, duplicate and delete them;
- Undo and Redo across every accepted edit; refused, cancelled, stale and no-op edits add no history;
- Save and cold reopen in a fresh session with identical golden digests;
- Plan, 3D and Preview showing the same results;
- strict refusal of Scene format 3 and of malformed forms; the cold-release check refusing forms;
- the golden corpus run in V8 and in at least one non-V8 engine (WebKit or Firefox), with
  bit-identical digests;
- the owner walkthrough: three different objects created from an empty project, with any blocked
  intention recorded as evidence for the next phase.

## Acceptance criteria

**Required evidence:** the complete repository contract — fast and heavy kernel correctness, the full
editor suite, the unconditional architecture lane, root `check` and `build`, the shared-package
checks including `check:geometry-core`, and `check:api` plus a DB-backed `test:api` with **zero
skips** — with browser journeys recorded with their revision, viewport and reduced-motion state.
Use [tests/README](../../../../../apps/editor/tests/README.md) for lane and command policy and
[browser hygiene](../../../../../.agents/skills/browser-hygiene/SKILL.md) when launching a browser.

Passing makes T5.P01 **closable**; only an explicit owner phase-close request closes it.

## Performance recheck

Recheck the integrated rows from the [umbrella plan §5.7](../../umbrella-plan.md#57-performance-envelope)
against the [performance contract](../../../../reference/components/performance.md#budgets) on the
designated reference machine, with Laptop A reported, and record the Stage and visitor first-load
deltas for the phase.
