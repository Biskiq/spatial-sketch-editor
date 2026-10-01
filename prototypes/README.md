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
| [`integrated-experience-authoring/`](./integrated-experience-authoring/design/Prototype-V2-final-synthesis.md) | **Accepted V2 design direction** — [final synthesis](./integrated-experience-authoring/design/Prototype-V2-final-synthesis.md) + canonical visual QA boards in [`Design-QAs/`](./integrated-experience-authoring/Design-QAs/) | Current V2 design authority / design evidence (accepted PR #110). The future V2 implementation home. Not a ratified contract: where it and a ratified contract disagree, the contract governs. Retired-exploration findings harvested as reconciliation evidence live [beside the synthesis](./integrated-experience-authoring/design/retired-exploration-findings.md). |
| [`world-experience-shell-round/`](./world-experience-shell-round/README.md) | **Accepted unified World \| Experience shell design package** — [final synthesis](./world-experience-shell-round/design/design-synthesis.md) + canonical [QA package](./world-experience-shell-round/QA-package/) | Accepted/frozen prototype-level shell/disclosure direction (PR #111, 2026-10-01). The round is complete: it supersedes P26 shell/chrome/tool exposure/disclosure where the synthesis explicitly covers them, while P26 journeys A–F remain the deep World behavioral oracle and accepted V2 Experience semantics are preserved. Next: adopt the shell into [`spatial-authoring/`](./spatial-authoring/README.md) in the bounded successor PR #112. Design evidence only — no production cutover, no implementation authority. |
| [`spatial-authoring/`](./spatial-authoring/README.md) | **Spatial Authoring Prototype** | Primary accepted World behavioral / QA evidence. **Journeys A–F**, capabilities and interaction laws remain behavioral authority; its executable shell/chrome/tool exposure/disclosure is the **predecessor shell pending adoption** of the accepted unified shell (#112). |
| [`experience-authoring/`](./experience-authoring/README.md) | **Experience Authoring Prototype** | Retained Experience behavioral evidence / regression oracle. **Not current shell authority** — its shell is superseded by the accepted V2 synthesis above. |
| [`object-composition-prototype/`](./object-composition-prototype/README.md) | **Objects & Assemblies prototype (Commission 2)** | Retained unratified proposal for object-first composition, capability disclosure, reach and repair behavior. Secondary composition shell-pressure evidence for the unified round; its shell and model are not being reopened or adopted by that round. |

## Authority semantics (do not read this move as a promotion)

Relocating a prototype into a durable family changes **where it is kept**, not
what it is authoritative for. In particular:

- **Accepted V2 synthesis + canonical QA** (`integrated-experience-authoring/`) —
  the current design direction for integrated Experience authoring. It is design
  evidence guiding the coming repo-aware reconciliation and implementation
  planning — not a ratified contract, not production authority.
- **Spatial Authoring Prototype** — accepted experience/QA reference for the P26
  direction. Its implementation shortcuts (analytic caps, JavaScript modules,
  whole-model snapshots, tiny-FOV orthographic stand-in, independent
  clipping/membership logic, whole-model JSON Undo) are **evidence of interaction
  intent, not production contracts**. Its executable shell is the **predecessor
  shell**, pending adoption of the accepted unified shell in #112; journeys A–F
  remain behavioral authority through that adoption.
- **Unified World | Experience shell round** — the accepted design package lives
  here because it evolved retained prototype design. The ratchet preserves P26
  journeys/capabilities/interaction laws and accepted V2 Experience semantics. It
  supersedes P26 shell, chrome, tool exposure and disclosure where its synthesis
  explicitly covers them. C2 supplied secondary composition pressure, not
  destination UI. The accepted shell is intended for adoption by P26 before V2
  Experience/cross-lens implementation; this sequence grants no implementation or
  persistence authority, and PLATE §0.8 owns the durable destination shell laws.
- **Experience Authoring Prototype** — retained Experience behavioral evidence /
  regression oracle, not current shell authority. Its architecture and shell have
  **not** been reconciled with PLATE, F or the current domain ownership, and no
  reconciliation is authorized by its being kept here. Its shell is superseded by
  the accepted V2 synthesis above; its behavior remains the oracle for what the
  implemented V2 must still do.
- **PLATE** ([`../docs/reference/design-system/editor-shell-and-visual-system.md`](../docs/reference/design-system/editor-shell-and-visual-system.md))
  remains the landed shell and visual-system contract. For the owner-authorized
  unified shell commission, its current topology is later reconciliation input,
  not independent-design destination authority. A proposed or accepted prototype
  successor does not amend PLATE or authorize a production cutover.
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
# Spatial Authoring Prototype — no build step, vendored Three.js
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
