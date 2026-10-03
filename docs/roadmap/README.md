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
P23B (CLOSED 2026-09-29 — see its phase row and PHASE CLOSE block)
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

**Visual-system sequence (owner-directed):**

1. **DONE** — the [P26 demo redesign plan](./p26-spatial-depth/design/visual-system-refinement/specification-plan.md) was applied, validated and merged (#104, owner-accepted 2026-09-29). The demo is the accepted experience/visual reference — the [Spatial Authoring Prototype](../../prototypes/spatial-authoring/README.md); **journeys A–F remain its experience/QA authority**, and prototype shortcuts are not production contracts.
2. **DONE** — P23B closed 2026-09-29 and its PR (#103) is merged to `main`.
3. **DONE** — the initial PLATE desired-language amendment (docs-only): the desired product visual language and shell contract are updated from the accepted demo, with **landed-now · desired-from-demo · still-unbuilt** labelled explicitly: [`reference/design-system/editor-shell-and-visual-system.md`](../reference/design-system/editor-shell-and-visual-system.md) **§0.7** (section homes §4.4, §6.4, §10, §18.3, §23.1). It authorized no implementation and closed no §0.3 owner call.
4. **DONE** — the unified **World | Experience design freeze and durable shell promotion** ([PR #111](https://github.com/Biskiq/spatial-sketch-editor/pull/111), 2026-10-01, docs/design/assets only): both the [final World synthesis](../../prototypes/world-experience-shell-round/design/design-synthesis.md) with its [QA package](../../prototypes/world-experience-shell-round/QA-package/) and the [final V2 Experience synthesis](../../prototypes/integrated-experience-authoring/design/Prototype-V2-final-synthesis.md) are promoted into [`PLATE`](../reference/design-system/editor-shell-and-visual-system.md) **§0.8–§0.8.3**: shared/World laws, Experience expression, and explicit parked-task return. The retained syntheses/QA are the finalized design records; PLATE owns normative destination shell requirements.
5. **DONE — prototype adoption accepted 2026-10-02** — the [World Authoring Prototype](../../prototypes/spatial-authoring/README.md) (#112) implements the frozen shell in place, preserving P26 A–F. [Acceptance and harvest](../../prototypes/spatial-authoring/qa/ACCEPTANCE.md) record both axes and retirement; the [closed plan](./p26-spatial-depth/design/world-authoring-prototype/implementation-plan.md) preserves exact recovery. No production cutover.
6. **NEXT — owner-directed prototype baton (2026-10-01)** — after #112 closes/merges, #113 builds/adopts the [Experience V2 executable reference](../../prototypes/integrated-experience-authoring/design/Prototype-V2-final-synthesis.md) against the unified shell and validates actual World ↔ Experience continuity. #112 includes only a minimum read-only Experience fixture for World-side parking/return proof.
7. **NEXT PR AFTER #113 — World Paper authoring (2026-10-03)** — the owner accepted the Paper authoring shell; it is promoted into [PLATE §0.8.4](../reference/design-system/editor-shell-and-visual-system.md#084-world-paper-authoring-destination) (with the derived Wall-role destination in [architecture](../reference/architecture.md) §Ownership). The [Paper adoption plan](./p26-spatial-depth/design/paper-authoring-prototype/implementation-plan.md) adopts it into the World Authoring Prototype as PA0–PA12; not started, and no longer an open ordering call — it follows #113 as the next PR (sequence below). Prototype validation only.
8. **Normal production route resumes after the prototype detour closes** — F exact-interface amendments, then T1/T2/T3 re-derived planning and gates, then production V2 implementation. The prototype sequence satisfies none of these gates.

**Prototype sequence (owner-decided 2026-10-03):** #112 close/merge → #113 Experience V2 +
real World ↔ Experience continuity → Paper PA0–PA12 in the next PR → the prototype detour
closes → F exact-interface amendments → T1/T2/T3/T4. Steps 6–8 carry this order; Paper's
position is decided, not an open owner call.

The demo revision and the shell round are bounded design work; product
implementation remains subject to the foundation and track gates below. Steps 3
and 4 are **target statements**: the editor still runs the landed PLATE chrome
until an explicit cutover, so the destination is never presented as shipped.

**#111, #112, #113 and the Paper adoption are design/prototype validation.** They do not satisfy F, do not
advance T1 implementation state, and do not authorize production; only the F
interfaces and the re-derived track plans gate production capability work.

Pre-redesign P24/P25/P26 scope, exclusions and sequencing are planning
**evidence** only; each phase is re-derived against F before planning resumes.
Authority: [`../reference/decisions/northstar-ratification-2026-09-27.md`](../reference/decisions/northstar-ratification-2026-09-27.md)
and the promoted contracts ([`reference/north-star.md`](../reference/north-star.md),
[`reference/architecture.md`](../reference/architecture.md)).

| Phase / track | Status | Goal | Workspace |
|-------|--------|------|-----------|
| P23 | shipped | wall-first architectural Plan editor minimum | [`p23-layout-depth/README.md`](./p23-layout-depth/README.md) |
| P23B | shipped | geometry performance + stabilization — closed 2026-09-29 by owner ruling after P23B.9's correctness + performance-regression gate was accepted and P23B.10's closeout made the phase closable; shipped on `main` — PR #103 merged 2026-09-29 | [`p23b-geometry-performance/README.md`](./p23b-geometry-performance/README.md) |
| F | planning (target contract owner-ratified 2026-09-27 with amendments; no implementation authorized) | foundation contracts F.1–F.5 before capability replanning | [`f-foundation-contracts/README.md`](./f-foundation-contracts/README.md) |
| T1 — Spatial foundation | proposed (re-derived P26; replan after F) | shared viewport/projection seam, runtime-safe Layout representation, level-ready vertical/Plan semantics | [`p26-spatial-depth/README.md`](./p26-spatial-depth/README.md) |
| T2 — Composition data | proposed (re-derived P24; replan after F) | definitions, instances, resource revisions/locks, ordinary placement, truthful single-model creator import | [`p24-scene-staging/README.md`](./p24-scene-staging/README.md) |
| T3 — Experience data | proposed (re-derived P25; replan after F) | multi-Experience unit, Presentations/optional Guides/Stops, narrow shared execution/session foundation, Camera-order cutover, first compound acceptance | [`p25-experience/README.md`](./p25-experience/README.md) |
| P27–P30 | provisional labels | components/reversible presentation · coordinated direction · reuse/alternatives/participation · delivery/presenting/review | — |

```text
CROSS-TRACK CONSTRAINTS (interface/correctness gates, not a waterfall):
- T2/T3 authoring UI consumes T1's viewport/projection seam; it does not wait
  for T1's later representation slices.
- T3 data work may proceed alongside T1/T2. Rich Activities consume real
  domain capabilities as they become available; T3 does not wait for all T2
  definitions/components or all T1 representation depth.
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
