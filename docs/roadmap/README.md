# Roadmap — status authority

**Role:** P-level tracker only. Answers: which phase executes now,
which phase is being planned, pipeline order, P-level status.
Slice detail lives in phase README. Child plans live in phase folders.

```text
EXECUTION
P23 — Layout Depth
→ p23-layout-depth/README.md

PLANNING
P26 — Spatial Depth
→ p26-spatial-depth/README.md

PIPELINE
P23 → P24 → P25
P26 research parallel

STATUS
P23 in-progress
P26 planning
P24 proposed
P25 proposed
P13 proposed/unscheduled
Branch rejoin experiment, no schedule
```

For slice status: open the phase README above.
For P26 stage: open `p26-spatial-depth/README.md`.

## Pointers

- Active phase: [`p23-layout-depth/README.md`](./p23-layout-depth/README.md)
- Live worktree: [`../operations/current.md`](../operations/current.md)
- P24 (proposed): [`p24-scene-staging/README.md`](./p24-scene-staging/README.md)
- P25 (proposed): [`p25-experience/README.md`](./p25-experience/README.md)
- P26 (planning): [`p26-spatial-depth/README.md`](./p26-spatial-depth/README.md)
- Backlog (proposed/unscheduled): [`backlog/`](./backlog/)
- Model routing: [`model-assessment.md`](./model-assessment.md)

## Long-term direction (tiers only; registered plans own P-numbers)

- **P23 — Layout Depth** (active): wall-first architectural Plan editor minimum.
- **P24 — Scene / Staging Depth** (proposed): asset supply + staging authoring.
- **P25 — Experience Foundation** (proposed): destination + stop + panel + interaction.
- **P26+ — Evidence-led platform expansion** (planning): vertical structure +
  orthographic precision over one wall-first model.
- **Typed DB layer** — conditional infrastructure, not a numbered milestone.

Status enum: `proposed | approved | in-progress | shipped | archived`.
This tracker is authoritative when a plan doc's `**Status:**` drifts.
Execution order is pinned by phase README depends-on, not by P-number order.

## Slice closeout rule (deterministic)

New closeouts: promote landed behavior to reference, archive slice bundle
under `docs/archive/roadmap/...`, leave one-line stub in phase README.
Procedure: `.agents/skills/slice-closeout/SKILL.md`.

## Planning procedure

- **New P phase** → folder + phase README + umbrella plan.
- **Child slice** → folder + slice README + `plan/` (+ `context/` / `research/` /
  `design/` / `qa/` only when real artifacts exist).
- **Evidence only when a gate requires it.** Evidence never overrides umbrella
  contracts — conflicts go to owner review. Do not reopen broad research when
  prior discovery already selected the references.
- Child plan existing ≠ implementation-ready. Statuses live in phase README.
