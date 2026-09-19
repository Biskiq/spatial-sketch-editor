# Roadmap — status authority

**Role:** P-level tracker only. Answers: which phase executes now,
which phase is being planned, pipeline order, P-level status.
Slice detail lives in phase README. Phase root holds phase-wide /
cross-slice artifacts only; active slice-specific plans/artifacts live
inside that slice's workspace, and each slice README owns the exact plan
path. Do not add new slice-specific plans flat at `docs/roadmap/<phase>/`
(flat slice plans already there are grandfathered legacy).

```text
PIPELINE: P23 → P26 → P24 → P25
```

| Phase | Status | Goal | Workspace |
|-------|--------|------|-----------|
| P23 | in-progress | wall-first architectural Plan editor minimum | [`p23-layout-depth/README.md`](./p23-layout-depth/README.md) |
| P26 | planning | vertical structure + orthographic precision over one wall-first model | [`p26-spatial-depth/README.md`](./p26-spatial-depth/README.md) |
| P24 | proposed | asset supply + staging authoring | [`p24-scene-staging/README.md`](./p24-scene-staging/README.md) |
| P25 | proposed | destination + stop + panel + interaction | [`p25-experience/README.md`](./p25-experience/README.md) |

```text
BACKLOG: P13 proposed/unscheduled; branch-rejoin experiment, no schedule → backlog/
OPS: current work baton → ../operations/current.md
MODEL: per-increment routing → model-assessment.md
```

Non-milestone: Typed DB layer (conditional infra).

Status enum: `proposed | planning | approved | in-progress | shipped | archived`.
This tracker is authoritative when a plan doc's `**Status:**` drifts.
Execution order is pinned by phase README depends-on, not by P-number order.
