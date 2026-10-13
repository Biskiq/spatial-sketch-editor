# World Spatial Interaction Reference — V2

**Primary enduring role:** executable advanced World interaction and behavioral QA.
The retained World journeys A–F cover Plan ↔ 3D/Camera continuity, Rotunda curved-wall
Unroll and partial readings, Section/Cut authoring, Ceiling Lift, nested Look,
cancellation, exact return and the practised/everyday creator variants.

This executable was adopted under #112 and extended by #113/#114. Its Experience
V2 authoring, visitor execution and both-lens continuity remain **historical
functional/regression evidence**, not the accepted Experience UX. The owner accepts
[Conservatory](../experience-ux-alternative/README.md); the promoted
[PLATE contract](../../docs/reference/design-system/editor-shell-and-visual-system.md)
owns shared shell and Experience authoring. [Paper §0.8.4](../../docs/reference/design-system/editor-shell-and-visual-system.md#084-world-paper-authoring-destination)
retains World 2D authoring depth; Conservatory's World mock does not replace it.

**Preservation, not further V2 development.** UX1–UX6 and their review corrections
remain in this branch with their tests, helpers and captures.
[The #114 branch-diff disposition](./qa/EXPERIENCE-UX-EVIDENCE.md#114-v2-branch-diff-disposition)
inventories what is retained and why. Do not continue UX1–UX7, implement UX3/V3 or
Paper PA0–PA12, or remove cross-domain modules merely to make this executable
World-only. They protect Camera, history, selection and World continuity.

C1–C8 and C9.1–C9.9 remain recorded functionality acceptance: MP1–MP4 were accepted
by the owner for functionality (MP3/MP4 2026-10-11), and #113 is closed.
[C9 recovery](../../docs/roadmap/p25-experience/design/experience-v2-prototype/authoring-completeness-plan.md)
and [C9 evidence](./qa/EXPERIENCE-C9-EVIDENCE.md) preserve that boundary.
No production interface, codec, Camera evaluator, snapshot history or renderer
strategy is promoted from this static prototype.

```sh
cd prototypes/spatial-authoring
python3 -m http.server 8826
# http://localhost:8826/                 explore; J opens the Presenter for the active lens
# http://localhost:8826/rationale.html   retained rationale and specimens
# ?journey=A&step=0&motion=instant       reproducible World Presenter entry
bash qa/run-all.sh journey             # World A–F checkpoints; focused behavioral reference
bash scripts/shoot.sh                  # regenerate specimens into qa/out/specimens
```

No build step. Three.js is vendored; Google Fonts have system fallbacks. The
Presenter and `window.__me` are prototype review facilities, not product UI.
[QA routing/policy](./qa/README.md) owns executable checks and their proof limits;
a documentation change alone does not require the full prototype sweep.

- [rationale.html](./rationale.html) — retained shell, A–F, intermediate readings and return.
- [IMPLEMENTER-REFERENCE.md](./IMPLEMENTER-REFERENCE.md) — formulas, validators,
  cancellation/navigation/task seams and limits; mechanisms are not production contracts.
- [qa/ACCEPTANCE.md](./qa/ACCEPTANCE.md) — World acceptance, coverage and preservation.
- [qa/EXPERIENCE-CONFORMANCE-ACCEPTANCE.md](./qa/EXPERIENCE-CONFORMANCE-ACCEPTANCE.md)
  — historical C1–C8 functional proof; board comparisons/Paper handoff are historical.
- [qa/EXPERIENCE-UX-EVIDENCE.md](./qa/EXPERIENCE-UX-EVIDENCE.md) — #114 V2 inventory
  and prior UX1–UX6 proof, with obsolete visual-gate wording preserved as history.
- [qa/EXPERIENCE-ACCEPTANCE.md](./qa/EXPERIENCE-ACCEPTANCE.md) — historical S0–S9.

Try the Garden window's Look → Unroll, or pull the Rotunda dog-ear and stop anywhere.
O unrolls, S squares up, K defines a Section (arrows slide/turn, −/= depth, Tab side,
Enter opens). Lift a ceiling, preview its gap correction, then U looks up.
Measure reaches numbers in place; P opens Precision. / searches; result verbs
distinguish selection, location, navigation and recovery. Esc leaves the foremost
writer/Precision/task; Back returns one reading; Shift-Esc puts the chain back.
Spatial navigation remains separate from source Undo.

Lens crossing cancels proposals and parks procedures inactive. Return is ordinary;
explicit Resume revalidates identity/targets and keeps the current realized Camera.
World-only footer controls remain inert in Experience. Their old Paper/#115
implementation assignment is retired, without altering this executable.

The shared Presenter retains A–F in World and historical Q1–Q8/advanced topics in
Experience. Its optional Next demonstrations use ordinary commands; outcomes are
advisory, never acceptance. Back/Skip/close/reopen author nothing. Read-only Preview
guidance remains separate from authored Guides. Reset/Load Example/Load Conformance
are explicit prototype facilities; they never silently play or move Camera.
The [Experience donor](../experience-authoring/README.md) remains runnable regression
evidence, and old design boards stay in their existing directories.

**Baton:** #114 accepted unified design → #115 parallel-track planning cutover →
foundation-gated production implementation. No new V2 or Paper prototype work.
The old phase-local [forward pointer](../../docs/roadmap/p26-spatial-depth/Final-Design-Prototype/README.md)
continues to route here; there is no second executable.
