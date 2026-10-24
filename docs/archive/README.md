# Archived docs

History, kept for provenance. **Not active implementation authority** — if an
archived document conflicts with the live tree, the live tree wins.

## Live authority

| Doc | Role |
| --- | --- |
| [`../README.md`](../README.md) | Documentation router (navigation, rules, meta) |
| [`../roadmap/README.md`](../roadmap/README.md) | Roadmap status and track register |
| [`../operations/current.md`](../operations/current.md) | Current work baton |
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
  packages and the pre-consolidation cross-track protocols, archived 2026-10-23 when
  [`../roadmap/cross-track-execution.md`](../roadmap/cross-track-execution.md) became the
  single current coordination route. Their relative links were written from `docs/roadmap/`.

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
