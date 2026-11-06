# Museum docs — router

> **Covers:** the shortest route to current behavior, invariants, intent, work and history.
> **Authority by concern:** code/tests = landed behavior; [reference](./reference/) contracts and
> approved designs = invariants and destination intent; [North Star](./reference/north-star.md) =
> product intent. An approved target is not automatically shipped.
> **Start:** [../AGENTS.md](../AGENTS.md) · [glossary](./glossary.md) · [path map](./path-map.md) ·
> [`npm run status`](../README.md#first-ten-minutes) · [first ten minutes](../README.md#first-ten-minutes).

## Where truth lives

| Need | Read |
| --- | --- |
| What's next? | `npm run status`, then [`focus.md`](../focus.md); claims and flags live in GitHub |
| How work is claimed and reviewed | [workflow](./workflow.md) (tiers, plans, flags) |
| Current behavior | code and tests; [architecture](./reference/architecture.md) for ownership |
| Invariants / destination | [reference contracts](./reference/), approved designs and [decisions](./reference/decisions/) |
| Product intent | [North Star](./reference/north-star.md) |
| History | [archive](./archive/) (opt-in; never current authority) |

## Fresh work

```text
START: docs/README.md
STATUS: npm run status → focus.md → the owning AGENTS.md/contract
CLAIM: draft PR or assigned issue naming the capability id; recheck for collisions
CHANGE: code/tests first; keep domain owners and one-writer rules intact
VERIFY: apps/editor/tests/README.md (the affected tier, never a narrower contract)
CLOSE: merge; merging is the closeout, with no acceptance document or closeout PR
STOP: no more reading; enough context to state change, impact and proof
```

Read a routed file at the section that answers the task. Do not preload adjacent docs or the archive;
expand only when the task or a concrete contradiction requires it.

## Durable routes

- [Local development](./local-development.md) · [Tests](../apps/editor/tests/README.md) ·
  [Orientation](./orientation.md) · [Workflow](./workflow.md)
- [Architecture](./reference/architecture.md) · [Composition / F](./reference/composition-execution.md) ·
  [Persistence](./reference/components/persistence.md) · [Camera](./reference/components/camera-tour.md)
- [Shell (PLATE)](./reference/design-system/editor-shell-and-visual-system.md) ·
  [Stage grammar](./reference/design-system/spatial-instrument-grammar.md) ·
  [World sheet](./reference/design-system/world-interaction-sheet.html) ·
  [Experience sheet](./reference/design-system/experience-interaction-sheet.html)
- [Capability ledger](../capabilities.json) · [Focus](../focus.md) · [Roadmap](./roadmap/README.md) ·
  [Operations](./operations/README.md) · [Prototypes](../prototypes/README.md)
- [PR #259 harness plan](./roadmap/lean-harness-proposal.md) · [R217 acceptance](archive/roadmap/r217-core-editor-stability/r217.s11-integrated-final-gate/acceptance.md)

Authority is resolved by concern. A shell design or approved target does not outrank domain
invariants; a stale descriptive document never outranks code/tests. When they materially disagree,
record the uncertainty or open a flag rather than guessing.
