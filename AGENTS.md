# Agent context — Personal / Museum

**Bootstrap only.** Durable hub: [`docs/README.md`](./docs/README.md) (router — start here).
Human overview: [`README.md`](./README.md).

Conflict: **`docs/` reference files + router win** over this file for product detail; **this file wins** for hard rules below.

## Repo facts

- npm workspaces; apps are `@portfolio/editor` and read-only `@portfolio/museum`.
- “Camera” = **3D guided PerspectiveCamera navigation**, not webcam.
- Root `dev` / `test` target editor; root `build` / `check` cover both apps.

## Hard rules

1. **One nav + one motion** — `camera-route.ts` + `camera-motion.ts` only.
2. **Architecture SoT today** — `rooms.ts` until B4/B5. New rooms → `LayoutDocument`; layout must not drive `/museum` before those gates.
3. **Scene SoT** — `scene.json` v6; interior connection anchors only; never persist generated endpoints.
4. **Visitor isolation** — the editor ships in production at `/`, `/editor`, and `/museum/editor` (no build-flag gating). `/museum` is visitor-only: no editor/layout UI or editor code in its chunks.
5. Editor helpers outside `MuseumScene` / visitor imports.
6. No nav arrays in `rooms.ts`; no second graph/motion; prefer Floor/Wall/Ceiling planes.
7. Svelte 5 runes; Threlte patterns; `scroll-travel` unused.
8. **No commits** unless user asks.
9. **Token discipline (progressive disclosure)** — start at `docs/README.md`, follow router links, read minimum necessary context. Never preload the tree; archive is opt-in historical evidence, not current truth.
10. **Truth precedence** — when live docs conflict, highest wins:
    `source code + tests → operations/current.md → active plan → component
    contract → reference/architecture.md → reference/north-star.md → archive`.

## Boot contract

```text
START: docs/README.md
READ: minimum routed files
STOP: task answered
NO: recursive docs scan
NO: archive unless routed
NO: commit/push unless allowed

ON slice acceptance complete:
use slice-closeout skill
```
