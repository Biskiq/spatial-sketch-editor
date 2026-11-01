# R217.S20 — Roles and Head (closed)

**AUTHORITY: NONE.** R217.S20 is accepted at tested revision `b5f1440b` on 2026-11-01 and ships by the
P1 merge of PR #248. The [acceptance record](./acceptance.md) owns the delivered behaviour, the evidence
and the anchors; the [phase slice register](../README.md#slice-register) owns status.

```text
delivered       Head: one 44 px row in the wireframe's order (Index toggle, Biskiq, the project name with
                its menu, World | Experience lens, location chip, Find, Undo, Redo, Save, Preview). The ☰
                menu and Technical details leave the ordinary surface. The Stage ⚙ holds 2D appearance,
                Height Sheet side, Reduce motion and motion speed. Find reaches every displaced capability
                and Keys. Refusals are focus, hover and tap disclosures with accessible descriptions.
                Shell type, colour and density roles sit on `.editor-host`.
contract        docs/reference/design-system/editor-shell-and-visual-system.md (PLATE, amended at cutover
                under owner decision O5); the shaded-Plan ruling in docs/roadmap/r217-core-editor-stability/README.md#scope-rulings
provenance      accepted tested revision b5f1440b (production 1873ca4e, tests 62d1a743, review fixes
                331fe8b4, 8b856425, b5f1440b); implementation PR #248 from main 7cdc662e; plan last changed
                at 050a30d9 (on main through PR #230); closeout on the same branch; P1 merge recorded in the
                post-merge anchor record.
evidence        Full gate at b5f1440b (check, the four kernel checks, test:arch, npm test, test:heavy, build,
                git diff --check) and the Head browser matrix at four widths plus coarse pointer, all in the
                acceptance record.
entry points    implementation apps/editor/src/lib/authoring/stage/shell/EditorHead.svelte
                                apps/editor/src/lib/authoring/stage/shell/StageDraftingControl.svelte
                                apps/editor/src/lib/authoring/stage/shell/EditorIndex.svelte
                                apps/editor/src/lib/authoring/stage/shell/shell-roles.css
                                apps/editor/src/lib/platform/ProjectLifecycleActions.svelte
                                apps/editor/src/routes/project/[projectId]/spatial/+page.svelte
                regressions     apps/editor/tests/lib/authoring/head-find.test.ts
                                apps/editor/tests/lib/authoring/head-save.test.ts
                                apps/editor/tests/lib/authoring/head-drafting-config.test.ts
                                apps/editor/tests/lib/authoring/head-save-journey.test.ts
residuals       Index and Card density roles are defined but applied by R217.S21 (D06). Perf browser flows
                still target the removed ☰ menu and the Stage's Open source JSON: TD-16. Native touch and
                Safari stay with S11's manual rows. A server-refused Save is covered by head-save.test.ts
                and was not browser-verified (no Cloud service in the session).
recovery        git show 050a30d9:docs/roadmap/r217-core-editor-stability/r217.s20-roles-and-head/implementation-plan.md
                · tag closed/r217.s20
```
