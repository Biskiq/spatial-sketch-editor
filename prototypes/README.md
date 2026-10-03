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

| Folder | Durable artifact | Status |
| --- | --- | --- |
| [`paper-authoring-commission/`](./paper-authoring-commission/designer-packet/COMMISSION.md) | **Independent 2D Paper design commission package** — one standalone Markdown brief with curated shell/surface references | Context preparation within the accepted World \| Experience shell. Its in-repository destination proposal, [`PAPER-SHELL-PROPOSAL.md`](./paper-authoring-commission/PAPER-SHELL-PROPOSAL.md), was **accepted by the owner 2026-10-03** (four refinement reviews, all rulings, corrected Wall semantics) and promoted into PLATE §0.8.4; the proposal remains rationale and design evidence. The [Paper adoption plan](../docs/roadmap/p26-spatial-depth/design/paper-authoring-prototype/implementation-plan.md) plans the work in [`spatial-authoring/`](./spatial-authoring/README.md); nothing is implemented. No commission dispatch and no production cutover. Copy only its `designer-packet/` folder for the independent handoff; the sibling `INTERNAL.txt` stays in the repository. |
| [`integrated-experience-authoring/`](./integrated-experience-authoring/design/Prototype-V2-final-synthesis.md) | **Finalized V2 Experience prototype design** — [final synthesis](./integrated-experience-authoring/design/Prototype-V2-final-synthesis.md) + visual QA boards in [`Design-QAs/`](./integrated-experience-authoring/Design-QAs/) | Accepted in #110; shell requirements promoted by the owner in #111 into PLATE §0.8.1 (2026-10-01). This retains the final design record and boards; the [V2 implementation plan](../docs/roadmap/p25-experience/design/experience-v2-prototype/implementation-plan.md) plans to extend `spatial-authoring/` as the single executable; it establishes no persisted formats or implementation mechanisms. Retired-exploration findings remain [reconciliation evidence](./integrated-experience-authoring/design/retired-exploration-findings.md). |
| [`world-experience-shell-round/`](./world-experience-shell-round/README.md) | **Finalized World shell design package** — [final synthesis](./world-experience-shell-round/design/design-synthesis.md) + canonical [QA package](./world-experience-shell-round/QA-package/) | Finalized/frozen; shell requirements promoted into PLATE §0.8 (PR #111, 2026-10-01), alongside V2 Experience. Supersedes P26 shell/chrome/tool exposure/disclosure where covered; journeys A–F remain the deep World behavioral oracle. World adoption is accepted in [`spatial-authoring/`](./spatial-authoring/README.md), #112; next is the #113 Experience executable/continuity proof. Promotion fixes destination design, with no production cutover. |
| [`spatial-authoring/`](./spatial-authoring/README.md) | **World Authoring Prototype** | Current accepted executable World shell + inherited P26 **A–F**, capabilities and spatial laws (#112). [QA acceptance](./spatial-authoring/qa/ACCEPTANCE.md) proves World-side parking/return through a read-only bridge; #113 owns real Experience continuity. No production cutover. |
| [`experience-authoring/`](./experience-authoring/README.md) | **Experience Authoring Prototype** | Retained Experience behavioral evidence / regression oracle. **Not current shell authority** — its shell is superseded by the accepted V2 synthesis above. |
| [`object-composition-prototype/`](./object-composition-prototype/README.md) | **Objects & Assemblies prototype (Commission 2)** | Retained unratified proposal for object-first composition, capability disclosure, reach and repair behavior. Secondary composition shell-pressure evidence for the unified round; its shell and model are not being reopened or adopted by that round. |

## Authority semantics — retention and explicit shell promotion

Relocating a prototype into a durable family changes **where it is kept**, not
what it is authoritative for. The separate owner promotion in #111 places both
finalized designs' shell requirements in PLATE, not in prototype code. In particular:

- **Accepted V2 synthesis + canonical QA** (`integrated-experience-authoring/`) —
  the finalized Experience prototype design. Its shell requirements are promoted
  into **PLATE §0.8.1**, the durable authority, including Scale × Depth, Set,
  Peek/Overview/Seam Deck, Ask Rule and progressive Camera disclosure. The retained
  synthesis/QA record supplies rationale and specimens, not persisted formats or
  implementation mechanisms.
- **World Authoring Prototype** — accepted executable/QA reference retaining the P26
  direction. Its implementation shortcuts (analytic caps, JavaScript modules,
  whole-model snapshots, tiny-FOV orthographic stand-in, independent
  clipping/membership logic, whole-model JSON Undo) are **evidence of interaction
  intent, not production contracts**. Its accepted unified World shell replaces the predecessor in place (#112); journeys A–F remain behavioral authority. Its Experience lens is a read-only continuity fixture, pending #113.
- **Unified World | Experience shell round** — the accepted design package lives
  here because it evolved retained prototype design. Its shell requirements are
  promoted into **PLATE §0.8**, alongside the finalized Experience expression;
  §0.8.2 owns explicit parked-task return. The ratchet preserves P26
  journeys/capabilities/interaction laws and accepted V2 Experience semantics. It
  supersedes P26 shell, chrome, tool exposure and disclosure where its synthesis
  explicitly covers them. C2 supplied secondary composition pressure, not
  destination UI. The accepted shell is adopted by the World prototype (#112);
  V2 Experience/cross-lens implementation follows in #113. This sequence grants no production implementation or
  persistence authority, and PLATE §0.8 owns the durable destination shell laws.
- **Experience Authoring Prototype** — retained Experience behavioral evidence /
  regression oracle, not current shell authority. Its architecture and shell have
  **not** been reconciled with PLATE, F or the current domain ownership, and no
  reconciliation is authorized by its being kept here. Its shell is superseded by
  the accepted V2 synthesis above; its behavior remains the oracle for what the
  implemented V2 must still do.
- **PLATE** ([`../docs/reference/design-system/editor-shell-and-visual-system.md`](../docs/reference/design-system/editor-shell-and-visual-system.md))
  owns both the landed shell descriptions and the explicitly promoted destination
  shell design (§0.8–§0.8.4). Those states remain distinct until cutover. Retention
  or prototype acceptance alone never amends PLATE; owner promotions do (#111 for
  §0.8–§0.8.3, the 2026-10-03 Paper acceptance for §0.8.4).
  Promotion authorizes no production cutover.
- **F** ([`../docs/reference/composition-execution.md`](../docs/reference/composition-execution.md))
  remains the composition/execution target authority.
- **Layout / Scene / Camera / Experience ownership** remains governed by the
  current reference contracts ([`../docs/reference/architecture.md`](../docs/reference/architecture.md)).
- **No production code change is authorized by a prototype being runnable here.**

## Running them

Each runnable prototype is self-contained; run it from its own folder. The shell
round is a design package (synthesis + QA boards), not a runnable application;
its accepted direction is adopted by the spatial-authoring prototype in #112.

```sh
# World Authoring Prototype — no build step, vendored Three.js
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
  stub remains at that phase-local location.
- **Experience Authoring Prototype** — imported 2026-09-29 from the separate
  `Experience-prototype` artifact (`Biskiq/Experience-Prototype`, `main` at
  `70d808f`). Its own Git repository was pruned on import: the artifact is now
  ordinary repository content in this history, and the upstream repository is the
  record of the prototype's earlier history.
