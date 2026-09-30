# Prototypes — durable executable product hypotheses

**Audience:** agents + humans.
**Hub:** [`../docs/README.md`](../docs/README.md) (documentation router) · [`../AGENTS.md`](../AGENTS.md) (bootstrap + hard rules).

`prototypes/` holds this repository's **durable runnable prototypes**: executable
product hypotheses that double as QA and design reference. A prototype is kept
here when it answers a question source, tests and prose cannot — *what exactly
should happen, frame by frame, and what is the rule* — and it stays runnable so
that answer can be re-checked against a live build rather than a screenshot.

## Boundary

- **What this family is.** Durable executable product hypotheses and QA/reference
  artifacts. They may be used to **test and challenge product and design contracts**.
- **What it is not.** Not a production application, not persisted-format authority,
  not implementation authority.
- **`apps/`** remains the production applications.
- **`packages/`** remains production/shared implementation.
- **`docs/reference/` and ratified contracts remain normative.** Where a prototype
  and a ratified contract disagree, the contract governs; the disagreement is
  reported as a finding rather than resolved by copying the prototype.
- **Prototype implementation shortcuts are never silently promoted into production
  contracts.** A prototype demonstrates interaction intent; production is built on
  the real architecture, and each prototype records the shortcuts it took.
- **Independently runnable where practical.** Each prototype carries its own build
  or serve entry point and is run from its own folder.

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
| [`spatial-authoring/`](./spatial-authoring/README.md) | **Spatial Authoring Prototype** | Accepted spatial-authoring / P26 experience reference. Its **journeys A–F** are the experience/QA authority for that direction. |
| [`experience-authoring/`](./experience-authoring/README.md) | **Experience Authoring Prototype** | The new Experience/Encounters authoring prototype: current experimental product/UX evidence, **pending architecture and shell reconciliation**. |
| [`world-experience-shell-sketch/`](./world-experience-shell-sketch/index.html) | **World \| Experience shell sketch** | Disposable, three-file interaction mock of the [one spatial workbench proposal](../docs/World-Experience-Shell-V2-Design.md). It tests shell flow only; it is **not Prototype V2** or semantic authority. |

## Authority semantics (do not read this move as a promotion)

Relocating a prototype into a durable family changes **where it is kept**, not
what it is authoritative for. In particular:

- **Spatial Authoring Prototype** — accepted experience/QA reference for the P26
  direction. Its implementation shortcuts (analytic caps, JavaScript modules,
  whole-model snapshots, tiny-FOV orthographic stand-in, independent
  clipping/membership logic, whole-model JSON Undo) are **evidence of interaction
  intent, not production contracts**.
- **Experience Authoring Prototype** — current experimental product/UX evidence,
  pending reconciliation. Its architecture and shell have **not** been reconciled
  with PLATE, F or the current domain ownership, and no reconciliation is
  authorized by its being kept here.
- **PLATE** ([`../docs/reference/design-system/editor-shell-and-visual-system.md`](../docs/reference/design-system/editor-shell-and-visual-system.md))
  remains shell and visual-system authority.
- **F** ([`../docs/reference/composition-execution.md`](../docs/reference/composition-execution.md))
  remains the composition/execution target authority.
- **Layout / Scene / Camera / Experience ownership** remains governed by the
  current reference contracts ([`../docs/reference/architecture.md`](../docs/reference/architecture.md)).
- **No production code change is authorized by a prototype being runnable here.**

## Running them

Each prototype is self-contained; run it from its own folder.

```sh
# Spatial Authoring Prototype — no build step, vendored Three.js
cd prototypes/spatial-authoring && python3 -m http.server 8826   # http://localhost:8826/

# Experience Authoring Prototype — Vite + Vitest + Playwright
cd prototypes/experience-authoring && npm install && npm run dev

# World | Experience shell sketch — plain HTML/CSS/JS
python3 -m http.server 8831 --directory prototypes/world-experience-shell-sketch
# Open http://localhost:8831/
```

Serve each on its own port; more than one may be running at once, so treat a
port in use as another prototype's server rather than an error to clear.

## Provenance

- **Spatial Authoring Prototype** — moved here 2026-09-29 from
  `docs/roadmap/p26-spatial-depth/Final-Design-Prototype/`, where it was the P26
  *Final Design Prototype* synthesised from designers B and D. A path-preserving
  stub remains at that phase-local location.
- **Experience Authoring Prototype** — imported 2026-09-29 from the separate
  `Experience-prototype` artifact (`Biskiq/Experience-Prototype`, `main` at
  `70d808f`). Its own Git repository was pruned on import: the artifact is now
  ordinary repository content in this history, and the upstream repository is the
  record of the prototype's earlier history.
