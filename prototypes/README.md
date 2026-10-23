# Prototypes — retained product and design evidence

**Audience:** agents + humans.
**Hub:** [`../docs/README.md`](../docs/README.md) (documentation router) · [`../AGENTS.md`](../AGENTS.md) (bootstrap + hard rules).

`prototypes/` holds this repository's **durable runnable prototypes** and
**bounded design/QA workspaces that directly evolve or supersede retained
prototype design**. Runnable artifacts answer what should happen, frame by
frame, and stay executable so that answer can be re-checked. A design workspace
records its question, evidence and acceptance boundary while preparing a
successor; it need not already contain an executable prototype. This family is
not a general home for unrelated design planning.

## Boundary

- **What this family is.** Durable executable product hypotheses, their
  QA/reference artifacts, and bounded workspaces directly evolving that design.
  They may be used to **test and challenge product and design contracts**.
- **What it is not.** Not a production application, not persisted-format authority,
  not implementation authority.
- **`apps/`** remains the production applications.
- **`packages/`** remains production/shared implementation.
- **`docs/reference/` and ratified contracts remain normative.** Where a prototype
  and a ratified contract disagree, the contract governs; the disagreement is
  reported as a finding rather than resolved by copying the prototype.
  An owner-authorized destination shell round may propose replacement treatments;
  it does not amend landed contracts or relax product/domain invariants.
- **Prototype implementation shortcuts are never silently promoted into production
  contracts.** A prototype demonstrates interaction intent; production is built on
  the real architecture, and each prototype records the shortcuts it took.
- **Independently runnable where practical.** Runnable prototypes carry their own
  build or serve entry point. Design/QA workspaces instead route their brief,
  evidence and eventual design outputs; retention alone implies no acceptance.

**Workspace boundary.** `prototypes/*` is deliberately **not** a root npm
workspace. The production workspace boundary remains `apps/*` + `packages/*`, so
root `npm install`, `npm run build`, `npm run check` and the test lanes never
reach into a prototype. Add one to `workspaces` only if a concrete build
requirement proves it necessary.

**Documentation boundary.** Prototype Markdown **is** held to the repository's
documentation contract: this file is routed from [`../docs/README.md`](../docs/README.md),
the prototype READMEs route their own evidence, and a broken relative link, stale
anchor or lost numbered section in any of them fails the unconditional
architecture lane. `prototypes/` is also a recognized route prefix, so a written
path such as `prototypes/spatial-authoring/README.md` resolves from the repository
root and is verified like `docs/` and `apps/` paths. Prototypes are outside
production authority; their documentation is still a route a reader follows.

