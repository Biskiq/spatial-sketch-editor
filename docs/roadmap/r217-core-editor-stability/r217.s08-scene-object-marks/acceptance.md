# R217.S08 — acceptance record: Scene object marks

**Slice:** R217.S08 · **Status:** implemented; owner closeout pending · **Plan:**
[implementation-plan.md](./implementation-plan.md) (owns the criteria) · **Phase:**
[R217](../README.md) · **Integration route:** [R217.S11](../r217.s11-integrated-final-gate/acceptance.md)

A selected Scene catalogue model or primitive now uses the S07 mark vocabulary. A floor **Move** track
drives `place-on-floor` with the S05 snap step, a vertical **Turn** ring drives `set-yaw`, and a
**Scale** point reveals the **Size** ray that drives `resize-on-floor` with the captured
`contactMinY`. The Scale point is a disclosure: it writes no source, enters no history and is closed
by Esc, selection change or a task opening. The Scene Card is the exact writer for Position X/Z,
Yaw and uniform Size; each field submits the same planner dispatch as its mark, so dragged and typed
values install the same Scene bytes and share the planner's refusal words. The old `scene-arrange`
task, its Find entry and its instrument posture are gone; Place, Compose, Import and the Library
posture remain. A light, a form, a vertical plane or a model without verified contact publishes no
object marks; a model without mounted bounds withholds the Scale point and Size ray rather than
inventing an extent. Native-form marks remain S09 work.

- **Tested revision:** `9d50dbd2`. No GitHub approval was recorded; this record claims implementation
  and gate evidence, not owner acceptance or a release-list row.
- **Delivered:** `object-marks.ts` owns the four descriptor facts, the live-pose bounds, the shared
  planner dispatch and the F4 intents; `object-card.ts` owns the Card writer and Duplicate/Delete
  commands; `SceneObjectCardFields.svelte` is the Card view. The Card keeps one controller per
  selected entity: an ordinary Stage surface notification refreshes accepted values but preserves
  every uncommitted draft and visible refusal, while a different entity rebuilds the draft map. The
  adapter admits the marks through
  `stage-handles.ts` and the host projects/hit-tests them; there is no second gizmo system. Drag
  inputs quantize at 1e-9 (a nanometre) so pointer arithmetic cannot disagree byte-for-byte with an
  exact Card value. Turn hit-testing uses the same floor-plane elevation the ring is drawn at.
  Duplicate and Delete remain Card actions and context-menu operations; both are the existing
  `duplicate-one` / `delete-one` planners through the one F4 host. Removed: `scene-arrange`, its Find
  entries, its `SceneTransformInstrument` editing posture, and the two obsolete Arrange-only test
  files (`scene-instrument-focus.test.ts`, `scene-proposal-lifetime.test.ts`).
- **Verification:** at tested revision `9d50dbd2` (clean tree): `apps/editor npm run test:arch` —
  23 files / 193 tests; `apps/editor npm run test:full` — 240 files / 3,049 tests; `apps/editor
  npm run check` — 0 errors / 0 warnings; `apps/editor npm run build` — success (Vite SSR/client plus
  the Vercel adapter). Focused `npx vitest run` — 5 files / 118 tests
  (`scene-editing-surface`, `scene-object-card`, `spatial-route-gesture`, `scene-floor-support`,
  `scene-compose-instrument`). New coverage: one Move and one Size history entry; Move snap; Turn
  ring at the floor plane; Size keeps `position[1] + scale * contactMinY` on its support; disclosure
  activation writes nothing; object Card Duplicate/Delete on a real host; catalogue-model descriptor
  vocabulary; Card Enter refusal, blur and first-Escape restore in jsdom; a draft and its refusal
  survive an ordinary surface notification and reset on subject change; drag versus typed Position
  byte equality; zero history/source change for an out-of-domain Size. S07's calibrated 22/44 px
  hit-area and coarse-pointer tests remain green; S08 adds no hit-testing or glyph rule.
- **Review:** one independent cross-domain review covered the mark host, Scene planners/support,
  adapter, Card writer and tests. It found two writer blockers (Card refusals not refreshed after a
  refused commit; a rejected mark acceptance silently unhandled), one plan gap (object Duplicate and
  Delete absent from Card actions), and should-fix findings around the Turn hit plane, live
  disclosure geometry and the Card listener leak. All were fixed and pinned by the focused tests
  above. A follow-up Card lifecycle review found one more defect: every surface notification rebuilt
  the controller and discarded uncommitted drafts and refusals. The Card now retains one controller
  per selected entity, resets only on a subject change and reads accepted values live after commits;
  the new `scene-object-card` tests pin both paths. It also named two deliberate boundaries: Compose
  remains the pre-existing S04 command surface and was not expanded by S08; the no-task native-form
  size knobs remain untouched until S09 removes them with the per-axis form descriptors. No
  unresolved blocking finding remains.
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
  `apps/editor/tests/lib/authoring/spatial-route-gesture.test.ts`.
- **Integration route:** [R217.S11](../r217.s11-integrated-final-gate/acceptance.md) owns the phase's
  integrated final gate and full-tree result. The owner's post-S10 Integrated Product Convergence
  pass owns remaining visual and foundation polish; this record does not expand S08 into it.
- **Residuals:** native-form manipulation (move/turn and three size rays) is S09, as planned; a
  catalogue model without mounted bounds keeps Move and Turn but withholds Scale/Size; Compose's
  pre-existing Resize field remains available and was not made a second S08 writer; no automated
  visual capture was added because S08 does not change the shell or general visual language.
- **Recovery:** `git show 9d50dbd2` for the implementation tree; pull request
  [#225](https://github.com/Biskiq/spatial-sketch-editor/pull/225) is the review and closeout entry
  point and is not merged by this record.
