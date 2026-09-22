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

Completed modern roadmap bundles, grouped by phase/slice. **Archive here means browsable
evidence** — PNG/SVG/HTML atlases, screenshots, plates, measurements — copied
**byte-unmodified**, so Git stores one blob for both paths.

Closed-work *prose* (plans, QA records, research, design studies, reconciliations) is not copied
here: it keeps a path-preserving stub in the live tree plus a `git show <A>:<path>` recovery
line, which is what actually guarantees exact reconstruction.

#### Closed-work evidence — the live-path convention

This section owns *how* evidence is moved; the decision that evidence — and only evidence — is
copied at all belongs to [`slice-closeout`](../../.agents/skills/slice-closeout/SKILL.md)
("Closed work — compaction, not deletion").

```text
SINGLE EVIDENCE FILE   <dir>/<name>.<ext>
  bytes → docs/archive/roadmap/<phase>/<slice>/<dir>/<name>.<ext>   (unmodified)
  live  → <dir>/<name>.<ext>.md   sibling stub: AUTHORITY: NONE, RECOVER:, ARCHIVE: <path>
  links → repointed to the archived copy — being viewable is what that copy is for

EVIDENCE BUNDLE        <dir>/   the evidence moves whole, internal structure preserved so its own
  relative links keep resolving; the live path stays occupied by a stub directory holding only
  live  → <dir>/CLOSED.md   one manifest: every archived file + its anchor

HTML ENTRY POINT       <dir>/index.html → the manifest convention above; if a live doc links to it,
  write a valid HTML redirect stub at the live path instead (meta refresh to the archive copy),
  never a Markdown file carrying an `.html` name.
```

A mixed bundle therefore keeps prose stubs at their own paths, keeps the renderable copy, and gets
one manifest per moved directory.

- Copy bytes **unmodified**: a byte-identical copy costs no object storage, because Git stores one
  blob for both paths, while a rewritten copy forks a real duplicate and adds a second
  link-maintenance surface.
- Links that escape a bundle go stale as a result. Record that once in its manifest or nearest live
  stub; do not repair the copy, but do repair the **live** links that pointed at moved evidence.
- No size cap: a closeout reports the archived size so growth stays visible.

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
