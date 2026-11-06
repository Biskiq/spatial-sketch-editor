# Museum docs — router

> **Covers:** the shortest route to current behavior, invariants, intent, work and history.
> **Authority by concern:** code/tests = landed behavior; [reference](./reference/) contracts and
> approved designs = invariants and destination intent; [North Star](./reference/north-star.md) =
> product intent. An approved target is not automatically shipped.
> **Start:** [../AGENTS.md](../AGENTS.md) · [glossary](./glossary.md) · [path map](./path-map.md) ·
> `npm run status` · [first ten minutes](../README.md#first-ten-minutes).

## Where truth lives

| Need | Read |
| --- | --- |
| What's next? | [`roadmap/now.md`](./roadmap/now.md), then `npm run status`; claims/flags live in GitHub |
| Current behavior | code and tests; [architecture](./reference/architecture.md) for ownership |
| Invariants / destination | [reference contracts](./reference/), approved designs and [decisions](./reference/decisions/) |
| Product intent | [North Star](./reference/north-star.md) |
| History | [archive](./archive/) (opt-in; never current authority) |

## Fresh work

```text
START: docs/README.md
ASSIGNED WORK: operations/current.md (navigation only) → owning operations/<track>/current.md → phase README → exact plan
UNASSIGNED PLANNING: roadmap/README.md → track README → registered phase
F-INTERFACE GAP: slice plan → composition-execution.md amendment / gate register
START IMPLEMENTATION: track runbook start step (eligibility + cycle check)
VERIFY: apps/editor/tests/README.md (the affected tier, never a narrower contract)
SLICE CLOSE: merge; no routine closeout document
PHASE CLOSE: explicit owner request → phase-closeout
TRACK / PROGRAM / REPLAN: explicit event → operations/README.md
STOP: no more reading; enough context to state change, impact and proof
```

Read a routed file at the section that answers the task. Do not preload adjacent docs or the archive;
expand only when the task or a concrete contradiction requires it.

## Durable routes

- [Local development](./local-development.md) · [Tests](../apps/editor/tests/README.md) ·
  [Orientation](./orientation.md)
- [Architecture](./reference/architecture.md) · [Composition / F](./reference/composition-execution.md) ·
  [Persistence](./reference/components/persistence.md) · [Camera](./reference/components/camera-tour.md)
- [Shell (PLATE)](./reference/design-system/editor-shell-and-visual-system.md) ·
  [Stage grammar](./reference/design-system/spatial-instrument-grammar.md) ·
  [World sheet](./reference/design-system/world-interaction-sheet.html) ·
  [Experience sheet](./reference/design-system/experience-interaction-sheet.html)
- [Roadmap](./roadmap/README.md) · [Operations](./operations/current.md) · [Prototypes](../prototypes/README.md)
- [PR #259 harness plan](./roadmap/lean-harness-proposal.md) · [R217 acceptance](./roadmap/r217-core-editor-stability/r217.s11-integrated-final-gate/acceptance.md)

Authority is resolved by concern. A shell design or approved target does not outrank domain
invariants; a stale descriptive document never outranks code/tests. When they materially disagree,
record the uncertainty or open a flag rather than guessing.
