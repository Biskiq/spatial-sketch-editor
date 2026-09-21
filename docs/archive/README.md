# Archived Museum Docs

Historical plans, handoffs, specs, and deep guides. **Not active implementation authority.**

## Live authority

| Doc | Role |
|-----|------|
| [`../README.md`](../README.md) | Context router (navigation, rules, meta) |
| [`../roadmap/README.md`](../roadmap/README.md) | Roadmap tracker (status, order — authoritative) |
| [`../operations/current.md`](../operations/current.md) | Live working-tree delta |
| [`../reference/north-star.md`](../reference/north-star.md) | Product vision |
| [`../reference/architecture.md`](../reference/architecture.md) | Ownership / boundaries |

If archive conflicts with live tree, **live tree wins**. Pre-2026-09-05
versions of this table (which named a "P0" plan and a README layout from
2026-08-10) are obsolete.

## Contents

### Top-level deep guides (moved here 2026-08-10)

- `CAMERA_AND_LAYOUT.md` — long camera/path authoring checklist (contracts summarized in live README).
- `ASSET_WORKFLOW.md` — Paris GLB optimization checklist (summary in live README).

### `museum-editor/`

Former sectioned durable context (north-star, shell, scene, …). Folded into [`../README.md`](../README.md) 2026-08-10.

### `agent-handoffs/`

Shipped phase diaries (workspace 1–3, phases 0–7, 4–5, 6.x, full-track Phase 1, complete-refactor slices).

### `roadmap/`

Completed modern roadmap bundles, grouped by phase/slice. Closed-work
artifacts keep a path-preserving stub in the live tree plus a
`git show <A>:<path>` recovery line — that stub and anchor are what
actually guarantee exact reconstruction; archive copies here are for
multi-file bundles and non-text evidence only.

### `legacy/`

Retired global buckets and superseded trackers: the pre-migration plan
tracker, superseded brief stubs, advisory audits, cross-cutting strategy
snapshots.

### `plans/`

Completed workspace / phase-4 / phase-5 plans; old camera authoring plans; workspace release index.

### `refactor-audit/`

Jul 28 museum-editor audit + 9-slice refactor plan. Done.

### `superpowers/`

| Subfolder | What |
|-----------|------|
| `specs/` | Shipped designs (phase-5 textures, phase-6, full-track, old layout CAD design split) |
| `plans/` | Shipped/deferred plans (phase-6, full-track Phase 2/3 archaeology) |
| `reviews/` | Goal-alignment review for layout CAD (decisions now in live plan §12) |

## How to read

Handoffs = post-ship diaries. Plans = pre-implementation roadmaps. Specs = design for that phase. Prefer the live roadmap (`../roadmap/`) when a merged active file exists.
