# T2.P01.S01 — Deterministic candidates and canonical floor support: implementation plan

**Slice:** T2.P01.S01 · **Status:** approved (owner-authorized 2026-10-16,
[record](../../../../reference/decisions/parallel-slice-authorization-2026-10-16.md)) — in progress,
independent review fixes and focused T1/Layout sign-off recorded; owner acceptance pending (parallel batch 2026-10-16) ·
**Phase:** [T2.P01](../README.md) · [slice register](../README.md#slice-register) · **Track:**
[T2](../../README.md) · **Runbook:** [T2 operations](../../../../operations/t2-composition/README.md)

```text
CONSUMES: F1.reference@1
REQUIRES: F1.reference@1:references-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../t2.p01.s04-bounded-composition-loop/implementation-plan.md
```

The integration route is the phase's exhaustive final gate; a narrowed tier never stands in for it,
and every merge still runs the complete repository gate.

**Engineering principle.** Exercise ambitious independent engineering judgment: challenge
assumptions, investigate missing invariants and cross-system failure modes, pursue stronger or
simpler solutions, and resolve demonstrated defects without speculative abstractions or
unauthorized contract changes.

## Prerequisite

`F1.reference@1:references-v1` is accepted on post-PR #126 `main` (`ee463d0b` is an ancestor). No
F3, F4 or viewport dependency. This slice consumes nothing from `T1.P01.S02`, `T1.P01.S03` or
`T3.P01.S01`, which run in parallel under the
[batch protocol](../../../cross-track-execution.md#parallel-batch-2026-10-16). It builds its own
Layout fixtures through the canonical compiler; S02's starter gallery is not yet available.

## Produces

No gate and no capability record. Within the phase it produces the renderer-independent core that
`T2.P01.S02` registers:

- the Layout-owned **floor-support query and chooser** in `@portfolio/layout-core`;
- the **normalized object-definition input**, its editor host policy adapter and the reviewable
  **admitted inventory**;
- **`place-object` candidate preparation** with the shared contact/pose and frame math, in
  `@portfolio/project-model`, returning a domain candidate or a typed refusal.

Preparing the other six phase operations (`move-horizontal`, `set-yaw`, `place-on-floor`,
`resize-on-floor`, `duplicate-one`, `delete-one`) and registering all seven in the shared F4
coordinator are `T2.P01.S02`'s, whose result shapes must match the F4 provider accepted first. S01
neither imports nor defines F4 types.

## Floor-support query

Shapes and numerical policy start from the [contract draft](../contracts.md#floor-support-query);
the 2026-10-16 decision settles ownership: the query is **Layout-owned and built here, under T1
review**.

- New modules in `@portfolio/layout-core`, read-only over compiled output. The compiler, its
  tolerances and existing queries (including `findPolygonContaining`) stay unchanged; the compiled
  input is provably unmutated.
- `layout-core` sits below `project-model` and cannot import F1 types. The query speaks Layout-native
  source IDs plus an opaque generation ID supplied by the caller (S02 owns compile-generation
  identity); qualification into F1 references happens in the project-model planner.
- Enumerate every compiled `room-floor` polygon containing X/Z within the declared boundary
  tolerance; take elevation from the compiled Room facts; reject contradictory or missing facts.
  Coincident equivalent supports deduplicate into one choice that keeps every witness, and ordering
  by source ID orders choices without ever choosing an elevation.
- Current-format Layout compiles every Room floor at the one level datum, so the real query cannot
  yet produce distinct elevations. `choice-required` stays typed: the chooser is proven on
  constructed candidates, and a test pins the real-format property so a future multi-datum format
  fails loudly rather than resolving silently.
- Operation tolerances **1e-6 m boundary/coplanar** and **1e-9 per normal component** are confirmed
  by the [independent focused T1/Layout review](./independent-review.md). They never round a
  canonical value or alter compiler epsilon. Context equivalence is the same floor ID in today's
  world-frame, single-level compiled format; future level/instance/frame contexts require an
  explicit contract update. Query-point agreement uses Euclidean distance within 1e-6 m and
  preserves the composed world pose.
- There is no chooser UI here; S03 presents the choice.

## Definitions and admitted inventory

The [normalized definition input](../contracts.md#normalized-object-definition-input) is supplied by
a host policy adapter on the editor side; `project-model` imports neither the catalogue nor Three.
Admit native box/cylinder/sphere with analytical contacts and yaw-only floor models whose
normalized footprint and contact are verified on the landed r186 base with retained loader
ownership. Include at least one real catalogue model with a non-unit source normalization (the piano
is the discriminating fixture) if its verification passes; otherwise record its exclusion and
reason. The inventory and exclusions are a reviewable artifact with a reproducible verification,
not notes in a handler. Asynchronously loaded mesh bounds are never an unrecorded placement input.
Plane primitives, wall/ceiling/surface models, lights, tilted models and ambiguous default
orientation stay outside admission; existing records still load and render unchanged.

## `place-object` candidate

Inputs are captured: new entity ID and defaults, normalized definition, world X/Z and yaw in a
declared frame, and an explicit support choice. With upright pose and scale `s = 1`,
`entity.position.y = support.elevation - s * normalized.contactMinY`. Renderer normalization is
never copied into instance scale or rotation, and no `roomId` is created. The candidate replaces the
entity list only; Camera-bearing and every other Scene field is carried over structurally, so their
canonical bytes cannot change. The yaw-only frame transform and its inverse are pure and round-trip
nonzero origin, yaw and elevation. Plan-point and 3D-hit evidence that resolve to the same X/Z and
support prepare the same candidate; a mesh hit's Y is discarded.

Scene planning is runtime-safe, imports no editor module or Three, and keeps the public-surface gate
green. Required refusals include `no-support`, `support-choice-required`, `unsupported-surface`,
`missing-footprint`, `missing-contact-metadata`, `invalid-value` and `stale-generation`.

## Shared files and integration

Under the [batch protocol](../../../cross-track-execution.md#parallel-batch-2026-10-16), S01 is the
sole writer of the new support-query modules in `@portfolio/layout-core`, the new Scene-planning
modules in `@portfolio/project-model` and the editor definition-policy/inventory module. It edits no
compiler module, no landed F1/F3 behavior, no Scene v1 codec and none of S02's host or route files.
Barrels, package `exports` and the test-lane list change by appending only.

## Exit criteria

Equivalent Plan-point and 3D-hit evidence prepares the same entity, including Y; raised-floor
(nonzero datum) and transformed-input-frame cases pass; no support rejects; distinct elevations
request a choice; coincident equivalent supports deduplicate without array-order dependence. The
current Scene/project codec accepts every candidate, normalization is applied exactly once, all
unrelated fields remain exact and a `roomId` property is never created. The admitted metadata
inventory and exclusions are reviewable artifacts.

In addition, recorded acceptance must show:

- the compiled Layout input unchanged by the query, and the compiler suites green with no tolerance
  change;
- byte-identical canonical Camera-bearing Scene fields across every candidate;
- the real-format single-datum property pinned by a test;
- module direction: the `layout-core` addition imports nothing above it, the planner imports no
  editor module or Three, and the policy adapter stays editor-side;
- T1 review of the query's export and tolerances recorded with the acceptance.

Implementation review and verification evidence is recorded in [acceptance.md](./acceptance.md).
The required focused T1/Layout review is recorded in [independent-review.md](./independent-review.md).
Slice acceptance remains pending the owner; no closeout or merge is claimed.
