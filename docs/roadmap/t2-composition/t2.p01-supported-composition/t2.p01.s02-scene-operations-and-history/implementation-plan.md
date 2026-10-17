# T2.P01.S02 — Scene operations and shared history: implementation plan

**Slice:** T2.P01.S02 · **Status:** approved (owner-authorized 2026-10-16,
[record](../../../../reference/decisions/s02-pair-authorization-2026-10-16.md)) — implemented and
independently reviewed at `af39acd1`, acceptance justified ·
**Phase:** [T2.P01](../README.md) · [slice register](../README.md#slice-register) · **Track:**
[T2](../../README.md) · **Runbook:** [T2 operations](../../../../operations/t2-composition/README.md)

```text
CONSUMES: F1.reference@1, F4.intent-acceptance@1
REQUIRES: F1.reference@1:references-v1, F4.intent-acceptance@1:local-single-domain-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t2.p01.s04-bounded-composition-loop/implementation-plan.md
```

**Engineering principle.** Exercise ambitious independent engineering judgment: challenge
assumptions, investigate missing invariants and cross-system failure modes, pursue stronger or
simpler solutions, and resolve demonstrated defects without speculative abstractions or
unauthorized contract changes.

## Prerequisite

S01 is shipped (PR #130). `T1.P01.S03`'s `local-single-domain-v1` and its prerequisite
`acceptance-invariants-v1` were accepted at `8ec0c5f1`, an ancestor of post-PR #129 `main`
(`1315b1a2`). A branch cut from that base satisfies the trusted-base rule. This slice consumes
nothing from `T1.P01.S02` (PR #128) or `T3.P01.S02`, which run in parallel under the
[pair protocol](../../../cross-track-execution.md#parallel-pair-2026-10-16). Needing their
unmerged output is a stop-and-report condition.

## Produces

The production Scene planner set over the landed F4 contracts, with its conformance. It provides no
F4 capability, no history and no host registration. Live registration in the editor host belongs to
the host↔F4 wiring (`T1.P01.S04` by default) and to `T2.P01.S03`'s surface.

## Scope

**Planners.** Implement one `DomainPlanner` per operation in the
[operation table](../contracts.md#scene-operations-and-prepared-candidates). Each admits domain
`scene` only, with `compound`, `units` and `resources` all false. The operations are S01's
`place-object`, `move-horizontal`, `set-yaw`, `place-on-floor`, `resize-on-floor`,
`duplicate-one` and `delete-one`, including those whose UI arrives in S04. Pure planning stays in
`@portfolio/project-model/src/scene-planning/`, which S01 established (runtime-safe; no editor,
Svelte or Three import). The admitted normalized-definition policy is injected from S01's editor
object-definition policy, never looked up during planning. Use the landed `AuthoringIntent@1`
fields: targets as F1 references, captured inputs, and IDs captured in `allocatedIds`. A captured ID
that already exists refuses; it is never renamed.

**Admission.** Planners produce candidates; the landed current-source adapter admits them (full
`validateProject` with the host's Scene options, runtime preparation, no new blocking compile
issue); the landed coordinator installs them. Do not add another validation pass, history runner,
installer or adapter variant. A missing target, invalid value or refused admission leaves
everything unchanged. Acquire no resources.

**Scene scope guard.** The T1-owned adapter already refuses, for every Scene change, any change to
Layout, project identity, the Camera-bearing `navigationNodes`/`connections`, `materials` or
`textures` (`validateChange`). It does not check *which* entities or clusters a Scene operation
touches. Every T2 planner therefore returns through one T2-owned record-scope guard. The guard
admits only the operation's targeted entity, its captured new entity, membership cleanup and
empty-cluster removal. Every other entity and cluster is compared exactly. Do not modify the
T1-owned adapter.

**Support.** Planners that need support (`place-object`, `move-horizontal`, `place-on-floor`,
`resize-on-floor` and `duplicate-one`) re-derive floor candidates from the snapshot's canonical
compile through the landed `layout-core` floor-support query. The captured support choice is
qualified by the snapshot's accepted revision and content identity. If the snapshot no longer
yields that choice at the same elevation, the operation refuses (`no-support`,
`support-choice-required` or stale support). Planning never raycasts a mesh and never chooses a new
support. Mapping the viewport's compile-generation identity onto this choice is `T2.P01.S03`'s.

**Operation rules.** Duplicate is exactly +0.5 m world X and Z, retaining Y, rotation, scale and
material sharing. If the shifted contact has no equivalent support it refuses and offers ordinary
Place separately; it never re-grounds silently. Duplicating cluster members or sets refuses with a
reason in this phase. Delete removes the exact entity, cleans cluster membership and removes an
emptied cluster in one candidate. It returns `retired` correspondence entries; a duplicate or place
returns `created` entries. There are no Camera/Experience subject-reference schemas to invent.

## Exit criteria

- Deterministic replay: identical intent and captured inputs produce an identical candidate. Redo
  restores the captured IDs and results without consulting a catalogue or choosing support again.
- One accepted edit gives one undo result. Undo/Redo install with fresh revisions and exact stored
  snapshots. A new edit truncates redo. No-op, invalid, stale, cancelled and refused requests write
  nothing and add no history.
- Stale and previous-epoch results cannot install.
- Chronological, not selective, Undo: in an L1→S1→L2 sequence through one coordinator, each Undo
  reverts exactly the latest accepted result, whatever its domain, to the exact prior full snapshot
  (L2, then S1, then L1). No Undo skips or merges across domains. The Layout steps use
  `T1.P01.S03`'s conformance Layout planner in tests; this slice registers no production Layout
  operation.
- Camera-bearing Scene bytes are unchanged by every operation (the adapter's guard, re-proved here).
  A mutation-control planner that rewrites an *untargeted* entity or cluster, which the adapter
  admits, is refused by the T2 record-scope guard.
- Support: nonzero floor elevation, a choice the snapshot no longer yields, and a duplicate whose
  shifted contact lacks support all refuse with their typed codes. Reordering the query input does
  not change the result.
- Delete cleans membership and empty clusters atomically and returns exact correspondence.
- A direct-caller bypass test fails if any Scene write skips the coordinator. Public-route
  isolation stays green, and no editor policy module enters a package barrel.

## Readiness declaration

This slice is **owner-authorized, implemented and independently reviewed at `af39acd1`**, with
acceptance justified and no substantiated defect remaining. Nothing here claims owner acceptance,
closeout, merge or readiness. Evidence is recorded in [acceptance.md](./acceptance.md) and the
reviewer verdict in [independent-review.md](./independent-review.md).
