# T2.P02.S03 — Integrated final gate: implementation plan

**Slice:** T2.P02.S03 · **Status:** proposed — **not authorized**; it starts only from its own owner
authorization after `T2.P02.S01` and `S02` are accepted · **Phase:** [T2.P02](../README.md) ·
[slice register](../README.md#slice-register) · **Track:** [T2](../../README.md) · **Runbook:**
[T2 operations](../../../../operations/t2-composition/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: exhaustive
```

This plan is the phase's declared **FINAL PHASE GATE** and the integration route that S01 and S02
send their deferred exhaustive proof to; its acceptance record is the phase's declared final-gate
artifact. It is registered (batch E, E1) and unauthorized: nothing here is implemented, accepted,
ready or evidenced.

## Prerequisite

`T2.P02.S01` and `S02` accepted with routine closeout, and every consumed gate `accepted` with every
`Requires` scope `active` at this slice's own trusted base. S03 adds no product feature: it is the
independent, integrated acceptance of own model import.

## Scope

Record independent acceptance on the integrated tree, from an empty project and from the starter:

- import one own GLB with its maps, review, confirm scale, pivot and footprint, approve, and place;
- move, turn, resize, duplicate and delete it, with two instances sharing one immutable revision and
  keeping independent identities;
- Save and reopen in a fresh session, with the stored revision verified against its pins;
- Preview showing the placed model, if S02 did not already record it;
- the owner-accepted bounds: oversize, malformed, cancelled, expired, stale and project-replaced
  imports install nothing, and a retained revision stays while a stored version references it;
- strict refusal of old-number Scene and resources units and of part fields, and the visitor `/p`
  path staying catalogue-only.

## Acceptance criteria

**Required evidence:** the complete repository contract — fast and heavy kernel correctness, the full
editor suite, the unconditional architecture lane, root `check`/`build`, the affected shared-package
checks, and `check:api` plus a DB-backed `test:api` with **zero skips** — together with browser
journeys recorded with their revision, viewport and reduced-motion state. Use
[tests/README](../../../../../apps/editor/tests/README.md) for lane and command policy and
[browser hygiene](../../../../../.agents/skills/browser-hygiene/SKILL.md) when launching a browser.

Passing makes T2.P02 **closable**; only an explicit owner phase-close request closes it, and no phase,
track or cycle closure is fabricated here.

## Performance recheck

Recheck the integrated F5 import, F6 placement, GPU-memory, F9 Save and F13 leak flows and the Stage
first-load delta against the [performance contract](../../../../reference/components/performance.md),
on the designated reference machine (MacBook Air M2, 16 GB; batch E, E6 amendment). S02 supplies its own
evidence before its acceptance; S03 verifies integration and cannot defer or erase an earlier
hard-budget miss.

## Readiness declaration

This slice is `proposed` and holds no implementation permission. It consumes the same accepted gates
as its siblings and no new or retired scope; it cannot supply its own prerequisite by editing a
register, and it claims no gate state, capability, evidence or commit. A passed final gate makes the
phase closable, not closed.
