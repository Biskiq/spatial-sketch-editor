# Acceptance — World | Experience shell round

**Accepted:** 2026-10-01 · [PR #111](https://github.com/Biskiq/spatial-sketch-editor/pull/111) ·
branch `world-workspace-redesign`.
**Nature:** accepted/frozen **prototype-level design direction** (design evidence),
not a production contract and not implementation authorization.

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
- Durable shell/reference authority is reconciled: PLATE §0.8 states the accepted
  destination shell laws and routes to the synthesis + QA; roadmap, P26 routing
  and the operations baton reflect the frozen state.
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

Run on `world-workspace-redesign` at the PR head immediately before this closeout
commit (2026-10-01); the closeout commit itself is documentation-only, so no lane is
invalidated by it.

- **Documentation/link gate** (`cd apps/editor && npx vitest run --config
  vitest.arch.config.ts tests/docs`) — **22 tests passed**; every relative link,
  written path and `#anchor` in the tree resolves, including the synthesis →
  QA-board links and the synthesis → PLATE §0.8 anchor.
- **Full architecture lane** (`npm run test:arch -w @portfolio/editor`) —
  **276 tests passed across 24 files** (includes the documentation gate).
- **`git diff --check`** — clean (no whitespace errors).
- **Package routes:** all ten QA boards exist under their semantic names in this
  folder and every one is linked from the synthesis QA table.
- **Pruning routes:** no live Markdown/code reference remains to the removed
  designer brief, internal commission record or `designer-visuals.local`; the
  prototype-family router points at this workspace's README.
- **Residue scan:** no generation/copy residue remains in the accepted package.
- **Stale-claim scan:** no live document still states that the replacement shell
  is undesigned, that the round is preparing the independent design, or that no
  successor design is accepted.
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
durable promotions:             2 (PLATE §0.8 + §0.7.4/§26.2/§27 reconciliation; North Star lens-switch law)
routing updated:                5 live documents (prototypes/README, docs/README, roadmap/README, P26 README, operations/current.md)
new live → removed-file links:  0
manual-owed verification rows:  0
remaining deferred items:       4 (workspace README)
```

## Merge readiness

Merge-ready at the final head: stale authority/routing is fixed, pruning is
complete, QA routes resolve, current-head verification passed, and the closeout
self-check found no scope expansion beyond documentation/design/assets. Merging
itself is the owner's action — this PR records acceptance, not a cutover.
