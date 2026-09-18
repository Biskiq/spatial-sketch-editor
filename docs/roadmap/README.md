# Roadmap — status authority

**Role:** lightweight tracker. Answers cheaply: current phase, current slice,
status, next action, gates, next slice. Not a narrative.

```text
CURRENT PHASE: P23 — Layout Depth
CURRENT SLICE: P23.14 — Editor Shell & Visual System Foundation
STATUS: design reconciliation / implementation planning (no implementation-ready child plan yet)
NEXT ACTION: open P23.14 against main using its slice README; P23.13 merged via PR #58, Junction-dissolve via PR #57
GATE: P24 implementation waits for accepted P23 minimum + approval
NEXT: P23.15 → P23.16 final closeout
```

## Pointers

- Active phase: [`p23-layout-depth/README.md`](./p23-layout-depth/README.md)
- Active slice: [`p23-layout-depth/p23.14-shell-visual-system/README.md`](./p23-layout-depth/p23.14-shell-visual-system/README.md)
- Live worktree: [`../operations/current.md`](../operations/current.md)
- P24 (proposed): [`p24-scene-staging/README.md`](./p24-scene-staging/README.md)
- P25 (research): [`p25-experience/README.md`](./p25-experience/README.md)
- P26 (research): [`p26-spatial-depth/README.md`](./p26-spatial-depth/README.md)
- Backlog (proposed/unscheduled): [`backlog/`](./backlog/)
- Model routing: [`model-assessment.md`](./model-assessment.md)

## Long-term direction (tiers only; registered plans own P-numbers)

- **P23 — Layout Depth** (active): wall-first architectural Plan editor minimum,
  then Plan/shell finish and junction-correct wall-first 3D before closeout.
- **P24 — Scene / Staging Depth** (proposed): P24A supply + P24B authoring;
  R0–R9 planning complete, minimum frozen, P24.0–P24.5 briefs ready for owner
  review; execution waits for accepted P23 minimum.
- **P25 — Experience Foundation** (proposed): Destination + guided Stop/occurrence
  + Content/Info Panel + bounded Interaction; product semantics closed, persistence
  and slicing still gated.
- **P26+ — Evidence-led platform expansion** (research): vertical structure +
  orthographic precision over one wall-first model; design/research stage only.
- **Typed DB layer** — conditional infrastructure, not a numbered milestone.

Status enum: `proposed | approved | in-progress | shipped | archived`.
This tracker is authoritative when a plan doc's `**Status:**` drifts.
Execution order is pinned by phase README depends-on, not by P-number order.

## Slice closeout rule (deterministic)

Shipped P23 child plans that predate this migration are grandfathered flat in
their phase folder. For **all new slice closeouts**: promote landed behavior
into the affected durable reference contracts, archive the whole completed
slice bundle under `docs/archive/roadmap/...`, and leave a one-line stub in
the phase README. Procedure: `.agents/skills/slice-closeout/SKILL.md`.

## Planning procedure

- **New P phase** → new folder under `docs/roadmap/` + phase README + umbrella
  plan. The umbrella defines the durable product contract, architecture
  boundaries, slice order, evidence gates and high-level acceptance.
- **Substantial child slice** → new folder under its phase + slice README +
  `plan/` (+ `context/` / `research/` / `design/` / `qa/` only when real
  artifacts exist). The slice plan carries implementation detail; only
  implementation-ready child plans proceed to implementation.
- **Research / harvest / spike only when an evidence gate requires it.**
  Evidence informs implementation but never silently overrides umbrella
  product/architecture contracts — conflicts go to owner review. Do not reopen
  broad research when prior discovery already selected the references; do not
  impose research on slices whose uncertainty is already resolved.
- Maximum chain: umbrella → evidence artifact (only if required) →
  implementation-ready child plan → implementation.
- Child status vocabulary (a child plan existing ≠ implementation-ready):
  `seed — pre-evidence | seed — evidence pending | evidence complete —
  reconciliation pending | implementation-ready | in progress | shipped / archived`.
