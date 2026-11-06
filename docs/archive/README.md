# Archived docs

History, kept for provenance. **Not active implementation authority** — if an
archived document conflicts with the live tree, the live tree wins.

## Live authority

| Doc | Role |
| --- | --- |
| [`../README.md`](../README.md) | Documentation router (navigation, rules, meta) |
| [`../roadmap/README.md`](../roadmap/README.md) | Roadmap areas and historical register anchors |
| [`../workflow.md`](../workflow.md) | Workflow: focus, claims, flags, tiers, plans |
| [`../../focus.md`](../../focus.md) | Current priority and holds |
| [`../operations/README.md`](../operations/README.md) | Retained operational procedures |
| [`../reference/north-star.md`](../reference/north-star.md) | Product direction |
| [`../reference/architecture.md`](../reference/architecture.md) | Ownership and boundaries |

## What is here

PR #115 (WP4) kept the archive deliberately small. It holds:

- `technical/` — the closed-record evidence WP4 archived rather than deleted,
  grouped by subject: `p23/`, `p23b/`, `composition/`, `experience/`, `spatial/`,
  `editor-shell/` and `architecture-cycle/`. These are the closure provenance,
  format-cutover records, residual research and protected design specimens that
  the plan required to survive their phase or planning tree (§8.3–§8.5).
- `roadmap/p23/foundation-research/` — the robust-geometry and room-identity
  migrations, kept in place as the foundation's own research record.
- `roadmap/p25-experience/p25-unified-design/` — the two accepted UX comparator
  JSON captures, kept **byte-identical** because a separate comparison declares
  them as its baseline.
- `roadmap/coordination-2026-10/` — the dated October 2026 batch proposals, convergence
  packages and the pre-consolidation cross-track protocols, archived 2026-10-23. Their
  relative links were written from `docs/roadmap/`.
- `roadmap/closed-phases/` — the closed T1.P01/P02, T2.P01/P02, T3.P01–P04 and T5.P01
  planning, acceptance and evidence packets, archived 2026-11-06. Their area READMEs stay
  live for current contracts and routing; these are historical records, not capability status.
- `roadmap/r217-core-editor-stability/` — the archived R217 child packets, acceptance and evidence,
  including post-S10 convergence, post-S19 owner review, World shell recovery, the S12–S15
  corrections batch, the S26 Experience workspace and the convergence campaign record. The
  [live R217 page](../roadmap/r217-core-editor-stability/README.md) remains current context; the
  closed [Core Editor Stability milestone](./roadmap/core-editor-stability.md) is beside this family.
- `roadmap/authorization-history/` — the 13 permission-only batch and slice authorization records
  archived 2026-11-06. [`../reference/decisions/next-batch-authorization-2026-10-17.md`](../reference/decisions/next-batch-authorization-2026-10-17.md)
  stays live because it owns the current R1-D/T4 deferral rulings.
- `roadmap/t5-expressive-geometry/` — the withdrawn T5 E0 execution plan and G0 commission,
  architecture proposal, independent proposal, reconciled proposal and kernel evidence. The
  [T5 umbrella](../roadmap/t5-expressive-geometry/umbrella-plan.md) remains live.
- `roadmap/` and `process/` — the 2026-11-06 workflow cutover: the former roadmap register
  (`roadmap-register-2026-11-06.md`), release list (`release-list-2026-11-06.md`),
  cross-track execution, parallel-track cutover, operations event procedures and batons,
  architecture cycle, and the `slice-closeout`/`phase-closeout` skills. Live routing is
  [`../workflow.md`](../workflow.md), [`../../focus.md`](../../focus.md) and
  [`../operations/README.md`](../operations/README.md).
- `prototypes/` — prototype evidence archived 2026-11-06: the runnable
  [Experience donor](./prototypes/experience-authoring/README.md), the
  [Integrated Experience V2 design and Design-QAs](./prototypes/integrated-experience-authoring/design/Prototype-V2-final-synthesis.md),
  the [UX3/V3 rationale](./prototypes/experience-ux-v3/design/README.md), the accepted
  [World shell round](./prototypes/world-experience-shell-round/README.md), the
  [Paper commission](./prototypes/paper-authoring-commission/PAPER-SHELL-PROPOSAL.md), and the inactive
  [Experience V2 plans](./prototypes/spatial-authoring/plans/experience-v2-prototype/implementation-plan.md)
  and [P26 specification](./prototypes/spatial-authoring/design/visual-system-refinement/specification-plan.md).
  The UX3 boards, gallery, specimens and capture scripts were removed; their pixels and
  source remain at pinned Git locators.

The rest of the baseline archive (shipped phase diaries, handoffs, superseded
plans, retired strategy snapshots, old shell and design specs) was deleted by
WP4 with a Git recovery route instead of a copy. Nothing here is a live route,
and no live document routes a reader through archived material as current
authority.

## How to recover deleted material

Git holds every deleted baseline file, and no replacement stubs were created.

```text
BASELINE SHA   e90a58224443bdbf44114d7285d55c983b79cc84   the pre-#115 tree
git show e90a58224443bdbf44114d7285d55c983b79cc84:<path>  → the file as it was

Archived MOVE   docs/archive/technical/<subject>/<file>   the record itself,
                                                          with its own layout kept
```

A document that needed a deleted file's content cites it in the
`git show <baseline>:<path>` form rather than linking it. Records whose quoted
paths are no longer openable declare them in an `EVIDENCE-PATHS: start … end`
region (see [`../README.md`](../README.md) → "Historical paths in a record"),
which exempts written paths but never a real link or anchor.

## How to read

Prefer the live route in [`../README.md`](../README.md) first. Enter here only
when the task needs historical rationale, or when bounded current evidence
cannot resolve a material provenance question.
