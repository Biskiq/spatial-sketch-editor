# Post-S10 convergence — audit and plan

**Planning complete, 2026-10-30; owner decisions accepted, slices not registered.** No convergence implementation is authorized by this plan. R217 remains open; S11 is not launched. Audit base: `9139f3c21f468b43d76dfccd3a3d4994b42c4234` (S10 merge, PR #229).

The owner requested an independent integrated audit and one planning PR: drift register, reconciled target specification, architecture map, small ordered execution slices, browser acceptance and owner decisions. All of these are below, revised after the owner's review of PR #230. The owner accepted [O1–O9](./owner-decisions.md) as recommended on 2026-10-30. The next step is the owner's decision to register the slices.

## Executive findings

- Shell density and hierarchy drift are confirmed: an approximately 86 px Head versus the wireframe's 44 px, 352 px Index versus 256 px, oversized subject rows, raw internal identifiers, duplicated Card facts and a separate Experience dashboard. Individual Head button text is already close to prototype size; blindly shrinking every font would be wrong.
- Live drafting lacks geometric feedback. Layout preview coordinates are converted to Stage-local twice; Wall/Opening ghost output is empty. Scene transform ghosts are mounted on a layer that Paper hides.
- The perspective grid cutoff is reproduced. In sampled views the grid geometry already covers the missing region: **Camera depth clipping**, at both the far and near planes, causes the observed boundaries. The four-corner footprint separately loses coverage. A probed candidate removes every sampled coverage miss but needs a line budget.
- Paper Scene selection explicitly has no fill. In 3D the accepted S07 0.18 gold tint exists; O1 raises its strength and darkens Paper ink as a ruling, not as a claim that S07 accidentally omitted it.
- Camera transitions reverse both screen axes near the overhead endpoint. Browser frame inspection and a 21-pose numerical sweep reproduce the 180° roll, and the cause is one sign. Twenty settled round trips preserve target and scale; the quarter-turn azimuth policy is intentional and must be distinguished from the roll defect.

- **Plan is held back by feedback and reach, not by its planners.** Gestures commit correctly with one Undo step, but a drag shows no geometry, dragging a selected body pans, Wall drags ignore Snap, and clicking an Opening always selects its Wall. Snap itself changes with zoom. The planners and snap engines needed already exist.

## Read next

1. [Owner decisions](./owner-decisions.md): the nine accepted rulings, the alternatives considered and what each governs.
2. [Target specification](./target-specification.md): what each area should become, including the interaction model.
3. [Execution plan](./execution-plan.md): order, ownership, files, rules, tests and browser acceptance per slice.
4. [Plan authoring audit](./plan-authoring-audit.md): every 2D operation, and what works, is broken, missing or deferred.
5. [Drift register](./drift-register.md): observed/inspected findings, severity and code anchors.
6. [Rendering investigation](./evidence/rendering-investigation.md): grid, Camera and selection diagnosis and the candidate probe.
7. [Evidence manifest](./evidence/README.md): screenshots, reproduction scope and limitations.

## Scope and authority

Match the accepted wireframe shell appearance while retaining the redesigned production interaction model. The wireframe is a minimum acceptance baseline, not a reason to remove later capabilities. Historical interaction is evidence of missing capability, never code to copy back. PLATE and the spatial grammar remain design authorities; accepted R217 contracts remain current until explicit adjudication/cutover. No new geometry/picking authority, global shell rewrite, new feature catalogue, Slice/Brush, Levels, publication feature or visitor authoring machinery.

The only non-documentation exception explicitly authorized by the owner is the existing small Docker bug fix: include `geometry-core` in the API image's workspace manifests and source copies, and mount its source in Compose. Both edits are included unchanged. They repair the workspace dependency closure; they do not implement convergence.
