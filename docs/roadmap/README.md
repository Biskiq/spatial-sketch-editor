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
PIPELINE (ratified 2026-09-27):
P23B (continues)
  → F foundation contracts (F.1–F.5 owner-ratified 2026-09-27; exact interfaces land as amendments)
  → parallel tracks   T1 Spatial / P26
                      T2 Composition data / P24
                      T3 Experience data / P25
                      T4 Release
  → editing UI on T1's viewport seam
  → creator/audience trials
  → Source Baseline
  → P27–P30 (provisional)
```

Pre-redesign P24/P25/P26 scope, exclusions and sequencing are planning
**evidence** only; each phase is re-derived against F before planning resumes.
Authority: [`../reference/decisions/northstar-ratification-2026-09-27.md`](../reference/decisions/northstar-ratification-2026-09-27.md)
and the promoted contracts ([`reference/north-star.md`](../reference/north-star.md),
[`reference/architecture.md`](../reference/architecture.md)).

| Phase / track | Status | Goal | Workspace |
|-------|--------|------|-----------|
| P23 | shipped | wall-first architectural Plan editor minimum | [`p23-layout-depth/README.md`](./p23-layout-depth/README.md) |
| P23B | in-progress | geometry performance + stabilization; P23B.8 decided and closed 2026-09-29 (Worker/Rust-WASM not justified); owner-authorized P23B.8 follow-up (parked items, one PR) is next, under its own ratified plan | [`p23b-geometry-performance/README.md`](./p23b-geometry-performance/README.md) |
| F | planning (target contract owner-ratified 2026-09-27 with amendments; no implementation authorized) | foundation contracts F.1–F.5 before capability replanning | [`f-foundation-contracts/README.md`](./f-foundation-contracts/README.md) |
| T1 — Spatial foundation | proposed (re-derived P26; replan after F) | shared viewport/projection seam, runtime-safe Layout representation, level-ready vertical/Plan semantics | [`p26-spatial-depth/README.md`](./p26-spatial-depth/README.md) |
| T2 — Composition data | proposed (re-derived P24; replan after F) | definitions, instances, resource revisions/locks, ordinary placement, truthful single-model creator import | [`p24-scene-staging/README.md`](./p24-scene-staging/README.md) |
| T3 — Experience data | proposed (re-derived P25; replan after F) | multi-Experience unit, destinations/occurrences, typed session declarations, Camera-order cutover, first compound acceptance | [`p25-experience/README.md`](./p25-experience/README.md) |
| P27–P30 | provisional labels | components/reversible presentation · coordinated direction · reuse/alternatives/participation · delivery/presenting/review | — |

```text
CROSS-TRACK CONSTRAINTS (interface/correctness gates, not a waterfall):
- T2/T3 authoring UI consumes T1's viewport/projection seam; it does not wait
  for T1's later representation slices.
- T3's order cutover lands BEFORE T1 migrates the Camera authoring tools onto
  the new ownership contract; node links and Experience order are never
  coequal writable authorities.
- T4 may establish its envelope and existing-data lowering in parallel, then
  integrate new capability payloads as their domain contracts land.
- Every track conforms to F; unsupported required capabilities fail explicitly.
```

**Delivery obligations (ratified):** F before capability replanning; release
preparation and compatibility before external durability; creator/audience
trials around the first complete revision loop (import or build → place →
direct → publish → receive feedback → revise → re-share). Ratify the Source
Baseline once F's formats land and the supported composition/Experience units
are stable. Ratification authorizes no implementation by itself.

```text
BACKLOG: P13 proposed/unscheduled; branch-rejoin experiment, no schedule → backlog/
META: live state → ../operations/architecture-cycle.md
      ratified design → architecture-operating-cycle-plan.md
OPS: current work baton → ../operations/current.md
MODEL: per-increment routing → model-assessment.md
```

`META` is a process track beside the product pipeline, not a phase in it: it enters no
product-track slot and adds no P-number. Its live state is
[`../operations/architecture-cycle.md`](../operations/architecture-cycle.md); its ratified
design is [`architecture-operating-cycle-plan.md`](./architecture-operating-cycle-plan.md).

Non-milestone: Typed DB layer (conditional infra).

Status enum: `proposed | planning | approved | in-progress | shipped | archived`.
This tracker is authoritative when a plan doc's `**Status:**` drifts.
Execution order is pinned by phase README depends-on and the cross-track
constraints above, not by P-number order.
