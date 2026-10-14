# `lib/authoring/` — retained pure semantics

PR #115 deleted the editor shell (`lib/editor/**`): the Plan FSM, the Plan
presentation layer, the Layout editor adapters and the Scene-embedded camera
navigation graph all went with it.

A module survived that deletion only if it met **all four** criteria
(`docs/roadmap/parallel-track-cutover/implementation-plan.md` §4.3):

1. it is **pure** — no Svelte, no runes, no store;
2. it does **not** depend on the old shell/session types (`editor-types`,
   `editor-selection`, `editor-store`);
3. it implements semantics the **accepted destination still requires**;
4. it is **covered by tests**.

That is a retention test, not a maturity claim. These modules are kept **by
criteria, not by consumer count**: most have no product importer today, because
the authoring UI is a T-track capability to rebuild
(`docs/roadmap/parallel-track-cutover/acceptance.md` §10, a6).

| Directory | Retained modules | Why it survived | Later owner |
| --- | --- | --- | --- |
| `camera/` | `editor-camera-framing`, `-framing-envelope`, `-framing-authoring`, `-path`, `-view`, `editor-directed-edge-motion`, `editor-camera-timing`, `editor-camera-connections`, `route-clone` | Pure Camera authoring math: framing envelopes, interior-anchor path editing, directed-edge timing and connectivity — Camera-owned semantics independent of the shell | **T3** Camera-unit extraction, which decides whether they belong in `packages/camera-core` |
| `layout/` | `plan-hit`, `plan-numeric-entry`, `layout-exact-input`, `snap-input-validation` | Hit resolution against compiled query records with a locked priority, and exact-value parsing/validation; PLATE precision and refusal still require these | T1 viewport/precision slices |
| `scene/` | `cluster-obb`, `obb-util`, `scale-vector`, `editor-vector`, `plan-scene-footprint`, `plan-scene-hit` | Placement-local bounds, derived footprint and hit — the T2 "derived footprint, support-owned Y" obligation | T2 placement slices |
| `a11y/` | `roving-focus` | A keyboard roving-focus primitive (accessibility behavior) | T1 shell |

**Coverage.** These modules carry no dedicated test file of their own: their
original editor-coupled suites were deleted with the shell, and the surviving
coverage is wherever a retained suite imports the module — today `plan-hit` and
`layout-exact-input` are exercised through `apps/editor/tests/lib/layout/`
(`layout-wall-selection`, `layout-drafting`, `layout-geometry-boundary`).
Restoring a dedicated contract per module is a T1/T2/T3 obligation, recorded
rather than assumed.

The obligations these modules serve are recorded in the track planning evidence:
`docs/roadmap/t1-spatial-world/planning-evidence.md`,
`docs/roadmap/t2-composition/planning-evidence.md` and
`docs/roadmap/t3-experience/planning-evidence.md`.

**Not here:** unreviewed copies of deleted code. Anything removed from
`lib/editor/` is recoverable from Git at the baseline SHA
`e90a58224443bdbf44114d7285d55c983b79cc84`; a later slice that wants one restores
it deliberately, with a reviewed reason — there is no dormant copy in the tree.

**Import direction.** These modules are editor-side only. No editor machinery may
enter a visitor chunk; see `docs/reference/architecture.md`. The test manual is
`apps/editor/tests/README.md`.
