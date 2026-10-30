# R217.S09 — closed-work plan stub

**AUTHORITY: NONE.** Native form marks shipped in PR #228. The phase [slice register](../README.md#slice-register) owns status; the current form-size planner and mark contracts remain authoritative in their implementation and shared Stage contracts.

- **Delivered:** native-form Move/Turn, Scale disclosure, and Width/Height/Depth marks through the existing planner and history path.
- **Contract:** marks and Card share facts/refusals; form extent remains 0.001–100 m and scale [0.01, 100].
- **Provenance:** PR #228, merged by P1 merge commit.
- **Evidence:** [acceptance record](./acceptance.md) and [independent review](./evidence/independent-final-review.md).
- **Entry points:** `apps/editor/src/lib/authoring/adapters/scene.adapter.ts`; `apps/editor/src/lib/authoring/adapters/scene/shape/form-size.ts`; regressions `apps/editor/tests/lib/authoring/shape-reading-adapter.test.ts`, `apps/editor/tests/lib/authoring/native-form-paper-agreement.test.ts`.
- **Residuals:** T5.P02 Object Focus work and R217.S11 integrated gate remain separately owned.
- **Recovery:** `git show ca1a149512b42e7618b74db2e2e08fcd58fe486c:docs/roadmap/r217-core-editor-stability/r217.s09-native-form-marks/implementation-plan.md` · tag `closed/r217.s09`.
