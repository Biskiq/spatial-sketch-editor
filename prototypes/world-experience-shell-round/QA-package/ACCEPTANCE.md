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

Recorded at the final head of PR #111 (`world-workspace-redesign`):

<!-- CLOSEOUT-VERIFICATION: replaced by the closeout commit with the actual run -->

- `cd apps/editor && npx vitest run --config vitest.arch.config.ts tests/docs` — documentation/link gate result recorded at the final head.
- `npm run test:arch -w @portfolio/editor` — full architecture lane result recorded at the final head.
- `git diff --check` — clean.
- Route checks: every Markdown route in the changed set resolves; all ten QA PNGs
  exist under their semantic names; no live reference remains to the removed
  commission files or `designer-visuals.local`; no `Pasted text` residue.

## Merge readiness

Merge-ready once the closeout self-check passes at the final head: stale
authority/routing fixed, pruning complete, QA routes resolve, verification
recorded, and no scope expansion beyond documentation/design/assets. Merging
itself is the owner's action — this PR records acceptance, not a cutover.
