# T2.P01.S03 — closeout and acceptance stub

AUTHORITY: NONE — accepted evidence and full acceptance record are preserved in Git.

**Owner acceptance:** 2026-10-18, after the manual pointer Move failure was repaired, independently
reviewed with no findings, and re-proved in real Chrome.

**Delivered:** the first coherent Scene editing surface, including correct Stage-local → viewport CSS
mapping for pointer floor rays, Move and Shift-drag Yaw candidates/ghosts, F4 commits, and visible
pointer planner refusals. The original refusal was
`{ kind: "refused", code: "no-support", message: "No compiled Room floor supports this point." }`;
the shifted, unoccluded floor hit produced no candidate or ghost.

**Contract:** durable pointer, reading and acceptance rules are owned by
[composition-execution.md](../../../../reference/composition-execution.md). S03 consumes the landed
F4 host contracts; the integrated result remains owed at the phase's declared S04 route.

**Provenance:** PR #147; accepted working diff committed at
`2747f1691551296e21b17aa04dfd9de76cb08f59`; independent delta review found no issues.

**Evidence:** `architecture-integration` tier — editor check 0 errors / 0 warnings; fast 138 files /
1940 tests; arch 20 / 163; heavy 8 / 118; focused pointer regression 1 passed; documentation-reference
gate 55 / 55. Real Chrome proved Plan and 3D pointer Move, Shift-drag Yaw, commit, Undo/Redo and exact
post-release refusal. The [evidence manifest](../../../../archive/roadmap/T2.P01/t2.p01.s03-first-editing-surface/evidence/CLOSED.md)
indexes 11 archived screenshots / 951,101 bytes. Manual-owed S03 rows: 0.

**Entry points:**

```text
implementation  apps/editor/src/lib/authoring/adapters/scene.adapter.ts
                apps/editor/src/lib/authoring/adapters/scene/SceneTransformInstrument.svelte
                apps/editor/src/lib/authoring/adapters/scene/placement.ts
regressions     apps/editor/tests/lib/authoring/scene-editing-surface.test.ts
                apps/editor/tests/lib/authoring/scene-proposal-lifetime.test.ts
                apps/editor/tests/lib/authoring/scene-instrument-focus.test.ts
```

**Residuals:** TD-8 remains open; typed move+rotate is one intent group; Stage press while typed
entry is open follows the existing blur-cancel path; Place selection is not restored after Undo/Redo;
Place completion feedback is not displayed. Save, Preview, resize, duplicate and delete belong to S04.

## CLOSEOUT PRESERVATION — T2.P01.S03 (2026-10-18)

```text
prose compacted:                 1   this acceptance body; full body remains at anchor
reference promotions:            0
renderable evidence archived:    11 files / 951,101 bytes
evidence stubs / manifests:      1   evidence/CLOSED.md
transient artifacts removed:     25 temporary QA files; browser session, test tab and server stopped
historical anchor:               2747f1691551296e21b17aa04dfd9de76cb08f59 · tag closed/T2.P01.S03 (local only — not pushed)
new live → archive prose links:  0   evidence images and manifest only
manual-owed verification rows:   0   S04 integration remains at its declared route
remaining deferred items:        1   TD-8
permanent stubs added:           0   existing acceptance stub refreshed in place
```

P1 requires a **merge commit**. No merge was performed. After merge, verify the anchor is an ancestor
of `main`, then push the local-only tag.

Recovery:

```bash
git show 2747f1691551296e21b17aa04dfd9de76cb08f59:docs/roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s03-first-editing-surface/acceptance.md
git show closed/T2.P01.S03:docs/roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s03-first-editing-surface/acceptance.md
```
