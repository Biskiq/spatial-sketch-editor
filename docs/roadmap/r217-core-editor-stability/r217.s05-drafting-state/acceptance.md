# R217.S05 — closed-work acceptance stub

**AUTHORITY: NONE.** The phase [slice register](../README.md#slice-register) owns status. The
implemented behavior is owned by the Stage drafting/grid modules below; the approved S05 criteria
and complete review record are recoverable from Git.

- **Delivered:** readable adaptive Stage grid; shared Snap state for Layout Ink, Scene Place and
  S08 object Move; Grid/Snap labels and configuration; 2D/3D reading, scale framing and scale bar.
  S08 Card writers, marks, support admission and F4 planner behavior remain intact.
- **Accepted:** 2026-10-29 after independent review found no unresolved substantive finding. The
  review covered repair revision `a1112eb6d091892c76a1a6acded8fd5f046e1039`; product implementation
  and full verification are at `c5273726f3b3d854c845857b79fdcbb7339373e8`.
- **Evidence:** full `npm test` — 3,101 passed / 243 files; focused S05/S08 — 227 passed / 10 suites;
  `npm run test:arch` — 193 passed / 23 files; `npm run check` — 0 errors / 0 warnings;
  `npm run build` passed with existing notices. Independent review reran six affected behavioral
  suites — 160 passed. DB-backed API tests were not run; no API code changed.
- **Manual browser evidence:** in a fresh Enclosed room, a box placed at X/Z `(2, 2)` moved to
  `(1.5, 1.5)` with 0.5 m Snap. Snap off and Alt-held Move committed `(1.626129983, 1.365477549)`.
  One Undo after each restored `(2, 2)` while Card and marks stayed available; no stale-selection
  warning occurred. Nothing was saved. Ink/Place, 2D/3D, orbit/zoom, Scale/Fit and Automatic/Override
  intervals were also exercised in browser evidence recorded in the anchored full acceptance.
- **Contract and entry points:** implementation
  `apps/editor/src/lib/authoring/stage/stage-drafting.ts`,
  `apps/editor/src/lib/authoring/stage/stage-grid.ts`,
  `apps/editor/src/lib/authoring/stage/shell/StageDraftingControl.svelte`,
  `apps/editor/src/lib/authoring/stage/shell/StageGrid.svelte`,
  `apps/editor/src/lib/authoring/adapters/layout.adapter.ts`,
  `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte`; regressions
  `apps/editor/tests/lib/authoring/stage-drafting.test.ts`,
  `apps/editor/tests/lib/authoring/stage-grid.test.ts`,
  `apps/editor/tests/lib/authoring/scene-editing-surface.test.ts`,
  `apps/editor/tests/lib/authoring/head-drafting-config.test.ts`.
- **Residuals:** S11 integrated final gate remains outstanding. R217 remains active. PR #226 remains
  open and unmerged; no phase closure, track completion or cycle transition is claimed.

**CLOSEOUT PRESERVATION — R217.S05 (2026-10-29)**

- Prose compacted: 2 stubs at their own paths (implementation plan and acceptance record).
- Reference promotions: 0. Renderable evidence archived: 0 files / 0 bytes. Evidence stubs/manifests: 0.
- Transient artifacts removed: 1 recovery checkpoint.
- Historical anchor: `a7c22b7bb1a19c8fc75f59a7469904aee2a194d7` · tag `closed/R217.S05` (pushed to origin).
  Both full prose bodies are present at the anchor. The tag target preserves the anchor and its
  ancestors. PR #226 must land as a **merge commit** for the anchor to be reachable from `main`;
  post-merge verification (`git merge-base --is-ancestor a7c22b7bb1a19c8fc75f59a7469904aee2a194d7 main`)
  is pending the owner's merge decision.
- New live → archive-prose links: 0. Manual-owed verification rows: 0; browser observations above
  are recorded separately from automated evidence. Remaining deferred items: S11 final-gate integration.
- Permanent stubs added: 2 (the owner-ratified hybrid policy's accepted cost).

Recovery:

```text
git show a7c22b7bb1a19c8fc75f59a7469904aee2a194d7:docs/roadmap/r217-core-editor-stability/r217.s05-drafting-state/acceptance.md
git show a7c22b7bb1a19c8fc75f59a7469904aee2a194d7:docs/roadmap/r217-core-editor-stability/r217.s05-drafting-state/implementation-plan.md
```
