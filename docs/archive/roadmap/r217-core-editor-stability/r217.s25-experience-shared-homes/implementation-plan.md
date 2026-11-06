# R217.S25 — Experience shared homes (closed)

**AUTHORITY: NONE.** R217.S25 is accepted by the owner at tested revision `703712d7` on 2026-11-03 (owner-override). The [acceptance record](acceptance.md) owns the ruling, gates and residuals; the [phase slice register](../../../../roadmap/r217-core-editor-stability/README.md#slice-register) owns status.

```text
delivered       Experience presentations, Stops and Guide move into the shared homes: lens and Preview in the Head;
                Presentation groups in the Index; Presentation and Stop facts, More and ••• in the Card; Capture and
                View on the lower edge; the Guide closed by default, opened from the Index, Card or dock.
                ExperienceSurface.svelte is retired. Controller behaviour is unchanged.
contract        Shell contract Experience sections reconciled in the shared-homes commit. No persisted format, gate
                or F interface changed.
provenance      accepted tested revision 703712d7 (code 66041049, fb4b2dea, f31683e7, 703712d7; base e9e778a0 on main).
                Plan last full body at 660410499a7b76c18419907b32ea3bfb332cd9b9.
evidence        Gates and owner ruling in the acceptance record. Browser comparison against the production-shell
                wireframe at 1440×900 by the main session; no screenshots kept.
entry points    implementation  apps/editor/src/lib/authoring/experience/experience-controller.svelte.ts
                                apps/editor/src/lib/authoring/experience/ExperienceHomesHost.svelte
                                apps/editor/src/lib/authoring/experience/ExperienceDock.svelte
                                apps/editor/src/lib/authoring/stage/shell/EditorIndex.svelte
                                apps/editor/src/lib/authoring/stage/shell/EditorCard.svelte
                                apps/editor/src/routes/project/[projectId]/spatial/+page.svelte
                regressions     apps/editor/tests/lib/authoring/experience-shared-homes-shell.test.ts
                                apps/editor/tests/lib/authoring/spatial-route-experience-homes.test.ts
                                apps/editor/tests/lib/experience/experience-shared-homes.test.ts
                                apps/editor/tests/lib/experience/experience-homes-components.test.ts
residuals       Experience switcher stays in the Index crumb (Round 2 wireframe places it in the Head); no total time
                readout and ordinal bar until R217.S26 (D9). Integrated journeys and coarse-pointer, native-touch and
                Safari rows stay with R217.S11.
recovery        git show 660410499a7b76c18419907b32ea3bfb332cd9b9:docs/roadmap/r217-core-editor-stability/r217.s25-experience-shared-homes/implementation-plan.md
