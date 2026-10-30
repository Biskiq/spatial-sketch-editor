# R217.S08 — closed-work acceptance stub

**AUTHORITY: NONE.** S08 gives selected Scene catalogue models and primitives native Stage
manipulation using S07's shared mark vocabulary: a floor Move track, a Turn ring, a Scale
disclosure and the Size ray it reveals. The phase [slice register](../README.md#slice-register)
owns status; the current interaction, selection, mark and support contract is owned by
[architecture.md](../../../reference/architecture.md#editor-interaction-authorities).

- **Accepted:** 2026-10-29 by owner closeout direction. One independent cross-domain review covered
  the pre-integration tree and raised only should-fix findings; a follow-up owner Card lifecycle
  review found that ordinary Stage surface notifications rebuilt the Card controller and discarded
  uncommitted drafts and refusals. All actionable findings were fixed and pinned by the focused
  regressions below. No GitHub approval was recorded. The authorization covers S08 only and added no
  release-list row. Tested implementation revision `9d50dbd2`; preservation anchor `8b2f0ffc`.
- **Delivered:** `object-marks.ts` owns the four descriptor facts, live-pose bounds and shared planner
  dispatch. The selected catalogue model or primitive publishes a Move track through the footprint
  centre (`place-on-floor` with the S05 snap step), a vertical Turn ring (`set-yaw`), a Scale point
  disclosure that writes nothing, and the Size ray along the bounds diagonal (`resize-on-floor` with
  the captured `contactMinY`). A light, a form, a vertical plane or a model without verified contact
  publishes no object marks; a model without mounted bounds keeps Move and Turn but withholds
  Scale/Size rather than inventing an extent. The Scene Card is the exact writer for Position X/Z,
  Yaw and uniform Size, calls the same planner dispatch as its mark, and keeps Enter-commit,
  first-Escape-restore and blur-never-commit. One controller per selected entity preserves drafts
  and refusals across ordinary surface notifications, resets them on a subject change and refreshes
  accepted values live after a commit. The old `scene-arrange` task, its Find entries and its
  instrument posture are removed; Duplicate and Delete remain Card/context-menu actions; Place,
  Compose, Import and the Library posture remain. No new Scene planner, format change or per-axis
  model scaling was added.
- **Verification:** at tested revision `9d50dbd2`: `apps/editor npm run test:arch` — 23 files / 193
  tests; `apps/editor npm run test:full` — 240 files / 3,049 tests; `apps/editor npm run check` — 0
  errors / 0 warnings; `apps/editor npm run build` — success (Vite SSR/client plus the Vercel
  adapter); focused `npx vitest run` — 5 files / 118 tests (`scene-editing-surface`,
  `scene-object-card`, `spatial-route-gesture`, `scene-floor-support`,
  `scene-compose-instrument`). The closeout documentation gate, run after compaction,
  `npx vitest run --config vitest.arch.config.ts tests/docs` — 2 files / 56 tests. Coverage includes
  one F4 entry per mark release, S05 Move snap, Turn at the drawn floor plane, support-preserving
  Size, same-fact drag/typed editing, disclosure-without-write, Card refusal/blur/Escape, draft and
  refusal survival across a surface notification, subject-change reset, object Duplicate/Delete, and
  zero history/source change for an out-of-domain Size. S07's calibrated 22/44 px hit areas and
  coarse-pointer tests remain green. No browser capture was added; S08 changes no shell or general
  visual language.
- **Contract and entry points:** contract in
  [`architecture.md`](../../../reference/architecture.md#editor-interaction-authorities);
  implementation `apps/editor/src/lib/authoring/adapters/scene/object-marks.ts`,
  `apps/editor/src/lib/authoring/adapters/scene/object-card.ts`,
  `apps/editor/src/lib/authoring/adapters/scene/SceneObjectCardFields.svelte`,
  `apps/editor/src/lib/authoring/adapters/scene.adapter.ts`,
  `apps/editor/src/lib/authoring/adapters/scene/SceneTransformInstrument.svelte`,
  `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte`; regressions
  `apps/editor/tests/lib/authoring/scene-editing-surface.test.ts`,
  `apps/editor/tests/lib/authoring/scene-object-card.test.ts`,
  `apps/editor/tests/lib/authoring/spatial-route-gesture.test.ts`,
  `apps/editor/tests/lib/authoring/scene-floor-support.test.ts`.
- **Integration route:** [R217.S11](../r217.s11-integrated-final-gate/acceptance.md) owns the phase's
  integrated final gate and full-tree result.
- **Residuals:** native-form marks remain S09; a catalogue model without mounted bounds keeps
  Move/Turn but withholds Scale/Size; Compose's pre-existing Resize field remains available and was
  not made a second S08 writer; the owner's post-S10 Integrated Product Convergence pass owns
  remaining visual and foundation polish.
- **Evidence:** no renderable evidence was captured for S08, so no archive copy exists. The gate
  numbers, reviewed pull request and Git anchor own verification.
- **Preservation:**

  ```text
  CLOSEOUT PRESERVATION — R217.S08 (2026-10-29)
  prose compacted:                 2   stubs at their own paths
  reference promotions:            0   architecture promoted in the implementation commit
  renderable evidence archived:    0 files / 0 bytes
  evidence stubs / manifests:      0
  transient artifacts removed:     0
  historical anchor:               8b2f0ffcb227c85c183205120fbe15eb1e20aed1 · tag closed/r217.s08 (local only — not pushed)
  implementation revision:         9d50dbd2
  merge method:                    P1 GitHub merge commit (PR #225); post-merge anchor verification owed
  new live → archive prose links:  0
  manual-owed verification rows:   0
  remaining deferred items:        3   native-form marks (S09) · model without mounted bounds withholds Scale/Size · post-S10 convergence
  permanent stubs added:           2
  ```

- **Recovery:**
  `git show 8b2f0ffcb227c85c183205120fbe15eb1e20aed1:docs/roadmap/r217-core-editor-stability/r217.s08-scene-object-marks/acceptance.md`
  · tag `closed/r217.s08`.
