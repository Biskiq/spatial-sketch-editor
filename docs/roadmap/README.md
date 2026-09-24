# Roadmap — status authority

**Role:** P-level tracker only. Answers: which phase executes now,
which phase is being planned, pipeline order, P-level status.

```text
NORMAL ROUTE: roadmap/README → phase README → exact artifact
```

The **phase README** owns its children's status and order and routes active
child work **directly** to the exact plan/context/design/QA artifact it needs.
Slice-specific artifacts may live in a slice workspace directory, but a
**workspace directory does not require a README**: there is no mandatory
intermediate slice router. A workspace-local index is allowed only when a
workspace genuinely needs a local navigational index, and is then
**navigation-only** — never a status, plan, decision, acceptance or contract
authority. Phase root holds phase-wide artifacts only; do not add new
slice-specific plans flat at `docs/roadmap/<phase>/` (flat slice plans already
there are grandfathered legacy).

```text
PIPELINE: P23 → P23B → P26 → P24 → P25
```

| Phase | Status | Goal | Workspace |
|-------|--------|------|-----------|
| P23 | shipped | wall-first architectural Plan editor minimum | [`p23-layout-depth/README.md`](./p23-layout-depth/README.md) |
| P23B | planning | geometry performance + stabilization over the P23 wall-first pipeline | [`p23b-geometry-performance/README.md`](./p23b-geometry-performance/README.md) |
| P26 | planning | Continuous Spatial Authoring: viewport redesign + canonical contextual editing | [`p26-spatial-depth/README.md`](./p26-spatial-depth/README.md) |
| P24 | proposed | asset supply + staging authoring | [`p24-scene-staging/README.md`](./p24-scene-staging/README.md) |
| P25 | proposed | destination + stop + panel + interaction | [`p25-experience/README.md`](./p25-experience/README.md) |

```text
BACKLOG: P13 proposed/unscheduled; branch-rejoin experiment, no schedule → backlog/
META: live state → ../operations/architecture-cycle.md
      ratified design → architecture-operating-cycle-plan.md
OPS: current work baton → ../operations/current.md
MODEL: per-increment routing → model-assessment.md
```

`META` is a process track beside the product pipeline, not a phase in it: it enters no
`P23 → P23B → P26 → P24 → P25` slot and adds no P-number. Its live state is
[`../operations/architecture-cycle.md`](../operations/architecture-cycle.md); its ratified
design is [`architecture-operating-cycle-plan.md`](./architecture-operating-cycle-plan.md).

Non-milestone: Typed DB layer (conditional infra).

Status enum: `proposed | planning | approved | in-progress | shipped | archived`.
This tracker is authoritative when a plan doc's `**Status:**` drifts.
Execution order is pinned by phase README depends-on, not by P-number order.
