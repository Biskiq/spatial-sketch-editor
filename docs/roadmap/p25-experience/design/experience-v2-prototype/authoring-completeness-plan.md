# C9 — final model-first Experience reconciliation for #113 (CLOSED)

**AUTHORITY: NONE.** This stub replaces the completed C9 plan. It competes with nothing in
`reference/*`. The full body is preserved in Git (recovery below).

- **Delivered:** C9.1–C9.9 implemented and reviewed in the unified `spatial-authoring/`
  prototype; MP1–MP4 owner-accepted for functionality (not final visual UX). Closed with #113.
- **Contract:** the former #113 design lock/A1–A7 is historical. Current
  [PLATE §0.8.1](../../../../reference/design-system/editor-shell-and-visual-system.md#081-finalized-experience-shell-expression)
  promotes accepted Conservatory UX; C9 keeps functionality/regression evidence.
  UX3/V3 and UX0–UX7 are inactive, with original records retained.
- **Provenance:** [PR #113](https://github.com/Biskiq/spatial-sketch-editor/pull/113), branch
  `prototype-v2`; slice id `p25-experience-v2`.
- **Evidence:** [C9 evidence](../../../../../prototypes/spatial-authoring/qa/EXPERIENCE-C9-EVIDENCE.md)
  (executable provenance, gate numbers, closeout preservation report). Recorded, not rerun
  for closeout: Node 140/140, 24 axes 1073/1073, successor 102/102 rejected, arch 276/276.
  Manual-owed rows: MP1–MP4 functional acceptance (owner, 2026-10-04/05/11); visual UX deferred
  to PR #114 (its gate). Standing limitation: missing P23B fixture blocks root test/check/build.
- **Entry points** (plain paths; behavior owners, not this stub):
  - implementation: `prototypes/spatial-authoring/app/experience-model.js`,
    `prototypes/spatial-authoring/app/experience.js`,
    `prototypes/spatial-authoring/app/experience-runtime.js`,
    `prototypes/spatial-authoring/app/experience-coordination.js`,
    `prototypes/spatial-authoring/app/camera-evaluation.js`
  - validation: `prototypes/spatial-authoring/qa/run-all.sh`,
    `prototypes/spatial-authoring/qa/walkthrough-check.sh`,
    `prototypes/spatial-authoring/qa/composition-mutation-check.sh`
  - regressions: `prototypes/spatial-authoring/tests/experience-model.test.mjs`,
    `prototypes/spatial-authoring/tests/experience-c9-review.test.mjs`,
    `prototypes/spatial-authoring/tests/experience-runtime.test.mjs`
- **Residuals:** PR #114 V3 design review (UX1–UX6/review corrections exist; V3 implementation awaits ratification) · PR #115
  Paper PA0–PA12 · D8 mid-Guide Preview + hold consolidation (past #114) · P23B fixture blocker.
- **Recovery:** `git show 74e8610464ad6c2cee913a3423d867dcc61f2a20:docs/roadmap/p25-experience/design/experience-v2-prototype/authoring-completeness-plan.md` · tag `closed/p25-experience-v2`