| Reference | Role | Entry |
| --- | --- | --- |
| **Smart Wall (P2)** | Accepted intuitive spatial manipulation and revision: reshape a wall while artwork arrangement and lighting respond | [p2-smart-wall](./p2-smart-wall/README.md) |
| **Vellum (P3)** | Accepted expressive architectural sketching and revision; Make/Tell/Visit also demonstrates a visitor walk | [p3-vellum](./p3-vellum/README.md) |
| **Conservatory** | Experience authoring semantics and reproducible scenario fixtures; its shell chrome and visual treatment are superseded by Production shell Round 2 (below) | [experience-ux-alternative](./experience-ux-alternative/README.md) |
| **World Paper design** | Historical rationale for 2D authoring depth; its rail, families and Dimensions Instrument are superseded by Round 2 (the PLATE anchor is kept) | [PLATE §0.8.4](../docs/reference/design-system/editor-shell-and-visual-system.md#084-world-paper-authoring-destination) · [original proposal](./paper-authoring-commission/PAPER-SHELL-PROPOSAL.md) |
| **V2 Spatial Authoring** | World Spatial Interaction Reference: Plan ↔ 3D continuity, Rotunda Unroll/partial readings, Section/Cut, Ceiling Lift, nested Look/return and World journeys A–F/QA. Experience V2 is historical functional/regression evidence | [spatial-authoring](./spatial-authoring/README.md) · [#114 branch-diff disposition](./spatial-authoring/qa/EXPERIENCE-UX-EVIDENCE.md#114-v2-branch-diff-disposition) |
| **Object Composition** | Supporting unratified inspection, assembly, provenance, reach and repair research; no product/model/shell authority | [object-composition-prototype](./object-composition-prototype/README.md) |
| **Production shell wireframe** | Round 2 wireframe (visual-language pass, atlas board, tours, live A/B alternatives) of the integrated World and Experience production shell: **owner-ratified 2026-10-23 as the destination shell** and kept as accepted visual/behavioral evidence; promoted into PLATE, not itself authority or a contract ([record](../docs/reference/decisions/production-shell-round-2-ratification-2026-10-23.md)) | [README](./production-shell-wireframe/README.md) · [DESIGN-NOTE](./production-shell-wireframe/DESIGN-NOTE.md) |
| **Product foundation** | Current production implementation and its contracts; the linked references distinguish landed capabilities from the destination. Prototype resemblance alone never authorizes reuse | [architecture](../docs/reference/architecture.md) · [shell destination](../docs/reference/design-system/editor-shell-and-visual-system.md) |

Other retained evidence stays in its existing directories:

- [UX3/V3 proposal](./experience-ux-v3/design/README.md)
  and [15 generated PNGs](./experience-ux-v3/README.md): superseded design/rationale,
  with the standalone plan inactive. No PNG/layout-equivalence acceptance.
- [Integrated Experience V2](./integrated-experience-authoring/design/Prototype-V2-final-synthesis.md)
  and [earlier Design-QAs](./integrated-experience-authoring/Design-QAs/README.md):
  historical Experience design and functional evidence.
- [World shell round](./world-experience-shell-round/README.md): earlier accepted
  discovery/procedure/return rationale and specimens; Production shell Round 2
  supersedes conflicting shell treatment.
- [Experience Authoring donor](./experience-authoring/README.md): runnable
  behavioral/regression evidence, no current UX authority.
- [Paper commission](./paper-authoring-commission/designer-packet/COMMISSION.md):
  original brief and accepted proposal rationale. [PA0–PA12](./paper-authoring-commission/plans/inactive-adoption-plan.md)
  is inactive/unimplemented; #115 is parallel-track planning.

## Authority semantics

[PLATE](../docs/reference/design-system/editor-shell-and-visual-system.md) owns
the promoted destination shell (Production shell Round 2) and Experience design.
Prototype acceptance supplies UX/behavioral evidence, not mock data formats,
Camera evaluators, snapshot Undo or renderer architecture.
[F](../docs/reference/composition-execution.md), [architecture](../docs/reference/architecture.md)
and routed domain contracts preserve ownership, validity, history and isolation.
Production behavior remains separately described until its explicit cutover.

The accepted design ends the prototype-design detour: **#114 accepted unified
design → #115 parallel-track planning cutover → foundation-gated production
implementation**. UX1–UX7, V3-A–V3-F and PA0–PA12 are not active prototype work.
No directory reorganization or new V2 development is required.

## Running them

Each runnable prototype is self-contained; run it from its own folder. The shell
round is a design package (synthesis + QA boards), not a runnable application;
its accepted direction is adopted by the spatial-authoring prototype in #112.

```sh
# Conservatory — accepted interactive design, no build step
cd prototypes/experience-ux-alternative && python3 -m http.server 8841

# Production shell wireframe — ratified Round 2 evidence, no build step
cd prototypes/production-shell-wireframe && python3 serve.py 8850

# World Spatial Interaction Reference — no build step, vendored Three.js
cd prototypes/spatial-authoring && python3 -m http.server 8826   # http://localhost:8826/

# Experience Authoring Prototype — Vite + Vitest + Playwright
cd prototypes/experience-authoring && npm install && npm run dev

# Objects & Assemblies prototype — no build step, vendored Three.js
python3 -m http.server 8832 --bind 127.0.0.1 --directory prototypes/object-composition-prototype
# Open http://127.0.0.1:8832/
```

Serve each on its own port; more than one may be running at once, so treat a
port in use as another prototype's server rather than an error to clear.

## Provenance

- **World | Experience shell round** — commissioned from main at
  `1dfeb5d72e2d57cfd791cf14a3db9216581b0d63` and intentionally placed here by the
  owner in [PR #111](https://github.com/Biskiq/spatial-sketch-editor/pull/111),
  2026-10-01; accepted/frozen by that same PR. The commissioning briefs and
  designer-input copies are preserved in Git history only; the workspace
  [README](./world-experience-shell-round/README.md) records the durable
  provenance and authority boundary.
- **Spatial Authoring Prototype** — moved here 2026-09-29 from
  `docs/roadmap/p26-spatial-depth/Final-Design-Prototype/`, where it was the P26
  *Final Design Prototype* synthesised from designers B and D. A path-preserving
  stub held that phase-local location until PR #115 removed the retired P26 tree;
  the stub is recoverable at `git show e90a5822:docs/roadmap/p26-spatial-depth/Final-Design-Prototype/README.md`.
- **Experience Authoring Prototype** — imported 2026-09-29 from the separate
  `Experience-prototype` artifact (`Biskiq/Experience-Prototype`, `main` at
  `70d808f`). Its own Git repository was pruned on import: the artifact is now
  ordinary repository content in this history, and the upstream repository is the
  record of the prototype's earlier history.
