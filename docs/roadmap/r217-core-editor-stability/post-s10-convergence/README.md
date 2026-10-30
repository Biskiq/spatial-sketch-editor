# Post-S10 convergence — audit draft

**Planning only; unfinished handoff, 2026-10-30.** No convergence implementation is authorized by this draft. R217 remains open; S11 is not launched. Audit base: `9139f3c21f468b43d76dfccd3a3d4994b42c4234` (S10 merge, PR #229).

The owner requested an independent integrated audit and one planning PR: drift register, reconciled target specification, architecture map, small ordered execution slices, browser acceptance and owner decisions. This checkpoint preserves the research before the account usage window is exhausted. **The target specification and implementation-ready slice plans still need completion.**

## Executive findings

- Shell density and hierarchy drift are confirmed: an approximately 86 px Head versus the wireframe's 44 px, 352 px Index versus 256 px, oversized subject rows, raw internal identifiers, duplicated Card facts and a separate Experience dashboard. Individual Head button text is already close to prototype size; blindly shrinking every font would be wrong.
- Live drafting lacks geometric feedback. Layout preview coordinates are converted to Stage-local twice; Wall/Opening ghost output is empty. Scene transform ghosts are mounted on a layer that Paper hides.
- The perspective grid cutoff is reproduced. In sampled views the grid geometry already covers the missing region: **Camera depth clipping**, not insufficient rectangle extent, causes the observed boundary. The four-corner footprint algorithm has separate horizon/coverage risks to address after the proven cause.
- Paper Scene selection explicitly has no fill. In 3D the accepted S07 0.18 gold tint exists; revising its strength or Paper ink requires owner adjudication, not a claim that S07 accidentally omitted it.
- Camera transitions reverse both screen axes near the overhead endpoint. Browser frame inspection and a 21-pose numerical sweep reproduce the 180° roll. Twenty settled round trips preserve target and scale; the quarter-turn azimuth policy is intentional and must be distinguished from the roll defect.

## Read next

1. [Drift register](./drift-register.md): observed/inspected findings, severity and code anchors.
2. [Rendering investigation](./evidence/rendering-investigation.md): grid, Camera and selection diagnosis and bounded proposal frontier.
3. [Evidence manifest](./evidence/README.md): screenshots, reproduction scope and limitations.
4. [Planning frontier](./planning-frontier.md): candidate targets, architecture ownership, execution order and open decisions; not yet an approved implementation plan.
5. [Resume checkpoint](../../../operations/checkpoints/r217-post-s10-convergence.md): exact remaining work and environment.

## Scope and authority

Match the accepted wireframe shell appearance while retaining the redesigned production interaction model. The wireframe is a minimum acceptance baseline, not a reason to remove later capabilities. Historical interaction is evidence of missing capability, never code to copy back. PLATE and the spatial grammar remain design authorities; accepted R217 contracts remain current until explicit adjudication/cutover. No new geometry/picking authority, global shell rewrite, new feature catalogue, Slice/Brush, Levels, publication feature or visitor authoring machinery.

The only non-documentation exception explicitly authorized by the owner is the existing small Docker bug fix: include `geometry-core` in the API image's workspace manifests and source copies, and mount its source in Compose. Both edits are included unchanged. They repair the workspace dependency closure; they do not implement convergence.
