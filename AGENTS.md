# Agent context — Personal / Museum

**Bootstrap only.** Durable hub: [`docs/README.md`](./docs/README.md) (router — start here).
Human overview: [`README.md`](./README.md).

Conflict: **`docs/` reference files + router win** over this file for product detail; **this file wins** for hard rules below.

## Repo facts

- npm workspaces; apps are `@portfolio/editor` and read-only `@portfolio/museum`.
- “Camera” = **3D guided PerspectiveCamera navigation**, not webcam.
- Root `dev` / `test` target editor; root `build` / `check` cover both apps.

## Hard rules

1. **One nav + one motion** — `camera-route.ts` + `camera-motion.ts` only; one navigation graph, no second evaluator.
2. **One authored project, two domains** — `LayoutDocument` owns architecture, `SceneDocument` owns entities/materials/lights/cameras; never merged. Canonical Layout is wall-first (`formatVersion: 5`); canonical Scene is world-local (`formatVersion: 1`, project/world coordinates, no `roomId`). Versionless room-frame payloads are legacy compatibility only.
3. **Scene SoT** — authored connection anchors are interior only; node-view endpoints are generated at runtime, never persisted. No generated/render state persisted.
4. **Visitor isolation** — the editor ships in production at `/`, `/editor`, and `/museum/editor` (no build-flag gating). `/museum` is visitor-only: no editor/layout UI or editor code in its chunks.
5. Editor helpers outside `MuseumScene` / visitor imports.
6. No second graph/motion/geometry compiler; prefer Floor/Wall/Ceiling planes.
7. Svelte 5 runes; Threlte patterns; `scroll-travel` unused.
8. **No commits** unless user asks.
9. **Token discipline (progressive disclosure)** — start at `docs/README.md`, follow router links, read minimum sufficient context. Routes are starting points, not hard boundaries: do not preload deeper or adjacent docs speculatively; expand into docs/code/tests/Git only when the task, missing information, or contradictory evidence requires it. Never preload the tree; archive is opt-in historical evidence, not current truth.
10. **Truth precedence** — for doc-vs-doc conflicts, highest wins:
    `operations/current.md → active plan → component contract →
    reference/architecture.md → reference/north-star.md → archive`.
    A **ratified durable design contract** is normative for its own domain and
    outranks older descriptive numbers there: today that is the shell +
    visual-system contract
    (`docs/reference/design-system/editor-shell-and-visual-system.md`), which owns
    shell composition, material, typography, control metrics and state
    language. Do not implement shell chrome from `reference/design-system/*`
    shell tables or from a component's scoped CSS.
    Source/tests/Git are implementation evidence, not another documentation
    tier. If they materially contradict `reference/`, use the reconciliation
    triage in `docs/README.md` rather than resolving by precedence alone.

## Boot contract

```text
START: docs/README.md
READ: smallest routed context that can answer the task
STOP: no additional reading currently justified (not "investigation forbidden")
NO: speculative whole-repo / whole-doc-tree preload
NO: archive unless routed or evidence requires it
NO: commit/push unless allowed

ON slice acceptance complete:
use slice-closeout skill

ON substantial unfinished work needing same- or cross-agent resume:
use work-checkpoint skill
```
