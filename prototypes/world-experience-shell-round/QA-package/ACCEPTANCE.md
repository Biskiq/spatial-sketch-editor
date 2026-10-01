# Acceptance — World | Experience shell round

**Accepted:** 2026-10-01 · [PR #111](https://github.com/Biskiq/spatial-sketch-editor/pull/111) ·
branch `world-workspace-redesign`.
**Nature:** finalized/frozen World and V2 Experience shell requirements, owner-promoted
into the durable destination shell contract. The syntheses/QA retain design records
and specimens; production implementation and cutover remain separately gated.

## Accepted outcome

- The unified **World | Experience** shell design direction is frozen:
  **persistent breadth, invoked depth**;
  **Select → Look or Details → Instrument → Precision**.
- The [final synthesis](../design/design-synthesis.md) is the canonical design
  artifact for this round.
- The [QA package](./) is canonical and semantically named; every board resolves
  from the synthesis QA table.
- Obsolete design-commission inputs (external designer brief, internal sourceful
  commission record, duplicated designer-input rasters) are pruned; Git history
  preserves them.
- Durable shell/reference authority is reconciled: PLATE §0.8–§0.8.3 owns shared/World
  laws, the finalized V2 Experience expression and explicit parked-procedure return.
  Both syntheses are promoted; their status labels, roadmap, P25/P26 routes and the
  operations baton agree. Camera View ownership remains Camera regardless of lens.
- P26 journeys A–F remain the deep World behavioral authority; accepted V2
  Experience semantics are preserved and not reopened.
- Production remains unimplemented: the editor still runs the landed PLATE-era
  shell, and the spatial-authoring prototype still runs its predecessor shell.

## Explicit next step

Bounded successor PR #112: adopt the frozen unified shell into
[`../../spatial-authoring/`](../../spatial-authoring/README.md), preserving P26
journeys A–F and behavioral laws, then run executable/visual QA. #112 is
prototype adoption — not production T1 implementation and not an F substitute.

## Deferred implementation questions

Carried in the workspace README:
[Deferred to repository-aware reconciliation](../README.md#deferred-to-repository-aware-reconciliation)
— internal-component selectable identity, shared-source/placement-override
semantics, temporary World reading state alongside canonical Camera/navigation
history, and PLATE's open §0.3/§0.7.6 owner calls. Nothing is invented here.

## Verification evidence

Recorded for `world-workspace-redesign` on 2026-10-01, including the review fixes in
the working tree. The architecture lane below was rerun after the documentation
changes. These checks verify documentation and production architecture boundaries;
executable/visual prototype adoption acceptance belongs to #112.

- **Documentation/link gate** (`cd apps/editor && npx vitest run --config
  vitest.arch.config.ts tests/docs`) — **22 tests passed**; every relative link,
  written path and `#anchor` in the tree resolves, including the synthesis →
  QA-board links and the synthesis → PLATE §0.8 anchor.
- **Full architecture lane** (`npm run test:arch -w @portfolio/editor`) —
  **276 tests passed across 24 files** (includes the documentation gate).
- **Whitespace** (`git diff --check` and `git diff --check main`) — clean. The latter
  checks the complete main-to-working-tree PR content, including committed changes
  and the local review fixes. Markdown trailing-space line breaks in the new World
  synthesis were removed; the earlier bare working-tree check did not cover the
  committed PR diff.
- **Package routes:** all ten QA boards exist under their semantic names in this
  folder and every one is linked from the synthesis QA table.
- **Pruning routes:** no live Markdown/code reference remains to the removed
  designer brief, internal commission record or `designer-visuals.local`; the
  prototype-family router points at this workspace's README.
- **Residue scan:** no generation/copy residue remains in the accepted package.
- **Status/authority scan:** the live router, prototype index, both final syntheses,
  PLATE and P25/P26 routes agree on the promoted destination design; World hardening
  is complete and the #112 prototype adoption baton remains explicit.
- **Scope review:** the full PR diff touches `docs/` and `prototypes/` only — no
  production code, no `apps/`, no `packages/`.

## Pruned commission material (recovery)

The external designer brief and the internal sourceful commission record were
removed from the live tree in commit `15f13ccc`; their last full bodies are at
`39edeb388940408cf4c28f75e61af684c5bc0211`. Recovery:

```bash
git show 39edeb38:prototypes/world-experience-shell-round/WORLD-EXPERIENCE-SHELL-DESIGNER-BRIEF.md
git show 39edeb38:prototypes/world-experience-shell-round/WORLD-EXPERIENCE-SHELL-BRIEF.internal-sourceful.md
```

If this PR lands squashed, that revision is not an ancestor of `main`; recover it
from the PR ref instead:

```bash
git fetch origin refs/pull/111/head && git show 39edeb38:<path>
```

The removed `designer-visuals.local/` copies were duplicates of already-retained
canonical inputs ([V2 boards](../../integrated-experience-authoring/Design-QAs/),
P26 references under `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/`
and [`spatial-authoring/screens/`](../../spatial-authoring/screens/)); they need no
separate anchor.

## Preservation summary

```text
prose compacted:                2 files (external brief, internal commission record) — Git anchors above
duplicate evidence removed:     10 PNG input copies (canonical sources retained)
durable promotions:             2 homes (PLATE shared/World + V2 Experience shell and return requirements; North Star lens-switch/Camera-exposure reconciliation)
routing updated:                6 live documents (prototypes/README, docs/README, roadmap/README, P25 README, P26 README, operations/current.md)
new live → removed-file links:  0
manual-owed verification rows:  0
remaining deferred items:       4 (workspace README)
```

## Merge readiness

The design package has reconciled authority/routing, complete pruning and resolved
QA routes. The verification above records the reviewed file contents, including the
fixes; it does not claim that later revisions inherit a pass automatically. The
preservation/self-check found no scope expansion beyond documentation/design/assets.
This record states design acceptance, not a production cutover.
