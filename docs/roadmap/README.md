# Roadmap — status authority

**Role:** roadmap status and handoff authority. This file routes #115's
parallel-track execution and the T1–T4 tracks.

```text
NORMAL ROUTE: roadmap/README → track README (when registered) → exact artifact
```

The **phase README** owns its children's status and order and routes active child
work **directly** to the exact plan/context/design/QA artifact it needs.
Slice-specific artifacts may live in a slice workspace directory, but a
**workspace directory does not require a README**: there is no mandatory
intermediate slice router. A workspace-local index is allowed only when a
workspace genuinely needs a local navigational index, and is then
**navigation-only** — never a status, plan, decision, acceptance or contract
authority. Phase root holds phase-wide artifacts only.

## Accepted basis

The ratified decision record
([`../reference/decisions/northstar-ratification-2026-09-27.md`](../reference/decisions/northstar-ratification-2026-09-27.md)),
as refined by the later
[World | Experience amendment](../reference/decisions/world-experience-reconciliation-2026-09-29.md),
is normative for all new design. Its concerns are promoted into one live
normative statement per concern:

- product direction → [`../reference/north-star.md`](../reference/north-star.md);
- ownership and boundaries → [`../reference/architecture.md`](../reference/architecture.md);
- the ratified cross-domain shapes F.1–F.5 →
  [`../reference/composition-execution.md`](../reference/composition-execution.md);
- the ratified shell and visual-system destination (PLATE) →
  [`../reference/design-system/editor-shell-and-visual-system.md`](../reference/design-system/editor-shell-and-visual-system.md).

The retained prototypes ([`../../prototypes/README.md`](../../prototypes/README.md))
are runnable product hypotheses and their QA/reference evidence; they test and
challenge these contracts but are never production, persisted-format or
implementation authority. Ratification, planning and prototype acceptance
authorize **no** implementation.

## Track register

#115 replaced sequential P-level capability planning with four parallel tracks.
Each track's evidence and obligations are recorded; its phases, slices and
status register are created by authorized planning, and the execution structure
that registers them (track READMEs with their starting-foundation and start
step, and the gate register) is the remaining work package of the reset.

| Track | Status | Scope | Evidence |
| --- | --- | --- | --- |
| **T1 — Spatial world** | planning evidence recorded by #115; **no implementation authorized** | architectural representation, Plan/3D spatial readings, viewport and projection, Layout representation, retained precision/a11y seams | [`t1-spatial-world/planning-evidence.md`](./t1-spatial-world/planning-evidence.md) |
| **T2 — Composition** | planning evidence recorded by #115; **no implementation authorized** | one semantic Scene placement with view-specific projection, footprint/support, assets and ingest, materials and lights | [`t2-composition/planning-evidence.md`](./t2-composition/planning-evidence.md) |
| **T3 — Experience** | planning evidence recorded by #115; **no implementation authorized** | Experience composition, Presentations, Stops, visitor execution, Camera/Experience order cutover, accessibility | [`t3-experience/planning-evidence.md`](./t3-experience/planning-evidence.md) |
| **T4 — Release and delivery** | track opened by #115; **no implementation authorized** | durability, the F.5 release envelope, provenance and closed resources | [`t4-release/README.md`](./t4-release/README.md) |

```text
CROSS-TRACK CONSTRAINTS (interface/correctness gates, not a waterfall):
- T2/T3 authoring capability consumes T1's viewport/projection seam; it does not
  wait for T1's later representation slices.
- T3's order cutover lands BEFORE T1 migrates Camera authoring onto the new
  ownership contract; node links and Experience order are never coequal
  writable authorities.
- T4 may establish its envelope and existing-data lowering in parallel, then
  integrate new capability payloads as their domain contracts land.
- Every track conforms to F; unsupported required capabilities fail explicitly.
```

**Implementation gates.** F.1–F.5 are owner-ratified as target shapes; each exact
interface is drafted with its first consumer and ratified as an explicit F
amendment to
[`../reference/composition-execution.md`](../reference/composition-execution.md),
implemented in shared code. No track mints its own format. Production capability
work starts only from an approved, reviewed track phase plan whose declared final
gate must pass; the architecture operating cycle
([`../operations/architecture-cycle.md`](../operations/architecture-cycle.md))
owns the bounded exposure window that the first T1 plan configures.

## Closed phases

**P23** (wall-first architectural Plan editor minimum) and **P23B** (geometry
performance and stabilization — closed 2026-09-29 by owner ruling after P23B.9's
correctness and performance-regression gate was accepted and P23B.10's closeout
made the phase closable) are shipped and closed. Their closure provenance,
format-cutover records, Room lineage and algorithm decisions are archived under
[`../archive/technical/p23/`](../archive/technical/p23/) and
[`../archive/technical/p23b/`](../archive/technical/p23b/). No P-level execution
route remains: #115 replaced that sequence with the tracks above.

## Unscheduled proposals

Retained below because no other document holds them. Neither is authorized, and
neither has a phase or slice; re-register with an owner decision if either is
taken up.

- **Stop-at-next-occurrence playback** (recorded 2026-08-27 as "P13"). In sequence
  playback, Play would travel to the beginning of the next stop and pause there,
  with a toggle between stop-at-node and continuous end-to-end playback. The
  pinned semantics for `A → B → C` were: play from A travels to the start of B and
  pauses; play again travels B→C; the final play continues to the tail or loops
  where a closing edge exists. "Beginning of a node" means the end of the inbound
  motion span and the start of the authored hold. It was estimated as a small
  change because the arrival progress of every node already existed as data, the
  playhead advanced under one clock, and the toggle could mirror an existing
  session-flag pattern. **Its original premise is retired:** the Sequence/timeline
  transport it extended was editor-only and was removed with the editor shell, and
  the order model it read is retired at the T3 Camera/Experience cutover. T3 may
  assess an occurrence-based equivalent against the Experience order contract; it
  is not carried as a scheduled item.
- **Branch rejoin — experiment, no schedule** (recorded 2026-08-21). Authoring a
  branch that rejoins the main sequence at a *later* stop (`C → E → F → D`) is not
  representable in the shipped model, which expresses only return-to-origin chains.
  Three modeling options were recorded: (1) a tail-node field, recommended for any
  future increment as the smallest delta and matching the existing
  detour-origin precedent, additive to the strict codec with no version field or
  migration; (2) a first-class Branch record, cleanest but a new top-level
  collection needing codec, semantics, serialization, export and contract tests;
  (3) deriving rejoin from the graph, rejected as implicit and silently breakable
  when the edge is deleted. Risk finding: data risk low, validator/mutator risk
  medium (every sequence mutation gains a rejoin-validity clause and the rejoin
  edge likely needs delete guarding), playback risk high and separable (no branch
  playback engine exists). Open questions: whether rejoin validity restricts
  re-root/reorder so the target stays after the origin, whether a rejoin edge is
  delete-guarded, and whether timeline branch rendering is ever part of an
  increment or branch authoring stays model-only. Revisit only if branch authoring
  is prioritized.

## Meta, operations and status

```text
OPS: current work baton → ../operations/current.md
META: live cycle state + protocol → ../operations/architecture-cycle.md
```

`META` is a process track beside the product pipeline, not a phase in it: it
enters no product-track slot and adds no P-number. There is no separate model or
per-increment routing tracker; task-intensity routing is not roadmap status.

Non-milestone: Typed DB layer (conditional infra).

Status enum: `proposed | planning | approved | in-progress | shipped | archived`.
This tracker is authoritative when a plan doc's `**Status:**` drifts.
