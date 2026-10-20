# T2.P01.S04 — closed plan stub

AUTHORITY: NONE — shipped slice plan preserved in Git.

```text
VERIFICATION: exhaustive
```

The accepted verification tier remains declared here because this slice is the phase's final gate and
the phase-close checker reads it from the planned route until the phase closes.

Delivered the bounded Scene composition loop on the shipped S01–S03 planners and the T1 Stage host: a
contributed `scene-compose` task and `Resize`/`Duplicate`/`Delete` Find entries, uniform positive
Resize on floor through `resize-on-floor` (numeric scale is the guaranteed route; no direct handle),
duplicate through `duplicate-one` with a captured id, and delete through `delete-one`. Resize and
Duplicate are admitted only where the planner's own `floorTransformSupport` can re-seat the subject;
lights, vertical planes, tilted primitives and models without verified contact show no `Scale` fact
and disable both commands with the reason. An open proposal is cancelled when the canonical selection
moves, and the panel stops reporting through task services after any accepted install (typed or
pointer) because TD-8's host closes the task synchronously.

The slice reuses T1's shipped *Download source JSON*, *Open source JSON* replacement guard and
*Reload remote*, and builds no Head, persistence or Save UI. Save is proved through the mounted
`EditorHead` over the accepted `conditional-save-current-v1` state machine; the browser journey
proves source download, invalid-open refusal, Undo/Redo byte identity and the refused/failed route
preservation. The phase's final gate passed on that evidence; see the [acceptance
record](./acceptance.md), which stays live while the phase-close decision is pending.

Provenance: PR #157; reviewed implementation `f39f630b`, integrated on `2cad26b9`; the accepted-install
pointer guard and the Plan-reading proof at `786c6035` and `206a30cb`. Owner acceptance 2026-10-19 from
the deliberate `slice-closeout` invocation. Verification: `exhaustive` tier; the acceptance record owns
the numbers, the tested revision and the residual list.

Entry points:

```text
implementation  apps/editor/src/lib/authoring/adapters/scene/SceneTransformInstrument.svelte
                apps/editor/src/lib/authoring/adapters/scene/placement.ts
                packages/project-model/src/scene-planning/operations.ts
regressions     apps/editor/tests/lib/authoring/scene-composition-loop.test.ts
                apps/editor/tests/lib/authoring/scene-compose-instrument.test.ts
                apps/editor/tests/lib/authoring/scene-proposal-lifetime.test.ts
                apps/editor/tests/lib/authoring/head-save-journey.test.ts
                apps/editor/tests/lib/authoring/spatial-route-source-replacement.test.ts
```

Residuals: no direct Resize handle or pointer preview; Resize/Duplicate are primitive-only; cloud Save
was not exercised in the browser (mounted-Head proof instead); Delete was not separately browser-run;
no 3D candidate mesh; the pointer commit path is guarded by regression rather than a browser drag. All
are named with their owners in the acceptance record.

EVIDENCE-PATHS: start — the following is a historical Git recovery path at the accepted closeout base.
`git show ca5167435a7accabd00b0135435753c25cb8639f:docs/roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s04-bounded-composition-loop/implementation-plan.md`
EVIDENCE-PATHS: end
